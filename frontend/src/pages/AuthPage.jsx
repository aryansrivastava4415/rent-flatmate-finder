import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [regForm, setRegForm] = useState({ name: '', email: '', password: '', role: 'TENANT' });

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(loginForm);
      login(data.token, data.user);
      navigate(data.user.role === 'TENANT' ? '/tenant' : data.user.role === 'OWNER' ? '/owner' : '/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.register(regForm);
      login(data.token, data.user);
      navigate(data.user.role === 'TENANT' ? '/tenant' : '/owner');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="card">
        <div className="tabs">
          <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>
            Log in
          </button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>
            Register
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
            <button className="btn" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Logging in…' : 'Log in'}
            </button>
            <p className="muted" style={{ marginTop: 10 }}>
              Admin? Use the seeded admin credentials from your .env file.
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>Full name</label>
              <input
                required
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                required
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>I am a…</label>
              <select value={regForm.role} onChange={(e) => setRegForm({ ...regForm, role: e.target.value })}>
                <option value="TENANT">Tenant — looking for a room</option>
                <option value="OWNER">Owner — listing a room</option>
              </select>
            </div>
            <button className="btn" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
