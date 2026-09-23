// ============================================================================
//  Chunk-internal light computation (sky + block), used by workers.
//  light byte = (sky << 4) | block
// ============================================================================
const LQ_MASK = (1 << 19) - 1;
const LQ = new Int32Array(LQ_MASK + 1);

function lightBFSLocal(blocks, light, qt, sky) {
  const q = LQ;
  let qh = 0;
  const shift = sky ? 4 : 0, mask = sky ? 0x0F : 0xF0;
  while (qh !== qt) {
    const i = q[qh]; qh = (qh + 1) & LQ_MASK;
    const L = (light[i] >> shift) & 15;
    if (L <= 1) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    for (let d = 0; d < 6; d++) {
      let n;
      if (d === 0) { if (x === 15) continue; n = i + 1; }
      else if (d === 1) { if (x === 0) continue; n = i - 1; }
      else if (d === 2) { if (y === CH - 1) continue; n = i + 256; }
      else if (d === 3) { if (y === 0) continue; n = i - 256; }
      else if (d === 4) { if (z === 15) continue; n = i + 16; }
      else { if (z === 0) continue; n = i - 16; }
      const op = OPACITY[blocks[n] & 4095];
      if (op >= 15) continue;
      const nl = (sky && d === 3 && L === 15 && op === 0) ? 15 : L - (op > 1 ? op : 1);
      if (nl <= 0) continue;
      if (((light[n] >> shift) & 15) < nl) { light[n] = (light[n] & mask) | (nl << shift); q[qt] = n; qt = (qt + 1) & LQ_MASK; }
    }
  }
}

function computeChunkLight(blocks, light, heightmap, noSky) {
  light.fill(0);
  let qt = 0;
  if (!noSky) {
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let y = CH - 1;
      for (; y >= 0; y--) { const i = (y << 8) | (z << 4) | x; if (OPACITY[blocks[i] & 4095] > 0) break; light[i] = 0xF0; }
      heightmap[z * 16 + x] = y + 1;
    }
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const hm = heightmap[z * 16 + x];
      let mx = hm;
      if (x > 0) mx = Math.max(mx, heightmap[z * 16 + x - 1]);
      if (x < 15) mx = Math.max(mx, heightmap[z * 16 + x + 1]);
      if (z > 0) mx = Math.max(mx, heightmap[z * 16 + x - 16]);
      if (z < 15) mx = Math.max(mx, heightmap[z * 16 + x + 16]);
      for (let y = hm; y <= mx && y < CH; y++) { LQ[qt] = (y << 8) | (z << 4) | x; qt = (qt + 1) & LQ_MASK; }
    }
    lightBFSLocal(blocks, light, qt, true);
  } else {
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let y = CH - 1;
      for (; y >= 0; y--) if (OPACITY[blocks[(y << 8) | (z << 4) | x] & 4095] > 0) break;
      heightmap[z * 16 + x] = y + 1;
    }
  }
  qt = 0;
  for (let i = 0; i < CVOL; i++) {
    const e = EMIT[blocks[i] & 4095];
    if (e) { light[i] = (light[i] & 0xF0) | e; LQ[qt] = i; qt = (qt + 1) & LQ_MASK; }
  }
  if (qt) lightBFSLocal(blocks, light, qt, false);
}
