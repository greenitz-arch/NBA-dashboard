'use client';

import { BellIcon } from './PillButton';

// Round bell next to the team title. Opens Player news; the orange number counts unseen items.
export default function NewsBell({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `Player news, ${count} new` : 'Player news'}
      title="Player news"
      className="relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-110"
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--skin-primary)',
        color: 'var(--skin-primary)',
      }}
    >
      <BellIcon size={16} />
      {count > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center font-mono font-700"
          style={{ background: 'var(--neon-orange)', color: '#fff', fontSize: '0.65rem' }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
