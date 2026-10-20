// Student names of code classrooms, kept in the TEACHER'S OWN Google Drive (public edition):
// one .csv per room (same format as the downloadable backup) in a folder the app creates.
// Scope drive.file = the app sees only the files it made itself, nothing else in the teacher's Drive.
// Names never go to the game's server.
import { GOOGLE_CLIENT_ID } from '../../config';
import { backupCsv, readBackup } from './localRoster';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER = 'คีย์บอร์ดเควส · รายชื่อนักเรียน';
const API = 'https://www.googleapis.com/drive/v3/files', UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

let token = '', expires = 0, folder = '';
export const driveReady = () => !!token && Date.now() < expires - 60000;

// Ask Google for a Drive token. Call from a click (the first time Google shows its permission popup).
export function connectDrive(hint) {
  if (driveReady()) return Promise.resolve(token);
  return new Promise((ok, fail) => {
    if (!window.google?.accounts?.oauth2) { fail(new Error('NO_GIS')); return; }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: SCOPE, hint,
      callback: r => {
        if (r.error || !google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) { fail(new Error(r.error || 'DRIVE_DENIED')); return; }
        token = r.access_token; expires = Date.now() + (Number(r.expires_in) || 3600) * 1000; ok(token);
      },
      error_callback: e => fail(new Error(e?.type === 'popup_closed' ? 'DRIVE_CLOSED' : e?.type || 'DRIVE_DENIED')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function describeDriveError(e) {
  const m = String(e?.message || e);
  if (m === 'DRIVE_CLOSED') return 'ปิดหน้าต่างขออนุญาตก่อนเสร็จ — กดอีกครั้งแล้วกด "อนุญาต"';
  if (m === 'DRIVE_DENIED' || m === 'access_denied') return 'ยังไม่ได้อนุญาตให้ใช้ Google Drive — ถ้าบัญชีโรงเรียนไม่ยอมให้ ใช้ "ดาวน์โหลด .csv" แทน';
  if (m === 'NO_GIS') return 'โหลดระบบล็อกอิน Google ไม่ได้ — ตรวจอินเทอร์เน็ต';
  if (/^HTTP 40[13]/.test(m)) return 'Google Drive ไม่อนุญาต — ถ้าเป็นบัญชีโรงเรียน ผู้ดูแลระบบอาจปิดไว้ ใช้ "ดาวน์โหลด .csv" แทน';
  return 'ใช้ Google Drive ไม่ได้: ' + m;
}

async function call(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token, ...(opt.headers || {}) } });
  if (r.status === 401) { token = ''; throw new Error('HTTP 401'); }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r;
}
const q = s => `${API}?q=${encodeURIComponent(s)}&spaces=drive&fields=files(id,name,appProperties)&pageSize=200`;

async function folderId() {
  if (folder) return folder;
  const d = await (await call(q(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER}' and trashed=false`))).json();
  if (d.files?.length) return (folder = d.files[0].id);
  const made = await (await call(API + '?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }) })).json();
  return (folder = made.id);
}
async function fileOf(classId) {
  const d = await (await call(q(`appProperties has { key='kqClass' and value='${classId}' } and trashed=false`))).json();
  return d.files?.[0] || null;
}
const fileName = className => `รายชื่อ-${String(className || 'ห้อง').replace(/[\\/:*?"<>|]/g, '_')}.csv`;

// Save (create or replace) one room's list.
export async function saveToDrive(classId, className, students, names) {
  const csv = backupCsv(classId, className, students, names), f = await fileOf(classId);
  if (f) {
    await call(`${UPLOAD}/${f.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'text/csv; charset=utf-8' }, body: csv });
    if (f.name !== fileName(className)) await call(`${API}/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: fileName(className) }) });
    return;
  }
  const meta = { name: fileName(className), mimeType: 'text/csv', parents: [await folderId()], appProperties: { kqClass: classId } };
  const b = 'kq' + Math.random().toString(36).slice(2);
  const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${csv}\r\n--${b}--`;
  await call(`${UPLOAD}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body });
}

// Every room list this app saved in the teacher's Drive → { [classId]: names }
export async function loadAllFromDrive() {
  const d = await (await call(q(`'${await folderId()}' in parents and trashed=false`))).json();
  const out = {};
  for (const f of d.files || []) {
    const id = f.appProperties?.kqClass; if (!id) continue;
    try { out[id] = readBackup(await (await call(`${API}/${f.id}?alt=media`)).text()).names; } catch {}
  }
  return out;
}

// One room's list from Drive → names, or null if this room has no file there.
export async function loadFromDrive(classId) {
  const f = await fileOf(classId);
  if (!f) return null;
  return readBackup(await (await call(`${API}/${f.id}?alt=media`)).text()).names;
}

export async function deleteFromDrive(classId) {
  const f = await fileOf(classId).catch(() => null);
  if (f) await call(`${API}/${f.id}`, { method: 'DELETE' }).catch(() => {});
}

// Demo (localhost ?demo): a pretend Drive in this browser, so nothing reaches Google.
export function demoDrive() {
  const get = () => { try { return JSON.parse(localStorage.getItem('kq.demoDrive') || '{}'); } catch { return {}; } };
  const put = v => localStorage.setItem('kq.demoDrive', JSON.stringify(v));
  let ok = false;
  return {
    driveReady: () => ok,
    connectDrive: async () => { await new Promise(r => setTimeout(r, 300)); ok = true; return 'demo'; },
    describeDriveError,
    saveToDrive: async (id, name, students, names) => { const d = get(); d[id] = names; put(d); },
    loadAllFromDrive: async () => get(),
    loadFromDrive: async id => get()[id] || null,
    deleteFromDrive: async id => { const d = get(); delete d[id]; put(d); },
  };
}
export const realDrive = { driveReady, connectDrive, describeDriveError, saveToDrive, loadAllFromDrive, loadFromDrive, deleteFromDrive };
