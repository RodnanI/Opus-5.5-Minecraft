// ============================================================================
//  Main-thread utilities, math and settings
// ============================================================================
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v !== undefined && v !== null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) el.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
  return el;
}
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const IS_MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) < 900;
const now = () => performance.now();
const TAU = Math.PI * 2, DEG = Math.PI / 180;
function titleCase(s) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function fmtTime(ms) { const d = new Date(ms); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function angleDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }

// ---------------------------------------------------------------- mat4 (column-major)
const M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  identity(m) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  perspective(m, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    m.fill(0); m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf; return m;
  },
  ortho(m, l, r, b, t, n, f) {
    m.fill(0); m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1; return m;
  },
  mul(o, a, b) {
    const r = M4._t || (M4._t = new Float32Array(16));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
    }
    o.set(r); return o;
  },
  // view rotation from yaw/pitch (camera looks along -z when yaw=pitch=0)
  view(m, yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // rows = camera right / up / back.  forward = (sin(yaw)cos(p), sin(p), -cos(yaw)cos(p))
    m.fill(0);
    m[0] = cy; m[1] = -sy * sp; m[2] = -sy * cp;
    m[4] = 0; m[5] = cp; m[6] = -sp;
    m[8] = sy; m[9] = cy * sp; m[10] = cy * cp;
    m[15] = 1;
    if (roll) { const r = M4.create(), cr = Math.cos(roll), sr = Math.sin(roll); r[0] = cr; r[1] = sr; r[4] = -sr; r[5] = cr; M4.mul(m, r, m); }
    return m;
  },
  lookDir(m, dx, dy, dz, ux, uy, uz) {
    // camera looking along d (normalized) with up u, at origin
    let fx = dx, fy = dy, fz = dz;
    let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;
    const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    const tx = sy * fz - sz * fy, ty = sz * fx - sx * fz, tz = sx * fy - sy * fx;
    m[0] = sx; m[4] = sy; m[8] = sz; m[12] = 0;
    m[1] = tx; m[5] = ty; m[9] = tz; m[13] = 0;
    m[2] = -fx; m[6] = -fy; m[10] = -fz; m[14] = 0;
    m[3] = 0; m[7] = 0; m[11] = 0; m[15] = 1; return m;
  },
  invert(o, a) {
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
    const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
    const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null; det = 1 / det;
    const r = [
      (a[5] * b11 - a[6] * b10 + a[7] * b09) * det, (a[2] * b10 - a[1] * b11 - a[3] * b09) * det, (a[13] * b05 - a[14] * b04 + a[15] * b03) * det, (a[10] * b04 - a[9] * b05 - a[11] * b03) * det,
      (a[6] * b08 - a[4] * b11 - a[7] * b07) * det, (a[0] * b11 - a[2] * b08 + a[3] * b07) * det, (a[14] * b02 - a[12] * b05 - a[15] * b01) * det, (a[8] * b05 - a[10] * b02 + a[11] * b01) * det,
      (a[4] * b10 - a[5] * b08 + a[7] * b06) * det, (a[1] * b08 - a[0] * b10 - a[3] * b06) * det, (a[12] * b04 - a[13] * b02 + a[15] * b00) * det, (a[9] * b02 - a[8] * b04 - a[11] * b00) * det,
      (a[5] * b07 - a[4] * b09 - a[6] * b06) * det, (a[0] * b09 - a[1] * b07 + a[2] * b06) * det, (a[13] * b01 - a[12] * b03 - a[14] * b00) * det, (a[8] * b03 - a[9] * b01 + a[10] * b00) * det];
    o.set(r); return o;
  },
  translate(m, x, y, z) { m[12] += m[0] * x + m[4] * y + m[8] * z; m[13] += m[1] * x + m[5] * y + m[9] * z; m[14] += m[2] * x + m[6] * y + m[10] * z; m[15] += m[3] * x + m[7] * y + m[11] * z; return m; },
  scale(m, x, y, z) { for (let i = 0; i < 4; i++) { m[i] *= x; m[4 + i] *= y; m[8 + i] *= z; } return m; },
  rotX(m, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 4; i++) { const y = m[4 + i], z = m[8 + i]; m[4 + i] = y * c + z * s; m[8 + i] = z * c - y * s; } return m; },
  rotY(m, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 4; i++) { const x = m[i], z = m[8 + i]; m[i] = x * c - z * s; m[8 + i] = x * s + z * c; } return m; },
  rotZ(m, a) { const c = Math.cos(a), s = Math.sin(a); for (let i = 0; i < 4; i++) { const x = m[i], y = m[4 + i]; m[i] = x * c + y * s; m[4 + i] = y * c - x * s; } return m; },
  copy(o, a) { o.set(a); return o; },
};
function transformPoint(m, x, y, z, out) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w; out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w; out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w; out[3] = w;
  return out;
}

// ---------------------------------------------------------------- settings
// Every preset renders at the display's native pixel density; Auto Quality lowers the internal
// resolution (with a sharpening upscale) and then individual effects only when the GPU can't keep up.
const PRESETS = {
  potato: { renderDist: 4, resScale: 0.7, maxDPR: 1, shadows: 0, fancyLeaves: false, waving: false, clouds: 1, water: 0, bloom: false, godrays: false, fxaa: false, particles: 0, entityDist: 32, smoothLight: true },
  low: { renderDist: 6, resScale: 0.85, maxDPR: 1.5, shadows: 0, fancyLeaves: false, waving: true, clouds: 1, water: 1, bloom: false, godrays: false, fxaa: false, particles: 1, entityDist: 40, smoothLight: true },
  medium: { renderDist: 8, resScale: 1, maxDPR: 2, shadows: 1, fancyLeaves: true, waving: true, clouds: 2, water: 2, bloom: true, godrays: false, fxaa: true, particles: 2, entityDist: 56, smoothLight: true },
  high: { renderDist: 12, resScale: 1, maxDPR: 2, shadows: 2, fancyLeaves: true, waving: true, clouds: 3, water: 2, bloom: true, godrays: true, fxaa: true, particles: 2, entityDist: 64, smoothLight: true },
  ultra: { renderDist: 16, resScale: 1, maxDPR: 2, shadows: 3, fancyLeaves: true, waving: true, clouds: 3, water: 3, bloom: true, godrays: true, fxaa: true, particles: 2, entityDist: 96, smoothLight: true },
};
const DEFAULT_SETTINGS = Object.assign({
  preset: IS_MOBILE ? 'medium' : 'high',
  fov: 70, brightness: 0.5, viewBob: true, sensitivity: 0.5, invertY: false, showFps: false,
  masterVol: 0.8, musicVol: 0.5, sfxVol: 0.8, ambientVol: 0.6,
  autoJump: IS_TOUCH, touchAim: IS_TOUCH ? 'touch' : 'crosshair', buttonSize: 1, buttonOpacity: 0.55, guiScale: 0,
  autoQuality: true, sharpen: 0.25, fpsCap: 0, fog: true, tonemap: true, vignette: true, cloudHeight: 150, hudHidden: false, gamma: 1,
}, PRESETS[IS_MOBILE ? 'medium' : 'high']);
const SETTINGS = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('vc5_settings') || '{}'); } catch (e) { }
  // settings saved by older builds: capped pixel density made everything blurry, and dynRes is now autoQuality
  if (s.maxDPR !== undefined && s.maxDPR < 2 && !s.v2) s.maxDPR = 2;
  if (s.dynRes !== undefined) { delete s.dynRes; }
  s.v2 = 1;
  return Object.assign({}, DEFAULT_SETTINGS, s);
})();
function saveSettings() { try { localStorage.setItem('vc5_settings', JSON.stringify(SETTINGS)); } catch (e) { } refreshEff(); }
function applyPreset(name) { if (PRESETS[name]) Object.assign(SETTINGS, PRESETS[name]); SETTINGS.preset = name; saveSettings(); }

// Effective render settings: SETTINGS with the adaptive-quality governor's caps applied.
// Rendering code reads EFF; the settings screen and saves only ever touch SETTINGS.
const EFF = {};
const PERF_CAPS = [
  {}, { godrays: false }, { godrays: false, clouds: 2 }, { godrays: false, clouds: 2, water: 2, shadows: 2 },
  { godrays: false, clouds: 2, water: 2, shadows: 2, bloom: false }, { godrays: false, clouds: 2, water: 2, shadows: 1, bloom: false },
  { godrays: false, clouds: 2, water: 1, shadows: 1, bloom: false }, { godrays: false, clouds: 1, water: 1, shadows: 0, bloom: false },
  { godrays: false, clouds: 1, water: 1, shadows: 0, bloom: false, particles: 1, rdMul: 0.75 },
];
let PERF_LEVEL = 0;
function refreshEff() {
  Object.assign(EFF, SETTINGS);
  const c = PERF_CAPS[PERF_LEVEL] || {};
  for (const k of ['shadows', 'water', 'clouds', 'particles']) if (c[k] !== undefined) EFF[k] = Math.min(EFF[k], c[k]);
  for (const k of ['godrays', 'bloom']) if (c[k] === false) EFF[k] = false;
  if (c.rdMul) EFF.renderDist = Math.max(4, Math.round(SETTINGS.renderDist * c.rdMul));
  return EFF;
}
refreshEff();
