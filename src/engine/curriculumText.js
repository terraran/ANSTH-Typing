// Text generators for the curriculum lessons (data/curriculum.js).
// Every generator only uses keys the student has learned up to that lesson.
// rng is injectable so the weekly test can use a seeded generator (same text for the whole grade).
import { CHAR_CLASS } from './keymap.js';
import { LESSON_DEFS } from '../data/stages.js';
import { CURRICULUM_LESSONS } from '../data/curriculum.js';

const pick = (a, rng) => a[Math.floor(rng() * a.length)];
const len = s => [...s].length;

export function learnedChars(n) {
  const set = new Set();
  for (const d of LESSON_DEFS) if (d.n <= n && d.keys) for (const c of d.keys) set.add(c);
  return set;
}

// Join tokens with spaces until minChars, never the same token twice in a row.
function fill(next, minChars, rng) {
  const out = [];
  let chars = 0, guard = 0;
  while (chars < minChars && guard++ < 2000) {
    let t = next(rng), tries = 0;
    while (out.length && t === out[out.length - 1] && tries++ < 6) t = next(rng);
    if (!t) continue;
    out.push(t); chars += len(t) + 1;
  }
  return out.join(' ');
}

const COMBINING = new Set(['AV', 'BV', 'BD', 'TONE', 'AD']);
const HOST_ORDER = [...'กดสหวาฟรนมงทค'];

// Step 1 — new keys alone and mixed with keys already learned: "หหห หาห ดาว"
function drill(les, rng, minChars) {
  const learned = learnedChars(les.num);
  const host = HOST_ORDER.find(c => learned.has(c) && CHAR_CLASS[c] === 'CONS') || 'ก';
  const unit = k => {
    const cls = CHAR_CLASS[k];
    if (COMBINING.has(cls) || k === 'ำ') return host + k;     // ่ ั ็ … need a consonant to sit on
    if (cls === 'LV') return k + host;                         // เก แก
    return k;
  };
  const units = [...les.keys].map(unit);
  const anchors = [...learned].filter(c => !les.keys.includes(c) && !COMBINING.has(CHAR_CLASS[c]) && !'ำะๆฯ'.includes(c));
  const anchorPool = anchors.length ? anchors : units;
  let i = 0;
  return fill(r => {
    if (i < units.length * 2) { const u = units[Math.floor(i++ / 2) % units.length]; return u.repeat(3); }
    if (r() < 0.35) return pick(units, r).repeat(2);
    const u = pick(units, r), a = pick(anchorPool, r);
    return r() < 0.5 ? u + a + u : a + u + a;
  }, minChars, rng);
}

// Step 2 — made-up syllables in correct Thai order: LV + C + (AV|BV) + tone + (า ะ ำ) + final
function syllable(les, rng) {
  const L = learnedChars(les.num);
  const of = cls => [...L].filter(c => CHAR_CLASS[c] === cls);
  const CONS = of('CONS').filter(c => !'ฤฦ'.includes(c)), LV = of('LV'), AV = of('AV'), BV = of('BV'), TONE = of('TONE');
  const FV = of('FV'), FIN = CONS.filter(c => 'กดบนมงยวรลสตจชพศษณญฟทธ'.includes(c));
  const has = c => L.has(c);
  const newKeys = new Set([...les.keys].filter(c => CHAR_CLASS[c] !== 'NON'));
  if (!CONS.length) return null;
  for (let t = 0; t < 60; t++) {
    let s = '';
    const c = pick(CONS, rng);
    if (LV.length && rng() < 0.3) {
      const lv = pick(LV, rng); s = lv + c;
      if ('เแ'.includes(lv) && has('็') && FIN.length && rng() < 0.35) s += '็' + pick(FIN, rng);
      else {
        if (TONE.length && rng() < 0.4) s += pick(TONE, rng);
        if (lv === 'เ' && rng() < 0.3 && (has('า') || has('ะ'))) s += has('า') && (rng() < 0.6 || !has('ะ')) ? 'า' : 'ะ';
        else if (FIN.length && rng() < 0.5) s += pick(FIN, rng);
      }
    } else {
      s = c; const r = rng();
      if (r < 0.35 && AV.length) {
        const v = pick(AV, rng); s += v;
        if (TONE.length && rng() < 0.35) s += pick(TONE, rng);
        if (FIN.length && (v === 'ั' || rng() < 0.5)) s += pick(FIN, rng);
        else if (v === 'ั') continue;
      } else if (r < 0.5 && BV.length) {
        s += pick(BV, rng);
        if (TONE.length && rng() < 0.35) s += pick(TONE, rng);
        if (FIN.length && rng() < 0.5) s += pick(FIN, rng);
      } else if (FV.length) {
        if (TONE.length && rng() < 0.4) s += pick(TONE, rng);
        const v = pick(FV, rng); s += v;
        if (v === 'า' && FIN.length && rng() < 0.5) s += pick(FIN, rng);
      } else if (FIN.length) s += pick(FIN, rng);
    }
    if (has('์') && FIN.length && rng() < 0.15) s += pick(FIN, rng) + '์';
    if ([...s].some(ch => newKeys.has(ch))) return s;
  }
  return null;
}

// Real words: about 70% contain this lesson's new keys, 30% review earlier lessons
function wordPicker(les) {
  const { main, review } = les.pool;
  return r => (!review.length || (main.length && r() < 0.7)) ? pick(main, r) : pick(review, r);
}

// Thai phrases are written without spaces: "หาดาว" — 2–3 words joined
const phrase = word => r => { const k = r() < 0.6 ? 2 : 3; let s = ''; for (let i = 0; i < k; i++) s += word(r); return s; };

// Numbers / prices / dates from the digits learned so far
function patternPicker(les) {
  const L = learnedChars(les.num);
  const digits = [...'๐๑๒๓๔๕๖๗๘๙'].filter(d => L.has(d));
  const items = les.pool.main;
  const current = items.filter(it => [...it].some(c => les.keys.includes(c)));
  const num = (r, k) => { let s = pick(digits.filter(d => d !== '๐'), r) || digits[0]; for (let i = 1; i < k; i++) s += pick(digits, r); return s; };
  const gens = [r => num(r, 1 + Math.floor(r() * 3)), r => 'ข้อ ' + num(r, 1), r => 'ห้อง ' + num(r, 3)];
  if (L.has('฿')) gens.push(r => '฿' + num(r, 2 + Math.floor(r() * 2)));
  const th = n => String(n).replace(/\d/g, d => '๐๑๒๓๔๕๖๗๘๙'[d]);
  const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const allDigits = digits.length === 10;
  if (L.has('/') && allDigits) gens.push(r => th(int(r, 1, 28)) + '/' + th(int(r, 1, 12)) + '/' + th(int(r, 2560, 2579)));
  if (L.has('.') && allDigits) gens.push(r => th(int(r, 6, 18)) + '.' + pick(['๐๐', '๑๕', '๓๐', '๔๕'], r) + ' น.');
  return r => {
    const x = r();
    if (current.length && x < 0.45) return pick(current, r);
    if (items.length && x < 0.65) return pick(items, r);
    return pick(gens, r)(r);
  };
}

function passagesText(les, rng, minChars) {
  const ps = [...les.pool.passages];
  for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
  const out = []; let chars = 0, i = 0;
  while (ps.length && (out.length === 0 || chars < minChars) && i < 200) { const t = ps[i++ % ps.length].text; out.push(t); chars += len(t) + 1; }
  return out.join(' ');
}

export function curriculumText(les, ex, rng = Math.random, opts = {}) {
  const minChars = opts.minChars || ex.minChars || (ex.secs ? ex.secs * 8 : 120);
  const word = wordPicker(les);
  switch (ex.kind) {
    case 'drill':  return drill(les, rng, minChars);
    case 'syll':   return fill(r => syllable(les, r) || word(r), minChars, rng);
    case 'words':  return fill(word, minChars, rng);
    case 'phrase': return fill(phrase(word), minChars, rng);
    case 'timed':
      if (les.type === 'sym' || les.type === 'symboss') {
        const p = patternPicker(les), w = r => pick(les.pool.review, r);
        return fill(r => r() < 0.5 ? p(r) : w(r), minChars, rng);
      }
      return fill(r => r() < 0.6 ? word(r) : phrase(word)(r), minChars, rng);
    case 'pattern': return fill(patternPicker(les), minChars, rng);
    case 'mix': { const p = patternPicker(les), w = r => pick(les.pool.review, r); return fill(r => r() < 0.5 ? p(r) : w(r), minChars, rng); }
    case 'long':      return passagesText(les, rng, opts.minChars || 1);
    case 'longtimed': return passagesText(les, rng, opts.minChars || ex.secs * 6);
  }
  return fill(word, minChars, rng);
}

// Weekly test chosen by stage (teacher picks ด่าน 1–7): about 70% words from that stage's
// lessons, 30% review words from earlier stages; 60% single words, 40% phrases.
// rng = seededRng(testId) → the whole grade gets the same text.
export function stageTestText(stage, rng, minChars) {
  const wordsOf = test => [...new Set(CURRICULUM_LESSONS
    .filter(l => l.type === 'new' && test(l.stage)).flatMap(l => l.pool.main))];
  let main = wordsOf(s => s === stage);
  const review = wordsOf(s => s < stage);
  if (!main.length) main = review;
  const word = r => (!review.length || r() < 0.7) ? pick(main, r) : pick(review, r);
  return fill(r => r() < 0.6 ? word(r) : phrase(word)(r), minChars, rng);
}
