import { reg } from './registry.js';
import { P, box, cyl, blob, shadow, line3, poly, plane, gable, pyramid, wallRect, lean, curve3, ribbon, glow } from '../../core/iso.js';

reg([
  {
    id: 'basket', name: 'Корзина', cat: 'store', icon: '🧺', cost: { sticks: 6, fiber: 4 }, h: 36, cozy: 1,
    desc: 'Плетёная корзина для припасов: больше места для еды и семян. Если поставить рядом с мастерской, курятником, ульем — сама заберёт продукцию.',
    tags: ['storage'], cap: { food: 20, seed: 10 },
    draw(c) { shadow(c, .5, .5, .34, .16); cyl(c, .5, .5, 0, .3, 14, '#c9a05a', { rings: [.3, .62], top: '#8a6a3a' }); curve3(c, [.2, .5, 14], [.5, .5, 34], [.8, .5, 14], '#a9803f', 2.4); },
  },
  {
    id: 'crate', name: 'Ящик', cat: 'store', icon: '📦', cost: { wood: 6 }, h: 34, cozy: 1,
    desc: 'Вместительный ящик для материалов. Поставь вплотную к производству — продукция будет автоматически складываться внутрь.',
    tags: ['storage'], cap: { mat: 30, food: 8 },
    draw(c) { shadow(c, .5, .5, .42, .18); box(c, .1, .1, 0, .8, .8, 18, '#b98557', { tex: 'planks' }); box(c, .06, .06, 18, .88, .88, 3, '#a8734a'); for (const x of [.1, .78]) box(c, x, .1, 0, .12, .8, 18, '#8b5a3a', { top: '#8b5a3a' }); },
  },
  {
    id: 'barrel', name: 'Бочка', cat: 'store', icon: '🛢️', cost: { planks: 4, rope: 1 }, req: ['workbench'], h: 40, cozy: 1,
    desc: 'Бочка для воды и припасов: можно носить с собой больше воды.',
    tags: ['storage'], cap: { drink: 10, mat: 10 },
    draw(c) { shadow(c, .5, .5, .36, .18); cyl(c, .5, .5, 0, .32, 28, '#8b5e3c', { rings: [.2, .8], ringCol: '#4a3a30', top: '#5a3d26' }); },
  },
  {
    id: 'shed', name: 'Сарай', cat: 'store', icon: '🏚️', size: [2, 2], cost: { wood: 20, planks: 10, nails: 6 }, req: ['workbench'], h: 90, cozy: 2,
    desc: 'Большой сарай: много места для материалов и инструментов.',
    tags: ['storage'], cap: { mat: 120, seed: 20 },
    draw(c) {
      shadow(c, 1, 1, .9, .2);
      box(c, .1, .1, 0, 1.8, 1.8, 36, '#a9815a', { tex: 'planks' });
      wallRect(c, 'L', 1.9, .55, 1.45, 0, 28, '#6b4328', '#3a2a22'); line3(c, [1, 1.9, 0], [1, 1.9, 28], '#3a2a22', 1.4);
      wallRect(c, 'R', 1.9, .4, .9, 14, 28, '#bfe6f2', '#6b4328');
      gable(c, -.05, -.05, 36, 2.1, 2.1, 22, .2, '#7f8aa0', '#a9815a', 'y');
    },
  },
  {
    id: 'cellar', name: 'Погреб', cat: 'store', icon: '🕳️', size: [2, 2], cost: { stone: 24, wood: 10, planks: 6 }, req: ['shed'], h: 60, cozy: 1,
    desc: 'Прохладный погреб: много места для еды и готовых блюд. Рядом с бродильной бочкой ускоряет ферментацию.',
    tags: ['storage', 'cool'], cap: { food: 70, meal: 34 },
    draw(c) {
      shadow(c, 1, 1, .95, .2);
      blob(c, 1, 1, 6, 52, 26, '#7fb858', { lo: '#5f9a44' });
      box(c, .35, 1.0, 0, 1.3, .8, 18, '#8d8f95', { tex: 'stone' });
      wallRect(c, 'L', 1.8, .55, 1.45, 0, 15, '#6b4328', '#2a1a10');
      line3(c, [1, 1.8, 0], [1, 1.8, 15], '#2a1a10', 1.4);
    },
  },
]);
