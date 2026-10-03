import { findKeyForChar } from './keymap';

// ═══════════════════════════════════════════════════════════════
// SCORING  (Kahoot-style) — points = letter × speed × combo
// ═══════════════════════════════════════════════════════════════
export const SCORE_RARE = new Set([...'๐๑๒๓๔๕๖๗๘๙ฎฏฐฑฒฌฆฃฅฬฦฤฯฺํ฿".,()?+%']);

export const SCORE_HOME = new Set(['KeyA','KeyS','KeyD','KeyF','KeyG','KeyH','KeyJ','KeyK','KeyL','Semicolon','Quote','Space']);

export const SCORE_ROWS = new Set(['KeyQ','KeyW','KeyE','KeyR','KeyT','KeyY','KeyU','KeyI','KeyO','KeyP','BracketLeft','BracketRight',
  'KeyZ','KeyX','KeyC','KeyV','KeyB','KeyN','KeyM','Comma','Period','Slash']);

// Home 100 · top/bottom 200 · far reach (number row, \ `) 300 · Shift 400 · rare/numerals/marks 500
export function charBasePoints(ch) {
  if (SCORE_RARE.has(ch)) return 500;
  const k = findKeyForChar(ch);
  if (!k) return 100;
  if (k.needsShift) return 400;
  if (SCORE_HOME.has(k.code)) return 100;
  if (SCORE_ROWS.has(k.code)) return 200;
  return 300;
}

// Target speed rises gently through the lessons (keystrokes per minute).
export function lessonTargetKpm(lessonId) { return Math.min(160, 60 + (Math.max(1, Number(lessonId)||1) - 1) * 8); }

// ×1.0 at or above target speed, down to ×0.5 at half speed (average of last 5 keys).
export function speedMultiplier(intervals, lessonId) {
  if (!intervals.length) return 1;
  const avg = intervals.reduce((a,b)=>a+b,0) / intervals.length;
  const targetMs = 60000 / lessonTargetKpm(lessonId);
  return Math.max(0.5, Math.min(1, targetMs / Math.max(1, avg)));
}

// +10% per 10 correct keys in a row, max ×1.5. `streak` = correct keys before this one.
export function comboMultiplier(streak) { return 1 + Math.min(5, Math.floor(streak / 10)) * 0.1; }

// Perfect run: full speed, no mistakes.
export function maxScoreFor(chars) {
  return chars.reduce((sum, ch, i) => sum + Math.round(charBasePoints(ch) * comboMultiplier(i)), 0);
}

export function starsFor(score, maxScore) {
  const pct = maxScore > 0 ? score / maxScore * 100 : 0;
  return pct >= 85 ? 3 : pct >= 65 ? 2 : pct >= 45 ? 1 : 0;
}

// Practice high scores are keyed like the backend: "lessonId|1.1" (number prefix
// survives exercise renames). Signed-in: from Sheets. Guest: this device only.
export function hsKey(lessonId, title) {
  const t=String(title||'').trim();
  const m=t.match(/^(\d+\.\d+)/);
  return (Number(lessonId)||0)+'|'+(m?m[1]:t);
}

export function readGuestHighScores() { try { return JSON.parse(localStorage.getItem('highScores_guest')||'{}')||{}; } catch { return {}; } }

export function writeGuestHighScores(map) { try { localStorage.setItem('highScores_guest', JSON.stringify(map)); } catch {} }

export const fmtScore = n => Number(n||0).toLocaleString('en-US');

// ═══════════════════════════════════════════════════════════════
// WEEKLY TEST — one 2-minute test per grade level per week
// ═══════════════════════════════════════════════════════════════
export const TEST_SECS      = 120;

export const TEST_MIN_CHARS = 700;

// Target score (100%): every key correct at the lesson's target speed for the full 2 minutes.
// Fast, accurate students can go above 100%.
export function testTargetScore(chars, lessonId) {
  const budget = lessonTargetKpm(lessonId) * TEST_SECS / 60;
  let keys = 0, n = 0;
  while (n < chars.length) {
    const k = findKeyForChar(chars[n]);
    keys += k && k.needsShift ? 2 : 1;
    if (keys > budget) break;
    n++;
  }
  return Math.max(1, maxScoreFor(chars.slice(0, n)));
}

export function parseYmd(s) {
  const m = String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2]-1, +m[3]) : null;
}

export function fmtWeekRange(ymd) {
  const a = parseYmd(ymd);
  if (!a) return '';
  const b = new Date(a); b.setDate(b.getDate() + 6);
  const f = d => d.toLocaleDateString('th-TH', {day:'numeric', month:'short'});
  return f(a) + ' – ' + f(b);
}

export function fmtTimeLeft(ms) {
  if (!(ms > 0)) return 'ปิดแล้ว';
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  if (d > 0) return `เหลือ ${d} วัน ${h % 24} ชม.`;
  if (h > 0) return `เหลือ ${h} ชม. ${Math.floor(ms % 3600000 / 60000)} นาที`;
  return `เหลือ ${Math.max(1, Math.ceil(ms / 60000))} นาที`;
}

export function pctOf(score, max) { return max > 0 ? Math.round(score / max * 100) : 0; }

// SPAM THRESHOLDS
export const SPEED_CPM       = 750;

// keys/min over the last SPAM_WINDOW_KEYS keys…
export const SPAM_WINDOW_KEYS = 10;

export const SPAM_WRONG_SHARE = 0.5;

// …and at least half of them wrong → spam
export const ERROR_WINDOW_MS = 3000;

export const ERROR_BURST     = 9;

export const SPAM_PENALTY    = 5;

// seconds frozen after spam detection (no longer a kick)
export const PRESSURE_SECS   = 10;
