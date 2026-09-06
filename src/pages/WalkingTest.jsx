import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import { startNotifications, stopNotifications } from '../services/bleService';
import { Footprints, Play, Square, AlertTriangle } from 'lucide-react';

const TEST_DURATION = 10; // seconds

export default function WalkingTest() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState('ready'); // ready | running | complete
  const [elapsed, setElapsed] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const intervalRef = useRef(null);
  const samplesRef = useRef([]);
  const characteristicRef = useRef(null);

  const progress = Math.min((elapsed / TEST_DURATION) * 100, 100);
  const isBleConnected = !!(state.bleDevice && window.__bleCharacteristic);

  const startTest = useCallback(async () => {
    setStatus('running');
    setElapsed(0);
    setSampleCount(0);
    samplesRef.current = [];

    // Start BLE notifications if connected
    if (window.__bleCharacteristic) {
      characteristicRef.current = window.__bleCharacteristic;
      try {
        await startNotifications(characteristicRef.current, (sample) => {
          samplesRef.current.push(sample);
          setSampleCount((prev) => prev + 1);
        });
      } catch (err) {
        console.error('Failed to start BLE notifications:', err);
      }
    }

    // Timer for elapsed display
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= TEST_DURATION) {
          clearInterval(intervalRef.current);
          // Auto-stop
          handleStopInternal();
          return TEST_DURATION;
        }
        return next;
      });
    }, 100);
  }, []);

  const handleStopInternal = useCallback(async () => {
    clearInterval(intervalRef.current);

    // Stop BLE notifications
    if (characteristicRef.current) {
      try {
        await stopNotifications(characteristicRef.current);
      } catch {
        // Ignore stop errors
      }
    }

    setStatus('complete');
  }, []);

  const stopTest = useCallback(async () => {
    await handleStopInternal();
  }, [handleStopInternal]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      // Stop notifications on unmount
      if (characteristicRef.current) {
        stopNotifications(characteristicRef.current).catch(() => {});
      }
    };
  }, []);

  const handleContinue = () => {
    // Store recorded samples
    if (samplesRef.current.length > 0) {
      dispatch({
        type: 'SET_SENSOR_SAMPLES',
        payload: {
          samples: samplesRef.current,
          duration: elapsed,
        },
      });
    }
    dispatch({ type: 'SET_WALKING_COMPLETE' });
    navigate('/sensor-data');
  };

  const formatTime = (t) => {
    const s = Math.floor(t);
    const ms = Math.floor((t % 1) * 10);
    return `${s}.${ms}`;
  };

  return (
    <Layout>
      <div className="animate-slide-up">
        <div className="page-header">
          <div className="page-icon">
            <Footprints />
          </div>
          <h1 className="page-title">Walking Test</h1>
          <p className="page-description">
            {status === 'ready'
              ? 'Ask the patient to walk 10 meters at a comfortable pace'
              : status === 'running'
              ? 'Test in progress — collecting data'
              : 'Walking test completed'}
          </p>
        </div>

        <div className="card">
          {/* BLE connection warning */}
          {!isBleConnected && status === 'ready' && (
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
                <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
                <strong style={{ color: 'var(--color-danger)' }}>No Sensor Connected</strong>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                No BLE sensor device is connected. The walking test timer will run but no real sensor data will be recorded. Please go back and connect a device first.
              </p>
            </div>
          )}

          {/* Instructions */}
          {status === 'ready' && (
            <div className="mb-6" style={{ background: 'var(--color-primary-subtle)', padding: 'var(--space-4) var(--space-5)', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
                Instructions
              </h3>
              <ol style={{ paddingLeft: 'var(--space-5)', color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <li style={{ listStyleType: 'decimal' }}>Ensure the sensor device is securely attached to the patient&apos;s knee</li>
                <li style={{ listStyleType: 'decimal' }}>Mark a 10-meter straight walking path</li>
                <li style={{ listStyleType: 'decimal' }}>Ask the patient to stand at the start line</li>
                <li style={{ listStyleType: 'decimal' }}>Press &quot;Start Test&quot; and ask the patient to walk naturally</li>
                <li style={{ listStyleType: 'decimal' }}>The test will automatically stop after {TEST_DURATION} seconds</li>
              </ol>
            </div>
          )}

          {/* Walking Visual */}
          <div className="walking-visual">
            <div className="walking-timer">{formatTime(elapsed)}s</div>
            <div className="walking-timer-label">
              {status === 'ready' ? 'Ready' : status === 'running' ? 'Recording...' : 'Completed'}
            </div>

            {/* Live sample counter */}
            {(status === 'running' || status === 'complete') && (
              <div style={{
                textAlign: 'center',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-3)',
              }}>
                {isBleConnected ? (
                  <span>Samples collected: <strong style={{ color: 'var(--color-primary)' }}>{sampleCount}</strong></span>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>No sensor connected — timer only</span>
                )}
              </div>
            )}

            <div className="walking-track">
              <div className="walking-track-fill" style={{ width: `${progress}%` }} />
              <div className="walking-dot" style={{ left: `${progress}%` }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              <span>0m</span>
              <span>5m</span>
              <span>10m</span>
            </div>
          </div>

          {/* Controls */}
          {status === 'ready' && (
            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={startTest}
              id="start-test-btn"
            >
              <Play size={20} />
              Start Test
            </button>
          )}

          {status === 'running' && (
            <button
              className="btn btn-danger btn-lg btn-full"
              onClick={stopTest}
              id="stop-test-btn"
            >
              <Square size={20} />
              Stop Test Early
            </button>
          )}

          {status === 'complete' && (
            <div className="animate-fade-in">
              <div
                style={{
                  background: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-light)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-4) var(--space-5)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <p style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-semibold)' }}>
                  ✓ Walking test completed — {formatTime(elapsed)}s
                </p>
                {sampleCount > 0 && (
                  <p className="text-sm text-muted mt-2">
                    {sampleCount} sensor samples recorded
                  </p>
                )}
              </div>

              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={handleContinue}
                id="walking-continue-btn"
              >
                View Sensor Data
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
