// Эмодзи → картинки Twemoji (assets/twemoji, CC-BY 4.0): значки выглядят одинаково на любой платформе.
// В данных и строках остаются обычные эмодзи; в DOM их подменяет observer, на canvas — drawEmoji/drawRich.
const files = import.meta.glob('../../assets/twemoji/*.svg', { eager: true, query: '?url', import: 'default' });
const URLS = new Map(Object.entries(files).map(([p, u]) => [p.slice(p.lastIndexOf('/') + 1, -4), u]));

const EMOJI = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;
const HAS = /\p{Extended_Pictographic}/u;
// имя файла Twemoji: кодпоинты через «-», FE0F отбрасывается, если нет ZWJ-склейки
const keyOf = (s) => { let cps = [...s].map((c) => c.codePointAt(0)); if (!cps.includes(0x200d)) cps = cps.filter((c) => c !== 0xfe0f); return cps.map((c) => c.toString(16)).join('-'); };

const imgs = new Map();
export function emojiImg(sym) {
  const k = keyOf(sym); let i = imgs.get(k);
  if (i === undefined) { const u = URLS.get(k); if (u) { i = new Image(); i.decoding = 'sync'; i.src = u; } else i = null; imgs.set(k, i); }
  return i;
}
const ready = (i) => i && i.complete && i.naturalWidth > 0;
export const preloadEmoji = () => Promise.all([...URLS.keys()].map((k) => { const i = emojiImg(String.fromCodePoint(...k.split('-').map((h) => parseInt(h, 16)))); return i && !i.complete ? new Promise((r) => { i.onload = i.onerror = r; }) : 0; }));

// ───────── DOM ─────────
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'SELECT', 'TITLE']);
function make(sym) {
  const t = emojiImg(sym); if (!t) return null;
  const i = t.cloneNode(); i.className = 'em'; i.alt = sym; i.draggable = false; return i;
}
function upgradeText(n) {
  const s = n.nodeValue; if (!s || !HAS.test(s) || SKIP.has(n.parentNode?.nodeName)) return;
  // всё в одном элементе <e-t> (не span: селекторы кода по span его не задевают): в flex-контейнерах (кнопки панели) текстовый узел остаётся одним элементом, а не распадается на части
  const frag = document.createElement('e-t'); let last = 0, done = false;
  for (const m of s.matchAll(EMOJI)) {
    const im = make(m[0]); if (!im) continue;
    if (m.index > last) frag.append(s.slice(last, m.index));
    frag.append(im); last = m.index + m[0].length; done = true;
  }
  if (!done) return;
  if (last < s.length) frag.append(s.slice(last));
  n.replaceWith(frag);
}
function upgradeTree(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), list = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) list.push(n);
  for (const n of list) upgradeText(n);
}
export function initEmoji(root = document.body) {
  upgradeTree(root);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') upgradeText(m.target);
      else for (const n of m.addedNodes) { if (n.nodeType === 3) upgradeText(n); else if (n.nodeType === 1) upgradeTree(n); }
    }
  }).observe(root, { childList: true, subtree: true, characterData: true });
}

// ───────── canvas ─────────
// Один эмодзи по центру (x, y), size — высота в пикселях
export function drawEmoji(c, sym, x, y, size) {
  const i = emojiImg(sym);
  if (ready(i)) c.drawImage(i, x - size / 2, y - size / 2, size, size);
}
// Строка вперемешку с эмодзи, выровнена по центру X; шрифт уже задан в c, size — его размер.
// outline: true — сначала обводка текста (strokeStyle/lineWidth уже заданы в c)
export function drawRich(c, text, X, Y, size, outline = false) {
  if (!HAS.test(text)) { if (outline) c.strokeText(text, X, Y); c.fillText(text, X, Y); return; }
  const es = size * 1.15, parts = []; let last = 0, w = 0;
  const addTxt = (s) => { if (s) { const tw = c.measureText(s).width; parts.push({ s, w: tw }); w += tw; } };
  for (const m of text.matchAll(EMOJI)) {
    const i = emojiImg(m[0]); if (!i) continue;
    addTxt(text.slice(last, m.index)); parts.push({ i, w: es }); w += es; last = m.index + m[0].length;
  }
  addTxt(text.slice(last));
  const al = c.textAlign; c.textAlign = 'left'; let x = X - w / 2;
  for (const p of parts) {
    if (p.i) { if (ready(p.i)) c.drawImage(p.i, x, Y - size * .92, es, es); }
    else { if (outline) c.strokeText(p.s, x, Y); c.fillText(p.s, x, Y); }
    x += p.w;
  }
  c.textAlign = al;
}
