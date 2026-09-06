/**
 * Helper utilities for the OA Screening System
 */

/**
 * Calculate BMI from weight (kg) and height (cm)
 * BMI = Weight(kg) / (Height(m))²
 */
export function calculateBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return (weightKg / (heightM * heightM)).toFixed(1);
}

/**
 * Get BMI category label
 */
export function getBMICategory(bmi) {
  if (bmi === null || bmi === undefined) return '';
  const val = parseFloat(bmi);
  if (val < 18.5) return 'underweight';
  if (val < 25) return 'normal';
  if (val < 30) return 'overweight';
  return 'obese';
}

/**
 * Get BMI category display name
 */
export function getBMICategoryLabel(bmi) {
  if (bmi === null || bmi === undefined) return '';
  const val = parseFloat(bmi);
  if (val < 18.5) return 'Underweight';
  if (val < 25) return 'Normal';
  if (val < 30) return 'Overweight';
  return 'Obese';
}

/**
 * Generate a unique Patient ID in format OA-YYYY-XXXXX
 */
export function generatePatientId() {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `OA-${year}-${random}`;
}

/**
 * Generate a unique Report ID in format RPT-XXXXXX
 */
export function generateReportId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RPT-${id}`;
}

/**
 * Get color class for risk level
 */
export function getRiskColor(level) {
  switch (level?.toLowerCase()) {
    case 'low': return 'low';
    case 'moderate': return 'moderate';
    case 'high': return 'high';
    default: return '';
  }
}

/**
 * Format a date to readable string
 */
export function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
