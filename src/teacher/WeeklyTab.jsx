// 🏆 Weekly test of the selected room's grade: weeks on the left, ranking + who hasn't done it on the right.
const { useEffect, useMemo, useState } = React;
import { gradeOf, roomLabel, sameRoom } from './rooms';
import { Bar, ExercisePick, LESSON_GROUPS, Modal, StagePick, addDays, findExercise, stageContent, toYmd, weekLabel } from './ui';

// Same key = same text and same board (only the hints setting changed).
const testKey = t => t.stage ? 's' + t.stage : t.lessonId + '-' + ((/^(\d+\.\d+)/.exec(t.exerciseTitle || '') || [])[1]);
const exKeyOf = t => { for (const g of LESSON_GROUPS) for (const it of g.items) if (it.lessonId === Number(t.lessonId) && it.exerciseTitle === t.exerciseTitle) return it.key; return ''; };
const starsOf = (score, max) => { const p = max > 0 ? score / max * 100 : 0; return p >= 85 ? 3 : p >= 65 ? 2 : p >= 45 ? 1 : 0; };

function WeeklyDialog({ grade, week, existing, onSave, onClose }) {
  const [mode, setMode] = useState(existing && !existing.stage ? 'exercise' : 'stage');
  const [stage, setStage] = useState(existing?.stage || 1);
  const [ex, setEx] = useState(existing && !existing.stage ? exKeyOf(existing) : '');
  const [hints, setHints] = useState(existing ? existing.showHints !== false : true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    let c;
    if (mode === 'stage') { const s = stageContent(stage); c = { stage, lessonId: s.lessonId, exerciseTitle: s.title }; }
    else { const it = findExercise(ex); if (!it) { setErr('เลือกแบบฝึก'); return; } c = { stage: 0, lessonId: it.lessonId, exerciseTitle: it.exerciseTitle }; }
    if (existing && existing.done > 0 && testKey(existing) !== testKey(c) &&
      !confirm(`มีนักเรียน ${existing.done} คนทำ "${existing.exerciseTitle}" ไปแล้ว\nถ้าเปลี่ยนเป็น "${c.exerciseTitle}" กระดานอันดับสัปดาห์นี้จะเริ่มนับใหม่ (ผลเดิมยังอยู่ในแท็บ Submissions)\n\nเปลี่ยนแบบฝึก?`)) return;
    setBusy(true); setErr('');
    try { await onSave({ grade: grade.grade, weekStart: week, ...c, showHints: hints ? '1' : '0' }); }
    catch (e) { setErr('บันทึกไม่ได้: ' + e.message); setBusy(false); }
  }

  return (
    <Modal wide title={`🏆 ${existing ? 'แก้' : 'ตั้ง'}แบบทดสอบ · ${grade.grade} ทั้งระดับชั้น`} onClose={onClose}>
      <div className="field"><b>สัปดาห์</b><div><b>{weekLabel(week)}</b> <span className="hint">(กดเลือกสัปดาห์ทางซ้ายเพื่อเปลี่ยน)</span></div></div>
      <div className="field"><b>เนื้อหา</b>
        <div className="row6"><span className="seg">
          <button className={mode === 'stage' ? 'on' : ''} onClick={() => setMode('stage')}>ทั้งด่าน (ระบบสร้างข้อความ)</button>
          <button className={mode === 'exercise' ? 'on' : ''} onClick={() => setMode('exercise')}>เลือกแบบฝึกเอง</button></span></div>
        {mode === 'stage' ? <>
          <StagePick value={stage} onChange={setStage} max={7} cols={4}/>
          <div className="hint">ข้อความ 2 นาที: คำจากด่านนี้ ~70% + ทบทวนด่านก่อนหน้า ~30% · ทุกห้องใน {grade.grade} ได้ข้อความเดียวกัน</div>
        </> : <ExercisePick value={ex} onChange={setEx}/>}
      </div>
      <label className="row6" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={hints} onChange={e => setHints(e.target.checked)} style={{ width: 16, height: 16 }}/>
        แสดงไฮไลต์ปุ่มถัดไปบนคีย์บอร์ด <span className="hint">(ปิด = นักเรียนต้องจำตำแหน่งเอง)</span></label>
      {err && <div className="err">{err}</div>}
      <div className="row6"><span className="spacer"/><button className="btn ghost" onClick={onClose}>ปิด</button>
        <button className="btn" disabled={busy} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
    </Modal>
  );
}

export function WeeklyTab({ code, data, error, api, onReload }) {
  const grade = gradeOf(code, data?.grades);
  const cw = data?.currentWeek || toYmd(new Date());
  const tests = useMemo(() => (data?.tests || []).filter(t => grade && t.grade === grade.grade), [data, grade?.grade]);
  const [older, setOlder] = useState(false);
  const [week, setWeek] = useState(null);
  const [dlg, setDlg] = useState(null);                // { existing } | {}
  const [res, setRes] = useState({});
  const wk = week || cw;
  useEffect(() => { setRes({}); }, [data]);

  const weeks = useMemo(() => {
    const near = [-7, 0, 7, 14, 21].map(n => addDays(cw, n));
    const old = older ? [...new Set(tests.map(t => t.weekStart))].filter(w => w < near[0]).sort() : [];
    return [...old, ...near];                          // oldest first, like a calendar
  }, [cw, tests, older]);
  const test = tests.find(t => t.weekStart === wk) || null;

  useEffect(() => {
    if (!test || res[test.testId]) return;
    setRes(r => ({ ...r, [test.testId]: { loading: true } }));
    api.weeklyResults(test.testId).then(d => setRes(r => ({ ...r, [test.testId]: d })))
      .catch(e => setRes(r => ({ ...r, [test.testId]: { error: e.message } })));
  }, [test?.testId, res]);

  async function save(values) { await api.setWeeklyTest(values); setDlg(null); onReload(); }
  async function del(t) {
    const msg = t.done > 0
      ? `ลบแบบทดสอบ ${t.grade} สัปดาห์ ${weekLabel(t.weekStart)}?\nมีนักเรียนทำแล้ว ${t.done} คน — กระดานอันดับของสัปดาห์นี้จะหายไป (ผลยังอยู่ในแท็บ Submissions)`
      : `ลบแบบทดสอบ ${t.grade} สัปดาห์ ${weekLabel(t.weekStart)}?`;
    if (!confirm(msg)) return;
    try { await api.deleteWeeklyTest(t.testId); onReload(); } catch (e) { alert('ลบไม่ได้: ' + e.message); }
  }

  if (error) return <div className="alert err"><span className="grow">โหลดแบบทดสอบไม่ได้: {error}</span><button className="btn sm" onClick={onReload}>ลองใหม่</button></div>;
  if (!data) return <div className="card empty">กำลังโหลด…</div>;
  if (!grade) return <div className="card empty">ห้อง {roomLabel(code)} ไม่อยู่ในระดับชั้นที่มีแบบทดสอบประจำสัปดาห์ (ใช้รหัสห้องแบบ Y603)</div>;

  const r = test && res[test.testId];
  const ranking = r?.ranking || [], notDone = r?.notDone || [];
  const mine = ranking.filter(x => sameRoom(x.room, code)).length;
  const mineLeft = (notDone.find(g => sameRoom(g.room, code))?.names || []).length;
  const tag = w => w === cw ? '● สัปดาห์นี้' : w === addDays(cw, -7) ? '✓ สัปดาห์ที่แล้ว' : w === addDays(cw, 7) ? 'สัปดาห์หน้า' : w > cw ? 'ล่วงหน้า' : '';

  return (
    <div className="split">
      <div className="card weeks">
        <b>สัปดาห์ · {grade.grade} <span className="hint">({grade.students} คน)</span></b>
        <div className="scroll">{weeks.map(w => { const t = tests.find(x => x.weekStart === w); return (
          <div key={w} className={'week' + (w === wk ? ' on' : '') + (t ? '' : ' empty')} onClick={() => setWeek(w)} role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setWeek(w)}>
            {tag(w) && <span className="tag">{tag(w)}</span>}
            <b>{weekLabel(w)}</b>
            <span className="hint">{t ? `${t.exerciseTitle}${t.showHints === false ? ' (ไม่มีไฮไลต์ปุ่ม)' : ''}${w <= cw ? ` · ทำแล้ว ${t.done}/${t.total}` : ''}` : '+ ยังไม่ได้ตั้ง'}</span>
          </div>); })}</div>
        {!older && tests.some(t => t.weekStart < addDays(cw, -7)) && <button className="btn ghost sm" onClick={() => setOlder(true)}>ดูสัปดาห์ก่อนหน้า…</button>}
      </div>
      <div className="card detail">
        {!test ? <div className="empty">
          <p><b>{weekLabel(wk)}</b> — {grade.grade} ยังไม่มีแบบทดสอบ</p>
          <p className="hint" style={{ margin: '6px 0 12px' }}>1 ระดับชั้นมี 1 แบบทดสอบต่อสัปดาห์ (จันทร์–อาทิตย์) · จับเวลา 2 นาที · ทุกห้องได้ข้อความเดียวกัน · นักเรียนทำซ้ำได้ ระบบนับครั้งที่ดีที่สุด</p>
          {wk >= addDays(cw, -14) && <button className="btn" onClick={() => setDlg({})}>＋ ตั้งแบบทดสอบสัปดาห์นี้</button>}
        </div> : <>
          <h3>🏆 {weekLabel(wk)} · {grade.grade} · {test.exerciseTitle}<span className="spacer"/>
            <button className="btn ghost sm" onClick={() => setDlg({ existing: test })}>แก้</button>
            <button className="btn ghost sm" onClick={() => del(test)}>ลบ</button></h3>
          <div className="row6"><span className="hint">{test.stage ? 'ระบบสร้างข้อความจากด่าน' : 'แบบฝึกที่เลือก'} · จับเวลา 2 นาที · {test.showHints === false ? '🙈 ไม่มีไฮไลต์ปุ่ม' : 'มีไฮไลต์ปุ่ม'}</span>
            <span className="spacer"/>
            <Bar value={test.done} total={test.total}>ทำแล้ว {test.done}/{test.total} คน{r?.ranking ? ` · ห้องนี้ ${mine}/${mine + mineLeft}` : ''}</Bar></div>
          {r?.loading && <div className="empty">กำลังโหลดอันดับ…</div>}
          {r?.error && <div className="err">โหลดไม่ได้: {r.error}</div>}
          {r?.ranking && <div className="two">
            <div className="card" style={{ flex: 1, padding: '6px 8px' }}>
              {ranking.length ? <div className="tscroll"><table className="grid static">
                <thead><tr><th className="r">อันดับ</th><th>ชื่อ</th><th>ห้อง</th><th className="r">คะแนนดีสุด</th><th>ดาว</th><th className="r">WPM</th><th className="r">แม่น</th><th className="r">ครั้ง</th></tr></thead>
                <tbody>{ranking.map(x => <tr key={x.rank + x.name} className={sameRoom(x.room, code) ? 'sel' : ''}>
                  <td className="r"><b>{x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : <span className="num">{x.rank}</span>}</b></td>
                  <td>{x.name}</td><td>{roomLabel(x.room)}</td>
                  <td className="r"><span className="num">{Number(x.score || 0).toLocaleString('en-US')}</span></td>
                  <td>{'⭐'.repeat(starsOf(x.score, x.max)) || '–'}</td>
                  <td className="r"><span className="num">{Math.round((Number(x.kpm) || 0) / 4)}</span></td>
                  <td className="r"><span className="num">{x.accuracy}%</span></td>
                  <td className="r">{x.attempts}</td>
                </tr>)}</tbody></table></div> : <div className="empty">ยังไม่มีใครทำแบบทดสอบนี้</div>}
            </div>
            <div className="card notdone">
              {notDone.length ? <>
                <b>⏳ ยังไม่ทำ {notDone.reduce((s, g) => s + g.names.length, 0)} คน</b>
                <div className="hint" style={{ margin: '2px 0 8px' }}>ห้องนี้เน้นสีเหลือง</div>
                {notDone.slice().sort((a, b) => sameRoom(b.room, code) - sameRoom(a.room, code)).map(g =>
                  <div key={g.room} className={'room' + (sameRoom(g.room, code) ? ' me' : '')}><b>{roomLabel(g.room)}</b> ({g.names.length}) · {g.names.join(', ')}</div>)}
              </> : <b style={{ color: '#1F6B3D' }}>✅ ทุกคนในระดับชั้นทำแล้ว</b>}
            </div>
          </div>}
        </>}
      </div>
      {dlg && <WeeklyDialog grade={grade} week={wk} existing={dlg.existing} onSave={save} onClose={() => setDlg(null)}/>}
    </div>
  );
}
