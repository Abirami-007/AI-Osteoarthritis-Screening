/**
 * Web Bluetooth Service for ESP32 + dual MPU6050 sensors.
 *
 * Handles BLE connection, notification subscription, and packet parsing
 * for the OA Screening System sensor hardware.
 *
 * Hardware setup:
 *   ESP32
 *   ├── Left MPU6050 (left foot/knee)
 *   └── Right MPU6050 (right foot/knee)
 *
 * BLE UUIDs are configurable via environment variables:
 *   VITE_BLE_SERVICE_UUID
 *   VITE_BLE_CHARACTERISTIC_UUID
 *
 * Expected ESP32 BLE packet format (28 bytes binary):
 *   Bytes 0-3:   timestamp (uint32, milliseconds)
 *   Bytes 4-5:   LF_Acc_X  (int16, raw)
 *   Bytes 6-7:   LF_Acc_Y  (int16, raw)
 *   Bytes 8-9:   LF_Acc_Z  (int16, raw)
 *   Bytes 10-11: LF_Gyr_X  (int16, raw)
 *   Bytes 12-13: LF_Gyr_Y  (int16, raw)
 *   Bytes 14-15: LF_Gyr_Z  (int16, raw)
 *   Bytes 16-17: RF_Acc_X  (int16, raw)
 *   Bytes 18-19: RF_Acc_Y  (int16, raw)
 *   Bytes 20-21: RF_Acc_Z  (int16, raw)
 *   Bytes 22-23: RF_Gyr_X  (int16, raw)
 *   Bytes 24-25: RF_Gyr_Y  (int16, raw)
 *   Bytes 26-27: RF_Gyr_Z  (int16, raw)
 *
 * Accelerometer: ±2g range → scale factor 16384 LSB/g
 * Gyroscope: ±250°/s range → scale factor 131 LSB/(°/s)
 *
 * IMPORTANT: If your ESP32 firmware uses a different packet format,
 * update the parsePacket() function below.
 */

// ─────────────────────────────────────────────
// BLE Configuration
// ─────────────────────────────────────────────
const BLE_SERVICE_UUID =
  import.meta.env.VITE_BLE_SERVICE_UUID || '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const BLE_CHARACTERISTIC_UUID =
  import.meta.env.VITE_BLE_CHARACTERISTIC_UUID || 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// MPU6050 scale factors (default ±2g, ±250°/s)
const ACCEL_SCALE = 16384.0; // LSB/g
const GYRO_SCALE = 131.0;    // LSB/(°/s)

// Expected binary packet size in bytes
const PACKET_SIZE = 28;

/**
 * Check if the browser supports Web Bluetooth API.
 * @returns {boolean}
 */
export function isBluetoothSupported() {
  return !!(navigator.bluetooth);
}

/**
 * Request and connect to an ESP32 BLE device.
 *
 * Opens the browser's Bluetooth device picker filtered by the
 * configured service UUID.
 *
 * @returns {Promise<{device: BluetoothDevice, characteristic: BluetoothRemoteGATTCharacteristic}>}
 * @throws {Error} If Bluetooth is not supported or connection fails
 */
export async function connectToDevice() {
  if (!isBluetoothSupported()) {
    throw new Error(
      'Web Bluetooth is not supported in this browser. ' +
      'Please use Chrome, Edge, or Opera on desktop, or Chrome on Android.'
    );
  }

  // Step 1: Request device
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BLE_SERVICE_UUID] }],
    // Fallback: accept devices by name pattern if service filter fails
    // optionalServices: [BLE_SERVICE_UUID],
  });

  if (!device) {
    throw new Error('No Bluetooth device selected.');
  }

  // Step 2: Connect to GATT server
  const server = await device.gatt.connect();

  // Step 3: Get the sensor data service
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);

  // Step 4: Get the sensor data characteristic
  const characteristic = await service.getCharacteristic(BLE_CHARACTERISTIC_UUID);

  return { device, characteristic };
}

/**
 * Subscribe to sensor data notifications from the BLE characteristic.
 *
 * @param {BluetoothRemoteGATTCharacteristic} characteristic
 * @param {function} onSample - Callback for each parsed sensor sample
 * @returns {Promise<void>}
 */
export async function startNotifications(characteristic, onSample) {
  characteristic.addEventListener('characteristicvaluechanged', (event) => {
    const dataView = event.target.value;
    const sample = parsePacket(dataView);
    if (sample) {
      onSample(sample);
    }
  });

  await characteristic.startNotifications();
}

/**
 * Stop sensor data notifications.
 *
 * @param {BluetoothRemoteGATTCharacteristic} characteristic
 * @returns {Promise<void>}
 */
export async function stopNotifications(characteristic) {
  try {
    await characteristic.stopNotifications();
  } catch {
    // Ignore errors during stop (device may have disconnected)
  }
}

/**
 * Disconnect from the BLE device.
 *
 * @param {BluetoothDevice} device
 */
export function disconnectDevice(device) {
  if (device?.gatt?.connected) {
    device.gatt.disconnect();
  }
}

/**
 * Parse a binary BLE packet from the ESP32 into a sensor sample object.
 *
 * Expected format: 28 bytes (see file header for layout).
 *
 * If your ESP32 firmware sends a different format, modify this function.
 *
 * @param {DataView} dataView - Raw BLE notification data
 * @returns {object|null} Parsed sensor sample or null if invalid
 */
export function parsePacket(dataView) {
  if (!dataView || dataView.byteLength < PACKET_SIZE) {
    // If packet is smaller, try to parse as text (some firmware sends CSV text)
    if (dataView && dataView.byteLength > 0) {
      return parseTextPacket(dataView);
    }
    return null;
  }

  try {
    const littleEndian = true;

    const timestamp = dataView.getUint32(0, littleEndian);

    // Left foot sensor
    const LF_Acc_X = dataView.getInt16(4, littleEndian) / ACCEL_SCALE;
    const LF_Acc_Y = dataView.getInt16(6, littleEndian) / ACCEL_SCALE;
    const LF_Acc_Z = dataView.getInt16(8, littleEndian) / ACCEL_SCALE;
    const LF_Gyr_X = dataView.getInt16(10, littleEndian) / GYRO_SCALE;
    const LF_Gyr_Y = dataView.getInt16(12, littleEndian) / GYRO_SCALE;
    const LF_Gyr_Z = dataView.getInt16(14, littleEndian) / GYRO_SCALE;

    // Right foot sensor
    const RF_Acc_X = dataView.getInt16(16, littleEndian) / ACCEL_SCALE;
    const RF_Acc_Y = dataView.getInt16(18, littleEndian) / ACCEL_SCALE;
    const RF_Acc_Z = dataView.getInt16(20, littleEndian) / ACCEL_SCALE;
    const RF_Gyr_X = dataView.getInt16(22, littleEndian) / GYRO_SCALE;
    const RF_Gyr_Y = dataView.getInt16(24, littleEndian) / GYRO_SCALE;
    const RF_Gyr_Z = dataView.getInt16(26, littleEndian) / GYRO_SCALE;

    return {
      timestamp,
      LF_Acc_X: +LF_Acc_X.toFixed(4),
      LF_Acc_Y: +LF_Acc_Y.toFixed(4),
      LF_Acc_Z: +LF_Acc_Z.toFixed(4),
      LF_Gyr_X: +LF_Gyr_X.toFixed(4),
      LF_Gyr_Y: +LF_Gyr_Y.toFixed(4),
      LF_Gyr_Z: +LF_Gyr_Z.toFixed(4),
      RF_Acc_X: +RF_Acc_X.toFixed(4),
      RF_Acc_Y: +RF_Acc_Y.toFixed(4),
      RF_Acc_Z: +RF_Acc_Z.toFixed(4),
      RF_Gyr_X: +RF_Gyr_X.toFixed(4),
      RF_Gyr_Y: +RF_Gyr_Y.toFixed(4),
      RF_Gyr_Z: +RF_Gyr_Z.toFixed(4),
    };
  } catch {
    return null;
  }
}

/**
 * Parse a text-based BLE packet (CSV format).
 *
 * Some ESP32 firmware sends sensor data as CSV text instead of binary.
 * Expected format: "timestamp,lax,lay,laz,lgx,lgy,lgz,rax,ray,raz,rgx,rgy,rgz"
 *
 * @param {DataView} dataView
 * @returns {object|null}
 */
function parseTextPacket(dataView) {
  try {
    const decoder = new TextDecoder();
    const text = decoder.decode(dataView.buffer).trim();
    const parts = text.split(',').map(Number);

    if (parts.length >= 13 && parts.every((v) => !Number.isNaN(v))) {
      return {
        timestamp: parts[0],
        LF_Acc_X: +parts[1].toFixed(4),
        LF_Acc_Y: +parts[2].toFixed(4),
        LF_Acc_Z: +parts[3].toFixed(4),
        LF_Gyr_X: +parts[4].toFixed(4),
        LF_Gyr_Y: +parts[5].toFixed(4),
        LF_Gyr_Z: +parts[6].toFixed(4),
        RF_Acc_X: +parts[7].toFixed(4),
        RF_Acc_Y: +parts[8].toFixed(4),
        RF_Acc_Z: +parts[9].toFixed(4),
        RF_Gyr_X: +parts[10].toFixed(4),
        RF_Gyr_Y: +parts[11].toFixed(4),
        RF_Gyr_Z: +parts[12].toFixed(4),
      };
    }
  } catch {
    // Not a text packet
  }
  return null;
}

/**
 * Get the configured BLE UUIDs (useful for display/debugging).
 * @returns {{serviceUUID: string, characteristicUUID: string}}
 */
export function getBLEConfig() {
  return {
    serviceUUID: BLE_SERVICE_UUID,
    characteristicUUID: BLE_CHARACTERISTIC_UUID,
  };
}
