import { reg } from './registry.js';
import { P, box, cyl, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean, flame, curve3, ribbon, glow } from '../../core/iso.js';
import { shade } from '../../core/util.js';

const busyBadge = (b) => (b.st.done > 0 ? '✨' : null);

reg([
  {
    id: 'workbench', name: 'Верстак', cat: 'craft', icon: '🔨', size: [2, 1], cost: { wood: 12, sticks: 6 }, h: 44, cozy: 1,
    desc: 'Главное рабочее место: доски, верёвка, гвозди и инструменты. С него начинается почти всё остальное.',
    station: 'workbench',
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .6 * w, .16);
      for (const x of [.1, w - .22]) { box(c, x, .12, 0, .12, .12, 18, '#6e4a30'); box(c, x, .76, 0, .12, .12, 18, '#6e4a30'); }
      box(c, .0, .06, 18, w, .88, 6, '#b98557', { tex: 'planks' });
      box(c, .12, .62, 24, .5, .1, 3, '#b0b4ba'); box(c, .7, .3, 24, .14, .5, 8, '#8a6440'); box(c, w - .5, .2, 24, .3, .26, 3, '#6b4328');
      line3(c, [1.1, .3, 25], [1.5, .55, 25], '#c9ccd2', 2.4);
    },
    anim(c, b, t) { if (b.st.cur) { const z = 30 + Math.abs(Math.sin(t * 7)) * 5; box(c, .88, .48, z, .04, .04, 7, '#6e4a30'); box(c, .8, .44, z + 6, .2, .12, 4, '#8c8f96'); } },
    badge: busyBadge,
  },
  {
    id: 'loom', name: 'Ткацкий станок', cat: 'craft', icon: '🧵', size: [2, 1], cost: { wood: 20, planks: 8, rope: 4 }, req: ['workbench'], h: 70, cozy: 2,
    desc: 'Ткань из волокна и тростника: пойдёт на постели, шторы, паруса мельницы и ковры.',
    station: 'loom',
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .6 * w, .16);
      for (const x of [.1, w - .2]) box(c, x, .3, 0, .1, .4, 54, '#8a6440');
      box(c, .05, .3, 54, w - .1, .4, 6, '#6e4a30'); box(c, .05, .3, 14, w - .1, .4, 5, '#6e4a30');
      for (let i = 0; i < 12; i++) { const x = .25 + i * (w - .5) / 11; line3(c, [x, .5, 18], [x, .5, 54], i % 3 ? '#e8d6b6' : '#d9a0a0', 1.2); }
      box(c, .3, .7, 0, w - .6, .25, 12, '#a9774a', { tex: 'planks' });
      box(c, .4, .35, 28, w - .8, .28, 8, '#d46a6a', { top: '#e08a8a' });
    },
    anim(c, b, t) { if (b.st.cur) { const x = .4 + (Math.sin(t * 4) * .5 + .5) * .8; box(c, x - .1, .44, 31, .2, .1, 4, '#6e4a30'); } },
    badge: busyBadge,
  },
  {
    id: 'quern', name: 'Жернова', cat: 'craft', icon: '⚙️', cost: { stone: 10, wood: 2 }, req: ['campfire'], h: 34, cozy: 0,
    desc: 'Ручная мельница: пшеница превращается в муку. Позже её заменит ветряная мельница.',
    station: 'quern',
    draw(c) { shadow(c, .5, .5, .36, .16); cyl(c, .5, .5, 0, .32, 8, '#a2a5ac', { top: '#bfc1c6' }); cyl(c, .5, .5, 8, .27, 6, '#b0b2b8', { top: '#cfd1d6' }); line3(c, [.65, .5, 14], [.65, .5, 26], '#7b5535', 2.6); },
    anim(c, b, t) { if (b.st.cur) box(c, .5 + Math.cos(t * 3) * .12 - .03, .5 + Math.sin(t * 3) * .12 - .03, 22, .06, .06, 12, '#8a6440'); },
    badge: busyBadge,
  },
  {
    id: 'kiln', name: 'Обжиговая печь', cat: 'craft', icon: '🏺', size: [2, 2], cost: { stone: 24, clay: 12 }, req: ['workbench'], h: 100, cozy: 1,
    desc: 'Кирпичи, стекло, горшки и древесный уголь. Нужны дрова.',
    station: 'kiln',
    draw(c) {
      shadow(c, 1, 1, .9, .22);
      box(c, .2, .2, 0, 1.6, 1.6, 22, '#a8553f', { tex: 'brick' });
      blob(c, 1, 1, 30, 40, 24, '#b8634a'); box(c, 1.3, 1.3, 30, .3, .3, 40, '#8d8f95', { tex: 'stone' });
      wallRect(c, 'L', 1.8, .6, 1.4, 4, 18, '#2a1a14', '#6e3a2c');
    },
    anim(c, b, t) { if (b.st.cur) { blob(c, 1, 1.8, 6, 14, 5, 'rgba(255,170,60,.85)'); flame(c, 1, 1.8, 6, 7, t, 3); for (let i = 0; i < 3; i++) { const k = (t * .5 + i / 3) % 1; blob(c, 1.45 + k * 6 / 64, 1.45 - k * 6 / 64, 72 + k * 30, 4 + k * 5, 4 + k * 5, `rgba(200,200,200,${(.4 * (1 - k) * .6).toFixed(3)})`); } } },
    badge: busyBadge,
  },
  {
    id: 'oven', name: 'Хлебная печь', cat: 'craft', icon: '🥖', size: [2, 2], cost: { bricks: 20, clay: 6, stone: 6 }, req: ['kiln'], h: 90, cozy: 3,
    desc: 'Дровяная печь: хлеб, пироги, пицца и торт. Хлеб без муки не испечёшь — пора сажать пшеницу!',
    station: 'oven',
    draw(c) {
      shadow(c, 1, 1, .9, .22);
      box(c, .2, .2, 0, 1.6, 1.6, 20, '#b8704f', { tex: 'brick' });
      blob(c, 1, 1, 28, 38, 22, '#c9805a'); wallRect(c, 'L', 1.8, .5, 1.5, 6, 20, '#241812', '#7a4a34');
      box(c, 1.35, .3, 20, .26, .26, 46, '#8d8f95', { tex: 'brick' });
    },
    anim(c, b, t) { if (b.st.cur) { blob(c, 1, 1.8, 10, 18, 7, 'rgba(255,160,50,.9)'); flame(c, 1, 1.8, 8, 6, t, 5); } },
    badge: busyBadge,
  },
  {
    id: 'smoker', name: 'Коптильня', cat: 'craft', icon: '💨', size: [1, 1], cost: { planks: 6, wood: 6, stone: 4 }, req: ['kiln'], h: 80, cozy: 1,
    desc: 'Копчёная рыба — сытная и вкусная.',
    station: 'smoker',
    draw(c) {
      shadow(c, .5, .5, .36, .16);
      box(c, .15, .15, 0, .7, .7, 50, '#8a6440', { tex: 'planks' });
      wallRect(c, 'L', .85, .25, .75, 6, 32, '#3a2a22', '#6b4328'); line3(c, [.5, .85, 6], [.5, .85, 32], '#2a1a14', 1.2);
      box(c, .3, .3, 50, .4, .4, 10, '#6b6f78'); box(c, .4, .4, 60, .2, .2, 10, '#6b6f78');
    },
    anim(c, b, t) { if (b.st.cur) for (let i = 0; i < 4; i++) { const k = (t * .4 + i / 4) % 1, dx = Math.sin(k * 5 + i) * 4; blob(c, .5 + dx / 64, .5 - dx / 64, 72 + k * 34, 3 + k * 5, 3 + k * 5, `rgba(210,210,210,${(.5 * (1 - k) * .7).toFixed(3)})`); } },
    badge: busyBadge,
  },
  {
    id: 'ferment', name: 'Бродильная бочка', cat: 'craft', icon: '🫙', cost: { planks: 8, rope: 2 }, req: ['workbench'], h: 50, cozy: 1,
    desc: 'Квашеная капуста и сыр — медленно, но вкусно. Рядом с погребом, в прохладе, бродит вдвое быстрее.',
    station: 'ferment',
    draw(c) { shadow(c, .5, .5, .38, .16); cyl(c, .5, .5, 0, .34, 30, '#b08558', { rings: [.2, .55, .85], ringCol: '#5a4a38', top: '#e8dcc4' }); cyl(c, .5, .5, 30, .26, 3, '#a2a5ac', { top: '#c2c5cb' }); },
    badge: busyBadge,
  },
  {
    id: 'easel', name: 'Мольберт', cat: 'craft', icon: '🎨', cost: { wood: 4, cloth: 1, sticks: 4 }, req: ['workbench'], h: 74, cozy: 3,
    desc: 'Рисовать картины для стен дома. Рисование радует: настроение растёт.',
    station: 'easel',
    draw(c, b) {
      shadow(c, .5, .5, .32, .14);
      line3(c, [.3, .5, 0], [.45, .5, 56], '#8a6440', 3); line3(c, [.7, .5, 0], [.55, .5, 56], '#8a6440', 3); line3(c, [.5, .75, 0], [.5, .55, 50], '#8a6440', 3);
      box(c, .22, .44, 22, .56, .06, 30, '#f4ead2', { top: '#fff' });
      box(c, .3, .5, 28, .4, .02, 22, '#7ec0e0'); blob(c, .62, .52, 44, 3.4, 3.4, '#f4b860'); poly(c, [P(.3, .53, 28), P(.5, .53, 38), P(.7, .53, 28)], '#6aa655');
    },
    anim(c, b, t) { if (b.st.cur) box(c, .88, .58, 28 + Math.sin(t * 5) * 3, .04, .04, 8, '#e8584a'); },
    badge: busyBadge,
  },
  {
    id: 'outdoor_kitchen', name: 'Уличная кухня', cat: 'craft', icon: '🍳', size: [2, 1], cost: { bricks: 10, planks: 8, scrap: 4 }, req: ['oven'], h: 70, cozy: 4,
    desc: 'Плита с рабочей поверхностью под открытым небом: омлеты, блины, салаты, варенье и рагу. Рядом бак с водой — и никакого ведра.',
    station: 'stove', tags: ['heat_station'],
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .62 * w, .16);
      box(c, 0, .1, 0, w, .8, 20, '#c9ccd2', { tex: 'brick', texA: .06 });
      box(c, .06, .08, 20, w * .5, .84, 4, '#3c3f45'); for (const [x, y] of [[.3, .35], [.3, .7], [.7, .35], [.7, .7]]) cyl(c, x * w * .5 + .06, y, 24, .13, .8, '#1e2024');
      box(c, w * .55 + .06, .08, 20, w * .4, .84, 4, '#b98557', { tex: 'planks' });
      box(c, w - .35, .15, 24, .22, .22, 26, '#6b6f78');
    },
    anim(c, b, t) { if (b.st.cur) { flame(c, .6, .5, 26, 3.5, t, 1); flame(c, .6, .8, 26, 3, t, 4); } },
    badge: busyBadge,
  },
]);
