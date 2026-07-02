// Renders the app icons (PNG) from original inline SVG art. Run once and
// commit the results: `npm run icons`.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const SPADE =
  'M50 5 C39 27 15 39 15 57 C15 71 27 79 39 75 C43 73.6 45.6 71 47 68.5 C45.5 80 41 88 34 93 L66 93 C59 88 54.5 80 53 68.5 C54.4 71 57 73.6 61 75 C73 79 85 71 85 57 C85 39 61 27 50 5 Z';

/** @param {boolean} maskable - pad art into the 80% safe zone */
function iconSVG(maskable) {
  const s = maskable ? 0.72 : 0.9;
  const t = (1 - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="felt" cx="50%" cy="34%" r="85%">
      <stop offset="0%" stop-color="#155240"/>
      <stop offset="62%" stop-color="#0f3d2e"/>
      <stop offset="100%" stop-color="#0a2a20"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#felt)"/>
  <g transform="translate(${512 * t} ${512 * t}) scale(${s})">
    <rect x="146" y="96" width="220" height="308" rx="26" fill="#f7f3e8" stroke="#c9a24b" stroke-width="7"/>
    <rect x="163" y="113" width="186" height="274" rx="16" fill="none" stroke="#c9a24b" stroke-width="3" opacity="0.65"/>
    <g transform="translate(186 180) scale(1.4)">
      <path d="${SPADE}" fill="#26221c"/>
    </g>
    <text x="188" y="164" font-family="Georgia, serif" font-weight="600" font-size="52" fill="#26221c">A</text>
    <g transform="rotate(180 256 250)"><text x="188" y="164" font-family="Georgia, serif" font-weight="600" font-size="52" fill="#26221c">A</text></g>
  </g>
</svg>`;
}

function faviconSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#0f3d2e"/>
  <g transform="translate(18 14) scale(0.64)">
    <path d="${SPADE}" fill="#c9a24b"/>
  </g>
</svg>`;
}

await mkdir('public/icons', { recursive: true });
const standard = Buffer.from(iconSVG(false));
const maskable = Buffer.from(iconSVG(true));
await sharp(standard).resize(192, 192).png().toFile('public/icons/icon-192.png');
await sharp(standard).resize(512, 512).png().toFile('public/icons/icon-512.png');
await sharp(maskable).resize(512, 512).png().toFile('public/icons/maskable-512.png');
await sharp(standard).resize(180, 180).png().toFile('public/apple-touch-icon.png');
await writeFile('public/favicon.svg', faviconSVG());
console.log('icons written to public/');
