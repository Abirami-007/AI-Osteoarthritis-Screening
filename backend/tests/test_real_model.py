"""
Tests for the trained KOA classification model pipeline.
"""

import io
import csv
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.model_service import model_service
from app.feature_extraction import EXPECTED_SENSOR_COLUMNS


client = TestClient(app)


def _make_sensor_csv(num_samples=100, amplitude=1.0):
    import numpy as np
    columns = list(EXPECTED_SENSOR_COLUMNS)
    rows = []
    for i in range(num_samples):
        row = {"timestamp": i * 10}
        for col in columns:
            if col == "timestamp":
                continue
            row[col] = round(float(np.sin(i * 0.1) * amplitude), 4)
        rows.append(row)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode("utf-8")


class TestRealModelIntegration:
    def test_model_is_loaded(self):
        assert model_service.is_loaded() is True
        info = model_service.get_info()
        assert info["model_loaded"] is True
        assert info["algorithm"] == "LogisticRegression"
        assert info["feature_count"] == 26
        assert len(info["feature_names"]) == 26

    def test_model_info_endpoint(self):
        response = client.get("/model-info")
        assert response.status_code == 200
        data = response.json()
        assert data["model_loaded"] is True
        assert data["algorithm"] == "LogisticRegression"
        assert data["feature_count"] == 26
        assert "training_metrics" in data
        assert data["training_metrics"]["test_accuracy"] > 0.80
        assert data["training_metrics"]["test_recall"] == 1.0

    def test_predict_with_real_model(self):
        csv_data = _make_sensor_csv(num_samples=100)
        response = client.post(
            "/predict",
            files={"file": ("sensor.csv", csv_data, "text/csv")},
            data={
                "age": "68",
                "bmi": "29.5",
                "gender": "Female",
                "pain_score": "7",
                "stiffness": "Severe",
                "difficulty_walking": "Yes",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "prediction" in data
        assert data["prediction"]["class_name"] in ("Healthy", "Knee Osteoarthritis")
        assert 0.0 <= data["prediction"]["KOA_probability"] <= 1.0
        assert 0.0 <= data["prediction"]["Healthy_probability"] <= 1.0
        assert round(data["prediction"]["KOA_probability"] + data["prediction"]["Healthy_probability"], 2) == 1.0

    def test_predict_deterministic(self):
        csv_data = _make_sensor_csv(num_samples=100)
        payload = {
            "age": "50",
            "bmi": "23.0",
            "gender": "Male",
            "pain_score": "1",
        }
        res1 = client.post("/predict", files={"file": ("sensor.csv", csv_data, "text/csv")}, data=payload).json()
        res2 = client.post("/predict", files={"file": ("sensor.csv", csv_data, "text/csv")}, data=payload).json()
        assert res1["prediction"]["KOA_probability"] == res2["prediction"]["KOA_probability"]
        assert res1["prediction"]["label"] == res2["prediction"]["label"]
