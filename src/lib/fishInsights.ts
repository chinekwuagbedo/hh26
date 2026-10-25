import { Cycle, Phase, phaseFor } from './cycle';
import { addDays, daysBetween } from './dates';
import { Entries } from '../types';
import { phaseLabel } from '../theme';

const PHASES: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];
const MIN_DAYS = 5; // days observed in a phase before we compare it
const MIN_CYCLES = 2; // distinct cycles that phase must appear in
const MIN_WORKOUTS = 6;

interface Stat {
  days: number;
  workouts: number;
  rpeSum: number;
  rpeN: number;
  cycleIds: Set<string>;
}

/** A cycle starts on any period day whose previous day isn't a period day. */
export function cyclesFromEntries(entries: Entries): Cycle[] {
  const periodDays = Object.keys(entries).filter((d) => entries[d].period).sort();
  const set = new Set(periodDays);
  return periodDays.filter((d) => !set.has(addDays(d, -1))).map((startDate) => ({ startDate }));
}

/** Lines for the fish to say. Hedged on purpose: personal patterns, not rules. */
export function buildFishLines(entries: Entries, today: string): string[] {
  const cycles = cyclesFromEntries(entries);
  if (!cycles.length) {
    return [
      "Hi, I'm Finn! Tap a day below and mark your period or a workout, and I'll start hunting for patterns.",
    ];
  }

  const lines: string[] = [];
  const now = phaseFor(today, cycles);
  if (now) {
    lines.push(
      `Today is day ${now.cycleDay} of your cycle, so you're probably in your ${phaseLabel[now.phase]} phase (just an estimate!).`,
    );
  }

  const stats = Object.fromEntries(
    PHASES.map((p) => [p, { days: 0, workouts: 0, rpeSum: 0, rpeN: 0, cycleIds: new Set<string>() }]),
  ) as Record<Phase, Stat>;

  let totalWorkouts = 0;
  const span = daysBetween(cycles[0].startDate, today);
  for (let i = 0; i <= Math.min(span, 730); i++) {
    const d = addDays(cycles[0].startDate, i);
    const p = phaseFor(d, cycles);
    if (!p) continue;
    const s = stats[p.phase];
    s.days++;
    s.cycleIds.add(addDays(d, -(p.cycleDay - 1)));
    const w = entries[d]?.workout;
    if (w) {
      s.workouts++;
      totalWorkouts++;
      if (w.rpe) {
        s.rpeSum += w.rpe;
        s.rpeN++;
      }
    }
  }

  const qualified = PHASES.filter(
    (p) => stats[p].days >= MIN_DAYS && stats[p].cycleIds.size >= MIN_CYCLES,
  );

  if (qualified.length < 2 || totalWorkouts < MIN_WORKOUTS) {
    lines.push(
      `I've seen ${cycles.length} period start${cycles.length === 1 ? '' : 's'} and ${totalWorkouts} workout${totalWorkouts === 1 ? '' : 's'}. I need about two cycles and a handful of workouts before I'll call anything a pattern, so keep logging!`,
    );
    return lines;
  }

  // Training frequency (sessions per week) by phase
  const rate = (p: Phase) => (stats[p].workouts / stats[p].days) * 7;
  const byRate = [...qualified].sort((a, b) => rate(b) - rate(a));
  const hiR = byRate[0];
  const loR = byRate[byRate.length - 1];
  if (rate(hiR) - rate(loR) >= 0.5 && rate(hiR) >= rate(loR) * 1.3) {
    lines.push(
      `So far you train most in your ${phaseLabel[hiR]} phase (about ${rate(hiR).toFixed(1)} sessions a week) and least in your ${phaseLabel[loR]} phase (${rate(loR).toFixed(1)}). That's from ${totalWorkouts} sessions.`,
    );
  } else {
    lines.push('Your training frequency looks pretty steady across phases so far.');
  }

  // Effort (RPE) by phase
  const rpeQ = qualified.filter((p) => stats[p].rpeN >= 3);
  if (rpeQ.length >= 2) {
    const avg = (p: Phase) => stats[p].rpeSum / stats[p].rpeN;
    const byAvg = [...rpeQ].sort((a, b) => avg(b) - avg(a));
    const hiE = byAvg[0];
    const loE = byAvg[byAvg.length - 1];
    if (avg(hiE) - avg(loE) >= 0.7) {
      lines.push(
        `Your sessions feel hardest in your ${phaseLabel[hiE]} phase (average effort ${avg(hiE).toFixed(1)}/10) and easiest in your ${phaseLabel[loE]} phase (${avg(loE).toFixed(1)}/10).`,
      );
    } else {
      lines.push('Your effort ratings look similar across phases so far.');
    }
  } else {
    lines.push('Add an effort rating (RPE) to your workouts and I can tell you when sessions feel hardest.');
  }

  lines.push(
    "I'm a fish, not a doctor. These are your own patterns so far, not rules, and the phases are estimates.",
  );
  return lines;
}
