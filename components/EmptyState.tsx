// components/EmptyState.tsx
'use client';

interface EmptyStateProps {
  onOpenSelector: () => void;
}

export default function EmptyState({ onOpenSelector }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {/* Court illustration */}
      <div className="relative mb-8">
        <svg viewBox="0 0 120 80" className="w-32 h-auto opacity-20" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="116" height="76" rx="4" fill="none" stroke="white" strokeWidth="1.5"/>
          <line x1="60" y1="2" x2="60" y2="78" stroke="white" strokeWidth="1"/>
          <circle cx="60" cy="40" r="12" fill="none" stroke="white" strokeWidth="1"/>
          <path d="M2 40 Q30 20 58 40" fill="none" stroke="white" strokeWidth="1"/>
          <path d="M62 40 Q90 60 118 40" fill="none" stroke="white" strokeWidth="1"/>
          <circle cx="60" cy="40" r="1.5" fill="white"/>
        </svg>

        <div
          className="absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center animate-pulse-soft"
          style={{ background: 'rgba(255,107,43,0.15)', border: '1px solid rgba(255,107,43,0.3)' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" style={{ color: 'var(--neon-orange)' }} strokeWidth={2}>
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/>
            <path d="M12 8v8M8 12h8" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <h2 className="font-display font-700 text-3xl uppercase tracking-wide text-white mb-3">
        Your court is empty
      </h2>
      <p className="font-body text-sm max-w-xs mb-8 leading-relaxed"
        style={{ color: 'var(--color-text-secondary)' }}>
        Add players to your watchlist to track their latest game stats — updated every morning at 2 AM ET.
      </p>

      <button
        onClick={onOpenSelector}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-display font-600 uppercase tracking-wider text-base transition-all duration-200 hover:scale-105"
        style={{
          background: 'var(--neon-orange)',
          color: 'white',
          boxShadow: 'var(--glow-orange)',
        }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white fill-none" strokeWidth={2.5}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
        </svg>
        Add Your First Player
      </button>

      {/* Tips */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left">
        {[
          { icon: '🏀', title: 'Browse by Team', desc: 'Navigate conference → division → team to find players' },
          { icon: '🔍', title: 'Quick Search', desc: 'Search any player by name instantly' },
          { icon: '📊', title: 'Smart Stats', desc: 'Standout performances are automatically highlighted' },
        ].map(tip => (
          <div key={tip.title} className="rounded-xl p-4"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
            <span className="text-2xl block mb-2">{tip.icon}</span>
            <h4 className="font-display font-600 uppercase tracking-wide text-sm text-white mb-1">{tip.title}</h4>
            <p className="font-body text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{tip.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
