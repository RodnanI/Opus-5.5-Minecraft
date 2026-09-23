// ============================================================================
//  Block registry, part 2: extended content.
//  Appended after the original blocks so existing ids never change (saves store raw block ids).
// ============================================================================
const CONCRETE_RGB = [0xCFD5D6, 0xE06101, 0xA9309F, 0x2489C7, 0xF1AF15, 0x5EA918, 0xD5658F, 0x373A3E, 0x7D7D73, 0x157788, 0x64209C, 0x2D2F8F, 0x603C20, 0x495B24, 0x8E2121, 0x121418];
const STONE_TOOL = { tool: 'pick', req: true };
const stoneDef = (hard, o) => Object.assign({ hard }, STONE_TOOL, o || {});
// ---- stone, deepslate, blackstone, quartz, sandstone and prismarine families
def('tuff', stoneDef(1.5));
def('calcite', stoneDef(0.75));
def('smooth_basalt', stoneDef(1.25));
def('dripstone_block', stoneDef(1.5));
def('polished_deepslate', stoneDef(3.5));
def('deepslate_bricks', stoneDef(3.5));
def('cracked_deepslate_bricks', stoneDef(3.5));
def('deepslate_tiles', stoneDef(3.5));
def('chiseled_deepslate', stoneDef(3.5));
def('polished_blackstone', stoneDef(2));
def('polished_blackstone_bricks', stoneDef(1.5));
def('cracked_polished_blackstone_bricks', stoneDef(1.5));
def('chiseled_polished_blackstone', stoneDef(1.5));
def('gilded_blackstone', stoneDef(1.5, { drop: 'custom' }));
def('polished_basalt', stoneDef(1.25, { tex: { side: 'polished_basalt_side', end: 'polished_basalt_top' }, axis: true }));
def('smooth_quartz', stoneDef(2));
def('quartz_bricks', stoneDef(0.8));
def('quartz_pillar', stoneDef(0.8, { tex: { side: 'quartz_pillar', end: 'quartz_pillar_top' }, axis: true }));
def('chiseled_quartz_block', stoneDef(0.8, { tex: { side: 'chiseled_quartz_block', end: 'chiseled_quartz_block_top' } }));
def('smooth_red_sandstone', stoneDef(2, { tex: 'red_sandstone_top' }));
def('cut_red_sandstone', stoneDef(0.8, { tex: { top: 'red_sandstone_top', side: 'cut_red_sandstone' } }));
def('chiseled_red_sandstone', stoneDef(0.8, { tex: { top: 'red_sandstone_top', side: 'chiseled_red_sandstone' } }));
def('prismarine', stoneDef(1.5));
def('prismarine_bricks', stoneDef(1.5));
def('dark_prismarine', stoneDef(1.5));
def('cracked_nether_bricks', stoneDef(2));
def('chiseled_nether_bricks', stoneDef(2));
def('mud', { hard: 0.5, tool: 'shovel', snd: 'soul' });
def('packed_mud', { hard: 1, tool: 'pick', snd: 'soul' });
def('mud_bricks', stoneDef(1.5, { snd: 'soul' }));
def('moss_block', { hard: 0.1, tool: 'hoe', snd: 'grass' });
def('rooted_dirt', { hard: 0.5, tool: 'shovel', snd: 'gravel' });
def('blue_ice', { hard: 2.8, tool: 'pick', snd: 'glass', slip: 0.989, drop: null });
def('tinted_glass', { layer: L_TRANS, opaque: false, opacity: 15, cullself: true, hard: 0.3, snd: 'glass' });
// ---- amethyst, copper, raw metal, netherite
def('amethyst_block', stoneDef(1.5, { snd: 'glass' }));
def('budding_amethyst', stoneDef(1.5, { snd: 'glass', drop: null }));
def('copper_ore', stoneDef(3, { tier: 1, drop: ['raw_copper', 2, 5], xp: [0, 1] }));
def('deepslate_copper_ore', stoneDef(4.5, { tier: 1, drop: ['raw_copper', 2, 5], xp: [0, 1] }));
def('copper_block', stoneDef(3, { tier: 1, snd: 'metal', oxidize: 'exposed_copper' }));
def('exposed_copper', stoneDef(3, { tier: 1, snd: 'metal', oxidize: 'weathered_copper', scrape: 'copper_block' }));
def('weathered_copper', stoneDef(3, { tier: 1, snd: 'metal', oxidize: 'oxidized_copper', scrape: 'exposed_copper' }));
def('oxidized_copper', stoneDef(3, { tier: 1, snd: 'metal', scrape: 'weathered_copper' }));
def('cut_copper', stoneDef(3, { tier: 1, snd: 'metal' }));
def('raw_iron_block', stoneDef(5, { tier: 1 }));
def('raw_copper_block', stoneDef(5, { tier: 1 }));
def('raw_gold_block', stoneDef(5, { tier: 2 }));
def('ancient_debris', stoneDef(30, { tier: 3, tex: { top: 'ancient_debris_top', side: 'ancient_debris_side' }, snd: 'nether' }));
def('netherite_block', stoneDef(50, { tier: 3, snd: 'metal' }));
// ---- light sources and odds & ends
for (const f of ['ochre', 'verdant', 'pearlescent']) def(f + '_froglight', { tex: { side: f + '_froglight_side', end: f + '_froglight_top' }, axis: true, light: 15, hard: 0.3, snd: 'wool', emissive: true });
def('redstone_lamp', { hard: 0.3, snd: 'glass', use: 'lamp' });
def('lit_redstone_lamp', { tex: 'redstone_lamp_on', light: 15, hard: 0.3, snd: 'glass', use: 'lamp', emissive: true, noItem: true, drop: 'redstone_lamp' });
def('sponge', { hard: 0.6, tool: 'hoe', snd: 'grass' });
def('wet_sponge', { hard: 0.6, tool: 'hoe', snd: 'grass' });
def('slime_block', { layer: L_TRANS, opaque: false, opacity: 1, cullself: true, hard: 0, snd: 'wool' });
def('dried_kelp_block', { tex: { top: 'dried_kelp_top', side: 'dried_kelp_side' }, hard: 0.5, tool: 'hoe', snd: 'grass', fuel: 4000, flam: true });
def('soul_lantern', { shape: R_LANTERN, light: 10, hard: 3.5, tool: 'pick', snd: 'metal', emissive: true });
def('campfire', { shape: R_CAMPFIRE, tex: 'campfire_log', texx: ['campfire_fire', 'campfire_log_lit'], light: 15, hard: 2, tool: 'axe', snd: 'wood', dmg: 1 });
def('soul_campfire', { shape: R_CAMPFIRE, tex: 'campfire_log', texx: ['soul_campfire_fire', 'campfire_log_lit'], light: 10, hard: 2, tool: 'axe', snd: 'wood', dmg: 2 });
def('chain', { shape: R_CROSS, hard: 5, tool: 'pick', req: true, snd: 'metal' });
def('blast_furnace', stoneDef(3.5, { tex: { top: 'blast_furnace_top', side: 'blast_furnace_side', front: 'blast_furnace_front' }, facing: true, use: 'furnace', furnace: 'ore' }));
def('lit_blast_furnace', stoneDef(3.5, { tex: { top: 'blast_furnace_top', side: 'blast_furnace_side', front: 'blast_furnace_front_on' }, facing: true, light: 13, use: 'furnace', furnace: 'ore', noItem: true, drop: 'blast_furnace' }));
def('smoker', stoneDef(3.5, { tex: { top: 'smoker_top', bottom: 'smoker_bottom', side: 'smoker_side', front: 'smoker_front' }, facing: true, use: 'furnace', furnace: 'food' }));
def('lit_smoker', stoneDef(3.5, { tex: { top: 'smoker_top', bottom: 'smoker_bottom', side: 'smoker_side', front: 'smoker_front_on' }, facing: true, light: 13, use: 'furnace', furnace: 'food', noItem: true, drop: 'smoker' }));
def('note_block', { hard: 0.8, tool: 'axe', snd: 'wood', use: 'note', fuel: 300 });
// ---- ocean
const CORALS = ['tube', 'brain', 'bubble', 'fire', 'horn'];
for (const c of CORALS) def(c + '_coral_block', stoneDef(1.5));
for (const c of CORALS) def(c + '_coral', { shape: R_CROSS, wlog: true, plant: true, hard: 0, snd: 'grass', opacity: 2, wave: 2 });
def('sea_pickle', { shape: R_CROSS, wlog: true, plant: true, light: 7, hard: 0, snd: 'wool', opacity: 2 });
// ---- dyed: concrete, concrete powder (sets into concrete next to water), stained glass panes
for (let i = 0; i < 16; i++) def(DYES[i] + '_concrete', stoneDef(1.8, { tex: 'concrete', tint: T_COLOR, color: CONCRETE_RGB[i], dye: i }));
for (let i = 0; i < 16; i++) def(DYES[i] + '_concrete_powder', { tex: 'concrete_powder', tint: T_COLOR, color: mixColor(CONCRETE_RGB[i], 0xFFFFFF, 0.18), hard: 0.5, tool: 'shovel', snd: 'sand', grav: true, dye: i, sets: DYES[i] + '_concrete' });
for (let i = 0; i < 16; i++) def(DYES[i] + '_stained_glass_pane', { shape: R_PANE, layer: L_TRANS, tex: 'stained_glass', tint: T_COLOR, color: DYE_RGB[i], hard: 0.3, snd: 'glass', drop: null, dye: i });
// ---- cherry wood, stripped logs, more doors / trapdoors / gates / fences
def('cherry_log', { tex: { side: 'cherry_log', end: 'cherry_log_top' }, axis: true, hard: 2, tool: 'axe', snd: 'wood', flam: true, fuel: 300 });
def('cherry_planks', { hard: 2, tool: 'axe', snd: 'wood', flam: true, fuel: 300 });
def('cherry_leaves', { layer: L_CUTOUT, opaque: false, opacity: 1, leaves: true, wave: 1, hard: 0.2, tool: 'hoe', snd: 'grass', drop: 'custom', flam: true });
def('cherry_sapling', { shape: R_CROSS, plant: true, hard: 0, snd: 'grass', wave: 2, fuel: 100 });
def('pink_petals', { shape: R_FLAT, plant: true, repl: true, hard: 0, snd: 'grass' });
const WOODS_ALL = [...WOODS, 'cherry'];
for (const w of WOODS_ALL) def('stripped_' + w + '_log', { tex: { side: 'stripped_' + w + '_log', end: 'stripped_' + w + '_log_top' }, axis: true, hard: 2, tool: 'axe', snd: 'wood', flam: true, fuel: 300 });
def('stripped_crimson_stem', { tex: { side: 'stripped_crimson_stem', end: 'stripped_crimson_stem_top' }, axis: true, hard: 2, tool: 'axe', snd: 'wood' });
def('stripped_warped_stem', { tex: { side: 'stripped_warped_stem', end: 'stripped_warped_stem_top' }, axis: true, hard: 2, tool: 'axe', snd: 'wood' });
const DOOR_WOODS = ['spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'cherry', 'crimson', 'warped'];
for (const w of DOOR_WOODS) def(w + '_door', { shape: R_DOOR, tex: w + '_door_bottom', texx: [w + '_door_top', w + '_door_bottom'], hard: 3, tool: 'axe', snd: 'wood', use: 'door' });
for (const w of DOOR_WOODS) def(w + '_trapdoor', { shape: R_TRAPDOOR, tex: w + '_trapdoor', hard: 3, tool: 'axe', snd: 'wood', use: 'trapdoor' });
for (const w of DOOR_WOODS) def(w + '_fence_gate', { shape: R_GATE, tex: w + '_planks', hard: 2, tool: 'axe', snd: 'wood', use: 'gate', fuel: w === 'crimson' || w === 'warped' ? 0 : 300 });
for (const w of ['cherry', 'crimson', 'warped']) def(w + '_fence', { shape: R_FENCE, tex: w + '_planks', hard: 2, tool: 'axe', snd: 'wood', fence: 1, fuel: w === 'cherry' ? 300 : 0 });
// ---- plants
const FLOWERS2 = ['orange_tulip', 'white_tulip', 'pink_tulip', 'torchflower'];
for (const f of FLOWERS2) def(f, { shape: R_CROSS, plant: true, wave: 2, hard: 0, snd: 'grass' });
def('sweet_berry_bush', { shape: R_CROSS, tex: 'sweet_berry_bush_3', texx: ['sweet_berry_bush_0', 'sweet_berry_bush_1', 'sweet_berry_bush_2', 'sweet_berry_bush_3'], metatex: true, plant: true, wave: 2, hard: 0, snd: 'grass', drop: 'custom', noItem: true, use: 'berries' });
def('beetroots', { shape: R_CROP, tex: 'beetroots_0', texx: ['beetroots_0', 'beetroots_1', 'beetroots_2', 'beetroots_3'], hard: 0, snd: 'grass', drop: 'custom', noItem: true, plant: true });
def('moss_carpet', { shape: R_CARPET, opaque: false, tex: 'moss_block', hard: 0.1, snd: 'grass' });
def('glow_lichen', { shape: R_VINE, light: 7, repl: true, hard: 0.2, tool: 'shears', snd: 'grass', drop: null, plant: true });
def('amethyst_cluster', { shape: R_CROSS, light: 5, hard: 1.5, tool: 'pick', snd: 'glass', drop: ['amethyst_shard', 2, 4] });
def('pointed_dripstone', { shape: R_CROSS, tex: 'pointed_dripstone_down', texx: ['pointed_dripstone_down', 'pointed_dripstone_up'], metatex: true, hard: 1.5, tool: 'pick', snd: 'stone' });
def('weeping_vines', { shape: R_CROSS, plant: true, climb: true, hard: 0, snd: 'grass', wave: 2 });
def('twisting_vines', { shape: R_CROSS, plant: true, climb: true, hard: 0, snd: 'grass', wave: 2 });
def('nether_sprouts', { shape: R_CROSS, plant: true, repl: true, hard: 0, snd: 'grass', wave: 2 });
// ---- more slabs, stairs and walls
const SLABS2 = [['granite_slab', 'granite'], ['polished_granite_slab', 'polished_granite'], ['diorite_slab', 'diorite'], ['polished_diorite_slab', 'polished_diorite'],
  ['andesite_slab', 'andesite'], ['polished_andesite_slab', 'polished_andesite'], ['mossy_cobblestone_slab', 'mossy_cobblestone'], ['mossy_stone_brick_slab', 'mossy_stone_bricks'],
  ['smooth_sandstone_slab', 'smooth_sandstone'], ['cut_sandstone_slab', 'cut_sandstone'], ['red_sandstone_slab', 'red_sandstone'], ['smooth_red_sandstone_slab', 'smooth_red_sandstone'],
  ['blackstone_slab', 'blackstone'], ['polished_blackstone_slab', 'polished_blackstone'], ['polished_blackstone_brick_slab', 'polished_blackstone_bricks'],
  ['cobbled_deepslate_slab', 'cobbled_deepslate'], ['polished_deepslate_slab', 'polished_deepslate'], ['deepslate_brick_slab', 'deepslate_bricks'], ['deepslate_tile_slab', 'deepslate_tiles'],
  ['prismarine_slab', 'prismarine'], ['prismarine_brick_slab', 'prismarine_bricks'], ['dark_prismarine_slab', 'dark_prismarine'], ['crimson_slab', 'crimson_planks'], ['warped_slab', 'warped_planks'],
  ['cherry_slab', 'cherry_planks'], ['mud_brick_slab', 'mud_bricks'], ['red_nether_brick_slab', 'red_nether_bricks'], ['smooth_quartz_slab', 'smooth_quartz'], ['cut_copper_slab', 'cut_copper'], ['tuff_slab', 'tuff']];
for (const [n, base] of SLABS2) { const bd = BLOCKS[B[base]]; def(n, { shape: R_SLAB, opaque: false, opacity: 15, texFrom: base, full: base, hard: bd.hard, tool: bd.tool, req: bd.req, snd: bd.snd, slab: true, fuel: bd.fuel ? 150 : 0 }); }
const STAIRS2 = [['granite_stairs', 'granite'], ['polished_granite_stairs', 'polished_granite'], ['diorite_stairs', 'diorite'], ['polished_diorite_stairs', 'polished_diorite'],
  ['andesite_stairs', 'andesite'], ['polished_andesite_stairs', 'polished_andesite'], ['mossy_cobblestone_stairs', 'mossy_cobblestone'], ['mossy_stone_brick_stairs', 'mossy_stone_bricks'],
  ['smooth_sandstone_stairs', 'smooth_sandstone'], ['red_sandstone_stairs', 'red_sandstone'], ['smooth_red_sandstone_stairs', 'smooth_red_sandstone'],
  ['blackstone_stairs', 'blackstone'], ['polished_blackstone_stairs', 'polished_blackstone'], ['polished_blackstone_brick_stairs', 'polished_blackstone_bricks'],
  ['cobbled_deepslate_stairs', 'cobbled_deepslate'], ['polished_deepslate_stairs', 'polished_deepslate'], ['deepslate_brick_stairs', 'deepslate_bricks'], ['deepslate_tile_stairs', 'deepslate_tiles'],
  ['prismarine_stairs', 'prismarine'], ['prismarine_brick_stairs', 'prismarine_bricks'], ['dark_prismarine_stairs', 'dark_prismarine'], ['crimson_stairs', 'crimson_planks'], ['warped_stairs', 'warped_planks'],
  ['cherry_stairs', 'cherry_planks'], ['mud_brick_stairs', 'mud_bricks'], ['red_nether_brick_stairs', 'red_nether_bricks'], ['smooth_quartz_stairs', 'smooth_quartz'], ['cut_copper_stairs', 'cut_copper'], ['tuff_stairs', 'tuff']];
for (const [n, base] of STAIRS2) { const bd = BLOCKS[B[base]]; def(n, { shape: R_STAIRS, opaque: false, opacity: 15, texFrom: base, hard: bd.hard, tool: bd.tool, req: bd.req, snd: bd.snd, stairs: true, fuel: bd.fuel ? 300 : 0 }); }
const WALLS2 = [['granite_wall', 'granite'], ['diorite_wall', 'diorite'], ['andesite_wall', 'andesite'], ['stone_brick_wall', 'stone_bricks'], ['mossy_stone_brick_wall', 'mossy_stone_bricks'],
  ['brick_wall', 'bricks'], ['sandstone_wall', 'sandstone'], ['red_sandstone_wall', 'red_sandstone'], ['nether_brick_wall', 'nether_bricks'], ['red_nether_brick_wall', 'red_nether_bricks'],
  ['blackstone_wall', 'blackstone'], ['polished_blackstone_wall', 'polished_blackstone'], ['polished_blackstone_brick_wall', 'polished_blackstone_bricks'], ['cobbled_deepslate_wall', 'cobbled_deepslate'],
  ['polished_deepslate_wall', 'polished_deepslate'], ['deepslate_brick_wall', 'deepslate_bricks'], ['deepslate_tile_wall', 'deepslate_tiles'], ['prismarine_wall', 'prismarine'], ['mud_brick_wall', 'mud_bricks'], ['tuff_wall', 'tuff']];
for (const [n, base] of WALLS2) { const bd = BLOCKS[B[base]]; def(n, { shape: R_FENCE, tex: TEXN[TEX[B[base] * 6]], hard: bd.hard, tool: bd.tool, req: bd.req, snd: bd.snd, fence: 3 }); }

// destroy-stage overlay textures (not blocks)
for (let i = 0; i < 10; i++) tx('destroy_' + i);

const NBLOCKS = BLOCKS.length;
const METATEX = new Uint8Array(MAXB);
for (const b of BLOCKS) if (b.metatex) METATEX[b.id] = 1;
// light-transmitting "full" collision check helpers
function isFullCube(id) { return SHAPE[id] === R_CUBE; }
function blockName(id) { return BLOCKS[id] ? BLOCKS[id].name : '?'; }
