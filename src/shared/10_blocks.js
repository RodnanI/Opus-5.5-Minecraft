// ============================================================================
//  Block registry. IDs are assigned in definition order (append-only for saves).
// ============================================================================
const R_NONE = 0, R_CUBE = 1, R_CROSS = 2, R_CROP = 3, R_LIQUID = 4, R_SLAB = 5, R_STAIRS = 6, R_TORCH = 7,
  R_FENCE = 8, R_PANE = 9, R_DOOR = 10, R_TRAPDOOR = 11, R_LADDER = 12, R_VINE = 13, R_SNOW = 14, R_CARPET = 15,
  R_BED = 16, R_CACTUS = 17, R_CHEST = 18, R_FIRE = 19, R_PORTAL = 20, R_SHORT = 21, R_RAIL = 22, R_LILY = 23,
  R_GATE = 24, R_PLATE = 25, R_LANTERN = 26, R_CAMPFIRE = 27, R_FLAT = 28;
const L_SOLID = 0, L_CUTOUT = 1, L_TRANS = 2;
const T_NONE = 0, T_GRASS = 1, T_FOLIAGE = 2, T_WATER = 3, T_COLOR = 4;

const MAXB = 1000; // block ids must stay below 1000 (item ids start there)
const BLOCKS = [], B = Object.create(null);
const SHAPE = new Uint8Array(MAXB), LAYER = new Uint8Array(MAXB), OPAQUE = new Uint8Array(MAXB), OPACITY = new Uint8Array(MAXB);
const EMIT = new Uint8Array(MAXB), SOLID = new Uint8Array(MAXB), TINT = new Uint8Array(MAXB), WAVE = new Uint8Array(MAXB);
const FLUID = new Uint8Array(MAXB), REPL = new Uint8Array(MAXB), CULLSELF = new Uint8Array(MAXB), WLOG = new Uint8Array(MAXB);
const AOCC = new Uint8Array(MAXB), CLIMB = new Uint8Array(MAXB), NOSEL = new Uint8Array(MAXB), LEAVES = new Uint8Array(MAXB);
const EMISSIVE = new Uint8Array(MAXB), MASKSIDE = new Uint8Array(MAXB), ANIM = new Uint8Array(MAXB), PLANT = new Uint8Array(MAXB);
const AXISB = new Uint8Array(MAXB), FACINGB = new Uint8Array(MAXB), FENCEK = new Uint8Array(MAXB);
const COLOR = new Uint32Array(MAXB);
const TEX = new Uint16Array(MAXB * 6), TEXF = new Uint16Array(MAXB).fill(0xFFFF), TEXX = new Uint16Array(MAXB * 4);
const TEXN = [], TEXI = Object.create(null);
function tx(name) { let i = TEXI[name]; if (i === undefined) { i = TEXI[name] = TEXN.length; TEXN.push(name); } return i; }

// faces: 0 +x east, 1 -x west, 2 +y up, 3 -y down, 4 +z south, 5 -z north
const FACE_DX = [1, -1, 0, 0, 0, 0], FACE_DY = [0, 0, 1, -1, 0, 0], FACE_DZ = [0, 0, 0, 0, 1, -1];
// horizontal facing meta: 0 north(-z) 1 east(+x) 2 south(+z) 3 west(-x)
const FACING_FACE = [5, 0, 4, 1];
const FACING_DX = [0, 1, 0, -1], FACING_DZ = [-1, 0, 1, 0];

function def(name, o) {
  o = o || {};
  const id = BLOCKS.length;
  const shape = o.shape !== undefined ? o.shape : R_CUBE;
  const d = Object.assign({ id, name, hard: 1, snd: 'stone' }, o, { shape });
  BLOCKS.push(d); B[name] = id;
  SHAPE[id] = shape;
  const cubeLike = shape === R_CUBE;
  const layer = o.layer !== undefined ? o.layer : (cubeLike || shape === R_SHORT || shape === R_SLAB || shape === R_STAIRS || shape === R_CHEST || shape === R_CACTUS || shape === R_BED || shape === R_SNOW || shape === R_CARPET || shape === R_PLATE ? L_SOLID : L_CUTOUT);
  LAYER[id] = layer;
  const opaque = o.opaque !== undefined ? o.opaque : (cubeLike && layer === L_SOLID);
  OPAQUE[id] = opaque ? 1 : 0;
  OPACITY[id] = o.opacity !== undefined ? o.opacity : (opaque ? 15 : 0);
  EMIT[id] = o.light || 0;
  SOLID[id] = (o.solid !== undefined ? o.solid : !(shape === R_NONE || shape === R_CROSS || shape === R_CROP || shape === R_LIQUID || shape === R_TORCH || shape === R_VINE || shape === R_FIRE || shape === R_PORTAL || shape === R_RAIL || shape === R_LADDER || shape === R_PLATE || shape === R_FLAT)) ? 1 : 0;
  TINT[id] = o.tint || 0; COLOR[id] = o.color || 0xFFFFFF;
  WAVE[id] = o.wave || 0; FLUID[id] = o.fluid || 0; REPL[id] = o.repl ? 1 : 0;
  CULLSELF[id] = o.cullself ? 1 : 0; WLOG[id] = o.wlog ? 1 : 0; CLIMB[id] = o.climb ? 1 : 0;
  NOSEL[id] = o.nosel ? 1 : 0; LEAVES[id] = o.leaves ? 1 : 0; EMISSIVE[id] = o.emissive ? 1 : 0;
  MASKSIDE[id] = o.maskside ? 1 : 0; ANIM[id] = o.anim || 0; PLANT[id] = o.plant ? 1 : 0;
  AXISB[id] = o.axis ? 1 : 0; FACINGB[id] = o.facing ? 1 : 0; FENCEK[id] = o.fence || 0;
  AOCC[id] = (opaque || o.leaves) ? 1 : 0;
  const t = o.tex !== undefined ? o.tex : name;
  if (o.texFrom !== undefined) {
    const s = B[o.texFrom];
    for (let f = 0; f < 6; f++) TEX[id * 6 + f] = TEX[s * 6 + f];
  } else if (typeof t === 'string') {
    const ti = tx(t); for (let f = 0; f < 6; f++) TEX[id * 6 + f] = ti;
  } else {
    const top = t.top || t.end || t.all, bottom = t.bottom || t.end || top, side = t.side || t.all;
    const ft = [t.px || side, t.nx || side, top, bottom, t.pz || side, t.nz || side];
    for (let f = 0; f < 6; f++) TEX[id * 6 + f] = tx(ft[f]);
    if (t.front) TEXF[id] = tx(t.front);
  }
  if (o.texx) for (let i = 0; i < o.texx.length; i++) TEXX[id * 4 + i] = tx(o.texx[i]);
  return id;
}

// ---- Natural terrain
def('air', { shape: R_NONE, solid: false, opaque: false, repl: true, hard: 0, nosel: true, tex: 'stone' });
def('stone', { hard: 1.5, tool: 'pick', req: true, drop: 'cobblestone' });
def('granite', { hard: 1.5, tool: 'pick', req: true });
def('polished_granite', { hard: 1.5, tool: 'pick', req: true });
def('diorite', { hard: 1.5, tool: 'pick', req: true });
def('polished_diorite', { hard: 1.5, tool: 'pick', req: true });
def('andesite', { hard: 1.5, tool: 'pick', req: true });
def('polished_andesite', { hard: 1.5, tool: 'pick', req: true });
def('deepslate', { tex: { top: 'deepslate_top', side: 'deepslate' }, hard: 3, tool: 'pick', req: true, drop: 'cobbled_deepslate' });
def('cobbled_deepslate', { hard: 3.5, tool: 'pick', req: true });
def('grass_block', { tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, texx: ['grass_side_snowed'], tint: T_GRASS, maskside: true, hard: 0.6, tool: 'shovel', drop: 'dirt', snd: 'grass' });
def('dirt', { hard: 0.5, tool: 'shovel', snd: 'gravel' });
def('coarse_dirt', { hard: 0.5, tool: 'shovel', snd: 'gravel' });
def('podzol', { tex: { top: 'podzol_top', bottom: 'dirt', side: 'podzol_side' }, hard: 0.5, tool: 'shovel', drop: 'dirt', snd: 'gravel' });
def('mycelium', { tex: { top: 'mycelium_top', bottom: 'dirt', side: 'mycelium_side' }, hard: 0.6, tool: 'shovel', drop: 'dirt', snd: 'grass' });
def('dirt_path', { shape: R_SHORT, opaque: false, opacity: 15, tex: { top: 'dirt_path_top', bottom: 'dirt', side: 'dirt_path_side' }, hard: 0.65, tool: 'shovel', drop: 'dirt', snd: 'grass' });
def('farmland', { shape: R_SHORT, opaque: false, opacity: 15, tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' }, texx: ['farmland_wet'], hard: 0.6, tool: 'shovel', drop: 'dirt', snd: 'gravel' });
def('sand', { hard: 0.5, tool: 'shovel', snd: 'sand', grav: true });
def('red_sand', { hard: 0.5, tool: 'shovel', snd: 'sand', grav: true });
def('gravel', { hard: 0.6, tool: 'shovel', snd: 'gravel', grav: true, drop: 'custom' });
def('clay', { hard: 0.6, tool: 'shovel', snd: 'gravel', drop: ['clay_ball', 4, 4] });
def('sandstone', { tex: { top: 'sandstone_top', bottom: 'sandstone_bottom', side: 'sandstone' }, hard: 0.8, tool: 'pick', req: true });
def('cut_sandstone', { tex: { top: 'sandstone_top', side: 'cut_sandstone' }, hard: 0.8, tool: 'pick', req: true });
def('chiseled_sandstone', { tex: { top: 'sandstone_top', side: 'chiseled_sandstone' }, hard: 0.8, tool: 'pick', req: true });
def('smooth_sandstone', { tex: 'sandstone_top', hard: 2, tool: 'pick', req: true });
def('red_sandstone', { tex: { top: 'red_sandstone_top', bottom: 'red_sandstone_bottom', side: 'red_sandstone' }, hard: 0.8, tool: 'pick', req: true });
def('bedrock', { hard: -1 });
def('water', { shape: R_LIQUID, layer: L_TRANS, opaque: false, opacity: 2, solid: false, tex: { top: 'water_still', side: 'water_flow' }, tint: T_WATER, fluid: 1, repl: true, nosel: true, hard: 100, noItem: true, anim: 1, cullself: true });
def('lava', { shape: R_LIQUID, layer: L_SOLID, opaque: false, opacity: 15, solid: false, tex: { top: 'lava_still', side: 'lava_flow' }, light: 15, fluid: 2, repl: true, nosel: true, hard: 100, noItem: true, emissive: true, anim: 2 });
// ores
def('coal_ore', { hard: 3, tool: 'pick', req: true, tier: 0, drop: 'coal', xp: [0, 2] });
def('iron_ore', { hard: 3, tool: 'pick', req: true, tier: 1, drop: 'raw_iron' });
def('gold_ore', { hard: 3, tool: 'pick', req: true, tier: 2, drop: 'raw_gold' });
def('redstone_ore', { hard: 3, tool: 'pick', req: true, tier: 2, drop: ['redstone', 4, 5], xp: [1, 5] });
def('lapis_ore', { hard: 3, tool: 'pick', req: true, tier: 1, drop: ['lapis_lazuli', 4, 8], xp: [2, 5] });
def('diamond_ore', { hard: 3, tool: 'pick', req: true, tier: 2, drop: 'diamond', xp: [3, 7] });
def('emerald_ore', { hard: 3, tool: 'pick', req: true, tier: 2, drop: 'emerald', xp: [3, 7] });
def('deepslate_coal_ore', { hard: 4.5, tool: 'pick', req: true, tier: 0, drop: 'coal', xp: [0, 2] });
def('deepslate_iron_ore', { hard: 4.5, tool: 'pick', req: true, tier: 1, drop: 'raw_iron' });
def('deepslate_gold_ore', { hard: 4.5, tool: 'pick', req: true, tier: 2, drop: 'raw_gold' });
def('deepslate_redstone_ore', { hard: 4.5, tool: 'pick', req: true, tier: 2, drop: ['redstone', 4, 5], xp: [1, 5] });
def('deepslate_lapis_ore', { hard: 4.5, tool: 'pick', req: true, tier: 1, drop: ['lapis_lazuli', 4, 8], xp: [2, 5] });
def('deepslate_diamond_ore', { hard: 4.5, tool: 'pick', req: true, tier: 2, drop: 'diamond', xp: [3, 7] });
// wood
const WOODS = ['oak', 'birch', 'spruce', 'jungle', 'acacia', 'dark_oak'];
const LEAF_TINT = { oak: 0, birch: 0x80A755, spruce: 0x619961, jungle: 0, acacia: 0, dark_oak: 0 };
for (const w of WOODS) def(w + '_log', { tex: { side: w + '_log', end: w + '_log_top' }, axis: true, hard: 2, tool: 'axe', snd: 'wood', flam: true, fuel: 300 });
for (const w of WOODS) def(w + '_planks', { hard: 2, tool: 'axe', snd: 'wood', flam: true, fuel: 300 });
for (const w of WOODS) def(w + '_leaves', { layer: L_CUTOUT, opaque: false, opacity: 1, leaves: true, tint: LEAF_TINT[w] ? T_COLOR : T_FOLIAGE, color: LEAF_TINT[w] || 0xFFFFFF, wave: 1, hard: 0.2, tool: 'hoe', snd: 'grass', drop: 'custom', flam: true });
for (const w of WOODS) def(w + '_sapling', { shape: R_CROSS, plant: true, hard: 0, snd: 'grass', wave: 2, fuel: 100 });
def('snow', { hard: 0.2, tool: 'shovel', snd: 'snow', drop: ['snowball', 4, 4] });
def('snow_layer', { shape: R_SNOW, opaque: false, opacity: 0, hard: 0.1, tool: 'shovel', snd: 'snow', drop: 'snowball', repl: true, tex: 'snow' });
def('ice', { layer: L_TRANS, opaque: false, opacity: 2, cullself: true, hard: 0.5, tool: 'pick', snd: 'glass', drop: null, slip: 0.98 });
def('packed_ice', { hard: 0.5, tool: 'pick', snd: 'glass', drop: null, slip: 0.98 });
def('cactus', { shape: R_CACTUS, opaque: false, tex: { top: 'cactus_top', bottom: 'cactus_bottom', side: 'cactus_side' }, hard: 0.4, snd: 'wool', dmg: 1, plant: true });
def('sugar_cane', { shape: R_CROSS, tint: T_GRASS, plant: true, hard: 0, snd: 'grass' });
def('dead_bush', { shape: R_CROSS, plant: true, repl: true, hard: 0, snd: 'grass', drop: ['stick', 0, 2], wave: 2 });
def('tall_grass', { shape: R_CROSS, plant: true, tint: T_GRASS, wave: 2, repl: true, hard: 0, snd: 'grass', drop: 'custom' });
def('fern', { shape: R_CROSS, plant: true, tint: T_GRASS, wave: 2, repl: true, hard: 0, snd: 'grass', drop: 'custom' });
const FLOWERS = ['dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'oxeye_daisy', 'cornflower', 'lily_of_the_valley'];
for (const f of FLOWERS) def(f, { shape: R_CROSS, plant: true, wave: 2, hard: 0, snd: 'grass' });
def('brown_mushroom', { shape: R_CROSS, plant: true, light: 1, hard: 0, snd: 'grass' });
def('red_mushroom', { shape: R_CROSS, plant: true, hard: 0, snd: 'grass' });
def('brown_mushroom_block', { hard: 0.2, tool: 'axe', snd: 'wood', drop: ['brown_mushroom', 0, 2] });
def('red_mushroom_block', { hard: 0.2, tool: 'axe', snd: 'wood', drop: ['red_mushroom', 0, 2] });
def('mushroom_stem', { hard: 0.2, tool: 'axe', snd: 'wood', drop: null });
def('pumpkin', { tex: { top: 'pumpkin_top', side: 'pumpkin_side' }, hard: 1, tool: 'axe', snd: 'wood' });
def('carved_pumpkin', { tex: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face' }, facing: true, hard: 1, tool: 'axe', snd: 'wood' });
def('jack_o_lantern', { tex: { top: 'pumpkin_top', side: 'pumpkin_side', front: 'jack_o_lantern' }, facing: true, light: 15, hard: 1, tool: 'axe', snd: 'wood' });
def('melon', { tex: { top: 'melon_top', side: 'melon_side' }, hard: 1, tool: 'axe', snd: 'wood', drop: ['melon_slice', 3, 7] });
def('vine', { shape: R_VINE, tint: T_FOLIAGE, climb: true, repl: true, hard: 0.2, tool: 'shears', snd: 'grass', drop: null, plant: true });
def('lily_pad', { shape: R_LILY, tint: T_COLOR, color: 0x208030, hard: 0, snd: 'grass', plant: true, solid: true });
def('seagrass', { shape: R_CROSS, wlog: true, plant: true, repl: true, hard: 0, snd: 'grass', drop: null, opacity: 2, wave: 2 });
def('kelp', { shape: R_CROSS, wlog: true, plant: true, hard: 0, snd: 'grass', opacity: 2, wave: 2 });
// colored blocks
def('terracotta', { tex: 'terracotta', tint: T_COLOR, color: 0xA46A4E, hard: 1.25, tool: 'pick', req: true });
for (let i = 0; i < 16; i++) def(DYES[i] + '_terracotta', { tex: 'terracotta', tint: T_COLOR, color: TERRA_RGB[i], hard: 1.25, tool: 'pick', req: true, dye: i });
for (let i = 0; i < 16; i++) def(DYES[i] + '_wool', { tex: 'wool', tint: T_COLOR, color: DYE_RGB[i], hard: 0.8, tool: 'shears', snd: 'wool', dye: i, flam: true });
for (let i = 0; i < 16; i++) def(DYES[i] + '_stained_glass', { tex: 'stained_glass', layer: L_TRANS, opaque: false, cullself: true, tint: T_COLOR, color: DYE_RGB[i], hard: 0.3, snd: 'glass', drop: null, dye: i });
for (let i = 0; i < 16; i++) def(DYES[i] + '_carpet', { shape: R_CARPET, opaque: false, tex: 'wool', tint: T_COLOR, color: DYE_RGB[i], hard: 0.1, snd: 'wool', dye: i });
// building blocks
def('obsidian', { hard: 50, tool: 'pick', req: true, tier: 3 });
def('cobblestone', { hard: 2, tool: 'pick', req: true });
def('mossy_cobblestone', { hard: 2, tool: 'pick', req: true });
def('stone_bricks', { hard: 1.5, tool: 'pick', req: true });
def('mossy_stone_bricks', { hard: 1.5, tool: 'pick', req: true });
def('cracked_stone_bricks', { hard: 1.5, tool: 'pick', req: true });
def('chiseled_stone_bricks', { hard: 1.5, tool: 'pick', req: true });
def('smooth_stone', { hard: 2, tool: 'pick', req: true });
def('bricks', { hard: 2, tool: 'pick', req: true });
def('bookshelf', { tex: { top: 'oak_planks', side: 'bookshelf' }, hard: 1.5, tool: 'axe', snd: 'wood', drop: ['book', 3, 3], flam: true, fuel: 300 });
def('crafting_table', { tex: { top: 'crafting_table_top', bottom: 'oak_planks', side: 'crafting_table_side', front: 'crafting_table_front' }, facing: true, hard: 2.5, tool: 'axe', snd: 'wood', use: 'craft', fuel: 300 });
def('furnace', { tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, facing: true, hard: 3.5, tool: 'pick', req: true, use: 'furnace' });
def('lit_furnace', { tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front_on' }, facing: true, light: 13, hard: 3.5, tool: 'pick', req: true, drop: 'furnace', use: 'furnace', noItem: true });
def('chest', { shape: R_CHEST, opaque: false, tex: { top: 'chest_top', side: 'chest_side', front: 'chest_front' }, facing: true, hard: 2.5, tool: 'axe', snd: 'wood', use: 'chest', fuel: 300 });
def('glass', { layer: L_CUTOUT, opaque: false, cullself: true, hard: 0.3, snd: 'glass', drop: null });
def('glass_pane', { shape: R_PANE, tex: 'glass', hard: 0.3, snd: 'glass', drop: null });
def('torch', { shape: R_TORCH, light: 14, hard: 0, snd: 'wood', emissive: true, plant: true });
def('ladder', { shape: R_LADDER, climb: true, hard: 0.4, tool: 'axe', snd: 'wood', fuel: 300 });
for (const w of WOODS) def(w + '_fence', { shape: R_FENCE, tex: w + '_planks', hard: 2, tool: 'axe', snd: 'wood', fence: 1, fuel: 300 });
def('nether_brick_fence', { shape: R_FENCE, tex: 'nether_bricks', hard: 2, tool: 'pick', req: true, fence: 2 });
def('oak_fence_gate', { shape: R_GATE, tex: 'oak_planks', hard: 2, tool: 'axe', snd: 'wood', use: 'gate', fuel: 300 });
def('oak_door', { shape: R_DOOR, tex: 'oak_door_bottom', texx: ['oak_door_top', 'oak_door_bottom'], hard: 3, tool: 'axe', snd: 'wood', use: 'door' });
def('iron_door', { shape: R_DOOR, tex: 'iron_door_bottom', texx: ['iron_door_top', 'iron_door_bottom'], hard: 5, tool: 'pick', req: true, snd: 'metal', use: 'door', ironDoor: true });
def('oak_trapdoor', { shape: R_TRAPDOOR, tex: 'oak_trapdoor', hard: 3, tool: 'axe', snd: 'wood', use: 'trapdoor' });
def('red_bed', { shape: R_BED, opaque: false, tex: 'bed_side', texx: ['bed_top_head', 'bed_top_foot', 'bed_side', 'bed_end'], hard: 0.2, snd: 'wool', use: 'bed' });
def('tnt', { tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hard: 0, snd: 'grass', use: 'tnt' });
def('glowstone', { light: 15, hard: 0.3, snd: 'glass', drop: ['glowstone_dust', 2, 4], emissive: true });
// nether
def('netherrack', { hard: 0.4, tool: 'pick', req: true, snd: 'nether' });
def('soul_sand', { hard: 0.5, tool: 'shovel', snd: 'soul', slow: 0.4 });
def('soul_soil', { hard: 0.5, tool: 'shovel', snd: 'soul' });
def('nether_bricks', { hard: 2, tool: 'pick', req: true });
def('red_nether_bricks', { hard: 2, tool: 'pick', req: true });
def('nether_wart', { shape: R_CROP, tex: 'nether_wart_0', texx: ['nether_wart_0', 'nether_wart_1', 'nether_wart_2'], hard: 0, snd: 'grass', drop: 'custom', noItem: true, plant: true });
def('magma_block', { tex: 'magma', light: 3, hard: 0.5, tool: 'pick', req: true, emissive: true, dmg: 1 });
def('basalt', { tex: { side: 'basalt_side', end: 'basalt_top' }, axis: true, hard: 1.25, tool: 'pick', req: true });
def('blackstone', { tex: { top: 'blackstone_top', side: 'blackstone' }, hard: 1.5, tool: 'pick', req: true });
def('crimson_nylium', { tex: { top: 'crimson_nylium', bottom: 'netherrack', side: 'crimson_nylium_side' }, hard: 0.4, tool: 'pick', req: true, drop: 'netherrack', snd: 'nether' });
def('warped_nylium', { tex: { top: 'warped_nylium', bottom: 'netherrack', side: 'warped_nylium_side' }, hard: 0.4, tool: 'pick', req: true, drop: 'netherrack', snd: 'nether' });
def('crimson_stem', { tex: { side: 'crimson_stem', end: 'crimson_stem_top' }, axis: true, hard: 2, tool: 'axe', snd: 'wood' });
def('warped_stem', { tex: { side: 'warped_stem', end: 'warped_stem_top' }, axis: true, hard: 2, tool: 'axe', snd: 'wood' });
def('crimson_planks', { hard: 2, tool: 'axe', snd: 'wood' });
def('warped_planks', { hard: 2, tool: 'axe', snd: 'wood' });
def('nether_wart_block', { hard: 1, tool: 'hoe', snd: 'wool' });
def('warped_wart_block', { hard: 1, tool: 'hoe', snd: 'wool' });
def('shroomlight', { light: 15, hard: 1, tool: 'hoe', snd: 'wool', emissive: true });
def('crimson_fungus', { shape: R_CROSS, plant: true, hard: 0, snd: 'grass' });
def('warped_fungus', { shape: R_CROSS, plant: true, hard: 0, snd: 'grass' });
def('crimson_roots', { shape: R_CROSS, plant: true, repl: true, hard: 0, snd: 'grass', wave: 2 });
def('warped_roots', { shape: R_CROSS, plant: true, repl: true, hard: 0, snd: 'grass', wave: 2 });
def('nether_quartz_ore', { hard: 3, tool: 'pick', req: true, drop: 'quartz', xp: [2, 5], snd: 'nether' });
def('nether_gold_ore', { hard: 3, tool: 'pick', req: true, drop: ['gold_nugget', 2, 6], xp: [0, 1], snd: 'nether' });
def('quartz_block', { tex: { top: 'quartz_block_top', side: 'quartz_block_side' }, hard: 0.8, tool: 'pick', req: true });
def('nether_portal', { shape: R_PORTAL, layer: L_TRANS, opaque: false, tex: 'portal', light: 11, hard: -1, nosel: true, noItem: true, drop: null, emissive: true, anim: 3 });
def('fire', { shape: R_FIRE, tex: 'fire', light: 15, hard: 0, repl: true, nosel: true, noItem: true, drop: null, emissive: true });
def('iron_block', { hard: 5, tool: 'pick', req: true, tier: 1, snd: 'metal' });
def('gold_block', { hard: 3, tool: 'pick', req: true, tier: 2, snd: 'metal' });
def('diamond_block', { hard: 5, tool: 'pick', req: true, tier: 2, snd: 'metal' });
def('emerald_block', { hard: 5, tool: 'pick', req: true, tier: 2, snd: 'metal' });
def('lapis_block', { hard: 3, tool: 'pick', req: true, tier: 1 });
def('coal_block', { hard: 5, tool: 'pick', req: true, fuel: 16000 });
def('redstone_block', { hard: 5, tool: 'pick', req: true, snd: 'metal' });
def('hay_block', { tex: { side: 'hay_block_side', end: 'hay_block_top' }, axis: true, hard: 0.5, tool: 'hoe', snd: 'grass' });
def('bone_block', { tex: { side: 'bone_block_side', end: 'bone_block_top' }, axis: true, hard: 2, tool: 'pick', req: true });
def('cobweb', { shape: R_CROSS, hard: 4, tool: 'sword', snd: 'wool', drop: 'string', slow: 0.1 });
def('spawner', { layer: L_CUTOUT, opaque: false, hard: 5, tool: 'pick', req: true, drop: null, snd: 'metal', xp: [15, 43] });
def('rail', { shape: R_RAIL, hard: 0.7, tool: 'pick', snd: 'metal' });
def('stone_pressure_plate', { shape: R_PLATE, opaque: false, tex: 'stone', hard: 0.5, tool: 'pick', req: true });
def('wheat', { shape: R_CROP, tex: 'wheat_0', texx: ['wheat_0', 'wheat_1', 'wheat_2', 'wheat_3'], hard: 0, snd: 'grass', drop: 'custom', noItem: true, plant: true });
def('carrots', { shape: R_CROP, tex: 'carrots_0', texx: ['carrots_0', 'carrots_1', 'carrots_2', 'carrots_3'], hard: 0, snd: 'grass', drop: 'custom', noItem: true, plant: true });
def('potatoes', { shape: R_CROP, tex: 'potatoes_0', texx: ['potatoes_0', 'potatoes_1', 'potatoes_2', 'potatoes_3'], hard: 0, snd: 'grass', drop: 'custom', noItem: true, plant: true });
def('lantern', { shape: R_LANTERN, light: 15, hard: 3.5, tool: 'pick', snd: 'metal', emissive: true });
def('iron_bars', { shape: R_PANE, hard: 5, tool: 'pick', req: true, snd: 'metal' });
// slabs & stairs
const SLABS = [['stone_slab', 'smooth_stone'], ['cobblestone_slab', 'cobblestone'], ['oak_slab', 'oak_planks'], ['spruce_slab', 'spruce_planks'], ['birch_slab', 'birch_planks'],
  ['jungle_slab', 'jungle_planks'], ['acacia_slab', 'acacia_planks'], ['dark_oak_slab', 'dark_oak_planks'], ['stone_brick_slab', 'stone_bricks'], ['sandstone_slab', 'sandstone'],
  ['brick_slab', 'bricks'], ['nether_brick_slab', 'nether_bricks'], ['quartz_slab', 'quartz_block']];
for (const [n, base] of SLABS) { const bd = BLOCKS[B[base]]; def(n, { shape: R_SLAB, opaque: false, opacity: 15, texFrom: base, full: base, hard: bd.hard, tool: bd.tool, req: bd.req, snd: bd.snd, slab: true, fuel: bd.fuel ? 150 : 0 }); }
const STAIRS = [['oak_stairs', 'oak_planks'], ['cobblestone_stairs', 'cobblestone'], ['stone_brick_stairs', 'stone_bricks'], ['sandstone_stairs', 'sandstone'], ['spruce_stairs', 'spruce_planks'],
  ['brick_stairs', 'bricks'], ['nether_brick_stairs', 'nether_bricks'], ['acacia_stairs', 'acacia_planks'], ['dark_oak_stairs', 'dark_oak_planks'], ['birch_stairs', 'birch_planks'],
  ['jungle_stairs', 'jungle_planks'], ['quartz_stairs', 'quartz_block']];
for (const [n, base] of STAIRS) { const bd = BLOCKS[B[base]]; def(n, { shape: R_STAIRS, opaque: false, opacity: 15, texFrom: base, hard: bd.hard, tool: bd.tool, req: bd.req, snd: bd.snd, stairs: true, fuel: bd.fuel ? 300 : 0 }); }
// extra
def('soul_torch', { shape: R_TORCH, tex: 'soul_torch', light: 10, hard: 0, snd: 'wood', plant: true });
def('crying_obsidian', { hard: 50, tool: 'pick', req: true, tier: 3, light: 10, emissive: true });
def('barrel', { tex: { top: 'barrel_top', bottom: 'barrel_bottom', side: 'barrel_side' }, hard: 2.5, tool: 'axe', snd: 'wood', use: 'chest', fuel: 300 });
def('sea_lantern', { light: 15, hard: 0.3, snd: 'glass', emissive: true });
def('cauldron', { layer: L_CUTOUT, opaque: false, tex: { top: 'cauldron_top', bottom: 'cauldron_bottom', side: 'cauldron_side' }, hard: 2, tool: 'pick', req: true, snd: 'metal' });
def('mossy_cobblestone_wall', { shape: R_FENCE, tex: 'mossy_cobblestone', hard: 2, tool: 'pick', req: true, fence: 3 });
def('cobblestone_wall', { shape: R_FENCE, tex: 'cobblestone', hard: 2, tool: 'pick', req: true, fence: 3 });
// (continued in 11_blocks_more.js)
