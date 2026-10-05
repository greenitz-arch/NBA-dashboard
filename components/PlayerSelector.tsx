'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Team, Player, Conference } from '@/lib/nba';
import { getTeamsByConference, NBA_TEAMS } from '@/lib/nba';
import { useTutorial } from './TutorialGuide';
import { TeamLogo, PlayerAvatar } from './SelectorBits';
import { MAX_ROSTER } from '@/lib/useTeams';
import { getLeagueMinutes, fetchRosterMinutes, minutesColor, minutesTextColor } from '@/lib/minutes';
import { pickFullRoster } from '@/lib/fullRoster';

interface PlayerSelectorProps {
  onAdd: (player: Player) => void;
  // Adds several players in one go ("Add full roster"). Optional: without it the button is hidden.
  onAddMany?: (players: Player[]) => void;
  // How many open spots the current team has (defaults to 15, or 0 when full).
  slotsLeft?: number;
  onRemove?: (playerId: number) => void;
  isWatching: (id: number) => boolean;
  isFull: boolean;
  onClose: () => void;
  initialMode?: 'conference' | 'all-teams' | 'search';
}

// conference flow: conference → teams → players
// all-teams flow: all-teams (2-col) → players
// search flow: search input → results
type View = 'conference' | 'conf-teams' | 'players' | 'all-teams';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

type EspnAthlete = {
  id: string;
  displayName: string;
  position?: { abbreviation: string };
  jersey?: string;
  [key: string]: unknown;
};

// A roster entry plus the extras this dialog needs.
type ListPlayer = Player & { minutes?: number; twoWay?: boolean };

// Netlify's server IP range is blocked by ESPN (same situation as
// stats.nba.com), but ESPN allows direct requests from a visitor's own
// browser. So these calls run client-side instead of through a server
// proxy — each visitor fetches with their own, unblocked connection.
// A simple per-visit cache avoids re-fetching the same team repeatedly
// while browsing (it resets naturally on page reload).
const rosterCache = new Map<number, EspnAthlete[]>();

async function fetchEspnRoster(espnId: number): Promise<EspnAthlete[]> {
  const cached = rosterCache.get(espnId);
  if (cached) return cached;
  const res = await fetch(`${ESPN_BASE}/teams/${espnId}/roster`);
  if (!res.ok) throw new Error(`ESPN roster error ${res.status}`);
  const data = await res.json() as { athletes?: EspnAthlete[] };
  const athletes = data.athletes ?? [];
  rosterCache.set(espnId, athletes);
  return athletes;
}

// ESPN may label two-way contract players somewhere in a player's data.
// We look for the words "two-way" anywhere in it (it's harmless if absent).
function looksTwoWay(a: EspnAthlete): boolean {
  try { return /two[-\s]?way/i.test(JSON.stringify(a)); } catch { return false; }
}

function toPlayer(a: EspnAthlete, team: Team): ListPlayer {
  const parts = a.displayName.split(' ');
  return {
    twoWay: looksTwoWay(a),
    id: Number(a.id),
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' ') ?? '',
    position: a.position?.abbreviation ?? '',
    jersey_number: a.jersey ?? '',
    team,
  };
}

async function fetchRoster(teamId: number): Promise<ListPlayer[]> {
  const team = NBA_TEAMS.find(t => t.id === teamId);
  if (!team) return [];
  const athletes = await fetchEspnRoster(team.espnId);
  return athletes.map(a => toPlayer(a, team))
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

async function fetchSearch(query: string): Promise<ListPlayer[]> {
  const q = query.toLowerCase();
  const perTeam = await Promise.allSettled(
    NBA_TEAMS.map(async team => {
      const athletes = await fetchEspnRoster(team.espnId);
      return athletes
        .filter(a => a.displayName.toLowerCase().includes(q))
        .map(a => toPlayer(a, team));
    })
  );
  return perTeam
    .filter((r): r is PromiseFulfilledResult<ListPlayer[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .slice(0, 25);
}

// Adds minutes-per-game to a roster and sorts it (most minutes first).
// If minutes can't be loaded, the roster stays A-Z and nothing else changes.
async function attachMinutes(roster: ListPlayer[]): Promise<{ players: ListPlayer[]; season: string | null }> {
  const league = await Promise.race([
    getLeagueMinutes(),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 6000)),
  ]);
  let byId: Map<number, number> | null = league?.byId ?? null;
  let season: string | null = league?.seasonLabel ?? null;
  if (!byId) {
    byId = await fetchRosterMinutes(roster.map(p => p.id));
    season = byId.size > 0 ? 'latest season' : null;
  }
  const withMinutes = roster.map(p => ({ ...p, minutes: byId?.get(p.id) }));
  if (!withMinutes.some(p => p.minutes !== undefined)) return { players: roster, season: null };
  withMinutes.sort((a, b) => (b.minutes ?? -1) - (a.minutes ?? -1));
  return { players: withMinutes, season };
}

const ALL_TEAMS_SORTED = [...NBA_TEAMS].sort((a, b) => a.full_name.localeCompare(b.full_name));

export default function PlayerSelector({
  onAdd, onAddMany, slotsLeft, onRemove, isWatching, isFull, onClose, initialMode = 'conference'
}: PlayerSelectorProps) {
  const byConf = getTeamsByConference();
  const tutorial = useTutorial();
  const tutorialActive = tutorial.step >= 2 && tutorial.step <= 4;

  // Determine initial view from mode
  const getInitialView = (): View => {
    if (initialMode === 'all-teams') return 'all-teams';
    if (initialMode === 'search') return 'conference'; // search handled separately
    return 'conference';
  };

  const [view, setView] = useState<View>(getInitialView());
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<ListPlayer[]>([]);
  const [minutesSeason, setMinutesSeason] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ListPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [searchMode, setSearchMode] = useState(initialMode === 'search');
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialMode === 'search') setTimeout(() => searchRef.current?.focus(), 100);
  }, [initialMode]);

  useEffect(() => {
    if (!searchMode) return;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setLoadingPlayers(true);
      setError(null);
      try {
        setSearchResults(await fetchSearch(searchQuery));
      } catch {
        setError('Could not load players. Please try again.');
      }
      setLoadingPlayers(false);
    }, 400);
    return () => { if (searchTimer.current !== null) clearTimeout(searchTimer.current); };
  }, [searchQuery, searchMode]);

  const loadPlayers = useCallback(async (team: Team) => {
    setLoadingPlayers(true);
    setSelectedTeam(team);
    setView('players');
    setError(null);
    setMinutesSeason(null);
    try {
      const roster = await fetchRoster(team.id);
      const withMinutes = await attachMinutes(roster);
      setPlayers(withMinutes.players);
      setMinutesSeason(withMinutes.season);
    } catch {
      setError('Could not load roster. Please try again.');
      setPlayers([]);
    }
    setLoadingPlayers(false);
  }, []);

  // When the tutorial's own "Next" click advances a step, actually perform
  // the real navigation this component owns (view transitions + the real
  // roster fetch) — the tutorial card never fakes this data itself.
  useEffect(() => {
    if (tutorial.step === 3 && view === 'conference') {
      setSelectedConference('East');
      setView('conf-teams');
    }
    if (tutorial.step === 4 && view !== 'players') {
      const bos = byConf.East?.find(t => t.abbreviation === 'BOS');
      if (bos) loadPlayers(bos);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial.step]);

  const goBack = () => {
    if (searchMode) {
      setSearchMode(false);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }
    if (view === 'players') {
      // Go back to whichever team list we came from
      if (initialMode === 'all-teams') {
        setView('all-teams');
      } else {
        setView('conf-teams');
      }
      setSelectedTeam(null);
      setPlayers([]);
      setMinutesSeason(null);
      return;
    }
    if (view === 'conf-teams') {
      setView('conference');
      setSelectedConference(null);
      return;
    }
  };

  const showBack = searchMode || view === 'conf-teams' || view === 'players';

  const getTitle = () => {
    if (searchMode) return 'Search Players';
    if (view === 'players') return selectedTeam?.full_name ?? 'Roster';
    if (view === 'conf-teams') return `${selectedConference} Conference`;
    if (view === 'all-teams') return 'Select a Team';
    return 'Select Conference';
  };

  const displayPlayers = searchMode ? searchResults : players;
  const hasMinutes = !searchMode && players.some(p => p.minutes !== undefined);

  // "Add full roster": the 15 standard-contract players (two-way players left out),
  // limited to the open spots on the current team, skipping anyone already added.
  const spots = slotsLeft ?? (isFull ? 0 : MAX_ROSTER);
  const plan = pickFullRoster(players, MAX_ROSTER);
  const notYetAdded = plan.picked.filter(p => !isWatching(p.id));
  const toAdd = notYetAdded.slice(0, Math.max(0, spots));
  const showFullRoster = !!onAddMany && !searchMode && view === 'players'
    && !loadingPlayers && !error && players.length > 0;
  const fullRosterDisabled = tutorialActive || plan.unknown || toAdd.length === 0;
  const fullRosterLabel =
    plan.unknown ? 'Add full roster'
    : toAdd.length > 0 ? `Add full roster (${toAdd.length})`
    : spots <= 0 ? 'Team is full'
    : 'Full roster added ✓';
  const fullRosterNotes: string[] = [];
  if (plan.unknown) {
    fullRosterNotes.push("Couldn't load minutes data, so two-way players can't be skipped. Add players one at a time for now.");
  } else {
    if (plan.skippedTwoWay > 0) fullRosterNotes.push(`Leaves out ${plan.skippedTwoWay} two-way player${plan.skippedTwoWay > 1 ? 's' : ''}`);
    if (plan.droppedByMinutes > 0) fullRosterNotes.push(`Skips the ${plan.droppedByMinutes} player${plan.droppedByMinutes > 1 ? 's' : ''} with the fewest minutes (likely two-way)`);
    if (spots > 0 && notYetAdded.length > spots) fullRosterNotes.push(`Only ${spots} open spot${spots > 1 ? 's' : ''} on this team, so it adds the ${spots} with the most minutes`);
  }

  const closeSelector = () => {
    if (tutorialActive) tutorial.closeAll();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'var(--color-overlay)' }}
        onClick={closeSelector}
      />

      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          maxHeight: '85vh',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          ref={el => tutorial.setTarget('dialog', el)}
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            {showBack && (
              <button onClick={goBack} aria-label="Go back" title="Go back"
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                style={{ border: '1px solid var(--color-border)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  style={{ color: 'var(--color-text-primary)' }}>
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            )}
            <h2 className="font-display font-700 text-lg uppercase tracking-wide"
              style={{ color: 'var(--color-text-primary)' }}>
              {getTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="Search players"
              title="Search players"
              onClick={() => {
                setSearchMode(s => !s);
                setSearchQuery('');
                setSearchResults([]);
                if (!searchMode) setTimeout(() => searchRef.current?.focus(), 100);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ border: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ color: 'var(--color-text-primary)' }}>
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
            </button>
            <button
              aria-label="Close player selector"
              title="Close"
              onClick={closeSelector}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ border: '1px solid var(--color-border)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ color: 'var(--color-text-primary)' }}>
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Search input */}
        {searchMode && (
          <div className="px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="relative">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                className="absolute left-3 top-1/2 -translate-y-1/2"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                style={{ color: 'var(--color-text-secondary)' }}>
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input ref={searchRef} type="text" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name…"
                aria-label="Search players by name"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-input-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1">

          {/* Conference selection */}
          {!searchMode && view === 'conference' && (
            <div className="p-4 grid grid-cols-2 gap-3">
              {(['West', 'East'] as Conference[]).map(conf => {
                const isEast = conf === 'East';
                const tutorialLocked = tutorial.step === 2 && !isEast;
                return (
                <button key={conf}
                  ref={el => { if (tutorial.step === 2 && isEast) tutorial.setTarget('east', el); }}
                  disabled={tutorialLocked}
                  title={tutorialLocked ? 'Try East first' : undefined}
                  onClick={() => {
                    if (tutorialLocked) return;
                    setSelectedConference(conf);
                    if (tutorial.step === 2 && isEast) { tutorial.pickEast(); return; }
                    setView('conf-teams');
                  }}
                  aria-label={`Browse ${conf}ern Conference teams`}
                  className="relative rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.02] overflow-hidden"
                  style={{
                    background: conf === 'East'
                      ? 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,212,255,0.04))'
                      : 'linear-gradient(135deg, rgba(255,107,43,0.1), rgba(255,107,43,0.04))',
                    border: `1px solid ${conf === 'East' ? 'rgba(0,212,255,0.2)' : 'rgba(255,107,43,0.2)'}`,
                    opacity: tutorialLocked ? 0.3 : 1,
                    cursor: tutorialLocked ? 'not-allowed' : 'pointer',
                    outline: tutorial.step === 2 && isEast && tutorial.picked.east ? '2px solid var(--neon-orange)' : 'none',
                  }}>
                  <span className="font-display font-800 absolute -bottom-2 -right-1 opacity-10 leading-none select-none"
                    style={{ color: conf === 'East' ? 'var(--neon-blue)' : 'var(--neon-orange)', fontSize: '5rem' }}>
                    {conf[0]}
                  </span>
                  <span className="font-display font-700 text-2xl uppercase tracking-wide block"
                    style={{ color: conf === 'East' ? 'var(--neon-blue)' : 'var(--neon-orange)' }}>
                    {conf}
                  </span>
                  <span className="font-body text-sm mt-1 block" style={{ color: 'var(--color-text-secondary)' }}>
                    {conf === 'East' ? 'Eastern' : 'Western'} Conference
                  </span>
                  <span className="font-mono text-xs mt-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                    {byConf[conf]?.length ?? 0} teams →
                  </span>
                </button>
                );
              })}
            </div>
          )}

          {/* Conference teams list */}
          {!searchMode && view === 'conf-teams' && (
            <div className="p-2">
              {selectedConference && byConf[selectedConference].map(team => {
                const isBos = team.abbreviation === 'BOS';
                const tutorialLocked = tutorial.step === 3 && !isBos;
                return (
                <button key={team.id}
                  ref={el => { if (tutorial.step === 3 && isBos) tutorial.setTarget('bos', el); }}
                  disabled={tutorialLocked}
                  title={tutorialLocked ? 'Try Boston Celtics first' : undefined}
                  onClick={() => {
                    if (tutorialLocked) return;
                    if (tutorial.step === 3 && isBos) { tutorial.pickBos(); return; }
                    loadPlayers(team);
                  }}
                  aria-label={`Browse ${team.full_name} roster`}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left"
                  style={{
                    opacity: tutorialLocked ? 0.3 : 1,
                    cursor: tutorialLocked ? 'not-allowed' : 'pointer',
                    outline: tutorial.step === 3 && isBos && tutorial.picked.bos ? '2px solid var(--neon-orange)' : 'none',
                  }}
                  onMouseEnter={e => { if (!tutorialLocked) (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'; }}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div className="flex items-center gap-3 min-w-0">
                    <TeamLogo abbr={team.abbreviation} size={32} />
                    <div className="min-w-0">
                      <span className="font-body font-500 text-sm block" style={{ color: 'var(--color-text-primary)' }}>
                        {team.full_name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest mt-0.5 block"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {team.abbreviation} · {team.division}
                      </span>
                    </div>
                  </div>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    style={{ color: 'var(--neon-orange)', opacity: 0.5 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
                );
              })}
            </div>
          )}

          {/* All teams — 2-column grid */}
          {!searchMode && view === 'all-teams' && (
            <div className="p-3 grid grid-cols-2 gap-2">
              {ALL_TEAMS_SORTED.map(team => (
                <button key={team.id} onClick={() => loadPlayers(team)}
                  aria-label={`Browse ${team.full_name} roster`}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--neon-orange)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,43,0.06)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-card)';
                  }}>
                  <TeamLogo abbr={team.abbreviation} size={26} />
                  <span className="flex flex-col items-start min-w-0">
                    <span className="font-body font-500 text-sm leading-tight"
                      style={{ color: 'var(--color-text-primary)' }}>
                      {team.full_name}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest mt-0.5"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      {team.abbreviation} · {team.conference}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Players list */}
          {((!searchMode && view === 'players') || searchMode) && (
            <div className="p-2">
              {showFullRoster && (
                <div className="px-2 pt-1 pb-2">
                  <button
                    onClick={() => { if (!fullRosterDisabled) onAddMany?.(toAdd); }}
                    disabled={fullRosterDisabled}
                    aria-label="Add the full roster to your team"
                    className="w-full py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all"
                    style={{
                      background: fullRosterDisabled ? 'transparent' : 'rgba(255,107,43,0.12)',
                      border: `1px solid ${fullRosterDisabled ? 'var(--color-border)' : 'var(--neon-orange)'}`,
                      color: fullRosterDisabled ? 'var(--color-text-tertiary)' : 'var(--neon-orange)',
                      cursor: fullRosterDisabled ? 'not-allowed' : 'pointer',
                      opacity: tutorialActive ? 0.3 : 1,
                    }}>
                    {toAdd.length > 0 && !fullRosterDisabled ? '+ ' : ''}{fullRosterLabel}
                  </button>
                  {fullRosterNotes.length > 0 && (
                    <p className="font-body text-[11px] text-center mt-1.5 leading-snug"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      {fullRosterNotes.join(' · ')}
                    </p>
                  )}
                  {hasMinutes && (
                    <p className="font-mono text-[10px] uppercase tracking-widest text-center mt-1.5"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      Most minutes first{minutesSeason ? ` · ${minutesSeason} avg` : ''}
                    </p>
                  )}
                </div>
              )}
              {loadingPlayers && (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--color-text-secondary)' }}>Loading…</div>
              )}
              {error && (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--neon-red)' }}>{error}</div>
              )}
              {searchMode && searchQuery.length < 2 && !loadingPlayers && (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--color-text-secondary)' }}>Type at least 2 characters…</div>
              )}
              {searchMode && searchQuery.length >= 2 && !loadingPlayers && searchResults.length === 0 && !error && (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--color-text-secondary)' }}>No players found</div>
              )}
              {!loadingPlayers && !error && displayPlayers.map(player => {
                const watching = isWatching(player.id);
                const isTatum = tutorial.step === 4 && player.last_name.toLowerCase() === 'tatum';
                const tutorialLocked = tutorial.step === 4 && !watching && !isTatum;
                return (
                  <div key={player.id}
                    className="flex items-center justify-between gap-3 pl-3 pr-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: watching ? 'var(--color-watched-bg)' : 'transparent',
                      borderLeft: `3px solid ${hasMinutes ? (player.minutes !== undefined ? minutesColor(player.minutes) : 'var(--color-border)') : 'transparent'}`,
                    }}
                    onMouseEnter={e => { if (!watching) (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = watching ? 'var(--color-watched-bg)' : 'transparent'; }}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <PlayerAvatar player={player} size={36} />
                      <div className="min-w-0">
                        <span className="font-body font-500 text-sm block truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {player.first_name} {player.last_name}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-widest mt-0.5 block"
                          style={{ color: 'var(--color-text-secondary)' }}>
                          {player.team?.abbreviation} · {player.position || '—'}{player.twoWay ? ' · 2-way' : ''}
                        </span>
                      </div>
                    </div>
                    {hasMinutes && (
                      <span className="font-mono text-[10px] px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0"
                        style={player.minutes !== undefined
                          ? { background: minutesColor(player.minutes), color: minutesTextColor(player.minutes), fontWeight: 600 }
                          : { background: 'var(--color-card)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                        {player.minutes !== undefined ? `${player.minutes.toFixed(1)} MIN` : '— MIN'}
                      </span>
                    )}
                    {watching ? (
                      <button
                        aria-label={`Remove ${player.first_name} ${player.last_name} from roster`}
                        onClick={() => onRemove?.(player.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all"
                        style={{ background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)', color: 'var(--neon-red)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,59,92,0.2)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,59,92,0.1)'}>
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                        Remove
                      </button>
                    ) : (
                      <button
                        ref={el => { if (isTatum) tutorial.setTarget('add-tatum', el); }}
                        aria-label={`Add ${player.first_name} ${player.last_name} to roster`}
                        title={tutorialLocked ? 'Try Tatum first' : undefined}
                        onClick={() => {
                          if (isFull || tutorialLocked) return;
                          onAdd(player);
                          if (isTatum) tutorial.confirmAdd(player.id);
                        }}
                        disabled={isFull || tutorialLocked}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all"
                        style={{
                          background: isFull ? 'transparent' : 'rgba(255,107,43,0.1)',
                          border: `1px solid ${isFull ? 'var(--color-border)' : 'rgba(255,107,43,0.3)'}`,
                          color: isFull ? 'var(--color-text-tertiary)' : 'var(--neon-orange)',
                          cursor: (isFull || tutorialLocked) ? 'not-allowed' : 'pointer',
                          opacity: tutorialLocked ? 0.3 : 1,
                        }}
                        onMouseEnter={e => { if (!isFull && !tutorialLocked) (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,43,0.2)'; }}
                        onMouseLeave={e => { if (!isFull && !tutorialLocked) (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,43,0.1)'; }}>
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none"
                          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M12 5v14M5 12h14"/>
                        </svg>
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
