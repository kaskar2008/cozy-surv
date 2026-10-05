// Кэш спрайтов: статичные части построек/ресурсов рендерятся один раз в offscreen-canvas.
import { HW, HH } from './iso.js';
export const SPR = 2;
const cache = new Map();
export function getSprite(key, w, d, h, fn) {
  let s = cache.get(key);
  if (s) return s;
  const pad = 14;
  const W = Math.ceil(((w + d) * HW + pad * 2) * SPR), H = Math.ceil(((w + d) * HH + h + pad * 2) * SPR);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const ax = (d * HW + pad) * SPR, ay = (h + pad) * SPR;
  c.setTransform(SPR, 0, 0, SPR, ax, ay);
  fn(c);
  s = { cv, ax, ay };
  cache.set(key, s);
  return s;
}
export function drawSprite(c, s, sx, sy) { c.drawImage(s.cv, sx - s.ax / SPR, sy - s.ay / SPR, s.cv.width / SPR, s.cv.height / SPR); }
export const clearSprites = () => cache.clear();
