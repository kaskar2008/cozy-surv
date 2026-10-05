// Персонаж: передвижение по сетке и «работа» (действия с индикатором прогресса).
import { G, N } from './state.js';
import { flood, pathFrom, ringTiles, inB, bldAt } from './world.js';
import { BDEF } from '../data/buildings/index.js';

export const worldGrid = () => ({ W: N, D: N, blocked: (x, y) => G.blk[y * N + x] === 1 });
export const grid = () => (G.scene === 'world' ? worldGrid() : G.interior);

export function pathToRectGrid(g, sx, sy, x, y, w, d) {
  if (sx >= x && sy >= y && sx < x + w && sy < y + d) return { path: [], at: { x: sx, y: sy } };
  const f = flood(g.W, g.D, g.blocked, sx, sy);
  let best = null, bd = 1e9;
  for (const [tx, ty] of ringTiles(x, y, w, d)) {
    if (tx < 0 || ty < 0 || tx >= g.W || ty >= g.D) continue;
    const dd = f.dist[ty * g.W + tx];
    if (dd >= 0 && dd < bd) { bd = dd; best = [tx, ty]; }
  }
  if (!best) return null;
  return { path: pathFrom(f, best[0], best[1]) || [], at: { x: best[0], y: best[1] } };
}

export function cancelAll() { const p = G.player; p.path = []; p.onArrive = null; p.work = null; p.fx = null; }
export function faceTo(x, y) { const p = G.player; const sx = (x - p.x) - (y - p.y); if (Math.abs(sx) > 0.05) p.face = sx >= 0 ? 1 : -1; }

export function goTo(tx, ty, cb) {
  const p = G.player, g = grid();
  if (tx < 0 || ty < 0 || tx >= g.W || ty >= g.D || g.blocked(tx, ty)) return false;
  const f = flood(g.W, g.D, g.blocked, Math.floor(p.x), Math.floor(p.y));
  const path = pathFrom(f, tx, ty);
  if (!path) return false;
  cancelAll(); p.path = path; p.onArrive = cb || null;
  if (!path.length && cb) { cb(); p.onArrive = null; }
  return true;
}
export function goToRect(x, y, w, d, cb) {
  const p = G.player, g = grid();
  const r = pathToRectGrid(g, Math.floor(p.x), Math.floor(p.y), x, y, w, d);
  if (!r) return false;
  cancelAll(); p.path = r.path; p.onArrive = cb || null;
  if (!r.path.length) { const c2 = p.onArrive; p.onArrive = null; if (c2) c2(); }
  return true;
}
export function startWork(label, dur, fx, fn, opts = {}) {
  const p = G.player;
  p.path = []; p.onArrive = null;
  p.work = { label, dur: Math.max(.2, dur), prog: 0, fn, ...opts }; p.fx = fx || 'pick'; p.workT = 0;
  if (opts.faceTo) faceTo(opts.faceTo[0], opts.faceTo[1]);
}
export const workSpeed = () => { const n = G.needs; return (n.energy < 20 ? .75 : 1) * (n.mood > 70 ? 1.12 : n.mood < 25 ? .9 : 1); };

export function updatePlayer(dt) {
  const p = G.player; p.moving = false;
  if (p.sleeping) return;
  if (p.path && p.path.length) {
    const tg = p.path[0], tx = tg.x + .5, ty = tg.y + .5, dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
    let sp = 3.3 * (G.needs.energy < 12 ? .8 : 1);
    if (G.scene === 'world') { const b = bldAt(Math.floor(p.x), Math.floor(p.y)); if (b) sp *= BDEF[b.t].speed || 1; }
    const step = sp * dt;
    if (dist <= step) { p.x = tx; p.y = ty; p.path.shift(); if (!p.path.length) { const cb = p.onArrive; p.onArrive = null; if (cb) cb(); } }
    else { p.x += dx / dist * step; p.y += dy / dist * step; }
    const sx = dx - dy; if (Math.abs(sx) > 0.02) p.face = sx >= 0 ? 1 : -1;
    p.moving = true;
  }
  if (p.work) {
    const w = p.work; w.prog += dt * workSpeed(); p.workT = w.prog;
    if (w.tick) w.tick(w, dt);
    if (w.prog >= w.dur) { const fn = w.fn; p.work = null; p.fx = null; if (fn) fn(); }
  }
}
