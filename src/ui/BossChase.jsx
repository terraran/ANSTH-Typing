// ═══════════════════════════════════════════════════════════════
// BOSS CHASE — the timed (last) step of a stage's boss lesson.
//   The boss (src/data/bosses.js) stole the treasure chest and runs; the student types to catch up.
//   • Distance = the real star formula: correct keys (Shift = 1 key, like pressCountRef) against
//     target × 1.5 × 4 × minutes (⭐⭐⭐), with a mark at 2/3 of it (⭐⭐). Net steps (stage 9) take 4 keys off per error.
//   • Accuracy: under 95 % the boss can't be caught (⭐⭐⭐ needs 95 %), under 90 % it pulls far ahead (0 stars).
//   • Start: the boss talks (off screen), dashes in from behind and overtakes to the far end, "พร้อม… เริ่ม!", then typing opens.
//   • The boss throws a rock now and then: a big Space QTE pops up (the scene slows, typing and the clock pause);
//     Space in time = jump, too late = trip (only a look — nothing is taken off).
//   • Caught before time's up: one stomp, the boss runs back to the start, and the score gets a short multiplier
//     (×2 for 15 s, +1 per stomp while it lasts, up to ×5); each next lap is longer the higher the multiplier.
//     The top strip keeps fixed chips (boss-head stomp count · ×multiplier · accuracy) so nothing shifts.
//   • Rage (red, rocks come faster, music speeds up): past the ⭐⭐ mark or in the last 30 seconds.
//   • Endings follow the stars the step really gets (lessonStars): ⭐⭐⭐ boss panics in a dialogue, then gets stomped
//     and bursts into pixels, the chest flies back · ⭐–⭐⭐ drops the chest and escapes · 0 runs off with it.
//   • The boss talks in an RPG dialogue box (modal: Enter / Space / click) before the step and at the end.
// Everything moves in requestAnimationFrame on refs, so typing never re-renders the page for the animation.
// ═══════════════════════════════════════════════════════════════
import { lessonStars } from '../engine/scoring';
import { PX_FONT, TH_FONT } from './pixel';
import { sfx } from './sound';

const { useEffect, useRef, useState } = React;
const INK = '#3B2416';

// Code-drawn rock (the boss's throw); one letter = one pixel
const ROCK = ['..kkkk..', '.kqqrrk.', 'kqrrrrrk', 'krrrrrrk', 'krrrrrrk', '.kkkkkk.'];
const ROCK_PAL = { k: '#2a1a12', r: '#8a8f99', q: '#b8bdc6' };
function pixelArt(rows, s, pal) {
  const w = Math.max(...rows.map(r => r.length)), c = document.createElement('canvas');
  c.width = w * s; c.height = rows.length * s;
  const g = c.getContext('2d');
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(i * s, j * s, s, s); } }));
  return c;
}
const loadImg = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
const graphemes = t => seg ? [...seg.segment(t)].map(s => s.segment) : [...t];   // never split a Thai vowel / tone mark off

const CSS = `
.bc-top{position:absolute;left:8px;right:8px;top:5px;display:flex;align-items:center;gap:8px;z-index:4;pointer-events:none}
.bc-chip{background:rgba(59,36,22,.82);color:#F5E6BE;border:2px solid ${INK};padding:2px 6px;font-size:12px;white-space:nowrap;line-height:1.3;font-weight:600}
.bc-clock{font-family:${PX_FONT};font-size:13px;color:#FFE08A;padding:4px 6px}
.bc-clock.hot{color:#FF6B5A;animation:bcPulse .5s ease-in-out infinite alternate}
@keyframes bcPulse{to{transform:scale(1.12)}}
.bc-bar{position:relative;flex:1;height:14px;background:rgba(59,36,22,.75);border:2px solid ${INK}}
.bc-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(#FFD25A,#E79035);transition:width .25s}
.bc-fill.cap{background:linear-gradient(#bbb,#888)}
.bc-tick{position:absolute;top:-4px;bottom:-4px;width:3px;background:${INK}}
.bc-tick span{position:absolute;top:-1px;left:5px;font-size:10px;white-space:nowrap;color:#fff;
  text-shadow:0 1px 0 ${INK},1px 0 0 ${INK},-1px 0 0 ${INK},0 -1px 0 ${INK}}
.bc-stat{text-align:center;transition:opacity .2s}
.bc-stat.off{opacity:.45}
.bc-stomps{color:#9BE39A;display:inline-flex;align-items:center;gap:4px;padding:0 6px 0 2px;height:28px;box-sizing:border-box;min-width:54px}
.bc-stomps b{font-weight:400;font-size:11px}
.bc-head{width:24px;height:24px;image-rendering:pixelated;display:block}
.bc-head.end{display:inline-block;vertical-align:middle;margin:-8px 0 -6px}
.bc-mult{position:relative;min-width:46px;color:#FFD25A;font-size:11px;padding:4px 6px 6px}
.bc-mult b{font-weight:400}
.bc-mult i{position:absolute;left:3px;bottom:2px;height:3px;width:0;background:#FFD25A;transition:width .2s linear}
.bc-mult.pop{animation:bcMultPop .35s ease-out}
@keyframes bcMultPop{40%{transform:scale(1.35)}}
.bc-tick.dim{opacity:.3}
.bc-acc{min-width:78px;text-align:center}
.bc-acc.ok{color:#9BE39A}.bc-acc.mid{color:#FFD25A}.bc-acc.bad{color:#FF6B5A}
.bc-rage{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s;
  background:radial-gradient(ellipse at 70% 60%,rgba(255,60,20,0),rgba(220,30,10,.38));mix-blend-mode:multiply}
.bc-lines{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .4s;
  background:repeating-linear-gradient(180deg,transparent 0 9px,rgba(255,255,255,.35) 9px 10px,transparent 10px 23px);
  animation:bcLines .25s linear infinite;-webkit-mask-image:linear-gradient(90deg,#000,transparent 40%,transparent 60%,#000);
  mask-image:linear-gradient(90deg,#000,transparent 40%,transparent 60%,#000)}
@keyframes bcLines{from{background-position:0 0}to{background-position:0 23px}}
.bc-spr{position:absolute;left:0;top:0;image-rendering:pixelated;will-change:transform}
.bc-spr canvas,.bc-spr img{display:block;image-rendering:pixelated}
.bc-bubble{position:absolute;background:#fff;border:2px solid ${INK};padding:1px 7px;font-size:13px;font-weight:700;white-space:nowrap;
  z-index:8;transform:translate(-50%,-100%);animation:bcPop .18s ease-out;font-family:${TH_FONT};color:${INK}}
@keyframes bcPop{from{transform:translate(-50%,-80%) scale(.5)}}
.bc-dlg{position:fixed;inset:0;z-index:60;background:rgba(24,14,8,.45);cursor:pointer}
.bc-box{position:absolute;box-sizing:border-box;display:flex;animation:bcUp .22s ease-out}
@keyframes bcUp{from{transform:translateY(30px);opacity:0}}
.bc-face{position:absolute;image-rendering:pixelated;z-index:2;transform:scaleX(-1);filter:drop-shadow(0 6px 0 rgba(24,14,8,.35));animation:bcFade .22s ease-out}
@keyframes bcFade{from{opacity:0}}   /* fade only: a transform animation would undo the mirror while it plays */
.bc-qte,.bc-cue{position:absolute;left:50%;transform:translate(-50%,-50%) scale(.6);opacity:0;pointer-events:none;z-index:20;
  transition:opacity .12s,transform .15s}
.bc-qte{display:flex;flex-direction:column;align-items:center;gap:6px}
.bc-qte.show,.bc-cue.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.bc-qte-key{width:300px;height:76px;background:linear-gradient(#FFE08A,#FFC23D);border:4px solid ${INK};border-radius:10px;
  box-shadow:0 8px 0 ${INK},0 0 0 6px rgba(255,255,255,.55),0 0 30px 8px rgba(255,194,61,.8);
  display:flex;align-items:center;justify-content:center;font-size:30px;color:${INK};letter-spacing:4px}
.bc-qte.on .bc-qte-key{animation:bcThump .35s ease-in-out infinite alternate}
@keyframes bcThump{to{transform:translateY(4px);box-shadow:0 2px 0 ${INK},0 0 0 6px rgba(255,255,255,.55),0 0 30px 8px rgba(255,194,61,.8)}}
.bc-qte-word{font-size:24px;font-weight:700;color:#fff;white-space:nowrap;background:rgba(59,36,22,.82);border:3px solid ${INK};padding:0 14px;
  text-shadow:0 2px 0 ${INK},2px 0 0 ${INK},-2px 0 0 ${INK},0 -2px 0 ${INK},0 0 10px rgba(0,0,0,.5)}
.bc-qte-track{width:300px;height:12px;background:rgba(59,36,22,.8);border:3px solid ${INK}}
.bc-qte-bar{height:100%;width:100%;background:linear-gradient(90deg,#FF6B5A,#FFC23D 40%,#9BE39A)}
.bc-qte.ok .bc-qte-key{background:linear-gradient(#C9F7C0,#7BD67A)}
.bc-qte.miss .bc-qte-key{background:linear-gradient(#FFB3AA,#FF6B5A)}
.bc-qte.ok .bc-qte-track,.bc-qte.miss .bc-qte-track{visibility:hidden}
.bc-cue{font-weight:700;font-size:56px;color:#FFE08A;white-space:nowrap;
  text-shadow:0 4px 0 ${INK},3px 0 0 ${INK},-3px 0 0 ${INK},0 -3px 0 ${INK}}
.bc-cue.go{color:#9BE39A;font-size:72px}
.bc-name{position:absolute;top:-30px;background:#FFC23D;border:3px solid ${INK};color:${INK};font-weight:700;font-size:16px;
  padding:1px 12px;box-shadow:0 3px 0 rgba(59,36,22,.35)}
.bc-text{flex:1;min-width:0;background:#F8EED2;border:3px solid ${INK};padding:10px 16px 6px;display:flex;flex-direction:column}
.bc-text p{line-height:1.6;font-weight:600;color:${INK};margin:0;flex:1}
.bc-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#6A4A30;font-size:12px;font-weight:600}
.bc-next{font-size:14px;color:${INK};animation:bcNudge .6s ease-in-out infinite alternate}
@keyframes bcNudge{to{transform:translateY(3px)}}
`;
if (typeof document !== 'undefined' && !document.getElementById('boss-chase-css')) {
  const s = document.createElement('style'); s.id = 'boss-chase-css'; s.textContent = CSS; document.head.appendChild(s);
}

// ── Dialogue box: the boss's half-body portrait stands on the right, much bigger than the box ──
// Drawn on document.body (fixed), lined up with the typing area `rect` — the typing area sits in a scrolling panel
// that would clip the portrait (or grow a scrollbar).
// Layout = what the teacher placed by hand in the mock (?layout, 2nd round, Nov 2026; typing area 864×568):
//   it spills OUT of the game's frame — the box starts 189 px left of the typing area, ends 83 px in from its right
//   and 52 px below its bottom (970×204 there); the portrait ×5 sticks out 270 px past the right and 125 px below the
//   bottom; later: its lowest painted row pinned to the screen's bottom edge (no floating), the name tag big and right up
//   against the boss's painting (otherwise 43 px in from the box's right end), above the box.
//   The lab screens have little room under the game, so the box is held above the screen's bottom edge and the
//   portrait inside its width (the portrait keeps its place against the box).
function BossTalk({ boss, talk, big, rect }) {
  const sc = 5, pf = sc * 96, ph = sc * 128;         // 96×128 art at ×5
  const bh = 204;
  const line = talk.lines[talk.i];
  const done = talk.shown >= talk.g.length;
  const r = rect || { left: 12, width: Math.min(880, innerWidth - 24), bottom: innerHeight - 12 };
  const right = r.left + r.width;
  const bx = Math.max(8, r.left - 189), bRight = right - 83, bw = bRight - bx;
  const bBottom = Math.min(r.bottom + 52, innerHeight - 6), by = bBottom - bh;
  // the boss's lowest painted row sits exactly on the screen's bottom edge (never floating above it)
  const art = boss.faceArt || { right: 95, bottom: 127 };
  const fRight = Math.min(right + 270, innerWidth - 4), fx = fRight - pf, fy = innerHeight - (art.bottom + 1) * sc;
  const artLeft = fx + (95 - art.right) * sc;        // where the (mirrored) painting starts on screen
  const under = Math.max(0, bRight - artLeft);       // keep the text out from under the boss
  return (
    <div className="bc-dlg" role="dialog" aria-modal="true" aria-label={boss.name + 'พูด'} onClick={talk.next}>
      <div className="px-wood bc-box" style={{ left: bx, width: bw, top: by, height: bh }}>
        <div className="bc-text" style={{ fontFamily: TH_FONT, paddingRight: 16 + under }}>
          <p style={{ fontSize: big ? 28 : 24 }}>{talk.g.slice(0, Math.floor(talk.shown)).join('')}</p>
          <div className="bc-foot"><small>กด Enter หรือคลิกเพื่อไปต่อ</small>
            <span className="bc-next" style={{ visibility: done ? 'visible' : 'hidden' }}>▼</span></div>
        </div>
      </div>
      {/* measured from the box's outer edge (not inside its wooden border) */}
      {/* name tag: big, right up against the boss's painting but never under it */}
      <div className="bc-name" style={{ right: innerWidth - Math.min(bRight - 43, artLeft - 6), top: by - (big ? 40 : 34),
        fontFamily: TH_FONT, fontSize: big ? 26 : 22, padding: big ? '3px 20px' : '2px 16px', zIndex: 3, animation: 'bcFade .22s ease-out' }}>{boss.name}</div>
      <img className="bc-face" src={boss.dir + boss.faces[line.face]} alt=""
        style={{ left: fx, top: fy, width: pf, height: ph }}/>
    </div>
  );
}

// props: boss (bosses.js), world (lanes.js), cfg (character), height (lane px), big (tall screen),
//   total (secs), target (stage wpm), net (stage 9 net words), startTime, endTime, keys (correct keypresses),
//   pos, errors, overlay (element the dialogue covers), onTalking(bool: typing must wait), onRage(bool),
//   onPause(ms: a QTE window to take off the clock), onBoost(score multiplier: 1 / 2…5), onDone()
export function BossChase(props) {
  const { boss, world, cfg, height, big } = props;
  const live = useRef(props); live.current = props;
  const wrapRef = useRef(null), sceneRef = useRef(null), actorsRef = useRef(null);
  const heroRef = useRef(null), bossRef = useRef(null), chestRef = useRef(null), fxRef = useRef(null);
  const clockRef = useRef(null), fillRef = useRef(null), accRef = useRef(null), rageRef = useRef(null), linesRef = useRef(null);
  const [heroAnim, setHeroAnim] = useState('idle');
  const [talk, setTalk] = useState(null);
  const [qteView, setQteView] = useState(null);        // null | 'on' | 'ok' | 'miss'
  const [cue, setCue] = useState(null);                // { text, go } — "พร้อม…" / "เริ่ม!"
  const qteBarRef = useRef(null);
  const stompRef = useRef(null), stompNRef = useRef(null), multRef = useRef(null), multTxtRef = useRef(null), multBarRef = useRef(null), tick2Ref = useRef(null);
  const [host, setHost] = useState(null);
  const talkRef = useRef(null);
  const S = useRef(null);

  // Keypresses arrive as new prop values: note when the last correct key and the last mistake happened.
  const seen = useRef({ keys: props.keys, errors: props.errors });
  if (props.keys !== seen.current.keys || props.errors !== seen.current.errors) {
    const st = S.current, t = performance.now() / 1000;
    if (st) {
      if (props.keys > seen.current.keys) { st.lastOk = t; st.hist.push(t); }
      if (props.errors > seen.current.errors) st.lastErr = t;
    }
    seen.current = { keys: props.keys, errors: props.errors };
  }

  // ── dialogue ──
  function say(lines, done) {
    const t = { lines, i: 0, g: graphemes(lines[0].text), shown: 0, done };
    t.next = next;
    talkRef.current = t; setTalk({ ...t });
    live.current.onTalking && live.current.onTalking(true);
  }
  function next() {
    const t = talkRef.current; if (!t) return;
    if (t.shown < t.g.length) { t.shown = t.g.length; setTalk({ ...t }); return; }   // first press finishes the line
    if (t.i + 1 < t.lines.length) { t.i++; t.g = graphemes(t.lines[t.i].text); t.shown = 0; setTalk({ ...t }); sfx('ui'); return; }
    talkRef.current = null; setTalk(null);
    // typing is released by the scene loop on a later frame (so the key that closed the box is not also typed)
    if (t.done) t.done();
  }
  useEffect(() => {
    if (!talk || talk.shown >= talk.g.length) return;
    const id = setInterval(() => {
      const t = talkRef.current; if (!t) return;
      t.shown = Math.min(t.g.length, t.shown + 1); setTalk({ ...t });
      if (t.shown >= t.g.length) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [talk && talk.i, talk && talk.lines]);
  useEffect(() => {
    const onKey = e => {
      if (talkRef.current) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } return; }
      const st = S.current;
      if (st && st.qte && e.key === ' ' && !e.repeat) { e.preventDefault(); st.dodge(); }   // QTE: Space = jump (App types nothing meanwhile)
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // where the dialogue box goes: the typing area's spot on screen, kept in step with resizes
  useEffect(() => {
    if (!talk) return;
    const upd = () => { const el = live.current.overlay && live.current.overlay.current; setHost(el ? el.getBoundingClientRect() : null); };
    upd(); window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [!!talk]);

  // ── the scene ──
  useEffect(() => {
    let alive = true, raf = 0;
    const st = S.current = {
      // intro (boss talks, off screen) → dash (runs in from behind and overtakes to the far end) → go ("พร้อม… เริ่ม!")
      // → ready (typing open) → chase (clock running) → end
      phase: 'intro', heroX: 70, heroY: 0, bossX: -boss.w, bossFlip: false, bossHide: false, squash: 1,
      chest: 'carried', chestX: 0, chestY: 0, chestVX: 0, chestVY: 0, obs: [], nextObs: 8, trip: 0, jump: null,
      qte: null, owe: 0, oweStart: 0, block: null, taunted: false,
      laps: 0, lapBase: 0, lapNeed: 0, newLap: false, mult: 1, boostUntil: 0, boosted: false, stomp: null, flash: 0,
      end: null, endAt: 0, hold: false, talked: false, boom: false, finished: false, parts: [], bubbles: [],
      lastOk: -9e9, lastErr: -9e9, hist: [], cam: 0, vel: 0, legT: 0, now: 0, rage: false,
    };
    const lay = (world && world.layers || []).map(l => {
      const el = document.createElement(l.x == null ? 'div' : 'img');
      el.style.cssText = 'position:absolute;left:0;image-rendering:pixelated;will-change:transform;height:' + l.h + 'px;bottom:' + (l.y || 0) + 'px';
      if (l.x == null) { el.style.backgroundImage = 'url(' + l.src + ')'; el.style.backgroundRepeat = 'repeat-x'; el.style.width = '4000px'; }
      else { el.src = l.src; if (l.w) el.style.width = l.w + 'px'; }
      sceneRef.current.appendChild(el); return { l, el };
    });
    const rock = pixelArt(ROCK, 2, ROCK_PAL);
    const bossCv = document.createElement('canvas'); bossCv.width = boss.w; bossCv.height = boss.h;
    bossRef.current.appendChild(bossCv);
    const bg = bossCv.getContext('2d'); bg.imageSmoothingEnabled = false;
    let run = null, runChest = null, chestImg = null;
    Promise.all([loadImg(boss.dir + boss.run), loadImg(boss.dir + boss.runChest), loadImg(boss.dir + boss.chest)])
      .then(([a, b, c]) => { run = a; runChest = b; chestImg = c; if (c && chestRef.current) chestRef.current.appendChild(c); });
    // the portraits are big: fetch them now so the dialogue never shows an empty frame
    Object.values(boss.faces).forEach(f => loadImg(boss.dir + f));

    function bubble(text, ms = 1100) {
      st.bubbles = st.bubbles.filter(o => (o.el.remove(), false));     // one at a time
      const b = document.createElement('div'); b.className = 'bc-bubble'; b.textContent = text; actorsRef.current.appendChild(b);
      st.bubbles.push({ el: b, until: st.now + ms / 1000 });
    }
    st.bubble = bubble;
    const setHero = a => { if (st.heroAnim !== a) { st.heroAnim = a; setHeroAnim(a); } };

    function burst(cx, cy) {
      const d = bg.getImageData(0, 0, boss.w, boss.h).data;
      for (let j = 0; j < boss.h; j += 2) for (let i = 0; i < boss.w; i += 2) {
        const k = (j * boss.w + i) * 4; if (d[k + 3] < 10) continue;
        st.parts.push({ x: cx - boss.w / 2 + i, y: cy - boss.h / 2 + j, vx: (i - boss.w / 2) * 3 + (Math.random() - .5) * 120,
          vy: -150 - Math.random() * 260, s: 2, c: 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')', life: .8 + Math.random() * .6 });
      }
    }

    function finish() {
      const p = live.current;
      const mins = (p.endTime - p.startTime) / 60000;
      const acc = (p.pos + p.errors) > 0 ? Math.round(p.pos / (p.pos + p.errors) * 100) : 100;
      const wpm = mins > 0 ? (p.net ? Math.max(0, p.keys / 4 - p.errors) : p.keys / 4) / mins : 0;
      const stars = p.startTime ? lessonStars(wpm, acc, p.target) : 0;
      st.phase = 'end'; st.end = stars; st.endAt = st.now; st.obs = []; st.vel = 0;
      if (st.qte) { st.qte = null; setQteView(null); }
      if (st.stomp) { st.stomp = null; st.squash = 1; st.heroY = 0; setCue(null); }
      if (st.boosted) { st.boosted = false; st.boostUntil = 0; p.onBoost && p.onBoost(1); }
      const W = wrapRef.current.clientWidth;
      if (stars === 3) {
        st.bossX = Math.min(st.bossX, W * .62); st.hold = true;
        say(boss.lines.caught, () => { st.hold = false; st.endAt = st.now; });
      }
    }
    const done = () => { if (!st.finished) { st.finished = true; live.current.onDone && live.current.onDone(); } };

    // ── rock QTE: Space within the window = jump; the clock stands still for the whole window ──
    const QTE_AT = 230, QTE_SECS = 1.3;               // px from the hero when it starts · window length
    // stomp reward: ×2 score for 15 s; another stomp while it lasts adds +1 (up to ×5). 15 s lets a very fast typist
    // (~6× the stage pace, ~12 s a lap at ×2) stack it; each higher step needs more speed.
    const BOOST_SECS = 15;
    let qteTimer = 0;
    function endQte(result) {
      const q = st.qte; if (!q) return;
      st.qte = null;
      st.owe += Date.now() - q.wall0; st.oweStart = live.current.startTime;
      live.current.onPause && live.current.onPause(Date.now() - q.wall0);   // App moves startTime on by the window
      setQteView(result); clearTimeout(qteTimer); qteTimer = setTimeout(() => setQteView(null), 650);
    }
    st.dodge = () => {
      if (!st.qte) return;
      st.qte.o.state = 'past'; endQte('ok');
      st.jump = { t: 0, len: .55, hgt: (height < 90 ? 30 : 34) + 6 }; sfx('jump');
    };
    function showCue(text, isGo) { setCue({ text, go: isGo }); sfx(isGo ? 'go' : 'count'); }

    let last = performance.now();
    function loop(t) {
      if (!alive) return;
      const dt = Math.min(.25, (t - last) / 1000); last = t; st.now = t / 1000;
      const p = live.current, wrap = wrapRef.current;
      const W = wrap.clientWidth, H = wrap.clientHeight, ground = H - 9;   // inside the border
      const total = p.total, K3 = p.target * 1.5 * 4 * total / 60, K2 = K3 / 1.5;
      const eff = p.net ? Math.max(0, p.keys - 4 * p.errors) : p.keys;
      const prog = K3 > 0 ? eff / K3 : 0;
      const acc = (p.pos + p.errors) > 0 ? Math.round(p.pos / (p.pos + p.errors) * 100) : 100;
      // laps: the 1st catch = the ⭐⭐⭐ amount; after a stomp the boar runs back to the start and the next catch needs
      // ½ / ¾ / 1 / 1¼ of it, by the multiplier still running (×≤2 / ×3 / ×4 / ×5) — fixed per lap so the bar never jumps
      const need = st.laps ? st.lapNeed : K3;
      const lapRaw = need > 0 ? (eff - st.lapBase) / need : 0;
      const pEff = acc < 90 ? Math.min(lapRaw, .35) : acc < 95 ? Math.min(lapRaw, .9) : Math.min(lapRaw, 1);
      // QTE time owed to the clock: the open window, plus a finished one App hasn't moved startTime for yet
      if (p.startTime !== st.oweStart) st.owe = 0;
      const pending = st.owe + (st.qte ? Date.now() - st.qte.wall0 : 0);
      const ran = p.startTime ? ((p.endTime || Date.now()) - p.startTime - (p.endTime ? 0 : pending)) / 1000 : 0;
      const timeLeft = p.startTime ? Math.max(0, total - ran) : total;

      if (st.phase === 'ready' && p.startTime) st.phase = 'chase';
      if ((st.phase === 'chase' || st.phase === 'ready') && p.endTime) finish();

      // typing waits while the boss talks, while it dashes off, until "เริ่ม!", and during a QTE
      const block = !!talkRef.current || st.phase === 'intro' || st.phase === 'dash' || st.phase === 'go' || !!st.qte;
      if (block !== st.block) { st.block = block; p.onTalking && p.onTalking(block); }

      // start: dash → "พร้อม…" → "เริ่ม!" → typing
      if (st.phase === 'go') {
        const g = st.now - st.goAt;
        if (g > .9 && !st.saidGo) { st.saidGo = true; showCue('เริ่ม!', true); }
        if (g > 1.3) { st.phase = 'ready'; setTimeout(() => setCue(null), 400); }
      }

      const rage = st.phase === 'chase' && (prog >= 2 / 3 || timeLeft <= 30);
      if (rage !== st.rage) { st.rage = rage; p.onRage && p.onRage(rage); }   // App → setRage (plays the rage sting)
      const sec = Math.ceil(timeLeft);
      clockRef.current.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      clockRef.current.classList.toggle('hot', st.phase === 'chase' && timeLeft <= 30);
      rageRef.current.style.opacity = rage ? 1 : 0; linesRef.current.style.opacity = rage ? .8 : 0;
      fillRef.current.style.width = (100 * Math.min(1, pEff)) + '%';
      fillRef.current.classList.toggle('cap', acc < 95 && lapRaw > pEff);

      // ── caught before time's up → one stomp (the boar runs back to the start) + a short score multiplier ──
      if (st.phase === 'chase' && !st.stomp && !st.qte && pEff >= 1) {
        const boosting = st.boostUntil > st.now;
        st.stomp = { t: 0 }; st.laps++; st.lapBase = eff; st.lapNeed = K3; st.newLap = true;
        st.mult = boosting ? Math.min(5, st.mult + 1) : 2; st.boostUntil = st.now + BOOST_SECS; st.boosted = true;
        p.onBoost && p.onBoost(st.mult);
        multRef.current.classList.remove('pop'); void multRef.current.offsetWidth; multRef.current.classList.add('pop');
        if (st.laps === 1) tick2Ref.current.classList.add('dim');
      }
      if (st.laps && st.newLap && !st.stomp) {         // the boar is back at the start: fix this lap's length
        const m = st.boostUntil > st.now ? st.mult : 1;
        st.lapNeed = K3 * Math.max(.5, .25 * m); st.lapBase = eff; st.newLap = false;
      }
      if (st.boosted && st.boostUntil <= st.now) { st.boosted = false; p.onBoost && p.onBoost(1); }
      // same chips in the same places all the time — only numbers / brightness change
      const boostOn = st.boostUntil > st.now;
      multRef.current.classList.toggle('off', !boostOn);
      multTxtRef.current.textContent = '×' + (boostOn ? st.mult : 1);
      multBarRef.current.style.width = boostOn ? 'calc(' + (100 * (st.boostUntil - st.now) / BOOST_SECS).toFixed(1) + '% - 6px)' : '0';
      stompRef.current.classList.toggle('off', !st.laps); stompNRef.current.textContent = String(st.laps);
      accRef.current.textContent = (acc < 90 ? '⚠ ' : '') + 'แม่น ' + acc + '%';
      accRef.current.className = 'bc-chip bc-acc ' + (acc >= 95 ? 'ok' : acc >= 90 ? 'mid' : 'bad');

      // running speed follows typing, judged by the stage's own ⭐⭐⭐ pace (stage 1 is only ~0.5 keys a second)
      const pace = Math.max(.2, K3 / total), okGap = 1.6 / pace, now = performance.now() / 1000;
      st.hist = st.hist.filter(x => now - x < 4);
      const typing = now - st.lastOk < okGap;
      const rate = st.hist.length / 4 / pace;
      if (st.phase === 'chase') st.vel += ((typing && !st.trip ? 90 + 80 * Math.min(1.5, rate) : 0) * (st.qte ? .25 : 1) - st.vel) * Math.min(1, dt * 3);
      else if (st.phase !== 'end') st.vel = 0;
      st.cam += st.vel * dt;
      lay.forEach(({ l, el }) => {
        const off = st.cam * l.speed;
        el.style.transform = 'translate3d(' + (l.x == null ? -(off % l.w) : l.x - off).toFixed(1) + 'px,0,0)' + (l.flip ? ' scaleX(-1)' : '');
      });

      // boss distance = progress (held back by accuracy); off screen while it talks, then it dashes in
      const bw = boss.w, bh = boss.h;
      if (st.phase !== 'end') {
        const far = W - bw / 2 - 12, near = st.heroX + 40 + bw / 2;
        let want = st.phase === 'chase' ? far + (near - far) * pEff : st.phase === 'intro' ? -bw : far;
        if (st.phase === 'chase' && acc < 95 && lapRaw > pEff) want += Math.sin(st.now * 6) * 6;
        if (st.stomp) {                                // the stomp drives the boar itself (below)
        } else if (st.phase === 'dash') {                     // runs in from behind the hero, overtakes, stops at the far end
          st.bossX = Math.min(far, st.bossX + 620 * dt);
          if (st.bossX > st.heroX + 60 && !st.taunted) { st.taunted = true; bubble(boss.taunts.start, 1600); }
          if (st.bossX >= far) { st.phase = 'go'; st.goAt = st.now; showCue('พร้อม…', false); }
        } else st.bossX += (want - st.bossX) * Math.min(1, dt * 2.5);
      }

      // rocks: one at a time — first ~8 s in, then every 15–20 s (≈10 s in rage); none in the last 5 s
      // (thrown even when the boss is close, so a fast typist still gets the QTE)
      const chaseSecs = ran;
      if (st.phase === 'chase' && !st.stomp && p.startTime && chaseSecs > st.nextObs && timeLeft > 5 && st.bossX - st.heroX > 70
          && !st.obs.some(o => o.state === 'roll')) {
        st.obs.push({ x: st.bossX - bw / 2, rot: 0, state: 'roll', vy: 0, y: 0 });
        st.nextObs = chaseSecs + (rage ? 9 + Math.random() * 2 : 15 + Math.random() * 5);
        bubble(rage ? boss.taunts.throwRage : boss.taunts.throw, 700);
      }
      if (st.qte) st.qte.t += dt;
      st.obs.forEach(o => {
        if (o.state === 'roll' && !o.qte) {
          o.x -= (st.vel + 110) * dt; o.rot -= (st.vel + 110) * dt / 8;
          // close: QTE — the scene slows down and the rock reaches the hero exactly as the window closes
          if (o.x - st.heroX < QTE_AT && !st.trip && st.phase === 'chase') {
            o.x = Math.max(o.x, st.heroX + 120);       // a long frame must never carry it past the hero first
            o.qte = true; st.qte = { o, t: 0, len: QTE_SECS, from: o.x, wall0: Date.now() }; setQteView('on'); sfx('qte');
          }
        } else if (o.state === 'roll') {
          const k = st.qte ? Math.min(1, st.qte.t / st.qte.len) : 1;
          o.x = (st.qte ? st.qte.from : o.x) - ((st.qte ? st.qte.from : o.x) - (st.heroX + 8)) * k; o.rot -= dt * 4;
          if (k >= 1) {                                // too late: trip (only a look — nothing is taken off)
            o.state = 'hit'; o.vy = -120; st.trip = .7; endQte('miss');
            bubble(boss.taunts.laugh, 900); sfx('trip'); setTimeout(() => sfx('laugh'), 180);
          }
        } else if (o.state === 'hit') { o.x -= 60 * dt; o.vy += 500 * dt; o.y += o.vy * dt; if (o.y > 0) { o.y = 0; o.vy = 0; } }
        else o.x -= (st.vel + 110) * dt;
      });
      if (st.qte && qteBarRef.current) qteBarRef.current.style.width = (100 * (1 - st.qte.t / st.qte.len)) + '%';
      st.obs = st.obs.filter(o => o.x > -40 || (st.qte && st.qte.o === o));   // never drop the rock of an open QTE
      if (st.jump) { st.jump.t += dt; const k = st.jump.t / st.jump.len; st.heroY = k >= 1 ? 0 : 4 * st.jump.hgt * k * (1 - k); if (k >= 1) st.jump = null; }
      if (st.trip > 0) st.trip = Math.max(0, st.trip - dt);

      // stomp: run up → jump on its head → THUMP ("เหยียบ! ×2") → bounce back home while the boar runs back to the start
      if (st.stomp && st.phase === 'chase') {
        const s = st.stomp, far = W - bw / 2 - 12, jumpH = height < 90 ? 30 : 34; s.t += dt;
        if (s.t < .4) { st.heroX += ((st.bossX - bw * .55) - st.heroX) * Math.min(1, dt * 9); st.heroY = 0; }
        else if (s.t < .8) { const k = (s.t - .4) / .4; st.heroX += (st.bossX - st.heroX) * Math.min(1, dt * 10);
          st.heroY = (bh * .75 + jumpH) * Math.sin(k * Math.PI * .5) * (k < .7 ? 1 : 1 - (k - .7) * 1.3); }
        else if (!s.hit) {
          s.hit = true; s.x1 = st.heroX; st.flash = .15; st.squash = .6;
          showCue('เหยียบ! ×' + st.mult, true); sfx('stomp'); setTimeout(() => sfx('combo', 2), 120);
          bubble(boss.taunts.stomped || 'อ๊าก!!', 900);
          for (let i = 0; i < 14; i++) st.parts.push({ x: st.bossX, y: ground - bh * .9, vx: (Math.random() - .5) * 260,
            vy: -120 - Math.random() * 200, s: 3, c: Math.random() < .5 ? '#FFFFFF' : '#FFE08A', life: .4 + Math.random() * .3 });
        } else {
          const k = Math.min(1, (s.t - .8) / .7);
          st.heroX = s.x1 + (70 - s.x1) * k; st.heroY = Math.max(0, 50 * Math.sin(k * Math.PI) * (1 - k));   // bounces back home
          if (s.t > 1) st.squash = 1;
          if (s.t > 1.05) st.bossX = Math.min(far, st.bossX + 700 * dt);                                 // runs back to the start
          if (s.t > 1.15 && s.t < 1.2) setCue(null);
          if (k >= 1 && st.bossX >= far) { st.stomp = null; st.heroX = 70; st.heroY = 0; st.squash = 1; }
        }
      }
      if (st.flash > 0) st.flash = Math.max(0, st.flash - dt);

      // endings
      if (st.phase === 'end' && st.hold) { st.endAt = st.now; setHero('idle'); }
      else if (st.phase === 'end') {
        const e = st.now - st.endAt, gone = st.bossX - bw / 2 > W;
        if (st.end === 3) {
          if (e < .8) { st.heroX += ((st.bossX - bw * .55) - st.heroX) * Math.min(1, dt * 5); setHero('run'); }
          else if (e < 1.35) { const k = (e - .8) / .55; st.heroX += (st.bossX - st.heroX) * Math.min(1, dt * 8);
            st.heroY = (bh * .8 + 30) * Math.sin(Math.min(1, k) * Math.PI * .5) * (k < .6 ? 1 : 1 - (k - .6) * 1.2); }
          else if (!st.boom) { st.boom = true; burst(st.bossX, ground - bh * .45); st.bossHide = true; sfx('stomp');
            st.chest = 'fly'; st.chestVX = -90; st.chestVY = -260; st.chestX = st.bossX; st.chestY = bh * .9; setTimeout(() => sfx('chest'), 700); }
          if (e >= 1.35) st.heroY = Math.max(0, st.heroY - 260 * dt);
          if (e > 1.7) setHero('cheer');
          if (e > 3.2) done();
        } else if (st.end >= 1) {
          if (e < .05 && !st.yelp) { st.yelp = true; bubble('!', 500); }
          if (e > .35 && st.chest === 'carried') { st.chest = 'fly'; st.chestX = st.bossX - bw * .1; st.chestY = bh * .9; st.chestVX = -40; st.chestVY = -60; }
          if (e > .7 && !gone) st.bossX += 260 * dt;
          if (e > .7) { const tx = st.chestX - 46; if (st.heroX < tx - 2) { st.heroX += 150 * dt; setHero('run'); } else setHero('cheer'); }
          if (e > 1.1 && !st.got) { st.got = true; sfx('chest'); }
          if (gone && !st.talked) { st.talked = true; say(boss.lines.escaped, () => setTimeout(done, 400)); }
        } else {
          if (e < .05 && !st.yelp) { st.yelp = true; bubble(boss.taunts.laugh, 900); sfx('laugh'); }
          if (e > .3) setHero('sad');
          if (e > .9 && !gone) st.bossX += 230 * dt;
          if (gone && !st.talked) { st.talked = true; say(boss.lines.won, () => setTimeout(done, 400)); }
        }
      }
      if (st.chest === 'fly') {
        st.chestVY += 700 * dt; st.chestX += st.chestVX * dt; st.chestY -= st.chestVY * dt;
        if (st.chestY <= 0) { st.chestY = 0; if (Math.abs(st.chestVY) > 120) st.chestVY = -st.chestVY * .35; else st.chest = 'ground'; st.chestVX *= .5; }
      }

      // ── draw ──
      if (['intro', 'dash', 'go', 'ready'].includes(st.phase)) setHero('idle');
      else if (st.phase === 'chase') setHero(st.stomp ? (st.stomp.hit ? 'cheer' : 'run') : st.trip ? 'sad' : st.vel > 25 ? 'run' : 'idle');
      const hc = heroRef.current.firstChild, hw = hc ? hc.width : 52, hh = hc ? hc.height : 62;
      const shake = st.trip ? Math.sin(st.now * 50) * 2 : 0;
      heroRef.current.style.transform = 'translate(' + (st.heroX - hw / 2 + shake).toFixed(1) + 'px,' + (ground - hh - st.heroY).toFixed(1) + 'px)';
      heroRef.current.style.filter = st.trip > .5 ? 'brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4)' : '';

      const moving = st.phase === 'chase' || st.phase === 'dash' || (st.phase === 'end' && !st.hold && st.end !== 3);
      if (moving) st.legT += dt * boss.fps;
      const carried = st.chest === 'carried', strip = carried ? runChest : run;
      bg.clearRect(0, 0, boss.w, boss.h);
      if (strip) bg.drawImage(strip, (Math.floor(st.legT) % boss.frames) * boss.w, 0, boss.w, boss.h, 0, 0, boss.w, boss.h);
      const laughing = st.bubbles.some(b => /ฮ่า/.test(b.el.textContent)) ? Math.abs(Math.sin(st.now * 18)) * 6 : 0;
      bossRef.current.style.display = st.bossHide ? 'none' : '';
      const sq = st.squash || 1;                       // squashed for a moment when stomped (feet stay on the ground)
      bossRef.current.style.transform = 'translate(' + (st.bossX - bw / 2).toFixed(1) + 'px,' + (ground - bh * sq - laughing).toFixed(1) + 'px)'
        + (st.bossFlip ? ' scaleX(-1)' : '') + (sq !== 1 ? ' scaleY(' + sq + ')' : '');
      bossRef.current.style.transformOrigin = 'top left';
      bossRef.current.style.filter = st.flash > 0 ? 'brightness(2.2)'
        : rage ? 'saturate(1.5) drop-shadow(0 0 ' + (2 + Math.round(Math.abs(Math.sin(st.now * 8)) * 3)) + 'px #FF2A1A)' : '';

      const cw = chestImg ? chestImg.width : 24, ch = chestImg ? chestImg.height : 24;
      chestRef.current.style.display = carried ? 'none' : '';
      chestRef.current.style.transform = 'translate(' + (st.chestX - cw / 2).toFixed(1) + 'px,' + (ground - ch - st.chestY).toFixed(1) + 'px)';

      const fx = fxRef.current;
      if (fx.width !== W) { fx.width = W; fx.height = H + 80; }
      const g = fx.getContext('2d'); g.clearRect(0, 0, fx.width, fx.height); g.imageSmoothingEnabled = false;
      st.obs.forEach(o => { g.save(); g.translate(o.x, 80 + ground - rock.height / 2 - o.y); g.rotate(o.rot); g.drawImage(rock, -rock.width / 2, -rock.height / 2); g.restore(); });
      st.parts = st.parts.filter(q => (q.life -= dt) > 0);
      st.parts.forEach(q => { q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; g.globalAlpha = Math.min(1, q.life * 2); g.fillStyle = q.c; g.fillRect(q.x, 80 + q.y, q.s, q.s); });
      g.globalAlpha = 1;

      st.bubbles = st.bubbles.filter(b => { if (st.now > b.until) { b.el.remove(); return false; } return true; });
      st.bubbles.forEach(b => { b.el.style.left = Math.min(W - 60, st.bossX + bw * .15) + 'px'; b.el.style.top = (ground - bh - 4) + 'px'; });
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // The boss talks first; the clock only starts at the first key, which the dialogue holds back.
    // after it talks, the boss dashes in and overtakes; typing opens after "พร้อม… เริ่ม!"
    if (!live.current.startTime) say(boss.lines.intro, () => { st.phase = 'dash'; });
    else { st.phase = 'ready'; st.bossX = wrapRef.current.clientWidth - boss.w / 2 - 12; }

    return () => {
      alive = false; cancelAnimationFrame(raf);
      lay.forEach(({ el }) => el.remove()); bossCv.remove();
      st.bubbles.forEach(b => b.el.remove());
      const p = live.current;
      clearTimeout(qteTimer);
      if (talkRef.current || st.block) { talkRef.current = null; p.onTalking && p.onTalking(false); }
      if (st.rage) p.onRage && p.onRage(false);
      if (st.boosted) p.onBoost && p.onBoost(1);
    };
  }, [boss]);

  const K2pct = 100 / 1.5;
  return (
    <div ref={wrapRef} style={{ position: 'relative', height, border: '3px solid ' + INK, flex: 'none', boxSizing: 'border-box', fontFamily: TH_FONT }}>
      <div ref={sceneRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: world ? world.sky : '#8ED4E4' }}/>
      <div ref={linesRef} className="bc-lines"/>
      <div ref={rageRef} className="bc-rage"/>
      <div className="bc-top">
        <span ref={clockRef} className="bc-chip bc-clock">0:00</span>
        <div className="bc-bar" aria-label="ระยะห่างกับบอส">
          <div ref={fillRef} className="bc-fill"/>
          <div ref={tick2Ref} className="bc-tick" style={{ left: 'calc(' + K2pct + '% - 1px)' }}><span>⭐⭐</span></div>
          <div className="bc-tick" style={{ left: 'calc(100% - 3px)' }}>
            <span style={{ left: 'auto', right: 5 }}>⭐⭐⭐ <img src={boss.dir + boss.head} alt="" className="bc-head end"/></span></div>
        </div>
        {/* always there, fixed width, so the strip never shifts — dim = nothing yet */}
        <span ref={stompRef} className="bc-chip bc-stat bc-stomps off" title={'เหยียบ' + boss.name + 'กี่ครั้ง'}>
          <img src={boss.dir + boss.head} alt="" className="bc-head"/><b ref={stompNRef} style={{ fontFamily: PX_FONT }}>0</b></span>
        <span ref={multRef} className="bc-chip bc-stat bc-mult off" title="ตัวคูณคะแนน (แถบล่าง = เวลาที่เหลือ)" style={{ fontFamily: PX_FONT }}>
          <b ref={multTxtRef}>×1</b><i ref={multBarRef}/></span>
        <span ref={accRef} className="bc-chip bc-acc ok">แม่น 100%</span>
      </div>
      {/* actors: clipped at the scene's left/right edges, free to rise above it (jumps, stomp, flying chest) */}
      <div ref={actorsRef} style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', clipPath: 'inset(-140px 0 0 0)' }}>
        <div ref={bossRef} className="bc-spr" style={{ zIndex: 5 }}/>
        <div ref={chestRef} className="bc-spr" style={{ zIndex: 6 }}/>
        <div ref={heroRef} className="bc-spr" style={{ zIndex: 7 }}>
          {window.CharKit && <CharKit.CharCanvas config={cfg} anim={heroAnim} scale={1} speed={heroAnim === 'run' ? 1.4 : 1}/>}
        </div>
        <canvas ref={fxRef} style={{ position: 'absolute', left: 0, top: -80, pointerEvents: 'none', zIndex: 8 }}/>
      </div>
      {/* rock QTE: a big Space key over the bottom of the scene and the top of the text; the bar runs out with the window */}
      <div className={'bc-qte' + (qteView ? ' show ' + qteView : '')} style={{ top: height + 30 }} aria-live="assertive">
        <div className="bc-qte-key" style={{ fontFamily: PX_FONT }}>SPACE</div>
        <div className="bc-qte-word">{qteView === 'ok' ? 'เยี่ยม!' : qteView === 'miss' ? 'โอ๊ะ!' : 'กดเพื่อกระโดดหลบ!'}</div>
        <div className="bc-qte-track"><div ref={qteBarRef} className="bc-qte-bar"/></div>
      </div>
      <div className={'bc-cue' + (cue ? ' show' + (cue.go ? ' go' : '') : '')} style={{ top: height + 30 }} aria-live="assertive">{cue && cue.text}</div>
      {talk && ReactDOM.createPortal(<BossTalk boss={boss} talk={talk} big={big} rect={host}/>, document.body)}
    </div>
  );
}
