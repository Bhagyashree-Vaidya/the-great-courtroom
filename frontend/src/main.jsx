import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PasswordGate from './components/PasswordGate.jsx'
import SharedView from './components/SharedView.jsx'

/**
 * Simple client-side routing.
 * - /share/:id  → read-only SharedView (bypasses PasswordGate)
 * - everything else → PasswordGate → App
 */
function Router() {
  const path = window.location.pathname;

  // Match /share/{uuid}
  const shareMatch = path.match(/^\/share\/([^/]+)/);
  if (shareMatch) {
    return <SharedView conversationId={shareMatch[1]} />;
  }

  // Default: password-gated app
  return (
    <PasswordGate>
      <App />
    </PasswordGate>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
