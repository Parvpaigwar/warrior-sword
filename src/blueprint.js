// Technical drawing generated from the exact outlines used by the 3D model.
import {
  bladeHalfOutline, guardHalfOutline, pommelHalfOutline, plaqueHalfOutline, gripSpan, mirror, TIP_ON_PLAQUE,
} from './three/model.js';

const TOP = 110; // svg y = TOP - y(cm)
const T = TIP_ON_PLAQUE;
const pathOf = (pts, dy = 0) =>
  'M' + pts.map((p) => `${p.x.toFixed(2)},${(TOP - (p.y + dy)).toFixed(2)}`).join('L') + 'Z';

export function drawBlueprint(svg) {
  svg.setAttribute('viewBox', '-34 -2 68 118');
  const g = gripSpan();
  const swordTop = T + Math.max(...pommelHalfOutline().map((p) => p.y));
  const guardBottom = T + Math.min(...guardHalfOutline().map((p) => p.y));
  const guardWide = T + guardHalfOutline().reduce((a, p) => (p.x > a.x ? p : a)).y;

  let html = '';
  html += `<path class="bp-outline bp-draw" d="${pathOf(mirror(plaqueHalfOutline()))}"/>`;
  html += `<path class="bp-sword bp-draw" d="${pathOf(mirror(bladeHalfOutline()), T)}"/>`;
  html += `<path class="bp-sword bp-draw" d="${pathOf(mirror(guardHalfOutline()), T)}"/>`;
  html += `<path class="bp-sword bp-draw" d="${pathOf(mirror(pommelHalfOutline()), T)}"/>`;
  html += `<rect class="bp-sword bp-draw" x="${-g.r}" y="${TOP - (T + g.y1)}" width="${g.r * 2}" height="${g.y1 - g.y0}" rx="0.5"/>`;
  for (let i = 0; i < 9; i++) {
    const y = TOP - (T + g.y0 + 0.6 + (i * (g.y1 - g.y0 - 1.2)) / 8.5);
    html += `<line class="bp-sword" x1="${-g.r}" y1="${y}" x2="${g.r}" y2="${y - 0.7}"/>`;
  }

  const dims = [];
  const vdim = (x, y0, y1, label) => dims.push({ type: 'v', x, y0, y1, label });
  const hdim = (y, x0, x1, label) => dims.push({ type: 'h', y, x0, x1, label });
  vdim(-17, 0, 104, 'H · 104 cm');
  vdim(16.5, T, swordTop, 'A · 95 cm');
  vdim(23.5, T, guardBottom, 'C · 69 cm');
  vdim(23.5, guardBottom, swordTop, 'B · 27 cm');
  hdim(guardWide + 7.5, -9, 9, 'D · 18 cm');
  hdim(-2.2, -11, 11, 'L · 22 cm');
  hdim(108.2, -11.5, 11.5, 'J · 23 cm');
  hdim(40, -8.75, 8.75, 'K · 17.5 cm');

  dims.forEach((d, i) => {
    if (d.type === 'v') {
      const y0 = TOP - d.y0, y1 = TOP - d.y1;
      html += `<g class="bp-dimg" style="--i:${i}">
        <line class="bp-dim bp-draw" x1="${d.x}" y1="${y0}" x2="${d.x}" y2="${y1}"/>
        <line class="bp-tick" x1="${d.x - 1}" y1="${y0}" x2="${d.x + 1}" y2="${y0}"/>
        <line class="bp-tick" x1="${d.x - 1}" y1="${y1}" x2="${d.x + 1}" y2="${y1}"/>
        <g transform="translate(${d.x},${(y0 + y1) / 2}) rotate(-90)">
          <rect class="bp-label-bg" x="-8" y="-2" width="16" height="4" rx="1"/>
          <text class="bp-label" text-anchor="middle" dominant-baseline="central">${d.label}</text>
        </g></g>`;
    } else {
      const y = TOP - d.y;
      html += `<g class="bp-dimg" style="--i:${i}">
        <line class="bp-dim bp-draw" x1="${d.x0}" y1="${y}" x2="${d.x1}" y2="${y}"/>
        <line class="bp-tick" x1="${d.x0}" y1="${y - 1}" x2="${d.x0}" y2="${y + 1}"/>
        <line class="bp-tick" x1="${d.x1}" y1="${y - 1}" x2="${d.x1}" y2="${y + 1}"/>
        <rect class="bp-label-bg" x="-8" y="${y - 2}" width="16" height="4" rx="1"/>
        <text class="bp-label" x="0" y="${y}" text-anchor="middle" dominant-baseline="central">${d.label}</text></g>`;
    }
  });
  svg.innerHTML = html;
  svg.querySelectorAll('.bp-draw').forEach((el) => {
    const len = el.getTotalLength ? el.getTotalLength() : 300;
    el.style.strokeDasharray = len;
    el.style.strokeDashoffset = len;
  });
  return svg;
}
