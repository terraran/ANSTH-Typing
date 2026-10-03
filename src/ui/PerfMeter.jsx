// Performance meter — only when the page is opened with ?perf=1 (students never see it).
// Shows how often the main screen re-renders and the time from a key press to the next frame.
const { useEffect, useState } = React;

export const PERF_ON = typeof location !== 'undefined' && /[?&]perf=1\b/.test(location.search);
export const perf = { renders: 0, t0: 0, lat: [] };

export function PerfMeter() {
  const [v, setV] = useState(null);
  useEffect(() => {
    let last = perf.renders, lt = performance.now();
    const id = setInterval(() => {
      const n = performance.now(), L = perf.lat.slice(-30);
      setV({
        rps: Math.round((perf.renders - last) / ((n - lt) / 1000)),
        avg: L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length) : 0,
        max: L.length ? Math.round(Math.max(...L)) : 0,
      });
      last = perf.renders; lt = n;
    }, 1000);
    return () => clearInterval(id);
  }, []);
  if (!v) return null;
  const bad = v.avg > 50 || v.rps > 30;
  return (
    <div style={{position:'fixed',right:8,bottom:8,zIndex:2000,background:bad?'#7F1D1D':'#0F172A',color:'#fff',
      borderRadius:8,padding:'6px 10px',font:'12px/1.5 ui-monospace,monospace',opacity:.9,pointerEvents:'none'}}>
      วาดหน้า {v.rps}/วิ · กด→จอ เฉลี่ย {v.avg}ms (สูงสุด {v.max}ms)
    </div>
  );
}
