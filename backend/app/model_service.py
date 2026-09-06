"""
Model loading and prediction service for the OA Screening System.

Handles loading the trained model from disk and running predictions.
Gracefully reports when the model is not available.
"""

import os
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Default model path — relative to the backend directory
MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
DEFAULT_MODEL_PATH = MODEL_DIR / "final_KOA_gait_model.pkl"


class ModelService:
    """
    Manages loading and inference for the KOA screening ML model.

    The model file can be either:
      - A raw sklearn estimator/pipeline
      - A packaged dict with keys:
            model, feature_names, classes, threshold, version, metrics
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
        self.model = None
        self.feature_names: list[str] = []
        self.classes: list[str] = []
        self.threshold: float = 0.5
        self.version: str = "unknown"
        self.algorithm: str = "unknown"
        self.metrics: dict = {}
        self._loaded = False

    def load(self) -> bool:
        """
        Attempt to load the trained model from disk.

        Returns:
            True if model loaded successfully, False otherwise.
        """
        if not self.model_path.exists():
            logger.warning(
                "Model file not found at %s. "
                "Prediction endpoint will return an error until a trained model is provided.",
                self.model_path,
            )
            return False

        try:
            loaded = joblib.load(self.model_path)

            if isinstance(loaded, dict):
                # Packaged model dict
                self.model = loaded.get("model")
                self.feature_names = loaded.get("feature_names", [])
                self.classes = loaded.get("classes", [])
                self.threshold = loaded.get("threshold", 0.5)
                self.version = loaded.get("version", "1.0")
                self.metrics = loaded.get("metrics", {})
                self.algorithm = loaded.get("algorithm", type(self.model).__name__)
            else:
                # Raw sklearn estimator or pipeline
                self.model = loaded
                self.algorithm = type(loaded).__name__
                if hasattr(loaded, "classes_"):
                    self.classes = [str(c) for c in loaded.classes_]
                if hasattr(loaded, "feature_names_in_"):
                    self.feature_names = list(loaded.feature_names_in_)

            self._loaded = self.model is not None
            if self._loaded:
                logger.info(
                    "Model loaded successfully: %s (version %s, %d features)",
                    self.algorithm,
                    self.version,
                    len(self.feature_names),
                )
            return self._loaded

        except Exception as e:
            logger.error("Failed to load model from %s: %s", self.model_path, e)
            self._loaded = False
            return False

    def is_loaded(self) -> bool:
        """Check if a model is currently loaded and ready for prediction."""
        return self._loaded and self.model is not None

    def predict(self, features_df: pd.DataFrame) -> dict:
        """
        Run prediction on extracted features.

        Args:
            features_df: Single-row DataFrame with model features.

        Returns:
            dict with keys: label, class_name, probabilities, threshold

        Raises:
            RuntimeError: If model is not loaded.
            ValueError: If feature mismatch detected.
        """
        if not self.is_loaded():
            raise RuntimeError(
                "No trained model is loaded. Please provide a trained model file "
                f"at: {self.model_path}"
            )

        # Align features with what the model expects
        if self.feature_names:
            missing = [f for f in self.feature_names if f not in features_df.columns]
            if missing:
                raise ValueError(
                    f"Feature mismatch: model expects {len(self.feature_names)} features, "
                    f"but {len(missing)} are missing: {missing[:10]}..."
                )
            # Reorder columns to match training order
            features_df = features_df[self.feature_names]

        # Get prediction
        prediction = self.model.predict(features_df)[0]

        # Get probabilities if available
        probabilities = {}
        if hasattr(self.model, "predict_proba"):
            proba = self.model.predict_proba(features_df)[0]
            for i, cls in enumerate(self.model.classes_):
                probabilities[str(cls)] = round(float(proba[i]), 4)

        # Determine class name
        if self.classes:
            class_name = self.classes[int(prediction)] if int(prediction) < len(self.classes) else str(prediction)
        else:
            class_name = str(prediction)

        # Determine probabilities for KOA and Healthy
        # Adapt to whatever class names the model uses
        koa_prob = 0.0
        healthy_prob = 0.0
        if probabilities:
            # Try to identify KOA and Healthy classes
            for cls, prob in probabilities.items():
                cls_lower = str(cls).lower()
                if cls_lower in ("1", "koa", "oa", "osteoarthritis", "positive"):
                    koa_prob = prob
                elif cls_lower in ("0", "healthy", "normal", "negative", "control"):
                    healthy_prob = prob

            # Fallback: if we have exactly 2 classes
            if koa_prob == 0.0 and healthy_prob == 0.0 and len(probabilities) == 2:
                probs = list(probabilities.values())
                healthy_prob = probs[0]
                koa_prob = probs[1]

        return {
            "label": int(prediction),
            "class_name": class_name,
            "KOA_probability": koa_prob,
            "Healthy_probability": healthy_prob,
            "threshold": self.threshold,
            "raw_probabilities": probabilities,
        }

    def get_info(self) -> dict:
        """Return model metadata for the /model-info endpoint."""
        return {
            "model_loaded": self.is_loaded(),
            "model_version": self.version if self.is_loaded() else None,
            "algorithm": self.algorithm if self.is_loaded() else None,
            "feature_count": len(self.feature_names) if self.feature_names else None,
            "feature_names": self.feature_names if self.feature_names else None,
            "classes": self.classes if self.classes else None,
            "threshold": self.threshold if self.is_loaded() else None,
            "training_metrics": self.metrics if self.metrics else None,
            "message": (
                "Model loaded and ready for predictions."
                if self.is_loaded()
                else f"No model loaded. Place a trained model at: {self.model_path}"
            ),
        }


# ─────────────────────────────────────────────
# Singleton instance — created at import time
# ─────────────────────────────────────────────
model_service = ModelService()
