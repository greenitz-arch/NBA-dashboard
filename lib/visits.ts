// lib/visits.ts
// Shared helpers for the anonymous visit counter.
//
// How it works: every visit is saved as one tiny record in Netlify Blobs,
// named  n/<day>/<anonymous-id>/<random>.  Nothing else is stored -- no IP
// address, no browser details, no name or email. The hidden /hq page counts
// those records to show visits and unique visitors.

import { getStore } from '@netlify/blobs';

export const VISIT_STORE = 'courtside-visits';

// "strong" = a visit is visible in the stats right after it is saved.
export function visitStore() {
  return getStore({ name: VISIT_STORE, consistency: 'strong' });
}

// Days are counted in Israel time so "today" on the stats page matches your day.
export function dayKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d); // e.g. 2026-10-05
}

export const ID_RE = /^[0-9a-f-]{36}$/i;
