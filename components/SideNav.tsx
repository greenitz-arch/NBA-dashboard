'use client';

import { useEffect } from 'react';
import { useTheme, type ThemeMode } from './ThemeProvider';
import { usePreferences, type SortOption } from '@/lib/usePreferences';

interface SideNavProps {
  open: boolean;
  onClose: () => void;
}

const DISPLAY_OPTIONS: { value: ThemeMode | 'skin'; label: string; disabled?: boolean }[] = [
  { value: 'dark',   label: 'Dark mode' },
  { value: 'light',  label: 'Light mode' },
  { value: 'system', label: 'System preference' },
  { value: 'skin',   label: 'Team Skin', disabled: true },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent',      label: 'Recent game' },
  { value: 'date-added',  label: 'Date added (oldest first)' },
  { value: 'az',          label: 'A–Z' },
  { value: 'by-team',     label: 'By team' },
  { value: 'by-position', label: 'By position (C first)' },
];

export default function SideNav({ open, onClose }: SideNavProps) {
  const { mode, setMode } = useTheme();
  const { prefs, updatePref } = usePreferences();

  // Keyboard shortcut [ to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '[' && !e.metaKey && !e.ctrlKey) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Backdrop — starts below header */}
      {open && (
        <div
          className="fixed left-0 right-0 bottom-0 z-40"
          style={{ top: '96px', background: 'var(--color-overlay)' }}
          onClick={onClose}
        />
      )}

      {/* Panel — slides from left edge, starts below header */}
      <div
        className="fixed left-0 z-50 flex flex-col"
        style={{
          top: '96px',
          height: 'calc(100vh - 96px)',
          width: '280px',
          background: 'var(--color-sidenav-bg)',
          borderRight: '1px solid var(--color-border)',
          borderTop: '1px solid var(--color-border)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
          boxShadow: open ? '8px 0 32px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <span
            className="font-display font-700 text-base uppercase tracking-widest"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Settings
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ border: '1px solid var(--color-border)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-hover-strong)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ color: 'var(--color-text-primary)' }}>
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* DISPLAY section */}
          <section>
            <p
              className="font-mono text-[10px] uppercase tracking-[3px] mb-3"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Display
            </p>
            <div className="space-y-1">
              {DISPLAY_OPTIONS.map(opt => {
                const isSelected = !opt.disabled && mode === opt.value;
                const isDisabled = opt.disabled;
                return (
                  <button
                    key={opt.value}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && setMode(opt.value as ThemeMode)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                    style={{
                      opacity: isDisabled ? 0.35 : 1,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      background: isSelected ? 'rgba(255,107,43,0.1)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isDisabled && !isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Radio indicator */}
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{
                        border: `2px solid ${isSelected ? 'var(--neon-orange)' : 'var(--color-border)'}`,
                      }}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--neon-orange)' }} />
                      )}
                    </div>
                    <span
                      className="font-body text-sm"
                      style={{ color: isSelected ? 'var(--neon-orange)' : 'var(--color-text-primary)' }}
                    >
                      {opt.label}
                      {isDisabled && (
                        <span className="ml-2 text-[10px] font-mono uppercase tracking-wider"
                          style={{ color: 'var(--color-text-tertiary)' }}>
                          Coming Soon
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--color-border)' }} />

          {/* SORT BY section */}
          <section>
            <p
              className="font-mono text-[10px] uppercase tracking-[3px] mb-3"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Sort By
            </p>
            <div className="space-y-1">
              {SORT_OPTIONS.map(opt => {
                const isSelected = prefs.sortBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updatePref('sortBy', opt.value)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                    style={{
                      background: isSelected ? 'rgba(255,107,43,0.1)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ border: `2px solid ${isSelected ? 'var(--neon-orange)' : 'var(--color-border)'}` }}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--neon-orange)' }} />
                      )}
                    </div>
                    <span
                      className="font-body text-sm"
                      style={{ color: isSelected ? 'var(--neon-orange)' : 'var(--color-text-primary)' }}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer shortcut hint */}
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          <kbd
            className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{
              background: 'var(--color-muted)',
              color: 'var(--color-text-secondary)',
              border: '1px solid var(--color-border)',
            }}
          >
            [
          </kbd>
          <span className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: 'var(--color-text-tertiary)' }}>
            Toggle sidebar
          </span>
        </div>
      </div>
    </>
  );
}
