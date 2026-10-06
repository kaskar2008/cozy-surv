import { reg } from './registry.js';
import { P, box, cyl, cone, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean, flame, curve3, ribbon, glow } from '../../core/iso.js';
import { shade, hash2 } from '../../core/util.js';

const pathBase = (c, b, col, spots, round = .16) => plane(c, 0, (g) => {
  g.fillStyle = col; g.beginPath(); g.roundRect(.02, .02, .96, .96, round); g.fill();
});
const DIRS = [[.5, 0], [1, .5], [.5, 1], [0, .5]];

reg([
  // ---------- дорожки ----------
  {
    id: 'path_dirt', name: 'Тропинка', cat: 'decor', icon: '🟫', cost: {}, flat: true, walk: true, drag: true, speed: 1.2, cozy: 0.2, h: 4, norot: true,
    desc: 'Утоптанная земля. Бесплатная дорожка — по ней ходить быстрее. Протяни, чтобы проложить.',
    key: (b) => b.v % 4,
    draw(c, b) { pathBase(c, b, '#b99b6e'); plane(c, 0, (g) => { g.fillStyle = '#a78a5f'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(.15 + hash2(b.v, i, 1) * .7, .15 + hash2(b.v, i, 2) * .7, .05, .03, 0, 0, 7); g.fill(); } }); },
  },
  {
    id: 'path_sand', name: 'Песчаная дорожка', cat: 'decor', icon: '🟨', cost: { sand: 1 }, flat: true, walk: true, drag: true, speed: 1.2, cozy: 0.3, h: 4, norot: true,
    desc: 'Светлый песок, мягко и красиво.',
    key: (b) => b.v % 4,
    draw(c, b) { pathBase(c, b, '#ecd8a2'); plane(c, 0, (g) => { g.fillStyle = '#d9c28a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(.12 + hash2(b.v, i, 3) * .76, .12 + hash2(b.v, i, 4) * .76, .018, 0, 7); g.fill(); } }); },
  },
  {
    id: 'path_cobble', name: 'Каменная дорожка', cat: 'decor', icon: '⬜', cost: { stone: 1 }, flat: true, walk: true, drag: true, speed: 1.35, cozy: 0.5, h: 4, norot: true,
    desc: 'Булыжная мостовая: быстро и надёжно.',
    key: (b) => b.v % 4,
    draw(c, b) { pathBase(c, b, '#8d8a85'); plane(c, 0, (g) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = shade('#b4b2ad', (hash2(b.v + i, j, 5) - .5) * .2); g.beginPath(); g.roundRect(.07 + i * .46, .07 + j * .46, .4, .4, .08); g.fill(); } }); },
  },
  {
    id: 'path_wood', name: 'Деревянный настил', cat: 'decor', icon: '🟧', cost: { planks: 1 }, req: ['workbench'], flat: true, walk: true, drag: true, speed: 1.3, cozy: 0.5, h: 4, norot: true,
    desc: 'Дощатый настил — тёплый и аккуратный.',
    key: (b) => b.v % 3,
    draw(c, b) { plane(c, 0, (g) => { for (let i = 0; i < 4; i++) { g.fillStyle = shade('#c08a58', (hash2(b.v, i, 6) - .5) * .18); g.fillRect(.03, .03 + i * .24, .94, .21); } }); },
  },
  // ---------- ограды ----------
  {
    id: 'fence', name: 'Забор', cat: 'decor', icon: '🚧', cost: { sticks: 3 }, drag: true, norot: true, strand: 'fence', cozy: 0.4, h: 36,
    desc: 'Плетень из хвороста. Соединяется с соседними секциями. Хороший двор — это ещё и уют.',
    key: (b) => b.mask || 0,
    draw(c, b) {
      const m = b.mask || 0;
      DIRS.forEach((p, i) => { if (m & (1 << i)) { for (const z of [7, 15]) line3(c, [.5, .5, z], [p[0], p[1], z], '#a9774a', 3); } });
      box(c, .43, .43, 0, .14, .14, 22, '#8a6440');
    },
  },
  {
    id: 'gate', name: 'Калитка', cat: 'decor', icon: '🚪', cost: { planks: 2, nails: 1 }, req: ['workbench'], norot: true, walk: true, strand: 'fence', cozy: 0.8, h: 40,
    desc: 'Проход в заборе.',
    key: (b) => b.mask || 0,
    draw(c, b) {
      const m = b.mask || 0;
      DIRS.forEach((p, i) => { if (m & (1 << i)) { for (const z of [7, 15]) line3(c, [.5, .5, z], [p[0], p[1], z], '#a9774a', 3); } });
      const ew = (m & 5) ? 'y' : 'x';
      const a = ew === 'y' ? [.5, .15] : [.15, .5], e = ew === 'y' ? [.5, .85] : [.85, .5];
      for (const p of [a, e]) box(c, p[0] - .06, p[1] - .06, 0, .12, .12, 28, '#6e4a30');
      for (const z of [8, 16, 24]) line3(c, [a[0], a[1], z], [e[0], e[1], z], '#c08a58', 2.4);
    },
  },
  {
    id: 'hedge', name: 'Живая изгородь', cat: 'decor', icon: '🌿', cost: { fiber: 3, sticks: 2 }, drag: true, norot: true, strand: 'hedge', cozy: 0.8, h: 40,
    desc: 'Аккуратная зелёная изгородь.',
    key: (b, o) => `${b.mask || 0}|${o.season}`,
    draw(c, b, o) {
      const col = shade(['#6fbd55', '#58a846', '#a89a3c', '#7fa88a'][o.season], 0), m = b.mask || 0;
      shadow(c, .5, .5, .4, .14);
      DIRS.forEach((p, i) => { if (m & (1 << i)) for (const t of [.5, .8]) blob(c, .5 + (p[0] - .5) * t, .5 + (p[1] - .5) * t, 11, 13, 10, col); });
      blob(c, .5, .5, 12, 15, 12, shade(col, .05));
      if (o.season === 3) { c.save(); blob(c, .5, .5, 22, 11, 4, '#f4f8fa', { lo: '#cfdde3' }); c.restore(); }
    },
  },
  // ---------- декор ----------
  {
    id: 'mailbox', name: 'Почтовый ящик', cat: 'decor', icon: '📬', cost: { planks: 3, scrap: 1 }, req: ['workbench'], h: 60, cozy: 2,
    desc: 'Иногда в нём появляются письма от далёких друзей — с тёплыми словами, а то и с подарками.',
    tags: ['mailbox'], badge: (b) => (b.st.letter ? '✉️' : null),
    draw(c) {
      shadow(c, .5, .5, .2, .14); box(c, .44, .44, 0, .12, .12, 26, '#8a6440');
      box(c, .28, .3, 26, .44, .4, 14, '#3f6fb0'); blob(c, .5, .5, 40, 11, 5, '#3f6fb0');
      line3(c, [.74, .4, 30], [.74, .4, 44], '#d9402a', 2);
    },
  },
  {
    id: 'birdhouse', name: 'Скворечник', cat: 'decor', icon: '🐦', cost: { planks: 2, sticks: 3 }, req: ['workbench'], h: 80, cozy: 3,
    desc: 'Сюда прилетают птицы — щебечут и радуют.',
    draw(c) { shadow(c, .5, .5, .14, .14); cyl(c, .5, .5, 0, .04, 46, '#7b5535'); box(c, .32, .32, 46, .36, .36, 18, '#e0b87a', { tex: 'planks' }); pyramid(c, .26, .26, 64, .48, .48, 12, .04, '#b0603c'); wallRect(c, 'L', .68, .44, .56, 50, 58, '#2a1a10'); },
    anim(c, b, t) { const k = (t * .12 + b.v * .13) % 1; if (k < .35) { const z = 70 + Math.sin(k * 20) * 3; blob(c, .5 + 10 / 64, .5 - 10 / 64, z, 4.5, 3, '#6b8fd0'); blob(c, .5 + 15 / 64, .5 - 15 / 64, z, 2, 1.4, '#e8c860'); } },
  },
  {
    id: 'windchime', name: 'Ветряные колокольчики', cat: 'decor', icon: '🎐', cost: { shell: 3, rope: 1, sticks: 2 }, h: 80, cozy: 3,
    desc: 'Ракушки на ниточках тихо звенят на ветру.',
    draw(c) { shadow(c, .5, .5, .12, .14); cyl(c, .5, .5, 0, .035, 50, '#7b5535'); line3(c, [.5, .5, 50], [.78, .5, 46], '#7b5535', 2.4); },
    anim(c, b, t) { const sw = Math.sin(t * 1.7 + b.v) * 3; for (let i = 0; i < 4; i++) { const t0 = (i - 1.5) * 3, dx = (i - 1.5) * 4 + sw, L = 10 + (i % 2) * 6; line3(c, [.78 + t0 / 64, .5 - t0 / 64, 46], [.78 + dx / 64, .5 - dx / 64, 46 - L], '#e8e0d0', 1); blob(c, .78 + dx / 64, .5 - dx / 64, 46 - L - 2, 2.6, 3.4, ['#f3c6c0', '#f0e0c8', '#d6c8f0', '#c8e6f0'][i]); } },
  },
  {
    id: 'pinwheel', name: 'Вертушка', cat: 'decor', icon: '🎡', cost: { sticks: 2, cloth: 1 }, h: 60, cozy: 2, drag: true,
    desc: 'Яркая вертушка крутится на ветру.',
    draw(c) { shadow(c, .5, .5, .1, .12); cyl(c, .5, .5, 0, .025, 34, '#7b5535'); },
    anim(c, b, t) {
      const K = 1 / 45.25 * Math.SQRT1_2, cols = ['#e8584a', '#f5d34a', '#4a9ae8', '#6fc47a'], th0 = t * 2.2 + b.v;
      const pt = (u, v, th) => P(.5 + (u * Math.cos(th) - v * Math.sin(th)) * K, .5 - (u * Math.cos(th) - v * Math.sin(th)) * K, 38 + u * Math.sin(th) + v * Math.cos(th));
      for (let i = 0; i < 4; i++) { const th = th0 + i * Math.PI / 2; poly(c, [pt(0, 0, th), pt(10, 0, th), pt(10, 9, th)], cols[i]); }
      blob(c, .5 + .06, .5 - .06, 38, 1.8, 1.8, '#ffffff');
    },
  },
  {
    id: 'statue', name: 'Каменный кот', cat: 'decor', icon: '🗿', cost: { stone: 20, clay: 2 }, req: ['workbench'], h: 70, cozy: 5,
    desc: 'Статуя довольного кота на постаменте. Приносит удачу (и немного уюта).',
    draw(c) { shadow(c, .5, .5, .3, .16); box(c, .24, .24, 0, .52, .52, 12, '#a2a5ac', { tex: 'stone' }); blob(c, .5, .5, 22, 13, 11, '#bfc1c6'); blob(c, .5, .5, 36, 9, 8, '#c9cbd0'); poly(c, [P(.4, .5, 42), P(.44, .5, 50), P(.5, .5, 43)], '#c9cbd0'); poly(c, [P(.6, .5, 42), P(.56, .5, 50), P(.5, .5, 43)], '#c9cbd0'); blob(c, .453, .667, 37, 1.5, 1.5, '#3a3a40'); blob(c, .547, .573, 37, 1.5, 1.5, '#3a3a40'); },
  },
  {
    id: 'gnome', name: 'Садовый гном', cat: 'decor', icon: '🧙', cost: { clay: 4, cloth: 1 }, h: 50, cozy: 3,
    desc: 'Глиняный гном с хитрой улыбкой. Охраняет сад — по крайней мере, он так считает.',
    draw(c) { shadow(c, .5, .5, .16, .14); cyl(c, .5, .5, 0, .13, 16, '#3f6fb0'); blob(c, .5, .5, 20, 8, 8, '#f0d4a0'); blob(c, .5, .55, 14, 8, 6, '#f4f4f4'); cone(c, .5, .5, 24, .12, 20, '#d9402a'); blob(c, .45, .6, 21, 1.4, 1.4, '#3a2a22'); blob(c, .53, .52, 21, 1.4, 1.4, '#3a2a22'); },
  },
  {
    id: 'arch', name: 'Арка с цветами', cat: 'decor', icon: '🌹', cost: { planks: 6, rope: 2, flowers: 3 }, req: ['workbench'], walk: true, h: 90, cozy: 5,
    desc: 'Увитая цветами арка — под ней можно пройти. Идеально для входа во двор или на тропинку.',
    draw(c, b, o) {
      shadow(c, .5, .5, .4, .1);
      for (const y of [.12, .88]) { box(c, .44, y - .05, 0, .1, .1, 64, '#c9a578'); }
      for (let i = 0; i < 6; i++) { const t = i / 5, y = .12 + .76 * t, z = 62 + Math.sin(t * Math.PI) * 14; line3(c, [.5, y - .08, z - 4], [.5, y + .08, z], '#c9a578', 3); }
      const cols = ['#f08ac0', '#f5d34a', '#ffffff', '#e8584a'];
      for (let i = 0; i < 14; i++) { const t = (i + .5) / 14, y = .12 + .76 * t, z = 62 + Math.sin(t * Math.PI) * 14 + (i % 3) * 3 - 3; blob(c, .5, y, z, 5, 4, '#6aa655'); if (o.season < 3) blob(c, .53, y, z + 3, 2.6, 2.6, cols[i % 4]); }
    },
    key: (b, o) => o.season,
  },
  {
    id: 'signpost', name: 'Указатель', cat: 'decor', icon: '🪧', cost: { planks: 2, nails: 1 }, req: ['workbench'], h: 70, cozy: 1,
    desc: 'Деревянные стрелки в никуда — и ко всему сразу.',
    draw(c) { shadow(c, .5, .5, .12, .12); cyl(c, .5, .5, 0, .04, 48, '#7b5535'); const K = 1 / 45.25 * Math.SQRT1_2; for (const [z, dx, col] of [[38, 1, '#c9915f'], [28, -1, '#b98557']]) { const w = 24 * dx; line3(c, [.5, .5, z], [.5 + w * K, .5 - w * K, z], col, 10); } },
  },
  {
    id: 'snowman', name: 'Снеговик', cat: 'decor', icon: '⛄', cost: {}, seasons: [3], h: 76, cozy: 4,
    desc: 'Лепится только зимой (бесплатно!) и тает с приходом весны. Бесценная часть зимнего уюта.',
    draw(c) {
      shadow(c, .5, .5, .3, .14); blob(c, .5, .5, 11, 15, 11, '#f4f8fa', { lo: '#cfdde3' }); blob(c, .5, .5, 29, 11, 9, '#f4f8fa', { lo: '#cfdde3' }); blob(c, .5, .5, 44, 8, 7, '#f4f8fa', { lo: '#cfdde3' });
      cyl(c, .5, .5, 50, .17, 3, '#2a2a30'); cyl(c, .5, .5, 53, .1, 8, '#2a2a30');
      line3(c, [.56, .56, 45], [.7, .7, 43], '#f08a3c', 3.6); blob(c, .46, .58, 47, 1.5, 1.5, '#2a2a30'); blob(c, .58, .46, 47, 1.5, 1.5, '#2a2a30');
      for (const z of [30, 22]) blob(c, .6, .6, z, 1.5, 1.5, '#2a2a30');
      line3(c, [.28, .5, 32], [.1, .5, 40], '#6e4a30', 1.8); line3(c, [.72, .5, 32], [.9, .5, 40], '#6e4a30', 1.8);
    },
  },
  {
    id: 'cat_house', name: 'Кошкин дом', cat: 'decor', icon: '🐈', cost: { wood: 8, cloth: 2 }, req: ['home'], h: 50, cozy: 3,
    desc: 'Маленький домик. Рано или поздно в нём поселится кот, который будет бродить по лагерю, греться у костра и требовать почёсываний.',
    pet: 'cat', badge: (b) => (b.st.sleeping ? '💤' : null),
    draw(c) { shadow(c, .5, .5, .34, .16); box(c, .16, .16, 0, .68, .68, 24, '#d9a066', { tex: 'planks' }); gable(c, .08, .08, 24, .84, .84, 16, .08, '#a5503e', '#d9a066', 'y'); wallRect(c, 'L', .84, .38, .62, 0, 16, '#2a1a10'); blob(c, .5, .5, 3, 8, 3, '#e8c88a'); },
  },
  {
    id: 'dog_house', name: 'Собачья будка', cat: 'decor', icon: '🐕', cost: { planks: 6, wood: 6, cloth: 2 }, req: ['home'], h: 60, cozy: 3,
    desc: 'Будка для верного друга. Пёс будет сопровождать тебя по лагерю.',
    pet: 'dog', badge: (b) => (b.st.sleeping ? '💤' : null),
    draw(c) { shadow(c, .5, .5, .4, .16); box(c, .12, .12, 0, .76, .76, 28, '#6f8fb8', { tex: 'planks' }); gable(c, .04, .04, 28, .92, .92, 20, .08, '#a5503e', '#6f8fb8', 'y'); wallRect(c, 'L', .88, .36, .64, 0, 20, '#1c1612'); },
  },
  // ---------- свет ----------
  {
    id: 'lantern', name: 'Фонарик со свечой', cat: 'light', icon: '🏮', cost: { wax: 2, glass: 1, sticks: 2 }, req: ['kiln'], h: 60, cozy: 3, drag: true,
    desc: 'Стеклянный фонарь со свечой: зажигается в сумерках сам и светит тёплым светом. Без проводов.',
    light: { r: 3.6, col: '#ffbf66', on: 'dusk', flick: 1 },
    draw(c) { shadow(c, .5, .5, .14, .14); cyl(c, .5, .5, 0, .05, 22, '#5a4a3a'); box(c, .38, .38, 22, .24, .24, 16, '#d8eef6', { top: '#fff', left: 'rgba(210,235,245,.8)', right: 'rgba(160,200,220,.8)' }); box(c, .34, .34, 38, .32, .32, 3, '#3a3a40'); },
    anim(c, b, t, o) { if (o.dusk) { flame(c, .5, .5, 25, 3.4, t, b.id); } },
  },
  {
    id: 'paper_lantern', name: 'Бумажный фонарик', cat: 'light', icon: '🎑', cost: { cloth: 2, wood: 2, wax: 1 }, req: ['workbench'], h: 90, cozy: 4, drag: true,
    desc: 'Красный бумажный фонарь на шесте. Мягкий уютный свет.',
    light: { r: 3.8, col: '#ff8a5a', on: 'dusk', flick: .5 },
    draw(c) { shadow(c, .5, .5, .12, .14); cyl(c, .5, .5, 0, .035, 64, '#7b5535'); line3(c, [.5, .5, 64], [.68, .5, 64], '#7b5535', 2.4); blob(c, .68, .5, 52, 8, 10, '#e8584a'); blob(c, .66, .52, 54, 4, 6, '#f08a6a'); cyl(c, .68, .5, 61, .1, 2, '#3a2a22'); cyl(c, .68, .5, 41, .1, 2, '#3a2a22'); },
    anim(c, b, t, o) { if (o.dusk) glow(c, .68, .5, 52, 9, `rgba(255,220,140,${(.5 + .2 * Math.sin(t * 3)).toFixed(3)})`); },
  },
  {
    id: 'stone_lantern', name: 'Каменный фонарь', cat: 'light', icon: '⛩️', cost: { stone: 8, wax: 1 }, req: ['workbench'], h: 70, cozy: 4,
    desc: 'Японский каменный фонарь: спокойный, ровный свет и ощущение дзена.',
    light: { r: 3.8, col: '#ffcf80', on: 'dusk', flick: .5 },
    draw(c) { shadow(c, .5, .5, .26, .16); cyl(c, .5, .5, 0, .2, 6, '#a2a5ac'); cyl(c, .5, .5, 6, .08, 14, '#b4b6bd'); box(c, .34, .34, 20, .32, .32, 14, '#c2c4c9'); cyl(c, .5, .5, 34, .3, 5, '#a2a5ac', { top: '#bfc1c6' }); blob(c, .5, .5, 42, 8, 5, '#b4b6bd'); },
    anim(c, b, t, o) { if (o.dusk) glow(c, .5, .5, 27, 8, `rgba(255,215,130,${(.8 + .15 * Math.sin(t * 3)).toFixed(3)})`); },
  },
]);

reg([
  {
    id: 'sunflowers', name: 'Подсолнухи', cat: 'decor', icon: '🌻', cost: { flowers: 3, sticks: 2 }, h: 70, cozy: 3, drag: true,
    desc: 'Высокие подсолнухи тянутся к солнцу. Пчёлы их обожают.',
    tags: ['flowerpatch'], key: (b, o) => `${b.v % 3}|${o.season === 3 ? 1 : 0}`,
    draw(c, b, o) {
      shadow(c, .5, .5, .34, .12);
      const pts = [[.3, .35, 52], [.68, .3, 60], [.5, .62, 56], [.25, .72, 46], [.75, .7, 50]];
      for (const [x, y, hh] of pts) {
        line3(c, [x, y, 0], [x, y, hh], o.season === 3 ? '#9a8a6a' : '#5da84e', 2.6);
        blob(c, x - 5 / 64, y + 5 / 64, hh * .45, 5, 2.6, o.season === 3 ? '#8aa07a' : '#6aae56');
        if (o.season === 3) continue;
        for (let i = 0; i < 10; i++) { const a = i * .628; blob(c, x + Math.cos(a) * 6 / 64 + .03, y - Math.cos(a) * 6 / 64 + .03, hh - Math.sin(a) * 6, 3.4, 2.6, '#f5c42a'); }
        blob(c, x + .04, y + .04, hh, 4.2, 4.2, '#6a4a2a');
      }
    },
  },
  {
    id: 'lavender', name: 'Лаванда', cat: 'decor', icon: '💜', cost: { flowers: 3, fiber: 1 }, h: 40, cozy: 3, drag: true,
    desc: 'Ряды душистой лаванды. Пахнет летом.',
    tags: ['flowerpatch'], key: (b, o) => String(o.season === 3 ? 1 : 0),
    draw(c, b, o) {
      shadow(c, .5, .5, .38, .1);
      for (const y of [.28, .5, .72]) for (let i = 0; i < 4; i++) {
        const X = .18 + i * .22;
        for (const dx of [-2, 0, 2]) line3(c, [X, y, 0], [X + dx * 1.6 / 64, y - dx * 1.6 / 64, 10], o.season === 3 ? '#a0a08a' : '#7aa860', 1.8);
        if (o.season === 3) continue;
        for (const dx of [-2, 0, 2]) blob(c, X + dx * 1.6 / 64, y - dx * 1.6 / 64, 14, 1.8, 4.6, '#9a7ad8');
      }
    },
  },
  {
    id: 'book_box', name: 'Книжный ящик', cat: 'decor', icon: '📚', cost: { planks: 3, glass: 1, nails: 1 }, req: ['workbench'], h: 70, cozy: 3,
    desc: 'Маленькая библиотека на столбе: берёшь книгу — оставляешь книгу. Можно полистать на свежем воздухе.',
    sit: { mood: 9, dur: 14, label: '📖 Полистать книги' },
    draw(c) {
      shadow(c, .5, .5, .18, .14); box(c, .46, .46, 0, .08, .08, 34, '#7b5535');
      box(c, .26, .3, 34, .48, .4, 26, '#c9915f', { tex: 'planks', texA: .08 }); box(c, .3, .7, 38, .4, .02, 18, 'rgba(210,235,245,.7)');
      gableLike(c);
    },
  },
  {
    id: 'bird_feeder', name: 'Кормушка для птиц', cat: 'decor', icon: '🐤', cost: { planks: 2, sticks: 2 }, req: ['workbench'], h: 76, cozy: 3,
    desc: 'Птички слетаются клевать зёрнышки — особенно зимой. Приятно наблюдать.',
    draw(c) { shadow(c, .5, .5, .14, .12); cyl(c, .5, .5, 0, .04, 42, '#7b5535'); box(c, .3, .3, 42, .4, .4, 3, '#c9915f'); box(c, .3, .3, 45, .4, .04, 4, '#a9774a'); box(c, .3, .66, 45, .4, .04, 4, '#a9774a'); box(c, .35, .35, 45, .3, .3, 1.4, '#e6c45a'); },
    anim(c, b, t) {
      for (let i = 0; i < 2; i++) { const k = (t * .35 + b.v * .17 + i * .5) % 1, vis = k < .6; if (!vis) continue; const x = .4 + i * .25, z = 52 + Math.abs(Math.sin(t * 8 + i * 2)) * (k > .5 ? 6 : 1); blob(c, x, .5, z, 4.4, 3.2, ['#6b8fd0', '#e8a05a'][i]); blob(c, x + 4.6 / 64, .5 - 4.6 / 64, z, 2, 1.4, '#e8c860'); blob(c, x + 2.4 / 64, .5 - 2.4 / 64, z + 1.4, 1, 1, '#2a1e1e'); }
    },
  },
  {
    id: 'rowboat', name: 'Лодка', cat: 'decor', icon: '🛶', size: [2, 1], cost: { planks: 8, nails: 2, rope: 1 }, req: ['workbench'], water: true, shore: true, h: 40, cozy: 4,
    desc: 'Деревянная лодка у берега. Покачивается на воде — выглядит очень умиротворённо.',
    draw(c, b) {
      const w = b.cw;
      box(c, .22, .24, 1, w - .44, .52, 3, '#7a5233');
      box(c, .12, .3, 4, w - .24, .06, 10, '#9a6a44'); box(c, .12, .64, 4, w - .24, .06, 10, '#9a6a44');
      box(c, .1, .3, 4, .06, .4, 10, '#8a5a38'); box(c, w - .16, .3, 4, .06, .4, 10, '#8a5a38');
      box(c, .5, .3, 9, .12, .4, 2.4, '#b98557'); box(c, w - .8, .3, 9, .12, .4, 2.4, '#b98557');
      line3(c, [.7, .5, 8], [1.5, .6, 26], '#c9a578', 2.4);
    },
    anim(c, b, t) { cyl(c, b.cw / 2, .5, -2, (34 + Math.sin(t * 1.5) * 2) / 45.25 * 1.2, .5, 'rgba(255,255,255,.28)'); },
  },
]);
function gableLike(c) { poly(c, [P(.22, .26, 60), P(.82, .26, 60), P(.82, .78, 60), P(.22, .78, 60)], '#a5503e', '#8a3e30', 1); poly(c, [P(.22, .78, 60), P(.82, .78, 60), P(.52, .78, 70)], '#8a3e30'); }
