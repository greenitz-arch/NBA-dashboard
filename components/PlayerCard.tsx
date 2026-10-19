'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { GameStats } from '@/lib/nba';
import type { WatchlistPlayer } from '@/lib/storage';
import { getProminentStats, type DisplayStat } from '@/lib/prominence';
import { getPlayerHeadshotUrl, getEspnHeadshotUrl, hasNbaHeadshot } from '@/lib/nba';
import { useTutorial } from './TutorialGuide';
import { STATUS_COLOR, STATUS_LABEL, type PlayerFantasy } from '@/lib/fantasy';
import { FlameIcon, SnowflakeIcon } from './FantasyPanels';
import { MSG } from '@/lib/messages';

interface PlayerCardProps {
  player: WatchlistPlayer;
  stats: GameStats | null;
  loading?: boolean;
  onRemove: (id: number) => void;
  fantasyOn?: boolean;
  fantasy?: PlayerFantasy | null;
  hideResult?: boolean; // "No spoilers": hide the W / L of the last game
  failed?: boolean; // this player's stats could not be loaded
  noGame?: boolean; // loaded fine, but the player has not played a game yet
  severalFailed?: boolean; // many cards failed together: the page shows one banner instead
  onRetry?: () => void;
  onCompare?: () => void; // starts / cancels picking this player for a comparison
  compareSelected?: boolean;
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

// Shown in place of the numbers while stats load: the photo, name and team are already there.
function StatsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading stats">
      <div className="shimmer h-3 w-24 rounded mb-3" />
      <div className="flex gap-1.5">
        {[1, 2, 3].map(i => <div key={i} className="shimmer h-12 w-12 rounded-md" />)}
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

export default function PlayerCard({ player, stats, loading, onRemove, fantasyOn = false, fantasy = null, hideResult = false, failed = false, noGame = false, severalFailed = false, onRetry, onCompare, compareSelected = false }: PlayerCardProps) {
  const [imgError, setImgError] = useState(false);
  const [useEspnPhoto, setUseEspnPhoto] = useState(false);
  const [removing, setRemoving] = useState(false);
  const tutorial = useTutorial();
  const showRemoveHint = tutorial.showRemoveHint && tutorial.hintPlayerId === player.id;

  const displayStats = stats ? getProminentStats(stats) : [];
  const hasNbaPhoto = hasNbaHeadshot(player);
  const headshotUrl = hasNbaPhoto && !useEspnPhoto
    ? getPlayerHeadshotUrl(player)
    : getEspnHeadshotUrl(player.id);
  // If the NBA.com photo fails to load, try ESPN's before showing initials.
  const handleImgError = () => {
    if (hasNbaPhoto && !useEspnPhoto) setUseEspnPhoto(true);
    else setImgError(true);
  };

  const fStatus = fantasyOn ? fantasy?.status ?? null : null;
  const isOut = fStatus === 'out';

  const handleRemove = () => {
    setRemoving(true);
    setTimeout(() => onRemove(player.id), 280);
  };

  return (
    <div
      className="group relative card-hover-glow rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02]"
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        opacity: removing ? 0 : isOut ? 0.55 : 1,
        filter: isOut ? 'grayscale(1)' : undefined,
        transform: removing ? 'scale(0.95)' : undefined,
        transition: 'all 0.28s ease',
      }}
    >
      {/* Remove button — hover on desktop, always visible on mobile.
          Right after the tutorial finishes, it's forced visible and given a
          4-second pulsing ring on the just-added player's card so first-time
          visitors notice they can always remove a player. */}
      <button
        onClick={handleRemove}
        className={`remove-btn absolute top-2 right-2 z-20 w-6 h-6 rounded-full flex items-center justify-center transition-opacity duration-200 ${showRemoveHint ? '' : 'opacity-0 group-hover:opacity-100'}`}
        style={{
          background: 'var(--color-remove-btn)',
          border: '1px solid var(--color-remove-border)',
          opacity: showRemoveHint ? 1 : undefined,
          boxShadow: showRemoveHint ? '0 0 0 3px rgba(255,107,43,0.35)' : undefined,
          animation: showRemoveHint ? 'tutorialPulseRing 1.3s ease-in-out infinite' : undefined,
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
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--skin-primary)', opacity: 0.5 }} />
        <span
          className="absolute top-2 left-2 font-display font-800 uppercase select-none pointer-events-none leading-none"
          style={{ color: 'var(--color-watermark)', fontSize: '4rem' }}
        >
          {player.team_abbreviation}
        </span>
        {fStatus && (
          <div
            className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full px-2 py-1"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            title={fantasy?.statusNote || STATUS_LABEL[fStatus]}
          >
            <span className="rounded-full" style={{ width: 9, height: 9, background: STATUS_COLOR[fStatus] }} />
            {fStatus !== 'healthy' && (
              <span className="font-mono text-[9px] uppercase tracking-wider text-white">{STATUS_LABEL[fStatus]}</span>
            )}
          </div>
        )}
        {!imgError ? (
          <Image
            key={headshotUrl}
            src={headshotUrl}
            alt={`${player.first_name} ${player.last_name}`}
            fill
            className="object-contain object-bottom"
            onError={handleImgError}
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
            <span style={{ color: 'var(--skin-primary)' }}>{player.last_name}</span>
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
              {!hideResult && (
                <span className={`font-mono text-[10px] font-700 uppercase ${stats.outcome === 'W' ? 'text-win' : 'text-loss'}`}>
                  {stats.outcome}
                </span>
              )}
              <span className="font-mono text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                {formatGameDate(stats.gameDate)}
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <StatsSkeleton />
        ) : displayStats.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {displayStats.map(stat => <StatPill key={stat.key} stat={stat} />)}
          </div>
        ) : failed ? (
          severalFailed ? (
            <p className="font-mono text-[9px] uppercase tracking-widest py-3 text-center"
              style={{ color: 'var(--color-text-tertiary)' }}>
              Stats unavailable
            </p>
          ) : (
            <div className="py-2 text-center" role="alert">
              <p className="font-body text-[11px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                {MSG.playerStatsFailed(player.last_name)}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-2 px-3 py-1 rounded-lg font-mono text-[9px] uppercase tracking-wider"
                  style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  {MSG.tryAgain}
                </button>
              )}
            </div>
          )
        ) : noGame ? (
          <p className="font-body text-[11px] leading-snug py-2 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            {MSG.notPlayedYet}
          </p>
        ) : (
          <p className="font-mono text-[9px] uppercase tracking-widest py-3 text-center"
            style={{ color: 'var(--color-text-tertiary)' }}>
            No recent game data
          </p>
        )}

        {/* Fantasy mode: value score + hot/cold badge */}
        {fantasyOn && (
          <div
            className="flex items-center justify-between mt-2.5 pt-2.5"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            {fantasy?.value != null ? (
              <span
                className="font-mono text-[10px] uppercase tracking-widest rounded-full px-2 py-1"
                style={{ background: 'rgba(var(--skin-primary-rgb),0.15)', color: 'var(--color-text-primary)' }}
                title={fantasy.basis === 'preseason' ? 'Based on preseason games' : 'Fantasy value, 50 is a typical starter'}
              >
                Value {fantasy.value}
              </span>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: 'var(--color-text-tertiary)' }}>
                Waiting for games
              </span>
            )}
            {fantasy?.form === 'hot' && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: '#ff8d5c' }}>
                <FlameIcon size={13} /> Hot
              </span>
            )}
            {fantasy?.form === 'cold' && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest" style={{ color: '#7cb8ec' }}>
                <SnowflakeIcon size={13} /> Cold
              </span>
            )}
          </div>
        )}

        {/* Compare with another player */}
        {onCompare && (
          <button
            onClick={onCompare}
            aria-pressed={compareSelected}
            className="w-full mt-2.5 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wider inline-flex items-center justify-center gap-1.5 transition-colors"
            style={compareSelected
              ? { background: 'var(--neon-orange)', border: '1px solid var(--neon-orange)', color: '#fff' }
              : { border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 4L3 8l4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" />
            </svg>
            {compareSelected ? 'Selected' : 'Compare'}
          </button>
        )}
      </div>
    </div>
  );
}
