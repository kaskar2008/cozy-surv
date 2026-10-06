// Сохранение: всегда в localStorage (кеш), а в облачном режиме ещё и в Firestore (см. cloud.js).
import { G, N, DAY } from './state.js';
import { rebuildOcc, T } from './world.js';
import { hash2 } from '../core/util.js';
import { b64, unb64 } from '../core/util.js';
import * as cloud from './cloud.js';

const KEY = 'cozy-island-save-v1';
const MODE_KEY = 'cozy-island-mode';
const SKIP = new Set(['nb', 'pop', 'mask', 'shk', 'comp']);
const replacer = (k, v) => (k.startsWith('_') || SKIP.has(k) ? undefined : v);

// Режим хранения: 'local' (только это устройство), 'cloud' (аккаунт + облако) или null (ещё не выбран).
export const getMode = () => { try { const m = localStorage.getItem(MODE_KEY); return m === 'cloud' || m === 'local' ? m : null; } catch (e) { return null; } };
export const setMode = (m) => { try { m ? localStorage.setItem(MODE_KEY, m) : localStorage.removeItem(MODE_KEY); } catch (e) { } };
// Облачный кеш у каждого аккаунта свой, чтобы чужая игра не подмешалась в локальную.
const cloudKey = (u) => `${KEY}:u:${u}`;
const storeKey = () => getMode() === 'cloud' ? (cloud.uid() ? cloudKey(cloud.uid()) : null) : KEY;
export function readCache(u) { try { const raw = localStorage.getItem(cloudKey(u)); return raw ? { json: raw, savedAt: JSON.parse(raw).savedAt || 0 } : null; } catch (e) { return null; } }
export function writeCache(u, json) { try { localStorage.setItem(cloudKey(u), json); return true; } catch (e) { return false; } }
export const readLocal = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
export function copyCloudToLocal() { try { const k = storeKey(); const raw = k && localStorage.getItem(k); if (raw) localStorage.setItem(KEY, raw); } catch (e) { } }
export const dayOf = () => Math.floor(G.t / DAY) + 1;
export function hasSave() { try { const k = storeKey(); return !!k && !!localStorage.getItem(k); } catch (e) { return false; } }
export function save() {
  if (G.noSave) return false;   // пока открыто приветственное окно, новая игра не сохраняется: перезагрузка снова покажет его
  const key = storeKey(); if (!key) return false;   // облачный режим, но аккаунт ещё не определён
  try {
    const data = {
      ver: 1, savedAt: Date.now(), day: dayOf(), dayLen: DAY, seed: G.seed, t: G.t, inv: G.inv, needs: G.needs, buffs: G.buffs, weather: G.weather, wx: G.wx, sky: { rainbow: G.sky.rainbow, aurora: G.sky.aurora, star: null },
      stats: G.stats, skills: G.skills, goals: G.goals, flags: G.flags, built: G.built, pets: G.pets, mail: G.mail, uid: G.uid, nid: G.nid, bid: G.bid, speed: G.speed,
      N, tiles: b64(G.tiles), shd: b64(G.shd), det: b64(G.det), fog: b64(G.fog),
      nodes: [...G.nodeMap.values()], blds: [...G.bMap.values()],
      player: { ...G.player, path: [], work: null, fx: null, sleeping: false },
      inPos: G.scene !== 'world' ? G.outPos : null, scene: G.scene,
    };
    const json = JSON.stringify(data, replacer);
    localStorage.setItem(key, json);
    if (getMode() === 'cloud') cloud.queue(json, data.savedAt, data.day);
    return true;
  } catch (e) { console.warn('save failed', e); return false; }
}
// Сохранение со старого острова (меньшего размера): кладём его в центр нового, вокруг — открытое море.
// Весь старый остров считается разведанным, туман остаётся только над морем вокруг.
function migrate(d) {
  const o = d.N || 56;
  if (o === N) { if (!d.fog) d.fog = b64(new Uint8Array(N * N).fill(1)); return d; }
  const off = Math.floor((N - o) / 2), ot = unb64(d.tiles), os = unb64(d.shd), od = unb64(d.det);
  const tiles = new Uint8Array(N * N).fill(T.WATER), shd = new Uint8Array(N * N), det = new Uint8Array(N * N), fog = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) shd[y * N + x] = Math.floor(hash2(x, y, d.seed + 11) * 8) % 3;
  for (let y = 0; y < o; y++) for (let x = 0; x < o; x++) {
    const i = y * o + x, j = (y + off) * N + x + off;
    tiles[j] = ot[i]; shd[j] = os[i]; det[j] = od[i]; fog[j] = 1;
  }
  const mv = (e) => { if (!e) return; if (typeof e.x === 'number') e.x += off; if (typeof e.y === 'number') e.y += off; if (typeof e.tx === 'number') e.tx += off; if (typeof e.ty === 'number') e.ty += off; };
  for (const n of d.nodes || []) mv(n);
  for (const b of d.blds || []) mv(b);
  for (const p of d.pets || []) mv(p);
  if (!d.scene || d.scene === 'world') { mv(d.player); mv(d.player?.restPos); }   // внутри дома координаты персонажа — комнатные
  mv(d.inPos);
  return { ...d, N, tiles: b64(tiles), shd: b64(shd), det: b64(det), fog: b64(fog) };
}
export function load(raw) {
  try {
    if (raw == null) { const k = storeKey(); raw = k && localStorage.getItem(k); }
    if (!raw) return false;
    const d = migrate(JSON.parse(raw));
    for (const k of Object.keys(G)) delete G[k];
    Object.assign(G, {
      ver: d.ver, seed: d.seed, N, t: d.t * DAY / (d.dayLen || 300), inv: d.inv, capBonus: {}, needs: d.needs, buffs: d.buffs || [], weather: d.weather, wx: d.wx || { rain: 0, snow: 0, fog: 0, cloud: 0 }, sky: { rainbow: 0, aurora: 0, star: null, ...(d.sky || {}), star: null },
      stats: d.stats || {}, skills: d.skills || {}, goals: d.goals || {}, flags: d.flags || {}, built: d.built || {}, pets: d.pets || [], npc: null, mail: d.mail || [], uid: d.uid || 1, scene: 'world', speed: d.speed ?? 1,
      cozy: { total: 0, out: 0, inn: 0, list: [] },
      player: { ...d.player, path: [], work: null, fx: null, sleeping: false, moving: false },
      tiles: unb64(d.tiles), shd: unb64(d.shd), det: unb64(d.det), fog: unb64(d.fog), fogVer: 1,
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
export function wipe() { try { const k = storeKey(); if (k) localStorage.removeItem(k); } catch (e) { } }
