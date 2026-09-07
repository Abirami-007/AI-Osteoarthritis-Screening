import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate, getRiskColor } from '../utils/helpers';
import {
  Activity,
  User,
  ClipboardList,
  Footprints,
  Brain,
  AlertTriangle,
  ChevronRight,
  Download,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function PatientReport() {
  const { reportId } = useParams();
  const { state } = useApp();

  const patient = state.patient;
  const questionnaire = state.questionnaire;
  const prediction = state.prediction;
  const sensorData = state.sensorData;

  const handleDownloadPDF = async () => {
    const element = document.getElementById('report-content');
    if (!element) return;

    // Dynamically import html2pdf
    const html2pdf = (await import('html2pdf.js')).default;

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `OA-Report-${reportId}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(element).save();
  };

  // If no data (e.g., QR scanned with no session), show a placeholder
  if (!patient || !prediction) {
    return (
      <div className="report-container" style={{ paddingTop: 'var(--space-16)' }}>
        <div className="card text-center" style={{ padding: 'var(--space-12)' }}>
          <Activity size={48} style={{ color: 'var(--color-primary)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Report: {reportId}</h2>
          <p className="text-muted">
            This report is currently unavailable. In production, report data would be fetched from the server using this report ID.
          </p>
          <p className="text-muted mt-4 text-sm">
            For demo purposes, please access this page through the full screening workflow.
          </p>
        </div>
      </div>
    );
  }

  const riskClass = getRiskColor(prediction.riskLevel);
  const RiskIcon = prediction.riskLevel === 'Low'
    ? ShieldCheck
    : prediction.riskLevel === 'Moderate'
    ? AlertTriangle
    : AlertCircle;

  return (
    <div className="report-container">
      {/* Download Button - Fixed Top */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: 'var(--space-4)',
        position: 'sticky',
        top: 'var(--space-4)',
        zIndex: 10,
      }}>
        <button
          className="btn btn-primary"
          onClick={handleDownloadPDF}
          id="download-pdf-btn"
        >
          <Download size={18} />
          Download as PDF
        </button>
      </div>

      {/* Report Content - This div is captured for PDF */}
      <div id="report-content">
        {/* Report Header */}
        <div className="report-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <Activity size={28} />
            <h1>OA Screening Report</h1>
          </div>
          <p>AI-Assisted Early Detection System for Osteoarthritis</p>
          <p style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', opacity: 0.75 }}>
            Report ID: {reportId} • Generated: {formatDate()}
          </p>
        </div>

        <div className="report-body">
          {/* Risk Assessment */}
          <div className="report-section">
            <div className="report-section-title">
              <RiskIcon size={20} />
              Risk Assessment
            </div>
            <div className={`risk-indicator ${riskClass}`} style={{ marginBottom: 'var(--space-4)' }}>
              <div className={`risk-level-text ${riskClass}`}>
                {prediction.riskLevel} Risk
              </div>
              <div className="risk-confidence">
                Confidence: {prediction.confidence}% • Score: {prediction.score}/100
              </div>
            </div>
          </div>

          {/* Patient Information */}
          <div className="report-section">
            <div className="report-section-title">
              <User size={20} />
              Patient Information
            </div>
            <table className="report-table">
              <tbody>
                <tr>
                  <th>Patient ID</th>
                  <td>{patient.patientId}</td>
                </tr>
                <tr>
                  <th>Name</th>
                  <td>{patient.name}</td>
                </tr>
                <tr>
                  <th>Age</th>
                  <td>{patient.age} years</td>
                </tr>
                <tr>
                  <th>Gender</th>
                  <td>{patient.gender}</td>
                </tr>
                <tr>
                  <th>Contact</th>
                  <td>{patient.contact}</td>
                </tr>
                <tr>
                  <th>BMI</th>
                  <td>{questionnaire.bmi} ({questionnaire.bmiCategory})</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Clinical Assessment */}
          <div className="report-section">
            <div className="report-section-title">
              <ClipboardList size={20} />
              Clinical Assessment
            </div>
            <table className="report-table">
              <tbody>
                <tr>
                  <th>Height</th>
                  <td>{questionnaire.height} cm</td>
                </tr>
                <tr>
                  <th>Weight</th>
                  <td>{questionnaire.weight} kg</td>
                </tr>
                <tr>
                  <th>Pain Score</th>
                  <td>{questionnaire.painScore} / 10</td>
                </tr>
                <tr>
                  <th>Stiffness</th>
                  <td>{questionnaire.stiffness}</td>
                </tr>
                <tr>
                  <th>Previous Knee Injury</th>
                  <td>{questionnaire.previousKneeInjury}</td>
                </tr>
                <tr>
                  <th>Physical Activity</th>
                  <td>{questionnaire.physicalActivity}</td>
                </tr>
                <tr>
                  <th>Difficulty Walking</th>
                  <td>{questionnaire.difficultyWalking}</td>
                </tr>
                <tr>
                  <th>Difficulty Climbing Stairs</th>
                  <td>{questionnaire.difficultyClimbingStairs}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Gait Analysis */}
          <div className="report-section">
            <div className="report-section-title">
              <Footprints size={20} />
              Walking Test & Gait Analysis
            </div>
            <table className="report-table">
              <tbody>
                <tr>
                  <th>Test Duration</th>
                  <td>{sensorData?.duration || 10}s</td>
                </tr>
                <tr>
                  <th>Total Samples</th>
                  <td>{sensorData?.totalSamples || 100}</td>
                </tr>
                <tr>
                  <th>Step Count</th>
                  <td>{prediction.gaitAnalysis.stepCount}</td>
                </tr>
                <tr>
                  <th>Avg Step Time</th>
                  <td>{prediction.gaitAnalysis.avgStepTime}s</td>
                </tr>
                <tr>
                  <th>Gait Symmetry</th>
                  <td>{prediction.gaitAnalysis.gaitSymmetry}%</td>
                </tr>
                <tr>
                  <th>Stride Variability</th>
                  <td>{prediction.gaitAnalysis.strideVariability}%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Risk Factors */}
          {prediction.riskFactors.length > 0 && (
            <div className="report-section">
              <div className="report-section-title" style={{ color: 'var(--color-danger)' }}>
                <AlertTriangle size={20} />
                Identified Risk Factors
              </div>
              {prediction.riskFactors.map((factor, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) 0',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text)',
                }}>
                  <AlertTriangle size={14} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                  {factor}
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          <div className="report-section">
            <div className="report-section-title">
              <Brain size={20} />
              Recommendations
            </div>
            {prediction.recommendations.map((rec, i) => (
              <div className="recommendation-item" key={i}>
                <ChevronRight size={16} />
                <span>{rec}</span>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div style={{
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            lineHeight: '1.6',
          }}>
            <strong>Disclaimer:</strong> This report is generated by an AI-assisted screening system and is intended for preliminary assessment only. It does not constitute a medical diagnosis. Please consult a qualified healthcare professional for a definitive diagnosis and treatment plan. The predictions are based on questionnaire responses and gait sensor data analysis, and should be considered alongside other clinical findings.
          </div>
        </div>
      </div>
    </div>
  );
}
