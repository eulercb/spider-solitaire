import type { GameState } from '../engine';
import { COLUMN_COUNT } from '../engine';

/** Where a card should sit, in #app coordinate space. */
export interface CardPlace {
  x: number;
  y: number;
  z: number;
  faceUp: boolean;
  zone: 'column' | 'stock' | 'foundation';
}

export interface Metrics {
  cardW: number;
  cardH: number;
  gap: number;
  padX: number;
  boardTop: number;
  boardHeight: number;
  columnX: number[];
  stock: { x: number; y: number };
  foundation: { x: number; y: number };
  /** Base fan offsets before per-column compression. */
  fanUp: number;
  fanDown: number;
}

const ASPECT = 3.5 / 2.5;
const MIN_FAN_UP_RATIO = 0.16; // keep rank indices readable as long as possible

/**
 * The ten-column problem: card size derives from viewport width, fans derive
 * from card height, and tall columns compress their own fan to stay on the
 * table. Everything is exposed as CSS custom properties too.
 */
export function computeMetrics(
  app: HTMLElement,
  board: HTMLElement,
  stockEl: HTMLElement,
  foundationEl: HTMLElement,
): Metrics {
  const appRect = app.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  const width = boardRect.width;

  const gap = Math.max(3, Math.min(6, width * 0.012));
  const padX = Math.max(4, gap);
  let cardW = (width - padX * 2 - gap * (COLUMN_COUNT - 1)) / COLUMN_COUNT;
  // Landscape guard: never let card height eat more than a third of the board.
  const maxH = boardRect.height / 3.1;
  let cardH = cardW * ASPECT;
  if (cardH > maxH) {
    cardH = maxH;
    cardW = cardH / ASPECT;
  }
  cardW = Math.floor(cardW * 10) / 10;
  cardH = Math.floor(cardW * ASPECT * 10) / 10;

  const usedWidth = cardW * COLUMN_COUNT + gap * (COLUMN_COUNT - 1);
  const startX = boardRect.left - appRect.left + (width - usedWidth) / 2;
  const boardTop = boardRect.top - appRect.top + 6;

  const columnX = Array.from({ length: COLUMN_COUNT }, (_, i) => startX + i * (cardW + gap));

  const stockRect = stockEl.getBoundingClientRect();
  const foundationRect = foundationEl.getBoundingClientRect();

  const metrics: Metrics = {
    cardW,
    cardH,
    gap,
    padX,
    boardTop,
    boardHeight: boardRect.height - 12,
    columnX,
    stock: {
      x: stockRect.left - appRect.left + (stockRect.width - cardW) / 2,
      y: stockRect.top - appRect.top + (stockRect.height - cardH) / 2,
    },
    foundation: {
      x: foundationRect.left - appRect.left + (foundationRect.width - cardW) / 2,
      y: foundationRect.top - appRect.top + (foundationRect.height - cardH) / 2,
    },
    fanUp: Math.round(cardH * 0.285),
    fanDown: Math.max(4, Math.round(cardH * 0.14)),
  };

  const root = document.documentElement;
  root.style.setProperty('--card-w', `${cardW}px`);
  root.style.setProperty('--card-h', `${cardH}px`);
  return metrics;
}

/** Per-column fan offsets, compressed so the column fits the board height. */
export function columnFan(
  metrics: Metrics,
  downCount: number,
  upCount: number,
): { down: number; up: number } {
  let { fanDown: down, fanUp: up } = metrics;
  const height = (n: { down: number; up: number }) =>
    downCount * n.down + Math.max(0, upCount - 1) * n.up + metrics.cardH;
  const available = metrics.boardHeight;
  if (height({ down, up }) <= available) return { down, up };

  // First squeeze face-down cards toward 3px, then both proportionally.
  down = Math.max(3, down * 0.5);
  if (height({ down, up }) <= available) {
    // Recover some face-down spacing if there is room.
    return { down, up };
  }
  const minUp = metrics.cardH * MIN_FAN_UP_RATIO;
  const spread = available - metrics.cardH - downCount * down;
  up = Math.max(minUp, spread / Math.max(1, upCount - 1));
  if (height({ down, up }) > available) {
    // Last resort: squeeze everything uniformly. Gradual, never clipped hit
    // targets — the top card always stays fully on the table.
    const scale = (available - metrics.cardH) / (height({ down, up }) - metrics.cardH);
    down = Math.max(2, down * scale);
    up = Math.max(8, up * scale);
  }
  return { down, up };
}

/** Model → geometry: every card's resting place for the current state. */
export function placeCards(state: GameState, metrics: Metrics): Map<number, CardPlace> {
  const places = new Map<number, CardPlace>();

  state.columns.forEach((pile, column) => {
    const downCount = pile.filter((card) => !card.faceUp).length;
    const upCount = pile.length - downCount;
    const fan = columnFan(metrics, downCount, upCount);
    let y = metrics.boardTop;
    pile.forEach((card, i) => {
      places.set(card.id, {
        x: metrics.columnX[column],
        y,
        z: 10 + i,
        faceUp: card.faceUp,
        zone: 'column',
      });
      y += card.faceUp ? fan.up : fan.down;
    });
  });

  // Banked stacks nudge toward the middle of the table so they never creep
  // off-screen, whichever side the plate sits on (left-handed swaps them).
  const tableMid =
    (metrics.columnX[0] + metrics.columnX[COLUMN_COUNT - 1] + metrics.cardW) / 2;

  // Stock: one visual pile per remaining ten-card deal.
  const stockDir = metrics.stock.x > tableMid ? -1 : 1;
  state.stock.forEach((card, i) => {
    const group = Math.floor(i / COLUMN_COUNT);
    places.set(card.id, {
      x: metrics.stock.x + stockDir * group * 5,
      y: metrics.stock.y,
      z: 1 + i,
      faceUp: false,
      zone: 'stock',
    });
  });

  // Foundations: completed runs rest as one banked pile, latest on top.
  const foundationDir = metrics.foundation.x > tableMid ? -1 : 1;
  state.foundations.forEach((run, f) => {
    run.forEach((card, i) => {
      places.set(card.id, {
        x: metrics.foundation.x + foundationDir * f * 4,
        y: metrics.foundation.y,
        z: 1 + f * 14 + i,
        faceUp: true,
        zone: 'foundation',
      });
    });
  });

  return places;
}
