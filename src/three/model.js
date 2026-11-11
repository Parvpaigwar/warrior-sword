// 3D replica of the Warrior Sword + walnut wall plaque.
//
// Every silhouette below was traced point-by-point from the front product
// photo (public/textures/product-ref.webp, 1086×1448 px) and converted to
// centimetres so the piece matches the vendor spec: sword ≈ 95 cm, guard 18 cm,
// etched section 13 cm, plaque 104 × 23 / 17.5 / 22 cm.
// The same photo is projected onto the front faces, so the etching, the
// dragon-wing guard and the pommel carry the real product artwork.
import * as THREE from 'three';
import { photoSampler, sculptedPart, etchTexture } from './sculpt.js';

const V = (x, y) => new THREE.Vector2(x, y);

/* ------------------------------------------------ photo → cm calibration */
export const PHOTO = {
  url: '/textures/product-ref.webp',
  W: 1086, H: 1448,
  AX: 732.5,          // sword / plaque centre line (px)
  TIP: 1255,          // blade tip (px)
  SX: 18 / 236,       // sword cm per px, horizontal (guard span = 18 cm)
  SY: 95 / 1123,      // sword cm per px, vertical (crest → tip = 95 cm)
  PLAQUE_BOTTOM: 1315,
  PSX: 23 / 320,      // plaque cm per px, horizontal (top width = 23 cm)
  PSY: 104 / 1207,    // plaque cm per px, vertical (height = 104 cm)
};
export const TIP_ON_PLAQUE = (PHOTO.PLAQUE_BOTTOM - PHOTO.TIP) * PHOTO.PSY; // ≈ 5.2 cm

// traced right halves: [dx px from centre line, y px]
const BLADE_PX = [
  [0, 492], [36, 494], [46.3, 516.7], [53, 541.7], [41.3, 539.3], [29.7, 546.7], [27.3, 558.3], [31.3, 570],
  [44.7, 577.3], [53, 580], [41.3, 588.3], [38, 603.3], [38.7, 633.3], [43, 647.3], [84.7, 601.7], [86.7, 616.7],
  [83, 650], [75.3, 689.3], [68, 677.3], [56.3, 693.3], [48, 720], [44.7, 743.3], [51.3, 751.7], [39.7, 768.3],
  [30.5, 800], [28.5, 850], [29.5, 900], [29.8, 1000], [29, 1100], [25, 1150], [18.5, 1200], [10, 1232], [0, 1255],
];
const GUARD_PX = [
  [0, 398], [23, 410], [43, 423.3], [70, 410], [86.5, 391.7], [98, 406.7], [106.5, 431.7], [116.5, 445], [118, 460],
  [115, 493.3], [106.5, 533.3], [96.5, 573.3], [90, 546.7], [85, 516.7], [76.5, 493.3], [63, 485], [43, 485],
  [30, 491.7], [13, 506.7], [0, 523.3],
];
const POMMEL_PX = [
  [0, 146], [8.3, 150], [14, 160], [18.3, 131.7], [22.7, 146.7], [21.7, 170], [35, 176.7], [36.7, 193.3],
  [30, 203.3], [31.7, 230], [28.3, 246.7], [18.3, 253.3], [0, 256],
];
const GRIP_PX = { top: 252, bottom: 402, half: 21 };

const toSword = ([dx, y]) => V(dx * PHOTO.SX, (PHOTO.TIP - y) * PHOTO.SY);

// Right-half outlines in sword space (cm, tip at y = 0).
export const bladeHalfOutline = () => BLADE_PX.map(toSword);
export const guardHalfOutline = () => GUARD_PX.map(toSword);
export const pommelHalfOutline = () => POMMEL_PX.map(toSword);
export const gripSpan = () => ({
  y0: (PHOTO.TIP - GRIP_PX.bottom) * PHOTO.SY,
  y1: (PHOTO.TIP - GRIP_PX.top) * PHOTO.SY,
  r: GRIP_PX.half * PHOTO.SX,
});

// Plaque, built to the spec widths with heights read off the photo.
export const plaqueY = (p) => (PHOTO.PLAQUE_BOTTOM - p) * PHOTO.PSY;
export function plaqueHalfOutline() {
  const J = 11.5, K = 8.75, L = 11, py = plaqueY;
  const p = new THREE.Path();
  p.moveTo(0, 0);
  p.quadraticCurveTo(4.5, 0.15, 8.0, py(1275)); // shallow arched bottom
  p.quadraticCurveTo(8.0, py(1230), L, py(1230)); // notched bottom corner
  p.lineTo(L, py(1065));
  p.quadraticCurveTo(K, py(1065), K, py(1040)); // step into the waist
  p.lineTo(K, py(600));
  p.quadraticCurveTo(K, py(575), J, py(575)); // step out to the top section
  p.lineTo(J, py(200));
  p.quadraticCurveTo(8.3, py(200), 8.3, py(150)); // notched top corner
  p.quadraticCurveTo(4.6, 104.1, 0, 104); // arched top
  return p.getPoints(14);
}

export function mirror(half) {
  const left = half.slice(1, -1).reverse().map((v) => V(-v.x, v.y));
  return [...half, ...left];
}

/* ------------------------------------------------------------- textures */
function loadImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Walnut plaque: procedural grain + the real white tribal prints lifted from the photo.
function plaqueTexture(img, renderer, quality) {
  const S = 2 * quality; // canvas px per photo px
  const X0 = 555, Y0 = 95, X1 = 910, Y1 = 1330;
  const CW = Math.round((X1 - X0) * S), CH = Math.round((Y1 - Y0) * S);
  const c = document.createElement('canvas');
  c.width = CW; c.height = CH;
  const ctx = c.getContext('2d');
  const r = rng(42);

  // wood
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  g.addColorStop(0, '#36201a'); g.addColorStop(0.5, '#2c1912'); g.addColorStop(1, '#382119');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 700 * quality; i++) {
    const x0 = r() * CW, amp = 2 + r() * 9 * S, f = 0.0015 / S + (r() * 0.004) / S, ph = r() * 10;
    ctx.strokeStyle = r() > 0.45 ? `rgba(14,6,3,${0.08 + r() * 0.18})` : `rgba(105,62,40,${0.05 + r() * 0.1})`;
    ctx.lineWidth = 0.5 + r() * 2.2 * S;
    ctx.beginPath();
    for (let y = 0; y <= CH; y += 20) {
      const x = x0 + Math.sin(y * f + ph) * amp + Math.sin(y * f * 3.1 + ph) * amp * 0.25;
      y ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // mask of everything the sword covers in the photo (so only the prints are lifted)
  const m = document.createElement('canvas');
  m.width = CW; m.height = CH;
  const mc = m.getContext('2d', { willReadFrequently: true });
  const toC = ([dx, y]) => [(PHOTO.AX + dx - X0) * S, (y - Y0) * S];
  const poly = (half) => {
    const pts = [...half, ...half.slice(1, -1).reverse().map(([dx, y]) => [-dx, y])].map(toC);
    mc.beginPath();
    pts.forEach(([x, y], i) => (i ? mc.lineTo(x, y) : mc.moveTo(x, y)));
    mc.closePath(); mc.fill(); mc.stroke();
  };
  mc.fillStyle = mc.strokeStyle = '#000';
  mc.lineWidth = 8 * S; mc.lineJoin = 'round';
  poly(BLADE_PX); poly(GUARD_PX); poly(POMMEL_PX);
  const [gx0, gy0] = toC([-GRIP_PX.half - 4, GRIP_PX.top]);
  const [gx1, gy1] = toC([GRIP_PX.half + 4, GRIP_PX.bottom]);
  mc.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  // lift the white prints out of the photo — only inside the four print areas
  const p = document.createElement('canvas');
  p.width = CW; p.height = CH;
  const pc = p.getContext('2d', { willReadFrequently: true });
  pc.drawImage(img, X0, Y0, X1 - X0, Y1 - Y0, 0, 0, CW, CH);
  const ss = (e0, e1, x) => { const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
  // The bottom prints are fully visible in the photo; the top prints are the same
  // artwork flipped vertically but partly hidden by the hilt, so we reuse the bottom ones.
  const PRINT = { y0: 996, y1: 1244, topY0: 222 };
  const boxes = [[622, 692], [772, 838]];
  for (const [a0, a1] of boxes) {
    const bx = Math.round((a0 - X0) * S), by = Math.round((PRINT.y0 - Y0) * S);
    const bw = Math.round((a1 - a0) * S), bh = Math.round((PRINT.y1 - PRINT.y0) * S);
    const src = pc.getImageData(bx, by, bw, bh);
    const mk = mc.getImageData(bx, by, bw, bh).data;
    const d = src.data;
    for (let i = 0; i < d.length; i += 4) {
      if (mk[i + 3] > 10) { d[i + 3] = 0; continue; }
      const lo = Math.min(d[i], d[i + 1], d[i + 2]), hi = Math.max(d[i], d[i + 1], d[i + 2]);
      const al = ss(105, 175, lo) * (1 - ss(40, 80, hi - lo));
      d[i] = 240; d[i + 1] = 234; d[i + 2] = 224; d[i + 3] = Math.round(al * 255);
    }
    const out = document.createElement('canvas');
    out.width = bw; out.height = bh;
    out.getContext('2d').putImageData(src, 0, 0);
    ctx.drawImage(out, bx, by); // bottom print
    const ty = Math.round((PRINT.topY0 - Y0) * S);
    ctx.save(); ctx.translate(bx, ty + bh); ctx.scale(1, -1); ctx.drawImage(out, 0, 0); ctx.restore(); // top print
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // plaque UVs (cm) → canvas
  const { AX, PSX, PSY, PLAQUE_BOTTOM } = PHOTO;
  t.repeat.set(S / (PSX * CW), S / (PSY * CH));
  t.offset.set(((AX - X0) * S) / CW, 1 - ((PLAQUE_BOTTOM - Y0) * S) / CH);
  t.needsUpdate = true;
  return t;
}

/* ----------------------------------------------------------- materials */
function materials(etchTex, plaqueTex) {
  return {
    blade: new THREE.MeshPhysicalMaterial({ map: etchTex, metalness: 0.78, roughness: 0.17, clearcoat: 0.8, clearcoatRoughness: 0.06, envMapIntensity: 1.8 }),
    bladeEdge: new THREE.MeshStandardMaterial({ color: 0xe3e6e9, metalness: 1, roughness: 0.12, envMapIntensity: 1.5 }),
    relief: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.62, roughness: 0.38, envMapIntensity: 0.9 }),
    copperSide: new THREE.MeshStandardMaterial({ color: 0x5a2f20, metalness: 0.9, roughness: 0.38 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a958, metalness: 1, roughness: 0.22 }),
    grip: new THREE.MeshPhysicalMaterial({ color: 0x5a1a10, metalness: 0.55, roughness: 0.22, clearcoat: 1 }),
    steelRing: new THREE.MeshStandardMaterial({ color: 0xb9bcc0, metalness: 1, roughness: 0.2 }),
    amber: new THREE.MeshPhysicalMaterial({ color: 0xf2c46a, emissive: 0x5a3305, emissiveIntensity: 0.5, roughness: 0.06, metalness: 0, clearcoat: 1, transmission: 0.25, thickness: 0.5 }),
    ruby: new THREE.MeshPhysicalMaterial({ color: 0xb3121d, emissive: 0x420306, emissiveIntensity: 0.7, roughness: 0.05, clearcoat: 1, flatShading: true }),
    walnut: new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.62, metalness: 0, envMapIntensity: 0.45 }),
    walnutSide: new THREE.MeshStandardMaterial({ color: 0x3a2118, roughness: 0.55 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xcaa055, metalness: 1, roughness: 0.28 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 1, roughness: 0.3, side: THREE.DoubleSide }),
  };
}

function extrude(points, depth, bevel, segs = 3, size = bevel * 0.5) {
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: size, bevelSegments: segs, curveSegments: 12,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------------- sword */
function buildSword(m, sample, quality) {
  const sword = new THREE.Group();
  sword.name = 'sword';
  const res = quality >= 1 ? 0.07 : 0.1;

  // mirror-steel blade with real bevelled edges
  const bladePts = mirror(bladeHalfOutline().map((v) => V(Math.max(0, v.x - 0.3), v.y)));
  sword.add(new THREE.Mesh(extrude(bladePts, 0.26, 0.13, 3, 0.32), [m.blade, m.bladeEdge]));

  // sculpted dragon-wing guard: rounded wings, raised dragon face, filigree relief
  const guard = sculptedPart({
    poly: mirror(guardHalfOutline()), sample, res, core: 0.5, pillow: 0.55, pillowW: 1.1, detail: 0.32,
    ridge: (x, y) => 0.75 * Math.exp(-((x / 2.3) ** 2)) * Math.exp(-(((y - 69) / 4.5) ** 2)),
    sideMat: m.copperSide, reliefMat: m.relief,
  });
  sword.add(guard);
  // amber cabochon eyes set in gold bezels
  const eyeY = (PHOTO.TIP - 470) * PHOTO.SY, eyeX = 55 * PHOTO.SX;
  [-1, 1].forEach((s) => [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 20), m.amber);
    eye.scale.z = 0.7;
    eye.position.set(s * eyeX, eyeY, side * 0.95);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.13, 12, 36), m.gold);
    bezel.position.set(s * eyeX, eyeY, side * 0.92);
    sword.add(eye, bezel);
  }));

  // sculpted dragon-head pommel: round head, horns, crest
  const pommel = sculptedPart({
    poly: mirror(pommelHalfOutline()), sample, res: res * 0.8, core: 0.6, pillow: 1.15, pillowW: 1.5, detail: 0.22,
    ridge: (x) => 0.25 * Math.exp(-((x / 1.2) ** 2)),
    sideMat: m.copperSide, reliefMat: m.relief,
  });
  sword.add(pommel);
  const crestY = (PHOTO.TIP - 168) * PHOTO.SY;
  [-1, 1].forEach((side) => {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 1), m.ruby);
    gem.scale.set(0.85, 1.35, 0.7);
    gem.position.set(0, crestY, side * 1.75);
    sword.add(gem);
  });

  // grip: lacquered red sleeve and 9 turns of gold wire
  const { y0, y1, r } = gripSpan();
  const len = y1 - y0;
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.98, len, 40), m.grip);
  sleeve.position.y = y0 + len / 2;
  sword.add(sleeve);
  class Helix extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = t * 9 * Math.PI * 2;
      return target.set(Math.cos(a) * r, y0 + 0.5 + t * (len - 1), Math.sin(a) * r);
    }
  }
  sword.add(new THREE.Mesh(new THREE.TubeGeometry(new Helix(), 600, 0.2, 10), m.gold));
  [y0 + 0.15, y1 - 0.15].forEach((y) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 0.25, 12, 40), m.steelRing);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    sword.add(ring);
  });

  sword.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return sword;
}

/* --------------------------------------------------------------- plaque */
function buildPlaque(m) {
  const plaque = new THREE.Group();
  plaque.name = 'plaque';
  const depth = 1.9;
  const board = new THREE.Mesh(extrude(mirror(plaqueHalfOutline()), depth, 0.3), [m.walnut, m.walnutSide]);
  board.position.z = depth / 2;
  board.receiveShadow = true;
  board.castShadow = true;
  plaque.add(board);

  const front = depth + 0.3;
  // metal tip cup (the brass pegs sit hidden behind the guard)
  const cupY = plaqueY(1238);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.0, 1.0, 28, 1, true, 0, Math.PI), m.steelDark);
  cup.rotation.y = Math.PI / 2;
  cup.position.set(0, cupY, front + 1.1);
  plaque.add(cup);
  const cupBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.3, 2.2), m.steelDark);
  cupBase.position.set(0, cupY - 0.55, front + 1.1);
  plaque.add(cupBase);
  return plaque;
}

/* -------------------------------------------------------------- product */
export const SWORD_Z = 3.4;
export const PRODUCT_CENTER_Y = 52;

export async function buildProduct(renderer, quality = 1) {
  const img = await loadImage(PHOTO.url);
  const m = materials(etchTexture(img, renderer, PHOTO, BLADE_PX, quality), plaqueTexture(img, renderer, quality));

  const inner = new THREE.Group();
  inner.position.y = -PRODUCT_CENTER_Y;
  inner.add(buildPlaque(m));

  const swordPivot = new THREE.Group(); // animated when the sword comes off the wall
  swordPivot.position.set(0, TIP_ON_PLAQUE, SWORD_Z);
  const sample = photoSampler(img);
  const swordSample = (x, y) => sample(PHOTO.AX + x / PHOTO.SX, PHOTO.TIP - y / PHOTO.SY);
  swordPivot.add(buildSword(m, swordSample, quality));
  inner.add(swordPivot);

  const root = new THREE.Group();
  root.add(inner);
  root.scale.setScalar(0.035);
  return { root, inner, swordPivot };
}
