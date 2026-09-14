import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


DEFAULT_DATABASE_URL = "sqlite:///./outputs/peanutec.db"

load_dotenv()

_engine: Engine | None = None
_engine_url: str | None = None


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def get_engine(database_url: str | None = None) -> Engine:
    global _engine, _engine_url

    resolved_url = database_url or get_database_url()

    if _engine is not None and _engine_url == resolved_url:
        return _engine

    if _engine is not None:
        _engine.dispose()

    connect_args = {}
    if resolved_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    _engine = create_engine(
        resolved_url,
        connect_args=connect_args,
        future=True,
    )
    _engine_url = resolved_url

    return _engine


def reset_engine() -> None:
    global _engine, _engine_url

    if _engine is not None:
        _engine.dispose()

    _engine = None
    _engine_url = None
