import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { predict, samplesToCSV } from '../services/api';
import { Brain, CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react';

const ANALYSIS_STEPS = [
  'Uploading sensor data...',
  'Processing gait data...',
  'Extracting features...',
  'Running ML model...',
  'Calculating risk assessment...',
  'Generating result...',
];

export default function Analysis() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');
  const hasStarted = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (hasStarted.current) return;
    hasStarted.current = true;

    runAnalysis();
  }, []);

  const runAnalysis = async () => {
    try {
      // Step 1: Uploading
      setCurrentStep(0);
      await delay(400);

      // Prepare sensor CSV
      const samples = state.sensorSamples || state.sensorData?.samples;
      if (!samples || samples.length === 0) {
        throw new Error(
          'No sensor data available. Please complete the walking test with a connected sensor device.'
        );
      }

      const csvBlob = samplesToCSV(samples);

      // Step 2: Processing
      setCurrentStep(1);
      await delay(300);

      // Prepare metadata from questionnaire
      const q = state.questionnaire || {};
      const metadata = {
        patient_id: state.patient?.patientId || '',
        age: parseInt(state.patient?.age) || 0,
        gender: state.patient?.gender || '',
        bmi: parseFloat(q.bmi) || 0,
        pain_score: parseInt(q.painScore) || 0,
        stiffness: q.stiffness || '',
        previous_knee_injury: q.previousKneeInjury || '',
        physical_activity: q.physicalActivity || '',
        difficulty_walking: q.difficultyWalking || '',
        difficulty_climbing_stairs: q.difficultyClimbingStairs || '',
      };

      // Step 3: Extracting features
      setCurrentStep(2);
      await delay(300);

      // Step 4: Running ML model — actual API call
      setCurrentStep(3);

      const result = await predict(csvBlob, metadata);

      // Step 5: Risk assessment
      setCurrentStep(4);
      await delay(300);

      // Step 6: Generating result
      setCurrentStep(5);
      await delay(300);

      // Check for API-level errors (model not loaded, etc.)
      if (result.status === 'error') {
        // Still have gait analysis data — use what we have
        const partialPrediction = {
          score: 0,
          riskLevel: 'Unknown',
          confidence: 0,
          riskFactors: ['ML model not available — prediction could not be completed'],
          recommendations: [
            'Please ensure the ML model is loaded on the backend server.',
            'Contact the system administrator for assistance.',
          ],
          gaitAnalysis: result.gait_analysis || {},
          timestamp: result.timestamp,
          modelError: result.error,
        };
        dispatch({ type: 'SET_PREDICTION', payload: partialPrediction });
        setIsComplete(true);

        setTimeout(() => navigate('/result'), 1200);
        return;
      }

      // Full successful prediction
      const prediction = {
        score: result.score || 0,
        riskLevel: result.risk_level || 'Unknown',
        confidence: result.confidence || 0,
        riskFactors: result.risk_factors || [],
        recommendations: result.recommendations || [],
        gaitAnalysis: {
          stepCount: result.gait_analysis?.step_count || 0,
          avgStepTime: result.gait_analysis?.avg_step_time || 0,
          gaitSymmetry: result.gait_analysis?.gait_symmetry || 0,
          strideVariability: result.gait_analysis?.stride_variability || 0,
        },
        prediction: result.prediction || null,
        modelVersion: result.model_version || null,
        timestamp: result.timestamp || new Date().toISOString(),
      };

      dispatch({ type: 'SET_PREDICTION', payload: prediction });
      setCurrentStep(ANALYSIS_STEPS.length);
      setIsComplete(true);

      // Auto-navigate
      setTimeout(() => navigate('/result'), 1200);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
      setCurrentStep(-1);
    }
  };

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <Brain />
          </div>
          <h1 className="page-title">
            {error ? 'Analysis Failed' : isComplete ? 'Analysis Complete' : 'Analyzing Data'}
          </h1>
          <p className="page-description">
            {error
              ? 'An error occurred during analysis'
              : isComplete
              ? 'Results are ready — redirecting...'
              : 'Processing sensor data through the AI model'}
          </p>
        </div>

        <div className="card">
          {!isComplete && !error && (
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div className="analysis-spinner" />
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
              <div
                style={{
                  background: 'var(--color-danger-bg)',
                  border: '1px solid var(--color-danger-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4) var(--space-5)',
                  textAlign: 'center',
                }}
              >
                <AlertCircle
                  size={32}
                  style={{ color: 'var(--color-danger)', margin: '0 auto var(--space-3)' }}
                />
                <p style={{
                  color: 'var(--color-danger)',
                  fontWeight: 'var(--font-weight-semibold)',
                  marginBottom: 'var(--space-2)',
                }}>
                  Analysis Failed
                </p>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  {error}
                </p>
              </div>

              <button
                className="btn btn-primary btn-lg btn-full mt-4"
                onClick={() => {
                  setError('');
                  setCurrentStep(0);
                  hasStarted.current = false;
                  runAnalysis();
                }}
                id="retry-analysis-btn"
              >
                Retry Analysis
              </button>

              <button
                className="btn btn-secondary btn-full mt-2"
                onClick={() => navigate('/sensor-data')}
              >
                Back to Sensor Data
              </button>
            </div>
          )}

          {/* Step progress */}
          {!error && (
            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
              {ANALYSIS_STEPS.map((step, i) => {
                const isStepComplete = i < currentStep;
                const isActive = i === currentStep && !isComplete;
                return (
                  <div
                    className={`analysis-step ${
                      isStepComplete ? 'completed' : isActive ? 'active' : 'pending'
                    }`}
                    key={i}
                  >
                    {isStepComplete ? (
                      <CheckCircle2 size={18} />
                    ) : isActive ? (
                      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Circle size={18} />
                    )}
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>
          )}

          {isComplete && (
            <div className="animate-fade-in mt-6 text-center">
              <div
                style={{
                  background: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4)',
                }}
              >
                <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
                  ✓ Analysis complete — loading results
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
