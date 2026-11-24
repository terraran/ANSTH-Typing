// Gems 💎 on screen: the wallet in the wooden bar, the "gems earned" box on the results screen,
// gems flying into the wallet, and the one-time notices (back pay, weekly prize). Rules: src/engine/gems.js
import { Sprite, PxButton } from './pixel';
import { isNote, lineText } from '../engine/gems';
import { roomLabel } from '../teacher/rooms';

const { useEffect, useRef, useState } = React;
export const fmtGems = n => (Number(n) || 0).toLocaleString('en-US');

export function Gem({ size = 's' }) { return <Sprite name="i_gem" className={'gem-' + size}/>; }

// Wallet in the wooden bar (id="wallet": the gems fly here). bumpKey changes → it bounces.
export function WalletPill({ gems, onClick, bumpKey }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el || !bumpKey) return;
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }, [bumpKey]);
  return (
    <button ref={ref} id="wallet" className="wallet" onClick={onClick} title="เพชรของฉัน — กดเพื่อไปร้านแต่งตัว" aria-label={'เพชร ' + fmtGems(gems) + ' เม็ด'}>
      <Sprite name="i_gem" className="gem-m"/>{fmtGems(gems)}
    </button>
  );
}

// A few gems fly from an element to the wallet.
export function flyGems(fromEl) {
  const w = document.getElementById('wallet');
  if (!fromEl || !w) return;
  const a = fromEl.getBoundingClientRect(), b = w.getBoundingClientRect();
  for (let i = 0; i < 6; i++) setTimeout(() => {
    const g = document.createElement('span');
    g.className = 'sp sp-i_gem gem-fly';
    g.style.cssText = `left:${a.left / 0.6}px;top:${a.top / 0.6}px;zoom:.6;--dx:${(b.left - a.left) / 0.6}px;--dy:${(b.top - a.top) / 0.6}px`;
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 950);
  }, i * 70);
}

// "Gems earned" box. loot = { earned, lines } from the server (or the demo wallet). onLanded: after the count-up + flight.
export function GemLoot({ loot, onLanded }) {
  const [shown, setShown] = useState(0);
  const totRef = useRef(null), done = useRef(false);
  useEffect(() => {
    if (!loot) return;
    let raf = 0; const t0 = performance.now(), to = loot.earned;
    const step = now => {
      const n = Math.round(to * Math.min(1, (now - t0) / 700));
      setShown(n);
      if (n < to) raf = requestAnimationFrame(step);
      else if (!done.current) {
        done.current = true;
        if (to > 0) { flyGems(totRef.current); setTimeout(() => onLanded?.(), 800); } else onLanded?.();
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [loot]);
  if (!loot) return null;
  const paidLines = loot.lines.filter(l => !isNote(l));
  if (paidLines.length <= 1) return (       // one line: the reason and the total on one row (results screen has little room)
    <div className="gem-loot" role="status">
      {loot.lines.filter(isNote).map((l, i) => <div key={i} className="note">{lineText(l)}</div>)}
      <div className="tot" style={{ borderTop: 0, paddingTop: 0 }}>
        <span style={{ fontSize: 14 }}>{paidLines[0] ? lineText(paidLines[0]) : 'เพชรที่ได้'}</span>
        <b ref={totRef}><Gem size="m"/>+{fmtGems(shown)}</b></div>
    </div>
  );
  return (
    <div className="gem-loot" role="status">
      {loot.lines.map((l, i) => isNote(l)
        ? <div key={i} className="note">{lineText(l)}</div>
        : <div key={i} className="ln"><span>{lineText(l)}</span><span>+{fmtGems(l.amount)}</span></div>)}
      <div className="tot"><span>เพชรที่ได้</span><b ref={totRef}><Gem size="m"/>+{fmtGems(shown)}</b></div>
    </div>
  );
}

// One-time notices, one after another: gems for stars earned before the shop opened, last week's weekly-test place.
export function GemNotices({ notices, onDone }) {
  const n = notices?.[0];
  useEffect(() => {
    if (!n) return;
    const onKey = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); onDone(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [n]);
  if (!n) return null;
  const big = <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 22, color: '#1F5F7A', display: 'flex', alignItems: 'center', gap: 6 }}>
    <Gem size="m"/>+{fmtGems(n.amount)}</div>;
  return (
    <div className="shop-veil">
      <div style={{ width: 'min(520px, 92vw)', display: 'flex', flexDirection: 'column' }}>
        <div className="px-head" style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF6D8',
          fontWeight: 800, fontSize: 19, textShadow: '2px 2px 0 #2B4A3A', marginBottom: -6, position: 'relative' }}>
          {n.kind === 'backpay' ? 'ร้านแต่งตัวเปิดแล้ว! 🛍️' : 'รางวัลแบบทดสอบสัปดาห์ที่แล้ว 🏆'}</div>
        <div className="px-panel" style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center', color: '#3B2416' }}>
          {n.kind === 'backpay' ? <>
            <div style={{ fontSize: 16, fontWeight: 700 }}>ดาวที่สะสมมาก่อนหน้านี้ เปลี่ยนเป็นเพชรให้แล้ว</div>
            <div style={{ fontSize: 14 }}>⭐ {n.stars} ดวง{n.rush ? ` · ⚔️ ผ่านด้วย Rush ${n.rush} บท` : ''}</div>
            {big}
            <div style={{ fontSize: 13, color: '#6A4A30' }}>ต่อจากนี้ได้เพชรทุกครั้งที่เล่น · ได้ดาวใหม่ได้เพชรเยอะที่สุด · ใช้ซื้อของในร้านแต่งตัว</div>
          </> : <>
            <Sprite name="i_trophy"/>
            <div style={{ fontSize: 17, fontWeight: 800 }}>ได้อันดับ {n.place} ของห้อง{n.room ? ' ' + roomLabel(n.room) : ''}!</div>
            {big}
          </>}
          <PxButton onClick={onDone} style={{ width: '100%', minHeight: 46, fontSize: 16 }}>เยี่ยม!</PxButton>
        </div>
      </div>
    </div>
  );
}
