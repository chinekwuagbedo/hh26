import { averageCycleLength, cycleDayFor, phaseFor } from './cycle';
import { e1rm } from './strength';

const cycles = [{ startDate: '2026-08-01' }, { startDate: '2026-08-29' }, { startDate: '2026-09-26' }];

test('average cycle length from 28-day gaps', () => {
  expect(averageCycleLength(cycles)).toBe(28);
});

test('falls back to 28 with one cycle', () => {
  expect(averageCycleLength([{ startDate: '2026-10-01' }])).toBe(28);
});

test('cycle day is 1-indexed on the start date', () => {
  expect(cycleDayFor('2026-09-26', cycles)).toBe(1);
  expect(cycleDayFor('2026-10-05', cycles)).toBe(10);
});

test('returns null before any logged cycle', () => {
  expect(cycleDayFor('2026-07-01', cycles)).toBeNull();
});

test('phases for a 28-day cycle', () => {
  expect(phaseFor('2026-09-27', cycles)?.phase).toBe('menstrual');
  expect(phaseFor('2026-10-05', cycles)?.phase).toBe('follicular');
  expect(phaseFor('2026-10-09', cycles)?.phase).toBe('ovulatory'); // day 14
  expect(phaseFor('2026-10-18', cycles)?.phase).toBe('luteal');
});

test('e1RM', () => {
  expect(e1rm(100, 1)).toBe(100);
  expect(e1rm(100, 5)).toBeCloseTo(116.67, 1);
  expect(e1rm(100, 20)).toBeNull();
});
