import { SCRIPT_URL } from './config';
import { auth } from './auth';

export async function apiRequest(action, values={}) {
  if (!SCRIPT_URL) throw new Error('Apps Script endpoint is not configured');
  if (!auth.idToken) throw new Error('กรุณาเข้าสู่ระบบ Google ก่อน');
  const body=new URLSearchParams({action, idToken:auth.idToken});
  Object.entries(values).forEach(([key,value])=>body.set(key,String(value??'')));
  const response=await fetch(SCRIPT_URL,{method:'POST',body,redirect:'follow'});
  if (!response.ok) throw new Error('HTTP '+response.status);
  const data=await response.json();
  if (data?.error) throw new Error(data.error);
  return data;
}

// Title screen: classmates' character looks (no names), no sign-in needed.
// Never throws — the title screen falls back to random characters.
export async function apiTitleRunners() {
  try {
    if (!SCRIPT_URL) return [];
    const body = new URLSearchParams({ action: 'getTitleRunners' });
    const r = await fetch(SCRIPT_URL, { method: 'POST', body, redirect: 'follow' });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d?.characters) ? d.characters : [];
  } catch { return []; }
}

// Turns backend error codes into a message the student/teacher can act on.
export function describeApiError(err) {
  const m=String(err?.message||'');
  const map={
    'Email not found in roster':'ไม่พบ email นี้ใน Roster — ให้ครูตรวจว่าใส่ email ถูกบัญชีหรือไม่',
    'Unauthorized':'บัญชีนี้ไม่มีสิทธิ์เข้าห้องนี้',
    'TOKEN_EXPIRED':'การเข้าสู่ระบบหมดอายุ — กด "เปลี่ยน account" แล้วเข้าสู่ระบบใหม่',
    'CONFIG_CLIENT_ID':'ตั้งค่าระบบไม่ครบ (GOOGLE_CLIENT_ID ไม่ตรงกัน) — แจ้งครู',
    'CONFIG_SPREADSHEET':'ตั้งค่าระบบไม่ครบ (เปิด Google Sheet ไม่ได้) — แจ้งครู',
    'ROSTER_SHEET_NOT_FOUND':'ไม่พบแท็บ Roster ใน Google Sheet — แจ้งครู',
    'CONFIG_SCRIPT_PERMISSION':'Apps Script ยังไม่ได้รับสิทธิ์ใหม่ — ครูต้อง Authorize และ Deploy ใหม่',
    'TEST_NOT_FOUND':'ครูเปลี่ยนหรือลบแบบทดสอบนี้แล้ว — กลับไปหน้ากระดานเพื่อดูแบบทดสอบล่าสุด',
    'TEST_CLOSED':'แบบทดสอบของสัปดาห์นี้ปิดแล้ว — คะแนนรอบนี้ไม่ถูกนับ',
  };
  if (map[m]) return map[m];
  if (/^HTTP /.test(m)||/Failed to fetch|NetworkError|JSON/i.test(m)) return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ('+m+')';
  return 'เกิดข้อผิดพลาด: '+m;
}

// Weekly test board for the student's grade: this week's test, Top 10, my rank, my weekly bests
export async function apiGetWeeklyBoard(classCode, studentName) {
  return apiRequest('getWeeklyBoard',{code:classCode,student:studentName});
}

// Top 10 + my rank for an earlier week's test (same grade only)
export async function apiGetWeeklyPast(classCode, studentName, testId) {
  return apiRequest('getWeeklyPast',{code:classCode,student:studentName,testId});
}

// Save one weekly test attempt — returns the updated board (with my new rank)
export async function apiSubmitWeekly(data) {
  return apiRequest('submitWeeklyTest',{
    code:data.classCode,student:data.studentName,testId:data.testId,
    score:data.score,maxScore:data.maxScore,cpm:data.cpm,accuracy:data.accuracy,
    errors:data.errors,chars:data.totalChars,duration:data.duration,
  });
}

// Homework for this student (open + recently passed), with my best stars per item
export async function apiGetHomework(classCode, studentName) {
  return apiRequest('getHomework',{code:classCode,student:studentName});
}

// Save one homework attempt — the server re-checks the stars and returns the updated list
export async function apiSubmitHomework(d) {
  return apiRequest('submitHomework',{
    code:d.classCode,student:d.studentName,hwId:d.hwId,stars:d.stars,
    cpm:d.cpm,accuracy:d.accuracy,errors:d.errors,chars:d.totalChars,duration:d.duration,
  });
}

// Save one finished 1v1 / Battle Royale race (one row per student per race — the
// backend ignores repeats of the same matchId).
export async function apiSaveMatch(m) {
  return apiRequest('saveMatch',{
    code:m.classCode,student:m.studentName,matchId:m.matchId,type:m.type,room:m.room,
    result:m.result,place:m.place||0,players:m.players||0,
    oppName:m.oppName||'',oppClass:m.oppClass||'',myScore:Math.round(m.myScore||0),oppScore:Math.round(m.oppScore||0),
    cpm:m.cpm||0,accuracy:m.accuracy||0,chars:m.chars||0,note:m.note||'',
  });
}

// Fetch student's own session history
export async function apiGetStudentStats(classCode, studentName) {
  return apiRequest('getStudentStats',{code:classCode,student:studentName});
}

// Save one completed practice session to Google Sheets
export async function saveSession(data) {
  return apiRequest('saveSession',{
    code:data.classCode,student:data.studentName,lessonId:data.lessonId,
    exercise:data.exerciseTitle,cpm:data.cpm,wpm:data.wpm,
    accuracy:data.accuracy,errors:data.errors,chars:data.totalChars,duration:data.duration,
    score:data.score||0,
  });
}
