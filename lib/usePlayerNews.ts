'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WatchlistPlayer } from './storage';
import { normalizeName } from './fantasy';
import { fetchPlayerNews, matchesRoster, type NewsItem } from './playerNews';

const SEEN_KEY = 'courtside_news_seen_v1';
const CACHE_KEY = 'courtside_news_cache_v1';
const CACHE_MS = 2 * 60 * 1000; // opening the panel again within 2 minutes reuses the last answer
const REFRESH_MS = 10 * 60 * 1000;

export type NewsStatus = 'idle' | 'loading' | 'ready' | 'error';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-600)));
  } catch {
    // storage blocked: dots simply come back next visit
  }
}

export function usePlayerNews(roster: WatchlistPlayer[], enabled: boolean) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<NewsStatus>('idle');
  const [updatedAt, setUpdatedAt] = useState(0);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const inflight = useRef(false);
  const itemsRef = useRef<NewsItem[]>([]);
  itemsRef.current = items;

  useEffect(() => { setSeen(loadSeen()); }, []);

  const refresh = useCallback(async (force = false) => {
    if (inflight.current) return;
    if (!force) {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) {
          const { ts, data } = JSON.parse(raw) as { ts: number; data: NewsItem[] };
          if (Date.now() - ts < CACHE_MS) {
            setItems(data);
            setUpdatedAt(ts);
            setStatus('ready');
            return;
          }
        }
      } catch {
        // ignore a damaged cache
      }
    }
    inflight.current = true;
    setStatus(s => (s === 'ready' ? s : 'loading'));
    try {
      const res = await fetchPlayerNews();
      if (res.ok) {
        const ts = Date.now();
        setItems(res.items);
        setUpdatedAt(ts);
        setStatus('ready');
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts, data: res.items })); } catch { /* ignore */ }
      } else {
        setStatus(itemsRef.current.length ? 'ready' : 'error');
      }
    } catch {
      setStatus(itemsRef.current.length ? 'ready' : 'error');
    }
    inflight.current = false;
  }, []);

  // First look shortly after the page settles, then every 10 minutes while the page is visible.
  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(() => refresh(), 1500);
    const every = setInterval(() => {
      if (document.visibilityState === 'visible') refresh(true);
    }, REFRESH_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [enabled, refresh]);

  const idKey = roster.map(p => p.id).sort((a, b) => a - b).join(',');
  const { ids, names } = useMemo(() => ({
    ids: new Set(roster.map(p => p.id)),
    names: new Set(roster.map(p => normalizeName(`${p.first_name} ${p.last_name}`))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [idKey]);

  const mine = useMemo(() => items.filter(i => matchesRoster(i, ids, names)), [items, ids, names]);
  const unseenMine = useMemo(() => mine.filter(i => !seen.has(i.id)).length, [mine, seen]);

  const markAllSeen = useCallback(() => {
    setSeen(prev => {
      const next = new Set(prev);
      itemsRef.current.forEach(i => next.add(i.id));
      saveSeen(next);
      return next;
    });
  }, []);

  return { items, mine, status, updatedAt, seen, unseenMine, refresh, markAllSeen, ids, names };
}

export type PlayerNewsApi = ReturnType<typeof usePlayerNews>;
