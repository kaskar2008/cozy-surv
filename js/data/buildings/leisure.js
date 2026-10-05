import { reg } from './registry.js';
import { P, box, cyl, cone, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean, flame } from '../../core/iso.js';
import { shade } from '../../core/util.js';

reg([
  {
    id: 'telescope', name: 'Телескоп', cat: 'leisure', icon: '🔭', cost: { glass: 4, scrap: 6, planks: 4 }, req: ['kiln'], h: 70, cozy: 4,
    desc: 'Звёздное небо вблизи. Ночью — лучшее настроение на всю ночь, днём можно просто смотреть вдаль.',
    stargaze: true,
    draw(c) { shadow(c, .5, .5, .3, .15); line3(c, [.5, .5, 22], [.25, .3, 0], '#6b6f78', 2.6); line3(c, [.5, .5, 22], [.78, .35, 0], '#6b6f78', 2.6); line3(c, [.5, .5, 22], [.5, .8, 0], '#6b6f78', 2.6); line3(c, [.35, .6, 26], [.7, .35, 54], '#3f6fb0', 8); line3(c, [.7, .35, 54], [.76, .31, 59], '#c9ccd2', 9); },
  },
  {
    id: 'gramophone', name: 'Граммофон', cat: 'leisure', icon: '🎶', cost: { wood: 10, scrap: 6, planks: 4 }, req: ['workbench'], h: 60, cozy: 5,
    desc: 'Заводной граммофон — музыка без электричества. Пока играет, настроение рядом растёт.',
    tags: ['music'], music: { r: 6, manual: true },
    draw(c) {
      shadow(c, .5, .5, .3, .15); box(c, .22, .28, 0, .56, .44, 16, '#8a5a38', { tex: 'planks' });
      cyl(c, .5, .5, 16, .2, 2, '#1e2024', { top: '#2a2c33' }); line3(c, [.5, .5, 22], [.5, .5, 38], '#c9a050', 2.4);
      cone(c, .5, .5, 36, .26, 14, '#d9b05a'); plane(c, 0, () => {});
    },
    anim(c, b, t) { if (b.st.on) { const [x, y] = P(.5, .5, 30); c.fillStyle = '#ff9ec0'; c.font = '12px sans-serif'; for (let i = 0; i < 3; i++) { const k = (t * .6 + i / 3) % 1; c.globalAlpha = 1 - k; c.fillText(['♪', '♫', '♬'][i], x + 8 + Math.sin(k * 6 + i) * 8, y - k * 32); } c.globalAlpha = 1; } },
  },
  {
    id: 'sauna', name: 'Баня', cat: 'leisure', icon: '🧖', size: [3, 3], cost: { wood: 30, planks: 20, stone: 16, rope: 2 }, reqAny: ['tank', 'well'], h: 120, cozy: 8,
    desc: 'Бревенчатая баня с каменкой. Растопи её дровами, подведи воду (бак рядом) — и попарься: тепло, силы и отличное настроение. Горячая каменка также греет купель рядом.',
    tags: ['heat'], burner: { max: 420, fuels: { sticks: 70, wood: 200, charcoal: 380 } }, net: { water: { cap: 0, leaf: true } }, sauna: true,
    light: { r: 3.4, col: '#ff9a50', on: 'lit', flick: .6 },
    draw(c) {
      shadow(c, 1.5, 1.5, 1.3, .2);
      box(c, .12, .12, 0, 2.76, 2.76, 40, '#a47a4d', { tex: 'logs' });
      wallRect(c, 'L', 2.88, 1.1, 1.8, 0, 32, '#5a3a22', '#3a2a22'); wallRect(c, 'L', 2.88, .3, .8, 16, 30, '#ffd27a', '#5a3a22'); wallRect(c, 'R', 2.88, .5, 1.1, 16, 30, '#ffd27a', '#5a3a22');
      lean(c, .0, .0, 40, 3, 3, 0, 10, .15, '#6b4a30');
      box(c, 2.2, .3, 40, .24, .24, 38, '#6b6f78');
    },
    anim(c, b, t) { if (b.st.lit && b.st.fuel > 0) { const [x, y] = P(2.3, .4, 80); c.fillStyle = 'rgba(220,220,220,.5)'; for (let i = 0; i < 3; i++) { const k = (t * .4 + i / 3) % 1; c.globalAlpha = (1 - k) * .7; c.beginPath(); c.arc(x + k * 8, y - k * 28, 4 + k * 5, 0, 7); c.fill(); } c.globalAlpha = 1; } },
  },
  {
    id: 'garden_set', name: 'Столик с зонтом', cat: 'leisure', icon: '⛱️', size: [2, 2], cost: { planks: 8, cloth: 4, nails: 2 }, req: ['workbench'], h: 110, cozy: 5,
    desc: 'Круглый столик и два стула под полосатым зонтом. Чай на свежем воздухе!',
    sit: { mood: 10, dur: 16 },
    draw(c) {
      shadow(c, 1, 1, .85, .18);
      cyl(c, 1, 1, 0, .06, 30, '#7b5535'); cyl(c, 1, 1, 30, .55, 3, '#e8d6b6', { top: '#f6ebd0' });
      for (const [x, y] of [[.3, .5], [1.7, 1.5]]) { box(c, x - .22, y - .22, 0, .44, .44, 14, '#c08a58', { tex: 'planks' }); box(c, x - .22, y - .22, 14, .44, .44, 3, '#d9a56a'); }
      cyl(c, 1, 1, 30, .035, 62, '#cfd1d6');
      const [X, Y] = P(1, 1, 92); c.save(); c.translate(X, Y);
      for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#f6ebd0' : '#e8584a'; c.beginPath(); c.moveTo(0, -14); c.lineTo(-52 + i * 17.3, 8 + Math.abs(i - 2.5) * -1.4); c.lineTo(-52 + (i + 1) * 17.3, 8 + Math.abs(i - 1.5) * -1.4); c.closePath(); c.fill(); }
      c.restore();
    },
  },
  {
    id: 'swing', name: 'Качели', cat: 'leisure', icon: '🎠', size: [2, 1], cost: { wood: 8, rope: 4 }, req: ['workbench'], h: 100, cozy: 5,
    desc: 'Деревянные качели. Взлетай — настроение тоже.',
    sit: { mood: 12, dur: 14, fx: 'swing' },
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .6 * w, .14);
      for (const x of [.15, w - .15]) { line3(c, [x, .2, 0], [x, .5, 80], '#7b5535', 4); line3(c, [x, .8, 0], [x, .5, 80], '#7b5535', 4); }
      line3(c, [.1, .5, 80], [w - .1, .5, 80], '#6e4a30', 5);
    },
    anim(c, b, t) { const w = b.cw, sw = Math.sin(t * 1.8 + b.v) * (b.st.using ? .6 : .12); const a = P(.6, .5, 78), s = [a[0] + Math.sin(sw) * 40 + 0, a[1] + Math.cos(sw) * 46], s2 = P(w - .6, .5, 78); c.strokeStyle = '#c9b58a'; c.lineWidth = 1.4; for (const base of [a, s2]) { c.beginPath(); c.moveTo(base[0], base[1]); c.lineTo(base[0] + Math.sin(sw) * 40, base[1] + Math.cos(sw) * 46); c.stroke(); } c.fillStyle = '#c08a58'; c.fillRect(s[0] - 3, s[1] - 2, s2[0] - a[0] + 6, 5); },
  },
  {
    id: 'picnic', name: 'Пикник', cat: 'leisure', icon: '🧺', size: [2, 2], cost: { cloth: 3, wood: 2, berries: 2 }, flat: true, walk: true, h: 24, cozy: 4,
    desc: 'Клетчатый плед с корзинкой. Сядь, поешь, никуда не торопись. Вместе с телескопом даёт «Звёздную ночь».',
    sit: { mood: 11, dur: 16 },
    draw(c) {
      plane(c, 0, (g) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#f6ebd0' : '#e8584a'; g.fillRect(.08 + i * .23, .08 + j * .23, .23, .23); } });
      cyl(c, 1.2, .7, 0, .22, 10, '#c9a05a', { top: '#8a6a3a', rings: [.5] }); const [x, y] = P(.6, 1.3, 0); c.fillStyle = '#6f8fb8'; c.beginPath(); c.ellipse(x, y - 5, 4, 5, 0, 0, 7); c.fill(); c.fillStyle = '#e8d29a'; c.beginPath(); c.ellipse(x + 12, y - 3, 3.4, 4, 0, 0, 7); c.fill();
    },
  },
]);
