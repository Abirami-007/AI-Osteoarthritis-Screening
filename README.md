# OA Screening System

**AI-Assisted Early Screening System for Knee Osteoarthritis (KOA)**

A real-time screening system using ESP32 + dual MPU6050 IMU sensors, a React/Vite frontend, a Python FastAPI backend, and a machine-learning model for gait-based KOA risk assessment.

---

## Architecture

```
┌───────────────────────┐     BLE     ┌──────────────┐
│   ESP32 + 2×MPU6050   │◄──────────►│   Browser     │
│   (Left + Right foot) │             │  (React/Vite) │
└───────────────────────┘             └──────┬───────┘
                                              │ HTTP POST /predict
                                              ▼
                                     ┌──────────────────┐
                                     │  FastAPI Backend  │
                                     │  (Python)         │
                                     │                   │
                                     │  ┌──────────────┐ │
                                     │  │ ML Model     │ │
                                     │  │ (.pkl)       │ │
                                     │  └──────────────┘ │
                                     └──────────────────┘
```

### User Flow
```
Login → Register Patient → Questionnaire → Connect BLE Device
→ Walking Test (collect sensor data) → View Sensor Data
→ Analysis (API call to backend) → Screening Result → QR Code → Report
```

---

## Project Structure

```
OA-Screening-System/
├── src/                          # React frontend
│   ├── components/               # Layout, Header, ProgressBar
│   ├── context/AppContext.jsx    # Global state management
│   ├── pages/                    # All 10 page components
│   ├── services/
│   │   ├── api.js                # Backend API communication
│   │   └── bleService.js         # Web Bluetooth (ESP32)
│   ├── utils/
│   │   ├── helpers.js            # BMI calc, ID generation, formatting
│   │   └── mockData.js           # [LEGACY] Mock generators (NOT used in production flow)
│   ├── App.jsx                   # Router configuration
│   ├── App.css                   # Full application styles
│   └── main.jsx                  # Entry point
│
├── backend/                      # Python FastAPI backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               # FastAPI application & endpoints
│   │   ├── schemas.py            # Pydantic request/response models
│   │   ├── feature_extraction.py # IMU → gait features pipeline
│   │   └── model_service.py      # ML model loading & prediction
│   ├── training/
│   │   └── train_model.py        # Model training pipeline
│   ├── models/
│   │   └── .gitkeep              # Place final_KOA_gait_model.pkl here
│   ├── data/uploads/             # Uploaded sensor CSVs
│   ├── tests/
│   │   └── test_api.py           # Backend API tests
│   └── requirements.txt          # Python dependencies
│
├── .env                          # Local environment variables
├── .env.example                  # Environment template
├── package.json                  # Frontend dependencies
├── vite.config.js                # Vite configuration
└── README.md                     # This file
```

---

## Setup

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.10+
- Chrome, Edge, or Opera browser (for Web Bluetooth)

### 1. Frontend Setup

```bash
cd OA-Screening-System
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

### 2. Backend Setup

```bash
cd OA-Screening-System/backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend runs at: `http://127.0.0.1:8000`

---

## API Endpoints

| Method | Path         | Description                              |
|--------|-------------|------------------------------------------|
| GET    | `/`          | Welcome message and endpoint list        |
| GET    | `/health`    | Health check (reports model loaded status)|
| GET    | `/model-info`| Model metadata, features, classes        |
| POST   | `/predict`   | Run KOA prediction from sensor CSV       |

### POST /predict

**Content-Type:** `multipart/form-data`

**Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | CSV file | Yes | Sensor data CSV |
| `patient_id` | string | No | Patient identifier |
| `age` | int | No | Patient age |
| `gender` | string | No | Male/Female/Other |
| `bmi` | float | No | Body Mass Index |
| `pain_score` | int | No | Pain score 0-10 |
| `stiffness` | string | No | None/Mild/Moderate/Severe |
| `previous_knee_injury` | string | No | Yes/No |
| `physical_activity` | string | No | Low/Moderate/High |
| `difficulty_walking` | string | No | Yes/No |
| `difficulty_climbing_stairs` | string | No | Yes/No |

**Response:**
```json
{
  "status": "success",
  "prediction": {
    "label": 0,
    "class_name": "Healthy",
    "KOA_probability": 0.21,
    "Healthy_probability": 0.79,
    "threshold": 0.5
  },
  "gait_analysis": {
    "step_count": 14,
    "avg_step_time": 0.52,
    "gait_symmetry": 92.3,
    "stride_variability": 5.8,
    "recording_duration": 10.0,
    "total_samples": 1000
  },
  "risk_level": "Low",
  "score": 18,
  "risk_factors": [],
  "recommendations": ["Maintain a balanced diet rich in calcium and vitamin D"],
  "model_version": "1.0",
  "timestamp": "2026-09-06T12:00:00Z"
}
```

---

## Expected Sensor CSV Format

The CSV uploaded to `/predict` must contain these columns:

```csv
timestamp,LF_Acc_X,LF_Acc_Y,LF_Acc_Z,LF_Gyr_X,LF_Gyr_Y,LF_Gyr_Z,RF_Acc_X,RF_Acc_Y,RF_Acc_Z,RF_Gyr_X,RF_Gyr_Y,RF_Gyr_Z
0,0.012,9.81,0.05,1.2,0.5,0.3,0.015,9.78,0.04,1.1,0.6,0.2
10,0.018,9.83,0.07,...
```

| Column | Description | Unit |
|--------|-------------|------|
| `timestamp` | Milliseconds since recording start | ms |
| `LF_Acc_X/Y/Z` | Left foot accelerometer | g |
| `LF_Gyr_X/Y/Z` | Left foot gyroscope | °/s |
| `RF_Acc_X/Y/Z` | Right foot accelerometer | g |
| `RF_Gyr_X/Y/Z` | Right foot gyroscope | °/s |

**Minimum requirements:**
- At least 50 samples
- At least 2 seconds of recording

---

## BLE Configuration

### Environment Variables
```env
VITE_BLE_SERVICE_UUID=4fafc201-1fb5-459e-8fcc-c5c9c331914b
VITE_BLE_CHARACTERISTIC_UUID=beb5483e-36e1-4688-b7f5-ea07361b26a8
```

Change these to match your ESP32 firmware's BLE service and characteristic UUIDs.

### ESP32 Packet Format

The Web Bluetooth service supports two packet formats:

**Binary (28 bytes, preferred):**
```
Bytes 0-3:   uint32  timestamp (ms)
Bytes 4-5:   int16   LF_Acc_X (raw, divide by 16384 for g)
Bytes 6-7:   int16   LF_Acc_Y
Bytes 8-9:   int16   LF_Acc_Z
Bytes 10-11: int16   LF_Gyr_X (raw, divide by 131 for °/s)
Bytes 12-13: int16   LF_Gyr_Y
Bytes 14-15: int16   LF_Gyr_Z
Bytes 16-17: int16   RF_Acc_X
Bytes 18-19: int16   RF_Acc_Y
Bytes 20-21: int16   RF_Acc_Z
Bytes 22-23: int16   RF_Gyr_X
Bytes 24-25: int16   RF_Gyr_Y
Bytes 26-27: int16   RF_Gyr_Z
```

**Text (CSV string):**
```
timestamp,lax,lay,laz,lgx,lgy,lgz,rax,ray,raz,rgx,rgy,rgz\n
```

---

## ML Model Training

### Current Status
**⚠️ No trained model is currently available.** The training pipeline is ready but requires a labeled dataset.

### How to Train

1. Place your labeled CSV dataset in `backend/data/`
2. Run the training script:

```bash
cd backend
python -m training.train_model --data data/your_dataset.csv
```

Or specify the target column:
```bash
python -m training.train_model --data data/your_dataset.csv --target label
```

3. The script will:
   - Auto-detect the target column and classes
   - Train GradientBoosting, RandomForest, and LogisticRegression
   - Evaluate with accuracy, precision, recall, F1, ROC-AUC
   - Save the best model to `models/final_KOA_gait_model.pkl`

### Model Package Format
```python
{
    "model": trained_sklearn_pipeline,  # Pipeline(StandardScaler + Classifier)
    "feature_names": ["LF_Acc_X_mean", ...],  # Exact feature list
    "classes": ["Healthy", "KOA"],  # Class labels
    "threshold": 0.5,
    "version": "1.0",
    "algorithm": "GradientBoosting",
    "metrics": {
        "accuracy": 0.92,
        "precision": 0.91,
        "recall": 0.93,
        "f1_score": 0.92,
        "roc_auc": 0.96
    }
}
```

### Feature Extraction Pipeline
```
Raw IMU (12 channels) → Low-pass filter → Gait event detection
→ 11 statistical features × 12 axes = 132 features
→ + 4 gait features (step_count, avg_step_time, gait_symmetry, stride_variability)
→ Total: 136 features
```

Statistical features per axis: mean, std, min, max, range, RMS, median, kurtosis, skewness, IQR, energy.

---

## Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Frontend
```bash
npm run dev
# Navigate through the full workflow in the browser
```

---

## Limitations

1. **No trained ML model** — The training pipeline is ready but no labeled KOA gait dataset has been provided. The `/predict` endpoint will return `status: "error"` until a model is placed at `backend/models/final_KOA_gait_model.pkl`.

2. **No ESP32 firmware** — The BLE packet format is documented but no ESP32 firmware code is included. You need to program the ESP32 to output data in the expected format.

3. **Web Bluetooth browser support** — Web Bluetooth only works in Chrome, Edge, and Opera. Safari and Firefox do not support it.

4. **Mock data file retained** — `src/utils/mockData.js` still exists but is NOT imported or used by any production page. It is kept for reference only.

---

## Medical Disclaimer

⚕️ **This screening system is intended for preliminary risk assessment and does not replace evaluation by a qualified healthcare professional.** The predictions are based on sensor gait analysis and questionnaire data processed by a machine learning model. Results should be considered alongside other clinical findings and are NOT confirmed diagnoses of Osteoarthritis.

---

## License

This project is for educational and research purposes.
