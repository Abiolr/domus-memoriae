from flask import Flask, request, jsonify, session
from flask_cors import CORS
import os
import secrets
from datetime import datetime, timedelta
from functools import wraps
from bson import ObjectId
from dotenv import load_dotenv
from database import Database

load_dotenv()

app = Flask(__name__)

# ============================================================================
# Configuration & CORS
# ============================================================================

# Explicitly define the frontend URL for CORS and Cookie trust
FRONTEND_URL = "http://localhost:5173" 

CORS(app, 
     supports_credentials=True, 
     origins=[FRONTEND_URL],
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# --- SESSION & COOKIE CONFIGURATION ---
# These settings allow the session cookie to persist across different ports on localhost
app.config.update(
    SESSION_COOKIE_SECURE=False,   # Must be False for HTTP (Localhost)
    SESSION_COOKIE_HTTPONLY=True,  # Prevents JS access to the session cookie
    SESSION_COOKIE_SAMESITE='Lax', # Allows the cookie to be sent during cross-origin POSTs
    SESSION_COOKIE_DOMAIN='localhost',  # Explicit domain for localhost
    SESSION_COOKIE_PATH='/',  # Cookie valid for all paths
    PERMANENT_SESSION_LIFETIME=timedelta(days=7)
)

try:
    db = Database()
    print("✅ Database initialized successfully")
except Exception as e:
    print(f"❌ Database initialization failed: {e}")
    db = None

# ============================================================================
# Helpers & Middleware
# ============================================================================

def stringify_ids(obj):
    """Recursively converts MongoDB ObjectIds to strings for JSON responses."""
    if isinstance(obj, list):
        return [stringify_ids(item) for item in obj]
    if isinstance(obj, dict):
        return {k: stringify_ids(v) for k, v in obj.items()}
    if isinstance(obj, ObjectId):
        return str(obj)
    return obj

def login_required(f):
    """Protects routes by checking for user_id in session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        
        # Debug logging
        print(f"[DEBUG] Session data: {dict(session)}")
        print(f"[DEBUG] Cookies: {request.cookies}")
        
        if 'user_id' not in session:
            print(f"[DEBUG] No user_id in session - returning 401")
            return jsonify({"error": "Authentication required"}), 401
        
        print(f"[DEBUG] Authenticated as user_id: {session['user_id']}")
        return f(*args, **kwargs)
    return decorated_function

# ============================================================================
# Auth Routes (WebAuthn / Passkeys)
# ============================================================================

@app.route('/api/auth/register/begin', methods=['POST', 'OPTIONS'])
def register_begin():
    if request.method == 'OPTIONS': return '', 204
    data = request.json
    email = data.get('email', '').lower()
    
    if db.users.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400

    session['reg_data'] = data
    challenge = secrets.token_urlsafe(32)
    session['challenge'] = challenge
    
    return jsonify({
        "challenge": challenge,
        "rp": {"name": "Domus Memoriae", "id": "localhost"},
        "user": {"id": secrets.token_urlsafe(16), "name": email, "displayName": data.get('firstName')},
        "pubKeyCredParams": [{"alg": -7, "type": "public-key"}],
        "authenticatorSelection": {"authenticatorAttachment": "platform"},
        "timeout": 60000,
        "attestation": "none"
    })

@app.route('/api/auth/register/complete', methods=['POST', 'OPTIONS'])
def register_complete():
    if request.method == 'OPTIONS': return '', 204
    reg_data = session.get('reg_data')
    if not reg_data:
        return jsonify({"error": "Registration session expired"}), 400
    
    # Use database.py's create_user method
    ok, msg, user = db.create_user(
        email=reg_data['email'],
        phone=reg_data['phone'],
        first_name=reg_data['firstName'],
        last_name=reg_data['lastName'],
        dob=reg_data['dateOfBirth'],
        legal_middle_names=reg_data.get('middleNames'),
        suffix=reg_data.get('suffix'),
        maiden_birth_name=reg_data.get('maidenName'),
        preferred_name=reg_data.get('preferredName'),
        place_of_birth={
            "city": reg_data.get('birthCity'),
            "province_state": reg_data.get('birthState'),
            "country": reg_data.get('birthCountry')
        }
    )
    
    if not ok: return jsonify({"error": msg}), 400

    session.pop('reg_data', None)
    session['user_id'] = str(user['_id'])
    session.permanent = True
    
    print(f"[DEBUG] User registered: {session['user_id']}, permanent={session.permanent}")
    return jsonify({"success": True})

@app.route('/api/auth/login/begin', methods=['POST', 'OPTIONS'])
def login_begin():
    if request.method == 'OPTIONS': return '', 204
    email = request.json.get('email', '').lower()
    user = db.get_user_by_email(email)
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    challenge = secrets.token_urlsafe(32)
    session['challenge'] = challenge
    session['login_email'] = email
    
    return jsonify({
        "challenge": challenge,
        "rpId": "localhost",
        "allowCredentials": [] 
    })

@app.route('/api/auth/login/complete', methods=['POST', 'OPTIONS'])
def login_complete():
    if request.method == 'OPTIONS': return '', 204
    email = session.get('login_email')
    user = db.get_user_by_email(email)
    
    if not user:
        return jsonify({"error": "Login failed"}), 401
        
    session['user_id'] = str(user['_id'])
    session.permanent = True  # Make session persistent like registration
    session.pop('login_email', None)
    
    print(f"[DEBUG] User logged in: {session['user_id']}, permanent={session.permanent}")
    return jsonify({"success": True})

@app.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
def logout():
    if request.method == 'OPTIONS': return '', 204
    session.clear()
    return jsonify({"success": True})

@app.route('/api/auth/check', methods=['GET', 'OPTIONS'])
def check_auth():
    """Debug endpoint to check authentication status"""
    if request.method == 'OPTIONS': return '', 204
    return jsonify({
        "authenticated": 'user_id' in session,
        "user_id": session.get('user_id'),
        "session_data": dict(session)
    })

# ============================================================================
# Vault Routes
# ============================================================================

@app.route('/api/vault/create', methods=['POST', 'OPTIONS'])
@login_required
def create_vault():
    if request.method == 'OPTIONS': return '', 204
    data = request.json
    ok, msg, vault = db.create_vault(
        acting_user_id=session['user_id'],
        name=data.get('vaultName'),
        description=data.get('description')
    )
    if not ok: return jsonify({"error": msg}), 400
    return jsonify(stringify_ids({"id": vault['_id'], "success": True}))

@app.route('/api/vault/join', methods=['POST', 'OPTIONS'])
@login_required
def join_vault():
    """Join an existing vault using the invitation code."""
    if request.method == 'OPTIONS': return '', 204
    data = request.json or {}
    
    # Extract the code (handles both potential frontend key names)
    code = (data.get('code') or data.get('vaultCode') or '').strip().upper()
    
    if not code:
        return jsonify({"error": "Invitation code is required"}), 400

    # Call database.py using explicit keyword arguments as required by its signature
    ok, msg, vault = db.join_vault_by_code(
        acting_user_id=session['user_id'], 
        join_code=code
    )
    
    if not ok:
        return jsonify({"error": msg}), 400

    return jsonify(stringify_ids({
        "success": True,
        "vault": {
            "id": vault['_id'],
            "name": vault.get('name')
        }
    }))

@app.route('/api/vaults', methods=['GET', 'OPTIONS'])
@login_required
def get_my_vaults():
    if request.method == 'OPTIONS': return '', 204
    vaults = db.get_vaults_for_user(session['user_id'])
    return jsonify(stringify_ids(vaults))

@app.route('/api/vaults/<vault_id>', methods=['GET', 'OPTIONS'])
@login_required
def get_vault_details(vault_id):
    if request.method == 'OPTIONS': return '', 204
    try:
        # Check membership and return details
        vault = db.vaults.find_one({
            "_id": ObjectId(vault_id), 
            "members.user_id": ObjectId(session['user_id'])
        })
        if not vault: return jsonify({"error": "Vault not found"}), 404
        
        return jsonify(stringify_ids({
            "id": vault['_id'],
            "name": vault.get('name'),
            "joinCode": vault.get('join_code'),
            "resilienceScore": vault.get('resilience_score', 85),
            "members": vault.get('members', [])
        }))
    except:
        return jsonify({"error": "Invalid vault ID"}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)