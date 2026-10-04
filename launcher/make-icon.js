// The launcher's icon: a grass block drawn procedurally (like every texture in the game) and packed into a
// multi-size .ico of PNG images. Used by build.js; deterministic, so rebuilding gives the same file.
const zlib = require('zlib');

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function png(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy ? rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4) : raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// 16x16 textures: grass top, and dirt with a ragged grass fringe for the sides
const hash = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
function texel(face, u, v) {
  const x = Math.min(15, Math.floor(u * 16)), y = Math.min(15, Math.floor(v * 16));
  const r = hash(x, y, face === 'top' ? 1 : 2);
  const grass = [96 + r * 40, 168 + r * 40, 60 + r * 25], dirt = [134 + r * 30, 94 + r * 22, 62 + r * 18];
  if (face === 'top') return grass;
  const fringe = 3 + Math.floor(hash(x, 0, 3) * 3);
  return y < fringe ? grass.map(c => c * 0.9) : dirt;
}
// one face of the isometric cube: P = o + u * a + v * b, so (u, v) comes from inverting the 2x2 map
function face(o, a, b, name, shade) {
  const det = a[0] * b[1] - a[1] * b[0];
  return (px, py) => {
    const dx = px - o[0], dy = py - o[1];
    const u = (dx * b[1] - dy * b[0]) / det, v = (a[0] * dy - a[1] * dx) / det;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return texel(name, u, v).map(c => Math.min(255, c * shade));
  };
}
function render(S) {
  const k = S / 256, P = (x, y) => [x * k, y * k];
  const T = P(128, 14), R = P(238, 70), Bm = P(128, 126), L = P(18, 70), RR = P(238, 186), BB = P(128, 242), LL = P(18, 186);
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const faces = [face(T, sub(R, T), sub(L, T), 'top', 1.0), face(L, sub(Bm, L), sub(LL, L), 'side', 0.82), face(Bm, sub(R, Bm), sub(BB, Bm), 'side', 0.64)];
  const out = Buffer.alloc(S * S * 4), N = 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
      const px = x + (sx + 0.5) / N, py = y + (sy + 0.5) / N;
      for (const f of faces) { const c = f(px, py); if (c) { r += c[0]; g += c[1]; b += c[2]; a++; break; } }
    }
    const o = (y * S + x) * 4;
    if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a / (N * N) * 255; }
  }
  return out;
}
function makeIco() {
  const sizes = [16, 24, 32, 48, 64, 128, 256], imgs = sizes.map(s => png(s, s, render(s)));
  const head = Buffer.alloc(6 + 16 * sizes.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
  let off = head.length;
  sizes.forEach((s, i) => {
    const e = 6 + i * 16;
    head[e] = s >= 256 ? 0 : s; head[e + 1] = s >= 256 ? 0 : s; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(imgs[i].length, e + 8); head.writeUInt32LE(off, e + 12); off += imgs[i].length;
  });
  return Buffer.concat([head, ...imgs]);
}
module.exports = { makeIco, png, render };
