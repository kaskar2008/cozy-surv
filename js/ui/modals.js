// Модальные окна: рюкзак, крафт, журнал, меню, гардероб, письма.
import { h } from '../core/util.js';
import { G, day, season, isNight } from '../game/state.js';
import { ITEMS, CATS, itemIcon, itemName } from '../data/items.js';
import { STATIONS } from '../data/recipes.js';
import * as eco from '../game/eco.js';
import * as api from '../game/api.js';
import { S, toast as _t } from '../game/api.js';
import { GOALS } from '../game/goals.js';
import { ALL_SYN, cozyLevel } from '../game/cozy.js';
import { BDEF } from '../data/buildings/index.js';
import { SHIRTS, HATS } from '../render/entities.js';
import { WALL_STYLES, FLOOR_STYLES, WALL_NAMES, FLOOR_NAMES } from '../data/furniture.js';
import { homeOf, setStyle } from '../game/interior.js';
import { openModal, closeModal, toast } from './ui.js';
import { save, wipe } from '../game/save.js';
import { isMuted, setMuted, initAudio } from '../core/audio.js';
import { UI } from './state.js';
import { buffSum } from '../game/api.js';

export function openInventory() {
  const body = h('div', { class: 'inv' });
  const draw = () => {
    body.replaceChildren();
    for (const [cat, name] of Object.entries(CATS)) {
      const items = Object.entries(ITEMS).filter(([id, it]) => it.c === cat && eco.count(id) > 0);
      if (!items.length) continue;
      body.append(h('h3', null, name + (cat === 'tool' ? '' : `  ·  лимит ${eco.capOf(items[0][0])}`)),
        h('div', { class: 'inv-grid' }, ...items.map(([id, it]) => h('button', { class: 'inv-it' + (it.e ? ' use' : ''), title: it.e ? 'Нажми, чтобы съесть/выпить' : it.n, onclick: () => { if (it.e) { closeModal(); api.eat(id); } } },
          h('span', { class: 'ic' }, it.ic), h('b', null, eco.count(id)), h('small', null, it.n),
          it.e ? h('em', null, [it.e.h && `🍞+${it.e.h}`, it.e.t && `💧+${it.e.t}`, it.e.m && `😊+${it.e.m}`, it.e.w && `🔥+${it.e.w}`].filter(Boolean).join(' ')) : null))));
    }
    if (!body.children.length) body.append(h('p', null, 'Рюкзак пуст. Собирай всё, что видишь на земле!'));
  };
  draw();
  openModal('🎒 Рюкзак', body, { cls: 'wide' });
}
export function openCraft() {
  const st = STATIONS.hand;
  const list = h('div', { class: 'recipes big' });
  const draw = () => {
    list.replaceChildren(...st.recipes.filter((r) => !r.hidden).map((r, idx) => {
      const can = eco.canAfford(r.in) && !(r.once && Object.keys(r.out).every((k) => eco.has(k)));
      return h('div', { class: 'recipe' + (can ? '' : ' off') },
        h('div', { class: 'r-out' }, h('span', { class: 'big' }, itemIcon(Object.keys(r.out)[0])), h('div', null, h('b', null, (r.name || Object.keys(r.out).map(itemName).join(', ')) + (Object.values(r.out)[0] > 1 ? ` ×${Object.values(r.out)[0]}` : '')), h('small', null, `⏱ ${r.t} с${r.once ? ' · инструмент' : ''}`))),
        h('div', { class: 'r-in' }, ...Object.entries(r.in).map(([k, n]) => h('span', { class: 'chip ' + (eco.count(k) >= n ? '' : 'miss') }, `${n}${itemIcon(k)} ${itemName(k)}`))),
        h('div', { class: 'r-btn' }, h('button', { disabled: !can, onclick: () => { closeModal(); api.handCraft(idx); } }, r.once && Object.keys(r.out).every((k) => eco.has(k)) ? 'Уже есть' : 'Смастерить')));
    }));
  };
  draw();
  openModal('🛠️ Крафт', h('div', null, h('p', { class: 'muted' }, 'Простые вещи можно сделать прямо на ходу. Для досок, гвоздей и всего остального нужен верстак, а для готовки — костёр, котелок, печь.'), list), { cls: 'wide' });
}

const CONTROLS_PC = [
  ['ЛКМ', 'идти / собирать / выбрать постройку'], ['ПКМ + перетаскивание / два пальца по тачпаду', 'двигать камеру'], ['Колесо / щипок / +−', 'приблизить, отдалить'], ['WASD / стрелки', 'камера'], ['Пробел', 'камера к персонажу'],
  ['B', 'свернуть панель строительства'], ['R', 'повернуть постройку'], ['Shift + ЛКМ', 'не выходить из режима постройки (ставить подряд)'], ['X', 'режим сноса'], ['Esc', 'отмена / закрыть / меню'], ['I · C · J', 'рюкзак · крафт · журнал'],
  ['P · 1 · 2 · 3', 'пауза · скорость ×1 ×2 ×4'], ['F', 'сфотографировать остров'], ['M', 'звук'], ['Двойной клик по дому', 'войти внутрь'],
];
const CONTROLS_TOUCH = [
  ['Касание', 'идти / собирать / выбрать постройку'], ['Двойное касание дома', 'войти внутрь'], ['Один палец', 'двигать камеру'], ['Два пальца', 'масштаб и камера'],
  ['⌄ над панелью построек', 'свернуть / развернуть панель'], ['✓ Поставить', 'подтвердить постройку'], ['↻', 'повернуть постройку'], ['✕', 'отменить постройку'],
  ['Вкладка «Снести»', 'режим сноса'], ['🎯 🎒 🛠️ 📖 📷 🔊 ⚙️', 'к персонажу · рюкзак · крафт · журнал · фото · звук · меню'], ['⏸ ▶ ⏩ ⏭', 'пауза и скорость времени'],
];
export const isTouch = () => UI.touch || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

// ---------------------------------------------------------------- состояние персонажа
const NEED_INFO = [
  ['thirst', '💧', 'Жажда', '#5aa8e0', 'Убывает со временем (во сне медленнее). Совсем без воды настроение сильно падает.',
    'Напиться можно у бака, колодца или крана в доме, из ведра или из рек и озёр. Вода есть и в рюкзаке.'],
  ['hunger', '🍞', 'Сытость', '#e0a24a', 'Убывает со временем (во сне медленнее). Голод портит настроение.',
    'Ешь ягоды, овощи и готовую еду из рюкзака. Готовка у костра и на плите сытнее и добавляет настроения.'],
  ['energy', '⚡', 'Бодрость', '#8fcf6a', 'Убывает, пока ты на ногах. Когда её мало, работа идёт медленнее.',
    'Поспи: в доме, в палатке, на гамаке или спальнике. Короткая дрёма даёт немного сил днём.'],
  ['warmth', '🔥', 'Тепло', '#e8714a', 'Плавно тянется к температуре вокруг. Холоднее зимой, ночью, в дождь и снег; тепло у огня и в натопленном доме.',
    'Подойди к костру или печи, зайди в дом. Горячая ванна согревает сразу и надолго.'],
  ['mood', '😊', 'Настроение', '#e87aa8', 'Складывается из остальных шкал, уюта острова, музыки, погоды и приятных занятий.',
    'Строй уют (мебель, цветы, свет), читай, слушай музыку, держи другие шкалы выше. Помогают радуга, северное сияние и другие приятные события.'],
];
const stateWord = (v) => (v >= 75 ? 'отлично' : v >= 50 ? 'хорошо' : v >= 25 ? 'так себе' : 'плохо');
function moodFactors() {
  const n = G.needs, f = [], add = (ic, txt, good) => f.push(h('li', { class: good ? 'up' : 'down' }, `${good ? '▲' : '▼'} ${ic} ${txt}`));
  if (G.cozy.total >= 6) add('🧸', `Уют острова (${Math.round(G.cozy.total)})`, true);
  if (n.hunger + n.thirst + n.energy + n.warmth >= 300) add('👍', 'Основные нужды в порядке', true);
  if (G.musicNear) add('🎵', 'Рядом музыка', true);
  if (G.scene !== 'world' && G.weather.type === 'rain') add('🌧️', 'Дождь за окном, а ты дома', true);
  if (G.scene === 'world' && G.weather.type === 'rain') add('🌧️', 'Мокнешь под дождём', false);
  if (n.hunger < 15) add('🍞', 'Голод', false);
  if (n.thirst < 15) add('💧', 'Сильная жажда', false);
  if (n.warmth < 25) add('🥶', 'Замёрз', false);
  if (n.energy < 15) add('😴', 'Нет сил', false);
  const b = buffSum('mood'); if (b > 0) add('✨', `Приятные дела недавно (+${Math.round(b)})`, true);
  return f;
}
export function openNeeds() {
  const body = h('div', { class: 'needs-info' });
  let timer = 0;
  const draw = () => {
    body.replaceChildren(
      h('p', { class: 'muted' }, 'Шкалы не опасны: если их запустить, настроение упадёт, а работа и ходьба станут медленнее.'),
      ...NEED_INFO.map(([k, ic, name, col, what, fix]) => {
        const v = Math.round(G.needs[k]);
        return h('div', { class: 'ni' + (v < 25 ? ' low' : '') },
          h('div', { class: 'ni-top' }, h('span', { class: 'ni-ic' }, ic), h('b', null, name), h('span', { class: 'ni-v' }, `${v}% · ${stateWord(v)}`)),
          h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(2, v)}%;background:${col}` })),
          h('p', null, what), h('p', { class: 'fix' }, '💡 ', fix),
          k === 'mood' ? h('ul', { class: 'mood-f' }, ...moodFactors()) : null);
      }));
  };
  draw();
  timer = setInterval(() => { if (!document.body.contains(body)) clearInterval(timer); else draw(); }, 700);
  openModal('🧍 Состояние', body, { onClose: () => clearInterval(timer) });
}

// ---------------------------------------------------------------- справочник рецептов
const RECIPE_GROUPS = [
  ['🛠️ Крафт и мастерская', ['hand', 'workbench']],
  ['🍲 Кухня и еда', ['campfire', 'pot', 'kettle', 'stove', 'oven', 'smoker', 'ferment', 'drying', 'quern']],
  ['🏺 Ремёсла и искусство', ['kiln', 'loom', 'easel']],
];
const HEAT_NOTE = { self: 'на открытом огне', near: 'нужен горящий огонь рядом' };
function recipesView() {
  const bldOf = (st) => Object.values(BDEF).find((d) => d.station === st);
  const rows = (st) => STATIONS[st].recipes.filter((r) => !r.hidden).map((r) => {
    const outs = Object.entries(r.out), title = r.name || outs.map(([k, n]) => itemName(k) + (n > 1 ? ` ×${n}` : '')).join(', ');
    return h('div', { class: 'rc' },
      h('span', { class: 'rc-ic' }, itemIcon(outs[0][0])),
      h('div', { class: 'rc-body' },
        h('b', null, title),
        h('div', null, ...Object.entries(r.in).map(([k, n]) => h('span', { class: 'chip ' + (eco.count(k) >= n ? '' : 'miss') }, `${n}${itemIcon(k)} ${itemName(k)}`))),
        r.once || r.mood ? h('small', null, [r.once ? 'делается один раз' : '', r.mood ? `+${r.mood} к настроению` : ''].filter(Boolean).join(' · ')) : null),
      h('span', { class: 'rc-t' }, `${r.t} с`));
  });
  const out = [h('p', { class: 'muted' }, 'Все рецепты острова по местам, где их готовят. Красные цифры показывают, чего сейчас не хватает в рюкзаке.')];
  for (const [title, ids] of RECIPE_GROUPS) {
    out.push(h('h3', null, title));
    for (const st of ids) {
      const S_ = STATIONS[st], d = bldOf(st), built = !d || api.isBuilt(d.id);
      const notes = [S_.heat ? HEAT_NOTE[S_.heat] : '', S_.heatBoost ? 'быстрее рядом с огнём' : '', S_.water ? 'нужна вода (из труб или рюкзака)' : ''].filter(Boolean).join(' · ');
      out.push(h('div', { class: 'rc-st' },
        h('div', { class: 'rc-sh' }, h('b', null, `${S_.icon} ${S_.name}`), d ? h('span', { class: 'chip ' + (built ? 'ok' : '') }, built ? '✓ построено' : '🔒 ещё не построено') : h('span', { class: 'chip ok' }, 'всегда под рукой')),
        notes ? h('small', null, notes) : null,
        ...rows(st)));
    }
  }
  return out;
}

export function openJournal(tab = 'goals', focus) {
  const body = h('div', { class: 'journal' });
  const tabs = h('div', { class: 'tabs' });
  const content = h('div', { class: 'jcontent' });
  const draw = (t) => {
    tabs.replaceChildren(...[['goals', '🎯 Цели'], ['cozy', '🧸 Уют'], ['recipes', '📜 Рецепты'], ['help', '❓ Подсказки']].map(([id, nm]) => h('button', { class: id === t ? 'on' : '', onclick: () => draw(id) }, nm)));
    content.replaceChildren();
    if (t === 'goals') {
      const done = GOALS.filter((g) => G.goals[g.id]).length;
      content.append(h('p', { class: 'muted' }, `Выполнено ${done} из ${GOALS.length}. Никакой спешки: цели — просто идеи, чем заняться. За каждую — небольшой подарок.`),
        h('div', { class: 'goals' }, ...GOALS.map((g) => h('div', { 'data-id': g.id, class: 'goal' + (G.goals[g.id] ? ' done' : '') }, h('span', { class: 'gi' }, G.goals[g.id] ? '✅' : g.ic), h('div', null, h('b', null, g.name), h('small', null, g.desc)), h('em', null, Object.entries(g.reward).map(([k, v]) => `${v}${itemIcon(k)}`).join(' '))))));
    } else if (t === 'cozy') {
      const lv = cozyLevel(G.cozy.total);
      content.append(h('div', { class: 'cz-big' }, h('div', { class: 'num' }, G.cozy.total), h('div', null, h('b', null, lv.name), h('small', null, `снаружи ${G.cozy.out} · внутри ${G.cozy.inn}${lv.next ? ` · до следующего уровня: ${lv.next - G.cozy.total}` : ''}`))),
        h('p', { class: 'muted' }, 'Уют повышает настроение. Его даёт мебель, украшения и особенно — удачные сочетания построек. Поэкспериментируй!'));
      const act = new Set(G.cozy.list.map((l) => l.id));
      for (const where of ['out', 'in']) {
        content.append(h('h3', null, where === 'out' ? '🌳 Снаружи' : '🏠 Внутри дома'));
        content.append(h('div', { class: 'goals' }, ...ALL_SYN.filter((s) => s.where === where).map((s) => h('div', { class: 'goal' + (act.has(s.id) ? ' done' : '') }, h('span', { class: 'gi' }, act.has(s.id) ? '✨' : '▫️'), h('div', null, h('b', null, s.name), h('small', null, s.hint)), h('em', null, `+${s.pts}`)))));
      }
    } else if (t === 'recipes') {
      content.append(...recipesView());
    } else {
      content.append(h('h3', null, 'Управление'), h('div', { class: 'ctrl' }, ...(isTouch() ? CONTROLS_TOUCH : CONTROLS_PC).map(([k, v]) => h('div', null, h('kbd', null, k), h('span', null, v)))),
        h('h3', null, 'Как тут жить'),
        h('ul', { class: 'tips' },
          h('li', null, 'Сначала собери хворост, камни и волокна, построй костёр и палатку. Потом верстак — и всё остальное откроется само.'),
          h('li', null, 'Многие постройки дружат: ставь их вплотную. Дождесборник + бак, котелок у огня, ящик у курятника, дровница у костра.'),
          h('li', null, 'Выбери постройку и подвигай курсор: цветные линии покажут, с чем она соединится.'),
          h('li', null, 'Нажми на дом дважды — вход внутрь. Там расставляй мебель, картины и ковры. Хижине нужен дымоход снаружи для камина и плиты.'),
          h('li', null, 'Потребности никогда не убивают — но с ними приятнее. Поспи, поешь горячего, посиди у огня.'),
          h('li', null, 'Игра сохраняется сама. Можно закрыть вкладку и вернуться.')));
    }
  };
  draw(typeof tab === 'string' ? tab : 'goals');
  body.append(tabs, content);
  openModal('📖 Журнал', body, { cls: 'wide' });
  // прокрутить к нужной цели и мигнуть ею
  const el = focus && content.querySelector(`[data-id="${focus}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); }
}
export function openMenu() {
  const body = h('div', { class: 'menu' },
    h('button', { class: 'primary', onclick: () => closeModal() }, '▶ Продолжить'),
    h('button', { onclick: () => { save(); toast('Игра сохранена 💾'); } }, '💾 Сохранить сейчас'),
    h('button', { onclick: () => { initAudio(); setMuted(!isMuted()); closeModal(); } }, isMuted() ? '🔊 Включить звук' : '🔇 Выключить звук'),
    h('button', { onclick: () => { closeModal(); openJournal('help'); } }, '❓ Управление и подсказки'),
    h('button', { class: 'danger', onclick: () => { if (confirm('Начать заново? Текущий остров будет удалён.')) { closeModal(); S.hooks.newGame && S.hooks.newGame(); } } }, '🌱 Новая игра'),
    h('p', { class: 'muted' }, `День ${day() + 1} · автосохранение каждые 30 секунд`));
  openModal('⚙️ Меню', body, { cls: 'narrow' });
}
export function openWardrobe() {
  const p = G.player, home = homeOf();
  const body = h('div', { class: 'ward' });
  const draw = () => {
    body.replaceChildren(
      h('h3', null, 'Цвет одежды'), h('div', { class: 'swatches' }, ...SHIRTS.map((c, i) => h('button', { class: 'sw' + (p.outfit.shirt === i ? ' on' : ''), style: `background:${c}`, onclick: () => { p.outfit.shirt = i; draw(); } }))),
      h('h3', null, 'Головной убор'), h('div', { class: 'opts' }, ...HATS.map((n, i) => h('button', { class: p.outfit.hat === i ? 'on' : '', onclick: () => { p.outfit.hat = i; draw(); } }, n))));
    if (home && home.lvl > 1) body.append(
      h('h3', null, 'Стены'), h('div', { class: 'swatches' }, ...WALL_STYLES.map((c, i) => h('button', { class: 'sw' + (home.in.wall === i ? ' on' : ''), title: WALL_NAMES[i], style: `background:${c}`, onclick: () => { setStyle(home, 'wall', i); draw(); } }))),
      h('h3', null, 'Пол'), h('div', { class: 'swatches' }, ...FLOOR_STYLES.map((c, i) => h('button', { class: 'sw' + (home.in.floor === i ? ' on' : ''), title: FLOOR_NAMES[i], style: `background:linear-gradient(135deg,${c[0]} 50%,${c[1]} 50%)`, onclick: () => { setStyle(home, 'floor', i); draw(); } }))));
  };
  draw();
  openModal('👕 Гардероб и отделка', body, { cls: 'narrow' });
}
S.hooks.openWardrobe = openWardrobe;
S.hooks.showLetter = (L) => {
  openModal('✉️ Письмо', h('div', { class: 'letter' }, h('p', null, L.text), h('p', { class: 'from' }, '— ' + L.from), h('div', { class: 'gift' }, 'В конверте: ', ...Object.entries(L.gift).map(([k, v]) => h('span', { class: 'chip' }, `${v}${itemIcon(k)} ${itemName(k)}`)))), { cls: 'narrow paper' });
};
S.hooks.openTraveler = (story, gift) => {
  openModal('🧳 Путник у костра', h('div', { class: 'letter' }, h('p', null, '«' + story + '»'), h('div', { class: 'gift' }, 'Путник оставил тебе: ', ...Object.entries(gift).map(([k, v]) => h('span', { class: 'chip' }, `${v}${itemIcon(k)} ${itemName(k)}`)))), { cls: 'narrow paper' });
};
export function openIntro(onStart) {
  openModal('🏝️ Уютный остров', h('div', { class: 'intro' },
    h('p', null, 'Тихий остров, костёр, чайник и всё время мира. Здесь нет зомби и паники — только ты и твой уютный уголок.'),
    h('ul', { class: 'tips' },
      h('li', null, h('b', null, 'Нажми на землю'), ' — идти. На траву, камни, ягоды, деревья — собрать.'),
      h('li', null, h('b', null, 'Снизу — меню построек'), isTouch() ? ': выбирай и ставь мгновенно, как в RTS. Коснись земли, подвинь призрак и нажми «✓ Поставить». Одним пальцем двигай камеру, двумя — масштаб.' : ': выбирай и ставь мгновенно, как в RTS. R — повернуть, ПКМ — отмена, колесо — масштаб.'),
      h('li', null, 'Ставь постройки ', h('b', null, 'вплотную'), ' друг к другу: многие умеют работать вместе (бак + дождесборник, котелок + костёр, ящик + курятник…).'),
      h('li', null, 'Свет, погода, времена года, звёзды и дожди идут сами. Можно ускорить время кнопками сверху.')),
    h('button', { class: 'primary big', onclick: () => { closeModal(); onStart && onStart(); } }, 'Начать жить 🌿')), { cls: 'narrow paper', sticky: true, noClose: true });
}
