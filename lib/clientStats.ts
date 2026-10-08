// Player-card stats, fetched from the visitor's own browser.
//
// ESPN refuses the app's server when it asks for game box scores (403), but it
// answers normal browsers. Each player's ESPN game log already holds every
// number the cards show, so we build the "last game" line from that alone.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { GameStats } from './nba';
import type { WatchlistPlayer } from './storage';

const GAMELOG_URL = (id: number) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog`;

const BASE_LABELS = ['MIN', 'FG', 'FG%', '3PT', '3P%', 'FT', 'FT%', 'REB', 'AST', 'BLK', 'STL', 'PF', 'TO', 'PTS'];

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

const pct = (made: number, att: number) => (att > 0 ? Math.round((made / att) * 1000) / 1000 : 0);

// The most recent game the player actually played, taken from his game log.
export function lastGameFromGamelog(json: any, p: WatchlistPlayer): GameStats | null {
  const labels: string[] = Array.isArray(json?.labels) && json.labels.length ? json.labels : BASE_LABELS;
  const at = (k: string) => labels.indexOf(k);
  if (at('PTS') < 0) return null;

  const meta: Record<string, any> = json?.events ?? {};
  const rows = new Map<string, unknown[]>();
  for (const st of json?.seasonTypes ?? []) {
    for (const cat of st?.categories ?? []) {
      for (const ev of cat?.events ?? []) {
        const id = String(ev?.eventId ?? '');
        if (id && Array.isArray(ev?.stats) && !rows.has(id)) rows.set(id, ev.stats);
      }
    }
  }

  // Newest first by date (never by id: preseason ids are numerically higher).
  const ids = Object.keys(meta).sort(
    (a, b) => new Date(meta[b]?.gameDate ?? '').getTime() - new Date(meta[a]?.gameDate ?? '').getTime()
  );

  for (const id of ids) {
    const stats = rows.get(id);
    if (!stats) continue;
    const minutes = toNum(stats[at('MIN')]);
    if (minutes <= 0) continue; // did not play

    const ev = meta[id] ?? {};
    const isHome = String(ev.atVs ?? '').toLowerCase() === 'vs';
    const opp = String(ev.opponent?.abbreviation ?? '');
    const home = toNum(ev.homeTeamScore);
    const away = toNum(ev.awayTeamScore);
    const [fgm, fga] = pair(stats[at('FG')]);
    const [fg3m, fg3a] = pair(stats[at('3PT')]);
    const [ftm, fta] = pair(stats[at('FT')]);

    return {
      playerId: p.id,
      playerName: `${p.first_name} ${p.last_name}`,
      teamId: p.team_id,
      teamAbbr: p.team_abbreviation,
      gameId: id,
      gameDate: String(ev.gameDate ?? ''),
      matchup: isHome ? `vs ${opp}` : `@ ${opp}`,
      isHome,
      outcome: ev.gameResult === 'W' ? 'W' : 'L',
      minutes: String(stats[at('MIN')] ?? '0'),
      pts: toNum(stats[at('PTS')]),
      reb: at('REB') >= 0 ? toNum(stats[at('REB')]) : 0,
      ast: at('AST') >= 0 ? toNum(stats[at('AST')]) : 0,
      stl: at('STL') >= 0 ? toNum(stats[at('STL')]) : 0,
      blk: at('BLK') >= 0 ? toNum(stats[at('BLK')]) : 0,
      turnover: at('TO') >= 0 ? toNum(stats[at('TO')]) : 0,
      fgm, fga, fg_pct: pct(fgm, fga),
      fg3m, fg3a, fg3_pct: pct(fg3m, fg3a),
      ftm, fta, ft_pct: pct(ftm, fta),
      plus_minus: 0, // not in the game log; the cards do not show it
      opponentAbbr: opp,
      teamScore: isHome ? home : away,
      opponentScore: isHome ? away : home,
    };
  }
  return null;
}

// Last-game stats for a list of players, keyed by player id.
// Players whose game log cannot be loaded are simply left out.
export async function fetchCardStats(players: WatchlistPlayer[]): Promise<Record<number, GameStats>> {
  const result: Record<number, GameStats> = {};
  for (let i = 0; i < players.length; i += 5) {
    const chunk = players.slice(i, i + 5);
    await Promise.all(
      chunk.map(async p => {
        try {
          const res = await fetch(GAMELOG_URL(p.id), { cache: 'no-store' });
          if (!res.ok) return;
          const stats = lastGameFromGamelog(await res.json(), p);
          if (stats) result[p.id] = stats;
        } catch {
          // one player failing should not break the rest
        }
      })
    );
  }
  return result;
}
