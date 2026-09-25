// ============================================================================
//  The End: the main island (obsidian spikes with end crystals around the exit portal), the void, and the
//  outer islands beyond ~1000 blocks (chorus forests, end cities with their ships)
// ============================================================================
const END_ISLAND_R = 108, END_OUTER = 1000;
BIO.THE_END = 40; BIO.END_HIGHLANDS = 41; BIO.END_BARRENS = 42; BIO.SMALL_END_ISLANDS = 43;
for (const [id, name] of [[40, 'The End'], [41, 'End Highlands'], [42, 'End Barrens'], [43, 'Small End Islands']])
  biomeDef(id, name, { top: 'end_stone', filler: 'end_stone', end: true, grassD: 0, flowerD: 0, fogc: 0x0B0812 });
const END_TINT = 0x9A7AA0;
class EndGen {
  constructor(seed) {
    this.seed = (seed ^ 0x3E4D5EED) >>> 0;
    const r = new RNG(this.seed), ns = () => new Noise(r.u32());
    this.nEdge = ns(); this.nTop = ns(); this.nBot = ns(); this.nOut = ns(); this.nOutH = ns(); this.nDet = ns();
    this.spikes = this.makeSpikes();
    this.cache = new Map();
    const c0 = this.column(0, 0);
    this.portalY = c0 ? Math.floor(c0.top) : 62;
    this.structs = new Structures(this);
  }
  // Structures expects the overworld interface
  climateCached(x, z) { const c = this.column(x, z); return { h: c ? c.top : 0, amp: 0, biome: this.biomeAt(x, z) }; }
  surfaceAt(x, z) { const c = this.column(x, z); return c ? Math.floor(c.top) : -1; }
  // island shape of a column: surface y (top) and underside y (bot), or null over the void
  column(x, z) {
    const k = x * 131072 + z;
    let c = this.cache.get(k);
    if (c !== undefined) return c;
    c = this.columnRaw(x, z);
    if (this.cache.size > 60000) this.cache.clear();
    this.cache.set(k, c);
    return c;
  }
  columnRaw(x, z) {
    const d = Math.hypot(x, z);
    if (d < END_ISLAND_R * 1.3) {
      const edge = END_ISLAND_R * (1 + fbm2(this.nEdge, x / 60, z / 60, 3, 0.5) * 0.2);
      if (d < edge) {
        const t = d / edge;
        const top = 56 + 8 * (1 - t * t) + fbm2(this.nTop, x / 32, z / 32, 3, 0.5) * 2.4 * (0.35 + t);
        const bot = top - 2 - 46 * Math.pow(1 - t, 0.85) * (0.85 + fbm2(this.nBot, x / 24, z / 24, 2, 0.5) * 0.3);
        return { top, bot };
      }
      return null;
    }
    if (d < END_OUTER * 0.85) return null;
    // outer islands: blobs of a large-scale noise, fading in from the void
    const fade = smoothstep(END_OUTER * 0.85, END_OUTER * 1.05, d);
    const v = fbm2(this.nOut, x / 150, z / 150, 4, 0.5) * 1.35 * fade + (fade - 1) * 0.5 - 0.12;
    if (v <= 0) return null;
    const hh = Math.min(1, v * 3.2);
    const base = 62 + fbm2(this.nOutH, x / 260, z / 260, 2, 0.5) * 16;
    const top = base + hh * 7 + fbm2(this.nDet, x / 18, z / 18, 2, 0.5) * 1.5;
    const bot = base - 1.5 - hh * 32 * (0.8 + fbm2(this.nBot, x / 30, z / 30, 2, 0.5) * 0.3);
    return top - bot < 1 ? null : { top, bot };
  }
  biomeAt(x, z) {
    if (Math.hypot(x, z) < END_OUTER * 0.7) return BIO.THE_END;
    const c = this.column(x, z);
    if (!c) return BIO.SMALL_END_ISLANDS;
    return c.top - c.bot > 16 ? BIO.END_HIGHLANDS : BIO.END_BARRENS;
  }
  // ten spikes on a circle of radius 42; their sizes are shuffled per world, the two smallest are caged
  makeSpikes() {
    const r = new RNG(this.seed ^ 0x5B1E5), idx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 9; i > 0; i--) { const j = r.int(i + 1); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const out = [];
    for (let i = 0; i < 10; i++) {
      const a = 2 * (-Math.PI + Math.PI / 10 * i), k = idx[i];
      out.push({ x: Math.floor(42 * Math.cos(a)), z: Math.floor(42 * Math.sin(a)), r: 2 + Math.floor(k / 3), h: 76 + k * 3, caged: k === 1 || k === 2 });
    }
    return out;
  }
  generate(cx, cz) {
    const blocks = new Uint16Array(CVOL), ctx = new ChunkCtx(blocks, cx, cz), x0 = cx << 4, z0 = cz << 4;
    const biomes = new Uint8Array(256), ES = B.end_stone;
    let any = false;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z, c = this.column(wx, wz);
      biomes[z * 16 + x] = this.biomeAt(wx, wz);
      if (!c) continue;
      any = true;
      const t = Math.min(CH - 2, Math.floor(c.top)), b = Math.max(1, Math.ceil(c.bot));
      for (let y = b; y <= t; y++) blocks[(y << 8) | (z << 4) | x] = ES;
    }
    const d = Math.hypot(x0 + 8, z0 + 8);
    if (d < END_ISLAND_R + 40) { this.spikesIn(ctx); this.exitPortal(ctx, false); }
    else if (any || d > END_OUTER * 0.8) { this.chorus(ctx); this.structs.applyEnd(ctx); }
    const c = new Uint32Array(256).fill(END_TINT);
    return { blocks, biomes, be: ctx.be, spawns: ctx.spawns, tags: ctx.tags, tints: { grass: c, foliage: c, water: new Uint32Array(256).fill(0x3F76E4) } };
  }
  spikesIn(ctx) {
    for (const s of this.spikes) {
      if (!ctx.overlaps(s.x - s.r - 2, s.z - s.r - 2, s.x + s.r + 2, s.z + s.r + 2)) continue;
      const c = this.column(s.x, s.z), base = c ? Math.max(4, Math.floor(c.bot) + 3) : 40;
      for (let dz = -s.r; dz <= s.r; dz++) for (let dx = -s.r; dx <= s.r; dx++) {
        if (dx * dx + dz * dz > s.r * s.r + 1) continue;
        for (let y = base; y <= s.h; y++) ctx.set(s.x + dx, y, s.z + dz, B.obsidian);
      }
      ctx.set(s.x, s.h + 1, s.z, B.bedrock);
      if (s.caged) for (let dy = 0; dy <= 3; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++)
        if (Math.abs(dx) === 2 || Math.abs(dz) === 2 || dy === 3) ctx.set(s.x + dx, s.h + 1 + dy, s.z + dz, B.iron_bars);
      ctx.spawn('end_crystal', s.x + 0.5, s.h + 2, s.z + 0.5);
    }
  }
  // the exit portal: a bedrock bowl around a pillar with four torches; the portal fills it once the dragon falls
  exitPortal(ctx, active) {
    if (!ctx.overlaps(-4, -4, 4, 4)) return;
    const s = this.portalY;
    for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dz);
      if (d > 3.5) continue;
      ctx.set(dx, s - 1, dz, B.bedrock);
      ctx.set(dx, s, dz, d > 2.5 ? B.bedrock : active ? B.end_portal : 0);
      for (let y = s + 1; y <= s + 6; y++) ctx.set(dx, y, dz, 0);
    }
    for (let y = s; y <= s + 3; y++) ctx.set(0, y, 0, B.bedrock);
    for (let f = 0; f < 4; f++) ctx.set(FACING_DX[f], s + 2, FACING_DZ[f], B.torch | ((1 + f) << 12));
  }
  // chorus plants on the outer islands, planned per chunk from a hash so plants crossing a chunk border line up
  chorus(ctx) {
    for (let ncz = ctx.cz - 1; ncz <= ctx.cz + 1; ncz++) for (let ncx = ctx.cx - 1; ncx <= ctx.cx + 1; ncx++) {
      const r = new RNG(hash2(this.seed ^ 0xC40A5, ncx, ncz));
      const n = r.int(5);
      for (let k = 0; k < n; k++) {
        const wx = ncx * 16 + r.int(16), wz = ncz * 16 + r.int(16), sub = r.u32();
        if (!ctx.overlaps(wx - 8, wz - 8, wx + 8, wz + 8) || Math.hypot(wx, wz) < END_OUTER * 0.9) continue;
        const c = this.column(wx, wz);
        if (!c || c.top - c.bot < 7 || this.structs.inEndCity(wx, wz)) continue;
        this.chorusBranch(ctx, new RNG(sub), wx, Math.floor(c.top) + 1, wz, wx, wz, 0);
      }
    }
  }
  chorusBranch(ctx, r, x, y, z, rx, rz, depth) {
    const h = 1 + r.int(depth === 0 ? 4 : 3);
    for (let i = 0; i < h; i++) ctx.set(x, y + i, z, B.chorus_plant);
    const ty = y + h - 1;
    let grew = false;
    if (depth < 4 && ty < CH - 12) {
      const nb = depth === 0 ? 1 + r.int(3) : r.int(3);
      for (let b = 0; b < nb; b++) {
        const f = r.int(4), bx = x + FACING_DX[f], bz = z + FACING_DZ[f];
        if (Math.abs(bx - rx) > 6 || Math.abs(bz - rz) > 6) continue;
        ctx.set(bx, ty, bz, B.chorus_plant);
        this.chorusBranch(ctx, r, bx, ty + 1, bz, rx, rz, depth + 1);
        grew = true;
      }
    }
    if (!grew) ctx.set(x, ty + 1, z, B.chorus_flower | (5 << 12));
  }
}
