/**
 * Unlimited undo/redo over compact serialized snapshots. Snapshots restore
 * everything — face-down state, removed sequences, score — because they are
 * the whole state. Capped generously to keep localStorage happy.
 */
const CAP = 1200;

export class History {
  past: string[] = [];
  future: string[] = [];

  record(snapshot: string): void {
    this.past.push(snapshot);
    if (this.past.length > CAP) this.past.shift();
    this.future = [];
  }

  undo(current: string): string | null {
    const previous = this.past.pop();
    if (previous === undefined) return null;
    this.future.push(current);
    return previous;
  }

  redo(current: string): string | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
