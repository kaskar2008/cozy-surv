import { reg } from './registry.js';
import { plant, plotKey, stageOf } from './common.js';
import { CROPS } from '../crops.js';
import { P, box, cyl, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean, cone } from '../../core/iso.js';
import { shade } from '../../core/util.js';

const soil = (b, i = 0) => (b.st.plots[i].moist > 0.3 ? '#6a4a32' : '#8a6644');
function drawPlantsRect(c, b, i, x0, y0, nx, ny, stepX, stepY, w, h) {
  const p = b.st.plots[i]; if (!p.crop) return;
  const st = stageOf(p);
  for (let j = 0; j < ny; j++) for (let k = 0; k < nx; k++) plant(c, p.crop, st, x0 + k * stepX, y0 + j * stepY, CROPS[p.crop].col);
}
const badgePlots = (b) => {
  let ripe = false, dry = false, empty = false;
  for (const p of b.st.plots) { if (p.crop && p.prog >= 1) ripe = true; else if (p.crop && p.moist < 0.15) dry = true; else if (!p.crop) empty = true; }
  return ripe ? '🧺' : dry ? '💧' : empty ? '🌱' : null;
};

reg([
  {
    id: 'plot', name: 'Грядка', cat: 'farm', icon: '🥕', size: [2, 2], cost: { sticks: 8, fiber: 4 }, h: 50, cozy: 1, flat: true, walk: true, crops: true, plotCount: 1,
    desc: 'Вспаханная грядка 2×2. Посади семена, поливай (лейкой, дождём, дождевателем или трубой рядом) — и собирай урожай. Рядом компост даёт прибавку.',
    tags: ['plot'], net: { water: { cap: 0, leaf: true } },
    key: plotKey, badge: badgePlots,
    draw(c, b) {
      plane(c, 0, (g) => {
        g.fillStyle = soil(b); g.beginPath(); g.roundRect(.04, .04, 1.92, 1.92, .12); g.fill();
        g.fillStyle = b.st.plots[0].moist > .3 ? '#583c28' : '#7a583a'; for (const y of [.5, 1.5]) { g.beginPath(); g.roundRect(.14, y - .13, 1.72, .26, .1); g.fill(); }
      });
      drawPlantsRect(c, b, 0, .5, .5, 2, 2, 1, 1);
    },
  },
  {
    id: 'raised_bed', name: 'Высокая грядка', cat: 'farm', icon: '🥬', size: [2, 2], cost: { planks: 8, nails: 2, stone: 4 }, req: ['plot'], h: 50, cozy: 2, crops: true, plotCount: 1, bonus: 1.15,
    desc: 'Деревянный короб с отборной землёй: культуры растут на 15% быстрее и дольше держат влагу.',
    tags: ['plot'], net: { water: { cap: 0, leaf: true } },
    key: plotKey, badge: badgePlots,
    draw(c, b) {
      box(c, 0, 0, 0, 2, .14, 9, '#b98557', { tex: 'planks' }); box(c, 0, 0, 0, .14, 2, 9, '#b98557', { tex: 'planks' });
      plane(c, 8, (g) => { g.fillStyle = soil(b); g.fillRect(.14, .14, 1.86, 1.86); g.fillStyle = b.st.plots[0].moist > .3 ? '#583c28' : '#7a583a'; for (const y of [.55, 1.5]) g.fillRect(.25, y - .12, 1.6, .24); });
      c.save(); c.translate(0, -8); drawPlantsRect(c, b, 0, .55, .55, 2, 2, .95, .95); c.restore();
      box(c, 0, 1.86, 0, 2, .14, 9, '#c69265', { tex: 'planks' }); box(c, 1.86, 0, 0, .14, 2, 9, '#a8734a', { tex: 'planks' });
    },
  },
  {
    id: 'greenhouse', name: 'Теплица', cat: 'farm', icon: '🏡', size: [3, 3], cost: { planks: 14, glass: 12, nails: 8 }, req: ['raised_bed', 'kiln'], h: 90, cozy: 4, crops: true, plotCount: 2, bonus: 1.1,
    desc: 'Стеклянная теплица на две грядки: растения растут круглый год, даже зимой. Подведи трубу — она поливает сама.',
    tags: ['plot', 'greenhouse'], net: { water: { cap: 0, leaf: true } },
    key: plotKey, badge: badgePlots,
    draw(c, b) {
      shadow(c, 1.5, 1.5, 1.2, .2);
      plane(c, 0, (g) => { g.fillStyle = '#8a6a4a'; g.fillRect(.05, .05, 2.9, 2.9); for (const [x, y] of [[.3, .3], [.3, 1.65]]) { g.fillStyle = soil(b, x < 1 && y < 1 ? 0 : 1); g.beginPath(); g.roundRect(x, y, 2.4, 1.05, .1); g.fill(); } });
      for (const [i, y] of [[0, .55], [1, 1.9]]) drawPlantsRect(c, b, i, .7, y, 3, 1, .8, 0);
      const A = 'rgba(190,230,245,.28)';
      for (const [x, y] of [[.05, .05], [2.95, .05], [.05, 2.95], [2.95, 2.95]]) box(c, x - .04, y - .04, 0, .08, .08, 44, '#e8eef2');
      wallRect(c, 'L', 2.95, .05, 2.95, 0, 44, A, 'rgba(255,255,255,.6)'); wallRect(c, 'R', 2.95, .05, 2.95, 0, 44, A, 'rgba(255,255,255,.6)');
      wallRect(c, 'L', 2.95, 1.2, 1.8, 0, 26, 'rgba(90,70,40,.35)');
      gable(c, .0, .0, 44, 3, 3, 26, .1, 'rgba(200,236,248,.42)', 'rgba(200,236,248,.35)', 'y');
    },
  },
  {
    id: 'compost', name: 'Компостная куча', cat: 'farm', icon: '🟤', cost: { planks: 4, sticks: 6 }, req: ['plot'], h: 36, cozy: 0,
    desc: 'Перерабатывает траву и хворост в компост. Грядки рядом (до 3 клеток) сами подкармливаются при посадке: урожай больше, рост быстрее.',
    tags: ['compost'], compost: true,
    draw(c) {
      shadow(c, .5, .5, .42, .16);
      blob(c, .5, .5, 7, 17, 10, '#5a3d28');
      box(c, .05, .05, 0, .9, .06, 12, '#a9774a', { tex: 'planks' }); box(c, .05, .05, 0, .06, .9, 12, '#a9774a', { tex: 'planks' });
      box(c, .05, .89, 0, .9, .06, 12, '#c08a58', { tex: 'planks' }); box(c, .89, .05, 0, .06, .9, 12, '#9a6a42', { tex: 'planks' });
    },
    anim(c, b, t) { if ((b.st.load || 0) > 0) { const [x, y] = P(.5, .5, 16); c.fillStyle = 'rgba(200,220,150,.45)'; c.globalAlpha = .5 + .3 * Math.sin(t * 2); c.beginPath(); c.arc(x, y - 4, 3, 0, 7); c.fill(); c.globalAlpha = 1; } },
    badge: (b) => (b.st.ready > 0 ? '🟤' : null),
  },
  {
    id: 'scarecrow', name: 'Пугало', cat: 'farm', icon: '🧑‍🌾', cost: { sticks: 8, cloth: 2, flowers: 1 }, req: ['plot'], h: 80, cozy: 4, radius: 4,
    desc: 'Забавное пугало в соломенной шляпе. Грядки рядом растут чуть быстрее (+10%) — а вокруг как-то веселее.',
    tags: ['scarecrow'],
    draw(c) {
      shadow(c, .5, .5, .2, .16);
      line3(c, [.5, .5, 0], [.5, .5, 50], '#7b5535', 3.4); line3(c, [.2, .5, 34], [.8, .5, 34], '#7b5535', 3);
      box(c, .36, .4, 20, .28, .2, 22, '#d46a4a'); box(c, .12, .44, 30, .76, .1, 8, '#b85a3e', { top: '#d46a4a' });
      blob(c, .5, .5, 54, 8, 8, '#f0d4a0'); cyl(c, .5, .5, 58, .26, 3, '#e3b95a'); cyl(c, .5, .5, 61, .14, 8, '#e3b95a');
      c.fillStyle = '#3a2a22'; const [x, y] = P(.5, .5, 54); c.fillRect(x - 3, y - 1, 1.6, 1.6); c.fillRect(x + 2, y - 1, 1.6, 1.6);
      for (const dx of [-1, 1]) line3(c, [.5 + dx * .38, .5, 34], [.5 + dx * .42, .5, 26], '#e3b95a', 1.6);
    },
  },
  {
    id: 'flower_bed', name: 'Клумба', cat: 'farm', icon: '🌷', cost: { flowers: 3, stone: 2 }, h: 40, cozy: 3, drag: true,
    desc: 'Яркая клумба. Радует глаз, а пчёлы вокруг неё делают мёд быстрее.',
    tags: ['flowerpatch'],
    key: (b) => b.v % 5,
    draw(c, b) {
      shadow(c, .5, .5, .42, .12);
      plane(c, 0, (g) => { g.fillStyle = '#6a4a32'; g.beginPath(); g.roundRect(.06, .06, .88, .88, .2); g.fill(); g.strokeStyle = '#9ea1a8'; g.lineWidth = .08; g.stroke(); });
      const cols = [['#f08ac0', '#ffffff'], ['#f5d34a', '#f08a4a'], ['#8aa8f0', '#f0a8e0'], ['#ff7a6a', '#ffe08a'], ['#c3a6ee', '#ffffff']][b.v % 5];
      const pts = [[.3, .3], [.65, .28], [.5, .5], [.28, .68], [.7, .66]];
      pts.forEach(([x, y], i) => { c.strokeStyle = '#5da84e'; c.lineWidth = 1.4; const [X, Y] = P(x, y, 0); c.beginPath(); c.moveTo(X, Y); c.lineTo(X, Y - 11 - (i % 2) * 3); c.stroke(); const cc = cols[i % 2]; c.fillStyle = cc; for (let k = 0; k < 5; k++) { const a = k * 1.2566; c.beginPath(); c.arc(X + Math.cos(a) * 3, Y - 13 - (i % 2) * 3 + Math.sin(a) * 3, 2.3, 0, 7); c.fill(); } c.fillStyle = '#f5a623'; c.beginPath(); c.arc(X, Y - 13 - (i % 2) * 3, 1.5, 0, 7); c.fill(); });
    },
  },
  {
    id: 'beehive', name: 'Улей', cat: 'farm', icon: '🐝', cost: { wood: 8, planks: 3, cloth: 1 }, req: ['workbench'], h: 50, cozy: 3,
    desc: 'Пчёлы делают мёд (и немного воска). Чем больше цветов рядом (клумбы, цветущие грядки, дикие цветы в 6 клетках) — тем быстрее.',
    tags: ['producer', 'hive'], out: { item: 'honey', every: 240, max: 4, label: 'мёд', bonus: { wax: 0.3 } },
    draw(c) {
      shadow(c, .5, .5, .32, .16);
      for (const x of [.22, .72]) box(c, x, .22, 0, .08, .56, 10, '#6e4a30');
      box(c, .2, .2, 10, .6, .6, 10, '#f0c44a', { tex: 'planks' }); box(c, .2, .2, 20, .6, .6, 9, '#e8b83a', { tex: 'planks' }); box(c, .22, .22, 29, .56, .56, 8, '#f0c44a', { tex: 'planks' });
      box(c, .14, .14, 37, .72, .72, 4, '#b0603c');
      const [x, y] = P(.5, .8, 16); c.fillStyle = '#3a2a22'; c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill();
    },
    anim(c, b, t) { c.fillStyle = '#2a2020'; for (let i = 0; i < 3; i++) { const a = t * 2.2 + i * 2.1, [x, y] = P(.5 + Math.cos(a) * .5, .5 + Math.sin(a * 1.3) * .5, 28 + Math.sin(a * 2) * 6); c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x - 1.5, y - 2.3, 3, 1); c.fillStyle = '#2a2020'; } },
  },
  {
    id: 'coop', name: 'Курятник', cat: 'farm', icon: '🐔', size: [2, 2], cost: { wood: 14, sticks: 12, planks: 4 }, req: ['workbench'], h: 70, cozy: 4,
    desc: 'Три курочки несут яйца (и теряют пёрышки). Их нужно кормить зерном и поить. Кормушка рядом сама берёт пшеницу из запасов, поилка — воду из сети.',
    tags: ['producer', 'animals'], animals: { feed: ['wheat'], water: true }, out: { item: 'egg', every: 150, max: 6, label: 'яйца', bonus: { feather: 0.1 }, needs: true },
    draw(c) {
      shadow(c, 1, 1, .95, .2);
      box(c, .1, .1, 0, 1.2, 1.1, 24, '#c9915f', { tex: 'planks' });
      gable(c, .0, .0, 24, 1.4, 1.3, 16, .12, '#a5503e', '#c9915f', 'y');
      wallRect(c, 'L', 1.2, .35, .65, 0, 12, '#3a2a22'); wallRect(c, 'R', 1.3, .35, .85, 8, 18, '#e8d29a', '#6b4328');
      poly(c, [P(1.45, 1.9, 0), P(1.9, 1.9, 0), P(1.5, 1.3, 11), P(1.3, 1.3, 11)], '#a9774a');
      for (let i = 0; i < 4; i++) line3(c, [.1 + i * .5, 1.9, 0], [.1 + i * .5, 1.9, 12], '#8b5e3c', 2);
    },
    anim(c, b, t) {
      for (let i = 0; i < 3; i++) {
        const a = t * .35 + i * 2.1, x = 1.0 + Math.cos(a) * .55 + i * .15, y = 1.5 + Math.sin(a * 1.4) * .3, peck = Math.max(0, Math.sin(t * 3 + i * 2)) * 3;
        const [X, Y] = P(Math.min(1.9, Math.max(.2, x)), Math.min(1.9, Math.max(1.35, y)), 0); const dir = Math.cos(a) > 0 ? 1 : -1;
        c.save(); c.translate(X, Y); c.scale(dir, 1);
        c.fillStyle = i === 1 ? '#c98a4a' : '#fbf6ea'; c.beginPath(); c.ellipse(0, -6, 5, 4, 0, 0, 7); c.fill();
        c.beginPath(); c.arc(4.5, -9 + peck, 2.6, 0, 7); c.fill(); c.fillStyle = '#e8763a'; c.fillRect(6.4, -9 + peck, 2.4, 1.4); c.fillStyle = '#d9402a'; c.fillRect(3.4, -12 + peck, 2.4, 2);
        c.fillStyle = '#3a2a22'; c.fillRect(4.6, -9.8 + peck, 1, 1); c.strokeStyle = '#e8763a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1, -2); c.lineTo(-1, 0); c.moveTo(2, -2); c.lineTo(2, 0); c.stroke();
        c.restore();
      }
    },
    badge: (b) => ((b.st.stock || 0) > 0 ? '🥚' : (b.st.feedT || 0) <= 0 ? '🌾' : (b.st.waterT || 0) <= 0 ? '💧' : null),
  },
  {
    id: 'goat_pen', name: 'Козий загон', cat: 'farm', icon: '🐐', size: [3, 3], cost: { wood: 20, planks: 10, rope: 4 }, req: ['coop'], h: 60, cozy: 5,
    desc: 'Милая коза даёт молоко. Любит волокна и сено, нуждается в воде. Поилка и кормушка рядом всё автоматизируют.',
    tags: ['producer', 'animals'], animals: { feed: ['fiber', 'wheat'], water: true }, out: { item: 'milk', every: 210, max: 4, label: 'молоко', needs: true },
    draw(c) {
      shadow(c, 1.5, 1.5, 1.4, .18);
      plane(c, 0, (g) => { g.fillStyle = 'rgba(160,120,70,.35)'; g.fillRect(.1, .1, 2.8, 2.8); });
      for (let i = 0; i <= 6; i++) { const t = .08 + i * .47; box(c, t, .02, 0, .07, .07, 22, '#8a6440'); box(c, .02, t, 0, .07, .07, 22, '#8a6440'); }
      line3(c, [.08, .05, 15], [2.95, .05, 15], '#a9774a', 3); line3(c, [.05, .08, 15], [.05, 2.95, 15], '#a9774a', 3);
      line3(c, [.08, .05, 8], [2.95, .05, 8], '#a9774a', 3); line3(c, [.05, .08, 8], [.05, 2.95, 8], '#a9774a', 3);
      box(c, .2, .2, 0, .9, .8, 22, '#c9915f', { tex: 'planks' }); lean(c, .1, .1, 22, 1.1, 1.0, 0, 10, .08, '#a5503e');
      blob(c, 1.9, .9, 4, 14, 8, '#d9bd6a');
    },
    anim(c, b, t) {
      const a = t * .25, x = 1.7 + Math.cos(a) * .7, y = 1.9 + Math.sin(a * 1.3) * .6, [X, Y] = P(x, y, 0), dir = Math.cos(a) > 0 ? 1 : -1;
      c.save(); c.translate(X, Y); c.scale(dir, 1);
      c.fillStyle = '#f2ecdc'; c.beginPath(); c.ellipse(0, -8, 8, 5, 0, 0, 7); c.fill(); c.fillRect(-6, -5, 2, 5); c.fillRect(4, -5, 2, 5);
      c.beginPath(); c.ellipse(8, -13, 3.6, 3, 0, 0, 7); c.fill(); c.fillStyle = '#8a7a66'; c.fillRect(8, -17, 1.4, 4); c.fillRect(5, -17, 1.4, 4); c.fillStyle = '#3a2a22'; c.fillRect(9, -14, 1.2, 1.2); c.fillRect(11, -12, 1.4, 1.4);
      c.restore();
    },
    badge: (b) => ((b.st.stock || 0) > 0 ? '🥛' : (b.st.feedT || 0) <= 0 ? '🌿' : (b.st.waterT || 0) <= 0 ? '💧' : null),
  },
  {
    id: 'feeder', name: 'Кормушка', cat: 'farm', icon: '🌾', cost: { planks: 2, sticks: 2 }, req: ['coop'], h: 24, cozy: 0,
    desc: 'Если поставить вплотную к курятнику или загону — сама подсыпает корм из ваших запасов (пшеница, волокно).',
    tags: ['feeder_animal'],
    draw(c) { shadow(c, .5, .5, .34, .14); box(c, .15, .25, 0, .7, .5, 9, '#a9774a', { tex: 'planks' }); plane(c, 9, (g) => { g.fillStyle = '#e6c45a'; g.fillRect(.22, .32, .56, .36); }); },
  },
  {
    id: 'windmill', name: 'Ветряная мельница', cat: 'farm', icon: '🌬️', size: [2, 2], cost: { wood: 30, planks: 16, cloth: 6, nails: 8 }, req: ['quern', 'plot'], h: 190, cozy: 6,
    desc: 'Сама перемалывает пшеницу из запасов в муку, пока дует ветер. Красиво вращается — и уютно скрипит.',
    tags: ['mill'], mill: true,
    draw(c) {
      shadow(c, 1, 1, .9, .22);
      box(c, .3, .3, 0, 1.4, 1.4, 14, '#8d8f95', { tex: 'stone' });
      box(c, .45, .45, 14, 1.1, 1.1, 54, '#e8d6b6', { tex: 'planks', texA: .08 });
      pyramid(c, .35, .35, 68, 1.3, 1.3, 34, .1, '#a5503e');
      wallRect(c, 'L', 1.55, .85, 1.15, 14, 38, '#6b4328', '#3a2a22'); wallRect(c, 'R', 1.55, .8, 1.2, 44, 58, '#bfe6f2', '#6b4328');
    },
    anim(c, b, t) {
      const [X, Y] = P(1.6, 1.6, 78), sp = b.st.on ? t * .9 : t * .12;
      c.save(); c.translate(X, Y); c.rotate(sp);
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.fillStyle = '#7b5535'; c.fillRect(-1.5, 0, 3, 54); c.fillStyle = '#f3ead2'; c.beginPath(); c.moveTo(1.5, 8); c.lineTo(15, 10); c.lineTo(15, 50); c.lineTo(1.5, 52); c.closePath(); c.fill(); c.strokeStyle = 'rgba(120,90,60,.5)'; c.lineWidth = .8; c.beginPath(); c.moveTo(8, 9); c.lineTo(8, 51); c.stroke(); }
      c.fillStyle = '#5a3d26'; c.beginPath(); c.arc(0, 0, 4.5, 0, 7); c.fill(); c.restore();
    },
  },
  {
    id: 'oak_sapling', name: 'Саженец дерева', cat: 'farm', icon: '🌳', cost: { sticks: 4, fiber: 2 }, req: [], plantNode: { t: 'tree', tm: 500 }, h: 30, cozy: 0,
    desc: 'Посадить деревце: через пару дней вырастет новое дерево — запас древесины возобновляем.',
    draw() {},
  },
  {
    id: 'apple_sapling', name: 'Яблоня', cat: 'farm', icon: '🍎', cost: { apple: 2, fiber: 2 }, req: [], plantNode: { t: 'appletree', tm: 800 }, h: 30, cozy: 0,
    desc: 'Посадить яблоню. Осенью даёт яблоки на пироги, сидр и просто так.',
    draw() {},
  },
]);
