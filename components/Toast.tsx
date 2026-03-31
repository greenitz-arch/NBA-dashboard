'use client';

interface ToastProps {
  title: string;
  subtitle: string;
  onClose: () => void;
}

export default function Toast({ title, subtitle, onClose }: ToastProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'var(--color-overlay)' }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm text-center"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'rgba(255,59,92,0.12)', border: '1px solid rgba(255,59,92,0.3)' }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
            stroke="var(--neon-red)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <h3
          className="font-display font-700 text-xl uppercase tracking-wide mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h3>
        <p
          className="font-body text-sm mb-6"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {subtitle}
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
          style={{
            background: 'var(--neon-orange)',
            color: 'white',
            boxShadow: 'var(--glow-orange)',
          }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
