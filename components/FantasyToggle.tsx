'use client';

interface FantasyToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  label?: string;
  beta?: boolean;
  icon?: 'ball' | 'eye';
}

// The "Fantasy mode" switch. Lives in its own pill, top right of the roster
// area, so it is easy to find and never gets mixed up with team controls.
export default function FantasyToggle({ on, onChange, label = 'Fantasy mode', beta = false, icon = 'ball' }: FantasyToggleProps) {
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full pl-3.5 pr-1.5 py-1.5"
      style={{
        background: 'var(--color-card)',
        border: `1px solid ${on ? 'var(--skin-primary)' : 'var(--color-border)'}`,
        transition: 'border-color 0.2s ease',
      }}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--skin-primary)"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon === 'eye' ? (
          <>
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            <path d="M3 3l18 18" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3v18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8" />
          </>
        )}
      </svg>
      <span
        className="font-display font-600 uppercase tracking-wider text-xs"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {label}
      </span>
      {beta && (
        <span
          className="font-mono text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5"
          style={{ background: 'rgba(var(--skin-primary-rgb),0.2)', color: 'var(--color-text-primary)' }}
        >
          Beta
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="relative rounded-full flex-shrink-0"
        style={{
          width: 44,
          height: 24,
          background: on ? 'var(--skin-primary)' : 'var(--color-progress-bg)',
          transition: 'background 0.2s ease',
        }}
      >
        <span
          className="absolute rounded-full"
          style={{
            top: 3,
            left: on ? 23 : 3,
            width: 18,
            height: 18,
            background: '#fff',
            transition: 'left 0.18s ease',
          }}
        />
      </button>
    </div>
  );
}
