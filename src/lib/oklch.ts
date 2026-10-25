// OKLCH -> sRGB string, so we can use makeaero's exact colour recipes
// (oklch(65% 0.15 245) etc.) which React Native can't parse natively.
// Math from Björn Ottosson's OKLab reference implementation.

const enc = (x: number) => {
  const v = Math.min(1, Math.max(0, x));
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
};

/** l is 0-1 (e.g. 0.65 for 65%), c is chroma (~0-0.4), hDeg is hue in degrees. */
export function oklch(l: number, c: number, hDeg: number, alpha = 1): string {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const r = enc(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S);
  const g = enc(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S);
  const bl = enc(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S);

  return alpha >= 1 ? `rgb(${r}, ${g}, ${bl})` : `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}
