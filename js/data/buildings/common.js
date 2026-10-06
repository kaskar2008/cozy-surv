// Общие хелперы для рисования построек.
import { plane, P, blob, box, cyl, line3, poly, shadow, curve3, ribbon, glow } from '../../core/iso.js';
import { shade } from '../../core/util.js';

// Труба/провод, соединяющийся с соседями по маске (бит0 y-1, бит1 x+1, бит2 y+1, бит3 x-1)
export function conduit(c, b, col, lw, joint, z = 1) {
  const m = b.mask || 0;
  plane(c, z, (g) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pts = [[.5, 0], [1, .5], [.5, 1], [0, .5]];
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = lw * 1.5; g.beginPath();
    pts.forEach((p, i) => { if (m & (1 << i)) { g.moveTo(.5, .52); g.lineTo(p[0], p[1] + .02); } }); g.stroke();
    g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
    pts.forEach((p, i) => { if (m & (1 << i)) { g.moveTo(.5, .5); g.lineTo(p[0], p[1]); } }); g.stroke();
    g.fillStyle = joint; g.beginPath(); g.arc(.5, .5, lw * .8, 0, 7); g.fill();
  });
}

// Растение на грядке: stage 1..3 (3 — зрелое). Рисуется маленькими 3D-деталями; dx — экранный сдвиг по горизонтали (пиксели)
export function plant(c, crop, stage, x, y, col) {
  if (stage <= 0) return;
  const k = stage / 3, G1 = '#5fae4c', G2 = '#79c262', G0 = '#4a9a42';
  const at = (dx) => { const m = dx / 45.25, a = Math.abs(dx) * .9 + 1; return [x + m * Math.cos(a), y + m * Math.sin(a)]; };   // по кругу — объёмно с любого угла
  const leaf = (dx, z, rx, ry, cc) => { const [a, b] = at(dx); blob(c, a, b, z, rx, ry, cc); };
  const stem = (dx0, z0, dx1, z1, cc, lw) => { const a = Math.abs(dx1) * .9 + 1, m0 = dx0 / 45.25, m1 = dx1 / 45.25; line3(c, [x + m0 * Math.cos(a), y + m0 * Math.sin(a), z0], [x + m1 * Math.cos(a), y + m1 * Math.sin(a), z1], cc, lw); };
  if (stage === 1) { leaf(-2, 2, 2.6, 1.8, G2); leaf(2, 3, 2.6, 1.8, G1); return; }
  switch (crop) {
    case 'carrot': case 'potato': case 'herb':
      for (let i = -1; i <= 1; i++) { stem(i * 2, 0, i * 5, 6 + 6 * k, i ? G1 : G2, 2); leaf(i * 5, 7 + 6 * k, 3, 2.4, i ? G1 : G2); }
      if (stage === 3) {
        if (crop === 'carrot') leaf(0, 1, 2.6, 1.6, '#f08a3c');
        if (crop === 'potato') leaf(-4, 1, 2, 1.4, '#c9a56a');
        if (crop === 'herb') { leaf(3, 14, 1.8, 1.8, '#c3a6ee'); leaf(-3, 13, 1.6, 1.6, '#c3a6ee'); }
      }
      break;
    case 'tomato':
      stem(0, -2, 0, 14 + 6 * k, '#8a6440', 1.6);
      leaf(-4, 7, 4, 3, G1); leaf(4, 11, 4, 3, G2); leaf(-3, 14, 3.6, 2.8, G1);
      if (stage === 3) for (const [dx, z] of [[-5, 4], [5, 7], [-1, 10]]) leaf(dx, z, 2.8, 2.8, '#e5493a');
      break;
    case 'pumpkin':
      leaf(-5, 4, 5, 3, G1); leaf(5, 4, 5, 3, G2); leaf(0, 9, 4, 3, G1);
      if (stage === 3) { leaf(0, 3, 6.5, 5, '#f2993a'); stem(0, 7, 0, 10, '#6a8a3a', 2); }
      break;
    case 'wheat':
      for (let i = -2; i <= 2; i++) { stem(i * 2, 0, i * 2.6, 10 + 6 * k, stage === 3 ? '#e6c45a' : G2, 1.5); if (stage === 3) leaf(i * 2.6, 17, 1.3, 3.2, '#e6c45a'); }
      break;
    case 'corn':
      for (let i = -1; i <= 1; i += 2) { stem(i * 2, -2, i * 3, 14 + 8 * k, G1, 3); leaf(i * 7, 8 + 4 * k, 6, 1.8, G2); }
      if (stage === 3) leaf(-1, 12, 2, 4, '#f1d24a');
      break;
    case 'strawberry':
      leaf(-4, 3, 4, 3, G1); leaf(4, 3, 4, 3, G2); leaf(0, 6, 4, 3, G0);
      if (stage === 3) for (const [dx, z] of [[-5, 1], [3, 0], [0, 4]]) leaf(dx, z, 2.2, 2.2, '#e8445c');
      break;
    case 'cabbage':
      leaf(-4, 3, 5, 3.4, G0); leaf(4, 3, 5, 3.4, G1); leaf(0, 5 + 2 * k, 5 + 2 * k, 4 + 2 * k, '#8fcf7a');
      if (stage === 3) leaf(0, 7, 4, 3.2, '#b6e6a0');
      break;
    default: // цветы
      for (const [dx, hh, cc] of [[-4, 9, '#f08ac0'], [0, 13, '#f5d34a'], [4, 10, '#ffffff']]) {
        stem(dx, -1, dx, hh * k, G1, 1.4);
        if (stage === 3) { { const [fx, fy] = at(dx); for (let i = 0; i < 5; i++) { const a = i * 1.2566; blob(c, fx + Math.cos(a) * 2.4 / 45.25, fy + Math.sin(a) * 2.4 / 45.25, hh, 1.8, 1.8, cc); } blob(c, fx, fy, hh + .6, 1.4, 1.4, '#f5a623'); } }
        else leaf(dx, hh * k, 2, 1.5, G2);
      }
  }
}

// Звезда-«ноты» и пр. — мелкие общие вещи
export function glassPane(c, side, pos, u0, u1, z0, z1, a = 0.25) {
  const A = side === 'L' ? [u0, pos] : [pos, u1], B = side === 'L' ? [u1, pos] : [pos, u0];
  poly(c, [P(A[0], A[1], z0), P(B[0], B[1], z0), P(B[0], B[1], z1), P(A[0], A[1], z1)], `rgba(190,230,245,${a})`, 'rgba(255,255,255,.55)', 1);
}

export const stageOf = (p) => (!p.crop ? 0 : p.prog < 0.4 ? 1 : p.prog < 1 ? 2 : 3);
export const plotKey = (b) => b.st.plots.map((p) => `${p.crop || ''}${stageOf(p)}${p.moist > 0.3 ? 1 : 0}`).join(',');
