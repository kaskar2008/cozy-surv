// Точка входа: инициализация, главный цикл, автосохранение.
import { G, N, darkness } from './game/state.js';
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

const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
function resize() {
  cam.dpr = Math.min(2, window.devicePixelRatio || 1); cam.W = innerWidth; cam.H = innerHeight;
  canvas.width = Math.floor(cam.W * cam.dpr); canvas.height = Math.floor(cam.H * cam.dpr);
  canvas.style.width = cam.W + 'px'; canvas.style.height = cam.H + 'px';
}
addEventListener('resize', resize); resize();

let last = performance.now(), time = 0, audioT = 0, cardT = 0;
function frame(ts) {
  const dt = Math.min(0.1, (ts - last) / 1000); last = ts; time += dt;
  try {
    updateInput(dt);
    simulate(dt);
    fx.update(dt);
    if (G.scene === 'world') fx.ambient(dt * (G.speed ? 1 : .2), time, G.weather.type);
    if (G.scene === 'world') renderWorld(ctx, time, dt); else renderInterior(ctx, time, dt);
    updateHUD(dt); updatePanel(dt);
    cardT -= dt; if (cardT <= 0) { cardT = .5; updateCards(); }
    audioT -= dt;
    if (audioT <= 0) {
      audioT = .5; const p = G.player;
      G.audioSt = { rain: G.wx.rain, night: darkness() > .55, fire: G.scene === 'world' ? Math.min(1, nearHeat(p.x, p.y, 7) * 2.2) : (G.interior?.heat ? .8 : 0), season: Math.floor(G.t / 300 / 6) % 4, indoor: G.scene !== 'world', chime: [...G.bMap.values()].some((b) => b.t === 'windchime') };
    }
    if (G.audioSt) audio.ambient(dt, G.audioSt);
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

function boot() {
  let fresh = false;
  if (new URLSearchParams(location.search).has('fresh')) { wipe(); history.replaceState(null, '', location.pathname); }
  if (hasSave() && load()) { /* продолжаем */ } else { newGame(); fresh = true; }
  ensureLinks(); computeCozy();
  initUI(); buildHUD(); buildBar(); initPanel(); initInput(canvas);
  centerOn(G.player.x, G.player.y); cam.zoom = 1.05;
  G.speed = G.speed ?? 1; if (G.speed === 0 && !fresh) G.speed = 1;
  renderBar();
  setInterval(() => save(), 30000);
  addEventListener('beforeunload', () => save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  S.hooks.newGame = () => { wipe(); newGame(); ensureLinks(); computeCozy(); centerOn(G.player.x, G.player.y); clearSelection(); UI.tool = 'select'; UI.def = null; UI.fdef = null; renderBar(); setSpeed(1); save(); };
  S.hooks.onSceneChange = () => { clearSelection(); UI.tool = 'select'; UI.def = null; UI.fdef = null; R.ghost = null; renderBar(); };
  if (fresh) { setSpeed(0); openIntro(() => { setSpeed(1); save(); }); }
  window.cozy = { G, S, api, BDEF, cam, R, UI, save, load };
  requestAnimationFrame(frame);
}
boot();
