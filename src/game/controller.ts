import {
  applyMove,
  bestDestination,
  canDeal,
  canGrab,
  createGame,
  deserialize,
  findAutoFinish,
  findHint,
  isDeadlocked,
  isWon,
  legalDestinations,
  randomSeed,
  serialize,
  type GameEvent,
  type GameState,
  type Hint,
  type Move,
  type SuitCount,
} from '../engine';
import { History } from './history';
import type { SaveManager } from './persistence';
import { recordLoss, recordWin, type Stats } from './stats';
import type { RenderCause } from '../view/animate';
import type { CardLocation } from '../input/pointer';

export interface ControllerEvents {
  render(state: GameState, events: GameEvent[], cause: RenderCause): void;
  status(): void;
  message(text: string): void;
  invalid(ids: number[]): void;
  won(record: { score: number; timeMs: number; moves: number }): void;
  deadlock(): void;
  autoFinishAvailable(): void;
}

/**
 * The state machine between engine, view, input, and storage. Engine state
 * commits synchronously on every action; rendering and animation are
 * downstream of the committed truth, so interruptions can't desync anything.
 */
export class GameController {
  state: GameState;
  history = new History();
  stats: Stats;
  elapsedMs = 0;
  /** Whether this deal has already been counted in stats (won or conceded). */
  counted = false;
  finished = false;

  private saves: SaveManager;
  private events: ControllerEvents;
  private tickHandle: number | null = null;
  private lastTick = 0;
  private autoFinishLine: Move[] | null = null;
  private autoFinishRunning = false;
  private didResume = false;

  constructor(saves: SaveManager, events: ControllerEvents, initialSuits: SuitCount) {
    this.saves = saves;
    this.events = events;
    this.stats = saves.loadStats();
    const resumed = saves.loadGame();
    if (resumed && !isWon(resumed.state)) {
      this.state = resumed.state;
      this.history.past = resumed.past;
      this.history.future = resumed.future;
      this.elapsedMs = resumed.elapsedMs;
      this.counted = resumed.counted;
      this.didResume = true;
      this.autoFinishLine = findAutoFinish(this.state);
    } else {
      this.state = createGame(randomSeed(), initialSuits);
    }
  }

  get resumedFromSave(): boolean {
    return this.didResume;
  }

  startTicking(onTick: () => void): void {
    this.lastTick = performance.now();
    this.tickHandle = window.setInterval(() => {
      if (document.hidden || this.finished) {
        this.lastTick = performance.now();
        return;
      }
      const now = performance.now();
      this.elapsedMs += now - this.lastTick;
      this.lastTick = now;
      onTick();
    }, 1000);
  }

  stopTicking(): void {
    if (this.tickHandle !== null) window.clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  /** Concede the current deal in stats if it was really underway. */
  private concedeIfUnderway(): void {
    if (!this.counted && !this.finished && this.state.moveCount > 0) {
      recordLoss(this.stats, this.state.suitCount);
      this.saves.saveStats(this.stats);
    }
  }

  newGame(suitCount: SuitCount, seed?: number): void {
    this.concedeIfUnderway();
    this.state = createGame(seed ?? randomSeed(), suitCount);
    this.history.clear();
    this.elapsedMs = 0;
    this.counted = false;
    this.finished = false;
    this.autoFinishLine = null;
    this.autoFinishRunning = false;
    this.persist();
    this.events.render(this.state, [], 'new-game');
    this.events.status();
  }

  restartDeal(): void {
    this.newGame(this.state.suitCount, this.state.seed);
  }

  /** Map a card id to where it lives right now. */
  locate(id: number): CardLocation | null {
    for (let column = 0; column < this.state.columns.length; column++) {
      const index = this.state.columns[column].findIndex((card) => card.id === id);
      if (index >= 0) return { zone: 'column', column, index };
    }
    if (this.state.stock.some((card) => card.id === id)) {
      return { zone: 'stock', column: -1, index: -1 };
    }
    if (this.state.foundations.some((run) => run.some((card) => card.id === id))) {
      return { zone: 'foundation', column: -1, index: -1 };
    }
    return null;
  }

  grabRun(column: number, index: number): number[] | null {
    if (this.finished || !canGrab(this.state, column, index)) return null;
    return this.state.columns[column].slice(index).map((card) => card.id);
  }

  legalDestinations(column: number, index: number): number[] {
    if (this.finished) return [];
    return legalDestinations(this.state, column, index);
  }

  moveCard(from: number, index: number, to: number, cause: RenderCause = 'move'): boolean {
    if (this.finished) return false;
    const move: Move = { type: 'card', from, index, to };
    const ids = this.grabRun(from, index);
    if (!ids || !this.legalDestinations(from, index).includes(to)) {
      this.events.invalid(ids ?? []);
      return false;
    }
    this.commit(move, cause);
    return true;
  }

  tapMove(column: number, index: number): void {
    if (this.finished) return;
    const ids = this.grabRun(column, index);
    if (!ids) {
      this.events.invalid([]);
      return;
    }
    const to = bestDestination(this.state, column, index);
    if (to === null) {
      this.events.invalid(ids);
      return;
    }
    this.commit({ type: 'card', from: column, index, to }, 'move');
  }

  deal(): void {
    if (this.finished) return;
    const gate = canDeal(this.state);
    if (!gate.ok) {
      this.events.message(
        gate.reason === 'empty-column'
          ? 'Fill every empty column before dealing a new row.'
          : 'The stock is spent — build with what remains.',
      );
      this.events.invalid([]);
      return;
    }
    this.commit({ type: 'deal' }, 'deal');
  }

  private commit(move: Move, cause: RenderCause): void {
    const snapshot = serialize(this.state);
    const { state, events } = applyMove(this.state, move);
    this.history.record(snapshot);
    this.state = state;
    this.autoFinishLine = null;
    this.persist();
    this.events.render(state, events, cause);
    this.events.status();
    this.afterChange(events);
  }

  private afterChange(events: GameEvent[]): void {
    if (events.some((event) => event.kind === 'won')) {
      this.finished = true;
      if (!this.counted) {
        this.counted = true;
        recordWin(this.stats, this.state.suitCount, this.state.score, this.elapsedMs);
        this.saves.saveStats(this.stats);
      }
      this.persist();
      this.events.won({
        score: this.state.score,
        timeMs: this.elapsedMs,
        moves: this.state.moveCount,
      });
      return;
    }
    if (isDeadlocked(this.state)) {
      this.events.deadlock();
      return;
    }
    if (!this.autoFinishRunning) {
      this.autoFinishLine = findAutoFinish(this.state);
      if (this.autoFinishLine) this.events.autoFinishAvailable();
    }
  }

  /** Play the found winning line, one animated move at a time. */
  autoFinish(intervalMs = 320): void {
    const line = this.autoFinishLine;
    if (!line || this.autoFinishRunning || this.finished) return;
    this.autoFinishRunning = true;
    const step = (moves: Move[]): void => {
      const move = moves.shift();
      if (!move || this.finished) {
        this.autoFinishRunning = false;
        return;
      }
      this.commit(move, 'auto');
      window.setTimeout(() => step(moves), intervalMs);
    };
    step([...line]);
  }

  get autoFinishReady(): boolean {
    return this.autoFinishLine !== null && !this.autoFinishRunning;
  }

  undo(): void {
    if (this.finished || this.autoFinishRunning) return;
    const previous = this.history.undo(serialize(this.state));
    if (previous === null) return;
    this.state = deserialize(previous);
    this.autoFinishLine = findAutoFinish(this.state);
    this.persist();
    this.events.render(this.state, [], 'undo');
    this.events.status();
  }

  undoAll(): void {
    if (this.finished || this.autoFinishRunning) return;
    let previous = this.history.undo(serialize(this.state));
    while (previous !== null) {
      this.state = deserialize(previous);
      previous = this.history.undo(serialize(this.state));
    }
    this.autoFinishLine = findAutoFinish(this.state);
    this.persist();
    this.events.render(this.state, [], 'undo');
    this.events.status();
  }

  redo(): void {
    if (this.finished || this.autoFinishRunning) return;
    const next = this.history.redo(serialize(this.state));
    if (next === null) return;
    this.state = deserialize(next);
    this.autoFinishLine = findAutoFinish(this.state);
    this.persist();
    this.events.render(this.state, [], 'redo');
    this.events.status();
  }

  hint(): Hint {
    if (this.finished) return null;
    return findHint(this.state);
  }

  persist(): void {
    this.saves.saveGame(this.state, this.history, this.elapsedMs, this.counted);
  }
}
