// Частицы, всплывающие подписи и «живность» вокруг: бабочки, светлячки, птицы.
import { G, N, season, darkness } from '../game/state.js';
import { P, proj } from '../core/iso.js';
import { cam, worldToScreen, viewTiles } from './camera.js';
import { rnd, pick } from '../core/util.js';

export const fxs = { scope: null };
export const parts = [];
export const floats = [];
const MAXP = 700;

export function spawn(o) { if (parts.length < MAXP) parts.push({ vx: 0, vy: 0, vz: 0, life: 1, max: 1, size: 3, col: '#fff', grav: 0, ...o, max: o.life ?? 1, sc: fxs.scope ?? G.scene }); }
export const smoke = (x, y, z) => spawn({ type: 'smoke', x: x + rnd(-.05, .05), y: y + rnd(-.05, .05), z, vz: rnd(10, 16), vx: rnd(.02, .08), vy: rnd(-.02, .02), life: rnd(2.2, 3.4), size: rnd(3, 5), col: '#d8d8d8' });
export const steam = (x, y, z) => spawn({ type: 'smoke', x: x + rnd(-.2, .2), y: y + rnd(-.2, .2), z, vz: rnd(8, 14), life: rnd(1.4, 2.2), size: rnd(3, 5), col: '#ffffff', a: .5 });
export const spark = (x, y, z) => spawn({ type: 'spark', x: x + rnd(-.1, .1), y: y + rnd(-.1, .1), z, vz: rnd(18, 34), vx: rnd(-.2, .2), vy: rnd(-.2, .2), life: rnd(.7, 1.3), size: 1.6, col: '#ffc060' });
export const sparkle = (x, y, z, col = '#fff6b0', n = 6) => { for (let i = 0; i < n; i++) spawn({ type: 'spark', x: x + rnd(-.3, .3), y: y + rnd(-.3, .3), z: z + rnd(0, 12), vz: rnd(10, 30), vx: rnd(-.5, .5), vy: rnd(-.5, .5), life: rnd(.5, 1), size: 2.2, col }); };
export const hearts = (x, y, z) => { for (let i = 0; i < 4; i++) spawn({ type: 'text', txt: '♥', x: x + rnd(-.2, .2), y: y + rnd(-.2, .2), z: z + i * 3, vz: rnd(16, 26), life: rnd(1, 1.6), size: 12, col: '#ff6f91' }); };
export const dust = (x, y, n = 8) => { for (let i = 0; i < n; i++) spawn({ type: 'smoke', x: x + rnd(-.6, .6), y: y + rnd(-.6, .6), z: 2, vz: rnd(4, 12), vx: rnd(-.3, .3), vy: rnd(-.3, .3), life: rnd(.6, 1.1), size: rnd(3, 6), col: '#c9b48a', a: .6 }); };
export const note = (x, y, z) => spawn({ type: 'text', txt: pick(['♪', '♫', '♬']), x, y, z, vz: 18, vx: rnd(-.1, .1), life: 1.6, size: 13, col: '#ff9ec0' });
export const drop = (x, y, z) => spawn({ type: 'spark', x, y, z, vz: 12, life: .6, size: 2, col: '#8fd0f2' });
export function floatText(x, y, text, col = '#fff', z = 30) { floats.push({ x, y, z, text, col, life: 1.8, max: 1.8, sc: fxs.scope ?? G.scene }); }

export function update(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt;
    if (p.type === 'smoke') p.size += dt * 2.2;
  }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.z += 14 * dt; if (f.life <= 0) floats.splice(i, 1); }
}
export function drawParts(c) {
  for (const p of parts) {
    if (p.sc !== G.scene) continue;
    const [X, Y] = proj(p.x, p.y, p.z), k = p.life / p.max;
    if (p.type === 'smoke') { c.globalAlpha = (p.a ?? .5) * k; c.fillStyle = p.col; c.beginPath(); c.arc(X, Y, p.size, 0, 7); c.fill(); }
    else if (p.type === 'spark') { c.globalAlpha = Math.min(1, k * 1.6); c.fillStyle = p.col; c.beginPath(); c.arc(X, Y, p.size * (.5 + k * .5), 0, 7); c.fill(); }
    else if (p.type === 'text') { c.globalAlpha = Math.min(1, k * 1.8); c.fillStyle = p.col; c.font = `${p.size}px sans-serif`; c.textAlign = 'center'; c.fillText(p.txt, X, Y); }
  }
  c.globalAlpha = 1;
  c.textAlign = 'center'; c.font = '600 13px ui-rounded, system-ui, sans-serif';
  for (const f of floats) {
    if (f.sc !== G.scene) continue;
    const [X, Y] = proj(f.x, f.y, f.z), a = Math.min(1, f.life / .6);
    c.globalAlpha = a; c.lineWidth = 3; c.strokeStyle = 'rgba(40,30,20,.55)'; c.strokeText(f.text, X, Y); c.fillStyle = f.col; c.fillText(f.text, X, Y);
  }
  c.globalAlpha = 1;
}

// ---------- живность ----------
const bflies = [], birds = [], flies = [];
let tBird = 8;
export function ambient(dt, t, w) {
  const s = season(), dark = darkness(), v = viewTiles(0);
  // бабочки
  if (dark < .4 && s < 3 && w !== 'rain' && bflies.length < 7 && Math.random() < dt * .8) {
    const x = rnd(Math.max(1, v.x0 + 3), Math.min(N - 1, v.x1 - 3)), y = rnd(Math.max(1, v.y0 + 3), Math.min(N - 1, v.y1 - 3));
    bflies.push({ x, y, a: rnd(0, 6.28), life: rnd(14, 30), col: pick(['#f6a8c8', '#f8e07a', '#9ac8f6', '#ffffff', '#f7a05a']) });
  }
  for (let i = bflies.length - 1; i >= 0; i--) { const b = bflies[i]; b.life -= dt; b.a += (Math.random() - .5) * dt * 5; b.x += Math.cos(b.a) * dt * .8; b.y += Math.sin(b.a) * dt * .8; if (b.life <= 0 || dark > .5) bflies.splice(i, 1); }
  // светлячки
  if (dark > .6 && (s === 1 || s === 0) && w !== 'rain' && flies.length < 26 && Math.random() < dt * 4) {
    flies.push({ x: rnd(Math.max(1, v.x0 + 2), Math.min(N - 1, v.x1 - 2)), y: rnd(Math.max(1, v.y0 + 2), Math.min(N - 1, v.y1 - 2)), a: rnd(0, 6.28), life: rnd(8, 16), z: rnd(8, 40), ph: rnd(0, 6) });
  }
  for (let i = flies.length - 1; i >= 0; i--) { const f = flies[i]; f.life -= dt; f.a += (Math.random() - .5) * dt * 3; f.x += Math.cos(f.a) * dt * .35; f.y += Math.sin(f.a) * dt * .35; if (f.life <= 0 || dark < .3) flies.splice(i, 1); }
  // птицы (тень пролетает по земле)
  tBird -= dt;
  if (tBird < 0 && dark < .4 && w !== 'rain') { tBird = rnd(25, 60); const y = rnd(5, N - 5); birds.push({ x: -4, y, vx: rnd(1.6, 2.4), n: 3 + Math.floor(rnd(0, 3)), ph: rnd(0, 6) }); }
  for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; b.x += b.vx * dt; if (b.x > N + 6) birds.splice(i, 1); }
}
export function drawAmbient(c, t) {
  for (const b of bflies) {
    const [X, Y] = proj(b.x, b.y, 14 + Math.sin(t * 3 + b.a) * 5), f = Math.abs(Math.sin(t * 14 + b.a)) * 4 + 1;
    c.fillStyle = b.col; c.beginPath(); c.ellipse(X - 2, Y, f, 3, -.4, 0, 7); c.ellipse(X + 2, Y, f, 3, .4, 0, 7); c.fill();
  }
  for (const f of flies) {
    const [X, Y] = proj(f.x, f.y, f.z + Math.sin(t * 2 + f.ph) * 4), a = .5 + .5 * Math.sin(t * 3 + f.ph);
    c.fillStyle = `rgba(230,255,140,${a})`; c.beginPath(); c.arc(X, Y, 1.8, 0, 7); c.fill();
    c.fillStyle = `rgba(230,255,140,${a * .25})`; c.beginPath(); c.arc(X, Y, 6, 0, 7); c.fill();
  }
  c.strokeStyle = 'rgba(40,40,50,.55)'; c.lineWidth = 1.6; c.lineCap = 'round';
  for (const b of birds) for (let i = 0; i < b.n; i++) {
    const [X, Y] = proj(b.x - i * .9, b.y + (i % 2 ? 1 : -1) * i * .5, 70 + i * 4), fl = Math.sin(t * 9 + b.ph + i) * 5;
    c.beginPath(); c.moveTo(X - 7, Y + fl * .3); c.lineTo(X, Y - fl * .2 + 2); c.lineTo(X + 7, Y + fl * .3); c.stroke();
  }
}
