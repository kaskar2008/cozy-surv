// Отрисовка наружной сцены: 3D (three) — земля, ресурсы, постройки, существа; поверх — 2D-оверлей: подсветка, значки, свет и погода.
import * as THREE from 'three';
import { G, N, season, darkness, hour } from '../game/state.js';
import { BDEF } from '../data/buildings/index.js';
import { NDEF } from '../data/nodes.js';
import { setSwap, hz } from '../core/iso.js';
import { easeOutBack } from '../core/util.js';
import { cam, worldToScreen, viewTiles, updateCam } from './camera.js';
import { initGL, syncCamera, setSun, setBg, scene, renderer, camera3 } from './gl.js';
import { updateTerrain, drawSparkles, WATER_BG } from './terrain.js';
import { getModel, Instancer, DynBatch, MAT } from './models.js';
import { buildPlayer, buildPet, buildTraveler, drawWorkRing, drawPetBubble, drawZ, drawGift } from './entities.js';
import { drawParts, drawAmbient } from './fx.js';
import { drawLighting } from './lighting.js';
import { drawWeather } from './weather.js';
import { isHot } from '../game/nets.js';
import { workProgress } from '../game/progress.js';
import { buildConstruction, constructPose } from './construct.js';
import { mark, now as pnow } from '../core/prof.js';

// Состояние отрисовки, которое задают ввод и UI
export const R = { hover: null, ghost: null, sel: null, links: [], grid: false, time: 0 };

export const roots = { world: null, room: null };
let inst = null, dyn = null;
export function initScene(glCanvas) {
  initGL(glCanvas);
  roots.world = new THREE.Group(); roots.room = new THREE.Group(); roots.room.visible = false;
  scene.add(roots.world, roots.room);
  inst = new Instancer(roots.world); dyn = new DynBatch(roots.world);
}
const nowS = () => performance.now() / 1000;

// ───────── модели ─────────
function bldModel(b, def, o) {
  const key = `${def.id}|${b.rot ? 1 : 0}|${o.season}|${b.cw}x${b.cd}|${def.key ? def.key(b, o) : ''}`;
  return getModel(key, b.w, b.d, def.h, (c) => { setSwap(!!b.rot); def.draw(c, b, o); setSwap(false); });
}
function nodeModel(n, def, o) {
  return getModel(`${n.t}|${def.key(n, o)}`, 1, 1, def.h, (c) => def.draw(c, n, o));
}
export { bldModel };

const lightOn = (b, def, o) => {
  const w = def.light.on;
  return w === 'lit' ? isHot(b) : w === 'dusk' ? o.dusk : w === 'power' ? (b.st.powered && o.dusk) : true;
};

// ───────── призрак постройки: полупрозрачная копия модели ─────────
const ghostMats = [new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .72, depthWrite: false, color: '#d8ffd8', side: THREE.DoubleSide }),
  new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: .55, depthWrite: false, color: '#ffb0a8', side: THREE.DoubleSide })];
const ghostSets = new Map();
export function showGhost(root, model, x, y, valid, lift = 0) {
  let set = ghostSets.get(model.key + root.id);
  if (!set) {
    set = new THREE.Group(); set.userData.ghost = true;
    for (const p of model.parts) if (p.mat === MAT.lit || p.mat === MAT.tr) { const m = new THREE.Mesh(p.geo, ghostMats[0]); m.renderOrder = 3; set.add(m); }
    root.add(set); ghostSets.set(model.key + root.id, set);
  }
  set.visible = true; set.position.set(x, lift, y);
  for (const m of set.children) m.material = ghostMats[valid ? 0 : 1];
  set.userData.frame = roots.frame;
}
export function hideGhosts(root) {
  for (const s of ghostSets.values()) if (s.parent === root && s.userData.frame !== roots.frame) s.visible = false;
}
roots.frame = 0;

// ───────── основной кадр ─────────
export function renderWorld(ctx, t, dt) {
  roots.frame++;
  roots.world.visible = true; roots.room.visible = false;
  const season_ = season(), dk = darkness(), dpr = cam.dpr;
  const o = { season: season_, dusk: dk > .22, night: dk > .55, raining: G.weather.type === 'rain', t };
  updateCam(); setBg(WATER_BG);
  syncCamera(); setSun(hour(), dk, o.raining);
  let p0 = pnow();
  updateTerrain(roots.world, season_); p0 = mark('r.terrain', p0);

  inst.begin(); dyn.b.reset();
  const lights = [], c = dyn.b;
  for (const b of G.bMap.values()) {
    const def = BDEF[b.t];
    if (def.draw && !def.terraform) {
      let sy = 1, sxz = 1, lift = 0, hide = false;
      if (b.bld) { const ps = constructPose(b, def); sy = ps.sy ?? 1; sxz = ps.sxz ?? 1; lift = ps.lift || 0; hide = !!ps.hide; }
      if (b.pop !== undefined) {
        const age = nowS() - b.pop;
        if (age < 0.5) { const k = easeOutBack(Math.min(1, age / .45)); sy *= Math.max(.05, k); sxz *= .8 + .2 * k; } else delete b.pop;
      }
      if (!hide) inst.add(bldModel(b, def, o), b.x, b.y, sy, sxz, b.w / 2, b.d / 2, lift);
    }
    c.setRot(0); c.ox = c.oy = c.oz = 0;
    if (b.bld) buildConstruction(c, b, def, !!def.draw && !def.terraform);
    else if (def.anim) { c.ox = b.x; c.oy = b.y; setSwap(!!b.rot); try { def.anim(c, b, t, o); } catch (e) { /* деталь анимации не должна ронять кадр */ } setSwap(false); c.ox = c.oy = 0; }
    if (def.light && !b.bld && lightOn(b, def, o)) lights.push({ x: b.x + b.w / 2, y: b.y + b.d / 2, z: 24, r: def.light.r, col: def.light.col, f: def.light.flick ? 1 + Math.sin(t * 9 + b.id) * .025 * def.light.flick + Math.sin(t * 23 + b.id * 3) * .015 : 1 });
    else if (def.home && !b.bld && b.st.glow && o.dusk) lights.push({ x: b.x + b.w / 2, y: b.y + b.d / 2, z: 20, r: 2.2 + b.w * .5, col: '#ffcf80', a: .8 });
  }
  for (const n of G.nodeMap.values()) {
    const def = NDEF[n.t];
    let dx = 0;
    if (n.shk && nowS() - n.shk < .45) dx = Math.sin(nowS() * 60) * .05 * (1 - (nowS() - n.shk) / .45);
    inst.add(nodeModel(n, def, o), n.x + dx, n.y);
  }
  const pl = G.player || G.player;
  if (G.scene === 'world') { buildPlayer(c, pl, t); }
  for (const p of G.pets) if (!p.in) buildPet(c, p, t);
  if (G.npc) buildTraveler(c, G.npc, t);
  c.setRot(0); c.ox = c.oy = c.oz = 0;
  p0 = mark('r.collect', p0);

  // призрак постройки в 3D
  const g = R.ghost;
  if (g && g.def.draw && !g.def.terraform) {
    const def = g.def, fake = g.fake;
    let key = '';
    try { key = def.key ? def.key(fake, o) : ''; } catch (e) { key = ''; }
    const m = getModel(`${def.id}|${g.rot ? 1 : 0}|${o.season}|${g.cw}x${g.cd}|G|${key}`, g.w, g.d, def.h, (cc) => { setSwap(!!g.rot); def.draw(cc, fake, o); setSwap(false); });
    showGhost(roots.world, m, g.x, g.y, g.valid, hz(2) + Math.abs(Math.sin(t * 4)) * .04);
  }
  hideGhosts(roots.world);

  dyn.flush(); inst.end();
  renderer.render(scene, camera3);
  p0 = mark('r.gl', p0);

  // ── 2D-оверлей ──
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cam.W * dpr, cam.H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSparkles(ctx, t);
  drawOverlays(ctx, o, t);
  drawAmbient(ctx, t);
  drawParts(ctx); p0 = mark('r.overlays', p0);
  if (G.scene === 'world') lights.push({ x: pl.x, y: pl.y, z: 20, r: 2.0, col: '#ffe0a8', a: .35 });
  for (const p of G.pets) if (p.sleep === false) lights.push({ x: p.x, y: p.y, z: 8, r: .8, col: '#ffe0a8', a: .1 });
  const extra = G.weather.type === 'rain' ? .14 : G.weather.type === 'cloudy' ? .05 : G.weather.type === 'snow' ? .02 : 0;
  drawLighting(ctx, lights, t, { extraDark: (dk > .02 ? extra : extra * .6) * (G.wx ? 1 : 0), toScreen: worldToScreen }); p0 = mark('r.light', p0);
  drawWeather(ctx, t, dt); mark('r.weather', p0);
}

// ───────── 2D-подсветки и значки (в экранных координатах) ─────────
const sp = worldToScreen;
function dia(c, x, y, w, d, fill, stroke, lw = 1.5, z = 0) {
  const a = sp(x, y, z), b = sp(x + w, y, z), cc = sp(x + w, y + d, z), e = sp(x, y + d, z);
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(cc[0], cc[1]); c.lineTo(e[0], e[1]); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
export { dia };
function drawGrid(c, g) {
  c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; c.beginPath();
  const x0 = Math.max(0, Math.floor(g.x) - 5), x1 = Math.min(N, Math.floor(g.x) + 6), y0 = Math.max(0, Math.floor(g.y) - 5), y1 = Math.min(N, Math.floor(g.y) + 6);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (Math.hypot(x - g.x, y - g.y) > 6) continue;
    const a = sp(x, y, .5), b = sp(x + 1, y, .5), d = sp(x + 1, y + 1, .5), e = sp(x, y + 1, .5);
    c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath();
  }
  c.stroke();
}

// Значок-эмодзи рисуется картинкой, а не текстом: при масштабе браузер сдвигает глиф, поэтому центр берём по реальным пикселям
const BG = 48, glyphs = new Map();
function badgeGlyph(ic) {
  let g = glyphs.get(ic); if (g) return g;
  const cv = document.createElement('canvas'); cv.width = cv.height = BG * 2;
  const x = cv.getContext('2d', { willReadFrequently: true }); x.font = `${BG}px sans-serif`; x.textAlign = 'center'; x.fillText(ic, BG, BG * 1.4);
  const d = x.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, x1 = 0, y0 = cv.height, y1 = 0;
  for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) if (d[(j * cv.width + i) * 4 + 3] > 40) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  g = { cv, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 }; glyphs.set(ic, g); return g;
}

function drawOverlays(c, o, t) {
  const zk = Math.max(.75, cam.zoom);
  // связи выделенной постройки
  if (R.links.length) {
    c.lineWidth = 2.4; c.setLineDash([6, 5]); c.lineDashOffset = -t * 14;
    for (const l of R.links) {
      const a = sp(l.a.x + l.a.w / 2, l.a.y + l.a.d / 2, 14), b = sp(l.b.x + l.b.w / 2, l.b.y + l.b.d / 2, 14);
      c.strokeStyle = l.col; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    c.setLineDash([]);
  }
  // выделение
  const sel = R.sel;
  if (sel) { const a = .55 + .25 * Math.sin(t * 5); dia(c, sel.x, sel.y, sel.w || 1, sel.d || 1, `rgba(255,236,160,${a * .25})`, `rgba(255,226,120,${a})`, 2.2, 1); }
  // приказ, отданный на паузе: путь и цель
  const pp = G.player.path;
  if (!G.speed && pp && pp.length && !G.player.sleeping) {
    const a = .6 + .3 * Math.sin(performance.now() / 1000 * 5), last = pp[pp.length - 1];
    c.save(); c.setLineDash([5, 6]); c.lineCap = 'round'; c.lineWidth = 2.2; c.strokeStyle = 'rgba(255,236,160,.8)'; c.beginPath();
    const s0 = sp(G.player.x, G.player.y, 1); c.moveTo(s0[0], s0[1]);
    for (const q of pp) { const s = sp(q.x + .5, q.y + .5, 1); c.lineTo(s[0], s[1]); }
    c.stroke(); c.restore();
    dia(c, last.x, last.y, 1, 1, `rgba(255,236,160,${a * .3})`, `rgba(255,226,120,${a})`, 2.2, 1);
  }
  if (R.hover && !R.ghost) dia(c, R.hover.x, R.hover.y, R.hover.w || 1, R.hover.d || 1, 'rgba(255,255,255,.14)', 'rgba(255,255,255,.55)', 1.5, 1);
  // сетка и клетки под призраком
  const g = R.ghost;
  if (g) {
    if (R.grid) drawGrid(c, g);
    for (let j = 0; j < g.d; j++) for (let i = 0; i < g.w; i++) {
      const bad = g.badTiles && g.badTiles.has((g.y + j) * N + g.x + i);
      dia(c, g.x + i, g.y + j, 1, 1, bad || !g.valid ? 'rgba(240,80,70,.34)' : 'rgba(110,230,120,.30)', bad || !g.valid ? 'rgba(255,110,100,.9)' : 'rgba(150,255,160,.85)', 1.5, 1);
    }
    for (const l of g.links || []) {
      const a = sp(g.x + g.w / 2, g.y + g.d / 2, 10), b = sp(l.b.x + l.b.w / 2, l.b.y + l.b.d / 2, 10);
      c.setLineDash([5, 4]); c.lineDashOffset = -t * 14; c.strokeStyle = l.col; c.lineWidth = 2.4; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.setLineDash([]);
      dia(c, l.b.x, l.b.y, l.b.w, l.b.d, null, l.col, 2, 1);
    }
    if (g.radius) {
      const cx = g.x + g.w / 2, cy = g.y + g.d / 2;
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([4, 5]); c.lineWidth = 1.6; c.beginPath();
      for (let i = 0; i <= 48; i++) { const a = i / 48 * 6.2832, q = sp(cx + Math.cos(a) * g.radius, cy + Math.sin(a) * g.radius, 1); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }
      c.stroke(); c.setLineDash([]);
    }
  }
  if (G.scene === 'world') drawWorkRing(c, G.player);
  // пузырьки и значки существ
  for (const p of G.pets) if (!p.in) { drawPetBubble(c, p, t); if (p.sleep) drawZ(c, p, t, 14); }
  if (G.player.fx === 'sleep' || G.player.fx === 'nap') drawZ(c, G.player, t);
  if (G.npc?.gift) drawGift(c, G.npc, t);
  // значки состояния и мини-прогресс процессов над постройками
  c.textAlign = 'center'; c.font = `${14 * zk}px sans-serif`;
  const v = viewTiles(2);
  for (const b of G.bMap.values()) {
    if (b.x > v.x1 || b.y > v.y1 || b.x + b.w < v.x0 || b.y + b.d < v.y0) continue;
    const def = BDEF[b.t];
    const pr = workProgress(b, def);
    if (pr) {
      const [X, Y] = sp(b.x + b.w / 2, b.y + b.d / 2, Math.min(def.h, 70) + 6), w = 30 * zk, hh = 6 * zk;
      c.fillStyle = 'rgba(60,40,25,.55)'; c.beginPath(); c.roundRect(X - w / 2 - 1.5, Y - hh / 2 - 1.5, w + 3, hh + 3, 4); c.fill();
      c.fillStyle = pr.paused ? '#a09888' : pr.col; c.beginPath(); c.roundRect(X - w / 2, Y - hh / 2, Math.max(hh, w * pr.p), hh, 3); c.fill();
    }
    if (!def.badge || b.bld) continue;
    const ic = def.badge(b); if (!ic) continue;
    const [X, Y] = sp(b.x + b.w / 2, b.y + b.d / 2, Math.min(def.h, 70) + 16 + Math.sin(t * 3 + b.id) * 2.5);
    c.fillStyle = 'rgba(255,250,240,.92)'; c.beginPath(); c.arc(X, Y - 4 * zk, 11 * zk, 0, 7); c.fill(); c.strokeStyle = 'rgba(120,90,60,.35)'; c.lineWidth = 1; c.stroke();
    const gl = badgeGlyph(ic), k = 13 * zk / BG; c.drawImage(gl.cv, X - gl.cx * k, Y - 4 * zk - gl.cy * k, gl.cv.width * k, gl.cv.height * k);
  }
}
