// Базовые элементы интерфейса: тосты, модальные окна, подсказки.
import { h, $ } from '../core/util.js';
import { UI } from './state.js';
import { S } from '../game/api.js';
import { sfx } from '../core/audio.js';

export function initUI() {
  S.toastFn = toast;
}
export function toast(msg, kind = '') {
  const root = $('#toasts'); if (!root) return;
  while (root.children.length >= 4) root.firstChild.remove();
  const el = h('div', { class: 'toast ' + kind }, msg);
  root.append(el);
  setTimeout(() => el.classList.add('out'), kind === 'goal' ? 6500 : 4200);
  setTimeout(() => el.remove(), kind === 'goal' ? 7000 : 4700);
}
export function openModal(title, body, opts = {}) {
  closeModal(true);
  const wrap = h('div', { class: 'modal-wrap', onclick: (e) => { if (e.target === wrap && !opts.sticky) closeModal(); } },
    h('div', { class: 'modal ' + (opts.cls || '') },
      h('div', { class: 'modal-head' }, h('h2', null, title), opts.noClose ? null : h('button', { class: 'x', onclick: () => closeModal() }, '✕')),
      h('div', { class: 'modal-body' }, body)));
  $('#modal-root').append(wrap);
  UI.modal = { wrap, onClose: opts.onClose };
  sfx('ui');
  return wrap;
}
export function closeModal(silent) {
  if (!UI.modal) return;
  const m = UI.modal; UI.modal = null; m.wrap.remove(); if (m.onClose && !silent) m.onClose();
}
let tipEl = null;
export function showTip(html, x, y) {
  if (!tipEl) { tipEl = h('div', { id: 'tooltip' }); document.body.append(tipEl); }
  tipEl.innerHTML = html; tipEl.style.display = 'block';
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = Math.min(innerWidth - r.width - 8, Math.max(8, x + 14)) + 'px';
  tipEl.style.top = Math.min(innerHeight - r.height - 8, Math.max(8, y - r.height - 12 < 8 ? y + 18 : y - r.height - 12)) + 'px';
}
export function hideTip() { if (tipEl) tipEl.style.display = 'none'; }
export const chip = (ic, txt, cls = '') => h('span', { class: 'chip ' + cls }, ic + ' ' + txt);
