'use client';

import { useState } from 'react';
import { getPlayerHeadshotUrl, getEspnHeadshotUrl, hasNbaHeadshot } from '@/lib/nba';
import { findTeam } from '@/lib/teams';

// Small visual pieces used by the "Add players" dialog:
//   <TeamLogo>     team logo next to a team name
//   <PlayerAvatar> small round player photo next to a player name
// Both fall back gracefully (team-colour circle / initials) if an image
// can't be loaded, so a broken image never shows up in the list.

// ESPN's logo files use their own short names for a few teams.
const ESPN_LOGO_SLUG: Record<string, string> = {
  GSW: 'gs', NOP: 'no', NYK: 'ny', SAS: 'sa', UTA: 'utah', WAS: 'wsh',
};

function logoUrls(abbr: string): string[] {
  const urls = [ESPN_LOGO_SLUG[abbr], abbr.toLowerCase()]
    .filter((s): s is string => !!s)
    .map(s => `https://a.espncdn.com/i/teamlogos/nba/500/${s}.png`);
  return Array.from(new Set(urls));
}

export function TeamLogo({ abbr, size = 30 }: { abbr: string; size?: number }) {
  const urls = logoUrls(abbr);
  const [idx, setIdx] = useState(0);
  const team = findTeam(abbr);

  const circle: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  };

  if (idx >= urls.length) {
    return (
      <span aria-hidden="true" style={{
        ...circle,
        background: team?.primary ?? '#444',
        color: '#fff', fontSize: Math.max(8, Math.round(size * 0.32)), fontWeight: 600,
      }}>
        {abbr}
      </span>
    );
  }

  // White chip so dark logos (Nets, Spurs) stay visible in dark mode.
  return (
    <span aria-hidden="true" style={{ ...circle, background: 'rgba(255,255,255,0.92)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={urls[idx]}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setIdx(i => i + 1)}
        style={{ width: size * 0.78, height: size * 0.78, objectFit: 'contain' }}
      />
    </span>
  );
}

interface AvatarPlayer { id: number; first_name: string; last_name: string }

export function PlayerAvatar({ player, size = 36 }: { player: AvatarPlayer; size?: number }) {
  // Same photo sources as the player cards: NBA.com first, then ESPN, then initials.
  const urls = hasNbaHeadshot(player)
    ? [getPlayerHeadshotUrl(player), getEspnHeadshotUrl(player.id)]
    : [getEspnHeadshotUrl(player.id)];
  const [idx, setIdx] = useState(0);
  const src = idx < urls.length ? urls[idx] : null;
  const initials = `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`.toUpperCase();

  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative', display: 'inline-block', flexShrink: 0,
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        background: 'var(--color-card)', border: '1px solid var(--color-border)',
      }}
    >
      {src ? (
        // The photos are wide head-and-shoulders shots: scale up and crop to the face.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setIdx(i => i + 1)}
          style={{
            position: 'absolute', top: 0, left: '50%',
            height: size * 1.55, width: 'auto', maxWidth: 'none',
            transform: 'translateX(-50%)',
          }}
        />
      ) : (
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: Math.round(size * 0.34), fontWeight: 600, color: 'var(--color-text-secondary)',
        }}>
          {initials}
        </span>
      )}
    </span>
  );
}
