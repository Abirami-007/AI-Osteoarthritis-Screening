import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Activity, LogOut } from 'lucide-react';

export default function Header() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    sessionStorage.removeItem('oa-screening-state');
    navigate('/');
  };

  if (!state.isLoggedIn) return null;

  return (
    <header className="app-header">
      <div className="header-brand">
        <Activity />
        <div>
          <div className="header-title">KneeCare AI</div>
          <div className="header-subtitle">AI-Assisted Early Osteoarthritis Risk Screening System</div>
        </div>
      </div>
      <div className="header-actions">
        <button
          className="header-logout-btn"
          onClick={handleLogout}
          id="logout-btn"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}
