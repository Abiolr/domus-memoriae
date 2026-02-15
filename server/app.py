from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
import os
import secrets
from datetime import datetime, timedelta
from functools import wraps
from bson import ObjectId
from dotenv import load_dotenv
from database import Database
import hashlib
import uuid
from werkzeug.utils import secure_filename

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

# --- FILE UPLOAD CONFIGURATION ---
UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', '/tmp/domus_uploads')
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB max file size
ALLOWED_EXTENSIONS = {
    # Images
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'heic', 'heif',
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
        import magic
        mime = magic.Magic(mime=True)
        return mime.from_file(file_path)
    except:
        return "application/octet-stream"

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def calculate_metadata_score(metadata_json):
    """
    Calculate metadata completeness score (0-100).
    Higher score = more complete metadata.
    """
    if not metadata_json:
        return 0
    
    score = 0
    max_score = 0
    
    # Important metadata fields and their weights
    important_fields = {
        'title': 10,
        'description': 10,
        'date_taken': 15,
        'location': 15,
        'people': 10,
        'tags': 10,
        'camera': 5,
        'author': 10,
        'notes': 10,
        'event': 5
    }
    
    for field, weight in important_fields.items():
        max_score += weight
        if field in metadata_json and metadata_json[field]:
            score += weight
    
    return int((score / max_score) * 100) if max_score > 0 else 0

def calculate_access_risk(file_data):
    """
    Calculate access risk score (0-100) based on file characteristics.
    Higher score = higher risk of becoming inaccessible.
    """
    risk_score = 0
    reasons = []
    
    # Check file format obsolescence risk
    high_risk_formats = ['wma', 'rm', 'ra', 'swf', 'fla', 'psd', 'ai']
    medium_risk_formats = ['doc', 'avi', 'mov', 'wmv', 'bmp', 'tiff']
    
    ext = file_data.get('ext', '').lower()
    
    if ext in high_risk_formats:
        risk_score += 40
        reasons.append(f"High-risk format (.{ext})")
    elif ext in medium_risk_formats:
        risk_score += 20
        reasons.append(f"Medium-risk format (.{ext})")
    
    # Check metadata completeness (low metadata = harder to find/identify)
    metadata_score = file_data.get('metadata_score', 0)
    if metadata_score < 30:
        risk_score += 30
        reasons.append("Poor metadata (hard to identify)")
    elif metadata_score < 60:
        risk_score += 15
        reasons.append("Incomplete metadata")
    
    # Check if MIME types mismatch (potential corruption)
    if file_data.get('mime_claimed') != file_data.get('mime_detected'):
        risk_score += 20
        reasons.append("File type mismatch (possible corruption)")
    
    # Check file age (older files = higher risk if not maintained)
    # This would need uploaded_at from the actual file record
    
    # Cap at 100
    risk_score = min(risk_score, 100)
    
    return risk_score, "; ".join(reasons) if reasons else "Low risk"

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
        
        # Calculate metadata score
        metadata_score = calculate_metadata_score(metadata_json)
        
        # Check for duplicates in this vault
        duplicate_count = db.files.count_documents({
            "vault_id": ObjectId(vault_id),
            "sha256": sha256_hash
        })
        
        # Calculate access risk
        temp_file_data = {
            'ext': file_extension,
            'mime_claimed': mime_claimed,
            'mime_detected': mime_detected,
            'metadata_score': metadata_score
        }
        access_risk_score, access_risk_reason = calculate_access_risk(temp_file_data)
        
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
            "uploaded_at": datetime.utcnow(),
            "last_accessed_at": datetime.utcnow(),
            "access_count": 0
        }
        
        # Insert into database
        result = db.files.insert_one(file_record)
        
        print(f"[DEBUG] File uploaded: {original_filename} ({size_bytes} bytes) to vault {vault_id}")
        
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
