// lib/prominence.ts
import type { GameStats } from './nba';

export type StatKey = 'pts' | 'reb' | 'ast' | 'stl' | 'blk' | 'turnover' | 'fg_pct' | 'fg3_pct' | 'ft_pct' | 'minutes' | 'plus_minus';

export interface DisplayStat {
  key: StatKey;
  label: string;
  value: string | number;
  rawValue: number;
  prominence: 'hero' | 'highlight' | 'standard' | 'hidden';
  isNegative?: boolean;
}

const LEAGUE_AVG: Record<StatKey, number> = {
  pts: 12, reb: 4.5, ast: 3, stl: 0.8, blk: 0.5, turnover: 1.8,
  fg_pct: 0.46, fg3_pct: 0.36, ft_pct: 0.75, minutes: 24, plus_minus: 0,
};

const STD_DEV: Record<StatKey, number> = {
  pts: 8, reb: 3, ast: 2.5, stl: 0.8, blk: 0.7, turnover: 1.5,
  fg_pct: 0.12, fg3_pct: 0.2, ft_pct: 0.15, minutes: 8, plus_minus: 10,
};

const HERO_THRESHOLDS: Partial<Record<StatKey, number>> = {
  pts: 30, reb: 15, ast: 12, stl: 4, blk: 4,
};

const STAT_LABELS: Record<StatKey, string> = {
  pts: 'PTS', reb: 'REB', ast: 'AST', stl: 'STL', blk: 'BLK',
  turnover: 'TO', fg_pct: 'FG%', fg3_pct: '3P%', ft_pct: 'FT%',
  minutes: 'MIN', plus_minus: '+/-',
};

function zScore(value: number, key: StatKey): number {
  return (value - LEAGUE_AVG[key]) / STD_DEV[key];
}

function formatStat(key: StatKey, value: number): string {
  if (key === 'fg_pct' || key === 'fg3_pct' || key === 'ft_pct') {
    if (value === 0) return '—';
    return `${Math.round(value * 100)}%`;
  }
  if (key === 'plus_minus') return value > 0 ? `+${value}` : `${value}`;
  if (key === 'minutes') return String(value).split(':')[0];
  return String(value);
}

export function computeDisplayStats(stats: GameStats): DisplayStat[] {
  const entries: Array<{ key: StatKey; raw: number }> = [
    { key: 'pts', raw: stats.pts },
    { key: 'reb', raw: stats.reb },
    { key: 'ast', raw: stats.ast },
    { key: 'stl', raw: stats.stl },
    { key: 'blk', raw: stats.blk },
    { key: 'turnover', raw: stats.turnover },
    { key: 'fg_pct', raw: stats.fg_pct },
    { key: 'fg3_pct', raw: stats.fg3_pct },
    { key: 'ft_pct', raw: stats.ft_pct },
    { key: 'minutes', raw: parseInt(String(stats.minutes).split(':')[0], 10) || 0 },
    { key: 'plus_minus', raw: stats.plus_minus },
  ];

  const results: DisplayStat[] = entries.map(({ key, raw }) => {
    const isNegative = key === 'turnover' && raw >= 4;
    if (key === 'fg_pct' && stats.fga === 0) return { key, label: STAT_LABELS[key], value: '—', rawValue: 0, prominence: 'hidden' as const };
    if (key === 'fg3_pct' && stats.fg3a === 0) return { key, label: STAT_LABELS[key], value: '—', rawValue: 0, prominence: 'hidden' as const };
    if (key === 'ft_pct' && stats.fta === 0) return { key, label: STAT_LABELS[key], value: '—', rawValue: 0, prominence: 'hidden' as const };

    const z = zScore(raw, key);
    const isHero = HERO_THRESHOLDS[key] !== undefined && raw >= HERO_THRESHOLDS[key]!;

    let prominence: DisplayStat['prominence'];
    if (key === 'minutes') prominence = raw >= 20 ? 'standard' : 'hidden';
    else if (raw === 0 && key !== 'plus_minus') prominence = 'hidden';
    else if (isHero) prominence = 'hero';
    else if (z >= 1.5) prominence = 'highlight';
    else if (z >= 0.2 || (key === 'pts' && raw >= 10) || (key === 'reb' && raw >= 5) || (key === 'ast' && raw >= 4)) prominence = 'standard';
    else if (key === 'plus_minus') prominence = Math.abs(raw) >= 5 ? 'standard' : 'hidden';
    else prominence = 'hidden';

    return { key, label: STAT_LABELS[key], value: formatStat(key, raw), rawValue: raw, prominence, isNegative };
  });

  const ptsEntry = results.find(r => r.key === 'pts');
  if (ptsEntry && ptsEntry.rawValue > 0 && ptsEntry.prominence === 'hidden') ptsEntry.prominence = 'standard';

  const order = { hero: 0, highlight: 1, standard: 2, hidden: 3 };
  return results.sort((a, b) => order[a.prominence] - order[b.prominence]);
}

export function getProminentStats(stats: GameStats): DisplayStat[] {
  return computeDisplayStats(stats).filter(s => s.prominence !== 'hidden');
}
