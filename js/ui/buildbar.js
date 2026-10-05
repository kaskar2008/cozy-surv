// Нижняя панель строительства: категории, карточки построек и мебели.
import { h, $ } from '../core/util.js';
import { UI } from './state.js';
import { G } from '../game/state.js';
import { BDEF, BCATS } from '../data/buildings/index.js';
import { FDEF, FCATS } from '../data/furniture.js';
import { ITEMS, itemIcon, itemName } from '../data/items.js';
import * as eco from '../game/eco.js';
import { unlocked, lockReason } from '../game/api.js';
import { furnLock } from '../game/interior.js';
import { showTip, hideTip, toast } from './ui.js';
import { R } from '../render/scene.js';
import { sfx } from '../core/audio.js';

let root, catRow, cardRow, handle, lastSig = '';
export function buildBar() {
  root = $('#buildbar');
  catRow = h('div', { class: 'cats' }); cardRow = h('div', { class: 'cards' });
  handle = h('button', { class: 'bb-handle', title: 'Свернуть / развернуть панель (B)', onclick: toggleBar }, '⌄');
  root.append(handle, catRow, cardRow);
  root.addEventListener('wheel', (e) => { const row = catRow.contains(e.target) ? catRow : cardRow; const d = e.deltaX || e.deltaY; if (d) { row.scrollLeft += d; e.preventDefault(); } }, { passive: false });
  renderBar();
}
const inside = () => G.scene !== 'world';
export function setTool(t) {
  hideTip();
  UI.tool = t; if (t !== 'build') { UI.def = null; UI.fdef = null; R.ghost = null; }
  renderBar(true);
}
export function cancelBuild() { if (UI.tool !== 'select') setTool('select'); }
export function toggleBar() { UI.buildOpen = !UI.buildOpen; root.classList.toggle('closed', !UI.buildOpen); handle.textContent = UI.buildOpen ? '⌄' : '⌃'; }

export function renderBar(soft) {
  const ins = inside(), cats = ins ? FCATS : BCATS, cur = ins ? UI.fcat : UI.cat;
  catRow.replaceChildren(...[
    h('button', { class: 'cat tool' + (UI.tool === 'select' ? ' on' : ''), title: 'Обычный режим (Esc)', onclick: () => setTool('select') }, '🖐', h('span', null, 'Курсор')),
    ...cats.map((c) => h('button', { class: 'cat' + (c.id === cur && UI.tool !== 'demolish' ? ' on' : ''), onclick: () => { if (!UI.buildOpen) toggleBar(); if (ins) UI.fcat = c.id; else UI.cat = c.id; if (UI.tool === 'demolish') UI.tool = 'select'; renderBar(); sfx('ui'); } }, c.icon, h('span', null, c.name))),
    ins ? null : h('button', { class: 'cat tool' + (UI.tool === 'demolish' ? ' on' : ''), title: 'Снести постройку (X) — вернёт 60% материалов', onclick: () => setTool(UI.tool === 'demolish' ? 'select' : 'demolish') }, '🗑️', h('span', null, 'Снести')),
  ].filter(Boolean));
  const list = ins ? Object.values(FDEF).filter((d) => d.cat === cur) : Object.values(BDEF).filter((d) => d.cat === cur);
  cardRow.replaceChildren(...list.map((d) => card(d, ins)));
  lastSig = '';
  updateCards();
}
function card(d, ins) {
  const el = h('button', { class: 'card', 'data-id': d.id, onclick: () => pickDef(d, ins) },
    h('div', { class: 'ico' }, d.icon), h('div', { class: 'nm' }, d.name),
    h('div', { class: 'cost' }, ...Object.entries(d.cost).map(([k, v]) => h('span', { 'data-k': k, 'data-n': v }, `${v}${itemIcon(k)}`))),
    d.cost && !Object.keys(d.cost).length ? h('div', { class: 'cost free' }, 'бесплатно') : null,
    h('div', { class: 'lock' }, '🔒'));
  el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') showTip(tipHtml(d, ins), e.clientX, e.clientY); });
  el.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') showTip(tipHtml(d, ins), e.clientX, e.clientY); });
  el.addEventListener('pointerleave', hideTip);
  return el;
}
function pickDef(d, ins) {
  const lock = ins ? furnLock(d) : (unlocked(d) ? '' : lockReason(d));
  if (lock) { toast(lock, 'warn'); sfx('no'); return; }
  if ((ins ? UI.fdef : UI.def) === d) { setTool('select'); return; }
  UI.tool = 'build'; if (ins) { UI.fdef = d; UI.def = null; } else { UI.def = d; UI.fdef = null; }
  UI.rot = 0; R.ghost = null; renderBar(true); sfx('ui');
}
function tipHtml(d, ins) {
  const cost = Object.entries(d.cost).map(([k, v]) => `<span class="${eco.count(k) >= v ? '' : 'miss'}">${v}${itemIcon(k)} ${itemName(k)}</span>`).join(' · ') || 'бесплатно';
  const lock = ins ? furnLock(d) : (unlocked(d) ? '' : lockReason(d));
  const sz = d.wall ? `${d.size[0]} на стене` : `${d.size[0]}×${d.size[1]}`;
  return `<b>${d.icon} ${d.name}</b> <small>· ${sz}</small><div class="tdesc">${d.desc || ''}</div><div class="tcost">${cost}</div>${lock ? `<div class="tlock">🔒 ${lock}</div>` : ''}${d.drag ? '<div class="tnote">Тяни, чтобы поставить несколько</div>' : ''}`;
}
export function updateCards() {
  const ins = inside();
  const sig = ins ? UI.fdef?.id : UI.def?.id;
  for (const el of cardRow.children) {
    const d = ins ? FDEF[el.dataset.id] : BDEF[el.dataset.id]; if (!d) continue;
    const lock = ins ? furnLock(d) : (unlocked(d) ? '' : lockReason(d));
    el.classList.toggle('locked', !!lock);
    el.classList.toggle('sel', (ins ? UI.fdef : UI.def) === d && UI.tool === 'build');
    let afford = true;
    el.querySelectorAll('.cost span').forEach((s) => { const ok = eco.count(s.dataset.k) >= +s.dataset.n; s.classList.toggle('miss', !ok); if (!ok) afford = false; });
    el.classList.toggle('poor', !afford && !lock);
  }
}
