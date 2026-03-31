'use client';

import { useState, useEffect } from 'react';

export type SortOption = 'recent' | 'date-added' | 'az' | 'by-team' | 'by-position';

export interface Preferences {
  sortBy: SortOption;
}

const DEFAULTS: Preferences = {
  sortBy: 'recent',
};

const KEY = 'courtside_prefs_v1';

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) {
        setPrefs({ ...DEFAULTS, ...JSON.parse(stored) });
      }
    } catch {}
    setHydrated(true);
  }, []);

  const updatePref = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return { prefs, updatePref, hydrated };
}
