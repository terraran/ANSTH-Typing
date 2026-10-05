import { CHAR_CLASS, COMBINING_CLS } from '../engine/keymap';
import { SPAM_PENALTY, TEST_SECS } from '../engine/scoring';

// Memoised: only re-renders when the visible text chunk, the cursor or `compact` changes.
export const TextDisplay = React.memo(function TextDisplay({ displayChars, displayPos, compact }) {
  const tokens = [];
  let wordBuf=[], wordStart=0;
  displayChars.forEach((ch,i) => {
    if (ch===' ') {
      if (wordBuf.length) { tokens.push({type:'word',chars:wordBuf,start:wordStart}); wordBuf=[]; }
      tokens.push({type:'space',start:i});
    } else {
      if (!wordBuf.length) wordStart=i;
      wordBuf.push({ch,idx:i});
    }
  });
  if (wordBuf.length) tokens.push({type:'word',chars:wordBuf,start:wordStart});

  const cursorOnCombining = displayPos < displayChars.length &&
    COMBINING_CLS.has(CHAR_CLASS[displayChars[displayPos]] ?? '');
  let baseIdxForCombining = -1;
  if (cursorOnCombining) {
    let bi = displayPos - 1;
    while (bi >= 0 && COMBINING_CLS.has(CHAR_CLASS[displayChars[bi]] ?? '')) bi--;
    baseIdxForCombining = bi;
  }

  return (
    <div style={{fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif",
      fontSize:34,lineHeight:compact?1.75:2,display:'flex',flexWrap:'wrap',
      alignContent:'flex-start',gap:'0 2px',minHeight:compact?119:130}}>
      {tokens.map((tok,ti) => {
        if (tok.type==='space') {
          const done=tok.start<displayPos,cur=tok.start===displayPos;
          return (
            <span key={ti} style={{display:'inline-block',width:14,textAlign:'center',
              color:done?'#059669':'#CBD5E1',
              background:cur?'#FEF08A':'transparent',
              borderBottom:cur?'3px solid #F59E0B':'none'}}>
              {done?'·':cur?'⎵':' '}
            </span>
          );
        }
        return (
          // Thai has no spaces inside a phrase, so stage-9 sentences can be one very long "word":
          // let those wrap (the browser breaks Thai at word boundaries) instead of overflowing.
          <span key={ti} style={tok.chars.length>16?{display:'inline'}:{display:'inline-block',whiteSpace:'nowrap'}}>
            {tok.chars.map(({ch,idx}) => {
              const done = idx < displayPos;
              const cur  = idx === displayPos;
              const isBaseForCombiningCursor = cursorOnCombining && idx === baseIdxForCombining;
              const showHighlight = cur || isBaseForCombiningCursor;
              return (
                <span key={idx} style={{
                  color:done?'#059669':cur?'var(--c-t1)':'var(--c-txt-future)',
                  background:showHighlight?'#FEF08A':'transparent',
                  borderBottom:showHighlight?'3px solid #F59E0B':'none',
                }}>{ch}</span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
});

// STAT PILL

export function StatPill({ label, value, color }) {
  return (
    <div style={{background:'var(--c-surf)',border:'3px solid #3B2416',
      padding:'6px 14px',textAlign:'center',minWidth:80}}>
      <div style={{fontFamily:"'Press Start 2P', monospace",fontSize:16,fontWeight:400,color:color??'var(--c-t1)'}}>{value}</div>
      <div style={{fontSize:10,color:'var(--c-t3)',marginTop:2,fontWeight:600,letterSpacing:.5,
        fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>{label}</div>
    </div>
  );
}

// SPAM SCREEN

export function PenaltyScreen({ countdown }) {
  return (
    <div role="alertdialog" aria-label="หยุดพัก" style={{position:'fixed',inset:0,background:'rgba(60,10,10,.72)',
      display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16,
      fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>
      <div className="px-panel" style={{maxWidth:440,width:'100%',textAlign:'center',color:'#3B2416',
        display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'4px 8px 8px'}}>
        <span className="sp sp-xmark"/>
        <div style={{fontSize:26,fontWeight:700,lineHeight:1.3}}>กดแป้นเร็วเกินไป!</div>
        <div style={{fontSize:16,fontWeight:600,lineHeight:1.6}}>
          เหมือนกดมั่ว ๆ — พักก่อน {SPAM_PENALTY} วินาที<br/>แล้วค่อย ๆ พิมพ์ทีละตัวให้ถูกนะ</div>
        <div className="px-wood" style={{padding:'0 14px'}}>
          <span style={{fontFamily:"'Press Start 2P', monospace",fontSize:48,fontWeight:400,color:'#F5D27A',lineHeight:1.1}}>{countdown}</span>
        </div>
        <div style={{fontSize:14,color:'#6A4A30'}}>จะกลับไปพิมพ์ต่อเองอัตโนมัติ</div>
      </div>
    </div>
  );
}

// WEEKLY TEST CLOCK — ring shrinks with the time left; green → yellow (30 s) → red (10 s)

export function TestTimer({ startTime, now, endTime, total: totalSecs = TEST_SECS }) {
  const total = totalSecs * 1000;
  const used = startTime ? Math.min(total, Math.max(0, (endTime ?? now) - startTime)) : 0;
  const leftMs = total - used;
  const left = Math.ceil(leftMs / 1000);
  const frac = leftMs / total;
  const color = left <= 10 ? '#FF8A70' : left <= 30 ? '#FFC23D' : '#9BE39A';
  const R = 30, C = 2 * Math.PI * R;
  const finalTen = !!startTime && !endTime && left <= 10 && left > 0;
  const label = left <= 10 ? String(left) : `${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <div style={{position:'relative',width:72,height:72,flexShrink:0}}
        role="timer" aria-label={`เหลือเวลา ${left} วินาที`}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{transform:'rotate(-90deg)',display:'block'}}>
          <circle cx="36" cy="36" r={R} fill="#3B2416" stroke="#5A3A22" strokeWidth="8"/>
          <circle cx="36" cy="36" r={R} fill="none" stroke={color} strokeWidth="8" strokeLinecap="butt"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
            style={{transition:'stroke-dashoffset .25s linear, stroke .4s'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span key={finalTen ? left : 'clock'} className={finalTen ? 'timer-beat' : ''}
            style={{fontFamily:"'Press Start 2P', monospace",fontSize:left<=10?24:16,fontWeight:400,color}}>
            {label}
          </span>
        </div>
      </div>
      {!startTime && (
        <span style={{fontSize:13,color:'inherit',fontWeight:700,lineHeight:1.4,
          fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>
          {totalSecs % 60 ? `${totalSecs} วินาที` : `${totalSecs / 60} นาที`}<br/>เริ่มนับเมื่อกดปุ่มแรก
        </span>
      )}
    </div>
  );
}

export function TimeUpOverlay() {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,30,40,.5)',zIndex:1001,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:"'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif"}}>
      <div className="timeup-pop px-wood" style={{padding:'6px 40px',textAlign:'center'}}>
        <div style={{fontFamily:"'Kanit',sans-serif",fontStyle:'italic',fontWeight:800,fontSize:56,lineHeight:1.25,color:'#FFC23D',
          textShadow:'3px 0 0 #3B2416,-3px 0 0 #3B2416,0 3px 0 #3B2416,0 -3px 0 #3B2416,5px 5px 0 #3B2416'}}>หมดเวลา!</div>
      </div>
    </div>
  );
}

// 0–3 pixel stars (atlas pieces star_s = 21 px, star_m = 51 px)
export function Stars({ n, size=16 }) {
  const name = size >= 24 ? 'star_m' : 'star_s';
  return <span role="img" aria-label={`${n} ดาว`} style={{display:'inline-flex',gap:2,verticalAlign:'middle'}}>
    {[0,1,2].map(i=><span key={i} className={'sp sp-'+name+(i<n?'':'_off')}/>)}</span>;
}
