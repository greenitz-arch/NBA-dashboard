import { get, set } from "idb-keyval";

const TEAMS_KEY = "courtside_teams_v1";
const LEGACY_WATCHLIST_KEY = "nba_watchlist_v2";
const PREFS_KEY = "courtside_prefs_v1";

export interface WatchlistPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  team_id: number;
  team_abbreviation: string;
  team_full_name: string;
  added_at: number;
}

export interface Team {
  id: string;
  name: string;
  players: WatchlistPlayer[];
  createdAt: number;
}

export interface TeamsFile {
  teams: Team[];
  activeTeamId: string;
}

const EMPTY_TEAMS: TeamsFile = { teams: [], activeTeamId: "" };

function makeTeamId(): string {
  return `team_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Loads the saved teams/rosters. Handles two possible migrations, in order:
// 1. An existing localStorage copy under the current key (moves it into
//    the sturdier IndexedDB storage, then clears the old localStorage copy).
// 2. The even older single-roster key from before multi-team support existed.
export async function getTeamsData(): Promise<TeamsFile> {
  const existingIdb = await get(TEAMS_KEY);
  if (existingIdb !== undefined) return existingIdb as TeamsFile;

  if (typeof window === "undefined") return EMPTY_TEAMS;

  const storedTeams = window.localStorage.getItem(TEAMS_KEY);
  if (storedTeams) {
    try {
      const parsed: TeamsFile = JSON.parse(storedTeams);
      await set(TEAMS_KEY, parsed);
      window.localStorage.removeItem(TEAMS_KEY);
      return parsed;
    } catch {
      // fall through to next migration path
    }
  }

  const legacy = window.localStorage.getItem(LEGACY_WATCHLIST_KEY);
  if (legacy) {
    try {
      const players: WatchlistPlayer[] = JSON.parse(legacy);
      if (Array.isArray(players) && players.length > 0) {
        const team: Team = { id: makeTeamId(), name: "Team #1", players, createdAt: Date.now() };
        const next: TeamsFile = { teams: [team], activeTeamId: team.id };
        await set(TEAMS_KEY, next);
        window.localStorage.removeItem(LEGACY_WATCHLIST_KEY);
        return next;
      }
    } catch {
      // ignore malformed legacy data
    }
  }

  return EMPTY_TEAMS;
}

export async function setTeamsData(data: TeamsFile) {
  return set(TEAMS_KEY, data);
}

export async function getPrefs(): Promise<Record<string, unknown>> {
  const existingIdb = await get(PREFS_KEY);
  if (existingIdb !== undefined) return existingIdb as Record<string, unknown>;

  if (typeof window === "undefined") return {};

  const stored = window.localStorage.getItem(PREFS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      await set(PREFS_KEY, parsed);
      window.localStorage.removeItem(PREFS_KEY);
      return parsed;
    } catch {
      // ignore malformed legacy data
    }
  }
  return {};
}

export async function setPrefs(value: unknown) {
  return set(PREFS_KEY, value);
}

// NOTE: theme ("courtside_theme") is deliberately NOT moved to IndexedDB.
// app/layout.tsx reads it synchronously (via a blocking inline <script>) to
// pick the right theme before first paint and avoid a flash of the wrong
// theme. IndexedDB is async-only, so it can't be read inside that script.
// Theme stays in localStorage exactly as it works today — no changes needed.
