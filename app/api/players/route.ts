// app/api/players/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPlayersByTeam, searchPlayers } from '@/lib/balldontlie';

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const search = searchParams.get('search');

  try {
    if (search) {
      const players = await searchPlayers(search);
      return NextResponse.json(players);
    }
    if (teamId) {
      const players = await getPlayersByTeam(Number(teamId));
      return NextResponse.json(players);
    }
    return NextResponse.json([]);
  } catch (err) {
    console.error('[/api/players]', err);
    return NextResponse.json([], { status: 200 });
  }
}
