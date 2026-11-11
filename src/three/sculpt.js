// Sculpted relief geometry for the die-cast hilt parts.
//
// The pommel and guard are real 3D meshes: a rounded "pillow" volume grown
// from the traced silhouette, a raised dragon-face ridge, and fine filigree
// depth read from the product photo's light/dark structure (polished metal is
// raised, dark wash sits in the recesses), finished in antique copper.
import * as THREE from 'three';

/* ----------------------------------------------------------- photo pixels */
export function photoSampler(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.filter = 'blur(0.6px)';
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  const at = (x, y, k) => data[(Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))) * 4 + k];
  // bilinear RGB in 0..1
  return (px, py) => {
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const a = at(x0, y0, k) * (1 - fx) + at(x0 + 1, y0, k) * fx;
      const b = at(x0, y0 + 1, k) * (1 - fx) + at(x0 + 1, y0 + 1, k) * fx;
      out[k] = (a * (1 - fy) + b * fy) / 255;
    }
    return out;
  };
}

/* --------------------------------------------------------------- geometry */
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToPoly(x, y, poly) {
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j].x, ay = poly[j].y, bx = poly[i].x, by = poly[i].y;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const ex = ax + t * dx - x, ey = ay + t * dy - y;
    d = Math.min(d, ex * ex + ey * ey);
  }
  return Math.sqrt(d);
}
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Build a relief surface (front side) over a closed silhouette.
 * opts: poly (Vector2[] cm), sample(x,y)->rgb, res (cm), baseZ, pillow, pillowW, ridge(x,y), detail
 */
export function reliefGeometry(opts) {
  const { poly, sample, res, baseZ, pillow, pillowW, ridge = () => 0, detail } = opts;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  poly.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
  const nx = Math.ceil((maxX - minX) / res) + 1, ny = Math.ceil((maxY - minY) / res) + 1;

  const pos = new Float32Array(nx * ny * 3);
  const col = new Float32Array(nx * ny * 3);
  const ok = new Uint8Array(nx * ny);
  const wash = [0.05, 0.022, 0.014], copper = [0.34, 0.17, 0.1], bright = [0.74, 0.68, 0.62], enamel = [0.40, 0.03, 0.03];

  for (let j = 0; j < ny; j++) {
    const y = minY + j * res;
    for (let i = 0; i < nx; i++) {
      const x = minX + i * res;
      const k = j * nx + i;
      const inside = pointInPoly(x, y, poly);
      const dist = inside ? distToPoly(x, y, poly) : 0;
      ok[k] = inside && dist > res * 0.35 ? 1 : 0;

      // symmetric sample of the photo (left + right halves averaged)
      const a = sample(x, y), b = sample(-x, y);
      const r = (a[0] + b[0]) / 2, g = (a[1] + b[1]) / 2, bl = (a[2] + b[2]) / 2;
      const lum = 0.3 * r + 0.59 * g + 0.11 * bl;
      const red = Math.max(0, r - Math.max(g, bl) - 0.12) * 2.4;

      const edge = smooth(0, pillowW, dist);
      const h = pillow * Math.sqrt(edge) + ridge(x, y) * edge + detail * (smooth(0.12, 0.85, lum) - 0.35) * smooth(0, pillowW * 0.6, dist);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = baseZ + Math.max(0.02, h);

      // antique finish: dark wash in recesses → copper → polished highlights; red enamel accents
      const t = smooth(0.1, 0.55, lum), hi = smooth(0.55, 0.9, lum);
      let cr = mix(mix(wash[0], copper[0], t), bright[0], hi);
      let cg = mix(mix(wash[1], copper[1], t), bright[1], hi);
      let cb = mix(mix(wash[2], copper[2], t), bright[2], hi);
      const e = Math.min(1, red);
      cr = mix(cr, enamel[0], e); cg = mix(cg, enamel[1], e); cb = mix(cb, enamel[2], e);
      col[k * 3] = cr; col[k * 3 + 1] = cg; col[k * 3 + 2] = cb;
    }
  }

  const idx = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (ok[a] && ok[b] && ok[d]) idx.push(a, b, d);
      if (ok[a] && ok[d] && ok[c]) idx.push(a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Front + mirrored back relief on a thin silhouette core.
export function sculptedPart({ poly, sample, res, core, pillow, pillowW, ridge, detail, sideMat, reliefMat }) {
  const group = new THREE.Group();
  const shape = new THREE.Shape(poly);
  const coreGeo = new THREE.ExtrudeGeometry(shape, {
    depth: core, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 3, curveSegments: 8,
  });
  coreGeo.translate(0, 0, -core / 2);
  group.add(new THREE.Mesh(coreGeo, sideMat));

  const relief = reliefGeometry({ poly, sample, res, baseZ: core / 2 + 0.1, pillow, pillowW, ridge, detail });
  const front = new THREE.Mesh(relief, reliefMat);
  const back = new THREE.Mesh(relief, reliefMat);
  back.scale.z = -1; // mirrored copy for the reverse side
  group.add(front, back);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return group;
}

/* ------------------------------------------------- etched mirror-steel map */
// White steel with only the black tribal etching lifted from the photo.
export function etchTexture(img, renderer, P, bladeHalfPx, quality = 1) {
  const k = 3 * quality;
  const X0 = 620, Y0 = 480, X1 = 846, Y1 = 900;
  const CW = Math.round((X1 - X0) * k), CH = Math.round((Y1 - Y0) * k);
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, X0, Y0, X1 - X0, Y1 - Y0, 0, 0, CW, CH);
  const src = ctx.getImageData(0, 0, CW, CH);
  const d = src.data;

  const m = document.createElement('canvas');
  m.width = CW; m.height = CH;
  const mc = m.getContext('2d', { willReadFrequently: true });
  const pts = [...bladeHalfPx, ...bladeHalfPx.slice(1, -1).reverse().map(([dx, y]) => [-dx, y])]
    .map(([dx, y]) => [(P.AX + dx - X0) * k, (y - Y0) * k]);
  mc.beginPath(); pts.forEach(([x, y], i) => (i ? mc.lineTo(x, y) : mc.moveTo(x, y))); mc.closePath();
  mc.fillStyle = '#000'; mc.fill();
  mc.globalCompositeOperation = 'destination-out';
  mc.strokeStyle = '#000'; mc.lineWidth = 15 * k; mc.stroke();
  const mask = mc.getImageData(0, 0, CW, CH).data;

  for (let i = 0; i < d.length; i += 4) {
    const lo = Math.min(d[i], d[i + 1], d[i + 2]), hi = Math.max(d[i], d[i + 1], d[i + 2]);
    const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const etch = mask[i + 3] > 128 ? smooth(92, 62, lum) * (1 - smooth(18, 34, hi - lo)) : 0;
    const v = Math.round(mix(236, 18, etch));
    d[i] = v; d[i + 1] = v; d[i + 2] = Math.round(mix(240, 18, etch)); d[i + 3] = 255;
  }
  ctx.putImageData(src, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(k / (P.SX * CW), k / (P.SY * CH));
  t.offset.set(((P.AX - X0) * k) / CW, 1 - ((P.TIP - Y0) * k) / CH);
  t.needsUpdate = true;
  return t;
}
