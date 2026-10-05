// Связи между постройками: соседи, сети воды и электричества, маски соединений, хранилища.
import { G, N } from './state.js';
import { BDEF } from '../data/buildings/index.js';
import { ti, inB, rebuildBlk } from './world.js';
import { recomputeCaps } from './eco.js';
import { NDEF } from '../data/nodes.js';

const EDGE = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function neighborsOfRect(x, y, w, d, skipId = 0) {
  const seen = new Set(), out = [];
  const chk = (tx, ty) => {
    if (!inB(tx, ty)) return;
    const id = G.bAt[ti(tx, ty)];
    if (id && id !== skipId && !seen.has(id)) { seen.add(id); out.push(G.bMap.get(id)); }
  };
  for (let i = 0; i < w; i++) { chk(x + i, y - 1); chk(x + i, y + d); }
  for (let j = 0; j < d; j++) { chk(x - 1, y + j); chk(x + w, y + j); }
  return out;
}

export function rebuildLinks() {
  G.dirtyLinks = false;
  for (const b of G.bMap.values()) {
    b.nb = neighborsOfRect(b.x, b.y, b.w, b.d, b.id);
    const def = BDEF[b.t];
    // маски соединений
    if (def.conduit || def.strand) {
      let m = 0;
      EDGE.forEach(([dx, dy], i) => {
        const id = inB(b.x + dx, b.y + dy) ? G.bAt[ti(b.x + dx, b.y + dy)] : 0;
        const o = id && G.bMap.get(id); if (!o) return;
        const od = BDEF[o.t];
        if (def.conduit ? !!(od.net && od.net[def.conduit]) : od.strand === def.strand) m |= 1 << i;
      });
      b.mask = m;
    }
  }
  // компоненты сетей
  G.comp = { water: new Map(), power: new Map() };
  for (const type of ['water', 'power']) {
    const map = G.comp[type], seenAll = new Set();
    for (const b of G.bMap.values()) {
      const nd = BDEF[b.t].net?.[type];
      if (!nd || seenAll.has(b.id)) continue;
      const comp = { nodes: [], type };
      const stack = [b]; seenAll.add(b.id);
      while (stack.length) {
        const cur = stack.pop(); comp.nodes.push(cur); map.set(cur.id, comp);
        if (BDEF[cur.t].net[type].leaf && cur !== b) continue;      // листья не проводят дальше
        for (const o of cur.nb) {
          const on = BDEF[o.t].net?.[type];
          if (!on || seenAll.has(o.id)) continue;
          seenAll.add(o.id); stack.push(o);
        }
      }
    }
  }
  recomputeCaps();
}
export function netOf(b, type) {
  const comp = G.comp?.[type]?.get(b.id);
  if (!comp) return null;
  let stock = 0, cap = 0, gen = 0, use = 0;
  const key = type === 'water' ? 'water' : 'power';
  for (const n of comp.nodes) { const nd = BDEF[n.t].net[type]; stock += n.st[key] || 0; cap += nd.cap || 0; gen += n.st.gen || 0; }
  return { comp, nodes: comp.nodes, stock, cap, gen };
}
export function netAdd(b, type, amt) {
  const comp = G.comp?.[type]?.get(b.id); if (!comp) return 0;
  const key = type === 'water' ? 'water' : 'power'; let left = amt;
  // сначала баки/ёмкости с наибольшей вместимостью
  const nodes = comp.nodes.filter((n) => (BDEF[n.t].net[type].cap || 0) > 0).sort((a, c) => BDEF[c.t].net[type].cap - BDEF[a.t].net[type].cap);
  for (const n of nodes) {
    if (left <= 0) break;
    const cap = BDEF[n.t].net[type].cap, cur = n.st[key] || 0, k = Math.min(left, cap - cur);
    if (k > 0) { n.st[key] = cur + k; left -= k; }
  }
  return amt - left;
}
export function netTake(b, type, amt) {
  const comp = G.comp?.[type]?.get(b.id); if (!comp) return 0;
  const key = type === 'water' ? 'water' : 'power'; let left = amt;
  for (const n of comp.nodes) { if (left <= 0) break; const cur = n.st[key] || 0, k = Math.min(left, cur); if (k > 0) { n.st[key] = cur - k; left -= k; } }
  return amt - left;
}
export const netHas = (b, type, amt) => { const n = netOf(b, type); return !!n && n.stock >= amt; };

// ---------- тепло ----------
export function isHot(b) { const d = b.def || BDEF[b.t]; return !!d.burner && b.st.lit && b.st.fuel > 0; }
export function heated(b) { return b.nb.some((o) => isHot(o)); }

// ---------- блокировка ----------
export const nodeBlocks = (n) => NDEF[n.t].block && n.st !== 'stump' && n.st !== 'sapling';
export function ensureLinks() {
  if (G.dirtyBlk) rebuildBlk(nodeBlocks);
  if (G.dirtyLinks) rebuildLinks();
}

// маска соединений для призрака (до постройки)
export function maskFor(def, x, y) {
  if (!def.conduit && !def.strand) return 0;
  let m = 0;
  EDGE.forEach(([dx, dy], i) => {
    const id = inB(x + dx, y + dy) ? G.bAt[ti(x + dx, y + dy)] : 0;
    const o = id && G.bMap.get(id); if (!o) return;
    const od = BDEF[o.t];
    if (def.conduit ? !!(od.net && od.net[def.conduit]) : od.strand === def.strand) m |= 1 << i;
  });
  return m;
}
