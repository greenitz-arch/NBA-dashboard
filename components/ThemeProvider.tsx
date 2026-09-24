'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { findTeam, hexToRgb, type NbaTeam } from '@/lib/teams';

export type ThemeMode = 'dark' | 'light' | 'system' | 'skin';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  resolvedTheme: 'dark' | 'light';
  skinTeam: NbaTeam | null;
  // The team actually driving the visuals right now — null whenever mode
  // isn't 'skin', even if a team is remembered for next time skin mode is
  // picked again. Components that render skin decoration (SkinBackdrop,
  // SkinEffects, page.tsx's skin-active class) should read this, not
  // skinTeam directly, or they'll keep showing the last skin after the
  // person switches back to Dark/Light/System.
  activeSkin: NbaTeam | null;
  setSkinTeam: (abbr: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  setMode: () => {},
  resolvedTheme: 'dark',
  skinTeam: null,
  activeSkin: null,
  setSkinTeam: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const THEME_KEY = 'courtside_theme';
const SKIN_TEAM_KEY = 'courtside_skin_team';

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(resolved: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', resolved);
}

// Sets (or clears) the --skin-* CSS custom properties. Passing null resets
// everything back to plain orange (identical to the app before Team Skin
// existed) by setting the values explicitly, rather than removing them and
// relying on the stylesheet's own default to take back over — the latter
// depends on the browser having that exact stylesheet loaded, which isn't
// guaranteed after a dev-server hot-reload or a stale cache, and produced
// exactly that: the accent silently not resetting after leaving Skin mode.
const DEFAULT_SKIN_PRIMARY = '#ff6b2b';
const DEFAULT_SKIN_PRIMARY_RGB = '255, 107, 43';

function applySkinVars(team: NbaTeam | null) {
  const root = document.documentElement.style;
  if (!team) {
    root.setProperty('--skin-primary', DEFAULT_SKIN_PRIMARY);
    root.setProperty('--skin-primary-rgb', DEFAULT_SKIN_PRIMARY_RGB);
    root.setProperty('--skin-secondary', DEFAULT_SKIN_PRIMARY);
    root.setProperty('--skin-secondary-rgb', DEFAULT_SKIN_PRIMARY_RGB);
    root.setProperty('--skin-glow', `0 0 24px rgba(${DEFAULT_SKIN_PRIMARY_RGB}, 0.35)`);
    document.documentElement.removeAttribute('data-skin-team');
  } else {
    const rgbP = hexToRgb(team.primary);
    const rgbS = hexToRgb(team.secondary);
    root.setProperty('--skin-primary', team.primary);
    root.setProperty('--skin-primary-rgb', rgbP);
    root.setProperty('--skin-secondary', team.secondary);
    root.setProperty('--skin-secondary-rgb', rgbS);
    root.setProperty('--skin-glow', `0 0 24px rgba(${rgbP}, 0.4)`);
    document.documentElement.setAttribute('data-skin-team', team.abbr);
  }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const [skinTeamAbbr, setSkinTeamAbbr] = useState<string | null>(null);

  const skinTeam = useMemo(() => findTeam(skinTeamAbbr), [skinTeamAbbr]);
  const activeSkin = mode === 'skin' ? skinTeam : null;

  // Load saved preference on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    const savedSkinAbbr = localStorage.getItem(SKIN_TEAM_KEY);
    const initial = savedTheme ?? 'dark';
    setModeState(initial);
    setSkinTeamAbbr(savedSkinAbbr);

    if (initial === 'skin') {
      setResolvedTheme('dark');
      applyTheme('dark');
      applySkinVars(findTeam(savedSkinAbbr));
    } else {
      const resolved = initial === 'system' ? getSystemTheme() : initial;
      setResolvedTheme(resolved);
      applyTheme(resolved);
    }
  }, []);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      const resolved = mq.matches ? 'light' : 'dark';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_KEY, newMode);

    if (newMode === 'skin') {
      setResolvedTheme('dark');
      applyTheme('dark');
      // Re-apply whichever team was last chosen, if any. If none has ever
      // been chosen, this is a no-op and the app just stays on the default
      // orange accent until a team is picked from the sub-picker.
      applySkinVars(findTeam(skinTeamAbbr));
    } else {
      const resolved = newMode === 'system' ? getSystemTheme() : newMode;
      setResolvedTheme(resolved);
      applyTheme(resolved);
      // Leaving skin mode resets the accent back to default, but we keep
      // the saved team so flipping back to Skin remembers your choice.
      applySkinVars(null);
    }
  };

  const setSkinTeam = (abbr: string) => {
    const team = findTeam(abbr);
    if (!team) return;
    setSkinTeamAbbr(abbr);
    localStorage.setItem(SKIN_TEAM_KEY, abbr);
    setModeState('skin');
    localStorage.setItem(THEME_KEY, 'skin');
    setResolvedTheme('dark');
    applyTheme('dark');
    applySkinVars(team);
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolvedTheme, skinTeam, activeSkin, setSkinTeam }}>
      {children}
    </ThemeContext.Provider>
  );
}
