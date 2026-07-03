import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from the root of the custom domain https://spider.zen.dev.br/.
// A custom domain serves the site from `/`, not the `/<repo>/` project
// subpath, so the base is root. `public/CNAME` pins the domain on every
// deploy. (For a plain <user>.github.io/spider-solitaire/ deploy this would
// need to be '/spider-solitaire/' instead.)
export default defineConfig({
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Baize — Spider Solitaire',
        short_name: 'Baize',
        description:
          'A refined night-time card parlor in your pocket. Spider Solitaire, fully offline.',
        // Relative so they resolve under the GitHub Pages subpath.
        start_url: '.',
        scope: '.',
        display: 'standalone',
        theme_color: '#0f3d2e',
        background_color: '#0a2a20',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the entire app shell + fonts so the game is truly offline.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        // Pixi is a single large chunk; keep it under the precache limit.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as never);
