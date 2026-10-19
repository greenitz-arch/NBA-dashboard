// lib/shareLink.ts
// Share-by-link: a team is packed into the link itself, so nothing is stored on a server.
// Link looks like  https://<site>/?share=<token>

import { NBA_TEAMS } from './nba';
import type { WatchlistPlayer } from './storage';

const MAX_PLAYERS = 15;
const MAX_TEXT = 40;

export interface SharedTeam {
  name: string;
  players: WatchlistPlayer[];
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(token: string): string {
  const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function buildShareUrl(teamName: string, players: WatchlistPlayer[]): string {
  const payload = {
    v: 1,
    n: teamName.slice(0, MAX_TEXT),
    p: players.slice(0, MAX_PLAYERS).map(p => [p.id, p.first_name, p.last_name, p.position, p.team_abbreviation]),
  };
  return `${window.location.origin}/?share=${toBase64Url(JSON.stringify(payload))}`;
}

// Plain text only: no angle brackets or control characters, and not too long.
const str = (v: unknown, max = MAX_TEXT): string | null =>
  typeof v === 'string' && v.length <= max ? v.replace(/[<>\u0000-\u001f]/g, '') : null;

// Returns null when the link is damaged or does not look like a Courtside team.
export function parseShareToken(token: string): SharedTeam | null {
  try {
    if (!token || token.length > 4000) return null;
    const data = JSON.parse(fromBase64Url(token));
    if (!data || data.v !== 1 || !Array.isArray(data.p)) return null;
    const name = (str(data.n) ?? '').trim() || 'Shared team';
    const players: WatchlistPlayer[] = [];
    for (const row of data.p.slice(0, MAX_PLAYERS)) {
      if (!Array.isArray(row)) continue;
      const [id, first, last, position, abbr] = row;
      const f = str(first);
      const l = str(last);
      const pos = str(position, 6) ?? '';
      const team = NBA_TEAMS.find(t => t.abbreviation === abbr);
      if (!Number.isInteger(id) || id <= 0 || id > 1e9 || !f || !l || !team) continue;
      if (players.some(p => p.id === id)) continue;
      players.push({
        id,
        first_name: f,
        last_name: l,
        position: pos,
        team_id: team.id,
        team_abbreviation: team.abbreviation,
        team_full_name: team.full_name,
        added_at: Date.now(),
      });
    }
    return players.length > 0 ? { name, players } : null;
  } catch {
    return null;
  }
}
