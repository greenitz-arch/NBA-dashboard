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
          className="rounded-2xl p-4 mb-5"
          style={{ background: 'var(--color-card)', border: '2px solid var(--neon-orange)' }}
          role="region"
          aria-label="Add Courtside to your home screen"
        >
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--neon-orange)" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
              <rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M11 18h2" />
            </svg>
            <div>
              <p className="font-display font-700 text-base uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
                Add Courtside to your home screen
              </p>
              <p className="font-body text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Opens full screen and keeps your team one tap away.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={add}
              className="flex-[2] py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm"
              style={{ background: 'var(--neon-orange)', color: '#fff' }}
            >
              Add to Home Screen
            </button>
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
      {guideOpen && <InstallGuide onClose={dismiss} />}
    </>
  );
}
