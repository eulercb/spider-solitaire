import { gsap } from 'gsap';
import type { Card, GameState } from '../engine';
import { COLUMN_COUNT } from '../engine';
import type { Settings } from '../game/settings';
import { cardBackSVG, cardFaceSVG } from './cards';
import { computeMetrics, placeCards, type CardPlace, type Metrics } from './layout';

export interface BoardElements {
  app: HTMLElement;
  board: HTMLElement;
  stock: HTMLElement;
  foundation: HTMLElement;
}

/**
 * Owns the 104 card nodes — one per physical card, created once per game and
 * repositioned for their whole life. Only transforms ever change; the engine
 * state is the single source of truth and the view reconciles to it.
 */
export class BoardView {
  readonly els: BoardElements;
  private layer: HTMLElement;
  private slots: HTMLElement[] = [];
  private nodes = new Map<number, HTMLElement>();
  private inners = new Map<number, HTMLElement>();
  metrics!: Metrics;
  /** Last applied resting place per card. */
  places = new Map<number, CardPlace>();
  /** Cards whose DOM transform was touched outside a render (drag). */
  dirty = new Set<number>();
  /** Cards currently pinned under the player's finger — renders must not move them. */
  held = new Set<number>();

  constructor(els: BoardElements) {
    this.els = els;
    this.layer = document.createElement('div');
    this.layer.id = 'cards';
    // The card layer is pointer-driven scenery; game state reaches assistive
    // tech through the HUD meters, plate counts, and toast live region.
    this.layer.setAttribute('aria-hidden', 'true');
    els.app.appendChild(this.layer);
    for (let i = 0; i < COLUMN_COUNT; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.column = String(i);
      els.board.appendChild(slot);
      this.slots.push(slot);
    }
    this.refreshMetrics();
  }

  refreshMetrics(): Metrics {
    this.metrics = computeMetrics(this.els.app, this.els.board, this.els.stock, this.els.foundation);
    this.slots.forEach((slot, i) => {
      const appRect = this.els.app.getBoundingClientRect();
      const boardRect = this.els.board.getBoundingClientRect();
      slot.style.transform = `translate(${
        this.metrics.columnX[i] - (boardRect.left - appRect.left)
      }px, ${this.metrics.boardTop - (boardRect.top - appRect.top)}px)`;
    });
    return this.metrics;
  }

  /** (Re)build card nodes for a new game or a deck-style change. */
  build(state: GameState, settings: Settings): void {
    this.layer.textContent = '';
    this.nodes.clear();
    this.inners.clear();
    this.places.clear();
    this.dirty.clear();
    const all: Card[] = [
      ...state.columns.flat(),
      ...state.stock,
      ...state.foundations.flat(),
    ];
    for (const card of all) {
      const node = document.createElement('div');
      node.className = 'card';
      node.dataset.id = String(card.id);
      const inner = document.createElement('div');
      inner.className = 'card-inner';
      const front = document.createElement('div');
      front.className = 'face front';
      front.innerHTML = cardFaceSVG(card.suit, card.rank);
      const back = document.createElement('div');
      back.className = 'face back';
      back.innerHTML = cardBackSVG(settings.cardBack);
      inner.append(front, back);
      node.appendChild(inner);
      this.layer.appendChild(node);
      this.nodes.set(card.id, node);
      this.inners.set(card.id, inner);
      gsap.set(inner, { rotationY: card.faceUp ? 0 : 180 });
    }
  }

  /** Re-skin backs (setting change) without touching layout. */
  restyleBacks(settings: Settings): void {
    for (const node of this.nodes.values()) {
      const back = node.querySelector<HTMLElement>('.face.back');
      if (back) back.innerHTML = cardBackSVG(settings.cardBack);
    }
  }

  node(id: number): HTMLElement {
    const el = this.nodes.get(id);
    if (!el) throw new Error(`no node for card ${id}`);
    return el;
  }

  inner(id: number): HTMLElement {
    const el = this.inners.get(id);
    if (!el) throw new Error(`no inner for card ${id}`);
    return el;
  }

  computePlaces(state: GameState): Map<number, CardPlace> {
    return placeCards(state, this.metrics);
  }

  /** Instantly park every card at its place (resume, reduced motion). */
  applyInstant(places: Map<number, CardPlace>): void {
    for (const [id, place] of places) {
      const node = this.nodes.get(id);
      const inner = this.inners.get(id);
      if (!node || !inner) continue;
      gsap.set(node, { x: place.x, y: place.y, scale: 1, rotation: 0 });
      node.style.zIndex = String(place.z);
      gsap.set(inner, { rotationY: place.faceUp ? 0 : 180 });
    }
    this.places = places;
    this.dirty.clear();
  }

  setColumnHighlights(columns: number[], hovered: number | null): void {
    this.slots.forEach((slot, i) => {
      slot.classList.toggle('drop-ok', columns.includes(i));
      slot.classList.toggle('drop-hover', hovered === i);
    });
  }

  /** The column whose horizontal band contains x (app coordinates). */
  columnAtX(x: number): number | null {
    const { columnX, cardW, gap } = this.metrics;
    for (let i = 0; i < columnX.length; i++) {
      if (x >= columnX[i] - gap / 2 && x <= columnX[i] + cardW + gap / 2) return i;
    }
    return null;
  }
}
