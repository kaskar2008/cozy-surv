// Навыки: опыт копится от занятий, уровень даёт мягкие бонусы. Состояние — G.skills = { id: опыт }.
import { G } from './state.js';
import { SKILLS, XP_AT, MAX_LVL, CONSTS } from '../data/skills.js';
import * as eco from './eco.js';
import { toast, stat } from './api.js';
import { itemIcon, itemName } from '../data/items.js';
import { STATIONS } from '../data/recipes.js';
import * as fx from '../render/fx.js';
import { sfx } from '../core/audio.js';
import { pick } from '../core/util.js';

// станции, на которых готовят еду (опыт «Кулинарии», шедевры, скорость)
export const COOKING = new Set(['campfire', 'pot', 'kettle', 'oven', 'stove', 'ferment', 'smoker', 'drying']);

export const xpOf = (id) => (G.skills && G.skills[id]) || 0;
export function levelOf(id) {
  const x = xpOf(id); let l = 0;
  while (l < MAX_LVL && x >= XP_AT[l + 1]) l++;
  return l;
}
// бонус навыка id по ключу эффекта k: «за уровень» × уровень
export function bonus(id, k) {
  const e = SKILLS[id].eff.find((f) => f.k === k);
  return e ? e.per * levelOf(id) : 0;
}
// прогресс до следующего уровня: { lvl, cur, need, p } (p — доля 0..1, у максимума 1)
export function progressOf(id) {
  const lvl = levelOf(id), x = xpOf(id);
  if (lvl >= MAX_LVL) return { lvl, cur: 0, need: 0, p: 1 };
  const base = XP_AT[lvl], need = XP_AT[lvl + 1] - base;
  return { lvl, cur: Math.floor(x - base), need, p: (x - base) / need };
}

export function addXp(id, n) {
  if (!n || !SKILLS[id]) return;
  const sk = (G.skills ||= {}), before = levelOf(id);
  sk[id] = Math.min(XP_AT[MAX_LVL], (sk[id] || 0) + n);
  for (let l = before + 1, after = levelOf(id); l <= after; l++) levelUp(id, l);
}

function levelUp(id, lvl) {
  const s = SKILLS[id], gift = s.gifts?.[lvl];
  stat('skillUps');
  let msg = `${s.ic} ${s.n}: уровень ${lvl}!`;
  const perk = s.perks?.[lvl]; if (perk) msg += ' ' + perk + '.';
  if (gift) {
    const got = [];
    for (const k in gift) { const a = eco.add(k, gift[k]); if (a > 0) got.push(`+${a}${itemIcon(k)}`); }
    if (got.length) msg += '  ' + got.join(' ');
  }
  const rec = unlockedAt(id, lvl); if (rec) msg += `  Новый рецепт: ${rec}.`;
  if (!G.flags.skillHint) { G.flags.skillHint = 1; msg += '  Все навыки — кнопка 🌟 или клавиша K.'; }
  toast(msg, 'goal'); sfx('chime');
  fx.sparkle(G.player.x, G.player.y, 40, '#fff6b0', 10);
}

// ---------------------------------------------------------------- рецепты, открываемые навыком
export const recipeLock = (r) => (r.sk && levelOf(r.sk[0]) < r.sk[1] ? r.sk : null);
export const lockText = (r) => `${SKILLS[r.sk[0]].ic} ${SKILLS[r.sk[0]].n} ${r.sk[1]}`;
function unlockedAt(id, lvl) {
  const names = [];
  for (const st of Object.values(STATIONS)) for (const r of st.recipes) if (r.sk && r.sk[0] === id && r.sk[1] === lvl) names.push(r.name || Object.keys(r.out).map(itemName).join(', '));
  return names.join(', ');
}

// ---------------------------------------------------------------- астрономия
export const forecastOn = () => levelOf('astro') >= 3;
// ночью в телескоп: находит новое созвездие (с 6-го уровня). Возвращает название или null.
export function findConstellation() {
  if (levelOf('astro') < 6) return null;
  const seen = (G.flags.consts ||= []), rest = CONSTS.filter((c) => !seen.includes(c));
  if (!rest.length) return null;
  const c = pick(rest); seen.push(c);
  addXp('astro', 4);
  return c;
}
