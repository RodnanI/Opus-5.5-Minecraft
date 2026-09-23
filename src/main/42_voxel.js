// ============================================================================
//  Voxel models: procedural builders + face mesher with baked AO (vehicles)
//  Material codes (stored in vertex alpha, read by VOX_FS):
//    0.1 matte  0.3 painted metal  0.5 glass  0.65 bare metal
//    0.85 emissive  1.0 emissive driven by engine throttle
// ============================================================================
const MAT_MATTE = 0.1, MAT_PAINT = 0.3, MAT_GLASS = 0.5, MAT_METAL = 0.65, MAT_GLOW = 0.85, MAT_ENGINE = 1.0;
class VoxGrid {
  constructor(w, h, d, scale) {
    this.w = w; this.h = h; this.d = d; this.scale = scale;
    this.v = new Uint8Array(w * h * d);
    this.pal = [null]; this.palIdx = new Map();
  }
  c(rgb, mat) {
    const k = rgb + ':' + mat;
    let i = this.palIdx.get(k);
    if (i === undefined) { i = this.pal.length; this.pal.push({ rgb, mat }); this.palIdx.set(k, i); }
    return i;
  }
  in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d; }
  get(x, y, z) { return this.in(x, y, z) ? this.v[(z * this.h + y) * this.w + x] : 0; }
  set(x, y, z, p) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (this.in(x, y, z)) this.v[(z * this.h + y) * this.w + x] = p; }
  box(x0, y0, z0, x1, y1, z1, p) {
    for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, p);
  }
  // fn(x, y, z) -> palette index (0 = leave unchanged, -1 = clear)
  each(fn) {
    for (let z = 0; z < this.d; z++) for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const r = fn(x, y, z);
      if (r > 0) this.v[(z * this.h + y) * this.w + x] = r; else if (r < 0) this.v[(z * this.h + y) * this.w + x] = 0;
    }
  }
  // copy the right half (x >= w/2) onto the left half
  mirror() {
    const w = this.w;
    for (let z = 0; z < this.d; z++) for (let y = 0; y < this.h; y++) for (let x = 0; x < (w >> 1); x++) this.v[(z * this.h + y) * w + x] = this.v[(z * this.h + y) * w + (w - 1 - x)];
  }
}
// piecewise-linear profile: stations [[k, a, b, ...], ...] -> values at k
function profile(st, k) {
  if (k <= st[0][0]) return st[0].slice(1);
  for (let i = 1; i < st.length; i++) {
    if (k <= st[i][0]) { const a = st[i - 1], b = st[i], t = (k - a[0]) / (b[0] - a[0]); return a.slice(1).map((v, j) => v + (b[j + 1] - v) * t); }
  }
  return st[st.length - 1].slice(1);
}
const VOX_FACES = [
  { n: [1, 0, 0], o: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], o: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], o: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], o: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], o: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], o: [0, 0, 0], u: [0, 1, 0], v: [1, 0, 0] },
];
const VOX_AO = [0.5, 0.68, 0.85, 1.0];
// mesh a grid into non-indexed triangles: pos3 normal3 color4 (alpha = material)
function meshVoxGrid(g, origin) {
  const out = [];
  const [ox, oy, oz] = origin, s = g.scale;
  const solid = (x, y, z) => g.get(x, y, z) !== 0;
  for (let z = 0; z < g.d; z++) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const p = g.v[(z * g.h + y) * g.w + x];
    if (!p) continue;
    const pe = g.pal[p], glow = pe.mat > 0.75;
    const r = ((pe.rgb >> 16) & 255) / 255, gg = ((pe.rgb >> 8) & 255) / 255, b = (pe.rgb & 255) / 255;
    for (const F of VOX_FACES) {
      const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      const q = g.get(nx, ny, nz);
      if (q) continue;
      const ao = [], pts = [];
      for (let k = 0; k < 4; k++) {
        const a = k === 1 || k === 2 ? 1 : 0, c = k >= 2 ? 1 : 0;
        const su = a ? 1 : -1, sv = c ? 1 : -1;
        const s1 = solid(nx + F.u[0] * su, ny + F.u[1] * su, nz + F.u[2] * su);
        const s2 = solid(nx + F.v[0] * sv, ny + F.v[1] * sv, nz + F.v[2] * sv);
        const sc = solid(nx + F.u[0] * su + F.v[0] * sv, ny + F.u[1] * su + F.v[1] * sv, nz + F.u[2] * su + F.v[2] * sv);
        ao.push(glow ? 3 : (s1 && s2 ? 0 : 3 - s1 - s2 - sc));
        pts.push([(x + F.o[0] + F.u[0] * a + F.v[0] * c - ox) * s, (y + F.o[1] + F.u[1] * a + F.v[1] * c - oy) * s, (z + F.o[2] + F.u[2] * a + F.v[2] * c - oz) * s]);
      }
      const order = ao[0] + ao[2] < ao[1] + ao[3] ? [1, 2, 3, 1, 3, 0] : [0, 1, 2, 0, 2, 3];
      for (const k of order) {
        const f = VOX_AO[ao[k]], P = pts[k];
        out.push(P[0], P[1], P[2], F.n[0], F.n[1], F.n[2], r * f, gg * f, b * f, pe.mat);
      }
    }
  }
  return new Float32Array(out);
}
function uploadVox(gl, data) {
  const vao = gl.createVertexArray(), vbo = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24); gl.enableVertexAttribArray(2);
  gl.bindVertexArray(null);
  return { vao, count: data.length / 10 };
}
const VOX_MODELS = {};
// each part: { grid, origin (voxel coords), pivot (block units in model space) }
function voxModel(gl, name, parts) {
  const m = { name, parts: {} };
  for (const k in parts) { const p = parts[k]; const mesh = uploadVox(gl, meshVoxGrid(p.grid, p.origin)); m.parts[k] = Object.assign(mesh, { pivot: p.pivot || [0, 0, 0] }); }
  VOX_MODELS[name] = m;
  return m;
}
// ---------------------------------------------------------------- STORMCROW interceptor
function buildJetModel(gl) {
  const W = 48, H = 18, L = 62, S = 1 / 8;
  const g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  const BODY = C(0x2C3036, MAT_PAINT), PANEL = C(0x383D45, MAT_PAINT), SEAM = C(0x1E2126, MAT_PAINT), BELLY = C(0x5B6068, MAT_PAINT);
  const ORANGE = C(0xFF6418, MAT_PAINT), WHITE = C(0xD9D4CA, MAT_PAINT), GLASS = C(0x8A5C1E, MAT_GLASS), FRAME = C(0x15171A, MAT_PAINT);
  const RING = C(0x70757C, MAT_METAL), DARK = C(0x0C0D0F, MAT_MATTE), EGLOW = C(0xFF7A26, MAT_ENGINE), STRIP = C(0xFF8C2E, MAT_GLOW);
  const cxv = 23.5;
  const st = [[0, 0.6, 6.0, 0.6, 0.6], [5, 2.0, 6.2, 1.6, 1.5], [12, 3.4, 6.6, 2.6, 2.2], [20, 4.3, 6.9, 3.0, 2.6], [30, 5.0, 6.9, 3.0, 2.9], [44, 5.6, 6.7, 2.9, 2.9], [54, 5.2, 6.5, 2.5, 2.5], [61, 4.6, 6.4, 2.3, 2.3]];
  const body = (k) => profile(st, k);
  // fuselage (superellipse cross-section)
  g.each((x, y, z) => {
    const [bw, yc, ht, hb] = body(z);
    const dx = Math.abs(x - cxv), dy = y - yc;
    const e = Math.pow(dx / bw, 2.4) + Math.pow(Math.abs(dy) / (dy > 0 ? ht : hb), 2.4);
    if (e > 1) return 0;
    if (dy < -hb * 0.35) return BELLY;
    return (z % 9 === 0 && z > 8) ? SEAM : (z > 30 && z < 44 && dy > ht * 0.5) ? PANEL : BODY;
  });
  // nose tip + orange stripe band behind radome
  const RADOME = C(0x4C5058, MAT_PAINT);
  g.each((x, y, z) => (z < 6 && g.get(x, y, z)) ? RADOME : (z === 8 && g.get(x, y, z)) ? WHITE : 0);
  // canopy bubble
  g.each((x, y, z) => {
    if (z < 11 || z > 24) return 0;
    const [bw, yc, ht] = body(z); const t = (z - 11) / 13;
    const ch = 2.7 * Math.sin(Math.PI * Math.pow(t, 0.8)), cw = 2.4 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.1)) + 0.2;
    const y0 = yc + ht - 0.6, dy = y - y0, dx = Math.abs(x - cxv);
    if (dy <= 0 || dy > ch) return 0;
    if (dx > cw * Math.sqrt(Math.max(0, 1 - (dy / ch) ** 2))) return 0;
    return z === 17 ? FRAME : GLASS;
  });
  // air intakes
  g.each((x, y, z) => {
    if (z < 18 || z > 31) return 0;
    const [bw, yc] = body(z); const dx = x - cxv;
    if (dx < bw - 0.8 || dx > bw + 2.2 || y < yc - 2 || y > yc + 1) return 0;
    if (z <= 19 && dx > bw && y > yc - 2 && y < yc + 1) return DARK;
    return z < 22 && y === yc + 1 ? ORANGE : BODY;
  });
  // leading edge extension + main delta wing
  g.each((x, y, z) => {
    const dx = x - cxv; if (dx < 0) return 0;
    const [bw, yc] = body(z);
    if (z >= 18 && z < 27) { const span = bw + (z - 18) * 0.55; if (dx <= span && Math.round(y) === Math.round(yc)) return BODY; }
    if (z < 26 || z > 51) return 0;
    const span = Math.min(22.5, 5 + (z - 26) * 0.98);
    if (dx < bw - 1 || dx > span) return 0;
    const th = dx < 12 ? 1 : 0, wy = Math.round(yc - 0.5);
    if (y < wy - th || y > wy) return 0;
    if (y === wy && dx >= span - 1.2 && z < 47) return ORANGE;
    if (y === wy && z >= 49) return SEAM;
    return y < wy ? BELLY : (dx > 9 && dx < 11 && z > 34) ? ORANGE : PANEL;
  });
  // canards
  g.each((x, y, z) => {
    const dx = x - cxv; if (z < 13 || z > 18 || dx < 0) return 0;
    const [bw, yc] = body(z);
    const span = bw + 5.2 - (z - 13) * 0.4;
    if (dx < bw - 1 || dx > span || Math.round(y) !== Math.round(yc + 1)) return 0;
    return dx > span - 1 ? ORANGE : PANEL;
  });
  // horizontal stabilizers
  g.each((x, y, z) => {
    const dx = x - cxv; if (z < 50 || z > 59 || dx < 0) return 0;
    const [bw, yc] = body(z);
    const span = bw + 1 + (z - 50) * 0.75;
    if (dx < bw - 1 || dx > Math.min(span, bw + 7.5) || Math.round(y) !== Math.round(yc - 1)) return 0;
    return PANEL;
  });
  // twin canted vertical fins
  for (let j = 0; j < 8; j++) {
    const k0 = Math.round(42 + j * 1.3), k1 = Math.round(57 - j * 0.35), fx = Math.round(cxv + 3.6 + j * 0.45);
    for (let z = k0; z <= k1; z++) { const [, yc, ht] = body(z); g.set(fx, Math.round(yc + ht - 0.4 + j), z, j >= 6 ? ORANGE : j === 3 && z > 48 ? WHITE : BODY); }
  }
  // engines: twin nozzles
  g.each((x, y, z) => {
    if (z < 55) return 0;
    const [, yc] = body(z);
    for (const ex of [cxv - 2.8, cxv + 2.8]) {
      const r = Math.hypot(x - ex, (y - yc) * 1.1);
      if (r > 2.6) continue;
      if (z >= 60) return r < 1.9 ? EGLOW : RING;
      if (z >= 57) return r < 1.7 ? DARK : RING;
      return RING;
    }
    return 0;
  });
  // glowing trim strips along the fuselage flanks
  for (let z = 22; z < 54; z++) { const [bw, yc] = body(z); g.set(cxv + bw + 0.3, yc + 1.4, z, STRIP); }
  g.mirror();
  // navigation lights (asymmetric) + strobe
  const NAVR = C(0xFF2418, MAT_GLOW), NAVG = C(0x3CFF62, MAT_GLOW), STROBE = C(0xFFFFFF, MAT_GLOW);
  for (let z = 44; z <= 47; z++) { g.set(Math.round(cxv - 22.5), 6, z, NAVR); g.set(Math.round(cxv + 22.5), 6, z, NAVG); }
  g.set(Math.round(cxv - 7.3), 16, 56, STROBE); g.set(Math.round(cxv + 7.3), 16, 56, STROBE);
  const origin = [24, 6.5, 34];
  // missiles on under-wing rails (separate part so they can be hidden when fired)
  const mg = new VoxGrid(W, H, L, S), MW = mg.c(0xE6E1D6, MAT_PAINT), MT = mg.c(0xFF6418, MAT_PAINT), MF = mg.c(0x2C3036, MAT_PAINT);
  for (const dx of [-14, -10, 10, 14]) {
    const x = Math.round(cxv + dx);
    for (let z = 32; z <= 44; z++) mg.set(x, 4, z, z <= 33 ? MT : MW);
    mg.set(x - 1, 4, 44, MF); mg.set(x + 1, 4, 44, MF); mg.set(x, 3, 44, MF);
  }
  // landing gear
  const gg = new VoxGrid(W, H, L, S), GS = gg.c(0x55595F, MAT_METAL), GT = gg.c(0x121314, MAT_MATTE);
  for (const [gx, gz] of [[cxv, 11], [cxv - 5, 36], [cxv + 5, 36]]) { for (let y = 0; y <= 3; y++) gg.set(gx, y, gz, y <= 1 ? GT : GS); gg.set(gx, 0, gz + 1, GT); gg.set(gx, 1, gz + 1, GT); }
  return voxModel(gl, 'jet', { body: { grid: g, origin }, missiles: { grid: mg, origin }, gear: { grid: gg, origin } });
}
// ---------------------------------------------------------------- MANTIS VTOL gunship
function buildGunshipModel(gl) {
  const W = 64, H = 22, L = 62, S = 1 / 8;
  const g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  const WHITE = C(0xE2DDD2, MAT_PAINT), GREY = C(0xB9B4AA, MAT_PAINT), DARK = C(0x1E2125, MAT_PAINT), RED = C(0xE0442A, MAT_PAINT);
  const GLASS = C(0x3A2A12, MAT_GLASS), BLACK = C(0x0B0C0E, MAT_MATTE), METAL = C(0x6E737A, MAT_METAL), GLOW = C(0xFFC46B, MAT_GLOW);
  const cxv = 31.5;
  const st = [[0, 1.5, 7.5, 1.5, 1.5], [6, 4.5, 7.8, 3.0, 2.6], [14, 7.0, 8.0, 4.2, 3.4], [40, 7.5, 8.0, 4.2, 3.6], [46, 4.0, 9.0, 2.2, 1.8], [61, 2.2, 9.5, 1.6, 1.3]];
  const body = (k) => profile(st, k);
  g.each((x, y, z) => {
    const [bw, yc, ht, hb] = body(z);
    const dx = Math.abs(x - cxv), dy = y - yc;
    const e = Math.pow(dx / bw, 4) + Math.pow(Math.abs(dy) / (dy > 0 ? ht : hb), 4);
    if (e > 1) return 0;
    if (dy < -hb * 0.45) return DARK;
    if (z > 16 && z < 40 && Math.abs(dy) < 0.6) return z % 6 === 0 ? RED : GREY;
    return WHITE;
  });
  // wraparound canopy
  g.each((x, y, z) => {
    if (z < 2 || z > 15) return 0;
    const [bw, yc, ht] = body(z);
    const dx = Math.abs(x - cxv), dy = y - yc;
    const e = Math.pow(dx / bw, 4) + Math.pow(Math.abs(dy) / ht, 4);
    if (e > 1 || e < 0.45 || dy < -0.5) return 0;
    return z === 9 ? DARK : GLASS;
  });
  // stub wings
  g.each((x, y, z) => {
    const dx = x - cxv; if (dx < 0 || z < 20 || z > 33) return 0;
    const sweep = (z - 20) * 0.2;
    if (dx < 6 || dx > 24 - sweep * 0 || y < 9 || y > 10) return 0;
    if (dx > 18 - (33 - z) * 0.1 + 6) return 0;
    return y === 10 && (z === 20 || z === 21) ? RED : y === 9 ? DARK : WHITE;
  });
  // rocket pods under the wings
  g.each((x, y, z) => {
    const dx = x - cxv; if (dx < 0 || z < 18 || z > 32) return 0;
    const r = Math.hypot(dx - 14, y - 7);
    if (r > 1.9) return 0;
    if (z <= 19) return r < 1.1 ? BLACK : RED;
    return DARK;
  });
  // tail fins
  for (let j = 0; j < 7; j++) for (let z = 50 + Math.round(j * 0.9); z <= 60; z++) { g.set(Math.round(cxv + 2 + j * 0.5), 11 + j, z, j >= 5 ? RED : WHITE); }
  for (let z = 52; z <= 60; z++) for (let dx = 2; dx <= 8; dx++) g.set(Math.round(cxv + dx), 9, z, dx > 6 ? RED : GREY);
  // engine exhaust vents on the back of the cabin
  for (let z = 40; z <= 43; z++) for (let dx = 2; dx <= 5; dx++) g.set(Math.round(cxv + dx), 12, z, z === 43 ? GLOW : DARK);
  g.mirror();
  const NAVR = C(0xFF2418, MAT_GLOW), NAVG = C(0x3CFF62, MAT_GLOW);
  g.set(Math.round(cxv - 7.5), 8, 12, NAVR); g.set(Math.round(cxv + 7.5), 8, 12, NAVG);
  const origin = [32, 8, 28];
  // ducted fan nacelles (tilt about the X axis at their pivot)
  const mk = (side) => {
    const n = new VoxGrid(W, H, L, S), NW = n.c(0xE2DDD2, MAT_PAINT), ND = n.c(0x1E2125, MAT_PAINT), NR = n.c(0xE0442A, MAT_PAINT), NG = n.c(0xFFB658, MAT_ENGINE);
    const fx = cxv + side * 24.5, fz = 27;
    n.each((x, y, z) => {
      const r = Math.hypot(x - fx, z - fz);
      if (r > 7.2 || r < 5.3 || y < 7 || y > 11) return 0;
      if (y === 7 && r < 5.9) return NG;
      return y === 11 ? (r > 6.7 ? NR : NW) : y === 7 ? ND : NW;
    });
    for (let y = 8; y <= 10; y++) for (let t = -1; t <= 1; t++) { n.set(fx + t, y, fz - 6.4, ND); n.set(fx + t, y, fz + 6.4, ND); }
    return { grid: n, origin, pivot: [side * 24.5 * S, 1.5 * S, -0.5 * S] };
  };
  const blades = (side) => {
    const b = new VoxGrid(W, H, L, S), BL = b.c(0x2A2D31, MAT_METAL), HUB = b.c(0xFF9A40, MAT_ENGINE);
    const fx = cxv + side * 24.5, fz = 27;
    for (let a = 0; a < 5; a++) { const an = a / 5 * TAU; for (let r = 1; r <= 5.2; r += 0.5) b.set(fx + Math.cos(an) * r, 9, fz + Math.sin(an) * r, BL); }
    b.box(Math.round(fx) - 1, 9, fz - 1, Math.round(fx), 9, fz, HUB);
    return { grid: b, origin, pivot: [side * 24.5 * S, 1.5 * S, -0.5 * S] };
  };
  // chin turret
  const tg = new VoxGrid(W, H, L, S), TD = tg.c(0x24272B, MAT_PAINT), TM = tg.c(0x6E737A, MAT_METAL), TG = tg.c(0xFF3A1E, MAT_GLOW);
  tg.each((x, y, z) => (Math.hypot(x - cxv, (y - 3.5) * 1.2, z - 8) < 2.4 ? TD : 0));
  for (let z = 1; z <= 7; z++) { tg.set(cxv - 0.5, 3, z, z === 1 ? TG : TM); tg.set(cxv + 0.5, 3, z, z === 1 ? TG : TM); }
  const pieces = { body: { grid: g, origin }, turret: { grid: tg, origin, pivot: [0, -4 * S, -19.5 * S] } };
  pieces.nacL = mk(-1); pieces.nacR = mk(1); pieces.fanL = blades(-1); pieces.fanR = blades(1);
  return voxModel(gl, 'gunship', pieces);
}
// ---------------------------------------------------------------- VIPER hover bike
function buildBikeModel(gl) {
  const W = 16, H = 17, L = 32, S = 1 / 10;
  const g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  const RED = C(0xC0162F, MAT_PAINT), DRED = C(0x7A0E1E, MAT_PAINT), BLACK = C(0x17181B, MAT_PAINT), CHROME = C(0xA6ACB2, MAT_METAL);
  const SEAT = C(0x2B2522, MAT_MATTE), GLASS = C(0x1C241F, MAT_GLASS), LIME = C(0xB6FF3B, MAT_GLOW), THR = C(0xD2FF60, MAT_ENGINE), DARK = C(0x0A0B0C, MAT_MATTE), GRILLE = C(0x2E3034, MAT_METAL);
  const cxv = 7.5;
  const st = [[0, 0.9, 6.8, 0.9, 0.9], [4, 2.6, 7.1, 2.0, 1.9], [9, 3.7, 7.5, 2.9, 2.7], [13, 3.0, 7.2, 2.3, 2.7], [19, 3.3, 7.1, 2.2, 2.9], [24, 4.4, 7.3, 2.9, 3.1], [30, 3.8, 7.3, 2.6, 2.6], [31, 3.4, 7.3, 2.3, 2.3]];
  const body = (k) => profile(st, k);
  g.each((x, y, z) => {
    const [bw, yc, ht, hb] = body(z);
    const dx = Math.abs(x - cxv), dy = y - yc;
    const e = Math.pow(dx / bw, 2.3) + Math.pow(Math.abs(dy) / (dy > 0 ? ht : hb), 2.3);
    if (e > 1) return 0;
    if (dy < -hb * 0.45) return BLACK;
    if (Math.round(dy) === 0 && dx > bw - 1 && z > 2 && z < 29) return z % 4 === 0 ? DARK : LIME;
    if (dy > ht * 0.55 && (z === 9 || z === 24)) return DRED;
    return z > 21 ? DRED : RED;
  });
  // side grilles
  for (let z = 15; z <= 21; z++) for (let y = 5; y <= 6; y++) { const [bw] = body(z); g.set(cxv + bw - 0.2, y, z, GRILLE); g.set(cxv - bw + 0.2, y, z, GRILLE); }
  // seat with a small hump
  g.each((x, y, z) => {
    if (z < 13 || z > 22) return 0;
    const [bw, yc, ht] = body(z); const dx = Math.abs(x - cxv);
    if (dx > 2.3) return 0;
    const top = Math.round(yc + ht) + (z >= 21 ? 1 : 0);
    if (y === top) return SEAT;
    if (y > top) return -1;
    return 0;
  });
  // windscreen
  for (let z = 5; z <= 10; z++) { const [, yc, ht] = body(z); const hgt = Math.min(2, Math.round((z - 4) * 0.4)); for (let y = Math.round(yc + ht); y <= Math.round(yc + ht) + hgt; y++) for (let dx = -1; dx <= 1; dx += 1) g.set(cxv + dx, y, z, GLASS); }
  // handlebars + grips
  for (let dx = -5.5; dx <= 5.5; dx += 1) g.set(cxv + dx, 11, 11, Math.abs(dx) > 4 ? BLACK : CHROME);
  g.set(cxv - 0.5, 10, 11, CHROME); g.set(cxv + 0.5, 10, 11, CHROME);
  // hover pads: dark shells with a glowing ring underneath
  g.each((x, y, z) => {
    const front = z >= 2 && z <= 9, rear = z >= 20 && z <= 29;
    if (!front && !rear) return 0;
    const cz = front ? 5.5 : 24.5, rz = front ? 4 : 5, rx = front ? 3.6 : 5.2;
    const r = Math.hypot((x - cxv) / rx, (z - cz) / rz);
    if (r > 1) return 0;
    if (y === 2) return r > 0.62 && r < 0.9 ? LIME : BLACK;
    if (y === 3) return GRILLE;
    return 0;
  });
  // rear thruster
  g.each((x, y, z) => {
    if (z < 29) return 0;
    const r = Math.hypot(x - cxv, (y - 7.3) * 1.05);
    if (r > 3.1) return 0;
    if (z === 31) return r < 2.1 ? THR : CHROME;
    return r < 2.1 ? DARK : CHROME;
  });
  // blaster pods on both flanks
  for (let z = 5; z <= 12; z++) { g.set(cxv + 4.2, 5, z, z < 7 ? CHROME : BLACK); g.set(cxv - 4.2, 5, z, z < 7 ? CHROME : BLACK); }
  // rear fins
  for (let z = 22; z <= 28; z++) { const k = z - 22; g.set(cxv + 4.4 + k * 0.12, 9 + Math.floor(k / 3), z, k > 4 ? LIME : RED); g.set(cxv - 4.4 - k * 0.12, 9 + Math.floor(k / 3), z, k > 4 ? LIME : RED); }
  const HEAD = C(0xFFF1C4, MAT_GLOW);
  g.set(cxv - 0.5, 7, 0, HEAD); g.set(cxv + 0.5, 7, 0, HEAD);
  return voxModel(gl, 'bike', { body: { grid: g, origin: [8, 2, 16] } });
}
// ---------------------------------------------------------------- WRAITH flying-wing bomber
function buildBomberModel(gl) {
  const W = 72, H = 14, L = 46, S = 1 / 8;
  const g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  const CHAR = C(0x26282C, MAT_PAINT), CHAR2 = C(0x1D1F22, MAT_PAINT), EDGE = C(0x3C3F45, MAT_PAINT), UNDER = C(0x33363B, MAT_PAINT);
  const AMBER = C(0xFFA83A, MAT_GLOW), GLASS = C(0x8A5C1E, MAT_GLASS), DARK = C(0x0B0C0D, MAT_MATTE), EG = C(0xFF8A30, MAT_ENGINE), METAL = C(0x6A6E74, MAT_METAL);
  const cxv = 35.5;
  const le = (ax) => 2 + ax * 0.78;
  const te = (ax) => { const t = (ax / 9) % 2; return 38 - Math.abs(t - 1) * 7 - ax * 0.12; };
  g.each((x, y, z) => {
    const ax = Math.abs(x - cxv);
    if (ax > 35) return 0;
    const a = le(ax), b = te(ax);
    if (z < a || z > b) return 0;
    const u = (z - a) / Math.max(1, b - a);
    const th = Math.max(1.2, 5.6 - ax * 0.16) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15 + 0.02)), 0.55);
    const yc = 6;
    if (y < yc - th * 0.45 || y > yc + th * 0.55) return 0;
    if (y < yc - th * 0.2) return UNDER;
    if (z - a < 1.2) return EDGE;
    if (ax > 6 && ax < 7 && y > yc) return CHAR2;
    return (Math.floor(ax) % 11 === 0 && ax > 3) ? CHAR2 : CHAR;
  });
  // amber light strip just behind the leading edge
  for (let ax = 1; ax <= 34; ax++) { const z = Math.round(le(ax) + 1.6); for (const sx of [-1, 1]) { const x = Math.round(cxv + sx * (ax - 0.5)); for (let y = 13; y >= 0; y--) if (g.get(x, y, z)) { g.set(x, y, z, AMBER); break; } } }
  // cockpit bump
  g.each((x, y, z) => {
    const dx = Math.abs(x - cxv); if (z < 6 || z > 16) return 0;
    const t = (z - 6) / 10, ch = 2.6 * Math.sin(Math.PI * t), cw = 3.2 * Math.sin(Math.PI * Math.min(1, t + 0.15));
    const dy = y - 8.6; if (dy < 0 || dy > ch || dx > cw * Math.sqrt(Math.max(0, 1 - (dy / Math.max(ch, 0.1)) ** 2))) return 0;
    return z === 11 ? DARK : GLASS;
  });
  // four dorsal engine humps with glowing exhaust slots
  for (const ex of [-11.5, -6, 6, 11.5]) {
    g.each((x, y, z) => {
      const dx = x - (cxv + ex); if (Math.abs(dx) > 2.2 || z < 18 || z > 33) return 0;
      const t = (z - 18) / 15, hh = 2.4 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1));
      if (y < 8 || y > 8 + hh) return 0;
      if (z >= 32) return EG;
      if (z <= 19) return DARK;
      return y > 8 + hh - 1 ? EDGE : CHAR;
    });
  }
  // nav lights on the wingtips
  const NR = C(0xFF2418, MAT_GLOW), NG = C(0x3CFF62, MAT_GLOW);
  for (let z = 28; z <= 29; z++) { g.set(Math.round(cxv - 32.5), 6, z, NR); g.set(Math.round(cxv + 32.5), 6, z, NG); }
  const origin = [36, 6, 22];
  // bomb bay doors (hidden while the bay is open)
  const bay = new VoxGrid(W, H, L, S), BD = bay.c(0x2E3136, MAT_PAINT), BL = bay.c(0xFFA83A, MAT_GLOW);
  for (let z = 17; z <= 27; z++) for (let dx = -2.5; dx <= 2.5; dx += 1) bay.set(cxv + dx, 3, z, (z === 17 || z === 27) ? BL : BD);
  g.each((x, y, z) => (Math.abs(x - cxv) <= 3 && z >= 17 && z <= 27 && y === 3) ? DARK : 0);
  const gear = new VoxGrid(W, H, L, S), GS = gear.c(0x55595F, MAT_METAL), GT = gear.c(0x121314, MAT_MATTE);
  for (const [gx, gz] of [[cxv, 10], [cxv - 7, 26], [cxv + 7, 26]]) { for (let y = 0; y <= 3; y++) gear.set(gx, y, gz, y <= 1 ? GT : GS); gear.set(gx, 0, gz + 1, GT); gear.set(gx, 1, gz + 1, GT); }
  return voxModel(gl, 'bomber', { body: { grid: g, origin }, bay: { grid: bay, origin }, gear: { grid: gear, origin } });
}
// ---------------------------------------------------------------- BASTION hover tank
function buildTankModel(gl) {
  const W = 40, H = 22, L = 64, S = 1 / 8;
  const g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  const STEEL = C(0x535B4C, MAT_PAINT), STEEL2 = C(0x454C3F, MAT_PAINT), DARK = C(0x23271F, MAT_PAINT), BONE = C(0xD8D0BE, MAT_PAINT);
  const AMBER = C(0xFFA83A, MAT_GLOW), PAD = C(0xFFB050, MAT_ENGINE), METAL = C(0x6E7268, MAT_METAL), BLACK = C(0x0C0D0C, MAT_MATTE), RED = C(0xFF3322, MAT_GLOW);
  const cxv = 19.5;
  // hull: sloped glacis, flat deck, sloped rear
  g.each((x, y, z) => {
    if (z < 10 || z > 62) return 0;
    const dx = Math.abs(x - cxv);
    const top = z < 20 ? 6 + (z - 10) * 0.5 : z > 54 ? 11 - (z - 54) * 0.35 : 11;
    const bot = z < 14 ? 5 - (z - 10) * 0.25 : 4;
    const bw = z < 14 ? 11 + (z - 10) * 0.5 : 13;
    if (dx > bw || y < bot || y > top) return 0;
    if (dx > bw - 1 && y > top - 1) return DARK;
    if (y <= bot + 0.5) return DARK;
    if (z >= 56 && y >= 7 && y <= 9 && dx < 8) return (z % 2) ? BLACK : METAL;
    if (dx > bw - 3 && dx < bw - 1.5 && y > top - 1) return BONE;
    return (Math.floor(z / 8) % 2) ? STEEL : STEEL2;
  });
  // four hover pods with glowing rings
  for (const [px, pz] of [[cxv - 13, 18], [cxv + 13, 18], [cxv - 13, 52], [cxv + 13, 52]]) {
    g.each((x, y, z) => {
      const r = Math.hypot(x - px, z - pz); if (r > 5 || y < 1 || y > 7) return 0;
      if (y === 1) return r > 3 && r < 4.3 ? PAD : BLACK;
      if (y === 7) return r > 4 ? BONE : STEEL;
      return r > 4.2 ? STEEL2 : DARK;
    });
  }
  // headlights + warning lamps
  g.set(cxv - 6, 7, 10, AMBER); g.set(cxv + 6, 7, 10, AMBER); g.set(cxv - 7, 7, 10, AMBER); g.set(cxv + 7, 7, 10, AMBER);
  g.set(cxv - 12, 11, 60, RED); g.set(cxv + 12, 11, 60, RED);
  const origin = [20, 2, 32];
  // turret (yaws about its centre)
  const t = new VoxGrid(W, H, L, S), TS = t.c(0x5A6352, MAT_PAINT), TD = t.c(0x2A2F26, MAT_PAINT), TB = t.c(0xD8D0BE, MAT_PAINT), TG = t.c(0x1E2A22, MAT_GLASS), TA = t.c(0xFFA83A, MAT_GLOW);
  t.each((x, y, z) => {
    const dx = x - cxv, dz = z - 31.5, e = Math.pow(Math.abs(dx) / 9.5, 2.2) + Math.pow(Math.abs(dz) / 10.5, 2.2);
    if (e > 1 || y < 12) return 0;
    const top = 16 - e * 1.6;
    if (y > top) return 0;
    if (y === 12) return TD;
    if (e > 0.8 && y > top - 1) return TB;
    return TS;
  });
  t.box(Math.round(cxv) + 3, 16, 36, Math.round(cxv) + 5, 17, 39, TD); t.box(Math.round(cxv) + 3, 17, 36, Math.round(cxv) + 5, 17, 36, TG);
  for (let y = 17; y <= 21; y++) t.set(Math.round(cxv) - 5, y, 40, y === 21 ? TA : TD);
  // coaxial gun stub
  for (let z = 22; z <= 24; z++) t.set(Math.round(cxv) + 4, 14, z, TD);
  // twin barrel (pitches about the mantlet)
  const b = new VoxGrid(W, H, L, S), BM = b.c(0x2A2E27, MAT_PAINT), BK = b.c(0x151714, MAT_METAL), BB = b.c(0xD8D0BE, MAT_PAINT), BGL = b.c(0xFFB050, MAT_GLOW);
  b.box(Math.round(cxv) - 2, 13, 22, Math.round(cxv) + 1, 15, 24, BM);
  for (const sx of [-1, 0]) for (let z = 1; z <= 21; z++) b.set(Math.round(cxv) + sx, 14, z, z <= 2 ? BB : z === 3 ? BGL : BK);
  b.box(Math.round(cxv) - 1, 13, 4, Math.round(cxv), 15, 5, BM);
  return voxModel(gl, 'tank', { body: { grid: g, origin }, turret: { grid: t, origin, pivot: [0, 1.5, 0] }, barrel: { grid: b, origin, pivot: [0, 1.5625, -1.0] } });
}
function buildVehicleModels(gl) { buildJetModel(gl); buildGunshipModel(gl); buildBikeModel(gl); buildBomberModel(gl); buildTankModel(gl); }
