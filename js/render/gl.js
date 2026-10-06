// WebGL-слой: рендерер three, ортографическая камера (синхронна с camera.js), освещение.
import * as THREE from 'three';
import { cam, EL } from './camera.js';
import { KX } from '../core/iso.js';
import { WATER_BG } from './terrain.js';

const HEMI = 2.35, SUN = 1.35;   // в three освещённость делится на π: ~3.4 суммарно даёт полный цвет сверху
export let renderer = null, scene = null, camera3 = null, hemi = null, sun = null;
const _dir = new THREE.Vector3();

export function initGL(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setClearColor(WATER_BG);
  renderer.shadowMap.enabled = false;
  scene = new THREE.Scene();
  camera3 = new THREE.OrthographicCamera(-10, 10, 10, -10, -300, 900);
  hemi = new THREE.HemisphereLight('#fff4de', '#cdc4a6', HEMI);
  sun = new THREE.DirectionalLight('#fff0d2', SUN);
  sun.position.set(-7, 11, 3);
  scene.add(hemi, sun, sun.target);
  resizeGL();
  return renderer;
}
export const setBg = (col) => renderer && renderer.setClearColor(col);
export function resizeGL() {
  if (!renderer) return;
  renderer.setPixelRatio(cam.dpr);
  renderer.setSize(cam.W, cam.H, false);
}
// камера three по состоянию cam
export function syncCamera() {
  const K = KX * cam.zoom, hw = cam.W / 2 / K, hh = cam.H / 2 / K;
  Object.assign(camera3, { left: -hw, right: hw, top: hh, bottom: -hh });
  camera3.updateProjectionMatrix();
  _dir.set(Math.cos(EL) * Math.sin(cam.az), Math.sin(EL), Math.cos(EL) * Math.cos(cam.az));
  camera3.position.set(cam.tx, 0, cam.ty).addScaledVector(_dir, 200);
  camera3.lookAt(cam.tx, 0, cam.ty);
  sun.target.position.set(cam.tx, 0, cam.ty);
  sun.position.set(cam.tx - 7, 11, cam.ty + 3);
}
// цвет и сила солнца по времени суток: тёплое на закате и рассвете (ночь затемняет оверлей освещения)
const tmp = new THREE.Color();
export function setSun(hour, dark, rain) {
  const dusk = Math.max(0, 1 - Math.abs(hour - 18.2) / 1.8), dawn = Math.max(0, 1 - Math.abs(hour - 6.3) / 1.6), warm = Math.max(dusk, dawn);
  sun.color.set('#fff0d2').lerp(tmp.set('#ffb070'), warm * .8);
  sun.intensity = SUN * (1 - dark * .5) * (rain ? .7 : 1);
  hemi.intensity = HEMI * (1 - dark * .2) * (rain ? .95 : 1);
  hemi.color.set('#fff4de').lerp(tmp.set('#f6b890'), warm * .5);
}
