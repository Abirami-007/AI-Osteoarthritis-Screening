import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { BarChart3, AlertTriangle } from 'lucide-react';

export default function SensorData() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const samples = state.sensorSamples;
  const duration = state.recordingDuration;
  const hasSensorData = samples && samples.length > 0;

  // Compute summary stats from real samples
  const stats = hasSensorData
    ? {
        totalSamples: samples.length,
        duration: duration ? duration.toFixed(1) : (samples.length > 1
          ? ((samples[samples.length - 1].timestamp - samples[0].timestamp) / 1000).toFixed(1)
          : '0'),
        sampleRate: duration > 0
          ? Math.round(samples.length / duration)
          : (samples.length > 1
            ? Math.round(1000 / ((samples[samples.length - 1].timestamp - samples[0].timestamp) / (samples.length - 1)))
            : 0),
      }
    : null;

  // Prepare sensor data for context (for Analysis page)
  const handleContinue = () => {
    if (hasSensorData) {
      dispatch({
        type: 'SET_SENSOR_DATA',
        payload: {
          samples,
          totalSamples: stats.totalSamples,
          duration: parseFloat(stats.duration),
          sampleRate: stats.sampleRate,
        },
      });
    }
    navigate('/analysis');
  };

  // Extract axis values for bar chart display
  const getAxisValues = (key) => {
    if (!hasSensorData) return [];
    return samples.map((s) => s[key] || 0);
  };

  // Normalize values for bar display
  const normalizeForBars = (values) => {
    if (values.length === 0) return [];
    const max = Math.max(...values.map(Math.abs));
    if (max === 0) return values.map(() => 5);
    return values.map((v) => (Math.abs(v) / max) * 100);
  };

  // Show only a slice for readability
  const MAX_BARS = 50;

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <BarChart3 />
          </div>
          <h1 className="page-title">Sensor Data</h1>
          <p className="page-description">
            {hasSensorData
              ? 'Sensor data collected successfully'
              : 'No sensor data received'}
          </p>
        </div>

        <div className="card">
          {!hasSensorData ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
              <AlertTriangle
                size={48}
                style={{ color: 'var(--color-text-muted)', margin: '0 auto var(--space-4)' }}
              />
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                No sensor data received.
              </p>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                This could mean no BLE sensor was connected during the walking test, or the sensor did not transmit data. Please go back and ensure the device is connected.
              </p>

              <button
                className="btn btn-primary btn-lg btn-full mt-6"
                onClick={handleContinue}
                id="sensor-continue-btn"
              >
                Continue to Analysis (without sensor data)
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Summary stats */}
              <div className="data-grid mb-6">
                <div className="data-item">
                  <div className="data-item-label">Samples</div>
                  <div className="data-item-value">{stats.totalSamples}</div>
                </div>
                <div className="data-item">
                  <div className="data-item-label">Duration</div>
                  <div className="data-item-value">{stats.duration}s</div>
                </div>
                <div className="data-item">
                  <div className="data-item-label">Sample Rate</div>
                  <div className="data-item-value">{stats.sampleRate} Hz</div>
                </div>
                <div className="data-item">
                  <div className="data-item-label">Status</div>
                  <div className="data-item-value" style={{ color: 'var(--color-success)' }}>
                    Complete
                  </div>
                </div>
              </div>

              {/* Left Foot Accelerometer */}
              <h3 className="card-title mb-4">Left Foot — Accelerometer</h3>
              {['LF_Acc_X', 'LF_Acc_Y', 'LF_Acc_Z'].map((key) => (
                <div className="sensor-chart" key={key}>
                  <div className="sensor-chart-title">
                    {key.replace('LF_Acc_', 'Accel ')} Axis
                  </div>
                  <div className="sensor-bars">
                    {normalizeForBars(getAxisValues(key))
                      .slice(0, MAX_BARS)
                      .map((h, i) => (
                        <div
                          className="sensor-bar"
                          key={i}
                          style={{ height: `${Math.max(h, 5)}%` }}
                        />
                      ))}
                  </div>
                </div>
              ))}

              {/* Left Foot Gyroscope */}
              <h3 className="card-title mb-4 mt-6">Left Foot — Gyroscope</h3>
              {['LF_Gyr_X', 'LF_Gyr_Y', 'LF_Gyr_Z'].map((key) => (
                <div className="sensor-chart" key={key}>
                  <div className="sensor-chart-title">
                    {key.replace('LF_Gyr_', 'Gyro ')} Axis
                  </div>
                  <div className="sensor-bars">
                    {normalizeForBars(getAxisValues(key))
                      .slice(0, MAX_BARS)
                      .map((h, i) => (
                        <div
                          className="sensor-bar"
                          key={i}
                          style={{ height: `${Math.max(h, 5)}%` }}
                        />
                      ))}
                  </div>
                </div>
              ))}

              {/* Right Foot Accelerometer */}
              <h3 className="card-title mb-4 mt-6">Right Foot — Accelerometer</h3>
              {['RF_Acc_X', 'RF_Acc_Y', 'RF_Acc_Z'].map((key) => (
                <div className="sensor-chart" key={key}>
                  <div className="sensor-chart-title">
                    {key.replace('RF_Acc_', 'Accel ')} Axis
                  </div>
                  <div className="sensor-bars">
                    {normalizeForBars(getAxisValues(key))
                      .slice(0, MAX_BARS)
                      .map((h, i) => (
                        <div
                          className="sensor-bar"
                          key={i}
                          style={{ height: `${Math.max(h, 5)}%` }}
                        />
                      ))}
                  </div>
                </div>
              ))}

              {/* Right Foot Gyroscope */}
              <h3 className="card-title mb-4 mt-6">Right Foot — Gyroscope</h3>
              {['RF_Gyr_X', 'RF_Gyr_Y', 'RF_Gyr_Z'].map((key) => (
                <div className="sensor-chart" key={key}>
                  <div className="sensor-chart-title">
                    {key.replace('RF_Gyr_', 'Gyro ')} Axis
                  </div>
                  <div className="sensor-bars">
                    {normalizeForBars(getAxisValues(key))
                      .slice(0, MAX_BARS)
                      .map((h, i) => (
                        <div
                          className="sensor-bar"
                          key={i}
                          style={{ height: `${Math.max(h, 5)}%` }}
                        />
                      ))}
                  </div>
                </div>
              ))}

              <button
                className="btn btn-primary btn-lg btn-full mt-6"
                onClick={handleContinue}
                id="sensor-continue-btn"
              >
                Analyze Data
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
