import { reg } from './registry.js';
import { P, box, cyl, cone, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean } from '../../core/iso.js';
import { shade } from '../../core/util.js';

const WIN = '#bfe6f2', WOOD = '#6b4328';
function windowGlow(c, side, pos, u0, u1, z0, z1) { wallRect(c, side, pos, u0, u1, z0, z1, '#ffd27a'); }

reg([
  {
    id: 'home', name: 'Палатка', cat: 'home', icon: '⛺', size: [2, 2], cost: { sticks: 10, fiber: 14 }, h: 130,
    desc: 'Твой дом. Внутри можно расставлять мебель и спать. Начни с палатки — позже её можно улучшить до хижины и дома.',
    tags: ['home'], cozy: 0,
    net: { water: { cap: 0, leaf: true }, power: { cap: 0, leaf: true } },
    home: { levels: [
      { name: 'Палатка', size: [2, 2], int: [4, 4] },
      { name: 'Хижина', size: [3, 3], int: [6, 6], cost: { wood: 30, planks: 10, nails: 6, cloth: 2 } },
      { name: 'Дом', size: [4, 4], int: [8, 7], cost: { planks: 30, bricks: 15, glass: 6, nails: 12, cloth: 6 } },
    ] },
    key: (b) => 'L' + b.lvl,
    draw(c, b) {
      const w = b.cw, d = b.cd;
      shadow(c, w / 2, d / 2, .62 * w, .22);
      if (b.lvl === 1) {
        plane(c, 0, (g) => { g.fillStyle = '#8a6a48'; g.beginPath(); g.roundRect(.08, .08, 1.84, 1.84, .1); g.fill(); });
        pyramid(c, .1, .1, 0, 1.8, 1.8, 56, .08, '#d9b878');
        poly(c, [P(.62, 1.98, 0), P(1.38, 1.98, 0), P(1, 1.34, 38)], '#3a2a22');
        poly(c, [P(.7, 1.98, 0), P(1.3, 1.98, 0), P(1, 1.46, 32)], '#241a16');
        line3(c, [1, 1, 56], [1, 1, 70], '#7b5535', 2.6);
        poly(c, [P(1, 1, 70), P(1, 1, 62), P(1.45, 1.1, 66)], '#e0584a');
        line3(c, [.1, 2, 0], [.1, 2.3, 0], '#7b5535', 2);
      } else if (b.lvl === 2) {
        box(c, .05, .05, 0, 2.9, 2.9, 7, '#8d8f95', { tex: 'stone' });
        box(c, .1, .1, 7, 2.8, 2.8, 38, '#b98557', { tex: 'logs' });
        wallRect(c, 'L', 2.9, 1.15, 1.85, 7, 33, WOOD, '#4a2c18');
        for (const [a, bb] of [[.3, .85], [2.1, 2.65]]) wallRect(c, 'L', 2.9, a, bb, 20, 36, WIN, WOOD);
        for (const [a, bb] of [[.5, 1.1], [1.8, 2.4]]) wallRect(c, 'R', 2.9, a, bb, 20, 36, WIN, WOOD);
        box(c, 1.05, 2.9, 0, .9, .35, 3, '#a9876a');
        gable(c, -.06, -.06, 45, 3.12, 3.12, 36, .22, '#a5503e', '#c79a6a', 'x');
      } else {
        box(c, .05, .05, 0, 3.9, 3.9, 10, '#8d8f95', { tex: 'stone' });
        box(c, .1, .1, 10, 3.8, 3.8, 42, '#e8d6b6');
        for (const [x, y] of [[.1, 3.78], [3.78, 3.78], [3.78, .1]]) box(c, x, y, 10, .14, .14, 42, '#7b5535');
        wallRect(c, 'L', 3.9, 1.6, 2.4, 10, 36, WOOD, '#4a2c18');
        for (const [a, bb] of [[.4, 1.1], [2.9, 3.6]]) { wallRect(c, 'L', 3.9, a, bb, 22, 40, WIN, WOOD); wallRect(c, 'L', 3.9, a - .05, bb + .05, 18, 22, '#7b5535'); }
        for (const [a, bb] of [[.5, 1.2], [1.6, 2.3], [2.7, 3.4]]) wallRect(c, 'R', 3.9, a, bb, 22, 40, WIN, WOOD);
        box(c, 1.4, 3.9, 0, 1.2, .5, 4, '#a9876a');
        gable(c, -.14, -.14, 52, 4.28, 4.28, 44, .26, '#9c3f3a', '#e8d6b6', 'x');
        // мансардное окно
        poly(c, [P(1.6, 4.05, 66), P(2.4, 4.05, 66), P(2, 3.9, 78)], '#e8d6b6'); wallRect(c, 'L', 4.04, 1.75, 2.25, 60, 68, WIN, WOOD);
      }
    },
    anim(c, b, t, o) {
      if (!(b.st.glow && o.dusk) || b.lvl === 1) return;
      const a = 0.55 + 0.1 * Math.sin(t * 2);
      c.save(); c.globalAlpha = a;
      if (b.lvl === 2) { for (const [x, y] of [[.3, .85], [2.1, 2.65]]) windowGlow(c, 'L', 2.9, x, y, 20, 36); for (const [x, y] of [[.5, 1.1], [1.8, 2.4]]) windowGlow(c, 'R', 2.9, x, y, 20, 36); }
      else { for (const [x, y] of [[.4, 1.1], [2.9, 3.6]]) windowGlow(c, 'L', 3.9, x, y, 22, 40); for (const [x, y] of [[.5, 1.2], [1.6, 2.3], [2.7, 3.4]]) windowGlow(c, 'R', 3.9, x, y, 22, 40); windowGlow(c, 'L', 4.04, 1.75, 2.25, 60, 68); }
      c.restore();
    },
  },
  {
    id: 'chimney', name: 'Дымоход', cat: 'home', icon: '🏭', cost: { bricks: 10, stone: 6 }, req: ['home'], h: 120, cozy: 1,
    desc: 'Кирпичная труба, пристроенная к хижине или дому. Без неё внутри нельзя поставить камин и печь. Когда внутри топится — из трубы идёт дымок.',
    tags: ['chimney'], validAdj: 'home2',
    draw(c) {
      shadow(c, .5, .5, .3, .18);
      box(c, .2, .2, 0, .6, .6, 78, '#a8553f', { tex: 'brick' });
      box(c, .13, .13, 78, .74, .74, 6, '#7a3c2e');
      plane(c, 84, (g) => { g.fillStyle = '#2a2220'; g.fillRect(.3, .3, .4, .4); });
    },
  },
  {
    id: 'porch', name: 'Крыльцо', cat: 'home', icon: '🏡', size: [2, 1], cost: { planks: 8, nails: 4 }, req: ['home'], h: 60, cozy: 3,
    desc: 'Деревянная веранда у входа. Можно посидеть на свежем воздухе. Рядом с домом и клумбами — отличный «уют».',
    sit: { mood: 7, dur: 14 },
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .6 * w, .14);
      box(c, 0, 0, 0, w, 1, 5, '#b98a5a', { tex: 'planks' });
      for (const x of [.08, w - .18]) box(c, x, .82, 5, .1, .1, 36, '#7b5535');
      lean(c, -.05, .0, 41, w + .1, 1.0, 0, 8, .08, '#a5503e');
      box(c, .1, .3, 5, .5, .3, 4, '#8a6a48');
    },
  },
]);
