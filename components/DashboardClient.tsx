// components/DashboardClient.tsx
'use client';

import { useState, useEffect } from 'react';
import { useWatchlist } from '@/lib/useWatchlist';
import type { GameStats, Player } from '@/lib/balldontlie';
import PlayerCard from './PlayerCard';
import PlayerSelector from './PlayerSelector';
import EmptyState from './EmptyState';

export default function DashboardClient() {
  const { watchlist, addPlayer, removePlayer, isWatching, hydrated } = useWatchlist();
  const [stats, setStats] = useState<Record<number, GameStats>>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  // Fetch stats whenever watchlist changes
  useEffect(() => {
    if (!hydrated || watchlist.length === 0) { setStats({}); return; }

    // Avoid re-fetching if same players and fetched in last 5 minutes
    const ids = watchlist.map(p => p.id).sort().join(',');
    const cacheKey = `stats_${ids}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 5 * 60 * 1000) {
          setStats(data);
          setLastFetched(ts);
          return;
        }
      } catch {}
    }

    setLoadingStats(true);
    const idString = watchlist.map(p => p.id).join(',');
    fetch(`/api/stats?playerIds=${idString}`)
      .then(r => r.json())
      .then(data => {
        // Keys come back as strings, convert to numbers
        const parsed: Record<number, GameStats> = {};
        for (const [k, v] of Object.entries(data)) {
          parsed[Number(k)] = v as GameStats;
        }
        setStats(parsed);
        setLastFetched(Date.now());
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ data: parsed, ts: Date.now() }));
        } catch {}
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [watchlist, hydrated]);

  const handleAddPlayer = (player: Player) => {
    addPlayer(player);
  };

  if (!hydrated) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl overflow-hidden border animate-pulse"
              style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)', height: 320 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Hero section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-800 uppercase tracking-tight leading-none"
              style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
              Your <span style={{ color: 'var(--neon-orange)' }}>Watchlist</span>
            </h1>
            {watchlist.length > 0 && (
              <p className="font-mono text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>
                {watchlist.length} player{watchlist.length !== 1 ? 's' : ''} tracked
                {lastFetched && (
                  <> · Updated {new Date(lastFetched).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</>
                )}
              </p>
            )}
          </div>

          <button
            onClick={() => setSelectorOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
            style={{
              background: 'var(--neon-orange)',
              color: 'white',
              boxShadow: 'var(--glow-orange)',
            }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white fill-none" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
            Add Players
          </button>
        </div>
      </section>

      {/* Cards grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {watchlist.length === 0 ? (
          <EmptyState onOpenSelector={() => setSelectorOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {watchlist.map((player, i) => (
              <div
                key={player.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
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
        )}
      </section>

      {/* Player selector modal */}
      {selectorOpen && (
        <PlayerSelector
          onAdd={handleAddPlayer}
          isWatching={isWatching}
          onClose={() => setSelectorOpen(false)}
        />
      )}
    </>
  );
}
