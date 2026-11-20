// ═══════════════════════════════════════════════════════════════
// BOSS CHASE — the timed (last) step of a stage's boss lesson.
//   The boss (src/data/bosses.js) stole the treasure chest and runs; the student types to catch up.
//   • Distance = the real star formula: correct keys (Shift = 1 key, like pressCountRef) against
//     target × 1.5 × 4 × minutes (⭐⭐⭐), with a mark at 2/3 of it (⭐⭐). Net steps (stage 9) take 4 keys off per error.
//   • Accuracy: under 95 % the boss can't be caught (⭐⭐⭐ needs 95 %), under 90 % it pulls far ahead (0 stars).
//   • The boss throws rocks back; typing steadily = the hero jumps them by itself, a fresh mistake or a pause = trips
//     (only a look — nothing is taken off).
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
//   bottom (73 px below the box; its waist cut goes off the screen); name tag 43 px in from the box's right end, 27 px above it.
//   The lab screens have little room under the game, so the box is held above the screen's bottom edge and the
//   portrait inside its width (the portrait keeps its place against the box).
function BossTalk({ boss, talk, big, rect }) {
  const pf = 5 * 96, ph = pf * 4 / 3;                // 96×128 art at ×5
  const bh = 204;
  const line = talk.lines[talk.i];
  const done = talk.shown >= talk.g.length;
  const r = rect || { left: 12, width: Math.min(880, innerWidth - 24), bottom: innerHeight - 12 };
  const right = r.left + r.width;
  const bx = Math.max(8, r.left - 189), bRight = right - 83, bw = bRight - bx;
  const bBottom = Math.min(r.bottom + 52, innerHeight - 6), by = bBottom - bh;
  const fRight = Math.min(right + 270, innerWidth - 4), fx = fRight - pf, fy = bBottom + 73 - ph;
  const under = Math.max(0, bRight - fx - 60);       // keep the text out from under the portrait (its left edge is mostly empty)
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
      <div className="bc-name" style={{ right: innerWidth - bRight + 43, top: by - 27, fontFamily: TH_FONT, zIndex: 1, animation: 'bcFade .22s ease-out' }}>{boss.name}</div>
      <img className="bc-face" src={boss.dir + boss.faces[line.face]} alt=""
        style={{ left: fx, top: fy, width: pf, height: ph }}/>
    </div>
  );
}

// props: boss (bosses.js), world (lanes.js), cfg (character), height (lane px), big (tall screen),
//   total (secs), target (stage wpm), net (stage 9 net words), startTime, endTime, keys (correct keypresses),
//   pos, errors, overlay (element the dialogue covers), onTalking(bool), onRage(bool), onDone()
export function BossChase(props) {
  const { boss, world, cfg, height, big } = props;
  const live = useRef(props); live.current = props;
  const wrapRef = useRef(null), sceneRef = useRef(null), actorsRef = useRef(null);
  const heroRef = useRef(null), bossRef = useRef(null), chestRef = useRef(null), fxRef = useRef(null);
  const clockRef = useRef(null), fillRef = useRef(null), accRef = useRef(null), rageRef = useRef(null), linesRef = useRef(null);
  const [heroAnim, setHeroAnim] = useState('idle');
  const [talk, setTalk] = useState(null);
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
    // released a tick later, so the key that closed the box is not also typed
    setTimeout(() => { live.current.onTalking && live.current.onTalking(false); }, 0);
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
    const onKey = e => { if (talkRef.current && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); } };
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
      phase: 'intro', heroX: 70, heroY: 0, bossX: 0, bossFlip: false, bossHide: false, squash: 1,
      chest: 'carried', chestX: 0, chestY: 0, chestVX: 0, chestVY: 0, obs: [], nextObs: 3, trip: 0, jump: null,
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
      const W = wrapRef.current.clientWidth;
      if (stars === 3) {
        st.bossX = Math.min(st.bossX, W * .62); st.hold = true;
        say(boss.lines.caught, () => { st.hold = false; st.endAt = st.now; });
      }
    }
    const done = () => { if (!st.finished) { st.finished = true; live.current.onDone && live.current.onDone(); } };

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
      const pEff = acc < 90 ? Math.min(prog, .35) : acc < 95 ? Math.min(prog, .9) : Math.min(prog, 1);
      const timeLeft = p.startTime ? Math.max(0, total - ((p.endTime || Date.now()) - p.startTime) / 1000) : total;

      if (st.phase === 'ready' && p.startTime) { st.phase = 'chase'; bubble(boss.taunts.start, 1600); }
      if ((st.phase === 'chase' || st.phase === 'ready') && p.endTime) finish();

      const rage = st.phase === 'chase' && (prog >= 2 / 3 || timeLeft <= 30);
      if (rage !== st.rage) { st.rage = rage; p.onRage && p.onRage(rage); }   // App → setRage (plays the rage sting)
      const sec = Math.ceil(timeLeft);
      clockRef.current.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      clockRef.current.classList.toggle('hot', st.phase === 'chase' && timeLeft <= 30);
      rageRef.current.style.opacity = rage ? 1 : 0; linesRef.current.style.opacity = rage ? .8 : 0;
      fillRef.current.style.width = (100 * Math.min(1, pEff)) + '%';
      fillRef.current.classList.toggle('cap', acc < 95 && prog > pEff);
      accRef.current.textContent = (acc < 90 ? '⚠ ' : '') + 'แม่น ' + acc + '%';
      accRef.current.className = 'bc-chip bc-acc ' + (acc >= 95 ? 'ok' : acc >= 90 ? 'mid' : 'bad');

      // running speed follows typing, judged by the stage's own ⭐⭐⭐ pace (stage 1 is only ~0.5 keys a second)
      const pace = Math.max(.2, K3 / total), okGap = 1.6 / pace, now = performance.now() / 1000;
      st.hist = st.hist.filter(x => now - x < 4);
      const typing = now - st.lastOk < okGap;
      const rate = st.hist.length / 4 / pace;
      if (st.phase === 'chase') st.vel += ((typing && !st.trip ? 90 + 80 * Math.min(1.5, rate) : 0) - st.vel) * Math.min(1, dt * 3);
      else if (st.phase !== 'end') st.vel = 0;
      st.cam += st.vel * dt;
      lay.forEach(({ l, el }) => {
        const off = st.cam * l.speed;
        el.style.transform = 'translate3d(' + (l.x == null ? -(off % l.w) : l.x - off).toFixed(1) + 'px,0,0)' + (l.flip ? ' scaleX(-1)' : '');
      });

      // boss distance = progress (held back by accuracy); before the chase it stands by the hero
      const bw = boss.w, bh = boss.h;
      if (st.phase !== 'end') {
        const far = W - bw / 2 - 12, near = st.heroX + 40 + bw / 2;
        let want = st.phase === 'chase' ? far + (near - far) * pEff : st.heroX + 50 + bw / 2;
        if (acc < 95 && prog > pEff) want += Math.sin(st.now * 6) * 6;
        st.bossX += (want - st.bossX) * Math.min(1, dt * 2.5);
        if (!st.bossX) st.bossX = want;
      }

      // rocks
      if (st.phase === 'chase' && p.startTime && (Date.now() - p.startTime) / 1000 > st.nextObs && st.bossX - st.heroX > 120) {
        st.obs.push({ x: st.bossX - bw / 2, rot: 0, state: 'roll', vy: 0, y: 0 });
        st.nextObs = (Date.now() - p.startTime) / 1000 + (rage ? 2.2 + Math.random() : 3.8 + Math.random() * 2);
        bubble(rage ? boss.taunts.throwRage : boss.taunts.throw, 700);
      }
      const good = typing && now - st.lastErr > 1.5;
      st.obs.forEach(o => {
        if (o.state === 'roll') {
          o.x -= (st.vel + 70) * dt; o.rot -= (st.vel + 70) * dt / 8;
          if (o.x - st.heroX < 46 && !st.jump && !st.trip && good) { st.jump = { t: 0, len: .55, hgt: height < 90 ? 30 : 34 }; sfx('jump'); }
          if (o.x - st.heroX < 8) {
            if (st.jump) o.state = 'past';
            else { o.state = 'hit'; o.vy = -120; st.trip = .7; bubble(boss.taunts.laugh, 900); sfx('trip'); setTimeout(() => sfx('laugh'), 180); }
          }
        } else if (o.state === 'hit') { o.x -= 60 * dt; o.vy += 500 * dt; o.y += o.vy * dt; if (o.y > 0) { o.y = 0; o.vy = 0; } }
        else o.x -= (st.vel + 70) * dt;
      });
      st.obs = st.obs.filter(o => o.x > -40);
      if (st.jump) { st.jump.t += dt; const k = st.jump.t / st.jump.len; st.heroY = k >= 1 ? 0 : 4 * st.jump.hgt * k * (1 - k); if (k >= 1) st.jump = null; }
      if (st.trip > 0) st.trip = Math.max(0, st.trip - dt);

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
      if (st.phase === 'intro' || st.phase === 'ready') setHero('idle');
      else if (st.phase === 'chase') setHero(st.trip ? 'sad' : st.vel > 25 ? 'run' : 'idle');
      const hc = heroRef.current.firstChild, hw = hc ? hc.width : 52, hh = hc ? hc.height : 62;
      const shake = st.trip ? Math.sin(st.now * 50) * 2 : 0;
      heroRef.current.style.transform = 'translate(' + (st.heroX - hw / 2 + shake).toFixed(1) + 'px,' + (ground - hh - st.heroY).toFixed(1) + 'px)';
      heroRef.current.style.filter = st.trip > .5 ? 'brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4)' : '';

      const moving = st.phase === 'chase' || (st.phase === 'end' && !st.hold && st.end !== 3);
      if (moving) st.legT += dt * boss.fps;
      const carried = st.chest === 'carried', strip = carried ? runChest : run;
      bg.clearRect(0, 0, boss.w, boss.h);
      if (strip) bg.drawImage(strip, (Math.floor(st.legT) % boss.frames) * boss.w, 0, boss.w, boss.h, 0, 0, boss.w, boss.h);
      const laughing = st.bubbles.some(b => /ฮ่า/.test(b.el.textContent)) ? Math.abs(Math.sin(st.now * 18)) * 6 : 0;
      bossRef.current.style.display = st.bossHide ? 'none' : '';
      bossRef.current.style.transform = 'translate(' + (st.bossX - bw / 2).toFixed(1) + 'px,' + (ground - bh - laughing).toFixed(1) + 'px)' + (st.bossFlip ? ' scaleX(-1)' : '');
      bossRef.current.style.filter = rage ? 'saturate(1.5) drop-shadow(0 0 ' + (2 + Math.round(Math.abs(Math.sin(st.now * 8)) * 3)) + 'px #FF2A1A)' : '';

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
    if (!live.current.startTime) say(boss.lines.intro, () => { st.phase = 'ready'; });
    else st.phase = 'ready';

    return () => {
      alive = false; cancelAnimationFrame(raf);
      lay.forEach(({ el }) => el.remove()); bossCv.remove();
      st.bubbles.forEach(b => b.el.remove());
      const p = live.current;
      if (talkRef.current) { talkRef.current = null; p.onTalking && p.onTalking(false); }
      if (st.rage) p.onRage && p.onRage(false);
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
          <div className="bc-tick" style={{ left: 'calc(' + K2pct + '% - 1px)' }}><span>⭐⭐</span></div>
          <div className="bc-tick" style={{ left: 'calc(100% - 3px)' }}><span style={{ left: 'auto', right: 5 }}>⭐⭐⭐ จับได้!</span></div>
        </div>
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
      {talk && ReactDOM.createPortal(<BossTalk boss={boss} talk={talk} big={big} rect={host}/>, document.body)}
    </div>
  );
}
