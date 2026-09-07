import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { getRiskColor } from '../utils/helpers';
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  User,
  Activity,
  ChevronRight,
} from 'lucide-react';

export default function ScreeningResult() {
  const { state } = useApp();
  const navigate = useNavigate();

  const prediction = state.prediction;
  const patient = state.patient;
  const questionnaire = state.questionnaire;

  if (!prediction) {
    return (
      <Layout>
        <div className="text-center mt-8">
          <p className="text-muted">No results available. Please complete the screening first.</p>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/register')}>
            Start Screening
          </button>
        </div>
      </Layout>
    );
  }

  const riskClass = getRiskColor(prediction.riskLevel);

  const RiskIcon = prediction.riskLevel === 'Low'
    ? ShieldCheck
    : prediction.riskLevel === 'Moderate'
    ? AlertTriangle
    : AlertCircle;

  return (
    <Layout wide>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon" style={{
            background: prediction.riskLevel === 'Low'
              ? 'var(--color-success-light)'
              : prediction.riskLevel === 'Moderate'
              ? 'var(--color-warning-light)'
              : 'var(--color-danger-light)',
            color: prediction.riskLevel === 'Low'
              ? 'var(--color-success)'
              : prediction.riskLevel === 'Moderate'
              ? 'var(--color-warning)'
              : 'var(--color-danger)',
          }}>
            <RiskIcon />
          </div>
          <h1 className="page-title">Screening Result</h1>
          <p className="page-description">
            AI-assisted OA risk assessment for {patient?.name}
          </p>
        </div>

        {/* Risk Level */}
        <div className={`risk-indicator ${riskClass}`}>
          <div className={`risk-level-text ${riskClass}`}>
            {prediction.riskLevel} Risk
          </div>
          <div className="risk-confidence">
            Confidence: {prediction.confidence}% • Score: {prediction.score}/100
          </div>
        </div>

        {/* Patient Details */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <User size={18} />
              Patient Details
            </div>
          </div>
          <div className="data-grid">
            <div className="data-item">
              <div className="data-item-label">Patient ID</div>
              <div className="data-item-value">{patient?.patientId}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Name</div>
              <div className="data-item-value">{patient?.name}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Age</div>
              <div className="data-item-value">{patient?.age} years</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Gender</div>
              <div className="data-item-value">{patient?.gender}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">BMI</div>
              <div className="data-item-value">{questionnaire?.bmi}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">BMI Category</div>
              <div className="data-item-value" style={{ textTransform: 'capitalize' }}>
                {questionnaire?.bmiCategory}
              </div>
            </div>
          </div>
        </div>

        {/* Questionnaire Summary */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Activity size={18} />
              Clinical Assessment Summary
            </div>
          </div>
          <div className="data-grid">
            <div className="data-item">
              <div className="data-item-label">Pain Score</div>
              <div className="data-item-value">{questionnaire?.painScore}/10</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Stiffness</div>
              <div className="data-item-value">{questionnaire?.stiffness}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Previous Injury</div>
              <div className="data-item-value">{questionnaire?.previousKneeInjury}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Activity Level</div>
              <div className="data-item-value">{questionnaire?.physicalActivity}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Difficulty Walking</div>
              <div className="data-item-value">{questionnaire?.difficultyWalking}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Difficulty Stairs</div>
              <div className="data-item-value">{questionnaire?.difficultyClimbingStairs}</div>
            </div>
          </div>
        </div>

        {/* Gait Analysis */}
        <div className="card mb-4">
          <div className="card-header">
            <div className="card-title">Gait Analysis</div>
          </div>
          <div className="data-grid">
            <div className="data-item">
              <div className="data-item-label">Step Count</div>
              <div className="data-item-value">{prediction.gaitAnalysis.stepCount}</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Avg Step Time</div>
              <div className="data-item-value">{prediction.gaitAnalysis.avgStepTime}s</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Gait Symmetry</div>
              <div className="data-item-value">{prediction.gaitAnalysis.gaitSymmetry}%</div>
            </div>
            <div className="data-item">
              <div className="data-item-label">Stride Variability</div>
              <div className="data-item-value">{prediction.gaitAnalysis.strideVariability}%</div>
            </div>
          </div>
        </div>

        {/* Risk Factors */}
        {prediction.riskFactors.length > 0 && (
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title" style={{ color: 'var(--color-danger)' }}>
                Risk Factors Identified
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {prediction.riskFactors.map((factor, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'var(--color-danger-bg)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text)',
                  }}
                >
                  <AlertTriangle size={16} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                  {factor}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="card mb-6">
          <div className="card-header">
            <div className="card-title" style={{ color: 'var(--color-primary)' }}>
              Recommendations
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {prediction.recommendations.map((rec, i) => (
              <div className="recommendation-item" key={i}>
                <ChevronRight />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg btn-full"
          onClick={() => navigate('/qr-code')}
          id="generate-qr-btn"
        >
          Generate QR Code
        </button>
      </div>
    </Layout>
  );
}
