// Персонаж, питомцы, путник — рисуются кодом (чиби-стиль).
import { proj } from '../core/iso.js';
import { shade } from '../core/util.js';
import { HUNGRY } from '../data/pets.js';

export const SHIRTS = ['#e8845a', '#5a8fd6', '#6fb86a', '#d66a9a', '#e0b84a', '#8a6ad6'];
export const HATS = ['Без шапки', 'Бини', 'Соломенная шляпа', 'Кепка', 'Цветочный венок'];

function shadowAt(c, X, Y, r = 9) { c.fillStyle = 'rgba(30,20,40,.22)'; c.beginPath(); c.ellipse(X, Y, r, r * .5, 0, 0, 7); c.fill(); }

function person(c, o, t) {
  // o: {moving, face, fx, shirt, hat, skin, hair, prog, cloak}
  const bob = o.moving ? Math.abs(Math.sin(t * 10)) * 2.2 : Math.sin(t * 2.2) * .7;
  const sw = o.moving ? Math.sin(t * 10) * 3.4 : 0;
  const sit = o.fx === 'sit', crouch = o.fx === 'pick';
  const lower = sit ? 7 : crouch ? 5 : 0;
  c.save(); c.scale(o.face || 1, 1);
  // ноги
  if (!sit) { c.fillStyle = '#5a4a6a'; c.fillRect(-4.5 + sw * .3, -10 + lower * .4, 3.6, 10 - lower * .4); c.fillRect(1 - sw * .3, -10 + lower * .4, 3.6, 10 - lower * .4); c.fillStyle = '#3a2a2a'; c.fillRect(-5 + sw * .3, -2, 4.6, 2.4); c.fillRect(.6 - sw * .3, -2, 4.6, 2.4); }
  else { c.fillStyle = '#5a4a6a'; c.fillRect(-4, -6, 11, 4); c.fillStyle = '#3a2a2a'; c.fillRect(6, -6, 3.4, 4.6); }
  // торс
  const ty = -26 + lower - bob * .5;
  c.fillStyle = o.shirt; c.beginPath(); c.roundRect(-6.5, ty, 13, 16 - lower * .3, 4); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(-6.5, ty, 13, 3);
  if (o.cloak) { c.fillStyle = o.cloak; c.beginPath(); c.moveTo(-8, ty - 1); c.lineTo(8, ty - 1); c.lineTo(10, ty + 18); c.lineTo(-10, ty + 18); c.closePath(); c.fill(); }
  // руки
  c.fillStyle = shade(o.shirt, -.1);
  let ax = 0, ay = 0;
  if (o.fx === 'chop') { const k = Math.sin((o.prog || 0) * 18); ax = 4; ay = -7 - k * 5; }
  else if (o.fx === 'pick') { ax = 2; ay = 3 + Math.sin((o.prog || 0) * 14) * 2; }
  c.beginPath(); c.ellipse(-7, ty + 6 + sw * .4, 2.4, 4.4, 0, 0, 7); c.fill();
  c.beginPath(); c.ellipse(7 + ax, ty + 6 + ay - sw * .4, 2.4, 4.4, 0, 0, 7); c.fill();
  c.fillStyle = o.skin || '#f2cfa5'; c.beginPath(); c.arc(7 + ax, ty + 9.4 + ay - sw * .4, 2, 0, 7); c.fill();
  if (o.fx === 'chop') { c.save(); c.translate(8 + ax, ty + 8 + ay); c.rotate(-.6 + Math.sin((o.prog || 0) * 18) * .9); c.fillStyle = '#7b5535'; c.fillRect(-1, -12, 2.2, 15); c.fillStyle = '#b4b8c0'; c.fillRect(0, -13, 6, 5); c.restore(); }
  if (o.fx === 'fish') { c.strokeStyle = '#7b5535'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(7, ty + 8); c.lineTo(22, ty - 12); c.stroke(); }
  if (o.fx === 'read') { c.fillStyle = '#e8d6b6'; c.fillRect(1, ty + 5, 9, 7); c.fillStyle = '#b4584a'; c.fillRect(1, ty + 5, 9, 1.6); }
  if (o.fx === 'eat') { c.fillStyle = '#e8b86a'; c.beginPath(); c.arc(9, ty - 1, 3, 0, 7); c.fill(); }
  // голова
  const hy = ty - 8 - bob * .3;
  c.fillStyle = o.skin || '#f2cfa5'; c.beginPath(); c.arc(0, hy, 7.2, 0, 7); c.fill();
  c.fillStyle = o.hair || '#6a4a34'; c.beginPath(); c.arc(0, hy - 1.4, 7.6, Math.PI * 1.02, Math.PI * 1.98); c.lineTo(5.6, hy - 3); c.lineTo(-6, hy - 2); c.fill();
  c.fillRect(-7.4, hy - 3, 3, 8); c.beginPath(); c.arc(-4, hy + 4, 3.2, 0, 7); c.fill();
  c.fillStyle = '#2a1e1e'; c.fillRect(1.4, hy - .6, 1.7, 2.2); c.fillRect(4.4, hy - .6, 1.7, 2.2);
  c.fillStyle = 'rgba(240,120,120,.35)'; c.beginPath(); c.arc(3, hy + 3.4, 1.8, 0, 7); c.fill();
  // шапки
  const hat = o.hat || 0;
  if (hat === 1) { c.fillStyle = '#d9584a'; c.beginPath(); c.arc(0, hy - 2.4, 7.6, Math.PI, 0); c.fill(); c.fillStyle = '#f0e0c8'; c.fillRect(-7.6, hy - 3, 15.2, 2.6); c.beginPath(); c.arc(0, hy - 10, 2.2, 0, 7); c.fill(); }
  if (hat === 2) { c.fillStyle = '#e3b95a'; c.beginPath(); c.ellipse(0, hy - 4, 12, 3.6, 0, 0, 7); c.fill(); c.beginPath(); c.arc(0, hy - 5, 6.2, Math.PI, 0); c.fill(); c.fillStyle = '#c94f43'; c.fillRect(-6.2, hy - 6.4, 12.4, 1.6); }
  if (hat === 3) { c.fillStyle = '#4a7ad0'; c.beginPath(); c.arc(0, hy - 2.4, 7.5, Math.PI, 0); c.fill(); c.fillRect(1, hy - 3.6, 10, 2.2); }
  if (hat === 4) { for (let i = 0; i < 7; i++) { const a = Math.PI + i * .52; c.fillStyle = ['#f08ac0', '#f5d34a', '#fff', '#8aa8f0'][i % 4]; c.beginPath(); c.arc(Math.cos(a) * 7, hy - 3 + Math.sin(a) * 4.4, 2, 0, 7); c.fill(); } }
  c.restore();
}

export function drawPlayer(c, p, t) {
  const [X, Y] = proj(p.x, p.y, 0);
  c.save(); c.translate(X, Y);
  if (p.fx === 'sleep' || p.fx === 'nap') {
    shadowAt(c, 0, 2, 16);
    c.fillStyle = '#f2cfa5'; c.beginPath(); c.arc(-9, -6, 6.4, 0, 7); c.fill();
    c.fillStyle = '#6a4a34'; c.beginPath(); c.arc(-9, -8, 6.6, Math.PI, 0); c.fill();
    c.fillStyle = '#e8d6b6'; c.beginPath(); c.roundRect(-6, -10, 20, 11, 4); c.fill();
    c.fillStyle = '#2a1e1e'; c.fillRect(-10, -6, 3, 1);
    c.fillStyle = '#fff'; c.font = '600 13px sans-serif'; c.textAlign = 'center'; c.globalAlpha = .6 + .4 * Math.sin(t * 2);
    c.fillText('z', 6, -22 - (t * 10 % 8)); c.fillText('Z', 14, -30 - (t * 10 % 8)); c.globalAlpha = 1;
    c.restore(); return;
  }
  if (p.fx === 'bathe') {
    c.fillStyle = '#f2cfa5'; c.beginPath(); c.arc(0, -22, 7.2, 0, 7); c.fill();
    c.fillStyle = '#6a4a34'; c.beginPath(); c.arc(0, -23.4, 7.6, Math.PI, 0); c.fill(); c.fillRect(-7.4, -24, 3, 7);
    c.fillStyle = '#2a1e1e'; c.fillRect(1.4, -22.6, 1.7, 2.2); c.fillRect(4.4, -22.6, 1.7, 2.2);
    c.restore(); return;
  }
  shadowAt(c, 0, 1, 9);
  person(c, { moving: p.moving, face: p.face, fx: p.fx, shirt: SHIRTS[p.outfit.shirt % SHIRTS.length], hat: p.outfit.hat, prog: p.workT }, t);
  c.restore();
}

export function drawTraveler(c, n, t) {
  const [X, Y] = proj(n.x, n.y, 0);
  c.save(); c.translate(X, Y); shadowAt(c, 0, 1, 10);
  person(c, { moving: n.moving, face: n.face, fx: n.sit ? 'sit' : null, shirt: '#6a5a8a', cloak: '#5a4a7a', hat: 0, hair: '#8a8a8a' }, t);
  c.fillStyle = '#8a6440'; c.beginPath(); c.roundRect(-14 * (n.face || 1), -30, 8, 14, 3); c.fill();
  if (n.gift) { c.fillStyle = '#fff'; c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText('🎁', 0, -50 + Math.sin(t * 3) * 2); }
  c.restore();
}

// пузырёк над питомцем: голоден / пришёл за лаской
function petBubble(c, pet, t) {
  const hungry = (pet.hunger ?? 70) < HUNGRY, ic = hungry ? (pet.kind === 'cat' ? '🐟' : '🍖') : pet.ask > 0 ? '💗' : null;
  if (!ic || pet.job) return;
  c.save(); c.scale(pet.face || 1, 1); const y = -(pet.sleep ? 26 : 33) + Math.sin(t * 3) * 1.8;
  c.fillStyle = 'rgba(255,250,240,.94)'; c.strokeStyle = 'rgba(120,90,60,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(0, y, 9, 0, 7); c.fill(); c.stroke();
  c.font = '11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#000'; c.fillText(ic, 0, y + 1); c.restore();
}
export function drawPet(c, pet, t) {
  const [X, Y] = proj(pet.x, pet.y, 0);
  c.save(); c.translate(X, Y); shadowAt(c, 0, 1, 8);
  c.scale(pet.face || 1, 1);
  const cat = pet.kind === 'cat', col = pet.col || (cat ? '#e8a05a' : '#c9915f'), bob = pet.moving ? Math.abs(Math.sin(t * 12)) * 1.6 : 0;
  if (pet.sleep) {
    c.fillStyle = col; c.beginPath(); c.ellipse(0, -5, 10, 6, 0, 0, 7); c.fill(); c.fillStyle = shade(col, -.15); c.beginPath(); c.ellipse(-7, -6, 5, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = '600 11px sans-serif'; c.textAlign = 'center'; c.globalAlpha = .6 + .4 * Math.sin(t * 2); c.fillText('z', 6, -16 - (t * 8 % 6)); c.globalAlpha = 1;
    petBubble(c, pet, t); c.restore(); return;
  }
  c.fillStyle = col;
  c.beginPath(); c.ellipse(0, -8 - bob, cat ? 8 : 9, cat ? 5 : 5.4, 0, 0, 7); c.fill();
  c.fillRect(-5, -6 - bob, 2.4, 6 + bob); c.fillRect(3, -6 - bob, 2.4, 6 + bob);
  c.beginPath(); c.arc(8, -12 - bob, cat ? 4.6 : 5, 0, 7); c.fill();
  if (cat) { c.beginPath(); c.moveTo(5, -15 - bob); c.lineTo(6, -20 - bob); c.lineTo(9, -16 - bob); c.moveTo(9, -16 - bob); c.lineTo(12, -20 - bob); c.lineTo(12, -14 - bob); c.fill(); c.strokeStyle = col; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -9); c.quadraticCurveTo(-15, -14 + Math.sin(t * 3) * 3, -12, -20); c.stroke(); }
  else { c.fillStyle = shade(col, -.25); c.beginPath(); c.ellipse(11, -9 - bob, 2.6, 4, .4, 0, 7); c.fill(); c.beginPath(); c.ellipse(5.4, -13 - bob, 2.2, 4, -.3, 0, 7); c.fill(); c.strokeStyle = col; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-9, -10); c.lineTo(-13, -15 + Math.sin(t * 9) * 2); c.stroke(); }
  c.fillStyle = '#2a1e1e'; c.fillRect(9, -13 - bob, 1.4, 1.8); c.fillRect(11.6, -12 - bob, 1.2, 1.5);
  petBubble(c, pet, t); c.restore();
}

// Индикатор прогресса действия над персонажем
export function drawWorkRing(c, p) {
  const w = p.work; if (!w || w.dur < .9) return;
  const [X, Y] = proj(p.x, p.y, 58), k = Math.min(1, w.prog / w.dur);
  c.save();
  c.fillStyle = 'rgba(255,248,234,.92)'; c.beginPath(); c.arc(X, Y, 11, 0, 7); c.fill();
  c.lineWidth = 3.4; c.strokeStyle = 'rgba(120,80,40,.2)'; c.beginPath(); c.arc(X, Y, 8, 0, 7); c.stroke();
  c.strokeStyle = '#e28a4a'; c.lineCap = 'round'; c.beginPath(); c.arc(X, Y, 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); c.stroke();
  c.font = '600 11px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(40,30,20,.6)'; c.fillStyle = '#fff';
  c.strokeText(w.label, X, Y - 17); c.fillText(w.label, X, Y - 17);
  c.restore();
}
