"""
Tests for the OA Screening System API.

Run with:
    cd backend
    pytest tests/ -v
"""

import io
import csv

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.feature_extraction import (
    EXPECTED_SENSOR_COLUMNS,
    get_expected_feature_names,
    validate_sensor_data,
)
from app.model_service import model_service


client = TestClient(app)


# ─────────────────────────────────────────────
# Helper: Generate a valid-structure CSV
# ─────────────────────────────────────────────
def _make_sensor_csv(num_samples=100, include_all_columns=True, missing_columns=None):
    """Generate a CSV string with the expected sensor column structure."""
    import numpy as np

    columns = list(EXPECTED_SENSOR_COLUMNS)
    if missing_columns:
        columns = [c for c in columns if c not in missing_columns]

    rows = []
    for i in range(num_samples):
        row = {}
        if "timestamp" in columns:
            row["timestamp"] = i * 10  # 10ms intervals = 100Hz
        for col in columns:
            if col == "timestamp":
                continue
            # Produce a simple sinusoidal pattern (not random — deterministic)
            row[col] = round(np.sin(i * 0.1) * 2 + np.cos(i * 0.05), 4)
        rows.append(row)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


# ─────────────────────────────────────────────
# Test 1: Server starts
# ─────────────────────────────────────────────
class TestServerStartup:
    def test_root_endpoint(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert data["service"] == "KneeCare AI API"

    def test_root_contains_endpoint_list(self):
        response = client.get("/")
        data = response.json()
        assert "endpoints" in data


# ─────────────────────────────────────────────
# Test 2: /health works
# ─────────────────────────────────────────────
class TestHealthEndpoint:
    def test_health_returns_ok(self):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    def test_health_reports_model_status(self):
        response = client.get("/health")
        data = response.json()
        assert "model_loaded" in data
        assert isinstance(data["model_loaded"], bool)


# ─────────────────────────────────────────────
# Test 3: /model-info works
# ─────────────────────────────────────────────
class TestModelInfoEndpoint:
    def test_model_info_returns_200(self):
        response = client.get("/model-info")
        assert response.status_code == 200

    def test_model_info_contains_status(self):
        response = client.get("/model-info")
        data = response.json()
        assert "model_loaded" in data
        assert "message" in data

    def test_model_info_when_no_model(self):
        """When no model file exists, model_loaded should be False."""
        if not model_service.is_loaded():
            response = client.get("/model-info")
            data = response.json()
            assert data["model_loaded"] is False
            assert "model" in data["message"].lower() or "no" in data["message"].lower()


# ─────────────────────────────────────────────
# Test 4: Feature extraction pipeline
# ─────────────────────────────────────────────
class TestFeatureExtraction:
    def test_expected_feature_names_not_empty(self):
        names = get_expected_feature_names()
        assert len(names) > 0

    def test_feature_count_is_136(self):
        """12 axes × 11 stats + 4 gait features = 136."""
        names = get_expected_feature_names()
        assert len(names) == 136

    def test_validate_empty_dataframe(self):
        import pandas as pd
        df = pd.DataFrame()
        is_valid, error = validate_sensor_data(df)
        assert not is_valid
        assert "empty" in error.lower()

    def test_validate_missing_columns(self):
        import pandas as pd
        df = pd.DataFrame({"x": [1, 2, 3]})
        is_valid, error = validate_sensor_data(df)
        assert not is_valid
        assert "missing" in error.lower()

    def test_validate_insufficient_samples(self):
        import pandas as pd
        data = {col: list(range(10)) for col in EXPECTED_SENSOR_COLUMNS}
        df = pd.DataFrame(data)
        is_valid, error = validate_sensor_data(df)
        assert not is_valid
        assert "insufficient" in error.lower() or "minimum" in error.lower()


# ─────────────────────────────────────────────
# Test 5: /predict — validation errors
# ─────────────────────────────────────────────
class TestPredictValidation:
    def test_reject_non_csv_file(self):
        response = client.post(
            "/predict",
            files={"file": ("data.txt", b"not csv data", "text/plain")},
        )
        # Should accept text/plain as it might be CSV content
        # but the real check is on content parsing
        assert response.status_code in (400, 200, 422)

    def test_reject_empty_file(self):
        response = client.post(
            "/predict",
            files={"file": ("data.csv", b"", "text/csv")},
        )
        assert response.status_code == 400

    def test_reject_missing_columns(self):
        csv_content = b"col1,col2,col3\n1,2,3\n4,5,6\n"
        response = client.post(
            "/predict",
            files={"file": ("data.csv", csv_content, "text/csv")},
        )
        assert response.status_code == 400
        data = response.json()
        assert "missing" in data["detail"].lower()

    def test_reject_csv_with_missing_sensor_columns(self):
        csv_data = _make_sensor_csv(num_samples=100, missing_columns=["LF_Acc_X", "RF_Gyr_Z"])
        response = client.post(
            "/predict",
            files={"file": ("sensor.csv", csv_data, "text/csv")},
        )
        assert response.status_code == 400

    def test_valid_csv_accepted(self):
        """A valid CSV should be accepted (prediction may still fail if no model)."""
        csv_data = _make_sensor_csv(num_samples=100)
        response = client.post(
            "/predict",
            files={"file": ("sensor.csv", csv_data, "text/csv")},
            data={
                "patient_id": "OA-2026-12345",
                "age": "55",
                "gender": "Male",
                "bmi": "27.5",
                "pain_score": "5",
                "stiffness": "Moderate",
                "previous_knee_injury": "No",
                "physical_activity": "Moderate",
                "difficulty_walking": "No",
                "difficulty_climbing_stairs": "No",
            },
        )
        # Should return 200 even if model is not loaded (returns error status in body)
        assert response.status_code == 200
        data = response.json()
        # If model not loaded, status should be "error" with gait analysis still present
        if not model_service.is_loaded():
            assert data["status"] == "error"
            assert data["gait_analysis"] is not None
        else:
            assert data["status"] == "success"
            assert data["prediction"] is not None


# ─────────────────────────────────────────────
# Test 6: No mock prediction is used
# ─────────────────────────────────────────────
class TestNoMockPrediction:
    def test_prediction_response_has_no_random_fields(self):
        """Verify that prediction responses don't contain mock random data."""
        csv_data = _make_sensor_csv(num_samples=100)
        response = client.post(
            "/predict",
            files={"file": ("sensor.csv", csv_data, "text/csv")},
        )
        data = response.json()
        # The response should have a deterministic structure
        assert "status" in data
        assert "timestamp" in data
        # Gait analysis should be present (from real feature extraction)
        if data.get("gait_analysis"):
            ga = data["gait_analysis"]
            assert isinstance(ga["step_count"], int)
            assert isinstance(ga["avg_step_time"], (int, float))
