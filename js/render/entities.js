// Персонаж, питомцы, путник — собираются каждый кадр из 3D-примитивов (чиби-стиль).
// Локальная система: +x — вперёд, y — вбок, высота в пикселях; размеры по земле в пикселях делятся на KX.
import { box, blob, cyl, cone, line3, shadow, KX } from '../core/iso.js';
import { shade } from '../core/util.js';
import { HUNGRY } from '../data/pets.js';
import { worldToScreen, cam } from './camera.js';

export const SHIRTS = ['#e8845a', '#5a8fd6', '#6fb86a', '#d66a9a', '#e0b84a', '#8a6ad6'];
export const HATS = ['Без шапки', 'Бини', 'Соломенная шляпа', 'Кепка', 'Цветочный венок'];

const U = 1 / KX;
// коробка с центром (cx, cy) в пикселях по земле, нижняя грань на z
const bc = (c, cx, cy, z, w, d, h, col, o) => box(c, (cx - w / 2) * U, (cy - d / 2) * U, z, w * U, d * U, h, col, o);
// seed фиксирован (не зависит от высоты, которая качается при дыхании) — неровная форма головы и причёски стабильна
const ball = (c, cx, cy, z, rx, ry, col) => blob(c, cx * U, cy * U, z, rx, ry, col, { rough: 0 });
// причёска чуть неровная (low-poly), но с фиксированной формой и небольшой амплитудой, чтобы не прорезать голову
const hairBall = (c, cx, cy, z, rx, ry, col) => blob(c, cx * U, cy * U, z, rx, ry, col, { rough: .05, seed: cx * 1.7 + rx * 3.1 + ry });
const rod = (c, a, b, col, lw) => line3(c, [a[0] * U, a[1] * U, a[2]], [b[0] * U, b[1] * U, b[2]], col, lw);

const defAng = (e) => ((e.face || 1) > 0 ? -Math.PI / 4 : Math.PI * .75);
const angOf = (e) => (e.ang === undefined ? defAng(e) : e.ang);

function person(c, o, t) {
  const bob = o.moving ? Math.abs(Math.sin(t * 10)) * 2.2 : Math.sin(t * 2.2) * .7;
  const sw = o.moving ? Math.sin(t * 10) * 3.4 : 0;
  const sit = o.fx === 'sit', crouch = o.fx === 'pick';
  const lower = sit ? 7 : crouch ? 5 : 0, skin = o.skin || '#f2cfa5', hair = o.hair || '#6a4a34';
  shadow(c, 0, 0, .26, .22);
  // ноги
  if (!sit) {
    for (const s of [-1, 1]) {
      const sx = s * sw * .5;
      bc(c, sx, s * 2.6, lower * .4, 3.8, 3.8, 10 - lower * .4, '#5a4a6a');
      bc(c, sx + 1, s * 2.6, 0, 6, 4.2, 2.6, '#3a2a2a');
    }
  } else {
    for (const s of [-1, 1]) { bc(c, 3.5, s * 2.6, 1.5, 12, 3.8, 4, '#5a4a6a'); bc(c, 9.5, s * 2.6, -4, 3.6, 4, 9, '#5a4a6a'); bc(c, 10.5, s * 2.6, -5, 6, 4.2, 2.6, '#3a2a2a'); }
  }
  // торс
  const tz = sit ? 3.5 : 10 - lower * .3 - bob * .3, th = 16 - lower * .3;
  bc(c, 0, 0, tz, 8, 12.5, th, o.shirt);
  bc(c, 0, 0, tz + th - 3, 8.2, 12.7, 3, shade(o.shirt, .14));
  if (o.cloak) bc(c, -2.6, 0, tz - 6, 3, 14, th + 6, o.cloak);
  // руки
  const sh = tz + th - 3, arm = shade(o.shirt, -.1);
  let ax = 0, az = 0;
  if (o.fx === 'chop') { const k = Math.sin((o.prog || 0) * 18); ax = 7 + k * 2; az = 6 - Math.abs(k) * 12; }
  else if (o.fx === 'pick') { ax = 6; az = -9 + Math.sin((o.prog || 0) * 14) * 3; }
  for (const s of [-1, 1]) {
    const right = s > 0;
    const hand = [sw * s * -.35 + (right ? ax : 0), s * 8, sh - 9 + (right ? az : 0) + bob * .2];
    rod(c, [0, s * 6.6, sh], hand, arm, 3.6);
    ball(c, hand[0], hand[1], hand[2] - 1, 2.1, 2.1, skin);
    if (right && o.fx === 'chop') {
      rod(c, [hand[0], hand[1], hand[2]], [hand[0] + 9, hand[1], hand[2] + 10 + az * .4], '#7b5535', 2.2);
      bc(c, hand[0] + 10, hand[1], hand[2] + 8 + az * .4, 4, 1.6, 6, '#b4b8c0');
    }
    if (right && o.fx === 'fish') rod(c, [hand[0], hand[1], hand[2]], [hand[0] + 18, hand[1] + 2, hand[2] + 18], '#7b5535', 1.6);
    if (right && o.fx === 'read') bc(c, hand[0] + 3, hand[1] - 4, hand[2], 7, 9, 1.8, '#e8d6b6');
    if (right && o.fx === 'eat') ball(c, hand[0] + 3, hand[1], hand[2] + 3, 3, 3, '#e8b86a');
  }
  // голова
  const hz0 = tz + th + 5.5 - bob * .2;
  ball(c, 0, 0, hz0, 7.2, 7.2, skin);
  hairBall(c, -1.4, 0, hz0 + 2, 7.9, 7.4, hair); hairBall(c, -4, 0, hz0 - 2.5, 5.4, 5.8, hair);
  if (o.hair === '#8a8a8a') ball(c, -5, 0, hz0 - 5, 4, 4.4, hair);
  bc(c, 6.6, 2.3, hz0 + .6, 1.4, 1.6, 2.4, '#2a1e1e'); bc(c, 6.6, -2.3, hz0 + .6, 1.4, 1.6, 2.4, '#2a1e1e');
  bc(c, 6.2, 3.8, hz0 - 2.6, 1, 2, 1.6, '#f0a0a0'); bc(c, 6.2, -3.8, hz0 - 2.6, 1, 2, 1.6, '#f0a0a0');
  // шапки
  const hat = o.hat || 0;
  if (hat === 1) { ball(c, -.3, 0, hz0 + 3, 7.7, 5.6, '#d9584a'); bc(c, 0, 0, hz0 + 1.2, 15.6, 15.6, 2.6, '#f0e0c8'); ball(c, 0, 0, hz0 + 10, 2.2, 2.2, '#f0e0c8'); }
  if (hat === 2) { cyl(c, 0, 0, hz0 + 3.5, 11 * U, 1.8, '#e3b95a'); cyl(c, 0, 0, hz0 + 5, 6.2 * U, 5.5, '#e3b95a'); cyl(c, 0, 0, hz0 + 5, 6.4 * U, 1.8, '#c94f43'); }
  if (hat === 3) { ball(c, -.3, 0, hz0 + 3, 7.6, 5.4, '#4a7ad0'); bc(c, 8, 0, hz0 + 2.6, 7, 11, 1.6, '#4a7ad0'); }
  if (hat === 4) for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; ball(c, Math.cos(a) * 6.8, Math.sin(a) * 6.8, hz0 + 4.5, 2.2, 2.2, ['#f08ac0', '#f5d34a', '#ffffff', '#8aa8f0'][i % 4]); }
}

// лёжа: голова в начале (−x), тело вытянуто вперёд (+x); cover — цвет одеяла, pillow — приподнять голову на подушку
function lying(c, skin, hair, cover = '#e8d6b6', pillow = 0) {
  shadow(c, 0, 0, .45, .16);
  const hz0 = 6 + pillow;
  ball(c, 0, 0, hz0, 6.4, 6.2, skin); hairBall(c, -1.2, 0, hz0 + 1.8, 6.9, 6.3, hair);
  bc(c, 15, 0, 1 + pillow * .3, 26, 11.5, 7, cover); bc(c, 15, 0, 7 + pillow * .3, 26, 11.7, 1.6, shade(cover, .12));
  bc(c, 5.4, 2.6, hz0 + .8, 1.4, 1.6, 1.6, '#2a1e1e'); bc(c, 5.4, -2.6, hz0 + .8, 1.4, 1.6, 1.6, '#2a1e1e');
}

function place(c, e, pose) { c.ox = pose?.x ?? e.x; c.oy = pose?.y ?? e.y; c.oz = pose?.h || 0; c.setRot(pose?.ang ?? angOf(e)); }

export function buildPlayer(c, p, t, pose) {
  place(c, p, pose);
  if (p.fx === 'sleep' || p.fx === 'nap') { lying(c, '#f2cfa5', '#6a4a34', pose?.cover, pose?.pillow); return; }
  if (p.fx === 'bathe') { ball(c, 0, 0, 22, 7.2, 7.2, '#f2cfa5'); ball(c, -1.4, 0, 24, 7.7, 7.2, '#6a4a34'); return; }
  person(c, { moving: p.moving, fx: p.fx, shirt: SHIRTS[p.outfit.shirt % SHIRTS.length], hat: p.outfit.hat, prog: p.workT }, t);
}
export function buildTraveler(c, n, t, pose) {
  place(c, n, pose);
  person(c, { moving: n.moving, fx: n.sit ? 'sit' : null, shirt: '#6a5a8a', cloak: '#5a4a7a', hat: 0, hair: '#8a8a8a' }, t);
  bc(c, -8, 0, 12, 6, 9, 13, '#8a6440');
}
export function buildPet(c, pet, t, pose) {
  place(c, pet, pose);
  const cat = pet.kind === 'cat', col = pet.col || (cat ? '#e8a05a' : '#c9915f'), dk = shade(col, -.25);
  shadow(c, 0, 0, .22, .2);
  if (pet.sleep) {
    ball(c, 0, 0, 5, 10, 6, col); ball(c, 7, 0, 5, 5, 4, shade(col, -.15));
    return;
  }
  const bob = pet.moving ? Math.abs(Math.sin(t * 12)) * 1.6 : 0, sw = pet.moving ? Math.sin(t * 12) * 2 : 0;
  ball(c, -2, 0, 9 + bob, 7.5, 5, col); ball(c, 3, 0, 9.5 + bob, 6, 5, col);
  for (const [lx, ly, s] of [[4, 2.6, 1], [4, -2.6, -1], [-5, 2.6, -1], [-5, -2.6, 1]]) bc(c, lx + sw * s, ly, 0, 2.4, 2.4, 7 + bob, col);
  ball(c, 9, 0, 13 + bob, cat ? 4.6 : 5, cat ? 4.4 : 4.8, col);
  if (cat) { cone(c, 9 * U, 2.6 * U, 15 + bob, 1.6 * U, 5, col); cone(c, 9 * U, -2.6 * U, 15 + bob, 1.6 * U, 5, col); rod(c, [-8, 0, 10 + bob], [-14, 0, 18 + Math.sin(t * 3) * 3], col, 2.4); }
  else { bc(c, 8, 4.4, 9 + bob, 2.4, 1.6, 6, dk); bc(c, 8, -4.4, 9 + bob, 2.4, 1.6, 6, dk); bc(c, 13, 0, 11 + bob, 3, 3, 2.6, '#3a2a22'); rod(c, [-8, 0, 11 + bob], [-13, 0, 16 + Math.sin(t * 9) * 2], col, 2.6); }
  bc(c, 12, 2, 14 + bob, 1.2, 1.4, 1.8, '#2a1e1e'); bc(c, 12, -2, 14 + bob, 1.2, 1.4, 1.8, '#2a1e1e');
}

// ───────── оверлеи в экранных координатах ─────────
export function drawPetBubble(c, pet, t) {
  const hungry = (pet.hunger ?? 70) < HUNGRY, ic = hungry ? (pet.kind === 'cat' ? '🐟' : '🍖') : pet.ask > 0 ? '💗' : null;
  if (!ic || pet.job) return;
  const [X, Y0] = worldToScreen(pet.x, pet.y, pet.sleep ? 22 : 30), k = Math.max(.8, cam.zoom), y = Y0 + Math.sin(t * 3) * 1.8;
  c.save(); c.fillStyle = 'rgba(255,250,240,.94)'; c.strokeStyle = 'rgba(120,90,60,.35)'; c.lineWidth = 1;
  c.beginPath(); c.arc(X, y, 9 * k, 0, 7); c.fill(); c.stroke();
  c.font = `${11 * k}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ic, X, y + 1); c.restore();
}
export function drawZ(c, e, t, z0 = 22) {
  const [X, Y] = worldToScreen(e.x, e.y, z0), k = Math.max(.8, cam.zoom);
  c.save(); c.fillStyle = '#fff'; c.font = `600 ${13 * k}px sans-serif`; c.textAlign = 'center'; c.globalAlpha = .6 + .4 * Math.sin(t * 2);
  c.fillText('z', X + 8 * k, Y - (t * 10 % 8) * k); c.fillText('Z', X + 16 * k, Y - 8 * k - (t * 10 % 8) * k); c.restore();
}
export function drawGift(c, n, t) {
  const [X, Y] = worldToScreen(n.x, n.y, 50), k = Math.max(.8, cam.zoom);
  c.save(); c.font = `${14 * k}px sans-serif`; c.textAlign = 'center'; c.fillText('🎁', X, Y + Math.sin(t * 3) * 2); c.restore();
}
// Индикатор прогресса действия над персонажем
export function drawWorkRing(c, p) {
  const w = p.work; if (!w || w.dur < .9) return;
  const [X, Y] = worldToScreen(p.x, p.y, 58), k0 = Math.min(1, w.prog / w.dur), s = Math.max(.85, cam.zoom);
  c.save();
  c.fillStyle = 'rgba(255,248,234,.92)'; c.beginPath(); c.arc(X, Y, 11 * s, 0, 7); c.fill();
  c.lineWidth = 3.4 * s; c.strokeStyle = 'rgba(120,80,40,.2)'; c.beginPath(); c.arc(X, Y, 8 * s, 0, 7); c.stroke();
  c.strokeStyle = '#e28a4a'; c.lineCap = 'round'; c.beginPath(); c.arc(X, Y, 8 * s, -Math.PI / 2, -Math.PI / 2 + k0 * Math.PI * 2); c.stroke();
  c.font = `600 ${11 * s}px ui-rounded, system-ui, sans-serif`; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(40,30,20,.6)'; c.fillStyle = '#fff';
  c.strokeText(w.label, X, Y - 17 * s); c.fillText(w.label, X, Y - 17 * s);
  c.restore();
}
