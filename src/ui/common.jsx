import { CHAR_CLASS, COMBINING_CLS } from '../engine/keymap';
import { SPAM_PENALTY, TEST_SECS } from '../engine/scoring';

export function TextDisplay({ displayChars, displayPos, compact }) {
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
    <div style={{fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",
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
          <span key={ti} style={{display:'inline-block',whiteSpace:'nowrap'}}>
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
}

export // STAT PILL

function StatPill({ label, value, color }) {
  return (
    <div style={{background:'var(--c-surf)',border:'1.5px solid var(--c-border)',
      borderRadius:12,padding:'8px 16px',textAlign:'center',minWidth:80}}>
      <div style={{fontSize:21,fontWeight:800,color:color??'var(--c-t1)'}}>{value}</div>
      <div style={{fontSize:10,color:'var(--c-t3)',marginTop:2,fontWeight:600,letterSpacing:.5,
        fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>{label}</div>
    </div>
  );
}

export // SPAM SCREEN

function PenaltyScreen({ countdown }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(185,28,28,.96)',
      display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',zIndex:1000,gap:16,
      fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
      <div style={{fontSize:72}}>⚠️</div>
      <div style={{fontSize:30,fontWeight:800,color:'#fff',textAlign:'center',lineHeight:1.3}}>
        กดแป้นพิมพ์เร็วเกินไป!
      </div>
      <div style={{fontSize:16,color:'rgba(255,255,255,.8)',textAlign:'center',lineHeight:1.7}}>
        ตรวจพบการกดแป้นแบบสุ่ม — หยุดพัก {SPAM_PENALTY} วินาที<br/>
        <span style={{fontSize:13,opacity:.7}}>Spam detected — {SPAM_PENALTY} second penalty</span>
      </div>
      <div style={{marginTop:8,width:96,height:96,borderRadius:'50%',
        border:'5px solid rgba(255,255,255,.35)',
        display:'flex',alignItems:'center',justifyContent:'center',
        background:'rgba(255,255,255,.12)'}}>
        <span style={{fontSize:48,fontWeight:800,color:'#fff'}}>{countdown}</span>
      </div>
      <div style={{fontSize:14,color:'rgba(255,255,255,.6)'}}>
        จะกลับไปพิมพ์ต่ออัตโนมัติ...
      </div>
    </div>
  );
}

export // WEEKLY TEST CLOCK — ring shrinks with the time left; green → yellow (30 s) → red (10 s)

function TestTimer({ startTime, now, endTime }) {
  const total = TEST_SECS * 1000;
  const used = startTime ? Math.min(total, Math.max(0, (endTime ?? now) - startTime)) : 0;
  const leftMs = total - used;
  const left = Math.ceil(leftMs / 1000);
  const frac = leftMs / total;
  const color = left <= 10 ? '#DC2626' : left <= 30 ? '#F59E0B' : '#059669';
  const R = 30, C = 2 * Math.PI * R;
  const finalTen = !!startTime && !endTime && left <= 10 && left > 0;
  const label = left <= 10 ? String(left) : `${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <div style={{position:'relative',width:72,height:72,flexShrink:0}}
        role="timer" aria-label={`เหลือเวลา ${left} วินาที`}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{transform:'rotate(-90deg)',display:'block'}}>
          <circle cx="36" cy="36" r={R} fill="none" stroke="var(--c-border)" strokeWidth="6"/>
          <circle cx="36" cy="36" r={R} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
            style={{transition:'stroke-dashoffset .25s linear, stroke .4s'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span key={finalTen ? left : 'clock'} className={finalTen ? 'timer-beat' : ''}
            style={{fontSize:left<=10?26:17,fontWeight:800,color,fontVariantNumeric:'tabular-nums'}}>
            {label}
          </span>
        </div>
      </div>
      {!startTime && (
        <span style={{fontSize:12,color:'var(--c-t2)',fontWeight:700,lineHeight:1.4,
          fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
          2 นาที<br/>เริ่มนับเมื่อกดปุ่มแรก
        </span>
      )}
    </div>
  );
}

export function TimeUpOverlay() {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.55)',zIndex:1001,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
      <div className="timeup-pop" style={{background:'#DC2626',color:'#fff',borderRadius:24,
        padding:'28px 44px',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,.35)'}}>
        <div style={{fontSize:64,lineHeight:1}}>⏰</div>
        <div style={{fontSize:36,fontWeight:800,marginTop:8}}>หมดเวลา!</div>
      </div>
    </div>
  );
}

export function Stars({ n, size=16 }) {
  return <span style={{fontSize:size,letterSpacing:1}}>{[0,1,2].map(i=>i<n?'⭐':'☆').join('')}</span>;
}
