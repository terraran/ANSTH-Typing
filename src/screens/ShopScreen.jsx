// Dress-up shop = the character screen when the shop is on (EDITION.shop).
// Free looks and bought ones are put on right away; shop looks can be tried on, then bought with gems 💎.
// Mock: .claude/mock/shop.html
import { SHOP_PRICES, SHOP_SOON, itemKey, ownsLook, priceOf, unownedKeys } from '../data/shop';
import { FIRST_GEMS, RACE_GEMS, REPLAYS_PER_DAY, RACES_PER_DAY, WEEKLY_GEMS } from '../engine/gems';
import { Gem, fmtGems } from '../ui/gems';
import { PxButton, Sprite, useShortScreen } from '../ui/pixel';

const { useEffect, useLayoutEffect, useMemo, useRef, useState } = React;
const h = React.createElement;

const CATS = [
  { k: 'body', t: 'ชุด' }, { k: 'hair', t: 'ทรงผม' }, { k: 'hairColor', t: 'สีผม' },
  { k: 'skin', t: 'สีผิว' }, { k: 'socks', t: 'ถุงเท้า' }, { k: 'shoes', t: 'รองเท้า' },
];
const THUMB = () => {
  const { FULL, HEAD } = CharKit.CROP;
  return { body: [FULL, 1.25], hair: [HEAD, 2], hairColor: [HEAD, 2], skin: [HEAD, 2],
    socks: [{ x: 14, y: 40, w: 36, h: 22 }, 2.2], shoes: [{ x: 14, y: 44, w: 36, h: 18 }, 2.4] };
};
const nameOf = (k, id) => CharKit.OPTIONS[k].find(o => o.id === id)?.name || id;

export function ShopScreen({ initial, wallet, signedIn, onBuy, onSave, onBack }) {
  const short = useShortScreen();
  const owned = wallet?.owned || [];
  const gems = wallet?.gems || 0;
  const [saved, setSaved] = useState(() => CharKit.sanitize(initial) || CharKit.defaults('boy'));
  const [draft, setDraft] = useState(saved);
  const [cat, setCat] = useState('hairColor');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [anim, setAnim] = useState('idle');
  const [modal, setModal] = useState(null);          // null | 'confirm' | 'bought' | 'how'
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ t: '', c: '' });
  const [fit, setFit] = useState({ cols: 4, rows: 3 });
  const [ready, setReady] = useState(false);
  const gridRef = useRef(null), laneRef = useRef(null);
  const [laneScale, setLaneScale] = useState(4);
  useEffect(() => { CharKit.load().then(() => setReady(true)).catch(() => setReady(true)); }, []);

  const un = unownedKeys(owned, draft);
  const trying = un[0] ? { k: un[0], id: draft[un[0]], price: priceOf(un[0], draft[un[0]]) } : null;

  // Items of this tab: what you wear now, then things to buy (cheapest first), then what you have; "coming soon" at the end.
  const items = useMemo(() => {
    let list = CharKit.OPTIONS[cat].map(o => ({ k: cat, id: o.id, name: o.name, price: priceOf(cat, o.id), own: ownsLook(owned, cat, o.id) }));
    list.sort((a, b) => ((b.id === saved[cat]) - (a.id === saved[cat])) || (a.own - b.own) || (a.price - b.price));
    (SHOP_SOON[cat] || []).forEach(([emoji, name, price]) => list.push({ k: cat, soon: true, emoji, name, price, id: 'soon-' + name }));
    if (filter === 'own') list = list.filter(i => !i.soon && i.own);
    if (filter === 'shop') list = list.filter(i => i.price > 0);
    return list;
  }, [cat, filter, owned.join(','), saved[cat]]);

  // How many cards fit (never scroll): cards at least 138 wide, 112 tall, at most 3 rows.
  useLayoutEffect(() => {
    const measure = () => {
      const g = gridRef.current, l = laneRef.current;
      if (g) {
        const W = g.clientWidth, H = g.clientHeight, gap = 8;
        setFit({ cols: Math.max(2, Math.floor((W + gap) / (138 + gap))), rows: Math.max(1, Math.min(3, Math.floor((H + gap) / (112 + gap)))) });
      }
      if (l) setLaneScale(Math.max(2.5, Math.min(short ? 4 : window.innerHeight > 900 ? 7 : 5, (l.clientHeight - 40) / 62, (l.clientWidth - 10) / 52)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    gridRef.current && ro.observe(gridRef.current); laneRef.current && ro.observe(laneRef.current);
    return () => ro.disconnect();
  }, [short]);

  const per = fit.cols * fit.rows, pages = Math.max(1, Math.ceil(items.length / per));
  const pg = Math.min(page, pages - 1);
  const shown = items.slice(pg * per, pg * per + per);

  const pick = it => { if (it.soon) return; setDraft(d => ({ ...d, [it.k]: it.id })); setMsg({ t: '', c: '' }); };
  const save = async () => {
    setBusy(true); setMsg({ t: '💾 กำลังบันทึก...', c: '#6A4A30' });
    try { const c = CharKit.sanitize(draft); await onSave(c); setSaved(c); setMsg({ t: '✅ บันทึกแล้ว!', c: '#2E7D32' }); }
    catch (e) { setMsg({ t: '⚠️ ' + (e?.message || 'บันทึกไม่สำเร็จ'), c: '#DC2626' }); }
    setBusy(false);
  };
  const buy = async () => {
    setBusy(true);
    try {
      await onBuy(itemKey(trying.k, trying.id), trying.price);
      // put it on and keep the look (only bought things go to the server)
      const c = CharKit.sanitize({ ...saved, [trying.k]: trying.id });
      setSaved(c);
      setModal('bought');
      onSave(c).catch(() => {});
    } catch (e) { setModal(null); setMsg({ t: '⚠️ ' + (e?.message || 'ซื้อไม่สำเร็จ'), c: '#DC2626' }); }
    setBusy(false);
  };

  // Keyboard: arrows move between cards, Enter puts it on (focus stays on the card buttons).
  const onGridKey = e => {
    const btns = [...gridRef.current.querySelectorAll('button.shop-card')];
    const i = btns.indexOf(document.activeElement); if (i < 0) return;
    const move = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -fit.cols, ArrowDown: fit.cols }[e.key];
    if (move == null) return;
    e.preventDefault();
    const j = i + move;
    if (j >= 0 && j < btns.length) btns[j].focus();
    else if (pages > 1) setPage((pg + (j < 0 ? pages - 1 : 1)) % pages);
  };

  if (!ready) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--c-t3)' }}>กำลังโหลดตัวละคร...</div>;
  const [thumbCrop, thumbScale] = THUMB()[cat];
  const newCount = k => Object.keys(SHOP_PRICES).filter(key => key.startsWith(k + ':') && !owned.includes(key)).length;
  const sameAsSaved = JSON.stringify(CharKit.sanitize(draft)) === JSON.stringify(saved);

  let action;
  if (trying && !signedIn) action = <>
    <PxButton disabled style={{ width: '100%', minHeight: short ? 42 : 48, fontSize: 16 }}>ซื้อ <Gem/> {fmtGems(trying.price)}</PxButton>
    <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', color: '#B45309' }}>เข้าสู่ระบบก่อนถึงจะสะสมเพชรและซื้อของได้</div></>;
  else if (trying && gems >= trying.price) action = <>
    <PxButton onClick={() => setModal('confirm')} style={{ width: '100%', minHeight: short ? 42 : 48, fontSize: 16 }}>ซื้อ <Gem/> {fmtGems(trying.price)}</PxButton>
    <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', color: '#6A4A30' }}>ลองใส่อยู่ — ยังไม่ได้ซื้อ</div></>;
  else if (trying) action = <>
    <PxButton disabled style={{ width: '100%', minHeight: short ? 42 : 48, fontSize: 16 }}>เพชรไม่พอ</PxButton>
    <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', color: '#B4532A' }}>ขาดอีก {fmtGems(trying.price - gems)} เพชร · ได้ดาวใหม่ได้เพชรเยอะสุด!</div></>;
  else action = <>
    <PxButton onClick={save} disabled={busy || sameAsSaved} style={{ width: '100%', minHeight: short ? 42 : 48, fontSize: 16 }}>💾 บันทึกตัวละคร</PxButton>
    <div role="status" style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'center', color: msg.c, minHeight: 17 }}>
      {msg.t || (!signedIn ? 'ยังไม่ได้เข้าสู่ระบบ — บันทึกไว้ในเครื่องนี้เท่านั้น' : '')}</div></>;

  return (
    <div className="px-fill shop" style={{ color: '#3B2416' }}>
      <div className="shop-left">
        <div>
          <div style={{ fontSize: short ? 18 : 21, fontWeight: 800, lineHeight: 1.2 }}>🛍️ ร้านแต่งตัว</div>
          <div style={{ fontSize: 12.5, color: '#6A4A30' }}>กดของเพื่อลองใส่ · ของที่มีแล้วใส่ได้เลย</div>
        </div>
        <div ref={laneRef} className="shop-lane px-lane">
          {un.length > 0 && <div className="tag">👀 ลองใส่: {un.map(k => nameOf(k, draft[k])).join(', ')}</div>}
          <CharKit.CharCanvas config={draft} anim={anim} scale={laneScale}/>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={'shop-pill' + (anim === 'idle' ? ' on' : '')} onClick={() => setAnim('idle')}>🧍 ยืน</button>
          <button className={'shop-pill' + (anim === 'run' ? ' on' : '')} onClick={() => setAnim('run')}>🏃 วิ่ง</button>
          {un.length > 0 && <button className="shop-pill" onClick={() => setDraft(saved)}>↩ ถอด</button>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{action}</div>
      </div>

      <div className="shop-right">
        <div className="shop-tabs" role="tablist">
          {CATS.map(c => (
            <button key={c.k} role="tab" aria-selected={c.k === cat} className={'shop-tab' + (c.k === cat ? ' on' : '')}
              onClick={() => { setCat(c.k); setPage(0); }}>
              {c.t}{newCount(c.k) > 0 && <span className="dot">ใหม่ {newCount(c.k)}</span>}
            </button>))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 700 }}>
          แสดง: {[['all', 'ทั้งหมด'], ['own', 'มีแล้ว'], ['shop', 'ในร้าน']].map(([v, t]) => (
            <button key={v} className={'shop-chip' + (filter === v ? ' on' : '')} onClick={() => { setFilter(v); setPage(0); }}>{t}</button>))}
        </div>
        <div ref={gridRef} className="shop-grid" onKeyDown={onGridKey}
          style={{ gridTemplateColumns: `repeat(${fit.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${fit.rows}, minmax(0, 1fr))` }}>
          {shown.map(it => {
            if (it.soon) return (
              <div key={it.id} className="shop-card soon" title="ยังไม่มีขาย — เร็ว ๆ นี้">
                <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 15 }}>🔒</span>
                <div className="th" style={{ fontSize: 40 }}>{it.emoji}</div>
                <div className="nm">{it.name}</div><div className="pr">เร็ว ๆ นี้</div>
              </div>);
            const eq = saved[it.k] === it.id, tr = draft[it.k] === it.id && !eq;
            return (
              <button key={it.id} className={'shop-card' + (eq ? ' eq' : '') + (tr ? ' try' : '')} onClick={() => pick(it)}
                aria-label={it.name + (eq ? ' ใส่อยู่' : it.own ? '' : ' ราคา ' + it.price + ' เพชร')}>
                {it.price > 0 && !it.own && <span className="new">ใหม่</span>}
                <div className="th">
                  <CharKit.CharCanvas config={{ ...draft, [it.k]: it.id }} crop={thumbCrop} scale={thumbScale} still
                    style={{ height: '100%', maxHeight: thumbCrop.h * thumbScale * 1.6, width: 'auto', maxWidth: '100%' }}/>
                </div>
                <div className="nm">{it.name}</div>
                {eq ? <div className="own">✓ ใส่อยู่</div>
                  : it.own ? <div className="own">{it.price ? 'มีแล้ว' : 'ฟรี'}</div>
                  : <div className={'pr' + (gems < it.price ? ' poor' : '')}><Gem/>{fmtGems(it.price)}</div>}
              </button>);
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flex: 'none' }}>
          <button onClick={() => setModal('how')} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 700, color: '#6A4A30', textDecoration: 'underline dotted' }}>💎 ได้เพชรจากอะไรบ้าง?</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Press Start 2P', monospace", fontSize: 11 }}>
            {pages > 1 && <>
              <button className="sp sp-i_left px-icon-btn" style={{ zoom: 0.75 }} aria-label="หน้าก่อน" onClick={() => setPage((pg + pages - 1) % pages)}/>
              {pg + 1}/{pages}
              <button className="sp sp-i_right px-icon-btn" style={{ zoom: 0.75 }} aria-label="หน้าถัดไป" onClick={() => setPage((pg + 1) % pages)}/>
            </>}
            <PxButton onClick={onBack} style={{ minHeight: 'var(--hb)', fontSize: 14, padding: '0 12px', marginLeft: 8 }}>← กลับ</PxButton>
          </div>
        </div>
      </div>

      {modal && <ShopModal kind={modal} trying={trying} gems={gems} draft={draft} saved={saved} busy={busy}
        onClose={() => setModal(null)} onBuy={buy}/>}
    </div>
  );
}

function ShopModal({ kind, trying, gems, saved, busy, onClose, onBuy }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const title = kind === 'confirm' ? 'ซื้อของชิ้นนี้?' : kind === 'bought' ? 'ได้ของใหม่แล้ว! 🎉' : 'ได้เพชรจากอะไรบ้าง? 💎';
  const cat = trying && CATS.find(c => c.k === trying.k)?.t;
  const row = (a, b, head) => head
    ? <tr><td colSpan={2} style={{ fontWeight: 800, background: '#F3E3B8', padding: '3px 6px' }}>{a}</td></tr>
    : <tr><td style={{ borderBottom: '2px dashed #D8C49A', padding: '3px 6px' }}>{a}</td>
        <td style={{ borderBottom: '2px dashed #D8C49A', padding: '3px 6px', textAlign: 'right', whiteSpace: 'nowrap',
          fontFamily: "'Press Start 2P', monospace", fontSize: 10 }}>{b}</td></tr>;
  return (
    <div className="shop-veil" onClick={e => { if (e.target === e.currentTarget && kind !== 'confirm') onClose(); }}>
      <div style={{ width: 'min(520px, 92vw)', display: 'flex', flexDirection: 'column' }}>
        <div className="px-head" style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF6D8',
          fontWeight: 800, fontSize: 19, textShadow: '2px 2px 0 #2B4A3A', marginBottom: -6, position: 'relative' }}>{title}</div>
        <div className="px-panel" style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', textAlign: 'center' }}>
          {kind === 'confirm' && <>
            <CharKit.CharCanvas config={{ ...saved, [trying.k]: trying.id }} scale={3}/>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{cat} {nameOf(trying.k, trying.id)}</div>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 22, color: '#1F5F7A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gem size="m"/>{fmtGems(trying.price)}</div>
            <div style={{ fontSize: 13, color: '#6A4A30' }}>เหลือ {fmtGems(gems - trying.price)} เพชร · ซื้อแล้วเก็บไว้ตลอด (ขายคืนไม่ได้)</div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <PxButton onClick={onClose} disabled={busy} style={{ flex: 1, minHeight: 46, fontSize: 16 }}>ยังก่อน</PxButton>
              <PxButton onClick={onBuy} disabled={busy} autoFocus style={{ flex: 1, minHeight: 46, fontSize: 16 }}>{busy ? 'กำลังซื้อ...' : 'ซื้อเลย!'}</PxButton>
            </div>
          </>}
          {kind === 'bought' && <>
            <CharKit.CharCanvas config={saved} anim="cheer" scale={3}/>
            <div style={{ fontSize: 13, color: '#6A4A30' }}>ใส่ให้แล้ว และบันทึกตัวละครแล้ว</div>
            <PxButton onClick={onClose} autoFocus style={{ width: '100%', minHeight: 46, fontSize: 16 }}>เยี่ยม!</PxButton>
          </>}
          {kind === 'how' && <>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, textAlign: 'left' }}><tbody>
              {row('📖 บทเรียน (ทุกขั้น)', '', true)}
              {row('ได้ดาวครั้งแรก ⭐ / ⭐⭐ / ⭐⭐⭐', FIRST_GEMS.slice(1).join('/'))}
              {row('ด่านยากขึ้น ได้มากขึ้น (ด่าน 9 = 2 เท่า)', '×1–×2')}
              {row(`เล่นซ้ำ (ได้ ${REPLAYS_PER_DAY} ครั้ง/ขั้น/วัน)`, '8–40')}
              {row('📝 แบบทดสอบประจำสัปดาห์', '', true)}
              {row('เข้าร่วม · ทำลายสถิติตัวเอง', `${WEEKLY_GEMS.join} · +${WEEKLY_GEMS.best}`)}
              {row('อันดับ 1 / 2 / 3 ในห้อง', WEEKLY_GEMS.place.join('/'))}
              {row(`🏁 แข่ง (ได้ ${RACES_PER_DAY} รอบ/วัน)`, '', true)}
              {row('1v1 ชนะ / เสมอ / แพ้', `${RACE_GEMS.win}/${RACE_GEMS.draw}/${RACE_GEMS.lose}`)}
              {row('Battle Royale อันดับ 1 / 2 / 3 / อื่น ๆ', [...RACE_GEMS.place, RACE_GEMS.other].join('/'))}
            </tbody></table>
            <PxButton onClick={onClose} autoFocus style={{ width: '100%', minHeight: 46, fontSize: 16 }}>เข้าใจแล้ว</PxButton>
          </>}
        </div>
      </div>
    </div>
  );
}
