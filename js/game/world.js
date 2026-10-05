// Мир: генерация острова, занятость клеток, поиск пути.
import { G, N } from './state.js';
import { mulberry32, fbm, smooth, hash2 } from '../core/util.js';

export const T = { GRASS: 0, DIRT: 1, SAND: 2, WATER: 3, STONE: 4, FOREST: 5 };
export const inB = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
export const ti = (x, y) => y * N + x;
export const tileAt = (x, y) => (inB(x, y) ? G.tiles[y * N + x] : T.WATER);
export const isWater = (x, y) => tileAt(x, y) === T.WATER;
export const nodeAt = (x, y) => (inB(x, y) ? G.nodeMap.get(G.nAt[y * N + x]) || null : null);
export const bldAt = (x, y) => (inB(x, y) ? G.bMap.get(G.bAt[y * N + x]) || null : null);

export function nearWater(x, y, r = 1) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (isWater(x + dx, y + dy)) return true;
  return false;
}

// ---------- узлы ----------
export function addNode(t, x, y, props = {}) {
  const n = { id: G.nid++, t, x, y, v: Math.floor(Math.random() * 1000), st: 'full', tm: 0, ...props };
  G.nodeMap.set(n.id, n); G.nAt[ti(x, y)] = n.id; G.dirtyBlk = true;
  return n;
}
export function removeNode(n) {
  G.nodeMap.delete(n.id);
  if (G.nAt[ti(n.x, n.y)] === n.id) G.nAt[ti(n.x, n.y)] = 0;
  G.dirtyBlk = true;
}
// ---------- постройки ----------
export function addBld(b) {
  b.id = G.bid++;
  G.bMap.set(b.id, b);
  for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) G.bAt[ti(b.x + i, b.y + j)] = b.id;
  G.dirtyBlk = true; G.dirtyLinks = true;
  return b;
}
export function removeBld(b) {
  G.bMap.delete(b.id);
  for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) if (G.bAt[ti(b.x + i, b.y + j)] === b.id) G.bAt[ti(b.x + i, b.y + j)] = 0;
  G.dirtyBlk = true; G.dirtyLinks = true;
}
export function rebuildOcc() {
  G.nAt.fill(0); G.bAt.fill(0);
  for (const n of G.nodeMap.values()) G.nAt[ti(n.x, n.y)] = n.id;
  for (const b of G.bMap.values()) for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) G.bAt[ti(b.x + i, b.y + j)] = b.id;
  G.dirtyBlk = true; G.dirtyLinks = true;
}
// блокировка для ходьбы
export function rebuildBlk(nodeBlock) {
  const blk = G.blk;
  for (let i = 0; i < N * N; i++) blk[i] = G.tiles[i] === T.WATER ? 1 : 0;
  for (const n of G.nodeMap.values()) if (nodeBlock(n)) blk[ti(n.x, n.y)] = 1;
  for (const b of G.bMap.values()) if (!b.walk) for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) blk[ti(b.x + i, b.y + j)] = 1;
  G.dirtyBlk = false;
}
export const walkable = (x, y) => inB(x, y) && !G.blk[y * N + x];

// ---------- поиск пути (BFS по сетке, 8 направлений) ----------
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export function flood(W, D, blocked, sx, sy) {
  const dist = new Int16Array(W * D).fill(-1), prev = new Int32Array(W * D).fill(-1);
  const q = new Int32Array(W * D); let h = 0, t = 0;
  dist[sy * W + sx] = 0; q[t++] = sy * W + sx;
  while (h < t) {
    const cur = q[h++], cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= D) continue;
      const ni = ny * W + nx;
      if (dist[ni] >= 0 || blocked(nx, ny)) continue;
      if (dx && dy && (blocked(cx + dx, cy) || blocked(cx, cy + dy))) continue;
      dist[ni] = dist[cur] + 1; prev[ni] = cur; q[t++] = ni;
    }
  }
  return { dist, prev, W };
}
export function pathFrom(f, tx, ty) {
  const W = f.W; let i = ty * W + tx;
  if (f.dist[i] < 0) return null;
  const out = [];
  while (i >= 0) { out.push({ x: i % W, y: (i / W) | 0 }); i = f.prev[i]; }
  out.reverse(); out.shift();
  return out;
}
// клетки вокруг прямоугольника (в т.ч. по диагонали)
export function ringTiles(x, y, w, d) {
  const out = [];
  for (let j = -1; j <= d; j++) for (let i = -1; i <= w; i++) if (i < 0 || j < 0 || i >= w || j >= d) out.push([x + i, y + j]);
  return out;
}
export function worldFlood(sx, sy) { return flood(N, N, (x, y) => G.blk[y * N + x] === 1, sx, sy); }
export function pathTo(sx, sy, tx, ty) {
  if (!inB(tx, ty) || G.blk[ty * N + tx]) return null;
  return pathFrom(worldFlood(sx, sy), tx, ty);
}
// путь до ближайшей клетки рядом с прямоугольником
export function pathToRect(sx, sy, x, y, w, d) {
  if (sx >= x && sy >= y && sx < x + w && sy < y + d) return { path: [], at: { x: sx, y: sy } };
  const f = worldFlood(sx, sy);
  let best = null, bd = 1e9;
  for (const [tx, ty] of ringTiles(x, y, w, d)) {
    if (!inB(tx, ty)) continue;
    const dd = f.dist[ty * N + tx];
    if (dd >= 0 && dd < bd) { bd = dd; best = [tx, ty]; }
  }
  if (!best) return null;
  return { path: pathFrom(f, best[0], best[1]) || [], at: { x: best[0], y: best[1] } };
}

// ---------- генерация ----------
export function generate(seed) {
  const rng = mulberry32(seed);
  const c = N / 2;
  G.tiles = new Uint8Array(N * N); G.shd = new Uint8Array(N * N); G.det = new Uint8Array(N * N);
  G.nodeMap = new Map(); G.nid = 1; G.nAt = new Int32Array(N * N);
  G.bMap = new Map(); G.bid = 1; G.bAt = new Int32Array(N * N);
  G.blk = new Uint8Array(N * N);
  const elev = new Float32Array(N * N);
  // лес/камни
  const forest = new Uint8Array(N * N), stone = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x + 0.5 - c) / c, dy = (y + 0.5 - c) / c, r = Math.hypot(dx, dy);
    const base = fbm(x * 0.075, y * 0.075, seed, 4);
    const e = base + 0.38 - smooth(0.45, 1.0, r) * 1.0;
    elev[y * N + x] = e;
    let t = T.GRASS;
    if (e < 0.2) t = T.WATER;
    else if (e < 0.27) t = T.SAND;
    const pond = fbm(x * 0.13 + 300, y * 0.13 + 300, seed + 7, 3);
    if (t !== T.WATER && pond > 0.7 && r < 0.62 && r > 0.3) t = T.WATER;
    if (t === T.GRASS) {
      if (fbm(x * 0.09 + 50, y * 0.09, seed + 3, 3) > 0.62 && e > 0.42 && r > 0.35) { t = T.STONE; stone[y * N + x] = 1; }
      else if (fbm(x * 0.08 + 120, y * 0.08 + 40, seed + 5, 3) > 0.54 && r > 0.22) { forest[y * N + x] = 1; }
      else if (fbm(x * 0.16 + 700, y * 0.16, seed + 9, 2) > 0.7) t = T.DIRT;
    }
    G.tiles[y * N + x] = t;
  }
  // озеро недалеко от лагеря
  const ang = rng() * Math.PI * 2, lx = c + Math.cos(ang) * 13, ly = c + Math.sin(ang) * 13;
  const lrx = 4 + rng() * 1.5, lry = 3 + rng(), rot = rng() * 3;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ox = x - lx, oy = y - ly, u = (ox * Math.cos(rot) + oy * Math.sin(rot)) / lrx, v = (-ox * Math.sin(rot) + oy * Math.cos(rot)) / lry;
    const k = u * u + v * v + (hash2(x, y, seed) - 0.5) * 0.35;
    if (k < 1) { G.tiles[y * N + x] = T.WATER; forest[y * N + x] = 0; }
  }
  // лагерь: чистая поляна
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    if (r < 6.5 + hash2(x, y, seed + 1) * 1.2) { G.tiles[y * N + x] = (hash2(x, y, seed + 2) > 0.93 ? T.DIRT : T.GRASS); forest[y * N + x] = 0; }
  }
  // песчаная кромка у воды
  const copy = G.tiles.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (copy[i] === T.WATER) continue;
    let w = false;
    for (let dy = -1; dy <= 1 && !w; dy++) for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, y + dy) && copy[(y + dy) * N + x + dx] === T.WATER) { w = true; break; }
    if (w) { G.tiles[i] = T.SAND; forest[i] = 0; }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (G.tiles[i] === T.GRASS && forest[i]) G.tiles[i] = T.FOREST;
    G.shd[i] = Math.floor(hash2(x, y, seed + 11) * 8);
    G.det[i] = hash2(x, y, seed + 13) < 0.3 ? 1 + Math.floor(hash2(x, y, seed + 14) * 3) : 0;
    if (G.tiles[i] === T.WATER) {
      let shallow = false;
      for (const [dx, dy] of DIRS) if (inB(x + dx, y + dy) && G.tiles[(y + dy) * N + x + dx] !== T.WATER) shallow = true;
      G.shd[i] = shallow ? 7 : G.shd[i] % 3;
    }
  }
  scatterNodes(rng, c);
}

function scatterNodes(rng, c) {
  const occupied = new Set();
  const free = (x, y) => inB(x, y) && !occupied.has(y * N + x) && !G.nAt[y * N + x];
  const put = (t, x, y, props) => { occupied.add(y * N + x); return addNode(t, x, y, props); };
  const tiles = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) tiles.push([x, y]);
  for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
  let scrapLeft = 9, appleLeft = 6;
  for (const [x, y] of tiles) {
    const t = G.tiles[y * N + x]; if (t === T.WATER) continue;
    const r = Math.hypot(x + 0.5 - c, y + 0.5 - c), q = rng();
    const wShore = nearWater(x, y, 1), wNear = nearWater(x, y, 2);
    if (r < 2.8) continue;
    if (t === T.SAND) {
      if (wShore && q < 0.08) put('shell', x, y); else if (q < 0.12) put('driftwood', x, y); else if (wShore && q < 0.2) put('sandpile', x, y); else if (wNear && q < 0.24) put('clay', x, y);
      else if (wShore && q < 0.4) put('reeds', x, y);
      continue;
    }
    if (wShore && (t === T.GRASS || t === T.DIRT) && q < 0.22) { put('reeds', x, y); continue; }
    if (wNear && q < 0.07 && t !== T.STONE) { put('clay', x, y); continue; }
    if (t === T.FOREST) {
      if (q < 0.5) put('tree', x, y, { v: pickTree(rng, true) });
      else if (q < 0.54 && appleLeft > 0) { appleLeft--; put('appletree', x, y); }
      else if (q < 0.59) put('bush', x, y);
      else if (q < 0.64) put('mushroom', x, y);
      else if (q < 0.69) put('sticks', x, y);
      else if (q < 0.72) put('herb', x, y);
      else if (q < 0.73) put('boulder', x, y);
      else if (q < 0.76) put('fibergrass', x, y);
    } else if (t === T.STONE) {
      if (q < 0.09) put('boulder', x, y); else if (q < 0.2) put('rock', x, y); else if (q < 0.25) put('tree', x, y, { v: 1 + 3 * Math.floor(rng() * 8) });
    } else {
      if (r > 6.5 && q < 0.035) put('tree', x, y, { v: pickTree(rng, false) });
      else if (q < 0.062) put('bush', x, y);
      else if (q < 0.075) put('rock', x, y);
      else if (q < 0.145) put('fibergrass', x, y);
      else if (q < 0.165) put('herb', x, y);
      else if (q < 0.20) put('flowers', x, y);
      else if (q < 0.215) put('sticks', x, y);
      else if (q < 0.219 && scrapLeft > 0 && r > 5) { scrapLeft--; put('scrap', x, y); }
      else if (q < 0.222 && r > 9) put('boulder', x, y);
    }
  }
  // стартовые ресурсы рядом с лагерем
  const near = (t, n, r0, r1, props) => {
    for (let k = 0, g = 0; k < n && g < 400; g++) {
      const a = rng() * 6.283, r = r0 + rng() * (r1 - r0), x = Math.round(c + Math.cos(a) * r), y = Math.round(c + Math.sin(a) * r);
      if (!free(x, y) || G.tiles[y * N + x] === T.WATER || G.tiles[y * N + x] === T.SAND) continue;
      put(t, x, y, props ? props() : undefined); k++;
    }
  };
  near('tree', 3, 5, 8, () => ({ v: 3 * Math.floor(rng() * 8) }));
  near('tree', 2, 5, 8, () => ({ v: 2 + 3 * Math.floor(rng() * 8) }));
  near('sticks', 4, 3.5, 8); near('rock', 5, 3.5, 8); near('fibergrass', 5, 3.5, 8); near('bush', 3, 4, 8);
  near('flowers', 3, 4, 9); near('herb', 2, 4, 9); near('boulder', 1, 6, 9);
  if (scrapLeft > 0) near('scrap', 2, 7, 11);
}
function pickTree(rng, forest) {
  const q = rng();
  const sp = forest ? (q < 0.45 ? 0 : q < 0.8 ? 1 : 2) : (q < 0.6 ? 0 : q < 0.8 ? 1 : 2);
  return sp + 3 * Math.floor(rng() * 8);
}
