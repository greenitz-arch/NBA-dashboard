// Fantasy mode helpers.
// Everything here runs in the visitor's browser (ESPN blocks Netlify's servers,
// but answers normal browsers). Nothing here is saved on a server.

export type InjuryStatus = 'healthy' | 'questionable' | 'out';
export type Form = 'hot' | 'cold' | 'steady';

export interface StatLine {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tp: number; // three-pointers made
}

export interface PlayerFantasy {
  status: InjuryStatus | null; // null = injury list could not be loaded
  statusNote: string;
  games: number;
  basis: 'regular' | 'preseason' | null;
  avg: StatLine | null;
  last7: StatLine | null;
  last7Games: number;
  value: number | null;
  form: Form | null;
}

const BASE_LABELS = ['MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS'];

// A "typical" fantasy-relevant starter, per game. Players are rated against
// this yardstick (50 = right on it). It is a simplified version of what the
// big fantasy sites do, not an exact copy.
export const YARDSTICK: Record<keyof StatLine, number> = {
  pts: 18,
  reb: 6.5,
  ast: 4.5,
  stl: 1.1,
  blk: 0.7,
  tp: 2,
};

export const CATEGORIES: { key: keyof StatLine; label: string }[] = [
  { key: 'pts', label: 'Points' },
  { key: 'reb', label: 'Rebounds' },
  { key: 'ast', label: 'Assists' },
  { key: 'stl', label: 'Steals' },
  { key: 'blk', label: 'Blocks' },
  { key: 'tp', label: 'Threes' },
];

const DAY = 24 * 60 * 60 * 1000;
const MIN_GAMES_FOR_FORM = 5;
const MIN_RECENT_GAMES = 2;
const FORM_THRESHOLD = 0.1; // 10% above/below season points average

interface GameRow {
  time: number;
  line: StatLine;
}

function toNum(v: unknown): number {
  const n = Number(String(v ?? '').replace('+', ''));
  return Number.isFinite(n) ? n : 0;
}

function madeFromPair(v: unknown): number {
  const s = String(v ?? '');
  if (s.includes('-')) return toNum(s.split('-')[0]);
  return toNum(s);
}

function averageOf(rows: GameRow[]): StatLine | null {
  if (rows.length === 0) return null;
  const sum: StatLine = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tp: 0 };
  for (const r of rows) {
    sum.pts += r.line.pts;
    sum.reb += r.line.reb;
    sum.ast += r.line.ast;
    sum.stl += r.line.stl;
    sum.blk += r.line.blk;
    sum.tp += r.line.tp;
  }
  const n = rows.length;
  return {
    pts: sum.pts / n,
    reb: sum.reb / n,
    ast: sum.ast / n,
    stl: sum.stl / n,
    blk: sum.blk / n,
    tp: sum.tp / n,
  };
}

// Turns ESPN's game-log answer into a list of games with the stats we use.
// Written defensively: if ESPN changes its layout, we return nothing rather
// than crash.
/* eslint-disable @typescript-eslint/no-explicit-any */
function collectGames(json: any, wantRegular: boolean): GameRow[] {
  const labels: string[] = Array.isArray(json?.labels) && json.labels.length ? json.labels : BASE_LABELS;
  const idx = (k: string) => labels.indexOf(k);
  const iPts = idx('PTS'), iReb = idx('REB'), iAst = idx('AST'), iStl = idx('STL'), iBlk = idx('BLK'), i3 = idx('3PT');
  if (iPts < 0) return [];

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
        const stats: unknown[] = ev?.stats;
        if (!id || !Array.isArray(stats) || seen.has(id)) continue;
        seen.add(id);
        const minutes = toNum(stats[labels.indexOf('MIN')]);
        if (minutes <= 0) continue; // did not play
        const time = new Date(meta[id]?.gameDate ?? '').getTime();
        rows.push({
          time: Number.isFinite(time) ? time : 0,
          line: {
            pts: toNum(stats[iPts]),
            reb: iReb >= 0 ? toNum(stats[iReb]) : 0,
            ast: iAst >= 0 ? toNum(stats[iAst]) : 0,
            stl: iStl >= 0 ? toNum(stats[iStl]) : 0,
            blk: iBlk >= 0 ? toNum(stats[iBlk]) : 0,
            tp: i3 >= 0 ? madeFromPair(stats[i3]) : 0,
          },
        });
      }
    }
  }
  return rows;
}

export function valueScore(avg: StatLine): number {
  let total = 0;
  for (const c of CATEGORIES) total += avg[c.key] / YARDSTICK[c.key];
  const mean = total / CATEGORIES.length;
  return Math.max(0, Math.min(99, Math.round(50 + 100 * (mean - 1))));
}

export interface GamelogSummary {
  games: number;
  basis: 'regular' | 'preseason' | null;
  avg: StatLine | null;
  last7: StatLine | null;
  last7Games: number;
  value: number | null;
  form: Form | null;
}

export function summarizeGamelog(json: unknown, now = Date.now()): GamelogSummary {
  let basis: 'regular' | 'preseason' | null = 'regular';
  let rows = collectGames(json, true);
  if (rows.length === 0) {
    rows = collectGames(json, false);
    basis = rows.length ? 'preseason' : null;
  }
  if (rows.length === 0) {
    return { games: 0, basis: null, avg: null, last7: null, last7Games: 0, value: null, form: null };
  }
  const avg = averageOf(rows);
  const recent = rows.filter(r => r.time > 0 && now - r.time <= 7 * DAY && r.time <= now + DAY);
  const last7 = recent.length >= MIN_RECENT_GAMES ? averageOf(recent) : null;

  let form: Form | null = null;
  if (avg && last7 && rows.length >= MIN_GAMES_FOR_FORM && avg.pts > 0) {
    const diff = last7.pts / avg.pts - 1;
    form = diff > FORM_THRESHOLD ? 'hot' : diff < -FORM_THRESHOLD ? 'cold' : 'steady';
  }
  return {
    games: rows.length,
    basis,
    avg,
    last7,
    last7Games: recent.length,
    value: avg ? valueScore(avg) : null,
    form,
  };
}

export interface InjuryEntry {
  status: InjuryStatus;
  note: string;
}

export interface InjuryIndex {
  byId: Map<string, InjuryEntry>;
  byName: Map<string, InjuryEntry>;
}

export function normalizeName(n: string): string {
  return n
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapStatus(raw: string): InjuryStatus {
  const s = raw.toLowerCase();
  if (s.includes('out')) return 'out';
  if (s.includes('suspend')) return 'out';
  return 'questionable'; // day-to-day, questionable, doubtful, probable...
}

export function parseInjuries(json: any): InjuryIndex {
  const byId = new Map<string, InjuryEntry>();
  const byName = new Map<string, InjuryEntry>();
  for (const group of json?.injuries ?? []) {
    for (const item of group?.injuries ?? []) {
      const raw = String(item?.status ?? item?.type?.description ?? item?.type?.name ?? '');
      if (!raw) continue;
      const entry: InjuryEntry = {
        status: mapStatus(raw),
        note: String(item?.shortComment ?? item?.details?.detail ?? raw),
      };
      const id = item?.athlete?.id;
      if (id != null) byId.set(String(id), entry);
      const nm = item?.athlete?.displayName ?? item?.athlete?.fullName;
      if (nm) byName.set(normalizeName(String(nm)), entry);
    }
  }
  return { byId, byName };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface StrengthScore {
  key: keyof StatLine;
  label: string;
  score: number; // 0-100, 50 = typical
}

// How strong the whole roster is in each category. Injured (Out) players are
// left out of the totals, but still count in the headcount, so an injury
// lowers the bars.
export function teamStrengths(entries: PlayerFantasy[]): StrengthScore[] | null {
  const withData = entries.filter(e => e.avg);
  if (withData.length === 0) return null;
  return CATEGORIES.map(c => {
    let total = 0;
    for (const e of withData) {
      if (e.status === 'out') continue;
      total += e.avg![c.key];
    }
    const score = Math.round((total / (withData.length * YARDSTICK[c.key])) * 50);
    return { key: c.key, label: c.label, score: Math.max(0, Math.min(100, score)) };
  });
}

export const STATUS_LABEL: Record<InjuryStatus, string> = {
  healthy: 'Healthy',
  questionable: 'Questionable',
  out: 'Out',
};

export const STATUS_COLOR: Record<InjuryStatus, string> = {
  healthy: '#3fbf7f',
  questionable: '#f0b429',
  out: '#e5484d',
};
