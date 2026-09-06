"""
Pydantic schemas for the OA Screening System API.
Defines request/response models for all endpoints.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


class HealthResponse(BaseModel):
    """Response for GET /health."""
    status: str = "ok"
    service: str = "OA Screening System API"
    model_loaded: bool = False


class ModelInfoResponse(BaseModel):
    """Response for GET /model-info."""
    model_loaded: bool
    model_version: Optional[str] = None
    algorithm: Optional[str] = None
    feature_count: Optional[int] = None
    feature_names: Optional[list[str]] = None
    classes: Optional[list[str]] = None
    threshold: Optional[float] = None
    training_metrics: Optional[dict] = None
    message: str = ""


class PatientMetadata(BaseModel):
    """Patient metadata sent alongside sensor data for prediction."""
    patient_id: Optional[str] = None
    age: Optional[int] = Field(None, ge=1, le=120)
    gender: Optional[str] = None
    bmi: Optional[float] = Field(None, ge=10.0, le=80.0)
    pain_score: Optional[int] = Field(None, ge=0, le=10)
    stiffness: Optional[str] = None
    previous_knee_injury: Optional[str] = None
    physical_activity: Optional[str] = None
    difficulty_walking: Optional[str] = None
    difficulty_climbing_stairs: Optional[str] = None


class GaitAnalysisResult(BaseModel):
    """Gait analysis metrics extracted from sensor data."""
    step_count: int = 0
    avg_step_time: float = 0.0
    gait_symmetry: float = 0.0
    stride_variability: float = 0.0
    recording_duration: float = 0.0
    total_samples: int = 0


class PredictionDetail(BaseModel):
    """Core ML prediction output."""
    label: int
    class_name: str
    KOA_probability: float
    Healthy_probability: float
    threshold: float


class PredictionResponse(BaseModel):
    """Full response for POST /predict."""
    status: str
    prediction: Optional[PredictionDetail] = None
    gait_analysis: Optional[GaitAnalysisResult] = None
    risk_level: Optional[str] = None
    confidence: Optional[float] = None
    score: Optional[int] = None
    risk_factors: Optional[list[str]] = None
    recommendations: Optional[list[str]] = None
    model_version: Optional[str] = None
    timestamp: Optional[str] = None
    error: Optional[str] = None


# ─────────────────────────────────────────────
# Database Schemas (Auth, Patients, Screenings)
# ─────────────────────────────────────────────
from datetime import datetime


class UserRegisterRequest(BaseModel):
    """Payload for POST /auth/register."""
    username: str = Field(..., min_length=3, max_length=100)
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=100)


class UserLoginRequest(BaseModel):
    """Payload for POST /auth/login."""
    username: str = Field(..., min_length=1)  # Can be username or email
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    """Public user response model."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    created_at: datetime


class LoginResponse(BaseModel):
    """Response for POST /auth/login."""
    message: str = "Login successful"
    user: UserResponse


class PatientCreateRequest(BaseModel):
    """Payload for POST /patients."""
    name: str = Field(..., min_length=1, max_length=255)
    age: int = Field(..., ge=1, le=120)
    sex: str = Field(..., min_length=1, max_length=20)
    height: Optional[float] = Field(None, ge=30.0, le=250.0, description="Height in cm")
    weight: Optional[float] = Field(None, ge=10.0, le=300.0, description="Weight in kg")
    bmi: Optional[float] = Field(None, ge=10.0, le=80.0, description="Body Mass Index")
    user_id: Optional[int] = Field(None, description="Optional ID of healthcare worker who registered patient")


class PatientResponse(BaseModel):
    """Response model for patient records."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    name: str
    age: int
    sex: str
    height: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    created_at: datetime


class ScreeningCreateRequest(BaseModel):
    """Payload for POST /screenings."""
    patient_id: int = Field(..., description="ID of patient this screening belongs to")
    risk_result: str = Field(..., min_length=1, max_length=50, description="e.g. Low Risk, Moderate Risk, High Risk")
    risk_probability: float = Field(..., ge=0.0, le=1.0, description="KOA risk probability from 0.0 to 1.0")


class ScreeningResponse(BaseModel):
    """Response model for screening records."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    risk_result: str
    risk_probability: float
    created_at: datetime


