import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import PrintHero from './PrintHero';
import { api } from '../api';
import './SharedView.css';

/**
 * Read-only view of a shared conversation.
 * No login required. No sidebar, no input, no edit/delete controls.
 */
export default function SharedView({ conversationId }) {
  const [conversation, setConversation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setError('No conversation ID provided.');
      setLoading(false);
      return;
    }

    api.getSharedConversation(conversationId)
      .then((data) => {
        setConversation(data);
        setLoading(false);
      })
      .catch(() => {
        setError('This conversation was not found or has been deleted.');
        setLoading(false);
      });
  }, [conversationId]);

  if (loading) {
    return (
      <div className="shared-view">
        <TopBar />
        <div className="shared-loading">
          <div className="spinner" />
          <span>Loading conversation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-view">
        <TopBar />
        <div className="shared-error">
          <h2>Conversation not found</h2>
          <p>{error}</p>
          <a className="shared-home-link" href="/">Go to The Great Courtroom</a>
        </div>
      </div>
    );
  }

  const messages = conversation.messages || [];

  return (
    <div className="shared-view">
      <TopBar />

      <div className="shared-content">
        <h1 className="shared-title">{conversation.title || 'Shared Decision'}</h1>

        <PrintHero />

        {messages.map((msg, index) => (
          <div key={index} className="shared-message-group">
            {msg.role === 'user' ? (
              <div className="shared-user-message">
                <div className="shared-user-label">Question</div>
                <div className="shared-user-content markdown-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="shared-assistant-message">
                <div className="shared-assistant-label">The Great Courtroom</div>
                {msg.stage1 && <Stage1 responses={msg.stage1} />}
                {msg.stage2 && (
                  <Stage2
                    rankings={msg.stage2}
                    labelToModel={msg.metadata?.label_to_model}
                    aggregateRankings={msg.metadata?.aggregate_rankings}
                  />
                )}
                {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
              </div>
            )}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="shared-error">
            <p>This conversation has no messages yet.</p>
          </div>
        )}

        <footer className="shared-footer">
          <p>
            Shared from <a href="/">The Great Courtroom</a> — five AI thinkers
            deliberate your decisions.
          </p>
        </footer>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="shared-topbar">
      <a className="shared-brand" href="/">The Great Courtroom</a>
      <div className="shared-topbar-actions">
        <button className="msg-action export-pdf-btn" onClick={() => window.print()} type="button">
          Export PDF
        </button>
        <span className="readonly-badge">Read-only</span>
        <a className="shared-login-link" href="/">Log in to start your own</a>
      </div>
    </div>
  );
}
