"""
Unit and integration tests for KneeCare AI database integration.

Tests:
  - Secure bcrypt password hashing and verification
  - Database table creation and schema definitions
  - Auth endpoints: /auth/register and /auth/login
  - Patient endpoints: POST /patients, GET /patients
  - Screening endpoints: POST /screenings, GET /screenings/{patient_id}
  - Graceful 503 degradation when DATABASE_URL is unconfigured
  - Preserved /health and /model-info endpoints
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import (
    Base,
    get_db,
    hash_password,
    verify_password,
)
from backend.app.main import app
from backend.app.models import User, Patient, Screening

# ─────────────────────────────────────────────
# Test In-Memory SQLite Database Setup
# ─────────────────────────────────────────────
TEST_SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    """Dependency override providing isolated test database session."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_test_database():
    """Create fresh database tables before each test and drop them after."""
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Test client for FastAPI app."""
    with TestClient(app) as test_client:
        yield test_client


# ─────────────────────────────────────────────
# 1. Password Hashing Tests
# ─────────────────────────────────────────────

def test_password_hashing_and_verification():
    """Test bcrypt hashing security: random salt, correct verification, non-plaintext."""
    raw_password = "SecurePassword123!"
    hashed = hash_password(raw_password)

    # Password must not be stored in plain text
    assert hashed != raw_password
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")

    # Verification must succeed for exact match
    assert verify_password(raw_password, hashed) is True

    # Verification must fail for wrong password
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password("", hashed) is False
    assert verify_password(raw_password, "") is False


def test_password_hashing_empty_raises():
    """Test that hashing empty password raises ValueError."""
    with pytest.raises(ValueError, match="Password cannot be empty"):
        hash_password("")


# ─────────────────────────────────────────────
# 2. Auth Endpoints Tests
# ─────────────────────────────────────────────

def test_auth_register_success(client):
    """Test registering a new user."""
    payload = {
        "username": "dr_smith",
        "email": "smith@hospital.org",
        "password": "ClinicalSecretPassword123",
    }
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["username"] == "dr_smith"
    assert data["email"] == "smith@hospital.org"
    assert "password" not in data
    assert "password_hash" not in data
    assert "created_at" in data


def test_auth_register_duplicate_username_fails(client):
    """Test registering with duplicate username is rejected."""
    payload1 = {
        "username": "dr_smith",
        "email": "smith1@hospital.org",
        "password": "Password123",
    }
    client.post("/auth/register", json=payload1)

    payload2 = {
        "username": "dr_smith",
        "email": "smith2@hospital.org",
        "password": "Password456",
    }
    response = client.post("/auth/register", json=payload2)
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_auth_register_duplicate_email_fails(client):
    """Test registering with duplicate email is rejected."""
    payload1 = {
        "username": "dr_jones",
        "email": "duplicate@hospital.org",
        "password": "Password123",
    }
    client.post("/auth/register", json=payload1)

    payload2 = {
        "username": "dr_clark",
        "email": "duplicate@hospital.org",
        "password": "Password456",
    }
    response = client.post("/auth/register", json=payload2)
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_auth_login_with_username_and_email(client):
    """Test user login with both username and email identifier."""
    register_payload = {
        "username": "dr_patel",
        "email": "patel@clinic.org",
        "password": "OrthopedicPassword123",
    }
    client.post("/auth/register", json=register_payload)

    # Login with username
    login_user = client.post(
        "/auth/login",
        json={"username": "dr_patel", "password": "OrthopedicPassword123"},
    )
    assert login_user.status_code == 200
    assert login_user.json()["message"] == "Login successful"
    assert login_user.json()["user"]["username"] == "dr_patel"

    # Login with email
    login_email = client.post(
        "/auth/login",
        json={"username": "patel@clinic.org", "password": "OrthopedicPassword123"},
    )
    assert login_email.status_code == 200
    assert login_email.json()["user"]["email"] == "patel@clinic.org"

    # Login with invalid password
    bad_login = client.post(
        "/auth/login",
        json={"username": "dr_patel", "password": "WrongPassword"},
    )
    assert bad_login.status_code == 401

    # Login with non-existent user
    not_found_login = client.post(
        "/auth/login",
        json={"username": "unknown_user", "password": "AnyPassword"},
    )
    assert not_found_login.status_code == 401


# ─────────────────────────────────────────────
# 3. Patient Endpoints Tests
# ─────────────────────────────────────────────

def test_create_and_list_patients(client):
    """Test patient creation with automatic BMI calculation and listing."""
    # First create a clinician user
    user_resp = client.post(
        "/auth/register",
        json={
            "username": "clinician_1",
            "email": "clinician1@health.org",
            "password": "StrongPassword123",
        },
    )
    user_id = user_resp.json()["id"]

    # Create patient 1 (with height 170cm, weight 75kg -> BMI ~ 25.95)
    patient_payload = {
        "name": "Jane Doe",
        "age": 58,
        "sex": "Female",
        "height": 170.0,
        "weight": 75.0,
        "user_id": user_id,
    }
    create_resp = client.post("/patients", json=patient_payload)
    assert create_resp.status_code == 201
    p1 = create_resp.json()
    assert p1["name"] == "Jane Doe"
    assert p1["age"] == 58
    assert p1["sex"] == "Female"
    assert p1["bmi"] == pytest.approx(25.95, rel=1e-2)
    assert p1["user_id"] == user_id

    # Create patient 2 without user_id
    patient_payload2 = {
        "name": "John Smith",
        "age": 64,
        "sex": "Male",
        "height": 180.0,
        "weight": 85.0,
        "bmi": 26.2,
    }
    create_resp2 = client.post("/patients", json=patient_payload2)
    assert create_resp2.status_code == 201

    # List all patients
    list_resp = client.get("/patients")
    assert list_resp.status_code == 200
    all_patients = list_resp.json()
    assert len(all_patients) == 2

    # Filter by user_id
    filter_resp = client.get(f"/patients?user_id={user_id}")
    assert filter_resp.status_code == 200
    filtered = filter_resp.json()
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Jane Doe"


def test_create_patient_invalid_user_fails(client):
    """Test creating patient with non-existent user_id returns 404."""
    payload = {
        "name": "Ghost Patient",
        "age": 45,
        "sex": "Male",
        "user_id": 99999,
    }
    response = client.post("/patients", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ─────────────────────────────────────────────
# 4. Screening Endpoints Tests
# ─────────────────────────────────────────────

def test_create_and_get_screenings(client):
    """Test recording and retrieving patient screenings."""
    # Create patient
    p_resp = client.post(
        "/patients",
        json={"name": "Alice Green", "age": 62, "sex": "Female"},
    )
    patient_id = p_resp.json()["id"]

    # Record first screening
    screening_payload1 = {
        "patient_id": patient_id,
        "risk_result": "Moderate Risk",
        "risk_probability": 0.428,
    }
    s1_resp = client.post("/screenings", json=screening_payload1)
    assert s1_resp.status_code == 201
    s1 = s1_resp.json()
    assert s1["patient_id"] == patient_id
    assert s1["risk_result"] == "Moderate Risk"
    assert s1["risk_probability"] == pytest.approx(0.428)

    # Record second screening
    screening_payload2 = {
        "patient_id": patient_id,
        "risk_result": "High Risk",
        "risk_probability": 0.785,
    }
    s2_resp = client.post("/screenings", json=screening_payload2)
    assert s2_resp.status_code == 201

    # Retrieve screenings for this patient
    hist_resp = client.get(f"/screenings/{patient_id}")
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 2
    # Most recent should be first (descending by created_at)
    assert history[0]["risk_result"] == "High Risk"
    assert history[1]["risk_result"] == "Moderate Risk"


def test_create_screening_non_existent_patient_fails(client):
    """Test creating screening for non-existent patient returns 404."""
    payload = {
        "patient_id": 88888,
        "risk_result": "Low Risk",
        "risk_probability": 0.12,
    }
    response = client.post("/screenings", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_get_screenings_non_existent_patient_fails(client):
    """Test getting screenings for non-existent patient returns 404."""
    response = client.get("/screenings/99999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ─────────────────────────────────────────────
# 5. Backward Compatibility Tests
# ─────────────────────────────────────────────

def test_existing_endpoints_unaffected(client):
    """Verify that existing ML endpoints /health and /model-info remain operational."""
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "ok"
    assert health_resp.json()["model_loaded"] is True

    info_resp = client.get("/model-info")
    assert info_resp.status_code == 200
    assert info_resp.json()["model_loaded"] is True
    assert info_resp.json()["feature_count"] == 26


def test_unconfigured_db_returns_503(monkeypatch):
    """When DATABASE_URL is not set or engine is unavailable, DB endpoints return 503."""
    app.dependency_overrides.clear()
    monkeypatch.setattr("backend.app.database.get_session_maker", lambda: None)
    with TestClient(app) as test_client:
        resp = test_client.get("/patients")
        assert resp.status_code == 503
        assert "not configured" in resp.json()["detail"].lower()

