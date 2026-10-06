// ครูอาร์เธอร์ — the in-app guide.
//   • One-time tips: showTip('id') queues a speech box (shown once per student, see src/data/guide.js).
//   • "?" help:      <HelpButton page="home"/> opens that screen's help with tabs.
// Seen tips are kept on this device at once and sent to the "Tips" sheet for signed-in students.
import { GUIDE_NAME, HELP, TIPS } from '../data/guide';
import { INK, PX_FONT, PxButton, TH_FONT } from './pixel';

const { useEffect, useRef, useState } = React;

const IMG = { idle: 'assets/guide/teacher_idle.png', talk: 'assets/guide/teacher_talk.png', blink: 'assets/guide/teacher_blink.png' };
const CREAM = '#FFF6DE';

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
@keyframes gd-pop{0%{transform:translateY(-12px);opacity:0}100%{transform:none;opacity:1}}`;
  document.head.appendChild(st);
}

// ── store ─────────────────────────────────────────────────────────
const store = { who: '', seen: new Set(), queue: [], current: null, subs: new Set(), sync: null, pending: new Set(), timer: 0 };
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

// who: the student's email ('' = guest). serverSeen: ids from the sheet. sync(ids): sends ids to the sheet.
// Calling it again with server data (or a reset) replaces what the device remembered.
export function guideInit({ who = '', serverSeen = null, sync = null } = {}) {
  store.who = who; store.sync = sync; store.pending.clear();
  const ids = serverSeen ? serverSeen.map(String) : loadLocal(who);
  store.seen = new Set(ids);
  saveLocal();
  store.queue = store.queue.filter(id => !store.seen.has(id));
  if (store.current && store.seen.has(store.current)) store.current = null;
  emit();
}

// Queue a tip (ignored if already seen or already waiting).
export function showTip(id) {
  if (!TIPS[id] || store.seen.has(id) || store.current === id || store.queue.includes(id)) return;
  if (!store.current) store.current = id; else store.queue.push(id);
  emit();
}

export function dismissTip() {
  const id = store.current;
  if (!id) return;
  store.seen.add(id); saveLocal();
  store.pending.add(id);
  if (!store.timer) store.timer = setTimeout(flush, 800);
  store.current = store.queue.shift() || null;
  emit();
}

function useGuideTip() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); store.subs.add(f); return () => store.subs.delete(f); }, []);
  return store.current;
}

// Fires a tip when it mounts (e.g. next to a RUSH badge).
export function TipTrigger({ id }) {
  useEffect(() => { showTip(id); }, [id]);
  return null;
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
    return () => clearTimeout(t);
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

function NameTag() {
  return <span style={{ background: '#FFC23D', border: '3px solid ' + INK, padding: '0 8px', fontSize: 13, fontWeight: 700,
    color: INK, whiteSpace: 'nowrap' }}>{GUIDE_NAME}</span>;
}
const talkTime = (text) => Math.min(4200, 900 + String(text || '').length * 28);

// ── one-time tips ─────────────────────────────────────────────────
// Floats over the top of the screen (never pushes the page). paused: hold tips back (race, timed run).
// Typing keeps working while a tip is open — it is not modal.
export function GuideLayer({ paused }) {
  const id = useGuideTip();
  if (paused || !id) return null;
  const tip = TIPS[id];
  return (
    <div style={{ position: 'fixed', top: 8, left: 0, right: 0, zIndex: 60, display: 'flex', justifyContent: 'center',
      padding: '0 12px', pointerEvents: 'none', fontFamily: TH_FONT }}>
      <div key={id} className="px-wood gd-pop" role="dialog" aria-modal="false" aria-label={'คำแนะนำจาก' + GUIDE_NAME}
        style={{ width: '100%', maxWidth: 880, display: 'flex', gap: 12, alignItems: 'stretch', padding: 2,
          boxShadow: '0 6px 0 rgba(59,36,22,.35)', pointerEvents: 'auto' }}>
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <GuidePortrait scale={2} talkMs={talkTime(tip.text)} talkKey={id}/>
          <NameTag/>
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 0, background: CREAM, border: '3px solid ' + INK, padding: '8px 14px',
          display: 'flex', flexDirection: 'column', gap: 6, color: INK }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#A16207' }}>💡 {tip.label}</span>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.55, fontWeight: 600 }}><GuideText text={tip.text}/></p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
            <PxButton color="gold" onClick={(e) => { e.currentTarget.blur(); dismissTip(); }}
              onMouseDown={(e) => e.preventDefault()}
              style={{ minHeight: 40, fontSize: 15, color: INK }}>{tip.ok || 'เข้าใจแล้ว'}</PxButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── "?" help ──────────────────────────────────────────────────────
export function HelpButton({ page, disabled, style }) {
  const [open, setOpen] = useState(false);
  if (!HELP[page]) return null;
  return (
    <>
      <button className="px-btn c-gold" aria-label="ช่วยเหลือ" title="ช่วยเหลือ" disabled={disabled}
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
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key !== 'Tab' && e.key !== 'Enter' && e.key !== ' ') e.stopPropagation();
      else if (!(e.target instanceof HTMLButtonElement)) e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keypress', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keypress', onKey, true); };
  }, []);
  if (!help) return null;
  const body = help.tabs[Math.min(tab, help.tabs.length - 1)][1];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(24,14,8,.62)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 12, fontFamily: TH_FONT }}>
      <div role="dialog" aria-modal="true" aria-label={'ช่วยเหลือ · ' + help.title} className="px-wood gd-pop"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 900, maxHeight: 'calc(100dvh - 24px)', boxSizing: 'border-box', display: 'flex', gap: 14,
          padding: 4, boxShadow: '0 8px 0 rgba(0,0,0,.35)' }}>
        <div className="gd-side" style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
