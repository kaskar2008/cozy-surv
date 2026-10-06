// Сохранение в localStorage.
import { G, N, DAY } from './state.js';
import { rebuildOcc } from './world.js';

const KEY = 'cozy-island-save-v1';
const b64 = (arr) => { let s = ''; for (let i = 0; i < arr.length; i += 8192) s += String.fromCharCode.apply(null, arr.subarray(i, i + 8192)); return btoa(s); };
const unb64 = (s) => { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; };
const SKIP = new Set(['nb', 'pop', 'mask', 'shk', 'comp']);
const replacer = (k, v) => (k.startsWith('_') || SKIP.has(k) ? undefined : v);

export function hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
export function save() {
  try {
    const data = {
      ver: 1, dayLen: DAY, seed: G.seed, t: G.t, inv: G.inv, needs: G.needs, buffs: G.buffs, weather: G.weather, wx: G.wx, sky: { rainbow: G.sky.rainbow, aurora: G.sky.aurora, star: null },
      stats: G.stats, goals: G.goals, flags: G.flags, built: G.built, pets: G.pets, mail: G.mail, uid: G.uid, nid: G.nid, bid: G.bid, speed: G.speed,
      tiles: b64(G.tiles), shd: b64(G.shd), det: b64(G.det),
      nodes: [...G.nodeMap.values()], blds: [...G.bMap.values()],
      player: { ...G.player, path: [], work: null, fx: null, sleeping: false },
      inPos: G.scene !== 'world' ? G.outPos : null, scene: G.scene,
    };
    localStorage.setItem(KEY, JSON.stringify(data, replacer));
    return true;
  } catch (e) { console.warn('save failed', e); return false; }
}
export function load() {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return false;
    const d = JSON.parse(raw);
    for (const k of Object.keys(G)) delete G[k];
    Object.assign(G, {
      ver: d.ver, seed: d.seed, N, t: d.t * DAY / (d.dayLen || 300), inv: d.inv, capBonus: {}, needs: d.needs, buffs: d.buffs || [], weather: d.weather, wx: d.wx || { rain: 0, snow: 0, fog: 0, cloud: 0 }, sky: { rainbow: 0, aurora: 0, star: null, ...(d.sky || {}), star: null },
      stats: d.stats || {}, goals: d.goals || {}, flags: d.flags || {}, built: d.built || {}, pets: d.pets || [], npc: null, mail: d.mail || [], uid: d.uid || 1, scene: 'world', speed: d.speed ?? 1,
      cozy: { total: 0, out: 0, inn: 0, list: [] },
      player: { ...d.player, path: [], work: null, fx: null, sleeping: false, moving: false },
      tiles: unb64(d.tiles), shd: unb64(d.shd), det: unb64(d.det),
      nid: d.nid, bid: d.bid, nodeMap: new Map(), bMap: new Map(), nAt: new Int32Array(N * N), bAt: new Int32Array(N * N), blk: new Uint8Array(N * N),
      dirtyBlk: true, dirtyLinks: true,
    });
    if (d.scene !== 'world' && d.inPos) { G.player.x = d.inPos.x; G.player.y = d.inPos.y; }
    for (const n of d.nodes) G.nodeMap.set(n.id, n);
    for (const b of d.blds) { b.nb = []; b.mask = 0; G.bMap.set(b.id, b); }
    for (const p of G.pets) p.in = null;
    rebuildOcc();
    return true;
  } catch (e) { console.warn('load failed', e); return false; }
}
export function wipe() { try { localStorage.removeItem(KEY); } catch (e) { } }
