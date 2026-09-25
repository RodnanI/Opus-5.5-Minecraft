// ============================================================================
//  World: chunk storage & streaming, lighting propagation, meshing scheduler
// ============================================================================
const VIS_ALL = new Uint8Array([63, 63, 63, 63, 63, 63]);
class Section {
  constructor(c, sy) { this.chunk = c; this.cx = c.cx; this.cz = c.cz; this.sy = sy; this.nonAir = 0; this.vao = null; this.reg = null; this.aoff = 0; this.asz = 0; this.q0 = 0; this.q1 = 0; this.q2 = 0; this.counts = [0, 0, 0]; this.vis = null; this.ver = 0; this.pending = false; this.queued = false; }
}
class Chunk {
  constructor(world, cx, cz, d) {
    this.world = world; this.cx = cx; this.cz = cz; this.key = ckey(cx, cz);
    this.blocks = d.blocks; this.light = d.light; this.hm = d.hm; this.biomes = d.biomes; this.tints = d.tints; this.tags = d.tags || 0;
    this.nx = this.px = this.nz = this.pz = null;
    this.lit = false; this.meshable = false; this.modified = false; this.saved = !!d.fromSave;
    this.sections = [];
    for (let s = 0; s < NSEC; s++) this.sections.push(new Section(this, s));
    for (let i = 0; i < CVOL; i++) if (this.blocks[i] & 4095) this.sections[i >> 12].nonAir++;
    this.be = new Map();
    this.lastSeen = 0;
  }
}
class World {
  constructor(game, dim) {
    this.game = game; this.dim = dim;
    this.chunks = new Map(); this.pending = new Set();
    this.lightQueue = []; this.meshQueue = new Set(); this.urgent = new Set();
    this.sched = new Map();
    this.entities = []; this.entityById = new Map();
    this.savedKeys = new Set();
    this.activeBE = new Set();
    this.mesher = new Mesher();
    this.pb = new Uint16Array(P3); this.pl = new Uint8Array(P3);
    this.spiralCache = {};
    this.qC = new Array(LQ_MASK + 1); this.qI = new Int32Array(LQ_MASK + 1); this.qh = 0; this.qt = 0;
    this.rC = []; this.rI = []; this.rL = [];
    this.loadedCount = 0;
  }
  // ---------------------------------------------------------------- access
  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }
  getBlock(x, y, z) { if (y < 0 || y >= CH) return 0; const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0; }
  isLoaded(x, z) { return this.chunks.has(ckey(x >> 4, z >> 4)); }
  getId(x, y, z) { return this.getBlock(x, y, z) & 4095; }
  getLight(x, y, z) { if (y >= CH) return 0xF0; if (y < 0) return 0; const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.light[(y << 8) | ((z & 15) << 4) | (x & 15)] : 0xF0; }
  skyAt(x, y, z) { return this.getLight(x, y, z) >> 4; }
  blockLightAt(x, y, z) { return this.getLight(x, y, z) & 15; }
  // effective light level for mob spawning / crops (sky reduced by time of day)
  lightLevel(x, y, z) { const l = this.getLight(x, y, z); const sd = this.dim === 'nether' ? 0 : Math.round((l >> 4) * this.game.skyFactor()); return Math.max(sd, l & 15); }
  heightAt(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.hm[((z & 15) << 4) | (x & 15)] : 0; }
  biomeAt(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.biomes[((z & 15) << 4) | (x & 15)] : (this.dim === 'nether' ? BIO.NETHER_WASTES : this.dim === 'end' ? BIO.THE_END : BIO.PLAINS); }
  waterColorAt(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.tints.water[((z & 15) << 4) | (x & 15)] : 0x3F76E4; }
  isSnowyAt(x, z, y) { const b = BIOMES[this.biomeAt(x, z)]; return !!(b && (b.snowy || (b.id === BIO.MOUNTAINS && y > 128))); }
  canSeeSky(x, y, z) { return y >= this.heightAt(x, z); }
  isRainingAt(x, y, z) { if (this.dim !== 'overworld' || this.game.rainLevel < 0.2) return false; if (!this.canSeeSky(x, y, z)) return false; const b = BIOMES[this.biomeAt(x, z)]; return !(b.id === BIO.DESERT || b.id === BIO.SAVANNA || b.id === BIO.BADLANDS); }
  getBE(x, y, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.be.get((y << 8) | ((z & 15) << 4) | (x & 15)) : undefined; }
  setBE(x, y, z, be) {
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15);
    if (be) { be.x = x; be.y = y; be.z = z; c.be.set(i, be); if (be.t === 'furnace' || be.t === 'spawner') this.activeBE.add(be); }
    else { const o = c.be.get(i); if (o) this.activeBE.delete(o); c.be.delete(i); }
    c.modified = true;
  }
  // ---------------------------------------------------------------- setBlock
  setBlock(x, y, z, v, flags) {
    if (y < 0 || y >= CH) return false;
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    const c = this.chunks.get(ckey(x >> 4, z >> 4)); if (!c) return false;
    const lx = x & 15, lz = z & 15, i = (y << 8) | (lz << 4) | lx;
    const old = c.blocks[i]; if (old === v) return false;
    c.blocks[i] = v; c.modified = true;
    const oid = old & 4095, nid = v & 4095;
    const sec = c.sections[y >> 4];
    if (oid === 0 && nid !== 0) sec.nonAir++; else if (oid !== 0 && nid === 0) sec.nonAir--;
    if (oid !== nid && c.be.has(i) && !(flags & 16)) { const be = c.be.get(i); if (!(flags & 8)) this.game.onBERemoved(be, x, y, z); this.activeBE.delete(be); c.be.delete(i); }
    // heightmap
    const hi = (lz << 4) | lx, hm = c.hm[hi];
    if (OPACITY[nid] > 0 && y >= hm) c.hm[hi] = y + 1;
    else if (OPACITY[nid] === 0 && y === hm - 1) { let yy = y; while (yy > 0 && OPACITY[c.blocks[((yy - 1) << 8) | hi] & 4095] === 0) yy--; c.hm[hi] = yy; }
    if (OPACITY[oid] !== OPACITY[nid] || EMIT[oid] !== EMIT[nid]) this.updateLight(c, i, oid, nid);
    this.markBlockDirty(x, y, z, !(flags & 4));
    if (flags & 1) this.notifyNeighbors(x, y, z, oid, nid);
    return true;
  }
  markSection(c, sy, urgent) {
    if (!c || sy < 0 || sy >= NSEC) return;
    const sec = c.sections[sy];
    sec.ver++;
    if (!c.meshable) return;
    if (urgent) this.urgent.add(sec);
    else if (!sec.pending && !sec.queued) { sec.queued = true; this.meshQueue.add(sec); }
  }
  markBlockDirty(x, y, z, urgent) {
    const done = this._md || (this._md = new Set()); done.clear();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) {
      const xx = x + dx, yy = y + dy, zz = z + dz;
      if (yy < 0 || yy >= CH) continue;
      const cx = xx >> 4, cz = zz >> 4, sy = yy >> 4;
      const k = ckey(cx, cz) * 16 + sy;
      if (done.has(k)) continue; done.add(k);
      this.markSection(this.chunks.get(ckey(cx, cz)), sy, urgent);
    }
  }
  // ---------------------------------------------------------------- lighting (cross-chunk BFS)
  lpush(c, i) { this.qC[this.qt] = c; this.qI[this.qt] = i; this.qt = (this.qt + 1) & LQ_MASK; }
  markLightCell(c, i) {
    const y = i >> 8, x = i & 15, z = (i >> 4) & 15;
    const sy = y >> 4, ly = y & 15;
    this.markSection(c, sy, false);
    if (ly === 0) this.markSection(c, sy - 1, false); else if (ly === 15) this.markSection(c, sy + 1, false);
    if (x === 0) this.markSection(c.nx, sy, false); else if (x === 15) this.markSection(c.px, sy, false);
    if (z === 0) this.markSection(c.nz, sy, false); else if (z === 15) this.markSection(c.pz, sy, false);
  }
  propagate(sky, mark) {
    const shift = sky ? 4 : 0, keep = sky ? 0x0F : 0xF0;
    while (this.qh !== this.qt) {
      const c = this.qC[this.qh], i = this.qI[this.qh]; this.qC[this.qh] = null; this.qh = (this.qh + 1) & LQ_MASK;
      const L = (c.light[i] >> shift) & 15;
      if (L <= 1) continue;
      const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
      for (let d = 0; d < 6; d++) {
        let nc = c, ni;
        if (d === 0) { if (x === 15) { nc = c.px; ni = i - 15; } else ni = i + 1; }
        else if (d === 1) { if (x === 0) { nc = c.nx; ni = i + 15; } else ni = i - 1; }
        else if (d === 2) { if (y === CH - 1) continue; ni = i + 256; }
        else if (d === 3) { if (y === 0) continue; ni = i - 256; }
        else if (d === 4) { if (z === 15) { nc = c.pz; ni = i - 240; } else ni = i + 16; }
        else { if (z === 0) { nc = c.nz; ni = i + 240; } else ni = i - 16; }
        if (!nc) continue;
        const op = OPACITY[nc.blocks[ni] & 4095];
        if (op >= 15) continue;
        const nl = (sky && d === 3 && L === 15 && op === 0) ? 15 : L - (op > 1 ? op : 1);
        if (nl <= 0) continue;
        if (((nc.light[ni] >> shift) & 15) < nl) {
          nc.light[ni] = (nc.light[ni] & keep) | (nl << shift);
          if (mark) this.markLightCell(nc, ni);
          this.lpush(nc, ni);
        }
      }
    }
  }
  removeLight(sky) {
    const shift = sky ? 4 : 0, keep = sky ? 0x0F : 0xF0;
    const rC = this.rC, rI = this.rI, rL = this.rL;
    let h = 0;
    while (h < rC.length) {
      const c = rC[h], i = rI[h], L = rL[h]; h++;
      const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
      for (let d = 0; d < 6; d++) {
        let nc = c, ni;
        if (d === 0) { if (x === 15) { nc = c.px; ni = i - 15; } else ni = i + 1; }
        else if (d === 1) { if (x === 0) { nc = c.nx; ni = i + 15; } else ni = i - 1; }
        else if (d === 2) { if (y === CH - 1) continue; ni = i + 256; }
        else if (d === 3) { if (y === 0) continue; ni = i - 256; }
        else if (d === 4) { if (z === 15) { nc = c.pz; ni = i - 240; } else ni = i + 16; }
        else { if (z === 0) { nc = c.nz; ni = i + 240; } else ni = i - 16; }
        if (!nc) continue;
        const nl = (nc.light[ni] >> shift) & 15;
        if (nl === 0) continue;
        if (nl < L || (sky && d === 3 && L === 15 && nl === 15)) {
          nc.light[ni] &= keep;
          this.markLightCell(nc, ni);
          rC.push(nc); rI.push(ni); rL.push(nl);
        } else this.lpush(nc, ni);
      }
    }
    rC.length = 0; rI.length = 0; rL.length = 0;
  }
  updateLight(c, i, oid, nid) {
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    const neigh = (fn) => {
      if (x < 15) fn(c, i + 1); else if (c.px) fn(c.px, i - 15);
      if (x > 0) fn(c, i - 1); else if (c.nx) fn(c.nx, i + 15);
      if (z < 15) fn(c, i + 16); else if (c.pz) fn(c.pz, i - 240);
      if (z > 0) fn(c, i - 16); else if (c.nz) fn(c.nz, i + 240);
      if (y < CH - 1) fn(c, i + 256);
      if (y > 0) fn(c, i - 256);
    };
    const seed = (cc, ii) => this.lpush(cc, ii);
    for (const sky of [false, true]) {
      if (sky && this.dim === 'nether') { continue; }
      const shift = sky ? 4 : 0, keep = sky ? 0x0F : 0xF0;
      const cur = (c.light[i] >> shift) & 15;
      const newEmit = sky ? 0 : EMIT[nid];
      if (cur > 0 && (cur > newEmit)) {
        c.light[i] &= keep;
        this.markLightCell(c, i);
        this.rC.push(c); this.rI.push(i); this.rL.push(cur);
        this.removeLight(sky);
      }
      if (newEmit > 0) { c.light[i] = (c.light[i] & keep) | (newEmit << shift); this.lpush(c, i); }
      if (OPACITY[nid] < 15) neigh(seed);
      this.propagate(sky, true);
    }
  }
  integrateLight(c) {
    const pairs = [[c.px, 15, 0], [c.nx, 0, 15], [c.pz, -1, -1], [c.nz, -2, -2]];
    for (let s = 0; s < 2; s++) {
      const sky = s === 1, shift = sky ? 4 : 0;
      for (const [n, a, b] of pairs) {
        if (!n) continue;
        for (let y = 0; y < CH; y++) for (let t = 0; t < 16; t++) {
          let ci, ni;
          if (a >= 0) { ci = (y << 8) | (t << 4) | a; ni = (y << 8) | (t << 4) | b; }
          else if (a === -1) { ci = (y << 8) | (15 << 4) | t; ni = (y << 8) | t; }
          else { ci = (y << 8) | t; ni = (y << 8) | (15 << 4) | t; }
          const lc = (c.light[ci] >> shift) & 15, ln = (n.light[ni] >> shift) & 15;
          if (lc > ln + 1) this.lpush(c, ci); else if (ln > lc + 1) this.lpush(n, ni);
        }
      }
      this.propagate(sky, false);
    }
    c.lit = true;
  }
  // ---------------------------------------------------------------- chunk lifecycle
  spiral(R) {
    if (this.spiralCache[R]) return this.spiralCache[R];
    const out = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dz * dz <= (R + 0.5) * (R + 0.5)) out.push([dx, dz, dx * dx + dz * dz]);
    out.sort((a, b) => a[2] - b[2]);
    this.spiralCache[R] = out;
    return out;
  }
  update(px, pz, budgetMs) {
    const t0 = now();
    const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    const R = EFF.renderDist, LR = R + 1;
    // candidate lists (nearest first) that feed() hands to the workers, both here and whenever a job completes
    const cc = this.chunkCands || (this.chunkCands = []); cc.length = 0; this.chunkCi = 0;
    for (const [dx, dz] of this.spiral(LR)) {
      const cx = pcx + dx, cz = pcz + dz, k = ckey(cx, cz);
      if (this.chunks.has(k) || this.pending.has(k)) continue;
      cc.push(cx, cz);
      if (cc.length >= 64) break;
    }
    this.pickMeshes(pcx, pcz, Math.floor(this.game.camera.y / 16));
    this.feed();
    // unload far chunks
    if ((this.game.frame & 15) === 0) {
      const UR = LR + 2;
      for (const c of this.chunks.values()) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > UR * UR) this.unloadChunk(c);
      }
    }
    // light integration
    while (this.lightQueue.length && now() - t0 < budgetMs) {
      // nearest first
      let bi = 0, bd = Infinity;
      for (let i = 0; i < this.lightQueue.length; i++) { const c = this.lightQueue[i]; const d = (c.cx - pcx) ** 2 + (c.cz - pcz) ** 2; if (d < bd) { bd = d; bi = i; } }
      const c = this.lightQueue[bi]; this.lightQueue.splice(bi, 1);
      if (!this.chunks.has(c.key)) continue;
      this.integrateLight(c);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.checkMeshable(this.chunks.get(ckey(c.cx + dx, c.cz + dz)));
    }
    // urgent (player edits): mesh synchronously
    let n = 0;
    for (const sec of this.urgent) { this.urgent.delete(sec); if (this.chunks.has(sec.chunk.key)) this.meshSync(sec); if (++n >= 8) break; }
    // sections that became meshable during light integration
    if (this.meshQueue.size && this.meshCi >= this.meshCands.length) { this.pickMeshes(pcx, pcz, Math.floor(this.game.camera.y / 16)); this.feed(); }
  }
  // Fill free worker slots: alternate between meshing nearby sections and generating new chunks, so
  // neither starves. Called every frame and again each time a worker finishes a job.
  feed() {
    const jobs = this.game.jobs; if (!jobs) return;
    let free = jobs.free();
    const cc = this.chunkCands || [], mc = this.meshCands || [];
    let turn = 0;
    while (free > 0) {
      let did = false;
      if ((turn++ & 1) === 0 || this.chunkCi >= cc.length) {
        while (this.meshCi < mc.length && !did) { const sec = mc[this.meshCi++]; if (sec.queued && !sec.pending) did = this.dispatchMesh(sec); }
      }
      if (!did && this.chunkCi < cc.length) {
        while (this.chunkCi < cc.length && !did) {
          const cx = cc[this.chunkCi++], cz = cc[this.chunkCi++], k = ckey(cx, cz);
          if (this.chunks.has(k) || this.pending.has(k)) continue;
          this.requestChunk(cx, cz, k); did = true;
        }
      }
      if (!did) { if (this.meshCi < mc.length) continue; break; }
      free--;
    }
  }
  requestChunk(cx, cz, k) {
    this.pending.add(k);
    const dim = this.dim, jobs = this.game.jobs;
    if (this.savedKeys.has(k)) {
      this.game.save.loadChunk(dim, cx, cz).then(rec => {
        if (this.game.world !== this || !this.pending.has(k)) return;
        if (!rec) { this.savedKeys.delete(k); jobs.post({ t: 'gen', dim, cx, cz }, null, (d) => this.onChunkData(d, null)); return; }
        const blocks = rec.blocks;
        jobs.post({ t: 'light', dim, cx, cz, blocks }, [blocks.buffer], (d) => this.onChunkData(d, rec));
      });
    } else jobs.post({ t: 'gen', dim, cx, cz }, null, (d) => this.onChunkData(d, null));
  }
  onChunkData(d, rec) {
    const k = ckey(d.cx, d.cz);
    if (this.game.world !== this || d.dim !== this.dim || !this.pending.has(k)) return;
    this.pending.delete(k);
    if (d.t === 'error') return;
    const c = new Chunk(this, d.cx, d.cz, { blocks: d.blocks, light: d.light, hm: d.hm, biomes: d.biomes, tints: d.tints, tags: rec ? rec.tags : d.tags, fromSave: !!rec });
    this.chunks.set(k, c);
    this.loadedCount++;
    c.nx = this.chunks.get(ckey(c.cx - 1, c.cz)) || null; if (c.nx) c.nx.px = c;
    c.px = this.chunks.get(ckey(c.cx + 1, c.cz)) || null; if (c.px) c.px.nx = c;
    c.nz = this.chunks.get(ckey(c.cx, c.cz - 1)) || null; if (c.nz) c.nz.pz = c;
    c.pz = this.chunks.get(ckey(c.cx, c.cz + 1)) || null; if (c.pz) c.pz.nz = c;
    if (this.dim === 'nether') for (let i = 0; i < CVOL; i++) c.light[i] &= 0x0F;
    this.lightQueue.push(c);
    if (rec) {
      for (const be of rec.be || []) { const i = (be.y << 8) | ((be.z & 15) << 4) | (be.x & 15); c.be.set(i, be); if (be.t === 'furnace' || be.t === 'spawner') this.activeBE.add(be); }
      for (const e of rec.ents || []) this.game.spawnSaved(e);
    } else {
      for (const be of d.be || []) { const i = (be.y << 8) | ((be.z & 15) << 4) | (be.x & 15); c.be.set(i, be); if (be.t === 'spawner') { be.delay = 200; this.activeBE.add(be); } }
      for (const s of d.spawns || []) this.game.spawnMob(s.type, s.x, s.y, s.z, s.data, true);
      if (d.spawns && d.spawns.length) c.modified = true;
    }
  }
  unloadChunk(c) {
    if (c.modified || this.chunkHasPersistentEntities(c)) this.game.save.saveChunk(this, c);
    for (const sec of c.sections) { this.game.renderer.freeSection(sec); this.meshQueue.delete(sec); this.urgent.delete(sec); }
    for (const be of c.be.values()) this.activeBE.delete(be);
    // remove entities in chunk
    for (const e of this.entities) if (!e.removed && !e.isPlayer && Math.floor(e.x) >> 4 === c.cx && Math.floor(e.z) >> 4 === c.cz) e.removed = true;
    if (c.nx) c.nx.px = null; if (c.px) c.px.nx = null; if (c.nz) c.nz.pz = null; if (c.pz) c.pz.nz = null;
    this.chunks.delete(c.key);
    const li = this.lightQueue.indexOf(c); if (li >= 0) this.lightQueue.splice(li, 1);
    this.game.renderer.visDirty = true;
  }
  chunkHasPersistentEntities(c) { for (const e of this.entities) if (!e.removed && e.persistent && Math.floor(e.x) >> 4 === c.cx && Math.floor(e.z) >> 4 === c.cz) return true; return false; }
  checkMeshable(c) {
    if (!c || c.meshable || !c.lit) return;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = this.chunks.get(ckey(c.cx + dx, c.cz + dz)); if (!n || !n.lit) return; }
    c.meshable = true;
    for (const sec of c.sections) { if (sec.nonAir > 0) { sec.queued = true; this.meshQueue.add(sec); } else sec.vis = VIS_ALL; }
    this.game.renderer.visDirty = true;
  }
  fillPadded(sec) {
    const pb = this.pb, pl = this.pl, cx = sec.cx, cz = sec.cz, sy = sec.sy;
    const cs = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) cs.push(this.chunks.get(ckey(cx + dx, cz + dz)));
    for (let z = -1; z <= 16; z++) for (let x = -1; x <= 16; x++) {
      const ox = x < 0 ? 0 : x > 15 ? 2 : 1, oz = z < 0 ? 0 : z > 15 ? 2 : 1;
      const ch = cs[oz * 3 + ox];
      const lx = x & 15, lz = z & 15;
      let p = (z + 1) * P + x + 1;
      for (let y = -1; y <= 16; y++, p += P2) {
        const wy = sy * 16 + y;
        if (wy < 0) { pb[p] = B.bedrock; pl[p] = 0; }
        else if (wy >= CH || !ch) { pb[p] = 0; pl[p] = 0xF0; }
        else { const i = (wy << 8) | (lz << 4) | lx; pb[p] = ch.blocks[i]; pl[p] = ch.light[i]; }
      }
    }
    return cs[4];
  }
  meshOpts() { return { fastLeaves: !SETTINGS.fancyLeaves, smooth: SETTINGS.smoothLight !== false }; }
  meshSync(sec) {
    const c = sec.chunk;
    if (!c.meshable) return;
    if (sec.nonAir === 0) { this.game.renderer.uploadSection(sec, [null, null, null], [0, 0, 0]); sec.vis = VIS_ALL; return; }
    this.fillPadded(sec);
    const r = this.mesher.mesh(this.pb, this.pl, c.tints, sec.cx * 16, sec.sy * 16, sec.cz * 16, this.meshOpts());
    this.game.renderer.uploadSection(sec, r.layers, r.counts);
    sec.vis = r.vis; sec.meshedVer = sec.ver;
    this.meshQueue.delete(sec); sec.queued = false;
  }
  // choose the nearest queued sections (bounded max-heap on distance) as this frame's mesh candidates
  pickMeshes(pcx, pcz, pcy) {
    const K = 48, hd = this._hd || (this._hd = new Float64Array(K)), hs = this._hs || (this._hs = new Array(K));
    const mc = this.meshCands || (this.meshCands = []); mc.length = 0; this.meshCi = 0;
    if (!this.meshQueue.size) return;
    const R = EFF.renderDist, maxD = (R + 1.5) * (R + 1.5) + 200;
    let n = 0;
    for (const sec of this.meshQueue) {
      if (!this.chunks.has(sec.chunk.key)) { this.meshQueue.delete(sec); sec.queued = false; continue; }
      const d = (sec.cx - pcx) ** 2 + (sec.cz - pcz) ** 2 + ((sec.sy - pcy) ** 2) * 0.5;
      if (d > maxD) continue;
      if (n < K) {
        let i = n++; hd[i] = d; hs[i] = sec;
        while (i > 0) { const p = (i - 1) >> 1; if (hd[p] >= hd[i]) break; const td = hd[p], ts = hs[p]; hd[p] = hd[i]; hs[p] = hs[i]; hd[i] = td; hs[i] = ts; i = p; }
      } else if (d < hd[0]) {
        hd[0] = d; hs[0] = sec;
        let i = 0;
        for (; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < K && hd[l] > hd[m]) m = l; if (r < K && hd[r] > hd[m]) m = r; if (m === i) break; const td = hd[m], ts = hs[m]; hd[m] = hd[i]; hs[m] = hs[i]; hd[i] = td; hs[i] = ts; i = m; }
      }
    }
    const idx = []; for (let i = 0; i < n; i++) idx.push(i);
    idx.sort((a, b) => hd[a] - hd[b]);
    for (const i of idx) mc.push(hs[i]);
    for (let i = 0; i < n; i++) hs[i] = null;
  }
  dispatchMesh(sec) {
    this.meshQueue.delete(sec); sec.queued = false;
    if (!this.chunks.has(sec.chunk.key) || !sec.chunk.meshable) return false;
    if (sec.nonAir === 0) { this.game.renderer.uploadSection(sec, [null, null, null], [0, 0, 0]); sec.vis = VIS_ALL; return false; }
    const c = this.fillPadded(sec);
    sec.pending = true;
    const ver = sec.ver;
    const pb = this.pb.slice(), pl = this.pl.slice();
    this.game.jobs.post({ t: 'mesh', key: c.key, sy: sec.sy, ver, pb, pl, tints: c.tints, ox: sec.cx * 16, oy: sec.sy * 16, oz: sec.cz * 16, opts: this.meshOpts() }, [pb.buffer, pl.buffer], (m) => {
      sec.pending = false;
      if (m.t === 'error' || !this.chunks.has(c.key) || this.game.world !== this) return;
      this.game.renderer.uploadSection(sec, m.layers, m.counts);
      sec.vis = m.vis;
      if (m.ver !== sec.ver && !sec.queued) { sec.queued = true; this.meshQueue.add(sec); }
    });
    return true;
  }
  remeshAll() {
    for (const c of this.chunks.values()) if (c.meshable) for (const sec of c.sections) if (sec.nonAir > 0 && !sec.queued) { sec.queued = true; this.meshQueue.add(sec); }
  }
  // ---------------------------------------------------------------- entities
  addEntity(e) { e.world = this; this.entities.push(e); this.entityById.set(e.id, e); return e; }
  // e.reach: extra radius of big multi-part entities (the dragon's head, wings and tail are far from its centre)
  entitiesNear(x, y, z, r, filter) {
    const out = [];
    for (const e of this.entities) { if (e.removed) continue; const dx = e.x - x, dy = e.y - y, dz = e.z - z, rr = e.reach ? r + e.reach : r; if (dx * dx + dy * dy + dz * dz <= rr * rr && (!filter || filter(e))) out.push(e); }
    return out;
  }
  entitiesInBox(x0, y0, z0, x1, y1, z1, except) {
    const out = [];
    for (const e of this.entities) { if (e.removed || e === except) continue; const w = e.w / 2; if (e.x + w > x0 && e.x - w < x1 && e.y + e.h > y0 && e.y < y1 && e.z + w > z0 && e.z - w < z1) out.push(e); }
    return out;
  }
  // ---------------------------------------------------------------- scheduled ticks
  schedule(x, y, z, delay) {
    const k = ((x + 33554432) * 256 + y) * 67108864 + (z + 33554432);
    const t = this.game.tickCount + delay;
    const cur = this.sched.get(k);
    if (!cur || cur.t > t) this.sched.set(k, { x, y, z, t });
  }
  runScheduled(budget) {
    const now_ = this.game.tickCount;
    const due = [];
    for (const [k, s] of this.sched) { if (s.t <= now_) { due.push(s); this.sched.delete(k); if (due.length >= budget) break; } }
    for (const s of due) { if (this.isLoaded(s.x, s.z)) blockTick(this, s.x, s.y, s.z); }
  }
  notifyNeighbors(x, y, z, oid, nid) {
    neighborChanged(this, x, y, z);
    neighborChanged(this, x + 1, y, z); neighborChanged(this, x - 1, y, z);
    neighborChanged(this, x, y + 1, z); neighborChanged(this, x, y - 1, z);
    neighborChanged(this, x, y, z + 1); neighborChanged(this, x, y, z - 1);
  }
}
// adapter so world-gen tree builders can grow saplings in the live world
class WorldCtx {
  constructor(w) { this.w = w; }
  get(x, y, z) { if (y < 0 || y >= CH) return 0; if (!this.w.isLoaded(x, z)) return -1; return this.w.getBlock(x, y, z); }
  set(x, y, z, v) { this.w.setBlock(x, y, z, v, 1); }
  inside() { return true; }
}
