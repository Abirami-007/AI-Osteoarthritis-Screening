"""
Pydantic schemas for the OA Screening System API.
Defines request/response models for all endpoints.
"""

from pydantic import BaseModel, Field
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
