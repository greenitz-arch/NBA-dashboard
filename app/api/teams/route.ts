// app/api/teams/route.ts
import { NextResponse } from 'next/server';
import { getTeamsByConference } from '@/lib/balldontlie';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const teams = await getTeamsByConference();
    return NextResponse.json(teams);
  } catch (err) {
    console.error('[/api/teams]', err);
    return NextResponse.json({ East: [], West: [] }, { status: 200 });
  }
}
