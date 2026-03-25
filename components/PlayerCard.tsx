// components/PlayerCard.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { GameStats } from '@/lib/balldontlie';
import type { WatchlistPlayer } from '@/lib/useWatchlist';
import { getProminentStats, type DisplayStat } from '@/lib/prominence';
import { getPlayerHeadshotUrl } from '@/lib/balldontlie';

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
    <div className={`${cls} rounded-md px-2.5 py-1.5 flex flex-col items-center gap-0.5 min-w-[52px]`}>
      <span
        className="font-display font-700 leading-none"
        style={{ fontSize: stat.prominence === 'hero' ? '1.6rem' : stat.prominence === 'highlight' ? '1.25rem' : '1rem' }}
      >
        {stat.value}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-widest opacity-70">{stat.label}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
      <div className="shimmer h-48 w-full" />
      <div className="p-4 space-y-3">
        <div className="shimmer h-5 w-32 rounded" />
        <div className="shimmer h-3 w-20 rounded" />
        <div className="flex gap-2 mt-4">
          {[1,2,3].map(i => <div key={i} className="shimmer h-14 w-14 rounded-md" />)}
        </div>
      </div>
    </div>
  );
}

function formatGameDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Last night';

  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function getOpponent(stats: GameStats): { abbr: string; isHome: boolean; score: string } {
  const isHome = stats.team.id === stats.game.home_team.id;
  const opponent = isHome ? stats.game.visitor_team : stats.game.home_team;
  const myScore = isHome ? stats.game.home_team_score : stats.game.visitor_team_score;
  const theirScore = isHome ? stats.game.visitor_team_score : stats.game.home_team_score;
  const won = myScore > theirScore;
  return {
    abbr: opponent.abbreviation,
    isHome,
    score: `${won ? 'W' : 'L'} ${myScore}–${theirScore}`,
  };
}

export default function PlayerCard({ player, stats, loading, onRemove }: PlayerCardProps) {
  const [imgError, setImgError] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (loading) return <SkeletonCard />;

  const displayStats = stats ? getProminentStats(stats) : [];
  const opponent = stats ? getOpponent(stats) : null;
  const headshotUrl = getPlayerHeadshotUrl(player.id);

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(player.id), 300);
  };

  return (
    <div
      className="group relative rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
      style={{
        background: 'var(--color-card)',
        borderColor: removing ? 'transparent' : 'var(--color-border)',
        opacity: removing ? 0 : 1,
        transform: removing ? 'scale(0.95)' : undefined,
        transition: 'all 0.3s ease',
      }}
    >
      {/* Remove button */}
      <button
        onClick={handleRemove}
        className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
        title="Remove from watchlist"
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-white" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>

      {/* Player photo area */}
      <div className="relative h-48 overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #1a1a28 0%, #0f0f1a 100%)' }}>
        <div className="noise-overlay" />

        {/* Team color accent bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: 'var(--neon-orange)', opacity: 0.6 }} />

        {/* Team abbreviation watermark */}
        <span className="absolute top-3 left-4 font-display font-800 text-5xl uppercase tracking-tighter select-none pointer-events-none"
          style={{ color: 'rgba(255,255,255,0.04)', fontSize: '5rem', lineHeight: 1 }}>
          {player.team_abbreviation}
        </span>

        {/* Headshot */}
        {!imgError ? (
          <Image
            src={headshotUrl}
            alt={`${player.first_name} ${player.last_name}`}
            fill
            className="object-contain object-bottom"
            onError={() => setImgError(true)}
            sizes="(max-width: 768px) 100vw, 300px"
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <div className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.08)' }}>
              <span className="font-display font-700 text-3xl text-white/40 uppercase">
                {player.first_name[0]}{player.last_name[0]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Name + team */}
        <div className="mb-3">
          <h3 className="font-display font-700 text-xl uppercase tracking-wide leading-tight text-white">
            {player.first_name} <span style={{ color: 'var(--neon-orange)' }}>{player.last_name}</span>
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
              {player.team_abbreviation}
            </span>
            {player.position && (
              <>
                <span style={{ color: 'var(--color-text-tertiary)' }}>·</span>
                <span className="font-mono text-xs uppercase" style={{ color: 'var(--color-text-secondary)' }}>
                  {player.position}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Game context */}
        {stats && opponent && (
          <div className="flex items-center justify-between mb-3 pb-3"
            style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest"
                style={{ color: 'var(--color-text-secondary)' }}>
                {opponent.isHome ? 'vs' : '@'} {opponent.abbr}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-[10px] font-500 uppercase tracking-wider ${
                opponent.score.startsWith('W') ? 'text-green-400' : 'text-red-400'
              }`}>
                {opponent.score}
              </span>
              <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                {formatGameDate(stats.game.date)}
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        {displayStats.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {displayStats.map(stat => (
              <StatPill key={stat.key} stat={stat} />
            ))}
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="font-mono text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
              No recent game data
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
