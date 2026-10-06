import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { visitStore, dayKey } from '@/lib/visits';
import { summarizeVisits } from '@/lib/visitStats';

export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

function samePassword(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Returns the visit numbers, but only with the right password.
// The password lives in Netlify's settings (STATS_PASSWORD), never in the code.
export async function POST(req: Request) {
  const expected = process.env.STATS_PASSWORD;
  if (!expected) return json({ error: 'not-configured' }, 503);

  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!samePassword(password, expected)) {
    await new Promise(r => setTimeout(r, 800)); // slows down password guessing
    return json({ error: 'wrong-password' }, 401);
  }

  try {
    const keys: string[] = [];
    for await (const page of visitStore().list({ prefix: 'n/', paginate: true })) {
      for (const b of page.blobs) keys.push(b.key);
    }
    return json(summarizeVisits(keys, dayKey()));
  } catch {
    return json({ error: 'storage-unavailable' }, 503);
  }
}
