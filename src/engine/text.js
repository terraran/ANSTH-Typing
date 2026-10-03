import { LESSONS } from '../data/lessons';

// ── SAFE ZONE CONFIG ──────────────────────────────────────────────────
// Zone starts 30s into the race, advances at ZONE_CPM chars/min.
// Players more than ZONE_GAP chars behind lose 1 life every ZONE_TICK ms.
// Text display: show ~2 lines at a time, advance on completion
export const CHUNK_CHARS = 76;

// chars per chunk (~2 lines at 34px Thai font)

// Build word-boundary chunks — extracted to module level so Babel handles it reliably
export function buildChunks(targetChars) {
  if (!targetChars.length) return [{start:0,end:0}];
  const result = [];
  let start = 0;
  while (start < targetChars.length) {
    let end = Math.min(start + CHUNK_CHARS, targetChars.length);
    if (end < targetChars.length) {
      // Advance to end of current word — never split mid-word
      while (end < targetChars.length && targetChars[end] !== ' ') end++;
      // Include the trailing space in this chunk
      if (end < targetChars.length) end++;
    }
    result.push({start, end});
    start = end;
    if (result.length > 200) break; // safety cap
  }
  return result;
}

// TEXT GENERATOR

export function generateText(words, minChars, rng = Math.random) {
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const result = [];
  let chars = 0, i = 0;
  while (chars < minChars) {
    const word = arr[i % arr.length];
    result.push(word);
    chars += [...word].length + 1;
    i++;
    if (i > arr.length * 6) break;
  }
  return result.join(' ');
}

// Deterministic RNG so every student in a grade gets the same weekly test text.
export function seededRng(seedText) {
  let h = 2166136261;
  for (const c of String(seedText)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6D2B79F5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// longer than anyone can type in 2 minutes

// Reshuffles the word bank pass after pass until the text is long enough.
export function generateTimedText(words, minChars, rng) {
  const pool = cleanTypingWords(words);
  if (!pool.length) return '';
  const out = [];
  let chars = 0;
  while (chars < minChars) {
    const arr = [...pool];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    for (const w of arr) {
      out.push(w);
      chars += [...w].length + 1;
      if (chars >= minChars) break;
    }
  }
  return out.join(' ');
}

// ── STORY UTILITIES ──────────────────────────────────────
// Keep a clean, deduplicated wordbank for each lesson. Battle Royale uses only
// the selected lesson's bank, so later keyboard rows cannot leak into its text.
export const UNSUITABLE_WORDS = ['เด้า','ฆ่า','ฆาตกรรม','เฆี่ยน','ห่า','ด่า'];

export function cleanTypingWords(words) {
  return [...new Set((words||[]).filter(word=>word && !UNSUITABLE_WORDS.includes(word)))];
}

export function buildLessonWordList(lesson) {
  const exercises=lesson?.exercises||lesson?.exercisesA||lesson?.exercisesGold||[];
  return cleanTypingWords(exercises.flatMap(ex=>ex.words||[]));
}

export const LESSON_WORDLISTS=Object.fromEntries(LESSONS.map(lesson=>[lesson.id,buildLessonWordList(lesson)]));

export function generateBRText(startLesson, startExercise, minLength) {
  const wordPool=LESSON_WORDLISTS[startLesson.id]||buildLessonWordList(startLesson);
  if (!wordPool.length) return generateText(cleanTypingWords(startExercise?.words),minLength);
  return generateText(wordPool,Math.max(minLength,500));
}

export function generateStoryText(words, name) {
  const n = name||'นักผจญภัย';
  return words.map(w=>w.replace(/__NAME__/g,n)).join(' ');
}
