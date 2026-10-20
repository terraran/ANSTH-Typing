// Made-up class for checking the layout on this computer: teacher2.html?demo on localhost only
// (never on the real site, so nobody mistakes it for real data). Same shape as getClassData.
import { LESSON_DEFS, STAGES, stepsFor, stepTitle } from '../data/stages.js';

export const DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has('demo');

const FIRST = ['กฤษดา', 'ณัฐธิดา', 'ภูมิ', 'พิมพ์ชนก', 'ธนกร', 'ปภาวรินทร์', 'ศุภกร', 'กัญญาณัฐ', 'อชิตะ', 'ชนัญชิดา', 'ธีรภัทร', 'อภิชญา',
  'พีรพัฒน์', 'ญาดา', 'วรากร', 'ธนพร', 'ชยพล', 'พิชชาภา', 'ภาคิน', 'ภัทรวดี', 'รัชชานนท์', 'วริศรา', 'ปุณณวิช', 'ขวัญข้าว',
  'ต้นกล้า', 'ชาลิสา', 'กันตพงศ์', 'นภัสสร', 'ปัณณวัฒน์', 'ปาณิสรา', 'ณัฐพล', 'มินตรา'];
const LAST = ['ใจดี', 'ศรีสุข', 'วงศ์ทอง', 'แก้วมณี', 'บุญมา', 'สุขเจริญ', 'ทองคำ', 'พรหมมา', 'รัตนวงศ์', 'ชัยมงคล', 'อินทร์แก้ว', 'มีสุข'];

export function demoClass(code) {
  let seed = [...code].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const steps = LESSON_DEFS.filter(d => d.stage <= 6).flatMap(d => stepsFor(d).map((s, i) => ({ title: stepTitle(d, i, s), stage: d.stage })));
  return FIRST.map((f, i) => {
    const name = (i % 2 ? 'ด.ญ. ' : 'ด.ช. ') + f + ' ' + LAST[(i * 5) % LAST.length];
    if (i === 13 || i === 27) return { name, totalSessions: 0, avgCpm: 0, avgAcc: 0, bestCpm: 0, lastActive: '', sessions: [] };
    const reach = Math.floor(steps.length * (0.15 + rnd() * 0.6));
    const idle = i === 9 ? 12 : i === 30 ? 9 : rnd() < 0.75 ? Math.floor(rnd() * 4) : Math.floor(3 + rnd() * 5);
    const accBase = i === 4 ? 80 : 88 + rnd() * 10;
    const sessions = Array.from({ length: Math.min(reach, 24) }, (_, k, n = Math.min(reach, 24)) => {
      const st = steps[Math.floor(reach * (k + 1) / n) - 1] || steps[0];
      const wpm = STAGES[st.stage - 1].target * (0.8 + rnd() * 0.9) * (i === 21 ? 0.5 : 1);
      return { date: new Date(Date.now() - (idle + (n - k) * 1.3) * 86400000).toISOString(), exercise: st.title,
        cpm: Math.round(wpm * 4), wpm: Math.round(wpm * 4 / 5), accuracy: Math.min(100, Math.round(accBase + (rnd() - 0.5) * 8)),
        errors: Math.floor(rnd() * 8), chars: 120, duration: 60 };
    });
    const avg = k => sessions.reduce((a, s) => a + s[k], 0) / sessions.length;
    return { name, totalSessions: sessions.length, avgCpm: Math.round(avg('cpm')), avgAcc: Math.round(avg('accuracy')),
      bestCpm: Math.max(...sessions.map(s => s.cpm)), lastActive: sessions[sessions.length - 1].date, sessions };
  });
}

// Stand-in for backend/school.js while DEMO is on — the same calls, answered from memory.
export function demoApi() {
  const today = new Date(), ymd = d => d.toISOString().slice(0, 10);
  const day = n => { const d = new Date(today); d.setDate(d.getDate() + n); return ymd(d); };
  const monday = (() => { const d = new Date(today); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return ymd(d); })();
  const week = n => { const d = new Date(monday); d.setDate(d.getDate() + 7 * n); return ymd(d); };
  const classes = ['Y503', 'Y505', 'Y601', 'Y603', 'Y604'];
  const names = c => demoClass(c).map(s => s.name);
  let unlocks = [{ classCode: 'Y603', studentName: '', stage: 3 }];
  let nextId = 10;
  let homework = [
    { hwId: 'h1', classCode: 'Y603', studentName: '', title: 'ด่าน 3 · ป่าใหญ่', mode: 'stage', stage: 3, lessonId: 109, exerciseTitle: '', minStars: 2, dueDate: day(3), total: 32, passed: 14, tried: 25 },
    { hwId: 'h2', classCode: 'Y603', studentName: names('Y603')[4], title: 'บท 8 · 8.4 วลี', mode: 'exercise', stage: 3, lessonId: 108, exerciseTitle: '8.4 วลี', minStars: 1, dueDate: day(6), total: 1, passed: 0, tried: 1 },
    { hwId: 'h3', classCode: 'Y603', studentName: '', title: 'ด่าน 2 · ทุ่งหญ้ากว้าง', mode: 'stage', stage: 2, lessonId: 106, exerciseTitle: '', minStars: 2, dueDate: day(-4), total: 32, passed: 29, tried: 32 },
  ];
  let tests = [
    { testId: 't1', grade: 'Y6', weekStart: week(-1), stage: 2, lessonId: 106, exerciseTitle: 'ด่าน 2 · ทุ่งหญ้ากว้าง', showHints: true, done: 88, total: 96 },
    { testId: 't2', grade: 'Y6', weekStart: week(0), stage: 3, lessonId: 109, exerciseTitle: 'ด่าน 3 · ป่าใหญ่', showHints: true, done: 51, total: 96 },
    { testId: 't3', grade: 'Y6', weekStart: week(1), stage: 3, lessonId: 109, exerciseTitle: 'ด่าน 3 · ป่าใหญ่', showHints: false, done: 0, total: 96 },
  ];
  const hwList = () => ({ homework, classes: Object.fromEntries(classes.map(c => [c, names(c)])), today: day(0) });
  return {
    teacherClasses: async () => ({ classes }),
    getUnlocks: async () => ({ unlocks }),
    classData: async c => ({ students: demoClass(c) }),
    setUnlock: async (classCode, studentName, stage) => {
      unlocks = unlocks.filter(u => !(u.classCode === classCode && u.studentName === studentName));
      if (stage) unlocks.push({ classCode, studentName, stage });
      return { unlocks };
    },
    resetTips: async () => ({ reset: 32 }),
    homeworkList: async () => hwList(),
    homeworkResults: async hwId => {
      const h = homework.find(x => x.hwId === hwId), list = h.studentName ? [h.studentName] : names(h.classCode);
      return { students: list.map((name, i) => {
        const status = h.studentName ? 'tried' : i < h.passed ? 'passed' : i < h.tried ? 'tried' : 'none', a = status === 'none' ? 0 : 1 + i % 4;
        return { name, status, best: status === 'passed' ? 2 + (i % 3 === 0) : i % 2, wpm: 6 + i % 9, acc: 86 + i % 13, attempts: a,
          passedAt: status === 'passed' ? day(-(i % 3)) : '', lastAt: a ? day(-(i % 3)) : '' };
      }) };
    },
    setHomework: async v => {
      if (v.hwId) homework = homework.map(h => h.hwId === v.hwId ? { ...h, minStars: Number(v.minStars), dueDate: v.dueDate } : h);
      else homework = [...homework, { ...v, hwId: 'h' + nextId++, minStars: Number(v.minStars), total: v.studentName ? 1 : 32, passed: 0, tried: 0 }];
      return hwList();
    },
    deleteHomework: async hwId => { homework = homework.filter(h => h.hwId !== hwId); return hwList(); },
    weeklyTests: async () => ({ tests, grades: [{ grade: 'Y5', students: 64 }, { grade: 'Y6', students: 96 }], currentWeek: monday }),
    weeklyResults: async testId => {
      const t = tests.find(x => x.testId === testId), rooms = ['Y601', 'Y603', 'Y604'];
      const ranking = Array.from({ length: Math.min(t.done, 30) }, (_, i) => ({ rank: i + 1, name: names(rooms[i % 3])[i], room: rooms[i % 3],
        score: 980 - i * 29, max: 1000, kpm: Math.round((18 - i * .4) * 4), wpm: 0, accuracy: 99 - Math.floor(i / 3), attempts: 1 + i % 4, lastAt: day(-1) }));
      const notDone = t.done >= t.total ? [] : rooms.map((r, k) => ({ room: r, names: names(r).slice(20 + k, 26 + k * 2) }));
      return { ranking, notDone };
    },
    setWeeklyTest: async v => {
      const old = tests.find(t => t.grade === v.grade && t.weekStart === v.weekStart);
      const t = { testId: old?.testId || 't' + nextId++, grade: v.grade, weekStart: v.weekStart, stage: v.stage, lessonId: v.lessonId,
        exerciseTitle: v.exerciseTitle, showHints: v.showHints === '1', done: old?.done || 0, total: 96 };
      tests = [...tests.filter(x => x !== old), t];
      return { ok: true };
    },
    deleteWeeklyTest: async testId => { tests = tests.filter(t => t.testId !== testId); return { ok: true }; },
  };
}
