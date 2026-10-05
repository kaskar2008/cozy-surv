// Мебель и декор для интерьеров. Предметы на стене (wall:true) рисуются в плоскости стены (u — вдоль стены, v — вверх).
import { P, box, cyl, cone, blob, shadow, line3, poly, plane, wallRect, flame } from '../core/iso.js';
import { shade, hash2 } from '../core/util.js';
import { BDEF } from './buildings/registry.js';

export const FDEF = {};
export const FCATS = [
  { id: 'sleep', name: 'Сон', icon: '🛏️' }, { id: 'seat', name: 'Сидеть', icon: '🛋️' }, { id: 'table', name: 'Столы', icon: '🍽️' },
  { id: 'kitchen', name: 'Кухня', icon: '🍳' }, { id: 'heat', name: 'Тепло и свет', icon: '🔥' }, { id: 'store', name: 'Хранение', icon: '🗄️' },
  { id: 'hobby', name: 'Увлечения', icon: '🎸' }, { id: 'floor', name: 'Ковры и растения', icon: '🪴' }, { id: 'wall', name: 'На стену', icon: '🖼️' },
  { id: 'bath', name: 'Ванная', icon: '🛁' },
];
const F = (list) => { for (const d of list) { d.size = d.size || [1, 1]; d.cost = d.cost || {}; d.req = d.req || []; d.h = d.h || 40; d.cozy = d.cozy || 0; FDEF[d.id] = d; } };
const BLK = ['#d46a6a', '#6a9ad4', '#6ac48a', '#d4b24a', '#a37ad4'];
const WOOD = '#b98557', DARK = '#8a5a38';

const bookRow = (c, side, pos, u0, u1, z0, z1, seed) => {
  let u = u0, i = 0;
  while (u < u1 - .04) { const w = .06 + hash2(seed, i, 3) * .05; wallRect(c, side, pos, u, Math.min(u1, u + w), z0, z1 - hash2(seed, i, 4) * 4, ['#c9584a', '#4a7ac9', '#5aa86a', '#d9b24a', '#8a5ac9', '#e8e0d0'][Math.floor(hash2(seed, i, 5) * 6)]); u += w + .008; i++; }
};
const skyColor = (o) => {
  const h = o.hour;
  if (h > 20 || h < 5) return ['#10183a', '#1d2a5a'];
  if (h < 7) return ['#f4a67a', '#7ab0e0'];
  if (h > 18) return ['#f0905a', '#6a7ac0'];
  return o.rain ? ['#9aa8b8', '#b8c4d0'] : ['#74b8ea', '#bfe6fa'];
};
function windowArt(c, x0, x1, v0, v1, o, seed) {
  const [a, b] = skyColor(o), g = c.createLinearGradient(0, -v1, 0, -v0);
  g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(x0, -v1, x1 - x0, v1 - v0);
  if (o.hour > 20 || o.hour < 5) { c.fillStyle = '#fff6c0'; for (let i = 0; i < 6; i++) c.fillRect(x0 + 3 + hash2(seed, i, 1) * (x1 - x0 - 6), -v1 + 3 + hash2(seed, i, 2) * (v1 - v0 - 12), 1.6, 1.6); c.beginPath(); c.arc(x1 - 7, -v1 + 8, 3.4, 0, 7); c.fill(); }
  else if (!o.rain) { c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(x0 + 8, -v1 + 8, 6, 2.6, 0, 0, 7); c.ellipse(x0 + 13, -v1 + 6.4, 4, 2.2, 0, 0, 7); c.fill(); }
  else { c.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 6; i++) { const x = x0 + 3 + hash2(seed, i, 3) * (x1 - x0 - 6); c.beginPath(); c.moveTo(x, -v1 + 3 + i * 4); c.lineTo(x - 2, -v1 + 8 + i * 4); c.stroke(); } }
  c.fillStyle = 'rgba(80,140,70,.6)'; c.fillRect(x0, -v0 - 5, x1 - x0, 5);
}
function art(c, x, y, w, h, seed) {
  const k = seed % 6;
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  const gr = c.createLinearGradient(0, y, 0, y + h);
  if (k === 0) { gr.addColorStop(0, '#f6b26a'); gr.addColorStop(1, '#f4e0a0'); c.fillStyle = gr; c.fillRect(x, y, w, h); c.fillStyle = '#6a8a9a'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w * .35, y + h * .4); c.lineTo(x + w * .6, y + h); c.fill(); c.fillStyle = '#4a6a7a'; c.beginPath(); c.moveTo(x + w * .4, y + h); c.lineTo(x + w * .72, y + h * .5); c.lineTo(x + w, y + h); c.fill(); c.fillStyle = '#fff2b8'; c.beginPath(); c.arc(x + w * .75, y + h * .28, w * .1, 0, 7); c.fill(); }
  else if (k === 1) { c.fillStyle = '#e8f0d8'; c.fillRect(x, y, w, h); for (let i = 0; i < 5; i++) { c.strokeStyle = '#5aa86a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + w * (.15 + i * .17), y + h); c.lineTo(x + w * (.15 + i * .17), y + h * (.4 + (i % 2) * .15)); c.stroke(); c.fillStyle = ['#e85a7a', '#f5d34a', '#8a7ae8', '#f58a4a', '#e85a7a'][i]; c.beginPath(); c.arc(x + w * (.15 + i * .17), y + h * (.38 + (i % 2) * .15), w * .07, 0, 7); c.fill(); } }
  else if (k === 2) { gr.addColorStop(0, '#9ad4f0'); gr.addColorStop(1, '#4a90b8'); c.fillStyle = gr; c.fillRect(x, y, w, h); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x + w * .45, y + h * .65); c.lineTo(x + w * .45, y + h * .22); c.lineTo(x + w * .72, y + h * .62); c.fill(); c.fillStyle = '#8a5a38'; c.fillRect(x + w * .3, y + h * .65, w * .45, h * .1); }
  else if (k === 3) { c.fillStyle = '#1d2a5a'; c.fillRect(x, y, w, h); c.fillStyle = '#fff6c0'; c.beginPath(); c.arc(x + w * .65, y + h * .35, w * .16, 0, 7); c.fill(); c.fillStyle = '#1d2a5a'; c.beginPath(); c.arc(x + w * .72, y + h * .3, w * .14, 0, 7); c.fill(); c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) c.fillRect(x + w * hash2(seed, i, 9), y + h * hash2(seed, i, 8) * .6, 1.4, 1.4); }
  else if (k === 4) { c.fillStyle = '#f3e6c8'; c.fillRect(x, y, w, h); c.fillStyle = '#c9735a'; c.beginPath(); c.arc(x + w * .5, y + h * .5, w * .28, 0, 7); c.fill(); c.fillStyle = '#e8b86a'; c.beginPath(); c.arc(x + w * .5, y + h * .5, w * .16, 0, 7); c.fill(); }
  else { gr.addColorStop(0, '#b8e0f0'); gr.addColorStop(.6, '#e8f4f8'); gr.addColorStop(.6, '#7ab05a'); gr.addColorStop(1, '#5a9040'); c.fillStyle = gr; c.fillRect(x, y, w, h); c.fillStyle = '#d9402a'; c.fillRect(x + w * .3, y + h * .5, w * .2, h * .16); c.fillStyle = '#8a4a2a'; c.beginPath(); c.moveTo(x + w * .28, y + h * .5); c.lineTo(x + w * .4, y + h * .34); c.lineTo(x + w * .52, y + h * .5); c.fill(); }
  c.restore();
}
const framed = (c, x, y, w, h, seed, frame = '#7b5535') => { c.fillStyle = frame; c.fillRect(x - 2.5, y - 2.5, w + 5, h + 5); art(c, x, y, w, h, seed); };

F([
  // ---------- сон ----------
  { id: 'bedroll', name: 'Спальник', cat: 'sleep', icon: '🛌', size: [1, 2], cost: { fiber: 10 }, h: 12, cozy: 1, sleep: { q: .85 }, flat: true, walk: true,
    desc: 'Простой мягкий спальник на полу. Лучше, чем ничего.',
    draw(c, it) { plane(c, 0, (g) => { g.fillStyle = shade('#c98a5a', 0); g.beginPath(); g.roundRect(.1, .1, .8, 1.8, .18); g.fill(); g.fillStyle = '#e8c98a'; g.beginPath(); g.roundRect(.14, .62, .72, 1.24, .14); g.fill(); g.fillStyle = '#f6ecd8'; g.beginPath(); g.roundRect(.22, .16, .56, .36, .1); g.fill(); }); } },
  { id: 'bed', name: 'Кровать', cat: 'sleep', icon: '🛏️', size: [1, 2], cost: { planks: 6, cloth: 4, feather: 3 }, h: 44, cozy: 4, sleep: { q: 1.4 },
    desc: 'Настоящая кровать с подушкой: сон быстрее восстанавливает силы. Рядом с тумбочкой и лампой — «Спальный уголок».',
    draw(c, it) { const col = BLK[it.v % 5]; shadow(c, .5, 1, .8, .18); box(c, .04, 0, 0, .92, 2, 9, DARK, { tex: 'planks' }); box(c, .08, .08, 9, .84, 1.84, 6, '#f0e6d2'); box(c, .06, .78, 9, .88, 1.16, 8, col); box(c, .18, .14, 15, .64, .42, 5, '#fbf4e6'); box(c, .02, -.02, 0, .96, .1, 32, '#7a4a2a', { tex: 'planks' }); } },
  { id: 'double_bed', name: 'Двуспальная кровать', cat: 'sleep', icon: '🛏️', size: [2, 2], cost: { planks: 12, cloth: 8, feather: 8, nails: 4 }, req: ['bed'], h: 50, cozy: 7, sleep: { q: 1.8 },
    desc: 'Огромная уютная кровать с двумя подушками и пуховым одеялом. Лучший сон на острове.',
    draw(c, it) { const col = BLK[(it.v + 2) % 5]; shadow(c, 1, 1, 1.2, .18); box(c, .03, .02, 0, 1.94, 1.96, 9, DARK, { tex: 'planks' }); box(c, .1, .1, 9, 1.8, 1.8, 7, '#f0e6d2'); box(c, .08, .8, 9, 1.84, 1.1, 9, col); box(c, .2, .15, 16, .7, .4, 6, '#fbf4e6'); box(c, 1.1, .15, 16, .7, .4, 6, '#fbf4e6'); box(c, .02, -.02, 0, 1.96, .1, 36, '#7a4a2a', { tex: 'planks' }); } },
  { id: 'nightstand', name: 'Тумбочка', cat: 'sleep', icon: '🗄️', cost: { planks: 3 }, h: 24, cozy: 1,
    desc: 'Маленькая тумбочка у кровати.',
    draw(c) { shadow(c, .5, .5, .4, .14); box(c, .15, .15, 0, .7, .7, 20, WOOD, { tex: 'planks' }); wallRect(c, 'L', .85, .3, .7, 8, 13, DARK); const [x, y] = P(.5, .85, 11); c.fillStyle = '#e8d9a0'; c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.fill(); } },
  // ---------- сидеть ----------
  { id: 'stool', name: 'Табурет', cat: 'seat', icon: '🪑', cost: { wood: 2 }, h: 24, cozy: 0, sit: { mood: 4, dur: 8 },
    desc: 'Простой табурет.', draw(c) { shadow(c, .5, .5, .26, .14); for (const [x, y] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7]]) box(c, x - .04, y - .04, 0, .08, .08, 13, '#8a6440'); cyl(c, .5, .5, 13, .26, 4, '#c08a58', { top: '#d9a56a' }); } },
  { id: 'chair', name: 'Стул', cat: 'seat', icon: '🪑', cost: { planks: 3 }, h: 40, cozy: 1, sit: { mood: 5, dur: 10 }, seat: true,
    desc: 'Деревянный стул. Стулья у стола образуют «Обеденную зону».',
    draw(c) { shadow(c, .5, .5, .3, .14); for (const [x, y] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) box(c, x - .04, y - .04, 0, .08, .08, 14, '#8a6440'); box(c, .2, .2, 14, .6, .6, 4, '#c08a58', { tex: 'planks' }); box(c, .2, .16, 18, .6, .07, 20, '#b27c4c'); } },
  { id: 'armchair', name: 'Кресло', cat: 'seat', icon: '🛋️', cost: { planks: 4, cloth: 5, feather: 2 }, h: 46, cozy: 4, sit: { mood: 11, dur: 14 }, seat: true,
    desc: 'Глубокое мягкое кресло. Рядом с камином и ковром — «У камина».',
    draw(c, it) { const col = BLK[(it.v + 1) % 5]; shadow(c, .5, .5, .5, .16); box(c, .06, .06, 0, .88, .88, 14, shade(col, -.1)); box(c, .14, .2, 14, .72, .7, 6, col, { top: shade(col, .15) }); box(c, .06, .06, 14, .88, .2, 26, shade(col, -.05)); box(c, .06, .06, 14, .12, .88, 14, shade(col, -.12)); box(c, .82, .06, 14, .12, .88, 14, shade(col, -.2)); } },
  { id: 'sofa', name: 'Диван', cat: 'seat', icon: '🛋️', size: [2, 1], cost: { planks: 6, cloth: 10, feather: 4 }, h: 46, cozy: 6, sit: { mood: 13, dur: 16 }, seat: true,
    desc: 'Уютный диван на двоих. Отлично для вечера с книгой.',
    draw(c, it) { const col = BLK[(it.v + 3) % 5]; shadow(c, 1, .5, .9, .16); box(c, .04, .06, 0, 1.92, .88, 14, shade(col, -.12)); box(c, .14, .22, 14, .88, .7, 6, col, { top: shade(col, .15) }); box(c, 1.0, .22, 14, .88, .7, 6, col, { top: shade(col, .15) }); box(c, .04, .06, 14, 1.92, .2, 26, shade(col, -.05)); box(c, .04, .06, 14, .14, .88, 16, shade(col, -.15)); box(c, 1.82, .06, 14, .14, .88, 16, shade(col, -.22)); } },
  { id: 'rocking_chair', name: 'Кресло-качалка', cat: 'seat', icon: '🪑', cost: { planks: 6, rope: 2 }, h: 50, cozy: 4, sit: { mood: 12, dur: 16 }, seat: true,
    desc: 'Тихо поскрипывает. Для самых неспешных вечеров.',
    draw(c) { shadow(c, .5, .5, .4, .14); line3(c, [.2, .15, 3], [.2, .85, 3], '#8a6440', 3); line3(c, [.8, .15, 3], [.8, .85, 3], '#8a6440', 3); box(c, .2, .2, 12, .6, .6, 4, '#c08a58', { tex: 'planks' }); box(c, .2, .17, 16, .6, .07, 24, '#b27c4c'); for (const x of [.25, .75]) { line3(c, [x, .25, 12], [x, .2, 4], '#7b5535', 2); line3(c, [x, .75, 12], [x, .8, 4], '#7b5535', 2); } } },
  // ---------- столы ----------
  { id: 'table', name: 'Обеденный стол', cat: 'table', icon: '🍽️', size: [2, 1], cost: { planks: 6 }, h: 34, cozy: 2, dining: true,
    desc: 'Большой стол. Поешь за ним со стулом рядом — настроение выше.',
    draw(c, it) { shadow(c, 1, .5, .9, .16); for (const [x, y] of [[.12, .15], [1.76, .15], [.12, .8], [1.76, .8]]) box(c, x, y, 0, .1, .1, 20, '#7b5535'); box(c, 0, .05, 20, 2, .9, 4, '#c9915f', { tex: 'planks' }); cyl(c, .7, .5, 24, .15, 2, '#e8e0d0', { top: '#f6f0e4' }); cyl(c, 1.4, .5, 24, .08, 8, '#8fb8d0', { top: '#bfe0f0' }); if (it.v % 2) blob(c, 1.4, .5, 36, 5, 5, ['#f08ac0', '#f5d34a'][it.v % 3 % 2]); } },
  { id: 'round_table', name: 'Столик', cat: 'table', icon: '☕', cost: { planks: 3 }, h: 30, cozy: 1, dining: true,
    desc: 'Небольшой круглый столик.', draw(c) { shadow(c, .5, .5, .4, .14); cyl(c, .5, .5, 0, .06, 18, '#7b5535'); cyl(c, .5, .5, 18, .38, 4, '#c9915f', { top: '#dba86f' }); cyl(c, .45, .5, 22, .08, 6, '#e8e0d0'); } },
  { id: 'desk', name: 'Письменный стол', cat: 'table', icon: '📝', size: [2, 1], cost: { planks: 6, nails: 2 }, req: ['table'], h: 40, cozy: 3, diary: true,
    desc: 'Здесь можно записать мысли в дневник — на душе становится светлее.',
    draw(c) { shadow(c, 1, .5, .9, .16); for (const [x, y] of [[.1, .15], [1.8, .15], [.1, .8], [1.8, .8]]) box(c, x, y, 0, .1, .1, 22, '#6e4a30'); box(c, 0, .05, 22, 2, .9, 4, '#a9774a', { tex: 'planks' }); box(c, .2, .2, 26, .5, .4, 1.5, '#f6f0e0'); line3(c, [.6, .55, 28], [.8, .7, 34], '#8a8f96', 1.2); box(c, 1.4, .15, 26, .4, .3, 7, '#4a7ac9'); } },
  // ---------- кухня ----------
  { id: 'counter', name: 'Кухонный стол', cat: 'kitchen', icon: '🔪', cost: { planks: 4 }, h: 34, cozy: 1, counter: true,
    desc: 'Рабочая поверхность. Вместе с плитой и раковиной — «Кухня».',
    draw(c) { shadow(c, .5, .5, .42, .14); box(c, .05, .1, 0, .9, .8, 22, '#d8c9b0', { tex: 'planks', texA: .06 }); box(c, .02, .06, 22, .96, .88, 3, '#8a8f96'); wallRect(c, 'L', .9, .15, .85, 5, 14, '#c6b79c'); } },
  { id: 'stove', name: 'Плита', cat: 'kitchen', icon: '🍳', cost: { bricks: 8, scrap: 4 }, req: ['chimney'], needs: ['chimney'], h: 70, cozy: 3, station: 'stove', counter: true,
    desc: 'Дровяная плита: омлеты, блины, салаты, варенье, рагу. Нужен дымоход снаружи. Вода — из раковины дома или из ведра.',
    draw(c) { shadow(c, .5, .5, .44, .16); box(c, .08, .08, 0, .84, .84, 24, '#4a4d54'); wallRect(c, 'L', .92, .2, .8, 4, 18, '#2a2c33', '#1a1b1f'); for (const [x, y] of [[.3, .3], [.7, .3], [.3, .7], [.7, .7]]) { const [X, Y] = P(x, y, 24.5); c.fillStyle = '#1e2024'; c.beginPath(); c.ellipse(X, Y, 6, 3, 0, 0, 7); c.fill(); } box(c, .38, .1, 24, .16, .16, 40, '#6b6f78'); },
    anim(c, it, t) { if (it.st.cur) { flame(c, .3, .3, 25, 3, t, 1); const [X, Y] = P(.46, .18, 66); c.fillStyle = 'rgba(210,210,210,.5)'; for (let i = 0; i < 3; i++) { const k = (t * .5 + i / 3) % 1; c.globalAlpha = (1 - k) * .6; c.beginPath(); c.arc(X + k * 5, Y - k * 20, 3 + k * 4, 0, 7); c.fill(); } c.globalAlpha = 1; } } },
  { id: 'sink', name: 'Раковина', cat: 'kitchen', icon: '🚰', cost: { planks: 4, scrap: 4 }, h: 50, cozy: 2, counter: true, needs: ['water'], sink: true,
    desc: 'Если к дому подведена вода (бак или труба вплотную), из крана идёт вода: можно набрать ведро и готовить без беготни к баку.',
    draw(c) { shadow(c, .5, .5, .42, .14); box(c, .05, .1, 0, .9, .8, 22, '#d8c9b0', { tex: 'planks', texA: .06 }); box(c, .02, .06, 22, .96, .88, 3, '#aab4bd'); plane(c, 25, (g) => { g.fillStyle = '#6a7a86'; g.beginPath(); g.roundRect(.25, .3, .5, .4, .06); g.fill(); }); cyl(c, .5, .2, 25, .03, 12, '#c9ccd2'); line3(c, [.5, .2, 37], [.5, .35, 36], '#c9ccd2', 2); } },
  { id: 'fridge', name: 'Холодильник', cat: 'kitchen', icon: '🧊', cost: { scrap: 12, glass: 2, planks: 2 }, req: ['sink'], needs: ['power'], h: 74, cozy: 3, cap: { food: 30, meal: 14, _power: 1 },
    desc: 'Когда дом подключён к электричеству — вмещает много еды. Нужны провода от солнечной панели.',
    draw(c) { shadow(c, .5, .5, .4, .16); box(c, .1, .1, 0, .8, .8, 66, '#e8eef2'); wallRect(c, 'L', .9, .15, .85, 40, 42, '#aab4bd'); wallRect(c, 'L', .9, .78, .82, 44, 58, '#8a9098'); wallRect(c, 'L', .9, .78, .82, 8, 30, '#8a9098'); } },
  // ---------- тепло и свет ----------
  { id: 'fireplace', name: 'Камин', cat: 'heat', icon: '🔥', size: [2, 1], cost: { stone: 20, bricks: 10 }, req: ['chimney'], needs: ['chimney'], against: true, h: 80, cozy: 8, burner: { max: 500, fuels: { sticks: 70, wood: 200, charcoal: 380 } }, heat: true, light: { r: 4.4, col: '#ffa850', on: 'lit', flick: 1 },
    desc: 'Живой огонь в доме! Греет комнату и поднимает настроение. Нужен дымоход снаружи. Ставится у стены.',
    draw(c, it) { shadow(c, 1, .5, .9, .14); box(c, 0, 0, 0, 2, .7, 56, '#a8a9b0', { tex: 'brick' }); box(c, -.06, -.04, 56, 2.12, .8, 6, '#7a4a2a'); wallRect(c, 'L', .7, .45, 1.55, 0, 30, '#1e1612', '#6e4a30'); line3(c, [.7, .45, 3], [1.3, .45, 3], '#6d4a2e', 4); line3(c, [.75, .5, 3], [1.35, .4, 3], '#85603c', 4); },
    anim(c, it, t) { if (it.st.lit && it.st.fuel > 0) { flame(c, 1.0, .5, 4, 9, t, 2); flame(c, .8, .5, 4, 6, t, 5); } } },
  { id: 'wood_stove', name: 'Печка-буржуйка', cat: 'heat', icon: '♨️', cost: { scrap: 10, bricks: 4 }, req: ['chimney'], needs: ['chimney'], h: 70, cozy: 4, burner: { max: 420, fuels: { sticks: 70, wood: 200, charcoal: 380 } }, heat: true, light: { r: 3.2, col: '#ff9a50', on: 'lit', flick: .7 },
    desc: 'Чугунная печка: быстро греет маленькую комнату. Нужен дымоход.',
    draw(c) { shadow(c, .5, .5, .34, .16); cyl(c, .5, .5, 0, .3, 34, '#3c3f45', { rings: [.3], ringCol: '#1e2024', top: '#2a2c33' }); box(c, .42, .1, 34, .16, .16, 30, '#6b6f78'); wallRect(c, 'L', .8, .35, .65, 8, 22, '#ffb050'); },
    anim(c, it, t) { if (it.st.lit && it.st.fuel > 0) { const [x, y] = P(.5, .8, 15); c.fillStyle = `rgba(255,170,60,${.7 + .2 * Math.sin(t * 8)})`; c.fillRect(x - 5, y - 6, 10, 10); } } },
  { id: 'oil_lamp', name: 'Лампа со свечой', cat: 'heat', icon: '🕯️', cost: { glass: 1, wax: 1, sticks: 2 }, req: [], h: 50, cozy: 2, light: { r: 2.8, col: '#ffbf66', on: 'always', flick: 1 },
    desc: 'Тёплая свечная лампа. Без проводов.',
    draw(c) { shadow(c, .5, .5, .2, .14); cyl(c, .5, .5, 0, .04, 24, '#5a4a3a'); cyl(c, .5, .5, 24, .12, 3, '#6b6f78'); box(c, .4, .4, 27, .2, .2, 14, '#d8eef6', { top: '#fff', left: 'rgba(210,235,245,.85)', right: 'rgba(160,200,220,.85)' }); },
    anim(c, it, t) { flame(c, .5, .5, 29, 3, t, it.v); } },
  { id: 'floor_lamp', name: 'Торшер', cat: 'heat', icon: '💡', cost: { scrap: 3, cloth: 1, glass: 1 }, req: ['sink'], needs: ['power'], h: 80, cozy: 3, light: { r: 4, col: '#ffe2a0', on: 'power' },
    desc: 'Мягкий электрический свет. Нужно подключение дома к проводам.',
    draw(c, it) { shadow(c, .5, .5, .24, .14); cyl(c, .5, .5, 0, .12, 4, '#3c4048'); cyl(c, .5, .5, 4, .03, 52, '#3c4048'); cone(c, .5, .5, 48, .26, 22, '#f2e0b8'); },
    anim(c, it, t, o) { if (it.on) { const [x, y] = P(.5, .5, 52); c.fillStyle = 'rgba(255,230,150,.55)'; c.beginPath(); c.ellipse(x, y, 11, 5, 0, 0, 7); c.fill(); } } },
  // ---------- хранение ----------
  { id: 'chest', name: 'Сундук', cat: 'store', icon: '🧰', cost: { wood: 8, nails: 2 }, h: 30, cozy: 1, cap: { mat: 30 },
    desc: 'Вместительный сундук: +30 места для материалов.',
    draw(c) { shadow(c, .5, .5, .42, .14); box(c, .1, .2, 0, .8, .6, 14, '#a9774a', { tex: 'planks' }); box(c, .08, .18, 14, .84, .64, 4, '#8a5a38'); wallRect(c, 'L', .8, .42, .58, 8, 18, '#c9a050', '#6e4a1a'); } },
  { id: 'dresser', name: 'Комод', cat: 'store', icon: '🗄️', cost: { planks: 6, nails: 2 }, h: 40, cozy: 2, cap: { mat: 15, seed: 10 },
    desc: 'Комод с ящиками: ещё немного места и уюта.',
    draw(c) { shadow(c, .5, .5, .42, .14); box(c, .1, .15, 0, .8, .7, 30, WOOD, { tex: 'planks' }); for (const z of [4, 12, 20]) { wallRect(c, 'L', .85, .18, .82, z, z + 6, DARK); const [x, y] = P(.5, .85, z + 3); c.fillStyle = '#e8d9a0'; c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill(); } } },
  { id: 'wardrobe', name: 'Шкаф с одеждой', cat: 'store', icon: '👕', cost: { planks: 8, cloth: 2 }, h: 80, cozy: 2, wardrobe: true,
    desc: 'Здесь можно переодеться: сменить цвет одежды и шапку.',
    draw(c) { shadow(c, .5, .5, .42, .16); box(c, .1, .15, 0, .8, .7, 66, '#a9774a', { tex: 'planks', texA: .08 }); line3(c, [.5, .85, 4], [.5, .85, 62], '#6e4a30', 1.4); for (const x of [.45, .55]) { const [X, Y] = P(x, .85, 34); c.fillStyle = '#e8d9a0'; c.beginPath(); c.arc(X, Y, 1.4, 0, 7); c.fill(); } } },
  { id: 'bookshelf', name: 'Книжный шкаф', cat: 'store', icon: '📚', cost: { planks: 8, nails: 2 }, h: 78, cozy: 4, read: { mood: 14, dur: 14 },
    desc: 'Можно почитать — тихое счастье. Рядом с креслом и лампой — «Читальный уголок».',
    draw(c, it) { shadow(c, .5, .5, .42, .16); box(c, .1, .1, 0, .8, .6, 66, '#8a5a38'); for (let i = 0; i < 4; i++) { const z = 3 + i * 16; wallRect(c, 'L', .7, .14, .86, z, z + 14, '#4a2e1c'); bookRow(c, 'L', .7, .15, .85, z, z + 13, it.v * 7 + i); } box(c, .08, .08, 66, .84, .64, 3, '#7a4a2a'); } },
  // ---------- увлечения ----------
  { id: 'record_player', name: 'Проигрыватель', cat: 'hobby', icon: '📀', cost: { planks: 4, scrap: 6 }, req: ['chimney'], needs: ['power'], h: 44, cozy: 4, music: { r: 99 },
    desc: 'Виниловые пластинки. Пока играет — настроение растёт. Нужно электричество.',
    draw(c) { shadow(c, .5, .5, .4, .14); box(c, .12, .15, 0, .76, .7, 22, '#8a5a38', { tex: 'planks' }); plane(c, 22, (g) => { g.fillStyle = '#1e2024'; g.beginPath(); g.ellipse(.5, .5, .28, .28, 0, 0, 7); g.fill(); g.fillStyle = '#c9584a'; g.beginPath(); g.ellipse(.5, .5, .08, .08, 0, 0, 7); g.fill(); }); },
    anim(c, it, t) { if (it.st.on) { const [x, y] = P(.5, .5, 30); c.fillStyle = '#ff9ec0'; c.font = '12px sans-serif'; for (let i = 0; i < 2; i++) { const k = (t * .6 + i * .5) % 1; c.globalAlpha = 1 - k; c.fillText(i ? '♫' : '♪', x + 6 + Math.sin(k * 6) * 6, y - k * 28); } c.globalAlpha = 1; } } },
  { id: 'guitar', name: 'Гитара', cat: 'hobby', icon: '🎸', cost: { wood: 6, rope: 2, scrap: 1 }, h: 56, cozy: 3, play: { mood: 16, dur: 16 },
    desc: 'Сыграть пару аккордов — и на душе тепло.',
    draw(c) { shadow(c, .5, .5, .24, .12); line3(c, [.35, .5, 0], [.5, .5, 22], '#6b6f78', 2); line3(c, [.65, .5, 0], [.5, .5, 22], '#6b6f78', 2); const [x, y] = P(.5, .5, 24); c.fillStyle = '#c9915f'; c.beginPath(); c.ellipse(x, y - 4, 8, 10, .3, 0, 7); c.fill(); c.fillStyle = '#6e4a30'; c.beginPath(); c.arc(x, y - 4, 2.6, 0, 7); c.fill(); c.strokeStyle = '#7b5535'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 3, y - 12); c.lineTo(x + 10, y - 30); c.stroke(); } },
  { id: 'piano', name: 'Пианино', cat: 'hobby', icon: '🎹', size: [2, 1], cost: { planks: 20, nails: 8, scrap: 6, cloth: 2 }, req: ['guitar'], h: 62, cozy: 9, play: { mood: 26, dur: 20 },
    desc: 'Настоящее пианино! Мелодии на всю ночь — главный подарок себе.',
    draw(c) { shadow(c, 1, .5, .95, .16); box(c, .02, .08, 0, 1.96, .8, 44, '#3a2a22'); box(c, .02, .02, 28, 1.96, .94, 3, '#f4f0e6'); for (let i = 1; i < 14; i++) { const [a, b] = P(.02 + i * .14, .02, 31), [c2, d] = P(.02 + i * .14, .96, 31); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = .8; c.beginPath(); c.moveTo(a, b); c.lineTo(c2, d); c.stroke(); } box(c, .5, .1, 44, 1, .5, 14, '#2a1e18'); } },
  { id: 'easel_in', name: 'Мольберт', cat: 'hobby', icon: '🎨', cost: { wood: 4, cloth: 1, sticks: 4 }, h: 74, cozy: 3, station: 'easel',
    desc: 'Рисовать картины прямо дома: потом их можно повесить на стену.',
    draw(c, it, o) { BDEF.easel.draw(c, { cw: 1, cd: 1, st: it.st, v: it.v }, o); }, anim(c, it, t, o) { BDEF.easel.anim(c, { cw: 1, cd: 1, st: it.st, v: it.v }, t, o); } },
  { id: 'fish_tank', name: 'Аквариум', cat: 'hobby', icon: '🐠', cost: { glass: 6, sand: 4, fish: 2, planks: 2 }, req: ['sink'], h: 56, cozy: 5,
    desc: 'Рыбки лениво плавают, пузырьки поднимаются. Гипноз.',
    draw(c) { shadow(c, .5, .5, .4, .14); box(c, .12, .2, 0, .76, .6, 18, '#7a4a2a', { tex: 'planks' }); box(c, .14, .22, 18, .72, .56, 24, 'rgba(150,215,235,.55)', { top: 'rgba(200,240,250,.7)', left: 'rgba(130,200,225,.6)', right: 'rgba(110,180,210,.6)' }); plane(c, 19, (g) => { g.fillStyle = '#e8d49c'; g.fillRect(.16, .24, .68, .52); }); },
    anim(c, it, t) { for (let i = 0; i < 3; i++) { const x = .3 + (Math.sin(t * .8 + i * 2) * .5 + .5) * .4, [X, Y] = P(x, .5, 26 + i * 6 + Math.sin(t * 2 + i) * 2); c.fillStyle = ['#f08a3c', '#f5d34a', '#e85a7a'][i]; c.beginPath(); c.ellipse(X, Y, 3.6, 2.2, 0, 0, 7); c.fill(); c.beginPath(); c.moveTo(X - 3, Y); c.lineTo(X - 6, Y - 2); c.lineTo(X - 6, Y + 2); c.fill(); } c.fillStyle = 'rgba(255,255,255,.6)'; const [bx, by] = P(.7, .6, 20); for (let i = 0; i < 3; i++) { const k = (t * .5 + i / 3) % 1; c.beginPath(); c.arc(bx, by - k * 22, 1.2, 0, 7); c.fill(); } } },
  { id: 'cat_bed', name: 'Лежанка', cat: 'hobby', icon: '🐈', cost: { cloth: 3, feather: 1 }, h: 16, cozy: 2, petbed: true,
    desc: 'Мягкая лежанка. Кот (если он у тебя есть) обязательно в неё заберётся.',
    draw(c) { shadow(c, .5, .5, .3, .12); cyl(c, .5, .5, 0, .3, 7, '#c9735a', { top: '#e8a08a' }); cyl(c, .5, .5, 7, .2, 2, '#f0d4c0', { top: '#f8e6d8' }); } },
  { id: 'xmas_tree', name: 'Ёлочка', cat: 'floor', icon: '🎄', cost: { sticks: 6, fiber: 4, glass: 1 }, seasons: [3], h: 100, cozy: 8,
    desc: 'Зимний праздник у тебя дома. Можно поставить только зимой.',
    draw(c) { shadow(c, .5, .5, .34, .14); cyl(c, .5, .5, 0, .05, 12, '#6e4a30'); cone(c, .5, .5, 8, .38, 30, '#3f8a50'); cone(c, .5, .5, 26, .3, 28, '#4a9a5a'); cone(c, .5, .5, 44, .22, 26, '#58aa66'); },
    anim(c, it, t) { const pts = [[-12, 22], [10, 18], [-6, 40], [8, 36], [0, 56], [-4, 28]]; const [X, Y] = P(.5, .5, 0); pts.forEach(([dx, z], i) => { c.fillStyle = ['#ffd36e', '#ff7a8a', '#8ad0ff'][i % 3]; c.globalAlpha = .6 + .4 * Math.sin(t * 3 + i); c.beginPath(); c.arc(X + dx, Y - z, 2.2, 0, 7); c.fill(); }); c.globalAlpha = 1; c.fillStyle = '#ffd36e'; c.beginPath(); c.moveTo(X, Y - 78); c.lineTo(X + 3, Y - 72); c.lineTo(X - 3, Y - 72); c.fill(); } },
  // ---------- ковры и растения ----------
  { id: 'rug_round', name: 'Круглый ковёр', cat: 'floor', icon: '⭕', size: [2, 2], cost: { cloth: 6 }, flat: true, walk: true, h: 6, cozy: 3,
    desc: 'Мягкий круглый ковёр.', draw(c, it) { const col = BLK[it.v % 5]; plane(c, 0, (g) => { for (const [r, k] of [[.92, -.1], [.78, 0], [.6, .1], [.36, .0], [.2, .14]]) { g.fillStyle = shade(col, k * ((r * 10) % 2 ? 1 : -1)); g.beginPath(); g.ellipse(1, 1, r, r, 0, 0, 7); g.fill(); } }); } },
  { id: 'rug_square', name: 'Ковёр с узором', cat: 'floor', icon: '🟧', size: [2, 2], cost: { cloth: 5, fiber: 4 }, flat: true, walk: true, h: 6, cozy: 3,
    desc: 'Узорчатый ковёр.', draw(c, it) { const col = BLK[(it.v + 2) % 5]; plane(c, 0, (g) => { g.fillStyle = shade(col, -.15); g.beginPath(); g.roundRect(.06, .06, 1.88, 1.88, .1); g.fill(); g.fillStyle = col; g.beginPath(); g.roundRect(.2, .2, 1.6, 1.6, .06); g.fill(); g.fillStyle = '#f0e6d2'; g.beginPath(); g.moveTo(1, .4); g.lineTo(1.6, 1); g.lineTo(1, 1.6); g.lineTo(.4, 1); g.closePath(); g.fill(); g.fillStyle = shade(col, .1); g.beginPath(); g.arc(1, 1, .22, 0, 7); g.fill(); }); } },
  { id: 'rug_runner', name: 'Дорожка', cat: 'floor', icon: '▬', size: [1, 2], cost: { cloth: 3 }, flat: true, walk: true, h: 6, cozy: 2,
    desc: 'Длинная дорожка вдоль комнаты.', draw(c, it) { const col = BLK[(it.v + 4) % 5]; plane(c, 0, (g) => { g.fillStyle = shade(col, -.15); g.beginPath(); g.roundRect(.08, .05, .84, 1.9, .06); g.fill(); g.fillStyle = col; g.beginPath(); g.roundRect(.16, .14, .68, 1.72, .04); g.fill(); g.fillStyle = '#f0e6d2'; for (let i = 0; i < 4; i++) g.fillRect(.4, .3 + i * .4, .2, .16); }); } },
  { id: 'plant_pot', name: 'Цветок в горшке', cat: 'floor', icon: '🪴', cost: { pot: 1, flowers: 1 }, h: 44, cozy: 2,
    desc: 'Маленький садик на полу.', draw(c, it) { shadow(c, .5, .5, .22, .14); cyl(c, .5, .5, 0, .17, 12, '#c9735a', { top: '#5a3d28' }); for (const [dx, z, rx, ry] of [[-6, 20, 7, 5], [6, 22, 7, 5], [0, 28, 6, 5]]) { c.save(); c.translate(dx, 0); blob(c, .5, .5, z, rx, ry, '#5fae4c'); c.restore(); } const [x, y] = P(.5, .5, 34); c.fillStyle = BLK[it.v % 5]; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill(); } },
  { id: 'big_plant', name: 'Комнатное дерево', cat: 'floor', icon: '🌿', cost: { pot: 1, herbs: 2, fiber: 2 }, h: 90, cozy: 3,
    desc: 'Большое зелёное растение — освежает любой угол.', draw(c) { shadow(c, .5, .5, .3, .14); cyl(c, .5, .5, 0, .24, 16, '#8a6a4a', { top: '#5a3d28' }); cyl(c, .5, .5, 16, .035, 28, '#7b5535'); for (const [dx, z, rx, ry, k] of [[-12, 40, 14, 9, 0], [12, 44, 14, 9, -.06], [0, 56, 15, 10, .06], [-6, 70, 11, 8, .1], [8, 68, 10, 7, 0]]) { c.save(); c.translate(dx, 0); blob(c, .5, .5, z, rx, ry, shade('#5fae4c', k)); c.restore(); } } },
]);

// ---------- на стену (рисуются в u,v; u: 0..32*слотов) ----------
F([
  { id: 'window', name: 'Окно', cat: 'wall', icon: '🪟', wall: true, size: [1, 1], cost: { planks: 2, glass: 2 }, cozy: 2, desc: 'Свет и вид на улицу: днём — небо, ночью — звёзды.',
    draw(c, it, o) { c.fillStyle = '#7b5535'; c.fillRect(3, -68, 26, 52); windowArt(c, 6, 26, 22, 64, o, it.v); c.fillStyle = '#7b5535'; c.fillRect(15, -64, 2, 42); c.fillRect(6, -44, 20, 2); c.fillStyle = '#8a6440'; c.fillRect(2, -18, 28, 4); } },
  { id: 'window_big', name: 'Большое окно', cat: 'wall', icon: '🪟', wall: true, size: [2, 1], cost: { planks: 3, glass: 4 }, req: ['window'], cozy: 3, desc: 'Панорамное окно на два пролёта.',
    draw(c, it, o) { c.fillStyle = '#7b5535'; c.fillRect(3, -72, 58, 56); windowArt(c, 6, 58, 20, 68, o, it.v); c.fillStyle = '#7b5535'; c.fillRect(31, -68, 2, 48); c.fillRect(6, -46, 52, 2); c.fillStyle = '#8a6440'; c.fillRect(2, -18, 60, 4); } },
  { id: 'curtains', name: 'Шторы', cat: 'wall', icon: '🎀', wall: true, size: [1, 1], cost: { cloth: 3 }, cozy: 2, desc: 'Мягкие шторы вешаются прямо на окно. Вместе с окном — «Оконный уют».',
    draw(c, it) { const col = BLK[it.v % 5]; c.fillStyle = '#8a6440'; c.fillRect(0, -76, 32, 3); for (const [x0, x1] of [[1, 9], [23, 31]]) { c.fillStyle = col; c.beginPath(); c.moveTo(x0, -74); c.lineTo(x1, -74); c.lineTo(x1 + (x0 < 10 ? 1 : -1), -14); c.lineTo(x0, -14); c.fill(); c.strokeStyle = shade(col, -.2); c.lineWidth = 1; for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(x0 + i * 3, -74); c.lineTo(x0 + i * 3, -14); c.stroke(); } } } },
  { id: 'painting', name: 'Картина', cat: 'wall', icon: '🖼️', wall: true, size: [1, 1], cost: { planks: 1, art: 1 }, req: ['easel'], cozy: 3, desc: 'Картина, нарисованная тобой на мольберте. Каждая — особенная.',
    draw(c, it) { framed(c, 6, -58, 20, 22, it.v); } },
  { id: 'clock', name: 'Часы', cat: 'wall', icon: '🕰️', wall: true, size: [1, 1], cost: { planks: 2, scrap: 1 }, cozy: 1, desc: 'Тикают и показывают игровое время.',
    draw(c, it, o) { c.fillStyle = '#7b5535'; c.beginPath(); c.arc(16, -48, 12, 0, 7); c.fill(); c.fillStyle = '#f6f0e0'; c.beginPath(); c.arc(16, -48, 9.6, 0, 7); c.fill(); c.strokeStyle = '#3a2a22'; c.lineWidth = 1.6; c.lineCap = 'round'; const h = o.hour % 12, m = (o.hour % 1) * 60; c.beginPath(); c.moveTo(16, -48); c.lineTo(16 + Math.sin(h / 12 * 6.283) * 5, -48 - Math.cos(h / 12 * 6.283) * 5); c.stroke(); c.lineWidth = 1; c.beginPath(); c.moveTo(16, -48); c.lineTo(16 + Math.sin(m / 60 * 6.283) * 7.6, -48 - Math.cos(m / 60 * 6.283) * 7.6); c.stroke(); } },
  { id: 'wall_shelf', name: 'Полка', cat: 'wall', icon: '📚', wall: true, size: [2, 1], cost: { planks: 3, nails: 1 }, cozy: 2, desc: 'Полка с книгами и баночками.',
    draw(c, it) { c.fillStyle = '#8a5a38'; c.fillRect(3, -44, 58, 4); c.fillStyle = '#6e4a30'; c.fillRect(8, -40, 3, 5); c.fillRect(53, -40, 3, 5); for (let i = 0; i < 6; i++) { c.fillStyle = ['#c9584a', '#4a7ac9', '#5aa86a', '#d9b24a', '#8a5ac9', '#e8e0d0'][Math.floor(hash2(it.v, i, 5) * 6)]; c.fillRect(8 + i * 4.2, -44 - 12 - hash2(it.v, i, 4) * 5, 3.4, 12 + hash2(it.v, i, 4) * 5); } c.fillStyle = '#e8d29a'; c.fillRect(38, -52, 9, 8); c.fillStyle = '#c9915f'; c.fillRect(49, -56, 8, 12); c.fillStyle = '#5fae4c'; c.beginPath(); c.arc(53, -58, 4, 0, 7); c.fill(); } },
  { id: 'sconce', name: 'Бра со свечой', cat: 'wall', icon: '🕯️', wall: true, size: [1, 1], cost: { scrap: 1, glass: 1, wax: 1 }, cozy: 2, light: { r: 2.6, col: '#ffbf66', on: 'always', flick: 1 }, desc: 'Тёплый огонёк на стене.',
    draw(c, it, o) { c.fillStyle = '#5a4a3a'; c.fillRect(13, -42, 6, 10); c.fillRect(9, -34, 14, 3); c.fillStyle = '#f2e6c8'; c.fillRect(14, -52, 4, 10); const t = o.t; c.fillStyle = '#ffb050'; c.beginPath(); c.ellipse(16, -56 + Math.sin(t * 9 + it.v) * .5, 2.6, 4.6, 0, 0, 7); c.fill(); c.fillStyle = '#fff2a8'; c.beginPath(); c.ellipse(16, -55, 1.2, 2.6, 0, 0, 7); c.fill(); } },
  { id: 'string_lights_w', name: 'Гирлянда на стену', cat: 'wall', icon: '✨', wall: true, size: [2, 1], cost: { scrap: 1, glass: 1 }, req: ['sink'], needs: ['power'], cozy: 4, light: { r: 3, col: '#ffcf70', on: 'power' }, desc: 'Огоньки под потолком. Нужно электричество.',
    draw(c, it, o) { const t = o.t, on = it.on; c.strokeStyle = '#3a3a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(2, -80); c.quadraticCurveTo(32, -62, 62, -80); c.stroke(); for (let i = 1; i < 8; i++) { const f = i / 8, x = 2 + 60 * f, y = -80 + Math.sin(f * 3.14159) * 14; c.fillStyle = on ? ['#ffcf70', '#ff9a8a', '#a8e0ff'][i % 3] : '#7a6a4a'; c.globalAlpha = on ? .75 + .25 * Math.sin(t * 3 + i) : 1; c.beginPath(); c.arc(x, y + 3, 2.2, 0, 7); c.fill(); } c.globalAlpha = 1; } },
  { id: 'hanging_plant', name: 'Подвесное растение', cat: 'wall', icon: '🌱', wall: true, size: [1, 1], cost: { pot: 1, fiber: 2, flowers: 1 }, cozy: 2, desc: 'Зелёные плети свисают со стены.',
    draw(c, it, o) { c.strokeStyle = '#a99a7a'; c.lineWidth = 1; c.beginPath(); c.moveTo(16, -84); c.lineTo(11, -60); c.moveTo(16, -84); c.lineTo(21, -60); c.stroke(); c.fillStyle = '#c9735a'; c.beginPath(); c.roundRect(10, -62, 12, 9, 2); c.fill(); c.strokeStyle = '#5fae4c'; c.lineWidth = 2; const sw = Math.sin(o.t + it.v) * 1; for (const [x, l] of [[11, 18], [16, 26], [21, 14]]) { c.beginPath(); c.moveTo(x, -53); c.quadraticCurveTo(x + sw, -53 + l / 2, x + sw * 2, -53 + l); c.stroke(); } c.fillStyle = '#5fae4c'; c.beginPath(); c.ellipse(16, -66, 8, 5, 0, 0, 7); c.fill(); } },
  { id: 'mirror', name: 'Зеркало', cat: 'wall', icon: '🪞', wall: true, size: [1, 1], cost: { glass: 2, planks: 1 }, cozy: 2, desc: 'Овальное зеркало в рамке.',
    draw(c) { c.fillStyle = '#7b5535'; c.beginPath(); c.ellipse(16, -46, 11, 17, 0, 0, 7); c.fill(); const g = c.createLinearGradient(8, -60, 24, -32); g.addColorStop(0, '#e8f4fa'); g.addColorStop(.5, '#b8d4e0'); g.addColorStop(1, '#e8f4fa'); c.fillStyle = g; c.beginPath(); c.ellipse(16, -46, 8.6, 14.6, 0, 0, 7); c.fill(); } },
  { id: 'wreath', name: 'Венок', cat: 'wall', icon: '💐', wall: true, size: [1, 1], cost: { flowers: 3, fiber: 2 }, cozy: 2, desc: 'Венок из цветов.',
    draw(c, it) { for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; c.fillStyle = i % 3 ? '#5fae4c' : BLK[(i + it.v) % 5]; c.beginPath(); c.arc(16 + Math.cos(a) * 9, -50 + Math.sin(a) * 9, i % 3 ? 3.2 : 2.6, 0, 7); c.fill(); } } },
]);

// ---------- ванная ----------
F([
  { id: 'bathtub', name: 'Ванна', cat: 'bath', icon: '🛁', size: [2, 1], cost: { planks: 8, stone: 4, scrap: 4 }, req: ['sink'], needs: ['water'], h: 36, cozy: 5, bath: true,
    desc: 'Горячая ванна дома! Нужна вода (бак рядом с домом) и тепло в комнате (печка, камин или плита).',
    draw(c) { shadow(c, 1, .5, .9, .14); box(c, 0, .06, 0, 2, .88, 20, '#eef2f4'); plane(c, 20, (g) => { g.fillStyle = '#9ad4ea'; g.beginPath(); g.roundRect(.1, .16, 1.8, .68, .2); g.fill(); }); cyl(c, 1.8, .15, 20, .03, 12, '#c9ccd2'); for (const x of [.15, 1.8]) box(c, x, .9, 0, .08, .08, 3, '#c9a050'); } },
]);
export const WALLH = [76, 92, 104];
export const WALL_STYLES = ['#e8d9bf', '#cfe0d0', '#e6c9c9', '#cbd5e8', '#e9e0a8', '#d8c7e4'];
export const FLOOR_STYLES = [['#c9a06c', '#bd945e'], ['#8a5f3c', '#7d5434'], ['#a5a7ad', '#9496a0'], ['#e8e0d0', '#6a6d78'], ['#a8717a', '#9a6670']];
export const WALL_NAMES = ['Бежевые', 'Мятные', 'Розовые', 'Голубые', 'Жёлтые', 'Сиреневые'];
export const FLOOR_NAMES = ['Светлое дерево', 'Тёмное дерево', 'Камень', 'Шахматный пол', 'Ковролин'];
