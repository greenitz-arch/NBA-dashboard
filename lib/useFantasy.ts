'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WatchlistPlayer } from './storage';
import {
  summarizeGamelog,
  parseInjuries,
  normalizeName,
  type GamelogSummary,
  type InjuryEntry,
  type InjuryIndex,
  type PlayerFantasy,
} from './fantasy';

const ESPN_GAMELOG = (id: number) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog`;
const ESPN_INJURIES = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';

const CACHE_MS = 15 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_MS) return data as T;
  } catch {
    // ignore
  }
  return null;
}

function cacheSet(key: string, data: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // ignore
  }
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

type InjurySaved = { ids: [string, InjuryEntry][]; names: [string, InjuryEntry][] };

async function loadInjuries(): Promise<InjuryIndex | null> {
  const cached = cacheGet<InjurySaved>('fantasy_injuries');
  if (cached) {
    return { byId: new Map(cached.ids), byName: new Map(cached.names) };
  }
  try {
    const idx = parseInjuries(await getJson(ESPN_INJURIES));
    cacheSet('fantasy_injuries', { ids: [...idx.byId], names: [...idx.byName] });
    return idx;
  } catch {
    return null;
  }
}

async function loadSummary(id: number): Promise<GamelogSummary> {
  const key = `fantasy_gl_${id}`;
  const cached = cacheGet<GamelogSummary>(key);
  if (cached) return cached;
  try {
    const summary = summarizeGamelog(await getJson(ESPN_GAMELOG(id)));
    cacheSet(key, summary);
    return summary;
  } catch {
    return { games: 0, basis: null, avg: null, last7: null, last7Games: 0, value: null, form: null };
  }
}

export interface UseFantasyReturn {
  data: Record<number, PlayerFantasy>;
  injuryOk: boolean;
  loading: boolean;
}

export function useFantasy(players: WatchlistPlayer[], enabled: boolean): UseFantasyReturn {
  const [data, setData] = useState<Record<number, PlayerFantasy>>({});
  const [injuryOk, setInjuryOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const idsKey = useMemo(() => players.map(p => p.id).sort((a, b) => a - b).join(','), [players]);

  useEffect(() => {
    if (!enabled || players.length === 0) {
      setData({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const injuries = await loadInjuries();
      const summaries = new Map<number, GamelogSummary>();
      for (let i = 0; i < players.length; i += 5) {
        const chunk = players.slice(i, i + 5);
        const results = await Promise.all(chunk.map(p => loadSummary(p.id)));
        chunk.forEach((p, k) => summaries.set(p.id, results[k]));
      }
      if (cancelled) return;

      const next: Record<number, PlayerFantasy> = {};
      for (const p of players) {
        const s = summaries.get(p.id)!;
        let status: PlayerFantasy['status'] = null;
        let note = '';
        if (injuries) {
          const hit =
            injuries.byId.get(String(p.id)) ??
            injuries.byName.get(normalizeName(`${p.first_name} ${p.last_name}`));
          status = hit ? hit.status : 'healthy';
          note = hit ? hit.note : '';
        }
        next[p.id] = {
          status,
          statusNote: note,
          games: s.games,
          basis: s.basis,
          avg: s.avg,
          last7: s.last7,
          last7Games: s.last7Games,
          value: s.value,
          form: s.form,
        };
      }
      setInjuryOk(injuries !== null);
      setData(next);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey]);

  return { data, injuryOk, loading };
}
