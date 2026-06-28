from flask import Blueprint, request, jsonify
import pandas as pd
from database.mongodb_helper import db
from database.data_loader import DataLoader
from utils.data_preprocessing import ColumnMatcher
from utils.error_handlers import handle_errors, APIError
from models.inventory_forecaster import InventoryForecaster
from utils.inventory_chart_mapper import InventoryChartMapper

inventory_bp = Blueprint('inventory', __name__, url_prefix='/api/inventory')
forecaster = InventoryForecaster()
loader = DataLoader()

@inventory_bp.route('/forecast', methods=['POST'])
@handle_errors
def forecast_demand():
    requester_role = request.headers.get('X-User-Role')
    if not requester_role or requester_role not in ['System Admin', 'Manager', 'Analyst', 'Viewer']:
        return jsonify({'success': False, 'message': 'Unauthorized. Role cannot run inventory forecasting.'}), 403

    """Predict inventory demand for products"""
    data = request.get_json()
    
    if not data or 'dataset_id' not in data:
        raise APIError("dataset_id is required", 400)

    dataset_id = data['dataset_id']
    forecast_days = int(data.get('forecast_days', 7))
    product_ids = data.get('product_ids', None)

    # Validate dataset exists
    user_email = data.get('email')
    requester_role = request.headers.get('X-User-Role')
    dataset_owner_email = None if requester_role and requester_role.lower() in ['manager', 'system admin', 'analyst', 'viewer'] else user_email
    db.get_dataset_info(dataset_id, dataset_owner_email)

    # Load dataset
    df = loader.load_csv(dataset_id)

    # Run forecast
    forecast_result = forecaster.predict(df, days=forecast_days, product_ids=product_ids, dataset_id=dataset_id)
    accuracy = forecaster.get_accuracy()

    # Map detailed analytics payload
    dashboard_data = InventoryChartMapper.map_dashboard(df, forecast_days)
    kpis = dashboard_data.get('kpis', {})
    dataset_kpis = dashboard_data.get('datasetKpis', {})
    dataset_kpis_snake = dashboard_data.get('dataset_kpis', {})
    total_stock = kpis.get('current_stock', 0)

    # Pre-calculate low_stock_summary
    low_stock_summary = []
    try:
        df_copy = df.copy()
        df_copy.columns = [c.strip() for c in df_copy.columns]
        qty_col = ColumnMatcher.match(df_copy, 'qty') or 'Inventory Level'
        forecast_col = ColumnMatcher.match(df_copy, 'forecast') or 'Demand Forecast'
        
        if qty_col in df_copy.columns and forecast_col in df_copy.columns:
            date_col = ColumnMatcher.match(df_copy, 'date') or 'Date'
            if date_col in df_copy.columns:
                df_copy[date_col] = pd.to_datetime(df_copy[date_col], errors='coerce')
                latest_date = df_copy[date_col].max()
                df_latest = df_copy[df_copy[date_col] == latest_date].copy()
            else:
                df_latest = df_copy.copy()
                
            prod_col = ColumnMatcher.match(df_latest, 'product') or 'Product ID'
            store_col = next((c for c in df_latest.columns if 'store' in c.lower()), 'Store ID')
            region_col = next((c for c in df_latest.columns if 'region' in c.lower()), 'Region')
            
            groupby_cols = []
            if prod_col in df_latest.columns: groupby_cols.append(prod_col)
            if store_col in df_latest.columns: groupby_cols.append(store_col)
            if region_col in df_latest.columns: groupby_cols.append(region_col)
            
            if groupby_cols:
                grouped = df_latest.groupby(groupby_cols).agg({
                    qty_col: 'min', 
                    forecast_col: 'mean'
                }).reset_index()
                grouped['is_low'] = grouped[qty_col] < (grouped[forecast_col] * 1.2)
                low_alerts = grouped[grouped['is_low']].copy()
            else:
                df_latest['is_low'] = df_latest[qty_col] < (df_latest[forecast_col] * 1.2)
                low_alerts = df_latest[df_latest['is_low']].copy()
                
            if not low_alerts.empty:
                critical = high = medium = low = 0
                for _, row in low_alerts.iterrows():
                    inv_val = float(row[qty_col] or 0)
                    dmd_val = float(row[forecast_col] or 0)
                    coverage = inv_val / dmd_val if dmd_val > 0 else 0
                    if coverage < 0.70: critical += 1
                    elif coverage < 0.90: high += 1
                    elif coverage < 1.20: medium += 1
                    else: low += 1
                if critical > 0: low_stock_summary.append({'name': 'Critical', 'value': critical})
                if high > 0: low_stock_summary.append({'name': 'High', 'value': high})
                if medium > 0: low_stock_summary.append({'name': 'Medium', 'value': medium})
                if low > 0: low_stock_summary.append({'name': 'Low', 'value': low})
    except Exception as e:
        print(f"Warning: Could not pre-calculate low stock summary: {e}")

    # Fetch evaluation metrics for logging
    eval_metrics = forecast_result.get('backtest_evaluation', {}).get('metrics', {})
    arima_m = eval_metrics.get('arima') or {}
    q_m = eval_metrics.get('q_learning_policy') or {}
    
    baseline = q_m.get('baseline') or {}
    q_policy = q_m.get('q_learning') or {}
    
    baseline_cost = baseline.get('estimated_total_cost')
    q_cost = q_policy.get('estimated_total_cost')
    
    if baseline_cost and q_cost:
        improvement = ((baseline_cost - q_cost) / baseline_cost) * 100
    else:
        improvement = 0.0
        
    mape = arima_m.get('mape', 0.0)

    # Save to MongoDB
    prediction_id = db.save_inventory_forecast(
        dataset_id=dataset_id,
        user_email=user_email,
        forecasts=forecast_result.get('production_forecast', {}).get('arima_forecast', []),
        forecast_days=forecast_days,
        accuracy=accuracy,
        total_stock=int(total_stock),
        using_gpu=forecaster.using_gpu,
        low_stock_summary=low_stock_summary,
        mape=mape,
        improvement=improvement
    )

    # Print Inventory AI Model Summary
    cache_hit = forecast_result.get('capability', {}).get('arima', {}).get('cache_hit', False)
    cache_status = "HIT" if cache_hit else "MISS"

    import textwrap
    def print_wrapped_kv(label, text, indent_width=25, width=80):
        prefix = f"{label:<{indent_width}} : "
        lines = textwrap.wrap(str(text), width=width - indent_width - 3)
        if not lines:
            print(prefix)
            return
        print(f"{prefix}{lines[0]}")
        for line in lines[1:]:
            print(f"{' ' * (indent_width + 3)}{line}")

    print("\n" + "=" * 80)
    print(f"║ {'INVENTORY AI MODEL SUMMARY':^76} ║")
    print("=" * 80)

    print("\n─── DATASET INFO ───────────────────────────────────────────────────────────────")
    print_wrapped_kv("Dataset Name", dataset_id)
    print_wrapped_kv("Forecast Mode", forecast_result.get('forecast_mode', 'production'))
    print_wrapped_kv("Cache Status", cache_status)
    print_wrapped_kv("Forecast Days", f"{forecast_days} days")
    print_wrapped_kv("Total Stock Level", f"{int(total_stock):,}")

    print("\n─── FORECAST MODEL PERFORMANCE ─────────────────────────────────────────────────")
    print_wrapped_kv("ARIMA Backtest MAE", f"{arima_m.get('mae', 0.0):.2f} units")
    print_wrapped_kv("ARIMA Backtest RMSE", f"{arima_m.get('rmse', 0.0):.2f} units")
    print_wrapped_kv("ARIMA Backtest MAPE", f"{arima_m.get('mape', 0.0):.2f}%")
    print_wrapped_kv("Model Accuracy (MAPE)", f"{accuracy * 100:.2f}%")

    print("\n─── Q-LEARNING OPTIMIZATION ────────────────────────────────────────────────────")
    print_wrapped_kv("Stockout Events", f"Baseline: {baseline.get('stockout_events', 0)} | Q-Learning: {q_policy.get('stockout_events', 0)}")
    print_wrapped_kv("Baseline Policy Cost", f"${baseline_cost:,.2f}" if baseline_cost else "N/A")
    print_wrapped_kv("Q-Learning Policy Cost", f"${q_cost:,.2f}" if q_cost else "N/A")
    
    if baseline_cost and q_cost:
        improvement = ((baseline_cost - q_cost) / baseline_cost) * 100
        if improvement >= 0:
            imp_str = f"{improvement:.2f}% cost reduction"
        else:
            imp_str = f"-{abs(improvement):.2f}% cost increase"
    else:
        imp_str = "0.00%"
    print_wrapped_kv("Cost Improvement", imp_str)

    print("\n─── AI MODEL CONFIGURATION ─────────────────────────────────────────────────────")
    print_wrapped_kv("ARIMA Mode", forecast_result.get('capability', {}).get('arima', {}).get('mode', 'grouped'))
    print_wrapped_kv("Q-Learning Mode", forecast_result.get('capability', {}).get('q_learning', {}).get('mode', 'active'))
    
    arima_runtime = forecast_result.get('capability', {}).get('arima', {}).get('runtime_seconds')
    q_runtime = forecast_result.get('capability', {}).get('runtime_breakdown', {}).get('q_learning')
    runtime_str = ""
    if arima_runtime is not None:
        try:
            runtime_str += f"{float(arima_runtime):.2f}s ARIMA"
        except (ValueError, TypeError):
            runtime_str += f"{arima_runtime} ARIMA"
    if q_runtime is not None:
        if runtime_str: runtime_str += " | "
        try:
            runtime_str += f"{float(q_runtime):.2f}s Q-Learning"
        except (ValueError, TypeError):
            runtime_str += f"{q_runtime} Q-Learning"
    if not runtime_str:
        runtime_str = "N/A"
    print_wrapped_kv("Execution Backend", runtime_str)
    
    gpu_status = forecast_result.get('capability', {}).get('arima', {}).get('using_gpu') or '🚀 Hybrid GPU (RTX 3050)'
    print_wrapped_kv("GPU Acceleration", gpu_status)
    print("=" * 80 + "\n")

    return jsonify({
        'success': True,
        'prediction_id': prediction_id,
        'dataset_id': dataset_id,
        'user_email': user_email,
        'forecast_days': forecast_days,
        'forecast_mode': forecast_result.get('forecast_mode', 'production'),
        'production_forecast': forecast_result.get('production_forecast', {}),
        'backtest_evaluation': forecast_result.get('backtest_evaluation', {}),
        'model_accuracy': float(accuracy),
        'low_stock_alerts': forecaster.get_low_stock_alerts(),
        'ai_wisdom': forecaster.get_ai_wisdom(),
        'model_capability': forecast_result.get('capability', {}),
        'using_gpu': forecaster.using_gpu,
        'timestamp': pd.Timestamp.now().isoformat(),
        'kpis': kpis,
        'datasetKpis': dataset_kpis,
        'dataset_kpis': dataset_kpis_snake,
        'charts': dashboard_data.get('charts', {}),
        'tables': dashboard_data.get('tables', {}),
        'metadata': dashboard_data.get('metadata', {}),
        'historicalAnalytics': dashboard_data.get('historicalAnalytics', {}),
        'coverageDetail': dashboard_data.get('coverageDetail', [])
    }), 200

@inventory_bp.route('/history/<dataset_id>', methods=['GET'])
@handle_errors
def get_inventory_forecasts(dataset_id):
    """Retrieve saved inventory forecast"""
    user_email = request.args.get('email')
    saved = db.get_inventory_forecast(dataset_id, user_email)
    return jsonify({
        'success': True,
        'data': saved
    }), 200

@inventory_bp.route('/alerts', methods=['GET'])
@handle_errors
def get_inventory_alerts():
    """Get active low stock alerts"""
    alerts = forecaster.get_low_stock_alerts()
    return jsonify({
        'success': True,
        'alerts': alerts,
        'count': len(alerts)
    }), 200
