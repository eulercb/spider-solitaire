/**
 * Gesture hygiene for a full-screen touch game: the browser must never
 * scroll, zoom, select, or long-press-menu the table. touch-action and
 * overscroll-behavior live in CSS; the rest needs listeners.
 */
export function suppressBrowserGestures(surface: HTMLElement): void {
  surface.addEventListener('contextmenu', (event) => event.preventDefault());
  surface.addEventListener('selectstart', (event) => event.preventDefault());
  // Belt and braces against double-tap zoom on older Android WebViews.
  let lastTouch = 0;
  surface.addEventListener(
    'touchend',
    (event) => {
      const now = Date.now();
      if (now - lastTouch < 350) event.preventDefault();
      lastTouch = now;
    },
    { passive: false },
  );
}
