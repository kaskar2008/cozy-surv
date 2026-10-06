// Прототип: тот же набор объектов рисуется (слева) 2D-кодом игры и (справа) через Three.js.
import * as THREE from 'three';
import { BDEF } from '../js/data/buildings/index.js';
import { NDEF } from '../js/data/nodes.js';
import { getSprite, drawSprite } from '../js/core/sprites.js';
import { HW, HH, setSwap } from '../js/core/iso.js';
import { mulberry32 } from '../js/core/util.js';
import { getModel, mergeParts, baseGeo, KX, KZ, hz } from './models.js';

const $ = (s) => document.querySelector(s);
const OPT = { season: 0, dusk: false, night: false, raining: false, t: 0 };
const WATER = '#8cc6d9';
const TILE_COLS = ['#7fbf68', '#78b862', '#86c570'];
const cam = { u: 0, v: 0, zoom: 0.5 };
const st = { N: 300, mode: 'inst', shadows: false, freeze: false, dpr: Math.min(window.devicePixelRatio || 1, 2), world: null, busy: false };
const view = { W: 600, H: 500 };

// ───────────────────────────── мир ─────────────────────────────
const node = (t, v, mk) => ({ kind: 'node', t, w: 1, d: 1, mk, n: { t, st: 'full', v, fruit: false, id: 0 } });
const bld = (t, mk, o = {}) => {
  const [w, d] = BDEF[t].size || [1, 1];
  return { kind: 'bld', t, w, d, mk, b: { id: 0, t, x: 0, y: 0, w, d, cw: w, cd: d, rot: 0, lvl: 1, mask: 0, st: { plots: [{ crop: null, prog: 0, moist: 0 }], lit: true, fuel: 500, powered: false }, ...o } };
};
const run = (id, mk) => (r) => {
  const L = 3 + Math.floor(r() * 5), alongY = r() < .5, items = [];
  for (let i = 0; i < L; i++) {
    const mask = alongY ? (i === 0 ? 4 : i === L - 1 ? 1 : 5) : (i === 0 ? 2 : i === L - 1 ? 8 : 10);
    const o = bld(id, `${mk}:${mask}`, { mask });
    o.dx = alongY ? 0 : i; o.dy = alongY ? i : 0; items.push(o);
  }
  return items;
};
const treeV = (k, r) => k + 3 * Math.floor(r() * 5);
const CATALOG = [
  [8, (r) => [node('tree', treeV(0, r), 'oak')]],
  [7, (r) => [node('tree', treeV(1, r), 'pine')]],
  [5, (r) => [node('tree', treeV(2, r), 'birch')]],
  [8, (r) => [node('bush', Math.floor(r() * 30), 'bush')]],
  [2, (r) => [node('boulder', Math.floor(r() * 15), 'boulder')]],
  [4, (r) => [node('rock', Math.floor(r() * 15), 'rock')]],
  [9, (r) => [node('fibergrass', Math.floor(r() * 9), 'fiber')]],
  [7, (r) => [node('flowers', Math.floor(r() * 5), 'flowers')]],
  [2, () => [bld('campfire', 'campfire')]],
  [2, () => [bld('log_seat', 'log_seat')]],
  [2, () => [bld('bench', 'bench')]],
  [3, () => [bld('barrel', 'barrel')]],
  [3, () => [bld('crate', 'crate')]],
  [2, () => [bld('raised_bed', 'raised_bed')]],
  [3, () => [bld('lamp_post', 'lamp_post')]],
  [1, () => [bld('shed', 'shed')]],
  [1, () => [bld('home', 'home')]],
  [1, () => [bld('well', 'well')]],
  [1.6, run('fence', 'fence')],
  [.8, run('hedge', 'hedge')],
];
const CAT_TOTAL = CATALOG.reduce((s, c) => s + c[0], 0);

function genWorld(N, seed = 7) {
  const S = Math.max(24, Math.ceil(Math.sqrt(N / 0.5)));
  const r = mulberry32(seed + N), occ = new Uint8Array(S * S), objs = [];
  const free = (x, y, w, d) => { for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) if (occ[(y + j) * S + x + i]) return false; return true; };
  while (objs.length < N) {
    let pick = r() * CAT_TOTAL, c = CATALOG[0];
    for (const e of CATALOG) { pick -= e[0]; if (pick <= 0) { c = e; break; } }
    const items = c[1](r);
    const bw = Math.max(...items.map((o) => (o.dx || 0) + o.w)), bd = Math.max(...items.map((o) => (o.dy || 0) + o.d));
    let x = 0, y = 0;
    for (let a = 0; a < 10; a++) {
      x = Math.floor(r() * (S - bw + 1)); y = Math.floor(r() * (S - bd + 1));
      if (free(x, y, bw, bd)) break;
    }
    for (let j = 0; j < bd; j++) for (let i = 0; i < bw; i++) occ[(y + j) * S + x + i] = 1;
    for (const o of items) {
      o.x = x + (o.dx || 0); o.y = y + (o.dy || 0);
      if (o.b) { o.b.x = o.x; o.b.y = o.y; }
      o.k = o.x + o.w / 2 + o.y + o.d / 2 + (o.y + o.d) * 0.001;
      const v = o.n ? o.n.v : 0;
      o.tint = o.kind === 'node' && o.t === 'tree' ? 1 + (Math.floor((v % 15) / 3) - 2) * .04 : 1 + (r() - .5) * .06;
      objs.push(o);
    }
  }
  objs.sort((a, b) => a.k - b.k);
  return { S, objs };
}

// ───────────────────────────── 2D (как в игре) ─────────────────────────────
const c2d = $('#c2d'), ctx = c2d.getContext('2d');
const probe = document.createElement('canvas'); probe.width = probe.height = 1;
const pctx = probe.getContext('2d', { willReadFrequently: true });
let ground = null;

function buildGround2D(S) {
  const full = S * 64, sc = Math.min(1, 4096 / full);
  const cv = document.createElement('canvas'); cv.width = Math.ceil(full * sc); cv.height = Math.ceil(S * 32 * sc) + 2;
  const g = cv.getContext('2d'); g.setTransform(sc, 0, 0, sc, S * HW * sc, 0);
  g.lineWidth = 1.2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const col = TILE_COLS[(x * 7 + y * 13) % 3];
    g.fillStyle = g.strokeStyle = col;
    g.beginPath(); g.moveTo((x - y) * HW, (x + y) * HH); g.lineTo((x + 1 - y) * HW, (x + y + 1) * HH);
    g.lineTo((x - y) * HW, (x + y + 2) * HH); g.lineTo((x - 1 - y) * HW, (x + y + 1) * HH); g.closePath(); g.fill(); g.stroke();
  }
  ground = { cv, ox: -S * HW, oy: 0, w: full, h: cv.height / sc };
}

// те же ключи и вызовы, что в js/render/scene.js
function bldSprite(b, def, o) {
  const key = `${def.id}|${b.rot ? 1 : 0}|${o.season}|${b.cw}x${b.cd}|${def.key ? def.key(b, o) : ''}`;
  return getSprite(key, b.w, b.d, def.h, (g) => { setSwap(!!b.rot); def.draw(g, b, o); setSwap(false); });
}
function nodeSprite(n, def, o) {
  return getSprite(`${n.t}|${def.key(n, o)}`, 1, 1, def.h, (g) => def.draw(g, n, o));
}

function render2D(t) {
  const { W, H } = view, dpr = st.dpr, z = cam.zoom, c = ctx;
  OPT.t = t;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = WATER; c.fillRect(0, 0, W * dpr, H * dpr);
  c.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.u * z), dpr * (H / 2 - cam.v * z));
  c.drawImage(ground.cv, ground.ox, ground.oy, ground.w, ground.h);
  const x0 = cam.u - W / 2 / z, x1 = cam.u + W / 2 / z, y0 = cam.v - H / 2 / z, y1 = cam.v + H / 2 / z;
  const objs = st.world.objs;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    const sx = (o.x - o.y) * HW, sy = (o.x + o.y) * HH, ext = (o.w + o.d) * HW;
    if (sx + ext < x0 || sx - ext > x1 || sy + (o.w + o.d) * HH + 20 < y0 || sy - 200 > y1) continue;
    if (o.n) drawSprite(c, nodeSprite(o.n, NDEF[o.t], OPT), sx, sy);
    else {
      const def = BDEF[o.t];
      drawSprite(c, bldSprite(o.b, def, OPT), sx, sy);
      if (def.anim) { c.save(); c.translate(sx, sy); def.anim(c, o.b, t, OPT); c.restore(); }
    }
  }
}

// ───────────────────────────── 3D ─────────────────────────────
const glHost = $('#gl');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setClearColor(WATER);
glHost.appendChild(renderer.domElement);
const gl = renderer.getContext(), px4 = new Uint8Array(4);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 1200);
const matVC = new THREE.MeshLambertMaterial({ vertexColors: true });
const matCache = new Map();
const matFor = (col) => { let m = matCache.get(col); if (!m) matCache.set(col, m = new THREE.MeshLambertMaterial({ color: col })); return m; };
const flameMats = [new THREE.MeshBasicMaterial({ color: '#ff8a2a' }), new THREE.MeshBasicMaterial({ color: '#ffc83a' })];
let flames = null, owned = [], sun = null;

const EL = Math.PI / 6;
const camDir = new THREE.Vector3();
let az = Math.PI / 4, azT = az;   // азимут камеры: текущий и целевой (поворот шагами по 90°)
function sync3D() {
  camDir.set(Math.cos(EL) * Math.sin(az), Math.sin(EL), Math.cos(EL) * Math.cos(az));
  const k = KX * cam.zoom, hw = view.W / 2 / k, hh = view.H / 2 / k;
  camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh; camera.updateProjectionMatrix();
  const x = (cam.u / HW + cam.v / HH) / 2, y = (cam.v / HH - cam.u / HW) / 2;
  camera.position.set(x, 0, y).addScaledVector(camDir, 400);
  camera.lookAt(x, 0, y);
}

function clear3D() {
  for (const o of owned) o.dispose();
  owned = []; flames = null;
  scene.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  scene.clear();
}
const own = (x) => { owned.push(x); return x; };

function build3D() {
  clear3D();
  const { S, objs } = st.world, mode = st.mode;
  renderer.shadowMap.enabled = st.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.add(new THREE.HemisphereLight('#fff6e0', '#8a9a6a', st.shadows ? 1.0 : 1.35));
  sun = new THREE.DirectionalLight('#fff0d0', st.shadows ? 1.5 : 1.1);
  sun.position.set(S / 2 - 30, 60, S / 2 + 20); sun.target.position.set(S / 2, 0, S / 2);
  if (st.shadows) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const e = S * 0.78; Object.assign(sun.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 300 }); sun.shadow.bias = -0.0008;
  }
  scene.add(sun, sun.target);

  // земля: один меш, цвет по клеткам
  const pos = [], col = [], cc = new THREE.Color();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    cc.set(TILE_COLS[(x * 7 + y * 13) % 3]);
    for (const [dx, dy] of [[0, 0], [0, 1], [1, 1], [0, 0], [1, 1], [1, 0]]) { pos.push(x + dx, 0, y + dy); col.push(cc.r, cc.g, cc.b); }
  }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gg.computeVertexNormals();
  const ground3 = new THREE.Mesh(gg, matVC); ground3.receiveShadow = true; scene.add(ground3);

  const shadowOn = st.shadows;
  if (mode === 'naive') {
    for (const o of objs) {
      const g = new THREE.Group(); g.position.set(o.x, 0, o.y);
      for (const p of getModel(o.mk).parts) {
        const m = new THREE.Mesh(baseGeo(p.k), matFor(p.col));
        m.geometry.userData.shared = true;
        m.position.set(...p.p); m.scale.set(...p.s); if (p.q) m.quaternion.copy(p.q);
        g.add(m);
      }
      scene.add(g);
    }
  } else if (mode === 'merged') {
    const geos = new Map();
    for (const o of objs) {
      let g = geos.get(o.mk);
      if (!g) { g = mergeParts(getModel(o.mk).parts); g.userData.shared = true; geos.set(o.mk, g); owned.push(g); }
      const m = new THREE.Mesh(g, matVC); m.position.set(o.x, 0, o.y); m.castShadow = shadowOn; scene.add(m);
    }
  } else {
    const groups = new Map();
    for (const o of objs) { let a = groups.get(o.mk); if (!a) groups.set(o.mk, a = []); a.push(o); }
    const M = new THREE.Matrix4(), C = new THREE.Color();
    for (const [mk, arr] of groups) {
      const g = own(mergeParts(getModel(mk).parts)); g.userData.shared = true;
      const im = new THREE.InstancedMesh(g, matVC, arr.length);
      arr.forEach((o, i) => { M.makeTranslation(o.x, 0, o.y); im.setMatrixAt(i, M); C.setRGB(o.tint, o.tint, o.tint); im.setColorAt(i, C); });
      im.frustumCulled = false; im.castShadow = shadowOn; scene.add(im);
    }
  }
  // анимированное пламя костров (как def.anim в 2D) — живёт отдельным инстансом
  const fires = objs.filter((o) => o.t === 'campfire');
  if (fires.length) {
    const f = [0, 1].map((i) => { const m = new THREE.InstancedMesh(own(new THREE.ConeGeometry(i ? .1 : .17, 1, 8)), flameMats[i], fires.length); m.frustumCulled = false; scene.add(m); return m; });
    flames = { f, fires };
  }
  if (st.freeze) {
    scene.updateMatrixWorld(true);
    scene.traverse((o) => { o.matrixAutoUpdate = false; });
    scene.matrixWorldAutoUpdate = false;
  } else scene.matrixWorldAutoUpdate = true;
}

const _fm = new THREE.Matrix4(), _fp = new THREE.Vector3(), _fq = new THREE.Quaternion(), _fs = new THREE.Vector3();
function render3D(t) {
  if (flames) {
    flames.fires.forEach((o, i) => {
      const s = 0.9 + 0.12 * Math.sin(t * 7 + i * 2.1), h = [hz(24), hz(15)];
      for (let k = 0; k < 2; k++) {
        _fp.set(o.x + .5, hz(6) + h[k] * s / 2, o.y + .5); _fs.set(0.9 + .1 * Math.sin(t * 9 + i), h[k] * s, 0.9 + .1 * Math.sin(t * 9 + i));
        _fm.compose(_fp, _fq, _fs); flames.f[k].setMatrixAt(i, _fm);
      }
    });
    flames.f.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
  }
  renderer.render(scene, camera);
}

// ───────────────────────────── размеры, камера, ввод ─────────────────────────────
function resize() {
  const p = $('#p2d'); view.W = Math.max(280, p.clientWidth); view.H = Math.max(280, p.clientHeight);
  c2d.width = Math.round(view.W * st.dpr); c2d.height = Math.round(view.H * st.dpr);
  c2d.style.width = view.W + 'px'; c2d.style.height = view.H + 'px';
  renderer.setPixelRatio(st.dpr); renderer.setSize(view.W, view.H);
  sync3D();
}
function fitCamera() {
  const S = st.world.S;
  cam.u = 0; cam.v = S * 16;
  cam.zoom = Math.min(view.W / (S * 64 + 80), view.H / (S * 32 + 240));
}
let drag = null;
for (const el of [c2d, renderer.domElement]) {
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (el === c2d) { cam.u -= dx / cam.zoom; cam.v -= dy / cam.zoom; }
    else {
      // сдвиг по земле с учётом поворота: «вправо» по экрану и «к камере»
      const k = KX * cam.zoom, gx = (cam.u / HW + cam.v / HH) / 2, gy = (cam.v / HH - cam.u / HW) / 2;
      const nx = gx - (dx / k) * Math.cos(az) - (dy / (k / 2)) * Math.sin(az), ny = gy + (dx / k) * Math.sin(az) - (dy / (k / 2)) * Math.cos(az);
      cam.u = (nx - ny) * HW; cam.v = (nx + ny) * HH;
    }
    drag = { x: e.clientX, y: e.clientY }; sync3D();
  });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = el.getBoundingClientRect(), px = el === c2d ? e.clientX - r.left : view.W / 2, py = el === c2d ? e.clientY - r.top : view.H / 2;
    const wu = cam.u + (px - view.W / 2) / cam.zoom, wv = cam.v + (py - view.H / 2) / cam.zoom;
    cam.zoom = Math.min(3, Math.max(0.05, cam.zoom * Math.exp(-e.deltaY * 0.0015)));
    cam.u = wu - (px - view.W / 2) / cam.zoom; cam.v = wv - (py - view.H / 2) / cam.zoom; sync3D();
  }, { passive: false });
}

// ───────────────────────────── замер ─────────────────────────────
const flush2D = () => { pctx.drawImage(c2d, 0, 0, 1, 1, 0, 0, 1, 1); pctx.getImageData(0, 0, 1, 1); };
const flush3D = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px4);
function timeIt(fn, flush) {
  for (let i = 0; i < 3; i++) fn(i * .016); flush();
  const t0 = performance.now(); let n = 0;
  do { fn(n * .016); n++; } while (n < 5 || (performance.now() - t0 < 350 && n < 80));
  const cpu = (performance.now() - t0) / n;
  flush();
  return { cpu, total: (performance.now() - t0) / n, n };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function useWorld(N) {
  st.N = N; st.world = genWorld(N);
  buildGround2D(st.world.S);
  fitCamera();
}
// первый кадр 2D: заполняет кэш спрайтов (в игре это разовая стоимость), поэтому в замер не входит
function rebuildScene() {
  const t0 = performance.now();
  build3D(); sync3D(); render3D(0); flush3D();
  return performance.now() - t0;
}

async function measure(cfg) {
  if (cfg === '2d') { render2D(0); const r = timeIt(render2D, flush2D); return { ms: r.total, cpu: r.cpu }; }
  const mode = cfg.split('+')[0]; st.mode = mode; st.shadows = cfg.endsWith('+shadow');
  const first = rebuildScene();
  const r = timeIt(render3D, flush3D);
  return { ms: r.total, cpu: r.cpu, first, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
}

const CFGS = [['2d', 'Canvas 2D'], ['naive', '3D: меш на часть'], ['merged', '3D: меш на объект'], ['inst', '3D: инстансинг'], ['inst+shadow', '3D: инстансинг + тени']];
const fmt = (r) => `<b>${r.ms.toFixed(1)} мс</b> <span>${Math.round(1000 / r.ms)} fps</span>` + (r.calls ? `<small>${r.calls} draw · ${(r.tris / 1000).toFixed(0)}k △ · cpu ${r.cpu.toFixed(1)} · 1-й кадр ${r.first.toFixed(0)} мс</small>` : `<small>cpu ${r.cpu.toFixed(1)}</small>`);
function renderTable(res) {
  const Ns = [...new Set(res.map((r) => r.N))];
  $('#table').innerHTML = '<tr><th>объектов</th>' + CFGS.map((c) => `<th>${c[1]}</th>`).join('') + '</tr>' + Ns.map((N) => {
    const row = res.filter((r) => r.N === N), best = Math.min(...row.map((r) => r.ms));
    return `<tr><th>${N}</th>` + CFGS.map(([id]) => { const r = row.find((x) => x.cfg === id); return r ? `<td class="${r.ms === best ? 'best' : ''}">${fmt(r)}</td>` : '<td>…</td>'; }).join('') + '</tr>';
  }).join('');
}

let live = true, results = [];
async function runMatrix(Ns) {
  live = false; st.busy = true; results = []; window.__results = results; $('#status').textContent = 'идёт прогон…';
  const keep = { N: st.N, mode: st.mode, shadows: st.shadows };
  for (const N of Ns) {
    useWorld(N);
    for (const [cfg] of CFGS) {
      $('#status').textContent = `прогон: ${N} объектов, ${cfg}`;
      await sleep(30);
      const m = await measure(cfg);
      results.push({ N, cfg, ...m }); renderTable(results);
    }
  }
  window.__done = true;
  Object.assign(st, keep); useWorld(keep.N); rebuildScene();
  $('#status').textContent = 'прогон завершён'; st.busy = false; live = true;
}

// ───────────────────────────── UI ─────────────────────────────
function ui() {
  $('#nbtns').innerHTML = [100, 300, 1000, 3000, 6000].map((n) => `<button data-n="${n}">${n}</button>`).join('');
  const mark = () => document.querySelectorAll('#nbtns button').forEach((b) => b.classList.toggle('on', +b.dataset.n === st.N));
  $('#nbtns').onclick = (e) => { const n = +e.target.dataset.n; if (!n) return; useWorld(n); rebuildScene(); mark(); };
  const rb = () => { rebuildScene(); };
  $('#mode').onchange = (e) => { st.mode = e.target.value; rb(); };
  $('#shadows').onchange = (e) => { st.shadows = e.target.checked; rb(); };
  $('#freeze').onchange = (e) => { st.freeze = e.target.checked; rb(); };
  $('#dpr').onchange = (e) => { st.dpr = +e.target.value; resize(); };
  $('#dpr').value = String(st.dpr);
  $('#bench').onclick = async () => {
    live = false; $('#status').textContent = 'замер…'; await sleep(30);
    const a = timeIt(render2D, flush2D), b = timeIt(render3D, flush3D);
    $('#status').textContent = `2D: ${a.total.toFixed(1)} мс/кадр · 3D (${st.mode}${st.shadows ? ', тени' : ''}): ${b.total.toFixed(1)} мс/кадр`;
    live = true;
  };
  const rot = (d) => { azT += d * Math.PI / 2; };
  $('#rotL').onclick = () => rot(-1); $('#rotR').onclick = () => rot(1);
  addEventListener('keydown', (e) => { if (e.key === 'q' || e.key === 'Q') rot(-1); if (e.key === 'e' || e.key === 'E') rot(1); });
  $('#matrix').onclick = () => runMatrix([100, 500, 2000, 6000]);
  mark();
}

let last = performance.now(), fps = 60, acc = 0, accN = 0, s2 = 0, s3 = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!live) return;
  if (az !== azT) { az += (azT - az) * 0.18; if (Math.abs(azT - az) < 0.002) az = azT; sync3D(); }
  const t = now / 1000, a = performance.now(); render2D(t); const b = performance.now(); render3D(t); const c = performance.now();
  fps += (1000 / Math.max(1, now - last) - fps) * 0.05; last = now;
  s2 += b - a; s3 += c - b; accN++;
  if (now - acc > 500) {
    $('#s2d').textContent = `cpu ${(s2 / accN).toFixed(1)} мс · ${st.world.objs.length} объектов`;
    $('#s3d').textContent = `cpu ${(s3 / accN).toFixed(1)} мс · ${renderer.info.render.calls} draw · ${(renderer.info.render.triangles / 1000).toFixed(0)}k △`;
    $('#fps').textContent = `${fps.toFixed(0)} fps (обе сцены в одном цикле)`;
    s2 = s3 = accN = 0; acc = now;
  }
}

window.proto = { st, cam, view, useWorld, rebuildScene, measure, runMatrix, renderer, scene };
ui(); resize(); useWorld(st.N); rebuildScene();
addEventListener('resize', () => { resize(); fitCamera(); sync3D(); });
requestAnimationFrame(frame);
