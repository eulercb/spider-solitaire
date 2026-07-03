import { ICONS } from './icons';
import { formatTime } from './toolbar';

let toastEl: HTMLElement | null = null;
let toastTimer = 0;

/**
 * The live region must exist before the first message, or screen readers
 * miss the initial announcement. Called once at boot.
 */
export function initToast(): void {
  if (toastEl) return;
  toastEl = document.createElement('div');
  toastEl.id = 'toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
}

/** Transient guidance, one line at a time, announced politely. */
export function toast(text: string): void {
  initToast();
  toastEl!.textContent = text;
  toastEl!.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl?.classList.remove('show'), 2600);
}

function makeDialog(className: string): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.className = className;
  document.body.appendChild(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('cancel', () => dialog.close());
  return dialog;
}

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = makeDialog('sheet confirm');
    dialog.innerHTML = `
      <h2>${options.title}</h2>
      ${options.body ? `<p>${options.body}</p>` : ''}
      <div class="dialog-actions">
        <button type="button" class="ghost" data-act="cancel">${options.cancelLabel ?? 'Keep playing'}</button>
        <button type="button" class="${options.danger ? 'danger' : 'primary'}" data-act="ok">${options.confirmLabel}</button>
      </div>`;
    let answer = false;
    dialog.querySelector('[data-act="ok"]')!.addEventListener('click', () => {
      answer = true;
      dialog.close();
    });
    dialog.querySelector('[data-act="cancel"]')!.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => resolve(answer));
    dialog.showModal();
  });
}

export interface MenuHandlers {
  onNew(): void;
  onRestart(): void;
  onUndoAll(): void;
  onStats(): void;
  onSettings(): void;
  onHowTo(): void;
}

export function menuSheet(handlers: MenuHandlers): void {
  const dialog = makeDialog('sheet menu');
  dialog.innerHTML = `
    <div class="sheet-head">
      <h2>Menu</h2>
      <button type="button" class="tool" aria-label="Close" data-act="close">${ICONS.close}</button>
    </div>
    <div class="menu-list">
      <button type="button" data-act="new">New game</button>
      <button type="button" data-act="restart">Restart this deal</button>
      <button type="button" data-act="undoall">Undo all</button>
      <button type="button" data-act="stats">Statistics</button>
      <button type="button" data-act="settings">Settings</button>
      <button type="button" data-act="howto">How to play</button>
    </div>`;
  const act = (name: string, fn: () => void): void => {
    dialog.querySelector(`[data-act="${name}"]`)!.addEventListener('click', () => {
      dialog.close();
      fn();
    });
  };
  act('close', () => {});
  act('new', handlers.onNew);
  act('restart', handlers.onRestart);
  act('undoall', handlers.onUndoAll);
  act('stats', handlers.onStats);
  act('settings', handlers.onSettings);
  act('howto', handlers.onHowTo);
  dialog.showModal();
}

export function howToSheet(): void {
  const dialog = makeDialog('sheet howto');
  dialog.innerHTML = `
    <div class="sheet-head">
      <h2>How to play</h2>
      <button type="button" class="tool" aria-label="Close" data-act="close">${ICONS.close}</button>
    </div>
    <div class="prose">
      <p>Build runs from King down to Ace. A finished same-suit run lifts off
      the table; clear eight to win.</p>
      <p><b>Place</b> any card on a card one rank higher — suit doesn't matter.</p>
      <p><b>Carry</b> cards together only when they share a suit and descend in
      order.</p>
      <p><b>Tap</b> a card to send it to its best home, or <b>drag</b> it where
      you want it.</p>
      <p><b>Deal</b> from the stock for ten fresh cards — fill every empty
      column first.</p>
    </div>`;
  dialog.querySelector('[data-act="close"]')!.addEventListener('click', () => dialog.close());
  dialog.showModal();
}

export interface WinRecord {
  score: number;
  timeMs: number;
  moves: number;
  scoringOn: boolean;
  timerOn: boolean;
}

export function winDialog(
  record: WinRecord,
  onNew: () => void,
  onReplay: () => void,
): HTMLDialogElement {
  const dialog = makeDialog('sheet win');
  const rows = [
    record.scoringOn ? `<div class="win-stat"><small>score</small><b>${record.score}</b></div>` : '',
    record.timerOn
      ? `<div class="win-stat"><small>time</small><b>${formatTime(record.timeMs)}</b></div>`
      : '',
    `<div class="win-stat"><small>moves</small><b>${record.moves}</b></div>`,
  ].join('');
  dialog.innerHTML = `
    <p class="win-eyebrow">Eight sequences</p>
    <h2 class="win-title">The table is clear</h2>
    <div class="win-stats">${rows}</div>
    <div class="dialog-actions">
      <button type="button" class="ghost" data-act="replay">Replay this deal</button>
      <button type="button" class="primary" data-act="new">New game</button>
    </div>`;
  dialog.querySelector('[data-act="new"]')!.addEventListener('click', () => {
    dialog.close();
    onNew();
  });
  dialog.querySelector('[data-act="replay"]')!.addEventListener('click', () => {
    dialog.close();
    onReplay();
  });
  dialog.showModal();
  return dialog;
}

export function deadlockDialog(onUndo: () => void, onNew: () => void): void {
  const dialog = makeDialog('sheet deadlock');
  dialog.innerHTML = `
    <h2>No moves left</h2>
    <p>The stock is spent and nothing can move. Step back or reshuffle.</p>
    <div class="dialog-actions">
      <button type="button" class="ghost" data-act="undo">Undo</button>
      <button type="button" class="primary" data-act="new">New game</button>
    </div>`;
  dialog.querySelector('[data-act="undo"]')!.addEventListener('click', () => {
    dialog.close();
    onUndo();
  });
  dialog.querySelector('[data-act="new"]')!.addEventListener('click', () => {
    dialog.close();
    onNew();
  });
  dialog.showModal();
}
