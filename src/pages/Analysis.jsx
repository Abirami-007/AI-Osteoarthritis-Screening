import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { generateMockPrediction } from '../utils/mockData';
import { Brain, CheckCircle2, Circle, Loader2 } from 'lucide-react';

const ANALYSIS_STEPS = [
  'Preprocessing sensor data...',
  'Extracting gait features...',
  'Analyzing walking patterns...',
  'Running ML prediction model...',
  'Calculating risk assessment...',
  'Generating recommendations...',
];

export default function Analysis() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentStep < ANALYSIS_STEPS.length) {
      const delay = 500 + Math.random() * 800;
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      // Analysis complete — generate prediction
      const prediction = generateMockPrediction(state.questionnaire || {});
      dispatch({ type: 'SET_PREDICTION', payload: prediction });
      setIsComplete(true);

      // Auto-navigate after a brief pause
      const navTimer = setTimeout(() => {
        navigate('/result');
      }, 1200);
      return () => clearTimeout(navTimer);
    }
  }, [currentStep, state.questionnaire, dispatch, navigate]);

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <Brain />
          </div>
          <h1 className="page-title">
            {isComplete ? 'Analysis Complete' : 'Analyzing Data'}
          </h1>
          <p className="page-description">
            {isComplete
              ? 'Results are ready — redirecting...'
              : 'AI model is processing the collected data'}
          </p>
        </div>

        <div className="card">
          {!isComplete && (
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              <div className="analysis-spinner" />
            </div>
          )}

          <div style={{ maxWidth: '400px', margin: '0 auto' }}>
            {ANALYSIS_STEPS.map((step, i) => {
              const isStepComplete = i < currentStep;
              const isActive = i === currentStep && !isComplete;
              const isPending = i > currentStep;

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
