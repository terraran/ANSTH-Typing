// School edition: the switch that lets a room's students sign in with their student ID
// (for young students who don't know their Google password yet). It closes by itself after 2 hours.
const { useEffect, useState } = React;

const left = ms => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที`;
};

export function IdLoginSwitch({ api, code, onMsg }) {
  const [until, setUntil] = useState(null);          // ms; 0 = closed; null = loading / unknown
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let off = false;
    setUntil(null);
    api.getIdLogin(code).then(d => { if (!off) setUntil(Number(d.openUntil) || 0); }).catch(() => { if (!off) setUntil(null); });
    return () => { off = true; };
  }, [code]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const open = until > now;
  async function flip() {
    setBusy(true);
    try {
      const d = await api.setIdLogin(code, !open);
      setUntil(Number(d.openUntil) || 0); setNow(Date.now());
      onMsg(['ok', !open
        ? 'เปิดให้เข้าด้วยเลขประจำตัวแล้ว — นักเรียนกด "เข้าด้วยเลขประจำตัว" ในหน้าเกม · ปิดเองใน 2 ชั่วโมง'
        : 'ปิดการเข้าด้วยเลขประจำตัวแล้ว — นักเรียนที่เข้าอยู่เล่นต่อได้อีกสักครู่ แต่เข้าใหม่ไม่ได้']);
    } catch (e) { onMsg(['err', 'เปลี่ยนไม่ได้: ' + (e?.message || e)]); }
    setBusy(false);
  }

  return (
    <button className={'btn ghost idsw' + (open ? ' on' : '')} onClick={flip} disabled={busy || until === null}
      title={open ? 'กดเพื่อปิดเลย' : 'ให้นักเรียนที่จำรหัส Google ไม่ได้ เข้าเกมด้วยเลขประจำตัว (เปิด 2 ชั่วโมงแล้วปิดเอง) — ผลบันทึกลงบัญชีของนักเรียน'}>
      🔢 เข้าด้วยเลขประจำตัว
      <span className="sw" aria-hidden="true"/>
      <span className="sm">{until === null ? '…' : open ? `เปิดอยู่ · ปิดเองใน ${left(until - now)}` : 'ปิด'}</span>
    </button>
  );
}
