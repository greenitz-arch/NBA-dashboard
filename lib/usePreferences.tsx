'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { getPrefs, setPrefs as persistPrefs } from './storage';

export type SortOption = 'recent' | 'date-added' | 'az' | 'by-team' | 'by-position';

export interface Preferences {
  sortBy: SortOption;
}

const DEFAULTS: Preferences = {
  sortBy: 'recent',
};

interface PreferencesContextValue {
  prefs: Preferences;
  updatePref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  hydrated: boolean;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: DEFAULTS,
  updatePref: () => {},
  hydrated: false,
});

// Reads the shared preferences state. Must be used inside <PreferencesProvider>
// (see app/layout.tsx) so every component reading/writing sortBy shares the
// same state instead of each keeping its own private copy.
export function usePreferences() {
  return useContext(PreferencesContext);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefsState] = useState<Preferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPrefs()
      .then(stored => {
        if (!cancelled) setPrefsState({ ...DEFAULTS, ...stored });
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefsState(prev => {
      const next = { ...prev, [key]: value };
      persistPrefs(next).catch(() => {});
      return next;
    });
  };

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref, hydrated }}>
      {children}
    </PreferencesContext.Provider>
  );
}
