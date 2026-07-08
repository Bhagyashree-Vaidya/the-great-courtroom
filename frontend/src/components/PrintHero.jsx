import './PrintHero.css';

const THINKERS = [
  { key: 'contrarian',       name: 'The Contrarian',       line: 'Asks, "What if everyone is wrong?"' },
  { key: 'first_principles', name: 'The First Principles', line: 'Strips the problem down to the basics and rebuilds it from the ground up.' },
  { key: 'expansionist',     name: 'The Expansionist',     line: 'Looks for bigger opportunities, hidden possibilities, and paths nobody considered.' },
  { key: 'outsider',         name: 'The Outsider',         line: 'Brings a fresh set of eyes and questions assumptions that insiders often miss.' },
  { key: 'skeptic',          name: 'The Skeptic',          line: 'Stress-tests ideas, spots risks, and looks for what could break.' },
];

export default function PrintHero() {
  return (
    <div className="print-hero">
      <div className="print-hero-title">
        <h1>Better Decisions. Less Guesswork.</h1>
      </div>
      <div className="print-hero-thinkers">
        {THINKERS.map((t) => (
          <div className="print-thinker-card" key={t.key}>
            <div className="print-thinker-pose">
              <img src={`/${t.key}.png`} alt={t.name} />
            </div>
            <h3>{t.name}</h3>
            <p>{t.line}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
