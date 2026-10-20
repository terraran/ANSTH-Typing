// New teacher page (teacher2.html): sign in → one table per class.
// Style "B": clean layout in the game's colours and fonts (styles live in teacher2.html).
const { useEffect, useMemo, useRef, useState } = React;
import { GOOGLE_CLIENT_ID } from '../config';
import { auth, parseJwt } from '../auth';
import { EDITION, backend } from '../edition';
import { STAGES, buildRows, dayText, flagOf, needsCare, LESSON_COUNT, STAR_MAX } from './roster';
import { StudentPanel } from './StudentPanel';
import { HomeworkTab } from './HomeworkTab';
import { WeeklyTab } from './WeeklyTab';
import { DEMO, demoApi, demoPublicRaw } from './demo';
import { publicApi } from './classroom/publicApi';
import { CreateRoom } from './classroom/CreateRoom';
import { CardsView } from './classroom/Cards';
import { AddStudentsDialog, MoreMenu, NamesDialog, RenameDialog, RosterAlert, importBackup } from './classroom/RoomTools';
import { downloadBackup, forgetAllRosters, forgetRoster, loadRoster, saveRoster } from './classroom/localRoster';
import { demoDrive, realDrive } from './classroom/driveRoster';
import { gradeOf, groups, roomLabel } from './rooms';
import { Modal, StagePick } from './ui';

// Public edition: rooms of student codes (backend/public.js); school: Apps Script rooms from the roster sheet.
const PUBLIC = EDITION.backend === 'public';
// Demo (localhost only): made-up classes, nothing is sent anywhere.
const api = PUBLIC ? publicApi(DEMO ? demoPublicRaw() : backend) : DEMO ? demoApi() : backend;
const roomName = c => api.label ? api.label(c) : 'ห้อง ' + roomLabel(c);
// Code classrooms keep names in the teacher's own Google Drive (pretend Drive in the demo).
const drive = PUBLIC ? (DEMO ? demoDrive() : realDrive) : null;

const ERRORS = {
  Unauthorized: 'บัญชีนี้ไม่ได้อยู่ในรายชื่อครู (TEACHER_EMAILS)',
  CONFIG_CLIENT_ID: 'GOOGLE_CLIENT_ID ใน Script Properties ไม่ตรงกับหน้าเว็บ',
  CONFIG_SPREADSHEET: 'เปิด Google Sheet ไม่ได้ — ตรวจ SPREADSHEET_ID',
  CONFIG_SCRIPT_PERMISSION: 'Apps Script ยังไม่ได้ Authorize สิทธิ์ใหม่',
  TOKEN_EXPIRED: 'การเข้าสู่ระบบหมดอายุ — เข้าสู่ระบบใหม่',
};
const errText = e => ERRORS[String(e?.message || '')] || backend.describeError(e);

// Keep the sign-in for this tab until the Google token runs out (reloading doesn't sign the teacher out).
const TOKEN_KEY = 'teacherToken';
function savedToken() {
  try {
    const t = sessionStorage.getItem(TOKEN_KEY), p = t && parseJwt(t);
    return p && p.exp * 1000 > Date.now() + 60000 ? t : '';
  } catch { return ''; }
}

function Login({ onToken, error }) {
  useEffect(() => {
    let alive = true;
    const init = () => {
      if (!alive) return;
      if (!window.google?.accounts?.id) { setTimeout(init, 250); return; }
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: r => onToken(r.credential) });
      google.accounts.id.renderButton(document.getElementById('gsi'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'th' });
    };
    init();
    return () => { alive = false; };
  }, []);
  return (
    <div className="login">
      <div className="card login-card">
        <img src="assets/ui/logo.png" alt="คีย์บอร์ดเควส" className="login-logo"/>
        <h1>หน้าครู</h1>
        <p className="hint">เข้าสู่ระบบด้วยบัญชี Google ของครู</p>
        <div id="gsi" style={{ minHeight: 44, display: 'flex', justifyContent: 'center' }}/>
        {error && <div className="err">{error}</div>}
        <a className="hint" href="index.html">← กลับไปหน้าเกม</a>
        {EDITION.privacy && <a className="hint" href={EDITION.privacy} target="_blank" rel="noopener">นโยบายความเป็นส่วนตัว</a>}
      </div>
    </div>
  );
}

const COLS = [
  { k: 'no', t: 'เลขที่', cls: 'r' },
  { k: 'name', t: 'ชื่อ' },
  { k: 'stage', t: 'ด่านที่ถึง' },
  { k: 'stars', t: 'ดาว', cls: 'r' },
  { k: 'wpm', t: 'ล่าสุด (WPM)', cls: 'r' },
  { k: 'acc', t: 'แม่น', cls: 'r' },
  { k: 'days', t: 'เล่นล่าสุด' },
  { k: 'flag', t: 'สถานะ' },
];
function sortVal(r, k) {
  if (k === 'stage') return r.lesson;
  if (k === 'flag') { const f = flagOf(r); return f ? ({ warn: 0, mid: 1, none: 2 })[f[0]] : 3; }
  if (k === 'days') return r.days == null ? 9999 : r.days;
  if (k === 'name') return r.name;
  return r[k] == null ? -1 : r[k];
}
const ASC_FIRST = new Set(['no', 'name', 'flag', 'days']);

function StageCell({ r }) {
  if (r.never) return <span className="dim">—</span>;
  return <>
    <span className="stg">{STAGES.map((s, i) => <i key={s.id} className={i < r.stage ? 'f' : i < r.unlock ? 'u' : ''}/>)}</span>
    {r.stage ? <>ด่าน {r.stage} <span className="bt">บท {r.lesson}/{LESSON_COUNT}</span></> : <span className="dim">บทเรียนเดิม</span>}
    {r.unlock > 0 && <span title={`ครูปลดล็อกถึงด่าน ${r.unlock}${r.unlockOwn ? ' (รายคน)' : ' (ทั้งห้อง)'}`}> 🔓</span>}
  </>;
}

// 🔓 dialog: pick a stage for the whole class or the students ticked in the table.
function UnlockDialog({ code, ticked, current, busy, onSave, onClose, onWholeClass }) {
  const [stage, setStage] = useState(current || 1);
  return (
    <Modal title={`🔓 ปลดล็อกด่าน · ${roomName(code)}`} onClose={onClose}>
      <div className="hint">ปกตินักเรียนต้องผ่านบอสก่อนถึงไปด่านถัดไป — ปลดล็อกเมื่ออยากให้ข้ามไปเรียนด่านที่สอนอยู่ · มีผลเมื่อนักเรียนเข้าเกมครั้งถัดไป</div>
      <div><b className="sm">ให้</b> <span className="seg">
        <button className={ticked.length ? '' : 'on'} onClick={onWholeClass}>ทั้งห้อง</button>
        <button className={ticked.length ? 'on' : ''} disabled={!ticked.length} title="ติ๊กช่องหน้าชื่อในตารางเพื่อเลือก">ที่ติ๊กไว้ในตาราง ({ticked.length})</button>
      </span>
      {ticked.length > 0 && ticked.length <= 3 && <span className="hint"> {ticked.map(r => r.name).join(', ')}</span>}</div>
      <div><b className="sm">เล่นได้ถึง</b><StagePick value={stage} onChange={setStage}/></div>
      <div className="row6">
        <button className="btn ghost sm" disabled={busy} onClick={() => onSave(0)}>ยกเลิกการปลดล็อก</button>
        <span className="spacer"/>
        <button className="btn ghost" onClick={onClose}>ปิด</button>
        <button className="btn" disabled={busy} onClick={() => onSave(stage)}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </div>
    </Modal>
  );
}

function Room({ code, rows, loading, error, unlocks, onReload, onUnlocks, tab, setTab, hw, wk, onHw, onReloadHw, onReloadWk, pub }) {
  const [sort, setSort] = useState({ k: 'no', dir: 1 });
  const [sel, setSel] = useState(null);
  const [tick, setTick] = useState(() => new Set());
  const [filt, setFilt] = useState(0);
  const [dlg, setDlg] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [narrow, setNarrow] = useState(innerWidth < 1700);
  useEffect(() => { const f = () => setNarrow(innerWidth < 1700); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  const [pdlg, setPdlg] = useState(null);            // public edition dialogs: 'add' | 'names' | 'rename'
  useEffect(() => { setSel(null); setTick(new Set()); setFilt(0); setMsg(null); setDlg(false); setPdlg(null); }, [code]);

  const classUnlock = (unlocks || []).find(u => u.classCode === code && !u.studentName);

  const list = useMemo(() => {
    let l = rows.slice();
    if (filt === 1) l = l.filter(needsCare);
    if (filt === 2) l = l.filter(r => r.never);
    return l.sort((a, b) => { const x = sortVal(a, sort.k), y = sortVal(b, sort.k);
      return (typeof x === 'string' ? x.localeCompare(y, 'th') : x - y) * sort.dir || a.no - b.no; });
  }, [rows, sort, filt]);
  const selRow = rows.find(r => r.no === sel);
  const ticked = rows.filter(r => tick.has(r.no));
  const nCare = rows.filter(needsCare).length;
  const active = rows.filter(r => r.days != null && r.days <= 7).length;
  const withWpm = rows.filter(r => r.wpm != null);
  const avgWpm = withWpm.length ? Math.round(withWpm.reduce((a, r) => a + r.wpm, 0) / withWpm.length) : '—';

  const hwCount = (hw.data?.homework || []).filter(h => h.classCode === code && h.dueDate >= (hw.data.today || '')).length;
  const grade = gradeOf(code, wk.data?.grades);
  const tabs = [['st', '👥 นักเรียน'], EDITION.homework && ['hw', '📚 การบ้าน', hwCount],
    EDITION.weekly && ['wk', '🏆 แบบทดสอบประจำสัปดาห์' + (grade ? ' · ' + grade.grade : '')]].filter(Boolean);
  const noOf = name => rows.find(r => r.name === name)?.no ?? 999;

  const sortBy = k => setSort(s => s.k === k ? { k, dir: -s.dir } : { k, dir: ASC_FIRST.has(k) ? 1 : -1 });
  const toggle = (no, on) => setTick(t => { const n = new Set(t); on ? n.add(no) : n.delete(no); return n; });

  async function doUnlock(stage) {
    const who = ticked.length ? ticked.map(r => r.code || r.name) : [''];
    const what = stage ? `ปลดล็อกถึงด่าน ${stage}` : 'ยกเลิกการปลดล็อก';
    const target = ticked.length ? `นักเรียนที่ติ๊กไว้ ${ticked.length} คน` : `ทั้ง${roomName(code)}`;
    setBusy('unlock'); setMsg(null);
    try {
      let d = null;
      for (const name of who) d = await api.setUnlock(code, name, stage);
      if (d) onUnlocks(d.unlocks || []);
      if (api.reloadAfterUnlock && ticked.length) onReload();
      setMsg(['ok', `${what} ให้${target}แล้ว — มีผลเมื่อนักเรียนเข้าเกมครั้งถัดไป`]);
      setDlg(false);
    } catch (e) { setMsg(['err', 'บันทึกไม่ได้: ' + errText(e)]); }
    setBusy('');
  }
  async function doTips() {
    if (!confirm(`ให้นักเรียน${roomName(code)} เห็นคำแนะนำของ Mr.AT ทั้งหมดอีกครั้ง?\n(มีผลตอนนักเรียนเข้าสู่ระบบครั้งถัดไป)`)) return;
    setBusy('tips'); setMsg(null);
    try { const r = await api.resetTips(code); setMsg(['ok', `รีเซ็ตคำแนะนำให้ ${r.reset || 0} คนแล้ว`]); }
    catch (e) { setMsg(['err', 'รีเซ็ตไม่สำเร็จ: ' + errText(e)]); }
    setBusy('');
  }

  // ── code classrooms (public edition) ──
  async function reissue(list) {
    if (!list.length) return;
    if (!confirm(`ออกรหัสใหม่ให้ ${list.length === 1 ? list[0].name : list.length + ' คน'}?\nรหัสเดิมจะใช้ไม่ได้อีก ดาวและผลฝึกยังอยู่ครบ — พิมพ์การ์ดใหม่ให้นักเรียน`)) return;
    setBusy('reissue'); setMsg(null);
    try {
      for (const r of list) await api.reissueCode(r.code);
      pub.onChanged(); setTick(new Set(list.map(r => r.no)));
      setMsg(['ok', `ออกรหัสใหม่ ${list.length} คนแล้ว — ติ๊กไว้ให้แล้ว กด 🖨️ พิมพ์การ์ด เพื่อพิมพ์เฉพาะคนเหล่านี้`]);
    } catch (e) { setMsg(['err', 'ออกรหัสใหม่ไม่ได้: ' + errText(e)]); }
    setBusy('');
  }
  async function rename(name) {
    try { await api.renameClass(code, name); setPdlg(null); pub.onRenamed(); } catch (e) { setMsg(['err', 'เปลี่ยนชื่อไม่ได้: ' + errText(e)]); }
  }
  async function remove() {
    if (!confirm(`ลบ${roomName(code)}?\nรหัสของนักเรียน ${rows.length} คนจะใช้ไม่ได้ และดาว/ผลฝึกทั้งหมดของห้องนี้จะหายถาวร`)) return;
    if (prompt('พิมพ์คำว่า ลบ เพื่อยืนยัน') !== 'ลบ') return;
    try { await api.deleteClass(code); pub.onDeleted(); } catch (e) { setMsg(['err', 'ลบไม่ได้: ' + errText(e)]); }
  }

  return (
    <section className="page">
      <div className="roomhead">
        <h2>{roomName(code)}</h2>
        <div className="stats">
          <div className="stat"><span>นักเรียน</span><b className="num">{rows.length}</b></div>
          <div className="stat"><span>เล่นใน 7 วัน</span><b className="num">{active}</b></div>
          <div className="stat"><span>ความเร็วเฉลี่ย</span><b className="num">{avgWpm}</b><span>WPM</span></div>
          <button className={'stat care' + (filt === 1 ? ' on' : '')} onClick={() => setFilt(filt === 1 ? 0 : 1)} title="แสดงเฉพาะคนที่ต้องดูแล">
            <span>⚠️ ต้องดูแล</span><b className="num">{nCare}</b></button>
        </div>
        <div className="spacer"/>
        <button className="btn ghost" onClick={() => setDlg(true)} title={classUnlock ? `ตอนนี้ทั้งห้องเล่นได้ถึงด่าน ${classUnlock.stage}` : 'ตอนนี้เล่นตามลำดับ'}>
          {classUnlock ? `🔓 ปลดล็อกถึงด่าน ${classUnlock.stage}…` : '🔓 ปลดล็อกด่าน…'}</button>
        {pub ? <>
          <button className="btn ghost" onClick={() => setPdlg('add')}>＋ นักเรียน</button>
          <button className="btn ghost" onClick={() => pub.onPrint(ticked.map(r => r.no))}>🖨️ พิมพ์การ์ด</button>
          <button className="btn ghost" onClick={pub.onSaveDrive} disabled={pub.busy} title="บันทึกรายชื่อลง Google Drive ของคุณ (เซิร์ฟเวอร์ของเกมไม่เห็นชื่อ)">☁️ Drive</button>
          <MoreMenu items={[
            [`🔁 ออกรหัสใหม่ให้คนที่ติ๊ก (${ticked.length})`, () => reissue(ticked), !ticked.length || !!busy],
            ['✏️ ใส่/แก้รายชื่อนักเรียน', () => setPdlg('names')],
            ['💡 ให้ดูคำแนะนำใหม่', doTips, !!busy],
            ['⬇️ ดาวน์โหลดรายชื่อ (.csv)', pub.onBackup],
            ['☁️ ดึงรายชื่อจาก Drive อีกครั้ง', pub.onPullDrive],
            ['📂 เปิดไฟล์สำรองรายชื่อ…', pub.onPick],
            ['✏️ เปลี่ยนชื่อห้อง', () => setPdlg('rename')],
            ['🗑️ ลบห้องนี้', remove],
          ]}/>
        </> : <button className="btn ghost" onClick={doTips} disabled={!!busy}>💡 ให้ดูคำแนะนำใหม่</button>}
        <button className="btn ghost" onClick={() => { onReload(); if (tab === 'hw') onReloadHw(); if (tab === 'wk') onReloadWk(); }}
          disabled={loading} title="โหลดข้อมูลใหม่" aria-label="โหลดข้อมูลใหม่">↻</button>
      </div>

      {tabs.length > 1 && <div className="tabs" role="tablist">{tabs.map(([k, t, n]) =>
        <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
          {t}{n > 0 && <span className="cnt">{n}</span>}</button>)}</div>}

      {msg && <div className={'alert ' + msg[0]}><span className="grow">{msg[1]}</span><button className="x" onClick={() => setMsg(null)} aria-label="ปิด">✕</button></div>}
      {error && <div className="alert err"><span className="grow">โหลดข้อมูลไม่ได้: {error}</span><button className="btn sm" onClick={onReload}>ลองใหม่</button></div>}
      {pub && !loading && <RosterAlert {...pub.alert} students={rows}/>}

      {tab === 'hw' && <HomeworkTab code={code} data={hw.data} error={hw.error} api={api} onData={onHw} onReload={onReloadHw} noOf={noOf}/>}
      {tab === 'wk' && <WeeklyTab code={code} data={wk.data} error={wk.error} api={api} onReload={onReloadWk}/>}
      {tab === 'st' && <div className="tablewrap">
        <div className="card tbox">
          <div className="tscroll">
            <table className={'grid' + (selRow && narrow ? ' narrow' : '')}>
              <thead><tr>
                <th className="c"><input type="checkbox" aria-label="เลือกทั้งหมด" checked={rows.length > 0 && tick.size === rows.length}
                  onChange={e => setTick(e.target.checked ? new Set(rows.map(r => r.no)) : new Set())}/></th>
                {COLS.map(c => <th key={c.k} className={(c.cls || '') + (sort.k === c.k ? ' sorted' : '')} onClick={() => sortBy(c.k)}>
                  {c.t} <span className="ar">{sort.k === c.k ? (sort.dir > 0 ? '▲' : '▼') : '▲▼'}</span></th>)}
              </tr></thead>
              <tbody>{list.map(r => { const f = flagOf(r); return (
                <tr key={r.no} className={sel === r.no ? 'sel' : ''} onClick={() => setSel(sel === r.no ? null : r.no)}>
                  <td className="c" onClick={e => e.stopPropagation()}><input type="checkbox" aria-label={'เลือก ' + r.name} checked={tick.has(r.no)} onChange={e => toggle(r.no, e.target.checked)}/></td>
                  <td className="r"><span className="num">{r.no}</span></td>
                  <td className="nm">{r.name}</td>
                  <td><StageCell r={r}/></td>
                  <td className="r">{r.never ? '—' : <><span className="num">{r.stars}</span> ⭐</>}</td>
                  <td className="r">{r.wpm == null ? '—' : <><span className="num">{r.wpm}</span>{r.trend !== 0 && <span className={'trend ' + (r.trend > 0 ? 'up' : 'down')} title="เทียบกับค่าเฉลี่ย 5 ครั้งก่อนหน้า">{r.trend > 0 ? '▲' : '▼'}</span>}</>}</td>
                  <td className="r">{r.acc == null ? '—' : <span className="num" style={r.acc < 85 ? { color: 'var(--red)' } : null}>{r.acc}%</span>}</td>
                  <td style={r.days > 7 ? { color: 'var(--red)', fontWeight: 700 } : null}>{dayText(r.days)}</td>
                  <td>{f ? <span className={'chip ' + f[0]}>{f[1]}</span> : <span className="chip ok">✓ ปกติ</span>}</td>
                </tr>); })}</tbody>
            </table>
            {loading && <div className="empty">กำลังโหลด…</div>}
            {!loading && !error && !list.length && <div className="empty">{filt === 1 ? '✅ ไม่มีใครต้องดูแลเป็นพิเศษ' : filt === 2 ? 'ทุกคนเข้าเล่นแล้ว' : 'ยังไม่มีนักเรียนในห้องนี้'}</div>}
          </div>
          <div className="foot">
            <span>กดหัวตารางเพื่อเรียง · กดแถวเพื่อดูกราฟรายคน · ดาวคิดจากผลฝึกตามเกณฑ์ของเกม (สูงสุด {STAR_MAX})</span>
            <span className="seg">{['ทั้งหมด', '⚠️ ต้องดูแล', 'ยังไม่เข้าเล่น'].map((t, i) =>
              <button key={i} className={filt === i ? 'on' : ''} onClick={() => setFilt(i)}>{t}</button>)}</span>
          </div>
        </div>
        {selRow && <StudentPanel r={selRow} onClose={() => setSel(null)} onUnlock={() => { setTick(new Set([selRow.no])); setDlg(true); }}
          onReissue={pub ? () => reissue([selRow]) : null}/>}
      </div>}
      {dlg && <UnlockDialog code={code} ticked={ticked} busy={busy === 'unlock'}
        current={ticked.length === 1 && ticked[0].unlockOwn ? ticked[0].unlock : classUnlock ? Number(classUnlock.stage) : 1}
        onSave={doUnlock} onClose={() => setDlg(false)} onWholeClass={() => setTick(new Set())}/>}
      {pdlg === 'add' && <AddStudentsDialog api={api} classId={code} nextNo={Math.max(0, ...rows.map(r => r.no)) + 1} onClose={() => setPdlg(null)}
        onAdded={(codes, names) => { setPdlg(null); pub.onAdded(codes, names); setTick(new Set(codes.map(c => c.no)));
          setMsg(['ok', `เพิ่มนักเรียน ${codes.length} คนแล้ว — ติ๊กไว้ให้แล้ว กด 🖨️ พิมพ์การ์ด เพื่อพิมพ์เฉพาะคนใหม่`]); }}/>}
      {pdlg === 'rename' && <RenameDialog name={api.label(code)} onSave={rename} onClose={() => setPdlg(null)}/>}
      {pdlg === 'names' && <NamesDialog students={rows} names={pub.names} onClose={() => setPdlg(null)}
        onSave={names => { setPdlg(null); pub.onNames(names); }}/>}
    </section>
  );
}

export function TeacherApp() {
  const [token, setToken] = useState(() => DEMO ? 'demo' : savedToken());
  const [loginErr, setLoginErr] = useState('');
  const [classes, setClasses] = useState(null);
  const [code, setCode] = useState('');
  const [data, setData] = useState({});          // code → { students, error, loading }
  const [unlocks, setUnlocks] = useState([]);
  const [tab, setTab] = useState('st');
  const [hw, setHw] = useState({});              // { data, error } — homework of every room (one call)
  const [wk, setWk] = useState({});              // { data, error } — weekly tests of every grade
  const [view, setView] = useState('room');      // public edition: 'room' | 'create' | 'cards'
  const [printNos, setPrintNos] = useState([]);
  const [roster, setRoster] = useState(null);    // public edition: names of the open room (this computer only)
  const [dropMsg, setDropMsg] = useState(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const fileRef = useRef(null);
  const owner = DEMO ? 'demo' : token ? parseJwt(token)?.sub || '' : '';
  const hint = DEMO ? '' : token ? parseJwt(token)?.email || '' : '';
  const email = DEMO ? 'ตัวอย่าง (ข้อมูลสมมุติ)' : token ? parseJwt(token)?.email : '';

  function signOut(err) {
    if (PUBLIC && owner && !DEMO) forgetAllRosters(owner);     // names leave this computer (Drive keeps them)
    try { sessionStorage.removeItem(TOKEN_KEY); google.accounts.id.disableAutoSelect(); } catch {}
    auth.idToken = ''; setToken(''); setClasses(null); setData({}); setLoginErr(err || '');
  }
  const expired = e => { if (String(e?.message) === 'TOKEN_EXPIRED') { signOut(ERRORS.TOKEN_EXPIRED); return true; } return false; };

  useEffect(() => {
    if (!token) return;
    if (!DEMO) auth.idToken = token;
    api.teacherClasses().then(d => {
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
      const cs = PUBLIC ? d.classes || [] : (d.classes || []).slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      setClasses(cs);
      let last = ''; try { last = localStorage.getItem('teacherClass') || ''; } catch {}
      setCode(cs.includes(last) ? last : cs[0] || '');
    }).catch(e => signOut(errText(e)));
    api.getUnlocks().then(d => setUnlocks(d.unlocks || [])).catch(() => {});
    loadHw(); loadWk();
  }, [token]);

  function loadHw() {
    if (!EDITION.homework) return;
    api.homeworkList().then(d => setHw({ data: d })).catch(e => { if (!expired(e)) setHw(h => ({ ...h, error: errText(e) })); });
  }
  function loadWk() {
    if (!EDITION.weekly) return;
    api.weeklyTests().then(d => setWk({ data: d })).catch(e => { if (!expired(e)) setWk(w => ({ ...w, error: errText(e) })); });
  }

  function load(c) {
    if (!c) return;
    setData(d => ({ ...d, [c]: { ...(d[c] || {}), loading: true, error: '' } }));
    api.classData(c)
      .then(r => setData(d => ({ ...d, [c]: { students: r.students || [], loading: false, error: '' } })))
      .catch(e => { if (!expired(e)) setData(d => ({ ...d, [c]: { ...(d[c] || {}), loading: false, error: errText(e) } })); });
  }
  useEffect(() => {
    if (!code) return;
    try { localStorage.setItem('teacherClass', code); } catch {}
    if (!data[code]) load(code);
    if (PUBLIC) { setRoster(loadRoster(owner, code)); setDropMsg(null); }
  }, [code]);

  const cur = data[code] || {};
  // Code classrooms: the server has numbers only; names come from this computer's list.
  const students = useMemo(() => !PUBLIC || !cur.students ? cur.students : cur.students.map(s => {
    const n = roster?.names?.[s.no];
    return { ...s, name: n || 'เลขที่ ' + s.no, noName: !n };
  }), [cur.students, roster]);
  const rows = useMemo(() => buildRows(students, unlocks, code), [students, unlocks, code]);

  async function reloadClasses(pick) {
    const d = await api.teacherClasses();
    setClasses(d.classes || []);
    setCode(pick && d.classes.includes(pick) ? pick : d.classes[0] || '');
  }
  function useFile(file) {
    if (!file) return;
    importBackup(file, code, api.label?.(code)).then(r => {
      if (r.error) { setDropMsg(['err', r.error]); return; }
      setRoster(saveRoster(owner, code, r.roster));
      setDropMsg(['ok', `แสดงชื่อนักเรียน ${Object.keys(r.roster.names).length} คนจากไฟล์สำรองแล้ว (เก็บไว้ในเครื่องนี้)`]);
    });
  }
  useEffect(() => {                                  // drop a backup file anywhere on the page
    if (!PUBLIC || !code) return;
    const over = e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); document.body.classList.add('dragging'); } };
    const leave = e => { if (!e.relatedTarget) document.body.classList.remove('dragging'); };
    const drop = e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); document.body.classList.remove('dragging'); useFile(e.dataTransfer.files[0]); };
    addEventListener('dragover', over); addEventListener('dragleave', leave); addEventListener('drop', drop);
    return () => { removeEventListener('dragover', over); removeEventListener('dragleave', leave); removeEventListener('drop', drop); };
  }, [code, owner]);

  // ── Google Drive (the teacher's own) ──
  const rosterNow = roster;
  async function saveDrive(given) {
    const roster = given || rosterNow;
    if (!roster || roster.mode !== 'list') { setDropMsg(['ok', 'ห้องนี้ไม่มีรายชื่อ — ไม่ต้องบันทึก']); return; }
    setDriveBusy(true);
    try {
      await drive.connectDrive(hint);
      await drive.saveToDrive(code, api.label(code), cur.students || [], roster.names);
      setRoster(saveRoster(owner, code, { ...roster, backedUp: true, drive: true }));
      setDropMsg(['ok', 'บันทึกรายชื่อลง Google Drive แล้ว']);
    } catch (e) { setDropMsg(['err', drive.describeDriveError(e)]); }
    setDriveBusy(false);
  }
  async function pullDrive(quiet) {
    setDriveBusy(true);
    try {
      await drive.connectDrive(hint);
      const all = await drive.loadAllFromDrive(); let found = 0;
      for (const [id, names] of Object.entries(all)) if (classes?.includes(id)) { saveRoster(owner, id, { names, mode: 'list', backedUp: true, drive: true }); found++; }
      const mine = all[code];
      if (mine) setRoster(loadRoster(owner, code));
      if (!quiet) setDropMsg(mine ? ['ok', `ดึงรายชื่อจาก Google Drive แล้ว (${found} ห้อง)`] : ['err', 'ไม่พบรายชื่อของห้องนี้ใน Google Drive ของบัญชีนี้ — ห้องนี้อาจใส่แค่จำนวน หรือบันทึกไว้ในบัญชีอื่น']);
    } catch (e) { if (!quiet) setDropMsg(['err', drive.describeDriveError(e)]); }
    setDriveBusy(false);
  }
  // Already connected to Drive in this tab: fill a room with no names, and save changed lists, by themselves.
  useEffect(() => {
    if (!PUBLIC || !code || !cur.students || cur.loading || !drive.driveReady() || driveBusy) return;
    if (!roster) { pullDrive(true); return; }
    if (roster.mode === 'list' && roster.drive && !roster.backedUp) saveDrive();
  }, [code, cur.students, cur.loading, roster]);

  const pub = PUBLIC && {
    busy: driveBusy,
    names: roster?.names,
    onSaveDrive: () => saveDrive(),
    onNames: names => {                          // from the ✏️ dialog: keep here, then put in Drive (this click may open Google's popup)
      const next = saveRoster(owner, code, { names, mode: Object.keys(names).length ? 'list' : 'count', backedUp: false, drive: !!roster?.drive });
      setRoster(next);
      if (next.mode === 'list') saveDrive(next);
    },
    onPullDrive: () => pullDrive(false),
    onPrint: nos => { setPrintNos(nos); setView('cards'); },
    onBackup: () => { downloadBackup(code, api.label(code), rows, roster?.names); if (roster) setRoster(saveRoster(owner, code, { ...roster, backedUp: true })); },
    onPick: () => fileRef.current?.click(),
    onChanged: () => { load(code); if (roster) setRoster(saveRoster(owner, code, { ...roster, backedUp: false })); },
    onAdded: (codes, names) => {
      const next = { names: { ...(roster?.names || {}), ...names }, mode: roster?.mode || (Object.keys(names).length ? 'list' : 'count'), backedUp: false, drive: !!roster?.drive };
      setRoster(saveRoster(owner, code, next)); load(code);
    },
    onRenamed: () => { setClasses(cs => [...cs]); if (roster?.mode === 'list') setRoster(saveRoster(owner, code, { ...roster, backedUp: false })); },
    onDeleted: () => { forgetRoster(owner, code); if (drive.driveReady()) drive.deleteFromDrive(code); setData(d => { const n = { ...d }; delete n[code]; return n; }); reloadClasses(); },
    alert: { roster, classId: code, className: api.label?.(code), owner, onRoster: setRoster, onPick: () => fileRef.current?.click(),
      onSaveDrive: saveDrive, onPullDrive: () => pullDrive(false), busy: driveBusy },
  };

  if (!token) return <Login onToken={t => { setLoginErr(''); setToken(t); }} error={loginErr}/>;
  return (
    <div className="app">
      <div className="top">
        <div className="brand"><img src="assets/ui/logo.png" alt=""/><span>หน้าครู</span></div>
        <div className="spacer"/>
        {dropMsg && <div className={'alert top-msg ' + dropMsg[0]}><span className="grow">{dropMsg[1]}</span><button className="x" onClick={() => setDropMsg(null)} aria-label="ปิด">✕</button></div>}
        <div className="who"><span>{email}</span><button className="btn ghost sm" onClick={() => signOut('')}>ออกจากระบบ</button></div>
      </div>
      {PUBLIC && <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e => { useFile(e.target.files[0]); e.target.value = ''; }}/>}
      {PUBLIC && <div className="dropveil">📂 ปล่อยไฟล์สำรองตรงนี้</div>}
      {PUBLIC && view === 'cards' && <CardsView className={api.label(code)} students={rows} names={roster?.names} ticked={printNos} onClose={() => setView('room')}/>}
      {!classes ? <div className="empty">กำลังโหลดรายชื่อห้อง…</div>
        : PUBLIC && (view === 'create' || !classes.length) ? <CreateRoom api={api} owner={owner} drive={drive} hint={hint} first={!classes.length}
            onCancel={classes.length ? () => setView('room') : null}
            onPrint={id => { reloadClasses(id).then(() => { setPrintNos([]); setView('cards'); }); }}
            onDone={id => { setView('room'); reloadClasses(id); }}/>
        : !classes.length ? <div className="empty">ยังไม่มีห้องเรียน — เพิ่มนักเรียนในแท็บ Roster ของ Google Sheet ก่อน</div>
        : <div className="layout">
            <nav className="card sidebar" aria-label="เลือกห้อง">
              <b className="side-title">ห้องของฉัน</b>
              {PUBLIC && <button className="btn sm new-room" onClick={() => setView('create')}>＋ สร้างห้องใหม่</button>}
              <div className="side-list">{groups(classes).map(([g, cs]) => <React.Fragment key={g}>
                {g && <h4>{g}</h4>}
                {cs.map(c => <button key={c} className={c === code ? 'on' : ''} aria-current={c === code ? 'page' : undefined}
                  onClick={() => { setCode(c); setView('room'); }}>{roomName(c)}</button>)}
              </React.Fragment>)}</div>
              <a className="side-link" title="สร้างห้องแข่งให้นักเรียนในหน้าเกม" href="index.html" target="_blank" rel="noopener">🏁 เปิดเกม ↗</a>
            </nav>
            <Room code={code} rows={rows} loading={!!cur.loading} error={cur.error} unlocks={unlocks}
            onReload={() => load(code)} onUnlocks={setUnlocks} tab={tab} setTab={setTab}
            hw={hw} wk={wk} onHw={d => setHw({ data: d })} onReloadHw={loadHw} onReloadWk={loadWk} pub={pub}/>
          </div>}
    </div>
  );
}
