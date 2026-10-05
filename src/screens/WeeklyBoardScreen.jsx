import { findLesson } from '../data/lessons';
import { Stars } from '../ui/common';
import { INK, PX_FONT, PxButton, Sprite } from '../ui/pixel';
import { fmtScore, fmtTimeLeft, fmtWeekRange, pctOf, starsFor } from '../engine/scoring';

const { useEffect, useState } = React;

// WEEKLY TEST BOARD — opens straight onto the grade leaderboard, with the start button

export function WeeklyBoardScreen({ data, status, onRefresh, onStart, onLoadPast, onBack }) {
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
  const [, setTick] = useState(0);
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),30000); return ()=>clearInterval(id); },[]);
  // Earlier weeks' boards: picked from data.past, loaded on demand and kept for this visit
  const [pastId, setPastId] = useState('');
  const [pastBoards, setPastBoards] = useState({});
  const [pastStatus, setPastStatus] = useState('idle');   // idle|loading|error
  const pickPast = id => {
    setPastId(id);
    if (!id || pastBoards[id] || !onLoadPast) return;
    setPastStatus('loading');
    onLoadPast(id)
      .then(d => { setPastBoards(b => ({...b, [id]:d})); setPastStatus('idle'); })
      .catch(() => setPastStatus('error'));
  };
  const loading = status==='loading';
  const back = (
    <PxButton onClick={onBack} style={{marginTop:18,width:'100%',fontSize:16}}>← กลับหน้าหลัก</PxButton>
  );
  if (!data) return (
    <div style={{fontFamily:tf,textAlign:'center',padding:'40px 0'}}>
      {status==='error'
        ? <>
            <div style={{color:'#DC2626',fontWeight:700,marginBottom:12}}>โหลดกระดานอันดับไม่ได้ — ตรวจสัญญาณแล้วลองใหม่</div>
            <PxButton onClick={onRefresh} style={{fontSize:16}}>↻ โหลดใหม่</PxButton>
          </>
        : <div style={{color:'var(--c-t3)'}}>กำลังโหลดกระดานอันดับ...</div>}
      {back}
    </div>
  );

  const t = data.test;
  const les = t && findLesson(t.lessonId);
  const me = data.me;
  const medal = r => r<=3
    ? <span style={{position:'relative',display:'inline-flex'}}><Sprite name="i_trophy" style={{filter:r===1?'none':r===2?'grayscale(1) brightness(1.3)':'sepia(1) hue-rotate(-20deg) saturate(1.6)'}}/>
        <span style={{position:'absolute',right:-4,bottom:-4,fontFamily:PX_FONT,fontSize:12,fontWeight:400,color:INK}}>{r}</span></span>
    : r;
  const row = (e, key) => (
    <div key={key} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',
      background:e.me?'#FFE9A8':'transparent',border:e.me?'3px solid '+INK:'3px solid transparent'}}>
      <span style={{width:52,textAlign:'center',fontFamily:PX_FONT,fontSize:16,fontWeight:400,color:'var(--c-t2)'}}>{medal(e.rank)}</span>
      <span style={{flex:1,minWidth:0}}>
        <span style={{display:'block',fontSize:14,fontWeight:800,color:'var(--c-t1)',
          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{e.name}{e.me?' (ฉัน)':''}</span>
        <span style={{display:'block',fontSize:11,color:'var(--c-t3)'}}>{e.room}</span>
      </span>
      <Stars n={starsFor(e.score,e.max)} size={12}/>
      <span style={{minWidth:80,textAlign:'right',fontFamily:PX_FONT,fontSize:16,fontWeight:400,color:'#9A5B12'}}>{fmtScore(e.score)}</span>
    </div>
  );

  return (
    <div style={{fontFamily:tf}}>
      {/* Header: this week's test + start */}
      <div className="px-wood" style={{padding:'0 6px',color:'#F5E6BE',marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{flex:1,fontSize:13,fontWeight:700,opacity:.85}}>
            ภารกิจประจำสัปดาห์ {data.grade?`· ${data.grade}`:''} · {fmtWeekRange(data.weekStart)}
          </div>
          <button onClick={onRefresh} disabled={loading} title="โหลดกระดานใหม่"
            style={{background:'rgba(255,255,255,.16)',border:'2px solid #F5E6BE',color:'#F5E6BE',
              padding:'5px 10px',cursor:loading?'default':'pointer',fontSize:13,fontWeight:800,fontFamily:tf}}>
            <span className={loading?'spin':''}>↻</span>
          </button>
        </div>
        {t ? (
          <>
            <div style={{fontSize:26,fontWeight:800,margin:'6px 0 2px'}}>{t.exerciseTitle}</div>
            <div style={{fontSize:12,opacity:.85}}>
              {t.stage ? `คำจากด่าน ${t.stage} + ทบทวนด่านก่อนหน้า` : `บท ${les?.num ?? t.lessonId}${les?` ${les.thaiName}`:''}`} · ⏱ 2 นาที · {t.showHints?'มีไฮไลต์ปุ่มถัดไป':'🙈 ไม่มีไฮไลต์ปุ่ม'} · {fmtTimeLeft(data.weekEndsAt-Date.now())}
            </div>
            <PxButton onClick={onStart} style={{marginTop:14,width:'100%',minHeight:64,fontSize:20}}>
              ▶ {me?'ทำภารกิจอีกครั้ง':'เริ่มภารกิจประจำสัปดาห์'}
            </PxButton>
            <div style={{fontSize:11,opacity:.75,marginTop:8,textAlign:'center'}}>
              ทำได้หลายครั้ง ระบบนับครั้งที่ดีที่สุด · ทั้ง {data.grade} ได้ข้อความเดียวกัน · นาฬิกาเริ่มเมื่อกดปุ่มแรก · คะแนนเท่ากัน ใครแม่นกว่าได้อันดับดีกว่า
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
        <div style={{display:'flex',alignItems:'center',gap:14,padding:'12px 16px',
          marginBottom:16,background:'var(--c-surf)',border:'3px solid '+INK}}>
          {me ? (
            <>
              <div style={{fontFamily:PX_FONT,fontSize:32,fontWeight:400,color:INK,minWidth:60,textAlign:'center'}}>#{me.rank}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)'}}>
                  อันดับของฉัน: {me.rank} จาก {data.total} คนใน {data.grade}</div>
                <div style={{fontSize:12,color:'var(--c-t2)',marginTop:2}}>
                  คะแนนดีสุด <b style={{color:'#9A5B12'}}>{fmtScore(me.score)}</b> · <Stars n={starsFor(me.score,me.max)} size={12}/> · {pctOf(me.score,me.max)}% ของเป้าหมาย · ทำแล้ว {me.attempts} ครั้ง
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
          <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)',marginBottom:6}}>Top 10 ของ {data.grade}</div>
          <div style={{background:'var(--c-card)',border:'3px solid '+INK,padding:6}}>
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

      {/* Earlier weeks' Top 10 */}
      {data.past && data.past.length>0 && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)',marginBottom:6}}>🗓 กระดานสัปดาห์ก่อน ๆ</div>
          <select value={pastId} onChange={e=>pickPast(e.target.value)}
            style={{width:'100%',padding:'10px 12px',border:'3px solid '+INK,
              background:'var(--c-card)',color:'var(--c-t1)',fontSize:14,fontWeight:700,fontFamily:tf,marginBottom:8}}>
            <option value="">— เลือกสัปดาห์ —</option>
            {data.past.map(p=>(
              <option key={p.testId} value={p.testId}>{fmtWeekRange(p.weekStart)} · {p.exerciseTitle}</option>
            ))}
          </select>
          {pastId && (()=>{
            const b = pastBoards[pastId];
            if (!b) return (
              <div style={{textAlign:'center',padding:14,fontSize:13,color:pastStatus==='error'?'#DC2626':'var(--c-t3)'}}>
                {pastStatus==='error'?'โหลดไม่ได้ — ลองเลือกใหม่อีกครั้ง':'กำลังโหลด...'}</div>
            );
            return (
              <div style={{background:'var(--c-card)',border:'3px solid '+INK,padding:6}}>
                {b.top.length ? (
                  <>
                    {b.top.map((e,i)=>row(e,'p'+i))}
                    {b.me && b.me.rank>10 && (
                      <>
                        <div style={{textAlign:'center',color:'var(--c-t3)',fontSize:12,lineHeight:1}}>⋮</div>
                        {row({...b.me,me:true},'pme')}
                      </>
                    )}
                    <div style={{fontSize:12,color:'var(--c-t2)',textAlign:'center',padding:'8px 0 4px'}}>
                      {b.me ? `อันดับของฉัน: ${b.me.rank} จาก ${b.total} คน` : `ฉันไม่ได้ทำสัปดาห์นี้ · มี ${b.total} คนทำ`}</div>
                  </>
                ) : (
                  <div style={{textAlign:'center',padding:20,fontSize:13,color:'var(--c-t3)'}}>ไม่มีใครทำแบบทดสอบสัปดาห์นี้</div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Week-by-week progress */}
      {data.history && data.history.length>0 && (
        <div>
          <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)',marginBottom:6}}>📈 พัฒนาการของฉัน</div>
          <div style={{background:'var(--c-card)',border:'3px solid '+INK,overflow:'hidden'}}>
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
