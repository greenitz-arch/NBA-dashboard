import { NextResponse } from 'next/server';
import { visitStore, dayKey, ID_RE } from '@/lib/visits';

export const dynamic = 'force-dynamic';

// Search-engine and link-preview robots are not "visitors".
// (The browser description is only checked here, never saved.)
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i;

// Records one anonymous visit. Receives only a random ID made by the visitor's browser.
export async function POST(req: Request) {
  try {
    if (BOT.test(req.headers.get('user-agent') ?? '')) return new NextResponse(null, { status: 204 });

    const body = (await req.json().catch(() => null)) as { id?: unknown } | null;
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!ID_RE.test(id)) return new NextResponse(null, { status: 400 });

    const rand = Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
    await visitStore().set(`n/${dayKey()}/${id}/${rand}`, '1');
  } catch (err) {
    // Storage isn't available (for example when running locally).
    // Visitors never see this; the status code (503) and the message let the owner diagnose it.
    console.error('visit not saved:', err);
    return NextResponse.json(
      { saved: false, reason: err instanceof Error ? err.message : String(err) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  return new NextResponse(null, { status: 204 });
}
