'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { GameStats } from '@/lib/nba';
import type { WatchlistPlayer } from '@/lib/useWatchlist';
import { getProminentStats, type DisplayStat } from '@/lib/prominence';
import { getPlayerHeadshotUrl } from '@/lib/nba';

interface PlayerCardProps {
  player: WatchlistPlayer;
  stats: GameStats | null;
  loading?: boolean;
  onRemove: (id: number) => void;
}

function StatPill({ stat }: { stat: DisplayStat }) {
  const cls =
    stat.isNegative ? 'stat-negative' :
    stat.prominence === 'hero' ? 'stat-hero' :
    stat.prominence === 'highlight' ? 'stat-highlight' :
    'stat-standard';

  return (
    <div className={`${cls} rounded-md px-2.5 py-1.5 flex flex-col items-center gap-0.5 min-w-[48px]`}>
      <span
        className="font-display font-700 leading-none"
        style={{ fontSize: stat.prominence === 'hero' ? '1.5rem' : stat.prominence === 'highlight' ? '1.15rem' : '0.95rem' }}
      >
        {stat.value}
      </span>
      <span className="font-mono text-[8px] uppercase tracking-widest opacity-70">{stat.label}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}>
      <div className="shimmer h-36 w-full" />
      <div className="p-3 space-y-2">
        <div className="shimmer h-4 w-28 rounded" />
        <div className="shimmer h-3 w-16 rounded" />
        <div className="flex gap-1.5 mt-3">
          {[1,2,3].map(i => <div key={i} className="shimmer h-12 w-12 rounded-md" />)}
        </div>
      </div>
    </div>
  );
}

function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Last night';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export default function PlayerCard({ player, stats, loading, onRemove }: PlayerCardProps) {
  const [imgError, setImgError] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (loading) return <SkeletonCard />;

  const displayStats = stats ? getProminentStats(stats) : [];
  const headshotUrl = getPlayerHeadshotUrl(player.id);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(player.id), 280);
  };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        opacity: removing ? 0 : 1,
        transform: removing ? 'scale(0.95)' : undefined,
        transition: 'all 0.28s ease',
      }}
    >
      {/* Remove button — hover on desktop, always visible on mobile */}
      <button
        onClick={handleRemove}
        className="remove-btn absolute top-2 right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{
          background: 'var(--color-remove-btn)',
          border: '1px solid var(--color-remove-border)',
        }}
        title="Remove from roster"
      >
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none"
          stroke="var(--color-text-primary)" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      {/* Photo */}
      <div
        className="relative h-36 overflow-hidden"
        style={{ background: 'var(--color-photo-bg)' }}
      >
        <div className="noise-overlay" />
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--neon-orange)', opacity: 0.5 }} />
        <span
          className="absolute top-2 left-2 font-display font-800 uppercase select-none pointer-events-none leading-none"
          style={{ color: 'var(--color-watermark)', fontSize: '4rem' }}
        >
          {player.team_abbreviation}
        </span>
        {!imgError ? (
          <Image
            src={headshotUrl}
            alt={`${player.first_name} ${player.last_name}`}
            fill
            className="object-contain object-bottom"
            onError={() => setImgError(true)}
            sizes="220px"
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-initials-bg)', border: '2px solid var(--color-initials-border)' }}
            >
              <span className="font-display font-700 text-xl uppercase" style={{ color: 'var(--color-initials-text)' }}>
                {player.first_name[0]}{player.last_name[0]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="mb-2">
          <h3
            className="font-display font-700 text-base uppercase tracking-wide leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {player.first_name}{' '}
            <span style={{ color: 'var(--neon-orange)' }}>{player.last_name}</span>
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
              {player.team_abbreviation}
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
        </div>

        {/* Game context */}
        {stats && (
          <div
            className="flex items-center justify-between mb-2 pb-2"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="font-mono text-[10px] uppercase tracking-widest font-500" style={{ color: 'var(--color-text-primary)', opacity: 0.7 }}>
              {stats.isHome ? 'vs' : '@'} {stats.opponentAbbr}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`font-mono text-[10px] font-700 uppercase ${stats.outcome === 'W' ? 'text-win' : 'text-loss'}`}>
                {stats.outcome}
              </span>
              <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                {formatGameDate(stats.gameDate)}
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        {displayStats.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {displayStats.map(stat => <StatPill key={stat.key} stat={stat} />)}
          </div>
        ) : (
          <p className="font-mono text-[9px] uppercase tracking-widest py-3 text-center"
            style={{ color: 'var(--color-text-tertiary)' }}>
            No recent game data
          </p>
        )}
      </div>
    </div>
  );
}
