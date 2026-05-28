import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parents[2] / "sift.db"


def resolve_database_url(value: str | None = None) -> str:
    database_url = value or os.getenv("DATABASE_URL") or f"sqlite:///{DEFAULT_SQLITE_PATH}"
    sqlite_prefix = "sqlite:///"
    if not database_url.startswith(sqlite_prefix) or database_url == "sqlite:///:memory:":
        return database_url

    raw_path = database_url[len(sqlite_prefix):]
    db_path = Path(raw_path)
    if db_path.is_absolute():
        return database_url

    # Vercel and local process managers may run from the repo root or another
    # working directory. Keep relative SQLite URLs pinned to the bundled backend DB.
    return f"{sqlite_prefix}{DEFAULT_SQLITE_PATH.parent / db_path}"


DATABASE_URL = resolve_database_url()

# For SQLite we need check_same_thread=False
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
