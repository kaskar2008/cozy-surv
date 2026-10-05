// Лёгкий профайлер кадров: скользящее среднее мс по фазам (window.cozy.prof).
export const prof = {};
const now = () => performance.now();
export const hooks = { sync: null };
export function mark(name, t0) { if (hooks.sync) hooks.sync(); const d = now() - t0; prof[name] = (prof[name] ?? d) * 0.95 + d * 0.05; return now(); }
export { now };
