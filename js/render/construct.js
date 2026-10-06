// Стройка: у каждого вида построек свой «процесс» — по логике предмета, а не одни леса на всё.
// Готовность на экране всегда равна прогрессу стройки (полоска и панель показывают то же число): 50% — построена ровно половина
//   frame  — дом, сарай, мельница…: фундамент → каркас (леса) → стены вырастают
//   pile   — мелкая утварь и мебель: куча материалов у основания тает, предмет собирается снизу вверх
//   dig    — колодец, погреб, фонтан: котлован с отвалом земли, конструкция поднимается из ямы
//   lay    — дорожки, трубы, провода, грядки, причал: колышки с бечёвкой, полотно «раскатывается»
//   plant  — клумбы, живая изгородь: вскопанная земля, растения тянутся вверх
//   post   — заборы, столбы, фонари, указатели: насыпь у основания, столб встаёт
//   carve  — статуя, гном, каменный фонарь: каменная глыба, из которой проступает фигура
//   unbox  — приборы (радио, телескоп, панель…): привозят ящик, из него появляется вещь
import { box, blob, line3, diamond } from '../core/iso.js';

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

// Положение готовой модели во время стройки: { sy — рост по высоте, sxz — рост по земле, hide — модель ещё не видна }
export function constructPose(b, def) {
  const p = b.bld.p, st = styleOf(def);
  switch (st) {
    case 'frame': return { sy: Math.max(.02, ease(p)), sxz: 1 };
    case 'dig': return { sy: Math.max(.02, ease(p)), sxz: 1, lift: -(1 - ease(p)) * .25 };
    case 'lay': return { sy: Math.max(.05, p), sxz: .25 + .75 * ease(p) };
    case 'plant': return { sy: Math.max(.02, p), sxz: .55 + .45 * p };
    case 'post': return { sy: Math.max(.02, ease(p)), sxz: 1 };
    case 'carve': return p < .15 ? { hide: true } : { sy: .9 + .1 * p, sxz: .9 + .1 * p };
    case 'unbox': return p < .15 ? { hide: true } : { sy: Math.max(.05, p), sxz: 1 };
    default: return { sy: Math.max(.02, ease(p)), sxz: 1 };   // pile
  }
}

function patch(c, b, f, fill) {   // площадка, разрастающаяся от центра
  const w = b.w * f, d = b.d * f;
  diamond(c, b.x + (b.w - w) / 2, b.y + (b.d - d) / 2, w, d, fill, null, 1, 0.5);
}
function pile(c, b, def, p) {   // куча материалов у передних граней; убывает по мере стройки
  const items = [];
  for (const k in def.cost) { const kind = MAT[k] || 'wood', n = Math.min(4, Math.ceil(def.cost[k] / 3)); for (let i = 0; i < n; i++) items.push(kind); }
  const N = Math.min(9, items.length), x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.d;
  for (let i = 0; i < N; i++) {
    const vis = 1 - clamp01(p * N - i);
    if (vis <= 0) continue;
    const r1 = rng(b, i), r2 = rng(b, i + 40), onLeft = i % 2 === 0;
    const x = onLeft ? x0 + r1 * b.w : x1 + .12 + r2 * .25, y = onLeft ? y1 + .12 + r2 * .25 : y0 + r1 * b.d;
    const kind = items[i % items.length], s = .5 + .5 * vis;
    if (kind === 'stone') blob(c, x, y, 3 * s, 5.5 * s, 4 * s, '#9d9a92');
    else if (kind === 'fiber') blob(c, x, y, 2.4 * s, 6 * s, 3.6 * s, '#dccb92');
    else if (kind === 'metal') box(c, x - .06 * s, y - .06 * s, 0, .12 * s, .12 * s, 3 * s, '#5c5c63');
    else box(c, x - .17 * s, y - .06 * s, 0, .34 * s, .12 * s, 4.8 * s, i % 3 ? '#a9784a' : '#c79a62');
  }
}
function mound(c, b, a, size = 1) {   // отвал земли
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2;
  for (let i = 0; i < 4; i++) { const ang = i * 1.6 + b.v; blob(c, cx + Math.cos(ang) * (b.w / 2 + .2), cy + Math.sin(ang) * (b.d / 2 + .2), 3, 8 * size * a, 5 * size * a, i % 2 ? '#7a5a3a' : '#8c6a46'); }
}

// Дополнения к стройке (леса, кучи, колышки) — в динамический пакет, координаты мировые
export function buildConstruction(c, b, def, hasModel) {
  const p = b.bld.p, st = styleOf(def), x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.d, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  if (!hasModel) { patch(c, b, ease(clamp01(p / .3)), 'rgba(138,118,92,.8)'); return; }
  const end = 1 - ease(clamp01((p - .88) / .12));   // леса, колышки и прочее убираются в самом конце
  if (st === 'frame') {
    patch(c, b, ease(clamp01(p / .15)), 'rgba(138,118,92,.9)');
    const H = Math.min(def.h, 96) + 6, hs = H * clamp01(p * 1.5);
    if (end <= 0 || hs <= 1) return;
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    for (const i of [0, 1, 3, 2]) { const [x, y] = pts[i]; line3(c, [x, y, 0], [x, y, hs * end], i === 0 ? '#8d6a42' : '#c99a5e', 3.2); }
    if (hs > H * .5) {
      for (let k = 0; k < 4; k++) { const a = pts[k], bb = pts[(k + 1) % 4]; line3(c, [a[0], a[1], hs * end], [bb[0], bb[1], hs * end], '#d6aa6c', 3); }
      line3(c, [x1, y0, hs * .5], [x1, y1, hs * .5], '#c99a5e', 2.6); line3(c, [x1, y1, hs * .5], [x0, y1, hs * .5], '#c99a5e', 2.6);
    }
    return;
  }
  if (st === 'dig') { patch(c, b, ease(clamp01(p / .25)), 'rgba(58,40,26,.95)'); mound(c, b, end * ease(clamp01(p / .25)), Math.max(.8, b.w * .6)); return; }
  if (st === 'lay') {
    patch(c, b, ease(clamp01(p / .25)), 'rgba(138,118,92,.45)');
    if (end > 0) for (const [x, y] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) line3(c, [x, y, 0], [x, y, 8 * end], '#c99a5e', 3);
    return;
  }
  if (st === 'plant') { patch(c, b, ease(clamp01(p / .3)), '#6a4a30'); return; }
  if (st === 'post') { mound(c, b, end * ease(clamp01(p / .2)), .8); return; }
  if (st === 'carve') {
    const H0 = Math.min(def.h * .75, 50), g = ease(clamp01(p / .15)), fade = 1 - p;
    if (fade > 0) box(c, b.x + .12, b.y + .12, 0, b.w - .24, b.d - .24, H0 * g * (.4 + .6 * fade), '#a9a7a0', { tex: 'stone' });
    return;
  }
  if (st === 'unbox') {
    const H0 = Math.min(def.h * .7, 36), drop = 1 - ease(clamp01(p / .15)), fade = 1 - p;
    if (fade > .1) box(c, b.x + .1, b.y + .1, drop * 40, b.w - .2, b.d - .2, H0 * fade, '#b88a55', { tex: 'planks' });
    return;
  }
  pile(c, b, def, p);
  void cx; void cy;
}
