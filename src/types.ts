export type WorkoutType = 'lift' | 'run' | 'other';

export interface Workout {
  type: WorkoutType;
  rpe?: number; // 1-10 effort rating
}

export interface DayEntry {
  period?: boolean;
  workout?: Workout;
}

/** Keyed by local ISO date, e.g. "2026-10-21". */
export type Entries = Record<string, DayEntry>;
