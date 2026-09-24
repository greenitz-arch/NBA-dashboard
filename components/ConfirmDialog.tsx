'use client';

import { useEffect } from 'react';

interface ConfirmDialogProps {
  title: string;
  body: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  primaryVariant?: 'default' | 'danger';
}

export default function ConfirmDialog({
  title,
  body,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  primaryVariant = 'default',
}: ConfirmDialogProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onSecondary(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSecondary]);

  const isDanger = primaryVariant === 'danger';
  const primaryColor = isDanger ? 'var(--neon-red)' : 'var(--neon-orange)';
  const primaryGlow = isDanger
    ? '0 0 24px rgba(255, 59, 92, 0.35)'
    : 'var(--glow-orange)';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'var(--color-overlay)' }}
      onClick={onSecondary}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-sm text-center"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
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
          {body}
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onPrimary}
            className="w-full py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
            style={{
              background: primaryColor,
              color: 'white',
              boxShadow: primaryGlow,
            }}
          >
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className="w-full py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
