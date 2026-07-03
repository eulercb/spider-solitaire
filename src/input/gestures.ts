/**
 * Gesture hygiene for a full-screen touch game: the browser must never
 * scroll, zoom, select, or long-press-menu the table. touch-action and
 * overscroll-behavior live in CSS; the rest needs listeners.
 */
export function suppressBrowserGestures(surface: HTMLElement): void {
  surface.addEventListener('contextmenu', (event) => event.preventDefault());
  surface.addEventListener('selectstart', (event) => event.preventDefault());
  // Belt and braces against double-tap zoom on older Android WebViews —
  // but never on real controls: preventDefault on touchend suppresses the
  // click, which would break rapid undo-mashing and quick stock deals.
  let lastTouch = 0;
  surface.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      const interactive = (event.target as HTMLElement).closest?.(
        'button, a, input, select, label, dialog',
      );
      if (now - lastTouch < 350 && !interactive) event.preventDefault();
      lastTouch = now;
    },
    { passive: false },
  );
}
