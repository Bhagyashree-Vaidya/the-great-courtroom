import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useReveal } from '../useReveal';
import './Stage1.css';

// Turn "openai/gpt-5.1" → "GPT-5.1 · OpenAI", etc.
function friendlyModel(modelId) {
  if (!modelId) return null;
  const map = {
    'openai/gpt-5.1':                     'GPT-5.1 · OpenAI',
    'anthropic/claude-sonnet-4.5':        'Claude Sonnet 4.5 · Anthropic',
    'google/gemini-3.1-pro-preview':      'Gemini 3.1 Pro · Google',
    'x-ai/grok-4.3':                      'Grok 4.3 · xAI',
    'google/gemini-2.5-flash':            'Gemini 2.5 Flash · Google',
  };
  return map[modelId] || modelId;
}

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState(0);
  const ref = useReveal();

  if (!responses || responses.length === 0) {
    return null;
  }

  const label = (r) => r.name || r.model;

  return (
    <div className="stage stage1" ref={ref}>
      <h3 className="stage-title">The five perspectives</h3>

      <div className="tabs">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {label(resp)}
          </button>
        ))}
      </div>

      {/* Render ALL perspectives. CSS hides non-active on screen;
          @media print shows them all so the PDF is complete. */}
      {responses.map((resp, index) => (
        <div
          key={index}
          className={`tab-content ${index !== activeTab ? 'tab-content-hidden' : ''}`}
        >
          <div className="model-name">
            {label(resp)}
            {resp.model && (
              <span className="model-badge">
                {friendlyModel(resp.model)}
              </span>
            )}
          </div>
          <div className="response-text markdown-content">
            <ReactMarkdown>{resp.response}</ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}
