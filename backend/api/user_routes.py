from flask import Blueprint, jsonify, request, url_for
from datetime import datetime, timezone
from database.mongodb_helper import db
from utils.auth_utils import hash_password, check_password, generate_token, verify_token, verify_google_token, generate_auth_token
from utils.audit_logger import log_activity
from flask_mail import Message
from extensions import mail
from config import config

user_bp = Blueprint('user_routes', __name__, url_prefix='/api/users', static_folder=None)
user_bp.strict_slashes = False

def send_verification_email(email, name):
    """Refactored helper to ensure consistency across all signup paths."""
    token = generate_token(email)
    verify_url = f"{config.FRONTEND_URL}/verify/{token}"
    
    msg = Message("Verify Your Retail AI Account", recipients=[email])
    msg.body = f"Hello {name},\n\nWelcome to the AI Retail Optimization Suite!\n\nPlease verify your account by clicking: {verify_url}"
    
    try:
        mail.send(msg)
        return True
    except Exception as e:
        print(f"📧 Mail Error: {e}")
        return False

@user_bp.route('/signup', methods=['POST'])
def signup():
    """Register a new user or activate an invited one."""
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not all([name, email, password]):
        return jsonify({'success': False, 'message': 'All fields are required'}), 400

    try:
        existing_user = db.get_user(email)
        
        # Scenario: Pre-authorized/Invited User
        if existing_user and not existing_user.get('is_verified'):
            db.activate_user(email, name, hash_password(password))
            send_verification_email(email, name)
            
            return jsonify({
                'success': True,
                'message': 'Account activation started. Please check your email for the verification link.'
            })

        # Scenario: Completely New User
        if not existing_user:
            total_users = len(db.get_all_users())
            role = 'Manager' if total_users == 0 else 'Viewer'
            
            db.create_user(name, email, role, is_verified=False)
            db.activate_user(email, name, hash_password(password))
            
            send_verification_email(email, name)
            return jsonify({'success': True, 'message': 'Registered! Please check your email to verify your account.'})

        return jsonify({'success': False, 'message': 'Email already registered and active.'}), 400

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@user_bp.route('/verify/<token>', methods=['GET'])
def verify_email(token):
    """Confirm email and activate account."""
    email = verify_token(token)
    if not email:
        return jsonify({'success': False, 'message': 'Invalid or expired token'}), 400
    
    db.users.update_one({'email': email}, {'$set': {'is_verified': True}})
    return jsonify({'success': True, 'message': 'Email verified! You can now login.'})

@user_bp.route('/login', methods=['POST'])
def login():
    """Authenticate with email and password."""
    data = request.json or {}
    email = data.get('email')
    password = data.get('password')

    user = db.get_user(email)
    if not user:
        log_activity(email, "anonymous", "auth.login", status="FAILED", details={"reason": "User not found"})
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    if not user.get('password_hash'):
        log_activity(email, user.get('role', 'Customer'), "auth.login", status="FAILED", details={"reason": "Account not activated"})
        return jsonify({'success': False, 'message': 'Account not activated. Please complete registration.'}), 401

    if not user.get('is_verified'):
        log_activity(email, user.get('role', 'Customer'), "auth.login", status="FAILED", details={"reason": "Email not verified"})
        return jsonify({'success': False, 'message': 'Email not verified. Please check your inbox to activate your account.'}), 401

    if check_password(password, user.get('password_hash')):
        # Update last login (UTC Aware)
        db.users.update_one({'email': email}, {'$set': {'last_login': datetime.now(timezone.utc)}})
        
        # Log success
        user_role = user.get('role', 'Customer')
        log_activity(email, user_role, "auth.login", status="SUCCESS")
        
        # Generate token and set HTTP-only cookie
        token = generate_auth_token(email, user_role)
        is_secure = not config.DEBUG
        
        response = jsonify({'success': True, 'user': user})
        response.set_cookie(
            'auth_token',
            token,
            httponly=True,
            secure=is_secure,
            samesite='Lax'
        )
        return response
    
    log_activity(email, user.get('role', 'Customer'), "auth.login", status="FAILED", details={"reason": "Invalid password"})
    return jsonify({'success': False, 'message': 'Invalid password'}), 401

@user_bp.route('/google-login', methods=['POST'])
def google_login():
    """Seamless Google OAuth2 login with auto-onboarding."""
    token_id = request.json.get('token')
    user_info = verify_google_token(token_id)
    
    if not user_info:
        log_activity("unknown", "anonymous", "auth.google_login", status="FAILED", details={"reason": "Invalid Google Token"})
        return jsonify({'success': False, 'message': 'Invalid Google Token'}), 401
    
    email = user_info['email']
    user = db.get_user(email)
    
    # If user doesn't exist, create a shadow record
    if not user:
        total_users = len(db.get_all_users())
        role = 'Manager' if total_users == 0 else 'Viewer'
        db.create_user(user_info['name'], email, role, is_verified=True)
        db.users.update_one({'email': email}, {'$set': {'activated_at': datetime.now(timezone.utc)}})
        user = db.get_user(email)

    # Check if this Google user has set a password yet
    user_record = db.users.find_one({'email': email})
    if not user_record.get('password_hash'):
        return jsonify({
            'success': True, 
            'requires_password': True, 
            'email': email,
            'name': user_info['name']
        })

    # Check if verified (unless it's the first time and requires setup)
    if not user.get('is_verified'):
        log_activity(email, user.get('role', 'Customer'), "auth.google_login", status="FAILED", details={"reason": "Email not verified"})
        return jsonify({
            'success': False, 
            'message': 'Email not verified. Please check your inbox to activate your account.',
            'requires_verification': True
        }), 401

    # Update last login and return full user
    db.users.update_one({'email': email}, {'$set': {'last_login': datetime.now(timezone.utc)}})
    user = db.get_user(email)
    
    # Log success
    user_role = user.get('role', 'Customer')
    log_activity(email, user_role, "auth.google_login", status="SUCCESS")
    
    # Generate token and set HTTP-only cookie
    token = generate_auth_token(email, user_role)
    is_secure = not config.DEBUG
    
    response = jsonify({'success': True, 'user': user})
    response.set_cookie(
        'auth_token',
        token,
        httponly=True,
        secure=is_secure,
        samesite='Lax'
    )
    return response

@user_bp.route('/logout', methods=['POST'])
def logout():
    """Invalidate session and clear secure cookies."""
    user_email = request.headers.get('X-User-Email')
    user_role = request.headers.get('X-User-Role')
    
    log_activity(user_email, user_role, "auth.logout", status="SUCCESS")
    
    response = jsonify({'success': True, 'message': 'Logged out successfully'})
    response.delete_cookie('auth_token')
    return response

@user_bp.route('/google-setup', methods=['POST'])
def google_setup():
    """Complete registration by setting a password for Google-authenticated users."""
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'success': False, 'message': 'Password is required'}), 400
        
    user = db.get_user(email)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
        
    # Update password but KEEP is_verified as False until they click the email link
    hashed = hash_password(password)
    db.users.update_one(
        {'email': email}, 
        {'$set': {
            'password_hash': hashed, 
            'is_verified': False, 
            'last_login': datetime.now(timezone.utc)
        }}
    )
    
    # Return success but NOT the user object to prevent auto-login
    send_verification_email(email, user['name'])
    return jsonify({'success': True, 'message': 'Account setup complete! Please check your email to verify and activate your account.'})

@user_bp.route('/', methods=['GET'])
def get_users():
    """List all registered team members."""
    try:
        # Use helper to ensure proper JSON serialization of datetimes
        users = db.get_all_users()
        # Remove sensitive data
        for u in users:
            u.pop('password_hash', None)
        return jsonify({'success': True, 'users': users})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@user_bp.route('/update-role', methods=['POST'])
def update_role():
    """Modify a user's access level."""
    data = request.json
    email = data.get('email')
    new_role = data.get('role')
    
    if not email or not new_role:
        return jsonify({'success': False, 'message': 'Email and role required'}), 400
        
    requester_role = request.headers.get('X-User-Role')
    requester_email = request.headers.get('X-User-Email', 'Unknown')
    
    if requester_role != 'Manager':
        db.create_approval_request('UPDATE_ROLE', {'email': email, 'role': new_role}, requester_email)
        return jsonify({'success': True, 'message': 'Update role request sent to Manager for approval.', 'pending': True})
        
    db.users.update_one({'email': email}, {'$set': {'role': new_role}})
    return jsonify({'success': True, 'message': f'Role updated to {new_role}'})

@user_bp.route('/add', methods=['POST'])
def add_user():
    """Pre-authorize a new team member (Invite)."""
    data = request.json
    name = data.get('name')
    email = data.get('email')
    role = data.get('role', 'Viewer')
    
    if not name or not email:
        return jsonify({'success': False, 'message': 'Name and email required'}), 400
        
    if db.get_user(email):
        return jsonify({'success': False, 'message': 'User already exists'}), 400
        
    requester_role = request.headers.get('X-User-Role')
    requester_email = request.headers.get('X-User-Email', 'Unknown')
    
    if requester_role != 'Manager':
        db.create_approval_request('ADD_USER', {'name': name, 'email': email, 'role': role}, requester_email)
        return jsonify({'success': True, 'message': f'Invite request for {name} sent to Manager for approval.', 'pending': True})
        
    # This creates a "shadow" user that will be activated when they sign up
    db.create_user(name, email, role, is_verified=False)

    # 📧 Send Invitation Email
    try:
        portal_url = f"{config.FRONTEND_URL}/"
        msg = Message("Invitation to AI Retail Optimization Suite", recipients=[email])
        msg.body = f"Hello {name},\n\nYou have been invited to join the AI Retail Optimization Suite as a {role}.\n\nAccess your enterprise portal here: {portal_url}\n\nWelcome to the team!"
        mail.send(msg)
    except Exception as e:
        print(f"Invite email failed: {e}")

    return jsonify({'success': True, 'message': f'User {name} pre-authorized as {role}. Invitation sent!'})

@user_bp.route('/<email>', methods=['DELETE'])
def delete_user(email):
    """Remove a user from the system."""
    requester_role = request.headers.get('X-User-Role')
    requester_email = request.headers.get('X-User-Email', 'Unknown')
    
    if requester_role != 'Manager':
        db.create_approval_request('DELETE_USER', {'email': email}, requester_email)
        return jsonify({'success': True, 'message': f'Delete request for {email} sent to Manager for approval.', 'pending': True})
        
    try:
        db.users.delete_one({'email': email})
        return jsonify({'success': True, 'message': f'User {email} removed.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@user_bp.route('/approvals', methods=['GET'])
def get_approvals():
    """Get all pending approvals (Manager only)."""
    requester_role = request.headers.get('X-User-Role')
    if requester_role != 'Manager':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
    return jsonify({'success': True, 'approvals': db.get_pending_approvals()})

@user_bp.route('/approve', methods=['POST'])
def approve_request():
    data = request.json
    request_id = data.get('request_id')
    requester_role = request.headers.get('X-User-Role')
    requester_email = request.headers.get('X-User-Email', 'System')
    
    if requester_role != 'Manager':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    req = db.get_approval_request(request_id)
    if not req or req['status'] != 'pending':
        return jsonify({'success': False, 'message': 'Request not found or already resolved.'}), 400
        
    try:
        if req['type'] == 'ADD_USER':
            db.create_user(req['payload']['name'], req['payload']['email'], req['payload']['role'], is_verified=False)
            try:
                portal_url = f"{config.FRONTEND_URL}/"
                msg = Message("Invitation to AI Retail Optimization Suite", recipients=[req['payload']['email']])
                msg.body = f"Hello {req['payload']['name']},\n\nYou have been invited to join the AI Retail Optimization Suite as a {req['payload']['role']}.\n\nAccess your enterprise portal here: {portal_url}\n\nWelcome to the team!"
                mail.send(msg)
            except Exception as e:
                pass
        elif req['type'] == 'UPDATE_ROLE':
            db.users.update_one({'email': req['payload']['email']}, {'$set': {'role': req['payload']['role']}})
        elif req['type'] == 'DELETE_USER':
            db.users.delete_one({'email': req['payload']['email']})
        elif req['type'] == 'DELETE_DATASET':
            from database.mongodb_helper import db as mdb
            mdb.datasets.delete_one({'dataset_id': req['payload']['dataset_id']})
            mdb.predictions.delete_many({'dataset_id': req['payload']['dataset_id']})
            mdb.reports.delete_many({'dataset_id': req['payload']['dataset_id']})
            
        db.update_approval_status(request_id, 'approved', requester_email)
        return jsonify({'success': True, 'message': 'Request approved successfully.'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@user_bp.route('/reject', methods=['POST'])
def reject_request():
    data = request.json
    request_id = data.get('request_id')
    requester_role = request.headers.get('X-User-Role')
    requester_email = request.headers.get('X-User-Email', 'System')
    
    if requester_role != 'Manager':
        return jsonify({'success': False, 'message': 'Unauthorized'}), 403
        
    db.update_approval_status(request_id, 'rejected', requester_email)
    return jsonify({'success': True, 'message': 'Request rejected.'})

@user_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Send a password reset email."""
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'success': False, 'message': 'Email is required'}), 400
        
    user = db.get_user(email)
    if not user:
        # Prevent email enumeration by returning a generic success message
        return jsonify({'success': True, 'message': 'If your email is registered, you will receive a reset link shortly.'})
        
    token = generate_token(email, salt="password-reset")
    reset_url = f"{config.FRONTEND_URL}/reset-password/{token}"
    
    msg = Message("Reset Your Password - AI Retail Optimization Suite", recipients=[email])
    msg.body = f"Hello {user.get('name', 'User')},\n\nWe received a request to reset your password.\n\nPlease set a new password by clicking the link below:\n{reset_url}\n\nIf you did not request this, please ignore this email.\n\nBest,\nRetail AI Team"
    
    try:
        mail.send(msg)
        return jsonify({'success': True, 'message': 'If your email is registered, you will receive a reset link shortly.'})
    except Exception as e:
        print(f"📧 Mail Error: {e}")
        return jsonify({'success': False, 'message': 'Failed to send reset email. Please try again later.'}), 500

@user_bp.route('/reset-password/<token>', methods=['POST'])
def reset_password(token):
    """Reset the password using a valid token."""
    data = request.json
    password = data.get('password')
    
    if not password:
        return jsonify({'success': False, 'message': 'New password is required'}), 400
        
    email = verify_token(token, salt="password-reset")
    if not email:
        return jsonify({'success': False, 'message': 'Invalid or expired token. Please request a new reset link.'}), 400
        
    user = db.get_user(email)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
        
    hashed = hash_password(password)
    db.users.update_one({'email': email}, {'$set': {'password_hash': hashed}})
    
    return jsonify({'success': True, 'message': 'Password has been reset successfully! You can now log in.'})

