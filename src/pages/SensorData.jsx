import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { generateMockSensorData } from '../utils/mockData';
import { BarChart3 } from 'lucide-react';

export default function SensorData() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data collection delay
    const timer = setTimeout(() => {
      const data = generateMockSensorData();
      setSensorData(data);
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    dispatch({ type: 'SET_SENSOR_DATA', payload: sensorData });
    navigate('/analysis');
  };

  // Normalize values for bar display
  const normalizeForBars = (values) => {
    const max = Math.max(...values.map(Math.abs));
    return values.map((v) => Math.abs(v) / max * 100);
  };

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <BarChart3 />
          </div>
          <h1 className="page-title">Sensor Data</h1>
          <p className="page-description">
            {loading ? 'Processing collected sensor data...' : 'Sensor data collected successfully'}
          </p>
        </div>

        <div className="card">
          {loading ? (
            <div className="analysis-container" style={{ padding: 'var(--space-8) var(--space-4)' }}>
              <div className="analysis-spinner" />
              <p style={{ color: 'var(--color-text-secondary)' }}>Processing sensor readings...</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Summary stats */}
              <div className="data-grid mb-6">
                <div className="data-item">
                  <div className="data-item-label">Samples</div>
                  <div className="data-item-value">{sensorData.totalSamples}</div>
                </div>
                <div className="data-item">
                  <div className="data-item-label">Duration</div>
                  <div className="data-item-value">{sensorData.duration}s</div>
                </div>
                <div className="data-item">
                  <div className="data-item-label">Sample Rate</div>
                  <div className="data-item-value">{sensorData.sampleRate} Hz</div>
                </div>
                <div className="data-item">
                  <div className="data-item-label">Status</div>
                  <div className="data-item-value" style={{ color: 'var(--color-success)' }}>Complete</div>
                </div>
              </div>

              {/* Accelerometer Charts */}
              <h3 className="card-title mb-4">Accelerometer Data</h3>
              {['x', 'y', 'z'].map((axis) => (
                <div className="sensor-chart" key={`accel-${axis}`}>
                  <div className="sensor-chart-title">
                    Accel {axis.toUpperCase()} Axis
                  </div>
                  <div className="sensor-bars">
                    {normalizeForBars(sensorData.accelerometer[axis]).slice(0, 50).map((h, i) => (
                      <div
                        className="sensor-bar"
                        key={i}
                        style={{ height: `${Math.max(h, 5)}%` }}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Gyroscope Charts */}
              <h3 className="card-title mb-4 mt-6">Gyroscope Data</h3>
              {['x', 'y', 'z'].map((axis) => (
                <div className="sensor-chart" key={`gyro-${axis}`}>
                  <div className="sensor-chart-title">
                    Gyro {axis.toUpperCase()} Axis
                  </div>
                  <div className="sensor-bars">
                    {normalizeForBars(sensorData.gyroscope[axis]).slice(0, 50).map((h, i) => (
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
