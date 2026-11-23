// Student ID sign-in (school edition) — for young students who can't type their Google password yet.
// Type the student ID (on-screen keypad or the keyboard) → "is this you?" → play as that student.
// Works only while the teacher has opened the room in the teacher page (Apps Script IdLogin.gs);
// everything is saved to the student's own account, so it carries on after a Google sign-in later.
import { backend } from '../edition';
import { INK, PX_FONT, PxButton, PxPanel, TH_FONT } from '../ui/pixel';

const { useEffect, useRef, useState } = React;

const MAX = 10;

function Digits({ value, bad }) {
  const n = Math.min(MAX, Math.max(5, value.length + (bad ? 0 : 1)));
  return (
    <div style={{ display: 'flex', gap: 8 }} aria-label={'เลขที่พิมพ์ ' + (value || 'ยังไม่มี')}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={!bad && i === value.length ? 'px-blink' : ''}
          style={{ width: 'clamp(40px, 7vh, 54px)', height: 'clamp(50px, 8.6vh, 66px)', border: '3px solid ' + (bad ? '#C62828' : INK),
            background: bad ? '#FDE3E0' : i === value.length ? '#FFE9A0' : '#FFF9E6', display: 'grid', placeItems: 'center',
            fontFamily: PX_FONT, fontSize: 'clamp(18px, 3.2vh, 24px)', boxShadow: 'inset 0 3px 0 rgba(59,36,22,.12)' }}>
          {value[i] || ''}
        </span>
      ))}
    </div>
  );
}

const keyStyle = { border: '3px solid ' + INK, background: '#FFFFFF', height: 'clamp(38px, 6vh, 54px)', fontFamily: PX_FONT, fontSize: 18,
  display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 0 ' + INK, color: INK, padding: 0 };

export function IdLoginPanel({ onDone, onBack }) {
  const [id, setId] = useState('');
  const [stage, setStage] = useState('entry');   // entry | checking | confirm
  const [err, setErr] = useState('');
  const [who, setWho] = useState(null);
  const ref = useRef({});
  ref.current = { id, stage };

  // ref.current.id is updated straight away too, so Enter right after fast typing sees every digit
  const put = v => { ref.current.id = v; setId(v); setErr(''); };
  const type = d => { if (ref.current.stage === 'entry') put((ref.current.id + d).slice(0, MAX)); };
  const del = () => { if (ref.current.stage === 'entry') put(ref.current.id.slice(0, -1)); };
  async function go() {
    const v = ref.current.id;
    if (ref.current.stage !== 'entry' || v.length < 3) return;
    setStage('checking'); setErr('');
    try { setWho(await backend.idLogin(v)); setStage('confirm'); }
    catch (e) { setErr(backend.describeError(e)); setStage('entry'); }
  }

  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      // Number row / keypad by physical key, so the Thai layout doesn't matter
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '');
      if (m) { e.preventDefault(); type(m[1]); return; }
      if (e.key === 'Backspace') { e.preventDefault(); del(); return; }
      if (e.key === 'Enter' && ref.current.stage === 'entry') { e.preventDefault(); go(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (stage === 'confirm' && who) return (
    <PxPanel title="ใช่หนูไหม?" style={{ width: '100%', maxWidth: 520 }}
      bodyStyle={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#F8EED2', border: '3px solid ' + INK, padding: '12px 16px', width: '100%', textAlign: 'left' }}>
        <span style={{ fontFamily: PX_FONT, fontSize: 16, background: INK, color: '#fff', padding: 12 }}>{id}</span>
        <div><div style={{ fontSize: 26, fontWeight: 700 }}>{who.displayName}</div></div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#5A3A22' }}>ถ้าไม่ใช่หนู กด "ไม่ใช่" แล้วเรียกครูนะ</div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <PxButton style={{ flex: 1 }} onClick={() => onDone(who)}>✓ ใช่ ไปเล่นเลย</PxButton>
        <PxButton color="red" style={{ flex: 1 }} onClick={() => { setWho(null); setId(''); setStage('entry'); }}>✗ ไม่ใช่</PxButton>
      </div>
    </PxPanel>
  );

  const busy = stage === 'checking';
  return (
    <PxPanel title="เลขประจำตัวของหนู" style={{ width: '100%', maxWidth: 520 }}
      bodyStyle={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(8px, 1.6vh, 14px)', textAlign: 'center' }}>
      <Digits value={id} bad={!!err}/>
      {err ? <div role="alert" style={{ color: '#C62828', fontWeight: 700, fontSize: 16, maxWidth: 440 }}>{err}</div>
        : <div style={{ fontSize: 18, fontWeight: 700, color: '#5A3A22' }}>{busy ? 'กำลังหา…' : 'พิมพ์เลขประจำตัวนักเรียน'}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: 'min(100%, 330px)', opacity: busy ? .6 : 1 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} style={keyStyle} disabled={busy} onClick={() => type(String(n))}>{n}</button>)}
        <button style={{ ...keyStyle, background: '#FDE3E0', fontFamily: TH_FONT, fontWeight: 700, fontSize: 16 }} disabled={busy} onClick={del}>⌫ ลบ</button>
        <button style={keyStyle} disabled={busy} onClick={() => type('0')}>0</button>
        <button style={{ ...keyStyle, background: '#CFEBC0', fontFamily: TH_FONT, fontWeight: 700, fontSize: 16 }} disabled={busy || id.length < 3} onClick={go}>เข้า ▶</button>
      </div>
      <div style={{ display: 'flex', width: 'min(100%, 330px)' }}>
        <PxButton style={{ flex: 1, fontSize: 15, minHeight: 46 }} onClick={onBack}>← กลับ</PxButton>
      </div>
    </PxPanel>
  );
}
