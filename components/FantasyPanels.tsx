'use client';

import type { WatchlistPlayer } from '@/lib/storage';
import {
  teamStrengths,
  STATUS_COLOR,
  STATUS_LABEL,
  type PlayerFantasy,
} from '@/lib/fantasy';

interface PanelProps {
  players: WatchlistPlayer[];
  data: Record<number, PlayerFantasy>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-mono text-[10px] uppercase tracking-widest mb-2"
      style={{ color: 'var(--color-divider-text)' }}
    >
      {children}
    </p>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
    >
      {children}
    </div>
  );
}

export function FlameIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" />
    </svg>
  );
}

export function SnowflakeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
    </svg>
  );
}

// "Roster status" strip: everyone who is not fully healthy.
export function RosterStatusStrip({
  players,
  data,
  injuryOk,
}: PanelProps & { injuryOk: boolean }) {
  if (!injuryOk) {
    return (
      <div className="mb-4">
        <SectionLabel>Roster status</SectionLabel>
        <p className="font-body text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Injury list isn&apos;t available right now. Try again in a few minutes.
        </p>
      </div>
    );
  }
  const hurt = players.filter(p => data[p.id]?.status && data[p.id].status !== 'healthy');
  return (
    <div className="mb-4">
      <SectionLabel>Roster status</SectionLabel>
      <div className="flex flex-wrap gap-2">
        {hurt.length === 0 ? (
          <span
            className="font-body text-sm px-3 py-1 rounded-full"
            style={{ background: 'var(--color-card)', border: `1px solid ${STATUS_COLOR.healthy}`, color: 'var(--color-text-primary)' }}
          >
            Everyone is healthy
          </span>
        ) : (
          hurt.map(p => {
            const st = data[p.id].status!;
            return (
              <span
                key={p.id}
                title={data[p.id].statusNote}
                className="inline-flex items-center gap-2 font-body text-sm px-3 py-1 rounded-full"
                style={{ background: 'var(--color-card)', border: `1px solid ${STATUS_COLOR[st]}`, color: 'var(--color-text-primary)' }}
              >
                <span className="rounded-full" style={{ width: 8, height: 8, background: STATUS_COLOR[st] }} />
                {p.first_name} {p.last_name} · {STATUS_LABEL[st]}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

// "Team strengths": one bar per stat category.
export function TeamStrengths({ players, data }: PanelProps) {
  const entries = players.map(p => data[p.id]).filter(Boolean) as PlayerFantasy[];
  const scores = teamStrengths(entries);
  const preseason = entries.some(e => e.basis === 'preseason');
  const hasInjured = entries.some(e => e.status === 'out');

  return (
    <div className="mt-6">
      <SectionLabel>Team strengths</SectionLabel>
      <Panel>
        {!scores ? (
          <p className="font-body text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Team strengths show up once your players have played some games.
          </p>
        ) : (
          (() => {
            const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
            const worst = scores.reduce((a, b) => (b.score < a.score ? b : a));
            return (
              <>
                <div className="space-y-2.5">
                  {scores.map(s => {
                    const color =
                      s === best ? STATUS_COLOR.healthy : s === worst ? STATUS_COLOR.out : 'var(--skin-primary)';
                    return (
                      <div key={s.key} className="flex items-center gap-3">
                        <span className="font-body text-sm w-20 flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                          {s.label}
                        </span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-progress-bg)' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.score}%`, background: color }} />
                        </div>
                        <span className="font-mono text-xs w-7 text-right" style={{ color: 'var(--color-text-primary)' }}>
                          {s.score}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="font-body text-xs mt-3" style={{ color: 'var(--color-text-secondary)' }}>
                  Strongest: <span style={{ color: STATUS_COLOR.healthy }}>{best.label}</span> · Needs help:{' '}
                  <span style={{ color: STATUS_COLOR.out }}>{worst.label}</span>.
                  {hasInjured ? ' Injured players are left out of the totals.' : ''}
                  {preseason ? ' Based on preseason games for now.' : ''}
                </p>
              </>
            );
          })()
        )}
      </Panel>
    </div>
  );
}

// "Hot and cold": only your own players, only the ones clearly up or down.
export function HotColdList({ players, data }: PanelProps) {
  const rows = players.filter(p => data[p.id]?.form === 'hot' || data[p.id]?.form === 'cold');
  return (
    <div className="mt-6">
      <SectionLabel>Hot and cold, last 7 days</SectionLabel>
      <Panel>
        {rows.length === 0 ? (
          <p className="font-body text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            No one is clearly hot or cold yet. This fills in once your players have a few recent games.
          </p>
        ) : (
          rows.map((p, i) => {
            const d = data[p.id];
            const hot = d.form === 'hot';
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 py-2.5"
                style={{ borderTop: i ? '1px solid var(--color-border)' : undefined }}
              >
                <span style={{ color: hot ? '#ff8d5c' : '#7cb8ec' }}>
                  {hot ? <FlameIcon size={18} /> : <SnowflakeIcon size={18} />}
                </span>
                <span className="font-body text-sm font-500 flex-1" style={{ color: 'var(--color-text-primary)' }}>
                  {p.first_name} {p.last_name}
                </span>
                <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {d.last7!.pts.toFixed(1)} pts vs {d.avg!.pts.toFixed(1)} season
                </span>
              </div>
            );
          })
        )}
      </Panel>
    </div>
  );
}
