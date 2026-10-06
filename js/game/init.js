// Новая игра: стартовое состояние.
import { G, N, DAY } from './state.js';
import { generate } from './world.js';
import { initFog, reveal, START_R } from './fog.js';

export function newGame(seed = Math.floor(Math.random() * 1e9)) {
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, {
    ver: 1, seed, N, t: DAY * 8 / 24,
    inv: { axe: 1, bucket: 1, sticks: 14, stone: 8, fiber: 10, wood: 6, berries: 4, water: 4, seed_carrot: 3, seed_potato: 3, seed_herb: 2, seed_flower: 2 },
    capBonus: {},
    needs: { hunger: 85, thirst: 85, energy: 95, warmth: 70, mood: 60 },
    buffs: [], weather: { type: 'clear', left: 150 }, wx: { rain: 0, snow: 0, fog: 0, cloud: 0 }, sky: { rainbow: 0, aurora: 0, star: null },
    stats: {}, skills: {}, goals: {}, flags: {}, built: {}, pets: [], npc: null, scene: 'world', speed: 1, mail: [],
    cozy: { total: 0, out: 0, inn: 0, list: [] },
    player: { x: N / 2 + .5, y: N / 2 + 1.5, face: 1, outfit: { shirt: 0, hat: 0 }, path: [], work: null, fx: null, moving: false, sleeping: false },
    dirtyBlk: true, dirtyLinks: true,
  });
  generate(seed);
  initFog(); reveal(G.player.x, G.player.y, START_R);   // в начале виден только лагерь и окрестности
}
