const { useEffect, useState } = React;
const tf = "'Sarabun','Noto Sans Thai',sans-serif";

// Asked before leaving a race that is still running.
export function LeaveConfirm({ roomType, onStay, onLeave }) {
  const duel = roomType === '1v1';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,.6)',zIndex:1100,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:tf}}>
      <div style={{background:'var(--c-card)',borderRadius:18,padding:'24px 22px',maxWidth:380,width:'100%',
        textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,.3)'}}>
        <div style={{fontSize:44,lineHeight:1}}>🚪</div>
        <div style={{fontSize:20,fontWeight:800,color:'var(--c-t1)',margin:'10px 0 6px'}}>กำลังแข่งอยู่ จะออกไหม?</div>
        <div style={{fontSize:14,color:'var(--c-t2)',lineHeight:1.6,marginBottom:18}}>
          {duel ? 'ถ้าออกตอนนี้ คุณจะแพ้ทันที และคู่แข่งชนะ'
                : 'ถ้าออกตอนนี้ คุณจะถูกนับว่าออกจากการแข่งขัน และกลับเข้ามาไม่ได้'}
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onStay} autoFocus
            style={{flex:1,background:'#059669',color:'#fff',border:'none',borderRadius:10,padding:'12px',
              cursor:'pointer',fontSize:15,fontWeight:800,fontFamily:tf}}>แข่งต่อ</button>
          <button onClick={onLeave}
            style={{flex:1,background:'transparent',color:'#DC2626',border:'1.5px solid #FCA5A5',borderRadius:10,
              padding:'12px',cursor:'pointer',fontSize:15,fontWeight:700,fontFamily:tf}}>ออกจากการแข่ง</button>
        </div>
      </div>
    </div>
  );
}

// Shown on the sign-in / lessons screen when this account dropped out of a race
// it can still return to. `expiresAt` is local time (ms).
export function RejoinBanner({ offer, busy, onRejoin, onDismiss }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 500); return () => clearInterval(id); }, []);
  const left = Math.max(0, Math.ceil((offer.expiresAt - Date.now()) / 1000));
  useEffect(() => { if (left <= 0) onDismiss(true); }, [left <= 0]);
  return (
    <div style={{display:'flex',alignItems:'center',gap:12,background:'#FEF3C7',border:'2px solid #F59E0B',
      borderRadius:14,padding:'12px 16px',marginBottom:16,fontFamily:tf}}>
      <span style={{fontSize:26}}>📶</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:15,fontWeight:800,color:'#92400E'}}>
          คุณหลุดจากการแข่ง {offer.type==='1v1'?'1v1':'Battle Royale'} ห้อง {offer.code}</div>
        <div style={{fontSize:12,color:'#B45309'}}>กลับเข้าแข่งได้อีก {left} วินาที · ตำแหน่งและชีวิตเดิมยังอยู่</div>
      </div>
      <button onClick={onRejoin} disabled={busy}
        style={{background:'#D97706',color:'#fff',border:'none',borderRadius:10,padding:'10px 16px',
          cursor:busy?'default':'pointer',fontSize:14,fontWeight:800,fontFamily:tf,whiteSpace:'nowrap',opacity:busy?.6:1}}>
        {busy?'กำลังเชื่อมต่อ...':'🔄 กลับเข้าแข่ง'}
      </button>
      <button onClick={()=>onDismiss(false)} title="ไม่กลับเข้าแข่ง" aria-label="ปิด"
        style={{background:'none',border:'none',color:'#92400E',cursor:'pointer',fontSize:16,padding:4}}>✕</button>
    </div>
  );
}
