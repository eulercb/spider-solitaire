/** Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
export type Suit = 0 | 1 | 2 | 3;

export type SuitCount = 1 | 2 | 4;

/** 1 = Ace … 13 = King. */
export type Rank = number;

export interface Card {
  /** Stable identity 0–103; suit/rank derive from it (see deck.ts). */
  id: number;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export const COLUMN_COUNT = 10;
export const DECK_SIZE = 104;
export const SEQUENCES_TO_WIN = 8;

export interface GameState {
  seed: number;
  suitCount: SuitCount;
  /** Ten tableau columns; index 0 is the buried end, last is the top (grabbable) card. */
  columns: Card[][];
  /** Face-down stock; dealt ten at a time from the end. */
  stock: Card[];
  /** Completed K→A runs, in completion order. Cards kept for undo/rendering. */
  foundations: Card[][];
  moveCount: number;
  /** Classic scoring: 500 − 1/move + 100/sequence. Always tracked; display is a setting. */
  score: number;
}

export type Move =
  | { type: 'card'; from: number; index: number; to: number }
  | { type: 'deal' };

export type GameEvent =
  | { kind: 'moved'; ids: number[]; from: number; to: number }
  | { kind: 'dealt'; ids: number[] }
  | { kind: 'flipped'; id: number; column: number }
  | { kind: 'completed'; ids: number[]; column: number; foundation: number }
  | { kind: 'won' };

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
}
