// Облачное сохранение: Firebase Auth (почта + пароль) и Firestore. SDK подгружается с CDN только когда облако нужно,
// так что обычная локальная игра ничего лишнего не качает.
import { b64, unb64 } from '../core/util.js';
import { FIREBASE_CONFIG } from '../config/firebase.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.10.0/';
const PUSH_EVERY = 60000;            // не чаще раза в минуту (плюс сразу при сворачивании вкладки)
const UID_KEY = 'cozy-island-cloud-uid';
const st = { user: null, lastUid: null, status: 'idle', at: 0, err: '', conflict: null };
let M = null, auth = null, db = null, initP = null, lastKnown = 0, pending = null, timer = 0, lastPush = 0, busy = false, conflictFn = null;
try { st.lastUid = localStorage.getItem(UID_KEY); } catch (e) { }

const CFG = FIREBASE_CONFIG;
export const configured = () => !!CFG.apiKey;
export const info = () => st;
export const uid = () => st.user?.uid || st.lastUid;     // lastUid — чтобы поиграть из кеша без сети
export const email = () => st.user?.email || '';
export const signedIn = () => !!st.user;
export const onConflict = (fn) => { conflictFn = fn; if (st.conflict) fn(st.conflict); };

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);
const ERR = {
  'auth/invalid-email': 'Не похоже на адрес почты', 'auth/missing-email': 'Введи адрес почты', 'auth/missing-password': 'Введи пароль',
  'auth/weak-password': 'Пароль слишком короткий — нужно хотя бы 6 символов', 'auth/email-already-in-use': 'Эта почта уже зарегистрирована — попробуй войти',
  'auth/invalid-credential': 'Неверная почта или пароль', 'auth/user-not-found': 'Неверная почта или пароль', 'auth/wrong-password': 'Неверная почта или пароль',
  'auth/too-many-requests': 'Слишком много попыток, подожди немного', 'auth/network-request-failed': 'Нет связи с облаком — проверь интернет',
  'auth/operation-not-allowed': 'Вход по почте не включён в проекте Firebase', 'timeout': 'Облако долго не отвечает — проверь интернет',
  'permission-denied': 'Нет доступа к облаку (правила Firestore ещё не опубликованы?)',
};
export const errText = (e) => ERR[e?.code] || ERR[e?.code?.replace('firestore/', '')] || 'Не удалось связаться с облаком' + (e?.code ? ` (${e.code})` : '');

async function sdk() {
  if (M) return M;
  if (!configured()) throw Object.assign(new Error('not configured'), { code: 'not-configured' });
  const imp = (n) => import(/* @vite-ignore */ SDK + n);
  const [a, au, fs] = await withTimeout(Promise.all([imp('firebase-app.js'), imp('firebase-auth.js'), imp('firebase-firestore.js')]), 15000);
  const app = a.initializeApp(CFG);
  M = { ...a, ...au, ...fs }; auth = M.getAuth(app); db = M.getFirestore(app);
  return M;
}
// Подключиться и узнать, вошёл ли игрок (сессия Firebase хранится в браузере сама).
export function init() {
  if (!initP) initP = (async () => {
    await sdk();
    await withTimeout(new Promise((res) => M.onAuthStateChanged(auth, (u) => { st.user = u; if (u) { st.lastUid = u.uid; try { localStorage.setItem(UID_KEY, u.uid); } catch (e) { } } res(); })), 10000);
    return st.user;
  })().catch((e) => { initP = null; throw e; });
  return initP;
}
const afterAuth = (cred) => { st.user = cred.user; st.lastUid = cred.user.uid; try { localStorage.setItem(UID_KEY, cred.user.uid); } catch (e) { } return cred.user; };
export async function signUp(mail, pass) { await init(); return afterAuth(await M.createUserWithEmailAndPassword(auth, mail, pass)); }
export async function signIn(mail, pass) { await init(); return afterAuth(await M.signInWithEmailAndPassword(auth, mail, pass)); }
export async function resetPassword(mail) { await init(); await M.sendPasswordResetEmail(auth, mail); }
export async function signOut() { await init(); await M.signOut(auth); st.user = null; st.lastUid = null; pending = null; try { localStorage.removeItem(UID_KEY); } catch (e) { } }

// ---- сжатие: сохранение ~сотни КБ, а документ Firestore ограничен 1 МБ ----
async function pack(json) {
  if (typeof CompressionStream === 'function') {
    const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
    return { enc: 'gz', blob: b64(new Uint8Array(buf)) };
  }
  return { enc: 'raw', blob: json };
}
async function unpack(d) {
  if (d.enc === 'gz') return await new Response(new Blob([unb64(d.blob)]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return d.blob;
}
const ref = (u) => M.doc(db, 'users', u, 'saves', 'main');

// Облачное сохранение или null, если его ещё нет.
export async function fetchSave() {
  await init(); if (!st.user) throw Object.assign(new Error('no user'), { code: 'auth/no-user' });
  const snap = await withTimeout(M.getDoc(ref(st.user.uid)), 10000);
  if (!snap.exists()) { lastKnown = 0; return null; }
  const d = snap.data(); lastKnown = d.savedAt || 0;
  return { json: await unpack(d), savedAt: d.savedAt || 0, day: d.day || 0 };
}
export async function deleteSave() {
  await init(); if (!st.user) return;
  await withTimeout(M.deleteDoc(ref(st.user.uid)), 8000); lastKnown = 0; pending = null;
}

// Поставить сохранение в очередь на отправку (последнее побеждает).
export function queue(json, savedAt, day) {
  pending = { json, savedAt, day };
  if (st.conflict || timer) return;
  timer = setTimeout(flush, Math.max(0, lastPush + PUSH_EVERY - Date.now()));
}
export async function flush() {
  clearTimeout(timer); timer = 0;
  if (!pending || busy || st.conflict) return;
  busy = true; const p = pending; pending = null; st.status = 'saving';
  try {
    await init(); if (!st.user) throw Object.assign(new Error('no user'), { code: 'auth/no-user' });
    const packed = await pack(p.json);
    await withTimeout(M.runTransaction(db, async (tx) => {
      const r = ref(st.user.uid), s = await tx.get(r);
      const remoteAt = s.exists() ? (s.data().savedAt || 0) : 0;
      if (remoteAt > lastKnown) throw Object.assign(new Error('conflict'), { conflict: { savedAt: remoteAt, day: s.data().day || 0 } });   // кто-то сохранил с другого устройства
      tx.set(r, { ...packed, savedAt: p.savedAt, day: p.day });
    }), 15000);
    lastKnown = p.savedAt; lastPush = Date.now(); st.status = 'ok'; st.at = lastPush; st.err = '';
  } catch (e) {
    pending ||= p;
    if (e.conflict) { st.status = 'conflict'; st.conflict = e.conflict; conflictFn && conflictFn(e.conflict); }
    else { st.status = 'error'; st.err = errText(e); }
  } finally {
    busy = false;
    if (pending && !st.conflict && !timer) timer = setTimeout(flush, st.status === 'error' ? 30000 : PUSH_EVERY);
  }
}
// Решение конфликта: «мои» — перезаписать облако этой игрой; «их» — забрать облачную (вернёт сохранение).
export async function resolveConflict(keepMine) {
  if (keepMine) { lastKnown = st.conflict ? st.conflict.savedAt : lastKnown; st.conflict = null; st.status = 'idle'; await flush(); return null; }
  const r = await fetchSave(); st.conflict = null; pending = null; st.status = 'idle'; return r;
}
