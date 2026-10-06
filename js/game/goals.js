// Мягкие цели: журнал «Что бы ещё сделать». Никаких штрафов — только приятные награды.
import { G, season } from './state.js';
import { BDEF } from '../data/buildings/index.js';
import { S, toast } from './api.js';
import { itemIcon } from '../data/items.js';
import * as eco from './eco.js';
import { sfx } from '../core/audio.js';

const st = (k) => G.stats[k] || 0;
const built = (id) => (G.built[id] || 0) > 0;
const anyB = (f) => { for (const b of G.bMap.values()) if (!b.bld && f(b, BDEF[b.t])) return true; return false; };
export const GOALS = [
  { id: 'fire', ic: '🔥', name: 'Первый огонь', desc: 'Построй костёр (меню «Лагерь») и разожги его. Огонь — это тепло, свет и горячая еда.', ok: () => st('fires') >= 1, reward: { sticks: 6 } },
  { id: 'gather', ic: '🧺', name: 'Всё своими руками', desc: 'Собери 10 ресурсов: хворост, камни, ягоды, волокна… Просто нажимай на них.', ok: () => st('gathered') >= 10, reward: { fiber: 6 } },
  { id: 'tent', ic: '⛺', name: 'Крыша над головой', desc: 'Поставь палатку — твой первый дом.', ok: () => built('home'), reward: { cloth: 2 } },
  { id: 'drink', ic: '💧', name: 'Глоток воды', desc: 'Напейся: из пруда, из ведра (нажми на воду в инвентаре) или из колодца.', ok: () => st('drinks') >= 1 || st('eaten') >= 1, reward: { berries: 3 } },
  { id: 'cook', ic: '🍠', name: 'Горячая еда', desc: 'Приготовь что-нибудь на костре: например, печёную картошку или рыбу.', ok: () => st('cooked') >= 1, reward: { seed_tomato: 2 } },
  { id: 'bench', ic: '🔨', name: 'Верстак', desc: 'Построй верстак: доски, верёвка, гвозди и всё остальное.', ok: () => built('workbench'), reward: { wood: 8 } },
  { id: 'furnish', ic: '🛏️', name: 'Домашний уют', desc: 'Войди в дом (нажми на него дважды) и расставь внутри 3 предмета.', ok: () => st('furn') >= 3, reward: { cloth: 4 } },
  { id: 'sleep', ic: '😴', name: 'Сладкий сон', desc: 'Поспи в постели. Ночью это особенно приятно.', ok: () => st('sleeps') >= 1, reward: { feather: 2 } },
  { id: 'plant', ic: '🌱', name: 'Первый посев', desc: 'Построй грядку, выбери семена и посади что-нибудь.', ok: () => st('planted') >= 1, reward: { seed_cabbage: 2 } },
  { id: 'harvest', ic: '🥕', name: 'Первый урожай', desc: 'Дождись, пока вырастет, и собери урожай.', ok: () => st('harvested') >= 1, reward: { seed_wheat: 3 } },
  { id: 'tea', ic: '🍵', name: 'Время чая', desc: 'Поставь чайник рядом с горящим костром, завари травяной чай и выпей его.', ok: () => st('teas') >= 1, reward: { honey: 1 } },
  { id: 'rain', ic: '🌧️', name: 'Дождь в бочку', desc: 'Построй дождесборник и дождись дождя. Внутри — песчано-угольный фильтр.', ok: () => anyB((b, d) => d.tags.includes('rain') && (b.st.water || 0) >= 2) || st('rainstock') > 0, reward: { cloth: 2 } },
  { id: 'tank', ic: '🛢️', name: 'Про запас', desc: 'Поставь бак вплотную к дождесборнику — вода начнёт копиться про запас.', ok: () => anyB((b, d) => d.tags.includes('rain') && G.comp.water.get(b.id) && S.netOf(b, 'water').cap >= 48), reward: { rope: 3 } },
  { id: 'cabin', ic: '🏠', name: 'Хижина', desc: 'Улучши палатку до хижины — комната станет просторнее.', ok: () => st('upgrades') >= 1, reward: { planks: 6 } },
  { id: 'lights', ic: '🕯️', name: 'Огоньки вечера', desc: 'Поставь три источника света: факелы, фонари или костры.', ok: () => [...G.bMap.values()].filter((b) => BDEF[b.t].light).length >= 3, reward: { wax: 2 } },
  { id: 'eggs', ic: '🥚', name: 'Свежие яйца', desc: 'Построй курятник, накорми и напои кур — и собери яйца.', ok: () => st('eggs') >= 1, reward: { feather: 2 } },
  { id: 'honey', ic: '🍯', name: 'Сладкая жизнь', desc: 'Улей и цветы рядом — мёд не заставит себя ждать.', ok: () => st('honey') >= 1, reward: { wax: 2 } },
  { id: 'fish', ic: '🎣', name: 'Рыбацкая удача', desc: 'Сделай удочку (кнопка 🛠️ — крафт) и поймай 3 рыбы.', ok: () => st('fish') >= 3, reward: { rope: 2 } },
  { id: 'bread', ic: '🍞', name: 'Запах хлеба', desc: 'Пшеница → жернова → мука → печь. Испеки хлеб.', ok: () => !!(G.stats.cookedItems || {}).bread, reward: { honey: 2 } },
  { id: 'pie', ic: '🥧', name: 'Пирог на столе', desc: 'Испеки яблочный или ягодный пирог.', ok: () => !!((G.stats.cookedItems || {}).apple_pie || (G.stats.cookedItems || {}).berry_pie), reward: { seed_strawberry: 3 } },
  { id: 'sprinkler', ic: '💦', name: 'Автополив', desc: 'Проведи трубы и поставь дождеватель рядом с грядками.', ok: () => anyB((b) => b.t === 'sprinkler' && G.comp.water.get(b.id) && S.netOf(b, 'water').stock > 0), reward: { scrap: 3 } },
  { id: 'winter', ic: '❄️', name: 'Дожить до зимы', desc: 'Дождись первого снега. Запасись дровами и горячим чаем.', ok: () => season() === 3 || st('seasons') >= 3, reward: { cloth: 4 } },
  { id: 'wint_harv', ic: '🏡', name: 'Зимний урожай', desc: 'Собери урожай в теплице, когда за стеклом снег.', ok: () => st('winterHarvest') >= 1, reward: { seed_pumpkin: 2 } },
  { id: 'solar', ic: '☀️', name: 'Электричество', desc: 'Солнечная панель + провод + фонарь: пусть вечером загорится свет.', ok: () => anyB((b, d) => d.light?.on === 'power' && b.st.powered), reward: { glass: 2 } },
  { id: 'bath', ic: '🛁', name: 'Банный день', desc: 'Прими ванну в купели, в доме или попарься в бане.', ok: () => st('baths') + st('saunas') >= 1, reward: { rope: 2 } },
  { id: 'pet', ic: '🐈', name: 'Новый друг', desc: 'Построй кошкин дом или будку — и погладь того, кто там поселится.', ok: () => st('pets') >= 1, reward: { fish: 2 } },
  { id: 'stars', ic: '🔭', name: 'Звёздная ночь', desc: 'Посмотри на звёзды в телескоп ночью.', ok: () => st('stars') >= 1, reward: { glass: 1 } },
  { id: 'letters', ic: '✉️', name: 'Весточки', desc: 'Почтовый ящик: прочти три письма.', ok: () => st('letters') >= 3, reward: { seed_flower: 3 } },
  { id: 'paint', ic: '🎨', name: 'Художник', desc: 'Нарисуй картину на мольберте и повесь её на стену.', ok: () => st('paintings') >= 1 && built('painting'), reward: { cloth: 3 } },
  { id: 'guest', ic: '🧳', name: 'Гость у костра', desc: 'Вечером к огню иногда выходят путники. Поговори с одним из них.', ok: () => st('guests') >= 1, reward: { honey: 2 } },
  { id: 'photo', ic: '📷', name: 'Фотограф', desc: 'Сделай снимок острова — кнопка 📷 сверху.', ok: () => st('photos') >= 1, reward: { flowers: 3 } },
  { id: 'rainbow', ic: '🌈', name: 'Радуга', desc: 'Иногда после дождя на небе появляется радуга. Подожди.', ok: () => st('rainbows') >= 1, reward: { honey: 1 } },
  { id: 'concert', ic: '🎹', name: 'Домашний концерт', desc: 'Сыграй на гитаре или пианино.', ok: () => st('played') >= 1, reward: { wax: 2 } },
  { id: 'garden', ic: '🧑‍🌾', name: 'Огородник', desc: 'Собери 10 урожаев.', ok: () => st('harvested') >= 10, reward: { seed_corn: 3 } },
  { id: 'snowman', ic: '⛄', name: 'Снеговик', desc: 'Зимой слепи снеговика (меню «Уют снаружи»).', ok: () => built('snowman'), reward: { cloth: 2 } },
  { id: 'house', ic: '🏡', name: 'Настоящий дом', desc: 'Улучши хижину до дома.', ok: () => anyB((b, d) => d.home && b.lvl >= 3), reward: { glass: 4 } },
  { id: 'cozy40', ic: '☕', name: 'Уютно', desc: 'Доведи «уют» до 40.', ok: () => G.cozy.total >= 40, reward: { wax: 3 } },
  { id: 'cozy100', ic: '🧸', name: 'Очень уютно', desc: 'Доведи «уют» до 100.', ok: () => G.cozy.total >= 100, reward: { glass: 4 } },
  { id: 'cozy200', ic: '🌈', name: 'Райский уголок', desc: 'Доведи «уют» до 200. Дальше можно просто жить.', ok: () => G.cozy.total >= 200, reward: { honey: 5 } },
];
export function checkGoals() {
  for (const g of GOALS) {
    if (G.goals[g.id]) continue;
    let ok = false; try { ok = g.ok(); } catch (e) { }
    if (!ok) continue;
    G.goals[g.id] = 1;
    for (const k in g.reward) eco.add(k, g.reward[k]);
    toast(`${g.ic} Цель выполнена: ${g.name}  ·  ${Object.entries(g.reward).map(([k, v]) => `+${v}${itemIcon(k)}`).join(' ')}`, 'goal');
    sfx('chime');
    S.hooks.onGoal && S.hooks.onGoal(g);
  }
}
export const nextGoals = (n = 3) => GOALS.filter((g) => !G.goals[g.id]).slice(0, n);
