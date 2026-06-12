import { useState, useEffect, useRef } from 'react';
import { api, setPassword } from '../api';
import './PasswordGate.css';

const THINKERS = [
  {
    name: 'The Contrarian',
    line: 'Asks, "What if everyone is wrong?"',
  },
  {
    name: 'The First Principles Thinker',
    line: 'Strips the problem down to the basics and rebuilds it from the ground up.',
  },
  {
    name: 'The Expansionist',
    line: 'Looks for bigger opportunities, hidden possibilities, and paths nobody considered.',
  },
  {
    name: 'The Outsider',
    line: 'Brings a fresh set of eyes and questions assumptions that insiders often miss.',
  },
  {
    name: 'The Skeptic',
    line: 'Stress-tests ideas, spots risks, and looks for what could break.',
  },
];

export default function PasswordGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | locked | open
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const loginRef = useRef(null);

  useEffect(() => {
    api
      .checkAuth()
      .then((ok) => setStatus(ok ? 'open' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    loginRef.current?.querySelector('input')?.focus();
  };

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
      setError('Could not reach the council. Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'checking') {
    return (
      <div className="gate-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (status === 'open') {
    return children;
  }

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="wordmark">The Council</span>
        <button className="nav-login" onClick={scrollToLogin}>
          Log in
        </button>
      </nav>

      <main className="landing-main">
        <header className="hero">
          <p className="eyebrow">A room full of perspectives</p>
          <h1>
            Better Decisions.
            <br />
            Less Guesswork.
          </h1>
          <p className="hero-lede">
            Most decisions are not short on opinions. They're short on
            perspective. This council brings together five different ways of
            thinking before a decision is made.
          </p>
        </header>

        <section className="thinkers">
          {THINKERS.map((t, i) => (
            <article className="thinker-card" key={t.name}>
              <span className="thinker-num">{String(i + 1).padStart(2, '0')}</span>
              <h3>{t.name}</h3>
              <p>{t.line}</p>
            </article>
          ))}
        </section>

        <hr className="paper-rule" />

        <section className="council-note">
          <h2>Then the Council steps in.</h2>
          <p>
            Instead of relying on a single answer, the council reviews every
            perspective, debates the tradeoffs, and helps you reach a more
            balanced decision.
          </p>
          <p className="emphasis">
            No blind agreement. No groupthink. No chasing the loudest opinion.
            You stay in control.
          </p>
          <p>
            Whether you're choosing a strategy, evaluating a product idea, making
            a career move, or solving a tough problem, you get a room full of
            perspectives before you decide. Because better decisions usually come
            from better questions.
          </p>
        </section>

        <section className="login-block" ref={loginRef}>
          <form className="login-card" onSubmit={handleSubmit}>
            <h2>Enter the council</h2>
            <p className="login-sub">This is a private room. Sign in to begin.</p>
            <input
              type="password"
              className="login-input"
              placeholder="Password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="login-button" disabled={submitting}>
              {submitting ? 'Opening the door...' : 'Log in'}
            </button>
          </form>
        </section>
      </main>

      <footer className="landing-footer">
        <span>The Council</span>
        <span className="dot">·</span>
        <span>Five perspectives, one calmer decision</span>
      </footer>
    </div>
  );
}
