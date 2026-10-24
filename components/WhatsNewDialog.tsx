'use client';

import { useEffect, useRef, useState } from 'react';
import { shouldShowWhatsNew, markWhatsNewSeen, WHATS_NEW_FORCED } from '@/lib/whatsNew';

const Icon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

const ITEMS: { title: string; text: string; icon: React.ReactNode; beta?: boolean }[] = [
  {
    title: 'Rookie Watch',
    beta: true,
    text: 'Meet the next stars. Tap the orange Rookie Watch pill to see last night’s best rookies, or the top 15 of the season so far. Add any of them to your team in one tap.',
    icon: <Icon><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6.1L12 16.6 6.6 19.6l1.2-6.1L3.3 9.3l6.1-.7L12 3z" /></Icon>,
  },
  {
    title: 'Smart Stats',
    beta: true,
    text: 'Spot last night’s breakout performances. Find it under Roster Building Tools, then add the standouts to your team.',
    icon: <Icon><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></Icon>,
  },
  {
    title: 'Easier on your phone',
    text: 'The top of the page is more compact, so your players show up higher without scrolling.',
    icon: <Icon><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></Icon>,
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
                <p className="flex items-center gap-2 font-display font-700 text-sm uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
                  {item.title}
                  {item.beta && (
                    <span
                      className="font-mono text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5"
                      style={{ background: 'rgba(var(--skin-primary-rgb),0.2)', color: 'var(--color-text-primary)' }}
                    >
                      Beta
                    </span>
                  )}
                </p>
                <p className="font-body text-xs leading-snug mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p className="font-body text-xs mt-1 mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          Plus a few small fixes behind the scenes.
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
