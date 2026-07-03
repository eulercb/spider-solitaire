import { Application } from 'pixi.js';

export interface Overlay {
  app: Application;
  destroy(): void;
}

/**
 * A full-viewport WebGL canvas above the table, strictly decorative:
 * pointer-events none, and a hard null if WebGL is unavailable so the game
 * itself never depends on it.
 */
export async function createOverlay(): Promise<Overlay | null> {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
    if (!gl) return null;

    const app = new Application();
    await app.init({
      preference: 'webgl',
      backgroundAlpha: 0,
      // Trails: we never clear, we erase a little each frame instead.
      clearBeforeRender: false,
      preserveDrawingBuffer: true,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 3),
      autoDensity: true,
      resizeTo: window,
    });
    const canvas = app.canvas;
    canvas.id = 'fx';
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:600;pointer-events:none;';
    document.body.appendChild(canvas);

    let destroyed = false;
    return {
      app,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        try {
          app.destroy(true, { children: true, texture: true });
        } catch {
          /* tearing down a lost context is fine */
        }
        canvas.remove();
      },
    };
  } catch {
    return null;
  }
}
