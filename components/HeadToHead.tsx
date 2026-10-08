'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Team, WatchlistPlayer } from '@/lib/storage';
import { getPlayerHeadshotUrl } from '@/lib/nba';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/fantasy';
import { useMatchup } from '@/lib/useMatchup';
import {
  CATS_9,
  buildMatch,
  compareCat,
  fmtCat,
  gameDateLabel,
  injuryFor,
  isPastSeason,
  totalsFromLines,
  weekKey,
  weekLabel,
  type PlayerMatch,
  type TeamGame,
} from '@/lib/matchup';
import type { InjuryEntry } from '@/lib/fantasy';

const GREEN = '#3fbf7f';
const RED = '#e5484d';

interface HeadToHeadProps {
  mine: Team;
  rival: Team | null;
  otherTeams: Team[]; // every team except the active one (rival candidates)
  maxRoster: number;
  onRemove: (teamId: string, playerId: number) => void;
  onRestore: (teamId: string, entry: WatchlistPlayer, index: number) => void;
  onAddMine: () => void;
  onAddRival: () => void;
  onPickRival: (teamId: string) => void;
  onClearRival: () => void;
  onCreateRival: () => void;
}

interface Row {
  p: WatchlistPlayer;
  m: PlayerMatch;
  inj: InjuryEntry | null;
  tg: TeamGame | undefined;
}

function Avatar({ p }: { p: WatchlistPlayer }) {
  const [broken, setBroken] = useState(false);
  const initials = `${p.first_name[0] ?? ''}${p.last_name[0] ?? ''}`.toUpperCase();
  return (
    <span
      className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 font-body font-500 text-[11px]"
      style={{ width: 32, height: 32, background: 'var(--color-progress-bg)', color: 'var(--color-text-primary)' }}
    >
      {broken ? (
        initials
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getPlayerHeadshotUrl(p)}
          alt=""
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
        />
      )}
    </span>
  );
}

function startText(ts: number): string {
  return new Date(ts).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function GameTag({ row }: { row: Row }) {
  const out = row.inj?.status === 'out';
  let text = 'No game today';
  let bg = 'var(--color-progress-bg)';
  let color = 'var(--color-text-secondary)';
  let live = false;
  if (out) {
    text = 'Out';
    color = '#ff8d90';
  } else if (row.tg?.state === 'in') {
    text = `Live · ${row.tg.detail}`;
    bg = 'rgba(229,72,77,0.18)';
    color = '#ff9a9a';
    live = true;
  } else if (row.tg?.state === 'pre') {
    text = `Tips off ${startText(row.tg.start)}`;
    color = 'var(--color-text-primary)';
  } else if (row.tg?.state === 'post') {
    text = 'Final';
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5"
      style={{ background: bg, color }}
    >
      {live && <span className="rounded-full animate-pulse-soft" style={{ width: 6, height: 6, background: RED }} />}
      {text}
    </span>
  );
}

// Says which game the numbers above come from, so old games are never mistaken for current form.
function StatCaption({ m }: { m: PlayerMatch }) {
  let text = '';
  let color = 'var(--color-text-secondary)';
  if (m.isLive) {
    text = 'Live box score';
    color = '#ffb089';
  } else if (m.lastInfo && m.lastInfo.time > 0) {
    const g = m.lastInfo;
    const past = isPastSeason(g.time);
    const kind = past ? 'Last season' : g.type === 'preseason' ? 'Preseason' : 'Last game';
    text = `${kind} · ${gameDateLabel(g.time)}${g.opp ? ` ${g.away ? '@' : 'vs'} ${g.opp}` : ''}`;
    if (past) color = '#f0b429';
  }
  if (!text) return null;
  return (
    <p className="font-mono text-[9px] uppercase tracking-widest text-center mt-1.5" style={{ color }}>
      {text}
    </p>
  );
}

const STRIP: { key: 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'tp'; label: string }[] = [
  { key: 'pts', label: 'PTS' },
  { key: 'reb', label: 'REB' },
  { key: 'ast', label: 'AST' },
  { key: 'stl', label: 'STL' },
  { key: 'blk', label: 'BLK' },
  { key: 'tp', label: '3PM' },
];

function PlayerRow({ row, onRemove }: { row: Row; onRemove: () => void }) {
  const { p, m, inj } = row;
  const out = inj?.status === 'out';
  const status = inj?.status ?? null;
  return (
    <div
      className="py-2.5"
      style={{
        borderTop: '1px solid var(--color-border)',
        opacity: out ? 0.5 : 1,
        filter: out ? 'grayscale(1)' : undefined,
      }}
    >
      <div className="flex items-center gap-2">
        <Avatar p={p} />
        <div className="flex-1 min-w-0">
          <div
            className="font-body text-sm font-500 truncate"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {p.first_name} {p.last_name}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            {p.team_abbreviation} · {p.position} · {m.weekGames} {m.weekGames === 1 ? 'game' : 'games'} this week
          </div>
        </div>
        {status && (
          <span
            className="rounded-full flex-shrink-0"
            style={{ width: 9, height: 9, background: STATUS_COLOR[status] }}
            title={inj?.note || STATUS_LABEL[status]}
          />
        )}
        <button
          onClick={onRemove}
          aria-label={`Remove ${p.first_name} ${p.last_name}`}
          className="flex-shrink-0 rounded-md p-1 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(229,72,77,0.18)';
            e.currentTarget.style.color = '#ff8d90';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--color-text-secondary)';
          }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-1.5">
        <GameTag row={row} />
      </div>
      {!out && (
        m.shown ? (
          <>
          <div className="grid grid-cols-6 gap-0.5 mt-2 text-center">
            {STRIP.map(s => (
              <div key={s.key}>
                <div
                  className="font-mono text-sm font-500"
                  style={{ color: m.isLive ? '#ffb089' : 'var(--color-text-primary)' }}
                >
                  {m.shown![s.key]}
                </div>
                <div className="font-mono text-[9px] tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          <StatCaption m={m} />
          </>
        ) : (
          <p className="font-body text-xs mt-2" style={{ color: 'var(--color-text-secondary)' }}>
            No games played yet
          </p>
        )
      )}
    </div>
  );
}

function SideCard({
  title,
  rows,
  max,
  loading,
  onRemove,
  onAdd,
  headerExtra,
}: {
  title: string;
  rows: Row[];
  max: number;
  loading: boolean;
  onRemove: (p: WatchlistPlayer) => void;
  onAdd: () => void;
  headerExtra?: React.ReactNode;
}) {
  const full = rows.length >= max;
  return (
    <div
      className="rounded-2xl p-3 min-w-0"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3
          className="font-display font-800 text-lg uppercase tracking-wide truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
          {rows.length} of {max}
        </span>
      </div>
      {headerExtra}
      {rows.length === 0 && (
        <p className="font-body text-sm text-center py-4" style={{ color: 'var(--color-text-secondary)' }}>
          No players yet
        </p>
      )}
      {loading && rows.length > 0 && (
        <p className="font-mono text-[10px] uppercase tracking-widest py-1" style={{ color: 'var(--color-text-secondary)' }}>
          Loading stats…
        </p>
      )}
      {rows.map(r => (
        <PlayerRow key={r.p.id} row={r} onRemove={() => onRemove(r.p)} />
      ))}
      <button
        onClick={onAdd}
        disabled={full}
        className="w-full mt-2.5 rounded-xl py-2 font-display font-600 uppercase tracking-wider text-xs transition-colors"
        style={{
          border: '1px dashed var(--color-border)',
          color: full ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          opacity: full ? 0.6 : 1,
          cursor: full ? 'not-allowed' : 'pointer',
        }}
      >
        {full ? 'Team full' : '+ Add player'}
      </button>
    </div>
  );
}

export default function HeadToHead({
  mine,
  rival,
  otherTeams,
  maxRoster,
  onRemove,
  onRestore,
  onAddMine,
  onAddRival,
  onPickRival,
  onClearRival,
  onCreateRival,
}: HeadToHeadProps) {
  const [weekMode, setWeekMode] = useState(true);
  const [choosing, setChoosing] = useState(false);
  const [undo, setUndo] = useState<{ teamId: string; entry: WatchlistPlayer; index: number; label: string } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allPlayers = useMemo(() => [...mine.players, ...(rival?.players ?? [])], [mine.players, rival]);
  const mm = useMatchup(allPlayers, true);
  const currentWeek = weekKey(Date.now());

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const makeRows = (list: WatchlistPlayer[]): Row[] =>
    list.map(p => {
      const tg = mm.teamGames.get(p.team_id);
      const liveEv = tg?.state === 'in' ? tg.eventId : undefined;
      const m = buildMatch(mm.games[p.id], liveEv ? mm.liveLines.get(p.id) : undefined, liveEv, currentWeek);
      return { p, m, inj: injuryFor(mm.injuries, p), tg };
    });

  const mineRows = makeRows(mine.players);
  const rivalRows = rival ? makeRows(rival.players) : [];

  const totalsOf = (rows: Row[]) =>
    weekMode
      ? totalsFromLines(rows.map(r => r.m.weekLine))
      : totalsFromLines(rows.filter(r => r.inj?.status !== 'out' && r.m.avg).map(r => r.m.avg!));

  const ta = totalsOf(mineRows);
  const tb = totalsOf(rivalRows);
  const ready = !!rival && mineRows.length > 0 && rivalRows.length > 0;
  const results = CATS_9.map(c => compareCat(ta[c.key], tb[c.key], c, weekMode));
  const wins = results.filter(r => r === 1).length;
  const losses = results.filter(r => r === -1).length;
  const ties = results.filter(r => r === 0).length;
  const weekGamesTotal = [...mineRows, ...rivalRows].reduce((n, r) => n + r.m.weekGames, 0);

  const handleRemove = (team: Team, p: WatchlistPlayer) => {
    const index = team.players.findIndex(x => x.id === p.id);
    onRemove(team.id, p.id);
    setUndo({ teamId: team.id, entry: p, index, label: `${p.first_name} ${p.last_name} removed from ${team.name}` });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 7000);
  };

  const sec = 'font-mono text-[10px] uppercase tracking-widest mb-2';

  return (
    <div className="mt-2 mb-4">
      <p className={sec} style={{ color: 'var(--color-divider-text)' }}>Head to head</p>

      <div className="grid grid-cols-2 gap-3 items-start">
        <SideCard
          title={mine.name}
          rows={mineRows}
          max={maxRoster}
          loading={mm.loading}
          onRemove={p => handleRemove(mine, p)}
          onAdd={onAddMine}
        />

        {rival ? (
          <SideCard
            title={rival.name}
            rows={rivalRows}
            max={maxRoster}
            loading={mm.loading}
            onRemove={p => handleRemove(rival, p)}
            onAdd={onAddRival}
            headerExtra={
              <select
                aria-label="Change rival team"
                value={rival.id}
                onChange={e => (e.target.value === '__none' ? onClearRival() : onPickRival(e.target.value))}
                className="font-mono text-[10px] uppercase tracking-wider rounded-md px-1.5 py-1 mb-1 max-w-full"
                style={{
                  background: 'var(--color-progress-bg)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {otherTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                <option value="__none">Remove rival (keeps the team)</option>
              </select>
            }
          />
        ) : (
          <div
            className="rounded-2xl p-4 text-center"
            style={{ border: '1px dashed var(--color-border)', background: 'var(--color-card)' }}
          >
            <h3
              className="font-display font-800 text-lg uppercase tracking-wide"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Your rival
            </h3>
            <p className="font-body text-sm my-4" style={{ color: 'var(--color-text-secondary)' }}>
              No rival team yet
            </p>
            {!choosing ? (
              <button
                onClick={() => (otherTeams.length > 0 ? setChoosing(true) : onCreateRival())}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-display font-600 uppercase tracking-wider text-sm transition-all duration-200 hover:scale-105"
                style={{ background: '#000', color: '#fff', boxShadow: '0 4px 18px rgba(0,0,0,0.45)' }}
              >
                + Add rival team
              </button>
            ) : (
              <div className="flex flex-col gap-2 items-stretch">
                <button
                  onClick={() => { setChoosing(false); onCreateRival(); }}
                  className="rounded-xl px-3 py-2 font-display font-600 uppercase tracking-wider text-xs"
                  style={{ background: '#000', color: '#fff' }}
                >
                  + Create a new rival team
                </button>
                <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
                  or use one of your teams
                </p>
                {otherTeams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setChoosing(false); onPickRival(t.id); }}
                    className="rounded-xl px-3 py-2 font-body text-sm truncate"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  >
                    {t.name} · {t.players.length}
                  </button>
                ))}
                <button
                  onClick={() => setChoosing(false)}
                  className="font-body text-xs underline"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Score + category rows */}
      <div
        className="rounded-2xl p-4 mt-3"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="grid items-center gap-2" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
          <div className="font-display font-800 text-lg sm:text-xl uppercase tracking-wide truncate" style={{ color: 'var(--color-text-primary)' }}>
            {mine.name}
          </div>
          <div className="text-center">
            <div className="font-display font-800 text-3xl leading-none" style={{ color: 'var(--skin-primary)' }}>
              {ready ? `${wins} – ${losses} – ${ties}` : '– – –'}
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {ready ? 'wins, losses, ties' : 'Waiting for players'}
            </div>
          </div>
          <div className="font-display font-800 text-lg sm:text-xl uppercase tracking-wide truncate text-right" style={{ color: 'var(--color-text-primary)' }}>
            {rival ? rival.name : 'Your rival'}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 mb-1">
          <span className="font-body text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {weekMode
              ? `${weekLabel()}${mm.anyLive ? ', includes live games' : ', totals so far'}`
              : 'Season averages, per game'}
            {mm.updatedAt > 0 && (
              <> · updated {new Date(mm.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
            )}
          </span>
          <div className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {([['This week', true], ['Season averages', false]] as const).map(([label, val]) => (
              <button
                key={label}
                onClick={() => setWeekMode(val)}
                aria-pressed={weekMode === val}
                className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider"
                style={{
                  background: weekMode === val ? 'var(--skin-primary)' : 'transparent',
                  color: weekMode === val ? '#111' : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {ready ? (
          <>
            {weekMode && !mm.loading && weekGamesTotal === 0 && (
              <p className="font-body text-xs py-2" style={{ color: 'var(--color-text-secondary)' }}>
                No games have been played yet this week, so every category is tied. Switch to Season averages to compare the rosters.
              </p>
            )}
            {CATS_9.map((c, i) => {
              const a = ta[c.key];
              const b = tb[c.key];
              const r = results[i];
              const sum = a + b;
              let share = sum > 0 ? Math.round((100 * a) / sum) : 50;
              if (c.lowerWins && sum > 0) share = 100 - share;
              return (
                <div
                  key={c.key}
                  className="grid items-center gap-3 py-2.5"
                  style={{ gridTemplateColumns: '64px 1fr 64px', borderTop: '1px solid var(--color-border)' }}
                >
                  <span
                    className="font-mono text-sm text-right"
                    style={{ color: r === 1 ? '#7fe0ae' : r === -1 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', fontWeight: r === 1 ? 600 : 400 }}
                  >
                    {fmtCat(a, c, weekMode)}
                  </span>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-center mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {c.label}{c.lowerWins ? ' (fewer wins)' : ''}
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-progress-bg)' }}>
                      <div style={{ width: `${share}%`, background: r === 1 ? GREEN : 'var(--color-border)' }} />
                      <div style={{ width: `${100 - share}%`, background: r === -1 ? RED : 'var(--color-progress-bg)' }} />
                    </div>
                  </div>
                  <span
                    className="font-mono text-sm"
                    style={{ color: r === -1 ? '#ff8d90' : r === 1 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)', fontWeight: r === -1 ? 600 : 400 }}
                  >
                    {fmtCat(b, c, weekMode)}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          <p
            className="font-body text-sm text-center pt-4 pb-2 mt-2"
            style={{ color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)' }}
          >
            {rival
              ? 'Add players to both teams to see who wins each of the 9 categories.'
              : 'Add a rival team to see who wins each of the 9 categories.'}
          </p>
        )}
      </div>

      {/* Undo bar */}
      {undo && (
        <div
          className="fixed left-1/2 bottom-6 z-40 flex items-center gap-3 rounded-xl px-4 py-2.5"
          style={{
            transform: 'translateX(-50%)',
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            maxWidth: 'calc(100vw - 32px)',
          }}
          role="status"
        >
          <span className="font-body text-sm" style={{ color: 'var(--color-text-primary)' }}>{undo.label}</span>
          <button
            onClick={() => {
              onRestore(undo.teamId, undo.entry, undo.index);
              setUndo(null);
            }}
            className="font-display font-600 uppercase tracking-wider text-xs rounded-lg px-3 py-1"
            style={{ border: '1px solid var(--skin-primary)', color: 'var(--color-text-primary)' }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
