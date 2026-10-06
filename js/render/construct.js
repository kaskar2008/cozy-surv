// Стройка: у каждого вида построек свой «процесс» — по логике предмета, а не одни леса на всё.
// Готовность на экране всегда равна прогрессу стройки (полоска и панель показывают то же число): 50% — построена ровно половина.
//   frame  — дом, сарай, мельница…: фундамент → каркас (леса) → стены вырастают
//   pile   — мелкая утварь и мебель: куча материалов у основания тает, предмет собирается снизу вверх
//   dig    — колодец, погреб, фонтан: котлован с отвалом земли, конструкция поднимается из ямы
//   lay    — дорожки, трубы, провода, грядки, причал: колышки с бечёвкой, полотно «раскатывается»
//   plant  — клумбы, живая изгородь: вскопанная земля, растения тянутся вверх
//   post   — заборы, столбы, фонари, указатели: насыпь у основания, столб встаёт
//   carve  — статуя, гном, каменный фонарь: каменная глыба, из которой проступает фигура
//   unbox  — приборы (радио, телескоп, панель…): привозят ящик, из него появляется вещь
import { HW, HH, proj, poly, box } from '../core/iso.js';
import { drawSprite } from '../core/sprites.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => v * v * (3 - 2 * v);
const list = (s, ids) => { for (const id of ids.split(' ')) STYLE[id] = s; };
const STYLE = {};
list('frame', 'home porch woodshed shed greenhouse coop goat_pen windmill sauna kiln oven outdoor_kitchen workbench loom garden_set swing rain_collector');
list('dig', 'well cellar cistern fountain');
list('lay', 'pipe cable path_dirt path_sand path_cobble path_wood plot dock picnic');
list('plant', 'flower_bed sunflowers lavender hedge');
list('post', 'fence gate lamp_post string_lights lantern paper_lantern pinwheel signpost windchime scarecrow arch mailbox birdhouse bird_feeder torch');
list('carve', 'statue gnome stone_lantern');
list('unbox', 'radio gramophone telescope solar_panel battery');
export const styleOf = (def) => STYLE[def.id] || (def.flat ? 'lay' : 'pile');

const MAT = { stone: 'stone', clay: 'stone', sand: 'stone', bricks: 'stone', wood: 'wood', sticks: 'wood', planks: 'wood', logs: 'wood', fiber: 'fiber', cloth: 'fiber', herbs: 'fiber', rope: 'fiber', nails: 'metal', glass: 'metal' };
const frac = (v) => v - Math.floor(v);
const rng = (b, i) => frac(Math.sin((b.v + 1) * 12.9898 + i * 78.233) * 43758.5453);

// горизонтальная «шторка»: показывает долю rf постройки снизу вверх
function wipeUp(c, b, def, spr, sx, sy, rf) {
  const yb = sy + (b.w + b.d) * HH + 10, yt = sy - def.h - 16, top = yb - rf * (yb - yt);
  c.save(); c.beginPath(); c.rect(sx - (b.d + 1) * HW - 16, top, (b.w + b.d + 2) * HW + 32, yb - top + 2); c.clip();
  drawSprite(c, spr, sx, sy); c.restore();
}
function patch(c, b, f, fill, stroke, a = 1) {   // площадка, разрастающаяся от центра
  const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.d, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const q = (x, y) => proj(cx + (x - cx) * f, cy + (y - cy) * f, 0);
  c.save(); c.globalAlpha = a; poly(c, [q(x0, y0), q(x1, y0), q(x1, y1), q(x0, y1)], fill, stroke, 1.4); c.restore();
}
// куча материалов у передних граней; убывает по мере стройки
function pile(c, b, def, p) {
  const items = [];
  for (const k in def.cost) { const kind = MAT[k] || 'wood', n = Math.min(4, Math.ceil(def.cost[k] / 3)); for (let i = 0; i < n; i++) items.push(kind); }
  const N = Math.min(9, items.length), x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.d;
  for (let i = 0; i < N; i++) {
    const vis = 1 - clamp01(p * N - i);     // куски исчезают по одному
    if (vis <= 0) continue;
    const r1 = rng(b, i), r2 = rng(b, i + 40), onLeft = i % 2 === 0;
    const x = onLeft ? x0 + r1 * b.w : x1 + .12 + r2 * .25, y = onLeft ? y1 + .12 + r2 * .25 : y0 + r1 * b.d, [X, Y] = proj(x, y, 0);
    c.save(); c.globalAlpha = Math.min(1, vis * 1.5);
    const kind = items[i % items.length], s = (.5 + .5 * vis);
    if (kind === 'stone') { c.fillStyle = '#9d9a92'; c.strokeStyle = 'rgba(60,55,50,.5)'; c.beginPath(); c.ellipse(X, Y - 2 * s, 5.5 * s, 4 * s, 0, 0, 7); c.fill(); c.stroke(); }
    else if (kind === 'fiber') { c.fillStyle = '#dccb92'; c.beginPath(); c.ellipse(X, Y - 2 * s, 6 * s, 3.6 * s, 0, 0, 7); c.fill(); }
    else if (kind === 'metal') { c.fillStyle = '#5c5c63'; c.fillRect(X - 3 * s, Y - 3 * s, 6 * s, 3 * s); }
    else { c.save(); c.translate(X, Y - 2); c.rotate((r1 - .5) * .9); c.fillStyle = i % 3 ? '#a9784a' : '#c79a62'; c.strokeStyle = 'rgba(60,35,20,.5)'; c.lineWidth = 1; c.beginPath(); c.roundRect(-8 * s, -2.4 * s, 16 * s, 4.8 * s, 2); c.fill(); c.stroke(); c.restore(); }
    c.restore();
  }
}
// отвал земли
function mound(c, b, a, size = 1) {
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
  for (let i = 0; i < 4; i++) { const ang = i * 1.6 + b.v, [X, Y] = proj(cx + Math.cos(ang) * (b.w / 2 + .2), cy + Math.sin(ang) * (b.d / 2 + .2), 0); c.save(); c.globalAlpha = a; c.fillStyle = i % 2 ? '#7a5a3a' : '#8c6a46'; c.beginPath(); c.ellipse(X, Y - 2, 7 * size, 3.6 * size, 0, 0, 7); c.fill(); c.restore(); }
}

export function drawConstruction(c, b, def, spr, sx, sy, t) {
  const p = b.bld.p, st = styleOf(def), x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.d, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (!spr) { patch(c, b, ease(clamp01(p / .3)), 'rgba(138,118,92,.8)', 'rgba(94,72,48,.8)'); return; }
  const end = 1 - ease(clamp01((p - .88) / .12));   // леса, колышки и прочее убираются в самом конце

  if (st === 'frame') {
    patch(c, b, ease(clamp01(p / .15)), 'rgba(138,118,92,.9)', 'rgba(94,72,48,.8)');
    for (let i = 1; i < b.w; i++) { const a = proj(x0 + i, y0, 0), d = proj(x0 + i, y1, 0); c.strokeStyle = 'rgba(94,72,48,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(d[0], d[1]); c.stroke(); }
    if (p > 0) wipeUp(c, b, def, spr, sx, sy, p);
    const H = Math.min(def.h, 96) + 6, hs = H * clamp01(p * 1.5);
    if (end <= 0 || hs <= 1) return;
    c.save(); c.globalAlpha = end; c.lineCap = 'round'; c.lineJoin = 'round';
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const line = (a, bb, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bb[0], bb[1]); c.stroke(); };
    for (const i of [0, 1, 3, 2]) { const [x, y] = pts[i], front = i !== 0; line(proj(x, y, 0), proj(x, y, hs), front ? '#c99a5e' : '#8d6a42', front ? 2.6 : 1.8); }
    if (hs > H * .5) {
      for (let k = 0; k < 4; k++) { const a = pts[k], bb = pts[(k + 1) % 4], front = k >= 1; line(proj(a[0], a[1], hs), proj(bb[0], bb[1], hs), front ? '#d6aa6c' : '#8d6a42', front ? 2.4 : 1.6); }
      const mid = hs * .5; line(proj(x1, y0, mid), proj(x1, y1, mid), '#c99a5e', 2); line(proj(x1, y1, mid), proj(x0, y1, mid), '#c99a5e', 2);
      line(proj(x1, y0, 0), proj(x1, y1, hs), 'rgba(185,138,85,.8)', 1.8); line(proj(x1, y1, 0), proj(x0, y1, hs), 'rgba(185,138,85,.8)', 1.8);
    }
    c.restore(); return;
  }
  if (st === 'dig') {
    patch(c, b, ease(clamp01(p / .25)), 'rgba(58,40,26,.95)', 'rgba(98,70,44,.9)', end);
    mound(c, b, end * ease(clamp01(p / .25)), Math.max(.8, b.w * .6));
    if (p > 0) wipeUp(c, b, def, spr, sx, sy, p);
    return;
  }
  if (st === 'lay') {
    patch(c, b, ease(clamp01(p / .25)), 'rgba(138,118,92,.45)', 'rgba(94,72,48,.55)', end);
    const rf = p;
    if (rf > 0) {   // полотно «раскатывается» слева направо
      const L = sx - (b.d + 1) * HW - 16, W = (b.w + b.d + 2) * HW + 32; c.save(); c.beginPath(); c.rect(L, sy - def.h - 20, W * rf, (b.w + b.d) * HH + def.h + 40); c.clip(); drawSprite(c, spr, sx, sy); c.restore();
    }
    if (end > 0) {   // колышки и бечёвка
      c.save(); c.globalAlpha = end; c.lineCap = 'round';
      const cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      c.strokeStyle = 'rgba(245,235,205,.85)'; c.lineWidth = 1; c.beginPath(); cs.forEach(([x, y], i) => { const [X, Y] = proj(x, y, 5); i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.stroke();
      c.strokeStyle = '#c99a5e'; c.lineWidth = 2.4; for (const [x, y] of cs) { const a = proj(x, y, 0), d = proj(x, y, 7); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(d[0], d[1]); c.stroke(); }
      c.restore();
    }
    return;
  }
  if (st === 'plant') {
    patch(c, b, ease(clamp01(p / .3)), '#6a4a30', 'rgba(60,40,26,.8)', 1 - ease(clamp01((p - .6) / .4)) * .6);
    const k = p; if (k > 0) {
      const [bx, by] = proj(cx, cy, 0); c.save(); c.globalAlpha = Math.min(1, k * 1.4); c.translate(bx, by); c.scale(.55 + .45 * k, k); c.translate(-bx, -by); drawSprite(c, spr, sx, sy); c.restore();
    }
    return;
  }
  if (st === 'post') {
    mound(c, b, end * ease(clamp01(p / .2)), .8);
    if (p > 0) wipeUp(c, b, def, spr, sx, sy, p);
    return;
  }
  if (st === 'carve') {
    const H0 = Math.min(def.h * .75, 50), g = ease(clamp01(p / .15)), fade = 1 - p;
    if (fade > 0) { c.save(); c.globalAlpha = fade; box(c, b.x + .12, b.y + .12, 0, b.w - .24, b.d - .24, H0 * g, '#a9a7a0', { tex: 'stone' }); c.restore(); }
    const a = p; if (a > 0) { c.save(); c.globalAlpha = a; const [bx, by] = proj(cx, cy, 0); c.translate(bx, by); c.scale(.9 + .1 * a, .9 + .1 * a); c.translate(-bx, -by); drawSprite(c, spr, sx, sy); c.restore(); }
    return;
  }
  if (st === 'unbox') {
    const H0 = Math.min(def.h * .7, 36), drop = 1 - ease(clamp01(p / .15)), fade = 1 - p;
    if (fade > 0) { c.save(); c.globalAlpha = fade * (1 - drop * .6); box(c, b.x + .1, b.y + .1, drop * 40, b.w - .2, b.d - .2, H0, '#b88a55', { tex: 'planks' }); c.restore(); }
    const a = p; if (a > 0) { c.save(); c.globalAlpha = a; c.translate(0, -(1 - a) * 8); drawSprite(c, spr, sx, sy); c.restore(); }
    return;
  }
  // pile: куча материалов тает, предмет собирается снизу вверх
  pile(c, b, def, p);
  if (p > 0) wipeUp(c, b, def, spr, sx, sy, p);
}
