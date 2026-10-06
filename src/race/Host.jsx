import { ZONE_GAP } from '../firebase';
import { brOrder, isAliveState, playerState, stateBadge } from './presence';
import { buildChunks } from '../engine/text';
import { TextDisplay } from '../ui/common';
import { sfx } from '../ui/sound';

// HOST DASHBOARD — the watch screen (host who chose "Watch", or a BR player who is out).
// Top: lane with the 5 leading runners. Below: every player as a small card (fits ~30 on one screen).
// Bottom-right: short pop-ups when someone is out / leaves / drops / finishes.

const OUT_NOTE = {
  eliminated: ['💀', 'ตกรอบ'], left: ['🚪', 'ออกจากเกม'], removed: ['🚪', 'ออกจากเกม'],
  disconnected: ['📶', 'หลุดการเชื่อมต่อ'], done: ['🏁', 'พิมพ์จบแล้ว'],
};

function useLeaveToasts(roomPlayers) {
  const [toasts, setToasts] = React.useState([]);
  const prev = React.useRef(null);
  React.useEffect(() => {
    const now = {};
    Object.entries(roomPlayers || {}).forEach(([k, p]) => { if (p && !p.isSpectator) now[k] = { st: p.status, name: p.name || 'ผู้เล่น' }; });
    const before = prev.current; prev.current = now;
    if (!before) return;                       // first look: no pop-ups for what already happened
    const fresh = [];
    Object.entries(now).forEach(([k, v]) => {
      const was = before[k] && before[k].st;
      if (v.st !== was && OUT_NOTE[v.st]) fresh.push({ name: v.name, kind: v.st });
    });
    Object.entries(before).forEach(([k, v]) => { if (!now[k] && v.st !== 'done' && v.st !== 'eliminated' && v.st !== 'left') fresh.push({ name: v.name, kind: 'removed' }); });
    if (!fresh.length) return;
    sfx('tip');
    const stamped = fresh.map((t, i) => ({ ...t, id: Date.now() + '-' + i + Math.random() }));
    setToasts(ts => [...ts, ...stamped].slice(-3));
    stamped.forEach(t => setTimeout(() => setToasts(ts => ts.filter(x => x.id !== t.id)), 4000));
  }, [roomPlayers]);
  return toasts;
}

export function HostDashboard({ roomCode, roomPlayers, roomType, zoneWpm, zonePos, totalChars = 0, onSpectate, onBack, sOffset=0, watcherNote }) {
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
  const sNow = Date.now()+sOffset;
  const isBR = roomType !== '1v1';
  const players = Object.entries(roomPlayers || {}).filter(([,p])=>p&&!p.isSpectator);
  const stOf = p => playerState(p, isBR ? 'royale' : '1v1', sNow);
  const isIn = p => isAliveState(stOf(p)) && (p.lives ?? 1) > 0;
  const alive   = players.filter(([,p]) => isIn(p)).sort((a,b) => (b[1].pos||0) - (a[1].pos||0));
  // Out of the race: finished / eliminated / left / dropped — the names stay, in finishing order.
  const dead    = brOrder(roomPlayers, sNow).filter(([,p]) => !isIn(p));
  const toasts = useLeaveToasts(roomPlayers);
  const total = Math.max(1, totalChars || 0);
  const edge = isBR && zonePos > 0 ? Math.max(0, zonePos - ZONE_GAP) : 0;
  const laneH = typeof window !== 'undefined' && window.innerHeight < 720 ? 84 : 100;

  // Lane: the 5 leaders. The leader runs in front with a crown, the others show their place.
  const runners = window.CharKit && totalChars ? alive.slice(0, 5).map(([uid, p], i) => ({
    id: uid, me: i === 0, label: i === 0 ? '👑 ' + (p.name || 'ผู้เล่น') : String(i + 1),
    cfg: CharKit.fromPlayer(p), pct: Math.min(1, (Number(p.pos) || 0) / total), kpm: Number(p.cpm) || 0,
    finished: p.status === 'done', tag: true, alpha: 1, color: i === 0 ? '#B45309' : '#3B2416',
  })) : [];

  const card = (uid, p, i, out) => {
    const st = stOf(p);
    const wpm = Math.round((p.cpm||p.wpm||0)/5);
    const lives = p.lives ?? 3;
    const pct = Math.max(0, Math.min(100, Math.round((p.pos||0) / total * 100)));
    const danger = !out && edge > 0 && (p.pos||0) < edge;
    const badge = out ? (st === 'done' ? '🏁' : st === 'eliminated' ? '💀' : st === 'dc' ? '📶' : '🚪')
      : st === 'dc' ? stateBadge('dc', p, isBR ? 'royale' : '1v1', sNow) : '';
    const outText = st === 'done' ? 'จบแล้ว' : st === 'eliminated' ? 'ตกรอบ' : 'ออกแล้ว';
    return (
      <button key={uid} data-nosound disabled={out} onClick={() => !out && onSpectate && onSpectate(uid)}
        title={out ? `${p.name||'ผู้เล่น'} · ${outText}` : `ดูหน้าจอของ ${p.name||'ผู้เล่น'}`}
        style={{ position:'relative', height:36, boxSizing:'border-box', display:'flex', alignItems:'center', gap:6, padding:'0 8px 3px',
          background: out ? '#E7DCC0' : '#FFF8E6', border:`3px solid ${danger?'#B3261E':'#3B2416'}`, opacity: out ? .7 : 1,
          fontFamily:tf, color:'#3B2416', cursor: out ? 'default' : 'pointer', textAlign:'left', minWidth:0 }}>
        <span style={{ fontSize:12, fontWeight:800, width:18, flex:'none', textAlign:'center', color:'#6A4A30' }}>{out ? badge : i + 1}</span>
        <span style={{ flex:1, minWidth:0, fontSize:13, fontWeight:800, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {p.name||'ผู้เล่น'}{!out && badge ? ' ' + badge : ''}</span>
        <span style={{ fontSize:11, fontWeight:700, flex:'none', whiteSpace:'nowrap', color: danger ? '#B3261E' : '#6A4A30' }}>
          {out ? outText : `${wpm} WPM`}</span>
        {isBR && <span style={{ fontSize:11, flex:'none', whiteSpace:'nowrap' }}>{lives > 0 ? '❤️' + lives : '💀'}</span>}
        <span style={{ position:'absolute', left:0, bottom:0, height:3, width:pct+'%', background: out ? '#9C8B6E' : danger ? '#EF4444' : '#059669' }}/>
      </button>
    );
  };

  return (
    <div style={{fontFamily:tf, display:'flex', flexDirection:'column', gap:8, flex:'1 1 auto', minHeight:0}}>
      {/* Header */}
      <div className="px-wood" style={{padding:'0 6px',display:'flex',alignItems:'center',gap:12,color:'#F5E6BE',flex:'none'}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,.6)',fontWeight:700,letterSpacing:2}}>
            {isBR ? '🏆 BATTLE ROYALE' : '⚔️ 1 VS 1'} · ห้อง {roomCode}</div>
          <div style={{fontSize:18,fontWeight:800,color:'#fff'}}>
            {alive.length} คนเหลือ · {dead.length} คนออก
            {watcherNote&&<span style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,.75)',marginLeft:10}}>{watcherNote}</span>}</div>
        </div>
        {isBR && zonePos > 0 && (
          <div style={{marginLeft:'auto',textAlign:'right',flex:'none'}}>
            <div style={{fontSize:10,color:'rgba(255,255,255,.6)',fontWeight:700}}>SAFE ZONE</div>
            <div style={{fontSize:20,fontWeight:800,color:'#FCD34D'}}>{zoneWpm} ตัว/นาที</div>
          </div>
        )}
      </div>

      {/* Lane: top 5 */}
      {runners.length > 0 && (
        <CharKit.RaceTrack mode={isBR ? 'royale' : '1v1'} scene height={laneH} style={{flex:'none'}}
          zonePct={edge / total} info={alive.length > 5 ? '5 อันดับแรก' : ''} runners={runners}/>
      )}

      {/* Everyone */}
      <div className="px-scroll" style={{flex:'1 1 auto', minHeight:0, overflowY:'auto', display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(210px, 1fr))', gridAutoRows:36, gap:6, alignContent:'start'}}>
        {alive.map(([uid,p], i) => card(uid, p, i, false))}
        {dead.map(([uid,p], i) => card(uid, p, i, true))}
      </div>

      <button onClick={onBack} className="px-btn" style={{flex:'none',minHeight:40,fontSize:14,fontFamily:tf}}>ออกจากห้อง</button>

      {toasts.length > 0 && ReactDOM.createPortal(
        <div aria-live="polite" style={{position:'fixed', right:16, bottom:16, zIndex:70, display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end', pointerEvents:'none'}}>
          {toasts.map(t => {
            const [icon, text] = OUT_NOTE[t.kind] || OUT_NOTE.left;
            return <div key={t.id} className="gd-pop" style={{background:'#FFF8E6', border:'3px solid #3B2416', boxShadow:'0 3px 0 rgba(0,0,0,.25)',
              padding:'6px 12px', fontFamily:tf, fontSize:14, fontWeight:800, color:'#3B2416', maxWidth:300}}>{icon} {t.name} {text}</div>;
          })}
        </div>, document.body)}
    </div>
  );
}

// SPECTATOR VIEW — render the selected player's text, not the host's local chunk.
export function SpectatorView({ playerName, targetChars, progress, onBack }) {
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
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
          style={{background:'var(--c-surf)',border:'3px solid var(--c-border)',
            color:'var(--c-t2)',borderRadius:7,padding:'5px 10px',cursor:'pointer',
            fontSize:12,fontFamily:tf}}>← กลับ</button>
        <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)'}}>
          👁 กำลังดู: {playerName}</div>
        <div style={{marginLeft:'auto',fontSize:11,color:'var(--c-t3)'}}>
          หน้า {chunkIdx+1}/{chunks.length}
        </div>
      </div>
      <div style={{background:'var(--c-surf)',borderRadius:14,padding:'22px 18px',
        border:'3px solid var(--c-border)',minHeight:96,
        display:'flex',alignItems:'center',justifyContent:'center'}}>
        <TextDisplay displayChars={chunkChars} displayPos={chunkPos}/>
      </div>
    </div>
  );
}

export function BattleRoyaleResults({ roomCode, roomPlayers, rows: lockedRows, onBack, sOffset=0, backLabel='ออกจากห้อง' }) {
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
  const sNow = Date.now()+sOffset;
  const rows = lockedRows || brOrder(roomPlayers, sNow);   // locked final order once available
  const label = p => {
    const st=playerState(p,'royale',sNow);
    return st==='done'?'พิมพ์จบแล้ว':isAliveState(st)?'รอดจนจบ':st==='eliminated'?'ถูกคัดออก':'ออกจากการแข่ง';
  };
  return (
    <div style={{fontFamily:tf}}>
      <div className="px-wood" style={{textAlign:'center',padding:'4px 12px',color:'#F5E6BE',marginBottom:14}}>
        <div style={{fontSize:42}}>🏆</div>
        <div style={{fontSize:22,fontWeight:800}}>จบการแข่งขัน Battle Royale</div>
        <div style={{fontSize:13,opacity:.8}}>ห้อง {roomCode} · สรุปผลผู้เล่น</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {rows.map(([uid,p],i)=>(
          <div key={uid} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',border:'3px solid #3B2416',background:i===0?'#FFE9A8':'var(--c-surf)'}}>
            <div style={{fontSize:19,fontWeight:800,width:32,textAlign:'center',color:i===0?'#D97706':'var(--c-t3)'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)'}}>{p.name||'ผู้เล่น'}</div>
              <div style={{fontSize:11,color:'var(--c-t2)'}}>{label(p)} · {p.pos||0} ตัวอักษร</div>
            </div>
            <div style={{fontSize:12,fontWeight:700,color:'var(--c-t2)'}}>{Math.round((p.cpm||p.wpm||0)/5)} WPM</div>
          </div>
        ))}
      </div>
      <button onClick={onBack} className="px-btn" style={{marginTop:16,width:'100%',minHeight:52,fontSize:16,fontFamily:tf}}>{backLabel}</button>
    </div>
  );
}
