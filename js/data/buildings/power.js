import { reg } from './registry.js';
import { conduit } from './common.js';
import { P, box, cyl, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean } from '../../core/iso.js';
import { shade } from '../../core/util.js';

reg([
  {
    id: 'solar_panel', name: 'Солнечная панель', cat: 'power', icon: '☀️', size: [2, 1], cost: { glass: 6, scrap: 6, nails: 4 }, req: ['kiln'], h: 52, cozy: 0,
    desc: 'Днём вырабатывает электричество (в пасмурную погоду меньше). Соедини проводами с лампами, насосом, радио и аккумулятором.',
    tags: ['power'], net: { power: { gen: 1.2 } },
    draw(c, b) {
      const w = b.cw; shadow(c, w / 2, .5, .62 * w, .16);
      for (const x of [.2, w - .3]) box(c, x, .4, 0, .1, .2, 18, '#6b6f78');
      const pts = [P(.02, .98, 16), P(w - .02, .98, 16), P(w - .02, .02, 40), P(.02, .02, 40)];
      poly(c, pts, '#2a4d86', '#cfd6de', 2);
      c.strokeStyle = 'rgba(160,200,255,.55)'; c.lineWidth = 1; c.beginPath();
      for (let i = 1; i < 4 * w; i++) { const t = i / (4 * w); const a = P(.02 + (w - .04) * t, .98, 16), b2 = P(.02 + (w - .04) * t, .02, 40); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); }
      for (let i = 1; i < 4; i++) { const t = i / 4; const a = P(.02, .98 - .96 * t, 16 + 24 * t), b2 = P(w - .02, .98 - .96 * t, 16 + 24 * t); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); }
      c.stroke();
    },
    anim(c, b, t, o) { if (b.st.gen > .2) { const [x, y] = P(b.cw / 2, .5, 30); c.fillStyle = `rgba(255,240,170,${.15 + .15 * Math.sin(t * 2)})`; c.beginPath(); c.ellipse(x, y, 30, 12, 0, 0, 7); c.fill(); } },
  },
  {
    id: 'battery', name: 'Аккумулятор', cat: 'power', icon: '🔋', cost: { scrap: 8, planks: 3, nails: 4 }, req: ['solar_panel'], h: 40, cozy: 0,
    desc: 'Запасает электричество про запас — лампы горят и по ночам.',
    tags: ['power'], net: { power: { cap: 60 } },
    draw(c) { shadow(c, .5, .5, .34, .15); box(c, .2, .2, 0, .6, .6, 22, '#4f6f5a', { tex: 'planks', texA: .08 }); box(c, .3, .3, 22, .12, .12, 4, '#c9ccd2'); box(c, .58, .3, 22, .12, .12, 4, '#c9ccd2'); },
    anim(c, b) { const f = Math.min(1, (b.st.power || 0) / 60), [x, y] = P(.5, .8, 12); c.fillStyle = f > .3 ? '#7be07a' : '#e0a24a'; c.fillRect(x - 6, y - 3, 12 * Math.max(.1, f), 3); },
  },
  {
    id: 'cable', name: 'Провод', cat: 'power', icon: '〰️', cost: { scrap: 1, fiber: 1 }, req: ['solar_panel'], flat: true, walk: true, drag: true, norot: true, h: 8,
    desc: 'Тянет электричество от панели к потребителям. Соединяется с соседними проводами и приборами. Тяни мышью.',
    tags: ['conduit'], net: { power: { cap: 0 } }, conduit: 'power', key: (b) => b.mask || 0,
    draw(c, b) { conduit(c, b, '#3c3f48', .06, '#2a2c33'); },
  },
  {
    id: 'lamp_post', name: 'Фонарь', cat: 'power', icon: '💡', cost: { scrap: 3, glass: 1, planks: 2 }, req: ['solar_panel'], h: 90, cozy: 3, drag: true,
    desc: 'Электрический фонарь: загорается в сумерках, если подключён к сети с энергией.',
    tags: ['light'], net: { power: { use: 0.25 } }, light: { r: 5, col: '#ffe2a0', on: 'power' },
    draw(c) { shadow(c, .5, .5, .14, .16); cyl(c, .5, .5, 0, .06, 54, '#3c4048'); box(c, .36, .36, 54, .28, .28, 18, '#e8eef2', { top: '#f6fbff' }); box(c, .3, .3, 72, .4, .4, 4, '#3c4048'); },
    anim(c, b, t, o) { if (b.st.powered && o.dusk) { const [x, y] = P(.5, .5, 63); c.fillStyle = 'rgba(255,230,150,.95)'; c.fillRect(x - 6, y - 8, 12, 14); } },
  },
  {
    id: 'string_lights', name: 'Гирлянда', cat: 'power', icon: '✨', cost: { scrap: 1, glass: 1, rope: 1 }, req: ['solar_panel'], flat: false, drag: true, norot: true, h: 70, cozy: 4,
    desc: 'Столбики с лампочками: соседние гирлянды соединяются «бусами» и передают электричество друг другу. Очень уютно вечером.',
    tags: ['strand', 'light'], net: { power: { use: 0.15 } }, light: { r: 3.6, col: '#ffcf70', on: 'power' }, strand: true, key: (b) => b.mask || 0,
    draw(c, b) {
      shadow(c, .5, .5, .1, .14); cyl(c, .5, .5, 0, .045, 48, '#6b4a30');
      const m = b.mask || 0, pts = [[.5, 0], [1, .5], [.5, 1], [0, .5]];
      c.lineCap = 'round';
      pts.forEach((p, i) => {
        if (!(m & (1 << i))) return;
        const a = P(.5, .5, 46), e = P(p[0], p[1], 46), mid = [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2 + 9];
        c.strokeStyle = '#3a3a3a'; c.lineWidth = 1; c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(mid[0], mid[1], e[0], e[1]); c.stroke();
      });
      c.fillStyle = '#ffd36e'; const [x, y] = P(.5, .5, 46); c.beginPath(); c.arc(x, y, 2.4, 0, 7); c.fill();
    },
    anim(c, b, t, o) {
      if (!(b.st.powered && o.dusk)) return;
      const m = b.mask || 0, pts = [[.5, 0], [1, .5], [.5, 1], [0, .5]];
      pts.forEach((p, i) => { if (!(m & (1 << i))) return; const a = P(.5, .5, 46), e = P(p[0], p[1], 46); for (let k = 1; k < 5; k++) { const f = k / 5, x = a[0] + (e[0] - a[0]) * f, y = a[1] + (e[1] - a[1]) * f + Math.sin(f * Math.PI) * 9; c.fillStyle = ['#ffcf70', '#ff9a8a', '#a8e0ff'][(k + i) % 3]; c.globalAlpha = .8 + .2 * Math.sin(t * 3 + k + i); c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); } });
      c.globalAlpha = 1; const [x, y] = P(.5, .5, 46); c.fillStyle = '#fff2b0'; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
    },
  },
  {
    id: 'radio', name: 'Уличное радио', cat: 'power', icon: '📻', cost: { scrap: 4, planks: 2, glass: 1 }, req: ['solar_panel'], h: 50, cozy: 4,
    desc: 'Тихая музыка на ночь. Пока играет — настроение вокруг (6 клеток) подрастает. Нужна энергия.',
    tags: ['music'], net: { power: { use: 0.2 } }, music: { r: 6 },
    draw(c) {
      shadow(c, .5, .5, .3, .14); box(c, .22, .3, 0, .56, .4, 18, '#c9915f', { tex: 'planks', texA: .08 });
      wallRect(c, 'L', .7, .3, .7, 4, 14, '#f0e0b8', '#6b4328'); line3(c, [.7, .35, 18], [.85, .2, 42], '#c9ccd2', 1.4);
      const [x, y] = P(.4, .7, 9); c.fillStyle = '#5a4a3a'; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
    },
    anim(c, b, t) { if (b.st.on) { const [x, y] = P(.5, .5, 30); c.fillStyle = '#ff9ec0'; c.font = '11px sans-serif'; for (let i = 0; i < 2; i++) { const k = (t * .6 + i * .5) % 1; c.globalAlpha = 1 - k; c.fillText(i ? '♫' : '♪', x + 6 + Math.sin(k * 6) * 6, y - k * 28); } c.globalAlpha = 1; } },
  },
]);
