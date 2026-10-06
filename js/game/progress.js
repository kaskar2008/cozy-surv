// Прогресс текущего процесса постройки (готовка, компост, помол): { p: 0..1, paused, col } или null.
export const COMPOST_T = 70, MILL_T = 12;

// Время стройки (секунд игрового времени при ×1): от стоимости, чтобы не стопорить игру
export const BUILD_K = 1;
export function buildTime(def) {
  const sum = Object.values(def.cost).reduce((a, v) => a + v, 0);
  if (def.buildT !== undefined) return def.buildT * BUILD_K;
  const t = def.drag ? Math.min(1.2, .35 + .1 * sum) : Math.min(12, .4 + .2 * sum);
  return t * BUILD_K;
}

export function workProgress(b, def) {
  const st = b.st;
  if (b.bld) return { p: Math.min(1, b.bld.p), col: '#8ec7f0', build: true };
  if (def.station && st.cur) return { p: Math.max(0, Math.min(1, 1 - st.cur.left / st.cur.total)), paused: !!st.paused, col: '#e0a24a' };
  if (def.compost && st.load > 0) return { p: Math.min(1, st.t / COMPOST_T), col: '#9bc46a' };
  if (def.mill && st.on && st.prog > 0) return { p: Math.min(1, st.prog / MILL_T), col: '#e8d28a' };
  return null;
}
