import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import confetti from 'canvas-confetti';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { api, setPassword } from '../api';
import './PasswordGate.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

// three.js is heavy; only pull it in when the locked landing actually shows.
const AnyaPeek = lazy(() => import('./AnyaPeek'));
const AnyaCard = lazy(() => import('./AnyaCard'));

const THINKERS = [
  {
    key: 'contrarian',
    name: 'The Contrarian',
    line: 'Asks, "What if everyone is wrong?"',
    overflow: 'top-right',
  },
  {
    key: 'first_principles',
    name: 'The First Principles Thinker',
    line: 'Strips the problem down to the basics and rebuilds it from the ground up.',
    overflow: 'bottom-left',
  },
  {
    key: 'expansionist',
    name: 'The Expansionist',
    line: 'Looks for bigger opportunities, hidden possibilities, and paths nobody considered.',
    overflow: 'expansionist',
  },
  {
    key: 'outsider',
    name: 'The Outsider',
    line: 'Brings a fresh set of eyes and questions assumptions that insiders often miss.',
    overflow: 'bottom-right',
  },
  {
    key: 'skeptic',
    name: 'The Skeptic',
    line: 'Stress-tests ideas, spots risks, and looks for what could break.',
    overflow: 'top-right',
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
  const [showExpansionistGif, setShowExpansionistGif] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false); // terms & privacy modal
  const lookTargetRef = useRef(null); // {x, y} the character looks at
  const typingRef = useRef(false); // true while the password field is focused
  const landingRef = useRef(null); // scope + scroller for GSAP reveals
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

    // Delay the Expansionist GIF so it doesn't loop immediately on load
    const timer = setTimeout(() => setShowExpansionistGif(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Persona pose snapshots for the thinker cards (rendered from the GLB once).
  const [poses, setPoses] = useState(null);
  useEffect(() => {
    if (status !== 'locked') return;
    import('../anyaPoses')
      .then((m) => m.generatePoseImages())
      .then((imgs) => {
        setPoses(imgs);
        // Swap the static SVG favicon for a real rendered Anya headshot.
        try {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 64;
            c.height = 64;
            const ctx = c.getContext('2d');
            const s = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - s) / 2, 0, s, s, 0, 0, 64, 64);
            const link = document.querySelector("link[rel='icon']");
            if (link) {
              link.type = 'image/png';
              link.href = c.toDataURL('image/png');
            }
          };
          img.src = imgs.skeptic;
        } catch { /* favicon swap is best-effort */ }
      })
      .catch(() => setPoses(null)); // cards just render without images
  }, [status]);

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

  // GSAP reveals: hero fades up on load; sections rise in as you scroll the
  // landing. Kept subtle (short, soft easing) to fit the calm papermorphism.
  useGSAP(
    () => {
      if (status !== 'locked') return;
      const scroller = landingRef.current;
      const st = (trigger) => ({ trigger, scroller, start: 'top 88%', once: true });

      // clearProps wipes GSAP's inline styles when the tween finishes, so the
      // element always lands at its natural CSS position (never stuck with a
      // residual transform).
      // Hero fades up on load (no ScrollTrigger, so it always plays).
      gsap.from('.hero .eyebrow, .hero h1, .hero .tagline, .hero-lede', {
        y: 26, autoAlpha: 0, duration: 0.8, ease: 'power2.out', stagger: 0.12,
        clearProps: 'all',
      });

      // Decorative elements fade in on scroll.
      gsap.from('.thinker-card', {
        scrollTrigger: st('.thinkers'),
        y: 36, autoAlpha: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1,
        clearProps: 'all',
      });
      gsap.from('.council-note > *', {
        scrollTrigger: st('.council-note'),
        y: 24, autoAlpha: 0, duration: 0.7, ease: 'power2.out', stagger: 0.1,
        clearProps: 'all',
      });

      // Login + footer use a RISE only (no opacity hide): even if a trigger
      // never fired, these stay fully visible and usable.
      gsap.from('.login-card', {
        scrollTrigger: st('.login-block'),
        y: 40, duration: 0.8, ease: 'power3.out', clearProps: 'transform',
      });
      gsap.from('.footer-card > *', {
        scrollTrigger: st('.landing-footer'),
        y: 20, duration: 0.6, ease: 'power2.out', stagger: 0.08, clearProps: 'transform',
      });
    },
    { scope: landingRef, dependencies: [status] }
  );

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
    <div className="landing" ref={landingRef}>
      <nav className="landing-nav">
        <span className="wordmark">The Great Courtroom</span>
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
          <p className="tagline">Don't suck at decision making</p>
          <p className="hero-lede">
            Most decisions are not short on opinions. They're short on
            perspective. This courtroom brings together five different ways of
            thinking before a decision is made.
          </p>
        </header>

        <section className="thinkers">
          {THINKERS.map((t, i) => (
            <article className={`thinker-card overflow-${t.overflow}`} key={t.key}>
              <span className="thinker-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="thinker-pose">
                <img
                  src={
                    t.key === 'expansionist'
                      ? (showExpansionistGif ? `/${t.key}.gif` : `/${t.key}.png`)
                      : `/${t.key}.png`
                  }
                  alt={t.name}
                />
              </div>
              <h3>{t.name}</h3>
              <p>{t.line}</p>
            </article>
          ))}
        </section>

        <hr className="paper-rule" />

        <section className="council-note">
          <h2>Then the Courtroom steps in.</h2>
          <p>
            Instead of relying on a single answer, the courtroom reviews every
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
            <h2>Enter the courtroom</h2>
            <p className="login-sub">This is a private room. Sign in to begin.</p>
            {!modelFailed ? (
              <Suspense fallback={<div className="anya-peek" />}>
                <AnyaPeek
                  mood={mood}
                  lookTargetRef={lookTargetRef}
                  typingRef={typingRef}
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
              onFocus={() => { typingRef.current = true; }}
              onBlur={() => { typingRef.current = false; }}
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
        <div className="footer-card">
          <div className="footer-id">
            <span className="footer-name">Bhagyashree Vaidya</span>
            <a href="tel:+12066730335">+1 (206) 673 0335</a>
            <a href="mailto:bhagyashreevaidya08@gmail.com">
              bhagyashreevaidya08@gmail.com
            </a>
          </div>

          <div className="footer-icons">
            <a
              href="https://shreevaidya.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Website"
              title="shreevaidya.com"
            >
              {/* globe */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/bhagyashree-vaidya-6b47a811a/"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              {/* linkedin */}
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.4 8.5h4.2V23H.4V8.5zm7.1 0h4v2h.06c.56-1.06 1.93-2.18 3.97-2.18 4.25 0 5.03 2.8 5.03 6.44V23h-4.2v-6.6c0-1.58-.03-3.6-2.2-3.6-2.2 0-2.54 1.72-2.54 3.5V23H7.5V8.5z" />
              </svg>
            </a>
            <a
              href="https://wa.me/12066730335"
              target="_blank"
              rel="noreferrer"
              aria-label="WhatsApp"
              title="WhatsApp: +1 206 673 0335"
            >
              {/* whatsapp */}
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.1-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.6 1.1 2.8c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3z" />
              </svg>
            </a>
            <a href="mailto:bhagyashreevaidya08@gmail.com" aria-label="Email" title="Email">
              {/* mail */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                <path d="M3 6.5l9 6.5 9-6.5" />
              </svg>
            </a>
          </div>

          <div className="footer-legal">
            <span>© 2026 Bhagyashree Vaidya. All rights reserved.</span>
            <button className="footer-link" onClick={() => setPolicyOpen(true)}>
              Terms &amp; Privacy
            </button>
          </div>
        </div>
      </footer>

      {policyOpen && (
        <div className="policy-overlay" onClick={() => setPolicyOpen(false)}>
          <div
            className="policy-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Terms and Privacy"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Terms &amp; Privacy</h2>
            <h3>What this is</h3>
            <p>
              The Great Courtroom is a just-for-fun portfolio project by
              Bhagyashree Vaidya. It is not a commercial product, and nothing it
              outputs is professional, legal, financial, or career advice. Five
              AI personas argue about your question; you make your own call.
            </p>
            <h3>Privacy</h3>
            <p>
              No personally identifiable information (PII) is collected,
              captured, sold, or shared. There are no analytics, no trackers,
              no ad pixels, and no user accounts. The only data handled is the
              text you choose to submit, which is sent to AI model providers
              (via OpenRouter) solely to generate a response, and lightweight
              conversation history stored temporarily on the server, which can
              be wiped at any time. Please don't paste sensitive personal
              information into the app.
            </p>
            <h3>Cookies</h3>
            <p>
              No cookies are used. Your password is kept in your own browser's
              local storage so you don't have to retype it.
            </p>
            <h3>Liability</h3>
            <p>
              Provided as-is, with no warranties of any kind. Use it for fun.
            </p>
            <button className="policy-close" onClick={() => setPolicyOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
