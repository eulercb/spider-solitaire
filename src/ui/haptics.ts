export type HapticKind = 'move' | 'invalid' | 'complete' | 'win' | 'deal';

const PATTERNS: Record<HapticKind, number | number[]> = {
  move: 8,
  deal: 12,
  invalid: [14, 40, 14],
  complete: [10, 30, 24],
  win: [24, 60, 32, 60, 90],
};

export function haptic(kind: HapticKind, enabled: boolean): void {
  if (!enabled || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* some browsers throw without a user gesture — never a problem */
  }
}
