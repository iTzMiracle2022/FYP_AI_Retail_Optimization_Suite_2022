"""
Custom error handling for the API
"""
from flask import jsonify
from functools import wraps
import traceback

class APIError(Exception):
    """Custom API Exception"""
    def __init__(self, message, status_code=400):
        super().__init__()
        self.message = message
        self.status_code = status_code

    def to_dict(self):
        return {
            'success': False,
            'error': self.message
        }

def handle_errors(f):
    """
    Decorator to catch errors in route functions
    Usage: @handle_errors
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except APIError as e:
            return jsonify(e.to_dict()), e.status_code
        except Exception as e:
            msg = str(e)
            print(f"❌ Unexpected error Traceback:")
            print(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': f"Internal server error: {msg}"
            }), 500
    
    return decorated_function