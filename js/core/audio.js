// Процедурный звук: мягкие эффекты, дождь, треск костра, тихая пентатоническая музыка.
let ctx = null, master = null, noiseBuf = null, rainG = null, muted = false, musicT = 2, fireT = 0, cricketT = 3, chimeT = 20;
const PENTA = [0, 2, 4, 7, 9];
let delay = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
  const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  // дождь
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = .5;
  rainG = ctx.createGain(); rainG.gain.value = 0; src.connect(f); f.connect(rainG); rainG.connect(master); src.start();
  // эхо для музыки
  delay = ctx.createDelay(1.5); delay.delayTime.value = .42; const fb = ctx.createGain(); fb.gain.value = .38; const wet = ctx.createGain(); wet.gain.value = .5;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
}
export const isMuted = () => muted;
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : .8; }

function tone(freq, t0, dur, type = 'sine', vol = .1, dest, slide) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + .05);
}
function noise(t0, dur, freq, vol = .1, q = 1, type = 'bandpass') {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
}
const hz = (n) => 261.63 * Math.pow(2, n / 12);
export function sfx(name) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  switch (name) {
    case 'place': tone(140, t, .2, 'sine', .22, null, 60); noise(t, .08, 900, .08); tone(hz(7), t + .08, .25, 'triangle', .06); break;
    case 'remove': noise(t, .18, 500, .12); tone(120, t, .2, 'sine', .15, null, 50); break;
    case 'pick': tone(520 + Math.random() * 120, t, .09, 'sine', .08, null, 760); break;
    case 'chop': noise(t, .09, 260, .22, .8); tone(110, t, .1, 'square', .05, null, 70); break;
    case 'harvest': [0, 4, 7, 12].forEach((n, i) => tone(hz(n + 12), t + i * .07, .3, 'triangle', .07)); break;
    case 'eat': noise(t, .06, 1500, .06); noise(t + .12, .06, 1200, .05); break;
    case 'chime': [0, 4, 7, 11].forEach((n, i) => tone(hz(n + 12), t + i * .12, .6, 'sine', .07, delay)); break;
    case 'splash': noise(t, .35, 1800, .1, .6); break;
    case 'craft': tone(300, t, .06, 'square', .04); tone(380, t + .1, .06, 'square', .04); break;
    case 'fire': noise(t, .5, 700, .1, .5); tone(90, t, .4, 'sine', .08); break;
    case 'no': tone(200, t, .1, 'square', .05); tone(160, t + .1, .14, 'square', .05); break;
    case 'meow': tone(620, t, .35, 'triangle', .08, null, 880); break;
    case 'woof': tone(220, t, .12, 'sawtooth', .07, null, 150); tone(210, t + .18, .12, 'sawtooth', .06, null, 140); break;
    case 'ui': tone(700, t, .05, 'sine', .04); break;
    case 'letter': [0, 7, 12].forEach((n, i) => tone(hz(n + 12), t + i * .1, .4, 'triangle', .06)); break;
  }
}
// st: {rain, night, fire, season, indoor, music}
export function ambient(dt, st) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  rainG.gain.value += ((st.rain * (st.indoor ? .05 : .13)) - rainG.gain.value) * Math.min(1, dt * 2);
  musicT -= dt;
  if (musicT <= 0 && st.music !== false) {
    musicT = (st.night ? 4 : 2.6) + Math.random() * 4;
    const base = st.night ? -12 : 0, n = PENTA[Math.floor(Math.random() * 5)] + (Math.random() < .3 ? 12 : 0);
    tone(hz(base + n), t, 2.4, 'sine', .05, delay); if (Math.random() < .35) tone(hz(base + n + 7), t + .3, 2, 'sine', .035, delay);
  }
  if (st.fire) { fireT -= dt; if (fireT <= 0) { fireT = .08 + Math.random() * .3; noise(t, .04 + Math.random() * .05, 2500 + Math.random() * 2500, .035 * st.fire, 2); } }
  if (st.night && st.season !== 3 && st.rain < .2 && !st.indoor) { cricketT -= dt; if (cricketT <= 0) { cricketT = .35 + Math.random() * .5; for (let i = 0; i < 3; i++) tone(4200, t + i * .06, .03, 'sine', .012); } }
  if (st.chime) { chimeT -= dt; if (chimeT <= 0) { chimeT = 14 + Math.random() * 20; [0, 4, 7].forEach((n, i) => tone(hz(n + 24), t + i * .22, 1.4, 'sine', .035, delay)); } }
}
