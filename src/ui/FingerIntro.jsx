// Finger-placement lesson ("บทวางนิ้ว") — Mr.AT shows where each finger lives on the home row.
//   intro → press the 9 keys one by one (ด ่ ก า ห ส ฟ ว Space) → challenge: 10 random home keys → done.
// Opens over everything (first time before stage 1 · lesson 1, or "✋ ฝึกวางนิ้ว" in the help).
// The keyboard can't tell which finger pressed a key, so the right key counts; the finger is shown by
// colour, name and the tapping fingertip.
// The stage is drawn at 1366×657 and scaled to fit the window, so it always fits without scrolling.
import { resolveKey } from '../engine/keymap';
import { GuidePortrait, GuideText, NameTag, endFingers, useGuideStore, useKeyTrap } from './Guide';
import { INK, PX_FONT, PxButton, Scene, TH_FONT } from './pixel';

const { useEffect, useMemo, useState } = React;

const HAND = 'assets/guide/hand.png';      // a right hand (128 px); the left hand is the same image mirrored
const COL = { P: '#B78CE8', R: '#6AA8F0', M: '#7CCB7A', I: '#F2A35E', T: '#C9C2B8' };
const NAME = { LP: 'นิ้วก้อยซ้าย', LR: 'นิ้วนางซ้าย', LM: 'นิ้วกลางซ้าย', LI: 'นิ้วชี้ซ้าย',
  RI: 'นิ้วชี้ขวา', RM: 'นิ้วกลางขวา', RR: 'นิ้วนางขวา', RP: 'นิ้วก้อยขวา', T: 'นิ้วโป้ง' };
const fcol = (f) => f === 'T' ? COL.T : COL[f[1]];

const SEQ = [
  { f: 'LI', ch: 'ด', say: 'เริ่มที่**นิ้วชี้ซ้าย**ก่อน ปุ่ม [ด] มีขีดนูนเล็ก ๆ ลองคลำดูแล้วกดเลย!' },
  { f: 'RI', ch: '่', say: '**นิ้วชี้ขวา**อยู่ที่ [่] (ไม้เอก) ปุ่มนี้ก็มีขีดนูนเหมือนกัน' },
  { f: 'LM', ch: 'ก', say: '**นิ้วกลางซ้าย**วางข้าง ๆ นิ้วชี้ ที่ปุ่ม [ก]' },
  { f: 'RM', ch: 'า', say: '**นิ้วกลางขวา**อยู่ที่สระ [า]' },
  { f: 'LR', ch: 'ห', say: '**นิ้วนางซ้าย**อยู่ที่ [ห]' },
  { f: 'RR', ch: 'ส', say: '**นิ้วนางขวา**อยู่ที่ [ส]' },
  { f: 'LP', ch: 'ฟ', say: '**นิ้วก้อยซ้าย**อยู่ที่ [ฟ]' },
  { f: 'RP', ch: 'ว', say: '**นิ้วก้อยขวา**อยู่ที่ [ว]' },
  { f: 'T', ch: ' ', say: 'สุดท้าย เว้นวรรคใช้**นิ้วโป้ง** กด **Spacebar** ได้เลย' },
];
const HOME_F = { 'ฟ': 'LP', 'ห': 'LR', 'ก': 'LM', 'ด': 'LI', '่': 'RI', 'า': 'RM', 'ส': 'RR', 'ว': 'RP' };
const CHALLENGE = 10;

// Keyboard geometry (stage px): key pitch 56, keys 50×44, rows 58 apart.
const P = 56, KW = 50;
const ROWS = [
  { y: 0, off: 0, keys: ['ๅ', '/', '-', 'ภ', 'ถ', 'ุ', 'ึ', 'ค', 'ต', 'จ', 'ข', 'ช'] },
  { y: 58, off: 28, keys: ['ๆ', 'ไ', 'ำ', 'พ', 'ะ', 'ั', 'ี', 'ร', 'น', 'ย', 'บ', 'ล'] },
  { y: 116, off: 44, keys: ['ฟ', 'ห', 'ก', 'ด', 'เ', '้', '่', 'า', 'ส', 'ว', 'ง'] },
  { y: 174, off: 72, keys: ['ผ', 'ป', 'แ', 'อ', 'ิ', 'ื', 'ท', 'ม', 'ใ', 'ฝ'] },
];
// Fingertips of the hand art drawn at ×3 (right hand at x 278, left = mirror at x −17, both at y 75).
const TIP = { RI: [408, 140, '่'], RM: [461, 125, 'า'], RR: [515, 137, 'ส'], RP: [570, 158, 'ว'], RT: [368, 246, ''],
  LI: [234, 140, 'ด'], LM: [181, 125, 'ก'], LR: [127, 137, 'ห'], LP: [72, 158, 'ฟ'], LT: [274, 246, ''] };

if (typeof document !== 'undefined' && !document.getElementById('fingers-css')) {
  const st = document.createElement('style');
  st.id = 'fingers-css';
  st.textContent = `
.fi-lit{animation:fi-lit .7s ease-in-out infinite alternate}
@keyframes fi-lit{0%{box-shadow:0 0 0 3px #FFC23D,0 0 14px 4px rgba(255,194,61,.7)}100%{box-shadow:0 0 0 5px #FFF2B8,0 0 22px 8px rgba(255,194,61,.95)}}
.fi-tap{animation:fi-tap .7s ease-in-out infinite alternate}
@keyframes fi-tap{0%{transform:translateY(0)}100%{transform:translateY(-6px)}}
.fi-shake{animation:fi-shake .3s linear}
@keyframes fi-shake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`;
  document.head.appendChild(st);
}

export function FingerLayer() {
  const s = useGuideStore();
  return s.fingers ? <FingerIntro/> : null;
}

const pickChallenge = () => {
  const keys = Object.keys(HOME_F), out = [];
  while (out.length < CHALLENGE) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    if (k !== out[out.length - 1]) out.push(k);
  }
  return out;
};

function FingerIntro() {
  // step: 0 intro · 1..9 guided keys · 10..19 challenge · 20 done
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState(0);        // bumps to replay the shake
  const [misses, setMisses] = useState(0);
  const challenge = useMemo(pickChallenge, []);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const n = SEQ.length, chStart = n + 1, doneAt = n + 1 + CHALLENGE;
  const guided = step >= 1 && step <= n ? SEQ[step - 1] : null;
  const chKey = step >= chStart && step < doneAt ? challenge[step - chStart] : null;
  const target = guided ? guided.ch : chKey;
  const targetF = guided ? guided.f : chKey ? HOME_F[chKey] : null;

  const press = (ch) => {
    if (target == null) return;
    if (ch === target) setStep(v => v + 1);
    else { setWrong(w => w + 1); if (chKey) setMisses(m => m + 1); }
  };
  const next = () => {
    if (step === 0) setStep(1);
    else if (step >= doneAt) endFingers();
  };
  useKeyTrap((e) => {
    if (e.key === 'Escape') { endFingers(); return true; }
    if (e.repeat) return true;
    if (target == null) { if (e.key === 'Enter') { next(); return true; } return false; }
    const rk = resolveKey(e);
    if (rk && rk.char != null) { press(rk.char); return true; }
    return false;
  });

  const say = step === 0
    ? 'ก่อนเริ่มผจญภัย มาวางนิ้วให้ถูกที่กันก่อน! นิ้วแต่ละนิ้วมี**บ้าน**ของตัวเองบนแถวกลาง กดปุ่มที่ไฟขึ้นด้วยนิ้วที่บอกนะ'
    : guided ? guided.say
    : chKey ? (step === chStart ? '**รอบท้าทาย!** ไฟจะขึ้นสุ่ม 10 ครั้ง ลองกดด้วยนิ้วที่ถูกต้องให้เร็วที่สุด' : 'อีกนิด! ไฟขึ้นปุ่มไหน กดเลย')
    : misses === 0 ? 'เยี่ยมมาก ไม่พลาดเลย! จำตำแหน่งนี้ไว้นะ พิมพ์เสร็จแต่ละตัวให้นิ้วกลับมา**บ้าน**เสมอ'
    : `เก่งมาก! (พลาด ${misses} ครั้ง) จำตำแหน่งนี้ไว้นะ พิมพ์เสร็จแต่ละตัวให้นิ้วกลับมา**บ้าน**เสมอ`;

  const doneSet = new Set(SEQ.slice(0, Math.max(0, Math.min(step, n + 1) - 1)).map(q => q.ch));
  const scale = Math.min(view.w / 1366, view.h / 657);
  const pips = Array.from({ length: n }, (_, k) => (k < step - 1 || step > n) ? '#7CCB7A' : k === step - 1 ? '#FFC23D' : '#F8EED2');
  const label = step === 0 ? 'เริ่มเลย!' : 'ไปพิมพ์กันเลย →';

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, fontFamily: TH_FONT, color: INK, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}><Scene dim={0.1}/></div>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1366, height: 657, marginLeft: -683, marginTop: -328.5,
        transform: `scale(${scale})`, transformOrigin: 'center' }}>

        {/* Top bar */}
        <div className="px-wood" style={{ position: 'absolute', left: 12, top: 8, width: 1342, height: 56, boxSizing: 'border-box', display: 'flex',
          alignItems: 'center', gap: 12, padding: '0 6px', color: '#F5E6BE' }}>
          <PxButton onClick={endFingers} style={{ minHeight: 36, fontSize: 14 }}>✕ ปิด</PxButton>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#E8CF95' }}>ด่าน 1 · ก่อนเริ่ม</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>บทวางนิ้ว</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }} aria-label="ความคืบหน้า">
            {pips.map((bg, k) => <span key={k} style={{ width: 12, height: 12, border: '2px solid ' + INK, background: bg }}/>)}
            {chKey && <span style={{ fontFamily: PX_FONT, fontSize: 10, marginLeft: 8, color: '#F5D27A' }}>{step - chStart + 1}/{CHALLENGE}</span>}
          </div>
        </div>

        {/* Mr.AT */}
        <div style={{ position: 'absolute', left: 12, right: 12, top: 74, display: 'flex', justifyContent: 'center' }}>
          <div className="px-wood" style={{ width: 1000, display: 'flex', gap: 12, padding: 2, boxShadow: '0 6px 0 rgba(59,36,22,.35)' }}>
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <GuidePortrait scale={2} say={say} talkKey={'f' + step}/>
              <NameTag/>
            </div>
            <div key={wrong} className={wrong ? 'fi-shake' : ''} style={{ flex: '1 1 auto', background: '#FFF6DE', border: '3px solid ' + INK,
              padding: '10px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
              <p role="status" style={{ margin: 0, flex: '1 1 auto', fontSize: 19, lineHeight: 1.55, fontWeight: 600 }}><GuideText text={say}/></p>
              {targetF && (
                <div style={{ flex: 'none', width: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 8,
                  border: '3px solid ' + INK, background: fcol(targetF) }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>ใช้นิ้ว</span>
                  <span style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', lineHeight: 1.25 }}>{NAME[targetF]}</span>
                  <span style={{ minWidth: 44, textAlign: 'center', fontSize: 24, fontWeight: 800, background: '#FFC23D', border: '3px solid ' + INK, padding: '0 6px' }}>
                    {target === ' ' ? 'Space' : target}</span>
                </div>
              )}
              {target == null && (
                <PxButton color="gold" onClick={next} style={{ flex: 'none', minHeight: 46, fontSize: 16, color: INK }}>{label}</PxButton>
              )}
            </div>
          </div>
        </div>

        {/* Keyboard + hands */}
        <div style={{ position: 'absolute', left: 347, top: 252, width: 700, height: 420 }}>
          {ROWS.map((r, ri) => r.keys.map((ch, k) => {
            const lit = target === ch, home = ri === 2 && HOME_F[ch];
            return (
              <button key={ri + ch} onClick={() => press(ch)} onMouseDown={(e) => e.preventDefault()} aria-label={'ปุ่ม ' + ch}
                className={lit ? 'fi-lit' : ''}
                style={{ position: 'absolute', left: r.off + k * P, top: r.y, width: KW, height: 44, boxSizing: 'border-box', border: '3px solid ' + INK,
                  background: lit ? '#FFE9A8' : doneSet.has(ch) ? '#DDF0C8' : home ? '#F8EED2' : '#E9DCC0', fontFamily: TH_FONT, fontSize: 19,
                  fontWeight: 800, color: INK, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 0, lineHeight: 1.35, cursor: 'pointer' }}>
                {ch}
                {(ch === 'ด' || ch === '่') && <span style={{ position: 'absolute', bottom: 4, left: '50%', width: 12, height: 3, marginLeft: -6, background: INK }}/>}
              </button>
            );
          }))}
          <button onClick={() => press(' ')} onMouseDown={(e) => e.preventDefault()} aria-label="Spacebar" className={target === ' ' ? 'fi-lit' : ''}
            style={{ position: 'absolute', left: 168, top: 232, width: 314, height: 44, boxSizing: 'border-box', border: '3px solid ' + INK,
              background: target === ' ' ? '#FFE9A8' : doneSet.has(' ') ? '#DDF0C8' : '#E9DCC0', fontFamily: TH_FONT, fontSize: 16, fontWeight: 800,
              color: INK, cursor: 'pointer' }}>เว้นวรรค</button>
          <img src={HAND} alt="มือซ้าย" style={{ position: 'absolute', left: -17, top: 75, width: 384, height: 384, transform: 'scaleX(-1)',
            imageRendering: 'pixelated', opacity: 0.95, pointerEvents: 'none' }}/>
          <img src={HAND} alt="มือขวา" style={{ position: 'absolute', left: 278, top: 75, width: 384, height: 384,
            imageRendering: 'pixelated', opacity: 0.95, pointerEvents: 'none' }}/>
          {Object.entries(TIP).map(([f, [x, y, ch]]) => {
            const key = f[1] === 'T' ? 'T' : f, active = targetF === key, sz = active ? 34 : 24;
            return (
              <span key={f} className={active ? 'fi-lit fi-tap' : ''} style={{ position: 'absolute', left: x - sz / 2, top: y - sz / 2, width: sz, height: sz,
                boxSizing: 'border-box', borderRadius: '50%', border: '3px solid ' + INK, background: fcol(key), pointerEvents: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: active ? 18 : 14, fontWeight: 800, lineHeight: 1 }}>{ch}</span>
            );
          })}
        </div>

        {/* Finger colours */}
        <div className="px-wood" style={{ position: 'absolute', left: 12, bottom: 10, width: 250, boxSizing: 'border-box', padding: '4px 6px',
          color: '#F5E6BE', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>สีของนิ้ว</span>
          {[['นิ้วก้อย', COL.P], ['นิ้วนาง', COL.R], ['นิ้วกลาง', COL.M], ['นิ้วชี้', COL.I], ['นิ้วโป้ง', COL.T]].map(([nm, c]) => (
            <span key={nm} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <span style={{ width: 16, height: 12, border: '2px solid ' + INK, background: c }}/>{nm}</span>
          ))}
        </div>
      </div>
    </div>, document.body);
}
