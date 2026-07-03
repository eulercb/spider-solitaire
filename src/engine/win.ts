import type { GameState } from './types';
import { SEQUENCES_TO_WIN } from './types';
import { canDeal, listCardMoves } from './rules';

export function isWon(state: GameState): boolean {
  return state.foundations.length === SEQUENCES_TO_WIN;
}

/**
 * Deadlock: no legal card move and no legal deal. (While the stock holds
 * cards and no column is empty, dealing is always an out; an empty column
 * with any card on the table always admits a move, so true deadlocks only
 * occur with the stock exhausted.)
 */
export function isDeadlocked(state: GameState): boolean {
  if (isWon(state)) return false;
  if (canDeal(state).ok) return false;
  return listCardMoves(state).length === 0;
}
