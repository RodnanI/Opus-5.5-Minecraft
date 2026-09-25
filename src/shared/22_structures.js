// ============================================================================
//  Structures: deterministic, region-planned, applied per chunk (clipped).
// ============================================================================
const SDEF = {
  village: { spacing: 24, sep: 8, salt: 0x1A2B3C4D, reach: 5, chance: 1 },
  pyramid: { spacing: 22, sep: 8, salt: 0x2B3C4D5E, reach: 2, chance: 1 },
  jungle_temple: { spacing: 22, sep: 8, salt: 0x3C4D5E6F, reach: 2, chance: 1 },
  igloo: { spacing: 22, sep: 8, salt: 0x4D5E6F70, reach: 1, chance: 1 },
  witch_hut: { spacing: 18, sep: 6, salt: 0x5E6F7081, reach: 1, chance: 1 },
  ruined_portal: { spacing: 18, sep: 6, salt: 0x6F708192, reach: 1, chance: 0.8 },
  mineshaft: { spacing: 10, sep: 3, salt: 0x708192A3, reach: 6, chance: 0.55 },
  fortress: { spacing: 14, sep: 4, salt: 0x8192A3B4, reach: 7, chance: 0.75 },
  stronghold: { spacing: 36, sep: 12, salt: 0x51C0DE77, reach: 4, chance: 1 },
  end_city: { spacing: 20, sep: 8, salt: 0x7E4DC17E, reach: 4, chance: 1 },
};
const OW_STRUCTS = ['mineshaft', 'village', 'pyramid', 'jungle_temple', 'igloo', 'witch_hut', 'ruined_portal', 'stronghold'];

class Bld {
  constructor(ctx, ox, y, oz, F, seed) {
    this.ctx = ctx; this.ox = ox; this.y = y; this.oz = oz; this.F = F; this.seed = seed;
    const fx = FACING_DX[F], fz = FACING_DZ[F];
    this.rx = -fz; this.rz = fx; this.bx = -fx; this.bz = -fz;
  }
  X(u, v) { return this.ox + u * this.rx + v * this.bx; }
  Z(u, v) { return this.oz + u * this.rz + v * this.bz; }
  set(u, h, v, b) { this.ctx.set(this.X(u, v), this.y + h, this.Z(u, v), b); }
  get(u, h, v) { return this.ctx.get(this.X(u, v), this.y + h, this.Z(u, v)); }
  fill(u0, h0, v0, u1, h1, v1, b) { for (let u = u0; u <= u1; u++) for (let v = v0; v <= v1; v++) for (let h = h0; h <= h1; h++) this.set(u, h, v, b); }
  d(ld) { return (this.F + ld) & 3; }
  rnd(u, h, v) { return hashF3(this.seed, this.X(u, v), this.y + h, this.Z(u, v)); }
  stairs(u, h, v, id, ld, upside) { this.set(u, h, v, id | ((this.d(ld) | (upside ? 4 : 0)) << 12)); }
  door(u, h, v, id, ld) { this.set(u, h, v, id | (this.d(ld) << 12)); this.set(u, h + 1, v, id | (8 << 12)); }
  torch(u, h, v, ld) { this.set(u, h, v, B.torch | ((1 + this.d(ld)) << 12)); }
  bed(u, h, v, ld) {
    const f = this.d(ld);
    this.set(u, h, v, B.red_bed | (f << 12));
    const du = ld === 1 ? 1 : ld === 3 ? -1 : 0, dv = ld === 2 ? 1 : ld === 0 ? -1 : 0;
    this.set(u + du, h, v + dv, B.red_bed | ((f | 4) << 12));
  }
  chest(u, h, v, ld, loot) { this.ctx.chest(this.X(u, v), this.y + h, this.Z(u, v), this.d(ld), loot, hash3(this.seed, this.X(u, v), this.y + h, this.Z(u, v))); }
  face(u, h, v, id, ld) { this.set(u, h, v, id | (this.d(ld) << 12)); }
  // fill down to ground with block, and clear above
  foundation(u0, v0, u1, v1, b, depth) {
    for (let u = u0; u <= u1; u++) for (let v = v0; v <= v1; v++) {
      for (let h = -1; h >= -(depth || 8); h--) {
        const c = this.get(u, h, v); if (c < 0) break;
        const id = c & 4095;
        if (id === 0 || REPL[id] || FLUID[id] || PLANT[id] || LEAVES[id]) this.set(u, h, v, b); else break;
      }
    }
  }
  clear(u0, v0, u1, v1, h0, h1) { this.fill(u0, h0, v0, u1, h1, v1, 0); }
  roofGable(u0, u1, v0, v1, h0, stair, fillB, capB) {
    let lo = v0 - 1, hi = v1 + 1, h = h0;
    while (lo <= hi) {
      if (lo === hi) { for (let u = u0 - 1; u <= u1 + 1; u++) this.set(u, h, lo, capB); break; }
      for (let u = u0 - 1; u <= u1 + 1; u++) { this.stairs(u, h, lo, stair, 2, false); this.stairs(u, h, hi, stair, 0, false); }
      for (let v = lo + 1; v <= hi - 1; v++) { this.set(u0, h, v, fillB); this.set(u1, h, v, fillB); }
      if (hi - lo === 1) { for (let u = u0; u <= u1; u++) { this.set(u, h + 1, lo, capB); this.set(u, h + 1, hi, capB); } break; }
      lo++; hi--; h++;
    }
  }
}

const VMATS = {
  plains: { log: 'oak_log', planks: 'oak_planks', stairs: 'oak_stairs', slab: 'oak_slab', found: 'cobblestone', wall: 'oak_planks', path: 'dirt_path', fence: 'oak_fence', glass: 'glass_pane', floor: 'oak_planks', accent: 'cobblestone', cap: 'oak_slab' },
  desert: { log: 'cut_sandstone', planks: 'smooth_sandstone', stairs: 'sandstone_stairs', slab: 'sandstone_slab', found: 'sandstone', wall: 'sandstone', path: 'smooth_sandstone', fence: 'oak_fence', glass: 'glass_pane', floor: 'smooth_sandstone', accent: 'orange_terracotta', cap: 'sandstone_slab', flat: true },
  savanna: { log: 'acacia_log', planks: 'acacia_planks', stairs: 'acacia_stairs', slab: 'acacia_slab', found: 'cobblestone', wall: 'acacia_planks', path: 'dirt_path', fence: 'acacia_fence', glass: 'glass_pane', floor: 'acacia_planks', accent: 'orange_terracotta', cap: 'acacia_slab' },
  taiga: { log: 'spruce_log', planks: 'spruce_planks', stairs: 'spruce_stairs', slab: 'spruce_slab', found: 'mossy_cobblestone', wall: 'spruce_planks', path: 'dirt_path', fence: 'spruce_fence', glass: 'glass_pane', floor: 'spruce_planks', accent: 'cobblestone', cap: 'spruce_slab' },
  snowy: { log: 'spruce_log', planks: 'spruce_planks', stairs: 'spruce_stairs', slab: 'spruce_slab', found: 'cobblestone', wall: 'white_terracotta', path: 'dirt_path', fence: 'spruce_fence', glass: 'glass_pane', floor: 'spruce_planks', accent: 'packed_ice', cap: 'spruce_slab' },
};
function resolveMat(m) { const o = {}; for (const k in m) o[k] = typeof m[k] === 'string' ? B[m[k]] : m[k]; return o; }

const VILLAGE_BUILDINGS = [['small_house', 30, 5, 5], ['house', 26, 7, 6], ['farm', 22, 7, 9], ['big_house', 8, 9, 7], ['smithy', 6, 9, 7], ['library', 5, 9, 7], ['church', 4, 5, 8], ['pen', 7, 7, 7]];

class Structures {
  constructor(gen) {
    this.gen = gen; this.seed = gen.seed; this.cache = new Map();
    this.mats = {}; for (const k in VMATS) this.mats[k] = resolveMat(VMATS[k]);
  }
  cand(type, rx, rz) {
    const d = SDEF[type];
    const rng = new RNG(hash2(this.seed ^ d.salt, rx, rz));
    const cx = rx * d.spacing + rng.int(d.spacing - d.sep), cz = rz * d.spacing + rng.int(d.spacing - d.sep);
    return { cx, cz, rng };
  }
  plan(type, rx, rz) {
    const k = type + ':' + rx + ':' + rz;
    if (this.cache.has(k)) return this.cache.get(k);
    if (this.cache.size > 3000) this.cache.clear();
    let p = null;
    const c = this.cand(type, rx, rz);
    if (c.rng.next() < SDEF[type].chance) {
      switch (type) {
        case 'village': p = this.planVillage(c); break;
        case 'pyramid': p = this.planPyramid(c); break;
        case 'jungle_temple': p = this.planJungleTemple(c); break;
        case 'igloo': p = this.planIgloo(c); break;
        case 'witch_hut': p = this.planWitchHut(c); break;
        case 'ruined_portal': p = this.planRuinedPortal(c); break;
        case 'mineshaft': p = this.planMineshaft(c); break;
        case 'fortress': p = this.planFortress(c); break;
        case 'stronghold': p = this.planStronghold(c); break;
        case 'end_city': p = this.planEndCity(c); break;
      }
    }
    this.cache.set(k, p);
    return p;
  }
  forEachNear(type, cx, cz, fn) {
    const d = SDEF[type], R = d.reach;
    const rx0 = Math.floor((cx - R) / d.spacing), rx1 = Math.floor((cx + R) / d.spacing);
    const rz0 = Math.floor((cz - R) / d.spacing), rz1 = Math.floor((cz + R) / d.spacing);
    for (let rx = rx0; rx <= rx1; rx++) for (let rz = rz0; rz <= rz1; rz++) { const p = this.plan(type, rx, rz); if (p) fn(p); }
  }
  apply(ctx) {
    for (const type of OW_STRUCTS) {
      this.forEachNear(type, ctx.cx, ctx.cz, (p) => {
        if (!ctx.overlaps(p.x0, p.z0, p.x1, p.z1)) return;
        if (type === 'village') ctx.tags |= 1;
        for (const pc of p.pieces) if (ctx.overlaps(pc.x0, pc.z0, pc.x1, pc.z1)) pc.build(ctx);
      });
    }
  }
  applyNether(ctx) {
    this.forEachNear('fortress', ctx.cx, ctx.cz, (p) => {
      if (!ctx.overlaps(p.x0, p.z0, p.x1, p.z1)) return;
      for (const pc of p.pieces) if (ctx.overlaps(pc.x0, pc.z0, pc.x1, pc.z1)) { pc.build(ctx); ctx.tags |= 2; }
    });
  }
  applyEnd(ctx) {
    this.forEachNear('end_city', ctx.cx, ctx.cz, (p) => {
      if (!ctx.overlaps(p.x0, p.z0, p.x1, p.z1)) return;
      for (const pc of p.pieces) if (ctx.overlaps(pc.x0, pc.z0, pc.x1, pc.z1)) { pc.build(ctx); ctx.tags |= 4; }
    });
  }
  inVillage(x, z) {
    let r = false;
    this.forEachNear('village', x >> 4, z >> 4, (p) => { if (x >= p.x0 - 3 && x <= p.x1 + 3 && z >= p.z0 - 3 && z <= p.z1 + 3) r = true; });
    return r;
  }
  inEndCity(x, z) {
    let r = false;
    this.forEachNear('end_city', x >> 4, z >> 4, (p) => { if (x >= p.x0 - 2 && x <= p.x1 + 2 && z >= p.z0 - 2 && z <= p.z1 + 2) r = true; });
    return r;
  }
  locate(type, x, z, maxR) {
    const d = SDEF[type]; if (!d) return null;
    const rcx = Math.floor((x >> 4) / d.spacing), rcz = Math.floor((z >> 4) / d.spacing);
    let best = null, bd = Infinity;
    for (let r = 0; r <= (maxR || 12); r++) {
      for (let rx = rcx - r; rx <= rcx + r; rx++) for (let rz = rcz - r; rz <= rcz + r; rz++) {
        if (Math.max(Math.abs(rx - rcx), Math.abs(rz - rcz)) !== r) continue;
        const p = this.plan(type, rx, rz);
        if (p) {
          // a plan may name its key spot (the stronghold's portal room); otherwise use the middle of its bounds
          const px = p.target ? p.target[0] : (p.x0 + p.x1) / 2, pz = p.target ? p.target[2] : (p.z0 + p.z1) / 2, dd = (px - x) ** 2 + (pz - z) ** 2;
          if (dd < bd) { bd = dd; best = { x: Math.round(px), y: p.target ? p.target[1] : p.cy || 64, z: Math.round(pz) }; }
        }
      }
      if (best && r >= 2) break;
    }
    return best;
  }
  surf(x, z) { return this.gen.surfaceAt(x, z, this.gen.climateCached(x, z)); }

  // ================================================================ VILLAGE
  planVillage(c) {
    const rng = c.rng, x = c.cx * 16 + 8, z = c.cz * 16 + 8;
    const cl = this.gen.climateCached(x, z);
    const kinds = { [BIO.PLAINS]: 'plains', [BIO.SAVANNA]: 'savanna', [BIO.DESERT]: 'desert', [BIO.TAIGA]: 'taiga', [BIO.SNOWY_PLAINS]: 'snowy' };
    const kind = kinds[cl.biome];
    if (!kind || cl.m > 0.12 || cl.hill > 0.55 || cl.h < SEA + 1.5 || cl.amp > 1) return null;
    const m = this.mats[kind];
    const pieces = [], rects = [], roads = [];
    const gy = (xx, zz) => this.surf(xx, zz);
    const cy = gy(x, z);
    const overl = (a, b, pad) => a[0] - pad <= b[2] && a[2] + pad >= b[0] && a[1] - pad <= b[3] && a[3] + pad >= b[1];
    const well = [x - 2, z - 2, x + 1, z + 1];
    rects.push([x - 3, z - 3, x + 2, z + 2]);
    const dirs = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = rng.int(i + 1); [dirs[i], dirs[j]] = [dirs[j], dirs[i]]; }
    const nRoads = rng.range(3, 4);
    for (let k = 0; k < nRoads; k++) {
      const d = dirs[k], len = rng.range(22, 40);
      const sx = x + FACING_DX[d] * 3 + (d === 1 ? -1 : 0), sz = z + FACING_DZ[d] * 3 + (d === 2 ? -1 : 0);
      roads.push({ sx, sz, d, len });
      const nb = rng.range(0, 2);
      for (let b = 0; b < nb; b++) {
        const at = rng.range(10, len - 4), bd = (d + (rng.next() < 0.5 ? 1 : 3)) & 3, bl = rng.range(10, 20);
        const bx = sx + FACING_DX[d] * at, bz = sz + FACING_DZ[d] * at;
        roads.push({ sx: bx + FACING_DX[bd] * 2, sz: bz + FACING_DZ[bd] * 2, d: bd, len: bl });
      }
    }
    const roadRects = roads.map(r => {
      const ex = r.sx + FACING_DX[r.d] * (r.len - 1), ez = r.sz + FACING_DZ[r.d] * (r.len - 1);
      const px = Math.abs(FACING_DZ[r.d]), pz = Math.abs(FACING_DX[r.d]);
      return [Math.min(r.sx, ex) - px, Math.min(r.sz, ez) - pz, Math.max(r.sx, ex) + px, Math.max(r.sz, ez) + pz];
    });
    // road pieces
    for (const rr of roadRects) {
      const path = m.path, pl = m.planks, self = this;
      pieces.push({ x0: rr[0], z0: rr[1], x1: rr[2], z1: rr[3], build(ctx) {
        for (let xx = Math.max(rr[0], ctx.x0); xx <= Math.min(rr[2], ctx.x0 + 15); xx++) for (let zz = Math.max(rr[1], ctx.z0); zz <= Math.min(rr[3], ctx.z0 + 15); zz++) {
          if (xx >= well[0] && xx <= well[2] && zz >= well[1] && zz <= well[3]) continue;
          let y = self.surf(xx, zz);
          if (y < SEA) { ctx.set(xx, SEA, zz, pl); continue; }
          const cur = ctx.get(xx, y, zz) & 4095;
          if (cur === 0 || cur === B.water) continue;
          ctx.set(xx, y, zz, hashF2(self.seed, xx, zz) < 0.12 && path === B.dirt_path ? B.gravel : path);
          for (let h = 1; h <= 3; h++) { const a = ctx.get(xx, y + h, zz) & 4095; if (a !== 0 && !LEAVES[a]) ctx.set(xx, y + h, zz, 0); }
        }
      } });
    }
    // well
    pieces.push({ x0: well[0] - 1, z0: well[1] - 1, x1: well[2] + 1, z1: well[3] + 1, build: (ctx) => {
      const b = new Bld(ctx, well[0] - 1, cy, well[1] - 1, 0, this.seed);
      // local: F=0 (north) -> right = +x, back = +z. origin at NW corner
      b.foundation(0, 0, 5, 5, m.found);
      b.clear(0, 0, 5, 5, 1, 5);
      b.fill(0, 0, 0, 5, 0, 5, m.path === B.smooth_sandstone ? B.smooth_sandstone : B.gravel);
      b.fill(1, -4, 1, 4, 1, 4, B.cobblestone);
      b.fill(2, -3, 2, 3, 0, 3, B.water);
      for (const [u, v] of [[1, 1], [4, 1], [1, 4], [4, 4]]) { b.set(u, 2, v, m.fence); b.set(u, 3, v, m.fence); }
      b.fill(1, 4, 1, 4, 4, 4, B.cobblestone_slab);
      b.set(2, 4, 2, B.cobblestone); b.set(3, 4, 3, B.cobblestone); b.set(2, 4, 3, B.cobblestone); b.set(3, 4, 2, B.cobblestone);
    } });
    // buildings along roads
    const counts = {};
    const blds = [];
    for (let ri = 0; ri < roads.length; ri++) {
      const r = roads[ri];
      for (const side of [1, 3]) {
        const sd = (r.d + side) & 3, F = (sd + 2) & 3;
        let pos = 2;
        while (pos < r.len - 3) {
          let def = null;
          for (let tries = 0; tries < 4 && !def; tries++) {
            const t = weightedPick(VILLAGE_BUILDINGS.map(e => [e, e[1]]), rng.next());
            const lim = { smithy: 1, library: 1, church: 1, big_house: 2, pen: 2 }[t[0]];
            if (lim && (counts[t[0]] || 0) >= lim) continue;
            def = t;
          }
          if (!def) { pos += 3; continue; }
          const [type, , w, dd] = def;
          const fx = FACING_DX[F], fz = FACING_DZ[F];
          const rx2 = -fz, rz2 = fx;
          const t0 = (rx2 === FACING_DX[r.d] && rz2 === FACING_DZ[r.d]) ? pos : pos + w - 1;
          const ox = r.sx + FACING_DX[r.d] * t0 + FACING_DX[sd] * 2, oz = r.sz + FACING_DZ[r.d] * t0 + FACING_DZ[sd] * 2;
          const cxs = [ox, ox + (w - 1) * rx2 + (dd - 1) * -fx], czs = [oz, oz + (w - 1) * rz2 + (dd - 1) * -fz];
          const rect = [Math.min(cxs[0], cxs[1]), Math.min(czs[0], czs[1]), Math.max(cxs[0], cxs[1]), Math.max(czs[0], czs[1])];
          let ok = true;
          for (const q of rects) if (overl(rect, q, 1)) { ok = false; break; }
          if (ok) for (let qi = 0; qi < roadRects.length; qi++) if (overl(rect, roadRects[qi], 0)) { ok = false; break; }
          if (ok) {
            const hs = [gy(rect[0], rect[1]), gy(rect[2], rect[1]), gy(rect[0], rect[3]), gy(rect[2], rect[3]), gy((rect[0] + rect[2]) >> 1, (rect[1] + rect[3]) >> 1)];
            const mn = Math.min(...hs), mx = Math.max(...hs);
            if (mx - mn > 5 || mn < SEA) ok = false;
            else {
              hs.sort((a, b) => a - b);
              const fy = hs[2];
              rects.push(rect);
              counts[type] = (counts[type] || 0) + 1;
              blds.push({ type, ox, oz, y: fy, F, w, dd, rect, seed: rng.u32() });
              pos += w + rng.range(1, 3);
              continue;
            }
          }
          pos += 2;
        }
      }
      // lamps along the road
      for (let t = 4; t < r.len - 2; t += rng.range(9, 13)) {
        const sd = (r.d + (rng.next() < 0.5 ? 1 : 3)) & 3;
        const lx = r.sx + FACING_DX[r.d] * t + FACING_DX[sd] * 2, lz = r.sz + FACING_DZ[r.d] * t + FACING_DZ[sd] * 2;
        const lr = [lx, lz, lx, lz];
        let ok = true;
        for (const q of rects) if (overl(lr, q, 0)) { ok = false; break; }
        if (ok) for (const q of roadRects) if (overl(lr, q, 0)) { ok = false; break; }
        if (!ok) continue;
        rects.push(lr);
        const ly = gy(lx, lz);
        if (ly < SEA) continue;
        pieces.push({ x0: lx, z0: lz, x1: lx, z1: lz, build(ctx) {
          ctx.set(lx, ly + 1, lz, m.fence); ctx.set(lx, ly + 2, lz, m.fence); ctx.set(lx, ly + 3, lz, B.torch);
          if (ctx.get(lx, ly, lz) === 0) ctx.set(lx, ly, lz, B.cobblestone);
        } });
      }
    }
    for (const bl of blds) {
      const self = this;
      pieces.push({ x0: bl.rect[0] - 1, z0: bl.rect[1] - 1, x1: bl.rect[2] + 1, z1: bl.rect[3] + 1, build(ctx) { self.villageBuilding(ctx, bl, m, kind); } });
    }
    let x0 = x - 4, z0 = z - 4, x1 = x + 4, z1 = z + 4;
    for (const q of rects.concat(roadRects)) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[2]); z1 = Math.max(z1, q[3]); }
    return { type: 'village', kind, x0: x0 - 2, z0: z0 - 2, x1: x1 + 2, z1: z1 + 2, cy, pieces };
  }
  villageBuilding(ctx, bl, m, kind) {
    const b = new Bld(ctx, bl.ox, bl.y, bl.oz, bl.F, bl.seed);
    const w = bl.w, d = bl.dd, W = w - 1, D = d - 1;
    const prof = { smithy: 'smith', library: 'librarian', church: 'cleric', farm: 'farmer', pen: 'butcher' }[bl.type];
    const spawnV = (u, v, p) => ctx.spawn('villager', b.X(u, v) + 0.5, bl.y + 1, b.Z(u, v) + 0.5, { prof: p || ['farmer', 'shepherd', 'fletcher', 'none', 'librarian', 'smith'][Math.floor(b.rnd(u, 9, v) * 6)] });
    const walls = (h0, h1, wallB, cornerB) => {
      for (let h = h0; h <= h1; h++) for (let u = 0; u <= W; u++) for (let v = 0; v <= D; v++) {
        if (u !== 0 && u !== W && v !== 0 && v !== D) continue;
        b.set(u, h, v, (u === 0 || u === W) && (v === 0 || v === D) ? cornerB : wallB);
      }
    };
    const roof = (h) => {
      if (m.flat) { b.fill(-1, h, -1, W + 1, h, D + 1, m.cap); b.fill(0, h, 0, W, h, D, m.planks); }
      else b.roofGable(0, W, 0, D, h, m.stairs, m.wall === B.white_terracotta ? m.planks : m.wall, m.cap);
    };
    switch (bl.type) {
      case 'small_house': {
        b.foundation(0, 0, W, D, m.found); b.clear(-1, -1, W + 1, D + 1, 1, 8);
        b.fill(0, 0, 0, W, 0, D, m.floor);
        walls(1, 3, m.wall, m.log);
        b.door(2, 1, 0, B.oak_door, 2);
        b.set(0, 2, 2, m.glass); b.set(W, 2, 2, m.glass); b.set(2, 2, D, m.glass);
        roof(4);
        b.torch(2, 3, D - 1, 0);
        if (b.rnd(1, 1, 1) < 0.5) b.bed(1, 1, 2, 2); else b.set(1, 1, D - 1, B.crafting_table);
        spawnV(2, 2);
        break;
      }
      case 'house': case 'big_house': case 'library': {
        b.foundation(0, 0, W, D, m.found); b.clear(-1, -1, W + 1, D + 1, 1, 10);
        b.fill(0, 0, 0, W, 0, D, m.floor);
        walls(1, 1, m.accent === B.packed_ice ? B.cobblestone : m.found, m.log);
        walls(2, 3, m.wall, m.log);
        const mid = W >> 1;
        b.door(mid, 1, 0, B.oak_door, 2);
        for (let u = 2; u < W - 1; u += 2) if (u !== mid) { b.set(u, 2, 0, m.glass); b.set(u, 2, D, m.glass); }
        for (let v = 2; v < D - 1; v += 2) { b.set(0, 2, v, m.glass); b.set(W, 2, v, m.glass); }
        roof(4);
        b.torch(mid, 3, D - 1, 0); b.torch(1, 3, 1, 2);
        if (bl.type === 'library') {
          for (let u = 1; u < W; u++) { if (Math.abs(u - mid) > 0) { b.set(u, 1, D - 1, B.bookshelf); b.set(u, 2, D - 1, B.bookshelf); } }
          b.set(1, 1, 1, B.crafting_table); b.set(W - 1, 1, 2, B.oak_stairs | (b.d(3) << 12));
          b.fill(2, 1, 2, W - 2, 1, D - 3, B.red_carpet);
          spawnV(mid, 2, 'librarian');
        } else {
          b.bed(1, 1, D - 2, 0);
          b.set(W - 1, 1, D - 1, B.crafting_table);
          b.chest(W - 1, 1, 1, 3, 'village_house');
          if (bl.type === 'big_house') { b.bed(W - 2, 1, D - 3, 0); b.set(1, 1, 1, B.furnace | (b.d(1) << 12)); spawnV(mid + 1, 3); }
          spawnV(mid, 2);
        }
        break;
      }
      case 'smithy': {
        b.foundation(0, 0, W, D, B.cobblestone); b.clear(-1, -1, W + 1, D + 1, 1, 9);
        b.fill(0, 0, 0, W, 0, D, B.cobblestone);
        // back room walls, open front porch
        for (let h = 1; h <= 3; h++) {
          for (let u = 0; u <= W; u++) b.set(u, h, D, B.cobblestone);
          for (let v = 2; v <= D; v++) { b.set(0, h, v, B.cobblestone); b.set(W, h, v, B.cobblestone); }
          b.set(0, h, 0, m.log); b.set(W, h, 0, m.log);
        }
        b.fill(0, 4, 0, W, 4, D, B.cobblestone_slab);
        b.fill(1, 4, 1, W - 1, 4, D - 1, m.planks);
        // lava pool
        b.fill(1, 0, D - 2, 2, 0, D - 1, B.lava);
        b.set(1, 1, D - 3, B.iron_bars); b.set(2, 1, D - 3, B.iron_bars); b.set(3, 1, D - 2, B.iron_bars); b.set(3, 1, D - 1, B.iron_bars);
        b.face(W - 1, 1, D - 1, B.furnace, 0); b.face(W - 2, 1, D - 1, B.furnace, 0);
        b.chest(W - 1, 1, 2, 3, 'village_smith');
        b.set(W - 1, 1, 3, B.smooth_stone_slab || B.stone_slab);
        b.torch(W >> 1, 3, D - 1, 0);
        spawnV(4, 2, 'smith');
        break;
      }
      case 'church': {
        b.foundation(0, 0, W, D, B.cobblestone); b.clear(-1, -1, W + 1, D + 1, 1, 14);
        b.fill(0, 0, 0, W, 0, D, B.cobblestone);
        walls(1, 6, B.cobblestone, B.cobblestone);
        b.door(2, 1, 0, B.oak_door, 2);
        for (let v = 2; v < D; v += 2) { b.set(0, 3, v, m.glass); b.set(W, 3, v, m.glass); b.set(0, 4, v, m.glass); b.set(W, 4, v, m.glass); }
        b.fill(0, 7, 0, W, 7, D, B.cobblestone);
        // tower at back
        for (let h = 8; h <= 11; h++) for (let u = 0; u <= W; u++) for (let v = D - 3; v <= D; v++) {
          if (u === 0 || u === W || v === D - 3 || v === D) b.set(u, h, v, (h === 10 && (u === 2 || v === D - 2 || v === D - 1) && (u === 0 || u === W || v === D - 3 || v === D)) ? m.glass : B.cobblestone);
        }
        b.fill(0, 12, D - 3, W, 12, D, B.cobblestone_slab);
        for (let h = 1; h <= 6; h++) b.set(1, h, D - 1, B.ladder | (b.d(1) << 12));
        b.set(1, 7, D - 1, 0);
        b.torch(2, 5, D - 1, 0); b.torch(2, 10, D - 2, 0);
        b.set(2, 1, D - 2, B.chiseled_stone_bricks);
        b.stairs(1, 1, 2, B.oak_stairs, 0); b.stairs(3, 1, 2, B.oak_stairs, 0);
        spawnV(2, 3, 'cleric');
        break;
      }
      case 'farm': {
        b.clear(0, 0, W, D, 1, 3);
        b.foundation(0, 0, W, D, B.dirt, 4);
        const crop = [B.wheat, B.wheat, B.carrots, B.potatoes, B.beetroots][Math.floor(b.rnd(0, 0, 0) * 5)];
        for (let u = 0; u <= W; u++) for (let v = 0; v <= D; v++) {
          if (u === 0 || u === W || v === 0 || v === D) { b.set(u, 0, v, m.log | ((u === 0 || u === W) ? (v === 0 || v === D ? 0 : 2 << 12) : 1 << 12)); continue; }
          if (u === 3) { b.set(u, 0, v, B.water); continue; }
          b.set(u, 0, v, B.farmland | (7 << 12));
          b.set(u, 1, v, crop | (Math.floor(b.rnd(u, 1, v) * 8) << 12));
        }
        spawnV(3, -1, 'farmer');
        break;
      }
      case 'pen': {
        b.clear(0, 0, W, D, 1, 3);
        b.foundation(0, 0, W, D, B.dirt, 4);
        b.fill(0, 0, 0, W, 0, D, B.grass_block);
        for (let u = 0; u <= W; u++) for (let v = 0; v <= D; v++) if (u === 0 || u === W || v === 0 || v === D) b.set(u, 1, v, m.fence);
        b.set(W >> 1, 1, 0, B.oak_fence_gate | (b.d(0) << 12));
        b.set(1, 1, D - 1, B.hay_block); b.set(2, 1, D - 1, B.hay_block);
        const an = ['cow', 'sheep', 'pig'][Math.floor(b.rnd(1, 1, 1) * 3)];
        ctx.spawn(an, b.X(2, 3) + 0.5, bl.y + 1, b.Z(2, 3) + 0.5);
        ctx.spawn(an, b.X(4, 4) + 0.5, bl.y + 1, b.Z(4, 4) + 0.5);
        ctx.spawn(an, b.X(3, 2) + 0.5, bl.y + 1, b.Z(3, 2) + 0.5);
        spawnV(W >> 1, -1, 'butcher');
        break;
      }
    }
    // buildings sit at the median height of their footprint while roads follow the terrain, so a door can end
    // up a block or two above the path in front of it: give those doors a step up
    const doorU = { small_house: [2], house: [W >> 1], big_house: [W >> 1], library: [W >> 1], church: [2], pen: [W >> 1] }[bl.type];
    if (doorU) for (const u of doorU) this.doorstep(b, u, m);
    if (bl.type === 'smithy') for (let u = 1; u < W; u++) this.doorstep(b, u, m);
  }
  doorstep(b, u, m) {
    const open = (c) => { const id = c & 4095; return id === 0 || REPL[id] || PLANT[id] || FLUID[id]; };
    const c0 = b.get(u, 0, -1);
    if (c0 < 0 || !open(c0)) return;                 // outside this chunk, or the ground already reaches floor level
    let h = -1;
    for (; h >= -3; h--) { const c = b.get(u, h, -1); if (c < 0) return; if (!open(c)) break; }
    for (let k = h + 1; k < 0; k++) b.set(u, k, -1, m.found);
    b.stairs(u, 0, -1, m.stairs, 2);
    // two blocks down: a second step further out, if that spot is low too
    if (h <= -2) { const c2 = b.get(u, -1, -2); if (c2 >= 0 && open(c2)) { for (let k = h + 1; k < -1; k++) b.set(u, k, -2, m.found); b.stairs(u, -1, -2, m.stairs, 2); } }
  }

  // ================================================================ PYRAMID
  planPyramid(c) {
    const x = c.cx * 16 + 8, z = c.cz * 16 + 8, cl = this.gen.climateCached(x, z);
    if (cl.biome !== BIO.DESERT || cl.amp > 1) return null;
    const y = Math.min(this.surf(x - 10, z - 10), this.surf(x + 10, z + 10), this.surf(x, z), this.surf(x - 10, z + 10), this.surf(x + 10, z - 10));
    if (y < SEA) return null;
    const ox = x - 10, oz = z - 10, seed = c.rng.u32();
    return { type: 'pyramid', x0: ox, z0: oz, x1: ox + 20, z1: oz + 20, cy: y, pieces: [{ x0: ox, z0: oz, x1: ox + 20, z1: oz + 20, build: (ctx) => {
      const b = new Bld(ctx, ox, y, oz, 0, seed);
      b.foundation(0, 0, 20, 20, B.sandstone, 10);
      for (let i = 0; i <= 10; i++) {
        for (let u = i; u <= 20 - i; u++) for (let v = i; v <= 20 - i; v++) {
          const edge = u === i || u === 20 - i || v === i || v === 20 - i;
          if (edge) b.set(u, i, v, i === 0 ? B.sandstone : (i % 3 === 0 ? B.cut_sandstone : B.sandstone));
          else b.set(u, i, v, i === 0 ? B.sandstone : 0);
        }
      }
      // floor pattern
      for (let u = 6; u <= 14; u++) for (let v = 6; v <= 14; v++) {
        const du = Math.abs(u - 10), dv = Math.abs(v - 10);
        b.set(u, 0, v, du + dv <= 1 ? B.blue_terracotta : (du === dv || du === 0 || dv === 0) ? B.orange_terracotta : B.sandstone);
      }
      // entrance
      b.fill(9, 1, 0, 11, 3, 1, 0);
      b.set(8, 1, 0, B.chiseled_sandstone); b.set(12, 1, 0, B.chiseled_sandstone);
      b.set(8, 4, 1, B.orange_terracotta); b.set(12, 4, 1, B.orange_terracotta);
      // pillars inside
      for (const [pu, pv] of [[4, 4], [16, 4], [4, 16], [16, 16]]) b.fill(pu, 1, pv, pu, 4, pv, B.cut_sandstone);
      // shaft + treasure room
      b.fill(10, -11, 10, 10, 0, 10, 0);
      b.fill(6, -15, 6, 14, -15, 14, B.sandstone);
      b.fill(6, -14, 6, 14, -11, 14, B.sandstone);
      b.fill(7, -14, 7, 13, -11, 13, 0);
      b.fill(7, -15, 7, 13, -15, 13, B.cut_sandstone);
      b.set(10, -15, 10, B.blue_terracotta);
      for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) b.set(10 + dx, -15, 10 + dz, B.orange_terracotta);
      b.chest(10, -14, 7, 2, 'pyramid'); b.chest(10, -14, 13, 0, 'pyramid'); b.chest(7, -14, 10, 1, 'pyramid'); b.chest(13, -14, 10, 3, 'pyramid');
      b.set(10, -14, 10, B.stone_pressure_plate);
      b.fill(9, -17, 9, 11, -17, 11, B.tnt);
      b.fill(9, -16, 9, 11, -16, 11, B.sandstone);
      b.set(10, -16, 10, B.tnt);
      b.torch(10, -12, 8, 2);
    } }] };
  }
  // ================================================================ JUNGLE TEMPLE
  planJungleTemple(c) {
    const x = c.cx * 16 + 8, z = c.cz * 16 + 8, cl = this.gen.climateCached(x, z);
    if (cl.biome !== BIO.JUNGLE || cl.amp > 1.5) return null;
    const y = this.surf(x, z); if (y < SEA) return null;
    const ox = x - 6, oz = z - 7, seed = c.rng.u32(), F = c.rng.int(4);
    return { type: 'jungle_temple', x0: ox - 2, z0: oz - 2, x1: ox + 16, z1: oz + 16, cy: y, pieces: [{ x0: ox - 2, z0: oz - 2, x1: ox + 16, z1: oz + 16, build: (ctx) => {
      const b = new Bld(ctx, ox, y, oz, 0, seed); void F;
      const W = 11, D = 14;
      const mc = (u, h, v) => b.rnd(u, h, v) < 0.45 ? B.mossy_cobblestone : B.cobblestone;
      b.foundation(0, 0, W, D, B.cobblestone, 10);
      b.clear(0, 0, W, D, 1, 12);
      for (let h = 0; h <= 9; h++) for (let u = 0; u <= W; u++) for (let v = 0; v <= D; v++) {
        const edge = u === 0 || u === W || v === 0 || v === D;
        if (h === 0 || h === 4 || h === 9 || edge) b.set(u, h, v, mc(u, h, v));
      }
      b.fill(2, 5, 2, W - 2, 8, D - 2, 0);
      b.fill(1, 1, 1, W - 1, 3, D - 1, 0);
      for (let h = 1; h <= 3; h++) { b.set(5, h, 0, 0); b.set(6, h, 0, 0); }
      for (let h = 10; h <= 11; h++) for (let u = 2 + (h - 10) * 2; u <= W - 2 - (h - 10) * 2; u++) for (let v = 2 + (h - 10) * 2; v <= D - 2 - (h - 10) * 2; v++) b.set(u, h, v, mc(u, h, v));
      for (let v = 2; v < D - 1; v += 3) { b.set(0, 2, v, 0); b.set(W, 2, v, 0); b.set(0, 6, v, 0); b.set(W, 6, v, 0); }
      b.fill(5, 4, 3, 6, 4, 4, 0);
      for (let i = 0; i < 4; i++) b.stairs(5, 1 + i, 7 - i, B.cobblestone_stairs, 0);
      // basement
      b.fill(1, -4, 1, W - 1, -1, D - 1, B.cobblestone);
      b.fill(2, -3, 2, W - 2, -1, D - 2, 0);
      b.set(2, 0, D - 2, 0); b.set(2, -1, D - 2, 0);
      for (let i = 0; i < 3; i++) b.set(2, -1 - i, D - 3 - i, B.cobblestone_stairs | (b.d(0) << 12));
      b.chest(W - 2, -3, D - 2, 0, 'jungle_temple'); b.chest(W - 2, -3, 2, 2, 'jungle_temple');
      b.set(5, 1, D - 2, B.chiseled_stone_bricks); b.torch(5, 2, D - 1, 0);
      for (let v = 1; v < D; v += 2) for (let h = 2; h <= 8; h++) { if (b.rnd(-1, h, v) < 0.3) b.set(-1, h, v, B.vine | (8 << 12)); }
    } }] };
  }
  // ================================================================ IGLOO
  planIgloo(c) {
    const x = c.cx * 16 + 8, z = c.cz * 16 + 8, cl = this.gen.climateCached(x, z);
    if ((cl.biome !== BIO.SNOWY_PLAINS && cl.biome !== BIO.SNOWY_TAIGA) || cl.amp > 1) return null;
    const y = this.surf(x, z) + 1; if (y <= SEA) return null;
    const seed = c.rng.u32(), F = c.rng.int(4);
    return { type: 'igloo', x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6, cy: y, pieces: [{ x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6, build: (ctx) => {
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        const d = Math.sqrt(dx * dx + dz * dz);
        for (let h = -1; h <= 4; h++) {
          const r = h < 0 ? 4.4 : [4.4, 4.2, 3.6, 2.6, 1.2][h];
          if (d <= r) {
            const shell = h === 4 || d > r - 1.2 || h < 0;
            ctx.set(x + dx, y + h, z + dz, shell ? (h < 0 ? B.snow : B.snow) : 0);
          }
        }
        if (d <= 3.4) ctx.set(x + dx, y - 1, z + dz, B.snow);
        if (d <= 3.4 && d > 0) ctx.set(x + dx, y, z + dz, 0);
      }
      const b = new Bld(ctx, x, y, z, F, seed);
      // entrance tunnel
      b.fill(-1, 0, -6, 1, 2, -4, B.snow); b.fill(0, 0, -6, 0, 1, -3, 0);
      b.fill(-3, 0, -3, 3, 0, 3, 0);
      b.bed(-2, 0, 1, 2); b.face(2, 0, 2, B.furnace, 3); b.set(2, 0, 0, B.crafting_table);
      b.set(0, 0, 0, B.white_carpet); b.set(0, 0, 1, B.white_carpet); b.set(-1, 0, -1, B.red_carpet);
      b.set(0, 3, 0, B.lantern | (1 << 12));
      b.chest(-2, 0, -2, 1, 'igloo');
      b.set(-1, 0, -4, B.lantern); b.set(1, 0, -4, B.lantern);
    } }] };
  }
  // ================================================================ WITCH HUT
  planWitchHut(c) {
    const x = c.cx * 16 + 8, z = c.cz * 16 + 8, cl = this.gen.climateCached(x, z);
    if (cl.biome !== BIO.SWAMP) return null;
    const seed = c.rng.u32(), F = c.rng.int(4), y = SEA + 3;
    return { type: 'witch_hut', x0: x - 5, z0: z - 5, x1: x + 5, z1: z + 5, cy: y, pieces: [{ x0: x - 5, z0: z - 5, x1: x + 5, z1: z + 5, build: (ctx) => {
      const b = new Bld(ctx, x - 2, y, z - 3, F, seed);
      for (const [u, v] of [[0, 1], [4, 1], [0, 6], [4, 6]]) for (let h = -1; h >= -7; h--) { const cur = b.get(u, h, v); if (cur < 0) break; const id = cur & 4095; if (id !== 0 && !FLUID[id] && !REPL[id] && !PLANT[id]) break; b.set(u, h, v, B.oak_log); }
      b.clear(-1, -1, 5, 8, 1, 6);
      b.fill(0, 0, 0, 4, 0, 7, B.spruce_planks);
      for (let h = 1; h <= 3; h++) for (let u = 0; u <= 4; u++) for (let v = 1; v <= 7; v++) {
        if (u === 0 || u === 4 || v === 1 || v === 7) b.set(u, h, v, (u === 0 || u === 4) && (v === 1 || v === 7) ? B.oak_log : B.spruce_planks);
      }
      b.set(2, 1, 1, 0); b.set(2, 2, 1, 0);
      b.set(0, 2, 4, B.spruce_fence); b.set(4, 2, 4, B.spruce_fence); b.set(2, 2, 7, B.spruce_fence);
      b.roofGable(0, 4, 1, 7, 4, B.spruce_stairs, B.spruce_planks, B.spruce_slab);
      b.set(1, 1, 6, B.crafting_table); b.set(3, 1, 6, B.cauldron); b.set(1, 1, 2, B.spruce_fence); b.set(1, 2, 2, B.red_mushroom);
      b.set(0, 1, 0, B.spruce_fence); b.set(4, 1, 0, B.spruce_fence);
      ctx.spawn('witch', b.X(2, 4) + 0.5, y + 1, b.Z(2, 4) + 0.5);
    } }] };
  }
  // ================================================================ RUINED PORTAL
  planRuinedPortal(c) {
    const x = c.cx * 16 + 8, z = c.cz * 16 + 8, cl = this.gen.climateCached(x, z);
    if (cl.h < SEA + 1 || cl.amp > 3 || this.inVillage(x, z)) return null;
    const y = this.surf(x, z); if (y < SEA) return null;
    const seed = c.rng.u32(), axisX = c.rng.next() < 0.5, big = c.rng.next() < 0.2;
    const w = big ? 5 : 4, hh = big ? 7 : 5;
    return { type: 'ruined_portal', x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6, cy: y, pieces: [{ x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6, build: (ctx) => {
      for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
        const d = Math.sqrt(dx * dx + dz * dz), r = hashF2(seed, x + dx, z + dz);
        if (d > 5 || r < d / 6) continue;
        const sy = this.surf(x + dx, z + dz);
        const cur = ctx.get(x + dx, sy, z + dz) & 4095;
        if (cur === 0 || FLUID[cur]) continue;
        ctx.set(x + dx, sy, z + dz, r < 0.2 ? B.magma_block : r < 0.3 ? B.gravel : B.netherrack);
        const a = ctx.get(x + dx, sy + 1, z + dz) & 4095;
        if (PLANT[a] || REPL[a]) ctx.set(x + dx, sy + 1, z + dz, r > 0.93 ? B.fire : 0);
      }
      for (let i = 0; i < w; i++) for (let j = 0; j < hh; j++) {
        const edge = i === 0 || i === w - 1 || j === 0 || j === hh - 1;
        const px = axisX ? x - (w >> 1) + i : x, pz = axisX ? z : z - (w >> 1) + i;
        const r = hashF3(seed, px, y + j, pz);
        if (edge) { if (r < 0.72) ctx.set(px, y + j, pz, r < 0.12 ? B.crying_obsidian : B.obsidian); else if (j === 0) ctx.set(px, y + j, pz, B.netherrack); }
        else ctx.set(px, y + j, pz, 0);
      }
      const chx = axisX ? x + 2 : x + 2, chz = axisX ? z + 2 : z - 2;
      ctx.chest(chx, this.surf(chx, chz) + 1, chz, 0, 'ruined_portal', hash2(seed, chx, chz));
    } }] };
  }
  // ================================================================ MINESHAFT
  planMineshaft(c) {
    const rng = c.rng, x = c.cx * 16 + 8, z = c.cz * 16 + 8;
    const cl = this.gen.climateCached(x, z);
    if (cl.h < SEA - 10) return null;
    const y = rng.range(22, 42);
    const pieces = [], boxes = [];
    const hit = (bx) => { for (const q of boxes) if (bx[0] <= q[3] && bx[3] >= q[0] && bx[1] <= q[4] && bx[4] >= q[1] && bx[2] <= q[5] && bx[5] >= q[2]) return true; return false; };
    const seed = rng.u32();
    // room
    const rw = rng.range(4, 6), rd = rng.range(4, 6), rh = rng.range(3, 5);
    const room = [x - rw, y, z - rd, x + rw, y + rh, z + rd];
    boxes.push(room);
    pieces.push(this.msRoom(room, seed));
    const queue = [];
    for (let d = 0; d < 4; d++) if (rng.next() < 0.85) {
      const sx = d === 1 ? room[3] + 1 : d === 3 ? room[0] - 1 : x + rng.range(-rw + 2, rw - 2);
      const sz = d === 2 ? room[5] + 1 : d === 0 ? room[2] - 1 : z + rng.range(-rd + 2, rd - 2);
      queue.push({ x: sx, y, z: sz, d, depth: 0 });
    }
    let guard = 0;
    while (queue.length && guard++ < 60) {
      const q = queue.shift();
      if (q.depth > 7 || Math.abs(q.x - x) > 72 || Math.abs(q.z - z) > 72 || q.y < 12 || q.y > 60) continue;
      const kind = rng.next();
      const dx = FACING_DX[q.d], dz = FACING_DZ[q.d];
      if (kind < 0.7) {
        const segs = rng.range(2, 5), len = segs * 5;
        const ex = q.x + dx * (len - 1), ez = q.z + dz * (len - 1);
        const px = dz !== 0 ? 1 : 0, pz = dx !== 0 ? 1 : 0;
        const bx = [Math.min(q.x, ex) - px, q.y, Math.min(q.z, ez) - pz, Math.max(q.x, ex) + px, q.y + 2, Math.max(q.z, ez) + pz];
        if (hit(bx)) continue;
        boxes.push(bx);
        pieces.push(this.msCorridor(bx, q.d, rng.next() < 0.7, rng.u32()));
        const nx = ex + dx, nz = ez + dz;
        const nk = rng.next();
        if (nk < 0.55) queue.push({ x: nx, y: q.y, z: nz, d: q.d, depth: q.depth + 1 });
        else if (nk < 0.8) {
          const cb = [nx - 1 + dx, q.y, nz - 1 + dz, nx + 1 + dx, q.y + (rng.next() < 0.4 ? 5 : 2), nz + 1 + dz];
          if (!hit(cb)) {
            boxes.push(cb); pieces.push(this.msCrossing(cb, rng.u32()));
            const ccx = nx + dx, ccz = nz + dz;
            for (let dd = 0; dd < 4; dd++) if (dd !== ((q.d + 2) & 3) && rng.next() < 0.75) queue.push({ x: ccx + FACING_DX[dd] * 2, y: q.y, z: ccz + FACING_DZ[dd] * 2, d: dd, depth: q.depth + 1 });
          }
        } else if (nk < 0.95) {
          const down = rng.next() < 0.6 ? -1 : 1, sl = 5;
          const sy = down < 0 ? q.y - 4 : q.y;
          const ex2 = nx + dx * (sl + 1), ez2 = nz + dz * (sl + 1);
          const px2 = dz !== 0 ? 1 : 0, pz2 = dx !== 0 ? 1 : 0;
          const sb = [Math.min(nx, ex2) - px2, sy, Math.min(nz, ez2) - pz2, Math.max(nx, ex2) + px2, sy + 6, Math.max(nz, ez2) + pz2];
          if (!hit(sb)) { boxes.push(sb); pieces.push(this.msStairs(nx, q.y, nz, q.d, down, sl)); queue.push({ x: ex2 + dx, y: q.y + down * 4, z: ez2 + dz, d: q.d, depth: q.depth + 1 }); }
        }
      } else {
        const cb = [q.x - 1, q.y, q.z - 1, q.x + 1, q.y + 2, q.z + 1];
        const cx2 = q.x + dx, cz2 = q.z + dz;
        const cb2 = [cx2 - 1, q.y, cz2 - 1, cx2 + 1, q.y + 2, cz2 + 1];
        if (hit(cb2)) continue;
        boxes.push(cb2); pieces.push(this.msCrossing(cb2, rng.u32()));
        for (let dd = 0; dd < 4; dd++) if (dd !== ((q.d + 2) & 3) && rng.next() < 0.7) queue.push({ x: cx2 + FACING_DX[dd] * 2, y: q.y, z: cz2 + FACING_DZ[dd] * 2, d: dd, depth: q.depth + 1 });
        void cb;
      }
    }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const b of boxes) { x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[2]); x1 = Math.max(x1, b[3]); z1 = Math.max(z1, b[5]); }
    return { type: 'mineshaft', x0, z0, x1, z1, cy: y, pieces };
  }
  msRoom(bx, seed) {
    return { x0: bx[0], z0: bx[2], x1: bx[3], z1: bx[5], build: (ctx) => {
      ctx.fill(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], 0);
      for (let x = bx[0]; x <= bx[3]; x++) for (let z = bx[2]; z <= bx[5]; z++) { if (ctx.get(x, bx[1] - 1, z) === 0) ctx.set(x, bx[1] - 1, z, B.dirt); }
    } };
  }
  msCorridor(bx, d, rails, seed) {
    return { x0: bx[0], z0: bx[2], x1: bx[3], z1: bx[5], build: (ctx) => {
      const alongX = d === 1 || d === 3;
      for (let x = bx[0]; x <= bx[3]; x++) for (let z = bx[2]; z <= bx[5]; z++) {
        const t = alongX ? x : z;
        const side = alongX ? z - bx[2] : x - bx[0];
        const support = ((t % 5) + 5) % 5 === 0;
        for (let h = 0; h <= 2; h++) {
          const y = bx[1] + h, cur = ctx.get(x, y, z);
          if (cur < 0) continue;
          let v = 0;
          if (support) { if (h < 2 && side !== 1) v = B.oak_fence; else if (h === 2) v = B.oak_planks; }
          else if (hashF3(seed, x, y, z) < 0.035) v = B.cobweb;
          ctx.set(x, y, z, v);
        }
        if (ctx.get(x, bx[1] - 1, z) === 0 || FLUID[ctx.get(x, bx[1] - 1, z) & 4095]) ctx.set(x, bx[1] - 1, z, B.oak_planks);
        if (rails && side === 1 && hashF3(seed, x, 7, z) < 0.8 && ctx.get(x, bx[1], z) === 0) ctx.set(x, bx[1], z, B.rail | ((alongX ? 1 : 0) << 12));
        if (!support && side !== 1 && hashF3(seed, x, 3, z) < 0.012) {
          ctx.chest(x, bx[1], z, alongX ? (side === 0 ? 2 : 0) : (side === 0 ? 1 : 3), 'mineshaft', hash3(seed, x, bx[1], z));
        }
        if (support && side === 1 && hashF3(seed, x, 5, z) < 0.12) ctx.set(x, bx[1] + 1, z, B.torch);
      }
      if (hashF2(seed, 1, 2) < 0.08) {
        const mx = (bx[0] + bx[3]) >> 1, mz = (bx[2] + bx[5]) >> 1;
        ctx.spawner(mx, bx[1], mz, 'spider');
        for (let i = 0; i < 12; i++) { const ox = mx + Math.floor(hashF3(seed, i, 1, 0) * 5) - 2, oz = mz + Math.floor(hashF3(seed, i, 2, 0) * 5) - 2, oy = bx[1] + Math.floor(hashF3(seed, i, 3, 0) * 3); if (ctx.get(ox, oy, oz) === 0) ctx.set(ox, oy, oz, B.cobweb); }
      }
    } };
  }
  msCrossing(bx, seed) {
    return { x0: bx[0], z0: bx[2], x1: bx[3], z1: bx[5], build: (ctx) => {
      ctx.fill(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], 0);
      for (let x = bx[0]; x <= bx[3]; x++) for (let z = bx[2]; z <= bx[5]; z++) if (ctx.get(x, bx[1] - 1, z) === 0) ctx.set(x, bx[1] - 1, z, B.oak_planks);
      if (bx[4] - bx[1] > 3) for (const [x, z] of [[bx[0], bx[2]], [bx[3], bx[2]], [bx[0], bx[5]], [bx[3], bx[5]]]) for (let y = bx[1]; y <= bx[4]; y++) ctx.set(x, y, z, B.oak_planks);
    } };
  }
  msStairs(x, y, z, d, dir, len) {
    const dx = FACING_DX[d], dz = FACING_DZ[d];
    const px = dz !== 0 ? 1 : 0, pz = dx !== 0 ? 1 : 0;
    const ex = x + dx * (len + 1), ez = z + dz * (len + 1);
    return { x0: Math.min(x, ex) - px, z0: Math.min(z, ez) - pz, x1: Math.max(x, ex) + px, z1: Math.max(z, ez) + pz, build: (ctx) => {
      for (let i = 0; i <= len + 1; i++) {
        const cx = x + dx * i, cz = z + dz * i;
        const fy = y + dir * Math.max(0, Math.min(4, i - 1));
        for (let s = -1; s <= 1; s++) {
          const xx = cx + px * s, zz = cz + pz * s;
          for (let h = 0; h <= 3; h++) ctx.set(xx, fy + h, zz, 0);
          if (ctx.get(xx, fy - 1, zz) === 0) ctx.set(xx, fy - 1, zz, B.oak_planks);
        }
      }
    } };
  }
  // ================================================================ DUNGEON (chunk local)
  dungeon(ctx, r) {
    const b = ctx.b;
    const w = r.range(3, 4), d = r.range(3, 4);
    const lx = r.range(w + 1, 14 - w), lz = r.range(d + 1, 14 - d), y = r.range(10, 50);
    const mob = r.pick(['zombie', 'zombie', 'skeleton', 'spider']);
    const seedC = r.u32();
    // check floor/ceiling solid and a few openings
    let openings = 0;
    for (let x = lx - w - 1; x <= lx + w + 1; x++) for (let z = lz - d - 1; z <= lz + d + 1; z++) {
      const fl = b[((y - 1) << 8) | (z << 4) | x] & 4095, ce = b[((y + 4) << 8) | (z << 4) | x] & 4095;
      if (!OPAQUE[fl] || !OPAQUE[ce]) return;
      if ((x === lx - w - 1 || x === lx + w + 1 || z === lz - d - 1 || z === lz + d + 1)) {
        if ((b[((y + 1) << 8) | (z << 4) | x] & 4095) === 0 && (b[((y + 2) << 8) | (z << 4) | x] & 4095) === 0) openings++;
      }
    }
    if (openings < 1 || openings > 6) return;
    for (let x = lx - w - 1; x <= lx + w + 1; x++) for (let z = lz - d - 1; z <= lz + d + 1; z++) for (let yy = y - 1; yy <= y + 4; yy++) {
      const p = (yy << 8) | (z << 4) | x;
      const wall = x === lx - w - 1 || x === lx + w + 1 || z === lz - d - 1 || z === lz + d + 1;
      if (yy === y - 1) b[p] = hashF3(seedC, x, yy, z) < 0.6 ? B.mossy_cobblestone : B.cobblestone;
      else if (yy === y + 4) b[p] = B.cobblestone;
      else if (wall) { if ((b[p] & 4095) !== 0) b[p] = B.cobblestone; }
      else b[p] = 0;
    }
    ctx.spawner(ctx.x0 + lx, y, ctx.z0 + lz, mob);
    let placed = 0;
    for (let a = 0; a < 6 && placed < 2; a++) {
      const side = r.int(4);
      const x = side === 0 ? lx - w : side === 1 ? lx + w : r.range(lx - w, lx + w);
      const z = side === 2 ? lz - d : side === 3 ? lz + d : r.range(lz - d, lz + d);
      if (x === lx && z === lz) continue;
      const p = (y << 8) | (z << 4) | x;
      if (b[p] !== 0) continue;
      ctx.chest(ctx.x0 + x, y, ctx.z0 + z, [1, 3, 2, 0][side], 'dungeon', r.u32());
      placed++;
    }
  }
  // ================================================================ NETHER FORTRESS
  planFortress(c) {
    const rng = c.rng, x = c.cx * 16 + 8, z = c.cz * 16 + 8, y = rng.range(58, 70);
    const pieces = [], boxes = [];
    const hit = (bx) => { for (const q of boxes) if (bx[0] <= q[2] && bx[2] >= q[0] && bx[1] <= q[3] && bx[3] >= q[1]) return true; return false; };
    const seed = rng.u32();
    const queue = [{ x, z, from: -1, depth: 0, kind: 'cross' }];
    let guard = 0, spawners = 0, warts = 0;
    while (queue.length && guard++ < 50) {
      const q = queue.shift();
      if (Math.abs(q.x - x) > 90 || Math.abs(q.z - z) > 90) continue;
      if (q.kind === 'cross') {
        const bx = [q.x - 3, q.z - 3, q.x + 3, q.z + 3];
        if (q.depth > 0 && hit(bx)) continue;
        boxes.push(bx);
        const sp = spawners < 2 && q.depth > 0 && rng.next() < 0.35; if (sp) spawners++;
        pieces.push(this.nfCross(q.x, y, q.z, seed, sp));
        if (q.depth >= 6) continue;
        for (let d = 0; d < 4; d++) {
          if (d === q.from) continue;
          if (rng.next() < 0.7) {
            const corridor = rng.next() < 0.3;
            const len = rng.range(9, 17);
            queue.push({ x: q.x + FACING_DX[d] * 4, z: q.z + FACING_DZ[d] * 4, d, len, depth: q.depth + 1, kind: corridor ? 'corr' : 'bridge' });
          }
        }
      } else {
        const d = q.d, dx = FACING_DX[d], dz = FACING_DZ[d];
        const ex = q.x + dx * (q.len - 1), ez = q.z + dz * (q.len - 1);
        const px = dz !== 0 ? 2 : 0, pz = dx !== 0 ? 2 : 0;
        const bx = [Math.min(q.x, ex) - px, Math.min(q.z, ez) - pz, Math.max(q.x, ex) + px, Math.max(q.z, ez) + pz];
        if (hit(bx)) continue;
        boxes.push(bx);
        pieces.push(q.kind === 'corr' ? this.nfCorridor(bx, y, d, seed ^ q.depth) : this.nfBridge(bx, y, d, seed));
        const nx = ex + dx * 4, nz = ez + dz * 4;
        const nk = rng.next();
        if (nk < 0.62) queue.push({ x: nx, z: nz, from: (d + 2) & 3, depth: q.depth + 1, kind: 'cross' });
        else if (nk < 0.85 && warts < 2) {
          const rb = [nx - 4, nz - 4, nx + 4, nz + 4];
          if (!hit(rb)) { boxes.push(rb); warts++; pieces.push(this.nfWartRoom(nx, y, nz, (d + 2) & 3, seed)); }
        }
      }
    }
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const b of boxes) { x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]); }
    return { type: 'fortress', x0, z0, x1, z1, cy: y, pieces };
  }
  nfPillar(ctx, x, y, z) {
    for (let yy = y; yy > 4; yy--) { const c = ctx.get(x, yy, z); if (c < 0) return; const id = c & 4095; if (id !== 0 && id !== B.lava && !REPL[id] && id !== B.fire) return; ctx.set(x, yy, z, B.nether_bricks); }
  }
  nfBridge(bx, y, d, seed) {
    return { x0: bx[0], z0: bx[1], x1: bx[2], z1: bx[3], build: (ctx) => {
      const alongX = d === 1 || d === 3;
      for (let x = bx[0]; x <= bx[2]; x++) for (let z = bx[1]; z <= bx[3]; z++) {
        if (!ctx.inside(x, z)) continue;
        const side = alongX ? z - bx[1] : x - bx[0], t = alongX ? x : z;
        ctx.set(x, y, z, B.nether_bricks); ctx.set(x, y - 1, z, B.nether_bricks);
        for (let h = 1; h <= 4; h++) ctx.set(x, y + h, z, 0);
        if (side === 0 || side === 4) ctx.set(x, y + 1, z, B.nether_brick_fence);
        if (((t % 6) + 6) % 6 === 0 && (side === 0 || side === 4 || side === 2)) this.nfPillar(ctx, x, y - 2, z);
        else if (((t % 6) + 6) % 6 === 0) ctx.set(x, y - 2, z, B.nether_bricks);
      }
    } };
  }
  nfCross(x, y, z, seed, spawner) {
    return { x0: x - 3, z0: z - 3, x1: x + 3, z1: z + 3, build: (ctx) => {
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const X = x + dx, Z = z + dz; if (!ctx.inside(X, Z)) continue;
        ctx.set(X, y, Z, B.nether_bricks); ctx.set(X, y - 1, Z, B.nether_bricks);
        for (let h = 1; h <= 5; h++) ctx.set(X, y + h, Z, 0);
        const edge = Math.abs(dx) === 3 || Math.abs(dz) === 3, mid = Math.abs(dx) <= 2 && Math.abs(dz) <= 2 && (dx === 0 || dz === 0);
        if (edge && !(Math.abs(dx) <= 2 && (Math.abs(dz) === 3)) && !(Math.abs(dz) <= 2 && Math.abs(dx) === 3)) ctx.set(X, y + 1, Z, B.nether_brick_fence);
        if (Math.abs(dx) === 3 && Math.abs(dz) === 3) { for (let h = 1; h <= 3; h++) ctx.set(X, y + h, Z, B.nether_bricks); ctx.set(X, y + 4, Z, B.nether_brick_fence); }
        if ((Math.abs(dx) === 3 || dx === 0) && (Math.abs(dz) === 3 || dz === 0)) this.nfPillar(ctx, X, y - 2, Z);
        void mid;
      }
      if (spawner) {
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) ctx.set(x + dx, y + 1, z + dz, B.nether_bricks);
        ctx.spawner(x, y + 2, z, 'imp');
        ctx.chest(x + 2, y + 1, z + 2, 0, 'fortress', hash3(seed, x, y, z));
      }
    } };
  }
  nfCorridor(bx, y, d, seed) {
    return { x0: bx[0], z0: bx[1], x1: bx[2], z1: bx[3], build: (ctx) => {
      const alongX = d === 1 || d === 3;
      for (let x = bx[0]; x <= bx[2]; x++) for (let z = bx[1]; z <= bx[3]; z++) {
        if (!ctx.inside(x, z)) continue;
        const side = alongX ? z - bx[1] : x - bx[0], t = alongX ? x : z;
        ctx.set(x, y, z, B.nether_bricks); ctx.set(x, y - 1, z, B.nether_bricks);
        for (let h = 1; h <= 4; h++) {
          let v = 0;
          if (side === 0 || side === 4) v = (h === 2 || h === 3) && ((t & 1) === 0) ? B.nether_brick_fence : B.nether_bricks;
          ctx.set(x, y + h, z, v);
        }
        ctx.set(x, y + 5, z, B.nether_bricks);
        if (((t % 6) + 6) % 6 === 0 && (side === 0 || side === 4)) this.nfPillar(ctx, x, y - 2, z);
        if (side === 1 && hashF3(seed, x, y, z) < 0.03) ctx.chest(x, y + 1, z, alongX ? 2 : 1, 'fortress', hash3(seed, x, y, z));
      }
    } };
  }
  // ================================================================ STRONGHOLD
  // Portal room (a raised ring of twelve end portal frames over a lava pit), a corridor to a hub, a library
  // and a storeroom off the hub, and a ladder shaft that climbs to just under the surface.
  planStronghold(c) {
    const rng = c.rng, x = c.cx * 16 + 8, z = c.cz * 16 + 8;
    const cl = this.gen.climateCached(x, z);
    if (cl.h < SEA - 6 || cl.biome === BIO.MUSHROOM) return null;
    const y = rng.range(16, 30), seed = rng.u32(), surf = Math.floor(cl.h);
    const sb = (X, Y, Z) => { const h = hashF3(seed, X, Y, Z); return h < 0.2 ? B.mossy_stone_bricks : h < 0.34 ? B.cracked_stone_bricks : B.stone_bricks; };
    const room = (ctx, x0, y0, z0, x1, y1, z1) => {
      for (let X = Math.max(x0, ctx.x0); X <= Math.min(x1, ctx.x0 + 15); X++) for (let Z = Math.max(z0, ctx.z0); Z <= Math.min(z1, ctx.z0 + 15); Z++)
        for (let Y = y0; Y <= y1; Y++) ctx.set(X, Y, Z, X === x0 || X === x1 || Z === z0 || Z === z1 || Y === y0 || Y === y1 ? sb(X, Y, Z) : 0);
    };
    const hole = (ctx, x0, y0, z0, x1, y1, z1) => ctx.fill(x0, y0, z0, x1, y1, z1, 0);
    const torch = (ctx, X, Y, Z, f) => ctx.set(X, Y, Z, B.torch | ((1 + f) << 12));
    const pieces = [];
    // portal room
    pieces.push({ x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6, build: (ctx) => {
      room(ctx, x - 6, y, z - 6, x + 6, y + 9, z + 6);
      for (let dz = -3; dz <= 2; dz++) for (let dx = -3; dx <= 3; dx++) {
        const pit = Math.abs(dx) <= 1 && Math.abs(dz) <= 1;
        ctx.set(x + dx, y + 1, z + dz, sb(x + dx, y + 1, z + dz)); ctx.set(x + dx, y + 2, z + dz, pit ? B.lava : B.stone_bricks);
      }
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2 || (Math.abs(dx) === 2 && Math.abs(dz) === 2)) continue;
        const f = dz === -2 ? 2 : dz === 2 ? 0 : dx === -2 ? 1 : 3, eye = hashF3(seed ^ 9, x + dx, y, z + dz) < 0.1 ? 4 : 0;
        ctx.set(x + dx, y + 3, z + dz, B.end_portal_frame | ((f | eye) << 12));
      }
      for (let dx = -1; dx <= 1; dx++) { ctx.set(x + dx, y + 2, z + 3, B.stone_brick_stairs); ctx.set(x + dx, y + 1, z + 4, B.stone_brick_stairs); }
      // lava glow behind iron bars at the back, torches, and the doorway south
      for (let dx = -4; dx <= 4; dx += 2) { ctx.set(x + dx, y + 4, z - 6, B.iron_bars); ctx.set(x + dx, y + 5, z - 6, B.iron_bars); }
      for (const dz of [-3, 3]) { torch(ctx, x - 5, y + 4, z + dz, 1); torch(ctx, x + 5, y + 4, z + dz, 3); }
      hole(ctx, x - 1, y + 1, z + 6, x + 1, y + 3, z + 6);
    } });
    // corridor to the hub
    pieces.push({ x0: x - 2, z0: z + 6, x1: x + 2, z1: z + 20, build: (ctx) => {
      room(ctx, x - 2, y, z + 6, x + 2, y + 4, z + 20);
      hole(ctx, x - 1, y + 1, z + 6, x + 1, y + 3, z + 6); hole(ctx, x - 1, y + 1, z + 20, x + 1, y + 3, z + 20);
      for (let dz = 9; dz <= 18; dz += 4) { torch(ctx, x - 1, y + 2, z + dz, 1); torch(ctx, x + 1, y + 2, z + dz + 2, 3); }
      for (let dz = 7; dz <= 19; dz++) if (hashF3(seed ^ 3, x, y, z + dz) < 0.1) ctx.set(x + (hashF3(seed, dz, 1, 2) < 0.5 ? -1 : 1), y + 3, z + dz, B.cobweb);
    } });
    // hub
    pieces.push({ x0: x - 5, z0: z + 20, x1: x + 5, z1: z + 30, build: (ctx) => {
      room(ctx, x - 5, y, z + 20, x + 5, y + 6, z + 30);
      hole(ctx, x - 1, y + 1, z + 20, x + 1, y + 3, z + 20);
      hole(ctx, x - 5, y + 1, z + 24, x - 5, y + 2, z + 26); hole(ctx, x + 5, y + 1, z + 24, x + 5, y + 2, z + 26); hole(ctx, x, y + 1, z + 30, x, y + 2, z + 30);
      for (let dx = -3; dx <= 3; dx++) for (let dz = 22; dz <= 28; dz++) if (Math.abs(dx) === 3 || dz === 22 || dz === 28) ctx.set(x + dx, y + 5, z + dz, B.stone_brick_slab | (1 << 12));
      torch(ctx, x - 4, y + 3, z + 22, 1); torch(ctx, x + 4, y + 3, z + 28, 3); torch(ctx, x - 4, y + 3, z + 28, 1); torch(ctx, x + 4, y + 3, z + 22, 3);
    } });
    // library: shelves along the walls, a reading table and a chest
    pieces.push({ x0: x - 17, z0: z + 19, x1: x - 5, z1: z + 31, build: (ctx) => {
      room(ctx, x - 17, y, z + 19, x - 5, y + 7, z + 31);
      hole(ctx, x - 5, y + 1, z + 24, x - 5, y + 2, z + 26);
      for (let X = x - 16; X <= x - 6; X++) for (let Z = z + 20; Z <= z + 30; Z++) {
        const wall = X === x - 16 || Z === z + 20 || Z === z + 30 || (X === x - 6 && (Z < z + 23 || Z > z + 27));
        if (wall) for (let Y = y + 1; Y <= y + 3; Y++) ctx.set(X, Y, Z, hashF3(seed ^ 5, X, Y, Z) < 0.12 ? B.cobweb : B.bookshelf);
      }
      for (let Z = z + 23; Z <= z + 27; Z += 2) for (const X of [x - 12, x - 10]) { ctx.set(X, y + 1, Z, B.bookshelf); ctx.set(X, y + 2, Z, B.bookshelf); }
      ctx.set(x - 14, y + 1, z + 25, B.oak_fence); ctx.set(x - 14, y + 2, z + 25, B.oak_planks); ctx.set(x - 14, y + 3, z + 25, B.lantern);
      ctx.chest(x - 15, y + 1, z + 29, 0, 'stronghold', hash3(seed, x, y, z) ^ 11);
      torch(ctx, x - 15, y + 5, z + 25, 1);
    } });
    // storeroom
    pieces.push({ x0: x + 5, z0: z + 21, x1: x + 13, z1: z + 29, build: (ctx) => {
      room(ctx, x + 5, y, z + 21, x + 13, y + 5, z + 29);
      hole(ctx, x + 5, y + 1, z + 24, x + 5, y + 2, z + 26);
      ctx.chest(x + 12, y + 1, z + 22, 3, 'stronghold', hash3(seed, x, y, z) ^ 21);
      ctx.chest(x + 12, y + 1, z + 28, 3, 'stronghold', hash3(seed, x, y, z) ^ 31);
      ctx.barrel(x + 12, y + 1, z + 25, 'stronghold', hash3(seed, x, y, z) ^ 41);
      ctx.set(x + 7, y + 4, z + 22, B.cobweb); ctx.set(x + 11, y + 4, z + 28, B.cobweb);
      torch(ctx, x + 6, y + 3, z + 25, 1);
    } });
    // ladder shaft up to a few blocks under the surface
    const top = Math.max(y + 8, Math.min(y + 60, surf - 5));
    pieces.push({ x0: x - 2, z0: z + 30, x1: x + 2, z1: z + 34, build: (ctx) => {
      room(ctx, x - 2, y, z + 30, x + 2, top, z + 34);
      hole(ctx, x, y + 1, z + 30, x, y + 2, z + 30);
      for (let Y = y + 1; Y < top; Y++) ctx.set(x, Y, z + 33, B.ladder | (0 << 12));
      for (let Y = y + 6; Y < top; Y += 8) torch(ctx, x - 1, Y, z + 32, 1);
    } });
    return { type: 'stronghold', x0: x - 17, z0: z - 6, x1: x + 13, z1: z + 34, cy: y, target: [x, y + 3, z], pieces };
  }
  // ================================================================ END CITY
  // A purpur hall with a tower of stacked rooms on top, and often a ship moored beside the top floor
  // (the ship's chest always holds an elytra).
  planEndCity(c) {
    const rng = c.rng, x = c.cx * 16 + 8, z = c.cz * 16 + 8;
    if (!this.gen.column || Math.hypot(x, z) < END_OUTER + 40) return null;
    const col = this.gen.column(x, z), cn = this.gen.column(x, z - 5), cs = this.gen.column(x, z + 5);
    if (!col || !cn || !cs || col.top - col.bot < 14) return null;
    const s = Math.floor(col.top) + 1, seed = rng.u32(), floors = rng.range(3, 5), ship = rng.next() < 0.5;
    const P = B.purpur_block, PP = B.purpur_pillar, EB = B.end_stone_bricks, GL = B.magenta_stained_glass, ROD = B.end_rod;
    const topY = s + 6 + floors * 5;
    const pieces = [];
    const shell = (ctx, x0, y0, z0, x1, y1, z1, floor) => {
      for (let X = x0; X <= x1; X++) for (let Z = z0; Z <= z1; Z++) for (let Y = y0; Y <= y1; Y++) {
        const ex = X === x0 || X === x1, ez = Z === z0 || Z === z1;
        let v = 0;
        if (Y === y0) v = floor; else if (Y === y1) v = P;
        else if (ex && ez) v = PP;
        else if (ex || ez) v = (Y - y0) % 4 === 2 && ((ex ? Z : X) & 1) === 0 ? GL : P;
        ctx.set(X, Y, Z, v);
      }
    };
    pieces.push({ x0: x - 7, z0: z - 7, x1: x + 7, z1: z + 7, build: (ctx) => {
      // foundation into the island, then the hall
      for (let X = x - 5; X <= x + 5; X++) for (let Z = z - 5; Z <= z + 5; Z++) for (let Y = s - 1; Y >= s - 6; Y--) { const cur = ctx.get(X, Y, Z); if (cur < 0 || (cur & 4095) === B.end_stone) break; ctx.set(X, Y, Z, EB); }
      shell(ctx, x - 5, s - 1, z - 5, x + 5, s + 5, z + 5, EB);
      for (const [dx, dz] of [[0, -5], [0, 5], [-5, 0], [5, 0]]) ctx.fill(x + dx, s, z + dz, x + dx, s + 2, z + dz, 0);
      for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) ctx.set(x + dx, s + 5, z + dz, ROD | (2 << 12));
      // the tower: stacked 7x7 rooms with a ladder up the north wall
      for (let f = 0; f < floors; f++) {
        const y0 = s + 5 + f * 5;
        shell(ctx, x - 3, y0, z - 3, x + 3, y0 + 5, z + 3, EB);
        for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) ctx.set(x + dx, y0 + 4, z + dz, ROD | (2 << 12));
        ctx.set(x, y0 + 4, z, B.end_rod | (3 << 12));
      }
      // (in the hall the ladder needs a pillar to hang on; higher up the tower's north wall carries it)
      for (let Y = s; Y <= s + 4; Y++) ctx.set(x, Y, z - 3, PP);
      for (let Y = s; Y < topY; Y++) ctx.set(x, Y, z - 2, B.ladder | (2 << 12));
      // top room: wider, with the loot and an open door toward the ship
      shell(ctx, x - 4, topY, z - 4, x + 4, topY + 5, z + 4, EB);
      ctx.set(x, topY, z - 2, B.ladder | (2 << 12));
      for (let X = x - 5; X <= x + 5; X++) for (let Z = z - 5; Z <= z + 5; Z++) if (Math.abs(X - x) === 5 || Math.abs(Z - z) === 5) ctx.set(X, topY + 5, Z, B.purpur_slab);
      ctx.chest(x + 2, topY + 1, z + 2, 0, 'end_city', hash3(seed, x, topY, z));
      ctx.chest(x - 2, topY + 1, z + 2, 0, 'end_city', hash3(seed, x, topY, z) ^ 77);
      if (ship) ctx.fill(x - 1, topY + 1, z - 4, x + 1, topY + 2, z - 4, 0);
      for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) ctx.set(x + dx, topY + 6, z + dz, ROD | (2 << 12));
    } });
    if (ship) {
      const sy = topY, bz0 = z - 30, bz1 = z - 9;          // hull from bow (bz0) to stern (bz1), deck at sy
      pieces.push({ x0: x - 5, z0: bz0 - 1, x1: x + 5, z1: z - 4, build: (ctx) => {
        // bridge from the top room to the stern
        for (let Z = bz1 + 1; Z <= z - 5; Z++) for (let dx = -1; dx <= 1; dx++) ctx.set(x + dx, sy, Z, B.purpur_slab | (1 << 12));
        for (let Z = bz0; Z <= bz1; Z++) {
          const t = (Z - bz0) / (bz1 - bz0), w = Math.round(1.5 + Math.sin(Math.PI * Math.min(1, t * 1.25)) * 2.5);
          for (let dx = -w; dx <= w; dx++) {
            const edge = Math.abs(dx) === w;
            for (let d = 1; d <= 3; d++) if (Math.abs(dx) <= w - d + 1) ctx.set(x + dx, sy - d, Z, d === 3 ? EB : P);   // keel
            ctx.set(x + dx, sy, Z, edge ? P : B.purpur_slab | (1 << 12));
            if (edge) ctx.set(x + dx, sy + 1, Z, t > 0.1 ? B.purpur_stairs | (((dx < 0 ? 1 : 3)) << 12) : P);
          }
        }
        // bow ornament, mast with end rods, stern cabin with the treasure
        ctx.set(x, sy + 1, bz0 - 1, ROD | (5 << 12)); ctx.set(x, sy, bz0 - 1, P);
        const mz = bz0 + 8;
        for (let Y = sy + 1; Y <= sy + 9; Y++) ctx.set(x, Y, mz, B.obsidian);
        for (let dx = -3; dx <= 3; dx++) ctx.set(x + dx, sy + 8, mz, dx === 0 ? B.obsidian : B.purple_wool);
        ctx.set(x - 4, sy + 8, mz, ROD | (1 << 12)); ctx.set(x + 4, sy + 8, mz, ROD | (0 << 12));
        for (let X = x - 2; X <= x + 2; X++) for (let Z = bz1 - 4; Z <= bz1; Z++) for (let Y = sy + 1; Y <= sy + 4; Y++) {
          const w2 = X === x - 2 || X === x + 2 || Z === bz1 - 4 || Z === bz1, roof = Y === sy + 4;
          ctx.set(X, Y, Z, roof ? P : w2 ? (Y === sy + 2 && (X === x) ? GL : P) : 0);
        }
        ctx.fill(x, sy + 1, bz1, x, sy + 2, bz1, 0);
        ctx.chest(x, sy + 1, bz1 - 3, 2, 'end_ship', hash3(seed, x, sy, bz1));
        ctx.set(x - 1, sy + 3, bz1 - 2, B.end_rod | (3 << 12));
      } });
    }
    return { type: 'end_city', x0: x - 7, z0: ship ? z - 32 : z - 7, x1: x + 7, z1: z + 7, cy: s, pieces };
  }
  nfWartRoom(x, y, z, F, seed) {
    return { x0: x - 4, z0: z - 4, x1: x + 4, z1: z + 4, build: (ctx) => {
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        const X = x + dx, Z = z + dz; if (!ctx.inside(X, Z)) continue;
        const edge = Math.abs(dx) === 4 || Math.abs(dz) === 4;
        ctx.set(X, y, Z, B.nether_bricks); ctx.set(X, y - 1, Z, B.nether_bricks);
        for (let h = 1; h <= 5; h++) ctx.set(X, y + h, Z, edge ? ((h === 2 || h === 3) && (dx + dz) % 2 === 0 ? B.nether_brick_fence : B.nether_bricks) : 0);
        ctx.set(X, y + 6, Z, B.nether_bricks);
        if (!edge && Math.abs(dx) <= 2 && Math.abs(dz) >= 2) { ctx.set(X, y, Z, B.soul_sand); ctx.set(X, y + 1, Z, B.nether_wart | (Math.floor(hashF3(seed, X, y, Z) * 4) << 12)); }
        if (Math.abs(dx) === 4 && Math.abs(dz) === 4) this.nfPillar(ctx, X, y - 2, Z);
      }
      const ox = x + FACING_DX[F] * 4, oz = z + FACING_DZ[F] * 4;
      for (let s = -1; s <= 1; s++) for (let h = 1; h <= 3; h++) ctx.set(ox + (FACING_DZ[F] !== 0 ? s : 0), y + h, oz + (FACING_DX[F] !== 0 ? s : 0), 0);
      ctx.chest(x - 3, y + 1, z, 1, 'fortress', hash3(seed, x, y, z) ^ 7);
    } };
  }
}
