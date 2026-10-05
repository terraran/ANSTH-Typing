import { FB_CFG } from './config';

export let _db = null;

export function getDB() {
  if (_db) return _db;
  if (typeof firebase === 'undefined') return null;
  if (!firebase.apps.length) firebase.initializeApp(FB_CFG);
  _db = firebase.database();
  return _db;
}

export async function ensureFirebaseUser() {
  if (typeof firebase === 'undefined') throw new Error('Firebase SDK ยังโหลดไม่เสร็จ');
  const auth=firebase.auth();
  if (auth.idToken) {
    if (auth.currentUser&&auth.fbSubject===auth.subject) return auth.currentUser;
    const provider=firebase.auth.GoogleAuthProvider.credential(auth.idToken);
    const result=await auth.signInWithCredential(provider);
    auth.fbSubject=auth.subject;
    return result.user;
  }
  if (auth.currentUser) return auth.currentUser;
  const result=await auth.signInAnonymously();
  return result.user;
}

// Room codes: 5 characters from 29 symbols that never look alike — no 0/O, 1/I, and
// no S/B/Z (which look like 5/8/2 in game fonts) ≈ 20 million combinations.
// Rooms cannot be listed, so a code must be known to join. (The Firebase rules accept
// the wider old set, so this needs no rules change.)
export const ROOM_CODE_CHARS='ACDEFGHJKLMNPQRTUVWXY23456789';

// What a student types → a room code: upper-case, S/B/Z read as 5/8/2,
// anything that can never be in a code dropped.
export function normalizeRoomCode(v) {
  return [...String(v||'').toUpperCase().replace(/S/g,'5').replace(/B/g,'8').replace(/Z/g,'2')]
    .filter(c=>ROOM_CODE_CHARS.includes(c)).join('').slice(0,5);
}

export const ROOM_CODE_LEN=5;

export const ROOM_CODE_RE=new RegExp('^['+ROOM_CODE_CHARS+']{'+ROOM_CODE_LEN+'}$');

export function makeCode() {
  const c=ROOM_CODE_CHARS;
  const bytes=new Uint32Array(ROOM_CODE_LEN);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,n=>c[n%c.length]).join('');
}

export function currentFirebaseUid() { return typeof firebase==='undefined'?'':(firebase.auth().currentUser?.uid||''); }

export const ZONE_GRACE = 25;

// seconds before the first circle starts closing
export const ZONE_GAP   = 38;

// characters of breathing room behind the zone
export const ZONE_TICK  = 10000;

// lose one life every 10 seconds outside the zone
export const ZONE_PHASES = [
  { after: 0,   cpm: 60 },
  { after: 60,  cpm: 84 },
  { after: 120, cpm: 108 },
  { after: 180, cpm: 132 },
];

export const ZONE_TICK_SECS = ZONE_TICK / 1000;

export function getZoneSpeed(elapsedSeconds) {
  const phase = [...ZONE_PHASES].reverse().find(p => elapsedSeconds >= ZONE_GRACE + p.after);
  return phase ? phase.cpm : 0;
}

export function getZonePos(startTime, totalChars) {
  if (!startTime) return 0;
  return zonePosAt((Date.now() - startTime) / 1000, totalChars);
}

// Zone edge (in characters) `elapsed` seconds after the race start.
export function zonePosAt(elapsed, totalChars) {
  if (elapsed < ZONE_GRACE) return 0;
  let remaining = elapsed - ZONE_GRACE;
  let chars = 0;
  for (let i = 0; i < ZONE_PHASES.length; i++) {
    const phase = ZONE_PHASES[i];
    const next = ZONE_PHASES[i + 1];
    const duration = next ? next.after - phase.after : Infinity;
    const inPhase = Math.min(remaining, duration);
    chars += (inPhase / 60) * phase.cpm;
    remaining -= inPhase;
    if (remaining <= 0) break;
  }
  return Math.min(Math.floor(chars), totalChars);
}

// Shorter codes make collisions possible (though rare): retry until a free one.
export async function makeFreeCode() {
  for (let i=0;i<5;i++) {
    const code=makeCode();
    if (!(await fbGet(code))) return code;
  }
  throw new Error('สุ่มรหัสห้องไม่สำเร็จ ลองอีกครั้ง');
}

export async function fbCreate(code,info) {
  const db=getDB(); if(!db) throw new Error('Firebase is unavailable');
  const user=await ensureFirebaseUser();
  await db.ref('rooms/'+code).set({info:{...info,hostUid:user.uid,createdAt:Date.now(),status:'lobby'},players:{}});
}

export async function fbJoin(code,name,lives=3,cls='') {
  const db=getDB(); if(!db) throw new Error('Firebase is unavailable');
  const user=await ensureFirebaseUser();
  const rec={uid:user.uid,name,pos:0,cpm:0,errors:0,lives,status:'waiting',finishedAt:0,score:0};
  if (cls) rec.cls=String(cls).slice(0,12);   // class code — identifies opponents in match stats
  await db.ref('rooms/'+code+'/players/'+user.uid).set(rec);
}

// 1v1 rooms hold 2 players (host + 1). If two students join at the same moment, both pass the
// "room full?" check, so after joining each one re-checks: the host stays, and of the others only the
// smallest uid stays (every client computes the same answer). Returns false if I must leave.
export async function fbKeepSeat(code, maxPlayers) {
  const db=getDB(), uid=currentFirebaseUid(); if(!db||!uid) return true;
  const s=await db.ref('rooms/'+code).once('value'); const room=s.val()||{};
  const ids=Object.keys(room.players||{});
  if (ids.length<=maxPlayers) return true;
  const host=room.info?.hostUid;
  const keep=[...(host&&ids.includes(host)?[host]:[]), ...ids.filter(id=>id!==host).sort()].slice(0,maxPlayers);
  if (keep.includes(uid)) return true;
  await db.ref('rooms/'+code+'/players/'+uid).remove();
  return false;
}

export async function fbGet(code) {
  const db=getDB(); if(!db) return null;
  const s=await db.ref('rooms/'+code).once('value'); return s.val();
}

export function fbListen(code,cb) {
  const db=getDB(); if(!db) return ()=>{};
  const ref=db.ref('rooms/'+code);
  ref.on('value',s=>cb(s.val()));
  return ()=>ref.off('value');
}

export async function fbUpdatePlayer(code,name,data) {
  const db=getDB(); if(!db) return;
  const user=await ensureFirebaseUser();
  await db.ref('rooms/'+code+'/players/'+user.uid).update({...data,uid:user.uid});
}

// Phase 2: send this player's look separately — if the rules reject it, the race still works.
export async function fbSetChar(code,cfg) {
  try {
    const db=getDB(); if(!db||!window.CharKit) return;
    const wire=CharKit.toWire(cfg); if(!wire) return;
    const user=await ensureFirebaseUser();
    await db.ref('rooms/'+code+'/players/'+user.uid).update({char:wire});
  } catch(e) { console.warn('fbSetChar skipped:',e?.message); }
}

export async function fbSetStatus(code,status,extra={}) {
  const db=getDB(); if(!db) return;
  await ensureFirebaseUser();
  await db.ref('rooms/'+code+'/info').update({status,...extra});
}

export async function fbRemove(code) {
  const db=getDB(); if(!db) return;
  await ensureFirebaseUser();
  await db.ref('rooms/'+code).remove();
}

// ── Presence: disconnect handling, reconnect, "which race am I in" ──
function myPlayerRef(code) {
  const db=getDB(), uid=currentFirebaseUid();
  return db&&uid ? db.ref('rooms/'+code+'/players/'+uid) : null;
}
// Lobby: if this tab disappears, remove me from the room (and the room itself if I host it).
export function fbArmLobby(code, isHost) {
  const ref=myPlayerRef(code); if(!ref) return;
  ref.onDisconnect().remove();
  if (isHost) getDB().ref('rooms/'+code).onDisconnect().remove();
}
// Race: if this tab disappears, mark me "disconnected" (I can come back within the grace period).
export function fbArmRace(code) {
  const ref=myPlayerRef(code); if(!ref) return;
  getDB().ref('rooms/'+code).onDisconnect().cancel();          // never delete a running race
  ref.onDisconnect().cancel();
  ref.onDisconnect().update({status:'disconnected',dcAt:firebase.database.ServerValue.TIMESTAMP});
}
// Finished / eliminated / left: nothing should happen on disconnect any more.
export function fbDisarm(code) {
  const ref=myPlayerRef(code); if(!ref) return;
  ref.onDisconnect().cancel();
  getDB().ref('rooms/'+code).onDisconnect().cancel();
}
// users/<uid>/activeRoom — lets this account find its race again after a refresh or on another computer.
export async function fbSetActiveRoom(code,type) {
  const db=getDB(), uid=currentFirebaseUid(); if(!db||!uid) return;
  await db.ref('users/'+uid+'/activeRoom').set({code,type,at:firebase.database.ServerValue.TIMESTAMP});
}
export async function fbClearActiveRoom() {
  const db=getDB(), uid=currentFirebaseUid(); if(!db||!uid) return;
  await db.ref('users/'+uid+'/activeRoom').remove();
}
export async function fbGetActiveRoom() {
  const db=getDB(), uid=currentFirebaseUid(); if(!db||!uid) return null;
  const s=await db.ref('users/'+uid+'/activeRoom').once('value'); return s.val();
}
export async function fbServerOffset() {
  const db=getDB(); if(!db) return 0;
  const s=await db.ref('.info/serverTimeOffset').once('value'); return Number(s.val())||0;
}
