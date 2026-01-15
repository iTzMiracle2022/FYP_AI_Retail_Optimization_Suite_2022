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
    
    # Configure CORS with explicit headers allowed
    CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS, "allow_headers": ["Content-Type", "Authorization", "X-User-Role", "X-User-Email"]}})

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

    return app

app = create_app()

if __name__ == '__main__':
    print("="* 50)
    print(f"🚀 {config.APP_NAME} - Backend")
    print("="* 50)
    print(f"🌐 Server: http://{config.HOST}:{config.PORT}")
    print("="* 50)
    
    app.run(debug=config.DEBUG, port=config.PORT, host=config.HOST)
