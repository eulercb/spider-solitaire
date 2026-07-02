import type { SuitCount } from '../engine';

export type AnimationSpeed = 'slow' | 'normal' | 'fast' | 'off';
export type ThemeName = 'baize' | 'midnight';
export type CardBack = 'lattice' | 'pinstripe' | 'quatrefoil';

export interface Settings {
  suitCount: SuitCount;
  tapToMove: boolean;
  dragToMove: boolean;
  animationSpeed: AnimationSpeed;
  theme: ThemeName;
  cardBack: CardBack;
  fourColor: boolean;
  highContrast: boolean;
  largeIndices: boolean;
  scoring: boolean;
  timer: boolean;
  sound: boolean;
  haptics: boolean;
  leftHanded: boolean;
  autoComplete: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  // 1-suit by default so a first session can actually reach the win cascade.
  suitCount: 1,
  tapToMove: true,
  dragToMove: true,
  animationSpeed: 'normal',
  theme: 'baize',
  cardBack: 'lattice',
  fourColor: false,
  highContrast: false,
  largeIndices: false,
  scoring: true,
  timer: true,
  sound: false,
  haptics: true,
  leftHanded: false,
  autoComplete: true,
};

export function sanitizeSettings(raw: unknown): Settings {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const source = raw as Record<string, unknown>;
  for (const key of Object.keys(out) as Array<keyof Settings>) {
    const value = source[key];
    if (typeof value === typeof out[key]) {
      if (key === 'suitCount' && value !== 1 && value !== 2 && value !== 4) continue;
      if (
        key === 'animationSpeed' &&
        !['slow', 'normal', 'fast', 'off'].includes(value as string)
      ) {
        continue;
      }
      if (key === 'theme' && !['baize', 'midnight'].includes(value as string)) continue;
      if (
        key === 'cardBack' &&
        !['lattice', 'pinstripe', 'quatrefoil'].includes(value as string)
      ) {
        continue;
      }
      (out as Record<string, unknown>)[key] = value;
    }
  }
  return out;
}
