import { apiRequest, describeApiError } from '../api';
import { auth, parseJwt } from '../auth';
import { GOOGLE_CLIENT_ID } from '../config';

const { useEffect, useState } = React;

export // CLASS PICKER — auto-lookup by email, fallback to manual entry

function ClassPickerScreen({ googleUser, onSelect, onBack }) {
  const [status, setStatus] = useState('looking'); // looking|found|notfound|error
  const [result, setResult] = useState(null); // {classCode, studentName}
  const [errMsg, setErrMsg] = useState('');
  const [attempt, setAttempt] = useState(0);
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";

  // Look up the signed-in Google account in Roster (re-runs on "ลองอีกครั้ง").
  useEffect(() => {
    let cancelled=false;
    setStatus('looking'); setErrMsg('');
    (async () => {
      try {
        const data = await apiRequest('lookupByEmail');
        if (cancelled) return;
        setResult(data);
        setStatus('found');
        onSelect(data.classCode, data.studentName, data.character);
      } catch (err) {
        if (cancelled) return;
        console.warn('lookupByEmail failed:',err?.message);
        setErrMsg(describeApiError(err));
        setStatus(err?.message==='Email not found in roster'?'notfound':'error');
      }
    })();
    return () => { cancelled=true; };
  }, [attempt]);

  const btn = {width:'100%',border:'none',borderRadius:10,padding:'13px',cursor:'pointer',
    fontSize:15,fontWeight:700,fontFamily:tf};

  return (
    <div style={{fontFamily:tf}}>
      {/* Profile */}
      <div style={{display:'flex',alignItems:'center',gap:12,background:'var(--c-surf)',
        borderRadius:14,padding:'14px 16px',marginBottom:20,border:'1.5px solid var(--c-border)'}}>
        <img src={googleUser.picture} alt="" referrerPolicy="no-referrer"
          style={{width:44,height:44,borderRadius:'50%',flexShrink:0}}/>
        <div>
          <div style={{fontSize:15,fontWeight:800,color:'var(--c-t1)'}}>{googleUser.name}</div>
          <div style={{fontSize:11,color:'var(--c-t3)'}}>{googleUser.email}</div>
        </div>
      </div>

      {status==='looking' && (
        <div style={{textAlign:'center',padding:'32px 0',color:'var(--c-t2)'}}>
          🔍 กำลังค้นหาห้องเรียน...
        </div>
      )}

      {status==='found' && result && (
        <div style={{background:'#D1FAE5',border:'2px solid #059669',borderRadius:14,
          padding:'20px',textAlign:'center'}}>
          <div style={{fontSize:32,marginBottom:8}}>✅</div>
          <div style={{fontSize:18,fontWeight:800,color:'#065F46'}}>พบห้องเรียนแล้ว!</div>
          <div style={{fontSize:14,color:'#047857',marginTop:6}}>
            ห้อง <strong>{result.classCode}</strong> · {result.studentName}
          </div>
          <div style={{fontSize:12,color:'#6EE7B7',marginTop:8}}>กำลังเข้าเรียน...</div>
        </div>
      )}

      {(status==='notfound'||status==='error') && (
        <div>
          <div style={{background:'#FEF3C7',border:'1.5px solid #FCD34D',borderRadius:12,
            padding:'14px 16px',marginBottom:16,fontSize:13,color:'#92400E',lineHeight:1.6}}>
            ⚠️ {errMsg}
            {status==='notfound' && (
              <div style={{marginTop:6,fontSize:12}}>
                ตรวจว่าเข้าสู่ระบบด้วยบัญชีโรงเรียน หรือแจ้งครูให้เพิ่ม email นี้ใน Roster
              </div>
            )}
          </div>
          <button onClick={()=>setAttempt(n=>n+1)}
            style={{...btn,background:'#0F172A',color:'#fff'}}>
            ↻ ลองอีกครั้ง
          </button>
        </div>
      )}

      <button onClick={onBack}
        style={{background:'transparent',border:'none',color:'var(--c-t3)',
          cursor:'pointer',fontSize:12,fontFamily:tf,textDecoration:'underline',marginTop:14,
          display:'block'}}>
        ← เปลี่ยน account
      </button>
    </div>
  );
}

export // GOOGLE SIGN-IN SCREEN

function GoogleSignInScreen({ onSignIn, onSolo }) {
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";

  useEffect(() => {
    let attempts = 0;
    const init = () => {
      if (typeof google === 'undefined' || !google.accounts) {
        if (attempts++ < 30) setTimeout(init, 200);
        return;
      }
      if (!auth.gisInit) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            const profile = parseJwt(response.credential);
            if (profile) onSignIn(profile, response.credential);
          },
          auto_select: false,
          ux_mode: 'popup',
          // Prefer the browser-mediated Sign in with Google button flow. This
          // avoids relying on cross-window postMessage from a popup where the
          // hosting platform does not let us configure COOP response headers.
          use_fedcm_for_button: true,
        });
        auth.gisInit = true;
      }
      const btn = document.getElementById('google-signin-btn');
      if (btn) {
        google.accounts.id.renderButton(btn, {
          theme: 'filled_blue', size: 'large',
          width: 280, text: 'signin_with', locale: 'th',
          shape: 'pill',
        });
      }
    };
    init();
  }, []);

  return (
    <div style={{fontFamily:tf}}>
      <div style={{background:'linear-gradient(150deg,#1E3A8A 0%,#2563EB 55%,#3B82F6 100%)',
        borderRadius:20,padding:'36px 24px 28px',position:'relative',overflow:'hidden',
        marginBottom:16}}>
        <div style={{position:'absolute',top:-40,right:-40,width:130,height:130,
          borderRadius:'50%',background:'rgba(255,255,255,.07)'}}/>
        <div style={{textAlign:'center',position:'relative'}}>
          <div style={{fontSize:56,marginBottom:8}}>⌨️</div>
          <h1 style={{fontFamily:tf,fontSize:27,fontWeight:800,color:'#fff',margin:'0 0 4px'}}>
            แบบฝึกพิมพ์ไทย</h1>
          <p style={{fontSize:11,color:'#93C5FD',margin:'0 0 28px',fontWeight:700,letterSpacing:1}}>
            KEDMANEE TYPING · TIS 820-2538</p>
          <div style={{background:'rgba(255,255,255,.12)',borderRadius:14,padding:'20px',
            display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
            <div style={{fontSize:13,color:'rgba(255,255,255,.8)',fontFamily:tf,fontWeight:600}}>
              เข้าสู่ระบบด้วย Google เพื่อบันทึกผลและดูสถิติ
            </div>
            <div id="google-signin-btn"></div>
          </div>
        </div>
      </div>
      <div style={{textAlign:'center'}}>
        <button onClick={onSolo}
          style={{background:'transparent',border:'none',color:'var(--c-t3)',
            cursor:'pointer',fontSize:12,fontFamily:tf,textDecoration:'underline'}}>
          ข้ามและฝึกคนเดียว (ไม่บันทึกผล)
        </button>
      </div>
    </div>
  );
}
