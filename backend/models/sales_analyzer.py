import pandas as pd
import numpy as np
from datetime import datetime
import json
from utils.data_preprocessing import _remove_outliers_iqr

class SalesAnalyzer:
    def __init__(self):
        self.is_trained = False
        self._results = {}

    def analyze(self, df: pd.DataFrame, category_filter: str = None, time_period: str = 'all') -> dict:
        print("🧠 SalesAnalyzer: Analyzing sales trends...")
        df = df.copy()
        cols = [c.strip().lstrip('\ufeff') for c in df.columns]
        df.columns = cols

        date_pattern = ['purchase date', 'order date', 'transaction date', 'invoice date', 'sale date', 'created at', 'date', 'timestamp', 'time', 'period']
        date_col = next((c for p in date_pattern for c in cols if p in c.lower() and c.lower() != 'dt_customer'), None)
        if not date_col:
            date_col = next((c for c in cols if 'dt_customer' in c.lower()), None)
            
        rev_pattern = ['total purchase amount', 'revenue', 'sales amount', 'total amount', 'order value', 'net sales', 'amount', 'sales']
        rev_col = next((c for c in cols if any(p == c.lower() for p in rev_pattern)), None)
        
        qty_pattern = ['quantity', 'qty', 'units', 'items sold', 'order quantity', 'units sold', 'num_purchases', 'purchases']
        qty_col = next((c for c in cols if any(p in c.lower() for p in qty_pattern)), None)

        price_pattern = ['price', 'product price', 'unit price']
        price_col = next((c for c in cols if any(p == c.lower() for p in price_pattern)), None)

        derived_revenue = False
        if not rev_col and price_col and qty_col:
            df['Derived_Revenue'] = pd.to_numeric(df[price_col], errors='coerce').fillna(0) * pd.to_numeric(df[qty_col], errors='coerce').fillna(0)
            rev_col = 'Derived_Revenue'
            derived_revenue = True

        cat_pattern = ['product category', 'category', 'department', 'segment', 'group', 'type']
        cat_col = next((c for c in cols if any(p in c.lower() for p in cat_pattern)), None)
        
        prod_pattern = ['product name', 'product id', 'sku', 'item name', 'item id']
        prod_col = next((c for c in cols if any(p in c.lower() for p in prod_pattern)), None)

        cust_pattern = ['customer name', 'client name']
        cust_col = next((c for c in cols if any(p in c.lower() for p in cust_pattern)), None)
        if not cust_col:
            for c in cols:
                if 'customer' in c.lower() and 'name' in c.lower():
                    cust_col = c
                    break

        pay_pattern = ['payment method', 'payment type', 'payment', 'method']
        pay_col = next((c for c in cols if any(p == c.lower() for p in pay_pattern)), None)

        return_pattern = ['returns', 'is_returned', 'returned', 'return status']
        return_col = next((c for c in cols if any(p == c.lower() for p in return_pattern)), None)

        missing_req = []
        if not date_col: missing_req.append("Date / Purchase Date / Order Date")
        if not rev_col: missing_req.append("Revenue / Total Amount / Sales Amount")

        if missing_req:
            error_data = {
                "message": "This dataset cannot run Sales Trend Analysis because required sales columns are missing.",
                "required_columns": ["Date column", "Revenue column"],
                "detected_matching_columns": {
                    "Date": date_col or "not found",
                    "Revenue": rev_col if not derived_revenue else "Derived from Price * Quantity",
                },
                "missing_columns": missing_req,
                "actual_dataset_columns": df.columns.tolist(),
                "suggested_action": "Please select a transaction/sales dataset that includes purchase/order date and sales amount columns."
            }
            raise ValueError(json.dumps(error_data))

        min_date_val = None
        max_date_val = None
        selected_start_date = None
        selected_end_date = None

        if date_col:
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col])
            min_date_val = df[date_col].min()
            max_date_val = df[date_col].max()
            
            if time_period and str(time_period).lower() != 'all':
                days_map = {'7d': 7, '14d': 14, '30d': 30, '90d': 90, '180d': 180, '365d': 365}
                days = days_map.get(str(time_period).lower(), None)
                if days:
                    cutoff = max_date_val - pd.Timedelta(days=days-1)
                    df = df[df[date_col] >= cutoff]
            
            selected_start_date = df[date_col].min()
            selected_end_date = df[date_col].max()

        if cat_col and category_filter and str(category_filter).lower() != 'all':
            df = df[df[cat_col].astype(str).str.lower() == str(category_filter).lower()]

        df['_transaction_count'] = 1

        if return_col:
            def norm_return(val):
                if pd.isna(val) or str(val).strip() == '': return np.nan
                s = str(val).lower().strip()
                if s in ['1', '1.0', 'true', 'yes', 'y', 'returned', 'return']: return 1
                if s in ['0', '0.0', 'false', 'no', 'n', 'not returned', 'no return']: return 0
                return np.nan
            df['_is_returned'] = df[return_col].apply(norm_return)
            df['_is_known_return'] = df['_is_returned'].notna().astype(int)
            df['_is_returned_val'] = df['_is_returned'].fillna(0).astype(int)

        charts = {}
        df['_date_str'] = df[date_col].dt.date.astype(str)
        df['_week_str'] = df[date_col].dt.to_period('W').dt.start_time.dt.date.astype(str)
        df['_month_str'] = df[date_col].dt.to_period('M').dt.start_time.dt.date.astype(str)
        
        combos = [
            ('all', 'daily', '_date_str'), 
            ('all', 'weekly', '_week_str'), 
            ('all', 'monthly', '_month_str'),
            ('7d', 'daily', '_date_str'),
            ('14d', 'daily', '_date_str'),
            ('30d', 'daily', '_date_str'),
            ('90d', 'daily', '_date_str'),
            ('90d', 'weekly', '_week_str')
        ]
        
        for range_str, freq, col_name in combos:
            if range_str == 'all':
                subset_df = df
                r_start = selected_start_date
            else:
                days = {'7d': 7, '14d': 14, '30d': 30, '90d': 90}.get(range_str, 30)
                cutoff = selected_end_date.normalize() - pd.Timedelta(days=days-1)
                subset_df = df[df[date_col].dt.normalize() >= cutoff]
                r_start = subset_df[date_col].min() if not subset_df.empty else selected_start_date
                
            agg_df = subset_df.groupby(col_name).agg(
                revenue=(rev_col, 'sum'), 
                transactions=('_transaction_count', 'sum'),
                start_date=(date_col, 'min'),
                end_date=(date_col, 'max')
            ).reset_index().rename(columns={col_name: 'date'})
            
            if not agg_df.empty:
                agg_df['date'] = pd.to_datetime(agg_df['date'])
                min_dt = r_start.normalize()
                max_dt = selected_end_date.normalize()
                
                if freq == 'daily':
                    all_dt = pd.date_range(start=min_dt, end=max_dt, freq='D')
                elif freq == 'weekly':
                    all_dt = pd.date_range(start=min_dt - pd.to_timedelta(min_dt.dayofweek, unit='d'), end=max_dt, freq='W-MON')
                else:
                    all_dt = pd.date_range(start=min_dt.replace(day=1), end=max_dt, freq='MS')
                
                pad_df = pd.DataFrame({'date': all_dt})
                agg_df = pd.merge(pad_df, agg_df, on='date', how='left').fillna({'revenue': 0, 'transactions': 0})
                
                # Format dates for label
                agg_df['start_str'] = agg_df['start_date'].dt.strftime('%b %-d').fillna(agg_df['date'].dt.strftime('%b %-d'))
                if freq == 'weekly':
                    agg_df['end_str'] = agg_df['end_date'].dt.strftime('%b %-d').fillna((agg_df['date'] + pd.Timedelta(days=6)).dt.strftime('%b %-d'))
                elif freq == 'monthly':
                    agg_df['end_str'] = agg_df['end_date'].dt.strftime('%b %-d').fillna((agg_df['date'] + pd.offsets.MonthEnd(0)).dt.strftime('%b %-d'))
                else:
                    agg_df['end_str'] = agg_df['start_str']
                    
                agg_df['label'] = agg_df.apply(lambda row: row['start_str'] if row['start_str'] == row['end_str'] else f"{row['start_str']} - {row['end_str']}", axis=1)
                
                agg_df['date'] = agg_df['date'].dt.date.astype(str)
                agg_df['revenue'] = agg_df['revenue'].round(2)
                
                rev_df = agg_df[['date', 'label', 'revenue']].copy()
                rev_df['prev_value'] = rev_df['revenue'].shift(1)
                rev_df['delta'] = rev_df['revenue'] - rev_df['prev_value']
                rev_df['delta_pct'] = (rev_df['delta'] / rev_df['prev_value'].replace({0: np.nan}) * 100).round(1)
                rev_df = rev_df.replace({np.nan: None})

                tx_df = agg_df[['date', 'label', 'transactions']].copy()
                tx_df['prev_value'] = tx_df['transactions'].shift(1)
                tx_df['delta'] = tx_df['transactions'] - tx_df['prev_value']
                tx_df['delta_pct'] = (tx_df['delta'] / tx_df['prev_value'].replace({0: np.nan}) * 100).round(1)
                tx_df = tx_df.replace({np.nan: None})
                
            prefix = "" if range_str == 'all' else f"{range_str}_"
            charts[f'{prefix}{freq}_revenue_trend'] = rev_df.to_dict('records') if not agg_df.empty else []
            charts[f'{prefix}{freq}_transactions_trend'] = tx_df.to_dict('records') if not agg_df.empty else []
            
        charts['revenue_trend'] = charts['daily_revenue_trend']
        charts['transactions_trend'] = charts['daily_transactions_trend']
        
        df['_day_of_week'] = df[date_col].dt.day_name()
        df['_month_name'] = df[date_col].dt.month_name()
        
        dow_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        
        # --- WEEKDAY PRECOMPUTE LOGIC ---
        weekday_max_date = df[date_col].max()
        weekday_start_dates = {
            '1m': weekday_max_date - pd.DateOffset(months=1),
            '3m': weekday_max_date - pd.DateOffset(months=3),
            '6m': weekday_max_date - pd.DateOffset(months=6),
            '12m': weekday_max_date - pd.DateOffset(months=12),
            'all': df[date_col].min()
        }
        labels = {
            '1m': 'Last 1 Month',
            '3m': 'Last 3 Months',
            '6m': 'Last 6 Months',
            '12m': 'Last 12 Months',
            'all': 'All Time'
        }
        
        charts['revenue_by_weekday_ranges'] = {}
        
        for rng in ['1m', '3m', '6m', '12m', 'all']:
            w_start = weekday_start_dates[rng]
            l_text = labels[rng]
            
            w_df = df[(df[date_col] >= w_start) & (df[date_col] <= weekday_max_date)]
            dow_df = w_df.groupby('_day_of_week').agg({rev_col: 'sum', '_transaction_count': 'sum'}).reset_index()
            dow_df['_day_of_week'] = pd.Categorical(dow_df['_day_of_week'], categories=dow_order, ordered=True)
            dow_df = dow_df.groupby('_day_of_week', observed=False).sum().reset_index()
            dow_df = dow_df.sort_values('_day_of_week')
            
            str_start = w_start.strftime('%Y-%m-%d')
            str_end = weekday_max_date.strftime('%Y-%m-%d')
            
            charts['revenue_by_weekday_ranges'][rng] = {
                'label': l_text,
                'start_date': str_start,
                'end_date': str_end,
                'data': [{
                    'name': row['_day_of_week'], 
                    'revenue': float(row[rev_col]),
                    'transactions': int(row['_transaction_count']),
                    'aov': float(row[rev_col] / row['_transaction_count']) if row['_transaction_count'] > 0 else 0,
                    'range': l_text,
                    'date_window': f"{str_start} to {str_end}",
                    'context': f"All {row['_day_of_week']}s in selected range"
                } for _, row in dow_df.iterrows()]
            }

        # --- MONTHLY SEASONALITY PRECOMPUTE LOGIC ---
        month_order = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
        
        def pluralize_month(m):
            if m in ['January', 'February']: return m[:-1] + 'ies'
            if m == 'May': return 'Mays'
            if m == 'July': return 'Julys'
            return m + 's'

        min_date = df[date_col].min()
        max_date = df[date_col].max()
        
        min_month_start = min_date.normalize().replace(day=1)
        max_month_start = max_date.normalize().replace(day=1)
        
        total_months = (max_month_start.year - min_month_start.year) * 12 + (max_month_start.month - min_month_start.month) + 1
        import math
        complete_year_count = math.floor(total_months / 12)
        
        seasonality_ranges = {}
        seasonality_options = []
        
        # Add year options if any
        for n in range(1, complete_year_count + 1):
            months_to_include = n * 12
            start_month = max_month_start - pd.DateOffset(months=(months_to_include - 1))
            start_date = start_month
            if start_date >= min_date.replace(day=1):
                key = f"{n}y"
                label = f"Last {n} Year{'s' if n > 1 else ''}"
                seasonality_options.append({"value": key, "label": label})
                
                s_df = df[(df[date_col] >= start_date) & (df[date_col] <= max_date)].copy()
                s_df['_year'] = s_df[date_col].dt.year
                
                mo_df = s_df.groupby('_month_name', observed=False).agg({
                    rev_col: 'sum',
                    '_transaction_count': 'sum',
                    '_year': lambda x: sorted(list(set(x.dropna())))
                })
                mo_df = mo_df.reindex(month_order)
                mo_df[rev_col] = mo_df[rev_col].fillna(0)
                mo_df['_transaction_count'] = mo_df['_transaction_count'].fillna(0)
                mo_df = mo_df.reset_index()
                
                mo_df['_year'] = mo_df['_year'].apply(lambda y: y if isinstance(y, list) else [])
                mo_df['month_occurrences'] = mo_df['_year'].apply(len)
                
                str_start = start_date.strftime('%Y-%m-%d')
                str_end = max_date.strftime('%Y-%m-%d')
                
                seasonality_ranges[key] = {
                    'label': label,
                    'start_date': str_start,
                    'end_date': str_end,
                    'data': [{
                        'name': row['_month_name'], 
                        'revenue': float(row[rev_col]),
                        'transactions': int(row['_transaction_count']),
                        'aov': float(row[rev_col] / row['_transaction_count']) if row['_transaction_count'] > 0 else 0,
                        'range': label,
                        'date_window': f"{str_start} to {str_end}",
                        'month_occurrences': f"{row['month_occurrences']} {pluralize_month(row['_month_name']) if row['month_occurrences'] != 1 else row['_month_name']}",
                        'years_included': ', '.join(map(str, row['_year'])),
                        'context': f"{'Combined ' if n > 1 else ''}{row['_month_name']} revenue from selected calendar-month window"
                    } for _, row in mo_df.iterrows()]
                }

        # Add All Years
        all_key = "all"
        all_label = "All Years"
        seasonality_options.append({"value": all_key, "label": all_label})
        
        all_df = df.copy()
        all_df['_year'] = all_df[date_col].dt.year
        mo_df_all = all_df.groupby('_month_name', observed=False).agg({
            rev_col: 'sum',
            '_transaction_count': 'sum',
            '_year': lambda x: sorted(list(set(x.dropna())))
        })
        mo_df_all = mo_df_all.reindex(month_order)
        mo_df_all[rev_col] = mo_df_all[rev_col].fillna(0)
        mo_df_all['_transaction_count'] = mo_df_all['_transaction_count'].fillna(0)
        mo_df_all = mo_df_all.reset_index()
        
        mo_df_all['_year'] = mo_df_all['_year'].apply(lambda y: y if isinstance(y, list) else [])
        mo_df_all['month_occurrences'] = mo_df_all['_year'].apply(len)
        
        str_start_all = min_date.strftime('%Y-%m-%d')
        str_end_all = max_date.strftime('%Y-%m-%d')
        
        seasonality_ranges[all_key] = {
            'label': all_label,
            'start_date': str_start_all,
            'end_date': str_end_all,
            'data': [{
                'name': row['_month_name'], 
                'revenue': float(row[rev_col]),
                'transactions': int(row['_transaction_count']),
                'aov': float(row[rev_col] / row['_transaction_count']) if row['_transaction_count'] > 0 else 0,
                'range': all_label,
                'date_window': f"{str_start_all} to {str_end_all}",
                'month_occurrences': f"all available {pluralize_month(row['_month_name'])}",
                'years_included': ', '.join(map(str, row['_year'])),
                'context': f"Combined {row['_month_name']} revenue across all available years"
            } for _, row in mo_df_all.iterrows()]
        }
        
        charts['monthly_revenue_seasonality_ranges'] = seasonality_ranges
        charts['monthly_revenue_seasonality_options'] = seasonality_options
        charts['monthly_revenue'] = seasonality_ranges[all_key]['data']  # Preserve legacy key

        charts['revenue_by_category'] = []
        charts['units_by_category'] = []
        charts['aov_by_category'] = []
        charts['returns_by_category'] = []
        top_category_name = None

        if cat_col:
            cat_agg = {rev_col: 'sum', '_transaction_count': 'sum'}
            if qty_col: cat_agg[qty_col] = 'sum'
            if return_col: 
                cat_agg['_is_returned_val'] = 'sum'
                cat_agg['_is_known_return'] = 'sum'
            
            cat_df = df.groupby(cat_col).agg(cat_agg).reset_index()
            cat_df['aov'] = (cat_df[rev_col] / cat_df['_transaction_count']).round(2)
            if return_col:
                cat_df['return_rate'] = ((cat_df['_is_returned_val'] / cat_df['_is_known_return']) * 100).fillna(0).round(1)

            cat_df = cat_df.sort_values(rev_col, ascending=False)
            if not cat_df.empty:
                top_category_name = cat_df.iloc[0][cat_col]

            for _, row in cat_df.iterrows():
                cat_name = row[cat_col]
                charts['revenue_by_category'].append({'name': cat_name, 'revenue': round(row[rev_col], 2)})
                if qty_col:
                    charts['units_by_category'].append({'name': cat_name, 'units': row[qty_col]})
                charts['aov_by_category'].append({
                    'name': cat_name, 
                    'aov': row['aov'],
                    'revenue': round(row[rev_col], 2),
                    'transactions': row['_transaction_count']
                })
                if return_col:
                    charts['returns_by_category'].append({
                        'name': cat_name, 
                        'return_rate': row['return_rate'], 
                        'returned_orders': row['_is_returned_val'],
                        'total_orders': row['_is_known_return'],
                        'unknown_returns': row['_transaction_count'] - row['_is_known_return']
                    })

        charts['payment_method_breakdown'] = []
        if pay_col:
            pay_df = df.groupby(pay_col).agg({rev_col: 'sum', '_transaction_count': 'sum'}).reset_index()
            pay_df = pay_df.sort_values(rev_col, ascending=False)
            charts['payment_method_breakdown'] = [{'name': row[pay_col], 'revenue': round(row[rev_col], 2), 'transactions': row['_transaction_count']} for _, row in pay_df.iterrows()]

        charts['price_band_revenue'] = []
        if price_col:
            pdf = df[pd.to_numeric(df[price_col], errors='coerce') > 0].copy()
            if not pdf.empty:
                pdf[price_col] = pd.to_numeric(pdf[price_col])
                try:
                    bins = [0, 100, 200, 300, 400, 500]
                    labels = ['$0-100', '$100-200', '$200-300', '$300-400', '$400-500']
                    pdf['price_band'] = pd.cut(pdf[price_col], bins=bins, labels=labels, include_lowest=True)
                    
                    band_agg = {rev_col: 'sum', '_transaction_count': 'sum', price_col: 'mean'}
                    if qty_col: band_agg[qty_col] = 'sum'
                    
                    band_df = pdf.groupby('price_band', observed=False).agg(band_agg).reset_index()
                    total_rev = band_df[rev_col].sum()
                    
                    group_col = prod_col if prod_col else cat_col
                    group_label = "Top Products" if prod_col else "Top Categories"
                    top_items_by_band = {}
                    
                    if group_col:
                        item_df = pdf.groupby(['price_band', group_col], observed=False)[rev_col].sum().reset_index()
                        for bnd in labels:
                            b_df = item_df[item_df['price_band'] == bnd].sort_values(rev_col, ascending=False).head(5)
                            top_items_by_band[bnd] = [{'name': str(r[group_col]), 'revenue': round(r[rev_col], 2)} for _, r in b_df.iterrows() if r[rev_col] > 0]
                    
                    for i, row in band_df.iterrows():
                        if row['_transaction_count'] > 0:
                            bnd_name = row['price_band']
                            charts['price_band_revenue'].append({
                                'name': bnd_name,
                                'revenue': round(row[rev_col], 2),
                                'transactions': int(row['_transaction_count']),
                                'units': int(row[qty_col]) if qty_col else None,
                                'revenue_share': round((row[rev_col] / total_rev) * 100, 1) if total_rev > 0 else 0,
                                'aov': round(row[rev_col] / row['_transaction_count'], 2),
                                'avg_price': round(row[price_col], 2),
                                'price_range': bnd_name,
                                'top_items_label': group_label if group_col else None,
                                'top_items': top_items_by_band.get(bnd_name, [])
                            })
                except Exception as e:
                    print("Could not create price bands:", e)

        tables = {'top_categories': [], 'top_customers': []}
        if cat_col:
            tcat = df.groupby(cat_col).agg({rev_col: 'sum', '_transaction_count': 'sum'}).reset_index()
            if qty_col:
                tcat_qty = df.groupby(cat_col)[qty_col].sum().reset_index()
                tcat = pd.merge(tcat, tcat_qty, on=cat_col)
            tcat = tcat.nlargest(10, rev_col)
            for _, row in tcat.iterrows():
                tables['top_categories'].append({
                    'name': row[cat_col],
                    'revenue': round(row[rev_col], 2),
                    'transactions': row['_transaction_count'],
                    'units': row[qty_col] if qty_col else None,
                    'aov': round(row[rev_col]/row['_transaction_count'], 2)
                })

        if cust_col:
            tcust = df.groupby(cust_col).agg({rev_col: 'sum', '_transaction_count': 'sum'}).reset_index()
            if qty_col:
                tcust_qty = df.groupby(cust_col)[qty_col].sum().reset_index()
                tcust = pd.merge(tcust, tcust_qty, on=cust_col)
            tcust = tcust.nlargest(10, rev_col)
            for _, row in tcust.iterrows():
                tables['top_customers'].append({
                    'name': row[cust_col],
                    'revenue': round(row[rev_col], 2),
                    'transactions': row['_transaction_count'],
                    'units': row[qty_col] if qty_col else None,
                    'aov': round(row[rev_col]/row['_transaction_count'], 2)
                })

        total_tx = len(df)
        total_rev = round(float(df[rev_col].sum()), 2)
        total_ret = int(df['_is_returned_val'].sum()) if return_col else 0
        known_ret = int(df['_is_known_return'].sum()) if return_col else 0
        
        kpis = {
            'total_transactions': total_tx,
            'total_revenue': total_rev,
            'avg_order_value': round(total_rev / total_tx, 2) if total_tx > 0 else 0,
            'units_sold': int(df[qty_col].sum()) if qty_col else None,
            'unique_categories': int(df[cat_col].nunique()) if cat_col else 0,
            'unique_customers': int(df[cust_col].nunique()) if cust_col else None,
            'return_rate': round((total_ret / known_ret) * 100, 1) if return_col and known_ret > 0 else None,
            'top_category': top_category_name
        }

        metadata = {
            'min_date': min_date_val.strftime('%Y-%m-%d') if not pd.isna(min_date_val) else None,
            'max_date': max_date_val.strftime('%Y-%m-%d') if not pd.isna(max_date_val) else None,
            'selected_start_date': selected_start_date.strftime('%Y-%m-%d') if not pd.isna(selected_start_date) else None,
            'selected_end_date': selected_end_date.strftime('%Y-%m-%d') if not pd.isna(selected_end_date) else None,
            'trend_range': time_period,
            'mapped_columns': {
                'Date': date_col,
                'Revenue': rev_col,
                'Quantity': qty_col,
                'Category': cat_col,
                'Product': prod_col,
                'Customer': cust_col,
                'Payment': pay_col,
                'Returns': return_col,
                'Price': price_col
            },
            'filters_applied': {
                'time_period': time_period,
                'category_filter': category_filter or 'all'
            }
        }

        self.is_trained = True
        self._results = {
            'kpis': kpis,
            'charts': charts,
            'tables': tables,
            'metadata': metadata
        }

        print(f"  ✅ Sales analysis complete | {total_tx} transactions")
        return self._results
