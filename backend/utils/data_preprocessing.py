import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder, MinMaxScaler
from sklearn.impute import SimpleImputer
import re

# ──────────────────────────────────────────────────────────────
# DYNAMIC FIELD DISCOVERY (Column Heuristics)
# ──────────────────────────────────────────────────────────────

class ColumnMatcher:
    """Guess column roles for any retail/ecommerce dataset."""
    
    PATTERNS = {
        'date':     ['date', 'time', 'timestamp', 'dt_', 'purchasedate', 'ordered_at'],
        'price':    ['price', 'cost', 'amount', 'mnt', 'spend', 'val', 'rate'],
        'stock':    ['inventory level', 'stock level', 'current stock', 'inventory count', 'on hand', 'inventory', 'stock'],
        'sales':    ['units sold', 'quantity sold', 'sold units', 'sales', 'sold', 'demand'],
        'orders':   ['units ordered', 'orders', 'ordered'],
        'forecast': ['demand forecast', 'forecast'],
        'qty_fallback': ['qty', 'quantity', 'units', 'num'],
        'age':      ['age', 'year_birth', 'dob', 'birth'],
        'income':   ['income', 'salary', 'wealth', 'earnings'],
        'product':  ['product', 'item', 'category', 'sku', 'desc'],
        'customer': ['customer', 'user', 'client', 'member', 'id_']
    }

    @staticmethod
    def match(df: pd.DataFrame, role: str) -> str | None:
        """Find the best column for a specific role."""
        patterns = ColumnMatcher.PATTERNS.get(role, [])
        cols = [c for c in df.columns]
        
        # Special logic for stock to avoid mapping 'units sold' as 'units'
        if role == 'stock':
            # 1. Exact or strong match for stock
            for col in cols:
                low = col.lower().replace('_', ' ')
                if any(p in low for p in ColumnMatcher.PATTERNS['stock']):
                    return col
            # 2. Fallback to generic qty ONLY if it doesn't contain sales/orders words
            for col in cols:
                low = col.lower().replace('_', ' ')
                if any(p in low for p in ColumnMatcher.PATTERNS['qty_fallback']):
                    if not any(bad in low for bad in ['sold', 'sale', 'order', 'forecast', 'demand']):
                        return col
            return None
            
        patterns = ColumnMatcher.PATTERNS.get(role, [])
        # Exact/Slug matches first
        for col in cols:
            low = col.lower().replace(' ', '_').replace('_', '')
            if any(p in low.replace('_', '') for p in [x.replace(' ', '') for x in patterns]):
                return col
        return None

    @staticmethod
    def match_multi(df: pd.DataFrame, role: str) -> list[str]:
        """Find all columns matching a role (e.g., multiple spend categories)."""
        patterns = ColumnMatcher.PATTERNS.get(role, [])
        return [c for c in df.columns if any(p in c.lower() for p in patterns)]


# ──────────────────────────────────────────────────────────────
# SHARED UTILITIES
# ──────────────────────────────────────────────────────────────

def _remove_outliers_iqr(df: pd.DataFrame, cols: list, factor: float = 1.5) -> pd.DataFrame:
    """Drop rows whose numeric values fall outside [Q1 - factor*IQR, Q3 + factor*IQR]."""
    for col in cols:
        if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
            q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            iqr = q3 - q1
            lower, upper = q1 - factor * iqr, q3 + factor * iqr
            before = len(df)
            df = df[(df[col] >= lower) & (df[col] <= upper)]
            removed = before - len(df)
            if removed > 0:
                print(f"  🧹 Outliers removed from '{col}': {removed} rows")
    return df


def _encode_categorical(df: pd.DataFrame, cols: list) -> pd.DataFrame:
    """Label-encode specified categorical columns."""
    le = LabelEncoder()
    for col in cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.lower()
            df[col] = le.fit_transform(df[col])
    return df


def _impute_numeric(df: pd.DataFrame, strategy: str = 'median') -> pd.DataFrame:
    """Fill missing numeric values with median (or mean)."""
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if num_cols:
        imputer = SimpleImputer(strategy=strategy)
        df[num_cols] = imputer.fit_transform(df[num_cols])
    return df


# ──────────────────────────────────────────────────────────────
# CHURN PREPROCESSOR (ecommerce_customer_data_custom_ratios.csv)
# ──────────────────────────────────────────────────────────────

class ChurnPreprocessor:
    """
    Professional preprocessing for the ecommerce churn dataset.

    Steps:
        1. Rename & normalise column names
        2. Parse dates → extract temporal features
        3. Drop irrelevant / leaky columns
        4. Impute missing numeric values (median)
        5. One-hot encode categorical columns
        6. IQR outlier removal on price/quantity
        7. StandardScaler on numeric features
    """

    # Columns we won't use for training
    DROP_COLS = [
        'Customer ID',
        'Customer Name',
        'Purchase Date',
        'actual_churn',
        'model_predicted_churn',
        'churn_prediction',
        'model_churn_probability',
        'churn_probability',
        'model_risk_level',
        'risk_level',
        'customer_ref_id',
        'row_id',
        '_source_index',
        'index',
    ]

    CATEGORICAL_COLS = ['Product Category', 'Payment Method', 'Gender']

    OUTLIER_COLS = ['Product Price', 'Quantity', 'Total Purchase Amount', 'Customer Age']

    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_columns = None
        self._fitted = False

    def preprocess(self, df: pd.DataFrame, fit: bool = True) -> pd.DataFrame:
        """
        Returns a clean DataFrame ready for ML training / inference.

        Args:
            df:   Raw pandas DataFrame from CSV.
            fit:  True during training (scaler is fitted), False for inference.
        """
        print("🔬 ChurnPreprocessor: Starting professional preprocessing...")
        df = df.copy()

        # ── 1. Dynamic Column Discovery
        match_date = ColumnMatcher.match(df, 'date')
        match_qty = ColumnMatcher.match(df, 'qty')
        match_price = ColumnMatcher.match(df, 'price')
        match_age = ColumnMatcher.match(df, 'age')

        # ── 2. Parse date → temporal features
        if match_date:
            df[match_date] = pd.to_datetime(df[match_date], errors='coerce')
            df['purchase_month']   = df[match_date].dt.month
            df['purchase_dayofweek'] = df[match_date].dt.dayofweek
            print(f"  📅 Temporal features extracted from '{match_date}'")

        # ── 3. Drop irrelevant / leaky columns
        df.drop(columns=[c for c in self.DROP_COLS if c in df.columns], inplace=True)

        # ── 4. Impute numeric missing values
        df = _impute_numeric(df)

        # ── 5. Encode categorical columns
        df = _encode_categorical(df, self.CATEGORICAL_COLS)

        # ── 6. IQR outlier removal (only during training)
        if fit:
            df = _remove_outliers_iqr(df, self.OUTLIER_COLS)

        # ── 7. Drop target temporarily for scaling
        target_col = None
        if 'Churn' in df.columns:
            target_col = df['Churn'].copy()
            df.drop(columns=['Churn'], inplace=True)

        # Keep only numeric columns at this point
        df = df.select_dtypes(include=[np.number])

        if fit:
            self.feature_columns = df.columns.tolist()
            df_scaled = self.scaler.fit_transform(df)
            self._fitted = True
        else:
            # Align columns with training
            for col in self.feature_columns:
                if col not in df.columns:
                    df[col] = 0
            df = df[self.feature_columns]
            df_scaled = self.scaler.transform(df)

        result = pd.DataFrame(df_scaled, columns=self.feature_columns)

        # ── 8. Re-attach target
        if target_col is not None:
            target_col = target_col.reset_index(drop=True).iloc[:len(result)]
            result['Churn'] = target_col.values

        print(f"  ✅ ChurnPreprocessor done: {result.shape[0]} rows × {result.shape[1]} cols")
        return result


# ──────────────────────────────────────────────────────────────
# MARKETING PREPROCESSOR (marketing_campaign.csv)
# ──────────────────────────────────────────────────────────────

class MarketingPreprocessor:
    """
    Professional preprocessing for the marketing campaign dataset.

    Steps:
        1. Parse semicolon-separated CSV (auto)
        2. Drop unused identifier columns
        3. Derive customer age from Year_Birth
        4. Derive tenure in days from Dt_Customer
        5. Engineer RFM-style total spend feature
        6. Impute Income (median strategy to avoid skew)
        7. Encode Education & Marital_Status
        8. IQR outlier removal on spend+income
        9. MinMaxScaler (values already small, MM preferred over Standard)
    """

    SPENDING_COLS = [
        'MntWines', 'MntFruits', 'MntMeatProducts',
        'MntFishProducts', 'MntSweetProducts', 'MntGoldProds'
    ]

    PURCHASE_COLS = [
        'NumDealsPurchases', 'NumWebPurchases',
        'NumCatalogPurchases', 'NumStorePurchases'
    ]

    DROP_COLS = ['ID', 'Year_Birth', 'Dt_Customer', 'Z_CostContact', 'Z_Revenue']

    CATEGORICAL_COLS = ['Education', 'Marital_Status']

    def __init__(self):
        self.scaler = MinMaxScaler()
        self.feature_columns = None
        self._fitted = False
        # Integer positions into the input frame (after reset_index) kept after IQR — for NLP TF-IDF alignment
        self.last_kept_row_positions: np.ndarray | None = None

    def preprocess(self, df: pd.DataFrame, fit: bool = True, dataset_id: str = 'unknown') -> pd.DataFrame:
        """
        Returns a clean DataFrame ready for K-Means clustering.
        """
        rows_before = len(df)
        print("🔬 MarketingPreprocessor: Starting professional preprocessing...")
        df = df.copy().reset_index(drop=True)
        self.last_kept_row_positions = None

        # ── 1. Dynamic Column Discovery
        match_income = ColumnMatcher.match(df, 'income')
        match_age = ColumnMatcher.match(df, 'age')
        match_date = ColumnMatcher.match(df, 'date')
        
        # ── 2. Feature Engineering Logic
        if match_age and 'Age' not in df.columns:
            if 'birth' in match_age.lower() or 'year' in match_age.lower():
                df['Age'] = 2024 - df[match_age].fillna(1980).astype(int)
            else:
                df['Age'] = df[match_age]
            print(f"  🎂 Derived 'Age' from '{match_age}'")

        if match_date and 'Tenure_Days' not in df.columns:
            df[match_date] = pd.to_datetime(df[match_date], errors='coerce')
            ref = pd.Timestamp('2024-01-01')
            df['Tenure_Days'] = (ref - df[match_date]).dt.days
            print(f"  📆 Derived 'Tenure_Days' from '{match_date}'")

        # Fallback for Recency
        if 'Recency' not in df.columns:
            df['Recency'] = df['Tenure_Days'] if 'Tenure_Days' in df.columns else 30

        # ── 5. Engineer RFM-style total spend from explicit customer spend categories.
        # Do not include operational constants such as Z_CostContact or Z_Revenue.
        if 'Total_Spend' not in df.columns:
            available_spend = [c for c in self.SPENDING_COLS if c in df.columns]
            if available_spend:
                df['Total_Spend'] = df[available_spend].sum(axis=1)
                print(f"  💰 Feature engineered: 'Total_Spend' ({len(available_spend)} categories)")

        available_purchases = [c for c in self.PURCHASE_COLS if c in df.columns]
        if available_purchases:
            df['Total_Purchases'] = df[available_purchases].sum(axis=1)
            print(f"  🛒 Feature engineered: 'Total_Purchases'")

        # Average spend per purchase (avoid div/0)
        if 'Total_Spend' in df.columns and 'Total_Purchases' in df.columns:
            df['Avg_Spend_Per_Purchase'] = df['Total_Spend'] / (df['Total_Purchases'] + 1)

        # ── 5. Drop irrelevant columns
        df.drop(columns=[c for c in self.DROP_COLS if c in df.columns], inplace=True)

        # ── 6. Impute Income (median — not mean, income is usually right-skewed)
        if 'Income' in df.columns:
            median_income = df['Income'].median()
            df['Income'] = df['Income'].fillna(median_income)
            print(f"  💵 Income null values filled with median: ${median_income:,.0f}")

        # ── 7. Encode categoricals
        df = _encode_categorical(df, self.CATEGORICAL_COLS)

        # ── 8. Impute remaining numeric missing values
        df = _impute_numeric(df, strategy='median')

        # ── 9. IQR outlier removal during training
        outlier_targets = ['Income', 'Total_Spend', 'Age', 'Total_Purchases']
        if fit:
            df = _remove_outliers_iqr(df, outlier_targets, factor=2.0)
        # Align optional TF-IDF rows with numeric pipeline (same index as reset df)
        self.last_kept_row_positions = df.index.to_numpy()

        # Keep only numeric columns
        df = df.select_dtypes(include=[np.number])

        if fit:
            self.feature_columns = df.columns.tolist()
            df_scaled = self.scaler.fit_transform(df)
            self._fitted = True
        else:
            for col in self.feature_columns:
                if col not in df.columns:
                    df[col] = 0
            df = df[self.feature_columns]
            df_scaled = self.scaler.transform(df)

        result = pd.DataFrame(df_scaled, columns=self.feature_columns)
        # ── 8. Log audit trail (ER Diagram)
        from database.mongodb_helper import db
        db.log_preprocessor_run(dataset_id, 'Dropping Missing', 'MinMaxScaler', rows_before, len(result))

        print(f"  ✅ MarketingPreprocessor done: {result.shape[0]} rows × {result.shape[1]} cols")
        return result


# ──────────────────────────────────────────────────────────────
# INVENTORY PREPROCESSOR (sales-style data)
# ──────────────────────────────────────────────────────────────

class InventoryPreprocessor:
    """
    Preprocessor for inventory/sales trend data.
    Aggregates daily sales by product if needed.
    """

    def __init__(self):
        self.scaler = MinMaxScaler()
        self.feature_columns = None

    def preprocess(self, df: pd.DataFrame, fit: bool = True,
                   date_col: str = 'Purchase Date',
                   qty_col: str = 'Quantity') -> pd.DataFrame:
        """
        Aggregate individual purchase rows into a daily sales time series.
        Returns a DataFrame sorted by date with a 'daily_quantity' column.
        """
        print("🔬 InventoryPreprocessor: Starting time-series preprocessing...")
        df = df.copy()
        df.columns = [c.strip() for c in df.columns]

        # Detect columns via heuristics
        match_date = ColumnMatcher.match(df, 'date')
        match_qty = ColumnMatcher.match(df, 'qty')
        
        date_col = match_date if match_date else date_col
        qty_col = match_qty if match_qty else qty_col

        if date_col and qty_col:
            # ── Safe Preprocessing (Clean & Floor in Pandas for stability)
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])
            df[date_col] = df[date_col].dt.floor('D')

            # ── Hybrid GPU Optimization (RTX 3050)
            try:
                import cudf
                df_g = cudf.from_pandas(df[[date_col, qty_col]])
                
                # GPU Aggregation (Already floored)
                daily = df_g.groupby(date_col)[qty_col].sum().to_pandas().reset_index()
                daily.columns = ['date', 'daily_quantity']
                print("  🚀 Inventory Aggregation: Hybrid GPU (cuDF) Accelerated.")
            except Exception as gpu_err:
                # CPU Fallback
                print(f"  ℹ️ GPU Aggregation skipped ({gpu_err}). Using CPU.")
                daily = df.groupby(date_col)[qty_col].sum().reset_index()
                daily.columns = ['date', 'daily_quantity']
                print("  ℹ️ Inventory Aggregation: CPU Baseline.")
            daily = daily.sort_values('date').reset_index(drop=True)

            # Rolling average (7-day smoothing for noise reduction)
            daily['rolling_7d_avg'] = daily['daily_quantity'].rolling(window=7, min_periods=1).mean()

            # Lag features for ML
            daily['lag_1'] = daily['daily_quantity'].shift(1).bfill()
            daily['lag_7'] = daily['daily_quantity'].shift(7).bfill()

            # Day of week / month as features
            daily['date'] = pd.to_datetime(daily['date'])
            daily['day_of_week']  = daily['date'].dt.dayofweek
            daily['month']        = daily['date'].dt.month
            daily['day_of_month'] = daily['date'].dt.day

            print(f"  📦 Aggregated {len(df)} rows → {len(daily)} daily time-series points")
            return daily

        # Fallback: just clean numerics
        df = _impute_numeric(df)
        df = df.select_dtypes(include=[np.number])
        print(f"  ⚠️  No date column found. Returning cleaned numeric data: {df.shape}")
        return df
