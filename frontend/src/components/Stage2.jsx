import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage2.css';

function deAnonymizeText(text, labelToName) {
  if (!labelToName) return text;

  let result = text;
  // Replace each "Response X" with the actual thinker's name (bolded).
  Object.entries(labelToName).forEach(([label, name]) => {
    result = result.replace(new RegExp(label, 'g'), `**${name}**`);
  });
  return result;
}

export default function Stage2({ rankings, labelToModel, aggregateRankings }) {
  const [activeTab, setActiveTab] = useState(0);
  const labelToName = labelToModel; // values are persona names

  if (!rankings || rankings.length === 0) {
    return null;
  }

  const label = (r) => r.name || r.model;

  return (
    <div className="stage stage2">
      <h3 className="stage-title">How the thinkers rated each other</h3>

      <p className="stage-description">
        Each thinker read all five takes (anonymized as Response A, B, C, and so
        on) and ranked them. Below, names are shown in <strong>bold</strong> for
        readability, but the ranking itself was done blind.
      </p>

      <div className="tabs">
        {rankings.map((rank, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {label(rank)}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="ranking-model">{label(rankings[activeTab])}</div>
        <div className="ranking-content markdown-content">
          <ReactMarkdown>
            {deAnonymizeText(rankings[activeTab].ranking, labelToName)}
          </ReactMarkdown>
        </div>

        {rankings[activeTab].parsed_ranking &&
          rankings[activeTab].parsed_ranking.length > 0 && (
            <div className="parsed-ranking">
              <strong>Their ranking:</strong>
              <ol>
                {rankings[activeTab].parsed_ranking.map((lbl, i) => (
                  <li key={i}>
                    {labelToName && labelToName[lbl] ? labelToName[lbl] : lbl}
                  </li>
                ))}
              </ol>
            </div>
          )}
      </div>

      {aggregateRankings && aggregateRankings.length > 0 && (
        <div className="aggregate-rankings">
          <h4>Most useful perspectives</h4>
          <p className="stage-description">
            Combined across every peer ranking (lower average is better):
          </p>
          <div className="aggregate-list">
            {aggregateRankings.map((agg, index) => (
              <div key={index} className="aggregate-item">
                <span className="rank-position">#{index + 1}</span>
                <span className="rank-model">{agg.name || agg.model}</span>
                <span className="rank-score">
                  Avg {agg.average_rank.toFixed(2)}
                </span>
                <span className="rank-count">({agg.rankings_count} votes)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
