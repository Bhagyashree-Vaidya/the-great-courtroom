import { useState, useEffect } from 'react';
import { api, setPassword } from '../api';
import './PasswordGate.css';

/**
 * Shared-password gate. Wraps the app: children only render once the backend
 * confirms the stored password (or that the gate is disabled for local dev).
 */
export default function PasswordGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | locked | open
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .checkAuth()
      .then((ok) => setStatus(ok ? 'open' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitting(true);
    setError('');
    setPassword(input.trim());
    try {
      const ok = await api.checkAuth();
      if (ok) {
        setStatus('open');
      } else {
        setPassword('');
        setError('That password is not right. Try again.');
      }
    } catch {
      setPassword('');
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="gate-screen">
        <div className="gate-card">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (status === 'locked') {
    return (
      <div className="gate-screen">
        <form className="gate-card" onSubmit={handleSubmit}>
          <h1>LinkedIn Council</h1>
          <p className="gate-tagline">
            A council of LLMs critiques and rewrites your LinkedIn drafts.
          </p>
          <input
            type="password"
            className="gate-input"
            placeholder="Enter password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {error && <div className="gate-error">{error}</div>}
          <button type="submit" className="gate-button" disabled={submitting}>
            {submitting ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    );
  }

  return children;
}
