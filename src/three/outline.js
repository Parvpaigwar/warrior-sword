// Traced product outlines and photo → cm calibration.
//
// Pure data + maths (no three.js), so the blueprint drawing can use the exact
// same outlines as the 3D model without pulling the WebGL engine into the
// page's main bundle. Points are plain {x, y} objects (cm, sword tip at y = 0).

const V = (x, y) => ({ x, y });

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
export const BLADE_PX = [
  [0, 492], [36, 494], [46.3, 516.7], [53, 541.7], [41.3, 539.3], [29.7, 546.7], [27.3, 558.3], [31.3, 570],
  [44.7, 577.3], [53, 580], [41.3, 588.3], [38, 603.3], [38.7, 633.3], [43, 647.3], [84.7, 601.7], [86.7, 616.7],
  [83, 650], [75.3, 689.3], [68, 677.3], [56.3, 693.3], [48, 720], [44.7, 743.3], [51.3, 751.7], [39.7, 768.3],
  [30.5, 800], [28.5, 850], [29.5, 900], [29.8, 1000], [29, 1100], [25, 1150], [18.5, 1200], [10, 1232], [0, 1255],
];
export const GUARD_PX = [
  [0, 398], [23, 410], [43, 423.3], [70, 410], [86.5, 391.7], [98, 406.7], [106.5, 431.7], [116.5, 445], [118, 460],
  [115, 493.3], [106.5, 533.3], [96.5, 573.3], [90, 546.7], [85, 516.7], [76.5, 493.3], [63, 485], [43, 485],
  [30, 491.7], [13, 506.7], [0, 523.3],
];
export const POMMEL_PX = [
  [0, 146], [8.3, 150], [14, 160], [18.3, 131.7], [22.7, 146.7], [21.7, 170], [35, 176.7], [36.7, 193.3],
  [30, 203.3], [31.7, 230], [28.3, 246.7], [18.3, 253.3], [0, 256],
];
export const GRIP_PX = { top: 252, bottom: 402, half: 21 };

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

// Minimal 2D path (moveTo / lineTo / quadraticCurveTo) whose getPoints() samples
// exactly like THREE.Path: lines contribute their end point, quadratic curves
// `divisions` steps, consecutive duplicates dropped.
function path() {
  const segs = [];
  let cur = V(0, 0);
  return {
    moveTo(x, y) { cur = V(x, y); segs.push({ type: 'M', p: cur }); },
    lineTo(x, y) { const p = V(x, y); segs.push({ type: 'L', a: cur, p }); cur = p; },
    quadraticCurveTo(cx, cy, x, y) { const p = V(x, y); segs.push({ type: 'Q', a: cur, c: V(cx, cy), p }); cur = p; },
    getPoints(divisions = 12) {
      const out = [];
      let last;
      const push = (pt) => { if (last && last.x === pt.x && last.y === pt.y) return; out.push(pt); last = pt; };
      for (const s of segs) {
        if (s.type === 'L') { push(V(s.a.x, s.a.y)); push(V(s.p.x, s.p.y)); }
        else if (s.type === 'Q') {
          for (let d = 0; d <= divisions; d++) {
            const t = d / divisions, k = 1 - t;
            const q = (p0, p1, p2) => k * k * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
            push(V(q(s.a.x, s.c.x, s.p.x), q(s.a.y, s.c.y, s.p.y)));
          }
        }
      }
      return out;
    },
  };
}

// Plaque, built to the spec widths with heights read off the photo.
export const plaqueY = (p) => (PHOTO.PLAQUE_BOTTOM - p) * PHOTO.PSY;
export function plaqueHalfOutline() {
  const J = 11.5, K = 8.75, L = 11, py = plaqueY;
  const p = path();
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
