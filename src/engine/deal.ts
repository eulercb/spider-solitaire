import type { GameState, SuitCount } from './types';
import { COLUMN_COUNT } from './types';
import { buildDeck, shuffle } from './deck';

const INITIAL_SCORE = 500;
const TABLEAU_CARDS = 54;

/**
 * Initial layout: 54 cards dealt row by row across ten columns — columns
 * 1–4 end up with six cards, columns 5–10 with five. Only the top card of
 * each column is face-up. The remaining 50 cards form the stock.
 */
export function createGame(seed: number, suitCount: SuitCount): GameState {
  const deck = shuffle(buildDeck(suitCount), seed);
  const columns: GameState['columns'] = Array.from({ length: COLUMN_COUNT }, () => []);
  for (let i = 0; i < TABLEAU_CARDS; i++) {
    columns[i % COLUMN_COUNT].push(deck[i]);
  }
  for (const column of columns) {
    column[column.length - 1] = { ...column[column.length - 1], faceUp: true };
  }
  return {
    seed,
    suitCount,
    columns,
    stock: deck.slice(TABLEAU_CARDS),
    foundations: [],
    moveCount: 0,
    score: INITIAL_SCORE,
  };
}
