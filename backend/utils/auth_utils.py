import jwt
from datetime import datetime, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from config import config
from extensions import bcrypt

def hash_password(password):
    """Securely hash a password for database storage."""
    return bcrypt.generate_password_hash(password).decode('utf-8')

def check_password(password, hashed):
    """Verify a plain-text password against a stored hash."""
    return bcrypt.check_password_hash(hashed, password)

def generate_token(email, salt="email-verification"):
    """Generate a JWT token for email verification or password reset."""
    payload = {
        'email': email,
        'salt': salt,
        'exp': datetime.utcnow() + timedelta(hours=config.JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm='HS256')

def verify_token(token, salt="email-verification"):
    """Validate a JWT token and extract the email."""
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=['HS256'])
        if payload.get('salt') != salt:
            return None
        return payload.get('email')
    except jwt.ExpiredSignatureError:
        return None # Token expired
    except jwt.InvalidTokenError:
        return None # Invalid token

def verify_google_token(token_id):
    """Verify a Google OAuth2 ID Token."""
    try:
        if not config.GOOGLE_CLIENT_ID:
            print("⚠️ Google Client ID not configured in .env. Falling back to dev-simulation.")
            return {"email": "simulated_user@gmail.com", "name": "Google User (Dev Sim)"}

        idinfo = id_token.verify_oauth2_token(token_id, google_requests.Request(), config.GOOGLE_CLIENT_ID)
        
        # ID token is valid. Get user's Google ID, name, email.
        return {
            "email": idinfo['email'],
            "name": idinfo.get('name', 'Google User'),
            "picture": idinfo.get('picture', '')
        }
    except ValueError:
        # Invalid token
        return None

def generate_auth_token(email, role):
    """Generate a JWT token representing the user's active session."""
    payload = {
        'email': email,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=2) # 2 hours session expiry
    }
    return jwt.encode(payload, config.SECRET_KEY, algorithm='HS256')

def verify_auth_token(token):
    """Decode and verify a JWT session auth token."""
    try:
        return jwt.decode(token, config.SECRET_KEY, algorithms=['HS256'])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

