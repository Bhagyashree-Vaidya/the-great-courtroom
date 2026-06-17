import ReactMarkdown from 'react-markdown';
import { useReveal } from '../useReveal';
import './Stage3.css';

export default function Stage3({ finalResponse }) {
  const ref = useReveal(22);
  if (!finalResponse) {
    return null;
  }

  return (
    <div className="stage stage3" ref={ref}>
      <h3 className="stage-title">The Courtroom's verdict</h3>
      <div className="final-response">
        <div className="chairman-label">
          {finalResponse.name || 'The Council'}
        </div>
        <div className="final-text markdown-content">
          <ReactMarkdown>{finalResponse.response}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
