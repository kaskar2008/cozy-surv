// Рецепты по станциям. in/out — предметы, t — секунд работы.
// sk: [навык, уровень] — рецепт открывается с уровня навыка (см. data/skills.js).
// heat: станция должна стоять рядом с горящим огнём; в `in` вода берётся из сети труб (если станция подключена) или из инвентаря.
const R = (out, inn, t, extra = {}) => ({ out, in: inn, t, ...extra });
export const STATIONS = {
  hand: { name: 'Крафт', icon: '🛠️', recipes: [
    R({ rope: 1 }, { fiber: 3 }, 3),
    R({ pickaxe: 1 }, { sticks: 3, stone: 3, fiber: 2 }, 4, { once: true }),
    R({ rod: 1 }, { sticks: 4, fiber: 3 }, 4, { once: true }),
    R({ axe: 1 }, { sticks: 3, stone: 2, fiber: 2 }, 4, { once: true }),
    R({ bucket: 1 }, { sticks: 4, fiber: 4 }, 4, { once: true }),
    R({ flowers: 2 }, { seed_flower: 1 }, 2, { hidden: true }),
  ] },
  workbench: { name: 'Верстак', icon: '🔨', recipes: [
    R({ planks: 3 }, { wood: 2 }, 4),
    R({ rope: 2 }, { fiber: 4 }, 3),
    R({ nails: 4 }, { scrap: 1 }, 4),
    R({ bucket: 1 }, { planks: 2, rope: 1 }, 4, { once: true }),
    R({ art: 1 }, { cloth: 1, sticks: 2 }, 6, { name: 'Холст в раме' }),
  ] },
  campfire: { name: 'Костёр', icon: '🔥', heat: 'self', recipes: [
    R({ baked_potato: 1 }, { potato: 1 }, 8),
    R({ grilled_fish: 1 }, { fish: 1 }, 8),
    R({ roast_mushrooms: 1 }, { mushroom: 2 }, 7),
    R({ roast_corn: 1 }, { corn: 1 }, 7),
    R({ baked_apple: 1 }, { apple: 1 }, 7),
    R({ popcorn: 2 }, { corn: 2 }, 9),
    R({ charcoal: 1 }, { wood: 3 }, 22, { name: 'Выжечь уголь' }),
  ] },
  pot: { name: 'Котелок', icon: '🍲', heat: 'near', water: true, recipes: [
    R({ veg_soup: 1 }, { carrot: 1, potato: 1, water: 1 }, 14),
    R({ mushroom_soup: 1 }, { mushroom: 2, herbs: 1, water: 1 }, 14),
    R({ pumpkin_soup: 1 }, { pumpkin: 1, water: 1 }, 16),
    R({ fish_soup: 1 }, { fish: 1, potato: 1, water: 1 }, 16),
    R({ stew: 1 }, { potato: 1, carrot: 1, cabbage: 1, mushroom: 1, water: 1 }, 20),
  ] },
  kettle: { name: 'Чайник', icon: '🫖', heat: 'near', water: true, recipes: [
    R({ herbal_tea: 1 }, { herbs: 2, water: 1 }, 8),
    R({ berry_tea: 1 }, { berries: 3, water: 1 }, 8),
    R({ cider: 1 }, { apple: 2, honey: 1, water: 1 }, 10),
    R({ honey_milk: 1 }, { milk: 1, honey: 1 }, 8),
  ] },
  oven: { name: 'Печь', icon: '🥖', recipes: [
    R({ bread: 1 }, { flour: 2, water: 1, wood: 1 }, 18),
    R({ apple_pie: 1 }, { apple: 2, flour: 1, honey: 1, wood: 1 }, 24),
    R({ berry_pie: 1 }, { berries: 4, flour: 1, honey: 1, wood: 1 }, 24),
    R({ pizza: 1 }, { flour: 1, tomato: 2, cheese: 1, wood: 1 }, 26),
    R({ cake: 1 }, { flour: 2, egg: 2, strawberry: 2, honey: 1, wood: 1 }, 30),
    R({ herb_bun: 2 }, { flour: 1, herbs: 2, water: 1, wood: 1 }, 20, { sk: ['cook', 3] }),
    R({ fish_pie: 1 }, { flour: 1, fish: 2, potato: 1, wood: 1 }, 26, { sk: ['cook', 6] }),
    R({ pumpkin_pie: 1 }, { pumpkin: 1, flour: 1, milk: 1, honey: 1, wood: 1 }, 28, { sk: ['cook', 8] }),
  ], water: true },
  stove: { name: 'Плита', icon: '🍳', water: true, recipes: [
    R({ omelet: 1 }, { egg: 2, milk: 1, wood: 1 }, 10),
    R({ pancakes: 2 }, { flour: 1, egg: 1, milk: 1, honey: 1, wood: 1 }, 14),
    R({ salad: 1 }, { tomato: 1, cabbage: 1, carrot: 1 }, 6),
    R({ jam: 1 }, { berries: 3, honey: 1, wood: 1 }, 14),
    R({ veg_soup: 1 }, { carrot: 1, potato: 1, water: 1, wood: 1 }, 12),
    R({ stew: 1 }, { potato: 1, carrot: 1, cabbage: 1, mushroom: 1, water: 1, wood: 1 }, 16),
    R({ herbal_tea: 1 }, { herbs: 2, water: 1 }, 6),
  ] },
  kiln: { name: 'Обжиговая печь', icon: '🏺', recipes: [
    R({ bricks: 3 }, { clay: 3, wood: 1 }, 14),
    R({ glass: 2 }, { sand: 3, wood: 1 }, 16),
    R({ charcoal: 2 }, { wood: 3 }, 16),
    R({ pot: 1 }, { clay: 2, wood: 1 }, 10),
  ] },
  loom: { name: 'Ткацкий станок', icon: '🧵', recipes: [
    R({ cloth: 1 }, { fiber: 4 }, 8),
    R({ cloth: 2 }, { reeds: 3, fiber: 2 }, 10),
    R({ rope: 3 }, { reeds: 3 }, 6),
  ] },
  easel: { name: 'Мольберт', icon: '🎨', recipes: [
    R({ art: 1 }, { cloth: 1, flowers: 1 }, 20, { name: 'Нарисовать картину', mood: 14 }),
  ] },
  smoker: { name: 'Коптильня', icon: '💨', recipes: [
    R({ smoked_fish: 1 }, { fish: 1, wood: 1 }, 24),
  ] },
  ferment: { name: 'Бродильня', icon: '🫙', water: true, recipes: [
    R({ sauerkraut: 1 }, { cabbage: 2, water: 1 }, 40),
    R({ cheese: 1 }, { milk: 2 }, 50),
  ] },
  drying: { name: 'Сушилка', icon: '🧺', heatBoost: true, recipes: [
    R({ dried_fruit: 1 }, { berries: 4 }, 22),
    R({ dried_fruit: 1 }, { apple: 2 }, 22),
    R({ dried_fruit: 2 }, { strawberry: 3 }, 24),
  ] },
  quern: { name: 'Жернова', icon: '⚙️', recipes: [
    R({ flour: 2 }, { wheat: 3 }, 10),
  ] },
};
