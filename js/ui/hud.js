// Верхняя панель: время, потребности, ресурсы, быстрые кнопки.
import { rotateCam } from '../render/camera.js';
import { h, $ } from '../core/util.js';
import { G, day, season, fmtClock, hour, darkness } from '../game/state.js';
import { SEASONS, SEASON_ICON } from '../data/crops.js';
import { ITEMS, itemIcon } from '../data/items.js';
import * as eco from '../game/eco.js';
import { cozyLevel } from '../game/cozy.js';
import { forecastOn } from '../game/skills.js';
import { nextGoals, goalTask, goalProg, goalReward } from '../game/goals.js';
import { UI } from './state.js';
import { toast } from './ui.js';
import { openInventory, openCraft, openJournal, openMenu, openNeeds } from './modals.js';
import { takePhoto, confirmPlace, rotateGhost, centerPlayer } from '../input.js';
import { R } from '../render/scene.js';
import { cancelBuild } from './buildbar.js';
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
      h('div', { class: 'tb-time' },
        h('span', { id: 'tb-season' }, h('span', { class: 'ic' }), h('span', { class: 'nm' })),
        h('span', { id: 'tb-day' }, h('span', { class: 'full' }, 'День '), h('span', { class: 'sh' }, 'Д'), h('span', { id: 'tb-dn' })),
        h('span', { id: 'tb-clock' }), h('span', { id: 'tb-wx' })),
      // телефон: вместо четырёх кнопок скорости — пауза и одна кнопка, листающая 1× → 2× → 4×
      h('div', { class: 'speed-m' },
        h('button', { id: 'sp-pause', title: 'Пауза (P)', onclick: () => setSpeed(G.speed ? 0 : lastSp) }, '⏸'),
        h('button', { id: 'sp-cycle', title: 'Скорость', onclick: () => setSpeed(G.speed ? (G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1) : lastSp) }, '▶')),
      h('div', { class: 'speed' }, ...[['⏸', 0], ['▶', 1], ['⏩', 2], ['⏭', 4]].map(([ic, v]) => h('button', { 'data-sp': v, title: ['Пауза (P)', 'Обычная скорость (1)', 'Быстро (2)', 'Очень быстро (3)'][[0, 1, 2, 4].indexOf(v)], onclick: () => setSpeed(v) }, ic)))),
    h('div', { id: 'needs', title: 'Нажми, чтобы узнать подробнее', onclick: () => openNeeds() }, ...NEEDS.map(([k, ic, name, col]) => h('div', { class: 'need', 'data-k': k, title: name }, h('span', { class: 'ic' }, ic), h('div', { class: 'bar' }, h('i', { style: `background:${col}` }))))),
    h('div', { id: 'cozybox', title: 'Нажми, чтобы узнать про уют', onclick: () => openJournal('cozy') }, h('div', { class: 'cz-top' }, h('span', null, '🧸 Уют '), h('b', { id: 'cz-n' })), h('div', { class: 'cz-name', id: 'cz-name' }), h('div', { class: 'bar' }, h('i', { id: 'cz-bar' }))),
    h('div', { id: 'goalhint' }),
    h('div', { id: 'interior-banner' }),
    h('div', { id: 'sleepmsg' }, '😴 Спишь… нажми, чтобы проснуться'),
  );
  // телефон: все второстепенные кнопки живут в одном выпадающем меню (на десктопе скрыто в CSS)
  const more = (ic, t, fn, cls) => h('button', { class: cls || '', onclick: () => { closeMore(); fn(); } }, h('i', null, ic), h('small', null, t));
  ui.append(
    h('button', { id: 'more-btn', title: 'Меню', onclick: () => { const m = $('#more-menu'); const o = !m.classList.contains('open'); m.classList.toggle('open', o); if (o) syncMute(); } }, '☰'),
    h('div', { id: 'more-menu' },
      more('🎒', 'Рюкзак', openInventory), more('🛠️', 'Крафт', openCraft), more('📖', 'Журнал', () => openJournal('goals')),
      more('🌟', 'Навыки', () => openJournal('skills')), more('📷', 'Фото', takePhoto),
      more('🔊', 'Звук', () => { initAudio(); setMuted(!isMuted()); syncMute(); }, 'mute-btn'), more('⚙️', 'Меню', openMenu)));
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#more-menu, #more-btn')) closeMore(); }, true);
  ui.append(h('div', { id: 'touchbar' },
    h('button', { class: 'primary', onclick: confirmPlace }, '✓ Поставить'),
    h('button', { title: 'Повернуть', onclick: rotateGhost }, '↻'),
    h('button', { title: 'Отмена', onclick: cancelBuild }, '✕')));
  $('#rightcol').prepend(
    h('div', { id: 'menu-btns' },
      h('button', { title: 'К персонажу (Пробел)', onclick: centerPlayer }, '🎯'),
      h('button', { class: 'rot', title: 'Повернуть камеру влево (Q)', onclick: () => rotateCam(-1) }, '⟲'),
      h('button', { class: 'rot', title: 'Повернуть камеру вправо (E)', onclick: () => rotateCam(1) }, '⟳'),
      h('button', { title: 'Рюкзак (I)', onclick: openInventory }, '🎒'),
      h('button', { title: 'Крафт (C)', onclick: openCraft }, '🛠️'),
      h('button', { title: 'Журнал: цели, уют, рецепты (J)', onclick: () => openJournal('goals') }, '📖'),
      h('button', { title: 'Навыки (K)', onclick: () => openJournal('skills') }, '🌟'),
      h('button', { title: 'Сфотографировать (F)', onclick: takePhoto }, '📷'),
      h('button', { id: 'mute-btn', title: 'Звук (M)', onclick: () => { initAudio(); setMuted(!isMuted()); syncMute(); } }, '🔊'),
      h('button', { title: 'Меню (Esc)', onclick: openMenu }, '⚙️')),
    h('div', { id: 'resbar', title: 'Рюкзак (I)', onclick: () => openInventory() }),
  );
  els = { seasonIc: $('#tb-season .ic'), seasonNm: $('#tb-season .nm'), day: $('#tb-dn'), clock: $('#tb-clock'), wx: $('#tb-wx'), res: $('#resbar'), hint: $('#goalhint'), czn: $('#cz-n'), czname: $('#cz-name'), czbar: $('#cz-bar'), banner: $('#interior-banner'), sleep: $('#sleepmsg') };
  $('#sleepmsg').addEventListener('pointerdown', () => wakeUp());
  syncMute();
}
export function setSpeed(v) { G.speed = v; syncSpeed(); }
let lastSp = 1;
const closeMore = () => $('#more-menu')?.classList.remove('open');
const syncSpeed = () => {
  document.querySelectorAll('.speed button').forEach((b) => b.classList.toggle('on', +b.dataset.sp === G.speed));
  if (G.speed) lastSp = G.speed;
  $('#sp-pause')?.classList.toggle('on', !G.speed);
  const c = $('#sp-cycle'); if (c) { put(c, ['▶', '⏩', '⏭'][[1, 2, 4].indexOf(lastSp)] || '▶'); c.classList.toggle('on', !!G.speed); }
};
const syncMute = () => { const ic = isMuted() ? '🔇' : '🔊'; document.querySelectorAll('#mute-btn, .mute-btn').forEach((b) => { (b.querySelector('i') || b).textContent = ic; }); };

// textContent с эмодзи пересоздаёт картинки — пишем, только если текст изменился
const put = (el, v) => { if (el._t !== v) { el._t = el.textContent = v; } };
export function updateHUD(dt) {
  acc += dt; if (acc < .2) return; acc = 0;
  for (const b of document.querySelectorAll('#menu-btns .rot')) b.style.display = G.scene === 'world' ? '' : 'none';
  put(els.seasonIc, SEASON_ICON[season()]); put(els.seasonNm, ' ' + SEASONS[season()]); els.day.textContent = day() + 1; els.clock.textContent = fmtClock();
  const WN = { clear: 'Ясно', cloudy: 'Облачно', rain: 'Дождь', fog: 'Туман', snow: 'Снег' }, nx = forecastOn() && G.weather.next;
  put(els.wx, WX[G.weather.type] + (nx && nx !== G.weather.type ? ' → ' + WX[nx] : '')); els.wx.title = WN[G.weather.type] + (nx ? ` · дальше: ${WN[nx]}` : '');
  syncSpeed();
  document.querySelectorAll('.need').forEach((n) => { const k = n.dataset.k, v = G.needs[k]; n.querySelector('i').style.width = Math.max(2, v) + '%'; n.style.setProperty('--v', Math.max(.04, v / 100)); n.style.setProperty('--c', NEEDS.find((x) => x[0] === k)[3]); n.classList.toggle('low', v < 22); n.title = `${n.title.split(':')[0]}: ${Math.round(v)}`; });
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
  const hs = g.map((x) => x.id + (goalProg(x) || '')).join();
  if (hs !== els.hintSig) { els.hintSig = hs; els.hint.replaceChildren(...g.map((x) => h('div', { class: 'gh', title: x.desc, onclick: () => openJournal('goals', x.id) }, h('span', null, x.ic), h('div', null, h('b', null, x.name), h('small', null, x.desc)), h('div', { class: 'gt' }, h('b', null, goalTask(x), goalProg(x) ? h('em', null, ' · ' + goalProg(x)) : null), h('small', null, 'Награда ' + goalReward(x)))))); els.hint.style.display = g.length ? 'flex' : 'none'; }
  // интерьер
  const home = homeOf();
  if (home) { const bsig = bldName(home) + G.cozy.total; if (els.bsig !== bsig) { els.bsig = bsig; els.banner.replaceChildren(h('span', null, '🏠 Внутри: ' + bldName(home)), h('button', { title: 'Поспать прямо на полу — без кровати хуже', onclick: () => { if (G.needs.energy > 92) toast('Совсем не хочется спать'); else startSleep('floor', 0.7); } }, '💤 Прилечь'), h('button', { onclick: exitHome }, '↩ Выйти из дома')); } els.banner.style.display = 'flex'; }
  else { els.banner.style.display = 'none'; els.bsig = null; }
  els.sleep.style.display = G.player.sleeping ? 'block' : 'none';
  const tb = $('#touchbar'), on = UI.touch && UI.tool === 'build' && !!R.ghost;
  tb.style.display = on ? 'flex' : 'none';
  if (on) { tb.style.bottom = (innerHeight - $('#buildbar').getBoundingClientRect().top + 10) + 'px'; tb.firstChild.disabled = !R.ghost.valid; }
}
