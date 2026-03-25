// components/PlayerSelector.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Team, Player, Conference } from '@/lib/balldontlie';
import type { WatchlistPlayer } from '@/lib/useWatchlist';

interface PlayerSelectorProps {
  onAdd: (player: Player) => void;
  isWatching: (id: number) => boolean;
  onClose: () => void;
}

type View = 'conference' | 'teams' | 'players';

export default function PlayerSelector({ onAdd, isWatching, onClose }: PlayerSelectorProps) {
  const [view, setView] = useState<View>('conference');
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);
  const [teams, setTeams] = useState<Record<Conference, Team[]> | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load teams on mount
  useEffect(() => {
    setLoadingTeams(true);
    fetch('/api/teams')
      .then(r => r.json())
      .then(data => { setTeams(data); setLoadingTeams(false); })
      .catch(() => setLoadingTeams(false));
  }, []);

  // Search debounce
  useEffect(() => {
    if (!searchMode) return;
    clearTimeout(searchTimer.current);
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/players?search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery, searchMode]);

  const loadPlayers = useCallback(async (team: Team) => {
    setLoadingPlayers(true);
    setSelectedTeam(team);
    setView('players');
    try {
      const res = await fetch(`/api/players?teamId=${team.id}`);
      const data = await res.json();
      setPlayers(Array.isArray(data) ? data : []);
    } catch {}
    setLoadingPlayers(false);
  }, []);

  const handleConferenceSelect = (conf: Conference) => {
    setSelectedConference(conf);
    setView('teams');
  };

  const goBack = () => {
    if (view === 'players') { setView('teams'); setSelectedTeam(null); }
    else if (view === 'teams') { setView('conference'); setSelectedConference(null); }
  };

  const currentTeams = selectedConference && teams ? teams[selectedConference] : [];
  const displayPlayers = searchMode ? searchResults : players;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" id="select">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--color-dark)',
          border: '1px solid var(--color-border)',
          maxHeight: '85vh',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            {(view !== 'conference' && !searchMode) && (
              <button onClick={goBack}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                style={{ border: '1px solid var(--color-border)' }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-white fill-none" strokeWidth={2.5}>
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <div>
              <h2 className="font-display font-700 text-lg uppercase tracking-wide text-white">
                {searchMode ? 'Search Players' :
                  view === 'conference' ? 'Select Conference' :
                  view === 'teams' ? `${selectedConference}ern Conference` :
                  selectedTeam?.full_name}
              </h2>
              {!searchMode && view === 'players' && (
                <p className="font-mono text-[10px] uppercase tracking-wider mt-0.5"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  Tap a player to add to your watchlist
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search toggle */}
            <button
              onClick={() => {
                setSearchMode(s => !s);
                setSearchQuery('');
                setSearchResults([]);
                if (!searchMode) setTimeout(() => searchRef.current?.focus(), 100);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ border: '1px solid var(--color-border)' }}
              title="Search players"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white fill-none" strokeWidth={2}>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
              </svg>
            </button>
            {/* Close */}
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ border: '1px solid var(--color-border)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-white fill-none" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Search input */}
        {searchMode && (
          <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="relative">
              <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 stroke-current fill-none"
                style={{ color: 'var(--color-text-secondary)' }} strokeWidth={2}>
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name…"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-white placeholder-opacity-40 outline-none focus:ring-1"
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  color: 'white',
                  '--tw-ring-color': 'var(--neon-orange)',
                } as React.CSSProperties}
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
                <button
                  key={conf}
                  onClick={() => handleConferenceSelect(conf)}
                  className="relative rounded-xl p-5 text-left transition-all duration-200 hover:scale-[1.02] group overflow-hidden"
                  style={{
                    background: conf === 'East'
                      ? 'linear-gradient(135deg, rgba(0,212,255,0.1), rgba(0,212,255,0.04))'
                      : 'linear-gradient(135deg, rgba(255,107,43,0.1), rgba(255,107,43,0.04))',
                    border: `1px solid ${conf === 'East' ? 'rgba(0,212,255,0.2)' : 'rgba(255,107,43,0.2)'}`,
                  }}
                >
                  <span
                    className="font-display font-800 text-6xl absolute -bottom-3 -right-2 select-none opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: conf === 'East' ? 'var(--neon-blue)' : 'var(--neon-orange)' }}>
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
                    {teams ? teams[conf]?.length ?? 0 : '…'} teams →
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Teams list */}
          {!searchMode && view === 'teams' && (
            <div className="p-2">
              {loadingTeams ? (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--color-text-secondary)' }}>Loading teams…</div>
              ) : (
                currentTeams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => loadPlayers(team)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors hover:bg-white/5 text-left group"
                  >
                    <div>
                      <span className="font-body font-500 text-sm text-white block">{team.full_name}</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest mt-0.5 block"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {team.abbreviation} · {team.division}
                      </span>
                    </div>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 stroke-current fill-none opacity-30 group-hover:opacity-70 transition-opacity"
                      style={{ color: 'var(--neon-orange)' }} strokeWidth={2}>
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Players list */}
          {(!searchMode && view === 'players') || searchMode ? (
            <div className="p-2">
              {loadingPlayers && (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--color-text-secondary)' }}>Loading roster…</div>
              )}
              {searchMode && searchQuery.length < 2 && (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--color-text-secondary)' }}>Type at least 2 characters…</div>
              )}
              {searchMode && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="p-8 text-center font-mono text-xs uppercase tracking-widest"
                  style={{ color: 'var(--color-text-secondary)' }}>No players found</div>
              )}
              {displayPlayers.map(player => {
                const watching = isWatching(player.id);
                return (
                  <button
                    key={player.id}
                    onClick={() => !watching && onAdd(player)}
                    disabled={watching}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors text-left group"
                    style={{
                      background: watching ? 'rgba(0,255,136,0.04)' : 'transparent',
                      cursor: watching ? 'default' : 'pointer',
                    }}
                    onMouseEnter={e => { if (!watching) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = watching ? 'rgba(0,255,136,0.04)' : 'transparent'; }}
                  >
                    <div>
                      <span className="font-body font-500 text-sm text-white block">
                        {player.first_name} {player.last_name}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-widest mt-0.5 block"
                        style={{ color: 'var(--color-text-secondary)' }}>
                        {player.team?.abbreviation} · {player.position || '—'}
                      </span>
                    </div>
                    {watching ? (
                      <span className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-1"
                        style={{ color: 'var(--neon-green)' }}>
                        <svg viewBox="0 0 24 24" className="w-3 h-3 stroke-current fill-none" strokeWidth={2.5}>
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Added
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                        style={{ color: 'var(--neon-orange)' }}>
                        <svg viewBox="0 0 24 24" className="w-3 h-3 stroke-current fill-none" strokeWidth={2.5}>
                          <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
                        </svg>
                        Add
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
