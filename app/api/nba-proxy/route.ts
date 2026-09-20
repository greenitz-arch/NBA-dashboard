// app/api/nba-proxy/route.ts
// Server-side proxy for ESPN NBA API calls that PlayerSelector makes.
// ESPN's public API works from Netlify/cloud servers — no blocking.
// Returns responses shaped like the old stats.nba.com format so
// PlayerSelector.tsx needs no changes.

import { NextRequest, NextResponse } from 'next/server';
import { NBA_TEAMS } from '@/lib/nba';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
// ESPN's public API started returning 403s for requests without an
// identifying User-Agent. A generic browser-style UA doesn't help either —
// what works is a header that honestly names the app and links back to it,
// same as any well-behaved API client.
const ESPN_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'CourtsideNBA/1.0 (+https://courtsidenba.netlify.app/)',
};

// Roster data is refreshed at most every 12 hours. This uses Next.js's own
// fetch cache (next: { revalidate }) instead of a module-level Map or a
// manual Cache-Control header on our response:
// - A module-level Map only resets on cold start, so a "1 hour" TTL could
//   silently persist for months under steady traffic (the original bug).
// - A manual Cache-Control/s-maxage header relies on Netlify's CDN, which is
//   spread across many edge locations that don't share or reliably clear
//   each other's copies — one location can keep serving a stale/broken
//   response indefinitely (what broke browse-by-team and search).
// Next's fetch cache is a single shared, durable store (not per-instance,
// not per-edge-node): every request reads the same entry, and once it's
// older than REVALIDATE_SECONDS the next request triggers a background
// refetch from ESPN automatically — no separate scheduled job needed.
// IMPORTANT: this only works because there is no `export const dynamic =
// 'force-dynamic'` on this route — that setting disables fetch caching
// entirely, which is why the old code had to manage caching by hand.
const REVALIDATE_SECONDS = 60 * 60 * 12; // 12 hours

// ─── Fetch single team roster from ESPN ───────────────────────────────────────

type EspnRosterResponse = {
  athletes?: Array<{
    id: string;
    displayName: string;
    position?: { abbreviation: string };
    jersey?: string;
  }>;
};

async function fetchEspnRoster(url: string): Promise<EspnRosterResponse> {
  // NOTE: deliberately no `signal` here. Next.js's time-based revalidation
  // (next.revalidate below) reuses this exact fetch's options for its
  // automatic background refresh — including any AbortSignal. A
  // signal from AbortSignal.timeout() starts counting down the moment it's
  // created and stays aborted forever after it fires once, so by the time
  // the background refresh runs (hours later), that reused signal is
  // already expired and the refresh fails immediately, every time. This is
  // a known Next.js caveat, not something specific to this ESPN endpoint —
  // any cached fetch with a timeout signal will hit the same failure. The
  // uncached fallback fetch below is unaffected since it's never revalidated.
  const res = await fetch(url, {
    headers: ESPN_HEADERS,
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`ESPN roster error ${res.status}`);
  const data = await res.json() as EspnRosterResponse;

  // If the cached/fresh result came back with no players, ESPN likely
  // hiccuped when this entry was last refreshed. Rather than showing an
  // empty roster for up to 12 hours, bypass the cache once and get a truly
  // live answer for this request. (The cached entry itself will self-heal
  // on the next scheduled revalidation if ESPN is healthy by then.)
  if (!data.athletes || data.athletes.length === 0) {
    const liveRes = await fetch(url, {
      headers: ESPN_HEADERS,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    });
    if (liveRes.ok) {
      const liveData = await liveRes.json() as EspnRosterResponse;
      if (liveData.athletes && liveData.athletes.length > 0) return liveData;
    }
  }

  return data;
}

async function fetchRoster(teamId: number): Promise<unknown> {
  const team = NBA_TEAMS.find(t => t.id === teamId);
  if (!team) throw new Error(`Unknown team ID: ${teamId}`);

  const url = `${ESPN_BASE}/teams/${team.espnId}/roster`;
  const espn = await fetchEspnRoster(url);

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
  // Fetch all 30 rosters in parallel. Each one is backed by the 12-hour
  // fetch cache above, so this is fast except right after a cache refresh.
  const teamResults = await Promise.allSettled(
    NBA_TEAMS.map(async team => {
      const url = `${ESPN_BASE}/teams/${team.espnId}/roster`;
      const espn = await fetchEspnRoster(url);

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

    // No manual caching headers needed here anymore — freshness is handled
    // where the ESPN calls happen (see fetchEspnRoster above). This route
    // itself should always run fresh so it can pick up that cached data.
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (err) {
    console.error('[nba-proxy]', err);
    // Keeping this exposed (not just logged) until the ESPN 403 issue is
    // fully resolved, so every test tells us something without needing
    // another deploy just to see the error. Revert to the generic message
    // once this is confirmed fixed.
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : typeof err;
    return NextResponse.json(
      { error: 'Failed to reach ESPN API', debugName: name, debugMessage: message },
      { status: 502 }
    );
  }
}
