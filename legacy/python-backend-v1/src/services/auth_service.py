import base64
import hashlib
import hmac
import os
import secrets
from uuid import uuid4

from src.repositories import users_repository
from src.services.legacy_auth_deprecation import disable_legacy_auth_routes


disable_legacy_auth_routes()

PASSWORD_HASH_ITERATIONS = 210_000
TOKEN_SECRET = os.environ.get("PEANUTEC_AUTH_SECRET", "peanutec-dev-secret")


def public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
    }


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_HASH_ITERATIONS,
    ).hex()

    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt}${digest}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected_digest = password_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations),
    ).hex()

    return hmac.compare_digest(digest, expected_digest)


def create_access_token(user_id: str) -> str:
    signature = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        user_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    raw_token = f"{user_id}.{signature}".encode("utf-8")

    return base64.urlsafe_b64encode(raw_token).decode("utf-8")


def get_user_id_from_token(token: str) -> str | None:
    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        user_id, signature = decoded.rsplit(".", 1)
    except (ValueError, UnicodeDecodeError):
        return None

    expected_signature = hmac.new(
        TOKEN_SECRET.encode("utf-8"),
        user_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        return None

    return user_id


def register_user(name: str, email: str, password: str) -> dict:
    normalized_email = email.strip().lower()

    if users_repository.get_user_by_email(normalized_email) is not None:
        raise ValueError("Email ja cadastrado")

    user = {
        "id": str(uuid4()),
        "name": name.strip(),
        "email": normalized_email,
        "password_hash": hash_password(password),
    }

    return users_repository.create_user(user)


def authenticate_user(email: str, password: str) -> dict | None:
    user = users_repository.get_user_by_email(email)

    if user is None:
        return None

    if not verify_password(password, user["password_hash"]):
        return None

    return user


def get_user_from_token(token: str) -> dict | None:
    user_id = get_user_id_from_token(token)

    if user_id is None:
        return None

    return users_repository.get_user_by_id(user_id)
