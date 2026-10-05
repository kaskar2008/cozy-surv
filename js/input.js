// Ввод: мышь, клавиатура, камера, призрак постройки, фотографии.
import { UI } from './ui/state.js';
import { G, N } from './game/state.js';
import { cam, screenToWorld, worldToScreen, zoomAt, centerOn } from './render/camera.js';
import { R } from './render/scene.js';
import { BDEF } from './data/buildings/index.js';
import { NDEF } from './data/nodes.js';
import { FDEF } from './data/furniture.js';
import { HW, HH } from './core/iso.js';
import { T, inB, tileAt, bldAt, nodeAt } from './game/world.js';
import * as api from './game/api.js';
import * as eco from './game/eco.js';
import * as pl from './game/player.js';
import { maskFor } from './game/nets.js';
import { homeOf, enterHome, ghostAt, pickInterior, placeFurn } from './game/interior.js';
import { selectBuilding, selectWater, selectFurn, clearSelection } from './ui/panel.js';
import { setTool, cancelBuild, toggleBar, updateCards, renderBar } from './ui/buildbar.js';
import { closeModal, showTip, hideTip, toast } from './ui/ui.js';
import { openInventory, openCraft, openJournal, openMenu } from './ui/modals.js';
import { setSpeed } from './ui/hud.js';
import { initAudio, isMuted, setMuted, sfx } from './core/audio.js';
import { save } from './game/save.js';

const keys = new Set();
let canvas, drag = null, placing = false, lastTile = '', lastXY = null, lastTapT = 0, lastTapKey = '', ghostKey = '', ghostT = 0, hoverT = 0;

export function initInput(cv) {
  canvas = cv;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  cv.addEventListener('pointerleave', () => { UI.mouse.in = false; R.ghost = null; R.hover = null; hideTip(); });
  cv.addEventListener('pointerenter', () => { UI.mouse.in = true; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0012)); }, { passive: false });
  addEventListener('keydown', onKey);
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());
}
const inside = () => G.scene !== 'world';
const curDef = () => (inside() ? UI.fdef : UI.def);

function onDown(e) {
  initAudio();
  UI.mouse.x = e.clientX; UI.mouse.y = e.clientY; UI.mouse.in = true;
  if (G.player.sleeping) { api.wakeUp(); return; }
  if (e.button === 1 || e.button === 2) { drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, btn: e.button }; return; }
  if (e.button !== 0) return;
  if (UI.modal) return;
  if (e.pointerType === 'touch' && !(UI.tool === 'build' && curDef())) {
    drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false, btn: 0, touch: true };
    return;
  }
  if (UI.tool === 'build' && curDef()) {
    updateGhost(true);
    const d = curDef();
    placing = !!d.drag && !inside();
    lastTile = ghostKey;
    tryPlace();
    lastXY = R.ghost ? { x: R.ghost.x, y: R.ghost.y } : null;
    return;
  }
  const key = `${Math.round(e.clientX / 12)}:${Math.round(e.clientY / 12)}`;
  const dbl = performance.now() - lastTapT < 360 && key === lastTapKey;
  lastTapT = performance.now(); lastTapKey = key;
  if (inside()) clickInterior(e.clientX, e.clientY, dbl); else clickWorld(e.clientX, e.clientY, dbl);
}
function onMove(e) {
  UI.mouse.x = e.clientX; UI.mouse.y = e.clientY;
  const onCanvas = e.target === canvas;
  if (onCanvas && !UI.mouse.in) hideTip();
  UI.mouse.in = onCanvas;
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (drag.moved && !inside()) { cam.x = drag.cx - dx / cam.zoom; cam.y = drag.cy - dy / cam.zoom; clampCam(); }
    return;
  }
  if (placing) {
    updateGhost(true);
    if (ghostKey !== lastTile && R.ghost) {
      lastTile = ghostKey;
      const g = R.ghost, from = lastXY || { x: g.x, y: g.y }, dx = g.x - from.x, dy = g.y - from.y, n = Math.max(Math.abs(dx), Math.abs(dy));
      for (let i = 1; i <= n; i++) {
        const x = Math.round(from.x + dx * i / n), y = Math.round(from.y + dy * i / n), d = curDef();
        if (api.canPlace(d, x, y, g.rot).ok && eco.canAfford(d.cost)) api.place(d, x, y, g.rot);
      }
      if (!n) tryPlace(true);
      lastXY = { x: g.x, y: g.y }; updateCards(); ghostKey = ''; updateGhost(true);
    }
  }
}
function onUp(e) {
  if (drag && e.button === drag.btn) {
    const d0 = drag; drag = null;
    if (!d0.moved && d0.touch) {
      const key = `${Math.round(e.clientX / 12)}:${Math.round(e.clientY / 12)}`, dbl = performance.now() - lastTapT < 360 && key === lastTapKey;
      lastTapT = performance.now(); lastTapKey = key;
      if (inside()) clickInterior(e.clientX, e.clientY, dbl); else clickWorld(e.clientX, e.clientY, dbl);
    } else if (!d0.moved && e.button === 2) { if (UI.tool !== 'select') cancelBuild(); else clearSelection(); }
  }
  if (e.button === 0) placing = false;
}
function onKey(e) {
  if (e.target && /input|textarea/i.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { if (UI.modal) closeModal(); else if (UI.tool !== 'select') cancelBuild(); else if (UI.sel) clearSelection(); else openMenu(); return; }
  if (UI.modal) return;
  keys.add(k);
  switch (k) {
    case 'b': toggleBar(); break;
    case 'r': UI.rot ^= 1; ghostKey = ''; break;
    case 'x': if (!inside()) setTool(UI.tool === 'demolish' ? 'select' : 'demolish'); break;
    case 'c': openCraft(); break;
    case 'i': openInventory(); break;
    case 'j': openJournal(); break;
    case 'm': initAudio(); setMuted(!isMuted()); document.getElementById('mute-btn').textContent = isMuted() ? '🔇' : '🔊'; break;
    case 'p': setSpeed(G.speed === 0 ? 1 : 0); break;
    case '1': setSpeed(1); break;
    case '2': setSpeed(2); break;
    case '3': setSpeed(4); break;
    case ' ': e.preventDefault(); if (!inside()) centerOn(G.player.x, G.player.y); break;
    case 'f': takePhoto(); break;
    case '+': case '=': zoomAt(cam.W / 2, cam.H / 2, 1.15); break;
    case '-': case '_': zoomAt(cam.W / 2, cam.H / 2, 1 / 1.15); break;
  }
}
function clampCam() {
  if (inside()) return;
  cam.x = Math.max(-N * HW * .9, Math.min(N * HW * .9, cam.x)); cam.y = Math.max(0, Math.min(N * 2 * HH, cam.y));
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
    return;
  }
  if (!g.valid) { if (!quiet) { const chk = api.canPlace(d, g.x, g.y, g.rot); if (!chk.ok) toast(chk.reason, 'warn'); else if (!api.unlocked(d)) toast(api.lockReason(d), 'warn'); else toast('Не хватает материалов', 'warn'); sfx('no'); } return; }
  const r = api.place(d, g.x, g.y, g.rot);
  if (r) { updateCards(); ghostKey = ''; updateGhost(true); }
}

// ---------------------------------------------------------------- выбор объектов
function pickWorld(mx, my) {
  for (const p of G.pets) { if (p.in) continue; const [sx, sy] = worldToScreen(p.x, p.y, 10); if (Math.hypot(sx - mx, sy - my) < 20 * cam.zoom) return { kind: 'pet', pet: p }; }
  if (G.npc) { const [sx, sy] = worldToScreen(G.npc.x, G.npc.y, 18); if (Math.hypot(sx - mx, sy - my) < 26 * cam.zoom) return { kind: 'npc' }; }
  for (const z of [0, 16, 34, 54, 76]) {
    const [wx, wy] = screenToWorld(mx, my, z), tx = Math.floor(wx), ty = Math.floor(wy);
    if (!inB(tx, ty)) continue;
    const b = bldAt(tx, ty);
    if (b) { const def = BDEF[b.t]; if ((!def.flat || z === 0) && def.h + 12 >= z) return { kind: 'bld', b }; }
    const n = nodeAt(tx, ty);
    if (n && NDEF[n.t].h + 8 >= z && (z === 0 || NDEF[n.t].h > 30)) return { kind: 'node', n };
  }
  return null;
}
function clickWorld(mx, my, dbl) {
  if (UI.tool === 'demolish') {
    const hit = pickWorld(mx, my);
    if (hit?.kind === 'bld') { if (BDEF[hit.b.t].home && !confirm('Снести дом вместе с мебелью? Вернётся 60% материалов.')) return; api.demolish(hit.b); updateCards(); }
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
  if (tileAt(tx, ty) === T.WATER) { selectWater(tx, ty); return; }
  clearSelection();
  if (!pl.goTo(tx, ty)) { /* недоступно — попробуем ближайшую клетку */ toast('Туда не пройти', 'warn'); }
  else sfx('ui');
}
function clickInterior(mx, my, dbl) {
  const home = homeOf(); if (!home) return;
  const r = pickInterior(home, mx, my);
  if (r?.it) { selectFurn(r.it); return; }
  if (r?.tile) { clearSelection(); pl.goTo(r.tile[0], r.tile[1]); }
}

// ---------------------------------------------------------------- обновление
export function updateInput(dt) {
  // камера
  if (!inside() && !UI.modal) {
    let dx = 0, dy = 0; const sp = 700 / cam.zoom * dt;
    if (keys.has('a') || keys.has('arrowleft')) dx -= sp; if (keys.has('d') || keys.has('arrowright')) dx += sp;
    if (keys.has('w') || keys.has('arrowup')) dy -= sp; if (keys.has('s') || keys.has('arrowdown')) dy += sp;
    if (dx || dy) { cam.x += dx; cam.y += dy; clampCam(); }
    else if (G.player.moving && !drag) {
      const [sx, sy] = worldToScreen(G.player.x, G.player.y, 14), mx = cam.W * .28, my = cam.H * .26;
      let ox = 0, oy = 0; if (sx < mx) ox = sx - mx; else if (sx > cam.W - mx) ox = sx - (cam.W - mx); if (sy < my) oy = sy - my; else if (sy > cam.H - my - 90) oy = sy - (cam.H - my - 90);
      if (ox || oy) { const k = Math.min(1, dt * 3); cam.x += ox / cam.zoom * k; cam.y += oy / cam.zoom * k; }
    }
  }
  if (UI.tool === 'build') updateGhost(false);
  // подсветка под курсором
  hoverT -= dt;
  if (hoverT <= 0 && UI.mouse.in && !UI.modal && !drag && UI.tool !== 'build') {
    hoverT = .08;
    if (inside()) {
      const home = homeOf(); const r = home && pickInterior(home, UI.mouse.x, UI.mouse.y);
      if (r?.it) { const d = FDEF[r.it.t]; R.hover = d.wall ? null : { kind: 'it', x: r.it.x, y: r.it.y, w: r.it.w, d: r.it.d }; showTip(`<b>${d.icon} ${d.name}</b>`, UI.mouse.x, UI.mouse.y); }
      else { R.hover = r?.tile ? { kind: 'tile', x: r.tile[0], y: r.tile[1] } : null; hideTip(); }
    } else {
      const hit = pickWorld(UI.mouse.x, UI.mouse.y);
      if (hit?.kind === 'bld') { R.hover = { x: hit.b.x, y: hit.b.y, w: hit.b.w, d: hit.b.d }; showTip(`<b>${BDEF[hit.b.t].icon} ${api.bldName(hit.b)}</b>`, UI.mouse.x, UI.mouse.y); }
      else if (hit?.kind === 'node') { const g = NDEF[hit.n.t].gather(hit.n); R.hover = { x: hit.n.x, y: hit.n.y, w: 1, d: 1 }; showTip(`<b>${NDEF[hit.n.t].name}</b>${g ? `<div class="tdesc">${g.verb}${g.tool && !eco.has(g.tool) ? ' · нужен ' + g.tool : ''}</div>` : '<div class="tdesc">Пока пусто</div>'}`, UI.mouse.x, UI.mouse.y); }
      else if (hit?.kind === 'pet') { R.hover = null; showTip(`<b>${hit.pet.kind === 'cat' ? '🐈 Кот' : '🐕 Пёс'}</b><div class="tdesc">Нажми, чтобы погладить</div>`, UI.mouse.x, UI.mouse.y); }
      else if (hit?.kind === 'npc') { R.hover = null; showTip('<b>🧳 Путник</b><div class="tdesc">Поговорить</div>', UI.mouse.x, UI.mouse.y); }
      else { const [wx, wy] = screenToWorld(UI.mouse.x, UI.mouse.y), tx = Math.floor(wx), ty = Math.floor(wy); R.hover = inB(tx, ty) ? { x: tx, y: ty, w: 1, d: 1 } : null; if (inB(tx, ty) && tileAt(tx, ty) === T.WATER) showTip('<b>🌊 Вода</b><div class="tdesc">Рыбалка, ведро, питьё</div>', UI.mouse.x, UI.mouse.y); else hideTip(); }
    }
  } else if (UI.tool === 'build') R.hover = null;
}

export function takePhoto() {
  const ui = document.getElementById('ui'), canvas = document.getElementById('game');
  ui.style.visibility = 'hidden'; hideTip();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    canvas.toBlob((blob) => {
      ui.style.visibility = '';
      if (!blob) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ostrov-den-${Math.floor(G.t / 300) + 1}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      api.stat('photos'); toast('📷 Снимок сохранён в загрузки', 'goal');
      const fl = document.getElementById('flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 160);
    });
  }));
}
