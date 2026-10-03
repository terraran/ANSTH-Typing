import { CHAPTERS, LESSONS } from '../data/lessons';
import { SCRIPT_URL } from '../config';
import { fmtScore, hsKey } from '../engine/scoring';
import { ROOM_CODE_LEN } from '../firebase';

const { useEffect, useRef, useState } = React;

// LESSON SELECTOR

export function LessonScreen({ studentName, classCode, onSelect, onOpenSetup, onJoin, joinCode, setJoinCode, joinError, mpBusy, storyPath, storyPower, onViewStats, onLogin, weekly, onOpenWeekly, highScores, character, onOpenCharacter }) {
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
  const [cardW,       setCardW]       = useState(0);
  const carouselRef = useRef(null);
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";

  useEffect(()=>{ if(carouselRef.current) setCardW(carouselRef.current.offsetWidth); },[]);

  const gotoChapter = (i) => {
    const c=Math.max(0,Math.min(i,CHAPTERS.length-1));
    setChIdx(c); setOpenLesson(null);
    try{ localStorage.setItem('lastChapter',String(c)); }catch{}
  };

  const PEEK=28, GAP=10;
  const cw = cardW>0 ? cardW-PEEK : 0;
  const stripTransform = cw>0
    ? `translateX(-${chIdx*(cw+GAP)}px)`
    : `translateX(-${chIdx*100}%)`;
  const minCardW = cw>0 ? cw+'px' : '100%';

  const atFirst = chIdx===0;
  const atLast  = chIdx===CHAPTERS.length-1;

  return (
    <div style={{fontFamily:tf}}>

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

      {/* ── Chapter carousel ── */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:800,color:'var(--c-t3)',letterSpacing:1,
          marginBottom:12,textAlign:'center'}}>🎮 เลือก CHAPTER</div>

        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {/* Prev */}
          <button onClick={()=>gotoChapter(chIdx-1)} disabled={atFirst}
            style={{width:36,height:36,borderRadius:'50%',border:'1.5px solid var(--c-border)',
              background:'#fff',fontSize:20,flexShrink:0,fontWeight:700,
              cursor:atFirst?'default':'pointer',
              color:atFirst?'#CBD5E1':'#64748B',opacity:atFirst?0.35:1,
              display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity .2s'}}>
            ‹
          </button>

          {/* Card strip */}
          <div ref={carouselRef} style={{flex:1,overflow:'hidden'}}>
            <div style={{display:'flex',gap:GAP+'px',transition:'transform .35s cubic-bezier(.4,0,.2,1)',
              transform:stripTransform}}>
              {CHAPTERS.map(ch=>{
                const chLessons=LESSONS.filter(l=>ch.lessonIds.includes(l.id));
                return (
                  <div key={ch.id} style={{minWidth:minCardW,flexShrink:0}}>
                    <div style={{background:`linear-gradient(135deg,${ch.from},${ch.to})`,
                      borderRadius:18,padding:'22px 20px',textAlign:'center',
                      position:'relative',overflow:'hidden'}}>
                      <div style={{position:'absolute',top:-20,right:-20,width:80,height:80,
                        borderRadius:'50%',background:'rgba(255,255,255,.08)'}}/>
                      <div style={{fontSize:30,marginBottom:6}}>{ch.icon}</div>
                      <div style={{fontSize:10,fontWeight:800,color:'rgba(255,255,255,.65)',
                        letterSpacing:1,marginBottom:3}}>{ch.label.toUpperCase()}</div>
                      <div style={{fontSize:19,fontWeight:800,color:'#fff',marginBottom:4,
                        fontFamily:tf}}>{ch.title}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,.75)'}}>
                        {chLessons.length} บทเรียน · {ch.subtitle}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next */}
          <button onClick={()=>gotoChapter(chIdx+1)} disabled={atLast}
            style={{width:36,height:36,borderRadius:'50%',border:'1.5px solid var(--c-border)',
              background:'#fff',fontSize:20,flexShrink:0,fontWeight:700,
              cursor:atLast?'default':'pointer',
              color:atLast?'#CBD5E1':'#64748B',opacity:atLast?0.35:1,
              display:'flex',alignItems:'center',justifyContent:'center',transition:'opacity .2s'}}>
            ›
          </button>
        </div>

        {/* Dots */}
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:10}}>
          {CHAPTERS.map((_,ci)=>(
            <div key={ci} onClick={()=>gotoChapter(ci)}
              style={{width:chIdx===ci?20:6,height:6,borderRadius:99,cursor:'pointer',
                background:chIdx===ci?(CHAPTERS[ci]?.dot||'#1D4ED8'):'#CBD5E1',
                transition:'all .25s'}}/>
          ))}
        </div>
      </div>

      {/* ── Lesson list ── */}
      {(()=>{
        const ch=CHAPTERS[chIdx];
        const chLessons=LESSONS.filter(l=>ch.lessonIds.includes(l.id));
        return (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,fontWeight:800,color:'var(--c-t3)',letterSpacing:1,marginBottom:10}}>
              บทเรียนใน {ch.label.toUpperCase()}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {chLessons.map((lesson)=>{
                const ghostKey=ex=>'ghostv2_'+lesson.id+'_'+encodeURIComponent(ex.title);
                const exHasGhost=ex=>{try{return !!localStorage.getItem(ghostKey(ex));}catch{return false;}};
                const lessonExs=getExercises(lesson);
                const allDone=lessonExs.every(exHasGhost);
                const hasGhost=lessonExs.some(exHasGhost);
                const isOpen=openLesson===lesson.id;
                const cardBg=allDone?lesson.accent:'var(--c-card)';
                const cardBorder=allDone?`2px solid ${lesson.accent}`:`1.5px solid var(--c-border)`;
                const numBg=allDone?'rgba(255,255,255,.22)':lesson.al;
                const numColor=allDone?'#fff':lesson.accent;
                const titleColor=allDone?'#fff':'var(--c-t1)';
                const subColor=allDone?'rgba(255,255,255,.7)':'var(--c-t3)';
                const arrowColor=allDone?'rgba(255,255,255,.8)':'var(--c-t3)';
                return (
                  <div key={lesson.id}>
                    <div onClick={()=>setOpenLesson(o=>o===lesson.id?null:lesson.id)}
                      style={{background:cardBg,border:cardBorder,
                        borderRadius:isOpen?'12px 12px 0 0':12,
                        padding:'12px 16px',display:'flex',alignItems:'center',gap:12,
                        cursor:'pointer',transition:'opacity .15s, border-radius .1s'}}
                      onMouseEnter={e=>e.currentTarget.style.opacity='.88'}
                      onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                      <div style={{width:36,height:36,borderRadius:10,background:numBg,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        fontSize:13,fontWeight:800,color:numColor,flexShrink:0}}>
                        {lesson.id}
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:800,color:titleColor}}>{lesson.thaiName}</div>
                        <div style={{fontSize:11,color:subColor,marginTop:1}}>
                          {getExercises(lesson).length} exercises{hasGhost?' · 👻':''}
                        </div>
                      </div>
                      <span style={{color:arrowColor,fontSize:16,flexShrink:0}}>{isOpen?'▲':'▼'}</span>
                    </div>
                    {isOpen&&(
                      <div style={{border:cardBorder,borderTop:'none',
                        borderRadius:'0 0 12px 12px',background:'var(--c-card)',padding:'8px 10px'}}>
                        {lessonExs.map((ex,i)=>{
                          const hasEx=exHasGhost(ex);
                          return (
                            <button key={i} onClick={()=>onSelect(lesson,ex)}
                              style={{width:'100%',display:'flex',justifyContent:'space-between',
                                alignItems:'center',
                                background:hasEx?lesson.accent:'transparent',
                                border:`1.5px solid ${lesson.accent}`,borderRadius:8,
                                padding:'7px 10px',cursor:'pointer',fontFamily:tf,
                                marginBottom:i<lessonExs.length-1?6:0,
                                transition:'opacity .1s'}}
                              onMouseEnter={e=>e.currentTarget.style.opacity='.8'}
                              onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                              <span style={{fontSize:12,fontWeight:700,
                                color:hasEx?'#fff':lesson.accent}}>{ex.title}</span>
                              <span style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
                                {hasEx&&<span style={{fontSize:10}}>👻</span>}
                                {(highScores||{})[hsKey(lesson.id,ex.title)]>0&&(
                                  <span style={{fontSize:10,fontWeight:800,
                                    color:hasEx?'#fff':'#D97706'}}>🏆 {fmtScore(highScores[hsKey(lesson.id,ex.title)])}</span>
                                )}
                                <span style={{fontSize:10,
                                  color:hasEx?'rgba(255,255,255,.7)':'var(--c-t3)'}}>~{ex.minChars}ตัว</span>
                                <span style={{color:hasEx?'rgba(255,255,255,.8)':lesson.accent,fontSize:12}}>→</span>
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
