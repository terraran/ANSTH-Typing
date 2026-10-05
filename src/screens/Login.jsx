import { apiRequest, apiTitleRunners, describeApiError } from '../api';
import { resolveKey, thaiOfTyped } from '../engine/keymap';
import { INK, PX_FONT, PxButton, PxIconButton, PxPanel, Runners, Scene, Sprite, TH_FONT } from '../ui/pixel';
import { auth, parseJwt } from '../auth';
import { GOOGLE_CLIENT_ID } from '../config';

const { useEffect, useRef, useState } = React;

// CLASS PICKER — auto-lookup by email, fallback to manual entry

// Quiet text link for teachers — bottom corner, low contrast, so students are not drawn to it.
function TeacherLink() {
  return (
    <a href="teacher.html" style={{ position: 'fixed', right: 12, bottom: 8, zIndex: 2, fontSize: 12, fontWeight: 600,
      color: 'rgba(255,255,255,.75)', textDecoration: 'none', fontFamily: TH_FONT, textShadow: '1px 1px 0 rgba(0,0,0,.35)' }}>
      สำหรับครู ›</a>
  );
}

export function ClassPickerScreen({ googleUser, onSelect, onBack }) {
  const [status, setStatus] = useState('looking'); // looking|found|notfound|error
  const [result, setResult] = useState(null); // {classCode, studentName}
  const [errMsg, setErrMsg] = useState('');
  const [attempt, setAttempt] = useState(0);
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

  // Full-screen, same scene as the title: a parchment panel with the account and what is happening.
  const look = window.CharKit ? (CharKit.loadLocal(googleUser?.email) || CharKit.fromName(googleUser?.name || 'ผู้เล่น')) : null;
  return (
    <div style={{ position:'fixed', inset:0, overflowY:'auto', fontFamily:TH_FONT, color:INK }}>
      <div style={{ position:'fixed', inset:0 }}><Scene dim={0.35}/></div>
      <TeacherLink/>
      <div style={{ position:'relative', minHeight:'100%', boxSizing:'border-box', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <PxPanel title="เข้าเล่นด้วยบัญชีโรงเรียน" style={{ width:'100%', maxWidth:480 }}
          bodyStyle={{ padding:'8px 14px 14px', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Account */}
          <div style={{ display:'flex', alignItems:'center', gap:12, background:'#F8EED2', border:'3px solid '+INK, padding:'8px 12px' }}>
            {googleUser.picture && <img src={googleUser.picture} alt="" referrerPolicy="no-referrer"
              style={{ width:44, height:44, border:'3px solid '+INK, flexShrink:0 }}/>}
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>{googleUser.name}</div>
              <div style={{ fontSize:13, color:'#6A4A30', overflow:'hidden', textOverflow:'ellipsis' }}>{googleUser.email}</div>
            </div>
          </div>

          {status==='looking' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'6px 0' }}>
              {look && <CharKit.CharCanvas config={look} anim="run" scale={2}/>}
              <div style={{ fontSize:17, fontWeight:700 }} className="px-blink">กำลังค้นหาห้องเรียนของเธอ...</div>
            </div>
          )}

          {status==='found' && result && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'6px 0', textAlign:'center' }}>
              {look && <CharKit.CharCanvas config={CharKit.sanitize(result.character) || look} anim="cheer" scale={2}/>}
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:20, fontWeight:700, color:'#2E7D32' }}>
                <Sprite name="i_check"/> เจอห้องเรียนแล้ว!</div>
              <div style={{ fontSize:16, fontWeight:600 }}>
                ห้อง <span style={{ fontFamily:PX_FONT, fontWeight:400 }}>{result.classCode}</span> · {result.studentName}</div>
              <div style={{ fontSize:14, color:'#6A4A30' }}>กำลังพาเข้าสู่หน้าหลัก...</div>
            </div>
          )}

          {(status==='notfound'||status==='error') && (
            <>
              <div role="alert" style={{ display:'flex', gap:10, alignItems:'flex-start', background:'#FFE9A8', border:'3px solid '+INK,
                padding:'10px 12px', fontSize:15, fontWeight:600, lineHeight:1.6 }}>
                <Sprite name="i_help" style={{ flexShrink:0 }}/>
                <div>
                  {errMsg}
                  {status==='notfound' && <div style={{ marginTop:4, fontSize:14 }}>
                    ตรวจว่าเข้าด้วยบัญชีโรงเรียน หรือแจ้งครูให้เพิ่มอีเมลนี้ในรายชื่อห้อง</div>}
                </div>
              </div>
              <PxButton onClick={()=>setAttempt(n=>n+1)}>↻ ลองอีกครั้ง</PxButton>
            </>
          )}

          <PxButton onClick={onBack} style={{ fontSize:15, minHeight:46 }}>← เปลี่ยนบัญชี</PxButton>
        </PxPanel>
      </div>
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

  // Type เริ่ม. Keys arrive two ways and both are handled:
  //  • keydown with a physical key code (normal keyboards, Thai or English layout on);
  //  • text typed into a hidden, focused input (input methods / virtual keyboards that send no usable keydown).
  // The vowel ิ and tone mark ่ may come in either order.
  const inputRef = useRef(null);
  const lastKeyAt = useRef(0);
  const swapRef = useRef(null);
  const feed = (ch) => {
    const i = typedRef.current;
    if (i >= START_WORD.length || !ch) return;
    let ok = ch === START_WORD[i];
    if (!ok && (i === 2 || i === 3)) {        // ิ / ่ in either order
      const pair = [START_WORD[2], START_WORD[3]];
      ok = pair.includes(ch) && ch !== swapRef.current;
    }
    if (ok) {
      if (i === 2) swapRef.current = ch;
      typedRef.current = i + 1;
      setTyped(i + 1);
      if (i + 1 >= START_WORD.length) setTimeout(() => setStage('signin'), 350);
    } else setShake(n => n + 1);
  };
  useEffect(() => {
    if (stage !== 'title') return;
    const focus = () => { if (!help) inputRef.current?.focus({ preventScroll: true }); };
    focus();
    const onKey = (e) => {
      if (help) { if (e.key === 'Escape') setHelp(false); return; }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') return;   // let buttons work
      const r = resolveKey(e);
      if (!r || !r.char) return;                // e.g. key = "Process": wait for the input event
      e.preventDefault();
      lastKeyAt.current = performance.now();
      feed(r.char);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('focus', focus);
    return () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('focus', focus); };
  }, [stage, help]);
  const onHiddenInput = (e) => {
    const text = e.target.value; e.target.value = '';
    if (performance.now() - lastKeyAt.current < 120) return;     // already counted by keydown
    for (const c of [...text]) feed(thaiOfTyped(c));
  };

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
  const back = () => { typedRef.current = 0; swapRef.current = null; setTyped(0); setStage('title'); };
  const outline = { color: '#FFFFFF', textShadow: '3px 3px 0 #1E3A4C, -2px 0 0 #1E3A4C, 2px 0 0 #1E3A4C, 0 -2px 0 #1E3A4C, 0 2px 0 #1E3A4C' };
  const small = stage === 'signin';

  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', overflowX: 'hidden', fontFamily: TH_FONT, color: INK }}
      onMouseDown={e => { if (stage === 'title' && !e.target.closest('button,a')) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0); }}>
      {/* Scene and runners stay put while the content scrolls (short screens only) */}
      <TeacherLink/>
      <div style={{ position: 'fixed', inset: 0 }}>
        <Scene dim={small ? 0.35 : 0}>
          <Runners queue={runners} bottom={'max(16px, 3vh)'}/>
        </Scene>
      </div>
      {stage === 'title' && (
        <input ref={inputRef} onInput={onHiddenInput} aria-label="พิมพ์คำว่า เริ่ม" autoComplete="off" autoCapitalize="off" spellCheck={false}
          style={{ position: 'fixed', left: 0, top: 0, width: 1, height: 1, opacity: 0, border: 0, padding: 0 }}/>
      )}
      <div style={{ position: 'relative', minHeight: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: small ? 'flex-start' : 'center',
        padding: small ? 'clamp(20px, 5vh, 40px) 16px 40px' : 'clamp(12px, 3vh, 40px) 16px clamp(80px, 16vh, 190px)',
        gap: small ? 'clamp(16px, 3.5vh, 30px)' : 'clamp(10px, 2.6vh, 34px)' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <h1 className="px-logo" style={{ margin: 0, fontFamily: "'Kanit', sans-serif", fontStyle: 'italic', fontWeight: 800,
            fontSize: small ? 'clamp(40px, min(8vw, 9vh), 76px)' : 'clamp(40px, min(10vw, 10.5vh), 104px)', lineHeight: 1.25, padding: '0 20px' }}>
            แป้นพิมพ์ผจญภัย</h1>
          <div className="px-panel" style={{ padding: '0 10px', fontFamily: PX_FONT, fontSize:small ? 12 : 16, fontWeight:400,
            letterSpacing:2, marginTop: -8 }}>ANSTH TYPING QUEST</div>
        </div>

        {stage === 'title' ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(4px, 1.2vh, 12px)' }}>
              <div className="px-blink" style={{ fontSize: 26, fontWeight: 700, ...outline }}>พิมพ์คำว่า</div>
              <button key={shake} className={'px-panel' + (shake ? ' px-shake' : '')} onClick={goSignIn} tabIndex={-1}
                aria-label="พิมพ์คำว่า เริ่ม หรือแตะเพื่อเริ่ม"
                style={{ padding: '0 22px', fontFamily: TH_FONT, fontSize: 'clamp(40px, 6.5vh, 54px)', fontWeight: 700, lineHeight: 1.4,
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
              {[['วิธีเล่น', 'i_help', () => setHelp(true)], ['ทดลองเล่น', 'i_play', onSolo]]
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
                  <span style={{ fontFamily: PX_FONT, fontSize:16, fontWeight:400, color: '#2E7D32' }}>{i + 1}</span>{t}
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
