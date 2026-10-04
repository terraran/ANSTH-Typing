const { useState } = React;

export function LandingScreen({ onStart, onLogin }) {
  const [word, setWord] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const ready = word.trim() === 'เริ่ม';

  return (
    <main className="landing-screen">
      <div className="landing-brand">
        <div className="landing-emblem" aria-hidden="true">⌨</div>
        <div className="pixel-title landing-title">แป้นพิมพ์ผจญภัย</div>
        <div className="landing-subtitle">ANSTH TYPING QUEST</div>
      </div>

      <section className="landing-prompt" aria-label="เริ่มผจญภัย">
        <div className="landing-hint">พิมพ์คำว่า</div>
        <form onSubmit={e => { e.preventDefault(); if (ready) onStart(); }}>
          <input
            autoFocus
            aria-label="พิมพ์คำว่าเริ่มเพื่อออกผจญภัย"
            autoComplete="off"
            value={word}
            onChange={e => setWord(e.target.value)}
            placeholder="เริ่ม"
            maxLength={12}
            className={ready ? 'landing-word is-ready' : 'landing-word'}
          />
          <button type="submit" className="landing-start" disabled={!ready}>ออกผจญภัย →</button>
        </form>
        <div className="landing-footnote">ใช้แป้นพิมพ์ภาษาไทย แล้วกด Enter</div>
      </section>

      <nav className="landing-links" aria-label="เมนูเพิ่มเติม">
        <button onClick={onLogin} aria-label="เข้าสู่ระบบ">👤 <span>เข้าสู่ระบบ</span></button>
        <button onClick={() => setShowHelp(true)} aria-label="วิธีเล่น">? <span>วิธีเล่น</span></button>
        <button onClick={onStart} aria-label="ทดลองเล่น">▶ <span>ทดลองเล่น</span></button>
      </nav>
      <div className="landing-school">AMNUAY SILPA SCHOOL · KEDMANEE</div>

      {showHelp && (
        <div className="landing-modal-backdrop" role="presentation" onClick={() => setShowHelp(false)}>
          <section className="landing-modal" role="dialog" aria-modal="true" aria-labelledby="landing-help-title" onClick={e => e.stopPropagation()}>
            <button className="landing-close" onClick={() => setShowHelp(false)} aria-label="ปิด">×</button>
            <h2 id="landing-help-title" className="pixel-title">วิธีออกผจญภัย</h2>
            <ol>
              <li>เลือกด่านและบทเรียนที่อยากฝึก</li>
              <li>พิมพ์ข้อความตามลำดับให้ถูกต้อง</li>
              <li>สะสมดาว แล้วปลดล็อกบทต่อไป</li>
            </ol>
            <button className="landing-start" onClick={() => { setShowHelp(false); onStart(); }}>เข้าเล่น →</button>
          </section>
        </div>
      )}
    </main>
  );
}
