import type { Suit } from '../engine';
import type { CardBack } from '../game/settings';

/**
 * All card art is original and generated as inline SVG — crisp at any DPR,
 * a few kilobytes total, and re-colorable for the four-color and
 * high-contrast decks with plain CSS custom properties.
 *
 * Card space is 250×350 (2.5:3.5).
 */

const W = 250;
const H = 350;
const CORNER = 22;

export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Suit glyph paths, drawn in a 100×100 box. Exported for the win-cascade textures. */
export const SUIT_PATHS: Record<Suit, string> = {
  0: 'M50 5 C39 27 15 39 15 57 C15 71 27 79 39 75 C43 73.6 45.6 71 47 68.5 C45.5 80 41 88 34 93 L66 93 C59 88 54.5 80 53 68.5 C54.4 71 57 73.6 61 75 C73 79 85 71 85 57 C85 39 61 27 50 5 Z',
  1: 'M50 92 C22 68 9 52 9 34 C9 20 20 9 33 9 C40.5 9 46.5 13 50 20 C53.5 13 59.5 9 67 9 C80 9 91 20 91 34 C91 52 78 68 50 92 Z',
  2: 'M50 4 C58 21 70 37 83 50 C70 63 58 79 50 96 C42 79 30 63 17 50 C30 37 42 21 50 4 Z',
  3: 'M41 91 L59 91 C55 84 53.5 77 53 70 C56 74 61 76.5 66.5 76.5 C76.5 76.5 84.5 68.5 84.5 58.5 C84.5 48.5 76.5 40.5 66.5 40.5 C64 40.5 61.5 41 59.5 42 C63.5 38.5 66 33.5 66 28 C66 18 58.5 10 50 10 C41.5 10 34 18 34 28 C34 33.5 36.5 38.5 40.5 42 C38.5 41 36 40.5 33.5 40.5 C23.5 40.5 15.5 48.5 15.5 58.5 C15.5 68.5 23.5 76.5 33.5 76.5 C39 76.5 44 74 47 70 C46.5 77 45 84 41 91 Z',
};

function glyph(suit: Suit, x: number, y: number, size: number, rotated = false): string {
  const scale = size / 100;
  const flip = rotated ? ' transform="rotate(180 50 50)"' : '';
  return `<g transform="translate(${x - size / 2} ${y - size / 2}) scale(${scale})"><path d="${SUIT_PATHS[suit]}"${flip} class="pip s${suit}"/></g>`;
}

/** Classic pip arrangements for ranks 2–10, as [xFraction, yFraction] of the pip area. */
const PIP_LAYOUTS: Record<number, Array<[number, number]>> = {
  2: [
    [0.5, 0],
    [0.5, 1],
  ],
  3: [
    [0.5, 0],
    [0.5, 0.5],
    [0.5, 1],
  ],
  4: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  5: [
    [0, 0],
    [1, 0],
    [0.5, 0.5],
    [0, 1],
    [1, 1],
  ],
  6: [
    [0, 0],
    [1, 0],
    [0, 0.5],
    [1, 0.5],
    [0, 1],
    [1, 1],
  ],
  7: [
    [0, 0],
    [1, 0],
    [0.5, 0.25],
    [0, 0.5],
    [1, 0.5],
    [0, 1],
    [1, 1],
  ],
  8: [
    [0, 0],
    [1, 0],
    [0.5, 0.25],
    [0, 0.5],
    [1, 0.5],
    [0.5, 0.75],
    [0, 1],
    [1, 1],
  ],
  9: [
    [0, 0],
    [1, 0],
    [0, 1 / 3],
    [1, 1 / 3],
    [0.5, 0.5],
    [0, 2 / 3],
    [1, 2 / 3],
    [0, 1],
    [1, 1],
  ],
  10: [
    [0, 0],
    [1, 0],
    [0.5, 1 / 6],
    [0, 1 / 3],
    [1, 1 / 3],
    [0, 2 / 3],
    [1, 2 / 3],
    [0.5, 5 / 6],
    [0, 1],
    [1, 1],
  ],
};

const PIP_AREA = { x0: 78, x1: 172, y0: 84, y1: 266 };

function pips(suit: Suit, rank: number): string {
  const layout = PIP_LAYOUTS[rank];
  if (!layout) return '';
  const { x0, x1, y0, y1 } = PIP_AREA;
  return layout
    .map(([fx, fy]) => {
      const x = x0 + fx * (x1 - x0);
      const y = y0 + fy * (y1 - y0);
      return glyph(suit, x, y, 44, fy > 0.5);
    })
    .join('');
}

function cornerIndex(suit: Suit, rank: number): string {
  const label = RANK_LABELS[rank];
  const index = `
    <text x="30" y="47" text-anchor="middle" class="idx s${suit}">${label}</text>
    ${glyph(suit, 30, 74, 26)}`;
  return `
    <g class="corner">${index}</g>
    <g class="corner" transform="rotate(180 ${W / 2} ${H / 2})">${index}</g>`;
}

/** Court cards: a quiet double frame with a large central glyph under a crest letter. */
function court(suit: Suit, rank: number): string {
  const label = RANK_LABELS[rank];
  const crest =
    rank === 13
      ? // crown
        'M92 96 L98 76 L112 88 L125 70 L138 88 L152 76 L158 96 Z'
      : rank === 12
        ? // coronet
          'M94 96 Q125 66 156 96 L150 96 Q125 78 100 96 Z M118 78 L125 64 L132 78 Z'
        : // banner
          'M100 70 L150 70 L150 92 L125 84 L100 92 Z';
  return `
    <rect x="52" y="58" width="146" height="234" rx="10" class="court-frame"/>
    <rect x="60" y="66" width="130" height="218" rx="6" class="court-frame thin"/>
    <path d="${crest}" class="crest s${suit}"/>
    ${glyph(suit, 125, 178, 96)}
    <text x="125" y="272" text-anchor="middle" class="court-letter s${suit}">${label}</text>
    ${glyph(suit, 71, 79, 18)}
    <g transform="rotate(180 125 175)">${glyph(suit, 71, 79, 18)}</g>`;
}

function ace(suit: Suit): string {
  return `
    <g class="ace-halo">${glyph(suit, 125, 175, 150)}</g>
    ${glyph(suit, 125, 175, 118)}`;
}

export function cardFaceSVG(suit: Suit, rank: number): string {
  const middle = rank === 1 ? ace(suit) : rank >= 11 ? court(suit, rank) : pips(suit, rank);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${CORNER}" class="card-paper"/>
    ${cornerIndex(suit, rank)}
    ${middle}
  </svg>`;
}

const BACK_PATTERNS: Record<CardBack, (id: string) => string> = {
  lattice: (id) => `
    <pattern id="${id}" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="34" height="34" class="back-field"/>
      <path d="M0 8.5 H34 M0 25.5 H34" class="back-line"/>
      <path d="M8.5 0 V34 M25.5 0 V34" class="back-line thin"/>
    </pattern>`,
  pinstripe: (id) => `
    <pattern id="${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
      <rect width="14" height="14" class="back-field"/>
      <path d="M0 3 H14" class="back-line"/>
      <path d="M0 9 H14" class="back-line thin"/>
    </pattern>`,
  quatrefoil: (id) => `
    <pattern id="${id}" width="40" height="40" patternUnits="userSpaceOnUse">
      <rect width="40" height="40" class="back-field"/>
      <circle cx="20" cy="20" r="5.5" class="back-dot"/>
      <circle cx="0" cy="0" r="3" class="back-dot"/>
      <circle cx="40" cy="0" r="3" class="back-dot"/>
      <circle cx="0" cy="40" r="3" class="back-dot"/>
      <circle cx="40" cy="40" r="3" class="back-dot"/>
    </pattern>`,
};

let backCounter = 0;

export function cardBackSVG(design: CardBack): string {
  // Unique pattern ids: 104 backs share a page, ids must not collide.
  const id = `bk-${design}-${backCounter++}`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>${BACK_PATTERNS[design](id)}</defs>
    <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${CORNER}" class="back-paper"/>
    <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="15" fill="url(#${id})"/>
    <rect x="8" y="8" width="${W - 16}" height="${H - 16}" rx="15" class="back-frame"/>
    <rect x="17" y="17" width="${W - 34}" height="${H - 34}" rx="9" class="back-frame thin"/>
  </svg>`;
}

/** Small standalone glyph (for HUD, buttons, foundations). */
export function suitGlyphSVG(suit: Suit, size = 16): string {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><path d="${SUIT_PATHS[suit]}" class="pip s${suit}"/></svg>`;
}

export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
