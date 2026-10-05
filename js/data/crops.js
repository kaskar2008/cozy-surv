// Культуры. grow — секунд роста при благоприятных условиях; good — лучшие сезоны (+30%),
// ok — обычные; в остальные сезоны рост медленный. Зимой на грядках рост невозможен (кроме теплицы).
// seasons: 0 весна, 1 лето, 2 осень, 3 зима
export const CROPS = {
  carrot:     { n: 'Морковь',   seed: 'seed_carrot',     out: 'carrot',     yield: [3, 5], grow: 300, good: [0, 2], ok: [1], col: '#f08a3c' },
  potato:     { n: 'Картофель', seed: 'seed_potato',     out: 'potato',     yield: [3, 6], grow: 400, good: [0, 2], ok: [1], col: '#c9a56a' },
  tomato:     { n: 'Томаты',    seed: 'seed_tomato',     out: 'tomato',     yield: [3, 5], grow: 500, good: [1], ok: [0], col: '#e5493a' },
  pumpkin:    { n: 'Тыква',     seed: 'seed_pumpkin',    out: 'pumpkin',    yield: [1, 2], grow: 700, good: [2], ok: [1], col: '#f2993a' },
  wheat:      { n: 'Пшеница',   seed: 'seed_wheat',      out: 'wheat',      yield: [4, 7], grow: 600, good: [1, 2], ok: [0], col: '#e6c45a' },
  strawberry: { n: 'Клубника',  seed: 'seed_strawberry', out: 'strawberry', yield: [3, 5], grow: 450, good: [0, 1], ok: [2], col: '#e8445c' },
  cabbage:    { n: 'Капуста',   seed: 'seed_cabbage',    out: 'cabbage',    yield: [2, 3], grow: 450, good: [0, 2], ok: [1], col: '#8fcf7a' },
  corn:       { n: 'Кукуруза',  seed: 'seed_corn',       out: 'corn',       yield: [2, 4], grow: 600, good: [1], ok: [0, 2], col: '#f1d24a' },
  herb:       { n: 'Мята',      seed: 'seed_herb',       out: 'herbs',      yield: [3, 5], grow: 250, good: [0, 1, 2], ok: [], col: '#6fc47a' },
  flower:     { n: 'Цветы',     seed: 'seed_flower',     out: 'flowers',    yield: [3, 5], grow: 300, good: [0, 1], ok: [2], col: '#f08ac0', decor: true },
};
export const SEASONS = ['Весна', 'Лето', 'Осень', 'Зима'];
export const SEASON_ICON = ['🌱', '☀️', '🍂', '❄️'];
// множитель роста культуры в сезон
export function growMult(crop, season, indoor) {
  const c = CROPS[crop];
  if (season === 3 && !indoor) return 0;
  if (c.good.includes(season)) return 1.3;
  if (c.ok.includes(season) || (season === 3 && indoor)) return 1;
  return 0.5;
}
