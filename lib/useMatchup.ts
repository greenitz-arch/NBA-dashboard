'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WatchlistPlayer } from './storage';
import type { InjuryIndex } from './fantasy';
import { loadInjuries } from './useFantasy';
import {
  summarizeGames,
  fetchTeamGames,
  fetchLiveLines,
  type Line,
  type PlayerGames,
  type TeamGame,
} from './matchup';

const GAMELOG_URL = (id: number) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog`;

const GAMELOG_CACHE_MS = 5 * 60 * 1000;
const LIVE_EVERY_MS = 30 * 1000; // while a roster player's game is in progress
const IDLE_EVERY_MS = 2 * 60 * 1000; // otherwise
const CACHE_PREFIX = 'h2h_gl2_';

function readCache(id: number): PlayerGames | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < GAMELOG_CACHE_MS) return data as PlayerGames;
  } catch {
    // ignore
  }
  return null;
}

function writeCache(id: number, data: PlayerGames) {
  try {
    sessionStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore
  }
}

function clearGamelogCache() {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

const EMPTY_GAMES: PlayerGames = { basis: null, gamesPlayed: 0, avg: null, recent: [], last: null };

async function loadGames(id: number): Promise<PlayerGames> {
  const cached = readCache(id);
  if (cached) return cached;
  try {
    const res = await fetch(GAMELOG_URL(id), { cache: 'no-store' });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    const data = summarizeGames(await res.json());
    writeCache(id, data);
    return data;
  } catch {
    return EMPTY_GAMES;
  }
}

export interface UseMatchupReturn {
  games: Record<number, PlayerGames>;
  injuries: InjuryIndex | null;
  teamGames: Map<number, TeamGame>;
  liveLines: Map<number, Line>;
  loading: boolean;
  updatedAt: number;
  anyLive: boolean;
}

export function useMatchup(players: WatchlistPlayer[], enabled: boolean): UseMatchupReturn {
  const [games, setGames] = useState<Record<number, PlayerGames>>({});
  const [injuries, setInjuries] = useState<InjuryIndex | null>(null);
  const [teamGames, setTeamGames] = useState<Map<number, TeamGame>>(new Map());
  const [liveLines, setLiveLines] = useState<Map<number, Line>>(new Map());
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [reloadTick, setReloadTick] = useState(0);
  const [anyLive, setAnyLive] = useState(false);

  const playersRef = useRef(players);
  playersRef.current = players;
  const hadLive = useRef(false);

  const idsKey = useMemo(
    () => Array.from(new Set(players.map(p => p.id))).sort((a, b) => a - b).join(','),
    [players]
  );
  const teamsKey = useMemo(
    () => Array.from(new Set(players.map(p => p.team_id))).sort((a, b) => a - b).join(','),
    [players]
  );

  // 1) Season averages, this week's finished games, and the injury list.
  useEffect(() => {
    if (!enabled || idsKey === '') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const ids = idsKey.split(',').map(Number);
      const [inj] = await Promise.all([loadInjuries()]);
      const found: Record<number, PlayerGames> = {};
      for (let i = 0; i < ids.length; i += 5) {
        const chunk = ids.slice(i, i + 5);
        const res = await Promise.all(chunk.map(loadGames));
        chunk.forEach((id, k) => (found[id] = res[k]));
      }
      if (cancelled) return;
      setInjuries(inj);
      setGames(found);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, idsKey, reloadTick]);

  // 2) Today's games and live box scores, refreshed on a timer.
  useEffect(() => {
    if (!enabled || idsKey === '') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let liveNow = false;

    const run = async () => {
      if (!document.hidden) {
        const tg = await fetchTeamGames();
        if (cancelled) return;
        if (tg) {
          setTeamGames(tg);
          const mine = new Set(playersRef.current.map(p => p.team_id));
          const liveEvents = new Set<string>();
          tg.forEach((g, teamId) => {
            if (g.state === 'in' && mine.has(teamId)) liveEvents.add(g.eventId);
          });
          const lines = liveEvents.size > 0 ? await fetchLiveLines(Array.from(liveEvents)) : new Map<number, Line>();
          if (cancelled) return;
          setLiveLines(lines);
          liveNow = liveEvents.size > 0;
          setAnyLive(liveNow);
          // A live game just finished: fetch the game logs again so the
          // finished game is counted from the official record.
          if (hadLive.current && !liveNow) {
            clearGamelogCache();
            setReloadTick(t => t + 1);
          }
          hadLive.current = liveNow;
          setUpdatedAt(Date.now());
        }
      }
      timer = setTimeout(run, liveNow ? LIVE_EVERY_MS : IDLE_EVERY_MS);
    };
    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, idsKey, teamsKey]);

  return { games, injuries, teamGames, liveLines, loading, updatedAt, anyLive };
}
