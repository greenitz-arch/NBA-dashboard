'use client';

import { useEffect } from 'react';
import { isIOS, isInAppBrowser } from '@/lib/useInstall';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-700"
        style={{ background: 'var(--neon-orange)', color: '#fff' }}
      >
        {n}
      </span>
      <span className="font-body text-sm leading-snug" style={{ color: 'var(--color-text-primary)' }}>{children}</span>
    </div>
  );
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className="inline align-[-2px]">
    <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
  </svg>
);

export default function InstallGuide({ onClose }: { onClose: () => void }) {
  const ios = isIOS();
  const inApp = isInAppBrowser();

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add to Home Screen"
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm"
        style={{ background: 'var(--color-card)', border: '2px solid var(--neon-orange)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display font-800 text-lg uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-primary)' }}>
          {ios ? 'Add to Home Screen on iPhone' : 'Add to Home Screen'}
        </h3>
        {inApp && (
          <p className="font-body text-xs mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            You&apos;re inside another app&apos;s browser. Open this page in {ios ? 'Safari' : 'Chrome'} first, then follow the steps.
          </p>
        )}
        {ios ? (
          <>
            <Step n={1}>Tap the Share button <ShareIcon /> in Safari&apos;s toolbar</Step>
            <Step n={2}>Scroll down and tap Add to Home Screen</Step>
            <Step n={3}>Tap Add in the top corner</Step>
          </>
        ) : (
          <>
            <Step n={1}>Open your browser&apos;s menu (the three dots, or the Share button)</Step>
            <Step n={2}>Choose Add to Home Screen, or Install app</Step>
            <Step n={3}>Confirm, and Courtside appears with your other apps</Step>
          </>
        )}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm"
          style={{ background: 'var(--neon-orange)', color: '#fff' }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
