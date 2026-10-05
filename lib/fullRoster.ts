// lib/fullRoster.ts
// Decides which players "Add full roster" should add.
//
// An NBA team lists 17 players: 15 standard contracts plus 2 two-way players.
// Courtside teams hold 15, so the two-way players are left out:
//   1) If ESPN marks a player as two-way, that player is skipped.
//   2) If a team still has more than 15 players, the ones with the fewest
//      minutes per game are skipped (two-way players are almost always there).
//   3) If we can't tell (no flags AND no minutes data), nothing is added --
//      guessing could add the wrong players.

export interface RosterCandidate {
  id: number;
  twoWay?: boolean;
  minutes?: number;
}

export interface FullRosterPlan<T> {
  picked: T[];               // the standard-contract players, most minutes first
  skippedTwoWay: number;     // skipped because ESPN marked them two-way
  droppedByMinutes: number;  // skipped because of low minutes
  unknown: boolean;          // true = can't decide safely
}

export function pickFullRoster<T extends RosterCandidate>(players: T[], max: number): FullRosterPlan<T> {
  const flagged = players.filter(p => p.twoWay);
  const pool = players.filter(p => !p.twoWay);

  // Most minutes first; players without minutes go last (original order kept).
  const sorted = [...pool].sort((a, b) => (b.minutes ?? -1) - (a.minutes ?? -1));

  if (sorted.length <= max) {
    return { picked: sorted, skippedTwoWay: flagged.length, droppedByMinutes: 0, unknown: false };
  }

  const known = sorted.filter(p => p.minutes !== undefined).length;
  if (known < sorted.length / 2) {
    return { picked: [], skippedTwoWay: flagged.length, droppedByMinutes: 0, unknown: true };
  }
  return {
    picked: sorted.slice(0, max),
    skippedTwoWay: flagged.length,
    droppedByMinutes: sorted.length - max,
    unknown: false,
  };
}
