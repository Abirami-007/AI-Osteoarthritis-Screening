import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { generateReportId } from '../utils/helpers';
import { QrCode, RotateCcw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCodePage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!state.reportId) {
      const reportId = generateReportId();
      dispatch({ type: 'SET_REPORT_ID', payload: reportId });
    }
  }, [state.reportId, dispatch]);

  const reportId = state.reportId;
  // Use configured app URL or fall back to current origin
  const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
  const reportUrl = `${appUrl}/report/${reportId}`;

  const handleNewScreening = () => {
    dispatch({ type: 'RESET_SCREENING' });
    navigate('/register');
  };

  if (!reportId) return null;

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <QrCode />
          </div>
          <h1 className="page-title">QR Code Generated</h1>
          <p className="page-description">
            Scan this QR code to view and download the patient report
          </p>
        </div>

        <div className="card qr-container">
          <div className="qr-wrapper">
            <QRCodeSVG
              value={reportUrl}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="#FFFFFF"
              fgColor="#1A202C"
            />
          </div>

          <div className="report-id-display">
            <QrCode size={16} />
            Report ID: {reportId}
          </div>

          <p className="qr-instruction">
            Scan the QR code above using any smartphone camera or QR reader app to access the complete patient report and download it as PDF.
          </p>

          <div style={{
            background: 'var(--color-primary-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}>
            <strong style={{ color: 'var(--color-primary)' }}>Note:</strong> The QR code contains only the report URL, no personal patient data is embedded.
          </div>

          {/* Link for testing — in production this would only be accessible via QR scan */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <button
              className="btn btn-secondary btn-full"
              onClick={() => window.open(`/report/${reportId}`, '_blank')}
              id="view-report-btn"
            >
              Preview Report (for testing)
            </button>
          </div>

          <button
            className="btn btn-primary btn-lg btn-full"
            onClick={handleNewScreening}
            id="new-screening-btn"
          >
            <RotateCcw size={18} />
            Start New Screening
          </button>
        </div>
      </div>
    </Layout>
  );
}
