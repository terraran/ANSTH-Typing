// New code classroom in 3 steps: room name → how many students (or names pasted from Excel,
// kept on this computer only) → everyone's code, with backup file and printable cards.
const { useState } = React;
import { downloadBackup, fmtCode, parseNames, saveRoster } from './localRoster';

const STEPS = ['ตั้งชื่อห้อง', 'นักเรียน', 'รับรหัส'];

export function CreateRoom({ api, owner, onCancel, onDone, onPrint, first }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('list');
  const [count, setCount] = useState(30);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [made, setMade] = useState(null);           // { id, codes: [{ no, code }], names }
  const names = parseNames(text);
  const n = mode === 'list' ? names.length : Math.max(0, Math.min(100, Number(count) || 0));

  async function create() {
    if (!n) { setErr(mode === 'list' ? 'วางรายชื่ออย่างน้อย 1 คน' : 'ใส่จำนวนนักเรียน'); return; }
    setBusy(true); setErr('');
    try {
      const r = await api.createClass(name.trim(), n);
      const map = mode === 'list' ? Object.fromEntries(names.map((x, i) => [i + 1, x])) : {};
      saveRoster(owner, r.id, { names: map, mode, backedUp: false });
      setMade({ ...r, names: map }); setStep(3);
    } catch (e) { setErr('สร้างห้องไม่ได้: ' + api.describeError(e)); }
    setBusy(false);
  }
  function backup() {
    downloadBackup(made.id, name.trim(), made.codes, made.names);
    saveRoster(owner, made.id, { names: made.names, mode, backedUp: true });
    setMade(m => ({ ...m, backedUp: true }));
  }

  return (
    <section className="page wiz">
      <div className="steps">{STEPS.map((t, i) => <React.Fragment key={t}>
        {i > 0 && <i/>}
        <div className={'step' + (step === i + 1 ? ' on' : step > i + 1 ? ' done' : '')}><b>{step > i + 1 ? '✓' : i + 1}</b>{t}</div>
      </React.Fragment>)}</div>
      <div className="wbox">
        <div className="head">{step === 1 ? 'สร้างห้องเรียนใหม่' : step === 2 ? `${name} — มีนักเรียนกี่คน?` : `สร้างรหัสแล้ว ${made.codes.length} คน 🎉`}</div>
        <div className="card wbody">
          {step === 1 && <>
            <div className="wcenter">
              {first && <p className="hint">ยังไม่มีห้องเรียน — สร้างห้องแรกได้เลย นักเรียนจะได้รหัสคนละ 1 ใบ กรอกรหัสแล้วเข้าเล่นได้ทันที ไม่ต้องมีอีเมล</p>}
              <label className="field"><b>ชื่อห้อง</b>
                <input className="big" value={name} maxLength={60} autoFocus placeholder="เช่น ม.1/3 · คอมพิวเตอร์"
                  onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(2)}/>
                <span className="hint">นักเรียนจะเห็นชื่อนี้ตอนเข้าเล่น — ใช้ชื่อชั้น/วิชา ไม่ต้องใส่ชื่อโรงเรียนก็ได้</span></label>
            </div>
            <div className="wfoot">{onCancel && <button className="btn ghost" onClick={onCancel}>ยกเลิก</button>}
              <button className="btn" disabled={!name.trim()} onClick={() => setStep(2)}>ถัดไป →</button></div>
          </>}
          {step === 2 && <>
            <div className="two-opt">
              <div className={'opt well' + (mode === 'count' ? ' on' : '')} onClick={() => setMode('count')}>
                <h4><span className="radio"/>ใส่แค่จำนวน</h4>
                <div className="row6"><input className="bignum" type="number" min="1" max="100" value={count}
                  onChange={e => setCount(e.target.value)} onFocus={() => setMode('count')} aria-label="จำนวนนักเรียน"/> คน</div>
                <div className="hint">การ์ดจะมีแค่เลขที่ ไม่มีชื่อ<br/>ครูจดเลขที่ให้ตรงกับสมุดรายชื่อเอง</div>
              </div>
              <div className={'opt well' + (mode === 'list' ? ' on' : '')} onClick={() => setMode('list')}>
                <h4><span className="radio"/>วางรายชื่อจาก Excel {names.length > 0 && <span className="chip ok" style={{ marginLeft: 'auto' }}>{names.length} คน</span>}</h4>
                <div className="paste">
                  <textarea value={text} onChange={e => setText(e.target.value)} onFocus={() => setMode('list')}
                    placeholder={'ด.ช. กฤษดา ใจดี\nด.ญ. ณัฐธิดา ศรีสุข\n…'} aria-label="รายชื่อนักเรียน"/>
                  <div className="preview well"><b>ตัวอย่าง</b>{names.map((x, i) => <div key={i}><span className="num">{i + 1}</span><span>{x}</span></div>)}</div>
                </div>
                <div className="hint">คัดลอกคอลัมน์ชื่อจาก Excel แล้ววาง — 1 บรรทัด = 1 คน ตามลำดับเลขที่</div>
              </div>
            </div>
            <div className="alert"><span>🔒</span><span className="grow"><b>รายชื่อเก็บในเครื่องนี้เท่านั้น ไม่ส่งขึ้นเซิร์ฟเวอร์</b> — ระบบเก็บแค่รหัส เลขที่ และผลการเล่น ชื่อจะเห็นได้เฉพาะในเครื่องครูและในไฟล์สำรองที่ครูดาวน์โหลด</span></div>
            {err && <div className="err">{err}</div>}
            <div className="wfoot"><button className="btn ghost" onClick={() => setStep(1)}>← ย้อนกลับ</button>
              <button className="btn" disabled={busy || !n} onClick={create}>{busy ? 'กำลังสร้างรหัส…' : `สร้างรหัส ${n || ''} คน →`}</button></div>
          </>}
          {step === 3 && <>
            <div className="hint">นักเรียนแต่ละคนได้รหัสของตัวเอง {made.codes[0]?.code.length} ตัว (ไม่มีตัว S B Z O I U และเลข 0 1 5 ที่อ่านสับสน) — กรอกรหัสอย่างเดียวก็เข้าเล่นได้</div>
            <div className="codes">{made.codes.map(c => <div key={c.no} className="c well">
              <span className="num no">{c.no}</span><span className="nm">{made.names[c.no] || 'เลขที่ ' + c.no}</span><span className="cd">{fmtCode(c.code)}</span></div>)}</div>
            {!made.backedUp && <div className="alert"><span>💾</span><span className="grow"><b>ดาวน์โหลดไฟล์สำรองเก็บไว้ก่อน</b> — ใช้เปิดชื่อนักเรียนในเครื่องอื่น หรือถ้าเบราว์เซอร์ถูกล้าง (ไฟล์ .csv เปิดด้วย Excel ได้)</span></div>}
            <div className="wfoot">
              <button className="btn gold" onClick={backup}>💾 {made.backedUp ? 'ดาวน์โหลดอีกครั้ง' : 'ดาวน์โหลดไฟล์สำรอง'}</button>
              <button className="btn blue" onClick={() => onPrint(made.id)}>🖨️ พิมพ์การ์ด</button>
              <span className="spacer"/>
              <button className="btn" onClick={() => onDone(made.id)}>ไปที่ห้องเรียน →</button>
            </div>
          </>}
        </div>
      </div>
    </section>
  );
}
