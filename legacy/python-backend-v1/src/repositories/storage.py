import os
from pathlib import Path

from src.database.session import initialize_database, session_scope


def should_use_json_storage(current_file: Path, default_file: Path) -> bool:
    if os.environ.get("PEANUTEC_STORAGE", "").lower() == "json":
        return True

    return Path(current_file) != default_file


def database_session_scope():
    initialize_database()
    return session_scope()
