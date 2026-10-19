'use client';

import { MSG } from '@/lib/messages';

// Catch-all: if something unexpected breaks while the page is showing, the person sees this
// instead of a blank screen.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-surface)' }}>
      <div
        className="rounded-2xl p-6 w-full max-w-sm text-center"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        role="alert"
      >
        <p className="font-body text-base mb-4" style={{ color: 'var(--color-text-primary)' }}>{MSG.generic}</p>
        <button
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm"
          style={{ background: 'var(--neon-orange)', color: '#fff' }}
        >
          {MSG.tryAgain}
        </button>
      </div>
    </main>
  );
}
