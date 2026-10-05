import { reg } from './registry.js';
import { conduit } from './common.js';
import { P, box, cyl, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean, flame } from '../../core/iso.js';
import { shade } from '../../core/util.js';

const gauge = (c, b, cap, x = -14) => {
  const f = Math.min(1, (b.st.water || 0) / cap), [X, Y] = P(.5, .5, 0);
  c.fillStyle = 'rgba(30,40,50,.55)'; c.fillRect(X + x, Y - 32, 4, 28);
  c.fillStyle = '#7ad0f2'; c.fillRect(X + x, Y - 4 - 28 * f, 4, 28 * f);
};

reg([
  {
    id: 'well', name: 'Колодец', cat: 'water', icon: '⛲', size: [2, 2], cost: { stone: 25, wood: 6, rope: 2 }, req: ['workbench'], h: 90, cozy: 3,
    desc: 'Медленный, но вечный источник чистой воды. Соединяется трубами и баками в общую сеть.',
    tags: ['water'], net: { water: { cap: 12, prod: 0.07 } }, drink: true,
    draw(c) {
      shadow(c, 1, 1, .8, .22);
      cyl(c, 1, 1, 0, .62, 14, '#9a9ca3', { rings: [.5], ringCol: '#7c7e86', top: '#3b7390' });
      plane(c, 14, (g) => { g.fillStyle = '#2e6a8a'; g.beginPath(); g.ellipse(1, 1, .42, .42, 0, 0, 7); g.fill(); });
      for (const x of [.28, 1.72]) box(c, x - .05, .95, 14, .1, .1, 40, '#7b5535');
      box(c, .2, .93, 52, 1.6, .14, 5, '#6e4a30');
      gable(c, .05, .45, 56, 1.9, 1.1, 16, .12, '#a5503e', '#d9b27a', 'x');
      line3(c, [1, 1, 52], [1, 1, 30], '#c9b58a', 1.4); cyl(c, 1, 1, 24, .08, 7, '#8b5e3c');
    },
  },
  {
    id: 'rain_collector', name: 'Дождесборник', cat: 'water', icon: '🌧️', size: [2, 2], cost: { wood: 8, cloth: 2, sand: 4, charcoal: 2 }, req: ['workbench'], h: 80, cozy: 2,
    desc: 'Скат собирает дождь, песчано-угольный фильтр очищает его. Внутри помещается мало — поставь вплотную бак или проведи трубу, чтобы запасы росли!',
    tags: ['water', 'rain'], net: { water: { cap: 8, rain: 0.32 } }, drink: true,
    draw(c) {
      shadow(c, 1, 1, .85, .2);
      for (const [x, y] of [[.15, .15], [1.8, .15], [.15, 1.8], [1.8, 1.8]]) box(c, x - .05, y - .05, 0, .1, .1, y < 1 ? 46 : 34, '#7b5535');
      lean(c, .0, .0, 34, 2, 2, 0, 12, .08, '#8cc0d8');
      box(c, 0, 1.95, 30, 2, .1, 4, '#9fb4c0');
      cyl(c, .55, 1.55, 0, .34, 26, '#8b5e3c', { rings: [.25, .75], ringCol: '#4a3a30', top: '#5a8aa6' });
      for (const [k, col] of [[0, '#d9c28a'], [1, '#3a3a40'], [2, '#a2a5ac']]) box(c, 1.25, 1.2 + k * .0, k * 7, .5, .5, 7, col, { top: shade(col, .05) });
    },
    anim(c, b, t, o) {
      if (o.raining) { c.fillStyle = 'rgba(160,215,245,.9)'; for (let i = 0; i < 5; i++) { const k = (t * 1.6 + i * .2) % 1, [x, y] = P(.1 + i * .38, .1 + (i % 2) * .6, 46 - k * 40); c.fillRect(x, y, 1.4, 4); } }
    },
  },
  {
    id: 'tank', name: 'Бак для воды', cat: 'water', icon: '🛢️', cost: { wood: 8, rope: 2 }, reqAny: ['rain_collector', 'well'], h: 70, cozy: 1,
    desc: 'Деревянный бак на 40 единиц. Ставь вплотную к дождесборнику, колодцу, трубе или другому баку — вода потечёт в общую сеть.',
    tags: ['water', 'tank'], net: { water: { cap: 40 } }, drink: true,
    draw(c) { shadow(c, .5, .5, .42, .2); cyl(c, .5, .5, 0, .38, 38, '#9a6a44', { rings: [.15, .5, .85], ringCol: '#4a3a30', top: '#7a5233' }); },
    anim(c, b) { gauge(c, b, 40, -9); },
  },
  {
    id: 'cistern', name: 'Цистерна', cat: 'water', icon: '🏺', size: [2, 2], cost: { stone: 24, planks: 8, nails: 4 }, req: ['tank'], h: 70, cozy: 2,
    desc: 'Каменная цистерна на 160 единиц воды — запас на всю зиму.',
    tags: ['water', 'tank'], net: { water: { cap: 160 } }, drink: true,
    draw(c) { shadow(c, 1, 1, .95, .22); cyl(c, 1, 1, 0, .82, 34, '#9ea1a8', { rings: [.5], ringCol: '#7c7e86', top: '#7aa7be' }); plane(c, 34, (g) => { g.fillStyle = '#5f8ea8'; g.beginPath(); g.ellipse(1, 1, .55, .55, 0, 0, 7); g.fill(); g.fillStyle = '#3a3a40'; g.beginPath(); g.ellipse(1, 1, .18, .18, 0, 0, 7); g.fill(); }); },
    anim(c, b) { const f = Math.min(1, (b.st.water || 0) / 160), [X, Y] = P(1, 1, 34); c.fillStyle = `rgba(110,200,240,${.25 + .5 * f})`; c.beginPath(); c.ellipse(X, Y, 20 * f + 4, 10 * f + 2, 0, 0, 7); c.fill(); },
  },
  {
    id: 'pipe', name: 'Труба', cat: 'water', icon: '➰', cost: { reeds: 2 }, req: ['tank'], flat: true, walk: true, drag: true, norot: true, h: 8,
    desc: 'Тростниковая труба: соединяет баки, колодец, душ, грядки и всё, что работает с водой. Протяни, чтобы проложить.',
    tags: ['conduit'], net: { water: { cap: 0 } }, conduit: 'water', key: (b) => b.mask || 0,
    draw(c, b) { conduit(c, b, '#a3b894', .13, '#7f9672'); },
  },
  {
    id: 'sprinkler', name: 'Дождеватель', cat: 'water', icon: '💦', cost: { scrap: 2, reeds: 2, planks: 1 }, req: ['pipe'], h: 40, cozy: 1,
    desc: 'Сам поливает грядки в радиусе 3 клеток. Подключи к сети труб с водой — и забудь про лейку.',
    tags: ['water'], net: { water: { cap: 1 } }, radius: 3,
    draw(c) { shadow(c, .5, .5, .16, .14); cyl(c, .5, .5, 0, .06, 18, '#6b7f8a'); cyl(c, .5, .5, 16, .12, 5, '#8aa3b5', { top: '#b9ccd8' }); },
    anim(c, b, t) { if (b.st.on > 0) { const [x, y] = P(.5, .5, 22); c.strokeStyle = 'rgba(150,215,245,.8)'; c.lineWidth = 1.4; for (let i = 0; i < 6; i++) { const a = i * 1.0472 + t * 1.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * 14, y - 16, x + Math.cos(a) * 26, y + Math.sin(a) * 9 + 6); c.stroke(); } } },
  },
  {
    id: 'river_pump', name: 'Насос у воды', cat: 'water', icon: '🚰', cost: { scrap: 6, nails: 4, planks: 4 }, req: ['solar_panel'], shore: true, h: 56, cozy: 1,
    desc: 'Качает воду из озера в сеть труб. Нужно электричество (солнечная панель + провода) и место у самой воды.',
    tags: ['water', 'power'], net: { water: { cap: 4, prod: 0.6, needsPower: true }, power: { use: 1.2 } },
    draw(c) {
      shadow(c, .5, .5, .3, .18);
      box(c, .2, .2, 0, .6, .6, 16, '#6b7f8a'); box(c, .28, .28, 16, .44, .44, 8, '#4f5f6a');
      cyl(c, .5, .5, 24, .08, 20, '#8aa3b5'); box(c, .35, .35, 44, .3, .3, 4, '#c9573f');
    },
    anim(c, b, t) { const [x, y] = P(.5, .5, 44 + (b.st.on ? Math.sin(t * 8) * 3 : 0)); c.fillStyle = '#b9ccd8'; c.fillRect(x - 3, y - 4, 6, 4); if (b.st.on) { c.fillStyle = '#7ad0f2'; c.beginPath(); c.arc(x + 12, y + 12 + Math.sin(t * 4) * 2, 2, 0, 7); c.fill(); } },
  },
  {
    id: 'trough', name: 'Поилка', cat: 'water', icon: '🥣', cost: { planks: 3 }, req: ['tank'], h: 24, cozy: 1,
    desc: 'Поилка для животных. Подключённая к сети труб, сама наполняется. Курятник и загон берут воду из поилки рядом.',
    tags: ['water', 'trough'], net: { water: { cap: 8 } },
    key: (b) => (b.st.wet ? 1 : 0),
    draw(c, b) {
      shadow(c, .5, .5, .4, .14);
      box(c, .12, .22, 0, .76, .56, 11, '#a9774a', { tex: 'planks' });
      plane(c, 11, (g) => { g.fillStyle = b.st.wet ? '#6cc4ee' : '#4a3a30'; g.fillRect(.2, .3, .6, .4); });
    },
  },
  {
    id: 'shower', name: 'Уличный душ', cat: 'water', icon: '🚿', cost: { planks: 6, rope: 1, scrap: 2 }, req: ['tank'], h: 80, cozy: 3,
    desc: 'Деревянная кабинка с бочкой. Подключи к воде — и принимай душ под открытым небом (расходует воду).',
    tags: ['water'], net: { water: { cap: 6 } }, shower: true,
    draw(c) {
      shadow(c, .5, .5, .42, .18);
      for (const [x, y] of [[.12, .12], [.88, .12], [.12, .88], [.88, .88]]) box(c, x - .04, y - .04, 0, .08, .08, 56, '#8a6440');
      box(c, .12, .12, 0, .04, .76, 40, '#b98557', { notop: false }); box(c, .12, .84, 0, .76, .04, 40, '#c9915f', { tex: 'planks' });
      cyl(c, .5, .3, 56, .22, 14, '#8b5e3c', { rings: [.5], ringCol: '#4a3a30', top: '#5a8aa6' });
      cyl(c, .5, .5, 40, .03, 16, '#8aa3b5'); cyl(c, .5, .5, 38, .1, 3, '#6b7f8a');
    },
  },
  {
    id: 'hot_tub', name: 'Купель', cat: 'water', icon: '🛁', size: [2, 2], cost: { planks: 12, stone: 8, rope: 2, nails: 4 }, reqAny: ['tank', 'well'], h: 60, cozy: 6,
    desc: 'Деревянная бочка-ванна. Подключи к воде и поставь вплотную к горящему костру или печи — вода нагреется. После ванны — полное тепло и отличное настроение.',
    tags: ['water', 'tub'], net: { water: { cap: 24 } }, needs: ['heat'],
    draw(c) {
      shadow(c, 1, 1, .95, .22);
      cyl(c, 1, 1, 0, .84, 22, '#a9774a', { rings: [.15, .55, .9], ringCol: '#4a3a30', top: '#7a5233' });
      box(c, 1.6, 1.7, 0, .5, .35, 8, '#8b5e3c', { tex: 'planks' });
    },
    anim(c, b, t) {
      const [X, Y] = P(1, 1, 22), full = !!b.st.full, hot = b.st.hot;
      c.fillStyle = full ? (hot ? '#8fd6e8' : '#6cb8d6') : '#4a3a30';
      c.beginPath(); c.ellipse(X, Y, 33, 16.5, 0, 0, 7); c.fill();
      if (full && hot) { c.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 3; i++) { const k = (t * .5 + i / 3) % 1; c.globalAlpha = (1 - k) * .8; c.beginPath(); c.arc(X + (i - 1) * 14, Y - k * 26, 5 + k * 4, 0, 7); c.fill(); } c.globalAlpha = 1; }
    },
  },
  {
    id: 'fountain', name: 'Фонтан', cat: 'water', icon: '⛲', size: [2, 2], cost: { stone: 30, clay: 4 }, req: ['pipe'], h: 80, cozy: 9,
    desc: 'Шумит и искрится, когда в сети есть вода. Журчание поднимает настроение всем вокруг.',
    tags: ['water', 'fountain'], net: { water: { cap: 6, use: 0.025 } },
    draw(c) {
      shadow(c, 1, 1, .95, .22);
      cyl(c, 1, 1, 0, .85, 14, '#b4b6bd', { rings: [.5], ringCol: '#8c8e96', top: '#8cc8e2' });
      cyl(c, 1, 1, 14, .12, 30, '#b4b6bd'); cyl(c, 1, 1, 40, .34, 6, '#b4b6bd', { top: '#8cc8e2' }); cyl(c, 1, 1, 46, .08, 10, '#b4b6bd');
    },
    anim(c, b, t) {
      if (!b.st.on) return;
      const [X, Y] = P(1, 1, 56); c.strokeStyle = 'rgba(190,235,255,.85)'; c.lineWidth = 1.5; c.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const a = i * .785 + t * .6, r = 16 + Math.sin(t * 3 + i) * 3; c.beginPath(); c.moveTo(X, Y); c.quadraticCurveTo(X + Math.cos(a) * r * .6, Y - 10, X + Math.cos(a) * r, Y + 14 + Math.sin(a) * 6); c.stroke(); }
      const [X2, Y2] = P(1, 1, 14); c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(X2, Y2, 30 + Math.sin(t * 3) * 3, 15, 0, 0, 7); c.stroke();
    },
  },
  {
    id: 'pond', name: 'Выкопать пруд', cat: 'water', icon: '🏞️', size: [3, 3], cost: { clay: 6 }, req: ['home'], terraform: true, h: 10, cozy: 6,
    desc: 'Превращает площадку 3×3 в небольшой пруд: в нём можно рыбачить, рядом приятно сидеть, к нему можно поставить причал или ловушку.',
    draw(c) {},
  },
  {
    id: 'dock', name: 'Причал', cat: 'water', icon: '🌉', size: [3, 1], cost: { planks: 10, nails: 4, wood: 6 }, req: ['workbench'], flat: true, walk: true, dock: true, h: 24, cozy: 4,
    desc: 'Мостки в воду: отсюда можно рыбачить (улов лучше и быстрее) и просто сидеть, болтая ногами. Ставится на берегу и уходит в воду.',
    fishSpot: true, sit: { mood: 9, dur: 16 },
    draw(c, b) {
      const w = b.cw;
      box(c, 0, .12, 0, w, .76, 5, '#b98a5a', { tex: 'planks', texA: .2 });
      for (const x of [.1, w - .15]) for (const y of [.1, .8]) cyl(c, x + .03, y, -4, .05, 16, '#6e4a30');
    },
  },
  {
    id: 'fish_trap', name: 'Рыбная ловушка', cat: 'water', icon: '🪤', cost: { reeds: 8, sticks: 6, rope: 1 }, water: true, shore: true, h: 36, cozy: 0,
    desc: 'Плетёная корзина на мелководье: сама ловит рыбу, пока ты занят другими делами. Поставь рядом ящик — рыба будет складываться в него.',
    tags: ['producer'], out: { item: 'fish', every: 190, max: 5, label: 'рыба' },
    draw(c) { cyl(c, .5, .5, -3, .22, 24, '#b79054', { rings: [.25, .55, .85], ringCol: '#7a5a2e', top: '#6a4a24' }); },
    anim(c, b, t) { const [X, Y] = P(.5, .5, -1); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(X, Y, 18 + Math.sin(t * 2) * 2, 9, 0, 0, 7); c.stroke(); },
  },
]);
