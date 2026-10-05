// Отрисовка земли: плитки красятся пачками по цвету (быстро), сверху — детали и блики воды.
import { G, N } from '../game/state.js';
import { T, inB } from '../game/world.js';
import { HW, HH } from '../core/iso.js';
import { shade, hash2 } from '../core/util.js';

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

const buckets = Array.from({ length: 30 }, () => []);
export function drawTerrain(c, view, season, t) {
  if (palSeason !== season) { buildColors(season); detCache.clear(); }
  for (const b of buckets) b.length = 0;
  const x0 = Math.max(-8, view.x0), y0 = Math.max(-8, view.y0), x1 = Math.min(N + 8, view.x1), y1 = Math.min(N + 8, view.y1);
  const water = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    let tt = T.WATER, lv = 0;
    if (inB(x, y)) {
      const i = y * N + x; tt = G.tiles[i];
      lv = tt === T.WATER ? (G.shd[i] === 7 ? 4 : G.shd[i] % 3) : G.shd[i] % 5;
    }
    buckets[tt * 5 + lv].push(x, y);
    if (tt === T.WATER) water.push(x, y);
  }
  for (let k = 0; k < 30; k++) {
    const arr = buckets[k]; if (!arr.length) continue;
    c.fillStyle = colors[(k / 5) | 0][k % 5];
    c.beginPath();
    for (let i = 0; i < arr.length; i += 2) {
      const X = (arr[i] - arr[i + 1]) * HW, Y = (arr[i] + arr[i + 1]) * HH;
      c.moveTo(X, Y - 0.6); c.lineTo(X + HW + 0.8, Y + HH); c.lineTo(X, Y + 2 * HH + 0.6); c.lineTo(X - HW - 0.8, Y + HH); c.closePath();
    }
    c.fill();
  }
  // детали
  for (let y = Math.max(0, y0); y < Math.min(N, y1); y++) for (let x = Math.max(0, x0); x < Math.min(N, x1); x++) {
    const i = y * N + x, d = G.det[i];
    if (!d) continue;
    const tt = G.tiles[i]; if (tt === T.WATER) continue;
    if (G.nAt[i] || G.bAt[i]) continue;
    c.drawImage(detail(tt, season, d), (x - y) * HW - 20, (x + y) * HH + HH - 16);
  }
  // блики воды
  c.lineCap = 'round';
  for (let i = 0; i < water.length; i += 2) {
    const x = water[i], y = water[i + 1], h = hash2(x, y, 5);
    if (h > 0.45) continue;
    const ph = Math.sin(t * 1.3 + h * 40), a = 0.18 + 0.2 * ph;
    if (a < 0.05) continue;
    const X = (x - y) * HW + (h - 0.2) * 24, Y = (x + y) * HH + HH + (h * 7 % 6) - 3;
    c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(X - 7, Y); c.lineTo(X + 6 + ph * 3, Y); c.stroke();
  }
}
