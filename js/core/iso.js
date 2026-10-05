// Изометрия: проекция и примитивы рисования.
// Все функции рисования работают в «канонической» ориентации; при повороте (swap)
// оси x/y меняются местами, освещение считается по реально видимым граням.
import { shade } from './util.js';
export const TW = 64, TH = 32, HW = 32, HH = 16;
let SW = false;
export const setSwap = (v) => { SW = v; };
const pr = (x, y, z) => [(x - y) * HW, (x + y) * HH - z];
export const P = (x, y, z = 0) => (SW ? pr(y, x, z) : pr(x, y, z));
export const proj = pr;

export function poly(c, pts, fill, stroke, lw = 1) {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
const face = (c, pts, col) => poly(c, pts, col, col, 0.8);

// Мягкая тень на земле (круг радиуса r в клетках)
export function shadow(c, cx, cy, r, a = 0.2) {
  const [X, Y] = P(cx, cy, 0);
  c.fillStyle = `rgba(30,20,40,${a})`;
  c.beginPath(); c.ellipse(X, Y, r * 45, r * 22.6, 0, 0, Math.PI * 2); c.fill();
}

// Ромб на земле (в клетках)
export function diamond(c, x, y, w, d, fill, stroke, lw = 1, z = 0) {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  poly(c, [pr(x, y, z), pr(x + w, y, z), pr(x + w, y + d, z), pr(x, y + d, z)], fill, stroke, lw);
}

// Рисование в плоскости земли: координаты в клетках
export function plane(c, z, fn) {
  c.save();
  const [X, Y] = pr(0, 0, z);
  if (SW) c.transform(-HW, HH, HW, HH, X, Y); else c.transform(HW, HH, -HW, HH, X, Y);
  fn(c);
  c.restore();
}

// Параллелепипед
export function box(c, x, y, z, w, d, h, col, o = {}) {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  const L = o.left || shade(col, 0.02), R = o.right || shade(col, -0.2), T = o.top || shade(col, 0.14);
  const b2 = pr(x + w, y + d, z + h);
  const a2 = pr(x, y + d, z + h);
  face(c, [pr(x, y + d, z), pr(x + w, y + d, z), b2, a2], L);
  face(c, [pr(x + w, y + d, z), pr(x + w, y, z), pr(x + w, y, z + h), b2], R);
  if (!o.notop) face(c, [pr(x, y, z + h), pr(x + w, y, z + h), b2, a2], T);
  if (o.tex) boxTex(c, x, y, z, w, d, h, o.tex, o.texA ?? 0.14);
}
function boxTex(c, x, y, z, w, d, h, tex, A) {
  c.save();
  c.strokeStyle = `rgba(30,15,10,${A})`; c.lineWidth = 0.9;
  c.beginPath();
  const step = tex === 'brick' ? 5 : tex === 'planks' ? 4.5 : 6;
  if (tex === 'planks' || tex === 'brick' || tex === 'stone') {
    for (let k = step; k < h; k += step) {
      let a = pr(x, y + d, z + k), b = pr(x + w, y + d, z + k); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
      a = pr(x + w, y + d, z + k); b = pr(x + w, y, z + k); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
    }
  }
  if (tex === 'logs') {
    const n = Math.max(2, Math.round(w * 4));
    for (let i = 1; i < n; i++) { const t = i / n; const a = pr(x + w * t, y + d, z), b = pr(x + w * t, y + d, z + h); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
    const m = Math.max(2, Math.round(d * 4));
    for (let i = 1; i < m; i++) { const t = i / m; const a = pr(x + w, y + d * t, z), b = pr(x + w, y + d * t, z + h); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); }
  }
  if (tex === 'brick' || tex === 'stone') {
    let r = 0;
    for (let k = 0; k < h; k += step, r++) {
      const off = (r % 2) * 0.12;
      for (let t = 0.12 + off; t < 1; t += 0.24) {
        let a = pr(x + w * t, y + d, z + k), b = pr(x + w * t, y + d, z + Math.min(h, k + step)); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
        a = pr(x + w, y + d * t, z + k); b = pr(x + w, y + d * t, z + Math.min(h, k + step)); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
      }
    }
  }
  c.stroke(); c.restore();
}

// Прямоугольник на вертикальной грани. side 'L' (y=const, u вдоль x) или 'R' (x=const, u вдоль y)
export function wallRect(c, side, pos, u0, u1, z0, z1, fill, stroke) {
  const A = side === 'L' ? [u0, pos] : [pos, u1], B = side === 'L' ? [u1, pos] : [pos, u0];
  const p = [P(A[0], A[1], z0), P(B[0], B[1], z0), P(B[0], B[1], z1), P(A[0], A[1], z1)];
  poly(c, p, fill, stroke, 1);
}

// Двускатная крыша. axis 'x' | 'y' — направление конька
export function gable(c, x, y, z, w, d, h, o, col, wallCol, axis = 'x') {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; axis = axis === 'x' ? 'y' : 'x'; }
  if (axis === 'x') {
    const my = y + d / 2;
    if (wallCol) face(c, [pr(x + w, y, z), pr(x + w, y + d, z), pr(x + w, my, z + h)], wallCol);
    face(c, [pr(x - o, y + d + o, z), pr(x + w + o, y + d + o, z), pr(x + w + o, my, z + h), pr(x - o, my, z + h)], col);
    c.strokeStyle = shade(col, -0.25); c.lineWidth = 1.2; c.beginPath();
    const a = pr(x - o, my, z + h), b = pr(x + w + o, my, z + h); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  } else {
    const mx = x + w / 2;
    if (wallCol) face(c, [pr(x, y + d, z), pr(x + w, y + d, z), pr(mx, y + d, z + h)], wallCol);
    face(c, [pr(x + w + o, y - o, z), pr(x + w + o, y + d + o, z), pr(mx, y + d + o, z + h), pr(mx, y - o, z + h)], shade(col, -0.18));
    c.strokeStyle = shade(col, -0.3); c.lineWidth = 1.2; c.beginPath();
    const a = pr(mx, y - o, z + h), b = pr(mx, y + d + o, z + h); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
}
// Пирамидальная крыша
export function pyramid(c, x, y, z, w, d, h, o, col) {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  const ap = pr(x + w / 2, y + d / 2, z + h);
  face(c, [pr(x - o, y + d + o, z), pr(x + w + o, y + d + o, z), ap], col);
  face(c, [pr(x + w + o, y + d + o, z), pr(x + w + o, y - o, z), ap], shade(col, -0.2));
}
// Односкатная (плоская наклонная) крыша: высокая сторона у y (задняя)
export function lean(c, x, y, z, w, d, h0, h1, o, col) {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  face(c, [pr(x - o, y + d + o, z + h0), pr(x + w + o, y + d + o, z + h0), pr(x + w + o, y - o, z + h1), pr(x - o, y - o, z + h1)], col);
  face(c, [pr(x + w + o, y + d + o, z + h0), pr(x + w + o, y - o, z + h1), pr(x + w + o, y - o, z + h1 - 2), pr(x + w + o, y + d + o, z + h0 - 2)], shade(col, -0.25));
}

// Цилиндр
export function cyl(c, cx, cy, z, r, h, col, o = {}) {
  const [X, Y] = P(cx, cy, z);
  const rx = r * 45.25, ry = r * 22.6;
  const g = c.createLinearGradient(X - rx, 0, X + rx, 0);
  g.addColorStop(0, o.left || shade(col, 0.1)); g.addColorStop(0.45, col); g.addColorStop(1, o.right || shade(col, -0.28));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(X - rx, Y - h); c.lineTo(X - rx, Y);
  c.ellipse(X, Y, rx, ry, 0, Math.PI, 0, true);
  c.lineTo(X + rx, Y - h);
  c.ellipse(X, Y - h, rx, ry, 0, 0, Math.PI, false);
  c.closePath(); c.fill();
  if (!o.notop) { c.fillStyle = o.top || shade(col, 0.15); c.beginPath(); c.ellipse(X, Y - h, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  if (o.rings) {
    c.strokeStyle = o.ringCol || shade(col, -0.35); c.lineWidth = 1.4;
    for (const t of o.rings) { const yy = Y - h * t; c.beginPath(); c.ellipse(X, yy, rx, ry, 0, 0, Math.PI); c.stroke(); }
  }
}
// Конус (палатки, ёлки)
export function cone(c, cx, cy, z, r, h, col) {
  const [X, Y] = P(cx, cy, z);
  const rx = r * 45.25, ry = r * 22.6;
  const g = c.createLinearGradient(X - rx, 0, X + rx, 0);
  g.addColorStop(0, shade(col, 0.1)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.3));
  c.fillStyle = g;
  c.beginPath(); c.moveTo(X - rx, Y); c.lineTo(X, Y - h); c.lineTo(X + rx, Y);
  c.ellipse(X, Y, rx, ry, 0, 0, Math.PI, false); c.closePath(); c.fill();
}
// Эллиптический «шар»/куст по центру клетки (cx,cy), высота z, радиусы в пикселях
export function blob(c, cx, cy, z, rx, ry, col, o = {}) {
  const [X, Y] = P(cx, cy, z);
  const g = c.createRadialGradient(X - rx * 0.35, Y - ry * 0.4, rx * 0.1, X, Y, rx * 1.05);
  g.addColorStop(0, o.hi || shade(col, 0.25)); g.addColorStop(0.55, col); g.addColorStop(1, o.lo || shade(col, -0.28));
  c.fillStyle = g;
  c.beginPath(); c.ellipse(X, Y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
export function ball(c, cx, cy, z, r, col) { blob(c, cx, cy, z, r, r, col); }
export function line3(c, a, b, col, lw = 1.5) {
  const p = P(a[0], a[1], a[2] || 0), q = P(b[0], b[1], b[2] || 0);
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
}
// Пламя
export function flame(c, cx, cy, z, size, t, seed = 0) {
  const [X, Y] = P(cx, cy, z);
  const w = size * (0.9 + 0.1 * Math.sin(t * 9 + seed)), hh = size * 1.7 * (0.9 + 0.12 * Math.sin(t * 7 + seed * 2));
  const sway = Math.sin(t * 5 + seed) * size * 0.12;
  const g = (col, s) => { c.fillStyle = col; c.beginPath(); c.moveTo(X - w * s, Y); c.quadraticCurveTo(X - w * s * 0.9, Y - hh * s * 0.5, X + sway * s, Y - hh * s); c.quadraticCurveTo(X + w * s * 0.9, Y - hh * s * 0.5, X + w * s, Y); c.closePath(); c.fill(); };
  g('#ff8a2a', 1); g('#ffc83a', 0.68); g('#fff2a8', 0.36);
}
