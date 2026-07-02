import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './styles/main.css';
import { registerSW } from 'virtual:pwa-register';
import { cardFromId, type GameEvent, type GameState, type SuitCount } from './engine';
import { GameController } from './game/controller';
import { SaveManager } from './game/persistence';
import type { Settings } from './game/settings';
import { PointerInput } from './input/pointer';
import { suppressBrowserGestures } from './input/gestures';
import { Animator, type RenderCause } from './view/animate';
import { BoardView } from './view/board';
import { applyTheme } from './view/theme';
import { buildChrome } from './ui/toolbar';
import {
  confirmDialog,
  deadlockDialog,
  howToSheet,
  menuSheet,
  toast,
  winDialog,
} from './ui/dialogs';
import { settingsSheet } from './ui/settings';
import { statsSheet } from './ui/stats';
import { Sound } from './ui/sound';
import { haptic } from './ui/haptics';

const appEl = document.getElementById('app')!;
const hudEl = document.getElementById('hud')!;
const boardEl = document.getElementById('board')!;
const chromeEl = document.getElementById('chrome')!;

const saves = new SaveManager();
let settings: Settings = saves.loadSettings();
applyTheme(settings);

const sound = new Sound();
sound.enabled = settings.sound;

let controller: GameController;

const chrome = buildChrome(hudEl, chromeEl, {
  onNew: () => void requestNewGame(settings.suitCount),
  onUndo: () => controller.undo(),
  onRedo: () => controller.redo(),
  onHint: () => showHint(),
  onMenu: () => openMenu(),
  onStock: () => controller.deal(),
  onAutoFinish: () => controller.autoFinish(),
});

const board = new BoardView({
  app: appEl,
  board: boardEl,
  stock: chrome.stockEl,
  foundation: chrome.foundationEl,
});
const animator = new Animator(board, settings);
animator.onSound = (name) => sound.play(name);

function status(): void {
  chrome.update({
    canUndo: controller.history.canUndo && !controller.finished,
    canRedo: controller.history.canRedo && !controller.finished,
    stockDeals: Math.ceil(controller.state.stock.length / 10),
    foundations: controller.state.foundations.length,
    autoFinish: settings.autoComplete && controller.autoFinishReady,
    score: settings.scoring ? controller.state.score : null,
    timeMs: settings.timer ? controller.elapsedMs : null,
    moves: controller.state.moveCount,
    suits: controller.state.suitCount,
  });
}

function render(state: GameState, events: GameEvent[], cause: RenderCause): void {
  if (cause === 'new-game' || cause === 'restore') {
    board.refreshMetrics();
    board.build(state, settings);
  }
  animator.render(state, events, cause);
  if (events.some((event) => event.kind === 'completed')) {
    haptic('complete', settings.haptics);
  } else if (events.some((event) => event.kind === 'dealt')) {
    haptic('deal', settings.haptics);
  } else if (events.some((event) => event.kind === 'moved')) {
    haptic('move', settings.haptics);
  }
}

let stopCascade: (() => void) | null = null;

async function celebrate(record: { score: number; timeMs: number; moves: number }): Promise<void> {
  haptic('win', settings.haptics);
  sound.play('win');
  try {
    const { playWinCascade } = await import('./fx/winCascade');
    const styles = getComputedStyle(document.documentElement);
    stopCascade = await playWinCascade({
      accent: styles.getPropertyValue('--accent').trim() || '#c9a24b',
      ivory: styles.getPropertyValue('--text').trim() || '#e8e4d5',
      cardFace: styles.getPropertyValue('--card-face').trim() || '#f7f3e8',
      backField: styles.getPropertyValue('--back-field').trim() || '#124635',
    });
  } catch {
    stopCascade = null;
  }
  if (!stopCascade) {
    const { playCssCelebration } = await import('./fx/cssCelebration');
    stopCascade = playCssCelebration();
  }
  window.setTimeout(() => {
    const dialog = winDialog(
      {
        ...record,
        scoringOn: settings.scoring,
        timerOn: settings.timer,
      },
      () => controller.newGame(settings.suitCount),
      () => controller.restartDeal(),
    );
    dialog.addEventListener('close', () => {
      stopCascade?.();
      stopCascade = null;
    });
  }, 1700);
}

controller = new GameController(
  saves,
  {
    render,
    status,
    message: toast,
    invalid: (ids) => {
      if (ids.length > 0) animator.shake(ids);
      haptic('invalid', settings.haptics);
      // Glide any dragged cards home.
      animator.render(controller.state, [], 'auto');
    },
    won: (record) => {
      status();
      void celebrate(record);
    },
    deadlock: () => {
      window.setTimeout(
        () =>
          deadlockDialog(
            () => controller.undo(),
            () => void requestNewGame(settings.suitCount, true),
          ),
        450,
      );
    },
    autoFinishAvailable: () => status(),
  },
  settings.suitCount,
);

const input = new PointerInput(board, settings, {
  locate: (id) => controller.locate(id),
  grabRun: (column, index) => controller.grabRun(column, index),
  legalDestinations: (column, index) => controller.legalDestinations(column, index),
  drop: (from, index, to) => void controller.moveCard(from, index, to),
  tap: (column, index) => controller.tapMove(column, index),
  tapStock: () => controller.deal(),
  invalid: (ids) => {
    if (ids.length > 0) animator.shake(ids.filter((id) => id >= 0));
    haptic('invalid', settings.haptics);
    animator.render(controller.state, [], 'auto');
  },
});

async function requestNewGame(suitCount: SuitCount, skipConfirm = false): Promise<void> {
  const underway =
    controller.state.moveCount > 0 && !controller.finished && !skipConfirm;
  if (underway) {
    const ok = await confirmDialog({
      title: 'Start a new game?',
      body: 'This deal is still in play — leaving it counts as a loss.',
      confirmLabel: 'New game',
      danger: true,
    });
    if (!ok) return;
  }
  controller.newGame(suitCount);
}

async function requestRestart(): Promise<void> {
  if (controller.state.moveCount === 0) {
    controller.restartDeal();
    return;
  }
  const ok = await confirmDialog({
    title: 'Restart this deal?',
    body: 'Same shuffle, fresh start. The current attempt counts as a loss.',
    confirmLabel: 'Restart',
  });
  if (ok) controller.restartDeal();
}

function showHint(): void {
  const hint = controller.hint();
  if (!hint) {
    toast('No moves left — undo or start a new game.');
    return;
  }
  if (hint.kind === 'deal') {
    chrome.stockEl.classList.add('hinted');
    window.setTimeout(() => chrome.stockEl.classList.remove('hinted'), 1600);
    toast('Deal a new row from the stock.');
    return;
  }
  const ids = controller.grabRun(hint.move.from, hint.move.index);
  if (ids) animator.pulse(ids, hint.move.to);
}

function openMenu(): void {
  menuSheet({
    onNew: () => void requestNewGame(settings.suitCount),
    onRestart: () => void requestRestart(),
    onUndoAll: () => controller.undoAll(),
    onStats: () => statsSheet(controller.stats, () => void requestNewGame(settings.suitCount, true)),
    onSettings: () => openSettings(),
    onHowTo: () => howToSheet(),
  });
}

function openSettings(): void {
  settingsSheet({
    current: () => settings,
    apply: async (patch) => {
      const key = Object.keys(patch)[0] as keyof Settings;
      if (key === 'suitCount' && patch.suitCount !== settings.suitCount) {
        const underway = controller.state.moveCount > 0 && !controller.finished;
        if (underway) {
          const ok = await confirmDialog({
            title: 'Change difficulty?',
            body: 'Switching suits starts a new game; this deal counts as a loss.',
            confirmLabel: 'Switch and deal',
          });
          if (!ok) return false;
        }
        settings = { ...settings, ...patch };
        saves.saveSettings(settings);
        controller.newGame(settings.suitCount);
        return true;
      }

      settings = { ...settings, ...patch };
      saves.saveSettings(settings);
      applyTheme(settings);
      animator.updateSettings(settings);
      input.updateSettings(settings);
      if (key === 'cardBack') board.restyleBacks(settings);
      if (key === 'sound') {
        sound.enabled = settings.sound;
        sound.unlock();
      }
      status();
      return true;
    },
  });
}

// --- Boot ---------------------------------------------------------------

suppressBrowserGestures(appEl);
appEl.addEventListener('pointerdown', () => sound.unlock(), { passive: true });

render(controller.state, [], controller.resumedFromSave ? 'restore' : 'new-game');
status();
if (controller.resumedFromSave) toast('Welcome back — your game was kept warm.');
controller.startTicking(status);

let resizeTimer = 0;
const reflow = (): void => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    board.refreshMetrics();
    animator.render(controller.state, [], 'reflow');
  }, 120);
};
window.addEventListener('resize', reflow);
window.addEventListener('orientationchange', reflow);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) controller.persist();
});
window.addEventListener('pagehide', () => controller.persist());

registerSW({ immediate: true });

// Debug hooks for smoke tests and cascade tuning (opt-in only).
if (localStorage.getItem('baize.debug')) {
  const nearWin = (): void => {
    const suits = 1 as const;
    const foundations = Array.from({ length: 7 }, (_, f) =>
      Array.from({ length: 13 }, (_, i) => cardFromId(f * 13 + (12 - i), suits, true)),
    );
    const last = Array.from({ length: 13 }, (_, i) => cardFromId(91 + (12 - i), suits, true));
    const state: GameState = {
      seed: 1,
      suitCount: suits,
      columns: [
        last.slice(0, 12),
        [last[12]],
        [], [], [], [], [], [], [], [],
      ],
      stock: [],
      foundations,
      moveCount: 90,
      score: 500,
    };
    controller.state = state;
    controller.history.clear();
    board.build(state, settings);
    animator.render(state, [], 'restore');
    status();
  };
  (window as unknown as Record<string, unknown>).__baize = {
    controller,
    nearWin,
    finish: () => controller.moveCard(1, 0, 0),
  };
}
