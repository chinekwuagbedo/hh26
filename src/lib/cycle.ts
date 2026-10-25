// Cycle math. Pure functions, no I/O, easy to unit test.
// Phases are ESTIMATES from period-start dates only. Ovulation can't be
// verified without hormone/BBT data, so label outputs accordingly in the UI.

export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export interface Cycle {
  startDate: string; // ISO date, e.g. "2026-10-01"
}

const DAY_MS = 86_400_000;
const DEFAULT_CYCLE_LEN = 28;
const LUTEAL_LEN = 14; // typical; ovulation ~14 days before next period

const toDay = (iso: string) => Math.floor(new Date(iso + 'T00:00:00Z').getTime() / DAY_MS);

/** Average cycle length from logged starts; falls back to 28. Ignores implausible gaps. */
export function averageCycleLength(cycles: Cycle[]): number {
  const starts = cycles.map((c) => toDay(c.startDate)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const g = starts[i] - starts[i - 1];
    if (g >= 21 && g <= 45) gaps.push(g);
  }
  if (!gaps.length) return DEFAULT_CYCLE_LEN;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

/** Cycle day (1-indexed) for a date, based on the most recent start on/before it. */
export function cycleDayFor(date: string, cycles: Cycle[]): number | null {
  const d = toDay(date);
  const prior = cycles
    .map((c) => toDay(c.startDate))
    .filter((s) => s <= d)
    .sort((a, b) => b - a)[0];
  if (prior === undefined) return null;
  return d - prior + 1;
}

export function phaseFor(
  date: string,
  cycles: Cycle[],
  periodLen = 5,
): { cycleDay: number; phase: Phase; cycleLen: number } | null {
  const cycleDay = cycleDayFor(date, cycles);
  if (cycleDay === null) return null;
  const cycleLen = averageCycleLength(cycles);
  const ovulationDay = cycleLen - LUTEAL_LEN;
  let phase: Phase;
  if (cycleDay <= periodLen) phase = 'menstrual';
  else if (cycleDay < ovulationDay - 1) phase = 'follicular';
  else if (cycleDay <= ovulationDay + 1) phase = 'ovulatory';
  else phase = 'luteal';
  // A cycle running past the average stays 'luteal' (still an estimate).
  return { cycleDay, phase, cycleLen };
}
