export interface SetEntry {
  exercise: string;
  reps: number;
  weight: number; // user's unit (lb or kg), keep consistent
  rpe?: number;
}

/** Epley estimated 1RM. Unreliable above ~12 reps, so those sets return null. */
export function e1rm(weight: number, reps: number): number | null {
  if (weight <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** Best e1RM for an exercise within a session's sets. */
export function bestE1rm(sets: SetEntry[], exercise: string): number | null {
  const vals = sets
    .filter((s) => s.exercise === exercise)
    .map((s) => e1rm(s.weight, s.reps))
    .filter((v): v is number => v !== null);
  return vals.length ? Math.max(...vals) : null;
}

/** Total volume load (sets x reps x weight) for a session. */
export function volumeLoad(sets: SetEntry[]): number {
  return sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
}
