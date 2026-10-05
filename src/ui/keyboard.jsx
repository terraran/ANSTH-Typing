import { FINGER_COLORS, KEYMAP, KEY_META } from '../engine/keymap';

// KEYBOARD LAYOUT

export const KB_ROWS = [
  [ {c:'Backquote'},{c:'Digit1'},{c:'Digit2'},{c:'Digit3'},{c:'Digit4'},{c:'Digit5'},
    {c:'Digit6'},{c:'Digit7'},{c:'Digit8'},{c:'Digit9'},{c:'Digit0'},{c:'Minus'},{c:'Equal'},
    {c:'Backspace',lbl:'⌫',w:2,sp:true} ],
  [ {c:'Tab',lbl:'Tab',w:1.5,sp:true},
    {c:'KeyQ'},{c:'KeyW'},{c:'KeyE'},{c:'KeyR'},{c:'KeyT'},{c:'KeyY'},{c:'KeyU'},
    {c:'KeyI'},{c:'KeyO'},{c:'KeyP'},{c:'BracketLeft'},{c:'BracketRight'},
    {c:'Backslash',w:1.5} ],
  [ {c:'CapsLock',lbl:'Caps',w:1.75,sp:true},
    {c:'KeyA'},{c:'KeyS'},{c:'KeyD'},{c:'KeyF'},{c:'KeyG'},{c:'KeyH'},{c:'KeyJ'},
    {c:'KeyK'},{c:'KeyL'},{c:'Semicolon'},{c:'Quote'},
    {c:'Enter',lbl:'↵',w:2.25,sp:true} ],
  [ {c:'ShiftLeft',lbl:'⇧ Shift',w:2.25,sp:true},
    {c:'KeyZ'},{c:'KeyX'},{c:'KeyC'},{c:'KeyV'},{c:'KeyB'},{c:'KeyN'},{c:'KeyM'},
    {c:'Comma'},{c:'Period'},{c:'Slash'},
    {c:'ShiftRight',lbl:'⇧ Shift',w:2.75,sp:true} ],
  [ {c:'CtrlL',lbl:'Ctrl',w:1.5,sp:true},{c:'AltL',lbl:'Alt',w:1.5,sp:true},
    {c:'Space',lbl:'⎵ Space',w:7,sp:true},
    {c:'AltR',lbl:'Alt',w:1.5,sp:true},{c:'CtrlR',lbl:'Ctrl',w:1.5,sp:true} ],
];

// KEY component

// Props are per-key booleans, so React.memo skips every key whose look did not change
// (before: all 60 keys re-rendered on every keystroke).
export const Key = React.memo(function Key({ kdef, active, isFlash, shiftHeld }) {
  const { c, lbl, w=1, sp=false } = kdef;
  const meta=KEY_META[c], chars=KEYMAP[c];
  const shifted   = shiftHeld && chars && chars.length>1 && chars[1]!==chars[0];
  const mainChar  = chars ? (shifted ? chars[1] : chars[0]) : '';
  const smallChar = chars ? (shifted ? chars[0] : chars[1]) : '';
  const bg=sp?'var(--c-key-sp)':meta?FINGER_COLORS[meta.f]:'var(--c-key-def)';
  return (
    <div className={'px-key'+(isFlash?' flash':active?' on':'')} style={{ flex:w,height:'var(--kh)',background:bg,
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      position:'relative',cursor:'default',userSelect:'none',
      transition:'background .1s,box-shadow .1s',minWidth:0 }}>
      {sp ? (
        <span style={{fontSize:11,fontWeight:700,color:'#3B2416'}}>{lbl}</span>
      ) : chars ? (
        <>
          <span style={{position:'absolute',
            top:shifted?'auto':3, bottom:shifted?3:'auto',
            right:shifted?'auto':5, left:shifted?4:'auto',
            fontSize:9,color:'rgba(59,36,22,.55)',fontWeight:600,
            fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>{smallChar}</span>
          <span style={{fontSize:18,fontWeight:700,lineHeight:1,
            color:'#3B2416',
            fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>{mainChar}</span>
          {meta?.home&&!shifted&&<span style={{position:'absolute',bottom:3,width:4,height:4,
            background:'#3B2416'}}/>}
        </>
      ) : null}
    </div>
  );
});

// ON-SCREEN KEYBOARD

export const OnScreenKeyboard = React.memo(function OnScreenKeyboard({ nextCode, needsShift, flashCode, shiftHeld, correctShiftCode }) {
  const isActive = c => nextCode===c || ((c==='ShiftLeft'||c==='ShiftRight') && needsShift && (correctShiftCode ? c===correctShiftCode : true));
  return (
    <div style={{display:'flex',flexDirection:'column',gap:'var(--kg)',width:'100%',
      '--kh':'clamp(30px, 5.2vh, 50px)','--kg':'clamp(3px, .7vh, 5px)'}}>
      {KB_ROWS.map((row,ri)=>(
        <div key={ri} style={{display:'flex',gap:'var(--kg)'}}>
          {row.map(kdef=><Key key={kdef.c} kdef={kdef} active={isActive(kdef.c)}
            isFlash={flashCode===kdef.c} shiftHeld={shiftHeld}/>)}
        </div>
      ))}
      <div style={{display:'flex',gap:10,marginTop:2,flexWrap:'wrap',justifyContent:'center'}}>
        {[['LP','ซ้ายก้อย'],['LR','ซ้ายนาง'],['LM','ซ้ายกลาง'],['LI','ซ้ายชี้'],
          ['RI','ขวาชี้'],['RM','ขวากลาง'],['RR','ขวานาง'],['RP','ขวาก้อย']].map(([f,lbl])=>(
          <div key={f} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,color:'inherit',
            fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>
            <span style={{width:11,height:11,borderRadius:2,background:FINGER_COLORS[f],
              display:'inline-block',flexShrink:0}}/>
            {lbl}
          </div>
        ))}
      </div>
    </div>
  );
});
