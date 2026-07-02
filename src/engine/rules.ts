import type { ApplyResult, Card, GameEvent, GameState, Move } from './types';
import { COLUMN_COUNT } from './types';
import { removeCompletedRun } from './sequences';

/**
 * Spider's asymmetry, precisely:
 *   PICKUP is strict — a group moves together only if it is a same-suit,
 *   consecutively descending run from the grabbed card to the column top.
 *   PLACEMENT is loose — any card may land on a card one rank higher,
 *   regardless of suit, or on an empty column.
 */

/** True when cards `index…end` of a column form a movable (same-suit descending, all face-up) run. */
export function canGrab(state: GameState, column: number, index: number): boolean {
  const pile = state.columns[column];
  if (!pile || !Number.isInteger(index) || index < 0 || index >= pile.length) return false;
  for (let i = index; i < pile.length; i++) {
    const card = pile[i];
    if (!card.faceUp) return false;
    if (i > index) {
      const above = pile[i - 1];
      if (card.suit !== above.suit || card.rank !== above.rank - 1) return false;
    }
  }
  return true;
}

/** Length of the maximal movable run ending at the top of a column (0 for empty). */
export function movableRunLength(pile: Card[]): number {
  if (pile.length === 0) return 0;
  let length = 1;
  for (let i = pile.length - 1; i > 0; i--) {
    const card = pile[i];
    const above = pile[i - 1];
    if (!card.faceUp || !above.faceUp) break;
    if (above.suit !== card.suit || above.rank !== card.rank + 1) break;
    length++;
  }
  return pile[pile.length - 1].faceUp ? length : 0;
}

/** Loose placement: empty column, or a face-up top card exactly one rank higher (any suit). */
export function canDrop(state: GameState, movingCard: Card, to: number): boolean {
  const pile = state.columns[to];
  if (!pile) return false;
  if (pile.length === 0) return true;
  const top = pile[pile.length - 1];
  return top.faceUp && top.rank === movingCard.rank + 1;
}

export function isLegalMove(state: GameState, move: Move): boolean {
  if (move.type === 'deal') return canDeal(state).ok;
  const { from, index, to } = move;
  if (from === to || to < 0 || to >= COLUMN_COUNT) return false;
  if (!canGrab(state, from, index)) return false;
  return canDrop(state, state.columns[from][index], to);
}

export function legalDestinations(state: GameState, from: number, index: number): number[] {
  if (!canGrab(state, from, index)) return [];
  const moving = state.columns[from][index];
  const destinations: number[] = [];
  for (let to = 0; to < COLUMN_COUNT; to++) {
    if (to !== from && canDrop(state, moving, to)) destinations.push(to);
  }
  return destinations;
}

export type DealBlock = 'no-stock' | 'empty-column';

export function canDeal(state: GameState): { ok: boolean; reason?: DealBlock } {
  // A deal is always exactly one card onto every column.
  if (state.stock.length < COLUMN_COUNT) return { ok: false, reason: 'no-stock' };
  if (state.columns.some((pile) => pile.length === 0)) {
    return { ok: false, reason: 'empty-column' };
  }
  return { ok: true };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    columns: state.columns.map((pile) => pile.map((card) => ({ ...card }))),
    stock: state.stock.map((card) => ({ ...card })),
    foundations: state.foundations.map((run) => run.map((card) => ({ ...card }))),
  };
}

/** Flip the exposed top card of a column if it is face-down; record the event. */
function flipTop(state: GameState, column: number, events: GameEvent[]): void {
  const pile = state.columns[column];
  const top = pile[pile.length - 1];
  if (top && !top.faceUp) {
    top.faceUp = true;
    events.push({ kind: 'flipped', id: top.id, column });
  }
}

/** Check a column for a completed K→A run; remove it, score it, flip what it exposed. */
function settleColumn(state: GameState, column: number, events: GameEvent[]): void {
  const removed = removeCompletedRun(state, column);
  if (removed) {
    state.score += 100;
    events.push({
      kind: 'completed',
      ids: removed.map((card) => card.id),
      column,
      foundation: state.foundations.length - 1,
    });
    flipTop(state, column, events);
  }
}

/**
 * Apply a legal move, returning the next state plus the events the view
 * animates. Pure: the input state is never mutated. Throws on illegal moves —
 * callers gate on isLegalMove/canDeal and surface friendly copy themselves.
 */
export function applyMove(state: GameState, move: Move): ApplyResult {
  if (!isLegalMove(state, move)) {
    throw new Error(`illegal move: ${JSON.stringify(move)}`);
  }
  const next = cloneState(state);
  const events: GameEvent[] = [];
  next.moveCount++;
  next.score--;

  if (move.type === 'deal') {
    const dealt = next.stock.splice(next.stock.length - COLUMN_COUNT, COLUMN_COUNT);
    const ids: number[] = [];
    dealt.forEach((card, i) => {
      card.faceUp = true;
      next.columns[i].push(card);
      ids.push(card.id);
    });
    events.push({ kind: 'dealt', ids });
    for (let column = 0; column < COLUMN_COUNT; column++) {
      settleColumn(next, column, events);
    }
  } else {
    const { from, index, to } = move;
    const run = next.columns[from].splice(index);
    next.columns[to].push(...run);
    events.push({ kind: 'moved', ids: run.map((card) => card.id), from, to });
    settleColumn(next, to, events);
    flipTop(next, from, events);
  }

  if (next.foundations.length === 8) {
    events.push({ kind: 'won' });
  }
  return { state: next, events };
}

export interface CardMove {
  from: number;
  index: number;
  to: number;
}

/** Every legal card move (each grabbable start index × each destination). */
export function listCardMoves(state: GameState): CardMove[] {
  const moves: CardMove[] = [];
  for (let from = 0; from < COLUMN_COUNT; from++) {
    const pile = state.columns[from];
    const runLength = movableRunLength(pile);
    for (let index = pile.length - runLength; index < pile.length; index++) {
      if (index < 0) continue;
      for (const to of legalDestinations(state, from, index)) {
        moves.push({ from, index, to });
      }
    }
  }
  return moves;
}

/**
 * Tap-to-move destination preference (§7): same-suit continuation first,
 * then any occupied pile, then an empty column as a last resort. Among
 * occupied same-rank options, bury the least useful top card — the one whose
 * own movable run is shortest. Deterministic tie-break: lowest column index.
 */
export function bestDestination(state: GameState, from: number, index: number): number | null {
  const destinations = legalDestinations(state, from, index);
  if (destinations.length === 0) return null;
  const moving = state.columns[from][index];

  let best: number | null = null;
  let bestScore = -Infinity;
  for (const to of destinations) {
    const pile = state.columns[to];
    let score: number;
    if (pile.length === 0) {
      score = 0;
    } else {
      const top = pile[pile.length - 1];
      const sameSuit = top.suit === moving.suit;
      // Burying a long ordered run hurts; burying a stray card is cheap.
      const buriedRun = movableRunLength(pile);
      score = sameSuit ? 3000 - buriedRun : 2000 - buriedRun;
      if (sameSuit) score += buriedRun * 2; // extending a longer same-suit run is better
    }
    if (score > bestScore) {
      bestScore = score;
      best = to;
    }
  }
  return best;
}
