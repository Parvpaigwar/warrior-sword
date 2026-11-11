// Crops the raw product photos / campaign collages in assets-src/ into clean,
// web-optimised WebP files in public/images/. Run with: npm run images
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'assets-src';
const OUT = 'public/images';
mkdirSync(OUT, { recursive: true });

// [source, output name, crop {left, top, width, height} | null]
const jobs = [
  ['1.png', 'studio-apart', null],
  ['2.png', 'studio-mounted', null],
  ['3.png', 'detail-hilt', null],
  ['4.png', 'poster-sunlit', { left: 575, top: 0, width: 511, height: 1448 }],
  ['9.png', 'poster-grey', { left: 520, top: 0, width: 566, height: 1448 }],
  ['6.png', 'closeup-guard', { left: 513, top: 330, width: 510, height: 694 }],
  ['8.png', 'scene-ember', { left: 513, top: 230, width: 510, height: 794 }],
  ['8.png', 'scene-lantern', { left: 1031, top: 0, width: 505, height: 690 }],
  ['7.png', 'scene-candle', { left: 633, top: 633, width: 330, height: 621 }],
  ['10.png', 'scene-stone', { left: 990, top: 0, width: 264, height: 645 }],
  ['10.png', 'scene-lounge', { left: 380, top: 0, width: 303, height: 1254 }],
  ['5.png', 'scene-dusk', { left: 1200, top: 0, width: 336, height: 860 }],
  ['6.png', 'scene-library', { left: 1262, top: 0, width: 274, height: 820 }],
];

for (const [src, name, crop] of jobs) {
  let img = sharp(`${SRC}/${src}`);
  if (crop) img = img.extract(crop);
  await img.webp({ quality: 84 }).toFile(`${OUT}/${name}.webp`);
  console.log('✓', name);
}
