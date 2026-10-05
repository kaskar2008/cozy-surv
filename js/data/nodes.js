// Ресурсные объекты мира: рисование и правила сбора.
import { shadow, blob, cyl, cone, line3, poly, P, plane, box } from '../core/iso.js';
import { shade } from '../core/util.js';

const FOL = {
  oak: ['#86c95f', '#5faa49', '#d98a34', '#dfe9ec'],
  birch: ['#a6d66e', '#7cc058', '#e4b73e', '#dfe9ec'],
  pine: ['#4f9a5b', '#3f8a50', '#4a8550', '#4f8a6a'],
  apple: ['#8bcb64', '#62ad4c', '#d28a3a', '#dfe9ec'],
};
const snowCap = (c, cx, z, rx, ry) => { c.save(); c.translate(cx, 0); blob(c, 0.5, 0.5, z, rx, ry, '#f4f8fa', { lo: '#cfdde3' }); c.restore(); };
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
  if (birch) { c.strokeStyle = '#5a5248'; c.lineWidth = 1.5; for (const z of [6, 12, 20]) { const [x, y] = P(.5, .5, z); c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x + 2, y + 1); c.stroke(); } }
  if (s === 3) {
    const [x, y] = P(.5, .5, birch ? 30 : 24);
    c.strokeStyle = birch ? '#cfc6b4' : '#6e4c30'; c.lineWidth = 2.2; c.lineCap = 'round';
    for (const [dx, dy] of [[-16, -22], [14, -26], [-6, -34], [8, -14], [-20, -10], [0, -42]]) { c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx, y + dy); c.stroke(); }
    for (const [dx, z] of [[-16, 40], [14, 44], [-6, 52], [0, 62]]) snowCap(c, dx, z - (birch ? 0 : 6), 6, 3);
    return;
  }
  const col = shade(FOL[kind === 'apple' ? 'apple' : kind][s], k);
  const z0 = birch ? 34 : 28, sc = birch ? .85 : 1;
  for (const [dx, z, rx, ry, kk] of [[-14, z0 + 2, 19, 15, -.08], [14, z0 + 3, 19, 15, -.12], [0, z0 + 14, 22, 17, .0], [-6, z0 + 22, 15, 12, .08], [7, z0 + 24, 14, 11, .1]]) {
    c.save(); c.translate(dx * sc, 0); blob(c, .5, .5, z, rx * sc, ry * sc, shade(col, kk)); c.restore();
  }
  if (kind === 'apple' && n.fruit) {
    c.fillStyle = '#e04a3a';
    for (const [dx, dz] of [[-16, 26], [12, 28], [-2, 40], [18, 38], [-10, 44]]) { const [x, y] = P(.5, .5, dz + 4); c.beginPath(); c.arc(x + dx, y, 3.2, 0, 7); c.fill(); }
  }
}

function drawBush(c, n, o) {
  const s = o.season;
  shadow(c, .5, .5, .3, .18);
  const col = shade(['#6fbd55', '#58a846', '#a89a3c', '#7fa88a'][s], vv(n));
  for (const [dx, z, rx, ry] of [[-9, 9, 13, 10], [9, 9, 13, 10], [0, 15, 14, 11]]) { c.save(); c.translate(dx, 0); blob(c, .5, .5, z, rx, ry, col); c.restore(); }
  if (s === 3) snowCap(c, 0, 20, 12, 5);
  if (n.st === 'full' && s !== 3) {
    const bc = n.v % 2 ? '#4a5bd0' : '#d6384c';
    c.fillStyle = bc;
    for (const [dx, dz] of [[-12, 8], [-2, 18], [10, 12], [14, 6], [-6, 4], [4, 6]]) { const [x, y] = P(.5, .5, dz); c.beginPath(); c.arc(x + dx, y, 2.6, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + dx - 1, y - 1.4, 1.2, 1.2); c.fillStyle = bc; }
  }
}
function drawRock(c, n, o, big) {
  shadow(c, .5, .5, big ? .46 : .26, .2);
  const g = '#a2a5ad';
  const parts = big ? [[-11, 8, 17, 12, 0], [10, 7, 15, 11, -.1], [0, 17, 17, 13, .1]] : [[-4, 5, 10, 7, 0], [6, 4, 8, 6, -.1]];
  for (const [dx, z, rx, ry, k] of parts) { c.save(); c.translate(dx, 0); blob(c, .5, .5, z, rx, ry, shade(g, k + vv(n))); c.restore(); }
  if (big && o.season !== 3) { c.save(); c.translate(-6, 0); blob(c, .5, .5, 24, 8, 3.5, '#7fae5a'); c.restore(); }
  if (o.season === 3) snowCap(c, big ? 0 : 0, big ? 26 : 10, big ? 12 : 6, big ? 5 : 3);
}
function drawFiber(c, n, o) {
  const col = ['#8fcf6a', '#78bd55', '#c2b556', '#bcd0c9'][o.season];
  if (n.st === 'empty') { c.strokeStyle = shade(col, -.2); c.lineWidth = 1.5; const [x, y] = P(.5, .5, 0); c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x - 4, y - 5); c.moveTo(x + 2, y); c.lineTo(x + 3, y - 4); c.stroke(); return; }
  c.lineCap = 'round'; c.lineWidth = 2;
  const [x, y] = P(.5, .5, 0);
  for (let i = 0; i < 9; i++) { const a = (i - 4) * 0.22, hh = 15 + ((n.v * 7 + i * 5) % 9); c.strokeStyle = shade(col, ((i % 3) - 1) * .08); c.beginPath(); c.moveTo(x + (i - 4) * 2.2, y); c.quadraticCurveTo(x + (i - 4) * 2.5 + a * 6, y - hh * .6, x + a * 22, y - hh); c.stroke(); }
}
function drawHerb(c, n, o) {
  shadow(c, .5, .5, .2, .12);
  const [x, y] = P(.5, .5, 0);
  const col = shade(['#5fbd6e', '#4fae62', '#a0a24a', '#9ab8a4'][o.season], vv(n));
  const full = n.st !== 'empty';
  for (const [dx, dy, r] of full ? [[-7, -4, 6], [6, -3, 6], [0, -9, 7], [-1, -2, 6]] : [[0, -2, 4]]) { c.fillStyle = col; c.beginPath(); c.ellipse(x + dx, y + dy, r, r * .65, 0, 0, 7); c.fill(); }
  if (full && o.season < 3) { c.fillStyle = '#b79ae0'; for (const [dx, dy] of [[-4, -12], [5, -10], [0, -15]]) { c.beginPath(); c.arc(x + dx, y + dy, 1.8, 0, 7); c.fill(); } }
}
function drawMushroom(c, n) {
  shadow(c, .5, .5, .2, .14);
  const [x, y] = P(.5, .5, 0);
  for (const [dx, dy, r, col] of [[-6, 0, 6, '#d65a4a'], [5, 2, 5, '#e0a24a'], [0, -3, 7, '#c94f43']]) {
    c.fillStyle = '#efe6d2'; c.fillRect(x + dx - 1.6, y + dy - r * .8, 3.2, r * .9);
    c.fillStyle = col; c.beginPath(); c.ellipse(x + dx, y + dy - r * .8, r, r * .62, 0, Math.PI, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(x + dx - r * .3, y + dy - r * 1.1, 1, 0, 7); c.arc(x + dx + r * .35, y + dy - r * .95, 1, 0, 7); c.fill();
  }
}
const FCOL = ['#f07aa8', '#f6d34a', '#ffffff', '#8aa8f0', '#f58a4a'];
function drawFlowers(c, n, o) {
  const [x, y] = P(.5, .5, 0);
  if (n.st === 'empty' || o.season === 3) { c.strokeStyle = '#6fae5a'; c.lineWidth = 1.4; c.beginPath(); for (const dx of [-5, 0, 5]) { c.moveTo(x + dx, y + 2); c.lineTo(x + dx, y - 5); } c.stroke(); return; }
  const col = FCOL[n.v % 5];
  for (const [dx, dy] of [[-10, 2], [-2, -3], [8, 1], [3, 6], [-7, 7], [13, -4]]) {
    c.strokeStyle = '#5da84e'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + dx, y + dy + 3); c.lineTo(x + dx, y + dy - 6); c.stroke();
    c.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.beginPath(); c.arc(x + dx + Math.cos(a) * 2.6, y + dy - 8 + Math.sin(a) * 2.6, 2, 0, 7); c.fill(); }
    c.fillStyle = '#f5c84a'; c.beginPath(); c.arc(x + dx, y + dy - 8, 1.6, 0, 7); c.fill();
  }
}
function drawReeds(c, n, o) {
  const [x, y] = P(.5, .5, 0);
  const col = ['#7db860', '#6aa655', '#b5a455', '#b7c0a8'][o.season];
  const full = n.st !== 'empty'; c.lineCap = 'round';
  for (let i = 0; i < (full ? 8 : 3); i++) {
    const dx = (i - 3.5) * 3.4, hh = (full ? 32 : 10) + ((n.v + i * 3) % 7) * 2;
    c.strokeStyle = col; c.lineWidth = 1.8; c.beginPath(); c.moveTo(x + dx, y + 2); c.quadraticCurveTo(x + dx + 1, y - hh * .6, x + dx + (i % 2 ? 3 : -3), y - hh); c.stroke();
    if (full && i % 2 === 0) { c.strokeStyle = '#8a5a34'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(x + dx + (i % 2 ? 3 : -3), y - hh); c.lineTo(x + dx + (i % 2 ? 3.4 : -3.4), y - hh + 7); c.stroke(); }
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
function drawShell(c, n) { const [x, y] = P(.5, .5, 0); c.fillStyle = ['#f3c6c0', '#f0e0c8', '#d6c8f0'][n.v % 3]; c.beginPath(); c.ellipse(x, y - 2, 5, 4, 0, Math.PI, 0); c.fill(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = .8; for (const dx of [-2.5, 0, 2.5]) { c.beginPath(); c.moveTo(x, y - 1); c.lineTo(x + dx, y - 6); c.stroke(); } }
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
  scrap: { name: 'Старые обломки', block: true, h: 40, key: () => 'x', draw: drawScrap,
    gather: () => ({ verb: 'Разбирать обломки', time: 3.5, fx: 'chop', give: { scrap: [2, 4] }, bonus: { nails: [0.4, 1, 3], cloth: [0.25, 1, 1] }, after: 'remove' }) },
};
