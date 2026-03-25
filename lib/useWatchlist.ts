// lib/useWatchlist.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Player } from './balldontlie';

const STORAGE_KEY = 'nba_watchlist_v1';

export interface WatchlistPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  team_id: number;
  team_abbreviation: string;
  team_full_name: string;
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

  const save = useCallback((list: WatchlistPlayer[]) => {
    setWatchlist(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }, []);

  const addPlayer = useCallback((player: Player) => {
    setWatchlist(prev => {
      if (prev.find(p => p.id === player.id)) return prev;
      const entry: WatchlistPlayer = {
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
        team_id: player.team.id,
        team_abbreviation: player.team.abbreviation,
        team_full_name: player.team.full_name,
      };
      const next = [...prev, entry];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removePlayer = useCallback((playerId: number) => {
    setWatchlist(prev => {
      const next = prev.filter(p => p.id !== playerId);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const isWatching = useCallback((playerId: number) => {
    return watchlist.some(p => p.id === playerId);
  }, [watchlist]);

  const clearAll = useCallback(() => {
    save([]);
  }, [save]);

  return { watchlist, addPlayer, removePlayer, isWatching, clearAll, hydrated };
}
