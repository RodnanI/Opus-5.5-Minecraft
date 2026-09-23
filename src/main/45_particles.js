// ============================================================================
//  Particles: CPU simulated, GPU instanced billboards
// ============================================================================
class Particles {
  constructor(game) {
    this.game = game; this.list = []; this.emitters = [];
    this.max = 4000;
    this.data = new Float32Array(this.max * 14);
  }
  get limit() { return [300, 1200, 4000][EFF.particles] || 1200; }
  spawn(tex, x, y, z, o) {
    if (this.list.length >= this.limit) return null;
    o = o || {};
    const p = { x, y, z, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0, life: o.life || 20, age: 0, size: o.size || 0.2, grav: o.grav || 0, color: o.color || [1, 1, 1], alpha: o.alpha === undefined ? 1 : o.alpha, fade: o.fade !== false, src: 1, layer: 0, uv: [0, 0, 1, 1], shrink: o.shrink, collide: o.collide, emissive: o.emissive, drag: o.drag || 0.96 };
    if (typeof tex === 'string' && tex.startsWith('item:')) {
      const id = +tex.slice(5), d = ITEMS[id];
      if (d && d.block !== undefined && !d.flat) { p.src = 0; p.layer = TEX[d.block * 6 + 2]; }
      else { const f = (d && d.flat) || ('i:' + (d ? d.name : 'stick')); if (f.startsWith('b:')) { p.src = 0; p.layer = TEXI[f.slice(2)]; } else { p.src = 1; p.layer = ITEM_TEXI[f.slice(2)] || 0; } }
      const u = Math.random() * 0.75, v = Math.random() * 0.75; p.uv = [u, v, u + 0.25, v + 0.25];
    } else if (typeof tex === 'string') { p.layer = ITEM_TEXI[tex] || 0; }
    else { p.src = 0; p.layer = tex.layer; p.uv = tex.uv; }
    this.list.push(p);
    return p;
  }
  blockTex(v, face) {
    const id = v & 4095;
    let layer = TEX[id * 6 + (face === undefined ? 0 : face)];
    if (SHAPE[id] === R_CROP) layer = TEXX[id * 4 + Math.min(3, (v >> 12) >> 1)];
    const u = Math.floor(Math.random() * 12) / 16, vv = Math.floor(Math.random() * 12) / 16;
    return { layer, uv: [u, vv, u + 0.25, vv + 0.25] };
  }
  tintOf(v, x, z) {
    const id = v & 4095, t = TINT[id];
    if (!t) return [1, 1, 1];
    let c = t === T_COLOR ? COLOR[id] : t === T_WATER ? 0x3F76E4 : 0x7CBD4A;
    const ch = this.game.world.getChunk(x >> 4, z >> 4);
    if (ch && t === T_GRASS) c = ch.tints.grass[((z & 15) << 4) | (x & 15)];
    if (ch && t === T_FOLIAGE) c = ch.tints.foliage[((z & 15) << 4) | (x & 15)];
    return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  }
  blockBreak(x, y, z, v) {
    const n = EFF.particles === 0 ? 1 : EFF.particles === 1 ? 2 : 4;
    const col = this.tintOf(v, x, z);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      const px = x + (i + 0.5) / n, py = y + (j + 0.5) / n, pz = z + (k + 0.5) / n;
      const p = this.spawn(this.blockTex(v, j === n - 1 ? 2 : 0), px, py, pz, { vx: (px - x - 0.5) * 0.25 + (Math.random() - 0.5) * 0.08, vy: (py - y - 0.5) * 0.25 + Math.random() * 0.12, vz: (pz - z - 0.5) * 0.25 + (Math.random() - 0.5) * 0.08, life: 20 + Math.random() * 20, size: 0.1 + Math.random() * 0.08, grav: 0.04, color: col, fade: false, collide: true });
      if (!p) return;
    }
  }
  blockHit(x, y, z, face, v) {
    const col = this.tintOf(v, x, z);
    for (let i = 0; i < 2; i++) {
      let px = x + Math.random(), py = y + Math.random(), pz = z + Math.random();
      if (face === 0) px = x + 1.05; else if (face === 1) px = x - 0.05; else if (face === 2) py = y + 1.05; else if (face === 3) py = y - 0.05; else if (face === 4) pz = z + 1.05; else pz = z - 0.05;
      this.spawn(this.blockTex(v, face), px, py, pz, { vx: (Math.random() - 0.5) * 0.06 + FACE_DX[face] * 0.05, vy: Math.random() * 0.08, vz: (Math.random() - 0.5) * 0.06 + FACE_DZ[face] * 0.05, life: 15 + Math.random() * 10, size: 0.08 + Math.random() * 0.05, grav: 0.04, color: col, fade: false, collide: true });
    }
  }
  burst(x, y, z, tex, n, color) {
    for (let i = 0; i < n; i++) this.spawn(tex, x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5, { vx: (Math.random() - 0.5) * 0.15, vy: Math.random() * 0.15, vz: (Math.random() - 0.5) * 0.15, life: 15 + Math.random() * 15, size: 0.15 + Math.random() * 0.1, grav: tex.startsWith('item:') ? 0.04 : 0.005, color: color || [1, 1, 1] });
  }
  happy(x, y, z) { for (let i = 0; i < 8; i++) this.spawn('p_happy', x + Math.random(), y + 0.3 + Math.random() * 0.8, z + Math.random(), { vy: 0.02, life: 25, size: 0.15 }); }
  tick() {
    const w = this.game.world, L = this.list;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      p.age++;
      if (p.age >= p.life) continue;
      p.vy -= p.grav; p.vx *= p.drag; p.vy *= 0.98; p.vz *= p.drag;
      const nx = p.x + p.vx, ny = p.y + p.vy, nz = p.z + p.vz;
      if (p.collide && SOLID[w.getId(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { if (p.vy < 0) { p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; } else { p.vx = p.vz = 0; } }
      else { p.x = nx; p.y = ny; p.z = nz; }
      L[j++] = p;
    }
    L.length = j;
    // ambient emitters near player (torches, lava, portals, nether ash)
    const g = this.game, pl = g.player;
    if (!pl || EFF.particles === 0) return;
    const px = Math.floor(pl.x), py = Math.floor(pl.y), pz = Math.floor(pl.z);
    for (let k = 0; k < (EFF.particles === 2 ? 60 : 25); k++) {
      const x = px + randInt(-12, 12), y = py + randInt(-6, 8), z = pz + randInt(-12, 12);
      const v = w.getBlock(x, y, z), id = v & 4095;
      if (id === B.torch || id === B.soul_torch) {
        const m = v >> 12; let ox = 0.5, oz = 0.5, oy = 0.72;
        if (m > 0) { const f = (m - 1) & 3; ox -= FACING_DX[f] * 0.28 - FACING_DX[f] * 0.2; oz -= FACING_DZ[f] * 0.28 - FACING_DZ[f] * 0.2; oy = 0.95; ox += FACING_DX[f] * -0.2; oz += FACING_DZ[f] * -0.2; }
        this.spawn('p_smoke', x + ox, y + oy + 0.1, z + oz, { vy: 0.02, life: 18, size: 0.12, color: [0.3, 0.3, 0.3], alpha: 0.6 });
        this.spawn(id === B.torch ? 'p_flame' : 'p_soul', x + ox, y + oy, z + oz, { vy: 0.003, life: 10, size: 0.1, emissive: true });
      } else if (id === B.lava && w.getId(x, y + 1, z) === 0 && Math.random() < 0.08) {
        this.spawn('p_spark', x + Math.random(), y + 1, z + Math.random(), { vx: (Math.random() - 0.5) * 0.1, vy: 0.2 + Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.1, grav: 0.02, life: 30, size: 0.1, color: [1, 0.6, 0.2], emissive: true, collide: true });
        if (Math.random() < 0.3) g.audio.play('lava_pop', { x, y, z, vol: 0.3 });
      } else if (id === B.nether_portal && Math.random() < 0.4) {
        this.spawn('p_portal', x + Math.random(), y + Math.random(), z + Math.random(), { vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05, vz: (Math.random() - 0.5) * 0.05, life: 30, size: 0.1, emissive: true });
      } else if (id === B.fire && Math.random() < 0.3) {
        this.spawn('p_smoke', x + Math.random(), y + 0.8, z + Math.random(), { vy: 0.04, life: 25, size: 0.3, color: [0.2, 0.2, 0.2], alpha: 0.7 });
      } else if ((id === B.water || id === B.lava) && ((v >> 12) & 8) && w.getId(x, y - 1, z) !== id && SOLID[w.getId(x, y - 1, z)] && Math.random() < 0.2) {
        this.spawn('p_splash', x + Math.random(), y + 0.1, z + Math.random(), { vy: 0.1, grav: 0.04, life: 12, size: 0.12, color: id === B.lava ? [1, 0.5, 0.1] : [0.6, 0.7, 1] });
      } else if (LEAVES[id] && w.getId(x, y - 1, z) === 0 && Math.random() < 0.03 && w.isRainingAt(x, y + 1, z)) {
        this.spawn('p_drip', x + Math.random(), y - 0.05, z + Math.random(), { vy: -0.05, grav: 0.02, life: 30, size: 0.06, color: [0.5, 0.6, 1], collide: true });
      } else if (id === B.cherry_leaves && w.getId(x, y - 1, z) === 0 && Math.random() < 0.45) {
        // drifting cherry blossom petals
        const pk = Math.random();
        this.spawn('p_petal', x + Math.random(), y - 0.05, z + Math.random(), { vx: (Math.random() - 0.3) * 0.03, vy: -0.018 - Math.random() * 0.01, vz: (Math.random() - 0.5) * 0.03, drag: 0.995, life: 140, size: 0.07, color: [0.98, 0.66 + pk * 0.2, 0.8 + pk * 0.12], collide: true });
      } else if (id === 0 && EFF.particles === 2 && g.skyFactor() < 0.55 && w.getLight(x, y, z) >> 4 > 6 && Math.random() < 0.12) {
        // fireflies over grass in warm, wet biomes at night
        const bid = w.biomeAt(x, z), below = w.getId(x, y - 1, z);
        if ((bid === BIO.SWAMP || bid === BIO.FOREST || bid === BIO.PLAINS || bid === BIO.FLOWER_FOREST || bid === BIO.JUNGLE || bid === BIO.CHERRY_GROVE) && (below === B.grass_block || PLANT[below] || below === B.tall_grass))
          this.spawn('p_firefly', x + Math.random(), y + Math.random() * 1.5, z + Math.random(), { vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.01, vz: (Math.random() - 0.5) * 0.02, drag: 1, life: 70 + Math.random() * 60, size: 0.07, color: [0.75, 1, 0.35], emissive: true });
      }
    }
    // campfire smoke columns (campfires near the player are re-scanned twice a second)
    if ((g.tickCount % 10) === 0) this.scanEmitters(w, px, py, pz);
    for (const e of this.emitters) {
      if (Math.random() < 0.5) this.spawn('p_smoke', e[0] + 0.3 + Math.random() * 0.4, e[1] + 0.6, e[2] + 0.3 + Math.random() * 0.4, { vx: (Math.random() - 0.5) * 0.01, vy: 0.07 + Math.random() * 0.04, vz: (Math.random() - 0.5) * 0.01, drag: 0.995, life: 90 + Math.random() * 60, size: 0.35 + Math.random() * 0.3, color: [0.55, 0.55, 0.55], alpha: 0.55, shrink: false });
      if (Math.random() < 0.08) this.spawn(e[3] ? 'p_soul' : 'p_flame', e[0] + 0.3 + Math.random() * 0.4, e[1] + 0.5, e[2] + 0.3 + Math.random() * 0.4, { vy: 0.05, life: 12, size: 0.07, emissive: true });
    }
    // suspended particles drifting in water around the camera
    if (pl.eyeBlock && (pl.eyeBlock & 4095) === B.water && Math.random() < 0.6) {
      this.spawn('p_dust', pl.x + (Math.random() - 0.5) * 12, pl.eyeY() + (Math.random() - 0.5) * 6, pl.z + (Math.random() - 0.5) * 12, { vx: (Math.random() - 0.5) * 0.004, vy: 0.002, vz: (Math.random() - 0.5) * 0.004, drag: 1, life: 100, size: 0.03, color: [0.7, 0.85, 0.9], alpha: 0.7 });
    }
    if (w.dim === 'nether') for (let k = 0; k < 4; k++) {
      const bio = pl.biome;
      const c = bio === BIO.CRIMSON ? [0.8, 0.2, 0.15] : bio === BIO.WARPED ? [0.2, 0.7, 0.8] : bio === BIO.SOUL_VALLEY ? [0.4, 0.8, 0.9] : [0.6, 0.55, 0.55];
      this.spawn('p_dust', pl.x + (Math.random() - 0.5) * 24, pl.y + (Math.random() - 0.3) * 12, pl.z + (Math.random() - 0.5) * 24, { vx: (Math.random() - 0.5) * 0.02, vy: -0.01, vz: (Math.random() - 0.5) * 0.02, life: 80, size: 0.05, color: c, drag: 1 });
    }
  }
  scanEmitters(w, px, py, pz) {
    const out = this.emitters; out.length = 0;
    const cf = B.campfire, sf = B.soul_campfire;
    for (let cz = (pz - 16) >> 4; cz <= (pz + 16) >> 4; cz++) for (let cx = (px - 16) >> 4; cx <= (px + 16) >> 4; cx++) {
      const c = w.getChunk(cx, cz); if (!c) continue;
      const y0 = Math.max(0, py - 12), y1 = Math.min(CH - 1, py + 12), b = c.blocks;
      for (let y = y0; y <= y1; y++) {
        if (!c.sections[y >> 4].nonAir) { y |= 15; continue; }
        const base = y << 8;
        for (let i = 0; i < 256; i++) { const id = b[base | i] & 4095; if (id === cf || id === sf) { out.push([cx * 16 + (i & 15), y, cz * 16 + (i >> 4), id === sf]); if (out.length >= 24) return; } }
      }
    }
  }
  draw(R, extra) {
    const gl = R.gl, L = this.list, w = this.game.world, alpha = this.game.alpha;
    const all = extra ? L.concat(extra) : L;
    if (!all.length) return;
    const pr = R.progs.part;
    gl.useProgram(pr.p); R.setEnvUniforms(pr);
    gl.uniformMatrix4fv(pr.u.uProj, false, R.vp);
    const v = R.view;
    gl.uniform3f(pr.u.uRight, v[0], v[4], v[8]); gl.uniform3f(pr.u.uUp, v[1], v[5], v[9]);
    if (!this.vao) {
      this.vao = gl.createVertexArray(); this.vbo = gl.createBuffer();
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      const st = 56;
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, st, 0); gl.enableVertexAttribArray(0); gl.vertexAttribDivisor(0, 1);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, st, 16); gl.enableVertexAttribArray(1); gl.vertexAttribDivisor(1, 1);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 32); gl.enableVertexAttribArray(2); gl.vertexAttribDivisor(2, 1);
      gl.vertexAttribPointer(3, 2, gl.FLOAT, false, st, 48); gl.enableVertexAttribArray(3); gl.vertexAttribDivisor(3, 1);
      gl.bindVertexArray(null);
    }
    const env = R.env;
    for (let src = 0; src < 2; src++) {
      let n = 0;
      const d = this.data;
      for (const p of all) {
        if (p.src !== src || n >= this.max) continue;
        const t = (p.age + alpha) / p.life;
        const o = n * 14;
        const x = p.x + p.vx * alpha, y = p.y + p.vy * alpha, z = p.z + p.vz * alpha;
        d[o] = x - R.camX; d[o + 1] = y - R.camY; d[o + 2] = z - R.camZ;
        d[o + 3] = p.size * (p.shrink ? 1 - t : 1) * (p.src === 1 && !p.emissive ? 1.4 : 1);
        d[o + 4] = p.uv[0]; d[o + 5] = p.uv[1]; d[o + 6] = p.uv[2]; d[o + 7] = p.uv[3];
        d[o + 8] = p.color[0]; d[o + 9] = p.color[1]; d[o + 10] = p.color[2]; d[o + 11] = p.alpha * (p.fade ? Math.min(1, (1 - t) * 2) : 1);
        d[o + 12] = p.layer;
        let lt = 1;
        if (!p.emissive) { const l = w.getLight(Math.floor(x), Math.floor(y), Math.floor(z)); const sky = (l >> 4) / 15 * (env.nether ? 0 : Math.max(0.15, env.day)), bl = (l & 15) / 15; lt = Math.max(0.12, Math.max(sky, bl), env.nether ? 0.45 : 0); }
        else lt = env.emissive;
        d[o + 13] = lt;
        n++;
      }
      if (!n) continue;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, src === 0 ? R.blockTex : R.itemTex); gl.uniform1i(pr.u.uTexP, 0); gl.bindSampler(0, R.sampNearest);
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, n * 14), gl.STREAM_DRAW);
      gl.disable(gl.CULL_FACE);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
      gl.enable(gl.CULL_FACE);
    }
    gl.bindSampler(0, null);
    gl.bindVertexArray(null);
  }
}
