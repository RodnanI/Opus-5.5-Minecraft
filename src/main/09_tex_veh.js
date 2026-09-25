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
for (const n of Object.keys(ITEM_PAINT)) itx(n);
