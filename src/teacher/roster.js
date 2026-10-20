// Turns getClassData's students into the rows of the teacher table.
// Stage reached and stars are worked out from the session history: a session's exercise title
// ("12.3 คำ") names a curriculum step, and its speed/accuracy give that step's ⭐ by the lesson rule.
import { LESSON_DEFS, STAGES, lessonIdOf, stepsFor, stepTitle } from '../data/stages.js';
import { lessonStars } from '../engine/scoring.js';

// Every curriculum step title → { n (lesson 1–34), stage }. Old-curriculum titles ("1.1 ตัวอักษรเดี่ยว") don't match.
const STEP_OF = new Map();
let STAR_MAX = 0;
const STAGE_MAX = STAGES.map(() => 0);
for (const def of LESSON_DEFS) stepsFor(def).forEach((s, i) => {
  STEP_OF.set(stepTitle(def, i, s), { n: def.n, stage: def.stage });
  STAR_MAX += 3; STAGE_MAX[def.stage - 1] += 3;
});
export { STAR_MAX, STAGE_MAX };
export const LESSON_COUNT = LESSON_DEFS.length;

// Thai WPM = keystrokes ÷ 4 per minute — the unit the game's ⭐ targets use.
export const wpmOf = s => Math.round((Number(s.cpm) || 0) / 4);

export const daysSince = d => {
  if (!d) return null;
  const t = new Date(d).getTime();
  return isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

// Unlock stage for one student: their own unlock, else the whole class's (0 = none).
function unlockOf(unlocks, classCode, name) {
  let own = 0, all = 0;
  for (const u of unlocks || []) {
    if (u.classCode !== classCode) continue;
    if (u.studentName === name) own = Number(u.stage) || 0;
    else if (!u.studentName) all = Number(u.stage) || 0;
  }
  return { stage: own || all, own: !!own };
}

export function buildRows(students, unlocks, classCode) {
  return (students || []).map((st, i) => {
    const sessions = (st.sessions || []).filter(s => s && s.date)
      .slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const best = {};                       // step title → best ⭐
    let lesson = 0, stage = 0;
    for (const s of sessions) {
      const step = STEP_OF.get(String(s.exercise || '').trim());
      if (!step) continue;
      if (step.n > lesson) { lesson = step.n; stage = step.stage; }
      const stars = lessonStars(wpmOf(s), Number(s.accuracy) || 0, STAGES[step.stage - 1].target);
      best[s.exercise] = Math.max(best[s.exercise] || 0, stars);
    }
    const stageStars = STAGES.map(() => 0);
    let stars = 0;
    for (const [title, n] of Object.entries(best)) { stars += n; stageStars[STEP_OF.get(title.trim()).stage - 1] += n; }
    const last = sessions[sessions.length - 1];
    const prev = sessions.slice(-6, -1);
    const prevAvg = prev.length ? prev.reduce((a, s) => a + wpmOf(s), 0) / prev.length : null;
    const wpm = last ? wpmOf(last) : null;
    const ul = unlockOf(unlocks, classCode, st.name);
    if (st.teacherStage > 0) { ul.stage = st.teacherStage; ul.own = true; }   // code classrooms: unlock kept on the student
    return {
      no: st.no ?? i + 1, name: st.name, code: st.code, noName: !!st.noName, sessions, total: st.totalSessions ?? sessions.length,
      lesson, stage, stars, stageStars,
      wpm, acc: last ? Math.round(Number(last.accuracy) || 0) : null,
      trend: wpm != null && prevAvg != null ? Math.round(wpm - prevAvg) : 0,
      bestWpm: sessions.length ? Math.max(...sessions.map(wpmOf)) : null,
      avgAcc: st.avgAcc ?? null,
      days: daysSince(st.lastActive || last?.date),
      never: !sessions.length,
      unlock: ul.stage, unlockOwn: ul.own,
    };
  });
}

// ⚠️ flag (same limits as the old teacher page: > 7 days idle, accuracy < 85 %) + below the stage target.
// → [kind, text] or null.  kind: 'warn' red · 'mid' amber · 'none' grey
export function flagOf(r) {
  if (r.never) return ['none', 'ยังไม่เข้าเล่น'];
  if (r.days != null && r.days > 7) return ['warn', `⚠️ ไม่ได้เล่น ${r.days} วัน`];
  if (r.avgAcc != null && r.avgAcc < 85) return ['warn', `⚠️ แม่นต่ำ ${Math.round(r.avgAcc)}%`];
  if (r.stage && r.wpm != null && r.wpm < STAGES[r.stage - 1].target) return ['mid', '⚠️ ช้ากว่าเป้าด่าน'];
  return null;
}
export const needsCare = r => { const f = flagOf(r); return !!f && f[0] !== 'none'; };

export const dayText = d => d == null ? '—' : d === 0 ? 'วันนี้' : d === 1 ? 'เมื่อวาน' : `${d} วันก่อน`;

export { STAGES, lessonIdOf };
