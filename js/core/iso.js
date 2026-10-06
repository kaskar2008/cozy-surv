// 3D-«кисть»: те же примитивы, что раньше рисовали изометрию на canvas (box, cyl, blob, gable…),
// теперь пишут треугольники в 3D-буфер. Описания построек и мебели остались прежними:
// draw(c, b, o) получает билдер `c`, координаты — в клетках от угла объекта, высоты — в «пикселях» исходной графики.
// Игровая клетка (x, y) -> three (X = x, Y = высота, Z = y); высота в пикселях переводится через KZ.
import { shade } from './util.js';

export const TW = 64, TH = 32, HW = 32, HH = 16;
export const KX = 45.25;             // пикселей на единицу длины по горизонтали (ромб 64×32)
export const KZ = 39.19;             // пикселей на единицу высоты при угле камеры 30°
export const hz = (px) => px / KZ;

let SW = false;                      // «зеркальный» поворот: x и y меняются местами (как раньше)
export const setSwap = (v) => { SW = v; };
export const isSwap = () => SW;

const pr = (x, y, z) => [(x - y) * HW, (x + y) * HH - z];
// P — «экранная» точка (как раньше), но с мировыми координатами в .w: из неё можно собрать 3D-многоугольник
export const P = (x, y, z = 0) => {
  const [a, b] = SW ? [y, x] : [x, y];
  const r = pr(a, b, z); r.w = [a, b, z];
  return r;
};
export const proj = pr;

// ───────────── цвет ─────────────
const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const colCache = new Map();
export function rgba(s) {
  let r = colCache.get(s);
  if (r) return r;
  let R = 128, G = 128, B = 128, A = 1;
  if (s && s[0] === '#') {
    let h = s;
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    R = parseInt(h.slice(1, 3), 16); G = parseInt(h.slice(3, 5), 16); B = parseInt(h.slice(5, 7), 16);
    if (h.length === 9) A = parseInt(h.slice(7, 9), 16) / 255;
  } else if (s) {
    const m = s.match(/[\d.]+/g);
    if (m) { R = +m[0]; G = +m[1]; B = +m[2]; if (m.length > 3) A = +m[3]; }
  }
  r = [lin(R / 255), lin(G / 255), lin(B / 255), A];
  colCache.set(s, r);
  return r;
}

// ───────────── буфер треугольников ─────────────
export class Buf {
  constructor(cap = 2048) { this.cap = cap; this.n = 0; this.pos = new Float32Array(cap * 3); this.nor = new Float32Array(cap * 3); this.col = new Float32Array(cap * 4); }
  ensure(k) {
    if (this.n + k <= this.cap) return;
    let cap = this.cap; while (cap < this.n + k) cap *= 2;
    const grow = (a, m) => { const b = new Float32Array(cap * m); b.set(a.subarray(0, this.n * m)); return b; };
    this.pos = grow(this.pos, 3); this.nor = grow(this.nor, 3); this.col = grow(this.col, 4); this.cap = cap;
  }
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, c) {
    if (SW) { let t = bx; bx = cx; cx = t; t = by; by = cy; cy = t; t = bz; bz = cz; cz = t; }
    this.ensure(3);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let i = this.n * 3, j = this.n * 4;
    const P = this.pos, N = this.nor, C = this.col;
    P[i] = ax; P[i + 1] = ay; P[i + 2] = az; P[i + 3] = bx; P[i + 4] = by; P[i + 5] = bz; P[i + 6] = cx; P[i + 7] = cy; P[i + 8] = cz;
    for (let k = 0; k < 9; k += 3) { N[i + k] = nx; N[i + k + 1] = ny; N[i + k + 2] = nz; }
    for (let k = 0; k < 12; k += 4) { C[j + k] = c[0]; C[j + k + 1] = c[1]; C[j + k + 2] = c[2]; C[j + k + 3] = c[3]; }
    this.n += 3;
  }
  // четырёхугольник a-b-c-d (обход против часовой стрелки снаружи)
  quad(a, b, c, d, col) { this.tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], col); this.tri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2], col); }
  reset() { this.n = 0; }
}

// ───────────── билдер ─────────────
export class Builder {
  constructor(w = 1, d = 1, h = 40) {
    this.w = w; this.d = d; this.h = h;
    this.lit = new Buf(); this.emi = new Buf(); this.tr = new Buf();
    this.decals = [];
    this.ox = 0; this.oy = 0; this.oz = 0; this.rot = 0; this.cr = 1; this.sr = 0;       // начало координат объекта в мире (для динамических деталей)
    this.tdx = 0; this.tdz = 0; this.stack = [];
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.globalAlpha = 1;
  }
  reset() { this.lit.reset(); this.emi.reset(); this.tr.reset(); this.decals.length = 0; this.tdx = this.tdz = 0; this.stack.length = 0; }
  // точка в мире three: учитывает смещение translate() и начало координат
  V(x, y, z) {
    if (this.rot) { const c = this.cr, s = this.sr, X = x * c - y * s; y = x * s + y * c; x = X; }
    return [x + this.ox + this.tdx / 64, hz(z + this.tdz) + this.oz, y + this.oy - this.tdx / 64];
  }
  setRot(a) { this.rot = a; this.cr = Math.cos(a); this.sr = Math.sin(a); }
  // ── совместимость с canvas: смещения и безобидные заглушки (мелкие 2D-детали переписаны вручную) ──
  save() { this.stack.push([this.tdx, this.tdz, this.globalAlpha]); }
  restore() { const s = this.stack.pop(); if (s) { this.tdx = s[0]; this.tdz = s[1]; this.globalAlpha = s[2]; } }
  translate(dx, dy) { this.tdx += dx; this.tdz -= dy; }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
}
for (const m of ['scale', 'rotate', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'fillRect', 'strokeRect', 'clip', 'fillText', 'strokeText', 'drawImage', 'setLineDash', 'setTransform', 'transform'])
  Builder.prototype[m] = function () {};

// ───────────── примитивы ─────────────
const swp = (x, y) => (SW ? [y, x] : [x, y]);
const bufOf = (c, col) => (col[3] < 0.98 ? c.tr : c.lit);
// цвет с учётом c.globalAlpha (как в canvas)
const K = (c, s) => { const k = rgba(s); return c.globalAlpha < 1 ? [k[0], k[1], k[2], k[3] * c.globalAlpha] : k; };

// Мягкая тень на земле (круг радиуса r в клетках)
export function shadow(c, cx, cy, r, a = 0.2) {
  [cx, cy] = swp(cx, cy);
  const col = [0.012, 0.007, 0.02, a * 1.5], n = 14, y = 0.012 + c.oy * 0;
  const ctr = c.V(cx, cy, 0); ctr[1] += 0.012;
  for (let i = 0; i < n; i++) {
    const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832;
    c.tr.tri(ctr[0], ctr[1], ctr[2], ctr[0] + Math.cos(a1) * r * 1.02, ctr[1], ctr[2] + Math.sin(a1) * r * 1.02, ctr[0] + Math.cos(a0) * r * 1.02, ctr[1], ctr[2] + Math.sin(a0) * r * 1.02, col);
  }
}

// Ромб на земле (в клетках)
export function diamond(c, x, y, w, d, fill, stroke, lw = 1, z = 0) {
  if (!fill) return;
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  const col = K(c, fill), b = bufOf(c, col), e = 0.004;
  b.quad(c.V(x, y + d, z), c.V(x + w, y + d, z), c.V(x + w, y, z), c.V(x, y, z), col);
  void e;
}

// Рисование в плоскости земли: функция получает обычный 2D-контекст в клетках; результат — текстурная плашка
export function plane(c, z, fn) {
  const PX = 40, pad = .3;
  const w = c.w, d = c.d;   // размеры плашки — в мировых клетках (уже с учётом поворота)
  const W = w + pad * 2, D = d + pad * 2;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(W * PX); cv.height = Math.ceil(D * PX);
  const g = cv.getContext('2d');
  if (SW) g.setTransform(0, PX, PX, 0, pad * PX, pad * PX); else g.setTransform(PX, 0, 0, PX, pad * PX, pad * PX);
  fn(g);
  c.decals.push({ cv, x0: -pad, y0: -pad, x1: w + pad, y1: d + pad, z, tdx: c.tdx, tdz: c.tdz });
}

// Параллелепипед. tex: planks | brick | stone | logs — полосы разного оттенка на боковых гранях
export function box(c, x, y, z, w, d, h, col, o = {}) {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  const side = K(c, col), top = o.top ? K(c, o.top) : side;
  const bu = bufOf(c, side), tp = bufOf(c, top);
  const V = (a, b, cc) => c.V(a, b, cc);
  const strips = o.tex === 'planks' || o.tex === 'brick' || o.tex === 'stone' ? Math.max(1, Math.round(h / (o.tex === 'planks' ? 4.5 : 5))) : 1;
  const A = o.tex ? [rgba(shade(col, .035)), rgba(shade(col, -.045))] : null;
  const cl = (i) => (A ? A[i % 2] : side);
  for (let i = 0; i < strips; i++) {
    const z0 = z + h * i / strips, z1 = z + h * (i + 1) / strips, k = cl(i);
    bu.quad(V(x, y + d, z0), V(x + w, y + d, z0), V(x + w, y + d, z1), V(x, y + d, z1), k);     // передняя левая (+y)
    bu.quad(V(x + w, y + d, z0), V(x + w, y, z0), V(x + w, y, z1), V(x + w, y + d, z1), k);     // передняя правая (+x)
    bu.quad(V(x + w, y, z0), V(x, y, z0), V(x, y, z1), V(x + w, y, z1), k);                     // задняя (-y)
    bu.quad(V(x, y, z0), V(x, y + d, z0), V(x, y + d, z1), V(x, y, z1), k);                     // задняя (-x)
  }
  if (o.tex === 'logs') {   // вертикальные брёвна: узкие тёмные пазы
    const n = Math.max(2, Math.round(w * 4)), m = Math.max(2, Math.round(d * 4)), dk = rgba(shade(col, -.2)), e = .012;
    for (let i = 1; i < n; i++) { const u = x + w * i / n; bu.quad(V(u - .015, y + d + e, z), V(u + .015, y + d + e, z), V(u + .015, y + d + e, z + h), V(u - .015, y + d + e, z + h), dk); }
    for (let i = 1; i < m; i++) { const v = y + d * i / m; bu.quad(V(x + w + e, v - .015, z), V(x + w + e, v + .015, z), V(x + w + e, v + .015, z + h), V(x + w + e, v - .015, z + h), dk); }
  }
  if (!o.notop) tp.quad(V(x, y, z + h), V(x, y + d, z + h), V(x + w, y + d, z + h), V(x + w, y, z + h), top);
}

// Прямоугольник на вертикальной грани. side 'L' (y=const, u вдоль x) или 'R' (x=const, u вдоль y)
export function wallRect(c, side, pos, u0, u1, z0, z1, fill, stroke) {
  const col = K(c, fill || stroke || '#000'), b = bufOf(c, col), t = 0.025;
  const A = side === 'L' ? [u0, pos] : [pos, u1], B = side === 'L' ? [u1, pos] : [pos, u0];
  const [ax, ay] = swp(A[0], A[1]), [bx, by] = swp(B[0], B[1]);
  const nx = Math.sign((ay - by)) * 0 + 0;     // нормаль считаем из геометрии ниже
  void nx;
  const p0 = c.V(ax, ay, z0), p1 = c.V(bx, by, z0), p2 = c.V(bx, by, z1), p3 = c.V(ax, ay, z1);
  // наружу — в сторону +x/+y (после возможного зеркалирования)
  const [ox, oy] = side === 'L' ? swp(0, t) : swp(t, 0);
  const sh = (p) => [p[0] + ox, p[1], p[2] + oy];
  const q0 = sh(p0), q1 = sh(p1), q2 = sh(p2), q3 = sh(p3);
  // обе стороны тонкой плашки, чтобы ориентация обхода не имела значения
  b.quad(q0, q1, q2, q3, col); b.quad(q3, q2, q1, q0, col);
}

// Многоугольник по точкам P(...) (с .w); двусторонний
export function poly(c, pts, fill, stroke) {
  const col = K(c, fill || stroke || '#000');
  if (!fill && !(stroke && pts.length < 3)) return;
  if (!pts.every((p) => p.w)) return;
  const b = bufOf(c, col), v = pts.map((p) => c.V(p.w[0], p.w[1], p.w[2]));
  for (let i = 1; i < v.length - 1; i++) {
    b.tri(v[0][0], v[0][1], v[0][2], v[i][0], v[i][1], v[i][2], v[i + 1][0], v[i + 1][1], v[i + 1][2], col);
    b.tri(v[0][0], v[0][1], v[0][2], v[i + 1][0], v[i + 1][1], v[i + 1][2], v[i][0], v[i][1], v[i][2], col);
  }
}

// Двускатная крыша. axis 'x' | 'y' — направление конька
export function gable(c, x, y, z, w, d, h, o, col, wallCol, axis = 'x') {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; axis = axis === 'x' ? 'y' : 'x'; }
  const roof = K(c, col), wl = wallCol ? K(c, wallCol) : roof, b = c.lit, V = (a, bb, cc) => c.V(a, bb, cc), zt = z + h;
  if (axis === 'x') {
    const my = y + d / 2;
    b.quad(V(x - o, y + d + o, z), V(x + w + o, y + d + o, z), V(x + w + o, my, zt), V(x - o, my, zt), roof);
    b.quad(V(x + w + o, y - o, z), V(x - o, y - o, z), V(x - o, my, zt), V(x + w + o, my, zt), roof);
    b.tri(...V(x + w, y + d, z), ...V(x + w, y, z), ...V(x + w, my, zt), wl);
    b.tri(...V(x, y, z), ...V(x, y + d, z), ...V(x, my, zt), wl);
  } else {
    const mx = x + w / 2;
    b.quad(V(x + w + o, y + d + o, z), V(x + w + o, y - o, z), V(mx, y - o, zt), V(mx, y + d + o, zt), roof);
    b.quad(V(x - o, y - o, z), V(x - o, y + d + o, z), V(mx, y + d + o, zt), V(mx, y - o, zt), roof);
    b.tri(...V(x, y + d, z), ...V(x + w, y + d, z), ...V(mx, y + d, zt), wl);
    b.tri(...V(x + w, y, z), ...V(x, y, z), ...V(mx, y, zt), wl);
  }
}
// Пирамидальная крыша
export function pyramid(c, x, y, z, w, d, h, o, col) {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  const k = K(c, col), b = c.lit, V = (a, bb, cc) => c.V(a, bb, cc), ap = V(x + w / 2, y + d / 2, z + h);
  const a = V(x - o, y - o, z), bb = V(x + w + o, y - o, z), cc = V(x + w + o, y + d + o, z), dd = V(x - o, y + d + o, z);
  b.tri(...a, ...ap, ...bb, k); b.tri(...bb, ...ap, ...cc, k); b.tri(...cc, ...ap, ...dd, k); b.tri(...dd, ...ap, ...a, k);
}
// Односкатная крыша: высокая сторона у y (задняя)
export function lean(c, x, y, z, w, d, h0, h1, o, col) {
  if (SW) { [x, y] = [y, x]; [w, d] = [d, w]; }
  const k = K(c, col), kd = K(c, shade(col, -.2)), b = c.lit, V = (a, bb, cc) => c.V(a, bb, cc), t = 2;
  const x0 = x - o, x1 = x + w + o, y0 = y - o, y1 = y + d + o;
  b.quad(V(x0, y1, z + h0), V(x1, y1, z + h0), V(x1, y0, z + h1), V(x0, y0, z + h1), k);
  b.quad(V(x1, y1, z + h0), V(x1, y0, z + h1), V(x1, y0, z + h1 - t), V(x1, y1, z + h0 - t), kd);
  b.quad(V(x0, y1, z + h0 - t), V(x1, y1, z + h0 - t), V(x1, y1, z + h0), V(x0, y1, z + h0), kd);
  b.quad(V(x1, y0, z + h1 - t), V(x0, y0, z + h1 - t), V(x0, y0, z + h1), V(x1, y0, z + h1), kd);
  b.quad(V(x0, y0, z + h1 - t), V(x0, y1, z + h0 - t), V(x0, y1, z + h0), V(x0, y0, z + h1), kd);
}

// Цилиндр (r — в клетках)
export function cyl(c, cx, cy, z, r, h, col, o = {}) {
  [cx, cy] = swp(cx, cy);
  const side = K(c, col), top = o.top ? K(c, o.top) : side, n = r > 0.2 ? 14 : 10, b = bufOf(c, side);
  const ctr = c.V(cx, cy, z), tz = hz(h);
  const ring = (rr, y0, hh, k) => {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, x0 = Math.cos(a0) * rr, z0 = Math.sin(a0) * rr, x1 = Math.cos(a1) * rr, z1 = Math.sin(a1) * rr;
      const p0 = [ctr[0] + x0, y0, ctr[2] + z0], p1 = [ctr[0] + x1, y0, ctr[2] + z1];
      b.quad(p1, p0, [p0[0], y0 + hh, p0[2]], [p1[0], y0 + hh, p1[2]], k);
    }
  };
  ring(r, ctr[1], tz, side);
  if (!o.notop) { const t = bufOf(c, top), cy2 = ctr[1] + tz; for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832; t.tri(ctr[0], cy2, ctr[2], ctr[0] + Math.cos(a1) * r, cy2, ctr[2] + Math.sin(a1) * r, ctr[0] + Math.cos(a0) * r, cy2, ctr[2] + Math.sin(a0) * r, top); } }
  if (o.rings) { const rk = rgba(o.ringCol || shade(col, -.35)); for (const t of o.rings) ring(r * 1.035, ctr[1] + tz * t - hz(.7), hz(1.4), rk); }
}
// Конус (палатки, ёлки)
export function cone(c, cx, cy, z, r, h, col) {
  [cx, cy] = swp(cx, cy);
  const k = K(c, col), n = r > 0.2 ? 12 : 8, b = bufOf(c, k), ctr = c.V(cx, cy, z), tip = [ctr[0], ctr[1] + hz(h), ctr[2]];
  for (let i = 0; i < n; i++) {
    const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832;
    b.tri(ctr[0] + Math.cos(a1) * r, ctr[1], ctr[2] + Math.sin(a1) * r, ctr[0] + Math.cos(a0) * r, ctr[1], ctr[2] + Math.sin(a0) * r, tip[0], tip[1], tip[2], k);
  }
}

// Эллипсоид («шар»/куст): rx, ry — радиусы в пикселях исходной графики; z — высота центра
const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((p) => { const l = Math.hypot(...p); return p.map((q) => q / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const sub = (lvl) => {
    for (let l = 0; l < lvl; l++) {
      const nf = [], cache = {};
      const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache[k] !== undefined) return cache[k]; const p = v[a].map((q, i) => (q + v[b][i]) / 2), ln = Math.hypot(...p); v.push(p.map((q) => q / ln)); return (cache[k] = v.length - 1); };
      for (const [a, b, c] of f) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      f = nf;
    }
  };
  sub(1);
  return { v, f };
})();
export function blob(c, cx, cy, z, rx, ry, col, o = {}) {
  [cx, cy] = swp(cx, cy);
  const k = K(c, col), b = bufOf(c, k), ctr = c.V(cx, cy, z), R = rx / KX, Ry = R * (ry / rx) * 1.15, { v, f } = ICO;
  const p = (i) => [ctr[0] + v[i][0] * R, ctr[1] + v[i][1] * Ry, ctr[2] + v[i][2] * R];
  for (const [a, bb, cc] of f) { const A = p(a), B = p(bb), C = p(cc); b.tri(...A, ...B, ...C, k); }
}
export function ball(c, cx, cy, z, r, col) { blob(c, cx, cy, z, r, r, col); }

// Стержень между двумя точками (lw — толщина в пикселях)
export function line3(c, a, b, col, lw = 1.5) {
  const [ax, ay] = swp(a[0], a[1]), [bx, by] = swp(b[0], b[1]);
  const p = c.V(ax, ay, a[2] || 0), q = c.V(bx, by, b[2] || 0), k = K(c, col), buf = bufOf(c, k);
  const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], len = Math.hypot(dx, dy, dz) || 1e-6;
  const r = Math.max(0.012, lw / KX / 2);
  // перпендикуляры: берём мировую вертикаль, если стержень не вертикален
  let ux = 0, uy = 1, uz = 0;
  if (Math.abs(dy) / len > 0.95) { ux = 1; uy = 0; }
  let sx = dy * uz - dz * uy, sy = dz * ux - dx * uz, sz = dx * uy - dy * ux; let l = Math.hypot(sx, sy, sz) || 1; sx = sx / l * r; sy = sy / l * r; sz = sz / l * r;
  let tx = dy * sz - dz * sy, ty = dz * sx - dx * sz, tz = dx * sy - dy * sx; l = Math.hypot(tx, ty, tz) || 1; tx = tx / l * r; ty = ty / l * r; tz = tz / l * r;
  const c4 = [[sx + tx, sy + ty, sz + tz], [-sx + tx, -sy + ty, -sz + tz], [-sx - tx, -sy - ty, -sz - tz], [sx - tx, sy - ty, sz - tz]];
  const A = c4.map((o) => [p[0] + o[0], p[1] + o[1], p[2] + o[2]]), B = c4.map((o) => [q[0] + o[0], q[1] + o[1], q[2] + o[2]]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; buf.quad(A[i], A[j], B[j], B[i], k); }
}

// Пламя: светящиеся конусы (не зависят от освещения)
export function flame(c, cx, cy, z, size, t, seed = 0) {
  [cx, cy] = swp(cx, cy);
  const w = size * (0.9 + 0.1 * Math.sin(t * 9 + seed)), hh = size * 1.7 * (0.9 + 0.12 * Math.sin(t * 7 + seed * 2)), sway = Math.sin(t * 5 + seed) * size * 0.12;
  const ctr = c.V(cx, cy, z);
  [['#ff8a2a', 1], ['#ffc83a', .68], ['#fff2a8', .36]].forEach(([col, s]) => {
    const k = rgba(col), R = w * s / KX * .95, H = hz(hh * s), n = 8, tip = [ctr[0] + sway * s / KX, ctr[1] + H, ctr[2]];
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832;
      c.emi.tri(ctr[0] + Math.cos(a1) * R, ctr[1], ctr[2] + Math.sin(a1) * R, ctr[0] + Math.cos(a0) * R, ctr[1], ctr[2] + Math.sin(a0) * R, tip[0], tip[1], tip[2], k);
    }
  });
}

// Лента по кривой Безье (провисшая ткань, гирлянда): p0, pc, p1 — мировые точки [x, y, z px]; halfW — полуширина вдоль y (в клетках)
export function ribbon(c, p0, pc, p1, halfW, col, n = 8) {
  const k = K(c, col), b = bufOf(c, k);
  const pt = (t, dy) => {
    const u = 1 - t, x = u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0], y = u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1], z = u * u * p0[2] + 2 * u * t * pc[2] + t * t * p1[2];
    const [a, bb] = swp(x, y + dy); return c.V(a, bb, z);
  };
  for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; b.quad(pt(t0, -halfW), pt(t1, -halfW), pt(t1, halfW), pt(t0, halfW), k); }
}
// Тонкая линия по кривой Безье из стержней
export function curve3(c, p0, pc, p1, col, lw = 1.5, n = 8) {
  let prev = p0;
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t, q = [u * u * p0[0] + 2 * u * t * pc[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * pc[1] + t * t * p1[1], u * u * p0[2] + 2 * u * t * pc[2] + t * t * p1[2]];
    line3(c, prev, q, col, lw); prev = q;
  }
}
// Светящееся пятно (огонёк, лампочка): эмиссивный шарик без освещения
export function glow(c, cx, cy, z, r, col) {
  [cx, cy] = swp(cx, cy);
  const k = K(c, col), ctr = c.V(cx, cy, z), R = r / KX, { v, f } = ICO, p = (i) => [ctr[0] + v[i][0] * R, ctr[1] + v[i][1] * R, ctr[2] + v[i][2] * R];
  for (const [a, bb, cc] of f) { const A = p(a), B = p(bb), C = p(cc); (k[3] < .98 ? c.tr : c.emi).tri(...A, ...B, ...C, k); }
}
