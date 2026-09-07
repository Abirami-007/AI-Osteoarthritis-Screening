/**
 * Mock data generators for the OA Screening System
 * Used until real ESP32 sensor data and ML model are connected.
 */

/**
 * Generate mock accelerometer data (100 samples)
 * Simulates x, y, z acceleration values during walking
 */
export function generateMockSensorData() {
  const samples = 100;
  const accelX = [];
  const accelY = [];
  const accelZ = [];
  const gyroX = [];
  const gyroY = [];
  const gyroZ = [];

  for (let i = 0; i < samples; i++) {
    // Walking gait pattern simulation
    const t = i / samples;
    const gaitCycle = Math.sin(t * Math.PI * 8); // ~4 steps

    accelX.push(+(0.2 * gaitCycle + (Math.random() - 0.5) * 0.3).toFixed(3));
    accelY.push(+(9.8 + 0.5 * Math.abs(gaitCycle) + (Math.random() - 0.5) * 0.2).toFixed(3));
    accelZ.push(+(0.15 * gaitCycle + (Math.random() - 0.5) * 0.2).toFixed(3));

    gyroX.push(+(10 * gaitCycle + (Math.random() - 0.5) * 5).toFixed(2));
    gyroY.push(+(5 * Math.cos(t * Math.PI * 8) + (Math.random() - 0.5) * 3).toFixed(2));
    gyroZ.push(+(3 * gaitCycle + (Math.random() - 0.5) * 2).toFixed(2));
  }

  return {
    accelerometer: { x: accelX, y: accelY, z: accelZ },
    gyroscope: { x: gyroX, y: gyroY, z: gyroZ },
    sampleRate: 100, // Hz
    duration: 10, // seconds
    totalSamples: samples,
  };
}

/**
 * Generate a mock ML prediction based on questionnaire data.
 * Uses simple rule-based scoring until real model is connected.
 */
export function generateMockPrediction(questionnaireData) {
  let score = 0;

  const bmi = parseFloat(questionnaireData.bmi);
  if (bmi >= 30) score += 25;
  else if (bmi >= 25) score += 15;
  else if (bmi >= 18.5) score += 5;

  const age = parseInt(questionnaireData.age);
  if (age >= 60) score += 20;
  else if (age >= 45) score += 12;
  else if (age >= 35) score += 5;

  const painScore = parseInt(questionnaireData.painScore);
  if (painScore >= 7) score += 20;
  else if (painScore >= 4) score += 12;
  else score += 3;

  if (questionnaireData.stiffness === 'Severe') score += 15;
  else if (questionnaireData.stiffness === 'Moderate') score += 10;
  else if (questionnaireData.stiffness === 'Mild') score += 5;

  if (questionnaireData.previousKneeInjury === 'Yes') score += 15;

  if (questionnaireData.physicalActivity === 'Low') score += 10;
  else if (questionnaireData.physicalActivity === 'Moderate') score += 5;

  if (questionnaireData.difficultyWalking === 'Yes') score += 10;
  if (questionnaireData.difficultyClimbingStairs === 'Yes') score += 10;

  // Clamp to 100
  score = Math.min(score, 100);

  let riskLevel;
  if (score >= 60) riskLevel = 'High';
  else if (score >= 35) riskLevel = 'Moderate';
  else riskLevel = 'Low';

  // Determine risk factors
  const riskFactors = [];
  if (bmi >= 25) riskFactors.push('Elevated BMI');
  if (age >= 45) riskFactors.push('Age over 45');
  if (painScore >= 5) riskFactors.push('Significant knee pain');
  if (questionnaireData.stiffness === 'Moderate' || questionnaireData.stiffness === 'Severe') {
    riskFactors.push('Joint stiffness');
  }
  if (questionnaireData.previousKneeInjury === 'Yes') riskFactors.push('History of knee injury');
  if (questionnaireData.physicalActivity === 'Low') riskFactors.push('Low physical activity');
  if (questionnaireData.difficultyWalking === 'Yes') riskFactors.push('Difficulty walking');
  if (questionnaireData.difficultyClimbingStairs === 'Yes') riskFactors.push('Difficulty climbing stairs');

  // Recommendations
  const recommendations = [];
  if (riskLevel === 'High') {
    recommendations.push('Urgent referral to orthopedic specialist recommended');
    recommendations.push('X-ray imaging of affected knee(s) advised');
    recommendations.push('Consider anti-inflammatory medication after physician consultation');
  }
  if (riskLevel === 'Moderate') {
    recommendations.push('Schedule follow-up screening in 3 months');
    recommendations.push('Monitor symptoms and maintain a symptom diary');
  }
  if (bmi >= 25) recommendations.push('Weight management program recommended');
  if (questionnaireData.physicalActivity === 'Low') {
    recommendations.push('Gentle exercises: swimming, cycling, or walking');
  }
  recommendations.push('Maintain a balanced diet rich in calcium and vitamin D');
  if (painScore >= 4) {
    recommendations.push('Apply ice/heat therapy for pain relief');
  }

  // Mock gait analysis findings
  const gaitAnalysis = {
    stepCount: Math.floor(12 + Math.random() * 6),
    avgStepTime: +(0.5 + Math.random() * 0.3).toFixed(2),
    gaitSymmetry: +(85 + Math.random() * 15).toFixed(1),
    strideVariability: +(3 + Math.random() * 8).toFixed(1),
  };

  return {
    score,
    riskLevel,
    confidence: +(75 + Math.random() * 20).toFixed(1),
    riskFactors,
    recommendations,
    gaitAnalysis,
    timestamp: new Date().toISOString(),
  };
}
