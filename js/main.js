// Точка входа: инициализация, главный цикл, автосохранение.
import { G, N, darkness, season } from './game/state.js';
import { newGame } from './game/init.js';
import { load, save, hasSave, wipe } from './game/save.js';
import { cam, centerOn } from './render/camera.js';
import { renderWorld, R } from './render/scene.js';
import { renderInterior } from './game/interior.js';
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
import { initInput, updateInput } from './input.js';
import { UI } from './ui/state.js';
import * as api from './game/api.js';
import { prof, mark, now, hooks } from './core/prof.js';

const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
let quality = 1;
function resize() {
  cam.dpr = Math.min(2, window.devicePixelRatio || 1) * quality; cam.W = innerWidth; cam.H = innerHeight;
  canvas.width = Math.floor(cam.W * cam.dpr); canvas.height = Math.floor(cam.H * cam.dpr);
  canvas.style.width = cam.W + 'px'; canvas.style.height = cam.H + 'px';
}
addEventListener('resize', resize); resize();

let last = performance.now(), time = 0, audioT = 0, cardT = 0;
let ivEma = 16.7, lowT = 0, highT = 0, lastDown = -1e9;
function frame(ts) {
  const el = ts - last;
  if (el < 12) { requestAnimationFrame(frame); return; }      // не больше ~60 кадров/с на 120–144 Гц экранах
  const rdt = Math.min(0.1, el / 1000); last = ts;
  // на паузе замираем всё анимированное: дождь, птицы, вода, дым, покачивание (сон считается ходом времени)
  const paused = !G.speed && !G.player.sleeping, dt = paused ? 0 : rdt; time += dt;
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
    simulate(rdt); t0 = mark('sim', t0);
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

function boot() {
  let fresh = false;
  if (new URLSearchParams(location.search).has('fresh')) { wipe(); history.replaceState(null, '', location.pathname); }
  if (hasSave() && load()) { /* продолжаем */ } else { newGame(); fresh = true; }
  ensureLinks(); computeCozy();
  initUI(); buildHUD(); buildBar(); initPanel(); initInput(canvas);
  centerOn(G.player.x, G.player.y); cam.zoom = innerWidth < 700 ? 0.8 : 1.05;
  G.speed = G.speed ?? 1; if (G.speed === 0 && !fresh) G.speed = 1;
  renderBar();
  setInterval(() => save(), 30000);
  addEventListener('beforeunload', () => save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  S.hooks.newGame = () => { wipe(); newGame(); ensureLinks(); computeCozy(); centerOn(G.player.x, G.player.y); clearSelection(); UI.tool = 'select'; UI.def = null; UI.fdef = null; renderBar(); setSpeed(1); save(); };
  S.hooks.onSceneChange = () => { clearSelection(); UI.tool = 'select'; UI.def = null; UI.fdef = null; R.ghost = null; renderBar(); };
  if (fresh) { setSpeed(0); openIntro(() => { setSpeed(1); save(); }); }
  window.cozy = { quality: () => quality, G, S, api, BDEF, cam, R, UI, save, load, prof, syncProf: (on) => { hooks.sync = on ? () => ctx.getImageData(0, 0, 1, 1) : null; } };
  requestAnimationFrame(frame);
}
boot();
