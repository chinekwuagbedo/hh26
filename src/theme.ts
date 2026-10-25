import type { Phase } from './lib/cycle';

// Text colours taken from makeaero's .aero-title / .aero-subtitle
export const colors = {
  ink: '#0a3d62',
  inkSoft: '#14425c',
  muted: '#3d7ea0',
};

// OKLCH hues (degrees). Presets match makeaero's orb and button generators;
// "period" is a custom rose hue in the range its custom-hue slider allows.
export const HUE = {
  period: 355,
  workout: 140,
  blue: 245,
  cyan: 200,
} as const;

export const phaseColor: Record<Phase, string> = {
  menstrual: '#ff4f86',
  follicular: '#1fa0e6',
  ovulatory: '#ffc533',
  luteal: '#a46bff',
};

export const phaseLabel: Record<Phase, string> = {
  menstrual: 'period',
  follicular: 'follicular',
  ovulatory: 'ovulation window',
  luteal: 'luteal',
};

// makeaero .aero-title text treatment
export const aeroTitle = {
  color: colors.ink,
  textShadowColor: 'rgba(255,255,255,0.7)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 6,
} as const;
