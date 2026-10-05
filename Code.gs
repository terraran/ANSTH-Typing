/**
 * Thai Typing App — Google Apps Script Backend v3
 * Sheets: Roster | Sessions | WeeklyTests | Submissions
 * Roster:      classCode | studentName | displayName | (unused) | email
 *              Students sign in with Google; the email column links the account to a row.
 * Sessions:    date | classCode | studentName | email | lessonId | exerciseTitle | CPM | WPM | accuracy | errors | chars | duration | score
 * WeeklyTests: testId | grade | weekStart | lessonId | exerciseTitle | showHints | updatedAt | stage
 *              stage 1–7 = the app builds the text from that whole stage (lessonId = the stage's boss
 *              lesson); blank = the old mode (one chosen exercise).
 *              One test per grade level (Y3, Y4 …) per week (Monday–Sunday, script time zone).
 *              Class codes follow Yx0x: Y603 → grade Y6, room Y6.3.
 * Submissions: date | testId | classCode | studentName | email | score | targetScore | KPM | WPM | accuracy | errors | chars | duration
 *              (weekly test attempts — kept separate from practice Sessions; best attempt counts)
 * Progress / Unlocks: see Progress.gs (curriculum stars, Rush clears, teacher stage unlocks)
 * Homework / HomeworkSubmissions: see Homework.gs
 * The old Assignments tab is no longer used and can be deleted.
 */

// Configure these in Apps Script → Project Settings → Script Properties:
// GOOGLE_CLIENT_ID = the public OAuth client ID used by the app
// TEACHER_EMAILS   = comma-separated, verified teacher Google account emails
// SPREADSHEET_ID   = the Google Sheets file ID containing the tabs above
function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

// Errors whose code is safe to show to the client (no secrets inside).
function appError(code, detail) {
  const err=new Error(code);
  err.appCode=code;
  if (detail) console.error(code+': '+detail);
  return err;
}

// Accepts either a bare spreadsheet ID or a full Sheets URL pasted into
// Script Properties (a common setup mistake).
function extractSpreadsheetId(value) {
  const raw=String(value||'').trim();
  const m=raw.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m?m[1]:raw;
}

let _appSpreadsheet=null;
function getAppSpreadsheet() {
  if (_appSpreadsheet) return _appSpreadsheet;
  const id=extractSpreadsheetId(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  if (id) {
    try { _appSpreadsheet=SpreadsheetApp.openById(id); }
    catch (e) { throw appError('CONFIG_SPREADSHEET','openById failed for SPREADSHEET_ID: '+e.message); }
    return _appSpreadsheet;
  }
  const active=SpreadsheetApp.getActiveSpreadsheet();
  if (active) return (_appSpreadsheet=active);
  throw appError('CONFIG_SPREADSHEET','SPREADSHEET_ID is not configured and the script is not bound to a sheet');
}

// Finds a tab by name, ignoring case and stray spaces ("roster ", "ROSTER").
function getSheetLoose(name) {
  const ss=getAppSpreadsheet();
  const exact=ss.getSheetByName(name);
  if (exact) return exact;
  const want=String(name).trim().toLowerCase();
  return ss.getSheets().find(sh=>sh.getName().trim().toLowerCase()===want)||null;
}

function getRosterSheet() {
  const sheet=getSheetLoose('Roster');
  if (!sheet) throw appError('ROSTER_SHEET_NOT_FOUND','No tab named Roster in '+getAppSpreadsheet().getName());
  return sheet;
}

// Lower-cases and strips whitespace, zero-width characters and "mailto:".
function normalizeEmail(value) {
  return String(value||'')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g,'')
    .replace(/^mailto:/i,'')
    .trim().toLowerCase();
}

function getRosterEmailColumn(sheet, rows) {
  const lastColumn=Math.max(1,sheet.getLastColumn());
  const headers=sheet.getRange(1,1,1,lastColumn).getDisplayValues()[0]
    .map(v=>String(v||'').trim().toLowerCase().replace(/[\s_-]/g,''));
  let index=headers.findIndex(v=>v==='email'||v==='อีเมล'||v==='e-mail');
  if (index<0) index=headers.findIndex(v=>v.includes('email')||v.includes('อีเมล'));
  if (index>=0) return index;
  // No usable header: pick the column whose cells most often look like emails.
  const data=rows||sheet.getDataRange().getValues();
  let best=-1, bestCount=0;
  for (let c=0;c<lastColumn;c++) {
    let n=0;
    for (let r=1;r<data.length;r++) if (/@/.test(String(data[r][c]||''))) n++;
    if (n>bestCount) { bestCount=n; best=c; }
  }
  // Keep compatibility with the documented legacy layout where email is E.
  return best>=0?best:4;
}

function doGet() {
  // All application actions require a POST body. This prevents credentials,
  // student identifiers and scores from being placed in request URLs.
  return jsonOutput({error:'POST_REQUIRED'});
}

function doPost(e) {
  let result;
  try {
    const p=parseFormBody(e);
    // Public (no sign-in): character looks for the title screen — no names or emails.
    if (String(p.action||'')==='getTitleRunners') return jsonOutput(getTitleRunners());
    const user=verifyGoogleIdToken(p.idToken);
    const a=String(p.action||'');
    const teacherActions=new Set(['getClasses','getClassData','getWeeklyTests','setWeeklyTest','deleteWeeklyTest','getWeeklyResults','getUnlocks','setUnlock',
      'getHomeworkList','setHomework','deleteHomework','getHomeworkResults']);
    if (teacherActions.has(a) && !isAuthorizedTeacher(user.email)) throw new Error('Unauthorized');
    if      (a==='lookupByEmail')     result = lookupByEmail(user);
    else if (a==='saveSession')       result = saveSession(p,user);
    else if (a==='getStudentStats')   { result = getStudentStatsV2(p,user); result.progress = getProgressFor(p,user); }
    else if (a==='saveProgress')      result = saveProgress(p,user);
    else if (a==='saveMatch')         result = saveMatch(p,user);
    else if (a==='getWeeklyBoard')    result = getWeeklyBoard(p,user);
    else if (a==='getWeeklyPast')     result = getWeeklyPast(p,user);
    else if (a==='submitWeeklyTest')  result = submitWeeklyTest(p,user);
    else if (a==='saveCharacter')     result = saveCharacter(p,user);
    else if (a==='getHomework')       result = getHomework(p,user);
    else if (a==='submitHomework')    result = submitHomework(p,user);
    else if (a==='getHomeworkList')   result = getHomeworkList();
    else if (a==='setHomework')       result = setHomework(p,user);
    else if (a==='deleteHomework')    result = deleteHomework(p);
    else if (a==='getHomeworkResults')result = getHomeworkResults(p);
    else if (a==='getClasses')        result = getClasses();
    else if (a==='getClassData')      result = getClassData(p);
    else if (a==='getWeeklyTests')    result = getWeeklyTests();
    else if (a==='setWeeklyTest')     result = setWeeklyTest(p);
    else if (a==='deleteWeeklyTest')  result = deleteWeeklyTest(p);
    else if (a==='getWeeklyResults')  result = getWeeklyResults(p);
    else if (a==='getUnlocks')        result = getUnlocks();
    else if (a==='setUnlock')         result = setUnlock(p,user);
    else                              result = {error:'Unknown action'};
  } catch(err) {
    console.error(err);
    if (err.appCode) result={error:err.appCode};
    else if (err.message==='Unauthorized') result={error:'Unauthorized'};
    else if (/permission|authoriz|สิทธิ์/i.test(String(err.message))) result={error:'CONFIG_SCRIPT_PERMISSION'};
    else result={error:'Request rejected'};
  }
  return jsonOutput(result);
}

function parseFormBody(e) {
  const type=String(e?.postData?.type||'').toLowerCase();
  if (!type.startsWith('application/x-www-form-urlencoded')) throw new Error('POST_REQUIRED');
  const out=Object.create(null);
  String(e.postData.contents||'').split('&').forEach(part=>{
    if (!part) return;
    const i=part.indexOf('=');
    const key=decodeURIComponent((i<0?part:part.slice(0,i)).replace(/\+/g,' '));
    const value=decodeURIComponent((i<0?'':part.slice(i+1)).replace(/\+/g,' '));
    if (!(key in out)) out[key]=value;
  });
  return out;
}

function verifyGoogleIdToken(idToken) {
  const token=String(idToken||'');
  const clientId=PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (!clientId) throw appError('CONFIG_CLIENT_ID','Script property GOOGLE_CLIENT_ID is missing');
  if (!token) throw appError('Unauthorized','Request had no idToken');
  const response=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token),{muteHttpExceptions:true});
  if (response.getResponseCode()!==200) throw appError('TOKEN_EXPIRED','tokeninfo HTTP '+response.getResponseCode());
  const claims=JSON.parse(response.getContentText());
  const now=Math.floor(Date.now()/1000);
  if (String(claims.aud).trim()!==String(clientId).trim()) throw appError('CONFIG_CLIENT_ID','Token aud '+claims.aud+' does not match GOOGLE_CLIENT_ID');
  if (String(claims.email_verified)!=='true' || !claims.email) throw appError('Unauthorized','Email missing or unverified');
  if (Number(claims.exp)<=now) throw appError('TOKEN_EXPIRED','Token expired');
  return {email:normalizeEmail(claims.email),name:String(claims.name||'').trim()};
}

function isAuthorizedTeacher(email) {
  const list=PropertiesService.getScriptProperties().getProperty('TEACHER_EMAILS')||'';
  return list.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean).includes(String(email||'').toLowerCase());
}

function requireStudent(params,user) {
  const cc=String(params.code||params.classCode||'').trim().toUpperCase();
  const st=String(params.student||params.studentName||'').trim();
  const sheet=getRosterSheet();
  const rows=sheet.getDataRange().getValues();
  const emailColumn=getRosterEmailColumn(sheet,rows);
  const row=rows.find((r,i)=>i>0&&String(r[0]||'').trim().toUpperCase()===cc&&String(r[1]||'').trim()===st&&normalizeEmail(r[emailColumn])===user.email);
  if (!row) throw new Error('Unauthorized');
  return {sheet,rows,rowIndex:rows.indexOf(row)+1,row};
}

// ── ROSTER ─────────────────────────────────────────────────────
function lookupByEmail(user) {
  const email = user.email;
  const sheet = getRosterSheet();
  const rows = sheet.getDataRange().getValues();
  const emailColumn=getRosterEmailColumn(sheet,rows);
  let found = null;
  for (let i=1;i<rows.length;i++) {
    if (normalizeEmail(rows[i][emailColumn])===email) {
      found = {classCode:String(rows[i][0]).trim().toUpperCase(),
               studentName:String(rows[i][1]).trim(),
               displayName:String(rows[i][2]||rows[i][1]).trim()};
      break;
    }
  }
  console.log(JSON.stringify({
    action:'lookupByEmail',spreadsheet:sheet.getParent().getName(),sheet:sheet.getName(),
    rosterRows:Math.max(0,rows.length-1),emailColumn:emailColumn+1,
    emailHeader:String(rows[0]?.[emailColumn]||''),matched:!!found,
    // Masked so the log helps debugging without exposing full addresses.
    lookedFor:email.replace(/^(.{2}).*(@.*)$/,'$1***$2')
  }));
  if (!found) return {error:'Email not found in roster'};
  found.character = _getCharacter(email);
  return found;
}

// ── SESSIONS ───────────────────────────────────────────────────
// lessonId: old lessons 1–13, new curriculum 101–134 (limit 200 leaves room to grow).
function saveSession(params,user) {
  const rec=requireStudent(params,user);
  const lessonId=Number(params.lessonId), cpm=Number(params.cpm), accuracy=Number(params.accuracy);
  const errors=Number(params.errors), chars=Number(params.chars), duration=Number(params.duration);
  const score=Number(params.score||0);
  if (!Number.isFinite(score) || score<0 || score>chars*750+1) throw new Error('Invalid session data');
  if (![lessonId,cpm,accuracy,errors,chars,duration].every(Number.isFinite) || lessonId<0 || lessonId>200 || cpm<0 || cpm>3000 || accuracy<0 || accuracy>100 || errors<0 || errors>10000 || chars<0 || chars>20000 || duration<0 || duration>86400) throw new Error('Invalid session data');
  const sheet=getSheetLoose('Sessions');
  if (!sheet) return {error:'Sessions sheet not found'};
  if (sheet.getLastRow()===0) {
    sheet.appendRow(['วันที่เวลา','รหัสห้อง','ชื่อนักเรียน','อีเมล','บทที่','แบบฝึก','CPM','WPM','ความแม่น %','จำนวนผิด','ตัวอักษร','เวลา (วินาที)','คะแนน']);
    sheet.getRange(1,1,1,13).setFontWeight('bold');
  } else if (!String(sheet.getRange(1,13).getValue()||'').trim()) {
    sheet.getRange(1,13).setValue('คะแนน').setFontWeight('bold');
  }
  sheet.appendRow([new Date(),
    String(params.code||'').trim().toUpperCase(),
    String(rec.row[1]||'').trim(),
    user.email,
    lessonId,
    String(params.exercise||'').trim().slice(0,120),
    cpm,Math.round(cpm/5),accuracy,errors,chars,duration,Math.round(score)]);
  return {ok:true};
}

function getStudentStats(params,user) {
  const rec=requireStudent(params,user);
  const cc=String(params.code||'').trim().toUpperCase();
  const st=String(rec.row[1]||'').trim();
  if (!cc||!st) return {sessions:[],avgCpm:0,avgAcc:0,bestCpm:0,totalSessions:0};
  const sheet=getSheetLoose('Sessions');
  if (!sheet||sheet.getLastRow()<2) return {sessions:[],avgCpm:0,avgAcc:0,bestCpm:0,totalSessions:0};
  const rows=sheet.getDataRange().getValues().slice(1);
  const mine=rows.filter(r=>String(r[1]||'').trim().toUpperCase()===cc&&String(r[2]||'').trim()===st);
  if (!mine.length) return {sessions:[],highScores:{},avgCpm:0,avgAcc:0,bestCpm:0,totalSessions:0};
  const sessions=mine.map(r=>({
    date:r[0] instanceof Date?r[0].toISOString():String(r[0]),
    lessonId:Number(r[4])||0,exercise:String(r[5]||''),
    cpm:Number(r[6])||0,wpm:Number(r[7])||0,accuracy:Number(r[8])||0,
    errors:Number(r[9])||0,chars:Number(r[10])||0,duration:Number(r[11])||0,
    score:Number(r[12])||0,
  })).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const n=sessions.length;
  // Practice high score per exercise ("lessonId|1.1" → best score)
  const highScores={};
  mine.forEach(r=>{
    const k=exerciseKey(r[4],r[5]), sc=Number(r[12])||0;
    if (sc>(highScores[k]||0)) highScores[k]=sc;
  });
  return {sessions,highScores,avgCpm:Math.round(sessions.reduce((s,r)=>s+r.cpm,0)/n),
    avgAcc:Math.round(sessions.reduce((s,r)=>s+r.accuracy,0)/n),
    bestCpm:Math.max(...sessions.map(r=>r.cpm)),totalSessions:n};
}

// Exercises are identified by lesson ID + their number prefix ("1.1", "5.3"),
// so renaming an exercise does not break older rows.
function exerciseKey(lessonId, title) {
  const t=String(title||'').trim();
  const m=t.match(/^(\d+\.\d+)/);
  return (Number(lessonId)||0)+'|'+(m?m[1]:t);
}

function toTime(value) {
  if (value instanceof Date) return value.getTime();
  const t=new Date(value).getTime();
  return isNaN(t)?0:t;
}

// Blank showHints means hints are shown.
function _showHints(v) { return !(v===false || String(v).trim().toUpperCase()==='FALSE'); }

// ── WEEKLY TESTS: dates, grades, ids ───────────────────────────
const TEST_MAX_SECS    = 130;           // 2-minute test + slack for network delay
const BOARD_CACHE_SECS = 30;            // leaderboard is computed at most once per 30 s
const SUBMIT_GRACE_MS  = 5*60*1000;     // a test started late on Sunday can still be sent

function tz() { return Session.getScriptTimeZone(); }

// "2026-09-28" + n days → "yyyy-MM-dd" (calendar arithmetic, no time-zone drift)
function addDays(ymd, n) {
  const p=String(ymd).split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(p[0],p[1]-1,p[2]+n)),'UTC','yyyy-MM-dd');
}
function ymdOf(value) {
  if (value instanceof Date) return Utilities.formatDate(value,tz(),'yyyy-MM-dd');
  const m=String(value||'').match(/^\d{4}-\d{2}-\d{2}/);
  return m?m[0]:'';
}
// Monday of the week containing a Date or "yyyy-MM-dd", in the script time zone.
function mondayOf(value) {
  const d=value instanceof Date?value:Utilities.parseDate(String(value)+' 12:00:00',tz(),'yyyy-MM-dd HH:mm:ss');
  const dow=Number(Utilities.formatDate(d,tz(),'u')); // 1 = Monday … 7 = Sunday
  return addDays(Utilities.formatDate(d,tz(),'yyyy-MM-dd'),1-dow);
}
// Midnight at the start of "yyyy-MM-dd" in the script time zone, in ms.
function dayStartMs(ymd) {
  return Utilities.parseDate(ymd+' 00:00:00',tz(),'yyyy-MM-dd HH:mm:ss').getTime();
}
// "Y603" → {grade:"Y6", room:"Y6.3"}; "Y610" → room "Y6.10"; anything else → null.
function parseClass(code) {
  const m=String(code||'').trim().toUpperCase().match(/^Y(\d)(\d{2})$/);
  return m?{grade:'Y'+m[1],room:'Y'+m[1]+'.'+Number(m[2])}:null;
}
function exerciseNum(title) {
  const m=String(title||'').trim().match(/^(\d+\.\d+)/);
  return m?m[1]:'';
}
// The ID also seeds the test text, so it changes when the exercise changes.
// Changing only the hints setting keeps the same ID and the same board.
function makeTestId(grade, weekStart, lessonId, title, stage) {
  if (stage) return grade+'-'+weekStart+'-s'+Number(stage);
  return grade+'-'+weekStart+'-'+Number(lessonId)+'-'+(exerciseNum(title)||'x');
}
const WEEKLY_HEADERS=['testId','grade','weekStart','lessonId','exerciseTitle','showHints','updatedAt','stage'];
const MAX_TEST_STAGE=7;   // stage 8 (numbers/marks) and 9 (long passages) are not used for weekly tests

function _weeklySheet(create) {
  let sheet=getSheetLoose('WeeklyTests');
  if (!sheet && create) {
    sheet=getAppSpreadsheet().insertSheet('WeeklyTests');
    sheet.appendRow(WEEKLY_HEADERS);
    sheet.getRange(1,1,1,WEEKLY_HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.getRange('C:C').setNumberFormat('@');
  }
  return sheet;
}

function _readWeeklyTests() {
  const sheet=_weeklySheet(false);
  if (!sheet||sheet.getLastRow()<2) return [];
  return sheet.getDataRange().getValues().slice(1).map((r,i)=>({
    row:i+2,
    testId:String(r[0]||'').trim(),
    grade:String(r[1]||'').trim().toUpperCase(),
    weekStart:ymdOf(r[2]),
    lessonId:Number(r[3])||0,
    exerciseTitle:String(r[4]||'').trim(),
    showHints:_showHints(r[5]),
    stage:Number(r[7])||0,
  })).filter(t=>t.testId&&t.grade&&t.weekStart);
}

function _publicTest(t) {
  return t?{testId:t.testId,grade:t.grade,weekStart:t.weekStart,lessonId:t.lessonId,
    exerciseTitle:t.exerciseTitle,showHints:t.showHints,stage:t.stage||0}:null;
}

function _submissionsSheet() {
  let sheet=getSheetLoose('Submissions');
  if (!sheet) {
    sheet=getAppSpreadsheet().insertSheet('Submissions');
    sheet.appendRow(['วันที่เวลา','testId','รหัสห้อง','ชื่อนักเรียน','อีเมล','คะแนน','คะแนนเป้าหมาย','KPM','WPM','ความแม่น %','จำนวนผิด','ตัวอักษร','เวลา (วินาที)']);
    sheet.getRange(1,1,1,13).setFontWeight('bold');
  }
  return sheet;
}

function _submissionRows() {
  const sheet=getSheetLoose('Submissions');
  if (!sheet||sheet.getLastRow()<2) return [];
  return sheet.getDataRange().getValues().slice(1);
}

// classCode|studentName → {displayName, room, grade}, plus students grouped by grade.
function _rosterIndex() {
  const rows=getRosterSheet().getDataRange().getValues();
  const byKey={}, byGrade={};
  rows.slice(1).forEach(r=>{
    const cc=String(r[0]||'').trim().toUpperCase(), st=String(r[1]||'').trim();
    if (!cc||!st) return;
    const pc=parseClass(cc);
    const info={key:cc+'|'+st,classCode:cc,studentName:st,
      displayName:String(r[2]||r[1]).trim(),room:pc?pc.room:cc,grade:pc?pc.grade:''};
    byKey[info.key]=info;
    if (pc) (byGrade[pc.grade]=byGrade[pc.grade]||[]).push(info);
  });
  return {byKey,byGrade};
}

// One entry per student for a test: best attempt and attempt count.
// Ranking: higher score → higher accuracy → earlier attempt.
function _better(sc, acc, at, e) {
  return sc>e.score || (sc===e.score && (acc>e.acc || (acc===e.acc && at<e.at)));
}
function _bestByStudent(rows, testId) {
  const map={};
  rows.forEach(r=>{
    if (String(r[1]||'').trim()!==testId) return;
    const cc=String(r[2]||'').trim().toUpperCase(), st=String(r[3]||'').trim();
    if (!cc||!st) return;
    const k=cc+'|'+st, sc=Number(r[5])||0, acc=Number(r[9])||0, at=toTime(r[0]);
    const e=map[k]||(map[k]={key:k,classCode:cc,studentName:st,attempts:0,score:-1,acc:-1,at:0,lastAt:0,row:null});
    e.attempts++;
    e.lastAt=Math.max(e.lastAt,at);
    if (_better(sc,acc,at,e)) { e.score=sc; e.acc=acc; e.at=at; e.row=r; }
  });
  return Object.values(map).sort((a,b)=>b.score-a.score||b.acc-a.acc||a.at-b.at);
}

// Full ranking for one test, cached so many students opening the board at once
// only cost one sheet read.
function _rankedBoard(testId) {
  const cache=CacheService.getScriptCache(), ck='wlb:'+testId;
  const hit=cache.get(ck);
  if (hit) { try { return JSON.parse(hit); } catch(e) {} }
  const roster=_rosterIndex();
  const ranked=_bestByStudent(_submissionRows(),testId).map((e,i)=>{
    const info=roster.byKey[e.key];
    const pc=parseClass(e.classCode);
    return {k:e.key,rank:i+1,name:info?info.displayName:e.studentName,
      room:info?info.room:(pc?pc.room:e.classCode),
      score:e.score,max:Number(e.row[6])||0,acc:e.acc,attempts:e.attempts};
  });
  try { cache.put(ck,JSON.stringify(ranked),BOARD_CACHE_SECS); } catch(e) {}
  return ranked;
}
function _clearBoardCache(testId) {
  try { CacheService.getScriptCache().remove('wlb:'+testId); } catch(e) {}
}

// What a student sees: this week's test, Top 10, own rank, own best per week.
function _buildBoard(rec) {
  const cc=String(rec.row[0]||'').trim().toUpperCase();
  const st=String(rec.row[1]||'').trim();
  const pc=parseClass(cc);
  const week=mondayOf(new Date());
  const out={grade:pc?pc.grade:null,room:pc?pc.room:cc,weekStart:week,
    weekEndsAt:dayStartMs(addDays(week,7)),test:null,top:[],me:null,total:0,history:[]};
  if (!pc) return out;
  const tests=_readWeeklyTests().filter(t=>t.grade===pc.grade);
  const cur=tests.find(t=>t.weekStart===week)||null;
  out.test=_publicTest(cur);
  const myKey=cc+'|'+st;
  if (cur) Object.assign(out,_topAndMe(cur.testId,myKey));
  // Earlier weeks of this grade (newest first) — students can open their Top 10.
  out.past=tests.filter(t=>t.weekStart<week).sort((a,b)=>a.weekStart<b.weekStart?1:-1).slice(0,20)
    .map(t=>({testId:t.testId,weekStart:t.weekStart,exerciseTitle:t.exerciseTitle}));
  // Best score for each week this student took a test (newest first).
  const byId={};
  tests.forEach(t=>byId[t.testId]=t);
  const best={};
  _submissionRows().forEach(r=>{
    const id=String(r[1]||'').trim(), t=byId[id];
    if (!t||String(r[2]||'').trim().toUpperCase()!==cc||String(r[3]||'').trim()!==st) return;
    const sc=Number(r[5])||0;
    if (!best[id]||sc>best[id].score) best[id]={weekStart:t.weekStart,exerciseTitle:t.exerciseTitle,score:sc,max:Number(r[6])||0};
  });
  out.history=Object.values(best).sort((a,b)=>a.weekStart<b.weekStart?1:-1).slice(0,12);
  return out;
}

// Top 10, my rank and the number of students for one test.
function _topAndMe(testId, myKey) {
  const ranked=_rankedBoard(testId);
  const out={total:ranked.length,me:null,
    top:ranked.slice(0,10).map(e=>({rank:e.rank,name:e.name,room:e.room,score:e.score,max:e.max,me:e.k===myKey}))};
  const mine=ranked.find(e=>e.k===myKey);
  if (mine) out.me={rank:mine.rank,name:mine.name,room:mine.room,score:mine.score,max:mine.max,attempts:mine.attempts};
  return out;
}

// ── WEEKLY TESTS: student actions ──────────────────────────────
function getWeeklyBoard(params,user) {
  return _buildBoard(requireStudent(params,user));
}

// An earlier week's board for the student's own grade (read-only).
function getWeeklyPast(params,user) {
  const rec=requireStudent(params,user);
  const cc=String(rec.row[0]||'').trim().toUpperCase();
  const st=String(rec.row[1]||'').trim();
  const pc=parseClass(cc);
  const id=String(params.testId||'').trim();
  const t=pc&&_readWeeklyTests().find(x=>x.testId===id&&x.grade===pc.grade&&x.weekStart<mondayOf(new Date()));
  if (!t) return {error:'TEST_NOT_FOUND'};
  return Object.assign({test:_publicTest(t)},_topAndMe(t.testId,cc+'|'+st));
}

function submitWeeklyTest(params,user) {
  const rec=requireStudent(params,user);
  const cc=String(rec.row[0]||'').trim().toUpperCase();
  const st=String(rec.row[1]||'').trim();
  const pc=parseClass(cc);
  const id=String(params.testId||'').trim();
  const t=pc&&_readWeeklyTests().find(x=>x.testId===id&&x.grade===pc.grade);
  if (!t) return {error:'TEST_NOT_FOUND'};
  const now=Date.now();
  if (now<dayStartMs(t.weekStart)||now>dayStartMs(addDays(t.weekStart,7))+SUBMIT_GRACE_MS) return {error:'TEST_CLOSED'};
  const n=k=>Number(params[k]);
  const score=n('score'),maxScore=n('maxScore'),cpm=n('cpm'),accuracy=n('accuracy');
  const errors=n('errors'),chars=n('chars'),duration=n('duration');
  if (![score,maxScore,cpm,accuracy,errors,chars,duration].every(Number.isFinite) ||
      maxScore<=0 || maxScore>15000000 || score<0 || score>chars*750+1 ||
      cpm<0||cpm>3000||accuracy<0||accuracy>100||errors<0||errors>10000||
      chars<0||chars>20000||duration<0||duration>TEST_MAX_SECS) throw new Error('Invalid test data');
  _submissionsSheet().appendRow([new Date(),id,cc,st,user.email,
    Math.round(score),Math.round(maxScore),cpm,Math.round(cpm/5),accuracy,errors,chars,duration]);
  _clearBoardCache(id);
  const board=_buildBoard(rec);
  board.ok=true;
  return board;
}

// ── WEEKLY TESTS: teacher actions ──────────────────────────────
function getWeeklyTests() {
  const roster=_rosterIndex();
  const done={};
  _submissionRows().forEach(r=>{
    const id=String(r[1]||'').trim();
    const k=String(r[2]||'').trim().toUpperCase()+'|'+String(r[3]||'').trim();
    (done[id]=done[id]||{})[k]=1;
  });
  const tests=_readWeeklyTests().map(t=>Object.assign(_publicTest(t),{
    done:Object.keys(done[t.testId]||{}).length,
    total:(roster.byGrade[t.grade]||[]).length,
  })).sort((a,b)=>a.weekStart<b.weekStart?1:a.weekStart>b.weekStart?-1:a.grade.localeCompare(b.grade));
  const grades=Object.keys(roster.byGrade).sort().map(g=>({grade:g,students:roster.byGrade[g].length}));
  return {tests,grades,currentWeek:mondayOf(new Date())};
}

// One test per grade per week: setting it again for the same week replaces it.
function setWeeklyTest(params) {
  const grade=String(params.grade||'').trim().toUpperCase();
  if (!/^Y\d$/.test(grade)) return {error:'Invalid grade'};
  const ws=String(params.weekStart||'').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ws)) return {error:'Invalid week'};
  const week=mondayOf(ws);
  const lid=Number(params.lessonId);
  const title=String(params.exerciseTitle||'').trim().slice(0,120);
  const stage=Number(params.stage||0);
  if (!(lid>=1&&lid<=200)||!title) return {error:'Missing required fields'};
  if (!(stage>=0&&stage<=MAX_TEST_STAGE&&Math.floor(stage)===stage)) return {error:'Invalid stage'};
  const hints=String(params.showHints??'1')!=='0';
  const id=makeTestId(grade,week,lid,title,stage);
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet=_weeklySheet(true);
    const existing=_readWeeklyTests().find(t=>t.grade===grade&&t.weekStart===week);
    const row=existing?existing.row:sheet.getLastRow()+1;
    if (row>sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
    if (!String(sheet.getRange(1,8).getValue()||'').trim()) sheet.getRange(1,8).setValue('stage').setFontWeight('bold');
    sheet.getRange(row,1,1,8).setNumberFormats([['@','@','@','0','@','@','yyyy-mm-dd hh:mm','0']]);
    sheet.getRange(row,1,1,8).setValues([[id,grade,week,lid,title,hints,new Date(),stage||'']]);
    if (existing) _clearBoardCache(existing.testId);
  } finally {
    lock.releaseLock();
  }
  _clearBoardCache(id);
  return {ok:true,testId:id,weekStart:week};
}

function deleteWeeklyTest(params) {
  const id=String(params.testId||'').trim();
  if (!id) return {error:'Missing testId'};
  const t=_readWeeklyTests().find(x=>x.testId===id);
  if (!t) return {error:'TEST_NOT_FOUND'};
  _weeklySheet(false).deleteRow(t.row);
  _clearBoardCache(id);
  return {ok:true};
}

// Full grade ranking for one test + students who have not taken it, by room.
function getWeeklyResults(params) {
  const id=String(params.testId||'').trim();
  const t=_readWeeklyTests().find(x=>x.testId===id);
  if (!t) return {error:'TEST_NOT_FOUND'};
  const roster=_rosterIndex();
  const best=_bestByStudent(_submissionRows(),id);
  const ranking=best.map((e,i)=>{
    const info=roster.byKey[e.key], r=e.row, pc=parseClass(e.classCode);
    return {rank:i+1,name:e.studentName,displayName:info?info.displayName:e.studentName,
      room:info?info.room:(pc?pc.room:e.classCode),score:e.score,max:Number(r[6])||0,
      kpm:Number(r[7])||0,wpm:Number(r[8])||0,accuracy:Number(r[9])||0,
      attempts:e.attempts,lastAt:new Date(e.lastAt).toISOString()};
  });
  const doneKeys=new Set(best.map(e=>e.key));
  const notDone={};
  (roster.byGrade[t.grade]||[]).forEach(s=>{
    if (!doneKeys.has(s.key)) (notDone[s.room]=notDone[s.room]||[]).push(s.studentName);
  });
  return {
    test:_publicTest(t),ranking,
    notDone:Object.keys(notDone).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
      .map(room=>({room,names:notDone[room]})),
    total:(roster.byGrade[t.grade]||[]).length,
  };
}

// ── TEACHER DASHBOARD ──────────────────────────────────────────
function getClasses() {
  const sheet=getSheetLoose('Sessions');
  if (!sheet||sheet.getLastRow()<2) return {classes:[]};
  const rows=sheet.getDataRange().getValues().slice(1);
  const codes=[...new Set(rows.map(r=>String(r[1]||'').trim()).filter(c=>c))].sort();
  return {classes:codes};
}

function getClassData(params) {
  const cc=String(params.classCode||'').trim().toUpperCase();
  if (!cc) return {error:'Missing classCode'};
  const sheet=getSheetLoose('Sessions');
  if (!sheet||sheet.getLastRow()<2) return {students:[]};
  const rows=sheet.getDataRange().getValues().slice(1);
  const map={};
  rows.filter(r=>String(r[1]||'').trim().toUpperCase()===cc).forEach(r=>{
    const name=String(r[2]||'').trim();
    if (!name) return;
    if (!map[name]) map[name]=[];
    map[name].push({
      date:r[0] instanceof Date?r[0].toISOString():String(r[0]),
      lessonId:Number(r[4])||0,exercise:String(r[5]||''),
      cpm:Number(r[6])||0,wpm:Number(r[7])||0,accuracy:Number(r[8])||0,
      errors:Number(r[9])||0,chars:Number(r[10])||0,duration:Number(r[11])||0,
    });
  });
  const students=Object.entries(map).map(([name,sessions])=>{
    const sorted=sessions.sort((a,b)=>new Date(b.date)-new Date(a.date));
    const n=sorted.length;
    return {name,avgCpm:Math.round(sorted.reduce((s,r)=>s+r.cpm,0)/n),
      avgAcc:Math.round(sorted.reduce((s,r)=>s+r.accuracy,0)/n),
      bestCpm:Math.max(...sorted.map(r=>r.cpm)),
      totalSessions:n,lastActive:sorted[0].date,sessions:sorted};
  });
  students.sort((a,b)=>a.name.localeCompare(b.name,'th'));
  return {students};
}

// ── DIAGNOSTICS (run manually from the Apps Script editor) ─────
// Select diagnoseSetup in the toolbar → Run → View → Logs / Execution log.
function diagnoseSetup() {
  const props=PropertiesService.getScriptProperties().getProperties();
  const report=[];
  const has=k=>props[k]&&String(props[k]).trim()?'✅ set':'❌ MISSING';
  report.push('GOOGLE_CLIENT_ID : '+has('GOOGLE_CLIENT_ID')+(props.GOOGLE_CLIENT_ID?' ('+String(props.GOOGLE_CLIENT_ID).trim().slice(0,14)+'…)':''));
  report.push('SPREADSHEET_ID   : '+has('SPREADSHEET_ID')+(props.SPREADSHEET_ID&&/\/d\//.test(props.SPREADSHEET_ID)?' (full URL detected — ID extracted automatically)':''));
  report.push('TEACHER_EMAILS   : '+has('TEACHER_EMAILS'));
  report.push('Time zone        : '+tz()+' · this week starts '+mondayOf(new Date()));
  let ss;
  try { ss=getAppSpreadsheet(); report.push('Spreadsheet      : ✅ "'+ss.getName()+'"'); }
  catch(e) { report.push('Spreadsheet      : ❌ cannot open — check SPREADSHEET_ID'); console.log(report.join('\n')); return; }
  report.push('Tabs             : '+ss.getSheets().map(s=>'"'+s.getName()+'"').join(', '));
  const roster=getSheetLoose('Roster');
  if (!roster) { report.push('Roster tab       : ❌ NOT FOUND'); console.log(report.join('\n')); return; }
  const rows=roster.getDataRange().getValues();
  const col=getRosterEmailColumn(roster,rows);
  const emails=rows.slice(1).map(r=>normalizeEmail(r[col])).filter(Boolean);
  report.push('Roster tab       : ✅ "'+roster.getName()+'" — '+(rows.length-1)+' rows');
  report.push('Header row       : '+JSON.stringify(rows[0]));
  report.push('Email column     : '+String.fromCharCode(65+col)+' (header "'+rows[0][col]+'") — '+emails.length+' emails, '+emails.filter(e=>!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)).length+' look invalid');
  report.push('Sample email     : '+(emails[0]||'(none)'));
  const idx=_rosterIndex();
  const odd=[...new Set(rows.slice(1).map(r=>String(r[0]||'').trim().toUpperCase()).filter(c=>c&&!parseClass(c)))];
  report.push('Grade levels     : '+(Object.keys(idx.byGrade).sort().map(g=>g+' ('+idx.byGrade[g].length+')').join(', ')||'(none)'));
  if (odd.length) report.push('Not Yx0x (no weekly test): '+odd.join(', '));
  report.push('WeeklyTests tab  : '+(getSheetLoose('WeeklyTests')?'✅ '+_readWeeklyTests().length+' tests':'— created on first "set weekly test"'));
  report.push('Progress.gs      : '+(typeof getProgressFor==='function'?'✅ installed':'❌ MISSING — add the Progress script file'));
  report.push('Homework.gs      : '+(typeof getHomework==='function'?'✅ installed':'❌ MISSING — add the Homework script file'));
  console.log(report.join('\n'));
}

// Edit the address below, then Run → testLookup to see exactly what a
// student with that Google account would get back.
function testLookup() {
  const email='student@example.com';
  console.log(JSON.stringify(lookupByEmail({email:normalizeEmail(email),name:''}),null,2));
}

// ── CHARACTERS ─────────────────────────────────────────────────
// Characters: email | classCode | studentName | character (JSON) | updatedAt
const CHAR_KEYS=['body','hair','hairColor','skin','socks','shoes'];

function _charSheet(create) {
  let sheet=getSheetLoose('Characters');
  if (!sheet && create) {
    sheet=getAppSpreadsheet().insertSheet('Characters');
    sheet.appendRow(['อีเมล','รหัสห้อง','ชื่อนักเรียน','ตัวละคร (JSON)','อัปเดตล่าสุด']);
    sheet.getRange(1,1,1,5).setFontWeight('bold');
  }
  return sheet;
}

// Only short lowercase ids are accepted; the app checks the ids against its own lists.
function _cleanCharacter(raw) {
  let c;
  try { c=JSON.parse(String(raw||'')); } catch(e) { return null; }
  if (!c || typeof c!=='object' || Array.isArray(c)) return null;
  const out={};
  for (const k of CHAR_KEYS) {
    const v=String(c[k]||'');
    if (!/^[a-z0-9_]{1,24}$/.test(v)) return null;
    out[k]=v;
  }
  return out;
}

function _getCharacter(email) {
  const sheet=_charSheet(false);
  if (!sheet || sheet.getLastRow()<2) return null;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,4).getValues();
  const row=rows.find(r=>normalizeEmail(r[0])===email);
  return row?_cleanCharacter(row[3]):null;
}

// Title screen runners: up to 12 random saved characters (look only — body, hair,
// colours; never who they belong to). The cleaned list is cached for 10 minutes so a
// whole class opening the page at once costs one sheet read.
const TITLE_RUNNERS=12;
function getTitleRunners() {
  const cache=CacheService.getScriptCache(), ck='titleRunners';
  let all=null;
  const hit=cache.get(ck);
  if (hit) { try { all=JSON.parse(hit); } catch(e) {} }
  if (!all) {
    all=[];
    const sheet=_charSheet(false);
    if (sheet && sheet.getLastRow()>=2) {
      const seen={};
      sheet.getRange(2,4,sheet.getLastRow()-1,1).getValues().forEach(r=>{
        const c=_cleanCharacter(r[0]);
        if (!c) return;
        const k=CHAR_KEYS.map(x=>c[x]).join('|');
        if (!seen[k]) { seen[k]=1; all.push(c); }
      });
    }
    all=all.slice(0,300);
    try { cache.put(ck,JSON.stringify(all),600); } catch(e) {}
  }
  for (let i=all.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); const t=all[i]; all[i]=all[j]; all[j]=t; }
  return {characters:all.slice(0,TITLE_RUNNERS)};
}

// One row per student (keyed by Google email); saving again updates that row.
function saveCharacter(params,user) {
  const rec=requireStudent(params,user);
  const c=_cleanCharacter(params.character);
  if (!c) throw new Error('Invalid character');
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet=_charSheet(true);
    const last=sheet.getLastRow();
    let row=0;
    if (last>=2) {
      const emails=sheet.getRange(2,1,last-1,1).getValues();
      const i=emails.findIndex(r=>normalizeEmail(r[0])===user.email);
      if (i>=0) row=i+2;
    }
    if (!row) row=last+1;
    sheet.getRange(row,1,1,5).setValues([[user.email,
      String(rec.row[0]||'').trim().toUpperCase(),String(rec.row[1]||'').trim(),
      JSON.stringify(c),new Date()]]);
  } finally {
    lock.releaseLock();
  }
  return {ok:true,character:c};
}
