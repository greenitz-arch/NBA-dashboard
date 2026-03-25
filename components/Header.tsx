// components/Header.tsx
'use client';

import { useEffect, useState } from 'react';

export default function Header() {
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    // Show a "refreshes at 2 AM ET" note
    const now = new Date();
    const next2am = new Date();
    next2am.setHours(2, 0, 0, 0);
    if (now >= next2am) next2am.setDate(next2am.getDate() + 1);

    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      month: 'short',
      day: 'numeric',
    });
    setLastUpdated(fmt.format(new Date()));
  }, []);

  return (
    <header className="border-b border-court-border bg-court-dark/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-neon-orange flex items-center justify-center shadow-lg"
              style={{ boxShadow: 'var(--glow-orange)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 1.5a8.5 8.5 0 0 1 8.5 8.5 8.5 8.5 0 0 1-8.5 8.5A8.5 8.5 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5zm0 1a7.5 7.5 0 0 0-5.74 2.69C7.5 7.9 9.67 8.5 12 8.5s4.5-.6 5.74-1.31A7.5 7.5 0 0 0 12 4.5zm5.94 3.61C16.6 9.04 14.4 9.75 12 9.75S7.4 9.04 6.06 8.11A7.47 7.47 0 0 0 4.5 12c0 .87.15 1.7.42 2.48C6.3 13.56 9 13 12 13s5.7.56 7.08 1.48c.27-.78.42-1.61.42-2.48a7.47 7.47 0 0 0-1.56-3.89zM12 14.25c-2.9 0-5.5.58-6.83 1.46A7.49 7.49 0 0 0 12 19.5a7.49 7.49 0 0 0 6.83-3.79C17.5 14.83 14.9 14.25 12 14.25z"/>
              </svg>
            </div>
          </div>
          <div>
            <span className="font-display text-xl font-700 tracking-wider text-white uppercase">
              Courtside
            </span>
            <span className="hidden sm:block text-[10px] text-court-text-secondary font-mono uppercase tracking-widest"
              style={{ color: 'var(--color-text-secondary)' }}>
              NBA Stats Dashboard
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green inline-block animate-pulse-soft" />
              <span className="font-mono">Updates 2:00 AM ET</span>
            </div>
          )}
          <a
            href="#select"
            className="text-xs font-display font-600 uppercase tracking-wider px-4 py-2 rounded border transition-all duration-200 hover:scale-105"
            style={{
              borderColor: 'var(--neon-orange)',
              color: 'var(--neon-orange)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,43,0.12)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'var(--glow-orange)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            + Add Players
          </a>
        </div>
      </div>
    </header>
  );
}
