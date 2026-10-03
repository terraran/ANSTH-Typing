import { ZONE_GAP, ZONE_GRACE, ZONE_TICK_SECS, currentFirebaseUid } from '../firebase';
import { comboMultiplier, fmtScore } from '../engine/scoring';

const { useEffect, useState } = React;

export // Phase 2 — runners for CharKit.RaceTrack: me first, then the nearest rivals.
function raceRunners(roomPlayers, o={}) {
  if (!window.CharKit) return [];
  const uid=currentFirebaseUid(), total=Math.max(1,o.totalChars||1), myPos=o.myPos||0;
  const others=Object.entries(roomPlayers||{})
    .filter(([k,p])=>p&&!p.isSpectator&&k!==uid&&p.uid!==uid)
    .map(([k,p])=>({id:k,label:p.name||'ผู้เล่น',cfg:CharKit.fromPlayer(p),
      pct:Math.min(1,(Number(p.pos)||0)/total),kpm:Number(p.cpm)||0,
      finished:p.status==='done',out:p.status==='eliminated'}))
    .sort((a,b)=>Math.abs(a.pct*total-myPos)-Math.abs(b.pct*total-myPos))
    .slice(0,o.limit??5);
  const me={id:'me',me:true,label:o.myLabel||'คุณ',cfg:o.myCfg||CharKit.fromName(o.myLabel),
    pct:Math.min(1,myPos/total),kpm:o.myKpm||0,finished:myPos>=total,out:!!o.myOut};
  return [me,...others];
}

export // 1v1 HUD — live score of both players (score decides the winner) + progress lanes

function OneVsOneHud({ roomCode, roomPlayers, myName, pos, totalChars, score, streak, myCfg, kpm }) {
  const roster=Object.entries(roomPlayers||{}).filter(([,p])=>!p.isSpectator);
  const uid=currentFirebaseUid();
  const mine=roster.find(([key,p])=>key===uid||p.uid===uid)?.[1]||{};
  const other=roster.find(([key,p])=>key!==uid&&p.uid!==uid);
  const rivalName=other?.[1]?.name||'คู่แข่ง';
  const rival=other?.[1]||{};
  const myPos=Math.max(pos,mine.pos||0);
  const rivalPos=rival.pos||0;
  const myPct=totalChars?Math.max(0,Math.min(100,Math.round(myPos/totalChars*100))):0;
  const rivalPct=totalChars?Math.max(0,Math.min(100,Math.round(rivalPos/totalChars*100))):0;
  const rivalScore=Number(rival.score)||0;
  const lead=score-rivalScore;
  const gap=Math.abs(lead);
  const mult=comboMultiplier(streak);
  const finalSprint=Math.max(myPct,rivalPct)>=80;
  const leadText=!other?'รอคู่แข่ง...':gap<100?'🤝 สูสีมาก!':lead>0?`✨ คุณนำ ${fmtScore(gap)} คะแนน`:`⚡ ตามอยู่ ${fmtScore(gap)} คะแนน`;
  const boxes=[
    {label:(myName||'คุณ')+' (คุณ)',value:score,color:'#347ED0',bg:'#EAF2FB',lead:lead>0},
    {label:rivalName,value:rivalScore,color:'#E79035',bg:'#FEF5EA',lead:lead<0},
  ];
  return (
    <div style={{fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",border:'1px solid #DBE7F2',borderRadius:12,overflow:'hidden',marginBottom:8}}>
      <div style={{height:28,padding:'0 10px',display:'flex',alignItems:'center',gap:8,background:'linear-gradient(100deg,#234D91,#377FD0)',color:'#fff'}}>
        <span style={{fontSize:10,fontWeight:800,letterSpacing:.5,whiteSpace:'nowrap'}}>⚡ 1V1 · {roomCode}</span>
        <span style={{height:16,width:1,background:'#ffffff50'}}/>
        <span style={{fontSize:11,fontWeight:800,whiteSpace:'nowrap'}}>🔥 คอมโบ {streak}{mult>1?` · ×${mult.toFixed(1)}`:''}</span>
        <span style={{marginLeft:'auto',fontSize:11,fontWeight:800,color:'#FFE59A',whiteSpace:'nowrap'}}>{finalSprint?'🏁 ':''}{leadText}</span>
      </div>
      <div style={{display:'flex',gap:6,padding:'5px 8px',background:'#fff'}}>
        {boxes.map(b=>(
          <div key={b.label} style={{flex:1,minWidth:0,display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:8,
            borderRadius:8,padding:'2px 10px',background:b.lead?b.bg:'#F5F8FB',border:`1.5px solid ${b.lead?b.color:'#E3EAF1'}`,transition:'all .3s'}}>
            <span style={{fontSize:11,fontWeight:700,color:'#566E86',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {b.lead?'👑 ':''}{b.label}</span>
            <span style={{fontSize:18,fontWeight:800,color:b.color,fontVariantNumeric:'tabular-nums'}}>{fmtScore(b.value)}</span>
          </div>
        ))}
      </div>
      {window.CharKit ? (
        <CharKit.RaceTrack mode="1v1" info={`${myPos} / ${totalChars} ตัว`}
          runners={raceRunners(roomPlayers,{myCfg,myLabel:'คุณ',
            myPos,myKpm:kpm,totalChars,limit:1})
            .map((r,i)=>({...r,color:i===0?'#1D4ED8':'#C2620A'}))}/>
      ) : (
        <div style={{padding:'6px 10px 8px',background:'#fff',display:'flex',flexDirection:'column',gap:5}}>
          {[[myPct,'#347ED0','คุณ'],[rivalPct,'#E79035',rivalName]].map(([pct,color,name])=>(
            <div key={name} style={{display:'flex',alignItems:'center',gap:8,fontSize:10,fontWeight:700,color:'#667F97'}}>
              <span style={{width:70,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name}</span>
              <div style={{flex:1,height:8,borderRadius:8,background:'#E9EFF5',overflow:'hidden'}}>
                <div style={{width:`${pct}%`,height:'100%',background:color,transition:'width .35s'}}/></div>
              <span style={{width:32,textAlign:'right'}}>{pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BattleRoyaleHud({ roomCode, roomPlayers, myName, pos, totalChars, zonePos, playerLives, startTime, myCfg, kpm }) {
  const elapsed=startTime?Math.max(0,(Date.now()-startTime)/1000):0;
  const untilZone=Math.max(0,ZONE_GRACE-Math.floor(elapsed));
  const outsideBy=Math.max(0,zonePos-pos-ZONE_GAP);
  const outside=zonePos>0&&outsideBy>0;
  const progress=totalChars?Math.max(0,Math.min(100,Math.round(pos/totalChars*100))):0;
  const edge=totalChars?Math.max(0,Math.min(100,Math.round(zonePos/totalChars*100))):0;
  const drainIn=ZONE_TICK_SECS-Math.floor(elapsed%ZONE_TICK_SECS);
  const players=Object.entries(roomPlayers||{}).filter(([,p])=>!p.isSpectator);
  const alive=players.filter(([,p])=>p.status!=='eliminated'&&p.status!=='done'&&(p.lives||0)>0).length;
  const hearts=playerLives>6?`❤️×${playerLives}`:Array.from({length:Math.max(0,playerLives)},()=>"❤️").join(' ');
  const zone=outside
    ? {icon:'🌪️',text:`ตามหลังขอบวง ${outsideBy} ตัว · ❤️ ลดใน ${drainIn}s`,bg:'#FFF4E7',fg:'#A85411'}
    : zonePos===0
    ? {icon:'⏳',text:`วงเริ่มเคลื่อนใน ${untilZone} วินาที`,bg:'#EFF7FF',fg:'#2B659A'}
    : {icon:'🛡️',text:'อยู่ใน Safezone',bg:'#EFF9F2',fg:'#277449'};
  return (
    <div style={{fontFamily:"'Sarabun','Noto Sans Thai',sans-serif",border:'1px solid #DCE8F3',borderRadius:12,overflow:'hidden',marginBottom:8}}>
      <div style={{height:30,padding:'0 8px 0 10px',display:'flex',alignItems:'center',gap:8,background:'linear-gradient(100deg,#1C477F,#2A73C7)',color:'#fff'}}>
        <span style={{fontSize:10,fontWeight:800,letterSpacing:.5,whiteSpace:'nowrap'}}>🏆 BR · {roomCode}</span>
        <span style={{height:16,width:1,background:'#ffffff50'}}/>
        <span style={{fontSize:12,fontWeight:800,whiteSpace:'nowrap'}}>{hearts||'0 ชีวิต'}</span>
        <span style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:5,background:zone.bg,color:zone.fg,
          borderRadius:7,padding:'2px 8px',fontSize:11,fontWeight:800,whiteSpace:'nowrap',overflow:'hidden'}}>
          <span>{zone.icon}</span><span style={{overflow:'hidden',textOverflow:'ellipsis'}}>{zone.text}</span>
        </span>
        <span style={{fontSize:11,fontWeight:700,whiteSpace:'nowrap'}}>👤 {alive} รอด</span>
      </div>
      {window.CharKit ? (
        <CharKit.RaceTrack mode="royale" zonePct={totalChars?zonePos/totalChars:0}
          info={`คุณ ${progress}% · ขอบวง ${edge}% · ${pos} / ${totalChars} ตัว`}
          runners={raceRunners(roomPlayers,{myCfg,myLabel:'คุณ',myPos:pos,myKpm:kpm,
            totalChars,limit:5,myOut:playerLives<=0})}/>
      ) : (
        <div style={{padding:'10px 16px 8px',background:'#fff'}}>
          <div style={{height:12,position:'relative',borderRadius:20,background:'#E8EEF4'}}>
            <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${edge}%`,background:'#C4B5FD',borderRadius:'20px 0 0 20px',transition:'width .3s'}}/>
            <div style={{position:'absolute',left:`${progress}%`,top:-7,transform:'translateX(-50%)',fontSize:17,lineHeight:'20px',transition:'left .3s'}}>{playerLives>0?'🧑‍🚀':'💀'}</div>
            <span style={{position:'absolute',right:-7,top:-5,fontSize:14}}>🏁</span>
          </div>
          <div style={{textAlign:'right',fontSize:10,color:'#64748B',marginTop:4}}>คุณ {progress}% · ขอบวง {edge}% · {pos} / {totalChars} ตัว</div>
        </div>
      )}
    </div>
  );
}

export // DEAD SCREEN — shown to eliminated BR players
function DeadScreen({ standings, onLeave }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  const [live, setLive] = useState(standings||{});
  useEffect(()=>{ setLive(standings||{}); }, [standings]);
  const sorted = Object.entries(live)
    .filter(([,p])=>!p.isSpectator)
    .sort((a,b)=>(b[1].wpm||0)-(a[1].wpm||0));
  return (
    <div style={{position:'absolute',inset:0,background:'rgba(15,23,42,.92)',
      display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      zIndex:100,borderRadius:16,padding:24,fontFamily:tf}}>
      <div style={{fontSize:48,marginBottom:8}}>💀</div>
      <div style={{fontSize:22,fontWeight:800,color:'#fff',marginBottom:4}}>
        คุณถูกคัดออก</div>
      <div style={{fontSize:13,color:'rgba(255,255,255,.6)',marginBottom:20}}>
        คุณสามารถดูผลแบบ real-time ได้</div>
      <div style={{width:'100%',maxWidth:340}}>
        {sorted.slice(0,8).map(([uid,p],i)=>(
          <div key={uid} style={{display:'flex',alignItems:'center',gap:10,
            padding:'8px 12px',marginBottom:6,borderRadius:8,
            background:(p.lives??0)>0?'rgba(5,150,105,.2)':'rgba(255,255,255,.06)'}}>
            <div style={{fontSize:14,fontWeight:800,color:'rgba(255,255,255,.4)',width:20}}>{i+1}</div>
            <div style={{fontSize:14,fontWeight:700,color:'#fff',flex:1}}>{p.name||'ผู้เล่น'}</div>
            <div style={{fontSize:13,color:(p.lives??0)>0?'#34D399':'rgba(255,255,255,.4)'}}>
              {(p.lives??0)>0?`${p.wpm||0} WPM`:'💀'}</div>
          </div>
        ))}
      </div>
      <button onClick={onLeave}
        style={{marginTop:16,background:'rgba(255,255,255,.1)',border:'1.5px solid rgba(255,255,255,.2)',
          color:'#fff',borderRadius:8,padding:'10px 24px',cursor:'pointer',
          fontSize:13,fontWeight:700,fontFamily:tf}}>
        ออกจากห้อง
      </button>
    </div>
  );
}
