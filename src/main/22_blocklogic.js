// ============================================================================
//  Block behaviour: supports, fluids, gravity, random ticks, explosions, portals
// ============================================================================
const SOIL = new Set([B.grass_block, B.dirt, B.coarse_dirt, B.podzol, B.farmland, B.mycelium, B.moss_block, B.rooted_dirt, B.mud]);
const FLAMMABLE = new Uint8Array(MAXB);
for (const b of BLOCKS) if (b.flam) FLAMMABLE[b.id] = 1;
FLAMMABLE[B.tall_grass] = FLAMMABLE[B.fern] = FLAMMABLE[B.vine] = FLAMMABLE[B.bookshelf] = FLAMMABLE[B.tnt] = FLAMMABLE[B.hay_block] = 1;
FLAMMABLE[B.pink_petals] = FLAMMABLE[B.sweet_berry_bush] = FLAMMABLE[B.moss_carpet] = FLAMMABLE[B.moss_block] = 1;
for (const n of FLOWERS.concat(FLOWERS2)) FLAMMABLE[B[n]] = 1;
const LOGS = new Set([...WOODS_ALL.map(w => B[w + '_log']), ...WOODS_ALL.map(w => B['stripped_' + w + '_log']), B.crimson_stem, B.warped_stem, B.stripped_crimson_stem, B.stripped_warped_stem]);
// axe right-click: log -> stripped log (keeps the axis in the meta bits)
const STRIP = Object.create(null);
for (const w of WOODS_ALL) STRIP[B[w + '_log']] = B['stripped_' + w + '_log'];
STRIP[B.crimson_stem] = B.stripped_crimson_stem; STRIP[B.warped_stem] = B.stripped_warped_stem;
function blastRes(id) {
  const b = BLOCKS[id];
  if (id === B.obsidian || id === B.crying_obsidian || id === B.ancient_debris || id === B.netherite_block) return 1200;
  if (id === B.bedrock || b.hard < 0) return 1e7;
  if (FLUID[id]) return 100;
  return b.hard * 3;
}
function isSolidTop(id, v) {
  if (OPAQUE[id]) return true;
  const s = SHAPE[id];
  if (s === R_SLAB) return ((v >> 12) & 3) !== 0;
  if (s === R_STAIRS) return ((v >> 12) & 4) !== 0;
  if (s === R_FENCE || s === R_SHORT || s === R_CHEST) return true;
  return false;
}
function breakBlock(w, x, y, z, dropItems, player) {
  const v = w.getBlock(x, y, z), id = v & 4095;
  if (!id) return;
  const g = w.game;
  if (dropItems) for (const d of blockDrops(v, player ? player.heldId() : 0, player)) g.dropItem(w, x + 0.5, y + 0.4, z + 0.5, d);
  g.particles.blockBreak(x, y, z, v);
  // two-part blocks
  const s = SHAPE[id], meta = v >> 12;
  w.setBlock(x, y, z, 0, 1);
  if (s === R_DOOR) { const oy = (meta & 8) ? y - 1 : y + 1; if ((w.getBlock(x, oy, z) & 4095) === id) w.setBlock(x, oy, z, 0, 1); }
  if (s === R_BED) { const f = meta & 3, head = meta & 4; const ox = x + (head ? -FACING_DX[f] : FACING_DX[f]), oz = z + (head ? -FACING_DZ[f] : FACING_DZ[f]); if ((w.getBlock(ox, y, oz) & 4095) === id) w.setBlock(ox, y, oz, 0, 1); }
}
function blockDrops(v, heldId, player) {
  const id = v & 4095, meta = v >> 12, b = BLOCKS[id];
  if (!b || b.hard < 0 || b.noItemDrop) return [];
  if (player && player.creative) return [];
  const held = ITEMS[heldId], tool = held && held.tool;
  if (b.req) { if (!tool || tool.type !== b.tool || (b.tier !== undefined && tool.tier < b.tier)) return []; }
  const shears = tool && tool.type === 'shears';
  const r = Math.random;
  const one = (name, n) => ({ id: typeof name === 'number' ? name : I[name], n: n || 1, d: 0 });
  if (LEAVES[id]) {
    if (shears) return [one(id)];
    const out = [];
    const sap = BLOCKS[id].name.replace('_leaves', '_sapling');
    if (r() < (id === B.jungle_leaves ? 0.025 : 0.05) && I[sap] !== undefined) out.push(one(sap));
    if ((id === B.oak_leaves || id === B.dark_oak_leaves) && r() < 0.008) out.push(one('apple'));
    if (r() < 0.02) out.push(one('stick', 1 + (r() < 0.5 ? 1 : 0)));
    return out;
  }
  switch (id) {
    case B.tall_grass: case B.fern: return shears ? [one(id)] : (r() < 0.125 ? [one('wheat_seeds')] : []);
    case B.gravel: return [r() < 0.1 ? one('flint') : one(id)];
    case B.wheat: return meta >= 7 ? [one('wheat'), one('wheat_seeds', 1 + Math.floor(r() * 3))] : [one('wheat_seeds')];
    case B.carrots: return [one('carrot', meta >= 7 ? 2 + Math.floor(r() * 3) : 1)];
    case B.potatoes: return [one('potato', meta >= 7 ? 2 + Math.floor(r() * 3) : 1)];
    case B.nether_wart: return [one('nether_wart_item', meta >= 3 ? 2 + Math.floor(r() * 3) : 1)];
    case B.vine: return shears ? [one(id)] : [];
    case B.cobweb: return shears ? [one(id)] : (tool && tool.type === 'sword' ? [one('string')] : []);
    case B.snow_layer: return tool && tool.type === 'shovel' ? [one('snowball', (meta & 7) + 1)] : [];
    case B.snow: return tool && tool.type === 'shovel' ? [one('snowball', 4)] : [];
    case B.dead_bush: return shears ? [one(id)] : (r() < 0.5 ? [one('stick', 1 + Math.floor(r() * 2))] : []);
    case B.oak_door: case B.iron_door: return (meta & 8) ? [] : [one(id)];
    case B.red_bed: return (meta & 4) ? [one(id)] : [];
    case B.seagrass: return shears ? [one(id)] : [];
    case B.beetroots: return meta >= 7 ? [one('beetroot'), one('beetroot_seeds', 1 + Math.floor(r() * 3))] : [one('beetroot_seeds')];
    case B.sweet_berry_bush: return meta >= 2 ? [one('sweet_berries', meta >= 3 ? 2 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2))] : [];
    case B.gilded_blackstone: return r() < 0.1 ? [one('gold_nugget', 2 + Math.floor(r() * 4))] : [one(id)];
    case B.glow_lichen: case B.nether_sprouts: return shears ? [one(id)] : [];
    case B.weeping_vines: case B.twisting_vines: return shears || r() < 0.33 ? [one(id)] : [];
  }
  if (b.drop === null) return [];
  if (b.drop === undefined) return [one(id)];
  if (typeof b.drop === 'string') return [one(b.drop)];
  if (Array.isArray(b.drop)) return [one(b.drop[0], b.drop[1] + Math.floor(r() * (b.drop[2] - b.drop[1] + 1)))].filter(d => d.n > 0);
  return [];
}
function blockXP(id) { const b = BLOCKS[id]; if (!b.xp) return 0; return b.xp[0] + Math.floor(Math.random() * (b.xp[1] - b.xp[0] + 1)); }

// ---------------------------------------------------------------- support
function supported(w, x, y, z, v) {
  const id = v & 4095, meta = v >> 12, s = SHAPE[id];
  const below = w.getBlock(x, y - 1, z), bid = below & 4095;
  if (id === B.cactus) {
    if (bid !== B.cactus && bid !== B.sand && bid !== B.red_sand) return false;
    for (let f = 0; f < 4; f++) { const n = w.getId(x + FACING_DX[f], y, z + FACING_DZ[f]); if (SOLID[n] && n !== B.cactus) return false; }
    return true;
  }
  if (id === B.sugar_cane) {
    if (bid === B.sugar_cane) return true;
    if (!(SOIL.has(bid) || bid === B.sand || bid === B.red_sand)) return false;
    for (let f = 0; f < 4; f++) { const n = w.getId(x + FACING_DX[f], y - 1, z + FACING_DZ[f]); if (n === B.water || n === B.ice || WLOG[n]) return true; }
    return false;
  }
  if (s === R_CROP) return id === B.nether_wart ? bid === B.soul_sand : bid === B.farmland;
  if (id === B.lily_pad) return bid === B.water || bid === B.ice;
  if (id === B.dead_bush) return bid === B.sand || bid === B.red_sand || SOIL.has(bid) || (BLOCKS[bid].name.endsWith('terracotta'));
  if (id === B.brown_mushroom || id === B.red_mushroom) return OPAQUE[bid] === 1;
  if (id === B.crimson_fungus || id === B.warped_fungus || id === B.crimson_roots || id === B.warped_roots || id === B.nether_sprouts) return OPAQUE[bid] === 1;
  if (id === B.seagrass || id === B.kelp) return OPAQUE[bid] === 1 || bid === B.kelp || bid === B.sand;
  if (WLOG[id]) return OPAQUE[bid] === 1;
  if (id === B.weeping_vines) { const a = w.getId(x, y + 1, z); return a === id || SOLID[a] === 1; }
  if (id === B.twisting_vines) return bid === id || SOLID[bid] === 1;
  if (s === R_CROSS && PLANT[id]) return SOIL.has(bid);
  if (s === R_TORCH) {
    if (meta === 0) { return isSolidTop(bid, below) || SHAPE[bid] === R_FENCE; }
    const f = (meta - 1) & 3; const wv = w.getBlock(x - FACING_DX[f], y, z - FACING_DZ[f]); return OPAQUE[wv & 4095] === 1;
  }
  if (s === R_LADDER) { const f = meta & 3; return OPAQUE[w.getId(x - FACING_DX[f], y, z - FACING_DZ[f])] === 1; }
  if (s === R_VINE) {
    if (w.getId(x, y + 1, z) === id || OPAQUE[w.getId(x, y + 1, z)]) return true;
    for (let f = 0; f < 4; f++) if ((meta & VINE_META_TOWARD[f]) && OPAQUE[w.getId(x + FACING_DX[f], y, z + FACING_DZ[f])]) return true;
    return false;
  }
  if (s === R_RAIL || s === R_CARPET || s === R_PLATE || s === R_FLAT || id === B.snow_layer) return isSolidTop(bid, below) || (id === B.snow_layer && LEAVES[bid]);
  if (s === R_DOOR) { if (meta & 8) return bid === id; return isSolidTop(bid, below) && (w.getId(x, y + 1, z) === id); }
  if (s === R_LANTERN) return (meta & 1) ? (SOLID[w.getId(x, y + 1, z)] === 1) : (SOLID[bid] === 1);
  if (s === R_FIRE) { if (isSolidTop(bid, below) || bid === B.netherrack || bid === B.soul_sand) return true; for (let f = 0; f < 6; f++) if (FLAMMABLE[w.getId(x + FACE_DX[f], y + FACE_DY[f], z + FACE_DZ[f])]) return true; return false; }
  if (s === R_BED) { const f = meta & 3, head = meta & 4; const ox = x + (head ? -FACING_DX[f] : FACING_DX[f]), oz = z + (head ? -FACING_DZ[f] : FACING_DZ[f]); return w.getId(ox, y, oz) === id; }
  return true;
}
function neighborChanged(w, x, y, z) {
  if (y < 0 || y >= CH) return;
  const v = w.getBlock(x, y, z), id = v & 4095;
  if (!id) return;
  if (FLUID[id]) { w.schedule(x, y, z, FLUID[id] === 2 ? (w.dim === 'nether' ? 10 : 30) : 5); return; }
  if (WLOG[id]) { const a = w.getId(x, y + 1, z); if (a === 0) w.schedule(x, y, z, 5); }
  if (BLOCKS[id].sets && touchesWater(w, x, y, z)) { w.setBlock(x, y, z, B[BLOCKS[id].sets], 1); return; }
  if (id === B.sponge && touchesWater(w, x, y, z)) { spongeAbsorb(w, x, y, z); return; }
  if (BLOCKS[id].grav) { w.schedule(x, y, z, 2); return; }
  if (id === B.nether_portal) { if (!portalValid(w, x, y, z, v)) w.setBlock(x, y, z, 0, 1); return; }
  if (id === B.farmland) { const a = w.getId(x, y + 1, z); if (OPAQUE[a]) w.setBlock(x, y, z, B.dirt, 1); }
  if (id === B.tnt) return;
  const s = SHAPE[id];
  if (PLANT[id] || s === R_TORCH || s === R_LADDER || s === R_VINE || s === R_RAIL || s === R_CARPET || s === R_PLATE || s === R_FLAT || s === R_DOOR || s === R_LANTERN || s === R_FIRE || s === R_BED || id === B.snow_layer || id === B.lily_pad) {
    if (!supported(w, x, y, z, v)) {
      if (s === R_FIRE) w.setBlock(x, y, z, 0, 1);
      else breakBlock(w, x, y, z, true, null);
    }
  }
}
function touchesWater(w, x, y, z) {
  for (let f = 0; f < 6; f++) { const n = w.getId(x + FACE_DX[f], y + FACE_DY[f], z + FACE_DZ[f]); if (n === B.water || WLOG[n]) return true; }
  return false;
}
// sponge: soaks up to 65 water blocks within 6 blocks (flood fill through water), then turns wet
function spongeAbsorb(w, x, y, z) {
  const q = [[x, y, z, 0]], seen = new Set([x + ',' + y + ',' + z]);
  let n = 0;
  while (q.length && n < 65) {
    const [cx, cy, cz, d] = q.shift();
    for (let f = 0; f < 6; f++) {
      const nx = cx + FACE_DX[f], ny = cy + FACE_DY[f], nz = cz + FACE_DZ[f], k = nx + ',' + ny + ',' + nz;
      if (seen.has(k)) continue; seen.add(k);
      const id = w.getId(nx, ny, nz);
      if (id !== B.water && !WLOG[id]) continue;
      if (WLOG[id]) breakBlock(w, nx, ny, nz, true, null); else w.setBlock(nx, ny, nz, 0, 1);
      n++;
      if (d < 6) q.push([nx, ny, nz, d + 1]);
      if (n >= 65) break;
    }
  }
  if (n) { w.setBlock(x, y, z, B.wet_sponge, 1); w.game.particles.burst(x + 0.5, y + 0.5, z + 0.5, 'p_splash', 10, [0.6, 0.7, 1]); w.game.audio.play('bucket_fill', { x, y, z }); }
}
// scheduled tick dispatcher
function blockTick(w, x, y, z) {
  const v = w.getBlock(x, y, z), id = v & 4095;
  if (FLUID[id]) fluidTick(w, x, y, z, v);
  else if (WLOG[id]) { const a = w.getId(x, y + 1, z); if (a === 0 || REPL[a] && !FLUID[a]) { /* waterlogged plants keep water */ } }
  else if (BLOCKS[id] && BLOCKS[id].grav) gravityCheck(w, x, y, z, v);
  else if (id === B.fire) fireTick(w, x, y, z, v);
}
function gravityCheck(w, x, y, z, v) {
  if (y <= 0) return;
  const b = w.getId(x, y - 1, z);
  if (b === 0 || FLUID[b] || (REPL[b] && !SOLID[b]) || b === B.fire) {
    w.setBlock(x, y, z, 0, 1);
    w.game.spawnFallingBlock(x + 0.5, y, z + 0.5, v);
  }
}
// ---------------------------------------------------------------- fluids
function fluidOf(v) { const id = v & 4095; return WLOG[id] ? 1 : FLUID[id]; }
function canFlowInto(w, v, fl) {
  const id = v & 4095;
  if (id === 0) return true;
  if (FLUID[id]) return false;
  if (WLOG[id]) return false;
  if (id === B.nether_portal) return false;
  if (REPL[id] || (PLANT[id] && !SOLID[id]) || SHAPE[id] === R_TORCH || SHAPE[id] === R_RAIL || SHAPE[id] === R_CARPET || id === B.fire || id === B.cobweb) return !(fl === 2 && id === B.fire);
  return false;
}
function fluidTick(w, x, y, z, v) {
  const id = v & 4095, fl = FLUID[id], lava = fl === 2;
  const nether = w.dim === 'nether';
  const drop = lava && !nether ? 2 : 1;
  const rate = lava ? (nether ? 10 : 30) : 5;
  let meta = v >> 12, level = meta & 7, falling = (meta & 8) !== 0;
  // lava + water interaction
  if (lava) {
    for (let f = 0; f < 6; f++) {
      if (f === 3) continue;
      const n = w.getBlock(x + FACE_DX[f], y + FACE_DY[f], z + FACE_DZ[f]);
      if (fluidOf(n) === 1) {
        w.setBlock(x, y, z, level === 0 && !falling ? B.obsidian : B.cobblestone, 1);
        w.game.fx('fizz', x + 0.5, y + 0.5, z + 0.5);
        return;
      }
    }
  }
  if (level !== 0 || falling) {
    let nl = 99, sources = 0;
    const above = w.getBlock(x, y + 1, z);
    const aboveSame = fluidOf(above) === fl;
    for (let f = 0; f < 4; f++) {
      const n = w.getBlock(x + FACING_DX[f], y, z + FACING_DZ[f]);
      if (fluidOf(n) !== fl) continue;
      const nm = WLOG[n & 4095] ? 0 : n >> 12, nlv = nm & 7, nf = (nm & 8) !== 0;
      if (nlv === 0 && !nf) sources++;
      const eff = nf ? 0 : nlv;
      if (eff + drop < nl) nl = eff + drop;
    }
    let newFalling = false;
    if (aboveSame) { nl = 0; newFalling = true; }
    if (!lava && sources >= 2) {
      const b = w.getBlock(x, y - 1, z), bid = b & 4095;
      if (OPAQUE[bid] || SOLID[bid] || (bid === B.water && (b >> 12) === 0)) { nl = 0; newFalling = false; }
    }
    if (nl > 7) { w.setBlock(x, y, z, 0, 1); return; }
    const nm = (nl & 7) | (newFalling ? 8 : 0);
    if (nm !== meta) { w.setBlock(x, y, z, id | (nm << 12), 1); meta = nm; level = nm & 7; falling = newFalling; }
  }
  // flow down
  if (y > 0) {
    const bv = w.getBlock(x, y - 1, z);
    if (lava && fluidOf(bv) === 1) { w.setBlock(x, y - 1, z, B.stone, 1); w.game.fx('fizz', x + 0.5, y - 0.5, z + 0.5); return; }
    if (canFlowInto(w, bv, fl)) {
      if (bv & 4095) breakBlock(w, x, y - 1, z, true, null);
      w.setBlock(x, y - 1, z, id | (8 << 12), 1);
      w.schedule(x, y - 1, z, rate);
      return;
    }
    if (fluidOf(bv) === fl) { if (!falling && level === 0) { /* source over fluid: also spread */ } else return; }
  }
  // spread horizontally
  const next = (falling ? 0 : level) + drop;
  if (next > 7) return;
  const range = lava && !nether ? 2 : 4;
  const dirs = flowDirs(w, x, y, z, fl, range);
  for (const f of dirs) {
    const nx = x + FACING_DX[f], nz = z + FACING_DZ[f];
    const nv = w.getBlock(nx, y, nz);
    if (!w.isLoaded(nx, nz)) continue;
    if (lava && fluidOf(nv) === 1) { w.setBlock(nx, y, nz, B.cobblestone, 1); continue; }
    if (canFlowInto(w, nv, fl)) {
      if (nv & 4095) breakBlock(w, nx, y, nz, true, null);
      w.setBlock(nx, y, nz, id | (next << 12), 1);
      w.schedule(nx, y, nz, rate);
    } else if ((nv & 4095) === id) {
      const nm = nv >> 12;
      if (!(nm & 8) && (nm & 7) > next) { w.setBlock(nx, y, nz, id | (next << 12), 1); w.schedule(nx, y, nz, rate); }
    }
  }
}
function flowDirs(w, x, y, z, fl, range) {
  let best = 1000; const res = [];
  for (let f = 0; f < 4; f++) {
    const nx = x + FACING_DX[f], nz = z + FACING_DZ[f];
    const nv = w.getBlock(nx, y, nz);
    if (!canFlowInto(w, nv, fl) && !((nv & 4095) === (fl === 2 ? B.lava : B.water) && ((nv >> 12) & 7) !== 0)) continue;
    const d = holeDist(w, nx, y, nz, fl, range, (f + 2) & 3, 1);
    if (d < best) { best = d; res.length = 0; res.push(f); } else if (d === best) res.push(f);
  }
  return res;
}
function holeDist(w, x, y, z, fl, range, from, depth) {
  const bv = w.getBlock(x, y - 1, z);
  if (canFlowInto(w, bv, fl) || fluidOf(bv) === fl) return 0;
  if (depth >= range) return 1000;
  let best = 1000;
  for (let f = 0; f < 4; f++) {
    if (f === from) continue;
    const nx = x + FACING_DX[f], nz = z + FACING_DZ[f];
    const nv = w.getBlock(nx, y, nz);
    if (!canFlowInto(w, nv, fl) && fluidOf(nv) !== fl) continue;
    const d = holeDist(w, nx, y, nz, fl, range, (f + 2) & 3, depth + 1) + 1;
    if (d < best) best = d;
  }
  return best;
}
// ---------------------------------------------------------------- fire
function fireTick(w, x, y, z, v) {
  const age = v >> 12;
  if (!supported(w, x, y, z, v)) { w.setBlock(x, y, z, 0, 1); return; }
  const below = w.getId(x, y - 1, z);
  const eternal = below === B.netherrack || below === B.magma_block || below === B.soul_sand;
  if (w.isRainingAt(x, y, z) && Math.random() < 0.4 && !eternal) { w.setBlock(x, y, z, 0, 1); return; }
  if (!eternal && age >= 15) { w.setBlock(x, y, z, 0, 1); return; }
  if (!eternal) w.setBlock(x, y, z, B.fire | (Math.min(15, age + 1 + Math.floor(Math.random() * 3)) << 12), 0);
  // burn / spread
  if (w.game.gameRules.fireSpread !== false) {
    for (let f = 0; f < 6; f++) {
      const nx = x + FACE_DX[f], ny = y + FACE_DY[f], nz = z + FACE_DZ[f];
      const n = w.getId(nx, ny, nz);
      if (FLAMMABLE[n] && Math.random() < 0.12) {
        if (n === B.tnt) { w.setBlock(nx, ny, nz, 0, 1); w.game.primeTNT(nx + 0.5, ny, nz + 0.5, 20); }
        else w.setBlock(nx, ny, nz, Math.random() < 0.5 ? B.fire : 0, 1);
      }
    }
    if (Math.random() < 0.3) {
      const nx = x + randInt(-1, 1), ny = y + randInt(-1, 2), nz = z + randInt(-1, 1);
      if (w.getId(nx, ny, nz) === 0) { let adj = false; for (let f = 0; f < 6; f++) if (FLAMMABLE[w.getId(nx + FACE_DX[f], ny + FACE_DY[f], nz + FACE_DZ[f])]) adj = true; if (adj) { w.setBlock(nx, ny, nz, B.fire, 1); w.schedule(nx, ny, nz, 30 + randInt(0, 10)); } }
    }
  }
  w.schedule(x, y, z, 30 + randInt(0, 10));
}
// ---------------------------------------------------------------- random ticks
function randomTick(w, x, y, z, v) {
  const id = v & 4095, meta = v >> 12;
  switch (id) {
    case B.grass_block: case B.mycelium: {
      const a = w.getBlock(x, y + 1, z), aid = a & 4095;
      if ((OPAQUE[aid] || OPACITY[aid] >= 15) && aid !== B.snow_layer) { w.setBlock(x, y, z, B.dirt, 1); return; }
      if (w.lightLevel(x, y + 1, z) >= 9) {
        for (let k = 0; k < 4; k++) {
          const nx = x + randInt(-1, 1), ny = y + randInt(-3, 1), nz = z + randInt(-1, 1);
          if (w.getId(nx, ny, nz) === B.dirt) { const na = w.getId(nx, ny + 1, nz); if (!OPAQUE[na] && OPACITY[na] < 15 && w.lightLevel(nx, ny + 1, nz) >= 4) w.setBlock(nx, ny, nz, id, 1); }
        }
      }
      return;
    }
    case B.farmland: {
      let wet = false;
      for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dy = 0; dy <= 1; dy++) { const n = w.getId(x + dx, y + dy, z + dz); if (n === B.water || WLOG[n]) { wet = true; break; } }
      if (wet || w.isRainingAt(x, y + 1, z)) { if (meta !== 7) w.setBlock(x, y, z, B.farmland | (7 << 12), 0); }
      else if (meta > 0) w.setBlock(x, y, z, B.farmland | ((meta - 1) << 12), 0);
      else if (SHAPE[w.getId(x, y + 1, z)] !== R_CROP) w.setBlock(x, y, z, B.dirt, 1);
      return;
    }
    case B.wheat: case B.carrots: case B.potatoes: case B.beetroots: {
      if (meta >= 7) return;
      if (w.lightLevel(x, y + 1, z) < 9) return;
      const soil = w.getBlock(x, y - 1, z);
      const chance = ((soil >> 12) > 0) ? 0.34 : 0.14;
      if (Math.random() < chance) w.setBlock(x, y, z, id | ((meta + 1) << 12), 0);
      return;
    }
    case B.sweet_berry_bush: if (meta < 3 && w.lightLevel(x, y + 1, z) >= 9 && Math.random() < 0.2) w.setBlock(x, y, z, id | ((meta + 1) << 12), 0); return;
    case B.nether_wart: if (meta < 3 && Math.random() < 0.1) w.setBlock(x, y, z, id | ((meta + 1) << 12), 0); return;
    case B.sugar_cane: case B.cactus: {
      if (w.getId(x, y + 1, z) !== 0) return;
      let h = 1; while (w.getId(x, y - h, z) === id) h++;
      if (h >= 3) return;
      if (meta >= 15) { w.setBlock(x, y, z, id, 0); if (y + 1 < CH) { w.setBlock(x, y + 1, z, id, 1); if (!supported(w, x, y + 1, z, id)) breakBlock(w, x, y + 1, z, true, null); } }
      else w.setBlock(x, y, z, id | ((meta + 1) << 12), 0);
      return;
    }
    case B.ice: if (w.blockLightAt(x, y, z) > 11) w.setBlock(x, y, z, B.water, 1); return;
    case B.snow_layer: if (w.blockLightAt(x, y, z) > 11) w.setBlock(x, y, z, 0, 1); return;
    case B.lava: {
      if (Math.random() < 0.3 && w.game.gameRules.fireSpread !== false) {
        const nx = x + randInt(-1, 1), ny = y + 1 + randInt(0, 1), nz = z + randInt(-1, 1);
        if (w.getId(nx, ny, nz) === 0) { for (let f = 0; f < 6; f++) if (FLAMMABLE[w.getId(nx + FACE_DX[f], ny + FACE_DY[f], nz + FACE_DZ[f])]) { w.setBlock(nx, ny, nz, B.fire, 1); w.schedule(nx, ny, nz, 30); break; } }
      }
      return;
    }
    case B.fire: w.schedule(x, y, z, 1); return;
  }
  if (LEAVES[id]) { if (!(meta & 8) && !leafSupported(w, x, y, z)) breakBlock(w, x, y, z, true, null); return; }
  // copper slowly weathers towards green (scrape it back with an axe)
  const ox = BLOCKS[id].oxidize;
  if (ox) { if (Math.random() < 0.03) w.setBlock(x, y, z, B[ox], 0); return; }
  if (BLOCKS[id].name.endsWith('_sapling')) {
    if (w.lightLevel(x, y + 1, z) < 9 || Math.random() > 0.14) return;
    if (!(meta & 1)) { w.setBlock(x, y, z, id | (1 << 12), 0); return; }
    growSapling(w, x, y, z, id);
    return;
  }
}
function leafSupported(w, x, y, z) {
  const seen = new Set(); const q = [[x, y, z, 0]]; seen.add(x + ',' + y + ',' + z);
  while (q.length) {
    const [cx, cy, cz, d] = q.shift();
    for (let f = 0; f < 6; f++) {
      const nx = cx + FACE_DX[f], ny = cy + FACE_DY[f], nz = cz + FACE_DZ[f];
      const k = nx + ',' + ny + ',' + nz; if (seen.has(k)) continue; seen.add(k);
      const n = w.getId(nx, ny, nz);
      if (LOGS.has(n)) return true;
      if (!w.isLoaded(nx, nz)) return true;
      if (LEAVES[n] && d < 5) q.push([nx, ny, nz, d + 1]);
    }
  }
  return false;
}
function growSapling(w, x, y, z, id) {
  const type = { [B.oak_sapling]: Math.random() < 0.1 ? 'big_oak' : 'oak', [B.birch_sapling]: 'birch', [B.spruce_sapling]: Math.random() < 0.3 ? 'pine' : 'spruce', [B.jungle_sapling]: 'jungle', [B.acacia_sapling]: 'acacia', [B.dark_oak_sapling]: 'dark_oak', [B.cherry_sapling]: 'cherry' }[id];
  if (!type) return false;
  for (let i = 1; i < 6; i++) { const a = w.getId(x, y + i, z); if (a !== 0 && !LEAVES[a] && !REPL[a]) return false; }
  w.setBlock(x, y, z, 0, 0);
  placeTree(new WorldCtx(w), type, new RNG((Math.random() * 1e9) | 0), x, y, z);
  if (w.getId(x, y, z) === 0) w.setBlock(x, y, z, id, 0);
  return true;
}
function boneMeal(w, x, y, z, player) {
  const v = w.getBlock(x, y, z), id = v & 4095, meta = v >> 12;
  const g = w.game;
  if (id === B.wheat || id === B.carrots || id === B.potatoes || id === B.beetroots) { if (meta >= 7) return false; w.setBlock(x, y, z, id | (Math.min(7, meta + 2 + randInt(0, 3)) << 12), 0); g.particles.happy(x, y, z); return true; }
  if (id === B.sweet_berry_bush) { if (meta >= 3) return false; w.setBlock(x, y, z, id | ((meta + 1) << 12), 0); g.particles.happy(x, y, z); return true; }
  if (id === B.nether_wart) return false;
  if (BLOCKS[id].name.endsWith('_sapling')) { g.particles.happy(x, y, z); if (Math.random() < 0.45) growSapling(w, x, y, z, id); return true; }
  if (id === B.grass_block) {
    for (let k = 0; k < 40; k++) {
      const nx = x + randInt(-3, 3), nz = z + randInt(-3, 3), ny = y + randInt(-1, 1);
      if (w.getId(nx, ny, nz) === B.grass_block && w.getId(nx, ny + 1, nz) === 0) {
        const r = Math.random();
        w.setBlock(nx, ny + 1, nz, r < 0.8 ? B.tall_grass : B[FLOWERS[randInt(0, 3)]], 1);
      }
    }
    g.particles.happy(x, y + 1, z); return true;
  }
  if (id === B.sugar_cane || id === B.cactus) return false;
  return false;
}
// ---------------------------------------------------------------- explosions
function explode(w, x, y, z, power, fire, source) {
  const g = w.game;
  const affected = new Map();
  const griefing = g.gameRules.mobGriefing !== false || !(source && source.isMob);
  if (griefing && !(source && source.inWater)) {
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) {
      if (!(i === 0 || i === 15 || j === 0 || j === 15 || k === 0 || k === 15)) continue;
      let dx = i / 15 * 2 - 1, dy = j / 15 * 2 - 1, dz = k / 15 * 2 - 1;
      const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
      let inten = power * (0.7 + Math.random() * 0.6);
      let px = x, py = y, pz = z;
      while (inten > 0) {
        const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
        const v = w.getBlock(bx, by, bz), id = v & 4095;
        if (id) { inten -= (blastRes(id) + 0.3) * 0.3; if (inten > 0 && blastRes(id) < 1e6) affected.set(bx + ',' + by + ',' + bz, [bx, by, bz]); }
        px += dx * 0.3; py += dy * 0.3; pz += dz * 0.3; inten -= 0.225;
      }
    }
  }
  for (const [bx, by, bz] of affected.values()) {
    const v = w.getBlock(bx, by, bz), id = v & 4095;
    if (!id) continue;
    if (id === B.tnt) { w.setBlock(bx, by, bz, 0, 1); g.primeTNT(bx + 0.5, by, bz + 0.5, 10 + randInt(0, 20)); continue; }
    if (FLUID[id]) continue;
    const be = w.getBE(bx, by, bz);
    if (be) g.onBERemoved(be, bx, by, bz);
    if (Math.random() < 1 / power && !(g.player && g.player.creative && false)) for (const d of blockDrops(v, 0, null)) g.dropItem(w, bx + 0.5, by + 0.5, bz + 0.5, d);
    w.setBlock(bx, by, bz, 0, 1 | 8);
  }
  if (fire) for (const [bx, by, bz] of affected.values()) if (Math.random() < 0.33 && w.getId(bx, by, bz) === 0 && OPAQUE[w.getId(bx, by - 1, bz)]) w.setBlock(bx, by, bz, B.fire, 1);
  // entities
  const R2 = power * 2;
  for (const e of w.entitiesNear(x, y, z, R2 + 2)) {
    if (e === source && e.type === 'tnt') continue;
    const ex = e.x, ey = e.y + e.h / 2, ez = e.z;
    const dist = Math.hypot(ex - x, ey - y, ez - z) / R2;
    if (dist > 1) continue;
    const exposure = explosionExposure(w, x, y, z, e);
    const impact = (1 - dist) * exposure;
    const dmg = Math.floor((impact * impact + impact) / 2 * 7 * R2 + 1);
    const dl = Math.hypot(ex - x, ey - y, ez - z) || 1;
    if (e.hurt) e.hurt(dmg, { type: 'explosion', source });
    const kb = impact * (e.isPlayer ? 1.0 : 1.2);
    e.vx += (ex - x) / dl * kb * 1.6; e.vy += (ey - y) / dl * kb * 1.2 + 0.1; e.vz += (ez - z) / dl * kb * 1.6;
    if (e.type === 'item' && Math.random() < 0.5) e.removed = true;
  }
  g.fx('explosion', x, y, z, power);
}
function explosionExposure(w, x, y, z, e) {
  let hit = 0, tot = 0;
  const hw = e.w / 2;
  for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) for (let k = 0; k <= 2; k++) {
    const px = e.x - hw + e.w * i / 2, py = e.y + e.h * j / 2, pz = e.z - hw + e.w * k / 2;
    tot++;
    if (!rayBlocked(w, x, y, z, px, py, pz)) hit++;
  }
  return hit / tot;
}
function rayBlocked(w, x0, y0, z0, x1, y1, z1) {
  const d = Math.hypot(x1 - x0, y1 - y0, z1 - z0); const n = Math.ceil(d * 3);
  for (let i = 1; i < n; i++) { const t = i / n; const id = w.getId(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t), Math.floor(z0 + (z1 - z0) * t)); if (OPAQUE[id]) return true; }
  return false;
}
// ---------------------------------------------------------------- nether portals
function portalValid(w, x, y, z, v) {
  const ax = (v >> 12) & 1;
  const dx = ax === 0 ? 1 : 0, dz = ax === 0 ? 0 : 1;
  const ok = (id) => id === B.nether_portal || id === B.obsidian;
  return ok(w.getId(x, y + 1, z)) && ok(w.getId(x, y - 1, z)) && ok(w.getId(x + dx, y, z + dz)) && ok(w.getId(x - dx, y, z - dz));
}
function tryLightPortal(w, x, y, z) {
  const airish = (id) => id === 0 || id === B.fire;
  for (let ax = 0; ax < 2; ax++) {
    const dx = ax === 0 ? 1 : 0, dz = ax === 0 ? 0 : 1;
    if (!airish(w.getId(x, y, z))) return false;
    let by = y, steps = 0;
    while (by > 0 && airish(w.getId(x, by - 1, z)) && steps++ < 22) by--;
    if (w.getId(x, by - 1, z) !== B.obsidian) continue;
    let lx = x, lz = z; steps = 0;
    while (airish(w.getId(lx - dx, by, lz - dz)) && steps++ < 22) { lx -= dx; lz -= dz; }
    if (w.getId(lx - dx, by, lz - dz) !== B.obsidian) continue;
    let width = 0;
    while (airish(w.getId(lx + dx * width, by, lz + dz * width)) && width < 22) width++;
    if (width < 2 || width > 21 || w.getId(lx + dx * width, by, lz + dz * width) !== B.obsidian) continue;
    let height = 0, valid = true;
    for (; height < 22; height++) {
      let rowAir = true;
      for (let i = 0; i < width; i++) if (!airish(w.getId(lx + dx * i, by + height, lz + dz * i))) { rowAir = false; break; }
      if (!rowAir) break;
      if (w.getId(lx - dx, by + height, lz - dz) !== B.obsidian || w.getId(lx + dx * width, by + height, lz + dz * width) !== B.obsidian) { valid = false; break; }
    }
    if (!valid || height < 3 || height > 21) continue;
    for (let i = 0; i < width; i++) if (w.getId(lx + dx * i, by + height, lz + dz * i) !== B.obsidian || w.getId(lx + dx * i, by - 1, lz + dz * i) !== B.obsidian) valid = false;
    if (!valid) continue;
    for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) w.setBlock(lx + dx * i, by + j, lz + dz * i, B.nether_portal | (ax << 12), 0);
    w.game.registerPortal(w.dim, lx + dx * Math.floor(width / 2), by, lz + dz * Math.floor(width / 2), ax);
    return true;
  }
  return false;
}
