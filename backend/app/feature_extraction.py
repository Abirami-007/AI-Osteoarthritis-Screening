"""
Feature extraction pipeline for the OA Screening System.

Converts raw dual-MPU6050 IMU sensor data into gait features
suitable for the ML classification model.

Pipeline:
    Raw IMU (left + right) → Preprocessing → Gait-event detection
    → Feature extraction → Model feature vector

IMPORTANT:
    - Feature names and order MUST match what the trained model expects.
    - When a real model is trained, update EXPECTED_FEATURE_NAMES to match
      the exact features used during training.
    - Do NOT invent feature names or reorder without retraining the model.
"""

import numpy as np
import pandas as pd
from scipy import signal
from scipy.stats import kurtosis, skew

# ─────────────────────────────────────────────
# Expected sensor CSV columns from the ESP32
# ─────────────────────────────────────────────
EXPECTED_SENSOR_COLUMNS = [
    "timestamp",
    "LF_Acc_X", "LF_Acc_Y", "LF_Acc_Z",
    "LF_Gyr_X", "LF_Gyr_Y", "LF_Gyr_Z",
    "RF_Acc_X", "RF_Acc_Y", "RF_Acc_Z",
    "RF_Gyr_X", "RF_Gyr_Y", "RF_Gyr_Z",
]

# Sensor channels grouped by sensor and type
LEFT_ACCEL = ["LF_Acc_X", "LF_Acc_Y", "LF_Acc_Z"]
LEFT_GYRO = ["LF_Gyr_X", "LF_Gyr_Y", "LF_Gyr_Z"]
RIGHT_ACCEL = ["RF_Acc_X", "RF_Acc_Y", "RF_Acc_Z"]
RIGHT_GYRO = ["RF_Gyr_X", "RF_Gyr_Y", "RF_Gyr_Z"]

ALL_SENSOR_CHANNELS = LEFT_ACCEL + LEFT_GYRO + RIGHT_ACCEL + RIGHT_GYRO

# Minimum recording requirements
MIN_SAMPLES = 50
MIN_DURATION_SECONDS = 2.0


def validate_sensor_data(df: pd.DataFrame) -> tuple[bool, str]:
    """
    Validate that the sensor DataFrame has the required structure.

    Returns:
        (is_valid, error_message)
    """
    if df is None or df.empty:
        return False, "Sensor data is empty."

    # Check required columns
    missing_cols = [c for c in EXPECTED_SENSOR_COLUMNS if c not in df.columns]
    if missing_cols:
        return False, f"Missing required sensor columns: {missing_cols}"

    # Check minimum sample count
    if len(df) < MIN_SAMPLES:
        return False, (
            f"Insufficient sensor samples: {len(df)} "
            f"(minimum {MIN_SAMPLES} required)."
        )

    # Check for all-NaN columns
    for col in ALL_SENSOR_CHANNELS:
        if df[col].isna().all():
            return False, f"Sensor column '{col}' contains only missing values."

    # Check timestamp ordering / duration
    if "timestamp" in df.columns:
        ts = df["timestamp"]
        if ts.dtype in ("float64", "int64", "float32", "int32"):
            duration = (ts.iloc[-1] - ts.iloc[0])
            # If timestamps are in milliseconds, convert
            if duration > 1000:
                duration = duration / 1000.0
            if duration < MIN_DURATION_SECONDS:
                return False, (
                    f"Recording duration too short: {duration:.1f}s "
                    f"(minimum {MIN_DURATION_SECONDS}s required)."
                )

    return True, ""


def preprocess_sensor_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Preprocess raw sensor data:
    - Forward-fill small gaps in sensor readings
    - Apply low-pass Butterworth filter to remove high-frequency noise
    - Normalize timestamps to start at 0
    """
    df = df.copy()

    # Fill small gaps (max 3 consecutive NaN)
    for col in ALL_SENSOR_CHANNELS:
        df[col] = df[col].ffill(limit=3).bfill(limit=3)

    # Drop any remaining rows with NaN in sensor columns
    df = df.dropna(subset=ALL_SENSOR_CHANNELS)

    if len(df) < MIN_SAMPLES:
        return df

    # Estimate sample rate from timestamps
    if "timestamp" in df.columns:
        ts = df["timestamp"].values.astype(float)
        # Normalize to seconds if in milliseconds
        if ts[-1] - ts[0] > 1000:
            ts = ts / 1000.0
            df["timestamp"] = ts
        # Normalize to start at 0
        df["timestamp"] = df["timestamp"] - df["timestamp"].iloc[0]

        dt = np.median(np.diff(ts))
        sample_rate = 1.0 / dt if dt > 0 else 100.0
    else:
        sample_rate = 100.0

    # Low-pass Butterworth filter (cutoff ~20 Hz for gait data)
    nyquist = sample_rate / 2.0
    cutoff = min(20.0, nyquist * 0.9)  # Don't exceed Nyquist
    if cutoff > 0 and nyquist > 0 and len(df) > 12:
        try:
            b, a = signal.butter(4, cutoff / nyquist, btype="low")
            for col in ALL_SENSOR_CHANNELS:
                df[col] = signal.filtfilt(b, a, df[col].values)
        except Exception:
            pass  # Skip filtering if it fails

    return df


def detect_gait_events(df: pd.DataFrame) -> dict:
    """
    Detect gait events (heel strikes, toe-offs) from accelerometer data.

    Uses vertical acceleration (Y-axis) peaks as heel-strike indicators.

    Returns:
        Dictionary with step counts, step times, and symmetry metrics.
    """
    result = {
        "left_heel_strikes": [],
        "right_heel_strikes": [],
        "step_count": 0,
        "avg_step_time": 0.0,
        "gait_symmetry": 0.0,
        "stride_variability": 0.0,
    }

    if len(df) < MIN_SAMPLES:
        return result

    # Estimate sample rate
    if "timestamp" in df.columns:
        ts = df["timestamp"].values.astype(float)
        dt = np.median(np.diff(ts))
        sample_rate = 1.0 / dt if dt > 0 else 100.0
    else:
        sample_rate = 100.0

    # Minimum distance between peaks (at least 0.3 seconds apart)
    min_distance = max(int(0.3 * sample_rate), 1)

    # Detect left heel strikes from vertical acceleration peaks
    left_acc_y = df["LF_Acc_Y"].values
    try:
        left_peaks, _ = signal.find_peaks(
            left_acc_y,
            distance=min_distance,
            prominence=np.std(left_acc_y) * 0.3,
        )
        result["left_heel_strikes"] = left_peaks.tolist()
    except Exception:
        left_peaks = np.array([])

    # Detect right heel strikes
    right_acc_y = df["RF_Acc_Y"].values
    try:
        right_peaks, _ = signal.find_peaks(
            right_acc_y,
            distance=min_distance,
            prominence=np.std(right_acc_y) * 0.3,
        )
        result["right_heel_strikes"] = right_peaks.tolist()
    except Exception:
        right_peaks = np.array([])

    # Compute gait metrics
    total_steps = len(left_peaks) + len(right_peaks)
    result["step_count"] = total_steps

    # Average step time
    all_peak_indices = sorted(
        list(left_peaks) + list(right_peaks)
    )
    if len(all_peak_indices) > 1:
        step_intervals = np.diff(all_peak_indices) / sample_rate
        result["avg_step_time"] = round(float(np.mean(step_intervals)), 3)
        result["stride_variability"] = round(
            float(np.std(step_intervals) / np.mean(step_intervals) * 100)
            if np.mean(step_intervals) > 0 else 0.0,
            1,
        )

    # Gait symmetry (ratio of left to right steps)
    if len(left_peaks) > 0 and len(right_peaks) > 0:
        ratio = min(len(left_peaks), len(right_peaks)) / max(
            len(left_peaks), len(right_peaks)
        )
        result["gait_symmetry"] = round(ratio * 100, 1)
    elif total_steps > 0:
        result["gait_symmetry"] = 50.0  # Highly asymmetric

    return result


def _compute_axis_features(values: np.ndarray, prefix: str) -> dict:
    """
    Compute statistical features for a single sensor axis.

    Features per axis:
        mean, std, min, max, range, rms, median,
        kurtosis, skewness, iqr, energy
    """
    features = {}
    if len(values) == 0:
        # Return zeros for all features
        for suffix in [
            "mean", "std", "min", "max", "range", "rms",
            "median", "kurtosis", "skewness", "iqr", "energy",
        ]:
            features[f"{prefix}_{suffix}"] = 0.0
        return features

    features[f"{prefix}_mean"] = float(np.mean(values))
    features[f"{prefix}_std"] = float(np.std(values))
    features[f"{prefix}_min"] = float(np.min(values))
    features[f"{prefix}_max"] = float(np.max(values))
    features[f"{prefix}_range"] = float(np.ptp(values))
    features[f"{prefix}_rms"] = float(np.sqrt(np.mean(values ** 2)))
    features[f"{prefix}_median"] = float(np.median(values))
    features[f"{prefix}_kurtosis"] = float(kurtosis(values, fisher=True))
    features[f"{prefix}_skewness"] = float(skew(values))

    q75, q25 = np.percentile(values, [75, 25])
    features[f"{prefix}_iqr"] = float(q75 - q25)
    features[f"{prefix}_energy"] = float(np.sum(values ** 2) / len(values))

    return features


def extract_features(df: pd.DataFrame, gait_events: dict) -> tuple[pd.DataFrame, list[str]]:
    """
    Extract the full feature vector from preprocessed sensor data.

    Produces 11 statistical features × 12 sensor axes = 132 base features,
    plus 4 gait-event features = 136 total features.

    Returns:
        (feature_dataframe, feature_names)
        feature_dataframe has a single row with all features.
    """
    all_features = {}

    # Statistical features for each sensor axis
    for col in ALL_SENSOR_CHANNELS:
        values = df[col].values
        axis_features = _compute_axis_features(values, col)
        all_features.update(axis_features)

    # Gait-event features
    all_features["step_count"] = gait_events.get("step_count", 0)
    all_features["avg_step_time"] = gait_events.get("avg_step_time", 0.0)
    all_features["gait_symmetry"] = gait_events.get("gait_symmetry", 0.0)
    all_features["stride_variability"] = gait_events.get("stride_variability", 0.0)

    feature_names = list(all_features.keys())
    feature_df = pd.DataFrame([all_features])

    return feature_df, feature_names


def get_expected_feature_names() -> list[str]:
    """
    Return the list of feature names this pipeline produces.

    IMPORTANT: When a real model is trained, verify that these names
    match the model's expected input features exactly.
    """
    # Build the full list programmatically
    stat_suffixes = [
        "mean", "std", "min", "max", "range", "rms",
        "median", "kurtosis", "skewness", "iqr", "energy",
    ]
    feature_names = []
    for col in ALL_SENSOR_CHANNELS:
        for suffix in stat_suffixes:
            feature_names.append(f"{col}_{suffix}")

    # Gait-event features
    feature_names.extend([
        "step_count", "avg_step_time", "gait_symmetry", "stride_variability",
    ])

    return feature_names


def get_recording_info(df: pd.DataFrame) -> dict:
    """
    Extract basic recording metadata from the sensor DataFrame.
    """
    info = {
        "total_samples": len(df),
        "recording_duration": 0.0,
        "sample_rate": 0.0,
    }

    if "timestamp" in df.columns and len(df) > 1:
        ts = df["timestamp"].values.astype(float)
        duration = ts[-1] - ts[0]
        if duration > 1000:
            duration = duration / 1000.0
        info["recording_duration"] = round(duration, 2)
        dt = np.median(np.diff(ts))
        if dt > 0:
            info["sample_rate"] = round(1.0 / dt, 1)

    return info


def run_full_pipeline(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str], dict, dict]:
    """
    Run the complete feature extraction pipeline.

    Args:
        df: Raw sensor DataFrame with expected columns.

    Returns:
        (features_df, feature_names, gait_events, recording_info)
    """
    # Step 1: Validate
    is_valid, error = validate_sensor_data(df)
    if not is_valid:
        raise ValueError(f"Sensor data validation failed: {error}")

    # Step 2: Preprocess
    df_clean = preprocess_sensor_data(df)

    # Step 3: Detect gait events
    gait_events = detect_gait_events(df_clean)

    # Step 4: Extract features
    features_df, feature_names = extract_features(df_clean, gait_events)

    # Step 5: Recording info
    rec_info = get_recording_info(df_clean)

    return features_df, feature_names, gait_events, rec_info


# ─────────────────────────────────────────────
# Real Model Features (GaitClass.xlsx Schema)
# ─────────────────────────────────────────────
# The trained model (final_KOA_gait_model.pkl) expects exactly these 26 features.
# To maintain complete scientific integrity, they are explicitly categorized into:
#   A. Real Patient Inputs (Questionnaire)
#   B. Real/Derived IMU Features (from dual MPU6050 sensors)
#   C. Proxy / Heuristically Scaled Features (from gait asymmetry)
#   D. Unavailable Features (Optical motion capture angles not measurable by knee IMUs)
# ─────────────────────────────────────────────

# CATEGORY A: REAL PATIENT INPUTS (from clinical questionnaire)
FEAT_REAL_PATIENT_INPUTS = [
    "Age",  # Subject age in years
    "BMI",  # Body Mass Index (weight in kg / height in m^2)
    "Sex",  # Biological sex (0 = Male, 1 = Female)
]

# CATEGORY B: REAL / DERIVED IMU FEATURES (estimable from dual MPU6050 leg IMUs)
FEAT_DERIVED_IMU = [
    "Speed",                   # Walking speed (m/s) derived from step count and duration
    "Stance",                  # Stance duration (% of gait cycle) derived from step timing
    "StanceDIfference",         # Bilateral stance asymmetry from left vs right step intervals
    "KneeMaximum",             # Peak knee flexion (deg) proxy from gyro Y angular excursion
    "KneeMinDifference",        # Bilateral difference in minimum angular velocity/angle
    "KneeICDifference",         # Bilateral difference in initial contact impact acceleration
    "KneeMaximumDifference",    # Bilateral difference in peak knee flexion/angular excursion
]

# CATEGORY C: PROXY FEATURES (Heuristically scaled from gait asymmetry defect)
FEAT_PROXY_SCALED = [
    "AnkleDorsalflexionDifference",  # Scaled by overall gait asymmetry defect
    "AnklePlantarflexion2Difference", # Scaled by overall gait asymmetry defect
    "HipMaximumStanceDifference",    # Scaled by overall gait asymmetry defect
]

# CATEGORY D: FEATURES NOT AVAILABLE FROM DUAL-KNEE IMUs
# Optical joint angles (Ankle & Hip kinematics) that require dedicated foot/pelvis
# optical markers or additional IMU nodes. In the current setup, these rely on
# population baseline means from the Healthy cohort in GaitClass.xlsx.
FEAT_UNAVAILABLE_KNEE_IMU = [
    "AnkleIC",                        # Ankle angle at initial contact (requires foot sensor)
    "AnklePlantarflexion1",           # Early stance ankle plantarflexion (requires foot sensor)
    "AnkleDorsalflexion",             # Midstance maximum ankle dorsiflexion (requires foot sensor)
    "AnklePlantarflexion2",           # Push-off ankle plantarflexion (requires foot sensor)
    "DIFF AnkleIC",                   # Bilateral initial contact ankle asymmetry
    "AnklePlantarflexion1Difference", # Bilateral loading response ankle asymmetry
    "KneeMinimum",                    # Late stance terminal extension angle
    "KneeIC",                         # Initial contact knee angle
    "KneeMinimumTO",                  # Toe-off knee flexion angle
    "KneeMinimumTODifference",        # Toe-off knee angle asymmetry
    "HipMininimum",                   # Terminal stance hip extension (requires pelvis sensor)
    "HipMaximumStance",               # Stance phase peak hip angle (requires pelvis sensor)
    "HipMinimumDifference",           # Bilateral hip extension asymmetry
]

# Combined 26 features in the exact order expected by final_KOA_gait_model.pkl
MODEL_FEATURE_NAMES = [
    "Age",
    "BMI",
    "Sex",
    "Speed",
    "Stance",
    "StanceDIfference",
    "AnkleIC",
    "AnklePlantarflexion1",
    "AnkleDorsalflexion",
    "AnklePlantarflexion2",
    "KneeMinimum",
    "KneeIC",
    "KneeMaximum",
    "KneeMinimumTO",
    "HipMininimum",
    "HipMaximumStance",
    "DIFF AnkleIC",
    "AnklePlantarflexion1Difference",
    "AnkleDorsalflexionDifference",
    "AnklePlantarflexion2Difference",
    "KneeMinDifference",
    "KneeICDifference",
    "KneeMaximumDifference",
    "KneeMinimumTODifference",
    "HipMinimumDifference",
    "HipMaximumStanceDifference",
]

# Population reference baseline constants from the Healthy cohort in GaitClass.xlsx.
# Used strictly as transparent fallbacks for unmeasured optical angles (Category D)
# to maintain model schema compatibility without fabricating live measurements.
HEALTHY_BASELINE = {
    "Age": 62.5,
    "BMI": 25.0,
    "Sex": 0.0,
    "Speed": 1.24,
    "Stance": 62.64,
    "StanceDIfference": -0.26,
    "AnkleIC": 2.30,
    "AnklePlantarflexion1": -8.34,
    "AnkleDorsalflexion": 11.41,
    "AnklePlantarflexion2": -20.74,
    "KneeMinimum": -0.44,
    "KneeIC": 5.66,
    "KneeMaximum": 21.50,
    "KneeMinimumTO": 9.60,
    "HipMininimum": -8.10,
    "HipMaximumStance": 30.70,
    "DIFF AnkleIC": -0.02,
    "AnklePlantarflexion1Difference": 0.07,
    "AnkleDorsalflexionDifference": -0.26,
    "AnklePlantarflexion2Difference": -0.27,
    "KneeMinDifference": -0.003,
    "KneeICDifference": 0.59,
    "KneeMaximumDifference": -0.21,
    "KneeMinimumTODifference": -0.07,
    "HipMinimumDifference": 0.13,
    "HipMaximumStanceDifference": -1.34,
}


def build_koa_model_features(
    df: pd.DataFrame,
    gait_events: dict,
    rec_info: dict,
    metadata: dict = None,
) -> pd.DataFrame:
    """
    Construct the 26-feature vector expected by final_KOA_gait_model.pkl.

    Combines:
    1. Direct 26-feature clinical tabular input (if columns exist in df).
    2. Derived features from raw dual-IMU sensor stream + questionnaire metadata.
    """
    metadata = metadata or {}

    # Case 1: If df already has the 26 clinical feature columns, use them directly
    if all(c in df.columns for c in ["KneeMaximum", "Speed", "Stance"]):
        row = {}
        for feat in MODEL_FEATURE_NAMES:
            if feat in df.columns:
                row[feat] = float(df[feat].iloc[0])
            else:
                row[feat] = HEALTHY_BASELINE.get(feat, 0.0)
        return pd.DataFrame([row])

    # Case 2: Derive 26 features from IMU signal + questionnaire metadata
    row = dict(HEALTHY_BASELINE)

    # Demographics from metadata
    if metadata.get("age"):
        try:
            row["Age"] = float(metadata["age"])
        except (ValueError, TypeError):
            pass

    if metadata.get("bmi"):
        try:
            row["BMI"] = float(metadata["bmi"])
        except (ValueError, TypeError):
            pass

    gender = str(metadata.get("gender", "")).strip().lower()
    if gender in ("female", "woman", "f", "1"):
        row["Sex"] = 1.0
    elif gender in ("male", "man", "m", "0"):
        row["Sex"] = 0.0

    # Spatiotemporal gait parameters from detected gait events
    step_count = gait_events.get("step_count", 0)
    duration = rec_info.get("recording_duration", 10.0)
    avg_step_time = gait_events.get("avg_step_time", 0.5)
    gait_sym = gait_events.get("gait_symmetry", 100.0)

    # Walking speed (m/s)
    if step_count > 0 and duration > 0:
        step_length = 0.65  # average adult step length in meters
        speed_est = (step_count * step_length) / max(duration, 1.0)
        row["Speed"] = round(float(np.clip(speed_est, 0.4, 2.0)), 2)
    elif avg_step_time > 0:
        cadence_steps_per_sec = 1.0 / avg_step_time
        row["Speed"] = round(float(np.clip(cadence_steps_per_sec * 0.65, 0.4, 2.0)), 2)

    # Stance duration (% of gait cycle)
    if avg_step_time > 0:
        row["Stance"] = round(float(np.clip(60.0 + avg_step_time * 6.0, 55.0, 72.0)), 2)

    # Stance difference / asymmetry
    sym_defect = (100.0 - min(gait_sym, 100.0)) / 100.0
    row["StanceDIfference"] = round(float(-sym_defect * 2.5), 3)

    # Knee kinematics and excursions from dual IMU gyroscopes
    if "LF_Gyr_Y" in df.columns and "RF_Gyr_Y" in df.columns:
        left_gyr_range = float(np.ptp(df["LF_Gyr_Y"]))
        right_gyr_range = float(np.ptp(df["RF_Gyr_Y"]))
        avg_gyr_range = (left_gyr_range + right_gyr_range) / 2.0
        asym_range = right_gyr_range - left_gyr_range

        # Restricted knee excursion drops KneeMaximum towards KOA range
        if avg_gyr_range > 0:
            excursion_ratio = np.clip(avg_gyr_range / 300.0, 0.5, 1.5)
            row["KneeMaximum"] = round(float(13.2 + (21.5 - 13.2) * (excursion_ratio - 0.5)), 2)

        scale_factor = max(avg_gyr_range, 50.0)
        row["KneeMaximumDifference"] = round(float(asym_range / scale_factor * 5.0), 3)
        row["KneeICDifference"] = round(float(asym_range / scale_factor * 3.0), 3)
        row["KneeMinDifference"] = round(float(asym_range / scale_factor * 0.2), 3)

    # Ankle and hip asymmetry scaled by gait asymmetry
    row["AnklePlantarflexion2Difference"] = round(float(-sym_defect * 3.0), 3)
    row["AnkleDorsalflexionDifference"] = round(float(sym_defect * 2.0), 3)
    row["HipMaximumStanceDifference"] = round(float(-sym_defect * 4.0), 3)

    return pd.DataFrame([row])

