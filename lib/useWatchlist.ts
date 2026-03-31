'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Player } from './nba';

const STORAGE_KEY = 'nba_watchlist_v2';
export const MAX_ROSTER = 15;

export interface WatchlistPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  team_id: number;
  team_abbreviation: string;
  team_full_name: string;
  added_at: number;
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistPlayer[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setWatchlist(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, []);

  const persist = (list: WatchlistPlayer[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  };

  const addPlayer = useCallback((player: Player): 'added' | 'full' | 'exists' => {
    let result: 'added' | 'full' | 'exists' = 'added';
    setWatchlist(prev => {
      if (prev.find(p => p.id === player.id)) { result = 'exists'; return prev; }
      if (prev.length >= MAX_ROSTER) { result = 'full'; return prev; }
      const entry: WatchlistPlayer = {
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
        team_id: player.team.id,
        team_abbreviation: player.team.abbreviation,
        team_full_name: player.team.full_name,
        added_at: Date.now(),
      };
      const next = [...prev, entry];
      persist(next);
      return next;
    });
    return result;
  }, []);

  const removePlayer = useCallback((playerId: number) => {
    setWatchlist(prev => {
      const next = prev.filter(p => p.id !== playerId);
      persist(next);
      return next;
    });
  }, []);

  const isWatching = useCallback((playerId: number) => {
    return watchlist.some(p => p.id === playerId);
  }, [watchlist]);

  const isFull = watchlist.length >= MAX_ROSTER;

  return { watchlist, addPlayer, removePlayer, isWatching, isFull, hydrated };
}
