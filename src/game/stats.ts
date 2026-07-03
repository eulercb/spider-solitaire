import type { SuitCount } from '../engine';

export interface DifficultyStats {
  played: number;
  won: number;
  currentStreak: number;
  bestStreak: number;
  bestScore: number | null;
  bestTimeMs: number | null;
}

export interface Stats {
  v: 1;
  bySuits: Record<'1' | '2' | '4', DifficultyStats>;
}

const EMPTY: DifficultyStats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  bestStreak: 0,
  bestScore: null,
  bestTimeMs: null,
};

export function sanitizeStats(raw: unknown): Stats {
  const out: Stats = {
    v: 1,
    bySuits: { '1': { ...EMPTY }, '2': { ...EMPTY }, '4': { ...EMPTY } },
  };
  if (!raw || typeof raw !== 'object') return out;
  const source = (raw as { bySuits?: Record<string, Partial<DifficultyStats>> }).bySuits;
  if (!source || typeof source !== 'object') return out;
  for (const key of ['1', '2', '4'] as const) {
    const entry = source[key];
    if (!entry || typeof entry !== 'object') continue;
    const target = out.bySuits[key];
    const int = (value: unknown): number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    target.played = int(entry.played);
    target.won = Math.min(int(entry.won), target.played);
    target.currentStreak = int(entry.currentStreak);
    target.bestStreak = int(entry.bestStreak);
    target.bestScore =
      typeof entry.bestScore === 'number' && Number.isFinite(entry.bestScore)
        ? entry.bestScore
        : null;
    target.bestTimeMs =
      typeof entry.bestTimeMs === 'number' && entry.bestTimeMs > 0
        ? Math.floor(entry.bestTimeMs)
        : null;
  }
  return out;
}

export function recordWin(stats: Stats, suitCount: SuitCount, score: number, timeMs: number): void {
  const entry = stats.bySuits[String(suitCount) as '1' | '2' | '4'];
  entry.played++;
  entry.won++;
  entry.currentStreak++;
  entry.bestStreak = Math.max(entry.bestStreak, entry.currentStreak);
  if (entry.bestScore === null || score > entry.bestScore) entry.bestScore = score;
  if (entry.bestTimeMs === null || timeMs < entry.bestTimeMs) entry.bestTimeMs = timeMs;
}

export function recordLoss(stats: Stats, suitCount: SuitCount): void {
  const entry = stats.bySuits[String(suitCount) as '1' | '2' | '4'];
  entry.played++;
  entry.currentStreak = 0;
}
