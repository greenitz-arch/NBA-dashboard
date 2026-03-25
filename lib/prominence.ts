// lib/prominence.ts
// Determines which stats to highlight on a player card based on
// how noteworthy each stat is relative to typical NBA performance.

import type { GameStats } from './balldontlie';

export type StatKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'turnover' | 'fg_pct' | 'fg3_pct' | 'ft_pct' | 'min' | 'plus_minus';

export interface DisplayStat {
  key: StatKey;
  label: string;
  value: string | number;
  rawValue: number;
  prominence: 'hero' | 'highlight' | 'standard' | 'hidden';
  isNegative?: boolean;
}

// Typical NBA starter averages (used to compute relative prominence)
const LEAGUE_AVG: Record<StatKey, number> = {
  pts: 12,
  reb: 4.5,
  ast: 3,
  stl: 0.8,
  blk: 0.5,
  turnover: 1.8,
  fg_pct: 0.46,
  fg3_pct: 0.36,
  ft_pct: 0.75,
  min: 24,
  plus_minus: 0,
};

// Standard deviations (rough estimates for single-game performances)
const STD_DEV: Record<StatKey, number> = {
  pts: 8,
  reb: 3,
  ast: 2.5,
  stl: 0.8,
  blk: 0.7,
  turnover: 1.5,
  fg_pct: 0.12,
  fg3_pct: 0.2,
  ft_pct: 0.15,
  min: 8,
  plus_minus: 10,
};

// Thresholds for "hero" stat (truly exceptional)
const HERO_THRESHOLDS: Partial<Record<StatKey, number>> = {
  pts: 30,
  reb: 15,
  ast: 12,
  stl: 4,
  blk: 4,
};

const STAT_LABELS: Record<StatKey, string> = {
  pts: 'PTS',
  reb: 'REB',
  ast: 'AST',
  stl: 'STL',
  blk: 'BLK',
  turnover: 'TO',
  fg_pct: 'FG%',
  fg3_pct: '3P%',
  ft_pct: 'FT%',
  min: 'MIN',
  plus_minus: '+/-',
};

function zScore(value: number, key: StatKey): number {
  return (value - LEAGUE_AVG[key]) / STD_DEV[key];
}

function formatStat(key: StatKey, value: number): string {
  if (key === 'fg_pct' || key === 'fg3_pct' || key === 'ft_pct') {
    if (value === null || value === 0) return '—';
    return `${Math.round(value * 100)}%`;
  }
  if (key === 'plus_minus') {
    return value > 0 ? `+${value}` : `${value}`;
  }
  if (key === 'min') {
    // balldontlie returns min as "MM:SS" string sometimes
    return String(value).split(':')[0];
  }
  return String(value);
}

export function computeDisplayStats(stats: GameStats): DisplayStat[] {
  const statKeys: StatKey[] = ['pts', 'reb', 'ast', 'stl', 'blk', 'turnover', 'fg_pct', 'fg3_pct', 'ft_pct', 'min', 'plus_minus'];

  const results: DisplayStat[] = [];

  for (const key of statKeys) {
    let rawValue: number;

    if (key === 'min') {
      // min can be "23:45" string format
      const minStr = String((stats as any)[key] ?? '0');
      rawValue = parseInt(minStr.split(':')[0], 10) || 0;
    } else {
      rawValue = (stats as any)[key] ?? 0;
    }

    // Skip null/undefined pct stats (player didn't attempt)
    if ((key === 'fg_pct' || key === 'fg3_pct' || key === 'ft_pct') && rawValue === 0) {
      const attempts = key === 'fg_pct' ? stats.fga : key === 'fg3_pct' ? stats.fg3a : stats.fta;
      if (attempts === 0) {
        results.push({ key, label: STAT_LABELS[key], value: '—', rawValue: 0, prominence: 'hidden' });
        continue;
      }
    }

    const z = zScore(rawValue, key);
    const isHero = HERO_THRESHOLDS[key] !== undefined && rawValue >= HERO_THRESHOLDS[key]!;
    const isNegative = key === 'turnover' && rawValue >= 4;

    let prominence: DisplayStat['prominence'];

    if (key === 'min') {
      // Minutes always shown as standard context
      prominence = rawValue >= 20 ? 'standard' : 'hidden';
    } else if (rawValue === 0 && key !== 'plus_minus') {
      prominence = 'hidden';
    } else if (isHero) {
      prominence = 'hero';
    } else if (z >= 1.5) {
      prominence = 'highlight';
    } else if (z >= 0.2 || (key === 'pts' && rawValue >= 10) || (key === 'reb' && rawValue >= 5) || (key === 'ast' && rawValue >= 4)) {
      prominence = 'standard';
    } else if (key === 'plus_minus') {
      prominence = Math.abs(rawValue) >= 5 ? 'standard' : 'hidden';
    } else {
      prominence = 'hidden';
    }

    results.push({
      key,
      label: STAT_LABELS[key],
      value: formatStat(key, rawValue),
      rawValue,
      prominence,
      isNegative,
    });
  }

  // Always ensure pts is at least standard if player scored
  const ptsEntry = results.find(r => r.key === 'pts');
  if (ptsEntry && ptsEntry.rawValue > 0 && ptsEntry.prominence === 'hidden') {
    ptsEntry.prominence = 'standard';
  }

  // Sort: hero first, then highlight, then standard, hidden last
  const order = { hero: 0, highlight: 1, standard: 2, hidden: 3 };
  return results.sort((a, b) => order[a.prominence] - order[b.prominence]);
}

export function getProminentStats(stats: GameStats): DisplayStat[] {
  return computeDisplayStats(stats).filter(s => s.prominence !== 'hidden');
}
