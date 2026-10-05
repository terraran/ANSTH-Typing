// ═══════════════════════════════════════════════════════════════
// CURRICULUM LOCKS
//   progress = { stars:{"101|1.1":3,…}, cleared:{"101":true,…}, teacherStage:0 }
//   • Stage 1 is open. Stage s opens when the last lesson (boss) of stage s-1 is complete,
//     or the teacher unlocked stage ≥ s (then every step in it is open).
//   • In an open stage, lessons and steps go in order: a step opens when the step before has ⭐,
//     a lesson opens when the lesson before is complete.
//   • ⚔️ Rush: the LAST step of every lesson in an open stage is always playable. ⭐⭐⭐ on it
//     clears the whole lesson (earlier steps open, next lesson opens) — only for really good typists.
//   • A lesson is complete when every step has ⭐, or it was cleared by a Rush.
// ═══════════════════════════════════════════════════════════════
import { LESSONS } from '../data/lessons';
import { hsKey } from './scoring';

export const RUSH_STARS = 3;
export const emptyProgress = () => ({ stars: {}, cleared: {}, teacherStage: 0 });

const stageLessons = s => LESSONS.filter(l => l.stage === s);
export const stepKey = (les, ex) => hsKey(les.id, ex.title);
export const starsOf = (p, les, ex) => (p.stars || {})[stepKey(les, ex)] || 0;

export function lessonComplete(p, les) {
  if (!les) return false;
  return !!(p.cleared || {})[les.id] || les.exercises.every(ex => starsOf(p, les, ex) > 0);
}

export function stageOpen(p, s) {
  if (s <= 1 || (p.teacherStage || 0) >= s) return true;
  const prev = stageLessons(s - 1);
  return lessonComplete(p, prev[prev.length - 1]);
}

export function stageDone(p, s) { const l = stageLessons(s); return lessonComplete(p, l[l.length - 1]); }

export function lessonOpen(p, les) {
  if (!stageOpen(p, les.stage)) return false;
  if ((p.teacherStage || 0) >= les.stage) return true;
  const list = stageLessons(les.stage), i = list.indexOf(les);
  return i <= 0 || lessonComplete(p, list[i - 1]);
}

// → { open, rush, reason }  (rush = playable only as a Rush; needs ⭐⭐⭐ to clear the lesson)
export function stepState(p, les, i) {
  if (!les?.curriculum) return { open: true };
  if (!stageOpen(p, les.stage)) return { open: false, reason: `ผ่านบอสของด่าน ${les.stage - 1} ก่อน` };
  if ((p.teacherStage || 0) >= les.stage || lessonComplete(p, les)) return { open: true };
  const exs = les.exercises, last = i === exs.length - 1;
  if (lessonOpen(p, les) && (i === 0 || starsOf(p, les, exs[i - 1]) > 0)) return { open: true };
  if (last) return { open: true, rush: true };
  if (!lessonOpen(p, les)) {
    const list = stageLessons(les.stage), prev = list[list.indexOf(les) - 1];
    return { open: false, reason: `ผ่านบท ${prev?.num} ก่อน หรือ ⚔️ Rush ขั้นสุดท้าย` };
  }
  return { open: false, reason: 'ได้ ⭐ ขั้นก่อนหน้าก่อน' };
}

export function lessonAnyOpen(p, les) { return les.exercises.some((_, i) => stepState(p, les, i).open); }

export function stageStars(p, s) {
  let got = 0, max = 0;
  for (const les of stageLessons(s)) for (const ex of les.exercises) { got += starsOf(p, les, ex); max += 3; }
  return { got, max };
}

// Guest (not signed in): progress lives on this device only.
const LS_STARS = 'curStars_v1', LS_CLEARED = 'curCleared_v1';
export function readLocalProgress() {
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch { return {}; } };
  return { stars: read(LS_STARS), cleared: read(LS_CLEARED), teacherStage: 0 };
}
export function writeLocalProgress(p) {
  try { localStorage.setItem(LS_STARS, JSON.stringify(p.stars || {})); localStorage.setItem(LS_CLEARED, JSON.stringify(p.cleared || {})); } catch {}
}
