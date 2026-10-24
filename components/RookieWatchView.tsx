'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import ConfirmDialog from './ConfirmDialog';
import RookieWatchPill from './RookieWatchPill';
import {
  NBA_TEAMS,
  getEspnHeadshotUrl,
  getPlayerHeadshotUrl,
  hasNbaHeadshot,
  type Player,
} from '@/lib/nba';
import {
  ROOKIE_MSG,
  MIN_MINUTES_LAST_NIGHT,
  TOP_N,
  buildLastNight,
  buildTop15,
  loadRookieDataset,
  oneDecimal,
  shortDate,
  type Rookie,
  type RookieDataset,
  type RookieGame,
} from '@/lib/rookieWatch';

interface RookieWatchViewProps {
  rosterIds: number[];                 // players already on the roster being viewed
  onAdd: (player: Player) => void;     // the same add-a-player step the rest of the app uses
  onExit: () => void;
  noSpoilers: boolean;                 // when on, a confirm popup comes first
}

type Board = 'night' | 'top';
type Tone = 'great' | 'good' | 'plain' | 'season';

interface TileData {
  key: number;
  rank: number;
  rookie: Rookie;
  badge: string;
  tone: Tone;
  extra: string[];            // small lines under the team (Top 15 only)
  game: RookieGame;           // the game whose numbers are shown
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

function badgeStyle(tone: Tone): React.CSSProperties {
  if (tone === 'great') return { background: 'rgba(74,222,128,0.18)', color: '#4ade80' };
  if (tone === 'good') return { background: 'rgba(255,107,43,0.18)', color: 'var(--neon-orange)' };
  if (tone === 'season') return { background: 'rgba(var(--skin-primary-rgb),0.18)', color: 'var(--skin-primary)' };
  return { background: 'var(--color-stat-std-bg)', color: 'var(--color-stat-std-text)' };
}

function toPlayer(r: Rookie): Player | null {
  const team = NBA_TEAMS.find(t => t.espnId === r.espnTeamId);
  if (!team) return null;
  return { id: r.id, first_name: r.first, last_name: r.last, position: r.pos, jersey_number: '', team };
}

function RookieTile({
  tile, onRoster, onAdd,
}: { tile: TileData; onRoster: boolean; onAdd: (r: Rookie) => void }) {
  const { rookie: r, game: g } = tile;
  const [imgError, setImgError] = useState(false);
  const [useEspn, setUseEspn] = useState(false);

  const photoPlayer = { id: r.id, first_name: r.first, last_name: r.last };
  const hasNba = hasNbaHeadshot(photoPlayer);
  const url = hasNba && !useEspn ? getPlayerHeadshotUrl(photoPlayer) : getEspnHeadshotUrl(r.id);
  const onImgError = () => {
    if (hasNba && !useEspn) setUseEspn(true);
    else setImgError(true);
  };

  const stats: Array<[number, string]> = [[g.pts, 'PTS'], [g.reb, 'REB'], [g.ast, 'AST'], [g.stl, 'STL']];
  const fullName = `${r.first} ${r.last}`.trim();

  return (
    <div
      className="rounded-xl overflow-hidden flex flex-col min-w-0"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      {/* Photo + rank */}
      <div className="relative h-14 sm:h-28 overflow-hidden" style={{ background: 'var(--color-photo-bg)' }}>
        <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--skin-primary)', opacity: 0.5 }} />
        <span
          className="absolute top-1 left-1 z-10 rounded-full font-mono font-700 leading-none px-1.5 py-[3px] text-[9px] sm:text-[11px]"
          style={tile.rank <= 3
            ? { background: 'var(--neon-orange)', color: '#fff' }
            : { background: 'rgba(0,0,0,0.55)', color: '#fff' }}
        >
          #{tile.rank}
        </span>
        {!imgError ? (
          <Image
            key={url}
            src={url}
            alt={fullName}
            fill
            className="object-contain object-bottom"
            onError={onImgError}
            sizes="(max-width: 640px) 70px, 200px"
          />
        ) : (
          <div className="absolute inset-0 flex items-end justify-center pb-1">
            <div
              className="w-8 h-8 sm:w-14 sm:h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--color-initials-bg)', border: '2px solid var(--color-initials-border)' }}
            >
              <span className="font-display font-700 text-xs sm:text-lg uppercase" style={{ color: 'var(--color-initials-text)' }}>
                {r.first[0]}{r.last[0]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-1 sm:p-2.5 flex flex-col items-center gap-1 sm:gap-1.5 text-center flex-1">
        <span
          className="w-full rounded-md font-display font-700 leading-none py-1 text-[13px] sm:text-xl"
          style={badgeStyle(tile.tone)}
        >
          {tile.badge}
        </span>

        <div className="w-full min-w-0">
          <div
            className="font-display font-700 uppercase tracking-wide leading-tight text-[9px] sm:text-sm break-words"
            style={{ color: 'var(--color-text-primary)' }}
          >
            <span className="sm:hidden">{r.first[0]}.</span>
            <span className="hidden sm:inline">{r.first}</span>{' '}
            <span style={{ color: 'var(--skin-primary)' }}>{r.last}</span>
          </div>
          <div className="font-mono uppercase tracking-widest text-[8px] sm:text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            {r.teamAbbr}{r.pos ? ` · ${r.pos}` : ''}
          </div>
        </div>

        {tile.extra.length > 0 && (
          <div className="font-mono leading-snug text-[8px] sm:text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            {tile.extra.map(line => <div key={line}>{line}</div>)}
          </div>
        )}

        <div className="w-full flex flex-col gap-[3px] mt-auto">
          {stats.map(([v, label]) => (
            <div
              key={label}
              className="w-full rounded-md flex items-baseline justify-center gap-0.5 py-0.5"
              style={{ background: 'var(--color-stat-std-bg)', border: '1px solid var(--color-stat-std-border)', color: 'var(--color-stat-std-text)' }}
            >
              <span className="font-display font-700 text-[11px] sm:text-sm leading-none">{v}</span>
              <span className="font-mono uppercase opacity-70 text-[7px] sm:text-[9px]">{label}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={onRoster}
          onClick={() => onAdd(r)}
          aria-label={onRoster ? `${fullName} is on your roster` : `Add ${fullName} to roster`}
          className="w-full rounded-md py-1 sm:py-1.5 font-mono uppercase tracking-wider text-[10px] sm:text-[10px] inline-flex items-center justify-center gap-1"
          style={onRoster
            ? { border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'default' }
            : { border: '1px solid var(--skin-primary)', color: 'var(--color-text-primary)' }}
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {onRoster ? <path d="M5 12l5 5L20 7" /> : <path d="M12 5v14M5 12h14" />}
          </svg>
          <span className="hidden sm:inline">{onRoster ? 'On your roster' : 'Add to roster'}</span>
        </button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5" aria-hidden="true">
      {Array.from({ length: TOP_N }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl shimmer h-48 sm:h-80"
          style={{ border: '1px solid var(--color-border)' }}
        />
      ))}
    </div>
  );
}

// ─── The screen ───────────────────────────────────────────────────────────────

export default function RookieWatchView({ rosterIds, onAdd, onExit, noSpoilers }: RookieWatchViewProps) {
  const [board, setBoard] = useState<Board>('night');
  const [confirmed, setConfirmed] = useState(!noSpoilers);
  const [dataset, setDataset] = useState<RookieDataset | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorKind, setErrorKind] = useState<'roster' | 'stats' | 'other'>('other');
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [justAdded, setJustAdded] = useState<number[]>([]);
  const [attempt, setAttempt] = useState(0);

  // Load the boards once the No Spoilers question (if any) is answered.
  useEffect(() => {
    if (!confirmed) return;
    let cancelled = false;
    setStatus('loading');
    loadRookieDataset({
      force: attempt > 0,
      onProgress: (done, total) => { if (!cancelled) setProgress([done, total]); },
    })
      .then(({ dataset: ds }) => {
        if (cancelled) return;
        setDataset(ds);
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const kind = (e as { kind?: string })?.kind;
        setErrorKind(kind === 'roster' ? 'roster' : kind === 'stats' ? 'stats' : 'other');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [confirmed, attempt]);

  // Esc closes the screen (the confirm popup handles Esc by itself).
  useEffect(() => {
    if (!confirmed) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onExit(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmed, onExit]);

  const night = useMemo(() => (dataset ? buildLastNight(dataset) : null), [dataset]);
  const top = useMemo(() => (dataset ? buildTop15(dataset) : []), [dataset]);

  const tiles: TileData[] = useMemo(() => {
    if (board === 'night') {
      return (night?.entries ?? []).map((e, i) => ({
        key: e.rookie.id,
        rank: i + 1,
        rookie: e.rookie,
        badge: oneDecimal(e.gameScore),
        tone: e.gameScore >= 20 ? 'great' : e.gameScore >= 10 ? 'good' : 'plain',
        extra: [],
        game: e.game,
      }));
    }
    return top.map((e, i) => ({
      key: e.rookie.id,
      rank: i + 1,
      rookie: e.rookie,
      badge: oneDecimal(e.rating),
      tone: 'season' as Tone,
      extra: [
        `Avg ${oneDecimal(e.avg)}`,
        `${e.played}/${e.teamGames} played`,
        `${shortDate(e.lastGame.date)} ${e.lastGame.home ? 'vs' : '@'} ${e.lastGame.opp}`,
      ],
      game: e.lastGame,
    }));
  }, [board, night, top]);

  const rosterSet = useMemo(() => new Set([...rosterIds, ...justAdded]), [rosterIds, justAdded]);

  const handleAdd = useCallback((r: Rookie) => {
    const p = toPlayer(r);
    if (!p) return;
    onAdd(p);
    setJustAdded(prev => [...prev, r.id]);
  }, [onAdd]);

  const subtitle = board === 'night'
    ? (night?.date ? `Top rookies from ${shortDate(night.date)}’s games` : 'Top rookies from the latest game night')
    : 'Best 15 rookies this season so far';

  const explainer = board === 'night'
    ? `Game Score blends points, rebounds, assists, steals, blocks, shooting and turnovers into one number. 10 is an average game, 20+ is excellent. Rookies with under ${MIN_MINUTES_LAST_NIGHT} minutes are left out.`
    : 'Rookie Rating is a rookie’s season Game Score, with missed games counting as zero. It settles as the season goes on. The numbers on each card are from his most recent game.';

  const pct = progress[1] > 0 ? Math.round((progress[0] / progress[1]) * 100) : 0;

  return (
    <section className="max-w-[1100px] mx-auto px-3 sm:px-6 pb-8" aria-label="Rookie Watch">
      {/* Title */}
      <div className="text-center mb-3">
        <div className="inline-flex items-center gap-2.5">
          <h1
            className="font-display font-800 text-2xl sm:text-3xl uppercase tracking-wide leading-tight"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Rookie Watch
          </h1>
          <span
            className="font-mono text-[9px] uppercase tracking-widest rounded-full px-1.5 py-0.5"
            style={{ background: 'rgba(var(--skin-primary-rgb),0.2)', color: 'var(--color-text-primary)' }}
          >
            Beta
          </span>
        </div>
        <p className="font-body mt-1 text-sm sm:text-base" style={{ color: 'var(--color-text-secondary)' }}>
          {subtitle}
        </p>
      </div>

      {/* Toggle */}
      <div className="flex justify-center mb-3">
        <div
          className="inline-flex rounded-full p-1"
          role="group"
          aria-label="Choose a view"
          style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        >
          {([['night', 'Last Night'], ['top', 'Top 15']] as const).map(([id, label]) => {
            const on = board === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setBoard(id)}
                className="rounded-full px-5 py-2 font-display font-600 uppercase tracking-wider text-xs transition-colors"
                style={on
                  ? { background: 'var(--neon-orange)', color: '#fff' }
                  : { color: 'var(--color-text-secondary)' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* One-line explainer */}
      <p
        className="font-body text-xs sm:text-sm leading-snug rounded-xl px-3 py-2 mb-4 text-center"
        style={{ background: 'rgba(var(--skin-primary-rgb),0.1)', color: 'var(--color-text-secondary)' }}
      >
        {explainer}
      </p>

      {/* Tiles */}
      {status === 'loading' || !confirmed ? (
        <div>
          <SkeletonGrid />
          {confirmed && (
            <div className="mt-4 text-center" role="status">
              <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
                {ROOKIE_MSG.loading}{progress[1] > 0 ? ` · ${pct}%` : '…'}
              </p>
              <div className="mx-auto mt-2 h-1 w-48 rounded-full overflow-hidden" style={{ background: 'var(--color-progress-bg)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--skin-primary)' }} />
              </div>
            </div>
          )}
        </div>
      ) : status === 'error' ? (
        <div className="text-center py-10" role="alert">
          <p className="font-body text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {errorKind === 'roster' ? ROOKIE_MSG.noRookies : ROOKIE_MSG.failed}
          </p>
          <button
            type="button"
            onClick={() => setAttempt(a => a + 1)}
            className="px-4 py-2 rounded-xl font-mono text-[11px] uppercase tracking-wider"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            {ROOKIE_MSG.tryAgain}
          </button>
        </div>
      ) : tiles.length === 0 ? (
        <p className="font-body text-sm text-center py-10" style={{ color: 'var(--color-text-secondary)' }}>
          {ROOKIE_MSG.quietNight}
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
          {tiles.map(t => (
            <RookieTile key={`${board}-${t.key}`} tile={t} onRoster={rosterSet.has(t.rookie.id)} onAdd={handleAdd} />
          ))}
        </div>
      )}

      {/* Second Exit pill, so nobody has to scroll back up */}
      <div className="flex justify-center mt-6">
        <RookieWatchPill open onClick={onExit} />
      </div>

      {/* No Spoilers: ask first */}
      {!confirmed && (
        <ConfirmDialog
          title="Your No Spoilers mode is on"
          body="If you proceed, this might spoil your last gameday results"
          primaryLabel="Proceed"
          secondaryLabel="Go back"
          onPrimary={() => setConfirmed(true)}
          onSecondary={onExit}
        />
      )}
    </section>
  );
}
