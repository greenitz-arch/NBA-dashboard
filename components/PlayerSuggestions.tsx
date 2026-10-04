'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { Player, Team } from '@/lib/nba';
import { NBA_TEAMS, getPlayerHeadshotUrl, getEspnHeadshotUrl, hasNbaHeadshot } from '@/lib/nba';
import { ESPN_TOP_100_NAMES } from '@/lib/espnTop100';

// ─────────────────────────────────────────────────────────────────────────
// "Draft night starts here" — 4 random players from ESPN's top 100, shown on
// the empty landing page under Mr. Linea's trail line.
//
// How it works:
//  - On load, the visitor's own browser reads the 30 team rosters from ESPN
//    (same approach as PlayerSelector — ESPN blocks Netlify's servers but
//    allows visitors' browsers) and keeps only the players on our top-100
//    list. That gives each player's real ESPN ID and CURRENT team, so trades
//    never leave a stale card.
//  - It then picks 4 at random. The pick happens in the browser after the
//    page loads, so every visitor / every page load gets a different grid.
// ─────────────────────────────────────────────────────────────────────────

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const HOW_MANY = 4;

type EspnAthlete = {
  id: string;
  displayName: string;
  position?: { abbreviation: string };
  jersey?: string;
};

// Makes "Nikola Jokić", "A.J. Dybantsa", "Trey Murphy III" comparable to the
// plain spellings in the list: no accents, dots, hyphens or Jr./III endings.
function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+(jr|sr|ii|iii|iv)$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPlayer(a: EspnAthlete, team: Team): Player {
  const parts = a.displayName.split(' ');
  return {
    id: Number(a.id),
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' '),
    position: a.position?.abbreviation ?? '',
    jersey_number: a.jersey ?? '',
    team,
  };
}

// Loaded once per page visit and shared, so React's dev-mode double render
// (or a remount) doesn't fetch all 30 rosters twice.
let top100Cache: Promise<Player[]> | null = null;

function loadTop100Players(): Promise<Player[]> {
  if (!top100Cache) {
    const wanted = new Set(ESPN_TOP_100_NAMES.map(normalize));
    top100Cache = Promise.allSettled(
      NBA_TEAMS.map(async team => {
        const res = await fetch(`${ESPN_BASE}/teams/${team.espnId}/roster`);
        if (!res.ok) throw new Error(`ESPN roster error ${res.status}`);
        const data = await res.json() as { athletes?: EspnAthlete[] };
        return (data.athletes ?? [])
          .filter(a => wanted.has(normalize(a.displayName)))
          .map(a => toPlayer(a, team));
      })
    ).then(results => {
      const byId = new Map<number, Player>();
      for (const r of results) {
        if (r.status === 'fulfilled') r.value.forEach(p => byId.set(p.id, p));
      }
      const found = Array.from(byId.values());
      if (found.length === 0) top100Cache = null; // nothing loaded — allow a retry next time
      return found;
    });
  }
  return top100Cache;
}

function pickRandom<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

interface PlayerSuggestionsProps {
  onAdd: (player: Player) => void;
  /** Wait this long before showing the grid (used to let the trail line finish drawing). */
  revealAfterMs?: number;
}

function SuggestionCard({ player, onAdd }: { player: Player; onAdd: (p: Player) => void }) {
  const [imgError, setImgError] = useState(false);
  const [useEspnPhoto, setUseEspnPhoto] = useState(false);
  const fullName = `${player.first_name} ${player.last_name}`;
  const hasNbaPhoto = hasNbaHeadshot(player);
  const photoUrl = hasNbaPhoto && !useEspnPhoto
    ? getPlayerHeadshotUrl(player)
    : getEspnHeadshotUrl(player.id);
  // If the NBA.com photo fails to load, try ESPN's before showing initials.
  const handleImgError = () => {
    if (hasNbaPhoto && !useEspnPhoto) setUseEspnPhoto(true);
    else setImgError(true);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="relative h-32 overflow-hidden" style={{ background: 'var(--color-photo-bg)' }}>
        <div className="noise-overlay" />
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--skin-primary)', opacity: 0.5 }} />
        <span
          className="absolute top-2 left-2 font-display font-800 uppercase select-none pointer-events-none leading-none"
          style={{ color: 'var(--color-watermark)', fontSize: '3.5rem' }}
        >
          {player.team.abbreviation}
        </span>
        <span
          className="absolute top-2 right-2 z-10 flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest"
          style={{ color: 'var(--skin-primary)' }}
        >
          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
            <polygon points="12 2 15.1 8.6 22 9.3 16.8 14 18.2 21 12 17.5 5.8 21 7.2 14 2 9.3 8.9 8.6" />
          </svg>
          Top 100
        </span>
        {!imgError ? (
          <Image
            key={photoUrl}
            src={photoUrl}
            alt={fullName}
            fill
            className="object-contain object-bottom"
            onError={handleImgError}
            sizes="220px"
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-initials-bg)', border: '2px solid var(--color-initials-border)' }}
            >
              <span className="font-display font-700 text-lg uppercase" style={{ color: 'var(--color-initials-text)' }}>
                {player.first_name[0]}{player.last_name[0]}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-3">
        <h4
          className="font-display font-700 text-base uppercase tracking-wide leading-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {player.first_name}{' '}
          <span style={{ color: 'var(--skin-primary)' }}>{player.last_name}</span>
        </h4>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
            {player.team.abbreviation}
          </span>
          {player.position && (
            <>
              <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
              <span className="font-mono text-[9px] uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                {player.position}
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => onAdd(player)}
          aria-label={`Add ${fullName} to your roster`}
          className="suggest-add-btn mt-3 w-full py-2 rounded-lg font-display font-700 uppercase tracking-wider text-sm"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

export default function PlayerSuggestions({ onAdd, revealAfterMs = 0 }: PlayerSuggestionsProps) {
  const [picks, setPicks] = useState<Player[] | null>(null);
  const [visible, setVisible] = useState(revealAfterMs <= 0);

  useEffect(() => {
    let cancelled = false;
    loadTop100Players().then(all => {
      if (!cancelled) setPicks(pickRandom(all, HOW_MANY));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (revealAfterMs <= 0) return;
    const t = setTimeout(() => setVisible(true), revealAfterMs);
    return () => clearTimeout(t);
  }, [revealAfterMs]);

  // Nothing to show (still loading, offline, or ESPN unreachable) — stay quiet
  // rather than showing an error on the landing page.
  if (!visible || !picks || picks.length === 0) return null;

  return (
    <section aria-labelledby="draft-night-title" className="mt-6 mb-10 animate-fade-up">
      <h3
        id="draft-night-title"
        className="font-display font-800 uppercase tracking-wide text-center leading-tight"
        style={{ color: 'var(--color-text-primary)', fontSize: 'clamp(1.6rem, 3.5vw, 2.1rem)' }}
      >
        Draft night{' '}
        <span style={{ color: 'var(--skin-primary)', WebkitTextStroke: '2px #000', paintOrder: 'stroke fill' }}>
          starts here
        </span>
      </h3>
      <p
        className="font-mono text-xs text-center mt-1 mb-5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {picks.length} random player{picks.length === 1 ? '' : 's'} from ESPN&apos;s top 100. Tap Add to pick them for your roster.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {picks.map(p => (
          <SuggestionCard key={p.id} player={p} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}
