import { apiGetStudentStats } from '../api';
import { fmtScore } from '../engine/scoring';

const { useEffect, useState } = React;

export // PROGRESS CHART

function ProgressChart({ sessions }) {
  const [tab, setTab] = useState('wpm'); // 'wpm' | 'both'
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";

  // Reverse to chronological order, take last 20
  const data = [...sessions].reverse().slice(-20).map((s, i) => ({
    n:    i + 1,
    wpm:  Math.round(s.cpm / 5),
    acc:  s.accuracy,
    ex:   s.exercise,
  }));

  if (data.length < 2) return (
    <div style={{textAlign:'center',padding:24,color:'var(--c-t3)',fontSize:13,fontFamily:tf,
      background:'var(--c-surf)',borderRadius:12,border:'1.5px solid var(--c-border)'}}>
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
    <div>
      {/* Tab switcher */}
      <div style={{display:'flex',gap:6,marginBottom:12}}>
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
      <div style={{display:'flex',gap:16,marginBottom:10}}>
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
      <div style={{overflowX:'auto'}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',minWidth:280,display:'block'}}>
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

export // MY STATS SCREEN

function MyStatsScreen({ studentName, classCode, onBack }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const tf = "'Sarabun','Noto Sans Thai',sans-serif";

  useEffect(() => {
    apiGetStudentStats(classCode, studentName)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData({ error:true }); setLoading(false); });
  }, []);

  const formatDate = (iso) => {
    const d = new Date(iso);
    const dd  = String(d.getDate()).padStart(2,'0');
    const mm  = String(d.getMonth()+1).padStart(2,'0');
    const yy  = String(d.getFullYear()+543).slice(-2);
    const hh  = String(d.getHours()).padStart(2,'0');
    const min = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yy} ${hh}:${min}`;
  };

  if (loading) return <div style={{textAlign:'center',padding:40,color:'var(--c-t3)',fontFamily:tf}}>กำลังโหลด...</div>;
  if (!data || data.error) return <div style={{textAlign:'center',padding:40,color:'#DC2626',fontFamily:tf}}>โหลดไม่ได้ — ตรวจสัญญาณ</div>;

  return (
    <div style={{fontFamily:tf}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:800,color:'var(--c-t1)'}}>📊 สถิติของ {studentName}</div>
        <div style={{fontSize:12,color:'var(--c-t3)',marginTop:2}}>ห้อง {classCode} · {data.totalSessions} เซสชั่น</div>
      </div>
      {data.totalSessions > 0 ? (
        <>
          <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
            {[
              ['WPM เฉลี่ย',  Math.round(data.avgCpm/5), '#2563EB'],
              ['ความแม่น',   data.avgAcc+'%', data.avgAcc>=95?'#059669':'#D97706'],
              ['WPM สูงสุด', Math.round(data.bestCpm/5), '#7C3AED'],
              ['เซสชั่น',    data.totalSessions, 'var(--c-t1)'],
            ].map(([lbl,val,color])=>(
              <div key={lbl} style={{background:'var(--c-surf)',border:'1.5px solid var(--c-border)',
                borderRadius:12,padding:'10px 16px',textAlign:'center',flex:1,minWidth:70}}>
                <div style={{fontSize:22,fontWeight:800,color}}>{val}</div>
                <div style={{fontSize:10,color:'var(--c-t3)',fontWeight:600,letterSpacing:.5,marginTop:2}}>{lbl}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)',marginBottom:10,marginTop:8}}>พัฒนาการ</div>
          <div style={{background:'#fff',border:'1.5px solid var(--c-border)',borderRadius:12,padding:'16px',marginBottom:20}}>
            <ProgressChart sessions={data.sessions}/>
          </div>
          <div style={{fontSize:14,fontWeight:800,color:'var(--c-t1)',marginBottom:10}}>ประวัติการฝึก</div>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',background:'var(--c-card)',
              borderRadius:12,overflow:'hidden',border:'1.5px solid var(--c-border)',fontSize:12}}>
              <thead>
                <tr style={{background:'var(--c-surf)'}}>
                  {['วันที่','แบบฝึก','คะแนน','WPM','ความแม่น','ผิด'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',textAlign:'left',fontWeight:700,
                      color:'var(--c-t2)',fontSize:10,letterSpacing:.5,borderBottom:'1.5px solid #E2E8F0'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((s,i)=>(
                  <tr key={i} style={{borderBottom:'1px solid var(--c-border)'}}>
                    <td style={{padding:'8px 12px',color:'var(--c-t2)'}}>{formatDate(s.date)}</td>
                    <td style={{padding:'8px 12px'}}>{s.exercise}</td>
                    <td style={{padding:'8px 12px',fontWeight:700,color:'#D97706'}}>{s.score?fmtScore(s.score):'–'}</td>
                    <td style={{padding:'8px 12px',fontWeight:700}}>{Math.round(s.cpm/5)}</td>
                    <td style={{padding:'8px 12px',fontWeight:700,
                      color:s.accuracy>=95?'#059669':s.accuracy>=85?'#D97706':'#DC2626'}}>
                      {s.accuracy}%</td>
                    <td style={{padding:'8px 12px',color:s.errors===0?'#059669':'#EF4444'}}>{s.errors}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{textAlign:'center',color:'var(--c-t3)',padding:32,
          background:'var(--c-surf)',borderRadius:12,border:'1.5px solid var(--c-border)'}}>
          ยังไม่มีประวัติการฝึก — เริ่มเล่นได้เลย!
        </div>
      )}
      <button onClick={onBack} style={{marginTop:20,width:'100%',background:'#F1F5F9',
        color:'#0F172A',border:'none',borderRadius:10,padding:'12px',
        cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:tf}}>
        ← กลับ
      </button>
    </div>
  );
}
