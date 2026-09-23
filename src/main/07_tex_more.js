// ============================================================================
//  Procedural textures for the extended block + item set (same 16x16 toolkit as 05/06)
// ============================================================================
WOODC.cherry = { bark: 0x3B2229, dark: 0x27151B, inner: 0xE6B3AE, ring: 0xCF9A96, plank: 0xE0B0AA };
function tCracks(t, r, c, n) {
  for (let k = 0; k < n; k++) {
    let x = r.int(16), y = r.int(16), dx = r.next() < 0.5 ? 1 : -1;
    for (let i = 0; i < 6 + r.int(6); i++) { t.px(x, y, csh(c, 0.9 + r.next() * 0.2)); if (r.next() < 0.6) y++; else x += dx; }
  }
}
function tFrame(t, c, w) { for (let i = 0; i < 16; i++) for (let k = 0; k < (w || 1); k++) { t.px(i, k, c); t.px(i, 15 - k, c); t.px(k, i, c); t.px(15 - k, i, c); } }
function tRings(t, r, cols, cx, cy, sq) {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const dx = x - (cx === undefined ? 7.5 : cx), dy = y - (cy === undefined ? 7.5 : cy);
    const d = sq ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.sqrt(dx * dx + dy * dy);
    t.px(x, y, csh(cols[Math.floor(d) % cols.length], 0.93 + r.next() * 0.12));
  }
}
function tGrain(t, r, c, amt) {
  for (let x = 0; x < 16; x++) {
    const col = 1 + (hashF2(31, x, 7) - 0.5) * (amt || 0.16);
    for (let y = 0; y < 16; y++) t.px(x, y, csh(c, col * (0.95 + r.next() * 0.08) * (hashF2(x * 5 + 2, y >> 2, 9) < 0.1 ? 0.88 : 1)));
  }
}
function tClumps(t, r, cols, n, rad) {
  t.fill(cols[2]);
  for (let k = 0; k < n; k++) {
    const cx = r.next() * 16, cy = r.next() * 16, rr = rad * (0.7 + r.next() * 0.6), col = cols[r.int(2)];
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      const d = Math.hypot(x, y) / rr;
      if (d < 1) t.px(Math.floor(cx + x), Math.floor(cy + y), csh(col, 1.1 - d * 0.35 + (r.next() - 0.5) * 0.1));
    }
  }
}
// ---------------------------------------------------------------- stone families
TP('tuff', (t, r) => { tBase(t, r, 0x6C6D66, 0.14, 4, 0.6); tBlobs(t, r, 0x7C7D74, 4, 2, 0.1); tSpeck(t, r, 0x8A8B80, 14, 0.1); tSpeck(t, r, 0x54554F, 14, 0.1); });
TP('calcite', (t, r) => { tBase(t, r, 0xDCDDD6, 0.06, 3, 0.5); tBlobs(t, r, 0xC7C8C0, 5, 3, 0.05); tSpeck(t, r, 0xF3F3EE, 14, 0.03); });
TP('smooth_basalt', (t, r) => { tBase(t, r, 0x4A4A50, 0.09, 3, 0.5); tSpeck(t, r, 0x3B3B41, 12, 0.08); tSpeck(t, r, 0x5A5A61, 8, 0.06); });
TP('dripstone_block', (t, r) => {
  tBase(t, r, 0x86684F, 0.1, 4, 0.5);
  for (let x = 0; x < 16; x++) { const s = hashF2(71, x, 3); if (s < 0.35) { const y0 = r.int(16), len = 4 + r.int(9); for (let i = 0; i < len; i++) t.px(x, y0 + i, csh(0x6E5440, 0.9 + r.next() * 0.2)); } else if (s > 0.85) for (let y = 0; y < 16; y++) if (r.next() < 0.6) t.px(x, y, csh(0x9E7E62, 0.95 + r.next() * 0.1)); }
});
TP('polished_deepslate', (t, r) => { tBase(t, r, 0x4A4A51, 0.08, 3, 0.4); tSpeck(t, r, 0x3D3D44, 10, 0.08); tBevel(t, 1.16, 0.7); });
TP('deepslate_bricks', (t, r) => { tBricks(t, r, 0x4C4C53, 0x2A2A2F, 4, 8, 0.28, true); tSpeck(t, r, 0x3D3D44, 8, 0.08); });
TP('cracked_deepslate_bricks', (t, r) => { paintTex('deepslate_bricks', t); tCracks(t, r, 0x1E1E22, 3); });
TP('deepslate_tiles', (t, r) => { tBricks(t, r, 0x3E3E45, 0x242428, 4, 4, 0.3, true); });
TP('chiseled_deepslate', (t, r) => { tBase(t, r, 0x4A4A51, 0.07, 3, 0.4); tBevel(t, 1.15, 0.7); for (let i = 3; i < 13; i++) { t.px(i, 3, 0x2E2E34); t.px(i, 12, 0x2E2E34); t.px(3, i, 0x2E2E34); t.px(12, i, 0x2E2E34); } for (let i = 5; i < 11; i++) { t.px(i, 5, 0x5E5E66); t.px(5, i, 0x5E5E66); t.px(i, 10, 0x36363C); t.px(10, i, 0x36363C); } t.rect(7, 7, 2, 2, 0x2E2E34); });
TP('polished_blackstone', (t, r) => { tBase(t, r, 0x35303A, 0.1, 3, 0.4); tSpeck(t, r, 0x2A262E, 10, 0.08); tBevel(t, 1.2, 0.68); });
TP('polished_blackstone_bricks', (t, r) => { tBricks(t, r, 0x322D35, 0x1B181D, 4, 8, 0.25, true); });
TP('cracked_polished_blackstone_bricks', (t, r) => { paintTex('polished_blackstone_bricks', t); tCracks(t, r, 0x121014, 3); });
TP('chiseled_polished_blackstone', (t, r) => { paintTex('polished_blackstone', t); for (let i = 3; i < 13; i++) { t.px(i, 3, 0x1E1A20); t.px(i, 12, 0x1E1A20); t.px(3, i, 0x1E1A20); t.px(12, i, 0x1E1A20); } t.rect(5, 6, 2, 2, 0x1E1A20); t.rect(9, 6, 2, 2, 0x1E1A20); t.rect(6, 9, 4, 1, 0x1E1A20); t.px(7, 8, 0x4A444E); t.px(8, 8, 0x4A444E); });
TP('gilded_blackstone', (t, r) => { paintTex('blackstone', t); for (let k = 0; k < 7; k++) { let x = r.int(15), y = r.int(15); for (let i = 0; i < 3 + r.int(3); i++) { t.px(x, y, r.pick([0xF2C43A, 0xE8A822, 0xFFE27A])); if (r.next() < 0.5) x++; else y++; } } });
TP('polished_basalt_side', (t, r) => { for (let x = 0; x < 16; x++) { const f = x === 0 || x === 15 ? 0.78 : (x % 5 === 2 ? 0.86 : 1) * (0.95 + hashF2(5, x, 1) * 0.1); for (let y = 0; y < 16; y++) t.px(x, y, csh(0x5A5A61, f * (0.96 + r.next() * 0.07))); } });
TP('polished_basalt_top', (t, r) => { tRings(t, r, [0x5E5E66, 0x55555C, 0x4C4C53], 7.5, 7.5, true); tBevel(t, 1.1, 0.75); });
TP('smooth_quartz', (t, r) => { tBase(t, r, 0xEAE5DE, 0.025, 3, 0.4); });
TP('quartz_bricks', (t, r) => { tBricks(t, r, 0xEBE5DD, 0xC8BFB3, 8, 8, 0.08, true); });
TP('quartz_pillar', (t, r) => { tBase(t, r, 0xE9E3DB, 0.03, 3, 0.4); for (let y = 0; y < 16; y++) { t.px(0, y, 0xD2C9BE); t.px(15, y, 0xD2C9BE); t.px(3, y, 0xDDD5CB); t.px(12, y, 0xDDD5CB); t.px(4, y, 0xF4F0EA); t.px(11, y, 0xF4F0EA); } });
TP('quartz_pillar_top', (t, r) => { tRings(t, r, [0xEEE9E2, 0xE2DBD2, 0xEBE5DE, 0xD6CEC4], 7.5, 7.5, true); });
TP('chiseled_quartz_block', (t, r) => { tBase(t, r, 0xE9E3DB, 0.03, 3, 0.4); for (let x = 0; x < 16; x++) { t.px(x, 0, 0xD2C9BE); t.px(x, 15, 0xD2C9BE); t.px(x, 3, 0xD8D0C5); t.px(x, 12, 0xD8D0C5); } for (let d = 0; d < 3; d++) { t.px(7 - d, 6 + d, 0xCFC6BA); t.px(8 + d, 6 + d, 0xCFC6BA); t.px(7 - d, 9 - d, 0xCFC6BA); t.px(8 + d, 9 - d, 0xCFC6BA); } });
TP('chiseled_quartz_block_top', (t, r) => { tBase(t, r, 0xEAE4DC, 0.03, 3, 0.4); tFrame(t, 0xD4CCC1); for (let i = 3; i < 13; i++) { t.px(i, 3, 0xDAD2C7); t.px(i, 12, 0xDAD2C7); t.px(3, i, 0xDAD2C7); t.px(12, i, 0xDAD2C7); } t.rect(6, 6, 4, 4, 0xDDD5CA); t.rect(7, 7, 2, 2, 0xCFC6BA); });
TP('cut_red_sandstone', (t, r) => { tBase(t, r, 0xBC6424, 0.05, 3, 0.4); for (let x = 0; x < 16; x++) { t.px(x, 0, 0xA2531B); t.px(x, 15, 0xA2531B); t.px(x, 7, 0xA8561C); t.px(x, 8, 0xCB7433); } });
TP('chiseled_red_sandstone', (t, r) => { tBase(t, r, 0xBB6323, 0.05, 3, 0.4); for (let i = 0; i < 16; i++) { t.px(i, 0, 0xA2531B); t.px(i, 15, 0xA2531B); t.px(i, 2, 0xA2531B); t.px(i, 13, 0xA2531B); } for (let d = 0; d < 4; d++) { t.px(7 - d, 4 + d, 0x94481A); t.px(8 + d, 4 + d, 0x94481A); t.px(7 - d, 11 - d, 0x94481A); t.px(8 + d, 11 - d, 0x94481A); } t.rect(7, 7, 2, 2, 0x94481A); });
TP('prismarine', (t, r) => { tCells(t, r, [0x63A99B, 0x5A9D90, 0x6FB5A7, 0x528F84, 0x7ABFAE], 12, 0x3E7068, true); tSpeck(t, r, 0x9ED8C6, 6, 0.05); });
TP('prismarine_bricks', (t, r) => { tBricks(t, r, 0x66AE9F, 0x3B7168, 4, 8, 0.18, true); tSpeck(t, r, 0x8ACBB9, 6, 0.05); });
TP('dark_prismarine', (t, r) => { tBricks(t, r, 0x345C4E, 0x1E3A30, 8, 8, 0.14, true); for (let k = 0; k < 4; k++) { const x = 1 + (k & 1) * 8 + r.int(5), y = 1 + (k >> 1) * 8 + r.int(5); t.px(x, y, 0x4E7C6C); t.px(x + 1, y, 0x4E7C6C); } });
TP('cracked_nether_bricks', (t, r) => { paintTex('nether_bricks', t); tCracks(t, r, 0x0C0507, 3); });
TP('chiseled_nether_bricks', (t, r) => { tBase(t, r, 0x2E161B, 0.12, 3, 0.4); tBevel(t, 1.2, 0.6); for (let i = 3; i < 13; i++) { t.px(i, 3, 0x160A0C); t.px(i, 12, 0x160A0C); t.px(3, i, 0x160A0C); t.px(12, i, 0x160A0C); } t.rect(5, 6, 2, 2, 0x160A0C); t.rect(9, 6, 2, 2, 0x160A0C); t.rect(6, 9, 4, 1, 0x160A0C); });
TP('mud', (t, r) => { tBase(t, r, 0x3C3837, 0.16, 4, 0.5); tBlobs(t, r, 0x4A4543, 4, 2, 0.08); tSpeck(t, r, 0x2E2A29, 12, 0.08); });
TP('packed_mud', (t, r) => { tBase(t, r, 0x8E6B50, 0.1, 4, 0.5); for (let k = 0; k < 9; k++) { const x = r.int(14), y = r.int(16); t.px(x, y, 0xB39162); t.px(x + 1, y, 0xA7865A); } tSpeck(t, r, 0x75573F, 10, 0.08); });
TP('mud_bricks', (t, r) => { tBricks(t, r, 0x8A6A4F, 0x6A5140, 4, 8, 0.2, true); tSpeck(t, r, 0xA7865E, 6, 0.05); });
TP('moss_block', (t, r) => { tBase(t, r, 0x597C2E, 0.26, 5, 0.6); tSpeck(t, r, 0x6E9438, 18, 0.12); tSpeck(t, r, 0x46652A, 14, 0.1); });
TP('rooted_dirt', (t, r) => { paintTex('dirt', t); for (let k = 0; k < 4; k++) { let x = r.int(16), y = r.int(4); for (let i = 0; i < 10; i++) { t.px(x, y, csh(0xA5845C, 0.9 + r.next() * 0.2)); y++; if (r.next() < 0.45) x += r.int(3) - 1; } } });
TP('blue_ice', (t, r) => { tBase(t, r, 0x74A6F4, 0.08, 3, 0.4); for (let k = 0; k < 6; k++) { let x = r.int(16), y = r.int(16); const dx = r.next() < 0.5 ? 1 : -1; for (let i = 0; i < 5; i++) { t.px(x, y, 0xB8D6FF); x += dx; y++; } } tSpeck(t, r, 0x5E90E6, 10, 0.05); });
TP('tinted_glass', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; t.px(x, y, csh(0x3A3040, edge ? 0.8 : 1 + (r.next() - 0.5) * 0.1), edge ? 235 : 175); } for (let i = 3; i < 8; i++) t.px(i, 11 - i, 0x6A5C74, 200); });
// ---------------------------------------------------------------- amethyst, copper, raw metals, netherite
TP('amethyst_block', (t, r) => { tCells(t, r, [0x8A60C4, 0x9C74D4, 0x7A52B2, 0xB08EE4], 9, 0x5E3E96, true); tSpeck(t, r, 0xD6C0FF, 8, 0.05); });
TP('budding_amethyst', (t, r) => { paintTex('amethyst_block', t); for (const [x, y] of [[4, 4], [11, 5], [6, 11], [12, 12]]) { t.rect(x - 1, y - 1, 3, 3, 0x4A2E7A); t.px(x, y, 0xC8A8F8); } });
TP('copper_ore', (t, r) => tOre(t, r, 'stone', 0xD87A4C, 0xF2A27A, 0x8E4A2C, 6));
TP('deepslate_copper_ore', (t, r) => tOre(t, r, 'deepslate', 0xD07448, 0xEE9A70, 0x8A462A, 6));
function copperTex(t, r, base, patina, amt) {
  tBase(t, r, base, 0.08, 3, 0.4);
  const vn = vnoise(r, 5);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (vn(x, y) + r.next() * 0.2 < amt) t.px(x, y, csh(patina, 0.9 + r.next() * 0.2));
  for (let i = 0; i < 16; i++) { t.mulPx(i, 0, 1.12); t.mulPx(0, i, 1.08); t.mulPx(i, 15, 0.82); t.mulPx(15, i, 0.86); }
  for (let k = 0; k < 3; k++) { const y = 3 + r.int(10); for (let x = 2; x < 14; x++) if (r.next() < 0.5) t.mulPx(x, y, 1.08); }
}
TP('copper_block', (t, r) => copperTex(t, r, 0xC46F4E, 0x5EA084, 0));
TP('exposed_copper', (t, r) => copperTex(t, r, 0xA77C66, 0x6FA288, 0.35));
TP('weathered_copper', (t, r) => copperTex(t, r, 0x6C9B7E, 0xA77C66, 0.22));
TP('oxidized_copper', (t, r) => copperTex(t, r, 0x53A285, 0x78C0A2, 0.3));
TP('cut_copper', (t, r) => { tBricks(t, r, 0xC06C4C, 0x8E4A32, 8, 8, 0.1, true); tSpeck(t, r, 0xDC8A66, 8, 0.05); });
TP('raw_iron_block', (t, r) => tClumps(t, r, [0xD8B39A, 0xC29C84, 0x8E6E5C], 11, 3.2));
TP('raw_copper_block', (t, r) => tClumps(t, r, [0xC66A42, 0xB05A36, 0x7A3A22], 11, 3.2));
TP('raw_gold_block', (t, r) => tClumps(t, r, [0xEEBF36, 0xD9A424, 0x9A6E14], 11, 3.2));
TP('ancient_debris_side', (t, r) => { for (let y = 0; y < 16; y++) { const band = Math.floor((y + hashF2(9, 0, y >> 2) * 3) / 3) & 1; for (let x = 0; x < 16; x++) t.px(x, y, csh(band ? 0x5E4336 : 0x4A3228, 0.9 + r.next() * 0.2)); } for (let k = 0; k < 5; k++) { let x = r.int(16); const y = r.int(16); for (let i = 0; i < 5; i++) t.px(x++, y + (i >> 1), 0x8E6A56); } tFrame(t, 0x3A2820); });
TP('ancient_debris_top', (t, r) => { tRings(t, r, [0x64493B, 0x533A2E, 0x6E5242, 0x47302A]); tFrame(t, 0x3A2820); });
TP('netherite_block', (t, r) => { tMetal(t, r, 0x433E42, 0x5E585C, 0x2A2629); for (let k = 0; k < 5; k++) { const y = 2 + r.int(12); for (let x = 2; x < 14; x++) if (r.next() < 0.4) t.px(x, y, 0x3A3538); } });
// ---------------------------------------------------------------- lights & utility
for (const [n, c, hi, lo] of [['ochre', 0xF3DE9A, 0xFFF4C8, 0xD9A860], ['verdant', 0xD4EFB0, 0xF2FFD8, 0x9AC878], ['pearlescent', 0xF2DCF0, 0xFFF4FF, 0xC8A0D0]]) {
  TP(n + '_froglight_side', (t, r) => { tBase(t, r, c, 0.06, 3, 0.4); for (let y = 0; y < 16; y++) { t.px(0, y, lo); t.px(15, y, lo); t.px(1, y, csh(c, 0.94)); t.px(14, y, csh(c, 0.94)); } for (let x = 0; x < 16; x++) { t.px(x, 0, lo); t.px(x, 15, lo); } tSpeck(t, r, hi, 12, 0.02); });
  TP(n + '_froglight_top', (t, r) => { tRings(t, r, [c, csh(c, 1.04), hi, c], 7.5, 7.5, true); tFrame(t, lo); });
}
function lampTex(t, r, on) {
  const frame = on ? 0x7A4424 : 0x5A3420, glass = on ? [0xFFD27A, 0xF8B24A, 0xFFE8A8] : [0x6E4A2E, 0x5E3E26, 0x7E5634];
  t.fill(frame);
  for (const [x0, y0] of [[1, 1], [9, 1], [1, 9], [9, 9]]) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) t.px(x0 + x, y0 + y, csh(glass[(x + y + r.int(2)) % 3], 0.94 + r.next() * 0.1));
  for (let i = 0; i < 16; i++) { t.px(i, 7, csh(frame, 0.8)); t.px(i, 8, csh(frame, 1.15)); t.px(7, i, csh(frame, 0.8)); t.px(8, i, csh(frame, 1.15)); }
  tFrame(t, csh(frame, 0.7));
}
TP('redstone_lamp', (t, r) => lampTex(t, r, false));
TP('redstone_lamp_on', (t, r) => lampTex(t, r, true));
TP('sponge', (t, r) => { tBase(t, r, 0xCBB84C, 0.1, 4, 0.5); for (let k = 0; k < 14; k++) { const x = r.int(15), y = r.int(15); t.px(x, y, 0x8C7A2A); if (r.next() < 0.5) t.px(x + 1, y, 0x9C8A34); } });
TP('wet_sponge', (t, r) => { tBase(t, r, 0xA89B3E, 0.1, 4, 0.5); for (let k = 0; k < 14; k++) { const x = r.int(15), y = r.int(15); t.px(x, y, 0x5E5E3A); if (r.next() < 0.5) t.px(x, y + 1, 0x6E6C40); } tSpeck(t, r, 0xC8C070, 6, 0.05); });
TP('slime_block', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15, inner = x >= 3 && x <= 12 && y >= 3 && y <= 12; t.px(x, y, csh(edge ? 0x5E9E48 : inner ? 0x6FB854 : 0x88D06A, 0.95 + r.next() * 0.08), edge ? 235 : inner ? 225 : 150); } for (let i = 4; i < 7; i++) t.px(i, 4, 0xB8F0A0, 230); });
TP('dried_kelp_side', (t, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) t.px(x, y, csh(x % 4 === 0 ? 0x26301C : 0x323E24, 0.9 + r.next() * 0.18)); for (const y of [4, 11]) for (let x = 0; x < 16; x++) t.px(x, y, 0x5A5A3A); });
TP('dried_kelp_top', (t, r) => { tRings(t, r, [0x323E24, 0x3A4A2A, 0x283220]); for (let i = 0; i < 16; i++) { t.px(i, 7, 0x5A5A3A); t.px(7, i, 0x5A5A3A); } });
TP('soul_lantern', (t, r) => { t.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x < 2 || x > 13 || y < 2 || y > 13; t.px(x, y, edge ? 0x2E3440 : ((x + y) % 5 === 0 ? 0xC8FFFF : 0x6ADCE8)); } });
TP('campfire_log', (t, r) => { for (let y = 0; y < 16; y++) { const f = y % 4 === 0 ? 0.75 : 0.95 + hashF2(3, 0, y) * 0.1; for (let x = 0; x < 16; x++) t.px(x, y, csh(0x5E4526, f * (0.92 + r.next() * 0.14))); } });
TP('campfire_log_lit', (t, r) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, csh(0x2E2218, 0.85 + r.next() * 0.3)); for (let k = 0; k < 6; k++) { let x = r.int(16); const y = r.int(16); for (let i = 0; i < 4; i++) t.px(x++, y, r.pick([0xFF9A2A, 0xFFC050, 0xE85A10])); } });
function flameTex(t, r, cols) {
  t.clear();
  const hts = []; for (let x = 0; x < 16; x++) hts.push(Math.max(0, 5 + r.int(7) + (x % 5 === 2 ? 3 : 0) - Math.abs(x - 7.5) * 0.5));
  for (let x = 0; x < 16; x++) { const hh = Math.min(15, hts[x] | 0); for (let y = 16 - hh; y < 16; y++) { const f = (16 - y) / Math.max(1, hh); t.px(x, y, f > 0.8 ? cols[0] : f > 0.5 ? cols[1] : f > 0.25 ? cols[2] : cols[3]); } }
}
TP('campfire_fire', (t, r) => flameTex(t, r, [0xD8360E, 0xF56A18, 0xFFA82A, 0xFFE27A]));
TP('soul_campfire_fire', (t, r) => flameTex(t, r, [0x1E7E9A, 0x2AAEC8, 0x6ADCF0, 0xC8FFFF]));
TP('chain', (t, r) => { t.clear(); for (let y = 0; y < 16; y++) { const link = (y >> 2) & 1; if (link) { t.px(7, y, 0x6E747E); t.px(8, y, 0x4E545C); } else { if ((y & 3) === 0 || (y & 3) === 3) { t.px(6, y, 0x6E747E); t.px(9, y, 0x4E545C); t.px(7, y, 0x8E949E); t.px(8, y, 0x8E949E); } else { t.px(6, y, 0x7E848E); t.px(9, y, 0x464C54); } } } });
TP('blast_furnace_side', (t, r) => { paintTex('smooth_stone', t); for (const y of [0, 5, 10, 15]) for (let x = 0; x < 16; x++) t.px(x, y, csh(0x4E5054, 0.9 + r.next() * 0.2)); for (let y = 0; y < 16; y++) { t.px(0, y, 0x3E4044); t.px(15, y, 0x3E4044); } });
TP('blast_furnace_top', (t, r) => { tMetal(t, r, 0x5A5C60, 0x6E7074, 0x3A3C40); for (let i = 4; i < 12; i++) { t.px(i, 4, 0x2A2C30); t.px(i, 11, 0x2A2C30); t.px(4, i, 0x2A2C30); t.px(11, i, 0x2A2C30); } for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) t.px(x, y, (x + y) & 1 ? 0x3A3C40 : 0x46484C); });
function blastFront(t, r, lit) { paintTex('blast_furnace_side', t); t.rect(3, 6, 10, 7, 0x1E1E20); for (let x = 3; x < 13; x += 2) t.rect(x, 6, 1, 7, 0x4A4C50); if (lit) for (let x = 4; x < 12; x += 2) for (let y = 8; y < 13; y++) t.px(x, y, y > 10 ? 0xFFB43A : 0xFF6A1A); }
TP('blast_furnace_front', (t, r) => blastFront(t, r, false));
TP('blast_furnace_front_on', (t, r) => blastFront(t, r, true));
TP('smoker_side', (t, r) => { tLogSide(t, r, 0x5E4526, 0x3E2E18, false); for (const y of [2, 13]) for (let x = 0; x < 16; x++) { t.px(x, y, 0x4A4C50); t.px(x, y + 1, 0x3A3C40); } });
TP('smoker_top', (t, r) => { tMetal(t, r, 0x4E5054, 0x62646A, 0x34363A); t.rect(5, 5, 6, 6, 0x222226); t.rect(6, 6, 4, 4, 0x2E2E32); });
TP('smoker_bottom', (t, r) => { paintTex('smooth_stone', t); });
function smokerFront(t, r, lit) { paintTex('smoker_side', t); t.rect(3, 6, 10, 6, 0x1E1E20); for (let x = 3; x < 13; x++) t.px(x, 5, 0x4A4C50); if (lit) for (let x = 4; x < 12; x++) { const hh = 1 + r.int(3); for (let y = 11 - hh; y < 12; y++) t.px(x, y, y > 10 - hh / 2 ? 0xFFB43A : 0xFF7A1A); } }
TP('smoker_front', (t, r) => smokerFront(t, r, false));
TP('smoker_front_on', (t, r) => smokerFront(t, r, true));
TP('note_block', (t, r) => { tPlanks(t, r, 0x6A4630); tFrame(t, 0x3E2818); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d < 3.5) t.px(x, y, csh(0x1E140C, 0.9 + (d / 3.5) * 0.4)); } t.px(6, 6, 0x5A3A22); });
// ---------------------------------------------------------------- ocean
const CORAL_C = { tube: 0x3257D0, brain: 0xCF5B9E, bubble: 0xA116AD, fire: 0xC72E3A, horn: 0xD8C443 };
for (const c of CORALS) {
  const col = CORAL_C[c];
  TP(c + '_coral_block', (t, r) => { tCells(t, r, [col, csh(col, 1.14), csh(col, 0.86), csh(col, 1.05)], 11, csh(col, 0.55), true); for (let k = 0; k < 10; k++) t.px(r.int(16), r.int(16), csh(col, 0.5)); });
  TP(c + '_coral', (t, r) => {
    t.clear();
    if (c === 'brain') { for (let y = 5; y < 16; y++) for (let x = 3; x < 13; x++) { const d = Math.hypot(x - 7.5, (y - 10) * 1.2); if (d < 5 && r.next() < 0.9) t.px(x, y, csh(col, (x + y) % 3 === 0 ? 0.75 : 1.0 + r.next() * 0.15)); } return; }
    if (c === 'bubble') { for (let k = 0; k < 9; k++) { const cx = 3 + r.int(10), cy = 3 + r.int(12), rr = 1 + r.int(2); for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) if (x * x + y * y <= rr * rr) t.px(cx + x, cy + y, csh(col, x * x + y * y >= rr * rr - 1 ? 1.15 : 0.85)); } stem(t, 7, 12, 15, csh(col, 0.7)); return; }
    const branches = c === 'horn' ? 3 : 5;
    for (let b = 0; b < branches; b++) {
      let x = 3 + b * (10 / branches) + r.int(2), y = 15;
      const lean = (b - branches / 2) * 0.25;
      for (let i = 0; i < 11 + r.int(4); i++) {
        t.px(Math.round(x), y, csh(col, 0.85 + r.next() * 0.3));
        if (c === 'horn' && i > 4) { t.px(Math.round(x) - 1, y, csh(col, 1.1)); t.px(Math.round(x) + 1, y, csh(col, 0.9)); }
        if (c === 'fire' && i % 3 === 2) t.px(Math.round(x) + (r.next() < 0.5 ? 1 : -1), y, csh(col, 1.2));
        y--; x += lean + (r.next() - 0.5) * 0.6;
      }
      if (c === 'tube') t.px(Math.round(x), y + 1, csh(col, 1.4));
    }
  });
}
TP('sea_pickle', (t, r) => { t.clear(); for (const [x0, h] of [[4, 6], [8, 8], [11, 5]]) for (let y = 16 - h; y < 16; y++) { t.px(x0, y, 0x5A7A2A); t.px(x0 + 1, y, 0x6E9434); if (y === 16 - h) { t.px(x0, y, 0xC8F07A); t.px(x0 + 1, y, 0xE8FFA8); } } });
// ---------------------------------------------------------------- dyed (tinted in the mesher; kept near-white)
TP('concrete', (t, r) => { tBase(t, r, 0xF4F4F4, 0.035, 3, 0.4); });
TP('concrete_powder', (t, r) => { tBase(t, r, 0xF2F2F2, 0.1, 4, 0.8); tSpeck(t, r, 0xDADADA, 20, 0.04); tSpeck(t, r, 0xFFFFFF, 14, 0.02); });
// ---------------------------------------------------------------- cherry + stripped logs
TP('cherry_log', (t, r) => { tLogSide(t, r, WOODC.cherry.bark, WOODC.cherry.dark, true); for (let k = 0; k < 6; k++) { const y = r.int(16); for (let x = 0; x < 16; x++) if (r.next() < 0.5) t.px(x, y, csh(0x4E2E36, 0.9 + r.next() * 0.2)); } });
TP('cherry_log_top', (t, r) => tLogTop(t, r, WOODC.cherry.inner, WOODC.cherry.ring, WOODC.cherry.bark));
TP('cherry_planks', (t, r) => tPlanks(t, r, WOODC.cherry.plank));
TP('cherry_leaves', (t, r) => {
  const vn = vnoise(r, 8);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = vn(x, y) * 0.6 + r.next() * 0.4;
    if (r.next() < 0.26 * (1.2 - v)) { t.px(x, y, 0xE8A0C0, 0); continue; }
    const c = v > 0.72 ? 0xFBD2E4 : v > 0.45 ? 0xF2A7C8 : v > 0.25 ? 0xE488B2 : 0xC86C98;
    t.px(x, y, csh(c, 0.95 + r.next() * 0.1));
  }
});
TP('cherry_sapling', (t, r) => sapling(t, r, 0x4A2A30, 0xEE9AC0));
TP('pink_petals', (t, r) => { t.clear(); for (let k = 0; k < 7; k++) { const cx = 1 + r.int(13), cy = 1 + r.int(13); for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) t.px(cx + dx, cy + dy, csh(r.next() < 0.5 ? 0xF4A6C8 : 0xF8C4DA, 0.95 + r.next() * 0.1)); t.px(cx + 2, cy + 1, 0x4E8A2E); } });
for (const w of WOODS_ALL) {
  const c = WOODC[w];
  TP('stripped_' + w + '_log', (t, r) => tGrain(t, r, mixColor(c.plank, c.inner, 0.4), 0.14));
  TP('stripped_' + w + '_log_top', (t, r) => tLogTop(t, r, c.inner, c.ring, csh(c.plank, 0.92)));
}
TP('stripped_crimson_stem', (t, r) => tGrain(t, r, 0x9C3F5E, 0.16));
TP('stripped_crimson_stem_top', (t, r) => tLogTop(t, r, 0xA24A6A, 0x7E3052, 0x8E3A58));
TP('stripped_warped_stem', (t, r) => tGrain(t, r, 0x3A9A8E, 0.16));
TP('stripped_warped_stem_top', (t, r) => tLogTop(t, r, 0x3AA59A, 0x2C7F77, 0x33938A));
// ---------------------------------------------------------------- doors & trapdoors per wood
const DOOR_STYLE = { spruce: 'solid', birch: 'grid', jungle: 'ornate', acacia: 'diamond', dark_oak: 'window', cherry: 'two', crimson: 'slits', warped: 'grid' };
const DOOR_PLANK = { spruce: 0x6E5132, birch: 0xD2C290, jungle: 0xA67551, acacia: 0xAC5C33, dark_oak: 0x4F3822, cherry: 0xE0B0AA, crimson: 0x6B344B, warped: 0x2B6863 };
function doorTex(t, r, w, top) {
  const pc = DOOR_PLANK[w], fr = csh(pc, 0.62), st = DOOR_STYLE[w];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) t.px(x, y, csh(pc, (x % 5 === 4 ? 0.84 : 0.96) + r.next() * 0.07));
  for (let i = 0; i < 16; i++) { t.px(0, i, fr); t.px(15, i, fr); }
  for (let i = 0; i < 16; i++) t.px(i, top ? 0 : 15, fr);
  const hole = (x, y, w2, h2) => t.rect(x, y, w2, h2, 0, 0);
  if (top) {
    if (st === 'grid') { for (const [x, y] of [[2, 2], [6, 2], [10, 2], [2, 7], [6, 7], [10, 7]]) hole(x, y, 3, 4); }
    else if (st === 'ornate') { hole(2, 2, 5, 6); hole(9, 2, 5, 6); t.px(4, 4, pc); t.px(11, 4, pc); t.rect(2, 10, 12, 1, fr); }
    else if (st === 'diamond') { for (let d = 0; d < 5; d++) { hole(7 - d, 3 + d, 2 * d + 2, 1); hole(7 - d, 12 - d, 2 * d + 2, 1); } }
    else if (st === 'window') { hole(4, 3, 8, 5); t.rect(4, 5, 8, 1, fr); t.rect(7, 3, 1, 5, fr); }
    else if (st === 'two') { hole(3, 2, 4, 9); hole(9, 2, 4, 9); }
    else if (st === 'slits') { for (const x of [3, 7, 11]) hole(x, 2, 2, 9); }
    else { for (let x = 1; x < 15; x++) { t.px(x, 5, fr); t.px(x, 10, fr); } }
    for (let i = 2; i < 14; i++) t.px(i, 13, csh(pc, 0.8));
  } else {
    t.rect(3, 3, 10, 9, csh(pc, 0.88)); for (let i = 3; i < 13; i++) { t.px(i, 3, fr); t.px(i, 11, csh(pc, 1.1)); }
    if (st === 'slits' || st === 'grid') for (let y = 4; y < 11; y += 3) for (let x = 4; x < 12; x++) t.px(x, y, csh(pc, 0.75));
    t.rect(12, 6, 2, 2, w === 'birch' || w === 'cherry' ? 0x5A5A5A : 0xB8B8B8);
  }
}
function trapTex(t, r, w) {
  const pc = DOOR_PLANK[w], fr = csh(pc, 0.62), st = DOOR_STYLE[w];
  tPlanks(t, r, pc); tFrame(t, fr);
  const holes = st === 'grid' || st === 'slits' ? [[3, 3, 3, 3], [10, 3, 3, 3], [3, 10, 3, 3], [10, 10, 3, 3], [6, 6, 4, 4]] : st === 'solid' ? [] : st === 'diamond' ? [[6, 3, 4, 2], [4, 5, 8, 2], [4, 9, 8, 2], [6, 11, 4, 2]] : [[3, 3, 4, 4], [9, 3, 4, 4], [3, 9, 4, 4], [9, 9, 4, 4]];
  for (const [x, y, a, b] of holes) t.rect(x, y, a, b, 0, 0);
  if (st === 'solid') for (let i = 1; i < 15; i++) { t.px(i, 5, fr); t.px(i, 10, fr); }
}
for (const w of DOOR_WOODS) {
  TP(w + '_door_top', (t, r) => doorTex(t, r, w, true));
  TP(w + '_door_bottom', (t, r) => doorTex(t, r, w, false));
  TP(w + '_trapdoor', (t, r) => trapTex(t, r, w));
}
// ---------------------------------------------------------------- plants
TP('orange_tulip', (t, r) => flower(t, r, 0xF0852A, 0xF0852A, 0x4E8A2E, 'tulip'));
TP('white_tulip', (t, r) => flower(t, r, 0xF2F2EE, 0xF2F2EE, 0x4E8A2E, 'tulip'));
TP('pink_tulip', (t, r) => flower(t, r, 0xF2A2C4, 0xF2A2C4, 0x4E8A2E, 'tulip'));
TP('torchflower', (t, r) => { flower(t, r, 0xF26A1E, 0xFFD24A, 0x4E8A2E, 'tulip'); t.px(7, 1, 0xFFE27A); t.px(7, 2, 0xFFB43A); t.px(6, 2, 0xF26A1E); t.px(8, 2, 0xF26A1E); });
function berryBush(t, r, stage) {
  t.clear();
  const n = [10, 22, 34, 40][stage], top = [11, 7, 4, 3][stage];
  for (let k = 0; k < n; k++) { const x = 1 + r.int(14), y = top + r.int(16 - top); t.px(x, y, csh(r.next() < 0.5 ? 0x2E6A2A : 0x3E7E34, 0.85 + r.next() * 0.3)); if (r.next() < 0.5) t.px(x + 1, y, csh(0x357630, 0.9)); }
  if (stage >= 2) for (let k = 0; k < (stage === 3 ? 9 : 4); k++) { const x = 2 + r.int(12), y = top + 1 + r.int(12 - top); const c = stage === 3 ? 0xD8201A : 0x8AB84A; t.px(x, y, c); t.px(x + 1, y, csh(c, 0.8)); t.px(x, y + 1, csh(c, 0.7)); }
}
for (let s = 0; s < 4; s++) { TP('sweet_berry_bush_' + s, (t, r) => berryBush(t, r, s)); TP('beetroots_' + s, (t, r) => { crop(t, r, s, 'beet'); if (s === 3) for (let k = 0; k < 6; k++) { const x = 1 + k * 2.6 | 0; t.px(x, 15, 0xA8202E); t.px(x + 1, 15, 0x8E1826); t.px(x, 14, 0xC02838); } }); }
TP('glow_lichen', (t, r) => { t.clear(); for (let k = 0; k < 24; k++) { const x = r.int(16), y = r.int(16); t.px(x, y, r.next() < 0.3 ? 0xE8F8C0 : r.next() < 0.5 ? 0xA8CC98 : 0x7EA884); if (r.next() < 0.4) t.px(x + 1, y, 0x8EB890); } });
TP('amethyst_cluster', (t, r) => { t.clear(); for (const [x0, h, lean] of [[4, 9, -0.25], [7, 13, 0], [10, 10, 0.3], [6, 6, -0.1], [11, 6, 0.2]]) { let x = x0; for (let i = 0; i < h; i++) { const y = 15 - i, w = i < h - 3 ? 2 : 1; for (let k = 0; k < w; k++) t.px(Math.round(x) + k, y, csh(k ? 0x8A5CC8 : 0xB894F0, 0.9 + (i / h) * 0.3)); x += lean; } t.px(Math.round(x), 15 - h, 0xE8D8FF); } });
function dripTex(t, r, down) { t.clear(); for (let i = 0; i < 16; i++) { const y = down ? i : 15 - i, w = Math.max(1, Math.round(4 - i * 0.24)); for (let k = 0; k < w; k++) t.px(8 - Math.ceil(w / 2) + k, y, csh(0x8A6B50, 0.8 + k / w * 0.35 + r.next() * 0.08)); } }
TP('pointed_dripstone_down', (t, r) => dripTex(t, r, true));
TP('pointed_dripstone_up', (t, r) => dripTex(t, r, false));
function hangVines(t, r, c, up) { t.clear(); for (let k = 0; k < 5; k++) { let x = 2 + k * 3 + r.int(2); for (let i = 0; i < 16; i++) { const y = up ? 15 - i : i; t.px(x, y, csh(c, 0.8 + r.next() * 0.35)); if (r.next() < 0.25) t.px(x + (r.next() < 0.5 ? 1 : -1), y, csh(c, 1.15)); if (r.next() < 0.2) x += r.int(3) - 1; } } }
TP('weeping_vines', (t, r) => hangVines(t, r, 0xA82E24, false));
TP('twisting_vines', (t, r) => hangVines(t, r, 0x1FA28E, true));
TP('nether_sprouts', (t, r) => { t.clear(); for (let k = 0; k < 9; k++) { let x = 1 + r.int(14); for (let y = 15; y > 9 + r.int(4); y--) { t.px(x, y, csh(0x16A08E, 0.8 + r.next() * 0.4)); if (r.next() < 0.3) x += r.int(3) - 1; } } });
// ---------------------------------------------------------------- items
MATS.netherite = [0x4C464A, 0x747074, 0x2A2628];
MATS.chainmail = [0x8C9096, 0xC4C8CE, 0x4E5258];
for (const k of ['sword', 'pickaxe', 'axe', 'shovel', 'hoe']) IP('netherite_' + k, (t) => drawTool(t, k, 'netherite'));
for (const mat of ['netherite', 'chainmail']) for (const k in ARMOR_MASK) IP(mat + '_' + k, (t) => {
  const [m, l, d] = MATS[mat]; drawMask(t, ARMOR_MASK[k], { m, l, d });
  if (mat === 'chainmail') for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.a(x, y) && ((x + y) & 1)) t.mulPx(x, y, 0.72);
  outline(t, 0.4);
});
IP('raw_iron', (t, r) => { t.clear(); ell(t, 8, 9, 5, 4.2, 0xD2AE94, r, 0.25); ell(t, 10, 6.5, 2.4, 2, 0xE2C2A8); pxs(t, [[5, 8], [9, 10], [7, 11]], 0x9A7864); hl(t, 6, 7); outline(t, 0.45); });
IP('raw_copper', (t, r) => { t.clear(); ell(t, 8, 9, 5, 4.2, 0xC4683E, r, 0.25); ell(t, 10, 6.5, 2.4, 2, 0xDA8454); pxs(t, [[5, 9], [10, 10]], 0x6EA88A); pxs(t, [[8, 11]], 0x8A4428); hl(t, 6, 7); outline(t, 0.45); });
IP('raw_gold', (t, r) => { t.clear(); ell(t, 8, 9, 5, 4.2, 0xE4B232, r, 0.25); ell(t, 10, 6.5, 2.4, 2, 0xF6D050); pxs(t, [[5, 9], [9, 11]], 0xA8801C); hl(t, 6, 7); outline(t, 0.45); });
IP('copper_ingot', (t) => ingot(t, 0xD87A4E, 0xF6A47C, 0x94482C));
IP('netherite_ingot', (t) => ingot(t, 0x4A4448, 0x74707A, 0x28242A));
IP('netherite_scrap', (t, r) => { t.clear(); ell(t, 8, 8.5, 5.4, 4.6, 0x5A4642, r, 0.3); for (let k = 0; k < 4; k++) { const y = 6 + k * 2; for (let x = 4; x < 12; x++) if (r.next() < 0.7) t.px(x, y, 0x3A2C2A); } pxs(t, [[6, 6], [9, 7]], 0x8A7068); outline(t, 0.45); });
IP('amethyst_shard', (t) => { t.clear(); const rows = [, , '......l.........', '.....lml........', '.....lmmd.......', '....lmmmd.......', '....lmmmmd......', '...lmmmmmd......', '...lmmmmmmd.....', '..lmmmmmmmd.....', '..lmmmmmmd......', '...dmmmmd.......', '....ddmd........', '......d.........']; drawMask(t, rows, { m: 0x9A6ED8, l: 0xD8C0FF, d: 0x5E3A96 }); t.px(6, 5, 0xFFFFFF); outline(t, 0.4); });
IP('prismarine_shard', (t) => { t.clear(); const rows = [, , '.........ll.....', '........lmmd....', '.......lmmd.....', '......lmmmd.....', '.....lmmmd......', '....lmmmmd......', '...lmmmmd.......', '..lmmmd.........', '..dmmd..........', '...dd...........']; drawMask(t, rows, { m: 0x6CB4A6, l: 0xB8F0E2, d: 0x3A7468 }); outline(t, 0.4); });
IP('prismarine_crystals', (t, r) => { t.clear(); for (let k = 0; k < 7; k++) { const x = 3 + r.int(10), y = 3 + r.int(10); t.rect(x, y, 2, 2, r.pick([0xC8F4E6, 0x9EDCCB, 0xE8FFF6])); t.px(x, y, 0xFFFFFF); } outline(t, 0.45); });
IP('spyglass', (t) => { t.clear(); for (let i = 0; i < 9; i++) { t.px(3 + i, 12 - i, 0xC88A3A); t.px(4 + i, 12 - i, 0x8E5A22); t.px(3 + i, 11 - i, 0xE8B060); } pxs(t, [[12, 3], [13, 2], [12, 2], [13, 3]], 0x9A6ED8); pxs(t, [[13, 1], [14, 2]], 0xD8C0FF); pxs(t, [[2, 13], [3, 13], [2, 12]], 0x6A4420); outline(t, 0.45); });
IP('compass', (t) => { t.clear(); circ(t, 8, 8, 6, 0x8E8E96); circ(t, 8, 8, 4.6, 0x3A3A44); t.line(8, 8, 11, 4, 0xE8221E); t.line(8, 8, 5, 12, 0xE8E8E8); t.px(8, 8, 0x1A1A1A); hl(t, 5, 4); outline(t, 0.45); });
IP('clock', (t) => { t.clear(); circ(t, 8, 8, 6, 0xE0B03A); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8); if (d < 4.6) t.px(x, y, y < 8 ? 0x3A5AC8 : 0x6AA8F0); } circ(t, 10, 6.5, 1.2, 0xFFE27A); t.line(8, 8, 8, 4, 0x1A1A1A); hl(t, 5, 4); outline(t, 0.45); });
IP('ender_pearl', (t, r) => { t.clear(); circ(t, 8, 8.5, 5, 0x1A6A5E, r, 0.2); circ(t, 8, 8.5, 3, 0x2E9A88); circ(t, 7.5, 8, 1.4, 0x7AE0C8); hl(t, 6, 6); outline(t, 0.45); });
IP('fishing_rod', (t) => { t.clear(); for (let i = 0; i < 12; i++) t.px(2 + i, 14 - i, i < 3 ? 0x5A3A1A : 0x8A6236); t.line(13, 2, 13, 11, 0xE8E8E8); pxs(t, [[12, 12], [13, 12], [12, 11]], 0xB0B0B0); outline(t, 0.45); });
IP('p_bobber', (t) => { t.clear(); circ(t, 8, 8, 3.4, 0xE8221E); for (let x = 4; x < 12; x++) for (let y = 8; y < 12; y++) if (t.a(x, y)) t.px(x, y, 0xF2F2F2); t.px(8, 3, 0x2A2A2A); t.px(8, 4, 0x2A2A2A); });
IP('beetroot', (t, r) => { t.clear(); ell(t, 8, 10, 4.2, 4.4, 0xA8202E, r, 0.2); pxs(t, [[6, 9], [7, 8]], 0xD04050); pxs(t, [[8, 15]], 0x7A1420); pxs(t, [[7, 5], [8, 4], [9, 5], [8, 3], [10, 3], [6, 3], [7, 4], [9, 4]], 0x4E9A2A); pxs(t, [[8, 2], [10, 2], [6, 2]], 0x3E8A22); outline(t, 0.45); });
IP('beetroot_seeds', (t, r) => { t.clear(); for (let k = 0; k < 7; k++) { const x = 3 + r.int(10), y = 5 + r.int(8); t.px(x, y, 0xB08A5A); t.px(x, y + 1, 0x7A5A34); } outline(t, 0.5); });
IP('beetroot_soup', (t) => { paintItem('bowl', t); for (let x = 3; x < 13; x++) { t.px(x, 8, 0xA8202E); t.px(x, 7, x % 3 ? 0x8E1826 : 0xC8303E); } });
IP('sweet_berries', (t) => { t.clear(); for (const [x, y] of [[6, 9], [10, 8], [8, 12]]) { circ(t, x, y, 2.3, 0xC8201A); t.px(x - 1, y - 2, 0xF06050); } pxs(t, [[8, 4], [8, 5], [9, 3], [7, 6], [9, 6]], 0x3E7A2A); outline(t, 0.45); });
IP('golden_carrot', (t) => { t.clear(); for (let i = 0; i < 8; i++) { t.px(3 + i, 12 - i, 0xF2C83A); t.px(4 + i, 12 - i, 0xC89A1A); if (i < 6) t.px(4 + i, 11 - i, 0xFFF0A0); } t.px(2, 13, 0xC89A1A); pxs(t, [[11, 3], [12, 2], [12, 4], [13, 3], [13, 1], [14, 2], [11, 1]], 0xE8D060); outline(t, 0.45); });
function fishTex(t, r, body, belly, fin, spot) {
  t.clear();
  const rows = [, , , , '......bbbbb.....', '....bbbbbbbbb..f', '..ebbbbbbbbbbbff', '.bbbbbbbbbbbbbff', '..wwwwwwwwwwww.f', '....wwwwwwwww...', '......wwww......'];
  drawMask(t, rows, { b: body, w: belly, f: fin, e: 0x1A1A1A });
  if (spot) for (let k = 0; k < 5; k++) t.px(4 + r.int(9), 5 + r.int(3), spot);
  outline(t, 0.4);
}
IP('cod', (t, r) => fishTex(t, r, 0xB0986E, 0xD8CCB0, 0x8E7A56, 0x8A7456));
IP('salmon', (t, r) => fishTex(t, r, 0xB0443A, 0xE88A70, 0x7A2A24, 0x6A5A5A));
IP('cooked_cod', (t, r) => fishTex(t, r, 0xD8B888, 0xF0DCB8, 0xB0905A, 0xB89868));
IP('cooked_salmon', (t, r) => fishTex(t, r, 0xD8784A, 0xF0A878, 0xA8502E, 0xB86A40));
IP('tropical_fish', (t, r) => { fishTex(t, r, 0xF08A1E, 0xF8C070, 0xE8E8E8, 0); for (let y = 4; y < 11; y++) { if (t.a(6, y)) t.px(6, y, 0xF4F4F4); if (t.a(10, y)) t.px(10, y, 0xF4F4F4); } });
function doorItem(t, w) {
  t.clear();
  const top = paintTex(w + '_door_top'), bot = paintTex(w + '_door_bottom');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
    const src = y < 8 ? top : bot, sy = (y & 7) * 2, sx = x * 2;
    if (src.a(sx, sy) > 128) t.px(x + 4, y, src.get(sx, sy));
  }
  outline(t, 0.5);
}
for (const w of DOOR_WOODS) IP(w + '_door_item', (t) => doorItem(t, w));
function campfireItem(t, fire) {
  t.clear();
  const f = paintTex(fire);
  for (let y = 1; y < 11; y++) for (let x = 3; x < 13; x++) { const sy = 5 + ((y - 1) * 11 / 10 | 0); if (f.a(x, sy) > 128) t.px(x, y, f.get(x, sy)); }
  for (const y of [11, 13]) for (let x = 1; x < 15; x++) { t.px(x, y, 0x6B4E2A); t.px(x, y + 1, 0x4E3818); }
  for (let x = 3; x < 13; x += 3) t.px(x, 12, 0x3A2A18);
  outline(t, 0.45);
}
IP('campfire_item', (t) => campfireItem(t, 'campfire_fire'));
IP('soul_campfire_item', (t) => campfireItem(t, 'soul_campfire_fire'));
IP('p_petal', (t) => { t.clear(); ell(t, 8, 8, 3.2, 2.2, 0xFFFFFF); t.px(10, 9, 0xE8E8E8); });
IP('p_firefly', (t) => { t.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8); if (d < 5) t.px(x, y, 0xFFFFFF, d < 2 ? 255 : Math.round(210 * (1 - (d - 2) / 3))); } });
// new item textures must be registered after 06 built the index
for (const n of Object.keys(ITEM_PAINT)) itx(n);
