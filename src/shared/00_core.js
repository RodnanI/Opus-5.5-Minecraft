'use strict';
// ============================================================================
//  Core constants, hashing, RNG and noise (shared by main thread + workers)
// ============================================================================
const CS = 16, CH = 192, CS2 = 256, CVOL = CS * CS * CH, NSEC = CH >> 4, SEA = 62;
const PS = 32; // mesh position units per block
const IS_WORKER = typeof window === 'undefined';

function bIdx(x, y, z) { return (y << 8) | (z << 4) | x; }
function ckey(cx, cz) { return (cx + 32768) * 65536 + (cz + 32768); }

function fmix32(h) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16; return h >>> 0;
}
function hash2(seed, x, z) { return fmix32((seed ^ Math.imul(x | 0, 0x9E3779B1) ^ Math.imul((z | 0) + 0x632BE5AB, 0x85EBCA77)) | 0); }
function hash3(seed, x, y, z) { return fmix32((seed ^ Math.imul(x | 0, 0x9E3779B1) ^ Math.imul((y | 0) + 0x1B873593, 0xC2B2AE3D) ^ Math.imul((z | 0) + 0x632BE5AB, 0x27D4EB2F)) | 0); }
function hashF2(seed, x, z) { return hash2(seed, x, z) / 4294967296; }
function hashF3(seed, x, y, z) { return hash3(seed, x, y, z) / 4294967296; }
function strHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function seedFromString(s) {
  s = String(s || '').trim();
  if (s === '') return (Math.random() * 4294967296) >>> 0;
  if (/^-?\d+$/.test(s)) return (Number(s) | 0) >>> 0 || strHash(s);
  return strHash(s);
}

class RNG {
  constructor(seed) { this.s = seed >>> 0; }
  u32() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  next() { return this.u32() / 4294967296; }
  int(n) { return Math.floor(this.next() * n); }
  range(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  float(a, b) { return a + this.next() * (b - a); }
  chance(p) { return this.next() < p; }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, x) { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
function spline(pts, x) {
  if (x <= pts[0]) return pts[1];
  for (let i = 2; i < pts.length; i += 2) {
    if (x <= pts[i]) { const t = (x - pts[i - 2]) / (pts[i] - pts[i - 2]); const s = t * t * (3 - 2 * t); return pts[i - 1] + (pts[i + 1] - pts[i - 1]) * s; }
  }
  return pts[pts.length - 1];
}
function mixColor(a, b, t) {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
}

// ---------------------------------------------------------------- Simplex noise
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6;
const GR3 = new Int8Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
class Noise {
  constructor(seed) {
    const r = new RNG(seed), p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = r.int(i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.perm = new Uint8Array(512); this.p12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { this.perm[i] = p[i & 255]; this.p12[i] = (this.perm[i] % 12) * 3; }
  }
  n2(xin, yin) {
    const perm = this.perm, p12 = this.p12;
    const s = (xin + yin) * F2, i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2, x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt;
    tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) { const g = p12[ii + perm[jj]]; tt *= tt; n += tt * tt * (GR3[g] * x0 + GR3[g + 1] * y0); }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) { const g = p12[ii + i1 + perm[jj + j1]]; tt *= tt; n += tt * tt * (GR3[g] * x1 + GR3[g + 1] * y1); }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) { const g = p12[ii + 1 + perm[jj + 1]]; tt *= tt; n += tt * tt * (GR3[g] * x2 + GR3[g + 1] * y2); }
    return 70 * n;
  }
  n3(xin, yin, zin) {
    const perm = this.perm, p12 = this.p12;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (tt > 0) { const g = p12[ii + perm[jj + perm[kk]]]; tt *= tt; n += tt * tt * (GR3[g] * x0 + GR3[g + 1] * y0 + GR3[g + 2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (tt > 0) { const g = p12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]; tt *= tt; n += tt * tt * (GR3[g] * x1 + GR3[g + 1] * y1 + GR3[g + 2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (tt > 0) { const g = p12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]; tt *= tt; n += tt * tt * (GR3[g] * x2 + GR3[g + 1] * y2 + GR3[g + 2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (tt > 0) { const g = p12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]; tt *= tt; n += tt * tt * (GR3[g] * x3 + GR3[g + 1] * y3 + GR3[g + 2] * z3); }
    return 32 * n;
  }
}
function fbm2(n, x, z, oct, gain) {
  let a = 1, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n.n2(x * f + i * 31.7, z * f - i * 17.3); norm += a; a *= gain; f *= 2; }
  return s / norm;
}
function fbm3(n, x, y, z, oct, gain) {
  let a = 1, f = 1, s = 0, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * n.n3(x * f + i * 31.7, y * f + i * 11.1, z * f - i * 17.3); norm += a; a *= gain; f *= 2; }
  return s / norm;
}

// 16 dye colors (used by wool, glass, carpet, terracotta tints)
const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const DYE_RGB = [0xF4F4F4, 0xF07A1A, 0xC04CBA, 0x40B4E0, 0xF8CC30, 0x78C020, 0xF095B2, 0x474F52, 0x9A9A94, 0x169C9C, 0x8432B8, 0x3C44AA, 0x835432, 0x5E7C16, 0xB02E26, 0x1D1D21];
const TERRA_RGB = [0xD8BAAA, 0xAF5C2A, 0xA0607A, 0x7A7896, 0xC89228, 0x6E8038, 0xB25656, 0x40302A, 0x96766C, 0x5E6464, 0x80505F, 0x503F62, 0x553826, 0x535A2D, 0x9A4232, 0x2A1A14];
