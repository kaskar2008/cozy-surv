import { reg } from './registry.js';
import { P, box, cyl, cone, blob, shadow, line3, poly, plane, gable, pyramid, flame, wallRect, diamond, curve3, ribbon, glow } from '../../core/iso.js';
import { shade } from '../../core/util.js';

reg([
  {
    id: 'campfire', name: 'Костёр', cat: 'camp', icon: '🔥', cost: { sticks: 5, stone: 4 }, h: 40, cozy: 4,
    desc: 'Сердце лагеря: греет, светит и на нём можно готовить. Рядом с ним можно поставить котелок, чайник и лавочки — всё это будет работать вместе.',
    tags: ['heat', 'fire'], burner: { max: 600, fuels: { sticks: 70, wood: 200, charcoal: 380 } }, station: 'campfire',
    light: { r: 5.2, col: '#ffa850', on: 'lit', flick: 1 }, warm: 3.4,
    draw(c) {
      shadow(c, .5, .5, .46, .22);
      plane(c, 0, (g) => { g.fillStyle = '#4a3a30'; g.beginPath(); g.ellipse(.5, .5, .3, .3, 0, 0, 7); g.fill(); });
      for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; blob(c, .5 + Math.cos(a) * .34, .5 + Math.sin(a) * .34, 3, 6.5, 4.5, shade('#a2a5ac', ((i * 7) % 5 - 2) * .05)); }
      line3(c, [.3, .42, 3], [.7, .58, 5], '#6d4a2e', 5); line3(c, [.34, .62, 3], [.66, .36, 5], '#85603c', 5);
    },
    anim(c, b, t) {
      if (b.st.lit && b.st.fuel > 0) { const k = 0.55 + 0.45 * Math.min(1, b.st.fuel / 240); flame(c, .5, .5, 6, 8 * k + 3, t, b.id); }
    },
  },
  {
    id: 'torch', name: 'Факел', cat: 'camp', icon: '🔦', cost: { sticks: 3, fiber: 1 }, h: 60, cozy: 1, drag: true,
    desc: 'Сам загорается в сумерках и гаснет на рассвете. Хорошо подсвечивает тропинки.',
    light: { r: 3.6, col: '#ffb05a', on: 'dusk', flick: 1 },
    draw(c) { shadow(c, .5, .5, .16, .18); cyl(c, .5, .5, 0, .045, 34, '#7b5535'); cyl(c, .5, .5, 32, .08, 6, '#4a3a30', { top: '#ffb050' }); },
    anim(c, b, t, o) { if (o.dusk) flame(c, .5, .5, 40, 6, t, b.id); },
  },
  {
    id: 'log_seat', name: 'Пенёк-сиденье', cat: 'camp', icon: '🪑', cost: { wood: 3 }, h: 26, cozy: 1,
    desc: 'Посидеть и отдохнуть. Рядом с горящим костром настроение растёт сильнее.',
    sit: { mood: 6, dur: 12 },
    draw(c) {
      shadow(c, .5, .5, .32, .16);
      cyl(c, .5, .5, 0, .26, 10, '#9a6c43', { top: '#d9b27a' });
      plane(c, 10, (g) => { g.strokeStyle = 'rgba(90,50,20,.35)'; g.lineWidth = .03; for (const r of [.08, .16]) { g.beginPath(); g.ellipse(.5, .5, r, r, 0, 0, 7); g.stroke(); } });
    },
  },
  {
    id: 'bench', name: 'Скамейка', cat: 'camp', icon: '🛋️', size: [2, 1], cost: { planks: 4, nails: 2 }, req: ['workbench'], h: 40, cozy: 2,
    desc: 'Широкая скамейка на двоих. Хороша у костра, пруда или дома.',
    sit: { mood: 8, dur: 14 },
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .5 * w, .14);
      for (const x of [.15, w - .25]) { box(c, x, .22, 0, .1, .56, 14, '#6e4a30'); }
      box(c, .05, .12, 14, w - .1, .76, 4, '#c08a58', { tex: 'planks' });
      box(c, .05, .12, 18, w - .1, .08, 14, '#b27c4c', { tex: 'planks' });
    },
  },
  {
    id: 'hammock', name: 'Гамак', cat: 'camp', icon: '🛏️', size: [2, 1], cost: { wood: 4, rope: 2, cloth: 3 }, req: ['workbench'], h: 56, cozy: 5,
    desc: 'Лениво покачиваться в тени. Дневной сон восстанавливает силы и поднимает настроение.',
    nap: { rate: 1.25 },
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .55 * w, .14);
      for (const x of [.1, w - .1]) cyl(c, x, .5, 0, .05, 44, '#7b5535');
      ribbon(c, [.1, .5, 40], [w / 2, .5, 4], [w - .1, .5, 40], .28, '#e07a7a', 10);
      curve3(c, [.1, .22, 40], [w / 2, .22, 4], [w - .1, .22, 40], '#f3cfa0', 2.2, 10); curve3(c, [.1, .78, 40], [w / 2, .78, 4], [w - .1, .78, 40], '#f3cfa0', 2.2, 10);
    },
  },
  {
    id: 'woodshed', name: 'Дровница', cat: 'camp', icon: '🪵', size: [2, 1], cost: { wood: 10, sticks: 4 }, h: 50, cozy: 1,
    desc: 'Поленница под навесом. Если поставить её рядом с костром, печью или баней — она будет сама подкладывать дрова из ваших запасов.',
    tags: ['feeder'], cap: { mat: 20 },
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .6 * w, .16);
      for (const x of [.1, w - .2]) { box(c, x, .1, 0, .1, .1, 34, '#6b4a30'); box(c, x, .8, 0, .1, .1, 30, '#6b4a30'); }
      for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const x = .14 + i * (w - .3) / 7; cyl(c, x + .05, .5 + (r % 2) * .04, r * 7, .06, 7, i % 2 ? '#a77a4d' : '#946a42', { top: '#d9b27a' }); }
      box(c, 0, .05, 34, w, .9, 4, '#8b5a3a', { tex: 'planks' });
      pyramid(c, -.05, 0, 36, w + .1, 1, 8, .05, '#b0603c');
    },
  },
  {
    id: 'drying_rack', name: 'Сушилка', cat: 'camp', icon: '🧺', size: [2, 1], cost: { sticks: 10, rope: 2 }, h: 54, cozy: 1,
    desc: 'Сушит ягоды и фрукты. Рядом с горящим костром сушит вдвое быстрее.',
    station: 'drying',
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .5 * w, .12);
      for (const x of [.1, w - .1]) { line3(c, [x, .35, 0], [x, .5, 46], '#7b5535', 3); line3(c, [x, .65, 0], [x, .5, 46], '#7b5535', 3); }
      line3(c, [.1, .5, 44], [w - .1, .5, 44], '#8a6440', 3);
      for (let i = 0; i < 5; i++) { const x = .25 + i * (w - .5) / 4; line3(c, [x, .5, 44], [x, .5, 30 + (i % 2) * 4], '#6aa655', 2.2); blob(c, x, .5, 27 + (i % 2) * 4, 3.4, 4.4, i % 2 ? '#c34a3a' : '#7a5ad0'); }
    },
  },
  {
    id: 'pot', name: 'Котелок', cat: 'camp', icon: '🍲', cost: { scrap: 3, sticks: 2 }, req: ['campfire'], h: 46, cozy: 1,
    desc: 'Подвесной котелок. Работает, если стоит вплотную к горящему огню (костру, плите). Для супов нужна вода — из бака рядом или ведро.',
    station: 'pot', needs: ['heat'],
    draw(c) {
      shadow(c, .5, .5, .3, .16);
      line3(c, [.25, .3, 0], [.5, .5, 30], '#7b5535', 2.4); line3(c, [.75, .3, 0], [.5, .5, 30], '#7b5535', 2.4); line3(c, [.5, .78, 0], [.5, .5, 30], '#7b5535', 2.4);
      cyl(c, .5, .5, 10, .24, 13, '#3c3f45', { top: '#25282c' }); cyl(c, .5, .5, 21, .2, 2, '#9a5a30', { top: '#c98a50' });
    },
    anim(c, b, t) { if (b.st.busy) for (let i = 0; i < 3; i++) { const k = (t * .8 + i / 3) % 1, dx = Math.sin(k * 6 + i) * 3; blob(c, .5 + dx / 64, .5 - dx / 64, 28 + k * 18, 3 + k * 3, 3 + k * 3, `rgba(255,255,255,${(.45 * (1 - k)).toFixed(3)})`); } },
  },
  {
    id: 'kettle', name: 'Чайник', cat: 'camp', icon: '🫖', cost: { scrap: 2, sticks: 1 }, req: ['campfire'], h: 34, cozy: 2,
    desc: 'Чайник для чая и тёплых напитков. Ставится рядом с горящим огнём. Вечерний чай у костра — лучшее настроение.',
    station: 'kettle', needs: ['heat'],
    draw(c) {
      shadow(c, .5, .5, .24, .16);
      box(c, .3, .3, 0, .4, .4, 4, '#6b6f78');
      cyl(c, .5, .5, 4, .2, 12, '#c9573f', { top: '#e07a5a' }); blob(c, .5, .5, 18, 6, 4.5, '#c9573f');
      line3(c, [.7, .5, 10], [.82, .5, 16], '#c9573f', 3); line3(c, [.3, .5, 16], [.3, .5, 22], '#3c3f45', 2); line3(c, [.7, .5, 16], [.5, .5, 26], '#3c3f45', 2); line3(c, [.3, .5, 22], [.5, .5, 26], '#3c3f45', 2);
    },
    anim(c, b, t) { if (b.st.busy) for (let i = 0; i < 3; i++) { const k = (t * .9 + i / 3) % 1; blob(c, .82 + k * 6 / 64, .5 - k * 6 / 64, 16 + k * 16, 2 + k * 2.5, 2 + k * 2.5, `rgba(255,255,255,${(.5 * (1 - k)).toFixed(3)})`); } },
  },
]);
