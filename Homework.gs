/**
 * Thai Typing App — homework (การบ้าน).
 * Add as a FOURTH script file in the same Apps Script project (+ → Script → "Homework").
 * Uses helpers from Code.gs (requireStudent, getSheetLoose, getAppSpreadsheet, normalizeEmail,
 * _rosterIndex, parseClass, addDays, dayStartMs, ymdOf, toTime, tz).
 *
 * Homework: hwId | classCode | studentName (blank = whole class) | mode | stage | lessonId |
 *           exerciseTitle | title | minStars | dueDate | createdAt | teacher
 *   mode "stage"    → the app builds the text from that stage (like the weekly test)
 *   mode "exercise" → the app uses that curriculum step's text generator
 *   Always timed 1 min 30 s. Text seed = hwId, so the whole class gets the same text.
 * HomeworkSubmissions: date | hwId | classCode | studentName | email | stars | KPM | WPM |
 *           accuracy | errors | chars | duration | late
 *   Stars are re-checked here from KPM + accuracy (same rule as the lessons).
 *   Passed = any attempt with stars ≥ minStars. Late = first pass after the due date.
 */
const HW_HEADERS=['hwId','รหัสห้อง','ชื่อนักเรียน (ว่าง = ทั้งห้อง)','รูปแบบ','ด่าน','lessonId',
  'แบบฝึก','ชื่อการบ้าน','ดาวขั้นต่ำ','วันส่ง','สร้างเมื่อ','ครู'];
const HWS_HEADERS=['วันที่เวลา','hwId','รหัสห้อง','ชื่อนักเรียน','อีเมล','ดาว','KPM','WPM',
  'ความแม่น %','จำนวนผิด','ตัวอักษร','เวลา (วินาที)','ส่งช้า'];
const HW_SECS=90;
const HW_MAX_SECS=100;                       // 1 min 30 s + slack for network delay
const STAGE_TARGETS=[5,5,8,8,10,8,8,8,12];   // Thai words/min for ⭐⭐ — same as src/data/stages.js
const NET_STAGE=9;                           // stage 9 counts net words

function _hwSheet(create) {
  let sheet=getSheetLoose('Homework');
  if (!sheet && create) {
    sheet=getAppSpreadsheet().insertSheet('Homework');
    sheet.appendRow(HW_HEADERS);
    sheet.getRange(1,1,1,HW_HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('@');
    sheet.getRange('J:J').setNumberFormat('@');
  }
  return sheet;
}

function _hwSubSheet() {
  let sheet=getSheetLoose('HomeworkSubmissions');
  if (!sheet) {
    sheet=getAppSpreadsheet().insertSheet('HomeworkSubmissions');
    sheet.appendRow(HWS_HEADERS);
    sheet.getRange(1,1,1,HWS_HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function _readHomework() {
  const sheet=_hwSheet(false);
  if (!sheet||sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,HW_HEADERS.length).getValues().map((r,i)=>({
    row:i+2, hwId:String(r[0]||'').trim(), classCode:String(r[1]||'').trim().toUpperCase(),
    studentName:String(r[2]||'').trim(), mode:String(r[3]||'stage'), stage:Number(r[4])||0,
    lessonId:Number(r[5])||0, exerciseTitle:String(r[6]||'').trim(), title:String(r[7]||'').trim(),
    minStars:Number(r[8])||1, dueDate:ymdOf(r[9]),
    createdAt:r[10] instanceof Date?r[10].toISOString():String(r[10]||''),
  })).filter(h=>h.hwId&&h.classCode&&h.dueDate);
}

function _hwSubRows() {
  const sheet=getSheetLoose('HomeworkSubmissions');
  if (!sheet||sheet.getLastRow()<2) return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,HWS_HEADERS.length).getValues();
}

function _hwDeadline(h) { return dayStartMs(addDays(h.dueDate,1)); }   // end of the due date
function _hwFor(h, cc, st) { return h.classCode===cc && (!h.studentName || h.studentName===st); }

// Same star rule as the lessons (src/engine/scoring.js lessonStars).
function _hwStars(wpm, acc, stage) {
  const target=STAGE_TARGETS[(stage||1)-1]||5;
  if (acc<90) return 0;
  if (wpm>=target*1.5 && acc>=95) return 3;
  return wpm>=target?2:1;
}

// classCode|studentName → {best, attempts, passedAt, wpm, acc} for one homework.
function _hwStatus(h, rows) {
  const deadline=_hwDeadline(h), out={};
  rows.forEach(r=>{
    if (String(r[1]||'').trim()!==h.hwId) return;
    const k=String(r[2]||'').trim().toUpperCase()+'|'+String(r[3]||'').trim();
    const s=out[k]||(out[k]={best:0,attempts:0,passedAt:0,wpm:0,acc:0,lastAt:0});
    const stars=Number(r[5])||0, wpm=Number(r[7])||0, at=toTime(r[0]);
    s.attempts++;
    s.lastAt=Math.max(s.lastAt,at);
    if (stars>s.best || (stars===s.best && wpm>s.wpm)) { s.best=stars; s.wpm=wpm; s.acc=Number(r[8])||0; }
    if (stars>=h.minStars && (!s.passedAt || at<s.passedAt)) s.passedAt=at;
  });
  Object.values(out).forEach(s=>{ s.late=!!s.passedAt && s.passedAt>deadline; });
  return out;
}

function _publicHw(h) {
  return {hwId:h.hwId,mode:h.mode,stage:h.stage,lessonId:h.lessonId,exerciseTitle:h.exerciseTitle,
    title:h.title,minStars:h.minStars,dueDate:h.dueDate,dueEndsAt:_hwDeadline(h),
    forStudent:!!h.studentName};
}

// Student's list: everything not passed yet (up to 30 days after the due date)
// plus passed homework until 7 days after the due date.
function _studentHomework(cc, st) {
  const now=Date.now(), rows=_hwSubRows(), DAY=86400000;
  return _readHomework().filter(h=>_hwFor(h,cc,st)).map(h=>{
    const s=_hwStatus(h,rows)[cc+'|'+st]||{best:0,attempts:0,passedAt:0,late:false};
    return Object.assign(_publicHw(h),{best:s.best,attempts:s.attempts,passed:!!s.passedAt,late:s.late});
  }).filter(h=>h.passed ? now<h.dueEndsAt+7*DAY : now<h.dueEndsAt+30*DAY)
    .sort((a,b)=>(a.passed-b.passed)||(a.dueEndsAt-b.dueEndsAt));
}

// ── Student actions ─────────────────────────────────────────────
function getHomework(params,user) {
  const rec=requireStudent(params,user);
  const cc=String(rec.row[0]||'').trim().toUpperCase(), st=String(rec.row[1]||'').trim();
  return {homework:_studentHomework(cc,st)};
}

function submitHomework(params,user) {
  const rec=requireStudent(params,user);
  const cc=String(rec.row[0]||'').trim().toUpperCase(), st=String(rec.row[1]||'').trim();
  const id=String(params.hwId||'').trim();
  const h=_readHomework().find(x=>x.hwId===id&&_hwFor(x,cc,st));
  if (!h) return {error:'HW_NOT_FOUND'};
  const n=k=>Number(params[k]);
  const cpm=n('cpm'),accuracy=n('accuracy'),errors=n('errors'),chars=n('chars'),duration=n('duration'),claimed=n('stars');
  if (![cpm,accuracy,errors,chars,duration,claimed].every(Number.isFinite) ||
      cpm<0||cpm>3000||accuracy<0||accuracy>100||errors<0||errors>10000||
      chars<0||chars>20000||duration<=0||duration>HW_MAX_SECS||claimed<0||claimed>3) throw new Error('Invalid homework data');
  const mins=duration/60;
  const wpm=h.stage===NET_STAGE ? Math.max(0,(cpm*mins/4-errors)/mins) : cpm/4;
  // The app's own figure can differ a little (rounding of KPM and seconds), so allow 3%.
  const stars=Math.min(Math.floor(claimed),_hwStars(wpm*1.03,accuracy,h.stage));
  const late=Date.now()>_hwDeadline(h);
  _hwSubSheet().appendRow([new Date(),id,cc,st,user.email,stars,cpm,Math.round(wpm*10)/10,
    accuracy,errors,chars,duration,late?'ช้า':'']);
  return {ok:true,stars,passed:stars>=h.minStars,late,homework:_studentHomework(cc,st)};
}

// ── Teacher actions ─────────────────────────────────────────────
// All homework (newest first) with counts, plus classes/students for the pickers.
function getHomeworkList() {
  const roster=_rosterIndex(), rows=_hwSubRows(), classes={};
  Object.values(roster.byKey).forEach(s=>{ (classes[s.classCode]=classes[s.classCode]||[]).push(s.studentName); });
  Object.keys(classes).forEach(k=>classes[k].sort((a,b)=>a.localeCompare(b,'th')));
  const homework=_readHomework().map(h=>{
    const targets=h.studentName?[h.studentName]:(classes[h.classCode]||[]);
    const st=_hwStatus(h,rows);
    let passed=0, tried=0;
    targets.forEach(name=>{ const s=st[h.classCode+'|'+name]; if (s) { tried++; if (s.passedAt) passed++; } });
    return Object.assign(_publicHw(h),{classCode:h.classCode,studentName:h.studentName,
      createdAt:h.createdAt,total:targets.length,passed,tried});
  }).sort((a,b)=>b.dueDate.localeCompare(a.dueDate)||a.classCode.localeCompare(b.classCode,undefined,{numeric:true}));
  return {homework,classes,today:Utilities.formatDate(new Date(),tz(),'yyyy-MM-dd')};
}

// Create (no hwId) or edit (hwId: only due date and minimum stars can change —
// changing the text would make earlier attempts meaningless).
function setHomework(params,user) {
  const due=String(params.dueDate||'').trim();
  const minStars=Number(params.minStars);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return {error:'Invalid due date'};
  if (!(minStars>=1&&minStars<=3&&Math.floor(minStars)===minStars)) return {error:'Invalid stars'};
  const id=String(params.hwId||'').trim();
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet=_hwSheet(true);
    if (id) {
      const h=_readHomework().find(x=>x.hwId===id);
      if (!h) return {error:'HW_NOT_FOUND'};
      sheet.getRange(h.row,9,1,2).setNumberFormats([['0','@']]).setValues([[minStars,due]]);
    } else {
      const cc=String(params.classCode||'').trim().toUpperCase();
      const st=String(params.studentName||'').trim();
      const mode=String(params.mode||'')==='exercise'?'exercise':'stage';
      const stage=Number(params.stage), lid=Number(params.lessonId);
      const ex=String(params.exerciseTitle||'').trim().slice(0,120);
      const title=String(params.title||'').trim().slice(0,120);
      if (!/^[A-Z0-9]{1,12}$/.test(cc)) return {error:'Invalid class'};
      if (!(stage>=1&&stage<=9) || !(lid>=101&&lid<=200) || !title) return {error:'Missing required fields'};
      if (mode==='stage' && stage>7) return {error:'Invalid stage'};
      if (mode==='exercise' && !ex) return {error:'Missing required fields'};
      const roster=_rosterIndex();
      if (!Object.values(roster.byKey).some(s=>s.classCode===cc&&(!st||s.studentName===st))) return {error:'Student not found'};
      const newId='HW'+Date.now().toString(36).toUpperCase();
      sheet.appendRow([newId,cc,st,mode,stage,lid,mode==='exercise'?ex:'',title,minStars,due,new Date(),user&&user.email||'']);
      sheet.getRange(sheet.getLastRow(),10).setNumberFormat('@').setValue(due);
    }
  } finally {
    lock.releaseLock();
  }
  return getHomeworkList();
}

function deleteHomework(params) {
  const id=String(params.hwId||'').trim();
  const h=_readHomework().find(x=>x.hwId===id);
  if (!h) return {error:'HW_NOT_FOUND'};
  _hwSheet(false).deleteRow(h.row);
  return getHomeworkList();
}

// One row per student the homework is for: passed / tried / not started.
function getHomeworkResults(params) {
  const id=String(params.hwId||'').trim();
  const h=_readHomework().find(x=>x.hwId===id);
  if (!h) return {error:'HW_NOT_FOUND'};
  const roster=_rosterIndex();
  const names=h.studentName?[h.studentName]
    :Object.values(roster.byKey).filter(s=>s.classCode===h.classCode).map(s=>s.studentName);
  const st=_hwStatus(h,_hwSubRows());
  const students=names.map(name=>{
    const s=st[h.classCode+'|'+name];
    const status=!s?'none':s.passedAt?(s.late?'late':'passed'):'tried';
    return {name,status,best:s?s.best:0,attempts:s?s.attempts:0,wpm:s?s.wpm:0,acc:s?s.acc:0,
      passedAt:s&&s.passedAt?new Date(s.passedAt).toISOString():'',
      lastAt:s&&s.lastAt?new Date(s.lastAt).toISOString():''};
  });
  const order={none:0,tried:1,late:2,passed:3};
  students.sort((a,b)=>order[a.status]-order[b.status]||a.name.localeCompare(b.name,'th'));
  return {homework:_publicHw(h),classCode:h.classCode,students};
}
