import { apiRequest, apiTitleRunners, describeApiError } from '../api';
import { resolveKey } from '../engine/keymap';
import { INK, PX_FONT, PxButton, PxIconButton, PxPanel, Runners, Scene, TH_FONT } from '../ui/pixel';
import { auth, parseJwt } from '../auth';
import { GOOGLE_CLIENT_ID } from '../config';

const { useEffect, useRef, useState } = React;

// CLASS PICKER — auto-lookup by email, fallback to manual entry

export function ClassPickerScreen({ googleUser, onSelect, onBack }) {
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

// TITLE + GOOGLE SIGN-IN SCREEN
// Stage 1 (title): pixel scene, logo, "type เริ่ม to start", classmates' characters running.
// Stage 2 (signin): parchment panel with the Google button and "try without saving".

const START_WORD = [...'เริ่ม'];
// Shown as whole syllables (a vowel mark never sits alone); a part turns green once all its letters are typed.
const START_PARTS = [['เ', 1], ['ริ่', 4], ['ม', 5]];
const HELP_LINES = [
  'วางนิ้วชี้ซ้ายที่ ด และนิ้วชี้ขวาที่ ่ (มีปุ่มนูนให้คลำหา)',
  'แต่ละบทมี 5 ขั้น — พิมพ์ให้แม่นก่อน แล้วค่อยเร่งความเร็ว เพื่อเก็บดาว',
  'ชนะบอสประจำด่าน เพื่อเปิดด่านต่อไปในแผนที่ผจญภัย',
];

export function GoogleSignInScreen({ onSignIn, onSolo }) {
  const [stage, setStage] = useState('title');   // title | signin
  const [typed, setTyped] = useState(0);         // letters of เริ่ม typed so far
  const [shake, setShake] = useState(0);
  const [help, setHelp] = useState(false);
  const [runners, setRunners] = useState(() => {
    // This computer's last signed-in character runs out first.
    const mine = window.CharKit ? CharKit.loadLocal('last') : null;
    return mine ? [mine] : [];
  });
  const typedRef = useRef(0);

  // Classmates' characters (looks only — no names) for the runners.
  useEffect(() => {
    let off = false;
    apiTitleRunners().then(list => {
      if (off || !list.length) return;
      setRunners(prev => [...prev, ...list]);
    });
    return () => { off = true; };
  }, []);

  // Type เริ่ม (physical Kedmanee keys, so it works even with the English layout on).
  useEffect(() => {
    if (stage !== 'title') return;
    const onKey = (e) => {
      if (help) { if (e.key === 'Escape') setHelp(false); return; }
      const r = resolveKey(e);
      if (!r || !r.char) return;
      e.preventDefault();
      const want = START_WORD[typedRef.current];
      if (r.char === want) {
        typedRef.current++;
        setTyped(typedRef.current);
        if (typedRef.current >= START_WORD.length) setTimeout(() => setStage('signin'), 350);
      } else setShake(n => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, help]);

  // Google's own button, drawn into the sign-in panel.
  useEffect(() => {
    if (stage !== 'signin') return;
    let attempts = 0, stop = false;
    const init = () => {
      if (stop) return;
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
          theme: 'outline', size: 'large', width: 300, text: 'signin_with', locale: 'th', shape: 'rectangular',
        });
      }
    };
    init();
    return () => { stop = true; };
  }, [stage]);

  const goSignIn = () => { typedRef.current = START_WORD.length; setTyped(START_WORD.length); setStage('signin'); };
  const back = () => { typedRef.current = 0; setTyped(0); setStage('title'); };
  const outline = { color: '#FFFFFF', textShadow: '3px 3px 0 #1E3A4C, -2px 0 0 #1E3A4C, 2px 0 0 #1E3A4C, 0 -2px 0 #1E3A4C, 0 2px 0 #1E3A4C' };
  const small = stage === 'signin';

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'auto', fontFamily: TH_FONT, color: INK }}>
      <Scene dim={small ? 0.35 : 0}>
        <Runners queue={runners}/>
      </Scene>
      <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: small ? '40px 16px 120px' : '64px 16px 220px', gap: small ? 30 : 42 }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <h1 className="px-logo" style={{ margin: 0, fontFamily: "'Kanit', sans-serif", fontStyle: 'italic', fontWeight: 800,
            fontSize: small ? 'clamp(44px, 8vw, 76px)' : 'clamp(52px, 10vw, 104px)', lineHeight: 1.25, padding: '0 20px' }}>
            แป้นพิมพ์ผจญภัย</h1>
          <div className="px-panel" style={{ padding: '0 10px', fontFamily: PX_FONT, fontSize: small ? 16 : 20, fontWeight: 700,
            letterSpacing: 4, marginTop: -8 }}>ANSTH TYPING QUEST</div>
        </div>

        {stage === 'title' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="px-blink" style={{ fontSize: 26, fontWeight: 700, ...outline }}>พิมพ์คำว่า</div>
              <button key={shake} className={'px-panel' + (shake ? ' px-shake' : '')} onClick={goSignIn}
                aria-label="พิมพ์คำว่า เริ่ม หรือแตะเพื่อเริ่ม"
                style={{ padding: '0 22px', fontFamily: TH_FONT, fontSize: 54, fontWeight: 700, lineHeight: 1.4,
                  letterSpacing: 2, cursor: 'pointer', color: INK }}>
                {START_PARTS.map(([t, n]) => <span key={n} style={{ color: typed >= n ? '#2E7D32' : INK }}>{t}</span>)}
              </button>
              <div style={{ display: 'flex', gap: 6 }} aria-hidden="true">
                {START_WORD.map((_, i) => <span key={i} style={{ width: 14, height: 14, border: '3px solid ' + INK,
                  background: i < typed ? '#4CAF50' : '#F5E6BE' }}/>)}
              </div>
              <div className="px-blink" style={{ fontSize: 26, fontWeight: 700, ...outline }}>เพื่อออกผจญภัย</div>
              <div style={{ fontSize: 14, fontWeight: 600, ...outline, textShadow: '2px 2px 0 #1E3A4C' }}>(หรือแตะที่คำ)</div>
            </div>
            <div style={{ display: 'flex', gap: 46, alignItems: 'flex-end', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[['สำหรับครู', 'i_person', null, 'teacher.html'], ['วิธีเล่น', 'i_help', () => setHelp(true)], ['ทดลองเล่น', 'i_play', onSolo]]
                .map(([label, icon, onClick, href]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 17, fontWeight: 700, ...outline }}>{label}</span>
                    <PxIconButton icon={icon} label={label} onClick={onClick} href={href}/>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <PxPanel title="เข้าเล่นด้วยบัญชีโรงเรียน" style={{ width: '100%', maxWidth: 460 }}
            bodyStyle={{ padding: '10px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 600, color: '#5A3A22' }}>
              ดาว ด่านที่ผ่าน และตัวละครของเธอจะถูกเก็บไว้ เล่นต่อเครื่องไหนก็ได้</div>
            <div style={{ background: '#FFFFFF', border: '3px solid ' + INK, padding: 6, minHeight: 56, display: 'flex',
              alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <div id="google-signin-btn"></div>
            </div>
            <div style={{ display: 'flex', gap: 12, width: '100%' }}>
              <PxButton style={{ flex: 1, fontSize: 16 }} onClick={onSolo}>ทดลองเล่น</PxButton>
              <PxButton style={{ flex: 1, fontSize: 16 }} onClick={back}>← กลับ</PxButton>
            </div>
            <div style={{ fontSize: 12, color: '#6A4A30' }}>ทดลองเล่น = ฝึกได้ทุกอย่าง แต่ไม่บันทึกดาวและคะแนน</div>
          </PxPanel>
        )}
      </div>

      {help && (
        <div role="dialog" aria-modal="true" aria-label="วิธีเล่น" onClick={() => setHelp(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,30,40,.55)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16, zIndex: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520 }}>
            <PxPanel title="วิธีเล่น" bodyStyle={{ padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {HELP_LINES.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 16, fontWeight: 600, lineHeight: 1.6 }}>
                  <span style={{ fontFamily: PX_FONT, fontSize: 20, fontWeight: 700, color: '#2E7D32' }}>{i + 1}</span>{t}
                </div>
              ))}
              <PxButton onClick={() => setHelp(false)}>เข้าใจแล้ว</PxButton>
            </PxPanel>
          </div>
        </div>
      )}
    </div>
  );
}
