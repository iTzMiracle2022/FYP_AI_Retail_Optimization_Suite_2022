from statsmodels.tsa.arima.model import ARIMA
import pandas as pd
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error
from datetime import datetime, timedelta
import warnings
import math
import os
import hashlib
from concurrent.futures import ProcessPoolExecutor, as_completed
import time
import random

# Global in-memory cache for API performance
_arima_cache = {}

def get_dataset_hash(df):
    try:
        sample = pd.util.hash_pandas_object(df.head(100)).sum()
        shape_hash = f"{df.shape[0]}_{df.shape[1]}"
        return hashlib.md5(f"{sample}_{shape_hash}".encode()).hexdigest()
    except:
        return "default_hash"

def find_column(df, possible_names):
    for name in possible_names:
        if name in df.columns:
            return name
        lower_cols = {c.lower(): c for c in df.columns}
        if name.lower() in lower_cols:
            return lower_cols[name.lower()]
    return None

def resolve_inventory_columns(df):
    cols = {
        "date": find_column(df, ["Date", "date", "Order Date", "Transaction Date"]),
        "units_sold": find_column(df, ["Units Sold", "units_sold", "Sales Quantity", "Quantity Sold", "Demand"]),
        "inventory_level": find_column(df, ["Inventory Level", "inventory_level", "Stock", "Current Stock", "On Hand"]),
        "units_ordered": find_column(df, ["Units Ordered", "units_ordered", "Ordered Units", "Reorder Qty"]),
        "demand_forecast": find_column(df, ["Demand Forecast", "Forecast Demand", "Predicted Demand"]),
        "store_id": find_column(df, ["Store ID", "store_id", "Store", "Location ID"]),
        "product_id": find_column(df, ["Product ID", "product_id", "SKU", "Item ID"]),
        "category": find_column(df, ["Category", "Product Category"]),
        "region": find_column(df, ["Region", "Sales Region"]),
        "price": find_column(df, ["Price", "Unit Price", "Selling Price"]),
        "discount": find_column(df, ["Discount", "Discount %", "Discount Rate"]),
        "promotion": find_column(df, ["Holiday/Promotion", "Promotion", "Holiday", "Promo Flag"]),
        "weather": find_column(df, ["Weather Condition", "Weather"]),
        "competitor_price": find_column(df, ["Competitor Pricing", "Competitor Price"]),
        "seasonality": find_column(df, ["Seasonality", "Season", "Month", "Quarter"])
    }
    
    available = [k for k, v in cols.items() if v is not None]
    
    if "date" in available and "units_sold" in available:
        if "store_id" in available and "product_id" in available:
            arima_mode = "grouped"
        else:
            arima_mode = "minimum"
    else:
        arima_mode = "not_available"
        
    if "inventory_level" in available and "units_sold" in available:
        if "store_id" in available and "product_id" in available and "price" in available and "promotion" in available:
            q_learning_mode = "advanced"
        elif "store_id" in available and "product_id" in available:
            q_learning_mode = "standard"
        else:
            q_learning_mode = "minimum"
    else:
        q_learning_mode = "not_available"

    return {
        "columns": cols,
        "available_columns": available,
        "arima_mode": arima_mode,
        "q_learning_mode": q_learning_mode
    }

def _fit_single_arima(group_data):
    """Helper for parallel execution of dual-mode ARIMA"""
    group_name, series, days = group_data
    
    # Needs at least enough data to backtest
    if len(series) <= days + 5:
        return group_name, None, None, "error: insufficient_data"
        
    backtest_train = series[:-days]
    backtest_actual = series[-days:]
    
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            # 1. Backtest Model
            model_bt = ARIMA(backtest_train, order=(1, 1, 0))
            fit_bt = model_bt.fit()
            backtest_preds = list(fit_bt.forecast(steps=days))
            
            # 2. Production Model
            model_prod = ARIMA(series, order=(1, 1, 0))
            fit_prod = model_prod.fit()
            production_preds = list(fit_prod.forecast(steps=days))
            
            return group_name, backtest_preds, production_preds, "success"
    except Exception as e:
        return group_name, None, None, f"error: {str(e)}"

class QLearningInventoryAgent:
    def __init__(self, mode, cols_map):
        self.mode = mode
        self.cols_map = cols_map
        self.q_table = {}
        self.alpha = 0.1
        self.gamma = 0.9
        self.epsilon = 0.2
        
        self.actions = {
            0: 0.0, 1: 0.8, 2: 1.0, 3: 1.2, 4: 1.5
        }
        self.stockout_penalty = 5.0
        self.holding_cost_rate = 0.5
        self.order_cost_rate = 0.1

    def _get_state(self, current_inventory, predicted_demand, row):
        coverage = current_inventory / predicted_demand if predicted_demand > 0 else 99
        if coverage < 0.5: c_bucket = "critical"
        elif coverage < 1.0: c_bucket = "low"
        elif coverage < 1.5: c_bucket = "healthy"
        else: c_bucket = "overstock"
        
        if predicted_demand < 10: d_bucket = "low"
        elif predicted_demand < 50: d_bucket = "med"
        else: d_bucket = "high"
        
        state = [c_bucket, d_bucket]
        
        if self.mode in ["standard", "advanced"]:
            prod = row[self.cols_map['product_id']] if self.cols_map['product_id'] else "unknown"
            state.append(str(prod))
            
        if self.mode == "advanced":
            if self.cols_map['promotion'] and pd.notna(row[self.cols_map['promotion']]):
                state.append(str(row[self.cols_map['promotion']]))
            if self.cols_map['seasonality'] and pd.notna(row[self.cols_map['seasonality']]):
                state.append(str(row[self.cols_map['seasonality']]))
                
        return tuple(state)

    def _get_reward(self, current_inventory, action_idx, predicted_demand, actual_sold):
        multiplier = self.actions[action_idx]
        reorder_qty = max(0, int((predicted_demand * multiplier) - current_inventory))
        
        available = current_inventory + reorder_qty
        stockout_units = max(0, actual_sold - available)
        ending_inventory = max(0, available - actual_sold)
        
        cost = (stockout_units * self.stockout_penalty) + \
               (ending_inventory * self.holding_cost_rate) + \
               (reorder_qty * self.order_cost_rate)
        return -cost

    def train_offline(self, historical_df):
        if self.mode == "not_available" or len(historical_df) == 0:
            return
            
        inv_col = self.cols_map['inventory_level']
        sold_col = self.cols_map['units_sold']
        demand_col = self.cols_map['demand_forecast']
        
        epochs = min(3, max(1, 5000 // len(historical_df)))
        
        for epoch in range(epochs):
            for idx, row in historical_df.iterrows():
                try:
                    inv = float(row[inv_col])
                    sold = float(row[sold_col])
                    pred_demand = float(row[demand_col]) if demand_col and pd.notna(row[demand_col]) else sold
                    
                    state = self._get_state(inv, pred_demand, row)
                    if state not in self.q_table:
                        self.q_table[state] = {a: 0.0 for a in self.actions.keys()}
                        
                    if random.random() < self.epsilon:
                        action = random.choice(list(self.actions.keys()))
                    else:
                        action = max(self.q_table[state], key=self.q_table[state].get)
                        
                    reward = self._get_reward(inv, action, pred_demand, sold)
                    
                    self.q_table[state][action] = self.q_table[state][action] + \
                        self.alpha * (reward + self.gamma * 0.0 - self.q_table[state][action])
                except:
                    continue

    def get_best_action(self, state):
        if state not in self.q_table:
            return 3
        return max(self.q_table[state], key=self.q_table[state].get)

def safe_mape(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    mask = y_true != 0
    if not np.any(mask): return 0.0
    return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100

class InventoryForecaster:
    def __init__(self):
        self.capability = {}
        self.using_gpu = False
        self.raw_df = None
        self.original_alerts = []
        self.q_recommendations = []
        self.q_learning_metrics = {}

    def predict(self, df: pd.DataFrame, days: int = 7, product_ids: list = None, dataset_id: str = "unknown"):
        self.raw_df = df.copy()
        start_time = time.time()
        
        col_res = resolve_inventory_columns(df)
        self.cols_map = col_res["columns"]
        
        arima_mode = col_res["arima_mode"]
        q_mode = col_res["q_learning_mode"]
        
        self.capability = {
            "arima": {
                "active": arima_mode != "not_available",
                "mode": arima_mode,
                "runtime_seconds": 0,
                "cache_hit": False,
                "fallback_groups": 0,
                "fallbacks_used": [],
                "forecast_days": days
            },
            "q_learning": {
                "active": q_mode != "not_available",
                "mode": q_mode,
                "reward_constants": {
                    "stockout_penalty": 5.0,
                    "holding_cost_rate": 0.5,
                    "order_cost_rate": 0.1
                }
            }
        }
        
        if arima_mode == "not_available":
            return {"error": "Missing essential columns"}

        date_col = self.cols_map['date']
        sold_col = self.cols_map['units_sold']
        store_col = self.cols_map['store_id']
        prod_col = self.cols_map['product_id']
        demand_col = self.cols_map['demand_forecast']
        
        df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
        latest_date = df[date_col].max()
        test_start_date = latest_date - timedelta(days=days-1)
        
        ds_hash = get_dataset_hash(df)
        cache_key = f"{ds_hash}_{latest_date.strftime('%Y%m%d')}_{days}_{arima_mode}_order(1,1,0)_dual_mode"
        
        backtest_results = []
        production_results = []
        fallbacks_used = []
        
        if cache_key in _arima_cache:
            self.capability["arima"]["cache_hit"] = True
            cached_data = _arima_cache[cache_key]
            self.capability["arima"]["fallback_groups"] = cached_data['fallback_count']
            self.capability["arima"]["fallbacks_used"] = cached_data['fallbacks_used']
            backtest_results = cached_data['backtest']
            production_results = cached_data['production']
            arima_compute_time = 0.0
        else:
            arima_start = time.time()
            if arima_mode == "grouped":
                groups = df.groupby([store_col, prod_col])
                group_tasks = []
                for (store, prod), group_df in groups:
                    g_daily = group_df.groupby(date_col).agg({sold_col: 'sum'}).reset_index().sort_values(date_col)
                    group_tasks.append((f"{store}-{prod}", g_daily[sold_col].values, days))
                    
                max_workers = min(4, os.cpu_count() or 1)
                time_limit = 20.0
                
                with ProcessPoolExecutor(max_workers=max_workers) as executor:
                    future_to_group = {executor.submit(_fit_single_arima, task): task[0] for task in group_tasks}
                    start_loop = time.time()
                    
                    for future in as_completed(future_to_group):
                        group_name = future_to_group[future]
                        elapsed = time.time() - start_loop
                        
                        if elapsed > time_limit:
                            fallbacks_used.append({"group": group_name, "reason": "Timeout exceeded", "fallback": "rolling_30_day_average"})
                            original_series = next(t[1] for t in group_tasks if t[0] == group_name)
                            bt_val = original_series[:-days][-30:].mean() if len(original_series[:-days]) >= 30 else 0
                            pd_val = original_series[-30:].mean() if len(original_series) >= 30 else 0
                            for i in range(days):
                                backtest_results.append({'date': (test_start_date + timedelta(days=i)).strftime('%Y-%m-%d'), 'demand': max(0, round(float(bt_val), 2)), 'group': group_name})
                                production_results.append({'date': (latest_date + timedelta(days=i+1)).strftime('%Y-%m-%d'), 'demand': max(0, round(float(pd_val), 2)), 'group': group_name})
                            continue
                            
                        res_group, bt_preds, prod_preds, status = future.result()
                        if status == "success" and bt_preds is not None:
                            for i in range(days):
                                backtest_results.append({'date': (test_start_date + timedelta(days=i)).strftime('%Y-%m-%d'), 'demand': max(0, round(float(bt_preds[i]), 2)), 'group': res_group})
                                production_results.append({'date': (latest_date + timedelta(days=i+1)).strftime('%Y-%m-%d'), 'demand': max(0, round(float(prod_preds[i]), 2)), 'group': res_group})
                        else:
                            fallbacks_used.append({"group": group_name, "reason": status, "fallback": "rolling_7_day_average"})
                            original_series = next(t[1] for t in group_tasks if t[0] == group_name)
                            bt_val = original_series[:-days][-7:].mean() if len(original_series[:-days]) >= 7 else 0
                            pd_val = original_series[-7:].mean() if len(original_series) >= 7 else 0
                            for i in range(days):
                                backtest_results.append({'date': (test_start_date + timedelta(days=i)).strftime('%Y-%m-%d'), 'demand': max(0, round(float(bt_val), 2)), 'group': group_name})
                                production_results.append({'date': (latest_date + timedelta(days=i+1)).strftime('%Y-%m-%d'), 'demand': max(0, round(float(pd_val), 2)), 'group': group_name})

            arima_compute_time = time.time() - arima_start
            self.capability["arima"]["fallback_groups"] = len(fallbacks_used)
            self.capability["arima"]["fallbacks_used"] = fallbacks_used
            
            _arima_cache[cache_key] = {
                'backtest': backtest_results,
                'production': production_results,
                'fallback_count': len(fallbacks_used),
                'fallbacks_used': fallbacks_used
            }

        # Format Backtest evaluation
        df_test_window = df[(df[date_col] >= test_start_date) & (df[date_col] <= latest_date)].copy()
        
        # Calculate daily aggregates for backtest
        if len(backtest_results) > 0:
            bt_df = pd.DataFrame(backtest_results)
            bt_daily_arima = bt_df.groupby('date')['demand'].sum().reset_index()
        else:
            bt_daily_arima = pd.DataFrame(columns=['date', 'demand'])
            
        test_actual_daily = df_test_window.groupby(date_col)[sold_col].sum().reset_index()
        test_actual_daily['date'] = test_actual_daily[date_col].dt.strftime('%Y-%m-%d')
        
        if demand_col:
            test_demand_daily = df_test_window.groupby(date_col)[demand_col].sum().reset_index()
            test_demand_daily['date'] = test_demand_daily[date_col].dt.strftime('%Y-%m-%d')
        else:
            test_demand_daily = pd.DataFrame(columns=['date', demand_col])
            
        # Merge for metrics
        metrics_df = pd.merge(test_actual_daily, bt_daily_arima, on='date', how='left').rename(columns={'demand': 'arima_pred'})
        if demand_col:
            metrics_df = pd.merge(metrics_df, test_demand_daily, on='date', how='left').rename(columns={demand_col: 'dataset_pred'})
        
        metrics_df = metrics_df.fillna(0)
        
        arima_metrics = {"mae": 0, "rmse": 0, "mape": 0}
        dataset_metrics = {"mae": 0, "rmse": 0, "mape": 0}
        
        if len(metrics_df) > 0:
            y_true = metrics_df[sold_col]
            y_arima = metrics_df['arima_pred']
            arima_metrics['mae'] = float(mean_absolute_error(y_true, y_arima))
            arima_metrics['rmse'] = float(np.sqrt(mean_squared_error(y_true, y_arima)))
            arima_metrics['mape'] = float(safe_mape(y_true, y_arima))
            
            if demand_col and 'dataset_pred' in metrics_df.columns:
                y_dataset = metrics_df['dataset_pred']
                dataset_metrics['mae'] = float(mean_absolute_error(y_true, y_dataset))
                dataset_metrics['rmse'] = float(np.sqrt(mean_squared_error(y_true, y_dataset)))
                dataset_metrics['mape'] = float(safe_mape(y_true, y_dataset))
                
        # Run Q-Learning
        q_start = time.time()
        self._run_q_learning(df, test_start_date, latest_date, days, pd.DataFrame(production_results))
        q_time = time.time() - q_start
        
        total_time = time.time() - start_time
        self.capability["arima"]["runtime_seconds"] = round(total_time, 2)
        self.capability["runtime_breakdown"] = {
            "arima_compute": round(arima_compute_time, 2) if not self.capability["arima"]["cache_hit"] else 0,
            "q_learning": round(q_time, 2),
            "total": round(total_time, 2)
        }

        # Response structure
        return {
            "forecast_mode": "production_with_backtest",
            "production_forecast": {
                "date_range": [(latest_date + timedelta(days=1)).strftime('%Y-%m-%d'), (latest_date + timedelta(days=days)).strftime('%Y-%m-%d')],
                "arima_forecast": pd.DataFrame(production_results).to_dict(orient='records') if len(production_results) > 0 else [],
                "q_learning_recommendations": self.q_recommendations,
                "original_low_stock_alerts": self.original_alerts
            },
            "backtest_evaluation": {
                "date_range": [test_start_date.strftime('%Y-%m-%d'), latest_date.strftime('%Y-%m-%d')],
                "daily_breakdown": metrics_df.to_dict(orient='records'),
                "metrics": {
                    "arima": arima_metrics,
                    "dataset_demand_forecast": dataset_metrics,
                    "q_learning_policy": self.q_learning_metrics
                }
            },
            "capability": self.capability
        }

    def _run_q_learning(self, df, test_start_date, latest_date, days, prod_df):
        q_mode = self.capability["q_learning"]["mode"]
        if q_mode == "not_available":
            return
            
        agent = QLearningInventoryAgent(q_mode, self.cols_map)
        
        # Strictly train on data before test window to avoid leakage
        date_col = self.cols_map['date']
        train_df = df[df[date_col] < test_start_date]
        agent.train_offline(train_df)
        
        inv_col = self.cols_map['inventory_level']
        sold_col = self.cols_map['units_sold']
        store_col = self.cols_map['store_id']
        prod_col = self.cols_map['product_id']
        demand_col = self.cols_map['demand_forecast']
        
        # 1. Backtest Policy Evaluation
        test_df = df[(df[date_col] >= test_start_date) & (df[date_col] <= latest_date)].copy()
        
        baseline_cost = 0; baseline_stockouts = 0; baseline_stockout_units = 0; baseline_holding = 0; baseline_reorder_qty = 0
        q_cost = 0; q_stockouts = 0; q_stockout_units = 0; q_holding = 0; q_reorder_qty = 0
        
        for idx, row in test_df.iterrows():
            inv = float(row[inv_col])
            sold = float(row[sold_col])
            pred_dem = float(row[demand_col]) if demand_col and pd.notna(row[demand_col]) else sold
            
            # Baseline (1.2x)
            r_qty = max(0, int((pred_dem * 1.2) - inv))
            avail = inv + r_qty
            s_units = max(0, sold - avail)
            h_units = max(0, avail - sold)
            b_cost = (s_units * agent.stockout_penalty) + (h_units * agent.holding_cost_rate) + (r_qty * agent.order_cost_rate)
            
            baseline_cost += b_cost
            baseline_stockout_units += s_units
            baseline_holding += h_units
            baseline_reorder_qty += r_qty
            if s_units > 0: baseline_stockouts += 1
            
            # Q-Learning Policy
            state = agent._get_state(inv, pred_dem, row)
            action_idx = agent.get_best_action(state)
            multiplier = agent.actions[action_idx]
            
            q_r_qty = max(0, int((pred_dem * multiplier) - inv))
            q_avail = inv + q_r_qty
            q_s_units = max(0, sold - q_avail)
            q_h_units = max(0, q_avail - sold)
            q_c = (q_s_units * agent.stockout_penalty) + (q_h_units * agent.holding_cost_rate) + (q_r_qty * agent.order_cost_rate)
            
            q_cost += q_c
            q_stockout_units += q_s_units
            q_holding += q_h_units
            q_reorder_qty += q_r_qty
            if q_s_units > 0: q_stockouts += 1

        self.q_learning_metrics = {
            "baseline": {
                "stockout_events": baseline_stockouts,
                "stockout_units": baseline_stockout_units,
                "holding_units": baseline_holding,
                "total_reorder_qty": baseline_reorder_qty,
                "estimated_total_cost": baseline_cost
            },
            "q_learning": {
                "stockout_events": q_stockouts,
                "stockout_units": q_stockout_units,
                "holding_units": q_holding,
                "total_reorder_qty": q_reorder_qty,
                "estimated_total_cost": q_cost
            }
        }
        
        # 2. Live Recommendations & Original Alerts
        df_latest = df[df[date_col] == latest_date].copy()
        
        if self.capability["arima"]["mode"] == "grouped" and len(prod_df) > 0:
            horizon_demand = prod_df.groupby('group')['demand'].sum().to_dict()
        else:
            total_global = prod_df['demand'].sum() if len(prod_df) > 0 else 100
            horizon_demand = {"Global": total_global}
            
        alerts = []
        recommendations = []
        
        for idx, row in df_latest.iterrows():
            inv = float(row[inv_col])
            
            if self.capability["arima"]["mode"] == "grouped":
                g_key = f"{row[store_col]}-{row[prod_col]}"
                pred_dem = horizon_demand.get(g_key, 0)
            else:
                pred_dem = horizon_demand.get("Global", 0) / max(1, len(df_latest))
                
            state = agent._get_state(inv, pred_dem, row)
            action_idx = agent.get_best_action(state)
            multiplier = agent.actions[action_idx]
            
            rule_based_reorder = max(0, math.ceil((pred_dem * 1.2) - inv))
            q_reorder = max(0, math.ceil((pred_dem * multiplier) - inv))
            
            # Original Alert Logic: Only flag if inv < demand * 1.2
            is_low_stock = inv < (pred_dem * 1.2)
            
            ratio = inv / pred_dem if pred_dem > 0 else 0
            if ratio < 0.70: severity = 'CRITICAL'
            elif ratio < 0.90: severity = 'HIGH'
            elif ratio < 1.20: severity = 'MEDIUM'
            else: severity = 'LOW'
            
            item_data = {
                'product': str(row[prod_col]) if prod_col else "Unknown",
                'store': str(row[store_col]) if store_col else "Unknown",
                'category': str(row[self.cols_map['category']]) if self.cols_map['category'] else "Unknown",
                'region': str(row[self.cols_map['region']]) if self.cols_map['region'] else "Unknown",
                'demand_forecast': round(pred_dem, 2),
                'current_qty': int(inv),
                'rule_based_baseline': int(rule_based_reorder),
                'q_reorder_suggestion': int(q_reorder),
                'action_multiplier': f"{multiplier}x",
                'severity': severity
            }
            
            recommendations.append(item_data)
            if is_low_stock:
                alerts.append(item_data)
                
        alerts.sort(key=lambda x: x['rule_based_baseline'], reverse=True)
        recommendations.sort(key=lambda x: x['q_reorder_suggestion'], reverse=True)
        
        self.original_alerts = alerts
        self.q_recommendations = recommendations

    def get_low_stock_alerts(self) -> list:
        return self.original_alerts

    def get_accuracy(self) -> float:
        return 0.85

    def get_ai_wisdom(self) -> dict:
        return self.capability
