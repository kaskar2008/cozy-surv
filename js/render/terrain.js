// Отрисовка земли: плитки красятся пачками по цвету (быстро), сверху — детали и блики воды.
import { G, N } from '../game/state.js';
import { T, inB } from '../game/world.js';
import { HW, HH } from '../core/iso.js';
import { shade, hash2 } from '../core/util.js';
import { cam } from './camera.js';

const PAL = {
  [T.GRASS]: ['#93cc62', '#80bd55', '#b0b04e', '#e6eff2'],
  [T.DIRT]: ['#b98d5f', '#b58a5c', '#a9805a', '#c9bba8'],
  [T.SAND]: ['#ecd9a4', '#f1dca4', '#e4cb94', '#f0ebdf'],
  [T.WATER]: ['#5fb4cf', '#53a9c8', '#5a9cb6', '#9cc9da'],
  [T.STONE]: ['#a8aab0', '#a2a5ab', '#9a9ca2', '#d9dee3'],
  [T.FOREST]: ['#78b455', '#66a449', '#a38f42', '#d6e2e6'],
};
export const WATER_BG = '#4a9fbd';
let palSeason = -1, colors = [];
function buildColors(season) {
  colors = [];
  for (let t = 0; t < 6; t++) {
    colors[t] = [];
    for (let l = 0; l < 5; l++) {
      let f = (l - 2) * 0.022;
      if (t === T.WATER && l === 4) f = 0.1;
      colors[t][l] = shade(PAL[t][season], f);
    }
  }
  palSeason = season;
}
// спрайты мелких деталей
const detCache = new Map();
function detail(t, season, k) {
  const key = t + '|' + season + '|' + k;
  let cv = detCache.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = 40; cv.height = 28;
  const c = cv.getContext('2d'); c.translate(20, 16); c.lineCap = 'round';
  const base = PAL[t][season];
  if (t === T.GRASS || t === T.FOREST) {
    const col = shade(base, season === 3 ? -0.1 : -0.12), hi = shade(base, 0.12);
    c.lineWidth = 1.3;
    const blades = [[-6, 2, -2, -5], [-3, 3, -4, -7], [0, 2, 1, -6], [4, 3, 6, -5], [7, 1, 5, -4]];
    for (let i = 0; i < 3 + k; i++) { const b = blades[(i + k) % 5]; c.strokeStyle = i % 2 ? col : hi; c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(b[2], b[3]); c.stroke(); }
    if (k === 3 && season !== 3 && t === T.GRASS) { const fc = ['#fff2b8', '#ffd6e0', '#e6e0ff'][season % 3]; c.fillStyle = fc; c.beginPath(); c.arc(-8, 0, 1.6, 0, 7); c.arc(8, -2, 1.4, 0, 7); c.fill(); }
  } else if (t === T.SAND) {
    c.fillStyle = shade(base, -0.1); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-8 + i * 7 + k, (i % 2) * 3 - 1, 1.2, 0, 7); c.fill(); }
  } else if (t === T.STONE || t === T.DIRT) {
    c.fillStyle = shade(base, -0.12); c.beginPath(); c.ellipse(-4 + k * 2, 0, 3.6, 2.2, 0, 0, 7); c.fill();
    c.fillStyle = shade(base, 0.1); c.beginPath(); c.ellipse(-5 + k * 2, -1, 2, 1.1, 0, 0, 7); c.fill();
    c.fillStyle = shade(base, -0.08); c.beginPath(); c.ellipse(6, 3, 2.2, 1.4, 0, 0, 7); c.fill();
  }
  detCache.set(key, cv);
  return cv;
}

// ---- кэш земли: экранно-выровненные непрозрачные блоки 512×512 «мирового» изображения ----
// (без прозрачных углов — нет лишней перерисовки; блоки на лету рисуются один раз на сезон/масштаб)
const B = 512, PAD = 2;
let chunks = new Map(), cTiles = null, cSeason = -1, cTier = -1, cVer = -1, sparkles = null;
const buckets = Array.from({ length: 30 }, () => []);
const MAP_U0 = (-8 - (N + 8)) * HW - HW, MAP_U1 = ((N + 8) + 8) * HW + HW, MAP_V0 = -16 * HH, MAP_V1 = (2 * N + 16) * HH + 2 * HH;

function renderBlock(bx, by, S) {
  const ox = bx * B, oy = by * B, sz = B + PAD;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(sz * S); cv.height = Math.ceil(sz * S);
  const c = cv.getContext('2d');
  c.setTransform(S, 0, 0, S, -ox * S, -oy * S);
  c.fillStyle = WATER_BG; c.fillRect(ox, oy, sz, sz);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [u, v] of [[ox - HW, oy - 2 * HH], [ox + sz + HW, oy - 2 * HH], [ox - HW, oy + sz], [ox + sz + HW, oy + sz]]) {
    const x = (u / HW + v / HH) / 2, y = (v / HH - u / HW) / 2;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  x0 = Math.max(-8, Math.floor(x0) - 1); y0 = Math.max(-8, Math.floor(y0) - 1); x1 = Math.min(N + 8, Math.ceil(x1) + 1); y1 = Math.min(N + 8, Math.ceil(y1) + 1);
  for (const b of buckets) b.length = 0;
  const mine = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const X = (x - y) * HW, Y = (x + y) * HH;
    if (X + HW < ox || X - HW > ox + sz || Y + 2 * HH < oy || Y > oy + sz) continue;
    let tt = T.WATER, lv = 0;
    if (inB(x, y)) { const i = y * N + x; tt = G.tiles[i]; lv = tt === T.WATER ? (G.shd[i] === 7 ? 4 : G.shd[i] % 3) : G.shd[i] % 5; mine.push(i, x, y); }
    buckets[tt * 5 + lv].push(x, y);
  }
  for (let k = 0; k < 30; k++) {
    const arr = buckets[k]; if (!arr.length) continue;
    c.fillStyle = colors[(k / 5) | 0][k % 5]; c.beginPath();
    for (let i = 0; i < arr.length; i += 2) {
      const X = (arr[i] - arr[i + 1]) * HW, Y = (arr[i] + arr[i + 1]) * HH;
      c.moveTo(X, Y - 0.6); c.lineTo(X + HW + 0.8, Y + HH); c.lineTo(X, Y + 2 * HH + 0.6); c.lineTo(X - HW - 0.8, Y + HH); c.closePath();
    }
    c.fill();
  }
  for (let m = 0; m < mine.length; m += 3) {
    const i = mine[m], d = G.det[i]; if (!d) continue;
    const tt = G.tiles[i]; if (tt === T.WATER) continue;
    const x = mine[m + 1], y = mine[m + 2];
    c.drawImage(detail(tt, palSeason, d), (x - y) * HW - 20, (x + y) * HH + HH - 16);
  }
  return { cv, ox, oy, sz };
}
function ensureCache(season, tier) {
  if (palSeason !== season) { buildColors(season); detCache.clear(); }
  if (cTiles !== G.tiles || cSeason !== season || cTier !== tier || cVer !== G.terrainVer) {
    chunks.clear(); cTiles = G.tiles; cSeason = season; cTier = tier; cVer = G.terrainVer; sparkles = null;
  }
}
function buildSparkles() {
  sparkles = [];
  for (let y = -8; y < N + 8; y++) for (let x = -8; x < N + 8; x++) {
    if (inB(x, y) && G.tiles[y * N + x] !== T.WATER) continue;
    const h = hash2(x, y, 5); if (h > 0.45) continue;
    sparkles.push({ x: (x - y) * HW + (h - 0.2) * 24, y: (x + y) * HH + HH + (h * 7 % 6) - 3, ph: h * 40, tx: x, ty: y });
  }
}
const LV = [0.1, 0.18, 0.26, 0.34];
export function drawTerrain(c, view, season, t, scale = 2) {
  // три уровня детализации кэша (с гистерезисом): издали — мелкие блоки, вблизи — крупные
  let tier = cTier < 0 ? (scale < 1.3 ? 0 : scale > 2.6 ? 2 : 1) : cTier;
  if (tier === 0 && scale > 1.45) tier = 1; else if (tier === 1 && scale < 1.15) tier = 0; else if (tier === 1 && scale > 2.6) tier = 2; else if (tier === 2 && scale < 2.1) tier = 1;
  const S = [1.25, 2, 3.5][tier];
  ensureCache(season, tier);
  const hw = cam.W / 2 / cam.zoom, hh = cam.H / 2 / cam.zoom;
  const bx0 = Math.floor((cam.x - hw - PAD) / B), bx1 = Math.floor((cam.x + hw) / B), by0 = Math.floor((cam.y - hh - PAD) / B), by1 = Math.floor((cam.y + hh) / B);
  let vis = 0;
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
    if (bx * B > MAP_U1 || (bx + 1) * B < MAP_U0 || by * B > MAP_V1 || (by + 1) * B < MAP_V0) continue;
    const key = bx + ',' + by; let ch = chunks.get(key);
    if (!ch) ch = renderBlock(bx, by, S); else chunks.delete(key);
    chunks.set(key, ch); vis++;
    c.drawImage(ch.cv, ch.ox, ch.oy, ch.sz, ch.sz);
  }
  const cap = Math.max([60, 40, 16][tier], vis + 6);
  while (chunks.size > cap) chunks.delete(chunks.keys().next().value);
  // блики воды
  if (!sparkles) buildSparkles();
  c.lineCap = 'round'; c.lineWidth = 1.6;
  const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; let any = false;
  for (const s of sparkles) {
    if (s.tx < view.x0 || s.tx > view.x1 || s.ty < view.y0 || s.ty > view.y1) continue;
    const a = 0.18 + 0.2 * Math.sin(t * 1.3 + s.ph); if (a < 0.1) continue;
    const q = Math.min(3, Math.floor((a - 0.1) / 0.075)); paths[q].moveTo(s.x - 7, s.y); paths[q].lineTo(s.x + 6, s.y); any = true;
  }
  if (any) for (let q = 0; q < 4; q++) { c.strokeStyle = `rgba(255,255,255,${LV[q]})`; c.stroke(paths[q]); }
}
