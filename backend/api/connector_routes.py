from flask import Blueprint, request, jsonify
import pandas as pd
import sqlite3
import os
from pathlib import Path
from database.mongodb_helper import db
from utils.db_connector import connector
from utils.error_handlers import handle_errors, APIError
from config import config

connector_bp = Blueprint('connector', __name__, url_prefix='/api/connectors')

@connector_bp.route('/test', methods=['POST'])
@handle_errors
def test_db_connection():
    data = request.get_json()
    db_type = data.get('db_type', 'sqlite')
    host = data.get('host')
    user = data.get('user')
    password = data.get('password')
    database = data.get('database')
    port = data.get('port')

    success, message = connector.test_connection(db_type, host, port, user, password, database)
    return jsonify({'success': success, 'message': message}), 200

@connector_bp.route('/tables', methods=['POST'])
@handle_errors
def get_db_tables():
    data = request.get_json()
    tables = connector.get_tables(
        data.get('db_type'), data.get('host'), data.get('port'),
        data.get('user'), data.get('password'), data.get('database')
    )
    return jsonify({'success': True, 'tables': tables}), 200

@connector_bp.route('/sync', methods=['POST'])
@handle_errors
def sync_data():
    """
    Enterprise Data Sync Pipeline:
    1. Fetch data from external SQL
    2. Convert to CSV & Save to /data/raw/
    3. Update Dataset Metadata
    """
    data = request.get_json()
    dataset_name = data.get('dataset_name', 'external_sync')
    table_name = data.get('table_name')

    # ── Step 1: Fetch
    df = connector.fetch_data(
        data.get('db_type'), data.get('host'), data.get('port'),
        data.get('user'), data.get('password'), data.get('database'),
        table_name
    )

    if df.empty:
        raise APIError("External table is empty.", 400)

    # ── Step 2: Save to local storage (mimics upload)
    filename = f"{dataset_name}.csv"
    save_path = config.RAW_DATA_DIR / filename
    df.to_csv(save_path, index=False)

    # ── Step 3: Register in MongoDB
    db.save_dataset_info(
        dataset_id=dataset_name,
        file_name=filename,
        file_type='csv',
        uploaded_by='Admin Connector'
    )
    
    # ── Step 4: Real-time Event Logging
    db.log_sync_event(
        connector_id=dataset_name,
        table=table_name,
        status='Success',
        rows=len(df)
    )

    return jsonify({
        'success': True,
        'message': f'Successfully synced {len(df)} rows from {table_name}',
        'dataset_id': dataset_name
    }), 200

@connector_bp.route('/history', methods=['GET'])
@handle_errors
def get_history():
    history = db.get_sync_history()
    return jsonify({'success': True, 'history': history}), 200

@connector_bp.route('/schedule', methods=['POST'])
@handle_errors
def update_schedule():
    data = request.get_json()
    connector_id = data.get('connector_id', 'global_sync')
    schedule = {
        'frequency': data.get('frequency'),
        'time': data.get('time'),
        'target': data.get('target', 'Sales Ledger')
    }
    db.update_connector_schedule(connector_id, schedule)
    return jsonify({'success': True, 'message': 'Schedule saved to MongoDB.'}), 200

@connector_bp.route('/webhook', methods=['POST'])
@handle_errors
def webhook_listener():
    """
    Unified Webhook Hub (Shopify/WooCommerce).
    Demonstrates Instant Data Ingestion.
    """
    source = request.args.get('source', 'unknown')
    data = request.get_json()
    
    # ── Step 1: Real-time Processing
    dataset_id = db.process_webhook_event(source, data)
    
    # ── Step 2: Immediate File Feed (Mocking File Write)
    # We create a dummy CSV if it doesn't exist to satisfy the ML modules.
    save_path = config.RAW_DATA_DIR / f"{dataset_id}.csv"
    if not os.path.exists(save_path):
        # Create a sample orders file
        df = pd.DataFrame({
            'Order_ID': [data.get('id', '1234')],
            'Customer': [data.get('customer', 'Jane Doe')],
            'Amount': [data.get('total_price', 99.99)],
            'Timestamp': [pd.Timestamp.now()]
        })
        df.to_csv(save_path, index=False)
    
    return jsonify({
        'success': True, 
        'message': f'Live Webhook Event processed from {source.capitalize()}',
        'dataset_id': dataset_id
    }), 200

@connector_bp.route('/setup-sample', methods=['POST'])
@handle_errors
def setup_sample_db():
    """Create a sample ERP SQLite database for the FYP demo."""
    db_path = config.BASE_DIR / 'erp_sample.db'
    conn = sqlite3.connect(db_path)
    
    # Create a Sample Sales Table
    sales_data = pd.DataFrame({
        'Order_ID': range(1001, 1101),
        'Customer_ID': [f'CUST-{i}' for i in range(1, 101)],
        'Product': ['Smartphone', 'Laptop', 'Headphones', 'Tablet'] * 25,
        'Quantity': [1, 2, 1, 3] * 25,
        'Price': [500, 1200, 150, 400] * 25,
        'Date': pd.date_range(start='2024-01-01', periods=100)
    })
    sales_data.to_sql('sales_ledger', conn, if_exists='replace', index=False)
    
    # Create a Sample Inventory Table
    inventory_data = pd.DataFrame({
        'Product': ['Smartphone', 'Laptop', 'Headphones', 'Tablet'],
        'Stock': [50, 20, 100, 35],
        'Category': ['Electronics'] * 4
    })
    inventory_data.to_sql('warehouse_stock', conn, if_exists='replace', index=False)
    
    conn.close()
    return jsonify({
        'success': True, 
        'message': 'Sample ERP database (erp_sample.db) created successfully.',
        'path': str(db_path)
    }), 200
