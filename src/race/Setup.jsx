import { BR_DIFFICULTIES, CHAPTERS, LESSONS, difficultyOf } from '../data/lessons';
import { PRESSURE_SECS } from '../engine/scoring';
import { currentFirebaseUid } from '../firebase';
import { raceRunners } from './Hud';

const { useState } = React;

export // MULTIPLAYER SETUP — game lobby style

function MPSetupScreen({ mode, onSelect, onBack, busy }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  const isRoyale = mode==='royale';
  const [pickedLesson, setPickedLesson] = useState(null);

  const MODE = isRoyale
    ? { label:'BATTLE ROYALE', icon:'🏆', from:'#92400E', to:'#D97706', hint:'เลือก Arena ที่จะแข่งขัน' }
    : { label:'1 vs 1',        icon:'⚔️', from:'#1E3A8A', to:'#2563EB', hint:'เลือก Arena ที่จะแข่งขัน · ชนะด้วยคะแนน' };

  if (isRoyale && pickedLesson) {
    return (
      <div style={{fontFamily:tf}}>
        <div style={{background:`linear-gradient(135deg,${MODE.from},${MODE.to})`,
          borderRadius:16,padding:'20px 20px 18px',marginBottom:20,
          position:'relative',overflow:'hidden',textAlign:'center'}}>
          <div style={{position:'absolute',top:-25,right:-25,width:90,height:90,
            borderRadius:'50%',background:'rgba(255,255,255,.08)'}}/>
          <button onClick={()=>setPickedLesson(null)}
            style={{position:'absolute',top:12,left:12,background:'rgba(255,255,255,.18)',
              border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',
              fontSize:12,color:'#fff',fontWeight:700}}>← กลับ</button>
          <div style={{fontSize:34,marginBottom:6}}>💀</div>
          <div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:700,letterSpacing:2,marginBottom:3}}>
            {MODE.label} · {pickedLesson.thaiName}</div>
          <div style={{fontSize:20,fontWeight:800,color:'#fff',fontFamily:tf}}>เลือกความยาก</div>
          <div style={{fontSize:12,color:'rgba(255,255,255,.6)',marginTop:4}}>ยิ่งชีวิตน้อย ยิ่งท้าทาย</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {BR_DIFFICULTIES.map(d=>(
            <button key={d.lives} onClick={()=>!busy&&onSelect(pickedLesson,d.lives)}
              disabled={busy}
              style={{background:'#fff',border:`2px solid ${d.color}`,borderRadius:14,
                padding:'14px 18px',cursor:busy?'not-allowed':'pointer',
                display:'flex',alignItems:'center',gap:14,textAlign:'left',
                transition:'all .15s',opacity:busy?0.5:1}}
              onMouseEnter={e=>{if(!busy){e.currentTarget.style.background=d.bg;e.currentTarget.style.transform='translateY(-2px)';}}}
              onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.transform='none';}}>
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
      <div style={{background:`linear-gradient(135deg,${MODE.from},${MODE.to})`,
        borderRadius:16,padding:'20px 20px 18px',marginBottom:20,
        position:'relative',overflow:'hidden',textAlign:'center'}}>
        <div style={{position:'absolute',top:-25,right:-25,width:90,height:90,
          borderRadius:'50%',background:'rgba(255,255,255,.08)'}}/>
        <button onClick={onBack}
          style={{position:'absolute',top:12,left:12,background:'rgba(255,255,255,.18)',
            border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',
            fontSize:12,color:'#fff',fontWeight:700}}>← ออก</button>
        <div style={{fontSize:34,marginBottom:6}}>{MODE.icon}</div>
        <div style={{fontSize:10,color:'rgba(255,255,255,.7)',fontWeight:700,
          letterSpacing:2,marginBottom:3}}>{MODE.label}</div>
        <div style={{fontSize:20,fontWeight:800,color:'#fff',fontFamily:tf}}>เลือก Arena</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,.6)',marginTop:4}}>{MODE.hint}</div>
      </div>
      {CHAPTERS.map(ch=>{
        const chLessons=LESSONS.filter(l=>ch.lessonIds.includes(l.id));
        if (!chLessons.length) return null;
        return (
          <div key={ch.id} style={{marginBottom:18}}>
            <div style={{fontSize:10,fontWeight:800,color:'var(--c-t3)',
              letterSpacing:1,marginBottom:8,paddingLeft:4}}>
              {ch.label.toUpperCase()} · {ch.title}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {chLessons.map(lesson=>(
                <button key={lesson.id}
                  onClick={()=>{if(busy)return; isRoyale?setPickedLesson(lesson):onSelect(lesson);}}
                  disabled={busy}
                  style={{background:busy?'#F8FAFC':'#fff',border:`2px solid ${lesson.accent}`,
                    borderRadius:12,padding:'12px 14px',cursor:busy?'not-allowed':'pointer',
                    textAlign:'left',opacity:busy?0.5:1,transition:'all .15s'}}
                  onMouseEnter={e=>{if(!busy){e.currentTarget.style.background=lesson.al;e.currentTarget.style.transform='translateY(-2px)';}}}
                  onMouseLeave={e=>{e.currentTarget.style.background='#fff';e.currentTarget.style.transform='none';}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                    <span style={{background:lesson.al,color:lesson.accent,borderRadius:6,
                      padding:'2px 7px',fontSize:9,fontWeight:800}}>บท {lesson.id}</span>
                  </div>
                  <div style={{fontFamily:tf,fontSize:13,fontWeight:800,color:'var(--c-t1)',lineHeight:1.3}}>
                    {lesson.thaiName}</div>
                  <div style={{fontSize:10,color:'var(--c-t3)',marginTop:2}}>
                    {busy?'⏳':'→'} {(lesson.exercises||lesson.exercisesA||[]).length} exercises</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export // LOBBY SCREEN  (Phase 4)

function LobbyScreen({ roomCode, roomInfo, roomPlayers, isHost, roomType, myName, myCfg, onStart, onLeave, onStartSpectator }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  const players = Object.entries(roomPlayers||{});
  const canStart = players.length >= 2;
  return (
    <div style={{textAlign:'center'}}>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,color:'var(--c-t3)',letterSpacing:2,marginBottom:6,fontWeight:700}}>
          {roomType==='royale'?'🏆 BATTLE ROYALE':'⚡ 1V1'} — รหัสห้อง</div>
        <div style={{fontSize:56,fontWeight:800,letterSpacing:10,color:'var(--c-t1)',
          fontFamily:'system-ui,monospace',lineHeight:1}}>{roomCode}</div>
        <div style={{fontSize:12,color:'var(--c-t3)',marginTop:6,fontFamily:tf}}>
          แจ้งรหัสนี้ให้เพื่อนพิมพ์เพื่อเข้าร่วม</div>
      </div>
      {roomInfo&&(
        <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap',marginBottom:20}}>
          <div style={{background:'var(--c-surf)',border:'1.5px solid var(--c-border)',borderRadius:10,
            padding:'8px 16px',fontFamily:tf,fontSize:13,color:'var(--c-t4)'}}>
            📝 {roomInfo.exerciseTitle}
          </div>
          {roomType==='1v1'&&(
            <div style={{background:'#EFF6FF',border:'1.5px solid #BFDBFE',borderRadius:10,
              padding:'8px 16px',fontFamily:tf,fontSize:13,color:'#1D4ED8',fontWeight:700}}>
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
            <div key={uid} style={{background:isMe?'#EFF6FF':'#F8FAFC',
              border:'1.5px solid '+(isMe?'#BFDBFE':'#E2E8F0'),
              borderRadius:10,padding:'5px 14px 5px 5px',fontFamily:tf,fontWeight:700,fontSize:15,
              display:'flex',alignItems:'center',gap:8}}>
              {window.CharKit
                ? <CharKit.Avatar config={isMe&&myCfg?myCfg:CharKit.fromPlayer(p)} size={30}/>
                : (isMe?'👤':'')}
              <span>{name}</span>
            </div>
          );})}
          {roomType==='1v1'&&players.length<2&&(
            <div style={{border:'1.5px dashed #CBD5E1',borderRadius:10,
              padding:'8px 18px',color:'var(--c-t3)',fontSize:13}}>รอผู้เล่น...</div>
          )}
        </div>
      </div>
      {isHost&&(
        <div style={{marginBottom:12,display:'flex',gap:8}}>
          <button onClick={onStart} disabled={!canStart} style={{
            flex:2,background:canStart?'#059669':'#94A3B8',color:'#fff',border:'none',
            borderRadius:10,padding:'12px',cursor:canStart?'pointer':'not-allowed',
            fontSize:15,fontWeight:700,fontFamily:tf,transition:'background .15s'}}>
            {canStart
              ? (roomType==='royale'?'▶ เริ่ม Battle Royale!':'▶ เริ่มแข่ง 1v1!')
              : 'รอ ('+players.length+(roomType==='1v1'?'/2':'/2+')+')'}
          </button>
          {roomType==='royale'&&canStart&&(
            <button onClick={()=>onStartSpectator&&onStartSpectator()} style={{
              flex:1,background:'#7C3AED',color:'#fff',border:'none',
              borderRadius:10,padding:'12px 8px',cursor:'pointer',
              fontSize:12,fontWeight:700,fontFamily:tf,lineHeight:1.3}}>
              👀{'\n'}ดูอย่างเดียว
            </button>
          )}
        </div>
      )}
      {!isHost&&(
        <div style={{color:'var(--c-t2)',fontSize:13,marginBottom:16,fontFamily:tf}}>
          รอเจ้าของห้องกดเริ่ม...</div>
      )}
      <button onClick={onLeave} style={{background:'transparent',
        border:'1.5px solid #FCA5A5',color:'#DC2626',borderRadius:8,
        padding:'8px 16px',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:tf}}>
        ออกจากห้อง
      </button>
    </div>
  );
}

export // COUNTDOWN SCREEN  (Phase 4)

function CountdownScreen({ num, roomCode, roomType, roomPlayers, myCfg, myName }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  return (
    <div style={{textAlign:'center',padding:'48px 20px',fontFamily:tf}}>
      <div style={{fontSize:11,color:'var(--c-t3)',letterSpacing:2,marginBottom:24,fontWeight:700}}>
        {roomType==='royale'?'🏆 BATTLE ROYALE':'⚡ 1V1'} — ห้อง {roomCode}</div>
      <div style={{fontSize:96,fontWeight:800,lineHeight:1,color:'#1D4ED8',
        transition:'transform .2s',transform:num===1?'scale(1.3)':'scale(1)'}}>
        {num}
      </div>
      <div style={{fontSize:18,color:'var(--c-t2)',marginTop:20}}>
        {num>0?'วางนิ้วบน Home Row...':'🏃 พิมพ์เลย!'}</div>
      {window.CharKit&&(
        <div style={{maxWidth:560,margin:'28px auto 0'}}>
          <CharKit.RaceTrack mode={roomType==='royale'?'royale':'1v1'}
            runners={raceRunners(roomPlayers,{myCfg,
              myLabel:roomType==='royale'?'คุณ':(myName||'คุณ')+' (คุณ)',
              limit:roomType==='royale'?5:1})
              .map((r,i)=>({...r,color:i===0?'#347ED0':'#E79035'}))}/>
        </div>
      )}
    </div>
  );
}
