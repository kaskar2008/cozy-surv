// Интерьеры: вход/выход, расстановка мебели, действия с мебелью и отрисовка комнаты.
import { G, N, hour, darkness, season } from './state.js';
import { BDEF } from '../data/buildings/index.js';
import { FDEF, WALLH, WALL_STYLES, FLOOR_STYLES } from '../data/furniture.js';
import * as eco from './eco.js';
import * as pl from './player.js';
import { S, toast, stat, addBuff, doAt, defOf, isBuilt, startSleep, takeWaterFor, waterAvailable } from './api.js';
import { ringTiles, walkable, inB } from './world.js';
import { isHot } from './nets.js';
import { itemName, itemIcon } from '../data/items.js';
import { STATIONS } from '../data/recipes.js';
import * as fx from '../render/fx.js';
import * as THREE from 'three';
import { cam, screenToWorld, worldToScreen, centerOn, panScreen, resetAz } from '../render/camera.js';
import { HW, HH, box, wallRect, diamond, setSwap, hz } from '../core/iso.js';
import { getModel, Instancer, DynBatch } from '../render/models.js';
import { syncCamera, setSun, setBg, renderer, scene, camera3 } from '../render/gl.js';
import { shade, hash2, rndi, pick, rnd } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { buildPlayer, buildPet, drawWorkRing, drawPetBubble, drawZ } from '../render/entities.js';
import { drawLighting } from '../render/lighting.js';
import { drawWeather } from '../render/weather.js';
import { R, roots, showGhost, hideGhosts, dia } from '../render/scene.js';
import { updateStation } from './sim.js';

S.furnDef = (id) => FDEF[id];
export const homeOf = () => (G.scene === 'world' ? null : G.bMap.get(G.scene) || null);
export const doorOf = (b) => ({ x: b.in.w - 1, y: b.in.d - 1 });

// ---------------------------------------------------------------- состояние комнаты
export function proxyOf(home, it) {
  if (!it._px) it._px = { id: home.id, t: it.t, def: FDEF[it.t], isItem: true, it };
  const p = it._px; p.st = it.st; p.x = it.x; p.y = it.y; p.w = it.w; p.d = it.d; p.nb = home.nb; p.home = home;
  return p;
}
export function rebuildInterior(b) {
  const W = b.in.w, D = b.in.d, occ = new Uint8Array(W * D);
  for (const it of b.in.items) {
    const d = FDEF[it.t]; if (d.wall || d.walk || d.flat) continue;
    for (let j = 0; j < it.d; j++) for (let i = 0; i < it.w; i++) occ[(it.y + j) * W + it.x + i] = 1;
  }
  G.interior = { b, W, D, occ, blocked: (x, y) => x < 0 || y < 0 || x >= W || y >= D || occ[y * W + x] === 1, heat: false };
}
export function enterHome(b) {
  if (G.scene !== 'world') return;
  if (b.bld) { toast('Дом ещё строится', 'warn'); return; }
  pl.cancelAll();
  G.outCam = { tx: cam.tx, ty: cam.ty, zoom: cam.zoom, az: cam.azT }; G.outPos = { x: G.player.x, y: G.player.y };
  G.scene = b.id; rebuildInterior(b);
  const p = G.player, door = doorOf(b); p.x = door.x + .5; p.y = door.y + .5; p.path = [];
  const WH = WALLH[b.lvl - 1], spanX = (b.in.w + b.in.d) * HW + 80, spanY = (b.in.w + b.in.d) * HH + WH + 80;
  cam.zoom = Math.max(.7, Math.min(2.1, Math.min(cam.W * .86 / spanX, (cam.H - 220) / spanY)));
  resetAz(); cam.tx = b.in.w / 2; cam.ty = b.in.d / 2; panScreen(0, -WH * cam.zoom / 2 + 10);
  G.sel = null; R.sel = null; R.links = [];
  S.hooks.onSceneChange && S.hooks.onSceneChange();
  stat('enters');
}
export function exitHome() {
  const b = homeOf(); if (!b) return;
  const p = G.player; if (p.sleeping) return;
  pl.cancelAll();
  G.scene = 'world'; G.interior = null;
  const tx = b.x + b.w / 2, ty = b.y + b.d + 1;
  let best = null, bd = 1e9;
  for (const [x, y] of ringTiles(b.x, b.y, b.w, b.d)) if (walkable(x, y)) { const dd = Math.hypot(x + .5 - tx, y + .5 - ty); if (dd < bd) { bd = dd; best = [x, y]; } }
  if (best) { p.x = best[0] + .5; p.y = best[1] + .5; } else if (G.outPos) { p.x = G.outPos.x; p.y = G.outPos.y; }
  if (G.outCam && G.outCam.tx !== undefined) { cam.tx = G.outCam.tx; cam.ty = G.outCam.ty; cam.zoom = G.outCam.zoom; cam.az = cam.azT = G.outCam.az ?? Math.PI / 4; } else centerOn(p.x, p.y);
  G.sel = null; R.sel = null; R.links = [];
  S.hooks.onSceneChange && S.hooks.onSceneChange();
}

// ---------------------------------------------------------------- расстановка
const hasChimney = (home) => home.nb.some((o) => BDEF[o.t].tags.includes('chimney'));
export function furnLock(def) {
  const miss = def.req.filter((r) => !isBuilt(r)).map((r) => BDEF[r]?.name || FDEF[r]?.name || r);
  return miss.length ? 'Сначала построй: ' + miss.join(', ') : '';
}
export function canPlaceFurn(home, def, x, y, rot, wall) {
  if (def.seasons && !def.seasons.includes(season())) return { ok: false, reason: 'Только зимой' };
  if (def.needs?.includes('chimney') && !hasChimney(home)) return { ok: false, reason: 'Нужен дымоход, пристроенный снаружи' };
  const W = home.in.w, D = home.in.d;
  if (def.wall) {
    if (home.lvl === 1) return { ok: false, reason: 'В палатке стены не для украшений — улучши жильё' };
    const n = def.size[0], len = wall === 'a' ? W : D;
    if (x < 0 || x + n > len) return { ok: false, reason: 'Не помещается на стене' };
    const isWin = (id) => id === 'window' || id === 'window_big';
    for (const o of home.in.items) if (o.wall === wall) {
      if (x + n <= o.x || o.x + o.w <= x) continue;
      if ((def.id === 'curtains' && isWin(o.t)) || (isWin(def.id) && o.t === 'curtains')) continue;
      return { ok: false, reason: 'Место на стене занято' };
    }
    return { ok: true };
  }
  const sw = rot && def.size[0] !== def.size[1], w = sw ? def.size[1] : def.size[0], d = sw ? def.size[0] : def.size[1];
  if (x < 0 || y < 0 || x + w > W || y + d > D) return { ok: false, reason: 'За пределами комнаты' };
  const door = doorOf(home);
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
    if (!def.flat && !def.walk && x + i === door.x && y + j === door.y) return { ok: false, reason: 'Нельзя загораживать дверь' };
  }
  if (def.against) { if (!((!rot && y === 0) || (rot && x === 0))) return { ok: false, reason: 'Ставится вплотную к стене' }; }
  for (const o of home.in.items) {
    const od = FDEF[o.t]; if (od.wall) continue;
    const ov = !(x + w <= o.x || o.x + o.w <= x || y + d <= o.y || o.y + o.d <= y);
    if (!ov) continue;
    const flatA = def.flat || def.walk, flatB = od.flat || od.walk;
    if (flatA && flatB) return { ok: false, reason: 'Место занято' };
    if (!flatA && !flatB) return { ok: false, reason: 'Место занято' };
  }
  return { ok: true, w, d };
}
export function placeFurn(home, def, x, y, rot, wall) {
  const chk = canPlaceFurn(home, def, x, y, rot, wall);
  if (!chk.ok) { toast(chk.reason, 'warn'); sfx('no'); return null; }
  const lock = furnLock(def); if (lock) { toast(lock, 'warn'); return null; }
  if (!eco.canAfford(def.cost)) { toast('Не хватает: ' + eco.missing(def.cost).map(([k, v]) => `${v}${itemIcon(k)}`).join(' '), 'warn'); sfx('no'); return null; }
  eco.pay(def.cost);
  const it = { uid: (G.uid = (G.uid || 1) + 1), t: def.id, x, y, rot: rot ? 1 : 0, w: chk.w || def.size[0], d: chk.d || def.size[1], wall: wall || null, v: rndi(0, 9), st: {} };
  if (def.wall) { it.w = def.size[0]; it.d = 1; }
  if (def.burner) { it.st.fuel = 0; it.st.lit = false; }
  home.in.items.push(it);
  G.built[def.id] = (G.built[def.id] || 0) + 1; stat('furn');
  rebuildInterior(home);
  const p = G.player; if (G.interior.blocked(Math.floor(p.x), Math.floor(p.y))) nudgePlayer();
  it.pop = performance.now() / 1000; sfx('place'); fx.dust(x + it.w / 2, y + it.d / 2, 6);
  G.dirtyLinks = true;
  return it;
}
function nudgePlayer() {
  const p = G.player, g = G.interior;
  for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy; if (!g.blocked(x, y)) { p.x = x + .5; p.y = y + .5; return; } }
}
export function removeFurn(home, it) {
  const d = FDEF[it.t]; eco.refund(d.cost, 0.8);
  home.in.items = home.in.items.filter((o) => o !== it);
  rebuildInterior(home); sfx('remove'); G.dirtyLinks = true;
  if (G.sel && G.sel.uid === it.uid) G.sel = null;
}
export function setStyle(home, kind, v) { home.in[kind] = v; }

// курсор -> клетка / стена (для призрака мебели)
export function ghostAt(home, def, px, py, rot) {
  const W = home.in.w, D = home.in.d;
  if (def.wall) {
    const [wx, wy] = screenToWorld(px, py, 42);
    const n = def.size[0];
    let wall = null, slot = 0;
    const dA = Math.abs(wy), dB = Math.abs(wx);
    if (dA <= dB && wx > -.6 && wx < W + .6) { wall = 'a'; slot = Math.floor(wx - (n - 1) / 2 + .5); }
    else if (wy > -.6 && wy < D + .6) { wall = 'b'; slot = Math.floor(wy - (n - 1) / 2 + .5); }
    else return null;
    slot = Math.max(0, Math.min((wall === 'a' ? W : D) - n, slot));
    const chk = canPlaceFurn(home, def, slot, 0, 0, wall);
    return { def, wall, x: slot, y: 0, w: n, d: 1, rot: 0, valid: chk.ok, reason: chk.reason, kind: 'furn' };
  }
  const [wx, wy] = screenToWorld(px, py);
  const sw = rot && def.size[0] !== def.size[1], w = sw ? def.size[1] : def.size[0], d = sw ? def.size[0] : def.size[1];
  const x = Math.max(0, Math.min(W - w, Math.floor(wx - w / 2 + .5))), y = Math.max(0, Math.min(D - d, Math.floor(wy - d / 2 + .5)));
  const chk = canPlaceFurn(home, def, x, y, rot, null);
  return { def, x, y, w, d, rot: rot ? 1 : 0, valid: chk.ok, reason: chk.reason, kind: 'furn', wall: null };
}
// клик внутри комнаты
export function pickInterior(home, px, py) {
  const W = home.in.w, D = home.in.d;
  for (const z of [0, 14, 30, 48, 66]) {
    const [wx, wy] = screenToWorld(px, py, z), tx = Math.floor(wx), ty = Math.floor(wy);
    if (tx < 0 || ty < 0 || tx >= W || ty >= D) continue;
    let hit = null;
    for (const it of home.in.items) { const d = FDEF[it.t]; if (d.wall || d.flat || d.walk) continue; if (tx >= it.x && tx < it.x + it.w && ty >= it.y && ty < it.y + it.d && (z === 0 || d.h > z - 4)) hit = it; }
    if (hit) return { it: hit };
  }
  for (const z of [20, 40, 60, 78]) {
    const [wx, wy] = screenToWorld(px, py, z);
    if (Math.abs(wy) < .45 && wx >= 0 && wx < W) { const it = home.in.items.find((o) => o.wall === 'a' && wx >= o.x && wx < o.x + o.w); if (it) return { it }; }
    if (Math.abs(wx) < .45 && wy >= 0 && wy < D) { const it = home.in.items.find((o) => o.wall === 'b' && wy >= o.x && wy < o.x + o.w); if (it) return { it }; }
  }
  const [wx, wy] = screenToWorld(px, py);
  const tx = Math.floor(wx), ty = Math.floor(wy);
  if (tx >= 0 && ty >= 0 && tx < W && ty < D) {
    const flat = home.in.items.find((o) => (FDEF[o.t].flat || FDEF[o.t].walk) && tx >= o.x && tx < o.x + o.w && ty >= o.y && ty < o.y + o.d);
    return { tile: [tx, ty], flat };
  }
  return null;
}

// ---------------------------------------------------------------- шаг симуляции
export function lightOnIt(home, it, d) {
  const w = d.light?.on;
  return w === 'lit' ? isHot(proxyOf(home, it)) : w === 'power' ? !!home.st.powered : w === 'always';
}
export function interiorStep(dt) {
  fx.fxs.scope = null;
  for (const b of G.bMap.values()) {
    const def = BDEF[b.t]; if (!def.home) continue;
    let fire = false, lamp = false, heat = false;
    for (const it of b.in.items) {
      const d = FDEF[it.t], px = d.burner || d.station || d.music ? proxyOf(b, it) : null;
      if (d.burner && it.st.lit) {
        it.st.fuel -= dt;
        if (it.st.fuel <= 0) { it.st.fuel = 0; it.st.lit = false; if (G.scene === b.id) toast(`${d.name} догорел(а)`); }
        else { fire = true; heat = true; if (G.scene === b.id && Math.random() < dt * 1.5) { fx.fxs.scope = b.id; fx.spark(it.x + it.w / 2, it.y + it.d / 2, 18); } }
      }
      if (d.light && lightOnIt(b, it, d)) lamp = true;
      if (d.needs?.includes('power')) it.on = !!b.st.powered;
      if (d.station) { if (it.st.cur) heat = heat || t0(d); updateStation(px, d, dt); }
      if (d.music && it.st.on && b.st.powered) { if (G.scene === b.id) G.musicNear = true; }
      else if (d.music && it.st.on && !b.st.powered) it.st.on = false;
    }
    b.st.fireOn = fire; b.st.lampOn = lamp && darkness() > .2;
    if (G.scene === b.id && G.interior) G.interior.heat = heat || fire;
  }
  fx.fxs.scope = null;
}
const t0 = (d) => d.station === 'stove';

// мебель рядом (для бонусов)
S.diningNearby = () => {
  const h = homeOf(); if (!h) return false;
  const p = G.player;
  const near = (o) => Math.hypot(o.x + o.w / 2 - p.x, o.y + o.d / 2 - p.y) < 2.2;
  const tables = h.in.items.filter((o) => FDEF[o.t].dining && near(o));
  return tables.some((tb) => h.in.items.some((o) => FDEF[o.t].seat && Math.hypot(o.x + .5 - (tb.x + tb.w / 2), o.y + .5 - (tb.y + tb.d / 2)) < 2.2));
};

// ---------------------------------------------------------------- действия с мебелью
const goItem = (home, it, label, dur, fxName, fn) => {
  const ok = pl.goToRect(it.x, it.y, it.w, it.d, () => pl.startWork(label, dur, fxName, fn, { faceTo: [it.x + it.w / 2, it.y + it.d / 2] }));
  if (!ok) toast('Туда не пройти — проверь расстановку', 'warn');
};
const roomLit = (home) => home.st.lampOn || darkness() < .45 || home.in.items.some((it) => FDEF[it.t].light && lightOnIt(home, it, FDEF[it.t]));
export function furnActions(home, it) {
  const d = FDEF[it.t], acts = [], px = proxyOf(home, it);
  const A = (label, run, extra = {}) => acts.push({ label, run, ...extra });
  if (d.sleep) A(`Лечь спать (качество ×${d.sleep.q})`, () => {
    if (G.needs.energy > 92) { toast('Совсем не хочется спать'); return; }
    goItem(home, it, 'Укладываюсь', 1.2, 'pick', () => { const p = G.player; p.x = it.x + it.w / 2; p.y = it.y + it.d / 2 - .1; let q = d.sleep.q; if (G.cozy.list.some((l) => l.id === 'sleep_nook')) q += .25; startSleep('bed', q); });
  });
  if (d.sit) A('Посидеть', () => {
    const p = G.player;
    const ok = pl.goToRect(it.x, it.y, it.w, it.d, () => {
      const prev = { x: p.x, y: p.y }; p.x = it.x + it.w / 2; p.y = it.y + it.d / 2;
      pl.startWork('Отдыхаю', d.sit.dur, 'sit', () => { p.x = prev.x; p.y = prev.y; finishSitIt(d); }, { faceTo: [it.x + it.w / 2 + 1, it.y + it.d / 2 + 1] });
    });
    if (!ok) toast('Туда не пройти — проверь расстановку', 'warn');
  });
  const finishSitIt = (d) => {
    let m = d.sit.mood; const heat = G.interior?.heat; if (heat) m += 4;
    if (G.cozy.list.some((l) => l.id === 'fireside') && heat) m += 4;
    addBuff('mood', m, 160); G.needs.energy = Math.min(100, G.needs.energy + 4); stat('sat'); fx.hearts(G.player.x, G.player.y, 34); sfx('chime');
  };
  if (d.read) A('Почитать книгу', () => {
    if (!roomLit(home)) { toast('Темновато читать — зажги лампу или свечу', 'warn'); return; }
    goItem(home, it, 'Читаю', d.read.dur, 'read', () => { let m = d.read.mood; if (G.cozy.list.some((l) => l.id === 'reading_nook')) m += 6; addBuff('mood', m, 240); stat('read'); fx.sparkle(G.player.x, G.player.y, 30, '#fff6b0', 5); sfx('chime'); });
  });
  if (d.play) A('Играть музыку', () => goItem(home, it, 'Играю', d.play.dur, 'read', () => { addBuff('mood', d.play.mood, 300); stat('played'); sfx('chime'); for (let i = 0; i < 6; i++) setTimeout(() => fx.note(it.x + .5, it.y + .5, 40), i * 250); }));
  if (d.diary) A('Записать мысли в дневник', () => goItem(home, it, 'Пишу', 8, 'read', () => { addBuff('mood', 14, 240); stat('diary'); toast(pick(DIARY)); sfx('chime'); }));
  if (d.wardrobe) A('Переодеться…', () => S.hooks.openWardrobe && S.hooks.openWardrobe());
  if (d.bath) A('Принять ванну', () => {
    if (!G.interior.heat) { toast('В комнате прохладно — растопи камин или печку, вода согреется', 'warn'); return; }
    if (!takeWaterFor(home, 15)) { toast('Нет воды: подведи бак к дому (нужно 15)', 'warn'); return; }
    goItem(home, it, 'Принимаю ванну', 14, 'bathe', () => { G.needs.warmth = 100; addBuff('mood', 26, 360); addBuff('warm', 40, 240); stat('baths'); fx.sparkle(it.x + 1, it.y + .5, 24, '#bfe8ff', 10); sfx('chime'); });
  });
  if (d.sink) {
    const w = waterAvailable(home);
    A(`Набрать ведро (в сети: ${Math.floor(w)}💧)`, () => { if (!eco.has('bucket')) { toast('Нужно ведро', 'warn'); return; } if (w < 1) { toast('Воды нет: подведи бак вплотную к дому', 'warn'); return; } goItem(home, it, 'Набираю', 1.4, 'pick', () => { const k = Math.min(5, eco.space('water'), Math.floor(waterAvailable(home))); if (k > 0 && takeWaterFor(home, k)) { eco.add('water', k); fx.floatText(it.x + .5, it.y + .5, `+${k}💧`, '#cfeaff', 40); sfx('splash'); } }); }, { off: w < 1 });
    A('Попить из крана', () => { if (!takeWaterFor(home, 3)) { toast('Воды нет', 'warn'); return; } goItem(home, it, 'Пью', 1.6, 'pick', () => { G.needs.thirst = Math.min(100, G.needs.thirst + 38); stat('drinks'); sfx('splash'); }); }, { off: w < 3 });
  }
  if (d.music) A(it.st.on ? 'Выключить музыку' : 'Включить музыку', () => { if (!home.st.powered) { toast('Нет тока — подведи провода к дому', 'warn'); return; } it.st.on = !it.st.on; if (it.st.on) stat('music'); });
  return acts;
}
const DIARY = ['«Сегодня опять ничего не случилось. Прекрасный день.»', '«Огонь трещит, чай греет руки. Что ещё нужно?»', '«Посадил морковку. Теперь жду. Учусь ждать.»', '«Дождь стучит по крыше — лучшая музыка.»', '«Кажется, я нашёл своё место.»', '«Звёзды сегодня ближе обычного.»', '«Хорошо, когда никуда не надо бежать.»', '«Пахнет хлебом. Дом — это запах хлеба.»'];

// ---------------------------------------------------------------- отрисовка комнаты (3D)
let roomInst = null, roomDyn = null;
const wallTex = new Map();   // uid предмета -> { cv, tex, mesh, last, used }
const TEX_S = 2;

// оболочка комнаты: пол плитками, подиум, две задние стены с отделкой
function roomModel(home) {
  const W = home.in.w, D = home.in.d, lvl = home.lvl, WH = WALLH[lvl - 1];
  const key = `room|${home.id}|${lvl}|${home.in.wall}|${home.in.floor}|${W}x${D}`;
  return getModel(key, W, D, WH, (c) => {
    setSwap(false);
    const wallCol = lvl === 1 ? '#d9b878' : WALL_STYLES[home.in.wall % WALL_STYLES.length];
    const fl = lvl === 1 ? ['#8a6a48', '#7d5f40'] : FLOOR_STYLES[home.in.floor % FLOOR_STYLES.length];
    box(c, 0, 0, -9, W, D, 8.6, shade(fl[0], -.35));
    for (let j = 0; j < D; j++) for (let i = 0; i < W; i++) {
      const k = hash2(i, j, 4);
      let col = fl[(i + j) % 2];
      if (!(home.in.floor % 5 === 3 && lvl > 1)) col = shade(col, (k - .5) * .06);
      diamond(c, i, j, 1, 1, col, null, 1, 0);
    }
    box(c, -.16, -.16, 0, W + .16, .16, WH, wallCol);
    box(c, -.16, 0, 0, .16, D, WH, wallCol);
    const wain = lvl === 1 ? shade(wallCol, -.1) : shade(wallCol, -.12);
    wallRect(c, 'L', 0, 0, W, 0, 24, wain); wallRect(c, 'R', 0, 0, D, 0, 24, shade(wain, -.18));
    wallRect(c, 'L', 0, 0, W, 22, 25, shade(wain, -.2)); wallRect(c, 'R', 0, 0, D, 22, 25, shade(wain, -.38));
    wallRect(c, 'L', 0, 0, W, WH - 4, WH, shade(wallCol, -.1)); wallRect(c, 'R', 0, 0, D, WH - 4, WH, shade(wallCol, -.3));
  });
}
const furnModel = (it, d, o) => getModel(`f|${it.t}|${it.rot}|${it.v}|${d.key ? d.key(it) : ''}|${it.w}x${it.d}`, it.w, it.d, d.h, (c) => { setSwap(!!it.rot); d.draw(c, { ...it, cw: d.size[0], cd: d.size[1] }, o); setSwap(false); });

// настенный предмет — текстура на стене (рисуется прежним 2D-кодом в плоскости стены: u вдоль стены, v вверх)
function wallDecal(home, it, d, o, t, frame) {
  const WH = WALLH[home.lvl - 1], wpx = it.w * 32;
  let e = wallTex.get(it.uid);
  if (!e || e.wall !== it.wall || e.w !== it.w) {
    if (e) { roots.room.remove(e.mesh); e.mesh.geometry.dispose(); e.tex.dispose(); e.mesh.material.dispose(); }
    const cv = document.createElement('canvas'); cv.width = wpx * TEX_S; cv.height = WH * TEX_S;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const g = new THREE.PlaneGeometry(it.w, hz(WH));
    const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 1;
    if (it.wall === 'a') mesh.position.set(it.x + it.w / 2, hz(WH) / 2, 0.012);
    else { mesh.rotation.y = Math.PI / 2; mesh.scale.x = -1; mesh.position.set(0.012, hz(WH) / 2, it.x + it.w / 2); }
    roots.room.add(mesh);
    e = { cv, tex, mesh, last: -9, wall: it.wall, w: it.w };
    wallTex.set(it.uid, e);
  }
  e.used = frame; e.mesh.visible = true;
  if (t - e.last > .1) {
    e.last = t;
    const g = e.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.cv.width, e.cv.height);
    g.setTransform(TEX_S, 0, 0, TEX_S, 0, WH * TEX_S);
    try { d.draw(g, it, o); } catch (err) { /* картинка на стене не должна ронять кадр */ }
    e.tex.needsUpdate = true;
  }
}

export function renderInterior(ctx, t, dt) {
  const home = homeOf(); if (!home) return;
  if (!roomInst) { roomInst = new Instancer(roots.room); roomDyn = new DynBatch(roots.room); }
  roots.frame++;
  roots.world.visible = false; roots.room.visible = true;
  const dpr = cam.dpr, W = home.in.w, D = home.in.d, lvl = home.lvl, WH = WALLH[lvl - 1];
  const o = { hour: hour(), rain: G.weather.type === 'rain', season: season(), t, dusk: darkness() > .22 };
  cam.az = cam.azT = Math.PI / 4; cam.goto = null;
  setBg('#2a2026');
  syncCamera(); setSun(12, 0, false);
  roomInst.begin(); const c = roomDyn.b; c.reset(); c.setRot(0); c.ox = c.oy = c.oz = 0;
  roomInst.add(roomModel(home), 0, 0);
  const lights = [], frame = roots.frame;
  for (const it of home.in.items) {
    const d = FDEF[it.t];
    if (d.wall) {
      if (d.needs?.includes('power')) it.on = !!home.st.powered;
      wallDecal(home, it, d, o, t, frame);
      if (d.light && lightOnIt(home, it, d)) { const [lx, ly] = it.wall === 'a' ? [it.x + it.w / 2, .2] : [.2, it.x + it.w / 2]; lights.push({ x: lx, y: ly, z: 50, r: d.light.r, col: d.light.col, f: 1 + Math.sin(t * 9 + it.uid) * .03 }); }
      continue;
    }
    let sy = 1, sxz = 1;
    if (it.pop !== undefined) { const age = performance.now() / 1000 - it.pop; if (age < .45) { const k = Math.min(1, age / .4), e = 1 + 1.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); sy = Math.max(.05, e); sxz = .85 + .15 * e; } else delete it.pop; }
    roomInst.add(furnModel(it, d, o), it.x, it.y, sy, sxz, it.w / 2, it.d / 2);
    if (d.anim) { c.ox = it.x; c.oy = it.y; setSwap(!!it.rot); try { d.anim(c, { ...it, st: it.st, cw: d.size[0], cd: d.size[1], on: it.on }, t, o); } catch (err) { /* анимация */ } setSwap(false); c.ox = c.oy = 0; }
    if (d.light && lightOnIt(home, it, d)) lights.push({ x: it.x + it.w / 2, y: it.y + it.d / 2, z: 40, r: d.light.r, col: d.light.col, f: 1 + Math.sin(t * 9 + it.uid) * .03 });
  }
  for (const [uid, e] of wallTex) if (e.used !== frame) { roots.room.remove(e.mesh); e.mesh.geometry.dispose(); e.tex.dispose(); e.mesh.material.dispose(); wallTex.delete(uid); }
  const p = G.player;
  buildPlayer(c, p, t);
  for (const pet of G.pets) if (pet.in === home.id) buildPet(c, pet, t);
  c.setRot(0); c.ox = c.oy = c.oz = 0;
  const gh = R.ghost;
  if (gh && gh.kind === 'furn' && !gh.wall) {
    const d = gh.def, fake = { t: d.id, x: gh.x, y: gh.y, rot: gh.rot, w: gh.w, d: gh.d, v: 3, st: {}, uid: 0 };
    showGhost(roots.room, furnModel(fake, d, o), gh.x, gh.y, gh.valid, hz(2) + Math.abs(Math.sin(t * 4)) * .04);
  }
  hideGhosts(roots.room);
  roomDyn.flush(); roomInst.end();
  renderer.render(scene, camera3);

  // ── 2D-оверлей ──
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cam.W * dpr, cam.H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const zk = Math.max(.8, cam.zoom), door = doorOf(home);
  dia(ctx, door.x, door.y, 1, 1, 'rgba(120,80,50,.55)', 'rgba(255,230,180,.7)', 1.6, 1);
  ctx.fillStyle = 'rgba(255,240,210,.9)'; ctx.font = `600 ${11 * zk}px ui-rounded, sans-serif`; ctx.textAlign = 'center';
  const [dx, dy] = worldToScreen(door.x + .5, door.y + .5, 1); ctx.fillText('выход', dx, dy + 4 * zk);
  const sel = G.sel;
  if (sel && sel.uid) { const it = home.in.items.find((o2) => o2.uid === sel.uid); if (it && !it.wall) { const a = .55 + .25 * Math.sin(t * 5); dia(ctx, it.x, it.y, it.w, it.d, `rgba(255,236,160,${a * .25})`, `rgba(255,226,120,${a})`, 2.2, 1); } }
  if (gh && gh.kind === 'furn') drawGhost2D(ctx, gh, WH);
  if (R.hover && !R.ghost && R.hover.kind === 'tile') dia(ctx, R.hover.x, R.hover.y, 1, 1, 'rgba(255,255,255,.12)', 'rgba(255,255,255,.4)', 1.2, 1);
  drawWorkRing(ctx, p);
  for (const pet of G.pets) if (pet.in === home.id) { drawPetBubble(ctx, pet, t); if (pet.sleep) drawZ(ctx, pet, t, 14); }
  if (p.fx === 'sleep' || p.fx === 'nap') drawZ(ctx, p, t, 26);
  fx.drawParts(ctx);
  lights.push({ x: p.x, y: p.y, z: 30, r: 1.6, col: '#ffe0a8', a: .25 });
  drawLighting(ctx, lights, t, { indoor: true, extraDark: p.sleeping ? .3 : 0, toScreen: worldToScreen });
  drawWeather(ctx, t, dt, { indoor: true });
}
function drawGhost2D(ctx, g, WH) {
  const col = g.valid ? 'rgba(150,255,160,.9)' : 'rgba(255,110,100,.9)';
  if (!g.wall) {
    for (let j = 0; j < g.d; j++) for (let i = 0; i < g.w; i++) dia(ctx, g.x + i, g.y + j, 1, 1, g.valid ? 'rgba(110,230,120,.3)' : 'rgba(240,80,70,.34)', col, 1.5, 1);
    return;
  }
  const a = g.wall === 'a' ? [g.x, 0] : [0, g.x], b = g.wall === 'a' ? [g.x + g.w, 0] : [0, g.x + g.w];
  const pts = [worldToScreen(a[0], a[1], 8), worldToScreen(b[0], b[1], 8), worldToScreen(b[0], b[1], WH - 8), worldToScreen(a[0], a[1], WH - 8)];
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
  ctx.fillStyle = g.valid ? 'rgba(110,230,120,.22)' : 'rgba(240,80,70,.25)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
}
