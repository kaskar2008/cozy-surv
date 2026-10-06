// Туман войны в 3D: полупрозрачная плоскость над землёй, прозрачность берётся из текстуры-маски разведанного.
// Маска размыта и плавно «догоняет» цель, а край рваный от шума — выглядит как облако, которое отступает.
import * as THREE from 'three';
import { G, N } from '../game/state.js';

const FOG_Y = .42;            // выше травинок и цветочков, ниже крон
let mesh = null, tex = null, data = null, target = null, ver = -1, tmp = null;

const VERT = `varying vec2 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FRAG = `precision highp float;
uniform sampler2D uMask; uniform float uN, uTime; uniform vec3 uA, uB;
varying vec2 vW;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y); }
float fbm(vec2 p) { float a = .5, s = 0.; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= .5; } return s; }
void main() {
  float m = texture2D(uMask, clamp(vW / uN, 0., 1.)).r;
  vec2 o = max(max(-vW, vW - uN), 0.);
  m *= 1. - smoothstep(0., 6., length(o));
  float n = fbm(vW * .32 + vec2(uTime * .035, uTime * .02));
  float a = 1. - smoothstep(.3, .7, m + (n - .5) * .5);
  if (a < .004) discard;
  float c = fbm(vW * .16 - vec2(uTime * .02, -uTime * .012) + 7.);
  vec3 col = mix(uA, uB, smoothstep(.25, .75, c));
  col = mix(col, uA, smoothstep(.0, .5, 1. - a) * .5);   // у границы светлее: белёсая дымка
  gl_FragColor = vec4(col, a);
}`;

function blur(src, dst) {   // box 3×3, края считаем «туманом»
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N) s += src[yy * N + xx]; }
    dst[y * N + x] = s / 9;
  }
}
function rebuildTarget() {
  const raw = new Float32Array(N * N), a = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) raw[i] = G.fog[i] ? 255 : 0;
  blur(raw, a); blur(a, tmp); blur(tmp, a);
  for (let i = 0; i < N * N; i++) target[i] = a[i];
}

export function initFogLayer(root) {
  data = new Uint8Array(N * N); target = new Float32Array(N * N); tmp = new Float32Array(N * N);
  tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  const g = new THREE.PlaneGeometry(600, 600); g.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    uniforms: { uMask: { value: tex }, uN: { value: N }, uTime: { value: 0 }, uA: { value: new THREE.Color('#f1f4f1') }, uB: { value: new THREE.Color('#d2dde0') } },
  });
  mesh = new THREE.Mesh(g, mat); mesh.position.set(N / 2, FOG_Y, N / 2); mesh.renderOrder = 2; mesh.frustumCulled = false;
  root.add(mesh);
}

// каждый кадр: подтянуть маску к цели (плавное открытие) и обновить время
export function updateFogLayer(t, dt, instant) {
  if (!mesh) return;
  mesh.visible = !!G.fog;
  if (!G.fog) return;
  if (ver !== G.fogVer) { ver = G.fogVer; rebuildTarget(); if (instant) for (let i = 0; i < N * N; i++) data[i] = target[i]; tex.needsUpdate = true; }
  const k = Math.min(1, dt * 2.5); let moved = false;
  for (let i = 0; i < N * N; i++) {
    const d = target[i] - data[i];
    if (d > .6 || d < -.6) { data[i] = Math.round(data[i] + d * k + (d > 0 ? .5 : -.5)); moved = true; }
    else if (d !== 0 && data[i] !== Math.round(target[i])) { data[i] = Math.round(target[i]); moved = true; }
  }
  if (moved) tex.needsUpdate = true;
  mesh.material.uniforms.uTime.value = t;
}
// при загрузке/старте сцены — показать маску сразу, без анимации
export const snapFogLayer = () => { ver = -1; };
