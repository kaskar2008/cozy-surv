// Погода и небесные эффекты в экранных координатах.
import { cam } from './camera.js';
import { G, hour, darkness, season } from '../game/state.js';

const rain = [], snow = [], leaves = [];
export function drawWeather(c, t, dt, opts = {}) {
  const W = cam.W, H = cam.H, wx = G.wx || { rain: 0, snow: 0, fog: 0, cloud: 0 };
  c.save(); c.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  if (!opts.indoor) {
    if (wx.cloud > .02) { c.fillStyle = `rgba(70,84,110,${.13 * wx.cloud})`; c.fillRect(0, 0, W, H); }
    // дождь
    const rn = Math.floor(260 * wx.rain);
    while (rain.length < rn) rain.push({ x: Math.random() * (W + 200), y: Math.random() * H, v: 700 + Math.random() * 400, l: 10 + Math.random() * 12 });
    while (rain.length > rn) rain.pop();
    if (rain.length) {
      c.strokeStyle = 'rgba(190,220,245,.5)'; c.lineWidth = 1.3; c.beginPath();
      for (const d of rain) { d.y += d.v * dt; d.x -= d.v * dt * .22; if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 200); } c.moveTo(d.x, d.y); c.lineTo(d.x + d.l * .22, d.y - d.l); }
      c.stroke();
    }
    // снег
    const sn = Math.floor(170 * wx.snow);
    while (snow.length < sn) snow.push({ x: Math.random() * W, y: Math.random() * H, v: 30 + Math.random() * 40, r: 1.4 + Math.random() * 2, ph: Math.random() * 6 });
    while (snow.length > sn) snow.pop();
    c.fillStyle = 'rgba(255,255,255,.88)';
    for (const f of snow) { f.y += f.v * dt; f.x += Math.sin(t * 1.2 + f.ph) * 18 * dt; if (f.y > H) { f.y = -6; f.x = Math.random() * W; } c.beginPath(); c.arc(f.x, f.y, f.r, 0, 7); c.fill(); }
    // осенние листья
    if (season() === 2 && wx.rain < .3) {
      if (leaves.length < 14 && Math.random() < dt * 2) leaves.push({ x: Math.random() * W, y: -10, v: 40 + Math.random() * 30, ph: Math.random() * 6, col: ['#d9843a', '#c9582f', '#e3b13e'][Math.floor(Math.random() * 3)] });
      for (let i = leaves.length - 1; i >= 0; i--) { const l = leaves[i]; l.y += l.v * dt; l.x += Math.sin(t * 1.5 + l.ph) * 30 * dt + 12 * dt; if (l.y > H + 10) leaves.splice(i, 1); else { c.save(); c.translate(l.x, l.y); c.rotate(Math.sin(t * 2 + l.ph)); c.fillStyle = l.col; c.beginPath(); c.ellipse(0, 0, 5, 2.6, 0, 0, 7); c.fill(); c.restore(); } }
    }
    // туман
    if (wx.fog > .02) { const g = c.createRadialGradient(W / 2, H / 2, H * .15, W / 2, H / 2, H * .95); g.addColorStop(0, `rgba(226,234,240,${.18 * wx.fog})`); g.addColorStop(1, `rgba(226,234,240,${.62 * wx.fog})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
    drawSky(c, t, W, H);
  }
  c.restore();
}

function drawSky(c, t, W, H) {
  const sk = G.sky; if (!sk) return;
  if (sk.rainbow > .01) {
    const cx = W * .5, cy = H * 1.1, R = Math.min(W, H) * 1.0;
    const cols = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa'];
    c.lineWidth = 8; c.globalAlpha = .38 * sk.rainbow;
    cols.forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.arc(cx, cy, R - i * 8, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); });
    c.globalAlpha = 1;
  }
  if (sk.aurora > .01) {
    for (let k = 0; k < 3; k++) {
      const g = c.createLinearGradient(0, 0, 0, H * .45);
      g.addColorStop(0, `rgba(${k ? 160 : 90},${k === 1 ? 120 : 240},${k === 2 ? 220 : 170},0)`);
      g.addColorStop(.5, `rgba(${k ? 150 : 100},${k === 1 ? 110 : 235},${k === 2 ? 210 : 160},${.2 * sk.aurora})`);
      g.addColorStop(1, 'rgba(120,255,200,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0);
      for (let x = 0; x <= W; x += 24) c.lineTo(x, H * .18 + k * 26 + Math.sin(x * .006 + t * .4 + k * 2) * 34 + Math.sin(x * .017 + t * .7) * 10);
      c.lineTo(W, 0); c.closePath();
      c.save(); c.globalAlpha = .9; c.translate(0, 0); c.fill(); c.restore();
    }
  }
  const st = sk.star;
  if (st) {
    c.strokeStyle = `rgba(255,250,220,${Math.max(0, st.life)})`; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(st.x, st.y); c.lineTo(st.x - st.vx * .09, st.y - st.vy * .09); c.stroke();
  }
}
