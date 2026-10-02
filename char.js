/* ═══════════════════════════════════════════════════════════════
   CharKit — pixel-art character renderer + character creator
   Plain JavaScript (no Babel) so it loads fast. Needs React UMD first.
   Assets: assets/char/char.json, *_base_sheet.png, hair/hair_*.png
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const h = React.createElement;
  const { useState, useEffect, useRef } = React;
  const BASE = 'assets/char/';
  const VER = '1';               // bump after replacing any asset file (cache-busting)
  const TF = "'Sarabun','Noto Sans Thai',sans-serif";

  // ── Choices ─────────────────────────────────────────────────
  // ramp = [darkest, lightest] target colours; null = keep the original art colours.
  const BODIES = [
    { id: 'boy',  name: 'ชุดนักเรียนชาย' },
    { id: 'girl', name: 'ชุดนักเรียนหญิง' },
  ];
  const HAIRSTYLES = [
    { id: 'buzz',         name: 'เกรียน' },
    { id: 'm01_neat',     name: 'สั้นเรียบ' },
    { id: 'm02_spiky',    name: 'ตั้งชี้' },
    { id: 'm03_sidepart', name: 'แสกข้าง' },
    { id: 'm04_curly',    name: 'หยิก' },
    { id: 'm05_bowl',     name: 'กะลา' },
    { id: 'f01_bob',      name: 'ติ่งหู' },
    { id: 'f02_ponytail', name: 'หางม้า' },
    { id: 'f03_pigtails', name: 'แกละ' },
    { id: 'f04_bun',      name: 'ดังโงะ' },
    { id: 'f05_braid',    name: 'เปีย' },
  ];
  const HAIR_COLORS = [
    { id: 'black',     name: 'ดำ',         ramp: [[18, 16, 22], [74, 66, 72]] },
    { id: 'darkbrown', name: 'น้ำตาลเข้ม', ramp: [[34, 20, 16], [118, 76, 50]] },
    { id: 'brown',     name: 'น้ำตาล',     ramp: null },
    { id: 'blonde',    name: 'บลอนด์',     ramp: [[140, 98, 36], [250, 224, 142]] },
    { id: 'red',       name: 'แดง',        ramp: [[96, 24, 18], [232, 108, 62]] },
    { id: 'pink',      name: 'ชมพู',       ramp: [[130, 40, 90], [252, 160, 205]] },
    { id: 'purple',    name: 'ม่วง',       ramp: [[56, 30, 104], [178, 132, 236]] },
    { id: 'blue',      name: 'น้ำเงิน',    ramp: [[24, 38, 100], [108, 162, 236]] },
    { id: 'green',     name: 'เขียว',      ramp: [[22, 74, 46], [126, 214, 140]] },
    { id: 'silver',    name: 'เทา',        ramp: [[78, 80, 92], [232, 234, 240]] },
  ];
  const SKIN_TONES = [
    { id: 'light',   name: 'ขาว',      ramp: [[66, 40, 34], [250, 214, 188]] },
    { id: 'fair',    name: 'ขาวเหลือง', ramp: [[60, 38, 28], [240, 196, 156]] },
    { id: 'natural', name: 'สองสี',    ramp: null },
    { id: 'tan',     name: 'คล้ำ',     ramp: [[40, 24, 20], [178, 118, 82]] },
    { id: 'deep',    name: 'เข้ม',     ramp: [[26, 16, 14], [128, 82, 58]] },
  ];
  const SOCK_COLORS = [
    { id: 'white', name: 'ขาว',    ramp: [[176, 180, 192], [242, 242, 246]] },
    { id: 'black', name: 'ดำ',     ramp: [[22, 22, 28], [62, 62, 72]] },
    { id: 'grey',  name: 'เทา',    ramp: [[92, 96, 108], [160, 164, 176]] },
    { id: 'navy',  name: 'กรมท่า', ramp: [[24, 32, 66], [52, 66, 120]] },
    { id: 'blue',  name: 'ฟ้า',    ramp: null },
    { id: 'pink',  name: 'ชมพู',   ramp: [[188, 92, 136], [246, 166, 200]] },
  ];
  const SHOE_COLORS = [
    { id: 'black', name: 'ดำ',    ramp: [[20, 20, 26], [128, 128, 140]] },
    { id: 'white', name: 'ขาว',   ramp: [[150, 152, 164], [252, 252, 254]] },
    { id: 'brown', name: 'น้ำตาล', ramp: [[66, 40, 26], [196, 150, 112]] },
    { id: 'red',   name: 'แดง',   ramp: [[120, 24, 28], [250, 150, 140]] },
    { id: 'blue',  name: 'น้ำเงิน', ramp: [[28, 48, 120], [150, 190, 250]] },
    { id: 'green', name: 'เขียว', ramp: null },
  ];
  const OPTIONS = { body: BODIES, hair: HAIRSTYLES, hairColor: HAIR_COLORS, skin: SKIN_TONES, socks: SOCK_COLORS, shoes: SHOE_COLORS };
  const byId = (list, id) => list.find(o => o.id === id);

  function defaults(body) {
    const boy = body !== 'girl';
    return { body: boy ? 'boy' : 'girl', hair: boy ? 'm01_neat' : 'f02_ponytail', hairColor: 'black',
      skin: 'natural', socks: boy ? 'black' : 'white', shoes: boy ? 'black' : 'white' };
  }
  // Accepts anything (object or JSON string); returns a valid config or null.
  function sanitize(raw) {
    let c = raw;
    if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { return null; } }
    if (!c || typeof c !== 'object') return null;
    const out = defaults(c.body);
    Object.keys(OPTIONS).forEach(k => { if (byId(OPTIONS[k], c[k])) out[k] = c[k]; });
    return out;
  }
  function randomize(body) {
    const pick = l => l[Math.floor(Math.random() * l.length)].id;
    return { body: body || pick(BODIES), hair: pick(HAIRSTYLES), hairColor: pick(HAIR_COLORS),
      skin: pick(SKIN_TONES), socks: pick(SOCK_COLORS), shoes: pick(SHOE_COLORS) };
  }
  const keyOf = c => [c.body, c.hair, c.hairColor, c.skin, c.socks, c.shoes].join('|');
  function loadLocal(who) {
    try { return sanitize(localStorage.getItem('char_v1:' + (who || 'guest'))); } catch (e) { return null; }
  }
  function saveLocal(who, cfg) {
    try { localStorage.setItem('char_v1:' + (who || 'guest'), JSON.stringify(sanitize(cfg))); } catch (e) {}
  }

  // ── Asset loading ───────────────────────────────────────────
  let _data = null, _loading = null;
  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('โหลดรูปไม่ได้: ' + src));
      i.src = src;
    });
  }
  function load() {
    if (_data) return Promise.resolve(_data);
    if (_loading) return _loading;
    _loading = fetch(BASE + 'char.json?v=' + VER)
      .then(r => { if (!r.ok) throw new Error('char.json HTTP ' + r.status); return r.json(); })
      .then(async j => {
        const imgs = {};
        const jobs = Object.entries(j.sheets).map(async ([k, f]) => { imgs['body_' + k] = await loadImg(BASE + f + '?v=' + VER); });
        Object.entries(j.hair).forEach(([k, s]) => jobs.push((async () => { imgs['hair_' + k] = await loadImg(BASE + 'hair/' + s.file + '?v=' + VER); })()));
        await Promise.all(jobs);
        j.imgs = imgs;
        _data = j;
        return j;
      })
      .catch(err => { _loading = null; throw err; });
    return _loading;
  }

  // ── Recolouring ─────────────────────────────────────────────
  const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const ck = c => c[0] + ',' + c[1] + ',' + c[2];
  // Map each source shade onto the ramp by its brightness within the group.
  function rampMap(sources, ramp, map) {
    if (!ramp || !sources || !sources.length) return map;
    const L = sources.map(lum), lo = Math.min(...L), hi = Math.max(...L);
    sources.forEach((c, i) => {
      const t = hi > lo ? (L[i] - lo) / (hi - lo) : 0.5;
      map.set(ck(c), [0, 1, 2].map(k => Math.round(ramp[0][k] + (ramp[1][k] - ramp[0][k]) * t)));
    });
    return map;
  }
  function recolorCanvas(img, map) {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    if (!map.size) return cv;
    const id = ctx.getImageData(0, 0, cv.width, cv.height), d = id.data;
    for (let p = 0; p < d.length; p += 4) {
      if (!d[p + 3]) continue;
      const m = map.get(d[p] + ',' + d[p + 1] + ',' + d[p + 2]);
      if (m) { d[p] = m[0]; d[p + 1] = m[1]; d[p + 2] = m[2]; }
    }
    ctx.putImageData(id, 0, 0);
    return cv;
  }

  // Builds (and caches) one finished sheet per character: body + hair, every frame.
  const _cache = new Map();
  function buildSprite(cfgIn) {
    const cfg = sanitize(cfgIn) || defaults('boy');
    const key = keyOf(cfg);
    if (_cache.has(key)) return Promise.resolve(_cache.get(key));
    return load().then(D => {
      if (_cache.has(key)) return _cache.get(key);
      const P = D.palette, S = D.frameSize;
      const hairRamp = byId(HAIR_COLORS, cfg.hairColor).ramp;
      const skinMap = rampMap(P.skin, byId(SKIN_TONES, cfg.skin).ramp, new Map());
      const bodyMap = new Map(skinMap);
      rampMap(P.socks, byId(SOCK_COLORS, cfg.socks).ramp, bodyMap);
      rampMap(P.shoes, byId(SHOE_COLORS, cfg.shoes).ramp, bodyMap);
      rampMap(P.baseHair, hairRamp, bodyMap);   // the buzz cut is the body's own hair
      const sheet = recolorCanvas(D.imgs['body_' + cfg.body], bodyMap);
      const style = D.hair[cfg.hair];
      if (style) {
        const hairMap = rampMap(style.hairColours, hairRamp, new Map(skinMap));
        const ov = recolorCanvas(D.imgs['hair_' + cfg.hair], hairMap);
        const ctx = sheet.getContext('2d');
        Object.entries(D.animations).forEach(([name, a]) => {
          (D.headAnchor[name] || []).forEach((anc, i) => {
            const fx = i * S, fy = a.row * S;
            ctx.save();
            ctx.beginPath(); ctx.rect(fx, fy, S, S); ctx.clip();
            ctx.drawImage(ov, fx + anc.x + style.offset.x, fy + anc.y + style.offset.y);
            ctx.restore();
          });
        });
      }
      const sprite = { cfg, sheet, size: S, anims: D.animations };
      _cache.set(key, sprite);
      if (_cache.size > 60) _cache.delete(_cache.keys().next().value);
      return sprite;
    });
  }

  // Draws one frame. crop = part of the 64×64 frame to show.
  function drawFrame(ctx, sprite, anim, frame, dx, dy, scale, crop) {
    const a = sprite.anims[anim] || sprite.anims.idle, S = sprite.size;
    const c = crop || { x: 0, y: 0, w: S, h: S };
    const f = ((frame % a.frames) + a.frames) % a.frames;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite.sheet, f * S + c.x, a.row * S + c.y, c.w, c.h, dx, dy, c.w * scale, c.h * scale);
  }

  // ── React: animated character on a canvas ───────────────────
  // Animation runs in requestAnimationFrame, outside React state, so it never
  // re-renders the page. `speed` multiplies the animation rate (e.g. typing speed).
  const FULL = { x: 6, y: 0, w: 52, h: 62 };
  const HEAD = { x: 14, y: 0, w: 34, h: 30 };
  function CharCanvas(props) {
    const { config, anim = 'idle', scale = 3, crop = FULL, speed = 1, still = false, style } = props;
    const cvRef = useRef(null), spriteRef = useRef(null), optRef = useRef({});
    const [err, setErr] = useState('');
    optRef.current = { anim, speed, still, crop, scale };
    const cfgKey = config ? keyOf(sanitize(config) || defaults('boy')) : 'none';

    useEffect(() => {
      let alive = true;
      setErr('');
      buildSprite(config || defaults('boy'))
        .then(s => { if (alive) { spriteRef.current = s; drawNow(0); } })
        .catch(e => { if (alive) setErr(e.message || 'โหลดไม่ได้'); });
      return () => { alive = false; };
    }, [cfgKey]);

    function drawNow(frame) {
      const cv = cvRef.current, s = spriteRef.current;
      if (!cv || !s) return;
      const o = optRef.current, ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawFrame(ctx, s, o.anim, frame, 0, 0, o.scale, o.crop);
    }

    useEffect(() => {
      if (still) { drawNow(0); return; }
      let raf = 0, last = performance.now(), acc = 0, frame = 0, shown = -1;
      const tick = now => {
        const s = spriteRef.current, o = optRef.current;
        if (s) {
          const a = s.anims[o.anim] || s.anims.idle;
          acc += (now - last) * Math.max(0, o.speed);
          const step = a.frameMs || 200;
          while (acc >= step) { acc -= step; frame++; }
          if (frame !== shown) { drawNow(frame); shown = frame; }
        }
        last = now;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [still, anim]);

    useEffect(() => { drawNow(0); }, [anim, scale, crop.x, crop.y, crop.w, crop.h]);

    if (err) return h('div', { style: { fontSize: 11, color: '#DC2626', fontFamily: TF, ...style } }, '⚠️ ' + err);
    return h('canvas', { ref: cvRef, width: crop.w * scale, height: crop.h * scale,
      style: { imageRendering: 'pixelated', display: 'block', ...style } });
  }

  // Small round head for badges and lists.
  function Avatar({ config, size = 42, animate = true }) {
    return h('div', { style: { width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: 'linear-gradient(135deg,#BFDBFE,#DDD6FE)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' } },
      config
        ? h(CharCanvas, { config, crop: HEAD, scale: 2, still: !animate, style: { width: size * 1.05, height: 'auto' } })
        : h('span', { style: { fontSize: size * 0.48, lineHeight: size + 'px', width: '100%', textAlign: 'center' } }, '👤'));
  }

  // ── React: character creator screen ─────────────────────────
  function Section({ title, children }) {
    return h('div', { style: { marginBottom: 16 } },
      h('div', { style: { fontSize: 12, fontWeight: 800, color: 'var(--c-t2)', letterSpacing: .5, marginBottom: 8 } }, title),
      children);
  }
  function rampSwatch(o, fallback) {
    const c = o.ramp ? o.ramp.map(v => 'rgb(' + v.join(',') + ')') : fallback;
    return 'linear-gradient(135deg,' + c[1] + ' 0%,' + c[1] + ' 45%,' + c[0] + ' 100%)';
  }
  const ORIGINAL = {
    hairColor: ['rgb(82,49,29)', 'rgb(181,122,81)'],
    skin: ['rgb(156,110,91)', 'rgb(212,157,129)'],
    socks: ['rgb(62,79,96)', 'rgb(84,117,151)'],
    shoes: ['rgb(66,103,92)', 'rgb(177,211,186)'],
  };
  function Swatches({ list, value, onPick, field }) {
    return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 10 } },
      list.map(o => {
        const on = o.id === value;
        return h('button', { key: o.id, onClick: () => onPick(o.id), title: o.name,
            style: { background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 52,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: TF } },
          h('span', { style: { width: 34, height: 34, borderRadius: '50%', background: rampSwatch(o, ORIGINAL[field]),
            boxShadow: on ? '0 0 0 3px var(--c-card),0 0 0 5px #2563EB' : '0 0 0 1.5px var(--c-border2)' } }),
          h('span', { style: { fontSize: 10, fontWeight: on ? 800 : 600, color: on ? '#2563EB' : 'var(--c-t2)', lineHeight: 1.2 } }, o.name));
      }));
  }

  function CreatorScreen({ initial, signedIn, onSave, onBack }) {
    const [cfg, setCfg] = useState(() => sanitize(initial) || defaults('boy'));
    const [anim, setAnim] = useState('idle');
    const [status, setStatus] = useState('idle');      // idle | saving | saved | error
    const [errMsg, setErrMsg] = useState('');
    const [ready, setReady] = useState(!!_data);
    const [loadErr, setLoadErr] = useState('');
    const isNew = !sanitize(initial);
    useEffect(() => { load().then(() => setReady(true)).catch(e => setLoadErr(e.message)); }, []);
    const set = (k, v) => { setCfg(c => ({ ...c, [k]: v })); setStatus('idle'); };
    // Switching uniform also swaps socks/shoes to the new uniform's defaults, unless the student changed them.
    const setBody = b => { setStatus('idle'); setCfg(c => {
      const od = defaults(c.body), nd = defaults(b), n = { ...c, body: b };
      if (c.socks === od.socks) n.socks = nd.socks;
      if (c.shoes === od.shoes) n.shoes = nd.shoes;
      return n;
    }); };
    const save = async () => {
      setStatus('saving'); setErrMsg('');
      try { await onSave(sanitize(cfg)); setStatus('saved'); }
      catch (e) { setStatus('error'); setErrMsg(e && e.message ? e.message : 'บันทึกไม่สำเร็จ'); }
    };
    const pill = (on, label, onClick) => h('button', { onClick,
      style: { flex: 1, padding: '9px 10px', borderRadius: 10, cursor: 'pointer', fontFamily: TF, fontSize: 13, fontWeight: 800,
        border: '1.5px solid ' + (on ? '#2563EB' : 'var(--c-border)'), background: on ? '#2563EB' : 'var(--c-card)',
        color: on ? '#fff' : 'var(--c-t1)' } }, label);

    if (loadErr) return h('div', { style: { fontFamily: TF, textAlign: 'center', padding: 30 } },
      h('div', { style: { color: '#DC2626', fontWeight: 700, marginBottom: 12 } }, '⚠️ โหลดตัวละครไม่ได้ — ' + loadErr),
      h('button', { onClick: onBack, style: { padding: '10px 18px', borderRadius: 10, border: 'none', background: '#0F172A', color: '#fff', cursor: 'pointer', fontFamily: TF } }, '← กลับ'));
    if (!ready) return h('div', { style: { fontFamily: TF, textAlign: 'center', padding: 40, color: 'var(--c-t3)' } }, 'กำลังโหลดตัวละคร...');

    const preview = h('div', { style: { flex: '0 0 auto', width: 240, margin: '0 auto' } },
      h('div', { style: { background: 'linear-gradient(180deg,#DBEAFE 0%,#EFF6FF 62%,#86EFAC 62%,#4ADE80 100%)',
          borderRadius: 18, padding: '14px 0 10px', display: 'flex', justifyContent: 'center', border: '1.5px solid var(--c-border)' } },
        h(CharCanvas, { config: cfg, anim, scale: 4 })),
      h('div', { style: { display: 'flex', gap: 6, marginTop: 10 } },
        pill(anim === 'idle', '🧍 ยืน', () => setAnim('idle')),
        pill(anim === 'run', '🏃 วิ่ง', () => setAnim('run'))),
      h('button', { onClick: () => { setCfg(randomize(cfg.body)); setStatus('idle'); },
          style: { width: '100%', marginTop: 8, padding: '10px', borderRadius: 10, cursor: 'pointer', fontFamily: TF, fontSize: 13,
            fontWeight: 800, border: '1.5px solid var(--c-border)', background: 'var(--c-surf)', color: 'var(--c-t1)' } }, '🎲 สุ่มตัวละคร'));

    const hairGrid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(64px,1fr))', gap: 8 } },
      HAIRSTYLES.map(s => {
        const on = s.id === cfg.hair;
        return h('button', { key: s.id, onClick: () => set('hair', s.id),
            style: { cursor: 'pointer', borderRadius: 12, padding: '6px 2px 4px', fontFamily: TF,
              border: '2px solid ' + (on ? '#2563EB' : 'var(--c-border)'), background: on ? '#EFF6FF' : 'var(--c-card)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } },
          h(CharCanvas, { config: { ...cfg, hair: s.id }, crop: HEAD, scale: 1.5, still: true, style: { width: 51, height: 45 } }),
          h('span', { style: { fontSize: 11, fontWeight: on ? 800 : 600, color: on ? '#1D4ED8' : 'var(--c-t2)' } }, s.name));
      }));

    const options = h('div', { style: { flex: '1 1 300px', minWidth: 0 } },
      h(Section, { title: 'ชุดนักเรียน' },
        h('div', { style: { display: 'flex', gap: 8 } },
          BODIES.map(b => pill(cfg.body === b.id, (b.id === 'boy' ? '👦 ' : '👧 ') + b.name, () => setBody(b.id))))),
      h(Section, { title: 'ทรงผม' }, hairGrid),
      h(Section, { title: 'สีผม · ' + byId(HAIR_COLORS, cfg.hairColor).name },
        h(Swatches, { list: HAIR_COLORS, value: cfg.hairColor, field: 'hairColor', onPick: v => set('hairColor', v) })),
      h(Section, { title: 'สีผิว · ' + byId(SKIN_TONES, cfg.skin).name },
        h(Swatches, { list: SKIN_TONES, value: cfg.skin, field: 'skin', onPick: v => set('skin', v) })),
      h(Section, { title: 'ถุงเท้า · ' + byId(SOCK_COLORS, cfg.socks).name },
        h(Swatches, { list: SOCK_COLORS, value: cfg.socks, field: 'socks', onPick: v => set('socks', v) })),
      h(Section, { title: 'รองเท้า · ' + byId(SHOE_COLORS, cfg.shoes).name },
        h(Swatches, { list: SHOE_COLORS, value: cfg.shoes, field: 'shoes', onPick: v => set('shoes', v) })),
      h(Section, { title: 'ชุด' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
            border: '1.5px solid var(--c-border)', background: 'var(--c-surf)' } },
          h('span', { style: { fontSize: 22 } }, '🏫'),
          h('div', { style: { flex: 1 } },
            h('div', { style: { fontSize: 13, fontWeight: 800, color: 'var(--c-t1)' } }, 'ชุดนักเรียน ✓'),
            h('div', { style: { fontSize: 11, color: 'var(--c-t3)' } }, 'สีชุดล็อกไว้ตามชุดจริงของโรงเรียน · ชุดอื่นจะปลดล็อกได้จากเป้าหมายการพิมพ์ เร็ว ๆ นี้')))));

    const statusLine = status === 'saving' ? '💾 กำลังบันทึก...'
      : status === 'saved' ? '✅ บันทึกแล้ว!'
      : status === 'error' ? '⚠️ ' + (errMsg || 'บันทึกไม่สำเร็จ') : '';

    return h('div', { style: { fontFamily: TF } },
      h('div', { style: { marginBottom: 18 } },
        h('div', { style: { fontSize: 22, fontWeight: 800, color: 'var(--c-t1)' } }, isNew ? '🎨 สร้างตัวละครของคุณ' : '🎨 แก้ไขตัวละคร'),
        h('div', { style: { fontSize: 13, color: 'var(--c-t2)', marginTop: 2 } },
          'ตัวละครนี้จะไปอยู่บนลู่วิ่งตอนแข่ง · แก้ไขทีหลังได้เสมอ'),
        !signedIn && h('div', { style: { fontSize: 12, color: '#B45309', marginTop: 6, fontWeight: 700 } },
          'ยังไม่ได้เข้าสู่ระบบ — ตัวละครจะบันทึกไว้ในเครื่องนี้เท่านั้น')),
      h('div', { style: { display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' } }, preview, options),
      h('div', { style: { display: 'flex', gap: 10, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' } },
        h('button', { onClick: save, disabled: status === 'saving',
            style: { flex: '2 1 200px', padding: '13px', borderRadius: 12, border: 'none', cursor: status === 'saving' ? 'default' : 'pointer',
              background: '#059669', color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: TF, opacity: status === 'saving' ? .6 : 1 } },
          '💾 บันทึกตัวละคร'),
        h('button', { onClick: onBack,
            style: { flex: '1 1 120px', padding: '13px', borderRadius: 12, border: '1.5px solid var(--c-border)', cursor: 'pointer',
              background: 'var(--c-surf)', color: 'var(--c-t1)', fontSize: 14, fontWeight: 700, fontFamily: TF } }, '← กลับ')),
      statusLine && h('div', { style: { marginTop: 10, fontSize: 13, fontWeight: 700, textAlign: 'center',
        color: status === 'error' ? '#DC2626' : status === 'saved' ? '#059669' : 'var(--c-t2)' } }, statusLine));
  }

  window.CharKit = {
    OPTIONS, defaults, sanitize, randomize, loadLocal, saveLocal,
    load, buildSprite, drawFrame, CharCanvas, Avatar, CreatorScreen,
    CROP: { FULL, HEAD },
  };
})();
