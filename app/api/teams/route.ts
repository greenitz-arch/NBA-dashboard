// app/api/teams/route.ts
import { NextResponse } from 'next/server';
import { getTeamsByConference } from '@/lib/balldontlie';

export const revalidate = 86400; // cache 24 hours

export async function GET() {
  try {
    const teams = await getTeamsByConference();
    return NextResponse.json(teams);
  } catch (err) {
    console.error('[/api/teams]', err);
    return NextResponse.json({ East: [], West: [] }, { status: 200 });
  }
}
