// app/api/nba-proxy/route.ts
// Proxies requests to stats.nba.com with required headers.
// Also adds CORS headers so the browser can call this endpoint.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NBA_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://www.nba.com',
  'Referer': 'https://www.nba.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
};

// Simple in-memory cache — keyed by endpoint, TTL 1 hour
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

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
    const url = `https://stats.nba.com/stats/${endpoint}`;
    const res = await fetch(url, {
      headers: NBA_HEADERS,
      // Node.js fetch signal for timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(`[nba-proxy] NBA Stats returned ${res.status} for ${endpoint}`);
      return NextResponse.json({ error: `NBA Stats error ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    cache.set(endpoint, { data, ts: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[nba-proxy] fetch error:', err);
    return NextResponse.json({ error: 'Failed to reach NBA Stats API' }, { status: 502 });
  }
}
