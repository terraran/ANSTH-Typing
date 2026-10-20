// Code-classroom extras on a room page (public edition): add students, more-menu (reissue codes,
// rename, delete, tips), the backup reminder and dropping a backup file to show names here.
const { useEffect, useRef, useState } = React;
import { Modal } from '../ui';
import { downloadBackup, parseNames, readBackup, saveRoster } from './localRoster';

export function AddStudentsDialog({ api, classId, nextNo, onAdded, onClose }) {
  const [mode, setMode] = useState('count');
  const [count, setCount] = useState(1);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const names = parseNames(text);
  const n = mode === 'list' ? names.length : Math.max(0, Math.min(50, Number(count) || 0));
  async function add() {
    if (!n) return;
    setBusy(true); setErr('');
    try {
      const codes = await api.addStudents(classId, n);
      onAdded(codes, mode === 'list' ? Object.fromEntries(codes.map((c, i) => [c.no, names[i]])) : {});
    } catch (e) { setErr('เพิ่มไม่ได้: ' + api.describeError(e)); setBusy(false); }
  }
  return (
    <Modal title="＋ เพิ่มนักเรียน" onClose={onClose}>
      <div className="hint">คนใหม่ต่อท้ายรายชื่อ เริ่มที่เลขที่ {nextNo}</div>
      <span className="seg"><button className={mode === 'count' ? 'on' : ''} onClick={() => setMode('count')}>ใส่จำนวน</button>
        <button className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>วางรายชื่อ</button></span>
      {mode === 'count'
        ? <div className="row6"><input className="bignum" type="number" min="1" max="50" value={count} onChange={e => setCount(e.target.value)} aria-label="จำนวน"/> คน</div>
        : <textarea className="pastebox" value={text} onChange={e => setText(e.target.value)} placeholder="1 บรรทัด = 1 คน" aria-label="รายชื่อ"/>}
      <div className="hint">🔒 ชื่อเก็บในเครื่องนี้เท่านั้น</div>
      {err && <div className="err">{err}</div>}
      <div className="row6"><span className="spacer"/><button className="btn ghost" onClick={onClose}>ปิด</button>
        <button className="btn" disabled={busy || !n} onClick={add}>{busy ? 'กำลังสร้างรหัส…' : `เพิ่ม ${n || ''} คน`}</button></div>
    </Modal>
  );
}

export function RenameDialog({ name, onSave, onClose }) {
  const [v, setV] = useState(name);
  return (
    <Modal title="✏️ เปลี่ยนชื่อห้อง" onClose={onClose}>
      <input className="big" value={v} maxLength={60} autoFocus onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && v.trim() && onSave(v.trim())}/>
      <div className="row6"><span className="spacer"/><button className="btn ghost" onClick={onClose}>ปิด</button>
        <button className="btn" disabled={!v.trim()} onClick={() => onSave(v.trim())}>บันทึก</button></div>
    </Modal>
  );
}

// "⋯" button with a small menu: items = [[label, onClick, disabled?], …]
export function MoreMenu({ items }) {
  const [open, setOpen] = useState(false), ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = e => e.key === 'Escape' && setOpen(false);
    addEventListener('mousedown', close); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', close); removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="more" ref={ref}>
      <button className="btn ghost" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="เมนูเพิ่มเติม">⋯</button>
      {open && <div className="menu card" role="menu">{items.map(([t, f, off]) =>
        <button key={t} role="menuitem" disabled={off} onClick={() => { setOpen(false); f(); }}>{t}</button>)}</div>}
    </div>
  );
}

// Backup reminder / "no names on this computer" banner for a room.
export function RosterAlert({ roster, students, classId, className, owner, onRoster, onPick, onSaveDrive, onPullDrive, busy }) {
  if (!students.length) return null;
  if (roster && roster.mode === 'list' && !roster.backedUp) return (
    <div className="alert"><span>☁️</span>
      <span className="grow"><b>{roster.drive ? 'รายชื่อมีการเปลี่ยนแปลง ยังไม่ได้บันทึกลง Google Drive' : 'ยังไม่ได้บันทึกรายชื่อลง Google Drive'}</b> — ตอนนี้ชื่ออยู่ในเครื่องนี้เท่านั้น ถ้าเปลี่ยนเครื่องหรือล้างเบราว์เซอร์ ชื่อจะหาย (รหัสและคะแนนยังอยู่)</span>
      <button className="btn sm gold" disabled={busy} onClick={onSaveDrive}>{busy ? 'กำลังบันทึก…' : '☁️ บันทึกลง Drive'}</button>
      <button className="btn sm ghost" onClick={() => { downloadBackup(classId, className, students, roster.names); onRoster(saveRoster(owner, classId, { ...roster, backedUp: true })); }}>⬇️ .csv</button>
    </div>);
  if (!roster) return (
    <div className="alert drop"><span>☁️</span>
      <span className="grow"><b>เครื่องนี้ยังไม่มีรายชื่อห้องนี้</b> — ดึงจาก Google Drive ของคุณ หรือลากไฟล์สำรอง (.csv) มาวาง</span>
      <button className="btn sm blue" disabled={busy} onClick={onPullDrive}>{busy ? 'กำลังดึง…' : '☁️ ดึงรายชื่อจาก Drive'}</button>
      <button className="btn sm ghost" onClick={onPick}>📂 เลือกไฟล์…</button>
      <button className="btn sm ghost" title="ห้องนี้ใส่แค่จำนวน ไม่มีรายชื่อ" onClick={() => onRoster(saveRoster(owner, classId, { names: {}, mode: 'count', backedUp: true }))}>ไม่มีรายชื่อ</button>
    </div>);
  return null;
}

// Read a dropped / picked backup file for this room → roster, or an error message.
export async function importBackup(file, classId, className) {
  const text = await file.text();
  let b;
  try { b = readBackup(text); } catch { return { error: `"${file.name}" ไม่ใช่ไฟล์สำรองรายชื่อของคีย์บอร์ดเควส` }; }
  if (b.classId && b.classId !== classId) return { error: `ไฟล์นี้เป็นของห้อง "${b.className}" ไม่ใช่ "${className}" — เปิดห้องนั้นก่อนแล้วลากไฟล์มาวางใหม่`, otherClass: b.classId };
  return { roster: { names: b.names, mode: 'list', backedUp: true } };
}
