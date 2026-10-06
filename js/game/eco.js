// Инвентарь и лимиты склада.
import { G } from './state.js';
import { ITEMS, BASE_CAP } from '../data/items.js';
import { BDEF } from '../data/buildings/index.js';
import { FDEF } from '../data/furniture.js';

export function recomputeCaps() {
  const bonus = {};
  for (const b of G.bMap.values()) { const cap = !b.bld && BDEF[b.t]?.cap; if (cap) for (const k in cap) bonus[k] = (bonus[k] || 0) + cap[k]; }
  for (const h of G.bMap.values()) if (BDEF[h.t].home && h.in) for (const it of h.in.items) { const f = FDEF[it.t]?.cap; if (!f || (f._power && !h.st.powered)) continue; for (const k in f) if (k !== '_power') bonus[k] = (bonus[k] || 0) + f[k]; }
  G.capBonus = bonus;
}

export const capOf = (item) => { const c = ITEMS[item].c; return (BASE_CAP[c] || 30) + ((G.capBonus || {})[c] || 0); };
export const count = (item) => G.inv[item] || 0;
export const has = (item, n = 1) => (G.inv[item] || 0) >= n;
export const space = (item) => Math.max(0, capOf(item) - count(item));
export function add(item, n = 1) {
  if (!ITEMS[item]) return 0;
  const k = Math.min(n, ITEMS[item].c === 'tool' ? Math.max(0, 1 - count(item)) : space(item));
  if (k > 0) { G.inv[item] = count(item) + k; G.stats.got = (G.stats.got || 0) + k; (G.stats.items ||= {})[item] = ((G.stats.items[item]) || 0) + k; }
  return k;
}
export function take(item, n = 1) {
  if (count(item) < n) return false;
  G.inv[item] -= n; if (G.inv[item] <= 0) delete G.inv[item];
  return true;
}
export const canAfford = (cost) => Object.entries(cost || {}).every(([k, v]) => count(k) >= v);
export function pay(cost) { if (!canAfford(cost)) return false; for (const k in cost) take(k, cost[k]); return true; }
export function refund(cost, f = 0.6) { for (const k in cost) add(k, Math.floor(cost[k] * f)); }
export const missing = (cost) => Object.entries(cost || {}).filter(([k, v]) => count(k) < v).map(([k, v]) => [k, v - count(k)]);
