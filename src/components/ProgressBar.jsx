import { useApp, STEPS } from '../context/AppContext';
import { Check } from 'lucide-react';

export default function ProgressBar() {
  const { state } = useApp();

  if (!state.isLoggedIn || state.currentStep < 1) return null;

  return (
    <div className="progress-bar-container">
      <div className="progress-steps">
        {STEPS.slice(1).map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = state.currentStep > stepNum;
          const isCurrent = state.currentStep === stepNum;

          return (
            <div className="progress-step" key={step.label}>
              {index > 0 && (
                <div
                  className={`progress-connector ${
                    isCompleted ? 'completed' : 'upcoming'
                  }`}
                />
              )}
              <div
                className={`progress-dot ${
                  isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'
                }`}
                title={step.label}
              >
                {isCompleted ? <Check size={14} /> : stepNum}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
