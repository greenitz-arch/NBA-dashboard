'use client';

import { useEffect, useState } from 'react';

interface HeaderProps {
  onOpenNav: () => void;
}

export default function Header({ onOpenNav }: HeaderProps) {
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
    });

    const update = () => {
      const stored = sessionStorage.getItem('last_stats_fetch');
      const ts = stored ? parseInt(stored, 10) : Date.now();
      setLastUpdated(fmt.format(new Date(ts)));
    };

    update();
    window.addEventListener('stats-updated', update);
    return () => window.removeEventListener('stats-updated', update);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        opacity: 0.97,
      }}
    >
      {/* h-24 = 96px — used as offset for SideNav and backdrop */}
      <div className="max-w-[1100px] mx-auto px-6 h-24 flex items-center justify-between gap-4">

        {/* Left — hamburger */}
        <button
          onClick={onOpenNav}
          className="w-10 h-10 flex flex-col items-center justify-center gap-1.5 rounded-xl transition-colors flex-shrink-0"
          style={{ border: '1px solid var(--color-border)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          aria-label="Open settings"
          title="Settings  [ [ ]"
        >
          <span className="block w-5 h-px" style={{ background: 'var(--color-text-primary)' }} />
          <span className="block w-5 h-px" style={{ background: 'var(--color-text-primary)' }} />
          <span className="block w-5 h-px" style={{ background: 'var(--color-text-primary)' }} />
        </button>

        {/* Centre — logo, larger */}
        <div className="flex items-center gap-4 flex-1 justify-center sm:justify-start">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--neon-orange)', boxShadow: 'var(--glow-orange)' }}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 0 1 8.5 8.5 8.5 8.5 0 0 1-8.5 8.5A8.5 8.5 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5zm0 1a7.5 7.5 0 0 0-5.74 2.69C7.5 7.9 9.67 8.5 12 8.5s4.5-.6 5.74-1.31A7.5 7.5 0 0 0 12 4.5zm5.94 3.61C16.6 9.04 14.4 9.75 12 9.75S7.4 9.04 6.06 8.11A7.47 7.47 0 0 0 4.5 12c0 .87.15 1.7.42 2.48C6.3 13.56 9 13 12 13s5.7.56 7.08 1.48c.27-.78.42-1.61.42-2.48a7.47 7.47 0 0 0-1.56-3.89zM12 14.25c-2.9 0-5.5.58-6.83 1.46A7.49 7.49 0 0 0 12 19.5a7.49 7.49 0 0 0 6.83-3.79C17.5 14.83 14.9 14.25 12 14.25z"/>
            </svg>
          </div>
          <div>
            <div
              className="font-display font-800 uppercase tracking-wider leading-none"
              style={{ fontSize: '1.75rem', color: 'var(--color-text-primary)' }}
            >
              Courtside
            </div>
            <div
              className="hidden sm:block font-mono uppercase tracking-[2px] mt-1"
              style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}
            >
              Your players. Your stats. Your court.
            </div>
          </div>
        </div>

        {/* Right — last update + copyright */}
        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
          {lastUpdated && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full animate-pulse-soft flex-shrink-0"
                style={{ background: 'var(--neon-green)' }}
              />
              <span
                className="font-mono uppercase tracking-wider"
                style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)' }}
              >
                Last update: {lastUpdated}
              </span>
            </div>
          )}
          <span
            className="font-mono font-500"
            style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)', opacity: 0.7 }}
          >
            © HaDorban | הדורבן
          </span>
        </div>

      </div>
    </header>
  );
}
