import type { GameState } from './types';
import { movableRunLength, listCardMoves, canDeal, type CardMove } from './rules';

export type Hint = { kind: 'move'; move: CardMove } | { kind: 'deal' } | null;

/**
 * Rank legal moves by usefulness and return the best one; falls back to
 * "deal" when no card move exists, and null at deadlock. Deterministic.
 */
export function findHint(state: GameState): Hint {
  const moves = listCardMoves(state);
  let best: CardMove | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreMove(state, move);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  // A pointless-only board (score <= 0) should suggest dealing instead.
  if (best && bestScore > 0) return { kind: 'move', move: best };
  if (canDeal(state).ok) return { kind: 'deal' };
  return best ? { kind: 'move', move: best } : null;
}

function scoreMove(state: GameState, move: CardMove): number {
  const source = state.columns[move.from];
  const destination = state.columns[move.to];
  const moving = source[move.index];
  const runSize = source.length - move.index;
  let score = 0;

  if (destination.length > 0) {
    const top = destination[destination.length - 1];
    if (top.suit === moving.suit) {
      // Same-suit join — the whole point of the game. Longer joins first.
      score += 100 + runSize * 4 + movableRunLength(destination) * 2;
    } else {
      score += 20 + runSize;
    }
  } else {
    // Empty columns are precious; filling one is a last resort.
    score += 4;
  }

  const under = source[move.index - 1];
  if (under && !under.faceUp) score += 60; // uncovers a face-down card
  if (move.index === 0) score += 10; // empties a column

  // Pointless shuffle: whole face-up run moved off nothing onto an empty column.
  if (move.index === 0 && destination.length === 0) score = -1;
  // Breaking a same-suit run to place on a same-rank different suit is regressive.
  if (under && under.faceUp && under.suit === moving.suit && under.rank === moving.rank + 1) {
    const top = destination[destination.length - 1];
    if (!top || top.suit !== moving.suit) score -= 200;
  }
  return score;
}
