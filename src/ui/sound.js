// Sound for แป้นพิมพ์ผจญภัย — 8-bit sound effects and chiptune music, all generated in code (no audio files).
//   sfx('wrong')            play one effect (names in SFX below)
//   sfx.type(combo)         the student's chosen "correct key" sound (tick / pop / click / off)
//   music('home' | null)    switch the background song; null = silence. Every song is orchestral now (src/ui/orchestra.js):
//                           home / race / calm = MAIN_SONGS · boss1–9 (boss lesson steps 1–2) = that boss's chase song from far away ·
//                           theme1–9 = the boss chase's story song. (The 8-bit TRACKS in src/data/music.js are only a fallback.)
//   setRage(true)           boss song speeds up ("boss almost beaten"); a story song moves to its rage section
//   music('theme1')         the boss chase's orchestral story song for a stage (SONGS in src/ui/orchestra.js)
//   bossSection('dash')     move the story song along with the chase: intro · dash · p1 · p2 · stomp · win · escape · lost
//   bossMood({ under, tangle })   stage 4 diving = the song goes muffled · stage 3 roots = the song drags
//   chaseMode(stage | null) while a boss chase is on screen, its sound effects are the orchestral ones (+ that boss's laugh)
//   useSoundSettings()      React hook: { music, sfx, typeSound } + setters (saved on this device)
// Browsers only allow sound after the first click or key press; until then everything is queued silently.
import { TRACKS } from '../data/music';
import { SONGS, MAIN_SONGS, FAR, makeOrchestra, setUnderwater, setLowpass, setLevel, playChaseSfx } from './orchestra';
import { isLite } from './lite';

const { useEffect, useState } = React;

// ── settings (per device) ─────────────────────────────────────────
const KEY = 'soundSettings';
const DEFAULTS = { music: 0.2, sfx: 0.5, typeSound: 'tick' };   // computer room: music off, effects at half
const TYPE_SOUNDS = ['tick', 'pop', 'click', 'off'];
let settings = { ...DEFAULTS };
try {
  const s = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (s) settings = {
    music: clamp(s.music ?? DEFAULTS.music), sfx: clamp(s.sfx ?? DEFAULTS.sfx),
    typeSound: TYPE_SOUNDS.includes(s.typeSound) ? s.typeSound : DEFAULTS.typeSound,
  };
} catch (e) {}
function clamp(v) { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.min(1, Math.round(v * 10) / 10)) : 0; }
const subs = new Set();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
  subs.forEach(f => f({ ...settings }));
}
export function getSoundSettings() { return { ...settings }; }
export function setSoundSetting(k, v) {
  if (k === 'typeSound') { if (!TYPE_SOUNDS.includes(v)) return; settings.typeSound = v; }
  else if (k === 'music' || k === 'sfx') settings[k] = clamp(v);
  else return;
  applyVolumes(); save();
}
let lastSfx = DEFAULTS.sfx, lastMusic = 0.6;
export function toggleMuteAll() {
  if (settings.music === 0 && settings.sfx === 0) { settings.sfx = lastSfx || DEFAULTS.sfx; settings.music = lastMusic; }
  else { lastSfx = settings.sfx; lastMusic = settings.music; settings.music = 0; settings.sfx = 0; }
  applyVolumes(); save();
}
export function useSoundSettings() {
  const [s, setS] = useState(getSoundSettings);
  useEffect(() => { subs.add(setS); return () => subs.delete(setS); }, []);
  return s;
}

// ── audio graph ───────────────────────────────────────────────────
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, pulse = null;
function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try { ctx = new AC(); } catch (e) { return false; }
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx; sfxBus.connect(master);
  musicBus = newMusicBus();
  return true;
}
const ready = () => ctx && ctx.state === 'running';
function newMusicBus() {
  const g = ctx.createGain(); g.gain.value = settings.music * 0.9; g.connect(master); return g;
}
function applyVolumes() {
  if (!ctx) return;
  sfxBus.gain.setTargetAtTime(settings.sfx, ctx.currentTime, 0.03);
  musicBus.gain.setTargetAtTime(settings.music * 0.9, ctx.currentTime, 0.05);
  if (settings.music === 0 && curTrack) { clearInterval(timer); curTrack = null; }      // music off: stop scheduling
  else if (settings.music > 0 && curWanted && !curTrack && ready()) startTrack(curWanted);
}
// The first click / key unlocks audio (browser rule), then the wanted song starts.
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (!init()) return;
    if (ctx.state !== 'running') ctx.resume().then(() => { if (curWanted && !curTrack) startTrack(curWanted); }).catch(() => {});
    else if (curWanted && !curTrack) startTrack(curWanted);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

function getNoise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}
function pulseWave() {    // 25% pulse, the classic 8-bit lead
  if (pulse) return pulse;
  const n = 32, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
  return (pulse = ctx.createPeriodicWave(re, im));
}
// One note into `bus`: f0 → f1 Hz over dur s.
function tone(bus, t, f0, dur, { type = 'square', v = 0.25, f1 = f0, a = 0.004, hold = false } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  if (type === 'pulse') o.setPeriodicWave(pulseWave()); else o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
  if (hold) {     // music: short decay, then hold until the end
    g.gain.exponentialRampToValueAtTime(v * 0.55, t + Math.min(0.12, dur * 0.5));
    g.gain.setValueAtTime(v * 0.55, t + dur * 0.85);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(bus, t, dur, { v = 0.2, hp = 800, lp = 8000 } = {}) {
  const s = ctx.createBufferSource(), g = ctx.createGain(), h = ctx.createBiquadFilter(), l = ctx.createBiquadFilter();
  s.buffer = getNoise(); h.type = 'highpass'; h.frequency.value = hp; l.type = 'lowpass'; l.frequency.value = lp;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(h); h.connect(l); l.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
}

// ── sound effects ─────────────────────────────────────────────────
const N = (semi) => 523.25 * Math.pow(2, semi / 12);   // semitones from C5
const now = () => ctx.currentTime + 0.005;
const T = (f0, dur, o = {}, at = 0) => tone(sfxBus, now() + at, f0, dur, o);
const Z = (dur, o = {}, at = 0) => noise(sfxBus, now() + at, dur, o);
const notes = (list, step, o) => list.forEach((s, i) => s != null && T(N(s), o.len || step * 0.9, o, i * step));
const SFX = {
  tick: (c = 0) => T(N(Math.min(12, Math.floor(c / 4))) * 1.5, 0.045, { v: 0.09 }),
  pop: (c = 0) => { const p = Math.min(12, Math.floor(c / 4)); T(N(p + 7), 0.07, { type: 'sine', v: 0.22, f1: N(p) }); },
  click: (c = 0) => { Z(0.025, { v: 0.25, hp: 2500 + Math.min(c, 40) * 60 }); T(1800, 0.012, { v: 0.03 }); },
  wrong: () => { T(160, 0.14, { v: 0.16, f1: 90 }); Z(0.06, { v: 0.12, hp: 200, lp: 1500 }); },
  combo: (lvl = 1) => notes([0, 4, 7, 12 + (lvl > 1 ? 4 : 0)], 0.05, { v: 0.1 }),
  comboLost: () => notes([7, 3, -2], 0.06, { type: 'triangle', v: 0.18 }),
  freeze: () => { T(1600, 0.4, { type: 'sine', v: 0.12, f1: 200 }); Z(0.3, { v: 0.08, hp: 4000 }); },
  star: (i = 0) => { T(N(12 + i * 4), 0.25, { v: 0.11 }); T(N(24 + i * 4), 0.18, { type: 'sine', v: 0.08 }, 0.03); },
  stepClear: () => notes([0, 4, 7, 12], 0.07, { type: 'triangle', v: 0.22 }),
  fanfare: () => notes([12, 16, 19, 24], 0.08, { v: 0.11, len: 0.3 }),
  unlock: () => { notes([0, 7, 12, 16, 19, 24], 0.05, { v: 0.08 }); [0, 1, 2, 3].forEach(i => T(N(28 + i * 2), 0.25, { type: 'sine', v: 0.06 }, 0.32 + i * 0.07)); },
  newRecord: () => notes([12, null, 12, 16, 19, null, 24], 0.08, { v: 0.1 }),
  count: () => T(N(0), 0.14, { v: 0.14 }),
  go: () => { T(N(12), 0.4, { v: 0.14 }); T(N(19), 0.4, { v: 0.08 }); },
  win: () => notes([0, 4, 7, 12, null, 7, 12, 16, 19], 0.09, { v: 0.11, len: 0.12 }),
  lose: () => notes([7, 6, 5, 4, null, -5], 0.16, { type: 'triangle', v: 0.2, len: 0.2 }),
  heart: () => { T(330, 0.25, { v: 0.12, f1: 110 }); Z(0.12, { v: 0.1, hp: 300, lp: 2000 }); },
  pressure: () => { T(N(12), 0.06, { v: 0.1 }); T(N(12), 0.06, { v: 0.1 }, 0.12); },
  ui: () => T(N(19), 0.03, { v: 0.07 }),
  tip: () => { T(N(7), 0.06, { type: 'sine', v: 0.18 }); T(N(14), 0.08, { type: 'sine', v: 0.15 }, 0.06); },
  blip: (p) => { const s = p == null ? 5 + Math.floor(Math.random() * 6) : p; T(N(s), 0.05, { v: 0.05, f1: N(s - 0.7) }); },
  rage: () => { T(180, 0.5, { type: 'sawtooth', v: 0.08, f1: 1400 }); Z(0.45, { v: 0.06, hp: 2000 }); },
  // boss chase (src/ui/BossChase.jsx)
  jump: () => T(N(0), 0.16, { type: 'square', v: 0.07, f1: N(12) }),
  qte: () => { T(N(12), 0.07, { type: 'square', v: 0.09 }); T(N(19), 0.12, { type: 'square', v: 0.09 }, 0.08); },
  trip: () => { T(220, 0.18, { type: 'triangle', v: 0.16, f1: 110 }); Z(0.1, { v: 0.1, hp: 200, lp: 1200 }); },
  laugh: () => [0, 0.13, 0.26].forEach((at, i) => { T(N(-3 - i), 0.09, { type: 'square', v: 0.06, f1: N(-6 - i) }, at); Z(0.05, { v: 0.05, hp: 900, lp: 2500 }, at); }),
  stomp: () => { T(140, 0.22, { type: 'square', v: 0.12, f1: 50 }); Z(0.3, { v: 0.14, hp: 300, lp: 3000 }); notes([12, 16, 19], 0.05, { v: 0.06 }); },
  chest: () => notes([7, 12, 16, 19, 24], 0.06, { type: 'triangle', v: 0.16 }),
  // boss QTEs: crows on the beat (stage 2), roots round the legs (stage 3)
  caw: () => { T(900, 0.09, { type: 'sawtooth', v: 0.05, f1: 500 }); T(850, 0.09, { type: 'sawtooth', v: 0.04, f1: 450 }, 0.1); },
  peck: () => { T(1800, 0.03, { v: 0.05, f1: 900 }); Z(0.03, { v: 0.04, hp: 3000 }); },
  kick: () => T(140, 0.18, { type: 'sine', v: 0.35, f1: 45 }),
  hit: () => T(880, 0.1, { v: 0.08, f1: 1320 }),
  root: () => { T(90, 0.35, { type: 'sawtooth', v: 0.06, f1: 60 }); Z(0.3, { v: 0.06, hp: 200, lp: 900 }); },
  snap: () => { Z(0.08, { v: 0.16, hp: 1500 }); T(300, 0.08, { type: 'square', v: 0.06, f1: 120 }); },
  // stage 4 (tail / water) and stage 5 (boulder)
  splash: () => { Z(0.35, { v: 0.12, hp: 500, lp: 4000 }); T(600, 0.2, { type: 'sine', v: 0.06, f1: 200 }); },
  dive: () => { T(500, 0.25, { type: 'sine', v: 0.08, f1: 150 }); Z(0.2, { v: 0.06, hp: 800, lp: 3000 }); },
  whoosh: () => Z(0.3, { v: 0.1, hp: 300, lp: 1500 }),
  rumble: () => { T(60, 0.5, { type: 'sawtooth', v: 0.08, f1: 40 }); Z(0.4, { v: 0.08, hp: 60, lp: 400 }); },
  // chase-only names (8-bit stand-ins; inside a chase the orchestral versions play)
  qteWrong: () => SFX.wrong(),
  mash: (n = 1) => SFX.pop(n * 3),
  qtePass: () => SFX.combo(1),
  fire: () => SFX.whoosh(),
};
// Boss chase sounds that have an orchestral version (src/ui/orchestra.js NEW_SFX); everything else stays 8-bit.
const CHASE_SFX = { jump: 'jump', qte: 'qte', hit: 'hit', qteWrong: 'wrong', trip: 'trip', laugh: 'laugh', stomp: 'stomp', chest: 'chest',
  snap: 'snap', root: 'root', mash: 'mash', caw: 'caw', peck: 'peck', splash: 'splash', dive: 'dive', whoosh: 'whoosh', rumble: 'rumble', fire: 'fire',
  count: 'count', go: 'go', ui: 'ui', qtePass: 'qtePass' };
let chaseStage = null;
export function chaseMode(stage) { chaseStage = stage || null; }
export function sfx(name, arg) {
  if (!ready() || settings.sfx === 0 || !SFX[name]) return;
  try {
    SFX[name](arg);
  } catch (e) {}
}
sfx.type = (combo) => { if (settings.typeSound !== 'off') sfx(settings.typeSound, combo); };
// ── Mr.AT's voice: one blip per (estimated) syllable ─────────────
// speechPlan(text) → [{ at: ms, p: semitone }]. Pauses between words and sentences,
// pitch drifts like speech, drops at a sentence end (rises on "?"). Capped at ~2.6 s.
const TH_CONS = /[ก-ฮ]/g, TH_LEAD = /[เแโใไ]/g, TH_VOW = /[ะัาำิีึืุู็]/g;
function syllables(w) {
  if (/[ก-๛]/.test(w)) {
    const c = (w.match(TH_CONS) || []).length;
    if (!c) return 0;
    // vowel marks that sit inside a เ-/แ-/โ- syllable belong to that syllable
    const lead = (w.match(TH_LEAD) || []).length;
    const vow = (w.replace(/[เแโ][ก-ฮ]{1,2}[่-๋]?[ะัาำิีึืุู็]+/g, 'เก').match(TH_VOW) || []).length;
    return Math.min(6, Math.max(1, lead + vow, Math.round(c / 2.5)));
  }
  const a = (w.match(/[A-Za-z0-9]/g) || []).length;
  return a ? Math.min(4, Math.ceil(a / 3)) : 0;
}
function words(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try { return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)].map(s => s.segment); } catch (e) {}
  }
  return text.split(/(\s+|[.!?…,])/);
}
export function speechPlan(text, maxMs = 1600) {
  const clean = String(text || '').replace(/\*\*/g, '').replace(/\[[^\]]+\]/g, ' ก ');
  const out = []; let at = 0, base = 7, gap = 0;
  for (const w of words(clean)) {
    if (/[.!?…]/.test(w)) {           // sentence end: shape the last syllable, then a breath
      const last = out[out.length - 1];
      if (last) last.p += w.includes('?') ? 4 : -3;
      gap = Math.max(gap, 170); base = 6 + Math.floor(Math.random() * 3); continue;
    }
    if (/^[\s,]+$/.test(w)) { gap = Math.max(gap, w.includes(',') ? 110 : 50); continue; }
    const n = syllables(w);
    if (!n) continue;
    at += gap || (out.length ? 10 : 0); gap = 0;
    for (let i = 0; i < n; i++) {
      if (at > maxMs) return out;
      base = Math.max(3, Math.min(11, base + (Math.random() * 4 - 2)));
      out.push({ at: Math.round(at), p: Math.round(base) });
      at += 80 + Math.random() * 20;
    }
  }
  return out;
}
// Speak `text`: blips on the audio clock-ish timers, onSyl(i) fires with each syllable (for the mouth).
// Returns a stop() function.
export function speak(text, onSyl) {
  const plan = speechPlan(text);
  const ids = plan.map((s, i) => setTimeout(() => { sfx('blip', s.p); onSyl && onSyl(i, plan.length); }, s.at));
  return () => ids.forEach(clearTimeout);
}

// Stars shown one by one on the result screen, then a fanfare for ⭐⭐⭐.
sfx.stars = (n) => {
  for (let i = 0; i < n; i++) setTimeout(() => sfx('star', i), 250 + i * 300);
  if (n >= 3) setTimeout(() => sfx('fanfare'), 250 + 3 * 300 + 120);
};

// ── music ─────────────────────────────────────────────────────────
const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const QUAL = { '': [0, 4, 7, 12], m: [0, 3, 7, 12], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6, 12], sus4: [0, 5, 7, 12] };
const midi = (n) => { const m = n.match(/^([A-G]#?)(\d)$/); return 12 * (+m[2] + 1) + NAMES[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const chordOf = (c) => { const m = c.match(/^([A-G]#?)(m7|maj7|dim|sus4|m)?$/); return { root: NAMES[m[1]], iv: QUAL[m[2] || ''] }; };
const S = 16;
const lenAt = (pat, i) => { let j = i + 1; while (j < S && pat[j] == null) j++; return j - i; };
const built = {};
export function buildTrack(def) {
  if (def.chordsB) def = { ...def, chords: [...def.chords, ...def.chordsB], lead: [...(def.lead || []), ...def.leadB] };
  const total = def.chords.length * S, ev = Array.from({ length: total }, () => []);
  (def.lead || []).forEach((bar, b) => {
    const t = bar.trim().split(/\s+/); let at = b * S;
    for (let i = 0; i < t.length; i += 2) { const len = +t[i + 1]; if (t[i] !== '-') ev[at].push({ i: 'lead', m: midi(t[i]) + (def.shift || 0), len }); at += len; }
  });
  def.chords.forEach((c, b) => {
    const ch = chordOf(c), bassRoot = 40 + ((ch.root - 4 + 12) % 12), arpRoot = 55 + ((ch.root - 7 + 12) % 12);
    const tones = [...ch.iv, ch.iv[1] + 12];
    def.bass.forEach((x, i) => { if (x == null) return;
      ev[b * S + i].push({ i: 'bass', m: bassRoot + ({ r: 0, '5': 7, o: 12, '3': ch.iv[1] })[x], len: lenAt(def.bass, i) }); });
    (def.arp || []).forEach((x, i) => { if (x == null) return;
      ev[b * S + i].push({ i: 'arp', m: arpRoot + tones[x], len: Math.min(lenAt(def.arp, i), 4) }); });
    Object.entries(def.drums || {}).forEach(([k, steps]) => steps.forEach(i => ev[b * S + i].push({ i: k })));
  });
  return { ...def, ev, total };
}
const trackOf = (id) => built[id] || (TRACKS[id] && (built[id] = buildTrack(TRACKS[id])));

let curWanted = null, curTrack = null, timer = 0, step = 0, nextT = 0, rage = false;
function fire(tr, e, t, sd) {
  const V = tr.vol, B = musicBus;
  if (e.i === 'lead') tone(B, t, hz(e.m), e.len * sd * 0.92, { type: 'pulse', v: V.lead, a: 0.006, hold: true });
  else if (e.i === 'bass') tone(B, t, hz(e.m), e.len * sd * 0.9, { type: 'triangle', v: V.bass, a: 0.006, hold: true });
  else if (e.i === 'arp') tone(B, t, hz(e.m), e.len * sd * 0.85, { type: tr.arpWave || 'square', v: V.arp, a: 0.006, hold: true });
  else if (e.i === 'kick') tone(B, t, 150, 0.14, { type: 'sine', v: V.drum * 0.8, f1: 45, a: 0.002 });
  else if (e.i === 'tom') tone(B, t, 220, 0.18, { type: 'triangle', v: V.drum * 0.6, f1: 90, a: 0.002 });
  else if (e.i === 'snare') noise(B, t, 0.11, { v: V.drum * 0.3, hp: 900, lp: 5000 });
  else if (e.i === 'hat') noise(B, t, 0.03, { v: V.drum * 0.12, hp: 7000, lp: 14000 });
}
function tick() {
  const tr = curTrack;
  if (!tr || !ready()) return;
  const fast = rage && tr.group === 'boss';
  const sd = 60 / (tr.bpm * (fast ? 1.15 : 1)) / 4;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;      // tab was asleep: don't burst
  while (nextT < ctx.currentTime + 0.15) {
    const evs = tr.ev[step];
    evs.forEach(e => fire(tr, e, nextT, sd));
    if (fast) {   // boss almost beaten: 16th hats, extra kicks, chords doubled an octave up
      const inBar = step % S;
      if (!evs.some(e => e.i === 'hat')) fire(tr, { i: 'hat' }, nextT, sd);
      if (inBar === 2 || inBar === 10) fire(tr, { i: 'kick' }, nextT, sd);
      evs.forEach(e => { if (e.i === 'arp') tone(musicBus, nextT, hz(e.m + 12), e.len * sd * 0.8, { v: tr.vol.arp * 0.7, a: 0.006, hold: true }); });
    }
    nextT += sd; step = (step + 1) % tr.total;
  }
}
// ── boss-chase story songs (orchestra): sections follow the chase; a change waits for the next beat ──
const ENDINGS = ['win', 'escape', 'lost'];
let story = null;              // { S: sections, sec, pos, pending, first, over, back, backPos }
let storySec = 'intro';        // the section the chase is in now (kept even while music is off / not started yet)
let tangle = false;            // stage 3: roots hold the hero → the song drags
const storyStage = (id) => (/^theme(\d+)$/.exec(id || '') || [])[1];
const farStage = (id) => (/^boss(\d+)$/.exec(id || '') || [])[1];
const BAR = (sec) => sec.steps || 16, BEAT = (sec) => sec.beat || 4;       // 3/4 & 6/8 = 12 steps, 7/8 = 14, 5/4 = 20
const BPM = (sy, sec) => sec.bpm || (sy.S[sy.back] || sy.S.p1).bpm;           // a stomp plays at the tempo it interrupted
const secDur = (sy, sec) => 60 / BPM(sy, sec) / 4 * (tangle && sec.tangle ? 1.45 : 1) * (sy.kind === 'far' ? 1 / FAR.tempo : 1);
export const hasBossTheme = (stage) => !!SONGS[stage];
// The chase moves on (src/ui/BossChase.jsx). Same section again = keep playing.
// 'stomp' is a detour: 4 bars of the village theme, then back to the chase / rage section at its next bar.
export function bossSection(name) {
  if (name !== 'stomp') storySec = name;
  if (!story || story.over || story.kind !== 'theme') return;
  if (name === 'stomp' && (story.sec === 'stomp' || story.pending === 'stomp' || !['p1', 'p2'].includes(story.pending || story.sec))) return;
  if (story.sec === 'stomp' && name === 'p2') { story.back = 'p2'; story.backPos = 0; return; }   // rage during a stomp: go there after it
  if (name === (story.pending || story.sec)) return;
  story.pending = name;
}
export function bossMood({ under, tangle: tg } = {}) {
  if (under !== undefined) setUnderwater(!!under);
  if (tg !== undefined) tangle = !!tg;
}
function tickStory() {
  const sy = story;
  if (!sy || sy.over || !ready()) return;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;      // tab was asleep: don't burst
  while (nextT < ctx.currentTime + 0.15) {
    if (sy.pending && sy.pos % BEAT(sy.S[sy.sec]) === 0) {         // a change waits for the next beat
      if (sy.pending === 'stomp') { const from = sy.S[sy.sec], L = BAR(from); sy.back = sy.sec; sy.backPos = (Math.ceil(sy.pos / L) * L) % (from.bars * L); }
      sy.sec = sy.pending; sy.pending = null; sy.pos = 0; sy.first = true;
    }
    const sec = sy.S[sy.sec];
    if (!sec) { sy.over = true; clearInterval(timer); return; }
    const sd = secDur(sy, sec), L = BAR(sec);
    sec.play(Math.floor(sy.pos / L), sy.pos % L, nextT, sd, sy.first && sy.kind !== 'far');   // far away: no opening BRAAAM
    nextT += sd; sy.pos++;
    if (sy.pos >= sec.bars * L) {
      sy.pos = 0; sy.first = false;
      if (sec.back) { sy.sec = sy.back || 'p1'; sy.pos = sy.backPos || 0; }
      else if (sec.next) { sy.sec = sec.next; sy.first = true; }
      else if (!sec.loop) { sy.over = true; clearInterval(timer); return; }    // an ending: played once, rings out
    }
  }
}
function startTrack(id) {
  const n = storyStage(id), fs = farStage(id), orch = n ? SONGS[n] : fs ? SONGS[fs] : MAIN_SONGS[id];
  const kind = n ? 'theme' : fs ? 'far' : 'main';
  const tr = orch ? { group: kind === 'main' ? 'main' : 'boss', story: true } : trackOf(id);
  if (!tr || !ctx) return;
  if (settings.music === 0) { curTrack = null; return; }     // silent: start when the student turns music up
  clearInterval(timer);
  if (curTrack) {   // fade the old song out on its own bus
    const old = musicBus; old.gain.setTargetAtTime(0, ctx.currentTime, 0.08); setTimeout(() => old.disconnect(), 600);
    musicBus = newMusicBus();
  }
  curTrack = tr; step = 0; nextT = ctx.currentTime + 0.12; story = null;
  if (orch) {
    // a story song's ending that has already played (music turned back on later) stays silent
    const hall = makeOrchestra(ctx, musicBus);
    if (isLite()) hall.wet.disconnect();     // light mode: no hall reverb (the reverb is the heaviest part of the music)
    if (kind === 'far') { setLowpass(FAR.lowpass); setLevel(FAR.level); }      // the boss is waiting ahead: muffled, quieter
    story = { S: orch, kind, sec: kind === 'theme' ? storySec : kind === 'far' ? 'p1' : 'main', pos: 0, pending: null, first: true, over: false, back: null, backPos: 0 };
    if (kind === 'theme' && ENDINGS.includes(storySec)) story.over = true;
    else { timer = setInterval(tickStory, 25); tickStory(); }
    return;
  }
  timer = setInterval(tick, 25); tick();
}
// Switch the background song (same id again = keep playing). null = silence.
export function music(id) {
  if (id === curWanted) return;
  // a story song's ending (win / escape / lost) is not cut when the results screen asks for silence: it plays out and rings
  if (!id && story && ENDINGS.includes(story.pending || story.sec)) { curWanted = null; rage = false; return; }
  curWanted = id || null; rage = false; story = null;
  if (storyStage(id) && ENDINGS.includes(storySec)) storySec = 'intro';     // left over from the last chase
  clearInterval(timer);
  if (ctx && curTrack) {
    const old = musicBus; old.gain.setTargetAtTime(0, ctx.currentTime, 0.12); setTimeout(() => old.disconnect(), 800);
    musicBus = newMusicBus();
  }
  curTrack = null;
  if (curWanted && ready()) startTrack(curWanted);
}
// The beat of the song playing now, so the boss chase can land crows on it (stage 2's rhythm QTE):
// { beat: seconds per beat, next: audioTime() of the next beat } — null when no song is playing (music off / not started).
export function beatGrid() {
  if (!curTrack || !ready()) return null;
  if (story) {
    const sec = !story.over && story.S[story.sec];
    if (!sec) return null;
    const sd = secDur(story, sec), b = BEAT(sec);                       // stage 2's chase is 6/8: a beat = 6 sixteenths
    return { beat: sd * b, next: nextT + ((b - story.pos % b) % b) * sd };
  }
  const fast = rage && curTrack.group === 'boss';
  const sd = 60 / (curTrack.bpm * (fast ? 1.15 : 1)) / 4;            // one 16th; a beat = 4 of them
  return { beat: sd * 4, next: nextT + ((4 - step % 4) % 4) * sd };   // nextT = time of `step`, the next one not yet scheduled
}
export const audioTime = () => (ctx ? ctx.currentTime : 0);
export function setRage(on) {
  on = !!on;
  if (on === rage) return;
  rage = on;
  // boss lesson steps 1–2 (far away): near the end of the text the faraway song moves to its rage section too
  if (story && story.kind === 'far') { if (on && story.sec === 'p1' && !story.pending) story.pending = 'p2'; return; }
  // a story song has its own rage section (BRAAAM + gong) instead of the chiptune sting
  if (on && ['intro', 'lurk', 'dash', 'p1', 'stomp'].includes(story ? (story.pending || story.sec) : storySec) && (story || storyStage(curWanted))) { bossSection('p2'); return; }
  if (on && curTrack && curTrack.group === 'boss' && settings.music > 0) sfx('rage');
}

// Every button click in the app makes a soft click (the typing area has no buttons, so typing is unaffected).
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('button');
    if (b && !b.disabled && !b.hasAttribute('data-nosound')) sfx('ui');
  }, true);
}
