/**
 * Thai Typing App — curriculum progress + teacher unlocks.
 * Add as a THIRD script file in the same Apps Script project (+ → Script → "Progress").
 * Uses helpers from Code.gs (requireStudent, getSheetLoose, getAppSpreadsheet, normalizeEmail, _rosterIndex).
 *
 * Progress: email | classCode | studentName | stars (JSON) | cleared (JSON) | updatedAt
 *   stars   {"101|1.1":3, …}  best ⭐ per curriculum step (never goes down)
 *   cleared {"104":true, …}   lessons cleared with a ⚔️ Rush (⭐⭐⭐ on the last step)
 * Unlocks:  classCode | studentName (blank = whole class) | stage | updatedAt | teacher
 *   Stages 1..stage are fully open for that class / student.
 */
const PROGRESS_HEADERS=['อีเมล','รหัสห้อง','ชื่อนักเรียน','ดาว (JSON)','ผ่านด้วย Rush (JSON)','อัปเดตล่าสุด'];
const UNLOCK_HEADERS=['รหัสห้อง','ชื่อนักเรียน (ว่าง = ทั้งห้อง)','ปลดล็อกถึงด่าน','อัปเดตล่าสุด','ครู'];
const MAX_STAGE=9;

function _progressSheet(create) {
  let sheet=getSheetLoose('Progress');
  if (!sheet && create) {
    sheet=getAppSpreadsheet().insertSheet('Progress');
    sheet.appendRow(PROGRESS_HEADERS);
    sheet.getRange(1,1,1,PROGRESS_HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function _unlockSheet(create) {
  let sheet=getSheetLoose('Unlocks');
  if (!sheet && create) {
    sheet=getAppSpreadsheet().insertSheet('Unlocks');
    sheet.appendRow(UNLOCK_HEADERS);
    sheet.getRange(1,1,1,UNLOCK_HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function _jsonObj(v) {
  try { const o=JSON.parse(String(v||'{}')); return o&&typeof o==='object'&&!Array.isArray(o)?o:{}; }
  catch(e) { return {}; }
}

function _unlockRows() {
  const sheet=_unlockSheet(false);
  if (!sheet||sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues().map((r,i)=>({
    row:i+2, classCode:String(r[0]||'').trim().toUpperCase(), studentName:String(r[1]||'').trim(),
    stage:Number(r[2])||0, updatedAt:r[3] instanceof Date?r[3].toISOString():String(r[3]||''), teacher:String(r[4]||''),
  })).filter(u=>u.classCode);
}

// Highest stage the teacher opened for this student (whole-class rows count too).
function _teacherStage(cc, st) {
  return _unlockRows().reduce((m,u)=>u.classCode===cc&&(!u.studentName||u.studentName===st)?Math.max(m,u.stage):m,0);
}

// Student: called together with getStudentStats (see doPost in Code.gs).
function getProgressFor(params,user) {
  const rec=requireStudent(params,user);
  const cc=String(rec.row[0]||'').trim().toUpperCase(), st=String(rec.row[1]||'').trim();
  const out={stars:{},cleared:{},teacherStage:_teacherStage(cc,st)};
  const sheet=_progressSheet(false);
  if (!sheet||sheet.getLastRow()<2) return out;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues();
  const row=rows.find(r=>normalizeEmail(r[0])===user.email);
  if (row) { out.stars=_jsonObj(row[3]); out.cleared=_jsonObj(row[4]); }
  return out;
}

// Student: one finished step. Stars only ever go up.
function saveProgress(params,user) {
  const rec=requireStudent(params,user);
  const key=String(params.key||'').trim();
  const stars=Number(params.stars);
  const cleared=String(params.cleared||'').trim();
  if (!/^1\d\d\|\d{1,2}\.\d$/.test(key) || !(stars>=0&&stars<=3&&Math.floor(stars)===stars)) throw new Error('Invalid progress');
  if (cleared && !/^1\d\d$/.test(cleared)) throw new Error('Invalid progress');
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet=_progressSheet(true);
    const last=sheet.getLastRow();
    let row=0, s={}, c={};
    if (last>=2) {
      const rows=sheet.getRange(2,1,last-1,5).getValues();
      const i=rows.findIndex(r=>normalizeEmail(r[0])===user.email);
      if (i>=0) { row=i+2; s=_jsonObj(rows[i][3]); c=_jsonObj(rows[i][4]); }
    }
    if (!row) row=last+1;
    s[key]=Math.max(Number(s[key])||0,stars);
    if (cleared) c[cleared]=true;
    sheet.getRange(row,1,1,6).setValues([[user.email,
      String(rec.row[0]||'').trim().toUpperCase(),String(rec.row[1]||'').trim(),
      JSON.stringify(s),JSON.stringify(c),new Date()]]);
  } finally {
    lock.releaseLock();
  }
  return {ok:true};
}

// Teacher: current unlocks + classes/students from the Roster (for the pickers).
function getUnlocks() {
  const roster=_rosterIndex(), classes={};
  Object.values(roster.byKey).forEach(s=>{ (classes[s.classCode]=classes[s.classCode]||[]).push(s.studentName); });
  Object.keys(classes).forEach(k=>classes[k].sort((a,b)=>a.localeCompare(b,'th')));
  return {unlocks:_unlockRows().map(u=>({classCode:u.classCode,studentName:u.studentName,stage:u.stage,updatedAt:u.updatedAt})),classes};
}

// Teacher: open stages 1..stage for a class (studentName blank) or one student. stage 0 = remove.
function setUnlock(params,user) {
  const cc=String(params.classCode||'').trim().toUpperCase();
  const st=String(params.studentName||'').trim();
  const stage=Number(params.stage);
  if (!/^[A-Z0-9]{1,12}$/.test(cc) || !(stage>=0&&stage<=MAX_STAGE&&Math.floor(stage)===stage)) return {error:'Invalid unlock'};
  const roster=_rosterIndex();
  if (!Object.values(roster.byKey).some(s=>s.classCode===cc&&(!st||s.studentName===st))) return {error:'Student not found'};
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing=_unlockRows().find(u=>u.classCode===cc&&u.studentName===st);
    if (stage===0) { if (existing) _unlockSheet(false).deleteRow(existing.row); }
    else {
      const sheet=_unlockSheet(true);
      const row=existing?existing.row:sheet.getLastRow()+1;
      sheet.getRange(row,1,1,5).setValues([[cc,st,stage,new Date(),user&&user.email||'']]);
    }
  } finally {
    lock.releaseLock();
  }
  return getUnlocks();
}
