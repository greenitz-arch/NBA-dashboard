// lib/nba.ts
// Uses the unofficial stats.nba.com endpoints — free, no key required.
// These are the same endpoints used by nba.com itself.

const NBA_BASE = 'https://stats.nba.com/stats';
const CDN_BASE = 'https://cdn.nba.com';

// stats.nba.com requires these headers or it returns 403
const NBA_HEADERS: HeadersInit = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
};

// ─── Types ────────────────────────────────────────────────────────────────────

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
  jersey_number: string;
  team: Team;
}

export interface GameStats {
  playerId: number;
  playerName: string;
  teamId: number;
  teamAbbr: string;
  gameId: string;
  gameDate: string;
  matchup: string; // e.g. "LAL vs. GSW"
  isHome: boolean;
  outcome: 'W' | 'L';
  minutes: string;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  fg3m: number;
  fg3a: number;
  fg3_pct: number;
  ftm: number;
  fta: number;
  ft_pct: number;
  plus_minus: number;
  opponentAbbr: string;
  teamScore: number;
  opponentScore: number;
}

// ─── Static team data ─────────────────────────────────────────────────────────
// We keep this static since teams rarely change and it avoids an extra API call.

export const NBA_TEAMS: Team[] = [
  { id: 1610612737, abbreviation: 'ATL', city: 'Atlanta', conference: 'East', division: 'Southeast', full_name: 'Atlanta Hawks', name: 'Hawks' },
  { id: 1610612738, abbreviation: 'BOS', city: 'Boston', conference: 'East', division: 'Atlantic', full_name: 'Boston Celtics', name: 'Celtics' },
  { id: 1610612751, abbreviation: 'BKN', city: 'Brooklyn', conference: 'East', division: 'Atlantic', full_name: 'Brooklyn Nets', name: 'Nets' },
  { id: 1610612766, abbreviation: 'CHA', city: 'Charlotte', conference: 'East', division: 'Southeast', full_name: 'Charlotte Hornets', name: 'Hornets' },
  { id: 1610612741, abbreviation: 'CHI', city: 'Chicago', conference: 'East', division: 'Central', full_name: 'Chicago Bulls', name: 'Bulls' },
  { id: 1610612739, abbreviation: 'CLE', city: 'Cleveland', conference: 'East', division: 'Central', full_name: 'Cleveland Cavaliers', name: 'Cavaliers' },
  { id: 1610612742, abbreviation: 'DAL', city: 'Dallas', conference: 'West', division: 'Southwest', full_name: 'Dallas Mavericks', name: 'Mavericks' },
  { id: 1610612743, abbreviation: 'DEN', city: 'Denver', conference: 'West', division: 'Northwest', full_name: 'Denver Nuggets', name: 'Nuggets' },
  { id: 1610612765, abbreviation: 'DET', city: 'Detroit', conference: 'East', division: 'Central', full_name: 'Detroit Pistons', name: 'Pistons' },
  { id: 1610612744, abbreviation: 'GSW', city: 'Golden State', conference: 'West', division: 'Pacific', full_name: 'Golden State Warriors', name: 'Warriors' },
  { id: 1610612745, abbreviation: 'HOU', city: 'Houston', conference: 'West', division: 'Southwest', full_name: 'Houston Rockets', name: 'Rockets' },
  { id: 1610612754, abbreviation: 'IND', city: 'Indiana', conference: 'East', division: 'Central', full_name: 'Indiana Pacers', name: 'Pacers' },
  { id: 1610612746, abbreviation: 'LAC', city: 'LA', conference: 'West', division: 'Pacific', full_name: 'LA Clippers', name: 'Clippers' },
  { id: 1610612747, abbreviation: 'LAL', city: 'Los Angeles', conference: 'West', division: 'Pacific', full_name: 'Los Angeles Lakers', name: 'Lakers' },
  { id: 1610612763, abbreviation: 'MEM', city: 'Memphis', conference: 'West', division: 'Southwest', full_name: 'Memphis Grizzlies', name: 'Grizzlies' },
  { id: 1610612748, abbreviation: 'MIA', city: 'Miami', conference: 'East', division: 'Southeast', full_name: 'Miami Heat', name: 'Heat' },
  { id: 1610612749, abbreviation: 'MIL', city: 'Milwaukee', conference: 'East', division: 'Central', full_name: 'Milwaukee Bucks', name: 'Bucks' },
  { id: 1610612750, abbreviation: 'MIN', city: 'Minnesota', conference: 'West', division: 'Northwest', full_name: 'Minnesota Timberwolves', name: 'Timberwolves' },
  { id: 1610612740, abbreviation: 'NOP', city: 'New Orleans', conference: 'West', division: 'Southwest', full_name: 'New Orleans Pelicans', name: 'Pelicans' },
  { id: 1610612752, abbreviation: 'NYK', city: 'New York', conference: 'East', division: 'Atlantic', full_name: 'New York Knicks', name: 'Knicks' },
  { id: 1610612760, abbreviation: 'OKC', city: 'Oklahoma City', conference: 'West', division: 'Northwest', full_name: 'Oklahoma City Thunder', name: 'Thunder' },
  { id: 1610612753, abbreviation: 'ORL', city: 'Orlando', conference: 'East', division: 'Southeast', full_name: 'Orlando Magic', name: 'Magic' },
  { id: 1610612755, abbreviation: 'PHI', city: 'Philadelphia', conference: 'East', division: 'Atlantic', full_name: 'Philadelphia 76ers', name: '76ers' },
  { id: 1610612756, abbreviation: 'PHX', city: 'Phoenix', conference: 'West', division: 'Pacific', full_name: 'Phoenix Suns', name: 'Suns' },
  { id: 1610612757, abbreviation: 'POR', city: 'Portland', conference: 'West', division: 'Northwest', full_name: 'Portland Trail Blazers', name: 'Trail Blazers' },
  { id: 1610612758, abbreviation: 'SAC', city: 'Sacramento', conference: 'West', division: 'Pacific', full_name: 'Sacramento Kings', name: 'Kings' },
  { id: 1610612759, abbreviation: 'SAS', city: 'San Antonio', conference: 'West', division: 'Southwest', full_name: 'San Antonio Spurs', name: 'Spurs' },
  { id: 1610612761, abbreviation: 'TOR', city: 'Toronto', conference: 'East', division: 'Atlantic', full_name: 'Toronto Raptors', name: 'Raptors' },
  { id: 1610612762, abbreviation: 'UTA', city: 'Utah', conference: 'West', division: 'Northwest', full_name: 'Utah Jazz', name: 'Jazz' },
  { id: 1610612764, abbreviation: 'WAS', city: 'Washington', conference: 'East', division: 'Southeast', full_name: 'Washington Wizards', name: 'Wizards' },
];

export function getTeamsByConference(): Record<Conference, Team[]> {
  return {
    East: NBA_TEAMS.filter(t => t.conference === 'East').sort((a, b) => a.full_name.localeCompare(b.full_name)),
    West: NBA_TEAMS.filter(t => t.conference === 'West').sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
}

export function getTeamById(id: number): Team | undefined {
  return NBA_TEAMS.find(t => t.id === id);
}

export function getTeamByAbbr(abbr: string): Team | undefined {
  return NBA_TEAMS.find(t => t.abbreviation === abbr);
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function nbaFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: NBA_HEADERS,
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`NBA Stats error ${res.status}: ${url}`);
  return res.json();
}

function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}

// ─── Roster ───────────────────────────────────────────────────────────────────

interface NbaRosterResponse {
  resultSets: Array<{
    name: string;
    headers: string[];
    rowSet: unknown[][];
  }>;
}

export async function getPlayersByTeam(teamId: number): Promise<Player[]> {
  const season = getCurrentSeason();
  const url = `${NBA_BASE}/commonteamroster?TeamID=${teamId}&Season=${season}`;
  const data = await nbaFetch<NbaRosterResponse>(url);

  const roster = data.resultSets.find(r => r.name === 'CommonTeamRoster');
  if (!roster) return [];

  const h = roster.headers;
  const team = getTeamById(teamId);
  if (!team) return [];

  return roster.rowSet.map(row => {
    const get = (key: string) => row[h.indexOf(key)];
    const fullName = String(get('PLAYER') ?? '');
    const parts = fullName.split(' ');
    const firstName = parts[0] ?? '';
    const lastName = parts.slice(1).join(' ') ?? '';
    return {
      id: Number(get('PLAYER_ID')),
      first_name: firstName,
      last_name: lastName,
      position: String(get('POSITION') ?? ''),
      jersey_number: String(get('NUM') ?? ''),
      team,
    };
  }).sort((a, b) => a.last_name.localeCompare(b.last_name));
}

// ─── Player search ────────────────────────────────────────────────────────────

interface NbaPlayerSearchResponse {
  resultSets: Array<{
    name: string;
    headers: string[];
    rowSet: unknown[][];
  }>;
}

export async function searchPlayers(query: string): Promise<Player[]> {
  if (query.length < 2) return [];
  const season = getCurrentSeason();
  const url = `${NBA_BASE}/commonallplayers?LeagueID=00&Season=${season}&IsOnlyCurrentSeason=1`;
  const data = await nbaFetch<NbaPlayerSearchResponse>(url);

  const set = data.resultSets[0];
  if (!set) return [];

  const h = set.headers;
  const q = query.toLowerCase();

  return set.rowSet
    .filter(row => {
      const name = String(row[h.indexOf('DISPLAY_FIRST_LAST')] ?? '').toLowerCase();
      return name.includes(q);
    })
    .slice(0, 20)
    .map(row => {
      const get = (key: string) => row[h.indexOf(key)];
      const fullName = String(get('DISPLAY_FIRST_LAST') ?? '');
      const parts = fullName.split(' ');
      const teamId = Number(get('TEAM_ID'));
      const team = getTeamById(teamId) ?? {
        id: teamId,
        abbreviation: String(get('TEAM_ABBREVIATION') ?? ''),
        city: '',
        conference: 'East' as Conference,
        division: '',
        full_name: String(get('TEAM_NAME') ?? ''),
        name: String(get('TEAM_NAME') ?? ''),
      };
      return {
        id: Number(get('PERSON_ID')),
        first_name: parts[0] ?? '',
        last_name: parts.slice(1).join(' ') ?? '',
        position: '',
        jersey_number: '',
        team,
      };
    });
}

// ─── Game log / stats ─────────────────────────────────────────────────────────

interface NbaGameLogResponse {
  resultSets: Array<{
    name: string;
    headers: string[];
    rowSet: unknown[][];
  }>;
}

export async function getLastGameStats(playerId: number): Promise<GameStats | null> {
  try {
    const season = getCurrentSeason();
    const url = `${NBA_BASE}/playergamelog?PlayerID=${playerId}&Season=${season}&SeasonType=Regular+Season`;
    const data = await nbaFetch<NbaGameLogResponse>(url);

    const log = data.resultSets.find(r => r.name === 'PlayerGameLog');
    if (!log || log.rowSet.length === 0) return null;

    // First row is most recent game
    const row = log.rowSet[0];
    const h = log.headers;
    const get = (key: string) => row[h.indexOf(key)];

    const matchup = String(get('MATCHUP') ?? '');
    const isHome = matchup.includes('vs.');
    const opponentAbbr = matchup.split(/vs\.|@/).pop()?.trim() ?? '';
    const outcome = String(get('WL') ?? 'L') as 'W' | 'L';

    const pts = Number(get('PTS') ?? 0);
    const reb = Number(get('REB') ?? 0);
    const ast = Number(get('AST') ?? 0);
    const teamId = Number(get('Team_ID') ?? 0);
    const team = getTeamById(teamId);

    // Parse score from MATCHUP or use plus_minus approximation
    const plusMinus = Number(get('PLUS_MINUS') ?? 0);

    return {
      playerId,
      playerName: '',
      teamId,
      teamAbbr: team?.abbreviation ?? '',
      gameId: String(get('Game_ID') ?? ''),
      gameDate: String(get('GAME_DATE') ?? ''),
      matchup,
      isHome,
      outcome,
      minutes: String(get('MIN') ?? '0'),
      pts,
      reb,
      ast,
      stl: Number(get('STL') ?? 0),
      blk: Number(get('BLK') ?? 0),
      turnover: Number(get('TOV') ?? 0),
      fgm: Number(get('FGM') ?? 0),
      fga: Number(get('FGA') ?? 0),
      fg_pct: Number(get('FG_PCT') ?? 0),
      fg3m: Number(get('FG3M') ?? 0),
      fg3a: Number(get('FG3A') ?? 0),
      fg3_pct: Number(get('FG3_PCT') ?? 0),
      ftm: Number(get('FTM') ?? 0),
      fta: Number(get('FTA') ?? 0),
      ft_pct: Number(get('FT_PCT') ?? 0),
      plus_minus: plusMinus,
      opponentAbbr,
      teamScore: 0,
      opponentScore: 0,
    };
  } catch {
    return null;
  }
}

export async function getBatchLastGameStats(playerIds: number[]): Promise<Map<number, GameStats>> {
  const results = new Map<number, GameStats>();
  // Fetch in parallel with a concurrency limit of 5
  const chunks: number[][] = [];
  for (let i = 0; i < playerIds.length; i += 5) {
    chunks.push(playerIds.slice(i, i + 5));
  }
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async id => {
        const stats = await getLastGameStats(id);
        if (stats) results.set(id, stats);
      })
    );
  }
  return results;
}

// ─── Assets ───────────────────────────────────────────────────────────────────

export function getPlayerHeadshotUrl(playerId: number): string {
  return `${CDN_BASE}/headshots/nba/latest/1040x760/${playerId}.png`;
}

export function getTeamLogoUrl(teamAbbr: string): string {
  return `${CDN_BASE}/logos/nba/${teamAbbr}/global/L/logo.svg`;
}
