import { CHAPTERS, LESSONS } from '../data/lessons';
import { SCRIPT_URL } from '../config';
import { fmtScore, hsKey } from '../engine/scoring';
import { emptyProgress, lessonAnyOpen, lessonComplete, stageDone, stageOpen, stageStars, starsOf as progStars, stepState } from '../engine/progress';
import { ROOM_CODE_LEN } from '../firebase';

const { useEffect, useRef, useState } = React;

// LESSON SELECTOR

export function LessonScreen({ studentName, classCode, onSelect, onOpenSetup, onJoin, joinCode, setJoinCode, joinError, mpBusy, storyPath, storyPower, onViewStats, onLogin, weekly, onOpenWeekly, homework=[], onStartHomework, highScores, character, onOpenCharacter, progress=emptyProgress() }) {
  const savedCh=(()=>{try{return Math.min(parseInt(localStorage.getItem('lastChapter')||'0')||0,CHAPTERS.length-1);}catch{return 0;}})();
  const getExercises=(lesson)=>{
    if(!lesson.story) return lesson.exercises||[];
    if(lesson.id===15) return storyPath==='B'?(lesson.exercisesB||[]):(lesson.exercisesA||[]);
    if(lesson.id===16){
      if(storyPath==='B') return lesson.exercisesCave||[];
      return storyPower==='lightning'?(lesson.exercisesLightning||[]):(lesson.exercisesGold||[]);
    }
    return lesson.exercises||[];
  };
  const [chIdx,       setChIdx]       = useState(savedCh);
  const [openLesson,  setOpenLesson]  = useState(null);
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";


  const gotoChapter = (i) => {
    const c=Math.max(0,Math.min(i,CHAPTERS.length-1));
    setChIdx(c); setOpenLesson(null);
    try{ localStorage.setItem('lastChapter',String(c)); }catch{}
  };


  return (
    <div style={{fontFamily:tf}}>

      <section className="adventure-banner" aria-label="แป้นพิมพ์ผจญภัย">
        <div>
          <h1>แป้นพิมพ์ผจญภัย</h1>
          <p>พิมพ์ให้คล่อง แล้วออกเดินทางผ่านบทเรียนและด่านต่าง ๆ</p>
        </div>
        <span className="banner-mark" aria-hidden="true">🌱</span>
      </section>

      {/* ── Login prompt / Player badge — mutually exclusive ── */}
      {!studentName&&SCRIPT_URL&&(
        <div style={{background:'linear-gradient(135deg,#1D4ED8,#3B82F6)',borderRadius:14,
          padding:'14px 18px',marginBottom:20,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:24}}>👤</span>
          <div style={{flex:1,fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
            <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>ยังไม่ได้เข้าสู่ระบบ</div>
            <div style={{fontSize:11,color:'#BFDBFE'}}>เข้าสู่ระบบด้วย Google เพื่อบันทึกผลและดูสถิติ</div>
          </div>
          <button onClick={()=>onLogin&&onLogin()}
            style={{background:'#fff',color:'#1D4ED8',border:'none',borderRadius:8,
              padding:'9px 16px',cursor:'pointer',fontSize:13,fontWeight:800,
              fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",whiteSpace:'nowrap'}}>
            Sign in with Google
          </button>
          <button onClick={()=>onOpenCharacter&&onOpenCharacter()} title="สร้างตัวละคร"
            style={{background:'rgba(255,255,255,.18)',border:'none',borderRadius:8,padding:4,cursor:'pointer',lineHeight:0}}>
            {window.CharKit?<CharKit.Avatar config={character} size={34}/>:'🎨'}
          </button>
        </div>
      )}
      {studentName&&(
        <div style={{display:'flex',alignItems:'center',gap:12,background:'var(--c-surf)',
          borderRadius:14,padding:'12px 16px',marginBottom:20,border:'1.5px solid var(--c-border)'}}>
          <button onClick={()=>onOpenCharacter&&onOpenCharacter()} title="แก้ไขตัวละคร"
            style={{background:'none',border:'none',padding:0,cursor:'pointer',position:'relative',lineHeight:0}}>
            {window.CharKit
              ? <CharKit.Avatar config={character} size={46}/>
              : <span style={{fontSize:20}}>👤</span>}
            {!character&&<span style={{position:'absolute',right:-4,bottom:-2,fontSize:14,lineHeight:1}}>✨</span>}
          </button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)'}}>{studentName}</div>
            <div style={{fontSize:11,color:'var(--c-t3)'}}>ห้อง {classCode}</div>
          </div>
          <button onClick={()=>onOpenCharacter&&onOpenCharacter()}
            style={{background:character?'var(--c-surf)':'linear-gradient(135deg,#7C3AED,#2563EB)',
              border:character?'1.5px solid var(--c-border)':'none',color:character?'#7C3AED':'#fff',
              borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,
              fontWeight:700,fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",whiteSpace:'nowrap'}}>
            {character?'🎨 ตัวละคร':'✨ สร้างตัวละคร'}
          </button>
          <button onClick={()=>onViewStats&&onViewStats()}
            style={{background:'var(--c-surf)',border:'1.5px solid var(--c-border)',color:'#2563EB',
              borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,
              fontWeight:700,fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",
              whiteSpace:'nowrap'}}>
            📊 สถิติ
          </button>
        </div>
      )}

      {/* ── Weekly test (one per grade level) ── */}
      {studentName && SCRIPT_URL && (()=>{
        const t = weekly?.test, me = weekly?.me;
        const pending = !!t && !me;
        const sub = !weekly ? 'กระดานอันดับของระดับชั้น · จับเวลา 2 นาที'
          : !weekly.grade ? 'ห้องนี้ยังไม่มีแบบทดสอบประจำสัปดาห์'
          : !t ? 'สัปดาห์นี้ครูยังไม่ได้ตั้งแบบทดสอบ'
          : me ? `${t.exerciseTitle} · อันดับ ${me.rank} จาก ${weekly.total} คนใน ${weekly.grade}`
          : `${t.exerciseTitle} · ยังไม่ได้ทำ · จับเวลา 2 นาที`;
        return (
          <button onClick={()=>onOpenWeekly&&onOpenWeekly()}
            style={{width:'100%',display:'flex',alignItems:'center',gap:12,marginBottom:20,
              background:pending?'linear-gradient(135deg,#1D4ED8,#7C3AED)':'var(--c-surf)',
              color:pending?'#fff':'var(--c-t1)',border:pending?'none':'1.5px solid var(--c-border)',
              borderRadius:14,padding:'14px 18px',cursor:'pointer',textAlign:'left',
              fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
            <span style={{fontSize:26}}>📝</span>
            <span style={{flex:1,minWidth:0}}>
              <span style={{display:'block',fontSize:16,fontWeight:800}}>แบบทดสอบประจำสัปดาห์</span>
              <span style={{display:'block',fontSize:12,opacity:.85}}>{sub}</span>
            </span>
            <span style={{fontSize:14,fontWeight:800,whiteSpace:'nowrap'}}>🏆 เปิด</span>
          </button>
        );
      })()}

      {/* ── Homework: one row per item, pending first ── */}
      {studentName && homework.length>0 && (
        <div style={{marginBottom:20,borderRadius:14,border:'1.5px solid #F59E0B',background:'var(--c-surf)',
          overflow:'hidden',fontFamily:"'Sarabun','Noto Sans Thai',sans-serif"}}>
          <div style={{padding:'10px 16px',background:'#FEF3C7',color:'#92400E',fontSize:15,fontWeight:800}}>
            📚 การบ้าน {(()=>{ const n=homework.filter(h=>!h.passed).length; return n?`· ค้าง ${n} ชิ้น`:'· ส่งครบแล้ว 🎉'; })()}
          </div>
          {homework.map(h=>{
            const days=Math.ceil((h.dueEndsAt-Date.now())/86400000);
            const due = days<=0 ? 'เลยกำหนดแล้ว' : days===1 ? 'ส่งภายในวันนี้' : `เหลือ ${days} วัน`;
            const status = h.passed ? (h.late?'✅ ผ่าน (ส่งช้า)':'✅ ผ่านแล้ว')
              : h.attempts ? `ดีสุด ${'⭐'.repeat(h.best)||'0 ดาว'} · ยังไม่ผ่าน` : 'ยังไม่ได้ทำ';
            return (
              <div key={h.hwId} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',borderTop:'1px solid var(--c-border)'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)'}}>{h.title}</div>
                  <div style={{fontSize:12,color:'var(--c-t2)'}}>
                    ต้องได้ {'⭐'.repeat(h.minStars)} · ⏱ 1:30 · {status}
                    {!h.passed&&<span style={{color:days<=1?'#DC2626':'var(--c-t3)',fontWeight:700}}> · {due}</span>}
                  </div>
                </div>
                <button onClick={()=>onStartHomework&&onStartHomework(h)}
                  style={{background:h.passed?'var(--c-surf)':'#D97706',color:h.passed?'var(--c-t2)':'#fff',
                    border:h.passed?'1.5px solid var(--c-border)':'none',borderRadius:10,padding:'8px 14px',
                    cursor:'pointer',fontSize:13,fontWeight:800,fontFamily:'inherit',whiteSpace:'nowrap'}}>
                  {h.passed?'ฝึกอีกครั้ง':h.attempts?'ลองอีกครั้ง ▶':'เริ่มทำ ▶'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Adventure map: a trail through the 9 stages ── */}
      <AdventureMap progress={progress} selected={chIdx} onSelect={gotoChapter} character={character}/>

      {/* ── Lessons of the selected stage ── */}
      {(()=>{
        const ch=CHAPTERS[chIdx];
        const chLessons=LESSONS.filter(l=>ch.lessonIds.includes(l.id));
        const open=stageOpen(progress,ch.id);
        const prevBoss=chIdx>0?LESSONS.filter(l=>CHAPTERS[chIdx-1].lessonIds.includes(l.id)).slice(-1)[0]:null;
        return (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:800,color:'var(--c-t2)',marginBottom:10}}>
              {ch.icon} {ch.label} · {ch.title}
              <span style={{fontWeight:600,color:'var(--c-t3)'}}> — {ch.subtitle}</span>
            </div>
            {!open&&prevBoss&&(
              <div style={{background:'#F8FAFC',border:'1.5px dashed #CBD5E1',borderRadius:12,padding:'10px 14px',
                marginBottom:10,fontSize:13,color:'#475569',lineHeight:1.6}}>
                🔒 ด่านนี้ยังปิดอยู่ — ผ่าน <b>บท {prevBoss.num} {prevBoss.thaiName}</b> ของด่าน {chIdx} ก่อน
                <br/>⚔️ ทางลัด: Rush ขั้นสุดท้ายของบทนั้นให้ได้ ⭐⭐⭐ (หรือให้ครูปลดล็อกให้)
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {chLessons.map((lesson)=>{
                const ghostKey=ex=>'ghostv2_'+lesson.id+'_'+encodeURIComponent(ex.title);
                const exHasGhost=ex=>{try{return !!localStorage.getItem(ghostKey(ex));}catch{return false;}};
                const lessonExs=getExercises(lesson);
                const starsOf=ex=>progStars(progress,lesson,ex);
                const allDone=lessonComplete(progress,lesson);
                const anyOpen=lessonAnyOpen(progress,lesson);
                const hasGhost=lessonExs.some(exHasGhost);
                const starTotal=lessonExs.reduce((a,ex)=>a+starsOf(ex),0);
                const cleared=!!progress.cleared?.[lesson.id];
                const isOpen=openLesson===lesson.id;
                const cardBg=allDone?lesson.accent:'var(--c-card)';
                const cardBorder=allDone?`2px solid ${lesson.accent}`:`1.5px solid var(--c-border)`;
                const numBg=allDone?'rgba(255,255,255,.22)':anyOpen?lesson.al:'#F1F5F9';
                const numColor=allDone?'#fff':anyOpen?lesson.accent:'#94A3B8';
                const titleColor=allDone?'#fff':anyOpen?'var(--c-t1)':'#94A3B8';
                const subColor=allDone?'rgba(255,255,255,.75)':'var(--c-t3)';
                return (
                  <div key={lesson.id}>
                    <div onClick={()=>setOpenLesson(o=>o===lesson.id?null:lesson.id)}
                      style={{background:cardBg,border:cardBorder,
                        borderRadius:isOpen?'12px 12px 0 0':12,
                        padding:'12px 16px',display:'flex',alignItems:'center',gap:12,
                        cursor:'pointer',transition:'opacity .15s, border-radius .1s'}}>
                      <div style={{width:36,height:36,borderRadius:10,background:numBg,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:13,fontWeight:800,color:numColor,flexShrink:0}}>
                        {anyOpen?(lesson.num ?? lesson.id):'🔒'}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:800,color:titleColor}}>
                          {anyOpen?'':`บท ${lesson.num} · `}{lesson.thaiName}</div>
                        <div style={{fontSize:11,color:subColor,marginTop:1}}>
                          {`${lessonExs.length} ขั้น · ⭐ ${starTotal}/${lessonExs.length*3}`}
                          {cleared&&' · ⚔️ ผ่านด้วย Rush'}{hasGhost?' · 👻':''}
                        </div>
                      </div>
                      <span style={{color:allDone?'rgba(255,255,255,.8)':'var(--c-t3)',fontSize:16,flexShrink:0}}>{isOpen?'▲':'▼'}</span>
                    </div>
                    {isOpen&&(
                      <div style={{border:cardBorder,borderTop:'none',
                        borderRadius:'0 0 12px 12px',background:'var(--c-card)',padding:'8px 10px'}}>
                        {lessonExs.map((ex,i)=>{
                          const stt=stepState(progress,lesson,i);
                          const st=starsOf(ex);
                          const hasEx=st>0;
                          const hs=(highScores||{})[hsKey(lesson.id,ex.title)];
                          const skipped=!hasEx&&cleared&&i<lessonExs.length-1;
                          return (
                            <button key={i} disabled={!stt.open} onClick={()=>stt.open&&onSelect(lesson,ex)}
                              title={stt.open?'':stt.reason}
                              style={{width:'100%',display:'flex',justifyContent:'space-between',
                                alignItems:'center',gap:8,
                                background:hasEx?lesson.accent:stt.open?'transparent':'#F8FAFC',
                                border:`1.5px ${stt.rush?'dashed':'solid'} ${stt.open?(stt.rush?'#D97706':lesson.accent):'#E2E8F0'}`,borderRadius:8,
                                padding:'7px 10px',cursor:stt.open?'pointer':'not-allowed',fontFamily:tf,
                                marginBottom:i<lessonExs.length-1?6:0}}>
                              <span style={{fontSize:12,fontWeight:700,textAlign:'left',
                                color:hasEx?'#fff':stt.open?(stt.rush?'#B45309':lesson.accent):'#94A3B8'}}>
                                {stt.open?'':'🔒 '}{ex.title}{stt.rush?' · ⚔️ Rush (ต้อง ⭐⭐⭐ เพื่อข้ามทั้งบท)':''}
                                {!stt.open&&<span style={{fontWeight:600}}> — {stt.reason}</span>}
                              </span>
                              <span style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                                {skipped&&<span style={{fontSize:10,fontWeight:700,color:'#B45309'}}>✓ ข้ามแล้ว</span>}
                                <span style={{fontSize:11,letterSpacing:1,color:hasEx?'#FDE68A':'var(--c-t3)'}}>{'★'.repeat(st)+'☆'.repeat(3-st)}</span>
                                {hs>0&&<span style={{fontSize:10,fontWeight:800,color:hasEx?'#fff':'#D97706'}}>🏆 {fmtScore(hs)}</span>}
                                <span style={{fontSize:10,color:hasEx?'rgba(255,255,255,.75)':'var(--c-t3)'}}>
                                  {ex.secs?`⏱ ${ex.secs/60} นาที`:ex.minChars?`~${ex.minChars}ตัว`:'ข้อความยาว'}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Multiplayer ── */}
      <div style={{borderTop:'1.5px solid #E2E8F0',paddingTop:16}}>
        <div style={{fontSize:11,fontWeight:800,color:'var(--c-t3)',letterSpacing:1,
          marginBottom:12,textAlign:'center'}}>⚡ MULTIPLAYER</div>
        <div style={{display:'flex',gap:10,marginBottom:10}}>
          <button onClick={()=>onOpenSetup&&onOpenSetup('1v1')}
            style={{flex:1,background:'linear-gradient(135deg,#1D4ED8,#2563EB)',color:'#fff',
              border:'none',borderRadius:14,padding:'16px 14px',cursor:'pointer',
              textAlign:'center',fontFamily:tf,transition:'opacity .15s'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            <div style={{fontSize:26,marginBottom:5}}>⚔️</div>
            <div style={{fontSize:14,fontWeight:800}}>1 vs 1</div>
            <div style={{fontSize:10,color:'#BFDBFE',marginTop:3}}>แข่ง 2 คน · ชนะด้วยคะแนน</div>
          </button>
          <button onClick={()=>onOpenSetup&&onOpenSetup('royale')}
            style={{flex:1,background:'linear-gradient(135deg,#92400E,#D97706)',color:'#fff',
              border:'none',borderRadius:14,padding:'16px 14px',cursor:'pointer',
              textAlign:'center',fontFamily:tf,transition:'opacity .15s'}}
            onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
            <div style={{fontSize:26,marginBottom:5}}>🏆</div>
            <div style={{fontSize:14,fontWeight:800}}>Battle Royale</div>
            <div style={{fontSize:10,color:'#FDE68A',marginTop:3}}>แข่งหลายคน</div>
          </button>
        </div>
        <div style={{display:'flex',gap:8}}>
          <input value={joinCode||''} onChange={e=>setJoinCode&&setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==='Enter'&&onJoin&&onJoin(joinCode)}
            placeholder="มีรหัสห้องอยู่แล้ว? — A7K2M" maxLength={ROOM_CODE_LEN}
            style={{flex:1,padding:'10px 14px',border:'1.5px solid var(--c-border)',borderRadius:10,
              fontSize:13,fontFamily:tf,outline:'none',boxSizing:'border-box'}}/>
          <button onClick={()=>onJoin&&onJoin(joinCode)}
            disabled={!joinCode||joinCode.length<ROOM_CODE_LEN||mpBusy}
            style={{background:'#0F172A',color:'#fff',border:'none',borderRadius:10,
              padding:'10px 16px',cursor:'pointer',fontSize:13,fontWeight:700,
              opacity:(!joinCode||joinCode.length<ROOM_CODE_LEN||mpBusy)?0.4:1,whiteSpace:'nowrap'}}>
            {mpBusy?'...':'เข้าร่วม →'}
          </button>
        </div>
        {joinError&&<div style={{fontSize:12,color:'#DC2626',marginTop:6,fontFamily:tf}}>{joinError}</div>}
      </div>
    </div>
  );
}

// ADVENTURE MAP — the 9 stages as stops on a winding trail. Locked stops are grey with 🔒,
// cleared stops get a gold ring, and the student's character stands on the furthest open stop.
const NODE_DX=118, NODE_Y=[58,128], MAP_H=200;
export function AdventureMap({ progress, selected, onSelect, character }) {
  const ref=useRef(null);
  const n=CHAPTERS.length, W=60+(n-1)*NODE_DX+60;
  const pts=CHAPTERS.map((_,i)=>({x:60+i*NODE_DX,y:NODE_Y[i%2]}));
  const frontier=(()=>{ let f=0; CHAPTERS.forEach((c,i)=>{ if(stageOpen(progress,c.id)) f=i; }); return f; })();
  useEffect(()=>{
    const el=ref.current; if(!el) return;
    el.scrollTo({left:Math.max(0,pts[selected].x-el.clientWidth/2),behavior:'smooth'});
  },[selected]);
  let d=`M ${pts[0].x} ${pts[0].y}`;
  for (let i=1;i<n;i++){ const a=pts[i-1],b=pts[i],mx=(a.x+b.x)/2; d+=` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`; }
  const tf="'Sarabun','Noto Sans Thai',sans-serif";
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:13,fontWeight:800,color:'var(--c-t2)',marginBottom:8}}>🗺️ แผนที่ผจญภัย</div>
      <div ref={ref} style={{overflowX:'auto',borderRadius:16,border:'1.5px solid var(--c-border)',
        background:'linear-gradient(180deg,#E0F2FE 0%,#F0FDF4 55%,#ECFCCB 100%)'}}>
        <div style={{position:'relative',width:W,height:MAP_H}}>
          <svg width={W} height={MAP_H} style={{position:'absolute',inset:0}}>
            <path d={d} fill="none" stroke="#D6C7A1" strokeWidth="14" strokeLinecap="round"/>
            <path d={d} fill="none" stroke="#FFFBEB" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round"/>
          </svg>
          {CHAPTERS.map((c,i)=>{
            const open=stageOpen(progress,c.id), done=stageDone(progress,c.id), sel=i===selected;
            const {got,max}=stageStars(progress,c.id), p=pts[i];
            return (
              <button key={c.id} onClick={()=>onSelect(i)} aria-label={`ด่าน ${c.id} ${c.title}${open?'':' (ล็อก)'}`}
                style={{position:'absolute',left:p.x-46,top:p.y-30,width:92,background:'none',border:'none',
                  cursor:'pointer',padding:0,fontFamily:tf,textAlign:'center'}}>
                {i===frontier&&window.CharKit&&character&&(
                  <div style={{position:'absolute',left:58,top:-30,lineHeight:0}}><CharKit.Avatar config={character} size={30}/></div>
                )}
                <div style={{width:sel?60:52,height:sel?60:52,margin:'0 auto',borderRadius:'50%',
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:sel?28:24,
                  background:open?`linear-gradient(135deg,${c.from},${c.to})`:'#E2E8F0',
                  border:done?'4px solid #F59E0B':sel?'3px solid #0F172A':'3px solid #fff',
                  boxShadow:sel?'0 6px 16px rgba(15,23,42,.25)':'0 2px 6px rgba(15,23,42,.15)',
                  filter:open?'none':'grayscale(1)',transition:'all .2s'}}>
                  {open?c.icon:'🔒'}
                </div>
                <div style={{fontSize:11,fontWeight:800,color:open?'#0F172A':'#94A3B8',marginTop:3,whiteSpace:'nowrap'}}>
                  {c.id}. {c.title}</div>
                <div style={{fontSize:10,fontWeight:700,color:'#B45309'}}>{open||got?`★ ${got}/${max}`:''}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
