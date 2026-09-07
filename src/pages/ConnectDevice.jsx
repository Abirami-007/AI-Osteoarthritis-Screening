import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { Bluetooth, Wifi, CheckCircle2, Loader2 } from 'lucide-react';

const STAGES = [
  { id: 'searching', label: 'Searching for device...', duration: 2000 },
  { id: 'found', label: 'Device found: OA-Sensor-001', duration: 1500 },
  { id: 'connecting', label: 'Connecting...', duration: 2000 },
  { id: 'connected', label: 'Device connected successfully!', duration: 0 },
];

export default function ConnectDevice() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [stageIndex, setStageIndex] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (stageIndex < STAGES.length - 1) {
      const timer = setTimeout(() => {
        setStageIndex((prev) => prev + 1);
      }, STAGES[stageIndex].duration);
      return () => clearTimeout(timer);
    } else {
      setIsConnected(true);
    }
  }, [stageIndex]);

  const handleContinue = () => {
    dispatch({ type: 'SET_DEVICE_CONNECTED' });
    navigate('/walking-test');
  };

  const currentStage = STAGES[stageIndex];

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <Bluetooth />
          </div>
          <h1 className="page-title">Connect Device</h1>
          <p className="page-description">
            Connect the wearable sensor to begin data collection
          </p>
        </div>

        <div className="card">
          <div style={{ padding: 'var(--space-4) 0' }}>
            {STAGES.map((stage, i) => {
              const isComplete = i < stageIndex;
              const isCurrent = i === stageIndex;
              const isPending = i > stageIndex;

              return (
                <div
                  className={`status-card ${isCurrent ? 'animate-fade-in' : ''}`}
                  key={stage.id}
                  style={{
                    opacity: isPending ? 0.4 : 1,
                    borderColor: isComplete
                      ? 'var(--color-success-light)'
                      : isCurrent
                      ? 'var(--color-primary-subtle)'
                      : 'var(--color-border)',
                  }}
                >
                  <div
                    className={`status-icon ${
                      isComplete ? 'connected' : isCurrent ? 'searching' : ''
                    }`}
                    style={
                      isPending
                        ? { background: 'var(--color-bg)', color: 'var(--color-text-muted)' }
                        : {}
                    }
                  >
                    {isComplete ? (
                      <CheckCircle2 size={22} />
                    ) : isCurrent && !isConnected ? (
                      <Loader2 size={22} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                    ) : isCurrent && isConnected ? (
                      <CheckCircle2 size={22} />
                    ) : (
                      <Wifi size={22} />
                    )}
                  </div>
                  <div className="status-info">
                    <h4>{stage.label}</h4>
                    {isCurrent && !isConnected && (
                      <p>Please wait...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {isConnected && (
            <div className="animate-fade-in mt-6">
              <div
                style={{
                  background: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4) var(--space-5)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-6)',
                }}
              >
                <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
                  ✓ Device OA-Sensor-001 is ready
                </p>
                <p className="text-sm text-muted mt-2">Battery: 85% • Signal: Strong</p>
              </div>

              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={handleContinue}
                id="connect-continue-btn"
              >
                Continue to Walking Test
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
