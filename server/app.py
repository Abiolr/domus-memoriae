from flask import Flask, request, jsonify, session
from flask_cors import CORS
import os
import secrets
import base64
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

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

CORS(app, 
     supports_credentials=True,
     origins=[FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173'],
     allow_headers=['Content-Type'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('FLASK_ENV') == 'production'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

try:
    db = Database()
    print("✅ Database initialized successfully")
except Exception as e:
    print(f"❌ Database initialization failed: {e}")
    db = None

challenges = {}

# ============================================================================
# Helpers & Middleware
# ============================================================================

def stringify_ids(obj):
    """Recursively converts MongoDB ObjectIds to strings."""
    if isinstance(obj, list):
        return [stringify_ids(item) for item in obj]
    if isinstance(obj, dict):
        return {k: stringify_ids(v) for k, v in obj.items()}
    if isinstance(obj, ObjectId):
        return str(obj)
    return obj

def cleanup_old_challenges():
    cutoff = datetime.utcnow() - timedelta(minutes=5)
    to_delete = [k for k, v in challenges.items() if v['created_at'] < cutoff]
    for k in to_delete:
        del challenges[k]

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            return f(*args, **kwargs)
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function

# ============================================================================
# Auth Routes
# ============================================================================

@app.route('/api/auth/register/begin', methods=['POST', 'OPTIONS'])
def register_begin():
    if request.method == 'OPTIONS': return '', 204
    data = request.json
    email = data.get('email', '').strip().lower()
    if db.get_user_by_email(email): return jsonify({"error": "User exists"}), 409
    
    challenge_b64 = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
    temp_id = base64.urlsafe_b64encode(secrets.token_bytes(16)).decode('utf-8').rstrip('=')
    
    cleanup_old_challenges()
    challenges[challenge_b64] = {'email': email, 'user_data': data, 'created_at': datetime.utcnow(), 'type': 'registration'}
    
    return jsonify({
        "challenge": challenge_b64,
        "user": {"id": temp_id, "name": email, "displayName": data.get('firstName')},
        "rp": {"name": "Domus Memoriae", "id": "localhost"},
        # FIXED: Added both algorithms to satisfy browser warnings
        "pubKeyCredParams": [{"alg": -7, "type": "public-key"}, {"alg": -257, "type": "public-key"}],
        "authenticatorSelection": {"userVerification": "preferred"},
        "timeout": 60000, "attestation": "none"
    })

@app.route('/api/auth/register/complete', methods=['POST', 'OPTIONS'])
def register_complete():
    if request.method == 'OPTIONS': return '', 204
    data = request.json
    challenge, credential = data.get('challenge'), data.get('credential')
    if challenge not in challenges: return jsonify({"error": "Invalid challenge"}), 400
    
    user_data = challenges[challenge]['user_data']
    passkey = {"credential_id": credential.get('id'), "public_key": credential.get('response', {}).get('attestationObject')}
    
    success, msg, user = db.create_user(
        email=user_data['email'], phone=user_data['phone'], 
        first_name=user_data['firstName'], last_name=user_data['lastName'],
        dob=user_data['dateOfBirth'], passkey_credential=passkey
    )
    if not success: return jsonify({"error": msg}), 400
    
    session.permanent = True
    session['user_id'], session['email'] = str(user['_id']), user['email']
    return jsonify({"success": True})

@app.route('/api/auth/login/begin', methods=['POST', 'OPTIONS'])
def login_begin():
    if request.method == 'OPTIONS': return '', 204
    email = request.json.get('email', '').strip().lower()
    user = db.get_user_by_email(email)
    if not user: return jsonify({"error": "No account found"}), 401
    
    challenge_b64 = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')
    challenges[challenge_b64] = {'email': email, 'created_at': datetime.utcnow(), 'type': 'authentication'}
    
    return jsonify({
        "challenge": challenge_b64, "rpId": "localhost",
        "allowCredentials": [{"id": user['passkey_credential']['credential_id'], "type": "public-key"}]
    })

@app.route('/api/auth/login/complete', methods=['POST', 'OPTIONS'])
def login_complete():
    if request.method == 'OPTIONS': return '', 204
    data = request.json
    challenge = data.get('challenge')
    if challenge not in challenges: return jsonify({"error": "Invalid challenge"}), 400
    
    user = db.get_user_by_email(challenges[challenge]['email'])
    session.permanent = True
    session['user_id'], session['email'] = str(user['_id']), user['email']
    return jsonify({"success": True})

# ============================================================================
# Vault Routes
# ============================================================================

@app.route('/api/vaults', methods=['GET', 'OPTIONS'])
@login_required
def get_my_vaults():
    if request.method == 'OPTIONS': return '', 204
    user_id = session['user_id']
    vaults = list(db.vaults.find({"members.user_id": ObjectId(user_id)}))
    return jsonify(stringify_ids(vaults))

@app.route('/api/vaults/<vault_id>', methods=['GET', 'OPTIONS'])
@login_required
def get_vault_details(vault_id):
    if request.method == 'OPTIONS': return '', 204
    try:
        vid = ObjectId(vault_id)
        vault = db.vaults.find_one({"_id": vid, "members.user_id": ObjectId(session['user_id'])})
        if not vault: return jsonify({"error": "Vault not found"}), 404
        
        files = list(db.files.find({"vault_id": vid}))
        scores = [f.get('survivability_score', 80) for f in files]
        resilience = round(sum(scores) / len(scores)) if scores else 100
        
        return jsonify(stringify_ids({
            "name": vault['name'],
            "joinCode": vault.get('join_code'),
            "resilienceScore": resilience,
            "isAdmin": str(vault.get('admin_user_id')) == session['user_id'],
            "members": vault.get('members', [])
        }))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vault/create', methods=['POST', 'OPTIONS'])
@login_required
def create_vault():
    if request.method == 'OPTIONS': return '', 204
    name = request.json.get('vaultName')
    success, msg, vault = db.create_vault(acting_user_id=session['user_id'], name=name)
    if success: return jsonify({"id": str(vault['_id'])}), 201
    return jsonify({"error": msg}), 400

@app.route('/api/auth/logout', methods=['POST', 'OPTIONS'])
def logout():
    if request.method == 'OPTIONS': return '', 204
    session.clear()
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)