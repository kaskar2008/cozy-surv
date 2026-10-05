// Питомцы, путники у костра, письма и прочие маленькие радости.
import { G, N, day, hour, isNight, season } from './state.js';
import { BDEF } from '../data/buildings/index.js';
import { FDEF } from '../data/furniture.js';
import { walkable, flood, pathFrom, T, inB } from './world.js';
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
export function updatePets(dt) {
  for (const b of G.bMap.values()) {
    const d = BDEF[b.t]; if (!d.pet) continue;
    if (!G.pets.some((p) => p.home === b.id)) {
      b.st.petT = (b.st.petT || 0) + dt;
      if (b.st.petT > 80 && G.cozy.total >= 6) {
        const x = b.x + .5, y = b.y + b.d + .6;
        G.pets.push({ kind: d.pet, home: b.id, x, y, face: 1, moving: false, sleep: false, t: 2, love: 0, col: pick(COLS[d.pet]) });
        toast(d.pet === 'cat' ? 'В кошкином доме кто-то поселился! 🐈 Погладь его (клик по коту)' : 'У будки появился пёс! 🐕 Погладь его', 'goal'); sfx(d.pet === 'cat' ? 'meow' : 'woof');
        fx.hearts(x, y, 20);
      }
    }
  }
  for (const pet of G.pets) {
    const hb = G.bMap.get(pet.home); if (!hb) continue;
    pet.moving = false;
    // ночь в доме у лежанки
    if (pet.kind === 'cat' && isNight()) {
      const bed = findCatBed();
      if (bed) { pet.in = bed.home.id; pet.x = bed.it.x + .5; pet.y = bed.it.y + .6; pet.sleep = true; continue; }
    } else if (pet.in) { pet.in = null; pet.x = hb.x + .5; pet.y = hb.y + hb.d + .6; pet.sleep = false; }
    pet.t -= dt;
    if (pet.t <= 0) {
      pet.t = rnd(6, 16); pet.tx = null; pet.sleep = false;
      const r = Math.random();
      const fire = nearestFire(pet.x, pet.y, 12);
      const p = G.player;
      if (isNight() && r < .6) { pet.sleep = true; pet.t = rnd(14, 30); if (fire) setTarget(pet, fire.x + 1.2, fire.y + .6); }
      else if (r < .22 && G.scene === 'world' && Math.hypot(p.x - pet.x, p.y - pet.y) < 16) setTarget(pet, p.x + rnd(-1.5, 1.5), p.y + rnd(-1.5, 1.5));
      else if (r < .4 && fire && (G.needs.warmth < 70 || isNight() || season() === 3)) { setTarget(pet, fire.x + rnd(-1.4, 1.4), fire.y + rnd(.6, 1.6)); pet.sleep = chance(.5); }
      else if (r < .75) setTarget(pet, hb.x + .5 + rnd(-5, 5), hb.y + hb.d + rnd(-3, 5));
      else pet.sleep = chance(.4);
    }
    if (pet.tx != null && !pet.sleep) {
      const dx = pet.tx - pet.x, dy = pet.ty - pet.y, dd = Math.hypot(dx, dy), sp = (pet.kind === 'cat' ? 1.7 : 2.3) * dt;
      if (dd < .12) pet.tx = null;
      else {
        const nx = pet.x + dx / dd * sp, ny = pet.y + dy / dd * sp;
        if (walkable(Math.floor(nx), Math.floor(ny))) { pet.x = nx; pet.y = ny; pet.moving = true; const sx = dx - dy; if (Math.abs(sx) > .05) pet.face = sx > 0 ? 1 : -1; }
        else { pet.tx = null; }
      }
    }
  }
}
function setTarget(pet, x, y) { if (walkable(Math.floor(x), Math.floor(y))) { pet.tx = x; pet.ty = y; } }
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
  const sx = dx - dy; if (Math.abs(sx) > .05) n.face = sx > 0 ? 1 : -1; n.moving = true;
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
