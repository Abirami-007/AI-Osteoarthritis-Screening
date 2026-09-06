import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Layout from '../components/Layout';
import {
  isBluetoothSupported,
  connectToDevice,
  disconnectDevice,
  getBLEConfig,
} from '../services/bleService';
import { Bluetooth, CheckCircle2, Loader2, AlertTriangle, Wifi } from 'lucide-react';

export default function ConnectDevice() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle'); // idle | scanning | connected | error
  const [error, setError] = useState('');
  const [deviceName, setDeviceName] = useState('');

  // Check Bluetooth support
  const bleSupported = isBluetoothSupported();
  const bleConfig = getBLEConfig();

  const handleConnect = async () => {
    setError('');
    setStatus('scanning');

    try {
      const { device, characteristic } = await connectToDevice();

      // Store characteristic in window for WalkingTest to access
      window.__bleCharacteristic = characteristic;
      window.__bleDevice = device;

      const name = device.name || 'ESP32 Sensor';
      setDeviceName(name);
      setStatus('connected');

      // Listen for disconnection
      device.addEventListener('gattserverdisconnected', () => {
        setStatus('idle');
        setDeviceName('');
        dispatch({ type: 'SET_BLE_DISCONNECTED' });
        window.__bleCharacteristic = null;
        window.__bleDevice = null;
      });

      dispatch({
        type: 'SET_BLE_CONNECTED',
        payload: { name, id: device.id },
      });
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotFoundError') {
        setError('No compatible device found. Make sure the ESP32 is powered on and nearby.');
      } else if (err.name === 'SecurityError') {
        setError('Bluetooth permission denied. Please allow Bluetooth access.');
      } else {
        setError(err.message || 'Failed to connect to device.');
      }
    }
  };

  const handleDisconnect = () => {
    if (window.__bleDevice) {
      disconnectDevice(window.__bleDevice);
    }
    window.__bleCharacteristic = null;
    window.__bleDevice = null;
    setStatus('idle');
    setDeviceName('');
    dispatch({ type: 'SET_BLE_DISCONNECTED' });
  };

  const handleContinue = () => {
    navigate('/walking-test');
  };

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
          {/* Bluetooth not supported warning */}
          {!bleSupported && (
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
                <strong style={{ color: 'var(--color-danger)' }}>Bluetooth Not Supported</strong>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Web Bluetooth is not available in this browser. Please use Chrome, Edge, or Opera on desktop, or Chrome on Android.
              </p>
            </div>
          )}

          {/* Connection stages */}
          <div style={{ padding: 'var(--space-4) 0' }}>
            {/* Step 1: Scan */}
            <div
              className="status-card"
              style={{
                borderColor: status === 'scanning'
                  ? 'var(--color-primary-subtle)'
                  : status === 'connected'
                  ? 'var(--color-success-light)'
                  : 'var(--color-border)',
                opacity: status === 'idle' ? 0.7 : 1,
              }}
            >
              <div className={`status-icon ${status === 'connected' ? 'connected' : status === 'scanning' ? 'searching' : ''}`}>
                {status === 'scanning' ? (
                  <Loader2 size={22} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                ) : status === 'connected' ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <Bluetooth size={22} />
                )}
              </div>
              <div className="status-info">
                <h4>
                  {status === 'idle' && 'Ready to scan for device'}
                  {status === 'scanning' && 'Scanning for BLE devices...'}
                  {status === 'connected' && `Connected: ${deviceName}`}
                  {status === 'error' && 'Connection failed'}
                </h4>
                {status === 'scanning' && <p>Please select your ESP32 sensor from the browser dialog...</p>}
              </div>
            </div>

            {/* Step 2: Service discovery */}
            <div
              className="status-card"
              style={{
                borderColor: status === 'connected' ? 'var(--color-success-light)' : 'var(--color-border)',
                opacity: status === 'connected' ? 1 : 0.4,
              }}
            >
              <div className={`status-icon ${status === 'connected' ? 'connected' : ''}`}
                style={status !== 'connected' ? { background: 'var(--color-bg)', color: 'var(--color-text-muted)' } : {}}
              >
                {status === 'connected' ? <CheckCircle2 size={22} /> : <Wifi size={22} />}
              </div>
              <div className="status-info">
                <h4>{status === 'connected' ? 'Sensor service discovered' : 'Waiting for connection...'}</h4>
              </div>
            </div>

            {/* Step 3: Ready */}
            <div
              className="status-card"
              style={{
                borderColor: status === 'connected' ? 'var(--color-success-light)' : 'var(--color-border)',
                opacity: status === 'connected' ? 1 : 0.4,
              }}
            >
              <div className={`status-icon ${status === 'connected' ? 'connected' : ''}`}
                style={status !== 'connected' ? { background: 'var(--color-bg)', color: 'var(--color-text-muted)' } : {}}
              >
                {status === 'connected' ? <CheckCircle2 size={22} /> : <CheckCircle2 size={22} />}
              </div>
              <div className="status-info">
                <h4>{status === 'connected' ? 'Device ready for data collection!' : 'Waiting...'}</h4>
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="animate-fade-in"
              style={{
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-light)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-4) var(--space-5)',
                marginBottom: 'var(--space-4)',
              }}
            >
              <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)' }}>
                {error}
              </p>
            </div>
          )}

          {/* Actions */}
          {status === 'idle' && (
            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleConnect}
              disabled={!bleSupported}
              id="scan-device-btn"
            >
              <Bluetooth size={20} />
              Scan for ESP32 Sensor
            </button>
          )}

          {status === 'error' && (
            <button
              className="btn btn-primary btn-lg btn-full"
              onClick={handleConnect}
              id="retry-connect-btn"
            >
              <Bluetooth size={20} />
              Try Again
            </button>
          )}

          {status === 'connected' && (
            <div className="animate-fade-in mt-6">
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
                  ✓ {deviceName} is ready
                </p>
                <p className="text-sm text-muted mt-2">
                  Service: {bleConfig.serviceUUID.slice(0, 8)}...
                </p>
              </div>

              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={handleContinue}
                id="connect-continue-btn"
                style={{ marginBottom: 'var(--space-3)' }}
              >
                Continue to Walking Test
              </button>

              <button
                className="btn btn-secondary btn-full"
                onClick={handleDisconnect}
                id="disconnect-btn"
              >
                Disconnect Device
              </button>
            </div>
          )}

          {/* BLE config info */}
          <div style={{
            marginTop: 'var(--space-6)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}>
            <p><strong>BLE Service UUID:</strong> {bleConfig.serviceUUID}</p>
            <p><strong>Characteristic UUID:</strong> {bleConfig.characteristicUUID}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
