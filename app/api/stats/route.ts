import { NextRequest, NextResponse } from 'next/server';
import { getBatchLastGameStats } from '@/lib/nba';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('playerIds');
  if (!idsParam) return NextResponse.json({}, { status: 200 });

  const playerIds = idsParam
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(n => !isNaN(n));

  if (playerIds.length === 0) return NextResponse.json({});

  try {
    const statsMap = await getBatchLastGameStats(playerIds);
    const result = Object.fromEntries(
      Array.from(statsMap.entries()).map(([k, v]) => [String(k), v])
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/stats]', err);
    return NextResponse.json({}, { status: 200 });
  }
}
