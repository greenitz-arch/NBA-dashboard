// lib/minutes.ts
// Average minutes per game for NBA players, used by the "Add players" roster
// list (sorting, colour coding, and picking the 15 standard-contract players
// for "Add full roster").
//
// Data comes from ESPN, fetched straight from the visitor's browser (same
// reason as the roster fetch: ESPN blocks Netlify's servers, not browsers).
//   1) Preferred: ONE league-wide request that lists every player's averages.
//   2) Backup:    one small request per player on the roster being viewed.
// If both fail the roster list simply stays A-Z with no colours -- nothing breaks.

const ESPN_STATS = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';

export interface MinutesData {
  byId: Map<number, number>; // ESPN player id -> minutes per game
  seasonLabel: string;       // e.g. "2025-26"
}

// ── tiny safe-parsing helpers (ESPN's JSON shape is undocumented) ──────────
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

function seasonLabel(endYear: number): string {
  return `${endYear - 1}-${String(endYear).slice(2)}`;
}

// ── 1) league-wide request ─────────────────────────────────────────────────
async function fetchLeaguePage(base: string, page: number, out: Map<number, number>): Promise<{ pages: number; added: number }> {
  const res = await fetch(`${base}&page=${page}`);
  if (!res.ok) throw new Error(`ESPN stats error ${res.status}`);
  const data = obj(await res.json());

  // Where is "avgMinutes" in each player's list of numbers?
  let catIdx = -1;
  let nameIdx = -1;
  list(data.categories).map(obj).forEach((c, ci) => {
    const i = list(c.names).indexOf('avgMinutes');
    if (i >= 0 && catIdx < 0) { catIdx = ci; nameIdx = i; }
  });

  let added = 0;
  for (const entry of list(data.athletes).map(obj)) {
    const id = Number(obj(entry.athlete).id);
    const cats = list(entry.categories).map(obj);
    let cat: Record<string, unknown> | undefined = catIdx >= 0 ? cats[catIdx] : undefined;
    let ni = nameIdx;
    if (!cat) {
      for (const c of cats) {
        const i = list(c.names).indexOf('avgMinutes');
        if (i >= 0) { cat = c; ni = i; break; }
      }
    }
    if (!cat || ni < 0 || !id) continue;
    const m = num(list(cat.values)[ni] ?? list(cat.totals)[ni]);
    if (m !== null && m > 0) { out.set(id, m); added++; }
  }
  return { pages: Number(obj(data.pagination).pages) || 0, added };
}

async function fetchLeagueSeason(endYear: number): Promise<Map<number, number>> {
  const sort = encodeURIComponent('offensive.avgPoints:desc');
  const base =
    `${ESPN_STATS}/statistics/byathlete?region=us&lang=en&contentorigin=espn` +
    `&isqualified=false&limit=200&sort=${sort}&season=${endYear}&seasontype=2`;
  const out = new Map<number, number>();
  const first = await fetchLeaguePage(base, 1, out);
  if (first.pages > 1) {
    const rest: number[] = [];
    for (let p = 2; p <= Math.min(first.pages, 10); p++) rest.push(p);
    await Promise.all(rest.map(p => fetchLeaguePage(base, p, out).catch(() => null)));
  } else if (first.pages === 0 && first.added > 0) {
    // ESPN didn't say how many pages exist: keep going until a page comes back empty.
    for (let p = 2; p <= 12; p++) {
      const r = await fetchLeaguePage(base, p, out).catch(() => ({ pages: 0, added: 0 }));
      if (r.added === 0) break;
    }
  }
  return out;
}

let leaguePromise: Promise<MinutesData | null> | null = null;

// Cached for the rest of the visit, so the 30 teams share one download.
export function getLeagueMinutes(): Promise<MinutesData | null> {
  if (!leaguePromise) {
    leaguePromise = (async () => {
      const now = new Date();
      // ESPN names a season by the year it ends in. From October on, the new
      // season is "next year"; before it has games we use the previous one.
      const current = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
      for (const yr of [current, current - 1]) {
        try {
          const m = await fetchLeagueSeason(yr);
          if (m.size >= 100) return { byId: m, seasonLabel: seasonLabel(yr) };
        } catch { /* try the next season */ }
      }
      return null;
    })().then(r => { if (!r) leaguePromise = null; return r; }); // allow a retry after a failure
  }
  return leaguePromise;
}

// ── 2) backup: one request per player ──────────────────────────────────────
async function fetchPlayerMinutes(id: number): Promise<number | null> {
  try {
    const res = await fetch(`${ESPN_STATS}/athletes/${id}/stats`);
    if (!res.ok) return null;
    const data = obj(await res.json());
    for (const c of list(data.categories).map(obj)) {
      const i = list(c.labels).indexOf('MIN');
      if (i < 0) continue;
      const name = String(c.name ?? '').toLowerCase();
      if (name && !name.includes('average')) continue; // skip "totals" tables
      const seasons = list(c.statistics).map(obj).filter(s => obj(s.season).year);
      const v = num(list(obj(seasons[seasons.length - 1]).stats)[i]);
      if (v !== null && v > 0) return v;
    }
  } catch { /* ignore */ }
  return null;
}

export async function fetchRosterMinutes(ids: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const results = await Promise.all(ids.map(id => fetchPlayerMinutes(id)));
  ids.forEach((id, i) => { const v = results[i]; if (v !== null) out.set(id, v); });
  return out;
}

// ── colour scale: blue (few minutes) -> orange -> red (many minutes) ───────
const STOPS: Array<[number, [number, number, number]]> = [
  [10, [42, 120, 230]],
  [22, [255, 140, 40]],
  [32, [235, 40, 45]],
];

function rgbFor(m: number): [number, number, number] {
  if (m <= STOPS[0][0]) return STOPS[0][1];
  if (m >= STOPS[2][0]) return STOPS[2][1];
  const [a, b] = m < STOPS[1][0] ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const t = (m - a[0]) / (b[0] - a[0]);
  return [0, 1, 2].map(i => Math.round(a[1][i] + (b[1][i] - a[1][i]) * t)) as [number, number, number];
}

export function minutesColor(m: number): string {
  const [r, g, b] = rgbFor(m);
  return `rgb(${r}, ${g}, ${b})`;
}

// Dark text on the light orange tones, white text on blue and red.
export function minutesTextColor(m: number): string {
  const [r, g, b] = rgbFor(m);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1a1a1a' : '#ffffff';
}
