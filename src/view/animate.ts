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
  /** Cards currently wearing the sequence-clear flourish. */
  private gilded = new Set<number>();
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
    // Killing the previous timeline never fires its onCompletes, so nothing
    // below may depend on them: the catch-all pass reconciles against the
    // DOM's *actual* transforms and heals whatever the kill left behind.
    this.timeline?.kill();
    this.timeline = null;
    for (const id of this.gilded) board.node(id).classList.remove('gilded');
    this.gilded.clear();

    const factor = this.factor();
    if (factor === 0 || cause === 'restore') {
      board.applyInstant(places);
      if (events.some((event) => event.kind === 'completed')) this.onSound('complete');
      return;
    }

    const tl = gsap.timeline();
    this.timeline = tl;
    const staged = new Set<number>();

    // Cards that move *and* complete a sequence in the same turn must first
    // land on the column, then sweep to the foundation — their final places
    // point at the foundation, so synthesize the intermediate column spot.
    const between = this.intermediatePlaces(state, events);

    if (cause === 'new-game') {
      this.stageOpeningDeal(tl, state, places, staged, factor);
    }

    for (const event of events) {
      if (event.kind === 'dealt') {
        this.stageStockDeal(tl, event.ids, places, between, staged, factor);
      }
      if (event.kind === 'moved') {
        this.stageMove(tl, event.ids, places, between, staged, factor);
      }
      if (event.kind === 'completed') this.stageCompleted(tl, event.ids, places, staged, factor);
      if (event.kind === 'flipped') this.stageFlip(tl, event.id, places, staged, factor);
    }

    // Catch-all reconcile against the real DOM: fan compression, undo/redo,
    // interrupted drags and killed tweens all glide home from wherever the
    // previous frame actually left them.
    const glide = 0.22 * factor;
    for (const [id, place] of places) {
      if (staged.has(id)) continue;
      if (board.held.has(id)) continue; // never yank cards out of the player's hand
      const node = board.node(id);
      const inner = board.inner(id);
      const moved =
        Math.abs(Number(gsap.getProperty(node, 'x')) - place.x) > 0.5 ||
        Math.abs(Number(gsap.getProperty(node, 'y')) - place.y) > 0.5 ||
        Math.abs(Number(gsap.getProperty(node, 'rotation'))) > 0.2 ||
        Math.abs(Number(gsap.getProperty(node, 'scale')) - 1) > 0.02 ||
        board.dirty.has(id);
      const targetY = place.faceUp ? 0 : 180;
      const currentY = ((Number(gsap.getProperty(inner, 'rotationY')) % 360) + 360) % 360;
      const flipped = Math.abs(currentY - targetY) > 1;
      if (moved) {
        node.style.zIndex = String(300 + place.z);
        tl.to(
          node,
          {
            x: place.x,
            y: place.y,
            scale: 1,
            rotation: 0,
            duration: glide,
            ease: 'power2.out',
            onComplete: () => {
              node.style.zIndex = String(place.z);
            },
          },
          0,
        );
      } else {
        node.style.zIndex = String(place.z);
      }
      if (flipped) {
        tl.to(
          inner,
          { rotationY: targetY, duration: 0.3 * factor, ease: 'power2.inOut' },
          0,
        );
      }
    }
    if ((cause === 'undo' || cause === 'redo') && places.size > 0) this.onSound('move');

    board.places = places;
    board.dirty.clear();
  }

  /**
   * Pre-removal column positions for cards that a 'completed' event lifts to
   * the foundation this same render: fanned below whatever remains in the
   * column they completed on.
   */
  private intermediatePlaces(
    state: GameState,
    events: GameEvent[],
  ): Map<number, { x: number; y: number }> {
    const between = new Map<number, { x: number; y: number }>();
    const { metrics } = this.board;
    for (const event of events) {
      if (event.kind !== 'completed') continue;
      const pile = state.columns[event.column];
      const remaining = pile.length;
      const downCount = pile.filter((card) => !card.faceUp).length;
      let y =
        metrics.boardTop +
        downCount * metrics.fanDown +
        Math.max(0, remaining - downCount) * metrics.fanUp;
      const x = metrics.columnX[event.column];
      for (const id of event.ids) {
        between.set(id, { x, y });
        y += metrics.fanUp;
      }
    }
    return between;
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
    between: Map<number, { x: number; y: number }>,
    staged: Set<number>,
    factor: number,
  ): void {
    const board = this.board;
    this.onSound('deal');
    ids.forEach((id, i) => {
      staged.add(id);
      const place = places.get(id)!;
      const target = between.get(id) ?? place;
      const node = board.node(id);
      const at = i * 0.045 * factor;
      node.style.zIndex = String(400 + i);
      tl.to(node, { x: target.x, y: target.y, duration: 0.36 * factor, ease: 'power2.out' }, at);
      tl.to(
        board.inner(id),
        { rotationY: 0, duration: 0.26 * factor, ease: 'power2.inOut' },
        at + 0.16 * factor,
      );
      if (!between.has(id)) {
        tl.add(() => {
          node.style.zIndex = String(place.z);
        }, at + 0.4 * factor);
      }
    });
  }

  /** A run glides to its target with a tiny settle. */
  private stageMove(
    tl: gsap.core.Timeline,
    ids: number[],
    places: Map<number, CardPlace>,
    between: Map<number, { x: number; y: number }>,
    staged: Set<number>,
    factor: number,
  ): void {
    const board = this.board;
    this.onSound('move');
    ids.forEach((id, i) => {
      staged.add(id);
      const place = places.get(id)!;
      const target = between.get(id) ?? place;
      const node = board.node(id);
      node.style.zIndex = String(300 + place.z);
      tl.to(
        node,
        {
          x: target.x,
          y: target.y,
          scale: 1,
          rotation: 0,
          duration: 0.3 * factor,
          ease: 'back.out(1.15)',
          onComplete: () => {
            if (!between.has(id)) node.style.zIndex = String(place.z);
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
        this.gilded.add(id);
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
        this.gilded.delete(id);
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
