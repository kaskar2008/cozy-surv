// Главный экран: показывается при заходе на сайт. Фон — живой параллакс-пейзаж (menuBg.js), игра стартует после выбора пункта.
import { h, $ } from '../core/util.js';
import { readLocal, getMode } from '../game/save.js';
import { openModal, closeModal, askConfirm } from './ui.js';
import { startMenuBg, stopMenuBg, setMenuMotion } from './menuBg.js';
import { isMuted, setMuted, initAudio } from '../core/audio.js';
import { canFullscreen, isFullscreen, toggleFullscreen, openHelp } from './modals.js';
import { UI } from './state.js';

const PREF = 'cozy-island-prefs';
const prefs = () => { try { return JSON.parse(localStorage.getItem(PREF)) || {}; } catch (e) { return {}; } };
const setPref = (k, v) => { try { localStorage.setItem(PREF, JSON.stringify({ ...prefs(), [k]: v })); } catch (e) { } };
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionOn = () => prefs().motion ?? !reduced();

// Что известно о сохранении, не запуская игру: { has, hint }
function saveInfo() {
  if (getMode() === 'cloud') return { has: true, hint: '☁️ Игра в облаке' };
  const raw = readLocal(); if (!raw) return { has: false };
  try {
    const d = JSON.parse(raw), when = d.savedAt ? new Date(d.savedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
    return { has: true, hint: `День ${d.day || '?'}${when ? ' · ' + when : ''}` };
  } catch (e) { return { has: true, hint: '' }; }
}

let root = null, onKey = null;

function openSettings() {
  const body = h('div', { class: 'menu' });
  const draw = () => body.replaceChildren(
    h('button', { onclick: () => { initAudio(); setMuted(!isMuted()); draw(); } }, isMuted() ? '🔇 Звук: выключен' : '🔊 Звук: включён'),
    h('button', { onclick: () => { const on = !motionOn(); setPref('motion', on); setMenuMotion(on); draw(); } }, motionOn() ? '🌊 Движение фона: включено' : '🌊 Движение фона: выключено'),
    canFullscreen && h('button', { onclick: () => { toggleFullscreen(); setTimeout(draw, 400); } }, isFullscreen() ? '🗗 Выйти из полного экрана' : '⛶ Во весь экран'),
    h('p', { class: 'muted' }, getMode() === 'cloud' ? '☁️ Игра хранится в облаке. Хранилище меняется внутри игры: ⚙️ → «Облако».' : '💾 Игра хранится в этом браузере. Перенести её в облако можно внутри игры: ⚙️ → «Облако».'),
    h('button', { class: 'primary', onclick: () => closeModal() }, 'Готово'));
  draw();
  openModal('⚙️ Настройки', body, { cls: 'narrow' });
}

// Показать меню. Вернёт 'continue' или 'new', когда игрок выбрал; меню остаётся на экране (кнопки заблокированы),
// пока игра загружается — см. hideMainMenu.
export function showMainMenu() {
  return new Promise((resolve) => {
    const info = saveInfo(), cv = h('canvas', { id: 'menubg' });
    let busy = false;
    const pickAndGo = (kind, btn) => {
      if (busy) return; busy = true;
      for (const b of root.querySelectorAll('.mm-btn')) b.disabled = true;
      btn.classList.add('loading'); btn.append(h('small', null, 'Загружаю…'));
      resolve(kind);
    };
    const btn = (cls, label, hint, fn) => h('button', { class: 'mm-btn ' + cls, onclick: (e) => fn(e.currentTarget) }, h('span', null, label), hint ? h('small', null, hint) : null);
    const list = h('div', { class: 'mm-btns' },
      info.has && btn('primary', '▶ Продолжить', info.hint, (b) => pickAndGo('continue', b)),
      btn(info.has ? '' : 'primary', '🌱 Новая игра', info.has ? '' : 'Тихий остров ждёт', (b) => info.has
        ? askConfirm('🌱 Новая игра', 'Текущий остров будет удалён, и всё начнётся с самого начала.', 'Начать заново', () => pickAndGo('new', b))
        : pickAndGo('new', b)),
      btn('', '⚙️ Настройки', '', openSettings),
      btn('', '❓ Как играть', '', openHelp));
    root = h('div', { id: 'mainmenu' }, cv, h('div', { class: 'mm-shade' }),
      h('div', { class: 'mm-box' },
        h('div', { class: 'mm-logo' }, h('div', { class: 'mm-ic' }, '🏝️'), h('h1', null, 'Уютный остров'), h('p', null, 'Тихий остров, костёр, чайник и всё время мира')),
        list),
      h('div', { class: 'mm-foot' }, 'Автосохранение · значки Twemoji (CC-BY 4.0)'));
    document.body.append(root);
    startMenuBg(cv, { animate: motionOn() });
    onKey = (e) => { if (e.key === 'Escape' && UI.modal) closeModal(); };
    addEventListener('keydown', onKey);
    setTimeout(() => $('.mm-btn.primary', root)?.focus({ preventScroll: true }), 400);
  });
}

// Плавно убрать меню (когда игра готова к показу)
export function hideMainMenu() {
  return new Promise((res) => {
    if (!root) return res();
    removeEventListener('keydown', onKey);
    const r = root; root = null; r.classList.add('out');
    setTimeout(() => { stopMenuBg(); r.remove(); res(); }, 750);
  });
}
