import { CHAPTERS, LESSONS } from '../data/lessons';
import { SCRIPT_URL } from '../config';
import { fmtScore, hsKey } from '../engine/scoring';
import { emptyProgress, lessonAnyOpen, lessonComplete, stageDone, stageOpen, stageStars, starsOf as progStars, stepState } from '../engine/progress';
import { ROOM_CODE_LEN, normalizeRoomCode } from '../firebase';
import { INK, PX_FONT, PxButton, PxPanel, Sprite, TH_FONT, useShortScreen } from '../ui/pixel';
import { TipTrigger } from '../ui/Guide';

const { useEffect, useRef, useState } = React;

// HOME — game lobby: character HUD, menu of green buttons, the current stage as doors
// (one door per lesson), the selected lesson's steps, and a strip of the 9 stages.

const SUB = { fontSize: 12, fontWeight: 600, opacity: .9, display: 'block', lineHeight: 1.3 };

// Star count as a small pixel badge (same style as the class-code badge): pixel star + number.
// Gold when every star is collected.
// small = compact version for the 9-stage strip: mini star + collected count only
// (the full got/max is in the tooltip and on each lesson door).
function StarBadge({ got, max, small }) {
  const full = max > 0 && got >= max;
  const label = `ได้ ${got} จาก ${max} ดาว`;
  const look = { border:'2px solid #3B2416',
    background: full ? '#FFC23D' : '#5A3A22', color: full ? '#3B2416' : '#FFF6D8',
    boxShadow: full ? 'inset -2px -2px 0 #D9922B, inset 2px 2px 0 #FFE08A' : 'inset -2px -2px 0 #3B2416, inset 2px 2px 0 #7A5233' };
  if (small) return (
    <span aria-label={label} title={label} style={{ ...look, display:'inline-flex', alignItems:'center', gap:2, lineHeight:1,
      padding:'2px 4px 2px 2px', maxWidth:'100%', boxSizing:'border-box', overflow:'hidden' }}>
      {/* star_s is 21 px; scale 2/3 → 14 px keeps pixels whole */}
      <span style={{ width:14, height:14, flex:'none', display:'inline-block' }} aria-hidden="true">
        <span className="sp sp-star_s" style={{ transform:'scale(.6667)', transformOrigin:'0 0' }}/>
      </span>
      <span style={{ fontFamily:PX_FONT, fontSize:8, fontWeight:400 }}>{got}</span>
    </span>
  );
  return (
    <span aria-label={label} style={{ ...look, display:'inline-flex', alignItems:'center', gap:4, lineHeight:1, padding:'3px 7px 3px 4px' }}>
      <span className="sp sp-star_s" style={{ flex:'none' }} aria-hidden="true"/>
      <span style={{ fontFamily:PX_FONT, fontSize:12, fontWeight:400 }}>{got}<span style={{ opacity:.7 }}>/{max}</span></span>
    </span>
  );
}

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
  const short = useShortScreen();
  // 1v1 / BR: first choose host or join; join asks for the room code
  const [mpPick, setMpPick] = useState(null);           // null | {mode:'1v1'|'royale', step:'choose'|'join'}
  useEffect(() => {
    if (!mpPick) return;
    const onKey = e => { if (e.key === 'Escape') setMpPick(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [!!mpPick]);

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
  // A brand-new player (no star yet) has nothing to "continue" — the button says "เริ่มเล่น" instead.
  const fresh = CHAPTERS.every(ch=>stageStars(progress,ch.id).got===0);

  const pendingHw = homework.filter(h=>!h.passed).length;
  const t = weekly?.test, me = weekly?.me;
  const weeklySub = !weekly ? 'กระดานอันดับของระดับชั้น'
    : !weekly.grade ? 'ห้องนี้ยังไม่มีภารกิจประจำสัปดาห์'
    : !t ? 'สัปดาห์นี้ครูยังไม่ได้ตั้งภารกิจ'
    : me ? `อันดับ ${me.rank} จาก ${weekly.total} คน` : 'ยังไม่ได้ทำ · จับเวลา 2 นาที';
  const badge = (txt) => <span style={{ position:'absolute', top:-10, right:-8, fontFamily:PX_FONT, fontSize:12, fontWeight:400,
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
    <div className="px-fill" style={{ fontFamily:TH_FONT, color:INK, display:'flex', flexDirection:'column', gap:'var(--fg)' }}>

      {/* ── HUD: character head + name, stage progress, character / stats buttons ── */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:14, flex:'none' }}>
        <button data-tour="char" onClick={()=>onOpenCharacter&&onOpenCharacter()} title="แต่งตัวละคร" aria-label="แต่งตัวละคร"
          style={{ position:'relative', background:'none', border:0, padding:0, cursor:'pointer', flexShrink:0,
            display:'flex', flexDirection:'column', alignItems:'center' }}>
          {window.CharKit && (
            <CharKit.CharCanvas config={character || CharKit.fromName(studentName || 'ผู้เล่น')} scale={short?2:3}
              style={{ marginBottom:-12, position:'relative' }}/>
          )}
          {/* small grass platform */}
          <span style={{ width:short?110:140, height:14, background:'#6BB05A', border:'3px solid '+INK, borderBottomWidth:0 }}/>
          <span style={{ width:short?110:140, height:10, background:'#8A5A32', border:'3px solid '+INK, borderTopWidth:0 }}/>
          {!character && <span style={{ position:'absolute', top:-6, right:-18, fontSize:12, fontWeight:700, background:'#FFC23D',
            border:'2px solid '+INK, padding:'0 6px', color:INK }}>สร้างตัวละคร</span>}
        </button>
        <div data-tour="char-info" style={{ display:'flex', flexDirection:'column', gap:6, minWidth:0, flex:'0 1 300px', alignSelf:'center' }}>
          {/* Name plate: wood 9-slice like the header bar, so the name reads on any part of the scene */}
          <div className="px-wood" style={{ display:'flex', flexDirection:'column', minWidth:0, maxWidth:'100%', alignSelf:'flex-start', padding:'0 6px', color:'#FFF6D8' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
              <span style={{ fontSize:short?20:26, fontWeight:700, lineHeight:1.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                textShadow:'2px 2px 0 #3B2416', minWidth:0 }} title={studentName || 'ผู้เล่นทดลอง'}>{studentName || 'ผู้เล่นทดลอง'}</span>
              {/* class code as a small pixel badge */}
              {classCode && <span aria-label={'ห้อง '+classCode} style={{ flex:'none', fontFamily:PX_FONT, fontSize:11, fontWeight:400, lineHeight:1,
                color:'#3B2416', background:'#FFC23D', border:'2px solid #3B2416', padding:'4px 6px 3px',
                boxShadow:'inset -2px -2px 0 #D9922B, inset 2px 2px 0 #FFE08A' }}>{classCode}</span>}
            </div>
            {!studentName && <span style={{ fontSize:12, fontWeight:600, color:'#E8CF95', whiteSpace:'nowrap' }}>ทดลองเล่น — ดาวและคะแนนจะไม่ถูกบันทึก</span>}
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {!studentName && SCRIPT_URL && <PxButton onClick={()=>onLogin&&onLogin()} style={{ fontSize:14, minHeight:'var(--hb)' }}>เข้าสู่ระบบเพื่อบันทึกผล</PxButton>}
            <PxButton onClick={()=>onOpenCharacter&&onOpenCharacter()} style={{ fontSize:14, minHeight:'var(--hb)' }}>{character?'แต่งตัวละคร':'สร้างตัวละคร'}</PxButton>
            {studentName && <PxButton onClick={()=>onViewStats&&onViewStats()} style={{ fontSize:14, minHeight:'var(--hb)' }}>สถิติของฉัน</PxButton>}
          </div>
        </div>
          {/* Stage strip */}
          <div data-tour="stages" className="px-wood" style={{ padding:'0 4px', flex:'1 1 520px', minWidth:0, alignSelf:'center' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(9, minmax(0, 1fr))', gap:4 }}>
              {CHAPTERS.map((c,i)=>{
                const open=stageOpen(progress,c.id), done=stageDone(progress,c.id), sel=i===chIdx;
                const {got,max}=stageStars(progress,c.id);
                return (
                  <button key={c.id} onClick={()=>gotoChapter(i)} aria-label={`ด่าน ${c.id} ${c.title}${open?'':' (ล็อก)'}`} aria-pressed={sel}
                    style={{ background:'none', border:0, padding:'2px 0', cursor:'pointer', fontFamily:TH_FONT, color:'#F5E6BE',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:3, textAlign:'center' }}>
                    <span className={'sp sp-'+(open?'slot':'slot_dark')+' px-z'} style={{ display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:PX_FONT, fontSize:16, fontWeight:400, color:INK,
                      outline: sel?'3px solid #FFC23D':'none', outlineOffset:2 }}>
                      {open ? c.id : <Sprite name="i_lock" style={{ transform:'scale(.75)' }}/>}
                    </span>
                    <span style={{ fontSize:11, fontWeight:600, lineHeight:1.25, minHeight:'2.5em' }}>{c.title}</span>
                    {(open||got>0) && <StarBadge got={got} max={max} small/>}
                  </button>
                );
              })}
            </div>
          </div>
      </div>

      <div style={{ display:'flex', gap:'var(--fg)', alignItems:'flex-start', flex:'1 1 auto', minHeight:0 }}>
        {/* ── Menu ── */}
        <div className="px-panel px-scroll" style={{ flex:'0 0 340px', maxHeight:'100%', padding:short?'2px 0 4px':'4px 0 8px', display:'flex', flexDirection:'column', gap:short?6:12 }}>
          <PxButton data-tour="continue" disabled={!next} onClick={()=>next&&onSelect(next.lesson,next.ex)} style={{ minHeight:short?52:68, fontSize:short?20:22, textAlign:'center', flex:'none' }}>
            ▶ {fresh?'เริ่มเล่น':'เล่นต่อ'}
            {next && <span style={SUB}>บท {next.lesson.num} · {next.ex.title}</span>}
          </PxButton>
          {studentName && SCRIPT_URL && (
            <PxButton data-tour="homework" color="blue" onClick={()=>setView(v=>v==='homework'?'map':'homework')} style={{ position:'relative', minHeight:short?44:52, flex:'none' }}>
              การบ้าน{pendingHw>0 && badge(pendingHw)}
              <span style={SUB}>{homework.length ? (pendingHw?`ค้าง ${pendingHw} ชิ้น`:'ส่งครบแล้ว') : 'ยังไม่มีการบ้าน'}</span>
            </PxButton>
          )}
          {studentName && SCRIPT_URL && (
            <PxButton data-tour="weekly" color="gold" onClick={()=>onOpenWeekly&&onOpenWeekly()} style={{ position:'relative', minHeight:short?44:52, flex:'none' }}>
              ภารกิจประจำสัปดาห์{t && !me && badge('ใหม่')}
              <span style={SUB}>{weeklySub}</span>
            </PxButton>
          )}
          <PxButton data-tour="race" color="red" onClick={()=>setMpPick({mode:'1v1',step:'choose'})} style={{ minHeight:short?44:52, flex:'none' }}>1 ปะทะ 1<span style={SUB}>ดวล 2 คน · ใครคะแนนมากกว่าชนะ</span></PxButton>
          <PxButton data-tour="race" color="purple" onClick={()=>setMpPick({mode:'royale',step:'choose'})} style={{ minHeight:short?44:52, flex:'none' }}>Battle Royale<span style={SUB}>แข่งทั้งห้อง · คนสุดท้ายที่รอดชนะ</span></PxButton>
        </div>

        {/* ── Right: homework list, or the current stage ── */}
        <div style={{ flex:'1 1 0', minWidth:0, minHeight:0, maxHeight:'100%', display:'flex', flexDirection:'column', gap:'var(--fg)' }}>
          {view==='homework' ? (
            <PxPanel title="การบ้าน" style={{ minHeight:0, flex:'0 1 auto' }} bodyStyle={{ padding:'6px 12px 12px', display:'flex', flexDirection:'column', gap:10, overflowY:'auto', minHeight:0 }}>
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
              <div data-tour="stage" style={{ display:'flex', flexDirection:'column', minHeight:0, flex:'0 1 auto' }}>
                <div style={{ minHeight:'var(--hh)', flex:'none', display:'flex', alignItems:'center', justifyContent:'space-between',
                  marginBottom:-3, position:'relative', padding:'0 6px', gap:8, zIndex:1,
                  // each stage has its own color (stages.js from/to)
                  background:`linear-gradient(180deg, ${ch.to} 0%, ${ch.from} 100%)`, border:'3px solid '+INK,
                  boxShadow:'inset 0 3px 0 rgba(255,255,255,.35), inset 0 -4px 0 rgba(0,0,0,.22)' }}>
                  <button className="sp sp-i_left px-icon-btn px-z" aria-label="ด่านก่อนหน้า" disabled={chIdx===0}
                    onClick={()=>gotoChapter(chIdx-1)} style={{ opacity: chIdx===0?.3:1 }}/>
                  <span style={{ fontSize:short?18:21, fontWeight:700, color:'#FFFFFF', textShadow:'2px 2px 0 rgba(0,0,0,.45)', textAlign:'center' }}>
                    {ch.icon} ด่าน {ch.id} · {ch.title}</span>
                  <button className="sp sp-i_right px-icon-btn px-z" aria-label="ด่านถัดไป" disabled={chIdx===CHAPTERS.length-1}
                    onClick={()=>gotoChapter(chIdx+1)} style={{ opacity: chIdx===CHAPTERS.length-1?.3:1 }}/>
                </div>
                <div className="px-scroll" style={{ padding:short?'6px 10px 8px':'10px 12px 14px', display:'flex', flexDirection:'column', gap:short?8:14,
                  border:'3px solid '+INK, borderTop:0, background:`linear-gradient(180deg, ${ch.to}40 0%, #FFF8E6 70%)` }}>
                  <div style={{ fontSize:short?14:15, fontWeight:700, textAlign:'center', color:ch.from }}>{ch.subtitle}</div>
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
                      const isNext=open&&next&&next.lesson.id===lesson.id;      // where "เล่นต่อ" would go
                      return (
                        <button key={lesson.id} onClick={()=>setOpenLesson(lesson.id)} aria-pressed={sel}
                          aria-label={`บท ${lesson.num} ${lesson.thaiName}${open?'':' (ล็อก)'}`}
                          style={{ background: !open?'rgba(255,255,255,.25)':sel?'#FFFFFF':'rgba(255,255,255,.6)',
                            border:'3px solid '+(sel?INK:open?ch.from+'66':'transparent'),
                            boxShadow: sel?`0 0 0 3px ${ch.to}, 0 4px 0 rgba(59,36,22,.25)`:'none',
                            filter: open?'none':'grayscale(.9)', opacity: open?1:.75, cursor:'pointer',
                            fontFamily:TH_FONT, color:INK, padding:short?'2px 4px':'6px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:short?2:4 }}>
                          <span className={'px-z'+(isNext?' px-bob':'')} style={{ position:'relative', width:90, height:93, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Sprite name={open?'circle':'circle_dark'} style={{ position:'absolute', inset:0 }}/>
                            <Sprite name={open?'door_open':'door_lock'} style={{ position:'relative' }}/>
                            <span style={{ position:'absolute', top:2, left:4, fontFamily:PX_FONT, fontSize:16, fontWeight:400 }}>{lesson.num}</span>
                            {done && <Sprite name="i_check" style={{ position:'absolute', right:-4, bottom:0 }}/>}
                          </span>
                          <Stars3 n={max?Math.floor(got/max*3+1e-9):0}/>
                          <span style={{ fontSize:15, fontWeight:700, lineHeight:1.3 }}>{lesson.thaiName}</span>
                          <span style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
                            <StarBadge got={got} max={max}/>
                            {progress.cleared?.[lesson.id] && <span style={{ fontFamily:PX_FONT, fontSize:10, fontWeight:400, lineHeight:1,
                              color:'#FFF6D8', background:'#D9452F', border:'2px solid #3B2416', padding:'4px 5px 3px' }}>RUSH</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Steps of the selected lesson (a locked stage shows only its doors + how to open it) */}
                  {selLesson && stOpen && (()=>{
                    const exs=getExercises(selLesson);
                    const cleared=!!progress.cleared?.[selLesson.id];
                    return (
                      <div style={{ padding:short?'4px 8px 6px':'8px 10px 10px', background:'#FFFDF5', border:'3px solid '+INK,
                        boxShadow:'0 4px 0 rgba(59,36,22,.2)' }}>
                        <div style={{ fontSize:short?14:16, fontWeight:700, marginBottom:short?2:8, color:ch.from }}>บท {selLesson.num} · {selLesson.thaiName}</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(84px, 1fr))', gap:8 }}>
                          {exs.map((ex,i)=>{
                            const stt=stepState(progress,selLesson,i);
                            const st=progStars(progress,selLesson,ex);
                            const hs=(highScores||{})[hsKey(selLesson.id,ex.title)];
                            const skipped=!st&&cleared&&i<exs.length-1;
                            const isNext=next&&next.lesson.id===selLesson.id&&next.ex===ex;
                            return (
                              <button key={i} disabled={!stt.open} onClick={()=>stt.open&&onSelect(selLesson,ex)}
                                title={stt.open?(stt.rush?'Rush: ได้ 3 ดาว = ผ่านทั้งบท':ex.title):stt.reason}
                                style={{ background:'none', border:0, padding:'4px 0', cursor:stt.open?'pointer':'not-allowed', fontFamily:TH_FONT,
                                  color:INK, display:'flex', flexDirection:'column', alignItems:'center', gap:4, textAlign:'center', opacity:stt.open?1:.6 }}>
                                <span className={'sp sp-'+(stt.open?'slot':'slot_dark')+' px-z'+(isNext?' px-bob':'')} style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
                                  <Sprite name={!stt.open?'i_lock':st?'i_check':'i_play'}/>
                                </span>
                                <Stars3 n={st}/>
                                <span style={{ fontSize:13, fontWeight:700, lineHeight:1.3 }}>{ex.title}</span>
                                {stt.rush && <><span style={{ fontSize:12, fontWeight:700, color:'#B45309' }}>⚔️ Rush</span><TipTrigger id="rush"/></>}
                                {skipped && <span style={{ fontSize:12, fontWeight:600, color:'#15803D' }}>ข้ามแล้ว</span>}
                                {hs>0 && <span style={{ fontFamily:PX_FONT, fontSize:12, fontWeight:400, color:'#A16207' }}>{fmtScore(hs)}</span>}
                                {!stt.open && <span style={{ fontSize:11, fontWeight:600, color:'#8C6E4E' }}>{stt.reason}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

            </>
          )}
        </div>
      </div>
      {/* Host or join — 1v1 / Battle Royale */}
      {mpPick && (()=>{
        const isBR = mpPick.mode==='royale', col = isBR?'purple':'red', title = isBR?'Battle Royale':'1 ปะทะ 1';
        const canJoin = joinCode && joinCode.length===ROOM_CODE_LEN && !mpBusy;
        const big = { minHeight:short?64:76, fontSize:short?18:20, textAlign:'center', width:'100%' };
        return (
          <div role="dialog" aria-modal="true" aria-label={title} onClick={()=>setMpPick(null)}
            style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(20,30,40,.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div onClick={e=>e.stopPropagation()} style={{ width:'100%', maxWidth:440 }}>
              <PxPanel title={title} bodyStyle={{ padding:'8px 14px 14px', display:'flex', flexDirection:'column', gap:12 }}>
                {mpPick.step==='choose' ? (<>
                  <PxButton color={col} onClick={()=>{ setMpPick(null); onOpenSetup&&onOpenSetup(mpPick.mode); }} style={big}>
                    🏠 สร้างห้อง (Host)<span style={SUB}>เลือกด่าน ตั้งค่า แล้วให้เพื่อนใส่รหัสห้อง</span></PxButton>
                  <PxButton color={col} autoFocus onClick={()=>setMpPick({...mpPick,step:'join'})} style={big}>
                    🔑 เข้าร่วมห้อง<span style={SUB}>มีรหัสห้องจากเพื่อนแล้ว</span></PxButton>
                  <PxButton onClick={()=>setMpPick(null)} style={{ fontSize:15, minHeight:'var(--hb)' }}>ยกเลิก</PxButton>
                </>) : (<>
                  <label htmlFor="join-code" style={{ fontSize:15, fontWeight:700, textAlign:'center' }}>ใส่รหัสห้องจากเพื่อน ({ROOM_CODE_LEN} ตัว)</label>
                  <input id="join-code" autoFocus value={joinCode||''} onChange={e=>setJoinCode&&setJoinCode(normalizeRoomCode(e.target.value))}
                    onKeyDown={e=>e.key==='Enter'&&canJoin&&onJoin&&onJoin(joinCode)} placeholder="A7K2M" maxLength={ROOM_CODE_LEN}
                    autoComplete="off" spellCheck={false}
                    style={{ width:'100%', fontFamily:PX_FONT, fontSize:26, letterSpacing:6, textAlign:'center', padding:'8px 10px', minHeight:60,
                      boxSizing:'border-box', background:'#FFF9E6', border:'3px solid '+INK, color:INK, outline:'none' }}/>
                  {joinError && <div role="alert" style={{ fontSize:14, fontWeight:700, color:'#B3261E', textAlign:'center' }}>{joinError}</div>}
                  <div style={{ display:'flex', gap:10 }}>
                    <PxButton onClick={()=>setMpPick({...mpPick,step:'choose'})} style={{ flex:1, fontSize:15 }}>← กลับ</PxButton>
                    <PxButton color={col} onClick={()=>onJoin&&onJoin(joinCode)} disabled={!canJoin} style={{ flex:2, fontSize:17 }}>
                      {mpBusy?'กำลังเข้า...':'เข้าห้อง'}</PxButton>
                  </div>
                </>)}
              </PxPanel>
            </div>
          </div>
        );
      })()}
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
