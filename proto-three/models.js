// 3D-аналоги объектов игры из примитивов. Координаты как в 2D-draw(): x,y — в клетках от угла объекта,
// высоты z/h — в «пикселях» исходных спрайтов (переводим в мировые единицы через KZ).
import * as THREE from 'three';
import { shade } from '../js/core/util.js';

export const KX = 45.25;            // пикселей на мировую единицу по горизонтали (ромб 64×32)
export const KZ = 39.19;            // пикселей на единицу высоты при угле камеры 30°
export const hz = (px) => px / KZ;
const HWc = 64;                     // экранный сдвиг в пикселях на 1 клетку вдоль (x, -y)

// ── примитивы (единичные, плоское затенение: непроиндексированные, нормали по граням) ──
const baseCache = {};
function prismGeo(alongX) {
  const v = [];
  const q = (a, b, c, d) => v.push(...a, ...b, ...c, ...a, ...c, ...d);
  const t = (a, b, c) => v.push(...a, ...b, ...c);
  q([-.5, 0, .5], [.5, 0, .5], [.5, 1, 0], [-.5, 1, 0]);
  q([.5, 0, -.5], [-.5, 0, -.5], [-.5, 1, 0], [.5, 1, 0]);
  t([.5, 0, .5], [.5, 0, -.5], [.5, 1, 0]);
  t([-.5, 0, -.5], [-.5, 0, .5], [-.5, 1, 0]);
  if (!alongX) for (let i = 0; i < v.length; i += 3) { const x = v[i], z = v[i + 2]; v[i] = z; v[i + 2] = -x; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}
export function baseGeo(k) {
  if (baseCache[k]) return baseCache[k];
  let g;
  if (k === 'box') g = new THREE.BoxGeometry(1, 1, 1);
  else if (k === 'cyl') g = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  else if (k === 'cone') g = new THREE.ConeGeometry(1, 1, 10, 1);
  else if (k === 'sph') g = new THREE.IcosahedronGeometry(1, 1);
  else if (k === 'rock') g = new THREE.IcosahedronGeometry(1, 0);
  else if (k === 'pyr') { g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(Math.PI / 4); }
  else if (k === 'prismX') g = prismGeo(true);
  else if (k === 'prismZ') g = prismGeo(false);
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return (baseCache[k] = g);
}

// ── части: все в мировых координатах three (X = x, Y = вверх, Z = y) ──
const part = (k, p, s, col, q) => ({ k, p, s, col, q });
const box = (x, y, z, w, d, h, col) => part('box', [x + w / 2, hz(z + h / 2), y + d / 2], [w, hz(h), d], col);
const cyl = (cx, cy, z, r, h, col) => part('cyl', [cx, hz(z + h / 2), cy], [r, hz(h), r], col);
const cone = (cx, cy, z, r, h, col) => part('cone', [cx, hz(z + h / 2), cy], [r, hz(h), r], col);
// blob: эллипсоид; dx — экранный сдвиг по горизонтали (как c.translate(dx,0) в 2D)
const blob = (cx, cy, z, rx, ry, col, dx = 0, kind = 'sph') => {
  const R = rx / KX;
  return part(kind, [cx + dx / HWc, hz(z), cy - dx / HWc], [R, R * (ry / rx) * 1.15, R], col);
};
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
const rod = (a, b, rpx, col) => {
  _d.set(b[0] - a[0], hz(b[2]) - hz(a[2]), b[1] - a[1]);
  const len = _d.length(), r = rpx / KX;
  const q = new THREE.Quaternion().setFromUnitVectors(_up, _d.normalize());
  return part('cyl', [(a[0] + b[0]) / 2, (hz(a[2]) + hz(b[2])) / 2, (a[1] + b[1]) / 2], [r, len, r], col, q);
};
const prism = (x, y, z, w, d, h, o, axis, col) => {
  const W = w + 2 * o, D = d + 2 * o;
  return part(axis === 'x' ? 'prismX' : 'prismZ', [x - o + W / 2, hz(z), y - o + D / 2], [W, hz(h), D], col);
};
const pyramid = (x, y, z, w, d, h, o, col) =>
  part('pyr', [x + w / 2, hz(z + h / 2), y + d / 2], [w + 2 * o, hz(h), d + 2 * o], col);

const FOL = { oak: '#86c95f', birch: '#a6d66e', pine: '#4f9a5b' };
const DIRS = [[.5, 0], [1, .5], [.5, 1], [0, .5]];

const MODELS = {
  oak() {
    const col = FOL.oak, z0 = 28, P = [cyl(.5, .5, 0, .08, 24, '#7b5535')];
    for (const [dx, z, rx, ry, k] of [[-14, z0 + 2, 19, 15, -.08], [14, z0 + 3, 19, 15, -.12], [0, z0 + 14, 22, 17, 0], [-6, z0 + 22, 15, 12, .08], [7, z0 + 24, 14, 11, .1]])
      P.push(blob(.5, .5, z, rx, ry, shade(col, k), dx));
    return P;
  },
  birch() {
    const col = FOL.birch, z0 = 34, sc = .85;
    const P = [cyl(.5, .5, 0, .06, 30, '#e8e2d4')];
    for (const [dx, z, rx, ry, k] of [[-14, z0 + 2, 19, 15, -.08], [14, z0 + 3, 19, 15, -.12], [0, z0 + 14, 22, 17, 0], [-6, z0 + 22, 15, 12, .08], [7, z0 + 24, 14, 11, .1]])
      P.push(blob(.5, .5, z, rx * sc, ry * sc, shade(col, k), dx * sc));
    return P;
  },
  pine() {
    const col = FOL.pine;
    return [cyl(.5, .5, 0, .07, 14, '#6e4a30'), cone(.5, .5, 8, .36, 32, shade(col, -.05)), cone(.5, .5, 24, .30, 30, col), cone(.5, .5, 40, .22, 28, shade(col, .06))];
  },
  bush() {
    return [[-9, 9, 13, 10], [9, 9, 13, 10], [0, 15, 14, 11]].map(([dx, z, rx, ry]) => blob(.5, .5, z, rx, ry, '#6fbd55', dx));
  },
  boulder() {
    return [[-11, 8, 17, 12, 0], [10, 7, 15, 11, -.1], [0, 17, 17, 13, .1]].map(([dx, z, rx, ry, k]) => blob(.5, .5, z, rx, ry, shade('#a2a5ad', k), dx, 'rock'))
      .concat([blob(.5, .5, 24, 8, 3.5, '#7fae5a', -6)]);
  },
  rock() {
    return [[-4, 5, 10, 7, 0], [6, 4, 8, 6, -.1]].map(([dx, z, rx, ry, k]) => blob(.5, .5, z, rx, ry, shade('#a2a5ad', k), dx, 'rock'));
  },
  fiber() {
    const P = [];
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * .22, h = 15 + ((i * 5 + 3) % 9);
      P.push(cone(.5 + (i - 4) * .035 + a * .1, .5 - (i - 4) * .035, 0, .028, h, shade('#8fcf6a', ((i % 3) - 1) * .08)));
    }
    return P;
  },
  flowers() {
    const P = [], col = '#f07aa8';
    for (const [dx, dy] of [[-10, 2], [-2, -3], [8, 1], [3, 6], [-7, 7], [13, -4]]) {
      const x = .5 + dx / HWc, y = .5 - dx / HWc + dy / 32;
      P.push(cyl(x, y, 0, .018, 9, '#5da84e'), blob(x, y, 11, 3, 3, col), blob(x, y, 12, 1.6, 1.6, '#f5c84a'));
    }
    return P;
  },
  campfire() {
    const P = [cyl(.5, .5, 0, .3, 1, '#4a3a30')];
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; P.push(blob(.5 + Math.cos(a) * .34, .5 + Math.sin(a) * .34, 3, 6.5, 4.5, shade('#a2a5ac', ((i * 7) % 5 - 2) * .05), 0, 'rock')); }
    P.push(rod([.3, .42, 4], [.7, .58, 6], 5, '#6d4a2e'), rod([.34, .62, 4], [.66, .36, 6], 5, '#85603c'));
    return P;
  },
  log_seat() { return [cyl(.5, .5, 0, .26, 10, '#9a6c43'), cyl(.5, .5, 10, .26, .6, '#d9b27a')]; },
  bench() {
    const w = 2;
    return [box(.15, .22, 0, .1, .56, 14, '#6e4a30'), box(w - .25, .22, 0, .1, .56, 14, '#6e4a30'),
      box(.05, .12, 14, w - .1, .76, 4, '#c08a58'), box(.05, .12, 18, w - .1, .08, 14, '#b27c4c')];
  },
  barrel() {
    return [cyl(.5, .5, 0, .32, 28, '#8b5e3c'), cyl(.5, .5, 5.6, .335, 2, '#4a3a30'), cyl(.5, .5, 22.4, .335, 2, '#4a3a30'), cyl(.5, .5, 28, .3, .6, '#5a3d26')];
  },
  crate() {
    return [box(.1, .1, 0, .8, .8, 18, '#b98557'), box(.06, .06, 18, .88, .88, 3, '#a8734a'), box(.1, .1, 0, .12, .8, 18, '#8b5a3a'), box(.78, .1, 0, .12, .8, 18, '#8b5a3a')];
  },
  raised_bed() {
    return [box(.14, .14, 0, 1.72, 1.72, 8, '#8a6644'),
      box(0, 0, 0, 2, .14, 9, '#b98557'), box(0, 0, 0, .14, 2, 9, '#b98557'), box(0, 1.86, 0, 2, .14, 9, '#c69265'), box(1.86, 0, 0, .14, 2, 9, '#a8734a')];
  },
  lamp_post() {
    return [cyl(.5, .5, 0, .06, 54, '#3c4048'), box(.36, .36, 54, .28, .28, 18, '#e8eef2'), box(.3, .3, 72, .4, .4, 4, '#3c4048')];
  },
  shed() {
    return [box(.1, .1, 0, 1.8, 1.8, 36, '#a9815a'), box(.55, 1.9, 0, .9, .03, 28, '#6b4328'), prism(-.05, -.05, 36, 2.1, 2.1, 22, 0, 'z', '#7f8aa0')];
  },
  home() {
    return [box(.08, .08, 0, 1.84, 1.84, 1, '#8a6a48'), pyramid(.1, .1, 0, 1.8, 1.8, 56, .08, '#d9b878'), cyl(1, 1, 56, .03, 14, '#7b5535')];
  },
  well() {
    return [cyl(1, 1, 0, .62, 14, '#9a9ca3'), cyl(1, 1, 14, .5, .6, '#2e6a8a'),
      box(.23, .95, 14, .1, .1, 40, '#7b5535'), box(1.67, .95, 14, .1, .1, 40, '#7b5535'),
      box(.2, .93, 52, 1.6, .14, 5, '#6e4a30'), prism(.05, .45, 56, 1.9, 1.1, 16, .12, 'x', '#a5503e')];
  },
  fence(mask) {
    const P = [box(.43, .43, 0, .14, .14, 22, '#8a6440')];
    DIRS.forEach((p, i) => { if (mask & (1 << i)) for (const z of [7, 15]) P.push(rod([.5, .5, z], [p[0], p[1], z], 1.5, '#a9774a')); });
    return P;
  },
  hedge(mask) {
    const col = '#6fbd55', P = [blob(.5, .5, 12, 15, 12, shade(col, .05))];
    DIRS.forEach((p, i) => { if (mask & (1 << i)) for (const t of [.5, .8]) P.push(blob(.5 + (p[0] - .5) * t, .5 + (p[1] - .5) * t, 11, 13, 10, col)); });
    return P;
  },
};

const modelCache = {};
// ключ вида 'oak' или 'fence:5'
export function getModel(key) {
  if (modelCache[key]) return modelCache[key];
  const [name, arg] = key.split(':');
  const parts = MODELS[name](arg === undefined ? 0 : +arg);
  return (modelCache[key] = { parts });
}

// Слияние всех частей модели в одну геометрию с цветами вершин (1 draw call на модель)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function mergeParts(parts) {
  let n = 0;
  const gs = parts.map((p) => { const g = baseGeo(p.k); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  parts.forEach((pt, i) => {
    const src = gs[i].attributes.position;
    _p.set(...pt.p); _s.set(...pt.s); _q.copy(pt.q || _q.identity());
    _m.compose(_p, _q, _s);
    _c.set(pt.col);
    const v = new THREE.Vector3();
    for (let j = 0; j < src.count; j++) {
      v.fromBufferAttribute(src, j).applyMatrix4(_m);
      pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
      col[o * 3] = _c.r; col[o * 3 + 1] = _c.g; col[o * 3 + 2] = _c.b;
      o++;
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
