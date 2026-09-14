from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.orm import Session, sessionmaker

from src.database.connection import get_engine
from src.database.models import Base


def get_session() -> Session:
    session_factory = sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        future=True,
    )

    return session_factory()


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session()

    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def initialize_database() -> None:
    Base.metadata.create_all(bind=get_engine())
