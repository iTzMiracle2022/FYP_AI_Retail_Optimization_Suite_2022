import os

# Compatibility fix: cuML RandomForest predict can fail with CuPy CUB/CCCL on this CUDA stack.
# Disabling CuPy accelerators keeps GPU RandomForest working without CPU fallback.
os.environ.setdefault("CUPY_ACCELERATORS", "")

from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from flask_bcrypt import Bcrypt
from config import config

# Import blueprints
from api.churn_routes import churn_bp
from api.inventory_routes import inventory_bp
from api.marketing_routes import marketing_bp
from api.dataset_routes import dataset_bp
from api.report_routes import report_bp
from api.sales_routes import sales_bp
from api.system_routes import system_bp
# from api.connector_routes import connector_bp
from api.user_routes import user_bp

# Import extensions
from extensions import mail, bcrypt

# Import seeder
from database.seeder import run_all_seeds

def create_app():
    """Application factory for a professional Flask structure"""
    app = Flask(__name__)
    
    # Configuration
    app.config.from_object(config)
    
    # Initialize Extensions with App
    mail.init_app(app)
    bcrypt.init_app(app)
    
    # Configure CORS with explicit headers allowed and credentials support
    CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS, "allow_headers": ["Content-Type", "Authorization", "X-User-Role", "X-User-Email"]}}, supports_credentials=True)

    # Initialize environment
    config.init_directories()
    run_all_seeds()

    # Register blueprints
    app.register_blueprint(churn_bp)
    app.register_blueprint(inventory_bp)
    app.register_blueprint(marketing_bp)
    app.register_blueprint(dataset_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(sales_bp)
    app.register_blueprint(system_bp)
    # app.register_blueprint(connector_bp)
    app.register_blueprint(user_bp)

    # Global authentication middleware
    from flask import request, jsonify
    from utils.auth_utils import verify_auth_token

    @app.before_request
    def check_auth_token():
        # Only intercept /api/ routes
        if not request.path.startswith('/api/'):
            return None

        # Allow OPTIONS request for CORS preflight
        if request.method == 'OPTIONS':
            return None

        # Public routes exemption
        public_endpoints = [
            '/api/users/login',
            '/api/users/register',
            '/api/users/google-login',
            '/api/users/google-setup',
            '/api/users/logout'
        ]
        if any(request.path.startswith(pe) for pe in public_endpoints) or request.path.startswith('/api/users/verify/'):
            return None

        # ── Developer Bypass Key Control ──
        dev_bypass_key = os.environ.get('DEV_BYPASS_KEY')
        client_bypass_key = request.headers.get('X-Dev-Bypass-Key')
        if dev_bypass_key and client_bypass_key == dev_bypass_key:
            return None # Bypass successfully granted

        # Verify secure HTTP-only auth token cookie
        token = request.cookies.get('auth_token')
        if not token:
            return jsonify({'success': False, 'message': 'Session token missing. Please login.'}), 401

        payload = verify_auth_token(token)
        if not payload:
            return jsonify({'success': False, 'message': 'Session invalid or expired. Please login again.'}), 401

        # Cross-verify user role and email headers with verified token content
        user_email = request.headers.get('X-User-Email')
        user_role = request.headers.get('X-User-Role')
        if payload.get('email') != user_email or payload.get('role') != user_role:
            return jsonify({'success': False, 'message': 'Session mismatch detected.'}), 401

        return None

    return app

app = create_app()

if __name__ == '__main__':
    print("="* 50)
    print(f"🚀 {config.APP_NAME} - Backend")
    print("="* 50)
    print(f"🌐 Server: http://{config.HOST}:{config.PORT}")
    print("="* 50)
    
    app.run(debug=config.DEBUG, port=config.PORT, host=config.HOST)
