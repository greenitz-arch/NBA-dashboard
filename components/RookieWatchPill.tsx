'use client';

// The Rookie Watch pill for the row of pills.
// Closed: an orange-outlined pill with a small "New" tag, easy to spot.
// Open: the same pill turns solid orange and reads "Exit Rookie Watch".
interface RookieWatchPillProps {
  open: boolean;
  onClick: () => void;
}

export default function RookieWatchPill({ open, onClick }: RookieWatchPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      aria-label={open ? 'Exit Rookie Watch' : 'Open Rookie Watch'}
      className="inline-flex items-center gap-2.5 rounded-full pl-3.5 pr-3.5 py-2.5 transition-transform duration-200 hover:scale-[1.03]"
      style={{
        background: open ? 'var(--neon-orange)' : 'var(--color-card)',
        border: '1.5px solid var(--neon-orange)',
        boxShadow: open ? 'var(--glow-orange)' : undefined,
      }}
    >
      <span className="flex-shrink-0" style={{ color: open ? '#fff' : 'var(--neon-orange)' }}>
        {open ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6 6.6 19.6l1.2-6.1L3.3 9.3l6.1-.7L12 3z" />
          </svg>
        )}
      </span>
      <span
        className="font-display font-600 uppercase tracking-wider text-xs"
        style={{ color: open ? '#fff' : 'var(--color-text-primary)' }}
      >
        {open ? 'Exit Rookie Watch' : 'Rookie Watch'}
      </span>
      {!open && (
        <span
          className="font-mono text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5"
          style={{ background: 'var(--neon-orange)', color: '#fff' }}
        >
          New
        </span>
      )}
    </button>
  );
}
