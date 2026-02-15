from __future__ import annotations

import os
import random
import string
from datetime import datetime, date
from typing import Any, Dict, Optional, Tuple, Union

from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError, ServerSelectionTimeoutError
from bson import ObjectId
import magic
from pypdf import PdfReader

load_dotenv()

ROLE_ADMIN = "admin"
ROLE_EDITOR = "editor"
ROLE_VIEWER = "viewer"
ALLOWED_ROLES = {ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER}


def _now() -> datetime:
    return datetime.utcnow()

def _oid(value: Union[str, ObjectId]) -> ObjectId:
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except Exception as e:
        raise ValueError(f"Invalid ObjectId: {value}") from e

def _parse_dob(dob: Union[str, date, datetime]) -> datetime:
    """Store DOB as UTC datetime @ 00:00:00. Accepts 'YYYY-MM-DD', date, datetime."""
    if isinstance(dob, datetime):
        return datetime(dob.year, dob.month, dob.day)
    if isinstance(dob, date):
        return datetime(dob.year, dob.month, dob.day)
    if isinstance(dob, str):
        try:
            y, m, d = dob.split("-")
            return datetime(int(y), int(m), int(d))
        except Exception as e:
            raise ValueError("dob must be 'YYYY-MM-DD'") from e
    raise ValueError("dob must be 'YYYY-MM-DD', date, or datetime")


def _generate_invite_code(length: int = 12) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def extract_pdf_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extracts internal metadata from a PDF file to improve model features.
    """
    try:
        reader = PdfReader(file_path)
        meta = reader.metadata
        return {
            "author": meta.author or "",
            "title": meta.title or "",
            "creation_date": str(meta.get("/CreationDate", "")),
            "description": meta.subject or "",
            "page_count": len(reader.pages),
            "creator": meta.creator or "",
            "is_encrypted": reader.is_encrypted
        }
    except Exception as e:
        print(f"PDF extraction error: {e}")
        return {}


def calculate_metadata_score(metadata_json: Optional[Dict[str, Any]]) -> int:
    """
    Calculates score based on presence of key identifying fields.
    """
    score = 0
    if metadata_json:
        score += 10
    
    # Check for specific keys required for high survivability
    fields_to_check = ['author', 'title', 'creation_date']
    for field in fields_to_check:
        if metadata_json and metadata_json.get(field):
            score += 20
            
    if metadata_json and metadata_json.get('description'):
        score += 30
    
    return min(score, 100)


def calculate_access_risk_score(mime_claimed: str, mime_detected: str, metadata_json: Optional[Dict[str, Any]]) -> Tuple[int, str]:
    """
    Calculates risk based on file inconsistencies.
    """
    score = 0
    reasons = []
    
    # 40-point penalty for MIME mismatch
    if mime_claimed != mime_detected:
        score += 40
        reasons.append("File type mismatch (possible corruption)")
    
    # 10-point penalty for missing metadata context
    if not metadata_json or len(metadata_json) <= 1:  # 1 because of base {}
        score += 10
        reasons.append("Poor metadata (hard to identify)")
        
    return score, "; ".join(reasons) if reasons else "Low risk"


class Database:
    """
    Collections:
      - users
      - vaults
      - folders
      - files
    """

    def __init__(self):
        # Prefer full URL if provided, otherwise build from parts
        self.public_url = os.environ.get("MONGO_PUBLIC_URL")
        self.mongo_url = os.environ.get("MONGO_URL")

        self.host = os.environ.get("MONGOHOST")
        self.port = os.environ.get("MONGOPORT")
        self.user = os.environ.get("MONGOUSER")
        self.password = os.environ.get("MONGOPASSWORD")

        # Optional (but recommended): pick a db name
        self.db_name = os.environ.get("MONGO_DB") or os.environ.get("MONGODB_NAME") or "family_legacy_db"

        self._validate_env()
        self.uri = self._build_uri()

        # Connect (fast fail if creds/host wrong)
        self.client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
        try:
            self.client.admin.command("ping")
        except ServerSelectionTimeoutError as e:
            raise RuntimeError(
                "MongoDB connection failed (ping timeout). Check MONGO_PUBLIC_URL/MONGO_URL or host/port/user/pass."
            ) from e

        self.db = self.client[self.db_name]

        self.users: Collection = self.db["users"]
        self.vaults: Collection = self.db["vaults"]
        self.folders: Collection = self.db["folders"]
        self.files: Collection = self.db["files"]

        self._ensure_indexes()

    def _validate_env(self) -> None:
        # If you gave a full URL, we can skip host/port/user/pass checks
        if self.public_url or self.mongo_url:
            return

        required = {
            "MONGOHOST": self.host,
            "MONGOPORT": self.port,
            "MONGOUSER": self.user,
            "MONGOPASSWORD": self.password,
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            raise ValueError(f"Missing required env vars: {', '.join(missing)}")

    def _build_uri(self) -> str:
        """
        Priority:
          1) MONGO_PUBLIC_URL
          2) MONGO_URL
          3) mongodb://MONGOUSER:MONGOPASSWORD@MONGOHOST:MONGOPORT/?authSource=admin
        """
        if self.public_url:
            return self.public_url.strip()
        if self.mongo_url:
            return self.mongo_url.strip()

        host = self.host.strip()
        port = str(self.port).strip()
        user = self.user.strip()
        pwd = self.password.strip()

        # authSource=admin is common when using root/admin auth
        return f"mongodb://{user}:{pwd}@{host}:{port}/?authSource=admin"

    def _ensure_indexes(self) -> None:
        self.users.create_index([("email", ASCENDING)], unique=True)
        self.users.create_index([("phone", ASCENDING)], unique=True)

        self.vaults.create_index([("admin_user_id", ASCENDING)])
        self.vaults.create_index([("members.user_id", ASCENDING)])

        # 12-char alphanumeric invite code
        self.vaults.create_index([("join_code", ASCENDING)], unique=True, sparse=True)

        self.folders.create_index([("vault_id", ASCENDING), ("parent_folder_id", ASCENDING)])
        self.files.create_index([("vault_id", ASCENDING), ("folder_id", ASCENDING)])

    # -----------------------------
    # Users
    # -----------------------------
    def create_user(
        self,
        *,
        email: str,
        phone: str,
        first_name: str,
        last_name: str,
        dob: Union[str, date, datetime],
        legal_middle_names: Optional[str] = None,
        suffix: Optional[str] = None,
        maiden_birth_name: Optional[str] = None,
        preferred_name: Optional[str] = None,
        place_of_birth: Optional[Dict[str, str]] = None,  # {city,country,province_state}
        passkey_credential: Optional[Dict[str, Any]] = None,  # WebAuthn credential data
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        if not all([email, phone, first_name, last_name]):
            return False, "Missing required fields: email, phone, first_name, last_name", None

        try:
            dob_dt = _parse_dob(dob)
        except ValueError as e:
            return False, str(e), None

        pob = place_of_birth or {}
        pob = {k: v for k, v in pob.items() if v}

        doc = {
            "email": email.strip().lower(),
            "phone": phone.strip(),
            "first_name": first_name.strip(),
            "middle_names": legal_middle_names.strip() if legal_middle_names else None,
            "suffix": suffix.strip() if suffix else None,
            "maiden_name": maiden_birth_name.strip() if maiden_birth_name else None,
            "last_name": last_name.strip(),
            "dob": dob_dt,
            "preferred_name": preferred_name.strip() if preferred_name else None,
            "place_of_birth": pob if pob else None,
            "passkey_credential": passkey_credential,  # Store WebAuthn credential
            "created_at": _now(),
        }
        doc = {k: v for k, v in doc.items() if v is not None}

        try:
            res = self.users.insert_one(doc)
            created = self.users.find_one(
                {"_id": res.inserted_id},
                {"email": 1, "phone": 1, "first_name": 1, "last_name": 1, "_id": 1},
            )
            return True, "User created", created
        except DuplicateKeyError:
            return False, "Email or phone already exists", None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find a user by email address."""
        return self.users.find_one({"email": email.strip().lower()})

    def update_user_passkey(self, user_id: Union[str, ObjectId], passkey_credential: Dict[str, Any]) -> Tuple[bool, str]:
        """Update or add a passkey credential for a user."""
        uid = _oid(user_id)
        result = self.users.update_one({"_id": uid}, {"$set": {"passkey_credential": passkey_credential}})
        if result.modified_count > 0:
            return True, "Passkey credential updated"
        return False, "User not found or no changes made"

    # -----------------------------
    # Vaults
    # -----------------------------
    def create_vault(
        self,
        *,
        acting_user_id: Union[str, ObjectId],
        name: str,
        description: Optional[str] = None,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        if not name or not name.strip():
            return False, "Vault name is required", None

        uid = _oid(acting_user_id)
        if not self.users.find_one({"_id": uid}):
            return False, "acting_user_id not found", None

        # Generate a unique 12-char invite code
        join_code = None
        for _ in range(25):
            candidate = _generate_invite_code(12)
            if not self.vaults.find_one({"join_code": candidate}, {"_id": 1}):
                join_code = candidate
                break
        if not join_code:
            return False, "Failed to generate a unique invite code. Try again.", None

        doc = {
            "name": name.strip(),
            "description": description.strip() if description and description.strip() else None,
            "join_code": join_code,
            "created_at": _now(),
            "created_by": uid,
            "admin_user_id": uid,
            "members": [{"user_id": uid, "role": ROLE_ADMIN, "added_at": _now()}],
        }
        doc = {k: v for k, v in doc.items() if v is not None}

        try:
            res = self.vaults.insert_one(doc)
        except DuplicateKeyError:
            # Extremely rare race (invite code collision). Caller can retry.
            return False, "Invite code collision. Please retry.", None

        created = self.vaults.find_one({"_id": res.inserted_id})
        return True, "Vault created", created

    def _get_membership(self, vault: Dict[str, Any], user_id: ObjectId) -> Optional[Dict[str, Any]]:
        for m in vault.get("members", []):
            if m.get("user_id") == user_id:
                return m
        return None

    def _require_member(self, vault_id: ObjectId, user_id: ObjectId) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        vault = self.vaults.find_one({"_id": vault_id})
        if not vault:
            return False, "Vault not found", None
        if not self._get_membership(vault, user_id):
            return False, "User is not a member of this vault", None
        return True, "OK", vault

    def _require_admin(self, vault_id: ObjectId, admin_id: ObjectId) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        ok, msg, vault = self._require_member(vault_id, admin_id)
        if not ok:
            return False, msg, None
        mem = self._get_membership(vault, admin_id)
        if not mem or mem.get("role") != ROLE_ADMIN:
            return False, "Admin privileges required", None
        return True, "OK", vault

    def get_vaults_for_user(self, user_id: Union[str, ObjectId]) -> list[Dict[str, Any]]:
        uid = _oid(user_id)
        return list(self.vaults.find({"members.user_id": uid}).sort("created_at", -1))

    def add_user_to_vault(
        self,
        *,
        acting_admin_id: Union[str, ObjectId],
        vault_id: Union[str, ObjectId],
        user_id_to_add: Union[str, ObjectId],
        role: str = ROLE_VIEWER,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        if role not in ALLOWED_ROLES:
            return False, f"Invalid role. Allowed: {sorted(ALLOWED_ROLES)}", None

        vid = _oid(vault_id)
        admin_oid = _oid(acting_admin_id)
        target_oid = _oid(user_id_to_add)

        ok, msg, vault = self._require_admin(vid, admin_oid)
        if not ok:
            return False, msg, None

        if not self.users.find_one({"_id": target_oid}):
            return False, "Target user not found", None

        if self._get_membership(vault, target_oid):
            return False, "User is already in this vault", None

        self.vaults.update_one(
            {"_id": vid},
            {"$push": {"members": {"user_id": target_oid, "role": role, "added_at": _now()}}},
        )
        return True, "User added to vault", self.vaults.find_one({"_id": vid})

    def join_vault_by_code(
        self,
        *,
        acting_user_id: Union[str, ObjectId],
        join_code: str,
        role: str = ROLE_VIEWER,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        """Join a vault using its 12-character invitation code."""
        if role not in ALLOWED_ROLES:
            return False, f"Invalid role. Allowed: {sorted(ALLOWED_ROLES)}", None

        if not join_code or not str(join_code).strip():
            return False, "join_code is required", None

        code = str(join_code).strip().upper()
        uid = _oid(acting_user_id)

        if not self.users.find_one({"_id": uid}, {"_id": 1}):
            return False, "acting_user_id not found", None

        vault = self.vaults.find_one({"join_code": code})
        if not vault:
            return False, "Invalid invitation code", None

        if self._get_membership(vault, uid):
            return True, "Already a member of this vault", vault

        self.vaults.update_one(
            {"_id": vault["_id"]},
            {"$push": {"members": {"user_id": uid, "role": role, "added_at": _now()}}},
        )
        return True, "Joined vault", self.vaults.find_one({"_id": vault["_id"]})

    # -----------------------------
    # Folders
    # -----------------------------
    def add_folder(
        self,
        *,
        acting_user_id: Union[str, ObjectId],
        vault_id: Union[str, ObjectId],
        name: str,
        parent_folder_id: Optional[Union[str, ObjectId]] = None,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        vid = _oid(vault_id)
        uid = _oid(acting_user_id)

        if not name or not name.strip():
            return False, "Folder name is required", None

        ok, msg, _vault = self._require_member(vid, uid)
        if not ok:
            return False, msg, None

        parent_oid = _oid(parent_folder_id) if parent_folder_id else None
        if parent_oid:
            if not self.folders.find_one({"_id": parent_oid, "vault_id": vid}):
                return False, "Parent folder not found in this vault", None

        doc = {
            "vault_id": vid,
            "parent_folder_id": parent_oid,
            "name": name.strip(),
            "created_at": _now(),
            "created_by": uid,
        }
        res = self.folders.insert_one(doc)
        return True, "Folder created", self.folders.find_one({"_id": res.inserted_id})

    def _delete_folder_recursive(self, vault_id: ObjectId, folder_id: ObjectId) -> Dict[str, int]:
        counts = {"folders_deleted": 0, "files_deleted": 0}

        file_res = self.files.delete_many({"vault_id": vault_id, "folder_id": folder_id})
        counts["files_deleted"] += int(file_res.deleted_count)

        children = list(self.folders.find({"vault_id": vault_id, "parent_folder_id": folder_id}, {"_id": 1}))
        for c in children:
            sub = self._delete_folder_recursive(vault_id, c["_id"])
            counts["folders_deleted"] += sub["folders_deleted"]
            counts["files_deleted"] += sub["files_deleted"]

        folder_res = self.folders.delete_one({"_id": folder_id, "vault_id": vault_id})
        counts["folders_deleted"] += int(folder_res.deleted_count)
        return counts

    def delete_folder(
        self,
        *,
        acting_user_id: Union[str, ObjectId],
        vault_id: Union[str, ObjectId],
        folder_id: Union[str, ObjectId],
        recursive: bool = True,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        vid = _oid(vault_id)
        uid = _oid(acting_user_id)
        fid = _oid(folder_id)

        ok, msg, _vault = self._require_member(vid, uid)
        if not ok:
            return False, msg, None

        folder = self.folders.find_one({"_id": fid, "vault_id": vid})
        if not folder:
            return False, "Folder not found", None

        if not recursive:
            has_child = self.folders.find_one({"vault_id": vid, "parent_folder_id": fid}, {"_id": 1}) is not None
            has_files = self.files.find_one({"vault_id": vid, "folder_id": fid}, {"_id": 1}) is not None
            if has_child or has_files:
                return False, "Folder is not empty (set recursive=True to delete everything)", None
            self.folders.delete_one({"_id": fid, "vault_id": vid})
            return True, "Folder deleted", {"folders_deleted": 1, "files_deleted": 0}

        counts = self._delete_folder_recursive(vid, fid)
        return True, "Folder deleted (recursive)", counts

    # -----------------------------
    # Files (metadata)
    # -----------------------------
    def add_file(
        self,
        *,
        acting_user_id: Union[str, ObjectId],
        vault_id: Union[str, ObjectId],
        filename: str,
        folder_id: Optional[Union[str, ObjectId]] = None,
        mime_type: Optional[str] = None,
        size_bytes: Optional[int] = None,
        storage: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        integrity_hash: Optional[str] = None,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        vid = _oid(vault_id)
        uid = _oid(acting_user_id)

        if not filename or not filename.strip():
            return False, "filename is required", None

        ok, msg, _vault = self._require_member(vid, uid)
        if not ok:
            return False, msg, None

        folder_oid = _oid(folder_id) if folder_id else None
        if folder_oid and not self.folders.find_one({"_id": folder_oid, "vault_id": vid}):
            return False, "folder_id not found in this vault", None

        doc = {
            "vault_id": vid,
            "folder_id": folder_oid,
            "filename": filename.strip(),
            "mime_type": mime_type.strip() if mime_type else None,
            "size_bytes": int(size_bytes) if size_bytes is not None else None,
            "storage": storage or None,
            "metadata": metadata or None,
            "integrity_hash": integrity_hash.strip() if integrity_hash else None,
            "created_at": _now(),
            "uploaded_by": uid,
        }
        doc = {k: v for k, v in doc.items() if v is not None}

        res = self.files.insert_one(doc)
        return True, "File added", self.files.find_one({"_id": res.inserted_id})

    def delete_file(
        self,
        *,
        acting_user_id: Union[str, ObjectId],
        vault_id: Union[str, ObjectId],
        file_id: Union[str, ObjectId],
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        vid = _oid(vault_id)
        uid = _oid(acting_user_id)
        fid = _oid(file_id)

        ok, msg, _vault = self._require_member(vid, uid)
        if not ok:
            return False, msg, None

        file_doc = self.files.find_one({"_id": fid, "vault_id": vid})
        if not file_doc:
            return False, "File not found", None

        res = self.files.delete_one({"_id": fid, "vault_id": vid})
        return (True, "File deleted", {"files_deleted": int(res.deleted_count)}) if res.deleted_count else (False, "Delete failed", None)

    # -----------------------------
    # Admin
    # -----------------------------
    def handoff_admin(
        self,
        *,
        vault_id: Union[str, ObjectId],
        current_admin_id: Union[str, ObjectId],
        new_admin_id: Union[str, ObjectId],
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        vid = _oid(vault_id)
        curr = _oid(current_admin_id)
        new = _oid(new_admin_id)

        ok, msg, vault = self._require_admin(vid, curr)
        if not ok:
            return False, msg, None

        if not self.users.find_one({"_id": new}):
            return False, "New admin user not found", None

        if not self._get_membership(vault, new):
            return False, "New admin must already be a member of the vault", None

        self.vaults.update_one({"_id": vid}, {"$set": {"admin_user_id": new}})
        self.vaults.update_one({"_id": vid, "members.user_id": new}, {"$set": {"members.$.role": ROLE_ADMIN}})
        self.vaults.update_one({"_id": vid, "members.user_id": curr}, {"$set": {"members.$.role": ROLE_EDITOR}})

        return True, "Admin handed off", self.vaults.find_one({"_id": vid})

    def change_role(
        self,
        *,
        vault_id: Union[str, ObjectId],
        acting_admin_id: Union[str, ObjectId],
        target_user_id: Union[str, ObjectId],
        new_role: str,
    ) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
        if new_role not in ALLOWED_ROLES:
            return False, f"Invalid role. Allowed: {sorted(ALLOWED_ROLES)}", None

        vid = _oid(vault_id)
        admin = _oid(acting_admin_id)
        target = _oid(target_user_id)

        ok, msg, vault = self._require_admin(vid, admin)
        if not ok:
            return False, msg, None

        mem = self._get_membership(vault, target)
        if not mem:
            return False, "Target user is not a member of this vault", None

        # don't demote the vault owner admin unless you handoff first
        if vault.get("admin_user_id") == target and new_role != ROLE_ADMIN:
            return False, "Cannot demote vault owner admin. Use handoff_admin first.", None

        self.vaults.update_one({"_id": vid, "members.user_id": target}, {"$set": {"members.$.role": new_role}})
        return True, "Role updated", self.vaults.find_one({"_id": vid})


if __name__ == "__main__":
    db = Database()
    print("✅ MongoDB connected (env vars matched) and indexes ensured.")