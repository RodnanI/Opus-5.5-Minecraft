// ============================================================================
//  Section mesher: padded 18^3 blocks + light -> packed vertex buffers
//  Vertex (16 bytes): int16 x,y,z (1/32 block), int16 light(sky6|blk6<<6|ao2<<12)
//                     uint32 d0: layer10 | u5<<10 | v5<<15 | face3<<20 | tint2<<23 | wave2<<25 | anim2<<27 | emis1<<29
//                     uint32 d1: tint rgb
// ============================================================================
const P = 18, P2 = 324, P3 = 5832;
const NOFF = [1, -1, P2, -P2, P, -P];
const FR = [-P, P, 1, 1, 1, -1];
const FU = [P2, P2, -P, P, P2, P2];
const CSU = [-1, 1, 1, -1], CSV = [-1, -1, 1, 1];
const CUBE_V = [
  1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1,
  0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0,
  0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0,
  0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
  0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
  1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0];
const CUBE_U = [0, 16, 16, 0], CUBE_VV = [16, 16, 0, 0];
const OPAQUE_FAST = new Uint8Array(MAXB);
for (let i = 0; i < MAXB; i++) OPAQUE_FAST[i] = OPAQUE[i] || LEAVES[i];

class MeshBuf {
  constructor(cap) { this.cap = cap; this.alloc(cap); this.n = 0; }
  alloc(cap) { const nb = new ArrayBuffer(cap * 16); if (this.buf) new Uint8Array(nb).set(new Uint8Array(this.buf, 0, this.n * 16)); this.buf = nb; this.i16 = new Int16Array(nb); this.u32 = new Uint32Array(nb); this.cap = cap; }
  v(x, y, z, l, d0, d1) {
    if (this.n >= this.cap) this.alloc(this.cap * 2);
    const k = this.n++, s = k << 3;
    this.i16[s] = x; this.i16[s + 1] = y; this.i16[s + 2] = z; this.i16[s + 3] = l;
    this.u32[(k << 2) + 2] = d0; this.u32[(k << 2) + 3] = d1;
  }
  take() { return this.buf.slice(0, this.n * 16); }
}

class Mesher {
  constructor() {
    this.bufs = [new MeshBuf(16384), new MeshBuf(8192), new MeshBuf(4096)];
    this.visited = new Uint8Array(4096); this.stack = new Int32Array(4096);
    this.lp = new Int32Array(4); this.br = new Int32Array(4); this.hx = new Float32Array(4);
    this.encl = new Uint8Array(P3);
  }
  // padded cell q is surrounded on all six sides by leaves or opaque blocks (cached per mesh call)
  enclosed(q) {
    const e = this.encl[q];
    if (e) return e === 2;
    const x = q % P, z = ((q / P) | 0) % P, y = (q / P2) | 0, pb = this.pb;
    let r = 1;
    if (x > 0 && x < 17 && y > 0 && y < 17 && z > 0 && z < 17 &&
      AOCC[pb[q + 1] & 4095] && AOCC[pb[q - 1] & 4095] && AOCC[pb[q + P] & 4095] && AOCC[pb[q - P] & 4095] && AOCC[pb[q + P2] & 4095] && AOCC[pb[q - P2] & 4095]) r = 2;
    this.encl[q] = r;
    return r === 2;
  }
  mesh(pb, pl, tints, ox, oy, oz, opts) {
    this.pb = pb; this.pl = pl; this.tints = tints; this.ox = ox; this.oy = oy; this.oz = oz;
    const fast = !!(opts && opts.fastLeaves);
    this.fast = fast; this.op = fast ? OPAQUE_FAST : OPAQUE;
    this.smooth = !(opts && opts.smooth === false);
    this.encl.fill(0);
    for (const b of this.bufs) b.n = 0;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) {
      let p = (y + 1) * P2 + (z + 1) * P + 1;
      for (let x = 0; x < 16; x++, p++) {
        const v = pb[p], id = v & 4095;
        if (id === 0) continue;
        this.block(x, y, z, p, id, v);
      }
    }
    return { layers: this.bufs.map(b => b.take()), counts: this.bufs.map(b => b.n), vis: this.visibility() };
  }
  tintFor(id, x, z) {
    const t = TINT[id];
    if (t === T_GRASS) return this.tints.grass[z * 16 + x];
    if (t === T_FOLIAGE) return this.tints.foliage[z * 16 + x];
    if (t === T_WATER) return this.tints.water[z * 16 + x];
    if (t === T_COLOR) return COLOR[id];
    return 0xFFFFFF;
  }
  flatLight(i) { const l = this.pl[i]; return ((l >> 4) * 4) | (((l & 15) * 4) << 6) | (3 << 12); }
  maxLight(a, b) { const la = this.pl[a], lb = this.pl[b]; const s = Math.max(la >> 4, lb >> 4), k = Math.max(la & 15, lb & 15); return (s * 4) | ((k * 4) << 6) | (3 << 12); }
  // ---- full cube face with smooth light + AO
  cubeFace(M, f, x, y, z, p, tex, rot, tmode, tint, wave, anim, emis, topH) {
    const pb = this.pb, pl = this.pl, lp = this.lp, br = this.br;
    let q = p + NOFF[f];
    const qb = pb[q] & 4095;
    let lq = q;
    if (OPACITY[qb] >= 15 && !OPAQUE[qb]) lq = q + P2 < P3 ? q + P2 : q;
    if (this.smooth) {
      for (let k = 0; k < 4; k++) {
        const s1 = q + FR[f] * CSU[k], s2 = q + FU[f] * CSV[k], c = s1 + FU[f] * CSV[k];
        const b1 = pb[s1] & 4095, b2 = pb[s2] & 4095, bc = pb[c] & 4095;
        const o1 = AOCC[b1], o2 = AOCC[b2], oc = AOCC[bc];
        const ao = (o1 && o2) ? 0 : 3 - o1 - o2 - oc;
        let sky = pl[lq] >> 4, blk = pl[lq] & 15, n = 1;
        const O1 = OPAQUE[b1], O2 = OPAQUE[b2];
        if (!O1) { sky += pl[s1] >> 4; blk += pl[s1] & 15; n++; }
        if (!O2) { sky += pl[s2] >> 4; blk += pl[s2] & 15; n++; }
        if (!OPAQUE[bc] && !(O1 && O2)) { sky += pl[c] >> 4; blk += pl[c] & 15; n++; }
        const sv = (sky * 4 / n) | 0, bv = (blk * 4 / n) | 0;
        lp[k] = sv | (bv << 6) | (ao << 12); br[k] = ao * 18 + sv + bv;
      }
    } else {
      const l = this.flatLight(lq); lp[0] = lp[1] = lp[2] = lp[3] = l; br[0] = br[1] = br[2] = br[3] = 0;
    }
    const flip = br[0] + br[2] < br[1] + br[3];
    const base = tex | (f << 20) | (tmode << 23) | (anim << 27) | (emis << 29);
    const bx = x * PS, by = y * PS, bz = z * PS, th = topH * 2;
    for (let j = 0; j < 4; j++) {
      const k = flip ? (j + 1) & 3 : j;
      const o = f * 12 + k * 3;
      const uvk = (k + rot) & 3;
      const d0 = base | (CUBE_U[uvk] << 10) | (CUBE_VV[uvk] << 15) | (wave << 25);
      M.v(bx + CUBE_V[o] * PS, by + (CUBE_V[o + 1] ? th : 0), bz + CUBE_V[o + 2] * PS, lp[k], d0, tint);
    }
  }
  // ---- generic axis-aligned box face; coordinates in 1/16
  boxFace(M, f, x, y, z, x0, y0, z0, x1, y1, z1, tex, light, tmode, tint, anim, emis, rot, wave) {
    let ax, ay, az, bx2, by2, bz2, cx, cy, cz, dx, dy, dz, uL, uR, vB, vT;
    switch (f) {
      case 0: ax = x1; ay = y0; az = z1; bx2 = x1; by2 = y0; bz2 = z0; cx = x1; cy = y1; cz = z0; dx = x1; dy = y1; dz = z1; uL = 16 - z1; uR = 16 - z0; vB = 16 - y0; vT = 16 - y1; break;
      case 1: ax = x0; ay = y0; az = z0; bx2 = x0; by2 = y0; bz2 = z1; cx = x0; cy = y1; cz = z1; dx = x0; dy = y1; dz = z0; uL = z0; uR = z1; vB = 16 - y0; vT = 16 - y1; break;
      case 2: ax = x0; ay = y1; az = z1; bx2 = x1; by2 = y1; bz2 = z1; cx = x1; cy = y1; cz = z0; dx = x0; dy = y1; dz = z0; uL = x0; uR = x1; vB = z1; vT = z0; break;
      case 3: ax = x0; ay = y0; az = z0; bx2 = x1; by2 = y0; bz2 = z0; cx = x1; cy = y0; cz = z1; dx = x0; dy = y0; dz = z1; uL = x0; uR = x1; vB = 16 - z0; vT = 16 - z1; break;
      case 4: ax = x0; ay = y0; az = z1; bx2 = x1; by2 = y0; bz2 = z1; cx = x1; cy = y1; cz = z1; dx = x0; dy = y1; dz = z1; uL = x0; uR = x1; vB = 16 - y0; vT = 16 - y1; break;
      default: ax = x1; ay = y0; az = z0; bx2 = x0; by2 = y0; bz2 = z0; cx = x0; cy = y1; cz = z0; dx = x1; dy = y1; dz = z0; uL = 16 - x1; uR = 16 - x0; vB = 16 - y0; vT = 16 - y1; break;
    }
    uL = clamp(Math.round(uL), 0, 16); uR = clamp(Math.round(uR), 0, 16); vB = clamp(Math.round(vB), 0, 16); vT = clamp(Math.round(vT), 0, 16);
    const U = [uL, uR, uR, uL], V = [vB, vB, vT, vT];
    const base = tex | (f << 20) | (tmode << 23) | (anim << 27) | (emis << 29);
    const X = x * PS, Y = y * PS, Z = z * PS;
    const pts = [ax, ay, az, bx2, by2, bz2, cx, cy, cz, dx, dy, dz];
    for (let k = 0; k < 4; k++) {
      const uvk = (k + (rot || 0)) & 3;
      const w = wave && pts[k * 3 + 1] > 8 ? wave : 0;
      M.v(X + Math.round(pts[k * 3] * 2), Y + Math.round(pts[k * 3 + 1] * 2), Z + Math.round(pts[k * 3 + 2] * 2), light, base | (U[uvk] << 10) | (V[uvk] << 15) | (w << 25), tint);
    }
  }
  // emit a box with per-face culling on boundaries; texFn(face) -> tex
  box(M, x, y, z, p, x0, y0, z0, x1, y1, z1, texs, tmode, tint, anim, emis, skipMask) {
    const pb = this.pb;
    for (let f = 0; f < 6; f++) {
      if (skipMask && (skipMask >> f) & 1) continue;
      const onB = (f === 0 && x1 >= 16) || (f === 1 && x0 <= 0) || (f === 2 && y1 >= 16) || (f === 3 && y0 <= 0) || (f === 4 && z1 >= 16) || (f === 5 && z0 <= 0);
      let li = p;
      if (onB) { const n = p + NOFF[f]; const nid = pb[n] & 4095; if (this.op[nid]) continue; li = n; }
      else if (OPACITY[pb[p] & 4095] >= 15) li = p + NOFF[f];
      const tex = typeof texs === 'number' ? texs : texs[f];
      this.boxFace(M, f, x, y, z, x0, y0, z0, x1, y1, z1, tex, this.flatLight(li), tmode, tint, anim, emis, 0, 0);
    }
  }
  // double sided free quad (plants), coords in 1/32 block units relative to block origin
  plantQuad(M, x, y, z, ax, az, bx, bz, y0, y1, tex, light, tmode, tint, wave, anim, emis) {
    const X = x * PS, Y = y * PS, Z = z * PS;
    const base = tex | (6 << 20) | (tmode << 23) | (anim << 27) | (emis << 29);
    const wv = wave << 25;
    const d = [base | (0 << 10) | (16 << 15), base | (16 << 10) | (16 << 15), base | (16 << 10) | (0 << 15) | wv, base | (0 << 10) | (0 << 15) | wv];
    M.v(X + ax, Y + y0, Z + az, light, d[0], tint); M.v(X + bx, Y + y0, Z + bz, light, d[1], tint);
    M.v(X + bx, Y + y1, Z + bz, light, d[2], tint); M.v(X + ax, Y + y1, Z + az, light, d[3], tint);
    M.v(X + bx, Y + y0, Z + bz, light, d[0], tint); M.v(X + ax, Y + y0, Z + az, light, d[1], tint);
    M.v(X + ax, Y + y1, Z + az, light, d[2], tint); M.v(X + bx, Y + y1, Z + bz, light, d[3], tint);
  }
  block(x, y, z, p, id, v) {
    const pb = this.pb, meta = v >>> 12, shape = SHAPE[id];
    let layer = LAYER[id];
    if (this.fast && LEAVES[id]) layer = L_SOLID;
    const M = this.bufs[layer];
    const emis = EMISSIVE[id], anim = ANIM[id];
    const tb = id * 6;
    switch (shape) {
      case R_CUBE: {
        const op = this.op;
        let tint = this.tintFor(id, x, z);
        let tm = TINT[id] ? 1 : 0;
        if (LEAVES[id]) {
          // subtle per-block brightness variation breaks up flat-looking canopies
          const hv = hash3(0x1EAF, this.ox + x, this.oy + y, this.oz + z), f = tm ? 0.92 + (hv & 255) / 255 * 0.15 : 0.88 + (hv & 255) / 255 * 0.12;
          tint = (Math.min(255, ((tint >> 16) & 255) * f) << 16) | (Math.min(255, ((tint >> 8) & 255) * f) << 8) | Math.min(255, (tint & 255) * f);
          tm = 1;
        }
        const wave = WAVE[id] === 1 ? 1 : 0;
        const axis = AXISB[id] ? meta & 3 : 0, facing = FACINGB[id] ? FACING_FACE[meta & 3] : -1;
        // fancy leaves: faces towards a leaf that is itself buried in the canopy are only visible through
        // two aligned holes, so they are skipped (a large share of foliage overdraw)
        const leafCull = LEAVES[id] && !this.fast;
        for (let f = 0; f < 6; f++) {
          const q = p + NOFF[f], nv = pb[q], nid = nv & 4095;
          if (op[nid]) continue;
          if (CULLSELF[id] && nid === id) continue;
          if (leafCull && LEAVES[nid] && this.enclosed(q)) continue;
          let tex = TEX[tb + f], rot = 0, fm = tm;
          if (axis) {
            const endFace = axis === 1 ? (f === 0 || f === 1) : (f === 4 || f === 5);
            tex = endFace ? TEX[tb + 2] : TEX[tb + 0];
            rot = endFace ? 0 : ((axis === 1 && f >= 2) || (axis === 2 && f <= 1)) ? 1 : 0;
          } else if (f === facing && TEXF[id] !== 0xFFFF) tex = TEXF[id];
          if (MASKSIDE[id]) {
            if (f === 3) fm = 0;
            else if (f !== 2) {
              const a = pb[p + P2] & 4095;
              if (a === B.snow_layer || a === B.snow) { tex = TEXX[tb / 6 * 4]; fm = 0; } else fm = 2;
            } else rot = hash3(0x51, this.ox + x, this.oy + y, this.oz + z) & 3;
          }
          this.cubeFace(M, f, x, y, z, p, tex, rot, fm, tint, wave, anim, emis, 16);
        }
        break;
      }
      case R_SHORT: {
        const tex6 = meta > 0 && id === B.farmland ? TEXX[id * 4] : TEX[tb + 2];
        for (let f = 0; f < 6; f++) {
          const nid = pb[p + NOFF[f]] & 4095;
          if (f !== 2 && this.op[nid]) continue;
          if (f === 2 && this.op[nid]) continue;
          this.cubeFace(M, f, x, y, z, p, f === 2 ? tex6 : TEX[tb + f], 0, 0, 0xFFFFFF, 0, 0, 0, 15);
        }
        break;
      }
      case R_CROSS: {
        const tint = this.tintFor(id, x, z), tm = TINT[id] ? 1 : 0;
        const h = hash3(0x9E3, this.ox + x, this.oy + y, this.oz + z);
        const hang = id === B.weeping_vines || id === B.twisting_vines;
        const offx = PLANT[id] && id !== B.sugar_cane && id !== B.cactus && !WLOG[id] && !hang ? ((h & 7) - 3) : 0, offz = PLANT[id] && id !== B.sugar_cane && !WLOG[id] && !hang ? (((h >> 3) & 7) - 3) : 0;
        const light = this.flatLight(p);
        const a = 5 + offx, b = 27 + offx, c = 5 + offz, d = 27 + offz;
        const L2 = WLOG[id] ? this.bufs[L_CUTOUT] : M;
        const tex = METATEX[id] ? TEXX[id * 4 + (meta & 3)] : TEX[tb];
        const wv = WAVE[id] ? 2 : 0;
        this.plantQuad(L2, x, y, z, a, c, b, d, 0, PS, tex, light, tm, tint, wv, anim, emis);
        this.plantQuad(L2, x, y, z, a, d, b, c, 0, PS, tex, light, tm, tint, wv, anim, emis);
        if (WLOG[id]) this.liquid(x, y, z, p, B.water, B.water);
        break;
      }
      case R_FLAT: {
        // ground cover (pink petals): one quad just above the block below, randomly rotated
        const light = this.flatLight(p), rot = hash3(0x7E7, this.ox + x, this.oy + y, this.oz + z) & 3;
        this.boxFace(this.bufs[L_CUTOUT], 2, x, y, z, 0, 0, 0, 16, 0.25, 16, TEX[tb], light, 0, 0xFFFFFF, 0, 0, rot, 0);
        break;
      }
      case R_CAMPFIRE: {
        const logT = TEX[tb], litT = TEXX[id * 4 + 1], fireT = TEXX[id * 4];
        const C = this.bufs[L_CUTOUT];
        const t6 = [logT, logT, litT, logT, logT, logT];
        // two logs along x resting on two logs along z, all cut across
        this.box(C, x, y, z, p, 1, 0, 3, 15, 4, 7, t6, 0, 0xFFFFFF, 0, 0);
        this.box(C, x, y, z, p, 1, 0, 9, 15, 4, 13, t6, 0, 0xFFFFFF, 0, 0);
        this.box(C, x, y, z, p, 3, 3, 1, 7, 7, 15, t6, 0, 0xFFFFFF, 0, 0);
        this.box(C, x, y, z, p, 9, 3, 1, 13, 7, 15, t6, 0, 0xFFFFFF, 0, 0);
        const fl = (60) | (60 << 6) | (3 << 12);
        this.plantQuad(C, x, y, z, 5, 5, 27, 27, 4, 34, fireT, fl, 0, 0xFFFFFF, 0, 2, 1);
        this.plantQuad(C, x, y, z, 5, 27, 27, 5, 4, 34, fireT, fl, 0, 0xFFFFFF, 0, 2, 1);
        break;
      }
      case R_CROP: {
        let tex;
        if (id === B.nether_wart) tex = TEXX[id * 4 + (meta === 0 ? 0 : meta < 3 ? 1 : 2)];
        else tex = TEXX[id * 4 + Math.min(3, meta >> 1)];
        const light = this.flatLight(p);
        const y0 = -2, y1 = PS - 2;
        for (const o of [8, 24]) {
          this.plantQuad(M, x, y, z, o, 0, o, PS, y0, y1, tex, light, 0, 0xFFFFFF, 2, 0, 0);
          this.plantQuad(M, x, y, z, 0, o, PS, o, y0, y1, tex, light, 0, 0xFFFFFF, 2, 0, 0);
        }
        break;
      }
      case R_LIQUID: this.liquid(x, y, z, p, id, v); break;
      case R_SLAB: {
        const t = [TEX[tb], TEX[tb + 1], TEX[tb + 2], TEX[tb + 3], TEX[tb + 4], TEX[tb + 5]];
        if (meta === 1) this.box(M, x, y, z, p, 0, 8, 0, 16, 16, 16, t, 0, 0xFFFFFF, 0, 0);
        else this.box(M, x, y, z, p, 0, 0, 0, 16, 8, 16, t, 0, 0xFFFFFF, 0, 0);
        break;
      }
      case R_STAIRS: {
        const t = [TEX[tb], TEX[tb + 1], TEX[tb + 2], TEX[tb + 3], TEX[tb + 4], TEX[tb + 5]];
        const f = meta & 3, up = (meta & 4) !== 0;
        if (up) this.box(M, x, y, z, p, 0, 8, 0, 16, 16, 16, t, 0, 0xFFFFFF, 0, 0);
        else this.box(M, x, y, z, p, 0, 0, 0, 16, 8, 16, t, 0, 0xFFFFFF, 0, 0);
        const sy0 = up ? 0 : 8, sy1 = up ? 8 : 16;
        let bx0 = 0, bx1 = 16, bz0 = 0, bz1 = 16;
        if (f === 0) bz1 = 8; else if (f === 1) bx0 = 8; else if (f === 2) bz0 = 8; else bx1 = 8;
        this.box(M, x, y, z, p, bx0, sy0, bz0, bx1, sy1, bz1, t, 0, 0xFFFFFF, 0, 0, up ? 4 : 8);
        break;
      }
      case R_TORCH: {
        const tex = TEX[tb], light = this.flatLight(p);
        const MT = this.bufs[L_CUTOUT];
        const X = x * PS, Y = y * PS, Z = z * PS;
        let dxw = 0, dzw = 0, lift = 0;
        if (meta > 0) { const f = (meta - 1) & 3; dxw = FACING_DX[f]; dzw = FACING_DZ[f]; lift = 7; }
        // 4 sides + top in 1/32 units; torch spans x 14..18, z 14..18, y 0..20
        const tilt = 8;
        const P0 = (px, py, pz) => [X + px - dxw * 16 + (py > 0 ? dxw * tilt * py / 20 : 0) + (meta > 0 ? dxw * 3 : 0), Y + py + lift, Z + pz - dzw * 16 + (py > 0 ? dzw * tilt * py / 20 : 0) + (meta > 0 ? dzw * 3 : 0)];
        const fx = meta > 0 ? 1 : 0;
        void fx;
        const faces = [
          [[18, 0, 18], [18, 0, 14], [18, 20, 14], [18, 20, 18], 0],
          [[14, 0, 14], [14, 0, 18], [14, 20, 18], [14, 20, 14], 1],
          [[14, 0, 18], [18, 0, 18], [18, 20, 18], [14, 20, 18], 4],
          [[18, 0, 14], [14, 0, 14], [14, 20, 14], [18, 20, 14], 5]];
        for (const fc of faces) {
          const base = tex | (fc[4] << 20) | (1 << 29);
          const uv = [[7, 16], [9, 16], [9, 6], [7, 6]];
          for (let k = 0; k < 4; k++) { const q = P0(fc[k][0], fc[k][1], fc[k][2]); MT.v(Math.round(q[0]), Math.round(q[1]), Math.round(q[2]), light, base | (uv[k][0] << 10) | (uv[k][1] << 15), 0xFFFFFF); }
        }
        const topv = [[14, 20, 18], [18, 20, 18], [18, 20, 14], [14, 20, 14]], tuv = [[7, 8], [9, 8], [9, 6], [7, 6]];
        for (let k = 0; k < 4; k++) { const q = P0(topv[k][0], topv[k][1], topv[k][2]); MT.v(Math.round(q[0]), Math.round(q[1]), Math.round(q[2]), light, tex | (2 << 20) | (1 << 29) | (tuv[k][0] << 10) | (tuv[k][1] << 15), 0xFFFFFF); }
        break;
      }
      case R_FENCE: {
        const kind = FENCEK[id];
        const tex = TEX[tb];
        const conn = (f) => {
          const nv = pb[p + NOFF[f]], nid = nv & 4095;
          if (SHAPE[nid] === R_FENCE) return kind === 3 ? FENCEK[nid] === 3 : (FENCEK[nid] === kind || (kind !== 3 && FENCEK[nid] !== 3 && FENCEK[nid] !== 2 && kind !== 2));
          if (SHAPE[nid] === R_GATE && kind === 1) return true;
          return OPAQUE[nid] === 1;
        };
        const cx = conn(0), cnx = conn(1), cz = conn(4), cnz = conn(5);
        if (kind === 3) {
          const tall = !(cx && cnx && !cz && !cnz) && !(cz && cnz && !cx && !cnx);
          if (tall) this.box(M, x, y, z, p, 4, 0, 4, 12, 16, 12, tex, 0, 0xFFFFFF, 0, 0);
          if (cx) this.box(M, x, y, z, p, tall ? 12 : 8, 0, 5, 16, 14, 11, tex, 0, 0xFFFFFF, 0, 0);
          if (cnx) this.box(M, x, y, z, p, 0, 0, 5, tall ? 4 : 8, 14, 11, tex, 0, 0xFFFFFF, 0, 0);
          if (cz) this.box(M, x, y, z, p, 5, 0, tall ? 12 : 8, 11, 14, 16, tex, 0, 0xFFFFFF, 0, 0);
          if (cnz) this.box(M, x, y, z, p, 5, 0, 0, 11, 14, tall ? 4 : 8, tex, 0, 0xFFFFFF, 0, 0);
        } else {
          this.box(M, x, y, z, p, 6, 0, 6, 10, 16, 10, tex, 0, 0xFFFFFF, 0, 0);
          for (const [yy0, yy1] of [[6, 9], [12, 15]]) {
            if (cx) this.box(M, x, y, z, p, 10, yy0, 7, 16, yy1, 9, tex, 0, 0xFFFFFF, 0, 0);
            if (cnx) this.box(M, x, y, z, p, 0, yy0, 7, 6, yy1, 9, tex, 0, 0xFFFFFF, 0, 0);
            if (cz) this.box(M, x, y, z, p, 7, yy0, 10, 9, yy1, 16, tex, 0, 0xFFFFFF, 0, 0);
            if (cnz) this.box(M, x, y, z, p, 7, yy0, 0, 9, yy1, 6, tex, 0, 0xFFFFFF, 0, 0);
          }
        }
        break;
      }
      case R_GATE: {
        const tex = TEX[tb], f = meta & 3, open = (meta & 4) !== 0;
        const alongX = f === 0 || f === 2;
        const bx = (a, b, c, d, e, g) => alongX ? this.box(M, x, y, z, p, a, b, c, d, e, g, tex, 0, 0xFFFFFF, 0, 0) : this.box(M, x, y, z, p, c, b, a, g, e, d, tex, 0, 0xFFFFFF, 0, 0);
        bx(0, 5, 7, 2, 16, 9); bx(14, 5, 7, 16, 16, 9);
        if (!open) { bx(2, 6, 7, 14, 9, 9); bx(2, 12, 7, 14, 15, 9); bx(6, 9, 7, 10, 12, 9); }
        else { bx(0, 6, 9, 2, 9, 16); bx(0, 12, 9, 2, 15, 16); bx(14, 6, 9, 16, 9, 16); bx(14, 12, 9, 16, 15, 16); }
        break;
      }
      case R_PANE: {
        const tex = TEX[tb], tm = TINT[id] ? 1 : 0, tint = this.tintFor(id, x, z);
        const conn = (f) => { const nid = pb[p + NOFF[f]] & 4095; return SHAPE[nid] === R_PANE || OPAQUE[nid] === 1 || nid === B.glass || (LAYER[nid] === L_TRANS && SHAPE[nid] === R_CUBE); };
        const cx = conn(0), cnx = conn(1), cz = conn(4), cnz = conn(5);
        this.box(M, x, y, z, p, 7, 0, 7, 9, 16, 9, tex, tm, tint, 0, 0);
        if (cx) this.box(M, x, y, z, p, 9, 0, 7, 16, 16, 9, tex, tm, tint, 0, 0, 2);
        if (cnx) this.box(M, x, y, z, p, 0, 0, 7, 7, 16, 9, tex, tm, tint, 0, 0, 1);
        if (cz) this.box(M, x, y, z, p, 7, 0, 9, 9, 16, 16, tex, tm, tint, 0, 0, 32);
        if (cnz) this.box(M, x, y, z, p, 7, 0, 0, 9, 16, 7, tex, tm, tint, 0, 0, 16);
        break;
      }
      case R_DOOR: {
        const upper = (meta & 8) !== 0;
        const lower = upper ? pb[p - P2] >>> 12 : meta, top = upper ? meta : pb[p + P2] >>> 12;
        const f = lower & 3, open = (lower & 4) !== 0, hinge = top & 1;
        const e = open ? (hinge ? (f + 1) & 3 : (f + 3) & 3) : f;
        const tex = TEXX[id * 4 + (upper ? 0 : 1)];
        const bxs = [[0, 0, 0, 16, 16, 3], [13, 0, 0, 16, 16, 16], [0, 0, 13, 16, 16, 16], [0, 0, 0, 3, 16, 16]][e];
        this.box(this.bufs[L_CUTOUT], x, y, z, p, bxs[0], bxs[1], bxs[2], bxs[3], bxs[4], bxs[5], tex, 0, 0xFFFFFF, 0, 0);
        break;
      }
      case R_TRAPDOOR: {
        const f = meta & 3, open = (meta & 4) !== 0, top = (meta & 8) !== 0, tex = TEX[tb];
        let b;
        if (!open) b = top ? [0, 13, 0, 16, 16, 16] : [0, 0, 0, 16, 3, 16];
        else b = [[0, 0, 13, 16, 16, 16], [0, 0, 0, 3, 16, 16], [0, 0, 0, 16, 16, 3], [13, 0, 0, 16, 16, 16]][f];
        this.box(this.bufs[L_CUTOUT], x, y, z, p, b[0], b[1], b[2], b[3], b[4], b[5], tex, 0, 0xFFFFFF, 0, 0);
        break;
      }
      case R_LADDER: case R_VINE: {
        const tex = TEX[tb], light = this.flatLight(p), tint = this.tintFor(id, x, z), tm = TINT[id] ? 1 : 0;
        const walls = [];
        if (shape === R_LADDER) walls.push((meta + 2) & 3);
        else { if (meta & 1) walls.push(2); if (meta & 2) walls.push(3); if (meta & 4) walls.push(0); if (meta & 8) walls.push(1); if (!walls.length) walls.push(0); }
        for (const w of walls) {
          if (w === 0) this.plantQuad(M, x, y, z, 0, 2, PS, 2, 0, PS, tex, light, tm, tint, 0, 0, 0);
          else if (w === 2) this.plantQuad(M, x, y, z, 0, 30, PS, 30, 0, PS, tex, light, tm, tint, 0, 0, 0);
          else if (w === 1) this.plantQuad(M, x, y, z, 30, 0, 30, PS, 0, PS, tex, light, tm, tint, 0, 0, 0);
          else this.plantQuad(M, x, y, z, 2, 0, 2, PS, 0, PS, tex, light, tm, tint, 0, 0, 0);
        }
        break;
      }
      case R_SNOW: this.box(M, x, y, z, p, 0, 0, 0, 16, Math.min(16, 2 * ((meta & 7) + 1)), 16, TEX[tb], 0, 0xFFFFFF, 0, 0); break;
      case R_CARPET: this.box(M, x, y, z, p, 0, 0, 0, 16, 1, 16, TEX[tb], 1, this.tintFor(id, x, z), 0, 0); break;
      case R_PLATE: this.box(M, x, y, z, p, 1, 0, 1, 15, (meta & 1) ? 0.5 : 1, 15, TEX[tb], 0, 0xFFFFFF, 0, 0); break;
      case R_BED: {
        const f = meta & 3, head = (meta & 4) !== 0;
        const topT = TEXX[id * 4 + (head ? 0 : 1)], side = TEXX[id * 4 + 2], end = TEXX[id * 4 + 3];
        const t = [side, side, topT, B.oak_planks * 0 + TEX[B.oak_planks * 6], side, side];
        const endFace = FACING_FACE[head ? f : (f + 2) & 3];
        t[endFace] = end;
        // top face rotated so pillow points toward head direction
        for (let ff = 0; ff < 6; ff++) {
          const onB = ff !== 2;
          if (onB) { const nid = pb[p + NOFF[ff]] & 4095; if (OPAQUE[nid]) continue; if (SHAPE[nid] === R_BED && ff !== 3) continue; }
          const rot = ff === 2 ? [0, 1, 2, 3][f] : 0;
          const li = ff === 2 ? p : p + NOFF[ff];
          this.boxFace(M, ff, x, y, z, 0, 3, 0, 16, 9, 16, t[ff], this.flatLight(li), 0, 0xFFFFFF, 0, 0, rot, 0);
        }
        for (const [lx, lz] of [[0, 0], [13, 0], [0, 13], [13, 13]]) this.box(M, x, y, z, p, lx, 0, lz, lx + 3, 3, lz + 3, TEX[B.dark_oak_planks * 6], 0, 0xFFFFFF, 0, 0);
        break;
      }
      case R_CACTUS: {
        const light = this.flatLight(p), side = TEX[tb];
        this.boxFace(M, 0, x, y, z, 0, 0, 0, 15, 16, 16, side, light, 0, 0xFFFFFF, 0, 0, 0, 0);
        this.boxFace(M, 1, x, y, z, 1, 0, 0, 16, 16, 16, side, light, 0, 0xFFFFFF, 0, 0, 0, 0);
        this.boxFace(M, 4, x, y, z, 0, 0, 0, 16, 16, 15, side, light, 0, 0xFFFFFF, 0, 0, 0, 0);
        this.boxFace(M, 5, x, y, z, 0, 0, 1, 16, 16, 16, side, light, 0, 0xFFFFFF, 0, 0, 0, 0);
        if ((pb[p + P2] & 4095) !== id) this.boxFace(M, 2, x, y, z, 1, 0, 1, 15, 16, 15, TEX[tb + 2], this.flatLight(p + P2), 0, 0xFFFFFF, 0, 0, 0, 0);
        if (!OPAQUE[pb[p - P2] & 4095] && (pb[p - P2] & 4095) !== id) this.boxFace(M, 3, x, y, z, 1, 0, 1, 15, 16, 15, TEX[tb + 3], light, 0, 0xFFFFFF, 0, 0, 0, 0);
        break;
      }
      case R_CHEST: {
        const t = [TEX[tb], TEX[tb + 1], TEX[tb + 2], TEX[tb + 3], TEX[tb + 4], TEX[tb + 5]];
        t[FACING_FACE[meta & 3]] = TEXF[id];
        this.box(M, x, y, z, p, 1, 0, 1, 15, 14, 15, t, 0, 0xFFFFFF, 0, 0);
        break;
      }
      case R_FIRE: {
        const tex = TEX[tb], light = (60) | (60 << 6) | (3 << 12);
        this.plantQuad(M, x, y, z, 2, 2, 30, 30, 0, 40, tex, light, 0, 0xFFFFFF, 0, 2, 1);
        this.plantQuad(M, x, y, z, 2, 30, 30, 2, 0, 40, tex, light, 0, 0xFFFFFF, 0, 2, 1);
        this.plantQuad(M, x, y, z, 0, 3, PS, 3, 0, 38, tex, light, 0, 0xFFFFFF, 0, 2, 1);
        this.plantQuad(M, x, y, z, 0, 29, PS, 29, 0, 38, tex, light, 0, 0xFFFFFF, 0, 2, 1);
        this.plantQuad(M, x, y, z, 3, 0, 3, PS, 0, 38, tex, light, 0, 0xFFFFFF, 0, 2, 1);
        this.plantQuad(M, x, y, z, 29, 0, 29, PS, 0, 38, tex, light, 0, 0xFFFFFF, 0, 2, 1);
        break;
      }
      case R_PORTAL: {
        const tex = TEX[tb], ax = meta & 1;
        const b = ax === 0 ? [0, 0, 6, 16, 16, 10] : [6, 0, 0, 10, 16, 16];
        for (let f = 0; f < 6; f++) {
          const nid = pb[p + NOFF[f]] & 4095;
          if (nid === id || OPAQUE[nid]) continue;
          this.boxFace(M, f, x, y, z, b[0], b[1], b[2], b[3], b[4], b[5], tex, (60) | (60 << 6) | (3 << 12), 0, 0xFFFFFF, 3, 1, 0, 0);
        }
        break;
      }
      case R_RAIL: {
        const light = this.flatLight(p);
        this.boxFace(this.bufs[L_CUTOUT], 2, x, y, z, 0, 0, 0, 16, 1, 16, TEX[tb], light, 0, 0xFFFFFF, 0, 0, meta & 1, 0);
        break;
      }
      case R_LILY: {
        const light = this.flatLight(p), rot = hash3(0x11, this.ox + x, this.oy + y, this.oz + z) & 3;
        this.boxFace(M, 2, x, y, z, 0, 0, 0, 16, 0.25, 16, TEX[tb], light, 1, COLOR[id], 0, 0, rot, 0);
        this.boxFace(M, 3, x, y, z, 0, 0.25, 0, 16, 0.25, 16, TEX[tb], light, 1, COLOR[id], 0, 0, rot, 0);
        break;
      }
      case R_LANTERN: {
        const hang = meta & 1, o = hang ? 1 : 0, tex = TEX[tb];
        this.box(M, x, y, z, p, 5, o, 5, 11, 7 + o, 11, tex, 0, 0xFFFFFF, 0, 1);
        this.box(M, x, y, z, p, 6, 7 + o, 6, 10, 9 + o, 10, tex, 0, 0xFFFFFF, 0, 1);
        if (hang) this.box(M, x, y, z, p, 7.5, 10, 7.5, 8.5, 16, 8.5, tex, 0, 0xFFFFFF, 0, 0);
        break;
      }
    }
  }
  liquid(x, y, z, p, id, v) {
    const pb = this.pb, pl = this.pl;
    const lava = id === B.lava;
    const M = lava ? this.bufs[L_SOLID] : this.bufs[L_TRANS];
    const ft = lava ? 2 : 1;
    const same = (nv) => { const nid = nv & 4095; return (WLOG[nid] ? 1 : FLUID[nid]) === ft; };
    const fh = (nv) => { const nid = nv & 4095; if (WLOG[nid]) return 8 / 9; const m = nv >>> 12; return (m & 8) ? 8 / 9 : (8 - (m & 7)) / 9; };
    const corner = (dx, dz) => {
      let sum = 0, cnt = 0;
      const cells = [p, p + dx, p + dz * P, p + dx + dz * P];
      for (let i = 0; i < 4; i++) {
        const c = cells[i];
        if (same(pb[c + P2])) return 1;
        const cv = pb[c];
        if (same(cv)) { const h = fh(cv); if (h >= 0.8) { sum += h * 10; cnt += 10; } else { sum += h; cnt++; } }
        else if (!SOLID[cv & 4095]) cnt++;
      }
      return cnt ? sum / cnt : 8 / 9;
    };
    const full = same(pb[p + P2]);
    let h00, h10, h11, h01;
    if (full) h00 = h10 = h11 = h01 = 1;
    else { h00 = corner(-1, -1); h10 = corner(1, -1); h11 = corner(1, 1); h01 = corner(-1, 1); }
    const tint = lava ? 0xFFFFFF : this.tintFor(B.water, x, z), tm = lava ? 0 : 1;
    const emis = lava ? 1 : 0, anim = lava ? 2 : 1;
    const X = x * PS, Y = y * PS, Z = z * PS;
    const H = (h) => Math.round(h * PS);
    const tTop = TEX[id * 6 + 2], tSide = TEX[id * 6 + 0];
    if (!full) {
      const l = this.maxLight(p, p + P2);
      const base = tTop | (2 << 20) | (tm << 23) | (anim << 27) | (emis << 29);
      const vs = [[X, Y + H(h01), Z + PS, 0, 16], [X + PS, Y + H(h11), Z + PS, 16, 16], [X + PS, Y + H(h10), Z, 16, 0], [X, Y + H(h00), Z, 0, 0]];
      for (let k = 0; k < 4; k++) M.v(vs[k][0], vs[k][1], vs[k][2], l, base | (vs[k][3] << 10) | (vs[k][4] << 15), tint);
      if (!lava) for (let k = 3; k >= 0; k--) M.v(vs[k][0], vs[k][1], vs[k][2], l, (base & ~(7 << 20)) | (3 << 20) | (vs[k][3] << 10) | (vs[k][4] << 15), tint);
    }
    const sides = [[0, X + PS, Z + PS, X + PS, Z, h11, h10], [1, X, Z, X, Z + PS, h00, h01], [4, X, Z + PS, X + PS, Z + PS, h01, h11], [5, X + PS, Z, X, Z, h10, h00]];
    for (const s of sides) {
      const f = s[0], n = p + NOFF[f], nv = pb[n], nid = nv & 4095;
      if (same(nv) || OPAQUE[nid]) continue;
      const l = this.maxLight(p, n);
      const base = tSide | (f << 20) | (tm << 23) | (anim << 27) | (emis << 29);
      const ha = H(s[5]), hb = H(s[6]);
      const va = 16 - Math.round(s[5] * 16), vb = 16 - Math.round(s[6] * 16);
      M.v(s[1], Y, s[2], l, base | (0 << 10) | (16 << 15), tint);
      M.v(s[3], Y, s[4], l, base | (16 << 10) | (16 << 15), tint);
      M.v(s[3], Y + hb, s[4], l, base | (16 << 10) | (vb << 15), tint);
      M.v(s[1], Y + ha, s[2], l, base | (0 << 10) | (va << 15), tint);
    }
    const bn = pb[p - P2];
    if (!same(bn) && !OPAQUE[bn & 4095]) {
      const l = this.maxLight(p, p - P2);
      const base = tTop | (3 << 20) | (tm << 23) | (anim << 27) | (emis << 29);
      M.v(X, Y, Z, l, base | (0 << 10) | (16 << 15), tint); M.v(X + PS, Y, Z, l, base | (16 << 10) | (16 << 15), tint);
      M.v(X + PS, Y, Z + PS, l, base | (16 << 10) | (0 << 15), tint); M.v(X, Y, Z + PS, l, base | (0 << 10) | (0 << 15), tint);
    }
  }
  // connectivity between the 6 section faces through non-opaque cells (for cave culling)
  visibility() {
    const pb = this.pb, vis = this.visited, st = this.stack;
    vis.fill(0);
    const out = new Uint8Array(6);
    for (let s = 0; s < 4096; s++) {
      if (vis[s]) continue;
      const sx = s & 15, sz = (s >> 4) & 15, sy = s >> 8;
      if (OPAQUE[pb[(sy + 1) * P2 + (sz + 1) * P + sx + 1] & 4095]) { vis[s] = 1; continue; }
      let sp = 0, mask = 0;
      st[sp++] = s; vis[s] = 1;
      while (sp > 0) {
        const c = st[--sp];
        const x = c & 15, z = (c >> 4) & 15, y = c >> 8;
        if (x === 15) mask |= 1; if (x === 0) mask |= 2; if (y === 15) mask |= 4; if (y === 0) mask |= 8; if (z === 15) mask |= 16; if (z === 0) mask |= 32;
        const pp = (y + 1) * P2 + (z + 1) * P + x + 1;
        if (x < 15 && !vis[c + 1]) { vis[c + 1] = 1; if (!OPAQUE[pb[pp + 1] & 4095]) st[sp++] = c + 1; }
        if (x > 0 && !vis[c - 1]) { vis[c - 1] = 1; if (!OPAQUE[pb[pp - 1] & 4095]) st[sp++] = c - 1; }
        if (y < 15 && !vis[c + 256]) { vis[c + 256] = 1; if (!OPAQUE[pb[pp + P2] & 4095]) st[sp++] = c + 256; }
        if (y > 0 && !vis[c - 256]) { vis[c - 256] = 1; if (!OPAQUE[pb[pp - P2] & 4095]) st[sp++] = c - 256; }
        if (z < 15 && !vis[c + 16]) { vis[c + 16] = 1; if (!OPAQUE[pb[pp + P] & 4095]) st[sp++] = c + 16; }
        if (z > 0 && !vis[c - 16]) { vis[c - 16] = 1; if (!OPAQUE[pb[pp - P] & 4095]) st[sp++] = c - 16; }
      }
      for (let f = 0; f < 6; f++) if (mask & (1 << f)) out[f] |= mask;
    }
    return out;
  }
}
