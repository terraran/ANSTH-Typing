// Classroom code sign-in (public edition): the student types the 8-character code from the card
// their teacher printed, or arrives from the card's QR (?code=…) and only confirms it is their card.
import { backend } from '../edition';
import { INK, PX_FONT, PxButton } from '../ui/pixel';

const { useEffect, useRef, useState } = React;
const LEN = 8;

// 8 boxes over one invisible input. Keys are read by position (KeyA…, Digit…), so the code types
// correctly even while the Thai keyboard layout is on; anything that can't be in a code is dropped.
export function CodeBox({ value, onChange, onEnter, error }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  const put = v => onChange(backend.normalizeCode(v));
  const onKeyDown = e => {
    if (e.key === 'Enter') { e.preventDefault(); onEnter(); return; }
    if (e.key === 'Backspace') { e.preventDefault(); onChange(value.slice(0, -1)); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;              // let paste through
    const m = /^(?:Key([A-Z])|Digit(\d)|Numpad(\d))$/.exec(e.code || '');
    if (m) { e.preventDefault(); put(value + (m[1] || m[2] || m[3])); }
  };
  const chars = [...value.padEnd(LEN, ' ')];
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => ref.current?.focus()}>
      {chars.map((c, i) => <React.Fragment key={i}>
        {i === 4 && <i style={{ width: 10, height: 4, background: INK }}/>}
        <span className={i === value.length ? 'px-blink' : ''} style={{ width: 'clamp(30px, 5.4vh, 40px)', height: 'clamp(38px, 6.8vh, 50px)',
          border: '3px solid ' + (error ? '#C62828' : INK), background: error ? '#FDE3E0' : i === value.length ? '#FFE9A0' : '#FFF9E6',
          display: 'grid', placeItems: 'center', fontFamily: PX_FONT, fontSize: 'clamp(14px, 2.6vh, 19px)', color: INK }}>{c.trim()}</span>
      </React.Fragment>)}
      <input ref={ref} value={value} onChange={e => put(e.target.value)} onKeyDown={onKeyDown} maxLength={LEN + 1}
        aria-label="รหัส 8 ตัวจากการ์ด" autoComplete="off" autoCapitalize="characters" spellCheck={false} inputMode="text"
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'text', fontSize: 16 }}/>
    </div>
  );
}

// "Is this your card?" — number + room, so nobody plays on a friend's card by accident.
export function CardConfirm({ who, onYes, onNo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#F8EED2', border: '3px solid ' + INK, padding: '10px 14px', width: '100%', textAlign: 'left' }}>
        <span style={{ fontFamily: PX_FONT, fontSize: 22, background: INK, color: '#fff', padding: '10px 12px' }}>{who.no}</span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>เลขที่ {who.no}</div>
          {who.className && <div style={{ fontSize: 14, color: '#6A4A30' }}>ห้อง {who.className}</div>}
          <div style={{ fontFamily: PX_FONT, fontSize: 11, color: '#6A4A30', marginTop: 4 }}>{who.code.slice(0, 4)}-{who.code.slice(4)}</div>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#5A3A22' }}>ถ้าไม่ใช่เลขที่ของคุณ อย่ากดเข้าเล่น — ใช้การ์ดของตัวเองนะ</div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <PxButton style={{ flex: 1 }} onClick={onYes}>✓ ใช่ เข้าเล่นเลย</PxButton>
        <PxButton color="red" style={{ flex: 1 }} onClick={onNo}>✗ ไม่ใช่</PxButton>
      </div>
    </div>
  );
}

// Look a code up → { ...lookupCode result, code } or an error message.
export async function checkCode(code) {
  try { return { who: { ...(await backend.lookupCode(code)), code: backend.normalizeCode(code) } }; }
  catch (e) { return { error: backend.describeError(e) }; }
}

// The card's QR opens the game as …/?code=XXXXXXXX. Read it once and take it out of the address bar
// (so a reload, a bookmark or a screenshot doesn't carry the code).
export function codeFromUrl() {
  try {
    const u = new URL(location.href), c = u.searchParams.get('code');
    if (!c) return '';
    u.searchParams.delete('code');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    return backend.normalizeCode ? backend.normalizeCode(c) : '';
  } catch { return ''; }
}
