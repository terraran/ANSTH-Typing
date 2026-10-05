// PHASE 0 ENGINE  (source: KBDTH0.DLL / TIS 820-2538)

export const KEYMAP = {
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

// US-QWERTY layout, used only when the browser gives no usable e.code (fallback).
const US_LAYOUT = {
  Backquote:['`','~'],Digit1:['1','!'],Digit2:['2','@'],Digit3:['3','#'],Digit4:['4','$'],
  Digit5:['5','%'],Digit6:['6','^'],Digit7:['7','&'],Digit8:['8','*'],Digit9:['9','('],
  Digit0:['0',')'],Minus:['-','_'],Equal:['=','+'],
  KeyQ:['q','Q'],KeyW:['w','W'],KeyE:['e','E'],KeyR:['r','R'],KeyT:['t','T'],KeyY:['y','Y'],
  KeyU:['u','U'],KeyI:['i','I'],KeyO:['o','O'],KeyP:['p','P'],BracketLeft:['[','{'],
  BracketRight:[']','}'],Backslash:['\\','|'],
  KeyA:['a','A'],KeyS:['s','S'],KeyD:['d','D'],KeyF:['f','F'],KeyG:['g','G'],KeyH:['h','H'],
  KeyJ:['j','J'],KeyK:['k','K'],KeyL:['l','L'],Semicolon:[';',':'],Quote:["'",'"'],
  KeyZ:['z','Z'],KeyX:['x','X'],KeyC:['c','C'],KeyV:['v','V'],KeyB:['b','B'],KeyN:['n','N'],
  KeyM:['m','M'],Comma:[',','<'],Period:['.','>'],Slash:['/','?'],
};
function charIndex(layout) {
  const idx = {};
  for (const [code, [u, sh]] of Object.entries(layout)) {
    if (u && !idx[u]) idx[u] = { code, shift:false };
    if (sh && !idx[sh]) idx[sh] = { code, shift:true };
  }
  return idx;
}
const TH_INDEX = charIndex(KEYMAP), US_INDEX = charIndex(US_LAYOUT);
const isThaiChar = c => c >= '\u0E00' && c <= '\u0E7F';
// Which OS layout the student seems to be on — only decides ambiguous ASCII
// symbols ( / - , . " ( ) ? ) in the fallback path.
let lastLayout = 'us';

// A typed character as the Kedmanee character of the same key: Thai stays as is,
// English letters/symbols (layout left on English) become the Thai char on that key.
export function thaiOfTyped(ch) {
  if (!ch) return null;
  if (isThaiChar(ch)) return ch;
  const hit = US_INDEX[ch];
  return hit ? (KEYMAP[hit.code]?.[hit.shift ? 1 : 0] ?? null) : null;
}

// Returns {code, char, via} — via: 'code' (normal) | 'th' / 'us' (fallback from e.key).
// Some machines report an unknown / empty e.code for a key (seen with ช = Equal),
// so when e.code is not in KEYMAP we read e.key instead.
export function resolveKey(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const k = e.key || '';
  if (k.length === 1) {
    if (isThaiChar(k)) lastLayout = 'th';
    else if (/[a-z]/i.test(k)) lastLayout = 'us';
  }
  const entry = KEYMAP[e.code];
  if (entry) return { code:e.code, char:entry[e.shiftKey ? 1 : 0] ?? null, via:'code' };
  if ([...k].length !== 1) return null;                 // Enter, Tab, Unidentified, ...
  if (isThaiChar(k) || (lastLayout === 'th' && TH_INDEX[k] && !/[a-z]/i.test(k))) {
    const hit = TH_INDEX[k];
    return hit ? { code:hit.code, char:k, via:'th' } : null;
  }
  const hit = US_INDEX[k];
  if (!hit) return null;
  // Letters: trust Shift, not the letter's case (Caps Lock gives 'Q' without Shift)
  const shift = /[a-z]/i.test(k) ? e.shiftKey : hit.shift;
  return { code:hit.code, char:KEYMAP[hit.code]?.[shift ? 1 : 0] ?? null, via:'us' };
}

export function mapKey(e) {
  return resolveKey(e)?.char ?? null;
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

// TEXT DISPLAY

export const COMBINING_CLS = new Set(['AV','BV','BD','TONE','AD']);

// MAIN APP

export const CLASS_NAMES = {
  LV:'สระหน้า',CONS:'พยัญชนะ',FV:'สระหลัง',AV:'สระบน',
  BV:'สระล่าง',BD:'จุดล่าง',TONE:'วรรณยุกต์',AD:'ทัณฑฆาต',NON:'อื่นๆ',
};
