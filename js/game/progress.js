// Прогресс текущего процесса постройки (готовка, компост, помол): { p: 0..1, paused, col } или null.
export const COMPOST_T = 70, MILL_T = 12;

export function workProgress(b, def) {
  const st = b.st;
  if (def.station && st.cur) return { p: Math.max(0, Math.min(1, 1 - st.cur.left / st.cur.total)), paused: !!st.paused, col: '#e0a24a' };
  if (def.compost && st.load > 0) return { p: Math.min(1, st.t / COMPOST_T), col: '#9bc46a' };
  if (def.mill && st.on && st.prog > 0) return { p: Math.min(1, st.prog / MILL_T), col: '#e8d28a' };
  return null;
}
