// ═══════════════════════════════════════════════════════════════
// GEMS 💎 — the dress-up shop's money (CLAUDE.md 1.6)
//   The school server (Apps Script Shop.gs) does these same sums and is the one that counts:
//   the app never tells it how many gems to give. This file = the rules in one place, the words
//   on the results screen, and a stand-in wallet on this device for testing (edition "shop": "demo").
//
//   Lessons, per step: the first time a star level is reached ⭐ 40 · ⭐⭐ 70 · ⭐⭐⭐ 100 (more stars
//   later = the difference), × stage (1 + 0.125 per stage: stage 9 = ×2).
//   Replays: 20 % of that for the stars of the round, paid 3 times per step per day.
//   ⚔️ Rush clear = ⭐⭐⭐ paid for every step of the lesson.
//   Weekly test: joining 50 · beating my own best +50 · place 1/2/3 in my room +100/70/50 (at the end of the week).
//   Races (5 paid per day): 1v1 win 30 · draw 20 · lose 10 · Battle Royale 1st 40 · 2nd 25 · 3rd 15 · others 10.
// ═══════════════════════════════════════════════════════════════
import { LESSONS } from '../data/lessons';
import { hsKey } from './scoring';

export const FIRST_GEMS = [0, 40, 70, 100];
export const REPLAY_SHARE = 0.2;
export const REPLAYS_PER_DAY = 3;
export const RACES_PER_DAY = 5;
export const WEEKLY_GEMS = { join: 50, best: 50, place: [100, 70, 50] };
export const RACE_GEMS = { win: 30, draw: 20, lose: 10, place: [40, 25, 15], other: 10 };
export const stageMult = stage => 1 + 0.125 * (Math.max(1, Number(stage) || 1) - 1);

// One curriculum step played. paid = { stepKey: stars already paid for } · replaysToday = paid replays of this step today.
// → { earned, lines: [{ kind, amount, ... }], paid: updated map }
export function lessonGems({ lesson, exercise, stars, paid = {}, replaysToday = 0, rushClear = false }) {
  const mult = stageMult(lesson.stage), key = hsKey(lesson.id, exercise.title);
  const lines = [], next = { ...paid };
  const prev = paid[key] || 0;
  if (stars > prev) {
    const base = FIRST_GEMS[stars] - FIRST_GEMS[prev], total = Math.round(base * mult);
    lines.push({ kind: 'first', stars, prev, amount: base });
    if (total > base) lines.push({ kind: 'stage', stage: lesson.stage, mult, amount: total - base });
    next[key] = stars;
  } else if (stars === 0) {
    lines.push({ kind: 'zero', amount: 0 });
  } else if (replaysToday >= REPLAYS_PER_DAY) {
    lines.push({ kind: 'cap', amount: 0 });
  } else {
    lines.push({ kind: 'replay', stars, n: replaysToday + 1, max: REPLAYS_PER_DAY,
      amount: Math.round(FIRST_GEMS[stars] * REPLAY_SHARE * mult) });
  }
  if (rushClear) {
    let n = 0, amount = 0;
    for (const ex of lesson.exercises) {
      const k = hsKey(lesson.id, ex.title);
      if (k === key || (next[k] || 0) >= 3) continue;
      amount += Math.round((FIRST_GEMS[3] - FIRST_GEMS[next[k] || 0]) * mult); next[k] = 3; n++;
    }
    if (n) lines.push({ kind: 'rush', steps: n, amount });
  }
  return { earned: lines.reduce((a, l) => a + l.amount, 0), lines, paid: next };
}

// Gems for the stars already earned before the shop opened (paid once). progress = { stars, cleared }
export function backPay(progress) {
  const paid = {}; let stars = 0, rush = 0, amount = 0;
  for (const les of LESSONS) {
    if (!les.curriculum) continue;
    const mult = stageMult(les.stage), cleared = !!progress?.cleared?.[les.id];
    if (cleared) rush++;
    for (const ex of les.exercises) {
      const k = hsKey(les.id, ex.title), s = Math.max(progress?.stars?.[k] || 0, cleared ? 3 : 0);
      if (!s) continue;
      paid[k] = s; stars += progress?.stars?.[k] || 0; amount += Math.round(FIRST_GEMS[s] * mult);
    }
  }
  return { amount, stars, rush, paid };
}

export function raceGems({ type, result, place, racesToday = 0 }) {
  if (racesToday >= RACES_PER_DAY) return { earned: 0, lines: [{ kind: 'raceCap', amount: 0 }] };
  const line = type === 'royale'
    ? { kind: 'place', place, amount: RACE_GEMS.place[place - 1] || RACE_GEMS.other }
    : { kind: result === 'win' ? 'win' : result === 'draw' ? 'draw' : 'lose', amount: RACE_GEMS[result] || RACE_GEMS.lose };
  line.n = racesToday + 1; line.max = RACES_PER_DAY;
  return { earned: line.amount, lines: [line] };
}

// Words for one line on the results screen.
export function lineText(l) {
  const st = n => '⭐'.repeat(n);
  switch (l.kind) {
    case 'first':   return l.prev ? `${st(l.prev)} → ${st(l.stars)} ได้ดาวเพิ่มครั้งแรก` : `${st(l.stars)} ครั้งแรก`;
    case 'stage':   return `ด่าน ${l.stage} ยากขึ้น ×${Math.round(l.mult * 1000) / 1000}`;
    case 'replay':  return `เล่นซ้ำ ${st(l.stars)} (ครั้งที่ ${l.n} จาก ${l.max} วันนี้)`;
    case 'cap':     return 'ขั้นนี้วันนี้ได้เพชรครบ 3 ครั้งแล้ว — ลองขั้นอื่นดูสิ! พรุ่งนี้กลับมาได้อีก';
    case 'zero':    return 'ยังไม่ได้ดาว จึงยังไม่ได้เพชร — แม่นยำ 90% ขึ้นไปถึงได้ ⭐';
    case 'rush':    return `⚔️ Rush ผ่านทั้งบท: นับ ⭐⭐⭐ ให้อีก ${l.steps} ขั้น`;
    case 'join':    return 'เข้าร่วมแบบทดสอบประจำสัปดาห์';
    case 'best':    return 'ทำลายสถิติตัวเอง!';
    case 'rankLater': return 'อันดับในห้อง: รับรางวัลตอนจบสัปดาห์';
    case 'win':     return `ชนะ 1v1 (รอบที่ ${l.n} จาก ${l.max} วันนี้)`;
    case 'draw':    return `เสมอ 1v1 (รอบที่ ${l.n} จาก ${l.max} วันนี้)`;
    case 'lose':    return `ร่วมแข่ง 1v1 (รอบที่ ${l.n} จาก ${l.max} วันนี้)`;
    case 'place':   return `Battle Royale อันดับ ${l.place} (รอบที่ ${l.n} จาก ${l.max} วันนี้)`;
    case 'raceCap': return 'วันนี้ได้เพชรจากการแข่งครบ 5 รอบแล้ว — แข่งต่อได้ แต่พรุ่งนี้ถึงได้เพชรอีก';
    default:        return '';
  }
}
export const isNote = l => l.kind === 'cap' || l.kind === 'zero' || l.kind === 'raceCap' || l.kind === 'rankLater';

// ── Stand-in wallet on this device (edition.json "shop": "demo" — local testing only, never on the site) ──
const LS = 'gemDemo';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
function readDemo() { try { return JSON.parse(localStorage.getItem(LS)) || null; } catch { return null; } }
function writeDemo(w) { try { localStorage.setItem(LS, JSON.stringify(w)); } catch {} }
function dayCount(w, kind, ref) { return (w.log || []).filter(e => e.day === today() && e.kind === kind && (!ref || e.ref === ref)).length; }

export const demoWallet = {
  async getWallet({ progress }) {
    let w = readDemo(), notices = [];
    if (!w) {
      const b = backPay(progress);
      w = { gems: b.amount, owned: [], paid: b.paid, log: [] };
      if (b.amount) notices.push({ kind: 'backpay', amount: b.amount, stars: b.stars, rush: b.rush });
      writeDemo(w);
    }
    return { gems: w.gems, owned: w.owned, notices };
  },
  async buyItem(item, price) {
    const w = readDemo();
    if (!w || !price) throw new Error('NOT_FOR_SALE');
    if (w.owned.includes(item)) throw new Error('OWNED');
    if (w.gems < price) throw new Error('NOT_ENOUGH');
    w.gems -= price; w.owned.push(item); writeDemo(w);
    return { gems: w.gems, owned: w.owned };
  },
  session({ lesson, exercise, stars, rushClear }) {
    const w = readDemo(); if (!w) return null;
    const key = hsKey(lesson.id, exercise.title);
    const r = lessonGems({ lesson, exercise, stars, paid: w.paid, replaysToday: dayCount(w, 'replay', key), rushClear });
    if (r.lines.some(l => l.kind === 'replay')) w.log.push({ day: today(), kind: 'replay', ref: key });
    w.paid = r.paid; w.gems += r.earned; writeDemo(w);
    return { earned: r.earned, lines: r.lines, gems: w.gems };
  },
  race({ type, result, place }) {
    const w = readDemo(); if (!w) return null;
    const r = raceGems({ type, result, place, racesToday: dayCount(w, 'race') });
    if (r.earned) w.log.push({ day: today(), kind: 'race' });
    w.gems += r.earned; writeDemo(w);
    return { earned: r.earned, lines: r.lines, gems: w.gems };
  },
};
