// Точка входа: инициализация, главный цикл, автосохранение.
import { G, N, darkness, season } from './game/state.js';
import { newGame } from './game/init.js';
import { load, save, wipe, getMode, setMode } from './game/save.js';
import * as cloud from './game/cloud.js';
import { cam, centerOn } from './render/camera.js';
import { renderWorld, initScene, R } from './render/scene.js';
import * as gl from './render/gl.js';
import { resizeGL, setShadows } from './render/gl.js';
import { renderInterior, enterHome, exitHome, placeFurn } from './game/interior.js';
import { FDEF } from './data/furniture.js';
import { worldToScreen, screenToWorld, rotateCam } from './render/camera.js';
import { simulate } from './game/sim.js';
import { ensureLinks } from './game/nets.js';
import { computeCozy } from './game/cozy.js';
import { S, nearHeat } from './game/api.js';
import { BDEF } from './data/buildings/index.js';
import * as fx from './render/fx.js';
import * as audio from './core/audio.js';
import { initUI } from './ui/ui.js';
import { buildHUD, updateHUD, setSpeed } from './ui/hud.js';
import { buildBar, renderBar, updateCards } from './ui/buildbar.js';
import { initPanel, updatePanel, clearSelection } from './ui/panel.js';
import { openIntro } from './ui/modals.js';
import { chooseStorage, resolveSave, watchConflicts, activateCloud } from './ui/cloud.js';
import { toast } from './ui/ui.js';
import { initInput, updateInput } from './input.js';
import { UI } from './ui/state.js';
import * as api from './game/api.js';
import { prof, mark, now, hooks } from './core/prof.js';

const canvas = document.getElementById('game'), overlay = document.getElementById('overlay'), ctx = overlay.getContext('2d');
initScene(canvas);
let quality = 1;
function resize() {
  cam.dpr = Math.min(2, window.devicePixelRatio || 1) * quality; cam.W = innerWidth; cam.H = innerHeight;
  overlay.width = Math.floor(cam.W * cam.dpr); overlay.height = Math.floor(cam.H * cam.dpr);
  for (const cv of [canvas, overlay]) { cv.style.width = cam.W + 'px'; cv.style.height = cam.H + 'px'; }
  resizeGL(); setShadows(quality > 0.7);
}
addEventListener('resize', resize); resize();

let last = performance.now(), time = 0, audioT = 0, cardT = 0;
let ivEma = 16.7, lowT = 0, highT = 0, lastDown = -1e9;
function frame(ts) {
  const el = ts - last;
  if (el < 12) { requestAnimationFrame(frame); return; }      // не больше ~60 кадров/с на 120–144 Гц экранах
  const rdt = Math.min(0.1, el / 1000); last = ts;
  // на паузе замираем всё анимированное: дождь, птицы, вода, дым, покачивание (сон считается ходом времени)
  const paused = G.frozen || (!G.speed && !G.player.sleeping), dt = paused ? 0 : rdt; time += dt;
  // адаптивное разрешение: если кадры дольше ~24 мс — снижаем плотность пикселей, при запасе возвращаем
  if (el < 250) {
    ivEma = ivEma * 0.95 + el * 0.05;
    if (ivEma > 24) { lowT += el; highT = 0; } else if (ivEma < 18) { highT += el; lowT = 0; } else { lowT = highT = 0; }
    if (lowT > 1500 && quality > 0.55) { quality = Math.max(0.55, quality - 0.15); lowT = 0; lastDown = ts; resize(); ivEma = 16.7; }
    else if (highT > 12000 && quality < 1 && ts - lastDown > 40000) { quality = Math.min(1, quality + 0.15); highT = 0; resize(); }
  }
  try {
    let t0 = now();
    updateInput(rdt); t0 = mark('input', t0);
    if (!G.frozen) simulate(rdt); t0 = mark('sim', t0);
    fx.update(dt, rdt);
    if (G.scene === 'world') fx.ambient(dt, time, G.weather.type);
    t0 = mark('fx', t0);
    if (G.scene === 'world') renderWorld(ctx, time, dt); else renderInterior(ctx, time, dt);
    t0 = mark('render', t0);
    updateHUD(rdt); updatePanel(rdt); t0 = mark('ui', t0);
    cardT -= rdt; if (cardT <= 0) { cardT = .5; updateCards(); }
    audioT -= rdt;
    if (audioT <= 0) {
      audioT = .5; const p = G.player;
      G.audioSt = { rain: G.wx.rain, night: darkness() > .55, fire: G.scene === 'world' ? Math.min(1, nearHeat(p.x, p.y, 7) * 2.2) : (G.interior?.heat ? .8 : 0), season: season(), indoor: G.scene !== 'world', chime: [...G.bMap.values()].some((b) => b.t === 'windchime') };
    }
    if (G.audioSt) audio.ambient(rdt, G.audioSt);
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

async function boot() {
  let fresh = false;
  const wantFresh = new URLSearchParams(location.search).has('fresh');
  if (wantFresh) history.replaceState(null, '', location.pathname);
  const src = await resolveSave(wantFresh);   // локально — сразу; в облачном режиме — после входа в аккаунт
  if (src.raw && load(src.raw)) { /* продолжаем */ } else { newGame(); fresh = true; }
  const picker = fresh && src.picker;
  ensureLinks(); computeCozy();
  initUI(); buildHUD(); buildBar(); initPanel(); initInput(canvas);
  centerOn(G.player.x, G.player.y); cam.zoom = innerWidth < 700 ? 0.8 : 1.05;
  G.speed = G.speed ?? 1; if (G.speed === 0 && !fresh) G.speed = 1;
  renderBar();
  setInterval(() => save(), 30000);
  addEventListener('beforeunload', () => { save(); cloud.flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); cloud.flush(); } });
  watchConflicts(); activateCloud();
  if (src.offline) toast('Нет связи с облаком — играем с сохранения на устройстве, позже отправим');
  if (src.push) { save(); cloud.flush(); }
  // новая игра = чистый первый запуск: стираем сохранение и перезагружаем страницу (?fresh=1) — дальше всё как при первом открытии, с приветственным окном и паузой
  S.hooks.newGame = async () => {
    G.noSave = true;   // иначе при закрытии страницы старая игра сохранится заново
    if (getMode() === 'cloud') { toast('Удаляю игру из облака…'); try { await cloud.deleteSave(); } catch (e) { } }
    wipe(); setMode(null); location.replace(location.pathname + '?fresh=1');
  };
  S.hooks.onSceneChange = () => { clearSelection(); UI.tool = 'select'; UI.def = null; UI.fdef = null; R.ghost = null; renderBar(); };
  if (fresh) {
    G.noSave = true; setSpeed(0);
    const intro = () => openIntro(() => { delete G.noSave; setSpeed(1); save(); });
    picker ? chooseStorage(intro) : intro();
  }
  window.cozy = { gl, enterHome, exitHome, placeFurn, FDEF, worldToScreen, screenToWorld, rotateCam, quality: () => quality, G, S, api, BDEF, cam, R, UI, save, load, prof, syncProf: (on) => { hooks.sync = on ? () => ctx.getImageData(0, 0, 1, 1) : null; } };
  requestAnimationFrame(frame);
}
boot();
