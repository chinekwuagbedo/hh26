import { phaseFor, type Cycle, type Phase } from './cycle';

export interface SessionMetric {
  date: string;
  value: number; // e.g. best e1RM, avg RPE at fixed load, or pace
}

export interface PhaseSummary {
  phase: Phase;
  mean: number;
  n: number;
  distinctCycles: number;
}

export interface Insight {
  summaries: PhaseSummary[];
  /** Plain-language, hedged. Empty until there's enough data. */
  message: string;
  enoughData: boolean;
}

const MIN_CYCLES = 2;
const MIN_SESSIONS_PER_PHASE = 3;

export function phaseInsight(
  metrics: SessionMetric[],
  cycles: Cycle[],
  label = 'performance',
): Insight {
  const buckets = new Map<Phase, { vals: number[]; cycleStarts: Set<string> }>();
  for (const m of metrics) {
    const p = phaseFor(m.date, cycles);
    if (!p) continue;
    const b = buckets.get(p.phase) ?? { vals: [], cycleStarts: new Set() };
    b.vals.push(m.value);
    // Rough cycle id: the cycle day offset from date gives the start
    b.cycleStarts.add(String(Math.floor(Date.parse(m.date) / 86_400_000) - p.cycleDay));
    buckets.set(p.phase, b);
  }

  const summaries: PhaseSummary[] = [...buckets.entries()].map(([phase, b]) => ({
    phase,
    mean: b.vals.reduce((a, v) => a + v, 0) / b.vals.length,
    n: b.vals.length,
    distinctCycles: b.cycleStarts.size,
  }));

  const enough =
    summaries.length >= 2 &&
    summaries.every((s) => s.n >= MIN_SESSIONS_PER_PHASE && s.distinctCycles >= MIN_CYCLES);

  if (!enough) {
    return {
      summaries,
      enoughData: false,
      message: `Keep logging. We need at least ${MIN_CYCLES} cycles and ${MIN_SESSIONS_PER_PHASE} sessions per phase before showing a pattern.`,
    };
  }

  const sorted = [...summaries].sort((a, b) => b.mean - a.mean);
  const hi = sorted[0];
  const lo = sorted[sorted.length - 1];
  const pct = ((hi.mean - lo.mean) / lo.mean) * 100;
  const message =
    pct < 3
      ? `Your ${label} looks similar across phases so far (differences under 3%).`
      : `Your data suggests ${label} runs about ${pct.toFixed(0)}% higher in the ${hi.phase} phase than the ${lo.phase} phase (based on ${summaries.reduce((a, s) => a + s.n, 0)} sessions). This is your personal pattern, not a universal rule.`;
  return { summaries, enoughData: true, message };
}
