import { addDays } from './dates';
import { DayEntry, Entries } from '../types';

/**
 * Synthetic data for demos: three 28-day cycles ending today.
 * Built with a deliberate pattern (frequent easy sessions in the follicular
 * phase, fewer harder ones in the luteal phase) so the fish has something to
 * find. Always label this as demo data.
 */
export function makeDemo(today: string): Entries {
  const entries: Entries = {};
  [-70, -42, -14].forEach((offset) => {
    const start = addDays(today, offset);
    for (let i = 0; i < 28; i++) {
      const date = addDays(start, i);
      if (date > today) break;
      const day = i + 1;
      const entry: DayEntry = {};
      if (day <= 5) entry.period = true;
      if (day >= 6 && day <= 13 && day % 2 === 0) {
        entry.workout = { type: day % 4 === 0 ? 'lift' : 'run', rpe: day % 3 === 0 ? 7 : 6 };
      } else if (day >= 16 && day % 4 === 0) {
        entry.workout = { type: 'lift', rpe: day % 8 === 0 ? 9 : 8 };
      }
      if (entry.period || entry.workout) entries[date] = entry;
    }
  });
  return entries;
}
