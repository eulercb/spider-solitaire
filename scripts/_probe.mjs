import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore', cwd: '/home/user/spider-solitaire' });
await new Promise(r => setTimeout(r, 1500));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:4173/spider-solitaire/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
console.log(await page.evaluate(() => ({
  innerWidth: window.innerWidth,
  clientWidth: document.documentElement.clientWidth,
  appW: document.getElementById('app').getBoundingClientRect().width,
  boardW: document.getElementById('board').getBoundingClientRect().width,
  cardW: getComputedStyle(document.documentElement).getPropertyValue('--card-w'),
  visual: window.visualViewport ? window.visualViewport.width : null,
  chromeW: document.getElementById('chrome').getBoundingClientRect().width,
  toolbarW: document.getElementById('toolbar').getBoundingClientRect().width,
})));
await browser.close();
server.kill();
process.exit(0);
