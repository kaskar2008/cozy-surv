// Верхняя панель: время, потребности, ресурсы, быстрые кнопки.
import { h, $ } from '../core/util.js';
import { G, day, season, fmtClock, hour, darkness } from '../game/state.js';
import { SEASONS, SEASON_ICON } from '../data/crops.js';
import { ITEMS, itemIcon } from '../data/items.js';
import * as eco from '../game/eco.js';
import { cozyLevel } from '../game/cozy.js';
import { nextGoals } from '../game/goals.js';
import { UI } from './state.js';
import { toast } from './ui.js';
import { openInventory, openCraft, openJournal, openMenu } from './modals.js';
import { takePhoto } from '../input.js';
import { isMuted, setMuted, initAudio } from '../core/audio.js';
import { exitHome, homeOf } from '../game/interior.js';
import { bldName, wakeUp, startSleep } from '../game/api.js';

const WX = { clear: '☀️', cloudy: '☁️', rain: '🌧️', fog: '🌫️', snow: '❄️' };
const NEEDS = [['thirst', '💧', 'Жажда', '#5aa8e0'], ['hunger', '🍞', 'Сытость', '#e0a24a'], ['energy', '⚡', 'Бодрость', '#8fcf6a'], ['warmth', '🔥', 'Тепло', '#e8714a'], ['mood', '😊', 'Настроение', '#e87aa8']];
let els = {}, acc = 0;

export function buildHUD() {
  const ui = $('#ui');
  ui.append(
    h('div', { id: 'topbar' },
      h('div', { class: 'tb-time' }, h('span', { id: 'tb-season' }), h('span', { id: 'tb-day' }), h('span', { id: 'tb-clock' }), h('span', { id: 'tb-wx' })),
      h('div', { class: 'speed' }, ...[['⏸', 0], ['▶', 1], ['⏩', 2], ['⏭', 4]].map(([ic, v]) => h('button', { 'data-sp': v, title: ['Пауза (P)', 'Обычная скорость (1)', 'Быстро (2)', 'Очень быстро (3)'][[0, 1, 2, 4].indexOf(v)], onclick: () => setSpeed(v) }, ic)))),
    h('div', { id: 'needs' }, ...NEEDS.map(([k, ic, name, col]) => h('div', { class: 'need', 'data-k': k, title: name }, h('span', { class: 'ic' }, ic), h('div', { class: 'bar' }, h('i', { style: `background:${col}` }))))),
    h('div', { id: 'cozybox' }, h('div', { class: 'cz-top' }, h('span', null, '🧸 Уют '), h('b', { id: 'cz-n' })), h('div', { class: 'cz-name', id: 'cz-name' }), h('div', { class: 'bar' }, h('i', { id: 'cz-bar' }))),
    h('div', { id: 'goalhint' }),
    h('div', { id: 'interior-banner' }),
    h('div', { id: 'sleepmsg' }, '😴 Спишь… нажми, чтобы проснуться'),
  );
  $('#rightcol').prepend(
    h('div', { id: 'menu-btns' },
      h('button', { title: 'Рюкзак (I)', onclick: openInventory }, '🎒'),
      h('button', { title: 'Ручная работа (C)', onclick: openCraft }, '✋'),
      h('button', { title: 'Журнал и уют (J)', onclick: openJournal }, '📖'),
      h('button', { title: 'Сфотографировать (F)', onclick: takePhoto }, '📷'),
      h('button', { id: 'mute-btn', title: 'Звук (M)', onclick: () => { initAudio(); setMuted(!isMuted()); syncMute(); } }, '🔊'),
      h('button', { title: 'Меню (Esc)', onclick: openMenu }, '⚙️')),
    h('div', { id: 'resbar' }),
  );
  els = { season: $('#tb-season'), day: $('#tb-day'), clock: $('#tb-clock'), wx: $('#tb-wx'), res: $('#resbar'), hint: $('#goalhint'), czn: $('#cz-n'), czname: $('#cz-name'), czbar: $('#cz-bar'), banner: $('#interior-banner'), sleep: $('#sleepmsg') };
  $('#sleepmsg').addEventListener('pointerdown', () => wakeUp());
  syncMute();
}
export function setSpeed(v) { G.speed = v; syncSpeed(); }
const syncSpeed = () => document.querySelectorAll('.speed button').forEach((b) => b.classList.toggle('on', +b.dataset.sp === G.speed));
const syncMute = () => { const b = $('#mute-btn'); if (b) b.textContent = isMuted() ? '🔇' : '🔊'; };

export function updateHUD(dt) {
  acc += dt; if (acc < .2) return; acc = 0;
  els.season.textContent = `${SEASON_ICON[season()]} ${SEASONS[season()]}`; els.day.textContent = `День ${day() + 1}`; els.clock.textContent = fmtClock();
  els.wx.textContent = WX[G.weather.type]; els.wx.title = { clear: 'Ясно', cloudy: 'Облачно', rain: 'Дождь', fog: 'Туман', snow: 'Снег' }[G.weather.type];
  syncSpeed();
  document.querySelectorAll('.need').forEach((n) => { const k = n.dataset.k, v = G.needs[k]; n.querySelector('i').style.width = Math.max(2, v) + '%'; n.classList.toggle('low', v < 22); n.title = `${n.title.split(':')[0]}: ${Math.round(v)}`; });
  const lv = cozyLevel(G.cozy.total);
  els.czn.textContent = G.cozy.total; els.czname.textContent = lv.name;
  els.czbar.style.width = (lv.next ? Math.min(100, (G.cozy.total - lv.prev) / (lv.next - lv.prev) * 100) : 100) + '%';
  // ресурсы
  const chips = [];
  for (const [id, it] of Object.entries(ITEMS)) {
    if ((it.c === 'mat' || it.c === 'drink') && (G.inv[id] || 0) > 0) chips.push(h('span', { class: 'res', title: `${it.n}: ${G.inv[id]} / ${eco.capOf(id)}` }, it.ic, h('b', null, G.inv[id])));
  }
  const sig = chips.map((c) => c.textContent).join('|');
  if (sig !== els.resSig) { els.resSig = sig; els.res.replaceChildren(...chips); }
  const g = nextGoals(2);
  const hs = g.map((x) => x.id).join();
  if (hs !== els.hintSig) { els.hintSig = hs; els.hint.replaceChildren(...g.map((x) => h('div', { class: 'gh', title: x.desc, onclick: openJournal }, h('span', null, x.ic), h('div', null, h('b', null, x.name), h('small', null, x.desc))))); els.hint.style.display = g.length ? 'flex' : 'none'; }
  // интерьер
  const home = homeOf();
  if (home) { const bsig = bldName(home) + G.cozy.total; if (els.bsig !== bsig) { els.bsig = bsig; els.banner.replaceChildren(h('span', null, '🏠 Внутри: ' + bldName(home)), h('button', { title: 'Поспать прямо на полу — без кровати хуже', onclick: () => { if (G.needs.energy > 92) toast('Совсем не хочется спать'); else startSleep('floor', 0.7); } }, '💤 Прилечь'), h('button', { onclick: exitHome }, '↩ Выйти из дома')); } els.banner.style.display = 'flex'; }
  else { els.banner.style.display = 'none'; els.bsig = null; }
  els.sleep.style.display = G.player.sleeping ? 'block' : 'none';
}
