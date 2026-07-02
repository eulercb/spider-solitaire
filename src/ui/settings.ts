import type { Settings } from '../game/settings';
import { ICONS } from './icons';

export interface SettingsHandlers {
  /** Called with a candidate patch; return false to veto (e.g. cancelled difficulty change). */
  apply(patch: Partial<Settings>): Promise<boolean> | boolean;
  current(): Settings;
}

interface SegmentSpec<K extends keyof Settings> {
  key: K;
  label: string;
  options: Array<{ value: Settings[K]; label: string }>;
}

function segmented<K extends keyof Settings>(
  spec: SegmentSpec<K>,
  handlers: SettingsHandlers,
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'setting-row';
  const id = `seg-${String(spec.key)}`;
  row.innerHTML = `<label id="${id}">${spec.label}</label>`;
  const group = document.createElement('div');
  group.className = 'segment';
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-labelledby', id);
  const paint = (): void => {
    const value = handlers.current()[spec.key];
    group.querySelectorAll('button').forEach((button) => {
      const active = button.dataset.value === String(value);
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
  };
  for (const option of spec.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.dataset.value = String(option.value);
    button.textContent = option.label;
    button.addEventListener('click', async () => {
      await handlers.apply({ [spec.key]: option.value } as Partial<Settings>);
      paint();
    });
    group.appendChild(button);
  }
  row.appendChild(group);
  paint();
  return row;
}

function toggle(key: keyof Settings, label: string, handlers: SettingsHandlers): HTMLElement {
  const row = document.createElement('div');
  row.className = 'setting-row';
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'switch';
  button.setAttribute('role', 'switch');
  // Real association: tapping the row's text flips the switch too.
  button.id = `switch-${String(key)}`;
  labelEl.htmlFor = button.id;
  const paint = (): void => {
    const on = handlers.current()[key] === true;
    button.setAttribute('aria-checked', String(on));
    button.classList.toggle('on', on);
  };
  button.addEventListener('click', async () => {
    await handlers.apply({ [key]: !handlers.current()[key] } as Partial<Settings>);
    paint();
  });
  row.append(labelEl, button);
  paint();
  return row;
}

function heading(text: string): HTMLElement {
  const el = document.createElement('h3');
  el.textContent = text;
  return el;
}

export function settingsSheet(handlers: SettingsHandlers): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'sheet settings';
  document.body.appendChild(dialog);
  dialog.addEventListener('close', () => dialog.remove());

  const head = document.createElement('div');
  head.className = 'sheet-head';
  head.innerHTML = `<h2>Settings</h2>
    <button type="button" class="tool" aria-label="Close">${ICONS.close}</button>`;
  head.querySelector('button')!.addEventListener('click', () => dialog.close());

  const body = document.createElement('div');
  body.className = 'settings-body';
  body.append(
    heading('Game'),
    segmented(
      {
        key: 'suitCount',
        label: 'Difficulty',
        options: [
          { value: 1, label: '1 suit' },
          { value: 2, label: '2 suits' },
          { value: 4, label: '4 suits' },
        ],
      },
      handlers,
    ),
    toggle('autoComplete', 'Offer to finish won games', handlers),

    heading('Table'),
    segmented(
      {
        key: 'theme',
        label: 'Theme',
        options: [
          { value: 'baize', label: 'Baize' },
          { value: 'midnight', label: 'Midnight' },
        ],
      },
      handlers,
    ),
    segmented(
      {
        key: 'cardBack',
        label: 'Card back',
        options: [
          { value: 'lattice', label: 'Lattice' },
          { value: 'pinstripe', label: 'Pinstripe' },
          { value: 'quatrefoil', label: 'Quatrefoil' },
        ],
      },
      handlers,
    ),
    segmented(
      {
        key: 'animationSpeed',
        label: 'Animation',
        options: [
          { value: 'slow', label: 'Slow' },
          { value: 'normal', label: 'Normal' },
          { value: 'fast', label: 'Fast' },
          { value: 'off', label: 'Off' },
        ],
      },
      handlers,
    ),

    heading('Deck'),
    toggle('fourColor', 'Four-color suits', handlers),
    toggle('highContrast', 'High contrast', handlers),
    toggle('largeIndices', 'Large indices', handlers),

    heading('Touch'),
    toggle('tapToMove', 'Tap to move', handlers),
    toggle('dragToMove', 'Drag to move', handlers),
    toggle('haptics', 'Haptics', handlers),
    toggle('sound', 'Sound', handlers),
    toggle('leftHanded', 'Left-handed table', handlers),

    heading('Score'),
    toggle('scoring', 'Classic scoring', handlers),
    toggle('timer', 'Timer', handlers),
  );

  dialog.append(head, body);
  dialog.showModal();
}
