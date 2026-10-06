// Mr.AT — the in-app guide.
//   • One-time tips: showTip('id') queues a speech box (shown once per student, see src/data/guide.js).
//     A tip is modal: the page behind is dimmed and does not take clicks or keys until it is closed.
//   • Home tour:     <TourLayer/> highlights parts of the home screen one by one (startTour() / first visit).
//   • "?" help:      <HelpButton page="home"/> opens that screen's help with tabs.
// Seen tips are kept on this device at once and sent to the "Tips" sheet for signed-in students.
import { GUIDE_NAME, HELP, TIPS, TOUR } from '../data/guide';
import { INK, PX_FONT, PxButton, TH_FONT } from './pixel';
import { sfx } from './sound';

const { useEffect, useLayoutEffect, useRef, useState } = React;

const IMG = { idle: 'assets/guide/teacher_idle.png', talk: 'assets/guide/teacher_talk.png', blink: 'assets/guide/teacher_blink.png' };
const CREAM = '#FFF6DE';
const CLOSE_DELAY_MS = 1500;   // a tip's button works only after this long (no Enter-mashing past it)
const TOUR_DELAY_MS  = 900;    // same for each tour step
export const TOUR_ID = 'tour-home';

// Mouth + blink animations (kept here so the guide is one self-contained file).
if (typeof document !== 'undefined' && !document.getElementById('guide-css')) {
  const st = document.createElement('style');
  st.id = 'guide-css';
  st.textContent = `
.gd-talk{animation:gd-talk .36s steps(1) infinite}
.gd-blink{animation:gd-blink 3.6s steps(1) infinite}
@keyframes gd-talk{0%{opacity:1}50%{opacity:0}}
@keyframes gd-blink{0%{opacity:0}93%{opacity:1}97%{opacity:0}}
.gd-pop{animation:gd-pop .3s ease-out}
@keyframes gd-pop{0%{transform:translateY(-12px);opacity:0}100%{transform:none;opacity:1}}
.gd-spot{transition:left .3s ease,top .3s ease,width .3s ease,height .3s ease;animation:gd-glow 1.1s ease-in-out infinite alternate}
@keyframes gd-glow{0%{outline-color:#FFC23D}100%{outline-color:#FFF2B8}}
.gd-wait{position:relative;overflow:hidden}
.gd-wait::after{content:'';position:absolute;left:0;bottom:0;height:4px;background:#3B2416;opacity:.35;animation:gd-bar var(--gd-ms) linear forwards}
@keyframes gd-bar{0%{width:100%}100%{width:0}}`;
  document.head.appendChild(st);
}

// ── store ─────────────────────────────────────────────────────────
const store = { who: '', seen: new Set(), queue: [], current: null, tour: false, fingers: false, subs: new Set(), sync: null, pending: new Set(), timer: 0 };
const emit = () => store.subs.forEach(f => f());
const localKey = (who) => 'guideSeen:' + (who || 'guest');

function loadLocal(who) {
  try { const a = JSON.parse(localStorage.getItem(localKey(who)) || '[]'); return Array.isArray(a) ? a.map(String) : []; }
  catch { return []; }
}
function saveLocal() {
  try { localStorage.setItem(localKey(store.who), JSON.stringify([...store.seen])); } catch {}
}
function flush() {
  store.timer = 0;
  if (!store.sync || !store.pending.size) return;
  const ids = [...store.pending]; store.pending.clear();
  Promise.resolve(store.sync(ids)).catch(() => {});   // already saved on this device; the sheet is best effort
}
function markSeen(id) {
  if (store.seen.has(id)) return;
  store.seen.add(id); saveLocal();
  store.pending.add(id);
  if (!store.timer) store.timer = setTimeout(flush, 800);
}

// who: the student's email ('' = guest). serverSeen: ids from the sheet. sync(ids): sends ids to the sheet.
// Calling it again with server data (or a reset) replaces what the device remembered.
export function guideInit({ who = '', serverSeen = null, sync = null } = {}) {
  store.who = who; store.sync = sync; store.pending.clear();
  const ids = serverSeen ? serverSeen.map(String) : loadLocal(who);
  store.seen = new Set(ids);
  saveLocal();
  store.queue = store.queue.filter(id => !store.seen.has(id));
  if (store.current && store.seen.has(store.current)) store.current = null;
  store.tour = false; store.fingers = false;
  emit();
}

export const isSeen = (id) => store.seen.has(id);

// Queue a tip (ignored if already seen or already waiting).
export function showTip(id) {
  if (!TIPS[id] || store.seen.has(id) || store.current === id || store.queue.includes(id)) return;
  if (!store.current) store.current = id; else store.queue.push(id);
  emit();
}

export function dismissTip() {
  const id = store.current;
  if (!id) return;
  markSeen(id);
  store.current = store.queue.shift() || null;
  emit();
}

// Home tour: start it (first visit or from the help), end it (done or skipped — either way it counts as seen).
export function startTour() { store.tour = true; emit(); }
export function endTour() { store.tour = false; markSeen(TOUR_ID); emit(); }

// Finger-placement lesson (FingerIntro.jsx): first time before stage 1 · lesson 1, or from the "?" help.
export const FINGERS_ID = 'fingers';
export function startFingers() { store.fingers = true; emit(); }
export function endFingers() { store.fingers = false; markSeen(FINGERS_ID); markSeen('first-typing'); emit(); }

export function useGuideStore() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); store.subs.add(f); return () => store.subs.delete(f); }, []);
  return store;
}

// Fires a tip when it mounts (e.g. next to a Rush step).
export function TipTrigger({ id }) {
  useEffect(() => { showTip(id); }, [id]);
  return null;
}

// While mounted, every key goes to the guide only (typing practice behind it gets nothing).
// onKey(e) may handle Enter / arrows; Tab still moves between the guide's buttons.
export function useKeyTrap(onKey) {
  const ref = useRef(onKey); ref.current = onKey;
  useEffect(() => {
    const trap = (e) => {
      if (e.key === 'Tab') return;
      e.stopPropagation();
      if (e.type === 'keydown') {
        const handled = ref.current && ref.current(e);
        if (handled || e.key === ' ' || e.key === 'Enter') e.preventDefault();
      }
    };
    window.addEventListener('keydown', trap, true);
    window.addEventListener('keypress', trap, true);
    window.addEventListener('keyup', trap, true);
    return () => {
      window.removeEventListener('keydown', trap, true);
      window.removeEventListener('keypress', trap, true);
      window.removeEventListener('keyup', trap, true);
    };
  }, []);
}

// true once `ms` have passed since `key` last changed.
export function useReady(key, ms) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [key]);
  return ready;
}

// ── pieces ────────────────────────────────────────────────────────
// "[ด]" → key chip, "**x**" → bold.
export function GuideText({ text }) {
  const parts = String(text || '').split(/(\[[^\]]+\]|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p[0] === '[' && p[p.length - 1] === ']') return (
      <span key={i} style={{ display: 'inline-block', minWidth: '1.6em', textAlign: 'center', background: '#FFC23D',
        border: '2px solid ' + INK, padding: '0 4px', margin: '0 2px', lineHeight: 1.35, fontWeight: 800 }}>{p.slice(1, -1)}</span>);
    if (p.startsWith('**')) return <b key={i} style={{ fontWeight: 800 }}>{p.slice(2, -2)}</b>;
    return <span key={i}>{p}</span>;
  });
}

// Pixel portrait (64 px art at a whole-number scale). talkMs > 0 → mouth moves for that long.
export function GuidePortrait({ scale = 2, talkMs = 0, talkKey }) {
  const [talking, setTalking] = useState(talkMs > 0);
  useEffect(() => {
    if (!(talkMs > 0)) return;
    setTalking(true);
    const t = setTimeout(() => setTalking(false), talkMs);
    // Mr.AT "speaks" in soft blips while his mouth moves
    let n = 0; const b = setInterval(() => { if (n++ % 2 === 0) sfx('blip'); }, 90);
    const bEnd = setTimeout(() => clearInterval(b), talkMs);
    return () => { clearTimeout(t); clearInterval(b); clearTimeout(bEnd); };
  }, [talkKey, talkMs]);
  const s = 64 * scale;
  const img = { position: 'absolute', inset: 0, width: s, height: s, imageRendering: 'pixelated', display: 'block' };
  return (
    <div style={{ position: 'relative', width: s, height: s, background: '#8FC6E8', border: '3px solid ' + INK, flex: 'none' }}>
      <img src={IMG.idle} alt={GUIDE_NAME} style={img}/>
      {talking && <img src={IMG.talk} alt="" aria-hidden="true" className="gd-talk" style={img}/>}
      <img src={IMG.blink} alt="" aria-hidden="true" className="gd-blink" style={img}/>
    </div>
  );
}

export function NameTag() {
  return <span style={{ background: '#FFC23D', border: '3px solid ' + INK, padding: '0 8px', fontSize: 13, fontWeight: 700,
    color: INK, whiteSpace: 'nowrap', fontFamily: TH_FONT }}>{GUIDE_NAME}</span>;
}
export const talkTime = (text) => Math.min(4200, 900 + String(text || '').length * 28);

// The gold button that only works after a short wait (a shrinking bar shows the wait).
export function WaitButton({ ready, ms, onClick, children, color = 'gold' }) {
  return (
    <PxButton color={color} onClick={(e) => { if (!ready) return; e.currentTarget.blur(); onClick(); }}
      onMouseDown={(e) => e.preventDefault()} aria-disabled={!ready}
      className={'px-btn c-' + color + (ready ? '' : ' gd-wait')}
      style={{ minHeight: 40, fontSize: 15, color: color === 'gold' ? INK : '#FFFFFF', opacity: ready ? 1 : 0.6,
        cursor: ready ? 'pointer' : 'wait', '--gd-ms': ms + 'ms' }}>{children}</PxButton>
  );
}

// Speech box: portrait + name on the left, text and buttons on the right.
function SpeechBox({ talkKey, text, label, children, scale = 2, style }) {
  return (
    <div key={talkKey} className="px-wood gd-pop" role="dialog" aria-modal="true" aria-label={'คำแนะนำจาก ' + GUIDE_NAME}
      onClick={(e) => e.stopPropagation()}
      style={{ width: '100%', maxWidth: 880, boxSizing: 'border-box', display: 'flex', gap: 12, alignItems: 'stretch', padding: 2,
        boxShadow: '0 6px 0 rgba(59,36,22,.35)', fontFamily: TH_FONT, ...style }}>
      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <GuidePortrait scale={scale} talkMs={talkTime(text)} talkKey={talkKey}/>
        <NameTag/>
      </div>
      <div style={{ flex: '1 1 auto', minWidth: 0, background: CREAM, border: '3px solid ' + INK, padding: '8px 14px',
        display: 'flex', flexDirection: 'column', gap: 6, color: INK }}>
        {label && <span style={{ fontSize: 12, fontWeight: 700, color: '#A16207' }}>💡 {label}</span>}
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, fontWeight: 600 }}><GuideText text={text}/></p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end', marginTop: 'auto', flexWrap: 'wrap' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── one-time tips ─────────────────────────────────────────────────
// Modal: dims the page, blocks clicks and keys until closed (button or Enter, after CLOSE_DELAY_MS).
// paused: hold tips back (race, timed run). Tips also wait while the home tour is open.
export function GuideLayer({ paused }) {
  const s = useGuideStore();
  const id = (paused || s.tour || s.fingers) ? null : s.current;
  return id ? <TipBox key={id} id={id}/> : null;
}

function TipBox({ id }) {
  const tip = TIPS[id];
  useEffect(() => { sfx('tip'); }, [id]);
  const ready = useReady(id, CLOSE_DELAY_MS);
  const readyRef = useRef(ready); readyRef.current = ready;
  useKeyTrap((e) => { if (e.key === 'Enter' && readyRef.current) { dismissTip(); return true; } return false; });
  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(24,14,8,.45)', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', padding: '8px 12px', boxSizing: 'border-box' }}>
      <SpeechBox talkKey={id} text={tip.text} label={tip.label}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#6A4A30' }}>{ready ? 'กด Enter ก็ได้' : 'อ่านก่อนนะ…'}</span>
        <WaitButton ready={ready} ms={CLOSE_DELAY_MS} onClick={dismissTip}>{tip.ok || 'เข้าใจแล้ว'}</WaitButton>
      </SpeechBox>
    </div>, document.body);
}

// ── home tour ─────────────────────────────────────────────────────
// Parts of the page are marked with data-tour="name". Each step highlights its parts (one box around
// all of them); steps whose parts are not on screen are skipped. Blocks the page until done or skipped.
const PAD = 6;
function rectOf(names) {
  let r = null;
  names.forEach(n => document.querySelectorAll('[data-tour="' + n + '"]').forEach(el => {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) return;
    r = r ? { l: Math.min(r.l, b.left), t: Math.min(r.t, b.top), r: Math.max(r.r, b.right), b: Math.max(r.b, b.bottom) }
          : { l: b.left, t: b.top, r: b.right, b: b.bottom };
  }));
  return r && { x: r.l - PAD, y: r.t - PAD, w: r.r - r.l + PAD * 2, h: r.b - r.t + PAD * 2 };
}

export function TourLayer({ active }) {
  const s = useGuideStore();
  return (active && s.tour) ? <Tour/> : null;
}

function Tour() {
  const [steps, setSteps] = useState(null);   // TOUR steps whose parts are on screen
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const boxRef = useRef(null);
  const [boxH, setBoxH] = useState(200);

  // Find which steps can be shown (after the home screen has laid out).
  useEffect(() => {
    const t = setTimeout(() => {
      const ok = TOUR.filter(st => rectOf(st.target));
      if (!ok.length) endTour(); else setSteps(ok);
    }, 120);
    return () => clearTimeout(t);
  }, []);

  // Follow the highlighted part (window resize, late layout).
  useEffect(() => {
    if (!steps) return;
    let raf = 0, last = '';
    const tick = () => {
      const r = rectOf(steps[i].target);
      const key = r ? [r.x, r.y, r.w, r.h].map(Math.round).join(',') + '|' + window.innerWidth + 'x' + window.innerHeight : '';
      if (key !== last) { last = key; setRect(r); setView({ w: window.innerWidth, h: window.innerHeight }); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [steps, i]);

  useLayoutEffect(() => {
    if (boxRef.current && Math.abs(boxRef.current.offsetHeight - boxH) > 1) setBoxH(boxRef.current.offsetHeight);
  });

  const n = steps ? steps.length : 0;
  const ready = useReady(i + ':' + !!steps, TOUR_DELAY_MS);
  const st = useRef({}); st.current = { i, n, ready };
  const next = () => { const c = st.current; if (!c.ready || !c.n) return; if (c.i >= c.n - 1) endTour(); else setI(c.i + 1); };
  const back = () => setI(v => Math.max(0, v - 1));
  useKeyTrap((e) => {
    if (e.key === 'Enter' || e.key === 'ArrowRight') { next(); return true; }
    if (e.key === 'ArrowLeft') { back(); return true; }
    if (e.key === 'Escape') { endTour(); return true; }
    return false;
  });

  if (!steps) return ReactDOM.createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 85 }}/>, document.body);
  const step = steps[i];
  const r = rect || { x: view.w / 2, y: view.h / 2, w: 0, h: 0 };
  // Speech box above or below the highlight, whichever has room (else the side away from it).
  const gap = 12, margin = 8;
  const below = view.h - (r.y + r.h) - gap - margin, above = r.y - gap - margin;
  let top;
  if (below >= boxH) top = r.y + r.h + gap;
  else if (above >= boxH) top = r.y - gap - boxH;
  else top = (r.y + r.h / 2 > view.h / 2) ? margin : view.h - boxH - margin;
  top = Math.max(margin, Math.min(top, view.h - boxH - margin));

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 85 }} onClick={(e) => e.stopPropagation()}>
      {/* the dim with a hole: a huge shadow around the highlighted box */}
      <div className="gd-spot" style={{ position: 'fixed', left: r.x, top: r.y, width: r.w, height: r.h, pointerEvents: 'none',
        boxShadow: '0 0 0 9999px rgba(24,14,8,.62)', outline: '4px solid #FFC23D', outlineOffset: 0 }}/>
      <div ref={boxRef} style={{ position: 'fixed', left: 12, right: 12, top, display: 'flex', justifyContent: 'center' }}>
        <SpeechBox talkKey={'tour' + i} text={step.text}>
          <div style={{ display: 'flex', gap: 5, marginRight: 'auto', alignItems: 'center' }} aria-label={`ขั้น ${i + 1} จาก ${n}`}>
            {steps.map((_, k) => <span key={k} style={{ width: 11, height: 11, border: '2px solid ' + INK, background: k <= i ? '#FFC23D' : '#F8EED2' }}/>)}
            <span style={{ fontFamily: PX_FONT, fontSize: 10, color: '#6A4A30', marginLeft: 4 }}>{i + 1}/{n}</span>
          </div>
          <button onClick={endTour} onMouseDown={(e) => e.preventDefault()}
            style={{ background: 'none', border: 0, fontFamily: TH_FONT, fontSize: 14, fontWeight: 700, color: '#6A4A30',
              textDecoration: 'underline', cursor: 'pointer', minHeight: 40 }}>ข้ามทัวร์</button>
          {i > 0 && <PxButton onClick={back} onMouseDown={(e) => e.preventDefault()} style={{ minHeight: 40, fontSize: 15 }}>ย้อนกลับ</PxButton>}
          <WaitButton ready={ready} ms={TOUR_DELAY_MS} onClick={next}>{i >= n - 1 ? 'เริ่มเลย!' : 'ต่อไป →'}</WaitButton>
        </SpeechBox>
      </div>
    </div>, document.body);
}

// ── "?" help ──────────────────────────────────────────────────────
export function HelpButton({ page, disabled, style }) {
  const [open, setOpen] = useState(false);
  if (!HELP[page]) return null;
  return (
    <>
      <button className="px-btn c-gold" aria-label="ช่วยเหลือ" title="ช่วยเหลือ" disabled={disabled} data-tour="help"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.currentTarget.blur(); setOpen(true); }}
        style={{ minHeight: 'var(--hb)', minWidth: 44, padding: '0 6px', fontFamily: PX_FONT, fontSize: 13, color: INK,
          opacity: disabled ? 0.5 : 1, flex: 'none', ...style }}>?</button>
      {/* Portal to <body>: the button lives inside the header bar's layer, which the page content covers */}
      {open && ReactDOM.createPortal(<HelpDialog page={page} onClose={() => setOpen(false)}/>, document.body)}
    </>
  );
}

export function HelpDialog({ page, onClose }) {
  const help = HELP[page];
  const [tab, setTab] = useState(0);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  // Modal: keys go to the dialog only (so typing practice does not receive them); Esc closes.
  useKeyTrap((e) => { if (e.key === 'Escape') { closeRef.current(); return true; } return false; });
  if (!help) return null;
  const body = help.tabs[Math.min(tab, help.tabs.length - 1)][1];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(24,14,8,.62)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 12, fontFamily: TH_FONT }}>
      <div role="dialog" aria-modal="true" aria-label={'ช่วยเหลือ · ' + help.title} className="px-wood gd-pop"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 900, maxHeight: 'calc(100dvh - 24px)', boxSizing: 'border-box', display: 'flex', gap: 14,
          padding: 4, boxShadow: '0 8px 0 rgba(0,0,0,.35)' }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <GuidePortrait scale={3} talkMs={talkTime(body)} talkKey={page + tab}/>
          <NameTag/>
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 0, background: CREAM, border: '3px solid ' + INK, padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 10, color: INK, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>ช่วยเหลือ · {help.title}</span>
            <button onClick={onClose} aria-label="ปิด" autoFocus
              style={{ marginLeft: 'auto', width: 40, height: 40, background: '#F8EED2', border: '3px solid ' + INK,
                fontFamily: PX_FONT, fontSize: 12, color: INK, cursor: 'pointer', flex: 'none' }}>X</button>
          </div>
          {help.tabs.length > 1 && (
            <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {help.tabs.map(([label], i) => (
                <button key={label} role="tab" aria-selected={i === tab} onClick={() => setTab(i)}
                  style={{ minHeight: 40, padding: '0 12px', border: '3px solid ' + INK, background: i === tab ? '#FFC23D' : '#F8EED2',
                    fontFamily: TH_FONT, fontSize: 14, fontWeight: 700, color: INK, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
          )}
          <p role="tabpanel" style={{ margin: 0, fontSize: 18, lineHeight: 1.6, fontWeight: 600, minHeight: 96 }}><GuideText text={body}/></p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            {page === 'home' && (
              <PxButton color="blue" onClick={() => { onClose(); startTour(); }} style={{ minHeight: 40, fontSize: 15 }}>
                ▶ ดูทัวร์อีกครั้ง</PxButton>
            )}
            {(page === 'home' || page === 'typing') && (
              <PxButton color="purple" onClick={() => { onClose(); startFingers(); }} style={{ minHeight: 40, fontSize: 15, marginRight: 'auto' }}>
                ✋ ฝึกวางนิ้ว</PxButton>
            )}
            {tab < help.tabs.length - 1 && (
              <PxButton onClick={() => setTab(tab + 1)} style={{ minHeight: 40, fontSize: 15 }}>ต่อไป →</PxButton>
            )}
            <PxButton color="gold" onClick={onClose} style={{ minHeight: 40, fontSize: 15, color: INK }}>เข้าใจแล้ว</PxButton>
          </div>
        </div>
      </div>
    </div>
  );
}
