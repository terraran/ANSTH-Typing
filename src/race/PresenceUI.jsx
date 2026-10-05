const { useEffect, useState } = React;
const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";

// Asked before leaving a race that is still running.
export function LeaveConfirm({ roomType, onStay, onLeave }) {
  const duel = roomType === '1v1';
  return (
    <div role="alertdialog" aria-label="ออกจากการแข่ง" style={{position:'fixed',inset:0,background:'rgba(10,30,40,.6)',zIndex:1100,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16,fontFamily:tf}}>
      <div style={{maxWidth:420,width:'100%',display:'flex',flexDirection:'column'}}>
        <div className="px-head" style={{minHeight:56,display:'flex',alignItems:'center',justifyContent:'center',color:'#FFF6D8',
          fontSize:20,fontWeight:700,textShadow:'2px 2px 0 #2B4A3A',marginBottom:-6,position:'relative'}}>กำลังแข่งอยู่ จะออกไหม?</div>
        <div className="px-panel" style={{padding:'6px 10px 10px',textAlign:'center',color:'#3B2416'}}>
        <div style={{fontSize:15,fontWeight:600,lineHeight:1.6,marginBottom:16}}>
          {duel ? 'ถ้าออกตอนนี้ คุณจะแพ้ทันที และคู่แข่งชนะ'
                : 'ถ้าออกตอนนี้ คุณจะถูกนับว่าออกจากการแข่งขัน และกลับเข้ามาไม่ได้'}
        </div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onStay} autoFocus className="px-btn"
            style={{flex:1,minHeight:52,fontSize:17,fontFamily:tf}}>แข่งต่อ</button>
          <button onClick={onLeave}
            style={{flex:1,background:'#F8EED2',color:'#B3261E',border:'3px solid #3B2416',
              minHeight:52,cursor:'pointer',fontSize:15,fontWeight:700,fontFamily:tf}}>ออกจากการแข่ง</button>
        </div>
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
    <div role="status" style={{display:'flex',alignItems:'center',gap:12,background:'#FFE9A8',border:'3px solid #3B2416',
      padding:'10px 14px',marginBottom:16,fontFamily:tf,flexWrap:'wrap'}}>
      <span style={{fontSize:26}}>📶</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:16,fontWeight:700,color:'#3B2416'}}>
          คุณหลุดจากการแข่ง {offer.type==='1v1'?'1v1':'Battle Royale'} ห้อง {offer.code}</div>
        <div style={{fontSize:14,fontWeight:600,color:'#6A4A30'}}>กลับเข้าแข่งได้อีก {left} วินาที · ตำแหน่งและชีวิตเดิมยังอยู่</div>
      </div>
      <button onClick={onRejoin} disabled={busy} className="px-btn"
        style={{minHeight:48,padding:'0 6px',fontSize:15,fontFamily:tf,whiteSpace:'nowrap'}}>
        {busy?'กำลังเชื่อมต่อ...':'🔄 กลับเข้าแข่ง'}
      </button>
      <button onClick={()=>onDismiss(false)} title="ไม่กลับเข้าแข่ง" aria-label="ปิด" className="sp sp-i_x px-icon-btn"/>
    </div>
  );
}
