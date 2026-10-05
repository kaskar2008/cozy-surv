// Камера: преобразования мир <-> экран (изометрия).
import { HW, HH } from '../core/iso.js';
export const cam = { x: 0, y: 0, zoom: 1, W: 800, H: 600, dpr: 1, minZoom: 0.55, maxZoom: 2.2 };
export function worldToScreen(x, y, z = 0) {
  return [((x - y) * HW - cam.x) * cam.zoom + cam.W / 2, ((x + y) * HH - z - cam.y) * cam.zoom + cam.H / 2];
}
export function screenToWorld(px, py, z = 0) {
  const u = (px - cam.W / 2) / cam.zoom + cam.x, v = (py - cam.H / 2) / cam.zoom + cam.y + z;
  return [(u / HW + v / HH) / 2, (v / HH - u / HW) / 2];
}
export function focusUpper(x, y, z = 14) {
  if (innerWidth >= 700) return;
  const [, sy] = worldToScreen(x, y, z);
  cam.goto = { dx: 0, dy: (sy - cam.H * 0.28) / cam.zoom };
}
export function centerOn(x, y) { cam.x = (x - y) * HW; cam.y = (x + y) * HH; }
export function zoomAt(px, py, f) {
  const [wx, wy] = screenToWorld(px, py);
  cam.zoom = Math.min(cam.maxZoom, Math.max(cam.minZoom, cam.zoom * f));
  const [nx, ny] = screenToWorld(px, py);
  cam.x += ((wx - wy) - (nx - ny)) * HW; cam.y += ((wx + wy) - (nx + ny)) * HH;
}
// видимый диапазон клеток
export function viewTiles(pad = 2) {
  const pts = [[0, 0], [cam.W, 0], [0, cam.H], [cam.W, cam.H]].map(([x, y]) => screenToWorld(x, y));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.floor(Math.min(...xs)) - pad, x1: Math.ceil(Math.max(...xs)) + pad, y0: Math.floor(Math.min(...ys)) - pad, y1: Math.ceil(Math.max(...ys)) + pad };
}
