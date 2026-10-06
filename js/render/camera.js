// Камера: ортографическая, под углом 30° (клетка видна ромбом 2:1), поворот вокруг цели шагами по 90°.
// Преобразования мир <-> экран считаются аналитически и совпадают с three-камерой (см. gl.js).
import { KX, hz } from '../core/iso.js';
export const cam = { tx: 28, ty: 28, zoom: 1, W: 800, H: 600, dpr: 1, minZoom: 0.4, maxZoom: 2.6, az: Math.PI / 4, azT: Math.PI / 4, goto: null };
export const EL = Math.PI / 6;
const SIN_EL = Math.sin(EL);

const basis = () => { const s = Math.sin(cam.az), c = Math.cos(cam.az); return { rx: c, ry: -s, dx: s, dy: c }; };

// клетка (x, y) на высоте z (пиксели графики) -> пиксель экрана
export function worldToScreen(x, y, z = 0) {
  const b = basis(), K = KX * cam.zoom, rx = x - cam.tx, ry = y - cam.ty;
  return [cam.W / 2 + K * (b.rx * rx + b.ry * ry), cam.H / 2 + K * SIN_EL * (b.dx * rx + b.dy * ry) - cam.zoom * z];
}
// пиксель экрана -> точка земли на высоте z (пиксели графики)
export function screenToWorld(px, py, z = 0) {
  const b = basis(), K = KX * cam.zoom;
  const a = (px - cam.W / 2) / K, d = ((py - cam.H / 2) + cam.zoom * z) / (K * SIN_EL);
  return [cam.tx + a * b.rx + d * b.dx, cam.ty + a * b.ry + d * b.dy];
}
// сдвиг камеры на вектор в пикселях экрана
export function panScreen(dxp, dyp) {
  const b = basis(), K = KX * cam.zoom, a = dxp / K, d = dyp / (K * SIN_EL);
  cam.tx += a * b.rx + d * b.dx; cam.ty += a * b.ry + d * b.dy;
}
export function focusUpper(x, y, z = 14) {
  if (innerWidth >= 700) return;
  const [, sy] = worldToScreen(x, y, z);
  cam.goto = { dy: sy - cam.H * 0.28 };
}
export function centerOn(x, y) { cam.tx = x; cam.ty = y; }
export function zoomAt(px, py, f) {
  const [wx, wy] = screenToWorld(px, py);
  cam.zoom = Math.min(cam.maxZoom, Math.max(cam.minZoom, cam.zoom * f));
  const [nx, ny] = screenToWorld(px, py);
  cam.tx += wx - nx; cam.ty += wy - ny;
}
// поворот на 90° (dir = ±1), плавно; в интерьере не используется
export function rotateCam(dir) { cam.azT += dir * Math.PI / 2; }
export function updateCam(dt) {
  if (Math.abs(cam.azT - cam.az) > 1e-4) {
    const k = 1 - Math.exp(-dt * 9);
    cam.az += (cam.azT - cam.az) * k;
    if (Math.abs(cam.azT - cam.az) < 0.002) cam.az = cam.azT;
  }
  // не копим обороты: держим угол в пределах одного круга
  if (cam.az === cam.azT && Math.abs(cam.az) > 20) { const t = Math.round(cam.az / (Math.PI * 2)) * Math.PI * 2; cam.az -= t; cam.azT -= t; }
}
export function resetAz() { cam.az = cam.azT = Math.PI / 4; }
// видимый диапазон клеток
export function viewTiles(pad = 2) {
  const pts = [[0, 0], [cam.W, 0], [0, cam.H], [cam.W, cam.H]].map(([x, y]) => screenToWorld(x, y));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { x0: Math.floor(Math.min(...xs)) - pad, x1: Math.ceil(Math.max(...xs)) + pad, y0: Math.floor(Math.min(...ys)) - pad, y1: Math.ceil(Math.max(...ys)) + pad };
}
void hz;
