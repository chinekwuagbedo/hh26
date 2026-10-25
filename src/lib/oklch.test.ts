import { oklch } from './oklch';

test('white and black', () => {
  expect(oklch(1, 0, 0)).toBe('rgb(255, 255, 255)');
  expect(oklch(0, 0, 0)).toBe('rgb(0, 0, 0)');
});

test('alpha produces rgba', () => {
  expect(oklch(1, 0, 0, 0.5)).toBe('rgba(255, 255, 255, 0.5)');
});

test('hues land in the expected colour family', () => {
  const parse = (s: string) => s.match(/\d+/g)!.slice(0, 3).map(Number);
  const [br, , bb] = parse(oklch(0.65, 0.15, 245)); // blue
  expect(bb).toBeGreaterThan(br);
  const [gr, gg, gb] = parse(oklch(0.65, 0.15, 140)); // green
  expect(gg).toBeGreaterThan(gr);
  expect(gg).toBeGreaterThan(gb);
  const [rr, rg] = parse(oklch(0.65, 0.18, 15)); // red
  expect(rr).toBeGreaterThan(rg);
});
