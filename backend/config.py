"""
Configuration settings for the application
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from the project root
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

class Config:
    """Base configuration"""
    
    # Application Info
    APP_NAME = os.getenv("APP_NAME", "AI Retail Optimization Suite")
    VERSION = "1.0.0"
    DEBUG = os.getenv("DEBUG", "True") == "True"
    
    # Server Settings
    HOST = '0.0.0.0'
    PORT = int(os.getenv("PORT", 5000))
    
    # MongoDB Configuration
    MONGODB_URI = os.getenv("MONGODB_URI", 'mongodb://localhost:27017/')
    MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", 'retail_ai_db')
    
    # File Paths
    BASE_DIR = Path(__file__).parent
    DATA_DIR = BASE_DIR / 'data'
    RAW_DATA_DIR = DATA_DIR / 'raw'
    PROCESSED_DATA_DIR = DATA_DIR / 'processed'
    
    # ML Model Settings
    CHURN_MODEL_ACCURACY_THRESHOLD = 0.70
    INVENTORY_FORECAST_DAYS_DEFAULT = 30
    MARKETING_CLUSTERS_DEFAULT = 4
    
    # API Settings
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16 MB
    ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}
    
    CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://192.168.100.19:3000', 'http://localhost:5173']

    # 🔗 Security & Auth (REAL World)
    SECRET_KEY = os.getenv("SECRET_KEY", "RetailAISuite_Secret_Default_Core")
    BCRYPT_LOG_ROUNDS = 12
    JWT_EXPIRATION_HOURS = 24
    
    # 📧 SMTP Mail Settings (Flask-Mail)
    MAIL_SERVER = os.getenv("MAIL_SERVER", 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv("MAIL_PORT", 587))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", 'True') == 'True'
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", '') 
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", '') 
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", 'no-reply@retail-ai.com')

    # 🌐 Google OAuth2
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "") 
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    @staticmethod
    def init_directories():
        """Create necessary directories with parent support"""
        Config.DATA_DIR.mkdir(parents=True, exist_ok=True)
        Config.RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        Config.PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
        print("✅ System directories initialized")

# Export config
config = Config