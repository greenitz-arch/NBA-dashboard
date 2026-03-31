'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWatchlist, MAX_ROSTER, type WatchlistPlayer } from '@/lib/useWatchlist';
import { usePreferences } from '@/lib/usePreferences';
import type { GameStats, Player } from '@/lib/nba';
import PlayerCard from './PlayerCard';
import PlayerSelector from './PlayerSelector';
import EmptyState from './EmptyState';
import Toast from './Toast';

const POLL_INTERVAL = 10 * 60 * 1000;

function shouldPoll(): boolean {
  const now = new Date();
  const etHour = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  ).getHours();
  return etHour >= 18 || etHour < 3;
}

function sortPlayers(
  players: WatchlistPlayer[],
  stats: Record<number, GameStats>,
  sortBy: string
): WatchlistPlayer[] {
  const copy = [...players];
  switch (sortBy) {
    case 'az':
      return copy.sort((a, b) => a.last_name.localeCompare(b.last_name));
    case 'by-team':
      return copy.sort((a, b) => a.team_full_name.localeCompare(b.team_full_name));
    case 'by-position': {
      const order = ['C', 'PF', 'SF', 'SG', 'PG'];
      return copy.sort((a, b) => {
        const ai = order.indexOf(a.position) === -1 ? 99 : order.indexOf(a.position);
        const bi = order.indexOf(b.position) === -1 ? 99 : order.indexOf(b.position);
        return ai - bi;
      });
    }
    case 'date-added':
      return copy.sort((a, b) => (a.added_at ?? 0) - (b.added_at ?? 0));
    case 'recent':
    default:
      return copy.sort((a, b) => {
        const aDate = stats[a.id]?.gameDate ?? '';
        const bDate = stats[b.id]?.gameDate ?? '';
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }
}

// Scroll indicator — pulsing chevron, disappears when at bottom of page
function ScrollArrow({ gridRef }: { gridRef: React.RefObject<HTMLDivElement | null> }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => {
      const el = gridRef.current;
      if (!el) { setVisible(false); return; }

      const rect = el.getBoundingClientRect();
      // Only show if grid bottom is more than 100px below viewport
      const overflows = rect.bottom > window.innerHeight + 100;
      // Hide when within 80px of page bottom
      const atBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 80;

      setVisible(overflows && !atBottom);
    };

    const t = setTimeout(check, 400);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [gridRef]);

  if (!visible) return null;

  return (
    <div className="flex justify-center my-3" aria-hidden="true">
      <div
        className="animate-pulse-soft"
        style={{
          color: 'var(--neon-orange)',
          filter: 'drop-shadow(0 0 8px rgba(255,107,43,0.5))',
        }}
      >
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const { watchlist, addPlayer, removePlayer, isWatching, isFull, hydrated } = useWatchlist();
  const { prefs } = usePreferences();
  const [stats, setStats] = useState<Record<number, GameStats>>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorMode, setSelectorMode] = useState<'conference' | 'all-teams' | 'search'>('conference');
  const [showToast, setShowToast] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const fetchStats = useCallback(async (playerIds: number[], force = false) => {
    if (playerIds.length === 0) { setStats({}); return; }
    if (!force && !shouldPoll()) return;

    const cacheKey = `stats_${[...playerIds].sort().join(',')}`;
    if (!force) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < POLL_INTERVAL) { setStats(data); return; }
        }
      } catch {}
    }

    setLoadingStats(true);
    try {
      const res = await fetch(`/api/stats?playerIds=${playerIds.join(',')}`);
      const data = await res.json();
      const parsed: Record<number, GameStats> = {};
      for (const [k, v] of Object.entries(data)) parsed[Number(k)] = v as GameStats;
      const ts = Date.now();
      setStats(parsed);
      sessionStorage.setItem(cacheKey, JSON.stringify({ data: parsed, ts }));
      sessionStorage.setItem('last_stats_fetch', String(ts));
      window.dispatchEvent(new Event('stats-updated'));
    } catch {}
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    fetchStats(watchlist.map(p => p.id), true);
  }, [watchlist, hydrated, fetchStats]);

  useEffect(() => {
    if (!hydrated || watchlist.length === 0) return;
    const tick = () => {
      fetchStats(watchlist.map(p => p.id));
      pollTimer.current = setTimeout(tick, POLL_INTERVAL);
    };
    pollTimer.current = setTimeout(tick, POLL_INTERVAL);
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [watchlist, hydrated, fetchStats]);

  const handleOpenSelector = useCallback((mode: 'conference' | 'all-teams' | 'search' = 'conference') => {
    if (isFull) { setShowToast(true); return; }
    setSelectorMode(mode);
    setSelectorOpen(true);
  }, [isFull]);

  const handleAddPlayer = useCallback((player: Player) => {
    const result = addPlayer(player);
    if (result === 'full') setShowToast(true);
  }, [addPlayer]);

  const sortedWatchlist = sortPlayers(watchlist, stats, prefs.sortBy);
  const hasPlayers = watchlist.length > 0;

  if (!hydrated) {
    return (
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-2xl animate-pulse h-64"
              style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="max-w-[1100px] mx-auto px-6 pt-8 pb-4">

        {/* Hero */}
        <div className={`mb-4 ${hasPlayers ? 'text-center' : ''}`}>
          {hasPlayers ? (
            <>
              <h1
                className="font-display font-800 text-3xl uppercase tracking-wide leading-tight"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Welcome to your courtside seats
              </h1>
              <p
                className="font-body mt-3 leading-snug"
                style={{ color: 'var(--color-text-secondary)', fontSize: '1.05rem' }}
              >
                Ready to expand your roster?<br />
                You can track up to 15 players.
              </p>
              <button
                onClick={() => handleOpenSelector('conference')}
                aria-label="Add more players to your roster"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
                style={{ background: 'var(--neon-orange)', color: 'white', boxShadow: 'var(--glow-orange)' }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                  stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Players
              </button>
            </>
          ) : (
            <h1
              className="font-display font-800 uppercase tracking-tight leading-none"
              style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', color: 'var(--color-text-primary)' }}
            >
              Your <span style={{ color: 'var(--neon-orange)' }}>Roster</span>
            </h1>
          )}
        </div>

        {/* Progress bar */}
        {hasPlayers && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--color-progress-bg)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(watchlist.length / MAX_ROSTER) * 100}%`,
                  background: watchlist.length >= MAX_ROSTER ? 'var(--neon-red)' : 'var(--neon-orange)',
                }}
              />
            </div>
            <span
              className="font-mono text-[10px] uppercase tracking-wider whitespace-nowrap"
              style={{ color: watchlist.length >= MAX_ROSTER ? 'var(--neon-red)' : 'var(--color-text-secondary)' }}
            >
              {watchlist.length >= MAX_ROSTER
                ? '15 / 15 — Roster full'
                : `${watchlist.length} / ${MAX_ROSTER} players`}
            </span>
          </div>
        )}

        {/* Player grid */}
        {hasPlayers && (
          <>
            <div ref={gridRef} className="grid grid-cols-3 lg:grid-cols-5 gap-3 mb-2">
              {sortedWatchlist.map((player, i) => (
                <div
                  key={player.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}
                >
                  <PlayerCard
                    player={player}
                    stats={stats[player.id] ?? null}
                    loading={loadingStats && !stats[player.id]}
                    onRemove={removePlayer}
                  />
                </div>
              ))}
            </div>
            <ScrollArrow gridRef={gridRef} />
          </>
        )}

        {/* Tip boxes — always visible */}
        <EmptyState
          onOpenSelector={handleOpenSelector}
          hasPlayers={hasPlayers}
        />
      </section>

      {selectorOpen && (
        <PlayerSelector
          onAdd={handleAddPlayer}
          onRemove={removePlayer}
          isWatching={isWatching}
          isFull={isFull}
          onClose={() => setSelectorOpen(false)}
          initialMode={selectorMode}
        />
      )}

      {showToast && (
        <Toast
          title="Your roster is full"
          subtitle="You can only track up to 15 players."
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}
