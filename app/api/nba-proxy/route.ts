// app/api/nba-proxy/route.ts
//
// Proxies data requests to ESPN's public API, which works from cloud/serverless
// environments (unlike stats.nba.com which blocks Netlify/AWS IPs).
//
// Supported endpoint params (matching what PlayerSelector.tsx sends):
//   commonteamroster?TeamID=<id>&Season=<YYYY-YY>
//   commonallplayers?LeagueID=00&Season=<YYYY-YY>&IsOnlyCurrentSeason=1
//
// ESPN API base: https://site.api.espn.com/apis/site/v2/sports/basketball/nba

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Simple in-memory cache — keyed by endpoint string, TTL 1 hour
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

// Maps our 30 NBA team IDs (stats.nba.com style) → ESPN team slugs
// ESPN identifies teams by a numeric ID in their own system.
// We look up rosters via /teams/<espnId>/roster
const NBA_TEAM_ID_TO_ESPN: Record<number, number> = {
  1610612737: 1,  // Atlanta Hawks
  1610612738: 2,  // Boston Celtics
  1610612751: 17, // Brooklyn Nets
  1610612766: 30, // Charlotte Hornets
  1610612741: 4,  // Chicago Bulls
  1610612739: 5,  // Cleveland Cavaliers
  1610612742: 6,  // Dallas Mavericks
  1610612743: 7,  // Denver Nuggets
  1610612765: 8,  // Detroit Pistons
  1610612744: 9,  // Golden State Warriors
  1610612745: 10, // Houston Rockets
  1610612754: 11, // Indiana Pacers
  1610612746: 12, // LA Clippers
  1610612747: 13, // Los Angeles Lakers
  1610612763: 29, // Memphis Grizzlies
  1610612748: 14, // Miami Heat
  1610612749: 15, // Milwaukee Bucks
  1610612750: 16, // Minnesota Timberwolves
  1610612740: 3,  // New Orleans Pelicans
  1610612752: 18, // New York Knicks
  1610612760: 25, // Oklahoma City Thunder
  1610612753: 19, // Orlando Magic
  1610612755: 20, // Philadelphia 76ers
  1610612756: 21, // Phoenix Suns
  1610612757: 22, // Portland Trail Blazers
  1610612758: 23, // Sacramento Kings
  1610612759: 24, // San Antonio Spurs
  1610612761: 28, // Toronto Raptors
  1610612762: 26, // Utah Jazz
  1610612764: 27, // Washington Wizards
};

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

const ESPN_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; NBA-Dashboard/1.0)',
};

// ---------------------------------------------------------------------------
// Fetch a team roster from ESPN and reshape it to match the stats.nba.com
// commonteamroster response shape that PlayerSelector.tsx expects.
// ---------------------------------------------------------------------------
async function fetchRoster(teamId: number): Promise<unknown> {
  const espnId = NBA_TEAM_ID_TO_ESPN[teamId];
  if (!espnId) throw new Error(`Unknown team ID: ${teamId}`);

  const url = `${ESPN_BASE}/teams/${espnId}/roster`;
  const res = await fetch(url, { headers: ESPN_HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`ESPN roster ${res.status}`);
  const espn = await res.json() as {
    athletes?: Array<{
      id: string;
      displayName: string;
      position?: { abbreviation: string };
      jersey?: string;
    }>;
  };

  const athletes = espn.athletes ?? [];

  // Build a response that mirrors the NBA Stats commonteamroster shape
  const headers = ['PLAYER_ID', 'PLAYER', 'NUM', 'POSITION'];
  const rowSet = athletes.map(a => [
    Number(a.id),
    a.displayName,
    a.jersey ?? '',
    a.position?.abbreviation ?? '',
  ]);

  return {
    resultSets: [
      {
        name: 'CommonTeamRoster',
        headers,
        rowSet,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Fetch all active NBA players from ESPN and reshape to match the
// commonallplayers response shape that PlayerSelector.tsx expects.
// ---------------------------------------------------------------------------
async function fetchAllPlayers(): Promise<unknown> {
  // ESPN exposes all teams; we fetch each roster in parallel to build a full list.
  const espnIds = Object.values(NBA_TEAM_ID_TO_ESPN);
  const nbaIdByEspn = Object.fromEntries(
    Object.entries(NBA_TEAM_ID_TO_ESPN).map(([nba, espn]) => [espn, Number(nba)])
  );

  const results = await Promise.allSettled(
    espnIds.map(async (espnId) => {
      const url = `${ESPN_BASE}/teams/${espnId}/roster`;
      const res = await fetch(url, { headers: ESPN_HEADERS, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];
      const espn = await res.json() as {
        team?: { abbreviation?: string; displayName?: string };
        athletes?: Array<{
          id: string;
          displayName: string;
          position?: { abbreviation: string };
          jersey?: string;
        }>;
      };
      const teamNbaId = nbaIdByEspn[espnId];
      const teamAbbr = espn.team?.abbreviation ?? '';
      const teamName = espn.team?.displayName ?? '';
      return (espn.athletes ?? []).map(a => ({
        espnId,
        teamNbaId,
        teamAbbr,
        teamName,
        id: a.id,
        displayName: a.displayName,
      }));
    })
  );

  const allPlayers = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // Shape to match stats.nba.com commonallplayers
  const headers = ['PERSON_ID', 'DISPLAY_FIRST_LAST', 'TEAM_ID', 'TEAM_ABBREVIATION', 'TEAM_NAME'];
  const rowSet = allPlayers.map(p => [
    Number(p.id),
    p.displayName,
    p.teamNbaId,
    p.teamAbbr,
    p.teamName,
  ]);

  return {
    resultSets: [
      {
        name: 'CommonAllPlayers',
        headers,
        rowSet,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint param required' }, { status: 400 });
  }

  // Serve from cache if fresh
  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    let data: unknown;

    if (endpoint.startsWith('commonteamroster')) {
      const params = new URLSearchParams(endpoint.split('?')[1] ?? '');
      const teamId = Number(params.get('TeamID'));
      if (!teamId) return NextResponse.json({ error: 'TeamID required' }, { status: 400 });
      data = await fetchRoster(teamId);

    } else if (endpoint.startsWith('commonallplayers')) {
      data = await fetchAllPlayers();

    } else {
      return NextResponse.json({ error: `Unsupported endpoint: ${endpoint}` }, { status: 400 });
    }

    cache.set(endpoint, { data, ts: Date.now() });
    return NextResponse.json(data);

  } catch (err) {
    console.error('[nba-proxy] error:', err);
    return NextResponse.json({ error: 'Failed to fetch from ESPN API' }, { status: 502 });
  }
}
