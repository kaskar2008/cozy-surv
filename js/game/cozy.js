// Подсчёт «уюта»: вклад построек и мебели + комбинации (синергии).
import { G } from './state.js';
import { BDEF } from '../data/buildings/index.js';
import { FDEF } from '../data/furniture.js';
import { isHot } from './nets.js';
import { flowersNear } from './api.js';

const dist = (a, b) => Math.hypot(a.x + a.w / 2 - b.x - b.w / 2, a.y + a.d / 2 - b.y - b.d / 2);
export const COZY_LEVELS = [[0, 'Скромно'], [15, 'Обжито'], [40, 'Уютно'], [80, 'Очень уютно'], [140, 'Тёплый дом мечты'], [220, 'Райский уголок']];
export function cozyLevel(t) { let i = 0; for (let k = 0; k < COZY_LEVELS.length; k++) if (t >= COZY_LEVELS[k][0]) i = k; return { name: COZY_LEVELS[i][1], next: COZY_LEVELS[i + 1]?.[0] ?? null, prev: COZY_LEVELS[i][0] }; }

const OUT_SYN = [
  { id: 'campfire_seats', name: 'Посиделки у костра', pts: 6, hint: 'Горящий костёр и 2 места для сидения рядом (пенёк, скамейка)', test: (bs) => bs.some((f) => isHot(f) && BDEF[f.t].id === 'campfire' && bs.filter((s) => BDEF[s.t].sit && dist(f, s) <= 3.6).length >= 2) },
  { id: 'evening_tea', name: 'Вечерний чай', pts: 3, hint: 'Чайник вплотную к горящему огню и место для сидения рядом', test: (bs) => bs.some((k) => k.t === 'kettle' && k.nb.some(isHot) && bs.some((s) => BDEF[s.t].sit && dist(k, s) <= 4)) },
  { id: 'bee_meadow', name: 'Пчелиный луг', pts: 4, hint: 'Улей с множеством цветов вокруг', test: (bs) => bs.some((h) => h.t === 'beehive' && flowersNear(h, 6) >= 5) },
  { id: 'dream_garden', name: 'Огород мечты', pts: 4, hint: '3 грядки, пугало и компост рядом', test: (bs) => bs.filter((p) => BDEF[p.t].crops).length >= 3 && bs.some((s) => s.t === 'scarecrow') && bs.some((s) => s.t === 'compost') },
  { id: 'fenced_yard', name: 'Свой двор', pts: 3, hint: '8 секций забора или изгороди и калитка', test: (bs) => bs.filter((f) => BDEF[f.t].strand === 'fence' || BDEF[f.t].strand === 'hedge').length >= 8 && bs.some((g) => g.t === 'gate') },
  { id: 'paths', name: 'Тропинки', pts: 4, hint: '10 клеток дорожек', test: (bs) => bs.filter((f) => f.t.startsWith('path_')).length >= 10 },
  { id: 'porch_garden', name: 'Крыльцо в цветах', pts: 3, hint: 'Крыльцо и клумба рядом', test: (bs) => bs.some((p) => p.t === 'porch' && bs.some((f) => f.t === 'flower_bed' && dist(p, f) <= 5)) },
  { id: 'evening_lights', name: 'Вечерние огни', pts: 4, hint: '4 источника света', test: (bs) => bs.filter((f) => BDEF[f.t].light).length >= 4 },
  { id: 'bathhouse', name: 'Банный комплекс', pts: 4, hint: 'Баня и купель', test: (bs) => bs.some((f) => f.t === 'sauna') && bs.some((f) => f.t === 'hot_tub') },
  { id: 'starry', name: 'Звёздная площадка', pts: 5, hint: 'Телескоп и плед для пикника рядом', test: (bs) => bs.some((t) => t.t === 'telescope' && bs.some((p) => p.t === 'picnic' && dist(t, p) <= 5)) },
  { id: 'farmstead', name: 'Хозяйство', pts: 4, hint: 'Курятник, загон и поилка', test: (bs) => ['coop', 'goat_pen', 'trough'].every((k) => bs.some((f) => f.t === k)) },
  { id: 'pond_nook', name: 'Уголок у воды', pts: 5, hint: 'Пруд и причал/скамейка', test: (bs) => (G.stats.ponds || 0) > 0 && bs.some((f) => f.t === 'dock' || f.t === 'bench' || f.t === 'garden_set') },
  { id: 'with_pet', name: 'Пушистый друг', pts: 3, hint: 'Питомец поселился у тебя', test: () => G.pets.length > 0 },
  { id: 'wind_music', name: 'Музыка и ветер', pts: 3, hint: 'Ветряные колокольчики и вертушка', test: (bs) => bs.some((f) => f.t === 'windchime') && bs.some((f) => f.t === 'pinwheel') },
];
const has = (items, ids) => items.filter((i) => ids.includes(i.t));
const nearAny = (a, list, r) => list.some((b) => dist(a, b) <= r);
const SEAT = ['armchair', 'sofa', 'rocking_chair'], LIGHTS = ['oil_lamp', 'floor_lamp', 'sconce'];
const IN_SYN = [
  { id: 'sleep_nook', name: 'Спальный уголок', pts: 6, hint: 'Кровать, тумбочка рядом и лампа поблизости (сон ещё глубже)', test: (it, home) => has(it, ['bed', 'double_bed']).some((b) => nearAny(b, has(it, ['nightstand']), 2.2) && nearAny(b, has(it, LIGHTS), 3.6)) },
  { id: 'fireside', name: 'У камина', pts: 8, hint: 'Камин или печка, кресло/диван и ковёр рядом', test: (it) => has(it, ['fireplace', 'wood_stove']).some((f) => nearAny(f, has(it, SEAT), 3.4) && nearAny(f, it.filter((i) => FDEF[i.t].flat), 3.6)) },
  { id: 'reading_nook', name: 'Читальный уголок', pts: 6, hint: 'Книжный шкаф, кресло и свет рядом', test: (it) => has(it, ['bookshelf']).some((b) => nearAny(b, has(it, SEAT), 3.4) && nearAny(b, has(it, LIGHTS), 3.8)) },
  { id: 'dining', name: 'Обеденная зона', pts: 5, hint: 'Стол и 2 стула вокруг', test: (it) => it.filter((t) => FDEF[t.t].dining).some((t) => it.filter((s) => FDEF[s.t].seat && dist(t, s) <= 2.6).length >= 2) },
  { id: 'kitchen', name: 'Настоящая кухня', pts: 6, hint: 'Плита, стол и раковина рядом', test: (it) => has(it, ['stove']).some((s) => nearAny(s, has(it, ['sink']), 3.2) && nearAny(s, has(it, ['counter']), 3.2)) },
  { id: 'window_light', name: 'Оконный уют', pts: 3, hint: 'Окно и шторы рядом', test: (it) => has(it, ['window', 'window_big']).some((w) => has(it, ['curtains']).some((c) => c.wall === w.wall && Math.abs(c.x - w.x) <= 2)) },
  { id: 'green_corner', name: 'Зелёный уголок', pts: 5, hint: '3 растения', test: (it) => has(it, ['plant_pot', 'big_plant', 'hanging_plant']).length >= 3 },
  { id: 'artist', name: 'Мастерская художника', pts: 4, hint: 'Мольберт и окно', test: (it) => has(it, ['easel_in']).length && has(it, ['window', 'window_big']).length },
  { id: 'music_evening', name: 'Музыкальный вечер', pts: 5, hint: 'Музыка и кресло/диван', test: (it) => has(it, ['record_player', 'guitar', 'piano']).some((m) => nearAny(m, has(it, SEAT), 4.4)) },
  { id: 'bathroom', name: 'Ванная комната', pts: 5, hint: 'Ванна и раковина', test: (it) => has(it, ['bathtub']).length && has(it, ['sink']).length },
  { id: 'cat_paradise', name: 'Кошачий рай', pts: 5, hint: 'Лежанка и кот', test: (it) => has(it, ['cat_bed']).length && G.pets.some((p) => p.kind === 'cat') },
  { id: 'gallery', name: 'Мини-галерея', pts: 4, hint: '3 картины', test: (it) => has(it, ['painting']).length >= 3 },
  { id: 'warm_home', name: 'Тёплый дом', pts: 6, hint: 'Печка/камин, ковёр и не меньше 10 предметов', test: (it, home) => home.lvl >= 2 && has(it, ['fireplace', 'wood_stove']).length && it.some((i) => FDEF[i.t].flat) && it.length >= 10 },
];
export const ALL_SYN = [...OUT_SYN.map((s) => ({ ...s, where: 'out' })), ...IN_SYN.map((s) => ({ ...s, where: 'in' }))];

export function computeCozy() {
  const list = []; let out = 0, inn = 0;
  const bs = [...G.bMap.values()], cnt = {};
  for (const b of bs) { const d = BDEF[b.t]; if (!d.cozy) continue; cnt[b.t] = (cnt[b.t] || 0) + 1; out += d.cozy * (cnt[b.t] <= 3 ? 1 : .35); }
  out += Math.min(3, G.stats.ponds || 0) * 6;
  for (const s of OUT_SYN) { let ok = false; try { ok = s.test(bs); } catch (e) { } if (ok) { out += s.pts; list.push({ id: s.id, name: s.name, pts: s.pts }); } }
  for (const home of bs) {
    if (!BDEF[home.t].home) continue;
    const items = home.in.items, c2 = {}; let sub = 0;
    for (const it of items) { const d = FDEF[it.t]; if (!d.cozy) continue; c2[it.t] = (c2[it.t] || 0) + 1; sub += d.cozy * (c2[it.t] <= 2 ? 1 : .4); }
    for (const s of IN_SYN) { let ok = false; try { ok = s.test(items, home); } catch (e) { } if (ok) { sub += s.pts; if (!list.some((l) => l.id === s.id)) list.push({ id: s.id, name: s.name, pts: s.pts }); } }
    inn += sub;
  }
  G.cozy = { total: Math.round(out * .8 + inn), out: Math.round(out * .8), inn: Math.round(inn), list };
}
