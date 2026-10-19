'use client';

import { useEffect, useRef, useState } from 'react';
import { shouldShowWhatsNew, markWhatsNewSeen, WHATS_NEW_FORCED } from '@/lib/whatsNew';

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const ITEMS: { title: string; text: string; icon: React.ReactNode }[] = [
  {
    title: 'Share your team',
    text: 'Copy a link from the Share window. Friends can add your team to their own Courtside as a separate team.',
    icon: <Icon><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></Icon>,
  },
  {
    title: 'Compare players',
    text: 'Tap Compare on two players to see their stats side by side.',
    icon: <Icon><path d="M7 4L3 8l4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" /></Icon>,
  },
  {
    title: 'Player news',
    text: 'Injuries, returns and roster moves for your players from the last 36 hours. Tap the bell or the Player news pill.',
    icon: <Icon><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></Icon>,
  },
  {
    title: 'Add to Home Screen',
    text: 'Put Courtside on your phone like an app, one tap away. Look for the Add to Home Screen pill.',
    icon: <Icon><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></Icon>,
  },
];

export default function WhatsNewDialog({ hydrated, hasTeams }: { hydrated: boolean; hasTeams: boolean }) {
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  // Decide once, after the saved teams have loaded; then show it a moment later.
  useEffect(() => {
    if (!hydrated || decided.current) return;
    decided.current = true;
    if (WHATS_NEW_FORCED) {
      try { window.history.replaceState(null, '', window.location.pathname + window.location.hash); } catch { /* harmless */ }
    }
    if (shouldShowWhatsNew(hasTeams)) setTimeout(() => setOpen(true), 1500);
  }, [hydrated, hasTeams]);

  const close = () => { markWhatsNewSeen(); setOpen(false); };

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[66] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="What's New"
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--color-card)', border: '2px solid var(--neon-orange)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-display font-800 text-2xl uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
            What&apos;s New
          </h3>
          <button
            onClick={close}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div>
          {ITEMS.map(item => (
            <div key={item.title} className="flex items-start gap-3 py-2.5" style={{ borderTop: '1px solid var(--color-border)' }}>
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,107,43,0.14)', color: 'var(--neon-orange)' }}
              >
                {item.icon}
              </span>
              <div>
                <p className="font-display font-700 text-sm uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
                  {item.title}
                </p>
                <p className="font-body text-xs leading-snug mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="font-body text-xs mt-1 mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          Plus smoother loading and friendlier error messages.
        </p>

        <button
          onClick={close}
          className="w-full py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm"
          style={{ background: 'var(--neon-orange)', color: '#fff' }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
