// Симуляция мира: время, погода, потребности, сети, постройки, ресурсы.
import { G, N, DAY, day, season, hour, tod, darkness, isNight } from './state.js';
import { T, inB, ti, nodeAt, addNode, removeNode, removeBld } from './world.js';
import * as eco from './eco.js';
import { netOf, netAdd, netTake, isHot, heated, ensureLinks } from './nets.js';
import { updatePlayer } from './player.js';
import { COMPOST_T, MILL_T } from './progress.js';
import { compostsNear, finishBuild, S, toast, stat, stationHeatOk, canCraft, flowersNear, addBuff, buffSum, wakeUp, nearHeat } from './api.js';
import { BDEF } from '../data/buildings/index.js';
import { STATIONS } from '../data/recipes.js';
import { CROPS, growMult, SEASONS } from '../data/crops.js';
import { itemIcon, itemName } from '../data/items.js';
import * as fx from '../render/fx.js';
import { rnd, rndi, pick, chance, clamp } from '../core/util.js';
import { computeCozy } from './cozy.js';
import { checkGoals } from './goals.js';
import { updatePets, updateNPC, updateEvents, onDayEvents } from './events.js';
import { interiorStep } from './interior.js';

const W_TABLE = [[.38, .22, .30, .10, 0], [.58, .20, .15, .07, 0], [.28, .24, .30, .18, 0], [.34, .20, 0, .10, .36]];
const W_TYPES = ['clear', 'cloudy', 'rain', 'fog', 'snow'];
const W_MSG = { rain: 'Начался дождь. Самое время для чая 🌧️', snow: 'Пошёл тихий снег ❄️', fog: 'Над островом стелется туман 🌫️', clear: 'Небо прояснилось ☀️', cloudy: 'Набежали облака ☁️' };

let acc = { cozy: 0, goals: 0, ui: 0 };

export function simulate(realDt) {
  const p = G.player;
  const speed = p.sleeping ? Math.max(G.speed || 1, 8) : (G.speed || 0);
  if (!speed) { return; }
  let rem = Math.min(realDt, 0.1) * speed;
  while (rem > 1e-6) { const step = Math.min(0.2, rem); stepSim(step); rem -= step; }
}

function stepSim(dt) {
  ensureLinks();
  const pd = day(), ps = season();
  G.t += dt;
  if (day() !== pd) onNewDay();
  if (season() !== ps) onNewSeason();
  weather(dt); sky(dt); needs(dt);
  netsStep(dt); buildingsStep(dt); nodesStep(dt);
  updatePlayer(dt);
  interiorStep(dt);
  updatePets(dt); updateNPC(dt); updateEvents(dt);
  acc.cozy += dt; acc.goals += dt;
  if (acc.cozy > 2) { acc.cozy = 0; computeCozy(); }
  if (acc.goals > 1.5) { acc.goals = 0; checkGoals(); }
}

// ---------------------------------------------------------------- погода и небо
function rollWeather() {
  const w = W_TABLE[season()]; let r = Math.random(), i = 0;
  for (; i < 4; i++) { r -= w[i]; if (r <= 0) break; }
  return W_TYPES[Math.min(4, i)];
}
function weather(dt) {
  const w = G.weather, wx = G.wx;
  w.left -= dt;
  if (w.left <= 0) {
    const prev = w.type; w.type = rollWeather(); w.left = rnd(70, 170);
    if (w.type !== prev) {
      if (W_MSG[w.type]) toast(W_MSG[w.type]);
      if (prev === 'rain' && (w.type === 'clear' || w.type === 'cloudy') && darkness() < .3 && season() < 3 && chance(.7)) { G.sky.rainbow = 1.2; toast('Радуга! 🌈 Загляни в небо'); addBuff('mood', 10, 150); stat('rainbows'); }
    }
  }
  const tg = { rain: w.type === 'rain' ? 1 : 0, snow: w.type === 'snow' ? 1 : 0, fog: w.type === 'fog' ? 1 : w.type === 'cloudy' ? .2 : 0, cloud: w.type === 'rain' || w.type === 'snow' ? 1 : w.type === 'cloudy' ? .8 : w.type === 'fog' ? .5 : 0 };
  for (const k in tg) wx[k] += (tg[k] - wx[k]) * Math.min(1, dt * .35);
}
function sky(dt) {
  const s = G.sky;
  if (s.rainbow > 0) s.rainbow = Math.max(0, s.rainbow - dt * .018);
  const wantAurora = season() === 3 && isNight() && G.weather.type === 'clear' ? 1 : 0;
  s.aurora += (wantAurora - s.aurora) * Math.min(1, dt * .1);
  if (s.aurora > .6 && !G.flags.auroraSeen) { G.flags.auroraSeen = 1; toast('Северное сияние над островом 🌌'); stat('auroras'); addBuff('mood', 12, 240); }
  if (!s.star && isNight() && G.weather.type !== 'rain' && Math.random() < dt * .004) {
    s.star = { x: Math.random() * 600 + 200, y: Math.random() * 120 + 20, vx: 520, vy: 210, life: 1 };
    toast('Падающая звезда! Загадай желание ✨'); addBuff('mood', 8, 120); stat('shootingStars');
  }
  if (s.star) { s.star.x += s.star.vx * dt * 6; s.star.y += s.star.vy * dt * 6; s.star.life -= dt * .9; if (s.star.life <= 0) s.star = null; }
}

// ---------------------------------------------------------------- потребности
const TEMP = [11, 22, 8, -5];
export function warmTarget() {
  const p = G.player, s = season(), wxr = G.weather.type;
  let temp = TEMP[s] + (isNight() ? -8 : 0) + (wxr === 'rain' ? -3 : 0) + (wxr === 'snow' ? -2 : 0);
  let t = 50 + temp * 2;
  if (G.scene === 'world') t += 38 * nearHeat(p.x, p.y, 3.4);
  else t = Math.max(t, 62) + 8 + (G.interior?.heat ? 36 : 0);
  return clamp(t + buffSum('warm'), 0, 100);
}
function needs(dt) {
  const n = G.needs, p = G.player, sl = p.sleeping;
  n.hunger = clamp(n.hunger - dt * .10 * (sl ? .4 : 1), 0, 100);
  n.thirst = clamp(n.thirst - dt * .14 * (sl ? .4 : 1), 0, 100);
  if (sl) {
    n.energy = clamp(n.energy + dt * .9 * (p.sleepQ || 1), 0, 100);
    const h = hour();
    if (n.energy >= 99 || (p.sleepKind !== 'nap' && h > 6.2 && h < 11 && n.energy > 70)) wakeUp();
  } else n.energy = clamp(n.energy - dt * .10, 0, 100);
  n.warmth += (warmTarget() - n.warmth) * Math.min(1, dt * .25);
  // настроение
  let target = 28 + (n.hunger + n.thirst + n.energy + n.warmth) / 4 * .36 + Math.min(26, G.cozy.total / 6) + buffSum('mood');
  if (G.musicNear) target += 5;
  if (G.scene === 'world' && G.weather.type === 'rain') target -= 4;
  if (G.scene !== 'world' && G.weather.type === 'rain') target += 4;
  if (n.hunger < 15) target -= 8; if (n.thirst < 15) target -= 8; if (n.warmth < 25) target -= 8; if (n.energy < 15) target -= 6;
  n.mood += (clamp(target, 0, 100) - n.mood) * Math.min(1, dt * .08);
  for (let i = G.buffs.length - 1; i >= 0; i--) { G.buffs[i].left -= dt; if (G.buffs[i].left <= 0) G.buffs.splice(i, 1); }
  // мягкие напоминания
  G.hintT = (G.hintT || 0) - dt;
  if (G.hintT <= 0) {
    const m = n.thirst < 22 ? 'Пора попить 💧 — набери воды или загляни к баку' : n.hunger < 22 ? 'Кажется, пора перекусить 🍞' : n.energy < 18 ? 'Глаза слипаются… может, вздремнуть? 😴' : n.warmth < 25 ? 'Зябко. Погрейся у огня 🔥' : null;
    if (m) { toast(m); G.hintT = 120; } else G.hintT = 8;
  }
}

// ---------------------------------------------------------------- сети
const sunlight = () => { const w = G.weather.type; return (1 - darkness()) * (w === 'clear' ? 1 : w === 'cloudy' ? .55 : w === 'fog' ? .45 : w === 'snow' ? .4 : .3); };
const wantPower = (b, def) => {
  const u = def.net.power.use; if (!u) return 0;
  switch (b.t) {
    case 'lamp_post': case 'string_lights': return darkness() > .22 ? u : 0;
    case 'radio': return b.st.on ? u : 0;
    case 'river_pump': { const n = netOf(b, 'water'); return n && n.stock < n.cap - .5 ? u : 0; }
    default: return u;
  }
};
function netsStep(dt) {
  G.musicNear = false;
  const seen = new Set();
  for (const comp of G.comp.power.values()) {
    if (seen.has(comp)) continue; seen.add(comp);
    let gen = 0, dem = 0, stock = 0;
    for (const b of comp.nodes) { const d = BDEF[b.t], nd = d.net.power; if (nd.gen) b.st.gen = nd.gen * sunlight(); gen += b.st.gen || 0; dem += wantPower(b, d); stock += b.st.power || 0; }
    const h = comp.nodes[0]; let ratio = 1;
    const net = (gen - dem) * dt;
    if (net >= 0) { if (net > 0) netAdd(h, 'power', net); ratio = dem > 0.0001 ? 1 : (gen > .01 || stock > .5 ? 1 : 0); }
    else { const got = netTake(h, 'power', -net); ratio = (gen * dt + got) / (dem * dt); }
    for (const b of comp.nodes) b.st.powered = ratio > .55;
  }
  seen.clear();
  for (const b of G.bMap.values()) {
    const def = BDEF[b.t], nd = def.net?.water;
    if (!nd || b.bld) continue;
    let prod = nd.prod || 0;
    if (nd.rain && G.weather.type === 'rain') prod += nd.rain * G.wx.rain;
    if (nd.needsPower && !b.st.powered) prod = 0;
    if (prod > 0) { const a = netAdd(b, 'water', prod * dt); if (nd.needsPower) b.st.on = a > 0; }
    else if (nd.needsPower) b.st.on = false;
    if (nd.use) { const took = netTake(b, 'water', nd.use * dt); b.st.on = took >= nd.use * dt * .9; }
  }
}

// ---------------------------------------------------------------- постройки
function buildingsStep(dt) {
  fx.fxs.scope = 'world';
  for (const b of G.bMap.values()) {
    const def = BDEF[b.t], st = b.st;
    if (b.bld) { updateBuild(b, dt); continue; }
    if (def.burner) updateBurner(b, def, dt);
    if (def.station) updateStation(b, def, dt);
    if (def.crops) updateCrops(b, def, dt);
    if (def.out) updateProducer(b, def, dt);
    const u = UPD[b.t]; if (u) u(b, def, dt);
    if (def.music && st.on && (def.net?.power ? st.powered : true)) { const dd = Math.hypot(G.player.x - (b.x + .5), G.player.y - (b.y + .5)); if (G.scene === 'world' && dd <= def.music.r) G.musicNear = true; if (Math.random() < dt * .5) fx.note(b.x + .5, b.y + .5, 30); }
  }
  fx.fxs.scope = null;
}
function updateBuild(b, dt) {
  const bl = b.bld; bl.p += dt / Math.max(.2, bl.T);
  bl._d = (bl._d || 0) - dt;   // пыль и искры, пока идёт работа
  if (bl._d <= 0) { bl._d = .35 + Math.random() * .3; const x = b.x + Math.random() * b.w, y = b.y + Math.random() * b.d; fx.dust(x, y, 2); if (Math.random() < .5) fx.spark(x, y, 10 + bl.p * 30); }
  if (bl.p >= 1) finishBuild(b);
}
function updateBurner(b, def, dt) {
  const st = b.st, mx = def.burner.max;
  if (!st.lit) return;
  st.fuel -= dt;
  if (st.fuel < mx * .35) for (const o of b.nb) if (BDEF[o.t].tags.includes('feeder') && eco.take('wood', 1)) { st.fuel = Math.min(mx, st.fuel + def.burner.fuels.wood); fx.floatText(o.x + .5, o.y + .5, '+🪵', '#ffd9a0', 36); break; }
  if (st.fuel <= 0) { st.fuel = 0; st.lit = false; if (Math.hypot(G.player.x - b.x, G.player.y - b.y) < 12) toast(`${def.name} догорел(а). Подбросить дров?`); return; }
  if (Math.random() < dt * 3) { if (def.id === 'campfire') { fx.smoke(b.x + .5, b.y + .5, 24); if (Math.random() < .4) fx.spark(b.x + .5, b.y + .5, 14); } }
}
export function updateStation(b, def, dt) {
  const st = b.st, cur = st.cur;
  if (!cur) return;
  const sdef = STATIONS[cur.st];
  if (!stationHeatOk(b, cur.st)) { st.paused = true; return; }
  st.paused = false;
  if (cur.left > 0) cur.left -= dt;
  if (cur.left > 0) return;
  const r = sdef.recipes[cur.idx];
  for (const k in r.out) if (eco.space(k) < r.out[k]) { if (eco.space(k) <= 0 && (G.flags.fullWarn || 0) < G.t - 30) { G.flags.fullWarn = G.t; toast('Нет места на складе для готового — освободи место', 'warn'); } return; }
  for (const k in r.out) eco.add(k, r.out[k]);
  fx.floatText(b.x + b.w / 2, b.y + b.d / 2, Object.entries(r.out).map(([k, v]) => `+${v}${itemIcon(k)}`).join(' '), '#fff6d0', 50);
  fx.sparkle(b.x + b.w / 2, b.y + b.d / 2, 40, '#fff6b0', 5);
  if (r.mood) addBuff('mood', r.mood, 200);
  const outKey = Object.keys(r.out)[0];
  stat('crafted'); if (['campfire', 'pot', 'kettle', 'oven', 'stove', 'ferment', 'smoker', 'drying'].includes(cur.st)) { stat('cooked'); (G.stats.cookedItems ||= {})[outKey] = 1; }
  if (cur.st === 'easel') stat('paintings');
  st.cur = null;
  if (st.q > 0) { st.q--; if (stationHeatOk(b, cur.st) && canCraft(b, cur.st, r)) S.startCraft(b, cur.st, cur.idx, st.q + 1); else st.q = 0; }
}
function updateCrops(b, def, dt) {
  const gh = def.tags.includes('greenhouse'), s = season(), rainy = G.weather.type === 'rain';
  b._sc = (b._sc || 0) - dt;
  if (b._sc <= 0) { b._sc = 4; b._scare = 1; for (const o of G.bMap.values()) if (BDEF[o.t].tags.includes('scarecrow') && Math.hypot(o.x - b.x, o.y - b.y) <= 4.5) { b._scare = 1.1; break; } }
  const wet = G.comp.water.has(b.id);
  if (b._cc === undefined || (b._cc -= dt) <= 0) { b._cc = 3; b._comp = compostsNear(b); }
  for (const p of b.st.plots) {
    if (p.crop && !p.fert && b._comp.length) { const o = b._comp.find((c) => G.bMap.get(c.id) === c && c.st.ready > 0); if (o) { o.st.ready--; p.fert = 1; fx.floatText(b.x + b.w / 2, b.y + b.d / 2, 'Удобрено 🟤', '#cfe8a0', 40); fx.sparkle(b.x + b.w / 2, b.y + b.d / 2, 14, '#cfe8a0'); } }
    if (!p.crop) { p.moist = Math.max(0, p.moist - dt * .0008); continue; }
    if (rainy && !gh) p.moist = Math.min(1, p.moist + dt * .03);
    p.moist = Math.max(0, p.moist - dt * .0024 / (def.bonus ? 1.15 : 1) * (s === 1 ? 1.3 : 1));
    if (p.moist < .5 && wet) { const n = netOf(b, 'water'); if (n && n.stock >= 1) { netTake(b, 'water', 1); p.moist = 1; } }
    if (p.prog < 1 && p.moist > .05) {
      const rate = growMult(p.crop, s, gh) * (def.bonus || 1) * (p.fert ? 1.15 : 1) * (b._scare || 1) / CROPS[p.crop].grow;
      p.prog = Math.min(1, p.prog + dt * rate);
    }
  }
}
function updateProducer(b, def, dt) {
  const o = def.out, st = b.st;
  if (def.animals) {
    st.feedT = Math.max(0, st.feedT - dt); st.waterT = Math.max(0, st.waterT - dt);
    if (st.feedT < 60) for (const nb of b.nb) if (BDEF[nb.t].tags.includes('feeder_animal')) { const it = def.animals.feed.find((i) => eco.has(i, 1)); if (it && eco.take(it, 1)) { st.feedT += 300; break; } }
    if (st.waterT < 60) for (const nb of b.nb) if (BDEF[nb.t].tags.includes('trough') && netTake(nb, 'water', 1) >= .99) { st.waterT += 300; break; }
  }
  if (!o.needs || (st.feedT > 0 && st.waterT > 0)) {
    if (st.stock < o.max) {
      let speed = 1; if (def.tags.includes('hive')) speed = .5 + Math.min(2, flowersNear(b, 6) * .2);
      st.t += dt * speed;
      if (st.t >= o.every) { st.t = 0; st.stock++; if (o.bonus) for (const k in o.bonus) if (chance(o.bonus[k])) eco.add(k, 1); }
    }
  }
  if (st.stock >= 1 && b.nb.some((n) => BDEF[n.t].tags.includes('storage'))) {
    const a = eco.add(o.item, Math.floor(st.stock));
    if (a > 0) { st.stock -= a; fx.floatText(b.x + b.w / 2, b.y + b.d / 2, `+${a}${itemIcon(o.item)}`, '#fff6d0', 50); stat('collected'); if (o.item === 'egg') stat('eggs'); if (o.item === 'honey') stat('honey'); if (o.item === 'milk') stat('milk'); }
  }
}
const UPD = {
  sprinkler(b, def, dt) {
    const n = netOf(b, 'water'); b.st.on = Math.max(0, (b.st.on || 0) - dt);
    if (!n || n.stock < 1) return;
    b._t = (b._t || 0) - dt; if (b._t > 0) return; b._t = 2;
    for (const o of G.bMap.values()) { const d = BDEF[o.t]; if (!d.crops) continue; if (Math.hypot(o.x + o.w / 2 - b.x - .5, o.y + o.d / 2 - b.y - .5) > def.radius + 1) continue; for (const p of o.st.plots) if (p.crop && p.moist < .6 && netTake(b, 'water', .5) >= .45) { p.moist = 1; b.st.on = 3; } }
  },
  windmill(b, def, dt) {
    const w = G.weather.type, wind = w === 'rain' ? .7 : w === 'fog' ? .4 : w === 'snow' ? .5 : 1;
    if (!b.st.off && eco.has('wheat', 3) && eco.space('flour') >= 2) { b.st.prog = (b.st.prog || 0) + dt * wind; b.st.on = true; if (b.st.prog >= MILL_T) { b.st.prog = 0; eco.take('wheat', 3); eco.add('flour', 2); fx.floatText(b.x + 1, b.y + 1, '+2🧂', '#fff6d0', 70); stat('milled'); } }
    else b.st.on = !b.st.off && (b.st.on && Math.random() > dt * .5);
  },
  compost(b, def, dt) { if (b.st.load > 0) { b.st.t += dt; if (b.st.t >= COMPOST_T) { b.st.t = 0; b.st.load--; b.st.ready = Math.min(6, b.st.ready + 1); } } },
  chimney(b, def, dt) { if (b.nb.some((o) => BDEF[o.t].home && o.st.fireOn) && Math.random() < dt * 2) fx.smoke(b.x + .5, b.y + .5, 90); },
  home(b, def, dt) {
    b.st.glow = G.scene === b.id || !!b.st.lampOn;
  },
  sauna(b, def, dt) { if (b.st.lit && Math.random() < dt * 1.5) fx.smoke(b.x + 2.3, b.y + .4, 82); },
  hot_tub(b, def, dt) { const n = netOf(b, 'water'); b.st.full = !!n && n.stock >= 20; b.st.hot = heated(b) && b.st.full; if (b.st.hot && Math.random() < dt * 1.2) fx.steam(b.x + 1, b.y + 1, 26); },
  trough(b) { const n = netOf(b, 'water'); b.st.wet = !!n && n.stock > .5; },
  river_pump() {},
  mailbox() {},
};

// ---------------------------------------------------------------- ресурсы мира
function nodesStep(dt) {
  for (const n of G.nodeMap.values()) if (n.tm > 0) { n.tm -= dt; if (n.tm <= 0) advanceNode(n); }
}
function advanceNode(n) {
  if (n.st === 'empty') n.st = 'full';
  else if (n.st === 'stump') { n.st = 'sapling'; n.tm = rnd(420, 560); G.dirtyBlk = true; }
  else if (n.st === 'sapling') { n.st = 'full'; G.dirtyBlk = true; }
}
function spawnOn(type, pred, count, props) {
  for (let k = 0, g = 0; k < count && g < 80; g++) {
    const x = rndi(1, N - 2), y = rndi(1, N - 2), i = y * N + x;
    if (G.nAt[i] || G.bAt[i] || !pred(G.tiles[i], x, y)) continue;
    addNode(type, x, y, props ? props() : undefined); k++;
  }
}
const countNodes = (t) => { let k = 0; for (const n of G.nodeMap.values()) if (n.t === t) k++; return k; };

function onNewDay() {
  const d = day();
  stat('days');
  toast(`День ${d + 1} · ${SEASONS[season()]}`);
  for (const b of G.bMap.values()) if (BDEF[b.t].mailbox && !b.bld && !b.st.letter && chance(.5)) b.st.letter = Math.floor(Math.random() * 1000);
  if (season() === 2) for (const n of G.nodeMap.values()) if (n.t === 'appletree' && n.st === 'full' && !n.fruit && chance(.8)) n.fruit = true;
  const rainy = G.weather.type === 'rain';
  if (countNodes('mushroom') < 18 && (rainy || season() === 2 || chance(.3))) spawnOn('mushroom', (t) => t === T.FOREST, rndi(1, 3));
  if (countNodes('sticks') < 36) spawnOn('sticks', (t) => t === T.FOREST || t === T.GRASS, rndi(1, 3));
  if (countNodes('rock') < 40) spawnOn('rock', (t) => t === T.STONE, 1);
  if (countNodes('shell') < 18) spawnOn('shell', (t, x, y) => t === T.SAND && nearWaterTile(x, y), rndi(0, 2));
  if (season() < 2 && countNodes('flowers') < 50) spawnOn('flowers', (t) => t === T.GRASS, rndi(1, 3));
  if (countNodes('sandpile') < 22) spawnOn('sandpile', (t, x, y) => t === T.SAND && nearWaterTile(x, y), 1);
  onDayEvents();
}
const nearWaterTile = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, y + dy) && G.tiles[(y + dy) * N + x + dx] === T.WATER) return true; return false; };

function onNewSeason() {
  const s = season();
  toast(`Наступила ${['весна 🌱', 'лето ☀️', 'осень 🍂', 'зима ❄️'][s]}`);
  if (s === 3 && G.weather.type === 'rain') G.weather.type = 'snow';
  if (s !== 3 && G.weather.type === 'snow') G.weather.type = 'cloudy';
  if (s !== 3) for (const b of [...G.bMap.values()]) if (b.t === 'snowman') { removeBld(b); toast('Снеговик растаял… до следующей зимы ☃️'); }
  if (s === 3) toast('Зимой на улице ничего не растёт. Время теплицы, камина и горячего чая.');
  stat('seasons');
}
