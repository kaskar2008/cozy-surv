// Игровое API: строительство, сбор, крафт, еда, сон. Через него работают UI и постройки.
import { G, N, day, season, hour, darkness, isNight } from './state.js';
import { T, inB, ti, tileAt, isWater, nodeAt, bldAt, addNode, removeNode, addBld, removeBld, nearWater, rebuildOcc } from './world.js';
import * as eco from './eco.js';
import { neighborsOfRect, netOf, netAdd, netTake, isHot, heated, ensureLinks } from './nets.js';
import * as pl from './player.js';
import { BDEF } from '../data/buildings/index.js';
import { NDEF } from '../data/nodes.js';
import { ITEMS, itemName, itemIcon, costStr } from '../data/items.js';
import { STATIONS } from '../data/recipes.js';
import { CROPS } from '../data/crops.js';
import * as fx from '../render/fx.js';
import { rnd, rndi, pick, chance, clamp } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { buildTime } from './progress.js';
import { PET_FOOD, HUNGRY, petWord } from '../data/pets.js';
import { explored } from './fog.js';
import { addXp, bonus, recipeLock, lockText, findConstellation, COOKING } from './skills.js';
import { CONSTS } from '../data/skills.js';

export const S = { fx, eco, G, toast: () => {}, hooks: {} };
export const toast = (msg, kind) => S.toastFn && S.toastFn(msg, kind);
S.toast = toast;
export const stat = (k, n = 1) => { G.stats[k] = (G.stats[k] || 0) + n; };

// ---------------------------------------------------------------- состояние постройки
export function initState(def, b) {
  const st = b.st;
  if (def.crops) st.plots = Array.from({ length: def.plotCount || 1 }, () => ({ crop: null, prog: 0, moist: 0.4, fert: 0 }));
  if (def.burner) { st.fuel = 0; st.lit = false; }
  if (def.out) { st.stock = 0; st.t = 0; if (def.animals) { st.feedT = 0; st.waterT = 0; } }
  if (def.home) { b.lvl = 1; b.in = { w: def.home.levels[0].int[0], d: def.home.levels[0].int[1], items: [], floor: 0, wall: 0 }; }
  if (def.net?.water) st.water = 0;
  if (def.net?.power && (def.net.power.cap || 0) > 0) st.power = 0;
  if (def.compost) { st.load = 0; st.ready = 0; st.t = 0; }
  if (def.mailbox) st.letter = null;
}
export function makeBld(def, x, y, rot = 0) {
  const [cw, cd] = def.size;
  const sw = rot && cw !== cd;
  const b = { id: -1, t: def.id, x, y, rot: rot ? 1 : 0, cw, cd, w: sw ? cd : cw, d: sw ? cw : cd, walk: !!def.walk, lvl: 1, st: {}, v: Math.floor(Math.random() * 1000), nb: [], mask: 0 };
  initState(def, b);
  return b;
}

// ---------------------------------------------------------------- доступность
export const isBuilt = (id) => (G.built[id] || 0) > 0;
export function unlocked(def) {
  if (def.req.some((r) => !isBuilt(r))) return false;
  if (def.reqAny && !def.reqAny.some((r) => isBuilt(r))) return false;
  return true;
}
export function lockReason(def) {
  const miss = def.req.filter((r) => !isBuilt(r)).map((r) => BDEF[r]?.name || r);
  if (miss.length) return 'Сначала построй: ' + miss.join(', ');
  if (def.reqAny && !def.reqAny.some((r) => isBuilt(r))) return 'Сначала построй: ' + def.reqAny.map((r) => BDEF[r]?.name).join(' или ');
  return '';
}

// ---------------------------------------------------------------- проверка места
const SOFT = new Set(['fibergrass', 'herb', 'flowers', 'mushroom', 'sticks', 'shell', 'driftwood', 'rock', 'reeds', 'clay', 'sandpile', 'poop']);
export const softNode = (n) => SOFT.has(n.t) || (n.t === 'tree' && n.st === 'stump');
export function canPlace(def, x, y, rot) {
  const b = makeBld(def, x, y, rot); const bad = new Set(); let reason = '';
  const w = b.w, d = b.d;
  let water = 0, land = 0;
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) {
    const tx = x + i, ty = y + j, k = ty * N + tx;
    if (!inB(tx, ty)) { bad.add(k); reason = 'За пределами острова'; continue; }
    if (!explored(tx, ty)) { bad.add(k); reason = 'Это место скрыто туманом — сначала подойди ближе'; continue; }
    const tt = G.tiles[k];
    if (tt === T.WATER) water++; else land++;
    if (G.bAt[k]) { bad.add(k); reason = reason || 'Место занято'; continue; }
    const n = G.nodeMap.get(G.nAt[k]);
    if (n && !softNode(n)) { bad.add(k); reason = reason || 'Мешает ' + NDEF[n.t].name.toLowerCase(); }
    if (def.water) { if (tt !== T.WATER) { bad.add(k); reason = reason || 'Нужна вода'; } }
    else if (def.dock) { /* смешанные */ }
    else if (tt === T.WATER) { bad.add(k); reason = reason || 'Нельзя строить на воде'; }
    if (def.crops && tt !== T.GRASS && tt !== T.DIRT && tt !== T.FOREST && tt !== T.SAND) { bad.add(k); reason = reason || 'Нужна плодородная земля'; }
  }
  if (!bad.size) {
    if (def.dock && (water < 1 || land < 1)) reason = 'Причал строится от берега в воду';
    else if (def.dock) { /* ok */ }
    if (def.shore || def.water) {
      let near = false;
      for (let j = -1; j <= d && !near; j++) for (let i = -1; i <= w; i++) { const tx = x + i, ty = y + j; if (inB(tx, ty) && !(i >= 0 && j >= 0 && i < w && j < d) && (i === -1 || i === w || j === -1 || j === d)) { const isw = tileAt(tx, ty) === T.WATER; if (def.water ? !isw : isw) { near = true; break; } } }
      if (!near) reason = def.water ? 'Нужен берег рядом' : 'Нужна вода рядом';
    }
    if (!reason && def.seasons && !def.seasons.includes(season())) reason = 'Только в сезон: ' + def.seasons.map((s) => ['весна', 'лето', 'осень', 'зима'][s]).join(', ');
    if (!reason && def.validAdj) {
      const nb = neighborsOfRect(x, y, w, d);
      if (!nb.some((o) => BDEF[o.t].home && o.lvl >= 2)) reason = 'Пристраивается к хижине или дому';
    }
    if (!reason && def.pet && G.pets.length >= 3) reason = 'Хватит питомцев :)';
    if (!reason && def.pet && Object.values(G.bMap.values ? [...G.bMap.values()] : []).some((o) => BDEF[o.t].pet === def.pet)) reason = 'Такой домик уже есть';
  }
  if (!reason && bad.size) reason = 'Место занято';
  return { ok: !reason, reason, bad, b };
}

// ---------------------------------------------------------------- строительство
// Подсказки при первой постройке (один раз)
const HINTS = {
  campfire: 'Нажми на костёр и выбери «Разжечь». Рядом можно поставить котелок, чайник и лавочки 🔥',
  home: 'Нажми на дом дважды — зайти внутрь и расставить мебель 🏠',
  rain_collector: 'Дождесборник вмещает мало воды. Поставь вплотную бак — и дожди будут копиться про запас 💧',
  tank: 'Баки, колодец и трубы объединяются в сеть, если стоят вплотную. Подключай грядки, душ, дождеватели, дом…',
  pot: 'Котелок работает только вплотную к горящему огню 🔥', kettle: 'Чайник работает только вплотную к горящему огню 🔥',
  plot: 'Нажми на грядку и выбери семена. Поливай ведром — или подведи трубу.',
  coop: 'Курам нужны корм и вода: поставь вплотную кормушку и поилку, а рядом ящик — он заберёт яйца 🥚',
  beehive: 'Чем больше цветов рядом, тем больше мёда. Ящик вплотную сам заберёт его 🍯',
  solar_panel: 'Соедини панель проводами с лампами, насосом, аккумулятором. Дом тоже можно подключить ⚡',
  chimney: 'Теперь внутри дома можно поставить камин, печку и плиту 🔥',
  cat_house: 'Через некоторое время в домике кто-то поселится…', dog_house: 'Через некоторое время у будки появится друг…',
  mailbox: 'Иногда в ящик приходят письма с подарками ✉️',
  woodshed: 'Дровница вплотную к костру или печи сама подкладывает дрова 🪵',
  hot_tub: 'Подключи воду (бак вплотную) и поставь вплотную к горящему костру — вода нагреется 🛁',
  sprinkler: 'Дождеватель поливает грядки вокруг, пока в сети труб есть вода 💦',
};
export function place(def, x, y, rot) {
  const chk = canPlace(def, x, y, rot);
  if (!chk.ok) { toast(chk.reason, 'warn'); sfx('no'); return null; }
  if (!unlocked(def)) { toast(lockReason(def), 'warn'); return null; }
  if (!eco.canAfford(def.cost)) { const m = eco.missing(def.cost).map(([k, v]) => `${v}${itemIcon(k)}`).join(' '); toast('Не хватает: ' + m, 'warn'); sfx('no'); return null; }
  eco.pay(def.cost);
  const b = chk.b;
  for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) { const n = nodeAt(x + i, y + j); if (n) removeNode(n); }
  if (def.terraform || def.plantNode) { G.built[def.id] = (G.built[def.id] || 0) + 1; stat('built'); }
  if (def.terraform) { terraform(def, x, y, b); fx.dust(x + 1.5, y + 1.5, 14); sfx('place'); stat('ponds'); return b; }
  if (def.plantNode) {
    const nd = addNode(def.plantNode.t, x, y, { st: 'sapling', tm: def.plantNode.tm, v: def.plantNode.t === 'tree' ? Math.floor(Math.random() * 3) + 3 * rndi(0, 7) : rndi(0, 500) });
    fx.dust(x + .5, y + .5, 6); sfx('place'); return nd;
  }
  addBld(b); b.bld = { p: 0, T: buildTime(def) * (1 - bonus('carp', 'build')) };      // стройка: постройка заработает, когда прогресс дойдёт до 100%
  fx.dust(x + b.w / 2, y + b.d / 2, 8 + b.w * 2); sfx('place');
  ensureLinks(); nudgeWorldPlayer();
  return b;
}
// плотничество: опыт за стройку и шанс сэкономить материалы
function carpentryReward(def, b) {
  const cost = Object.values(def.cost).reduce((a, v) => a + v, 0);
  addXp('carp', def.drag ? .25 : Math.min(8, 1 + cost / 10));
  const save = bonus('carp', 'save'), back = {};
  if (save) for (const k in def.cost) for (let i = 0; i < def.cost[k]; i++) if (chance(save)) back[k] = (back[k] || 0) + 1;
  const got = Object.entries(back).filter(([k, v]) => eco.add(k, v) > 0);
  if (got.length) fx.floatText(b.x + b.w / 2, b.y + b.d / 2, 'Сэкономил ' + got.map(([k, v]) => `${v}${itemIcon(k)}`).join(' '), '#d8f0b0', 44);
}
export function finishBuild(b) {
  const def = BDEF[b.t]; delete b.bld;
  G.built[def.id] = (G.built[def.id] || 0) + 1; stat('built');
  carpentryReward(def, b);
  G.dirtyLinks = true; ensureLinks();   // без «появления с нуля»: постройка уже полностью видна после стройки
  fx.dust(b.x + b.w / 2, b.y + b.d / 2, 14 + b.w * 2); fx.sparkle(b.x + b.w / 2, b.y + b.d / 2, 40, '#fff6b0', 6); sfx('place');
  if (HINTS[def.id] && !G.flags['h_' + def.id]) { G.flags['h_' + def.id] = 1; toast(HINTS[def.id]); }
  S.hooks.onPlaced && S.hooks.onPlaced(b);
}
// персонаж сидит или спит на предмете: клетка под ним занята самим предметом, это нормально — двигать его не нужно
export const isSeated = () => { const p = G.player; return !!(p.sleeping || p.fx === 'sit' || p.fx === 'sleep' || p.fx === 'nap'); };
// встать: вернуться на место, где стоял до того, как сесть/лечь (если оно занято — на ближайшую свободную клетку)
export function leaveSeat() {
  const p = G.player;
  if (p.restPos) { p.x = p.restPos.x; p.y = p.restPos.y; p.restPos = null; }
  const wasWork = p.fx === 'sit' || p.fx === 'sleep' || p.fx === 'nap';
  p.sleeping = false; if (wasWork) { p.fx = null; p.work = null; }
  if (G.scene === 'world') nudgeWorldPlayer(); else S.hooks.nudgeIndoor && S.hooks.nudgeIndoor();
}
// предмет под сидящим убрали (снос, продажа): он встаёт, а не «сидит в воздухе»
export function seatRemoved(x, y, w, d) {
  const p = G.player;
  if (isSeated() && p.x >= x && p.x < x + w && p.y >= y && p.y < y + d) leaveSeat();
}
export function nudgeWorldPlayer() {
  const p = G.player; if (G.scene !== 'world' || isSeated() || !G.blk[ti(Math.floor(p.x), Math.floor(p.y))]) return;
  for (let r = 1; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = Math.floor(p.x) + dx, y = Math.floor(p.y) + dy;
    if (inB(x, y) && !G.blk[ti(x, y)]) { p.x = x + .5; p.y = y + .5; p.path = []; return; }
  }
}
function terraform(def, x, y, b) {
  for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) {
    const cx = i === 1 && j === 1, edge = (i === 1 || j === 1);
    if (cx || edge || chance(.4)) { G.tiles[(y + j) * N + x + i] = T.WATER; G.shd[(y + j) * N + x + i] = 7; }
  }
  for (let j = -1; j <= b.d; j++) for (let i = -1; i <= b.w; i++) {
    const tx = x + i, ty = y + j; if (!inB(tx, ty)) continue;
    const k = ty * N + tx;
    if ((G.tiles[k] === T.GRASS || G.tiles[k] === T.DIRT || G.tiles[k] === T.FOREST) && nearWater(tx, ty, 1)) G.tiles[k] = T.SAND;
    if (G.tiles[k] === T.WATER && G.shd[k] !== 7) G.shd[k] = 7;
  }
  G.dirtyBlk = true; G.terrainVer = (G.terrainVer || 0) + 1;
}
export function refundOf(b) {
  const def = BDEF[b.t]; let cost = { ...def.cost };
  if (def.home) for (let l = 1; l < b.lvl; l++) { const lc = def.home.levels[l].cost; for (const k in lc) cost[k] = (cost[k] || 0) + lc[k]; }
  return cost;
}
export function demolish(b) {
  const def = BDEF[b.t];
  eco.refund(refundOf(b), b.bld ? 1 : 0.6);   // отмена стройки возвращает всё
  if (b.in) for (const it of b.in.items) { const fd = S.furnDef && S.furnDef(it.t); if (fd) eco.refund(fd.cost, 0.6); }
  seatRemoved(b.x, b.y, b.w, b.d);
  removeBld(b);
  G.pets = G.pets.filter((p) => p.home !== b.id);
  fx.dust(b.x + b.w / 2, b.y + b.d / 2, 10); sfx('remove');
  ensureLinks();
  if (G.sel === b.id) G.sel = null;
}

// ---------------------------------------------------------------- сбор ресурсов
export function hasTool(t) { return eco.has(t, 1); }
export function toolMsg(t) { return `Нужен инструмент «${itemName(t)}» — сделай его (кнопка 🛠️ — крафт)`; }

function rollGive(give) {
  const out = {};
  for (const k in give) out[k] = rndi(give[k][0], give[k][1]);
  return out;
}
// собранные какашки сами уходят в ближайшую компостную кучу; нет кучи — просто убираются
function toCompost(n) {
  let best = null, bd = 1e9;
  for (const o of G.bMap.values()) if (BDEF[o.t].compost && !o.bld) { const d = Math.hypot(o.x - n.x, o.y - n.y); if (d < bd) { bd = d; best = o; } }
  if (best) { best.st.load = (best.st.load || 0) + 1; fx.floatText(best.x + .5, best.y + .5, '+♻️', '#cfe8a0', 30); fx.floatText(n.x + .5, n.y + .5, 'В компост', '#cfe8a0', 22); stat('poopCompost'); }
  else fx.floatText(n.x + .5, n.y + .5, 'Убрано', '#e8e0d0', 22);
}
const BEACH = new Set(['shell', 'sandpile', 'driftwood']);
function finishGather(n, g) {
  let got = rollGive(g.give);
  if (g.bonus) for (const k in g.bonus) if (chance(g.bonus[k][0])) got[k] = (got[k] || 0) + rndi(g.bonus[k][1], g.bonus[k][2]);
  if (G.needs.mood > 70 && chance(.07)) { for (const k in got) got[k]++; fx.sparkle(n.x + .5, n.y + .5, 20); }
  if (n.t !== 'poop') {
    if (chance(bonus('forage', 'extra'))) { for (const k in got) got[k]++; fx.sparkle(n.x + .5, n.y + .5, 14, '#d8f0b0'); }
    if (BEACH.has(n.t) && chance(bonus('forage', 'find'))) { const f = pick(['shell', 'shell', 'scrap', 'glass']); got[f] = (got[f] || 0) + 1; toast(`Нашёл на берегу: ${itemIcon(f)} ${itemName(f)}`); }
    addXp('forage', g.tool ? 1 : 2);
  }
  let full = false, txt = [];
  for (const k in got) { const a = eco.add(k, got[k]); if (a < got[k]) full = true; if (a > 0) txt.push(`+${a}${itemIcon(k)}`); }
  if (txt.length) fx.floatText(n.x + .5, n.y + .5, txt.join(' '), '#fff6d0');
  if (full) toast('Склад переполнен — построй ящик или корзину', 'warn');
  stat('gathered');
  if (n.t === 'poop') toCompost(n);
  if (g.after === 'remove') removeNode(n);
  else if (g.after === 'empty') { n.st = 'empty'; n.tm = g.regrow * rnd(.8, 1.2); }
  else if (g.after === 'stump') { n.st = 'stump'; n.tm = rnd(650, 900); G.dirtyBlk = true; stat('chopped'); }
  else if (g.after === 'unfruit') { n.fruit = false; n.tm = 0; }
  if (g.tool === 'pickaxe') stat('mined');
  sfx(g.fx === 'chop' ? 'chop' : 'pick');
}
export function gatherNode(n) {
  const def = NDEF[n.t], g = def.gather(n);
  if (!g) { toast(n.st === 'empty' ? 'Здесь пока пусто — подожди, отрастёт' : 'Пока нечего собирать'); return; }
  if (g.tool && !hasTool(g.tool)) { toast(toolMsg(g.tool), 'warn'); return; }
  const full = Object.keys(g.give).length > 0 && Object.keys(g.give).every((k) => eco.space(k) <= 0);
  if (full) { toast('Склад полон: нет места для ' + Object.keys(g.give).map(itemName).join(', '), 'warn'); return; }
  const ok = pl.goToRect(n.x, n.y, 1, 1, () => {
    pl.startWork(g.verb, g.time * (1 - bonus('forage', 'fast')), g.fx, () => finishGather(n, g), { faceTo: [n.x + .5, n.y + .5], tick: () => { if (Math.random() < .08) n.shk = performance.now() / 1000; } });
  });
  if (!ok) toast('Туда не добраться', 'warn');
}

// ---------------------------------------------------------------- вода, рыбалка
export function fishFrom(wx, wy) {
  if (!hasTool('rod')) { toast('Нужна удочка — сделай её в крафте (кнопка 🛠️)', 'warn'); return; }
  // ближайшая клетка суши рядом с точкой воды
  let best = null, bd = 1e9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = wx + dx, y = wy + dy; if (!inB(x, y) || G.blk[ti(x, y)]) continue; const dd = Math.hypot(dx, dy); if (dd < bd && nearWater(x, y, 1)) { bd = dd; best = [x, y]; } }
  if (!best) { toast('Подойти к воде не получается', 'warn'); return; }
  pl.goTo(best[0], best[1], () => {
    const dock = bldAt(best[0], best[1]); const fast = dock && BDEF[dock.t].fishSpot;
    pl.startWork('Рыбалка…', rnd(6, 11) * (fast ? .6 : 1) * (1 - bonus('fish', 'bite')), 'fish', () => {
      const q = Math.random() + (fast ? -.08 : 0) - bonus('fish', 'luck');
      stat('casts'); addXp('fish', 1);
      if (q < .66) { const a = eco.add('fish', chance(bonus('fish', 'dbl')) ? 2 : 1); fx.floatText(wx + .5, wy + .5, a ? `+${a}🐟` : 'Склад полон', '#cfeaff'); if (a) { stat('fish'); addXp('fish', 2); if (chance(.02 + (fast ? .01 : 0))) { eco.add('honey', 1); stat('golden'); toast('Золотая рыбка! Она подмигнула и уплыла, оставив капельку мёда 🍯'); } } }
      else if (q < .74) { eco.add('shell', 1); fx.floatText(wx + .5, wy + .5, '+1🐚', '#fff'); }
      else if (q < .8) { eco.add('scrap', 1); fx.floatText(wx + .5, wy + .5, 'Старая банка +1⚙️', '#fff'); }
      else if (q < .84) { eco.add('clay', 1); fx.floatText(wx + .5, wy + .5, '+1🟫', '#fff'); }
      else fx.floatText(wx + .5, wy + .5, 'Сорвалась…', '#ddd');
      sfx('splash');
    }, { faceTo: [wx + .5, wy + .5] });
  });
}
export function fetchWaterNatural(wx, wy) {
  if (!hasTool('bucket')) { toast('Нужно ведро — сделай его в крафте (кнопка 🛠️)', 'warn'); return; }
  if (eco.space('water') <= 0) { toast('Вёдра уже полные', 'warn'); return; }
  let best = null, bd = 1e9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = wx + dx, y = wy + dy; if (!inB(x, y) || G.blk[ti(x, y)]) continue; const dd = Math.hypot(dx, dy); if (dd < bd && nearWater(x, y, 1)) { bd = dd; best = [x, y]; } }
  if (!best) return;
  pl.goTo(best[0], best[1], () => pl.startWork('Набираю воду', 1.6, 'pick', () => { const a = eco.add('water', 5); fx.floatText(wx + .5, wy + .5, `+${a}💧`, '#cfeaff'); sfx('splash'); }, { faceTo: [wx + .5, wy + .5] }));
}
export function drinkNatural(wx, wy) {
  let best = null, bd = 1e9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = wx + dx, y = wy + dy; if (!inB(x, y) || G.blk[ti(x, y)]) continue; const dd = Math.hypot(dx, dy); if (dd < bd && nearWater(x, y, 1)) { bd = dd; best = [x, y]; } }
  if (!best) return;
  pl.goTo(best[0], best[1], () => pl.startWork('Пью воду', 2, 'pick', () => { G.needs.thirst = Math.min(100, G.needs.thirst + 30); fx.floatText(wx + .5, wy + .5, 'Свежо! 💧', '#cfeaff'); stat('drinks'); sfx('splash'); }, { faceTo: [wx + .5, wy + .5] }));
}
export function fetchFromNet(b) {
  if (!hasTool('bucket')) { toast('Нужно ведро', 'warn'); return; }
  const n = netOf(b, 'water'); if (!n || n.stock < 1) { toast('В сети нет воды', 'warn'); return; }
  const k = Math.min(Math.floor(n.stock), eco.space('water'), 5);
  if (k <= 0) { toast('Вёдра уже полные', 'warn'); return; }
  doAt(b, 'Набираю воду', 1.4, 'pick', () => { const got = netTake(b, 'water', k); eco.add('water', Math.floor(got)); fx.floatText(b.x + b.w / 2, b.y + b.d / 2, `+${Math.floor(got)}💧`, '#cfeaff', 40); sfx('splash'); });
}
export function drinkFromNet(b) {
  const n = netOf(b, 'water'); if (!n || n.stock < 3) { toast('Воды маловато', 'warn'); return; }
  doAt(b, 'Пью воду', 2, 'pick', () => { if (netTake(b, 'water', 3) >= 2.9) { G.needs.thirst = Math.min(100, G.needs.thirst + 40); fx.floatText(b.x + b.w / 2, b.y + b.d / 2, 'Свежо! 💧', '#cfeaff', 40); stat('drinks'); sfx('splash'); } });
}

// ---------------------------------------------------------------- действия у построек
export function doAt(b, label, dur, fxName, fn) {
  const ok = pl.goToRect(b.x, b.y, b.w, b.d, () => pl.startWork(label, dur, fxName, fn, { faceTo: [b.x + b.w / 2, b.y + b.d / 2] }));
  if (!ok) toast('Туда не добраться', 'warn');
}
export const waterAdj = (b) => [b, ...b.nb].filter((o) => G.comp?.water?.has(o.id));
export function waterAvailable(b) {
  let s = 0; for (const o of waterAdj(b)) { const n = netOf(o, 'water'); if (n) s = Math.max(s, n.stock); }
  return s;
}
export function takeWaterFor(b, n) {
  for (const o of waterAdj(b)) { const ns = netOf(o, 'water'); if (ns && ns.stock >= n) { netTake(o, 'water', n); return true; } }
  if (eco.has('water', n)) { eco.take('water', n); return true; }
  return false;
}
export const stationDef = (b) => STATIONS[BDEF[b.t].station];

// горелки
export const defOf = (b) => b.def || BDEF[b.t];
export function lightFire(b) {
  const def = defOf(b);
  if (b.st.lit && b.st.fuel > 0) { toast('Уже горит'); return; }
  const fuels = Object.keys(def.burner.fuels).filter((k) => eco.has(k));
  if (b.st.fuel <= 0 && !fuels.length) { toast('Нужно топливо: хворост или дрова', 'warn'); return; }
  const doLight = () => {
    if (b.st.fuel <= 0) { const f = fuels.includes('sticks') ? 'sticks' : fuels[0]; eco.take(f, 1); b.st.fuel = def.burner.fuels[f]; }
    b.st.lit = true; stat('fires'); sfx('fire'); fx.sparkle(b.x + b.w / 2, b.y + b.d / 2, 10, '#ffb050', 8);
    toast('Огонь разгорелся 🔥');
  };
  doAt(b, 'Разжигаю огонь', 2.8, 'pick', doLight);
}
export function addFuel(b, item) {
  const def = defOf(b), val = def.burner.fuels[item];
  if (!val || !eco.has(item)) return;
  if (b.st.fuel > def.burner.max - val * .5) { toast('Топки уже полна'); return; }
  doAt(b, 'Подкладываю', 1, 'pick', () => { if (!eco.take(item, 1)) return; b.st.fuel = Math.min(def.burner.max, b.st.fuel + val); fx.floatText(b.x + b.w / 2, b.y + b.d / 2, `+${itemIcon(item)}`, '#ffd9a0', 30); });
}
// производители
export function collectOut(b) {
  const def = BDEF[b.t]; if (!def.out) return;
  if ((b.st.stock || 0) < 1) { toast('Пока ничего нет'); return; }
  doAt(b, 'Собираю', 1.2, 'pick', () => {
    const k = Math.floor(b.st.stock), got = eco.add(def.out.item, k);
    b.st.stock -= got; fx.floatText(b.x + b.w / 2, b.y + b.d / 2, `+${got}${itemIcon(def.out.item)}`, '#fff6d0', 40);
    if (got < k) toast('Склад полон', 'warn');
    stat('collected'); if (def.out.item === 'egg') stat('eggs'); if (def.out.item === 'honey') stat('honey'); if (def.out.item === 'milk') stat('milk');
    sfx('pick');
  });
}
export function feedAnimals(b, what) {
  const def = BDEF[b.t];
  if (what === 'feed') { const it = def.animals.feed.find((i) => eco.has(i)); if (!it) { toast('Нужен корм: ' + def.animals.feed.map(itemName).join(' / '), 'warn'); return; } doAt(b, 'Кормлю', 1.2, 'pick', () => { if (eco.take(it, 1)) { b.st.feedT = Math.max(b.st.feedT, 0) + 300; addXp('animals', 2); fx.hearts(b.x + b.w / 2, b.y + b.d / 2, 30); } }); }
  else { if (!eco.has('water')) { toast('Нужна вода (ведро)', 'warn'); return; } doAt(b, 'Наливаю воду', 1.2, 'pick', () => { if (eco.take('water', 1)) { b.st.waterT = Math.max(b.st.waterT, 0) + 300; addXp('animals', 1); sfx('splash'); } }); }
}
// компост
export function loadCompost(b) {
  const src = ['fiber', 'herbs', 'sticks'].find((i) => eco.has(i, 2));
  if (!src) { toast('Нужно 2 волокна, травы или хвороста', 'warn'); return; }
  doAt(b, 'Загружаю', 1, 'pick', () => { if (eco.take(src, 2)) { b.st.load = (b.st.load || 0) + 1; fx.floatText(b.x + .5, b.y + .5, 'Заложено', '#cfe8a0', 30); } });
}
export function takeCompost(b) {
  if (!b.st.ready) { toast('Компост ещё не созрел'); return; }
  doAt(b, 'Забираю компост', 1, 'pick', () => { const a = eco.add('compost', b.st.ready); b.st.ready -= a; fx.floatText(b.x + .5, b.y + .5, `+${a}🟤`, '#fff', 30); });
}
// компост рядом с грядкой (зазор между постройками до 3 клеток): сам удобряет посевы
const gap = (a, b) => Math.hypot(Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0), Math.max(a.y - (b.y + b.d), b.y - (a.y + a.d), 0));
export function compostsNear(b) { const out = []; for (const o of G.bMap.values()) if (BDEF[o.t].compost && gap(o, b) <= 3) out.push(o); return out; }
// пугало действует на грядки, до которых от него не больше 4 клеток (радиус кольца на призраке)
const SCARE_R = 4;
export function scarecrowsNear(b) { const out = []; for (const o of G.bMap.values()) if (BDEF[o.t].tags.includes('scarecrow') && !o.bld && o !== b && gap(o, b) <= SCARE_R) out.push(o); return out; }
export function cropsInScare(b) { const out = []; for (const o of G.bMap.values()) if (BDEF[o.t].crops && gap(o, b) <= SCARE_R) out.push(o); return out; }
export function cropsNear(b) { const out = []; for (const o of G.bMap.values()) if (BDEF[o.t].crops && gap(o, b) <= 3) out.push(o); return out; }
// грядки
export function plantCrop(b, plotIdx, crop) {
  const c = CROPS[crop], p = b.st.plots[plotIdx];
  if (p.crop) return;
  if (!eco.has(c.seed)) { toast('Нет семян: ' + itemName(c.seed), 'warn'); return; }
  if (season() === 3 && !BDEF[b.t].tags.includes('greenhouse')) { toast('Зимой на улице ничего не растёт — нужна теплица', 'warn'); return; }
  doAt(b, 'Сажаю', 2, 'pick', () => {
    if (!eco.take(c.seed, 1)) return;
    p.crop = crop; p.prog = 0; p.moist = Math.max(p.moist, .5); p.fert = 0;
    stat('planted'); addXp('garden', 2); sfx('pick');
  });
}
export function waterPlot(b, plotIdx) {
  const p = b.st.plots[plotIdx];
  if (!eco.has('water')) { toast('Нужна вода: набери ведро в пруду или у бака', 'warn'); return; }
  doAt(b, 'Поливаю', 1.6, 'pick', () => { if (eco.take('water', 1)) { p.moist = 1; fx.drop(b.x + 1, b.y + 1, 20); fx.floatText(b.x + 1, b.y + 1, '💧', '#cfeaff', 30); stat('watered'); addXp('garden', 1); sfx('splash'); } });
}
export function fertilizePlot(b, plotIdx) {
  const p = b.st.plots[plotIdx];
  if (!p.crop) return;
  if (p.fert) { toast('Уже удобрено'); return; }
  if (!eco.has('compost')) { toast('Нужен компост — поставь компостную кучу', 'warn'); return; }
  doAt(b, 'Удобряю', 1.4, 'pick', () => { if (eco.take('compost', 1)) { p.fert = 1; addXp('garden', 1); fx.sparkle(b.x + 1, b.y + 1, 14, '#cfe8a0'); } });
}
export function harvestPlot(b, plotIdx) {
  const p = b.st.plots[plotIdx];
  if (!p.crop || p.prog < 1) return;
  const c = CROPS[p.crop];
  doAt(b, 'Собираю урожай', 2.4, 'pick', () => {
    let n = rndi(c.yield[0], c.yield[1]) + (p.fert ? 2 : 0);
    if (G.needs.mood > 70 && chance(.15)) n++;
    // пчёлы рядом = опыление
    for (const o of G.bMap.values()) if (BDEF[o.t].tags.includes('hive') && Math.hypot(o.x - b.x, o.y - b.y) <= 7) { n += 1; break; }
    const twice = chance(bonus('garden', 'dbl')); if (twice) n *= 2;
    const a = eco.add(c.out, n), seeds = eco.add(c.seed, rndi(1, 2));
    addXp('garden', 4);
    fx.floatText(b.x + 1, b.y + 1, `${twice ? '✨ ' : ''}+${a}${itemIcon(c.out)}${seeds ? ` +${seeds}🌰` : ''}`, '#fff6d0', 40);
    fx.sparkle(b.x + 1, b.y + 1, 14);
    if (a < n) toast('Склад полон — часть урожая осталась', 'warn');
    stat('harvested'); if (season() === 3) stat('winterHarvest'); (G.stats.crops ||= {})[p.crop] = (G.stats.crops[p.crop] || 0) + 1;
    p.crop = null; p.prog = 0; p.fert = 0; sfx('harvest');
  });
}
export function clearPlot(b, plotIdx) { const p = b.st.plots[plotIdx]; p.crop = null; p.prog = 0; p.fert = 0; }

// ---------------------------------------------------------------- крафт
export function canCraft(b, station, r) {
  const st = STATIONS[station];
  if (recipeLock(r)) return false;
  for (const k in r.in) {
    if (k === 'water' && st.water) { if (waterAvailable(b) < r.in[k] && !eco.has('water', r.in[k])) return false; }
    else if (!eco.has(k, r.in[k])) return false;
  }
  return true;
}
function consumeFor(b, station, r) {
  const st = STATIONS[station];
  for (const k in r.in) { if (k === 'water' && st.water) takeWaterFor(b, r.in[k]); else eco.take(k, r.in[k]); }
}
export function stationHeatOk(b, station) {
  const st = STATIONS[station];
  if (st.heat === 'self') return isHot(b);
  if (st.heat === 'near') return heated(b);
  return true;
}
export function startCraft(b, station, idx, qty = 1) {
  const st = STATIONS[station], r = st.recipes[idx];
  if (b.st.cur) { toast('Станция занята'); return; }
  if (r.once && Object.keys(r.out).every((k) => eco.has(k))) { toast('У тебя уже есть такой инструмент'); return; }
  if (recipeLock(r)) { toast('Рецепт откроется с навыком: ' + lockText(r), 'warn'); return; }
  if (!stationHeatOk(b, station)) { toast(st.heat === 'self' ? 'Сначала разведи огонь' : 'Нужен горящий огонь вплотную к станции', 'warn'); return; }
  if (!canCraft(b, station, r)) { toast('Не хватает ингредиентов', 'warn'); return; }
  consumeFor(b, station, r);
  const heatBoost = (st.heatBoost && heated(b) ? 2 : 1) / (COOKING.has(station) ? 1 - bonus('cook', 'speed') : 1);
  b.st.cur = { st: station, idx, left: r.t / heatBoost, total: r.t / heatBoost };
  b.st.q = Math.max(0, qty - 1); sfx('craft');
}
export function handCraft(idx) {
  const r = STATIONS.hand.recipes[idx];
  if (r.once && Object.keys(r.out).every((k) => eco.has(k))) { toast('У тебя уже есть такой инструмент'); return; }
  if (!eco.canAfford(r.in)) { toast('Не хватает материалов', 'warn'); return; }
  eco.pay(r.in);
  pl.startWork('Мастерю…', r.t, 'pick', () => { for (const k in r.out) eco.add(k, r.out[k]); fx.floatText(G.player.x, G.player.y, Object.entries(r.out).map(([k, v]) => `+${v}${itemIcon(k)}`).join(' '), '#fff6d0'); stat('crafted'); addXp('carp', 1); sfx('craft'); });
}

// ---------------------------------------------------------------- еда
export function eat(item) {
  const it = ITEMS[item], e = it?.e;
  if (!e || !eco.has(item)) return;
  const n = G.needs;
  const useful = (e.h && n.hunger < 94) || (e.t && n.thirst < 94) || (e.w && n.warmth < 90) || (e.m && n.mood < 92);
  if (!useful) { toast('Пока не хочется'); return; }
  pl.startWork('Ем', 1.8, 'eat', () => {
    if (!eco.take(item, 1)) return;
    if (e.h) n.hunger = clamp(n.hunger + e.h * (1 + (it.c === 'meal' ? bonus('cook', 'fill') : 0)), 0, 100);
    if (e.t) n.thirst = clamp(n.thirst + e.t, 0, 100);
    if (e.w) addBuff('warm', e.w, 120);
    if (e.m) addBuff('mood', e.m, 90);
    const dine = diningBonus();
    if (dine) { addBuff('mood', dine, 120); toast('Приятно поесть за столом 🍽️'); }
    fx.floatText(G.player.x, G.player.y, `${itemIcon(item)} ${itemName(item)}`, '#fff6d0');
    stat('eaten'); if (it.c === 'meal') stat('meals'); if (item === 'herbal_tea' || item === 'berry_tea' || item === 'cider' || item === 'honey_milk') stat('teas');
    sfx('eat');
  });
}
export const diningBonus = () => (G.scene !== 'world' && S.diningNearby && S.diningNearby() ? 6 : 0);
export function addBuff(k, v, dur) {
  const ex = G.buffs.find((b) => b.k === k && b.src === undefined);
  if (ex) { ex.v = Math.max(ex.v, v); ex.left = Math.max(ex.left, dur); } else G.buffs.push({ k, v, left: dur });
}
export const buffSum = (k) => G.buffs.filter((b) => b.k === k).reduce((a, b) => a + b.v, 0);

// ---------------------------------------------------------------- отдых
export function nearHeat(x, y, r) {
  let best = 0;
  for (const b of G.bMap.values()) { const d = BDEF[b.t]; if (d.warm && isHot(b)) { const dd = Math.hypot(b.x + .5 - x, b.y + .5 - y); if (dd <= r) best = Math.max(best, 1 - dd / (r + 1)); } }
  return best;
}
export function sitAt(b) {
  const def = BDEF[b.t], s = def.sit, p = G.player;
  const ok = pl.goToRect(b.x, b.y, b.w, b.d, () => {
    const prev = { x: p.x, y: p.y };
    if (!def.flat) { p.x = b.x + b.w / 2; p.y = b.y + b.d / 2; p.restPos = prev; }
    pl.startWork('Отдыхаю', s.dur, 'sit', () => { if (!def.flat) { p.x = prev.x; p.y = prev.y; p.restPos = null; nudgeWorldPlayer(); } finishSit(b, def, s); }, { faceTo: [b.x + b.w / 2 + 1, b.y + b.d / 2 + 1] });
  });
  if (!ok) toast('Туда не добраться', 'warn');
}
function finishSit(b, def, s) {
  {
    let m = s.mood;
    const fireNear = nearHeat(b.x + b.w / 2, b.y + b.d / 2, 4.5) > 0;
    if (fireNear) { m += 5; toast('У костра особенно уютно 🔥'); }
    if (G.cozy && G.cozy.list.some((l) => l.id === 'campfire_seats') && fireNear) m += 2;
    addBuff('mood', m, 150); G.needs.energy = Math.min(100, G.needs.energy + 6); stat('sat');
    fx.hearts(G.player.x, G.player.y, 34); sfx('chime');
  }
}
export function startSleep(kind, quality = 1, label = 'Сплю') {
  const p = G.player;
  stat('sleeps');
  p.sleeping = true; p.sleepQ = quality; p.fx = kind === 'nap' ? 'nap' : 'sleep'; p.path = []; p.work = null; p.sleepKind = kind;
  S.hooks.onSleep && S.hooks.onSleep();
}
export function wakeUp() { const p = G.player; if (!p.sleeping) return; leaveSeat(); toast('Проснулся. Доброе утро ☀️'); }
export function napAt(b) {
  const def = BDEF[b.t];
  if (G.needs.energy > 90) { toast('Совсем не хочется спать'); return; }
  doAt(b, 'Устраиваюсь', 1.2, 'pick', () => { const p = G.player; p.restPos = { x: p.x, y: p.y }; p.x = b.x + b.w / 2; p.y = b.y + b.d / 2 - .2; startSleep('nap', def.nap.rate); });
}
export function stargaze(b) {
  const night = isNight();
  doAt(b, night ? 'Смотрю на звёзды' : 'Смотрю вдаль', night ? 12 : 6, 'read', () => {
    const calm = 1 + bonus('astro', 'calm');
    addBuff('mood', Math.round((night ? 22 : 5) * calm), night ? 300 : 90); stat('stars', night ? 1 : 0); addXp('astro', night ? 6 : 1);
    const c = night && G.weather.type === 'clear' ? findConstellation() : null;
    if (c) toast(`Телескоп нашёл созвездие «${c}» ✨ (${G.flags.consts.length}/${CONSTS.length})`);
    else if (night) toast('Небо полное звёзд ✨ Настроение отличное'); fx.sparkle(G.player.x, G.player.y, 40, '#fff6b0', 10); sfx('chime');
  });
}
export function toggleMusic(b) { b.st.on = !b.st.on; if (b.st.on) stat('music'); }
export function bathe(b) {
  const n = netOf(b, 'water');
  if (!n || n.stock < 20) { toast('В купели мало воды — подведи воду из бака (нужно 20)', 'warn'); return; }
  if (!heated(b)) { toast('Вода холодная: поставь купель вплотную к горящему костру или печи', 'warn'); return; }
  doAt(b, 'Принимаю ванну', 14, 'bathe', () => { netTake(b, 'water', 20); G.needs.warmth = 100; addBuff('mood', 26, 360); addBuff('warm', 40, 240); G.needs.energy = Math.min(100, G.needs.energy + 12); stat('baths'); fx.sparkle(b.x + 1, b.y + 1, 30, '#bfe8ff', 10); sfx('chime'); });
}
export function shower(b) {
  const n = netOf(b, 'water');
  if (!n || n.stock < 4) { toast('Нет воды для душа', 'warn'); return; }
  doAt(b, 'Моюсь', 6, 'pick', () => { netTake(b, 'water', 4); addBuff('mood', 10, 200); stat('showers'); fx.sparkle(b.x + .5, b.y + .5, 30, '#bfe8ff', 8); sfx('splash'); });
}
export function sauna(b) {
  if (!isHot(b)) { toast('Растопи баню, чтобы попариться', 'warn'); return; }
  if (!takeWaterFor(b, 3)) { toast('Нужна вода: бак рядом или 3 ведра воды', 'warn'); return; }
  doAt(b, 'Парюсь', 16, 'bathe', () => { G.needs.warmth = 100; G.needs.energy = Math.min(100, G.needs.energy + 15); addBuff('mood', 30, 420); addBuff('warm', 50, 300); stat('saunas'); fx.sparkle(G.player.x, G.player.y, 30, '#ffe6b0', 10); sfx('chime'); });
}
// сколько сытости даст лучшая «дешёвая» еда из рюкзака (сначала сырая рыба/яйцо, потом готовое)
export const petFoodHave = (pet) => Object.keys(PET_FOOD[pet.kind]).filter((k) => eco.has(k));
const near = (pet, fn) => {
  const dd = Math.hypot(G.player.x - pet.x, G.player.y - pet.y);
  pet.tx = null; pet.sleep = false; pet.t = Math.max(pet.t || 0, 5);   // питомец замирает, пока с ним возятся
  if (dd < 1.6) fn(); else pl.goTo(Math.floor(pet.x), Math.floor(pet.y), fn);
};
export function feedPet(pet, item) {
  const val = PET_FOOD[pet.kind][item];
  if (!val || !eco.has(item)) { toast('Нечем кормить: ' + (pet.kind === 'cat' ? 'рыба, молоко, яйца' : 'рыба, яйца, сыр, хлеб'), 'warn'); return; }
  if ((pet.hunger ?? 70) > 92) { toast(petWord(pet) + ' не голоден'); return; }
  near(pet, () => pl.startWork('Кормлю', 1.6, 'pick', () => {
    if (!eco.take(item, 1)) return;
    pet.hunger = Math.min(100, (pet.hunger ?? 70) + val); pet.bond = Math.min(100, (pet.bond ?? 40) + 3); pet.job = null; pet.starve = 0; pet.ask = 0;
    if (pet.kind === 'dog') pet.poopT = Math.min(pet.poopT ?? 100, rnd(40, 90));   // поел — скоро на прогулку «по делам»
    addXp('animals', 2); fx.hearts(pet.x, pet.y, 16); fx.floatText(pet.x, pet.y, `+${itemIcon(item)}`, '#fff6d0', 30); sfx(pet.kind === 'cat' ? 'meow' : 'woof'); stat('petFed');
  }, { faceTo: [pet.x, pet.y] }));
}
export function petPet(pet) {
  // голодному питомцу сначала предложим еду, если она есть в рюкзаке
  if ((pet.hunger ?? 70) < HUNGRY) {
    const have = petFoodHave(pet);
    if (have.length) { feedPet(pet, have[0]); return; }
    toast(petWord(pet) + ' просит есть: ' + (pet.kind === 'cat' ? 'рыба, молоко или яйца' : 'рыба, яйца, сыр или хлеб'), 'warn');
  }
  const go = () => {
    pet.sleep = false; fx.hearts(pet.x, pet.y, 22);
    const bond = pet.bond ?? 40; addBuff('mood', Math.round(6 + bond * .06), 180);
    stat('pets'); addXp('animals', 1); pet.love = (pet.love || 0) + 1; pet.bond = Math.min(100, bond + (pet.ask > 0 ? 4 : 2) + Math.floor(bonus('animals', 'pet'))); pet.ask = 0;
    sfx(pet.kind === 'cat' ? 'meow' : 'woof'); toast(pet.kind === 'cat' ? 'Мурр… ♥' : 'Гав! ♥');
  };
  near(pet, () => pl.startWork('Глажу', 2.2, 'pick', go, { faceTo: [pet.x, pet.y] }));
}
export function readLetter(b) {
  if (!b.st.letter) { toast('Писем нет. Может, завтра?'); return; }
  doAt(b, 'Читаю письмо', 2, 'read', () => S.hooks.openLetter && S.hooks.openLetter(b));
}
export function meetTraveler() { S.hooks.travelerTalk && S.hooks.travelerTalk(); }

// ---------------------------------------------------------------- улучшение дома
export function upgradeHome(b) {
  const def = BDEF[b.t], lv = def.home.levels[b.lvl];
  if (!lv) return;
  if (!eco.canAfford(lv.cost)) { toast('Не хватает: ' + eco.missing(lv.cost).map(([k, v]) => `${v}${itemIcon(k)}`).join(' '), 'warn'); return; }
  const [nw, nd] = lv.size;
  for (let j = 0; j < nd; j++) for (let i = 0; i < nw; i++) {
    const tx = b.x + i, ty = b.y + j;
    if (!inB(tx, ty) || tileAt(tx, ty) === T.WATER) { toast('Не хватает места для расширения', 'warn'); return; }
    const o = G.bAt[ti(tx, ty)]; if (o && o !== b.id) { toast('Рядом что-то мешает расширению — освободи клетки справа и снизу', 'warn'); return; }
    const nn = nodeAt(tx, ty); if (nn && !softNode(nn)) { toast('Мешает ' + NDEF[nn.t].name.toLowerCase(), 'warn'); return; }
  }
  eco.pay(lv.cost);
  for (let j = 0; j < nd; j++) for (let i = 0; i < nw; i++) { const nn = nodeAt(b.x + i, b.y + j); if (nn) removeNode(nn); }
  for (let j = 0; j < b.d; j++) for (let i = 0; i < b.w; i++) G.bAt[ti(b.x + i, b.y + j)] = 0;
  b.lvl++; b.cw = b.w = nw; b.cd = b.d = nd; b.rot = 0;
  for (let j = 0; j < nd; j++) for (let i = 0; i < nw; i++) G.bAt[ti(b.x + i, b.y + j)] = b.id;
  b.in.w = lv.int[0]; b.in.d = lv.int[1];
  G.dirtyBlk = true; G.dirtyLinks = true; ensureLinks();
  b.pop = performance.now() / 1000; fx.dust(b.x + nw / 2, b.y + nd / 2, 18); sfx('place'); stat('upgrades'); nudgeWorldPlayer();
  toast(`${lv.name} готова! Внутри стало просторнее 🏠`);
}
export const homeName = (b) => BDEF[b.t].home.levels[b.lvl - 1].name;
export const bldName = (b) => (BDEF[b.t].home ? homeName(b) : BDEF[b.t].name);

// ---------------------------------------------------------------- связи (для подсветки)
export function linksOf(b) {
  const out = [], def = BDEF[b.t];
  const add = (o, col) => out.push({ a: b, b: o, col });
  for (const type of ['water', 'power']) {
    const comp = G.comp?.[type]?.get(b.id);
    if (comp) for (const o of b.nb) if (G.comp[type].get(o.id) === comp) add(o, type === 'water' ? '#6cc4ee' : '#ffd36e');
  }
  if (def.crops) for (const o of compostsNear(b)) add(o, '#9bc46a');
  if (def.compost) for (const o of cropsNear(b)) add(o, '#9bc46a');
  if (def.crops) for (const o of scarecrowsNear(b)) add(o, '#f0cf6a');
  if (def.tags.includes('scarecrow')) for (const o of cropsInScare(b)) add(o, '#f0cf6a');
  for (const o of b.nb) {
    const od = BDEF[o.t];
    if (def.needs?.includes('heat') && isHot(o)) add(o, '#ff9a50');
    if (od.tags.includes('storage') && def.out) add(o, '#a0e08a');
    if (od.tags.includes('feeder') && def.burner) add(o, '#d9b27a');
    if (od.tags.includes('feeder_animal') && def.animals) add(o, '#e6c45a');
    if (od.tags.includes('trough') && def.animals) add(o, '#6cc4ee');
    if (od.tags.includes('chimney') && def.home) add(o, '#c98a74');
  }
  return out;
}
// пересечение в цвета: для призрака
export function linksForGhost(def, fake) {
  const out = [];
  fake.nb = neighborsOfRect(fake.x, fake.y, fake.w, fake.d);
  for (const type of ['water', 'power']) {
    if (!def.net?.[type]) continue;
    for (const o of fake.nb) if (BDEF[o.t].net?.[type]) out.push({ b: o, col: type === 'water' ? '#6cc4ee' : '#ffd36e' });
  }
  if (def.crops) for (const o of G.bMap.values()) if (BDEF[o.t].tags.includes('scarecrow') && !o.bld && gap(o, fake) <= SCARE_R) out.push({ b: o, col: '#f0cf6a' });
  if (def.tags.includes('scarecrow')) for (const o of cropsInScare(fake)) out.push({ b: o, col: '#f0cf6a' });
  for (const o of fake.nb) {
    const od = BDEF[o.t];
    if (def.needs?.includes('heat') && isHot(o)) out.push({ b: o, col: '#ff9a50' });
    if (def.out && od.tags.includes('storage')) out.push({ b: o, col: '#a0e08a' });
    if (od.out && def.tags.includes('storage')) out.push({ b: o, col: '#a0e08a' });
    if (def.burner && od.tags.includes('feeder')) out.push({ b: o, col: '#d9b27a' });
    if (def.tags.includes('feeder') && od.burner) out.push({ b: o, col: '#d9b27a' });
    if (def.tags.includes('feeder_animal') && od.animals) out.push({ b: o, col: '#e6c45a' });
    if (def.tags.includes('trough') && od.animals) out.push({ b: o, col: '#6cc4ee' });
    if (def.tags.includes('chimney') && od.home) out.push({ b: o, col: '#c98a74' });
    if (od.needs?.includes('heat') && def.burner) out.push({ b: o, col: '#ff9a50' });
  }
  return out;
}

// ---------------------------------------------------------------- прочее
export function flowersNear(b, r = 6) {
  let k = 0;
  for (const n of G.nodeMap.values()) if (n.t === 'flowers' && n.st === 'full' && Math.hypot(n.x - b.x, n.y - b.y) <= r) k++;
  for (const o of G.bMap.values()) {
    const d = BDEF[o.t]; if (Math.hypot(o.x - b.x, o.y - b.y) > r) continue;
    if (d.tags.includes('flowerpatch')) k += 2;
    if (d.crops) for (const p of o.st.plots) if (p.crop === 'flower') k += p.prog >= 1 ? 3 : 1;
  }
  return k;
}
export function count(t) { let k = 0; for (const b of G.bMap.values()) if (b.t === t) k++; return k; }
Object.assign(S, { has: eco.has, add: eco.add, take: eco.take, netOf, netAdd, netTake, isHot, heated, flowersNear, count, stat, addBuff, buffSum, takeWaterFor, waterAvailable, startCraft });
