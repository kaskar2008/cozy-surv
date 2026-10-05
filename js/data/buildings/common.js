// Общие хелперы для рисования построек.
import { plane, P, blob, box, cyl, line3, poly, shadow } from '../../core/iso.js';
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

// Растение на грядке: stage 1..3 (3 — зрелое)
export function plant(c, crop, stage, x, y, col) {
  const [X, Y] = P(x, y, 0);
  c.save(); c.translate(X, Y); c.lineCap = 'round';
  const k = stage / 3;
  const leaf = (dx, dy, rx, ry, cc) => { c.fillStyle = cc; c.beginPath(); c.ellipse(dx, dy, rx, ry, 0, 0, 7); c.fill(); };
  const G1 = '#5fae4c', G2 = '#79c262', G0 = '#4a9a42';
  if (stage <= 0) { c.restore(); return; }
  if (stage === 1) { leaf(-2, -2, 2.6, 1.8, G2); leaf(2, -3, 2.6, 1.8, G1); c.restore(); return; }
  switch (crop) {
    case 'carrot': case 'potato': case 'herb':
      for (let i = -1; i <= 1; i++) { c.strokeStyle = i ? G1 : G2; c.lineWidth = 2; c.beginPath(); c.moveTo(i * 2, 0); c.lineTo(i * 5, -6 - 6 * k); c.stroke(); leaf(i * 5, -7 - 6 * k, 3, 2.4, i ? G1 : G2); }
      if (stage === 3) { if (crop === 'carrot') { c.fillStyle = '#f08a3c'; c.beginPath(); c.ellipse(0, 0, 2.6, 1.6, 0, 0, 7); c.fill(); } if (crop === 'potato') { leaf(-4, -1, 2, 1.4, '#c9a56a'); } if (crop === 'herb') { c.fillStyle = '#c3a6ee'; c.beginPath(); c.arc(3, -14, 1.8, 0, 7); c.arc(-3, -13, 1.6, 0, 7); c.fill(); } }
      break;
    case 'tomato':
      c.strokeStyle = '#8a6440'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -14 - 6 * k); c.stroke();
      leaf(-4, -7, 4, 3, G1); leaf(4, -11, 4, 3, G2); leaf(-3, -14, 3.6, 2.8, G1);
      if (stage === 3) { c.fillStyle = '#e5493a'; for (const [dx, dy] of [[-5, -4], [5, -7], [-1, -10]]) { c.beginPath(); c.arc(dx, dy, 2.8, 0, 7); c.fill(); } }
      break;
    case 'pumpkin':
      leaf(-5, -4, 5, 3, G1); leaf(5, -4, 5, 3, G2); leaf(0, -9, 4, 3, G1);
      if (stage === 3) { c.fillStyle = '#f2993a'; c.beginPath(); c.ellipse(0, -3, 6.5, 5, 0, 0, 7); c.fill(); c.strokeStyle = '#d7782a'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 2); c.moveTo(-3, -7.5); c.quadraticCurveTo(-4, -3, -3, 1.5); c.moveTo(3, -7.5); c.quadraticCurveTo(4, -3, 3, 1.5); c.stroke(); c.fillStyle = '#5f8a3a'; c.fillRect(-1, -9.5, 2, 3); }
      break;
    case 'wheat':
      for (let i = -2; i <= 2; i++) { c.strokeStyle = stage === 3 ? '#e6c45a' : G2; c.lineWidth = 1.5; c.beginPath(); c.moveTo(i * 2, 0); c.lineTo(i * 2.6, -10 - 6 * k); c.stroke(); if (stage === 3) { c.fillStyle = '#e6c45a'; c.beginPath(); c.ellipse(i * 2.6, -17, 1.3, 3.2, 0, 0, 7); c.fill(); } }
      break;
    case 'corn':
      for (let i = -1; i <= 1; i += 2) { c.strokeStyle = G1; c.lineWidth = 3; c.beginPath(); c.moveTo(i * 2, 2); c.lineTo(i * 3, -14 - 8 * k); c.stroke(); leaf(i * 7, -8 - 4 * k, 6, 1.8, G2); }
      if (stage === 3) { c.fillStyle = '#f1d24a'; c.beginPath(); c.ellipse(-1, -12, 2, 4, .2, 0, 7); c.fill(); }
      break;
    case 'strawberry':
      leaf(-4, -3, 4, 3, G1); leaf(4, -3, 4, 3, G2); leaf(0, -6, 4, 3, G0);
      if (stage === 3) { c.fillStyle = '#e8445c'; for (const [dx, dy] of [[-5, -1], [3, 0], [0, -4]]) { c.beginPath(); c.arc(dx, dy, 2.2, 0, 7); c.fill(); } }
      break;
    case 'cabbage':
      leaf(-4, -3, 5, 3.4, G0); leaf(4, -3, 5, 3.4, G1); leaf(0, -5 - 2 * k, 5 + 2 * k, 4 + 2 * k, '#8fcf7a'); if (stage === 3) leaf(0, -7, 4, 3.2, '#b6e6a0');
      break;
    default: // цветы
      c.strokeStyle = G1; c.lineWidth = 1.4;
      for (const [dx, hh, cc] of [[-4, 9, '#f08ac0'], [0, 13, '#f5d34a'], [4, 10, '#ffffff']]) { c.beginPath(); c.moveTo(dx, 1); c.lineTo(dx, -hh * k); c.stroke(); if (stage === 3) { c.fillStyle = cc; for (let i = 0; i < 5; i++) { const a = i * 1.2566; c.beginPath(); c.arc(dx + Math.cos(a) * 2.4, -hh + Math.sin(a) * 2.4, 1.8, 0, 7); c.fill(); } c.fillStyle = '#f5a623'; c.beginPath(); c.arc(dx, -hh, 1.3, 0, 7); c.fill(); } else leaf(dx, -hh * k, 2, 1.5, G2); }
  }
  c.restore();
}

// Звезда-«ноты» и пр. — мелкие общие вещи
export function glassPane(c, side, pos, u0, u1, z0, z1, a = 0.25) {
  const A = side === 'L' ? [u0, pos] : [pos, u1], B = side === 'L' ? [u1, pos] : [pos, u0];
  poly(c, [P(A[0], A[1], z0), P(B[0], B[1], z0), P(B[0], B[1], z1), P(A[0], A[1], z1)], `rgba(190,230,245,${a})`, 'rgba(255,255,255,.55)', 1);
}

export const stageOf = (p) => (!p.crop ? 0 : p.prog < 0.4 ? 1 : p.prog < 1 ? 2 : 3);
export const plotKey = (b) => b.st.plots.map((p) => `${p.crop || ''}${stageOf(p)}${p.moist > 0.3 ? 1 : 0}`).join(',');
