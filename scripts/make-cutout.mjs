// Cuts the sword + plaque out of the product photo (transparent background)
// for Lite mode. Each row is cut at the real edge of the walnut (brown pixels),
// so no grey wall or wall shadow is left around the plaque.
//   node scripts/make-cutout.mjs
import sharp from 'sharp';

const SRC = 'public/textures/product-ref.webp';
const X0 = 545, X1 = 925, Y0 = 100, Y1 = 1335; // search box around the plaque
const W = X1 - X0, H = Y1 - Y0;

const { data } = await sharp(SRC).extract({ left: X0, top: Y0, width: W, height: H }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
const isWood = (x, y) => { const [r, , b] = px(x, y); return r - b > 18 && (r - b) / r > 0.27; }; // warm brown, incl. the dark side edge

// per row: outermost run of wood pixels (needs 3 in a row to ignore noise)
const left = new Array(H).fill(-1), right = new Array(H).fill(-1);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W - 3; x++) if (isWood(x, y) && isWood(x + 1, y) && isWood(x + 2, y)) { left[y] = x; break; }
  for (let x = W - 1; x >= 3; x--) if (isWood(x, y) && isWood(x - 1, y) && isWood(x - 2, y)) { right[y] = x; break; }
}
// Median (removes stray rows where the lit bevel doesn't read as wood, keeps the
// stepped corners) then a moving average (removes the remaining 1–3 px stairs).
const med = (arr, i, r) => { const v = []; for (let k = -r; k <= r; k++) { const a = arr[i + k]; if (a >= 0) v.push(a); } v.sort((p, q) => p - q); return v.length > r ? v[v.length >> 1] : -1; };
const avg = (arr, i, r) => { let t = 0, n = 0; for (let k = -r; k <= r; k++) { const a = arr[i + k]; if (a >= 0) { t += a; n++; } } return n ? t / n : -1; };
const smoothEdge = (arr) => { const m = arr.map((_, i) => med(arr, i, 12)); return m.map((v, i) => (v < 0 ? -1 : avg(m, i, 5))); };
const L = smoothEdge(left), R = smoothEdge(right);

// same idea per column, so the arched top / bottom and the notches come out smooth
const topC = new Array(W).fill(-1), botC = new Array(W).fill(-1);
for (let x = 0; x < W; x++) {
  for (let y = 0; y < H - 3; y++) if (isWood(x, y) && isWood(x, y + 1) && isWood(x, y + 2)) { topC[x] = y; break; }
  for (let y = H - 1; y >= 3; y--) if (isWood(x, y) && isWood(x, y - 1) && isWood(x, y - 2)) { botC[x] = y; break; }
}
const T = smoothEdge(topC), B = smoothEdge(botC);
// anti-aliased coverage of a pixel against a [lo, hi] span
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const cover = (p, lo, hi) => Math.min(clamp01(p + 1 - lo), clamp01(hi + 1 - p));
const rows = L.map((l, y) => (l >= 0 && R[y] > l ? y : -1)).filter((y) => y >= 0);
const top = rows[0], bottom = rows[rows.length - 1];
const minX = Math.floor(Math.min(...rows.map((y) => L[y]))), maxX = Math.ceil(Math.max(...rows.map((y) => R[y])));
const PAD = 4;
const cw = maxX - minX + 1 + PAD * 2, ch = bottom - top + 1 + PAD * 2;

const alpha = Buffer.alloc(cw * ch);
for (let y = top; y <= bottom; y++) {
  if (L[y] < 0) continue;
  for (let x = Math.floor(L[y]); x <= Math.ceil(R[y]); x++) {
    if (T[x] < 0) continue;
    const a = Math.min(cover(x, L[y], R[y]), cover(y, T[x], B[x]));
    if (a > 0) alpha[(y - top + PAD) * cw + (x - Math.floor(minX) + PAD)] = Math.round(a * 255);
  }
}
const crop = await sharp(SRC).extract({ left: X0 + minX - PAD, top: Y0 + top - PAD, width: cw, height: ch }).removeAlpha().toBuffer();
const a = await sharp(alpha, { raw: { width: cw, height: ch, channels: 1 } }).blur(0.45).extractChannel(0).raw().toBuffer();
await sharp(crop).joinChannel(a, { raw: { width: cw, height: ch, channels: 1 } }).webp({ quality: 90, alphaQuality: 100 }).toFile('public/images/product-cutout.webp');
console.log('product-cutout.webp', cw, 'x', ch);
