// ============================================================================
//  Collision / selection shapes, AABB movement, raycasting
// ============================================================================
function fenceConn(w, x, y, z, id, f) {
  const nid = w.getId(x + FACING_DX[f], y, z + FACING_DZ[f]);
  const kind = FENCEK[id];
  if (SHAPE[nid] === R_FENCE) return FENCEK[nid] === kind;
  if (SHAPE[nid] === R_GATE && kind === 1) return true;
  return OPAQUE[nid] === 1;
}
function paneConn(w, x, y, z, f) { const nid = w.getId(x + FACING_DX[f], y, z + FACING_DZ[f]); return SHAPE[nid] === R_PANE || OPAQUE[nid] === 1 || nid === B.glass || (LAYER[nid] === L_TRANS && SHAPE[nid] === R_CUBE); }
// local-space boxes [x0,y0,z0,x1,y1,z1]
function shapeBoxes(w, x, y, z, v, selection) {
  const id = v & 4095, meta = v >> 12, s = SHAPE[id];
  switch (s) {
    case R_NONE: case R_LIQUID: return [];
    case R_CUBE: return id === B.soul_sand && !selection ? [[0, 0, 0, 1, 14 / 16, 1]] : [[0, 0, 0, 1, 1, 1]];
    case R_SHORT: return [[0, 0, 0, 1, 15 / 16, 1]];
    case R_SLAB: return meta === 1 ? [[0, 0.5, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.5, 1]];
    case R_STAIRS: {
      const f = meta & 3, up = meta & 4;
      const a = up ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1];
      const y0 = up ? 0 : 0.5, y1 = up ? 0.5 : 1;
      const b = f === 0 ? [0, y0, 0, 1, y1, 0.5] : f === 1 ? [0.5, y0, 0, 1, y1, 1] : f === 2 ? [0, y0, 0.5, 1, y1, 1] : [0, y0, 0, 0.5, y1, 1];
      return [a, b];
    }
    case R_FENCE: {
      const wall = BLOCKS[id].fence === 3, hgt = selection ? 1 : 1.5, lo = wall ? 0.25 : 0.375, hi = 1 - lo;
      const out = [[lo, 0, lo, hi, hgt, hi]];
      if (w) {
        if (fenceConn(w, x, y, z, id, 1)) out.push([hi, 0, lo, 1, hgt, hi]);
        if (fenceConn(w, x, y, z, id, 3)) out.push([0, 0, lo, lo, hgt, hi]);
        if (fenceConn(w, x, y, z, id, 2)) out.push([lo, 0, hi, hi, hgt, 1]);
        if (fenceConn(w, x, y, z, id, 0)) out.push([lo, 0, 0, hi, hgt, lo]);
      }
      return out;
    }
    case R_PANE: {
      const out = [[0.4375, 0, 0.4375, 0.5625, 1, 0.5625]];
      if (w) {
        if (paneConn(w, x, y, z, 1)) out.push([0.5625, 0, 0.4375, 1, 1, 0.5625]);
        if (paneConn(w, x, y, z, 3)) out.push([0, 0, 0.4375, 0.4375, 1, 0.5625]);
        if (paneConn(w, x, y, z, 2)) out.push([0.4375, 0, 0.5625, 0.5625, 1, 1]);
        if (paneConn(w, x, y, z, 0)) out.push([0.4375, 0, 0, 0.5625, 1, 0.4375]);
      }
      return out;
    }
    case R_GATE: {
      const open = meta & 4, along = (meta & 1) === 0;
      if (open && !selection) return [];
      const h2 = selection ? 1 : 1.5;
      return along ? [[0, 0, 0.375, 1, h2, 0.625]] : [[0.375, 0, 0, 0.625, h2, 1]];
    }
    case R_DOOR: {
      const upper = (meta & 8) !== 0;
      const lower = upper ? (w ? w.getBlock(x, y - 1, z) >>> 12 : 0) : meta, top = upper ? meta : (w ? w.getBlock(x, y + 1, z) >>> 12 : 0);
      const f = lower & 3, open = (lower & 4) !== 0, hinge = top & 1;
      const e = open ? (hinge ? (f + 1) & 3 : (f + 3) & 3) : f;
      const t = 3 / 16;
      return [[[0, 0, 0, 1, 1, t], [1 - t, 0, 0, 1, 1, 1], [0, 0, 1 - t, 1, 1, 1], [0, 0, 0, t, 1, 1]][e]];
    }
    case R_TRAPDOOR: {
      const f = meta & 3, open = meta & 4, top = meta & 8, t = 3 / 16;
      if (!open) return top ? [[0, 1 - t, 0, 1, 1, 1]] : [[0, 0, 0, 1, t, 1]];
      return [[[0, 0, 1 - t, 1, 1, 1], [0, 0, 0, t, 1, 1], [0, 0, 0, 1, 1, t], [1 - t, 0, 0, 1, 1, 1]][f]];
    }
    case R_SNOW: { const hh = selection ? ((meta & 7) + 1) * 2 / 16 : (meta & 7) * 2 / 16; return hh > 0 ? [[0, 0, 0, 1, hh, 1]] : []; }
    case R_CARPET: return [[0, 0, 0, 1, 1 / 16, 1]];
    case R_BED: return [[0, 0, 0, 1, 9 / 16, 1]];
    case R_CACTUS: return [[1 / 16, 0, 1 / 16, 15 / 16, selection ? 1 : 15 / 16, 15 / 16]];
    case R_CHEST: return [[1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16]];
    case R_LILY: return [[0, 0, 0, 1, 1 / 32, 1]];
    case R_LANTERN: return (meta & 1) ? [[5 / 16, 1 / 16, 5 / 16, 11 / 16, 10 / 16, 11 / 16]] : [[5 / 16, 0, 5 / 16, 11 / 16, 9 / 16, 11 / 16]];
    case R_PLATE: return selection ? [[1 / 16, 0, 1 / 16, 15 / 16, 1 / 16, 15 / 16]] : [];
    case R_CAMPFIRE: return [[0, 0, 0, 1, 7 / 16, 1]];
    case R_FLAT: return selection ? [[0, 0, 0, 1, 1 / 16, 1]] : [];
  }
  if (!selection) return [];
  switch (s) {
    case R_CROSS:
      if (id === B.chain) return [[6.5 / 16, 0, 6.5 / 16, 9.5 / 16, 1, 9.5 / 16]];
      if (id === B.pointed_dripstone) return [[0.3, 0, 0.3, 0.7, 1, 0.7]];
      if (id === B.weeping_vines || id === B.twisting_vines) return [[0.2, 0, 0.2, 0.8, 1, 0.8]];
      return id === B.tall_grass || id === B.fern || id === B.seagrass ? [[0.1, 0, 0.1, 0.9, 0.8, 0.9]] : id === B.sugar_cane ? [[0.125, 0, 0.125, 0.875, 1, 0.875]] : id === B.cobweb ? [[0, 0, 0, 1, 1, 1]] : [[0.25, 0, 0.25, 0.75, 0.7, 0.75]];
    case R_CROP: return [[0, 0, 0, 1, Math.min(1, 0.2 + (meta & 7) * 0.1), 1]];
    case R_TORCH: {
      if (meta === 0) return [[0.4, 0, 0.4, 0.6, 0.62, 0.6]];
      const f = (meta - 1) & 3, dx = FACING_DX[f], dz = FACING_DZ[f];
      const cx = 0.5 - dx * 0.35, cz = 0.5 - dz * 0.35;
      return [[cx - 0.15, 0.2, cz - 0.15, cx + 0.15, 0.8, cz + 0.15]];
    }
    case R_LADDER: { const f = meta & 3; const t = 3 / 16; return [[[0, 0, 1 - t, 1, 1, 1], [0, 0, 0, t, 1, 1], [0, 0, 0, 1, 1, t], [1 - t, 0, 0, 1, 1, 1]][f]]; }
    case R_VINE: { const out = []; const t = 1 / 16; if (meta & 1) out.push([0, 0, 1 - t, 1, 1, 1]); if (meta & 2) out.push([0, 0, 0, t, 1, 1]); if (meta & 4) out.push([0, 0, 0, 1, 1, t]); if (meta & 8) out.push([1 - t, 0, 0, 1, 1, 1]); return out.length ? out : [[0, 1 - t, 0, 1, 1, 1]]; }
    case R_RAIL: return [[0, 0, 0, 1, 2 / 16, 1]];
  }
  return [];
}
function collisionBoxes(w, x0, y0, z0, x1, y1, z1, out) {
  out.length = 0;
  for (let x = Math.floor(x0); x <= Math.floor(x1); x++) for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
    if (!w.isLoaded(x, z)) { out.push([x, Math.floor(y0) - 1, z, x + 1, Math.floor(y1) + 2, z + 1]); continue; }
    for (let y = Math.floor(y0) - 1; y <= Math.floor(y1); y++) {
      if (y < 0) { out.push([x, y, z, x + 1, y + 1, z + 1]); continue; }
      const v = w.getBlock(x, y, z), id = v & 4095;
      if (!SOLID[id]) continue;
      for (const b of shapeBoxes(w, x, y, z, v, false)) out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
    }
  }
  return out;
}
const _cb = [];
function moveEntity(w, e, dx, dy, dz) {
  const hw = e.w / 2;
  const boxes = collisionBoxes(w, e.x - hw + Math.min(dx, 0) - 0.01, e.y + Math.min(dy, 0) - 0.01, e.z - hw + Math.min(dz, 0) - 0.01, e.x + hw + Math.max(dx, 0) + 0.01, e.y + e.h + Math.max(dy, 0) + 0.01 + (e.stepH || 0), e.z + hw + Math.max(dz, 0) + 0.01, _cb);
  const odx = dx, ody = dy, odz = dz;
  const sweep = (bx, by, bz, mdx, mdy, mdz) => {
    let ax0 = bx - hw, ax1 = bx + hw, ay0 = by, ay1 = by + e.h, az0 = bz - hw, az1 = bz + hw;
    for (const b of boxes) {
      if (b[0] >= ax1 || b[3] <= ax0 || b[2] >= az1 || b[5] <= az0) continue;
      if (mdy > 0 && b[1] >= ay1 - 1e-7) mdy = Math.min(mdy, b[1] - ay1);
      else if (mdy < 0 && b[4] <= ay0 + 1e-7) mdy = Math.max(mdy, b[4] - ay0);
    }
    ay0 += mdy; ay1 += mdy;
    for (const b of boxes) {
      if (b[1] >= ay1 || b[4] <= ay0 || b[2] >= az1 || b[5] <= az0) continue;
      if (mdx > 0 && b[0] >= ax1 - 1e-7) mdx = Math.min(mdx, b[0] - ax1);
      else if (mdx < 0 && b[3] <= ax0 + 1e-7) mdx = Math.max(mdx, b[3] - ax0);
    }
    ax0 += mdx; ax1 += mdx;
    for (const b of boxes) {
      if (b[1] >= ay1 || b[4] <= ay0 || b[0] >= ax1 || b[3] <= ax0) continue;
      if (mdz > 0 && b[2] >= az1 - 1e-7) mdz = Math.min(mdz, b[2] - az1);
      else if (mdz < 0 && b[5] <= az0 + 1e-7) mdz = Math.max(mdz, b[5] - az0);
    }
    return [mdx, mdy, mdz];
  };
  let [mx, my, mz] = sweep(e.x, e.y, e.z, dx, dy, dz);
  // step up
  const stepH = e.stepH || 0;
  if (stepH > 0 && (e.onGround || (ody < 0 && my !== ody)) && (mx !== odx || mz !== odz)) {
    const up = sweep(e.x, e.y, e.z, 0, stepH, 0)[1];
    const [sx, , sz] = sweep(e.x, e.y + up, e.z, odx, 0, odz);
    const down = sweep(e.x + sx, e.y + up, e.z + sz, 0, -up + Math.min(0, ody), 0)[1];
    if (sx * sx + sz * sz > mx * mx + mz * mz + 1e-6) { mx = sx; mz = sz; my = up + down; e.stepped = up + down; }
  }
  e.x += mx; e.y += my; e.z += mz;
  e.collidedX = mx !== odx; e.collidedZ = mz !== odz; e.collidedH = e.collidedX || e.collidedZ;
  e.collidedV = my !== ody;
  e.onGround = ody < 0 && my !== ody;
  if (e.collidedX) e.vx = 0;
  if (e.collidedZ) e.vz = 0;
  if (e.collidedV) e.vy = 0;
}
function aabbIntersectsBlocks(w, x0, y0, z0, x1, y1, z1) {
  const boxes = collisionBoxes(w, x0, y0, z0, x1, y1, z1, []);
  for (const b of boxes) if (b[0] < x1 && b[3] > x0 && b[1] < y1 && b[4] > y0 && b[2] < z1 && b[5] > z0) return true;
  return false;
}
function rayAABB(ox, oy, oz, dx, dy, dz, b) {
  let tmin = -Infinity, tmax = Infinity, face = -1;
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    const lo = b[a], hi = b[a + 3];
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < lo || o[a] > hi) return null; continue; }
    let t1 = (lo - o[a]) / d[a], t2 = (hi - o[a]) / d[a];
    let f1 = a * 2 + 1, f2 = a * 2;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; const f = f1; f1 = f2; f2 = f; }
    if (t1 > tmin) { tmin = t1; face = f1; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  // face index mapping: axis*2+1 = negative side hit (normal -a) ... convert to mesher faces
  const map = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
  return { t: Math.max(0, tmin), face: map[face] };
}
function raycast(w, ox, oy, oz, dx, dy, dz, maxD, fluids) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
  let tmx = dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx;
  let tmy = dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy;
  let tmz = dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz;
  for (let i = 0; i < 256; i++) {
    const v = w.getBlock(x, y, z), id = v & 4095;
    if (id && (!NOSEL[id] || (fluids && FLUID[id] && (v >> 12) === 0))) {
      const boxes = FLUID[id] ? [[0, 0, 0, 1, 0.9, 1]] : shapeBoxes(w, x, y, z, v, true);
      let best = null;
      for (const b of boxes) {
        const h = rayAABB(ox, oy, oz, dx, dy, dz, [x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
        if (h && h.t <= maxD && (!best || h.t < best.t)) best = h;
      }
      if (best) {
        // face normal: rayAABB returns axis*2 (+) or axis*2+1 (-) side; convert to mesher face index
        const axis = best.face >> 1, neg = best.face & 1;
        const face = axis === 0 ? (neg ? 1 : 0) : axis === 1 ? (neg ? 3 : 2) : (neg ? 5 : 4);
        return { x, y, z, v, id, face, t: best.t, hx: ox + dx * best.t, hy: oy + dy * best.t, hz: oz + dz * best.t, boxes };
      }
    }
    let t;
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; }
    else { z += sz; t = tmz; tmz += tdz; }
    if (t > maxD) break;
    if (y < -1 || y > CH) break;
  }
  return null;
}
