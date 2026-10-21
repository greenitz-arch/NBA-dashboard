'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import type { WatchlistPlayer } from '@/lib/storage';
import { summarizeGames, type PlayerGames, type Line } from '@/lib/matchup';
import { getPlayerHeadshotUrl, getEspnHeadshotUrl, hasNbaHeadshot } from '@/lib/nba';
import { MSG } from '@/lib/messages';
import { fetchGamelog } from '@/lib/gamelog';

// Two players side by side, from their ESPN game logs (fetched in the visitor's browser).

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'none' } // has not played yet
  | { status: 'ok'; games: PlayerGames };

async function loadGames(p: WatchlistPlayer): Promise<Loaded> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetchGamelog(p.id, { cache: 'no-store', signal: ctrl.signal });
    if (res.status === 404) return { status: 'none' };
    if (!res.ok) return { status: 'error' };
    const games = summarizeGames(await res.json());
    return games.avg ? { status: 'ok', games } : { status: 'none' };
  } catch {
    return { status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

interface RowDef {
  key: string;
  label: string;
  get: (l: Line) => number | null;
  pct?: boolean;
  lowerBetter?: boolean;
}

const ROWS: RowDef[] = [
  { key: 'pts', label: 'Points', get: l => l.pts },
  { key: 'reb', label: 'Rebounds', get: l => l.reb },
  { key: 'ast', label: 'Assists', get: l => l.ast },
  { key: 'stl', label: 'Steals', get: l => l.stl },
  { key: 'blk', label: 'Blocks', get: l => l.blk },
  { key: 'tp', label: '3-pointers', get: l => l.tp },
  { key: 'fg', label: 'FG%', get: l => (l.fga > 0 ? (l.fgm / l.fga) * 100 : null), pct: true },
  { key: 'ft', label: 'FT%', get: l => (l.fta > 0 ? (l.ftm / l.fta) * 100 : null), pct: true },
  { key: 'to', label: 'Turnovers', get: l => l.to, lowerBetter: true },
];

type Mode = 'avg' | 'last';

function lineOf(g: PlayerGames, mode: Mode): Line | null {
  return mode === 'avg' ? g.avg : g.last?.line ?? null;
}

function show(row: RowDef, v: number | null, mode: Mode): string {
  if (v == null) return '—';
  if (row.pct) return `${v.toFixed(1)}%`;
  return v.toFixed(mode === 'avg' ? 1 : 0);
}

function Avatar({ player }: { player: WatchlistPlayer }) {
  const [useEspn, setUseEspn] = useState(false);
  const [failed, setFailed] = useState(false);
  const nba = hasNbaHeadshot(player);
  const src = nba && !useEspn ? getPlayerHeadshotUrl(player) : getEspnHeadshotUrl(player.id);
  return (
    <div
      className="relative w-14 h-14 rounded-full overflow-hidden mx-auto mb-1.5"
      style={{ background: 'var(--color-photo-bg)', border: '2px solid var(--color-initials-border)' }}
    >
      {!failed ? (
        <Image
          key={src}
          src={src}
          alt={`${player.first_name} ${player.last_name}`}
          fill
          sizes="56px"
          className="object-cover object-top"
          onError={() => { if (nba && !useEspn) setUseEspn(true); else setFailed(true); }}
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center font-display font-700 text-lg uppercase"
          style={{ color: 'var(--color-initials-text)' }}
        >
          {player.first_name[0]}{player.last_name[0]}
        </span>
      )}
    </div>
  );
}

function Head({ player, data, mode }: { player: WatchlistPlayer; data: Loaded; mode: Mode }) {
  let caption = '';
  if (data.status === 'ok') {
    const g = data.games;
    if (mode === 'last') {
      caption = g.last?.opp ? `${g.last.away ? '@' : 'vs'} ${g.last.opp}` : 'Last game';
    } else {
      caption = `${g.gamesPlayed} game${g.gamesPlayed === 1 ? '' : 's'}${g.basis === 'preseason' ? ' · preseason' : ''}`;
    }
  }
  return (
    <div className="text-center min-w-0">
      <Avatar player={player} />
      <div className="font-display font-700 text-sm uppercase tracking-wide leading-tight" style={{ color: 'var(--color-text-primary)' }}>
        {player.first_name}
        <br />
        <span style={{ color: 'var(--skin-primary)' }}>{player.last_name}</span>
      </div>
      <div className="font-mono text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
        {player.team_abbreviation}{player.position ? ` · ${player.position}` : ''}
      </div>
      {caption && (
        <div className="font-mono text-[9px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>{caption}</div>
      )}
    </div>
  );
}

function Problem({ player, data, onRetry }: { player: WatchlistPlayer; data: Loaded; onRetry: () => void }) {
  if (data.status === 'loading') {
    return (
      <div aria-busy="true" className="space-y-2">
        <div className="shimmer h-3 w-3/4 rounded mx-auto" />
        <div className="shimmer h-3 w-1/2 rounded mx-auto" />
      </div>
    );
  }
  if (data.status === 'none') {
    return (
      <p className="font-body text-[11px] leading-snug text-center" style={{ color: 'var(--color-text-secondary)' }}>
        {MSG.notPlayedYet}
      </p>
    );
  }
  return (
    <div className="text-center" role="alert">
      <p className="font-body text-[11px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
        {MSG.playerStatsFailed(player.last_name)}
      </p>
      <button
        onClick={onRetry}
        className="mt-2 px-3 py-1 rounded-lg font-mono text-[9px] uppercase tracking-wider"
        style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
      >
        {MSG.tryAgain}
      </button>
    </div>
  );
}

export default function PlayerComparison({ players, onClose }: { players: [WatchlistPlayer, WatchlistPlayer]; onClose: () => void }) {
  const [a, b] = players;
  const [dataA, setDataA] = useState<Loaded>({ status: 'loading' });
  const [dataB, setDataB] = useState<Loaded>({ status: 'loading' });
  const [mode, setMode] = useState<Mode>('avg');

  const fetchOne = useCallback((p: WatchlistPlayer, set: (l: Loaded) => void) => {
    set({ status: 'loading' });
    loadGames(p).then(set);
  }, []);

  useEffect(() => {
    fetchOne(a, setDataA);
    fetchOne(b, setDataB);
  }, [a, b, fetchOne]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const ready = dataA.status === 'ok' && dataB.status === 'ok';
  const lineA = dataA.status === 'ok' ? lineOf(dataA.games, mode) : null;
  const lineB = dataB.status === 'ok' ? lineOf(dataB.games, mode) : null;

  const pill = (on: boolean): React.CSSProperties => ({
    background: on ? 'var(--neon-orange)' : 'transparent',
    border: `1px solid ${on ? 'var(--neon-orange)' : 'var(--color-border)'}`,
    color: on ? '#fff' : 'var(--color-text-primary)',
  });

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Compare ${a.last_name} and ${b.last_name}`}
    >
      <div
        className="rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-4"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-800 text-lg uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
            Compare players
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          {(['avg', 'last'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider"
              style={pill(mode === m)}
            >
              {m === 'avg' ? 'Averages' : 'Last game'}
            </button>
          ))}
        </div>

        <div className="grid items-start gap-2 mb-4" style={{ gridTemplateColumns: '1fr 44px 1fr' }}>
          <Head player={a} data={dataA} mode={mode} />
          <div className="font-display font-700 text-xs uppercase text-center pt-5" style={{ color: 'var(--color-text-tertiary)' }}>vs</div>
          <Head player={b} data={dataB} mode={mode} />
        </div>

        {ready && lineA && lineB ? (
          <div>
            {ROWS.map(r => {
              const x = r.get(lineA);
              const y = r.get(lineB);
              let lead = 0;
              if (x != null && y != null && x !== y) lead = (r.lowerBetter ? x < y : x > y) ? 1 : 2;
              const cell = (v: number | null, on: boolean): React.CSSProperties => ({
                background: on ? 'rgba(0,255,136,0.12)' : 'transparent',
                color: on ? 'var(--neon-green)' : 'var(--color-text-primary)',
                fontWeight: on ? 700 : 400,
              });
              return (
                <div key={r.key} className="grid items-center gap-1.5 mt-1.5" style={{ gridTemplateColumns: '1fr 84px 1fr' }}>
                  <div className="rounded-lg py-1.5 text-center font-mono text-sm" style={cell(x, lead === 1)}>{show(r, x, mode)}</div>
                  <div className="text-center font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>{r.label}</div>
                  <div className="rounded-lg py-1.5 text-center font-mono text-sm" style={cell(y, lead === 2)}>{show(r, y, mode)}</div>
                </div>
              );
            })}
            <p className="font-mono text-[9px] text-center mt-3" style={{ color: 'var(--color-text-tertiary)' }}>
              Green marks the better number. Source: ESPN
            </p>
          </div>
        ) : (
          <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 44px 1fr' }}>
            <div>{dataA.status !== 'ok' && <Problem player={a} data={dataA} onRetry={() => fetchOne(a, setDataA)} />}</div>
            <div />
            <div>{dataB.status !== 'ok' && <Problem player={b} data={dataB} onRetry={() => fetchOne(b, setDataB)} />}</div>
          </div>
        )}
      </div>
    </div>
  );
}
