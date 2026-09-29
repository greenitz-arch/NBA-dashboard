// lib/espnTop100.ts
// Players the empty-state "Draft night starts here" suggestions are drawn from.
// Source: ESPN's "NBA Rank 2026" top-100 countdown for the 2026-27 season.
//
// IMPORTANT: this list is only PART of ESPN's top 100 so far — it holds the
// names that could be confirmed from ESPN's published coverage. To add more,
// just add another name on a new line (spelling as on ESPN — accents, dots
// and "Jr."/"III" don't matter). Each name is matched against the real NBA
// rosters at load time, so a player's current team and ESPN ID are always
// up to date, even after trades. A name that isn't found is simply skipped.
//
// Refresh this list once a year when ESPN publishes the next NBA Rank.
export const ESPN_TOP_100_NAMES: string[] = [
  // Top 10
  'Nikola Jokic',
  'Victor Wembanyama',
  'Shai Gilgeous-Alexander',
  'Luka Doncic',
  'Giannis Antetokounmpo',
  'Jalen Brunson',
  'Anthony Edwards',
  'Cade Cunningham',
  'Jayson Tatum',
  'Donovan Mitchell',

  // 11-50
  'LeBron James',
  'Stephen Curry',
  'Kevin Durant',
  'Kawhi Leonard',
  'Cooper Flagg',
  'Jaylen Brown',
  'Tyrese Maxey',

  // 51-100
  'Zion Williamson',
  'Domantas Sabonis',
  'Ja Morant',
  'AJ Dybantsa',
  'Darryn Peterson',
  'Cameron Boozer',
  'Josh Hart',
  'Jimmy Butler',
  'Draymond Green',
  'Caleb Wilson',
  'Ajay Mitchell',
  'Cason Wallace',
  'Walker Kessler',
  'VJ Edgecombe',
  'Tyler Herro',
  'Jaden McDaniels',
  'Trey Murphy III',
  'Luguentz Dort',
];
