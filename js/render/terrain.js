// Земля: один меш на весь остров (цвет по клеткам), вода ниже суши, обрывчики по берегу.
import * as THREE from 'three';
import { G, N } from '../game/state.js';
import { T, inB } from '../game/world.js';
import { shade, hash2 } from '../core/util.js';
import { Builder, rgba, cone, blob, setSwap } from '../core/iso.js';
import { MAT, geoFrom } from './models.js';
import { cam, worldToScreen, viewTiles } from './camera.js';

const PAL = {
  [T.GRASS]: ['#93cc62', '#80bd55', '#b0b04e', '#e6eff2'],
  [T.DIRT]: ['#b98d5f', '#b58a5c', '#a9805a', '#c9bba8'],
  [T.SAND]: ['#ecd9a4', '#f1dca4', '#e4cb94', '#f0ebdf'],
  [T.WATER]: ['#5fb4cf', '#53a9c8', '#5a9cb6', '#9cc9da'],
  [T.STONE]: ['#a8aab0', '#a2a5ab', '#9a9ca2', '#d9dee3'],
  [T.FOREST]: ['#78b455', '#66a449', '#a38f42', '#d6e2e6'],
};
export const WATER_BG = '#4a9fbd';
export const WATER_Y = -0.11;
const COLORS = [];
function buildColors(season) {
  for (let t = 0; t < 6; t++) {
    COLORS[t] = [];
    for (let l = 0; l < 5; l++) {
      let f = (l - 2) * 0.022;
      if (t === T.WATER && l === 4) f = 0.1;
      COLORS[t][l] = rgba(shade(PAL[t][season], f));
    }
  }
}

// мелкие детали земли: травинки, цветочки, камешки (по G.det)
function addDetails(c, season) {
  const winter = season === 3;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, t = G.tiles[i], d = G.det[i];
    if (!d || t === T.WATER) continue;
    const base = PAL[t][season];
    if (t === T.GRASS || t === T.FOREST) {
      const dark = shade(base, winter ? -.1 : -.14), lite = shade(base, .12);
      for (let j = 0; j < 2 + d; j++) {
        const fx = .15 + hash2(x, y, 11 + j) * .7, fy = .15 + hash2(x, y, 31 + j) * .7, h = 6 + hash2(x, y, 51 + j) * 7;
        cone(c, x + fx, y + fy, 0, .022, h, j % 2 ? dark : lite);
      }
      if (d === 3 && !winter && t === T.GRASS) {
        const fc = ['#fff2b8', '#ffd6e0', '#e6e0ff'][season % 3];
        for (let j = 0; j < 2; j++) blob(c, x + .2 + hash2(x, y, 71 + j) * .6, y + .2 + hash2(x, y, 81 + j) * .6, 3.5, 1.9, 1.9, fc);
      }
    } else if (t === T.SAND) {
      for (let j = 0; j < 3; j++) blob(c, x + .15 + hash2(x, y, 91 + j) * .7, y + .15 + hash2(x, y, 101 + j) * .7, 1, 1.5, .9, shade(base, -.1));
    } else {
      for (let j = 0; j < 2; j++) blob(c, x + .15 + hash2(x, y, 111 + j) * .7, y + .15 + hash2(x, y, 121 + j) * .7, 1.6, 3.4, 2, shade(base, j ? .1 : -.12));
    }
  }
}

let group = null, cTiles = null, cSeason = -1, cVer = -1, sparkles = null;
export function updateTerrain(scene, season) {
  if (group && cTiles === G.tiles && cSeason === season && cVer === G.terrainVer) return;
  if (group) { scene.remove(group); group.traverse((o) => o.geometry?.dispose()); }
  buildColors(season);
  setSwap(false);
  const tc = new Builder(N, N, 0), b = tc.lit;
  const up = [0, 1, 0];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, t = G.tiles[i], water = t === T.WATER;
    const lv = water ? (G.shd[i] === 7 ? 4 : G.shd[i] % 3) : G.shd[i] % 5, col = COLORS[t][lv], h = water ? WATER_Y : 0;
    b.quad([x, h, y + 1], [x + 1, h, y + 1], [x + 1, h, y], [x, h, y], col);
    void up;
    if (!water) {
      const side = (nx, ny, p0, p1) => {
        if (inB(nx, ny) && G.tiles[ny * N + nx] !== T.WATER) return;
        const dark = rgba(shade(PAL[t][season], -.32));
        b.quad([p0[0], 0, p0[1]], [p1[0], 0, p1[1]], [p1[0], WATER_Y - .05, p1[1]], [p0[0], WATER_Y - .05, p0[1]], dark);
      };
      side(x, y + 1, [x, y + 1], [x + 1, y + 1]);   // +y
      side(x + 1, y, [x + 1, y + 1], [x + 1, y]);   // +x
      side(x, y - 1, [x + 1, y], [x, y]);           // -y
      side(x - 1, y, [x, y], [x, y + 1]);           // -x
    }
  }
  addDetails(tc, season);
  const m = new THREE.Mesh(geoFrom(b), MAT.lit); m.frustumCulled = false; m.receiveShadow = true;
  // бескрайнее море вокруг
  const wg = new THREE.PlaneGeometry(600, 600); wg.rotateX(-Math.PI / 2);
  const wm = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: WATER_BG })); wm.position.set(N / 2, WATER_Y - .02, N / 2);
  group = new THREE.Group(); group.add(wm, m); scene.add(group);
  cTiles = G.tiles; cSeason = season; cVer = G.terrainVer; sparkles = null;
}

// блики воды: рисуются поверх 3D чёрточками в экранных координатах
function buildSparkles() {
  sparkles = [];
  for (let y = -8; y < N + 8; y++) for (let x = -8; x < N + 8; x++) {
    if (inB(x, y) && G.tiles[y * N + x] !== T.WATER) continue;
    const h = hash2(x, y, 5); if (h > 0.45) continue;
    sparkles.push({ x: x + .5 + (h - .5) * .7, y: y + .5 + ((h * 7 % 6) - 3) / 8, ph: h * 40 });
  }
}
const LV = [0.1, 0.18, 0.26, 0.34];
export function drawSparkles(c, t) {
  if (!sparkles) buildSparkles();
  const v = viewTiles(1), k = cam.zoom;
  c.lineCap = 'round'; c.lineWidth = 1.6 * Math.max(.7, k);
  const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; let any = false;
  for (const s of sparkles) {
    if (s.x < v.x0 || s.x > v.x1 || s.y < v.y0 || s.y > v.y1) continue;
    const a = 0.18 + 0.2 * Math.sin(t * 1.3 + s.ph); if (a < 0.1) continue;
    const q = Math.min(3, Math.floor((a - 0.1) / 0.075)), [X, Y] = worldToScreen(s.x, s.y, WATER_Y * 39.19 + 1);
    paths[q].moveTo(X - 7 * k, Y); paths[q].lineTo(X + 6 * k, Y); any = true;
  }
  if (any) for (let q = 0; q < 4; q++) { c.strokeStyle = `rgba(255,255,255,${LV[q]})`; c.stroke(paths[q]); }
}
