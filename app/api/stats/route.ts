// app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getBatchLastGameStats } from '@/lib/balldontlie';

export const revalidate = 3600; // refresh every hour, cron will bust manually

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('playerIds');
  if (!idsParam) {
    return NextResponse.json({ error: 'playerIds required' }, { status: 400 });
  }

  const playerIds = idsParam
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(n => !isNaN(n));

  if (playerIds.length === 0) {
    return NextResponse.json({});
  }

  try {
    const statsMap = await getBatchLastGameStats(playerIds);
    // Convert Map to plain object for JSON
    const result = Object.fromEntries(
      Array.from(statsMap.entries()).map(([k, v]) => [String(k), v])
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/stats]', err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
