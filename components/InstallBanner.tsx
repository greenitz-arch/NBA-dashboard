'use client';

import { useEffect, useState } from 'react';
import { useInstall, NUDGE_ELIGIBLE, markNudgeDone } from '@/lib/useInstall';
import InstallGuide from './InstallGuide';

// The big "Add to Home Screen" card, shown once to first-time visitors who haven't installed the app.
export default function InstallBanner() {
  const { mode, install } = useInstall();
  const [ready, setReady] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Decided after the page has loaded, so the server and browser pages match.
  useEffect(() => { setEligible(NUDGE_ELIGIBLE); setReady(true); }, []);

  // Already running as an installed app: nothing to nudge, and never nudge again.
  useEffect(() => {
    if (ready && eligible && mode === 'installed') { markNudgeDone(); setEligible(false); }
  }, [ready, eligible, mode]);

  if (!ready || (!eligible && !guideOpen)) return null;

  const dismiss = () => { markNudgeDone(); setEligible(false); setGuideOpen(false); };

  const add = async () => {
    const result = await install();
    if (result === 'guide') setGuideOpen(true);
    else dismiss();
  };

  return (
    <>
      {eligible && (
        <div
          className="ib-card rounded-2xl flex items-center gap-2 h-12 px-3 mb-2.5 sm:block sm:h-auto sm:p-4 sm:mb-5"
          style={{ background: 'var(--color-card)', border: '2px solid var(--neon-orange)' }}
          role="region"
          aria-label="Add Courtside to your home screen"
        >
          <div className="flex items-center sm:items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--neon-orange)" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5 w-5 h-5 sm:w-7 sm:h-7">
              <rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" />
            </svg>
            <div className="min-w-0">
              <p className="font-display font-700 text-[13px] sm:text-base uppercase tracking-wide truncate sm:whitespace-normal" style={{ color: 'var(--color-text-primary)' }}>
                Add Courtside to your home screen
              </p>
              <p className="hidden sm:block font-body text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Opens full screen and keeps your team one tap away.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-0 sm:mt-3 flex-shrink-0">
            <button
              onClick={add}
              className="sm:flex-[2] px-3 sm:px-0 py-1.5 sm:py-2.5 rounded-full sm:rounded-xl font-display font-600 uppercase tracking-wider text-xs sm:text-sm"
              style={{ background: 'var(--neon-orange)', color: '#fff' }}
            >
              <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add to Home Screen</span>
            </button>
            <button
              onClick={dismiss}
              aria-label="Not now"
              className="sm:flex-1 px-1.5 sm:px-0 py-1 sm:py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-lg sm:text-sm leading-none sm:leading-normal"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <span className="sm:hidden" aria-hidden="true">&times;</span><span className="hidden sm:inline">Not now</span>
            </button>
          </div>
        </div>
      )}
      {guideOpen && <InstallGuide onClose={dismiss} />}
    </>
  );
}
