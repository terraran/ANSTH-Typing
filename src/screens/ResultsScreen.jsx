import { currentFirebaseUid } from '../firebase';
import { PRESSURE_SECS, fmtScore, pctOf, starsFor } from '../engine/scoring';
import { Stars, StatPill } from '../ui/common';
import { brOrder, isOutState, playerState } from '../race/presence';

import { PxButton, Sprite } from '../ui/pixel';

const { useEffect, useRef, useState } = React;

// 1v1 RESULT — decided by score; equal score → whoever finished the text first

export function duelOutcome(roomPlayers, myScore, waited, sNow=Date.now()) {
  const uid=currentFirebaseUid();
  const racers=Object.entries(roomPlayers||{}).filter(([,p])=>!p.isSpectator);
  const me=racers.find(([k,p])=>k===uid||p.uid===uid)?.[1]||{};
  const rv=racers.find(([k,p])=>k!==uid&&p.uid!==uid)?.[1]||null;
  const rvScore=Number(rv?.score)||0;
  // The opponent left on purpose, or dropped and did not come back in time → I win.
  const rvOut=!!rv && isOutState(playerState(rv,'1v1',sNow));
  const settled=!rv || rvOut || rv.status==='done' || waited;
  let outcome='wait';
  if (settled) {
    if (!rv || rvOut) outcome='win';
    else if (myScore!==rvScore) outcome=myScore>rvScore?'win':'lose';
    else {
      // finishedAt > 0 means that player typed the whole text
      const a=Number(me.finishedAt)||0, b=Number(rv.finishedAt)||0;
      if (a&&b) outcome=a===b?'draw':a<b?'win':'lose';
      else if (a) outcome='win';
      else if (b) outcome='lose';
      else outcome='draw';
    }
  }
  return {outcome,rvName:rv?.name||'คู่แข่ง',rvScore,rvLeft:rvOut,tie:settled&&!!rv&&!rvOut&&myScore===rvScore};
}

// RESULT STAGE — who stands on the podium and in which pose (Phase 3)

export function resultStage({ roomType, roomCode, roomPlayers, myCfg, myName, duel, soloBest, brRows }) {
  if (!window.CharKit || !myCfg) return null;
  const uid=currentFirebaseUid();
  const me={id:'me',cfg:myCfg,label:'คุณ',me:true};
  const KEEP='💪 สู้ใหม่!';
  if (duel) {
    const rv=Object.entries(roomPlayers||{}).find(([k,p])=>!p.isSpectator&&k!==uid&&p.uid!==uid);
    const rival={id:rv?.[0]||'rival',cfg:rv?CharKit.fromPlayer(rv[1]):CharKit.fromName(duel.rvName),label:duel.rvName};
    const o=duel.outcome;
    if (o==='win')  return {confetti:true, actors:[{...me,pose:'cheer',level:2},{...rival,pose:'sad',level:1,color:'#E79035'}]};
    if (o==='lose') return {confetti:false,actors:[{...me,pose:'sad',level:1,color:'#347ED0',note:KEEP},{...rival,pose:'cheer',level:2}]};
    if (o==='draw') return {confetti:true, actors:[{...me,pose:'cheer',level:2},{...rival,pose:'cheer',level:2}]};
    return {confetti:false,actors:[{...me,pose:'idle',level:1,color:'#347ED0'},{...rival,pose:'idle',level:1,color:'#E79035'}]};
  }
  if (roomCode && roomType==='royale') {
    const order=brRows||brOrder(roomPlayers);
    const myRank=order.findIndex(([k,p])=>k===uid||p.uid===uid)+1;
    if (myRank===1) return {confetti:true,actors:[{...me,pose:'cheer',level:2,label:'🥇 คุณ'}]};
    const top=order[0];
    const winner=top?{id:top[0],cfg:CharKit.fromPlayer(top[1]),label:'🥇 '+(top[1].name||'ผู้ชนะ'),pose:'cheer',level:2}:null;
    const mine={...me,pose:'sad',level:1,label:myRank>0?`อันดับ ${myRank}`:'คุณ',note:KEEP,color:'#64748B'};
    return {confetti:false,actors:winner?[winner,mine]:[mine]};
  }
  // Solo practice / weekly test: no "losing" alone — cheer on a personal best, otherwise idle.
  return {confetti:!!soloBest,actors:[{...me,pose:soloBest?'cheer':'idle',level:soloBest?2:1,
    label:soloBest?'🏆 สถิติใหม่!':'คุณ',color:soloBest?undefined:'#347ED0'}]};
}

// RESULTS SCREEN

// Three pixel stars like a game's WIN screen: the middle one bigger.
function BigStars({ n }) {
  return (
    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'center',gap:4}} aria-label={`${n} ดาว`}>
      <Sprite name={n>=1?'star_m':'star_m_off'} style={{marginBottom:6}}/>
      <Sprite name={n>=2?'star_l':'star_l_off'}/>
      <Sprite name={n>=3?'star_m':'star_m_off'} style={{marginBottom:6}}/>
    </div>
  );
}

export function ResultsScreen({ cpm, accuracy, errors, totalChars, lesson, saveStatus, saveError, studentName, ghostData, newRecord, roomCode, roomType, roomPlayers, myName, myCfg, bestCombo, score, maxScore, isTest, testBoard, prevBest, sOffset=0, brFinal, onDuelSettled, onRestart, onBack, curResult, nextStep, onNext, hwResult }) {
  const tf="'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
  const isDuel = roomType==='1v1' && !!roomCode;
  const [waited, setWaited] = useState(false);
  useEffect(()=>{
    if (!isDuel) return;
    // If the opponent disconnects, settle the result after the grace period anyway.
    const t=setTimeout(()=>setWaited(true),(PRESSURE_SECS+6)*1000);
    return ()=>clearTimeout(t);
  },[isDuel]);
  // Once the winner is decided it is locked: players leaving the room afterwards
  // cannot change it.
  const lockedDuel = useRef(null);
  let duel = null;
  if (isDuel) {
    duel = lockedDuel.current || duelOutcome(roomPlayers, score, waited, Date.now()+sOffset);
    if (!lockedDuel.current && duel.outcome!=='wait') lockedDuel.current = duel;
  }
  const settledSent = useRef(false);
  useEffect(()=>{
    if (isDuel && lockedDuel.current && !settledSent.current && onDuelSettled) {
      settledSent.current = true; onDuelSettled(lockedDuel.current);
    }
  });
  // Battle Royale: the order is locked by the app 2 s after the end.
  const brRows = roomType==='royale' && roomCode ? (brFinal || brOrder(roomPlayers, Date.now()+sOffset)) : null;

  const grade =
    accuracy>=98&&cpm>=40 ? {label:'ยอดเยี่ยม 🏆',color:'#D97706'} :
    accuracy>=95&&cpm>=25 ? {label:'ดีมาก ⭐',     color:'#2563EB'} :
    accuracy>=90           ? {label:'ดี 👍',         color:'#059669'} :
                             {label:'ฝึกต่อ 💪',    color:'#7C3AED'};
  const headline = isTest ? 'หมดเวลาแล้ว!' : 'เสร็จแล้ว!';
  // Personal best: practice → beat the previous high score; weekly test → this attempt is my best.
  const soloBest = !roomCode && (isTest
    ? (saveStatus==='saved' && !!testBoard?.me && score>0 && score>=testBoard.me.score)
    : (score>0 && score>prevBest));
  const stage = resultStage({ roomType, roomCode, roomPlayers, myCfg, myName, duel, soloBest, brRows });
  return (
    <div style={{textAlign:'center',fontFamily:tf}}>
      {stage ? (
        <CharKit.ResultStage actors={stage.actors} confetti={stage.confetti} style={{marginBottom:6}}/>
      ) : (
      <div style={{fontSize:52,marginBottom:8}}>
        {duel ? (duel.outcome==='win'?'🏆':duel.outcome==='lose'?'💪':duel.outcome==='draw'?'🤝':'⏳')
          : accuracy>=95?'🎉':accuracy>=85?'👏':'💪'}</div>
      )}
      <h2 style={{fontSize:26,fontWeight:800,color:'var(--c-t1)',marginBottom:4}}>{headline}</h2>
      <div style={{color:grade.color,fontWeight:800,fontSize:18,marginBottom:12}}>
        {grade.label}
      </div>

      {/* 1v1 — winner by score */}
      {duel && (()=>{
        const tone = duel.outcome==='win'?{bg:'#D1FAE5',bd:'#059669',fg:'#065F46'}
          : duel.outcome==='lose'?{bg:'#FEF3C7',bd:'#F59E0B',fg:'#92400E'}
          : {bg:'#EFF6FF',bd:'#2563EB',fg:'#1E3A8A'};
        const title = duel.outcome==='wait' ? `⏳ รอคู่แข่งพิมพ์ให้จบ (ไม่เกิน ${PRESSURE_SECS} วินาที)...`
          : duel.outcome==='win' ? '🏆 คุณชนะ!'
          : duel.outcome==='lose' ? `${duel.rvName} ชนะ — สู้ใหม่ได้!`
          : '🤝 เสมอ!';
        const box = (label,value,lead,color) => (
          <div style={{flex:1,maxWidth:200,borderRadius:12,padding:'10px 12px',
            background:lead?'#fff':'transparent',border:`1.5px solid ${lead?color:'transparent'}`}}>
            <div style={{fontSize:12,fontWeight:700,color:'#475569',whiteSpace:'nowrap',
              overflow:'hidden',textOverflow:'ellipsis'}}>{lead?'👑 ':''}{label}</div>
            <div style={{fontSize:30,fontWeight:800,color,lineHeight:1.2}}>{fmtScore(value)}</div>
          </div>
        );
        const settled = duel.outcome!=='wait';
        return (
          <div style={{marginBottom:18,padding:'14px 16px',borderRadius:14,
            background:tone.bg,border:`1.5px solid ${tone.bd}`}}>
            <div style={{fontSize:18,fontWeight:800,color:tone.fg,marginBottom:8}}>{title}</div>
            <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:10}}>
              {box('คุณ',score,settled&&duel.outcome==='win','#347ED0')}
              <span style={{fontSize:14,fontWeight:800,color:'#64748B'}}>vs</span>
              {box(duel.rvName,duel.rvScore,settled&&duel.outcome==='lose','#E79035')}
            </div>
            {duel.rvLeft && (
              <div style={{fontSize:12,color:tone.fg,marginTop:6}}>🚪 คู่แข่งออกจากการแข่งขัน</div>
            )}
            {duel.tie && duel.outcome!=='draw' && (
              <div style={{fontSize:12,color:tone.fg,marginTop:6}}>คะแนนเท่ากัน — คนที่พิมพ์จบก่อนชนะ</div>
            )}
          </div>
        );
      })()}

      {/* Solo score / weekly test */}
      {!roomCode && (
        <div className="px-wood" style={{marginBottom:18,padding:'0 8px',color:'#F5E6BE'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#E8CF95',letterSpacing:1}}>
            {isTest?'คะแนนภารกิจประจำสัปดาห์':'คะแนนรอบนี้'}</div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            <Sprite name="i_coin"/>
            <span style={{fontFamily:"'Press Start 2P', monospace",fontSize:32,fontWeight:400,color:'#F5D27A',lineHeight:1.2}}>{fmtScore(score)}</span>
          </div>
          {isTest ? (
            <div style={{marginTop:4}}>
              <Stars n={starsFor(score,maxScore)} size={26}/>
              <div style={{fontSize:12,color:'#64748B',marginTop:4}}>
                {pctOf(score,maxScore)}% ของคะแนนเป้าหมาย {fmtScore(maxScore)}
              </div>
              <div style={{marginTop:10,fontSize:15,fontWeight:800,color:'#4C1D95'}}>
                {saveStatus==='saving' && '💾 กำลังส่งคะแนน...'}
                {saveStatus==='error' && <span style={{color:'#DC2626'}}>⚠️ {saveError||'ส่งคะแนนไม่สำเร็จ — ตรวจสัญญาณ'}</span>}
                {saveStatus==='saved' && testBoard?.me && (
                  <>🏆 อันดับ {testBoard.me.rank} จาก {testBoard.total} คนใน {testBoard.grade} สัปดาห์นี้</>
                )}
              </div>
              {saveStatus==='saved' && testBoard?.me && testBoard.me.score>score && (
                <div style={{fontSize:12,color:'#64748B',marginTop:2}}>
                  นับครั้งที่ดีที่สุดของคุณ ({fmtScore(testBoard.me.score)} คะแนน)
                </div>
              )}
            </div>
          ) : (
            <div style={{fontSize:14,fontWeight:700,marginTop:6,
              color:score>prevBest?'#9BE39A':'#E8CF95'}}>
              {score>prevBest
                ? (prevBest>0 ? `🎉 สถิติใหม่! (เดิม ${fmtScore(prevBest)})` : '🏆 High Score แรกของแบบฝึกนี้!')
                : `🏆 High Score: ${fmtScore(prevBest)} — ขาดอีก ${fmtScore(prevBest-score+1)} คะแนน`}
            </div>
          )}
        </div>
      )}
      {/* Curriculum step: stars from accuracy + speed vs the stage target (Thai words/min) */}
      {curResult && (()=>{
        const { stars, prevStars, wpm, target, net, accuracy:acc, rush, cleared } = curResult;
        const tip = stars===0 ? `ต้องแม่นยำอย่างน้อย 90% จึงได้ ⭐ (รอบนี้ ${acc}%) — ค่อย ๆ พิมพ์ให้ถูกก่อน`
          : stars===1 ? `อีกนิด! พิมพ์ให้ได้ ${target} คำ/นาที เพื่อรับ ⭐⭐`
          : stars===2 ? `เก่งมาก! ${Math.round(target*1.5*10)/10} คำ/นาที และแม่นยำ 95% ขึ้นไป = ⭐⭐⭐`
          : 'สุดยอด! ได้ครบ 3 ดาว';
        return (
          <div style={{marginBottom:18,padding:'14px 18px',background:'#F8EED2',
            border:'3px solid #3B2416',fontFamily:tf}}>
            <BigStars n={stars}/>
            <div style={{fontSize:15,fontWeight:800,color:'#14532D',marginTop:4}}>
              {net?'คำสุทธิ':'ความเร็ว'} {wpm} คำ/นาที · เป้าด่านนี้ {target} คำ/นาที</div>
            <div style={{fontSize:12,color:'#166534',marginTop:2}}>{tip}</div>
            {stars>prevStars&&prevStars>0&&<div style={{fontSize:12,fontWeight:800,color:'#B45309',marginTop:4}}>🎉 ดาวเพิ่มจาก {prevStars} เป็น {stars}</div>}
            {cleared&&<div style={{fontSize:14,fontWeight:800,color:'#B45309',marginTop:6}}>⚔️ Rush สำเร็จ! ผ่านบท {lesson?.num} ทั้งบท — ขั้นก่อนหน้าและบทถัดไปเปิดแล้ว</div>}
            {rush&&!cleared&&<div style={{fontSize:12,fontWeight:700,color:'#B45309',marginTop:6}}>⚔️ Rush ต้องได้ ⭐⭐⭐ จึงจะข้ามทั้งบทได้ — หรือเล่นไล่จากขั้นแรกของบทก็ได้</div>}
            {net&&<div style={{fontSize:11,color:'var(--c-t3)',marginTop:4}}>คำสุทธิ = (จำนวนครั้งที่กดแป้น ÷ 4 − จำนวนครั้งที่ผิด) ÷ นาที</div>}
          </div>
        );
      })()}
      {/* Homework: pass when the stars reach the teacher's minimum */}
      {hwResult && (()=>{
        const { stars, minStars, passed, late, wpm, target, net, accuracy:acc } = hwResult;
        const need = minStars===1 ? `แม่นยำอย่างน้อย 90%`
          : minStars===2 ? `แม่นยำ 90% ขึ้นไป และพิมพ์ได้ ${target} คำ/นาที`
          : `แม่นยำ 95% ขึ้นไป และพิมพ์ได้ ${Math.round(target*1.5*10)/10} คำ/นาที`;
        return (
          <div style={{marginBottom:18,padding:'14px 18px',borderRadius:14,fontFamily:tf,
            background:passed?'#F0FDF4':'#FFFBEB',border:`1.5px solid ${passed?'#22C55E':'#F59E0B'}`}}>
            <div style={{fontSize:12,fontWeight:800,color:passed?'#166534':'#B45309',letterSpacing:1}}>📚 การบ้าน</div>
            {passed ? <BigStars n={stars}/> : <Sprite name="xmark" label="ยังไม่ผ่าน"/>}
            <div style={{fontSize:18,fontWeight:800,color:passed?'#14532D':'#92400E',marginTop:4}}>
              {passed ? (late ? '✅ ผ่านแล้ว (ส่งช้า)' : '✅ ผ่านแล้ว! ส่งการบ้านเรียบร้อย') : `ยังไม่ผ่าน — ต้องได้ ${'⭐'.repeat(minStars)}`}
            </div>
            <div style={{fontSize:13,color:'var(--c-t2)',marginTop:4}}>
              {net?'คำสุทธิ':'ความเร็ว'} {wpm} คำ/นาที · แม่นยำ {acc}%{!passed&&<> · เกณฑ์: {need}</>}
            </div>
            {!passed&&<div style={{fontSize:12,color:'#B45309',marginTop:4}}>ลองใหม่ได้ไม่จำกัด ระบบนับครั้งที่ผ่าน</div>}
            {saveStatus==='saving'&&<div style={{fontSize:12,color:'var(--c-t3)',marginTop:6}}>💾 กำลังส่งการบ้าน...</div>}
            {saveStatus==='error'&&<div style={{fontSize:12,fontWeight:700,color:'#DC2626',marginTop:6}}>⚠️ ส่งไม่สำเร็จ: {saveError||'ตรวจสอบสัญญาณ'} — ลองทำอีกครั้ง</div>}
          </div>
        );
      })()}
      {/* Ghost comparison — by score (same rule as High Score) */}
      {(ghostData || newRecord) && (()=>{
        const gs = ghostData ? (ghostData.score||0) : 0;
        const tone = !ghostData ? ['#EDE9FE','#8B5CF6']
          : score > gs ? ['#D1FAE5','#059669']
          : score === gs ? ['#EFF6FF','#2563EB']
          : ['#EDE9FE','#8B5CF6'];
        return (
        <div style={{marginBottom:22,padding:'12px 20px',borderRadius:12,
          background:tone[0], border:`1.5px solid ${tone[1]}`,
          fontFamily:tf, fontSize:15, fontWeight:700, color:'#0F172A',
        }}>
          {!ghostData
            ? `👻 บันทึก Ghost แล้ว! (${fmtScore(score)} คะแนน) — ลองแข่งรอบหน้า`
            : score > gs
            ? `🏆 ชนะ Ghost! ${fmtScore(score)} vs ${fmtScore(gs)} คะแนน${newRecord ? ' — สถิติใหม่! 🎉' : ''}`
            : score === gs
            ? `🤝 เสมอกับ Ghost! (${fmtScore(score)} คะแนน)`
            : `👻 Ghost ชนะ — ${fmtScore(gs)} vs ${fmtScore(score)} คะแนน — สู้ต่อไป!`}
        </div>
        );
      })()}
      <div style={{display:'flex',gap:14,justifyContent:'center',marginBottom:24,flexWrap:'wrap'}}>
        <StatPill label="KPM"       value={cpm}              color={cpm>=30?'#059669':'#D97706'}/>
        {lesson?.curriculum
          ? <StatPill label="คำ/นาที (ไทย)" value={Math.round(cpm/4)} color="#2563EB"/>
          : <StatPill label="WPM"       value={Math.round(cpm/5)} color="#2563EB"/>}
        <StatPill label="ความแม่น" value={`${accuracy}%`}   color={accuracy>=95?'#059669':'#D97706'}/>
        <StatPill label="ผิด"       value={errors}           color={errors===0?'#059669':'#EF4444'}/>
        <StatPill label="ตัวอักษร" value={totalChars}/>
        {(isDuel||isTest)&&<StatPill label="คอมโบสูงสุด" value={`${bestCombo||0} 🔥`} color="#8B5CF6"/>}
      </div>
      <div style={{background:'#F1F5F9',borderRadius:12,height:10,marginBottom:22,overflow:'hidden'}}>
        <div style={{width:`${accuracy}%`,height:'100%',borderRadius:12,
          background:accuracy>=95?'#059669':accuracy>=85?'#2563EB':'#F59E0B',
          transition:'width 1s ease-out'}}/>
      </div>
      {/* Battle Royale standings */}
      {roomCode && roomType==='royale' && Object.keys(roomPlayers||{}).length > 0 && (
        <div style={{background:'var(--c-surf)',border:'1.5px solid var(--c-border)',borderRadius:12,
          padding:'14px 16px',marginBottom:20,textAlign:'left'}}>
          <div style={{fontSize:13,fontWeight:800,marginBottom:10,fontFamily:tf}}>
            🏆 Battle Royale — ผลการแข่ง</div>
          {brRows
            .map(([key,p],i)=>(
              <div key={key} style={{display:'flex',alignItems:'center',gap:10,
                padding:'8px 0',borderBottom:'1px solid var(--c-border)'}}>
                <span style={{fontSize:18,width:28}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':'  '}</span>
                <span style={{flex:1,fontFamily:tf,fontWeight:700,
                  color:(p.name||key)===(myName||'ผู้เล่น1')?'#059669':'var(--c-t1)',fontSize:14}}>
                  {p.name||key}
                  {p.status==='done'&&' 🏁'}
                  {p.status==='eliminated'&&' 💀'}
                  {(p.status==='left'||p.status==='disconnected')&&' 🚪'}
                </span>
                <span style={{fontSize:13,color:'var(--c-t2)'}}>{p.cpm||0} KPM</span>
              </div>
            ))}
        </div>
      )}
      <div style={{display:'flex',gap:12,justifyContent:'center',flexWrap:'wrap'}}>
        {nextStep&&(
          <PxButton onClick={onNext} style={{fontSize:16}}>
            ขั้นต่อไป: {nextStep.lesson.num!==lesson?.num?`บท ${nextStep.lesson.num} · `:''}{nextStep.exercise.title} ▶
          </PxButton>
        )}
        <PxButton onClick={onRestart} style={{fontSize:16}}>
          {isTest?'↻ ทำภารกิจอีกครั้ง':hwResult?'↻ ทำการบ้านอีกครั้ง':roomCode?'ออกจากห้อง':'↻ เล่นอีกครั้ง'}
        </PxButton>
        <PxButton onClick={onBack} style={{fontSize:16}}>
          {isTest?'ดูกระดานอันดับ':'กลับหน้าหลัก'}
        </PxButton>
      </div>
      {studentName && !isTest && (
        <div style={{marginTop:18,fontSize:12,color:'var(--c-t3)',fontFamily:tf}}>
          {saveStatus==='saving' && '💾 กำลังบันทึกผล...'}
          {saveStatus==='saved'  && '✅ บันทึกผลแล้ว'}
          {saveStatus==='error'  && '⚠️ บันทึกไม่ได้ — ตรวจสอบสัญญาณ'}
        </div>
      )}
    </div>
  );
}
