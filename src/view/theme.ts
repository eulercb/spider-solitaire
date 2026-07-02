import type { Settings } from '../game/settings';

/**
 * Theme tokens all live on :root as CSS custom properties; components never
 * hardcode a color. Two tables: the parlor at night (Baize) and a
 * midnight-indigo room with silver trim.
 */
const THEMES = {
  baize: {
    '--baize': '#0f3d2e',
    '--baize-deep': '#0a2a20',
    '--baize-edge': '#071e17',
    '--accent': '#c9a24b',
    '--accent-soft': '#c9a24b59',
    '--text': '#e8e4d5',
    '--text-dim': '#9fb3a8',
    '--danger': '#8c3a34',
    '--card-face': '#f7f3e8',
    '--card-edge': '#d8d0bc',
    '--back-field': '#124635',
    '--back-line': '#c9a24b',
    '--panel': '#0c332699',
  },
  midnight: {
    '--baize': '#1d2440',
    '--baize-deep': '#141a30',
    '--baize-edge': '#0d1222',
    '--accent': '#b9c2d9',
    '--accent-soft': '#b9c2d959',
    '--text': '#e6e8f0',
    '--text-dim': '#8e97b3',
    '--danger': '#a04a44',
    '--card-face': '#f2f2ee',
    '--card-edge': '#ccccc4',
    '--back-field': '#232c52',
    '--back-line': '#b9c2d9',
    '--panel': '#181f3899',
  },
} as const;

/** Suit ink colors: [two-color, four-color, high-contrast two, high-contrast four]. */
const SUIT_COLORS = {
  standard2: ['#26221c', '#a63d32', '#a63d32', '#26221c'],
  standard4: ['#26221c', '#a63d32', '#2b5d8f', '#3d6b4a'],
  contrast2: ['#000000', '#c0210f', '#c0210f', '#000000'],
  contrast4: ['#000000', '#c0210f', '#0047ba', '#00693c'],
};

export function applyTheme(settings: Settings): void {
  const root = document.documentElement;
  const theme = THEMES[settings.theme];
  for (const [key, value] of Object.entries(theme)) root.style.setProperty(key, value);

  const suitKey = settings.highContrast
    ? settings.fourColor
      ? 'contrast4'
      : 'contrast2'
    : settings.fourColor
      ? 'standard4'
      : 'standard2';
  SUIT_COLORS[suitKey].forEach((color, suit) => {
    root.style.setProperty(`--suit-${suit}`, color);
  });

  root.style.setProperty('--idx-size', settings.largeIndices ? '58px' : '44px');
  root.classList.toggle('high-contrast', settings.highContrast);
  root.classList.toggle('left-handed', settings.leftHanded);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme['--baize']);
}
