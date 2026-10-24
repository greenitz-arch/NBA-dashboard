'use client';

// Top of the empty-team screen (no players yet): the welcome title, a one-line
// "how it works" card, and the two-line subtitle. The "Add Your First Player"
// pill and the quick-tour pill sit right underneath (they live in EmptyState).
// No close button on purpose: this only exists while the roster is empty.
export default function EmptyWelcomeHero() {
  return (
    <div className="text-center mb-6">
      <h1
        className="font-display font-800 text-3xl uppercase tracking-wide leading-tight"
        style={{ color: 'var(--color-text-primary)' }}
      >
        Welcome to your courtside seats
      </h1>

      <div className="mt-4 flex justify-center">
        <p
          className="inline-flex flex-wrap items-center justify-center gap-x-1.5 sm:gap-x-3 gap-y-1 rounded-2xl px-2.5 sm:px-6 py-2.5 sm:py-3 font-display font-600 normal-case sm:uppercase text-[11.5px] min-[390px]:text-[13px] sm:text-lg tracking-normal sm:tracking-wider"
          style={{
            background: 'rgba(0,0,0,0.34)',
            border: '1.5px solid rgba(255,255,255,0.4)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
            color: '#ffffff',
          }}
        >
          <span className="whitespace-nowrap">Pick your players</span>
          <span aria-hidden="true" style={{ color: '#ffb36b' }}>→</span>
          <span className="whitespace-nowrap">See how they played</span>
          <span aria-hidden="true" style={{ color: '#ffb36b' }}>→</span>
          <span className="whitespace-nowrap">Share your team</span>
        </p>
      </div>

      <p
        className="font-body mt-5 leading-snug"
        style={{ color: 'var(--color-text-secondary)', fontSize: '1.05rem' }}
      >
        Your team is empty.<br />
        Add up to 15 players to start tracking their stats.
      </p>
    </div>
  );
}
