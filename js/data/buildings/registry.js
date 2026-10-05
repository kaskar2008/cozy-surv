// Реестр построек. Описание постройки — это данные + функции рисования/поведения.
// Поля: id,name,cat,icon,size,cost,req,desc,tags,flat,walk,drag,h,cozy,net,light,burner,station,sit,
// draw(c,b,o) key(b,o) anim(c,b,t,o) update(b,dt,S) actions(b,S) panel(b,S) valid(x,y,rot,S)
export const BDEF = {};
export const BCATS = [
  { id: 'camp', name: 'Лагерь', icon: '🔥' },
  { id: 'home', name: 'Жильё', icon: '🏕️' },
  { id: 'store', name: 'Склад', icon: '📦' },
  { id: 'water', name: 'Вода', icon: '💧' },
  { id: 'farm', name: 'Огород и живность', icon: '🌱' },
  { id: 'craft', name: 'Мастерские', icon: '🔨' },
  { id: 'power', name: 'Энергия', icon: '⚡' },
  { id: 'light', name: 'Свет', icon: '🕯️' },
  { id: 'decor', name: 'Уют снаружи', icon: '🌼' },
  { id: 'leisure', name: 'Досуг', icon: '🎣' },
];
export function reg(list) {
  for (const d of list) {
    d.size = d.size || [1, 1];
    d.cost = d.cost || {};
    d.req = d.req || [];
    d.tags = d.tags || [];
    d.h = d.h || 60;
    BDEF[d.id] = d;
  }
}
