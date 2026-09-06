"""
FastAPI application for the OA Screening System backend.

Endpoints:
    GET  /           — Welcome message
    GET  /health      — Health check
    GET  /model-info  — Model status and metadata
    POST /predict     — Run KOA screening prediction from sensor CSV + metadata
"""

import io
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import get_db, get_engine, hash_password, init_db, verify_password
from .feature_extraction import (
    EXPECTED_SENSOR_COLUMNS,
    run_full_pipeline,
    get_expected_feature_names,
    build_koa_model_features,
)
from .model_service import model_service
from .models import Patient, Screening, User
from .schemas import (
    GaitAnalysisResult,
    HealthResponse,
    LoginResponse,
    ModelInfoResponse,
    PatientCreateRequest,
    PatientResponse,
    PredictionDetail,
    PredictionResponse,
    ScreeningCreateRequest,
    ScreeningResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Lifespan
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: load ML model and initialize database tables on startup."""
    loaded = model_service.load()
    if loaded:
        logger.info("ML model loaded successfully on startup.")
    else:
        logger.warning(
            "ML model not loaded. The /predict endpoint will return errors "
            "until a trained model is placed at: %s",
            model_service.model_path,
        )

    # Initialize database tables automatically if DATABASE_URL is configured
    init_db()

    yield



# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────
app = FastAPI(
    title="KneeCare AI API",
    description=(
        "KneeCare AI — AI-Assisted Early Osteoarthritis Risk Screening System. "
        "Accepts sensor data from dual MPU6050 IMU sensors via ESP32 BLE, "
        "extracts gait features, and runs ML prediction."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ─────────────────────────────────────────────
# CORS — allow Vite dev server and configurable production origins
# ─────────────────────────────────────────────
cors_origins_env = os.getenv("CORS_ORIGINS", "").strip()
if cors_origins_env:
    allowed_origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

allow_all_origins = "*" in allowed_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if not allow_all_origins else ["*"],
    allow_credentials=not allow_all_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/")
async def root():
    """Welcome endpoint."""
    return {
        "service": "KneeCare AI API",
        "name": "KneeCare AI",
        "description": "AI-Assisted Early Osteoarthritis Risk Screening System",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "db_status": "GET /db-status",
            "model_info": "GET /model-info",
            "predict": "POST /predict",
            "auth_register": "POST /auth/register",
            "auth_login": "POST /auth/login",
            "users": "GET /users",
            "patients": "GET, POST /patients",
            "screenings": "POST /screenings, GET /screenings/{patient_id}",
        },
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        service="KneeCare AI API",
        model_loaded=model_service.is_loaded(),
    )


@app.get("/db-status")
async def db_status():
    """
    Check production database connection and verify existence of required tables.
    Returns database connection status and boolean flags for each table.
    Never exposes DATABASE_URL, passwords, or credentials.
    """
    engine = get_engine()
    if engine is None:
        return {
            "database_connected": False,
            "tables": {
                "users": False,
                "patients": False,
                "screenings": False,
            },
        }

    try:
        from sqlalchemy import inspect
        with engine.connect() as conn:
            inspector = inspect(conn)
            table_names = inspector.get_table_names()
            existing_tables = set(table_names)
            return {
                "database_connected": True,
                "tables": {
                    "users": "users" in existing_tables,
                    "patients": "patients" in existing_tables,
                    "screenings": "screenings" in existing_tables,
                },
            }
    except Exception as e:
        logger.error("Database status check failed: %s", e)
        return {
            "database_connected": False,
            "tables": {
                "users": False,
                "patients": False,
                "screenings": False,
            },
        }


@app.get("/model-info", response_model=ModelInfoResponse)
async def model_info():
    """Return information about the loaded ML model."""
    info = model_service.get_info()
    return ModelInfoResponse(**info)


@app.post("/predict", response_model=PredictionResponse)
async def predict(
    file: UploadFile = File(..., description="CSV file with sensor data"),
    patient_id: str = Form(default=""),
    age: int = Form(default=0),
    gender: str = Form(default=""),
    bmi: float = Form(default=0.0),
    pain_score: int = Form(default=0),
    stiffness: str = Form(default=""),
    previous_knee_injury: str = Form(default=""),
    physical_activity: str = Form(default=""),
    difficulty_walking: str = Form(default=""),
    difficulty_climbing_stairs: str = Form(default=""),
):
    """
    Run KOA screening prediction.

    Accepts a CSV file containing dual-MPU6050 sensor data and optional
    patient metadata. Processes the data through the feature extraction
    pipeline and runs the ML model.
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── Validate file type ──
    if file.content_type and file.content_type not in (
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Expected CSV.",
        )

    if file.filename and not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file extension. Expected .csv file.",
        )

    # ── Read CSV ──
    try:
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        df = pd.read_csv(io.BytesIO(contents))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV file: {str(e)}",
        )

    # ── Validate sensor columns ──
    missing_cols = [c for c in EXPECTED_SENSOR_COLUMNS if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Missing required sensor columns: {missing_cols}. "
                f"Expected columns: {EXPECTED_SENSOR_COLUMNS}"
            ),
        )

    # ── Run feature extraction pipeline ──
    try:
        features_df, feature_names, gait_events, rec_info = run_full_pipeline(df)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("Feature extraction failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Feature extraction failed: {str(e)}",
        )

    # ── Check model availability ──
    if not model_service.is_loaded():
        # Return gait analysis results even without model
        return PredictionResponse(
            status="error",
            error=(
                "ML model is not loaded. The prediction cannot be completed. "
                "Please ensure a trained model file exists at: "
                f"{model_service.model_path}"
            ),
            gait_analysis=GaitAnalysisResult(
                step_count=gait_events.get("step_count", 0),
                avg_step_time=gait_events.get("avg_step_time", 0.0),
                gait_symmetry=gait_events.get("gait_symmetry", 0.0),
                stride_variability=gait_events.get("stride_variability", 0.0),
                recording_duration=rec_info.get("recording_duration", 0.0),
                total_samples=rec_info.get("total_samples", 0),
            ),
            timestamp=timestamp,
        )

    # ── Prepare 26 model features from gait kinematics + metadata ──
    model_input_df = build_koa_model_features(
        df=df,
        gait_events=gait_events,
        rec_info=rec_info,
        metadata={
            "age": age,
            "gender": gender,
            "bmi": bmi,
            "pain_score": pain_score,
            "stiffness": stiffness,
            "previous_knee_injury": previous_knee_injury,
            "physical_activity": physical_activity,
            "difficulty_walking": difficulty_walking,
            "difficulty_climbing_stairs": difficulty_climbing_stairs,
        },
    )

    # ── Run prediction ──
    try:
        result = model_service.predict(model_input_df)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Prediction failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}",
        )

    # ── Compute risk assessment from prediction + questionnaire ──
    koa_prob = result["KOA_probability"]
    risk_level, score, risk_factors, recommendations = _compute_risk_assessment(
        koa_prob=koa_prob,
        age=age,
        bmi=bmi,
        pain_score=pain_score,
        stiffness=stiffness,
        previous_knee_injury=previous_knee_injury,
        physical_activity=physical_activity,
        difficulty_walking=difficulty_walking,
        difficulty_climbing_stairs=difficulty_climbing_stairs,
        gait_events=gait_events,
    )

    return PredictionResponse(
        status="success",
        prediction=PredictionDetail(
            label=result["label"],
            class_name=result["class_name"],
            KOA_probability=result["KOA_probability"],
            Healthy_probability=result["Healthy_probability"],
            threshold=result["threshold"],
        ),
        gait_analysis=GaitAnalysisResult(
            step_count=gait_events.get("step_count", 0),
            avg_step_time=gait_events.get("avg_step_time", 0.0),
            gait_symmetry=gait_events.get("gait_symmetry", 0.0),
            stride_variability=gait_events.get("stride_variability", 0.0),
            recording_duration=rec_info.get("recording_duration", 0.0),
            total_samples=rec_info.get("total_samples", 0),
        ),
        risk_level=risk_level,
        confidence=round(max(koa_prob, 1 - koa_prob) * 100, 1),
        score=score,
        risk_factors=risk_factors,
        recommendations=recommendations,
        model_version=model_service.version,
        timestamp=timestamp,
    )


def _compute_risk_assessment(
    koa_prob: float,
    age: int,
    bmi: float,
    pain_score: int,
    stiffness: str,
    previous_knee_injury: str,
    physical_activity: str,
    difficulty_walking: str,
    difficulty_climbing_stairs: str,
    gait_events: dict,
) -> tuple[str, int, list[str], list[str]]:
    """
    Combine ML probability with clinical questionnaire data to produce
    a risk assessment with factors and recommendations.

    This is NOT the ML prediction itself — the ML model produces the
    probability. This function wraps it in clinical context.
    """
    # Risk score: weighted combination of ML probability + clinical factors
    ml_score = int(koa_prob * 60)  # ML contributes up to 60 points

    clinical_score = 0
    if bmi and bmi >= 30:
        clinical_score += 10
    elif bmi and bmi >= 25:
        clinical_score += 5

    if age and age >= 60:
        clinical_score += 8
    elif age and age >= 45:
        clinical_score += 4

    if pain_score and pain_score >= 7:
        clinical_score += 8
    elif pain_score and pain_score >= 4:
        clinical_score += 4

    if stiffness in ("Severe",):
        clinical_score += 6
    elif stiffness in ("Moderate",):
        clinical_score += 4

    if previous_knee_injury == "Yes":
        clinical_score += 5

    if physical_activity == "Low":
        clinical_score += 4

    if difficulty_walking == "Yes":
        clinical_score += 3

    if difficulty_climbing_stairs == "Yes":
        clinical_score += 3

    score = min(ml_score + clinical_score, 100)

    # Risk level
    if score >= 60:
        risk_level = "High"
    elif score >= 35:
        risk_level = "Moderate"
    else:
        risk_level = "Low"

    # Risk factors
    risk_factors = []
    if koa_prob >= 0.5:
        risk_factors.append("ML model indicates elevated KOA risk")
    if bmi and bmi >= 25:
        risk_factors.append("Elevated BMI")
    if age and age >= 45:
        risk_factors.append("Age over 45")
    if pain_score and pain_score >= 5:
        risk_factors.append("Significant knee pain")
    if stiffness in ("Moderate", "Severe"):
        risk_factors.append("Joint stiffness")
    if previous_knee_injury == "Yes":
        risk_factors.append("History of knee injury")
    if physical_activity == "Low":
        risk_factors.append("Low physical activity")
    if difficulty_walking == "Yes":
        risk_factors.append("Difficulty walking")
    if difficulty_climbing_stairs == "Yes":
        risk_factors.append("Difficulty climbing stairs")
    if gait_events.get("gait_symmetry", 100) < 80:
        risk_factors.append("Gait asymmetry detected")
    if gait_events.get("stride_variability", 0) > 15:
        risk_factors.append("High stride variability")

    # Recommendations
    recommendations = []
    if risk_level == "High":
        recommendations.append("Urgent referral to orthopedic specialist recommended")
        recommendations.append("X-ray imaging of affected knee(s) advised")
        recommendations.append(
            "Consider anti-inflammatory medication after physician consultation"
        )
    if risk_level == "Moderate":
        recommendations.append("Schedule follow-up screening in 3 months")
        recommendations.append("Monitor symptoms and maintain a symptom diary")
    if bmi and bmi >= 25:
        recommendations.append("Weight management program recommended")
    if physical_activity == "Low":
        recommendations.append("Gentle exercises: swimming, cycling, or walking")
    recommendations.append("Maintain a balanced diet rich in calcium and vitamin D")
    if pain_score and pain_score >= 4:
        recommendations.append("Apply ice/heat therapy for pain relief")

    return risk_level, score, risk_factors, recommendations


# ─────────────────────────────────────────────
# Authentication Endpoints
# ─────────────────────────────────────────────

@app.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new user (healthcare worker / clinician).
    Passwords are automatically hashed securely using bcrypt.
    """
    existing = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.email)
    ).first()
    if existing:
        if existing.username.lower() == payload.username.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already registered.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already registered.",
        )

    hashed_pw = hash_password(payload.password)
    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hashed_pw,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        logger.error("Failed to register user: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user.",
        )
    return user


@app.post("/auth/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    payload: UserLoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate a user using username (or email) and password.
    Returns the authenticated user details upon success.
    """
    user = db.query(User).filter(
        (User.username == payload.username) | (User.email == payload.username)
    ).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please check your username/email and password.",
        )

    return LoginResponse(
        message="Login successful",
        user=UserResponse.model_validate(user),
    )


@app.get("/users", response_model=list[UserResponse], status_code=status.HTTP_200_OK)
async def list_users(
    db: Session = Depends(get_db),
):
    """
    Retrieve registered users (temporary admin/debug endpoint).
    Returns only id, username, email, and created_at.
    Never exposes password_hash or credentials.
    """
    return db.query(User).order_by(User.id.asc()).all()


# ─────────────────────────────────────────────
# Patient Endpoints
# ─────────────────────────────────────────────

@app.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Register a new patient record.
    Optionally links to a registered user_id.
    Automatically computes BMI from height and weight if not provided.
    """
    if payload.user_id is not None:
        user = db.query(User).filter(User.id == payload.user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with id {payload.user_id} not found.",
            )

    bmi_val = payload.bmi
    if bmi_val is None and payload.height and payload.weight:
        height_m = payload.height / 100.0
        if height_m > 0:
            bmi_val = round(payload.weight / (height_m ** 2), 2)

    patient = Patient(
        name=payload.name,
        age=payload.age,
        sex=payload.sex,
        height=payload.height,
        weight=payload.weight,
        bmi=bmi_val,
        user_id=payload.user_id,
    )
    db.add(patient)
    try:
        db.commit()
        db.refresh(patient)
    except Exception as e:
        db.rollback()
        logger.error("Failed to create patient: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create patient.",
        )
    return patient


@app.get("/patients", response_model=list[PatientResponse])
async def list_patients(
    user_id: Optional[int] = Query(None, description="Filter patients by associated user ID"),
    db: Session = Depends(get_db),
):
    """
    Retrieve all registered patients.
    Supports optional filtering by user_id.
    """
    query = db.query(Patient)
    if user_id is not None:
        query = query.filter(Patient.user_id == user_id)
    return query.order_by(Patient.created_at.desc()).all()


# ─────────────────────────────────────────────
# Screening Endpoints
# ─────────────────────────────────────────────

@app.post("/screenings", response_model=ScreeningResponse, status_code=status.HTTP_201_CREATED)
async def create_screening(
    payload: ScreeningCreateRequest,
    db: Session = Depends(get_db),
):
    """
    Record a new knee osteoarthritis risk screening result for a patient.
    """
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with id {payload.patient_id} not found.",
        )

    screening = Screening(
        patient_id=payload.patient_id,
        risk_result=payload.risk_result,
        risk_probability=payload.risk_probability,
    )
    db.add(screening)
    try:
        db.commit()
        db.refresh(screening)
    except Exception as e:
        db.rollback()
        logger.error("Failed to save screening: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save screening record.",
        )
    return screening


@app.get("/screenings/{patient_id}", response_model=list[ScreeningResponse])
async def get_patient_screenings(
    patient_id: int,
    db: Session = Depends(get_db),
):
    """
    Retrieve all historical screening records for a specific patient.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with id {patient_id} not found.",
        )

    return (
        db.query(Screening)
        .filter(Screening.patient_id == patient_id)
        .order_by(Screening.created_at.desc())
        .all()
    )

