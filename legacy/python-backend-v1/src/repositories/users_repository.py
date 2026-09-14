import json
from pathlib import Path

from src.database.models import User
from src.repositories.storage import database_session_scope, should_use_json_storage

DEFAULT_USERS_FILE = Path("outputs/users.json")
USERS_FILE = DEFAULT_USERS_FILE


def _use_json_storage() -> bool:
    return should_use_json_storage(USERS_FILE, DEFAULT_USERS_FILE)


def _user_to_dict(user: User) -> dict:
    record = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "password_hash": user.password_hash,
    }

    if user.created_at is not None:
        record["created_at"] = user.created_at

    return record


def _user_from_dict(user: dict) -> User:
    return User(
        id=user["id"],
        name=user["name"],
        email=user["email"],
        password_hash=user["password_hash"],
        created_at=user.get("created_at"),
    )


def _load_users_json() -> list[dict]:
    if not USERS_FILE.exists():
        return []

    with open(USERS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_users_json(users: list[dict]) -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(USERS_FILE, "w", encoding="utf-8") as file:
        json.dump(users, file, ensure_ascii=False, indent=2)


def list_users() -> list[dict]:
    if _use_json_storage():
        return _load_users_json()

    with database_session_scope() as session:
        users = session.query(User).all()
        return [_user_to_dict(user) for user in users]


def save_users(users: list[dict]) -> None:
    if _use_json_storage():
        _save_users_json(users)
        return

    with database_session_scope() as session:
        session.query(User).delete()
        session.add_all([_user_from_dict(user) for user in users])


def get_user_by_id(user_id: str) -> dict | None:
    if _use_json_storage():
        for user in list_users():
            if user["id"] == user_id:
                return user

        return None

    with database_session_scope() as session:
        user = session.get(User, user_id)

        if user is None:
            return None

        return _user_to_dict(user)

    return None


def get_user_by_email(email: str) -> dict | None:
    normalized_email = email.strip().lower()

    if _use_json_storage():
        for user in list_users():
            if user["email"].lower() == normalized_email:
                return user

        return None

    with database_session_scope() as session:
        user = session.query(User).filter(User.email == normalized_email).first()

        if user is None:
            return None

        return _user_to_dict(user)

    return None


def create_user(user: dict) -> dict:
    if _use_json_storage():
        users = list_users()
        users.append(user)
        save_users(users)
        return user

    with database_session_scope() as session:
        session.add(_user_from_dict(user))

    return user
