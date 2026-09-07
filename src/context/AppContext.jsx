import { createContext, useContext, useReducer, useEffect } from 'react';

const AppContext = createContext(null);

const initialState = {
  isLoggedIn: false,
  user: null,
  patient: null,
  questionnaire: null,
  sensorData: null,
  prediction: null,
  reportId: null,
  currentStep: 0,
};

function loadState() {
  try {
    const saved = sessionStorage.getItem('oa-screening-state');
    if (saved) {
      return { ...initialState, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return initialState;
}

function appReducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, isLoggedIn: true, user: action.payload, currentStep: 1 };
    case 'LOGOUT':
      return { ...initialState };
    case 'SET_PATIENT':
      return { ...state, patient: action.payload, currentStep: 2 };
    case 'SET_QUESTIONNAIRE':
      return { ...state, questionnaire: action.payload, currentStep: 3 };
    case 'SET_DEVICE_CONNECTED':
      return { ...state, currentStep: 4 };
    case 'SET_WALKING_COMPLETE':
      return { ...state, currentStep: 5 };
    case 'SET_SENSOR_DATA':
      return { ...state, sensorData: action.payload, currentStep: 6 };
    case 'SET_PREDICTION':
      return { ...state, prediction: action.payload, currentStep: 7 };
    case 'SET_REPORT_ID':
      return { ...state, reportId: action.payload, currentStep: 8 };
    case 'COMPLETE_QR':
      return { ...state, currentStep: 9 };
    case 'RESET_SCREENING':
      return {
        ...state,
        patient: null,
        questionnaire: null,
        sensorData: null,
        prediction: null,
        reportId: null,
        currentStep: 1,
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, null, loadState);

  // Persist state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('oa-screening-state', JSON.stringify(state));
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export const STEPS = [
  { label: 'Login', path: '/' },
  { label: 'Register', path: '/register' },
  { label: 'Questionnaire', path: '/questionnaire' },
  { label: 'Connect', path: '/connect-device' },
  { label: 'Walk Test', path: '/walking-test' },
  { label: 'Sensor', path: '/sensor-data' },
  { label: 'Analysis', path: '/analysis' },
  { label: 'Result', path: '/result' },
  { label: 'QR Code', path: '/qr-code' },
  { label: 'Report', path: '/report' },
];
