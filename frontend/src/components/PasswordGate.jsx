import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import confetti from 'canvas-confetti';
import { api, setPassword } from '../api';
import './PasswordGate.css';

// three.js is heavy; only pull it in when the locked landing actually shows.
const AnyaPeek = lazy(() => import('./AnyaPeek'));

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

const CONFETTI_COLORS = ['#b8c4b1', '#d8b7b1', '#c98e72', '#7b6758', '#f7f3eb'];

function burstAtElement(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 40,
    origin: { x, y },
    colors: CONFETTI_COLORS,
  });
  confetti({
    particleCount: 50,
    spread: 100,
    startVelocity: 25,
    decay: 0.9,
    scalar: 0.9,
    origin: { x, y },
    colors: CONFETTI_COLORS,
  });
}

/**
 * Hand-drawn paper face. The pupils track the pointer anywhere on the page,
 * and follow the caret while you type in the password field.
 * Moods: neutral (soft smile), shocked (wrong password), happy (success).
 */
function LoginFace({ mood, leftEyeRef, rightEyeRef, leftPupilRef, rightPupilRef }) {
  return (
    <svg
      className={`login-face mood-${mood}`}
      viewBox="0 0 200 150"
      aria-hidden="true"
    >
      {/* Face */}
      <ellipse
        cx="100" cy="78" rx="58" ry="56"
        fill="var(--paper-cream)" stroke="var(--brown)" strokeWidth="2.5"
      />

      {/* Brows */}
      <path
        className="brow brow-left"
        d="M62 52 Q74 44 86 50"
        fill="none" stroke="var(--brown)" strokeWidth="2.5" strokeLinecap="round"
      />
      <path
        className="brow brow-right"
        d="M114 50 Q126 44 138 52"
        fill="none" stroke="var(--brown)" strokeWidth="2.5" strokeLinecap="round"
      />

      {/* Eyes */}
      <g>
        <ellipse
          ref={leftEyeRef}
          cx="76" cy="70" rx="11" ry="13"
          fill="var(--paper-card)" stroke="var(--brown)" strokeWidth="2"
        />
        <circle ref={leftPupilRef} className="pupil" cx="76" cy="71" r="4.5" fill="var(--ink)" />
      </g>
      <g>
        <ellipse
          ref={rightEyeRef}
          cx="124" cy="70" rx="11" ry="13"
          fill="var(--paper-card)" stroke="var(--brown)" strokeWidth="2"
        />
        <circle ref={rightPupilRef} className="pupil" cx="124" cy="71" r="4.5" fill="var(--ink)" />
      </g>

      {/* Cheeks */}
      <circle cx="64" cy="92" r="7" fill="var(--rose)" opacity="0.7" />
      <circle cx="136" cy="92" r="7" fill="var(--rose)" opacity="0.7" />

      {/* Mouths: one per mood, CSS shows the active one */}
      <path
        className="mouth mouth-neutral"
        d="M86 102 Q100 112 114 102"
        fill="none" stroke="var(--brown)" strokeWidth="2.5" strokeLinecap="round"
      />
      <ellipse
        className="mouth mouth-shocked"
        cx="100" cy="106" rx="7" ry="10"
        fill="var(--rose-deep)"
      />
      <path
        className="mouth mouth-happy"
        d="M82 100 Q100 122 118 100 Z"
        fill="var(--rose-deep)" stroke="var(--brown)" strokeWidth="2" strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PasswordGate({ children }) {
  const [status, setStatus] = useState('checking'); // checking | locked | open
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mood, setMood] = useState('neutral'); // neutral | shocked | happy
  const [shake, setShake] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const lookTargetRef = useRef(null); // {x, y} the character looks at
  const loginRef = useRef(null);
  const cardRef = useRef(null);
  const inputRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const leftPupilRef = useRef(null);
  const rightPupilRef = useRef(null);
  const measureCtxRef = useRef(null);

  useEffect(() => {
    api
      .checkAuth()
      .then((ok) => setStatus(ok ? 'open' : 'locked'))
      .catch(() => setStatus('locked'));
  }, []);

  // ---------- Eye tracking ----------
  const lookAt = useCallback((x, y) => {
    const eyes = [
      [leftEyeRef.current, leftPupilRef.current],
      [rightEyeRef.current, rightPupilRef.current],
    ];
    for (const [eye, pupil] of eyes) {
      if (!eye || !pupil) continue;
      const r = eye.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const dx = x - ex;
      const dy = y - ey;
      const dist = Math.hypot(dx, dy);
      const p = Math.min(1, dist / 320); // sensitivity
      const ang = Math.atan2(dy, dx);
      // Ellipse-clamped pupil range (a touch wider than tall).
      const mx = Math.cos(ang) * 4 * p;
      const my = Math.sin(ang) * 5.5 * p;
      pupil.style.transform = `translate(${mx}px, ${my}px)`;
    }
  }, []);

  // Where the caret is inside the password input (dots measured on canvas).
  const caretPoint = useCallback(() => {
    const el = inputRef.current;
    if (!el) return null;
    if (!measureCtxRef.current) {
      measureCtxRef.current = document.createElement('canvas').getContext('2d');
    }
    const ctx = measureCtxRef.current;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontWeight || 400} ${cs.fontSize || '16px'} ${cs.fontFamily || 'sans-serif'}`;
    const sel = el.selectionStart ?? el.value.length;
    const w = ctx.measureText('•'.repeat(sel)).width;
    const padL = parseFloat(cs.paddingLeft) || 0;
    const x = rect.left + padL + Math.min(w, rect.width - padL * 2);
    const y = rect.top + rect.height / 2;
    return { x, y };
  }, []);

  useEffect(() => {
    if (status !== 'locked') return;

    let lastPointer = null;
    const focused = () => document.activeElement === inputRef.current;

    const onPointerMove = (e) => {
      lastPointer = { x: e.clientX, y: e.clientY };
      if (!focused()) {
        lookTargetRef.current = lastPointer;
        lookAt(e.clientX, e.clientY);
      }
    };

    const onCaret = () => {
      if (!focused()) return;
      requestAnimationFrame(() => {
        const pt = caretPoint();
        if (pt) {
          lookTargetRef.current = pt;
          lookAt(pt.x, pt.y);
        }
      });
    };

    const onBlur = () => {
      if (lastPointer) {
        lookTargetRef.current = lastPointer;
        lookAt(lastPointer.x, lastPointer.y);
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    const el = inputRef.current;
    const caretEvents = ['input', 'click', 'keyup', 'keydown', 'focus'];
    caretEvents.forEach((evt) => el?.addEventListener(evt, onCaret));
    el?.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      caretEvents.forEach((evt) => el?.removeEventListener(evt, onCaret));
      el?.removeEventListener('blur', onBlur);
    };
  }, [status, lookAt, caretPoint]);

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    loginRef.current?.querySelector('input')?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    setPassword(input.trim());
    try {
      const ok = await api.checkAuth();
      if (ok) {
        setMood('happy');
        burstAtElement(cardRef.current);
        // Let the confetti and the smile land before opening the door.
        setTimeout(() => setStatus('open'), 1100);
      } else {
        setPassword('');
        setMood('shocked');
        setShake(true);
        setError('That password is not right. Try again.');
      }
    } catch {
      setPassword('');
      setMood('shocked');
      setShake(true);
      setError('Could not reach the council. Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (mood === 'shocked') {
      setMood('neutral');
      setError('');
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
          <form
            className={`login-card ${shake ? 'shake' : ''}`}
            ref={cardRef}
            onSubmit={handleSubmit}
            onAnimationEnd={() => setShake(false)}
          >
            <h2>Enter the council</h2>
            <p className="login-sub">This is a private room. Sign in to begin.</p>
            {!modelFailed ? (
              <Suspense fallback={<div className="anya-peek" />}>
                <AnyaPeek
                  mood={mood}
                  lookTargetRef={lookTargetRef}
                  onLoadError={() => setModelFailed(true)}
                />
              </Suspense>
            ) : (
              <LoginFace
                mood={mood}
                leftEyeRef={leftEyeRef}
                rightEyeRef={rightEyeRef}
                leftPupilRef={leftPupilRef}
                rightPupilRef={rightPupilRef}
              />
            )}
            <input
              ref={inputRef}
              type="password"
              className="login-input"
              placeholder="Password"
              value={input}
              onChange={handleInputChange}
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
