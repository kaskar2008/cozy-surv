// Глобальное состояние игры и время.
export const N = 80;            // размер острова в клетках (вдвое больше по площади, чем раньше: 56×56)
export const DAY = 480;         // секунд в игровых сутках (при скорости x1)
export const SEASON_DAYS = 6;
export const G = {};

export const day = () => Math.floor(G.t / DAY);
export const tod = () => (G.t % DAY) / DAY;
export const hour = () => tod() * 24;
export const season = () => Math.floor(day() / SEASON_DAYS) % 4;
export const year = () => Math.floor(day() / (SEASON_DAYS * 4)) + 1;
// 0 — полдень светло, 1 — глубокая ночь
export function darkness() {
  const sun = Math.cos((hour() - 12) / 12 * Math.PI);
  return Math.min(1, Math.max(0, (0.12 - sun) / 0.6));
}
export const isNight = () => darkness() > 0.55;
export const fmtClock = () => { const hh = Math.floor(hour()), mm = Math.floor((hour() % 1) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
