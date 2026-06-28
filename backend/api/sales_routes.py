from flask import Blueprint, request, jsonify
import pandas as pd
from database.mongodb_helper import db
from database.data_loader import DataLoader
from utils.error_handlers import handle_errors, APIError
from models.sales_analyzer import SalesAnalyzer

sales_bp = Blueprint('sales', __name__, url_prefix='/api/sales')
loader = DataLoader()
analyzer = SalesAnalyzer()


@sales_bp.route('/trends', methods=['POST'])
@handle_errors
def analyze_sales_trends():
    """Analyze Sales Trends (Isolated by user_email)"""
    data = request.get_json()
    if not data or 'dataset_id' not in data:
        raise APIError("dataset_id is required", 400)

    dataset_id = data['dataset_id']
    user_email = data.get('email')
    category_filter = data.get('category', None)
    time_period = data.get('time_period', 'all')

    # Load dataset (Isolated)
    requester_role = request.headers.get('X-User-Role')
    dataset_owner_email = None if requester_role and requester_role.lower() in ['manager', 'system admin', 'analyst', 'viewer'] else user_email
    db.get_dataset_info(dataset_id, dataset_owner_email)

    if requester_role == 'Viewer':
        existing_report = db.reports.find_one({'dataset_id': dataset_id, 'report_type': 'sales'})
        if existing_report:
            return jsonify({
                'success': True,
                'dataset_id': dataset_id,
                'user_email': user_email,
                'kpis': existing_report.get('kpis'),
                'charts': existing_report.get('charts'),
                'tables': existing_report.get('tables', {}),
                'category_filter': category_filter,
                'time_period': time_period
            }), 200
        else:
            return jsonify({'success': False, 'message': 'Unauthorized. Viewers cannot trigger fresh sales trend analysis.'}), 403

    df = loader.load_csv(dataset_id)

    # Run sales trend analysis
    try:
        results = analyzer.analyze(df, category_filter=category_filter, time_period=time_period)
    except ValueError as e:
        import json
        try:
            error_details = json.loads(str(e))
            return jsonify({'success': False, 'error': error_details}), 400
        except json.JSONDecodeError:
            raise APIError(str(e), 400)

    # Log to MongoDB (Isolated)
    db._save_report(
        dataset_id, 
        'sales', 
        user_email=user_email, 
        kpis=results['kpis'], 
        category_breakdown=results['charts']['revenue_by_category'],
        charts=results['charts']
    )
    db.update_dataset_status(dataset_id, 'analyzed', user_email=user_email)

    return jsonify({
        'success': True,
        'dataset_id': dataset_id,
        'user_email': user_email,
        'kpis': results['kpis'],
        'charts': results['charts'],
        'tables': results['tables'],
        'metadata': results['metadata'],
    }), 200


@sales_bp.route('/categories/<string:dataset_id>', methods=['GET'])
@handle_errors
def get_categories(dataset_id):
    """Get unique product categories (Isolated by user_email)."""
    user_email = request.args.get('email')
    db.get_dataset_info(dataset_id, user_email)
    df = loader.load_csv(dataset_id)

    # Smart Category Resolution
    cat_pattern = ['category', 'group', 'type', 'segment', 'department', 'education', 'marital']
    cat_col = next((c for c in df.columns if any(p in c.lower() for p in cat_pattern)), None)

    if not cat_col:
        return jsonify({'success': True, 'categories': []}), 200

    categories = sorted(df[cat_col].dropna().unique().tolist())
    return jsonify({'success': True, 'categories': categories}), 200
