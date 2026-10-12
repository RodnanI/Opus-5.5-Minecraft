// ============================================================================
//  SKYWAYS (1/2): a world type made for flying jets. Regions, terrain and the natural obstacles.
//  The map is split into regions about 720 blocks across (a jittered grid, domain-warped and blended over ~150
//  blocks at the borders). Each region has a name, a difficulty and one of five terrains: canyon mazes (red rock,
//  or flooded fjords where it is cold), lagoons of rock spires (or a stone forest of needles), sky archipelagos,
//  peaks bored through by lit tunnels, and meadows. Spawn is the home airbase. The map level (1-10, the same
//  everywhere or rolled per region) sets canyon widths, spire sizes and spacing, arch heights, debris, tunnel and
//  gate radii. Everything is a pure function of the seed and the level, so every worker builds the same blocks and
//  the main thread can ask any worker for a region's airfield and course (21_skyways_courses.js).
// ============================================================================
const SKY_CELL = 720, SKY_BLEND = 150, SKY_TAU = Math.PI * 2;
const SKZ = { HOME: 0, MEADOW: 1, CANYON: 2, SPIRES: 3, ISLES: 4, PEAKS: 5 };
// the 8 regions around home, clockwise from the north-west corner
const SKY_RING = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const SKY_LEVELS = ['Sightseer', 'Cadet', 'Rookie', 'Pilot', 'Wingman', 'Flight Lead', 'Ace', 'Top Gun', 'Daredevil', 'Impossible'];
const SKY_LEVEL_DESC = [
  'Very wide canyons, roomy tunnels, huge gates and almost nothing in the way. Sightseeing.',
  'Wide canyons and tunnels, big gates, rock arches high overhead.',
  'Comfortable canyons and tunnels, a few lower arches to duck under.',
  'Canyons pinch in places, spires stand closer, the first debris drifts near the islands.',
  'Balanced: tighter turns, smaller gates, debris fields, windows through the spires.',
  'Narrow canyons with low arches, dense spire forests, smaller gates.',
  'Slot canyons and roofed gorges, tight tunnels, crowded debris fields.',
  'Very tight: thin gaps, low thick arches, stalactites hanging in the tunnel caverns.',
  'Needle-thin gaps, narrow winding tunnels, debris everywhere.',
  'Barely flyable. Every gap is a dare.'];
const SKY_NAMES = {
  canyon: [['Ember', 'Scarlet', 'Copper', 'Sunfire', 'Rustwater', 'Painted', 'Coyote', 'Ochre', 'Redwind', 'Dusthorn', 'Saffron', 'Cinder'], ['Canyons', 'Gorge', 'Breaks', 'Narrows', 'Labyrinth', 'Chasms']],
  fjord: [['Frostfang', 'Rime', 'Whiteout', 'Icewind', 'Silverthaw', 'Glacier', 'Hoarfrost', 'Winterhold'], ['Fjords', 'Sound', 'Inlets', 'Gorge']],
  spires: [['Glasswater', 'Jade', 'Pearl', 'Sapphire', 'Turquoise', 'Coral', 'Moonwater', 'Azure', 'Lotus'], ['Spires', 'Pillars', 'Lagoon', 'Stacks', 'Towers']],
  forest: [['Mossback', 'Emerald', 'Thornwood', 'Verdant', 'Greenhollow', 'Fernwild'], ['Stone Forest', 'Needles', 'Karst', 'Pinnacles']],
  isles: [['Halcyon', 'Skyreach', 'Cloudhaven', 'Drifting', 'Aether', 'Zephyr', 'Lumen', 'Starfall', 'Windward'], ['Isles', 'Archipelago', 'Skylands', 'Reaches', 'Islands']],
  peaks: [['Ironback', 'Granite', 'Thunder', 'Stormcrest', 'Obsidian', 'Greywolf', 'Titan', 'Anvil', 'Basalt'], ['Peaks', 'Range', 'Massif', 'Crags', 'Teeth', 'Spine']],
  meadow: [['Greenfield', 'Willow', 'Clover', 'Amber', 'Bluebell', 'Sunny', 'Honey', 'Meadowlark', 'Barley'], ['Meadows', 'Downs', 'Fields', 'Vale', 'Lowlands', 'Plains']],
};
// what each terrain is called, and what its course is called
const SKY_KIND = {
  home: ['Home Airfield', 'Flight School'], meadow: ['Lowlands', 'Lowland Loop'], canyon: ['Canyonlands', 'Canyon Run'], fjord: ['Glacier Fjords', 'Fjord Run'],
  spires: ['Spire Lagoon', 'Spire Slalom'], forest: ['Stone Forest', 'Needle Slalom'], isles: ['Sky Archipelago', 'Island Circuit'], peaks: ['Tunnel Peaks', 'Tunnel Dash'],
};
Object.assign(BIO, { RED_CANYON: 26, FJORD: 27, SPIRE_LAGOON: 28, STONE_FOREST: 29, SKY_ISLES: 30, HIGH_PEAKS: 31 });
biomeDef(26, 'Red Rock Canyons', { grass: 0xA4A15A, foliage: 0x9C9C3E, water: 0x3AA3A0, trees: 0.6, treeTypes: [['acacia', 75], ['oak', 25]], grassD: 0.06, flowerD: 0.003, flowers: ['dandelion', 'orange_tulip', 'red_tulip'], top: 'red_sand', filler: 'red_sand', animals: ['sheep'], sky: 0x7DB4FF, dry: true });
biomeDef(27, 'Glacier Fjords', { grass: 0x80B497, foliage: 0x60A17B, water: 0x2B5FB5, snowy: true, trees: 1.5, treeTypes: [['spruce', 75], ['pine', 25]], grassD: 0.04, fern: 0.6, flowerD: 0 });
biomeDef(28, 'Spire Lagoon', { grass: 0x67CC48, foliage: 0x45B52B, water: 0x2BCFC4, trees: 3, treeTypes: [['jungle', 35], ['jungle_bush', 40], ['oak', 25]], grassD: 0.3, fern: 0.35, flowerD: 0.02, flowers: ['blue_orchid', 'allium', 'pink_tulip', 'oxeye_daisy'], animals: ['chicken'], sky: 0x6CB6FF });
biomeDef(29, 'Stone Forest', { grass: 0x5FB843, foliage: 0x3C9E28, water: 0x2C98BE, trees: 3, treeTypes: [['jungle_bush', 55], ['oak', 25], ['jungle', 20]], grassD: 0.4, fern: 0.5, flowerD: 0.01, animals: ['chicken', 'pig'] });
biomeDef(30, 'Sky Archipelago', { grass: 0x78D058, foliage: 0x58C236, water: 0x3FA8F2, trees: 2.5, treeTypes: [['oak', 40], ['birch', 25], ['cherry', 15], ['big_oak', 20]], grassD: 0.32, flowerD: 0.05, flowers: FLOWERS.concat(FLOWERS2), animals: ['sheep', 'cow', 'pig', 'chicken'], sky: 0x74B0FF });
biomeDef(31, 'Tunnel Peaks', { grass: 0x86B486, foliage: 0x68A168, water: 0x2E7ED0, trees: 2, treeTypes: [['spruce', 65], ['pine', 35]], grassD: 0.08, fern: 0.3, flowerD: 0.004, animals: ['sheep'] });

// terraced canyon wall profile: s 0 = floor edge, 1 = rim; mostly a staircase of ledges over a smooth slope
function skyProf(s) {
  const t = s * 4, i = Math.floor(t), st = (i + smoothstep(0.4, 0.95, t - i)) / 4;
  return smoothstep(0, 1, s) * 0.42 + st * 0.58;
}
function skyKey(i, j) { return (i + 32768) * 65536 + (j + 32768); }

class SkyBase {
  constructor(gen, o) {
    o = o || {};
    this.g = gen; this.seed = gen.seed >>> 0;
    this.level = clamp(Math.round(+o.level || 5), 1, 10);
    this.d0 = (this.level - 1) / 9;
    this.varied = !!o.varied;
    const r = new RNG(this.seed ^ 0x5C1E5A1D), ns = () => new Noise(r.u32());
    this.nZW = ns(); this.nBase = ns(); this.nHill = ns(); this.nDet = ns(); this.nCanA = ns(); this.nCanB = ns();
    this.nCanW = ns(); this.nCanV = ns(); this.nRidge = ns(); this.nOver = ns(); this.nTemp = ns(); this.nHum = ns();
    this.nDens = ns(); this.nVar = ns();
    this.cells = new Map(); this.ncache = new Map(); this.cf = new Map(); this.afNear = new Map();
    this.fSp = new Map(); this.fNd = new Map(); this.fIs = new Map(); this.fHo = new Map(); this.fAr = new Map(); this.fBr = new Map();
    this._cs = new Array(9); this._ds = new Float64Array(9); this._ck = null; this._c9 = null;
    // the 8 regions around home show off every terrain: each twice, rotated so that neighbours around the ring differ
    const ring = [SKZ.CANYON, SKZ.SPIRES, SKZ.ISLES, SKZ.PEAKS, SKZ.CANYON, SKZ.SPIRES, SKZ.ISLES, SKZ.PEAKS];
    const rr = new RNG(this.seed ^ 0x40E1), rot = rr.int(8), rev = rr.next() < 0.5;
    this.homeRing = ring.map((_, k) => ring[(((rev ? 8 - k : k) + rot) % 8 + 8) % 8]);
  }
  // ---------------------------------------------------------------- regions
  diffOf(i, j) {
    if (i === 0 && j === 0) return this.d0 * 0.55;   // the home course is the gentle introduction
    return this.varied ? clamp(this.d0 + (hashF2(this.seed ^ 0xD1FF, i, j) - 0.5) * 0.95, 0, 1) : this.d0;
  }
  // meadows get rarer as the map gets harder
  rawType(i, j, salt) {
    const wm = lerp(1.2, 0.3, this.diffOf(i, j)), t = hashF2(this.seed ^ salt, i, j) * (wm + 4);
    return t < wm ? SKZ.MEADOW : SKZ.CANYON + Math.min(3, Math.floor(t - wm));
  }
  cell(i, j) {
    const k = skyKey(i, j);
    let c = this.cells.get(k); if (c) return c;
    const r = new RNG(hash2(this.seed ^ 0x2A0E5, i, j)), home = i === 0 && j === 0;
    const jx = (r.next() - 0.5) * 0.44 * SKY_CELL, jz = (r.next() - 0.5) * 0.44 * SKY_CELL;
    const x = i * SKY_CELL + (home ? 0 : jx), z = j * SKY_CELL + (home ? 0 : jz), d = this.diffOf(i, j);
    let type;
    if (home) type = SKZ.HOME;
    else if (Math.abs(i) <= 1 && Math.abs(j) <= 1) type = this.homeRing[SKY_RING.findIndex(p => p[0] === i && p[1] === j)];
    else {
      type = this.rawType(i, j, 0x7E01);
      if (type === this.rawType(i - 1, j, 0x7E01) || type === this.rawType(i, j - 1, 0x7E01)) type = this.rawType(i, j, 0x7E02);
    }
    const temp = fbm2(this.nTemp, x / 2600, z / 2600, 2, 0.5);
    // (the regions around home stay temperate, so the red canyons are always there to see)
    const cold = type !== SKZ.SPIRES && type !== SKZ.HOME && Math.max(Math.abs(i), Math.abs(j)) > 1 && temp < -0.24 ? 1 : 0;
    const sv = type === SKZ.SPIRES && r.next() < 0.3 + d * 0.25 ? 1 : 0;   // a stone forest of needles instead of a lagoon
    c = { i, j, k, x, z, d, type, cold, sv, home, lv: Math.round(d * 9) + 1, salt: r.u32() };
    c.kind = home ? 'home' : type === SKZ.MEADOW ? 'meadow' : type === SKZ.CANYON ? (cold ? 'fjord' : 'canyon') : type === SKZ.SPIRES ? (sv ? 'forest' : 'spires') : type === SKZ.ISLES ? 'isles' : 'peaks';
    const words = SKY_NAMES[c.kind] || SKY_NAMES.meadow;
    c.name = home ? 'Skyhaven' : r.pick(words[0]) + ' ' + r.pick(words[1]);
    c.label = SKY_KIND[c.kind][0]; c.courseName = (home ? 'Skyhaven ' : c.name + ' ') + SKY_KIND[c.kind][1];
    if (home) c.name = 'Skyhaven Airbase';
    this.cells.set(k, c);
    return c;
  }
  cells9(i0, j0) {
    const k = skyKey(i0, j0);
    if (this._ck === k) return this._c9;
    const out = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) out.push(this.cell(i0 + di, j0 + dj));
    this._ck = k; this._c9 = out;
    return out;
  }
  warp(x, z) { return [x + this.nZW.n2(x / 520, z / 520) * 95, z + this.nZW.n2(x / 520 + 71.3, z / 520 - 33.7) * 95]; }
  // the region a point belongs to, and how far into it (1 = well inside); cheap enough for the HUD
  zoneAt(x, z) {
    const [wx, wz] = this.warp(x, z), cs = this.cells9(Math.floor(wx / SKY_CELL + 0.5), Math.floor(wz / SKY_CELL + 0.5));
    let b = null, bd = 1e18, sd = 1e18;
    for (const c of cs) { const dd = Math.hypot(wx - c.x, wz - c.z); if (dd < bd) { sd = bd; bd = dd; b = c; } else if (dd < sd) sd = dd; }
    return { cell: b, inside: clamp((sd - bd) / SKY_BLEND, 0, 1) };
  }
  // ---------------------------------------------------------------- natural terrain (no airfields), cached per column
  natCol(x, z) {
    const key = x * 131072 + z;
    let o = this.ncache.get(key); if (o) return o;
    if (this.ncache.size > 60000) this.ncache.clear();
    o = this.computeNat(x, z);
    this.ncache.set(key, o);
    return o;
  }
  computeNat(x, z) {
    const [wx, wz] = this.warp(x, z), cs = this.cells9(Math.floor(wx / SKY_CELL + 0.5), Math.floor(wz / SKY_CELL + 0.5)), ds = this._ds;
    let best = 1e18, bi = 0;
    for (let k = 0; k < 9; k++) { const c = cs[k], dx = wx - c.x, dz = wz - c.z, dd = Math.sqrt(dx * dx + dz * dz); ds[k] = dd; if (dd < best) { best = dd; bi = k; } }
    const tw = new Float32Array(6);
    let tot = 0, d = 0, cold = 0, sv = 0, second = 1e18;
    for (let k = 0; k < 9; k++) {
      const e = ds[k] - best; if (k !== bi && ds[k] < second) second = ds[k];
      if (e >= SKY_BLEND) continue;
      let w = 1 - e / SKY_BLEND; w *= w; tot += w;
      const c = cs[k]; tw[c.type] += w; d += w * c.d; cold += w * c.cold; sv += w * c.sv;
    }
    for (let t = 0; t < 6; t++) tw[t] /= tot;
    const o = { tw, cell: cs[bi], zt: cs[bi].type, d: d / tot, cold: cold / tot, sv: sv / tot, inside: clamp((second - best) / SKY_BLEND, 0, 1), cs: -1, cF: 0, cP: 0, eA: 99, eB: 99 };
    const n1 = fbm2(this.nBase, x / 600, z / 600, 3, 0.5), n2 = fbm2(this.nHill, x / 170, z / 170, 3, 0.5), det = fbm2(this.nDet, x / 40, z / 40, 2, 0.5);
    o.n1 = n1; o.n2 = n2; o.det = det;
    let h = 0;
    if (tw[0] > 0) h += tw[0] * (69 + n1 * 7 + n2 * 4 + det * 1.4);
    if (tw[1] > 0) h += tw[1] * (67 + n1 * 15 + n2 * 7 + det * 2.2);
    if (tw[2] > 0) h += tw[2] * this.canyonH(x, z, o, n1, n2, det);
    if (tw[3] > 0) h += tw[3] * lerp(51 + n2 * 6 + det * 2 + smoothstep(0.18, 0.42, n1) * 16, 67 + n2 * 5 + det * 2, o.sv);
    if (tw[4] > 0) h += tw[4] * (64 + n1 * 11 + n2 * 6 + det * 2);
    if (tw[5] > 0) h += tw[5] * this.peaksH(x, z, n2, det);
    o.hn = Math.min(h, CH - 6);
    o.temp = fbm2(this.nTemp, x / 2600, z / 2600, 2, 0.5) * 1.6 - o.cold * 0.6;
    o.hum = fbm2(this.nHum, x / 1300, z / 1300, 2, 0.5) * 1.6;
    return o;
  }
  // canyon noise of both families at an integer column (warped together), cached: [main, side]
  cfv(x, z) {
    const key = x * 131072 + z;
    let v = this.cf.get(key); if (v) return v;
    if (this.cf.size > 90000) this.cf.clear();
    const wx = x + this.nCanW.n2(x / 260, z / 260) * 46, wz = z + this.nCanW.n2(x / 260 + 19.1, z / 260 - 7.7) * 46;
    v = [fbm2(this.nCanA, wx / 540, wz / 540, 2, 0.5), fbm2(this.nCanB, wx / 300, wz / 300, 2, 0.5)];
    this.cf.set(key, v);
    return v;
  }
  // canyon field value and gradient (per block) of a family at an integer column
  cgrad(x, z, fam) {
    const v = this.cfv(x, z)[fam], gx = (this.cfv(x + 1, z)[fam] - this.cfv(x - 1, z)[fam]) * 0.5, gz = (this.cfv(x, z + 1)[fam] - this.cfv(x, z - 1)[fam]) * 0.5;
    return [v, gx, gz];
  }
  // distance (blocks) from the centre line of the nearest canyon of a family
  cdist(x, z, fam) { const [v, gx, gz] = this.cgrad(x, z, fam); return Math.abs(v) / Math.max(Math.hypot(gx, gz), 0.0011); }
  // two families of winding canyons cut into a stepped plateau: wide main canyons with a river, and narrower side
  // canyons whose floors hang a third of the way up the walls. Flooded to the walls in the cold (fjords)
  canyonH(x, z, o, n1, n2, det) {
    const d = o.d, cold = o.cold;
    const P = lerp(113, 127, cold) + n1 * 12 + Math.round(n2 * 3) * 1.6, F = lerp(61 + det * 1.2, 40, cold);
    const vA = 1 + 0.38 * clamp(this.nCanV.n2(x / 230, z / 230) * 1.4, -1, 1), vB = 1 + 0.3 * clamp(this.nCanV.n2(x / 170 + 50, z / 170) * 1.4, -1, 1);
    // (the narrows still leave room for a jet down the bottom)
    const fwA = Math.max(lerp(30, 7.5, d) * vA, lerp(14, 6.5, d)), wwA = lerp(36, 13, d) * lerp(1, 0.75, cold), fwB = Math.max(lerp(17, 5.5, d) * vB, 5), wwB = lerp(24, 10, d);
    const eA = this.cdist(x, z, 0), eB = this.cdist(x, z, 1);
    const sA = clamp((eA - fwA) / wwA, 0, 1), sB = clamp((eB - fwB) / wwB, 0, 1), FB = F + (P - F) * 0.36;
    const hA = F + (P - F) * skyProf(sA), hB = FB + (P - FB) * skyProf(sB);
    let h, s, f;
    if (hA <= hB) { h = hA; s = sA; f = F; } else { h = hB; s = sB; f = FB; }
    // a river down the middle of the main canyons
    if (cold < 0.5) { const rw = Math.max(3, fwA * 0.4); if (eA < rw) { const q = eA / rw, rv = 58.4 + 3.4 * q * q; if (rv < h) { h = rv; s = 0; } } }
    o.cs = s > 0.01 && s < 0.99 ? s : -1; o.cF = f; o.cP = P; o.eA = eA; o.eB = eB; o.fwA = fwA; o.wwA = wwA; o.cFloor = F;
    return h;
  }
  // sharp ridged ranges with deep valleys between them; some massifs stand taller than others
  peaksH(x, z, n2, det) {
    const r = fbm2(this.nRidge, x / 430, z / 430, 4, 0.5), m = fbm2(this.nRidge, x / 900 + 33.3, z / 900 - 17.1, 2, 0.5);
    let k = 1 - Math.abs(r) * 1.75; if (k < 0) k = 0;
    return 70 + (96 + m * 40) * Math.pow(k, 2.2) + n2 * 9 + det * 3;
  }
  // ---------------------------------------------------------------- final columns (the overworld's climate)
  climate(x, z, o) {
    const n = this.natCol(x, z);
    let h = n.hn;
    o.nat = n; o.tw = n.tw; o.zt = n.zt; o.cell = n.cell; o.d = n.d; o.cold = n.cold; o.sv = n.sv; o.af = null;
    // airfields flatten their ground and keep their approach paths clear
    const afs = this.airfieldsNear(x, z);
    for (let k = 0; k < afs.length; k++) h = this.airShape(afs[k], x, z, h, o);
    o.h = h;
    o.cs = Math.abs(h - n.hn) < 0.3 ? n.cs : -1;
    o.biome = this.biomeOf(n, o);
    // what the rest of the overworld code reads
    o.temp = n.temp; o.hum = n.hum; o.det = n.det; o.m = n.zt === SKZ.PEAKS ? 0.5 : 0; o.hill = 0; o.amp = 0; o.cont = 0.3;
    o.river = 0; o.swamp = 0; o.bad = 0; o.mush = 0; o.ridge = 0; o.variant = n.n2;
    return o;
  }
  biomeOf(n, o) {
    switch (n.zt) {
      case SKZ.CANYON: return n.cold > 0.5 ? BIO.FJORD : BIO.RED_CANYON;
      case SKZ.SPIRES: return n.sv > 0.5 ? BIO.STONE_FOREST : BIO.SPIRE_LAGOON;
      case SKZ.ISLES: return n.cold > 0.5 ? BIO.SNOWY_TAIGA : BIO.SKY_ISLES;
      case SKZ.PEAKS: return n.cold > 0.5 || o.h > 156 ? BIO.SNOWY_PEAKS : BIO.HIGH_PEAKS;
    }
    // meadows (and home): the classic biomes by climate, plain grass around the airfields
    if (o.af || o.h < SEA - 0.5) return n.cold > 0.5 ? BIO.SNOWY_PLAINS : BIO.PLAINS;
    if (n.cold > 0.5) return n.hum < 0 ? BIO.SNOWY_PLAINS : BIO.SNOWY_TAIGA;
    const t = n.temp, hu = n.hum, v = n.n2;
    if (t > 0.5) return hu < 0.1 ? BIO.SAVANNA : BIO.PLAINS;
    if (hu < -0.25) return BIO.PLAINS;
    if (hu < 0.15) return v > 0.25 ? BIO.FLOWER_FOREST : v < -0.3 ? BIO.CHERRY_GROVE : BIO.PLAINS;
    return v > 0 ? BIO.FOREST : BIO.BIRCH_FOREST;
  }
  // airfields of the 3x3 grid cells around a column (the only ones whose pad or approach paths can reach it)
  airfieldsNear(x, z) {
    const i = Math.floor(x / SKY_CELL + 0.5), j = Math.floor(z / SKY_CELL + 0.5), k = skyKey(i, j);
    let l = this.afNear.get(k);
    if (!l) {
      l = [];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = this.airfield(this.cell(i + di, j + dj)); if (a) l.push(a); }
      this.afNear.set(k, l);
    }
    return l;
  }
  // an airfield's effect on one column: the pad is levelled (feathered into the terrain around it) and a corridor
  // off both ends of the runway is cut down to a 1:7 slope, so there is always a clear approach and climb-out
  airShape(af, x, z, h, o) {
    const dx = x - af.x, dz = z - af.z, a = dx * af.fx + dz * af.fz, b = dx * af.rx + dz * af.rz;
    const ea = Math.max(0, Math.abs(a) - af.padA), eb = b < af.padB0 ? af.padB0 - b : b > af.padB1 ? b - af.padB1 : 0;
    const out = ea > 0 || eb > 0 ? Math.hypot(ea, eb) : 0;
    if (out < 28) {
      const k = 1 - smoothstep(0, 28, out);
      h = lerp(h, af.y + 1, k);
      if (out === 0 && o) { o.af = af; o.afa = a; o.afb = b; }
    }
    const ae = Math.abs(a) - af.padA;
    if (ae > 0 && ae < 380) {
      const half = af.W + 18 + ae * 0.22, e = 1 - smoothstep(half, half + 26, Math.abs(b));
      if (e > 0) { const cap = af.y + 2 + ae * 0.14; if (h > cap) h = lerp(h, cap, e); }
    }
    return h;
  }
  // true where a feature (spire, island, hoop, arch) would get in the way of an airfield: over the pad, or under the
  // glide path off either end of a runway
  airspace(x, z, yb) {
    const afs = this.airfieldsNear(Math.floor(x), Math.floor(z));
    for (let k = 0; k < afs.length; k++) {
      const af = afs[k], dx = x - af.x, dz = z - af.z, a = dx * af.fx + dz * af.fz, b = dx * af.rx + dz * af.rz;
      if (Math.abs(a) < af.padA + 30 && b > af.padB0 - 30 && b < af.padB1 + 30 && yb < af.y + 75) return true;
      const ae = Math.abs(a) - af.padA;
      if (ae > -30 && ae < 420 && Math.abs(b) < af.W + 40 + Math.max(0, ae) * 0.25 && yb < af.y + 34 + Math.max(0, ae) * 0.16) return true;
    }
    return false;
  }
  airspaceAround(x, z, r, yb) { return this.airspace(x, z, yb) || this.airspace(x + r, z, yb) || this.airspace(x - r, z, yb) || this.airspace(x, z + r, yb) || this.airspace(x, z - r, yb); }
  // ---------------------------------------------------------------- spires (lagoons): one candidate per 40-block cell
  spire(gi, gj) {
    const key = skyKey(gi, gj);
    let s = this.fSp.get(key); if (s !== undefined) return s;
    if (this.fSp.size > 30000) this.fSp.clear();
    s = null;
    const r = new RNG(hash2(this.seed ^ 0x5F1E0, gi, gj));
    const x = gi * 40 + 12 + r.next() * 16, z = gj * 40 + 12 + r.next() * 16, n = this.natCol(Math.floor(x), Math.floor(z));
    if (n.tw[SKZ.SPIRES] > 0.55 && n.sv < 0.5) {
      const d = n.d, clu = clamp(0.75 + this.nDens.n2(x / 260, z / 260) * 0.9, 0.25, 1.3);
      if (r.next() < lerp(0.32, 0.72, d) * clu) {
        const r0 = lerp(10.5, 5.5, d) * (0.72 + r.next() * 0.55), lo = lerp(108, 96, d);
        const top = Math.min(CH - 5, Math.round(lo + r.next() * (182 - lo)));
        s = { x, z, r0, base: Math.floor(n.hn) - 6, top, lx: (r.next() - 0.5) * 0.12, lz: (r.next() - 0.5) * 0.12, ph1: r.next() * SKY_TAU, ph2: r.next() * SKY_TAU, mat: r.int(7), gi, gj, d, needle: false };
        // a pair of neighbours may be joined by a natural rock bridge; big spires sometimes have a window through them
        const pb = lerp(0.07, 0.3, d);
        s.bx = r.next() < pb; s.bz = r.next() < pb;
        if (r0 >= 7.5 && r.next() < lerp(0.08, 0.32, d)) {
          const ey = Math.round(lerp(s.base + 30, s.top - 18, r.next())), er = Math.max(5.6, Math.min(r0 * 0.62, lerp(9.5, 6, d)));
          const t = (ey - s.base) / (s.top - s.base), rAt = r0 * (1.16 - 0.36 * t);
          if (rAt >= er + 2.2 && ey > 74) s.eye = { y: ey, r: er, a: r.next() * Math.PI };
        }
        if (this.airspaceAround(x, z, r0 + 4, s.base)) s = null;
      }
    }
    this.fSp.set(key, s);
    return s;
  }
  // needles (stone forest): thin pinnacles on a 22-block grid
  needle(gi, gj) {
    const key = skyKey(gi, gj);
    let s = this.fNd.get(key); if (s !== undefined) return s;
    if (this.fNd.size > 40000) this.fNd.clear();
    s = null;
    const r = new RNG(hash2(this.seed ^ 0x4EED1, gi, gj));
    const x = gi * 22 + 7 + r.next() * 8, z = gj * 22 + 7 + r.next() * 8, n = this.natCol(Math.floor(x), Math.floor(z));
    if (n.tw[SKZ.SPIRES] > 0.55 && n.sv >= 0.5) {
      const d = n.d, clu = clamp(0.8 + this.nDens.n2(x / 200 + 9, z / 200) * 0.8, 0.3, 1.25);
      if (r.next() < lerp(0.55, 0.88, d) * clu) {
        const r0 = lerp(4.4, 2.5, d) * (0.75 + r.next() * 0.5), ground = Math.floor(n.hn);
        const top = Math.min(CH - 5, ground + Math.round(22 + r.next() * lerp(46, 64, d)));
        s = { x, z, r0, base: ground - 4, top, lx: (r.next() - 0.5) * 0.09, lz: (r.next() - 0.5) * 0.09, ph1: r.next() * SKY_TAU, ph2: r.next() * SKY_TAU, mat: r.int(7), gi, gj, d, needle: true, bx: false, bz: false };
        if (this.airspaceAround(x, z, r0 + 3, s.base)) s = null;
      }
    }
    this.fNd.set(key, s);
    return s;
  }
  // per-height radius of a spire (and the phase of its ribbing), built once per spire
  spireProf(s) {
    if (s.prof) return s.prof;
    const n = s.top - s.base + 1, r = new Float32Array(n), cp = new Float32Array(n), sp = new Float32Array(n);
    let rm = 0;
    for (let k = 0; k < n; k++) {
      const y = s.base + k, t = k / (n - 1);
      let rr = s.r0 * (1.16 - 0.36 * t) * (1 + 0.06 * Math.sin(y * 0.17 + s.ph2));
      if (s.top - y < 4) rr *= 1.06 + (4 - (s.top - y)) * 0.03;
      r[k] = rr; if (rr > rm) rm = rr;
      cp[k] = Math.cos(s.ph1 + y * 0.09); sp[k] = Math.sin(s.ph1 + y * 0.09);
    }
    const lean = (Math.abs(s.lx) + Math.abs(s.lz)) * n;
    return s.prof = { r, cp, sp, rmax: rm * 1.2 + lean + 1 };
  }
  spireSolid(s, x, y, z) {
    const k = Math.floor(y) - s.base; if (k < 0 || y > s.top + 1) return false;
    const P = this.spireProf(s), kk = Math.min(k, P.r.length - 1);
    const dx = x - s.x - s.lx * kk, dz = z - s.z - s.lz * kk, d2 = dx * dx + dz * dz;
    if (d2 > P.rmax * P.rmax) return false;
    const th = Math.atan2(dz, dx), rr = P.r[kk] * (1 + 0.12 * (Math.sin(3 * th) * P.cp[kk] + Math.cos(3 * th) * P.sp[kk]) + 0.06 * Math.sin(5 * th + s.ph2));
    if (d2 >= rr * rr) return false;
    if (s.eye && this.inEye(s, x, y, z)) return false;
    return true;
  }
  inEye(s, x, y, z) {
    const e = s.eye, ax = Math.cos(e.a), az = Math.sin(e.a);
    const k = e.y - s.base, cx = s.x + s.lx * k, cz = s.z + s.lz * k;
    const u = (x - cx) * -az + (z - cz) * ax, v = y - e.y;
    return u * u + v * v < e.r * e.r;
  }
  // rock bridge from spire s to its +x (dir 0) or +z (dir 1) neighbour
  bridge(s, dir) {
    if (!s || !(dir ? s.bz : s.bx)) return null;
    const key = skyKey(s.gi * 2 + dir, s.gj);
    let b = this.fBr.get(key); if (b !== undefined) return b;
    if (this.fBr.size > 20000) this.fBr.clear();
    b = null;
    const t = dir ? this.spire(s.gi, s.gj + 1) : this.spire(s.gi + 1, s.gj);
    if (t) {
      const L = Math.hypot(t.x - s.x, t.z - s.z), r = new RNG(hash2(this.seed ^ 0xB81D6E, s.gi * 2 + dir, s.gj));
      const lo = Math.max(84, Math.max(s.base, t.base) + 30), hi = Math.min(s.top, t.top) - 10;
      if (L > s.r0 + t.r0 + 12 && L < 78 && hi > lo) b = { ax: s.x, az: s.z, bx: t.x, bz: t.z, yb: Math.round(lerp(lo, hi, r.next())), T: 3 + r.next() * 2 + s.d * 2.5, W: 2 + r.next() * 1.4 };
    }
    this.fBr.set(key, b);
    return b;
  }
  bridgeSpan(b, x, z) {
    const dx = b.bx - b.ax, dz = b.bz - b.az, L2 = dx * dx + dz * dz;
    const t = clamp(((x - b.ax) * dx + (z - b.az) * dz) / L2, 0, 1), px = b.ax + dx * t, pz = b.az + dz * t, l = Math.hypot(x - px, z - pz);
    if (l > b.W) return null;
    const q = Math.abs(2 * t - 1), th = b.T * (0.45 + 0.55 * q * q);
    return [Math.floor(b.yb - th), b.yb + (l < b.W * 0.6 ? 1 : 0)];
  }
  // ---------------------------------------------------------------- floating islands: two layers on 76-block grids
  island(layer, gi, gj) {
    const key = skyKey(gi * 2 + layer, gj);
    let s = this.fIs.get(key); if (s !== undefined) return s;
    if (this.fIs.size > 20000) this.fIs.clear();
    s = null;
    const r = new RNG(hash2(this.seed ^ (layer ? 0x15A2 : 0x15A1), gi, gj)), off = layer ? 38 : 0;
    const x = gi * 76 + off + 16 + r.next() * 44, z = gj * 76 + off + 16 + r.next() * 44, n = this.natCol(Math.floor(x), Math.floor(z));
    const wI = n.tw[SKZ.ISLES], wM = n.tw[SKZ.MEADOW] + n.tw[SKZ.HOME], d = n.d;
    const clu = clamp(0.8 + this.nDens.n2(x / 330 - 40, z / 330) * 0.8, 0.3, 1.3);
    const p = wI > 0.55 ? (layer ? lerp(0.22, 0.38, d) : lerp(0.42, 0.62, d)) * clu : wM > 0.6 && layer === 1 ? 0.07 : 0;
    if (p > 0 && r.next() < p) {
      const R = layer ? 8 + r.next() * 14 : 9 + r.next() * 22;
      let Y = Math.round(layer ? 140 + r.next() * 32 : 96 + r.next() * 30), depth = R * (0.75 + r.next() * 0.55);
      if (layer) depth = Math.min(depth, Y - 134);
      if (Y - depth < n.hn + 16) Y = Math.round(n.hn + 16 + depth);
      if (Y < CH - 8 && depth > 3) {
        s = { x, z, R, Y, depth, ph1: r.next() * SKY_TAU, ph2: r.next() * SKY_TAU, ph3: r.next() * SKY_TAU, layer, gi, gj, d, cold: n.cold > 0.5, salt: r.u32() };
        if (R >= 11 && r.next() < 0.45) s.fall = r.next() * SKY_TAU;
        if (r.next() < lerp(0.05, 0.45, d)) { s.chains = []; const nc = 2 + r.int(2); for (let k = 0; k < nc; k++) s.chains.push([r.next() * SKY_TAU, 0.3 + r.next() * 0.3]); }
        // debris: a cloud of small floating rocks around islands on the harder maps
        if (d > 0.28 && wI > 0.55) {
          const nd = Math.floor((d - 0.28) * 26 * r.next());
          if (nd > 0) {
            s.debris = [];
            for (let k = 0; k < nd; k++) {
              const a = r.next() * SKY_TAU, dist = R * 1.3 + 5 + r.next() * R * 1.3, ry = Y - 10 + r.next() * 30;
              s.debris.push({ x: x + Math.cos(a) * dist, y: Math.min(CH - 4, ry), z: z + Math.sin(a) * dist, r: 0.9 + r.next() * 1.7 });
            }
          }
        }
        if (this.airspaceAround(x, z, R * 1.3 + 4, Y - depth - 2)) s = null;
      }
    }
    this.fIs.set(key, s);
    return s;
  }
  // vertical extent [bottom, top] of an island at a column, or null
  isleSpan(s, x, z) {
    const dx = x - s.x, dz = z - s.z, d2 = dx * dx + dz * dz, Rm = s.R * 1.32;
    if (d2 > Rm * Rm) return null;
    const th = Math.atan2(dz, dx), Rt = s.R * (1 + 0.15 * Math.sin(2 * th + s.ph1) + 0.09 * Math.sin(3 * th + s.ph2) + 0.05 * Math.sin(5 * th + s.ph3));
    const rho = Math.sqrt(d2) / Rt; if (rho >= 1) return null;
    const xi = Math.floor(x), zi = Math.floor(z), hh = hashF2(s.salt, xi, zi);
    const top = s.Y + Math.floor(1.6 * (1 - rho * rho) + hh * 0.9);
    let bot = s.Y - Math.floor(s.depth * Math.pow(1 - rho, 0.62) * (0.84 + 0.16 * Math.sin(4 * th + s.ph1 * 2))) - 1;
    if (hh < 0.12) bot -= 1 + Math.floor(hh * 40);   // dangling rocks under the island
    return [bot, top];
  }
  // ---------------------------------------------------------------- hoops: giant floating stone rings, 180-block grid
  hoop(gi, gj) {
    const key = skyKey(gi, gj);
    let h = this.fHo.get(key); if (h !== undefined) return h;
    if (this.fHo.size > 20000) this.fHo.clear();
    h = null;
    const r = new RNG(hash2(this.seed ^ 0x400B5, gi, gj));
    const x = gi * 180 + 40 + r.next() * 100, z = gj * 180 + 40 + r.next() * 100, n = this.natCol(Math.floor(x), Math.floor(z)), zt = n.zt;
    const p = n.inside < 0.35 ? 0 : zt === SKZ.ISLES ? 0.55 : zt === SKZ.MEADOW || zt === SKZ.HOME ? 0.3 : zt === SKZ.SPIRES ? 0.3 : 0;
    if (p > 0 && r.next() < p) {
      const d = n.d, Ri = lerp(19, 8.5, d) * (0.85 + r.next() * 0.35), wr = 3 + r.next() * 2.5, th = 1.6 + r.next() * 1.2;
      let y = Math.max(n.hn, SEA) + Ri + wr + 12 + r.next() * 40;
      if (y + Ri + wr > CH - 4) y = CH - 4 - Ri - wr;
      const a = r.next() * Math.PI;
      h = { x, y: Math.round(y), z, Ri, wr, th, nx: Math.cos(a), nz: Math.sin(a), salt: r.u32() };
      // nothing may stand inside the hoop or cut through its ring
      if (this.airspaceAround(x, z, Ri + wr, y - Ri - wr)) h = null;
      else {
        for (let k = 0; k < 16 && h; k++) {
          const t = k / 16 * SKY_TAU, c = Math.cos(t), sn = Math.sin(t);
          for (const rad of [0, Ri * 0.6, Ri + wr * 0.5]) if (this.solidAt(x - h.nz * c * rad, h.y + sn * rad, z + h.nx * c * rad, null, true)) { h = null; break; }
        }
      }
    }
    this.fHo.set(key, h);
    return h;
  }
  // the one or two vertical runs a hoop fills in a column: [y0, y1, y2, y3] (y2 < 0: a single run)
  hoopSpan(h, x, z, out) {
    const dx = x - h.x, dz = z - h.z, a = dx * h.nx + dz * h.nz;
    if (a > h.th || a < -h.th) return false;
    const u = -dx * h.nz + dz * h.nx, Ro = h.Ri + h.wr;
    if (u > Ro || u < -Ro) return false;
    const outer = Math.sqrt(Ro * Ro - u * u), inner = Math.abs(u) < h.Ri ? Math.sqrt(h.Ri * h.Ri - u * u) : 0;
    if (!inner) { out[0] = Math.ceil(h.y - outer - 0.5); out[1] = Math.floor(h.y + outer - 0.5); out[2] = -1; return out[1] >= out[0]; }
    out[0] = Math.ceil(h.y - outer - 0.5); out[1] = Math.floor(h.y - inner - 0.5); out[2] = Math.ceil(h.y + inner - 0.5); out[3] = Math.floor(h.y + outer - 0.5);
    return true;
  }
  // ---------------------------------------------------------------- natural arches across the main canyons, 210-block grid
  arch(gi, gj) {
    const key = skyKey(gi, gj);
    let a = this.fAr.get(key); if (a !== undefined) return a;
    if (this.fAr.size > 20000) this.fAr.clear();
    a = null;
    const r = new RNG(hash2(this.seed ^ 0xA6C4E5, gi, gj));
    const p = this.snapCanyon(gi * 210 + 30 + r.next() * 150, gj * 210 + 30 + r.next() * 150, 0);
    if (p) {
      const n = this.natCol(p[0], p[1]);
      if (n.tw[SKZ.CANYON] > 0.85 && r.next() < lerp(0.4, 0.92, n.d) && n.cP - n.cFloor > 34) {
        const d = n.d, [, gx, gz] = this.cgrad(p[0], p[1], 0), gl = Math.hypot(gx, gz) || 1, F = n.cFloor, P = n.cP;
        const roof = r.next() < d * 0.3;
        a = { x: p[0] + 0.5, z: p[1] + 0.5, nx: gx / gl, nz: gz / gl, tx: -gz / gl, tz: gx / gl, hs: (n.fwA + n.wwA) * 1.1 + 8, P,
          Ya: F + (P - F) * lerp(0.74, 0.36, d) * (0.88 + r.next() * 0.2), T: lerp(4, 9, d) + r.next() * 3, W: roof ? 16 + r.next() * 20 : 4 + r.next() * 5, F };
        if (a.Ya - F < 18 || this.airspaceAround(a.x, a.z, a.hs, a.Ya)) a = null;
      }
    }
    this.fAr.set(key, a);
    return a;
  }
  archSpan(a, x, z) {
    const dx = x - a.x, dz = z - a.z, u = dx * a.nx + dz * a.nz, v = dx * a.tx + dz * a.tz;
    if (u > a.hs || u < -a.hs || v > a.W * 0.5 + 2 || v < -a.W * 0.5 - 2) return null;
    const q = Math.abs(u) / a.hs, wv = a.W * 0.5 * (0.82 + 0.18 * q) + Math.sin(u * 0.3 + a.x) * 0.6;
    if (Math.abs(v) > wv) return null;
    const under = a.Ya + (a.P + 2 - a.Ya) * Math.pow(q, 2.6), top = Math.min(a.P + 2, a.Ya + a.T + 4 * q * q + 2 * q);
    if (top <= under) return null;
    return [Math.floor(under), Math.floor(top)];
  }
  // Newton steps onto the centre line of a canyon family; null if it does not settle
  snapCanyon(x, z, fam) {
    let px = x, pz = z;
    for (let k = 0; k < 10; k++) {
      const xi = Math.round(px), zi = Math.round(pz), [v, gx, gz] = this.cgrad(xi, zi, fam), g2 = gx * gx + gz * gz;
      if (g2 < 1e-9) return null;
      const sx = v * gx / g2, sz = v * gz / g2;
      if (Math.abs(sx) < 0.6 && Math.abs(sz) < 0.6) return [xi, zi];
      px = xi - clamp(sx, -40, 40); pz = zi - clamp(sz, -40, 40);
    }
    return null;
  }
  // ---------------------------------------------------------------- queries
  // is (x, y, z) solid? Terrain (with room for canyon-wall overhangs), the natural features and, given a region
  // plan, its own tunnels and course features. Used to keep gates, hoops and courses in clear air
  solidAt(x, y, z, P, noHoops) {
    if (y < 1) return true;
    if (y >= CH) return false;
    const c = this.g.climateCached(Math.floor(x), Math.floor(z));
    if (y < c.h + (c.cs >= 0 ? 4 : 0.6)) return !(P && P.tubes.length && this.inTubes(P, x, y, z));
    if (this.featSolid(x, y, z, c, noHoops)) return true;
    return !!(P && P.feats.length && this.planFeatSolid(P, x, y, z));
  }
  featSolid(x, y, z, c, noHoops) {
    const tw = c.tw;
    if (tw[SKZ.SPIRES] > 0) {
      const sv = c.sv >= 0.5, G = sv ? 22 : 40, gi = Math.floor(x / G), gj = Math.floor(z / G);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const s = sv ? this.needle(gi + di, gj + dj) : this.spire(gi + di, gj + dj);
        if (!s) continue;
        if (y <= s.top + 1 && this.spireSolid(s, x, y, z)) return true;
        // the trees on a spire's cap
        if (!s.needle && y > s.top && y < s.top + 11) { const k = s.top - s.base, P = this.spireProf(s), rt = P.r[k] * 0.85; if (rt >= 4 && Math.hypot(x - s.x - s.lx * k, z - s.z - s.lz * k) < rt * 0.45 + 4) return true; }
        for (let k = 0; k < 2; k++) { const b = this.bridge(s, k); if (b) { const sp = this.bridgeSpan(b, x, z); if (sp && y >= sp[0] && y <= sp[1] + 1) return true; } }
      }
    }
    if (tw[SKZ.ISLES] + tw[SKZ.MEADOW] + tw[SKZ.HOME] > 0) {
      for (let layer = 0; layer < 2; layer++) {
        const off = layer ? 38 : 0, gi = Math.floor((x - off) / 76), gj = Math.floor((z - off) / 76);
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const s = this.island(layer, gi + di, gj + dj); if (!s) continue;
          const sp = this.isleSpan(s, x, z); if (sp && y >= sp[0] && y <= sp[1] + 1) return true;
          // the trees on an island
          if (y > s.Y && y < s.Y + 14 && s.R * s.R / 110 >= 0.5 && Math.hypot(x - s.x, z - s.z) < s.R * 0.6 + 4) return true;
          if (s.debris) for (const q of s.debris) { const dx = x - q.x, dy = y - q.y, dz = z - q.z, rr = q.r + 1; if (dx * dx + dy * dy + dz * dz < rr * rr) return true; }
        }
      }
    }
    if (tw[SKZ.CANYON] > 0) {
      const gi = Math.floor(x / 210), gj = Math.floor(z / 210);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = this.arch(gi + di, gj + dj); if (!a) continue;
        const sp = this.archSpan(a, x, z); if (sp && y >= sp[0] - 1 && y <= sp[1] + 1) return true;
      }
    }
    if (!noHoops) {
      const gi = Math.floor(x / 180), gj = Math.floor(z / 180), o = this._hs || (this._hs = [0, 0, 0, 0]);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const h = this.hoop(gi + di, gj + dj); if (!h || !this.hoopSpan(h, x, z, o)) continue;
        if (y >= o[0] - 1 && y <= o[1] + 1) return true;
        if (o[2] >= 0 && y >= o[2] - 1 && y <= o[3] + 1) return true;
      }
    }
    return false;
  }
}
