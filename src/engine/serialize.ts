import type { Card, GameState, SuitCount } from './types';
import { COLUMN_COUNT, DECK_SIZE } from './types';
import { cardFromId } from './deck';

/**
 * Compact, versioned wire format. A card is one integer: id × 2 + faceUp.
 * Suit and rank re-derive from the id given the suit count, so a serialized
 * state stays small enough to autosave (and to snapshot per undo step).
 */
export const SCHEMA_VERSION = 1;

interface Wire {
  v: number;
  seed: number;
  suitCount: SuitCount;
  columns: number[][];
  stock: number[];
  foundations: number[][];
  moveCount: number;
  score: number;
}

function pack(card: Card): number {
  return card.id * 2 + (card.faceUp ? 1 : 0);
}

function unpack(value: number, suitCount: SuitCount): Card {
  return cardFromId(Math.floor(value / 2), suitCount, value % 2 === 1);
}

export function serialize(state: GameState): string {
  const wire: Wire = {
    v: SCHEMA_VERSION,
    seed: state.seed,
    suitCount: state.suitCount,
    columns: state.columns.map((pile) => pile.map(pack)),
    stock: state.stock.map(pack),
    foundations: state.foundations.map((run) => run.map(pack)),
    moveCount: state.moveCount,
    score: state.score,
  };
  return JSON.stringify(wire);
}

/** Parse and validate; throws on anything malformed — callers recover by starting fresh. */
export function deserialize(json: string): GameState {
  const wire = JSON.parse(json) as Wire;
  if (!wire || typeof wire !== 'object') throw new Error('not an object');
  if (wire.v !== SCHEMA_VERSION) throw new Error(`unknown schema version ${wire.v}`);
  if (wire.suitCount !== 1 && wire.suitCount !== 2 && wire.suitCount !== 4) {
    throw new Error('bad suit count');
  }
  if (!Array.isArray(wire.columns) || wire.columns.length !== COLUMN_COUNT) {
    throw new Error('bad columns');
  }
  if (!Array.isArray(wire.stock) || !Array.isArray(wire.foundations)) {
    throw new Error('bad piles');
  }
  if (!Number.isInteger(wire.seed) || !Number.isInteger(wire.moveCount)) {
    throw new Error('bad numbers');
  }

  const seen = new Set<number>();
  const readCard = (value: unknown): Card => {
    if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error('bad card');
    const id = Math.floor(value / 2);
    if (id < 0 || id >= DECK_SIZE || seen.has(id)) throw new Error('bad card id');
    seen.add(id);
    return unpack(value, wire.suitCount);
  };

  const state: GameState = {
    seed: wire.seed,
    suitCount: wire.suitCount,
    columns: wire.columns.map((pile) => pile.map(readCard)),
    stock: wire.stock.map(readCard),
    foundations: wire.foundations.map((run) => {
      const cards = run.map(readCard);
      if (cards.length !== 13) throw new Error('bad foundation run');
      return cards;
    }),
    moveCount: wire.moveCount,
    score: typeof wire.score === 'number' ? wire.score : 0,
  };
  if (seen.size !== DECK_SIZE) throw new Error(`expected ${DECK_SIZE} cards, saw ${seen.size}`);
  return state;
}
