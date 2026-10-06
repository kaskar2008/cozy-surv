// Ввод: мышь, клавиатура, камера, призрак постройки, фотографии.
import { UI } from './ui/state.js';
import { G, N, day } from './game/state.js';
import { cam, screenToWorld, worldToScreen, zoomAt, centerOn, panScreen, rotateCam } from './render/camera.js';
import { R } from './render/scene.js';
import { captureFrame } from './render/gl.js';
import { BDEF } from './data/buildings/index.js';
import { NDEF } from './data/nodes.js';
import { FDEF } from './data/furniture.js';
import { HW, HH } from './core/iso.js';
import { T, inB, tileAt, bldAt, nodeAt } from './game/world.js';
import { explored } from './game/fog.js';
import * as api from './game/api.js';
import * as eco from './game/eco.js';
import * as pl from './game/player.js';
import { maskFor } from './game/nets.js';
import { homeOf, enterHome, exitHome, doorOf, ghostAt, pickInterior, placeFurn } from './game/interior.js';
import { selectBuilding, selectWater, selectFurn, clearSelection } from './ui/panel.js';
import { setTool, cancelBuild, toggleBar, updateCards, renderBar } from './ui/buildbar.js';
import { closeModal, showTip, hideTip, toast, askConfirm } from './ui/ui.js';
import { openInventory, openCraft, openJournal, openMenu } from './ui/modals.js';
import { setSpeed } from './ui/hud.js';
import { initAudio, isMuted, setMuted, sfx } from './core/audio.js';
import { save } from './game/save.js';

const keys = new Set();
let canvas, drag = null, placing = false, placedOne = false, keepBuild = false, lastTile = '', lastXY = null, lastTapT = 0, lastTapKey = '', ghostKey = '', ghostT = 0, hoverT = 0;

export function initInput(cv) {
  canvas = cv;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'touch') return; UI.mouse.in = false; R.ghost = null; R.hover = null; hideTip(); });
  cv.addEventListener('pointerenter', () => { UI.mouse.in = true; });
  cv.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKey);
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
  // iOS: не давать странице масштабироваться жестами
  for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault());
  // Safari на маке: щипок по тачпаду приходит как gesturechange со scale, а не как wheel+ctrl
  let gs = 1;
  cv.addEventListener('gesturestart', () => { gs = 1; });
  cv.addEventListener('gesturechange', (e) => { if (UI.touch || UI.modal) return; zoomAt(e.clientX, e.clientY, e.scale / gs); gs = e.scale; });
}
// Колесо: щипок на тачпаде (ctrl+wheel) и колесо мыши — масштаб; прокрутка двумя пальцами — движение камеры.
let padUntil = 0;
function onWheel(e) {
  e.preventDefault();
  if (UI.modal) return;
  const now = performance.now();
  // тачпад шлёт мелкие дробные дельты и часто deltaX; колесо мыши — крупные «ступеньки» только по Y
  if (!e.ctrlKey && e.deltaMode === 0 && (e.deltaX !== 0 || Math.abs(e.deltaY) < 40 || (e.deltaY % 1 !== 0))) padUntil = now + 300;
  if (e.ctrlKey || now >= padUntil) { zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0012))); return; }
  cam.goto = null; panScreen(e.deltaX, e.deltaY); clampCam();
}
const inside = () => G.scene !== 'world';
const curDef = () => (inside() ? UI.fdef : UI.def);

// ---- касания: несколько пальцев — щипок и перемещение камеры ----
const pointers = new Map();
let gesture = null, gestureEnd = 0;
const mid = () => { const p = [...pointers.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1 }; };
const FINGER_LIFT = 52; // призрак выше пальца, чтобы его было видно
const liftFor = (d) => (UI.touch && !(d && d.drag && !inside()) ? FINGER_LIFT : 0);

function onDown(e) {
  initAudio();
  UI.touch = e.pointerType === 'touch';
  document.body.classList.toggle('touch', UI.touch);
  if (UI.touch) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && !UI.modal) {
      const m = mid(); gesture = { d: m.d, x: m.x, y: m.y }; drag = null; placing = false; return;
    }
  }
  keepBuild = e.shiftKey;      // Shift — не выходить из режима постройки
  const bd = UI.tool === 'build' ? curDef() : null;
  UI.mouse.x = e.clientX; UI.mouse.y = e.clientY - liftFor(bd); UI.mouse.in = true;
  if (G.player.sleeping) { api.wakeUp(); return; }
  if (e.button === 1 || e.button === 2) { drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, btn: e.button }; return; }
  if (e.button !== 0) return;
  if (UI.modal) return;
  if (UI.touch && !bd) {
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, btn: 0, touch: true };
    return;
  }
  if (bd) {
    updateGhost(true);
    placing = !!bd.drag && !inside();
    lastTile = ghostKey;
    if (!UI.touch || placing) tryPlace();      // на тач-экране обычные постройки ставятся кнопкой «Поставить»
    lastXY = R.ghost ? { x: R.ghost.x, y: R.ghost.y } : null;
    return;
  }
  tap(e.clientX, e.clientY);
}
function tap(x, y) {
  const key = `${Math.round(x / 12)}:${Math.round(y / 12)}`;
  const dbl = performance.now() - lastTapT < 360 && key === lastTapKey;
  lastTapT = performance.now(); lastTapKey = key;
  if (inside()) clickInterior(x, y, dbl); else clickWorld(x, y, dbl);
  queuedHint();
}
// на паузе приказ не теряется, а ждёт — говорим об этом (не чаще раза в несколько секунд)
let hintT = -1e9;
function queuedHint() {
  const p = G.player;
  if (G.speed || p.sleeping || !(p.path && p.path.length) || performance.now() - hintT < 6000) return;
  hintT = performance.now(); toast('Приказ ждёт — сними паузу (P), и персонаж пойдёт', '');
}
function onMove(e) {
  if (UI.touch && pointers.has(e.pointerId)) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture && pointers.size >= 2) {
      const m = mid();
      zoomAt(m.x, m.y, m.d / gesture.d);
      panScreen(-(m.x - gesture.x), -(m.y - gesture.y)); clampCam();
      gesture = { d: m.d, x: m.x, y: m.y };
      return;
    }
  }
  const bd = UI.tool === 'build' ? curDef() : null;
  UI.mouse.x = e.clientX; UI.mouse.y = e.clientY - (e.pointerType === 'touch' ? liftFor(bd) : 0);
  const onCanvas = e.target === canvas;
  if (onCanvas && !UI.mouse.in) hideTip();
  UI.mouse.in = onCanvas;
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > (drag.touch ? 9 : 4)) drag.moved = true;
    if (drag.moved) { panScreen(-(e.clientX - drag.lx), -(e.clientY - drag.ly)); clampCam(); }
    drag.lx = e.clientX; drag.ly = e.clientY;
    return;
  }
  if (placing) {
    updateGhost(true);
    if (ghostKey !== lastTile && R.ghost) {
      lastTile = ghostKey;
      const g = R.ghost, from = lastXY || { x: g.x, y: g.y }, dx = g.x - from.x, dy = g.y - from.y, n = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 1; i <= n; i++) {
        const x = Math.round(from.x + dx * i / n), y = Math.round(from.y + dy * i / n), d = curDef();
        if (api.canPlace(d, x, y, g.rot).ok && eco.canAfford(d.cost) && api.place(d, x, y, g.rot)) placedOne = true;
      }
      if (!n) tryPlace(true);
      lastXY = { x: g.x, y: g.y }; updateCards(); ghostKey = ''; updateGhost(true);
    }
  } else if (UI.touch && bd && e.target === canvas && e.pressure !== 0) updateGhost(true);
}
function onUp(e) {
  initAudio();
  if (e.pointerType === 'touch') {
    pointers.delete(e.pointerId);
    if (gesture) { if (pointers.size < 2) gesture = null; gestureEnd = performance.now(); drag = null; placing = false; placedOne = false; return; }
    if (performance.now() - gestureEnd < 250) { drag = null; return; }
    if (e.type === 'pointercancel') { drag = null; placing = false; placedOne = false; return; }
  }
  if (drag && e.button === drag.btn) {
    const d0 = drag; drag = null;
    if (!d0.moved && d0.touch) tap(e.clientX, e.clientY);
    else if (!d0.moved && e.button === 2) { if (UI.tool !== 'select') cancelBuild(); else clearSelection(); }
  }
  if (e.button === 0) { placing = false; afterPlace(); }
}
// кнопки тач-панели размещения
export function confirmPlace() { updateGhost(true); tryPlace(false); }
export function rotateGhost() { UI.rot ^= 1; ghostKey = ''; updateGhost(true); }

function onKey(e) {
  if (e.target && /input|textarea/i.test(e.target.tagName)) return;
  if (G.frozen) return;   // игра приостановлена: открыта на другом устройстве
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (UI.modal) closeModal(); else if (UI.tool !== 'select') cancelBuild(); else if (UI.sel) clearSelection(); else openMenu(); return; }
  if (UI.modal) return;
  keys.add(k);
  switch (k) {
    case 'b': toggleBar(); break;
    case 'r': rotateGhost(); break;
    case 'x': if (!inside()) setTool(UI.tool === 'demolish' ? 'select' : 'demolish'); break;
    case 'c': openCraft(); break;
    case 'i': openInventory(); break;
    case 'j': openJournal(); break;
    case 'k': openJournal('skills'); break;
    case 'm': initAudio(); setMuted(!isMuted()); document.getElementById('mute-btn').textContent = isMuted() ? '🔇' : '🔊'; break;
    case 'p': setSpeed(G.speed === 0 ? 1 : 0); break;
    case '1': setSpeed(1); break;
    case '2': setSpeed(2); break;
    case '3': setSpeed(4); break;
    case ' ': e.preventDefault(); centerPlayer(); break;
    case 'f': takePhoto(); break;
    case 'q': if (!inside()) rotateCam(-1); break;
    case 'e': if (!inside()) rotateCam(1); break;
    case '+': case '=': zoomAt(cam.W / 2, cam.H / 2, 1.15); break;
    case '-': case '_': zoomAt(cam.W / 2, cam.H / 2, 1 / 1.15); break;
  }
}
function clampCam() {
  if (inside()) {   // внутри дома камера гуляет в пределах комнаты (на телефоне она может не помещаться целиком)
    const h = homeOf(); if (!h) return;
    cam.tx = Math.max(-1, Math.min(h.in.w + 1, cam.tx)); cam.ty = Math.max(-1, Math.min(h.in.d + 1, cam.ty));
    return;
  }
  cam.tx = Math.max(-2, Math.min(N + 2, cam.tx)); cam.ty = Math.max(-2, Math.min(N + 2, cam.ty));
}

// ---------------------------------------------------------------- призрак
export function updateGhost(force) {
  const d = curDef();
  if (UI.tool !== 'build' || !d || !UI.mouse.in || UI.modal || drag) { R.ghost = null; R.grid = false; if (!d || UI.tool !== 'build') hideTip(); return; }
  const mx = UI.mouse.x, my = UI.mouse.y;
  if (inside()) {
    const home = homeOf(); if (!home) return;
    const g = ghostAt(home, d, mx, my, UI.rot);
    if (!g) { R.ghost = null; return; }
    g.valid = g.valid && eco.canAfford(d.cost);
    R.ghost = g; ghostKey = `${g.x},${g.y},${g.wall},${g.rot}`;
    const msg = !g.valid ? (g.reason || (eco.canAfford(d.cost) ? '' : 'Не хватает материалов')) : '';
    if (msg) showTip(`<span class="miss">${msg}</span>`, mx, my); else hideTip();
    return;
  }
  const [wx, wy] = screenToWorld(mx, my);
  const rot = d.norot ? 0 : UI.rot;
  const sw = rot && d.size[0] !== d.size[1], w = sw ? d.size[1] : d.size[0], dd = sw ? d.size[0] : d.size[1];
  const x = Math.floor(wx - w / 2 + .5), y = Math.floor(wy - dd / 2 + .5);
  const key = `${x},${y},${rot}`;
  const now = performance.now();
  if (!force && key === ghostKey && now - ghostT < 400 && R.ghost) return;
  ghostKey = key; ghostT = now;
  const chk = api.canPlace(d, x, y, rot);
  const afford = eco.canAfford(d.cost), unl = api.unlocked(d);
  const fake = chk.b; fake.mask = maskFor(d, x, y);
  R.grid = true;
  R.ghost = { def: d, x, y, w: fake.w, d: fake.d, cw: fake.cw, cd: fake.cd, rot: fake.rot, v: fake.v, valid: chk.ok && afford && unl, badTiles: chk.bad, fake, links: chk.ok ? api.linksForGhost(d, fake) : [], radius: d.radius };
  if (!chk.ok) showTip(`<span class="miss">${chk.reason}</span>`, mx, my);
  else if (!afford) showTip(`<span class="miss">Не хватает материалов</span>`, mx, my);
  else if (R.ghost.links.length) showTip('🔗 Соединится: ' + [...new Set(R.ghost.links.map((l) => api.bldName(l.b)))].join(', '), mx, my);
  else hideTip();
}
function tryPlace(quiet) {
  const g = R.ghost, d = curDef(); if (!g || !d) return;
  if (inside()) {
    const home = homeOf();
    if (!g.valid) { if (!quiet) { toast(g.reason || 'Не хватает материалов', 'warn'); sfx('no'); } return; }
    placeFurn(home, d, g.x, g.y, g.rot, g.wall); updateCards(); ghostKey = ''; updateGhost(true);
    placedOne = true; afterPlace();
    return;
  }
  if (!g.valid) { if (!quiet) { const chk = api.canPlace(d, g.x, g.y, g.rot); if (!chk.ok) toast(chk.reason, 'warn'); else if (!api.unlocked(d)) toast(api.lockReason(d), 'warn'); else toast('Не хватает материалов', 'warn'); sfx('no'); } return; }
  const r = api.place(d, g.x, g.y, g.rot);
  if (r) { updateCards(); ghostKey = ''; updateGhost(true); placedOne = true; afterPlace(); }
}
// после постройки выходим из режима (при перетаскивании дорожек и заборов — когда отпустили кнопку); Shift — продолжать
function afterPlace() {
  if (placing || !placedOne) return;
  placedOne = false;
  if (!keepBuild && UI.tool === 'build') cancelBuild();
}

// ---------------------------------------------------------------- выбор объектов
function pickWorld(mx, my) {
  for (const p of G.pets) { if (p.in || !explored(Math.floor(p.x), Math.floor(p.y))) continue; const [sx, sy] = worldToScreen(p.x, p.y, 10); if (Math.hypot(sx - mx, sy - my) < 20 * cam.zoom) return { kind: 'pet', pet: p }; }
  if (G.npc && explored(Math.floor(G.npc.x), Math.floor(G.npc.y))) { const [sx, sy] = worldToScreen(G.npc.x, G.npc.y, 18); if (Math.hypot(sx - mx, sy - my) < 26 * cam.zoom) return { kind: 'npc' }; }
  for (const z of [0, 16, 34, 54, 76]) {
    const [wx, wy] = screenToWorld(mx, my, z), tx = Math.floor(wx), ty = Math.floor(wy);
    if (!inB(tx, ty) || !explored(tx, ty)) continue;   // в тумане ничего не выбрать
    const b = bldAt(tx, ty);
    if (b) { const def = BDEF[b.t]; if ((!def.flat || z === 0) && (def.ph ?? def.h) + 12 >= z) return { kind: 'bld', b }; }
    const n = nodeAt(tx, ty);
    const nh = n && (NDEF[n.t].ph ?? NDEF[n.t].h);   // ph — высота для наведения: у низких растений h больше, чем они выглядят
    if (n && nh + 8 >= z && (z === 0 || nh > 30)) return { kind: 'node', n };
  }
  return null;
}
function clickWorld(mx, my, dbl) {
  if (UI.tool === 'demolish') {
    const hit = pickWorld(mx, my);
    if (hit?.kind === 'bld') { const hb = hit.b, go = () => { api.demolish(hb); updateCards(); }; if (BDEF[hb.t].home) askConfirm('🗑 Снести дом?', 'Дом снесётся вместе с мебелью. Вернётся 60% материалов.', 'Снести', go); else go(); }
    return;
  }
  const hit = pickWorld(mx, my);
  if (hit?.kind === 'pet') { api.petPet(hit.pet); return; }
  if (hit?.kind === 'npc') { api.meetTraveler(); return; }
  if (hit?.kind === 'bld') {
    const d = BDEF[hit.b.t], walkOnly = d.walk && d.flat && !d.crops && !d.sit;
    if (walkOnly && !dbl) { /* по дорожкам, трубам и проводам просто ходим; двойной клик — осмотреть */ const [wx, wy] = screenToWorld(mx, my); clearSelection(); pl.goTo(Math.floor(wx), Math.floor(wy)); return; }
    selectBuilding(hit.b);
    if (dbl && d.home) api.doAt(hit.b, 'Вхожу', .4, 'pick', () => enterHome(hit.b));
    return;
  }
  if (hit?.kind === 'node') { clearSelection(); api.gatherNode(hit.n); return; }
  const [wx, wy] = screenToWorld(mx, my), tx = Math.floor(wx), ty = Math.floor(wy);
  if (!inB(tx, ty)) return;
  if (!explored(tx, ty)) { clearSelection(); if (pl.goTo(tx, ty)) sfx('ui'); else toast('Туда не пройти — густой туман, разведай окрестности', 'warn'); return; }
  if (tileAt(tx, ty) === T.WATER) { selectWater(tx, ty); return; }
  clearSelection();
  if (!pl.goTo(tx, ty)) { /* недоступно — попробуем ближайшую клетку */ toast('Туда не пройти', 'warn'); }
  else sfx('ui');
}
function clickInterior(mx, my, dbl) {
  const home = homeOf(); if (!home) return;
  const r = pickInterior(home, mx, my);
  if (r?.it) { selectFurn(r.it); return; }
  // ковры и спальник лежат на полу: спальник выбирается сразу, остальное — двойным нажатием (иначе по ним неудобно ходить)
  if (r?.flat && (FDEF[r.flat.t].sleep || dbl)) { selectFurn(r.flat); return; }
  if (r?.tile) { clearSelection(); const door = doorOf(home), isDoor = r.tile[0] === door.x && r.tile[1] === door.y; pl.goTo(r.tile[0], r.tile[1], isDoor ? exitHome : undefined); }   // нажатие на клетку двери — выйти из дома
}

// ---------------------------------------------------------------- обновление
export function updateInput(dt) {
  if (cam.goto) { const k = Math.min(1, dt * 7), g = cam.goto; panScreen(0, g.dy * k); g.dy *= 1 - k; if (Math.abs(g.dy) < 0.5) cam.goto = null; }
  // камера
  if (!inside() && !UI.modal) {
    let dx = 0, dy = 0; const sp = 700 * dt;
    if (keys.has('a') || keys.has('arrowleft')) dx -= sp; if (keys.has('d') || keys.has('arrowright')) dx += sp;
    if (keys.has('w') || keys.has('arrowup')) dy -= sp; if (keys.has('s') || keys.has('arrowdown')) dy += sp;
    if (dx || dy) { panScreen(dx, dy); clampCam(); }
    else if (G.player.moving && !drag) {
      const [sx, sy] = worldToScreen(G.player.x, G.player.y, 14), mx = cam.W * .28, my = cam.H * .26;
      let ox = 0, oy = 0; if (sx < mx) ox = sx - mx; else if (sx > cam.W - mx) ox = sx - (cam.W - mx); if (sy < my) oy = sy - my; else if (sy > cam.H - my - 90) oy = sy - (cam.H - my - 90);
      if (ox || oy) { const k = Math.min(1, dt * 3); panScreen(ox * k, oy * k); }
    }
  }
  if (UI.tool === 'build') updateGhost(false);
  // подсветка под курсором
  hoverT -= dt;
  if (hoverT <= 0 && UI.mouse.in && !UI.touch && !UI.modal && !drag && UI.tool !== 'build') {
    hoverT = .08;
    if (inside()) {
      const home = homeOf(); const r = home && pickInterior(home, UI.mouse.x, UI.mouse.y);
      if (r?.it) { const d = FDEF[r.it.t]; R.hover = d.wall ? null : { kind: 'it', x: r.it.x, y: r.it.y, w: r.it.w, d: r.it.d, obj: r.it }; showTip(`<b>${d.icon} ${d.name}</b>`, UI.mouse.x, UI.mouse.y); }
      else { R.hover = r?.tile ? { kind: 'tile', x: r.tile[0], y: r.tile[1] } : null; hideTip(); }
    } else {
      const hit = pickWorld(UI.mouse.x, UI.mouse.y);
      if (hit?.kind === 'bld') { R.hover = { x: hit.b.x, y: hit.b.y, w: hit.b.w, d: hit.b.d, obj: hit.b }; showTip(`<b>${BDEF[hit.b.t].icon} ${api.bldName(hit.b)}</b>`, UI.mouse.x, UI.mouse.y); }
      else if (hit?.kind === 'node') { const g = NDEF[hit.n.t].gather(hit.n); R.hover = { x: hit.n.x, y: hit.n.y, w: 1, d: 1, obj: hit.n }; showTip(`<b>${NDEF[hit.n.t].name}</b>${g ? `<div class="tdesc">${g.verb}${g.tool && !eco.has(g.tool) ? ' · нужен ' + g.tool : ''}</div>` : '<div class="tdesc">Пока пусто</div>'}`, UI.mouse.x, UI.mouse.y); }
      else if (hit?.kind === 'pet') { R.hover = null; showTip(`<b>${hit.pet.kind === 'cat' ? '🐈 Кот' : '🐕 Пёс'}</b><div class="tdesc">${(hit.pet.hunger ?? 70) < 40 ? 'Голоден — нажми, чтобы покормить (или погладить)' : 'Нажми, чтобы погладить'}</div>`, UI.mouse.x, UI.mouse.y); }
      else if (hit?.kind === 'npc') { R.hover = null; showTip('<b>🧳 Путник</b><div class="tdesc">Поговорить</div>', UI.mouse.x, UI.mouse.y); }
      else { const [wx, wy] = screenToWorld(UI.mouse.x, UI.mouse.y), tx = Math.floor(wx), ty = Math.floor(wy); R.hover = inB(tx, ty) ? { x: tx, y: ty, w: 1, d: 1 } : null; if (inB(tx, ty) && tileAt(tx, ty) === T.WATER) showTip('<b>🌊 Вода</b><div class="tdesc">Рыбалка, ведро, питьё</div>', UI.mouse.x, UI.mouse.y); else hideTip(); }
    }
  } else if (UI.tool === 'build') R.hover = null;
}

export function takePhoto() {
  const ui = document.getElementById('ui');
  ui.style.visibility = 'hidden'; hideTip();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const cv = captureFrame(document.getElementById('overlay'));
    cv.toBlob((blob) => {
      ui.style.visibility = '';
      if (!blob) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ostrov-den-${day() + 1}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      api.stat('photos'); toast('📷 Снимок сохранён в загрузки', 'goal');
      const fl = document.getElementById('flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 160);
    });
  }));
}

export function centerPlayer() { if (!inside()) centerOn(G.player.x, G.player.y); }
