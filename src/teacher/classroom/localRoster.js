// Student names for a code classroom (public edition) live ONLY on the teacher's computer:
// localStorage per teacher account + room, and a .csv backup file the teacher downloads.
// The server knows codes and numbers (เลขที่), never names.

const key = (owner, classId) => `kq.roster.${owner}.${classId}`;

// → { names: { [no]: name }, mode: 'list' | 'count', backedUp: bool } | null (nothing on this computer)
export function loadRoster(owner, classId) {
  try { return JSON.parse(localStorage.getItem(key(owner, classId)) || 'null'); } catch { return null; }
}
export function saveRoster(owner, classId, roster) {
  try { localStorage.setItem(key(owner, classId), JSON.stringify({ ...roster, savedAt: Date.now() })); } catch {}
  return roster;
}
export function forgetRoster(owner, classId) { try { localStorage.removeItem(key(owner, classId)); } catch {} }

// Names pasted from Excel → ['ด.ช. ...', ...]. One line per student, in เลขที่ order.
// A copied "เลขที่ <tab> ชื่อ" pair keeps only the name; empty lines are skipped.
export function parseNames(text) {
  return String(text || '').split(/\r?\n/).map(line => {
    const cells = line.split('\t').map(c => c.trim()).filter(Boolean);
    if (cells.length > 1 && /^\d+\.?$/.test(cells[0])) cells.shift();
    return cells.join(' ').replace(/\s+/g, ' ').trim();
  }).filter(Boolean).slice(0, 100);
}

export const fmtCode = c => c ? c.slice(0, 4) + '-' + c.slice(4) : '';

// ── backup file (.csv, opens in Excel; BOM so Thai shows correctly) ──
const MARK = 'คีย์บอร์ดเควส · ไฟล์สำรองรายชื่อ';
const cell = v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);

export function backupCsv(classId, className, students, names) {
  const rows = [[MARK, className, classId], ['เลขที่', 'ชื่อ', 'รหัส'],
    ...students.map(s => [s.no, names?.[s.no] || '', fmtCode(s.code)])];
  return '﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function downloadBackup(classId, className, students, names) {
  const blob = new Blob([backupCsv(classId, className, students, names)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `รายชื่อ-${String(className || 'ห้อง').replace(/[\\/:*?"<>|]/g, '_')}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// A backup file → { classId, className, names: { [no]: name } }; throws 'NOT_BACKUP' for other files.
export function readBackup(text) {
  const rows = parseCsv(String(text || '').replace(/^﻿/, ''));
  if (!rows.length || rows[0][0] !== MARK) throw new Error('NOT_BACKUP');
  const names = {};
  for (const r of rows.slice(2)) { const no = parseInt(r[0], 10); if (no > 0 && (r[1] || '').trim()) names[no] = r[1].trim(); }
  return { className: rows[0][1] || '', classId: rows[0][2] || '', names };
}
