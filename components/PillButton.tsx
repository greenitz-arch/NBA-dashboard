'use client';

// A clickable pill that matches the look of the No spoilers / Fantasy mode pills.
interface PillButtonProps {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  badge?: number; // small orange number, e.g. unseen news
  highlight?: boolean; // orange outline
  ariaLabel?: string;
  className?: string;
}

export default function PillButton({ label, onClick, icon, badge = 0, highlight = false, ariaLabel, className = '' }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className={`inline-flex items-center gap-2.5 rounded-full pl-3.5 pr-3.5 py-2.5 transition-transform duration-200 hover:scale-[1.03] ${className}`}
      style={{
        background: 'var(--color-card)',
        border: `1px solid ${highlight ? 'var(--skin-primary)' : 'var(--color-border)'}`,
      }}
    >
      <span className="flex-shrink-0" style={{ color: 'var(--skin-primary)' }}>{icon}</span>
      <span className="font-display font-600 uppercase tracking-wider text-xs" style={{ color: 'var(--color-text-primary)' }}>
        {label}
      </span>
      {badge > 0 && (
        <span
          className="min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-mono font-700"
          style={{ background: 'var(--neon-orange)', color: '#fff', fontSize: '0.65rem' }}
        >
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

export const BellIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
