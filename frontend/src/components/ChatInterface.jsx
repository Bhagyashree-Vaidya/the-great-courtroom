import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

function CopyButton({ getText, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <button className="msg-action" onClick={onCopy} type="button">
      {copied ? 'Copied' : label}
    </button>
  );
}

export default function ChatInterface({
  conversation,
  onSendMessage,
  onStop,
  onRegenerate,
  onEditMessage,
  isLoading,
}) {
  const [input, setInput] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startEdit = (index, content) => {
    setEditingIndex(index);
    setEditText(content);
  };
  const saveEdit = (index) => {
    const text = editText.trim();
    setEditingIndex(null);
    if (text) onEditMessage(index, text);
  };

  if (!conversation) {
    return (
      <div className="chat-interface">
        <div className="empty-state">
          <h2>Welcome to the Great Courtroom</h2>
          <p>Start a new decision and five thinkers will weigh in</p>
        </div>
      </div>
    );
  }

  const messages = conversation.messages || [];
  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf('assistant');

  // Plain-text of a verdict for copying.
  const verdictText = (msg) => msg.stage3?.response || '';

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h2>What are you deciding?</h2>
            <p>Describe the decision you're weighing. The Contrarian, the First Principles Thinker, the Expansionist, the Outsider, and the Skeptic will each weigh in, then the Courtroom synthesizes a balanced view.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="message-group">
              {msg.role === 'user' ? (
                <div className="user-message">
                  <div className="message-label">You</div>
                  {editingIndex === index ? (
                    <div className="edit-box">
                      <textarea
                        className="edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="edit-actions">
                        <button className="edit-save" onClick={() => saveEdit(index)} disabled={isLoading}>
                          Save &amp; re-run
                        </button>
                        <button className="edit-cancel" onClick={() => setEditingIndex(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="message-content">
                        <div className="markdown-content">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="msg-actions">
                        <CopyButton getText={() => msg.content} />
                        <button
                          className="msg-action"
                          onClick={() => startEdit(index, msg.content)}
                          disabled={isLoading}
                          type="button"
                        >
                          Edit
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="assistant-message">
                  <div className="message-label">The Great Courtroom</div>

                  {msg.loading?.stage1 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>The five thinkers are weighing in...</span>
                    </div>
                  )}
                  {msg.stage1 && <Stage1 responses={msg.stage1} />}

                  {msg.loading?.stage2 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>The thinkers are ranking each other's takes...</span>
                    </div>
                  )}
                  {msg.stage2 && (
                    <Stage2
                      rankings={msg.stage2}
                      labelToModel={msg.metadata?.label_to_model}
                      aggregateRankings={msg.metadata?.aggregate_rankings}
                    />
                  )}

                  {msg.loading?.stage3 && (
                    <div className="stage-loading">
                      <div className="spinner"></div>
                      <span>The Courtroom is reaching a verdict...</span>
                    </div>
                  )}
                  {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}

                  {msg.stopped && !msg.stage3 && (
                    <div className="msg-note">Stopped. You can regenerate when ready.</div>
                  )}
                  {msg.error && <div className="msg-note error">{msg.error}</div>}

                  {/* Actions on the latest finished response */}
                  {index === lastAssistantIndex && !isLoading && (msg.stage3 || msg.stopped || msg.error) && (
                    <div className="msg-actions">
                      {msg.stage3 && <CopyButton getText={() => verdictText(msg)} label="Copy verdict" />}
                      <button className="msg-action" onClick={onRegenerate} type="button">
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Convening the council...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="input-form" onSubmit={handleSubmit}>
        <textarea
          className="message-input"
          placeholder="Describe the decision you're weighing..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={3}
        />
        {isLoading ? (
          <button type="button" className="stop-button" onClick={onStop}>
            <span className="stop-icon" /> Stop
          </button>
        ) : (
          <button type="submit" className="send-button" disabled={!input.trim()}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
