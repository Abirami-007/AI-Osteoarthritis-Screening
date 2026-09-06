import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Activity, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);

    // Mock authentication delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    dispatch({ type: 'LOGIN', payload: { username: username.trim() } });
    navigate('/register');
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card animate-fade-in">
        <div className="login-branding">
          <div className="login-logo">
            <Activity size={32} />
          </div>
          <h1>KneeCare AI</h1>
          <p>AI-Assisted Early Osteoarthritis Risk Screening System</p>
        </div>

        <form onSubmit={handleSubmit} id="login-form">
          <div className="form-group">
            <label className="form-label" htmlFor="login-username">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              className={`form-input ${error ? 'error' : ''}`}
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${error ? 'error' : ''}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ paddingRight: '48px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && <p className="form-error" style={{ marginBottom: 'var(--space-4)' }}>{error}</p>}

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full"
            disabled={loading}
            id="login-submit-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-sm text-muted mt-4">
            For healthcare professionals only
          </p>
        </form>
      </div>
    </div>
  );
}
