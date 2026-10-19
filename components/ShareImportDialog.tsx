'use client';

import { useEffect, useRef, useState } from 'react';
import type { UseTeamsReturn } from '@/lib/useTeams';
import { parseShareToken, type SharedTeam } from '@/lib/shareLink';
import { MSG } from '@/lib/messages';

// Opens when someone arrives through a shared-team link (…/?share=…).
// Offers to add that team to THEIR Courtside as a separate team, then explains where it went.

type Phase = 'none' | 'preview' | 'adding' | 'done' | 'invalid' | 'error';

interface Added { id: string; name: string; hadTeams: boolean }

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function Shell({ label, children, onClose }: { label: string; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="rounded-2xl p-5 w-full max-w-sm max-h-[92vh] overflow-y-auto"
        style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const primary = 'flex-1 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm';
const primaryStyle = { background: 'var(--neon-orange)', color: '#fff' } as const;
const secondary = 'flex-1 py-2.5 rounded-xl font-display font-600 uppercase tracking-wider text-sm';
const secondaryStyle = { border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' } as const;

export default function ShareImportDialog({ teamsApi }: { teamsApi: UseTeamsReturn }) {
  const { hydrated, importTeam, switchTeam } = teamsApi;
  const [phase, setPhase] = useState<Phase>('none');
  const [shared, setShared] = useState<SharedTeam | null>(null);
  const [added, setAdded] = useState<Added | null>(null);
  const handled = useRef(false);

  // Read the link once the saved teams have loaded, then clean the address bar so a refresh
  // doesn't open the pop-up again.
  useEffect(() => {
    if (!hydrated || handled.current) return;
    handled.current = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('share');
    if (token === null) return;
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    } catch {
      // address bar can't be changed: harmless
    }
    const team = parseShareToken(token);
    if (!team) { setPhase('invalid'); return; }
    setShared(team);
    setPhase('preview');
  }, [hydrated]);

  const close = () => { setPhase('none'); setShared(null); setAdded(null); };

  const add = async () => {
    if (!shared) return;
    setPhase('adding');
    try {
      const res = await importTeam(shared.name, shared.players);
      if (!res.ok) { setPhase('error'); return; }
      setAdded({ id: res.id, name: res.name, hadTeams: res.hadTeams });
      setPhase('done');
    } catch {
      setPhase('error');
    }
  };

  if (phase === 'none') return null;

  if (phase === 'invalid') {
    return (
      <Shell label="Link problem" onClose={close}>
        <p className="font-body text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>{MSG.badShareLink}</p>
        <button onClick={close} className={`${primary} w-full`} style={primaryStyle}>Got it</button>
      </Shell>
    );
  }

  if (phase === 'error') {
    return (
      <Shell label="Couldn't add the team" onClose={close}>
        <p className="font-body text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>{MSG.addTeamFailed}</p>
        <div className="flex gap-2">
          <button onClick={add} className={primary} style={primaryStyle}>{MSG.tryAgain}</button>
          <button onClick={close} className={secondary} style={secondaryStyle}>Close</button>
        </div>
      </Shell>
    );
  }

  if (phase === 'done' && added) {
    return (
      <Shell label="Team added" onClose={close}>
        <div className="flex items-center gap-2 mb-2">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--neon-green)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.5" />
          </svg>
          <h3 className="font-display font-800 text-lg uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>
            {added.hadTeams ? 'Added as a separate team' : 'Team added'}
          </h3>
        </div>
        <p className="font-body text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
          {added.hadTeams
            ? `${added.name} is now in your teams. Your own roster wasn't changed.`
            : `${added.name} is now your first team.`}
        </p>
        <p className="font-body text-sm leading-relaxed mt-2 mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          To switch between teams, tap the arrow next to the team name, or open the menu and pick one under Teams.
        </p>
        {added.hadTeams ? (
          <div className="flex gap-2">
            <button onClick={() => { switchTeam(added.id); close(); }} className={primary} style={primaryStyle}>View team</button>
            <button onClick={close} className={secondary} style={secondaryStyle}>Stay here</button>
          </div>
        ) : (
          <button onClick={close} className={`${primary} w-full`} style={primaryStyle}>Got it</button>
        )}
      </Shell>
    );
  }

  if (!shared) return null;
  const shown = shared.players.slice(0, 5);
  const extra = shared.players.length - shown.length;
  return (
    <Shell label="A team was shared with you" onClose={close}>
      <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>
        A friend shared a team with you
      </p>
      <h3 className="font-display font-800 text-2xl uppercase tracking-wide leading-tight mt-1" style={{ color: 'var(--color-text-primary)' }}>
        {shared.name}
      </h3>
      <p className="font-mono text-[11px] mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        {shared.players.length} player{shared.players.length === 1 ? '' : 's'}
      </p>
      <div className="mb-4">
        {shown.map(p => (
          <div key={p.id} className="flex items-center gap-3 py-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-display font-700 text-xs"
              style={{ background: 'var(--color-initials-bg)', border: '1px solid var(--color-initials-border)', color: 'var(--color-initials-text)' }}
            >
              {initials(p.first_name, p.last_name)}
            </span>
            <span className="flex-1 font-body text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
              {p.first_name} {p.last_name}
            </span>
            <span className="font-mono text-[10px] uppercase flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {p.team_abbreviation}{p.position ? ` · ${p.position}` : ''}
            </span>
          </div>
        ))}
        {extra > 0 && (
          <p className="font-mono text-[10px] pt-2" style={{ color: 'var(--color-text-tertiary)', borderTop: '1px solid var(--color-border)' }}>
            and {extra} more
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={add} disabled={phase === 'adding'} className={primary} style={{ ...primaryStyle, opacity: phase === 'adding' ? 0.6 : 1 }}>
          {phase === 'adding' ? 'Adding…' : 'Add to my teams'}
        </button>
        <button onClick={close} className={secondary} style={secondaryStyle}>Not now</button>
      </div>
    </Shell>
  );
}
