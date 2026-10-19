'use client';

import { useEffect, useState } from 'react';
import type { PlayerNewsApi } from '@/lib/usePlayerNews';
import { agoLabel, matchesRoster, type NewsItem, type NewsKind } from '@/lib/playerNews';
import { MSG } from '@/lib/messages';
import { normalizeName } from '@/lib/fantasy';

type Scope = 'mine' | 'league';
type Filter = 'all' | NewsKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'injury', label: 'Injuries' },
  { value: 'back', label: 'Back' },
  { value: 'move', label: 'Moves' },
  { value: 'news', label: 'News' },
];

const TAG: Record<NewsKind, { label: string; bg: string; color: string }> = {
  injury: { label: 'Injury', bg: 'rgba(255,59,92,0.14)', color: 'var(--neon-red)' },
  back: { label: 'Back', bg: 'rgba(0,255,136,0.12)', color: 'var(--neon-green)' },
  move: { label: 'Roster move', bg: 'rgba(0,212,255,0.12)', color: 'var(--neon-blue)' },
  news: { label: 'News', bg: 'var(--color-hover-strong)', color: 'var(--color-text-secondary)' },
};

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function updatedLabel(ts: number): string {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  return mins < 1 ? 'updated just now' : `updated ${mins} min ago`;
}

function Row({ item, unseen, mineNames }: { item: NewsItem; unseen: boolean; mineNames: Set<string> | null }) {
  const tag = TAG[item.kind];
  // Lead with one of the person's own players when this item is about them.
  const lead = item.players.find(p => mineNames && mineNames.has(normalizeName(p.name))) ?? item.players[0];
  const sub = [lead.team, item.sub].filter(Boolean).join(' · ');
  return (
    <div
      className="rounded-xl p-3 mb-2"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex gap-3">
        <div
          className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-display font-700 text-xs"
          style={{ background: 'var(--color-initials-bg)', border: '1px solid var(--color-initials-border)', color: 'var(--color-text-secondary)' }}
        >
          {initials(lead.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-body text-sm font-500 truncate" style={{ color: 'var(--color-text-primary)' }}>
              {lead.name}
              {unseen && (
                <span
                  aria-label="New"
                  className="inline-block rounded-full ml-1.5 align-middle"
                  style={{ width: 8, height: 8, background: 'var(--neon-orange)' }}
                />
              )}
            </span>
            <span className="font-mono text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {agoLabel(item)}
            </span>
          </div>
          {sub && (
            <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{sub}</div>
          )}
          <p className="font-body text-[13px] leading-snug mt-1.5" style={{ color: 'var(--color-text-primary)' }}>
            {item.title}
          </p>
          {item.returnDate && (
            <p className="font-mono text-[10px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              Expected back: {item.returnDate}
            </p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span
              className="font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5"
              style={{ background: tag.bg, color: tag.color }}
            >
              {tag.label}
            </span>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-wider"
              style={{ color: 'var(--neon-orange)' }}
            >
              Read more ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl p-3 mb-2 flex gap-3"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="shimmer w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="shimmer h-3 w-32 rounded" />
            <div className="shimmer h-3 w-full rounded" />
            <div className="shimmer h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function PlayerNewsPanel({ news, onClose }: { news: PlayerNewsApi; onClose: () => void }) {
  const { items, status, updatedAt, seen, refresh, markAllSeen, ids, names } = news;
  const [scope, setScope] = useState<Scope>('mine');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const shown = items.filter(i =>
    (scope === 'league' || matchesRoster(i, ids, names)) && (filter === 'all' || i.kind === filter));
  const anyUnseen = items.some(i => !seen.has(i.id));
  const firstLoad = status === 'loading' && items.length === 0;
  const failed = status === 'error' && items.length === 0;

  const pill = (on: boolean): React.CSSProperties => ({
    background: on ? 'var(--neon-orange)' : 'transparent',
    border: `1px solid ${on ? 'var(--neon-orange)' : 'var(--color-border)'}`,
    color: on ? '#fff' : 'var(--color-text-primary)',
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Player news"
    >
      <div
        className="rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <div>
            <h3 className="font-display font-800 text-lg uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
              Player news
            </h3>
            <p className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              Last 36 hours{updatedAt ? ` · ${updatedLabel(updatedAt)}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refresh(true)}
              aria-label="Refresh"
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" />
              </svg>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4 flex gap-2">
          {(['mine', 'league'] as Scope[]).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className="flex-1 py-2 rounded-lg font-display font-600 uppercase tracking-wider text-xs"
              style={pill(scope === s)}
            >
              {s === 'mine' ? 'My roster' : 'League'}
            </button>
          ))}
        </div>
        <div className="px-4 pt-2.5 pb-1 flex flex-wrap gap-1.5">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className="px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider"
              style={pill(filter === f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-2">
          {firstLoad && <SkeletonRows />}
          {failed && (
            <div className="rounded-xl p-5 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="font-body text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>{MSG.newsFailed}</p>
              <button
                onClick={() => refresh(true)}
                className="px-4 py-2 rounded-xl font-display font-600 uppercase tracking-wider text-xs"
                style={{ background: 'var(--neon-orange)', color: '#fff' }}
              >
                {MSG.tryAgain}
              </button>
            </div>
          )}
          {!firstLoad && !failed && shown.length === 0 && (
            <div className="rounded-xl p-5 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="font-body text-sm font-500" style={{ color: 'var(--color-text-primary)' }}>
                Nothing new in the last 36 hours
              </p>
              <p className="font-body text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                {scope === 'mine' ? 'None of your players have news right now.' : 'No items match this filter.'}
              </p>
              {scope === 'mine' && (
                <button
                  onClick={() => setScope('league')}
                  className="mt-3 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  Show league news
                </button>
              )}
            </div>
          )}
          {shown.map(i => (
            <Row key={i.id} item={i} unseen={!seen.has(i.id)} mineNames={scope === 'mine' ? names : null} />
          ))}
        </div>

        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            Source: ESPN
          </span>
          <button
            onClick={markAllSeen}
            disabled={!anyUnseen}
            className="px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', opacity: anyUnseen ? 1 : 0.45 }}
          >
            Mark all as seen
          </button>
        </div>
      </div>
    </div>
  );
}
