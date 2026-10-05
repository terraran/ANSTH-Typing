import { CHAPTERS, LESSONS } from '../data/lessons';
import { SCRIPT_URL } from '../config';
import { fmtScore, hsKey } from '../engine/scoring';
import { emptyProgress, lessonAnyOpen, lessonComplete, stageDone, stageOpen, stageStars, starsOf as progStars, stepState } from '../engine/progress';
import { ROOM_CODE_LEN } from '../firebase';
import { INK, PX_FONT, PxButton, PxPanel, Sprite, TH_FONT } from '../ui/pixel';

const { useEffect, useRef, useState } = React;

// HOME — game lobby: character HUD, menu of green buttons, the current stage as doors
// (one door per lesson), the selected lesson's steps, and a strip of the 9 stages.

const SUB = { fontSize: 12, fontWeight: 600, opacity: .9, display: 'block', lineHeight: 1.3 };

function Stars3({ n, size = 's' }) {
  return <span style={{ display: 'inline-flex', gap: 2 }}>
    {[0, 1, 2].map(i => <Sprite key={i} name={i < n ? 'star_' + size : 'star_' + size + '_off'}/>)}
  </span>;
}

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
  const [chIdx,      setChIdx]      = useState(savedCh);
  const [openLesson, setOpenLesson] = useState(null);
  const [view,       setView]       = useState('map');   // map | homework

  const gotoChapter = (i) => {
    const c=Math.max(0,Math.min(i,CHAPTERS.length-1));
    setChIdx(c); setOpenLesson(null); setView('map');
    try{ localStorage.setItem('lastChapter',String(c)); }catch{}
  };

  // "Continue": the first open step without a star, in curriculum order (Rush shortcuts skipped).
  const next = (()=>{
    for (const ch of CHAPTERS) {
      if (!stageOpen(progress,ch.id)) continue;
      for (const lesson of LESSONS.filter(l=>ch.lessonIds.includes(l.id))) {
        const exs=getExercises(lesson);
        for (let i=0;i<exs.length;i++) {
          const stt=stepState(progress,lesson,i);
          if (stt.open && !stt.rush && progStars(progress,lesson,exs[i])===0) return {lesson,ex:exs[i],stage:ch.id};
        }
      }
    }
    return null;
  })();

  const pendingHw = homework.filter(h=>!h.passed).length;
  const t = weekly?.test, me = weekly?.me;
  const weeklySub = !weekly ? 'กระดานอันดับของระดับชั้น'
    : !weekly.grade ? 'ห้องนี้ยังไม่มีภารกิจประจำสัปดาห์'
    : !t ? 'สัปดาห์นี้ครูยังไม่ได้ตั้งภารกิจ'
    : me ? `อันดับ ${me.rank} จาก ${weekly.total} คน` : 'ยังไม่ได้ทำ · จับเวลา 2 นาที';
  const badge = (txt) => <span style={{ position:'absolute', top:-10, right:-8, fontFamily:PX_FONT, fontSize:14, fontWeight:700,
    background:'#C0392B', color:'#FFFFFF', border:'2px solid '+INK, padding:'0 6px', textShadow:'none' }}>{txt}</span>;
  const outlined = { color:'#FFF6D8', textShadow:'2px 2px 0 '+INK };

  const ch=CHAPTERS[chIdx];
  const chLessons=LESSONS.filter(l=>ch.lessonIds.includes(l.id));
  const stOpen=stageOpen(progress,ch.id);
  const prevBoss=chIdx>0?LESSONS.filter(l=>CHAPTERS[chIdx-1].lessonIds.includes(l.id)).slice(-1)[0]:null;
  const selLesson = chLessons.find(l=>l.id===openLesson)
    || chLessons.find(l=>lessonAnyOpen(progress,l) && !lessonComplete(progress,l))
    || chLessons.find(l=>lessonAnyOpen(progress,l)) || chLessons[0];

  return (
    <div style={{ fontFamily:TH_FONT, color:INK, display:'flex', flexDirection:'column', gap:18 }}>

      {/* ── HUD: character head + name, stage progress, character / stats buttons ── */}
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <button onClick={()=>onOpenCharacter&&onOpenCharacter()} title="แต่งตัวละคร" aria-label="แต่งตัวละคร"
          style={{ position:'relative', background:'none', border:0, padding:0, cursor:'pointer', flexShrink:0,
            display:'flex', flexDirection:'column', alignItems:'center' }}>
          {window.CharKit && (
            <CharKit.CharCanvas config={character || CharKit.fromName(studentName || 'ผู้เล่น')} scale={3}
              style={{ marginBottom:-12, position:'relative' }}/>
          )}
          {/* small grass platform */}
          <span style={{ width:140, height:14, background:'#6BB05A', border:'3px solid '+INK, borderBottomWidth:0 }}/>
          <span style={{ width:140, height:10, background:'#8A5A32', border:'3px solid '+INK, borderTopWidth:0 }}/>
          {!character && <span style={{ position:'absolute', top:-6, right:-18, fontSize:12, fontWeight:700, background:'#FFC23D',
            border:'2px solid '+INK, padding:'0 6px', color:INK }}>สร้างตัวละคร</span>}
        </button>
        <div style={{ display:'flex', flexDirection:'column', minWidth:0, ...outlined }}>
          <span style={{ fontSize:28, fontWeight:700, lineHeight:1.3 }}>{studentName || 'ผู้เล่นทดลอง'}</span>
          {classCode && <span style={{ fontFamily:PX_FONT, fontSize:20, fontWeight:700, color:'#F5D27A' }}>{classCode}</span>}
          {!studentName && <span style={{ fontSize:14, fontWeight:600 }}>ทดลองเล่น — ดาวและคะแนนจะไม่ถูกบันทึก</span>}
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:10, flexWrap:'wrap' }}>
          {!studentName && SCRIPT_URL && <PxButton onClick={()=>onLogin&&onLogin()} style={{ fontSize:15 }}>เข้าสู่ระบบเพื่อบันทึกผล</PxButton>}
          <PxButton onClick={()=>onOpenCharacter&&onOpenCharacter()} style={{ fontSize:15 }}>{character?'แต่งตัวละคร':'สร้างตัวละคร'}</PxButton>
          {studentName && <PxButton onClick={()=>onViewStats&&onViewStats()} style={{ fontSize:15 }}>สถิติของฉัน</PxButton>}
        </div>
      </div>

      <div style={{ display:'flex', gap:22, flexWrap:'wrap', alignItems:'flex-start' }}>
        {/* ── Menu ── */}
        <div className="px-panel" style={{ flex:'1 1 260px', maxWidth:'min(100%, 420px)', padding:'4px 0 8px', display:'flex', flexDirection:'column', gap:12 }}>
          <PxButton disabled={!next} onClick={()=>next&&onSelect(next.lesson,next.ex)} style={{ minHeight:68, fontSize:22, textAlign:'center' }}>
            ▶ เล่นต่อ
            {next && <span style={SUB}>บท {next.lesson.num} · {next.ex.title}</span>}
          </PxButton>
          {studentName && SCRIPT_URL && (
            <PxButton onClick={()=>setView(v=>v==='homework'?'map':'homework')} style={{ position:'relative' }}>
              การบ้าน{pendingHw>0 && badge(pendingHw)}
              <span style={SUB}>{homework.length ? (pendingHw?`ค้าง ${pendingHw} ชิ้น`:'ส่งครบแล้ว') : 'ยังไม่มีการบ้าน'}</span>
            </PxButton>
          )}
          {studentName && SCRIPT_URL && (
            <PxButton onClick={()=>onOpenWeekly&&onOpenWeekly()} style={{ position:'relative' }}>
              ภารกิจประจำสัปดาห์{t && !me && badge('ใหม่')}
              <span style={SUB}>{weeklySub}</span>
            </PxButton>
          )}
          <PxButton onClick={()=>onOpenSetup&&onOpenSetup('1v1')}>1 ปะทะ 1<span style={SUB}>ดวล 2 คน · ใครคะแนนมากกว่าชนะ</span></PxButton>
          <PxButton onClick={()=>onOpenSetup&&onOpenSetup('royale')}>Battle Royale<span style={SUB}>แข่งทั้งห้อง · คนสุดท้ายที่รอดชนะ</span></PxButton>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label htmlFor="join-code" style={{ fontSize:14, fontWeight:700 }}>รหัสห้องจากเพื่อน</label>
            <div style={{ display:'flex', gap:8 }}>
              <input id="join-code" value={joinCode||''} onChange={e=>setJoinCode&&setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==='Enter'&&onJoin&&onJoin(joinCode)} placeholder="A7K2M" maxLength={ROOM_CODE_LEN}
                style={{ flex:1, minWidth:0, fontFamily:PX_FONT, fontSize:20, letterSpacing:3, padding:'6px 10px', minHeight:48,
                  boxSizing:'border-box', background:'#FFF9E6', border:'3px solid '+INK, color:INK, outline:'none' }}/>
              <PxButton onClick={()=>onJoin&&onJoin(joinCode)} disabled={!joinCode||joinCode.length<ROOM_CODE_LEN||mpBusy} style={{ fontSize:16 }}>
                {mpBusy?'...':'เข้า'}</PxButton>
            </div>
            {joinError && <div role="alert" style={{ fontSize:13, fontWeight:700, color:'#B3261E' }}>{joinError}</div>}
          </div>
        </div>

        {/* ── Right: homework list, or the current stage ── */}
        <div style={{ flex:'999 1 520px', minWidth:0, display:'flex', flexDirection:'column', gap:16 }}>
          {view==='homework' ? (
            <PxPanel title="การบ้าน" bodyStyle={{ padding:'6px 12px 12px', display:'flex', flexDirection:'column', gap:10 }}>
              {homework.length===0 && <div style={{ fontSize:15, fontWeight:600 }}>ยังไม่มีการบ้าน</div>}
              {homework.map(h=>{
                const days=Math.ceil((h.dueEndsAt-Date.now())/86400000);
                const due = days<=0 ? 'เลยกำหนดแล้ว' : days===1 ? 'ส่งภายในวันนี้' : `เหลือ ${days} วัน`;
                return (
                  <div key={h.hwId} className="px-wood" style={{ padding:'0 4px', display:'flex', alignItems:'center', gap:12 }}>
                    <Sprite name={h.passed?'i_check':'i_chest'}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:16, fontWeight:700 }}>{h.title}</div>
                      <div style={{ fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        ต้องได้ <Stars3 n={h.minStars}/> · ⏱ 1:30 ·
                        {h.passed ? (h.late?' ผ่านแล้ว (ส่งช้า)':' ผ่านแล้ว') : h.attempts ? <>ดีสุด <Stars3 n={h.best}/></> : ' ยังไม่ได้ทำ'}
                        {!h.passed && <span style={{ color: days<=1?'#FF9A8A':'#F5E6BE', fontWeight:700 }}>· {due}</span>}
                      </div>
                    </div>
                    <PxButton onClick={()=>onStartHomework&&onStartHomework(h)} style={{ fontSize:15 }}>
                      {h.passed?'ฝึกอีกครั้ง':h.attempts?'ลองอีกครั้ง':'เริ่มทำ'}</PxButton>
                  </div>
                );
              })}
              <PxButton onClick={()=>setView('map')} style={{ fontSize:15, alignSelf:'flex-start' }}>← กลับไปแผนที่</PxButton>
            </PxPanel>
          ) : (
            <>
              <div style={{ display:'flex', flexDirection:'column' }}>
                <div className="px-head" style={{ minHeight:58, display:'flex', alignItems:'center', justifyContent:'space-between',
                  marginBottom:-6, position:'relative', padding:'0 2px', gap:8 }}>
                  <button className="sp sp-i_left px-icon-btn" aria-label="ด่านก่อนหน้า" disabled={chIdx===0}
                    onClick={()=>gotoChapter(chIdx-1)} style={{ opacity: chIdx===0?.3:1 }}/>
                  <span style={{ fontSize:21, fontWeight:700, color:'#FFF6D8', textShadow:'2px 2px 0 #2B4A3A', textAlign:'center' }}>
                    ด่าน {ch.id} · {ch.title}</span>
                  <button className="sp sp-i_right px-icon-btn" aria-label="ด่านถัดไป" disabled={chIdx===CHAPTERS.length-1}
                    onClick={()=>gotoChapter(chIdx+1)} style={{ opacity: chIdx===CHAPTERS.length-1?.3:1 }}/>
                </div>
                <div className="px-panel" style={{ padding:'6px 12px 14px', display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ fontSize:15, fontWeight:600, textAlign:'center', color:'#5A3A22' }}>{ch.subtitle}</div>
                  {!stOpen && prevBoss && (
                    <div style={{ display:'flex', gap:10, alignItems:'center', background:'#F3E7C4', border:'3px dashed #8A6A48', padding:'8px 12px',
                      fontSize:14, fontWeight:600, lineHeight:1.6 }}>
                      <Sprite name="i_lock"/>
                      <span>ด่านนี้ยังปิดอยู่ — ชนะ <b>บท {prevBoss.num} {prevBoss.thaiName}</b> ของด่าน {chIdx} ก่อน
                        <br/>ทางลัด: Rush ขั้นสุดท้ายของบทนั้นให้ได้ 3 ดาว (หรือให้ครูปลดล็อกให้)</span>
                    </div>
                  )}
                  {/* Doors: one per lesson */}
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(chLessons.length,4)}, minmax(0, 1fr))`, gap:10 }}>
                    {chLessons.map(lesson=>{
                      const exs=getExercises(lesson);
                      const open=lessonAnyOpen(progress,lesson), done=lessonComplete(progress,lesson);
                      const got=exs.reduce((a,ex)=>a+progStars(progress,lesson,ex),0), max=exs.length*3;
                      const sel=selLesson&&selLesson.id===lesson.id;
                      return (
                        <button key={lesson.id} onClick={()=>setOpenLesson(lesson.id)} aria-pressed={sel}
                          aria-label={`บท ${lesson.num} ${lesson.thaiName}${open?'':' (ล็อก)'}`}
                          style={{ background: sel?'#F7EDCF':'transparent', border: sel?'3px solid '+INK:'3px solid transparent', cursor:'pointer',
                            fontFamily:TH_FONT, color:INK, padding:'6px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                          <span style={{ position:'relative', width:90, height:93, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Sprite name={open?'circle':'circle_dark'} style={{ position:'absolute', inset:0 }}/>
                            <Sprite name={open?'door_open':'door_lock'} style={{ position:'relative' }}/>
                            <span style={{ position:'absolute', top:2, left:4, fontFamily:PX_FONT, fontSize:20, fontWeight:700 }}>{lesson.num}</span>
                            {done && <Sprite name="i_check" style={{ position:'absolute', right:-4, bottom:0 }}/>}
                          </span>
                          <Stars3 n={max?Math.floor(got/max*3+1e-9):0}/>
                          <span style={{ fontSize:15, fontWeight:700, lineHeight:1.3 }}>{lesson.thaiName}</span>
                          <span style={{ fontFamily:PX_FONT, fontSize:14, fontWeight:700, color:'#6A4A30' }}>
                            ★ {got}/{max}{progress.cleared?.[lesson.id]?' · RUSH':''}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Steps of the selected lesson */}
                  {selLesson && (()=>{
                    const exs=getExercises(selLesson);
                    const cleared=!!progress.cleared?.[selLesson.id];
                    return (
                      <div className="px-wood" style={{ padding:'0 6px' }}>
                        <div style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>บท {selLesson.num} · {selLesson.thaiName}</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(84px, 1fr))', gap:8 }}>
                          {exs.map((ex,i)=>{
                            const stt=stepState(progress,selLesson,i);
                            const st=progStars(progress,selLesson,ex);
                            const hs=(highScores||{})[hsKey(selLesson.id,ex.title)];
                            const skipped=!st&&cleared&&i<exs.length-1;
                            return (
                              <button key={i} disabled={!stt.open} onClick={()=>stt.open&&onSelect(selLesson,ex)}
                                title={stt.open?(stt.rush?'Rush: ได้ 3 ดาว = ผ่านทั้งบท':ex.title):stt.reason}
                                style={{ background:'none', border:0, padding:'4px 0', cursor:stt.open?'pointer':'not-allowed', fontFamily:TH_FONT,
                                  color:'#F5E6BE', display:'flex', flexDirection:'column', alignItems:'center', gap:4, textAlign:'center' }}>
                                <span className={'sp sp-'+(stt.open?'slot':'slot_dark')} style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  <Sprite name={!stt.open?'i_lock':st?'i_check':'i_play'}/>
                                </span>
                                <Stars3 n={st}/>
                                <span style={{ fontSize:13, fontWeight:700, lineHeight:1.3 }}>{ex.title}</span>
                                {stt.rush && <span style={{ fontSize:12, fontWeight:700, color:'#FFC23D' }}>⚔️ Rush</span>}
                                {skipped && <span style={{ fontSize:12, fontWeight:600, color:'#BDE7B0' }}>ข้ามแล้ว</span>}
                                {hs>0 && <span style={{ fontFamily:PX_FONT, fontSize:13, fontWeight:700, color:'#F5D27A' }}>{fmtScore(hs)}</span>}
                                {!stt.open && <span style={{ fontSize:11, fontWeight:600, color:'#D9C49A' }}>{stt.reason}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Stage strip */}
              <div className="px-wood" style={{ padding:'2px 6px', overflowX:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(9, minmax(64px, 1fr))', gap:6 }}>
                  {CHAPTERS.map((c,i)=>{
                    const open=stageOpen(progress,c.id), done=stageDone(progress,c.id), sel=i===chIdx;
                    const {got,max}=stageStars(progress,c.id);
                    return (
                      <button key={c.id} onClick={()=>gotoChapter(i)} aria-label={`ด่าน ${c.id} ${c.title}${open?'':' (ล็อก)'}`} aria-pressed={sel}
                        style={{ background:'none', border:0, padding:'2px 0', cursor:'pointer', fontFamily:TH_FONT, color:'#F5E6BE',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:3, textAlign:'center' }}>
                        <span className={'sp sp-'+(open?'slot':'slot_dark')} style={{ display:'flex', alignItems:'center', justifyContent:'center',
                          fontFamily:PX_FONT, fontSize:20, fontWeight:700, color:INK,
                          outline: sel?'3px solid #FFC23D':'none', outlineOffset:2 }}>
                          {open ? c.id : <Sprite name="i_lock" style={{ transform:'scale(.75)' }}/>}
                        </span>
                        <span style={{ fontSize:11, fontWeight:600, lineHeight:1.25 }}>{c.title}</span>
                        {(open||got>0) && <span style={{ fontFamily:PX_FONT, fontSize:12, fontWeight:700, color: done?'#FFC23D':'#E8CF95' }}>★{got}/{max}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
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
  const tf="'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
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
