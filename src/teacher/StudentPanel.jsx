// Right-hand panel when a row is clicked: numbers, speed chart vs the stage targets, stars per stage, recent sessions.
import { STAGES, STAGE_MAX, dayText, flagOf, wpmOf } from './roster';

function SpeedChart({ sessions, stage }) {
  const list = sessions.slice(-20);
  if (list.length < 2) return <div className="hint" style={{ margin: 'auto' }}>ต้องฝึกอย่างน้อย 2 ครั้งจึงจะแสดงกราฟ</div>;
  const tgt = STAGES[Math.max(0, stage - 1)].target;
  const wpm = list.map(wpmOf);
  const W = 360, H = 160, L = 26, R = 6, T = 8, B = 18;
  const max = Math.max(tgt * 1.6, ...wpm) * 1.08;
  const x = i => L + i * (W - L - R) / (list.length - 1);
  const y = v => T + (H - T - B) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), Math.round(max * 0.95)];
  const d0 = new Date(list[0].date), d1 = new Date(list[list.length - 1].date);
  const dm = d => `${d.getDate()}/${d.getMonth() + 1}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`กราฟความเร็ว ${list.length} ครั้งล่าสุด`}>
      {ticks.map(t => <g key={t}>
        <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#EADFC6"/>
        <text x={L - 4} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8C6E4E">{t}</text>
      </g>)}
      <line x1={L} x2={W - R} y1={y(tgt)} y2={y(tgt)} stroke="#E0A526" strokeWidth="2" strokeDasharray="6 4"/>
      <line x1={L} x2={W - R} y1={y(tgt * 1.5)} y2={y(tgt * 1.5)} stroke="#3FA36B" strokeWidth="2" strokeDasharray="3 4"/>
      <polyline points={wpm.map((v, i) => x(i) + ',' + y(v)).join(' ')} fill="none" stroke="#3B2416" strokeWidth="2.5"/>
      {wpm.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={i === wpm.length - 1 ? '#FFC23D' : '#3B2416'} stroke="#3B2416">
        <title>{`${new Date(list[i].date).toLocaleDateString('th-TH')} · ${list[i].exercise || ''} · ${v} WPM · แม่น ${list[i].accuracy}%`}</title>
      </circle>)}
      <text x={L} y={H - 4} fontSize="10" fill="#8C6E4E">{dm(d0)}</text>
      <text x={W - R} y={H - 4} fontSize="10" fill="#8C6E4E" textAnchor="end">{dm(d1)}</text>
    </svg>
  );
}

export function StudentPanel({ r, onClose, onUnlock }) {
  const f = flagOf(r);
  const tgt = STAGES[Math.max(0, r.stage - 1)].target;
  const recent = r.sessions.slice(-8).reverse();
  return (
    <div className="card side">
      <h3>
        <span className="num badge">{r.no}</span>
        <span className="ell">{r.name}</span>
        <button className="x" onClick={onClose} title="ปิด" aria-label="ปิด">✕</button>
      </h3>
      <div className="row6">
        {f ? <span className={'chip ' + f[0]}>{f[1]}</span> : <span className="chip ok">✓ ปกติ</span>}
        <span className="hint">ฝึกทั้งหมด {r.total} ครั้ง · ล่าสุด {dayText(r.days)}</span>
      </div>
      <div className="kv">
        <div className="stat"><small>ล่าสุด</small><b className="num">{r.wpm ?? '—'}</b><small>WPM</small></div>
        <div className="stat"><small>ดีที่สุด</small><b className="num">{r.bestWpm ?? '—'}</b><small>WPM</small></div>
        <div className="stat"><small>แม่นเฉลี่ย</small><b className="num">{r.avgAcc != null ? Math.round(r.avgAcc) + '%' : '—'}</b><small>&nbsp;</small></div>
      </div>
      <div className="chart">
        <b className="sm">ความเร็ว {Math.min(20, r.sessions.length)} ครั้งล่าสุด</b>
        <SpeedChart sessions={r.sessions} stage={r.stage}/>
        {r.sessions.length >= 2 && <div className="legend">
          <span>— WPM</span><span style={{ color: '#B86E00' }}>┄ ⭐⭐ เป้าด่าน {tgt}</span><span style={{ color: '#1F6B3D' }}>┄ ⭐⭐⭐ {tgt * 1.5}</span>
        </div>}
      </div>
      <div>
        <b className="sm">ดาวแต่ละด่าน</b>
        <div className="stars9">{STAGES.map((s, i) => {
          const reached = i < r.stage || r.unlock > i;
          return <div key={s.id} className="stat" title={`ด่าน ${s.id} ${s.title}: ${r.stageStars[i]}/${STAGE_MAX[i]} ⭐`} style={reached ? null : { opacity: .4 }}>
            {s.id}<b className="num">{reached ? r.stageStars[i] : '🔒'}</b></div>;
        })}</div>
      </div>
      <div className="recent">
        <b className="sm">ฝึกล่าสุด</b>
        <div className="recent-list">{recent.length ? recent.map((s, i) => (
          <div key={i}><span className="ell">{s.exercise || '—'}</span><span className="num">{wpmOf(s)}</span><span className="u">WPM</span>
            <span className="num" style={Number(s.accuracy) < 85 ? { color: 'var(--red)' } : null}>{Math.round(Number(s.accuracy) || 0)}%</span></div>
        )) : <div className="hint">ยังไม่เคยฝึก</div>}</div>
      </div>
      <button className="btn" onClick={onUnlock}>🔓 ปลดล็อกให้คนนี้…</button>
    </div>
  );
}
