// Туман войны: G.fog[i] = 1, если клетка разведана. Раскрывается вокруг персонажа; скрытое не рисуется и недоступно для постройки.
import { G, N } from './state.js';
import { T, inB } from './world.js';

export const REVEAL_R = 7.5;       // радиус обзора вокруг персонажа
export const START_R = 15;         // сколько видно в начале игры

export const initFog = () => { G.fog = new Uint8Array(N * N); G.fogVer = 1; };
export const explored = (x, y) => !G.fog || (inB(x, y) && G.fog[y * N + x] === 1);
// для клеток за краем карты: смотрим на ближайшую клетку внутри (открытое море у берега не прячется)
export const exploredNear = (x, y) => !G.fog || G.fog[Math.min(N - 1, Math.max(0, Math.floor(y))) * N + Math.min(N - 1, Math.max(0, Math.floor(x)))] === 1;

// раскрыть круг радиуса r вокруг (cx, cy); возвращает число новых клеток
export function reveal(cx, cy, r = REVEAL_R) {
  if (!G.fog) return 0;
  let n = 0;
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(N - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(N - 1, Math.ceil(cy + r));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * N + x;
    if (G.fog[i] || Math.hypot(x + .5 - cx, y + .5 - cy) > r) continue;
    G.fog[i] = 1; n++;
  }
  if (n) { G.fogVer = (G.fogVer || 0) + 1; G._landKey = null; }
  return n;
}

// шаг симуляции: раскрываем вокруг персонажа, когда он перешёл в другую клетку
export function updateFog() {
  if (G.scene !== 'world' || !G.fog) return;
  const p = G.player, k = Math.floor(p.x) + ',' + Math.floor(p.y);
  if (G._fogAt === k) return;
  G._fogAt = k; reveal(p.x, p.y);
}

// доля разведанной суши, 0..1
export function exploredPct() {
  if (!G.fog || !G.tiles) return 1;
  if (G._landKey === G.fogVer && G._landTiles === G.tiles) return G._landPct;
  let land = 0, seen = 0;
  for (let i = 0; i < N * N; i++) if (G.tiles[i] !== T.WATER) { land++; if (G.fog[i]) seen++; }
  G._landKey = G.fogVer; G._landTiles = G.tiles; G._landPct = land ? seen / land : 1;
  return G._landPct;
}
