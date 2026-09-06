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
  Info,
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
  const hasModelError = !!prediction.modelError;

  const RiskIcon = prediction.riskLevel === 'Low'
    ? ShieldCheck
    : prediction.riskLevel === 'Moderate'
    ? AlertTriangle
    : prediction.riskLevel === 'Unknown'
    ? Info
    : AlertCircle;

  // ML prediction details (if available)
  const mlPrediction = prediction.prediction;

  return (
    <Layout wide>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon" style={{
            background: prediction.riskLevel === 'Low'
              ? 'var(--color-success-light)'
              : prediction.riskLevel === 'Moderate'
              ? 'var(--color-warning-light)'
              : prediction.riskLevel === 'Unknown'
              ? 'var(--color-border)'
              : 'var(--color-danger-light)',
            color: prediction.riskLevel === 'Low'
              ? 'var(--color-success)'
              : prediction.riskLevel === 'Moderate'
              ? 'var(--color-warning)'
              : prediction.riskLevel === 'Unknown'
              ? 'var(--color-text-muted)'
              : 'var(--color-danger)',
          }}>
            <RiskIcon />
          </div>
          <h1 className="page-title">Preliminary KOA Risk Screening</h1>
          <p className="page-description">
            AI-assisted OA risk assessment for {patient?.name}
          </p>
        </div>

        {/* Model error warning */}
        {hasModelError && (
          <div
            style={{
              background: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-light)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-4) var(--space-5)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
              <AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />
              <strong style={{ color: 'var(--color-danger)' }}>ML Model Not Available</strong>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {prediction.modelError}
            </p>
          </div>
        )}

        {/* Risk Level */}
        <div className={`risk-indicator ${riskClass}`}>
          <div className={`risk-level-text ${riskClass}`}>
            {prediction.riskLevel} Risk
          </div>
          <div className="risk-confidence">
            {prediction.confidence > 0
              ? `Confidence: ${prediction.confidence}% • Score: ${prediction.score}/100`
              : `Score: ${prediction.score}/100`}
          </div>
        </div>

        {/* ML Prediction Details */}
        {mlPrediction && (
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <Activity size={18} />
                ML Prediction
              </div>
            </div>
            <div className="data-grid">
              <div className="data-item">
                <div className="data-item-label">Classification</div>
                <div className="data-item-value">{mlPrediction.class_name}</div>
              </div>
              <div className="data-item">
                <div className="data-item-label">KOA Probability</div>
                <div className="data-item-value">
                  {(mlPrediction.KOA_probability * 100).toFixed(1)}%
                </div>
              </div>
              <div className="data-item">
                <div className="data-item-label">Healthy Probability</div>
                <div className="data-item-value">
                  {(mlPrediction.Healthy_probability * 100).toFixed(1)}%
                </div>
              </div>
              <div className="data-item">
                <div className="data-item-label">Threshold</div>
                <div className="data-item-value">{mlPrediction.threshold}</div>
              </div>
              {prediction.modelVersion && (
                <div className="data-item">
                  <div className="data-item-label">Model Version</div>
                  <div className="data-item-value">{prediction.modelVersion}</div>
                </div>
              )}
              <div className="data-item">
                <div className="data-item-label">Test Date</div>
                <div className="data-item-value">
                  {prediction.timestamp
                    ? new Date(prediction.timestamp).toLocaleDateString()
                    : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Gait Analysis */}
        {prediction.gaitAnalysis && (
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">Gait Analysis</div>
            </div>
            <div className="data-grid">
              <div className="data-item">
                <div className="data-item-label">Step Count</div>
                <div className="data-item-value">{prediction.gaitAnalysis.stepCount ?? prediction.gaitAnalysis.step_count ?? 0}</div>
              </div>
              <div className="data-item">
                <div className="data-item-label">Avg Step Time</div>
                <div className="data-item-value">{prediction.gaitAnalysis.avgStepTime ?? prediction.gaitAnalysis.avg_step_time ?? 0}s</div>
              </div>
              <div className="data-item">
                <div className="data-item-label">Gait Symmetry</div>
                <div className="data-item-value">{prediction.gaitAnalysis.gaitSymmetry ?? prediction.gaitAnalysis.gait_symmetry ?? 0}%</div>
              </div>
              <div className="data-item">
                <div className="data-item-label">Stride Variability</div>
                <div className="data-item-value">{prediction.gaitAnalysis.strideVariability ?? prediction.gaitAnalysis.stride_variability ?? 0}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Clinical Assessment Summary */}
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

        {/* Risk Factors */}
        {prediction.riskFactors && prediction.riskFactors.length > 0 && (
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
        {prediction.recommendations && prediction.recommendations.length > 0 && (
          <div className="card mb-4">
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
        )}

        {/* Disclaimer */}
        <div
          style={{
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            padding: 'var(--space-4) var(--space-5)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            lineHeight: '1.6',
            marginBottom: 'var(--space-6)',
          }}
        >
          <strong>⚕️ Medical Disclaimer:</strong> This screening result is intended for preliminary risk assessment and does not replace evaluation by a qualified healthcare professional. The predictions are based on sensor gait analysis and questionnaire data processed by a machine learning model, and should be considered alongside other clinical findings. This is NOT a confirmed diagnosis of Osteoarthritis.
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
