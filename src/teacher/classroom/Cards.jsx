// Printable code cards: A4, 10 per page (2 × 5), cut along the dashed lines.
// Each card: room, เลขที่ (+ name if this computer has the list), the code, a QR that opens the
// game with the code filled in, and three short steps.
const { useEffect, useMemo, useRef, useState } = React;
import { fmtCode } from './localRoster';

const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
let qrReady = null;
function loadQr() {
  if (!qrReady) qrReady = new Promise((ok, fail) => {
    if (window.qrcode) return ok();
    const s = document.createElement('script'); s.src = QR_LIB; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
  return qrReady;
}

// QR as crisp SVG squares.
function Qr({ text }) {
  if (!window.qrcode) return <div className="qr-wait"/>;
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) cells.push(`M${c} ${r}h1v1h-1z`);
  return <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} shapeRendering="crispEdges" aria-label={'QR ' + text}>
    <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff"/><path d={cells.join('')} fill="#000"/></svg>;
}

// The game's address, next to this page: …/keyboard-quest-TH/?code=XXXXXXXX
export const gameUrl = code => location.origin + location.pathname.replace(/[^/]*$/, '') + (code ? '?code=' + code : '');

export function CardsView({ className, students, names, ticked, onClose }) {
  const [scope, setScope] = useState(ticked.length ? 'ticked' : 'all');
  const [showNames, setShowNames] = useState(true);
  const [, setQrLoaded] = useState(!!window.qrcode);
  const holder = useRef(null), [k, setK] = useState(0.5);
  useEffect(() => { loadQr().then(() => setQrLoaded(true)).catch(() => {}); }, []);
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  const list = (scope === 'ticked' ? students.filter(s => ticked.includes(s.no)) : students).filter(s => s.code);
  const pages = useMemo(() => { const p = []; for (let i = 0; i < list.length; i += 10) p.push(list.slice(i, i + 10)); return p; }, [list]);
  const host = gameUrl('').replace(/^https?:\/\//, '').replace(/\/$/, '');
  useEffect(() => {                                   // preview: A4 pages scaled to fit beside the controls
    const fit = () => { const h = holder.current; if (h) setK(Math.min(1, (h.clientWidth - 24) / 794, (h.clientHeight - 16) / 1123)); };
    fit(); addEventListener('resize', fit); return () => removeEventListener('resize', fit);
  }, []);
  const anyNames = list.some(s => names?.[s.no]);

  return (
    <div className="cards-view">
      <div className="cards-side card">
        <b>🖨️ พิมพ์การ์ดรหัส</b>
        <div><b>{className}</b><br/><span className="hint">{list.length} ใบ · {pages.length} แผ่น A4 · แผ่นละ 10 ใบ</span></div>
        <label className="row6"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')}/> ทั้งห้อง ({students.length})</label>
        <label className="row6" style={ticked.length ? null : { opacity: .5 }}><input type="radio" disabled={!ticked.length} checked={scope === 'ticked'} onChange={() => setScope('ticked')}/> เฉพาะที่ติ๊กไว้ ({ticked.length})</label>
        <label className="row6" style={anyNames ? null : { opacity: .5 }}><input type="checkbox" disabled={!anyNames} checked={showNames && anyNames} onChange={e => setShowNames(e.target.checked)}/> แสดงชื่อบนการ์ด</label>
        {!anyNames && <div className="hint">เครื่องนี้ไม่มีรายชื่อ — การ์ดจะมีแค่เลขที่</div>}
        <button className="btn" onClick={() => window.print()} disabled={!list.length}>🖨️ พิมพ์</button>
        <button className="btn ghost" onClick={onClose}>← กลับห้องเรียน</button>
        <div className="hint">✂️ ตัดตามเส้นประ แจกคนละใบ · QR = เปิดเกมพร้อมกรอกรหัสให้แล้ว · ตั้งค่าเครื่องพิมพ์: A4, ขนาดจริง (100%), ไม่มีหัว/ท้ายกระดาษ</div>
      </div>
      <div className="cards-preview" ref={holder}>
        <div className="sheets" style={{ '--k': k }}>
          {pages.map((p, i) => <div key={i} className="sheet">{p.map(s => (
            <div key={s.no} className="kcard"><span className="scissor">✂</span>
              <div className="ct"><img src="assets/ui/logo.png" alt=""/>คีย์บอร์ดเควส<span className="rm">{className}</span></div>
              <div className="who2"><span className="no">{s.no}</span>{showNames && names?.[s.no] ? names[s.no] : 'เลขที่ ' + s.no}</div>
              <div className="code"><small>รหัสของฉัน</small>{fmtCode(s.code)}</div>
              <ol><li>สแกน QR หรือเปิด <b>{host}</b></li><li>กด <b>"เข้าด้วยรหัสห้องเรียน"</b></li><li>พิมพ์รหัสด้านบน แล้วเริ่มผจญภัย!</li></ol>
              <div className="qr"><Qr text={gameUrl(s.code)}/>เก็บไว้ อย่าให้เพื่อนดู</div>
            </div>))}</div>)}
        </div>
      </div>
    </div>
  );
}
