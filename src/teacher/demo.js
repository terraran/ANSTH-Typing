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
