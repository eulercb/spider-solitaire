import { ICONS, type IconName } from './icons';

export interface ToolbarHandlers {
  onNew(): void;
  onUndo(): void;
  onRedo(): void;
  onHint(): void;
  onMenu(): void;
  onStock(): void;
  onAutoFinish(): void;
}

export interface Chrome {
  stockEl: HTMLElement;
  foundationEl: HTMLElement;
  update(view: {
    canUndo: boolean;
    canRedo: boolean;
    stockDeals: number;
    foundations: number;
    autoFinish: boolean;
    score: number | null;
    timeMs: number | null;
    moves: number;
    suits: number;
  }): void;
}

function button(icon: IconName, label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.className = 'tool';
  el.type = 'button';
  el.setAttribute('aria-label', label);
  el.title = label;
  el.innerHTML = ICONS[icon];
  el.addEventListener('click', onClick);
  return el;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** HUD (top) + chrome (bottom): foundations plate, tool row, stock plate. */
export function buildChrome(
  hud: HTMLElement,
  footer: HTMLElement,
  handlers: ToolbarHandlers,
): Chrome {
  hud.innerHTML = `
    <div class="brand">
      <span class="wordmark">Baize</span>
      <span class="chip" data-role="suits"></span>
    </div>
    <div class="meters" aria-label="Game progress">
      <span class="meter" data-role="score"><small>score</small><b>—</b></span>
      <span class="meter" data-role="time"><small>time</small><b>—</b></span>
      <span class="meter" data-role="moves"><small>moves</small><b>0</b></span>
    </div>`;

  const foundationEl = document.createElement('div');
  foundationEl.className = 'plate foundation-plate';
  foundationEl.setAttribute('aria-label', 'Completed sequences');
  foundationEl.innerHTML = '<span class="plate-count" data-role="foundations">0 of 8</span>';

  const tools = document.createElement('div');
  tools.id = 'toolbar';
  const undoBtn = button('undo', 'Undo', handlers.onUndo);
  const redoBtn = button('redo', 'Redo', handlers.onRedo);
  tools.append(
    button('new', 'New game', handlers.onNew),
    undoBtn,
    redoBtn,
    button('hint', 'Hint', handlers.onHint),
    button('menu', 'Menu', handlers.onMenu),
  );

  const stockEl = document.createElement('button');
  stockEl.type = 'button';
  stockEl.className = 'plate stock-plate';
  stockEl.setAttribute('aria-label', 'Deal a new row');
  stockEl.innerHTML = '<span class="plate-count" data-role="stock">5 deals</span>';
  stockEl.addEventListener('click', handlers.onStock);

  const finishBtn = document.createElement('button');
  finishBtn.type = 'button';
  finishBtn.id = 'autofinish';
  finishBtn.hidden = true;
  finishBtn.innerHTML = `${ICONS.finish}<span>Finish game</span>`;
  finishBtn.addEventListener('click', handlers.onAutoFinish);

  footer.append(foundationEl, tools, stockEl);
  document.getElementById('app')?.appendChild(finishBtn);

  const q = <T extends HTMLElement>(selector: string): T =>
    document.querySelector<T>(selector)!;

  return {
    stockEl,
    foundationEl,
    update(view) {
      undoBtn.disabled = !view.canUndo;
      redoBtn.disabled = !view.canRedo;
      stockEl.disabled = view.stockDeals === 0;
      q('[data-role="suits"]').textContent =
        view.suits === 1 ? '1 suit' : `${view.suits} suits`;
      const score = q('[data-role="score"]');
      score.hidden = view.score === null;
      if (view.score !== null) score.querySelector('b')!.textContent = String(view.score);
      const time = q('[data-role="time"]');
      time.hidden = view.timeMs === null;
      if (view.timeMs !== null) {
        time.querySelector('b')!.textContent = formatTime(view.timeMs);
      }
      q('[data-role="moves"]').querySelector('b')!.textContent = String(view.moves);
      q('[data-role="foundations"]').textContent = `${view.foundations} of 8`;
      q('[data-role="stock"]').textContent =
        view.stockDeals === 0
          ? 'spent'
          : view.stockDeals === 1
            ? '1 deal'
            : `${view.stockDeals} deals`;
      finishBtn.hidden = !view.autoFinish;
    },
  };
}
