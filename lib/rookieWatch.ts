// lib/rookieWatch.ts
// The brains of Rookie Watch.
//
// 1) Finds this season's rookies from the 30 ESPN team rosters.
// 2) Reads each rookie's ESPN game log (the same source the player cards use).
// 3) Scores every game with Game Score and builds the two boards:
//      - "Last Night": the rookies from the most recent game night, best Game Score first
//      - "Top 15":     the season Rookie Rating, which also counts the games a rookie missed
//
// Everything runs in the visitor's browser (ESPN refuses the app's server).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { get as idbGet, set as idbSet } from 'idb-keyval';
import { NBA_TEAMS, type Team } from './nba';
import { fetchGamelog, currentSeasonYear } from './gamelog';

// ─── The knobs (all in one place) ─────────────────────────────────────────────

export const TOP_N = 15;                    // tiles on each board
export const MIN_MINUTES_LAST_NIGHT = 10;   // Last Night: a rookie must play at least this long
export const WARMUP_GAMES = 3;              // Top 15: every rookie starts with 3 "warm-up" games...
export const WARMUP_SCORE = 5;              // ...each worth a typical-rookie Game Score of 5.0
const CACHE_TTL_MS = 30 * 60 * 1000;        // the finished boards are reused for 30 minutes
const ROSTER_TTL_MS = 24 * 60 * 60 * 1000;  // the list of rookies is re-read once a day
const CACHE_KEY = 'courtside_rookie_watch_v1';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// Wording for this feature (kept here so no existing file has to change).
export const ROOKIE_MSG = {
  loading: 'Scouting the rookies',
  failed: "The rookie scouts aren't picking up. Check your connection and try again.",
  noRookies: "We couldn't find this season's rookies just yet. Try again in a moment.",
  quietNight: 'No rookie has played a regular-season game yet. Check back after the next game night.',
  tryAgain: 'Try again',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RookieGame {
  date: string;   // game night in New York time, e.g. "2026-10-22"
  opp: string;    // opponent abbreviation
  home: boolean;
  min: number;
  pts: number; reb: number; ast: number; stl: number; blk: number; tov: number;
  fgm: number; fga: number; ftm: number; fta: number; pf: number;
}

export interface Rookie {
  id: number;            // ESPN player id
  first: string;
  last: string;
  pos: string;
  espnTeamId: number;
  teamAbbr: string;
  games: RookieGame[];   // regular-season games he played
}

export interface RookieDataset {
  builtAt: number;
  rosterAt: number;
  season: number;
  rookies: Rookie[];
  teamGames: Record<number, number>; // finished regular-season games per ESPN team id (only where known)
}

export interface LastNightEntry { rookie: Rookie; game: RookieGame; gameScore: number }
export interface LastNightBoard { date: string | null; entries: LastNightEntry[] }

export interface TopEntry {
  rookie: Rookie;
  rating: number;      // the Rookie Rating
  avg: number;         // average Game Score in the games he played
  played: number;
  teamGames: number;
  lastGame: RookieGame;
}

export class RookieWatchError extends Error {
  kind: 'roster' | 'stats';
  constructor(kind: 'roster' | 'stats') {
    super(kind);
    this.kind = kind;
  }
}

// ─── The math ─────────────────────────────────────────────────────────────────

// Game Score (John Hollinger's formula). ESPN's game log does not split rebounds into
// offensive and defensive, so every rebound counts 0.5 (the middle of 0.7 and 0.3).
export function gameScore(g: RookieGame): number {
  return (
    g.pts +
    0.4 * g.fgm -
    0.7 * g.fga -
    0.4 * (g.fta - g.ftm) +
    0.5 * g.reb +
    g.stl +
    0.7 * g.ast +
    0.7 * g.blk -
    0.4 * g.pf -
    g.tov
  );
}

// Rookie Rating = (total Game Score + warm-up) / (team games + warm-up games).
// A game he missed counts as zero, and the warm-up keeps one great night from topping the list.
export function rookieRating(totalGameScore: number, teamGames: number): number {
  return (totalGameScore + WARMUP_GAMES * WARMUP_SCORE) / (teamGames + WARMUP_GAMES);
}

// ─── Boards ───────────────────────────────────────────────────────────────────

export function buildLastNight(ds: RookieDataset): LastNightBoard {
  const byDate = new Map<string, LastNightEntry[]>();
  for (const r of ds.rookies) {
    for (const g of r.games) {
      if (g.min < MIN_MINUTES_LAST_NIGHT) continue;
      const list = byDate.get(g.date) ?? [];
      list.push({ rookie: r, game: g, gameScore: gameScore(g) });
      byDate.set(g.date, list);
    }
  }
  // The newest game night that has at least one rookie with enough minutes.
  const dates = Array.from(byDate.keys()).sort().reverse();
  if (dates.length === 0) return { date: null, entries: [] };
  const date = dates[0];
  const entries = (byDate.get(date) ?? [])
    .sort((a, b) =>
      b.gameScore - a.gameScore ||
      b.game.pts - a.game.pts ||
      a.rookie.last.localeCompare(b.rookie.last))
    .slice(0, TOP_N);
  return { date, entries };
}

export function buildTop15(ds: RookieDataset): TopEntry[] {
  // Where ESPN did not tell us a team's game count, use the most games any of its rookies played.
  const fallback: Record<number, number> = {};
  for (const r of ds.rookies) {
    fallback[r.espnTeamId] = Math.max(fallback[r.espnTeamId] ?? 0, r.games.length);
  }

  const all: TopEntry[] = [];
  for (const r of ds.rookies) {
    if (r.games.length === 0) continue;
    const games = [...r.games].sort((a, b) => a.date.localeCompare(b.date));
    const total = games.reduce((s, g) => s + gameScore(g), 0);
    const played = games.length;
    const teamGames = Math.max(ds.teamGames[r.espnTeamId] ?? fallback[r.espnTeamId] ?? played, played);
    all.push({
      rookie: r,
      rating: rookieRating(total, teamGames),
      avg: total / played,
      played,
      teamGames,
      lastGame: games[games.length - 1],
    });
  }
  const totalPts = (e: TopEntry) => e.rookie.games.reduce((s, g) => s + g.pts, 0);
  return all
    .sort((a, b) =>
      b.rating - a.rating ||
      totalPts(b) - totalPts(a) ||
      a.rookie.last.localeCompare(b.rookie.last))
    .slice(0, TOP_N);
}

// ─── Reading ESPN ─────────────────────────────────────────────────────────────

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

const ET_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

function etDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : ET_DATE.format(d); // en-CA gives YYYY-MM-DD
}

const BASE_LABELS = ['MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS'];

// Every regular-season game a player played, from his ESPN game log.
// Preseason games are left out on purpose: they would distort the ratings.
export function parseRegularSeasonGames(json: any): RookieGame[] {
  const labels: string[] = Array.isArray(json?.labels) && json.labels.length ? json.labels : BASE_LABELS;
  const at = (k: string) => labels.indexOf(k);
  if (at('PTS') < 0 || at('MIN') < 0) return [];

  const meta: Record<string, any> = json?.events ?? {};
  const out: RookieGame[] = [];
  const seen = new Set<string>();

  for (const st of json?.seasonTypes ?? []) {
    const name = String(st?.displayName ?? st?.name ?? '');
    if (!/regular/i.test(name)) continue;
    for (const cat of st?.categories ?? []) {
      for (const ev of cat?.events ?? []) {
        const id = String(ev?.eventId ?? '');
        const stats = ev?.stats;
        if (!id || !Array.isArray(stats) || seen.has(id)) continue;
        seen.add(id);

        const min = toNum(stats[at('MIN')]);
        if (min <= 0) continue; // did not play

        const m = meta[id] ?? {};
        const date = etDate(String(m.gameDate ?? ''));
        if (!date) continue;
        const [fgm, fga] = pair(stats[at('FG')]);
        const [ftm, fta] = pair(stats[at('FT')]);
        out.push({
          date,
          opp: String(m.opponent?.abbreviation ?? ''),
          home: String(m.atVs ?? '').toLowerCase() === 'vs',
          min,
          pts: toNum(stats[at('PTS')]),
          reb: at('REB') >= 0 ? toNum(stats[at('REB')]) : 0,
          ast: at('AST') >= 0 ? toNum(stats[at('AST')]) : 0,
          stl: at('STL') >= 0 ? toNum(stats[at('STL')]) : 0,
          blk: at('BLK') >= 0 ? toNum(stats[at('BLK')]) : 0,
          tov: at('TO') >= 0 ? toNum(stats[at('TO')]) : 0,
          fgm, fga, ftm, fta,
          pf: at('PF') >= 0 ? toNum(stats[at('PF')]) : 0,
        });
      }
    }
  }
  return out;
}

// A rookie is a player in his first NBA season. ESPN lists his years of experience on the
// roster (0 = rookie); if that is missing, his draft year is the backup.
export function isRookie(a: any, season: number): boolean {
  const years = a?.experience?.years;
  if (typeof years === 'number') return years === 0;
  const draftYear = Number(a?.draft?.year);
  if (Number.isFinite(draftYear) && draftYear > 0) return draftYear === season - 1;
  return false;
}

function splitName(a: any): { first: string; last: string } {
  const full = String(a?.displayName ?? a?.fullName ?? '').trim();
  const first = String(a?.firstName ?? '').trim();
  const last = String(a?.lastName ?? '').trim();
  if (first && last) return { first, last };
  const parts = full.split(' ');
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

async function getJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchRookiesOfTeam(team: Team, season: number): Promise<{ rookies: Rookie[]; ok: boolean }> {
  const json = await getJson(`${ESPN}/teams/${team.espnId}/roster`);
  if (!json) return { rookies: [], ok: false };
  const list: any[] = Array.isArray(json.athletes) ? json.athletes : [];
  const rookies: Rookie[] = [];
  for (const a of list) {
    if (!isRookie(a, season)) continue;
    const id = Number(a?.id);
    if (!Number.isFinite(id)) continue;
    const { first, last } = splitName(a);
    rookies.push({
      id, first, last,
      pos: String(a?.position?.abbreviation ?? ''),
      espnTeamId: team.espnId,
      teamAbbr: team.abbreviation,
      games: [],
    });
  }
  return { rookies, ok: true };
}

// How many regular-season games a team has finished.
async function fetchTeamGames(team: Team): Promise<number | null> {
  const json = await getJson(`${ESPN}/teams/${team.espnId}/schedule?seasontype=2`);
  const events: any[] | undefined = json?.events;
  if (!Array.isArray(events)) return null;
  let done = 0;
  for (const e of events) {
    const status = e?.competitions?.[0]?.status?.type;
    if (status?.completed === true || status?.state === 'post') done++;
  }
  return done;
}

// Runs async jobs a few at a time so ESPN is not flooded.
async function runPool<T>(items: T[], size: number, job: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await job(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

// ─── Building and caching the dataset ─────────────────────────────────────────

const memory = new Map<string, unknown>();

async function readCache(): Promise<RookieDataset | null> {
  try {
    const v = (await idbGet(CACHE_KEY)) ?? memory.get(CACHE_KEY);
    return v && typeof v === 'object' ? (v as RookieDataset) : null;
  } catch {
    return (memory.get(CACHE_KEY) as RookieDataset | undefined) ?? null;
  }
}

async function writeCache(ds: RookieDataset): Promise<void> {
  memory.set(CACHE_KEY, ds);
  try { await idbSet(CACHE_KEY, ds); } catch { /* the in-memory copy still works */ }
}

export interface LoadOptions {
  force?: boolean;                                   // ignore the saved boards
  onProgress?: (done: number, total: number) => void;
}

async function buildDataset(prev: RookieDataset | null, season: number, onProgress?: LoadOptions['onProgress']): Promise<RookieDataset> {
  // Step 1: who are the rookies (reuse yesterday's list if it is less than a day old)
  let rookies: Rookie[];
  let rosterAt: number;
  if (prev && prev.season === season && Date.now() - prev.rosterAt < ROSTER_TTL_MS && prev.rookies.length > 0) {
    rookies = prev.rookies.map(r => ({ ...r, games: [] }));
    rosterAt = prev.rosterAt;
  } else {
    rookies = [];
    let okTeams = 0;
    await runPool(NBA_TEAMS, 10, async team => {
      const res = await fetchRookiesOfTeam(team, season);
      if (res.ok) okTeams++;
      rookies.push(...res.rookies);
    });
    if (okTeams < NBA_TEAMS.length / 2) throw new RookieWatchError('roster');
    if (rookies.length === 0) throw new RookieWatchError('roster');
    rosterAt = Date.now();
  }

  // Step 2: every rookie's game log, plus every team's finished-game count
  const teamGames: Record<number, number> = {};
  const total = rookies.length + NBA_TEAMS.length;
  let done = 0;
  let failedLogs = 0;
  onProgress?.(0, total);

  await runPool(rookies, 10, async r => {
    try {
      const res = await fetchGamelog(r.id, { cache: 'no-store' });
      if (res.status === 404) { /* no games yet */ }
      else if (!res.ok) failedLogs++;
      else r.games = parseRegularSeasonGames(await res.json());
    } catch {
      failedLogs++;
    }
    onProgress?.(++done, total);
  });
  if (failedLogs > rookies.length / 2) throw new RookieWatchError('stats');

  await runPool(NBA_TEAMS, 10, async team => {
    const n = await fetchTeamGames(team);
    if (n !== null) teamGames[team.espnId] = n;
    onProgress?.(++done, total);
  });

  return { builtAt: Date.now(), rosterAt, season, rookies, teamGames };
}

// The dataset: from the saved copy if it is fresh, otherwise freshly read from ESPN.
export async function loadRookieDataset(opts: LoadOptions = {}): Promise<{ dataset: RookieDataset; fromCache: boolean }> {
  const season = currentSeasonYear();
  const cached = await readCache();
  if (!opts.force && cached && cached.season === season && Date.now() - cached.builtAt < CACHE_TTL_MS) {
    return { dataset: cached, fromCache: true };
  }
  try {
    const dataset = await buildDataset(cached, season, opts.onProgress);
    await writeCache(dataset);
    return { dataset, fromCache: false };
  } catch (e) {
    // ESPN hiccup: an older saved copy from this season is better than an error screen.
    if (cached && cached.season === season && cached.rookies.length > 0) {
      return { dataset: cached, fromCache: true };
    }
    throw e;
  }
}

// ─── Small display helpers ────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-22" -> "Oct 22"
export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  const month = MONTHS[Number(m) - 1];
  return month ? `${month} ${Number(d)}` : date;
}

export function oneDecimal(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}
