// ============================================================================
//  Procedural textures for the End: blocks, items and particles (same 16x16 toolkit as 05-07)
// ============================================================================
TP('end_stone', (t, r) => {
  tBase(t, r, 0xDAD99C, 0.1, 4, 0.55); tBlobs(t, r, 0xC6C589, 6, 2, 0.08);
  for (let k = 0; k < 9; k++) { const x = r.int(16), y = r.int(16); t.px(x, y, 0xA9A870); t.px(x + 1, y, 0xBDBC80); if (r.next() < 0.5) t.px(x, y + 1, 0xC0BF84); }
  tSpeck(t, r, 0xEDEDB8, 12, 0.04);
});
TP('end_stone_bricks', (t, r) => { tBricks(t, r, 0xDEDDA4, 0xB2B07A, 4, 8, 0.14, true); tSpeck(t, r, 0xC8C78C, 10, 0.06); });
TP('purpur_block', (t, r) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const lx = x & 7, ly = y & 7, edge = lx === 7 || ly === 7, hi = lx === 0 || ly === 0;
    t.px(x, y, csh(edge ? 0x7C587C : hi ? 0xBA8CBA : 0xA77BA7, 0.94 + r.next() * 0.1));
  }
  tSpeck(t, r, 0x986C98, 14, 0.08);
});
TP('purpur_pillar', (t, r) => {
  for (let x = 0; x < 16; x++) { const rib = x % 4, c = rib === 0 ? 0x86628A : rib === 1 ? 0xB38BB5 : 0xA67CA8; for (let y = 0; y < 16; y++) t.px(x, y, csh(c, 0.95 + r.next() * 0.08)); }
  for (const y of [0, 15]) for (let x = 0; x < 16; x++) t.px(x, y, 0x7A567E);
});
TP('purpur_pillar_top', (t, r) => { tRings(t, r, [0xA77BA7, 0x9A6E9A, 0xB388B3, 0x8A628A], 7.5, 7.5, true); tFrame(t, 0x7A567E); });
// frame: the side is 13/16 tall, so its visible texture starts at row 3
TP('end_portal_frame_top', (t, r) => {
  tBase(t, r, 0x3F6E58, 0.12, 3, 0.5); tFrame(t, 0x28483A);
  for (let i = 3; i < 13; i++) { t.px(i, 3, 0x5E9A7C); t.px(i, 12, 0x5E9A7C); t.px(3, i, 0x5E9A7C); t.px(12, i, 0x5E9A7C); }
  tSpeck(t, r, 0x2E5040, 10, 0.1);
});
TP('end_portal_frame_side', (t, r) => {
  paintTex('end_stone', t);
  for (let x = 0; x < 16; x++) { t.px(x, 3, 0x2E5040); t.px(x, 4, 0x4A7E66); t.px(x, 5, 0x3F6E58); t.px(x, 6, 0x2A4638); if ((x & 3) === 1) t.px(x, 5, 0x7EC8A0); }
});
TP('end_portal_frame_eye', (t, r) => {
  t.fill(0x1A3628);
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) { const d = Math.hypot(x - 7.5, y - 7.5); t.px(x, y, d < 1.2 ? 0x081009 : d < 2.5 ? 0x3AB888 : d < 3.5 ? 0x1E6A4E : 0x143A2A); }
  t.px(6, 6, 0xC8FFE8); for (let x = 4; x < 12; x++) t.px(x, 1, 0x2E6A4E);
});
TP('end_portal', (t, r) => { t.fill(0x05070C); for (let k = 0; k < 14; k++) t.px(r.int(16), r.int(16), r.pick([0x2E6A6A, 0x3A9A9A, 0x9AF0E0, 0x4A4AA0])); });
// end rod: the rod boxes sample columns 7-8, the base plate columns 6-9
TP('end_rod', (t, r) => { t.fill(0xC8B8D0); for (let y = 0; y < 16; y++) { t.px(7, y, 0xFFFFFF); t.px(8, y, csh(0xF2EEF6, 0.97 + r.next() * 0.05)); t.px(6, y, 0xB4A2BE); t.px(9, y, 0xA894B4); } });
TP('chorus_plant', (t, r) => { tBase(t, r, 0x5E3F5F, 0.16, 4, 0.5); tSpeck(t, r, 0x8E6A8E, 18, 0.1); tSpeck(t, r, 0x3E2A40, 10, 0.1); });
TP('chorus_flower', (t, r) => {
  tBase(t, r, 0xA78AA8, 0.1, 3, 0.4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot((x & 7) - 3.5, (y & 7) - 3.5); if (d < 2.2) t.px(x, y, csh(0xE6CCE8, 0.95 + r.next() * 0.08)); else if (d > 3.4) t.px(x, y, csh(0x7C5C7E, 0.9 + r.next() * 0.1)); }
});
TP('dragon_egg', (t, r) => { tBase(t, r, 0x0E0A12, 0.25, 4, 0.6); tSpeck(t, r, 0x2A1A38, 20, 0.2); for (let k = 0; k < 9; k++) t.px(r.int(16), r.int(16), r.pick([0x5A2A7E, 0x7A3AA8, 0x3E1E5A])); });
// ---------------------------------------------------------------- items
IP('ember_powder', (t, r) => dust(t, r, 0xF2A03A, 0xFFE08A));
IP('eye_of_ender', (t, r) => { t.clear(); circ(t, 8, 8.5, 5, 0x1E5A3A, r, 0.2); circ(t, 8, 8.5, 3.4, 0x3AB87A); for (let y = 6; y < 12; y++) t.px(8, y, 0x0A1A10); t.px(7, 8, 0x0A1A10); t.px(9, 9, 0x0A1A10); hl(t, 6, 6); outline(t, 0.45); });
IP('chorus_fruit', (t, r) => { t.clear(); ell(t, 8, 9, 5, 4.6, 0x8E5E90, r, 0.25); pxs(t, [[6, 7], [10, 8], [8, 11], [9, 6]], 0xC89AC8); pxs(t, [[8, 4], [8, 3], [9, 3]], 0x5E3A60); outline(t, 0.45); });
IP('popped_chorus_fruit', (t, r) => { t.clear(); ell(t, 8, 9, 5, 4.6, 0xB888B8, r, 0.2); for (let k = 0; k < 7; k++) t.px(4 + r.int(9), 5 + r.int(8), 0xEAD0EA); pxs(t, [[6, 8], [10, 10]], 0x7E5A80); outline(t, 0.45); });
IP('end_crystal', (t) => {
  t.clear();
  for (let i = 2; i < 14; i++) { t.px(i, 2, 0xD8C8F0); t.px(i, 13, 0xB8A8D8); t.px(2, i, 0xD8C8F0); t.px(13, i, 0xB8A8D8); }
  for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if (d < 4.5) t.px(x, y, d < 1.5 ? 0xFFD8F4 : d < 3 ? 0xE870C8 : 0xA83AA0); }
  outline(t, 0.4);
});
IP('elytra', (t) => {
  const rows = [, , '..dmmmd..dmmmd..', '.dmllmmddmmllmd.', '.mlllmmmmmmlllm.', 'dmllmmm..mmmllmd', 'dmlmmm....mmmlmd', 'dmmmmd....dmmmmd', '.dmmmd....dmmmd.', '.dmmd......dmmd.', '..dmd......dmd..', '..dd........dd..', '...d........d...'];
  drawMask(t, rows, { m: 0x8A849C, l: 0xB8B2C8, d: 0x4E4A5E }); outline(t, 0.4);
});
IP('firework_rocket', (t) => { t.clear(); t.rect(6, 4, 4, 7, 0xC8322A); t.rect(6, 4, 1, 7, 0xE85A4A); for (let i = 0; i < 3; i++) { t.px(7, 3 - i, 0xD8D8D8); t.px(8, 3 - i, 0xB0B0B0); } t.rect(6, 6, 4, 1, 0xF2F2F2); t.line(8, 11, 8, 15, 0x8A6236); outline(t, 0.45); });
IP('end_rod_item', (t) => { t.clear(); for (let y = 1; y < 13; y++) { t.px(7, y, 0xFFFFFF); t.px(8, y, 0xE4DCEE); } t.rect(5, 13, 6, 2, 0xB2A2C4); t.rect(5, 13, 6, 1, 0xD4C4E0); outline(t, 0.5); });
IP('dragon_egg_item', (t, r) => { t.clear(); ell(t, 8, 9, 4.6, 6, 0x120C18, r, 0.35); for (let k = 0; k < 6; k++) t.px(5 + r.int(7), 4 + r.int(10), r.pick([0x6A2E96, 0x8A44C0])); hl(t, 6, 6); outline(t, 0.8); });
// ---------------------------------------------------------------- particles
IP('p_breath', (t, r) => { t.clear(); circ(t, 8, 8, 6.2, 0xFFFFFF, r, 0.25); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.a(x, y)) t.setA(x, y, 120 + r.int(100)); });
IP('p_end', (t) => { t.clear(); circ(t, 8, 8, 2.6, 0xFFFFFF); t.px(8, 4, 0xE0E0FF); t.px(8, 11, 0xE0E0FF); t.px(4, 8, 0xE0E0FF); t.px(11, 8, 0xE0E0FF); });
IP('p_firework', (t) => { t.clear(); t.rect(7, 7, 2, 2, 0xFFFFFF); t.px(8, 5, 0xFFFFFF); t.px(8, 10, 0xFFFFFF); t.px(5, 8, 0xFFFFFF); t.px(10, 8, 0xFFFFFF); });
// new item textures must be registered after 06/07 built the index
for (const n of Object.keys(ITEM_PAINT)) itx(n);
