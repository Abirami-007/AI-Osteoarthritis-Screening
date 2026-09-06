"""
SQLAlchemy ORM models for KneeCare AI database.

Tables:
  - users: id, username, email, password_hash, created_at
  - patients: id, user_id, name, age, sex, height, weight, bmi, created_at
  - screenings: id, patient_id, risk_result, risk_probability, created_at
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from .database import Base


def utc_now():
    """Return current UTC timestamp with timezone."""
    return datetime.now(timezone.utc)


class User(Base):
    """
    Users table for healthcare workers / system administrators.
    Stores securely hashed passwords (never plain-text).
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationship to patients registered by or assigned to this user
    patients = relationship("Patient", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} username='{self.username}'>"


class Patient(Base):
    """
    Patients table for storing patient demographic and baseline metrics.
    """
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    age = Column(Integer, nullable=False)
    sex = Column(String(20), nullable=False)
    height = Column(Float, nullable=True)  # in cm
    weight = Column(Float, nullable=True)  # in kg
    bmi = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="patients")
    screenings = relationship("Screening", back_populates="patient", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Patient id={self.id} name='{self.name}' age={self.age}>"


class Screening(Base):
    """
    Screenings table for storing KOA risk screening assessments and probabilities.
    """
    __tablename__ = "screenings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_result = Column(String(50), nullable=False)  # e.g., "Low Risk", "Moderate Risk", "High Risk"
    risk_probability = Column(Float, nullable=False)  # e.g., 0.8523
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationship back to patient
    patient = relationship("Patient", back_populates="screenings")

    def __repr__(self):
        return f"<Screening id={self.id} patient_id={self.patient_id} result='{self.risk_result}'>"
