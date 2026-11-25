// Light mode ("โหมดเบา") for slow computers — above all the school's SNC remote desktops, where one server draws
// every student's screen and sends it over the network: the less of the screen moves, the less it has to do.
// Light mode: the clouds stop drifting, the race lane / result stage draw at 20 frames a second,
// one runner (not three) on the sign-in screen, and the music has no hall reverb.
//
// Choice (saved on this device, sound panel): 'auto' (default) | 'on' | 'off'.
// The link can force it for one visit: ?lite=1 (on) / ?lite=0 (off) — for a desktop shortcut on the school computers,
// because school computers may forget saved settings at log off.
// Auto = on when the graphics card is the SNC server's (GeForce GT 710), or when the screen updates
// less than 45 times a second (the SNC remote screen: 32). Nothing here is sent anywhere.
const { useEffect, useState } = React;

const KEY = 'liteMode';
const MODES = ['auto', 'on', 'off'];
const urlForce = (() => {
  try { const v = new URLSearchParams(location.search).get('lite'); return v === '1' ? 'on' : v === '0' ? 'off' : null; }
  catch { return null; }
})();
let mode = (() => { try { const v = localStorage.getItem(KEY); return MODES.includes(v) ? v : 'auto'; } catch { return 'auto'; } })();
let detected = null;          // auto result: null (still measuring) | { slow, why }
let lite = false;
const subs = new Set();

function apply() {
  const m = urlForce || mode;
  lite = m === 'on' || (m === 'auto' && !!detected?.slow);
  document.documentElement.classList.toggle('lite', lite);
  if (window.CharKit?.setLite) CharKit.setLite(lite);
  const st = liteState();
  subs.forEach(f => f(st));
}

export const isLite = () => lite;
export function liteState() { return { lite, mode, forced: urlForce, detected }; }
export function setLiteMode(m) {
  if (!MODES.includes(m)) return;
  mode = m;
  try { localStorage.setItem(KEY, m); } catch {}
  apply();
}
export function useLite() {
  const [s, set] = useState(liteState);
  useEffect(() => { subs.add(set); set(liteState()); return () => { subs.delete(set); }; }, []);
  return s;
}

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
}

// Median time between frames over 2 s, starting 1 s after load (the page is busy loading before that).
// The median ignores a few slow frames; a hidden tab (no frames) measures again when it is shown.
function measure() {
  if (document.hidden) { document.addEventListener('visibilitychange', measure, { once: true }); return; }
  const gaps = []; let last = 0, end = 0;
  const f = t => {
    if (document.hidden) { document.addEventListener('visibilitychange', measure, { once: true }); return; }
    if (!end) end = t + 2000; else gaps.push(t - last);
    last = t;
    if (t < end) { requestAnimationFrame(f); return; }
    gaps.sort((a, b) => a - b);
    const fps = Math.round(1000 / (gaps[gaps.length >> 1] || 16.7));
    detected = { slow: fps < 45, why: fps + ' ภาพ/วิ' };
    apply();
  };
  requestAnimationFrame(f);
}

function start() {
  const gpu = gpuName();
  if (/GT 710/i.test(gpu)) detected = { slow: true, why: 'เครื่องรีโมตของโรงเรียน' };
  apply();
  if (!detected) setTimeout(measure, 1000);
}
start();
