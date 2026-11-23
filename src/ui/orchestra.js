// Orchestra voices for the boss-chase story songs (src/data/bossThemes.js), all synthesized — no audio files.
// Built from the approved mock .claude/mock/boss-theme.html (v4). Stereo: violins left, celli right, choir wide; one hall reverb.
//   makeOrchestra(ctx, out) → the kit (voices + note helpers) that a song's sections play with; every note goes into `out`.
//   One kit is live at a time (a new song builds a new one); notes already scheduled keep their own nodes.

// ── notes ──
const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7] };
const midi = (n) => { const m = n.match(/^([A-G]#?)(\d)$/); return 12 * (+m[2] + 1) + NAMES[m[1]]; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const chord = (c) => { const m = c.match(/^([A-G]#?)(m)?$/), r = NAMES[m[1]];
  return { bass: 40 + ((r - 4 + 12) % 12), mid: 55 + ((r - 7 + 12) % 12), iv: QUAL[m[2] || ''] }; };
function line(bars, shift = 0, stretch = 1) {      // "A5 2 - 2 C6 4" bars → Map(step → [{m, len}])
  const map = new Map();
  bars.forEach((bar, b) => { let at = b * 16; const t = bar.trim().split(/\s+/);
    for (let i = 0; i < t.length; i += 2) { const len = +t[i + 1] * stretch;
      if (t[i] !== '-') { const k = Math.round(at); (map.get(k) || map.set(k, []).get(k)).push({ m: midi(t[i]) + shift, len }); } at += len; } });
  return map;
}

// ── audio graph (stereo): voices → hall bus → (dry + 30 ms pre-delay reverb) → trim → glue compressor → level → out ──
let C = null, G = null;
const LEVEL = 0.55, WET = 0.5;          // the mock's defaults; LEVEL makes the chase phase about as loud as the chiptune songs
function graph(ctx, dst) {
  const out = ctx.createGain(); out.gain.value = LEVEL; out.connect(dst);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.008; comp.release.value = 0.3; comp.connect(out);
  const trim = ctx.createGain(); trim.gain.value = 0.55; trim.connect(comp);
  const bus = ctx.createGain(); bus.connect(trim);
  const pre = ctx.createDelay(); pre.delayTime.value = 0.03;
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 4.5);
  const wet = ctx.createGain(); wet.gain.value = WET;
  bus.connect(pre); pre.connect(verb); verb.connect(wet); wet.connect(trim);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.5) / Math.tanh(2.5); }
  return { out, wet, bus, noise: nb, curve, choir: {} };
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

// ── helpers for writing songs ──
const tri = (c, base = 'mid') => { const k = chord(c); return k.iv.map(i => k[base] + i); };
const wide = (c) => { const k = chord(c), m = tri(c); return [k.bass + 12, m[0], m[1], m[2], m[0] + 12]; };   // SATB spread
const snare = (t, v) => { noise(t, 0.14, { v, hp: 700, bp: 3200, pan: -0.15 }); tone(t, 190, 0.07, { type: 'triangle', v: v * 0.5, f1: 150, pan: -0.15 }); };
// gallop under everything: ta-ta-TUM on every beat
function gallop(s, t, sd, root, H, loud = 1) {
  const p = s % 4; if (p === 3) return;
  const tum = p === 2, off = tum && (s === 6 || s === 14) ? 12 : 0;
  cello(t, H(root + off), sd * (tum ? 1.6 : 0.8), (tum ? 0.15 : 0.09) * loud, { a: 0.005, r: 0.05, voices: 2, vib: false });
  if (tum) strings(t, H(root - 12), sd * 1.6, 0.11 * loud, { bright: 600, a: 0.005, r: 0.05, voices: 2, vib: false, pan: 0.3 });
}
// brass on the chase theme: marcato — short notes clipped, long notes leaned on

// ── voices first used by the boar (v4) ──
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

export function makeOrchestra(ctx, out) {
  C = ctx; G = graph(ctx, out);
  return { hz, midi, chord, line, tri, wide,
    tone, noise, strings, vln, cello, brass, horns, bones, tuba, choir, bell, bassoon, pizz, flute, xylo,
    timpani, bigDrum, ensemble, crash, swell, gong, sub, braaam, snare, gallop, grunt, alarm };
}
