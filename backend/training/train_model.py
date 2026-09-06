"""
ML Model Training Pipeline for the OA Screening System.

This script trains a supervised classification model for KOA screening
using a labeled gait/IMU dataset.

USAGE:
    python -m training.train_model --data path/to/dataset.csv

    Or from the backend directory:
    python training/train_model.py --data data/your_dataset.csv

REQUIREMENTS:
    A labeled CSV dataset with:
    - Gait/IMU features (or raw sensor data that can be processed)
    - A target column indicating KOA vs Healthy (or similar classes)

    If no dataset is available, this script will exit with a clear message.

OUTPUT:
    models/final_KOA_gait_model.pkl — packaged model dict containing:
    {
        "model": trained_pipeline,
        "feature_names": [...],
        "classes": [...],
        "threshold": 0.5,
        "version": "1.0",
        "algorithm": "GradientBoosting",
        "metrics": { accuracy, precision, recall, f1, roc_auc }
    }
"""

import argparse
import json
import logging
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# Output path
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
OUTPUT_PATH = MODELS_DIR / "final_KOA_gait_model.pkl"

# Common target column names to auto-detect
POSSIBLE_TARGET_COLUMNS = [
    "label", "target", "class", "diagnosis", "group",
    "Label", "Target", "Class", "Diagnosis", "Group",
    "KOA", "koa", "OA", "oa",
    "category", "Category",
    "condition", "Condition",
]


def auto_detect_target(df: pd.DataFrame) -> str:
    """
    Auto-detect the target column from the dataset.

    Looks for common target column names. If none found, looks for
    columns with exactly 2 unique values (binary classification).
    """
    # Check known names
    for col in POSSIBLE_TARGET_COLUMNS:
        if col in df.columns:
            n_unique = df[col].nunique()
            if 2 <= n_unique <= 10:  # Reasonable number of classes
                logger.info("Auto-detected target column: '%s' (%d classes)", col, n_unique)
                return col

    # Fallback: find binary columns (excluding obvious IDs/timestamps)
    skip_patterns = ["id", "timestamp", "time", "index", "name", "date"]
    for col in df.columns:
        if any(p in col.lower() for p in skip_patterns):
            continue
        if df[col].nunique() == 2:
            logger.info(
                "Auto-detected binary target column: '%s' (values: %s)",
                col,
                df[col].unique().tolist(),
            )
            return col

    return ""


def analyze_dataset(df: pd.DataFrame, target_col: str) -> dict:
    """
    Analyze the dataset and print summary statistics.
    """
    feature_cols = [c for c in df.columns if c != target_col]

    info = {
        "total_samples": len(df),
        "total_features": len(feature_cols),
        "target_column": target_col,
        "classes": df[target_col].value_counts().to_dict(),
        "missing_values": int(df[feature_cols].isna().sum().sum()),
        "missing_per_column": {
            col: int(df[col].isna().sum())
            for col in feature_cols
            if df[col].isna().sum() > 0
        },
    }

    logger.info("=" * 60)
    logger.info("DATASET ANALYSIS")
    logger.info("=" * 60)
    logger.info("Total samples: %d", info["total_samples"])
    logger.info("Total features: %d", info["total_features"])
    logger.info("Target column: '%s'", info["target_column"])
    logger.info("Class distribution:")
    for cls, count in info["classes"].items():
        pct = count / len(df) * 100
        logger.info("  %s: %d (%.1f%%)", cls, count, pct)
    logger.info("Missing values: %d total", info["missing_values"])
    if info["missing_per_column"]:
        for col, count in info["missing_per_column"].items():
            logger.info("  %s: %d missing", col, count)
    logger.info("=" * 60)

    return info


def preprocess_data(
    df: pd.DataFrame, target_col: str
) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    """
    Preprocess the dataset for training.

    - Separates features and target
    - Removes non-numeric columns (except target)
    - Handles missing values
    - Encodes target if necessary
    """
    # Separate features and target
    y = df[target_col].copy()
    X = df.drop(columns=[target_col]).copy()

    # Keep only numeric columns
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    dropped = [c for c in X.columns if c not in numeric_cols]
    if dropped:
        logger.info("Dropping non-numeric columns: %s", dropped)
    X = X[numeric_cols]

    # Handle missing values
    missing_count = X.isna().sum().sum()
    if missing_count > 0:
        logger.info("Filling %d missing values with column medians.", missing_count)
        X = X.fillna(X.median())

    # Encode target if string
    if y.dtype == object:
        unique_classes = sorted(y.unique())
        class_map = {cls: i for i, cls in enumerate(unique_classes)}
        logger.info("Encoding target classes: %s", class_map)
        y = y.map(class_map)

    feature_names = X.columns.tolist()
    return X, y, feature_names


def train_and_evaluate(
    X_train, X_test, y_train, y_test, feature_names
) -> tuple[object, dict, str]:
    """
    Train multiple classifiers and select the best one.

    Returns:
        (best_pipeline, best_metrics, algorithm_name)
    """
    classifiers = {
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=200,
            max_depth=None,
            random_state=42,
            n_jobs=-1,
        ),
        "LogisticRegression": LogisticRegression(
            max_iter=1000,
            random_state=42,
            solver="lbfgs",
        ),
    }

    best_pipeline = None
    best_metrics = {}
    best_f1 = -1.0
    best_name = ""

    for name, clf in classifiers.items():
        logger.info("-" * 40)
        logger.info("Training: %s", name)

        # Create pipeline with scaler
        pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", clf),
        ])

        # Cross-validation on training set
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(
            pipeline, X_train, y_train, cv=cv, scoring="f1_weighted"
        )
        logger.info("  CV F1 (5-fold): %.4f ± %.4f", cv_scores.mean(), cv_scores.std())

        # Fit on full training set
        pipeline.fit(X_train, y_train)

        # Evaluate on test set
        y_pred = pipeline.predict(X_test)
        y_proba = (
            pipeline.predict_proba(X_test)[:, 1]
            if hasattr(pipeline, "predict_proba")
            else None
        )

        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, average="weighted", zero_division=0)
        rec = recall_score(y_test, y_pred, average="weighted", zero_division=0)
        f1 = f1_score(y_test, y_pred, average="weighted", zero_division=0)

        roc = 0.0
        if y_proba is not None and len(np.unique(y_test)) == 2:
            try:
                roc = roc_auc_score(y_test, y_proba)
            except ValueError:
                roc = 0.0

        metrics = {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1_score": round(f1, 4),
            "roc_auc": round(roc, 4),
            "cv_f1_mean": round(cv_scores.mean(), 4),
            "cv_f1_std": round(cv_scores.std(), 4),
        }

        logger.info("  Test Accuracy:  %.4f", acc)
        logger.info("  Test Precision: %.4f", prec)
        logger.info("  Test Recall:    %.4f", rec)
        logger.info("  Test F1:        %.4f", f1)
        if roc > 0:
            logger.info("  Test ROC-AUC:   %.4f", roc)

        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        logger.info("  Confusion Matrix:\n%s", cm)

        # Classification report
        report = classification_report(y_test, y_pred, zero_division=0)
        logger.info("  Classification Report:\n%s", report)

        # Track best model
        if f1 > best_f1:
            best_f1 = f1
            best_pipeline = pipeline
            best_metrics = metrics
            best_name = name

    logger.info("=" * 60)
    logger.info("BEST MODEL: %s (F1: %.4f)", best_name, best_f1)
    logger.info("=" * 60)

    return best_pipeline, best_metrics, best_name


def save_model(
    pipeline, feature_names, classes, metrics, algorithm, threshold=0.5
):
    """
    Save the trained model as a packaged dict.
    """
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    package = {
        "model": pipeline,
        "feature_names": feature_names,
        "classes": [str(c) for c in classes],
        "threshold": threshold,
        "version": "1.0",
        "algorithm": algorithm,
        "metrics": metrics,
    }

    joblib.dump(package, OUTPUT_PATH)
    logger.info("Model saved to: %s", OUTPUT_PATH)
    logger.info("Package contents: model, feature_names (%d), classes (%s), "
                "threshold (%.2f), version, algorithm, metrics",
                len(feature_names), classes, threshold)


def main():
    parser = argparse.ArgumentParser(
        description="Train KOA screening ML model from labeled dataset."
    )
    parser.add_argument(
        "--data",
        type=str,
        required=True,
        help="Path to the labeled training dataset (CSV file).",
    )
    parser.add_argument(
        "--target",
        type=str,
        default="",
        help="Name of the target column. If not specified, auto-detection is attempted.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Fraction of data to use for testing (default: 0.2).",
    )
    args = parser.parse_args()

    # ── Load dataset ──
    data_path = Path(args.data)
    if not data_path.exists():
        logger.error("Dataset file not found: %s", data_path)
        logger.error(
            "ML training cannot be completed because no valid labeled "
            "training dataset was found."
        )
        sys.exit(1)

    logger.info("Loading dataset from: %s", data_path)
    df = pd.read_csv(data_path)
    logger.info("Dataset shape: %s", df.shape)

    # ── Detect target column ──
    target_col = args.target or auto_detect_target(df)
    if not target_col or target_col not in df.columns:
        logger.error(
            "Could not detect target column. Available columns: %s",
            df.columns.tolist(),
        )
        logger.error(
            "Please specify the target column with --target <column_name>"
        )
        sys.exit(1)

    # ── Analyze dataset ──
    info = analyze_dataset(df, target_col)

    # ── Preprocess ──
    X, y, feature_names = preprocess_data(df, target_col)
    logger.info("Preprocessed: %d samples × %d features", len(X), len(feature_names))

    # ── Check class balance ──
    class_counts = y.value_counts()
    if class_counts.min() / class_counts.max() < 0.3:
        logger.warning(
            "Class imbalance detected! Consider using SMOTE or adjusting class weights."
        )

    # ── Train/test split ──
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=args.test_size,
        random_state=42,
        stratify=y,
    )
    logger.info(
        "Train/test split: %d train, %d test (%.0f%%/%.0f%%)",
        len(X_train), len(X_test),
        (1 - args.test_size) * 100, args.test_size * 100,
    )

    # ── Train and evaluate ──
    best_pipeline, best_metrics, algorithm = train_and_evaluate(
        X_train, X_test, y_train, y_test, feature_names
    )

    # ── Get original class names ──
    original_classes = sorted(df[target_col].unique())

    # ── Save model ──
    save_model(
        pipeline=best_pipeline,
        feature_names=feature_names,
        classes=original_classes,
        metrics=best_metrics,
        algorithm=algorithm,
    )

    logger.info("Training complete!")
    logger.info("Model saved to: %s", OUTPUT_PATH)
    logger.info("Feature count: %d", len(feature_names))
    logger.info("Classes: %s", original_classes)
    logger.info("Best algorithm: %s", algorithm)
    logger.info("Test metrics: %s", json.dumps(best_metrics, indent=2))


if __name__ == "__main__":
    main()
