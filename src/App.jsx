import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext';
import './App.css';

import Login from './pages/Login';
import RegisterPatient from './pages/RegisterPatient';
import PatientQuestionnaire from './pages/PatientQuestionnaire';
import ConnectDevice from './pages/ConnectDevice';
import WalkingTest from './pages/WalkingTest';
import SensorData from './pages/SensorData';
import Analysis from './pages/Analysis';
import ScreeningResult from './pages/ScreeningResult';
import QRCodePage from './pages/QRCodePage';
import PatientReport from './pages/PatientReport';

/**
 * Auth guard — redirects to login if not authenticated
 */
function ProtectedRoute({ children }) {
  const { state } = useApp();
  if (!state.isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/report/:reportId" element={<PatientReport />} />

        {/* Protected routes */}
        <Route
          path="/register"
          element={
            <ProtectedRoute>
              <RegisterPatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/questionnaire"
          element={
            <ProtectedRoute>
              <PatientQuestionnaire />
            </ProtectedRoute>
          }
        />
        <Route
          path="/connect-device"
          element={
            <ProtectedRoute>
              <ConnectDevice />
            </ProtectedRoute>
          }
        />
        <Route
          path="/walking-test"
          element={
            <ProtectedRoute>
              <WalkingTest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sensor-data"
          element={
            <ProtectedRoute>
              <SensorData />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analysis"
          element={
            <ProtectedRoute>
              <Analysis />
            </ProtectedRoute>
          }
        />
        <Route
          path="/result"
          element={
            <ProtectedRoute>
              <ScreeningResult />
            </ProtectedRoute>
          }
        />
        <Route
          path="/qr-code"
          element={
            <ProtectedRoute>
              <QRCodePage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
