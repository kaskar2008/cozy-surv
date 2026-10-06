// Ресурсные объекты мира: рисование и правила сбора.
import { shadow, blob, cyl, cone, line3, poly, P, plane, box, curve3, ribbon, glow, frustum, leaf } from '../core/iso.js';
import { shade } from '../core/util.js';

const FOL = {
  oak: ['#86c95f', '#5faa49', '#d98a34', '#dfe9ec'],
  birch: ['#a6d66e', '#7cc058', '#e4b73e', '#dfe9ec'],
  pine: ['#4f9a5b', '#3f8a50', '#4a8550', '#4f8a6a'],
  apple: ['#8bcb64', '#62ad4c', '#d28a3a', '#dfe9ec'],
};
// экранный сдвиг по горизонтали dx и вглубь dy (пиксели) -> клетка
const gp = (dx, dy = 0) => [.5 + dx / 64 + dy / 32, .5 - dx / 64 + dy / 32];
// Смещение dx (пиксели вдоль экранной оси) -> клетка. Группы деталей раскладываются по кругу, а не по линии:
// так они объёмны с любого угла камеры (иначе при повороте на 90° выстраиваются «ребром»)
const ring = (dx) => { const m = dx / 45.25, a = Math.abs(dx) * .9 + 1; return [.5 + m * Math.cos(a), .5 + m * Math.sin(a)]; };
const snowCap = (c, cx, z, rx, ry) => { const [x, y] = ring(cx); blob(c, x, y, z, rx, ry, '#f4f8fa', { lo: '#cfdde3' }); };
const vv = (n) => (Math.floor((n.v % 15) / 3) - 2) * 0.025;

// ── общие помощники ──
const hash = (a, b = 0) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
// точка на поверхности шара B {x, y, z, rx, ry} по азимуту a и возвышению e (чуть снаружи): сюда «приклеиваем» ягоды и яблоки
const surf = (B, a, e, k = 1.05) => { const R = B.rx / 45.25 * Math.cos(e) * k; return [B.x + Math.cos(a) * R, B.y + Math.sin(a) * R, B.z + Math.sin(e) * B.ry * k]; };
// шары кроны: spec — [смещение x, y в клетках, высота центра, радиус px]; поворот a0, коэффициент размера sc
const crown = (spec, a0, sc = 1) => spec.map(([ox, oy, z, r]) => { const [x, y] = rot2(ox * sc, oy * sc, a0); return { x: .5 + x, y: .5 + y, z, rx: r * sc, ry: r * sc * .88 }; });
const drawBlobs = (c, bl, col, tintAt) => bl.forEach((B, i) => blob(c, B.x, B.y, B.z, B.rx, B.ry, shade(col, tintAt(B, i))));

function drawStump(c) {
  shadow(c, .5, .5, .26, .16);
  for (let i = 0; i < 5; i++) { const a = i * 1.257 + .3; line3(c, [.5, .5, 7], [.5 + Math.cos(a) * .22, .5 + Math.sin(a) * .22, 0], '#7a5636', 5.5); }   // корни расходятся от пня
  cyl(c, .5, .5, 0, .14, 9, '#8a6240', { top: '#e0c08a' });
  cyl(c, .5, .5, 9.2, .09, .5, '#c9a06a');   // годовое кольцо на срезе
}
function drawSapling(c, season) {
  shadow(c, .5, .5, .14, .12); cyl(c, .5, .5, 0, .022, 12, '#8a6a45');
  const col = FOL.oak[season] || '#7bc35a';
  for (const [ox, oy, z, r] of [[0, 0, 15, 7.5], [.09, .05, 10, 5.5], [-.08, .06, 9, 5]]) blob(c, .5 + ox, .5 + oy, z, r, r * .85, shade(col, ox * .5));
}

function drawTree(c, n, o, kind) {
  if (n.st === 'stump') return drawStump(c);
  if (n.st === 'sapling') return drawSapling(c, o.season);
  const s = o.season, k = vv(n), m = Math.floor((n.v % 15) / 3), a0 = (n.v % 11) * .57;
  shadow(c, .5, .5, .42, .22);
  if (kind === 'pine') return drawPine(c, n, s, m);
  const birch = kind === 'birch', tall = m === 4, tH = tall ? 40 : birch ? 32 : 24;
  if (birch) {
    cyl(c, .5, .5, 0, .06, tH, '#e8e2d4');
    for (const z of [6, 13, 21, 28]) if (z < tH - 3) blob(c, .56, .56, z, 2.8, 1.1, '#5a5248');
  } else { cone(c, .5, .5, 0, .14, 10, '#7b5535'); cyl(c, .5, .5, 0, .085, tH, '#7b5535'); }
  if (s === 3) {   // голое дерево: ствол, развилки и снег в развилках
    const col = birch ? '#cfc6b4' : '#6e4c30';
    for (let i = 0; i < 4; i++) {
      const a = a0 + i * 1.57, b1 = [.5 + Math.cos(a) * .24, .5 + Math.sin(a) * .24, tH + 22];
      line3(c, [.5, .5, tH - 4], b1, col, 4);
      for (const d of [-.7, .7]) { const b2 = [b1[0] + Math.cos(a + d) * .22, b1[1] + Math.sin(a + d) * .22, tH + 40 + d * 6]; line3(c, b1, b2, col, 2.8); blob(c, b2[0], b2[1], b2[2], 3.2, 2, '#f4f8fa', { rough: 0 }); }
      blob(c, b1[0], b1[1], b1[2] + 1, 3.6, 2.2, '#f4f8fa', { rough: 0 });
    }
    return;
  }
  const col = shade(FOL[kind === 'apple' ? 'apple' : kind][s], k), z0 = tH - 4;
  const spec = tall ? [[.0, 0, z0 + 6, 24], [-.1, .06, z0 + 24, 20], [.1, -.06, z0 + 41, 17], [-.04, .03, z0 + 56, 12]]
    : [[-.2, .1, z0 + 8, 22], [.21, .06, z0 + 10, 21], [0, -.22, z0 + 11, 20], [-.02, .02, z0 + 27, 22], [.1, .12, z0 + 41, 13]];
  const bl = crown(spec, a0, birch ? .82 : 1);
  if (!tall) for (const B of bl.slice(0, 3)) line3(c, [.5, .5, tH - 3], [B.x, B.y, B.z - 8], birch ? '#cfc6b4' : '#7b5535', 3.4);   // ветви к нижним шарам
  drawBlobs(c, bl, col, (B, i) => (B.z - z0) / 70 * .2 - .07 + (hash(i, n.v) - .5) * .06);
  if (kind === 'apple' && n.fruit) bl.forEach((B, i) => { for (let j = 0; j < 3; j++) { const p = surf(B, hash(i * 3 + j, n.v) * 6.28, .1 + hash(i + j, n.v + 2) * .9); blob(c, p[0], p[1], p[2], 3.6, 3.6, '#e04a3a'); } });
}
// ёлка: ступенчатые шестигранные «этажи», как в low-poly наборах
function drawPine(c, n, s, m) {
  const col = shade(FOL.pine[s], vv(n)), tiers = m >= 3 ? 5 : 4, step = 62 / tiers;
  cyl(c, .5, .5, 0, .07, 12, '#6e4a30');
  for (let i = 0; i < tiers; i++) {
    const r0 = (.58 - i * (.42 / tiers)) * (1 - (m % 2) * .08), z = 8 + i * step;
    frustum(c, .5, .5, z, r0, r0 * .5, 27, shade(col, -.06 + i * .045), { n: 7, rot: i * .45 + m, top: s === 3 ? '#f2f6f8' : shade(col, .1 + i * .04) });
  }
  cone(c, .5, .5, 8 + (tiers - 1) * step + 25, .08, 15, shade(col, .12));
}

function drawBush(c, n, o) {
  const s = o.season, a0 = (n.v % 13) * .5;
  shadow(c, .5, .5, .34, .18);
  if (s === 3) {   // зимой — голые ветки со снегом
    for (let i = 0; i < 9; i++) {
      const a = i * .7 + a0, h = 15 + hash(i, n.v) * 11, b0 = [.5 + Math.cos(a) * .04, .5 + Math.sin(a) * .04], b1 = [.5 + Math.cos(a) * .17, .5 + Math.sin(a) * .17];
      line3(c, [b0[0], b0[1], 0], [b1[0], b1[1], h * .6], '#8a5a34', 2.6);
      for (const d of [-.5, .5]) { const t = [b1[0] + Math.cos(a + d) * .1, b1[1] + Math.sin(a + d) * .1, h]; line3(c, [b1[0], b1[1], h * .6], t, '#8a5a34', 1.8); if (i % 2) blob(c, t[0], t[1], t[2] + 1, 2.6, 1.8, '#f4f8fa', { rough: 0 }); }
    }
    return;
  }
  const col = shade(['#80cf5c', '#62b24b', '#b3a43c', '#86ad90'][s], vv(n));
  const bl = crown([[0, 0, 13, 15], [.17, 0, 10, 11.5], [-.1, .15, 9.5, 11], [-.1, -.15, 9.5, 10.5], [.02, 0, 22, 8.5]], a0);
  drawBlobs(c, bl, col, (B, i) => (B.z - 10) / 30 * .12 + .02 + (hash(i, n.v) - .5) * .05);
  if (n.st === 'full') {   // ягоды и цветы рассыпаны по поверхности шаров
    const v3 = n.v % 3, bc = v3 === 0 ? '#d6384c' : '#4a5bd0';
    bl.forEach((B, i) => {
      for (let j = 0; j < 3; j++) {
        const p = surf(B, hash(i * 7 + j, n.v) * 6.28, .12 + hash(i + j * 3, n.v + 1) * 1.05);
        if (v3 === 2) { blob(c, p[0], p[1], p[2], 3.4, 2.4, '#ffffff'); blob(c, p[0], p[1], p[2] + 1.6, 1.5, 1.2, '#f5c42a'); }
        else blob(c, p[0], p[1], p[2], 3.4, 3.4, bc);
      }
    });
  }
}
function drawRock(c, n, o, big) {
  shadow(c, .5, .5, big ? .48 : .28, .2);
  const g = '#a2a5ad', winter = o.season === 3;
  const parts = big ? [[-.2, .05, 8, 18, 13], [.2, .1, 7, 15, 11], [-.02, -.12, 17, 16, 13]] : [[-.08, 0, 5, 10, 7], [.12, .04, 4, 8, 6]];
  parts.forEach(([ox, oy, z, rx, ry], i) => blob(c, .5 + ox, .5 + oy, z, rx, ry, shade(g, i * .03 + vv(n)), { detail: 0, rough: .2 }));
  const top = parts[big ? 2 : 0];   // мох или снег на верхней грани
  blob(c, .5 + top[0], .5 + top[1], top[2] + top[4] * .78, top[3] * .72, top[4] * .36, winter ? '#f4f8fa' : '#7fae5a', { detail: 0, rough: .15 });
}
function drawFiber(c, n, o) {
  const col = ['#8fcf6a', '#78bd55', '#c2b556', '#bcd0c9'][o.season];
  if (n.st === 'empty') { const d = shade(col, -.2); for (let i = 0; i < 4; i++) leaf(c, .5, .5, 0, i * 1.6 + n.v, .13, .06, d, 6); return; }
  // розетка широких изогнутых листьев
  for (let i = 0; i < 9; i++) {
    const a = i * .7 + n.v * .3, len = .2 + hash(i, n.v) * .14;
    leaf(c, .5, .5, 0, a, len, .15, shade(col, ((i % 3) - 1) * .07), 12 + hash(i + 3, n.v) * 11);
  }
}
function drawHerb(c, n, o) {
  shadow(c, .5, .5, .2, .12);
  const col = shade(['#5fbd6e', '#4fae62', '#a0a24a', '#9ab8a4'][o.season], vv(n));
  const full = n.st !== 'empty';
  for (let i = 0; i < (full ? 6 : 3); i++) leaf(c, .5, .5, 0, i * 1.05 + n.v, .17 + hash(i, n.v) * .06, .1, shade(col, (i % 2) * .06), 9 + hash(i + 1, n.v) * 5);
  if (full && o.season < 3) for (let j = 0; j < 2; j++) {
    const a = n.v + j * 3.1, x = .5 + Math.cos(a) * .07, y = .5 + Math.sin(a) * .07;
    line3(c, [x, y, 0], [x, y, 20], '#5fae4c', 1.8);
    for (let t = 0; t < 4; t++) blob(c, x, y, 13 + t * 3.4, 2.5 - t * .35, 2.6 - t * .35, '#b79ae0', { rough: 0 });
  }
}
function drawMushroom(c, n) {
  shadow(c, .5, .5, .22, .14);
  const cols = ['#d65a4a', '#e8c24a', '#a8754a', '#f0ead8', '#c94f43'];
  for (let i = 0; i < 3; i++) {
    const a = i * 2.2 + n.v * .7, rr = .1 + hash(i, n.v) * .06, x = .5 + Math.cos(a) * rr, y = .5 + Math.sin(a) * rr;
    const r = 5.5 + hash(i + 2, n.v) * 3, sh = 6 + hash(i + 5, n.v) * 4, col = cols[(n.v + i * 2) % cols.length];
    cyl(c, x, y, 0, .04, sh, '#efe6d2');
    const B = { x, y, z: sh + r * .25, rx: r * 1.15, ry: r * .75 };
    blob(c, B.x, B.y, B.z, B.rx, B.ry, col, { rough: .05 });
    if (col === '#d65a4a' || col === '#c94f43') for (let j = 0; j < 3; j++) { const p = surf(B, j * 2.1 + i, .5 + hash(j, i) * .5, 1.02); blob(c, p[0], p[1], p[2], 1.4, 1.2, '#ffffff', { rough: 0 }); }
  }
}
const FCOL = ['#f07aa8', '#f6d34a', '#ffffff', '#8aa8f0', '#f58a4a'];
function drawFlowers(c, n, o) {
  const dry = n.st === 'empty' || o.season === 3;
  for (let i = 0; i < 4; i++) leaf(c, .5, .5, 0, i * 1.57 + n.v, .15, .07, dry ? '#a8a068' : '#6fbf5a', 7);
  if (dry) return;
  const col = FCOL[n.v % 5];
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + n.v * .4, x = .5 + Math.cos(a) * .12, y = .5 + Math.sin(a) * .12, h = 20 + hash(i, n.v) * 8;
    line3(c, [x, y, 0], [x, y, h], '#5da84e', 1.8);
    if ((n.v + i) % 3 === 0) { for (let t = 0; t < 5; t++) blob(c, x, y, h - 7 + t * 3.4, 3 - t * .4, 3 - t * .4, col, { rough: 0 }); }   // колосок вроде люпина
    else { for (let t = 0; t < 5; t++) { const b = t * 1.2566; blob(c, x + Math.cos(b) * 3.4 / 45.25, y + Math.sin(b) * 3.4 / 45.25, h, 2.4, 2, i % 2 ? '#ffffff' : col, { rough: 0 }); } blob(c, x, y, h + .8, 1.9, 1.7, '#f5c84a', { rough: 0 }); }
  }
}
function drawReeds(c, n, o) {
  const col = ['#7db860', '#6aa655', '#b5a455', '#b7c0a8'][o.season];
  const full = n.st !== 'empty';
  for (let i = 0; i < (full ? 8 : 3); i++) {   // стебли по кругу, чтобы пучок был виден с любой стороны
    const a = i * 2.4 + n.v, hh = (full ? 32 : 10) + ((n.v + i * 3) % 7) * 2, r0 = .1 + .075 * (i % 4) + .03 * ((n.v + i) % 3), r1 = r0 + .06;
    const bx = .5 + Math.cos(a) * r0, by = .5 + Math.sin(a) * r0, tx = .5 + Math.cos(a) * r1, ty = .5 + Math.sin(a) * r1;
    line3(c, [bx, by, 0], [tx, ty, hh], col, 2);
    if (full && i % 2 === 0) line3(c, [tx, ty, hh - 6], [tx, ty, hh + 1], '#8a5a34', 3.4);
  }
}
function drawClay(c, n) {
  const full = n.st !== 'empty';
  plane(c, 0, (g) => { g.fillStyle = full ? '#b9714a' : '#a98a6a'; g.beginPath(); g.ellipse(.5, .5, .36, .3, .4, 0, 7); g.fill(); g.fillStyle = full ? '#cf8860' : '#b99a7a'; g.beginPath(); g.ellipse(.44, .45, .2, .15, .4, 0, 7); g.fill(); });
  if (full) { blob(c, .42, .55, 4, 6, 4, '#c47c54'); blob(c, .6, .42, 4, 5, 3.5, '#b86f48'); }
}
function drawSticks(c, n) {
  shadow(c, .5, .5, .25, .1);
  line3(c, [.28, .55, 2], [.72, .4, 3], '#8a6440', 2.6); line3(c, [.3, .38, 2], [.7, .62, 3], '#7a5638', 2.6); line3(c, [.4, .3, 4], [.62, .7, 4], '#9a7248', 2.4);
}
function drawDrift(c) { shadow(c, .5, .5, .3, .1); cyl(c, .5, .5, 0, .08, 6, '#c9bfa8', { top: '#e2d9c4' }); line3(c, [.25, .7, 4], [.8, .35, 5], '#b8ae98', 5); line3(c, [.3, .3, 2], [.45, .5, 3], '#a99f8a', 3); }
function drawShell(c, n) { blob(c, .5, .5, 2, 5, 3.4, ['#f3c6c0', '#f0e0c8', '#d6c8f0'][n.v % 3]); }
function drawScrap(c, n) {
  shadow(c, .5, .5, .4, .2);
  box(c, .18, .3, 0, .42, .36, 11, '#8e6a54', { tex: 'planks' });
  box(c, .5, .5, 0, .34, .3, 7, '#7a8793');
  box(c, .3, .2, 11, .3, .3, 5, '#b4673a');
  cyl(c, .68, .3, 0, .13, 12, '#9a5a3a', { rings: [.3, .7] });
}

function drawSandpile(c, n) {
  if (n.st === 'empty') { plane(c, 0, (g) => { g.fillStyle = 'rgba(0,0,0,.05)'; g.beginPath(); g.ellipse(.5, .5, .2, .14, .4, 0, 7); g.fill(); }); return; }
  shadow(c, .5, .5, .3, .1); blob(c, .5, .5, 4, 15, 8, '#e8d49c', { lo: '#cdb87c' }); blob(c, .44, .44, 7, 8, 5, '#f2e2b0');
}
function drawPoop(c) {
  shadow(c, .5, .5, .18, .12);
  blob(c, .5, .5, 2, 7, 4.5, '#6b4527', { lo: '#4e311c' }); blob(c, .5, .5, 6, 5, 3.4, '#7a5030'); blob(c, .5, .5, 9.5, 3, 2.2, '#8a5d38');
  for (const dx of [-3, 3]) { const [gx, gy] = gp(dx); line3(c, [gx, gy, 14], [gx + .03, gy - .03, 20], 'rgba(190,200,120,.55)', 1.2); }   // «запах»
}
const give = (o) => o;
export const NDEF = {
  tree: { name: 'Дерево', block: true, h: 100, key: (n, o) => `${n.st}|${o.season}|${n.v % 15}`, draw: (c, n, o) => drawTree(c, n, o, ['oak', 'pine', 'birch'][n.v % 3]),
    gather: (n) => n.st === 'full' ? { verb: 'Рубить дерево', time: 4.5, tool: 'axe', fx: 'chop', give: give({ wood: [3, 4], sticks: [1, 2] }), after: 'stump' } : null },
  appletree: { name: 'Яблоня', block: true, h: 100, key: (n, o) => `${n.st}|${o.season}|${n.fruit ? 1 : 0}|${n.v % 15}`, draw: (c, n, o) => drawTree(c, n, o, 'apple'),
    gather: (n) => n.st !== 'full' ? null : n.fruit ? { verb: 'Собирать яблоки', time: 3, fx: 'pick', give: { apple: [3, 5] }, after: 'unfruit' } : { verb: 'Рубить яблоню', time: 5, tool: 'axe', fx: 'chop', give: { wood: [3, 4], sticks: [1, 2] }, after: 'stump' } },
  bush: { name: 'Ягодный куст', block: true, h: 50, key: (n, o) => `${n.st}|${o.season}|${n.v % 30}`, draw: drawBush,
    gather: (n) => n.st === 'full' ? { verb: 'Собирать ягоды', time: 2.2, fx: 'pick', give: { berries: [2, 4] }, after: 'empty', regrow: 360 } : null },
  rock: { name: 'Камни', block: false, h: 30, key: (n, o) => `${n.v % 15}|${o.season}`, draw: (c, n, o) => drawRock(c, n, o, false),
    gather: () => ({ verb: 'Подобрать камни', time: 1.6, fx: 'pick', give: { stone: [1, 2] }, after: 'remove' }) },
  boulder: { name: 'Валун', block: true, h: 60, key: (n, o) => `${n.v % 15}|${o.season}`, draw: (c, n, o) => drawRock(c, n, o, true),
    gather: () => ({ verb: 'Дробить валун', time: 5.5, tool: 'pickaxe', fx: 'chop', give: { stone: [4, 7] }, bonus: { scrap: [0.08, 1, 2], clay: [0.15, 1, 2] }, after: 'remove' }) },
  fibergrass: { name: 'Высокая трава', block: false, h: 40, ph: 24, key: (n, o) => `${n.st}|${n.v % 9}|${o.season}`, draw: drawFiber,
    gather: (n) => n.st === 'full' ? { verb: 'Рвать волокно', time: 1.4, fx: 'pick', give: { fiber: [1, 2] }, after: 'empty', regrow: 260 } : null },
  herb: { name: 'Мята и травы', block: false, h: 40, ph: 18, key: (n, o) => `${n.st}|${n.v % 15}|${o.season}`, draw: drawHerb,
    gather: (n) => n.st === 'full' ? { verb: 'Собирать травы', time: 1.4, fx: 'pick', give: { herbs: [1, 2] }, after: 'empty', regrow: 400 } : null },
  mushroom: { name: 'Грибы', block: false, h: 30, key: () => 'm', draw: drawMushroom,
    gather: () => ({ verb: 'Собирать грибы', time: 1.4, fx: 'pick', give: { mushroom: [1, 2] }, after: 'remove' }) },
  flowers: { name: 'Полевые цветы', block: false, h: 40, ph: 18, key: (n, o) => `${n.st}|${n.v % 5}|${o.season === 3 ? 1 : 0}`, draw: drawFlowers,
    gather: (n) => n.st === 'full' ? { verb: 'Собирать цветы', time: 1.5, fx: 'pick', give: { flowers: [1, 2] }, after: 'empty', regrow: 520 } : null },
  reeds: { name: 'Тростник', block: false, h: 56, ph: 30, key: (n, o) => `${n.st}|${n.v % 7}|${o.season}`, draw: drawReeds,
    gather: (n) => n.st === 'full' ? { verb: 'Срезать тростник', time: 2, fx: 'pick', give: { reeds: [2, 3] }, after: 'empty', regrow: 420 } : null },
  clay: { name: 'Глиняное месторождение', block: false, h: 24, key: (n) => n.st, draw: drawClay,
    gather: (n) => n.st === 'full' ? { verb: 'Копать глину', time: 3.2, fx: 'chop', give: { clay: [2, 4] }, after: 'empty', regrow: 700 } : null },
  sticks: { name: 'Хворост', block: false, h: 24, key: () => 's', draw: drawSticks,
    gather: () => ({ verb: 'Собирать хворост', time: 1.4, fx: 'pick', give: { sticks: [2, 3] }, after: 'remove' }) },
  driftwood: { name: 'Коряга', block: false, h: 24, key: () => 'd', draw: drawDrift,
    gather: () => ({ verb: 'Подобрать корягу', time: 2, fx: 'pick', give: { wood: [1, 2], sticks: [1, 1] }, after: 'remove' }) },
  shell: { name: 'Ракушка', block: false, h: 20, key: (n) => String(n.v % 3), draw: drawShell,
    gather: () => ({ verb: 'Подобрать ракушку', time: 1, fx: 'pick', give: { shell: [1, 1] }, after: 'remove' }) },
  sandpile: { name: 'Песчаная куча', block: false, h: 24, key: (n) => n.st, draw: drawSandpile,
    gather: (n) => n.st === 'full' ? { verb: 'Копать песок', time: 2.4, fx: 'chop', give: { sand: [2, 3] }, after: 'empty', regrow: 160 } : null },
  poop: { name: 'Какашки', block: false, h: 22, key: () => 'p', draw: drawPoop,
    gather: () => ({ verb: 'Убираю', time: 1.1, fx: 'pick', give: {}, after: 'remove' }) },
  scrap: { name: 'Старые обломки', block: true, h: 40, key: () => 'x', draw: drawScrap,
    gather: () => ({ verb: 'Разбирать обломки', time: 3.5, fx: 'chop', give: { scrap: [2, 4] }, bonus: { nails: [0.4, 1, 3], cloth: [0.25, 1, 1] }, after: 'remove' }) },
};
