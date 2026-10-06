// lib/visitStats.ts
// Turns the list of visit records (see lib/visits.ts) into the numbers shown on /hq.
// Pure maths, no storage access.

export interface DayRow { date: string; visits: number; visitors: number }

export interface VisitSummary {
  today: string;
  since: string | null;                          // first day with data
  totals: { visits: number; visitors: number; returning: number };
  todayStats: { visits: number; visitors: number; newVisitors: number };
  last7: { visits: number; visitors: number };
  last30: { visits: number; visitors: number };
  series: DayRow[];                              // last 30 days, oldest first
}

// Pure calendar maths on "YYYY-MM-DD" (no time zones involved).
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function summarizeVisits(keys: string[], today: string): VisitSummary {
  const perDay = new Map<string, { visits: number; ids: Set<string> }>();
  const daysById = new Map<string, Set<string>>();
  let totalVisits = 0;

  for (const key of keys) {
    const parts = key.split('/');
    if (parts.length < 4 || parts[0] !== 'n') continue;
    const [, date, id] = parts;
    totalVisits++;
    const day = perDay.get(date) ?? { visits: 0, ids: new Set<string>() };
    day.visits++;
    day.ids.add(id);
    perDay.set(date, day);
    const days = daysById.get(id) ?? new Set<string>();
    days.add(date);
    daysById.set(id, days);
  }

  const series: DayRow[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = shiftDay(today, -i);
    const d = perDay.get(date);
    series.push({ date, visits: d?.visits ?? 0, visitors: d?.ids.size ?? 0 });
  }

  const windowStats = (days: number) => {
    const ids = new Set<string>();
    let visits = 0;
    for (let i = 0; i < days; i++) {
      const d = perDay.get(shiftDay(today, -i));
      if (!d) continue;
      visits += d.visits;
      d.ids.forEach(id => ids.add(id));
    }
    return { visits, visitors: ids.size };
  };

  let returning = 0;
  let newToday = 0;
  daysById.forEach(days => {
    if (days.size > 1) returning++;
    if (days.size === 1 && days.has(today)) newToday++;
  });

  const t = perDay.get(today);
  const dates = Array.from(perDay.keys()).sort();
  return {
    today,
    since: dates[0] ?? null,
    totals: { visits: totalVisits, visitors: daysById.size, returning },
    todayStats: { visits: t?.visits ?? 0, visitors: t?.ids.size ?? 0, newVisitors: newToday },
    last7: windowStats(7),
    last30: windowStats(30),
    series,
  };
}
