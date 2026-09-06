/**
 * API Service for KneeCare AI — AI-Assisted Early Osteoarthritis Risk Screening System.
 *
 * Centralizes all communication with the FastAPI backend.
 * Configured via the VITE_API_BASE_URL environment variable.
 */

function resolveApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, ''); // Strip trailing slash
  }
  // In development, default to the local FastAPI development server
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000';
  }
  // In production, never fall back to localhost; default to empty string (same-origin / reverse proxy)
  return '';
}

const API_BASE_URL = resolveApiBaseUrl();

/**
 * Check backend health.
 * @returns {Promise<{status: string, service: string, model_loaded: boolean}>}
 */
export async function checkHealth() {
  const res = await fetch(`${API_BASE_URL}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Get information about the loaded ML model.
 * @returns {Promise<object>}
 */
export async function getModelInfo() {
  const res = await fetch(`${API_BASE_URL}/model-info`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Model info request failed: ${res.status}`);
  }
  return res.json();
}

/**
 * Send sensor data CSV and patient metadata to the backend for prediction.
 *
 * @param {Blob|File} csvBlob - CSV file/blob containing sensor data
 * @param {object} metadata - Patient metadata from questionnaire
 * @param {string} [metadata.patient_id]
 * @param {number} [metadata.age]
 * @param {string} [metadata.gender]
 * @param {number} [metadata.bmi]
 * @param {number} [metadata.pain_score]
 * @param {string} [metadata.stiffness]
 * @param {string} [metadata.previous_knee_injury]
 * @param {string} [metadata.physical_activity]
 * @param {string} [metadata.difficulty_walking]
 * @param {string} [metadata.difficulty_climbing_stairs]
 * @returns {Promise<object>} Prediction response
 */
export async function predict(csvBlob, metadata = {}) {
  const formData = new FormData();

  // Append CSV file
  if (csvBlob instanceof File) {
    formData.append('file', csvBlob);
  } else {
    formData.append('file', csvBlob, 'sensor_data.csv');
  }

  // Append metadata fields
  const metaFields = [
    'patient_id', 'age', 'gender', 'bmi', 'pain_score',
    'stiffness', 'previous_knee_injury', 'physical_activity',
    'difficulty_walking', 'difficulty_climbing_stairs',
  ];

  for (const field of metaFields) {
    if (metadata[field] !== undefined && metadata[field] !== null && metadata[field] !== '') {
      formData.append(field, String(metadata[field]));
    }
  }

  const res = await fetch(`${API_BASE_URL}/predict`, {
    method: 'POST',
    body: formData,
    // Do NOT set Content-Type — fetch will set it with the boundary for multipart
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Prediction request failed: ${res.status} ${res.statusText}`
    );
  }

  return res.json();
}

/**
 * Convert an array of sensor samples into a CSV Blob.
 *
 * Each sample should have:
 *   timestamp, LF_Acc_X, LF_Acc_Y, LF_Acc_Z, LF_Gyr_X, LF_Gyr_Y, LF_Gyr_Z,
 *   RF_Acc_X, RF_Acc_Y, RF_Acc_Z, RF_Gyr_X, RF_Gyr_Y, RF_Gyr_Z
 *
 * @param {Array<object>} samples - Array of sensor sample objects
 * @returns {Blob} CSV blob ready for upload
 */
export function samplesToCSV(samples) {
  if (!samples || samples.length === 0) {
    throw new Error('No sensor samples to convert.');
  }

  const columns = [
    'timestamp',
    'LF_Acc_X', 'LF_Acc_Y', 'LF_Acc_Z',
    'LF_Gyr_X', 'LF_Gyr_Y', 'LF_Gyr_Z',
    'RF_Acc_X', 'RF_Acc_Y', 'RF_Acc_Z',
    'RF_Gyr_X', 'RF_Gyr_Y', 'RF_Gyr_Z',
  ];

  const header = columns.join(',');
  const rows = samples.map((s) =>
    columns.map((col) => s[col] ?? 0).join(',')
  );

  const csvContent = [header, ...rows].join('\n');
  return new Blob([csvContent], { type: 'text/csv' });
}
