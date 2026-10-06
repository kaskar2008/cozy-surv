// Ресурсные объекты мира: рисование и правила сбора.
import { shadow, blob, cyl, cone, line3, poly, P, plane, box, curve3, ribbon, glow } from '../core/iso.js';
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

function drawStump(c) { shadow(c, .5, .5, .22, .16); cyl(c, .5, .5, 0, .13, 7, '#8a6240', { top: '#c9a273' }); }
function drawSapling(c, season) { shadow(c, .5, .5, .12, .12); cyl(c, .5, .5, 0, .02, 10, '#8a6a45'); blob(c, .5, .5, 13, 8, 6, FOL.oak[season] || '#7bc35a'); }

function drawTree(c, n, o, kind) {
  if (n.st === 'stump') return drawStump(c);
  if (n.st === 'sapling') return drawSapling(c, o.season);
  const s = o.season, k = vv(n);
  shadow(c, .5, .5, .4, .22);
  if (kind === 'pine') {
    cyl(c, .5, .5, 0, .07, 14, '#6e4a30');
    const col = shade(FOL.pine[s], k);
    cone(c, .5, .5, 8, .36, 32, shade(col, -0.05));
    cone(c, .5, .5, 24, .30, 30, col);
    cone(c, .5, .5, 40, .22, 28, shade(col, 0.06));
    if (s === 3) { for (const [z, r] of [[34, 7], [50, 5.5], [64, 3.5]]) snowCap(c, 0, z, r, r * .55); }
    return;
  }
  const birch = kind === 'birch';
  cyl(c, .5, .5, 0, birch ? .06 : .08, birch ? 30 : 24, birch ? '#e8e2d4' : '#7b5535', birch ? { left: '#f4efe4', right: '#b9b2a0' } : {});
  if (birch) for (const z of [6, 12, 20]) blob(c, .56, .56, z, 2.6, 1.1, '#5a5248');
  if (s === 3) {
    const top = birch ? 30 : 24;
    for (const [dx, dy] of [[-16, -22], [14, -26], [-6, -34], [8, -14], [-20, -10], [0, -42]]) line3(c, [.5, .5, top], [.5 + dx / 64, .5 - dx / 64, top - dy], birch ? '#cfc6b4' : '#6e4c30', 2.4);
    for (const [dx, z] of [[-16, 40], [14, 44], [-6, 52], [0, 62]]) snowCap(c, dx, z - (birch ? 0 : 6), 6, 3);
    return;
  }
  const col = shade(FOL[kind === 'apple' ? 'apple' : kind][s], k);
  const z0 = birch ? 34 : 28, sc = birch ? .85 : 1;
  for (const [dx, z, rx, ry, kk] of [[-14, z0 + 2, 19, 15, -.08], [14, z0 + 3, 19, 15, -.12], [0, z0 + 14, 22, 17, .0], [-6, z0 + 22, 15, 12, .08], [7, z0 + 24, 14, 11, .1]]) {
    const [x, y] = ring(dx * sc); blob(c, x, y, z, rx * sc, ry * sc, shade(col, kk));
  }
  if (kind === 'apple' && n.fruit) {
    for (const [dx, dz] of [[-16, 26], [12, 28], [-2, 40], [18, 38], [-10, 44]]) blob(c, .52 + dx / 64, .52 - dx / 64, dz + 4, 3.4, 3.4, '#e04a3a');
  }
}

function drawBush(c, n, o) {
  const s = o.season;
  shadow(c, .5, .5, .3, .18);
  const col = shade(['#6fbd55', '#58a846', '#a89a3c', '#7fa88a'][s], vv(n));
  for (const [dx, z, rx, ry] of [[-9, 9, 13, 10], [9, 9, 13, 10], [0, 15, 14, 11]]) { const [x, y] = ring(dx); blob(c, x, y, z, rx, ry, col); }
  if (s === 3) snowCap(c, 0, 20, 12, 5);
  if (n.st === 'full' && s !== 3) {
    const bc = n.v % 2 ? '#4a5bd0' : '#d6384c';
    for (const [dx, dz] of [[-12, 8], [-2, 18], [10, 12], [14, 6], [-6, 4], [4, 6]]) blob(c, .54 + dx / 64, .54 - dx / 64, dz, 2.8, 2.8, bc);
  }
}
function drawRock(c, n, o, big) {
  shadow(c, .5, .5, big ? .46 : .26, .2);
  const g = '#a2a5ad';
  const parts = big ? [[-11, 8, 17, 12, 0], [10, 7, 15, 11, -.1], [0, 17, 17, 13, .1]] : [[-4, 5, 10, 7, 0], [6, 4, 8, 6, -.1]];
  for (const [dx, z, rx, ry, k] of parts) { const [x, y] = ring(dx); blob(c, x, y, z, rx, ry, shade(g, k + vv(n)), 'rock'); }
  if (big && o.season !== 3) { const [x, y] = ring(-6); blob(c, x, y, 24, 8, 3.5, '#7fae5a'); }
  if (o.season === 3) snowCap(c, big ? 0 : 0, big ? 26 : 10, big ? 12 : 6, big ? 5 : 3);
}
function drawFiber(c, n, o) {
  const col = ['#8fcf6a', '#78bd55', '#c2b556', '#bcd0c9'][o.season];
  if (n.st === 'empty') { const d = shade(col, -.2); for (const a of [0, 2.3, 4.4]) line3(c, [.5 + Math.cos(a) * .04, .5 + Math.sin(a) * .04, 0], [.5 + Math.cos(a) * .08, .5 + Math.sin(a) * .08, 5], d, 2); return; }
  for (let i = 0; i < 9; i++) {   // пучок: стебли расходятся веером во все стороны
    const a = i * 2.4 + n.v * .3, hh = 15 + ((n.v * 7 + i * 5) % 9), r0 = .05 + .04 * (i % 3), r1 = r0 + .1 + .06 * ((i * 5) % 3);
    line3(c, [.5 + Math.cos(a) * r0, .5 + Math.sin(a) * r0, 0], [.5 + Math.cos(a) * r1, .5 + Math.sin(a) * r1, hh], shade(col, ((i % 3) - 1) * .08), 2.6);
  }
}
function drawHerb(c, n, o) {
  shadow(c, .5, .5, .2, .12);
  const col = shade(['#5fbd6e', '#4fae62', '#a0a24a', '#9ab8a4'][o.season], vv(n));
  const full = n.st !== 'empty';
  for (const [dx, dy, r] of full ? [[-7, -4, 6], [6, -3, 6], [0, -9, 7], [-1, -2, 6]] : [[0, -2, 4]]) { const [gx, gy] = ring(dx); blob(c, gx, gy, -dy + 2, r, r * .75, col); }
  if (full && o.season < 3) for (const [dx, dy] of [[-4, -12], [5, -10], [0, -15]]) { const [gx, gy] = ring(dx); blob(c, gx + .02, gy + .02, -dy, 1.9, 1.9, '#b79ae0'); }
}
function drawMushroom(c, n) {
  shadow(c, .5, .5, .2, .14);
  for (const [dx, dy, r, col] of [[-6, 0, 6, '#d65a4a'], [5, 2, 5, '#e0a24a'], [0, -3, 7, '#c94f43']]) {
    const [gx, gy] = gp(dx, dy * .6);
    cyl(c, gx, gy, 0, 1.8 / 45.25 * 1.3, r * .9, '#efe6d2');
    blob(c, gx, gy, r * .9, r, r * .62, col);
    blob(c, gx + .025, gy + .025, r * 1.35, 1.3, 1, 'rgba(255,255,255,.85)');
  }
}
const FCOL = ['#f07aa8', '#f6d34a', '#ffffff', '#8aa8f0', '#f58a4a'];
function drawFlowers(c, n, o) {
  if (n.st === 'empty' || o.season === 3) { for (const dx of [-5, 0, 5]) { const [gx, gy] = gp(dx, 1); line3(c, [gx, gy, 0], [gx, gy, 6], '#6fae5a', 1.6); } return; }
  const col = FCOL[n.v % 5];
  for (const [dx, dy] of [[-10, 2], [-2, -3], [8, 1], [3, 6], [-7, 7], [13, -4]]) {
    const [gx, gy] = gp(dx, dy);
    line3(c, [gx, gy, 0], [gx, gy, 8], '#5da84e', 1.6);
    for (let i = 0; i < 5; i++) { const a = i * 1.2566; blob(c, gx + Math.cos(a) * 3 / 45.25, gy + Math.sin(a) * 3 / 45.25, 8.6, 2.2, 2.2, col); }
    blob(c, gx, gy, 9, 1.6, 1.6, '#f5c84a');
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
