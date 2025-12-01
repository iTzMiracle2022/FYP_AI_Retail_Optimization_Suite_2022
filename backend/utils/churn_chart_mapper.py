import pandas as pd
import numpy as np

def generate_chart_data(merged_df, customer_summary_df):
    chart_data = {
        'risk_distribution': [],
        'churn_drivers': [],
        'at_risk_customers_trend': {
            'last_30_days': [],
            'last_90_days': [],
            'last_6_months': [],
            'last_12_months': [],
            'all_time': []
        },
        'churn_risk_trend': {
            'last_30_days': [],
            'last_90_days': [],
            'last_6_months': [],
            'last_12_months': [],
            'all_time': []
        },
        'risk_by_category': [],
        'revenue_at_risk_by_category': [],
        'risk_by_payment_method': [],
        'return_behavior_by_risk_segment': [],
        'customer_recency_buckets': [],
        'orders_aov_by_risk_segment': [],
        'churn_activity_by_weekday': [],
        'monthly_churn_seasonality': [],
        'price_sensitivity': []
    }
    
    if customer_summary_df.empty or merged_df.empty:
        return chart_data
        
    tot_cust = len(customer_summary_df)
    at_risk = int(sum(customer_summary_df['churn_prediction'] == 1))
    safe_c = tot_cust - at_risk
    overall_churn_rate = at_risk / tot_cust if tot_cust > 0 else 0
    
    # 1. Risk Distribution
    chart_data['risk_distribution'] = [
        {"name": "Safe Customers", "value": safe_c},
        {"name": "At-Risk Customers", "value": at_risk}
    ]
    
    # Pre-map customer risk to transactions
    risk_map = customer_summary_df.set_index('customer_name')['churn_prediction']
    merged_df['_customer_risk_flag'] = merged_df['Customer Name'].map(risk_map).fillna(0).astype(int)
    
    # Helper: Safe Divide
    def safe_div(a, b):
        return 0 if b == 0 else a / b

    # Ensure datetimes are valid
    if "Purchase Date" in merged_df:
        merged_df["_dt"] = pd.to_datetime(merged_df["Purchase Date"], errors="coerce")
        merged_df = merged_df.dropna(subset=["_dt"])
        
    if not merged_df.empty and "_dt" in merged_df:
        max_dt = merged_df["_dt"].max()
        
        # 3 & 4. Trend Charts (Last 30, 90, 6m, 12m, All)
        periods = {
            'last_30_days': (max_dt - pd.Timedelta(days=30), 'D', '%Y-%m-%d'),
            'last_90_days': (max_dt - pd.Timedelta(days=90), 'W-MON', '%Y-%m-%d'),
            'last_6_months': (max_dt - pd.DateOffset(months=6), 'M', '%b %Y'),
            'last_12_months': (max_dt - pd.DateOffset(months=12), 'M', '%b %Y'),
            'all_time': (merged_df["_dt"].min(), 'M', '%b %Y')
        }
        
        for p_key, (start_dt, freq, fmt) in periods.items():
            mask = merged_df["_dt"] >= start_dt
            sub_df = merged_df[mask].copy()
            if sub_df.empty:
                continue
            
            sub_df['_period_dt'] = sub_df['_dt'].dt.to_period(freq).dt.to_timestamp()
            
            grp = sub_df.groupby('_period_dt')
            res = []
            res_risk = []
            for name, group in grp:
                tc = group['Customer Name'].nunique()
                ar = group[group['_customer_risk_flag'] == 1]['Customer Name'].nunique()
                label = name.strftime(fmt)
                res.append({"period": label, "at_risk_customers": ar})
                res_risk.append({"period": label, "risk_percent": round(safe_div(ar, tc) * 100, 1)})
            
            chart_data['at_risk_customers_trend'][p_key] = res
            chart_data['churn_risk_trend'][p_key] = res_risk
            
        # 11. Weekday
        chart_data['churn_activity_by_weekday'] = {}
        merged_df['_weekday'] = merged_df['_dt'].dt.day_name()
        wd_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        wd_display = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        
        for p_key, (start_dt, _, _) in periods.items():
            mask = merged_df['_dt'] >= start_dt
            sub_df = merged_df[mask]
            wd_data = []
            ar_df = sub_df[sub_df['_customer_risk_flag'] == 1]
            for idx, wd in enumerate(wd_order):
                sub = ar_df[ar_df['_weekday'] == wd]
                wd_data.append({
                    "weekday": wd_display[idx],
                    "at_risk_transactions": len(sub),
                    "at_risk_customers": sub['Customer Name'].nunique()
                })
            chart_data['churn_activity_by_weekday'][p_key] = wd_data
            
        # 12. Monthly Seasonality
        chart_data['monthly_churn_seasonality'] = {}
        merged_df['_month'] = merged_df['_dt'].dt.month
        merged_df['_year'] = merged_df['_dt'].dt.year
        month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        # All years
        m_data_all = []
        for m in range(1, 13):
            sub = merged_df[merged_df['_month'] == m]
            tc = sub['Customer Name'].nunique()
            ar = sub[sub['_customer_risk_flag'] == 1]['Customer Name'].nunique()
            m_data_all.append({
                "month": month_names[m-1],
                "risk_rate": round(safe_div(ar, tc) * 100, 1),
                "at_risk_customers": ar,
                "total_customers": tc
            })
        chart_data['monthly_churn_seasonality']['all_years'] = m_data_all
        
        # Specific years
        years = merged_df['_year'].dropna().unique()
        for y in sorted(years):
            m_data_y = []
            y_df = merged_df[merged_df['_year'] == y]
            for m in range(1, 13):
                sub = y_df[y_df['_month'] == m]
                tc = sub['Customer Name'].nunique()
                ar = sub[sub['_customer_risk_flag'] == 1]['Customer Name'].nunique()
                m_data_y.append({
                    "month": month_names[m-1],
                    "risk_rate": round(safe_div(ar, tc) * 100, 1),
                    "at_risk_customers": ar,
                    "total_customers": tc
                })
            chart_data['monthly_churn_seasonality'][str(int(y))] = m_data_y
        
        
    # Categories
    if "Product Category" in merged_df:
        c_grp = merged_df.groupby("Product Category")
        cat_risk = []
        cat_rev = []
        for cat, group in c_grp:
            tc = group['Customer Name'].nunique()
            ar = group[group['_customer_risk_flag'] == 1]['Customer Name'].nunique()
            rev_risk = float(group[group['_customer_risk_flag'] == 1]['Total Purchase Amount'].sum())
            rev_tot = float(group['Total Purchase Amount'].sum())
            
            if tc > 0:
                cat_risk.append({
                    "category": str(cat),
                    "total_customers": tc,
                    "at_risk_customers": ar,
                    "risk_rate": round(safe_div(ar, tc) * 100, 1)
                })
            if rev_tot > 0:
                cat_rev.append({
                    "category": str(cat),
                    "revenue_at_risk": rev_risk,
                    "total_revenue": rev_tot,
                    "risk_share": round(safe_div(rev_risk, rev_tot) * 100, 1)
                })
        
        chart_data['risk_by_category'] = sorted(cat_risk, key=lambda x: x['risk_rate'], reverse=True)[:10]
        chart_data['revenue_at_risk_by_category'] = sorted(cat_rev, key=lambda x: x['revenue_at_risk'], reverse=True)[:10]

    # Payment Methods
    pm_df = None
    if "Payment Method" in merged_df:
        pref_pm = merged_df.groupby("Customer Name")["Payment Method"].agg(lambda x: x.mode()[0] if not x.mode().empty else "Unknown")
        pm_df = pd.DataFrame({'pm': pref_pm, 'risk': risk_map})
        pm_ar = pm_df[pm_df['risk'] == 1].groupby('pm').size()
        pm_res = []
        for pm, count in pm_ar.items():
            pm_res.append({"payment_method": str(pm), "at_risk_customers": int(count)})
        chart_data['risk_by_payment_method'] = sorted(pm_res, key=lambda x: x['at_risk_customers'], reverse=True)

    # Customer Level Aggregations
    # Recency Buckets
    if not customer_summary_df.empty and '_dt' in merged_df and not merged_df['_dt'].isna().all():
        norm_dt = merged_df['_dt'].dt.normalize()
        max_dt_cust = norm_dt.max()
        last_order_dt = merged_df.groupby("Customer Name")['_dt'].max().dt.normalize()
        customer_summary_df['_last_dt'] = customer_summary_df['customer_name'].map(last_order_dt)
        customer_summary_df['recency_days'] = (max_dt_cust - customer_summary_df['_last_dt']).dt.days
        
        def get_bucket(d):
            if pd.isna(d): return "Unknown"
            if d <= 30: return "0-30 days"
            elif d <= 60: return "31-60 days"
            elif d <= 90: return "61-90 days"
            elif d <= 180: return "91-180 days"
            else: return "180+ days"
            
        customer_summary_df['recency_bucket'] = customer_summary_df['recency_days'].apply(get_bucket)
        
        bucket_order = ["0-30 days", "31-60 days", "61-90 days", "91-180 days", "180+ days"]
        rb_res = []
        for b in bucket_order:
            sub = customer_summary_df[customer_summary_df['recency_bucket'] == b]
            if not sub.empty:
                rb_res.append({
                    "bucket": b,
                    "safe_customers": int(sum(sub['churn_prediction'] == 0)),
                    "at_risk_customers": int(sum(sub['churn_prediction'] == 1))
                })
        chart_data['customer_recency_buckets'] = rb_res

    # Orders and AOV by Risk Segment & Return Behavior
    if not customer_summary_df.empty:
        risk_seg_res = []
        ret_seg_res = []
        for r_val, r_label in [(0, "Safe"), (1, "At Risk")]:
            sub = customer_summary_df[customer_summary_df['churn_prediction'] == r_val]
            if not sub.empty:
                avg_orders = sub['orders'].mean()
                avg_aov = sub['aov'].mean()
                avg_rev = sub['revenue'].mean()
                
                tot_returns = sub['returns'].sum()
                tot_orders = sub['orders'].sum()
                
                risk_seg_res.append({
                    "risk_segment": r_label,
                    "avg_orders": round(float(avg_orders), 1),
                    "avg_aov": round(float(avg_aov), 1),
                    "avg_revenue": round(float(avg_rev), 1)
                })
                
                ret_seg_res.append({
                    "risk_segment": r_label,
                    "return_rate": round(safe_div(tot_returns, tot_orders) * 100, 1),
                    "avg_returns_per_customer": round(float(sub['returns'].mean()), 2)
                })
        
        chart_data['orders_aov_by_risk_segment'] = risk_seg_res
        chart_data['return_behavior_by_risk_segment'] = ret_seg_res

    # Churn Risk by AOV Band (formerly Price Sensitivity)
    if "Total Purchase Amount" in merged_df and "Customer Name" in merged_df:
        try:
            cust_rev = merged_df.groupby("Customer Name")["Total Purchase Amount"].sum()
            cust_ord = merged_df.groupby("Customer Name").size()
            cust_aov = cust_rev / cust_ord
            
            band_df = pd.DataFrame({
                "aov": cust_aov,
                "risk": risk_map
            }).dropna()

            if len(band_df) > 3:
                q_res, q_bins = pd.qcut(band_df['aov'], q=4, retbins=True, duplicates='drop')
                labels_base = ["Low AOV", "Mid AOV", "High AOV", "Premium AOV"]
                
                def fmt_dollar(v):
                    if v >= 1000:
                        val = f"${v/1000:.2f}k"
                        return val.replace(".00k", "k").replace("0k", "k") if val.endswith("0k") and "." in val else val
                    return f"${v:.0f}"
                    
                labels_full = []
                num_bins = len(q_bins) - 1
                for i in range(num_bins):
                    if i == 0:
                        rng = f"≤ {fmt_dollar(q_bins[1])}"
                    elif i == num_bins - 1:
                        rng = f"> {fmt_dollar(q_bins[-2])}"
                    else:
                        rng = f"{fmt_dollar(q_bins[i])}–{fmt_dollar(q_bins[i+1])}"
                    
                    base_name = labels_base[i] if i < len(labels_base) else f"Band {i+1}"
                    if num_bins < 4:
                         if i == 0: base_name = "Low AOV"
                         elif i == num_bins - 1: base_name = "Premium AOV"
                         else: base_name = "Mid AOV"
                    
                    labels_full.append({"base": base_name, "rng": rng})

                band_df['aov_bucket'] = pd.qcut(band_df['aov'], q=4, labels=[f"{lb['base']}|{lb['rng']}" for lb in labels_full], duplicates='drop')
                
                pb_res = []
                for lb in labels_full:
                    bucket_str = f"{lb['base']}|{lb['rng']}"
                    sub = band_df[band_df['aov_bucket'] == bucket_str]
                    if not sub.empty:
                        tc = len(sub)
                        ar = int(sub['risk'].sum())
                        pb_res.append({
                            "band": lb["base"],
                            "range_label": lb["rng"],
                            "churn_risk": round(safe_div(ar, tc) * 100, 1),
                            "customers": tc,
                            "at_risk_customers": ar
                        })
                chart_data['price_sensitivity'] = pb_res
        except Exception as e:
            pass 

    # Churn Drivers
    drivers = []
    
    if 'recency_days' in customer_summary_df:
        q75 = customer_summary_df['recency_days'].quantile(0.75)
        sub = customer_summary_df[customer_summary_df['recency_days'] >= q75]
        if not sub.empty:
            tc = len(sub)
            ar = int(sum(sub['churn_prediction'] == 1))
            rate = safe_div(ar, tc)
            score = max(0, rate - overall_churn_rate)
            if score > 0:
                drivers.append({"name": "Recency Risk", "value": round(score, 3), "value_label": f"{round(score * 100, 1)} pp lift"})

    if 'returns' in customer_summary_df:
        customer_summary_df['_return_rate'] = customer_summary_df['returns'] / customer_summary_df['orders'].replace(0, 1)
        sub = customer_summary_df[customer_summary_df['_return_rate'] > 0]
        if not sub.empty:
            tc = len(sub)
            ar = int(sum(sub['churn_prediction'] == 1))
            rate = safe_div(ar, tc)
            score = max(0, rate - overall_churn_rate)
            if score > 0:
                drivers.append({"name": "Return Behavior", "value": round(score, 3), "value_label": f"{round(score * 100, 1)} pp lift"})

    if 'orders' in customer_summary_df:
        q25 = customer_summary_df['orders'].quantile(0.25)
        sub = customer_summary_df[customer_summary_df['orders'] <= q25]
        if not sub.empty:
            tc = len(sub)
            ar = int(sum(sub['churn_prediction'] == 1))
            rate = safe_div(ar, tc)
            score = max(0, rate - overall_churn_rate)
            if score > 0:
                drivers.append({"name": "Low Purchase Frequency", "value": round(score, 3), "value_label": f"{round(score * 100, 1)} pp lift"})

    if 'revenue' in customer_summary_df:
        q25 = customer_summary_df['revenue'].quantile(0.25)
        sub = customer_summary_df[customer_summary_df['revenue'] <= q25]
        if not sub.empty:
            tc = len(sub)
            ar = int(sum(sub['churn_prediction'] == 1))
            rate = safe_div(ar, tc)
            score = max(0, rate - overall_churn_rate)
            if score > 0:
                drivers.append({"name": "Low Historical Value", "value": round(score, 3), "value_label": f"{round(score * 100, 1)} pp lift"})

    if chart_data['risk_by_category']:
        max_cat = max(chart_data['risk_by_category'], key=lambda x: x['risk_rate'])
        score = (max_cat['risk_rate'] / 100.0) - overall_churn_rate
        if score > 0:
            drivers.append({"name": f"Category Risk ({max_cat['category']})", "value": round(score, 3), "value_label": f"{round(score * 100, 1)} pp lift"})

    if chart_data['risk_by_payment_method'] and pm_df is not None:
        rates = []
        for pm_res in chart_data['risk_by_payment_method']:
            tc = int(sum(pm_df['pm'] == pm_res['payment_method']))
            rates.append({'pm': pm_res['payment_method'], 'rate': safe_div(pm_res['at_risk_customers'], tc) * 100})
        if rates:
            max_pm = max(rates, key=lambda x: x['rate'])
            score = (max_pm['rate'] / 100.0) - overall_churn_rate
            if score > 0:
                drivers.append({"name": f"Payment Risk ({max_pm['pm']})", "value": round(score, 3), "value_label": f"{round(score * 100, 1)} pp lift"})

    chart_data['churn_drivers'] = sorted(drivers, key=lambda x: x['value'], reverse=True)[:6]

    return chart_data
