from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
import os
import secrets
from datetime import datetime, timedelta
from functools import wraps
from bson import ObjectId
from dotenv import load_dotenv
from database import Database, extract_pdf_metadata, calculate_metadata_score, calculate_access_risk_score
import hashlib
import uuid
from werkzeug.utils import secure_filename
import pickle
import pandas as pd
import magic

load_dotenv()

app = Flask(__name__)

# ============================================================================
# Load ML Model for Survivability Prediction
# ============================================================================

ML_MODEL = None
MODEL_PATH = os.environ.get('MODEL_PATH', 'model.pkl')

try:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            ML_MODEL = pickle.load(f)
        print(f"✅ ML model loaded from {MODEL_PATH}")
    else:
        print(f"⚠️  ML model not found at {MODEL_PATH}. Survivability scores will use fallback calculation.")
except Exception as e:
    print(f"⚠️  Failed to load ML model: {e}. Using fallback calculation.")

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

# --- FILE UPLOAD CONFIGURATION ---
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', '/tmp/domus_uploads')
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB max file size
ALLOWED_EXTENSIONS = {
    # Images
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'heic', 'heif', '.svg',
    # Videos
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpeg', 'mpg',
    # Documents
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt',
    # Archives
    'zip', 'rar', '7z', 'tar', 'gz',
    # Audio
    'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac',
    # Other
    'json', 'xml', 'csv'
}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

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

def calculate_sha256(file_path):
    """Calculate SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def detect_mime_type(file_path):
    """Detect actual MIME type using python-magic."""
    try:
        mime = magic.Magic(mime=True)
        return mime.from_file(file_path)
    except:
        return "application/octet-stream"

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_ml_features(file_data):
    """
    Extract features from file_data that match the training data columns.
    Returns a pandas DataFrame with a single row.
    """
    # Get file age in days
    uploaded_at = file_data.get('uploaded_at', datetime.utcnow())
    if isinstance(uploaded_at, str):
        uploaded_at = datetime.fromisoformat(uploaded_at.replace('Z', '+00:00'))
    file_age_days = (datetime.utcnow() - uploaded_at).days
    
    # Map file extension to category
    ext = file_data.get('ext', '').lower()
    
    # Common format categories
    image_formats = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'heic', 'heif', 'svg']
    video_formats = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v', 'mpeg', 'mpg']
    document_formats = ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt']
    audio_formats = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
    
    if ext in image_formats:
        file_type = 'image'
    elif ext in video_formats:
        file_type = 'video'
    elif ext in document_formats:
        file_type = 'document'
    elif ext in audio_formats:
        file_type = 'audio'
    else:
        file_type = 'other'
    
    # Format risk levels
    high_risk_formats = ['wma', 'rm', 'ra', 'swf', 'fla', 'psd', 'ai', 'doc', 'bmp', 'tiff']
    medium_risk_formats = ['avi', 'mov', 'wmv']
    modern_formats = ['mp4', 'png', 'jpg', 'jpeg', 'pdf', 'mp3', 'webp']
    
    if ext in high_risk_formats:
        format_risk = 'high'
    elif ext in medium_risk_formats:
        format_risk = 'medium'
    elif ext in modern_formats:
        format_risk = 'low'
    else:
        format_risk = 'medium'
    
    # Build feature dictionary matching training data
    features = {
        'ext': ext,
        'file_type': file_type,
        'format_risk': format_risk,
        'size_bytes': file_data.get('size_bytes', 0),
        'metadata_score': file_data.get('metadata_score', 0),
        'access_risk_score': file_data.get('access_risk_score', 0),
        'duplicate_count': file_data.get('duplicate_count', 0),
        'access_count': file_data.get('access_count', 0),
        'file_age_days': file_age_days,
        'mime_mismatch': 1 if file_data.get('mime_claimed') != file_data.get('mime_detected') else 0,
    }
    
    return pd.DataFrame([features])

def predict_survivability(file_data):
    """
    Predict survivability score (0-100) for a file.
    Higher score = better chance of long-term survival.
    Uses ML model if available, otherwise uses rule-based fallback.
    """
    if ML_MODEL is not None:
        try:
            # Extract features
            features_df = extract_ml_features(file_data)
            
            # Predict using the model
            prediction = ML_MODEL.predict(features_df)[0]
            
            # Ensure score is between 0-100
            score = max(0, min(100, prediction))
            
            return round(score, 1)
        except Exception as e:
            print(f"[WARNING] ML prediction failed: {e}. Using fallback.")
    
    # Fallback: Rule-based scoring (inverse of access risk)
    access_risk = file_data.get('access_risk_score', 50)
    metadata_score = file_data.get('metadata_score', 0)
    
    # Start with inverse of access risk
    base_score = 100 - access_risk
    
    # Bonus for good metadata
    metadata_bonus = metadata_score * 0.2  # Up to +20 points
    
    # Bonus for duplicates (redundancy helps survival)
    duplicate_bonus = min(file_data.get('duplicate_count', 0) * 5, 15)
    
    final_score = base_score + metadata_bonus + duplicate_bonus
    return round(max(0, min(100, final_score)), 1)

def calculate_vault_resiliency(vault_id):
    """
    Calculate the overall resiliency score for a vault.
    This is the average survivability score across all files.
    """
    try:
        files = list(db.files.find({"vault_id": ObjectId(vault_id)}))
        
        if not files:
            return 0
        
        # Get survivability scores
        scores = [f.get('survivability_score', 0) for f in files if 'survivability_score' in f]
        
        if not scores:
            return 0
        
        avg_score = sum(scores) / len(scores)
        return round(avg_score, 1)
    except Exception as e:
        print(f"[ERROR] Failed to calculate vault resiliency: {e}")
        return 0

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
        "pubKeyCredParams": [
            {"alg": -7, "type": "public-key"},   # ES256
            {"alg": -257, "type": "public-key"}  # RS256
        ],
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

@app.route('/api/users/<user_id>', methods=['GET', 'OPTIONS'])
@login_required
def get_user_details(user_id):
    """Get basic user information (for displaying in member lists)."""
    if request.method == 'OPTIONS': return '', 204
    
    try:
        user = db.users.find_one(
            {"_id": ObjectId(user_id)},
            {"first_name": 1, "last_name": 1, "email": 1, "_id": 1}
        )
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        return jsonify(stringify_ids({
            "id": user['_id'],
            "first_name": user.get('first_name'),
            "last_name": user.get('last_name'),
            "email": user.get('email')
        }))
    except Exception as e:
        print(f"[ERROR] Get user failed: {e}")
        return jsonify({"error": "Failed to retrieve user"}), 500

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
        
        # Calculate resiliency if not already set
        resiliency_score = vault.get('resiliency_score')
        if resiliency_score is None:
            resiliency_score = calculate_vault_resiliency(vault_id)
            db.vaults.update_one(
                {"_id": ObjectId(vault_id)},
                {"$set": {"resiliency_score": resiliency_score}}
            )
        
        return jsonify(stringify_ids({
            "id": vault['_id'],
            "name": vault.get('name'),
            "joinCode": vault.get('join_code'),
            "resilienceScore": resiliency_score,
            "members": vault.get('members', [])
        }))
    except Exception as e:
        print(f"[ERROR] Get vault details failed: {e}")
        return jsonify({"error": "Invalid vault ID"}), 400

# ============================================================================
# File Routes
# ============================================================================

@app.route('/api/vaults/<vault_id>/files', methods=['POST', 'OPTIONS'])
@login_required
def upload_file(vault_id):
    """Upload a file to a vault."""
    if request.method == 'OPTIONS': return '', 204
    
    try:
        # Verify vault membership
        vault = db.vaults.find_one({
            "_id": ObjectId(vault_id),
            "members.user_id": ObjectId(session['user_id'])
        })
        if not vault:
            return jsonify({"error": "Vault not found or access denied"}), 403
        
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "File type not allowed"}), 400
        
        # Get optional metadata from form
        metadata_json = {}
        if 'metadata' in request.form:
            import json
            try:
                metadata_json = json.loads(request.form['metadata'])
            except:
                pass
        
        # Generate unique file ID and secure filename
        file_id = str(uuid.uuid4())
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else ''
        
        # Create storage path (organized by vault)
        vault_storage_dir = os.path.join(app.config['UPLOAD_FOLDER'], vault_id)
        os.makedirs(vault_storage_dir, exist_ok=True)
        
        stored_filename = f"{file_id}.{file_extension}"
        file_path = os.path.join(vault_storage_dir, stored_filename)
        stored_key = f"{vault_id}/{stored_filename}"
        
        # Save file
        file.save(file_path)
        
        # Get file size
        size_bytes = os.path.getsize(file_path)
        
        # Calculate SHA256 hash
        sha256_hash = calculate_sha256(file_path)
        
        # Detect actual MIME type
        mime_detected = detect_mime_type(file_path)
        mime_claimed = file.content_type or "application/octet-stream"
        
        # Extract PDF metadata automatically if it's a PDF
        if file_extension.lower() == 'pdf':
            pdf_metadata = extract_pdf_metadata(file_path)
            # Merge PDF metadata with user-provided metadata
            if pdf_metadata:
                metadata_json.update(pdf_metadata)
        
        # Calculate metadata score with enhanced data
        metadata_score = calculate_metadata_score(metadata_json)
        
        # Check for duplicates in this vault
        duplicate_count = db.files.count_documents({
            "vault_id": ObjectId(vault_id),
            "sha256": sha256_hash
        })
        
        # Calculate access risk using the new function from database.py
        access_risk_score, access_risk_reason = calculate_access_risk_score(
            mime_claimed, 
            mime_detected, 
            metadata_json
        )
        
        # Prepare data for survivability prediction
        temp_file_data = {
            'ext': file_extension,
            'mime_claimed': mime_claimed,
            'mime_detected': mime_detected,
            'metadata_score': metadata_score,
            'uploaded_at': datetime.utcnow(),
            'duplicate_count': duplicate_count,
            'access_count': 0,
            'access_risk_score': access_risk_score,
            'size_bytes': size_bytes
        }
        
        # Predict survivability score using ML model
        survivability_score = predict_survivability(temp_file_data)
        
        # Create file record
        file_record = {
            "_id": ObjectId(),
            "file_id": file_id,
            "vault_id": ObjectId(vault_id),
            "user_id": ObjectId(session['user_id']),
            "original_filename": original_filename,
            "stored_key": stored_key,
            "ext": file_extension,
            "mime_claimed": mime_claimed,
            "mime_detected": mime_detected,
            "size_bytes": size_bytes,
            "sha256": sha256_hash,
            "metadata_json": metadata_json,
            "metadata_score": metadata_score,
            "duplicate_count": duplicate_count,
            "access_risk_score": access_risk_score,
            "access_risk_reason": access_risk_reason,
            "survivability_score": survivability_score,
            "uploaded_at": datetime.utcnow(),
            "last_accessed_at": datetime.utcnow(),
            "access_count": 0
        }
        
        # Insert into database
        result = db.files.insert_one(file_record)
        
        # Update vault resiliency score
        vault_resiliency = calculate_vault_resiliency(vault_id)
        db.vaults.update_one(
            {"_id": ObjectId(vault_id)},
            {"$set": {"resiliency_score": vault_resiliency}}
        )
        
        print(f"[DEBUG] File uploaded: {original_filename} ({size_bytes} bytes) to vault {vault_id}")
        print(f"[DEBUG] Survivability score: {survivability_score}, Vault resiliency: {vault_resiliency}")
        
        return jsonify(stringify_ids({
            "success": True,
            "file": {
                "id": result.inserted_id,
                "file_id": file_id,
                "original_filename": original_filename,
                "size_bytes": size_bytes,
                "ext": file_extension,
                "mime_type": mime_detected,
                "metadata_score": metadata_score,
                "access_risk_score": access_risk_score,
                "survivability_score": survivability_score,
                "duplicate_count": duplicate_count,
                "uploaded_at": file_record['uploaded_at'].isoformat()
            }
        })), 201
        
    except Exception as e:
        print(f"[ERROR] File upload failed: {e}")
        return jsonify({"error": "File upload failed", "details": str(e)}), 500

@app.route('/api/vaults/<vault_id>/files', methods=['GET', 'OPTIONS'])
@login_required
def get_vault_files(vault_id):
    """Get all files in a vault."""
    if request.method == 'OPTIONS': return '', 204
    
    try:
        # Verify vault membership
        vault = db.vaults.find_one({
            "_id": ObjectId(vault_id),
            "members.user_id": ObjectId(session['user_id'])
        })
        if not vault:
            return jsonify({"error": "Vault not found or access denied"}), 403
        
        # Get all files for this vault
        files = list(db.files.find({"vault_id": ObjectId(vault_id)}).sort("uploaded_at", -1))
        
        return jsonify(stringify_ids(files))
        
    except Exception as e:
        print(f"[ERROR] Get files failed: {e}")
        return jsonify({"error": "Failed to retrieve files"}), 500

@app.route('/api/files/<file_id>', methods=['GET', 'OPTIONS'])
@login_required
def get_file_details(file_id):
    """
    Get detailed file information for ML model analysis.
    Returns all fields needed for survivability scoring.
    """
    if request.method == 'OPTIONS': return '', 204
    
    try:
        # Find file
        file_record = db.files.find_one({"file_id": file_id})
        if not file_record:
            return jsonify({"error": "File not found"}), 404
        
        # Verify user has access to the vault
        vault = db.vaults.find_one({
            "_id": file_record['vault_id'],
            "members.user_id": ObjectId(session['user_id'])
        })
        if not vault:
            return jsonify({"error": "Access denied"}), 403
        
        # Update access tracking
        db.files.update_one(
            {"file_id": file_id},
            {
                "$set": {"last_accessed_at": datetime.utcnow()},
                "$inc": {"access_count": 1}
            }
        )
        
        # Return complete file details for ML model
        return jsonify(stringify_ids({
            "id": file_record['_id'],
            "file_id": file_record['file_id'],
            "vault_id": file_record['vault_id'],
            "user_id": file_record['user_id'],
            "original_filename": file_record['original_filename'],
            "stored_key": file_record['stored_key'],
            "ext": file_record['ext'],
            "mime_claimed": file_record['mime_claimed'],
            "mime_detected": file_record['mime_detected'],
            "size_bytes": file_record['size_bytes'],
            "sha256": file_record['sha256'],
            "metadata_json": file_record.get('metadata_json', {}),
            "metadata_score": file_record['metadata_score'],
            "duplicate_count": file_record['duplicate_count'],
            "access_risk_score": file_record['access_risk_score'],
            "access_risk_reason": file_record['access_risk_reason'],
            "uploaded_at": file_record['uploaded_at'].isoformat(),
            "last_accessed_at": file_record['last_accessed_at'].isoformat(),
            "access_count": file_record['access_count']
        }))
        
    except Exception as e:
        print(f"[ERROR] Get file details failed: {e}")
        return jsonify({"error": "Failed to retrieve file details"}), 500

@app.route('/api/files/<file_id>/download', methods=['GET', 'OPTIONS'])
@login_required
def download_file(file_id):
    """Download a file."""
    if request.method == 'OPTIONS': return '', 204
    
    try:
        # Find file
        file_record = db.files.find_one({"file_id": file_id})
        if not file_record:
            return jsonify({"error": "File not found"}), 404
        
        # Verify access
        vault = db.vaults.find_one({
            "_id": file_record['vault_id'],
            "members.user_id": ObjectId(session['user_id'])
        })
        if not vault:
            return jsonify({"error": "Access denied"}), 403
        
        # Get file path
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_record['stored_key'])
        
        if not os.path.exists(file_path):
            return jsonify({"error": "File not found on disk"}), 404
        
        # Update access tracking
        db.files.update_one(
            {"file_id": file_id},
            {
                "$set": {"last_accessed_at": datetime.utcnow()},
                "$inc": {"access_count": 1}
            }
        )
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=file_record['original_filename'],
            mimetype=file_record['mime_detected']
        )
        
    except Exception as e:
        print(f"[ERROR] File download failed: {e}")
        return jsonify({"error": "Download failed"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)