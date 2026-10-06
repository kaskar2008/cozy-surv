// Кэш 3D-моделей (замена кэша спрайтов) и инстансинг: одинаковые объекты рисуются одним draw call'ом.
import * as THREE from 'three';
import { Builder, hz } from '../core/iso.js';

export const MAT = {
  lit: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  emi: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  tr: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
};

export function geoFrom(buf) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(buf.pos.slice(0, buf.n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(buf.nor.slice(0, buf.n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(buf.col.slice(0, buf.n * 4), 4));
  g.computeBoundingSphere();
  return g;
}
const decalMats = new WeakMap();
function decalPart(dc) {
  const tex = new THREE.CanvasTexture(dc.cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  decalMats.set(dc, mat);
  const ox = dc.tdx / 64, oz = -dc.tdx / 64, y = hz(dc.z + dc.tdz) + 0.004;
  const g = new THREE.BufferGeometry();
  const p = [dc.x0 + ox, y, dc.y0 + oz, dc.x0 + ox, y, dc.y1 + oz, dc.x1 + ox, y, dc.y1 + oz, dc.x1 + ox, y, dc.y0 + oz];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return { geo: g, mat };
}

const cache = new Map();
export function getModel(key, w, d, h, fn) {
  let m = cache.get(key);
  if (m) return m;
  const b = new Builder(w, d, h);
  try { fn(b); } catch (e) { console.error('model', key, e); }
  const parts = [];
  if (b.lit.n) parts.push({ geo: geoFrom(b.lit), mat: MAT.lit });
  if (b.emi.n) parts.push({ geo: geoFrom(b.emi), mat: MAT.emi });
  if (b.tr.n) parts.push({ geo: geoFrom(b.tr), mat: MAT.tr, order: 1 });
  for (const dc of b.decals) { const p = decalPart(dc); p.order = 1; parts.push(p); }
  m = { key, parts, h };
  cache.set(key, m);
  return m;
}
export function clearModels() {
  for (const m of cache.values()) for (const p of m.parts) { p.geo.dispose(); if (p.mat.map) { p.mat.map.dispose(); p.mat.dispose(); } }
  cache.clear();
}

// ───────────── инстансинг ─────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
export class Instancer {
  constructor(scene) { this.scene = scene; this.sets = new Map(); this.frame = 0; }
  begin() { this.frame++; for (const s of this.sets.values()) { s.n = 0; s.sum = 0; } }
  // x, y — угол объекта в клетках; sy — масштаб по высоте, sxz — по земле вокруг точки (px, pz) (центр основания)
  add(model, x, y, sy = 1, sxz = 1, px = 0, pz = 0, lift = 0) {
    let s = this.sets.get(model.key);
    if (!s) { s = { model, n: 0, cap: 0, arr: new Float32Array(16 * 16), sum: 0, prevSum: -1, prevN: -1, meshes: [] }; this.sets.set(model.key, s); }
    if ((s.n + 1) * 16 > s.arr.length) { const a = new Float32Array(s.arr.length * 2); a.set(s.arr); s.arr = a; }
    _p.set(x + px - px * sxz, lift, y + pz - pz * sxz); _s.set(sxz, sy, sxz);
    _m.compose(_p, _q.identity(), _s).toArray(s.arr, s.n * 16);
    s.sum += x * 3.1 + y * 7.7 + sy * 11 + sxz * 5 + lift * 13; s.n++;
  }
  end() {
    for (const s of this.sets.values()) {
      const changed = s.n !== s.prevN || s.sum !== s.prevSum;
      s.prevN = s.n; s.prevSum = s.sum;
      if (s.n > s.cap) {   // выросли: пересоздаём меши с запасом
        for (const m of s.meshes) { this.scene.remove(m); m.dispose(); }
        s.cap = Math.max(16, 1 << Math.ceil(Math.log2(s.n)));
        s.meshes = s.model.parts.map((p) => {
          const im = new THREE.InstancedMesh(p.geo, p.mat, s.cap);
          im.frustumCulled = false; im.renderOrder = p.order || 0; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          im.castShadow = p.mat === MAT.lit; im.receiveShadow = p.mat !== MAT.emi;
          im.userData.key = s.model.key; this.scene.add(im); return im;
        });
      } else if (!changed) continue;
      for (const im of s.meshes) { im.count = s.n; im.instanceMatrix.array.set(s.arr.subarray(0, s.n * 16)); im.instanceMatrix.needsUpdate = true; im.visible = s.n > 0; }
    }
  }
}

// ───────────── динамический пакет: всё, что перестраивается каждый кадр (анимации, персонажи, эффекты) ─────────────
export class DynBatch {
  constructor(scene) {
    this.scene = scene;
    this.b = new Builder(1, 1, 40);
    this.meshes = [];
    for (const [key, mat, order] of [['lit', MAT.lit, 0], ['emi', MAT.emi, 0], ['tr', MAT.tr, 2]]) {
      const g = new THREE.BufferGeometry();
      const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = order; m.castShadow = key === 'lit'; m.receiveShadow = key !== 'emi';
      scene.add(m); this.meshes.push({ key, g, m, cap: 0 });
    }
  }
  flush() {
    for (const e of this.meshes) {
      const buf = this.b[e.key];
      if (buf.cap !== e.cap) {
        e.cap = buf.cap;
        const pos = new THREE.BufferAttribute(buf.pos, 3), nor = new THREE.BufferAttribute(buf.nor, 3), col = new THREE.BufferAttribute(buf.col, 4);
        for (const a of [pos, nor, col]) a.setUsage(THREE.DynamicDrawUsage);
        e.g.setAttribute('position', pos); e.g.setAttribute('normal', nor); e.g.setAttribute('color', col);
      }
      const at = e.g.attributes;
      for (const [k, m] of [['position', 3], ['normal', 3], ['color', 4]]) { at[k].clearUpdateRanges(); if (buf.n) at[k].addUpdateRange(0, buf.n * m); at[k].needsUpdate = true; }
      e.g.setDrawRange(0, buf.n); e.m.visible = buf.n > 0;
    }
  }
}
