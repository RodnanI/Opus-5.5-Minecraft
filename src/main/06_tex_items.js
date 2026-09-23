// ============================================================================
//  Item + particle textures (separate texture array)
// ============================================================================
const MATS = {
  wooden: [0x9C7442, 0xC49A5E, 0x5E4020], stone: [0x8A8A8A, 0xB0B0B0, 0x585858], iron: [0xCFCFCF, 0xF4F4F4, 0x8C8C8C],
  golden: [0xF0C83A, 0xFFF4A0, 0xB88A18], diamond: [0x4ED8D2, 0xC0FFFA, 0x1E9690], leather: [0x8E5A2C, 0xB07A42, 0x5E3A18],
};
const HANDLE = [0x7A5530, 0x4E3418];
function outline(t, f) {
  const n = t.n, mask = new Uint8Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) mask[y * n + x] = t.a(x, y) > 0 ? 1 : 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (mask[y * n + x]) continue;
    let src = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n && mask[yy * n + xx]) { src = t.get(xx, yy); break; } }
    if (src >= 0) t.px(x, y, csh(src, f || 0.38));
  }
}
function pxs(t, list, c) { for (const [x, y] of list) t.px(x, y, c); }
function handle(t, x0, y0, len) { for (let i = 0; i < len; i++) { t.px(x0 + i, y0 - i, HANDLE[0]); t.px(x0 + i + 1, y0 - i, HANDLE[1]); } }
function drawTool(t, kind, mat) {
  const [m, l, d] = MATS[mat];
  t.clear();
  if (kind === 'sword') {
    for (let i = 0; i < 10; i++) { const x = 5 + i, y = 10 - i; t.px(x, y, m); t.px(x, y - 1, l); t.px(x + 1, y, d); }
    t.px(15, 0, l);
    for (let k = -2; k <= 2; k++) t.px(4 + k, 11 + k, k === 0 ? d : csh(d, 0.9));
    t.px(3, 12, HANDLE[0]); t.px(2, 13, HANDLE[0]); t.px(3, 13, HANDLE[1]); t.px(1, 14, HANDLE[1]); t.px(0, 15, d);
  } else if (kind === 'pickaxe') {
    handle(t, 2, 13, 8);
    const arc = [[3, 3], [4, 2], [5, 1], [6, 1], [7, 1], [8, 2], [9, 2], [10, 3], [11, 4], [12, 5], [13, 6], [13, 7], [14, 8], [14, 9], [13, 10]];
    pxs(t, arc, m); pxs(t, arc.slice(1, 8).map(([x, y]) => [x, y + 1]), l); pxs(t, arc.slice(8).map(([x, y]) => [x - 1, y]), d);
    t.px(9, 5, d); t.px(10, 4, m);
  } else if (kind === 'axe') {
    handle(t, 2, 13, 8);
    const hd = [[6, 2], [7, 1], [8, 1], [9, 1], [5, 3], [6, 3], [7, 2], [8, 2], [9, 2], [10, 2], [5, 4], [6, 4], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3], [6, 5], [7, 4], [8, 4], [9, 4], [10, 4], [11, 5], [7, 5]];
    pxs(t, hd, m); pxs(t, [[6, 2], [5, 3], [5, 4], [7, 1]], l); pxs(t, [[10, 4], [11, 5], [11, 3], [7, 5]], d);
  } else if (kind === 'shovel') {
    handle(t, 2, 13, 7);
    const hd = [[11, 1], [12, 1], [10, 2], [11, 2], [12, 2], [13, 2], [9, 3], [10, 3], [11, 3], [12, 3], [13, 3], [9, 4], [10, 4], [11, 4], [12, 4], [10, 5], [11, 5]];
    pxs(t, hd, m); pxs(t, [[11, 1], [10, 2], [9, 3], [12, 1]], l); pxs(t, [[13, 3], [12, 4], [11, 5], [13, 2]], d);
  } else if (kind === 'hoe') {
    handle(t, 2, 13, 9);
    const hd = [[6, 2], [7, 2], [8, 2], [9, 2], [10, 3], [11, 3], [10, 4], [5, 3], [6, 3], [7, 3]];
    pxs(t, hd, m); pxs(t, [[6, 2], [7, 2], [8, 2]], l); pxs(t, [[5, 3], [10, 4]], d);
  }
  outline(t, 0.35);
}
const ARMOR_MASK = {
  helmet: [, , , '....dmmmmmmd....', '...dmllllllmd...', '...mllllllllm...', '...mlmmmmmmlm...', '...mm......mm...', '...mm......mm...', '...dd......dd...'],
  chestplate: [, , '..dmmm....mmmd..', '.dmllm....mllmd.', '.mlllmmmmmmlllm.', '.mllllllllllllm.', '.dmmllllllllmmd.', '...mllllllllm...', '...mllllllllm...', '...mllmmmmllm...', '...mllllllllm...', '...mllllllllm...', '...dmmmmmmmmd...'],
  leggings: [, , '...dmmmmmmmmd...', '...mllllllllm...', '...mllmmmmllm...', '...mllm..mllm...', '...mllm..mllm...', '...mllm..mllm...', '...mllm..mllm...', '...mllm..mllm...', '...mllm..mllm...', '...mllm..mllm...', '...mllm..mllm...', '...dmmd..dmmd...'],
  boots: [, , , , , , , , '...dmd....dmd...', '...mlm....mlm...', '...mlm....mlm...', '..mllm....mllm..', '.dmmmd....dmmmd.'],
};
function drawMask(t, rows, map) { t.clear(); for (let y = 0; y < rows.length; y++) if (rows[y]) for (let x = 0; x < 16; x++) { const c = map[rows[y][x]]; if (c !== undefined) t.px(x, y, c); } }
function circ(t, cx, cy, rr, c, r, amt) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d <= rr) t.px(x, y, r ? csh(c, 1 + (r.next() - 0.5) * (amt || 0.2) - (d / rr) * 0.15) : c); } }
function ell(t, cx, cy, rx, ry, c, r, amt) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry); if (d <= 1) t.px(x, y, r ? csh(c, 1 + (r.next() - 0.5) * (amt || 0.2) - d * 0.2) : c); } }
function hl(t, cx, cy) { t.px(cx, cy, 0xFFFFFF, 230); }
function thick(t, x0, y0, x1, y1, c, c2) { t.line(x0, y0, x1, y1, c); t.line(x0 + 1, y0, x1 + 1, y1, c2 || csh(c, 0.75)); }

const ITEM_PAINT = Object.create(null);
function IP(names, fn) { for (const n of names.split(' ')) ITEM_PAINT[n] = fn; }
function paintItem(name, t) {
  t = t || new Tx(16);
  const r = new RNG(strHash(name) ^ 0x17E3);
  const fn = ITEM_PAINT[name];
  if (fn) fn(t, r, name); else { t.clear(); circ(t, 8, 8, 5, 0xFF00FF); }
  return t;
}
for (const mat of ['wooden', 'stone', 'iron', 'golden', 'diamond']) for (const k of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) IP(mat + '_' + k, (t) => drawTool(t, k, mat));
for (const mat of ['leather', 'iron', 'golden', 'diamond']) for (const k in ARMOR_MASK) IP(mat + '_' + k, (t) => { const [m, l, d] = MATS[mat]; drawMask(t, ARMOR_MASK[k], { m, l, d }); outline(t, 0.4); });
IP('stick', (t) => { t.clear(); thick(t, 3, 12, 12, 3, 0x8A6236, 0x5E4020); outline(t, 0.5); });
IP('coal charcoal', (t, r, n) => { t.clear(); const c = n === 'coal' ? 0x2A2A2A : 0x3A2E24; ell(t, 8, 8.5, 5.2, 4.5, c, r, 0.5); t.px(6, 6, 0x5A5A5A); t.px(7, 6, 0x4A4A4A); t.px(9, 9, 0x4A4A4A); t.px(5, 8, 0x505050); outline(t, 0.5); });
function ingot(t, m, l, d) { const rows = [, , , , , '......llll......', '....llmmmmd.....', '..llmmmmmmmd....', '..mmmmmmmmmdd...', '..dmmmmmmmdd....', '...ddmmmmdd.....', '.....dddd.......']; drawMask(t, rows, { m, l, d }); outline(t, 0.45); }
IP('iron_ingot', (t) => ingot(t, 0xD8D8D8, 0xFFFFFF, 0x8E8E8E));
IP('gold_ingot', (t) => ingot(t, 0xF6CE3C, 0xFFF6A8, 0xB8860E));
IP('brick', (t) => ingot(t, 0xB25A3E, 0xD27A5A, 0x7A3A26));
IP('nether_brick', (t) => ingot(t, 0x4A1E24, 0x6A2E34, 0x2A0E12));
function gem(t, m, l, d) { const rows = [, , , '......llll......', '.....lmmmml.....', '....lmmllmml....', '...lmmmmmmmmd...', '....dmmmmmmd....', '.....dmmmmd.....', '......dmmd......', '.......dd.......']; drawMask(t, rows, { m, l, d }); t.px(6, 4, 0xFFFFFF); outline(t, 0.4); }
IP('diamond', (t) => gem(t, 0x5CE8E0, 0xD0FFFA, 0x1E9690));
IP('emerald', (t) => gem(t, 0x28D460, 0xA8FFC0, 0x0E8A36));
IP('quartz', (t) => { t.clear(); pxs(t, [[7, 2], [8, 2], [6, 3], [7, 3], [8, 3], [9, 3], [6, 4], [7, 4], [8, 4], [9, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [7, 8], [8, 8], [9, 8], [3, 9], [4, 9], [5, 9], [8, 9], [9, 9], [11, 9], [12, 9], [3, 10], [4, 10], [5, 10], [11, 10], [12, 10], [13, 10], [4, 11], [12, 11]], 0xEAE4DC); pxs(t, [[7, 2], [6, 3], [5, 5], [3, 9], [11, 9]], 0xFFFFFF); pxs(t, [[10, 7], [9, 9], [5, 10], [13, 10]], 0xB8AEA2); outline(t, 0.45); });
IP('lapis_lazuli', (t, r) => { t.clear(); ell(t, 8, 8, 5, 4.5, 0x2350B8, r, 0.3); pxs(t, [[6, 6], [7, 5], [10, 9]], 0x5A86E8); pxs(t, [[9, 11], [11, 8]], 0x122E78); outline(t, 0.45); });
function dust(t, r, c, c2) { t.clear(); const rows = [, , , , , , , , , '......lm........', '.....lmml..m....', '...lmmmmmd.lm...', '..mmmmmmmmdmmd..', '.ddmmmmmmmmmmdd.', '..dddddddddddd..']; drawMask(t, rows, { m: c, l: csh(c, 1.3), d: csh(c, 0.65) }); for (let k = 0; k < 6; k++) t.px(2 + r.int(12), 10 + r.int(4), c2 || csh(c, 1.4)); outline(t, 0.45); }
IP('redstone', (t, r) => dust(t, r, 0xC8140A, 0xFF5A40));
IP('glowstone_dust', (t, r) => dust(t, r, 0xE8B03A, 0xFFF0A0));
IP('gunpowder', (t, r) => dust(t, r, 0x5A5A5A, 0x8E8E8E));
IP('sugar', (t, r) => dust(t, r, 0xEEEEF2, 0xFFFFFF));
IP('bone_meal', (t, r) => dust(t, r, 0xE8E4DA, 0xFFFFFF));
IP('dye', (t, r) => { t.clear(); ell(t, 8, 9.5, 4.2, 4.6, 0xE8E8E8, r, 0.15); pxs(t, [[7, 4], [8, 4], [7, 5], [8, 5], [8, 3]], 0xD0D0D0); hl(t, 6, 8); outline(t, 0.5); });
IP('gold_nugget', (t, r) => { t.clear(); ell(t, 7.5, 9, 3.4, 2.6, 0xF2C83A, r, 0.2); ell(t, 10, 7, 1.8, 1.6, 0xF6D24A); hl(t, 6, 8); outline(t, 0.4); });
IP('iron_nugget', (t, r) => { t.clear(); ell(t, 7.5, 9, 3.4, 2.6, 0xC8C8C8, r, 0.2); ell(t, 10, 7, 1.8, 1.6, 0xD8D8D8); hl(t, 6, 8); outline(t, 0.4); });
IP('flint', (t, r) => { t.clear(); pxs(t, [[7, 3], [8, 3], [6, 4], [7, 4], [8, 4], [9, 4], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [6, 10], [7, 10], [8, 10], [9, 10], [7, 11], [8, 11]], 0x3E3E42); pxs(t, [[7, 3], [6, 4], [5, 6], [6, 5]], 0x6E6E74); pxs(t, [[9, 9], [10, 8], [8, 11]], 0x2A2A2E); outline(t, 0.5); });
IP('bone', (t) => { t.clear(); thick(t, 4, 11, 11, 4, 0xEEEADC, 0xC8C2B0); pxs(t, [[2, 11], [3, 12], [4, 13], [2, 12], [3, 13], [11, 2], [12, 3], [13, 4], [12, 2], [13, 3]], 0xEEEADC); outline(t, 0.45); });
IP('string', (t) => { t.clear(); let x = 3, y = 2; for (let i = 0; i < 12; i++) { t.px(x, y, 0xF2F2F2); t.px(x + 1, y, 0xCFCFCF); y++; x += (i % 4 < 2) ? 1 : -1; if (i === 6) x += 3; } outline(t, 0.55); });
IP('feather', (t) => { t.clear(); t.line(3, 13, 12, 4, 0xB8B8B8); for (let i = 0; i < 8; i++) { t.px(5 + i, 10 - i, 0xF4F4F4); t.px(4 + i, 10 - i, 0xFFFFFF); t.px(6 + i, 11 - i, 0xDADADA); if (i > 2) t.px(3 + i, 9 - i + 1, 0xE8E8E8); } outline(t, 0.5); });
IP('leather', (t, r) => { t.clear(); ell(t, 8, 8, 5.5, 5.2, 0x9A5A2C, r, 0.2); t.px(3, 3, 0); pxs(t, [[4, 3], [11, 3], [4, 12], [11, 12]], 0x9A5A2C); outline(t, 0.45); });
IP('rotten_flesh', (t, r) => { t.clear(); ell(t, 8, 8.5, 5, 4, 0x8A6A3A, r, 0.3); for (let k = 0; k < 8; k++) t.px(4 + r.int(9), 5 + r.int(7), r.pick([0x5E7A32, 0x6A8A3A, 0xA4402E])); outline(t, 0.45); });
IP('arrow', (t) => { t.clear(); t.line(4, 11, 12, 3, 0x8A6236); pxs(t, [[12, 2], [13, 2], [13, 3], [11, 2], [13, 1], [14, 1]], 0x9A9A9A); pxs(t, [[14, 1]], 0xDADADA); pxs(t, [[2, 11], [3, 11], [2, 12], [4, 12], [4, 13], [3, 13], [1, 12]], 0xEFEFEF); outline(t, 0.45); });
function bow(t, pull) {
  t.clear();
  const arc = [[4, 1], [5, 1], [6, 1], [7, 1], [8, 2], [9, 3], [10, 4], [11, 5], [12, 6], [13, 7], [14, 8], [14, 9], [14, 10], [14, 11]];
  pxs(t, arc, 0x8A5A2E); pxs(t, arc.map(([x, y]) => [x - 1, y + 1]).slice(4, 11), 0x6A4220); t.px(4, 1, 0xB08050); t.px(14, 11, 0xB08050);
  const sx = pull ? 2 + pull : 3, sy = pull ? 2 + pull : 2;
  t.line(4, 2, sx, sy + 4, 0xDADADA); t.line(sx, sy + 4, 13, 11, 0xDADADA);
  if (pull) { t.line(sx, sy + 4, sx + 6, sy - 2, 0x8A6236); t.px(sx + 7, sy - 3, 0xB0B0B0); t.px(sx + 6, sy - 3, 0x9A9A9A); }
  outline(t, 0.45);
}
IP('bow', (t) => bow(t, 0)); IP('bow_1', (t) => bow(t, 1)); IP('bow_2', (t) => bow(t, 2)); IP('bow_3', (t) => bow(t, 3));
function bucket(t, content) {
  const rows = [, , , '...dmmmmmmmmd...', '..dlwwwwwwwwld..', '..mlwwwwwwwwlm..', '...mlmmmmmmlm...', '...mlmmmmmmlm...', '...mlmmmmmmdm...', '....mlmmmmdm....', '....mlmmmmdm....', '....dmmmmmmd....', '.....dddddd.....'];
  const w = { empty: 0x3A3A3A, water: 0x3A6AE8, lava: 0xF08020, milk: 0xF4F4F4 }[content];
  drawMask(t, rows, { m: 0xB8B8B8, l: 0xE4E4E4, d: 0x7A7A7A, w });
  if (content === 'water') t.px(6, 4, 0x7AA0FF); if (content === 'lava') t.px(6, 4, 0xFFD050);
  outline(t, 0.45);
}
IP('bucket', (t) => bucket(t, 'empty')); IP('water_bucket', (t) => bucket(t, 'water')); IP('lava_bucket', (t) => bucket(t, 'lava')); IP('milk_bucket', (t) => bucket(t, 'milk'));
function fruit(t, r, c, stemC) { t.clear(); circ(t, 8, 9.5, 5, c, r, 0.2); t.px(6, 6, csh(c, 1.5)); t.px(5, 7, csh(c, 1.35)); t.px(8, 4, stemC || 0x5A3A1A); t.px(8, 3, stemC || 0x5A3A1A); t.px(9, 3, 0x4E9A2A); t.px(10, 2, 0x4E9A2A); t.px(10, 3, 0x3E8A22); outline(t, 0.45); }
IP('apple', (t, r) => fruit(t, r, 0xD8261E));
IP('golden_apple', (t, r) => { fruit(t, r, 0xF2C83A); t.px(6, 7, 0xFFFFFF); });
IP('bread', (t, r) => { t.clear(); ell(t, 8, 9, 6.5, 3.6, 0xB8823A, r, 0.15); for (const x of [5, 8, 11]) { t.px(x, 7, 0xE0B870); t.px(x + 1, 8, 0xE0B870); } outline(t, 0.45); });
IP('carrot', (t, r) => { t.clear(); for (let i = 0; i < 8; i++) { t.px(3 + i, 12 - i, 0xE88A1E); t.px(4 + i, 12 - i, 0xD0721A); if (i < 6) t.px(4 + i, 11 - i, 0xF6A02E); } t.px(2, 13, 0xD0721A); pxs(t, [[11, 3], [12, 2], [12, 4], [13, 3], [13, 1], [14, 2], [11, 1]], 0x4E9A2A); outline(t, 0.45); });
IP('potato', (t, r) => { t.clear(); ell(t, 8, 8.5, 4.6, 5.2, 0xC8A45A, r, 0.2); pxs(t, [[6, 6], [9, 10], [8, 7]], 0x9A7A3A); outline(t, 0.45); });
IP('baked_potato', (t, r) => { t.clear(); ell(t, 8, 8.5, 4.6, 5.2, 0xD89A3A, r, 0.2); pxs(t, [[7, 5], [8, 6], [7, 7], [8, 8]], 0xF6E08A); outline(t, 0.45); });
function meat(t, r, c, fat, bone) { t.clear(); ell(t, 8.5, 8, 5.2, 4.3, c, r, 0.2); for (let k = 0; k < 5; k++) t.px(5 + r.int(8), 6 + r.int(5), fat); if (bone) { pxs(t, [[3, 12], [2, 13], [4, 11], [1, 13], [2, 14]], 0xEEE8DA); } outline(t, 0.45); }
IP('porkchop', (t, r) => meat(t, r, 0xE88A8A, 0xF6C8C0, true)); IP('cooked_porkchop', (t, r) => meat(t, r, 0xB8743A, 0xE8C088, true));
IP('beef', (t, r) => meat(t, r, 0xC8322A, 0xF0A0A0, false)); IP('cooked_beef', (t, r) => meat(t, r, 0x7A4A26, 0xA87040, false));
IP('mutton', (t, r) => meat(t, r, 0xD04A3E, 0xF6D0C8, true)); IP('cooked_mutton', (t, r) => meat(t, r, 0x8E5A30, 0xC89060, true));
IP('chicken', (t, r) => { t.clear(); ell(t, 9, 7, 4.5, 4.2, 0xF2C8B8, r, 0.15); thick(t, 3, 13, 6, 10, 0xEEE8DA, 0xC8C2B0); outline(t, 0.45); });
IP('cooked_chicken', (t, r) => { t.clear(); ell(t, 9, 7, 4.5, 4.2, 0xC8843A, r, 0.2); thick(t, 3, 13, 6, 10, 0xEEE8DA, 0xC8C2B0); outline(t, 0.45); });
IP('egg', (t, r) => { t.clear(); ell(t, 8, 8.5, 4, 5, 0xE8D8BC, r, 0.1); hl(t, 6, 6); outline(t, 0.5); });
IP('snowball', (t, r) => { t.clear(); circ(t, 8, 8.5, 4.6, 0xF4FBFF, r, 0.1); t.px(9, 10, 0xD0DCE8); outline(t, 0.55); });
IP('clay_ball', (t, r) => { t.clear(); circ(t, 8, 8.5, 4.6, 0xA0A6B4, r, 0.15); hl(t, 6, 6); outline(t, 0.5); });
IP('slime_ball', (t, r) => { t.clear(); circ(t, 8, 8.5, 4.6, 0x7AC85A, r, 0.15); hl(t, 6, 6); outline(t, 0.5); });
IP('magma_cream', (t, r) => { t.clear(); circ(t, 8, 8.5, 4.6, 0xE8741E, r, 0.25); pxs(t, [[6, 7], [9, 9], [8, 6], [10, 7]], 0x5A2A0A); hl(t, 6, 6); outline(t, 0.45); });
IP('wheat_seeds', (t, r) => { t.clear(); for (let k = 0; k < 7; k++) { const x = 3 + r.int(10), y = 5 + r.int(8); t.px(x, y, 0x5EA83A); t.px(x, y + 1, 0x3E7A22); } outline(t, 0.5); });
IP('pumpkin_seeds melon_seeds', (t, r, n) => { t.clear(); const c = n === 'pumpkin_seeds' ? 0xE8DCA8 : 0x2A2A1A; for (let k = 0; k < 5; k++) { const x = 3 + r.int(10), y = 4 + r.int(9); t.px(x, y, c); t.px(x + 1, y, csh(c, 0.8)); } outline(t, 0.5); });
IP('wheat', (t, r) => { t.clear(); for (let k = 0; k < 4; k++) { const x0 = 4 + k * 2; t.line(x0 - 2, 14, x0 + 3, 4, 0xB89A3A); for (let y = 2; y < 7; y++) t.px(x0 + 3 + (y % 2), y, 0xE0C04A); } t.line(3, 11, 10, 11, 0x8A6A22); outline(t, 0.45); });
IP('paper', (t) => { t.clear(); t.rect(3, 2, 10, 12, 0xF4F4EE); for (let y = 4; y < 13; y += 2) for (let x = 4; x < 12; x++) t.px(x, y, 0xD8D8D0); outline(t, 0.55); });
IP('book', (t) => { t.clear(); t.rect(3, 2, 10, 12, 0x8E4A26); t.rect(4, 3, 8, 10, 0xA85A2E); t.rect(12, 3, 2, 11, 0xF4F0E4); for (let y = 4; y < 13; y++) t.px(13, y, 0xD8D0C0); t.rect(6, 5, 4, 2, 0xE8C83A); outline(t, 0.45); });
IP('bowl', (t, r) => { t.clear(); for (let y = 8; y < 13; y++) { const w = 6 - (y - 8); for (let x = 8 - w; x < 8 + w; x++) t.px(x, y, csh(0x8A6236, 0.9 + r.next() * 0.2)); } for (let x = 2; x < 14; x++) t.px(x, 8, 0x5E4020); outline(t, 0.5); });
IP('mushroom_stew', (t, r) => { paintItem('bowl', t); for (let x = 3; x < 13; x++) { t.px(x, 8, 0xB88A5A); t.px(x, 7, x % 3 ? 0xA07040 : 0xC89868); } });
IP('flint_and_steel', (t) => { t.clear(); pxs(t, [[3, 4], [4, 3], [5, 3], [6, 3], [7, 4], [8, 5], [8, 6], [7, 7], [3, 5], [3, 6]], 0xB0B0B0); pxs(t, [[4, 4], [5, 4], [7, 5]], 0xE0E0E0); pxs(t, [[9, 9], [10, 9], [11, 10], [9, 10], [10, 10], [11, 11], [10, 11], [12, 12], [11, 12]], 0x3E3E42); outline(t, 0.45); });
IP('shears', (t) => { t.clear(); t.line(3, 3, 10, 10, 0xD0D0D0); t.line(4, 3, 11, 10, 0x9A9A9A); t.line(10, 3, 3, 10, 0xD0D0D0); t.line(11, 3, 4, 10, 0x9A9A9A); pxs(t, [[2, 11], [3, 12], [11, 11], [12, 12], [2, 12], [12, 11]], 0x8E3A26); outline(t, 0.45); });
IP('melon_slice', (t) => { t.clear(); for (let y = 4; y < 13; y++) for (let x = 3; x < 14; x++) { const d = Math.hypot(x - 8, y - 3); if (d < 9.5 && y > 3 && x - 3 > (y - 4) * 0.0 && d > 0) t.px(x, y, d > 8.3 ? 0x3E8A22 : d > 7.5 ? 0xE8E8B0 : 0xE0302A); } pxs(t, [[6, 6], [9, 7], [11, 5], [7, 9]], 0x1A1A1A); outline(t, 0.45); });
IP('pumpkin_pie', (t, r) => { t.clear(); ell(t, 8, 9.5, 6, 3.5, 0xC8823A, r, 0.1); ell(t, 8, 8.8, 5, 2.4, 0xE8A04A, r, 0.1); outline(t, 0.45); });
IP('cookie', (t, r) => { t.clear(); circ(t, 8, 8, 5, 0xC89050, r, 0.15); pxs(t, [[6, 6], [9, 7], [7, 10], [10, 10]], 0x4A2A12); outline(t, 0.45); });
IP('dried_kelp', (t, r) => { t.clear(); for (let i = 0; i < 9; i++) { t.px(4 + i, 12 - i, 0x3A4A22); t.px(5 + i, 12 - i, 0x2A3A18); } outline(t, 0.5); });
IP('nether_wart_item', (t, r) => { t.clear(); ell(t, 8, 9, 4, 3.5, 0xA82018, r, 0.25); pxs(t, [[7, 5], [8, 4], [9, 5]], 0x8E1810); hl(t, 7, 8); outline(t, 0.45); });
IP('ember_rod', (t) => { t.clear(); thick(t, 4, 12, 11, 5, 0xFFB43A, 0xE87A1A); pxs(t, [[12, 4], [12, 3], [3, 13]], 0xFFF08A); outline(t, 0.4); });
IP('fire_charge', (t, r) => { t.clear(); circ(t, 8, 8, 5, 0x3A2A1E, r, 0.3); for (let k = 0; k < 10; k++) t.px(4 + r.int(8), 4 + r.int(8), r.pick([0xFF8A1E, 0xFFC04A, 0xE84A10])); outline(t, 0.45); });
IP('spawn_egg', (t, r) => { t.clear(); ell(t, 8, 8.5, 4.2, 5.2, 0xE8E8E8, r, 0.08); hl(t, 6, 6); outline(t, 0.5); });
IP('spawn_egg_spots', (t, r) => { t.clear(); for (const [x, y] of [[6, 7], [9, 5], [10, 9], [7, 11], [5, 10], [8, 8]]) { t.px(x, y, 0xFFFFFF); t.px(x + 1, y, 0xE0E0E0); } });
IP('oak_door_item', (t) => { t.clear(); t.rect(4, 1, 8, 14, 0x9A7545); t.rect(5, 2, 2, 3, 0x6A4A2A); t.rect(9, 2, 2, 3, 0x6A4A2A); t.rect(5, 8, 6, 5, 0x8A6A3E); t.px(10, 7, 0x2A2A2A); outline(t, 0.5); });
IP('iron_door_item', (t) => { t.clear(); t.rect(4, 1, 8, 14, 0xC8C8C8); t.rect(5, 2, 6, 3, 0x7A7A7A); t.px(10, 8, 0x3A3A3A); t.px(5, 12, 0x9A9A9A); t.px(10, 12, 0x9A9A9A); outline(t, 0.45); });
IP('bed_item', (t) => { t.clear(); t.rect(1, 7, 14, 4, 0xB02E26); t.rect(1, 6, 4, 2, 0xEEEEEE); t.rect(1, 11, 14, 2, 0x8E6A3E); t.px(1, 13, 0x6A4A2A); t.px(14, 13, 0x6A4A2A); outline(t, 0.45); });
IP('sugar_cane_item', (t) => paintTex('sugar_cane', t));
IP('totem', (t, r) => { t.clear(); ell(t, 8, 8, 4, 6, 0xE8C23A, r, 0.2); pxs(t, [[6, 6], [9, 6]], 0x1A5A1A); t.rect(6, 9, 4, 1, 0x7A5A1A); outline(t, 0.45); });
// ------------------------------------------------------------- particles & misc
IP('p_smoke', (t, r) => { t.clear(); circ(t, 8, 8, 5.5, 0xBDBDBD, r, 0.4); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.a(x, y)) t.setA(x, y, 150 + r.int(80)); });
IP('p_flame', (t) => { t.clear(); ell(t, 8, 10, 3.5, 5, 0xFF9A1E); ell(t, 8, 11, 2, 3, 0xFFE070); t.px(8, 4, 0xFF6A10); });
IP('p_soul', (t) => { t.clear(); ell(t, 8, 10, 3.5, 5, 0x3AC8E8); ell(t, 8, 11, 2, 3, 0xC0FFFF); });
IP('p_bubble', (t) => { t.clear(); for (let a = 0; a < 40; a++) { const an = a / 40 * TAU; t.px(Math.round(7.5 + Math.cos(an) * 5), Math.round(7.5 + Math.sin(an) * 5), 0xC8E8FF); } t.px(5, 5, 0xFFFFFF); t.px(6, 5, 0xFFFFFF); });
IP('p_splash', (t) => { t.clear(); for (const [x, y] of [[4, 8], [8, 5], [11, 9], [7, 11], [10, 3]]) { t.px(x, y, 0x5A8AF0); t.px(x, y + 1, 0x3A6AE0); } });
IP('p_crit', (t) => { t.clear(); t.line(8, 2, 8, 13, 0xFFFFFF); t.line(2, 8, 13, 8, 0xFFFFFF); t.line(4, 4, 11, 11, 0xE0E0E0); t.line(11, 4, 4, 11, 0xE0E0E0); });
IP('p_heart', (t) => { t.clear(); const rows = ['................', '................', '...rrr....rrr...', '..rrrrr..rrrrr..', '.rrwrrrrrrrrrrr.', '.rwrrrrrrrrrrrr.', '.rrrrrrrrrrrrrr.', '..rrrrrrrrrrrr..', '...rrrrrrrrrr...', '....rrrrrrrr....', '.....rrrrrr.....', '......rrrr......', '.......rr.......']; drawMask(t, rows, { r: 0xE8222A, w: 0xFFB0B0 }); });
IP('p_angry', (t) => { t.clear(); circ(t, 8, 8, 5, 0x5A5A5A); t.line(5, 6, 7, 8, 0xE8222A); t.line(11, 6, 9, 8, 0xE8222A); });
IP('p_portal', (t) => { t.clear(); circ(t, 8, 8, 3, 0xC87AFF); t.px(8, 8, 0xFFFFFF); t.px(4, 8, 0x8A3AE8); t.px(12, 8, 0x8A3AE8); t.px(8, 4, 0x8A3AE8); t.px(8, 12, 0x8A3AE8); });
IP('p_explosion', (t, r) => { t.clear(); circ(t, 8, 8, 7, 0xE0E0E0, r, 0.5); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.a(x, y) && r.next() < 0.25) t.setA(x, y, 0); });
IP('p_drip', (t) => { t.clear(); t.px(8, 6, 0xFFFFFF); t.rect(7, 7, 3, 3, 0xFFFFFF); t.px(8, 10, 0xFFFFFF); });
IP('p_spark', (t) => { t.clear(); t.rect(6, 6, 4, 4, 0xFFFFFF); t.px(8, 3, 0xFFFFFF); t.px(8, 12, 0xFFFFFF); t.px(3, 8, 0xFFFFFF); t.px(12, 8, 0xFFFFFF); });
IP('p_happy', (t) => { t.clear(); t.line(8, 3, 8, 12, 0x5AE85A); t.line(3, 8, 12, 8, 0x5AE85A); t.rect(7, 7, 3, 3, 0xB0FFB0); });
IP('p_dust', (t) => { t.clear(); circ(t, 8, 8, 3.2, 0xFFFFFF); });
IP('p_note', (t) => { t.clear(); t.rect(9, 2, 2, 9, 0xFFFFFF); circ(t, 7.5, 11.5, 2.5, 0xFFFFFF); t.rect(11, 2, 3, 2, 0xFFFFFF); });
IP('p_xp', (t) => { t.clear(); circ(t, 8, 8, 5, 0x9AE83A); circ(t, 8, 8, 3, 0xE8FF8A); t.px(6, 6, 0xFFFFFF); });
IP('p_rain', (t) => { t.clear(); for (const x of [1, 5, 9, 13]) { const o = (x * 7) % 16; for (let i = 0; i < 5; i++) t.px(x, (o + i) % 16, 0xAAC8FF, 130 + i * 20); } for (const x of [3, 11]) { const o = (x * 5) % 16; for (let i = 0; i < 4; i++) t.px(x, (o + i) % 16, 0xAAC8FF, 120 + i * 20); } });
IP('p_snow', (t) => { t.clear(); for (const [x, y] of [[2, 3], [9, 1], [5, 8], [13, 6], [1, 12], [10, 13], [7, 4], [14, 11]]) { t.px(x, y, 0xFFFFFF); t.px(x + 1, y, 0xF0F0F0, 200); t.px(x, y + 1, 0xF0F0F0, 200); } });
IP('p_leaf', (t) => { t.clear(); ell(t, 8, 8, 3.5, 2, 0xFFFFFF); t.px(11, 9, 0xD0D0D0); });
// futuristic vehicle deployer icons
function vicon(t, rows, map) { t.clear(); for (let y = 0; y < 16; y++) { const r = rows[y] || ''; for (let x = 0; x < 16; x++) { const c = map[r[x]]; if (c !== undefined) t.px(x, y, c); } } }
IP('veh_jet', (t) => vicon(t, ['', '       o        ', '      oko       ', '      kgk       ', '      kgk       ', '     kkkkk      ', '    kkkkkkk     ', '   okkkkkkko    ', '  okkkkkkkkko   ', ' okkkkkkkkkkko  ', 'oookkkkkkkkoooo ', '     kkkkk      ', '    okk kko     ', '    ooe eoo     ', '       ', ''].map(r => r.padEnd(16).slice(0, 16)), { o: 0xFF6418, k: 0x2E3238, g: 0xB07A2A, e: 0xFFB060 }));
IP('veh_gunship', (t) => vicon(t, ['', '      ggg       ', '     kgggk      ', ' rrr kwwwk rrr  ', 'rwwwrkwwwkrwwwr ', 'rwhwwwwwwwwwhwr ', 'rwwwrkwwwkrwwwr ', ' rrr kwwwk rrr  ', '     kwwwk      ', '     kwwwk      ', '      kwk       ', '      kwk       ', '     rkwkr      ', '      e e       ', '', ''].map(r => r.padEnd(16).slice(0, 16)), { w: 0xE2DDD2, k: 0x1E2125, r: 0xE0442A, g: 0x5A4020, h: 0xFFC46B, e: 0xFFB050 }));
IP('veh_bomber', (t) => vicon(t, ['', '', '', '       kk       ', '      kgk       ', '     kkkkk      ', '    kkkkkkk     ', '   akkkkkkka    ', '  akkkkkkkkka   ', ' akkekkkkekkka  ', 'akkkkkkkkkkkkka ', 'kkkk kkkkk kkkk ', 'k    kk kk    k ', '', '', ''].map(r => r.padEnd(16).slice(0, 16)), { k: 0x26282C, a: 0xFFA83A, g: 0x8A5C1E, e: 0xFF8A30 }));
IP('veh_tank', (t) => vicon(t, ['', '', '', '      sss       ', 'bbbbbsssss      ', '     sssss      ', '   dddddddddd   ', '  dsssssssssssd ', '  ssssssssssss  ', '  dddddddddddd  ', '  aa  aa  aa aa ', '', '', '', '', ''].map(r => r.padEnd(16).slice(0, 16)), { s: 0x5A6352, d: 0x2A2F26, b: 0x151714, a: 0xFFB050 }));
IP('veh_bike', (t) => vicon(t, ['', '', '', '', '   bb           ', '   bgg    kk    ', '  rrrrrrrrrrrk  ', ' rrrrrrrrrrrrrcc', 'rrrrlllllllrrrcl', ' kkkkkkkkkkkkkk ', '  ll       lll  ', '', '', '', '', ''].map(r => r.padEnd(16).slice(0, 16)), { r: 0xB0142C, k: 0x17181B, b: 0x9AA0A6, g: 0x2A4A2A, l: 0xB6FF3B, c: 0xD2FF60 }));
const ITEM_TEXN = [];
const ITEM_TEXI = Object.create(null);
function itx(name) { let i = ITEM_TEXI[name]; if (i === undefined) { i = ITEM_TEXI[name] = ITEM_TEXN.length; ITEM_TEXN.push(name); } return i; }
for (const n of Object.keys(ITEM_PAINT)) itx(n);
