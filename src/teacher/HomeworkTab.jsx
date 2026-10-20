// 📚 Homework of the selected room: list on the left, everyone's status for the picked item on the right.
const { useEffect, useMemo, useState } = React;
import { roomLabel } from './rooms';
import { Bar, ExercisePick, Modal, StagePick, addDays, dayLabel, daysBetween, findExercise, shortDate, stageContent, toYmd } from './ui';

const STATUS = { none: ['warn', '❌ ยังไม่ทำ'], tried: ['mid', '🟡 ยังไม่ผ่าน'], late: ['mid', '🕒 ผ่าน (ส่งช้า)'], passed: ['ok', '✅ ผ่าน'] };
const ORDER = ['none', 'tried', 'late', 'passed'];
const STARS = [[1, 'แม่น 90% ขึ้นไป'], [2, 'ถึงเป้าความเร็วของด่าน'], [3, '1.5 เท่าของเป้า + แม่น 95%']];

function HomeworkDialog({ code, names, today, editing, onSave, onClose }) {
  const [who, setWho] = useState('');                 // '' = whole class
  const [one, setOne] = useState(false);
  const [mode, setMode] = useState('stage');
  const [stage, setStage] = useState(1);
  const [ex, setEx] = useState('');
  const [minStars, setMinStars] = useState(editing ? Number(editing.minStars) : 2);
  const [due, setDue] = useState(editing ? editing.dueDate : addDays(today, 7));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const quick = [['พรุ่งนี้', 1], ['3 วัน', 3], ['1 สัปดาห์', 7], ['2 สัปดาห์', 14]];

  async function save() {
    if (!due) { setErr('เลือกวันส่ง'); return; }
    let values;
    if (editing) values = { hwId: editing.hwId, minStars, dueDate: due };
    else {
      if (one && !who) { setErr('เลือกนักเรียน'); return; }
      const c = mode === 'stage' ? stageContent(stage) : findExercise(ex);
      if (!c) { setErr('เลือกแบบฝึก'); return; }
      if (due < today && !confirm('วันส่งเป็นวันที่ผ่านมาแล้ว — นักเรียนที่ทำจะถูกนับว่าส่งช้าทั้งหมด ต้องการบันทึกต่อไหม?')) return;
      values = { classCode: code, studentName: one ? who : '', mode, stage: c.stage, lessonId: c.lessonId,
        exerciseTitle: c.exerciseTitle || '', title: c.title, minStars, dueDate: due };
    }
    setBusy(true); setErr('');
    try { await onSave(values); } catch (e) { setErr('บันทึกไม่ได้: ' + e.message); setBusy(false); }
  }

  return (
    <Modal wide title={editing ? `📚 แก้การบ้าน · ${editing.title}` : `📚 มอบหมายการบ้าน · ห้อง ${roomLabel(code)}`} onClose={onClose}>
      {editing ? <div className="hint">{editing.studentName ? '👤 ' + editing.studentName : 'ทั้งห้อง'} · แก้ได้เฉพาะเกณฑ์ผ่านและวันส่ง (ถ้าจะเปลี่ยนเนื้อหา ให้ลบแล้วมอบหมายใหม่)</div> : <>
        <div className="field"><b>ให้</b><div className="row6">
          <span className="seg"><button className={one ? '' : 'on'} onClick={() => setOne(false)}>ทั้งห้อง</button>
            <button className={one ? 'on' : ''} onClick={() => setOne(true)}>คนเดียว</button></span>
          {one && <select value={who} onChange={e => setWho(e.target.value)} aria-label="นักเรียน">
            <option value="">เลือกนักเรียน…</option>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>}
        </div></div>
        <div className="field"><b>เนื้อหา</b>
          <div className="row6"><span className="seg">
            <button className={mode === 'stage' ? 'on' : ''} onClick={() => setMode('stage')}>ทั้งด่าน (ระบบสร้างข้อความ)</button>
            <button className={mode === 'exercise' ? 'on' : ''} onClick={() => setMode('exercise')}>เลือกแบบฝึกเอง</button></span></div>
          {mode === 'stage' ? <StagePick value={stage} onChange={setStage} max={7} cols={4}/> : <ExercisePick value={ex} onChange={setEx}/>}
        </div>
      </>}
      <div className="field"><b>เกณฑ์ผ่าน</b><div className="starpick">{STARS.map(([n, t]) =>
        <button key={n} className={minStars === n ? 'on' : ''} onClick={() => setMinStars(n)}>{'⭐'.repeat(n)}<small>{t}</small></button>)}</div></div>
      <div className="field"><b>วันส่ง <span className="hint">(ทำได้ถึงสิ้นวัน · ส่งหลังจากนั้นยังนับ แต่ขึ้นว่าส่งช้า)</span></b>
        <div className="datechips">{quick.map(([t, n]) =>
          <button key={n} className={'chipbtn' + (due === addDays(today, n) ? ' on' : '')} onClick={() => setDue(addDays(today, n))}>{t}</button>)}
          <input type="date" value={due} onChange={e => setDue(e.target.value)} aria-label="วันส่ง"/></div></div>
      <div className="hint">จับเวลา 1 นาที 30 วินาที · ทำซ้ำได้ไม่จำกัด</div>
      {err && <div className="err">{err}</div>}
      <div className="row6"><span className="spacer"/><button className="btn ghost" onClick={onClose}>ปิด</button>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'กำลังบันทึก…' : editing ? 'บันทึก' : 'มอบหมาย'}</button></div>
    </Modal>
  );
}

function Item({ h, on, onClick }) {
  return (
    <div className={'item' + (on ? ' on' : '')} onClick={onClick} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="t">{h.title}{h.studentName && <span className="who">👤 {h.studentName}</span>}</div>
      <div className="m">ต้องได้ {'⭐'.repeat(h.minStars)} · ส่ง {dayLabel(h.dueDate)} · {h.mode === 'stage' ? 'ระบบสร้างข้อความจากด่าน' : 'แบบฝึกที่เลือก'}</div>
      <Bar value={h.passed} total={h.total}>ผ่าน {h.passed}/{h.total} · ยังไม่เข้าไปทำ {Math.max(0, h.total - h.tried)}</Bar>
    </div>
  );
}

export function HomeworkTab({ code, data, error, api, onData, noOf, onReload }) {
  const today = data?.today || toYmd(new Date());
  const items = useMemo(() => (data?.homework || []).filter(h => h.classCode === code), [data, code]);
  const upcoming = items.filter(h => h.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const past = items.filter(h => h.dueDate < today).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const [selId, setSelId] = useState(null);
  const [dlg, setDlg] = useState(null);                // { editing } | null
  const [res, setRes] = useState({});                  // hwId → { students } | { loading } | { error }
  const sel = items.find(h => h.hwId === selId) || upcoming[0] || past[0] || null;
  useEffect(() => { setSelId(null); }, [code]);
  useEffect(() => { setRes({}); }, [data]);            // new list → results may have changed
  useEffect(() => {
    if (!sel || res[sel.hwId]) return;
    setRes(r => ({ ...r, [sel.hwId]: { loading: true } }));
    api.homeworkResults(sel.hwId).then(d => setRes(r => ({ ...r, [sel.hwId]: d })))
      .catch(e => setRes(r => ({ ...r, [sel.hwId]: { error: e.message } })));
  }, [sel?.hwId, res]);

  async function save(values) {
    const d = await api.setHomework(values);
    onData(d); setDlg(null);
    if (!values.hwId) { const n = (d.homework || []).filter(h => h.classCode === code); setSelId(n[n.length - 1]?.hwId || null); }
  }
  async function del(h) {
    if (!confirm(`ลบการบ้าน "${h.title}"${h.studentName ? ' (' + h.studentName + ')' : ''}?\n(ผลที่นักเรียนทำไว้ยังอยู่ในแท็บ HomeworkSubmissions)`)) return;
    try { onData(await api.deleteHomework(h.hwId)); setSelId(null); } catch (e) { alert('ลบไม่ได้: ' + e.message); }
  }

  const r = sel && res[sel.hwId];
  const students = (r?.students || []).slice().sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (noOf(a.name) - noOf(b.name)));
  const count = k => students.filter(x => x.status === k).length;
  const left = sel ? daysBetween(today, sel.dueDate) : 0;

  if (error) return <div className="alert err"><span className="grow">โหลดการบ้านไม่ได้: {error}</span><button className="btn sm" onClick={onReload}>ลองใหม่</button></div>;
  return (
    <div className="split">
      <div className="card list">
        <button className="btn" onClick={() => setDlg({})} disabled={!data}>＋ มอบหมายการบ้าน</button>
        <div className="scroll">
          {!data ? <div className="empty">กำลังโหลด…</div> : !items.length ? <div className="empty">ยังไม่มีการบ้านของห้องนี้</div> : <>
            {upcoming.length > 0 && <h4>📌 ยังไม่ถึงวันส่ง</h4>}
            {upcoming.map(h => <Item key={h.hwId} h={h} on={sel === h} onClick={() => setSelId(h.hwId)}/>)}
            {past.length > 0 && <h4>📁 เลยวันส่งแล้ว</h4>}
            {past.map(h => <Item key={h.hwId} h={h} on={sel === h} onClick={() => setSelId(h.hwId)}/>)}
          </>}
        </div>
      </div>
      <div className="card detail">
        {!sel ? <div className="empty">กด "＋ มอบหมายการบ้าน" เพื่อเริ่ม · มอบให้ทั้งห้องหรือรายคน · ผ่านเมื่อได้ดาวถึงเกณฑ์ (คิดดาวแบบเดียวกับบทเรียน)</div> : <>
          <h3>📚 {sel.title}
            <span className="hint">{sel.studentName ? '👤 ' + sel.studentName : 'ทั้งห้อง'} · ต้องได้ {'⭐'.repeat(sel.minStars)} · ส่ง {dayLabel(sel.dueDate)}
              {left > 0 ? ` (อีก ${left} วัน)` : left === 0 ? ' (วันนี้)' : ''}</span>
            <span className="spacer"/>
            <button className="btn ghost sm" onClick={() => setDlg({ editing: sel })}>แก้</button>
            <button className="btn ghost sm" onClick={() => del(sel)}>ลบ</button>
          </h3>
          {r?.loading && <div className="empty">กำลังโหลดรายชื่อ…</div>}
          {r?.error && <div className="err">โหลดไม่ได้: {r.error}</div>}
          {r?.students && <>
            <div className="counts">
              <span className="chip ok">✅ ผ่าน {count('passed')}</span>
              {count('late') > 0 && <span className="chip mid">🕒 ส่งช้า {count('late')}</span>}
              <span className="chip mid">🟡 ยังไม่ผ่าน {count('tried')}</span>
              <span className="chip warn">❌ ยังไม่ทำ {count('none')}</span>
            </div>
            <div className="tscroll"><table className="grid static">
              <thead><tr><th>สถานะ</th><th className="r">เลขที่</th><th>ชื่อ</th><th className="r">ดาวดีสุด</th><th className="r">WPM</th><th className="r">แม่น</th><th className="r">ครั้ง</th><th>ผ่านเมื่อ</th><th>ทำล่าสุด</th></tr></thead>
              <tbody>{students.map(x => <tr key={x.name}>
                <td><span className={'chip ' + STATUS[x.status][0]}>{STATUS[x.status][1]}</span></td>
                <td className="r"><span className="num">{noOf(x.name) < 999 ? noOf(x.name) : ''}</span></td>
                <td>{x.name}</td>
                <td className="r">{x.attempts ? ('⭐'.repeat(x.best) || '0') : '–'}</td>
                <td className="r">{x.attempts ? <span className="num">{x.wpm}</span> : '–'}</td>
                <td className="r">{x.attempts ? <span className="num">{x.acc}%</span> : '–'}</td>
                <td className="r">{x.attempts || '–'}</td>
                <td>{shortDate(x.passedAt)}</td><td>{shortDate(x.lastAt)}</td>
              </tr>)}</tbody>
            </table></div>
          </>}
        </>}
      </div>
      {dlg && <HomeworkDialog code={code} names={(data?.classes || {})[code] || []} today={today} editing={dlg.editing}
        onSave={save} onClose={() => setDlg(null)}/>}
    </div>
  );
}
