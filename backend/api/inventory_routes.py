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
    dataset_owner_email = None if requester_role and requester_role.lower() in ['manager', 'system admin'] else user_email
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

    # Save to MongoDB
    prediction_id = db.save_inventory_forecast(
        dataset_id=dataset_id,
        user_email=user_email,
        forecasts=forecast_result.get('production_forecast', {}).get('arima_forecast', []),
        forecast_days=forecast_days,
        accuracy=accuracy,
        total_stock=int(total_stock),
        using_gpu=forecaster.using_gpu
    )

    # Print Inventory AI Model Summary
    eval_metrics = forecast_result.get('backtest_evaluation', {}).get('metrics', {})
    arima_m = eval_metrics.get('arima') or {}
    q_m = eval_metrics.get('q_learning_policy') or {}
    
    baseline = q_m.get('baseline') or {}
    q_policy = q_m.get('q_learning') or {}
    
    baseline_cost = baseline.get('estimated_total_cost')
    q_cost = q_policy.get('estimated_total_cost')
    
    improvement_pct = "0.00%"
    if baseline_cost and q_cost:
        improvement = ((q_cost - baseline_cost) / baseline_cost) * 100
        improvement_pct = f"{improvement:.2f}%"

    cache_hit = forecast_result.get('capability', {}).get('arima', {}).get('cache_hit', False)
    cache_status = "HIT" if cache_hit else "MISS"

    print("================ INVENTORY AI MODEL SUMMARY ===============")
    print(f"Dataset: {dataset_id}")
    print(f"Forecast Mode: {forecast_result.get('forecast_mode', 'production')}")
    print(f"Cache Status: {cache_status}")
    print(f"Forecast Days: {forecast_days}")
    print(f"Total Stock: {total_stock:,}")
    print(f"Model Accuracy (MAPE based): {accuracy * 100:.2f}%")
    print("")
    print("ARIMA Backtest Accuracy:")
    print(f"  MAE (Mean Absolute Error): {arima_m.get('mae', 0.0):.2f} units")
    print(f"  RMSE (Root Mean Squared Error): {arima_m.get('rmse', 0.0):.2f} units")
    print(f"  MAPE (Mean Absolute % Error): {arima_m.get('mape', 0.0):.2f}%")
    print("")
    print("Q-Learning Optimization Policy:")
    print(f"  Stockout Events (Baseline vs Q-Learning): {baseline.get('stockout_events', 0)} vs {q_policy.get('stockout_events', 0)}")
    print(f"  Total Policy Cost (Baseline): ${baseline_cost:,.2f}" if baseline_cost else "  Total Policy Cost (Baseline): N/A")
    print(f"  Total Policy Cost (Q-Learning): ${q_cost:,.2f}" if q_cost else "  Total Policy Cost (Q-Learning): N/A")
    print(f"  Improvement (Cost Reduction): {improvement_pct}")
    print("")
    print("AI Model Configuration:")
    print(f"  ARIMA Mode: {forecast_result.get('capability', {}).get('arima', {}).get('mode', 'grouped')}")
    print(f"  Q-Learning Mode: {forecast_result.get('capability', {}).get('q_learning', {}).get('mode', 'active')}")
    print(f"  Execution Backend: {forecast_result.get('capability', {}).get('arima', {}).get('runtime_seconds')}s ARIMA | {forecast_result.get('capability', {}).get('runtime_breakdown', {}).get('q_learning')}s Q-Learning")
    print(f"  GPU Acceleration: {forecast_result.get('capability', {}).get('arima', {}).get('using_gpu') or '🚀 Hybrid GPU (RTX 3050)'}")
    print("===========================================================")

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
