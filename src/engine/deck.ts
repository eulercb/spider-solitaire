import type { Card, Suit, SuitCount } from './types';
import { DECK_SIZE } from './types';
import { mulberry32 } from './rng';

/**
 * 104 cards = 8 sets of 13 ranks. The suit of a set depends on difficulty:
 *   1-suit: all spades.
 *   2-suit: alternating spades/hearts (4 sets each).
 *   4-suit: two full decks (2 sets per suit).
 * Card id → suit/rank is a pure function so serialized states only need ids.
 */
export function suitForId(id: number, suitCount: SuitCount): Suit {
  const set = Math.floor(id / 13);
  if (suitCount === 1) return 0;
  if (suitCount === 2) return set % 2 === 0 ? 0 : 1;
  return (set % 4) as Suit;
}

export function rankForId(id: number): number {
  return (id % 13) + 1;
}

export function cardFromId(id: number, suitCount: SuitCount, faceUp = false): Card {
  return { id, suit: suitForId(id, suitCount), rank: rankForId(id), faceUp };
}

export function buildDeck(suitCount: SuitCount): Card[] {
  const deck: Card[] = [];
  for (let id = 0; id < DECK_SIZE; id++) deck.push(cardFromId(id, suitCount));
  return deck;
}

/** Fisher–Yates with the seeded PRNG. */
export function shuffle<T>(items: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
