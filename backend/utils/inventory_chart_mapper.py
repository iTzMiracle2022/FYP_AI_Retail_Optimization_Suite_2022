import pandas as pd
import numpy as np

class InventoryChartMapper:
    """
    Maps the raw inventory dataset into aggregated KPIs, Charts, and Tables 
    for the advanced Inventory Analytics Dashboard.
    """

    @staticmethod
    def map_dashboard(df: pd.DataFrame, forecast_days: int) -> dict:
        # Standardize columns
        df_clean = df.copy()
        
        # Ensure dates
        date_col = next((c for c in df_clean.columns if c.lower() == 'date'), None)
        if not date_col:
            return {}
        
        df_clean[date_col] = pd.to_datetime(df_clean[date_col], errors='coerce')
        df_clean = df_clean.dropna(subset=[date_col])
        
        # Find latest date in dataset
        latest_date = df_clean[date_col].max()
        
        # Calculate selected window inclusive
        # If forecast_days = 7, and latest_date = 2024-01-01
        # Window: 2023-12-26 to 2024-01-01
        start_date = latest_date - pd.Timedelta(days=forecast_days - 1)
        
        # Filter for the selected window
        df_window = df_clean[(df_clean[date_col] >= start_date) & (df_clean[date_col] <= latest_date)]
        
        # Filter for the latest date only (for current stock)
        df_latest = df_clean[df_clean[date_col] == latest_date]
        
        # Helper to safely get sum
        def safe_sum(data, col):
            if col in data.columns:
                return float(pd.to_numeric(data[col], errors='coerce').fillna(0).sum())
            return 0.0

        # Mappings
        demand_col = next((c for c in df_clean.columns if 'demand forecast' in c.lower() or 'forecast' in c.lower()), 'Demand Forecast')
        sold_col = next((c for c in df_clean.columns if 'sold' in c.lower()), 'Units Sold')
        ordered_col = next((c for c in df_clean.columns if 'ordered' in c.lower()), 'Units Ordered')
        stock_col = next((c for c in df_clean.columns if 'inventory level' in c.lower() or 'stock' in c.lower()), 'Inventory Level')
        category_col = next((c for c in df_clean.columns if 'category' in c.lower()), 'Category')
        store_col = next((c for c in df_clean.columns if 'store' in c.lower()), 'Store ID')
        region_col = next((c for c in df_clean.columns if 'region' in c.lower()), 'Region')
        price_col = next((c for c in df_clean.columns if 'price' in c.lower() and 'comp' not in c.lower()), 'Price')
        discount_col = next((c for c in df_clean.columns if 'discount' in c.lower()), 'Discount')
        
        # 1. KPIs
        predicted_demand = safe_sum(df_window, demand_col)
        units_sold = safe_sum(df_window, sold_col)
        units_ordered = safe_sum(df_window, ordered_col)
        current_stock = safe_sum(df_latest, stock_col)

        dataset_kpis = {
            'totalUnitsSold': safe_sum(df_clean, sold_col),
            'totalUnitsOrdered': safe_sum(df_clean, ordered_col),
            'netSalesValue': 0.0
        }

        if all(col in df_clean.columns for col in [sold_col, price_col, discount_col]):
            sold = pd.to_numeric(df_clean[sold_col], errors='coerce').fillna(0)
            price = pd.to_numeric(df_clean[price_col], errors='coerce').fillna(0)
            discount = pd.to_numeric(df_clean[discount_col], errors='coerce').fillna(0)
            dataset_kpis['netSalesValue'] = float((sold * price * (1 - discount / 100)).sum())

        dataset_kpis_snake = {
            'total_units_sold': dataset_kpis['totalUnitsSold'],
            'total_units_ordered': dataset_kpis['totalUnitsOrdered'],
            'net_sales_value': dataset_kpis['netSalesValue']
        }
        
        mape = 0.0
        if sold_col in df_window.columns and demand_col in df_window.columns:
            # MAPE = mean(abs(Demand - Sold) / Sold) * 100
            valid_sold = df_window[df_window[sold_col] > 0]
            if len(valid_sold) > 0:
                errors = abs(valid_sold[demand_col] - valid_sold[sold_col]) / valid_sold[sold_col]
                mape = float(errors.mean() * 100)
                
        kpis = {
            'forecast_days': forecast_days,
            'predicted_demand': predicted_demand,
            'units_sold': units_sold,
            'units_ordered': units_ordered,
            'current_stock': current_stock,
            'forecast_error_pct': mape
        }
        
        # 2. Charts
        charts = {}
        
        # 2.1 Trend Charts
        # Demand vs Actual Trend
        if date_col in df_window.columns:
            trend_df = df_window.groupby(date_col).agg({
                demand_col: 'sum',
                sold_col: 'sum',
                stock_col: 'sum'
            }).reset_index().sort_values(date_col)
            
            trend_df[date_col] = trend_df[date_col].dt.strftime('%Y-%m-%d')
            charts['actual_vs_forecast'] = trend_df[[date_col, sold_col, demand_col]].rename(
                columns={date_col: 'date', sold_col: 'actual', demand_col: 'forecast'}
            ).to_dict(orient='records')
            
            # For inventory trend
            history_start = latest_date - pd.Timedelta(days=max(forecast_days, 30))
            inv_trend_df = df_clean[df_clean[date_col] >= history_start].groupby(date_col).agg({
                stock_col: 'sum'
            }).reset_index().sort_values(date_col)
            inv_trend_df[date_col] = inv_trend_df[date_col].dt.strftime('%Y-%m-%d')
            charts['inventory_trend'] = inv_trend_df[[date_col, stock_col]].rename(
                columns={date_col: 'date', stock_col: 'inventory'}
            ).to_dict(orient='records')

        # 2.2 Category, Store, Region
        if category_col in df_window.columns:
            cat_demand = df_window.groupby(category_col)[demand_col].sum().reset_index()
            cat_demand = cat_demand.sort_values(demand_col, ascending=False)
            charts['demand_by_category'] = cat_demand.rename(columns={category_col: 'name', demand_col: 'value'}).to_dict(orient='records')
            
            # Inventory vs Demand by Category
            cat_stock = df_latest.groupby(category_col)[stock_col].sum().reset_index()
            inv_vs_demand = pd.merge(cat_stock, cat_demand, on=category_col, how='outer').fillna(0)
            inv_vs_demand = inv_vs_demand.sort_values(demand_col, ascending=False)
            charts['inventory_vs_demand'] = inv_vs_demand.rename(
                columns={category_col: 'name', stock_col: 'stock', demand_col: 'demand'}
            ).to_dict(orient='records')
            
            # Forecast Accuracy by Category
            if sold_col in df_window.columns:
                valid_cat = df_window[df_window[sold_col] > 0].copy()
                valid_cat['mape'] = abs(valid_cat[demand_col] - valid_cat[sold_col]) / valid_cat[sold_col] * 100
                cat_mape = valid_cat.groupby(category_col)['mape'].mean().reset_index()
                charts['forecast_error_by_category'] = cat_mape.rename(columns={category_col: 'name', 'mape': 'error_pct'}).to_dict(orient='records')

        if store_col in df_window.columns:
            store_demand = df_window.groupby(store_col)[demand_col].sum().reset_index().sort_values(demand_col, ascending=False)
            charts['demand_by_store'] = store_demand.rename(columns={store_col: 'name', demand_col: 'value'}).to_dict(orient='records')
            
        if region_col in df_window.columns:
            region_demand = df_window.groupby(region_col)[demand_col].sum().reset_index().sort_values(demand_col, ascending=False)
            charts['demand_by_region'] = region_demand.rename(columns={region_col: 'name', demand_col: 'value'}).to_dict(orient='records')
            
        # 2.3 Impacts
        seasonality_col = next((c for c in df_window.columns if 'seasonality' in c.lower()), 'Seasonality')
        if seasonality_col in df_window.columns:
            season_demand = df_window.groupby(seasonality_col)[demand_col].sum().reset_index().sort_values(demand_col, ascending=False)
            charts['seasonality_impact'] = season_demand.rename(columns={seasonality_col: 'name', demand_col: 'value'}).to_dict(orient='records')
            
        weather_col = next((c for c in df_window.columns if 'weather' in c.lower()), 'Weather Condition')
        if weather_col in df_window.columns:
            weather_demand = df_window.groupby(weather_col).agg({demand_col: 'sum', sold_col: 'mean'}).reset_index().sort_values(demand_col, ascending=False)
            charts['weather_impact'] = weather_demand.rename(columns={weather_col: 'name', demand_col: 'total_demand', sold_col: 'avg_sold'}).to_dict(orient='records')

        promo_col = next((c for c in df_window.columns if 'holiday' in c.lower() or 'promotion' in c.lower()), 'Holiday/Promotion')
        if promo_col in df_window.columns:
            # Check if binary
            df_window = df_window.copy()
            df_window[promo_col] = pd.to_numeric(df_window[promo_col], errors='coerce').fillna(0)
            promo_demand = df_window.groupby(promo_col).agg({demand_col: 'mean', sold_col: 'mean'}).reset_index()
            promo_demand[promo_col] = promo_demand[promo_col].apply(lambda x: 'Promotion' if x == 1 else 'No Promotion')
            charts['promotion_impact'] = promo_demand.rename(columns={promo_col: 'name', demand_col: 'avg_demand', sold_col: 'avg_sold'}).to_dict(orient='records')

        if discount_col in df_window.columns:
            disc_demand = df_window.groupby(discount_col)[sold_col].mean().reset_index().sort_values(discount_col)
            charts['discount_impact'] = disc_demand.rename(columns={discount_col: 'discount', sold_col: 'avg_sold'}).to_dict(orient='records')

        comp_price_col = next((c for c in df_window.columns if 'competitor' in c.lower()), 'Competitor Pricing')
        if price_col in df_window.columns and comp_price_col in df_window.columns:
            gap_df = df_window.copy()
            valid_comp = gap_df[comp_price_col] > 0
            gap_df.loc[valid_comp, 'gap_pct'] = (gap_df.loc[valid_comp, price_col] - gap_df.loc[valid_comp, comp_price_col]) / gap_df.loc[valid_comp, comp_price_col]
            gap_df.loc[~valid_comp, 'gap_pct'] = 0
            
            def map_gap(pct):
                if pct < -0.02: return 'Below Competitor'
                if pct > 0.02: return 'Above Competitor'
                return 'Near Competitor'
                
            gap_df['price_bucket'] = gap_df['gap_pct'].apply(map_gap)
            gap_impact = gap_df.groupby('price_bucket').agg({sold_col: 'mean', demand_col: 'mean'}).reset_index()
            
            order = ['Below Competitor', 'Near Competitor', 'Above Competitor']
            gap_impact['price_bucket'] = pd.Categorical(gap_impact['price_bucket'], categories=order, ordered=True)
            gap_impact = gap_impact.sort_values('price_bucket')
            charts['price_gap_impact'] = gap_impact.rename(columns={'price_bucket': 'name', sold_col: 'avg_sold', demand_col: 'avg_demand'}).to_dict(orient='records')

        # 3. Tables (Inventory Detail)
        df_detail = df_window.copy()
        df_detail[date_col] = df_detail[date_col].dt.strftime('%Y-%m-%d')
        # Limiting to 5000 rows to prevent massive payload, though 1000 is safer. We will use 2000.
        table_records = df_detail.tail(2000).fillna('').to_dict(orient='records')

        # 3.5 Coverage Detail
        coverage_detail = []
        if category_col in df_window.columns and store_col in df_window.columns and region_col in df_window.columns:
            w_grp = df_window.groupby([category_col, store_col, region_col])[demand_col].sum().reset_index()
            l_grp = df_latest.groupby([category_col, store_col, region_col])[stock_col].sum().reset_index()
            c_df = pd.merge(w_grp, l_grp, on=[category_col, store_col, region_col], how='outer').fillna(0)
            coverage_detail = c_df.rename(columns={category_col: 'category', store_col: 'store', region_col: 'region', demand_col: 'demand', stock_col: 'stock'}).to_dict(orient='records')

        # 4. Historical Analytics — full dataset aggregates for Section 3 charts
        # Uses df_clean (entire dataset) NOT df_window (forecast period only)
        hist_oldest = df_clean[date_col].min()
        hist_latest = df_clean[date_col].max()
        hist_days = (hist_latest - hist_oldest).days + 1

        # Ensure numeric columns
        for col in [demand_col, sold_col, ordered_col, stock_col]:
            if col in df_clean.columns:
                df_clean[col] = pd.to_numeric(df_clean[col], errors='coerce').fillna(0)

        # 4.1 Daily Trend (one row per date — totals)
        daily_trend = df_clean.groupby(date_col).agg({
            sold_col: 'sum',
            stock_col: 'sum',
            ordered_col: 'sum',
            demand_col: 'sum'
        }).reset_index().sort_values(date_col)
        daily_trend[date_col] = daily_trend[date_col].dt.strftime('%Y-%m-%d')
        hist_daily_trend = daily_trend.rename(columns={
            date_col: 'date', sold_col: 'sold', stock_col: 'stock',
            ordered_col: 'ordered', demand_col: 'demand'
        }).round(2).to_dict(orient='records')

        # 4.2 Daily by Category
        hist_by_cat = []
        if category_col in df_clean.columns:
            cat_daily = df_clean.groupby([date_col, category_col]).agg({
                demand_col: 'sum', sold_col: 'sum', ordered_col: 'sum', stock_col: 'sum'
            }).reset_index()
            cat_daily[date_col] = cat_daily[date_col].dt.strftime('%Y-%m-%d')
            hist_by_cat = cat_daily.rename(columns={
                date_col: 'date', category_col: 'category',
                demand_col: 'demand', sold_col: 'sold',
                ordered_col: 'ordered', stock_col: 'stock'
            }).round(2).to_dict(orient='records')

        # 4.3 Daily by Store
        hist_by_store = []
        if store_col in df_clean.columns:
            store_daily = df_clean.groupby([date_col, store_col]).agg({
                demand_col: 'sum', sold_col: 'sum', ordered_col: 'sum'
            }).reset_index()
            store_daily[date_col] = store_daily[date_col].dt.strftime('%Y-%m-%d')
            hist_by_store = store_daily.rename(columns={
                date_col: 'date', store_col: 'store',
                demand_col: 'demand', sold_col: 'sold', ordered_col: 'ordered'
            }).round(2).to_dict(orient='records')

        # 4.4 Daily by Region
        hist_by_region = []
        if region_col in df_clean.columns:
            region_daily = df_clean.groupby([date_col, region_col]).agg({
                demand_col: 'sum', sold_col: 'sum', ordered_col: 'sum'
            }).reset_index()
            region_daily[date_col] = region_daily[date_col].dt.strftime('%Y-%m-%d')
            hist_by_region = region_daily.rename(columns={
                date_col: 'date', region_col: 'region',
                demand_col: 'demand', sold_col: 'sold', ordered_col: 'ordered'
            }).round(2).to_dict(orient='records')

        # 4.5 Daily by Season
        hist_by_season = []
        if seasonality_col in df_clean.columns:
            season_daily = df_clean.groupby([date_col, seasonality_col]).agg({
                demand_col: 'sum', sold_col: 'sum'
            }).reset_index()
            season_daily[date_col] = season_daily[date_col].dt.strftime('%Y-%m-%d')
            hist_by_season = season_daily.rename(columns={
                date_col: 'date', seasonality_col: 'season',
                demand_col: 'demand', sold_col: 'sold'
            }).round(2).to_dict(orient='records')

        # 4.6 Daily by Weather
        hist_by_weather = []
        if weather_col in df_clean.columns:
            weather_daily = df_clean.groupby([date_col, weather_col]).agg({
                demand_col: 'sum', sold_col: 'sum'
            }).reset_index()
            weather_daily[date_col] = weather_daily[date_col].dt.strftime('%Y-%m-%d')
            hist_by_weather = weather_daily.rename(columns={
                date_col: 'date', weather_col: 'weather',
                demand_col: 'demand', sold_col: 'sold'
            }).round(2).to_dict(orient='records')

        # 4.7 Daily by Price Gap Bucket
        hist_by_price_gap = []
        if price_col in df_clean.columns and comp_price_col in df_clean.columns:
            pg_df = df_clean.copy()
            valid_comp = pg_df[comp_price_col] > 0
            pg_df.loc[valid_comp, 'gap_pct'] = (pg_df.loc[valid_comp, price_col] - pg_df.loc[valid_comp, comp_price_col]) / pg_df.loc[valid_comp, comp_price_col]
            pg_df.loc[~valid_comp, 'gap_pct'] = 0
            pg_df['price_bucket'] = pg_df['gap_pct'].apply(map_gap)
            pg_daily_base = pg_df.groupby([date_col, 'price_bucket']).agg({
                demand_col: 'sum', sold_col: 'sum'
            }).reset_index()
            pg_daily_gap = pg_df.groupby([date_col, 'price_bucket'])['gap_pct'].agg(gapSum='sum', gapCount='count').reset_index()
            pg_daily = pd.merge(pg_daily_base, pg_daily_gap, on=[date_col, 'price_bucket'])
            pg_daily['avgGapPct'] = pg_daily['gapSum'] / pg_daily['gapCount']
            pg_daily[date_col] = pg_daily[date_col].dt.strftime('%Y-%m-%d')
            hist_by_price_gap = pg_daily.rename(columns={
                date_col: 'date', 'price_bucket': 'bucket',
                demand_col: 'demand', sold_col: 'sold'
            }).round(4).to_dict(orient='records')

        # 4.8 Daily by Promotion
        hist_by_promo = []
        if promo_col in df_clean.columns:
            promo_df = df_clean.copy()
            promo_df[promo_col] = pd.to_numeric(promo_df[promo_col], errors='coerce').fillna(0)
            promo_df['promo_label'] = promo_df[promo_col].apply(lambda x: 'Promotion' if x == 1 else 'No Promotion')
            promo_daily = promo_df.groupby([date_col, 'promo_label']).agg({
                demand_col: 'sum', sold_col: 'sum', ordered_col: 'sum'
            }).reset_index()
            promo_daily[date_col] = promo_daily[date_col].dt.strftime('%Y-%m-%d')
            hist_by_promo = promo_daily.rename(columns={
                date_col: 'date', 'promo_label': 'promo',
                demand_col: 'demand', sold_col: 'sold', ordered_col: 'ordered'
            }).round(2).to_dict(orient='records')

        # Dataset metadata
        unique_categories = sorted(df_clean[category_col].dropna().unique().tolist()) if category_col in df_clean.columns else []
        unique_regions = sorted(df_clean[region_col].dropna().unique().tolist()) if region_col in df_clean.columns else []
        unique_stores = sorted(df_clean[store_col].dropna().astype(str).unique().tolist()) if store_col in df_clean.columns else []

        historical_analytics = {
            'coverage': {
                'oldestDate': hist_oldest.strftime('%Y-%m-%d'),
                'latestDate': hist_latest.strftime('%Y-%m-%d'),
                'availableDays': int(hist_days)
            },
            'datasetMeta': {
                'categories': unique_categories,
                'regions': unique_regions,
                'stores': unique_stores
            },
            'dailyTrend': hist_daily_trend,
            'dailyByCategory': hist_by_cat,
            'dailyByStore': hist_by_store,
            'dailyByRegion': hist_by_region,
            'dailyBySeason': hist_by_season,
            'dailyByWeather': hist_by_weather,
            'dailyByPriceGap': hist_by_price_gap,
            'dailyByPromo': hist_by_promo
        }

        return {
            'kpis': kpis,
            'charts': charts,
            'tables': {
                'inventory_detail': table_records
            },
            'datasetKpis': dataset_kpis,
            'dataset_kpis': dataset_kpis_snake,
            'metadata': {
                'latest_date': latest_date.strftime('%Y-%m-%d'),
                'window_start': start_date.strftime('%Y-%m-%d'),
                'window_end': latest_date.strftime('%Y-%m-%d'),
                'total_rows_in_window': len(df_window)
            },
            'historicalAnalytics': historical_analytics,
            'coverageDetail': coverage_detail
        }
