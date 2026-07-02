import type { GameState, Move } from './types';
import { COLUMN_COUNT } from './types';
import { applyMove, movableRunLength } from './rules';
import { isWon } from './win';

const MOVE_LIMIT = 400;

/**
 * Conservative auto-finish: when the stock is empty and every card is face
 * up, greedily join maximal same-suit runs (longest destination run first)
 * and see whether that reaches a win. Returns the winning move list, or null
 * when the endgame still takes human judgement. Every returned move replays
 * through applyMove, so the sequence is legal by construction.
 */
export function findAutoFinish(state: GameState): Move[] | null {
  if (state.stock.length > 0) return null;
  for (const pile of state.columns) {
    if (pile.some((card) => !card.faceUp)) return null;
  }

  const moves: Move[] = [];
  let current = state;
  for (let step = 0; step < MOVE_LIMIT; step++) {
    if (isWon(current)) return moves;
    const move = pickJoin(current);
    if (!move) return null;
    moves.push(move);
    current = applyMove(current, move).state;
  }
  return null;
}

/** The best same-suit join available, or a run-to-empty-column unburying move. */
function pickJoin(state: GameState): Move | null {
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (let from = 0; from < COLUMN_COUNT; from++) {
    const pile = state.columns[from];
    const runLength = movableRunLength(pile);
    if (runLength === 0) continue;
    const index = pile.length - runLength;
    const moving = pile[index];
    for (let to = 0; to < COLUMN_COUNT; to++) {
      if (to === from) continue;
      const target = state.columns[to];
      const top = target[target.length - 1];
      if (top && top.suit === moving.suit && top.rank === moving.rank + 1) {
        const score = 1000 + movableRunLength(target) * 10 + runLength;
        if (score > bestScore) {
          bestScore = score;
          best = { type: 'card', from, index, to };
        }
      } else if (!top && index > 0) {
        // Unbury: park a whole run on an empty column to open the card below.
        const score = 1;
        if (score > bestScore) {
          bestScore = score;
          best = { type: 'card', from, index, to };
        }
      }
    }
  }
  return best;
}
