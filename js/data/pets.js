// Питомцы: чем кормить (сколько сытости даёт 1 штука) и пороги.
export const PET_FOOD = {
  cat: { fish: 35, grilled_fish: 55, smoked_fish: 55, milk: 30, egg: 25 },
  dog: { fish: 30, grilled_fish: 50, smoked_fish: 50, egg: 25, cheese: 30, bread: 30 },
};
export const HUNGRY = 40;                 // ниже — питомец просит еду (значок над головой)
export const petWord = (p) => (p.kind === 'cat' ? 'Кот' : 'Пёс');
