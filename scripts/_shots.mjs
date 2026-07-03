// Visual iteration helper: capture themed/variant screenshots.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const SHOTS = process.env.SHOT_DIR ?? 'screenshots';
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  stdio: 'ignore',
});
await new Promise((resolve) => setTimeout(resolve, 1500));

try {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  });

  const shoot = async (name, { viewport, settings, suits }) => {
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(
      ([s]) => {
        localStorage.setItem('baize.debug', '1');
        if (s) localStorage.setItem('baize.settings.v1', JSON.stringify(s));
      },
      [settings],
    );
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2400);
    if (suits) {
      await page.evaluate((n) => window.__baize.controller.newGame(n, 424242), suits);
      await page.waitForTimeout(2400);
      // Deal twice so face-up variety shows.
      await page.evaluate(() => window.__baize.controller.deal());
      await page.waitForTimeout(900);
      await page.evaluate(() => window.__baize.controller.deal());
      await page.waitForTimeout(1200);
    }
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
    await context.close();
    console.log('shot', name);
  };

  const base = {
    suitCount: 4,
    tapToMove: true,
    dragToMove: true,
    animationSpeed: 'normal',
    theme: 'baize',
    cardBack: 'lattice',
    fourColor: true,
    highContrast: false,
    largeIndices: false,
    scoring: true,
    timer: true,
    sound: false,
    haptics: true,
    leftHanded: false,
    autoComplete: true,
  };

  await shoot('foursuit-fourcolor', {
    viewport: { width: 390, height: 844 },
    settings: base,
    suits: 4,
  });
  await shoot('midnight', {
    viewport: { width: 390, height: 844 },
    settings: { ...base, theme: 'midnight', cardBack: 'quatrefoil' },
    suits: 2,
  });
  await shoot('landscape', {
    viewport: { width: 844, height: 390 },
    settings: base,
    suits: 4,
  });
  await browser.close();
} finally {
  server.kill();
}
process.exit(0);
