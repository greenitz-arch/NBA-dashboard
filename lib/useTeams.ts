'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Player } from './nba';
import { getTeamsData, setTeamsData } from './storage';
import type { Team, TeamsFile, WatchlistPlayer } from './storage';

export type { Team, TeamsFile };
export const MAX_ROSTER = 15;

const EMPTY: TeamsFile = { teams: [], activeTeamId: '' };

function makeTeamId(): string {
  return `team_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Finds the lowest unused "Team #N" label, so renamed/deleted teams don't
// leave gaps or collide with a team the user renamed back to a default label.
function nextDefaultName(teams: Team[]): string {
  const used = new Set(teams.map(t => t.name));
  let n = 1;
  while (used.has(`Team #${n}`)) n++;
  return `Team #${n}`;
}

function persist(next: TeamsFile) {
  setTeamsData(next).catch(() => {});
}

export function useTeams() {
  const [data, setData] = useState<TeamsFile>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTeamsData()
      .then(loaded => {
        if (!cancelled) setData(loaded);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeTeam = useMemo(
    () => data.teams.find(t => t.id === data.activeTeamId) ?? null,
    [data]
  );

  const watchlist = activeTeam?.players ?? [];

  const addPlayer = useCallback((player: Player): 'added' | 'full' | 'exists' => {
    let result: 'added' | 'full' | 'exists' = 'added';
    setData(prev => {
      let teams = prev.teams;
      let activeTeamId = prev.activeTeamId;

      // First-ever player: silently create the default "Team #1".
      if (teams.length === 0) {
        const team: Team = { id: makeTeamId(), name: 'Team #1', players: [], createdAt: Date.now() };
        teams = [team];
        activeTeamId = team.id;
      }

      const activeIdx = teams.findIndex(t => t.id === activeTeamId);
      if (activeIdx === -1) return prev;

      const active = teams[activeIdx];
      if (active.players.find(p => p.id === player.id)) { result = 'exists'; return prev; }
      if (active.players.length >= MAX_ROSTER) { result = 'full'; return prev; }

      const entry: WatchlistPlayer = {
        id: player.id,
        first_name: player.first_name,
        last_name: player.last_name,
        position: player.position,
        team_id: player.team.id,
        team_abbreviation: player.team.abbreviation,
        team_full_name: player.team.full_name,
        added_at: Date.now(),
      };

      const nextTeams = [...teams];
      nextTeams[activeIdx] = { ...active, players: [...active.players, entry] };
      const next: TeamsFile = { teams: nextTeams, activeTeamId };
      persist(next);
      return next;
    });
    return result;
  }, []);

  const removePlayer = useCallback((playerId: number) => {
    setData(prev => {
      const idx = prev.teams.findIndex(t => t.id === prev.activeTeamId);
      if (idx === -1) return prev;
      const team = prev.teams[idx];
      const nextTeams = [...prev.teams];
      nextTeams[idx] = { ...team, players: team.players.filter(p => p.id !== playerId) };
      const next: TeamsFile = { ...prev, teams: nextTeams };
      persist(next);
      return next;
    });
  }, []);

  const isWatching = useCallback((playerId: number) => {
    return watchlist.some(p => p.id === playerId);
  }, [watchlist]);

  const switchTeam = useCallback((teamId: string) => {
    setData(prev => {
      if (!prev.teams.some(t => t.id === teamId) || prev.activeTeamId === teamId) return prev;
      const next: TeamsFile = { ...prev, activeTeamId: teamId };
      persist(next);
      return next;
    });
  }, []);

  // Manual "+ New Team" — always available, per user's chosen flow.
  const createTeam = useCallback((): string => {
    let newId = '';
    setData(prev => {
      const name = nextDefaultName(prev.teams);
      const team: Team = { id: makeTeamId(), name, players: [], createdAt: Date.now() };
      newId = team.id;
      const next: TeamsFile = { teams: [...prev.teams, team], activeTeamId: team.id };
      persist(next);
      return next;
    });
    return newId;
  }, []);

  const renameTeam = useCallback((teamId: string, name: string) => {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    setData(prev => {
      const idx = prev.teams.findIndex(t => t.id === teamId);
      if (idx === -1) return prev;
      const nextTeams = [...prev.teams];
      nextTeams[idx] = { ...nextTeams[idx], name: trimmed };
      const next: TeamsFile = { ...prev, teams: nextTeams };
      persist(next);
      return next;
    });
  }, []);

  const deleteTeam = useCallback((teamId: string) => {
    setData(prev => {
      if (!prev.teams.some(t => t.id === teamId)) return prev;
      const nextTeams = prev.teams.filter(t => t.id !== teamId);
      const activeTeamId = prev.activeTeamId === teamId
        ? (nextTeams[0]?.id ?? '')
        : prev.activeTeamId;
      const next: TeamsFile = { teams: nextTeams, activeTeamId };
      persist(next);
      return next;
    });
  }, []);

  const isFull = watchlist.length >= MAX_ROSTER;

  return {
    teams: data.teams,
    activeTeamId: data.activeTeamId,
    activeTeam,
    watchlist,
    addPlayer,
    removePlayer,
    isWatching,
    isFull,
    switchTeam,
    createTeam,
    renameTeam,
    deleteTeam,
    hydrated,
  };
}

export type UseTeamsReturn = ReturnType<typeof useTeams>;
