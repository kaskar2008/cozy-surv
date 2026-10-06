import { reg } from './registry.js';
import { conduit } from './common.js';
import { P, box, cyl, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean, curve3, ribbon, glow } from '../../core/iso.js';
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
      for (let i = 1; i < 4 * w; i++) { const t = i / (4 * w); line3(c, [.02 + (w - .04) * t, .98, 16.4], [.02 + (w - .04) * t, .02, 40.4], 'rgba(160,200,255,.55)', 1); }
      for (let i = 1; i < 4; i++) { const t = i / 4; line3(c, [.02, .98 - .96 * t, 16.4 + 24 * t], [w - .02, .98 - .96 * t, 16.4 + 24 * t], 'rgba(160,200,255,.55)', 1); }
    },
    anim(c, b, t, o) { if (b.st.gen > .2) blob(c, b.cw / 2, .5, 30, 30, 12, `rgba(255,240,170,${(.15 + .15 * Math.sin(t * 2)).toFixed(3)})`); },
  },
  {
    id: 'battery', name: 'Аккумулятор', cat: 'power', icon: '🔋', cost: { scrap: 8, planks: 3, nails: 4 }, req: ['solar_panel'], h: 40, cozy: 0,
    desc: 'Запасает электричество про запас — лампы горят и по ночам.',
    tags: ['power'], net: { power: { cap: 60 } },
    draw(c) { shadow(c, .5, .5, .34, .15); box(c, .2, .2, 0, .6, .6, 22, '#4f6f5a', { tex: 'planks', texA: .08 }); box(c, .3, .3, 22, .12, .12, 4, '#c9ccd2'); box(c, .58, .3, 22, .12, .12, 4, '#c9ccd2'); },
    anim(c, b) { const f = Math.min(1, (b.st.power || 0) / 60); box(c, .3, .8, 11, .4 * Math.max(.1, f), .05, 3, f > .3 ? '#7be07a' : '#e0a24a'); },
  },
  {
    id: 'cable', name: 'Провод', cat: 'power', icon: '〰️', cost: { scrap: 1, fiber: 1 }, req: ['solar_panel'], flat: true, walk: true, drag: true, norot: true, h: 8,
    desc: 'Тянет электричество от панели к потребителям. Соединяется с соседними проводами и приборами. Протяни, чтобы проложить.',
    tags: ['conduit'], net: { power: { cap: 0 } }, conduit: 'power', key: (b) => b.mask || 0,
    draw(c, b) { conduit(c, b, '#3c3f48', .06, '#2a2c33'); },
  },
  {
    id: 'lamp_post', name: 'Фонарь', cat: 'power', icon: '💡', cost: { scrap: 3, glass: 1, planks: 2 }, req: ['solar_panel'], h: 90, cozy: 3, drag: true,
    desc: 'Электрический фонарь: загорается в сумерках, если подключён к сети с энергией.',
    tags: ['light'], net: { power: { use: 0.25 } }, light: { r: 5, col: '#ffe2a0', on: 'power' },
    draw(c) { shadow(c, .5, .5, .14, .16); cyl(c, .5, .5, 0, .06, 54, '#3c4048'); box(c, .36, .36, 54, .28, .28, 18, '#e8eef2', { top: '#f6fbff' }); box(c, .3, .3, 72, .4, .4, 4, '#3c4048'); },
    anim(c, b, t, o) { if (b.st.powered && o.dusk) glow(c, .5, .5, 63, 8, '#ffeaa0'); },
  },
  {
    id: 'string_lights', name: 'Гирлянда', cat: 'power', icon: '✨', cost: { scrap: 1, glass: 1, rope: 1 }, req: ['solar_panel'], flat: false, drag: true, norot: true, h: 70, cozy: 4,
    desc: 'Столбики с лампочками: соседние гирлянды соединяются «бусами» и передают электричество друг другу. Очень уютно вечером.',
    tags: ['strand', 'light'], net: { power: { use: 0.15 } }, light: { r: 3.6, col: '#ffcf70', on: 'power' }, strand: true, key: (b) => b.mask || 0,
    draw(c, b) {
      shadow(c, .5, .5, .1, .14); cyl(c, .5, .5, 0, .045, 48, '#6b4a30');
      const m = b.mask || 0, pts = [[.5, 0], [1, .5], [.5, 1], [0, .5]];
      pts.forEach((p, i) => {
        if (!(m & (1 << i))) return;
        curve3(c, [.5, .5, 46], [(.5 + p[0]) / 2, (.5 + p[1]) / 2, 37], [p[0], p[1], 46], '#3a3a3a', 1.2);
      });
      glow(c, .5, .5, 46, 2.6, '#ffd36e');
    },
    anim(c, b, t, o) {
      if (!(b.st.powered && o.dusk)) return;
      const m = b.mask || 0, pts = [[.5, 0], [1, .5], [.5, 1], [0, .5]];
      pts.forEach((p, i) => { if (!(m & (1 << i))) return; for (let k = 1; k < 5; k++) { const f = k / 5; glow(c, .5 + (p[0] - .5) * f, .5 + (p[1] - .5) * f, 46 - Math.sin(f * Math.PI) * 9, 2.4, ['#ffcf70', '#ff9a8a', '#a8e0ff'][(k + i) % 3]); } });
      glow(c, .5, .5, 46, 3.4, '#fff2b0');
    },
  },
  {
    id: 'radio', name: 'Уличное радио', cat: 'power', icon: '📻', cost: { scrap: 4, planks: 2, glass: 1 }, req: ['solar_panel'], h: 50, cozy: 4,
    desc: 'Тихая музыка на ночь. Пока играет — настроение вокруг (6 клеток) подрастает. Нужна энергия.',
    tags: ['music'], net: { power: { use: 0.2 } }, music: { r: 6 },
    draw(c) {
      shadow(c, .5, .5, .3, .14); box(c, .22, .3, 0, .56, .4, 18, '#c9915f', { tex: 'planks', texA: .08 });
      wallRect(c, 'L', .7, .3, .7, 4, 14, '#f0e0b8', '#6b4328'); line3(c, [.7, .35, 18], [.85, .2, 42], '#c9ccd2', 1.4);
      blob(c, .4, .72, 9, 3, 3, '#5a4a3a');
    },
    anim(c, b, t) { if (b.st.on) for (let i = 0; i < 2; i++) { const k = (t * .6 + i * .5) % 1; blob(c, .5 + (6 + Math.sin(k * 6) * 6) / 64, .5 - (6 + Math.sin(k * 6) * 6) / 64, 30 + k * 28, 3, 3, `rgba(255,158,192,${(1 - k).toFixed(3)})`); } },
  },
]);
