// One place that asks ESPN for a player's game log.
//
// Asked with no season, ESPN's game log can keep answering with LAST season until
// ESPN flips its own default (their own player page does the same: it opens on the
// previous season until you pick the new one). So we ask for the current season by
// name first, and only fall back to ESPN's default if that answer has no games
// (for example a player who has not played yet this season).
//
// ESPN names a season by the year it ends in: 2026-27 is season 2027.

const BASE = (id: number) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/gamelog`;

export function currentSeasonYear(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now);
  const year = Number(parts.find(p => p.type === 'year')?.value);
  const month = Number(parts.find(p => p.type === 'month')?.value);
  // A new season is under way from the autumn on (preseason starts in early October).
  return month >= 8 ? year + 1 : year;
}

function hasGames(json: unknown): boolean {
  const events = (json as { events?: Record<string, unknown> } | null)?.events;
  return !!events && Object.keys(events).length > 0;
}

export async function fetchGamelog(id: number, init: RequestInit = {}): Promise<Response> {
  try {
    const res = await fetch(`${BASE(id)}?season=${currentSeasonYear()}`, init);
    if (res.ok) {
      const json = await res.clone().json().catch(() => null);
      if (hasGames(json)) return res;
    }
  } catch {
    // fall through to ESPN's default answer
  }
  return fetch(BASE(id), init);
}
