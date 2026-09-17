// app/api/nba-proxy/route.ts
// Server-side proxy for ESPN NBA API calls that PlayerSelector makes.
// ESPN's public API works from Netlify/cloud servers — no blocking.
// Returns responses shaped like the old stats.nba.com format so
// PlayerSelector.tsx needs no changes.

import { NextRequest, NextResponse } from 'next/server';
import { NBA_TEAMS } from '@/lib/nba';

export const dynamic = 'force-dynamic';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_HEADERS = { 'Accept': 'application/json' };

// Caching is now handled by Netlify's edge (s-maxage header on the response),
// not by an in-memory Map. A module-level Map is unreliable on serverless:
// it only resets on cold start, so under steady traffic a "1 hour" TTL could
// silently persist far longer, and different warm instances could each hold
// their own stale snapshot. The edge cache below has one predictable TTL
// enforced by Netlify's CDN regardless of function instance lifecycle.
const CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate=60';

// ─── Fetch single team roster from ESPN ───────────────────────────────────────

async function fetchRoster(teamId: number): Promise<unknown> {
  const team = NBA_TEAMS.find(t => t.id === teamId);
  if (!team) throw new Error(`Unknown team ID: ${teamId}`);

  const url = `${ESPN_BASE}/teams/${team.espnId}/roster`;
  const res = await fetch(url, {
    headers: ESPN_HEADERS,
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ESPN roster error ${res.status}`);

  const espn = await res.json() as {
    athletes?: Array<{
      id: string;
      displayName: string;
      position?: { abbreviation: string };
      jersey?: string;
    }>;
  };

  const headers = ['PLAYER_ID', 'PLAYER', 'NUM', 'POSITION'];
  const rowSet = (espn.athletes ?? []).map(a => [
    Number(a.id),
    a.displayName,
    a.jersey ?? '',
    a.position?.abbreviation ?? '',
  ]);

  return { resultSets: [{ name: 'CommonTeamRoster', headers, rowSet }] };
}

// ─── Fetch all active players via ESPN (fix issue #6 — single approach) ──────
// Instead of 30 roster requests, use ESPN's athlete search which returns
// all current-season players in one call grouped by team.

async function fetchAllPlayers(): Promise<unknown> {
  // Fetch all 30 rosters in parallel — ESPN handles this fast from server
  // The response as a whole is edge-cached for 1 hour (see CACHE_CONTROL below)
  const teamResults = await Promise.allSettled(
    NBA_TEAMS.map(async team => {
      const url = `${ESPN_BASE}/teams/${team.espnId}/roster`;
      const res = await fetch(url, {
        headers: ESPN_HEADERS,
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      });
      if (!res.ok) return [];

      const espn = await res.json() as {
        athletes?: Array<{ id: string; displayName: string }>;
      };

      return (espn.athletes ?? []).map(a => ({
        id: a.id,
        displayName: a.displayName,
        teamNbaId: team.id,
        teamAbbr: team.abbreviation,
        teamName: team.full_name,
      }));
    })
  );

  const allPlayers = teamResults.flatMap(r =>
    r.status === 'fulfilled' ? r.value : []
  );

  const headers = ['PERSON_ID', 'DISPLAY_FIRST_LAST', 'TEAM_ID', 'TEAM_ABBREVIATION', 'TEAM_NAME'];
  const rowSet = allPlayers.map(p => [
    Number(p.id),
    p.displayName,
    p.teamNbaId,
    p.teamAbbr,
    p.teamName,
  ]);

  return { resultSets: [{ name: 'CommonAllPlayers', headers, rowSet }] };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get('endpoint');
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint param required' }, { status: 400 });
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

    // Only tell Netlify's edge to cache this if it's actually good data.
    // If ESPN hiccuped and we got an empty result back, we don't want that
    // empty response saved and repeated to every visitor for the next hour —
    // that's exactly what happened last deploy. So: no rows, no caching.
    const hasData = Array.isArray((data as any)?.resultSets?.[0]?.rowSet)
      && (data as any).resultSets[0].rowSet.length > 0;

    return NextResponse.json(data, {
      headers: { 'Cache-Control': hasData ? CACHE_CONTROL : 'no-store' },
    });

  } catch (err) {
    console.error('[nba-proxy]', err);
    return NextResponse.json({ error: 'Failed to reach ESPN API' }, { status: 502 });
  }
}
