// ============================================================================
//  Biomes + Overworld generator (terrain, caves, ores, trees, vegetation)
// ============================================================================
const BIO = {
  OCEAN: 0, DEEP_OCEAN: 1, FROZEN_OCEAN: 2, WARM_OCEAN: 3, BEACH: 4, SNOWY_BEACH: 5, RIVER: 6, FROZEN_RIVER: 7,
  PLAINS: 8, FOREST: 9, BIRCH_FOREST: 10, DARK_FOREST: 11, FLOWER_FOREST: 12, TAIGA: 13, SNOWY_TAIGA: 14,
  SNOWY_PLAINS: 15, DESERT: 16, SAVANNA: 17, JUNGLE: 18, SWAMP: 19, BADLANDS: 20, MOUNTAINS: 21, SNOWY_PEAKS: 22,
  MUSHROOM: 23, STONY_SHORE: 24, CHERRY_GROVE: 25,
  NETHER_WASTES: 32, SOUL_VALLEY: 33, CRIMSON: 34, WARPED: 35, BASALT: 36
};
const BIOMES = [];
function biomeDef(id, name, o) {
  BIOMES[id] = Object.assign({ id, name, grass: 0x91BD59, foliage: 0x77AB2F, water: 0x3F76E4, snowy: false, trees: 0, treeTypes: null,
    grassD: 0.02, flowerD: 0.004, flowers: ['dandelion', 'poppy'], top: 'grass_block', filler: 'dirt', fern: 0, animals: null, fog: 0, sky: 0x78A7FF }, o);
}
biomeDef(0, 'Ocean', { grass: 0x8EB971, foliage: 0x71A74D, top: 'sand', filler: 'sand', grassD: 0, flowerD: 0, ocean: true });
biomeDef(1, 'Deep Ocean', { grass: 0x8EB971, foliage: 0x71A74D, top: 'gravel', filler: 'gravel', grassD: 0, flowerD: 0, ocean: true });
biomeDef(2, 'Frozen Ocean', { grass: 0x80B497, foliage: 0x60A17B, water: 0x3938C9, snowy: true, top: 'gravel', filler: 'gravel', grassD: 0, flowerD: 0, ocean: true });
biomeDef(3, 'Warm Ocean', { grass: 0x8EB971, foliage: 0x71A74D, water: 0x43D5EE, top: 'sand', filler: 'sand', grassD: 0, flowerD: 0, ocean: true });
biomeDef(4, 'Beach', { top: 'sand', filler: 'sand', grassD: 0, flowerD: 0 });
biomeDef(5, 'Snowy Beach', { grass: 0x80B497, water: 0x3D57D6, snowy: true, top: 'sand', filler: 'sand', grassD: 0, flowerD: 0 });
biomeDef(6, 'River', { top: 'sand', filler: 'dirt', grassD: 0, flowerD: 0 });
biomeDef(7, 'Frozen River', { grass: 0x80B497, water: 0x3938C9, snowy: true, top: 'sand', filler: 'dirt', grassD: 0, flowerD: 0 });
biomeDef(8, 'Plains', { trees: 0.12, treeTypes: [['oak', 90], ['big_oak', 10]], grassD: 0.28, flowerD: 0.02, flowers: ['dandelion', 'poppy', 'azure_bluet', 'oxeye_daisy', 'cornflower', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip'], animals: ['cow', 'sheep', 'pig', 'chicken'] });
biomeDef(9, 'Forest', { grass: 0x79C05A, foliage: 0x59AE30, trees: 9, treeTypes: [['oak', 65], ['birch', 22], ['big_oak', 13]], grassD: 0.08, flowerD: 0.01, flowers: ['dandelion', 'poppy', 'lily_of_the_valley'], animals: ['pig', 'chicken', 'sheep'] });
biomeDef(10, 'Birch Forest', { grass: 0x88BB67, foliage: 0x6BA941, trees: 9, treeTypes: [['birch', 100]], grassD: 0.08, flowerD: 0.01, flowers: ['dandelion', 'poppy', 'allium'], animals: ['pig', 'chicken'] });
biomeDef(11, 'Dark Forest', { grass: 0x507A32, foliage: 0x59AE30, trees: 16, treeTypes: [['dark_oak', 70], ['oak', 18], ['huge_red_mushroom', 6], ['huge_brown_mushroom', 6]], grassD: 0.06, flowerD: 0.004, flowers: ['poppy', 'lily_of_the_valley'], animals: ['pig'] });
biomeDef(12, 'Flower Forest', { grass: 0x79C05A, foliage: 0x59AE30, trees: 5, treeTypes: [['oak', 60], ['birch', 40]], grassD: 0.05, flowerD: 0.2, flowers: FLOWERS.concat(FLOWERS2), animals: ['pig', 'chicken', 'sheep'] });
biomeDef(13, 'Taiga', { grass: 0x86B783, foliage: 0x68A464, water: 0x287082, trees: 9, treeTypes: [['spruce', 70], ['pine', 30]], grassD: 0.1, fern: 0.6, flowerD: 0.003, animals: ['sheep', 'pig', 'chicken'] });
biomeDef(14, 'Snowy Taiga', { grass: 0x80B497, foliage: 0x60A17B, water: 0x205E83, snowy: true, trees: 6, treeTypes: [['spruce', 70], ['pine', 30]], grassD: 0.05, fern: 0.7, flowerD: 0 });
biomeDef(15, 'Snowy Plains', { grass: 0x80B497, foliage: 0x60A17B, water: 0x3D57D6, snowy: true, trees: 0.2, treeTypes: [['spruce', 100]], grassD: 0.02, flowerD: 0 });
biomeDef(16, 'Desert', { grass: 0xBFB755, foliage: 0xAEA42A, water: 0x32A598, top: 'sand', filler: 'sand', grassD: 0, flowerD: 0, sky: 0x6EB1FF });
biomeDef(17, 'Savanna', { grass: 0xBFB755, foliage: 0xAEA42A, water: 0x2C8B9C, trees: 1.2, treeTypes: [['acacia', 85], ['oak', 15]], grassD: 0.35, flowerD: 0.004, animals: ['cow', 'sheep', 'chicken'], sky: 0x6EB1FF });
biomeDef(18, 'Jungle', { grass: 0x59C93C, foliage: 0x30BB0B, water: 0x14A2C5, trees: 22, treeTypes: [['jungle', 28], ['mega_jungle', 10], ['jungle_bush', 52], ['big_oak', 10]], grassD: 0.3, fern: 0.3, flowerD: 0.005, animals: ['chicken', 'pig'] });
biomeDef(19, 'Swamp', { grass: 0x6A7039, foliage: 0x6A7039, water: 0x617B64, trees: 2, treeTypes: [['swamp_oak', 100]], grassD: 0.08, flowerD: 0.01, flowers: ['blue_orchid'], fog: 0.3 });
biomeDef(20, 'Badlands', { grass: 0x90814D, foliage: 0x9E814D, water: 0x4E7F81, top: 'red_sand', filler: 'orange_terracotta', grassD: 0, flowerD: 0, sky: 0x6EB1FF });
biomeDef(21, 'Mountains', { grass: 0x8AB689, foliage: 0x6DA36B, water: 0x007BF7, trees: 1.5, treeTypes: [['spruce', 60], ['oak', 40]], grassD: 0.05, flowerD: 0.003, animals: ['sheep'] });
biomeDef(22, 'Snowy Peaks', { grass: 0x80B497, foliage: 0x60A17B, snowy: true, top: 'snow', filler: 'snow', grassD: 0, flowerD: 0 });
biomeDef(23, 'Mushroom Fields', { grass: 0x55C93F, foliage: 0x2BBB0F, water: 0x8A8997, top: 'mycelium', trees: 1, treeTypes: [['huge_red_mushroom', 50], ['huge_brown_mushroom', 50]], grassD: 0, flowerD: 0, animals: ['cow'] });
biomeDef(24, 'Stony Shore', { grass: 0x8AB689, water: 0x0D67BB, top: 'stone', filler: 'stone', grassD: 0, flowerD: 0 });
biomeDef(25, 'Cherry Grove', { grass: 0xA9D867, foliage: 0xA9D867, water: 0x5DB7EF, trees: 2.6, treeTypes: [['cherry', 100]], grassD: 0.22, flowerD: 0.03, flowers: ['pink_tulip', 'allium', 'lily_of_the_valley', 'oxeye_daisy'], animals: ['sheep', 'pig', 'chicken'], sky: 0x80B2FF });
biomeDef(32, 'Nether Wastes', { top: 'netherrack', filler: 'netherrack', nether: true, fogc: 0x330808 });
biomeDef(33, 'Soul Sand Valley', { top: 'soul_sand', filler: 'soul_soil', nether: true, fogc: 0x1B4745 });
biomeDef(34, 'Crimson Forest', { top: 'crimson_nylium', filler: 'netherrack', nether: true, fogc: 0x330303 });
biomeDef(35, 'Warped Forest', { top: 'warped_nylium', filler: 'netherrack', nether: true, fogc: 0x1A051A });
biomeDef(36, 'Basalt Deltas', { top: 'basalt', filler: 'blackstone', nether: true, fogc: 0x685F70 });

const CONT_SPLINE = [-1.0, 22, -0.55, 30, -0.32, 42, -0.18, 53, -0.1, 60, -0.04, 64, 0.1, 67, 0.3, 72, 0.6, 80, 1.0, 88];

// --------------------------------------------------------------- chunk writer
class ChunkCtx {
  constructor(blocks, cx, cz) { this.b = blocks; this.cx = cx; this.cz = cz; this.x0 = cx << 4; this.z0 = cz << 4; this.be = []; this.spawns = []; this.tags = 0; }
  get(x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const lx = x - this.x0, lz = z - this.z0;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return -1;
    return this.b[(y << 8) | (lz << 4) | lx];
  }
  set(x, y, z, v) {
    if (y < 0 || y >= CH) return;
    const lx = x - this.x0, lz = z - this.z0;
    if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return;
    this.b[(y << 8) | (lz << 4) | lx] = v;
  }
  fill(x0, y0, z0, x1, y1, z1, v) {
    const ax = Math.max(Math.min(x0, x1), this.x0), bx = Math.min(Math.max(x0, x1), this.x0 + 15);
    const az = Math.max(Math.min(z0, z1), this.z0), bz = Math.min(Math.max(z0, z1), this.z0 + 15);
    const ay = Math.max(Math.min(y0, y1), 0), by = Math.min(Math.max(y0, y1), CH - 1);
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.b[(y << 8) | ((z - this.z0) << 4) | (x - this.x0)] = v;
  }
  inside(x, z) { const lx = x - this.x0, lz = z - this.z0; return lx >= 0 && lx < 16 && lz >= 0 && lz < 16; }
  overlaps(x0, z0, x1, z1) { return x1 >= this.x0 && x0 <= this.x0 + 15 && z1 >= this.z0 && z0 <= this.z0 + 15; }
  chest(x, y, z, facing, loot, seed) { if (!this.inside(x, z) || y < 0 || y >= CH) return; this.set(x, y, z, B.chest | (facing << 12)); this.be.push({ t: 'chest', x, y, z, loot, seed: seed >>> 0 }); }
  barrel(x, y, z, loot, seed) { if (!this.inside(x, z)) return; this.set(x, y, z, B.barrel); this.be.push({ t: 'chest', x, y, z, loot, seed: seed >>> 0 }); }
  spawner(x, y, z, mob) { if (!this.inside(x, z)) return; this.set(x, y, z, B.spawner); this.be.push({ t: 'spawner', x, y, z, mob }); }
  spawn(type, x, y, z, data) { if (!this.inside(Math.floor(x), Math.floor(z))) return; this.spawns.push({ type, x, y, z, data: data || null }); }
}

function weightedPick(list, r) {
  let tot = 0; for (const e of list) tot += e[1];
  let t = r * tot; for (const e of list) { t -= e[1]; if (t < 0) return e[0]; }
  return list[list.length - 1][0];
}

// ------------------------------------------------------------------- trees
function tLog(ctx, x, y, z, v) { const c = ctx.get(x, y, z); if (c < 0) return; const id = c & 4095; if (id === 0 || REPL[id] || LEAVES[id] || PLANT[id]) ctx.set(x, y, z, v); }
function tLeaf(ctx, x, y, z, v) { const c = ctx.get(x, y, z); if (c < 0) return; const id = c & 4095; if (id === 0 || (REPL[id] && !FLUID[id])) ctx.set(x, y, z, v); }
function tDirt(ctx, x, y, z) { const c = ctx.get(x, y, z); if (c < 0) return; const id = c & 4095; if (id === B.grass_block || id === B.podzol || id === B.mycelium) ctx.set(x, y, z, B.dirt); }
function tVine(ctx, r, x, y, z, meta, maxLen) {
  const len = 1 + r.int(maxLen);
  for (let i = 0; i < len; i++) { const c = ctx.get(x, y - i, z); if (c < 0) continue; if ((c & 4095) !== 0) break; ctx.set(x, y - i, z, B.vine | (meta << 12)); }
}
function leafLayer(ctx, r, x, y, z, rad, leaf, cutCorners) {
  for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
    const corner = Math.abs(dx) === rad && Math.abs(dz) === rad;
    const cut = r.next();
    if (corner && rad > 0 && (cutCorners || cut < 0.5)) continue;
    tLeaf(ctx, x + dx, y, z + dz, leaf);
  }
}
function leafDisk(ctx, x, y, z, rad, leaf, cx2, cz2) {
  const rr = rad * rad + rad * 0.8;
  for (let dx = -rad - 1; dx <= rad + 1; dx++) for (let dz = -rad - 1; dz <= rad + 1; dz++) {
    const ddx = dx - (cx2 || 0), ddz = dz - (cz2 || 0);
    if (ddx * ddx + ddz * ddz <= rr) tLeaf(ctx, x + dx, y, z + dz, leaf);
  }
}
function leafBlob(ctx, r, x, y, z, rad, leaf) {
  for (let dy = -rad + 1; dy <= rad - 1; dy++) {
    const lr = rad - Math.abs(dy) * 0.6;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      const v = r.next();
      if (dx * dx + dz * dz + dy * dy * 1.6 <= lr * lr + 0.8 - v * 0.9) tLeaf(ctx, x + dx, y + dy, z + dz, leaf);
    }
  }
}
function placeTree(ctx, type, r, x, y, z) {
  const L = B.oak_log, LF = B.oak_leaves;
  switch (type) {
    case 'oak': case 'birch': {
      const log = type === 'birch' ? B.birch_log : L, leaf = type === 'birch' ? B.birch_leaves : LF;
      const h = type === 'birch' ? r.range(5, 7) : r.range(4, 6);
      tDirt(ctx, x, y - 1, z);
      for (let i = 0; i < h; i++) tLog(ctx, x, y + i, z, log);
      for (let dy = h - 3; dy <= h; dy++) leafLayer(ctx, r, x, y + dy, z, dy >= h - 1 ? 1 : 2, leaf, dy === h);
      break;
    }
    case 'big_oak': {
      const h = r.range(8, 12);
      tDirt(ctx, x, y - 1, z);
      for (let i = 0; i < h; i++) tLog(ctx, x, y + i, z, L);
      const nb = r.range(3, 5);
      for (let k = 0; k < nb; k++) {
        const by = y + r.range(Math.floor(h * 0.45), h - 2), a = r.next() * Math.PI * 2, len = r.range(2, 4);
        const ex = x + Math.round(Math.cos(a) * len), ez = z + Math.round(Math.sin(a) * len), ey = by + r.range(1, 2);
        for (let s = 1; s <= len; s++) {
          const t = s / len;
          const lx = Math.round(x + (ex - x) * t), lz = Math.round(z + (ez - z) * t), ly = Math.round(by + (ey - by) * t);
          const ax = Math.abs(ex - x) > Math.abs(ez - z) ? 1 : 2;
          tLog(ctx, lx, ly, lz, L | (ax << 12));
        }
        leafBlob(ctx, r, ex, ey + 1, ez, 3, LF);
      }
      leafBlob(ctx, r, x, y + h, z, 3, LF);
      break;
    }
    case 'spruce': case 'pine': {
      const h = type === 'pine' ? r.range(9, 13) : r.range(7, 11);
      const pat = type === 'pine' ? [0, 1, 1, 2, 1, 2] : [0, 1, 1, 2, 1, 2, 3, 2, 3, 2, 3, 2, 3, 2];
      const maxR = type === 'pine' ? 2 : r.range(2, 3);
      const bare = type === 'pine' ? h - 5 : r.range(1, 3);
      tDirt(ctx, x, y - 1, z);
      for (let i = 0; i < h; i++) tLog(ctx, x, y + i, z, B.spruce_log);
      let li = 0;
      for (let yy = y + h; yy >= y + bare; yy--, li++) {
        const rad = Math.min(pat[Math.min(li, pat.length - 1)], maxR);
        if (rad === 0) tLeaf(ctx, x, yy, z, B.spruce_leaves);
        else leafLayer(ctx, r, x, yy, z, rad, B.spruce_leaves, true);
      }
      tLeaf(ctx, x, y + h + 1, z, B.spruce_leaves);
      break;
    }
    case 'jungle': {
      const h = r.range(5, 9);
      tDirt(ctx, x, y - 1, z);
      for (let i = 0; i < h; i++) tLog(ctx, x, y + i, z, B.jungle_log);
      for (let dy = h - 3; dy <= h; dy++) leafLayer(ctx, r, x, y + dy, z, dy >= h - 1 ? 1 : 2, B.jungle_leaves, dy === h);
      for (let i = 1; i < h - 2; i++) for (let f = 0; f < 4; f++) if (r.next() < 0.3) {
        const vx = x + FACING_DX[f], vz = z + FACING_DZ[f];
        const c = ctx.get(vx, y + i, vz); if (c === 0) ctx.set(vx, y + i, vz, B.vine | (VINE_META_TOWARD[(f + 2) & 3] << 12));
      }
      break;
    }
    case 'mega_jungle': {
      const h = r.range(14, 24);
      for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) tDirt(ctx, x + dx, y - 1, z + dz);
      for (let i = 0; i < h; i++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) tLog(ctx, x + dx, y + i, z + dz, B.jungle_log);
      const nb = r.range(2, 4);
      for (let k = 0; k < nb; k++) {
        const by = y + r.range(Math.floor(h / 2), h - 4), a = r.next() * Math.PI * 2, len = r.range(3, 4);
        const ex = x + Math.round(Math.cos(a) * len), ez = z + Math.round(Math.sin(a) * len);
        for (let s = 1; s <= len; s++) tLog(ctx, Math.round(x + (ex - x) * s / len), by + (s >> 1), Math.round(z + (ez - z) * s / len), B.jungle_log);
        leafDisk(ctx, ex, by + (len >> 1) + 1, ez, 2, B.jungle_leaves);
        leafDisk(ctx, ex, by + (len >> 1) + 2, ez, 1, B.jungle_leaves);
      }
      leafDisk(ctx, x, y + h - 1, z, 4, B.jungle_leaves, 0.5, 0.5);
      leafDisk(ctx, x, y + h, z, 4, B.jungle_leaves, 0.5, 0.5);
      leafDisk(ctx, x, y + h + 1, z, 3, B.jungle_leaves, 0.5, 0.5);
      for (let dx = -5; dx <= 6; dx++) for (let dz = -5; dz <= 6; dz++) {
        const d = (dx - 0.5) * (dx - 0.5) + (dz - 0.5) * (dz - 0.5);
        const v = r.next(), len = r.int(6);
        if (d > 18 && d < 26 && v < 0.35) {
          const f = Math.abs(dx - 0.5) > Math.abs(dz - 0.5) ? (dx > 0 ? 3 : 1) : (dz > 0 ? 0 : 2);
          tVine(ctx, r, x + dx, y + h - 1, z + dz, VINE_META_TOWARD[f], len + 2);
        }
      }
      break;
    }
    case 'jungle_bush': {
      tDirt(ctx, x, y - 1, z);
      tLog(ctx, x, y, z, B.jungle_log);
      leafLayer(ctx, r, x, y, z, 2, B.oak_leaves, false);
      leafLayer(ctx, r, x, y + 1, z, 1, B.oak_leaves, false);
      tLeaf(ctx, x, y + 2, z, B.oak_leaves);
      break;
    }
    case 'acacia': {
      const h = r.range(5, 7), bend = h - r.range(1, 3), dir = r.int(4);
      const dx = FACING_DX[dir], dz = FACING_DZ[dir];
      tDirt(ctx, x, y - 1, z);
      let cx = x, cz = z;
      for (let i = 0; i < h; i++) { if (i >= bend) { cx += dx; cz += dz; } tLog(ctx, cx, y + i, cz, B.acacia_log); }
      const ty = y + h;
      for (let ddx = -3; ddx <= 3; ddx++) for (let ddz = -3; ddz <= 3; ddz++) if (Math.abs(ddx) + Math.abs(ddz) <= 4) tLeaf(ctx, cx + ddx, ty - 1, cz + ddz, B.acacia_leaves);
      leafLayer(ctx, r, cx, ty, cz, 1, B.acacia_leaves, false);
      if (r.next() < 0.6) {
        const d2 = (dir + 2) & 3; let bx = x, bz = z; const start = bend - 1;
        const blen = r.range(2, 3);
        for (let i = 0; i < blen; i++) { bx += FACING_DX[d2]; bz += FACING_DZ[d2]; tLog(ctx, bx, y + start + i, bz, B.acacia_log); }
        const by = y + start + blen;
        for (let ddx = -2; ddx <= 2; ddx++) for (let ddz = -2; ddz <= 2; ddz++) if (Math.abs(ddx) + Math.abs(ddz) <= 3) tLeaf(ctx, bx + ddx, by, bz + ddz, B.acacia_leaves);
        tLeaf(ctx, bx, by + 1, bz, B.acacia_leaves);
      }
      break;
    }
    case 'dark_oak': {
      const h = r.range(6, 8);
      for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) tDirt(ctx, x + dx, y - 1, z + dz);
      for (let i = 0; i < h; i++) for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) tLog(ctx, x + dx, y + i, z + dz, B.dark_oak_log);
      leafDisk(ctx, x, y + h - 2, z, 3, B.dark_oak_leaves, 0.5, 0.5);
      leafDisk(ctx, x, y + h - 1, z, 4, B.dark_oak_leaves, 0.5, 0.5);
      leafDisk(ctx, x, y + h, z, 3, B.dark_oak_leaves, 0.5, 0.5);
      leafDisk(ctx, x, y + h + 1, z, 2, B.dark_oak_leaves, 0.5, 0.5);
      break;
    }
    case 'swamp_oak': {
      const h = r.range(4, 6);
      tDirt(ctx, x, y - 1, z);
      for (let i = 0; i < h; i++) tLog(ctx, x, y + i, z, L);
      for (let dy = h - 3; dy <= h; dy++) leafLayer(ctx, r, x, y + dy, z, dy >= h - 1 ? (dy === h ? 1 : 2) : 3, LF, dy === h);
      for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
        const v = r.next(), len = r.int(4);
        if ((Math.abs(dx) === 4 || Math.abs(dz) === 4) && Math.abs(dx) + Math.abs(dz) < 7 && v < 0.35) {
          const f = Math.abs(dx) === 4 ? (dx > 0 ? 3 : 1) : (dz > 0 ? 0 : 2);
          tVine(ctx, r, x + dx, y + h - 3, z + dz, VINE_META_TOWARD[f], len + 1);
        }
      }
      break;
    }
    case 'cherry': {
      // leaning trunk, often with a second branch; each crown is a wide, flat blossom canopy with hanging tufts
      const h = r.range(4, 6), dir = r.int(4), dx = FACING_DX[dir], dz = FACING_DZ[dir];
      tDirt(ctx, x, y - 1, z);
      let cx = x, cz = z;
      for (let i = 0; i < h; i++) { if (i >= h - 2) { cx += dx; cz += dz; } tLog(ctx, cx, y + i, cz, B.cherry_log); }
      const crowns = [[cx, y + h, cz]];
      if (r.next() < 0.65) {
        const d2 = (dir + 2) & 3; let bx = x, bz = z; const by0 = y + r.range(1, 2), n = r.range(2, 3);
        for (let i = 0; i < n; i++) { bx += FACING_DX[d2]; bz += FACING_DZ[d2]; tLog(ctx, bx, by0 + i, bz, B.cherry_log); }
        crowns.push([bx, by0 + n, bz]);
      }
      for (const [tx, ty, tz] of crowns) {
        tLog(ctx, tx, ty - 1, tz, B.cherry_log);
        leafDisk(ctx, tx, ty - 1, tz, 3, B.cherry_leaves);
        leafDisk(ctx, tx, ty, tz, 4, B.cherry_leaves);
        leafDisk(ctx, tx, ty + 1, tz, 3, B.cherry_leaves);
        leafDisk(ctx, tx, ty + 2, tz, 1, B.cherry_leaves);
        for (let k = 0; k < 12; k++) {
          const ax = tx + r.range(-4, 4), az = tz + r.range(-4, 4);
          if (ctx.get(ax, ty - 2, az) === 0 && (ctx.get(ax, ty - 1, az) & 4095) === B.cherry_leaves) { tLeaf(ctx, ax, ty - 2, az, B.cherry_leaves); if (r.next() < 0.4 && ctx.get(ax, ty - 3, az) === 0) tLeaf(ctx, ax, ty - 3, az, B.cherry_leaves); }
        }
      }
      break;
    }
    case 'huge_brown_mushroom': case 'huge_red_mushroom': {
      const h = r.range(5, 7), red = type === 'huge_red_mushroom';
      const cap = red ? B.red_mushroom_block : B.brown_mushroom_block;
      for (let i = 0; i < h; i++) tLog(ctx, x, y + i, z, B.mushroom_stem);
      if (red) {
        for (let dy = h - 3; dy < h; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          if ((Math.abs(dx) === 2 || Math.abs(dz) === 2) && !(Math.abs(dx) === 2 && Math.abs(dz) === 2)) tLeaf(ctx, x + dx, y + dy, z + dz, cap);
        }
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) tLeaf(ctx, x + dx, y + h, z + dz, cap);
      } else {
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (!(Math.abs(dx) === 3 && Math.abs(dz) === 3)) tLeaf(ctx, x + dx, y + h, z + dz, cap);
      }
      break;
    }
  }
}
// vine meta bit for "vine attached to the wall in direction f": f=0 north->4, 1 east->8, 2 south->1, 3 west->2
const VINE_META_TOWARD = [4, 8, 1, 2];

// ------------------------------------------------------------ Overworld gen
class OverworldGen {
  constructor(seed, opts) {
    opts = opts || {};
    this.seed = seed >>> 0;
    this.type = opts.worldType || 'default';
    this.structuresOn = opts.structures !== false;
    const r = new RNG(this.seed ^ 0x5EED1234);
    const ns = () => new Noise(r.u32());
    this.nCont = ns(); this.nEro = ns(); this.nRidge = ns(); this.nTemp = ns(); this.nHum = ns(); this.nDetail = ns();
    this.nRiver = ns(); this.nWarp = ns(); this.nTer = ns(); this.nCaveA = ns(); this.nCaveB = ns(); this.nCaveC = ns();
    this.nCaveD = ns(); this.nCheese = ns(); this.nEntr = ns(); this.nVar = ns(); this.nBad = ns(); this.nBadSel = ns();
    this.nMush = ns(); this.nStone = ns(); this.nStoneSel = ns(); this.nSurf = ns(); this.nPatch = ns();
    // added later: appended so every earlier noise (and so the terrain of existing worlds) stays identical
    this.nDrip = ns(); this.nLush = ns(); this.nReef = ns();
    this.cache = new Map();
    this.bands = new Uint16Array(CH);
    const br = new RNG(this.seed ^ 0xBAD1A5D5);
    const bandCols = [B.terracotta, B.orange_terracotta, B.terracotta, B.yellow_terracotta, B.brown_terracotta, B.red_terracotta, B.white_terracotta, B.terracotta, B.light_gray_terracotta, B.orange_terracotta];
    for (let y = 0; y < CH;) { const c = br.pick(bandCols), n = br.range(1, 4); for (let k = 0; k < n && y < CH; k++, y++) this.bands[y] = c; }
    this.amplified = this.type === 'amplified';
    this.structs = typeof Structures !== 'undefined' ? new Structures(this) : null;
  }
  climate(x, z, o) {
    const wx = x + this.nWarp.n2(x * 0.0032, z * 0.0032) * 48;
    const wz = z + this.nWarp.n2(x * 0.0032 + 91.7, z * 0.0032 - 43.1) * 48;
    const cont = clamp(fbm2(this.nCont, wx / 1400, wz / 1400, 5, 0.5) * 1.55 + 0.08, -1, 1);
    const ero = fbm2(this.nEro, wx / 720, wz / 720, 4, 0.5) * 1.45;
    const rn = fbm2(this.nRidge, wx / 300, wz / 300, 5, 0.5);
    const ridge = 1 - Math.abs(rn) * 1.25;
    const det = fbm2(this.nDetail, x / 64, z / 64, 3, 0.45);
    let temp = fbm2(this.nTemp, wx / 1000, wz / 1000, 3, 0.5) * 1.6 + det * 0.03;
    const hum = fbm2(this.nHum, wx / 850, wz / 850, 3, 0.5) * 1.6;
    let h = spline(CONT_SPLINE, cont);
    const inland = smoothstep(-0.12, 0.14, cont);
    const m = smoothstep(-0.12, -0.55, ero) * inland;
    const hill = smoothstep(0.3, -0.25, ero) * inland * (1 - m);
    const rr = Math.max(0, ridge);
    const r2 = rr * rr;
    const mAmp = this.amplified ? 1.9 : 1;
    h += m * (r2 * r2 * 55 + r2 * 35 + det * 9) * mAmp + hill * (rr * 16 - 5 + det * 6) * mAmp + det * 3.2;
    const swamp = smoothstep(0.35, 0.55, hum) * smoothstep(0.5, 0.15, Math.abs(temp - 0.05)) * inland * (1 - m) * (1 - hill * 0.7);
    if (swamp > 0) h = lerp(h, SEA + 0.4 + det * 2.2, swamp);
    const bad = smoothstep(0.45, 0.7, temp) * smoothstep(0.05, 0.3, this.nBadSel.n2(x / 700, z / 700)) * smoothstep(0.2, -0.1, hum) * inland;
    if (bad > 0.01) {
      const p = this.nBad.n2(x / 150, z / 150);
      const plateau = smoothstep(0.25, 0.4, p) * 18 + smoothstep(0.55, 0.65, p) * 12;
      h += bad * plateau;
    }
    let mush = 0;
    if (cont < -0.35) {
      const mn = this.nMush.n2(x / 420, z / 420);
      mush = smoothstep(0.62, 0.75, mn);
      if (mush > 0) h = lerp(h, SEA + 3 + det * 4, mush);
    }
    const rv = Math.abs(fbm2(this.nRiver, wx / 620, wz / 620, 4, 0.5));
    let river = 0;
    if (cont > -0.2 && mush < 0.1) {
      const width = 0.032 + m * 0.02;
      river = smoothstep(width * 2.3, width * 0.55, rv) * smoothstep(-0.2, -0.07, cont);
      if (river > 0) { const target = SEA - 1.5 - river * 4; if (h > target) h = lerp(h, target, river); }
    }
    const cap = this.amplified ? 176 : 140;
    if (h > cap) h = cap + (h - cap) * 0.45;
    if (h > CH - 14) h = CH - 14;
    temp -= Math.max(0, h - 92) / 50;
    o.h = h; o.m = m; o.hill = hill; o.cont = cont; o.temp = temp; o.hum = hum; o.river = river; o.swamp = swamp;
    o.bad = bad; o.det = det; o.mush = mush; o.ridge = ridge;
    o.amp = (this.amplified ? 26 : 13) * m + hill * 3;
    o.variant = this.nVar.n2(x / 300, z / 300);
    o.biome = this.pickBiome(o);
    return o;
  }
  pickBiome(o) {
    const h = o.h, t = o.temp, hu = o.hum;
    if (o.mush > 0.5 && h >= SEA - 1) return BIO.MUSHROOM;
    if (h < SEA - 0.5) {
      if (o.river > 0.3 && o.cont > -0.2) return t < -0.45 ? BIO.FROZEN_RIVER : BIO.RIVER;
      if (o.swamp > 0.5) return BIO.SWAMP;
      if (t < -0.45) return BIO.FROZEN_OCEAN;
      if (t > 0.6) return BIO.WARM_OCEAN;
      return o.cont < -0.42 ? BIO.DEEP_OCEAN : BIO.OCEAN;
    }
    if (o.river > 0.55 && h < SEA + 1.5) return t < -0.45 ? BIO.FROZEN_RIVER : BIO.RIVER;
    if (o.cont < -0.05 && h < SEA + 3.5 && o.swamp < 0.5) {
      if (o.m > 0.25 || o.hill > 0.6) return BIO.STONY_SHORE;
      return t < -0.45 ? BIO.SNOWY_BEACH : BIO.BEACH;
    }
    if (o.m > 0.35 && h > SEA + 38) return (h > 130 || t < -0.5) ? BIO.SNOWY_PEAKS : BIO.MOUNTAINS;
    if (o.swamp > 0.5) return BIO.SWAMP;
    if (o.bad > 0.5) return BIO.BADLANDS;
    if (t < -0.45) return hu < 0 ? BIO.SNOWY_PLAINS : BIO.SNOWY_TAIGA;
    if (t < -0.15) return hu < -0.3 ? BIO.PLAINS : BIO.TAIGA;
    if (t < 0.3) {
      if (hu >= -0.35 && hu < 0.35 && o.variant < -0.42 && o.hill > 0.08) return BIO.CHERRY_GROVE;
      if (hu < -0.3) return BIO.PLAINS;
      if (hu < 0.05) return o.variant > 0.5 ? BIO.FLOWER_FOREST : BIO.FOREST;
      if (hu < 0.35) return o.variant > 0.1 ? BIO.BIRCH_FOREST : BIO.FOREST;
      return BIO.DARK_FOREST;
    }
    if (t < 0.6) {
      if (hu < -0.2) return BIO.SAVANNA;
      if (hu < 0.3) return BIO.PLAINS;
      return BIO.JUNGLE;
    }
    if (hu < 0.0) return BIO.DESERT;
    if (hu < 0.3) return BIO.SAVANNA;
    return BIO.JUNGLE;
  }
  climateCached(x, z) {
    const k = x * 131072 + z;
    let o = this.cache.get(k);
    if (!o) { o = this.climate(x, z, {}); if (this.cache.size > 60000) this.cache.clear(); this.cache.set(k, o); }
    return o;
  }
  ter3(x, y, z) { return this.nTer.n3(x / 44, y / 30, z / 44) * 0.7 + this.nTer.n3(x / 19 + 50, y / 14, z / 19) * 0.3; }
  surfaceAt(x, z, c) {
    const h = c.h, amp = c.amp;
    if (amp < 0.05) return Math.ceil(h) - 1;
    const hi = Math.min(CH - 1, Math.floor(h + amp + 1)), lo = Math.floor(h - amp - 1);
    for (let y = hi; y > lo; y--) if (h - y + amp * this.ter3(x, y, z) > 0) return y;
    return lo;
  }
  slopeAt(x, z) {
    const a = this.climateCached(x + 1, z).h, b = this.climateCached(x - 1, z).h, c = this.climateCached(x, z + 1).h, d = this.climateCached(x, z - 1).h;
    return Math.max(Math.abs(a - b), Math.abs(c - d));
  }
  entrance(x, z) { return this.nEntr.n2(x / 90, z / 90) > 0.62; }
  caveDensity(x, y, z) {
    const a = this.nCaveA.n3(x / 68, y / 40, z / 68), b = this.nCaveB.n3(x / 68, y / 40, z / 68);
    const s1 = 0.0115 - (a * a + b * b);
    const c = this.nCaveC.n3(x / 44 + 300, y / 32, z / 44), d = this.nCaveD.n3(x / 44 + 300, y / 32, z / 44);
    const s2 = 0.0085 - (c * c + d * d);
    let ch = fbm3(this.nCheese, x / 110, y / 60, z / 110, 2, 0.5) - 0.46;
    if (y > 45) ch -= (y - 45) * 0.012;
    if (y < 22) ch += (22 - y) * 0.004;
    let v = Math.max(s1 * 40, s2 * 45, ch * 5);
    if (y < 5) v -= (5 - y) * 0.25;
    return v;
  }
  generate(cx, cz) {
    const blocks = new Uint16Array(CVOL);
    const ctx = new ChunkCtx(blocks, cx, cz);
    const x0 = cx << 4, z0 = cz << 4;
    if (this.cache.size > 30000) this.cache.clear();
    if (this.type === 'flat') return this.generateFlat(ctx);
    // climate for 18x18 (1 border)
    const H = new Float32Array(324), AMP = new Float32Array(324), BI = new Uint8Array(324);
    for (let dz = -1; dz <= 16; dz++) for (let dx = -1; dx <= 16; dx++) {
      const c = this.climateCached(x0 + dx, z0 + dz), i = (dz + 1) * 18 + dx + 1;
      H[i] = c.h; AMP[i] = c.amp; BI[i] = c.biome;
    }
    const biomes = new Uint8Array(256), top = new Int16Array(256);
    let maxTop = 0;
    // ---------------- terrain fill
    const STONE = B.stone;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = (z + 1) * 18 + x + 1, h = H[i], amp = AMP[i];
      biomes[z * 16 + x] = BI[i];
      const wx = x0 + x, wz = z0 + z;
      let t = -1;
      if (amp < 0.05) {
        const tt = Math.min(CH - 1, Math.ceil(h) - 1);
        for (let y = 0; y <= tt; y++) blocks[(y << 8) | (z << 4) | x] = STONE;
        t = tt;
      } else {
        const hi = Math.min(CH - 1, Math.floor(h + amp + 1)), lo = Math.floor(h - amp - 1);
        for (let y = 0; y <= lo && y < CH; y++) blocks[(y << 8) | (z << 4) | x] = STONE;
        t = lo;
        for (let y = Math.max(0, lo + 1); y <= hi; y++) {
          if (h - y + amp * this.ter3(wx, y, wz) > 0) { blocks[(y << 8) | (z << 4) | x] = STONE; if (y > t) t = y; }
        }
      }
      top[z * 16 + x] = t;
      if (t > maxTop) maxTop = t;
    }
    // ---------------- surface rules + water
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = (z + 1) * 18 + x + 1, wx = x0 + x, wz = z0 + z;
      const bio = BIOMES[BI[i]], t = top[z * 16 + x];
      const slope = Math.max(Math.abs(H[i + 1] - H[i - 1]), Math.abs(H[i + 18] - H[i - 18]));
      const sn = this.nSurf.n2(wx / 12, wz / 12);
      const fillerDepth = 3 + (sn > 0.2 ? 1 : 0) + (sn > 0.6 ? 1 : 0);
      const cl = this.climateCached(wx, wz);
      let depth = -1, surfaces = 0;
      const snowLine = 124 + cl.det * 8;
      for (let y = t; y >= 1; y--) {
        const p = (y << 8) | (z << 4) | x;
        const id = blocks[p];
        if (id === 0) { depth = -1; continue; }
        if (id !== STONE) continue;
        depth++;
        if (depth === 0) surfaces++;
        if (surfaces > 2) continue;
        let v = STONE;
        const under = y < SEA - 1;
        if (under) {
          if (depth < fillerDepth) {
            if (bio.id === BIO.RIVER || bio.id === BIO.FROZEN_RIVER) v = sn > 0.35 ? B.gravel : sn < -0.45 ? B.clay : B.sand;
            else if (bio.id === BIO.SWAMP) v = sn > 0.3 ? B.clay : B.dirt;
            else if (bio.id === BIO.DEEP_OCEAN || bio.id === BIO.FROZEN_OCEAN) v = sn < -0.3 ? B.sand : B.gravel;
            else if (bio.ocean) v = sn > 0.45 ? B.gravel : sn < -0.55 ? B.clay : B.sand;
            else v = depth === 0 ? (sn > 0.3 ? B.gravel : B.sand) : B.sand;
            if (depth > 0 && v === B.sand && (bio.id === BIO.DESERT || bio.ocean)) v = B.sand;
          }
        } else if (bio.id === BIO.BADLANDS) {
          if (depth === 0 && slope < 2.5) v = y > 95 ? B.coarse_dirt : B.red_sand;
          else if (depth < 2 && slope < 2.5) v = B.red_sand;
          else v = this.bands[clamp(y + Math.round(this.nPatch.n2(wx / 30, wz / 30) * 2), 0, CH - 1)];
          if (y < SEA - 4 && depth > fillerDepth) v = STONE;
        } else if (depth < fillerDepth) {
          const steep = slope > (bio.id === BIO.MOUNTAINS || bio.id === BIO.SNOWY_PEAKS || bio.id === BIO.STONY_SHORE ? 2.2 : 3.2);
          if (bio.id === BIO.DESERT || bio.id === BIO.BEACH || bio.id === BIO.SNOWY_BEACH) {
            v = B.sand;
          } else if (bio.id === BIO.SNOWY_PEAKS) {
            v = steep && sn > 0 ? STONE : (depth < 2 ? B.snow : STONE);
          } else if (bio.id === BIO.STONY_SHORE) {
            v = sn > 0.4 ? B.gravel : STONE;
          } else if (steep) {
            v = (bio.id === BIO.MOUNTAINS && sn > 0.5) ? B.gravel : STONE;
          } else if (bio.id === BIO.RIVER || bio.id === BIO.FROZEN_RIVER) {
            v = depth === 0 ? (y <= SEA ? B.sand : B.grass_block) : B.dirt;
          } else if (depth === 0) {
            if (bio.id === BIO.MUSHROOM) v = B.mycelium;
            else if ((bio.id === BIO.TAIGA || bio.id === BIO.SNOWY_TAIGA) && sn > 0.35) v = B.podzol;
            else if (bio.id === BIO.SAVANNA && sn > 0.55) v = B.coarse_dirt;
            else if (bio.id === BIO.MOUNTAINS && y > snowLine) v = B.snow;
            else if (y <= SEA && (bio.id !== BIO.SWAMP) && H[i] < SEA + 1.2 && sn > -0.2) v = B.sand;
            else v = B.grass_block;
          } else v = B.dirt;
        } else if ((bio.id === BIO.DESERT || bio.id === BIO.BEACH) && depth < fillerDepth + 4) v = B.sandstone;
        blocks[p] = v;
      }
      // water
      if (t < SEA) {
        const frozen = bio.snowy || cl.temp < -0.45;
        for (let y = t + 1; y <= SEA; y++) {
          const p = (y << 8) | (z << 4) | x;
          if (blocks[p] === 0) blocks[p] = (y === SEA && frozen) ? B.ice : B.water;
        }
      }
    }
    // ---------------- bedrock + deepslate + stone variants (coarse noise grid)
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z;
      blocks[(z << 4) | x] = B.bedrock;
      for (let y = 1; y <= 4; y++) if (hashF3(this.seed, wx, y, wz) < (5 - y) / 5) blocks[(y << 8) | (z << 4) | x] = B.bedrock;
      for (let y = 5; y < 16; y++) {
        const p = (y << 8) | (z << 4) | x;
        if (blocks[p] === STONE && (y < 8 || hashF3(this.seed ^ 77, wx, y, wz) < (16 - y) / 8)) blocks[p] = B.deepslate;
      }
    }
    this.stoneVariants(blocks, x0, z0, maxTop);
    // ---------------- caves
    this.carveCaves(blocks, x0, z0, top, H, maxTop);
    // ---------------- ores
    const orng = new RNG(hash2(this.seed ^ 0x0E5, cx, cz));
    this.ores(ctx, orng, maxTop);
    // ---------------- cave dressing: dripstone & mossy zones, glow lichen; amethyst geodes
    this.caveDecor(ctx, top);
    this.geodes(ctx);
    // ---------------- dungeon (chunk local)
    if (this.structuresOn && orng.next() < 0.3 && this.structs) this.structs.dungeon(ctx, orng);
    // ---------------- trees, vegetation
    this.trees(ctx);
    this.vegetation(ctx, BI, top);
    if (this.structuresOn) this.oceanRuin(ctx, BI);
    // ---------------- structures
    if (this.structuresOn && this.structs) this.structs.apply(ctx);
    // ---------------- snow & ice
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z;
      const bio = BIOMES[BI[(z + 1) * 18 + x + 1]];
      let y = CH - 1;
      while (y > 0 && blocks[(y << 8) | (z << 4) | x] === 0) y--;
      const cl = this.climateCached(wx, wz);
      const tempAt = cl.temp - Math.max(0, y - cl.h) / 40;
      const cold = bio.snowy || tempAt < -0.5 || (bio.id === BIO.MOUNTAINS && y > 124 + cl.det * 8);
      if (!cold || y >= CH - 1) continue;
      const p = (y << 8) | (z << 4) | x, id = blocks[p] & 4095;
      if (id === B.water && (blocks[p] >> 12) === 0) { blocks[p] = B.ice; continue; }
      if ((OPAQUE[id] || LEAVES[id]) && id !== B.ice && id !== B.packed_ice) blocks[p + 256] = B.snow_layer;
    }
    // initial animals
    if (hashF2(this.seed ^ 0xA11, cx, cz) < 0.12) {
      const bio = BIOMES[BI[9 * 18 + 9]];
      if (bio.animals) {
        const ar = new RNG(hash2(this.seed ^ 0xA12, cx, cz));
        const type = ar.pick(bio.animals), n = ar.range(2, 4);
        for (let k = 0; k < n; k++) {
          const x = ar.range(2, 13), z = ar.range(2, 13);
          let y = CH - 2; while (y > 0 && blocks[(y << 8) | (z << 4) | x] === 0) y--;
          const id = blocks[(y << 8) | (z << 4) | x] & 4095;
          if (id === B.grass_block || id === B.snow_layer || id === B.mycelium) ctx.spawn(type, x0 + x + 0.5, y + 1, z0 + z + 0.5);
        }
      }
    }
    return { blocks, biomes, be: ctx.be, spawns: ctx.spawns, tags: ctx.tags, tints: this.tints(x0, z0) };
  }
  generateFlat(ctx) {
    const b = ctx.b;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      b[(z << 4) | x] = B.bedrock;
      b[(1 << 8) | (z << 4) | x] = B.dirt; b[(2 << 8) | (z << 4) | x] = B.dirt;
      b[(3 << 8) | (z << 4) | x] = B.grass_block;
    }
    const biomes = new Uint8Array(256).fill(BIO.PLAINS);
    if (hashF2(this.seed ^ 0xA11, ctx.cx, ctx.cz) < 0.1) ctx.spawn(['cow', 'sheep', 'pig', 'chicken'][hash2(this.seed, ctx.cx, ctx.cz) & 3], ctx.x0 + 8.5, 4, ctx.z0 + 8.5);
    const t = new Uint32Array(256).fill(0x91BD59), f = new Uint32Array(256).fill(0x77AB2F), w = new Uint32Array(256).fill(0x3F76E4);
    return { blocks: b, biomes, be: ctx.be, spawns: ctx.spawns, tags: 0, tints: { grass: t, foliage: f, water: w } };
  }
  // biome tint colors, blended over a coarse grid for smooth transitions
  tints(x0, z0) {
    const G = 8, gx0 = x0 - 12, gz0 = z0 - 12; // grid points every 4 blocks from -12..+24
    const N = 10, gg = new Uint32Array(N * N), gf = new Uint32Array(N * N), gw = new Uint32Array(N * N);
    const rawG = new Float32Array(N * N * 3), rawF = new Float32Array(N * N * 3), rawW = new Float32Array(N * N * 3);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const c = this.climateCached(gx0 + i * 4, gz0 + j * 4), b = BIOMES[c.biome], k = (j * N + i) * 3;
      let g = b.grass, f = b.foliage;
      if (b.id === BIO.PLAINS || b.id === BIO.FOREST || b.id === BIO.SAVANNA || b.id === BIO.JUNGLE || b.id === BIO.BIRCH_FOREST || b.id === BIO.TAIGA) {
        // subtle climate-driven variation
        const t = clamp(c.temp * 0.5 + 0.5, 0, 1), hm = clamp(c.hum * 0.5 + 0.5, 0, 1);
        g = mixColor(g, mixColor(0x8AB070, 0x6CC34A, hm), 0.25 * (1 - t * 0.3));
      }
      rawG[k] = (g >> 16) & 255; rawG[k + 1] = (g >> 8) & 255; rawG[k + 2] = g & 255;
      rawF[k] = (f >> 16) & 255; rawF[k + 1] = (f >> 8) & 255; rawF[k + 2] = f & 255;
      rawW[k] = (b.water >> 16) & 255; rawW[k + 1] = (b.water >> 8) & 255; rawW[k + 2] = b.water & 255;
    }
    const blur = (raw, out) => {
      for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        let r = 0, g = 0, b = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = ((j + dj) * N + i + di) * 3; r += raw[k]; g += raw[k + 1]; b += raw[k + 2]; }
        out[j * N + i] = ((r / 9) << 16) | ((g / 9) << 8) | (b / 9);
      }
    };
    blur(rawG, gg); blur(rawF, gf); blur(rawW, gw);
    const outG = new Uint32Array(256), outF = new Uint32Array(256), outW = new Uint32Array(256);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const fx = (x + 12) / 4, fz = (z + 12) / 4, i = Math.floor(fx), j = Math.floor(fz), tx2 = fx - i, tz = fz - j;
      const bil = (arr) => {
        const a = mixColor(arr[j * N + i], arr[j * N + i + 1], tx2), b = mixColor(arr[(j + 1) * N + i], arr[(j + 1) * N + i + 1], tx2);
        return mixColor(a, b, tz);
      };
      outG[z * 16 + x] = bil(gg); outF[z * 16 + x] = bil(gf); outW[z * 16 + x] = bil(gw);
    }
    return { grass: outG, foliage: outF, water: outW };
  }
  stoneVariants(blocks, x0, z0, maxTop) {
    const NY = Math.min(CH - 1, maxTop) >> 2;
    const grid = new Float32Array(5 * 5 * (NY + 2));
    for (let gy = 0; gy <= NY + 1; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++)
      grid[(gy * 5 + gz) * 5 + gx] = this.nStone.n3((x0 + gx * 4) / 26, gy * 4 / 18, (z0 + gz * 4) / 26);
    const types = [B.granite, B.diorite, B.andesite];
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
      const sel = types[Math.floor((this.nStoneSel.n2((x0 + x) / 90, (z0 + z) / 90) * 0.5 + 0.5) * 2.999)];
      for (let y = 8; y < Math.min(CH, maxTop); y++) {
        const p = (y << 8) | (z << 4) | x;
        if (blocks[p] !== B.stone) continue;
        const gy = y >> 2, fy = (y & 3) / 4;
        const i0 = (gy * 5 + gz) * 5 + gx, i1 = i0 + 25;
        const a = lerp(lerp(grid[i0], grid[i0 + 1], fx), lerp(grid[i0 + 5], grid[i0 + 6], fx), fz);
        const b = lerp(lerp(grid[i1], grid[i1 + 1], fx), lerp(grid[i1 + 5], grid[i1 + 6], fx), fz);
        if (lerp(a, b, fy) > 0.52) blocks[p] = sel;
      }
    }
  }
  carveCaves(blocks, x0, z0, top, H, maxTop) {
    const NY = Math.min(CH - 1, maxTop + 4) >> 2;
    const grid = new Float32Array(5 * 5 * (NY + 2));
    for (let gy = 0; gy <= NY + 1; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++)
      grid[(gy * 5 + gz) * 5 + gx] = this.caveDensity(x0 + gx * 4, gy * 4, z0 + gz * 4);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const t = top[z * 16 + x], i = (z + 1) * 18 + x + 1;
      const wet = H[i] < SEA + 1.5;
      const ent = !wet && this.entrance(x0 + x, z0 + z);
      const limit = wet ? Math.min(t - 5, SEA - 8) : ent ? t + 1 : t - 4;
      const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
      for (let y = 1; y <= limit && y < CH - 1; y++) {
        const gy = y >> 2, fy = (y & 3) / 4;
        const i0 = (gy * 5 + gz) * 5 + gx, i1 = i0 + 25;
        const a = lerp(lerp(grid[i0], grid[i0 + 1], fx), lerp(grid[i0 + 5], grid[i0 + 6], fx), fz);
        const b = lerp(lerp(grid[i1], grid[i1 + 1], fx), lerp(grid[i1 + 5], grid[i1 + 6], fx), fz);
        if (lerp(a, b, fy) > 0) {
          const p = (y << 8) | (z << 4) | x, id = blocks[p];
          if (id === 0 || id === B.bedrock || id === B.water || id === B.ice) continue;
          if (blocks[p + 256] === B.water) continue;
          blocks[p] = y <= 10 ? B.lava : 0;
          // don't leave floating grass: convert dirt below exposed grass etc. (handled naturally)
        }
      }
      // fix grass under carved surface -> expose dirt as grass if at top
      if (ent) {
        for (let y = Math.min(CH - 2, t); y > 1; y--) {
          const p = (y << 8) | (z << 4) | x;
          if (blocks[p] === B.dirt && blocks[p + 256] === 0 && y >= SEA) { blocks[p] = B.grass_block; break; }
          if (blocks[p] !== 0) break;
        }
      }
    }
  }
  ores(ctx, r, maxTop) {
    const b = ctx.b;
    const vein = (id, did, size, count, minY, maxY, tri) => {
      for (let c = 0; c < count; c++) {
        let x = r.int(16), z = r.int(16);
        let y = tri ? Math.round((r.range(minY, maxY) + r.range(minY, maxY)) / 2) : r.range(minY, maxY);
        for (let s = 0; s < size; s++) {
          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y > 0 && y < CH) {
            const p = (y << 8) | (z << 4) | x, cur = b[p];
            if (cur === B.stone || cur === B.granite || cur === B.diorite || cur === B.andesite) b[p] = id;
            else if (cur === B.deepslate && did) b[p] = did;
          }
          const d = r.int(6);
          if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4) y++; else y--;
        }
      }
    };
    const top = Math.min(maxTop, CH - 1);
    vein(B.coal_ore, B.deepslate_coal_ore, 14, 18, 5, Math.min(top, 130), false);
    vein(B.iron_ore, B.deepslate_iron_ore, 8, 16, 1, 72, true);
    vein(B.iron_ore, 0, 8, 6, 80, Math.max(81, Math.min(top, 150)), false);
    vein(B.gold_ore, B.deepslate_gold_ore, 8, 3, 1, 34, true);
    vein(B.redstone_ore, B.deepslate_redstone_ore, 7, 6, 1, 16, false);
    vein(B.lapis_ore, B.deepslate_lapis_ore, 6, 2, 1, 32, true);
    vein(B.diamond_ore, B.deepslate_diamond_ore, 5, 1, 1, 15, false);
    if (r.next() < 0.5) vein(B.diamond_ore, B.deepslate_diamond_ore, 3, 1, 1, 12, false);
    vein(B.dirt, 0, 22, 4, 5, Math.min(top, 100), false);
    vein(B.gravel, 0, 22, 4, 5, Math.min(top, 100), false);
    const c0 = this.climateCached(ctx.x0 + 8, ctx.z0 + 8);
    if (c0.biome === BIO.BADLANDS) vein(B.gold_ore, 0, 8, 12, 32, 80, false);
    if (c0.biome === BIO.MOUNTAINS || c0.biome === BIO.SNOWY_PEAKS) {
      for (let k = 0; k < 6; k++) { const x = r.int(16), z = r.int(16), y = r.range(8, 90); const p = (y << 8) | (z << 4) | x; if (b[p] === B.stone) b[p] = B.emerald_ore; }
    }
    // newer ores use their own random stream so older ores and dungeons stay where they were
    const r2 = new RNG(hash2(this.seed ^ 0xC0B7, ctx.cx, ctx.cz)), r0 = r;
    r = r2;
    vein(B.copper_ore, B.deepslate_copper_ore, 10, 8, 1, Math.min(top, 96), true);
    vein(B.tuff, B.tuff, 34, 2, 1, 18, false);
    r = r0;
  }
  // Cave dressing, chunk-local: dripstone zones (stalactites & stalagmites), mossy zones, and glow lichen
  // on cave walls everywhere (denser in mossy zones). Only touches air enclosed well below the surface.
  caveDecor(ctx, top) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0;
    const stoneish = (id) => id === B.stone || id === B.deepslate || id === B.andesite || id === B.diorite || id === B.granite || id === B.tuff;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z, t = top[z * 16 + x];
      const drip = this.nDrip.n2(wx / 170, wz / 170), lush = this.nLush.n2(wx / 150, wz / 150);
      for (let y = 6; y < t - 7; y++) {
        const p = (y << 8) | (z << 4) | x;
        if (b[p] !== 0) continue;
        const below = b[p - 256] & 4095, above = b[p + 256] & 4095;
        const h = hashF3(this.seed ^ 0xCA7E, wx, y, wz);
        if (stoneish(below)) {
          if (lush > 0.38) { b[p - 256] = B.moss_block; if (h < 0.3) { b[p] = B.moss_carpet; continue; } }
          else if (drip > 0.4) { b[p - 256] = B.dripstone_block; if (h < 0.1 && above === 0) { b[p] = B.pointed_dripstone | (1 << 12); continue; } }
        }
        if (stoneish(above) && drip > 0.4 && lush <= 0.38) { b[p + 256] = B.dripstone_block; if (h > 0.87 && below === 0) { b[p] = B.pointed_dripstone; continue; } }
        if (h > (lush > 0.3 ? 0.93 : 0.985) && x > 0 && x < 15 && z > 0 && z < 15) {
          for (let f = 0; f < 4; f++) { const q = p + FACING_DX[f] + FACING_DZ[f] * 16; if (OPAQUE[b[q] & 4095]) { b[p] = B.glow_lichen | (VINE_META_TOWARD[f] << 12); break; } }
        }
      }
    }
  }
  // Amethyst geodes: layered spheres (smooth basalt, calcite, amethyst) with a hollow core lined with
  // clusters. Planned per chunk from a hash so geodes crossing chunk borders line up.
  geodes(ctx) {
    for (let ncz = ctx.cz - 1; ncz <= ctx.cz + 1; ncz++) for (let ncx = ctx.cx - 1; ncx <= ctx.cx + 1; ncx++) {
      const r = new RNG(hash2(this.seed ^ 0x6E0DE, ncx, ncz));
      if (r.next() > 0.03) continue;
      const cx = ncx * 16 + r.range(3, 12), cz = ncz * 16 + r.range(3, 12);
      const surf = Math.floor(this.climateCached(cx, cz).h);
      if (surf < 34) continue;
      const cy = r.range(12, Math.min(58, surf - 18)), R = r.range(4, 6) + 0.5, gs = r.u32();
      if (!ctx.overlaps(cx - 7, cz - 7, cx + 7, cz + 7)) continue;
      const cells = [];
      for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let z = Math.max(ctx.z0, Math.floor(cz - R)); z <= Math.min(ctx.z0 + 15, Math.ceil(cz + R)); z++) for (let x = Math.max(ctx.x0, Math.floor(cx - R)); x <= Math.min(ctx.x0 + 15, Math.ceil(cx + R)); x++) {
        const dx = x - cx, dy = (y - cy) * 1.15, dz = z - cz;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + (hashF3(gs, x, y, z) - 0.5) * 0.7;
        if (d > R) continue;
        const cur = ctx.get(x, y, z); if (cur < 0 || (cur & 4095) === B.bedrock) continue;
        let v;
        if (d < R - 3) { v = 0; cells.push(x, y, z); }
        else if (d < R - 2) v = hashF3(gs ^ 7, x, y, z) < 0.12 ? B.budding_amethyst : B.amethyst_block;
        else if (d < R - 1) v = B.calcite;
        else v = B.smooth_basalt;
        ctx.set(x, y, z, v);
      }
      for (let i = 0; i < cells.length; i += 3) {
        const x = cells[i], y = cells[i + 1], z = cells[i + 2];
        if (hashF3(gs ^ 11, x, y, z) > 0.35) continue;
        if ((ctx.get(x, y - 1, z) & 4095) === B.budding_amethyst || (ctx.get(x, y - 1, z) & 4095) === B.amethyst_block && hashF3(gs ^ 13, x, y, z) < 0.3) ctx.set(x, y, z, B.amethyst_cluster);
        else if ((ctx.get(x, y + 1, z) & 4095) === B.budding_amethyst) ctx.set(x, y, z, B.amethyst_cluster);
      }
    }
  }
  // Small sunken ruins on the ocean floor: a broken ring of old bricks around a loot chest
  oceanRuin(ctx, BI) {
    const bio = BIOMES[BI[9 * 18 + 9]];
    if (!bio.ocean) return;
    const r = new RNG(hash2(this.seed ^ 0x0CEA7, ctx.cx, ctx.cz));
    if (r.next() > 0.035) return;
    const b = ctx.b, cx = 8, cz = 8;
    let fy = SEA; while (fy > 5 && ((b[(fy << 8) | (cz << 4) | cx] & 4095) === B.water || WLOG[b[(fy << 8) | (cz << 4) | cx] & 4095])) fy--;
    if (SEA - fy < 5) return;
    const warm = bio.id === BIO.WARM_OCEAN;
    const mats = warm ? [B.prismarine_bricks, B.prismarine, B.dark_prismarine, B.prismarine_bricks] : [B.stone_bricks, B.mossy_stone_bricks, B.cracked_stone_bricks, B.mossy_stone_bricks];
    const rad = r.range(2, 3);
    for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
      const x = cx + dx, z = cz + dz, ring = Math.max(Math.abs(dx), Math.abs(dz)) === rad;
      b[(fy << 8) | (z << 4) | x] = r.pick(mats);
      if (!ring) continue;
      const hh = r.next() < 0.25 ? 0 : r.range(1, 3);
      for (let i = 1; i <= hh && fy + i < SEA - 1; i++) b[((fy + i) << 8) | (z << 4) | x] = r.next() < 0.1 ? B.sea_lantern : r.pick(mats);
    }
    ctx.chest(ctx.x0 + cx, fy + 1, ctx.z0 + cz, r.int(4), 'ocean_ruin', r.u32());
  }
  treeGroundOK(x, z, c) {
    const bio = BIOMES[c.biome];
    if (!bio.treeTypes) return false;
    if (c.h < SEA + 0.5 && c.biome !== BIO.SWAMP) return false;
    if (this.entrance(x, z)) return false;
    const slope = this.slopeAt(x, z);
    if (slope > (c.biome === BIO.MOUNTAINS ? 2.2 : 3.2)) return false;
    if (c.biome === BIO.MOUNTAINS && c.h > 118) return false;
    if (this.structs && this.structs.inVillage(x, z)) return false;
    return true;
  }
  trees(ctx) {
    for (let ncz = ctx.cz - 1; ncz <= ctx.cz + 1; ncz++) for (let ncx = ctx.cx - 1; ncx <= ctx.cx + 1; ncx++) {
      const r = new RNG(hash2(this.seed ^ 0x7EE5, ncx, ncz));
      const c0 = this.climateCached(ncx * 16 + 8, ncz * 16 + 8);
      const b0 = BIOMES[c0.biome];
      let n = Math.floor(b0.trees); if (r.next() < b0.trees - n) n++;
      if (b0.trees > 0 && b0.trees < 1 && n === 0 && r.next() < 0.15) n = 1;
      for (let k = 0; k < n; k++) {
        const lx = r.int(16), lz = r.int(16), r2 = r.u32(), r3 = r.next();
        const wx = ncx * 16 + lx, wz = ncz * 16 + lz;
        if (wx < ctx.x0 - 9 || wx > ctx.x0 + 24 || wz < ctx.z0 - 9 || wz > ctx.z0 + 24) continue;
        const c = this.climateCached(wx, wz);
        if (!this.treeGroundOK(wx, wz, c)) continue;
        const bio = BIOMES[c.biome];
        const type = weightedPick(bio.treeTypes, r3);
        const y = this.surfaceAt(wx, wz, c);
        if (y < SEA - 1 || y > CH - 32) continue;
        if (c.biome !== BIO.SWAMP && y < SEA) continue;
        placeTree(ctx, type, new RNG(r2), wx, y + 1, wz);
      }
    }
  }
  vegetation(ctx, BI, top) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z;
      const bio = BIOMES[BI[(z + 1) * 18 + x + 1]];
      let y = Math.min(CH - 2, top[z * 16 + x] + 2);
      while (y > 1 && b[(y << 8) | (z << 4) | x] === 0) y--;
      const p = (y << 8) | (z << 4) | x, id = b[p] & 4095;
      if (y >= CH - 2) continue;
      const h = hashF2(this.seed ^ 0xF10A, wx, wz), h2 = hashF2(this.seed ^ 0xF10B, wx, wz);
      const above = p + 256;
      if (id === B.grass_block && b[above] === 0) {
        if (h < bio.grassD) b[above] = h2 < bio.fern ? B.fern : B.tall_grass;
        else if (h < bio.grassD + bio.flowerD && bio.flowers) {
          const fl = bio.flowers[Math.floor(this.nPatch.n2(wx / 24, wz / 24) * 0.5 * bio.flowers.length + bio.flowers.length / 2 + h2 * 1.5) % bio.flowers.length];
          b[above] = B[fl] || B.dandelion;
        } else if ((bio.id === BIO.DARK_FOREST || bio.id === BIO.SWAMP || bio.id === BIO.TAIGA) && h > 0.993) b[above] = h2 < 0.5 ? B.brown_mushroom : B.red_mushroom;
        else if (h > 0.9995 && (bio.id === BIO.PLAINS || bio.id === BIO.FOREST || bio.id === BIO.TAIGA)) b[above] = B.pumpkin;
        else if (h > 0.996 && bio.id === BIO.JUNGLE) b[above] = B.melon;
        else if (bio.id === BIO.CHERRY_GROVE && h > 0.7 && this.nPatch.n2(wx / 9, wz / 9) > -0.1) b[above] = B.pink_petals;
        else if ((bio.id === BIO.TAIGA || bio.id === BIO.SNOWY_TAIGA) && h > 0.986) b[above] = B.sweet_berry_bush | ((h2 < 0.5 ? 3 : 2) << 12);
      } else if (id === B.mycelium && b[above] === 0 && h < 0.012) b[above] = h2 < 0.5 ? B.brown_mushroom : B.red_mushroom;
      else if (id === B.podzol && b[above] === 0 && h < 0.1) b[above] = B.fern;
      else if ((id === B.sand || id === B.red_sand) && b[above] === 0) {
        if (bio.id === BIO.DESERT || bio.id === BIO.BADLANDS) {
          if (h < 0.004 && x > 0 && x < 15 && z > 0 && z < 15 && b[above + 1] === 0 && b[above - 1] === 0 && b[above + 16] === 0 && b[above - 16] === 0) {
            const hh = 1 + Math.floor(h2 * 3);
            for (let i = 0; i < hh; i++) if (y + 1 + i < CH) b[p + 256 * (i + 1)] = B.cactus;
          } else if (h > 0.992) b[above] = B.dead_bush;
        }
      } else if (id === B.terracotta || id === B.orange_terracotta) { if (b[above] === 0 && h < 0.004) b[above] = B.dead_bush; }
      // sugar cane next to water at sea level
      if ((id === B.grass_block || id === B.sand || id === B.dirt) && y === SEA && b[above] === 0 && h2 < 0.14 && x > 0 && x < 15 && z > 0 && z < 15) {
        if (b[p + 1] === B.water || b[p - 1] === B.water || b[p + 16] === B.water || b[p - 16] === B.water) {
          const hh = 1 + Math.floor(h * 97 % 3);
          for (let i = 0; i < hh; i++) b[p + 256 * (i + 1)] = B.sugar_cane;
        }
      }
      // water plants
      if (id === B.water) {
        // the scan above starts just over the seabed, so first find the real water surface
        let ys = y; while (ys + 1 < CH && (b[((ys + 1) << 8) | (z << 4) | x] & 4095) === B.water) ys++;
        let yy = ys; while (yy > 1 && (b[(yy << 8) | (z << 4) | x] & 4095) === B.water) yy--;
        const depth = ys - yy;
        const sp = (ys << 8) | (z << 4) | x;
        const floor = (yy << 8) | (z << 4) | x, fid = b[floor] & 4095;
        // warm-ocean coral reefs: patches of coral blocks topped with coral and glowing sea pickles
        if (bio.id === BIO.WARM_OCEAN && depth >= 3 && depth <= 18 && fid !== 0 && this.nReef.n2(wx / 22, wz / 22) > 0.02) {
          const kind = Math.floor((this.nReef.n2(wx / 7 + 40, wz / 7 - 17) * 0.5 + 0.5) * 5) % 5;
          const hh = Math.min(h < 0.3 ? 0 : 1 + Math.floor(h2 * 3), depth - 2);
          for (let i = 1; i <= hh; i++) b[floor + 256 * i] = B[CORALS[kind] + '_coral_block'];
          const top2 = floor + 256 * (hh + 1);
          if (h2 < 0.55) b[top2] = B[CORALS[(kind + (h > 0.75 ? 2 : 0)) % 5] + '_coral'];
          else if (h2 > 0.9) b[top2] = B.sea_pickle;
          continue;
        }
        if (bio.id === BIO.SWAMP && depth <= 2 && h < 0.06 && ys + 1 < CH && b[sp + 256] === 0) b[sp + 256] = B.lily_pad;
        else if ((fid === B.sand || fid === B.gravel || fid === B.dirt || fid === B.clay) && depth > 2) {
          if (bio.ocean && depth > 5 && h < 0.07) { const len = Math.min(depth - 2, 2 + Math.floor(h2 * (depth - 2))); for (let i = 1; i <= len; i++) b[floor + 256 * i] = B.kelp; }
          else if (h < (bio.ocean ? 0.28 : 0.1)) b[floor + 256] = B.seagrass;
        }
      }
    }
  }
}
