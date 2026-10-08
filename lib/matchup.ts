// Head-to-head matchup helpers.
// Everything runs in the visitor's browser (ESPN blocks Netlify's servers but
// answers normal browsers). Nothing here is saved on a server.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { getTeamByEspnId } from './nba';
import { normalizeName, type InjuryEntry, type InjuryIndex } from './fantasy';
import type { WatchlistPlayer } from './storage';

const DAY = 24 * 60 * 60 * 1000;
const ET = 'America/New_York';
const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const BASE_LABELS = ['MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS'];

// ─── Stat lines ──────────────────────────────────────────────────────────────

export interface Line {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tp: number; // three-pointers made
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  to: number; // turnovers
}

export const LINE_KEYS: (keyof Line)[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'tp', 'fgm', 'fga', 'ftm', 'fta', 'to'];

export function emptyLine(): Line {
  return { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tp: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, to: 0 };
}

function addInto(target: Line, add: Line) {
  for (const k of LINE_KEYS) target[k] += add[k];
}

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace('+', ''));
  return Number.isFinite(n) ? n : 0;
}

function pair(v: unknown): [number, number] {
  const s = String(v ?? '');
  if (s.includes('-')) {
    const [m, a] = s.split('-');
    return [toNum(m), toNum(a)];
  }
  return [toNum(s), 0];
}

// Turns one row of ESPN numbers (game log row or box score row) into a Line.
// Returns null when the player did not play.
function rowToLine(labels: string[], stats: unknown[]): Line | null {
  const at = (k: string) => labels.indexOf(k);
  const iPts = at('PTS');
  if (iPts < 0 || !Array.isArray(stats)) return null;
  if (toNum(stats[at('MIN')]) <= 0) return null;
  const [fgm, fga] = pair(stats[at('FG')]);
  const [tp] = pair(stats[at('3PT')]);
  const [ftm, fta] = pair(stats[at('FT')]);
  return {
    pts: toNum(stats[iPts]),
    reb: at('REB') >= 0 ? toNum(stats[at('REB')]) : 0,
    ast: at('AST') >= 0 ? toNum(stats[at('AST')]) : 0,
    stl: at('STL') >= 0 ? toNum(stats[at('STL')]) : 0,
    blk: at('BLK') >= 0 ? toNum(stats[at('BLK')]) : 0,
    tp,
    fgm,
    fga,
    ftm,
    fta,
    to: at('TO') >= 0 ? toNum(stats[at('TO')]) : 0,
  };
}

// ─── Game log → per-player summary ───────────────────────────────────────────

export interface GameRow {
  id: string;
  time: number;
  line: Line;
  opp?: string; // opponent abbreviation
  away?: boolean;
  type?: 'regular' | 'preseason';
}

export interface PlayerGames {
  basis: 'regular' | 'preseason' | null;
  gamesPlayed: number;
  avg: Line | null; // per-game averages
  recent: GameRow[]; // games in the last two weeks, newest first
  last: GameRow | null; // most recent game played
}

function collectRows(json: any, wantRegular: boolean): GameRow[] {
  const labels: string[] = Array.isArray(json?.labels) && json.labels.length ? json.labels : BASE_LABELS;
  const meta: Record<string, any> = json?.events ?? {};
  const rows: GameRow[] = [];
  const seen = new Set<string>();
  for (const st of json?.seasonTypes ?? []) {
    const name = String(st?.displayName ?? '').toLowerCase();
    const isRegular = name.includes('regular');
    if (wantRegular !== isRegular) continue;
    if (!wantRegular && (name.includes('playoff') || name.includes('postseason'))) continue;
    for (const cat of st?.categories ?? []) {
      for (const ev of cat?.events ?? []) {
        const id = String(ev?.eventId ?? '');
        if (!id || seen.has(id)) continue;
        const line = rowToLine(labels, ev?.stats);
        if (!line) continue;
        seen.add(id);
        const time = new Date(meta[id]?.gameDate ?? '').getTime();
        rows.push({
          id,
          time: Number.isFinite(time) ? time : 0,
          line,
          opp: meta[id]?.opponent?.abbreviation ? String(meta[id].opponent.abbreviation) : undefined,
          away: String(meta[id]?.atVs ?? '').trim() === '@',
          type: wantRegular ? 'regular' : 'preseason',
        });
      }
    }
  }
  return rows;
}

export function summarizeGames(json: unknown, now = Date.now()): PlayerGames {
  let basis: PlayerGames['basis'] = 'regular';
  let rows = collectRows(json, true);
  if (rows.length === 0) {
    rows = collectRows(json, false);
    basis = rows.length ? 'preseason' : null;
  }
  if (rows.length === 0) return { basis: null, gamesPlayed: 0, avg: null, recent: [], last: null };

  const sum = emptyLine();
  for (const r of rows) addInto(sum, r.line);
  const avg = emptyLine();
  for (const k of LINE_KEYS) avg[k] = sum[k] / rows.length;

  const sorted = rows.filter(r => r.time > 0).sort((a, b) => b.time - a.time);
  return {
    basis,
    gamesPlayed: rows.length,
    avg,
    recent: sorted.filter(r => now - r.time < 15 * DAY),
    last: sorted[0] ?? null,
  };
}

// ─── The fantasy week (Monday to Sunday, US Eastern time) ───────────────────

const WEEKDAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function weekKey(ts: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(new Date(ts));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const monday = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))) -
    (WEEKDAY_INDEX[get('weekday')] ?? 0) * DAY;
  return new Date(monday).toISOString().slice(0, 10);
}

export function weekLabel(ts = Date.now()): string {
  const monday = Date.parse(`${weekKey(ts)}T00:00:00Z`);
  const fmt = (t: number) =>
    new Date(t).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(monday + 6 * DAY)}`;
}

// ─── Today's games (live / upcoming / final) ─────────────────────────────────

export interface TeamGame {
  eventId: string;
  state: 'pre' | 'in' | 'post';
  detail: string; // e.g. "Q3 6:42" while live
  start: number;
  opp: string;
}

function etDateParam(offsetDays: number): string {
  const t = Date.now() + offsetDays * DAY;
  return new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(t))
    .replace(/-/g, '');
}

function liveDetail(ev: any): string {
  if (ev?.status?.type?.name === 'STATUS_HALFTIME') return 'Halftime';
  const p = Number(ev?.status?.period ?? 0);
  const quarter = p > 4 ? (p > 5 ? `OT${p - 4}` : 'OT') : `Q${p || 1}`;
  return `${quarter} ${ev?.status?.displayClock ?? ''}`.trim();
}

// Map of our team id -> the most relevant game for that team right now.
export async function fetchTeamGames(): Promise<Map<number, TeamGame> | null> {
  const results = await Promise.all(
    [-1, 0].map(d =>
      fetch(`${ESPN_SITE}/scoreboard?dates=${etDateParam(d)}`, { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );
  if (results.every(r => r === null)) return null;

  const rank = { in: 3, pre: 2, post: 1 } as const;
  const map = new Map<number, TeamGame>();
  for (const json of results) {
    for (const ev of json?.events ?? []) {
      const rawState = ev?.status?.type?.state;
      if (rawState !== 'pre' && rawState !== 'in' && rawState !== 'post') continue;
      const state: TeamGame['state'] = rawState;
      const comps: any[] = ev?.competitions?.[0]?.competitors ?? [];
      const start = Date.parse(ev?.date ?? '') || 0;
      for (const c of comps) {
        const team = getTeamByEspnId(Number(c?.id));
        if (!team) continue;
        const other = comps.find(x => x !== c);
        const entry: TeamGame = {
          eventId: String(ev.id),
          state,
          detail: state === 'in' ? liveDetail(ev) : '',
          start,
          opp: String(other?.team?.abbreviation ?? ''),
        };
        const prev = map.get(team.id);
        const better =
          !prev ||
          rank[state] > rank[prev.state] ||
          (rank[state] === rank[prev.state] &&
            ((state === 'pre' && start < prev.start) || (state === 'post' && start > prev.start)));
        if (better) map.set(team.id, entry);
      }
    }
  }
  return map;
}

// Box score numbers for games in progress: ESPN player id -> stat line so far.
export async function fetchLiveLines(eventIds: string[]): Promise<Map<number, Line>> {
  const out = new Map<number, Line>();
  await Promise.all(
    eventIds.map(async id => {
      try {
        const res = await fetch(`${ESPN_SITE}/summary?event=${id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        for (const group of json?.boxscore?.players ?? []) {
          const cat = group?.statistics?.[0];
          if (!cat) continue;
          const labels: string[] = cat.labels ?? [];
          for (const a of cat.athletes ?? []) {
            if (a?.didNotPlay) continue;
            const pid = Number(a?.athlete?.id);
            const line = pid ? rowToLine(labels, a?.stats) : null;
            if (line) out.set(pid, line);
          }
        }
      } catch {
        // one game failing should not break the rest
      }
    })
  );
  return out;
}

// ─── Putting a player's numbers together ─────────────────────────────────────

export interface GameInfo {
  time: number;
  opp: string;
  away: boolean;
  type: 'regular' | 'preseason';
}

// True when a game was played before the current NBA season began (it starts
// being counted again from September 1st).
export function isPastSeason(time: number, now = Date.now()): boolean {
  const d = new Date(now);
  const startYear = d.getUTCMonth() >= 8 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return time > 0 && time < Date.UTC(startYear, 8, 1);
}

export function gameDateLabel(time: number): string {
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: ET });
}

export interface PlayerMatch {
  weekLine: Line; // this week's totals so far (live game included)
  weekGames: number;
  avg: Line | null; // season per-game averages
  shown: Line | null; // the stat line shown on the row (live, else last game)
  isLive: boolean;
  lastInfo: GameInfo | null; // which game the shown line is from (when not live)
}

export function buildMatch(
  games: PlayerGames | undefined,
  live: Line | undefined,
  liveEventId: string | undefined,
  currentWeek: string
): PlayerMatch {
  const weekLine = emptyLine();
  let weekGames = 0;
  for (const r of games?.recent ?? []) {
    if (weekKey(r.time) !== currentWeek) continue;
    if (liveEventId && r.id === liveEventId) continue; // the live box score replaces it
    addInto(weekLine, r.line);
    weekGames++;
  }
  if (live) {
    addInto(weekLine, live);
    weekGames++;
  }
  return {
    weekLine,
    weekGames,
    avg: games?.avg ?? null,
    shown: live ?? games?.last?.line ?? null,
    isLive: !!live,
    lastInfo:
      !live && games?.last
        ? {
            time: games.last.time,
            opp: games.last.opp ?? '',
            away: !!games.last.away,
            type: games.last.type ?? 'regular',
          }
        : null,
  };
}

export function injuryFor(idx: InjuryIndex | null, p: WatchlistPlayer): InjuryEntry | null {
  if (!idx) return null;
  const hit = idx.byId.get(String(p.id)) ?? idx.byName.get(normalizeName(`${p.first_name} ${p.last_name}`));
  return hit ?? { status: 'healthy', note: '' };
}

// ─── The 9 standard categories ──────────────────────────────────────────────

export type CatKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tp' | 'fg' | 'ft' | 'to';

export interface CatDef {
  key: CatKey;
  label: string;
  pct?: boolean;
  lowerWins?: boolean;
}

export const CATS_9: CatDef[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'stl', label: 'Steals' },
  { key: 'blk', label: 'Blocks' },
  { key: 'tp', label: 'Threes made' },
  { key: 'fg', label: 'FG%', pct: true },
  { key: 'ft', label: 'FT%', pct: true },
  { key: 'to', label: 'Turnovers', lowerWins: true },
];

export type Totals = Record<CatKey, number>;

// Percentages come from total shots made and attempted, not an average of
// each player's percentage.
export function totalsFromLines(lines: Line[]): Totals {
  const s = emptyLine();
  for (const l of lines) addInto(s, l);
  return {
    pts: s.pts,
    reb: s.reb,
    ast: s.ast,
    stl: s.stl,
    blk: s.blk,
    tp: s.tp,
    fg: s.fga > 0 ? (100 * s.fgm) / s.fga : 0,
    ft: s.fta > 0 ? (100 * s.ftm) / s.fta : 0,
    to: s.to,
  };
}

export function fmtCat(v: number, cat: CatDef, week: boolean): string {
  if (cat.pct) return `${v.toFixed(1)}%`;
  return week ? String(Math.round(v)) : v.toFixed(1);
}

// 1 = left side wins, -1 = right side wins, 0 = tie. A tie means both sides
// show the same number on screen.
export function compareCat(a: number, b: number, cat: CatDef, week: boolean): 1 | -1 | 0 {
  if (fmtCat(a, cat, week) === fmtCat(b, cat, week)) return 0;
  if (cat.lowerWins) return a < b ? 1 : -1;
  return a > b ? 1 : -1;
}
