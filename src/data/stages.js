// ═══════════════════════════════════════════════════════════════
// NEW CURRICULUM — 9 stages · 34 lessons (lesson ids 101–134, shown as บท 1–34)
// Hand-written structure. The word lists and stage-9 passages come from
// data/curriculum.xlsx → src/data/curriculum.gen.js (scripts/curriculum.mjs).
// Rule used to group keys (research: Lessenberry skip-around): a lesson never
// introduces the same finger of both hands (e.g. ด left index + ่ right index).
// ═══════════════════════════════════════════════════════════════

// Characters that never appear in lesson text: % _ sit on the ` key (switches the
// input language on many Windows PCs); + ฃ ฅ ฦ ๅ ํ ฺ are (almost) unused in modern Thai.
export const FORBIDDEN = '%_+ฃฅฦๅํฺ';

// target = Thai words per minute (keystrokes ÷ 4) needed for ⭐⭐ in this stage
export const STAGES = [
  { id:1, icon:'🏡', title:'หมู่บ้านต้นทาง',   subtitle:'แป้นเหย้า ฟ ห ก ด ่ า ส ว',  target:5,  from:'#15803D', to:'#4ADE80', accent:'#15803D', al:'#DCFCE7' },
  { id:2, icon:'🌾', title:'ทุ่งหญ้ากว้าง',     subtitle:'เ ง ร ้ ำ ไ',               target:5,  from:'#A16207', to:'#FACC15', accent:'#A16207', al:'#FEF9C3' },
  { id:3, icon:'🌳', title:'ป่าใหญ่',          subtitle:'พ ะ ม น ั ี แ ป',           target:8,  from:'#166534', to:'#22C55E', accent:'#166534', al:'#DCFCE7' },
  { id:4, icon:'🏞️', title:'ริมลำธาร',         subtitle:'อ ิ ย ใ ท ื ผ ๆ',           target:8,  from:'#0E7490', to:'#22D3EE', accent:'#0E7490', al:'#CFFAFE' },
  { id:5, icon:'⛰️', title:'ภูเขาแถวบนสุด',     subtitle:'บ ล ฝ ค ต ถ ภ ุ ึ จ ข ช',    target:10, from:'#57534E', to:'#A8A29E', accent:'#57534E', al:'#F5F5F4' },
  { id:6, icon:'🦇', title:'ถ้ำปุ่ม Shift',      subtitle:'โ ธ ณ ็ ์ ฉ ซ ญ ศ ฮ',        target:8,  from:'#4C1D95', to:'#8B5CF6', accent:'#6D28D9', al:'#EDE9FE' },
  { id:7, icon:'🏰', title:'ปราสาทอักษรหายาก',  subtitle:'ู ษ ฒ ฆ ๊ ๋ ฏ ฐ ฎ ฑ ฌ ฬ ฤ ฯ', target:8,  from:'#9F1239', to:'#FB7185', accent:'#BE123C', al:'#FFE4E6' },
  { id:8, icon:'🗼', title:'หอคอยตัวเลข',       subtitle:'เลขไทยและเครื่องหมาย',       target:8,  from:'#1E40AF', to:'#60A5FA', accent:'#1D4ED8', al:'#DBEAFE' },
  { id:9, icon:'🏆', title:'ยอดเขาแชมป์',       subtitle:'ประโยคยาว · คำสุทธิ',        target:12, from:'#B45309', to:'#FBBF24', accent:'#B45309', al:'#FEF3C7' },
];

// type: new (new keys) · boss (review of the stage) · sym (numerals / marks) · symboss · long (stage 9)
export const LESSON_DEFS = [
  { n:1,  stage:1, type:'new',  keys:'หดาว' },
  { n:2,  stage:1, type:'new',  keys:'กส่ฟ' },
  { n:3,  stage:1, type:'boss' },
  { n:4,  stage:2, type:'new',  keys:'เงร' },
  { n:5,  stage:2, type:'new',  keys:'้ำไ' },
  { n:6,  stage:2, type:'boss' },
  { n:7,  stage:3, type:'new',  keys:'พะมน' },
  { n:8,  stage:3, type:'new',  keys:'ัีแป' },
  { n:9,  stage:3, type:'boss' },
  { n:10, stage:4, type:'new',  keys:'อิยใ' },
  { n:11, stage:4, type:'new',  keys:'ทืผๆ' },
  { n:12, stage:4, type:'boss' },
  { n:13, stage:5, type:'new',  keys:'บลฝ' },
  { n:14, stage:5, type:'new',  keys:'คตถภ' },
  { n:15, stage:5, type:'new',  keys:'ุึ' },
  { n:16, stage:5, type:'new',  keys:'จขช' },
  { n:17, stage:5, type:'boss' },
  { n:18, stage:6, type:'new',  keys:'โธณ' },
  { n:19, stage:6, type:'new',  keys:'็์ฉ' },
  { n:20, stage:6, type:'new',  keys:'ซญศฮ' },
  { n:21, stage:6, type:'boss' },
  { n:22, stage:7, type:'new',  keys:'ูษฒฆ' },
  { n:23, stage:7, type:'new',  keys:'๊๋ฏฐ' },
  { n:24, stage:7, type:'new',  keys:'ฎฑฌฬฤฯ' },
  { n:25, stage:7, type:'boss' },
  { n:26, stage:8, type:'sym',  keys:'๐๑๒๓๔', name:'เลขไทย ๐–๔ (มือซ้าย)' },
  { n:27, stage:8, type:'sym',  keys:'๕๖๗๘๙', name:'เลขไทย ๕–๙ (มือขวา)' },
  { n:28, stage:8, type:'sym',  keys:'?฿()"-/', name:'เครื่องหมาย ? ฿ ( ) " - /' },
  { n:29, stage:8, type:'symboss', keys:'.,', name:'👑 บอส: . , และทุกอย่าง' },
  { n:30, stage:9, type:'long', name:'ประโยคเดี่ยว',            secs:120 },
  { n:31, stage:9, type:'long', name:'นิทานและเรื่องเล่า',       secs:180 },
  { n:32, stage:9, type:'long', name:'ความรู้ข้ามวิชา',          secs:180 },
  { n:33, stage:9, type:'long', name:'ตัวเลข เครื่องหมาย วันที่', secs:240 },
  { n:34, stage:9, type:'long', name:'👑 บอสสุดท้าย',            secs:300 },
];

export const lessonIdOf = n => 100 + n;

// Steps inside a lesson. kind decides how the text is generated (engine/curriculumText.js).
// secs > 0 → timed step (clock starts at the first key press).
export function stepsFor(def) {
  const early = def.n <= 3;            // stage 1 has very few real words
  switch (def.type) {
    case 'new': return [
      { kind:'drill',  name:'แนะนำแป้น', minChars:60 },
      { kind:'syll',   name:'พยางค์ฝึก', minChars:80 },
      { kind:'words',  name:'คำ',        minChars:early ? 90 : 130 },
      { kind:'phrase', name:'วลี',       minChars:early ? 100 : 150 },
      { kind:'timed',  name:'จับเวลา 1 นาที', secs:60 },
    ];
    case 'boss': return [
      { kind:'words',  name:'คำผสม',  minChars:180 },
      { kind:'phrase', name:'วลี',     minChars:200 },
      { kind:'timed',  name:'จับเวลา 2 นาที', secs:120 },
    ];
    case 'sym': return [
      { kind:'drill',   name:'แนะนำแป้น', minChars:60 },
      { kind:'pattern', name:'รูปแบบ',    minChars:100 },
      { kind:'mix',     name:'ผสมคำ',     minChars:150 },
      { kind:'timed',   name:'จับเวลา 1 นาที', secs:60 },
    ];
    case 'symboss': return [
      { kind:'pattern', name:'รูปแบบรวม', minChars:150 },
      { kind:'mix',     name:'ผสมคำ',     minChars:200 },
      { kind:'timed',   name:'จับเวลา 2 นาที', secs:120 },
    ];
    case 'long': return [
      { kind:'long',      name:'ฝึกพิมพ์' },
      { kind:'longtimed', name:`จับเวลา ${def.secs / 60} นาที`, secs:def.secs },
    ];
  }
  return [];
}

export const stepTitle = (def, i, step) => `${def.n}.${i + 1} ${step.name}`;

export function lessonName(def) {
  if (def.name) return def.name;
  if (def.type === 'boss') return '👑 บอสประจำด่าน';
  // combining marks (่ ั ็ …) are shown on a dotted circle so they don't float: ◌่
  return 'แป้น ' + [...def.keys].map(c => '่้๊๋ัิีึืุู็์'.includes(c) ? '◌' + c : c).join(' ');
}

// Fixed items for the symbol lessons (checked against learned keys at build time).
// Numbers, prices and dates are also generated at run time from the learned digits.
export const SYM_ITEMS = {
  26: ['ข้อ ๑','ข้อ ๒','ข้อ ๓','ข้อ ๔','ชั้น ๒','ห้อง ๑๔','บทที่ ๓','วันที่ ๑๐','ปี ๒๐๒๔'],
  27: ['ข้อ ๕','ข้อ ๙','ห้อง ๒๐๕','วันที่ ๒๕','ปี ๒๕๖๙','เลข ๗','อายุ ๑๒ ปี','สูง ๑๓๘'],
  28: ['(ต่อ)','(ดู)','(หน้า)','(จบ)','(ไม่เกิน ๗ วัน)','ทำไม?','ใคร?','อะไร?','ไปไหน?','เมื่อไร?',
       '"สวัสดี"','"ขอบคุณ"','"ใช่"','"ไม่"','฿๕','฿๒๐','฿๔๕','฿๑๐๐','฿๕๐๐','๑๒/๑๐','๓๑/๑๒/๒๕๖๙',
       '๘ - ๑๐','จันทร์ - ศุกร์','กรุงเทพฯ'],
  29: ['ก,ข,ค','๑,๒,๓','เป็นต้น.','๘.๓๐ น.','๑๖.๐๐ น.','฿๑,๕๐๐','ด.ช.','ด.ญ.','ป.๖/๑','๓.๑๔','ฯลฯ'],
};
