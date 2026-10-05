import { BR_DIFFICULTIES, CHAPTERS, LESSONS, difficultyOf } from '../data/lessons';
import { PRESSURE_SECS } from '../engine/scoring';
import { currentFirebaseUid } from '../firebase';
import { raceRunners } from './Hud';

const { useState } = React;

// MULTIPLAYER SETUP — game lobby style

export function MPSetupScreen({ mode, onSelect, onBack, busy }) {
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
  const isRoyale = mode==='royale';
  const [pickedLesson, setPickedLesson] = useState(null);

  const MODE = isRoyale
    ? { label:'BATTLE ROYALE', icon:'🏆', from:'#92400E', to:'#D97706', hint:'เลือก Arena ที่จะแข่งขัน' }
    : { label:'1 vs 1',        icon:'⚔️', from:'#1E3A8A', to:'#2563EB', hint:'เลือก Arena ที่จะแข่งขัน · ชนะด้วยคะแนน' };

  if (isRoyale && pickedLesson) {
    return (
      <div style={{fontFamily:tf}}>
        <div className="px-wood" style={{padding:'4px 8px',marginBottom:20,
          position:'relative',textAlign:'center',color:'#F5E6BE'}}>
          <button onClick={()=>setPickedLesson(null)} className="px-btn"
            style={{position:'absolute',top:0,left:0,minHeight:40,padding:'0 4px',fontSize:14,fontFamily:tf}}>← กลับ</button>
          <div style={{fontSize:34,marginBottom:6}}>💀</div>
          <div style={{fontFamily:"'Press Start 2P', monospace",fontSize:12,color:'#E8CF95',fontWeight:400,letterSpacing:1,marginBottom:3}}>
            {MODE.label} · {pickedLesson.thaiName}</div>
          <div style={{fontSize:22,fontWeight:700,color:'#FFF6D8',fontFamily:tf}}>เลือกความยาก</div>
          <div style={{fontSize:12,color:'#E8CF95',marginTop:4}}>ยิ่งชีวิตน้อย ยิ่งท้าทาย</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {BR_DIFFICULTIES.map(d=>(
            <button key={d.lives} onClick={()=>!busy&&onSelect(pickedLesson,d.lives)}
              disabled={busy}
              style={{background:'var(--c-surf)',border:'3px solid #3B2416',boxShadow:`inset 6px 0 0 ${d.color}`,
                padding:'14px 18px',cursor:busy?'not-allowed':'pointer',
                display:'flex',alignItems:'center',gap:14,textAlign:'left',
                transition:'all .15s',opacity:busy?0.5:1}}
              onMouseEnter={e=>{if(!busy){e.currentTarget.style.background=d.bg;e.currentTarget.style.transform='translateY(-2px)';}}}
              onMouseLeave={e=>{e.currentTarget.style.background='var(--c-surf)';e.currentTarget.style.transform='none';}}>
              <span style={{fontSize:28}}>{d.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:tf,fontSize:15,fontWeight:800,color:'var(--c-t1)',lineHeight:1.4}}>{d.thai}</div>
                <div style={{fontSize:11,color:'var(--c-t3)',marginTop:2}}>{d.en}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:18,fontWeight:800,color:d.color}}>
                  {'❤️'.repeat(Math.min(d.lives,5))}{d.lives>5?'…':''}</div>
                <div style={{fontSize:11,color:d.color,fontWeight:700}}>{d.lives} ชีวิต</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{fontFamily:tf}}>
      <div className="px-wood" style={{padding:'4px 8px',marginBottom:20,
        position:'relative',textAlign:'center',color:'#F5E6BE'}}>
        <button onClick={onBack} className="px-btn"
          style={{position:'absolute',top:0,left:0,minHeight:40,padding:'0 4px',fontSize:14,fontFamily:tf}}>← ออก</button>
        <div style={{fontSize:34,marginBottom:6}}>{MODE.icon}</div>
        <div style={{fontFamily:"'Press Start 2P', monospace",fontSize:12,color:'#E8CF95',fontWeight:400,
          letterSpacing:1,marginBottom:3}}>{MODE.label}</div>
        <div style={{fontSize:22,fontWeight:700,color:'#FFF6D8',fontFamily:tf}}>เลือก Arena</div>
        <div style={{fontSize:12,color:'#E8CF95',marginTop:4}}>{MODE.hint}</div>
      </div>
      {CHAPTERS.map(ch=>{
        const chLessons=LESSONS.filter(l=>ch.lessonIds.includes(l.id));
        if (!chLessons.length) return null;
        return (
          <div key={ch.id} style={{marginBottom:18}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--c-t2)',
              letterSpacing:1,marginBottom:8,paddingLeft:4}}>
              {ch.label.toUpperCase()} · {ch.title}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {chLessons.map(lesson=>(
                <button key={lesson.id}
                  onClick={()=>{if(busy)return; isRoyale?setPickedLesson(lesson):onSelect(lesson);}}
                  disabled={busy}
                  style={{background:'var(--c-surf)',border:'3px solid #3B2416',boxShadow:`inset 6px 0 0 ${lesson.accent}`,
                    padding:'10px 14px 10px 18px',cursor:busy?'not-allowed':'pointer',
                    textAlign:'left',opacity:busy?0.5:1,transition:'all .15s'}}
                  onMouseEnter={e=>{if(!busy){e.currentTarget.style.background=lesson.al;e.currentTarget.style.transform='translateY(-2px)';}}}
                  onMouseLeave={e=>{e.currentTarget.style.background='var(--c-surf)';e.currentTarget.style.transform='none';}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <span style={{background:lesson.al,color:lesson.accent,borderRadius:6,
                      padding:'2px 7px',fontSize:9,fontWeight:800}}>บท {lesson.num ?? lesson.id}</span>
                  </div>
                  <div style={{fontFamily:tf,fontSize:13,fontWeight:800,color:'var(--c-t1)',lineHeight:1.3}}>
                    {lesson.thaiName}</div>
                  <div style={{fontSize:10,color:'var(--c-t3)',marginTop:2}}>
                    {busy?'⏳':'→'} {(lesson.exercises||lesson.exercisesA||[]).length} ขั้น</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// LOBBY SCREEN  (Phase 4)

export function LobbyScreen({ roomCode, roomInfo, roomPlayers, isHost, roomType, myName, myCfg, onStart, onLeave, onStartSpectator }) {
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
  const players = Object.entries(roomPlayers||{});
  const canStart = players.length >= 2;
  return (
    <div style={{textAlign:'center'}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:'var(--c-t3)',letterSpacing:2,marginBottom:6,fontWeight:700}}>
          {roomType==='royale'?'🏆 BATTLE ROYALE':'⚡ 1V1'} — รหัสห้อง</div>
        <div className="px-wood" style={{display:'inline-block',padding:'0 18px'}}>
          <div style={{fontSize:48,fontWeight:400,letterSpacing:6,color:'#F5D27A',
            fontFamily:"'Press Start 2P', monospace",lineHeight:1.2}}>{roomCode}</div></div>
        <div style={{fontSize:12,color:'var(--c-t3)',marginTop:6,fontFamily:tf}}>
          แจ้งรหัสนี้ให้เพื่อนพิมพ์เพื่อเข้าร่วม</div>
      </div>
      {roomInfo&&(
        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:20}}>
          <div style={{background:'var(--c-surf)',border:'3px solid #3B2416',
            padding:'8px 16px',fontFamily:tf,fontSize:14,fontWeight:600,color:'var(--c-t4)'}}>
            📝 {roomInfo.exerciseTitle}
          </div>
          {roomType==='1v1'&&(
            <div style={{background:'var(--c-surf)',border:'3px solid #3B2416',
              padding:'8px 16px',fontFamily:tf,fontSize:14,color:'var(--c-t1)',fontWeight:700}}>
              ⭐ ชนะด้วยคะแนน · คนแรกจบแล้วอีกคนเหลือ {PRESSURE_SECS} วินาที
            </div>
          )}
          {roomType==='royale'&&roomInfo.maxLives&&(()=>{
            const d=difficultyOf(roomInfo.maxLives);
            return (
              <div style={{background:d.bg,border:`1.5px solid ${d.color}`,borderRadius:10,
                padding:'8px 16px',fontFamily:tf,fontSize:13,color:d.color,fontWeight:700}}>
                {d.emoji} {d.thai} · {d.lives} ชีวิต
              </div>
            );
          })()}
        </div>
      )}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:'var(--c-t2)',fontWeight:700,letterSpacing:.5,marginBottom:10}}>
          ผู้เล่น ({players.length}{roomType==='1v1'?'/2':''})</div>
        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
          {players.map(([uid,p])=>{
            const name=p.name||uid, isMe=uid===currentFirebaseUid();
            return (
            <div key={uid} style={{background:isMe?'#FFE9A8':'var(--c-surf)',
              border:'3px solid #3B2416',
              padding:'5px 14px 5px 5px',fontFamily:tf,fontWeight:700,fontSize:15,
              display:'flex',alignItems:'center',gap:8}}>
              {window.CharKit
                ? <CharKit.Avatar config={isMe&&myCfg?myCfg:CharKit.fromPlayer(p)} size={30}/>
                : (isMe?'👤':'')}
              <span>{name}</span>
            </div>
          );})}
          {roomType==='1v1'&&players.length<2&&(
            <div style={{border:'3px dashed #8C6E4E',
              padding:'8px 18px',color:'var(--c-t3)',fontSize:13}}>รอผู้เล่น...</div>
          )}
        </div>
      </div>
      {isHost&&(
        <div style={{marginBottom:12,display:'flex',gap:8}}>
          <button onClick={onStart} disabled={!canStart} className="px-btn" style={{
            flex:2,minHeight:56,fontSize:18,fontFamily:tf}}>
            {canStart
              ? (roomType==='royale'?'▶ เริ่ม Battle Royale!':'▶ เริ่มแข่ง 1v1!')
              : 'รอ ('+players.length+(roomType==='1v1'?'/2':'/2+')+')'}
          </button>
          {roomType==='royale'&&canStart&&(
            <button onClick={()=>onStartSpectator&&onStartSpectator()} className="px-btn" style={{
              flex:1,minHeight:56,fontSize:15,fontFamily:tf}}>
              👀 ดูอย่างเดียว
            </button>
          )}
        </div>
      )}
      {!isHost&&(
        <div style={{color:'var(--c-t2)',fontSize:13,marginBottom:16,fontFamily:tf}}>
          รอเจ้าของห้องกดเริ่ม...</div>
      )}
      <button onClick={onLeave} style={{background:'var(--c-surf)',
        border:'3px solid #3B2416',color:'#B3261E',
        padding:'8px 16px',cursor:'pointer',fontSize:15,fontWeight:700,fontFamily:tf}}>
        ออกจากห้อง
      </button>
    </div>
  );
}

// COUNTDOWN SCREEN  (Phase 4)

export function CountdownScreen({ num, roomCode, roomType, roomPlayers, myCfg, myName }) {
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
  return (
    <div style={{textAlign:'center',padding:'48px 20px',fontFamily:tf}}>
      <div style={{fontFamily:"'Press Start 2P', monospace",fontSize:12,color:'var(--c-t2)',letterSpacing:1,marginBottom:20,fontWeight:400}}>
        {roomType==='royale'?'BATTLE ROYALE':'1 VS 1'} · {roomCode}</div>
      <div key={num} className="timeup-pop" style={{fontFamily:"'Press Start 2P', monospace",fontSize:96,fontWeight:400,lineHeight:1,color:'#FFC23D',
        textShadow:'5px 0 0 #3B2416,-5px 0 0 #3B2416,0 5px 0 #3B2416,0 -5px 0 #3B2416,8px 8px 0 #3B2416'}}>
        {num>0?num:'GO!'}
      </div>
      <div style={{fontSize:20,fontWeight:700,color:'var(--c-t1)',marginTop:20}}>
        {num>0?'วางนิ้วบน Home Row...':'🏃 พิมพ์เลย!'}</div>
      {window.CharKit&&(
        <div style={{maxWidth:560,margin:'28px auto 0'}}>
          <CharKit.RaceTrack mode={roomType==='royale'?'royale':'1v1'} scene style={{border:'3px solid #3B2416'}}
            runners={raceRunners(roomPlayers,{myCfg,
              myLabel:roomType==='royale'?'คุณ':(myName||'คุณ')+' (คุณ)',
              limit:roomType==='royale'?0:1})
              .map((r,i)=>({...r,color:i===0?'#347ED0':'#E79035'}))}/>
        </div>
      )}
    </div>
  );
}
