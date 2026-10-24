// lib/smartStats.ts
// Smart Stats: finds players who had a "surprise" game on the last game night,
// meaning one stat far above what that player normally does. A bench player who
// averages 4 points and scores 31 beats a star who scores 31 as usual.
//
// Everything runs in the visitor's browser (ESPN blocks Netlify's servers but
// answers normal browsers). Nothing here is saved on a server.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getTeamByEspnId, type GameStats, type Player } from './nba';
import type { HeroKey } from './prominence';

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_STATS = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
const ET = 'America/New_York';
const DAY = 24 * 60 * 60 * 1000;

// ─── Settings you may want to change later ──────────────────────────────────

// Until this date each year, a player's "normal" is LAST season's averages.
// From this date on, it is the current season's averages. (month: 0 = Jan, so 10 = Nov)
const SWITCH_MONTH = 10;
const SWITCH_DAY = 30;

const MAX_TILES = 5;        // up to 5 players
const MIN_MINUTES = 12;     // ignore players who barely played
const LOOK_BACK_DAYS = 7;   // how far back to look for the last game day
const CACHE_MS = 10 * 60 * 1000;

type CatKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tp';

interface CatDef {
  key: CatKey;
  hero: HeroKey;   // which stat pill becomes the big highlighted one
  min: number;     // the game must be at least this big to count at all
  pad: number;     // softens the comparison for players whose average is near zero
  fallback: number; // "normal" for a player we have no averages for (a typical bench player)
}

const CATS: CatDef[] = [
  { key: 'pts', hero: 'pts',  min: 20, pad: 4,   fallback: 5 },
  { key: 'reb', hero: 'reb',  min: 10, pad: 2,   fallback: 2 },
  { key: 'ast', hero: 'ast',  min: 8,  pad: 1.5, fallback: 1.2 },
  { key: 'stl', hero: 'stl',  min: 4,  pad: 0.7, fallback: 0.4 },
  { key: 'blk', hero: 'blk',  min: 4,  pad: 0.6, fallback: 0.3 },
  { key: 'tp',  hero: 'fg3m', min: 5,  pad: 0.8, fallback: 0.6 },
];

// ─── Small helpers ──────────────────────────────────────────────────────────

const toNum = (v: unknown): number => {
  const n = Number(String(v ?? '').replace('+', ''));
  return Number.isFinite(n) ? n : 0;
};
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, any> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {};

function etDate(offsetDays: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offsetDays * DAY))
    .replace(/-/g, '');
}

function dateLabel(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

// ─── Players' normal numbers (season averages) ──────────────────────────────

interface Avg { gp?: number; pts?: number; reb?: number; ast?: number; stl?: number; blk?: number; tp?: number }

// ESPN names a season by the year it ends in (2025-26 is 2026).
function averagesSeasonEnd(now = new Date()): number {
  const y = now.getFullYear();
  if (now.getMonth() >= 9) {
    // October to December: the new season has just started.
    return now < new Date(y, SWITCH_MONTH, SWITCH_DAY) ? y : y + 1;
  }
  return y;
}

function pickAvg(names: string[], values: unknown[]): Avg {
  const out: Avg = {};
  names.forEach((raw, i) => {
    const n = String(raw);
    const l = n.toLowerCase();
    const v = values[i];
    if (v === undefined || v === null || v === '') return;
    const num = Number(v);
    if (!Number.isFinite(num)) return;
    if (n === 'gamesPlayed') out.gp = num;
    else if (n === 'avgPoints') out.pts = num;
    else if (n === 'avgRebounds' || n === 'avgTotalRebounds') out.reb = num;
    else if (n === 'avgAssists') out.ast = num;
    else if (n === 'avgSteals') out.stl = num;
    else if (n === 'avgBlocks') out.blk = num;
    else if (l.startsWith('avg') && l.includes('threepoint') && l.endsWith('made')) out.tp = num;
  });
  return out;
}

async function fetchAvgPage(base: string, page: number, out: Map<number, Avg>): Promise<number> {
  const res = await fetch(`${base}&page=${page}`);
  if (!res.ok) throw new Error(`ESPN averages error ${res.status}`);
  const data = obj(await res.json());
  const top = list(data.categories).map(obj);
  for (const entry of list(data.athletes).map(obj)) {
    const id = Number(obj(entry.athlete).id);
    if (!id) continue;
    const merged: Avg = {};
    list(entry.categories).map(obj).forEach((cat, ci) => {
      const names = list(cat.names).length ? list(cat.names) : list(top[ci]?.names);
      Object.assign(merged, pickAvg(names, list(cat.values)));
    });
    if (merged.pts !== undefined) out.set(id, merged);
  }
  return Number(obj(data.pagination).pages) || 0;
}

async function fetchSeasonAverages(endYear: number): Promise<Map<number, Avg>> {
  const sort = encodeURIComponent('offensive.avgPoints:desc');
  const base =
    `${ESPN_STATS}/statistics/byathlete?region=us&lang=en&contentorigin=espn` +
    `&isqualified=false&limit=200&sort=${sort}&season=${endYear}&seasontype=2`;
  const out = new Map<number, Avg>();
  const pages = await fetchAvgPage(base, 1, out);
  if (pages > 1) {
    const rest: number[] = [];
    for (let p = 2; p <= Math.min(pages, 10); p++) rest.push(p);
    await Promise.all(rest.map(p => fetchAvgPage(base, p, out).catch(() => 0)));
  }
  return out;
}

let avgPromise: Promise<Map<number, Avg> | null> | null = null;

function getAverages(): Promise<Map<number, Avg> | null> {
  if (!avgPromise) {
    avgPromise = (async () => {
      const wanted = averagesSeasonEnd();
      for (const yr of [wanted, wanted - 1]) {
        try {
          const m = await fetchSeasonAverages(yr);
          if (m.size >= 100) return m;
        } catch { /* try the other season */ }
      }
      return null;
    })().then(r => { if (!r) avgPromise = null; return r; });
  }
  return avgPromise;
}

// ─── Finding the last game night and its box scores ─────────────────────────

interface Candidate {
  player: Player;
  stats: GameStats;
  minutes: number;
}

interface Night {
  label: string;
  candidates: Candidate[];
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN error ${res.status}`);
  return res.json();
}

// The most recent day whose games are all finished (a day still in progress is skipped).
async function findLastGameDay(): Promise<{ date: string; events: any[] } | null> {
  for (let off = 0; off >= -LOOK_BACK_DAYS; off--) {
    const date = etDate(off);
    const json = await fetchJson(`${ESPN_SITE}/scoreboard?dates=${date}`);
    const events: any[] = list(json?.events);
    if (!events.length) continue;
    const now = Date.now();
    const state = (e: any) => e?.status?.type?.state;
    const live = events.some(e => state(e) === 'in');
    const upcoming = events.some(e => state(e) === 'pre' && (Date.parse(e?.date ?? '') || 0) > now);
    const finals = events.filter(e => state(e) === 'post' && e?.status?.type?.completed !== false);
    if (live || upcoming || finals.length === 0) continue;
    return { date, events: finals };
  }
  return null;
}

async function fetchGame(ev: any): Promise<Candidate[]> {
  const json = await fetchJson(`${ESPN_SITE}/summary?event=${ev.id}`);
  const comps: any[] = list(ev?.competitions?.[0]?.competitors);
  const out: Candidate[] = [];

  for (const group of list(json?.boxscore?.players)) {
    const espnTeamId = Number(group?.team?.id);
    const team = getTeamByEspnId(espnTeamId);
    const me = comps.find(c => Number(c?.id) === espnTeamId);
    const other = comps.find(c => c !== me);
    const cat = group?.statistics?.[0];
    if (!team || !me || !other || !cat) continue;

    const labels: string[] = list(cat.labels).map(String);
    const at = (k: string) => labels.indexOf(k);
    const isHome = me.homeAway === 'home';
    const teamScore = toNum(me.score);
    const opponentScore = toNum(other.score);
    const oppAbbr = String(other?.team?.abbreviation ?? '');

    for (const a of list(cat.athletes)) {
      if (a?.didNotPlay) continue;
      const stats: unknown[] = list(a?.stats);
      const val = (k: string) => (at(k) >= 0 ? stats[at(k)] : undefined);
      const minutes = toNum(val('MIN'));
      if (!(minutes > 0)) continue;
      const pair = (k: string): [number, number] => {
        const s = String(val(k) ?? '');
        const [m, att] = s.split('-');
        return [toNum(m), toNum(att)];
      };
      const [fgm, fga] = pair('FG');
      const [fg3m, fg3a] = pair('3PT');
      const [ftm, fta] = pair('FT');

      const ath = obj(a?.athlete);
      const id = Number(ath.id);
      if (!id) continue;
      const display = String(ath.displayName ?? '').trim();
      const space = display.indexOf(' ');
      const first = String(ath.firstName ?? (space > 0 ? display.slice(0, space) : display));
      const last = String(ath.lastName ?? (space > 0 ? display.slice(space + 1) : ''));

      const stat: GameStats = {
        playerId: id,
        playerName: display || `${first} ${last}`.trim(),
        teamId: team.id,
        teamAbbr: team.abbreviation,
        gameId: String(ev.id),
        gameDate: String(ev?.date ?? ''),
        matchup: `${team.abbreviation} ${isHome ? 'vs' : '@'} ${oppAbbr}`,
        isHome,
        outcome: teamScore > opponentScore ? 'W' : 'L',
        minutes: String(Math.round(minutes)),
        pts: toNum(val('PTS')),
        reb: toNum(val('REB')),
        ast: toNum(val('AST')),
        stl: toNum(val('STL')),
        blk: toNum(val('BLK')),
        turnover: toNum(val('TO')),
        fgm, fga, fg_pct: fga > 0 ? fgm / fga : 0,
        fg3m, fg3a, fg3_pct: fg3a > 0 ? fg3m / fg3a : 0,
        ftm, fta, ft_pct: fta > 0 ? ftm / fta : 0,
        plus_minus: toNum(val('+/-')),
        opponentAbbr: oppAbbr,
        teamScore,
        opponentScore,
      };

      out.push({
        minutes,
        stats: stat,
        player: {
          id,
          first_name: first,
          last_name: last,
          position: String(ath?.position?.abbreviation ?? ''),
          jersey_number: String(ath?.jersey ?? ''),
          team,
        },
      });
    }
  }
  return out;
}

async function buildNight(): Promise<Night | null> {
  const day = await findLastGameDay();
  if (!day) return null;
  const results = await Promise.all(day.events.map(ev => fetchGame(ev).catch(() => null)));
  if (results.every(r => r === null)) throw new Error('No box scores could be loaded');
  return { label: dateLabel(day.date), candidates: results.flatMap(r => r ?? []) };
}

let nightCache: { at: number; promise: Promise<Night | null> } | null = null;

function getNight(): Promise<Night | null> {
  if (!nightCache || Date.now() - nightCache.at > CACHE_MS) {
    const promise = buildNight();
    nightCache = { at: Date.now(), promise };
    promise.catch(() => { if (nightCache?.promise === promise) nightCache = null; });
  }
  return nightCache.promise;
}

// ─── The surprise score ─────────────────────────────────────────────────────

export interface SmartPick {
  player: Player;
  stats: GameStats;
  heroKey: HeroKey;
  score: number;
}

function valueOf(stats: GameStats, key: CatKey): number {
  return key === 'tp' ? stats.fg3m : stats[key];
}

// The player's "normal" for one stat. Players with very few games are pulled
// toward a typical bench player, so 2 games of data can't fool us.
function normal(avg: Avg | undefined, cat: CatDef): number {
  const a = avg?.[cat.key];
  if (a === undefined) return cat.fallback;
  const gp = avg?.gp;
  if (gp !== undefined && gp < 10) return (a * gp + cat.fallback * (10 - gp)) / 10;
  return a;
}

function pickStandouts(night: Night, avgs: Map<number, Avg>, exclude: Set<number>): SmartPick[] {
  const scored: SmartPick[] = [];
  for (const c of night.candidates) {
    if (exclude.has(c.player.id) || c.minutes < MIN_MINUTES) continue;
    const avg = avgs.get(c.player.id);
    let best: { cat: CatDef; score: number } | null = null;
    for (const cat of CATS) {
      const v = valueOf(c.stats, cat.key);
      if (v < cat.min) continue;
      const score = v / (normal(avg, cat) + cat.pad);
      if (!best || score > best.score) best = { cat, score };
    }
    if (best) scored.push({ player: c.player, stats: c.stats, heroKey: best.cat.hero, score: best.score });
  }
  scored.sort((a, b) => b.score - a.score);

  const usedTeams = new Set<number>();
  const picks: SmartPick[] = [];
  for (const s of scored) {
    if (usedTeams.has(s.player.team.id)) continue; // one player per team
    usedTeams.add(s.player.team.id);
    picks.push(s);
    if (picks.length >= MAX_TILES) break;
  }
  return picks;
}

export type SmartResult =
  | { status: 'ok'; dateLabel: string; picks: SmartPick[] }
  | { status: 'none'; dateLabel: string }
  | { status: 'error' };

export async function loadSmartStats(excludeIds: Set<number>): Promise<SmartResult> {
  try {
    const [night, avgs] = await Promise.all([getNight(), getAverages()]);
    if (!night) return { status: 'none', dateLabel: '' };
    if (!avgs) return { status: 'error' };
    const picks = pickStandouts(night, avgs, excludeIds);
    if (picks.length === 0) return { status: 'none', dateLabel: night.label };
    return { status: 'ok', dateLabel: night.label, picks };
  } catch {
    return { status: 'error' };
  }
}
