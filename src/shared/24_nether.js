// ============================================================================
//  Nether generator
// ============================================================================
const NETHER_TOP = 127;
class NetherGen {
  constructor(seed) {
    this.seed = (seed ^ 0x4E7E75EE) >>> 0;
    const r = new RNG(this.seed);
    const ns = () => new Noise(r.u32());
    this.nD = ns(); this.nD2 = ns(); this.nBio = ns(); this.nBio2 = ns(); this.nPatch = ns(); this.nFloor = ns();
    this.structs = new Structures(this);
    this.cache = new Map();
  }
  climateCached() { return { h: 64, amp: 0, biome: BIO.NETHER_WASTES }; }
  surfaceAt() { return 64; }
  biomeAt(x, z) {
    const t = fbm2(this.nBio, x / 240, z / 240, 2, 0.5) * 1.4, h = fbm2(this.nBio2, x / 240, z / 240, 2, 0.5) * 1.4;
    if (t > 0.28) return h > -0.05 ? BIO.CRIMSON : (h < -0.4 ? BIO.BASALT : BIO.NETHER_WASTES);
    if (t < -0.28) return h > 0 ? BIO.WARPED : BIO.SOUL_VALLEY;
    return BIO.NETHER_WASTES;
  }
  density(x, y, z, bio) {
    let d = fbm3(this.nD, x / 84, y / 50, z / 84, 3, 0.5);
    d += this.nD2.n3(x / 26, y / 20, z / 26) * 0.22;
    if (y < 36) d += (36 - y) / 36 * 1.15;
    if (y > 98) d += (y - 98) / 29 * 1.5;
    if (bio === BIO.BASALT) d -= 0.08;
    return d - 0.06;
  }
  generate(cx, cz) {
    const blocks = new Uint16Array(CVOL);
    const ctx = new ChunkCtx(blocks, cx, cz);
    const x0 = cx << 4, z0 = cz << 4;
    const biomes = new Uint8Array(256);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) biomes[z * 16 + x] = this.biomeAt(x0 + x, z0 + z);
    const cb = this.biomeAt(x0 + 8, z0 + 8);
    const NY = 33;
    const grid = new Float32Array(5 * 5 * NY);
    for (let gy = 0; gy < NY; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++)
      grid[(gy * 5 + gz) * 5 + gx] = this.density(x0 + gx * 4, gy * 4, z0 + gz * 4, cb);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
      for (let y = 0; y <= NETHER_TOP; y++) {
        const gy = y >> 2, fy = (y & 3) / 4;
        const i0 = (gy * 5 + gz) * 5 + gx, i1 = Math.min(gy + 1, NY - 1) * 25 + gz * 5 + gx;
        const a = lerp(lerp(grid[i0], grid[i0 + 1], fx), lerp(grid[i0 + 5], grid[i0 + 6], fx), fz);
        const b = lerp(lerp(grid[i1], grid[i1 + 1], fx), lerp(grid[i1 + 5], grid[i1 + 6], fx), fz);
        const p = (y << 8) | (z << 4) | x;
        if (lerp(a, b, fy) > 0) blocks[p] = B.netherrack;
        else if (y <= 31) blocks[p] = B.lava;
      }
      const wx = x0 + x, wz = z0 + z;
      blocks[(z << 4) | x] = B.bedrock;
      blocks[(NETHER_TOP << 8) | (z << 4) | x] = B.bedrock;
      for (let i = 1; i <= 4; i++) {
        if (hashF3(this.seed, wx, i, wz) < (5 - i) / 5) blocks[(i << 8) | (z << 4) | x] = B.bedrock;
        if (hashF3(this.seed, wx, NETHER_TOP - i, wz) < (5 - i) / 5) blocks[((NETHER_TOP - i) << 8) | (z << 4) | x] = B.bedrock;
      }
    }
    // surfaces
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z, bio = biomes[z * 16 + x];
      const pn = this.nPatch.n2(wx / 14, wz / 14);
      let depth = -1;
      for (let y = NETHER_TOP - 5; y >= 5; y--) {
        const p = (y << 8) | (z << 4) | x, id = blocks[p];
        if (id !== B.netherrack) { depth = -1; continue; }
        depth++;
        const air = blocks[p + 256] === 0;
        if (bio === BIO.SOUL_VALLEY) { if (depth < 3) blocks[p] = pn > 0.1 ? B.soul_soil : B.soul_sand; }
        else if (bio === BIO.CRIMSON) { if (depth === 0 && air) blocks[p] = B.crimson_nylium; }
        else if (bio === BIO.WARPED) { if (depth === 0 && air) blocks[p] = B.warped_nylium; }
        else if (bio === BIO.BASALT) { if (depth < 2) blocks[p] = pn > 0.2 ? B.blackstone : B.basalt; else if (depth < 5 && pn > 0) blocks[p] = B.blackstone; }
        else {
          if (depth === 0 && y >= 29 && y <= 35 && pn > 0.3) blocks[p] = B.gravel;
          else if (depth < 3 && pn < -0.55) blocks[p] = B.soul_sand;
        }
      }
    }
    const r = new RNG(hash2(this.seed ^ 0x6E7, cx, cz));
    // ores
    const vein = (id, size, count, minY, maxY) => {
      for (let c = 0; c < count; c++) {
        let x = r.int(16), y = r.range(minY, maxY), z = r.int(16);
        for (let s = 0; s < size; s++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < NETHER_TOP) { const p = (y << 8) | (z << 4) | x; if (blocks[p] === B.netherrack) blocks[p] = id; }
          const d = r.int(6); if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4) y++; else y--;
        }
      }
    };
    vein(B.nether_quartz_ore, 10, 14, 10, 117);
    vein(B.nether_gold_ore, 8, 9, 10, 117);
    vein(B.magma_block, 12, 4, 26, 36);
    vein(B.gravel, 20, 2, 5, 40);
    if (cb === BIO.BASALT) vein(B.magma_block, 14, 5, 20, 90);
    // glowstone clusters on ceilings
    for (let k = 0; k < 7; k++) {
      const gx = r.range(2, 13), gz = r.range(2, 13);
      let gy = r.range(60, 118);
      while (gy < 124 && blocks[(gy << 8) | (gz << 4) | gx] === 0) gy++;
      if (gy >= 124 || (blocks[(gy << 8) | (gz << 4) | gx] & 4095) !== B.netherrack) { r.next(); continue; }
      gy--;
      if (blocks[(gy << 8) | (gz << 4) | gx] !== 0) continue;
      blocks[(gy << 8) | (gz << 4) | gx] = B.glowstone;
      const n = r.range(25, 70);
      for (let s = 0; s < n; s++) {
        const x = gx + r.range(-3, 3), y = gy - r.range(0, 7), z = gz + r.range(-3, 3);
        if (x < 0 || x > 15 || z < 0 || z > 15 || y < 1) continue;
        const p = (y << 8) | (z << 4) | x;
        if (blocks[p] !== 0) continue;
        let adj = 0;
        if (x < 15 && blocks[p + 1] === B.glowstone) adj++;
        if (x > 0 && blocks[p - 1] === B.glowstone) adj++;
        if (z < 15 && blocks[p + 16] === B.glowstone) adj++;
        if (z > 0 && blocks[p - 16] === B.glowstone) adj++;
        if (blocks[p + 256] === B.glowstone) adj++;
        if (blocks[p - 256] === B.glowstone) adj++;
        if (adj === 1) blocks[p] = B.glowstone;
      }
    }
    // lava springs
    for (let k = 0; k < 5; k++) {
      const x = r.range(1, 14), y = r.range(36, 110), z = r.range(1, 14), p = (y << 8) | (z << 4) | x;
      if (blocks[p] !== B.netherrack) continue;
      let air = 0, solid = 0;
      for (const o of [1, -1, 16, -16]) { if (blocks[p + o] === 0) air++; else if (blocks[p + o] === B.netherrack) solid++; }
      if (air === 1 && solid === 3 && blocks[p + 256] === B.netherrack) blocks[p] = B.lava;
    }
    // vegetation / features per biome
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const bio = biomes[z * 16 + x], wx = x0 + x, wz = z0 + z;
      for (let y = 32; y < NETHER_TOP - 2; y++) {
        const p = (y << 8) | (z << 4) | x, id = blocks[p];
        if (id === 0 || blocks[p + 256] !== 0) continue;
        const h = hashF3(this.seed ^ 0xF00D, wx, y, wz);
        if (id === B.crimson_nylium) { if (h < 0.12) blocks[p + 256] = B.crimson_roots; else if (h < 0.16) blocks[p + 256] = B.crimson_fungus; }
        else if (id === B.warped_nylium) { if (h < 0.12) blocks[p + 256] = B.warped_roots; else if (h < 0.16) blocks[p + 256] = B.warped_fungus; }
        else if (id === B.netherrack && bio === BIO.NETHER_WASTES && h < 0.01) blocks[p + 256] = B.fire;
        else if ((id === B.soul_sand || id === B.soul_soil) && h < 0.006) blocks[p + 256] = B.soul_torch === undefined ? 0 : B.fire;
      }
    }
    // huge fungi
    if (cb === BIO.CRIMSON || cb === BIO.WARPED) {
      const stem = cb === BIO.CRIMSON ? B.crimson_stem : B.warped_stem, wart = cb === BIO.CRIMSON ? B.nether_wart_block : B.warped_wart_block;
      const floor = cb === BIO.CRIMSON ? B.crimson_nylium : B.warped_nylium;
      for (let k = 0; k < 9; k++) {
        const x = r.range(3, 12), z = r.range(3, 12), h = r.range(5, 11), capR = r.range(2, 3);
        for (let y = 33; y < 110; y++) {
          const p = (y << 8) | (z << 4) | x;
          if (blocks[p] !== floor || blocks[p + 256] > 0 && (blocks[p + 256] & 4095) !== B.crimson_roots && (blocks[p + 256] & 4095) !== B.warped_roots && (blocks[p + 256] & 4095) !== B.crimson_fungus && (blocks[p + 256] & 4095) !== B.warped_fungus) continue;
          let clear = true;
          for (let i = 2; i <= h + 2; i++) if (blocks[((y + i) << 8) | (z << 4) | x] !== 0) { clear = false; break; }
          if (!clear) continue;
          for (let i = 1; i <= h; i++) blocks[((y + i) << 8) | (z << 4) | x] = stem;
          const top = y + h;
          for (let dy = -2; dy <= 1; dy++) {
            const rad = dy === 1 ? capR - 1 : capR;
            for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
              const xx = x + dx, zz = z + dz, yy = top + dy;
              if (xx < 0 || xx > 15 || zz < 0 || zz > 15) continue;
              const edge = Math.abs(dx) === rad || Math.abs(dz) === rad;
              if (dy < 1 && !edge && dy < 0) continue;
              if (Math.abs(dx) === rad && Math.abs(dz) === rad && hashF3(this.seed, xx, yy, zz) < 0.5) continue;
              const q = (yy << 8) | (zz << 4) | xx;
              if (blocks[q] !== 0) continue;
              blocks[q] = hashF3(this.seed ^ 3, xx, yy, zz) < 0.07 ? B.shroomlight : wart;
            }
          }
          break;
        }
      }
    }
    // basalt pillars
    if (cb === BIO.BASALT || cb === BIO.SOUL_VALLEY) {
      for (let k = 0; k < (cb === BIO.BASALT ? 10 : 3); k++) {
        const x = r.range(0, 15), z = r.range(0, 15), len = r.range(3, 14);
        for (let y = 32; y < 100; y++) {
          const p = (y << 8) | (z << 4) | x;
          if (blocks[p] === 0 && blocks[p - 256] !== 0 && blocks[p - 256] !== B.lava) {
            for (let i = 0; i < len; i++) { const q = p + i * 256; if (blocks[q] !== 0) break; blocks[q] = B.basalt; }
            break;
          }
        }
      }
    }
    // newer nether features (own random stream so the older layout above is unchanged)
    const r2 = new RNG(hash2(this.seed ^ 0xDEB715, cx, cz));
    for (let c = 0; c < 2; c++) { const x = r2.int(16), y = r2.range(8, 22), z = r2.int(16), p = (y << 8) | (z << 4) | x; if (blocks[p] === B.netherrack) blocks[p] = B.ancient_debris; }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const bio = biomes[z * 16 + x], wx = x0 + x, wz = z0 + z;
      for (let y = 33; y < NETHER_TOP - 3; y++) {
        const p = (y << 8) | (z << 4) | x, id = blocks[p];
        const h = hashF3(this.seed ^ 0xB1E55, wx, y, wz);
        if (id === 0 && bio === BIO.CRIMSON) {
          // weeping vines hang from crimson ceilings
          const up = blocks[p + 256] & 4095;
          if ((up === B.netherrack || up === B.nether_wart_block || up === B.crimson_nylium) && h < 0.07) {
            const len = 1 + (hashF3(this.seed ^ 5, wx, y, wz) * 9 | 0);
            for (let i = 0; i < len && y - i > 32; i++) { const q = p - 256 * i; if (blocks[q] !== 0) break; blocks[q] = B.weeping_vines; }
          }
        } else if (id === B.warped_nylium && blocks[p + 256] === 0) {
          if (h < 0.035) { const len = 1 + (hashF3(this.seed ^ 6, wx, y, wz) * 8 | 0); for (let i = 1; i <= len; i++) { const q = p + 256 * i; if (blocks[q] !== 0) break; blocks[q] = B.twisting_vines; } }
          else if (h < 0.1) blocks[p + 256] = B.nether_sprouts;
        } else if (id === B.blackstone && bio === BIO.BASALT && h < 0.03) blocks[p] = B.gilded_blackstone;
      }
    }
    this.structs.applyNether(ctx);
    const col = new Uint32Array(256).fill(0xBFB755), wcol = new Uint32Array(256).fill(0x3F76E4);
    return { blocks, biomes, be: ctx.be, spawns: ctx.spawns, tags: ctx.tags, tints: { grass: col, foliage: col, water: wcol } };
  }
}
