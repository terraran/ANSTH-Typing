// Boss-chase story songs (orchestra, src/ui/orchestra.js) — one per stage; a stage without one keeps its chiptune boss song.
// Approved mock: .claude/mock/boss-theme.html (v4). Every song tells its boss's story in sections that follow the chase:
//   intro  (the boss talks; may hand over to another looping section via `next`, e.g. the boar's 'lurk')
//   dash   (the boss runs in → "พร้อม… เริ่ม!"; 2 bars, then `next: 'p1'` by itself)
//   p1     (the chase, loops)          p2  (rage: a new song, 15 % faster, loops)
//   win / escape / lost   (⭐⭐⭐ · ⭐–⭐⭐ · 0 stars; play once and end)
// A section = { bpm, bars, chords, loop | next, play(bar, step, time, secondsPerStep, firstPass) }, steps are 16ths.
// Section changes wait for the next beat (src/ui/sound.js). Each stage entry is a factory: (kit from makeOrchestra) → sections.

export const BOSS_THEMES = {
  // ── stage 1 · เจ้าหมูป่าจอมป่วน: two themes fight — the village (us, major, flute / violins)
  //    vs the boar (swagger 3+3+2 in trombones + tuba, every phrase ends "ฮึ่ม-อู๊ด!") ──
  1: (o) => {
    const { hz, chord, line, tri, wide, strings, vln, cello, horns, bones, tuba, choir, bell, bassoon, pizz, flute, xylo,
      timpani, bigDrum, ensemble, crash, swell, gong, sub, braaam, snare, gallop, grunt, alarm } = o;
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

    return {
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
    p2: { bpm: 161, bars: 16, loop: true, name: '4 · บอสคลั่ง (เฟส 2)', chords: [...BOAR_CH, ...HERO_CH],
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
        if (!half) {        // round 1: the boar takes over
          if (s === 0) choir(t, wide(c), 16 * sd, 0.16, { a: 0.2 });
          if ([3, 6, 11, 14].includes(s)) choir(t, tri(c).map(m => m + 12), sd * 1.1, 0.18, { a: 0.012, r: 0.15, width: 0.8, voices: 2 });
          (boar.get(bb * 16 + s) || []).forEach(n => { boarBrass(t, sd, n, H, 1.25); horns(t, H(n.m + 12), n.len * sd * 0.8, 0.05, { grit: true, a: 0.01 }); });
          if (GRUNT_BARS.includes(bb) && s === 8) { grunt(t, sd, k.bass, 1.3); braaam(t + sd * 4, k.bass + 17, sd * 4, 0.1); }
        } else {            // round 2: the village theme fights back, a half step higher
          if (s === 0) choir(t, wide(c).map(m => m + 1), 16 * sd, 0.12, { a: 0.2 });
          (hero.get(bb * 16 + s) || []).forEach(n => { const d = n.len * sd * 0.95;
            vln(t, H(n.m), d, 0.08, { a: 0.015, r: 0.2 }); vln(t, H(n.m + 12), d, 0.04, { a: 0.015, r: 0.2, voices: 2 });
            horns(t, H(n.m - 12), d, 0.07, { a: 0.02, open: 5 });
            if (n.len >= 4) choir(t, [n.m - 12 + tr, n.m + tr], d, 0.26, { a: 0.03, r: 0.25, width: 0.75, voices: 2 }); });
          if (bb % 2 === 1 && s === 8) grunt(t, sd, k.bass + tr, 1);
          if (s === 0) tuba(t, H(k.bass - 12), 16 * sd * 0.9, 0.06);
        }
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
  },
};
