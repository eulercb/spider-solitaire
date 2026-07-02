import { gsap } from 'gsap';
import type { GameEvent, GameState } from '../engine';
import type { Settings } from '../game/settings';
import type { BoardView } from './board';
import type { CardPlace } from './layout';

export type RenderCause =
  | 'new-game'
  | 'move'
  | 'deal'
  | 'undo'
  | 'redo'
  | 'restore'
  | 'reflow'
  | 'auto';

export type SoundName = 'deal' | 'move' | 'flip' | 'invalid' | 'complete' | 'win';

const SPEED: Record<Settings['animationSpeed'], number> = {
  slow: 1.6,
  normal: 1,
  fast: 0.55,
  off: 0,
};

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * All choreography lives here. The engine has already committed the new
 * state before any tween starts, so interrupting an animation can never
 * desync model and view — a fresh render simply kills the previous timeline
 * and tweens everything toward the latest truth.
 */
export class Animator {
  private board: BoardView;
  private settings: Settings;
  private timeline: gsap.core.Timeline | null = null;
  onSound: (name: SoundName) => void = () => {};

  constructor(board: BoardView, settings: Settings) {
    this.board = board;
    this.settings = settings;
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  private factor(): number {
    if (reducedMotionQuery.matches) return 0;
    return SPEED[this.settings.animationSpeed];
  }

  /** Reconcile the DOM to the state, choreographing the given events. */
  render(state: GameState, events: GameEvent[], cause: RenderCause): void {
    const board = this.board;
    const places = board.computePlaces(state);
    this.timeline?.kill();
    this.timeline = null;

    const factor = this.factor();
    if (factor === 0 || cause === 'restore') {
      board.applyInstant(places);
      if (events.some((event) => event.kind === 'completed')) this.onSound('complete');
      return;
    }

    const tl = gsap.timeline();
    this.timeline = tl;
    const staged = new Set<number>();

    if (cause === 'new-game') {
      this.stageOpeningDeal(tl, state, places, staged, factor);
    }

    for (const event of events) {
      if (event.kind === 'dealt') this.stageStockDeal(tl, event.ids, places, staged, factor);
      if (event.kind === 'moved') this.stageMove(tl, event.ids, places, staged, factor);
      if (event.kind === 'completed') this.stageCompleted(tl, event.ids, places, staged, factor);
      if (event.kind === 'flipped') this.stageFlip(tl, event.id, places, staged, factor);
    }

    // Catch-all reconcile: anything not choreographed (fan compression,
    // undo/redo, interrupted drags) glides to its resting place.
    const glide = 0.22 * factor;
    for (const [id, place] of places) {
      if (staged.has(id)) continue;
      const previous = board.places.get(id);
      const moved =
        !previous ||
        previous.x !== place.x ||
        previous.y !== place.y ||
        board.dirty.has(id);
      const flipped = !previous || previous.faceUp !== place.faceUp;
      if (moved) {
        const node = board.node(id);
        node.style.zIndex = String(300 + place.z);
        tl.to(
          node,
          {
            x: place.x,
            y: place.y,
            scale: 1,
            duration: glide,
            ease: 'power2.out',
            onComplete: () => {
              node.style.zIndex = String(place.z);
            },
          },
          0,
        );
      } else {
        board.node(id).style.zIndex = String(place.z);
      }
      if (flipped) {
        tl.to(
          board.inner(id),
          { rotationY: place.faceUp ? 0 : 180, duration: 0.3 * factor, ease: 'power2.inOut' },
          0,
        );
      }
    }
    if ((cause === 'undo' || cause === 'redo') && places.size > 0) this.onSound('move');

    board.places = places;
    board.dirty.clear();
  }

  /** Cards fly off the banked stock in deal order, flipping as they land. */
  private stageOpeningDeal(
    tl: gsap.core.Timeline,
    state: GameState,
    places: Map<number, CardPlace>,
    staged: Set<number>,
    factor: number,
  ): void {
    const board = this.board;
    const { stock } = board.metrics;
    // Row-major deal order, exactly how the engine dealt.
    const order: number[] = [];
    const maxLen = Math.max(...state.columns.map((pile) => pile.length));
    for (let row = 0; row < maxLen; row++) {
      for (const pile of state.columns) {
        if (pile[row]) order.push(pile[row].id);
      }
    }
    // Park everything on the stock first.
    for (const [id, place] of places) {
      const node = board.node(id);
      gsap.set(node, { x: stock.x, y: stock.y, scale: 1 });
      gsap.set(board.inner(id), { rotationY: 180 });
      node.style.zIndex = String(place.zone === 'column' ? 200 - order.indexOf(id) : place.z);
    }
    this.onSound('deal');
    const per = 0.028 * factor;
    order.forEach((id, i) => {
      staged.add(id);
      const place = places.get(id)!;
      const node = board.node(id);
      const at = i * per;
      tl.to(
        node,
        {
          x: place.x,
          y: place.y,
          duration: 0.34 * factor,
          ease: 'power2.out',
          onComplete: () => {
            node.style.zIndex = String(place.z);
          },
        },
        at,
      );
      if (place.faceUp) {
        tl.to(
          board.inner(id),
          { rotationY: 0, duration: 0.28 * factor, ease: 'power2.inOut' },
          at + 0.18 * factor,
        );
      }
    });
    // Stock cards keep their banked positions.
    for (const [id, place] of places) {
      if (place.zone === 'stock') {
        staged.add(id);
        gsap.set(board.node(id), { x: place.x, y: place.y });
        board.node(id).style.zIndex = String(place.z);
      }
    }
  }

  private stageStockDeal(
    tl: gsap.core.Timeline,
    ids: number[],
    places: Map<number, CardPlace>,
    staged: Set<number>,
    factor: number,
  ): void {
    const board = this.board;
    this.onSound('deal');
    ids.forEach((id, i) => {
      staged.add(id);
      const place = places.get(id)!;
      const node = board.node(id);
      const at = i * 0.045 * factor;
      node.style.zIndex = String(400 + i);
      tl.to(node, { x: place.x, y: place.y, duration: 0.36 * factor, ease: 'power2.out' }, at);
      tl.to(
        board.inner(id),
        { rotationY: 0, duration: 0.26 * factor, ease: 'power2.inOut' },
        at + 0.16 * factor,
      );
      tl.add(() => {
        node.style.zIndex = String(place.z);
      }, at + 0.4 * factor);
    });
  }

  /** A run glides to its target with a tiny settle. */
  private stageMove(
    tl: gsap.core.Timeline,
    ids: number[],
    places: Map<number, CardPlace>,
    staged: Set<number>,
    factor: number,
  ): void {
    const board = this.board;
    this.onSound('move');
    ids.forEach((id, i) => {
      staged.add(id);
      const place = places.get(id)!;
      const node = board.node(id);
      node.style.zIndex = String(300 + place.z);
      tl.to(
        node,
        {
          x: place.x,
          y: place.y,
          scale: 1,
          duration: 0.3 * factor,
          ease: 'back.out(1.15)',
          onComplete: () => {
            node.style.zIndex = String(place.z);
          },
        },
        i * 0.016 * factor,
      );
    });
  }

  /** K→A sweeps off to the foundation with a brass flourish. */
  private stageCompleted(
    tl: gsap.core.Timeline,
    ids: number[],
    places: Map<number, CardPlace>,
    staged: Set<number>,
    factor: number,
  ): void {
    const board = this.board;
    const start = Math.max(0.25 * factor, tl.duration() * 0.55);
    tl.add(() => this.onSound('complete'), start);
    ids.forEach((id, i) => {
      staged.add(id);
      const place = places.get(id)!;
      const node = board.node(id);
      tl.add(() => {
        node.classList.add('gilded');
        node.style.zIndex = String(600 + i);
      }, start);
      tl.to(node, { scale: 1.06, duration: 0.16 * factor, ease: 'power1.out' }, start);
      tl.to(
        node,
        {
          x: place.x,
          y: place.y,
          scale: 1,
          duration: 0.42 * factor,
          ease: 'power3.inOut',
        },
        start + 0.18 * factor + (ids.length - 1 - i) * 0.03 * factor,
      );
      tl.add(() => {
        node.classList.remove('gilded');
        node.style.zIndex = String(place.z);
      }, start + 0.7 * factor + (ids.length - 1 - i) * 0.03 * factor);
    });
  }

  private stageFlip(
    tl: gsap.core.Timeline,
    id: number,
    places: Map<number, CardPlace>,
    staged: Set<number>,
    factor: number,
  ): void {
    const place = places.get(id);
    if (!place) return;
    staged.add(id);
    const board = this.board;
    const node = board.node(id);
    this.onSound('flip');
    node.style.zIndex = String(place.z);
    tl.to(board.node(id), { x: place.x, y: place.y, duration: 0.2 * factor }, 0);
    tl.to(
      board.inner(id),
      { rotationY: place.faceUp ? 0 : 180, duration: 0.3 * factor, ease: 'power2.inOut' },
      0.12 * factor,
    );
  }

  /** Invalid move: a short horizontal shiver, then business as usual. */
  shake(ids: number[]): void {
    this.onSound('invalid');
    const factor = this.factor();
    if (factor === 0) return;
    for (const id of ids) {
      const node = this.board.node(id);
      const place = this.board.places.get(id);
      const x = place ? place.x : Number(gsap.getProperty(node, 'x'));
      gsap.timeline().to(node, {
        keyframes: [
          { x: x - 6, duration: 0.05 },
          { x: x + 5, duration: 0.05 },
          { x: x - 3, duration: 0.05 },
          { x, duration: 0.06 },
        ],
      });
    }
  }

  /** Pulse the hinted run and destination. */
  pulse(ids: number[], column: number | null): void {
    for (const id of ids) {
      this.board.node(id).classList.add('hinted');
      setTimeout(() => this.board.node(id).classList.remove('hinted'), 1600);
    }
    if (column !== null) {
      this.board.setColumnHighlights([column], column);
      setTimeout(() => this.board.setColumnHighlights([], null), 1600);
    }
  }

}
