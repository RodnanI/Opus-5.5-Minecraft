// ============================================================================
//  Deployer icons for the TITAN mech, NAUTILUS submarine and MOLE tunnel borer
// ============================================================================
IP('veh_mech', (t) => vicon(t, [
  '', '   rr      rr   ', '  gggg ww gggg  ', '  gggkkkkkkggg  ', 'cmmmgkbbbbkgmmmc', '   ggkkbbkkgg   ', '     kkyykk     ', '     kkkkkk     ',
  '    kk    kk    ', '    gg    gg    ', '    gg    gg    ', '    kk    kk    ', '    gg    gg    ', '   kkk    kkk   ', '   yyy    yyy   ', '',
].map(r => r.padEnd(16).slice(0, 16)), { g: 0x4B5059, k: 0x2A2D33, y: 0xE3AE24, b: 0x3AA8C8, r: 0xFF3A24, m: 0x8C9199, c: 0x6AE6FF, w: 0xB8BCC4 }));
IP('veh_sub', (t) => vicon(t, [
  '', '', '', '      ttt       ', '      tbt       ', '     ttttt    f ', ' gaaaaaaaaaaaaff', 'laaahaaahaaahaap',
  'ggaaaaaaaaaaaaap', ' gdddddddddddd f', '   dddddddddd   ', '', '', '', '', '',
].map(r => r.padEnd(16).slice(0, 16)), { g: 0x74C8D8, a: 0x2C686B, d: 0x1B3436, t: 0x23585B, b: 0xD8B060, h: 0xB88A3A, f: 0x23585B, p: 0xC89A44, l: 0xFFF2CC }));
IP('veh_drill', (t) => vicon(t, [
  '', '', '', '', '         kk     ', '        kbbk    ', '        kbbkyy  ', '  s   yyyyyyyyy ',
  ' sds yyyyyyyyyyy', 'sdsdmyyyyyyyyyyy', ' sds yyyyyyyyyyy', '  s  ttttttttttt', '     tmttmttmttt', '      ttttttttt ', '', '',
].map(r => r.padEnd(16).slice(0, 16)), { s: 0xB9BEC6, d: 0x5E636B, y: 0xD9A524, k: 0x2E3136, b: 0x3F6F80, t: 0x2A2A2C, m: 0x7A7F86 }));
// ECLIPSE fighter (seen from above: needle nose, forward-swept wings, the halo ring at the tail)
IP('veh_fighter', (t) => vicon(t, [
  '       cc       ', '       kk       ', '      kggk      ', '      kggk      ', '      kkkk      ', ' v    kkkk    v ', ' ce   kkkk   ec ', '  ce  kkkk  ec  ',
  '   eeckkkkcee   ', '    eekkkkee    ', '     ekkkke     ', '    v kkkk v    ', '   hhhkkkkhhh   ', '   h  kkkk  h   ', '   hhh oo hhh   ', '',
].map(r => r.padEnd(16).slice(0, 16)), { k: 0x1C1E25, g: 0xD9A441, e: 0x4A5262, c: 0x55EEFF, v: 0xA36CFF, h: 0xFFE3B5, o: 0x9FE0FF }));
// a soft, lumpy cloud puff for the singularity's mushroom cloud (lit from the top left)
IP('p_cloud', (t, r) => {
  t.clear();
  const lumps = [[8, 8, 5.2], [5.5, 6.5, 3.4], [10.5, 6, 3.6], [6, 10.5, 3.3], [10.5, 10.2, 3.4], [8, 4.6, 3.0]];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let d = 9;
    for (const [cx, cy, rr] of lumps) d = Math.min(d, Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rr);
    if (d > 1) continue;
    const c = Math.round(clamp(210 * (1.05 - (x + y - 15) * 0.02 - d * 0.18 + (r.next() - 0.5) * 0.08), 0, 255));
    t.px(x, y, (c << 16) | (c << 8) | c, Math.round(250 - d * d * 120));
  }
});
for (const n of Object.keys(ITEM_PAINT)) itx(n);
