// Pixel-art UI building blocks (styles in assets/ui/pixel.css).
// Panels and buttons are 9-slice images, so they stretch to any size with crisp edges.
const { useEffect, useRef } = React;

export const PX_FONT = "'Pixelify Sans', monospace";
export const TH_FONT = "'Noto Sans Thai Looped', 'Sarabun', sans-serif";
export const INK = '#3B2416';

// One piece from the sprite atlas: <Sprite name="i_coin"/>
export function Sprite({ name, style, label }) {
  return <span className={'sp sp-' + name} style={style}
    role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}/>;
}

// Parchment panel, optionally with a green title bar on top.
export function PxPanel({ title, children, style, bodyStyle, wood }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {title != null && (
        <div className="px-head" style={{ minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FFF6D8', fontWeight: 700, fontSize: 20, textShadow: '2px 2px 0 #2B4A3A',
          marginBottom: -6, position: 'relative', textAlign: 'center' }}>{title}</div>
      )}
      <div className={wood ? 'px-wood' : 'px-panel'} style={{ color: wood ? '#F5E6BE' : INK, ...bodyStyle }}>{children}</div>
    </div>
  );
}

export function PxButton({ children, style, ...rest }) {
  return <button className="px-btn" style={{ minHeight: 52, fontSize: 17, padding: '0 6px', ...style }} {...rest}>{children}</button>;
}

// Square green button with an icon from the atlas.
export function PxIconButton({ icon, label, onClick, href }) {
  const inner = <Sprite name={icon}/>;
  const cls = 'sp sp-sqbtn px-icon-btn';
  return href
    ? <a className={cls} href={href} aria-label={label} title={label}>{inner}</a>
    : <button className={cls} onClick={onClick} aria-label={label} title={label}>{inner}</button>;
}

// Full-screen background: sky, drifting clouds, fields, front grass.
export function Scene({ dim = 0, children }) {
  return (
    <div className="scene">
      <div className="lay l-sky"/><div className="lay l-cl"/><div className="lay l-fi"/><div className="lay l-fr"/>
      {children}
      {dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(10,30,40,${dim})` }}/>}
    </div>
  );
}

// Characters running across the bottom of the screen, one after another.
// `queue` = character configs to use in order (repeats when it runs out).
// Drawn on one canvas in requestAnimationFrame, so React never re-renders for it.
export function Runners({ queue, max = 3, scale = 3, bottom = 40 }) {
  const cvRef = useRef(null);
  const qRef = useRef(queue); qRef.current = queue;
  useEffect(() => {
    const CK = window.CharKit, cv = cvRef.current;
    if (!CK || !cv) return;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const S = 64 * scale, ctx = cv.getContext('2d');
    let raf = 0, last = performance.now(), nextSpawn = 0, qi = 0, alive = true;
    const runners = [];
    const nextCfg = () => {
      const q = qRef.current || [];
      const c = q.length ? q[qi++ % q.length] : CK.randomize();
      return CK.sanitize(c) || CK.randomize();
    };
    const spawn = (x) => {
      const r = { x, speed: 150 + Math.random() * 70, frame: Math.floor(Math.random() * 6), acc: 0, sprite: null,
        lift: Math.floor(Math.random() * 3) * 6 };
      CK.buildSprite(nextCfg()).then(s => { r.sprite = s; }).catch(() => {});
      runners.push(r);
    };
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    if (reduce) {          // no motion: a few characters standing still
      const w = cv.clientWidth;
      [0.18, 0.5, 0.82].slice(0, max).forEach(f => spawn(w * f - S / 2));
    }
    const tick = (now) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!reduce && now >= nextSpawn && runners.length < max) {
        spawn(-S);
        nextSpawn = now + 2200 + Math.random() * 2600;
      }
      ctx.clearRect(0, 0, w, h);
      for (let i = runners.length - 1; i >= 0; i--) {
        const r = runners[i];
        if (!reduce) {
          r.x += r.speed * dt;
          r.acc += dt * 1000;
          while (r.acc >= 100) { r.acc -= 100; r.frame++; }
          if (r.x > w + 20) { runners.splice(i, 1); continue; }
        }
        if (r.sprite) CK.drawFrame(ctx, r.sprite, reduce ? 'idle' : 'run', r.frame, Math.round(r.x), h - S - r.lift, scale);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [max, scale]);
  return <canvas ref={cvRef} aria-hidden="true"
    style={{ position: 'absolute', left: 0, right: 0, bottom, width: '100%', height: 64 * scale + 12, pointerEvents: 'none' }}/>;
}
