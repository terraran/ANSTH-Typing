// Speaker button + sound panel: music volume, effects volume, "correct key" sound, mute all.
// The panel opens in a portal at the top right (like the "?" help) so no page layer can cover it.
import { getSoundSettings, setSoundSetting, sfx, toggleMuteAll, useSoundSettings } from './sound';
import { INK, PX_FONT, TH_FONT } from './pixel';

const { useEffect, useRef, useState } = React;

const TYPE_LABELS = [['tick', 'ติ๊ก'], ['pop', 'ป๊อป'], ['click', 'คลิกแป้น'], ['off', 'ปิด']];

function SpeakerIcon({ muted }) {
  return (
    <svg viewBox="0 0 16 16" width="24" height="24" shapeRendering="crispEdges" aria-hidden="true" style={{ display: 'block' }}>
      <path fill={INK} d="M2 6h3l4-3v10l-4-3H2z"/>
      {muted
        ? <g fill="#D9452F"><rect x="11" y="5" width="1" height="1"/><rect x="12" y="6" width="1" height="1"/><rect x="13" y="7" width="1" height="2"/><rect x="14" y="9" width="1" height="1"/><rect x="15" y="10" width="1" height="1"/>
            <rect x="15" y="5" width="1" height="1"/><rect x="14" y="6" width="1" height="1"/><rect x="12" y="9" width="1" height="1"/><rect x="11" y="10" width="1" height="1"/></g>
        : <g fill={INK}><rect x="11" y="6" width="1" height="4"/><rect x="13" y="4" width="1" height="8"/><rect x="12" y="5" width="1" height="1"/><rect x="12" y="10" width="1" height="1"/></g>}
    </svg>
  );
}

export function SoundButton({ style }) {
  const s = useSoundSettings();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const muted = s.music === 0 && s.sfx === 0;
  return (
    <>
      <button ref={btnRef} className="px-btn c-gold" data-tour="sound" aria-label="ตั้งค่าเสียง" title="เสียงและเพลง"
        aria-expanded={open} onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.currentTarget.blur(); setOpen(o => !o); }}
        style={{ minHeight: 'var(--hb)', minWidth: 44, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', ...style }}>
        <SpeakerIcon muted={muted}/>
      </button>
      {open && ReactDOM.createPortal(<SoundPanel anchor={btnRef.current} onClose={() => setOpen(false)}/>, document.body)}
    </>
  );
}

function Row({ label, k, value }) {
  const pct = Math.round(value * 100);
  const step = (d) => setSoundSetting(k, value + d);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center', gap: 8 }}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
        <label htmlFor={'vol-' + k}>{label}</label>
        <span style={{ fontFamily: PX_FONT, fontSize: 10, color: '#6A4A30' }}>{pct}%</span>
      </div>
      <button className="px-btn" aria-label={'ลด' + label} onClick={() => step(-0.1)} style={{ minHeight: 38, fontSize: 18, padding: 0 }}>−</button>
      <input id={'vol-' + k} type="range" min="0" max="100" step="10" value={pct}
        onChange={(e) => { setSoundSetting(k, e.target.value / 100); if (k === 'sfx') sfx('ui'); }}
        style={{ width: '100%', accentColor: '#D9922B' }}/>
      <button className="px-btn" aria-label={'เพิ่ม' + label} onClick={() => step(0.1)} style={{ minHeight: 38, fontSize: 18, padding: 0 }}>+</button>
    </div>
  );
}

function SoundPanel({ anchor, onClose }) {
  const s = useSoundSettings();
  const ref = useRef(null);
  const [pos, setPos] = useState(() => place(anchor));
  useEffect(() => {
    const onResize = () => setPos(place(anchor));
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target) && !(anchor && anchor.contains(e.target))) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, []);
  const muted = s.music === 0 && s.sfx === 0;
  return (
    <div ref={ref} role="dialog" aria-label="ตั้งค่าเสียง" className="px-panel gd-pop"
      style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 75, width: 'min(330px, calc(100vw - 24px))', boxSizing: 'border-box',
        fontFamily: TH_FONT, color: INK, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 6px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>เสียงและเพลง</span>
        <button className="px-btn c-gold" onClick={toggleMuteAll} style={{ minHeight: 36, fontSize: 13, color: INK }}>{muted ? 'เปิดเสียง' : 'ปิดเสียงทั้งหมด'}</button>
      </div>
      <Row label="🎵 เพลง" k="music" value={s.music}/>
      <Row label="🔔 เสียงเอฟเฟกต์" k="sfx" value={s.sfx}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>⌨️ เสียงตอนพิมพ์ถูก</span>
        <div role="group" aria-label="เสียงตอนพิมพ์ถูก" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TYPE_LABELS.map(([id, name]) => (
            <button key={id} aria-pressed={s.typeSound === id} data-nosound
              onClick={() => { setSoundSetting('typeSound', id); if (id !== 'off') sfx(id, 8); }}
              style={{ minHeight: 38, padding: '0 10px', border: '3px solid ' + INK, background: s.typeSound === id ? '#FFC23D' : '#F8EED2',
                fontFamily: TH_FONT, fontSize: 14, fontWeight: 800, color: INK, cursor: 'pointer' }}>{name}</button>
          ))}
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#6A4A30', lineHeight: 1.5 }}>
        ใช้หูฟังจะดีที่สุดนะ · ตอนแข่งไม่มีเสียงพิมพ์ทีละตัว · ค่าที่ตั้งจำไว้ในเครื่องนี้</span>
    </div>
  );
}

function place(anchor) {
  const r = anchor ? anchor.getBoundingClientRect() : { bottom: 60, right: window.innerWidth - 12 };
  return { top: Math.round(r.bottom + 8), right: Math.max(12, Math.round(window.innerWidth - r.right)) };
}
export { getSoundSettings };
