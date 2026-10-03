/* ═══════════════════════════════════════════════════════════════
   CharKit — pixel-art character renderer + character creator
   Plain JavaScript (no Babel) so it loads fast. Needs React UMD first.
   Assets: assets/char/char.json, *_base_sheet.png, hair/hair_*.png
   Phase 2: fromName / fromPlayer / toWire / grayOf / RaceTrack
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const h = React.createElement;
  const { useState, useEffect, useRef } = React;
  const BASE = 'assets/char/';
  const VER = '2';               // bump after replacing any asset file (cache-busting)
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

  // ── Phase 2: stable default character from a name ───────────
  // Same name → same character on every device, so players without a saved
  // character still look the same to everyone in the room.
  function hashStr(s) {
    let x = 2166136261;
    for (const ch of String(s || '')) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  function fromName(name) {
    let x = hashStr(name || 'player') || 1;
    const pick = list => {
      const v = list[x % list.length];
      x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
      x = (x ^ (x >>> 15)) >>> 0;
      return v.id;
    };
    return sanitize({ body: pick(BODIES), hair: pick(HAIRSTYLES), hairColor: pick(HAIR_COLORS),
      skin: pick(SKIN_TONES), socks: pick(SOCK_COLORS), shoes: pick(SHOE_COLORS) });
  }
  // A room player's look: their saved character, else the one from their name.
  function fromPlayer(p) { return sanitize(p && p.char) || fromName(p && p.name); }
  // Short JSON string for the Firebase `char` field (rules allow ≤ 200 chars).
  function toWire(cfg) { const c = sanitize(cfg); return c ? JSON.stringify(c) : ''; }

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

  // Grey copy of a finished sprite (eliminated players). Cached per sprite.
  const _gray = new WeakMap();
  function grayOf(sprite) {
    if (_gray.has(sprite)) return _gray.get(sprite);
    const src = sprite.sheet, cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const id = ctx.getImageData(0, 0, cv.width, cv.height), d = id.data;
    for (let p = 0; p < d.length; p += 4) {
      if (!d[p + 3]) continue;
      const g = Math.min(255, Math.round(lum([d[p], d[p + 1], d[p + 2]]) * 0.8 + 30));
      d[p] = d[p + 1] = d[p + 2] = g;
    }
    ctx.putImageData(id, 0, 0);
    const g = Object.assign({}, sprite, { sheet: cv });
    _gray.set(sprite, g);
    return g;
  }

  // Animation steps: `seq` (column order, e.g. ping-pong) and `durations` (ms per step)
  // are optional in char.json; without them every column plays once at frameMs.
  function stepCol(a, k) {
    const seq = a.seq && a.seq.length ? a.seq : null, n = seq ? seq.length : a.frames;
    const i = ((k % n) + n) % n;
    return seq ? seq[i] : i;
  }
  function stepMs(a, k) {
    const d = a.durations, n = a.seq && a.seq.length ? a.seq.length : a.frames;
    return (d && d.length ? d[((k % n) + n) % n % d.length] : a.frameMs) || 200;
  }

  // Draws one animation step. crop = part of the 64×64 frame to show.
  function drawFrame(ctx, sprite, anim, frame, dx, dy, scale, crop) {
    const a = sprite.anims[anim] || sprite.anims.idle, S = sprite.size;
    const c = crop || { x: 0, y: 0, w: S, h: S };
    const f = stepCol(a, frame);
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
          let step;
          while (acc >= (step = stepMs(a, frame))) { acc -= step; frame++; }
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

  // ── Phase 2: race track (1v1 / Battle Royale) ───────────────
  // One canvas, drawn with requestAnimationFrame. New props are read from a ref
  // on the next frame, so the race never adds React re-renders.
  //
  // runners: [{ id, label, cfg, pct (0..1), kpm, me, finished, out, color }]
  //   Both modes use one shared lane: rivals stand a few pixels behind, me in front.
  //   mode '1v1'    → rival drawn solid, both get a name tag
  //   mode 'royale' → rivals faint, storm wall from the left (zonePct)
  //   r.alpha overrides the opacity, r.tag shows a name tag in royale mode,
  //   r.track = { timings, start, total } makes a ghost replay its own position
  // info: small text in the top-right corner (e.g. "43 / 199 ตัว")
  const PAD_L = 30, PAD_R = 46, TRACK_H = 100, IDLE_AFTER = 1500, BEHIND = 7;
  function RaceTrack(props) {
    const { mode = '1v1', runners = [], style } = props;
    const isDuel = mode !== 'royale';
    const height = TRACK_H;
    const wrapRef = useRef(null), cvRef = useRef(null);
    const optRef = useRef(props); optRef.current = props;
    const spritesRef = useRef(new Map());    // runner id → finished sprite
    const stateRef = useRef(new Map());      // runner id → position / animation state
    const [width, setWidth] = useState(0);
    const keys = runners.map(r => r.id + '=' + keyOf(sanitize(r.cfg) || defaults('boy'))).join(',');

    // Build sprites only when someone's look changes.
    useEffect(() => {
      let alive = true;
      optRef.current.runners.forEach(r => {
        buildSprite(r.cfg).then(s => { if (alive) spritesRef.current.set(r.id, s); }).catch(() => {});
      });
      return () => { alive = false; };
    }, [keys]);

    // Follow the container width.
    useEffect(() => {
      const el = wrapRef.current; if (!el) return;
      const upd = () => setWidth(Math.max(220, Math.floor(el.clientWidth)));
      upd();
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', upd);
        return () => window.removeEventListener('resize', upd);
      }
      const ro = new ResizeObserver(upd); ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      if (!width) return;
      const cv = cvRef.current, dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr);
      const ctx = cv.getContext('2d');
      const xOf = pct => PAD_L + Math.max(0, Math.min(1, pct)) * (width - PAD_L - PAD_R);
      const font = (w, px) => w + ' ' + px + "px 'Sarabun','Noto Sans Thai',sans-serif";
      const feetY = height - 9;

      // Ghost runner: position replayed from recorded keystroke gaps, computed here
      // every frame so the page itself never re-renders for it.
      function ghostPct(g) {
        if (!g.start || !g.total) return 0;
        const elapsed = Date.now() - g.start;
        let cum = 0, n = 0;
        for (const t of g.timings) { cum += t; if (cum <= elapsed) n++; else break; }
        return Math.min(1, n / g.total);
      }

      function step(r, now, dt) {
        let st = stateRef.current.get(r.id);
        const target = Math.max(0, Math.min(1, r.track ? ghostPct(r.track) : (Number(r.pct) || 0)));
        if (!st) { st = { x: target, tgt: target, moveAt: 0, frame: 0, acc: 0, anim: 'idle' }; stateRef.current.set(r.id, st); }
        if (target > st.tgt + 1e-6) st.moveAt = now;
        st.tgt = target;
        // Others arrive in ~350 ms Firebase steps, so they glide more slowly.
        st.x += (target - st.x) * (1 - Math.exp(-dt / (r.me ? 70 : 240)));
        const moving = !r.out && !r.finished && now - st.moveAt < IDLE_AFTER;
        const anim = moving ? 'run' : 'idle';
        if (anim !== st.anim) { st.anim = anim; st.frame = 0; st.acc = 0; }
        if (!r.out) {
          const sp = spritesRef.current.get(r.id);
          const an = sp && sp.anims[anim];
          const speed = moving ? Math.max(0.6, Math.min(2.2, (Number(r.kpm) || 0) / 120)) : 1;
          st.acc += dt * speed;
          let fm;
          while (st.acc >= (fm = an ? stepMs(an, st.frame) : 200)) { st.acc -= fm; st.frame++; }
        }
        return st;
      }

      function drawRunner(r, st, fy, alpha) {
        const s0 = spritesRef.current.get(r.id); if (!s0) return;
        const s = r.out ? grayOf(s0) : s0;
        const x = Math.round(xOf(st.x));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(15,23,42,.16)';
        ctx.beginPath(); ctx.ellipse(x, fy - 1, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
        drawFrame(ctx, s, st.anim, r.out ? 0 : st.frame, x - FULL.w / 2, fy - FULL.h, 1, FULL);
        ctx.restore();
      }

      // Name tag: small pill just above the head (never over the sprite).
      function drawTag(text, color, x, y) {
        ctx.font = font(800, 10);
        const w = Math.ceil(ctx.measureText(text).width) + 10;
        const left = Math.max(2, Math.min(width - PAD_R - w, x - w / 2));
        ctx.fillStyle = 'rgba(255,255,255,.88)';
        ctx.fillRect(left, y - 11, w, 14);
        ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, left + 5, y);
      }

      function drawFlag() {
        const fx = Math.round(xOf(1)) + 18, sq = 4, top = 22, bottom = feetY + 6;
        for (let y = top, row = 0; y < bottom; y += sq, row++) {
          for (let c = 0; c < 2; c++) {
            ctx.fillStyle = (row + c) % 2 ? '#0F172A' : '#FFFFFF';
            ctx.fillRect(fx + c * sq, y, sq, Math.min(sq, bottom - y));
          }
        }
        ctx.font = font(400, 14); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText('🏁', fx + sq, top - 3);
      }

      function paint(now, dt, o) {
        const rs = o.runners || [];
        ctx.fillStyle = '#F4F8FC'; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#DDE7F0'; ctx.fillRect(0, feetY - 3, width, 9);
        ctx.fillStyle = '#94A3B8'; ctx.fillRect(PAD_L - 2, feetY - 12, 2, 18);
        drawFlag();
        // Storm wall (Battle Royale): everything left of the safe-zone edge
        const zonePct = Number(o.zonePct) || 0;
        if (!isDuel && zonePct > 0) {
          const zx = xOf(zonePct);
          const g = ctx.createLinearGradient(0, 0, zx, 0);
          g.addColorStop(0, 'rgba(76,29,149,.62)');
          g.addColorStop(1, 'rgba(124,58,237,.30)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, zx, height);
          ctx.strokeStyle = '#7C3AED'; ctx.lineWidth = 2.5; ctx.beginPath();
          for (let y = 0; y <= height; y += 4) {
            const wx = zx + Math.sin(y / 7 + now / 140) * 3;
            y ? ctx.lineTo(wx, y) : ctx.moveTo(wx, y);
          }
          ctx.stroke();
          if (Math.floor(now / 900) % 3 === 0) {
            ctx.font = font(400, 14); ctx.textAlign = 'center';
            ctx.fillText('⚡', Math.max(10, zx - 14), 22 + (Math.floor(now / 900) % 2) * 30);
          }
        }
        if (o.info) {
          ctx.font = font(700, 10); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = '#64748B';
          ctx.fillText(o.info, width - PAD_R - 6, 13);
        }
        const me = rs.find(r => r.me), others = rs.filter(r => !r.me);
        const tags = [];
        others.forEach(r => {
          const st = step(r, now, dt);
          const alpha = r.alpha != null ? r.alpha : isDuel ? (r.out ? .5 : 1) : (r.out ? .35 : .45);
          drawRunner(r, st, feetY - BEHIND, alpha);
          if (isDuel || r.tag) tags.push([r.label || '', r.color || '#E79035', xOf(st.x), feetY - BEHIND - FULL.h - 4]);
        });
        if (me) {
          const st = step(me, now, dt);
          drawRunner(me, st, feetY, 1);
          tags.push([(me.label || 'คุณ') + ' ▼', me.out ? '#64748B' : (me.color || '#1D4ED8'), xOf(st.x), feetY - FULL.h - 4]);
        }
        // Tags last so they sit on top; if two tags overlap, lift the rival's.
        tags.forEach((t, i) => {
          const near = tags.length === 2 && Math.abs(tags[0][2] - tags[1][2]) < 70;
          drawTag(t[0], t[1], near ? t[2] + (i === 0 ? -40 : 40) : t[2], t[3]);
        });
      }

      let raf = 0, last = performance.now();
      const tick = now => {
        const dt = Math.min(100, now - last); last = now;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        paint(now, dt, optRef.current);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [width, height, isDuel]);

    return h('div', { ref: wrapRef, style: Object.assign({ width: '100%', overflow: 'hidden' }, style) },
      h('canvas', { ref: cvRef, style: { width: (width || 0) + 'px', height: height + 'px', display: 'block', imageRendering: 'pixelated' } }));
  }

  // ── Phase 3: result stage (win / lose / draw) ───────────────
  // actors: [{ id, cfg, label, pose: 'cheer'|'sad'|'idle', level: 0..2 (podium height),
  //            me, note, color }]
  // confetti: true → pixel confetti burst (restarts when it turns true again)
  // Falls back to 'idle' when char.json has no cheer/sad rows.
  const STAGE_SCALE = 2, BLOCK_W = 104, BLOCK_H = [14, 26, 40], STAGE_GAP = 22;
  const CONFETTI_COLORS = ['#F59E0B', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#FDE047'];
  function ResultStage(props) {
    const { actors = [], style } = props;
    const height = 76 + FULL.h * STAGE_SCALE + 40;
    const wrapRef = useRef(null), cvRef = useRef(null);
    const optRef = useRef(props); optRef.current = props;
    const spritesRef = useRef(new Map()), stateRef = useRef(new Map());
    const confRef = useRef({ on: false, start: 0, bits: [] });
    const [width, setWidth] = useState(0);
    const keys = actors.map(a => a.id + '=' + keyOf(sanitize(a.cfg) || defaults('boy'))).join(',');

    useEffect(() => {
      let alive = true;
      optRef.current.actors.forEach(a => {
        buildSprite(a.cfg).then(s => { if (alive) spritesRef.current.set(a.id, s); }).catch(() => {});
      });
      return () => { alive = false; };
    }, [keys]);

    useEffect(() => {
      const el = wrapRef.current; if (!el) return;
      const upd = () => setWidth(Math.max(240, Math.floor(el.clientWidth)));
      upd();
      if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', upd);
        return () => window.removeEventListener('resize', upd);
      }
      const ro = new ResizeObserver(upd); ro.observe(el);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      if (!width) return;
      const cv = cvRef.current, dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(width * dpr); cv.height = Math.round(height * dpr);
      const ctx = cv.getContext('2d');
      const font = (w, px) => w + ' ' + px + "px 'Sarabun','Noto Sans Thai',sans-serif";
      const groundY = height - 6;

      function spawnConfetti(now) {
        const bits = [];
        for (let i = 0; i < 90; i++) bits.push({
          x: Math.random() * width, y: -10 - Math.random() * height * 0.8,
          vy: 40 + Math.random() * 70, sway: 10 + Math.random() * 18, ph: Math.random() * 6.3,
          s: 3 + Math.floor(Math.random() * 2), c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        });
        confRef.current = { on: true, start: now, bits };
      }

      function paint(now, dt) {
        const o = optRef.current, list = o.actors || [];
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = false;
        // confetti behind the characters
        if (o.confetti && !confRef.current.on) spawnConfetti(now);
        if (!o.confetti) confRef.current.on = false;
        const cf = confRef.current;
        if (cf.on) {
          const t = (now - cf.start) / 1000, fade = Math.max(0, Math.min(1, (4.5 - t) / 1.2));
          if (fade > 0) {
            ctx.save(); ctx.globalAlpha = fade;
            cf.bits.forEach(b => {
              b.y += b.vy * dt / 1000;
              const x = b.x + Math.sin(t * 3 + b.ph) * b.sway;
              ctx.fillStyle = b.c; ctx.fillRect(Math.round(x), Math.round(b.y), b.s, b.s);
            });
            ctx.restore();
          }
        }
        const n = list.length, span = n * BLOCK_W + (n - 1) * STAGE_GAP;
        list.forEach((a, i) => {
          const cx = Math.round((width - span) / 2 + i * (BLOCK_W + STAGE_GAP) + BLOCK_W / 2);
          const bh = BLOCK_H[Math.max(0, Math.min(2, a.level | 0))];
          const top = groundY - bh;
          // podium block
          ctx.fillStyle = a.color || (a.level >= 2 ? '#F59E0B' : '#94A3B8');
          ctx.fillRect(cx - BLOCK_W / 2, top, BLOCK_W, bh);
          ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(cx - BLOCK_W / 2, top, BLOCK_W, 3);
          if (bh >= 24) {
            ctx.font = font(800, 12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#FFFFFF'; ctx.fillText(a.label || '', cx, top + bh / 2 + 1, BLOCK_W - 8);
          }
          // character
          const s = spritesRef.current.get(a.id);
          let st = stateRef.current.get(a.id);
          if (!st) { st = { pose: '', k: 0, acc: 0 }; stateRef.current.set(a.id, st); }
          if (s) {
            const pose = s.anims[a.pose] ? a.pose : 'idle';
            if (pose !== st.pose) { st.pose = pose; st.k = 0; st.acc = 0; }
            const an = s.anims[pose];
            st.acc += dt;
            let ms; while (st.acc >= (ms = stepMs(an, st.k))) { st.acc -= ms; st.k++; }
            ctx.fillStyle = 'rgba(15,23,42,.18)';
            ctx.beginPath(); ctx.ellipse(cx, top, 26, 4, 0, 0, Math.PI * 2); ctx.fill();
            drawFrame(ctx, s, pose, st.k, cx - FULL.w * STAGE_SCALE / 2, top - FULL.h * STAGE_SCALE + 2, STAGE_SCALE, FULL);
          }
          if (bh < 24 && a.label) {          // short block: name above the head
            ctx.font = font(800, 12); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = a.me ? '#1D4ED8' : '#475569';
            ctx.fillText(a.label, cx, top - FULL.h * STAGE_SCALE - 2, BLOCK_W + 10);
          }
          if (a.note) {
            ctx.font = font(800, 13); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            const w = Math.min(BLOCK_W + 30, ctx.measureText(a.note).width + 16);
            const y = top - FULL.h * STAGE_SCALE - (bh < 24 ? 22 : 6);
            ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillRect(cx - w / 2, y - 15, w, 20);
            ctx.fillStyle = a.noteColor || '#B45309'; ctx.fillText(a.note, cx, y);
          }
        });
      }

      let raf = 0, last = performance.now();
      const tick = now => {
        const dt = Math.min(100, now - last); last = now;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paint(now, dt);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [width, height]);

    return h('div', { ref: wrapRef, style: Object.assign({ width: '100%' }, style) },
      h('canvas', { ref: cvRef, style: { width: (width || 0) + 'px', height: height + 'px', display: 'block', imageRendering: 'pixelated', margin: '0 auto' } }));
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
    fromName, fromPlayer, toWire, grayOf, RaceTrack, ResultStage,
    CROP: { FULL, HEAD },
  };
})();
