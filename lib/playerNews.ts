// lib/playerNews.ts
// "Player news": what ESPN's news, injury and transaction feeds say about players
// in the last 36 hours. Runs in the visitor's browser (ESPN refuses Netlify's servers
// but answers normal browsers). Nothing here is saved on a server.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { normalizeName } from './fantasy';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
export const WINDOW_MS = 36 * 60 * 60 * 1000;
const ET = 'America/New_York';

export type NewsKind = 'injury' | 'back' | 'move' | 'news';

export interface NewsPlayer {
  id: number | null;
  name: string;
  team: string;
}

export interface NewsItem {
  id: string;
  kind: NewsKind;
  time: number;
  dayLevel: boolean; // true when the source only gives the day, not the time
  players: NewsPlayer[];
  sub: string;
  title: string;
  returnDate: string;
  url: string;
  textMatch: boolean; // true when players have to be found by name in the text
  norm: string; // lower-case text used for name matching
}

export interface NewsResult {
  items: NewsItem[];
  ok: boolean; // false when every feed failed
}

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error(`ESPN ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const RE_BACK = /\b(returns?|returning|returned|cleared|activated|back in the lineup|back from|set to return|expected to return)\b/i;
const RE_MOVE = /\b(trade[sd]?|trading|signs?|signed|signing|waive[sd]?|waiving|releases?|released|extension|two-way|acquire[sd]?|buyout|claimed)\b/i;
const RE_INJ = /\b(injur\w*|ruled out|out for|out with|is out|will be out|sidelined|surgery|sprain\w*|strain\w*|fractur\w*|soreness|tendin\w*|questionable|doubtful|day-to-day|miss(?:es|ing|ed)?|rest(?:ing)?|won't play)\b/i;

function kindOf(text: string): NewsKind {
  if (RE_BACK.test(text)) return 'back';
  if (RE_MOVE.test(text)) return 'move';
  if (RE_INJ.test(text)) return 'injury';
  return 'news';
}

function etDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ms));
}

function idFromLink(href: string): number | null {
  const m = /\/id\/(\d+)/.exec(href);
  return m ? Number(m[1]) : null;
}

function prettyStatus(raw: string): string {
  const s = raw.trim().toLowerCase();
  return s ? s[0].toUpperCase() + s.slice(1) : 'Injury update';
}

function prettyDate(raw: unknown, now: number): string {
  const t = Date.parse(String(raw ?? ''));
  if (!Number.isFinite(t) || t < now - 24 * 60 * 60 * 1000) return '';
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── News articles tagged with players ────────────────────────────────────────
function fromNews(json: any, now: number): NewsItem[] {
  const out: NewsItem[] = [];
  for (const a of json?.articles ?? []) {
    if (a?.type !== 'HeadlineNews' && a?.type !== 'Story') continue;
    const time = Date.parse(String(a?.published ?? ''));
    if (!Number.isFinite(time) || now - time > WINDOW_MS) continue;
    const players: NewsPlayer[] = [];
    for (const c of a?.categories ?? []) {
      if (c?.type !== 'athlete' || !c?.description) continue;
      const rawId = c?.athleteId ?? c?.athlete?.id;
      const id = rawId != null && Number.isFinite(Number(rawId)) ? Number(rawId) : null;
      if (players.some(p => p.name === c.description)) continue;
      players.push({ id, name: String(c.description), team: '' });
      if (players.length >= 4) break;
    }
    if (!players.length) continue;
    const headline = String(a?.headline ?? '').trim();
    if (!headline) continue;
    out.push({
      id: `n:${a?.id ?? headline}`,
      kind: kindOf(`${headline} ${a?.description ?? ''}`),
      time,
      dayLevel: false,
      players,
      sub: players.length > 1 ? `Also: ${players.slice(1).map(p => p.name).join(', ')}` : '',
      title: headline,
      returnDate: '',
      url: String(a?.links?.web?.href ?? 'https://www.espn.com/nba/'),
      textMatch: false,
      norm: '',
    });
  }
  return out;
}

// ── Injury list ──────────────────────────────────────────────────────────────
interface InjuryRow {
  id: string; // player id, or normalised name when the feed has no id
  name: string;
  team: string;
  url: string;
}

function fromInjuries(json: any, now: number): { items: NewsItem[]; rows: InjuryRow[] } {
  const items: NewsItem[] = [];
  const rows: InjuryRow[] = [];
  for (const group of json?.injuries ?? []) {
    for (const it of group?.injuries ?? []) {
      const ath = it?.athlete ?? {};
      const name = String(ath?.displayName ?? ath?.fullName ?? '').trim();
      if (!name) continue;
      const links: any[] = Array.isArray(ath?.links) ? ath.links : [];
      const card = links.find(l => Array.isArray(l?.rel) && l.rel.includes('playercard')) ?? links[0];
      const href = String(card?.href ?? '');
      const pid = ath?.id != null && Number.isFinite(Number(ath.id)) ? Number(ath.id) : idFromLink(href);
      const team = String(ath?.team?.abbreviation ?? '');
      const url = href || (pid ? `https://www.espn.com/nba/player/_/id/${pid}` : 'https://www.espn.com/nba/injuries');
      rows.push({ id: pid ? String(pid) : normalizeName(name), name, team, url });

      const time = Date.parse(String(it?.date ?? ''));
      if (!Number.isFinite(time) || now - time > WINDOW_MS) continue;
      const kind = typeof it?.details?.type === 'string' ? it.details.type : '';
      const status = prettyStatus(String(it?.status ?? it?.type?.description ?? ''));
      items.push({
        id: `i:${pid ?? normalizeName(name)}:${it?.date}`,
        kind: 'injury',
        time,
        dayLevel: false,
        players: [{ id: pid, name, team }],
        sub: kind ? `${status} · ${kind}` : status,
        title: String(it?.shortComment ?? it?.longComment ?? '').trim() || status,
        returnDate: prettyDate(it?.details?.returnDate, now),
        url,
        textMatch: false,
        norm: '',
      });
    }
  }
  return { items, rows };
}

// ── Roster moves (signings, waivers, trades) ─────────────────────────────────
const NAME_AFTER_POSITION = /\b(?:PG|SG|SF|PF|G-F|F-C|C-F|G|F|C)\s+((?:[A-Z][\w'’.-]*)(?:\s+[A-Z][\w'’.-]*){1,3})/g;

function fromTransactions(json: any, now: number): NewsItem[] {
  const out: NewsItem[] = [];
  const cutoff = etDay(now - 24 * 60 * 60 * 1000);
  for (const t of json?.transactions ?? []) {
    const time = Date.parse(String(t?.date ?? ''));
    const text = String(t?.description ?? '').trim();
    if (!Number.isFinite(time) || !text || etDay(time) < cutoff) continue;
    const team = String(t?.team?.abbreviation ?? '');
    const players: NewsPlayer[] = [];
    for (const m of text.matchAll(NAME_AFTER_POSITION)) {
      // The sentence's final full stop sticks to the name ("Trey Jemison III."), but "Jr." keeps its own.
      const name = /\b(?:Jr|Sr)\.$/.test(m[1]) ? m[1] : m[1].replace(/\.$/, '');
      if (!players.some(p => p.name === name)) players.push({ id: null, name, team });
      if (players.length >= 3) break;
    }
    out.push({
      id: `t:${t?.date}:${normalizeName(text).slice(0, 60)}`,
      kind: 'move',
      time,
      dayLevel: true,
      players: players.length ? players : [{ id: null, name: String(t?.team?.displayName ?? 'League move'), team }],
      sub: String(t?.team?.displayName ?? ''),
      title: text,
      returnDate: '',
      url: 'https://www.espn.com/nba/transactions',
      textMatch: true,
      norm: normalizeName(text),
    });
  }
  return out;
}

// ── "Back from injury": compare today's injury list with the one this device saw earlier ──
const SNAP_KEY = 'courtside_injury_snapshot_v1';
const BACK_KEY = 'courtside_news_back_v1';

interface BackRow { id: string; name: string; team: string; url: string; time: number }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: skip */ }
}

function detectBack(rows: InjuryRow[], now: number): NewsItem[] {
  let backs = readJson<BackRow[]>(BACK_KEY, []).filter(b => now - b.time <= WINDOW_MS);
  const snap = readJson<{ ts: number; rows: Record<string, { n: string; t: string; u: string }> } | null>(SNAP_KEY, null);
  const current = new Map(rows.map(r => [r.id, r]));
  const sane = rows.length >= 10;

  if (snap && sane) {
    const old = Object.entries(snap.rows);
    // If the list suddenly shrank by half, the feed is probably glitching: change nothing.
    if (old.length >= 10 && current.size >= old.length * 0.5) {
      for (const [id, r] of old) {
        if (!current.has(id) && !backs.some(b => b.id === id)) {
          backs.push({ id, name: r.n, team: r.t, url: r.u, time: now });
        }
      }
      writeJson(SNAP_KEY, { ts: now, rows: Object.fromEntries(rows.map(r => [r.id, { n: r.name, t: r.team, u: r.url }])) });
    }
  } else if (!snap && sane) {
    writeJson(SNAP_KEY, { ts: now, rows: Object.fromEntries(rows.map(r => [r.id, { n: r.name, t: r.team, u: r.url }])) });
  }
  writeJson(BACK_KEY, backs);

  return backs.map(b => ({
    id: `b:${b.id}:${b.time}`,
    kind: 'back' as const,
    time: b.time,
    dayLevel: false,
    players: [{ id: /^\d+$/.test(b.id) ? Number(b.id) : null, name: b.name, team: b.team }],
    sub: b.team ? `${b.team} · Off the injury list` : 'Off the injury list',
    title: 'No longer on the injury list',
    returnDate: '',
    url: b.url,
    textMatch: false,
    norm: '',
  }));
}

export async function fetchPlayerNews(now = Date.now()): Promise<NewsResult> {
  const [news, inj, tx] = await Promise.allSettled([
    getJson(`${BASE}/news?limit=60`),
    getJson(`${BASE}/injuries`),
    getJson(`${BASE}/transactions?limit=60`),
  ]);
  const ok = [news, inj, tx].some(r => r.status === 'fulfilled');
  const items: NewsItem[] = [];
  if (news.status === 'fulfilled') items.push(...fromNews(news.value, now));
  if (inj.status === 'fulfilled') {
    const parsed = fromInjuries(inj.value, now);
    items.push(...parsed.items, ...detectBack(parsed.rows, now));
  }
  if (tx.status === 'fulfilled') items.push(...fromTransactions(tx.value, now));
  items.sort((a, b) => b.time - a.time);
  return { items, ok };
}

// Does this item involve one of the person's players?
export function matchesRoster(item: NewsItem, ids: Set<number>, names: Set<string>): boolean {
  for (const p of item.players) {
    if (p.id != null && ids.has(p.id)) return true;
    if (names.has(normalizeName(p.name))) return true;
  }
  if (item.textMatch) {
    for (const n of names) if (n && item.norm.includes(n)) return true;
  }
  return false;
}

export function agoLabel(item: NewsItem, now = Date.now()): string {
  if (item.dayLevel) {
    const today = etDay(now);
    const day = etDay(item.time);
    return day === today ? 'Today' : 'Yesterday';
  }
  const mins = Math.max(1, Math.round((now - item.time) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : 'Yesterday';
}
