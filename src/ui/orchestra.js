// Orchestra for the boss chase (src/ui/BossChase.jsx): every stage's story song, and the chase's sound effects.
// All synthesized with Web Audio (no audio files). Built from the approved mock .claude/mock/boss-theme.html by a script —
// change a sound in the mock first, then rebuild this file, so the two stay the same.
//   SONGS[stage]                    sections of a stage's song (see src/ui/sound.js for how they are played)
//     section = { bpm (null = the tempo of the section it interrupts), bars, steps (bar length in 16ths, default 16),
//                 beat (steps per beat, default 4), chords, loop | next | back, tangle?, play(bar, step, time, secondsPerStep, firstPass) }
//     intro → (lurk) → dash → p1 (chase) → p2 (rage, the boss's own song) → win / escape / lost; stomp = 4 bars of the
//     village theme after the hero stomps the boss, then back to where the song was (`back`)
//   makeOrchestra(ctx, out)         the hall for a song: voices → reverb → glue compressor → `out` (the music bus)
//   setUnderwater(on)               muffle the song (stage 4, the hero diving under the tail)
//   playChaseSfx(ctx, bus, stage, name, arg)   one chase sound effect into `bus` (the sfx bus); false if it has none
// One event = one sound: the music never plays event sounds (stomp, splash, rumble …) — those are the sound effects.

// ── notes ──
const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7] };
const midi = (n) => { const m = n.match(/^([A-G]#?)(\d)$/); return 12 * (+m[2] + 1) + NAMES[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const chord = (c) => { const m = c.match(/^([A-G]#?)(m)?$/), r = NAMES[m[1]];
  return { bass: 40 + ((r - 4 + 12) % 12), mid: 55 + ((r - 7 + 12) % 12), iv: QUAL[m[2] || ''] }; };
function line(bars, shift = 0, stretch = 1, barLen = 16) {      // "A5 2 - 2 C6 4" bars → Map(step → [{m, len}])
  const map = new Map();
  bars.forEach((bar, b) => { let at = b * barLen; const t = bar.trim().split(/\s+/);
    for (let i = 0; i < t.length; i += 2) { const len = +t[i + 1] * stretch;
      if (t[i] !== '-') { const k = Math.round(at); (map.get(k) || map.set(k, []).get(k)).push({ m: midi(t[i]) + shift, len }); } at += len; } });
  return map;
}

// ── audio graph (stereo): voices → hall bus → (dry + 30 ms pre-delay reverb) → trim → glue compressor → underwater lowpass → level → out ──
let C = null, G = null;
const LEVEL = 0.55, WET = 0.5;          // music: the chase phase comes out about as loud as the chiptune songs
const SFX_LEVEL = 1.22;                 // sound effects: levels in NEW_GAIN were matched to the 8-bit set at this level (0.55 / 0.45)
function graph(ctx, dst, verb = 4.5, level = LEVEL) {
  const out = ctx.createGain(); out.gain.value = level; out.connect(dst);
  const uw = ctx.createBiquadFilter(); uw.type = 'lowpass'; uw.frequency.value = 20000; uw.Q.value = 0.8; uw.connect(out);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.008; comp.release.value = 0.3; comp.connect(uw);
  const trim = ctx.createGain(); trim.gain.value = 0.55; trim.connect(comp);
  const bus = ctx.createGain(); bus.connect(trim);
  const pre = ctx.createDelay(); pre.delayTime.value = 0.03;
  const conv = ctx.createConvolver(); conv.buffer = impulse(ctx, verb);
  const wet = ctx.createGain(); wet.gain.value = WET;
  bus.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(trim);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
  return { out, wet, bus, noise: nb, curve, choir: {}, uw };
}

function impulse(ctx, secs) {
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const x = i / len, k = 0.42 - 0.38 * x; lp += k * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.pow(1 - x, 2) * (i < ctx.sampleRate * 0.03 ? i / (ctx.sampleRate * 0.03) : 1); } }
  return b;
}
function dest(node, pan = 0) {          // connect a voice into the hall, placed left (-1) … right (+1)
  if (!pan) { node.connect(G.bus); return; }
  const p = C.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(G.bus);
}

// ── voices ──
function env(g, t, v, a, dur, r) {
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(a, dur * 0.8));
  g.gain.setValueAtTime(v, t + Math.max(dur, a * 0.8)); g.gain.setTargetAtTime(0.0001, t + Math.max(dur, a * 0.8), r / 3);
}
function vibrato(t, end, f, oscs, depth = 0.0045, rate = 5.4, delay = 0.18) {
  const l = C.createOscillator(), lg = C.createGain(); l.frequency.value = rate * (0.93 + Math.random() * 0.14);
  lg.gain.setValueAtTime(0, t + delay); lg.gain.linearRampToValueAtTime(f * depth, t + delay + 0.3);
  l.connect(lg); oscs.forEach(o => lg.connect(o.frequency)); l.start(t); l.stop(end);
}
function osc(type, f, t, end, detune, to) { const o = C.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune || 0; o.connect(to); o.start(t); o.stop(end); return o; }
function tone(t, f0, dur, { type = 'sine', v = 0.25, f1 = f0, a = 0.004, pan = 0 } = {}) {
  const o = C.createOscillator(), g = C.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); dest(g, pan); o.start(t); o.stop(t + dur + 0.02);
}
function noise(t, dur, { v = 0.2, hp = 800, lp = 8000, bp = 0, rise = false, pan = 0 } = {}) {
  const s = C.createBufferSource(), g = C.createGain(), h = C.createBiquadFilter(), l = C.createBiquadFilter();
  s.buffer = G.noise; s.loop = true; h.type = 'highpass'; h.frequency.value = hp;
  l.type = bp ? 'bandpass' : 'lowpass'; l.frequency.value = bp || lp; if (bp) l.Q.value = 0.8;
  if (rise) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05); }
  else { g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  s.connect(h); h.connect(l); l.connect(g); dest(g, pan); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.08);
}
// string section. pan: violins left (-.5), violas (-.1), celli right (+.45), basses (+.3)
function strings(t, f, dur, v, { bright = 3200, a = 0.05, r = 0.25, voices = 3, vib = true, pan = 0 } = {}) {
  const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(bright, f * 7 + 600); lp.Q.value = 0.6;
  const end = t + dur + r + 0.1, det = voices === 1 ? [0] : voices === 2 ? [-6, 6] : [-10, -3, 4, 11];
  const oscs = det.map(dc => osc('sawtooth', f, t, end, dc + Math.random() * 4 - 2, lp));
  if (vib && dur > 0.22) vibrato(t, end, f, oscs);
  env(g, t, v / det.length * 1.6, a, dur, r); lp.connect(g); dest(g, pan);
}
const vln = (t, f, d, v, o = {}) => strings(t, f, d, v, { bright: 5200, pan: -0.5, ...o });
const cello = (t, f, d, v, o = {}) => strings(t, f, d, v, { bright: 1600, pan: 0.45, ...o });
// brass section: 3 players, filter blooms open, loud notes get a little grit
function brass(t, f, dur, v, { a = 0.035, r = 0.22, open = 4, pan = 0.15, players = 3, grit = false } = {}) {
  const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.4;
  const top = Math.min(f * open, 4500);
  lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.linearRampToValueAtTime(top, t + 0.06); lp.frequency.setTargetAtTime(top * 0.7, t + 0.08, 0.15);
  const end = t + dur + r + 0.1, det = players === 3 ? [-7, 0, 7] : [-4, 4];
  const oscs = det.map(dc => osc('sawtooth', f, t, end, dc + Math.random() * 3, lp));
  if (dur > 0.35) vibrato(t, end, f, oscs, 0.0025, 5, 0.3);
  let last = lp;
  if (grit) { const ws = C.createWaveShaper(); ws.curve = G.curve; lp.connect(ws); last = ws; }
  env(g, t, v * 0.8 / Math.sqrt(det.length / 2), a, dur, r); last.connect(g); dest(g, pan);
}
const horns = (t, f, d, v, o) => brass(t, f, d, v, { pan: -0.2, open: 3.5, ...o });
const bones = (t, f, d, v, o) => brass(t, f, d, v, { pan: 0.25, open: 4.5, ...o });
function tuba(t, f, dur, v, { a = 0.03, r = 0.2 } = {}) {
  const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(Math.min(f * 5, 700), t + 0.05); lp.Q.value = 1;
  const end = t + dur + r + 0.1; osc('sawtooth', f, t, end, -3, lp); osc('square', f, t, end, 3, lp);
  env(g, t, v, a, dur, r); lp.connect(g); dest(g, 0.1);
}
// choir: 6 singers per note, split into a left and a right half, each through vowel formants
const VOWEL = { ah: [[730, 1, 8], [1090, 0.5, 10], [2440, 0.22, 16]], oh: [[500, 1, 7], [900, 0.45, 9], [2400, 0.12, 15]], oo: [[320, 1, 6], [870, 0.3, 9], [2240, 0.08, 14]] };
// The vowel filters are built once per (vowel, side, width) and shared by every note — only the singers are new per note.
function choirBus(vowel, side, width) {
  const key = vowel + side + width;
  if (G.choir[key]) return G.choir[key];
  const src = C.createGain(), mix = C.createGain();
  VOWEL[vowel].forEach(([f, amp, q]) => { const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (side ? 1.03 : 0.97); bp.Q.value = q;
    const bg = C.createGain(); bg.gain.value = amp * 5; src.connect(bp); bp.connect(bg); bg.connect(mix); });
  const body = C.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 700; const bgain = C.createGain(); bgain.gain.value = 0.25;
  src.connect(body); body.connect(bgain); bgain.connect(mix);
  const p = C.createStereoPanner(); p.pan.value = side ? width : -width; mix.connect(p); p.connect(G.bus);
  return (G.choir[key] = src);
}
function choir(t, notes, dur, v, { vowel = 'ah', a = 0.4, r = 0.6, width = 0.6, voices = 3 } = {}) {
  const end = t + dur + r + 0.2, lv = v / Math.sqrt(notes.length) * 0.3 * Math.sqrt(3 / voices);
  [0, 1].forEach(side => {
    const g = C.createGain(); g.connect(choirBus(vowel, side, width));
    notes.forEach(m => { const f = hz(m);
      const oscs = (side ? [-16, 2, 13] : [-11, -2, 18]).slice(0, voices).map(dc => osc('sawtooth', f, t, end, dc + Math.random() * 6 - 3, g));
      vibrato(t, end, f, oscs, 0.0045, 4.6 + Math.random(), 0.25); });
    env(g, t, lv, a, dur, r);
  });
}
function bell(t, f, v, ring = 5, pan = -0.3) {
  const g = C.createGain(); g.gain.value = 1; dest(g, pan);
  [[0.5, 0.5], [1, 1], [1.19, 0.45], [1.5, 0.3], [2, 0.5], [2.74, 0.25], [3, 0.2], [4.07, 0.14], [5.4, 0.08]].forEach(([k, amp], i) => {
    const o = C.createOscillator(), og = C.createGain(); o.frequency.value = f * k; o.connect(og); og.connect(g);
    const rr = ring / (1 + i * 0.35);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * amp * 0.5, t + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, t + rr);
    o.start(t); o.stop(t + rr + 0.05); });
}
function bassoon(t, f, dur, v) {
  const g = C.createGain(), bp = C.createBiquadFilter(), lp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 1.4; lp.type = 'lowpass'; lp.frequency.value = 1600;
  const end = t + dur + 0.2; const o = osc('sawtooth', f, t, end, 0, bp); if (dur > 0.3) vibrato(t, end, f, [o], 0.004, 5, 0.15);
  bp.connect(lp); env(g, t, v * 1.8, 0.02, dur, 0.08); lp.connect(g); dest(g, 0.2);
}
function pizz(t, f, v, pan = 0.3) {
  const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(f * 5, 3500), t); lp.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.25);
  osc('sawtooth', f, t, t + 0.36, 0, lp); lp.connect(g); dest(g, pan);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
}
function timpani(t, f, v, ring = 1.2) {
  const g = C.createGain(), o = C.createOscillator(), o2 = C.createOscillator(), g2 = C.createGain();
  o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); o2.frequency.value = f * 1.5; g2.gain.value = 0.3;
  o.connect(g); o2.connect(g2); g2.connect(g); dest(g, 0.15);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
  o.start(t); o2.start(t); o.stop(t + ring + 0.05); o2.stop(t + ring + 0.05);
  noise(t, 0.07, { v: v * 0.5, hp: 60, lp: 500, pan: 0.15 });
}
// big ensemble drums (taiko-style): deep body + skin slap, several players spread out
function bigDrum(t, v, { low = 1, pan = 0 } = {}) {
  tone(t, 95 * low, 0.9, { v: v, f1: 42 * low, pan });
  tone(t, 190 * low, 0.12, { type: 'triangle', v: v * 0.35, f1: 120 * low, pan });
  noise(t, 0.09, { v: v * 0.45, hp: 50, lp: 1100, pan });
}
const ensemble = (t, v) => { bigDrum(t, v, { pan: -0.35 }); bigDrum(t + 0.006, v * 0.8, { low: 0.92, pan: 0.35 }); bigDrum(t + 0.003, v * 0.7, { low: 1.12 }); };
const crash = (t, v, ring = 2.4) => { noise(t, ring, { v, hp: 3500, lp: 12000, pan: 0.4 }); noise(t, 0.3, { v: v * 0.6, hp: 1500, bp: 4500, pan: 0.4 }); };
const swell = (t, dur, v) => { noise(t, dur, { v, hp: 2500, lp: 12000, rise: true, pan: -0.3 }); noise(t, dur, { v: v * 0.8, hp: 2500, lp: 12000, rise: true, pan: 0.3 }); };
function gong(t, v) {
  [[55, 1], [88, 0.6], [131, 0.35], [197, 0.2]].forEach(([f, a]) => tone(t, f * 1.02, 4, { v: v * a, f1: f, a: 0.01 }));
  noise(t, 3, { v: v * 0.25, hp: 80, lp: 900 });
}
const sub = (t, v, dur = 2) => tone(t, 55, dur, { v, f1: 30, a: 0.01 });
// BRAAAM: low brass cluster, filter tears open, gritty — the "phase change" hit
function braaam(t, root, dur, v) {
  const g = C.createGain(), lp = C.createBiquadFilter(), ws = C.createWaveShaper(); ws.curve = G.curve;
  lp.type = 'lowpass'; lp.Q.value = 3;
  lp.frequency.setValueAtTime(120, t); lp.frequency.exponentialRampToValueAtTime(1400, t + 0.18); lp.frequency.exponentialRampToValueAtTime(380, t + dur);
  const end = t + dur + 0.8;
  [root - 24, root - 17, root - 12, root - 5].forEach(m => [-8, 8].forEach(dc => osc('sawtooth', hz(m), t, end, dc, lp)));
  lp.connect(ws); ws.connect(g); env(g, t, v, 0.04, dur, 0.7); g.connect(G.bus);
  sub(t, v * 1.4, dur + 0.5);
}

// ── the score ──
const tri = (c, base = 'mid') => { const k = chord(c); return k.iv.map(i => k[base] + i); };
const wide = (c) => { const k = chord(c), m = tri(c); return [k.bass + 12, m[0], m[1], m[2], m[0] + 12]; };   // SATB spread
// The chase theme: the boar's old motif (A · A C B A · E) turned into a gallop — short-short-LONG figures like hooves,
// octave leaps, and a dark B♭ chord (bar 6) for menace. Written an octave high; brass plays it shifted down.
const RACE = [
  'A5 1 A5 1 A5 2 C6 2 B5 1 A5 1 E5 2 - 2 E5 1 E5 1 A5 2',
  'A5 1 A5 1 B5 2 C6 2 D6 2 E6 4 C6 2 B5 2',
  'F6 1 F6 1 E6 2 D6 2 C6 2 A5 1 A5 1 C6 2 F6 4',
  'E6 2 D6 1 C6 1 B5 2 G#5 2 E5 2 G#5 2 B5 2 D6 2',
  'A5 1 A5 1 A5 2 C6 2 E6 2 A6 4 G6 2 E6 2',
  'F6 1 F6 1 D6 2 A#5 2 F6 2 A#6 4 A6 2 F6 2',
  'A6 1 A6 1 G6 2 F6 2 E6 2 F6 2 E6 2 D6 2 C6 2',
  'B5 2 C6 1 B5 1 G#5 2 E5 2 G#5 1 B5 1 E6 2 G#6 4',
];
const RACE_CHORDS = ['Am', 'Am', 'F', 'E', 'Am', 'A#', 'F', 'E'];
const hint = line([RACE[0]], -24);
const race = line(RACE, -12);
const winHorn = line(['- 8 E4 4 G#4 4', 'A4 32'], 0);
const escHorn = line(['A4 3 - 1 A4 2 C5 2 E5 8', '- 16'], 0);
const escTease = line(['- 16', '- 8 A4 2 - 2 E4 4'], -12);
const lostBsn = line([RACE[0], RACE[1]], -24);
const snare = (t, v) => { noise(t, 0.14, { v, hp: 700, bp: 3200, pan: -0.15 }); tone(t, 190, 0.07, { type: 'triangle', v: v * 0.5, f1: 150, pan: -0.15 }); };
// gallop under everything: ta-ta-TUM on every beat
function gallop(s, t, sd, root, H, loud = 1) {
  const p = s % 4; if (p === 3) return;
  const tum = p === 2, off = tum && (s === 6 || s === 14) ? 12 : 0;
  cello(t, H(root + off), sd * (tum ? 1.6 : 0.8), (tum ? 0.15 : 0.09) * loud, { a: 0.005, r: 0.05, voices: 2, vib: false });
  if (tum) strings(t, H(root - 12), sd * 1.6, 0.11 * loud, { bright: 600, a: 0.005, r: 0.05, voices: 2, vib: false, pan: 0.3 });
}
// brass on the chase theme: marcato — short notes clipped, long notes leaned on
function brassTheme(t, sd, n, H, v = 1) {
  const d = n.len <= 1 ? sd * 0.8 : n.len * sd * 0.85;
  horns(t, H(n.m), d, 0.085 * v, { grit: true, a: 0.012 });
  bones(t, H(n.m - 12), d, 0.07 * v, { grit: true, a: 0.012 });
  if (n.len >= 2) tuba(t, H(n.m - 24), d, 0.065 * v);
}

// ═══════════════ v4 · composed fresh: two themes fight — the village (us) vs the boar ═══════════════
// extra voices
function flute(t, f, dur, v, pan = -0.25) {
  const g = C.createGain(), end = t + dur + 0.3;
  const o = osc('sine', f, t, end, 0, g), g2 = C.createGain(); g2.gain.value = 0.12; g2.connect(g);
  const o2 = osc('triangle', f * 2, t, end, 0, g2);
  if (dur > 0.2) vibrato(t, end, f, [o, o2], 0.005, 5, 0.12);
  env(g, t, v, 0.04, dur, 0.15); dest(g, pan);
  noise(t, Math.min(dur, 0.1), { v: v * 0.15, hp: 1000, bp: Math.min(f * 2, 8000), pan });
}
function xylo(t, f, v, pan = -0.4) {        // wooden mallets: the boar tiptoeing away with the chest
  const g = C.createGain(); dest(g, pan);
  [[1, 1, 0.4], [3.93, 0.3, 0.12], [9.2, 0.08, 0.05]].forEach(([k, a, d]) => {
    const o = C.createOscillator(), og = C.createGain(); o.frequency.value = f * k; o.connect(og); og.connect(g);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * a, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02); });
}
// "ฮึ่ม-อู๊ด!": the boar's signature — snort, two low grunts, then a slide up (tuba + contrabassoon)
function gruntNote(t, m0, m1, dur, v) {
  const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2.5;
  lp.frequency.setValueAtTime(hz(m0) * 3, t); lp.frequency.linearRampToValueAtTime(Math.min(hz(m1) * 6, 1400), t + dur * 0.6);
  const end = t + dur + 0.15;
  [['sawtooth', -6], ['square', 5]].forEach(([ty, dc]) => { const o = osc(ty, hz(m0), t, end, dc, lp);
    if (m1 !== m0) { o.frequency.setValueAtTime(hz(m0), t + dur * 0.15); o.frequency.exponentialRampToValueAtTime(hz(m1), t + dur * 0.75); } });
  env(g, t, v, 0.012, dur, 0.1); lp.connect(g); dest(g, 0.15);
}
function grunt(t, sd, root, v = 1) {
  noise(t, 0.1, { v: 0.16 * v, hp: 150, bp: 420, pan: 0.15 });
  gruntNote(t, root, root, sd * 0.9, 0.16 * v);
  gruntNote(t + sd * 2, root, root, sd * 0.9, 0.16 * v);
  gruntNote(t + sd * 4, root - 2, root + 7, sd * 3.6, 0.2 * v);
}
const alarm = (t, v) => bell(t, hz(76), v, 1.6, 0.45);

// themes
const VILLAGE = ['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 D5 8', 'E5 4 G5 2 A5 2 C6 4 B5 2 A5 2', 'G5 4 E5 2 D5 2 C5 8'];
const BOAR = [                 // swagger: dotted 3+3+2, every second bar ends with a grunt (step 8)
  'A4 3 A4 3 C5 2 E5 3 D5 3 C5 2', 'B4 3 C5 3 B4 2 - 8', 'F4 3 A4 3 C5 2 F5 3 E5 3 C5 2', 'B4 3 G#4 3 E4 2 - 8',
  'A4 3 A4 3 C5 2 E5 3 D5 3 C5 2', 'D5 3 D5 3 B4 2 - 8', 'F4 3 A4 3 C5 2 F5 3 E5 3 C5 2', 'B4 3 G#4 3 E4 2 - 8'];
const BOAR_CH = ['Am', 'Am', 'F', 'E', 'Am', 'G', 'F', 'E'];
const GRUNT_BARS = [1, 3, 5, 7];
const CHASE_V = ['- 16', '- 16', '- 16', '- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 A5 2', 'D5 4 G5 2 A5 2 B5 8', 'C6 4 A5 2 G5 2 A5 4 C6 2 F6 2', 'B5 4 G#5 2 A5 2 B5 8'];
const HERO = ['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'D5 4 G5 2 B5 2 D6 8', 'E5 4 G5 2 A5 2 C6 4 B5 2 A5 2', 'G#5 4 B5 2 E6 2 D6 8',
              'F5 4 A5 2 C6 2 A5 4 F5 2 A5 2', 'G5 4 B5 2 D6 2 G6 8', 'A5 4 C6 2 E6 2 D6 4 C6 2 B5 2', 'G#5 4 B5 4 E6 8'];
const HERO_CH = ['C', 'G', 'Am', 'E', 'F', 'G', 'Am', 'E'];
const SNEAK = ['E5 1 - 1 F5 1 - 1 E5 1 - 1 D#5 1 - 1 E5 2 - 2 B4 2 - 2', 'C5 1 - 1 D5 1 - 1 C5 1 - 1 B4 1 - 1 A4 2 - 2 E4 2 - 2',
               'F5 1 - 1 G5 1 - 1 F5 1 - 1 E5 1 - 1 C5 2 - 2 A4 2 - 2', 'G#4 1 - 1 A4 1 - 1 B4 1 - 1 C5 1 - 1 D5 2 - 2 E5 2 - 2'];
const village = line(VILLAGE), boar = line(BOAR), chaseV = line(CHASE_V), hero = line(HERO), sneak = line(SNEAK);
const winTune = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16']);
const escTune = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16']);
const sadTune = line(['- 16', '- 16', 'E5 6 D5 2 C5 8', 'A4 16']);
const mockBoar = line(BOAR.slice(0, 2), -12);

function boarBrass(t, sd, n, H, v = 1) {       // the boar's theme: heavy, swaggering, low brass + tuba
  const d = n.len * sd * 0.8;
  bones(t, H(n.m), d, 0.08 * v, { grit: true, a: 0.012 });
  horns(t, H(n.m), d, 0.055 * v, { a: 0.012 });
  tuba(t, H(n.m - 12), d, 0.07 * v);
}

const V4 = {
  intro: { bpm: 110, bars: 4, next: 'lurk', name: '1 · บอสพูด — หมู่บ้านยามสงบ', chords: ['C', 'G', 'Am', 'C'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (s === 0) { tri(c).forEach(m => strings(t, hz(m), bar, 0.035, { a: 0.4, r: 0.6, voices: 2, pan: -0.1 }));
        cello(t, hz(k.bass), bar, 0.06, { a: 0.3, r: 0.6 }); if (b === 0) bell(t, hz(60), 0.06, 5); }
      if (s % 4 === 0) pizz(t, hz(tri(c)[(s / 4) % 3] + 12), 0.08, -0.5);
      (village.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m), n.len * sd * 0.95, 0.14));
    } },
  lurk: { bpm: 120, bars: 4, loop: true, name: '1 · บอสพูด — ฮึ่ม-อู๊ด!', chords: ['Am', 'Am', 'F', 'E'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { grunt(t, sd, k.bass, 1.3); crash(t, 0.1); sub(t, 0.15, 1.5); }
      if (s === 0) { choir(t, [k.bass + 12, ...tri(c).map(m => m - 12)], bar, 0.14, { vowel: 'oo', a: 0.6, r: 0.8 });
        cello(t, hz(k.bass), bar, 0.06, { bright: 700, a: 0.3, r: 0.6, vib: false }); }
      if (s % 4 === 0) alarm(t, b % 2 ? 0.035 : 0.05);
      if (s % 4 === 0) pizz(t, hz(k.bass + (s === 8 ? 7 : 0)), 0.11);
      if (s === 0 || s === 8) timpani(t, hz(k.bass), 0.14, 0.6);
      (sneak.get(b * 16 + s) || []).forEach(n => { xylo(t, hz(n.m), 0.12); if (n.len === 1) bassoon(t, hz(n.m - 12), sd * 0.5, 0.025); });
      if ((b === 1 || b === 3) && s === 8) grunt(t, sd, k.bass, 0.8);
    } },
  dash: { bpm: 140, bars: 2, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['E', 'E'],
    play(b, s, t, sd) {
      const k = chord('E'), i = b * 16 + s, grow = i / 32;
      gallop(s, t, sd, k.bass, hz, 0.6 + 0.6 * grow);
      timpani(t, hz(k.bass), 0.05 + 0.35 * grow, 0.25);
      if (b === 0 ? s % 4 === 0 : s % 2 === 0) ensemble(t, 0.1 + 0.3 * grow);
      if (s % 2 === 0) alarm(t, 0.03 + 0.04 * grow);
      if (i === 0) { swell(t, 32 * sd, 0.24); choir(t, wide('E'), 32 * sd, 0.3, { a: 32 * sd * 0.85 });
        [k.bass, k.bass + 7].forEach(m => bones(t, hz(m), 32 * sd, 0.05, { a: 32 * sd * 0.9, open: 3 })); tuba(t, hz(k.bass - 12), 32 * sd, 0.08, { a: 32 * sd * 0.9 }); }
      if (b === 1 && s === 8) grunt(t, sd, k.bass, 1.2);
    } },
  p1: { bpm: 140, bars: 8, loop: true, name: '3 · ไล่จับ (เฟส 1)', chords: BOAR_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 57, 16 * sd * 0.9, 0.2); crash(t, 0.16); gong(t, 0.3); }
      gallop(s, t, sd, k.bass, hz);
      if (s === 0 || s === 8) ensemble(t, s ? 0.22 : 0.3);
      if (s === 0 || s === 6 || s === 12) timpani(t, hz(s === 6 ? k.bass + 7 - 12 : k.bass), s ? 0.28 : 0.4, 0.8);
      if (s === 4 || s === 12) snare(t, 0.2); else if (s === 14 || s === 15) snare(t, 0.07);
      if (s === 0) { choir(t, wide(c), 16 * sd, 0.15, { a: 0.3 }); sub(t, 0.07, 1); }
      (boar.get(b * 16 + s) || []).forEach(n => boarBrass(t, sd, n, hz));
      if (GRUNT_BARS.includes(b) && s === 8) grunt(t, sd, k.bass, 1);
      (chaseV.get(b * 16 + s) || []).forEach(n => { vln(t, hz(n.m), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m + 12), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if (b >= 4 && s % 2 === 0) xylo(t, hz(tri(c)[(s / 2) % 3] + 12), 0.04, 0.5);
      if (b === 7 && s === 0) swell(t, 16 * sd, 0.14);
      if (b === 7 && s >= 12) bigDrum(t, 0.14 + (s - 12) * 0.04, { low: 1.3, pan: (s % 2 ? 0.4 : -0.4) });
    } },
  p2: { bpm: 161, bars: 16, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...BOAR_CH, ...BOAR_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c), acc = [0, 3, 6, 8, 11, 14].includes(s);
      if (b === 0 && s === 0 && first) { braaam(t, 57, 16 * sd, 0.24); gong(t, 0.5); crash(t, 0.2, 3); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); bell(t, H(72), 0.1, 4); }
      cello(t, H(k.bass + (!acc && s % 4 === 2 ? 12 : 0)), sd * 0.9, acc ? 0.13 : 0.075, { a: 0.006, r: 0.05, voices: 2, vib: false });
      if (acc) { timpani(t, H([3, 8, 14].includes(s) ? k.bass + 7 - 12 : k.bass), 0.36, 0.7); ensemble(t, s === 0 || s === 8 ? 0.3 : 0.18);
        strings(t, H(k.bass - 12), sd * 1.2, 0.1, { bright: 600, a: 0.006, r: 0.05, voices: 2, vib: false, pan: 0.3 }); }
      if (s === 4 || s === 12) snare(t, 0.22); else snare(t, s % 2 ? 0.035 : 0.06);
      if (s === 0) { sub(t, 0.08, 1); if (bb % 4 === 0) crash(t, 0.13); }
      if (bb === 7 && s === 0) swell(t, 16 * sd, 0.14);
      // both rounds belong to the boar (round 2: half a step higher, wilder); our theme only answers a stomp ('stomp')
      if (s === 0) choir(t, wide(c).map(m => m + tr), 16 * sd, half ? 0.2 : 0.16, { a: 0.2 });
      if ([3, 6, 11, 14].includes(s)) choir(t, tri(c).map(m => m + 12 + tr), sd * 1.1, half ? 0.24 : 0.18, { a: 0.012, r: 0.15, width: 0.8, voices: 2 });
      (boar.get(bb * 16 + s) || []).forEach(n => { boarBrass(t, sd, n, H, 1.25); horns(t, H(n.m + 12), n.len * sd * 0.8, 0.05, { grit: true, a: 0.01 });
        if (half) vln(t, H(n.m + 24), n.len * sd * 0.8, 0.04, { a: 0.01, r: 0.1, voices: 2 }); });
      if (GRUNT_BARS.includes(bb) && s === 8) { grunt(t, sd, k.bass + tr, 1.3); braaam(t + sd * 4, k.bass + 17 + tr, sd * 4, half ? 0.13 : 0.1); }
      if (half && s % 2 === 0) vln(t, H(tri(c)[(s >> 1) % 3] + 24), sd * 0.8, 0.025, { a: 0.004, r: 0.04, voices: 1, vib: false });
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['G', 'C', 'G', 'C'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(43), 0.08 + 0.38 * (s / 16), 0.25); if (s % 2 === 0) ensemble(t, 0.08 + 0.25 * (s / 16));
        if (s === 0) { swell(t, bar, 0.24); choir(t, wide('G'), bar, 0.24, { a: bar * 0.8 }); bones(t, hz(43), bar, 0.06, { a: bar * 0.9 }); } }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 3 ? 2.2 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 3 ? 1.4 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(60), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); bell(t, hz(72), 0.1, 6, 0.4); sub(t, 0.2, 3);
        [48, 55, 60, 64, 67, 72].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); }
      (winTune.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้กล่องคืน', chords: ['C', 'C', 'C'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('C').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(48), 0.3); ensemble(t, 0.18); }
      if (b === 1 && s === 0) { choir(t, wide('C'), bar * 1.5, 0.18, { a: 0.2, r: 1.6 }); bell(t, hz(72), 0.07, 5); }
      (escTune.get(b * 16 + s) || []).forEach(n => { flute(t, hz(n.m), n.len * sd * 0.95, 0.12); horns(t, hz(n.m - 12), n.len * sd * 0.9, 0.06); });
      if (b === 1 && s === 8) grunt(t, sd, 45, 0.45);
    } },
  lost: { bpm: 120, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['Am', 'Am', 'Am', 'Am'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b < 2) { (mockBoar.get(b * 16 + s) || []).forEach(n => { tuba(t, hz(n.m), n.len * sd * 0.6, 0.09); bassoon(t, hz(n.m + 12), n.len * sd * 0.5, 0.04); });
        if (s % 4 === 0) pizz(t, hz(s % 8 ? 52 : 45), 0.1); if (b === 1 && s === 8) grunt(t, sd, 45, 1); }
      if (b === 2 && s === 0) { gong(t, 0.3); choir(t, [45, 52, 57, 60], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(45), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadTune.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m), n.len * sd * 0.95, 0.12));
    } },
};

// ═══════════════ stage 2 · หุ่นไล่กายักษ์: a creepy music-box waltz (the scarecrow) vs the village theme ═══════════════
// The scarecrow is a toy come alive: a music box plays its waltz (3/4), a ghostly violin slides between notes,
// crows caw, and it laughs "ฮิ-ฮิ-ฮิ". The chase gallops in 6/8 (12 steps a bar, beat = 6) — the crows still land on the beat.
function musicBox(t, f, v, pan = 0.35, sour = 0) {
  const g = C.createGain(); dest(g, pan);
  [[1, 1, 1.4], [2, 0.25, 0.6], [3.01, 0.08, 0.4], [5.4, 0.1, 0.25]].forEach(([k, a, d]) => {
    const o = C.createOscillator(), og = C.createGain();
    o.frequency.value = f * k * (1 + (Math.random() - 0.5) * (0.004 + sour)); o.connect(og); og.connect(g);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * a, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02); });
}
// a thin, eerie violin that slides up into every note, with a slow wide vibrato
function ghost(t, f, dur, v, { slide = 0.93, pan = -0.45 } = {}) {
  const g = C.createGain(), hp = C.createBiquadFilter(), lp = C.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 700; lp.type = 'lowpass'; lp.frequency.value = 6500;
  const end = t + dur + 0.4;
  const oscs = [-12, 12].map(dc => { const o = osc('sawtooth', f, t, end, dc, hp); o.frequency.setValueAtTime(f * slide, t); o.frequency.linearRampToValueAtTime(f, t + 0.2); return o; });
  vibrato(t, end, f, oscs, 0.012, 3.8, 0.25);
  hp.connect(lp); env(g, t, v, 0.08, dur, 0.3); lp.connect(g); dest(g, pan);
}
function caw(t, v = 0.1, pan = 0) {          // "กา-กา!"
  [0, 0.21].forEach(d => {
    const g = C.createGain(), bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 2.5;
    const o = C.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(860, t + d); o.frequency.exponentialRampToValueAtTime(560, t + d + 0.16);
    o.connect(bp); bp.connect(g); dest(g, pan);
    g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime(v, t + d + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.17);
    o.start(t + d); o.stop(t + d + 0.2);
    noise(t + d, 0.08, { v: v * 0.5, hp: 600, bp: 1500, pan });
  });
}
const wings = (t, v, pan) => noise(t, 0.07, { v, hp: 300, bp: 700, pan });
function wind(t, dur, v) {
  const s = C.createBufferSource(), g = C.createGain(), bp = C.createBiquadFilter();
  s.buffer = G.noise; s.loop = true; bp.type = 'bandpass'; bp.Q.value = 1.6;
  bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(1100, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(450, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  s.connect(bp); bp.connect(g); dest(g, -0.2); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function laugh(t, sd, v = 1) {               // "ฮิ-ฮิ-ฮิ!": high ghost-violin notes falling, wooden clacks under them
  [83, 81, 78].forEach((m, i) => { ghost(t + i * sd * 1.6, hz(m), sd * 1.1, 0.05 * v, { slide: 1.04, pan: -0.2 }); xylo(t + i * sd * 1.6, hz(m - 24), 0.08 * v, 0.3); });
}
// 6/8 gallop under the chase: TUM-ta on every dotted beat (steps 0-4 long, 4 short; 6-10 long, 10 short)
function ride(s, t, sd, root, H, loud = 1) {
  if (s % 2) return;
  const long = s === 0 || s === 6, short = s === 4 || s === 10;
  if (!long && !short) { cello(t, H(root + 7), sd * 0.8, 0.05 * loud, { a: 0.005, r: 0.04, voices: 2, vib: false }); return; }
  cello(t, H(root + (s === 6 ? 12 : 0)), sd * (long ? 3.4 : 1.6), (long ? 0.15 : 0.09) * loud, { a: 0.005, r: 0.05, voices: 2, vib: false });
  if (long) strings(t, H(root - 12), sd * 3.4, 0.11 * loud, { bright: 600, a: 0.005, r: 0.05, voices: 2, vib: false, pan: 0.3 });
}

const WALTZ = ['E5 4 G5 2 F#5 2 E5 4', 'D#5 4 F#5 4 B5 4', 'E5 4 G5 2 B5 2 E6 4', 'C6 6 B5 2 A5 4',
               'A5 4 C6 2 B5 2 A5 4', 'G5 4 E5 2 F#5 2 G5 4', 'F#5 4 A5 2 G5 2 F#5 4', 'E5 12'];
const WALTZ_CH = ['Em', 'B', 'Em', 'C', 'Am', 'Em', 'B', 'Em'];
const CROW_RIDE = ['E5 4 E5 2 G5 4 F#5 2', 'E5 4 B4 2 E5 4 G5 2', 'C6 4 B5 2 A5 4 G5 2', 'F#5 4 D#5 2 B4 6',
                   'E5 4 G5 2 B5 4 E6 2', 'C6 4 B5 2 A5 4 C6 2', 'B5 4 A5 2 G5 4 F#5 2', 'D#5 4 F#5 2 B5 6'];
const RIDE_CH = ['Em', 'Em', 'C', 'B', 'Em', 'Am', 'Em', 'B'];
const VIL68 = ['- 12', '- 12', '- 12', '- 12', 'E5 4 G5 2 A5 4 G5 2', 'A5 4 C6 2 D6 4 C6 2', 'B5 4 D6 2 E6 4 D6 2', 'D#6 6 F#6 6'];
const HERO68 = ['E5 4 G5 2 A5 4 G5 2', 'D5 4 G5 2 B5 6', 'E5 4 A5 2 C6 4 B5 2', 'D#5 4 F#5 2 B5 6',
                'E5 4 G5 2 C6 4 E6 2', 'D6 4 B5 2 G5 4 B5 2', 'C6 4 E6 2 A6 4 G6 2', 'F#6 6 D#6 6'];
const HERO68_CH = ['C', 'G', 'Am', 'B', 'C', 'G', 'Am', 'B'];
const waltz = line(WALTZ, 0, 1, 12), crowRide = line(CROW_RIDE, 0, 1, 12), vil68 = line(VIL68, 0, 1, 12), hero68 = line(HERO68, 0, 1, 12);
const winE = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16'], 4);
const escE = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16'], 4);
const waltzLate = line(WALTZ.slice(0, 2), 0, 1, 12);
const sadE = line(['- 12', '- 12', 'G5 6 F#5 2 E5 4', 'E5 12'], 0, 1, 12);

const B2 = {
  intro: { bpm: 96, bars: 8, steps: 12, beat: 4, next: 'lurk', name: '1 · บอสพูด — ทุ่งนายามเย็น', chords: WALTZ_CH,
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 12 * sd;
      if (b === 0 && s === 0) wind(t, 8 * bar, 0.06);
      if (s === 0) { pizz(t, hz(k.bass), 0.12); cello(t, hz(k.bass), bar, 0.04, { a: 0.4, r: 0.6, vib: false }); }
      if (s === 4 || s === 8) tri(c).slice(1).forEach(m => pizz(t, hz(m), 0.05, -0.4));
      (waltz.get(b * 12 + s) || []).forEach(n => musicBox(t, hz(n.m + 12), 0.09));
      if ((b === 2 && s === 4) || (b === 6 && s === 8)) caw(t, 0.05, 0.6);
    } },
  lurk: { bpm: 96, bars: 4, steps: 12, beat: 4, loop: true, name: '1 · บอสพูด — หุ่นไล่กาตื่น', chords: ['Em', 'C', 'Am', 'B'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 12 * sd;
      if (b === 0 && s === 0 && first) { caw(t, 0.12, -0.4); caw(t + 0.5, 0.1, 0.5); sub(t, 0.12, 1.5); }
      if (s === 0) { choir(t, [k.bass + 12, ...tri(c).map(m => m - 12)], bar, 0.13, { vowel: 'oo', a: 0.5, r: 0.8 });
        cello(t, hz(k.bass), bar, 0.06, { bright: 700, a: 0.3, r: 0.6, vib: false }); timpani(t, hz(k.bass), 0.14, 0.6); }
      if (s === 4 || s === 8) tri(c).slice(1).forEach(m => pizz(t, hz(m), 0.045, -0.4));
      const w = waltz.get(((b * 2) % 8) * 12 + s) || [];
      w.forEach(n => { ghost(t, hz(n.m), n.len * sd * 0.95, 0.05); musicBox(t, hz(n.m + 12), 0.05, 0.4, 0.03); });
      if (b === 1 && s === 6) caw(t, 0.07, 0.6);
      if (b === 3 && s === 0) laugh(t, sd, 0.9);
    } },
  dash: { bpm: 168, bars: 2, steps: 12, beat: 6, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['B', 'B'],
    play(b, s, t, sd) {
      const k = chord('B'), i = b * 12 + s, grow = i / 24;
      ride(s, t, sd, k.bass, hz, 0.6 + 0.6 * grow);
      timpani(t, hz(k.bass), 0.05 + 0.35 * grow, 0.25);
      if (s % 3 === 0) wings(t, 0.04 + 0.08 * grow, (Math.random() - 0.5) * 1.4);
      if (s % 6 === 3) caw(t, 0.05 + 0.05 * grow, (Math.random() - 0.5) * 1.4);
      if (i === 0) { swell(t, 24 * sd, 0.24); choir(t, wide('B'), 24 * sd, 0.3, { a: 24 * sd * 0.85 });
        [k.bass, k.bass + 7].forEach(m => bones(t, hz(m), 24 * sd, 0.05, { a: 24 * sd * 0.9, open: 3 })); tuba(t, hz(k.bass - 12), 24 * sd, 0.08, { a: 24 * sd * 0.9 }); }
      if (b === 1 && s === 0) laugh(t, sd, 1);
    } },
  p1: { bpm: 168, bars: 8, steps: 12, beat: 6, loop: true, name: '3 · ไล่จับ (เฟส 1)', chords: RIDE_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 52, 12 * sd * 0.9, 0.2); crash(t, 0.16); gong(t, 0.3); }
      ride(s, t, sd, k.bass, hz);
      if (s === 0 || s === 6) { ensemble(t, s ? 0.2 : 0.3); timpani(t, hz(s ? k.bass + 7 - 12 : k.bass), s ? 0.28 : 0.4, 0.8); }
      if (s === 6) snare(t, 0.2); else if (s === 10 || s === 11) snare(t, 0.06);
      if (s === 0) { choir(t, wide(c), 12 * sd, 0.14, { a: 0.3 }); sub(t, 0.07, 1); }
      if (s === 3 || s === 9) xylo(t, hz(k.bass + 24), 0.07, 0.4);
      (crowRide.get(b * 12 + s) || []).forEach(n => { const d = n.len * sd * 0.85;
        horns(t, hz(n.m - 12), d, 0.08, { a: 0.012 }); bones(t, hz(n.m - 24), d, 0.06, { grit: true, a: 0.012 });
        musicBox(t, hz(n.m + 12), 0.05, 0.45); if (n.len >= 6) ghost(t, hz(n.m), d, 0.05); });
      (vil68.get(b * 12 + s) || []).forEach(n => { vln(t, hz(n.m), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m + 12), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if ((b === 1 || b === 5) && s === 6) caw(t, 0.08, 0.6);
      if ((b === 3 || b === 7) && s === 6) laugh(t, sd, 0.9);
      if (b === 7 && s === 0) swell(t, 12 * sd, 0.14);
    } },
  p2: { bpm: 193, bars: 16, steps: 12, beat: 6, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...RIDE_CH, ...RIDE_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 52, 12 * sd, 0.24); gong(t, 0.5); crash(t, 0.2, 3); caw(t, 0.12, -0.5); caw(t + 0.3, 0.12, 0.5); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); bell(t, H(76), 0.1, 4); }
      ride(s, t, sd, k.bass, H, 1.1);
      if (s === 0 || s === 6) { ensemble(t, s ? 0.24 : 0.32); timpani(t, H(s ? k.bass + 7 - 12 : k.bass), 0.38, 0.7); }
      if (s === 6) snare(t, 0.22); else if (s % 2 === 0) snare(t, 0.05);
      if (s === 0) { sub(t, 0.08, 1); if (bb % 4 === 0) crash(t, 0.13); }
      if (bb === 7 && s === 0) swell(t, 12 * sd, 0.14);
      // both rounds belong to the scarecrow (round 2: half a step higher, the music box shrieks); our theme only answers a stomp
      if (s === 0) choir(t, wide(c).map(m => m + tr), 12 * sd, half ? 0.2 : 0.16, { a: 0.2 });
      if (s === 6) choir(t, tri(c).map(m => m + 12 + tr), sd * 1.5, 0.2, { a: 0.012, r: 0.15, width: 0.8, voices: 2 });
      (crowRide.get(bb * 12 + s) || []).forEach(n => { const d = n.len * sd * 0.85;
        horns(t, H(n.m - 12), d, 0.09, { grit: true, a: 0.01 }); bones(t, H(n.m - 24), d, 0.07, { grit: true, a: 0.01 }); tuba(t, H(n.m - 36), d, 0.06);
        musicBox(t, H(n.m + 24), half ? 0.05 : 0.04, 0.5, half ? 0.05 : 0);
        if (half && n.len >= 4) ghost(t, H(n.m + 12), d, 0.04); });
      if (s === 3 || s === 9) caw(t, half ? 0.07 : 0.05, (Math.random() - 0.5) * 1.6);
      if (half && bb % 2 === 1 && s === 6) laugh(t, sd, 0.8);
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['B', 'E', 'B', 'E'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(47), 0.08 + 0.38 * (s / 16), 0.25); if (s % 2 === 0) ensemble(t, 0.08 + 0.25 * (s / 16));
        if (s === 0) { swell(t, bar, 0.24); choir(t, wide('B'), bar, 0.24, { a: bar * 0.8 }); bones(t, hz(47), bar, 0.06, { a: bar * 0.9 }); } }
      if (b === 1 && s === 0) { [0, 0.15, 0.3, 0.5, 0.75].forEach((d, i) => caw(t + d, 0.06 - i * 0.01, (i % 2 ? 1 : -1) * 0.7)); [0, 0.1, 0.2, 0.3].forEach(d => wings(t + d, 0.08, 0.5)); }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 3 ? 2.2 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 3 ? 1.4 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(64), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); bell(t, hz(76), 0.1, 6, 0.4); sub(t, 0.2, 3);
        [52, 59, 64, 68, 71, 76].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); }
      (winE.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้กระบุงคืน', chords: ['E', 'E', 'E'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('E').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(52), 0.3); ensemble(t, 0.18); }
      if (b === 1 && s === 0) { choir(t, wide('E'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); }
      (escE.get(b * 16 + s) || []).forEach(n => { flute(t, hz(n.m), n.len * sd * 0.95, 0.12); horns(t, hz(n.m - 12), n.len * sd * 0.9, 0.06); });
      if (b === 1 && s === 4) [76, 79, 78, 76, 75].forEach((m, i) => musicBox(t + i * sd * (2.2 + i * 0.9), hz(m) * (1 - i * 0.025), 0.05 - i * 0.007, 0.6));
      if (b === 2 && s === 4) caw(t, 0.035, 0.8);
    } },
  lost: { bpm: 104, bars: 4, steps: 12, beat: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['Em', 'B', 'Em', 'Em'],
    play(b, s, t, sd) {
      const bar = 12 * sd, k = chord(this.chords[b]);
      if (b < 2) { (waltzLate.get(b * 12 + s) || []).forEach(n => musicBox(t, hz(n.m + 12), 0.08));
        if (s === 0) pizz(t, hz(k.bass), 0.1); else if (s === 4 || s === 8) tri(this.chords[b]).slice(1).forEach(m => pizz(t, hz(m), 0.04, -0.4));
        if (b === 0 && s === 8) [0, 0.25, 0.5].forEach((d, i) => caw(t + d, 0.06, (i - 1) * 0.7));
        if (b === 1 && s === 6) laugh(t, sd, 1); }
      if (b === 2 && s === 0) { gong(t, 0.3); choir(t, [40, 47, 52, 55], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(40), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadE.get(b * 12 + s) || []).forEach(n => flute(t, hz(n.m), n.len * sd * 0.95, 0.12));
    } },
};


// ═══════════════ stage 3 · พญาไม้เฒ่า: an ancient forest chant (the old tree) vs the village theme ═══════════════
// The tree is old, slow and huge: low men's choir chanting, wooden log drums, creaking wood, a breathy wooden flute.
// The chase limps along in 7/8 (14 steps a bar: 4 + 4 + 6) like a giant's uneven stride. While roots hold the hero,
// the song drags (mock: the "รากพันขา" button; in the game the roots QTE would do it).
function logDrum(t, f, v, pan = 0.2) {
  tone(t, f * 1.5, 0.28, { v, f1: f, a: 0.002, pan });
  tone(t, f * 2.3, 0.08, { type: 'triangle', v: v * 0.3, f1: f * 2, a: 0.002, pan });
  noise(t, 0.025, { v: v * 0.35, hp: 900, bp: 1800, pan });
}
function creak(t, dur, v, pan = -0.3) {     // old wood bending: a slow, wobbling low buzz through a narrow resonance
  const g = C.createGain(), bp = C.createBiquadFilter(), o = C.createOscillator();
  o.type = 'sawtooth'; bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 7;
  const n = 24, curve = new Float32Array(n); let f = 70;
  for (let i = 0; i < n; i++) { f = Math.max(45, Math.min(110, f + (Math.random() - 0.45) * 18)); curve[i] = f; }
  o.frequency.setValueCurveAtTime(curve, t, dur);
  o.connect(bp); bp.connect(g); dest(g, pan);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.2); g.gain.linearRampToValueAtTime(v * 0.6, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
function woodFlute(t, f, dur, v, pan = -0.3) {  // breathy, bends up into the note
  const g = C.createGain(), end = t + dur + 0.3;
  const o = osc('sine', f, t, end, 0, g); o.frequency.setValueAtTime(f * 0.95, t); o.frequency.linearRampToValueAtTime(f, t + 0.12);
  if (dur > 0.25) vibrato(t, end, f, [o], 0.006, 4.5, 0.2);
  env(g, t, v, 0.06, dur, 0.2); dest(g, pan);
  noise(t, dur * 0.9, { v: v * 0.22, hp: 1200, bp: Math.min(f * 2, 7000), pan });
}
const rustle = (t, dur, v) => { noise(t, dur, { v, hp: 3000, lp: 9000, rise: true, pan: -0.5 }); noise(t + dur * 0.3, dur * 0.7, { v: v * 0.7, hp: 3500, lp: 9000, pan: 0.5 }); };
function chirp(t, v, pan = 0.6) { [0, 0.09].forEach(d => tone(t + d, 2600, 0.07, { v, f1: 3900, a: 0.005, pan })); }
function groan(t, dur, v) { creak(t, dur, v); braaam(t + 0.05, 50, dur * 0.8, v * 0.5); }   // "ฮึ่มมม…" the tree wakes

// stride under the chase, 7/8 = 4 + 4 + 6: DUM · DUM · DUM-da-da (low strings + log drums)
function stride(s, t, sd, root, H, loud = 1) {
  const hit = s === 0 || s === 4 || s === 8, tail = s === 10 || s === 12;
  if (hit) { cello(t, H(root + (s === 8 ? 12 : 0)), sd * 3.2, 0.15 * loud, { a: 0.005, r: 0.05, voices: 2, vib: false });
    strings(t, H(root - 12), sd * 3.2, 0.11 * loud, { bright: 600, a: 0.005, r: 0.05, voices: 2, vib: false, pan: 0.3 });
    logDrum(t, s === 8 ? 150 : 110, 0.2 * loud, s === 4 ? -0.3 : 0.3); }
  else if (tail) { cello(t, H(root + 7), sd * 1.6, 0.08 * loud, { a: 0.005, r: 0.04, voices: 2, vib: false }); logDrum(t, 180, 0.1 * loud, 0.4); }
}

const CHANT = ['D4 8 F4 4 E4 4', 'D4 16', 'C4 8 D4 4 F4 4', 'E4 16'];                        // the tree's ancient chant (4/4, slow)
const TREE = ['D5 4 F5 4 E5 6', 'D5 4 C5 4 A4 6', 'A#4 4 D5 4 F5 6', 'E5 4 C#5 4 A4 6',      // the chant, as a 7/8 chase line
              'D5 4 F5 4 A5 6', 'G5 4 E5 4 C5 6', 'F5 4 D5 4 A#4 6', 'A4 4 C#5 4 E5 6'];
const TREE_CH = ['Dm', 'Dm', 'A#', 'A', 'Dm', 'C', 'A#', 'A'];
const VIL78 = ['- 14', '- 14', '- 14', '- 14', 'F5 4 A5 2 C6 4 A5 4', 'E5 4 G5 2 C6 8', 'D5 4 F5 2 A#5 4 A5 4', 'C#6 6 E6 8'];
const HERO78 = ['A5 4 C6 2 D6 4 C6 4', 'G5 4 C6 2 E6 8', 'F5 4 A5 2 D6 4 C6 4', 'C#6 4 E6 2 A6 8',
                'A5 4 C6 2 F6 4 E6 4', 'E6 4 D6 2 C6 8', 'D6 4 F6 2 A6 4 G6 4', 'E6 6 C#6 8'];
const HERO78_CH = ['F', 'C', 'Dm', 'A', 'F', 'C', 'Dm', 'A'];
const chant = line(CHANT), tree = line(TREE, 0, 1, 14), vil78 = line(VIL78, 0, 1, 14), hero78 = line(HERO78, 0, 1, 14);
const winD = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16'], 2);
const escD = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16'], 2);
const sadD = line(['- 16', '- 16', 'F5 6 E5 2 D5 8', 'D5 16']);
const introFlute = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 D5 8'], 2);

const B3 = {
  intro: { bpm: 72, bars: 4, next: 'lurk', name: '1 · บอสพูด — ป่าใหญ่เงียบงัน', chords: ['Dm', 'Dm', 'C', 'A'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0) rustle(t, 3, 0.05);
      if (s === 0) { cello(t, hz(k.bass), bar, 0.05, { bright: 600, a: 0.6, r: 0.8, vib: false }); tri(c).forEach(m => strings(t, hz(m), bar, 0.025, { a: 0.6, r: 0.8, voices: 2, pan: -0.1 })); }
      if ((b === 0 && s === 8) || (b === 2 && s === 4)) chirp(t, 0.035, b ? -0.6 : 0.6);
      if (b < 2) (introFlute.get(b * 16 + s) || []).forEach(n => woodFlute(t, hz(n.m), n.len * sd * 0.95, 0.08, 0.5));
      if (b === 3 && s === 0) creak(t, 1.6, 0.12);
    } },
  lurk: { bpm: 72, bars: 4, loop: true, name: '1 · บอสพูด — พญาไม้ตื่น', chords: ['Dm', 'Dm', 'C', 'A'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { groan(t, 2.4, 0.16); rustle(t + 0.4, 2, 0.06); }
      if (s === 0) { cello(t, hz(k.bass), bar, 0.07, { bright: 600, a: 0.3, r: 0.6, vib: false }); cello(t, hz(k.bass - 12), bar, 0.05, { bright: 400, a: 0.3, r: 0.6, vib: false, pan: 0.2 }); sub(t, 0.08, bar); }
      if (s === 0 || s === 6) logDrum(t, s ? 95 : 80, s ? 0.14 : 0.2, 0.1);
      (chant.get(b * 16 + s) || []).forEach(n => { choir(t, [n.m - 12, n.m], n.len * sd * 0.95, 0.24, { vowel: 'oh', a: 0.3, r: 0.6, width: 0.5 }); bones(t, hz(n.m - 12), n.len * sd * 0.9, 0.03, { a: 0.3 }); });
      if (b === 2 && s === 8) creak(t, 1.2, 0.1, 0.4);
    } },
  dash: { bpm: 150, bars: 2, steps: 14, beat: 2, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['A', 'A'],
    play(b, s, t, sd) {
      const k = chord('A'), i = b * 14 + s, grow = i / 28;
      stride(s, t, sd, k.bass, hz, 0.6 + 0.6 * grow);
      if (s % 2 === 1) logDrum(t, 200 + i * 6, 0.04 + 0.1 * grow, (Math.random() - 0.5) * 1.2);
      timpani(t, hz(k.bass), 0.05 + 0.3 * grow, 0.25);
      if (i === 0) { creak(t, 28 * sd, 0.12); swell(t, 28 * sd, 0.22); choir(t, [k.bass, ...tri('A').map(m => m - 12)], 28 * sd, 0.32, { vowel: 'oh', a: 28 * sd * 0.85 });
        tuba(t, hz(k.bass - 12), 28 * sd, 0.08, { a: 28 * sd * 0.9 }); }
    } },
  p1: { bpm: 150, bars: 8, steps: 14, beat: 2, loop: true, tangle: true, name: '3 · ไล่จับ (เฟส 1)', chords: TREE_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 50, 14 * sd * 0.9, 0.2); crash(t, 0.16); gong(t, 0.3); }
      stride(s, t, sd, k.bass, hz);
      if (s === 0 || s === 8) { ensemble(t, s ? 0.22 : 0.3); timpani(t, hz(s ? k.bass + 7 - 12 : k.bass), 0.34, 0.8); }
      if (s === 4) snare(t, 0.16); else if (s === 12 || s === 13) snare(t, 0.06);
      if (s === 0) { sub(t, 0.07, 1); tri(c).forEach(m => strings(t, hz(m), 14 * sd, 0.02, { a: 0.2, r: 0.3, voices: 2, pan: -0.1 })); }
      (tree.get(b * 14 + s) || []).forEach(n => { const d = n.len * sd * 0.9;
        choir(t, [n.m - 12, n.m - 24], d, 0.2, { vowel: 'oh', a: 0.03, r: 0.2, width: 0.5, voices: 2 });
        bones(t, hz(n.m - 12), d, 0.07, { grit: true, a: 0.012 }); tuba(t, hz(n.m - 24), d, 0.06); });
      (vil78.get(b * 14 + s) || []).forEach(n => { vln(t, hz(n.m), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m + 12), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if (b % 2 === 1 && s === 8) creak(t, 0.9, 0.08, (b % 4 === 1 ? -0.5 : 0.5));
      if (b === 7 && s === 0) swell(t, 14 * sd, 0.14);
    } },
  p2: { bpm: 172, bars: 16, steps: 14, beat: 2, loop: true, tangle: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...TREE_CH, ...TREE_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 50, 14 * sd, 0.24); gong(t, 0.5); crash(t, 0.2, 3); creak(t, 2, 0.14); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); bell(t, H(74), 0.1, 4); }
      stride(s, t, sd, k.bass, H, 1.1);
      if (s % 2 === 1) logDrum(t, 160 + (s % 4) * 40, 0.07, (s % 4 === 1 ? -0.5 : 0.5));
      if (s === 0 || s === 8) { ensemble(t, s ? 0.26 : 0.32); timpani(t, H(s ? k.bass + 7 - 12 : k.bass), 0.38, 0.7); }
      if (s === 4) snare(t, 0.2); else if (s % 2 === 0) snare(t, 0.05);
      if (s === 0) { sub(t, 0.08, 1); if (bb % 4 === 0) crash(t, 0.13); }
      if (bb === 7 && s === 0) swell(t, 14 * sd, 0.14);
      // both rounds belong to the tree (round 2: half a step higher, the whole choir); our theme only answers a stomp
      if (s === 0) { choir(t, wide(c).map(m => m + tr), 14 * sd, 0.12, { a: 0.2 }); if (half) tuba(t, H(k.bass - 12), 14 * sd * 0.9, 0.06); }
      (tree.get(bb * 14 + s) || []).forEach(n => { const d = n.len * sd * 0.9;
        choir(t, [n.m - 12 + tr, n.m + tr], d, half ? 0.34 : 0.3, { vowel: 'ah', a: 0.02, r: 0.2, width: 0.8, voices: 2 });
        horns(t, H(n.m - 12), d, 0.08, { grit: true, a: 0.01 }); bones(t, H(n.m - 24), d, 0.07, { grit: true, a: 0.01 }); tuba(t, H(n.m - 36), d, 0.06);
        if (half) vln(t, H(n.m + 12), d, 0.05, { a: 0.01, r: 0.1, voices: 2 }); });
      if (bb % 2 === 1 && s === 8) (half ? groan : creak)(t, 1, 0.1, (Math.random() - 0.5));
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['A', 'D', 'A', 'D'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(45), 0.08 + 0.38 * (s / 16), 0.25); if (s % 2 === 0) logDrum(t, 120 + s * 8, 0.06 + 0.12 * (s / 16));
        if (s === 0) { creak(t, bar, 0.12); swell(t, bar, 0.24); choir(t, wide('A'), bar, 0.24, { a: bar * 0.8 }); } }
      if (b === 1 && s === 0) { rustle(t, 2.5, 0.07); [0.2, 0.5, 0.9, 1.4].forEach((d, i) => chirp(t + d, 0.04, i % 2 ? -0.6 : 0.6)); }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 3 ? 2.2 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 3 ? 1.4 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(62), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); bell(t, hz(74), 0.1, 6, 0.4); sub(t, 0.2, 3);
        [50, 57, 62, 66, 69, 74].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); }
      (winD.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้ผลไม้คืน', chords: ['D', 'D', 'D'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('D').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(50), 0.3); logDrum(t, 110, 0.15); }
      if (b === 1 && s === 0) { choir(t, wide('D'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); chirp(t + 0.3, 0.03); }
      (escD.get(b * 16 + s) || []).forEach(n => { woodFlute(t, hz(n.m), n.len * sd * 0.95, 0.12); horns(t, hz(n.m - 12), n.len * sd * 0.9, 0.06); });
      if (b === 1 && s === 8) groan(t, 1.6, 0.06);
    } },
  lost: { bpm: 72, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['Dm', 'Dm', 'Dm', 'Dm'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b < 2) { (chant.get(b * 16 + s) || []).forEach(n => choir(t, [n.m - 12, n.m], n.len * sd * 0.95, 0.24, { vowel: 'oh', a: 0.2, r: 0.5, width: 0.5 }));
        if (s === 0 || s === 6) logDrum(t, s ? 95 : 80, 0.16); if (b === 1 && s === 8) creak(t, 1.4, 0.1); }
      if (b === 2 && s === 0) { gong(t, 0.3); choir(t, [38, 45, 50, 53], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(38), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadD.get(b * 16 + s) || []).forEach(n => woodFlute(t, hz(n.m), n.len * sd * 0.95, 0.12));
    } },
};

// Stomp (the hero catches the boss and stomps it): the village theme for 4 bars as a reward, at the tempo of the
// section it interrupts (bpm: null), then back to that section. In the game: BossChase's stomp → bossSection('stomp').
function stompHit(t, sd, k, c) { crash(t, 0.2, 2.5); timpani(t, hz(k.bass), 0.5, 1); ensemble(t, 0.35); tri(c).forEach(m => horns(t, hz(m), sd * 3, 0.06, { a: 0.008, open: 5 })); }
function heroNote(t, sd, n) { const d = n.len * sd * 0.95;
  vln(t, hz(n.m), d, 0.09, { a: 0.015, r: 0.2 }); vln(t, hz(n.m + 12), d, 0.045, { a: 0.015, r: 0.2, voices: 2 }); horns(t, hz(n.m - 12), d, 0.08, { a: 0.02, open: 5 });
  if (n.len >= 4) choir(t, [n.m - 12, n.m], d, 0.26, { a: 0.03, r: 0.25, width: 0.75, voices: 2 }); }
const STOMP_TEXT = 'เหยียบบอสได้! ฉาบ + ทิมปานี + แตรรับ แล้วทำนองหมู่บ้านดังขึ้นมา 4 ห้องเป็นรางวัล (ไวโอลิน + ฮอร์น + นักร้อง) จากนั้นกลับไปเพลงไล่ / คลั่งที่เล่นอยู่ — ทำนองฝั่งเราดังเฉพาะตอนที่เราทำได้จริง';
V4.stomp = { bars: 4, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: HERO_CH.slice(0, 4), text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    gallop(s, t, sd, k.bass, hz);
    if (s === 0 || s === 8) ensemble(t, 0.24); if (s === 4 || s === 12) snare(t, 0.18);
    if (s === 0) choir(t, wide(c), 16 * sd, 0.16, { a: 0.1 });
    (hero.get(b * 16 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 8) grunt(t, sd, 52, 0.7);       // the boar, annoyed, runs back to the start
  } };
B2.stomp = { bars: 4, steps: 12, beat: 6, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: HERO68_CH.slice(0, 4), text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    ride(s, t, sd, k.bass, hz);
    if (s === 0 || s === 6) ensemble(t, 0.24); if (s === 6) snare(t, 0.18);
    if (s === 0) choir(t, wide(c), 12 * sd, 0.16, { a: 0.1 });
    (hero68.get(b * 12 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 6) laugh(t, sd, 0.6);
  } };
B3.stomp = { bars: 4, steps: 14, beat: 2, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: HERO78_CH.slice(0, 4), text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    stride(s, t, sd, k.bass, hz);
    if (s === 0 || s === 8) ensemble(t, 0.24); if (s === 4) snare(t, 0.16);
    if (s === 0) choir(t, wide(c), 14 * sd, 0.16, { a: 0.1 });
    (hero78.get(b * 14 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 8) groan(t, 1, 0.07);
  } };

// ═══════════════ stage 4 · จระเข้ชาละวัน: a Thai royal river theme (the crocodile king) vs the village theme ═══════════════
// The king of the river, from Thai legend: a Thai ensemble (ระนาด running, ปี่ with ornaments, ฆ้องวง, ฉิ่ง-ฉับ, กลองทัด)
// joins the orchestra on the pentatonic scale; water all around (waves, bubbles, splashes). Diving (Space held in the game)
// = the whole mix goes muffled, as heard from under the water.
const PENTA = [45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];   // A minor pentatonic, A2 … C6
function ranat(t, f, v, pan = -0.35) {      // ระนาดเอก: bright hard-wood bar, quick decay
  const g = C.createGain(); dest(g, pan);
  [[1, 1, 0.28], [3.98, 0.35, 0.09], [9.9, 0.08, 0.04]].forEach(([k, a, d]) => {
    const o = C.createOscillator(), og = C.createGain(); o.frequency.value = f * k; o.connect(og); og.connect(g);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * a, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02); });
  noise(t, 0.012, { v: v * 0.25, hp: 2500, lp: 9000, pan });
}
function pi(t, f, dur, v, pan = 0.05) {     // ปี่: nasal Thai reed, flicks down from the note above, wide vibrato
  const g = C.createGain(), bp = C.createBiquadFilter(), lp = C.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = Math.min(f * 2.2, 2600); bp.Q.value = 0.9; lp.type = 'lowpass'; lp.frequency.value = 4500;
  const end = t + dur + 0.25;
  const oscs = [['sawtooth', 0], ['square', 6]].map(([ty, dc]) => { const o = osc(ty, f, t, end, dc, bp);
    o.frequency.setValueAtTime(f * 1.12, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07); return o; });
  if (dur > 0.25) vibrato(t, end, f, oscs, 0.011, 6.2, 0.15);
  bp.connect(lp); env(g, t, v * 0.8, 0.02, dur, 0.12); lp.connect(g); dest(g, pan);
}
function khong(t, f, v, pan = 0.35) {       // ฆ้องวง: small tuned gong, a little pitch drop, beating pair
  const g = C.createGain(); dest(g, pan);
  [[1, 1, 1.3], [1.004, 0.6, 1.3], [2.76, 0.3, 0.6], [5.4, 0.12, 0.3]].forEach(([k, a, d]) => {
    const o = C.createOscillator(), og = C.createGain(); o.frequency.setValueAtTime(f * k * 1.01, t); o.frequency.exponentialRampToValueAtTime(f * k, t + 0.05);
    o.connect(og); og.connect(g);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * a * 0.5, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02); });
}
function ching(t, open, v = 0.05) {         // ฉิ่ง (open, rings) · ฉับ (closed, short)
  if (open) [3150, 4230, 5320].forEach((f, i) => tone(t, f, 0.9 - i * 0.2, { v: v * (1 - i * 0.25), a: 0.002, pan: 0.5 }));
  noise(t, open ? 0.15 : 0.05, { v: v * (open ? 0.6 : 1.1), hp: 4000, lp: 12000, pan: 0.5 });
}
function waves(t, dur, v) {
  [-0.6, 0.6].forEach((pan, i) => { const s = C.createBufferSource(), g = C.createGain(), lp = C.createBiquadFilter();
    s.buffer = G.noise; s.loop = true; lp.type = 'lowpass'; lp.frequency.value = 520 + i * 160;
    const n = Math.max(2, Math.round(dur / 1.6)); g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < n; k++) { const a = t + (k + 0.5 + i * 0.3) * dur / n; g.gain.linearRampToValueAtTime(v * (0.5 + Math.random() * 0.5), Math.min(a, t + dur - 0.05)); g.gain.linearRampToValueAtTime(v * 0.15, Math.min(a + dur / n * 0.45, t + dur)); }
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
    s.connect(lp); lp.connect(g); dest(g, pan); s.start(t, Math.random()); s.stop(t + dur + 0.15); });
}
function bubbles(t, n, v, spread = 1) {
  for (let i = 0; i < n; i++) { const d = Math.random() * spread, f = 280 + Math.random() * 500;
    tone(t + d, f, 0.07, { v: v * (0.6 + Math.random() * 0.4), f1: f * 2.2, a: 0.004, pan: (Math.random() - 0.5) * 1.2 }); }
}
function splash(t, v) { noise(t, 0.5, { v, hp: 500, bp: 1600, pan: 0.2 }); noise(t + 0.03, 0.35, { v: v * 0.6, hp: 2500, lp: 9000, pan: -0.3 }); tone(t, 90, 0.3, { v: v * 1.4, f1: 45 }); }
// the river under the chase: low strings roll like waves (root-5-octave-5 in 8ths), กลองทัด on 1 and 3, ฉิ่ง-ฉับ
function river(s, t, sd, root, H, loud = 1) {
  if (s % 2 === 0) { const off = [0, 7, 12, 7][(s / 2) % 4], acc = s % 8 === 0;
    cello(t, H(root + off), sd * 1.7, (acc ? 0.14 : 0.08) * loud, { a: 0.006, r: 0.06, voices: 2, vib: false });
    if (acc) strings(t, H(root - 12), sd * 3.4, 0.1 * loud, { bright: 600, a: 0.006, r: 0.08, voices: 2, vib: false, pan: 0.3 }); }
  if (s === 0 || s === 8) bigDrum(t, 0.22 * loud, { low: 0.85, pan: 0.2 });
  if (s === 4 || s === 12) ching(t, false, 0.06 * loud); else if (s === 6 || s === 14) ching(t, true, 0.035 * loud);
}
// ระนาด running in 16ths on the pentatonic scale, up and down around the chord's root
function ranatRun(s, t, root, H, v = 0.05, oct = 12) {
  let i0 = PENTA.findIndex(m => m >= root + 24); if (i0 < 0) i0 = 5;
  const i = Math.min(PENTA.length - 1, i0 + [0, 1, 2, 3, 4, 3, 2, 1][s % 8]);
  ranat(t, H(PENTA[i] + oct - 12), v);
}

const CROC = ['A4 2 C5 2 D5 2 E5 2 G5 4 E5 4', 'D5 2 E5 2 D5 2 C5 2 A4 8', 'C5 2 D5 2 E5 2 G5 2 A5 4 G5 4', 'E5 2 G5 2 E5 2 D5 2 G4 8',
              'A5 2 G5 2 E5 2 G5 2 A5 4 C6 4', 'D6 2 C6 2 A5 2 G5 2 E5 4 D5 4', 'C5 2 D5 2 E5 2 G5 2 E5 4 D5 4', 'E5 8 E4 8'];
const CROC_CH = ['Am', 'Am', 'F', 'G', 'Am', 'G', 'F', 'E'];
const RIVER_TUNE = ['E5 6 D5 2 C5 4 D5 4', 'E5 4 G5 4 A5 8', 'G5 6 E5 2 D5 4 C5 4', 'D5 16'];   // ปี่ by the river, slow
const VILP = ['- 16', '- 16', '- 16', '- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 A5 2', 'D5 4 G5 2 A5 2 G5 8', 'C6 4 A5 2 G5 2 A5 4 C6 2 A5 2', 'E5 4 G5 2 A5 2 E6 8'];
const croc = line(CROC), riverTune = line(RIVER_TUNE), vilP = line(VILP), heroP = line(HERO.slice(0, 4));
const winA = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16'], -3);
const escA = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16'], -3);
const sadA = line(['- 16', '- 16', 'C5 6 B4 2 A4 8', 'A4 16']);

const B4 = {
  intro: { bpm: 84, bars: 4, next: 'lurk', name: '1 · บอสพูด — ริมแม่น้ำ', chords: ['Am', 'F', 'G', 'Am'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0) waves(t, 4 * bar, 0.06);
      if (s === 0) { cello(t, hz(k.bass), bar, 0.05, { bright: 600, a: 0.5, r: 0.8, vib: false }); tri(c).forEach(m => strings(t, hz(m), bar, 0.022, { a: 0.6, r: 0.8, voices: 2, pan: -0.1 })); }
      if (s === 0 || s === 8) khong(t, hz(tri(c)[s ? 2 : 0] + 12), 0.08);
      if (s === 8) ching(t, true, 0.03);
      (riverTune.get(b * 16 + s) || []).forEach(n => pi(t, hz(n.m), n.len * sd * 0.95, 0.07));
      if (b === 3 && s === 4) bubbles(t, 8, 0.03, 1.2);
    } },
  lurk: { bpm: 84, bars: 4, loop: true, name: '1 · บอสพูด — ราชาแห่งแม่น้ำ', chords: ['Am', 'Am', 'F', 'E'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { splash(t, 0.22); bubbles(t + 0.1, 14, 0.04, 1.5); sub(t, 0.14, 1.5); }
      if (s === 0) { cello(t, hz(k.bass), bar, 0.07, { bright: 600, a: 0.3, r: 0.6, vib: false }); bones(t, hz(k.bass), bar * 0.9, 0.04, { a: 0.4 }); bigDrum(t, 0.2, { low: 0.85 }); }
      if (s === 8) bigDrum(t, 0.12, { low: 0.9 });
      if (s === 4 || s === 12) ching(t, false, 0.05); else if (s === 6 || s === 14) ching(t, true, 0.03);
      (croc.get((b % 2) * 16 + s) || []).forEach(n => khong(t, hz(n.m), 0.1));
      if (b === 3 && s === 0) { tri(c).forEach(m => horns(t, hz(m - 12), bar * 0.9, 0.05, { a: 0.05, open: 5 })); }
      if (s === 10 && b % 2) bubbles(t, 5, 0.03, 0.6);
    } },
  dash: { bpm: 150, bars: 2, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['E', 'E'],
    play(b, s, t, sd) {
      const k = chord('E'), i = b * 16 + s, grow = i / 32;
      river(s, t, sd, k.bass, hz, 0.6 + 0.6 * grow);
      ranat(t, hz(PENTA[Math.min(PENTA.length - 1, 8 + Math.floor(i / 4))] + 12), 0.03 + 0.05 * grow);
      timpani(t, hz(k.bass), 0.05 + 0.3 * grow, 0.25);
      if (i === 0) { splash(t, 0.2); waves(t, 32 * sd, 0.08); swell(t, 32 * sd, 0.22); choir(t, wide('E'), 32 * sd, 0.3, { a: 32 * sd * 0.85 });
        tuba(t, hz(k.bass - 12), 32 * sd, 0.08, { a: 32 * sd * 0.9 }); }
    } },
  p1: { bpm: 150, bars: 8, loop: true, dive: true, name: '3 · ไล่จับ (เฟส 1)', chords: CROC_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 57, 16 * sd * 0.9, 0.2); crash(t, 0.16); gong(t, 0.3); splash(t, 0.12); }
      river(s, t, sd, k.bass, hz);
      if (s === 0) { choir(t, wide(c), 16 * sd, 0.13, { a: 0.3 }); sub(t, 0.07, 1); khong(t, hz(tri(c)[0] + 12), 0.08); }
      if (s === 8) khong(t, hz(tri(c)[2] + 12), 0.06);
      ranatRun(s, t, k.bass, hz, 0.045);
      (croc.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9;
        pi(t, hz(n.m), d, 0.07); horns(t, hz(n.m - 12), d, 0.06, { a: 0.012 }); bones(t, hz(n.m - 24), d, 0.05, { grit: true, a: 0.012 }); });
      (vilP.get(b * 16 + s) || []).forEach(n => { vln(t, hz(n.m), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m + 12), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if (b === 3 && s === 12) bubbles(t, 6, 0.03, 0.5);
      if (b === 7 && s === 0) swell(t, 16 * sd, 0.14);
    } },
  p2: { bpm: 172, bars: 16, loop: true, dive: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...CROC_CH, ...CROC_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 57, 16 * sd, 0.24); gong(t, 0.5); crash(t, 0.2, 3); splash(t, 0.2); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); splash(t, 0.15); }
      river(s, t, sd, k.bass, H, 1.1);
      if (s === 0 || s === 8) { ensemble(t, s ? 0.24 : 0.3); timpani(t, H(s ? k.bass + 7 - 12 : k.bass), 0.36, 0.7); }
      if (s % 2 === 0 && s % 4) snare(t, 0.05);
      if (s === 0) { sub(t, 0.08, 1); choir(t, wide(c).map(m => m + tr), 16 * sd, half ? 0.2 : 0.15, { a: 0.2 }); if (bb % 4 === 0) crash(t, 0.13); }
      if (s % 4 === 0) khong(t, H(tri(c)[(s / 4) % 3] + 12), 0.07);
      ranatRun(s, t, k.bass, H, 0.05); if (half) ranatRun(s + 4, t, k.bass, H, 0.035, 24);
      (croc.get(bb * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9;
        pi(t, H(n.m + (half ? 12 : 0)), d, 0.07); horns(t, H(n.m - 12), d, 0.085, { grit: true, a: 0.01 }); bones(t, H(n.m - 24), d, 0.07, { grit: true, a: 0.01 }); tuba(t, H(n.m - 36), d, 0.06);
        if (half && n.len >= 4) choir(t, [n.m - 12 + tr, n.m + tr], d, 0.26, { a: 0.02, r: 0.2, width: 0.8, voices: 2 }); });
      if (bb === 3 && s === 12) splash(t, 0.1);
      if (bb === 7 && s === 0) { swell(t, 16 * sd, 0.14); waves(t, 16 * sd, 0.07); }
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['E', 'A', 'E', 'A'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(40), 0.08 + 0.38 * (s / 16), 0.25); ranat(t, hz(PENTA[8 + (s % 5)] + 12), 0.03 + 0.04 * (s / 16));
        if (s === 0) { swell(t, bar, 0.24); choir(t, wide('E'), bar, 0.24, { a: bar * 0.8 }); bones(t, hz(40), bar, 0.06, { a: bar * 0.9 }); } }
      if (b === 1 && s === 0) { splash(t, 0.25); bubbles(t + 0.2, 12, 0.03, 1.5); }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 3 ? 2.2 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 3 ? 1.4 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b >= 1 && s % 4 === 0) { khong(t, hz(tri(c)[(s / 4) % 3] + 12), 0.07); ching(t, s % 8 !== 0, 0.04); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(57), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); bell(t, hz(69), 0.1, 6, 0.4); sub(t, 0.2, 3);
        [45, 52, 57, 61, 64, 69].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); }
      (winA.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 }); pi(t, hz(n.m), d, 0.04); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้ไข่มุกคืน', chords: ['A', 'A', 'A'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('A').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(45), 0.3); ching(t, true, 0.04); }
      if (b === 1 && s === 0) { choir(t, wide('A'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); }
      (escA.get(b * 16 + s) || []).forEach(n => { pi(t, hz(n.m), n.len * sd * 0.95, 0.07); horns(t, hz(n.m - 12), n.len * sd * 0.9, 0.06); });
      if (b === 1 && s === 8) { splash(t, 0.06); bubbles(t + 0.2, 10, 0.03, 1.4); }
      if (b === 2) (croc.get(s) || []).forEach(n => khong(t, hz(n.m), 0.035));
    } },
  lost: { bpm: 84, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['Am', 'Am', 'Am', 'Am'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b < 2) { (croc.get(b * 16 + s) || []).forEach(n => { pi(t, hz(n.m), n.len * sd * 0.9, 0.07); khong(t, hz(n.m), 0.06); });
        if (s === 0) bigDrum(t, 0.16, { low: 0.85 }); if (s === 4 || s === 12) ching(t, false, 0.04); else if (s === 6 || s === 14) ching(t, true, 0.03); }
      if (b === 2 && s === 0) { gong(t, 0.3); splash(t, 0.1); waves(t, bar * 2, 0.05); choir(t, [45, 52, 57, 60], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(45), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadA.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m), n.len * sd * 0.95, 0.12));
    } },
};
B4.stomp = { bars: 4, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: HERO_CH.slice(0, 4), text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    river(s, t, sd, k.bass, hz);
    if (s === 0 || s === 8) ensemble(t, 0.22);
    if (s === 0) choir(t, wide(c), 16 * sd, 0.16, { a: 0.1 });
    ranatRun(s, t, k.bass, hz, 0.035);
    (heroP.get(b * 16 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 8) { splash(t, 0.08); bubbles(t + 0.1, 6, 0.03, 0.5); }
  } };

// ═══════════════ stage 5 · ยักษ์หินผา: the heaviest song — a stone giant's march vs the village theme ═══════════════
// Huge, slow, every step shakes the ground: stone hits + sub-bass quakes, a low-brass theme in open fourths/fifths
// (hard as rock), purple crystals ringing high above it. Its boulders (the 'seq' QTE) roll in on a drum roll, and the
// hero clears them with two hops (mock: the "หินกลิ้ง" button; in the game the boulder QTE would trigger it).
function rockHit(t, v, pan = 0) {
  tone(t, 75, 0.5, { v, f1: 38, a: 0.003, pan });
  noise(t, 0.12, { v: v * 0.6, hp: 120, bp: 420, pan });
  noise(t, 0.025, { v: v * 0.4, hp: 1500, lp: 6000, pan });
}
function quake(t, dur, v) { noise(t, dur, { v, hp: 20, lp: 130, rise: false }); tone(t, 41, dur, { v: v * 1.2, f1: 33, a: 0.05 }); }
function crystal(t, f, v, pan = 0.45, ring = 2) {     // purple crystal: glassy, shimmering, rings long
  const g = C.createGain(); dest(g, pan);
  [[1, 1], [1.003, 0.7], [2.01, 0.3], [4.2, 0.12]].forEach(([k, a], i) => {
    const o = C.createOscillator(), og = C.createGain(); o.frequency.value = f * k; o.connect(og); og.connect(g);
    const d = ring / (1 + i * 0.6);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * a * 0.5, t + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02); });
}
function rumbleRoll(t, dur, v, root = 43) {       // a boulder rolling in: a growing timpani roll over a low rumble
  const n = Math.round(dur / 0.07);
  for (let i = 0; i < n; i++) timpani(t + i * 0.07, hz(root), v * (0.15 + 0.85 * i / n), 0.2);
  noise(t, dur, { v: v * 0.5, hp: 30, lp: 260, rise: true, pan: 0.3 });
}
function hop(t, v) { noise(t, 0.18, { v: v * 0.5, hp: 600, bp: 1800, pan: -0.2 }); rockHit(t + 0.16, v * 0.5, 0.2); }
// giant steps under the chase: TUM on 1 and 3 (stone + drums + low strings), a stone clack on 2 and 4, an 8th pulse between
function giantSteps(s, t, sd, root, H, loud = 1) {
  if (s === 0 || s === 8) {
    rockHit(t, 0.22 * loud, s ? 0.25 : -0.25); bigDrum(t, 0.24 * loud, { low: 0.75 });
    cello(t, H(root), sd * 6, 0.16 * loud, { a: 0.006, r: 0.08, voices: 2, vib: false });
    strings(t, H(root - 12), sd * 6, 0.13 * loud, { bright: 500, a: 0.006, r: 0.08, voices: 2, vib: false, pan: 0.3 });
  } else if (s === 4 || s === 12) {
    noise(t, 0.07, { v: 0.12 * loud, hp: 500, bp: 950, pan: -0.15 });
    cello(t, H(root + 7), sd * 1.6, 0.08 * loud, { a: 0.006, r: 0.05, voices: 2, vib: false });
  } else if (s % 2 === 0) cello(t, H(root + 12), sd * 0.9, 0.055 * loud, { a: 0.005, r: 0.04, voices: 2, vib: false });
}
function crystalArp(s, t, c, H, v = 0.04) { if (s % 2) return; const m = tri(c); crystal(t, H(m[[0, 1, 2, 1][(s / 2) % 4]] + 24), v, 0.5, 0.9); }

const GIANT = ['G5 6 D5 2 G5 4 A#5 4', 'A5 6 G5 2 D5 8', 'D#5 6 D5 2 C5 4 A#4 4', 'A4 4 D5 4 F#5 8',
               'G5 4 A#5 4 D6 8', 'C6 4 A#5 4 G5 8', 'G#5 6 G5 2 F5 4 D#5 4', 'D5 4 F#5 4 A5 8'];
const GIANT_CH = ['Gm', 'Gm', 'D#', 'D', 'Gm', 'Cm', 'G#', 'D'];
const VILG = ['- 16', '- 16', '- 16', '- 16', 'D5 4 F5 2 G5 2 F5 4 D5 2 G5 2', 'C5 4 D#5 2 F5 2 G5 8', 'D#5 4 F5 2 G5 2 G#5 4 G5 2 F5 2', 'F#5 4 A5 2 D6 2 A5 8'];
const SPARK = ['D6 4 A#5 4 G5 8', 'D6 4 A5 4 F#5 8', 'D#6 4 C6 4 G5 8', 'D6 16'];   // crystals, the intro
const giant = line(GIANT), vilG = line(VILG), spark = line(SPARK), heroG = line(HERO.slice(0, 4), -2);
const winG = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16'], -5);
const escG = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16'], -5);
const sadG = line(['- 16', '- 16', 'A#4 6 A4 2 G4 8', 'G4 16']);

const B5 = {
  intro: { bpm: 66, bars: 4, next: 'lurk', name: '1 · บอสพูด — หุบเขาหิน', chords: ['Gm', 'D', 'D#', 'D'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0) wind(t, 4 * bar, 0.05);
      if (s === 0) { cello(t, hz(k.bass), bar, 0.05, { bright: 500, a: 0.6, r: 0.8, vib: false }); tri(c).forEach(m => strings(t, hz(m), bar, 0.02, { a: 0.6, r: 0.8, voices: 2, pan: -0.1 })); }
      (spark.get(b * 16 + s) || []).forEach(n => crystal(t, hz(n.m), 0.06, (b % 2 ? -0.5 : 0.5), 2.5));
      if (b === 3 && s === 8) { quake(t, 1.2, 0.06); }
    } },
  lurk: { bpm: 66, bars: 4, loop: true, name: '1 · บอสพูด — ยักษ์หินตื่น', chords: ['Gm', 'Gm', 'G#', 'D'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { quake(t, 2, 0.1); rockHit(t, 0.3); sub(t, 0.15, 1.5); }
      if (s === 0 || s === 8) { rockHit(t, s ? 0.18 : 0.26, s ? 0.3 : -0.3); quake(t, 0.6, 0.05); crystal(t + 0.05, hz(tri(c)[s ? 2 : 0] + 24), 0.04, s ? -0.5 : 0.5, 1.5); }
      if (s === 0) { choir(t, [k.bass + 12, tri(c)[0], tri(c)[2]], bar, 0.18, { vowel: 'oo', a: 0.5, r: 0.8, width: 0.4 }); cello(t, hz(k.bass), bar, 0.07, { bright: 500, a: 0.2, r: 0.5, vib: false }); }
      (giant.get((b % 2) * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9; bones(t, hz(n.m - 24), d, 0.05, { a: 0.05 }); tuba(t, hz(n.m - 24), d, 0.05, { a: 0.05 }); });
    } },
  dash: { bpm: 138, bars: 2, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['D', 'D'],
    play(b, s, t, sd) {
      const k = chord('D'), i = b * 16 + s, grow = i / 32;
      if (b === 0 ? s % 8 === 0 : s % 4 === 0) { rockHit(t, 0.14 + 0.18 * grow, (i % 8 ? 0.3 : -0.3)); bigDrum(t, 0.12 + 0.2 * grow, { low: 0.75 }); }
      if (s % 2 === 0) crystal(t, hz(tri('D')[(i / 2) % 3] + 24 + (b ? 12 : 0)), 0.02 + 0.03 * grow, (Math.random() - 0.5), 0.6);
      timpani(t, hz(k.bass), 0.05 + 0.3 * grow, 0.25);
      if (i === 0) { quake(t, 32 * sd, 0.09); swell(t, 32 * sd, 0.22); choir(t, wide('D'), 32 * sd, 0.3, { a: 32 * sd * 0.85 });
        [k.bass, k.bass + 7].forEach(m => bones(t, hz(m), 32 * sd, 0.05, { a: 32 * sd * 0.9, open: 3 })); tuba(t, hz(k.bass - 12), 32 * sd, 0.08, { a: 32 * sd * 0.9 }); }
    } },
  p1: { bpm: 138, bars: 8, loop: true, name: '3 · ไล่จับ (เฟส 1)', chords: GIANT_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 55, 16 * sd * 0.9, 0.22); crash(t, 0.16); gong(t, 0.3); quake(t, 1.5, 0.1); }
      giantSteps(s, t, sd, k.bass, hz);
      if (s === 0) { choir(t, wide(c), 16 * sd, 0.13, { a: 0.3 }); sub(t, 0.09, 1.2); timpani(t, hz(k.bass), 0.38, 0.9); }
      if (s === 8) timpani(t, hz(k.bass + 7 - 12), 0.3, 0.8);
      if (s === 14 || s === 15) snare(t, 0.06);
      if (b < 4) crystalArp(s, t, c, hz, 0.03);
      (giant.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9;
        bones(t, hz(n.m - 12), d, 0.08, { grit: true, a: 0.015 }); horns(t, hz(n.m - 12), d, 0.05, { a: 0.015 }); tuba(t, hz(n.m - 24), d, 0.07);
        choir(t, [n.m - 24, n.m - 12], d, 0.18, { vowel: 'oh', a: 0.04, r: 0.2, width: 0.4, voices: 2 }); });
      (vilG.get(b * 16 + s) || []).forEach(n => { vln(t, hz(n.m), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m + 12), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if (b === 7 && s === 0) swell(t, 16 * sd, 0.14);
    } },
  p2: { bpm: 159, bars: 16, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...GIANT_CH, ...GIANT_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 55, 16 * sd, 0.26); gong(t, 0.5); crash(t, 0.2, 3); quake(t, 2, 0.12); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); [79, 84, 86, 91].forEach((m, i) => crystal(t + i * 0.06, H(m), 0.05, (i % 2 ? -0.6 : 0.6), 1.5)); }
      giantSteps(s, t, sd, k.bass, H, 1.1);
      if (s === 4 || s === 12) { rockHit(t, 0.14, 0.3); bigDrum(t, 0.16, { low: 0.8 }); }
      if (s === 0 || s === 8) { ensemble(t, 0.24); timpani(t, H(s ? k.bass + 7 - 12 : k.bass), 0.38, 0.7); }
      if (s % 2 === 1) snare(t, 0.035);
      if (s === 0) { sub(t, 0.1, 1); choir(t, wide(c).map(m => m + tr), 16 * sd, half ? 0.2 : 0.15, { a: 0.2 }); if (bb % 2 === 0) quake(t, 0.9, 0.07); if (bb % 4 === 0) crash(t, 0.13); }
      crystalArp(s, t, c, H, half ? 0.04 : 0.025);
      (giant.get(bb * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.88;
        horns(t, H(n.m - 12), d, 0.09, { grit: true, a: 0.01 }); bones(t, H(n.m - 24), d, 0.08, { grit: true, a: 0.01 }); tuba(t, H(n.m - 36), d, 0.07);
        choir(t, [n.m - 12 + tr, n.m + tr], d, half ? 0.32 : 0.26, { vowel: half ? 'ah' : 'oh', a: 0.02, r: 0.2, width: 0.8, voices: 2 });
        if (half) vln(t, H(n.m + 12), d, 0.045, { a: 0.01, r: 0.1, voices: 2 }); });
      if (bb === 7 && s === 0) swell(t, 16 * sd, 0.15);
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['D', 'G', 'D', 'G'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(50), 0.08 + 0.38 * (s / 16), 0.25); if (s % 2 === 0) bigDrum(t, 0.08 + 0.2 * (s / 16), { low: 0.8 });
        if (s === 0) { swell(t, bar, 0.24); choir(t, wide('D'), bar, 0.24, { a: bar * 0.8 }); bones(t, hz(50), bar, 0.06, { a: bar * 0.9 }); } }
      if (b === 1 && s === 0) { rockHit(t, 0.35); quake(t, 2, 0.14); [0.15, 0.3, 0.42, 0.6, 0.8, 1.05].forEach((d, i) => { rockHit(t + d, 0.12 - i * 0.015, (i % 2 ? 0.5 : -0.5)); crystal(t + d + 0.03, hz([86, 91, 89, 94, 91, 98][i]), 0.035, (i % 2 ? -0.6 : 0.6), 1.5); }); }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 3 ? 2.2 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 3 ? 1.4 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(55), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); bell(t, hz(67), 0.1, 6, 0.4); sub(t, 0.2, 3);
        [43, 50, 55, 59, 62, 67].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); }
      (winG.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m), d, 0.08, { open: 5 }); vln(t, hz(n.m + 12), d, 0.08); vln(t, hz(n.m + 24), d, 0.04, { voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้ทับทิมคืน', chords: ['G', 'G', 'G'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('G').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(43), 0.3); }
      if (b === 1 && s === 0) { choir(t, wide('G'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); crystal(t, hz(79), 0.04, 0.5, 2.5); }
      (escG.get(b * 16 + s) || []).forEach(n => { flute(t, hz(n.m + 12), n.len * sd * 0.95, 0.12); horns(t, hz(n.m), n.len * sd * 0.9, 0.06); });
      if (b >= 1 && s % 8 === 4) { const i = (b - 1) * 2 + (s > 8 ? 1 : 0); rockHit(t, 0.12 - i * 0.025, 0.5); }
    } },
  lost: { bpm: 66, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['Gm', 'Gm', 'Gm', 'Gm'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b < 2) { (giant.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9; bones(t, hz(n.m - 12), d, 0.07, { a: 0.03 }); tuba(t, hz(n.m - 24), d, 0.07); });
        if (s === 0 || s === 8) { rockHit(t, 0.2, s ? 0.3 : -0.3); quake(t, 0.5, 0.05); } if (s === 4) crystal(t, hz(79 + b * 2), 0.04, 0.5, 2); }
      if (b === 2 && s === 0) { gong(t, 0.3); choir(t, [43, 50, 55, 58], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(43), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadG.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m + 12), n.len * sd * 0.95, 0.12));
    } },
};
B5.stomp = { bars: 4, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: ['A#', 'F', 'Gm', 'D'], text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    giantSteps(s, t, sd, k.bass, hz);
    if (s === 0) choir(t, wide(c), 16 * sd, 0.16, { a: 0.1 });
    (heroG.get(b * 16 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 8) { rockHit(t, 0.16); quake(t, 0.8, 0.06); }
  } };

// ═══════════════ stage 6 · ราชาค้างคาว: a gothic cave-castle — organ + harpsichord (the bat king) vs the village theme ═══════════════
// Dark, grand and a little spooky (not scary for kids): a big church organ, a harpsichord running in 16ths that never stops,
// a high children's choir "oo", bats squeaking with a cave echo, wings flapping, swoops. The king flies, so strings swoop too.
// Its little bats dive at the hero (the 'shift' QTE) — mock: the "ค้างคาวพุ่ง" button.
function organ(t, notes, dur, v, { a = 0.04, r = 0.35, pan = 0 } = {}) {      // pipe organ: 8' + 4' + 2⅔' + 2' drawbars
  const g = C.createGain(), end = t + dur + r + 0.05;
  notes.forEach(m => { const f = hz(m);
    [[1, 1, -3], [1, 0.7, 3], [2, 0.5, 0], [3, 0.25, 0], [4, 0.18, 0]].forEach(([k, a2, dc]) => {
      const o = C.createOscillator(), og = C.createGain(); o.frequency.value = f * k; o.detune.value = dc; og.gain.value = a2;
      o.connect(og); og.connect(g); o.start(t); o.stop(end); }); });
  env(g, t, v / Math.sqrt(notes.length) * 0.22, a, dur, r); dest(g, pan);
}
function harpsi(t, f, v, pan = -0.3) {            // harpsichord: bright pluck, 8' + 4'
  const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(f * 10, 9000), t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2, 500), t + 0.3);
  osc('sawtooth', f, t, t + 0.42, 0, lp); osc('sawtooth', f * 2, t, t + 0.3, 4, lp);
  lp.connect(g); dest(g, pan);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.002); g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
}
function squeak(t, v, pan = 0.4) {                // a bat: "จี๊ด-จี๊ด" + cave echo
  [0, 0.21, 0.42, 0.63].forEach((d, i) => { const vv = v * Math.pow(0.45, i), pp = i % 2 ? -pan : pan;
    [0, 0.07].forEach(e => tone(t + d + e, 6200, 0.05, { v: vv, f1: 4300, a: 0.003, pan: pp })); });
}
function flap(t, v, pan = 0) { [0, 0.09].forEach(d => noise(t + d, 0.06, { v, hp: 250, bp: 520, pan })); }
function drip(t, v, pan = 0) { [0, 0.27, 0.54].forEach((d, i) => tone(t + d, 1900, 0.05, { v: v * Math.pow(0.4, i), f1: 950, a: 0.002, pan: i % 2 ? -pan : pan })); }
function swoopSnd(t, v) {                          // a bat dives past: whoosh sweeping left → right, squeaks on the way
  const s = C.createBufferSource(), g = C.createGain(), bp = C.createBiquadFilter(), p = C.createStereoPanner();
  s.buffer = G.noise; s.loop = true; bp.type = 'bandpass'; bp.Q.value = 2;
  bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2800, t + 0.45); bp.frequency.exponentialRampToValueAtTime(700, t + 0.9);
  p.pan.setValueAtTime(-0.9, t); p.pan.linearRampToValueAtTime(0.9, t + 0.9);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + 0.95);
  s.connect(bp); bp.connect(g); g.connect(p); p.connect(G.bus); s.start(t, Math.random()); s.stop(t + 1);
  squeak(t + 0.3, v * 0.5, 0.3);
}
function glide(t, m, dur, v, up = true) {          // strings swooping (the king flies)
  const f = hz(m), g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
  [-8, 8].forEach(dc => { const o = osc('sawtooth', f, t, t + dur + 0.2, dc, lp);
    o.frequency.setValueAtTime(up ? f * 0.5 : f * 2, t); o.frequency.exponentialRampToValueAtTime(f, t + dur * 0.8); });
  env(g, t, v, dur * 0.3, dur, 0.15); lp.connect(g); dest(g, up ? -0.4 : 0.4);
}
// under the chase: the harpsichord runs in 16ths on the chord, low strings pulse in 8ths, timpani on 1
function cave(s, t, sd, c, H, loud = 1) {
  const k = chord(c), m = tri(c), pat = [0, 1, 2, 1, 0, 1, 2, 3];
  harpsi(t, H(([m[0], m[1], m[2], m[0] + 12])[pat[s % 8]] + 12), 0.07 * loud);
  if (s % 2 === 0) cello(t, H(k.bass + (s % 8 === 4 ? 12 : 0)), sd * 1.7, (s % 8 === 0 ? 0.13 : 0.08) * loud, { a: 0.006, r: 0.05, voices: 2, vib: false });
  if (s === 0) strings(t, H(k.bass - 12), sd * 7, 0.1 * loud, { bright: 600, a: 0.006, r: 0.08, voices: 2, vib: false, pan: 0.3 });
}

const BAT = ['C5 4 D#5 4 G5 4 C6 4', 'B5 4 G5 2 D5 2 F5 4 D5 4', 'D#5 2 F5 2 G5 4 G#5 4 G5 4', 'F5 4 C#5 4 G#4 8',
             'C6 4 D#6 4 G#5 8', 'F5 2 G#5 2 C6 4 G#5 4 F5 4', 'G5 4 B5 4 D6 4 F6 4', 'D6 4 B5 4 G5 8'];
const BAT_CH = ['Cm', 'G', 'Cm', 'C#', 'G#', 'Fm', 'G', 'G'];
const VILB = ['- 16', '- 16', '- 16', '- 16', 'C6 4 D#6 2 F6 2 D#6 4 C6 2 D#6 2', 'C6 4 D#6 2 F6 2 G#6 8', 'B5 4 D6 2 F6 2 D6 4 B5 2 D6 2', 'D6 4 F6 2 G6 2 B6 8'];
const bat = line(BAT), vilB = line(VILB), heroBat = line(HERO.slice(0, 4), 3);
const lullaby = line(['G5 8 D#5 8', 'F5 8 D5 8', 'D#5 8 C5 8', 'B4 16']);       // the children's choir in the cave, intro
const winC = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16']);
const escC = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16']);
const sadC = line(['- 16', '- 16', 'D#5 6 D5 2 C5 8', 'C5 16']);

const B6 = {
  intro: { bpm: 72, bars: 4, next: 'lurk', name: '1 · บอสพูด — ถ้ำมืด', chords: ['Cm', 'G#', 'Fm', 'G'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (s === 0) { organ(t, [k.bass - 12, k.bass], bar, 0.08, { a: 0.6, r: 0.8 }); }
      (lullaby.get(b * 16 + s) || []).forEach(n => choir(t, [n.m], n.len * sd * 0.95, 0.12, { vowel: 'oo', a: 0.4, r: 0.6, width: 0.3, voices: 2 }));
      if ((b === 0 && s === 6) || (b === 2 && s === 10)) drip(t, 0.05, b ? -0.5 : 0.5);
      if (b === 1 && s === 12) squeak(t, 0.025, 0.7);
      if (b === 3 && s === 8) flap(t, 0.06, -0.3);
    } },
  lurk: { bpm: 72, bars: 4, loop: true, name: '1 · บอสพูด — ราชาค้างคาวตื่น', chords: ['Cm', 'G', 'C#', 'G'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { flap(t, 0.12, -0.4); flap(t + 0.3, 0.12, 0.4); squeak(t + 0.2, 0.06, 0.5); sub(t, 0.12, 1.5); }
      if (s === 0) { organ(t, [k.bass - 12, k.bass, ...tri(c)], bar * 0.95, b === 0 ? 0.22 : 0.15, { a: 0.03, r: 0.6 }); timpani(t, hz(k.bass), 0.18, 0.8); }
      if (s % 2 === 0) { const m = tri(c); harpsi(t, hz(([m[0], m[1], m[2], m[1]])[(s / 2) % 4] + 12), 0.05); }
      (bat.get((b % 2) * 16 + s) || []).forEach(n => horns(t, hz(n.m - 12), n.len * sd * 0.9, 0.04, { a: 0.05 }));
      if (s === 10 && b % 2) { squeak(t, 0.04, 0.6); flap(t + 0.1, 0.05, 0.6); }
      if (b === 2 && s === 4) drip(t, 0.04, -0.5);
    } },
  dash: { bpm: 152, bars: 2, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['G', 'G'],
    play(b, s, t, sd) {
      const c = 'G', k = chord(c), i = b * 16 + s, grow = i / 32;
      cave(s, t, sd, c, (m) => hz(m + (b ? 12 : 0)), 0.6 + 0.6 * grow);
      if (s % 3 === 0) flap(t, 0.03 + 0.07 * grow, (Math.random() - 0.5) * 1.6);
      if (s % 5 === 2) squeak(t, 0.02 + 0.03 * grow, (Math.random() - 0.5) * 1.4);
      timpani(t, hz(k.bass), 0.05 + 0.3 * grow, 0.25);
      if (i === 0) { swell(t, 32 * sd, 0.22); organ(t, [k.bass - 12, k.bass, ...tri(c)], 32 * sd, 0.2, { a: 32 * sd * 0.8, r: 0.4 }); choir(t, wide(c), 32 * sd, 0.26, { a: 32 * sd * 0.85 }); }
      if (b === 1 && s === 8) glide(t, 79, sd * 6, 0.05, true);
    } },
  p1: { bpm: 152, bars: 8, loop: true, name: '3 · ไล่จับ (เฟส 1)', chords: BAT_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 48, 16 * sd * 0.9, 0.2); crash(t, 0.16); gong(t, 0.3); flap(t, 0.1, 0); }
      cave(s, t, sd, c, hz);
      if (s === 0) { organ(t, [k.bass, ...tri(c)], 16 * sd * 0.95, 0.12, { a: 0.02, r: 0.3 }); choir(t, wide(c), 16 * sd, 0.1, { vowel: 'oo', a: 0.3 }); timpani(t, hz(k.bass), 0.36, 0.8); ensemble(t, 0.24); sub(t, 0.06, 1); }
      if (s === 8) { timpani(t, hz(k.bass + 7 - 12), 0.26, 0.6); bigDrum(t, 0.16); }
      if (s === 4 || s === 12) snare(t, 0.17);
      (bat.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9;
        horns(t, hz(n.m - 12), d, 0.075, { a: 0.012 }); bones(t, hz(n.m - 24), d, 0.05, { grit: true, a: 0.012 }); organ(t, [n.m], d, 0.06, { a: 0.01, r: 0.1, pan: 0.2 }); });
      (vilB.get(b * 16 + s) || []).forEach(n => { vln(t, hz(n.m - 12), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if ((b === 2 || b === 6) && s === 12) glide(t, 84, sd * 4, 0.045, b === 2);
      if (b % 2 === 1 && s === 14) squeak(t, 0.035, (b % 4 === 1 ? 0.6 : -0.6));
      if (b === 7 && s === 0) swell(t, 16 * sd, 0.14);
    } },
  p2: { bpm: 175, bars: 16, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...BAT_CH, ...BAT_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 48, 16 * sd, 0.24); gong(t, 0.5); crash(t, 0.2, 3); organ(t, [36, 48, 55, 60, 63, 67], 16 * sd, 0.3, { a: 0.02, r: 1.2 }); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); swoopSnd(t, 0.1); }
      cave(s, t, sd, c, H, 1.15); if (half) harpsi(t, H(tri(c)[(s + 1) % 3] + 24), 0.04, 0.4);
      if (s === 0) { organ(t, [k.bass - 12 + tr, k.bass + tr, ...tri(c).map(m => m + tr)], 16 * sd * 0.95, 0.2, { a: 0.02, r: 0.3 }); sub(t, 0.08, 1); if (bb % 4 === 0) crash(t, 0.13); }
      if (s === 0 || s === 8) { ensemble(t, s ? 0.24 : 0.3); timpani(t, H(s ? k.bass + 7 - 12 : k.bass), 0.38, 0.7); }
      if (s === 4 || s === 12) snare(t, 0.2); else if (s % 2 === 0) snare(t, 0.04);
      if (s === 6 || s === 14) flap(t, 0.05, (Math.random() - 0.5) * 1.6);
      if (s % 8 === 3) squeak(t, 0.03, (Math.random() - 0.5) * 1.4);
      (bat.get(bb * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.88;
        horns(t, H(n.m - 12), d, 0.09, { grit: true, a: 0.01 }); bones(t, H(n.m - 24), d, 0.07, { grit: true, a: 0.01 }); tuba(t, H(n.m - 36), d, 0.06);
        organ(t, [n.m + tr, n.m - 12 + tr], d, 0.08, { a: 0.01, r: 0.1 });
        if (half && n.len >= 4) choir(t, [n.m + tr, n.m + 12 + tr], d, 0.24, { vowel: 'ah', a: 0.02, r: 0.2, width: 0.8, voices: 2 }); });
      if (s === 12 && bb % 2 === 1) glide(t, 84 + tr, sd * 4, 0.05, bb % 4 === 1);
      if (bb === 7 && s === 0) swell(t, 16 * sd, 0.15);
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['G', 'C', 'G', 'C'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(43), 0.08 + 0.38 * (s / 16), 0.25); harpsi(t, hz(67 + (s % 4) * 2 + Math.floor(s / 4) * 5), 0.05);
        if (s === 0) { swell(t, bar, 0.24); organ(t, [31, 43, 55, 59, 62], bar, 0.18, { a: bar * 0.7, r: 0.2 }); } }
      if (b === 1 && s === 0) { [0, 0.1, 0.25, 0.4].forEach((d, i) => { flap(t + d, 0.07, (i % 2 ? 1 : -1) * 0.7); squeak(t + d + 0.05, 0.03, (i % 2 ? -1 : 1) * 0.6); }); }
      if (b >= 1 && s === 0) { organ(t, [k.bass - 12, k.bass, ...tri(c), tri(c)[0] + 12], bar * (b === 3 ? 2 : 0.98), 0.24, { a: 0.02, r: b === 3 ? 2 : 0.2 }); choir(t, wide(c), bar, 0.28, { a: 0.03, r: b === 3 ? 2.2 : 0.4 });
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(60), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); bell(t, hz(72), 0.1, 6, 0.4); sub(t, 0.2, 3);
        [48, 55, 60, 64, 67, 72].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); }
      (winC.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้ตะเกียงคืน', chords: ['C', 'C', 'C'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('C').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(48), 0.3); }
      if (b === 1 && s === 0) { choir(t, wide('C'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); }
      (escC.get(b * 16 + s) || []).forEach(n => { flute(t, hz(n.m + 12), n.len * sd * 0.95, 0.12); horns(t, hz(n.m), n.len * sd * 0.9, 0.06); });
      if (b === 1 && s === 8) { flap(t, 0.04, 0.7); squeak(t + 0.2, 0.025, 0.7); }
      if (b === 2 && s === 0) organ(t, [36, 48, 51, 55], bar, 0.05, { a: 0.4, r: 1.2 });
    } },
  lost: { bpm: 72, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['Cm', 'G', 'Cm', 'Cm'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b < 2) { (bat.get(b * 16 + s) || []).forEach(n => organ(t, [n.m, n.m - 12, n.m - 24], n.len * sd * 0.9, 0.12, { a: 0.02, r: 0.2 }));
        if (s === 0) organ(t, [chord(this.chords[b]).bass - 12], bar, 0.1); if (s % 8 === 4) squeak(t, 0.03, (s > 8 ? -0.6 : 0.6)); }
      if (b === 2 && s === 0) { gong(t, 0.3); organ(t, [36, 48, 51, 55], bar * 2, 0.12, { a: 0.3, r: 2 }); choir(t, [60, 63, 67], bar * 2, 0.12, { vowel: 'oo', a: 0.3, r: 2 }); drip(t + 0.5, 0.04, 0.5); }
      (sadC.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m + 12), n.len * sd * 0.95, 0.12));
    } },
};
B6.stomp = { bars: 4, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: ['D#', 'A#', 'Cm', 'G'], text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    cave(s, t, sd, c, hz, 0.9);
    if (s === 0) { choir(t, wide(c), 16 * sd, 0.16, { a: 0.1 }); organ(t, [k.bass, ...tri(c)], 16 * sd * 0.95, 0.08, { a: 0.03 }); }
    (heroBat.get(b * 16 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 8) { flap(t, 0.08, -0.4); glide(t + 0.1, 84, sd * 5, 0.04, true); }
  } };

// ═══════════════ stage 7 · พ่อมดอักษรโบราณ: a mysterious spell in 5/4 (the letter wizard) vs the village theme ═══════════════
// Magic and mystery: glockenspiel / celesta sparkles, harp sweeps when a spell is cast, a choir chanting an incantation
// (the vowel changes every note: อา-โอ-อู), old pages turning. The chase runs in 5/4 (20 steps, 3 + 2) so it never feels
// quite predictable. Its spell books fly at the hero (the 'word' QTE) — mock: the "หนังสือเวท" button.
function glock(t, f, v, pan = 0.4, ring = 0.9) {
  const g = C.createGain(); dest(g, pan);
  [[1, 1, ring], [2.76, 0.35, ring * 0.4], [5.4, 0.15, ring * 0.2]].forEach(([k, a, d]) => {
    const o = C.createOscillator(), og = C.createGain(); o.frequency.value = f * k; o.connect(og); og.connect(g);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * a, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02); });
}
function harpP(t, f, v, pan = -0.35, ring = 1.3) {
  const g = C.createGain(), lp = C.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(f * 6, 7000), t); lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.5, 300), t + ring);
  osc('triangle', f, t, t + ring + 0.05, 0, lp); const g2 = C.createGain(); g2.gain.value = 0.3; g2.connect(lp); osc('sine', f * 2, t, t + ring + 0.05, 0, g2);
  lp.connect(g); dest(g, pan);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
}
const WHOLE = [0, 2, 4, 6, 8, 10];   // whole-tone: the sound of a spell
function harpSweep(t, root, v, up = true, n = 10) { for (let i = 0; i < n; i++) { const k = up ? i : n - 1 - i; harpP(t + i * 0.035, hz(root + WHOLE[k % 6] + 12 * Math.floor(k / 6)), v, (i / n - 0.5)); } }
function spell(t, v = 0.06, root = 71) {    // a spell is cast: sparkles rising on the whole-tone scale + a shimmer
  for (let i = 0; i < 9; i++) glock(t + i * 0.045, hz(root + WHOLE[i % 6] + 12 * Math.floor(i / 6)), v * (0.6 + i * 0.05), (i % 2 ? 0.5 : -0.5), 0.7);
  noise(t, 0.6, { v: v * 0.35, hp: 7000, lp: 14000, rise: true, pan: 0.3 });
}
function pageTurn(t, v, pan = 0.3) { [0, 0.06].forEach(d => noise(t + d, 0.1, { v, hp: 1200, bp: 2600, pan })); }
const VOWELS = ['ah', 'oh', 'oo'];
// under the chase, 5/4 = 3 + 2: low strings on every beat (strong on 1 and 4), harp 8ths, a glock sparkle off the beat
function rune(s, t, sd, c, H, loud = 1) {
  const k = chord(c), m = tri(c);
  if (s % 4 === 0) { const acc = s === 0 || s === 12;
    cello(t, H(k.bass + (s === 8 || s === 16 ? 7 : 0)), sd * 3.4, (acc ? 0.15 : 0.08) * loud, { a: 0.006, r: 0.06, voices: 2, vib: false });
    if (acc) strings(t, H(k.bass - 12), sd * 6, 0.11 * loud, { bright: 600, a: 0.006, r: 0.08, voices: 2, vib: false, pan: 0.3 }); }
  if (s % 2 === 0) harpP(t, H(([m[0], m[1], m[2], m[1], m[0] + 12])[(s / 2) % 5] + 12), 0.05 * loud, -0.35, 0.8);
  if (s % 4 === 2 && s % 8 === 6) glock(t, H(m[2] + 24), 0.03 * loud, 0.5, 0.6);
}

const WIZ = ['B4 6 D5 2 F#5 4 E5 4 D5 4', 'B4 6 D5 2 G5 8 F#5 4', 'G#5 6 F#5 2 E5 4 B5 8', 'A#5 6 G#5 2 F#5 4 C#6 8',
             'D6 6 C#6 2 B5 4 F#5 4 D5 4', 'A5 6 G5 2 F#5 4 A5 4 D6 4', 'E6 6 D6 2 C6 4 G5 4 E5 4', 'C#6 6 A#5 2 F#5 12'];
const WIZ_CH = ['Bm', 'G', 'E', 'F#', 'Bm', 'D', 'C', 'F#'];
const VILW = ['- 20', '- 20', '- 20', '- 20', 'F#5 4 A5 2 B5 2 A5 4 F#5 4 B5 4', 'F#5 4 A5 2 B5 2 D6 12', 'E5 4 G5 2 A5 2 G5 4 E5 4 C6 4', 'C#6 4 E6 2 F#6 2 A#5 12'];
const INCANT = ['B4 8 D5 8', 'C#5 8 F#4 8', 'B4 8 D5 4 E5 4', 'F#5 16'];          // the wizard's incantation, intro (4/4)
const wiz = line(WIZ, 0, 1, 20), vilW = line(VILW, 0, 1, 20), incant = line(INCANT), heroW = line(HERO.slice(0, 4), 2, 1.25, 20);
const winB = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16'], -1);
const escB = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16'], -1);
const sadB = line(['- 16', '- 16', 'D5 6 C#5 2 B4 8', 'B4 16']);

const B7 = {
  intro: { bpm: 70, bars: 4, next: 'lurk', name: '1 · บอสพูด — หอสมุดเวท', chords: ['Bm', 'F#', 'G', 'F#'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (s === 0) { cello(t, hz(k.bass), bar, 0.05, { bright: 500, a: 0.6, r: 0.8, vib: false }); tri(c).forEach(m => strings(t, hz(m), bar, 0.02, { a: 0.6, r: 0.8, voices: 2, pan: -0.1 })); }
      if (s % 4 === 0) harpP(t, hz(tri(c)[(s / 4) % 3] + 12), 0.05);
      if ((b === 0 && s === 6) || (b === 2 && s === 10)) pageTurn(t, 0.05, b ? -0.4 : 0.4);
      if (s === 10 && b % 2 === 1) glock(t, hz(tri(c)[2] + 24), 0.03, 0.6, 1.5);
      if (b === 3 && s === 8) spell(t, 0.035, 66);
    } },
  lurk: { bpm: 70, bars: 4, loop: true, name: '1 · บอสพูด — พ่อมดร่ายมนตร์', chords: ['Bm', 'G', 'C', 'F#'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { spell(t, 0.07); harpSweep(t + 0.1, 59, 0.05); sub(t, 0.1, 1.5); }
      if (s === 0) { cello(t, hz(k.bass), bar, 0.07, { bright: 500, a: 0.3, r: 0.6, vib: false }); bones(t, hz(k.bass), bar * 0.9, 0.03, { a: 0.4 }); timpani(t, hz(k.bass), 0.14, 0.8); }
      (incant.get(b * 16 + s) || []).forEach((n, i) => choir(t, [n.m - 12, n.m], n.len * sd * 0.95, 0.24, { vowel: VOWELS[(b * 2 + (s >> 3)) % 3], a: 0.15, r: 0.4, width: 0.5 }));
      if (s % 4 === 2) glock(t, hz(tri(c)[(s >> 2) % 3] + 24 + (s > 8 ? 12 : 0)), 0.025, (s > 8 ? -0.5 : 0.5), 0.8);
      if (b === 2 && s === 0) harpSweep(t, 60, 0.04, true);
      if (b === 3 && s === 12) pageTurn(t, 0.04);
    } },
  dash: { bpm: 152, bars: 2, steps: 20, beat: 4, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['F#', 'F#'],
    play(b, s, t, sd) {
      const c = 'F#', k = chord(c), i = b * 20 + s, grow = i / 40;
      rune(s, t, sd, c, hz, 0.6 + 0.6 * grow);
      glock(t, hz(tri(c)[i % 3] + 24 + (b ? 12 : 0)), 0.015 + 0.03 * grow, (i % 2 ? 0.5 : -0.5), 0.4);
      timpani(t, hz(k.bass), 0.05 + 0.3 * grow, 0.25);
      if (i === 0) { swell(t, 40 * sd, 0.22); choir(t, wide(c), 40 * sd, 0.28, { a: 40 * sd * 0.85 }); tuba(t, hz(k.bass - 12), 40 * sd, 0.08, { a: 40 * sd * 0.9 }); harpSweep(t, 54, 0.04, true, 12); }
      if (b === 1 && s === 0) harpSweep(t, 66, 0.05, true, 12);
    } },
  p1: { bpm: 152, bars: 8, steps: 20, beat: 4, loop: true, name: '3 · ไล่จับ (เฟส 1)', chords: WIZ_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 59, 20 * sd * 0.9, 0.2); crash(t, 0.16); gong(t, 0.3); spell(t, 0.05); }
      rune(s, t, sd, c, hz);
      if (s === 0) { choir(t, wide(c), 20 * sd, 0.1, { vowel: 'oo', a: 0.3 }); timpani(t, hz(k.bass), 0.36, 0.8); ensemble(t, 0.26); sub(t, 0.06, 1); }
      if (s === 12) { timpani(t, hz(k.bass + 7 - 12), 0.28, 0.6); bigDrum(t, 0.18); }
      if (s === 4 || s === 8 || s === 16) snare(t, s === 16 ? 0.15 : 0.08);
      (wiz.get(b * 20 + s) || []).forEach((n, i) => { const d = n.len * sd * 0.9;
        horns(t, hz(n.m - 12), d, 0.075, { a: 0.012 }); bones(t, hz(n.m - 24), d, 0.045, { a: 0.012 });
        if (n.len >= 4) choir(t, [n.m - 12, n.m], d, 0.18, { vowel: VOWELS[(b + (s >> 2)) % 3], a: 0.03, r: 0.2, width: 0.6, voices: 2 }); });
      (vilW.get(b * 20 + s) || []).forEach(n => { vln(t, hz(n.m), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m + 12), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if ((b === 2 || b === 6) && s === 0) harpSweep(t, chord(c).mid + 12, 0.035, b === 2);
      if (b % 2 === 1 && s === 18) pageTurn(t, 0.04, (b % 4 === 1 ? 0.5 : -0.5));
      if (b === 7 && s === 0) swell(t, 20 * sd, 0.14);
    } },
  p2: { bpm: 175, bars: 16, steps: 20, beat: 4, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...WIZ_CH, ...WIZ_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 59, 20 * sd, 0.24); gong(t, 0.5); crash(t, 0.2, 3); spell(t, 0.08); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); spell(t, 0.08, 72); }
      rune(s, t, sd, c, H, 1.15);
      if (half && s % 2 === 1) glock(t, H(tri(c)[(s >> 1) % 3] + 36), 0.02, (s % 4 === 1 ? 0.6 : -0.6), 0.4);
      if (s === 0 || s === 12) { ensemble(t, s ? 0.24 : 0.3); timpani(t, H(s ? k.bass + 7 - 12 : k.bass), 0.38, 0.7); }
      if (s % 4 === 0 && s !== 0 && s !== 12) snare(t, 0.14); else if (s % 2 === 0) snare(t, 0.04);
      if (s === 0) { sub(t, 0.08, 1); choir(t, wide(c).map(m => m + tr), 20 * sd, half ? 0.2 : 0.15, { vowel: VOWELS[bb % 3], a: 0.2 }); if (bb % 4 === 0) crash(t, 0.13); }
      if (s === 0 && bb % 2 === 1) spell(t, 0.04, 71 + tr);
      if (s === 10) harpSweep(t, chord(c).mid + 12 + tr, 0.03, bb % 2 === 0, 8);
      (wiz.get(bb * 20 + s) || []).forEach(n => { const d = n.len * sd * 0.88;
        horns(t, H(n.m - 12), d, 0.09, { grit: true, a: 0.01 }); bones(t, H(n.m - 24), d, 0.07, { grit: true, a: 0.01 }); tuba(t, H(n.m - 36), d, 0.06);
        choir(t, [n.m - 12 + tr, n.m + tr], d, half ? 0.3 : 0.24, { vowel: VOWELS[(bb + (s >> 2)) % 3], a: 0.02, r: 0.2, width: 0.8, voices: 2 });
        if (half) vln(t, H(n.m + 12), d, 0.045, { a: 0.01, r: 0.1, voices: 2 }); });
      if (bb === 7 && s === 0) swell(t, 20 * sd, 0.15);
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['F#', 'B', 'F#', 'B'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(42), 0.08 + 0.38 * (s / 16), 0.25); glock(t, hz(78 + s), 0.02 + 0.02 * (s / 16), (s % 2 ? 0.5 : -0.5), 0.3);
        if (s === 0) { swell(t, bar, 0.24); choir(t, wide('F#'), bar, 0.24, { a: bar * 0.8 }); bones(t, hz(42), bar, 0.06, { a: bar * 0.9 }); } }
      if (b === 1 && s === 0) { spell(t, 0.08, 71); for (let i = 0; i < 12; i++) glock(t + 0.3 + i * 0.09, hz(95 - i * 2), 0.03, (i % 2 ? 0.6 : -0.6), 0.7); harpSweep(t + 0.1, 59, 0.05, true, 14); }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 3 ? 2.2 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 3 ? 1.4 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(59), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); bell(t, hz(71), 0.1, 6, 0.4); sub(t, 0.2, 3);
        [47, 54, 59, 63, 66, 71].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); harpSweep(t, 59, 0.04, true, 12); }
      (winB.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้คัมภีร์คืน', chords: ['B', 'B', 'B'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('B').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(47), 0.3); harpP(t, hz(59), 0.05); }
      if (b === 1 && s === 0) { choir(t, wide('B'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); }
      (escB.get(b * 16 + s) || []).forEach(n => { flute(t, hz(n.m + 12), n.len * sd * 0.95, 0.12); horns(t, hz(n.m), n.len * sd * 0.9, 0.06); });
      if (b === 1 && s === 8) { spell(t, 0.04, 78); noise(t, 0.5, { v: 0.05, hp: 800, bp: 2000, pan: 0.5 }); }
      if (b === 2 && s === 0) choir(t, [59, 62, 66], bar, 0.06, { vowel: 'oo', a: 0.4, r: 1.2, width: 0.8 });
    } },
  lost: { bpm: 70, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['Bm', 'G', 'F#', 'Bm'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b < 2) { (incant.get(b * 16 + s) || []).forEach(n => choir(t, [n.m - 12, n.m], n.len * sd * 0.95, 0.26, { vowel: VOWELS[(b * 2 + (s >> 3)) % 3], a: 0.15, r: 0.4 }));
        if (s === 0) { cello(t, hz(chord(this.chords[b]).bass), bar, 0.08, { a: 0.2, r: 0.5, vib: false }); harpSweep(t, chord(this.chords[b]).mid, 0.035); } if (b === 1 && s === 8) spell(t, 0.05); }
      if (b === 2 && s === 0) { gong(t, 0.3); pageTurn(t + 0.3, 0.06); choir(t, [47, 54, 59, 62], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(47), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadB.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m + 12), n.len * sd * 0.95, 0.12));
    } },
};
B7.stomp = { bars: 4, steps: 20, beat: 4, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: ['D', 'A', 'Bm', 'F#'], text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    rune(s, t, sd, c, hz, 0.9);
    if (s === 0) choir(t, wide(c), 20 * sd, 0.16, { a: 0.1 });
    (heroW.get(b * 20 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 12) { pageTurn(t, 0.05); harpSweep(t + 0.1, 66, 0.035, false, 8); }
  } };

// ═══════════════ stage 8 · หุ่นกลไขตัวเลข: a clockwork machine (the robot) vs the village theme ═══════════════
// A factory of gears: clock ticks, ratchets, steam hisses, metal clanks, the robot's "บี๊บ" beeps. Its theme counts up
// step by step (1-2-3-4-5) like numbers. The groove is a machine: pistons in 16ths, and gear clicks every 3 sixteenths
// turning against the 4/4 beat (3 over 4). Its golden gears roll at the hero (the 'num' QTE) — mock: the "เฟืองกลิ้ง" button.
function clockTick(t, v, hi = true, pan = 0.4) { noise(t, 0.012, { v, hp: 5000, lp: 12000, pan }); tone(t, hi ? 3200 : 2400, 0.025, { v: v * 0.6, a: 0.001, pan }); }
function clank(t, v, pan = -0.3, base = 420) {     // metal on metal: inharmonic, short
  const g = C.createGain(); dest(g, pan);
  [[1, 1, 0.3], [2.41, 0.6, 0.22], [3.93, 0.4, 0.16], [5.27, 0.25, 0.1]].forEach(([k, a, d]) => {
    const o = C.createOscillator(), og = C.createGain(); o.frequency.value = base * k; o.connect(og); og.connect(g);
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(v * a * 0.6, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.start(t); o.stop(t + d + 0.02); });
  noise(t, 0.03, { v: v * 0.5, hp: 1500, bp: 3000, pan });
}
function ratchet(t, n, v, pan = 0.3) { for (let i = 0; i < n; i++) clockTick(t + i * 0.022, v * (0.7 + 0.3 * (i % 2)), i % 2 === 0, pan); }
function hiss(t, dur, v) { noise(t, dur * 0.25, { v, hp: 3000, lp: 11000, rise: true, pan: 0.5 }); noise(t + dur * 0.25, dur * 0.75, { v, hp: 3000, lp: 11000, pan: 0.5 }); }
function motor(t, dur, v, up = true) {             // power on (whir up) / power down (whir down)
  const g = C.createGain(), lp = C.createBiquadFilter(), o = C.createOscillator(); o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 900;
  o.frequency.setValueAtTime(up ? 35 : 220, t); o.frequency.exponentialRampToValueAtTime(up ? 220 : 30, t + dur);
  o.connect(lp); lp.connect(g); dest(g, 0);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * (up ? 0.7 : 0.1)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
function beep(t, v, n = 2, f = 1320) { for (let i = 0; i < n; i++) tone(t + i * 0.13, f * (i % 2 ? 0.75 : 1), 0.08, { type: 'square', v: v * 0.5, a: 0.003, pan: 0.2 }); }
// the machine under the chase: 16th pistons (low strings, accents on each beat), gear clicks every 3 sixteenths (3 over 4),
// clank on 2 and 4, drum on 1 and 3
function machine(s, t, sd, root, H, loud = 1) {
  const acc = s % 4 === 0;
  cello(t, H(root + (s % 8 === 6 ? 12 : 0)), sd * 0.7, (acc ? 0.12 : 0.06) * loud, { a: 0.004, r: 0.03, voices: 2, vib: false });
  if (s === 0 || s === 8) { strings(t, H(root - 12), sd * 3, 0.1 * loud, { bright: 600, a: 0.004, r: 0.06, voices: 2, vib: false, pan: 0.3 }); bigDrum(t, 0.2 * loud, { low: 0.9 }); }
  if (s % 3 === 0) clockTick(t, 0.035 * loud, s % 6 === 0, s % 6 === 0 ? 0.5 : -0.5);
  if (s === 4 || s === 12) clank(t, 0.09 * loud, s === 4 ? -0.35 : 0.35);
}
function countUp(s, t, c, H, v = 0.05) { if (s % 2) return; const m = tri(c); xylo(t, H(([m[0], m[1], m[2], m[0] + 12])[(s / 2) % 4] + 12), v, 0.4); }

const NUM = ['F#4 2 G#4 2 A4 2 B4 2 C#5 4 F#5 4', 'E5 2 C#5 2 A4 2 C#5 2 F#4 8', 'D5 2 E5 2 F#5 2 A5 2 D6 4 A5 4', 'G#5 2 F5 2 C#5 2 F5 2 G#5 8',
             'F#5 2 G#5 2 A5 2 B5 2 C#6 4 A5 4', 'D#6 2 C#6 2 B5 2 F#5 2 D#5 8', 'A5 2 B5 2 C#6 2 D6 2 E6 4 F#6 4', 'F6 4 C#6 4 G#5 8'];
const NUM_CH = ['F#m', 'F#m', 'D', 'C#', 'F#m', 'B', 'D', 'C#'];
const VILN = ['- 16', '- 16', '- 16', '- 16', 'C#6 4 E6 2 F#6 2 E6 4 C#6 2 F#6 2', 'D#6 4 F#6 2 G#6 2 F#6 8', 'D6 4 F#6 2 A6 2 F#6 4 D6 2 A6 2', 'F5 4 G#5 2 C#6 2 G#5 8'];
const COUNT = ['F#5 4 G#5 4 A5 4 B5 4', 'C#6 16', 'B5 4 A5 4 G#5 4 F5 4', 'F#5 16'];   // the robot counting, intro
const num = line(NUM), vilN = line(VILN), count = line(COUNT), heroN = line(HERO.slice(0, 4), -3);
const winF = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', '- 16'], 6);
const escF = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16'], 6);
const sadF = line(['- 16', '- 16', 'A4 6 G#4 2 F#4 8', 'F#4 16']);

const B8 = {
  intro: { bpm: 64, bars: 4, next: 'lurk', name: '1 · บอสพูด — หอนาฬิกา', chords: ['F#m', 'D', 'B', 'C#'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (s % 4 === 0) clockTick(t, 0.05, s % 8 === 0, s % 8 === 0 ? 0.5 : -0.5);
      if (s === 0) { cello(t, hz(k.bass), bar, 0.05, { bright: 500, a: 0.6, r: 0.8, vib: false }); tri(c).forEach(m => strings(t, hz(m), bar, 0.02, { a: 0.6, r: 0.8, voices: 2, pan: -0.1 })); }
      (count.get(b * 16 + s) || []).forEach(n => xylo(t, hz(n.m), 0.08, 0.3));
      if (b === 1 && s === 14) ratchet(t, 4, 0.03);
      if (b === 3 && s === 8) motor(t, 1.8, 0.05, true);
    } },
  lurk: { bpm: 64, bars: 4, loop: true, name: '1 · บอสพูด — หุ่นกลไขตื่น', chords: ['F#m', 'F#m', 'D', 'C#'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { hiss(t, 1.2, 0.06); beep(t + 0.4, 0.06); clank(t + 0.9, 0.12); sub(t, 0.1, 1.5); }
      if (s % 3 === 0) clockTick(t, 0.035, s % 6 === 0, s % 6 === 0 ? 0.5 : -0.5);
      if (s === 0) { cello(t, hz(k.bass), bar, 0.07, { bright: 500, a: 0.2, r: 0.5, vib: false }); bigDrum(t, 0.14, { low: 0.9 }); }
      if (s === 8) clank(t, 0.07, 0.3);
      (num.get((b % 2) * 16 + s) || []).forEach(n => { bones(t, hz(n.m - 12), n.len * sd * 0.8, 0.04, { a: 0.02 }); xylo(t, hz(n.m + 12), 0.04, 0.4); });
      if (b === 3 && s === 12) { hiss(t, 0.6, 0.04); beep(t + 0.3, 0.04, 2, 1760); }
    } },
  dash: { bpm: 156, bars: 2, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['C#', 'C#'],
    play(b, s, t, sd) {
      const k = chord('C#'), i = b * 16 + s, grow = i / 32;
      machine(s, t, sd, k.bass, hz, 0.6 + 0.6 * grow);
      timpani(t, hz(k.bass), 0.05 + 0.3 * grow, 0.25);
      if (i === 0) { motor(t, 32 * sd, 0.07, true); swell(t, 32 * sd, 0.22); choir(t, wide('C#'), 32 * sd, 0.26, { a: 32 * sd * 0.85 }); tuba(t, hz(k.bass - 12), 32 * sd, 0.08, { a: 32 * sd * 0.9 }); }
      if (b === 1 && s === 0) { bell(t, hz(85), 0.05, 1.5, 0.5); bell(t + 0.08, hz(85), 0.04, 1.5, -0.5); hiss(t, 1, 0.05); }
      if (b === 1 && s === 8) ratchet(t, 10, 0.04);
    } },
  p1: { bpm: 156, bars: 8, loop: true, name: '3 · ไล่จับ (เฟส 1)', chords: NUM_CH,
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 54, 16 * sd * 0.9, 0.2); crash(t, 0.16); gong(t, 0.3); hiss(t, 0.8, 0.05); }
      machine(s, t, sd, k.bass, hz);
      if (s === 0) { choir(t, wide(c), 16 * sd, 0.1, { vowel: 'oo', a: 0.3 }); timpani(t, hz(k.bass), 0.34, 0.8); sub(t, 0.06, 1); }
      if (s === 8) timpani(t, hz(k.bass + 7 - 12), 0.26, 0.6);
      if (s === 14 || s === 15) snare(t, 0.06);
      countUp(s, t, c, hz, 0.035);
      (num.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * (n.len <= 2 ? 0.7 : 0.88);
        horns(t, hz(n.m - 12), d, 0.075, { a: 0.008 }); bones(t, hz(n.m - 24), d, 0.05, { grit: true, a: 0.008 }); });
      (vilN.get(b * 16 + s) || []).forEach(n => { vln(t, hz(n.m - 12), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if (b % 2 === 1 && s === 14) ratchet(t, 5, 0.035);
      if (b === 3 && s === 8) beep(t, 0.035);
      if (b === 7 && s === 0) { swell(t, 16 * sd, 0.14); hiss(t + 16 * sd * 0.6, 0.6, 0.04); }
    } },
  p2: { bpm: 179, bars: 16, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...NUM_CH, ...NUM_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 54, 16 * sd, 0.24); gong(t, 0.5); crash(t, 0.2, 3); hiss(t, 1.2, 0.07); motor(t, 1.5, 0.05); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.3); beep(t, 0.06, 4, 1760); }
      machine(s, t, sd, k.bass, H, 1.15);
      if (s % 4 === 2) clank(t, 0.05, (s % 8 === 2 ? 0.5 : -0.5), 560);
      if (s === 0 || s === 8) { ensemble(t, s ? 0.24 : 0.3); timpani(t, H(s ? k.bass + 7 - 12 : k.bass), 0.38, 0.7); }
      if (s % 2 === 1) snare(t, 0.035);
      if (s === 0) { sub(t, 0.08, 1); choir(t, wide(c).map(m => m + tr), 16 * sd, half ? 0.2 : 0.15, { a: 0.2 }); if (bb % 4 === 0) crash(t, 0.13); if (bb % 2 === 1) hiss(t, 0.7, 0.05); }
      countUp(s, t, c, H, 0.04); if (half && s % 2) xylo(t, H(tri(c)[(s >> 1) % 3] + 36), 0.025, -0.4);
      (num.get(bb * 16 + s) || []).forEach(n => { const d = n.len * sd * (n.len <= 2 ? 0.7 : 0.86);
        horns(t, H(n.m - 12), d, 0.09, { grit: true, a: 0.008 }); bones(t, H(n.m - 24), d, 0.07, { grit: true, a: 0.008 }); tuba(t, H(n.m - 36), d, 0.06);
        if (n.len >= 4) choir(t, [n.m - 12 + tr, n.m + tr], d, half ? 0.3 : 0.24, { a: 0.02, r: 0.2, width: 0.8, voices: 2 });
        if (half) vln(t, H(n.m + 12), d, 0.045, { a: 0.01, r: 0.1, voices: 2 }); });
      if (half && s === 12 && bb % 2 === 0) beep(t, 0.03, 2, 1760);
      if (bb === 7 && s === 0) swell(t, 16 * sd, 0.15);
    } },
  win: { bpm: 120, bars: 4, name: '5 · ⭐⭐⭐ เหยียบบอส', chords: ['C#', 'F#', 'C#', 'F#'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0) { timpani(t, hz(49), 0.08 + 0.38 * (s / 16), 0.25); clockTick(t, 0.02 + 0.03 * (s / 16), s % 2 === 0);
        if (s === 0) { swell(t, bar, 0.24); choir(t, wide('C#'), bar, 0.24, { a: bar * 0.8 }); bones(t, hz(49), bar, 0.06, { a: bar * 0.9 }); } }
      if (b === 1 && s === 0) { motor(t, 1.4, 0.07, false); hiss(t, 1, 0.07); [0.1, 0.22, 0.31, 0.45, 0.6, 0.8].forEach((d, i) => clank(t + d, 0.08 - i * 0.008, (i % 2 ? 0.6 : -0.6), 380 + i * 60)); }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 3 ? 2.2 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 3 ? 1.4 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.45); crash(t, 0.2, 3); bell(t, hz(54), 0.12, 6); }
      if (b === 3 && s === 0) { crash(t, 0.18, 3.5); [0, 0.6, 1.2].forEach((d, i) => bell(t + d, hz(66), 0.08 - i * 0.015, 3, 0.4)); sub(t, 0.2, 3);
        [42, 49, 54, 58, 61, 66].forEach(m => vln(t, hz(m), bar * 2.4, 0.06, { a: 0.02, r: 2 })); }
      (winF.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้เฟืองคืน', chords: ['F#', 'F#', 'F#'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('F#').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(54), 0.3); }
      if (b === 1 && s === 0) { choir(t, wide('F#'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); }
      (escF.get(b * 16 + s) || []).forEach(n => { flute(t, hz(n.m), n.len * sd * 0.95, 0.12); horns(t, hz(n.m - 12), n.len * sd * 0.9, 0.06); });
      if (b >= 1 && s % (b === 1 ? 4 : 8) === 2) { const i = (b - 1) * 4 + (s >> 2); clockTick(t, 0.04 - i * 0.004, i % 2 === 0, 0.6); }
      if (b === 2 && s === 10) beep(t, 0.025, 1, 990);
    } },
  lost: { bpm: 64, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['F#m', 'F#m', 'F#m', 'F#m'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (s % 4 === 0) clockTick(t, 0.04, s % 8 === 0, s % 8 === 0 ? 0.5 : -0.5);
      if (b < 2) { (num.get(b * 16 + s) || []).forEach(n => { bones(t, hz(n.m - 12), n.len * sd * 0.8, 0.06, { a: 0.02 }); xylo(t, hz(n.m + 12), 0.06, 0.4); });
        if (b === 1 && s === 8) { hiss(t, 0.8, 0.05); beep(t + 0.3, 0.05); } }
      if (b === 2 && s === 0) { gong(t, 0.3); motor(t, 1.5, 0.04, false); choir(t, [42, 49, 54, 57], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(42), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadF.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m + 12), n.len * sd * 0.95, 0.12));
    } },
};
B8.stomp = { bars: 4, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: ['A', 'E', 'F#m', 'C#'], text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    machine(s, t, sd, k.bass, hz, 0.85);
    if (s === 0) choir(t, wide(c), 16 * sd, 0.16, { a: 0.1 });
    (heroN.get(b * 16 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 8) { hiss(t, 0.6, 0.05); ratchet(t + 0.2, 6, 0.035); }
  } };

// ═══════════════ stage 9 · พญามังกรทอง: the finale — a golden dragon on the champions' summit vs the village theme ═══════════════
// The biggest song: full orchestra + choir, eastern gongs and big drums, a pentatonic dragon theme, the dragon's roar,
// fire crackling, huge wings. The timed step is 5 minutes, so the chase (p1) is 16 bars (A: brass, B: the choir takes the
// theme up an octave) to keep it from repeating too soon. Winning brings back a sound of every boss from the journey.
// Its fireballs fly at the hero (the 3-key 'seq' QTE) — mock: the "ลูกไฟ" button.
function roar(t, dur, v) {                     // a dragon's roar: a wobbling low growl + breath + grit
  const g = C.createGain(), lp = C.createBiquadFilter(), ws = C.createWaveShaper(); ws.curve = G.curve; lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
  const n = 20, curve = new Float32Array(n); let f = 70;
  for (let i = 0; i < n; i++) { f = Math.max(48, Math.min(105, f + (Math.random() - 0.5) * 22)); curve[i] = f * (i < 4 ? 0.8 + i * 0.05 : 1); }
  [0, 7].forEach(dc => { const o = C.createOscillator(); o.type = 'sawtooth'; o.detune.value = dc; o.frequency.setValueCurveAtTime(curve, t, dur); o.connect(lp); o.start(t); o.stop(t + dur + 0.05); });
  lp.connect(ws); ws.connect(g); dest(g, 0);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.2); g.gain.linearRampToValueAtTime(v * 0.7, t + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  noise(t, dur, { v: v * 0.5, hp: 200, bp: 700, pan: 0.1 }); sub(t, v * 0.8, dur);
}
function crackle(t, dur, v, pan = 0.4) { const n = Math.round(dur * 30); for (let i = 0; i < n; i++) noise(t + Math.random() * dur, 0.008, { v: v * (0.4 + Math.random() * 0.6), hp: 1500, lp: 9000, pan: pan + (Math.random() - 0.5) * 0.6 }); }
function fireWhoosh(t, dur, v) {
  const s = C.createBufferSource(), g = C.createGain(), bp = C.createBiquadFilter(); s.buffer = G.noise; s.loop = true; bp.type = 'bandpass'; bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.7); bp.frequency.exponentialRampToValueAtTime(900, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  s.connect(bp); bp.connect(g); dest(g, -0.2); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  crackle(t + dur * 0.3, dur * 0.7, v * 0.4);
}
function bigFlap(t, v, pan = 0) { [0, 0.12].forEach(d => noise(t + d, 0.16, { v, hp: 60, lp: 420, pan })); tone(t, 70, 0.25, { v: v * 0.8, f1: 45, pan }); }
// the battle under the chase: low strings in 16ths, taiko + timpani on 3 + 3 + 2, a gong every 4 bars
function battle(s, t, sd, root, H, loud = 1) {
  const acc = s === 0 || s === 6 || s === 12, oct = s % 4 === 2 ? 12 : 0;
  cello(t, H(root + oct), sd * 0.85, (acc ? 0.13 : 0.07) * loud, { a: 0.005, r: 0.04, voices: 2, vib: false });
  if (acc) { ensemble(t, (s ? 0.22 : 0.3) * loud); timpani(t, H(s === 6 ? root + 7 - 12 : root), 0.34 * loud, 0.7);
    strings(t, H(root - 12), sd * 2.5, 0.1 * loud, { bright: 600, a: 0.005, r: 0.06, voices: 2, vib: false, pan: 0.3 }); }
  if (s === 4 || s === 12) snare(t, 0.16 * loud); else if (s === 14 || s === 15) snare(t, 0.06 * loud);
}

const DRAGON = ['D#5 4 F#5 2 G#5 2 A#5 6 F#5 2', 'B5 4 A#5 2 F#5 2 D#5 8', 'C#6 4 A#5 2 F#5 2 A#5 4 C#6 4', 'D6 6 C#6 2 A#5 8',
                'D#6 4 C#6 2 A#5 2 G#5 4 A#5 4', 'B5 4 G#5 2 D#5 2 G#5 8', 'F#5 4 G#5 2 A#5 2 B5 4 C#6 4', 'D6 4 C#6 2 A#5 2 F5 8'];
const DRAGON_CH = ['D#m', 'B', 'F#', 'A#', 'D#m', 'G#m', 'B', 'A#'];
const VILD = ['- 16', '- 16', '- 16', '- 16', 'A#5 4 C#6 2 D#6 2 C#6 4 A#5 2 D#6 2', 'G#5 4 B5 2 C#6 2 D#6 8', 'B5 4 D#6 2 F#6 2 D#6 4 B5 2 F#6 2', 'A#5 4 D6 2 F6 2 A#6 8'];
const SUMMIT = ['A#5 8 G#5 4 F#5 4', 'D#5 16', 'F#5 8 G#5 4 A#5 4', 'C#6 16'];      // a wooden flute on the summit, intro (pentatonic)
const dragon = line(DRAGON), vilD = line(VILD), summit = line(SUMMIT), heroD = line(HERO.slice(0, 4), 6);
const winDs = line(['- 16', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 C6 8', 'E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 4 D5 2 E5 2 G5 4 A5 4', 'C6 16'], 3);
const escDs = line(['E5 4 G5 2 A5 2 G5 4 E5 2 D5 2', 'C5 16', '- 16'], 3);
const sadDs = line(['- 16', '- 16', 'F#5 6 F5 2 D#5 8', 'D#5 16']);

const B9 = {
  intro: { bpm: 66, bars: 4, next: 'lurk', name: '1 · บอสพูด — ยอดเขาแชมป์', chords: ['D#m', 'B', 'F#', 'A#'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0) wind(t, 4 * bar, 0.06);
      if (s === 0) { cello(t, hz(k.bass), bar, 0.05, { bright: 500, a: 0.6, r: 0.8, vib: false }); tri(c).forEach(m => strings(t, hz(m), bar, 0.02, { a: 0.6, r: 0.8, voices: 2, pan: -0.1 })); }
      (summit.get(b * 16 + s) || []).forEach(n => woodFlute(t, hz(n.m), n.len * sd * 0.95, 0.08, 0.4));
      if (s === 8 && b % 2 === 0) bell(t, hz(75), 0.04, 4, -0.4);
      if (b === 3 && s === 8) { crackle(t, 1.5, 0.03); bigFlap(t + 1, 0.06, 0.3); }
    } },
  lurk: { bpm: 66, bars: 4, loop: true, name: '1 · บอสพูด — พญามังกรตื่น', chords: ['D#m', 'B', 'G#m', 'A#'],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd;
      if (b === 0 && s === 0 && first) { roar(t, 2.4, 0.16); gong(t + 0.2, 0.45); bigFlap(t + 1.2, 0.12, -0.4); bigFlap(t + 1.6, 0.12, 0.4); }
      if (s === 0) { choir(t, wide(c), bar, 0.2, { a: 0.4, r: 0.6 }); cello(t, hz(k.bass), bar, 0.08, { bright: 500, a: 0.2, r: 0.5, vib: false }); timpani(t, hz(k.bass), 0.22, 1); ensemble(t, 0.2); }
      if (s === 8) bigFlap(t, 0.07, (b % 2 ? -0.5 : 0.5));
      (dragon.get((b % 2) * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.92; horns(t, hz(n.m - 12), d, 0.06, { a: 0.05 }); bones(t, hz(n.m - 24), d, 0.045, { a: 0.05 }); });
      if (b === 2 && s === 0) crackle(t, 2, 0.03);
      if (b === 3 && s === 12) roar(t, 1, 0.08);
    } },
  dash: { bpm: 150, bars: 2, next: 'p1', name: '2 · บอสวิ่งเข้าฉาก → พร้อม…', chords: ['A#', 'A#'],
    play(b, s, t, sd) {
      const k = chord('A#'), i = b * 16 + s, grow = i / 32;
      battle(s, t, sd, k.bass, hz, 0.6 + 0.6 * grow);
      if (i % (b ? 4 : 8) === 0) bigFlap(t, 0.06 + 0.06 * grow, (i % 8 ? 0.5 : -0.5));
      timpani(t, hz(k.bass), 0.05 + 0.3 * grow, 0.25);
      if (i === 0) { swell(t, 32 * sd, 0.24); choir(t, wide('A#'), 32 * sd, 0.32, { a: 32 * sd * 0.85 }); tuba(t, hz(k.bass - 12), 32 * sd, 0.08, { a: 32 * sd * 0.9 });
        [k.bass, k.bass + 7].forEach(m => bones(t, hz(m), 32 * sd, 0.05, { a: 32 * sd * 0.9, open: 3 })); }
      if (b === 1 && s === 4) fireWhoosh(t, 1, 0.08);
    } },
  p1: { bpm: 150, bars: 16, loop: true, name: '3 · ไล่จับ (เฟส 1)', chords: [...DRAGON_CH, ...DRAGON_CH],
    play(b, s, t, sd, first) {
      const c = this.chords[b], k = chord(c), bb = b % 8, B = b >= 8;
      if (b === 0 && s === 0 && first) { braaam(t, 51, 16 * sd * 0.9, 0.22); crash(t, 0.16); gong(t, 0.35); roar(t + 0.1, 1.2, 0.1); }
      battle(s, t, sd, k.bass, hz);
      if (s === 0) { choir(t, wide(c), 16 * sd, B ? 0.12 : 0.1, { vowel: B ? 'ah' : 'oo', a: 0.3 }); sub(t, 0.06, 1); if (bb % 4 === 0) gong(t, 0.18); }
      (dragon.get(bb * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9;
        if (!B) { horns(t, hz(n.m - 12), d, 0.08, { a: 0.012 }); bones(t, hz(n.m - 24), d, 0.05, { grit: true, a: 0.012 }); }
        else { choir(t, [n.m - 12, n.m], d, 0.26, { a: 0.03, r: 0.2, width: 0.75, voices: 2 }); vln(t, hz(n.m), d, 0.05, { a: 0.01, r: 0.1, voices: 2 }); horns(t, hz(n.m - 24), d, 0.05, { a: 0.02 }); } });
      if (!B) (vilD.get(bb * 16 + s) || []).forEach(n => { vln(t, hz(n.m - 12), n.len * sd * 0.95, 0.07, { a: 0.02, r: 0.15 }); vln(t, hz(n.m), n.len * sd * 0.95, 0.035, { a: 0.02, r: 0.15, voices: 2 }); });
      if (B && s % 2 === 1) glock(t, hz(tri(c)[(s >> 1) % 3] + 24), 0.015, (s % 4 === 1 ? 0.5 : -0.5), 0.4);
      if (bb === 3 && s === 8) fireWhoosh(t, 0.9, 0.06);
      if (bb === 7 && s === 0) { swell(t, 16 * sd, 0.14); bigFlap(t + 16 * sd * 0.5, 0.06); }
    } },
  p2: { bpm: 172, bars: 16, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...DRAGON_CH, ...DRAGON_CH],
    play(b, s, t, sd, first) {
      const half = b >= 8, bb = b % 8, tr = half ? 1 : 0, H = (m) => hz(m + tr);
      const c = this.chords[b], k = chord(c);
      if (b === 0 && s === 0 && first) { braaam(t, 51, 16 * sd, 0.26); gong(t, 0.5); crash(t, 0.2, 3); roar(t + 0.1, 1.6, 0.14); fireWhoosh(t + 0.4, 1.2, 0.08); }
      if (b === 8 && s === 0) { crash(t, 0.22, 3); gong(t, 0.35); roar(t, 1.2, 0.1); }
      battle(s, t, sd, k.bass, H, 1.15);
      if (s % 2 === 1) snare(t, 0.035);
      if (s === 0) { sub(t, 0.08, 1); choir(t, wide(c).map(m => m + tr), 16 * sd, half ? 0.2 : 0.15, { a: 0.2 }); if (bb % 4 === 0) { crash(t, 0.13); gong(t, 0.2); } }
      if (s === 0 && bb % 2 === 1) roar(t, 0.9, 0.07);
      if (s === 8 && bb % 2 === 0) crackle(t, 0.8, 0.03);
      (dragon.get(bb * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.88;
        horns(t, H(n.m - 12), d, 0.09, { grit: true, a: 0.01 }); bones(t, H(n.m - 24), d, 0.07, { grit: true, a: 0.01 }); tuba(t, H(n.m - 36), d, 0.06);
        choir(t, [n.m - 12 + tr, n.m + tr], d, half ? 0.32 : 0.24, { a: 0.02, r: 0.2, width: 0.8, voices: 2 });
        if (half) vln(t, H(n.m + 12), d, 0.05, { a: 0.01, r: 0.1, voices: 2 }); });
      if (bb === 7 && s === 0) swell(t, 16 * sd, 0.15);
    } },
  win: { bpm: 120, bars: 6, name: '5 · ⭐⭐⭐ เหยียบบอส — ปิดการเดินทาง', chords: ['A#', 'D#', 'A#', 'D#', 'A#', 'D#'],
    play(b, s, t, sd) {
      const c = this.chords[b], k = chord(c), bar = 16 * sd, H = (m) => hz(m);
      if (b === 0) { timpani(t, hz(46), 0.08 + 0.38 * (s / 16), 0.25); if (s % 2 === 0) ensemble(t, 0.08 + 0.25 * (s / 16));
        if (s === 0) { swell(t, bar, 0.24); choir(t, wide('A#'), bar, 0.26, { a: bar * 0.8 }); bones(t, hz(46), bar, 0.06, { a: bar * 0.9 }); roar(t + 0.2, 1.2, 0.08); } }
      if (b >= 1 && s === 0) { choir(t, wide(c), bar, 0.3, { a: 0.03, r: b === 5 ? 2.6 : 0.4 }); tri(c).forEach(m => bones(t, hz(m - 12), bar, 0.04, { a: 0.03, r: b === 5 ? 1.6 : 0.3 }));
        tuba(t, hz(k.bass - 12), bar, 0.08); timpani(t, hz(k.bass), 0.45, 1); ensemble(t, 0.3); }
      if (b === 1 && s === 0) { gong(t, 0.5); crash(t, 0.2, 3); bell(t, hz(63), 0.12, 6); }
      // the journey celebrates: one sound from every boss, one after another over bars 3-4
      if (b === 3 || b === 4) { const m = tri(c);
        if (s % 2 === 0) ranat(t, H(m[(s / 2) % 3] + 24), 0.04);                                 // ชาละวัน
        if (s % 4 === 2) musicBox(t, H(m[(s / 4 | 0) % 3] + 36), 0.04, 0.5);                     // หุ่นไล่กา
        if (s === 8) crystal(t, H(m[2] + 36), 0.05, -0.5, 2);                                    // ยักษ์หิน
        if (s === 0) organ(t, [k.bass, ...m], bar * 0.95, 0.1, { a: 0.05 });                     // ราชาค้างคาว
        if (s === 12) for (let i = 0; i < 6; i++) glock(t + i * 0.05, H(m[0] + 24 + WHOLE[i]), 0.03, (i % 2 ? 0.5 : -0.5), 0.6);   // พ่อมด
        if (s === 4) bell(t, H(m[0] + 24), 0.05, 2, 0.4);                                        // หุ่นกลไข
        if (s === 6 && b === 3) pizz(t, H(k.bass + 12), 0.1);                                    // หมูป่า (ดีดสาย)
        if (s === 10 && b === 4) logDrum(t, 140, 0.15);                                          // พญาไม้
      }
      if (b === 5 && s === 0) { crash(t, 0.2, 4); gong(t, 0.4); bell(t, hz(63), 0.1, 7, -0.4); bell(t + 0.3, hz(75), 0.08, 7, 0.4); sub(t, 0.22, 3);
        [51, 58, 63, 67, 70, 75].forEach(m => vln(t, hz(m), bar * 2.6, 0.06, { a: 0.02, r: 2.4 })); organ(t, [39, 51, 58, 63, 67], bar * 2.4, 0.18, { a: 0.03, r: 2 }); }
      (winDs.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
        horns(t, hz(n.m - 12), d, 0.08, { open: 5 }); vln(t, hz(n.m), d, 0.08); vln(t, hz(n.m + 12), d, 0.04, { voices: 2 });
        if (b >= 3 && n.len >= 4) choir(t, [n.m - 12, n.m], d, 0.22, { a: 0.03, r: 0.3, width: 0.8, voices: 2 }); });
    } },
  escape: { bpm: 120, bars: 3, name: '5 · ⭐–⭐⭐ ได้ถ้วยแชมป์คืน', chords: ['D#', 'D#', 'D#'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b === 0 && s === 0) { tri('D#').forEach(m => strings(t, hz(m), bar * 2, 0.05, { a: 0.1, r: 1 })); timpani(t, hz(51), 0.3); ensemble(t, 0.18); }
      if (b === 1 && s === 0) { choir(t, wide('D#'), bar * 1.5, 0.16, { a: 0.2, r: 1.6 }); bell(t, hz(75), 0.06, 5); }
      (escDs.get(b * 16 + s) || []).forEach(n => { flute(t, hz(n.m), n.len * sd * 0.95, 0.12); horns(t, hz(n.m - 12), n.len * sd * 0.9, 0.06); });
      if (b >= 1 && s % 6 === 0) { const i = (b - 1) * 3 + s / 6; bigFlap(t, Math.max(0.01, 0.07 - i * 0.012), 0.5); }
      if (b === 2 && s === 8) roar(t, 1.4, 0.04);
    } },
  lost: { bpm: 66, bars: 4, name: '5 · 0 ดาว บอสหนีไป', chords: ['D#m', 'B', 'D#m', 'D#m'],
    play(b, s, t, sd) {
      const bar = 16 * sd;
      if (b < 2) { (dragon.get(b * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.9; horns(t, hz(n.m - 12), d, 0.08, { a: 0.03 }); bones(t, hz(n.m - 24), d, 0.06, { a: 0.03 }); });
        if (s === 0) { choir(t, wide(this.chords[b]), bar, 0.2, { a: 0.2 }); ensemble(t, 0.2); } if (b === 0 && s === 4) roar(t, 1.4, 0.1); if (b === 1 && s === 0) crackle(t, 1.5, 0.03); }
      if (b === 2 && s === 0) { gong(t, 0.35); wind(t, bar * 2, 0.05); choir(t, [39, 46, 51, 54], bar * 2, 0.18, { vowel: 'oo', a: 0.3, r: 2 }); cello(t, hz(39), bar * 2, 0.07, { a: 0.3, r: 1.5 }); }
      (sadDs.get(b * 16 + s) || []).forEach(n => flute(t, hz(n.m), n.len * sd * 0.95, 0.12));
    } },
};
B9.stomp = { bars: 4, back: true, name: '👟 เหยียบบอส! — ทำนองหมู่บ้าน', chords: ['F#', 'C#', 'D#m', 'A#'], text: STOMP_TEXT,
  play(b, s, t, sd) { const c = this.chords[b], k = chord(c);
    battle(s, t, sd, k.bass, hz, 0.9);
    if (s === 0) choir(t, wide(c), 16 * sd, 0.16, { a: 0.1 });
    (heroD.get(b * 16 + s) || []).forEach(n => heroNote(t, sd, n));
    if (b === 3 && s === 8) roar(t, 0.9, 0.07);
  } };


// ── chase sound effects ──
const now2 = () => C.currentTime + 0.02;
const SPENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
let hitN = 0;
const BOSS_LAUGH = {
  1: (t) => { grunt(t, 0.085, 45, 1.1); grunt(t + 0.5, 0.075, 47, 0.9); },                                             // หมูป่า: อู๊ด-อู๊ด
  2: (t) => laugh(t, 0.09, 1.6),                                                                                       // หุ่นไล่กา: ฮิ-ฮิ-ฮิ
  3: (t) => { creak(t, 0.9, 0.2); choir(t + 0.1, [38, 45], 0.6, 0.35, { vowel: 'oh', a: 0.05, r: 0.3 }); },          // พญาไม้: ฮึ่มมม + ไม้ลั่น
  4: (t) => { [0, 0.22, 0.44].forEach((d, i) => bones(t + d, hz(40 - i * 2), 0.16, 0.16, { a: 0.01, grit: true })); bubbles(t + 0.1, 6, 0.05, 0.6); },   // ชาละวัน
  5: (t) => { [0, 0.3].forEach(d => { rockHit(t + d, 0.3); choir(t + d, [36, 43], 0.22, 0.4, { vowel: 'oh', a: 0.01, r: 0.15 }); }); },              // ยักษ์หิน: โฮะ-โฮะ
  6: (t) => { squeak(t, 0.12, 0.5); squeak(t + 0.25, 0.1, -0.5); flap(t + 0.1, 0.12, 0); },                            // ค้างคาว
  7: (t) => { for (let i = 0; i < 6; i++) glock(t + i * 0.07, hz(88 - WHOLE[i]), 0.1, (i % 2 ? 0.5 : -0.5), 0.5); },  // พ่อมด: ประกายไล่ลง
  8: (t) => { [0, 0.11, 0.22, 0.33].forEach((d, i) => tone(t + d, 1500 - i * 220, 0.08, { type: 'square', v: 0.07, a: 0.003, pan: 0.2 })); },          // หุ่นกลไข: บี๊บไล่ลง
  9: (t) => roar(t, 0.9, 0.22),                                                                                        // มังกร: คำรามสั้น
};
const NEW_SFX = {
  jump: () => { const t = now2(); noise(t, 0.2, { v: 0.12, hp: 500, bp: 1800, pan: 0 }); [72, 76, 79].forEach((m, i) => harpP(t + i * 0.035, hz(m), 0.16, 0.1, 0.5)); },
  qte: () => { const t = now2(); timpani(t, hz(43), 0.5, 0.6); [61, 64, 67, 70].forEach(m => horns(t, hz(m - 12), 0.18, 0.12, { a: 0.006, grit: true })); swell(t, 0.35, 0.12); },
  hit: () => { const t = now2(); glock(t, hz(79 + SPENTA[hitN++ % 6]), 0.22, 0.3, 0.6); },
  wrong: () => { const t = now2(); pizz(t, hz(38), 0.3, 0); pizz(t + 0.004, hz(39), 0.25, 0); logDrum(t, 90, 0.18, 0); },
  trip: () => { const t = now2(); timpani(t, hz(36), 0.55, 0.7); gruntNote(t + 0.05, 50, 38, 0.45, 0.16); noise(t, 0.12, { v: 0.12, hp: 3000, lp: 10000, pan: 0.3 }); },
  laugh: () => { const t = now2(); (BOSS_LAUGH[sfxStage] || BOSS_LAUGH[1])(t); },
  stomp: () => { const t = now2(); bigDrum(t, 0.6, { low: 0.7 }); timpani(t, hz(43), 0.7, 1.2); crash(t, 0.3, 2.2);
    [60, 64, 67, 72].forEach(m => horns(t + 0.02, hz(m - 12), 0.5, 0.12, { a: 0.008, open: 5 })); [72, 76, 79, 84].forEach((m, i) => glock(t + 0.12 + i * 0.05, hz(m), 0.1, 0.4, 0.7)); },
  chest: () => { const t = now2(); [72, 76, 79, 84, 88, 91].forEach((m, i) => glock(t + i * 0.06, hz(m), 0.14, (i % 2 ? 0.4 : -0.4), 1)); harpSweep(t, 60, 0.1, true, 10); choir(t + 0.1, [60, 64, 67, 72], 1.2, 0.3, { a: 0.3, r: 0.8 }); },
  snap: () => { const t = now2(); noise(t, 0.09, { v: 0.35, hp: 1200, bp: 2600, pan: 0.2 }); logDrum(t, 160, 0.3, -0.2); crash(t + 0.02, 0.12, 0.6); },
  root: () => { const t = now2(); creak(t, 0.7, 0.18, 0.3); noise(t, 0.4, { v: 0.08, hp: 80, lp: 500, pan: -0.3 }); },
  mash: (n = 1) => { const t = now2(); logDrum(t, 140 + n * 30, 0.28, (n % 2 ? 0.3 : -0.3)); },
  caw: () => caw(now2(), 0.16, 0.5),
  peck: () => { const t = now2(); logDrum(t, 420, 0.16, 0.3); noise(t, 0.02, { v: 0.1, hp: 3000, lp: 9000, pan: 0.3 }); },
  splash: () => splash(now2(), 0.32),
  dive: () => { const t = now2(); tone(t, 320, 0.3, { v: 0.2, f1: 110, a: 0.01 }); bubbles(t + 0.05, 10, 0.06, 0.8); },
  whoosh: () => { const t = now2(); const s = C.createBufferSource(), g = C.createGain(), bp = C.createBiquadFilter(); s.buffer = G.noise; s.loop = true; bp.type = 'bandpass'; bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.18); bp.frequency.exponentialRampToValueAtTime(500, t + 0.4);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + 0.42); s.connect(bp); bp.connect(g); g.connect(G.bus); s.start(t); s.stop(t + 0.45); },
  rumble: () => rumbleRoll(now2(), 0.8, 0.6, 40),
  fire: () => { const t = now2(); fireWhoosh(t, 1.1, 0.3); },
  count: () => { const t = now2(); timpani(t, hz(45), 0.4, 0.5); },
  go: () => { const t = now2(); timpani(t, hz(45), 0.6, 0.8); crash(t, 0.16, 1.4); [57, 64, 69].forEach(m => horns(t, hz(m), 0.35, 0.1, { a: 0.006, open: 5 })); },
  ui: () => pageTurn(now2(), 0.12, 0),
  qtePass: () => { const t = now2(); [76, 79, 84].forEach((m, i) => glock(t + i * 0.07, hz(m), 0.2, (i - 1) * 0.4, 0.8)); },   // a QTE beaten (crows)
};
const NEW_GAIN = { caw: 0.84, chest: 0.07, count: 0.32, dive: 0.31, go: 0.23, hit: 0.28, jump: 0.23, laugh: 0.05, mash: 0.69, peck: 0.25, qte: 0.1, root: 1.05, rumble: 0.07, fire: 0.12, snap: 0.26, splash: 0.17, stomp: 0.11, trip: 0.08, ui: 0.67, whoosh: 0.12, wrong: 0.35, qtePass: 0.28,
  'laugh:1': 0.05, 'laugh:2': 0.15, 'laugh:3': 0.08, 'laugh:4': 0.13, 'laugh:5': 0.07, 'laugh:6': 0.73, 'laugh:7': 0.22, 'laugh:8': 0.97, 'laugh:9': 0.05 };

// ── exports ──
export const SONGS = { 1: V4, 2: B2, 3: B3, 4: B4, 5: B5, 6: B6, 7: B7, 8: B8, 9: B9 };
export function makeOrchestra(ctx, out) { C = ctx; G = graph(ctx, out); return G; }
export function setUnderwater(on) {
  if (!G || !C) return;
  const f = G.uw.frequency; f.cancelScheduledValues(C.currentTime); f.setTargetAtTime(on ? 420 : 20000, C.currentTime, on ? 0.06 : 0.12);
}
let sfxStage = 1, sfxHall = null;
export function playChaseSfx(ctx, bus, stage, name, arg) {
  if (!NEW_SFX[name]) return false;
  if (!sfxHall || sfxHall.ctx !== ctx || sfxHall.dst !== bus) sfxHall = { ctx, dst: bus, g: graph(ctx, bus, 1.6, SFX_LEVEL) };
  const keepC = C, keepG = G, hall = sfxHall.g, bus0 = hall.bus;
  const lvl = ctx.createGain(); lvl.gain.value = (name === 'laugh' && NEW_GAIN['laugh:' + stage]) || NEW_GAIN[name] || 1; lvl.connect(bus0);
  C = ctx; G = hall; hall.bus = lvl; hall.choir = {}; sfxStage = stage;
  try { NEW_SFX[name](arg); } finally { hall.bus = bus0; C = keepC || ctx; G = keepG; }
  setTimeout(() => lvl.disconnect(), 6000);
  return true;
}
