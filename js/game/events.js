// Питомцы, путники у костра, письма и прочие маленькие радости.
import { G, N, DAY, day, hour, isNight, season } from './state.js';
import { BDEF } from '../data/buildings/index.js';
import { FDEF } from '../data/furniture.js';
import { walkable, flood, pathFrom, T, inB, ti, addNode, removeNode } from './world.js';
import { petWord } from '../data/pets.js';
import { S, toast, stat, addBuff } from './api.js';
import { isHot } from './nets.js';
import * as eco from './eco.js';
import { itemIcon, itemName } from '../data/items.js';
import * as fx from '../render/fx.js';
import { rnd, rndi, pick, chance } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { goTo } from './player.js';

// ---------------------------------------------------------------- питомцы
const COLS = { cat: ['#e8a05a', '#c9c9d0', '#4a4a52', '#f0e0c8'], dog: ['#c9915f', '#8a6a4a', '#e8d8b8'] };
const POOP_LIFE = DAY * 2;   // через двое суток какашки сами исчезают
let poopAcc = 0;
function decayPoops(dt) {
  poopAcc += dt; if (poopAcc < 5) return; poopAcc = 0;
  for (const n of [...G.nodeMap.values()]) {
    if (n.t !== 'poop') continue;
    n.born ??= G.t;   // старые сохранения: отсчёт с момента загрузки
    if (G.t - n.born >= POOP_LIFE) removeNode(n);
  }
}
export function updatePets(dt) {
  decayPoops(dt);
  for (const b of G.bMap.values()) {
    const d = BDEF[b.t]; if (!d.pet || b.bld) continue;
    if (!G.pets.some((p) => p.home === b.id)) {
      b.st.petT = (b.st.petT || 0) + dt;
      if (b.st.petT > 80 && G.cozy.total >= 6) {
        const sp = nearOk(b.x + .5, b.y + b.d + .6) || [b.x + .5, b.y + b.d + .6], x = sp[0], y = sp[1];
        G.pets.push({ kind: d.pet, home: b.id, x, y, face: 1, moving: false, sleep: false, t: 2, love: 0, bond: 40, hunger: 70, poopT: rnd(70, 140), col: pick(COLS[d.pet]) });
        toast(d.pet === 'cat' ? 'В кошкином доме кто-то поселился! 🐈 Погладь его (нажми на кота)' : 'У будки появился пёс! 🐕 Погладь его', 'goal'); sfx(d.pet === 'cat' ? 'meow' : 'woof');
        fx.hearts(x, y, 20);
      }
    }
  }
  for (const pet of G.pets) {
    const hb = G.bMap.get(pet.home); if (!hb) continue;
    pet.moving = false;
    // старые сохранения: новые поля
    pet.hunger ??= 70; pet.bond ??= Math.min(100, 30 + (pet.love || 0) * 3); pet.poopT ??= rnd(70, 140);
    pet.hunger = Math.max(0, pet.hunger - dt * (pet.sleep ? .08 : .16));       // от «сыт» до «голоден» ~10 минут
    if (pet.ask > 0) pet.ask -= dt;
    if (!pet.in && !petOk(Math.floor(pet.x), Math.floor(pet.y))) { const q = nearOk(hb.x + .5, hb.y + hb.d + .6) || nearOk(pet.x, pet.y); if (q) { pet.x = q[0]; pet.y = q[1]; pet.tx = null; } }   // постройку поставили поверх — выводим
    // долго не кормили — идёт добывать еду сам (и немного обижается)
    if (pet.hunger <= 0 && !pet.in && !pet.job) { pet.starve = (pet.starve || 0) + dt; if (pet.starve > 40) startForage(pet, hb); } else if (pet.hunger > 0) pet.starve = 0;
    // ночью питомцы идут в свой домик (кошкин дом / будка) спать, утром выходят
    const night = isNight();
    if (pet.in) {
      if (night && pet.in === 'house') { pet.sleep = true; hb.st.sleeping = true; continue; }
      pet.in = null; hb.st.sleeping = false; pet.sleep = false; pet.t = rnd(2, 6);
      const q = nearOk(hb.x + .5, hb.y + hb.d + .6); if (q) { pet.x = q[0]; pet.y = q[1]; }
    }
    if (night && !pet.job) { pet.job = 'bed'; pet.jr = 0; pet.sleep = false; pet.ask = 0; setTarget(pet, hb.x + .5, hb.y + hb.d + .6); }
    // голоса: собаки лают, кошки мяукают
    if (!pet.sleep && !pet.job && G.scene === 'world') {
      pet.voiceT = (pet.voiceT ?? rnd(20, 60)) - dt;
      if (pet.voiceT <= 0) {
        pet.voiceT = rnd(45, 120);
        if (Math.hypot(G.player.x - pet.x, G.player.y - pet.y) < 22) { sfx(pet.kind === 'cat' ? 'meow' : 'woof'); fx.floatText(pet.x, pet.y, pet.kind === 'cat' ? 'Мяу' : 'Гав!', '#fff6d0', 30); }
      }
    }
    if (pet.job) petJob(pet, hb, dt);
    else pet.t -= dt;
    if (pet.t <= 0 && !pet.job) {
      pet.t = rnd(6, 16); pet.tx = null; pet.sleep = false;
      const r = Math.random();
      const fire = nearestFire(pet.x, pet.y, 12);
      const p = G.player;
      if (isNight() && r < .6) { pet.sleep = true; pet.t = rnd(14, 30); if (fire) setTarget(pet, fire.x + 1.2, fire.y + .6); }
      else if (r < .08 + pet.bond * .003 && G.scene === 'world' && Math.hypot(p.x - pet.x, p.y - pet.y) < 16) { setTarget(pet, p.x + rnd(-1.5, 1.5), p.y + rnd(-1.5, 1.5)); pet.ask = 30; }   // пришёл «за ласкою»; чем теплее отношение, тем чаще
      else if (r < .4 && fire && (G.needs.warmth < 70 || isNight() || season() === 3)) { setTarget(pet, fire.x + rnd(-1.4, 1.4), fire.y + rnd(.6, 1.6)); pet.sleep = chance(.5); }
      else if (r < .75) setTarget(pet, hb.x + .5 + rnd(-5, 5), hb.y + hb.d + rnd(-3, 5));
      else pet.sleep = chance(.4);
    }
    if (pet.kind === 'dog' && !pet.in && !pet.sleep && !pet.job) { pet.poopT -= dt; if (pet.poopT <= 0) dropPoop(pet); }
    if (pet.tx != null && !pet.sleep) {
      const dx = pet.tx - pet.x, dy = pet.ty - pet.y, dd = Math.hypot(dx, dy), sp = (pet.kind === 'cat' ? 1.7 : 2.3) * dt;
      if (dd < .12) pet.tx = null;
      else {
        const nx = pet.x + dx / dd * sp, ny = pet.y + dy / dd * sp;
        if (petOk(Math.floor(nx), Math.floor(ny))) { pet.x = nx; pet.y = ny; pet.moving = true; pet.ang = Math.atan2(dy, dx); const sx = dx - dy; if (Math.abs(sx) > .05) pet.face = sx > 0 ? 1 : -1; }
        else { pet.tx = null; }
      }
    }
  }
}
function dropPoop(pet) {
  const x = Math.floor(pet.x), y = Math.floor(pet.y), k = inB(x, y) ? ti(x, y) : -1;
  pet.poopT = rnd(120, 260); pet.tx = null; pet.t = Math.max(pet.t, 2.5);        // замирает на минутку
  if (k < 0 || G.nAt[k] || G.bAt[k] || G.tiles[k] === T.WATER) return;
  let n = 0; for (const o of G.nodeMap.values()) if (o.t === 'poop') n++;
  if (n >= 6) return;
  addNode('poop', x, y, { st: 'full', born: G.t }); stat('poops');
}
function startForage(pet, hb) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * 6.283, r = rnd(6, 10), x = hb.x + Math.cos(a) * r, y = hb.y + Math.sin(a) * r;
    if (petOk(Math.floor(x), Math.floor(y))) { pet.job = 'forage'; pet.jt = null; pet.sleep = false; pet.ask = 0; setTarget(pet, x, y); return; }
  }
  pet.starve = 20;   // не нашёл куда идти — попробует позже
}
function petJob(pet, hb, dt) {
  if (pet.job === 'bed') {
    if (!isNight()) { pet.job = null; return; }
    if (pet.tx == null) {
      const near = Math.hypot(pet.x - hb.x - .5, pet.y - hb.y - hb.d) < 1.6;
      if (near || (pet.jr = (pet.jr || 0) + 1) >= 6) { pet.in = 'house'; pet.job = null; pet.sleep = true; hb.st.sleeping = true; pet.jr = 0; }
      else setTarget(pet, hb.x + .5, hb.y + hb.d + .6);
    }
    return;
  }
  if (pet.job === 'forage' && pet.tx == null) {
    if (pet.jt == null) pet.jt = rnd(5, 8);             // роется на месте
    pet.jt -= dt;
    if (pet.jt <= 0) {
      pet.jt = null; pet.job = 'return'; setTarget(pet, hb.x + .5, hb.y + hb.d + .6);
      pet.hunger = Math.min(100, pet.hunger + 45); pet.bond = Math.max(0, pet.bond - 8); pet.starve = 0;
      fx.floatText(pet.x, pet.y, '💔', '#ffd0d0', 30);
      toast(`${petWord(pet)} не дождался еды и нашёл себе что-то сам… Немного обиделся 💔`, 'warn');
    }
  } else if (pet.job === 'return' && pet.tx == null) {
    if (Math.hypot(pet.x - hb.x - .5, pet.y - hb.y - hb.d) > 2.2 && (pet.jr = (pet.jr || 0) + 1) < 6) setTarget(pet, hb.x + .5, hb.y + hb.d + .6);
    else { pet.job = null; pet.jr = 0; pet.t = rnd(4, 8); }
  }
}
// куда питомцу можно ступать: свободная земля, дорожки, настил, калитка — но не постройки, грядки и стройки
function petOk(tx, ty) {
  if (!walkable(tx, ty)) return false;
  const id = G.bAt[ti(tx, ty)]; if (!id) return true;
  const b = G.bMap.get(id), d = b && BDEF[b.t];
  return !!d && !b.bld && !!d.walk && !d.crops;
}
// ближайшая допустимая клетка (до 3 клеток вокруг), центр клетки
function nearOk(x, y) {
  const cx = Math.floor(x), cy = Math.floor(y); if (petOk(cx, cy)) return [x, y];
  for (let r = 1; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r && petOk(cx + dx, cy + dy)) return [cx + dx + .5, cy + dy + .5];
  return null;
}
function setTarget(pet, x, y) { const p = nearOk(x, y); if (p) { pet.tx = p[0]; pet.ty = p[1]; } }
function nearestFire(x, y, r) {
  let best = null, bd = r;
  for (const b of G.bMap.values()) if (BDEF[b.t].warm && isHot(b)) { const d = Math.hypot(b.x + .5 - x, b.y + .5 - y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function findCatBed() {
  for (const h of G.bMap.values()) if (BDEF[h.t].home && h.in) { const it = h.in.items.find((i) => i.t === 'cat_bed'); if (it) return { home: h, it }; }
  return null;
}

// ---------------------------------------------------------------- путник
const STORIES = [
  'Я шёл вдоль берега три дня. Увидел твой огонёк — и ноги сами привели. Хороший у вас остров.',
  'Говорят, где-то на севере есть остров, где всегда пахнет хлебом. Кажется, это он.',
  'Я собираю истории у костров. Твоя — тёплая. Можно я её запомню?',
  'В моей деревне говорят: если костёр горит всю ночь, утро будет добрым.',
  'Спасибо за тепло. Я давно не слышал, как тихо трещат дрова.',
  'Видел на дальнем берегу огромного оленя. Он посмотрел и ушёл. Никто не торопился.',
  'Когда-то я тоже строил дом. Потом понял, что главное — чай и тишина.',
];
const GIFTS = [{ seed_pumpkin: 2 }, { honey: 2 }, { seed_corn: 3 }, { seed_strawberry: 3 }, { jam: 2 }, { seed_herb: 3, wax: 2 }, { cheese: 2 }, { glass: 2, wax: 1 }, { seed_cabbage: 3 }, { feather: 3, cloth: 2 }];
export function onDayEvents() {
  if (!G.npc && G.cozy.total >= 12 && chance(.42) && [...G.bMap.values()].some((b) => BDEF[b.t].id === 'campfire')) G.flags.travelerDay = day();
}
export function updateNPC(dt) {
  let n = G.npc;
  if (!n) {
    if (G.flags.travelerDay === day() && hour() >= 17 && hour() < 22) {
      const fire = [...G.bMap.values()].find((b) => BDEF[b.t].id === 'campfire' && isHot(b));
      if (!fire) return;
      const spot = spawnPoint(fire);
      if (!spot) { G.flags.travelerDay = -1; return; }
      G.npc = { x: spot.x + .5, y: spot.y + .5, face: 1, path: spot.path, fire: fire.id, state: 'arrive', t: 0, gift: true, sit: false, moving: false };
      G.flags.travelerDay = -1;
      toast('У костра кто-то показался на тропе… 🧳');
    }
    return;
  }
  n.moving = false;
  const fire = G.bMap.get(n.fire);
  if (n.state === 'arrive') {
    if (n.path && n.path.length) stepAlong(n, dt, 2.2);
    else { n.state = 'sit'; n.sit = true; n.t = 0; }
  } else if (n.state === 'sit') {
    n.t += dt;
    if (!fire || !isHot(fire) || n.t > 150 || hour() > 23.5 || (!n.gift && n.t > 40)) { n.state = 'leave'; n.sit = false; n.leaveT = 0; n.path = pathAway(n); }
  } else if (n.state === 'leave') {
    n.leaveT += dt;
    if (n.path && n.path.length) stepAlong(n, dt, 2.2); else G.npc = null;
    if (n.leaveT > 40) G.npc = null;
  }
}
function stepAlong(n, dt, sp) {
  const tg = n.path[0], tx = tg.x + .5, ty = tg.y + .5, dx = tx - n.x, dy = ty - n.y, dd = Math.hypot(dx, dy), step = sp * dt;
  if (dd <= step) { n.x = tx; n.y = ty; n.path.shift(); } else { n.x += dx / dd * step; n.y += dy / dd * step; }
  n.ang = Math.atan2(dy, dx); const sx = dx - dy; if (Math.abs(sx) > .05) n.face = sx > 0 ? 1 : -1; n.moving = true;
}
function spawnPoint(fire) {
  const f = flood(N, N, (x, y) => G.blk[y * N + x] === 1, Math.floor(fire.x), Math.floor(fire.y + 1.5));
  let best = null, bd = 0;
  for (let k = 0; k < 200; k++) {
    const x = rndi(2, N - 3), y = rndi(2, N - 3), i = y * N + x;
    if (f.dist[i] > 14 && f.dist[i] < 40 && f.dist[i] > bd - 6 && !G.blk[i]) { bd = f.dist[i]; best = [x, y]; if (bd > 24) break; }
  }
  if (!best) return null;
  const path = pathFrom(f, best[0], best[1]); if (!path) return null;
  path.reverse(); const full = [...path, { x: Math.floor(fire.x + 1.5), y: Math.floor(fire.y + 1) }].filter((p) => walkable(p.x, p.y));
  return { x: best[0], y: best[1], path: full };
}
function pathAway(n) {
  const f = flood(N, N, (x, y) => G.blk[y * N + x] === 1, Math.floor(n.x), Math.floor(n.y));
  let best = null, bd = 0;
  for (let k = 0; k < 120; k++) { const x = rndi(2, N - 3), y = rndi(2, N - 3), i = y * N + x; if (f.dist[i] > bd && f.dist[i] < 36) { bd = f.dist[i]; best = [x, y]; } }
  return best ? pathFrom(f, best[0], best[1]) : [];
}
S.hooks.travelerTalk = () => {
  const n = G.npc; if (!n) return;
  const p = G.player;
  const talk = () => { if (!n.gift) { toast('«Спасибо за тепло. Мне пора в путь.»'); return; } n.gift = false; const g = pick(GIFTS); for (const k in g) eco.add(k, g[k]); stat('guests'); addBuff('mood', 14, 300); S.hooks.openTraveler && S.hooks.openTraveler(pick(STORIES), g); sfx('letter'); };
  goTo(Math.floor(n.x + 1), Math.floor(n.y), talk) || talk();
};

// ---------------------------------------------------------------- письма
export const LETTERS = [
  { from: 'Тётя Маша', text: 'Милая моя, как ты там на своём острове? Я тут варенье сварила и подумала о тебе. Шлю семена — посади, пусть растут. Не торопись, всё само вырастет в своё время.', gift: { seed_pumpkin: 2, jam: 1 } },
  { from: 'Старый Ёж', text: 'Привет, сосед! Это я, Ёж, с другого берега. Вижу дымок над твоим островом — значит, у тебя всё хорошо. Кладу в конверт немного мёда.', gift: { honey: 2 } },
  { from: 'Анна с маяка', text: 'Здравствуй! Сегодня закат был такой, что я забыла ужин. Отправляю тебе кусочек воска для свечей — пусть вечером будет светло и тихо.', gift: { wax: 3 } },
  { from: 'Дедушка Фёдор', text: 'Помнишь, как мы с тобой сидели у костра? Жизнь — это когда никуда не надо. Держи горсть зёрен. Самое вкусное вырастает не сразу.', gift: { seed_wheat: 4 } },
  { from: 'Соседка Лиза', text: 'Привет! Я вышила тебе маленький кусочек ткани на скатерть — вдруг пригодится. Приезжай в гости, когда будет настроение!', gift: { cloth: 3 } },
  { from: 'Рыбак Тимофей', text: 'Сегодня клёв был отличный! Тебе передаю пару рыбин — на уху. Погода завтра, кажется, будет дождливая — готовь чайник.', gift: { fish: 2 } },
  { from: 'Подруга Вера', text: 'Знаешь, я тебе завидую по-хорошему. У тебя есть чайник, костёр и тишина. Присылаю цветочные семена — посади у дома.', gift: { seed_flower: 4 } },
  { from: 'Неизвестный отправитель', text: 'Просто хотел сказать: у вас очень уютно. Это видно даже с воды. Спасибо, что вы есть.', gift: { shell: 2, flowers: 2 } },
  { from: 'Бабушка Аня', text: 'Внученька, пирожков не пришлю — дорога дальняя. А вот перышек подушку набить — пожалуйста. Спи сладко!', gift: { feather: 4 } },
  { from: 'Почтальон Гриша', text: 'Тут на вашем острове я теперь вроде как регулярный гость. Привёз немного стекла — для окон и фонарей. Чайку бы...', gift: { glass: 2, scrap: 2 } },
];
S.hooks.openLetter = (b) => {
  const L = LETTERS[(b.st.letter || 0) % LETTERS.length];
  b.st.letter = null; stat('letters');
  for (const k in L.gift) eco.add(k, L.gift[k]);
  addBuff('mood', 8, 200); sfx('letter');
  S.hooks.showLetter && S.hooks.showLetter(L);
};
export function updateEvents(dt) { }
