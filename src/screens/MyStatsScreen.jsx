import { apiGetStudentStats } from '../api';
import { fmtScore } from '../engine/scoring';

const { useEffect, useMemo, useState } = React;

// PROGRESS CHART

export function ProgressChart({ sessions }) {
  const [tab, setTab] = useState('wpm'); // 'wpm' | 'both'
  const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";

  // Reverse to chronological order, take last 20
  const data = [...sessions].reverse().slice(-20).map((s, i) => ({
    n:    i + 1,
    wpm:  Math.round(s.cpm / 5),
    acc:  s.accuracy,
    ex:   s.exercise,
  }));

  if (data.length < 2) return (
    <div style={{textAlign:'center',padding:24,color:'var(--c-t3)',fontSize:13,fontFamily:tf,
      background:'var(--c-surf)',border:'3px solid #3B2416'}}>
      ต้องมีอย่างน้อย 2 เซสชั่น จึงจะแสดงกราฟได้
    </div>
  );

  const W = 520, H = 200, PL = 40, PR = 40, PT = 16, PB = 32;
  const IW = W - PL - PR, IH = H - PT - PB;

  const maxWpm = Math.max(...data.map(d => d.wpm), 10);
  const yMaxWpm = Math.ceil(maxWpm / 10) * 10 + 10;

  const xOf  = d => PL + ((d.n - 1) / (data.length - 1)) * IW;
  const yWpm = d => PT + IH - (d.wpm / yMaxWpm) * IH;
  const yAcc = d => PT + IH - ((d.acc - 50) / 50) * IH;  // acc range 50-100

  const polyline = (pts, color) => {
    const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    return <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>;
  };

  const wpmPts = data.map(d => ({ x: xOf(d), y: yWpm(d) }));
  const accPts = data.map(d => ({ x: xOf(d), y: yAcc(d) }));

  const yGrids = [0, 25, 50, 75, 100];

  return (
    <div style={{display:'flex',flexDirection:'column',flex:'1 1 auto',minHeight:0}}>
      {/* Tab switcher */}
      <div style={{display:'flex',gap:6,marginBottom:8,alignItems:'center',flexWrap:'wrap'}}>
        {[['wpm','📈 WPM'],['both','📊 WPM + ความแม่น']].map(([key,lbl])=>(
          <button key={key} onClick={()=>setTab(key)}
            style={{padding:'5px 12px',borderRadius:8,border:'1.5px solid '+(tab===key?'#2563EB':'#E2E8F0'),
              background:tab===key?'#2563EB':'#fff',color:tab===key?'#fff':'#64748B',
              cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:tf,transition:'all .15s'}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:16,marginBottom:6}}>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <div style={{width:20,height:3,borderRadius:2,background:'#2563EB'}}/>
          <span style={{fontSize:11,color:'var(--c-t2)',fontFamily:tf}}>WPM</span>
        </div>
        {tab==='both'&&(
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            <div style={{width:20,height:3,borderRadius:2,background:'#059669'}}/>
            <span style={{fontSize:11,color:'var(--c-t2)',fontFamily:tf}}>ความแม่น %</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{flex:'1 1 auto',minHeight:90}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'100%',display:'block'}}>
          {/* Grid lines */}
          {yGrids.map(pct => {
            const y = PT + IH - (pct / 100) * IH;
            return (
              <g key={pct}>
                <line x1={PL} y1={y} x2={W-PR} y2={y}
                  stroke="#F1F5F9" strokeWidth="1"/>
                <text x={PL-6} y={y+4} textAnchor="end"
                  fontSize="9" fill="#CBD5E1">{tab==='wpm' ? Math.round(pct/100*yMaxWpm) : pct+'%'}</text>
              </g>
            );
          })}

          {/* WPM y-labels when both shown */}
          {tab==='both' && yGrids.map(pct => {
            const y = PT + IH - (pct / 100) * IH;
            return (
              <text key={'r'+pct} x={W-PR+6} y={y+4} textAnchor="start"
                fontSize="9" fill="#BFDBFE">{Math.round(pct/100*yMaxWpm)}</text>
            );
          })}

          {/* X axis labels */}
          {data.filter((_, i) => data.length <= 10 || i % Math.ceil(data.length/8) === 0 || i === data.length-1).map(d => (
            <text key={d.n} x={xOf(d)} y={H-8} textAnchor="middle" fontSize="9" fill="#94A3B8">
              {d.n}
            </text>
          ))}

          {/* Lines */}
          {tab==='both' && polyline(accPts, '#059669')}
          {polyline(wpmPts, '#2563EB')}

          {/* Dots — WPM */}
          {data.map(d => (
            <circle key={d.n} cx={xOf(d)} cy={yWpm(d)} r="3.5"
              fill="#2563EB" stroke="#fff" strokeWidth="1.5">
              <title>Session {d.n} · {d.wpm} WPM · {d.ex}</title>
            </circle>
          ))}

          {/* Dots — accuracy */}
          {tab==='both' && data.map(d => (
            <circle key={'a'+d.n} cx={xOf(d)} cy={yAcc(d)} r="3.5"
              fill="#059669" stroke="#fff" strokeWidth="1.5">
              <title>Session {d.n} · {d.acc}% · {d.ex}</title>
            </circle>
          ))}

          {/* Axes */}
          <line x1={PL} y1={PT} x2={PL} y2={H-PB} stroke="#E2E8F0" strokeWidth="1"/>
          <line x1={PL} y1={H-PB} x2={W-PR} y2={H-PB} stroke="#E2E8F0" strokeWidth="1"/>

          {/* X-axis label */}
          <text x={W/2} y={H} textAnchor="middle" fontSize="9" fill="#94A3B8">ลำดับ session</text>
        </svg>
      </div>
    </div>
  );
}

// MY STATS SCREEN

// MY STATS — overview · solo practice · 1v1 · Battle Royale · head-to-head (like chess.com)

const tf = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
const TABS = [['ov','ภาพรวม'],['solo','ฝึกเดี่ยว'],['duel','1v1'],['br','Battle Royale'],['h2h','คู่แข่ง']];
const RES = { win:{t:'ชนะ',bg:'#DCFCE7',fg:'#166534'}, lose:{t:'แพ้',bg:'#FEE2E2',fg:'#991B1B'}, draw:{t:'เสมอ',bg:'#F1F5F9',fg:'#475569'} };
const NOTE = { left:'ออกกลางคัน', 'opp-left':'คู่แข่งออกกลางคัน', eliminated:'ตกรอบ', finished:'พิมพ์จบ', survived:'รอดจนจบ' };
const wpmOf = m => Math.round((Number(m.cpm)||0)/5);

function fmtDate(iso) {
  const d=new Date(iso);
  if (isNaN(d)) return '';
  const p=n=>String(n).padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${String(d.getFullYear()+543).slice(-2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDay(iso) {
  const d=new Date(iso);
  return isNaN(d)?'':d.toLocaleDateString('th-TH',{day:'numeric',month:'short'});
}

function Metric({ label, value, sub, color }) {
  return (
    <div className="px-wood" style={{padding:'0 2px',minWidth:0,color:'#F5E6BE'}}>
      <div style={{fontSize:12,color:'#E8CF95',fontWeight:700}}>{label}</div>
      <div style={{fontFamily:"'Press Start 2P', monospace",fontSize:16,fontWeight:400,color:'#F5D27A',lineHeight:1.3}}>{value}
        {sub&&<span style={{fontSize:12,fontWeight:700,marginLeft:6,color:sub.color}}>{sub.text}</span>}</div>
    </div>
  );
}
const Grid = ({ children }) => (
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))',gap:8,flex:'none'}}>{children}</div>
);
// Card fills the rest of its column; scroll=true → long lists scroll inside the card, never the page.
const Card = ({ title, children, note, scroll }) => (
  <div style={{background:'var(--c-card)',border:'3px solid #3B2416',padding:'8px 14px',flex:'1 1 auto',minHeight:0,
    display:'flex',flexDirection:'column'}}>
    {title&&<div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)',marginBottom:6,flex:'none'}}>{title}</div>}
    <div className={scroll?'px-scroll':undefined} style={{flex:'1 1 auto',minHeight:0,display:'flex',flexDirection:'column'}}>{children}</div>
    {note&&<div style={{fontSize:11,color:'var(--c-t3)',marginTop:4,flex:'none'}}>{note}</div>}
  </div>
);
// Two columns: numbers + chart on the left, the history list on the right.
const Split = ({ left, right }) => (
  <div style={{flex:'1 1 auto',minHeight:0,display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gridTemplateRows:'minmax(0,1fr)',gap:12}}>
    <div style={{display:'flex',flexDirection:'column',gap:10,minHeight:0}}>{left}</div>
    <div style={{display:'flex',flexDirection:'column',minHeight:0}}>{right}</div>
  </div>
);
const Empty = ({ children }) => (
  <div style={{textAlign:'center',padding:'28px 12px',color:'var(--c-t3)',fontSize:14,background:'var(--c-surf)',
    border:'3px dashed #8C6E4E'}}>{children}</div>
);
function Pill({ result }) {
  const r=RES[result]||RES.draw;
  return <span style={{background:r.bg,color:r.fg,borderRadius:8,padding:'2px 9px',fontSize:12,fontWeight:800,whiteSpace:'nowrap'}}>{r.t}</span>;
}
function OppAvatar({ name, cfg, size=30 }) {
  if (window.CharKit) return <CharKit.Avatar config={cfg||CharKit.fromName(name)} size={size}/>;
  return <span style={{width:size,height:size,borderRadius:'50%',background:'#E0E7FF',color:'#3730A3',display:'inline-flex',
    alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:size*.42,flexShrink:0}}>{(name||'?').replace(/^ด\.(ช|ญ)\./,'').slice(0,1)}</span>;
}

// Small line chart: points [{y, color?, title}] oldest → newest. invert = higher is better at the top already.
function MiniChart({ points, yMin=0, yMax, line='#2563EB', refY, refLabel, height=130, fmt=v=>v }) {
  if (points.length<2) return <div style={{fontSize:12,color:'var(--c-t3)',padding:'16px 0',textAlign:'center'}}>ต้องมีอย่างน้อย 2 ครั้ง จึงจะแสดงกราฟได้</div>;
  const W=560, H=height, PL=34, PR=10, PT=12, PB=18;
  const hi=yMax ?? Math.max(...points.map(p=>p.y), yMin+1);
  const x=i=>PL+i*(W-PL-PR)/(points.length-1);
  const y=v=>PT+(H-PT-PB)*(1-(v-yMin)/Math.max(1e-9,hi-yMin));
  const d=points.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.y).toFixed(1)).join(' ');
  const ticks=[yMin,(yMin+hi)/2,hi];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',height:'100%',minHeight:80,display:'block',flex:'1 1 auto'}}>
      {ticks.map((t,i)=>(
        <g key={i}><line x1={PL} x2={W-PR} y1={y(t)} y2={y(t)} stroke="var(--c-border)" strokeWidth="1"/>
          <text x={PL-6} y={y(t)+4} textAnchor="end" fontSize="10" fill="var(--c-t3)">{fmt(Math.round(t))}</text></g>
      ))}
      {refY!=null&&(<g><line x1={PL} x2={W-PR} y1={y(refY)} y2={y(refY)} stroke="#F59E0B" strokeDasharray="5 4"/>
        <text x={W-PR} y={y(refY)-4} textAnchor="end" fontSize="10" fill="#B45309">{refLabel}</text></g>)}
      <path d={d} fill="none" stroke={line} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity=".55"/>
      {points.map((p,i)=>(
        <circle key={i} cx={x(i)} cy={y(p.y)} r="5" fill={p.color||line} stroke="var(--c-card)" strokeWidth="1.5">
          {p.title&&<title>{p.title}</title>}</circle>
      ))}
    </svg>
  );
}

function MatchRow({ m, oppChars, showOpp=true }) {
  const key=m.oppClass+'|'+m.oppName;
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid var(--c-border)'}}>
      {showOpp&&<OppAvatar name={m.oppName||'?'} cfg={oppChars[key]}/>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:'var(--c-t1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
          {showOpp?(m.oppName||'ผู้เล่นทั่วไป'):fmtDate(m.date)}
          {showOpp&&m.oppClass&&<span style={{fontSize:11,color:'var(--c-t3)',fontWeight:600}}> · {m.oppClass}</span>}</div>
        <div style={{fontSize:11,color:'var(--c-t3)'}}>
          {[showOpp?fmtDate(m.date):'', NOTE[m.note]||'', wpmOf(m)+' WPM'].filter(Boolean).join(' · ')}</div>
      </div>
      <span style={{fontSize:13,fontWeight:700,color:'var(--c-t2)',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>
        {fmtScore(m.myScore)} : {fmtScore(m.oppScore)}</span>
      <Pill result={m.result}/>
    </div>
  );
}

export function MyStatsScreen({ studentName, classCode, myCfg, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ov');
  const [openOpp, setOpenOpp] = useState(null);

  useEffect(() => {
    apiGetStudentStats(classCode, studentName)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData({ error:true }); setLoading(false); });
  }, []);

  const S = useMemo(() => {
    if (!data || data.error) return null;
    const sessions = data.sessions||[];
    const matches = data.matches||[];
    const duels = matches.filter(m=>m.type==='1v1');
    const brs = matches.filter(m=>m.type==='royale');
    const chrono = arr => [...arr].sort((a,b)=>new Date(a.date)-new Date(b.date));
    // 1v1 record and streaks
    const rec = {w:0,l:0,d:0};
    duels.forEach(m=>{ if (m.result==='win') rec.w++; else if (m.result==='lose') rec.l++; else rec.d++; });
    let cur=0, best=0, run=0;
    chrono(duels).forEach(m=>{ run=m.result==='win'?run+1:0; best=Math.max(best,run); });
    for (const m of duels) { if (m.result==='win') cur++; else break; }   // duels are newest first
    // Battle Royale
    const brWins=brs.filter(m=>m.place===1).length, top3=brs.filter(m=>m.place&&m.place<=3).length;
    const bestBr=brs.reduce((b,m)=>!b||m.place<b.place||(m.place===b.place&&m.players>b.players)?m:b,null);
    const avgPlace=brs.length?brs.reduce((s,m)=>s+m.place,0)/brs.length:0;
    // Head-to-head (signed-in opponents only)
    const h2h={};
    duels.forEach(m=>{
      if (!m.oppClass||!m.oppName) return;
      const k=m.oppClass+'|'+m.oppName;
      const e=h2h[k]||(h2h[k]={key:k,name:m.oppName,cls:m.oppClass,w:0,l:0,d:0,games:0,last:m.date,list:[]});
      e.games++; e.list.push(m);
      if (m.result==='win') e.w++; else if (m.result==='lose') e.l++; else e.d++;
      if (new Date(m.date)>new Date(e.last)) e.last=m.date;
    });
    // All modes together (WPM over time)
    const all=chrono([...sessions.map(s=>({date:s.date,cpm:s.cpm,kind:'ฝึก'})),
      ...matches.map(m=>({date:m.date,cpm:m.cpm,kind:m.type==='1v1'?'1v1':'BR'}))]);
    const last10=all.slice(-10), prev10=all.slice(-20,-10);
    const avg=a=>a.length?Math.round(a.reduce((s,r)=>s+wpmOf(r),0)/a.length):0;
    return { sessions, duels, brs, rec, cur, best, brWins, top3, bestBr, avgPlace,
      h2h:Object.values(h2h).sort((a,b)=>b.games-a.games||new Date(b.last)-new Date(a.last)),
      all, avg10:avg(last10), delta:prev10.length?avg(last10)-avg(prev10):null, chrono };
  }, [data]);

  if (loading) return <div style={{textAlign:'center',padding:40,color:'var(--c-t3)',fontFamily:tf}}>กำลังโหลด...</div>;
  if (!S) return <div style={{textAlign:'center',padding:40,color:'#DC2626',fontFamily:tf}}>โหลดไม่ได้ — ตรวจสัญญาณ</div>;
  const oppChars = data.oppChars||{};
  const games = S.duels.length+S.brs.length;
  const resColor = { win:'#16A34A', lose:'#DC2626', draw:'#94A3B8' };

  const overview = (
    <>
      <Grid>
        <Metric label="WPM เฉลี่ย (10 ครั้งล่าสุด)" value={S.avg10}
          sub={S.delta==null?null:{text:(S.delta>0?'▲':S.delta<0?'▼':'=')+Math.abs(S.delta),color:S.delta>=0?'#16A34A':'#DC2626'}}/>
        <Metric label="ความแม่นเฉลี่ย (ฝึก)" value={(data.avgAcc||0)+'%'} color={data.avgAcc>=95?'#059669':'#D97706'}/>
        <Metric label="1v1 ชนะ-แพ้-เสมอ" value={`${S.rec.w}-${S.rec.l}-${S.rec.d}`}/>
        <Metric label="BR อันดับเฉลี่ย" value={S.brs.length?'#'+S.avgPlace.toFixed(1):'–'}/>
      </Grid>
      <Card title="ความเร็วรวมทุกโหมด (WPM)" note="ฝึกเดี่ยว · 1v1 · Battle Royale เรียงตามเวลา — กดแท็บด้านบนเพื่อดูแยกแต่ละโหมด">
        <MiniChart points={S.all.slice(-30).map(r=>({y:wpmOf(r),title:`${r.kind} · ${wpmOf(r)} WPM · ${fmtDay(r.date)}`,
          color:r.kind==='ฝึก'?'#2563EB':r.kind==='1v1'?'#EA580C':'#7C3AED'}))}/>
        <div style={{display:'flex',gap:14,fontSize:11,color:'var(--c-t2)',marginTop:4}}>
          {[['#2563EB','ฝึกเดี่ยว'],['#EA580C','1v1'],['#7C3AED','Battle Royale']].map(([c,l])=>(
            <span key={l} style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:9,height:9,borderRadius:'50%',background:c}}/>{l}</span>))}
        </div>
      </Card>
    </>
  );

  const solo = S.sessions.length ? (
    <Split left={<>
      <Grid>
        <Metric label="WPM เฉลี่ย" value={Math.round((data.avgCpm||0)/5)} color="#2563EB"/>
        <Metric label="WPM สูงสุด" value={Math.round((data.bestCpm||0)/5)} color="#7C3AED"/>
        <Metric label="ความแม่นเฉลี่ย" value={(data.avgAcc||0)+'%'} color={data.avgAcc>=95?'#059669':'#D97706'}/>
        <Metric label="ฝึกแล้ว" value={S.sessions.length+' รอบ'}/>
      </Grid>
      <Card title="พัฒนาการฝึกเดี่ยว"><ProgressChart sessions={S.sessions}/></Card>
    </>} right={
      <Card title="ประวัติการฝึก" scroll>
        <div>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>{['วันที่','แบบฝึก','คะแนน','WPM','ความแม่น','ผิด'].map(h=>(
              <th key={h} style={{padding:'6px 8px',textAlign:'left',fontWeight:700,color:'var(--c-t2)',fontSize:10,borderBottom:'1.5px solid var(--c-border)',
                position:'sticky',top:0,background:'var(--c-card)'}}>{h}</th>))}</tr></thead>
            <tbody>{S.sessions.map((s,i)=>(
              <tr key={i} style={{borderBottom:'1px solid var(--c-border)'}}>
                <td style={{padding:'6px 8px',color:'var(--c-t2)'}}>{fmtDate(s.date)}</td>
                <td style={{padding:'6px 8px'}}>{s.exercise}</td>
                <td style={{padding:'6px 8px',fontWeight:700,color:'#D97706'}}>{s.score?fmtScore(s.score):'–'}</td>
                <td style={{padding:'6px 8px',fontWeight:700}}>{Math.round(s.cpm/5)}</td>
                <td style={{padding:'6px 8px',fontWeight:700,color:s.accuracy>=95?'#059669':s.accuracy>=85?'#D97706':'#DC2626'}}>{s.accuracy}%</td>
                <td style={{padding:'6px 8px',color:s.errors===0?'#059669':'#EF4444'}}>{s.errors}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
    }/>
  ) : <Empty>ยังไม่มีประวัติการฝึก — เริ่มฝึกบทเรียนได้เลย!</Empty>;

  const duel = S.duels.length ? (
    <Split left={<>
      <Grid>
        <Metric label="สถิติ ชนะ-แพ้-เสมอ" value={`${S.rec.w}-${S.rec.l}-${S.rec.d}`}/>
        <Metric label="อัตราชนะ" value={Math.round(S.rec.w/S.duels.length*100)+'%'} color="#16A34A"/>
        <Metric label="ชนะติดกันตอนนี้" value={S.cur+' ครั้ง'} sub={S.best>S.cur?{text:'สูงสุด '+S.best,color:'var(--c-t3)'}:null}/>
      </Grid>
      <Card title="ความเร็วแต่ละแมตช์ (WPM)" note="จุดเขียว ชนะ · จุดแดง แพ้ · จุดเทา เสมอ">
        <MiniChart line="#94A3B8" points={S.chrono(S.duels).slice(-30).map(m=>({y:wpmOf(m),color:resColor[m.result],
          title:`${RES[m.result]?.t||''} · ${m.oppName||'ผู้เล่นทั่วไป'} · ${wpmOf(m)} WPM`}))}/>
      </Card>
    </>} right={
      <Card title="แมตช์ล่าสุด" scroll>{S.duels.slice(0,15).map((m,i)=><MatchRow key={i} m={m} oppChars={oppChars}/>)}</Card>
    }/>
  ) : <Empty>ยังไม่มีการแข่ง 1v1 — ชวนเพื่อนมาแข่งกันดูสิ ⚔️</Empty>;

  const br = S.brs.length ? (
    <Split left={<>
      <Grid>
        <Metric label="แข่งทั้งหมด" value={S.brs.length}/>
        <Metric label="ได้ที่ 1" value={S.brWins+' ครั้ง'} color="#D97706"/>
        <Metric label="ติด 3 อันดับแรก" value={S.top3+' ครั้ง'}/>
        <Metric label="อันดับดีที่สุด" value={S.bestBr?`#${S.bestBr.place}/${S.bestBr.players}`:'–'}/>
      </Grid>
      <Card title="อันดับแต่ละรอบ (ยิ่งสูงยิ่งดี)" note="คิดเทียบจำนวนผู้เล่น ที่ 3 จาก 24 คนจึงสูงกว่าที่ 3 จาก 6 คน">
        <MiniChart line="#7C3AED" yMin={0} yMax={100} refY={100} refLabel="ที่ 1" fmt={v=>v+'%'}
          points={S.chrono(S.brs).slice(-30).map(m=>({y:m.players>1?Math.round((1-(m.place-1)/(m.players-1))*100):100,
            color:m.place===1?'#D97706':'#7C3AED',title:`#${m.place}/${m.players} · ${fmtDay(m.date)}`}))}/>
      </Card>
    </>} right={
      <Card title="รอบล่าสุด" scroll>{S.brs.slice(0,15).map((m,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid var(--c-border)'}}>
          <span style={{minWidth:64,textAlign:'center',borderRadius:8,padding:'3px 8px',fontSize:13,fontWeight:800,
            background:m.place===1?'#FEF3C7':m.place<=3?'#EDE9FE':'var(--c-surf)',color:m.place===1?'#92400E':m.place<=3?'#5B21B6':'var(--c-t2)'}}>
            {m.place===1?'🥇 ':''}#{m.place}/{m.players}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--c-t1)'}}>ห้อง {m.room}</div>
            <div style={{fontSize:11,color:'var(--c-t3)'}}>{fmtDate(m.date)} · {NOTE[m.note]||''}</div>
          </div>
          <span style={{fontSize:13,color:'var(--c-t2)',fontWeight:700}}>{wpmOf(m)} WPM</span>
        </div>))}</Card>
    }/>
  ) : <Empty>ยังไม่มีการแข่ง Battle Royale 🏆</Empty>;

  const h2h = S.h2h.length ? (
    <Card scroll note="นับเฉพาะ 1v1 กับเพื่อนที่เข้าสู่ระบบ · กดชื่อเพื่อดูทุกแมตช์ที่เคยเจอ">
      {S.h2h.map(e=>{
        const open=openOpp===e.key;
        return (
          <div key={e.key} style={{borderBottom:'1px solid var(--c-border)'}}>
            <button onClick={()=>setOpenOpp(open?null:e.key)}
              style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 0',background:'none',border:'none',
                cursor:'pointer',textAlign:'left',fontFamily:tf,color:'var(--c-t1)'}}>
              <OppAvatar name={e.name} cfg={oppChars[e.key]} size={34}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800}}>{e.name} <span style={{fontSize:11,color:'var(--c-t3)',fontWeight:600}}>· {e.cls}</span></div>
                <div style={{display:'flex',height:6,borderRadius:3,overflow:'hidden',marginTop:5,maxWidth:220,background:'var(--c-border)'}}>
                  <div style={{flex:e.w,background:'#16A34A'}}/><div style={{flex:e.d,background:'#94A3B8'}}/><div style={{flex:e.l,background:'#DC2626'}}/>
                </div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:15,fontWeight:800}}>{e.w}-{e.l}-{e.d}</div>
                <div style={{fontSize:11,color:'var(--c-t3)'}}>เจอ {e.games} ครั้ง · ล่าสุด {fmtDay(e.last)}</div>
              </div>
              <span style={{color:'var(--c-t3)',fontSize:12}}>{open?'▲':'▼'}</span>
            </button>
            {open&&<div style={{padding:'0 0 8px 44px'}}>{e.list.map((m,i)=><MatchRow key={i} m={m} oppChars={oppChars} showOpp={false}/>)}</div>}
          </div>
        );
      })}
    </Card>
  ) : <Empty>ยังไม่มีคู่แข่งที่บันทึกไว้ — แข่ง 1v1 กับเพื่อนที่เข้าสู่ระบบแล้วจะขึ้นที่นี่</Empty>;

  return (
    <div className="px-fill" style={{fontFamily:tf,display:'flex',flexDirection:'column',gap:'var(--fg)'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',flex:'none'}}>
        {window.CharKit?<CharKit.Avatar config={myCfg} size={44}/>:<span style={{fontSize:30}}>📊</span>}
        <div style={{minWidth:0}}>
          <div style={{fontSize:19,fontWeight:800,color:'var(--c-t1)'}}>สถิติของ {studentName}</div>
          <div style={{fontSize:12,color:'var(--c-t3)'}}>ห้อง {classCode} · ฝึก {S.sessions.length} รอบ · แข่ง {games} ครั้ง</div>
        </div>
        <div role="tablist" style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginLeft:'auto'}}>
          {TABS.map(([k,l])=>(
            <button key={k} role="tab" aria-selected={tab===k} onClick={()=>setTab(k)}
              className={tab===k?'px-btn':''}
              style={tab===k?{minHeight:'var(--hb)',padding:'0 6px',fontSize:14,fontFamily:tf}
                :{background:'#EFE2BF',border:'3px solid #3B2416',padding:'4px 10px',minHeight:'var(--hb)',cursor:'pointer',fontSize:14,fontWeight:700,
                  color:'var(--c-t2)',fontFamily:tf}}>{l}</button>
          ))}
        </div>
      </div>
      {tab==='ov'&&overview}{tab==='solo'&&solo}{tab==='duel'&&duel}{tab==='br'&&br}{tab==='h2h'&&h2h}
    </div>
  );
}
