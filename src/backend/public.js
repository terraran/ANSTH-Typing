// Public edition backend: Firebase (Auth + Firestore), no Apps Script.
// Same calls as backend/school.js, so the screens don't care which one is behind them.
//
// Two kinds of players, one document each (rules: firestore.rules):
//   users/{uid}   someone who signed in with any Google account
//   codes/{CODE}  a classroom student who typed the code from their teacher's card.
//                 The code IS the key: whoever knows it can open that one document, nobody can
//                 list them. No names are stored — only the class, the number (เลขที่) and play data.
//   classes/{id}  a teacher's room: owner, room name, unlock stage
//
// classCode / studentName arguments (kept for school.js compatibility) are ignored here:
// every call works on the player who signed in last (`me`).
import { FB_CFG } from '../config';
import { auth as session } from '../auth';
import { hsKey } from '../engine/scoring';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const CODE_CHARS = 'ACDEFGHJKLMNPQRTVWXY2346789';   // no S B Z O 0 I 1, and no 5 U (≈ S V in the pixel font)
export const CODE_LEN = 8;
const CODE_RE = new RegExp(`^[${CODE_CHARS}]{${CODE_LEN}}$`);
const KEEP = 50;                         // sessions / matches kept per player (newest first)

export const enabled = !!FB_CFG?.projectId;

// ── Firebase SDK (compat), loaded on first use so pages that never save don't pay for it ──
function script(src) {
  return new Promise((ok, fail) => {
    if ([...document.scripts].some(s => s.src === src)) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => fail(new Error('NETWORK'));
    document.head.appendChild(s);
  });
}
let ready = null;
function fb() {
  if (!ready) ready = (async () => {
    if (typeof firebase === 'undefined') await script(SDK + 'firebase-app-compat.js');
    if (!firebase.auth) await script(SDK + 'firebase-auth-compat.js');
    if (!firebase.firestore) await script(SDK + 'firebase-firestore-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
    return firebase;
  })();
  ready.catch(() => { ready = null; });
  return ready;
}
const db = async () => (await fb()).firestore();
const now = () => firebase.firestore.FieldValue.serverTimestamp();

// Sign in to Firebase as the Google account the page signed in with (session.idToken),
// or anonymously for code players. Never reuses another person's account on a shared PC.
async function signIn(kind) {
  const a = (await fb()).auth();
  if (kind === 'google') {
    const u = a.currentUser;
    // Already in as a Google user: the same person the page signed in with, or (no page sign-in,
    // e.g. the teacher page's own Firebase sign-in) whoever signed in to Firebase directly.
    if (u && !u.isAnonymous && (!session.idToken || session.fbSubject === session.subject)) return u;
    if (!session.idToken) throw new Error('NOT_SIGNED_IN');
    const r = await a.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(session.idToken));
    session.fbSubject = session.subject;
    return r.user;
  }
  if (a.currentUser && !a.currentUser.isAnonymous) await a.signOut();   // a code player must not act as the last Google user
  return a.currentUser || (await a.signInAnonymously()).user;
}

// The player the game is saving for: { ref, kind: 'user'|'code', data }
let me = null;
const mine = () => { if (!me) throw new Error('NOT_SIGNED_IN'); return me; };

const blank = () => ({ character: null, tipsSeen: [], progress: { stars: {}, cleared: {} }, highScores: {}, sessions: [], matches: [] });

export function describeError(err) {
  const m = String(err?.code || err?.message || err || '');
  const map = {
    CODE_NOT_FOUND: 'ไม่พบรหัสนี้ — ตรวจตัวอักษรบนการ์ดอีกครั้ง หรือถามครู',
    CODE_FORMAT: `รหัสมี ${CODE_LEN} ตัว (ไม่มีตัว S B Z O I U และเลข 0 1 5)`,
    NOT_SIGNED_IN: 'ยังไม่ได้เข้าสู่ระบบ',
    NOT_AVAILABLE: 'เวอร์ชันนี้ยังไม่มีฟีเจอร์นี้',
    NETWORK: 'โหลด Firebase ไม่ได้ — ตรวจอินเทอร์เน็ต',
    'permission-denied': 'ไม่มีสิทธิ์ทำรายการนี้',
    unavailable: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ลองใหม่อีกครั้ง',
    'auth/network-request-failed': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจอินเทอร์เน็ต',
    'auth/invalid-credential': 'การเข้าสู่ระบบหมดอายุ — เข้าสู่ระบบใหม่',
    'auth/operation-not-allowed': 'ยังไม่ได้เปิดวิธีเข้าสู่ระบบนี้ใน Firebase — แจ้งผู้ดูแล',
  };
  for (const k of Object.keys(map)) if (m.includes(k)) return map[k];
  return 'เกิดข้อผิดพลาด: ' + m;
}

// ── sign-in ───────────────────────────────────────────────────────

// Signed-in Google account → its own document (made on first visit).
// → { classCode: '', studentName, character, tipsSeen }
export async function lookup() {
  const u = await signIn('google');
  const ref = (await db()).collection('users').doc(u.uid);
  let snap = await ref.get();
  if (!snap.exists) { await ref.set({ ...blank(), createdAt: now(), updatedAt: now() }); snap = await ref.get(); }
  me = { ref, kind: 'user', data: snap.data() };
  return { classCode: '', studentName: u.displayName || 'ผู้เล่น', character: me.data.character, tipsSeen: me.data.tipsSeen || [] };
}

// What a student types → a code: upper case, and anything that can never be in a code (dashes, spaces,
// S B Z O 0 I 1 5 U) dropped.
export const normalizeCode = v => [...String(v || '').toUpperCase()].filter(c => CODE_CHARS.includes(c)).join('').slice(0, CODE_LEN);

// Classroom student types the code from the card.
// → { classCode, className, no, studentName: 'เลขที่ 7', character, tipsSeen }
export async function lookupCode(typed) {
  const code = normalizeCode(typed);
  if (!CODE_RE.test(code)) throw new Error('CODE_FORMAT');
  await signIn('anonymous');
  const d = await db();
  const ref = d.collection('codes').doc(code);
  const snap = await ref.get().catch(e => { if (e.code === 'permission-denied') throw new Error('CODE_NOT_FOUND'); throw e; });
  if (!snap.exists || snap.data().active === false) throw new Error('CODE_NOT_FOUND');
  me = { ref, kind: 'code', code, data: snap.data() };
  const cls = await d.collection('classes').doc(me.data.classId).get().catch(() => null);
  me.classStage = cls?.exists ? Number(cls.data().teacherStage) || 0 : 0;
  return { classCode: me.data.classId, className: cls?.exists ? cls.data().name : '', no: me.data.no,
    studentName: 'เลขที่ ' + me.data.no, character: me.data.character, tipsSeen: me.data.tipsSeen || [] };
}

export function signOut() { me = null; }

// ── saving play data (player's own document only) ─────────────────

export async function getStats() {
  const p = mine(), snap = await p.ref.get(), d = snap.data() || {};
  p.data = d;
  const teacherStage = Math.max(Number(d.teacherStage) || 0, p.classStage || 0);
  return { highScores: d.highScores || {}, progress: { stars: {}, cleared: {}, ...(d.progress || {}), teacherStage },
    sessions: d.sessions || [], matches: d.matches || [] };
}

// One finished practice session (newest first, last KEEP kept) + this step's best score.
export async function saveSession(s) {
  const p = mine(), d = await db();
  const row = { date: new Date().toISOString(), lessonId: Number(s.lessonId) || 0, exercise: String(s.exerciseTitle || '').slice(0, 120),
    cpm: Math.round(s.cpm) || 0, wpm: Math.round(s.wpm) || 0, accuracy: Math.round(s.accuracy) || 0, errors: Math.round(s.errors) || 0,
    chars: Math.round(s.totalChars) || 0, duration: Math.round(s.duration) || 0, score: Math.round(s.score) || 0 };
  await d.runTransaction(async t => {
    const cur = (await t.get(p.ref)).data() || {};
    const k = hsKey(row.lessonId, row.exercise);
    const update = { sessions: [row, ...(cur.sessions || [])].slice(0, KEEP), updatedAt: now() };
    if (row.score > ((cur.highScores || {})[k] || 0)) update.highScores = { ...(cur.highScores || {}), [k]: row.score };
    t.update(p.ref, update);
  });
  return { ok: true };
}

// Best ⭐ of one step (never goes down) / a lesson cleared by a Rush.
export async function saveProgress({ key, stars, cleared }) {
  const p = mine(), F = firebase.firestore.FieldPath;   // FieldPath: keys like "101|1.1" contain dots
  const best = Math.max(Number(stars) || 0, ((p.data.progress || {}).stars || {})[key] || 0);
  const args = [new F('progress', 'stars', key), best];
  if (cleared) args.push(new F('progress', 'cleared', String(cleared)), true);
  args.push('updatedAt', now());
  await p.ref.update(...args);
  p.data.progress = { ...(p.data.progress || {}), stars: { ...((p.data.progress || {}).stars || {}), [key]: best } };
  return { ok: true };
}

export async function saveCharacter(_c, _n, cfg) {
  const p = mine();
  await p.ref.update({ character: cfg || null, updatedAt: now() });
  p.data.character = cfg;
  return { ok: true };
}

export async function markTipsSeen(_c, _n, ids) {
  if (!me || !ids?.length) return null;
  await me.ref.update({ tipsSeen: firebase.firestore.FieldValue.arrayUnion(...ids.map(String)), updatedAt: now() });
  return { ok: true };
}

// 1v1 / Battle Royale result (only kept on the player's own document — no shared match sheet).
export async function saveMatch(m) {
  const p = mine(), d = await db();
  const row = { date: new Date().toISOString(), matchId: String(m.matchId || ''), type: m.type, result: m.result || '',
    place: m.place || 0, players: m.players || 0, oppName: String(m.oppName || '').slice(0, 40),
    myScore: Math.round(m.myScore || 0), oppScore: Math.round(m.oppScore || 0), cpm: m.cpm || 0, accuracy: m.accuracy || 0 };
  await d.runTransaction(async t => {
    const cur = (await t.get(p.ref)).data() || {};
    t.update(p.ref, { matches: [row, ...(cur.matches || [])].slice(0, KEEP), updatedAt: now() });
  });
  return { ok: true };
}

// Title-screen runners: nobody else's look is shared in the public edition.
export const titleRunners = async () => [];

// Not in the public edition yet (EDITION.homework / weekly are off, so the screens never call these).
const notYet = async () => { throw new Error('NOT_AVAILABLE'); };
export const weeklyBoard = notYet, weeklyPast = notYet, submitWeekly = notYet, getHomework = notYet, submitHomework = notYet;

// ── teacher (public edition): rooms, codes, unlocks ───────────────
// The teacher signs in with Google (not anonymous). Student names never reach these calls —
// they stay on the teacher's computer (teacher page).

const randomCode = () => {
  const b = new Uint32Array(CODE_LEN); crypto.getRandomValues(b);
  return Array.from(b, n => CODE_CHARS[n % CODE_CHARS.length]).join('');
};
const teacher = async () => { const u = await signIn('google'); return u.uid; };

// → { classes: [{ id, name, count, teacherStage, createdAt }] }
export async function teacherClasses() {
  const uid = await teacher();
  const q = await (await db()).collection('classes').where('ownerUid', '==', uid).get();
  const classes = q.docs.map(x => ({ id: x.id, ...x.data(), createdAt: x.data().createdAt?.toMillis?.() || 0 }))
    .sort((a, b) => a.createdAt - b.createdAt);
  return { classes };
}

// New codes for numbers `nos` in a class → [{ no, code }]. Each code is checked to be unused.
async function issueCodes(d, uid, classId, nos, carry = {}) {
  const out = [];
  for (const no of nos) {
    for (let tries = 0; ; tries++) {
      const code = randomCode(), ref = d.collection('codes').doc(code);
      const ok = await d.runTransaction(async t => {
        if ((await t.get(ref)).exists) return false;
        t.set(ref, { ...blank(), ...(carry[no] || {}), ownerUid: uid, classId, no, active: true, teacherStage: 0, createdAt: now(), updatedAt: now() });
        return true;
      });
      if (ok) { out.push({ no, code }); break; }
      if (tries > 5) throw new Error('CODE_COLLISION');
    }
  }
  return out;
}

// Create a room with students numbered 1..count → { id, codes: [{ no, code }] }
export async function createClass(name, count) {
  const uid = await teacher(), d = await db();
  const ref = d.collection('classes').doc();
  await ref.set({ ownerUid: uid, name: String(name || '').slice(0, 60), count: Number(count) || 0, teacherStage: 0, createdAt: now() });
  const codes = await issueCodes(d, uid, ref.id, Array.from({ length: Number(count) || 0 }, (_, i) => i + 1));
  return { id: ref.id, codes };
}

// More students at the end of the list → [{ no, code }]
export async function addStudents(classId, howMany) {
  const uid = await teacher(), d = await db(), cref = d.collection('classes').doc(classId);
  const count = Number((await cref.get()).data()?.count) || 0, add = Number(howMany) || 0;
  await cref.update({ count: count + add });
  return issueCodes(d, uid, classId, Array.from({ length: add }, (_, i) => count + i + 1));
}

// Lost card: same student, new code, same stars; the old code stops working. → { no, code }
export async function reissueCode(oldCode) {
  const uid = await teacher(), d = await db(), old = d.collection('codes').doc(oldCode);
  const s = (await old.get()).data();
  const keep = {};
  for (const k of ['character', 'tipsSeen', 'progress', 'highScores', 'sessions', 'matches']) if (s[k] !== undefined) keep[k] = s[k];
  const [fresh] = await issueCodes(d, uid, s.classId, [s.no], { [s.no]: keep });
  await old.delete();
  return fresh;
}

// Everyone in a room, in the shape getClassData returns at school (names are filled in on the
// teacher's computer): { students: [{ code, no, name: '', totalSessions, avgAcc, lastActive, sessions, teacherStage }] }
export async function classData(classId) {
  const uid = await teacher();
  const q = await (await db()).collection('codes').where('ownerUid', '==', uid).where('classId', '==', classId).get();
  const students = q.docs.map(x => {
    const s = x.data(), list = s.sessions || [];
    return { code: x.id, no: s.no, name: '', totalSessions: list.length, teacherStage: Number(s.teacherStage) || 0,
      avgAcc: list.length ? Math.round(list.reduce((a, r) => a + r.accuracy, 0) / list.length) : 0,
      lastActive: list[0]?.date || '', sessions: list.slice().reverse(), progress: s.progress || {} };
  }).sort((a, b) => a.no - b.no);
  return { students };
}

// Unlock up to `stage` (0 = back to playing in order) for the whole room (code '') or one student.
export async function setUnlock(classId, code, stage) {
  await teacher();
  const d = await db();
  if (!code) await d.collection('classes').doc(classId).update({ teacherStage: Number(stage) || 0 });
  else await d.collection('codes').doc(code).update({ teacherStage: Number(stage) || 0 });
  return { ok: true };
}

export async function renameClass(classId, name) {
  await teacher();
  await (await db()).collection('classes').doc(classId).update({ name: String(name || '').slice(0, 60) });
  return { ok: true };
}

// Delete a room and every code in it (students' play data goes too).
export async function deleteClass(classId) {
  const uid = await teacher(), d = await db();
  const q = await d.collection('codes').where('ownerUid', '==', uid).where('classId', '==', classId).get();
  for (let i = 0; i < q.docs.length; i += 400) {
    const b = d.batch(); q.docs.slice(i, i + 400).forEach(x => b.delete(x.ref)); await b.commit();
  }
  await d.collection('classes').doc(classId).delete();
  return { ok: true };
}

// Show Mr.AT's tips again to everyone in a room → { reset: n }
export async function resetTips(classId) {
  const uid = await teacher(), d = await db();
  const q = await d.collection('codes').where('ownerUid', '==', uid).where('classId', '==', classId).get();
  for (let i = 0; i < q.docs.length; i += 400) {
    const b = d.batch(); q.docs.slice(i, i + 400).forEach(x => b.update(x.ref, { tipsSeen: [] })); await b.commit();
  }
  return { reset: q.docs.length };
}
