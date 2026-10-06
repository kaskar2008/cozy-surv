// Панель выбранного объекта (справа): состояние, действия, рецепты.
import { h, $ } from '../core/util.js';
import { UI } from './state.js';
import { G, season } from '../game/state.js';
import { BDEF } from '../data/buildings/index.js';
import { FDEF } from '../data/furniture.js';
import { ITEMS, itemIcon, itemName } from '../data/items.js';
import { STATIONS } from '../data/recipes.js';
import { PET_FOOD, HUNGRY } from '../data/pets.js';
import { CROPS } from '../data/crops.js';
import * as eco from '../game/eco.js';
import * as api from '../game/api.js';
import { S, bldName, defOf, linksOf, refundOf, canCraft, stationHeatOk, waterAvailable } from '../game/api.js';
import { netOf, isHot, heated } from '../game/nets.js';
import { workProgress } from '../game/progress.js';
import { enterHome, furnActions, removeFurn, proxyOf, homeOf } from '../game/interior.js';
import { R } from '../render/scene.js';
import { focusUpper } from '../render/camera.js';
import { toast, askConfirm } from './ui.js';
import { sfx } from '../core/audio.js';

let root, sigLast = '', acc = 0;
export function initPanel() { root = $('#panel'); }

export function selectBuilding(b) { focusUpper(b.x + b.w / 2, b.y + b.d / 2); UI.sel = { kind: 'bld', id: b.id }; G.sel = null; R.sel = { x: b.x, y: b.y, w: b.w, d: b.d }; R.links = linksOf(b); sigLast = ''; renderPanel(); sfx('ui'); }
export function selectWater(x, y) { focusUpper(x + .5, y + .5, 0); UI.sel = { kind: 'water', x, y }; G.sel = null; R.sel = { x, y, w: 1, d: 1 }; R.links = []; sigLast = ''; renderPanel(); }
export function selectFurn(it) { UI.sel = { kind: 'furn', uid: it.uid }; G.sel = { uid: it.uid }; R.sel = null; sigLast = ''; renderPanel(); sfx('ui'); }
export function clearSelection() { UI.sel = null; G.sel = null; R.sel = null; R.links = []; sigLast = ''; root.style.display = 'none'; }
export function updatePanel(dt) {
  acc += dt; if (acc < .25) return; acc = 0;
  if (!UI.sel) { if (root.style.display !== 'none') root.style.display = 'none'; return; }
  renderPanel();
}

const q = (v, s) => Math.round(v / s) * s;
function recipesUI(holder, stationKey, def) {
  const st = STATIONS[stationKey], wrap = h('div', { class: 'recipes' });
  const cur = holder.st.cur;
  const heatOk = stationHeatOk(holder, stationKey);
  if (st.heat === 'self' && !heatOk) wrap.append(h('div', { class: 'warn' }, '🔥 Сначала разведи огонь'));
  if (st.heat === 'near' && !heatOk) wrap.append(h('div', { class: 'warn' }, '❄️ Нужен горящий огонь вплотную к станции (костёр, плита)'));
  if (cur) { const r = STATIONS[cur.st].recipes[cur.idx], pct = q(100 * (1 - cur.left / cur.total), 5); wrap.append(h('div', { class: 'craftcur' }, h('span', null, `${itemIcon(Object.keys(r.out)[0])} Готовится… ${holder.st.paused ? '(пауза: нет огня)' : ''}${holder.st.q ? ` · в очереди ещё ${holder.st.q}` : ''}`), h('div', { class: 'bar' }, h('i', { style: `width:${pct}%;background:#e0a24a` })))); }
  st.recipes.forEach((r, idx) => {
    if (r.hidden) return;
    const name = r.name || Object.keys(r.out).map((k) => ITEMS[k].n).join(', ');
    const have = (k, n) => (k === 'water' && st.water) ? (waterAvailable(holder) + eco.count('water') >= n) : eco.count(k) >= n;
    const can = canCraft(holder, stationKey, r) && !(r.once && Object.keys(r.out).every((k) => eco.has(k)));
    const busy = !!cur && cur.st === stationKey && cur.idx === idx;
    const row = h('div', { class: 'recipe' + (can || busy ? '' : ' off') + (busy ? ' cooking' : ''), style: busy ? `--p:${(100 * (1 - cur.left / cur.total)).toFixed(1)}%` : null },
      h('div', { class: 'r-out' }, h('span', { class: 'big' }, itemIcon(Object.keys(r.out)[0])), h('div', null, h('b', null, name + (Object.values(r.out)[0] > 1 ? ` ×${Object.values(r.out)[0]}` : '')), h('small', null, `⏱ ${r.t} с`), busy && holder.st.q > 0 ? h('small', { class: 'qleft' }, `Осталось: ${holder.st.q + 1}`) : null)),
      h('div', { class: 'r-in' }, ...Object.entries(r.in).map(([k, n]) => h('span', { class: 'chip ' + (have(k, n) ? '' : 'miss') }, `${n}${itemIcon(k)}`))),
      h('div', { class: 'r-btn' }, h('button', { disabled: !!cur || !can, onclick: () => { api.startCraft(holder, stationKey, idx, 1); renderPanel(true); } }, 'Сделать'), r.once ? null : h('button', { class: 'sm', disabled: !!cur || !can, title: 'Поставить в очередь ×3', onclick: () => { api.startCraft(holder, stationKey, idx, 3); renderPanel(true); } }, '×3')));
    wrap.append(row);
  });
  return wrap;
}

function bar(label, v, max, col, text) {
  return { l: label, p: q(100 * Math.max(0, Math.min(1, v / max)), 4), c: col, t: text };
}
function describeBld(b) {
  const def = BDEF[b.t], st = b.st, lines = [], bars = [], acts = [], extra = [];
  if (b.bld) {
    const left = Math.max(0, Math.ceil(b.bld.T * (1 - b.bld.p)));
    bars.push(bar('Строительство', b.bld.p, 1, '#8ec7f0', `${Math.floor(b.bld.p * 100)}% · ещё ~${left} с`));
    lines.push('🏗 Постройка возводится — пока она не готова, ничего не работает');
    return { icon: def.icon, title: bldName(b) + ' (стройка)', desc: def.desc, lines, bars, acts, links: [], refund: { ...def.cost }, demoLabel: '✖ Отменить стройку', demolish: () => { api.demolish(b); UI.sel = null; R.sel = null; R.links = []; sigLast = ''; root.style.display = 'none'; } };
  }
  const A = (label, run, o = {}) => acts.push({ label, run, ...o });
  const home = def.home;
  if (def.burner) {
    const lit = isHot(b);
    lines.push(lit ? '🔥 Горит' : st.fuel > 0 ? '💨 Потухло — но топливо ещё есть' : 'Огонь не разожжён');
    bars.push(bar('Топливо', st.fuel, def.burner.max, '#e8714a', `${Math.ceil(st.fuel / 60)} мин`));
    if (!lit) A('🔥 Разжечь (1 хворост)', () => api.lightFire(b));
    for (const f of Object.keys(def.burner.fuels)) if (eco.has(f)) A(`Подбросить ${itemIcon(f)} ${itemName(f)} (${eco.count(f)})`, () => api.addFuel(b, f));
    if (b.nb.some((o) => BDEF[o.t].tags.includes('feeder'))) lines.push('🪵 Дровница рядом сама подкладывает дрова');
  }
  if (def.needs?.includes('heat')) lines.push(heated(b) ? '🔥 Рядом горит огонь — всё работает' : '❄️ Поставь вплотную к горящему огню');
  const wn = def.net?.water && netOf(b, 'water');
  if (wn && (wn.cap > 0 || def.net.water.prod)) {
    bars.push(bar('Вода в сети', wn.stock, Math.max(1, wn.cap), '#5aa8e0', `${Math.floor(wn.stock)} / ${wn.cap}`));
    lines.push(`💧 Сеть: ${wn.nodes.length} постр.`);
    if (def.tags.includes('rain') && wn.cap < 20) lines.push('💡 Поставь бак вплотную — вода не будет переливаться через край');
    if (def.net.water.needsPower) lines.push(b.st.powered ? '⚡ Насос работает' : '⚡ Нет энергии — подключи провода к панели');
  } else if (def.net?.water && def.net.water.leaf) { lines.push(wn && wn.stock > 0 ? '💧 Вода подключена' : '💧 Вода не подключена (вплотную бак или труба)'); }
  const pn = def.net?.power && netOf(b, 'power');
  if (pn && (def.net.power.use || def.net.power.gen || def.net.power.cap)) {
    lines.push(st.powered ? '⚡ Питание есть' : '⚡ Нет питания');
    if (pn.cap > 0) bars.push(bar('Заряд сети', pn.stock, pn.cap, '#e0c040', `${Math.floor(pn.stock)} / ${pn.cap}`));
    if (def.net.power.gen) lines.push(`☀️ Сейчас вырабатывает: ${(st.gen || 0).toFixed(1)}`);
  }
  if (home) {
    lines.push(`Комната ${b.in.w}×${b.in.d} · предметов внутри: ${b.in.items.length}`);
    A('🚪 Войти внутрь', () => api.doAt(b, 'Вхожу', .4, 'pick', () => enterHome(b)), { primary: true });
    const nx = home.levels[b.lvl];
    if (nx) A(`⬆ Улучшить до: ${nx.name}`, () => api.upgradeHome(b), { sub: Object.entries(nx.cost).map(([k, v]) => `${v}${itemIcon(k)}`).join(' '), off: !eco.canAfford(nx.cost) });
    if (b.lvl >= 2) lines.push(b.nb.some((o) => BDEF[o.t].tags.includes('chimney')) ? '🏭 Дымоход пристроен — можно ставить камин и плиту' : '🏭 Пристрой дымоход, чтобы внутри поставить камин/плиту');
  }
  if (def.out) {
    const o = def.out;
    lines.push(`${itemIcon(o.item)} ${o.label}: ${Math.floor(st.stock)} / ${o.max}`);
    if (st.stock >= 1) A(`🧺 Собрать (${Math.floor(st.stock)}${itemIcon(o.item)})`, () => api.collectOut(b), { primary: true });
    if (def.tags.includes('hive')) lines.push(`🌸 Цветов рядом: ${api.flowersNear(b, 6)} — чем больше, тем быстрее`);
    if (!b.nb.some((n) => BDEF[n.t].tags.includes('storage'))) lines.push('💡 Ящик/корзина вплотную соберут продукцию автоматически');
  }
  if (def.animals) {
    bars.push(bar('Сыты', st.feedT, 300, '#e6c45a', st.feedT > 0 ? `${Math.ceil(st.feedT / 60)} мин` : 'голодные'));
    bars.push(bar('Вода', st.waterT, 300, '#5aa8e0', st.waterT > 0 ? `${Math.ceil(st.waterT / 60)} мин` : 'нет воды'));
    A(`🌾 Покормить (${def.animals.feed.map(itemIcon).join('/')})`, () => api.feedAnimals(b, 'feed'));
    A('💧 Налить воды (ведро)', () => api.feedAnimals(b, 'water'));
    lines.push(b.nb.some((n) => BDEF[n.t].tags.includes('feeder_animal')) ? '✅ Кормушка рядом' : '💡 Кормушка вплотную кормит сама');
    lines.push(b.nb.some((n) => BDEF[n.t].tags.includes('trough')) ? '✅ Поилка рядом' : '💡 Поилка (подключённая к воде) вплотную поит сама');
  }
  if (def.tags.includes('scarecrow')) { const n = api.cropsInScare(b).length; lines.push(n ? `🥕 Грядок под защитой: ${n} (рост +10%)` : 'Поставь грядки в 4 клетках от пугала — они вырастут на 10% быстрее.'); }
  if (def.compost) {
    lines.push(`🟤 Загружено: ${st.load} · готово: ${st.ready}/6`);
    A('♻️ Заложить (2 волокна/травы)', () => api.loadCompost(b)); if (st.ready > 0) A(`🟤 Забрать компост (${st.ready})`, () => api.takeCompost(b));
    { const n = api.cropsNear(b).length; lines.push(n ? `🥕 Грядок рядом: ${n} — удобряет их сам` : 'Грядки в 3 клетках сами берут готовый компост.'); }
  }
  if (def.crops) {
    const gh = def.tags.includes('greenhouse');
    if (season() === 3 && !gh) lines.push('❄️ Зима: на улице рост остановлен — нужна теплица');
    b.st.plots.forEach((p, i) => {
      const tag = b.st.plots.length > 1 ? `Грядка ${i + 1}: ` : '';
      if (!p.crop) {
        lines.push(tag + 'пусто — посади семена');
        for (const [id, c] of Object.entries(CROPS)) { const n = eco.count(c.seed); if (n > 0) A(`${itemIcon(c.out)} ${c.n} (${n} сем.)`, () => api.plantCrop(b, i, id), { sub: tag.trim() }); }
        if (!Object.values(CROPS).some((c) => eco.count(c.seed) > 0)) lines.push('Нет семян: собирай урожай и находи семена в письмах.');
      } else {
        const c = CROPS[p.crop], ripe = p.prog >= 1;
        lines.push(`${tag}${itemIcon(c.out)} ${c.n}: ${ripe ? 'созрело!' : Math.floor(p.prog * 100) + '%'}${p.fert ? ' · 🟤 удобрено' : ''}`);
        bars.push(bar(tag + 'Влажность', p.moist, 1, '#5aa8e0', p.moist < .15 ? 'сухо!' : ''));
        if (ripe) A(`🧺 Собрать урожай ${c.n}`, () => api.harvestPlot(b, i), { primary: true });
        else { A('💧 Полить (ведро)', () => api.waterPlot(b, i), { off: p.moist > .85 }); if (!p.fert) A('🟤 Удобрить (компост)', () => api.fertilizePlot(b, i)); }
        A('✂ Убрать растение', () => { api.clearPlot(b, i); renderPanel(true); });
      }
    });
    if (G.comp.water.has(b.id)) lines.push('💧 Подключено к трубам: поливается само');
    lines.push(api.scarecrowsNear(b).length ? '🧑‍🌾 Пугало рядом: растёт на 10% быстрее' : '💡 Пугало в 4 клетках ускоряет рост на 10%');
    { const cs = api.compostsNear(b); lines.push(cs.length ? `🟤 Компост рядом (${cs.length}): сам удобрит посевы, когда созреет` : '💡 Компостная куча в 3 клетках сама удобряет посевы'); }
  }
  if (def.sit) A(`${def.sit.label || '🪑 Посидеть'} (+${def.sit.mood}😊)`, () => api.sitAt(b));
  if (def.nap) A('😴 Вздремнуть', () => api.napAt(b));
  if (def.stargaze) A('🔭 Смотреть в небо', () => api.stargaze(b));
  if (def.drink) { A('💧 Попить', () => api.drinkFromNet(b)); A('🪣 Набрать ведро воды', () => api.fetchFromNet(b)); }
  if (def.id === 'hot_tub') A('🛁 Принять ванну', () => api.bathe(b), { off: (wn?.stock || 0) < 20 || !heated(b) });
  if (def.shower) A('🚿 Принять душ', () => api.shower(b));
  if (def.sauna) A('🧖 Попариться', () => api.sauna(b));
  if (def.music) A(st.on ? '⏹ Выключить' : '▶ Включить музыку', () => api.toggleMusic(b));
  if (def.mill) { lines.push(st.on ? '⚙ Мелет зерно' : st.off ? 'Остановлена' : 'Ждёт пшеницу (нужно 3 🌾 в запасах)'); A(st.off ? '▶ Запустить' : '⏹ Остановить', () => { st.off = !st.off; }); }
  if (def.mailbox) { lines.push(st.letter ? '✉️ Пришло письмо!' : 'Писем пока нет'); if (st.letter) A('✉️ Прочитать письмо', () => api.readLetter(b), { primary: true }); }
  if (def.pet) {
    const p = G.pets.find((x) => x.home === b.id);
    if (!p) lines.push('Пока пусто… подожди немного');
    else {
      const hunger = p.hunger ?? 70, food = api.petFoodHave(p);
      lines.push(p.kind === 'cat' ? '🐈 Здесь живёт кот' : '🐕 Здесь живёт пёс');
      bars.push(bar('Сытость', hunger, 100, '#e6a44a', hunger < HUNGRY ? 'голоден!' : ''));
      bars.push(bar('Привязанность', p.bond ?? 40, 100, '#e87aa8', ''));
      for (const k of food) A(`${itemIcon(k)} Покормить: ${itemName(k)} (${eco.count(k)})`, () => api.feedPet(p, k), { off: hunger > 92 });
      A('🤲 Погладить', () => api.petPet(p), { primary: !food.length || hunger >= HUNGRY });
      if (!food.length) lines.push('💡 Корм: ' + Object.keys(PET_FOOD[p.kind]).map(itemName).join(', '));
      if (p.kind === 'dog') lines.push('💩 Пёс гуляет и иногда оставляет «подарки» — убери их, а компостная куча примет их сама');
      if (p.job) lines.push(p.job === 'forage' ? '🔎 Ушёл искать еду сам…' : '🏃 Возвращается домой');
    }
  }
  if (def.id === 'snowman') lines.push('Растает с приходом весны ☃️');
  return { icon: def.icon, title: bldName(b), desc: def.desc, lines, bars, acts, station: def.station ? { holder: b, key: def.station } : null, links: linksOf(b), refund: refundOf(b), demolish: () => { const go = () => { api.demolish(b); UI.sel = null; R.sel = null; R.links = []; sigLast = ''; root.style.display = 'none'; }; if (def.home) askConfirm('🗑 Снести дом?', 'Дом снесётся вместе с мебелью. Вернётся 60% материалов.', 'Снести', go); else go(); } };
}
function describeWater(sel) {
  const acts = [];
  acts.push({ label: '🎣 Рыбачить', run: () => api.fishFrom(sel.x, sel.y), sub: eco.has('rod') ? '' : 'нужна удочка' });
  acts.push({ label: '🪣 Набрать ведро воды', run: () => api.fetchWaterNatural(sel.x, sel.y) });
  acts.push({ label: '💧 Напиться', run: () => api.drinkNatural(sel.x, sel.y) });
  return { icon: '🌊', title: 'Водоём', desc: 'Вода у берега. Здесь можно рыбачить (удочка в «Крафте» — C), набирать воду ведром и пить. Причал рядом ускоряет рыбалку.', lines: [], bars: [], acts };
}
function describeFurn(sel) {
  const home = homeOf(); if (!home) return null;
  const it = home.in.items.find((o) => o.uid === sel.uid); if (!it) return null;
  const d = FDEF[it.t], px = proxyOf(home, it), acts = [], lines = [], bars = [];
  for (const a of furnActions(home, it)) acts.push(a);
  if (d.burner) {
    const lit = isHot(px); lines.push(lit ? '🔥 Горит' : 'Не растоплено'); bars.push(bar('Топливо', it.st.fuel, d.burner.max, '#e8714a', `${Math.ceil(it.st.fuel / 60)} мин`));
    if (!lit) acts.unshift({ label: '🔥 Растопить (1 хворост)', run: () => api.lightFire(px) });
    for (const f of Object.keys(d.burner.fuels)) if (eco.has(f)) acts.push({ label: `Подбросить ${itemIcon(f)} ${itemName(f)} (${eco.count(f)})`, run: () => api.addFuel(px, f) });
  }
  if (d.needs?.includes('power')) lines.push(home.st.powered ? '⚡ Питание есть' : '⚡ Нет питания: подведи провода к дому снаружи');
  if (d.needs?.includes('water')) lines.push(waterAvailable(home) > 0 ? '💧 Вода подключена' : '💧 Нет воды: поставь бак вплотную к дому');
  if (d.cap) lines.push('📦 Добавляет места на складе');
  if (d.wardrobe) { /* через действия */ }
  return { icon: d.icon, title: d.name, desc: d.desc, lines, bars, acts, station: d.station ? { holder: px, key: d.station } : null, demolish: () => { removeFurn(home, it); UI.sel = null; G.sel = null; sigLast = ''; root.style.display = 'none'; }, refund: Object.fromEntries(Object.entries(d.cost).map(([k, v]) => [k, Math.floor(v * .8)])), demoLabel: '📦 Убрать (вернёт 80%)' };
}

export function renderPanel(force) {
  const sel = UI.sel; if (!sel) return;
  let m = null;
  if (sel.kind === 'bld') { const b = G.bMap.get(sel.id); if (!b) { clearSelection(); return; } m = describeBld(b); }
  else if (sel.kind === 'water') m = describeWater(sel);
  else if (sel.kind === 'furn') m = describeFurn(sel);
  if (!m) { clearSelection(); return; }
  if (m.station) { const pr = workProgress(m.station.holder, { station: m.station.key }); const row = root.querySelector('.recipe.cooking'); if (pr && row) row.style.setProperty('--p', (100 * pr.p).toFixed(1) + '%'); }
  const sig = JSON.stringify([m.title, m.lines, m.bars, m.acts.map((a) => [a.label, a.off, a.sub]), m.station && m.station.holder.st.cur ? [m.station.holder.st.cur.left | 0, m.station.holder.st.q] : null, m.station ? Object.keys(G.inv).map((k) => G.inv[k]).join() : '', m.links ? m.links.length : 0]);
  if (!force && sig === sigLast) return;
  sigLast = sig;
  root.style.display = 'block';
  const kids = [
    h('div', { class: 'p-head' }, h('span', { class: 'p-ic' }, m.icon), h('div', null, h('b', null, m.title)), h('button', { class: 'x', onclick: clearSelection }, '✕')),
    h('div', { class: 'p-desc' }, m.desc),
  ];
  if (m.lines.length) kids.push(h('div', { class: 'p-lines' }, ...m.lines.map((l) => h('div', null, l))));
  for (const b of m.bars) kids.push(h('div', { class: 'p-bar' }, h('span', null, b.l), h('div', { class: 'bar' }, h('i', { style: `width:${b.p}%;background:${b.c}` })), h('small', null, b.t || '')));
  if (m.acts.length) kids.push(h('div', { class: 'p-acts' }, ...m.acts.filter((a) => a.label).map((a) => h('button', { class: a.primary ? 'primary' : '', disabled: !!a.off, title: a.hint || '', onclick: () => { a.run(); setTimeout(() => renderPanel(true), 60); } }, a.label, a.sub ? h('small', null, a.sub) : null))));
  if (m.station) kids.push(h('div', { class: 'p-sec' }, h('b', null, STATIONS[m.station.key].icon + ' ' + STATIONS[m.station.key].name)), recipesUI(m.station.holder, m.station.key));
  if (m.links && m.links.length) kids.push(h('div', { class: 'p-links' }, h('b', null, '🔗 Связи: '), ...[...new Set(m.links.map((l) => bldName(l.b)))].map((n) => h('span', { class: 'chip' }, n))));
  if (m.demolish) kids.push(h('button', { class: 'danger', onclick: m.demolish }, (m.demoLabel || '🗑 Снести') + (m.refund ? ` · вернёт ${Object.entries(m.refund).map(([k, v]) => `${Math.floor(v * (m.demoLabel ? 1 : .6))}${itemIcon(k)}`).filter((s) => !s.startsWith('0')).join(' ')}` : '')));
  root.replaceChildren(...kids);
}
