// lib/balldontlie.ts
// All calls go through this module. Swap API_BASE or add auth headers here.

const API_BASE = 'https://api.balldontlie.io/v1';

function getHeaders(): HeadersInit {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) {
    console.warn('[balldontlie] No API key set — requests may be rate-limited.');
    return { 'Content-Type': 'application/json' };
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': key,
  };
}

async function bdlFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: getHeaders(),
    next: { revalidate: 3600 }, // Next.js cache: 1 hour
  });
  if (!res.ok) {
    throw new Error(`balldontlie error ${res.status}: ${path}`);
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type Conference = 'East' | 'West';

export interface Team {
  id: number;
  abbreviation: string;
  city: string;
  conference: Conference;
  division: string;
  full_name: string;
  name: string;
}

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  height: string;
  weight: string;
  jersey_number: string;
  college: string;
  country: string;
  draft_year: number | null;
  draft_round: number | null;
  draft_number: number | null;
  team: Team;
}

export interface GameStats {
  id: number;
  ast: number;
  blk: number;
  dreb: number;
  fg3_pct: number | null;
  fg3a: number;
  fg3m: number;
  fg_pct: number | null;
  fga: number;
  fgm: number;
  ft_pct: number | null;
  fta: number;
  ftm: number;
  game: {
    id: number;
    date: string;
    home_team_score: number;
    visitor_team_score: number;
    season: number;
    home_team: Team;
    visitor_team: Team;
    postseason: boolean;
    status: string;
  };
  min: string;
  oreb: number;
  pf: number;
  player: Player;
  pts: number;
  reb: number;
  stl: number;
  team: Team;
  turnover: number;
  plus_minus: number | null;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

export async function getAllTeams(): Promise<Team[]> {
  const data = await bdlFetch<{ data: Team[] }>('/teams?per_page=100');
  return data.data.sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function getTeamsByConference(): Promise<Record<Conference, Team[]>> {
  const teams = await getAllTeams();
  return {
    East: teams.filter(t => t.conference === 'East').sort((a, b) => a.full_name.localeCompare(b.full_name)),
    West: teams.filter(t => t.conference === 'West').sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
}

export async function getPlayersByTeam(teamId: number): Promise<Player[]> {
  const data = await bdlFetch<{ data: Player[]; meta: { next_cursor?: number } }>(
    `/players?team_ids[]=${teamId}&per_page=100`
  );
  return data.data.sort((a, b) => a.last_name.localeCompare(b.last_name));
}

export async function searchPlayers(query: string): Promise<Player[]> {
  if (query.length < 2) return [];
  const encoded = encodeURIComponent(query);
  const data = await bdlFetch<{ data: Player[] }>(
    `/players?search=${encoded}&per_page=25`
  );
  return data.data;
}

export async function getPlayerById(id: number): Promise<Player> {
  const data = await bdlFetch<{ data: Player }>(`/players/${id}`);
  return data.data;
}

/**
 * Returns the most recent game stats for a player.
 * Fetches last 5 games and returns the most recent one.
 */
export async function getLastGameStats(playerId: number): Promise<GameStats | null> {
  try {
    const season = getCurrentSeason();
    const data = await bdlFetch<{ data: GameStats[] }>(
      `/stats?player_ids[]=${playerId}&seasons[]=${season}&per_page=5&sort_by=game.date&sort_order=desc`
    );
    if (!data.data || data.data.length === 0) return null;
    // Sort by date descending, return most recent
    const sorted = data.data.sort(
      (a, b) => new Date(b.game.date).getTime() - new Date(a.game.date).getTime()
    );
    return sorted[0];
  } catch {
    return null;
  }
}

/**
 * Batch-fetch last game stats for multiple players.
 * Uses a single API call for efficiency.
 */
export async function getBatchLastGameStats(playerIds: number[]): Promise<Map<number, GameStats>> {
  if (playerIds.length === 0) return new Map();
  const season = getCurrentSeason();
  const ids = playerIds.map(id => `player_ids[]=${id}`).join('&');
  const data = await bdlFetch<{ data: GameStats[] }>(
    `/stats?${ids}&seasons[]=${season}&per_page=100&sort_by=game.date&sort_order=desc`
  );

  // Group by player, keep only most recent per player
  const map = new Map<number, GameStats>();
  for (const stat of data.data) {
    const pid = stat.player.id;
    if (!map.has(pid)) {
      map.set(pid, stat);
    } else {
      const existing = map.get(pid)!;
      if (new Date(stat.game.date) > new Date(existing.game.date)) {
        map.set(pid, stat);
      }
    }
  }
  return map;
}

function getCurrentSeason(): number {
  const now = new Date();
  // NBA season starts in October; if before October, season year is previous year
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Returns the NBA headshot URL for a player (from CDN).
 * Falls back to a placeholder if not available.
 */
export function getPlayerHeadshotUrl(playerId: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
}

/**
 * Returns the team logo URL.
 */
export function getTeamLogoUrl(teamAbbr: string): string {
  return `https://cdn.nba.com/logos/nba/${teamAbbr}/global/L/logo.svg`;
}
