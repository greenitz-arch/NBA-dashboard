// lib/nba.ts
// All data now comes from ESPN's public API — works from any server including Netlify.
// stats.nba.com is completely removed (it blocks cloud IPs via Cloudflare).

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_CDN  = 'https://a.espncdn.com';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Conference = 'East' | 'West';

export interface Team {
  id: number;           // NBA.com-style team ID (used as stable key throughout app)
  espnId: number;       // ESPN numeric team ID (used for ESPN API calls)
  abbreviation: string;
  city: string;
  conference: Conference;
  division: string;
  full_name: string;
  name: string;
}

export interface Player {
  id: number;           // ESPN player ID
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
  matchup: string;
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
// Both NBA.com IDs (used as stable keys) and ESPN IDs (used for API calls).

export const NBA_TEAMS: Team[] = [
  { id: 1610612737, espnId: 1,  abbreviation: 'ATL', city: 'Atlanta',       conference: 'East', division: 'Southeast', full_name: 'Atlanta Hawks',           name: 'Hawks' },
  { id: 1610612738, espnId: 2,  abbreviation: 'BOS', city: 'Boston',        conference: 'East', division: 'Atlantic',  full_name: 'Boston Celtics',           name: 'Celtics' },
  { id: 1610612751, espnId: 17, abbreviation: 'BKN', city: 'Brooklyn',      conference: 'East', division: 'Atlantic',  full_name: 'Brooklyn Nets',            name: 'Nets' },
  { id: 1610612766, espnId: 30, abbreviation: 'CHA', city: 'Charlotte',     conference: 'East', division: 'Southeast', full_name: 'Charlotte Hornets',        name: 'Hornets' },
  { id: 1610612741, espnId: 4,  abbreviation: 'CHI', city: 'Chicago',       conference: 'East', division: 'Central',   full_name: 'Chicago Bulls',            name: 'Bulls' },
  { id: 1610612739, espnId: 5,  abbreviation: 'CLE', city: 'Cleveland',     conference: 'East', division: 'Central',   full_name: 'Cleveland Cavaliers',      name: 'Cavaliers' },
  { id: 1610612742, espnId: 6,  abbreviation: 'DAL', city: 'Dallas',        conference: 'West', division: 'Southwest', full_name: 'Dallas Mavericks',         name: 'Mavericks' },
  { id: 1610612743, espnId: 7,  abbreviation: 'DEN', city: 'Denver',        conference: 'West', division: 'Northwest', full_name: 'Denver Nuggets',           name: 'Nuggets' },
  { id: 1610612765, espnId: 8,  abbreviation: 'DET', city: 'Detroit',       conference: 'East', division: 'Central',   full_name: 'Detroit Pistons',          name: 'Pistons' },
  { id: 1610612744, espnId: 9,  abbreviation: 'GSW', city: 'Golden State',  conference: 'West', division: 'Pacific',   full_name: 'Golden State Warriors',    name: 'Warriors' },
  { id: 1610612745, espnId: 10, abbreviation: 'HOU', city: 'Houston',       conference: 'West', division: 'Southwest', full_name: 'Houston Rockets',          name: 'Rockets' },
  { id: 1610612754, espnId: 11, abbreviation: 'IND', city: 'Indiana',       conference: 'East', division: 'Central',   full_name: 'Indiana Pacers',           name: 'Pacers' },
  { id: 1610612746, espnId: 12, abbreviation: 'LAC', city: 'LA',            conference: 'West', division: 'Pacific',   full_name: 'LA Clippers',              name: 'Clippers' },
  { id: 1610612747, espnId: 13, abbreviation: 'LAL', city: 'Los Angeles',   conference: 'West', division: 'Pacific',   full_name: 'Los Angeles Lakers',       name: 'Lakers' },
  { id: 1610612763, espnId: 29, abbreviation: 'MEM', city: 'Memphis',       conference: 'West', division: 'Southwest', full_name: 'Memphis Grizzlies',        name: 'Grizzlies' },
  { id: 1610612748, espnId: 14, abbreviation: 'MIA', city: 'Miami',         conference: 'East', division: 'Southeast', full_name: 'Miami Heat',               name: 'Heat' },
  { id: 1610612749, espnId: 15, abbreviation: 'MIL', city: 'Milwaukee',     conference: 'East', division: 'Central',   full_name: 'Milwaukee Bucks',          name: 'Bucks' },
  { id: 1610612750, espnId: 16, abbreviation: 'MIN', city: 'Minnesota',     conference: 'West', division: 'Northwest', full_name: 'Minnesota Timberwolves',   name: 'Timberwolves' },
  { id: 1610612740, espnId: 3,  abbreviation: 'NOP', city: 'New Orleans',   conference: 'West', division: 'Southwest', full_name: 'New Orleans Pelicans',     name: 'Pelicans' },
  { id: 1610612752, espnId: 18, abbreviation: 'NYK', city: 'New York',      conference: 'East', division: 'Atlantic',  full_name: 'New York Knicks',          name: 'Knicks' },
  { id: 1610612760, espnId: 25, abbreviation: 'OKC', city: 'Oklahoma City', conference: 'West', division: 'Northwest', full_name: 'Oklahoma City Thunder',    name: 'Thunder' },
  { id: 1610612753, espnId: 19, abbreviation: 'ORL', city: 'Orlando',       conference: 'East', division: 'Southeast', full_name: 'Orlando Magic',            name: 'Magic' },
  { id: 1610612755, espnId: 20, abbreviation: 'PHI', city: 'Philadelphia',  conference: 'East', division: 'Atlantic',  full_name: 'Philadelphia 76ers',       name: '76ers' },
  { id: 1610612756, espnId: 21, abbreviation: 'PHX', city: 'Phoenix',       conference: 'West', division: 'Pacific',   full_name: 'Phoenix Suns',             name: 'Suns' },
  { id: 1610612757, espnId: 22, abbreviation: 'POR', city: 'Portland',      conference: 'West', division: 'Northwest', full_name: 'Portland Trail Blazers',   name: 'Trail Blazers' },
  { id: 1610612758, espnId: 23, abbreviation: 'SAC', city: 'Sacramento',    conference: 'West', division: 'Pacific',   full_name: 'Sacramento Kings',         name: 'Kings' },
  { id: 1610612759, espnId: 24, abbreviation: 'SAS', city: 'San Antonio',   conference: 'West', division: 'Southwest', full_name: 'San Antonio Spurs',        name: 'Spurs' },
  { id: 1610612761, espnId: 28, abbreviation: 'TOR', city: 'Toronto',       conference: 'East', division: 'Atlantic',  full_name: 'Toronto Raptors',          name: 'Raptors' },
  { id: 1610612762, espnId: 26, abbreviation: 'UTA', city: 'Utah',          conference: 'West', division: 'Northwest', full_name: 'Utah Jazz',                name: 'Jazz' },
  { id: 1610612764, espnId: 27, abbreviation: 'WAS', city: 'Washington',    conference: 'East', division: 'Southeast', full_name: 'Washington Wizards',       name: 'Wizards' },
];

// ─── Team lookup helpers ──────────────────────────────────────────────────────

export function getTeamsByConference(): Record<Conference, Team[]> {
  return {
    East: NBA_TEAMS.filter(t => t.conference === 'East').sort((a, b) => a.full_name.localeCompare(b.full_name)),
    West: NBA_TEAMS.filter(t => t.conference === 'West').sort((a, b) => a.full_name.localeCompare(b.full_name)),
  };
}

export function getTeamById(id: number): Team | undefined {
  return NBA_TEAMS.find(t => t.id === id);
}

export function getTeamByEspnId(espnId: number): Team | undefined {
  return NBA_TEAMS.find(t => t.espnId === espnId);
}

export function getTeamByAbbr(abbr: string): Team | undefined {
  return NBA_TEAMS.find(t => t.abbreviation === abbr);
}

// ─── ESPN fetch helper ────────────────────────────────────────────────────────

async function espnFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`ESPN error ${res.status}: ${url}`);
  return res.json();
}

// ─── Roster (used by /api/players route — kept for compatibility) ─────────────

export async function getPlayersByTeam(teamId: number): Promise<Player[]> {
  const team = getTeamById(teamId);
  if (!team) return [];

  const data = await espnFetch<{
    athletes?: Array<{
      id: string;
      displayName: string;
      position?: { abbreviation: string };
      jersey?: string;
    }>;
  }>(`${ESPN_BASE}/teams/${team.espnId}/roster`);

  return (data.athletes ?? []).map(a => {
    const parts = a.displayName.split(' ');
    return {
      id: Number(a.id),
      first_name: parts[0] ?? '',
      last_name: parts.slice(1).join(' ') ?? '',
      position: a.position?.abbreviation ?? '',
      jersey_number: a.jersey ?? '',
      team,
    };
  }).sort((a, b) => a.last_name.localeCompare(b.last_name));
}

// ─── Player search (used by /api/players route — kept for compatibility) ──────

export async function searchPlayers(query: string): Promise<Player[]> {
  if (query.length < 2) return [];
  const q = query.toLowerCase();

  // Fetch all rosters in parallel and filter client-side
  // This is fast because results are cached for 1h in the proxy
  const results = await Promise.allSettled(
    NBA_TEAMS.map(team =>
      espnFetch<{
        athletes?: Array<{
          id: string;
          displayName: string;
          position?: { abbreviation: string };
          jersey?: string;
        }>;
      }>(`${ESPN_BASE}/teams/${team.espnId}/roster`)
        .then(data => (data.athletes ?? [])
          .filter(a => a.displayName.toLowerCase().includes(q))
          .map(a => {
            const parts = a.displayName.split(' ');
            return {
              id: Number(a.id),
              first_name: parts[0] ?? '',
              last_name: parts.slice(1).join(' ') ?? '',
              position: a.position?.abbreviation ?? '',
              jersey_number: a.jersey ?? '',
              team,
            };
          })
        )
        .catch(() => [] as Player[])
    )
  );

  return results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .slice(0, 25);
}

// ─── Game stats via ESPN scoreboard + summary ─────────────────────────────────
// Flow: scoreboard (get recent game IDs for a team) → summary (get boxscore)

interface EspnScoreboard {
  events?: Array<{
    id: string;
    date: string;
    competitions?: Array<{
      competitors?: Array<{
        id: string;         // ESPN team ID
        homeAway: string;
        winner?: boolean;
        score?: string;
        team?: { abbreviation?: string };
      }>;
    }>;
  }>;
}

interface EspnSummary {
  boxscore?: {
    players?: Array<{
      team?: { id?: string };
      statistics?: Array<{
        labels?: string[];
        athletes?: Array<{
          athlete?: { id?: string; displayName?: string };
          stats?: string[];
          didNotPlay?: boolean;
        }>;
      }>;
    }>;
  };
  header?: {
    competitions?: Array<{
      date?: string;
      competitors?: Array<{
        id?: string;
        homeAway?: string;
        winner?: boolean;
        score?: string;
        team?: { abbreviation?: string };
      }>;
    }>;
  };
}

// Search back up to this many days for a player's last game
const MAX_DAYS_BACK = 7;

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

async function findRecentGameId(espnTeamId: number): Promise<{ gameId: string; date: string } | null> {
  // Walk back day by day to find the team's most recent completed game
  for (let daysBack = 0; daysBack <= MAX_DAYS_BACK; daysBack++) {
    const date = new Date();
    date.setDate(date.getDate() - daysBack);
    const dateParam = formatDateParam(date);

    try {
      const data = await espnFetch<EspnScoreboard>(
        `${ESPN_BASE}/scoreboard?dates=${dateParam}`
      );

      const event = (data.events ?? []).find(e =>
        e.competitions?.[0]?.competitors?.some(
          c => c.id === String(espnTeamId)
        )
      );

      if (event) {
        return { gameId: event.id, date: event.date };
      }
    } catch {
      // continue to next day
    }
  }
  return null;
}

function parseMadeAtt(labels: string[], stats: string[], key: string): [number, number] {
  const idx = labels.indexOf(key);
  if (idx === -1 || !stats[idx]) return [0, 0];
  const val = stats[idx];
  if (val.includes('-')) {
    const [made, att] = val.split('-').map(Number);
    return [made || 0, att || 0];
  }
  return [Number(val) || 0, 0];
}

export async function getLastGameStats(playerId: number): Promise<GameStats | null> {
  try {
    // Find which team this player is on by checking the watchlist's stored team
    // We look up the game by fetching the ESPN athlete gamelog endpoint
    const gamelogData = await espnFetch<{
      events?: Record<string, {
        id: string;
        gameDate?: string;
        atVs?: string;
        opponent?: { abbreviation?: string };
        homeTeamScore?: string;
        awayTeamScore?: string;
        gameResult?: string;
        team?: { id?: string };
      }>;
    }>(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${playerId}/gamelog`);

    if (!gamelogData.events) return null;

    const eventIds = Object.keys(gamelogData.events);
    if (eventIds.length === 0) return null;

    // V8 sorts numeric-like object keys ascending, so we sort descending
    // to get the most recent game ID (largest number = most recent) first
    const sortedIds = eventIds.sort((a, b) => Number(b) - Number(a));
    const recentEvent = gamelogData.events[sortedIds[0]];
    if (!recentEvent) return null;

    const gameId = recentEvent.id ?? sortedIds[0];
    const gameDate = recentEvent.gameDate ?? '';
    const opponentAbbr = recentEvent.opponent?.abbreviation ?? '';
    const outcome = (recentEvent.gameResult ?? 'L') as 'W' | 'L';
    const isHome = (recentEvent.atVs ?? '').toLowerCase() === 'vs';

    // Now fetch the full game summary to get player stats
    const summary = await espnFetch<EspnSummary>(
      `${ESPN_BASE}/summary?event=${gameId}`
    );

    const boxscore = summary.boxscore;
    if (!boxscore?.players) return null;

    // Find this player's stat row across both team groups
    for (const group of boxscore.players) {
      const statCat = group.statistics?.[0];
      if (!statCat) continue;

      const labels = statCat.labels ?? [];
      const athleteRow = statCat.athletes?.find(
        a => String(a.athlete?.id) === String(playerId)
      );

      if (!athleteRow || athleteRow.didNotPlay) continue;

      const stats = athleteRow.stats ?? [];

      // Find which competitor matches this team for score/home
      const competitors = summary.header?.competitions?.[0]?.competitors ?? [];
      const espnTeamId = group.team?.id ?? '';
      const myComp = competitors.find(c => String(c.id) === String(espnTeamId));
      const oppComp = competitors.find(c => String(c.id) !== String(espnTeamId));

      const teamScore = Number(myComp?.score ?? 0);
      const opponentScore = Number(oppComp?.score ?? 0);
      const isHomeFromHeader = myComp?.homeAway === 'home';

      // Parse FG/3PT/FT as made-attempted
      const [fgm, fga]   = parseMadeAtt(labels, stats, 'FG');
      const [fg3m, fg3a] = parseMadeAtt(labels, stats, '3PT');
      const [ftm, fta]   = parseMadeAtt(labels, stats, 'FT');
      const fg_pct  = fga  > 0 ? Math.round((fgm / fga)   * 1000) / 1000 : 0;
      const fg3_pct = fg3a > 0 ? Math.round((fg3m / fg3a)  * 1000) / 1000 : 0;
      const ft_pct  = fta  > 0 ? Math.round((ftm / fta)    * 1000) / 1000 : 0;

      // Find team by ESPN ID
      const team = getTeamByEspnId(Number(espnTeamId));

      const plusMinusIdx = labels.indexOf('+/-');
      const plusMinusRaw = plusMinusIdx >= 0 ? stats[plusMinusIdx] ?? '0' : '0';
      const plusMinus = Number(plusMinusRaw.replace('+', '')) || 0;

      return {
        playerId,
        playerName: athleteRow.athlete?.displayName ?? '',
        teamId: team?.id ?? 0,
        teamAbbr: team?.abbreviation ?? myComp?.team?.abbreviation ?? '',
        gameId,
        gameDate,
        matchup: isHome ? `vs ${opponentAbbr}` : `@ ${opponentAbbr}`,
        isHome: isHomeFromHeader,
        outcome,
        minutes: stats[labels.indexOf('MIN')] ?? '0',
        pts: Number(stats[labels.indexOf('PTS')] ?? 0),
        reb: Number(stats[labels.indexOf('REB')] ?? 0),
        ast: Number(stats[labels.indexOf('AST')] ?? 0),
        stl: Number(stats[labels.indexOf('STL')] ?? 0),
        blk: Number(stats[labels.indexOf('BLK')] ?? 0),
        turnover: Number(stats[labels.indexOf('TO')] ?? 0),
        fgm, fga, fg_pct,
        fg3m, fg3a, fg3_pct,
        ftm, fta, ft_pct,
        plus_minus: plusMinus,
        opponentAbbr,
        teamScore,
        opponentScore,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function getBatchLastGameStats(playerIds: number[]): Promise<Map<number, GameStats>> {
  const results = new Map<number, GameStats>();
  // Fetch in parallel chunks of 5 to avoid overwhelming the ESPN API
  for (let i = 0; i < playerIds.length; i += 5) {
    const chunk = playerIds.slice(i, i + 5);
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

// Fix #3 — use ESPN CDN, not NBA.com CDN (player IDs are now ESPN IDs)
export function getPlayerHeadshotUrl(playerId: number): string {
  return `${ESPN_CDN}/i/headshots/nba/players/full/${playerId}.png`;
}

export function getTeamLogoUrl(teamAbbr: string): string {
  return `${ESPN_CDN}/i/teamlogos/nba/500/${teamAbbr.toLowerCase()}.png`;
}
