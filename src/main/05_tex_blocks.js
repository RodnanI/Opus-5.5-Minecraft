// ============================================================================
//  Procedural 16x16 textures: painter toolkit + block textures
// ============================================================================
class Tx {
  constructor(n) { this.n = n || 16; this.d = new Uint8ClampedArray(this.n * this.n * 4); }
  i(x, y) { const n = this.n; x = ((x % n) + n) % n; y = ((y % n) + n) % n; return (y * n + x) * 4; }
  px(x, y, c, a) { const i = this.i(x, y), d = this.d; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = a === undefined ? 255 : a; }
  get(x, y) { const i = this.i(x, y), d = this.d; return (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; }
  a(x, y) { return this.d[this.i(x, y) + 3]; }
  setA(x, y, a) { this.d[this.i(x, y) + 3] = a; }
  fill(c, a) { for (let y = 0; y < this.n; y++) for (let x = 0; x < this.n; x++) this.px(x, y, c, a); return this; }
  clear() { this.d.fill(0); return this; }
  mulPx(x, y, f) { const i = this.i(x, y), d = this.d; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; }
  rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c, a); }
  line(x0, y0, x1, y1, c, a) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy;
    for (; ;) { this.px(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  pat(rows, map, ox, oy) {
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x], m = map[ch];
      if (m === undefined || m === null) continue;
      if (Array.isArray(m)) this.px(x + (ox || 0), y + (oy || 0), m[0], m[1]); else this.px(x + (ox || 0), y + (oy || 0), m);
    }
  }
}
function csh(c, f) { const r = Math.min(255, ((c >> 16) & 255) * f), g = Math.min(255, ((c >> 8) & 255) * f), b = Math.min(255, (c & 255) * f); return ((r | 0) << 16) | ((g | 0) << 8) | (b | 0); }
function cmix(a, b, t) { return mixColor(a, b, clamp(t, 0, 1)); }
function vnoise(r, cells, n) {
  n = n || 16;
  const g = new Float32Array(cells * cells); for (let i = 0; i < g.length; i++) g[i] = r.next();
  return (x, y) => {
    const fx = x / n * cells, fy = y / n * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx2 = fx - ix, ty = fy - iy;
    const G = (a, b) => g[(((b % cells) + cells) % cells) * cells + (((a % cells) + cells) % cells)];
    const sx = tx2 * tx2 * (3 - 2 * tx2), sy = ty * ty * (3 - 2 * ty);
    return lerp(lerp(G(ix, iy), G(ix + 1, iy), sx), lerp(G(ix, iy + 1), G(ix + 1, iy + 1), sx), sy);
  };
}
// base fill: color with smooth + pixel noise
function tBase(t, r, c, amt, cells, pix) {
  const vn = vnoise(r, cells || 4, t.n), p = pix === undefined ? 0.5 : pix;
  for (let y = 0; y < t.n; y++) for (let x = 0; x < t.n; x++) t.px(x, y, csh(c, 1 + ((vn(x, y) * (1 - p) + r.next() * p) - 0.5) * amt));
  return t;
}
function tSpeck(t, r, c, n, amt) { for (let i = 0; i < n; i++) t.px(r.int(t.n), r.int(t.n), csh(c, 1 + (r.next() - 0.5) * (amt || 0.2))); }
function tBlobs(t, r, c, count, size, amt) {
  for (let k = 0; k < count; k++) {
    let x = r.int(t.n), y = r.int(t.n); const s = size + r.int(size + 1);
    for (let i = 0; i < s; i++) { t.px(x, y, csh(c, 1 + (r.next() - 0.5) * (amt || 0.2))); const d = r.int(4); if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else y--; }
  }
}
function tBevel(t, lf, df) {
  for (let i = 0; i < t.n; i++) { t.mulPx(i, 0, lf); t.mulPx(0, i, lf); t.mulPx(i, t.n - 1, df); t.mulPx(t.n - 1, i, df); }
}
function tCells(t, r, cols, n, mortar, hl) {
  const pts = []; for (let i = 0; i < n; i++) pts.push([r.next() * 16, r.next() * 16, cols[r.int(cols.length)], 0.85 + r.next() * 0.3]);
  const own = new Int16Array(256);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let b1 = 1e9, b2 = 1e9, bi = 0;
    for (let i = 0; i < n; i++) {
      let dx = Math.abs(x + 0.5 - pts[i][0]), dy = Math.abs(y + 0.5 - pts[i][1]); dx = Math.min(dx, 16 - dx); dy = Math.min(dy, 16 - dy);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < b1) { b2 = b1; b1 = d; bi = i; } else if (d < b2) b2 = d;
    }
    own[y * 16 + x] = bi;
    const p = pts[bi];
    if (b2 - b1 < 1.0) t.px(x, y, csh(mortar, 0.9 + r.next() * 0.2));
    else t.px(x, y, csh(p[2], p[3] * (0.93 + r.next() * 0.14) * (1 - Math.min(0.25, b1 / 30))));
  }
  if (hl) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const o = own[y * 16 + x], up = own[((y + 15) & 15) * 16 + x], lf = own[y * 16 + ((x + 15) & 15)];
    if (o !== up || o !== lf) { if (t.get(x, y) !== mortar) t.mulPx(x, y, 1.18); }
    const dn = own[((y + 1) & 15) * 16 + x]; if (o !== dn) t.mulPx(x, y, 0.8);
  }
  return t;
}
function tBricks(t, r, brick, mortar, bh, bw, var_, bevel) {
  for (let y = 0; y < 16; y++) {
    const row = Math.floor(y / bh), off = (row & 1) ? (bw >> 1) : 0;
    for (let x = 0; x < 16; x++) {
      const bx = Math.floor((x + off) / bw);
      const isM = (y % bh) === bh - 1 || ((x + off) % bw) === bw - 1;
      if (isM) { t.px(x, y, csh(mortar, 0.9 + r.next() * 0.2)); continue; }
      const f = 0.88 + hashF2(row * 7 + 3, bx, row) * (var_ || 0.25);
      let c = csh(brick, f * (0.94 + r.next() * 0.12));
      if (bevel) { if ((y % bh) === 0 || ((x + off) % bw) === 0) c = csh(c, 1.12); if ((y % bh) === bh - 2) c = csh(c, 0.88); }
      t.px(x, y, c);
    }
  }
  return t;
}
function tPlanks(t, r, c) {
  for (let y = 0; y < 16; y++) {
    const board = y >> 2, seamX = (board * 7 + 3 + (board & 1) * 5) & 15;
    for (let x = 0; x < 16; x++) {
      let f = 0.92 + hashF2(board + 11, x >> 1, board) * 0.1 + (r.next() - 0.5) * 0.06;
      if ((y & 3) === 3) f *= 0.72;
      else if ((y & 3) === 0) f *= 1.06;
      if (x === seamX && (y & 3) !== 3) f *= 0.75;
      if (hashF2(board, x, y) < 0.08) f *= 0.88;
      t.px(x, y, csh(c, f));
    }
  }
  return t;
}
function tLogSide(t, r, c, dark, stripes) {
  for (let x = 0; x < 16; x++) {
    const col = 0.85 + hashF2(9, x, 1) * 0.25;
    for (let y = 0; y < 16; y++) {
      let f = col * (0.94 + r.next() * 0.12);
      if (hashF2(x * 3 + 1, y >> 2, 2) < 0.12) f *= 0.8;
      t.px(x, y, csh(c, f));
    }
    if (stripes && hashF2(3, x, 7) < 0.3) for (let y = 0; y < 16; y++) if (r.next() < 0.7) t.px(x, y, csh(dark, 0.9 + r.next() * 0.2));
  }
  return t;
}
function tLogTop(t, r, inner, ring, bark) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - 7.5, dy = y - 7.5, d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.7 + Math.sqrt(dx * dx + dy * dy) * 0.3;
    let c;
    if (x === 0 || y === 0 || x === 15 || y === 15) c = csh(bark, 0.85 + r.next() * 0.3);
    else c = (Math.floor(d * 0.9) & 1) ? csh(ring, 0.95 + r.next() * 0.1) : csh(inner, 0.95 + r.next() * 0.1);
    t.px(x, y, c);
  }
  return t;
}
function tLeaves(t, r, holes, style) {
  const vn = vnoise(r, 8);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = vn(x, y) * 0.6 + r.next() * 0.4;
    let g = 0.55 + v * 0.45;
    if (style === 1 && ((x + y) & 3) === 0) g *= 0.85;
    const hole = r.next() < holes * (1.2 - v);
    const c = csh(0xFFFFFF, g * 0.82);
    if (hole) t.px(x, y, csh(0xFFFFFF, 0.28), 0); else t.px(x, y, c, 255);
  }
  return t;
}
function tOre(t, r, baseName, col, hi, lo, n) {
  paintTex(baseName, t);
  for (let k = 0; k < (n || 5); k++) {
    let x = r.int(14) + 1, y = r.int(14) + 1; const s = 2 + r.int(4);
    for (let i = 0; i < s; i++) {
      const rr = r.next();
      t.px(x, y, rr < 0.2 ? hi : rr > 0.85 ? lo : col);
      const d = r.int(4); if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else y--;
    }
  }
  return t;
}
function tFringe(t, r, c, a, depth, drips) {
  for (let x = 0; x < 16; x++) {
    const dd = depth + (r.next() < drips ? 1 + r.int(2) : 0);
    for (let y = 0; y < dd; y++) t.px(x, y, csh(c, 0.85 + r.next() * 0.3), a);
  }
  return t;
}
function tSmooth(t, r, c, amt) { tBase(t, r, c, amt || 0.08, 2, 0.4); tBevel(t, 1.06, 0.88); return t; }
function tCross(t, r, draw) { t.clear(); draw(t, r); return t; }
function stem(t, x, y0, y1, c) { for (let y = y0; y <= y1; y++) t.px(x, y, csh(c, 0.9 + ((y * 7) % 5) * 0.04)); }
function tMetal(t, r, c, hi, lo) {
  tBase(t, r, c, 0.06, 2, 0.3);
  for (let i = 0; i < 16; i++) { t.px(i, 0, hi); t.px(0, i, hi); t.px(i, 15, lo); t.px(15, i, lo); }
  for (let i = 1; i < 15; i++) { t.px(i, 1, csh(c, 1.08)); t.px(1, i, csh(c, 1.08)); t.px(i, 14, csh(c, 0.9)); t.px(14, i, csh(c, 0.9)); }
  for (let k = 0; k < 4; k++) { const y = 3 + r.int(10); for (let x = 3; x < 13; x++) if (r.next() < 0.6) t.px(x, y, csh(c, 1.1)); }
  return t;
}
const DIGITS3x5 = { T: ['###', '.#.', '.#.', '.#.', '.#.'], N: ['#.#', '###', '###', '#.#', '#.#'] };

// textures whose alpha channel is a biome-tint mask rather than transparency (mipmapped per mask class)
const MASK_TEXTURES = ['grass_side'];
// -------------------------------------------------------------------- painters
const BLOCK_PAINT = Object.create(null);
function TP(names, fn) { for (const n of names.split(' ')) BLOCK_PAINT[n] = fn; }
function paintTex(name, t) {
  t = t || new Tx(16);
  const r = new RNG(strHash(name) ^ 0x7E57);
  const fn = BLOCK_PAINT[name];
  if (fn) fn(t, r, name); else { t.fill(0xFF00FF); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x >> 3) + (y >> 3)) & 1) t.px(x, y, 0x111111); }
  return t;
}
TP('stone', (t, r) => { tBase(t, r, 0x7E7E7E, 0.2, 4, 0.55); tBlobs(t, r, 0x6C6C6C, 5, 2, 0.1); tSpeck(t, r, 0x8E8E8E, 10, 0.1); });
TP('smooth_stone', (t, r) => { tBase(t, r, 0x9E9E9E, 0.06, 2, 0.3); for (let i = 0; i < 16; i++) { t.px(i, 0, 0xB0B0B0); t.px(i, 15, 0x7A7A7A); t.px(0, i, 0xA8A8A8); t.px(15, i, 0x7F7F7F); } });
TP('granite', (t, r) => { tBase(t, r, 0x986A58, 0.18, 4, 0.6); tBlobs(t, r, 0xB8897A, 6, 2); tSpeck(t, r, 0x6F4A3D, 14); tSpeck(t, r, 0xC99E90, 8); });
TP('polished_granite', (t, r) => { tBase(t, r, 0x9C6B58, 0.1, 3, 0.4); tSpeck(t, r, 0xB48572, 12, 0.1); tBevel(t, 1.12, 0.8); });
TP('diorite', (t, r) => { tBase(t, r, 0xBDBDBD, 0.12, 4, 0.6); tBlobs(t, r, 0xE2E2E2, 6, 2); tSpeck(t, r, 0x7A7A7A, 16); tBlobs(t, r, 0x8E8E8E, 3, 1); });
TP('polished_diorite', (t, r) => { tBase(t, r, 0xC8C8CA, 0.08, 3, 0.4); tSpeck(t, r, 0xA0A0A0, 10, 0.1); tBevel(t, 1.08, 0.8); });
TP('andesite', (t, r) => { tBase(t, r, 0x878787, 0.16, 4, 0.6); tSpeck(t, r, 0xA2A2A2, 16); tSpeck(t, r, 0x6A6A6A, 16); });
TP('polished_andesite', (t, r) => { tBase(t, r, 0x848786, 0.08, 3, 0.4); tSpeck(t, r, 0x9A9C9B, 10, 0.1); tBevel(t, 1.1, 0.8); });
TP('deepslate', (t, r) => { tBase(t, r, 0x4F4F57, 0.15, 4, 0.5); for (let y = 0; y < 16; y += 3 + r.int(2)) for (let x = 0; x < 16; x++) if (r.next() < 0.6) t.px(x, y, csh(0x3C3C43, 0.9 + r.next() * 0.2)); tSpeck(t, r, 0x616169, 10); });
TP('deepslate_top', (t, r) => { tBase(t, r, 0x4E4E56, 0.12, 4, 0.5); for (let k = 0; k < 16; k++) { t.px(k, 7, 0x3C3C43); t.px(7, k, 0x3C3C43); } tSpeck(t, r, 0x5F5F68, 12); });
TP('cobbled_deepslate', (t, r) => { tCells(t, r, [0x4B4B53, 0x55555E, 0x43434B], 11, 0x2A2A30, true); });
TP('cobblestone', (t, r) => { tCells(t, r, [0x7A7A7A, 0x8A8A8A, 0x6E6E6E, 0x959595], 11, 0x4E4E4E, true); });
TP('mossy_cobblestone', (t, r) => { paintTex('cobblestone', t); const vn = vnoise(r, 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (vn(x, y) + r.next() * 0.3 > 0.72) t.px(x, y, csh(0x5A7A2E, 0.8 + r.next() * 0.4)); });
TP('stone_bricks', (t, r) => { tBricks(t, r, 0x7C7C7C, 0x545454, 8, 16, 0.18, true); tSpeck(t, r, 0x8C8C8C, 12, 0.1); });
TP('mossy_stone_bricks', (t, r) => { paintTex('stone_bricks', t); const vn = vnoise(r, 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (vn(x, y) + r.next() * 0.25 > 0.7) t.px(x, y, csh(0x5B7A33, 0.8 + r.next() * 0.35)); });
TP('cracked_stone_bricks', (t, r) => { paintTex('stone_bricks', t); let x = 3 + r.int(4), y = 0; while (y < 16) { t.px(x, y, 0x3E3E3E); y++; x += r.int(3) - 1; } x = 10; y = 6; for (let i = 0; i < 8; i++) { t.px(x, y, 0x444444); x++; y += r.int(3) - 1; } });
TP('chiseled_stone_bricks', (t, r) => { tBase(t, r, 0x7C7C7C, 0.1, 3, 0.4); tBevel(t, 1.15, 0.7); for (let i = 3; i < 13; i++) { t.px(i, 3, 0x5A5A5A); t.px(i, 12, 0x5A5A5A); t.px(3, i, 0x5A5A5A); t.px(12, i, 0x5A5A5A); } for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) t.px(x, y, (x + y) & 1 ? 0x6A6A6A : 0x5A5A5A); });
TP('bricks', (t, r) => { tBricks(t, r, 0x96503E, 0xB5ACA3, 4, 8, 0.3, false); });
TP('bedrock', (t, r) => { const vn = vnoise(r, 5); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = vn(x, y) + (r.next() - 0.5) * 0.4; t.px(x, y, v < 0.35 ? 0x2E2E2E : v < 0.6 ? 0x575757 : 0x7B7B7B); } });
TP('obsidian', (t, r) => { tBase(t, r, 0x140F1E, 0.35, 4, 0.5); for (let k = 0; k < 6; k++) { let x = r.int(16), y = r.int(16); for (let i = 0; i < 4; i++) { t.px(x, y, i < 2 ? 0x3E2A5A : 0x2A1C40); x++; y += r.int(2); } } });
TP('crying_obsidian', (t, r) => { paintTex('obsidian', t); for (let k = 0; k < 5; k++) { const x = r.int(16); let y = r.int(10); for (let i = 0; i < 4; i++, y++) t.px(x, y, i === 0 ? 0xE08CFF : 0x8A2BE2); } });
TP('grass_top', (t, r) => { const vn = vnoise(r, 6); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, csh(0xFFFFFF, 0.46 + vn(x, y) * 0.16 + r.next() * 0.2)); });
TP('dirt', (t, r) => { tBase(t, r, 0x866043, 0.14, 4, 0.6); tSpeck(t, r, 0x6A4A31, 18, 0.1); tSpeck(t, r, 0x9D7556, 10, 0.1); tSpeck(t, r, 0x5A5A5A, 3, 0.1); });
TP('grass_side', (t, r) => { paintTex('dirt', t); for (let x = 0; x < 16; x++) { const d = 3 + (r.next() < 0.45 ? 1 + r.int(2) : 0); for (let y = 0; y < d; y++) t.px(x, y, csh(0xFFFFFF, 0.46 + r.next() * 0.26), 128); } });
TP('grass_side_snowed', (t, r) => { paintTex('dirt', t); tFringe(t, r, 0xF2FAFA, 255, 3, 0.5); });
TP('coarse_dirt', (t, r) => { paintTex('dirt', t); tSpeck(t, r, 0x5E4330, 22, 0.1); tSpeck(t, r, 0x8C8C8C, 6, 0.2); tSpeck(t, r, 0xA27C5B, 10, 0.1); });
TP('podzol_top', (t, r) => { tBase(t, r, 0x6A4A22, 0.2, 5, 0.6); tSpeck(t, r, 0x8E6428, 26, 0.2); tSpeck(t, r, 0x4A3316, 14, 0.1); });
TP('podzol_side', (t, r) => { paintTex('dirt', t); for (let x = 0; x < 16; x++) { const d = 3 + r.int(2); for (let y = 0; y < d; y++) t.px(x, y, csh(0x6A4A22, 0.8 + r.next() * 0.4)); } });
TP('mycelium_top', (t, r) => { tBase(t, r, 0x6F6369, 0.18, 5, 0.6); tSpeck(t, r, 0x8E8290, 24, 0.2); tSpeck(t, r, 0x574C55, 10); });
TP('mycelium_side', (t, r) => { paintTex('dirt', t); for (let x = 0; x < 16; x++) { const d = 3 + (r.next() < 0.5 ? r.int(3) : 0); for (let y = 0; y < d; y++) t.px(x, y, csh(0x736770, 0.85 + r.next() * 0.3)); } });
TP('dirt_path_top', (t, r) => { tBase(t, r, 0x947A48, 0.16, 5, 0.6); tSpeck(t, r, 0x7C6538, 20); tSpeck(t, r, 0xA88E5A, 12); });
TP('dirt_path_side', (t, r) => { paintTex('dirt', t); for (let x = 0; x < 16; x++) { t.px(x, 0, 0, 0); for (let y = 1; y < 3 + r.int(2); y++) t.px(x, y, csh(0x947A48, 0.85 + r.next() * 0.3)); } });
TP('farmland', (t, r) => { tBase(t, r, 0x593C22, 0.18, 4, 0.6); for (let y = 0; y < 16; y++) if ((y & 3) === 0) for (let x = 0; x < 16; x++) t.px(x, y, csh(0x3F2A17, 0.9 + r.next() * 0.2)); tBevel(t, 1.1, 0.8); });
TP('farmland_wet', (t, r) => { tBase(t, r, 0x3B2615, 0.18, 4, 0.6); for (let y = 0; y < 16; y++) if ((y & 3) === 0) for (let x = 0; x < 16; x++) t.px(x, y, csh(0x24170C, 0.9 + r.next() * 0.2)); tBevel(t, 1.1, 0.8); });
TP('sand', (t, r) => { tBase(t, r, 0xDACD9C, 0.08, 4, 0.7); tSpeck(t, r, 0xC6B683, 22, 0.08); tSpeck(t, r, 0xE9DFB6, 14, 0.05); });
TP('red_sand', (t, r) => { tBase(t, r, 0xBC6524, 0.1, 4, 0.7); tSpeck(t, r, 0xA1531B, 22, 0.1); tSpeck(t, r, 0xD17A38, 14, 0.08); });
TP('gravel', (t, r) => { tBase(t, r, 0x7B7775, 0.12, 4, 0.8); for (let k = 0; k < 16; k++) { const x = r.int(16), y = r.int(16), c = r.pick([0x9A9594, 0x6A6361, 0x8A7F77, 0xAAA6A3, 0x5C5552]); t.px(x, y, c); t.px(x + 1, y, csh(c, 0.9)); t.px(x, y + 1, csh(c, 0.85)); t.px(x + 1, y + 1, csh(c, 0.7)); } });
TP('clay', (t, r) => { tBase(t, r, 0xA0A6B3, 0.08, 4, 0.5); tSpeck(t, r, 0xB2B8C4, 12, 0.05); tSpeck(t, r, 0x8E94A1, 10, 0.05); });
TP('sandstone', (t, r) => { tBase(t, r, 0xD9CB99, 0.07, 4, 0.5); for (let x = 0; x < 16; x++) { t.px(x, 3, 0xC2B27E); t.px(x, 11, csh(0xC9BA87, 0.95 + r.next() * 0.1)); for (let y = 0; y < 3; y++) t.px(x, y, csh(0xE2D6A8, 0.96 + r.next() * 0.06)); for (let y = 12; y < 16; y++) t.px(x, y, csh(0xCDBE8A, 0.95 + r.next() * 0.08)); } });
TP('sandstone_top', (t, r) => { tBase(t, r, 0xDDD0A0, 0.05, 3, 0.4); });
TP('sandstone_bottom', (t, r) => { tBase(t, r, 0xD6C894, 0.1, 4, 0.6); tSpeck(t, r, 0xC0B07C, 12); });
TP('cut_sandstone', (t, r) => { tBase(t, r, 0xDACD9B, 0.05, 3, 0.4); for (let x = 0; x < 16; x++) { t.px(x, 0, 0xC4B584); t.px(x, 15, 0xC4B584); t.px(x, 7, 0xC9BA89); t.px(x, 8, 0xE6DBAE); } });
TP('chiseled_sandstone', (t, r) => { tBase(t, r, 0xDACD9B, 0.05, 3, 0.4); for (let i = 0; i < 16; i++) { t.px(i, 0, 0xC4B584); t.px(i, 15, 0xC4B584); t.px(i, 2, 0xC4B584); t.px(i, 13, 0xC4B584); } for (let d = 0; d < 4; d++) { t.px(7 - d, 4 + d, 0xB8A776); t.px(8 + d, 4 + d, 0xB8A776); t.px(7 - d, 11 - d, 0xB8A776); t.px(8 + d, 11 - d, 0xB8A776); } t.rect(7, 7, 2, 2, 0xB8A776); });
TP('red_sandstone', (t, r) => { tBase(t, r, 0xB9601F, 0.07, 4, 0.5); for (let x = 0; x < 16; x++) { t.px(x, 3, 0x9D4F18); t.px(x, 11, 0xA55418); for (let y = 0; y < 3; y++) t.px(x, y, csh(0xC56E2B, 0.95 + r.next() * 0.1)); } });
TP('red_sandstone_top', (t, r) => { tBase(t, r, 0xBB6322, 0.05, 3, 0.4); });
TP('red_sandstone_bottom', (t, r) => { tBase(t, r, 0xB45E20, 0.1, 4, 0.6); tSpeck(t, r, 0x9A4E18, 12); });
TP('water_still', (t, r) => { const vn = vnoise(r, 4), vn2 = vnoise(r, 8); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = vn(x, y) * 0.6 + vn2(x, y) * 0.4; t.px(x, y, csh(0xFFFFFF, 0.62 + v * 0.3 + (v > 0.62 ? 0.12 : 0)), 170); } });
TP('water_flow', (t, r) => { for (let x = 0; x < 16; x++) { const o = r.next(); for (let y = 0; y < 16; y++) { const v = 0.64 + Math.sin((y / 16 + o) * TAU) * 0.08 + r.next() * 0.1; t.px(x, y, csh(0xFFFFFF, v), 175); } } });
TP('lava_still', (t, r) => { const vn = vnoise(r, 4), vn2 = vnoise(r, 8); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = vn(x, y) * 0.65 + vn2(x, y) * 0.35; t.px(x, y, v > 0.68 ? 0xFFD24A : v > 0.5 ? 0xF58A1E : v > 0.34 ? 0xD4520E : 0xA2300A); } });
TP('lava_flow', (t, r) => { for (let x = 0; x < 16; x++) { const o = r.next(); for (let y = 0; y < 16; y++) { const v = 0.5 + Math.sin((y / 16 + o) * TAU + x) * 0.25 + r.next() * 0.15; t.px(x, y, v > 0.72 ? 0xFFC43A : v > 0.5 ? 0xF07A18 : v > 0.35 ? 0xCF4A0C : 0x9E2C08); } } });
const ORES = { coal: [0x2B2B2B, 0x4C4C4C, 0x161616], iron: [0xD6AD92, 0xEACBB5, 0xA88670], gold: [0xFCE14B, 0xFFFAA0, 0xC99A20], redstone: [0xE3120B, 0xFF6A5A, 0x960A06], lapis: [0x1F4AB8, 0x4B7CE8, 0x122E7C], diamond: [0x5DE6EE, 0xC4FFF6, 0x279DA6], emerald: [0x1AD663, 0x86F7B1, 0x0B8A3C] };
for (const o in ORES) { TP(o + '_ore', (t, r) => tOre(t, r, 'stone', ORES[o][0], ORES[o][1], ORES[o][2], o === 'coal' ? 7 : o === 'diamond' || o === 'emerald' ? 4 : 5)); TP('deepslate_' + o + '_ore', (t, r) => tOre(t, r, 'deepslate', ORES[o][0], ORES[o][1], ORES[o][2], 5)); }
TP('nether_quartz_ore', (t, r) => tOre(t, r, 'netherrack', 0xE8E0D6, 0xFFFFFF, 0xBFB2A6, 6));
TP('nether_gold_ore', (t, r) => { paintTex('netherrack', t); for (let k = 0; k < 12; k++) t.px(r.int(16), r.int(16), r.pick([0xFCD34B, 0xF6B026, 0xFFF08A])); });
const WOODC = {
  oak: { bark: 0x6B5130, dark: 0x4E3A20, inner: 0xB08F55, ring: 0x9A7A45, plank: 0xA8844F },
  birch: { bark: 0xDCD9D2, dark: 0x2C2C2C, inner: 0xD2C28A, ring: 0xBFAE77, plank: 0xC7B77D },
  spruce: { bark: 0x3E2C18, dark: 0x2A1D0F, inner: 0x7A5A35, ring: 0x654A2B, plank: 0x735432 },
  jungle: { bark: 0x5A4520, dark: 0x3E2E14, inner: 0xAE7E55, ring: 0x946945, plank: 0xA67551 },
  acacia: { bark: 0x696259, dark: 0x4E4841, inner: 0xB35F32, ring: 0x9C5028, plank: 0xAC5C33 },
  dark_oak: { bark: 0x3E2D18, dark: 0x2A1E0F, inner: 0x5C4428, ring: 0x4A3620, plank: 0x4F3822 },
  crimson: { bark: 0x6B2943, dark: 0x4A1830, inner: 0xA24A6A, ring: 0x7E3052, plank: 0x6B344B },
  warped: { bark: 0x3A3B4E, dark: 0x26A89E, inner: 0x3AA59A, ring: 0x2C7F77, plank: 0x2B6863 },
};
for (const w of WOODS) {
  const c = WOODC[w];
  TP(w + '_log', (t, r) => { if (w === 'birch') { tBase(t, r, c.bark, 0.06, 3, 0.4); for (let k = 0; k < 9; k++) { const x = r.int(14), y = r.int(16), l = 2 + r.int(3); for (let i = 0; i < l; i++) t.px(x + i, y, c.dark); } } else tLogSide(t, r, c.bark, c.dark, true); });
  TP(w + '_log_top', (t, r) => tLogTop(t, r, c.inner, c.ring, c.bark));
  TP(w + '_planks', (t, r) => tPlanks(t, r, c.plank));
  TP(w + '_leaves', (t, r) => tLeaves(t, r, w === 'spruce' ? 0.2 : w === 'jungle' ? 0.22 : 0.3, w === 'spruce' ? 1 : 0));
}
TP('crimson_stem', (t, r) => { tLogSide(t, r, WOODC.crimson.bark, 0x9C3A5E, true); tSpeck(t, r, 0xC0506F, 8); });
TP('warped_stem', (t, r) => { tLogSide(t, r, WOODC.warped.bark, 0x26A89E, true); tSpeck(t, r, 0x3FD0C2, 8); });
TP('crimson_stem_top', (t, r) => tLogTop(t, r, 0xA24A6A, 0x7E3052, 0x6B2943));
TP('warped_stem_top', (t, r) => tLogTop(t, r, 0x3AA59A, 0x2C7F77, 0x3A3B4E));
TP('crimson_planks', (t, r) => tPlanks(t, r, WOODC.crimson.plank));
TP('warped_planks', (t, r) => tPlanks(t, r, WOODC.warped.plank));
function sapling(t, r, trunk, leaf) {
  t.clear(); stem(t, 7, 9, 15, trunk); stem(t, 8, 11, 15, csh(trunk, 0.85));
  for (let k = 0; k < 34; k++) { const a = r.next() * TAU, d = Math.sqrt(r.next()) * 5; const x = Math.round(7.5 + Math.cos(a) * d), y = Math.round(6 + Math.sin(a) * d * 0.9); if (y < 11) t.px(x, y, csh(leaf, 0.75 + r.next() * 0.45)); }
}
TP('oak_sapling', (t, r) => sapling(t, r, 0x6B5130, 0x3E8A2A)); TP('birch_sapling', (t, r) => sapling(t, r, 0xD8D3C8, 0x6FA044));
TP('spruce_sapling', (t, r) => { t.clear(); stem(t, 7, 8, 15, 0x3E2C18); for (let y = 2; y < 13; y++) { const w = Math.floor((y - 1) / 2.4); for (let x = 7 - w; x <= 8 + w; x++) if (r.next() < 0.8) t.px(x, y, csh(0x2E5A36, 0.8 + r.next() * 0.4)); } });
TP('jungle_sapling', (t, r) => sapling(t, r, 0x5A4520, 0x2F9A1E)); TP('acacia_sapling', (t, r) => sapling(t, r, 0x696259, 0x7EA02A)); TP('dark_oak_sapling', (t, r) => sapling(t, r, 0x3E2D18, 0x2F6A1E));
TP('snow', (t, r) => { tBase(t, r, 0xF3FAFA, 0.05, 4, 0.6); tSpeck(t, r, 0xDDE8EE, 10, 0.03); });
TP('ice', (t, r) => { tBase(t, r, 0x9ABFF4, 0.08, 3, 0.4); for (let k = 0; k < 4; k++) { let x = r.int(16), y = r.int(16); for (let i = 0; i < 5; i++) { t.px(x, y, 0xD8E8FF); x++; y--; } } for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.setA(x, y, 190); });
TP('packed_ice', (t, r) => { tBase(t, r, 0x8AB2EE, 0.1, 3, 0.4); for (let k = 0; k < 6; k++) { let x = r.int(16), y = r.int(16); for (let i = 0; i < 4; i++) { t.px(x, y, 0xB6D0FA); x++; y++; } } });
TP('cactus_side', (t, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { const edge = x === 0 || x === 15; let c = edge ? 0x1F5E22 : (x % 4 === 2 ? 0x2A7A2E : 0x3A962F); t.px(x, y, csh(c, 0.9 + r.next() * 0.15)); } for (let k = 0; k < 10; k++) t.px(1 + r.int(14), r.int(16), 0xD8E6B8); });
TP('cactus_top', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); t.px(x, y, csh(d > 6.6 ? 0x1F5E22 : (Math.floor(d) & 1) ? 0x3A962F : 0x4AA83A, 0.9 + r.next() * 0.15)); } });
TP('cactus_bottom', (t, r) => { tBase(t, r, 0x3E8A34, 0.1, 3, 0.5); });
TP('sugar_cane', (t, r) => { t.clear(); for (const x of [3, 8, 12]) { const c = x === 8 ? 0x86B85A : 0x72A548; for (let y = 0; y < 16; y++) { t.px(x, y, (y % 6 === 0) ? 0x5E8A3A : c); t.px(x + 1, y, (y % 6 === 0) ? 0x4E7A2E : csh(c, 0.85)); } t.px(x + 2, 3 + x % 5, 0x6E9E44); t.px(x - 1, 9, 0x6E9E44); } });
TP('dead_bush', (t, r) => { t.clear(); const br = (x, y, dx, n) => { for (let i = 0; i < n; i++) { t.px(x, y, 0x6B4A22); y--; if (r.next() < 0.6) x += dx; } return [x, y]; }; stem(t, 8, 11, 15, 0x6B4A22); let a = br(8, 11, -1, 6); br(a[0], a[1], 1, 3); a = br(8, 12, 1, 7); br(a[0], a[1], -1, 3); br(8, 10, 0, 5); });
TP('tall_grass', (t, r) => { t.clear(); for (let k = 0; k < 13; k++) { let x = 1 + r.int(14); const hgt = 6 + r.int(10); const lean = r.next() < 0.5 ? -1 : 1; for (let i = 0; i < hgt; i++) { t.px(x, 15 - i, csh(0xFFFFFF, 0.5 + i / hgt * 0.35 + r.next() * 0.1)); if (i > hgt * 0.55 && r.next() < 0.35) x += lean; } } });
TP('fern', (t, r) => { t.clear(); for (let s = 0; s < 3; s++) { let x = 4 + s * 4, y = 15; const lean = s - 1; for (let i = 0; i < 12; i++) { t.px(x, y, csh(0xFFFFFF, 0.55)); if (i % 2 === 0 && i > 1) { t.px(x - 1, y, csh(0xFFFFFF, 0.7)); t.px(x + 1, y, csh(0xFFFFFF, 0.7)); if (i < 9) { t.px(x - 2, y + 1, csh(0xFFFFFF, 0.8)); t.px(x + 2, y + 1, csh(0xFFFFFF, 0.8)); } } y--; if (i % 4 === 3) x += lean; } } });
function flower(t, r, petal, center, stemC, shape) {
  t.clear(); stem(t, 7, 7, 15, stemC || 0x3F7F2A); t.px(6, 12, stemC || 0x3F7F2A); t.px(8, 10, stemC || 0x3F7F2A); t.px(5, 11, 0x4E9A34); t.px(9, 9, 0x4E9A34);
  if (shape === 'ball') { for (let y = 2; y < 8; y++) for (let x = 4; x < 11; x++) { const d = Math.hypot(x - 7, y - 4.5); if (d < 3.2 && r.next() < 0.85) t.px(x, y, csh(petal, 0.8 + r.next() * 0.4)); } }
  else if (shape === 'tulip') { t.rect(6, 3, 3, 4, petal); t.px(5, 3, petal); t.px(9, 3, petal); t.px(6, 2, csh(petal, 1.2)); t.px(8, 2, csh(petal, 1.2)); t.px(7, 4, csh(petal, 0.8)); }
  else if (shape === 'bells') { for (const [x, y] of [[5, 5], [9, 4], [6, 8], [10, 7]]) { t.px(x, y, petal); t.px(x + 1, y, petal); t.px(x, y + 1, csh(petal, 0.9)); t.px(x + 1, y + 1, csh(petal, 0.9)); } stem(t, 8, 3, 8, 0x3F7F2A); }
  else if (shape === 'small') { for (const [x, y] of [[5, 5], [9, 4], [7, 7], [4, 8], [10, 8]]) { t.px(x, y, petal); t.px(x + 1, y, petal); t.px(x, y + 1, petal); t.px(x + 1, y + 1, center); } }
  else { const cx = 7, cy = 5; for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -3], [0, 3], [-3, 0], [3, 0]]) t.px(cx + dx, cy + dy, csh(petal, 0.85 + r.next() * 0.3)); t.px(cx, cy, center); t.px(cx + 1, cy, center); t.px(cx, cy + 1, center); t.px(cx - 1, cy, csh(petal, 0.9)); }
}
TP('dandelion', (t, r) => flower(t, r, 0xF5D42A, 0xE8A50E, 0x4E8A2E, 'ball'));
TP('poppy', (t, r) => flower(t, r, 0xD8261E, 0x2A1A10));
TP('blue_orchid', (t, r) => flower(t, r, 0x2AA6E8, 0x7FD8FF));
TP('allium', (t, r) => flower(t, r, 0xB26BE0, 0xB26BE0, 0x4E8A2E, 'ball'));
TP('azure_bluet', (t, r) => flower(t, r, 0xE8ECEF, 0xF2D34A, 0x4E8A2E, 'small'));
TP('red_tulip', (t, r) => flower(t, r, 0xE2362C, 0xE2362C, 0x4E8A2E, 'tulip'));
TP('oxeye_daisy', (t, r) => flower(t, r, 0xF2F2F2, 0xF2C02A));
TP('cornflower', (t, r) => flower(t, r, 0x4466E8, 0x2A3A9A));
TP('lily_of_the_valley', (t, r) => flower(t, r, 0xF4F4F4, 0xF4F4F4, 0x4E8A2E, 'bells'));
function mush(t, r, cap, spots) {
  t.clear(); t.rect(7, 9, 2, 6, 0xD6CDBF); t.px(7, 15, 0xB8AE9E);
  for (let y = 4; y < 10; y++) { const w = y < 6 ? 2 + (y - 4) : 4; for (let x = 8 - w; x < 8 + w; x++) t.px(x, y, csh(cap, 0.85 + r.next() * 0.25)); }
  if (spots) for (const [x, y] of [[6, 5], [9, 6], [5, 8], [10, 8], [8, 4]]) t.px(x, y, 0xF2EEE6);
}
TP('brown_mushroom', (t, r) => mush(t, r, 0x9A7152, false));
TP('red_mushroom', (t, r) => mush(t, r, 0xCE2A26, true));
TP('brown_mushroom_block', (t, r) => { tBase(t, r, 0x926E53, 0.12, 4, 0.6); tSpeck(t, r, 0xA88466, 16); });
TP('red_mushroom_block', (t, r) => { tBase(t, r, 0xB6272A, 0.1, 4, 0.5); for (let k = 0; k < 5; k++) { const x = r.int(14), y = r.int(14), s = 2 + r.int(2); t.rect(x, y, s, s, 0xEFEAE0); } });
TP('mushroom_stem', (t, r) => { tBase(t, r, 0xCFC8BA, 0.06, 3, 0.4); for (let x = 1; x < 16; x += 3) for (let y = 0; y < 16; y++) if (r.next() < 0.5) t.px(x, y, 0xBDB5A5); });
TP('pumpkin_side', (t, r) => { for (let x = 0; x < 16; x++) { const rib = (x % 4 === 0); for (let y = 0; y < 16; y++) t.px(x, y, csh(rib ? 0xB8650F : 0xE0881C, 0.9 + r.next() * 0.15 + (x % 4 === 2 ? 0.08 : 0))); } });
TP('pumpkin_top', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const a = Math.atan2(y - 7.5, x - 7.5), d = Math.hypot(x - 7.5, y - 7.5); t.px(x, y, csh((Math.floor((a + Math.PI) / TAU * 12) & 1) ? 0xD8801A : 0xC06F12, 0.9 + r.next() * 0.15 - d * 0.01)); } t.rect(7, 7, 2, 2, 0x5A6A2A); t.px(8, 6, 0x4A5A20); });
function pumpkinFace(t, r, lit) {
  paintTex('pumpkin_side', t);
  const hole = lit ? 0xFFD04A : 0x3A1E08, rim = lit ? 0xF8A62A : 0x522A0A;
  for (const ex of [4, 10]) { t.px(ex, 4, hole); t.px(ex + 1, 4, hole); t.px(ex - 1, 5, hole); t.px(ex, 5, hole); t.px(ex + 1, 5, hole); t.px(ex + 2, 5, hole); t.px(ex, 6, rim); t.px(ex + 1, 6, rim); }
  for (let x = 3; x < 13; x++) { t.px(x, 10, hole); t.px(x, 11, x % 3 === 0 ? rim : hole); }
  t.px(2, 9, hole); t.px(13, 9, hole); t.px(5, 12, hole); t.px(9, 12, hole); t.px(7, 8, rim); t.px(8, 8, hole);
}
TP('pumpkin_face', (t, r) => pumpkinFace(t, r, false));
TP('jack_o_lantern', (t, r) => pumpkinFace(t, r, true));
TP('melon_side', (t, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.px(x, y, csh((x % 4 === 1 || x % 4 === 2) ? 0x5C8E1A : 0x7DAE2A, 0.88 + r.next() * 0.2)); });
TP('melon_top', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); t.px(x, y, csh((Math.floor(d / 1.5) & 1) ? 0x6F9E22 : 0x8ABC34, 0.9 + r.next() * 0.15)); } });
TP('vine', (t, r) => { t.clear(); for (let k = 0; k < 5; k++) { let x = r.int(16), y = 0; for (let i = 0; i < 18; i++) { t.px(x, y, csh(0xFFFFFF, 0.5 + r.next() * 0.2)); if (r.next() < 0.3) { t.px(x - 1, y, csh(0xFFFFFF, 0.7)); t.px(x + 1, y, csh(0xFFFFFF, 0.72)); } y++; x += r.int(3) - 1; } } });
TP('lily_pad', (t, r) => { t.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5); if (d < 7.4 && !(a > -0.45 && a < 0.1 && d > 1)) t.px(x, y, csh(0xFFFFFF, 0.6 + (Math.floor(d) % 3 === 0 ? 0.1 : 0) + r.next() * 0.15)); } });
TP('seagrass', (t, r) => { t.clear(); for (let k = 0; k < 7; k++) { let x = 2 + r.int(12); for (let y = 15; y > 1 + r.int(6); y--) { t.px(x, y, csh(0x3E8E2E, 0.8 + r.next() * 0.4)); if (r.next() < 0.2) x += r.int(3) - 1; } } });
TP('kelp', (t, r) => { t.clear(); for (let y = 0; y < 16; y++) { t.px(7, y, 0x5A8A2A); t.px(8, y, 0x4A7A22); if (y % 4 === 1) { t.px(5, y, 0x6A9E34); t.px(6, y, 0x5E9030); t.px(9, y + 2, 0x6A9E34); t.px(10, y + 2, 0x5E9030); } } });
TP('terracotta', (t, r) => { tBase(t, r, 0xE8E0DC, 0.08, 4, 0.6); tSpeck(t, r, 0xD8CEC8, 12, 0.04); });
TP('wool', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const st = ((x + (y >> 1)) & 3) === 0; t.px(x, y, csh(0xFFFFFF, (st ? 0.84 : 0.93) + (r.next() - 0.5) * 0.08)); } });
TP('stained_glass', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; t.px(x, y, csh(0xFFFFFF, edge ? 0.8 : 0.96), edge ? 220 : 120); } for (let i = 3; i < 7; i++) t.px(i, 10 - i, 0xFFFFFF, 190); });
TP('glass', (t, r) => { t.clear(); for (let i = 0; i < 16; i++) { t.px(i, 0, 0xDDEFF4); t.px(0, i, 0xDDEFF4); t.px(i, 15, 0xB9D4DC); t.px(15, i, 0xB9D4DC); } for (let i = 2; i < 6; i++) t.px(i, 7 - i, 0xFFFFFF, 200); for (let i = 9; i < 12; i++) t.px(i, 20 - i, 0xEFFAFF, 180); t.px(3, 5, 0xFFFFFF, 180); });
TP('bookshelf', (t, r) => { tPlanks(t, r, WOODC.oak.plank); const cols = [0x8E2A22, 0x2A4A8E, 0x2E7A34, 0x8E7A2A, 0x5A2A6E, 0x6A4A2A, 0x2A6A6A]; for (const y0 of [2, 9]) { t.rect(0, y0, 16, 5, 0x3A2A18); let x = 1; while (x < 15) { const w = 1 + r.int(2), hh = 3 + r.int(3), c = r.pick(cols); for (let i = 0; i < w && x < 15; i++, x++) for (let y = y0 + 5 - hh; y < y0 + 5; y++) t.px(x, y, csh(c, i === 0 ? 1.1 : 0.9)); if (r.next() < 0.2) x++; } } });
TP('crafting_table_top', (t, r) => { tPlanks(t, r, 0xA8844F); for (let i = 0; i < 16; i++) { t.px(i, 0, 0x5A3E1E); t.px(i, 15, 0x5A3E1E); t.px(0, i, 0x5A3E1E); t.px(15, i, 0x5A3E1E); t.px(i, 5, 0x7A5A30); t.px(i, 10, 0x7A5A30); t.px(5, i, 0x7A5A30); t.px(10, i, 0x7A5A30); } });
TP('crafting_table_side', (t, r) => { tPlanks(t, r, 0x9A7545); t.rect(0, 0, 16, 3, 0x6B4E2A); tSpeck(t, r, 0x7A5A30, 4); t.rect(3, 5, 1, 7, 0x5A4632); t.rect(2, 5, 3, 2, 0x8E8E8E); t.rect(10, 5, 1, 8, 0x6B4E2A); t.rect(9, 5, 3, 1, 0x9A9A9A); t.px(11, 6, 0x9A9A9A); });
TP('crafting_table_front', (t, r) => { tPlanks(t, r, 0x9A7545); t.rect(0, 0, 16, 3, 0x6B4E2A); for (let i = 0; i < 7; i++) { t.px(3 + i, 5 + i, 0x8E8E8E); t.px(4 + i, 5 + i, 0x6E6E6E); } t.rect(9, 11, 2, 3, 0x5A4632); t.rect(11, 5, 2, 2, 0xB0B0B0); t.rect(12, 7, 1, 6, 0x5A4632); });
TP('furnace_top', (t, r) => { tSmooth(t, r, 0x8A8A8A, 0.1); });
TP('furnace_side', (t, r) => { tBase(t, r, 0x7E7E7E, 0.14, 4, 0.6); tBevel(t, 1.12, 0.78); for (let x = 1; x < 15; x++) t.px(x, 2, 0x6A6A6A); });
function furnaceFront(t, r, lit) { paintTex('furnace_side', t); t.rect(3, 7, 10, 6, 0x1E1E1E); for (let x = 3; x < 13; x++) t.px(x, 6, 0x5A5A5A); for (let x = 4; x < 12; x += 2) t.rect(x, 8, 1, 4, 0x2E2E2E); if (lit) for (let x = 4; x < 12; x++) { const hh = 1 + r.int(4); for (let y = 12 - hh; y < 13; y++) t.px(x, y, y > 11 - hh / 2 ? 0xFFB43A : 0xFF7A1A); } t.rect(4, 3, 8, 2, 0x4A4A4A); }
TP('furnace_front', (t, r) => furnaceFront(t, r, false));
TP('furnace_front_on', (t, r) => furnaceFront(t, r, true));
TP('chest_top', (t, r) => { tPlanks(t, r, 0xA0712F); tBevel(t, 0.7, 0.7); });
TP('chest_side', (t, r) => { tPlanks(t, r, 0x9A6A2A); for (let x = 0; x < 16; x++) { t.px(x, 4, 0x3A2610); t.px(x, 0, 0x5A3E1E); t.px(x, 15, 0x5A3E1E); } for (let y = 0; y < 16; y++) { t.px(0, y, 0x5A3E1E); t.px(15, y, 0x5A3E1E); } });
TP('chest_front', (t, r) => { paintTex('chest_side', t); t.rect(7, 3, 2, 4, 0xC8C8C8); t.px(7, 6, 0x8A8A8A); t.px(8, 6, 0x8A8A8A); });
TP('barrel_side', (t, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.px(x, y, csh(0x8A6034, (x % 4 === 3 ? 0.72 : 0.95) + r.next() * 0.1)); for (const y of [2, 13]) for (let x = 0; x < 16; x++) t.px(x, y, 0x4A4A4A); });
TP('barrel_top', (t, r) => { tPlanks(t, r, 0x9A7038); for (let i = 0; i < 16; i++) { t.px(i, 0, 0x4A3A2A); t.px(0, i, 0x4A3A2A); t.px(i, 15, 0x4A3A2A); t.px(15, i, 0x4A3A2A); } t.rect(6, 6, 4, 4, 0x2A1E12); });
TP('barrel_bottom', (t, r) => { tPlanks(t, r, 0x8A6030); tBevel(t, 0.7, 0.7); });
TP('torch', (t, r) => { t.clear(); for (let y = 8; y < 16; y++) { t.px(7, y, 0x6B4A22); t.px(8, y, 0x55391A); } t.px(7, 6, 0xFFE9A0); t.px(8, 6, 0xFFD050); t.px(7, 7, 0xFFB22A); t.px(8, 7, 0xFF9A1A); t.px(7, 5, 0xFFF6D0, 200); t.px(8, 5, 0xFFE38A, 160); });
TP('soul_torch', (t, r) => { t.clear(); for (let y = 8; y < 16; y++) { t.px(7, y, 0x6B4A22); t.px(8, y, 0x55391A); } t.px(7, 6, 0xC8FFFF); t.px(8, 6, 0x7AE6F0); t.px(7, 7, 0x3AC8D8); t.px(8, 7, 0x2AA6C0); t.px(7, 5, 0xE0FFFF, 200); });
TP('ladder', (t, r) => { t.clear(); for (let y = 0; y < 16; y++) { t.px(2, y, 0x7A5A30); t.px(3, y, 0x6A4A26); t.px(12, y, 0x7A5A30); t.px(13, y, 0x6A4A26); } for (let y = 1; y < 16; y += 4) for (let x = 2; x < 14; x++) { t.px(x, y, 0x8E6A3A); t.px(x, y + 1, 0x5E4220); } });
TP('oak_door_top', (t, r) => { tPlanks(t, r, 0x9A7545); for (let i = 0; i < 16; i++) { t.px(0, i, 0x5A3E1E); t.px(15, i, 0x5A3E1E); t.px(i, 0, 0x5A3E1E); } for (const [x0, y0] of [[2, 2], [9, 2]]) { t.rect(x0, y0, 5, 6, 0, 0); } for (let i = 2; i < 14; i++) t.px(i, 10, 0x6B4E2A); });
TP('oak_door_bottom', (t, r) => { tPlanks(t, r, 0x9A7545); for (let i = 0; i < 16; i++) { t.px(0, i, 0x5A3E1E); t.px(15, i, 0x5A3E1E); t.px(i, 15, 0x5A3E1E); } t.rect(3, 3, 10, 9, 0x8A6A3E); for (let i = 3; i < 13; i++) { t.px(i, 3, 0x6B4E2A); t.px(i, 11, 0xA8844F); } t.rect(12, 6, 2, 2, 0x3A3A3A); });
TP('iron_door_top', (t, r) => { tMetal(t, r, 0xC6C6C6, 0xE6E6E6, 0x8A8A8A); t.rect(4, 3, 8, 5, 0, 0); for (let x = 4; x < 12; x++) t.px(x, 5, 0x9A9A9A); });
TP('iron_door_bottom', (t, r) => { tMetal(t, r, 0xC6C6C6, 0xE6E6E6, 0x8A8A8A); for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) t.px(x, y, 0x7A7A7A); t.rect(12, 6, 2, 2, 0x4A4A4A); });
TP('oak_trapdoor', (t, r) => { tPlanks(t, r, 0x9A7545); for (let i = 0; i < 16; i++) { t.px(i, 0, 0x5A3E1E); t.px(i, 15, 0x5A3E1E); t.px(0, i, 0x5A3E1E); t.px(15, i, 0x5A3E1E); } for (const [x, y] of [[3, 3], [9, 3], [3, 9], [9, 9]]) t.rect(x, y, 4, 4, 0, 0); });
TP('bed_top_head', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, y < 7 ? csh(0xEEEEEE, 0.92 + r.next() * 0.08) : csh(0xB02E26, 0.9 + r.next() * 0.12)); for (let x = 0; x < 16; x++) { t.px(x, 0, 0xCCCCCC); t.px(x, 7, 0x8E2420); } for (let y = 0; y < 16; y++) { t.px(0, y, csh(t.get(0, y), 0.85)); t.px(15, y, csh(t.get(15, y), 0.85)); } });
TP('bed_top_foot', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, csh(0xB02E26, 0.9 + r.next() * 0.12 - (y === 3 ? 0.15 : 0))); for (let y = 0; y < 16; y++) { t.px(0, y, 0x8E2420); t.px(15, y, 0x8E2420); } });
TP('bed_side', (t, r) => { t.clear(); for (let x = 0; x < 16; x++) { for (let y = 7; y < 10; y++) t.px(x, y, csh(0xB02E26, 0.9 + r.next() * 0.1)); for (let y = 10; y < 14; y++) t.px(x, y, csh(0x8E6A3E, 0.9 + r.next() * 0.1)); } });
TP('bed_end', (t, r) => { paintTex('bed_side', t); for (let y = 7; y < 10; y++) { t.px(0, y, 0x6B4A2A); t.px(15, y, 0x6B4A2A); } });
TP('tnt_side', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, (y >= 5 && y <= 10) ? csh(0xEDEDED, 0.94 + r.next() * 0.06) : csh(x % 4 === 0 ? 0xB0241A : 0xD8301F, 0.92 + r.next() * 0.1)); t.pat(DIGITS3x5.T, { '#': 0x1E1E1E }, 2, 6); t.pat(DIGITS3x5.N, { '#': 0x1E1E1E }, 6, 6); t.pat(DIGITS3x5.T, { '#': 0x1E1E1E }, 10, 6); });
TP('tnt_top', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, csh(((x >> 2) + (y >> 2)) & 1 ? 0xD8301F : 0xB8271A, 0.94 + r.next() * 0.08)); t.rect(6, 6, 4, 4, 0xEDEDED); t.rect(7, 7, 2, 2, 0x3A3A3A); });
TP('tnt_bottom', (t, r) => { tBase(t, r, 0xC62C1D, 0.1, 3, 0.5); });
TP('glowstone', (t, r) => { tCells(t, r, [0xD9A04A, 0xF2C45A, 0xC9873A, 0xFFE08A], 10, 0x7A4E20, true); tSpeck(t, r, 0xFFF4C0, 10, 0.05); });
TP('netherrack', (t, r) => { tBase(t, r, 0x6F2F2F, 0.22, 4, 0.6); tSpeck(t, r, 0x8E4040, 16); tSpeck(t, r, 0x4E1E1E, 16); for (let k = 0; k < 3; k++) { let x = r.int(16), y = r.int(16); for (let i = 0; i < 4; i++) { t.px(x, y, 0x3E1616); x += r.int(3) - 1; y++; } } });
TP('soul_sand', (t, r) => { tBase(t, r, 0x5A4434, 0.2, 4, 0.6); for (let k = 0; k < 4; k++) { const x = r.int(13), y = r.int(12); t.px(x, y, 0x2E2018); t.px(x + 2, y, 0x2E2018); t.px(x + 1, y + 2, 0x33241A); t.px(x, y + 3, 0x3A2A1E); t.px(x + 2, y + 3, 0x3A2A1E); } });
TP('soul_soil', (t, r) => { tBase(t, r, 0x4B3A2E, 0.18, 4, 0.6); tSpeck(t, r, 0x3A2C22, 20); });
TP('nether_bricks', (t, r) => { tBricks(t, r, 0x2E161B, 0x160A0C, 4, 6, 0.3, true); });
TP('red_nether_bricks', (t, r) => { tBricks(t, r, 0x5A0A0E, 0x2A0406, 4, 6, 0.3, true); });
function wart(t, r, stage) { t.clear(); const n = [3, 5, 7][stage]; for (let k = 0; k < n; k++) { const x = 2 + r.int(12), top = 15 - (4 + stage * 3 + r.int(3)); for (let y = top + 2; y < 16; y++) t.px(x, y, 0x6A1A12); t.px(x, top, 0xB0201A); t.px(x - 1, top + 1, 0x8E1810); t.px(x + 1, top + 1, 0x9A1C14); t.px(x, top + 1, 0xC8281E); } }
TP('nether_wart_0', (t, r) => wart(t, r, 0)); TP('nether_wart_1', (t, r) => wart(t, r, 1)); TP('nether_wart_2', (t, r) => wart(t, r, 2));
TP('magma', (t, r) => { tCells(t, r, [0x4E1E0E, 0x5A2410, 0x3E160A], 9, 0xFF8A1E, false); tSpeck(t, r, 0xFFC04A, 6, 0.1); });
TP('basalt_side', (t, r) => { for (let x = 0; x < 16; x++) { const f = 0.85 + hashF2(4, x, 0) * 0.3; for (let y = 0; y < 16; y++) t.px(x, y, csh(0x55555C, f * (0.94 + r.next() * 0.12))); } });
TP('basalt_top', (t, r) => { tBase(t, r, 0x505057, 0.1, 3, 0.5); for (let i = 0; i < 16; i++) { t.px(i, 7, 0x3E3E44); t.px(7, i, 0x3E3E44); } tBevel(t, 1.1, 0.75); });
TP('blackstone', (t, r) => { tBase(t, r, 0x2B2529, 0.2, 4, 0.6); tSpeck(t, r, 0x3E363B, 14); tSpeck(t, r, 0x1A1618, 10); });
TP('blackstone_top', (t, r) => { tBase(t, r, 0x2A2428, 0.14, 3, 0.6); tBevel(t, 1.2, 0.7); });
TP('crimson_nylium', (t, r) => { tBase(t, r, 0x8A1C1C, 0.2, 5, 0.6); tSpeck(t, r, 0xB43A2A, 20); tSpeck(t, r, 0x5E1010, 12); });
TP('crimson_nylium_side', (t, r) => { paintTex('netherrack', t); for (let x = 0; x < 16; x++) { const d = 3 + (r.next() < 0.5 ? r.int(3) : 0); for (let y = 0; y < d; y++) t.px(x, y, csh(0x8A1C1C, 0.85 + r.next() * 0.3)); } });
TP('warped_nylium', (t, r) => { tBase(t, r, 0x167E80, 0.2, 5, 0.6); tSpeck(t, r, 0x2AB0A0, 20); tSpeck(t, r, 0x0E5656, 12); });
TP('warped_nylium_side', (t, r) => { paintTex('netherrack', t); for (let x = 0; x < 16; x++) { const d = 3 + (r.next() < 0.5 ? r.int(3) : 0); for (let y = 0; y < d; y++) t.px(x, y, csh(0x167E80, 0.85 + r.next() * 0.3)); } });
TP('nether_wart_block', (t, r) => { tBase(t, r, 0x7A0E0E, 0.25, 5, 0.6); tBlobs(t, r, 0x9A1A16, 5, 2); tSpeck(t, r, 0x520606, 14); });
TP('warped_wart_block', (t, r) => { tBase(t, r, 0x157A76, 0.25, 5, 0.6); tBlobs(t, r, 0x22A098, 5, 2); tSpeck(t, r, 0x0A504E, 14); });
TP('shroomlight', (t, r) => { tCells(t, r, [0xF09A48, 0xF8B060, 0xE8843A], 9, 0xC06A2A, true); tSpeck(t, r, 0xFFE0A0, 12, 0.05); });
TP('crimson_fungus', (t, r) => { t.clear(); t.rect(7, 9, 2, 7, 0xC8A07A); for (let y = 5; y < 10; y++) for (let x = 4 + Math.max(0, 7 - y); x < 12 - Math.max(0, 7 - y); x++) t.px(x, y, csh(0xB8241E, 0.85 + r.next() * 0.3)); t.px(6, 7, 0xF2B24A); t.px(10, 8, 0xF2B24A); });
TP('warped_fungus', (t, r) => { t.clear(); t.rect(7, 9, 2, 7, 0xC8A07A); for (let y = 5; y < 10; y++) for (let x = 4 + Math.max(0, 7 - y); x < 12 - Math.max(0, 7 - y); x++) t.px(x, y, csh(0x179E92, 0.85 + r.next() * 0.3)); t.px(6, 7, 0xF28A2A); t.px(10, 8, 0xF28A2A); });
TP('crimson_roots', (t, r) => { t.clear(); for (let k = 0; k < 6; k++) { let x = 2 + r.int(12); for (let y = 15; y > 4 + r.int(6); y--) { t.px(x, y, csh(0xA0241E, 0.8 + r.next() * 0.4)); if (r.next() < 0.3) x += r.int(3) - 1; } } });
TP('warped_roots', (t, r) => { t.clear(); for (let k = 0; k < 6; k++) { let x = 2 + r.int(12); for (let y = 15; y > 4 + r.int(6); y--) { t.px(x, y, csh(0x16A090, 0.8 + r.next() * 0.4)); if (r.next() < 0.3) x += r.int(3) - 1; } } });
TP('quartz_block_top', (t, r) => { tBase(t, r, 0xECE6DF, 0.04, 3, 0.4); tBevel(t, 1.02, 0.9); });
TP('quartz_block_side', (t, r) => { tBase(t, r, 0xE8E2DA, 0.04, 3, 0.4); for (let x = 0; x < 16; x++) { t.px(x, 0, 0xD8D0C6); t.px(x, 15, 0xD0C8BE); } });
TP('portal', (t, r) => { const vn = vnoise(r, 4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = vn(x, y) * 0.7 + r.next() * 0.3; t.px(x, y, v > 0.7 ? 0xC87AFF : v > 0.45 ? 0x7A2AE8 : 0x4A10A8, 200); } });
TP('fire', (t, r) => { t.clear(); const hts = []; for (let x = 0; x < 16; x++) hts.push(7 + r.int(8) + (x % 5 === 2 ? 3 : 0)); for (let x = 0; x < 16; x++) { const hh = Math.min(16, hts[x]); for (let y = 16 - hh; y < 16; y++) { const f = (16 - y) / hh; t.px(x, y, f > 0.8 ? 0xC8240E : f > 0.55 ? 0xF05A14 : f > 0.3 ? 0xFFA028 : 0xFFE070); } } });
TP('iron_block', (t, r) => tMetal(t, r, 0xDADADA, 0xF6F6F6, 0x9A9A9A));
TP('gold_block', (t, r) => tMetal(t, r, 0xF4CE3A, 0xFFF4A0, 0xC4961A));
TP('diamond_block', (t, r) => tMetal(t, r, 0x5EE2DC, 0xC8FFFA, 0x2AA6A0));
TP('emerald_block', (t, r) => tMetal(t, r, 0x2ACC62, 0x9AF6B8, 0x12863A));
TP('lapis_block', (t, r) => { tBase(t, r, 0x2150AE, 0.14, 4, 0.6); tSpeck(t, r, 0x3A6ED8, 16); tSpeck(t, r, 0x163C8A, 12); tBevel(t, 1.1, 0.8); });
TP('coal_block', (t, r) => { tBase(t, r, 0x1C1C1C, 0.3, 4, 0.6); tSpeck(t, r, 0x383838, 16); });
TP('redstone_block', (t, r) => { tBase(t, r, 0xAE1C04, 0.2, 4, 0.6); tSpeck(t, r, 0xE83A1A, 14); tSpeck(t, r, 0x7A1004, 10); tBevel(t, 1.1, 0.8); });
TP('sea_lantern', (t, r) => { tCells(t, r, [0xB8D8D0, 0xD8F0EA, 0xA8CCC4], 8, 0xE8FFF8, false); tBevel(t, 1.1, 0.8); });
TP('hay_block_side', (t, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.px(x, y, csh(x % 3 === 0 ? 0xA4861E : 0xC6A82A, 0.9 + r.next() * 0.15)); for (const y of [3, 12]) for (let x = 0; x < 16; x++) { t.px(x, y, 0x8A2A1A); t.px(x, y + 1, 0x6E1E12); } });
TP('hay_block_top', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, csh(r.next() < 0.3 ? 0xA4861E : 0xC6A82A, 0.9 + r.next() * 0.15)); });
TP('bone_block_side', (t, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.px(x, y, csh(x % 4 === 0 ? 0xC8C2A8 : 0xE2DCC4, 0.95 + r.next() * 0.08)); });
TP('bone_block_top', (t, r) => { tBase(t, r, 0xE0DAC2, 0.05, 3, 0.4); for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) { t.rect(x - 1, y - 1, 3, 3, 0xC8C2A8); t.px(x, y, 0xA8A288); } });
TP('cobweb', (t, r) => { t.clear(); const c = 0xE8E8E8; for (let i = 0; i < 16; i++) { t.px(i, i, c); t.px(15 - i, i, c); t.px(7, i, c, 200); t.px(i, 8, c, 200); } for (const rr of [3, 6]) for (let a = 0; a < 16; a++) { const an = a / 16 * TAU; t.px(Math.round(7.5 + Math.cos(an) * rr), Math.round(7.5 + Math.sin(an) * rr), c, 220); } });
TP('spawner', (t, r) => { t.clear(); for (let i = 0; i < 16; i++) { t.px(i, 0, 0x2A2E36); t.px(i, 15, 0x2A2E36); t.px(0, i, 0x2A2E36); t.px(15, i, 0x2A2E36); } for (let k = 3; k < 16; k += 4) for (let i = 0; i < 16; i++) { t.px(k, i, 0x3A3F4A); t.px(i, k, 0x3A3F4A); } });
TP('rail', (t, r) => { t.clear(); for (let y = 0; y < 16; y += 4) for (let x = 1; x < 15; x++) { t.px(x, y + 1, 0x6B4E2A); t.px(x, y + 2, 0x54391C); } for (let y = 0; y < 16; y++) { t.px(3, y, 0xA8A8A8); t.px(4, y, 0x7A7A7A); t.px(11, y, 0xA8A8A8); t.px(12, y, 0x7A7A7A); } });
TP('stone_pressure_plate', (t, r) => paintTex('stone', t));
function crop(t, r, stage, head) {
  t.clear();
  const hmax = 4 + stage * 3.6;
  for (let k = 0; k < 6; k++) {
    const x = 1 + k * 2.6 | 0, hh = Math.round(hmax * (0.75 + r.next() * 0.25));
    for (let y = 15; y > 15 - hh; y--) t.px(x, y, stage === 3 && head === 'wheat' ? 0x9A8A2A : csh(0x3E8A2A, 0.85 + r.next() * 0.3));
    if (head === 'wheat' && stage >= 2) { const c = stage === 3 ? 0xD8B83A : 0x8AB04A; for (let y = 15 - hh; y < 15 - hh + 4; y++) { t.px(x, y, c); t.px(x + 1, y + 1, csh(c, 0.85)); } }
    if (head === 'carrot' && stage === 3) { t.px(x, 15, 0xE8801A); t.px(x, 14, 0xF09028); }
    if (head === 'potato' && stage === 3) { t.px(x, 15, 0xC8A45A); t.px(x + 1, 15, 0xB08E48); }
    if (head !== 'wheat') { t.px(x - 1, 15 - hh + 1, 0x4E9A34); t.px(x + 1, 15 - hh + 2, 0x4E9A34); }
  }
}
for (let s = 0; s < 4; s++) { TP('wheat_' + s, (t, r) => crop(t, r, s, 'wheat')); TP('carrots_' + s, (t, r) => crop(t, r, s, 'carrot')); TP('potatoes_' + s, (t, r) => crop(t, r, s, 'potato')); }
TP('lantern', (t, r) => { t.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x < 2 || x > 13 || y < 2 || y > 13; t.px(x, y, edge ? 0x3A3A44 : ((x + y) % 5 === 0 ? 0xFFD27A : 0xF7A83A)); } });
TP('iron_bars', (t, r) => { t.clear(); for (const x of [1, 5, 10, 14]) for (let y = 0; y < 16; y++) { t.px(x, y, 0x8A8A8A); t.px(x + 1, y, 0x5E5E5E); } for (const y of [0, 15]) for (let x = 0; x < 16; x++) t.px(x, y, 0x6E6E6E); });
TP('cauldron_side', (t, r) => { tMetal(t, r, 0x4A4A4E, 0x5E5E62, 0x2E2E32); t.rect(4, 13, 8, 3, 0, 0); });
TP('cauldron_top', (t, r) => { tMetal(t, r, 0x4A4A4E, 0x5E5E62, 0x2E2E32); t.rect(2, 2, 12, 12, 0x1E1E22); });
TP('cauldron_bottom', (t, r) => { tMetal(t, r, 0x3E3E42, 0x4E4E52, 0x2A2A2E); });
for (let i = 0; i < 10; i++) TP('destroy_' + i, (t, r) => {
  t.clear();
  const rr = new RNG(991);
  const n = 2 + i * 2;
  for (let k = 0; k < n; k++) {
    let x = 7 + rr.range(-2, 2), y = 7 + rr.range(-2, 2), dx = rr.range(-1, 1), dy = rr.range(-1, 1);
    if (!dx && !dy) dx = 1;
    const len = 3 + Math.floor(i * 0.9) + rr.int(3);
    for (let s = 0; s < len; s++) { t.px(x, y, 0x000000, 200); x += dx; y += dy; if (rr.next() < 0.35) { if (rr.next() < 0.5) dx = clamp(dx + rr.range(-1, 1), -1, 1); else dy = clamp(dy + rr.range(-1, 1), -1, 1); } if (!dx && !dy) dy = 1; }
  }
});
