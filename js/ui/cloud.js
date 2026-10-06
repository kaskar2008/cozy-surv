// Окна облачного сохранения: выбор места хранения, вход/регистрация, перенос в облако, конфликты.
import { h } from '../core/util.js';
import { G } from '../game/state.js';
import * as cloud from '../game/cloud.js';
import { getMode, setMode, readCache, writeCache, readLocal, copyCloudToLocal, save } from '../game/save.js';
import { openModal, closeModal, toast } from './ui.js';

const STICKY = { cls: 'narrow', sticky: true, noClose: true };
const fmt = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const info = (r) => `День ${r.day || '?'} · сохранена ${fmt(r.savedAt)}`;
// после загрузки чужого сохранения перезагружаем страницу: текущая игра в памяти не должна перезаписать его при закрытии
const reloadClean = () => { G.noSave = true; location.replace(location.pathname); };
const takeRemote = (r) => { writeCache(cloud.uid(), r.json); setMode('cloud'); reloadClean(); };
const confirmStep = (title, text, okLabel, onYes, onNo) => openModal(title, h('div', { class: 'menu' }, h('p', null, text),
  h('button', { class: 'danger', onclick: () => onYes() }, okLabel), h('button', { onclick: () => onNo() }, 'Назад')), STICKY);
const failModal = (e, onBack) => openModal('☁️ Облако недоступно', h('div', { class: 'menu' }, h('p', null, cloud.errText(e)), h('button', { onclick: onBack }, 'Назад')), STICKY);

// ---------- вход / регистрация ----------
export async function openAuth({ onSuccess, onBack, backLabel = '← Назад', title = '☁️ Вход в облако' }) {
  if (!cloud.configured()) {
    openModal(title, h('div', { class: 'menu' }, h('p', null, 'Облако пока не подключено к этой версии игры.'), h('button', { onclick: onBack }, backLabel)), STICKY); return;
  }
  openModal(title, h('p', { class: 'muted' }, 'Подключаюсь к облаку…'), STICKY);
  try { await cloud.init(); } catch (e) { failModal(e, onBack); return; }
  if (cloud.signedIn()) { onSuccess(); return; }
  let reg = false, busy = false;
  const mail = h('input', { class: 'inp', type: 'email', placeholder: 'Почта', autocomplete: 'email', required: true });
  const pass = h('input', { class: 'inp', type: 'password', placeholder: 'Пароль (от 6 символов)', required: true });
  const msg = h('p', { class: 'auth-msg' });
  const go = h('button', { class: 'primary', type: 'submit' });
  const swap = h('button', { type: 'button', class: 'link' });
  const forgot = h('button', { type: 'button', class: 'link' }, 'Забыл пароль');
  const say = (t, ok) => { msg.textContent = t; msg.className = 'auth-msg' + (ok ? ' ok' : ''); };
  const lock = (b) => { busy = b; for (const el of [mail, pass, go, swap, forgot]) el.disabled = b; };
  const draw = () => {
    go.textContent = reg ? 'Создать аккаунт' : 'Войти';
    swap.textContent = reg ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться';
    pass.autocomplete = reg ? 'new-password' : 'current-password'; forgot.style.display = reg ? 'none' : ''; say('');
  };
  swap.onclick = () => { reg = !reg; draw(); };
  forgot.onclick = async () => {
    if (!mail.value.trim()) return say('Введи почту, и я отправлю письмо для сброса пароля');
    lock(true); try { await cloud.resetPassword(mail.value.trim()); say('Письмо отправлено — проверь почту (и папку «Спам»)', true); } catch (e) { say(cloud.errText(e)); } lock(false);
  };
  const form = h('form', { class: 'auth', onsubmit: async (e) => {
    e.preventDefault(); if (busy) return;
    lock(true); say(reg ? 'Создаю аккаунт…' : 'Вхожу…', true);
    try { await (reg ? cloud.signUp : cloud.signIn)(mail.value.trim(), pass.value); } catch (er) { say(cloud.errText(er)); lock(false); return; }
    onSuccess();
  } }, mail, pass, msg, go, swap, forgot, h('button', { type: 'button', onclick: onBack }, backLabel));
  draw();
  openModal(title, h('div', null, h('p', { class: 'muted' }, 'Нужны только почта и пароль. Игра будет храниться в облаке, и её можно продолжить с любого устройства.'), form), STICKY);
  setTimeout(() => mail.focus(), 50);
}

// ---------- выбор места хранения при создании игры ----------
export function chooseStorage(done) {
  const opt = (ic, name, hint, fn, off) => h('button', { class: 'choice', disabled: off, onclick: fn }, h('span', { class: 'ci' }, ic), h('div', null, h('b', null, name), h('small', null, hint)));
  const pick = () => openModal('🏝️ Где хранить игру?', h('div', { class: 'menu' },
    opt('💾', 'На этом устройстве', 'Без регистрации. Игра хранится в браузере; другой браузер или устройство её не увидят.', () => { setMode('local'); closeModal(); done(); }),
    opt('☁️', 'В облаке', cloud.configured() ? 'Нужны почта и пароль. Продолжишь с любого устройства.' : 'Пока недоступно в этой версии', () => openAuth({ title: '☁️ Игра в облаке', onBack: pick, onSuccess: afterLogin }), !cloud.configured()),
    h('p', { class: 'muted' }, 'Потом можно переключиться в меню (⚙️).')), STICKY);
  const afterLogin = async () => {
    let r; try { r = await cloud.fetchSave(); } catch (e) { failModal(e, pick); return; }
    if (!r) { setMode('cloud'); closeModal(); done(); return; }
    const found = () => openModal('☁️ В облаке уже есть игра', h('div', { class: 'menu' }, h('p', null, info(r)),
      h('button', { class: 'primary', onclick: () => takeRemote(r) }, '▶ Продолжить эту игру'),
      h('button', { class: 'danger', onclick: () => confirmStep('🌱 Начать заново?', 'Старая игра в облаке будет заменена новой, когда ты начнёшь жить.', 'Заменить новой игрой', () => { setMode('cloud'); closeModal(); done(); }, found) }, '🌱 Начать новую'),
      h('button', { onclick: pick }, '← Назад')), STICKY);
    found();
  };
  pick();
}

// ---------- запуск: откуда брать игру ----------
// Возвращает { raw, fresh, picker, push, offline }: raw — текст сохранения, fresh — нужна новая игра, picker — спросить, где хранить.
export async function resolveSave(wantFresh) {
  if (wantFresh) return { raw: null, fresh: true, picker: true };
  if (getMode() !== 'cloud') { const raw = readLocal(); return { raw, fresh: !raw, picker: !raw }; }
  openModal('☁️ Облако', h('p', { class: 'muted' }, 'Подключаюсь к облаку…'), STICKY);
  let offline = false;
  try { await cloud.init(); } catch (e) { offline = true; }
  const u = cloud.uid();
  if (!u) {   // вышли из аккаунта или сессия истекла — нужно войти (или играть без облака)
    await new Promise((res) => openAuth({ title: '☁️ Войди в аккаунт', onSuccess: res, onBack: () => { setMode('local'); res(); }, backLabel: '💾 Играть без облака' }));
    closeModal(true);
    return resolveSave(false);
  }
  let remote = null;
  if (cloud.signedIn()) { try { remote = await cloud.fetchSave(); } catch (e) { offline = true; } }
  closeModal(true);
  const cached = readCache(u);
  let raw = null, push = false;
  if (remote && (!cached || remote.savedAt >= cached.savedAt)) { raw = remote.json; writeCache(u, raw); }
  else if (cached) { raw = cached.json; push = !offline; }   // на устройстве свежее, чем в облаке (играли без сети)
  return { raw, fresh: !raw, picker: false, push, offline };
}

// ---------- меню ----------
const statusText = () => {
  const s = cloud.info();
  return { ok: `✅ В облаке · ${fmt(s.at)}`, saving: '⏳ Сохраняю…', error: `⚠️ ${s.err}. Игра пока на устройстве, повторю позже`, conflict: '⚠️ В облаке более свежая игра с другого устройства', idle: 'Первое сохранение будет в течение минуты' }[s.status];
};
export function openCloudMenu() {
  const back = h('button', { onclick: () => closeModal() }, 'Закрыть');
  if (!cloud.configured()) { openModal('☁️ Облако', h('div', { class: 'menu' }, h('p', null, 'Облако пока не подключено к этой версии игры.'), back), { cls: 'narrow' }); return; }
  if (getMode() !== 'cloud') {
    openModal('☁️ Облако', h('div', { class: 'menu' },
      h('p', null, 'Сейчас игра хранится только в этом браузере. В облаке её можно продолжить с любого устройства — нужны почта и пароль.'),
      h('button', { class: 'primary', onclick: migrate }, '☁️ Перенести в облако'), back), { cls: 'narrow' });
    return;
  }
  openModal('☁️ Облако', h('div', { class: 'menu' },
    h('p', null, 'Аккаунт: ', h('b', null, cloud.email() || 'нет связи')), h('p', { class: 'muted' }, statusText()),
    h('button', { onclick: async () => { save(); await cloud.flush(); openCloudMenu(); } }, '🔄 Сохранить в облако сейчас'),
    h('button', { class: 'danger', onclick: disable }, '💾 Хранить только на устройстве'), back), { cls: 'narrow' });
}
function disable() {
  const again = () => openCloudMenu();
  confirmStep('💾 Отключить облако?', 'Игра останется на этом устройстве, но перестанет сохраняться в облаке. Копия в облаке останется как есть.', 'Отключить', async () => {
    save(); copyCloudToLocal(); setMode('local'); try { await cloud.signOut(); } catch (e) { }
    closeModal(); toast('Теперь игра хранится только на устройстве 💾');
  }, again);
}
function migrate() {
  const enable = () => { setMode('cloud'); save(); cloud.flush(); closeModal(); toast('Игра сохранена в облаке ☁️'); };
  openAuth({
    title: '☁️ Вход в облако', onBack: () => closeModal(),
    onSuccess: async () => {
      let r; try { r = await cloud.fetchSave(); } catch (e) { failModal(e, () => closeModal()); return; }
      if (!r) { enable(); return; }
      const found = () => openModal('☁️ В облаке уже есть игра', h('div', { class: 'menu' }, h('p', null, info(r)),
        h('button', { class: 'primary', onclick: () => takeRemote(r) }, '⬇️ Загрузить облачную игру'),
        h('p', { class: 'muted' }, 'Текущая игра останется на этом устройстве.'),
        h('button', { class: 'danger', onclick: () => confirmStep('⬆️ Заменить облачную игру?', 'Игра в облаке будет заменена текущей.', 'Заменить', enable, found) }, '⬆️ Заменить облачную текущей'),
        h('button', { onclick: () => closeModal() }, 'Отмена')), STICKY);
      found();
    },
  });
}

// ---------- конфликт: игру сохранили с другого устройства ----------
export function watchConflicts() {
  cloud.onConflict((c) => openModal('⚠️ Игра изменилась на другом устройстве', h('div', { class: 'menu' },
    h('p', null, `В облаке более свежая игра: ${info(c)}. Что оставить?`),
    h('button', { class: 'primary', onclick: async () => { try { const r = await cloud.resolveConflict(false); if (r) takeRemote(r); else closeModal(); } catch (e) { toast(cloud.errText(e)); } } }, '⬇️ Загрузить облачную игру'),
    h('button', { class: 'danger', onclick: async () => { await cloud.resolveConflict(true); closeModal(); toast(cloud.info().status === 'ok' ? 'Облако обновлено ☁️' : 'Не удалось обновить облако'); } }, '⬆️ Сохранить поверх эту игру')), STICKY));
}
