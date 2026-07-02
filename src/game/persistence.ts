import { deserialize, serialize, type GameState } from '../engine';
import { sanitizeSettings, type Settings } from './settings';
import { sanitizeStats, type Stats } from './stats';
import type { History } from './history';

/**
 * Storage sits behind a tiny interface so the backend could become
 * IndexedDB without touching game code. Every read forgives bad data —
 * a corrupt save clears itself and the game starts fresh, never crashes.
 */
export interface StorageLike {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function localStorageBackend(): StorageLike {
  const memory = new Map<string, string>();
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch {
      return fallback;
    }
  };
  return {
    get: (key) => safe(() => localStorage.getItem(key), memory.get(key) ?? null),
    set: (key, value) => {
      memory.set(key, value);
      safe(() => localStorage.setItem(key, value), undefined);
    },
    remove: (key) => {
      memory.delete(key);
      safe(() => localStorage.removeItem(key), undefined);
    },
  };
}

const SAVE_KEY = 'baize.save.v1';
const SETTINGS_KEY = 'baize.settings.v1';
const STATS_KEY = 'baize.stats.v1';

export interface SaveBlob {
  state: GameState;
  past: string[];
  future: string[];
  elapsedMs: number;
  counted: boolean;
}

export class SaveManager {
  private storage: StorageLike;

  constructor(storage: StorageLike = localStorageBackend()) {
    this.storage = storage;
  }

  loadGame(): SaveBlob | null {
    const raw = this.storage.get(SAVE_KEY);
    if (!raw) return null;
    try {
      const blob = JSON.parse(raw) as {
        state: string;
        past: unknown;
        future: unknown;
        elapsedMs: unknown;
        counted: unknown;
      };
      const state = deserialize(blob.state);
      const strings = (value: unknown): string[] =>
        Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
      return {
        state,
        past: strings(blob.past),
        future: strings(blob.future),
        elapsedMs: typeof blob.elapsedMs === 'number' && blob.elapsedMs >= 0 ? blob.elapsedMs : 0,
        counted: blob.counted === true,
      };
    } catch {
      this.storage.remove(SAVE_KEY);
      return null;
    }
  }

  saveGame(state: GameState, history: History, elapsedMs: number, counted: boolean): void {
    this.storage.set(
      SAVE_KEY,
      JSON.stringify({
        state: serialize(state),
        past: history.past,
        future: history.future,
        elapsedMs: Math.floor(elapsedMs),
        counted,
      }),
    );
  }

  clearGame(): void {
    this.storage.remove(SAVE_KEY);
  }

  loadSettings(): Settings {
    try {
      return sanitizeSettings(JSON.parse(this.storage.get(SETTINGS_KEY) ?? 'null'));
    } catch {
      return sanitizeSettings(null);
    }
  }

  saveSettings(settings: Settings): void {
    this.storage.set(SETTINGS_KEY, JSON.stringify(settings));
  }

  loadStats(): Stats {
    try {
      return sanitizeStats(JSON.parse(this.storage.get(STATS_KEY) ?? 'null'));
    } catch {
      return sanitizeStats(null);
    }
  }

  saveStats(stats: Stats): void {
    this.storage.set(STATS_KEY, JSON.stringify(stats));
  }
}
