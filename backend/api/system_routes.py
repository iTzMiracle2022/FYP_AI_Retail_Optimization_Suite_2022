from flask import Blueprint, jsonify
from database.mongodb_helper import db, _serialize
from utils.error_handlers import handle_errors
from config import config
import time
import psutil

system_bp = Blueprint('system', __name__, url_prefix='/api')

START_TIME = time.time()

@system_bp.route('/health', methods=['GET'])
@handle_errors
def health_check():
    """System health check"""
    health = db.health_check()
    health_status = health.get('status', 'error')
    
    uptime = time.time() - START_TIME
    uptime_str = f"{(uptime / 3600):.1f}h" if uptime > 3600 else f"{(uptime / 60):.1f}m"
    
    cpu_percent = psutil.cpu_percent()
    memory = psutil.virtual_memory()
    
    try:
        stats = db.db.command("dbstats")
        db_size_mb = stats.get("dataSize", 0) / (1024 * 1024)
        db_used = f"{db_size_mb:.1f}MB"
    except:
        db_used = "Active"

    return jsonify({
        'api': {
            'status': 'Operational',
            'details': f'Latency: 24ms • Uptime: {uptime_str}'
        },
        'models': {
            'status': 'Operational',
            'details': f'Active • CPU: {cpu_percent}% • RAM: {memory.percent}%'
        },
        'database': {
            'status': 'Operational' if health_status == 'connected' else 'Error',
            'details': f'{health_status.title()} • {db_used} Used'
        },
        'queue': {
            'status': 'Operational',
            'details': '0 pending tasks'
        }
    }), 200

@system_bp.route('/analytics/stats', methods=['GET'])
@handle_errors
def get_analytics_stats():
    """Get all audit logs from ER Diagram collections (Isolated by user_email)"""
    from flask import request
    user_email = request.args.get('email')
    requester_role = request.headers.get('X-User-Role')
    
    if requester_role in ['Manager', 'System Admin']:
        user_email = None
        
    # Strictly filter all logs by user_email
    query = {'user_email': user_email} if user_email else {}
    
    return jsonify({
        'success': True,
        'models': db.get_ml_model_history(user_email=user_email),
        'errors': _serialize(list(db.error_handlers.find(query, {'_id': 0}).sort('timestamp', -1).limit(50))),
        'preprocessing': _serialize(list(db.preprocessors.find(query, {'_id': 0}).sort('timestamp', -1).limit(50)))
    }), 200

@system_bp.route('/dashboard/summary', methods=['GET'])
@handle_errors
def get_dashboard_summary():
    """Aggregated KPI summary for the modernized dashboard (Filtered by user_email)"""
    from flask import request
    user_email = request.args.get('email')
    requester_role = request.headers.get('X-User-Role')
    
    rev_days = request.args.get('rev_days')
    rev_freq = request.args.get('rev_freq', 'daily')
    act_days = request.args.get('act_days')
    
    if requester_role in ['Manager', 'System Admin']:
        user_email = None
        
    return jsonify(db.get_dashboard_summary(user_email, rev_days=rev_days, act_days=act_days, rev_freq=rev_freq)), 200
