export // PHASE 0 ENGINE  (source: KBDTH0.DLL / TIS 820-2538)

const KEYMAP = {
  Backquote:['_','%'],   Digit1:['ๅ','+'],  Digit2:['/','๑'],   Digit3:['-','๒'],
  Digit4:['ภ','๓'],      Digit5:['ถ','๔'],  Digit6:['ุ','ู'],   Digit7:['ึ','฿'],
  Digit8:['ค','๕'],      Digit9:['ต','๖'],  Digit0:['จ','๗'],   Minus:['ข','๘'],
  Equal:['ช','๙'],
  KeyQ:['ๆ','๐'],        KeyW:['ไ','"'],    KeyE:['ำ','ฎ'],     KeyR:['พ','ฑ'],
  KeyT:['ะ','ธ'],        KeyY:['ั','ํ'],    KeyU:['ี','๊'],     KeyI:['ร','ณ'],
  KeyO:['น','ฯ'],        KeyP:['ย','ญ'],    BracketLeft:['บ','ฐ'],BracketRight:['ล',','],
  KeyA:['ฟ','ฤ'],        KeyS:['ห','ฆ'],    KeyD:['ก','ฏ'],     KeyF:['ด','โ'],
  KeyG:['เ','ฌ'],        KeyH:['้','็'],    KeyJ:['่','๋'],     KeyK:['า','ษ'],
  KeyL:['ส','ศ'],        Semicolon:['ว','ซ'],Quote:['ง','.'],   Backslash:['ฃ','ฅ'],
  KeyZ:['ผ','('],        KeyX:['ป',')'],    KeyC:['แ','ฉ'],     KeyV:['อ','ฮ'],
  KeyB:['ิ','ฺ'],        KeyN:['ื','์'],    KeyM:['ท','?'],     Comma:['ม','ฒ'],
  Period:['ใ','ฬ'],      Slash:['ฝ','ฦ'],   Space:[' ',' '],
};

export const CHAR_CLASS = {
  'ก':'CONS','ข':'CONS','ฃ':'CONS','ค':'CONS','ฅ':'CONS','ฆ':'CONS','ง':'CONS',
  'จ':'CONS','ฉ':'CONS','ช':'CONS','ซ':'CONS','ฌ':'CONS','ญ':'CONS','ฎ':'CONS',
  'ฏ':'CONS','ฐ':'CONS','ฑ':'CONS','ฒ':'CONS','ณ':'CONS','ด':'CONS','ต':'CONS',
  'ถ':'CONS','ท':'CONS','ธ':'CONS','น':'CONS','บ':'CONS','ป':'CONS','ผ':'CONS',
  'ฝ':'CONS','พ':'CONS','ฟ':'CONS','ภ':'CONS','ม':'CONS','ย':'CONS','ร':'CONS',
  'ล':'CONS','ว':'CONS','ศ':'CONS','ษ':'CONS','ส':'CONS','ห':'CONS','ฬ':'CONS',
  'อ':'CONS','ฮ':'CONS','ฤ':'CONS','ฦ':'CONS',
  'เ':'LV','แ':'LV','โ':'LV','ใ':'LV','ไ':'LV',
  'า':'FV','ำ':'FV','ะ':'FV',
  'ุ':'BV','ู':'BV','ฺ':'BD',
  '่':'TONE','้':'TONE','๊':'TONE','๋':'TONE',
  '็':'AD','ํ':'AD','์':'AD',
  'ิ':'AV','ั':'AV','ี':'AV','ึ':'AV','ื':'AV',
  '๐':'NON','๑':'NON','๒':'NON','๓':'NON','๔':'NON',
  '๕':'NON','๖':'NON','๗':'NON','๘':'NON','๙':'NON',
  'ๆ':'NON','ฯ':'NON','฿':'NON',' ':'NON',
};

export const KEY_META = {
  Backquote:{f:'LP'},Digit1:{f:'LP'},Digit2:{f:'LR'},Digit3:{f:'LM'},
  Digit4:{f:'LI'},Digit5:{f:'LI'},Digit6:{f:'RI'},Digit7:{f:'RI'},
  Digit8:{f:'RM'},Digit9:{f:'RR'},Digit0:{f:'RP'},Minus:{f:'RP'},Equal:{f:'RP'},
  KeyQ:{f:'LP'},KeyW:{f:'LR'},KeyE:{f:'LM'},KeyR:{f:'LI'},KeyT:{f:'LI'},
  KeyY:{f:'RI'},KeyU:{f:'RI'},KeyI:{f:'RM'},KeyO:{f:'RR'},KeyP:{f:'RP'},
  BracketLeft:{f:'RP'},BracketRight:{f:'RP'},Backslash:{f:'RP'},
  KeyA:{f:'LP',home:true},KeyS:{f:'LR',home:true},KeyD:{f:'LM',home:true},
  KeyF:{f:'LI',home:true},KeyG:{f:'LI'},KeyH:{f:'RI'},
  KeyJ:{f:'RI',home:true},KeyK:{f:'RM',home:true},KeyL:{f:'RR',home:true},
  Semicolon:{f:'RP',home:true},Quote:{f:'RP'},
  KeyZ:{f:'LP'},KeyX:{f:'LR'},KeyC:{f:'LM'},KeyV:{f:'LI'},KeyB:{f:'LI'},
  KeyN:{f:'RI'},KeyM:{f:'RI'},Comma:{f:'RM'},Period:{f:'RR'},Slash:{f:'RP'},
  Space:{f:'TH',home:true},
};

export const FINGER_COLORS = {
  LP:'#7C3AED',LR:'#D97706',LM:'#2563EB',LI:'#059669',
  RI:'#10B981',RM:'#3B82F6',RR:'#F59E0B',RP:'#8B5CF6',TH:'#64748B',
};

export function mapKey(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const entry = KEYMAP[e.code];
  return entry ? (entry[e.shiftKey ? 1 : 0] ?? null) : null;
}

export function validateInput(expected, typed) {
  const pos = typed.length - 1;
  if (pos < 0) return { ok: true };
  const got = typed[pos], want = expected[pos];
  if (got === want) return { ok: true, position: pos };
  if (pos >= expected.length) return { ok:false, errorType:'OVERFLOW', costsLife:true };
  const gC = CHAR_CLASS[got] ?? 'NON', wC = CHAR_CLASS[want] ?? 'NON';
  if (wC==='AV'  && gC==='TONE') return { ok:false, expected:want, got, hint:`พิมพ์สระ (${want}) ก่อนวรรณยุกต์ (${got})`, costsLife:false };
  if (wC==='TONE'&& gC==='AV')   return { ok:false, expected:want, got, hint:`พิมพ์วรรณยุกต์ (${want}) หลังสระ`,          costsLife:false };
  if (wC==='LV'  && gC==='CONS') return { ok:false, expected:want, got, hint:`สระหน้า (${want}) พิมพ์ก่อนพยัญชนะ (${got})`, costsLife:false };
  return { ok:false, hint:null, costsLife:true };
}

export function findKeyForChar(char) {
  for (const [code, [u, s]] of Object.entries(KEYMAP)) {
    if (u === char) return { code, needsShift: false };
    if (s === char) return { code, needsShift: true };
  }
  return null;
}

export // TEXT DISPLAY

const COMBINING_CLS = new Set(['AV','BV','BD','TONE','AD']);

export // MAIN APP

const CLASS_NAMES = {
  LV:'สระหน้า',CONS:'พยัญชนะ',FV:'สระหลัง',AV:'สระบน',
  BV:'สระล่าง',BD:'จุดล่าง',TONE:'วรรณยุกต์',AD:'ทัณฑฆาต',NON:'อื่นๆ',
};
