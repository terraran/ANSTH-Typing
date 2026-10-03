import { ZONE_GAP } from '../firebase';
import { buildChunks } from '../engine/text';
import { TextDisplay } from '../ui/common';

export // HOST DASHBOARD — shown to host who chose "Watch" mode

function HostDashboard({ roomCode, roomPlayers, roomType, zoneWpm, zonePos, onSpectate, onBack }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  const players = Object.entries(roomPlayers || {}).filter(([,p])=>!p.isSpectator);
  const alive   = players.filter(([,p]) => (p.lives ?? 1) > 0 && p.active !== false);
  const dead    = players.filter(([,p]) => (p.lives ?? 1) <= 0 || p.active === false);
  const sorted  = [...alive].sort((a,b) => (b[1].wpm||0) - (a[1].wpm||0));

  return (
    <div style={{fontFamily:tf}}>
      {/* Header */}
      <div style={{background:'linear-gradient(135deg,#1C1917,#D97706)',borderRadius:16,
        padding:'16px 20px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
        <div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.6)',fontWeight:700,letterSpacing:2}}>
            🏆 BATTLE ROYALE · ห้อง {roomCode}</div>
          <div style={{fontSize:20,fontWeight:800,color:'#fff',marginTop:2}}>
            {alive.length} คนเหลือ · {dead.length} คนออก</div>
        </div>
        {zonePos > 0 && (
          <div style={{marginLeft:'auto',textAlign:'right'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.6)',fontWeight:700}}>SAFE ZONE</div>
            <div style={{fontSize:24,fontWeight:800,color:'#FCD34D'}}>{zoneWpm} ตัว/นาที</div>
          </div>
        )}
      </div>

      {/* Player table */}
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {sorted.map(([uid, p], i) => {
          const name=p.name||'ผู้เล่น';
          const wpm    = Math.round((p.cpm||p.wpm||0)/5);  // support both cpm and wpm
          const lives  = p.lives ?? 3;
          const pct    = zonePos > 0 ? Math.max(0, Math.min(100, Math.round(((p.pos||0)-(zonePos-ZONE_GAP))/ZONE_GAP*100))) : 100;
          const danger = zonePos > 0 && (p.pos||0) < zonePos-ZONE_GAP;
          return (
            <div key={uid} style={{background:'var(--c-card)',borderRadius:10,
              padding:'10px 14px',border:`1.5px solid ${danger?'#FCA5A5':'var(--c-border)'}`,
              display:'flex',alignItems:'center',gap:10}}>
              <div style={{fontSize:16,fontWeight:800,color:'var(--c-t3)',width:24,
                flexShrink:0,textAlign:'center'}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)'}}>{name}</div>
                  <div style={{fontSize:12,color:danger?'#DC2626':'#059669',fontWeight:700}}>
                    {wpm} WPM {danger?'⚠️':'✓'}</div>
                  <div style={{fontSize:12,marginLeft:'auto',flexShrink:0}}>
                    {lives > 0 ? '❤️'.repeat(Math.min(lives,5)) : '💀'}</div>
                </div>
                <div style={{background:'var(--c-surf)',borderRadius:4,height:6,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:4,transition:'width .5s',
                    width:pct+'%',background:danger?'#EF4444':'#059669'}}/>
                </div>
              </div>
              <button onClick={()=>onSpectate&&onSpectate(uid)}
                style={{background:'#EFF6FF',border:'1.5px solid #BFDBFE',color:'#2563EB',
                  borderRadius:7,padding:'5px 10px',cursor:'pointer',fontSize:11,
                  fontWeight:700,fontFamily:tf,flexShrink:0}}>
                👁 ดู
              </button>
            </div>
          );
        })}
        {dead.map(([uid,p]) => (
          <div key={uid} style={{background:'var(--c-surf)',borderRadius:10,
            padding:'10px 14px',border:'1.5px solid var(--c-border)',
            display:'flex',alignItems:'center',gap:10,opacity:.5}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--c-t3)'}}>💀 {p.name||'ผู้เล่น'}</div>
          </div>
        ))}
      </div>

      <button onClick={onBack}
        style={{marginTop:16,width:'100%',background:'transparent',
          border:'1.5px solid var(--c-border)',color:'var(--c-t2)',
          borderRadius:8,padding:'10px',cursor:'pointer',fontSize:13,fontFamily:tf}}>
        ออกจากห้อง
      </button>
    </div>
  );
}

export // SPECTATOR VIEW — render the selected player's text, not the host's local chunk.
function SpectatorView({ playerName, targetChars, progress, onBack }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  // Apply same chunking logic as practice screen so page scrolls with player
  const chunks = buildChunks(targetChars);
  const pos    = progress || 0;
  const chunkIdx = (() => {
    for (let i=0; i<chunks.length; i++) { if (pos < chunks[i].end) return i; }
    return Math.max(0, chunks.length-1);
  })();
  const curChunk   = chunks[chunkIdx] || {start:0, end:targetChars.length};
  const chunkChars = targetChars.slice(curChunk.start, curChunk.end);
  const chunkPos   = Math.max(0, pos - curChunk.start);

  return (
    <div style={{fontFamily:tf}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
        <button onClick={onBack}
          style={{background:'var(--c-surf)',border:'1.5px solid var(--c-border)',
            color:'var(--c-t2)',borderRadius:7,padding:'5px 10px',cursor:'pointer',
            fontSize:12,fontFamily:tf}}>← กลับ</button>
        <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)'}}>
          👁 กำลังดู: {playerName}</div>
        <div style={{marginLeft:'auto',fontSize:11,color:'var(--c-t3)'}}>
          หน้า {chunkIdx+1}/{chunks.length}
        </div>
      </div>
      <div style={{background:'var(--c-surf)',borderRadius:14,padding:'22px 18px',
        border:'1.5px solid var(--c-border)',minHeight:96,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        <TextDisplay displayChars={chunkChars} displayPos={chunkPos}/>
      </div>
    </div>
  );
}

export function BattleRoyaleResults({ roomCode, roomPlayers, onBack }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";
  const rows = Object.entries(roomPlayers||{})
    .filter(([,p])=>!p.isSpectator)
    .sort((a,b)=>{
      const rank = p => p.status==='done'?0:(p.lives||0)>0?1:2;
      const diff = rank(a[1])-rank(b[1]);
      if (diff) return diff;
      if (a[1].status==='done' && b[1].status==='done') return (a[1].finishedAt||0)-(b[1].finishedAt||0);
      if ((a[1].lives||0)!==(b[1].lives||0)) return (b[1].lives||0)-(a[1].lives||0);
      return (b[1].pos||0)-(a[1].pos||0);
    });
  return (
    <div style={{fontFamily:tf}}>
      <div style={{textAlign:'center',padding:'24px 12px 18px',background:'linear-gradient(135deg,#1C1917,#D97706)',borderRadius:16,color:'#fff',marginBottom:14}}>
        <div style={{fontSize:42}}>🏆</div>
        <div style={{fontSize:22,fontWeight:800}}>จบการแข่งขัน Battle Royale</div>
        <div style={{fontSize:13,opacity:.8}}>ห้อง {roomCode} · สรุปผลผู้เล่น</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {rows.map(([uid,p],i)=>(
          <div key={uid} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,border:'1.5px solid var(--c-border)',background:'var(--c-surf)'}}>
            <div style={{fontSize:19,fontWeight:800,width:32,textAlign:'center',color:i===0?'#D97706':'var(--c-t3)'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)'}}>{p.name||'ผู้เล่น'}</div>
              <div style={{fontSize:11,color:'var(--c-t2)'}}>{p.status==='done'?'พิมพ์จบแล้ว':(p.lives||0)>0?'ยังอยู่ในการแข่งขัน':'ถูกคัดออก'} · {p.pos||0} ตัวอักษร</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:'var(--c-t2)'}}>{Math.round((p.cpm||p.wpm||0)/5)} WPM</div>
          </div>
        ))}
      </div>
      <button onClick={onBack} style={{marginTop:16,width:'100%',background:'transparent',border:'1.5px solid var(--c-border)',color:'var(--c-t2)',borderRadius:8,padding:10,cursor:'pointer',fontSize:13,fontFamily:tf}}>กลับแดชบอร์ดผู้ดู</button>
    </div>
  );
}
