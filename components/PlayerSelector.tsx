'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Team, Player, Conference } from '@/lib/nba';
import { getTeamsByConference, NBA_TEAMS } from '@/lib/nba';

interface PlayerSelectorProps {
  onAdd: (player: Player) => void;
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

function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(2)}`;
}

async function nbaProxyFetch(endpoint: string): Promise<unknown> {
  const params = new URLSearchParams({ endpoint });
  const res = await fetch(`/api/nba-proxy?${params.toString()}`);
  if (!res.ok) throw new Error(`Proxy error ${res.status}`);
  return res.json();
}

async function fetchRoster(teamId: number): Promise<Player[]> {
  const season = getCurrentSeason();
  const data = await nbaProxyFetch(`commonteamroster?TeamID=${teamId}&Season=${season}`) as {
    resultSets: Array<{ name: string; headers: string[]; rowSet: unknown[][] }>;
  };
  const roster = data.resultSets?.find(r => r.name === 'CommonTeamRoster');
  if (!roster) return [];
  const h = roster.headers;
  const team = NBA_TEAMS.find(t => t.id === teamId);
  if (!team) return [];
  return roster.rowSet.map((row: unknown[]) => {
    const get = (key: string) => row[h.indexOf(key)];
    const fullName = String(get('PLAYER') ?? '');
    const parts = fullName.split(' ');
    return {
      id: Number(get('PLAYER_ID')),
      first_name: parts[0] ?? '',
      last_name: parts.slice(1).join(' ') ?? '',
      position: String(get('POSITION') ?? ''),
      jersey_number: String(get('NUM') ?? ''),
      team,
    };
  }).sort((a: Player, b: Player) => a.last_name.localeCompare(b.last_name));
}

async function fetchSearch(query: string): Promise<Player[]> {
  const season = getCurrentSeason();
  const data = await nbaProxyFetch(`commonallplayers?LeagueID=00&Season=${season}&IsOnlyCurrentSeason=1`) as {
    resultSets: Array<{ name: string; headers: string[]; rowSet: unknown[][] }>;
  };
  const set = data.resultSets?.[0];
  if (!set) return [];
  const h = set.headers;
  const q = query.toLowerCase();
  return set.rowSet
    .filter((row: unknown[]) => String(row[h.indexOf('DISPLAY_FIRST_LAST')] ?? '').toLowerCase().includes(q))
    .slice(0, 25)
    .map((row: unknown[]) => {
      const get = (key: string) => row[h.indexOf(key)];
      const fullName = String(get('DISPLAY_FIRST_LAST') ?? '');
      const parts = fullName.split(' ');
      const teamId = Number(get('TEAM_ID'));
      const team = NBA_TEAMS.find(t => t.id === teamId) ?? {
        id: teamId,
        abbreviation: String(get('TEAM_ABBREVIATION') ?? ''),
        city: '',
        conference: 'East' as Conference,
        division: '',
        full_name: String(get('TEAM_NAME') ?? ''),
        name: String(get('TEAM_NAME') ?? ''),
      };
      return {
        id: Number(get('PERSON_ID')),
        first_name: parts[0] ?? '',
        last_name: parts.slice(1).join(' ') ?? '',
        position: '',
        jersey_number: '',
        team,
      };
    });
}

const ALL_TEAMS_SORTED = [...NBA_TEAMS].sort((a, b) => a.full_name.localeCompare(b.full_name));

export default function PlayerSelector({
  onAdd, onRemove, isWatching, isFull, onClose, initialMode = 'conference'
}: PlayerSelectorProps) {
  const byConf = getTeamsByConference();

  // Determine initial view from mode
  const getInitialView = (): View => {
    if (initialMode === 'all-teams') return 'all-teams';
    if (initialMode === 'search') return 'conference'; // search handled separately
    return 'conference';
  };

  const [view, setView] = useState<View>(getInitialView());
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
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
    try {
      setPlayers(await fetchRoster(team.id));
    } catch {
      setError('Could not load roster. Please try again.');
      setPlayers([]);
    }
    setLoadingPlayers(false);
  }, []);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: 'var(--color-overlay)' }}
        onClick={onClose}
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
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            {showBack && (
              <button onClick={goBack} aria-label="Go back"
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
            <button aria-label="Close player selector" onClick={onClose}
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
              {(['East', 'West'] as Conference[]).map(conf => (
                <button key={conf}
                  onClick={() => { setSelectedConference(conf); setView('conf-teams'); }}
                  aria-label={`Browse ${conf}ern Conference teams`}
                  className="relative rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.02] overflow-hidden"
                  style={{
                    background: conf === 'East'
                      ? 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,212,255,0.04))'
                      : 'linear-gradient(135deg, rgba(255,107,43,0.1), rgba(255,107,43,0.04))',
                    border: `1px solid ${conf === 'East' ? 'rgba(0,212,255,0.2)' : 'rgba(255,107,43,0.2)'}`,
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
              ))}
            </div>
          )}

          {/* Conference teams list */}
          {!searchMode && view === 'conf-teams' && (
            <div className="p-2">
              {selectedConference && byConf[selectedConference].map(team => (
                <button key={team.id} onClick={() => loadPlayers(team)}
                  aria-label={`Browse ${team.full_name} roster`}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left"
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div>
                    <span className="font-body font-500 text-sm block" style={{ color: 'var(--color-text-primary)' }}>
                      {team.full_name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-widest mt-0.5 block"
                      style={{ color: 'var(--color-text-secondary)' }}>
                      {team.abbreviation} · {team.division}
                    </span>
                  </div>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    style={{ color: 'var(--neon-orange)', opacity: 0.5 }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>
          )}

          {/* All teams — 2-column grid */}
          {!searchMode && view === 'all-teams' && (
            <div className="p-3 grid grid-cols-2 gap-2">
              {ALL_TEAMS_SORTED.map(team => (
                <button key={team.id} onClick={() => loadPlayers(team)}
                  aria-label={`Browse ${team.full_name} roster`}
                  className="flex flex-col items-start px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{ border: '1px solid var(--color-border)', background: 'var(--color-card)' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--neon-orange)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,43,0.06)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-border)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--color-card)';
                  }}>
                  <span className="font-body font-500 text-sm leading-tight"
                    style={{ color: 'var(--color-text-primary)' }}>
                    {team.full_name}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest mt-0.5"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    {team.abbreviation} · {team.conference}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Players list */}
          {((!searchMode && view === 'players') || searchMode) && (
            <div className="p-2">
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
                return (
                  <div key={player.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
                    style={{ background: watching ? 'var(--color-watched-bg)' : 'transparent' }}
                    onMouseEnter={e => { if (!watching) (e.currentTarget as HTMLElement).style.background = 'var(--color-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = watching ? 'var(--color-watched-bg)' : 'transparent'; }}>
                    <div>
                      <span className="font-body font-500 text-sm block" style={{ color: 'var(--color-text-primary)' }}>
                        {player.first_name} {player.last_name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest mt-0.5 block"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {player.team?.abbreviation} · {player.position || '—'}
                      </span>
                    </div>
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
                        aria-label={`Add ${player.first_name} ${player.last_name} to roster`}
                        onClick={() => !isFull && onAdd(player)}
                        disabled={isFull}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all"
                        style={{
                          background: isFull ? 'transparent' : 'rgba(255,107,43,0.1)',
                          border: `1px solid ${isFull ? 'var(--color-border)' : 'rgba(255,107,43,0.3)'}`,
                          color: isFull ? 'var(--color-text-tertiary)' : 'var(--neon-orange)',
                          cursor: isFull ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => { if (!isFull) (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,43,0.2)'; }}
                        onMouseLeave={e => { if (!isFull) (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,43,0.1)'; }}>
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
