// Контур объекта под курсором: модель рисуется плоским цветом в отдельный буфер (маска), затем шейдер обводит силуэт.
// Контур виден и там, где объект закрыт другими (как подсветка союзников/врагов сквозь стену) и лежит на отдельном холсте
// поверх 2D-оверлея, поэтому ночное затемнение его не гасит.
import * as THREE from 'three';
import { camera3 } from './gl.js';
import { cam } from './camera.js';
import { MAT } from './models.js';

const maskScene = new THREE.Scene(), holder = new THREE.Group();
maskScene.add(holder);
const maskMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
const partMesh = new WeakMap();
let renderer = null, dirty = false, rt = null, quad = null, quadScene = null, quadCam = null, cur = null;
const _clr = new THREE.Color();

const FRAG = `
uniform sampler2D mask; uniform vec2 px; uniform float r1, r2, t, k; uniform vec3 tint;
varying vec2 vUv;
float ring(float r) {
  float s = 0.0;
  for (int i = 0; i < 16; i++) { float a = float(i) * 0.3926991; s += texture2D(mask, vUv + vec2(cos(a), sin(a)) * r * px).r; }
  return s / 16.0;
}
void main() {
  float c = texture2D(mask, vUv).r;
  float core = clamp((ring(r1) + ring(r1 * 0.5)) * 1.2, 0.0, 1.0), halo = clamp((ring(r2) + ring(r2 * 0.6)) * 1.1, 0.0, 1.0);
  float pulse = 1.0 - k + k * sin(t * 5.0);
  float a = (1.0 - c) * core;                          // светлая кромка снаружи силуэта
  float h = (1.0 - c) * (1.0 - core) * halo * 0.7;     // тёмная кайма за ней — контраст и на песке, и ночью
  float f = c * 0.18;                                  // лёгкая заливка самого объекта
  vec3 col = mix(vec3(0.22, 0.13, 0.08), tint, clamp(a * 1.5, 0.0, 1.0));
  col = mix(col, tint, step(0.001, f) * (1.0 - a));
  gl_FragColor = vec4(col, (a * 0.98 + h + f) * pulse);
}`;

function init() {
  const cv = document.createElement('canvas'); cv.id = 'outline';
  document.getElementById('overlay').after(cv);
  renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { mask: { value: rt.texture }, px: { value: new THREE.Vector2() }, r1: { value: 1.5 }, r2: { value: 3.5 }, t: { value: 0 }, k: { value: .1 }, tint: { value: new THREE.Vector3() } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false,
  });
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  quadScene = new THREE.Scene(); quadScene.add(quad);
}

// Объекты для подсветки: [{ model, x, y, sy, sxz, px, pz, lift, sel }] — как у Instancer.add; sel — выбранный (золотой контур), иначе наведение
export function setOutline(list) { cur = list; }

function meshFor(p) {
  let m = partMesh.get(p);
  if (m) return m;
  let mat = maskMat;
  if (p.mat.map) { mat = new THREE.MeshBasicMaterial({ map: p.mat.map, alphaTest: .5, side: THREE.DoubleSide, depthTest: false, depthWrite: false }); }
  m = new THREE.Mesh(p.geo, mat); m.frustumCulled = false; partMesh.set(p, m);
  return m;
}
const HOVER = new THREE.Vector3(1, .96, .78), SEL = new THREE.Vector3(1, .84, .35);

export function renderOutline(t) {
  const n = cur ? cur.length : 0;
  if (!n && !dirty) return;
  if (!renderer) init();
  const cv = renderer.domElement;
  if (cv.width !== Math.floor(cam.W * cam.dpr) || cv.height !== Math.floor(cam.H * cam.dpr)) {
    renderer.setPixelRatio(cam.dpr); renderer.setSize(cam.W, cam.H, false); cv.style.width = cam.W + 'px'; cv.style.height = cam.H + 'px';
  }
  if (!n) { renderer.setRenderTarget(null); renderer.clear(); dirty = false; return; }
  dirty = true;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
  const u = quad.material.uniforms;
  u.px.value.set(1 / size.x, 1 / size.y); u.r1.value = 3.2 * cam.dpr; u.r2.value = 5.6 * cam.dpr; u.t.value = t;
  for (let i = 0; i < n; i++) {
    const e = cur[i];
    holder.clear();
    // плоские плашки на земле (пол палатки, грядка) входят в силуэт, только если у объекта нет объёмной части
    const solid = e.model.parts.some((p) => p.mat === MAT.lit || p.mat === MAT.emi);
    for (const p of e.model.parts) if (!p.shd && (p.mat === MAT.lit || p.mat === MAT.emi || p.mat === MAT.tr || (!solid && p.mat.map))) holder.add(meshFor(p));
    holder.position.set(e.x + e.px - e.px * e.sxz, e.lift || 0, e.y + e.pz - e.pz * e.sxz);
    holder.scale.set(e.sxz, e.sy, e.sxz); holder.updateMatrixWorld(true);
    u.tint.value.copy(e.sel ? SEL : HOVER); u.k.value = e.sel ? .2 : .1;
    renderer.autoClear = true;
    renderer.setRenderTarget(rt); renderer.render(maskScene, camera3);
    renderer.setRenderTarget(null);
    renderer.autoClear = i === 0; renderer.render(quadScene, quadCam);
  }
}
