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
  const VER = '4';               // bump after replacing any asset file (cache-busting)
  const TF = "'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";

  // ── Choices ─────────────────────────────────────────────────
  // ramp = [darkest, lightest] target colours; null = keep the original art colours.
  // sheet = which body sheet in char.json (defaults to id); shirt = swatch colour for the picker.
  // socks/shoes = this outfit's default colours. Polo sheets come ready-coloured (no in-app shirt recolour).
  const BODIES = [
    { id: 'boy',         name: 'ชุดนักเรียนชาย',  socks: 'black', shoes: 'black' },
    { id: 'girl',        name: 'ชุดนักเรียนหญิง', socks: 'white', shoes: 'white' },
    { id: 'polo_red',    name: 'โปโลแดง',      sheet: 'polo_red', shirt: 'red',    socks: 'white', shoes: 'white' },
    { id: 'polo_blue',   name: 'โปโลน้ำเงิน',   sheet: 'polo_blue', shirt: 'blue',   socks: 'white', shoes: 'white' },
    { id: 'polo_green',  name: 'โปโลเขียว',     sheet: 'polo_green', shirt: 'green',  socks: 'white', shoes: 'white' },
    { id: 'polo_yellow', name: 'โปโลเหลือง',    sheet: 'polo_yellow', shirt: 'yellow', socks: 'white', shoes: 'white' },
  ];
  const UNIFORMS = BODIES.slice(0, 2);   // name-based default characters stay in school uniform
  // Polo colours for the picker swatch only: [shadow, main] = the sheets' own shirt tones.
  const SHIRT_COLORS = [
    { id: 'red',    ramp: [[132, 20, 32], [230, 52, 54]] },
    { id: 'blue',   ramp: [[28, 80, 158], [66, 160, 240]] },
    { id: 'green',  ramp: [[16, 100, 68], [46, 184, 120]] },
    { id: 'yellow', ramp: [[178, 130, 8], [255, 222, 40]] },
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
    const b = byId(BODIES, body) || BODIES[0];
    return { body: b.id, hair: b.id === 'girl' ? 'f02_ponytail' : 'm01_neat', hairColor: 'black',
      skin: 'natural', socks: b.socks, shoes: b.shoes };
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
    return sanitize({ body: pick(UNIFORMS), hair: pick(HAIRSTYLES), hairColor: pick(HAIR_COLORS),
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
      const outfit = byId(BODIES, cfg.body);
      const sheet = recolorCanvas(D.imgs['body_' + (outfit.sheet || outfit.id)], bodyMap);
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
  // hitAt: Date.now() of the last life lost → short red flash (royale)
  // info: small text in the top-right corner (e.g. "43 / 199 ตัว")
  const PAD_L = 30, PAD_R = 46, TRACK_H = 100, IDLE_AFTER = 1500, BEHIND = 7;
  function RaceTrack(props) {
    const { mode = '1v1', runners = [], style } = props;
    const isDuel = mode !== 'royale';
    const height = props.height || TRACK_H;    // shorter lane on short screens (App passes 84)
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
      const font = (w, px) => w + ' ' + px + "px 'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
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

      function drawRunner(r, st, fy, alpha, dx = 0) {
        const s0 = spritesRef.current.get(r.id); if (!s0) return;
        const s = r.out ? grayOf(s0) : s0;
        const x = Math.round(xOf(st.x) + dx);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(15,23,42,.16)';
        ctx.beginPath(); ctx.ellipse(x, fy - 1, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
        drawFrame(ctx, s, st.anim, r.out ? 0 : st.frame, x - FULL.w / 2, fy - FULL.h, 1, FULL);
        ctx.restore();
      }

      // Name tag: small pill just above the head (never over the sprite).
      // anchor: 'center' (x = middle), 'right' (x = right edge), 'left' (x = left edge)
      function tagWidth(text) { ctx.font = font(800, 10); return Math.ceil(ctx.measureText(text).width) + 10; }
      function drawTag(text, color, x, y, anchor = 'center') {
        ctx.font = font(800, 10);
        const w = tagWidth(text);
        const want = anchor === 'right' ? x - w : anchor === 'left' ? x : x - w / 2;
        const left = Math.max(2, Math.min(width - PAD_R - w, want));
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
        if (o.scene) ctx.clearRect(0, 0, width, height);     // pixel scene is the wrapper's CSS background
        else {
          ctx.fillStyle = '#F4F8FC'; ctx.fillRect(0, 0, width, height);
          ctx.fillStyle = '#DDE7F0'; ctx.fillRect(0, feetY - 3, width, 9);
        }
        ctx.fillStyle = o.scene ? '#3B2416' : '#94A3B8'; ctx.fillRect(PAD_L - 2, feetY - 12, 2, 18);
        drawFlag();
        // Storm wall (Battle Royale): everything left of the safe-zone edge
        const zonePct = Number(o.zonePct) || 0;
        if (!isDuel && zonePct > 0) {
          const zx = xOf(zonePct);
          const g = ctx.createLinearGradient(0, 0, zx, 0);
          g.addColorStop(0, 'rgba(76,29,149,.62)');
          g.addColorStop(1, 'rgba(124,58,237,.30)');
          ctx.fillStyle = g; ctx.fillRect(0, 0, zx, height);
          // Storm rain: slanted streaks drifting right, drawn from time only (no state)
          ctx.save();
          ctx.beginPath(); ctx.rect(0, 0, zx, height); ctx.clip();
          ctx.strokeStyle = 'rgba(237,233,254,.45)'; ctx.lineWidth = 1.2;
          const n = Math.max(4, Math.round(zx / 9));
          ctx.beginPath();
          for (let i = 0; i < n; i++) {
            const sp = 0.09 + (i % 3) * 0.035;
            const px = ((i * 47.3 + now * sp * 0.6) % (zx + 20)) - 10;
            const py = ((i * 31.7 + now * sp) % (height + 20)) - 10;
            ctx.moveTo(px, py); ctx.lineTo(px + 4, py + 9);
          }
          ctx.stroke();
          ctx.restore();
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
          const danger = !isDuel && zonePct > 0 && !me.out && !me.finished && st.x < zonePct;
          const dx = danger ? Math.round(Math.sin(now / 35) * 1.5) : 0;
          if (danger) {                       // red pulse under the feet
            const a = .22 + .18 * Math.sin(now / 120);
            ctx.fillStyle = 'rgba(239,68,68,' + a.toFixed(3) + ')';
            ctx.beginPath(); ctx.ellipse(xOf(st.x), feetY - 1, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
          }
          drawRunner(me, st, feetY, 1, dx);
          if (danger && Math.floor(now / 260) % 2 === 0) {   // flickering bolt beside the head
            ctx.font = font(400, 13); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
            ctx.fillText('⚡', xOf(st.x) + FULL.w / 2 - 4, feetY - FULL.h + 16);
          }
          tags.push([(me.label || 'คุณ') + (danger ? ' ⚠️' : ' ▼'),
            me.out ? '#64748B' : danger ? '#DC2626' : (me.color || '#1D4ED8'), xOf(st.x), feetY - FULL.h - 4]);
        }
        // Tags last so they sit on top. If two tags would overlap, place them side by
        // side meeting at the midpoint between the runners (back one left, front one right).
        const near = tags.length === 2 &&
          Math.abs(tags[0][2] - tags[1][2]) < (tagWidth(tags[0][0]) + tagWidth(tags[1][0])) / 2 + 4;
        if (near) {
          const [a, b] = tags[0][2] <= tags[1][2] ? [tags[0], tags[1]] : [tags[1], tags[0]];
          const mid = (a[2] + b[2]) / 2;
          drawTag(a[0], a[1], mid - 2, a[3], 'right');
          drawTag(b[0], b[1], mid + 2, b[3], 'left');
        } else tags.forEach(t => drawTag(t[0], t[1], t[2], t[3]));
        // Life lost: quick red flash over the whole lane
        const hitAge = o.hitAt ? Date.now() - o.hitAt : 1e9;
        if (hitAge < 450) {
          ctx.fillStyle = 'rgba(220,38,38,' + (0.32 * (1 - hitAge / 450)).toFixed(3) + ')';
          ctx.fillRect(0, 0, width, height);
        }
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

    return h('div', { ref: wrapRef, className: props.scene ? 'px-lane' : undefined, style: Object.assign({ width: '100%', overflow: 'hidden' }, style) },
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
    const height = (props.compact ? 52 : 76) + FULL.h * STAGE_SCALE + 40;   // compact: less sky above (short screens)
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
      const font = (w, px) => w + ' ' + px + "px 'Noto Sans Thai Looped','Sarabun','Noto Sans Thai',sans-serif";
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
  // Online-game style: the character stands in the middle, each category is a row with ◀ ▶
  // that steps through its choices one at a time. Keyboard: ↑ ↓ pick a row, ← → change it.
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
  // Rows: left column first, then right (also the ↑ ↓ order).
  const PICKERS = [
    { key: 'body',      title: 'ชุด',     list: BODIES },
    { key: 'hair',      title: 'ทรงผม',   list: HAIRSTYLES },
    { key: 'hairColor', title: 'สีผม',    list: HAIR_COLORS },
    { key: 'skin',      title: 'สีผิว',    list: SKIN_TONES },
    { key: 'socks',     title: 'ถุงเท้า',  list: SOCK_COLORS },
    { key: 'shoes',     title: 'รองเท้า', list: SHOE_COLORS },
  ];
  const SHORT_Q = '(max-height: 820px)';     // same breakpoint as pixel.css
  function useShort() {
    const [s, setS] = useState(() => window.matchMedia(SHORT_Q).matches);
    useEffect(() => {
      const m = window.matchMedia(SHORT_Q), on = () => setS(m.matches);
      m.addEventListener ? m.addEventListener('change', on) : m.addListener(on);
      return () => { m.removeEventListener ? m.removeEventListener('change', on) : m.removeListener(on); };
    }, []);
    return s;
  }

  function PickerRow({ p, cfg, active, onStep, onFocus }) {
    const list = p.list, i = Math.max(0, list.findIndex(o => o.id === cfg[p.key])), o = list[i];
    let thumb;
    if (p.key === 'hair') thumb = h(CharCanvas, { config: cfg, crop: HEAD, scale: 1.5, still: true, style: { width: 51, height: 45 } });
    else if (p.key === 'body' && o.shirt) thumb = h('span', { style: { width: 34, height: 34, flex: 'none',
      background: rampSwatch(byId(SHIRT_COLORS, o.shirt)), border: '3px solid #3B2416' } });
    else if (p.key === 'body') thumb = h('span', { style: { fontSize: 30, lineHeight: 1 } }, o.id === 'boy' ? '👦' : '👧');
    else thumb = h('span', { style: { width: 34, height: 34, flex: 'none', background: rampSwatch(o, ORIGINAL[p.key]), border: '3px solid #3B2416' } });
    const arrow = (dir) => h('button', { className: 'sp sp-i_' + (dir < 0 ? 'left' : 'right') + ' px-icon-btn',
      onClick: () => { onFocus(); onStep(dir); }, 'aria-label': p.title + (dir < 0 ? ' ก่อนหน้า' : ' ถัดไป'), title: dir < 0 ? 'ก่อนหน้า' : 'ถัดไป' });
    return h('div', { onClick: onFocus, role: 'group', 'aria-label': p.title,
        style: { display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 8px 6px', cursor: 'default',
          background: active ? '#FFE9A8' : 'transparent', border: '3px solid ' + (active ? '#3B2416' : 'transparent') } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: TF } },
        h('span', { style: { fontSize: 14, fontWeight: 800, color: '#3B2416' } }, p.title),
        h('span', { style: { fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: '#8C6E4E' } }, (i + 1) + '/' + list.length)),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        arrow(-1),
        h('div', { 'aria-live': 'polite', style: { flex: 1, minWidth: 0, height: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px',
            background: '#FFF9E6', border: '3px solid #3B2416', fontFamily: TF } },
          thumb,
          h('span', { style: { fontSize: 16, fontWeight: 700, color: '#3B2416', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, o.name)),
        arrow(1)));
  }

  function CreatorScreen({ initial, signedIn, onSave, onBack }) {
    const [cfg, setCfg] = useState(() => sanitize(initial) || defaults('boy'));
    const [anim, setAnim] = useState('idle');
    const [status, setStatus] = useState('idle');      // idle | saving | saved | error
    const [errMsg, setErrMsg] = useState('');
    const [ready, setReady] = useState(!!_data);
    const [loadErr, setLoadErr] = useState('');
    const [row, setRow] = useState(0);                  // highlighted category (keyboard)
    const short = useShort();
    const isNew = !sanitize(initial);
    useEffect(() => { load().then(() => setReady(true)).catch(e => setLoadErr(e.message)); }, []);
    // Switching uniform also swaps socks/shoes to the new uniform's defaults, unless the student changed them.
    const setBody = b => { setStatus('idle'); setCfg(c => {
      const od = defaults(c.body), nd = defaults(b), n = { ...c, body: b };
      if (c.socks === od.socks) n.socks = nd.socks;
      if (c.shoes === od.shoes) n.shoes = nd.shoes;
      return n;
    }); };
    // One step through a category, wrapping around at both ends.
    const step = (k, dir) => {
      const list = OPTIONS[k];
      const i = Math.max(0, list.findIndex(o => o.id === cfg[k]));
      const v = list[(i + dir + list.length) % list.length].id;
      if (k === 'body') setBody(v);
      else { setCfg(c => ({ ...c, [k]: v })); setStatus('idle'); }
    };
    const stepRef = useRef(step); stepRef.current = step;
    useEffect(() => {
      const onKey = e => {
        const t = e.target && e.target.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === 'ArrowUp')   { e.preventDefault(); setRow(r => (r + PICKERS.length - 1) % PICKERS.length); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); setRow(r => (r + 1) % PICKERS.length); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          setRow(r => { stepRef.current(PICKERS[r].key, e.key === 'ArrowLeft' ? -1 : 1); return r; });
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);
    const save = async () => {
      setStatus('saving'); setErrMsg('');
      try { await onSave(sanitize(cfg)); setStatus('saved'); }
      catch (e) { setStatus('error'); setErrMsg(e && e.message ? e.message : 'บันทึกไม่สำเร็จ'); }
    };
    // Pixel look (styles in assets/ui/pixel.css): green .px-btn when chosen, parchment square otherwise.
    const pill = (on, label, onClick) => h('button', { onClick, className: on ? 'px-btn' : undefined, 'aria-pressed': on,
      style: on ? { flex: 1, minHeight: 44, padding: '0 6px', fontFamily: TF, fontSize: 14 }
        : { flex: 1, minHeight: 44, padding: '4px 10px', cursor: 'pointer', fontFamily: TF, fontSize: 14, fontWeight: 700,
          border: '3px solid #3B2416', background: '#EFE2BF', color: '#3B2416' } }, label);

    if (loadErr) return h('div', { style: { fontFamily: TF, textAlign: 'center', padding: 30 } },
      h('div', { style: { color: '#DC2626', fontWeight: 700, marginBottom: 12 } }, '⚠️ โหลดตัวละครไม่ได้ — ' + loadErr),
      h('button', { onClick: onBack, className: 'px-btn', style: { minHeight: 48, padding: '0 18px', fontFamily: TF, fontSize: 15 } }, '← กลับ'));
    if (!ready) return h('div', { style: { fontFamily: TF, textAlign: 'center', padding: 40, color: 'var(--c-t3)' } }, 'กำลังโหลดตัวละคร...');

    const column = (from) => h('div', { style: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: short ? 6 : 12, justifyContent: 'center' } },
      PICKERS.slice(from, from + 3).map((p, j) => h(PickerRow, { key: p.key, p, cfg, active: row === from + j,
        onFocus: () => setRow(from + j), onStep: dir => step(p.key, dir) })));

    const scale = short ? 4 : 5;
    const preview = h('div', { style: { flex: '0 0 auto', width: FULL.w * scale + 40, display: 'flex', flexDirection: 'column', gap: 8 } },
      h('div', { className: 'px-lane', style: { padding: '12px 0 6px', display: 'flex', justifyContent: 'center', border: '3px solid #3B2416' } },
        h(CharCanvas, { config: cfg, anim, scale })),
      h('div', { style: { display: 'flex', gap: 6 } },
        pill(anim === 'idle', '🧍 ยืน', () => setAnim('idle')),
        pill(anim === 'run', '🏃 วิ่ง', () => setAnim('run'))),
      h('button', { onClick: () => { setCfg(randomize(cfg.body)); setStatus('idle'); }, className: 'px-btn',
          style: { width: '100%', minHeight: 44, fontFamily: TF, fontSize: 15 } }, '🎲 สุ่มตัวละคร'));

    const statusLine = status === 'saving' ? '💾 กำลังบันทึก...'
      : status === 'saved' ? '✅ บันทึกแล้ว!'
      : status === 'error' ? '⚠️ ' + (errMsg || 'บันทึกไม่สำเร็จ') : '';

    return h('div', { className: 'px-fill', style: { fontFamily: TF, display: 'flex', flexDirection: 'column', gap: short ? 8 : 14 } },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', flex: 'none' } },
        h('div', { style: { fontSize: short ? 20 : 22, fontWeight: 800, color: 'var(--c-t1)' } }, isNew ? '🎨 สร้างตัวละครของคุณ' : '🎨 แก้ไขตัวละคร'),
        h('div', { style: { fontSize: 13, color: 'var(--c-t2)' } }, 'ตัวละครนี้จะไปอยู่บนลู่วิ่งตอนแข่ง · กด ◀ ▶ เพื่อเปลี่ยน (ใช้ปุ่มลูกศรบนคีย์บอร์ดก็ได้)'),
        !signedIn && h('div', { style: { fontSize: 12, color: '#B45309', fontWeight: 700 } },
          'ยังไม่ได้เข้าสู่ระบบ — ตัวละครจะบันทึกไว้ในเครื่องนี้เท่านั้น')),
      h('div', { style: { flex: '1 1 auto', minHeight: 0, display: 'flex', gap: short ? 14 : 24, alignItems: 'center', justifyContent: 'center' } },
        column(0), preview, column(3)),
      h('div', { style: { display: 'flex', gap: 10, alignItems: 'center', flex: 'none' } },
        h('button', { onClick: onBack, className: 'px-btn',
            style: { flex: '1 1 120px', minHeight: short ? 46 : 54, fontSize: 16, fontFamily: TF } }, '← กลับ'),
        h('div', { role: 'status', style: { flex: '1 1 160px', fontSize: 14, fontWeight: 700, textAlign: 'center',
          color: status === 'error' ? '#DC2626' : status === 'saved' ? '#059669' : 'var(--c-t2)' } }, statusLine),
        h('button', { onClick: save, disabled: status === 'saving', className: 'px-btn',
            style: { flex: '2 1 200px', minHeight: short ? 46 : 54, fontSize: 17, fontFamily: TF } }, '💾 บันทึกตัวละคร')));
  }

  window.CharKit = {
    OPTIONS, defaults, sanitize, randomize, loadLocal, saveLocal,
    load, buildSprite, drawFrame, CharCanvas, Avatar, CreatorScreen,
    fromName, fromPlayer, toWire, grayOf, RaceTrack, ResultStage,
    CROP: { FULL, HEAD },
  };
})();
