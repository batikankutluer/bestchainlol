import { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api } from './api.js';
import { clearToken, getToken } from './auth.js';
import { Login } from './pages/Login.js';
import { Overview } from './pages/Overview.js';
import { Developer } from './pages/Developer.js';
import { externalUrl } from './links.js';

type SessionState = 'checking' | 'in' | 'out';

export function App() {
  const [session, setSession] = useState<SessionState>('checking');
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) return setSession('out');
    api
      .session()
      .then(() => setSession('in'))
      .catch(() => setSession('out'));
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setSession('out');
    navigate('/');
  }, [navigate]);

  if (session === 'checking')
    return (
      <div className="login">
        <p className="muted">…</p>
      </div>
    );
  if (session === 'out') return <Login onSuccess={() => setSession('in')} />;

  return (
    <div className="shell">
      <nav className="nav">
        <span className="nav__brand">admin</span>
        <NavLink to="/" end>
          Overview
        </NavLink>
        <NavLink to="/developer">Developer</NavLink>
        {/* Served by nginx, not the router — full page loads on purpose. */}
        <a href={externalUrl('/backrest/')}>Backrest</a>
        <a href={externalUrl('/grafana/')}>Grafana</a>
        <button className="nav__signout" type="button" onClick={signOut}>
          Sign out
        </button>
      </nav>

      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/developer" element={<Developer onUnauthorized={signOut} />} />
        <Route path="*" element={<p className="page muted">Not found.</p>} />
      </Routes>
    </div>
  );
}
