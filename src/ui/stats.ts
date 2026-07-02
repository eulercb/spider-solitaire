import type { Stats } from '../game/stats';
import { ICONS } from './icons';
import { formatTime } from './toolbar';

export function statsSheet(stats: Stats, onNewGame: () => void): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet stats';
  document.body.appendChild(dialog);
  dialog.addEventListener('close', () => dialog.remove());

  const total = (['1', '2', '4'] as const).reduce(
    (sum, key) => sum + stats.bySuits[key].played,
    0,
  );

  let body: string;
  if (total === 0) {
    body = `
      <div class="stats-empty">
        <p>The table is set and the cards are waiting.</p>
        <button type="button" class="primary" data-act="first">Deal your first hand</button>
      </div>`;
  } else {
    const row = (label: string, key: '1' | '2' | '4'): string => {
      const s = stats.bySuits[key];
      if (s.played === 0) {
        return `<tr><th>${label}</th><td colspan="5" class="quiet">not yet played</td></tr>`;
      }
      const rate = Math.round((s.won / s.played) * 100);
      return `<tr>
        <th>${label}</th>
        <td>${s.won}/${s.played}</td>
        <td>${rate}%</td>
        <td>${s.currentStreak}<span class="quiet">/${s.bestStreak}</span></td>
        <td>${s.bestTimeMs === null ? '—' : formatTime(s.bestTimeMs)}</td>
        <td>${s.bestScore === null ? '—' : s.bestScore}</td>
      </tr>`;
    };
    body = `
      <table class="stats-table">
        <thead><tr><th></th><th>Won</th><th>Rate</th><th>Streak</th><th>Best time</th><th>Best score</th></tr></thead>
        <tbody>
          ${row('1 suit', '1')}
          ${row('2 suits', '2')}
          ${row('4 suits', '4')}
        </tbody>
      </table>`;
  }

  dialog.innerHTML = `
    <div class="sheet-head">
      <h2>Statistics</h2>
      <button type="button" class="tool" aria-label="Close" data-act="close">${ICONS.close}</button>
    </div>
    ${body}`;
  dialog.querySelector('[data-act="close"]')!.addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-act="first"]')?.addEventListener('click', () => {
    dialog.close();
    onNewGame();
  });
  dialog.showModal();
}
