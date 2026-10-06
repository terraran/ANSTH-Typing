// Sound for แป้นพิมพ์ผจญภัย — 8-bit sound effects and chiptune music, all generated in code (no audio files).
//   sfx('wrong')            play one effect (names in SFX below)
//   sfx.type(combo)         the student's chosen "correct key" sound (tick / pop / click / off)
//   music('home' | null)    switch the background song (songs in src/data/music.js); null = silence
//   setRage(true)           boss song speeds up ("boss almost beaten")
//   useSoundSettings()      React hook: { music, sfx, typeSound } + setters (saved on this device)
// Browsers only allow sound after the first click or key press; until then everything is queued silently.
import { TRACKS } from '../data/music';

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
};
export function sfx(name, arg) {
  if (!ready() || settings.sfx === 0 || !SFX[name]) return;
  try { SFX[name](arg); } catch (e) {}
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
export function speechPlan(text, maxMs = 2600) {
  const clean = String(text || '').replace(/\*\*/g, '').replace(/\[[^\]]+\]/g, ' ก ');
  const out = []; let at = 0, base = 7, gap = 0;
  for (const w of words(clean)) {
    if (/[.!?…]/.test(w)) {           // sentence end: shape the last syllable, then a breath
      const last = out[out.length - 1];
      if (last) last.p += w.includes('?') ? 4 : -3;
      gap = Math.max(gap, 280); base = 6 + Math.floor(Math.random() * 3); continue;
    }
    if (/^[\s,]+$/.test(w)) { gap = Math.max(gap, w.includes(',') ? 180 : 90); continue; }
    const n = syllables(w);
    if (!n) continue;
    at += gap || (out.length ? 30 : 0); gap = 0;
    for (let i = 0; i < n; i++) {
      if (at > maxMs) return out;
      base = Math.max(3, Math.min(11, base + (Math.random() * 4 - 2)));
      out.push({ at: Math.round(at), p: Math.round(base) });
      at += 135 + Math.random() * 40;
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
function startTrack(id) {
  const tr = trackOf(id);
  if (!tr || !ctx) return;
  if (settings.music === 0) { curTrack = null; return; }     // silent: start when the student turns music up
  clearInterval(timer);
  if (curTrack) {   // fade the old song out on its own bus
    const old = musicBus; old.gain.setTargetAtTime(0, ctx.currentTime, 0.08); setTimeout(() => old.disconnect(), 600);
    musicBus = newMusicBus();
  }
  curTrack = tr; step = 0; nextT = ctx.currentTime + 0.12;
  timer = setInterval(tick, 25); tick();
}
// Switch the background song (same id again = keep playing). null = silence.
export function music(id) {
  if (id === curWanted) return;
  curWanted = id || null; rage = false;
  clearInterval(timer);
  if (ctx && curTrack) {
    const old = musicBus; old.gain.setTargetAtTime(0, ctx.currentTime, 0.12); setTimeout(() => old.disconnect(), 800);
    musicBus = newMusicBus();
  }
  curTrack = null;
  if (curWanted && ready()) startTrack(curWanted);
}
export function setRage(on) {
  on = !!on;
  if (on === rage) return;
  rage = on;
  if (on && curTrack && curTrack.group === 'boss' && settings.music > 0) sfx('rage');
}

// Every button click in the app makes a soft click (the typing area has no buttons, so typing is unaffected).
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('button');
    if (b && !b.disabled && !b.hasAttribute('data-nosound')) sfx('ui');
  }, true);
}
