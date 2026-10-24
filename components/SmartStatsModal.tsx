'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlayerCard from './PlayerCard';
import { loadSmartStats, type SmartPick } from '@/lib/smartStats';
import { MSG } from '@/lib/messages';
import type { Player } from '@/lib/nba';
import type { WatchlistPlayer } from '@/lib/storage';

interface SmartStatsModalProps {
  rosterIds: number[];          // players already on the team being viewed
  isFull: boolean;              // that team has 15 players
  noSpoilers: boolean;          // hide W / L on the tiles, like the roster cards
  onAddPlayer: (player: Player) => void;
  onClose: () => void;
}

type View =
  | { phase: 'loading' }
  | { phase: 'ok'; dateLabel: string; picks: SmartPick[] }
  | { phase: 'none'; dateLabel: string }
  | { phase: 'error' };

function toWatchlistPlayer(p: Player): WatchlistPlayer {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    position: p.position,
    team_id: p.team.id,
    team_abbreviation: p.team.abbreviation,
    team_full_name: p.team.full_name,
    added_at: 0,
  };
}

const TILE_WIDTH = 'w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)]';

export default function SmartStatsModal({ rosterIds, isFull, noSpoilers, onAddPlayer, onClose }: SmartStatsModalProps) {
  const [view, setView] = useState<View>({ phase: 'loading' });
  const [added, setAdded] = useState<Set<number>>(new Set());
  const rosterRef = useRef(rosterIds);
  rosterRef.current = rosterIds;
  const runId = useRef(0);

  const load = useCallback(() => {
    const id = ++runId.current;
    setView({ phase: 'loading' });
    // The players already on the roster right now are left out of the picks.
    loadSmartStats(new Set(rosterRef.current)).then(r => {
      if (id !== runId.current) return;
      if (r.status === 'ok') setView({ phase: 'ok', dateLabel: r.dateLabel, picks: r.picks });
      else if (r.status === 'none') setView({ phase: 'none', dateLabel: r.dateLabel });
      else setView({ phase: 'error' });
    });
  }, []);

  useEffect(() => {
    load();
    return () => { runId.current++; };
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const watchPlayers = useMemo(() => {
    const map = new Map<number, WatchlistPlayer>();
    if (view.phase === 'ok') view.picks.forEach(p => map.set(p.player.id, toWatchlistPlayer(p.player)));
    return map;
  }, [view]);

  const handleAdd = (pick: SmartPick) => {
    if (isFull) return;
    onAddPlayer(pick.player);
    setAdded(prev => new Set(prev).add(pick.player.id));
  };

  const subtitle =
    view.phase === 'ok' || view.phase === 'none'
      ? view.dateLabel ? `Last game night · ${view.dateLabel}` : 'Last game night'
      : 'Last game night';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Smart Stats"
    >
      <style>{`
        .smart-stats-panel {
          background: var(--color-bg);
          background: color-mix(in srgb, var(--color-bg) 90%, transparent);
        }
      `}</style>
      <div
        className="smart-stats-panel w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-4 sm:p-5"
        style={{ border: '10px solid rgba(var(--skin-primary-rgb),0.45)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2
                className="font-display font-800 text-xl uppercase tracking-wide"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Smart Stats
              </h2>
              <span
                className="font-mono text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5"
                style={{ background: 'rgba(var(--skin-primary-rgb),0.2)', color: 'var(--color-text-primary)' }}
              >
                Beta
              </span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-widest mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Smart Stats"
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {view.phase === 'loading' && (
          <div className="flex flex-wrap justify-center gap-3" aria-busy="true" aria-label="Loading standout performances">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className={`${TILE_WIDTH} shimmer rounded-2xl h-[22rem]`} />
            ))}
          </div>
        )}

        {view.phase === 'error' && (
          <div className="text-center py-10" role="alert">
            <p className="font-body text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              {MSG.generic}
            </p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider"
              style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              {MSG.tryAgain}
            </button>
          </div>
        )}

        {view.phase === 'none' && (
          <div className="text-center py-10">
            <p className="font-display font-700 text-lg uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-primary)' }}>
              No standout surprises
            </p>
            <p className="font-body text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Nobody went far above their usual numbers on the last game night.
            </p>
          </div>
        )}

        {view.phase === 'ok' && (
          <>
            {isFull && (
              <p className="font-mono text-[10px] uppercase tracking-widest text-center mb-3" style={{ color: 'var(--neon-red)' }}>
                Your roster is full. Remove a player to add more.
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-3">
              {view.picks.map(pick => {
                const id = pick.player.id;
                const inRoster = added.has(id) || rosterIds.includes(id);
                const watch = watchPlayers.get(id);
                if (!watch) return null;
                return (
                  <div key={id} className={TILE_WIDTH}>
                    <PlayerCard
                      player={watch}
                      stats={pick.stats}
                      heroKey={pick.heroKey}
                      hideRemove
                      hideResult={noSpoilers}
                      onRemove={() => {}}
                      footer={
                        inRoster ? (
                          <div
                            className="w-full py-2 rounded-xl text-center font-display font-600 uppercase tracking-wider text-sm"
                            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                          >
                            Added ✓
                          </div>
                        ) : isFull ? (
                          <div
                            className="w-full py-2 rounded-xl text-center font-display font-600 uppercase tracking-wider text-sm"
                            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}
                          >
                            Roster full
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAdd(pick)}
                            className="w-full py-2 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-[1.03]"
                            style={{ background: '#000000', color: 'white', border: '1px solid rgba(255,255,255,0.18)' }}
                          >
                            Add to Roster
                          </button>
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
