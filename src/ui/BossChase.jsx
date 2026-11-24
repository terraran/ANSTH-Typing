// ═══════════════════════════════════════════════════════════════
// BOSS CHASE — the timed (last) step of a stage's boss lesson.
//   The boss (src/data/bosses.js) stole the treasure chest and runs; the student types to catch up.
//   • Distance = the real star formula: correct keys (Shift = 1 key, like pressCountRef) against
//     target × 1.5 × 4 × minutes (⭐⭐⭐), with a mark at 2/3 of it (⭐⭐). Net steps (stage 9) take 4 keys off per error.
//   • Accuracy: under 95 % the boss can't be caught (⭐⭐⭐ needs 95 %), under 90 % it pulls far ahead (0 stars).
//   • Start: the boss talks (off screen), dashes in from behind and overtakes to the far end, "พร้อม… เริ่ม!", then typing opens.
//   • The boss throws something now and then — a quick-time event, different per boss (bosses.js `qte`); the scene
//     slows, typing and the clock pause for the whole window, and failing is only a look (nothing is taken off):
//       'rock'  (stage 1) a big Space key: Space in time = jump, too late = trip
//       'crows' (stage 2) crows fly in on the boss music's beat, each with a key on a rhythm track: press it as it
//               reaches the ring; a missed crow pecks the hero; 2+ misses = the whole flock mobs the hero
//       'roots' (stage 3) roots creep up and grab the hero's legs: mash Space 5 times before the bar runs out
//       'dive'  (stage 4) the water rises and the boss's tail sweeps in: hold Space to duck under before it hits
//               (white mark), let go only after it has passed (green part) — up too early = hit
//       'seq'   (stage 5) a giant boulder rolls in: press the keys shown, in order (bosses.js `keys`, `seqLen`), to jump it
//       'shift' (stage 6) a little bat swoops in: hold Shift and press the key shown (stage 6's Shift letters)
//       'word'  (stage 7) a spell book flies in: type the word shown (rare letters, bosses.js `words`) to burst it
//       'num'   (stage 8) a gear rolls in: type the Thai numerals shown (bosses.js `keys`, `seqLen`) to break it
//       stage 9 uses 'seq' with 3 keys and a fireball (bosses.js `obstacle`, `qteText` = its own lines on the card)
//   • Flying bosses (bosses.js `fly` = px above the ground) hover and bob; the stomp, the burst and the dropped item follow them up.
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
import { mapKey } from '../engine/keymap';
import { PX_FONT, TH_FONT } from './pixel';
import { sfx, beatGrid, audioTime, bossSection, bossMood, chaseMode } from './sound';

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
// Crow (stage 2), two wing frames
const CROW = [['....kk......', '...kbbk.....', 'kkkbwbbk....', '.yyybbbbkkkk', '...kbbbbgggk', '....kbbbbkk.', '.....kk.k...'],
              ['....kk......', 'kk.kbbk..kk.', 'kgkbwbbkkgk.', '.ykbbbbbbk..', '...kbbbbbk..', '....kbbbk...', '.....k.k....']];
const CROW_PAL = { k: '#1f1a17', b: '#2b2f3a', g: '#555b6b', y: '#e0b23c', w: '#f2ead2' };
// Little bat (stage 6 'shift') and spell book (stage 7 'word'), two frames each
const BAT = [['k..........k', 'kk........kk', 'bkk..kk..kkb', '.bbkkbbkkbb.', '..bbbrrbbb..', '...bbbbbb...', '....k..k....'],
             ['.....kk.....', '....kbbk....', '..kkbrrbkk..', '.kbbbbbbbbk.', 'kbb.bbbb.bbk', 'kb...kk...bk', 'k..........k']];
const BAT_PAL = { k: '#1a0d22', b: '#4a3460', r: '#ff4d4d' };
const BOOK = [['kkkkkkkkkkkk', 'kwwwwkkwwwwk', 'kwyywkkwyywk', 'kwwwwkkwwwwk', 'kwyywkkwyywk', 'kwwwwkkwwwwk', 'kppppkkppppk', 'kkkkkkkkkkkk'],
              ['.kkkk..kkkk.', 'kwwwwkkwwwwk', 'kwyywkkwyywk', 'kwwwwkkwwwwk', 'kwyywkkwyywk', 'kwwwwkkwwwwk', 'kppppkkppppk', 'kkkkkkkkkkkk']];
const BOOK_PAL = { k: '#2a1430', w: '#f2ead2', y: '#e0b23c', p: '#7a2d8a' };
// Gear (stage 8 'num') and fireball (stage 9, bosses.js obstacle: 'fire')
const GEAR = ['....kk....', '..k.gg.k..', '.kggggggk.', '..gg..gg..', 'kgg....ggk', 'kgg....ggk', '..gg..gg..', '.kggggggk.', '..k.gg.k..', '....kk....'];
const GEAR_PAL = { k: '#5a4a1e', g: '#d4a72c' };
const FIRE = [['....rr....', '..rroorr..', '.rooyyoor.', 'rooyyyyoor', 'rooyyyyoor', '.rooyyoor.', '..rroorr..', '....rr....'],
              ['...rr.....', '.rroorr.r.', 'rooyyoorr.', 'rooyyyyoor', 'rooyyyyoor', 'rooyyoorr.', '.rroorr.r.', '...rr.....']];
const FIRE_PAL = { r: '#d4361c', o: '#ff8a1f', y: '#ffe36b' };
// rhythm track: note speed (px/s) · centre of the ring (px in the lane) · judgement windows (s), kind to young hands
const RT_SPEED = 300, RT_HIT = 93, RT_PERFECT = .08, RT_OK = .2, RT_LATE = .3;   // (Nov 2026: eased — young players never made it)
const RT_MISSES = 2;                                    // crows a player may miss and still pass
const CHASE_H = 132;
const MASH_NEED = 5, MASH_SECS = 2.2;
const DIVE_SECS = 2.4, DIVE_HIT = 1.2, DIVE_SAFE = 1.5;   // window · the tail reaches the hero · it has passed
const SEQ_SECS = 2.2;
const BOULDER_PAL = { k: '#241a14', r: '#7c7469', q: '#a39a8c' };
const isMark = c => /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(c);
const keyFace = c => (isMark(c) ? '◌' + c : c);
const loadImg = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
const graphemes = t => seg ? [...seg.segment(t)].map(s => s.segment) : [...t];   // never split a Thai vowel / tone mark off

const CSS = `
.bc-top{position:absolute;left:8px;right:8px;top:5px;display:flex;align-items:center;gap:8px;z-index:9;pointer-events:none}
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
/* the bar went grey (accuracy too low to catch the boss): say why on the bar, and make the accuracy chip pulse */
.bc-why{position:absolute;inset:-2px 0;display:none;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;white-space:nowrap;z-index:2;
  text-shadow:0 1px 0 ${INK},1px 0 0 ${INK},-1px 0 0 ${INK},0 -1px 0 ${INK};pointer-events:none}
.bc-why.on{display:flex}.bc-why.low{color:#FFD0C8}
/* after a QTE: where to type next */
.bc-ptr{position:fixed;z-index:50;pointer-events:none;display:none}
.bc-ptr-ring{position:absolute;inset:-5px -4px;border:3px solid #FFC23D;border-radius:7px;box-shadow:0 0 14px 5px rgba(255,194,61,.75);
  animation:bcPtrRing .45s ease-in-out infinite alternate}
@keyframes bcPtrRing{to{box-shadow:0 0 4px 1px rgba(255,194,61,.5);border-color:#FFE08A}}
.bc-ptr-tag{position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;
  animation:bcPtrBob .4s ease-in-out infinite alternate}
@keyframes bcPtrBob{to{transform:translate(-50%,-6px)}}
.bc-ptr-tag b{background:#FFC23D;border:2px solid ${INK};color:${INK};font-size:14px;padding:0 9px;white-space:nowrap;font-weight:800;box-shadow:0 2px 0 ${INK}}
.bc-ptr-tag i{font-style:normal;color:#FFC23D;font-size:22px;line-height:.9;text-shadow:0 2px 0 ${INK},1px 0 0 ${INK},-1px 0 0 ${INK}}
.bc-acc.warn{animation:bcAccPulse .9s ease-in-out infinite}
@keyframes bcAccPulse{50%{background:#C0392B;color:#fff;transform:scale(1.08)}}
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
.bc-qte-key.held{background:linear-gradient(#9fd8ff,#4aa3e0);transform:translateY(5px);box-shadow:0 3px 0 ${INK},0 0 0 6px rgba(255,255,255,.55),0 0 30px 8px rgba(80,170,230,.8)}
.bc-qte.on .bc-qte-key.held{animation:none}
.bc-qte-track{position:relative}
.bc-qte-zone{position:absolute;left:0;top:0;bottom:0;background:rgba(155,227,154,.55);border-right:2px dashed #fff}
.bc-qte-mark{position:absolute;top:-7px;bottom:-7px;width:4px;margin-left:-2px;background:#fff;box-shadow:0 0 0 2px ${INK}}
.bc-qte-caps{display:flex;align-items:center;gap:10px}
.bc-qte-cap{min-width:76px;height:76px;background:linear-gradient(#FFE08A,#FFC23D);border:4px solid ${INK};border-radius:10px;
  box-shadow:0 8px 0 ${INK},0 0 0 6px rgba(255,255,255,.55),0 0 30px 8px rgba(255,194,61,.8);
  display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:${INK};line-height:1}
.bc-qte-cap.wide{padding:0 16px;font-size:24px}
.bc-qte-cap.held{background:linear-gradient(#9fd8ff,#4aa3e0);box-shadow:0 3px 0 ${INK};transform:translateY(5px)}
.bc-qte-cap.word{padding:0 20px;font-size:40px;gap:0}
.bc-qte-cap.done{background:linear-gradient(#C9F7C0,#7BD67A);box-shadow:0 3px 0 ${INK};transform:translateY(5px)}
.bc-qte-cap.bad{animation:bcShake .2s}
@keyframes bcShake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.bc-qte-arrow{font-size:30px;font-weight:800;color:#fff;text-shadow:0 2px 0 ${INK},2px 0 0 ${INK},-2px 0 0 ${INK},0 -2px 0 ${INK}}
.bc-qte.miss .bc-qte-cap:not(.done){background:linear-gradient(#FFB3AA,#FF6B5A)}
.bc-pips{display:flex;gap:6px}
.bc-pips i{width:22px;height:22px;border:3px solid ${INK};background:#F8EED2;display:block;transition:background .08s}
.bc-pips i.on{background:#7BD67A}
.bc-rt{position:absolute;left:30px;right:30px;height:104px;z-index:20;opacity:0;transform:scale(.9);transition:opacity .15s,transform .15s;pointer-events:none}
.bc-rt.show{opacity:1;transform:none}
.bc-rt-lane{position:absolute;left:0;right:0;top:22px;height:74px;background:rgba(59,36,22,.86);border:4px solid ${INK};border-radius:10px;
  box-shadow:0 6px 0 rgba(59,36,22,.4);overflow:hidden}
.bc-rt-ring{position:absolute;left:${RT_HIT - 31}px;top:6px;bottom:6px;width:62px;border:4px solid #FFE08A;border-radius:50%;box-shadow:0 0 18px 4px rgba(255,224,138,.55)}
.bc-rt-ring.flash{animation:bcRing .18s ease-out}
@keyframes bcRing{from{transform:scale(1.25);box-shadow:0 0 30px 12px rgba(255,224,138,.9)}}
.bc-note{position:absolute;left:0;top:9px;width:56px;height:56px;margin-left:-28px;will-change:transform}
.bc-note b{position:absolute;inset:0;border:4px solid ${INK};border-radius:10px;background:linear-gradient(#FFF6DE,#F5D27A);box-shadow:0 5px 0 ${INK};
  display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:800;color:${INK};line-height:1}
.bc-note img{position:absolute;left:10px;top:-24px;image-rendering:pixelated}
.bc-note.hit b{background:linear-gradient(#C9F7C0,#7BD67A);transform:translateY(-6px) scale(1.15);transition:transform .12s}
.bc-note.miss b{background:linear-gradient(#FFB3AA,#FF6B5A)}
.bc-note.gone{opacity:0;transition:opacity .25s}
.bc-rt-title{position:absolute;left:50%;transform:translateX(-50%);top:-8px;font-size:22px;white-space:nowrap;font-weight:800;color:#fff;
  text-shadow:0 2px 0 ${INK},2px 0 0 ${INK},-2px 0 0 ${INK},0 -2px 0 ${INK}}
.bc-rt-title.ok{color:#9BE39A}.bc-rt-title.miss{color:#FF8A7A}
.bc-rt-judge{position:absolute;left:${RT_HIT}px;top:-6px;transform:translateX(-50%);font-size:22px;font-weight:800;white-space:nowrap;
  text-shadow:0 2px 0 ${INK},2px 0 0 ${INK},-2px 0 0 ${INK},0 -2px 0 ${INK}}
.bc-rt-judge.pop{animation:bcJudge .3s ease-out}
@keyframes bcJudge{from{transform:translateX(-50%) scale(1.5)}}
.bc-rt-dots{position:absolute;right:8px;top:-2px;display:flex;gap:6px}
.bc-rt-dots i{width:16px;height:16px;border:3px solid ${INK};background:#F8EED2;display:block}
.bc-rt-dots i.ok{background:#7BD67A}.bc-rt-dots i.bad{background:#FF6B5A}
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
  const artBottom = typeof art.bottom === 'object' ? art.bottom[line.face] : art.bottom;
  const fRight = Math.min(right + 270, innerWidth - 4), fx = fRight - pf, fy = innerHeight - (artBottom + 1) * sc;
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
  // The chase scene is taller than the practice lane (84 / 100) so big and flying bosses fit inside it:
  // CHASE_H at every screen size; the text box above the keyboard gives up the room (lab 1366×657: 3 → 2 lines,
  // bigger screens keep theirs — mock .claude/mock/chase-layout.html). Boss art: ≤ ~110 px tall incl. flapping / flying.
  const { boss, world, cfg, big } = props, height = CHASE_H;
  const live = useRef(props); live.current = props;
  const wrapRef = useRef(null), sceneRef = useRef(null), actorsRef = useRef(null);
  const heroRef = useRef(null), bossRef = useRef(null), chestRef = useRef(null), fxRef = useRef(null);
  const clockRef = useRef(null), fillRef = useRef(null), accRef = useRef(null), rageRef = useRef(null), linesRef = useRef(null), whyRef = useRef(null);
  const [heroAnim, setHeroAnim] = useState('idle');
  const [talk, setTalk] = useState(null);
  const [qteView, setQteView] = useState(null);        // null | 'on' | 'ok' | 'miss'
  const qteKind = boss.qte || 'rock';                   // which QTE this boss throws (bosses.js)
  const rtLaneRef = useRef(null), rtDotsRef = useRef(null), rtJudgeRef = useRef(null), rtRingRef = useRef(null), pipsRef = useRef(null);
  const [rtTitle, setRtTitle] = useState(null);         // crows: the title over the track, then the result
  const [qteWord, setQteWord] = useState('');           // dive: the line under the key changes as the tail comes
  const [diveHeld, setDiveHeld] = useState(false);
  const [qteSeq, setQteSeq] = useState(null);           // seq: { keys, i, bad }
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
      // QTE keys (App types nothing meanwhile): rock = Space to jump · roots = mash Space · crows = the key on the note
      if (!st || !st.qte || e.repeat) return;
      const k = st.qte.kind;
      if ((k === 'rock' || k === 'mash') && e.key === ' ') { e.preventDefault(); k === 'rock' ? st.dodge() : st.mash(); }
      // letters: the key's place on the Kedmanee keyboard, like typing (the English layout works too)
      else if (k === 'crows' && mapKey(e)) { e.preventDefault(); st.press(mapKey(e)); }
      else if (k === 'dive' && e.key === ' ') { e.preventDefault(); st.diveDown(); }
      else if (k === 'seq' && e.key === 'Shift') st.seqShift(true);
      else if (k === 'seq' && mapKey(e)) { e.preventDefault(); st.seqKey(mapKey(e)); }
    };
    const onUp = e => {
      const st = S.current; if (!st || !st.qte) return;
      const k = st.qte.kind;                           // read once: diveUp() can end the QTE (st.qte → null)
      if (k === 'dive' && e.key === ' ') { e.preventDefault(); st.diveUp(); }
      else if (k === 'seq' && e.key === 'Shift') st.seqShift(false);
    };
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp); };
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
      qte: null, owe: 0, oweStart: 0, block: null, taunted: false, crows: [], lastPeck: 0, wiggle: 0, dip: 0, water: 0, tail0: -99,
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
    const rock = pixelArt(ROCK, 2, ROCK_PAL), boulder = pixelArt(ROCK, 4, BOULDER_PAL);
    const batArt = BAT.map(r => pixelArt(r, 3, BAT_PAL)), bookArt = BOOK.map(r => pixelArt(r, 3, BOOK_PAL));
    const gearArt = pixelArt(GEAR, 3, GEAR_PAL), fireArt = FIRE.map(r => pixelArt(r, 3, FIRE_PAL));
    const F = boss.fly || 0;                           // a flying boss hovers this high above the ground
    const crowArt = CROW.map(r => pixelArt(r, 3, CROW_PAL)), crowIcon = qteKind === 'crows' ? pixelArt(CROW[0], 2, CROW_PAL).toDataURL() : '';
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

    // roots (stage 3): a creeping root along the ground; round the hero's legs while they hold (thinner with each Space)
    function drawRoots(g, o, gy) {
      const t = st.now;
      g.save(); g.lineCap = 'round';
      if (o.state === 'roll') {
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = i ? '#7a5230' : '#3b2416'; g.lineWidth = i ? 3 : 6;
          g.beginPath(); g.moveTo(o.x + 46, gy);
          g.bezierCurveTo(o.x + 30, gy - 10 - Math.sin(t * 9) * 3, o.x + 12, gy + 2, o.x, gy - 6 - Math.sin(t * 12) * 3);
          g.stroke();
        }
      } else {
        const q = st.qte && st.qte.o === o ? st.qte : null;
        const left = q ? 1 - q.n / MASH_NEED * .7 : 1;
        const up = Math.min(1, o.t / .18) * (o.state === 'sink' ? Math.max(0, 1 - o.t / .4) : 1) * left;
        [[-14, 1], [-5, -1], [5, 1], [13, -1]].forEach(([dx, dir], i) => {
          const hgt = (20 + (i % 2) * 8) * up, x = o.x + dx, w = Math.sin(t * 10 + i) * 3;
          g.strokeStyle = '#3b2416'; g.lineWidth = 6;
          g.beginPath(); g.moveTo(x, gy); g.quadraticCurveTo(x + dir * 10 + w, gy - hgt * .6, x - dir * 4, gy - hgt); g.stroke();
          g.strokeStyle = '#7a5230'; g.lineWidth = 3; g.stroke();
          g.fillStyle = '#4f7a2a'; g.fillRect(x - dir * 4 - 2, gy - hgt - 3, 5, 3);      // a little leaf on the tip
        });
      }
      g.restore();
    }

    function finish() {
      const p = live.current;
      const mins = (p.endTime - p.startTime) / 60000;
      const acc = (p.pos + p.errors) > 0 ? Math.round(p.pos / (p.pos + p.errors) * 100) : 100;
      const wpm = mins > 0 ? (p.net ? Math.max(0, p.keys / 4 - p.errors) : p.keys / 4) / mins : 0;
      const stars = p.startTime ? lessonStars(wpm, acc, p.target) : 0;
      st.phase = 'end'; st.end = stars; st.endAt = st.now; st.obs = []; st.vel = 0;
      if (st.qte) { st.qte = null; setQteView(null); bossMood({ under: false, tangle: false }); }
      clearNotes(); st.crows.forEach(c => { c.state = 'leave'; });
      if (st.stomp) { st.stomp = null; st.squash = 1; st.heroY = 0; setCue(null); }
      if (st.boosted) { st.boosted = false; st.boostUntil = 0; p.onBoost && p.onBoost(1); }
      const W = wrapRef.current.clientWidth;
      if (stars === 3) {
        st.bossX = Math.min(st.bossX, W * .62); st.hold = true;
        say(boss.lines.caught, () => { st.hold = false; st.endAt = st.now; bossSection('win'); });   // story song: drum roll under the jump
      } else bossSection(stars > 0 ? 'escape' : 'lost');
    }
    const done = () => { if (!st.finished) { st.finished = true; live.current.onDone && live.current.onDone(); } };
    // the "type here next" pointer, on document.body (fixed) like the dialogue: the text sits in another part of the page
    const ptr = document.createElement('div'); ptr.className = 'bc-ptr';
    ptr.innerHTML = '<div class="bc-ptr-ring"></div><div class="bc-ptr-tag"><b>พิมพ์ต่อตรงนี้</b><i>▼</i></div>';
    document.body.appendChild(ptr);
    st.ptrFrom = 0; st.ptrUntil = 0; st.ptrPos = -1;
    function pointNext() {                              // after the QTE card has faded
      st.ptrFrom = st.now + (qteKind === 'crows' ? 1 : .65); st.ptrUntil = st.ptrFrom + 2.2; st.ptrPos = live.current.pos;
    }

    // ── rock QTE: Space within the window = jump; the clock stands still for the whole window ──
    const QTE_AT = 230, QTE_SECS = 1.3;               // px from the hero when it starts · window length
    // stomp reward: ×2 score for 15 s; another stomp while it lasts adds +1 (up to ×5). 15 s lets a very fast typist
    // (~6× the stage pace, ~12 s a lap at ×2) stack it; each higher step needs more speed.
    const BOOST_SECS = 15;
    let qteTimer = 0;
    function endQte(result) {
      const q = st.qte; if (!q) return;
      st.qte = null;
      if (q.kind === 'mash') bossMood({ tangle: false }); else if (q.kind === 'dive') bossMood({ under: false });
      st.owe += Date.now() - q.wall0; st.oweStart = live.current.startTime;
      live.current.onPause && live.current.onPause(Date.now() - q.wall0);   // App moves startTime on by the window
      setQteView(result); clearTimeout(qteTimer); qteTimer = setTimeout(() => setQteView(null), qteKind === 'crows' ? 1000 : 650);
      if (st.phase === 'chase') pointNext();
    }
    const jump = () => { st.jump = { t: 0, len: .55, hgt: (height < 90 ? 30 : 34) + 6 }; sfx('jump'); };
    st.dodge = () => {                                 // rock: Space in time = jump
      if (!st.qte || st.qte.kind !== 'rock') return;
      st.qte.o.state = 'past'; endQte('ok'); jump();
    };
    // ── roots: they grab the legs; mash Space MASH_NEED times before the bar runs out ──
    function paintPips(n) { const el = pipsRef.current; if (el) [...el.children].forEach((p, i) => p.classList.toggle('on', i < n)); }
    st.mash = () => {
      const q = st.qte; if (!q || q.kind !== 'mash') return;
      q.n++; paintPips(q.n); st.wiggle = .12; sfx('mash', q.n);
      if (q.n >= MASH_NEED) { q.o.state = 'snap'; snapRoots(); endQte('ok'); jump(); sfx('snap'); }
    };
    function failMash() {
      const q = st.qte; q.o.state = 'hold'; q.o.t = 0; endQte('miss'); st.trip = 1;
      bubble(boss.taunts.laugh, 900); sfx('trip'); setTimeout(() => sfx('laugh'), 180);
    }
    function snapRoots() {                             // broken root bits fly off
      const ground = wrapRef.current.clientHeight - 9;
      for (let i = 0; i < 16; i++) st.parts.push({ x: st.heroX + (Math.random() - .5) * 30, y: ground - Math.random() * 20,
        vx: (Math.random() - .5) * 240, vy: -120 - Math.random() * 160, s: 3, c: Math.random() < .5 ? '#5b3a1e' : '#7a5230', life: .6 + Math.random() * .3 });
    }
    // ── crows: on the boss music's beat (or our own drum if the music is off) ──
    function clearNotes() { if (rtLaneRef.current) rtLaneRef.current.querySelectorAll('.bc-note').forEach(e => e.remove()); }
    function startCrows() {
      const grid = beatGrid();
      const clock = grid ? audioTime : () => performance.now() / 1000;
      const t = clock();
      let beat = grid ? grid.beat : .5, first = grid ? grid.next : t + .1;
      while (beat < .3) beat *= 2;                     // never closer than ~0.3 s (very fast songs: every other beat)
      while (first < t + beat * 2) first += beat;      // the first crow lands 2+ beats from now
      const pattern = st.rage ? [0, 1, 2, 3, 4] : [0, 1, 2, 3];      // rage: 5 crows, still one per beat
      const keys = boss.keys || [' '];
      let last = '';
      clearNotes();
      const notes = pattern.map((o, i) => {
        let k; do { k = keys[Math.floor(Math.random() * keys.length)]; } while (k === last && keys.length > 1); last = k;   // never the same key twice in a row
        const el = document.createElement('div'); el.className = 'bc-note';
        el.innerHTML = '<b>' + (/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/.test(k) ? '◌' + k : k) + '</b><img src="' + crowIcon + '" alt="">';
        if (rtLaneRef.current) rtLaneRef.current.appendChild(el);
        const crow = { x: -99, y: 0, state: 'fly', i, at: first + o * beat, py: 0 };
        st.crows.push(crow);
        return { at: first + o * beat, key: k, state: 'live', el, crow };
      });
      if (rtDotsRef.current) rtDotsRef.current.innerHTML = notes.map(() => '<i></i>').join('');
      if (rtJudgeRef.current) rtJudgeRef.current.textContent = '';
      setRtTitle({ text: 'ไล่อีกา! กดแป้นตอนถึงวงกลม', cls: '' });
      st.qte = { kind: 'crows', t: 0, wall0: Date.now(), clock, beat, notes, misses: 0, nextKick: grid ? Infinity : first - beat * 2 };
      setQteView('on'); sfx('qte');
    }
    function judgeNote(nt, text, ok) {
      const q = st.qte; nt.state = ok ? 'hit' : 'miss'; nt.el.classList.add(ok ? 'hit' : 'miss'); setTimeout(() => nt.el.classList.add('gone'), 220);
      const dot = rtDotsRef.current && rtDotsRef.current.children[q.notes.indexOf(nt)]; if (dot) dot.className = ok ? 'ok' : 'bad';
      const j = rtJudgeRef.current;
      if (j) { j.textContent = text; j.style.color = ok ? (text === 'เยี่ยม!' ? '#FFE08A' : '#9BE39A') : '#FF8A7A'; j.classList.remove('pop'); void j.offsetWidth; j.classList.add('pop'); }
      if (ok) { sfx('hit'); nt.crow.state = 'flee'; const r = rtRingRef.current; if (r) { r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash'); } }
      else { sfx('qteWrong'); q.misses++; nt.crow.state = 'peck'; }      // a missed crow lands on the hero and pecks
    }
    st.press = key => {
      const q = st.qte; if (!q || q.kind !== 'crows') return;
      const t = q.clock();
      // crows inside the window, earliest first: a late press is meant for the earlier crow, not the next one
      // (in rage the crows are only ~0.38 s apart); a key that matches one of them counts for that one
      const near = q.notes.filter(n => n.state === 'live' && Math.abs(n.at - t) <= RT_LATE).sort((a, b) => a.at - b.at);
      if (!near.length) return;                                         // nothing near the ring: ignored (no penalty)
      const nt = near.find(n => n.key === key) || near[0];
      const d = Math.abs(nt.at - t);
      if (key !== nt.key) return judgeNote(nt, 'ผิดแป้น', false);
      judgeNote(nt, d <= RT_PERFECT ? 'เยี่ยม!' : d <= RT_OK ? 'ดี!' : (nt.at > t ? 'เร็วไปนิด' : 'ช้าไปนิด'), true);
    };
    function finishCrows() {
      const q = st.qte, pass = q.misses <= RT_MISSES;
      setRtTitle({ text: pass ? 'ไล่อีกาสำเร็จ!' : 'โดนรุมจิก!', cls: pass ? 'ok' : 'miss' });
      endQte(pass ? 'ok' : 'miss');
      const mine = q.notes.map(n => n.crow);
      if (pass) { mine.forEach(c => { if (c.state === 'peck') c.state = 'leave'; }); sfx('qtePass'); }
      else {                                           // failed: every crow, even the shooed ones, comes back and mobs the hero
        mine.forEach(c => { c.state = 'swarm'; }); st.trip = 1.4;
        bubble(boss.taunts.laugh, 1000); setTimeout(() => sfx('laugh'), 150);
        setTimeout(() => mine.forEach(c => { c.state = 'leave'; }), 1400);
      }
      setTimeout(clearNotes, 700);
    }
    // ── dive: the water rises, the tail sweeps in; hold Space under water until it has passed ──
    function splash(n, x) {
      const ground = wrapRef.current.clientHeight - 9;
      for (let i = 0; i < n; i++) st.parts.push({ x: x + (Math.random() - .5) * 40, y: ground - 30 - Math.random() * 10, vx: (Math.random() - .5) * 200,
        vy: -100 - Math.random() * 180, s: 3, c: Math.random() < .5 ? '#bfe6ff' : '#5fb0e8', life: .5 + Math.random() * .3 });
    }
    function startDive() {
      st.qte = { kind: 'dive', t: 0, len: DIVE_SECS, held: false, judged: false, wall0: Date.now() };
      st.tail0 = st.now; setDiveHeld(false); setQteWord('กด SPACE ค้างไว้ ดำน้ำหลบหาง!'); setQteView('on'); sfx('qte'); sfx('splash');
    }
    st.diveDown = () => {
      const q = st.qte; if (!q || q.kind !== 'dive' || q.held) return;
      q.held = true; setDiveHeld(true); sfx('dive'); splash(6, st.heroX); bossMood({ under: true });
      setQteWord(q.t < DIVE_HIT ? 'ค้างไว้… หางกำลังมา!' : 'รอให้หางผ่าน… แล้วปล่อย!');
    };
    st.diveUp = () => {
      const q = st.qte; if (!q || q.kind !== 'dive' || !q.held) return;
      q.held = false; setDiveHeld(false);
      if (q.t >= DIVE_SAFE) diveEnd(true); else diveEnd(false, q.t < DIVE_HIT ? 'ขึ้นเร็วไป โดนหางฟาด!' : 'ยังไม่ผ่าน! โดนหางฟาด!');
    };
    function diveEnd(ok, why) {
      endQte(ok ? 'ok' : 'miss'); setDiveHeld(false);
      if (ok) { setQteWord('เยี่ยม! หลบพ้น'); jump(); splash(10, st.heroX); }
      else {
        setQteWord(why || 'โดนหางฟาด!'); st.trip = .8; splash(14, st.heroX); sfx('whoosh'); sfx('trip');
        bubble(boss.taunts.laugh, 900); setTimeout(() => sfx('laugh'), 180);
      }
    }
    // tail across the scene: in from the right, at the hero at DIVE_HIT, gone past it by DIVE_SAFE (keeps going after the window)
    function tailX(W) {
      const t = st.now - st.tail0;
      return t < DIVE_HIT ? st.heroX + (W + 40 - st.heroX) * (1 - t / DIVE_HIT) : st.heroX - (t - DIVE_HIT) / (DIVE_SAFE - DIVE_HIT) * 150;
    }
    function drawTail(g, x, y) {
      g.save(); g.translate(x, y);
      g.fillStyle = '#1f3d1e'; g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(40, -16, 110, -10); g.lineTo(110, 14); g.quadraticCurveTo(40, 12, -6, 0); g.fill();
      g.fillStyle = '#3f7a3a'; g.beginPath(); g.moveTo(-2, 0); g.quadraticCurveTo(40, -12, 108, -7); g.lineTo(108, 11); g.quadraticCurveTo(40, 9, -2, 0); g.fill();
      g.fillStyle = '#c0ca70'; g.fillRect(20, 3, 86, 4);
      g.fillStyle = '#1f3d1e'; for (let i = 0; i < 7; i++) { const sx = 14 + i * 13; g.beginPath(); g.moveTo(sx, -8 + i * .2); g.lineTo(sx + 5, -16 - i * .6); g.lineTo(sx + 10, -9); g.fill(); }
      g.restore();
    }
    // ── seq: the boulder; press its keys in order, then a double jump clears it ──
    // variants (o.kind): 'seq' = keys from `keys` in order · 'shift' = one Shift letter · 'word' = every letter of a word
    function startSeq(o) {
      const variant = o.kind, pool = boss.keys || ['ฟ', 'ห', 'ก', 'ด'];
      let keys = [];
      if (variant === 'word') keys = [...(boss.words || ['ฤษี'])[Math.floor(Math.random() * (boss.words || ['ฤษี']).length)]];
      else {
        const n = variant === 'shift' ? 1 : Math.min(boss.seqLen || 2, pool.length);
        while (keys.length < n) { const c = pool[Math.floor(Math.random() * pool.length)]; if (!keys.includes(c)) keys.push(c); }
      }
      // a word gets time by its length (the clock is paused anyway) — young typists are ~1 key a second at stage 7
      const len = boss.seqSecs || (variant === 'word' ? 1.5 + .7 * keys.length : SEQ_SECS);
      st.qte = { kind: 'seq', variant, o, t: 0, len, from: o.x, keys, i: 0, wall0: Date.now() };
      setQteSeq({ keys, i: 0, bad: 0, variant, shiftDown: false }); setQteView('on'); sfx('qte');
      sfx(boss.obstacle === 'fire' ? 'fire' : variant === 'seq' || variant === 'num' ? 'rumble' : 'whoosh');   // stage 9's fireball is fire, not a rock
    }
    st.seqShift = down => setQteSeq(v => v && v.variant === 'shift' ? { ...v, shiftDown: down } : v);
    st.seqKey = key => {
      const q = st.qte; if (!q || q.kind !== 'seq') return;
      if (key === q.keys[q.i]) {
        q.i++; sfx('hit'); setQteSeq(v => ({ ...v, keys: q.keys, i: q.i, bad: 0 }));
        if (q.i >= q.keys.length) {
          endQte('ok');
          if (q.variant === 'word') {                  // the book bursts into paper bits
            q.o.state = 'gone'; sfx('snap');
            for (let i = 0; i < 18; i++) st.parts.push({ x: q.o.x, y: wrapRef.current.clientHeight - 9 - 20 - q.o.y, vx: (Math.random() - .5) * 260,
              vy: -80 - Math.random() * 200, s: 3, c: ['#f2ead2', '#e0b23c', '#7a2d8a'][i % 3], life: .6 + Math.random() * .4 });
          } else if (q.variant === 'shift') { q.o.state = 'past'; q.o.flee = true; jump(); }   // swatted: the bat flees up and away
          else if (q.variant === 'num') {              // the gear breaks into brass bits
            q.o.state = 'gone'; sfx('snap');
            for (let i = 0; i < 16; i++) st.parts.push({ x: q.o.x, y: wrapRef.current.clientHeight - 9 - 15, vx: (Math.random() - .5) * 260,
              vy: -90 - Math.random() * 200, s: 3, c: i % 2 ? '#d4a72c' : '#5a4a1e', life: .6 + Math.random() * .3 });
          }
          else { q.o.state = 'past'; st.jump = { t: 0, len: .5 * q.keys.length, hgt: (height < 90 ? 30 : 34) + 10, hops: q.keys.length }; sfx('jump'); }
        }
      } else if (/[\u0E00-\u0E7F]/.test(key)) { sfx('qteWrong'); setQteSeq(v => v && { ...v, bad: (v.bad || 0) + 1 }); }
    };
    function showCue(text, isGo, quiet) { setCue({ text, go: isGo }); if (!quiet) sfx(isGo ? 'go' : 'count'); }

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
        if (g > .9 && !st.saidGo) { st.saidGo = true; showCue('เริ่ม!', true); bossSection('p1'); }
        if (g > 1.3) { st.phase = 'ready'; setTimeout(() => setCue(null), 400); }
      }

      const rage = st.phase === 'chase' && (prog >= 2 / 3 || timeLeft <= 30);
      if (rage !== st.rage) { st.rage = rage; p.onRage && p.onRage(rage); }   // App → setRage (plays the rage sting)
      const sec = Math.ceil(timeLeft);
      clockRef.current.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      clockRef.current.classList.toggle('hot', st.phase === 'chase' && timeLeft <= 30);
      rageRef.current.style.opacity = rage ? 1 : 0; linesRef.current.style.opacity = rage ? .8 : 0;
      fillRef.current.style.width = (100 * Math.min(1, pEff)) + '%';
      const capped = acc < 95 && lapRaw > pEff;        // typing fast enough, but too many mistakes to catch the boss
      fillRef.current.classList.toggle('cap', capped);
      const why = capped ? (acc < 90 ? 'low' : 'mid') : '';
      if (whyRef.current.dataset.k !== why) {
        whyRef.current.dataset.k = why;
        whyRef.current.className = 'bc-why' + (why ? ' on' : '') + (why === 'low' ? ' low' : '');
        whyRef.current.textContent = why === 'low' ? '⚠ แม่นไม่ถึง 90% — บอสหนีไกล! พิมพ์ช้า ๆ ให้ถูกก่อน'
          : why ? '⚠ แม่นไม่ถึง 95% — ไล่ไม่ทัน! พิมพ์ให้ถูกมากขึ้น' : '';
      }

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
      accRef.current.className = 'bc-chip bc-acc ' + (acc >= 95 ? 'ok' : acc >= 90 ? 'mid' : 'bad') + (acc < 95 && st.phase === 'chase' ? ' warn' : '');

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
      if (st.phase === 'chase' && !st.stomp && !st.qte && p.startTime && chaseSecs > st.nextObs && timeLeft > 5 && st.bossX - st.heroX > 70
          && !st.obs.some(o => o.state === 'roll' || o.state === 'hold') && !st.crows.length && !st.trip) {
        if (qteKind === 'crows') startCrows();         // crows come straight away (the track shows them coming)
        else if (qteKind === 'dive') startDive();      // so does the tail (the window starts with the water rising)
        else {
          const air = qteKind === 'shift' || qteKind === 'word';   // the bat and the book fly in at head height
          st.obs.push({ kind: qteKind, x: st.bossX - bw / 2, rot: 0, state: 'roll', vy: 0, y: air ? 36 : 0, t: 0, air });
          if (qteKind === 'roots') sfx('root');
        }
        st.nextObs = chaseSecs + (rage ? 9 + Math.random() * 2 : 15 + Math.random() * 5);
        bubble(rage ? boss.taunts.throwRage : boss.taunts.throw, 700);
      }
      if (st.qte) st.qte.t += dt;
      st.obs.forEach(o => {
        o.t += dt;
        if (o.kind === 'roots') {                      // creeps along the ground, grabs the legs → mash QTE
          if (o.state === 'roll') {
            o.x -= (st.vel + 110) * dt;
            if (o.x - st.heroX < 18 && st.phase === 'chase' && !st.qte) {
              o.state = 'grab'; o.x = st.heroX; o.t = 0; sfx('root');
              st.qte = { kind: 'mash', o, t: 0, len: MASH_SECS, n: 0, wall0: Date.now() }; paintPips(0); setQteView('on'); sfx('qte'); bossMood({ tangle: true });
            }
          } else if (o.state === 'grab' || o.state === 'hold') o.x = st.heroX;
          if (o.state === 'hold' && o.t > 1) { o.state = 'sink'; o.t = 0; }
          if ((o.state === 'sink' && o.t > .4) || o.state === 'snap') o.state = 'gone';
          return;
        }
        if (o.state === 'roll' && !o.qte) {
          o.x -= (st.vel + 110) * dt; if (!o.air) o.rot -= (st.vel + 110) * dt / 8;
          // close: QTE — the scene slows down and the rock reaches the hero exactly as the window closes
          if (o.x - st.heroX < QTE_AT && !st.trip && st.phase === 'chase') {
            o.x = Math.max(o.x, st.heroX + 120);       // a long frame must never carry it past the hero first
            o.qte = true;
            if (o.kind === 'seq' || o.kind === 'shift' || o.kind === 'word' || o.kind === 'num') startSeq(o);
            else { st.qte = { kind: 'rock', o, t: 0, len: QTE_SECS, from: o.x, wall0: Date.now() }; setQteView('on'); sfx('qte'); }
          }
        } else if (o.state === 'roll') {
          const k = st.qte ? Math.min(1, st.qte.t / st.qte.len) : 1;
          o.x = (st.qte ? st.qte.from : o.x) - ((st.qte ? st.qte.from : o.x) - (st.heroX + 8)) * k; if (!o.air) o.rot -= dt * 4;
          if (k >= 1) {                                // too late: trip (only a look — nothing is taken off)
            if (o.air) { o.state = 'past'; o.flee = true; } else { o.state = 'hit'; o.vy = -120; }   // a flyer hits and flies off
            st.trip = o.kind === 'rock' ? .7 : .9; endQte('miss');
            bubble(boss.taunts.laugh, 900); sfx('trip'); setTimeout(() => sfx('laugh'), 180);
          }
        } else if (o.state === 'hit') { o.x -= 60 * dt; o.vy += 500 * dt; o.y += o.vy * dt; if (o.y > 0) { o.y = 0; o.vy = 0; } }
        else { o.x -= (st.vel + 110) * dt; if (o.flee) o.y += 150 * dt; }
      });
      if (st.qte && qteBarRef.current) qteBarRef.current.style.width = (100 * (1 - st.qte.t / st.qte.len)) + '%';
      st.obs = st.obs.filter(o => o.state !== 'gone' && (o.x > -40 || (st.qte && st.qte.o === o)));   // never drop the rock of an open QTE
      if (st.qte && st.qte.kind === 'mash' && st.qte.t >= st.qte.len) failMash();
      if (st.qte && st.qte.kind === 'dive') {
        const q = st.qte;
        if (!q.judged && q.t >= DIVE_HIT) { q.judged = true; if (!q.held) diveEnd(false, 'โดนหางฟาด!'); else { setQteWord('รอให้หางผ่าน… แล้วปล่อย!'); sfx('whoosh'); } }
        if (st.qte === q && q.t >= q.len) diveEnd(true);   // still under water when the window ends = safe
      }
      // water: up while the tail is about, then drains · the hero ducks while Space is held
      const tailOn = st.now - st.tail0 < DIVE_SECS + .5;
      st.water += ((tailOn ? 1 : 0) - st.water) * Math.min(1, dt * (tailOn ? 6 : 3));
      st.dip += ((st.qte && st.qte.kind === 'dive' && st.qte.held ? 28 : 0) - st.dip) * Math.min(1, dt * 14);
      // crows: notes slide to the ring on the beat; the birds fly from the boss to the hero in the scene
      if (st.qte && st.qte.kind === 'crows') {
        const q = st.qte, t = q.clock();
        while (q.nextKick <= t) { sfx('kick'); q.nextKick += q.beat; }   // music off: our own drum keeps the beat
        q.notes.forEach(nt => {
          nt.el.style.transform = 'translateX(' + (RT_HIT + (nt.at - t) * RT_SPEED).toFixed(1) + 'px)';
          if (!nt.cawed && t > nt.at - q.beat * 1.5) { nt.cawed = true; sfx('caw'); }
          if (nt.state === 'live' && t - nt.at > RT_LATE) judgeNote(nt, 'พลาด!', false);
        });
        if (st.qte === q && q.notes.every(n => n.state !== 'live')) finishCrows();
      }
      if (st.jump) {                                   // hops > 1 = that many arcs in a row (the boulder's double jump)
        st.jump.t += dt; const k = st.jump.t / st.jump.len, h = st.jump.hops || 1, f = (k * h) % 1;
        st.heroY = k >= 1 ? 0 : 4 * st.jump.hgt * f * (1 - f); if (k >= 1) st.jump = null;
      }
      if (st.trip > 0) st.trip = Math.max(0, st.trip - dt);
      if (st.wiggle > 0) st.wiggle = Math.max(0, st.wiggle - dt);

      // stomp: run up → jump on its head → THUMP ("เหยียบ! ×2") → bounce back home while the boar runs back to the start
      if (st.stomp && st.phase === 'chase') {
        const s = st.stomp, far = W - bw / 2 - 12, jumpH = height < 90 ? 30 : 34; s.t += dt;
        if (s.t < .4) { st.heroX += ((st.bossX - bw * .55) - st.heroX) * Math.min(1, dt * 9); st.heroY = 0; }
        else if (s.t < .8) { const k = (s.t - .4) / .4; st.heroX += (st.bossX - st.heroX) * Math.min(1, dt * 10);
          st.heroY = (bh * .75 + jumpH + F) * Math.sin(k * Math.PI * .5) * (k < .7 ? 1 : 1 - (k - .7) * 1.3); }
        else if (!s.hit) {
          s.hit = true; s.x1 = st.heroX; st.flash = .15; st.squash = .6;
          showCue('เหยียบ! ×' + st.mult, true, true); sfx('stomp'); bossSection('stomp');   // the song answers with 4 bars of the village theme
          bubble(boss.taunts.stomped || 'อ๊าก!!', 900);
          for (let i = 0; i < 14; i++) st.parts.push({ x: st.bossX, y: ground - bh * .9 - F, vx: (Math.random() - .5) * 260,
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
      // "type here next": shown a moment after a QTE, gone after ~2 s or as soon as a letter is typed
      if (st.ptrUntil && (p.pos !== st.ptrPos || st.phase !== 'chase' || st.qte)) st.ptrUntil = 0;
      let ptrOn = false;
      if (st.ptrUntil > st.now && st.now >= st.ptrFrom) {
        const box = p.overlay && p.overlay.current;
        const el = box && [...box.querySelectorAll('[data-i="' + p.pos + '"]')].find(n => !n.closest('[aria-hidden="true"]'));
        const r = el && el.getBoundingClientRect();
        if (r && r.width) {
          ptrOn = true;
          ptr.style.left = r.left + 'px'; ptr.style.top = r.top + 'px'; ptr.style.width = r.width + 'px'; ptr.style.height = r.height + 'px';
        }
      }
      if (ptr.style.display !== (ptrOn ? 'block' : 'none')) ptr.style.display = ptrOn ? 'block' : 'none';

      // endings
      if (st.phase === 'end' && st.hold) { st.endAt = st.now; setHero('idle'); }
      else if (st.phase === 'end') {
        const e = st.now - st.endAt, gone = st.bossX - bw / 2 > W;
        if (st.end === 3) {
          if (e < .8) { st.heroX += ((st.bossX - bw * .55) - st.heroX) * Math.min(1, dt * 5); setHero('run'); }
          else if (e < 1.35) { const k = (e - .8) / .55; st.heroX += (st.bossX - st.heroX) * Math.min(1, dt * 8);
            st.heroY = (bh * .8 + 30 + F) * Math.sin(Math.min(1, k) * Math.PI * .5) * (k < .6 ? 1 : 1 - (k - .6) * 1.2); }
          else if (!st.boom) { st.boom = true; burst(st.bossX, ground - bh * .45 - F); st.bossHide = true; sfx('stomp');
            st.chest = 'fly'; st.chestVX = -90; st.chestVY = -260; st.chestX = st.bossX; st.chestY = bh * .9 + F; setTimeout(() => sfx('chest'), 700); }
          if (e >= 1.35) st.heroY = Math.max(0, st.heroY - 260 * dt);
          if (e > 1.7) setHero('cheer');
          if (e > 3.2) done();
        } else if (st.end >= 1) {
          if (e < .05 && !st.yelp) { st.yelp = true; bubble('!', 500); }
          if (e > .35 && st.chest === 'carried') { st.chest = 'fly'; st.chestX = st.bossX - bw * .1; st.chestY = bh * .9 + F; st.chestVX = -40; st.chestVY = -60; }
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
      // pecked by crows: shakes harder the more birds, flashes red, feathers fly
      const peckers = st.crows.filter(c => c.state === 'peck' || c.state === 'swarm').length;
      const shake = st.trip || peckers || st.wiggle ? Math.sin(st.now * 50) * (2 + peckers) : 0;
      heroRef.current.style.transform = 'translate(' + (st.heroX - hw / 2 + shake).toFixed(1) + 'px,' + (ground - hh - st.heroY + st.dip).toFixed(1) + 'px)';
      heroRef.current.style.filter = st.trip > .5 || (peckers && Math.floor(st.now * 10) % 2) ? 'brightness(1.6) sepia(1) hue-rotate(-40deg) saturate(4)' : '';
      if (peckers && st.now - st.lastPeck > Math.max(.07, .22 / peckers)) {
        st.lastPeck = st.now; sfx('peck');
        for (let f = 0; f < 2; f++) st.parts.push({ x: st.heroX + (Math.random() - .5) * 30, y: ground - hh + 6, vx: (Math.random() - .5) * 90,
          vy: -60 - Math.random() * 60, s: 3, c: Math.random() < .5 ? '#3a3f4c' : '#6b7182', life: .7, light: true });
      }

      const moving = st.phase === 'chase' || st.phase === 'dash' || (st.phase === 'end' && !st.hold && st.end !== 3);
      if (moving) st.legT += dt * boss.fps;
      const carried = st.chest === 'carried', strip = carried ? runChest : run;
      bg.clearRect(0, 0, boss.w, boss.h);
      if (strip) bg.drawImage(strip, (Math.floor(st.legT) % boss.frames) * boss.w, 0, boss.w, boss.h, 0, 0, boss.w, boss.h);
      const laughing = st.bubbles.some(b => /ฮ่า/.test(b.el.textContent)) ? Math.abs(Math.sin(st.now * 18)) * 6 : 0;
      bossRef.current.style.display = st.bossHide ? 'none' : '';
      const sq = st.squash || 1;                       // squashed for a moment when stomped (feet stay on the ground)
      const lift = F ? F + Math.sin(st.now * 4) * 3 : 0;   // flying: hovers and bobs
      bossRef.current.style.transform = 'translate(' + (st.bossX - bw / 2).toFixed(1) + 'px,' + (ground - bh * sq - laughing - lift).toFixed(1) + 'px)'
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
      st.obs.forEach(o => {
        if (o.kind === 'roots') return drawRoots(g, o, ground + 80);
        const fr = Math.floor(st.now * 8) % 2;
        const img = boss.obstacle === 'fire' ? fireArt[fr] : o.kind === 'num' ? gearArt
          : o.kind === 'seq' ? boulder : o.kind === 'shift' ? batArt[fr] : o.kind === 'word' ? bookArt[fr] : rock;
        g.save(); g.translate(o.x, 80 + ground - img.height / 2 - o.y); g.rotate(o.rot); g.drawImage(img, -img.width / 2, -img.height / 2); g.restore();
      });
      if (st.water > .01) {                            // over the hero, so ducking really hides them
        const wh = Math.min(H - 16, 40) * st.water, wy = 80 + H - wh, wave = Math.sin(st.now * 6) * 2;
        g.fillStyle = 'rgba(60,150,220,.62)'; g.fillRect(0, wy + wave, W, wh + 10);
        g.fillStyle = 'rgba(210,240,255,.85)'; for (let x = -((st.now * 60) % 24); x < W; x += 24) g.fillRect(x, wy + wave - 1, 12, 3);
        if (st.now - st.tail0 < DIVE_SECS + .5) drawTail(g, tailX(W), 80 + ground - 62 + 8);
      }
      // crows in the scene: fly from the boss to the hero, landing on their beat; shooed = off up and away; missed = perch and peck
      if (st.crows.length) {
        const q = st.qte && st.qte.kind === 'crows' ? st.qte : null, t = q ? q.clock() : 0, beat = q ? q.beat : .45;
        const SPOTS = [[-26, -4], [22, -2], [-6, -18], [12, -22], [-20, -16]];
        st.crows.forEach(c => {
          if (c.state === 'fly') {
            if (!q) { c.state = 'leave'; return; }
            const k = 1 - Math.max(0, Math.min(1, (c.at - t) / (beat * 2.5)));
            const x0 = st.bossX - bw * .2, y0 = ground - bh * .8, x1 = st.heroX + 20, y1 = ground - hh + 6;
            c.x = x0 + (x1 - x0) * k; c.y = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 14; c.on = k > 0;
          } else if (c.state === 'flee') { c.x += 170 * dt; c.y -= 170 * dt; }
          else if (c.state === 'peck' || c.state === 'swarm') {
            const sp = SPOTS[c.i % 5], tx = st.heroX + sp[0], ty = ground - hh - 8 + sp[1], f = Math.min(1, dt * (c.state === 'swarm' ? 6 : 12));
            c.x += (tx - c.x) * f; c.y += (ty - c.y) * f; c.py = Math.abs(Math.sin(st.now * 22 + c.i)) * 5; c.on = true;
          } else if (c.state === 'leave') { c.x -= 40 * dt; c.y -= 200 * dt; c.py = 0; }
          if (!c.on) return;
          const img = crowArt[Math.floor(st.now * 8) % 2], flip = (c.state === 'peck' || c.state === 'swarm') && c.x > st.heroX;
          g.save(); g.translate(c.x, 80 + c.y + (c.py || 0)); if (flip) g.scale(-1, 1); g.drawImage(img, -img.width / 2, -img.height / 2); g.restore();
        });
        st.crows = st.crows.filter(c => c.y > -100 && c.x < W + 60);
      }
      st.parts = st.parts.filter(q => (q.life -= dt) > 0);
      st.parts.forEach(q => { q.vy += (q.light ? 140 : 600) * dt; if (q.light) q.vx *= .97; q.x += q.vx * dt; q.y += q.vy * dt; g.globalAlpha = Math.min(1, q.life * 2); g.fillStyle = q.c; g.fillRect(q.x, 80 + q.y, q.s, q.s); });
      g.globalAlpha = 1;

      st.bubbles = st.bubbles.filter(b => { if (st.now > b.until) { b.el.remove(); return false; } return true; });
      st.bubbles.forEach(b => { b.el.style.left = Math.min(W - 60, st.bossX + bw * .15) + 'px'; b.el.style.top = (ground - bh - 4 - F) + 'px'; });
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // The boss talks first; the clock only starts at the first key, which the dialogue holds back.
    // after it talks, the boss dashes in and overtakes; typing opens after "พร้อม… เริ่ม!"
    // the story song (SONGS in src/ui/orchestra.js) follows: intro → dash → p1 (→ p2 on rage, ↔ stomp) → ending;
    // while the chase is on screen its sound effects are the orchestral ones, with this boss's own laugh
    chaseMode(+((/stage(\d+)/.exec(boss.dir || '') || [])[1]) || 1);
    if (!live.current.startTime) { bossSection('intro'); say(boss.lines.intro, () => { st.phase = 'dash'; bossSection('dash'); }); }
    else { st.phase = 'ready'; st.bossX = wrapRef.current.clientWidth - boss.w / 2 - 12; bossSection('p1'); }

    return () => {
      alive = false; cancelAnimationFrame(raf);
      lay.forEach(({ el }) => el.remove()); bossCv.remove(); ptr.remove();
      st.bubbles.forEach(b => b.el.remove());
      const p = live.current;
      clearTimeout(qteTimer); clearNotes();
      if (talkRef.current || st.block) { talkRef.current = null; p.onTalking && p.onTalking(false); }
      if (st.rage) p.onRage && p.onRage(false);
      if (st.boosted) p.onBoost && p.onBoost(1);
      chaseMode(null); bossMood({ under: false, tangle: false });
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
          <div ref={whyRef} className="bc-why" aria-live="polite"/>
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
      {/* rock / roots QTE: a big Space key over the bottom of the scene and the top of the text; the bar runs out with the window */}
      {/* dive: lower, clear of the scene — the tail and the water are the cue to watch */}
      {qteKind !== 'crows' && <div className={'bc-qte' + (qteView ? ' show ' + qteView : '')} style={{ top: height + (qteKind === 'dive' ? 82 : 30) }} aria-live="assertive">
        {qteKind === 'shift' && qteSeq
          ? <div className="bc-qte-caps">
              <div className={'bc-qte-cap wide' + (qteSeq.shiftDown || qteSeq.i ? ' held' : '')}>⇧ Shift</div><span className="bc-qte-arrow">+</span>
              <div key={'k' + qteSeq.bad} className={'bc-qte-cap' + (qteSeq.i ? ' done' : '') + (qteSeq.bad ? ' bad' : '')}>{keyFace(qteSeq.keys[0])}</div></div>
          : qteKind === 'word' && qteSeq
          ? <div className="bc-qte-caps"><div key={'w' + qteSeq.bad} className={'bc-qte-cap word' + (qteSeq.bad ? ' bad' : '') + (qteSeq.i >= qteSeq.keys.length ? ' done' : '')}>
              {qteSeq.keys.map((c, i) => <span key={i} style={{ color: i < qteSeq.i ? '#2f8a3a' : INK, textDecoration: i === qteSeq.i ? 'underline' : 'none',
                textUnderlineOffset: 6 }}>{c}</span>)}</div></div>
          : qteKind === 'seq' || qteKind === 'num'
          ? <div className="bc-qte-caps">{(qteSeq ? qteSeq.keys : []).map((k, i) => [
              i > 0 && <span key={'a' + i} className="bc-qte-arrow">→</span>,
              <div key={i + '-' + (i === (qteSeq && qteSeq.i) ? qteSeq.bad : 0)}
                className={'bc-qte-cap' + (i < qteSeq.i ? ' done' : '') + (i === qteSeq.i && qteSeq.bad ? ' bad' : '')}>{keyFace(k)}</div>])}</div>
          : <div className={'bc-qte-key' + (diveHeld ? ' held' : '')} style={{ fontFamily: PX_FONT }}>SPACE</div>}
        <div className="bc-qte-word">{boss.qteText ? (qteView === 'ok' ? boss.qteText.ok : qteView === 'miss' ? boss.qteText.miss : boss.qteText.on)
          : qteKind === 'roots'
          ? (qteView === 'ok' ? 'หลุดแล้ว!' : qteView === 'miss' ? 'โดนรากพันขา!' : 'รัว SPACE ดิ้นให้หลุด!')
          : qteKind === 'dive' ? qteWord
          : qteKind === 'seq' ? (qteView === 'ok' ? 'ข้ามได้!' : qteView === 'miss' ? 'โดนหินกลิ้งใส่!' : 'กดตามลำดับ กระโดด ' + ((qteSeq && qteSeq.keys.length) || 2) + ' จังหวะ!')
          : qteKind === 'shift' ? (qteView === 'ok' ? 'ไล่ค้างคาวไปแล้ว!' : qteView === 'miss' ? 'โดนค้างคาวชน!' : 'กด Shift ค้างไว้ แล้วกดตัวนี้!')
          : qteKind === 'word' ? (qteView === 'ok' ? 'หนังสือเวทแตกกระจาย!' : qteView === 'miss' ? 'โดนหนังสือเวทฟาด!' : 'พิมพ์คำนี้ ทำลายหนังสือเวท!')
          : qteKind === 'num' ? (qteView === 'ok' ? 'เฟืองพังแล้ว!' : qteView === 'miss' ? 'โดนเฟืองชน!' : 'พิมพ์เลขไทยบนเฟือง หยุดมันซะ!')
          : (qteView === 'ok' ? 'เยี่ยม!' : qteView === 'miss' ? 'โอ๊ะ!' : 'กดเพื่อกระโดดหลบ!')}</div>
        {qteKind === 'roots' && <div ref={pipsRef} className="bc-pips">{Array.from({ length: MASH_NEED }, (_, i) => <i key={i}/>)}</div>}
        <div className="bc-qte-track"><div ref={qteBarRef} className="bc-qte-bar"/>
          {qteKind === 'dive' && [<div key="z" className="bc-qte-zone" style={{ width: (100 * (1 - DIVE_SAFE / DIVE_SECS)) + '%' }}/>,
            <div key="m" className="bc-qte-mark" style={{ left: (100 * (1 - DIVE_HIT / DIVE_SECS)) + '%' }}/>]}</div>
      </div>}
      {/* crows QTE: a rhythm track — a note per crow slides to the ring on the beat */}
      {qteKind === 'crows' && <div className={'bc-rt' + (qteView ? ' show' : '')} style={{ top: height - 26 }} aria-live="assertive">
        <div className={'bc-rt-title ' + (rtTitle ? rtTitle.cls : '')}>{rtTitle && rtTitle.text}</div>
        <div ref={rtDotsRef} className="bc-rt-dots"/>
        <div ref={rtLaneRef} className="bc-rt-lane"><div ref={rtRingRef} className="bc-rt-ring"/></div>
        <div ref={rtJudgeRef} className="bc-rt-judge"/>
      </div>}
      <div className={'bc-cue' + (cue ? ' show' + (cue.go ? ' go' : '') : '')} style={{ top: height + 30 }} aria-live="assertive">{cue && cue.text}</div>
      {talk && ReactDOM.createPortal(<BossTalk boss={boss} talk={talk} big={big} rect={host}/>, document.body)}
    </div>
  );
}
