import { gsap } from 'gsap';
import type { BoardView } from '../view/board';
import type { Settings } from '../game/settings';

export interface CardLocation {
  zone: 'column' | 'stock' | 'foundation';
  column: number;
  index: number;
}

export interface PointerCallbacks {
  locate(id: number): CardLocation | null;
  /** Card ids of the movable run starting at (column, index), or null if not grabbable. */
  grabRun(column: number, index: number): number[] | null;
  legalDestinations(column: number, index: number): number[];
  drop(from: number, index: number, to: number): void;
  tap(column: number, index: number): void;
  tapStock(): void;
  invalid(ids: number[]): void;
}

const DRAG_THRESHOLD = 7;
const TAP_MS = 400;
const TAP_DRIFT = 9;

/**
 * One unified Pointer Events pipeline: a press either becomes a drag (past
 * the movement threshold) or resolves as a tap on release. Both interaction
 * modes are always live; settings can switch either off.
 */
export class PointerInput {
  private board: BoardView;
  private callbacks: PointerCallbacks;
  private settings: Settings;
  enabled = true;

  private pointerId: number | null = null;
  private pressedId = -1;
  private startX = 0;
  private startY = 0;
  private startedAt = 0;
  private origin: CardLocation | null = null;
  private runIds: number[] = [];
  private legal: number[] = [];
  private dragging = false;
  private appRect = { left: 0, top: 0 };
  private lastX = 0;
  private tilt = 0;

  constructor(board: BoardView, settings: Settings, callbacks: PointerCallbacks) {
    this.board = board;
    this.settings = settings;
    this.callbacks = callbacks;
    const app = board.els.app;
    app.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onCancel);
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
  }

  private onDown = (event: PointerEvent): void => {
    if (!this.enabled || this.pointerId !== null) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, dialog, a, input, select, label')) return;
    const cardEl = target.closest<HTMLElement>('.card');
    if (!cardEl) return;
    const id = Number(cardEl.dataset.id);
    const location = this.callbacks.locate(id);
    if (!location || location.zone === 'foundation') return;

    event.preventDefault();
    this.pressedId = id;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.lastX = event.clientX;
    this.startedAt = performance.now();
    this.origin = location;
    this.dragging = false;
    this.tilt = 0;
    const rect = this.board.els.app.getBoundingClientRect();
    this.appRect = { left: rect.left, top: rect.top };
    this.runIds =
      location.zone === 'column'
        ? (this.callbacks.grabRun(location.column, location.index) ?? [])
        : [];
  };

  private onMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.origin) return;
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;

    if (!this.dragging) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (
        !this.settings.dragToMove ||
        this.origin.zone !== 'column' ||
        this.runIds.length === 0
      ) {
        return;
      }
      this.beginDrag();
    }
    if (this.dragging) {
      event.preventDefault();
      this.followPointer(event.clientX, event.clientY);
    }
  };

  private onUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId || !this.origin) return;
    const origin = this.origin;
    const wasDrag = this.dragging;
    const elapsed = performance.now() - this.startedAt;
    const drift = Math.hypot(event.clientX - this.startX, event.clientY - this.startY);
    this.pointerId = null;
    this.origin = null;

    if (wasDrag) {
      this.dragging = false;
      this.board.setColumnHighlights([], null);
      this.settleTilt();
      const to = this.dropColumn();
      if (to !== null && this.legal.includes(to)) {
        this.callbacks.drop(origin.column, origin.index, to);
      } else {
        // Snap back: no state change; the animator glides dirty cards home.
        this.callbacks.invalid([]);
      }
      return;
    }

    // Tap resolution.
    if (elapsed > TAP_MS || drift > TAP_DRIFT) return;
    if (origin.zone === 'stock') {
      this.callbacks.tapStock();
      return;
    }
    if (origin.zone !== 'column' || !this.settings.tapToMove) return;
    if (this.runIds.length === 0) {
      // Not a movable run — tell the player with a shiver.
      this.callbacks.invalid([this.pressedId]);
      return;
    }
    this.callbacks.tap(origin.column, origin.index);
  };

  private onCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.origin = null;
    if (this.dragging) {
      this.dragging = false;
      this.board.setColumnHighlights([], null);
      this.settleTilt();
      this.callbacks.invalid([]);
    }
  };

  private beginDrag(): void {
    if (!this.origin) return;
    this.dragging = true;
    this.legal = this.callbacks.legalDestinations(this.origin.column, this.origin.index);
    this.board.setColumnHighlights(this.legal, null);
    for (const id of this.runIds) {
      const node = this.board.node(id);
      gsap.killTweensOf(node);
      this.board.dirty.add(id);
      node.classList.add('lifted');
      node.style.zIndex = String(900 + this.runIds.indexOf(id));
    }
  }

  /** The stack rides one card-height above the finger so the thumb never hides it. */
  private followPointer(clientX: number, clientY: number): void {
    const { cardW, cardH, fanUp } = this.board.metrics;
    const x = clientX - this.appRect.left - cardW / 2;
    const y = clientY - this.appRect.top - cardH * 1.18;
    const vx = clientX - this.lastX;
    this.lastX = clientX;
    this.tilt = Math.max(-6, Math.min(6, this.tilt * 0.8 + vx * 0.35));
    const spacing = fanUp * 0.9;
    this.runIds.forEach((id, i) => {
      gsap.set(this.board.node(id), {
        x,
        y: y + i * spacing,
        rotation: this.tilt,
        scale: 1.045,
      });
    });
    const hover = this.board.columnAtX(x + cardW / 2);
    this.board.setColumnHighlights(this.legal, hover !== null && this.legal.includes(hover) ? hover : null);
  }

  private dropColumn(): number | null {
    const first = this.runIds[0];
    if (first === undefined) return null;
    const node = this.board.node(first);
    const x = Number(gsap.getProperty(node, 'x')) + this.board.metrics.cardW / 2;
    return this.board.columnAtX(x);
  }

  private settleTilt(): void {
    for (const id of this.runIds) {
      const node = this.board.node(id);
      node.classList.remove('lifted');
      gsap.to(node, { rotation: 0, scale: 1, duration: 0.18 });
    }
  }
}
