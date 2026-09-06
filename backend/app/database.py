"""
Database configuration and session management for KneeCare AI.

Connects to PostgreSQL (or configurable DATABASE_URL) via SQLAlchemy.
Supports automatic table creation on startup.
"""

import os
import logging
from pathlib import Path
from typing import Generator, Optional

import bcrypt
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

logger = logging.getLogger(__name__)

# Load environment variables from .env files
# Check backend/.env first, then root .env
backend_env = Path(__file__).resolve().parent.parent / ".env"
root_env = Path(__file__).resolve().parent.parent.parent / ".env"
if backend_env.exists():
    load_dotenv(backend_env)
elif root_env.exists():
    load_dotenv(root_env)
else:
    load_dotenv()

# Read DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Normalize Heroku/Render legacy postgres:// to postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

Base = declarative_base()

_engine = None
_SessionLocal = None


def get_engine():
    """Get or create the SQLAlchemy engine."""
    global _engine
    if _engine is not None:
        return _engine

    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    if not db_url:
        logger.warning(
            "DATABASE_URL environment variable is not set. "
            "Database endpoints will return 503 until DATABASE_URL is configured."
        )
        return None

    try:
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        _engine = create_engine(
            db_url,
            connect_args=connect_args,
            pool_pre_ping=True,
            echo=False,
        )
        logger.info("SQLAlchemy engine created successfully.")
        return _engine
    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
        return None


def get_session_maker():
    """Get or create the SessionLocal factory."""
    global _SessionLocal
    if _SessionLocal is not None:
        return _SessionLocal

    engine = get_engine()
    if engine is None:
        return None

    _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _SessionLocal


def init_db() -> bool:
    """
    Initialize database tables automatically.
    Called on application startup.
    """
    engine = get_engine()
    if engine is None:
        logger.warning("Database tables NOT initialized: DATABASE_URL is not set.")
        return False

    try:
        # Import models so they register with Base.metadata
        from . import models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database tables: {e}")
        return False


def get_db() -> Generator[Optional[Session], None, None]:
    """
    FastAPI dependency that yields a database session.
    Raises HTTP 503 if database is not configured or unavailable.
    """
    session_factory = get_session_maker()
    if session_factory is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=503,
            detail=(
                "Database is not configured or unavailable. "
                "Please set the DATABASE_URL environment variable."
            ),
        )

    db = session_factory()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────
# Password Hashing Utilities (bcrypt)
# ─────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Securely hash a plain-text password using bcrypt with random salt."""
    if not password:
        raise ValueError("Password cannot be empty.")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False
