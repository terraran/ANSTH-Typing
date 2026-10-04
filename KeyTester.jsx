// ?keys=1 — keyboard tester: shows what the browser reports for every key press
// and which keys the app can read. Used to check machines where a key "doesn't work".
import { KEYMAP, resolveKey } from '../engine/keymap';

const { useEffect, useState } = React;

export const KEYS_ON = (() => {
  try { return new URLSearchParams(location.search).get('keys') === '1'; } catch { return false; }
})();

const ROWS = [
  ['Backquote','Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9','Digit0','Minus','Equal'],
  ['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight','Backslash'],
  ['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote'],
  ['KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash'],
];
const VIA = { code:['ปกติ','#059669'], th:['สำรอง (ไทย)','#D97706'], us:['สำรอง (อังกฤษ)','#D97706'] };

export function KeyTester() {
  const [log, setLog] = useState([]);
  const [seen, setSeen] = useState({});   // code → 'code' | 'fallback'
  useEffect(() => {
    const h = e => {
      if (['Tab','F5','F12'].includes(e.key)) return;
      e.preventDefault();
      const r = resolveKey(e);
      setLog(l => [{ key:e.key, code:e.code||'(ว่าง)', shift:e.shiftKey, r, id:Date.now()+Math.random() }, ...l].slice(0,12));
      if (r?.char) setSeen(s => ({ ...s, [r.code]: s[r.code]==='code' ? 'code' : (r.via==='code' ? 'code' : 'fallback') }));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  const cell = { padding:'4px 8px', borderBottom:'1px solid #E2E8F0', fontSize:13, textAlign:'left' };
  return (
    <div style={{ fontFamily:tf, maxWidth:860, margin:'0 auto', padding:16, color:'#0F172A' }}>
      <h2 style={{ margin:'0 0 4px' }}>⌨️ ทดสอบคีย์บอร์ด</h2>
      <div style={{ fontSize:13, color:'#64748B', marginBottom:12 }}>
        กดทุกปุ่ม (ทั้งแบบปกติและกด Shift) ปุ่มที่แอปอ่านได้จะเป็นสีเขียว · สีส้ม = อ่านได้ด้วยวิธีสำรอง (เครื่องนี้ส่งรหัสปุ่มไม่ครบ แต่พิมพ์ในแอปได้) · สีเทา = ยังไม่ได้กด
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:16 }}>
        {ROWS.map((row,i) => (
          <div key={i} style={{ display:'flex', gap:4, paddingLeft:i*18 }}>
            {row.map(code => {
              const st = seen[code], [u,s] = KEYMAP[code];
              return (
                <div key={code} title={code} style={{ width:52, height:46, borderRadius:7, display:'flex', flexDirection:'column',
                  alignItems:'center', justifyContent:'center', fontSize:16, lineHeight:1.1,
                  background: st==='code' ? '#D1FAE5' : st ? '#FEF3C7' : '#F1F5F9',
                  border:`1.5px solid ${st==='code' ? '#059669' : st ? '#D97706' : '#CBD5E1'}` }}>
                  <span style={{ fontSize:11, color:'#64748B' }}>{s}</span><span>{u}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:20 }}>
        <thead><tr>{['e.key','e.code','Shift','แอปอ่านเป็น','ปุ่ม','วิธีอ่าน'].map(h => <th key={h} style={cell}>{h}</th>)}</tr></thead>
        <tbody>
          {log.map(x => (
            <tr key={x.id}>
              <td style={cell}>{x.key}</td><td style={cell}>{x.code}</td><td style={cell}>{x.shift ? '✓' : ''}</td>
              <td style={{ ...cell, fontSize:18 }}>{x.r?.char ?? '—'}</td><td style={cell}>{x.r?.code ?? '—'}</td>
              <td style={{ ...cell, color: x.r ? VIA[x.r.via][1] : '#DC2626', fontWeight:700 }}>{x.r ? VIA[x.r.via][0] : 'อ่านไม่ได้'}</td>
            </tr>
          ))}
          {!log.length && <tr><td style={cell} colSpan={6}>กดปุ่มใดก็ได้เพื่อเริ่ม</td></tr>}
        </tbody>
      </table>
      <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'12px 16px', fontSize:14 }}>
        <b>ปุ่ม ` ( _ % ) สลับภาษาแทนที่จะพิมพ์?</b> (ไม่บังคับ) เปลี่ยนปุ่มสลับภาษาของ Windows เป็น Alt+Shift:
        <ol style={{ margin:'6px 0 0', paddingLeft:20, lineHeight:1.7 }}>
          <li>เปิด Settings → Time &amp; language → Typing → Advanced keyboard settings</li>
          <li>กด Input language hot keys</li>
          <li>เลือก "Between input languages" → Change Key Sequence…</li>
          <li>Switch Input Language เลือก Left Alt+Shift → OK → Apply</li>
        </ol>
      </div>
    </div>
  );
}
