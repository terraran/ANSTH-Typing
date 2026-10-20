// Small pieces shared by the teacher page's tabs and dialogs.
const { useEffect } = React;
import { LESSON_DEFS, STAGES, lessonIdOf, lessonName, stepsFor, stepTitle } from '../data/stages.js';

// Dialog over the page: closes on ✕, Esc or a click outside.
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => { const k = e => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card modal" style={wide ? { width: 'min(640px,100%)' } : null} role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}>
        <h3>{title}<button className="x" onClick={onClose} aria-label="ปิด">✕</button></h3>
        {children}
      </div>
    </div>
  );
}

// Stage buttons (ด่าน n + name). max = how many stages to offer.
export function StagePick({ value, onChange, max = 9, cols = 3 }) {
  return <div className="stagepick" style={{ gridTemplateColumns: `repeat(${cols},1fr)` }}>{STAGES.slice(0, max).map(s =>
    <button key={s.id} className={value === s.id ? 'on' : ''} onClick={() => onChange(s.id)}>ด่าน {s.id}<small>{s.title}</small></button>)}</div>;
}

// Stage as homework / weekly content: the stage's boss lesson sets the keyboard and the speed target.
export function stageContent(n) {
  const defs = LESSON_DEFS.filter(d => d.stage === n), st = STAGES[n - 1];
  return { stage: n, lessonId: lessonIdOf(defs[defs.length - 1].n), title: `ด่าน ${n} · ${st.title}` };
}

// Every curriculum step for the "เลือกแบบฝึกเอง" list, grouped by lesson.
export const LESSON_GROUPS = LESSON_DEFS.map(d => ({
  label: `ด่าน ${d.stage} · บท ${d.n} ${lessonName(d)}`,
  items: stepsFor(d).map((s, i) => {
    const ex = stepTitle(d, i, s);
    return { key: lessonIdOf(d.n) + '|' + ex, stage: d.stage, lessonId: lessonIdOf(d.n), exerciseTitle: ex, title: `บท ${d.n} · ${ex}` };
  }),
}));
export const findExercise = key => { for (const g of LESSON_GROUPS) for (const it of g.items) if (it.key === key) return it; return null; };

export function ExercisePick({ value, onChange, maxStage = 9 }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="แบบฝึก">
      <option value="">เลือกแบบฝึก…</option>
      {LESSON_GROUPS.filter(g => g.items[0].stage <= maxStage).map(g => <optgroup key={g.label} label={g.label}>
        {g.items.map(it => <option key={it.key} value={it.key}>{it.exerciseTitle}</option>)}
      </optgroup>)}
    </select>
  );
}

// Progress bar with a label: ผ่าน 14/22
export function Bar({ value, total, children }) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0;
  return <div className="bar"><div className="track"><div className="fill" style={{ width: pct + '%' }}/></div><span>{children}</span></div>;
}

// ── dates as 'yyyy-MM-dd' (weeks start on Monday) ──
export const parseYmd = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
export const toYmd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const addDays = (ymd, n) => { const d = parseYmd(ymd); d.setDate(d.getDate() + n); return toYmd(d); };
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const short = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
export const dayLabel = ymd => { const d = parseYmd(ymd); return d ? d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' }) : ymd; };
export function weekLabel(ymd) {
  const a = parseYmd(ymd); if (!a) return ymd;
  const b = new Date(a); b.setDate(b.getDate() + 6);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${short(b)}` : `${short(a)} – ${short(b)}`;
}
export const shortDate = v => { const d = v ? new Date(v) : null; return d && !isNaN(d) ? short(d) : '–'; };
