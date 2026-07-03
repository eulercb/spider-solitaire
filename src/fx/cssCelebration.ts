import { SUIT_PATHS } from '../view/cards';
import type { Suit } from '../engine';

/**
 * The no-WebGL (or reduced-motion) celebration: a quiet brass glow and, when
 * motion is allowed, a drift of suit glyphs. Plain DOM + CSS, always safe.
 */
export function playCssCelebration(): () => void {
  const layer = document.createElement('div');
  layer.id = 'css-win';
  layer.setAttribute('aria-hidden', 'true');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduced) {
    for (let i = 0; i < 26; i++) {
      const suit = (i % 4) as Suit;
      const glyph = document.createElement('span');
      glyph.className = 'float-glyph';
      glyph.innerHTML = `<svg viewBox="0 0 100 100"><path d="${SUIT_PATHS[suit]}"/></svg>`;
      glyph.style.left = `${4 + Math.random() * 92}%`;
      glyph.style.animationDelay = `${Math.random() * 4}s`;
      glyph.style.animationDuration = `${5 + Math.random() * 5}s`;
      glyph.style.setProperty('--drift', `${(Math.random() - 0.5) * 120}px`);
      glyph.style.setProperty('--size', `${14 + Math.random() * 22}px`);
      layer.appendChild(glyph);
    }
  }
  document.body.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add('show'));

  return () => {
    layer.classList.remove('show');
    window.setTimeout(() => layer.remove(), 900);
  };
}
