// Builds the curriculum lesson objects (same shape the menus already use for LESSONS:
// id, thaiName, accent, al, exercises[{title, words, …}]) from stages.js + curriculum.gen.js.
import { STAGES, LESSON_DEFS, SYM_ITEMS, lessonIdOf, lessonName, stepsFor, stepTitle } from './stages.js';
import { WORDS, LONG } from './curriculum.gen.js';

const uniq = a => [...new Set(a)];

function build() {
  const allWords = [];
  return LESSON_DEFS.map(def => {
    const st = STAGES[def.stage - 1];
    const before = uniq(allWords);                       // every word from earlier lessons
    let main = [], review = [], passages = [];
    if (def.type === 'new') { main = WORDS[def.n] || []; review = before; allWords.push(...main); }
    else if (def.type === 'boss') { main = before; }
    else if (def.type === 'sym' || def.type === 'symboss') {
      main = LESSON_DEFS.filter(d => d.n <= def.n && SYM_ITEMS[d.n]).flatMap(d => SYM_ITEMS[d.n]);
      review = before;
    } else if (def.type === 'long') { passages = LONG[def.n] || []; }
    // Word bank used by races (1v1 / Battle Royale) and as a fallback
    const bank = def.type === 'long' ? passages.map(p => p.text) : uniq([...main, ...review.slice(-120)]);
    return {
      id: lessonIdOf(def.n), num: def.n, stage: def.stage, type: def.type, keys: def.keys || '',
      curriculum: true, thaiName: lessonName(def), engName: '', desc: st.subtitle,
      accent: st.accent, al: st.al, pool: { main, review, passages },
      exercises: stepsFor(def).map((s, i) => ({ ...s, step: i, title: stepTitle(def, i, s), words: bank })),
    };
  });
}

export const CURRICULUM_LESSONS = build();

export const CURRICULUM_CHAPTERS = STAGES.map(s => ({
  id: s.id, label: 'ด่าน ' + s.id, title: s.title, subtitle: s.subtitle, icon: s.icon,
  from: s.from, to: s.to, dot: s.accent, target: s.target,
  lessonIds: LESSON_DEFS.filter(d => d.stage === s.id).map(d => lessonIdOf(d.n)),
}));

export const stageOf = les => STAGES[(les?.stage || 1) - 1];
