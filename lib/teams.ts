export interface NbaTeam {
  abbr: string;
  name: string;
  primary: string;
  secondary: string;
}

// Official brand colors — colors themselves aren't trademarked, unlike team
// logos, so this list is safe to ship as-is. See SkinBackdrop.tsx for why we
// don't attempt to reproduce actual team logo artwork.
export const NBA_TEAMS: NbaTeam[] = [
  { abbr: 'BOS', name: 'Celtics',      primary: '#007A33', secondary: '#BA9653' },
  { abbr: 'BKN', name: 'Nets',         primary: '#000000', secondary: '#ffffff' },
  { abbr: 'NYK', name: 'Knicks',       primary: '#006BB6', secondary: '#F58426' },
  { abbr: 'PHI', name: '76ers',        primary: '#006BB6', secondary: '#ED174C' },
  { abbr: 'TOR', name: 'Raptors',      primary: '#CE1141', secondary: '#000000' },
  { abbr: 'CHI', name: 'Bulls',        primary: '#CE1141', secondary: '#000000' },
  { abbr: 'CLE', name: 'Cavaliers',    primary: '#860038', secondary: '#FDBB30' },
  { abbr: 'DET', name: 'Pistons',      primary: '#1D42BA', secondary: '#C8102E' },
  { abbr: 'IND', name: 'Pacers',       primary: '#002D62', secondary: '#FDBB30' },
  { abbr: 'MIL', name: 'Bucks',        primary: '#00471B', secondary: '#EEE1C6' },
  { abbr: 'ATL', name: 'Hawks',        primary: '#E03A3E', secondary: '#C1D32F' },
  { abbr: 'CHA', name: 'Hornets',      primary: '#1D1160', secondary: '#00788C' },
  { abbr: 'MIA', name: 'Heat',         primary: '#98002E', secondary: '#F9A01B' },
  { abbr: 'ORL', name: 'Magic',        primary: '#0077C0', secondary: '#000000' },
  { abbr: 'WAS', name: 'Wizards',      primary: '#002B5C', secondary: '#E31837' },
  { abbr: 'DEN', name: 'Nuggets',      primary: '#0E2240', secondary: '#FEC524' },
  { abbr: 'MIN', name: 'Timberwolves', primary: '#0C2340', secondary: '#78BE20' },
  { abbr: 'OKC', name: 'Thunder',      primary: '#007AC1', secondary: '#EF3B24' },
  { abbr: 'POR', name: 'Blazers',      primary: '#E03A3E', secondary: '#000000' },
  { abbr: 'UTA', name: 'Jazz',         primary: '#002B5C', secondary: '#F9A01B' },
  { abbr: 'GSW', name: 'Warriors',     primary: '#1D428A', secondary: '#FFC72C' },
  { abbr: 'LAC', name: 'Clippers',     primary: '#C8102E', secondary: '#1D428A' },
  { abbr: 'LAL', name: 'Lakers',       primary: '#552583', secondary: '#FDB927' },
  { abbr: 'PHX', name: 'Suns',         primary: '#E56020', secondary: '#1D1160' },
  { abbr: 'SAC', name: 'Kings',        primary: '#5A2D81', secondary: '#63727A' },
  { abbr: 'DAL', name: 'Mavericks',    primary: '#00538C', secondary: '#002B5E' },
  { abbr: 'HOU', name: 'Rockets',      primary: '#CE1141', secondary: '#000000' },
  { abbr: 'MEM', name: 'Grizzlies',    primary: '#5D76A9', secondary: '#F5B112' },
  { abbr: 'NOP', name: 'Pelicans',     primary: '#0C2340', secondary: '#C8102E' },
  { abbr: 'SAS', name: 'Spurs',        primary: '#000000', secondary: '#C4CED4' },
];

export function findTeam(abbr: string | null | undefined): NbaTeam | null {
  if (!abbr) return null;
  return NBA_TEAMS.find(t => t.abbr === abbr) ?? null;
}

export function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
