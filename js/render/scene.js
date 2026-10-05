// Отрисовка наружной сцены (изометрия): земля, ресурсы, постройки, существа, свет и погода.
import { G, N, season, darkness, hour } from '../game/state.js';
import { T, bldAt } from '../game/world.js';
import { BDEF } from '../data/buildings/index.js';
import { NDEF } from '../data/nodes.js';
import { HW, HH, diamond, proj, setSwap, P } from '../core/iso.js';
import { easeOutBack } from '../core/util.js';
import { getSprite, drawSprite } from '../core/sprites.js';
import { cam, viewTiles, worldToScreen } from './camera.js';
import { drawTerrain, WATER_BG } from './terrain.js';
import { drawPlayer, drawPet, drawTraveler, drawWorkRing } from './entities.js';
import { drawParts, drawAmbient } from './fx.js';
import { drawLighting } from './lighting.js';
import { drawWeather } from './weather.js';
import { isHot } from '../game/nets.js';

// Состояние отрисовки, которое задают ввод и UI
export const R = { hover: null, ghost: null, sel: null, links: [], grid: false, time: 0 };

const now = () => performance.now() / 1000;
export function bldSprite(b, def, o) {
  const key = `${def.id}|${b.rot ? 1 : 0}|${o.season}|${b.cw}x${b.cd}|${def.key ? def.key(b, o) : ''}`;
  return getSprite(key, b.w, b.d, def.h, (g) => { setSwap(!!b.rot); def.draw(g, b, o); setSwap(false); });
}
function drawBld(c, b, def, o, t) {
  const sx = (b.x - b.y) * HW, sy = (b.x + b.y) * HH;
  c.save();
  if (b.pop !== undefined) {
    const age = now() - b.pop;
    if (age < 0.5) { const k = easeOutBack(Math.min(1, age / 0.45)), cx = (b.x + b.w / 2 - b.y - b.d / 2) * HW, cy = (b.x + b.w / 2 + b.y + b.d / 2) * HH; c.translate(cx, cy); c.scale(.8 + .2 * k, Math.max(.05, k)); c.translate(-cx, -cy); c.globalAlpha = Math.min(1, age * 4); } else delete b.pop;
  }
  if (def.draw && !def.terraform) {
    const s = bldSprite(b, def, o);
    drawSprite(c, s, sx, sy);
  }
  if (def.anim) { c.save(); c.translate(sx, sy); setSwap(!!b.rot); def.anim(c, b, t, o); setSwap(false); c.restore(); }
  c.restore();
}
function drawNodeSprite(c, n, def, o, t) {
  const sx = (n.x - n.y) * HW, sy = (n.x + n.y) * HH;
  const s = getSprite(`${n.t}|${def.key(n, o)}`, 1, 1, def.h, (g) => def.draw(g, n, o));
  let dx = 0;
  if (n.shk && now() - n.shk < .45) dx = Math.sin(now() * 60) * 2.2 * (1 - (now() - n.shk) / .45);
  drawSprite(c, s, sx + dx, sy);
}
const lightOn = (b, def, o) => {
  const w = def.light.on;
  return w === 'lit' ? isHot(b) : w === 'dusk' ? o.dusk : w === 'power' ? (b.st.powered && o.dusk) : true;
};

export function renderWorld(ctx, t, dt) {
  const dpr = cam.dpr, season_ = season(), dk = darkness();
  const o = { season: season_, dusk: dk > .22, night: dk > .55, raining: G.weather.type === 'rain', t };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = WATER_BG; ctx.fillRect(0, 0, cam.W * dpr, cam.H * dpr);
  ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (cam.W / 2 - cam.x * cam.zoom), dpr * (cam.H / 2 - cam.y * cam.zoom));
  const view = viewTiles(3);
  drawTerrain(ctx, view, season_, t);
  const flats = [], items = [], lights = [];
  for (const b of G.bMap.values()) {
    if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.d < view.y0) continue;
    const def = BDEF[b.t];
    if (def.flat) flats.push(b);
    else items.push({ k: b.x + b.w / 2 + b.y + b.d / 2 + (b.y + b.d) * 0.001, b, def });
    if (def.light && lightOn(b, def, o)) lights.push({ x: b.x + b.w / 2, y: b.y + b.d / 2, z: 24, r: def.light.r, col: def.light.col, f: def.light.flick ? 1 + Math.sin(t * 9 + b.id) * .025 * def.light.flick + Math.sin(t * 23 + b.id * 3) * .015 : 1 });
    else if (def.home && b.st.glow && o.dusk) lights.push({ x: b.x + b.w / 2, y: b.y + b.d / 2, z: 20, r: 2.2 + b.w * .5, col: '#ffcf80', a: .8 });
  }
  for (const n of G.nodeMap.values()) {
    if (n.x < view.x0 || n.x > view.x1 || n.y < view.y0 || n.y > view.y1) continue;
    items.push({ k: n.x + n.y + 1 + n.y * 0.001, n, def: NDEF[n.t] });
  }
  for (const b of flats) drawBld(ctx, b, BDEF[b.t], o, t);
  if (R.grid && R.ghost) drawGrid(ctx, R.ghost);
  const pl = G.player;
  items.push({ k: pl.x + pl.y + (G.scene === 'world' ? 0 : -999), player: true });
  for (const p of G.pets) if (!p.in) items.push({ k: p.x + p.y, pet: p });
  if (G.npc) items.push({ k: G.npc.x + G.npc.y, npc: G.npc });
  items.sort((a, b) => a.k - b.k);
  for (const it of items) {
    if (it.b) drawBld(ctx, it.b, it.def, o, t);
    else if (it.n) drawNodeSprite(ctx, it.n, it.def, o, t);
    else if (it.player) { if (G.scene === 'world') drawPlayer(ctx, pl, t); }
    else if (it.pet) drawPet(ctx, it.pet, t);
    else if (it.npc) drawTraveler(ctx, it.npc, t);
  }
  drawOverlays(ctx, o, t);
  drawAmbient(ctx, t);
  drawParts(ctx);
  // свет игрока ночью
  if (G.scene === 'world') lights.push({ x: pl.x, y: pl.y, z: 20, r: 2.0, col: '#ffe0a8', a: .35 });
  for (const p of G.pets) if (p.sleep === false) lights.push({ x: p.x, y: p.y, z: 8, r: .8, col: '#ffe0a8', a: .1 });
  const extra = G.weather.type === 'rain' ? .14 : G.weather.type === 'cloudy' ? .05 : G.weather.type === 'snow' ? .02 : 0;
  drawLighting(ctx, lights, t, { extraDark: (dk > .02 ? extra : extra * .6) * (G.wx ? 1 : 0), toScreen: worldToScreen });
  drawWeather(ctx, t, dt);
}

function drawGrid(c, g) {
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
  c.beginPath();
  const x0 = Math.max(0, Math.floor(g.x) - 5), x1 = Math.min(N, Math.floor(g.x) + 6), y0 = Math.max(0, Math.floor(g.y) - 5), y1 = Math.min(N, Math.floor(g.y) + 6);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (Math.hypot(x - g.x, y - g.y) > 6) continue;
    const X = (x - y) * HW, Y = (x + y) * HH;
    c.moveTo(X, Y); c.lineTo(X + HW, Y + HH); c.lineTo(X, Y + 2 * HH); c.lineTo(X - HW, Y + HH); c.closePath();
  }
  c.stroke();
}

function drawOverlays(c, o, t) {
  // связи выделенной постройки
  if (R.links.length) {
    c.lineWidth = 2.4; c.setLineDash([6, 5]); c.lineDashOffset = -t * 14;
    for (const l of R.links) {
      const a = proj(l.a.x + l.a.w / 2, l.a.y + l.a.d / 2, 14), b = proj(l.b.x + l.b.w / 2, l.b.y + l.b.d / 2, 14);
      c.strokeStyle = l.col; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    c.setLineDash([]);
  }
  // выделение
  const sel = R.sel;
  if (sel) {
    const a = .55 + .25 * Math.sin(t * 5);
    diamond(c, sel.x, sel.y, sel.w || 1, sel.d || 1, `rgba(255,236,160,${a * .25})`, `rgba(255,226,120,${a})`, 2.2);
  }
  if (R.hover && !R.ghost) diamond(c, R.hover.x, R.hover.y, R.hover.w || 1, R.hover.d || 1, 'rgba(255,255,255,.14)', 'rgba(255,255,255,.55)', 1.5);
  // призрак постройки
  const g = R.ghost;
  if (g) {
    const def = g.def;
    c.save(); c.globalAlpha = g.valid ? .72 : .4;
    if (def.draw && !def.terraform) {
      const fake = g.fake;
      const sx = (g.x - g.y) * HW, sy = (g.x + g.y) * HH;
      const s = getSprite(`${def.id}|${g.rot ? 1 : 0}|${o.season}|${g.cw}x${g.cd}|G|${def.key ? safeKey(def, fake, o) : ''}`, g.w, g.d, def.h, (gg) => { setSwap(!!g.rot); def.draw(gg, fake, o); setSwap(false); });
      drawSprite(c, s, sx, sy - 2 - Math.sin(t * 4) * 1.5);
    }
    c.restore();
    for (let j = 0; j < g.d; j++) for (let i = 0; i < g.w; i++) {
      const bad = g.badTiles && g.badTiles.has((g.y + j) * N + g.x + i);
      diamond(c, g.x + i, g.y + j, 1, 1, bad || !g.valid ? 'rgba(240,80,70,.34)' : 'rgba(110,230,120,.30)', bad || !g.valid ? 'rgba(255,110,100,.9)' : 'rgba(150,255,160,.85)', 1.5);
    }
    for (const l of g.links || []) {
      const a = proj(g.x + g.w / 2, g.y + g.d / 2, 10), b = proj(l.b.x + l.b.w / 2, l.b.y + l.b.d / 2, 10);
      c.setLineDash([5, 4]); c.lineDashOffset = -t * 14; c.strokeStyle = l.col; c.lineWidth = 2.4; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
      diamond(c, l.b.x, l.b.y, l.b.w, l.b.d, null, l.col, 2);
    }
    if (g.radius) { const [X, Y] = proj(g.x + g.w / 2, g.y + g.d / 2, 0); c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([4, 5]); c.lineWidth = 1.6; c.beginPath(); c.ellipse(X, Y, g.radius * 45.25, g.radius * 22.6, 0, 0, 7); c.stroke(); c.setLineDash([]); }
  }
  if (G.scene === 'world') drawWorkRing(c, G.player);
  // значки состояния над постройками
  c.textAlign = 'center'; c.font = '14px sans-serif';
  for (const b of G.bMap.values()) {
    const def = BDEF[b.t]; if (!def.badge) continue;
    const ic = def.badge(b); if (!ic) continue;
    const [X, Y] = proj(b.x + b.w / 2, b.y + b.d / 2, Math.min(def.h, 70) + 16 + Math.sin(t * 3 + b.id) * 2.5);
    c.fillStyle = 'rgba(255,250,240,.92)'; c.beginPath(); c.arc(X, Y - 4, 11, 0, 7); c.fill(); c.strokeStyle = 'rgba(120,90,60,.35)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#000'; c.fillText(ic, X, Y + 1);
  }
  // ресурсы, готовые к сбору
  for (const n of G.nodeMap.values()) if (n.t === 'appletree' && n.fruit && n.st === 'full') { /* яблоки видны на спрайте */ }
}
const safeKey = (def, fake, o) => { try { return def.key(fake, o); } catch (e) { return ''; } };
