import { buildFishLines, cyclesFromEntries } from './fishInsights';
import { makeDemo } from './demo';

const today = '2026-10-21';

test('empty log gets a friendly intro', () => {
  const lines = buildFishLines({}, today);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatch(/Finn/);
});

test('detects cycle starts from consecutive period days', () => {
  const cycles = cyclesFromEntries({
    '2026-10-01': { period: true },
    '2026-10-02': { period: true },
    '2026-10-03': { period: true },
    '2026-10-29': { period: true },
  });
  expect(cycles.map((c) => c.startDate)).toEqual(['2026-10-01', '2026-10-29']);
});

test('one cycle is not enough to claim a pattern', () => {
  const lines = buildFishLines({ '2026-10-10': { period: true } }, today);
  expect(lines.join(' ')).toMatch(/keep logging/i);
  expect(lines.join(' ')).not.toMatch(/train most/);
});

test('demo data produces hedged pattern lines', () => {
  const entries = makeDemo(today);
  expect(cyclesFromEntries(entries)).toHaveLength(3);
  const text = buildFishLines(entries, today).join(' ');
  expect(text).toMatch(/train most in your follicular/);
  expect(text).toMatch(/hardest in your luteal/);
  expect(text).toMatch(/not rules/);
});
