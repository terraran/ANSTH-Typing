import { findLesson } from '../data/lessons';
import { Stars } from '../ui/common';
import { fmtScore, fmtTimeLeft, fmtWeekRange, pctOf, starsFor } from '../engine/scoring';

const { useEffect, useState } = React;

// WEEKLY TEST BOARD — opens straight onto the grade leaderboard, with the start button

export function WeeklyBoardScreen({ data, status, onRefresh, onStart, onBack }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  const [, setTick] = useState(0);
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),30000); return ()=>clearInterval(id); },[]);
  const loading = status==='loading';
  const back = (
    <button onClick={onBack}
      style={{marginTop:18,width:'100%',background:'#F1F5F9',color:'#0F172A',border:'none',
        borderRadius:10,padding:'12px',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:tf}}>
      ← กลับหน้าบทเรียน
    </button>
  );
  if (!data) return (
    <div style={{fontFamily:tf,textAlign:'center',padding:'40px 0'}}>
      {status==='error'
        ? <>
            <div style={{color:'#DC2626',fontWeight:700,marginBottom:12}}>โหลดกระดานอันดับไม่ได้ — ตรวจสัญญาณแล้วลองใหม่</div>
            <button onClick={onRefresh} style={{background:'#0F172A',color:'#fff',border:'none',borderRadius:10,
              padding:'10px 20px',cursor:'pointer',fontSize:14,fontWeight:700,fontFamily:tf}}>↻ โหลดใหม่</button>
          </>
        : <div style={{color:'var(--c-t3)'}}>กำลังโหลดกระดานอันดับ...</div>}
      {back}
    </div>
  );

  const t = data.test;
  const les = t && findLesson(t.lessonId);
  const me = data.me;
  const medal = r => r===1?'🥇':r===2?'🥈':r===3?'🥉':r;
  const row = (e, key) => (
    <div key={key} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,
      background:e.me?'#EFF6FF':'transparent',border:e.me?'1.5px solid #93C5FD':'1.5px solid transparent'}}>
      <span style={{width:30,textAlign:'center',fontSize:e.rank<=3?20:14,fontWeight:800,color:'var(--c-t3)',
        fontVariantNumeric:'tabular-nums'}}>{medal(e.rank)}</span>
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:'block',fontSize:14,fontWeight:800,color:e.me?'#1D4ED8':'var(--c-t1)',
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}{e.me?' (ฉัน)':''}</span>
        <span style={{display:'block',fontSize:11,color:'var(--c-t3)'}}>{e.room}</span>
      </span>
      <Stars n={starsFor(e.score,e.max)} size={12}/>
      <span style={{minWidth:72,textAlign:'right',fontSize:15,fontWeight:800,color:'#D97706',
        fontVariantNumeric:'tabular-nums'}}>{fmtScore(e.score)}</span>
    </div>
  );

  return (
    <div style={{fontFamily:tf}}>
      {/* Header: this week's test + start */}
      <div style={{background:'linear-gradient(135deg,#1E3A8A,#6D28D9)',borderRadius:16,
        padding:'18px 20px',color:'#fff',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{flex:1,fontSize:13,fontWeight:700,opacity:.85}}>
            📝 แบบทดสอบประจำสัปดาห์ {data.grade?`· ${data.grade}`:''} · {fmtWeekRange(data.weekStart)}
          </div>
          <button onClick={onRefresh} disabled={loading} title="โหลดกระดานใหม่"
            style={{background:'rgba(255,255,255,.16)',border:'none',color:'#fff',borderRadius:8,
              padding:'5px 10px',cursor:loading?'default':'pointer',fontSize:13,fontWeight:800,fontFamily:tf}}>
            <span className={loading?'spin':''}>↻</span>
          </button>
        </div>
        {t ? (
          <>
            <div style={{fontSize:26,fontWeight:800,margin:'6px 0 2px'}}>{t.exerciseTitle}</div>
            <div style={{fontSize:12,opacity:.85}}>
              บท {les?.num ?? t.lessonId}{les?` ${les.thaiName}`:''} · ⏱ 2 นาที · {t.showHints?'มีไฮไลต์ปุ่มถัดไป':'🙈 ไม่มีไฮไลต์ปุ่ม'} · {fmtTimeLeft(data.weekEndsAt-Date.now())}
            </div>
            <button onClick={onStart}
              style={{marginTop:14,width:'100%',background:'#fff',color:'#4C1D95',border:'none',
                borderRadius:12,padding:'14px',cursor:'pointer',fontSize:17,fontWeight:800,fontFamily:tf}}>
              ▶ {me?'ทำแบบทดสอบอีกครั้ง':'เริ่มทดสอบประจำสัปดาห์'}
            </button>
            <div style={{fontSize:11,opacity:.75,marginTop:8,textAlign:'center'}}>
              ทำได้หลายครั้ง ระบบนับครั้งที่ดีที่สุด · ทั้ง {data.grade} ได้ข้อความเดียวกัน · นาฬิกาเริ่มเมื่อกดปุ่มแรก
            </div>
          </>
        ) : (
          <div style={{fontSize:16,fontWeight:700,marginTop:8,lineHeight:1.5}}>
            {data.grade
              ? 'สัปดาห์นี้ครูยังไม่ได้ตั้งแบบทดสอบ — ฝึกบทเรียนรอไว้ก่อนได้เลย'
              : `ห้อง ${data.room||''} ไม่อยู่ในระบบแบบทดสอบประจำสัปดาห์ (รหัสห้องต้องเป็นแบบ Y603) — แจ้งครู`}
          </div>
        )}
      </div>

      {/* My rank */}
      {t && (
        <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 16px',borderRadius:14,
          marginBottom:16,background:'var(--c-surf)',border:'1.5px solid var(--c-border)'}}>
          {me ? (
            <>
              <div style={{fontSize:34,fontWeight:800,color:'#1D4ED8',minWidth:54,textAlign:'center',
                fontVariantNumeric:'tabular-nums'}}>#{me.rank}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)'}}>
                  อันดับของฉัน: {me.rank} จาก {data.total} คนใน {data.grade}</div>
                <div style={{fontSize:12,color:'var(--c-t2)',marginTop:2}}>
                  คะแนนดีสุด <b style={{color:'#D97706'}}>{fmtScore(me.score)}</b> · <Stars n={starsFor(me.score,me.max)} size={12}/> · {pctOf(me.score,me.max)}% ของเป้าหมาย · ทำแล้ว {me.attempts} ครั้ง
                </div>
              </div>
            </>
          ) : (
            <div style={{fontSize:14,fontWeight:700,color:'var(--c-t2)'}}>
              ยังไม่ได้ทำแบบทดสอบสัปดาห์นี้ · มี {data.total} คนใน {data.grade} ทำแล้ว
            </div>
          )}
        </div>
      )}

      {/* Top 10 */}
      {t && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)',marginBottom:6}}>🏆 Top 10 ของ {data.grade}</div>
          <div style={{background:'var(--c-card)',border:'1.5px solid var(--c-border)',borderRadius:14,padding:6}}>
            {data.top.length ? (
              <>
                {data.top.map((e,i)=>row(e,'t'+i))}
                {me && me.rank>10 && (
                  <>
                    <div style={{textAlign:'center',color:'var(--c-t3)',fontSize:12,lineHeight:1}}>⋮</div>
                    {row({...me,me:true},'me')}
                  </>
                )}
              </>
            ) : (
              <div style={{textAlign:'center',padding:20,fontSize:13,color:'var(--c-t3)'}}>
                ยังไม่มีใครทำ — เป็นคนแรกบนกระดานได้เลย!</div>
            )}
          </div>
          <div style={{fontSize:11,color:'var(--c-t3)',marginTop:6,textAlign:'right'}}>
            อัปเดตอัตโนมัติทุก 1 นาที</div>
        </div>
      )}

      {/* Week-by-week progress */}
      {data.history && data.history.length>0 && (
        <div>
          <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)',marginBottom:6}}>📈 พัฒนาการของฉัน</div>
          <div style={{background:'var(--c-card)',border:'1.5px solid var(--c-border)',borderRadius:14,overflow:'hidden'}}>
            {data.history.map((h,i)=>{
              const older = data.history[i+1];
              const pct = pctOf(h.score,h.max);
              const diff = older ? pct - pctOf(older.score,older.max) : null;
              return (
                <div key={h.weekStart} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',
                  borderTop:i?'1px solid var(--c-border)':'none'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:'var(--c-t1)'}}>{fmtWeekRange(h.weekStart)}</div>
                    <div style={{fontSize:11,color:'var(--c-t3)'}}>{h.exerciseTitle}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:15,fontWeight:800,color:'#D97706',fontVariantNumeric:'tabular-nums'}}>{fmtScore(h.score)}</div>
                    <div style={{fontSize:11,color:'var(--c-t2)'}}>{pct}% ของเป้าหมาย</div>
                  </div>
                  <div style={{width:52,textAlign:'right',fontSize:12,fontWeight:800,
                    color:diff===null?'var(--c-t3)':diff>0?'#059669':diff<0?'#DC2626':'var(--c-t2)'}}>
                    {diff===null?'–':diff>0?`▲ ${diff}%`:diff<0?`▼ ${-diff}%`:'= 0%'}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:11,color:'var(--c-t3)',marginTop:6}}>
            ▲▼ เทียบ % ของคะแนนเป้าหมายกับสัปดาห์ก่อน (แต่ละสัปดาห์แบบฝึกไม่เหมือนกัน)</div>
        </div>
      )}
      {back}
    </div>
  );
}
