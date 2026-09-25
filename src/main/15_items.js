// ============================================================================
//  Items, recipes, smelting, fuel, loot tables and villager trades
// ============================================================================
const ITEMS = [], I = Object.create(null);
let _nextItem = 1000;
const FLAT_BLOCK_SHAPES = new Set([R_CROSS, R_TORCH, R_LADDER, R_VINE, R_RAIL, R_LILY, R_LANTERN, R_PANE, R_DOOR, R_BED, R_FIRE, R_PORTAL, R_FLAT]);
for (const b of BLOCKS) {
  if (b.id === 0 || b.noItem) continue;
  const it = { id: b.id, name: b.name, block: b.id, stack: 64, fuel: b.fuel || 0 };
  if (FLAT_BLOCK_SHAPES.has(b.shape)) it.flat = 'b:' + TEXN[TEX[b.id * 6]];
  ITEMS[b.id] = it; I[b.name] = b.id;
}
ITEMS[B.oak_door].flat = 'i:oak_door_item'; ITEMS[B.iron_door].flat = 'i:iron_door_item'; ITEMS[B.red_bed].flat = 'i:bed_item'; ITEMS[B.red_bed].stack = 1;
ITEMS[B.sugar_cane].flat = 'i:sugar_cane_item';
ITEMS[B.lantern].flat = 'b:lantern'; ITEMS[B.glass_pane].flat = 'b:glass'; ITEMS[B.iron_bars].flat = 'b:iron_bars';
for (const w of DOOR_WOODS) ITEMS[B[w + '_door']].flat = 'i:' + w + '_door_item';
ITEMS[B.campfire].flat = 'i:campfire_item'; ITEMS[B.soul_campfire].flat = 'i:soul_campfire_item';
ITEMS[B.pointed_dripstone].flat = 'b:pointed_dripstone_up'; ITEMS[B.soul_lantern].flat = 'b:soul_lantern';
function defItem(name, o) { const id = _nextItem++; ITEMS[id] = Object.assign({ id, name, stack: 64, flat: 'i:' + (o && o.tex || name) }, o); I[name] = id; return id; }
const TIERS = { wooden: [0, 2, 59], stone: [1, 4, 131], iron: [2, 6, 250], golden: [0, 12, 32], diamond: [3, 8, 1561] };
const TOOL_DMG = { sword: [4, 5, 6, 4, 7], axe: [7, 9, 9, 7, 9], pickaxe: [2, 3, 4, 2, 5], shovel: [2.5, 3.5, 4.5, 2.5, 5.5], hoe: [1, 1, 1, 1, 1] };
const MAT_ORDER = ['wooden', 'stone', 'iron', 'golden', 'diamond'];
const TOOL_TYPE = { sword: 'sword', pickaxe: 'pick', axe: 'axe', shovel: 'shovel', hoe: 'hoe' };
const MATERIAL_ITEM = {};
['stick', 'coal', 'charcoal', 'iron_ingot', 'gold_ingot', 'diamond', 'emerald', 'lapis_lazuli', 'redstone', 'quartz', 'flint', 'gold_nugget', 'iron_nugget', 'bone', 'bone_meal',
  'string', 'feather', 'gunpowder', 'leather', 'brick', 'nether_brick', 'clay_ball', 'snowball', 'paper', 'book', 'sugar', 'glowstone_dust', 'magma_cream', 'slime_ball', 'bowl', 'wheat', 'egg'].forEach(n => defItem(n, n === 'snowball' || n === 'egg' ? { stack: 16, use: 'throw' } : {}));
ITEMS[I.coal].fuel = 1600; ITEMS[I.charcoal].fuel = 1600; ITEMS[I.stick].fuel = 100; ITEMS[I.bowl].fuel = 100;
ITEMS[I.bone_meal].use = 'bonemeal';
for (const k of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) MAT_ORDER.forEach((m, mi) => {
  const t = TIERS[m];
  defItem(m + '_' + k, { stack: 1, tool: { type: TOOL_TYPE[k], tier: t[0], speed: t[1], dmg: TOOL_DMG[k][mi] }, dur: t[2], fuel: m === 'wooden' ? 200 : 0, use: k === 'hoe' ? 'hoe' : k === 'shovel' ? 'shovel' : k === 'axe' ? 'axe' : null });
});
const ARMOR_DEF = { leather: [[1, 3, 2, 1], [55, 80, 75, 65], 0], iron: [[2, 6, 5, 2], [165, 240, 225, 195], 0], golden: [[2, 5, 3, 1], [77, 112, 105, 91], 0], diamond: [[3, 8, 6, 3], [363, 528, 495, 429], 2] };
['helmet', 'chestplate', 'leggings', 'boots'].forEach((p, slot) => { for (const m in ARMOR_DEF) { const a = ARMOR_DEF[m]; defItem(m + '_' + p, { stack: 1, armor: { slot, def: a[0][slot], tough: a[2], mat: m }, dur: a[1][slot] }); } });
defItem('bow', { stack: 1, dur: 384, use: 'bow', fuel: 300 });
defItem('arrow', {});
defItem('shears', { stack: 1, dur: 238, tool: { type: 'shears', tier: 0, speed: 1.5, dmg: 1 }, use: 'shears' });
defItem('flint_and_steel', { stack: 1, dur: 64, use: 'ignite' });
defItem('fire_charge', { use: 'ignite_charge' });
defItem('bucket', { stack: 16, use: 'bucket' });
defItem('water_bucket', { stack: 1, use: 'bucket_place', fluid: 'water' });
defItem('lava_bucket', { stack: 1, use: 'bucket_place', fluid: 'lava', fuel: 20000 });
defItem('milk_bucket', { stack: 1, use: 'drink', food: [0, 0], eatTime: 32 });
const FOODS = { apple: [4, 2.4], golden_apple: [4, 9.6], bread: [5, 6], carrot: [3, 3.6], potato: [1, 0.6], baked_potato: [5, 6], porkchop: [3, 1.8], cooked_porkchop: [8, 12.8], beef: [3, 1.8], cooked_beef: [8, 12.8],
  mutton: [2, 1.2], cooked_mutton: [6, 9.6], chicken: [2, 1.2], cooked_chicken: [6, 7.2], rotten_flesh: [4, 0.8], melon_slice: [2, 1.2], pumpkin_pie: [8, 4.8], cookie: [2, 0.4], dried_kelp: [1, 0.6], mushroom_stew: [6, 7.2] };
for (const f in FOODS) defItem(f, { food: FOODS[f], stack: f === 'mushroom_stew' ? 1 : 64 });
ITEMS[I.carrot].place = B.carrots; ITEMS[I.potato].place = B.potatoes;
defItem('wheat_seeds', { place: B.wheat });
defItem('nether_wart_item', { place: B.nether_wart, disp: 'Nether Wart', tex: 'nether_wart_item' });
defItem('ember_rod', { fuel: 2400, disp: 'Ember Rod' });
defItem('stormcrow_jet', { stack: 1, use: 'vehicle', vehicle: 'jet', disp: 'Stormcrow Interceptor', tex: 'veh_jet' });
defItem('mantis_gunship', { stack: 1, use: 'vehicle', vehicle: 'gunship', disp: 'Mantis VTOL Gunship', tex: 'veh_gunship' });
defItem('viper_bike', { stack: 1, use: 'vehicle', vehicle: 'bike', disp: 'Viper Hover Bike', tex: 'veh_bike' });
defItem('wraith_bomber', { stack: 1, use: 'vehicle', vehicle: 'bomber', disp: 'Wraith Flying-Wing Bomber', tex: 'veh_bomber' });
defItem('bastion_tank', { stack: 1, use: 'vehicle', vehicle: 'tank', disp: 'Bastion Hover Tank', tex: 'veh_tank' });
for (let i = 0; i < 16; i++) defItem(DYES[i] + '_dye', { tex: 'dye', tint: DYE_RGB[i], dye: i });
const MOB_EGGS = { pig: [0xF0A5A2, 0xDB635F], cow: [0x443626, 0xA1A1A1], sheep: [0xE7E7E7, 0xFFB5B5], chicken: [0xA1A1A1, 0xFF0000], villager: [0x8E6A4A, 0x3A6A3A], zombie: [0x2E6E5A, 0x6A8A4A],
  skeleton: [0xC1C1C1, 0x494949], spider: [0x342D27, 0xA80E0E], boomcap: [0xC8322A, 0xF0E6D2], witch: [0x340000, 0x51A03E], imp: [0xE85A1A, 0xFFD24A], cinder_slime: [0x3A1A0A, 0xFF8A1E], ashen_skeleton: [0x2A2A2A, 0x5A5A5A], ghoul: [0x6A6A6A, 0xE8741E], iron_golem: [0xDAD2C8, 0x74A332] };
for (const m in MOB_EGGS) defItem('spawn_egg_' + m, { tex: 'spawn_egg', tint: MOB_EGGS[m][0], tint2: MOB_EGGS[m][1], use: 'spawn_egg', mob: m, disp: titleCase(m) + ' Spawn Egg', creativeOnly: true });
ITEMS[I.ember_rod].disp = 'Ember Rod';
// ---- extended items (appended: item ids follow definition order and are stored in saves)
['raw_iron', 'raw_copper', 'raw_gold', 'copper_ingot', 'amethyst_shard', 'netherite_scrap', 'netherite_ingot', 'prismarine_shard', 'prismarine_crystals'].forEach(n => defItem(n, {}));
const NETH_DMG = { sword: 8, axe: 10, pickaxe: 6, shovel: 6.5, hoe: 1 };
for (const k of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) defItem('netherite_' + k, { stack: 1, tool: { type: TOOL_TYPE[k], tier: 4, speed: 9, dmg: NETH_DMG[k] }, dur: 2031, use: k === 'hoe' ? 'hoe' : k === 'shovel' ? 'shovel' : k === 'axe' ? 'axe' : null });
const ARMOR_DEF2 = { netherite: [[3, 8, 6, 3], [407, 592, 555, 481], 3], chainmail: [[2, 5, 4, 1], [165, 240, 225, 195], 0] };
['helmet', 'chestplate', 'leggings', 'boots'].forEach((p, slot) => { for (const m in ARMOR_DEF2) { const a = ARMOR_DEF2[m]; defItem(m + '_' + p, { stack: 1, armor: { slot, def: a[0][slot], tough: a[2], mat: m }, dur: a[1][slot] }); } });
defItem('spyglass', { stack: 1, use: 'spyglass' });
defItem('compass', { stack: 1, info: 'compass' });
defItem('clock', { stack: 1, info: 'clock' });
defItem('ender_pearl', { stack: 16, use: 'throw' });
defItem('fishing_rod', { stack: 1, dur: 64, use: 'fish', fuel: 300 });
const FOODS2 = { beetroot: [1, 1.2], beetroot_soup: [6, 7.2], sweet_berries: [2, 0.4], golden_carrot: [6, 14.4], cod: [2, 0.4], salmon: [2, 0.4], cooked_cod: [5, 6], cooked_salmon: [6, 9.6], tropical_fish: [1, 0.2] };
for (const f in FOODS2) defItem(f, { food: FOODS2[f], stack: f === 'beetroot_soup' ? 1 : 64 });
defItem('beetroot_seeds', { place: B.beetroots });
ITEMS[I.sweet_berries].place = B.sweet_berry_bush;
// ---- the End (appended after everything above so saved item ids stay put)
defItem('ember_powder', { disp: 'Ember Powder' });
defItem('eye_of_ender', { use: 'eye', disp: 'Eye of Ender' });
defItem('chorus_fruit', { food: [4, 2.4] });
defItem('popped_chorus_fruit', {});
defItem('end_crystal', { use: 'crystal', disp: 'End Crystal' });
defItem('elytra', { stack: 1, dur: 432, armor: { slot: 1, def: 0, tough: 0, mat: 'elytra' }, glider: true });
defItem('firework_rocket', { use: 'firework' });
defItem('spawn_egg_enderman', { tex: 'spawn_egg', tint: 0x161616, tint2: 0x9A3AE0, use: 'spawn_egg', mob: 'enderman', disp: 'Enderman Spawn Egg', creativeOnly: true });
defItem('titan_mech', { stack: 1, use: 'vehicle', vehicle: 'mech', disp: 'Titan Assault Mech', tex: 'veh_mech' });
defItem('nautilus_sub', { stack: 1, use: 'vehicle', vehicle: 'sub', disp: 'Nautilus Submarine', tex: 'veh_sub' });
defItem('mole_drill', { stack: 1, use: 'vehicle', vehicle: 'drill', disp: 'Mole Tunnel Borer', tex: 'veh_drill' });
ITEMS[B.end_rod].flat = 'i:end_rod_item';
// a carved pumpkin can be worn: endermen cannot meet your eyes through it
ITEMS[B.carved_pumpkin].armor = { slot: 0, def: 0, tough: 0, mat: 'pumpkin' };
const EMPTY_ON_EAT = { mushroom_stew: 'bowl', beetroot_soup: 'bowl' };
// crafting ingredients that leave a container behind in the grid
const CRAFT_REMAINS = { water_bucket: 'bucket', lava_bucket: 'bucket', milk_bucket: 'bucket' };
function itemDef(id) { return ITEMS[id]; }
function itemName(id) { const d = ITEMS[id]; if (!d) return '?'; return d.disp || titleCase(d.name.replace(/_item$/, '')); }
function maxStack(id) { const d = ITEMS[id]; return d ? d.stack : 64; }
function isBlockItem(id) { return id < 1000 && ITEMS[id] && ITEMS[id].block !== undefined; }

// ------------------------------------------------------------------- tags
const TAGS = {
  '#planks': new Set([...WOODS_ALL.map(w => B[w + '_planks']), B.crimson_planks, B.warped_planks]),
  '#logs': new Set([...WOODS_ALL.map(w => B[w + '_log']), ...WOODS_ALL.map(w => B['stripped_' + w + '_log']), B.crimson_stem, B.warped_stem, B.stripped_crimson_stem, B.stripped_warped_stem]),
  '#wool': new Set(DYES.map(d => B[d + '_wool'])),
  '#coal': new Set([I.coal, I.charcoal]),
  '#stone_tool': new Set([B.cobblestone, B.cobbled_deepslate, B.blackstone]),
  '#wooden_slab': new Set(['oak_slab', 'spruce_slab', 'birch_slab', 'jungle_slab', 'acacia_slab', 'dark_oak_slab', 'cherry_slab', 'crimson_slab', 'warped_slab'].map(n => B[n])),
  '#sand': new Set([B.sand, B.red_sand]),
  '#soul': new Set([B.soul_sand, B.soul_soil]),
};
function ingMatch(ing, id) { if (ing === null) return id === 0; if (typeof ing === 'string') return TAGS[ing] ? TAGS[ing].has(id) : false; return ing === id; }
function resolveIng(s) { if (s === undefined || s === null) return null; if (s[0] === '#') return s; const id = I[s]; if (id === undefined) throw new Error('Unknown ingredient ' + s); return id; }

// ---------------------------------------------------------------- recipes
const RECIPES = [];
function shaped(out, n, pattern, key) {
  const h = pattern.length, w = Math.max(...pattern.map(r => r.length));
  const grid = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = pattern[y][x]; grid.push(ch === undefined || ch === ' ' ? null : resolveIng(key[ch])); }
  if (I[out] === undefined) throw new Error('Unknown recipe output ' + out);
  RECIPES.push({ type: 'shaped', out: I[out], n, w, h, grid });
}
function shapeless(out, n, ings) {
  if (I[out] === undefined) throw new Error('Unknown recipe output ' + out);
  RECIPES.push({ type: 'shapeless', out: I[out], n, ings: ings.map(resolveIng) });
}
(function defineRecipes() {
  for (const w of WOODS) {
    shapeless(w + '_planks', 4, [w + '_log']);
    shaped(w + '_fence', 3, ['PSP', 'PSP'], { P: w + '_planks', S: 'stick' });
  }
  shapeless('crimson_planks', 4, ['crimson_stem']); shapeless('warped_planks', 4, ['warped_stem']);
  shaped('oak_fence_gate', 1, ['SPS', 'SPS'], { P: 'oak_planks', S: 'stick' });
  shaped('stick', 4, ['P', 'P'], { P: '#planks' });
  shaped('crafting_table', 1, ['PP', 'PP'], { P: '#planks' });
  shaped('chest', 1, ['PPP', 'P P', 'PPP'], { P: '#planks' });
  shaped('barrel', 1, ['PSP', 'P P', 'PSP'], { P: '#planks', S: '#wooden_slab' });
  shaped('furnace', 1, ['CCC', 'C C', 'CCC'], { C: '#stone_tool' });
  shaped('torch', 4, ['C', 'S'], { C: '#coal', S: 'stick' });
  shaped('soul_torch', 4, ['C', 'S', 'X'], { C: '#coal', S: 'stick', X: '#soul' });
  shaped('ladder', 3, ['S S', 'SSS', 'S S'], { S: 'stick' });
  shaped('oak_door', 3, ['PP', 'PP', 'PP'], { P: 'oak_planks' });
  shaped('iron_door', 3, ['II', 'II', 'II'], { I: 'iron_ingot' });
  shaped('oak_trapdoor', 2, ['PPP', 'PPP'], { P: 'oak_planks' });
  shaped('red_bed', 1, ['WWW', 'PPP'], { W: '#wool', P: '#planks' });
  shaped('bowl', 4, ['P P', ' P '], { P: '#planks' });
  const toolMat = { wooden: '#planks', stone: '#stone_tool', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
  for (const m in toolMat) {
    const k = { M: toolMat[m], S: 'stick' };
    shaped(m + '_pickaxe', 1, ['MMM', ' S ', ' S '], k); shaped(m + '_axe', 1, ['MM', 'MS', ' S'], k);
    shaped(m + '_shovel', 1, ['M', 'S', 'S'], k); shaped(m + '_hoe', 1, ['MM', ' S', ' S'], k); shaped(m + '_sword', 1, ['M', 'M', 'S'], k);
  }
  const armMat = { leather: 'leather', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
  for (const m in armMat) {
    const k = { M: armMat[m] };
    shaped(m + '_helmet', 1, ['MMM', 'M M'], k); shaped(m + '_chestplate', 1, ['M M', 'MMM', 'MMM'], k);
    shaped(m + '_leggings', 1, ['MMM', 'M M', 'M M'], k); shaped(m + '_boots', 1, ['M M', 'M M'], k);
  }
  shaped('bow', 1, [' TS', 'T S', ' TS'], { T: 'stick', S: 'string' });
  shaped('arrow', 4, ['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' });
  shaped('bucket', 1, ['I I', ' I '], { I: 'iron_ingot' });
  shapeless('flint_and_steel', 1, ['iron_ingot', 'flint']);
  shaped('shears', 1, [' I', 'I '], { I: 'iron_ingot' });
  shaped('bread', 1, ['WWW'], { W: 'wheat' });
  shapeless('mushroom_stew', 1, ['bowl', 'brown_mushroom', 'red_mushroom']);
  shapeless('pumpkin_pie', 1, ['pumpkin', 'sugar', 'egg']);
  shaped('cookie', 8, ['WSW'], { W: 'wheat', S: 'sugar' });
  shapeless('sugar', 1, ['sugar_cane']);
  shaped('paper', 3, ['CCC'], { C: 'sugar_cane' });
  shapeless('book', 1, ['paper', 'paper', 'paper', 'leather']);
  shaped('bookshelf', 1, ['PPP', 'BBB', 'PPP'], { P: '#planks', B: 'book' });
  shaped('tnt', 1, ['GSG', 'SGS', 'GSG'], { G: 'gunpowder', S: '#sand' });
  shaped('glass_pane', 16, ['GGG', 'GGG'], { G: 'glass' });
  shaped('iron_bars', 16, ['III', 'III'], { I: 'iron_ingot' });
  shaped('stone_bricks', 4, ['SS', 'SS'], { S: 'stone' });
  shapeless('mossy_stone_bricks', 1, ['stone_bricks', 'vine']);
  shapeless('mossy_cobblestone', 1, ['cobblestone', 'vine']);
  shaped('chiseled_stone_bricks', 1, ['S', 'S'], { S: 'stone_brick_slab' });
  shaped('bricks', 1, ['BB', 'BB'], { B: 'brick' });
  shaped('nether_bricks', 1, ['BB', 'BB'], { B: 'nether_brick' });
  shaped('red_nether_bricks', 1, ['WB', 'BW'], { W: 'nether_wart_item', B: 'nether_brick' });
  shaped('nether_brick_fence', 6, ['NBN', 'NBN'], { N: 'nether_bricks', B: 'nether_brick' });
  shaped('sandstone', 1, ['SS', 'SS'], { S: 'sand' });
  shaped('red_sandstone', 1, ['SS', 'SS'], { S: 'red_sand' });
  shaped('cut_sandstone', 4, ['SS', 'SS'], { S: 'sandstone' });
  shaped('chiseled_sandstone', 1, ['S', 'S'], { S: 'sandstone_slab' });
  shaped('polished_granite', 4, ['GG', 'GG'], { G: 'granite' });
  shaped('polished_diorite', 4, ['GG', 'GG'], { G: 'diorite' });
  shaped('polished_andesite', 4, ['GG', 'GG'], { G: 'andesite' });
  shapeless('granite', 1, ['diorite', 'quartz']);
  shaped('diorite', 2, ['CQ', 'QC'], { C: 'cobblestone', Q: 'quartz' });
  shapeless('andesite', 2, ['diorite', 'cobblestone']);
  shaped('snow', 1, ['SS', 'SS'], { S: 'snowball' });
  shaped('snow_layer', 6, ['SSS'], { S: 'snow' });
  shaped('clay', 1, ['CC', 'CC'], { C: 'clay_ball' });
  shaped('white_wool', 1, ['SS', 'SS'], { S: 'string' });
  shaped('packed_ice', 1, ['III', 'III', 'III'], { I: 'ice' });
  for (let i = 0; i < 16; i++) {
    const d = DYES[i];
    if (d !== 'white') shapeless(d + '_wool', 1, [d + '_dye', '#wool']);
    shaped(d + '_carpet', 3, ['WW'], { W: d + '_wool' });
    shaped(d + '_stained_glass', 8, ['GGG', 'GDG', 'GGG'], { G: 'glass', D: d + '_dye' });
    shaped(d + '_terracotta', 8, ['TTT', 'TDT', 'TTT'], { T: 'terracotta', D: d + '_dye' });
  }
  const dyeSrc = { yellow: ['dandelion'], red: ['poppy', 'red_tulip'], light_blue: ['blue_orchid'], magenta: ['allium'], light_gray: ['azure_bluet', 'oxeye_daisy'], blue: ['cornflower', 'lapis_lazuli'], white: ['lily_of_the_valley', 'bone_meal'], black: ['coal'], brown: ['brown_mushroom'] };
  for (const d in dyeSrc) for (const s of dyeSrc[d]) shapeless(d + '_dye', s === 'lapis_lazuli' || s === 'bone_meal' || s === 'coal' ? 1 : 1, [s]);
  const mixes = [['orange', 'red', 'yellow'], ['lime', 'green', 'white'], ['pink', 'red', 'white'], ['gray', 'black', 'white'], ['light_gray', 'gray', 'white'], ['cyan', 'blue', 'green'], ['purple', 'red', 'blue'], ['magenta', 'purple', 'pink'], ['light_blue', 'blue', 'white']];
  for (const [o, a, b] of mixes) shapeless(o + '_dye', 2, [a + '_dye', b + '_dye']);
  shapeless('bone_meal', 3, ['bone']);
  const storage = [['iron_block', 'iron_ingot'], ['gold_block', 'gold_ingot'], ['diamond_block', 'diamond'], ['emerald_block', 'emerald'], ['lapis_block', 'lapis_lazuli'], ['coal_block', 'coal'], ['redstone_block', 'redstone'], ['hay_block', 'wheat'], ['bone_block', 'bone_meal']];
  for (const [bl, it] of storage) { shaped(bl, 1, ['MMM', 'MMM', 'MMM'], { M: it }); shapeless(it, 9, [bl]); }
  shaped('gold_ingot', 1, ['NNN', 'NNN', 'NNN'], { N: 'gold_nugget' }); shapeless('gold_nugget', 9, ['gold_ingot']);
  shaped('iron_ingot', 1, ['NNN', 'NNN', 'NNN'], { N: 'iron_nugget' }); shapeless('iron_nugget', 9, ['iron_ingot']);
  shaped('quartz_block', 1, ['QQ', 'QQ'], { Q: 'quartz' });
  shaped('glowstone', 1, ['GG', 'GG'], { G: 'glowstone_dust' });
  shapeless('carved_pumpkin', 1, ['pumpkin']);
  shaped('jack_o_lantern', 1, ['P', 'T'], { P: 'carved_pumpkin', T: 'torch' });
  shaped('golden_apple', 1, ['GGG', 'GAG', 'GGG'], { G: 'gold_ingot', A: 'apple' });
  shaped('rail', 16, ['I I', 'ISI', 'I I'], { I: 'iron_ingot', S: 'stick' });
  shaped('lantern', 1, ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'torch' });
  shaped('stone_pressure_plate', 1, ['SS'], { S: 'stone' });
  shaped('cauldron', 1, ['I I', 'I I', 'III'], { I: 'iron_ingot' });
  shaped('sea_lantern', 1, ['QGQ', 'GGG', 'QGQ'], { Q: 'quartz', G: 'glowstone_dust' });
  shaped('cobblestone_wall', 6, ['CCC', 'CCC'], { C: 'cobblestone' });
  shaped('mossy_cobblestone_wall', 6, ['CCC', 'CCC'], { C: 'mossy_cobblestone' });
  shaped('magma_block', 1, ['MM', 'MM'], { M: 'magma_cream' });
  shapeless('fire_charge', 3, ['gunpowder', 'ember_rod', '#coal']);
  shaped('viper_bike', 1, [' R ', 'IDI', 'G G'], { R: 'redstone', I: 'iron_ingot', D: 'diamond', G: 'glowstone_dust' });
  shaped('stormcrow_jet', 1, ['IGI', 'DRD', 'IPI'], { I: 'iron_ingot', G: 'glass', D: 'diamond', R: 'redstone', P: 'gunpowder' });
  shaped('mantis_gunship', 1, ['DGD', 'IRI', 'IPI'], { I: 'iron_ingot', G: 'glass', D: 'diamond', R: 'redstone', P: 'gunpowder' });
  shaped('wraith_bomber', 1, ['DGD', 'IRI', 'PPP'], { I: 'iron_ingot', G: 'glass', D: 'diamond', R: 'redstone', P: 'gunpowder' });
  shaped('bastion_tank', 1, ['IRI', 'DID', 'GPG'], { I: 'iron_ingot', D: 'diamond', R: 'redstone', G: 'glowstone_dust', P: 'gunpowder' });
  shaped('titan_mech', 1, ['GDG', 'IRI', 'PIP'], { G: 'glowstone_dust', D: 'diamond', I: 'iron_ingot', R: 'redstone', P: 'gunpowder' });
  shaped('nautilus_sub', 1, ['IGI', 'IDI', 'KRK'], { I: 'iron_ingot', G: 'glass', D: 'diamond', K: 'kelp', R: 'redstone' });
  shaped('mole_drill', 1, ['DI ', 'IRI', 'III'], { D: 'diamond', I: 'iron_ingot', R: 'redstone' });
  for (const [n, base] of SLABS) shaped(n, 6, ['MMM'], { M: base });
  for (const [n, base] of STAIRS) shaped(n, 4, ['M  ', 'MM ', 'MMM'], { M: base });
})();
(function defineRecipesMore() {
  // wood: cherry, stripped logs, per-wood doors / trapdoors / gates / fences
  shapeless('cherry_planks', 4, ['cherry_log']);
  for (const w of WOODS_ALL) shapeless(w + '_planks', 4, ['stripped_' + w + '_log']);
  shapeless('crimson_planks', 4, ['stripped_crimson_stem']); shapeless('warped_planks', 4, ['stripped_warped_stem']);
  for (const w of ['cherry', 'crimson', 'warped']) shaped(w + '_fence', 3, ['PSP', 'PSP'], { P: w + '_planks', S: 'stick' });
  for (const w of DOOR_WOODS) {
    shaped(w + '_door', 3, ['PP', 'PP', 'PP'], { P: w + '_planks' });
    shaped(w + '_trapdoor', 2, ['PPP', 'PPP'], { P: w + '_planks' });
    shaped(w + '_fence_gate', 1, ['SPS', 'SPS'], { P: w + '_planks', S: 'stick' });
  }
  for (const [n, base] of SLABS2) shaped(n, 6, ['MMM'], { M: base });
  for (const [n, base] of STAIRS2) shaped(n, 4, ['M  ', 'MM ', 'MMM'], { M: base });
  for (const [n, base] of WALLS2) shaped(n, 6, ['MMM', 'MMM'], { M: base });
  // stone families
  const sq = (out, n, ing) => shaped(out, n, ['SS', 'SS'], { S: ing }), col = (out, n, ing) => shaped(out, n, ['S', 'S'], { S: ing });
  sq('polished_deepslate', 4, 'cobbled_deepslate'); sq('deepslate_bricks', 4, 'polished_deepslate'); sq('deepslate_tiles', 4, 'deepslate_bricks'); col('chiseled_deepslate', 1, 'cobbled_deepslate_slab');
  sq('polished_blackstone', 4, 'blackstone'); sq('polished_blackstone_bricks', 4, 'polished_blackstone'); col('chiseled_polished_blackstone', 1, 'polished_blackstone_slab');
  sq('polished_basalt', 4, 'basalt'); sq('quartz_bricks', 4, 'quartz_block'); col('quartz_pillar', 2, 'quartz_block'); col('chiseled_quartz_block', 1, 'quartz_slab');
  sq('cut_red_sandstone', 4, 'red_sandstone'); col('chiseled_red_sandstone', 1, 'red_sandstone_slab'); col('chiseled_nether_bricks', 1, 'nether_brick_slab');
  sq('prismarine', 1, 'prismarine_shard');
  shaped('prismarine_bricks', 1, ['SSS', 'SSS', 'SSS'], { S: 'prismarine_shard' });
  shaped('dark_prismarine', 1, ['SSS', 'SDS', 'SSS'], { S: 'prismarine_shard', D: 'black_dye' });
  shaped('sea_lantern', 1, ['SCS', 'CCC', 'SCS'], { S: 'prismarine_shard', C: 'prismarine_crystals' });
  shapeless('mud', 4, ['dirt', 'dirt', 'dirt', 'dirt', 'water_bucket']);
  shapeless('packed_mud', 1, ['mud', 'wheat']); sq('mud_bricks', 4, 'packed_mud');
  shapeless('moss_block', 2, ['vine', 'vine', 'dirt']); shaped('moss_carpet', 3, ['MM'], { M: 'moss_block' });
  shaped('blue_ice', 1, ['III', 'III', 'III'], { I: 'packed_ice' });
  // amethyst, copper, netherite, raw metal storage
  sq('amethyst_block', 1, 'amethyst_shard');
  shaped('tinted_glass', 2, [' A ', 'AGA', ' A '], { A: 'amethyst_shard', G: 'glass' });
  shaped('spyglass', 1, ['A', 'C', 'C'], { A: 'amethyst_shard', C: 'copper_ingot' });
  for (const [bl, it] of [['copper_block', 'copper_ingot'], ['raw_iron_block', 'raw_iron'], ['raw_copper_block', 'raw_copper'], ['raw_gold_block', 'raw_gold'], ['netherite_block', 'netherite_ingot'], ['slime_block', 'slime_ball'], ['dried_kelp_block', 'dried_kelp']]) {
    shaped(bl, 1, ['MMM', 'MMM', 'MMM'], { M: it }); shapeless(it, 9, [bl]);
  }
  sq('cut_copper', 4, 'copper_block');
  shapeless('netherite_ingot', 1, ['netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'netherite_scrap', 'gold_ingot', 'gold_ingot', 'gold_ingot', 'gold_ingot']);
  for (const k of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'helmet', 'chestplate', 'leggings', 'boots']) shapeless('netherite_' + k, 1, ['diamond_' + k, 'netherite_ingot']);
  shaped('compass', 1, [' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'redstone' });
  shaped('clock', 1, [' G ', 'GRG', ' G '], { G: 'gold_ingot', R: 'redstone' });
  shaped('fishing_rod', 1, ['  T', ' TS', 'T S'], { T: 'stick', S: 'string' });
  // light sources & utility blocks
  shaped('redstone_lamp', 1, [' R ', 'RGR', ' R '], { R: 'redstone', G: 'glowstone' });
  shaped('campfire', 1, [' S ', 'SCS', 'LLL'], { S: 'stick', C: '#coal', L: '#logs' });
  shaped('soul_campfire', 1, [' S ', 'SCS', 'LLL'], { S: 'stick', C: '#soul', L: '#logs' });
  shaped('soul_lantern', 1, ['NNN', 'NTN', 'NNN'], { N: 'iron_nugget', T: 'soul_torch' });
  shaped('chain', 1, ['N', 'I', 'N'], { N: 'iron_nugget', I: 'iron_ingot' });
  shaped('blast_furnace', 1, ['III', 'IFI', 'SSS'], { I: 'iron_ingot', F: 'furnace', S: 'smooth_stone' });
  shaped('smoker', 1, [' L ', 'LFL', ' L '], { L: '#logs', F: 'furnace' });
  shaped('note_block', 1, ['PPP', 'PRP', 'PPP'], { P: '#planks', R: 'redstone' });
  shapeless('ochre_froglight', 1, ['glowstone', 'yellow_dye']); shapeless('verdant_froglight', 1, ['glowstone', 'lime_dye']); shapeless('pearlescent_froglight', 1, ['glowstone', 'pink_dye']);
  // dyed blocks
  for (let i = 0; i < 16; i++) {
    const d = DYES[i];
    shapeless(d + '_concrete_powder', 8, [d + '_dye', 'sand', 'sand', 'sand', 'sand', 'gravel', 'gravel', 'gravel', 'gravel']);
    shaped(d + '_stained_glass_pane', 16, ['GGG', 'GGG'], { G: d + '_stained_glass' });
  }
  // food & dyes from the new plants
  shapeless('beetroot_soup', 1, ['bowl', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot', 'beetroot']);
  shaped('golden_carrot', 1, ['NNN', 'NCN', 'NNN'], { N: 'gold_nugget', C: 'carrot' });
  for (const [dye, src] of [['orange', 'orange_tulip'], ['light_gray', 'white_tulip'], ['pink', 'pink_tulip'], ['orange', 'torchflower'], ['pink', 'pink_petals'], ['red', 'beetroot']]) shapeless(dye + '_dye', 1, [src]);
  // the End
  shapeless('ember_powder', 2, ['ember_rod']);
  shapeless('eye_of_ender', 1, ['ember_powder', 'ender_pearl']);
  shaped('purpur_block', 4, ['PP', 'PP'], { P: 'popped_chorus_fruit' });
  shaped('purpur_pillar', 1, ['S', 'S'], { S: 'purpur_slab' });
  shaped('end_rod', 4, ['R', 'P'], { R: 'ember_rod', P: 'popped_chorus_fruit' });
  shaped('end_stone_bricks', 4, ['SS', 'SS'], { S: 'end_stone' });
  shaped('end_crystal', 1, ['GGG', 'GEG', 'GMG'], { G: 'glass', E: 'eye_of_ender', M: 'magma_cream' });
  shapeless('firework_rocket', 3, ['paper', 'gunpowder']);
  for (const [n, base] of SLABS3) shaped(n, 6, ['MMM'], { M: base });
  for (const [n, base] of STAIRS3) shaped(n, 4, ['M  ', 'MM ', 'MMM'], { M: base });
  shaped('end_stone_brick_wall', 6, ['MMM', 'MMM'], { M: 'end_stone_bricks' });
})();

function craftMatch(grid, gw) {
  // grid: array of item ids (0 empty) size gw*gw
  let minx = gw, miny = gw, maxx = -1, maxy = -1, cnt = 0;
  for (let y = 0; y < gw; y++) for (let x = 0; x < gw; x++) if (grid[y * gw + x]) { cnt++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  if (!cnt) return null;
  const w = maxx - minx + 1, h = maxy - miny + 1;
  for (const r of RECIPES) {
    if (r.type === 'shaped') {
      if (r.w !== w || r.h !== h) continue;
      for (let mirror = 0; mirror < 2; mirror++) {
        let ok = true;
        for (let y = 0; y < h && ok; y++) for (let x = 0; x < w; x++) {
          const ing = r.grid[y * w + (mirror ? w - 1 - x : x)], id = grid[(miny + y) * gw + minx + x];
          if (ing === null ? id !== 0 : !ingMatch(ing, id)) { ok = false; break; }
        }
        if (ok) return r;
      }
    } else {
      if (r.ings.length !== cnt) continue;
      const used = new Array(r.ings.length).fill(false);
      let ok = true;
      for (let i = 0; i < grid.length && ok; i++) {
        const id = grid[i]; if (!id) continue;
        let found = false;
        for (let k = 0; k < r.ings.length; k++) if (!used[k] && ingMatch(r.ings[k], id)) { used[k] = true; found = true; break; }
        if (!found) ok = false;
      }
      if (ok) return r;
    }
  }
  return null;
}
function recipeIngredients(r) {
  // -> array of {ing, n}
  const m = new Map();
  const list = r.type === 'shaped' ? r.grid.filter(x => x !== null) : r.ings;
  for (const ing of list) m.set(ing, (m.get(ing) || 0) + 1);
  return [...m.entries()].map(([ing, n]) => ({ ing, n }));
}
function recipeFits(r, size) { return r.type === 'shapeless' ? r.ings.length <= size * size : (r.w <= size && r.h <= size); }

// ---------------------------------------------------------------- smelting
const SMELT = Object.create(null);
function smelt(inp, out, xp) { const ids = inp[0] === '#' ? [...TAGS[inp]] : [I[inp]]; for (const id of ids) SMELT[id] = { out: I[out], xp }; }
smelt('iron_ore', 'iron_ingot', 0.7); smelt('gold_ore', 'gold_ingot', 1); smelt('deepslate_iron_ore', 'iron_ingot', 0.7); smelt('deepslate_gold_ore', 'gold_ingot', 1);
smelt('nether_gold_ore', 'gold_ingot', 1); smelt('diamond_ore', 'diamond', 1); smelt('emerald_ore', 'emerald', 1); smelt('coal_ore', 'coal', 0.1);
smelt('nether_quartz_ore', 'quartz', 0.2); smelt('lapis_ore', 'lapis_lazuli', 0.2); smelt('redstone_ore', 'redstone', 0.7);
smelt('#sand', 'glass', 0.1); smelt('cobblestone', 'stone', 0.1); smelt('stone', 'smooth_stone', 0.1); smelt('cobbled_deepslate', 'deepslate', 0.1);
smelt('stone_bricks', 'cracked_stone_bricks', 0.1); smelt('sandstone', 'smooth_sandstone', 0.1); smelt('clay_ball', 'brick', 0.3); smelt('clay', 'terracotta', 0.35);
smelt('netherrack', 'nether_brick', 0.1); smelt('#logs', 'charcoal', 0.15); smelt('porkchop', 'cooked_porkchop', 0.35); smelt('beef', 'cooked_beef', 0.35);
smelt('mutton', 'cooked_mutton', 0.35); smelt('chicken', 'cooked_chicken', 0.35); smelt('potato', 'baked_potato', 0.35); smelt('kelp', 'dried_kelp', 0.1);
smelt('cactus', 'green_dye', 1); smelt('wet_sponge', 'sponge', 0.15);
smelt('raw_iron', 'iron_ingot', 0.7); smelt('raw_gold', 'gold_ingot', 1); smelt('raw_copper', 'copper_ingot', 0.7); smelt('copper_ore', 'copper_ingot', 0.7); smelt('deepslate_copper_ore', 'copper_ingot', 0.7);
smelt('ancient_debris', 'netherite_scrap', 2); smelt('basalt', 'smooth_basalt', 0.1); smelt('deepslate_bricks', 'cracked_deepslate_bricks', 0.1);
smelt('polished_blackstone_bricks', 'cracked_polished_blackstone_bricks', 0.1); smelt('nether_bricks', 'cracked_nether_bricks', 0.1); smelt('red_sandstone', 'smooth_red_sandstone', 0.1);
smelt('quartz_block', 'smooth_quartz', 0.1); smelt('cod', 'cooked_cod', 0.35); smelt('salmon', 'cooked_salmon', 0.35); smelt('sea_pickle', 'lime_dye', 0.1);
smelt('chorus_fruit', 'popped_chorus_fruit', 0.1);
// blast furnaces only take ores and raw metal, smokers only food; both work twice as fast
for (const k in SMELT) { const inp = ITEMS[k], out = ITEMS[SMELT[k].out]; SMELT[k].cat = /_ore$|^raw_|^ancient_debris$/.test(inp.name) ? 'ore' : out.food ? 'food' : ''; }
function fuelValue(id) {
  const d = ITEMS[id]; if (!d) return 0;
  if (d.fuel) return d.fuel;
  if (TAGS['#logs'].has(id) || TAGS['#planks'].has(id)) return 300;
  if (TAGS['#wool'].has(id)) return 100;
  if (d.name.endsWith('_sapling')) return 100;
  return 0;
}

// ---------------------------------------------------------------- loot
const LOOT = {
  village_house: [3, 7, [['bread', 1, 4, 15], ['apple', 1, 5, 15], ['wheat', 1, 7, 10], ['potato', 1, 7, 10], ['carrot', 1, 7, 10], ['emerald', 1, 4, 4], ['oak_sapling', 1, 2, 5], ['iron_ingot', 1, 3, 3], ['torch', 1, 8, 6], ['feather', 1, 3, 5], ['wheat_seeds', 2, 6, 8], ['paper', 1, 4, 3], ['string', 1, 3, 4], ['book', 1, 1, 2]]],
  village_smith: [3, 8, [['iron_ingot', 1, 5, 10], ['gold_ingot', 1, 3, 5], ['bread', 1, 3, 15], ['apple', 1, 3, 15], ['iron_pickaxe', 1, 1, 5], ['iron_sword', 1, 1, 5], ['iron_chestplate', 1, 1, 5], ['iron_helmet', 1, 1, 5], ['iron_leggings', 1, 1, 5], ['iron_boots', 1, 1, 5], ['obsidian', 3, 7, 5], ['oak_sapling', 3, 7, 5], ['diamond', 1, 3, 3], ['emerald', 1, 3, 4]]],
  pyramid: [2, 6, [['bone', 4, 6, 25], ['rotten_flesh', 3, 7, 16], ['gunpowder', 1, 8, 10], ['sand', 1, 8, 10], ['string', 1, 8, 10], ['gold_ingot', 2, 7, 15], ['iron_ingot', 1, 5, 15], ['emerald', 1, 3, 15], ['diamond', 1, 3, 5], ['golden_apple', 1, 1, 12], ['diamond_sword', 1, 1, 1], ['diamond_chestplate', 1, 1, 1]]],
  jungle_temple: [2, 6, [['diamond', 1, 3, 3], ['iron_ingot', 1, 5, 10], ['gold_ingot', 2, 7, 15], ['emerald', 1, 3, 2], ['bone', 4, 6, 20], ['rotten_flesh', 3, 7, 16], ['golden_apple', 1, 1, 4]]],
  dungeon: [3, 8, [['bread', 1, 2, 20], ['wheat', 1, 4, 20], ['iron_ingot', 1, 4, 10], ['gold_ingot', 1, 4, 5], ['redstone', 1, 4, 15], ['string', 1, 8, 10], ['gunpowder', 1, 8, 10], ['bone', 1, 8, 10], ['rotten_flesh', 1, 8, 10], ['golden_apple', 1, 1, 12], ['bucket', 1, 1, 10], ['coal', 3, 8, 15], ['diamond', 1, 2, 3], ['iron_sword', 1, 1, 4]]],
  mineshaft: [3, 6, [['rail', 4, 8, 20], ['torch', 1, 16, 15], ['bread', 1, 3, 15], ['iron_ingot', 1, 5, 10], ['gold_ingot', 1, 3, 5], ['redstone', 4, 9, 5], ['lapis_lazuli', 4, 9, 5], ['diamond', 1, 2, 3], ['coal', 3, 8, 10], ['golden_apple', 1, 1, 2], ['iron_pickaxe', 1, 1, 1]]],
  ruined_portal: [4, 8, [['obsidian', 1, 2, 40], ['flint', 1, 4, 40], ['iron_nugget', 9, 18, 40], ['flint_and_steel', 1, 1, 40], ['fire_charge', 1, 1, 40], ['golden_apple', 1, 1, 15], ['gold_nugget', 4, 24, 15], ['golden_sword', 1, 1, 15], ['golden_axe', 1, 1, 15], ['golden_pickaxe', 1, 1, 15], ['golden_boots', 1, 1, 15], ['golden_helmet', 1, 1, 15], ['gold_ingot', 2, 8, 5], ['gold_block', 1, 2, 1]]],
  fortress: [2, 5, [['diamond', 1, 3, 5], ['iron_ingot', 1, 5, 5], ['gold_ingot', 1, 3, 15], ['golden_sword', 1, 1, 5], ['golden_chestplate', 1, 1, 5], ['flint_and_steel', 1, 1, 5], ['nether_wart_item', 3, 7, 5], ['obsidian', 2, 4, 2], ['ember_rod', 1, 3, 5]]],
  igloo: [2, 8, [['apple', 1, 3, 15], ['coal', 1, 4, 15], ['gold_nugget', 1, 3, 10], ['stone_axe', 1, 1, 2], ['rotten_flesh', 1, 1, 10], ['emerald', 1, 1, 1], ['wheat', 2, 3, 10], ['golden_apple', 1, 1, 1]]],
  ocean_ruin: [2, 6, [['prismarine_shard', 2, 8, 20], ['prismarine_crystals', 1, 5, 12], ['emerald', 1, 2, 8], ['gold_ingot', 1, 3, 6], ['coal', 2, 6, 12], ['cod', 1, 4, 10], ['sponge', 1, 1, 2], ['wet_sponge', 1, 2, 4], ['fishing_rod', 1, 1, 3], ['sea_pickle', 1, 3, 5], ['compass', 1, 1, 2]]],
};
// newer items mixed into the existing loot tables
for (const [tab, extra] of Object.entries({
  village_house: [['beetroot', 1, 5, 8], ['beetroot_seeds', 2, 6, 6], ['sweet_berries', 1, 6, 6], ['cod', 1, 3, 4]],
  village_smith: [['chainmail_chestplate', 1, 1, 4], ['chainmail_helmet', 1, 1, 4], ['copper_ingot', 1, 6, 8]],
  pyramid: [['ender_pearl', 1, 1, 4], ['golden_carrot', 1, 2, 5]],
  jungle_temple: [['ender_pearl', 1, 1, 3], ['sweet_berries', 2, 6, 6]],
  dungeon: [['ender_pearl', 1, 2, 4], ['compass', 1, 1, 2], ['clock', 1, 1, 2], ['golden_carrot', 1, 3, 4], ['raw_copper', 2, 6, 6]],
  mineshaft: [['raw_copper', 2, 6, 8], ['raw_iron', 1, 4, 6], ['amethyst_shard', 1, 5, 4], ['beetroot_seeds', 2, 4, 5]],
  ruined_portal: [['golden_carrot', 4, 12, 15], ['gilded_blackstone', 1, 2, 5]],
  fortress: [['netherite_scrap', 1, 1, 2], ['gilded_blackstone', 1, 3, 4]],
})) LOOT[tab][2].push(...extra);
// the End: [min rolls, max rolls, entries, guaranteed items]
LOOT.stronghold = [2, 5, [['ender_pearl', 1, 2, 12], ['iron_ingot', 1, 5, 10], ['gold_ingot', 1, 3, 5], ['redstone', 4, 9, 5], ['bread', 1, 3, 15], ['apple', 1, 3, 15], ['iron_pickaxe', 1, 1, 5], ['iron_sword', 1, 1, 5], ['iron_chestplate', 1, 1, 5], ['diamond', 1, 3, 3], ['ember_rod', 1, 2, 6], ['golden_apple', 1, 1, 2], ['book', 1, 3, 6], ['eye_of_ender', 1, 1, 3]]];
LOOT.end_city = [3, 7, [['diamond', 2, 6, 5], ['iron_ingot', 4, 8, 10], ['gold_ingot', 2, 7, 15], ['emerald', 2, 6, 3], ['diamond_sword', 1, 1, 3], ['diamond_pickaxe', 1, 1, 3], ['diamond_chestplate', 1, 1, 3], ['diamond_helmet', 1, 1, 3], ['iron_sword', 1, 1, 3], ['iron_chestplate', 1, 1, 3], ['ender_pearl', 1, 3, 6], ['chorus_fruit', 2, 6, 6], ['firework_rocket', 3, 8, 6], ['netherite_scrap', 1, 1, 1]]];
LOOT.end_ship = [3, 6, LOOT.end_city[2], [['elytra', 1], ['firework_rocket', 16]]];
function rollLoot(table, seed) {
  const t = LOOT[table]; if (!t) return [];
  const r = new RNG(seed || (Math.random() * 1e9) | 0);
  const n = r.range(t[0], t[1]);
  const tot = t[2].reduce((a, e) => a + e[3], 0);
  const out = [];
  if (t[3]) for (const [name, cnt] of t[3]) out.push({ id: I[name], n: cnt, d: 0 });
  for (let k = 0; k < n; k++) {
    let v = r.next() * tot;
    for (const e of t[2]) { v -= e[3]; if (v < 0) { const id = I[e[0]]; if (id !== undefined) out.push({ id, n: Math.min(maxStack(id), r.range(e[1], e[2])), d: 0 }); break; } }
  }
  return out;
}
// ---------------------------------------------------------------- trades
const TRADES = {
  farmer: [[[['wheat', 20]], ['emerald', 1]], [[['potato', 26]], ['emerald', 1]], [[['carrot', 22]], ['emerald', 1]], [[['emerald', 1]], ['bread', 6]], [[['emerald', 1]], ['pumpkin_pie', 4]], [[['emerald', 1]], ['apple', 4]], [[['emerald', 3]], ['cookie', 18]]],
  librarian: [[[['paper', 24]], ['emerald', 1]], [[['emerald', 1]], ['bookshelf', 1]], [[['book', 4]], ['emerald', 1]], [[['emerald', 1]], ['lantern', 1]], [[['emerald', 1]], ['glass', 4]], [[['emerald', 5], ['book', 1]], ['golden_apple', 1]]],
  smith: [[[['coal', 15]], ['emerald', 1]], [[['iron_ingot', 4]], ['emerald', 1]], [[['emerald', 3]], ['iron_sword', 1]], [[['emerald', 5]], ['iron_pickaxe', 1]], [[['emerald', 7]], ['iron_chestplate', 1]], [[['emerald', 4]], ['iron_helmet', 1]], [[['emerald', 17]], ['diamond_pickaxe', 1]], [[['emerald', 13]], ['diamond_sword', 1]], [[['diamond', 1]], ['emerald', 1]]],
  cleric: [[[['rotten_flesh', 32]], ['emerald', 1]], [[['emerald', 1]], ['redstone', 2]], [[['emerald', 1]], ['lapis_lazuli', 4]], [[['emerald', 4]], ['glowstone', 1]], [[['gold_ingot', 3]], ['emerald', 1]], [[['emerald', 8]], ['golden_apple', 1]]],
  butcher: [[[['chicken', 14]], ['emerald', 1]], [[['porkchop', 7]], ['emerald', 1]], [[['beef', 10]], ['emerald', 1]], [[['emerald', 1]], ['cooked_porkchop', 6]], [[['emerald', 1]], ['cooked_chicken', 5]], [[['emerald', 1]], ['cooked_beef', 5]]],
  shepherd: [[[['white_wool', 18]], ['emerald', 1]], [[['emerald', 2]], ['shears', 1]], [[['emerald', 1]], ['white_wool', 2]], [[['emerald', 3]], ['red_bed', 1]], [[['emerald', 1]], ['blue_dye', 3]]],
  fletcher: [[[['stick', 32]], ['emerald', 1]], [[['emerald', 1]], ['arrow', 16]], [[['emerald', 2]], ['bow', 1]], [[['string', 14]], ['emerald', 1]], [[['feather', 24]], ['emerald', 1]], [[['gravel', 10], ['emerald', 1]], ['flint', 10]]],
  none: [],
};
TRADES.farmer.push([[['beetroot', 15]], ['emerald', 1]], [[['emerald', 1]], ['golden_carrot', 3]]);
TRADES.librarian.push([[['emerald', 4]], ['compass', 1]], [[['emerald', 5]], ['clock', 1]]);
TRADES.smith.push([[['emerald', 5]], ['chainmail_chestplate', 1]], [[['emerald', 3]], ['chainmail_helmet', 1]], [[['emerald', 4]], ['chainmail_leggings', 1]], [[['emerald', 2]], ['chainmail_boots', 1]], [[['copper_ingot', 12]], ['emerald', 1]]);
TRADES.cleric.push([[['emerald', 5]], ['ender_pearl', 1]]);
TRADES.butcher.push([[['emerald', 1]], ['cooked_cod', 6]], [[['sweet_berries', 10]], ['emerald', 1]]);
TRADES.fletcher.push([[['emerald', 2]], ['fishing_rod', 1]]);
