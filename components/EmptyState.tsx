'use client';

interface EmptyStateProps {
  onOpenSelector: (mode?: 'conference' | 'all-teams' | 'search') => void;
  hasPlayers: boolean;
}

const tips = [
  {
    id: 'browse',
    title: 'Browse by Team',
    desc: 'Find your favorite players by team',
    mode: 'all-teams' as 'all-teams' | 'search' | undefined,
    disabled: false,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
        <path d="M12 2c0 0-4 4-4 10s4 10 4 10M12 2c0 0 4 4 4 10s-4 10-4 10M2 12h20"/>
        <path d="M3.5 7h17M3.5 17h17"/>
      </svg>
    ),
  },
  {
    id: 'search',
    title: 'Quick Search',
    desc: 'Search any player by name instantly',
    mode: 'search' as const,
    disabled: false,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    id: 'smart',
    title: 'Smart Stats',
    desc: 'Standout performances from last game night',
    mode: undefined,
    disabled: true,
    icon: (
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
];

export default function EmptyState({ onOpenSelector, hasPlayers }: EmptyStateProps) {
  return (
    <>
      {/* Empty state CTA — only when no players */}
      {!hasPlayers && (
        <div className="text-center mb-8">
          <h2
            className="font-display font-800 text-3xl uppercase tracking-wide mb-3"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Your Roster Is Empty
          </h2>
          <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
            Add players to track their latest game stats
          </p>
          <button
            onClick={() => onOpenSelector('conference')}
            aria-label="Add your first player"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-display font-600 uppercase tracking-wider text-base transition-all duration-200 hover:scale-105"
            style={{ background: 'var(--neon-orange)', color: 'white', boxShadow: 'var(--glow-orange)' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Your First Player
          </button>
        </div>
      )}

      {/* Roster Building Tools — always visible */}
      <div className="mt-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'var(--color-divider)' }} />
          <span
            className="font-mono text-[10px] uppercase tracking-[3px] whitespace-nowrap"
            style={{ color: 'var(--color-divider-text)' }}
          >
            Roster Building Tools
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-divider)' }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tips.map(tip => (
            <button
              key={tip.id}
              onClick={() => !tip.disabled && onOpenSelector(tip.mode)}
              disabled={tip.disabled}
              aria-label={tip.disabled ? `${tip.title} — coming soon` : tip.title}
              className="rounded-xl p-5 text-center transition-all duration-200 relative"
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                opacity: tip.disabled ? 0.5 : 1,
                cursor: tip.disabled ? 'default' : 'pointer',
              }}
              onMouseEnter={e => {
                if (!tip.disabled) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--neon-orange)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(255,107,43,0.15)';
                }
              }}
              onMouseLeave={e => {
                if (!tip.disabled) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }
              }}
            >
              {tip.disabled && (
                <span
                  className="absolute top-2 right-2 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-muted)', color: 'var(--color-text-secondary)' }}
                >
                  Soon
                </span>
              )}
              <div
                className="flex items-center justify-center mb-3"
                style={{ color: tip.disabled ? 'var(--color-text-secondary)' : 'var(--neon-orange)' }}
              >
                {tip.icon}
              </div>
              <h4
                className="font-display font-700 uppercase tracking-wide text-sm mb-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {tip.title}
              </h4>
              <p className="font-body text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {tip.desc}
              </p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
