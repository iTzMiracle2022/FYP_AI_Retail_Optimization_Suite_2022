import pandas as pd
from difflib import SequenceMatcher

SYNONYMS = {
    'customer_id': ['customer_id', 'customerid', 'customer id', 'user_id', 'userid', 'user id', 'client_id', 'client id', 'uid', 'customer_ref', 'custid', 'cust_id'],
    'date': ['date', 'order_date', 'order date', 'purchase_date', 'purchase date', 'timestamp', 'datetime', 'transaction_date', 'transaction date', 'day', 'month', 'year', 'time', 'period', 'order_day', 'order day', 'recency', 'tenure', 'last_visit_date', 'last visit', 'last_purchase_date', 'last purchase'],
    'money': ['income', 'revenue', 'sales', 'spend', 'spent', 'amount', 'price', 'unit_price', 'monetary', 'earnings', 'total_spend', 'earning', 'salary', 'balance', 'spent_amount', 'spend_amount', 'cust_annual_earning', 'cust annual earning'],
    'quantity': ['quantity', 'qty', 'stock', 'stock_level', 'units', 'inventory', 'reorder_point', 'reorder', 'stocklevel', 'units_sold', 'units sold', 'units_in_stock', 'units in stock'],
    'frequency': ['frequency', 'count', 'transactions_count', 'purchase_count', 'visits', 'orders_count', 'order_count'],
    'product_ref': ['product_id', 'product id', 'prod_id', 'sku', 'item_id', 'item id', 'product_name', 'product name', 'item_name', 'item name', 'prodid'],
    'churn_target': ['churn', 'exited', 'churned', 'retention', 'attrition'],
    'demographic': ['age', 'education', 'marital', 'marital_status', 'marital status', 'gender', 'demographics', 'kidhome', 'teenhome', 'country', 'city', 'zipcode', 'profession', 'occupation', 'sex'],
    'forecast_target': ['demand_forecast', 'forecast', 'demand', 'predicted_demand', 'prediction']
}

def is_concept_match(col_name: str, concept: str, threshold: float = 0.8) -> bool:
    col_clean = col_name.strip().lower().replace('_', ' ').replace('-', ' ')
    if len(col_clean) < 2:
        return False
    syns = SYNONYMS.get(concept, [])
    for syn in syns:
        syn_clean = syn.strip().lower().replace('_', ' ').replace('-', ' ')
        if syn_clean in col_clean:
            return True
        if len(col_clean) >= 3 and col_clean in syn_clean:
            return True
        # Fuzzy ratio
        ratio = SequenceMatcher(None, col_clean, syn_clean).ratio()
        if ratio >= threshold:
            return True
    return False

def infer_data_role(series: pd.Series) -> str:
    series_clean = series.dropna()
    if len(series_clean) == 0:
        return 'TEXT_UNKNOWN'
        
    # Check 1: Date
    if pd.api.types.is_datetime64_any_dtype(series_clean):
        return 'DATE'
    
    is_string_dtype = pd.api.types.is_string_dtype(series_clean) or pd.api.types.is_object_dtype(series_clean)
    if is_string_dtype:
        try:
            sample_str = str(series_clean.iloc[0])
            if any(char in sample_str for char in ['-', '/', ':']) or len(sample_str) == 8:
                parsed = pd.to_datetime(series_clean, errors='coerce')
                if parsed.notna().sum() / len(series_clean) >= 0.8:
                    return 'DATE'
        except Exception:
            pass
            
    # Check 2: Binary
    unique_vals = series_clean.unique()
    if len(series_clean) > 2 and len(unique_vals) == 2:
        return 'BINARY_TARGET'

    # Check 3: Demographic categorical text helper
    if is_string_dtype:
        unique_set = {str(x).lower().strip() for x in unique_vals}
        demographic_words = {'single', 'married', 'divorced', 'widowed', 'phd', 'graduate', 'master', 'bachelor', 'high school', 'gender', 'male', 'female'}
        if unique_set.intersection(demographic_words):
            return 'DEMOGRAPHIC_CAT'
        
    # Check 4: Entity ID (highly unique, not continuous float)
    is_float = pd.api.types.is_float_dtype(series_clean)
    unique_ratio = len(unique_vals) / len(series_clean)
    if unique_ratio >= 0.95 and not is_float:
        return 'ENTITY_ID'

    # Check 5: Demographic numeric continuous helper
    if pd.api.types.is_numeric_dtype(series_clean):
        min_val = series_clean.min()
        max_val = series_clean.max()
        # Typical age range
        if 15 <= min_val <= 30 and 40 <= max_val <= 110:
            return 'DEMOGRAPHIC_AGE'
        # Typical household income range
        if 2000 <= min_val <= 50000 and 15000 <= max_val <= 500000:
            return 'DEMOGRAPHIC_INCOME'
        
    # Check 6: Numeric Continuous
    if pd.api.types.is_numeric_dtype(series_clean):
        if len(unique_vals) > 10 or unique_ratio > 0.2:
            return 'NUMERIC_CONTINUOUS'
            
    # Check 7: Category Numeric / Category
    if pd.api.types.is_numeric_dtype(series_clean):
        if len(unique_vals) <= 10:
            return 'CATEGORY_NUMERIC'
    else:
        return 'CATEGORY'
        
    return 'TEXT_UNKNOWN'

def count_distinct_demographics(col_profiles: list) -> int:
    categories = {
        'age': ['age', 'birth', 'dob', 'year_birth'],
        'gender': ['gender', 'sex', 'male', 'female'],
        'household': ['marital', 'kidhome', 'teenhome', 'children', 'dependents', 'family', 'partner'],
        'education': ['education', 'degree', 'phd', 'grad', 'undergrad', 'bachelor', 'master'],
        'location': ['country', 'city', 'zipcode', 'state', 'address', 'region'],
        'occupation': ['profession', 'occupation', 'job', 'work', 'employment'],
        'income': ['income', 'salary', 'earning']
    }
    
    matched_categories = set()
    for col, role in col_profiles:
        col_clean = col.strip().lower().replace('_', ' ').replace('-', ' ')
        
        # 1. Check inferred role first
        if role == 'DEMOGRAPHIC_AGE':
            matched_categories.add('age')
            continue
        elif role == 'DEMOGRAPHIC_INCOME':
            matched_categories.add('income')
            continue
            
        # 2. Check synonyms in column name
        matched_any = False
        for cat, synonyms in categories.items():
            if any(syn in col_clean for syn in synonyms):
                matched_categories.add(cat)
                matched_any = True
                break
                
        # 3. Fallback for DEMOGRAPHIC_CAT based on specific keywords in values
        if not matched_any and role == 'DEMOGRAPHIC_CAT':
            if 'edu' in col_clean or 'deg' in col_clean or 'stud' in col_clean:
                matched_categories.add('education')
            elif 'mar' in col_clean or 'fam' in col_clean or 'rel' in col_clean:
                matched_categories.add('household')
            else:
                matched_categories.add('education')
                
    return len(matched_categories)

def classify_dataset(df: pd.DataFrame) -> dict:
    """
    3-Layer Hybrid Dataset Type Detection Engine
    """
    if df.empty:
        return {
            'dataset_type': 'general',
            'winning_module': 'general',
            'suitability': 'Suitable for general data analysis.',
            'confidence': 0,
            'secondary_suggestion': None,
            'scores': {},
            'matched_columns': {}
        }

    # Sample for performance
    sample_size = min(100, len(df))
    sample = df.head(sample_size)
    
    # Layer 1 & 2: Infer per-column profile
    col_profiles = []
    for col in df.columns:
        role = infer_data_role(sample[col])
        col_profiles.append((col, role))
        
    # Layer 3: Aggregate dataset-level signals
    has_customer_id = any(is_concept_match(c, 'customer_id') or role == 'ENTITY_ID' for c, role in col_profiles)
    has_date = any(role == 'DATE' or is_concept_match(c, 'date') for c, role in col_profiles)
    has_spend = any(is_concept_match(c, 'money') or role == 'DEMOGRAPHIC_INCOME' for c, role in col_profiles)
    has_generic_numeric = any(role == 'NUMERIC_CONTINUOUS' for c, role in col_profiles)
    has_quantity = any(is_concept_match(c, 'quantity') or (role == 'NUMERIC_CONTINUOUS' and is_concept_match(c, 'quantity')) for c, role in col_profiles)
    has_frequency = any(is_concept_match(c, 'frequency') for c, role in col_profiles)
    has_product_ref = any(is_concept_match(c, 'product_ref') for c, role in col_profiles)
    binary_count = sum(1 for c, role in col_profiles if role == 'BINARY_TARGET')

    # Target column name matching
    churn_target_found = any(is_concept_match(col, 'churn_target') for col, role in col_profiles)
    has_forecast_target = any(is_concept_match(col, 'forecast_target') for col, role in col_profiles)

    # Specific behavior indicators for Churn to avoid matching general recency/visit dates
    behavior_indicators = ['tenure', 'returns', 'complain', 'frequency', 'attrition', 'churn']
    behavior_count = sum(1 for c, role in col_profiles if any(b in c.lower() for b in behavior_indicators))

    # Identify if a churn target exists by name or is among binary columns matching churn synonyms (Bug 2 Fix)
    binary_columns = [c for c, role in col_profiles if role == 'BINARY_TARGET']
    churn_name_matched_column_exists = any(is_concept_match(c, 'churn_target') for c in binary_columns) or churn_target_found

    # Distinct demographics counting
    distinct_demographics = count_distinct_demographics(col_profiles)

    # 1. Churn Score calculation
    churn_score = 0
    if has_customer_id: churn_score += 25
    if has_date: churn_score += 15
    if has_spend: churn_score += 10
    has_rfm = has_customer_id and has_date and has_spend
    if has_rfm: churn_score += 20
    if has_frequency: churn_score += 10
    if distinct_demographics >= 1: churn_score += 15
    if behavior_count >= 1: churn_score += 15
    if churn_target_found:
        churn_score += 25
        churn_score = max(0, min(100, churn_score))
    # Bidirectional adjustment: penalize churn if multiple binaries exist with no churn target name match
    if binary_count >= 3 and not churn_name_matched_column_exists:
        churn_score -= 30
    # Attrition fallback penalty: if no target column or specific churn behavior signals exist, it's not a strong Churn candidate
    if not churn_name_matched_column_exists and behavior_count == 0:
        churn_score -= 20

    # 2. Marketing Segmentation Score calculation
    marketing_score = 0
    if has_customer_id: marketing_score += 25
    if distinct_demographics >= 3:
        marketing_score += 35
    elif distinct_demographics == 2:
        marketing_score += 15
    elif distinct_demographics == 1:
        marketing_score += 15
    if binary_count >= 3: marketing_score += 20
    if not has_date: marketing_score += 10
    if has_spend: marketing_score += 10
    # Boost Marketing Segmentation if both income and recency (Loyalty/Segmentation variables) are present
    has_income = any(is_concept_match(c, 'money') for c, role in col_profiles)
    has_recency = any(is_concept_match(c, 'date') and ('visit' in c.lower() or 'purchase' in c.lower() or 'recency' in c.lower()) for c, role in col_profiles)
    if has_income and has_recency:
        marketing_score += 20
    # Bidirectional adjustment: boost marketing if multiple binaries exist with no churn target name match
    if binary_count >= 3 and not churn_name_matched_column_exists:
        marketing_score += 20
    # Prevent drowning out a genuine, explicitly-named churn target column
    if churn_target_found or churn_name_matched_column_exists:
        marketing_score -= 30

    # 3. Inventory Forecasting Score calculation
    inventory_score = 0
    if has_date: inventory_score += 35
    if has_product_ref: inventory_score += 30
    if has_quantity: inventory_score += 25
    if not has_customer_id: inventory_score += 10
    if has_forecast_target:
        inventory_score += 10

    # 4. Sales Trends Score calculation
    sales_score = 0
    if has_date: sales_score += 40
    if has_spend or has_generic_numeric: sales_score += 40
    if has_product_ref: sales_score += 10
    if has_customer_id: sales_score += 10
    # Specificity penalty: Sales Trends is a fallback module.
    # If customer tracking or demographic profiling is present, reduce Sales Trends score.
    if has_customer_id and distinct_demographics >= 1:
        sales_score -= 35
    elif distinct_demographics >= 2:
        sales_score -= 30

    # Capping and normalization
    churn_score = max(0, min(100, churn_score))
    marketing_score = max(0, min(100, marketing_score))
    inventory_score = max(0, min(100, inventory_score))
    sales_score = max(0, min(100, sales_score))

    scores = {
        'churn': churn_score,
        'marketing': marketing_score,
        'inventory': inventory_score,
        'sales': sales_score
    }

    # Determine winning module
    best_module = max(scores, key=scores.get)
    best_score = scores[best_module]
    
    # Minimum threshold to avoid misclassification of generic/ambiguous data
    if best_score < 45:
        best_module = 'general'
        best_score = 50  # baseline confidence

    # Find secondary suggestion (if any module scores within 20 points of the winner, but isn't the winner)
    secondary_suggestion = None
    if best_module != 'general':
        candidates = {k: v for k, v in scores.items() if k != best_module and v >= 45}
        if candidates:
            second_best = max(candidates, key=candidates.get)
            if best_score - candidates[second_best] <= 20:
                secondary_suggestion = second_best

    # Map suitability messages (with target-absence generalized defaults and multi-suitable support)
    primary_texts = {
        'churn': "Suitable for Customer Churn Prediction & Risk Analysis." if churn_target_found else "Suitable for Customer Churn Prediction (Active inference mode).",
        'inventory': "Suitable for Inventory AI Intelligence & Demand Forecasting." if has_forecast_target else "Suitable for Inventory AI Demand Forecasting (no existing forecast data needed).",
        'marketing': "Suitable for Customer Marketing Segmentation & Profiling.",
        'sales': "Suitable for Sales Performance & Revenue Trend Forecasting.",
        'general': "Suitable for general data analysis."
    }

    # Identify other highly suitable modules (score >= 70 and close to winner)
    high_scoring_others = [k for k, v in scores.items() if k != best_module and v >= 70 and abs(best_score - v) <= 20]

    if best_module != 'general' and high_scoring_others:
        other_labels = {
            'churn': "Customer Churn Prediction",
            'inventory': "Inventory AI Demand Forecasting",
            'marketing': "Customer Marketing Segmentation",
            'sales': "Sales Performance & Revenue Trend Forecasting"
        }
        primary_labels = {
            'churn': "Customer Churn Prediction",
            'inventory': "Inventory AI Demand Forecasting",
            'marketing': "Customer Marketing Segmentation",
            'sales': "Sales Performance & Revenue Trend Forecasting"
        }
        primary_label = primary_labels.get(best_module, best_module)
        secondary_label = other_labels.get(high_scoring_others[0])
        suitability = f"This dataset is well-suited for {primary_label}, and is also a strong fit for {secondary_label}."
    else:
        suitability = primary_texts.get(best_module, "Suitable for general data analysis.")

    # Map winning 'sales' module to 'general' database type
    db_type = best_module
    if best_module == 'sales':
        db_type = 'general'

    # Extract matched columns for transparency/informational purposes (Bug 1 Fix)
    customer_id_col = next((c for c, role in col_profiles if is_concept_match(c, 'customer_id') or role == 'ENTITY_ID'), None)
    date_col = next((c for c, role in col_profiles if role == 'DATE' or is_concept_match(c, 'date')), None)
    income_col = next((c for c, role in col_profiles if is_concept_match(c, 'money') or role == 'DEMOGRAPHIC_INCOME'), None)
    
    recency_col = next((c for c, role in col_profiles if is_concept_match(c, 'date') and any(keyword in c.lower() for keyword in ['visit', 'purchase', 'recency', 'last', 'tenure', 'day'])), None)
    if not recency_col and date_col:
        recency_col = date_col

    quantity_col = next((c for c, role in col_profiles if is_concept_match(c, 'quantity') or (role == 'NUMERIC_CONTINUOUS' and is_concept_match(c, 'quantity'))), None)
    product_ref_col = next((c for c, role in col_profiles if is_concept_match(c, 'product_ref')), None)
    churn_target_col = next((c for c, role in col_profiles if is_concept_match(c, 'churn_target')), None)
    forecast_target_col = next((c for c, role in col_profiles if is_concept_match(c, 'forecast_target')), None)

    matched_columns = {}
    if customer_id_col: matched_columns["customer_id"] = customer_id_col
    if date_col: matched_columns["date"] = date_col
    if income_col: matched_columns["income"] = income_col
    if recency_col: matched_columns["recency"] = recency_col
    if quantity_col: matched_columns["quantity_signal"] = quantity_col
    if product_ref_col: matched_columns["product_ref"] = product_ref_col
    if churn_target_col: matched_columns["churn_target"] = churn_target_col
    if forecast_target_col: matched_columns["forecast_target"] = forecast_target_col

    return {
        'dataset_type': db_type,
        'winning_module': best_module,
        'suitability': suitability,
        'confidence': best_score,
        'secondary_suggestion': secondary_suggestion,
        'scores': scores,
        'matched_columns': matched_columns
    }
