// Освещение: ночная тьма, источники света, закат/рассвет, туман.
import { cam, worldToScreen } from './camera.js';
import { darkness, hour, G } from '../game/state.js';
import { HW, HH } from '../core/iso.js';

let lc = null, lctx = null;
const SCALE = 0.5;
export function drawLighting(c, lights, t, opts = {}) {
  const W = cam.W, H = cam.H, dpr = cam.dpr;
  const dark = Math.min(1, darkness() + (opts.extraDark || 0));
  const h = hour();
  // закат / рассвет — тёплый туман цвета
  const dusk = Math.max(0, 1 - Math.abs(h - 18.2) / 1.8) * 0.9, dawn = Math.max(0, 1 - Math.abs(h - 6.3) / 1.6) * 0.8;
  c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!opts.indoor && (dusk > 0.01 || dawn > 0.01)) {
    const col = dusk > dawn ? `rgba(255,140,70,${0.16 * dusk})` : `rgba(255,190,150,${0.14 * dawn})`;
    c.fillStyle = col; c.fillRect(0, 0, W, H);
  }
  if (dark > 0.02) {
    const w = Math.ceil(W * SCALE), hh = Math.ceil(H * SCALE);
    if (!lc || lc.width !== w || lc.height !== hh) { lc = document.createElement('canvas'); lc.width = w; lc.height = hh; lctx = lc.getContext('2d'); }
    const k = lctx;
    k.globalCompositeOperation = 'source-over'; k.clearRect(0, 0, w, hh);
    const a = (opts.indoor ? 0.5 : 0.66) * dark;
    k.fillStyle = `rgba(14,22,62,${a})`; k.fillRect(0, 0, w, hh);
    k.globalCompositeOperation = 'destination-out';
    for (const L of lights) {
      const [sx, sy] = opts.toScreen(L.x, L.y, L.z || 14);
      const r = L.r * HW * 1.4 * cam.zoom * SCALE * (L.f || 1);
      const g = k.createRadialGradient(sx * SCALE, sy * SCALE, r * 0.08, sx * SCALE, sy * SCALE, r);
      const al = Math.min(1, (L.a ?? 1));
      g.addColorStop(0, `rgba(0,0,0,${al})`); g.addColorStop(0.55, `rgba(0,0,0,${al * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      k.fillStyle = g; k.fillRect(sx * SCALE - r, sy * SCALE - r, r * 2, r * 2);
    }
    c.drawImage(lc, 0, 0, w, hh, 0, 0, W, H);
    // тёплое свечение
    c.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      const [sx, sy] = opts.toScreen(L.x, L.y, L.z || 14);
      const r = L.r * HW * 0.8 * cam.zoom * (L.f || 1);
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, hexA(L.col, 0.28 * dark * (L.a ?? 1))); g.addColorStop(1, hexA(L.col, 0));
      c.fillStyle = g; c.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
