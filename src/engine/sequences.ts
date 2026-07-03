import type { Card, GameState } from './types';

const RUN_LENGTH = 13;

/** True when the top 13 cards of a pile are a face-up, same-suit K→A run. */
export function hasCompletedRun(pile: Card[]): boolean {
  if (pile.length < RUN_LENGTH) return false;
  const start = pile.length - RUN_LENGTH;
  const suit = pile[start].suit;
  for (let i = 0; i < RUN_LENGTH; i++) {
    const card = pile[start + i];
    if (!card.faceUp || card.suit !== suit || card.rank !== 13 - i) return false;
  }
  return true;
}

/**
 * Remove a completed run from a column onto the foundations (mutates the
 * given state — only called on applyMove's private clone). Returns the
 * removed cards (K first) or null.
 */
export function removeCompletedRun(state: GameState, column: number): Card[] | null {
  const pile = state.columns[column];
  if (!hasCompletedRun(pile)) return null;
  const run = pile.splice(pile.length - RUN_LENGTH);
  state.foundations.push(run);
  return run;
}
