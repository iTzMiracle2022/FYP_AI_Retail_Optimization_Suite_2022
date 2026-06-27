from database.mongodb_helper import db
from datetime import datetime, timezone
from flask import request

def log_activity(user_email, user_role, action, status="SUCCESS", details=None):
    """Safely log important user actions to the MongoDB audit_logs collection."""
    try:
        ip_address = "unknown"
        user_agent = "unknown"
        
        # Access Flask request context if available
        if request:
            try:
                if request.headers.get('X-Forwarded-For'):
                    ip_address = request.headers.get('X-Forwarded-For').split(',')[0].strip()
                else:
                    ip_address = request.remote_addr or "unknown"
                user_agent = request.headers.get('User-Agent', 'unknown')
            except Exception:
                pass
                
        log_doc = {
            "user_email": user_email or "anonymous",
            "user_role": user_role or "anonymous",
            "action": action,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": status,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc)
        }
        db.db.audit_logs.insert_one(log_doc)
    except Exception as e:
        # Prevent logging errors from interrupting main application thread
        print(f"⚠️ Failed to write audit log to database: {e}")
