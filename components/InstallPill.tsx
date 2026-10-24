'use client';

import { useState } from 'react';
import { useInstall, markNudgeDone } from '@/lib/useInstall';
import PillButton from './PillButton';
import InstallGuide from './InstallGuide';

// "Add to Home Screen" pill. Shown until the app is installed (then it disappears).
// Android / desktop Chrome: opens the browser's own install prompt.
// iPhone and others: opens the short how-to.
export default function InstallPill() {
  const { mode, install } = useInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (mode === 'installed' && !guideOpen) return null;

  const onClick = async () => {
    const result = await install();
    if (result === 'guide') setGuideOpen(true);
    else markNudgeDone();
  };

  return (
    <>
      <PillButton
        label="Add to Home Screen"
        className="install-pill"
        onClick={onClick}
        highlight
        icon={
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" />
          </svg>
        }
      />
      {guideOpen && <InstallGuide onClose={() => { markNudgeDone(); setGuideOpen(false); }} />}
    </>
  );
}
