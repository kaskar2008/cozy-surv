// Фон главного экрана: процедурный параллакс-пейзаж. Каждый заход — новый мир:
// время суток, остров, деревья, домик, костёр. Камера медленно плывёт влево и вправо, слои сдвигаются с разной скоростью.
import { mulberry32, mix, shade, rgba, clamp, fbm } from '../core/util.js';

const MOODS = {
  day: { w: 4, night: 0, glow: 0, sky: ['#5fb8e8', '#a9dcf0', '#fdf1cf'], sun: '#fff4c2', sunXY: [0.74, 0.2], mtn: ['#a8c8dc', '#86b3ae'], sea: ['#6ac7d8', '#2f8fae'], haze: '#eaf6f2', grass: ['#a6d86c', '#6aad52'], leaf: ['#5fa84a', '#4a9142', '#85c65e'], cloud: ['#ffffff', '#cfe4f2'], fg: '#2f5a3a', smoke: '#f4f4f0' },
  dawn: { w: 2, night: 0, glow: 0.3, sky: ['#86a9e6', '#f2bfd0', '#ffe3b0'], sun: '#fff0c8', sunXY: [0.3, 0.5], mtn: ['#b8b6de', '#9aa9c8'], sea: ['#a0c6de', '#5c86ac'], haze: '#ffe9d6', grass: ['#bde07e', '#80b45c'], leaf: ['#6fb25a', '#58a050', '#8ccb6a'], cloud: ['#fff0ea', '#e2b5c8'], fg: '#38503f', smoke: '#fff2ea' },
  sunset: { w: 3, night: 0, glow: 0.65, sky: ['#4f5aa8', '#e98a86', '#ffd391'], sun: '#ffe2a0', sunXY: [0.7, 0.5], mtn: ['#8f74ac', '#6b5f9a'], sea: ['#ea9482', '#4c4f93'], haze: '#ffd2a0', grass: ['#cdc86c', '#8aa24a'], leaf: ['#7d9a3e', '#6a8a3a', '#a8aa48'], cloud: ['#ffd9b8', '#c77f9a'], fg: '#2d2a4a', smoke: '#ffe4cc' },
  night: { w: 2, night: 1, glow: 1, sky: ['#0d1233', '#232a63', '#4c4f8e'], sun: '#f4f1d8', sunXY: [0.72, 0.2], mtn: ['#2e3870', '#252d5e'], sea: ['#27407a', '#0e1a45'], haze: '#5a5c9c', grass: ['#4d7a5a', '#355c4a'], leaf: ['#33665a', '#2a5550', '#3f7a62'], cloud: ['#4a5190', '#2a2f66'], fg: '#0c1230', smoke: '#9aa0cc' },
};
const ROOFS = ['#c8604a', '#6f93c0', '#a8604c', '#5f8f5f', '#d08a4a'];
const WALLS = ['#f3dcb0', '#ead0a6', '#dcbc8c', '#f0e4c8'];
const FLOWERS = ['#ffb3c7', '#fff2a8', '#ffffff', '#d6b8ff', '#ffc98a'];
const TAU = Math.PI * 2;

let cv, ctx, W = 0, H = 0, dpr = 1, AMP = 120, HZ = 0;
let raf = 0, running = false, motion = true, T = 0, last = 0, phase = 0, camX = 0;
let seed = 1, P = null, layers = [], clouds = [], stars = [], flies = [], birds = [], smoke = [], emit = [], fires = [], lamps = [], boat = null, shimmer = [];

const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const tri = (c, ax, ay, bx, by, cx, cy) => { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx, cy); c.closePath(); c.fill(); };
const tint = (col, haze, k) => mix(col, haze, k);

// ───────── деревья и постройки (рисуются один раз в слой) ─────────
function roundTree(c, x, y, s, L) {
  const tw = s * 0.09; c.fillStyle = L.trunk; c.fillRect(x - tw / 2, y - s * 0.4, tw, s * 0.4);
  const cr = s * 0.34, cy = y - s * 0.64, puff = [[0, 0, 1], [-0.62, 0.22, 0.74], [0.62, 0.24, 0.72], [-0.2, -0.5, 0.7], [0.34, -0.38, 0.62]];
  c.fillStyle = shade(L.leaf[1], -0.14); for (const [px, py, pr] of puff) circ(c, x + px * cr, cy + py * cr, pr * cr);
  c.fillStyle = L.leaf[0]; for (const [px, py, pr] of puff) circ(c, x + px * cr - cr * 0.1, cy + py * cr - cr * 0.14, pr * cr * 0.84);
  c.fillStyle = L.leaf[2]; for (const [px, py, pr] of puff.slice(2, 5)) circ(c, x + px * cr - cr * 0.22, cy + py * cr - cr * 0.3, pr * cr * 0.4);
}
function pineTree(c, x, y, s, L, r) {
  const tw = s * 0.07; c.fillStyle = L.trunk; c.fillRect(x - tw / 2, y - s * 0.2, tw, s * 0.2);
  const n = 3 + (r() * 2 | 0);
  for (let i = 0; i < n; i++) {
    const w = s * (0.34 - i * 0.05), top = y - s * (0.24 + i * 0.19), bot = top + s * 0.34;
    c.fillStyle = shade(L.leaf[1], -0.1); tri(c, x, top - s * 0.14, x - w, bot, x + w, bot);
    c.fillStyle = L.leaf[0]; tri(c, x, top - s * 0.14, x + w, bot, x + w * 0.05, bot);
  }
}
function palmTree(c, x, y, s, L, r) {
  const lean = (r() - 0.5) * s * 0.55, tx = x + lean, ty = y - s;
  c.strokeStyle = L.trunk; c.lineCap = 'round'; c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * 0.15, y - s * 0.55, tx, ty); c.stroke();
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i + 0.5) * Math.PI / n, len = s * (0.46 + r() * 0.12), ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.55 + len * 0.28;
    c.fillStyle = i % 2 ? L.leaf[0] : L.leaf[1];
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * len * 0.55, ty + Math.sin(a) * len * 0.8 - len * 0.18, ex, ey);
    c.quadraticCurveTo(tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.5 + len * 0.08, tx, ty); c.fill();
  }
  c.fillStyle = '#7a5236'; circ(c, tx - 2, ty + 3, s * 0.035); circ(c, tx + 3, ty + 4, s * 0.035);
}
function treeAt(c, kind, x, y, s, L, r) { (kind === 0 ? roundTree : kind === 1 ? pineTree : palmTree)(c, x, y, s, L, r); }

function house(c, x, y, s, lit, r) {
  const w = s * 1.15, h = s * 0.62, rh = s * 0.5, wall = WALLS[r() * WALLS.length | 0], roof = ROOFS[r() * ROOFS.length | 0];
  c.fillStyle = '#a07860'; c.fillRect(x + w * 0.18, y - h - rh * 0.78, w * 0.13, rh * 0.6);
  c.fillStyle = wall; c.fillRect(x - w / 2, y - h, w, h);
  c.fillStyle = 'rgba(70,40,20,.2)'; c.fillRect(x + w * 0.16, y - h, w * 0.34, h);
  c.fillStyle = '#8a6a4e'; c.fillRect(x - w / 2 - 2, y - 3, w + 4, 4);
  c.fillStyle = roof; tri(c, x - w * 0.64, y - h + 2, x, y - h - rh, x + w * 0.64, y - h + 2);
  c.fillStyle = 'rgba(40,10,10,.2)'; tri(c, x, y - h - rh, x + w * 0.64, y - h + 2, x, y - h + 2);
  c.fillStyle = '#6a4630'; c.beginPath(); c.roundRect(x - w * 0.3, y - h * 0.66, w * 0.2, h * 0.66, [5, 5, 0, 0]); c.fill();
  const wx = x + w * 0.08, wy = y - h * 0.82, ws = w * 0.24;
  c.fillStyle = lit ? '#ffd27a' : '#bcd9e6'; c.fillRect(wx, wy, ws, ws);
  c.strokeStyle = '#6b4a30'; c.lineWidth = 2; c.strokeRect(wx, wy, ws, ws); c.beginPath(); c.moveTo(wx + ws / 2, wy); c.lineTo(wx + ws / 2, wy + ws); c.moveTo(wx, wy + ws / 2); c.lineTo(wx + ws, wy + ws / 2); c.stroke();
  return { chim: [x + w * 0.245, y - h - rh * 0.8], win: lit ? [wx + ws / 2, wy + ws / 2, ws] : null };
}
function tent(c, x, y, s, r) {
  const col = ['#e8a85a', '#d9705a', '#7aa8c8', '#9bbf6a'][r() * 4 | 0];
  c.fillStyle = col; tri(c, x - s * 0.62, y, x, y - s * 0.84, x + s * 0.62, y);
  c.fillStyle = 'rgba(40,10,10,.2)'; tri(c, x, y - s * 0.84, x + s * 0.62, y, x + s * 0.05, y);
  c.fillStyle = '#4a3226'; tri(c, x - s * 0.15, y, x, y - s * 0.46, x + s * 0.15, y);
  c.strokeStyle = '#6a4630'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - s * 0.84); c.lineTo(x, y - s * 1.08); c.stroke();
  c.fillStyle = '#e65a4a'; tri(c, x, y - s * 1.08, x + s * 0.2, y - s * 1.0, x, y - s * 0.92);
}
function rock(c, x, y, s, col) { c.fillStyle = shade(col, -0.18); c.beginPath(); c.ellipse(x, y, s, s * 0.6, 0, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.ellipse(x - s * 0.15, y - s * 0.15, s * 0.8, s * 0.45, 0, 0, TAU); c.fill(); }
function campfire(c, x, y, s) {
  c.fillStyle = '#8c8a86'; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; circ(c, x + Math.cos(a) * s * 0.34, y - 2 + Math.sin(a) * s * 0.1, s * 0.09); }
  c.strokeStyle = '#6a4630'; c.lineWidth = s * 0.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s * 0.25, y - 3); c.lineTo(x + s * 0.25, y - s * 0.12); c.moveTo(x + s * 0.25, y - 3); c.lineTo(x - s * 0.25, y - s * 0.12); c.stroke();
}
function lampPost(c, x, y, s) {
  c.fillStyle = '#4a3a30'; c.fillRect(x - 1.5, y - s * 1.3, 3, s * 1.3); c.fillRect(x - 5, y - s * 1.3, 10, 3);
  c.fillStyle = '#ffe6a0'; c.beginPath(); c.roundRect(x - 4, y - s * 1.3 - 10, 8, 10, 3); c.fill();
}

// ───────── слои ─────────
function mkLayer(f, y0, y1, drawFn) {
  const lw = Math.ceil(W + 2 * AMP * f), lh = Math.ceil(y1 - y0), cvs = document.createElement('canvas');
  cvs.width = Math.ceil(lw * dpr); cvs.height = Math.ceil(lh * dpr);
  const c = cvs.getContext('2d'); c.scale(dpr, dpr); c.translate(0, -y0); drawFn(c, f * AMP, lw);
  return { cv: cvs, f, y0, lw, lh };
}
const blit = (L) => ctx.drawImage(L.cv, -L.f * (AMP + camX), L.y0, L.lw, L.lh);

function ridge(c, lw, base, amp, sc, sd, top, bot) {
  const g = c.createLinearGradient(0, base - amp, 0, base); g.addColorStop(0, top); g.addColorStop(1, bot);
  c.fillStyle = g; c.beginPath(); c.moveTo(0, base + 2);
  for (let x = 0; x <= lw + 8; x += 6) c.lineTo(x, base - (fbm(x / sc, 0.5, sd, 5) * 1.25 - 0.12) * amp);
  c.lineTo(lw, base + 2); c.closePath(); c.fill();
}

function build() {
  const r = mulberry32(seed), mood = pickMood(r), L = { ...mood };
  P = L; L.trunk = '#8a6a4a'; layers = []; clouds = []; stars = []; flies = []; birds = []; smoke = []; emit = []; fires = []; lamps = []; shimmer = [];
  const portrait = H > W * 1.05;
  HZ = Math.round(H * (portrait ? 0.41 : 0.57));
  const waterY = Math.round(H * (portrait ? 0.6 : 0.8)), U = portrait ? H * 0.78 : H;   // U — единица размера построек и деревьев

  // горы
  layers.push(mkLayer(0.1, HZ - H * 0.42, HZ + 2, (c, ox, lw) => ridge(c, lw, HZ, H * 0.34, 260 + r() * 120, seed % 997, tint(L.mtn[0], L.haze, 0.55), tint(L.mtn[0], L.haze, 0.8))));
  layers.push(mkLayer(0.2, HZ - H * 0.34, HZ + 2, (c, ox, lw) => ridge(c, lw, HZ, H * 0.26, 200 + r() * 90, seed % 991 + 40, tint(L.mtn[1], L.haze, 0.25), tint(L.mtn[1], L.haze, 0.6))));

  // дальний берег и острова (стоят на воде)
  const far = mkLayer(0.32, HZ - H * 0.13, HZ + H * 0.05, (c, ox, lw) => {
    const hz = HZ + H * 0.012, top = tint(L.grass[1], L.haze, 0.42), tl = { trunk: tint(L.trunk, L.haze, 0.5), leaf: L.leaf.map((q) => tint(q, L.haze, 0.45)) };
    c.fillStyle = top; c.beginPath(); c.moveTo(0, hz);
    for (let x = 0; x <= lw; x += 5) c.lineTo(x, hz - Math.max(0, fbm(x / 170, 3, seed % 313, 4) - 0.38) * H * 0.34);
    c.lineTo(lw, hz); c.closePath(); c.fill();
    for (let x = 14; x < lw; x += 9 + r() * 16) { const hh = Math.max(0, fbm(x / 170, 3, seed % 313, 4) - 0.38) * H * 0.34; if (hh > 4) pineTree(c, x, hz - hh * 0.6 + 4, H * (0.035 + r() * 0.03), tl, r); }
  });
  layers.push(far);
  const isl = mkLayer(0.42, HZ + H * 0.02, HZ + H * 0.1, (c, ox, lw) => {
    const tl = { trunk: tint(L.trunk, L.haze, 0.35), leaf: L.leaf.map((q) => tint(q, L.haze, 0.3)) };
    for (let i = 0; i < 2 + (r() * 2 | 0); i++) {
      const x = ox + W * (0.08 + r() * 0.84), y = HZ + H * (0.06 + r() * 0.03), w = H * (0.07 + r() * 0.07);
      c.fillStyle = tint(L.grass[1], L.haze, 0.3); c.beginPath(); c.ellipse(x, y, w, w * 0.2, 0, Math.PI, TAU); c.fill();
      c.fillStyle = tint('#e8d4a0', L.haze, 0.3); c.fillRect(x - w, y - 1, w * 2, 3);
      treeAt(c, r() < 0.5 ? 2 : 0, x + (r() - 0.5) * w, y, H * 0.07, tl, r);
    }
  });
  layers.push(isl);

  // главный остров
  const iw = clamp(Math.min(W * (portrait ? 1.1 : 0.62), H * 1.1), 300, 900), mound = H * (portrait ? 0.12 : 0.19), cx0 = W * (portrait ? 0.5 : 0.66);
  const island = mkLayer(0.72, waterY - mound * 1.9, waterY + 40, (c, ox, lw) => {
    const x0 = cx0 + ox, topY = (x) => { const t = (x - x0) / (iw / 2); if (Math.abs(t) >= 1) return waterY; return waterY - (Math.pow(Math.cos(t * Math.PI / 2), 0.75) * mound * (0.92 + fbm(x / 90, 2, seed % 211, 3) * 0.18)); };
    // тень на воде
    const sg = c.createRadialGradient(x0, waterY + 6, 4, x0, waterY + 6, iw * 0.62); sg.addColorStop(0, 'rgba(10,20,50,.3)'); sg.addColorStop(1, 'rgba(10,20,50,0)');
    c.fillStyle = sg; c.save(); c.translate(0, waterY + 6); c.scale(1, 0.12); c.translate(0, -(waterY + 6)); circ(c, x0, waterY + 6, iw * 0.62); c.restore();
    // тело
    const body = new Path2D(); body.moveTo(x0 - iw / 2, waterY);
    for (let x = x0 - iw / 2; x <= x0 + iw / 2; x += 4) body.lineTo(x, topY(x));
    body.lineTo(x0 + iw / 2, waterY); body.closePath();
    c.save(); c.clip(body);
    const g = c.createLinearGradient(0, waterY - mound, 0, waterY); g.addColorStop(0, L.grass[0]); g.addColorStop(1, L.grass[1]); c.fillStyle = g; c.fillRect(x0 - iw / 2, waterY - mound * 1.3, iw, mound * 1.4);
    c.fillStyle = 'rgba(255,250,200,.16)'; c.beginPath(); c.ellipse(x0 - iw * 0.12, waterY - mound * 0.95, iw * 0.3, mound * 0.18, -0.08, 0, TAU); c.fill();
    const sand = tint('#e8d29a', L.haze, 0.1), sg2 = c.createLinearGradient(0, waterY - mound * 0.22, 0, waterY); sg2.addColorStop(0, sand); sg2.addColorStop(1, shade(sand, -0.2));
    c.fillStyle = sg2; c.beginPath(); c.moveTo(x0 - iw / 2, waterY);
    for (let x = x0 - iw / 2; x <= x0 + iw / 2; x += 6) c.lineTo(x, waterY - mound * (0.1 + fbm(x / 40, 5, seed % 137, 2) * 0.12)); c.lineTo(x0 + iw / 2, waterY); c.fill();
    c.restore();
    // пена у берега
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2.5; c.beginPath();
    for (let x = x0 - iw / 2 - 14; x <= x0 + iw / 2 + 14; x += 5) c[x === x0 - iw / 2 - 14 ? 'moveTo' : 'lineTo'](x, waterY + 2 + Math.sin(x * 0.07) * 1.6); c.stroke();
    // камни
    for (let i = 0; i < 4; i++) rock(c, x0 + (r() - 0.5) * iw * 0.92, waterY + 1, 5 + r() * 9, '#b4b0a8');
    // пирс
    const dir = r() < 0.5 ? -1 : 1, px = x0 + dir * iw * 0.46, pl = W * 0.1;
    c.fillStyle = '#9a7650'; for (let i = 0; i < 4; i++) c.fillRect(px + dir * (pl * (i + 0.5) / 4) - 2.5, waterY - 2, 5, 22);
    c.fillStyle = '#c29a68'; c.fillRect(Math.min(px, px + dir * pl), waterY - 3, pl, 5);
    if (L.night || L.glow > 0.5) lamps.push([px + dir * pl, waterY - 3 - 28]), lampPost(c, px + dir * pl, waterY - 3, 22);
    // предметы на острове: по глубине (дальше — выше и меньше)
    const taken = [], free = (t, hw) => taken.every(([a, b]) => Math.abs(a - t) > b + hw), put = (t, hw) => taken.push([t, hw]);
    const items = [], at = (t, d) => { const x = x0 + t * iw / 2, y = topY(x) + d * mound * 0.16; return [x, y, 0.82 + d * 0.34]; };
    const ht = (r() - 0.5) * 0.6, [hx, hy, hs] = at(ht, 0.35); put(ht, 0.2);
    items.push({ d: 0.35, f: () => { const o = house(c, hx, hy, U * 0.105 * hs, L.glow > 0.2, r); emit.push([o.chim[0], o.chim[1], 0.7]); if (o.win) lamps.push([o.win[0], o.win[1], o.win[2]]); } });
    for (let tries = 0; tries < 20; tries++) { const ft = ht + (r() < 0.5 ? -1 : 1) * (0.28 + r() * 0.16); if (Math.abs(ft) < 0.7 && free(ft, 0.1)) { const [fx, fy, fs] = at(ft, 0.7); put(ft, 0.1); items.push({ d: 0.7, f: () => campfire(c, fx, fy, U * 0.07 * fs) }); fires.push([fx, fy - 2, U * 0.07 * fs]); emit.push([fx, fy - U * 0.045, 1]); break; } }
    for (let tries = 0; tries < 20; tries++) { const tt = (r() - 0.5) * 1.5; if (free(tt, 0.12)) { const [tx, ty, ts] = at(tt, 0.15); put(tt, 0.12); items.push({ d: 0.15, f: () => tent(c, tx, ty, U * 0.075 * ts, r) }); break; } }
    const nT = 6 + (r() * 4 | 0), kinds = r() < 0.5 ? [0, 0, 1, 2] : [1, 1, 0, 2];
    for (let i = 0, n = 0; i < 60 && n < nT; i++) {
      const tt = (r() - 0.5) * 1.62, d = r(); if (!free(tt, 0.045)) continue;
      const [tx, ty, ts] = at(tt, d * 0.9); put(tt, 0.045); n++;
      const kind = kinds[r() * kinds.length | 0], sz = U * (0.09 + r() * 0.07) * ts, sd = r();
      items.push({ d, f: () => treeAt(c, kind, tx, ty, sz, L, () => sd) });
    }
    for (let i = 0; i < 14; i++) { const [fx0, fy0] = at((r() - 0.5) * 1.5, r() * 0.9), col = FLOWERS[r() * FLOWERS.length | 0]; items.push({ d: 1.5, f: () => { c.fillStyle = col; circ(c, fx0, fy0 + 3, 2.2); } }); }
    items.sort((a, b) => a.d - b.d); for (const it of items) it.f();
  });
  layers.push(island);

  // передний план
  const fg = mkLayer(1.35, H * 0.7, H, (c, ox, lw) => {
    const dark = L.fg, mid = shade(L.fg, 0.14), hi = tint(L.leaf[1], L.fg, 0.45);
    const clump = (u0, u1, hgt) => {
      const top = (x) => { const t = (x - u0) / (u1 - u0); return H - hgt * Math.pow(Math.sin(clamp(t, 0, 1) * Math.PI), 0.7) * (0.8 + fbm(x / 60, 7, seed % 71, 3) * 0.5); };
      c.fillStyle = dark; c.beginPath(); c.moveTo(u0, H + 2);
      for (let x = u0; x <= u1; x += 4) c.lineTo(x, top(x)); c.lineTo(u1, H + 2); c.fill();
      for (let x = u0; x <= u1; x += 3 + r() * 5) {
        const y = top(x) + 3, h = 14 + r() * 40 * (H / 900), lean = (r() - 0.5) * 18, w = 2.2 + r() * 2.4;
        c.fillStyle = r() < 0.5 ? mid : hi; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); c.quadraticCurveTo(x + lean * 0.5 + w, y - h * 0.5, x + w, y); c.fill();
        if (r() < 0.07) { const fy = y - h; c.fillStyle = FLOWERS[r() * FLOWERS.length | 0]; for (let k = 0; k < 5; k++) circ(c, x + lean + Math.cos(k * 1.256) * 3.2, fy + Math.sin(k * 1.256) * 3.2, 2.1); c.fillStyle = '#ffd24a'; circ(c, x + lean, fy, 1.8); }
      }
    };
    clump(ox - W * 0.12, ox + W * 0.3, H * 0.12); clump(ox + W * 0.74, ox + W * 1.12, H * 0.1);
    for (const u of [ox + W * 0.06, ox + W * 0.95]) { // камыши
      for (let i = 0; i < 4; i++) { const x = u + (r() - 0.5) * 60, h = H * (0.1 + r() * 0.08), lean = (r() - 0.5) * 16; c.strokeStyle = mid; c.lineWidth = 2; c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + lean * 0.2, H - h * 0.5, x + lean, H - h); c.stroke(); c.fillStyle = '#6b4a30'; c.beginPath(); c.ellipse(x + lean, H - h - 6, 3.4, 9, lean * 0.02, 0, TAU); c.fill(); }
    }
  });
  layers.push(fg);

  // живое: облака, звёзды, светлячки, птицы, блики на воде, парусник
  const cloudSprite = () => {
    const w = 260, h = 90, c = document.createElement('canvas'); c.width = w * 1; c.height = h; const g = c.getContext('2d');
    const puffs = []; for (let i = 0; i < 7; i++) puffs.push([40 + i * 28 + r() * 10, 56 - Math.sin(i / 6 * Math.PI) * (14 + r() * 14), 18 + Math.sin(i / 6 * Math.PI) * 16 + r() * 8]);
    g.fillStyle = L.cloud[1]; for (const [x, y, rr] of puffs) circ(g, x, y + 6, rr); g.fillStyle = L.cloud[0]; for (const [x, y, rr] of puffs) circ(g, x, y - 2, rr * 0.9);
    return c;
  };
  const sprites = [cloudSprite(), cloudSprite(), cloudSprite()];
  const nC = portrait ? 5 : 8;
  for (let i = 0; i < nC; i++) { const f = 0.05 + r() * 0.2; clouds.push({ s: sprites[i % 3], f, x: r() * (W + 600), y: H * (0.04 + r() * 0.3) * (1.1 - f), sc: 0.7 + f * 2.2 * r() + 0.3, v: 4 + f * 30, a: L.night ? 0.55 : 0.92 }); }
  if (L.night) for (let i = 0; i < 130; i++) stars.push({ x: r() * W, y: r() * HZ * 0.95, r: 0.5 + r() * 1.3, p: r() * TAU, s: 0.6 + r() * 1.6 });
  const nF = L.night ? 34 : L.glow > 0.5 ? 18 : 0;
  for (let i = 0; i < nF; i++) flies.push({ x: r() * (W + 2 * AMP * 1.1), y: H * (0.55 + r() * 0.42), p: r() * TAU, s: 0.4 + r() * 0.8, kind: 0 });
  if (!L.night) for (let i = 0; i < 16; i++) flies.push({ x: r() * (W + 2 * AMP * 1.1), y: H * (0.5 + r() * 0.5), p: r() * TAU, s: 0.3 + r() * 0.5, kind: 1 });
  if (!L.night) for (let i = 0; i < 4; i++) birds.push({ x: r() * W, y: H * (0.12 + r() * 0.22), v: 10 + r() * 8, p: r() * TAU, sc: 0.7 + r() * 0.7 });
  for (let i = 0; i < 70; i++) { const dy = Math.pow(r(), 1.4); shimmer.push({ x: r() * (W + 2 * AMP * 0.45), y: HZ + 4 + dy * (H - HZ) * 0.7, w: 8 + dy * 38 + r() * 12, p: r() * TAU, s: 0.8 + r() * 1.6 }); }
  boat = { u: portrait ? 0.2 : 0.26, y: HZ + H * 0.075, sc: H * 0.055 };
}

function pickMood(r) {
  const k = Object.keys(MOODS), tot = k.reduce((a, n) => a + MOODS[n].w, 0); let v = r() * tot;
  for (const n of k) { v -= MOODS[n].w; if (v <= 0) return MOODS[n]; }
  return MOODS.day;
}

// ───────── кадр ─────────
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, P.sky[0]); g.addColorStop(0.55, P.sky[1]); g.addColorStop(1, P.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HZ + 1);
  if (P.night) for (const s of stars) { ctx.fillStyle = `rgba(255,255,240,${0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * s.s + s.p))})`; const x = s.x - 0.02 * camX; ctx.fillRect(x, s.y, s.r, s.r); }
  const sx = P.sunXY[0] * W - 0.03 * camX, sy = P.sunXY[1] * H, R = H * (P.night ? 0.04 : 0.05);
  const gl = ctx.createRadialGradient(sx, sy, R * 0.5, sx, sy, H * (P.night ? 0.22 : 0.4)); gl.addColorStop(0, rgba(P.sun, P.night ? 0.22 : 0.5)); gl.addColorStop(1, rgba(P.sun, 0));
  ctx.fillStyle = gl; ctx.fillRect(sx - H * 0.45, sy - H * 0.45, H * 0.9, H * 0.9);
  ctx.fillStyle = P.sun; circ(ctx, sx, sy, R);
  if (P.night) { ctx.fillStyle = 'rgba(150,150,170,.35)'; circ(ctx, sx - R * 0.3, sy - R * 0.2, R * 0.2); circ(ctx, sx + R * 0.35, sy + R * 0.3, R * 0.15); circ(ctx, sx + R * 0.1, sy - R * 0.5, R * 0.1); }
}
function drawClouds(dt) {
  for (const c of clouds) {
    c.x += c.v * dt * (motion ? 1 : 0); const span = W + 520 * c.sc;
    const x = ((c.x - c.f * camX) % span + span) % span - 260 * c.sc;
    ctx.globalAlpha = c.a; ctx.drawImage(c.s, x, c.y, 260 * c.sc, 90 * c.sc);
  }
  ctx.globalAlpha = 1;
}
function drawSea() {
  const g = ctx.createLinearGradient(0, HZ, 0, H); g.addColorStop(0, P.sea[0]); g.addColorStop(1, P.sea[1]);
  ctx.fillStyle = g; ctx.fillRect(0, HZ, W, H - HZ);
  const hg = ctx.createLinearGradient(0, HZ - H * 0.05, 0, HZ + H * 0.05); hg.addColorStop(0, rgba(P.haze, 0)); hg.addColorStop(0.5, rgba(P.haze, 0.5)); hg.addColorStop(1, rgba(P.haze, 0));
  ctx.fillStyle = hg; ctx.fillRect(0, HZ - H * 0.05, W, H * 0.1);
}
function drawShimmer() {
  const sx = P.sunXY[0] * W, light = P.night ? '#cfd8ff' : P.sun;
  ctx.lineCap = 'round';
  for (const s of shimmer) {
    const x = ((s.x - 0.45 * (AMP + camX)) % (W + 80) + W + 80) % (W + 80) - 40, near = 1 - Math.min(1, Math.abs(x - sx) / (W * 0.45));
    const a = (0.5 + 0.5 * Math.sin(T * s.s + s.p)) * (0.1 + 0.4 * near) * (P.night ? 0.7 : 1);
    if (a < 0.02) continue; ctx.strokeStyle = rgba(light, a); ctx.lineWidth = 1.5 + (s.y - HZ) / H * 3; ctx.beginPath(); ctx.moveTo(x - s.w / 2, s.y); ctx.lineTo(x + s.w / 2, s.y); ctx.stroke();
  }
}
function drawBoat() {
  const x = boat.u * W - 0.5 * camX, bob = Math.sin(T * 0.9) * 2.2, s = boat.sc, y = boat.y + bob;
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(T * 0.7) * 0.025);
  ctx.fillStyle = tint('#7a5236', P.haze, 0.2); ctx.beginPath(); ctx.moveTo(-s * 0.6, -s * 0.12); ctx.lineTo(s * 0.6, -s * 0.12); ctx.lineTo(s * 0.4, s * 0.1); ctx.lineTo(-s * 0.4, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint('#fff4e0', P.haze, P.night ? 0.7 : 0.15); tri(ctx, 0, -s * 1.1, 0, -s * 0.18, s * 0.5, -s * 0.18); ctx.fillStyle = tint('#f7c8b8', P.haze, P.night ? 0.7 : 0.15); tri(ctx, -s * 0.05, -s * 0.9, -s * 0.05, -s * 0.18, -s * 0.38, -s * 0.18);
  ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -s * 1.1); ctx.lineTo(0, -s * 0.1); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(-s * 0.8, s * 0.12, s * 1.6, 2); ctx.restore();
}
function drawBirds(dt) {
  ctx.strokeStyle = tint('#3a3a50', P.haze, 0.35); ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const b of birds) {
    b.x += b.v * dt * (motion ? 1 : 0); const x = ((b.x - 0.3 * camX) % (W + 100) + W + 100) % (W + 100) - 50, y = b.y + Math.sin(T * 0.4 + b.p) * 8, f = Math.sin(T * 4 + b.p) * 5 * b.sc, w = 9 * b.sc;
    ctx.beginPath(); ctx.moveTo(x - w, y - f); ctx.quadraticCurveTo(x - w * 0.4, y - f * 0.2 - 3, x, y); ctx.quadraticCurveTo(x + w * 0.4, y - f * 0.2 - 3, x + w, y - f); ctx.stroke();
  }
}
function drawFire(x, y, s) {
  const k = 0.15 + P.glow * 0.85;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y - s * 0.3, 2, x, y - s * 0.3, s * 3.4); g.addColorStop(0, `rgba(255,170,70,${0.5 * k})`); g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g; ctx.fillRect(x - s * 3.4, y - s * 3.7, s * 6.8, s * 6.8); ctx.globalCompositeOperation = 'source-over';
  const fl = (h, w, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + w, y - h * 0.35, x + w * 0.2, y); ctx.lineTo(x - w * 0.2, y); ctx.quadraticCurveTo(x - w, y - h * 0.35, x, y - h); ctx.fill(); };
  for (let i = 0; i < 3; i++) { const wob = 1 + 0.16 * Math.sin(T * (8 + i * 2.3) + i * 2); fl(s * (0.62 - i * 0.16) * wob, s * (0.2 - i * 0.045), ['#ff8a2a', '#ffc04a', '#fff2a0'][i]); }
}
function drawGlow(x, y, r, a) {
  ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 1, x, y, r); g.addColorStop(0, `rgba(255,214,130,${a})`); g.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = 'source-over';
}
function drawSmoke(dt, x0) {
  if (motion) {
    for (const e of emit) { e[3] = (e[3] ?? Math.random()) - dt; if (e[3] <= 0) { e[3] = 0.32 + Math.random() * 0.2; smoke.push({ x: e[0], y: e[1], a: 0, life: 4 + Math.random() * 2, r: 3 * e[2] + 1, vx: 4 + Math.random() * 5, k: e[2] }); } }
    for (const s of smoke) { s.a += dt; s.y -= (14 + s.a * 4) * dt * s.k; s.x += (s.vx + Math.sin(s.a * 1.3) * 3) * dt; s.r += 3.2 * dt * s.k; }
    smoke = smoke.filter((s) => s.a < s.life);
  }
  for (const s of smoke) { const f = s.a / s.life; ctx.fillStyle = rgba(P.smoke, (1 - f) * Math.min(1, f * 6) * (P.night ? 0.22 : 0.36)); circ(ctx, s.x + x0, s.y, s.r); }
}
function drawFlies(dt) {
  for (const f of flies) {
    const x = ((f.x + Math.sin(T * f.s + f.p) * 22 - 1.1 * (AMP + camX)) % (W + 80) + W + 80) % (W + 80) - 40, y = f.y + Math.cos(T * f.s * 0.8 + f.p) * 14 - (f.kind ? (T * 6 * f.s) % (H * 0.06) : 0);
    if (f.kind) { ctx.fillStyle = 'rgba(255,255,240,.5)'; circ(ctx, x, y, 1.5); continue; }
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * 2.2 * f.s + f.p * 3));
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,236,140,${0.22 * a})`; circ(ctx, x, y, 7); ctx.fillStyle = `rgba(255,248,190,${a})`; circ(ctx, x, y, 1.8); ctx.globalCompositeOperation = 'source-over';
  }
}

function render(dt) {
  ctx.clearRect(0, 0, W, H);
  drawSky(); drawClouds(dt);
  blit(layers[0]); blit(layers[1]);
  drawSea(); drawShimmer();
  blit(layers[2]); blit(layers[3]); drawBoat();
  const island = layers[4]; blit(island);
  const x0 = -island.f * (AMP + camX);   // слойная x → экранная
  drawSmoke(dt, x0);
  for (const [x, y, s] of fires) drawFire(x + x0, y, s);
  if (P.glow > 0) for (const l of lamps) drawGlow(l[0] + x0, l[1], l[2] ? l[2] * 3.4 : 46, 0.3 + P.glow * 0.5);
  drawBirds(dt);
  blit(layers[5]); drawFlies(dt);
}
function frame(ts) {
  raf = 0; if (!running) return;
  const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
  T += dt; camX = AMP * Math.sin(T * TAU / 80 + phase);
  render(dt);
  raf = requestAnimationFrame(frame);
}

function size() {
  W = innerWidth; H = innerHeight; dpr = Math.min(window.devicePixelRatio || 1, W * H > 1.4e6 ? 1.25 : 1.75);
  AMP = clamp(W * 0.075, 50, 150);
  cv.width = Math.ceil(W * dpr); cv.height = Math.ceil(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  build(); if (!motion) { camX = AMP * Math.sin(T * TAU / 80 + phase); render(0); }
}
let rt = 0; const onResize = () => { clearTimeout(rt); rt = setTimeout(size, 120); };

export function startMenuBg(canvas, { animate = true } = {}) {
  cv = canvas; seed = (Math.random() * 1e9) | 0; phase = Math.random() * TAU; motion = animate; running = true; last = performance.now(); T = 5 + Math.random() * 40;
  size(); addEventListener('resize', onResize);
  if (motion) raf = requestAnimationFrame(frame);
}
// «Анимация фона» в настройках: выключено — остаётся один спокойный кадр
export function setMenuMotion(on) {
  motion = on; if (!running) return;
  cancelAnimationFrame(raf); raf = 0;
  if (on) { last = performance.now(); raf = requestAnimationFrame(frame); } else { camX = AMP * Math.sin(T * TAU / 80 + phase); render(0); }
}
export function stopMenuBg() { running = false; cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', onResize); layers = []; }
