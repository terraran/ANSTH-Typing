// New teacher page (teacher2.html): sign in → one table per class.
// Style "B": clean layout in the game's colours and fonts (styles live in teacher2.html).
const { useEffect, useMemo, useState } = React;
import { GOOGLE_CLIENT_ID } from '../config';
import { auth, parseJwt } from '../auth';
import { EDITION, backend } from '../edition';
import { STAGES, buildRows, dayText, flagOf, needsCare, LESSON_COUNT, STAR_MAX } from './roster';
import { StudentPanel } from './StudentPanel';
import { DEMO, demoClass } from './demo';

// Demo (localhost only): made-up classes, nothing is sent anywhere.
const api = DEMO ? {
  teacherClasses: async () => ({ classes: ['Y603', 'Y604'] }),
  getUnlocks: async () => ({ unlocks: demoUnlocks }),
  classData: async c => ({ students: demoClass(c) }),
  setUnlock: async (classCode, studentName, stage) => {
    demoUnlocks = demoUnlocks.filter(u => !(u.classCode === classCode && u.studentName === studentName));
    if (stage) demoUnlocks.push({ classCode, studentName, stage });
    return { unlocks: demoUnlocks };
  },
  resetTips: async () => ({ reset: 32 }),
} : backend;
let demoUnlocks = [{ classCode: 'Y603', studentName: '', stage: 3 }];

// Y603 → Y6.3 (how rooms are written at school)
export const roomLabel = c => { const m = /^Y(\d)(\d{2})$/.exec(c || ''); return m ? `Y${m[1]}.${parseInt(m[2], 10)}` : c; };

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

function Room({ code, rows, loading, error, unlocks, onReload, onUnlocks }) {
  const [sort, setSort] = useState({ k: 'no', dir: 1 });
  const [sel, setSel] = useState(null);
  const [tick, setTick] = useState(() => new Set());
  const [filt, setFilt] = useState(0);
  const [stage, setStage] = useState(1);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [narrow, setNarrow] = useState(innerWidth < 1700);
  useEffect(() => { const f = () => setNarrow(innerWidth < 1700); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  useEffect(() => { setSel(null); setTick(new Set()); setFilt(0); setMsg(null); }, [code]);

  const classUnlock = (unlocks || []).find(u => u.classCode === code && !u.studentName);
  useEffect(() => { setStage(classUnlock ? Number(classUnlock.stage) : 1); }, [code, classUnlock?.stage]);

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

  const sortBy = k => setSort(s => s.k === k ? { k, dir: -s.dir } : { k, dir: ASC_FIRST.has(k) ? 1 : -1 });
  const toggle = (no, on) => setTick(t => { const n = new Set(t); on ? n.add(no) : n.delete(no); return n; });

  async function doUnlock() {
    const who = ticked.length ? ticked.map(r => r.name) : [''];
    const what = stage ? `ปลดล็อกถึงด่าน ${stage}` : 'ยกเลิกการปลดล็อก';
    const target = ticked.length ? `นักเรียนที่ติ๊กไว้ ${ticked.length} คน` : `ทั้งห้อง ${roomLabel(code)}`;
    if (!confirm(`${what} ให้${target}?`)) return;
    setBusy('unlock'); setMsg(null);
    try {
      let d = null;
      for (const name of who) d = await api.setUnlock(code, name, stage);
      if (d) onUnlocks(d.unlocks || []);
      setMsg(['ok', `${what} ให้${target}แล้ว — มีผลเมื่อนักเรียนเข้าเกมครั้งถัดไป`]);
    } catch (e) { setMsg(['err', 'บันทึกไม่ได้: ' + errText(e)]); }
    setBusy('');
  }
  async function doTips() {
    if (!confirm(`ให้นักเรียนห้อง ${roomLabel(code)} เห็นคำแนะนำของ Mr.AT ทั้งหมดอีกครั้ง?\n(มีผลตอนนักเรียนเข้าสู่ระบบครั้งถัดไป)`)) return;
    setBusy('tips'); setMsg(null);
    try { const r = await api.resetTips(code); setMsg(['ok', `รีเซ็ตคำแนะนำให้ ${r.reset || 0} คนแล้ว`]); }
    catch (e) { setMsg(['err', 'รีเซ็ตไม่สำเร็จ: ' + errText(e)]); }
    setBusy('');
  }

  return (
    <section className="page">
      <div className="roomhead">
        <h2>ห้อง {roomLabel(code)}</h2>
        <div className="stats">
          <div className="stat"><span>นักเรียน</span><b className="num">{rows.length}</b></div>
          <div className="stat"><span>เล่นใน 7 วัน</span><b className="num">{active}</b></div>
          <div className="stat"><span>ความเร็วเฉลี่ย</span><b className="num">{avgWpm}</b><span>WPM</span></div>
          <button className={'stat care' + (filt === 1 ? ' on' : '')} onClick={() => setFilt(filt === 1 ? 0 : 1)} title="แสดงเฉพาะคนที่ต้องดูแล">
            <span>⚠️ ต้องดูแล</span><b className="num">{nCare}</b></button>
        </div>
        <div className="spacer"/>
        <button className="btn ghost" onClick={onReload} disabled={loading} title="โหลดข้อมูลใหม่">↻ โหลดใหม่</button>
        <a className="btn purple" href="index.html" target="_blank" rel="noopener">🏁 เปิดเกมเพื่อสร้างห้องแข่ง</a>
      </div>

      <div className="toolbar">
        <div className="unlock well">🔓
          <select value={stage} onChange={e => setStage(Number(e.target.value))} aria-label="ปลดล็อกถึงด่าน">
            {STAGES.map(s => <option key={s.id} value={s.id}>ปลดล็อกถึงด่าน {s.id} · {s.title}</option>)}
            <option value={0}>ยกเลิกการปลดล็อก (เล่นตามลำดับ)</option>
          </select>
          ให้
          <span className="seg">
            <button className={ticked.length ? '' : 'on'} onClick={() => setTick(new Set())}>ทั้งห้อง</button>
            <button className={ticked.length ? 'on' : ''} disabled={!ticked.length} title="ติ๊กช่องหน้าชื่อเพื่อเลือก">ที่ติ๊กไว้ ({ticked.length})</button>
          </span>
          <button className="btn sm" onClick={doUnlock} disabled={!!busy}>{busy === 'unlock' ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          <span className="hint now">{classUnlock ? `ตอนนี้ทั้งห้องเล่นได้ถึงด่าน ${classUnlock.stage}` : 'ตอนนี้: เล่นตามลำดับ'}</span>
        </div>
        <div className="spacer"/>
        <button className="btn gold" onClick={doTips} disabled={!!busy}>💡 ให้ดูคำแนะนำใหม่</button>
        {(EDITION.homework || EDITION.weekly) && <a className="btn ghost" href="teacher.html" title="การบ้านและแบบทดสอบประจำสัปดาห์ยังอยู่ที่หน้าครูเดิม">📚 การบ้าน / แบบทดสอบ ↗</a>}
      </div>

      {msg && <div className={'alert ' + msg[0]}><span className="grow">{msg[1]}</span><button className="x" onClick={() => setMsg(null)} aria-label="ปิด">✕</button></div>}
      {error && <div className="alert err"><span className="grow">โหลดข้อมูลไม่ได้: {error}</span><button className="btn sm" onClick={onReload}>ลองใหม่</button></div>}

      <div className="tablewrap">
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
        {selRow && <StudentPanel r={selRow} onClose={() => setSel(null)} onUnlock={() => setTick(new Set([selRow.no]))}/>}
      </div>
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
  const email = DEMO ? 'ตัวอย่าง (ข้อมูลสมมุติ)' : token ? parseJwt(token)?.email : '';

  function signOut(err) {
    try { sessionStorage.removeItem(TOKEN_KEY); google.accounts.id.disableAutoSelect(); } catch {}
    auth.idToken = ''; setToken(''); setClasses(null); setData({}); setLoginErr(err || '');
  }
  const expired = e => { if (String(e?.message) === 'TOKEN_EXPIRED') { signOut(ERRORS.TOKEN_EXPIRED); return true; } return false; };

  useEffect(() => {
    if (!token) return;
    if (!DEMO) auth.idToken = token;
    api.teacherClasses().then(d => {
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
      const cs = (d.classes || []).slice().sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      setClasses(cs);
      let last = ''; try { last = localStorage.getItem('teacherClass') || ''; } catch {}
      setCode(cs.includes(last) ? last : cs[0] || '');
    }).catch(e => signOut(errText(e)));
    api.getUnlocks().then(d => setUnlocks(d.unlocks || [])).catch(() => {});
  }, [token]);

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
  }, [code]);

  const cur = data[code] || {};
  const rows = useMemo(() => buildRows(cur.students, unlocks, code), [cur.students, unlocks, code]);

  if (!token) return <Login onToken={t => { setLoginErr(''); setToken(t); }} error={loginErr}/>;
  return (
    <div className="app">
      <div className="top">
        <div className="brand"><img src="assets/ui/logo.png" alt=""/><span>หน้าครู</span></div>
        {classes && classes.length > 0 && <div className="crumb">›
          <select value={code} onChange={e => setCode(e.target.value)} aria-label="เลือกห้อง">
            {classes.map(c => <option key={c} value={c}>ห้อง {roomLabel(c)}</option>)}
          </select></div>}
        <div className="spacer"/>
        <div className="who"><span>{email}</span><button className="btn ghost sm" onClick={() => signOut('')}>ออกจากระบบ</button></div>
      </div>
      {!classes ? <div className="empty">กำลังโหลดรายชื่อห้อง…</div>
        : !classes.length ? <div className="empty">ยังไม่มีห้องเรียน — เพิ่มนักเรียนในแท็บ Roster ของ Google Sheet ก่อน</div>
        : <Room code={code} rows={rows} loading={!!cur.loading} error={cur.error} unlocks={unlocks}
            onReload={() => load(code)} onUnlocks={setUnlocks}/>}
    </div>
  );
}
