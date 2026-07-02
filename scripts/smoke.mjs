// End-to-end smoke test: builds are served by `vite preview` under the real
// GitHub Pages subpath; a phone-sized Chromium plays the game via the same
// debug hooks the cascade was tuned with. Usage: npm run build && npm run smoke
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/spider-solitaire/`;
const SHOTS = process.env.SHOT_DIR ?? 'screenshots';

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});
await new Promise((resolve) => setTimeout(resolve, 1500));

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};

try {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => localStorage.setItem('baize.debug', '1'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600); // let the opening deal settle

  check((await page.locator('.card').count()) === 104, '104 card nodes on the table');
  check((await page.locator('#toolbar button').count()) === 5, 'five toolbar buttons');
  await page.screenshot({ path: `${SHOTS}/board.png` });

  // Engine-driven move via the debug hook (tap path exercises the same API).
  const moved = await page.evaluate(() => {
    const { controller } = window.__baize;
    const hint = controller.hint();
    if (!hint || hint.kind !== 'move') return controller.state.moveCount;
    controller.moveCard(hint.move.from, hint.move.index, hint.move.to);
    return controller.state.moveCount;
  });
  check(moved === 1, `a hinted move applies (moveCount=${moved})`);
  await page.waitForTimeout(700);

  // Real pointer tap on the stock plate deals a row.
  const before = await page.evaluate(() => window.__baize.controller.state.stock.length);
  await page.tap('.stock-plate');
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => window.__baize.controller.state.stock.length);
  check(after === before - 10, `stock deal via tap (${before} → ${after})`);
  await page.screenshot({ path: `${SHOTS}/after-deal.png` });

  // Undo restores the pre-deal state.
  await page.tap('#toolbar button[aria-label="Undo"]');
  await page.waitForTimeout(600);
  const undone = await page.evaluate(() => window.__baize.controller.state.stock.length);
  check(undone === before, 'undo restores the stock');

  // Settings sheet opens; four-color deck applies.
  await page.tap('#toolbar button[aria-label="Menu"]');
  await page.getByRole('button', { name: 'Settings' }).tap();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/settings.png` });
  await page.getByRole('switch', { name: 'Four-color suits' }).tap();
  await page.locator('dialog.settings .sheet-head button').tap();
  await page.waitForTimeout(300);

  // Autosave/resume: reload mid-game and the same position comes back.
  const beforeReload = await page.evaluate(() => ({
    moves: window.__baize.controller.state.moveCount,
    seed: window.__baize.controller.state.seed,
  }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const afterReload = await page.evaluate(() => ({
    moves: window.__baize.controller.state.moveCount,
    seed: window.__baize.controller.state.seed,
  }));
  check(
    afterReload.moves === beforeReload.moves && afterReload.seed === beforeReload.seed,
    `game resumes after reload (moves=${afterReload.moves})`,
  );

  // Win path: near-win state, finishing move, cascade canvas appears.
  await page.evaluate(() => window.__baize.nearWin());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__baize.finish());
  await page.waitForTimeout(2200);
  check((await page.locator('#fx, #css-win').count()) > 0, 'win celebration layer present');
  await page.screenshot({ path: `${SHOTS}/win-cascade.png` });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${SHOTS}/win-dialog.png` });

  const fatal = errors.filter(
    (text) => !text.includes('manifest') && !text.includes('favicon'),
  );
  check(fatal.length === 0, `no console/page errors (${fatal.length})`);
  if (fatal.length) console.log(fatal.join('\n'));

  await browser.close();
} catch (error) {
  failures++;
  console.error('FAIL smoke crashed:', error);
} finally {
  server.kill();
}

process.exit(failures ? 1 : 0);
