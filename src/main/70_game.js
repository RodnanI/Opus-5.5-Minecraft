// ============================================================================
//  Game: lifecycle, main loop, camera, entity rendering, block entities, portals
// ============================================================================
const MENU_SEED = 20260922;
// unlit / lit block pairs for everything that smelts
const FURNACE_PAIRS = {};
for (const [a, b] of [[B.furnace, B.lit_furnace], [B.blast_furnace, B.lit_blast_furnace], [B.smoker, B.lit_smoker]]) FURNACE_PAIRS[a] = FURNACE_PAIRS[b] = [a, b];
class Game {
  constructor() {
    this.canvas = $('#gl');
    this.state = 'boot'; this.frame = 0; this.tickCount = 0; this.time = 6000; this.alpha = 0;
    this.rainLevel = 0; this.thunderLevel = 0; this.lightning = 0;
    this.weather = { rain: false, thunder: false, timer: 12000 };
    this.difficulty = 2; this.gameRules = { keepInventory: false, mobGriefing: true, doDaylightCycle: true, fireSpread: true, naturalRegen: true };
    this.camera = { x: 0, y: 100, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 70 };
    this.fpsSmooth = 60; this.frameMs = 16;
    this.player = null; this.world = null; this.meta = null;
    this.matBuf = new Float32Array(24 * 16);
    this.boostFx = 0; this.shake = 0;
  }
  async boot() {
    const gl = GLX.init(this.canvas);
    if (!gl) { $('#fatal').style.display = 'flex'; $('#fatal').innerHTML = '<div><h1>WebGL 2 is not available</h1><p>This game needs a browser with WebGL 2 support (Chrome, Edge, Firefox, Safari 15+).</p></div>'; return; }
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); alert('Graphics context lost — please reload the page.'); });
    if (GLX.software && !SETTINGS.swApplied) { applyPreset('potato'); SETTINGS.swApplied = 1; saveSettings(); }
    this.renderer = new Renderer(this);
    this.perf = new PerfGovernor(this);
    defineModels();
    for (const k in MODELS) uploadModel(gl, MODELS[k]);
    buildVehicleModels(gl);
    buildEndModels(gl);
    this.renderer.setSkins(SKIN_CANVASES);
    await buildIcons(this.renderer);
    this.jobs = new Jobs(() => { });
    this.jobs.onFree = () => { if (this.world) this.world.feed(); };
    this.audio = new Audio(this);
    this.save = new Save(this);
    this.particles = new Particles(this);
    this.munitions = new Munitions(this);
    this.endFight = new EndFight(this);
    this.ui = new UI(this);
    await this.ui.prepareIcons();
    this.input = new Input(this);
    this.vhud = new VehicleHUD(this);
    this.renderer.resize();
    $('#boot').remove();
    this.startMenuWorld();
    this.ui.showTitle();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.meta) { this.saveAll(); if (this.state === 'playing') this.pause(); } });
    window.addEventListener('beforeunload', () => { if (this.meta) this.saveAll(); });
    window.addEventListener('resize', () => this.renderer.resize());
    setInterval(() => { if (this.meta && (this.state === 'playing' || this.state === 'paused')) this.saveAll(); }, 60000);
  }
  // ---------------------------------------------------------------- menu panorama world
  startMenuWorld() {
    this.state = 'menu';
    this.meta = null; this.player = null;
    this.jobs.broadcast({ t: 'init', seed: MENU_SEED, opts: {} });
    this.gen = new OverworldGen(MENU_SEED, {});
    const s = this.findSpawn(this.gen);
    this.menuCenter = [s[0], this.gen.climateCached(s[0], s[2]).h + 28, s[2]];
    if (this.world) this.disposeWorld(this.world);
    this.world = new World(this, 'overworld');
    this.world.isMenu = true;
    this.time = 5200; this.rainLevel = 0;
  }
  findSpawn(gen) {
    for (let r = 0; r < 2000; r += 16) {
      for (let a = 0; a < Math.max(1, r / 4); a++) {
        const an = a / Math.max(1, r / 4) * TAU, x = Math.round(Math.cos(an) * r), z = Math.round(Math.sin(an) * r);
        const c = gen.climateCached(x, z);
        const b = BIOMES[c.biome];
        if (c.h > SEA + 1.5 && !b.ocean && c.biome !== BIO.RIVER && c.biome !== BIO.BEACH && c.m < 0.3 && c.amp < 1 && !gen.entrance(x, z)) return [x + 0.5, Math.ceil(c.h) + 1, z + 0.5];
      }
    }
    return [0.5, 90, 0.5];
  }
  // ---------------------------------------------------------------- world lifecycle
  async createWorld(opts) {
    const meta = Object.assign({ id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), created: Date.now(), lastPlayed: Date.now(), time: 1000, player: null, portals: { overworld: [], nether: [] }, rules: Object.assign({}, this.gameRules), weather: { rain: false, thunder: false, timer: 12000 + randInt(0, 12000) } }, opts);
    await this.save.putWorld(meta);
    this.playWorld(meta);
  }
  async playWorld(meta) {
    this.ui.clearScreen();
    this.meta = meta; this.save.worldId = meta.id;
    meta.lastPlayed = Date.now();
    this.jobs.broadcast({ t: 'init', seed: meta.seed, opts: { worldType: meta.type, structures: meta.structures !== false } });
    this.gen = new OverworldGen(meta.seed, { worldType: meta.type, structures: meta.structures !== false });
    this.time = meta.time || 0; this.difficulty = meta.difficulty; this.gameRules = Object.assign({}, this.gameRules, meta.rules || {});
    this.weather = meta.weather || { rain: false, thunder: false, timer: 12000 }; this.rainLevel = this.weather.rain ? 1 : 0; this.thunderLevel = this.weather.thunder ? 1 : 0;
    const p = this.player = new Player(this);
    let dim = 'overworld', fresh = !meta.player;
    if (meta.player) {
      const s = meta.player;
      p.x = s.x; p.y = s.y; p.z = s.z; p.yaw = s.yaw; p.pitch = s.pitch; dim = s.dim || 'overworld';
      p.health = s.health; p.food = s.food; p.sat = s.sat; p.xp = s.xp || 0; p.xpLevel = s.xpLevel || 0; p.inv.load(s.inv); p.sel = s.sel || 0;
      p.mode = s.mode || meta.mode; p.flying = !!s.flying; p.spawnPoint = s.spawn || null; p.air = s.air || 300;
      if (!(s.health > 0)) { const sp = p.spawnPoint || { x: meta.spawn[0], y: meta.spawn[1], z: meta.spawn[2] }; p.health = 20; p.food = 20; p.sat = 5; p.air = 300; dim = 'overworld'; p.x = sp.x; p.y = sp.y + 0.5; p.z = sp.z; }
    } else {
      p.mode = meta.mode;
      const sp = meta.spawn || this.findSpawn(this.gen);
      meta.spawn = sp;
      p.x = sp[0]; p.y = sp[1] + 2; p.z = sp[2]; p.yaw = Math.random() * TAU;
    }
    p.savePrev();
    await this.enterDimension(dim, p.x, p.z, fresh ? 'Generating world' : 'Loading world');
    this.loadingDone = () => {
      if (fresh) {
        const w = this.world, bx = Math.floor(p.x), bz = Math.floor(p.z);
        p.y = w.heightAt(bx, bz) + 0.01;
        while (p.y < CH - 2 && (SOLID[w.getId(bx, Math.floor(p.y), bz)] || SOLID[w.getId(bx, Math.floor(p.y) + 1, bz)])) p.y++;
        p.savePrev();
        meta.spawn = [p.x, p.y, p.z];
        if (meta.bonus && p.mode === 'survival') this.placeBonusChest(bx + 2, bz);
        if (p.mode === 'creative') this.ui.message('Creative mode: double-tap jump to fly. Press E for all blocks.', '#ffd24a');
        else this.ui.message('Welcome! Punch a tree to get started. Press E for your inventory & recipe book.', '#ffd24a');
        this.saveAll();
      }
    };
  }
  disposeWorld(w) {
    for (const c of w.chunks.values()) for (const sec of c.sections) this.renderer.freeSection(sec);
    w.chunks.clear(); w.pending.clear(); w.meshQueue.clear(); w.urgent.clear(); w.lightQueue.length = 0; w.entities.length = 0;
    this.renderer.visDirty = true;
  }
  async enterDimension(dim, x, z, text) {
    if (this.world) { if (this.world.isMenu) this.disposeWorld(this.world); else if (this.world.dim !== dim) await this.unloadWorld(); }
    this.world = new World(this, dim);
    if (this.player) { this.player.world = this.world; this.world.entities.push(this.player); }
    this.world.savedKeys = await this.save.chunkKeys(this.meta.id, dim);
    this.state = 'loading'; this.loadText = text; this.loadTarget = [x, z];
    this.loadStart = performance.now();
    this.ui.showLoading(text + '…', 0);
    this.renderer.visDirty = true;
  }
  async unloadWorld() {
    const w = this.world; if (!w) return;
    for (const c of [...w.chunks.values()]) w.unloadChunk(c);
    await this.save.flush();
    for (const e of w.entities) e.removed = true;
    this.renderer.visDirty = true;
  }
  checkLoaded() {
    const [x, z] = this.loadTarget, w = this.world;
    const R = 2, cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    let ok = 0, tot = 0;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { tot++; const c = w.getChunk(cx + dx, cz + dz); if (c && c.meshable) ok++; }
    this.ui.showLoading(this.loadText + '…', ok / tot);
    return ok === tot;
  }
  placeBonusChest(x, z) {
    const w = this.world, y = w.heightAt(x, z);
    w.setBlock(x, y, z, B.chest, 0);
    const items = [{ id: I.stone_axe || I.wooden_axe, n: 1, d: 0 }, { id: I.wooden_pickaxe, n: 1, d: 0 }, { id: I.bread, n: 5, d: 0 }, { id: B.oak_log, n: 10, d: 0 }, { id: I.apple, n: 3, d: 0 }, { id: B.torch, n: 8, d: 0 }].concat(new Array(21).fill(null));
    w.setBE(x, y, z, { t: 'chest', items });
    w.setBlock(x + 1, y, z, B.torch, 1);
  }
  async saveAll() {
    if (!this.meta || !this.player) return;
    const w = this.world, p = this.player, meta = this.meta;
    if (w) for (const c of w.chunks.values()) if (c.modified) this.save.saveChunk(w, c);
    await this.save.flush();
    meta.time = this.time; meta.lastPlayed = Date.now(); meta.weather = this.weather; meta.rules = this.gameRules; meta.difficulty = this.difficulty;
    const py = p.vehicle && (p.vehicle.agl || 0) > 2 ? w.heightAt(Math.floor(p.x), Math.floor(p.z)) + 0.01 : p.y;
    meta.player = { x: p.x, y: py, z: p.z, yaw: p.yaw, pitch: p.pitch, dim: w ? w.dim : 'overworld', health: p.health, food: p.food, sat: p.sat, xp: p.xp, xpLevel: p.xpLevel, inv: p.inv.serialize(), sel: p.sel, mode: p.mode, flying: p.flying, spawn: p.spawnPoint, air: p.air };
    await this.save.putWorld(meta);
  }
  async quitToTitle() {
    const pv = this.player && this.player.vehicle;
    if (pv) { pv.dismount(true); if ((pv.agl || 0) > 2) this.player.y = this.world.heightAt(Math.floor(this.player.x), Math.floor(this.player.z)) + 0.01; }
    this.ui.closeScreen(true);
    this.ui.showLoading('Saving world', 0.5);
    await this.saveAll();
    await this.unloadWorld();
    this.disposeWorld(this.world);
    this.ui.hideLoading();
    this.input.releaseLock();
    this.startMenuWorld();
    this.ui.showTitle();
  }
  pause() { if (this.state !== 'playing') return; this.ui.closeScreen(true); this.state = 'paused'; this.input.releaseLock(); this.ui.showPause(); this.input.updateTouchVisibility(); this.saveAll(); }
  resume() { if (this.state !== 'paused') return; this.ui.clearScreen(); this.state = 'playing'; this.input.requestLock(); this.input.updateTouchVisibility(); }
  onPlayerDeath() { this.state = 'dead'; this.input.releaseLock(); this.ui.closeScreen(true); this.ui.showDeath(this.player.deathMsg); this.input.updateTouchVisibility(); }
  async respawn() {
    const p = this.player;
    p.respawn();
    const sp = p.spawnPoint && p.spawnPoint.dim === 'overworld' ? p.spawnPoint : null;
    const target = sp ? [sp.x, sp.y, sp.z] : this.meta.spawn;
    p.x = target[0]; p.y = target[1] + 0.5; p.z = target[2]; p.vx = p.vy = p.vz = 0; p.savePrev();
    this.ui.clearScreen();
    if (this.world.dim !== 'overworld') await this.enterDimension('overworld', p.x, p.z, 'Respawning');
    else { this.state = 'loading'; this.loadTarget = [p.x, p.z]; this.loadText = 'Respawning'; this.loadStart = performance.now(); this.ui.showLoading('Respawning…', 0); }
    this.loadingDone = () => {
      const w = this.world;
      if (sp && sp.bx > -1e8 && w.getId(sp.bx, sp.by, sp.bz) !== B.red_bed) { p.spawnPoint = null; this.ui.message('Your home bed was missing or obstructed', '#f88'); const s = this.meta.spawn; p.x = s[0]; p.y = s[1]; p.z = s[2]; }
      p.y = Math.max(p.y, w.heightAt(Math.floor(p.x), Math.floor(p.z)));
      while (p.y < CH - 2 && (SOLID[w.getId(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))] || SOLID[w.getId(Math.floor(p.x), Math.floor(p.y) + 1, Math.floor(p.z))])) p.y++;
      p.savePrev();
    };
  }
  // ---------------------------------------------------------------- main loop
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const S = SETTINGS;
    if (S.fpsCap && this.lastRender && t - this.lastRender < 1000 / S.fpsCap - 1.5) return;
    const interval = t - this.last;
    let dt = Math.min(0.1, interval / 1000);
    this.last = t; this.lastRender = t;
    this.frame++;
    const t0 = performance.now();
    this.fpsSmooth += (1 / Math.max(dt, 0.001) - this.fpsSmooth) * 0.05;
    try { this.frameUpdate(dt); } catch (e) { console.error(e); if (!this.errShown) { this.errShown = true; this.ui.message('Error: ' + e.message, '#f66'); } }
    const work = performance.now() - t0;
    this.frameMs += (work - this.frameMs) * 0.1;
    if (this.perf) this.perf.update(interval, work);
  }
  frameUpdate(dt) {
    const w = this.world, p = this.player;
    if (this.state === 'loading') {
      w.update(this.loadTarget[0], this.loadTarget[1], 12);
      this.jobs.pump(this.frameMs);
      this.camera.x = this.loadTarget[0]; this.camera.z = this.loadTarget[1];
      if (this.checkLoaded() || performance.now() - this.loadStart > 45000) {
        this.state = 'playing'; this.ui.hideLoading();
        if (this.loadingDone) { const f = this.loadingDone; this.loadingDone = null; f(); }
        this.input.requestLock(); this.ui.onSlotChange(); this.input.updateTouchVisibility();
      }
      return;
    }
    if (this.state === 'menu') {
      const c = this.camera, m = this.menuCenter;
      const a = performance.now() / 1000 * 0.03;
      c.x = m[0] + Math.cos(a) * 6; c.y = m[1]; c.z = m[2] + Math.sin(a) * 6;
      c.yaw = a * 1.3 + 1.2; c.pitch = -0.18; c.roll = 0; c.fov = 72;
      const R0 = EFF.renderDist; EFF.renderDist = Math.min(R0, IS_MOBILE ? 5 : 8);
      w.update(c.x, c.z, 6);
      this.time += dt * 20 * 0.5;
      this.renderer.render(this, dt);
      EFF.renderDist = R0;
      this.jobs.pump(this.frameMs);
      this.audio.update(dt);
      return;
    }
    const playing = this.state === 'playing';
    if (playing && !this.ui.open && !this.ui.chatOpen) this.input.applyLook(p, dt);
    if (playing || this.state === 'dead') {
      this.acc = (this.acc || 0) + dt;
      let n = 0;
      while (this.acc >= 0.05 && n++ < 5) { this.tick(); this.acc -= 0.05; }
      if (this.acc > 0.25) this.acc = 0;
    }
    this.alpha = clamp((this.acc || 0) / 0.05, 0, 1);
    if (playing || this.state === 'dead') this.updateVehicles(dt);
    w.update(p.x, p.z, playing ? 4 : 8);
    this.jobs.pump(this.frameMs);
    this.updateCamera(dt);
    // targeting
    if (p && !p.dead) {
      let ray = null;
      const aim = this.input.t.aim;
      if (IS_TOUCH && SETTINGS.touchAim === 'touch' && aim && p.camMode === 0) ray = this.screenRay(aim[0], aim[1]);
      p.updateTarget(ray);
    }
    this.renderer.render(this, dt);
    if (this.wantShot) { this.wantShot = false; this.canvas.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'voxelcraft_' + Date.now() + '.png'; a.click(); }); this.ui.message('Saved screenshot', '#afa'); }
    this.ui.updateHUD(dt);
    this.vhud.draw(dt);
    this.ui.tickScreens();
    if ((this.frame & 15) === 0) this.input.updateTouchVisibility();
    this.audio.update(dt);
    if (p.sleeping) this.ui.showSleep(Math.min(1, p.sleeping / 80));
  }
  screenRay(sx, sy) {
    const R = this.renderer, iv = R.invVP;
    const nx = sx / window.innerWidth * 2 - 1, ny = 1 - sy / window.innerHeight * 2;
    const a = transformPoint(iv, nx, ny, -1, [0, 0, 0, 0]), b = transformPoint(iv, nx, ny, 1, [0, 0, 0, 0]);
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz);
    return { o: [this.camera.x, this.camera.y, this.camera.z], d: [dx / l, dy / l, dz / l] };
  }
  skyFactor() {
    if (!this.world || this.world.dim === 'nether') return 0;
    if (this.world.dim === 'end') return 0.5;   // no day in the End: a constant dusk
    const sy = Math.sin(((this.time % 24000) / 24000) * TAU);
    return (0.27 + 0.73 * smoothstep(-0.18, 0.22, sy)) * (1 - this.rainLevel * 0.25 - this.thunderLevel * 0.25);
  }
  updateVehicles(dt) {
    const w = this.world, p = this.player, M = this.munitions;
    M.beginFrame();
    const inp = this.input.vehicleState();
    let boost = 0;
    for (let i = 0; i < w.entities.length; i++) {
      const e = w.entities[i];
      if (!e.isVehicle || e.removed) continue;
      if (e.y < -80) { e.hurt(1e6, { type: 'void' }); continue; }
      if (e !== p.vehicle && e.dist2(p.x, p.y, p.z) > 180 * 180) continue;
      e.frame(dt, e.rider === p ? inp : null);
      if (e.rider === p && e.boosting) boost = 1;
    }
    M.update(dt);
    this.boostFx += (boost - this.boostFx) * Math.min(1, dt * 4);
  }
  toggleVehicle() {
    const p = this.player; if (!p || p.dead || this.state !== 'playing' || this.ui.open) return;
    if (p.vehicle) { p.vehicle.dismount(); return; }
    if (p.spectator || p.sleeping) return;
    let best = null, bd = Infinity;
    for (const e of this.world.entities) {
      if (!e.isVehicle || e.removed || e.rider) continue;
      const r = e.def.radius + 2.5, d = e.dist2(p.x, p.y, p.z);
      if (d < r * r && d < bd) { bd = d; best = e; }
    }
    if (best) best.mount(p); else this.ui.message('No vehicle in reach. Stand next to one and press F.', '#f88');
  }
  updateCamera(dt) {
    const p = this.player, c = this.camera, a = this.alpha, S = SETTINGS;
    if (p.vehicle && !p.dead) { p.vehicle.cameraUpdate(c, dt, p); this.applyShake(c, dt); return; }
    let x = p.ix(a), y = p.iy(a), z = p.iz(a);
    const eye = p.sneaking && !p.flying ? 1.27 : 1.62;
    c.eyeCur = c.eyeCur === undefined ? eye : c.eyeCur + (eye - c.eyeCur) * Math.min(1, dt * 12);
    y += c.eyeCur;
    if (p.sleeping) y = p.y + 0.35;
    if (p.dead) y = p.iy(a) + 0.3;
    let roll = 0;
    if (S.viewBob && p.camMode === 0 && !p.flying) {
      const bob = p.lbob + (p.bob - p.lbob) * a, amt = p.lbobAmt + (p.bobAmt - p.lbobAmt) * a;
      const bx = Math.sin(bob * Math.PI) * amt * 0.04, by = -Math.abs(Math.cos(bob * Math.PI)) * amt * 0.07;
      x += Math.cos(p.yaw) * bx; z += Math.sin(p.yaw) * bx; y += by;
      roll = Math.sin(bob * Math.PI) * amt * 0.01;
    }
    if (p.hurtTime > 0) roll += Math.sin(p.hurtTime / 10 * Math.PI) * 0.12 * (p.hurtDir !== undefined ? Math.sign(Math.sin(p.hurtDir)) || 1 : 1);
    if (p.dead) roll = Math.min(1.2, (c.roll || 0) + dt * 2);
    c.yaw = p.yaw; c.pitch = p.pitch; c.roll = roll;
    if (p.camMode > 0) {
      const d = p.lookVec(), dir = p.camMode === 1 ? -1 : 1;
      let dist = 4;
      const hit = raycast(this.world, x, y, z, d[0] * dir, d[1] * dir, d[2] * dir, 4.2, false);
      if (hit) dist = Math.max(0.3, hit.t - 0.3);
      x += d[0] * dir * dist; y += d[1] * dir * dist; z += d[2] * dir * dist;
      if (p.camMode === 2) { c.yaw = p.yaw + Math.PI; c.pitch = -p.pitch; }
    }
    c.x = x; c.y = y; c.z = z;
    let fovMul = 1;
    if (p.sprinting) fovMul *= 1.12;
    if (p.flying) fovMul *= 1.08;
    if (p.using === 'bow') fovMul *= 1 - Math.min(1, p.useTicks / 20) * 0.15;
    if (p.using === 'spyglass') fovMul *= 0.1;
    p.fovMul += (fovMul - p.fovMul) * Math.min(1, dt * 10);
    c.fov = S.fov * p.fovMul;
    this.applyShake(c, dt);
  }
  applyShake(c, dt) {
    if (!(this.shake > 0.001)) return;
    const s = this.shake * this.shake;
    c.x += (Math.random() - 0.5) * s * 0.6; c.y += (Math.random() - 0.5) * s * 0.6; c.z += (Math.random() - 0.5) * s * 0.6;
    c.pitch += (Math.random() - 0.5) * s * 0.05; c.yaw += (Math.random() - 0.5) * s * 0.05;
    this.shake = Math.max(0, this.shake - dt * 1.6);
  }
  // ---------------------------------------------------------------- simulation tick
  tick() {
    const w = this.world, p = this.player;
    this.tickCount++;
    if (this.gameRules.doDaylightCycle) this.time++;
    this.tickWeather();
    let st = this.input.state();
    if (st.tap && p.target) { if (p.target.entity) st.attackPressed = true; else { st.usePressed = true; st.use = true; } }
    else if (st.tap) { st.use = true; }
    if (IS_TOUCH && st.attack && !st.attackPressed) { const hd = ITEMS[p.heldId()]; if (hd && (hd.food || hd.use === 'bow' || hd.use === 'drink')) { st.attack = false; st.use = true; } }
    if (this.tpSurface) this.settleTeleport();
    if (this.state === 'playing') p.tick(st); else p.savePrev();
    // entities
    const ents = w.entities;
    const ED = SETTINGS.entityDist + 32;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e.removed || e === p) continue;
      if (e.isMob && e.dist2(p.x, p.y, p.z) > ED * ED * 4 && !e.persistent) { e.removed = true; continue; }
      if (!w.isLoaded(Math.floor(e.x), Math.floor(e.z))) { if (!e.persistent) e.removed = true; continue; }
      if (e.isMob && e.dist2(p.x, p.y, p.z) > 96 * 96 && !e.dead) { e.savePrev(); continue; }
      e.tick();
    }
    let j = 0;
    for (let i = 0; i < ents.length; i++) { const e = ents[i]; if (!e.removed) ents[j++] = e; else w.entityById.delete(e.id); }
    ents.length = j;
    // world ticks
    w.runScheduled(600);
    this.randomTicks();
    this.tickBlockEntities();
    if (this.tickCount % 20 === 0) mobSpawnTick(this);
    this.endFight.tick();
    this.particles.tick();
    if (this.lightning > 0) this.lightning = Math.max(0, this.lightning - 0.15);
  }
  tickWeather() {
    const W = this.weather;
    if (this.world.dim === 'overworld') {
      if (--W.timer <= 0) {
        if (W.rain) { W.rain = false; W.thunder = false; W.timer = randInt(12000, 30000); }
        else { W.rain = true; W.thunder = Math.random() < 0.3; W.timer = randInt(6000, 14000); }
      }
    }
    // natural changes drift in over ~40s; /weather snaps over ~2s so the command visibly takes effect
    const rt = W.rain ? 1 : 0, tt = W.thunder ? 1 : 0, k = this.weatherSnap ? 0.08 : 0.004;
    this.rainLevel += (rt - this.rainLevel) * k;
    this.thunderLevel += (tt - this.thunderLevel) * k;
    if (this.weatherSnap && Math.abs(rt - this.rainLevel) < 0.01 && Math.abs(tt - this.thunderLevel) < 0.01) { this.rainLevel = rt; this.thunderLevel = tt; this.weatherSnap = false; }
    if (this.thunderLevel > 0.5 && this.world.dim === 'overworld' && Math.random() < 1 / 1500) {
      const p = this.player, x = Math.floor(p.x + randInt(-60, 60)), z = Math.floor(p.z + randInt(-60, 60));
      this.lightning = 1;
      setTimeout(() => this.audio.play('thunder', { vol: 0.8 }), 200 + Math.random() * 1500);
      if (this.world.isLoaded(x, z)) { const y = this.world.heightAt(x, z); if (this.world.getId(x, y, z) === 0 && this.gameRules.fireSpread) { this.world.setBlock(x, y, z, B.fire, 1); this.world.schedule(x, y, z, 30); } }
    }
  }
  randomTicks() {
    const w = this.world, p = this.player;
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16), R = Math.min(6, EFF.renderDist);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const c = w.getChunk(pcx + dx, pcz + dz); if (!c || !c.lit) continue;
      for (let s = 0; s < NSEC; s++) {
        if (!c.sections[s].nonAir) continue;
        for (let k = 0; k < 3; k++) {
          const r = (Math.random() * 4096) | 0, x = r & 15, z = (r >> 4) & 15, y = s * 16 + (r >> 8);
          const v = c.blocks[(y << 8) | (z << 4) | x]; const id = v & 4095;
          if (id === 0 || id === B.stone || id === B.dirt || id === B.deepslate || id === B.netherrack || id === B.water) continue;
          randomTick(w, c.cx * 16 + x, y, c.cz * 16 + z, v);
        }
      }
    }
    // snow accumulation & ice formation during precipitation
    if (this.rainLevel > 0.5 && w.dim === 'overworld' && Math.random() < 0.3) {
      const x = Math.floor(p.x) + randInt(-32, 32), z = Math.floor(p.z) + randInt(-32, 32);
      if (w.isLoaded(x, z)) {
        const y = w.heightAt(x, z);
        if (w.isSnowyAt(x, z, y)) { const b = w.getId(x, y - 1, z); if (b === B.water && (w.getBlock(x, y - 1, z) >> 12) === 0) w.setBlock(x, y - 1, z, B.ice, 1); else if (w.getId(x, y, z) === 0 && (OPAQUE[b] || LEAVES[b])) w.setBlock(x, y, z, B.snow_layer, 1); }
      }
    }
  }
  tickBlockEntities() {
    const w = this.world, p = this.player;
    for (const be of w.activeBE) {
      if (be.t === 'furnace') this.tickFurnace(w, be);
      else if (be.t === 'spawner') {
        if (p.dist2(be.x + 0.5, be.y + 0.5, be.z + 0.5) > 16 * 16) continue;
        if ((this.tickCount & 3) === 0) { this.particles.spawn('p_flame', be.x + Math.random(), be.y + Math.random(), be.z + Math.random(), { life: 10, size: 0.1, emissive: true }); this.particles.spawn('p_smoke', be.x + Math.random(), be.y + Math.random(), be.z + Math.random(), { life: 20, size: 0.2, color: [0.3, 0.3, 0.3] }); }
        if (be.delay === undefined) be.delay = 200;
        if (--be.delay > 0 || this.difficulty === 0) continue;
        be.delay = randInt(200, 800);
        const near = w.entitiesNear(be.x, be.y, be.z, 9, (e) => e.type === be.mob).length;
        if (near >= 6) continue;
        for (let i = 0, n = randInt(1, 4); i < n; i++) {
          const x = be.x + randInt(-4, 4), y = be.y + randInt(-1, 1), z = be.z + randInt(-4, 4);
          if (mobSpaceAt(w, x, y, z, be.mob === 'spider' ? 1 : 2) && (be.mob === 'imp' || w.lightLevel(x, y, z) <= 11)) { this.spawnMob(be.mob, x + 0.5, y, z + 0.5, null); this.particles.burst(x + 0.5, y + 0.5, z + 0.5, 'p_smoke', 6, [0.8, 0.8, 0.8]); }
        }
      }
    }
  }
  tickFurnace(w, be) {
    const it = be.items, inp = it[0], fuel = it[1], out = it[2];
    // blast furnaces (ores & raw metal) and smokers (food) only take their own recipes, at double speed
    const cur0 = w.getId(be.x, be.y, be.z), kind = BLOCKS[cur0] && BLOCKS[cur0].furnace || '';
    let rec = inp ? SMELT[inp.id] : null;
    if (rec && kind && rec.cat !== kind) rec = null;
    be.cookMax = kind ? 100 : 200;
    const can = rec && (!out || (out.id === rec.out && out.n < maxStack(out.id)));
    const wasLit = be.burn > 0;
    if (be.burn > 0) be.burn = Math.max(0, be.burn - (kind ? 2 : 1));
    if (be.burn <= 0 && can && fuel && fuelValue(fuel.id) > 0) {
      be.burn = be.burnMax = fuelValue(fuel.id);
      if (fuel.id === I.lava_bucket) it[1] = { id: I.bucket, n: 1, d: 0 };
      else { fuel.n--; if (fuel.n <= 0) it[1] = null; }
      this.markBE(be);
    }
    if (be.burn > 0 && can) {
      if (++be.cook >= be.cookMax) {
        be.cook = 0; inp.n--; if (inp.n <= 0) it[0] = null;
        if (out) out.n++; else it[2] = { id: rec.out, n: 1, d: 0 };
        be.xp = (be.xp || 0) + rec.xp;
        this.markBE(be);
      }
    } else be.cook = Math.max(0, be.cook - 2);
    const lit = be.burn > 0;
    const pair = FURNACE_PAIRS[cur0];
    if (pair && cur0 !== pair[lit ? 1 : 0]) { const meta = w.getBlock(be.x, be.y, be.z) >> 12; w.setBlock(be.x, be.y, be.z, pair[lit ? 1 : 0] | (meta << 12), 16); }
    if (lit && Math.random() < 0.05) this.particles.spawn('p_smoke', be.x + 0.5, be.y + 1.05, be.z + 0.5, { vy: 0.03, life: 25, size: 0.2, color: [0.4, 0.4, 0.4] });
  }
  markBE(be) { const c = this.world.getChunk(be.x >> 4, be.z >> 4); if (c) c.modified = true; }
  onBERemoved(be, x, y, z) {
    if (be.t === 'chest' && be.items) for (const s of be.items) if (s) this.dropItem(this.world, x + 0.5, y + 0.5, z + 0.5, s);
    if (be.t === 'chest' && be.loot) for (const s of rollLoot(be.loot, be.seed)) this.dropItem(this.world, x + 0.5, y + 0.5, z + 0.5, s);
    if (be.t === 'furnace') for (const s of be.items) if (s) this.dropItem(this.world, x + 0.5, y + 0.5, z + 0.5, s);
  }
  // ---------------------------------------------------------------- block use
  useBlock(x, y, z, v, p) {
    const w = this.world, id = v & 4095, meta = v >> 12, b = BLOCKS[id];
    switch (b.use) {
      case 'craft': this.ui.openCrafting(); return true;
      case 'furnace': { let be = w.getBE(x, y, z); if (!be) { be = { t: 'furnace', items: [null, null, null], burn: 0, burnMax: 0, cook: 0, xp: 0 }; w.setBE(x, y, z, be); } this.ui.openFurnace(be, b.furnace === 'ore' ? 'Blast Furnace' : b.furnace === 'food' ? 'Smoker' : 'Furnace'); return true; }
      case 'lamp': w.setBlock(x, y, z, (id === B.redstone_lamp ? B.lit_redstone_lamp : B.redstone_lamp) | (meta << 12), 1); this.audio.play('click', { x, y, z, vol: 0.5 }); return true;
      case 'note': {
        const pitch = (meta + 1) & 15;
        w.setBlock(x, y, z, id | (pitch << 12), 0);
        const below = w.getId(x, y - 1, z), mat = BLOCKS[below] ? BLOCKS[below].snd : 'stone';
        this.audio.play('note', { x, y, z, pitch, mat });
        this.particles.spawn('p_note', x + 0.5, y + 1.2, z + 0.5, { vy: 0.02, life: 12, size: 0.25, color: [0.5 + 0.5 * Math.sin(pitch * 0.4), 0.5 + 0.5 * Math.sin(pitch * 0.4 + 2.1), 0.5 + 0.5 * Math.sin(pitch * 0.4 + 4.2)], emissive: true, fade: true });
        return true;
      }
      case 'berries': {
        if (meta < 2) return false;
        this.dropItem(w, x + 0.5, y + 0.5, z + 0.5, { id: I.sweet_berries, n: meta >= 3 ? randInt(2, 3) : randInt(1, 2), d: 0 });
        w.setBlock(x, y, z, id | (1 << 12), 0);
        this.audio.play('dig', { mat: 'grass', x, y, z, vol: 0.5 }); return true;
      }
      case 'chest': { let be = w.getBE(x, y, z); if (!be) { be = { t: 'chest', items: new Array(27).fill(null) }; w.setBE(x, y, z, be); } if (id === B.chest && OPAQUE[w.getId(x, y + 1, z)]) return true; this.ui.openChest(be, id === B.barrel ? 'Barrel' : 'Chest'); return true; }
      case 'door': {
        if (b.ironDoor) return false;
        const low = (meta & 8) ? y - 1 : y; const lv = w.getBlock(x, low, z);
        const nm = (lv >> 12) ^ 4; w.setBlock(x, low, z, id | (nm << 12), 0); w.markBlockDirty(x, low + 1, z, true);
        this.audio.play((nm & 4) ? 'door_open' : 'door_close', { x, y, z }); return true;
      }
      case 'trapdoor': w.setBlock(x, y, z, id | ((meta ^ 4) << 12), 1); this.audio.play((meta & 4) ? 'door_close' : 'door_open', { x, y, z }); return true;
      case 'gate': { const open = meta & 4; const nm = open ? (meta & 3) : (((p.facing()) & 3) | 4); w.setBlock(x, y, z, id | (nm << 12), 1); this.audio.play(open ? 'door_close' : 'door_open', { x, y, z }); return true; }
      case 'bed': return this.useBed(x, y, z, v, p);
      case 'tnt': return false;
      case 'egg': this.teleportEgg(x, y, z); return true;
    }
    return false;
  }
  // the dragon egg will not be taken by hand: touch it and it blinks somewhere nearby
  teleportEgg(x, y, z) {
    const w = this.world, P = this.particles;
    for (let i = 0; i < 64; i++) {
      const nx = x + randInt(-15, 15), nz = z + randInt(-15, 15);
      let ny = clamp(y + randInt(-7, 7), 2, CH - 2);
      if (!w.isLoaded(nx, nz) || w.getId(nx, ny, nz) !== 0) continue;
      while (ny > 1 && w.getId(nx, ny - 1, nz) === 0) ny--;
      if (ny <= 1 || !SOLID[w.getId(nx, ny - 1, nz)]) continue;
      w.setBlock(x, y, z, 0, 1); w.setBlock(nx, ny, nz, B.dragon_egg, 1);
      for (let k = 0; k < 48; k++) { const t = k / 48; P.spawn('p_portal', x + 0.5 + (nx - x) * t + (Math.random() - 0.5) * 0.4, y + 0.5 + (ny - y) * t + (Math.random() - 0.5) * 0.4, z + 0.5 + (nz - z) * t + (Math.random() - 0.5) * 0.4, { vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.5) * 0.02, vz: (Math.random() - 0.5) * 0.02, life: 30 + k, size: 0.1, emissive: true, color: [0.75, 0.4, 1] }); }
      this.audio.play('teleport', { x, y, z });
      return true;
    }
    return false;
  }
  useBed(x, y, z, v, p) {
    const w = this.world, meta = v >> 12;
    if (w.dim !== 'overworld') { w.setBlock(x, y, z, 0, 1); explode(w, x + 0.5, y + 0.5, z + 0.5, 5, true, null); return true; }
    const f = meta & 3, head = meta & 4;
    const hx = head ? x : x + FACING_DX[f], hz = head ? z : z + FACING_DZ[f];
    p.spawnPoint = { dim: 'overworld', x: hx + 0.5, y: y + 0.6, z: hz + 0.5, bx: hx, by: y, bz: hz };
    const t = this.time % 24000;
    const night = t > 12500 && t < 23500 || this.weather.thunder;
    if (!night) { this.ui.message('Respawn point set. You can only sleep at night or during thunderstorms.'); return true; }
    const mons = w.entitiesNear(x, y, z, 8, (e) => e.isMob && e.def.hostile && !e.dead);
    if (mons.length && this.difficulty > 0) { this.ui.message('You may not rest now; there are monsters nearby', '#f88'); return true; }
    p.sleeping = 1; p.x = hx + 0.5; p.z = hz + 0.5; p.y = y + 0.56; p.vx = p.vy = p.vz = 0;
    this.ui.message('Respawn point set. Sleeping…');
    return true;
  }
  finishSleep() {
    const p = this.player;
    this.time = Math.ceil(this.time / 24000) * 24000 + 200;
    this.weather.rain = false; this.weather.thunder = false; this.rainLevel = 0; this.thunderLevel = 0;
    p.sleeping = 0; p.y += 0.5; this.ui.hideSleep();
    this.saveAll();
  }
  // ---------------------------------------------------------------- spawning helpers
  dropItem(w, x, y, z, stack, scatter) {
    if (!stack || stack.n <= 0) return;
    const e = new ItemEntity(x, y, z, { id: stack.id, n: stack.n, d: stack.d || 0 });
    if (scatter) { e.vx = (Math.random() - 0.5) * 0.5; e.vz = (Math.random() - 0.5) * 0.5; e.pickupDelay = 40; }
    w.addEntity(e); return e;
  }
  dropStack(stack) {
    const p = this.player, d = p.lookVec();
    const e = this.dropItem(this.world, p.x, p.eyeY() - 0.3, p.z, stack);
    if (e) { e.vx = d[0] * 0.3; e.vy = d[1] * 0.3 + 0.1; e.vz = d[2] * 0.3; e.pickupDelay = 40; }
  }
  dropHeld(all) {
    const p = this.player, s = p.heldStack(); if (!s) return;
    const n = all ? s.n : 1;
    this.dropStack({ id: s.id, n, d: s.d });
    s.n -= n; if (s.n <= 0) p.inv.set(p.sel, null); p.inv.version++; p.swingAnim = 1;
  }
  spawnMob(type, x, y, z, data, natural) {
    if (type === 'end_crystal') return this.world.addEntity(new EndCrystal(x, y, z));
    if (!MOB_DEFS[type]) return null;
    const m = new Mob(type, x, y, z, data ? Object.assign({}, data) : null);
    if (MOB_DEFS[type].villager || (natural && data && data.prof)) m.home = [x, y, z];
    if (type === 'witch' || type === 'villager') m.persistent = true;
    this.world.addEntity(m);
    return m;
  }
  spawnSaved(e) { if (e.type === 'vehicle') { const v = spawnVehicle(this.world, e.kind, e.x, e.y, e.z, e.yaw || 0); if (v && e.hp) v.hull = e.hp; return; } const m = this.spawnMob(e.type, e.x, e.y, e.z, e.data); if (m) { m.health = e.hp || m.health; m.yaw = m.bodyYaw = m.headYaw = e.yaw || 0; if (e.type === 'villager') m.home = [e.x, e.y, e.z]; } }
  spawnXP(w, x, y, z, v) { while (v > 0) { const s = v >= 17 ? 17 : v >= 7 ? 7 : v >= 3 ? 3 : 1; v -= s; w.addEntity(new XPOrb(x, y, z, s)); } }
  primeTNT(x, y, z, fuse) { this.world.addEntity(new PrimedTNT(x, y, z, fuse)); this.audio.play('fuse', { x, y, z }); }
  spawnFallingBlock(x, y, z, v) { this.world.addEntity(new FallingBlock(x, y, z, v)); }
  fx(kind, x, y, z, power) {
    const P = this.particles;
    if (kind === 'explosion') {
      this.audio.play('explosion', { x, y, z, range: 48 });
      for (let i = 0; i < 26 * (power || 4) / 4; i++) P.spawn('p_explosion', x + (Math.random() - 0.5) * power * 1.5, y + (Math.random() - 0.5) * power, z + (Math.random() - 0.5) * power * 1.5, { vx: (Math.random() - 0.5) * 0.1, vy: Math.random() * 0.06, vz: (Math.random() - 0.5) * 0.1, life: 12 + Math.random() * 10, size: 0.9 + Math.random() * 1.2, color: [0.95, 0.9, 0.85], shrink: true });
      for (let i = 0; i < 20; i++) P.spawn('p_smoke', x + (Math.random() - 0.5) * power, y + Math.random() * power * 0.5, z + (Math.random() - 0.5) * power, { vy: 0.05 + Math.random() * 0.05, life: 40, size: 0.6 + Math.random() * 0.6, color: [0.35, 0.35, 0.35] });
      const p = this.player; if (p) { const d = Math.hypot(p.x - x, p.y - y, p.z - z); if (d < 32) this.shake = Math.max(this.shake || 0, (1 - d / 32) * 0.8); }
      if (this.munitions) this.munitions.blast(x, y, z, (power || 4) / 3);
    } else if (kind === 'smallboom') { this.audio.play('smallboom', { x, y, z }); P.burst(x, y, z, 'p_explosion', 6, [1, 0.8, 0.5]); }
    else if (kind === 'fizz') { this.audio.play('fizz', { x, y, z }); for (let i = 0; i < 8; i++) P.spawn('p_smoke', x + (Math.random() - 0.5), y + Math.random() * 0.5, z + (Math.random() - 0.5), { vy: 0.05, life: 20, size: 0.3, color: [0.8, 0.8, 0.8] }); }
  }
  // ---------------------------------------------------------------- portals
  registerPortal(dim, x, y, z, ax) {
    if (!this.meta) return;
    const list = this.meta.portals[dim] || (this.meta.portals[dim] = []);
    if (!list.some(q => Math.abs(q[0] - x) < 4 && Math.abs(q[1] - y) < 4 && Math.abs(q[2] - z) < 4)) list.push([x, y, z, ax]);
  }
  async travelPortal() {
    if (this.player.vehicle) this.player.vehicle.dismount(true);
    const p = this.player, from = this.world.dim, to = from === 'overworld' ? 'nether' : 'overworld';
    const k = to === 'nether' ? 1 / 8 : 8;
    const tx = Math.floor(p.x * k), tz = Math.floor(p.z * k);
    this.audio.play('portal_travel', {});
    this.ui.closeScreen(true);
    await this.saveAll();
    await this.enterDimension(to, tx + 0.5, tz + 0.5, to === 'nether' ? 'Entering the Nether' : 'Returning to the Overworld');
    p.x = tx + 0.5; p.z = tz + 0.5; p.y = 70; p.vx = p.vy = p.vz = 0; p.savePrev();
    this.loadingDone = () => this.placeAtPortal(to, tx, tz);
  }
  placeAtPortal(dim, tx, tz) {
    const w = this.world, p = this.player;
    const range = dim === 'nether' ? 16 : 128;
    const list = (this.meta.portals[dim] || []).filter(q => Math.abs(q[0] - tx) <= range && Math.abs(q[2] - tz) <= range);
    list.sort((a, b) => ((a[0] - tx) ** 2 + (a[2] - tz) ** 2) - ((b[0] - tx) ** 2 + (b[2] - tz) ** 2));
    for (const q of list) {
      if (!w.isLoaded(q[0], q[2])) continue;
      if (w.getId(q[0], q[1], q[2]) === B.nether_portal) { this.putPlayer(q[0] + 0.5, q[1], q[2] + 0.5); return; }
    }
    // search for any portal block nearby (loaded area)
    for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) for (let y = 4; y < 124; y++) {
      if (w.getId(tx + dx, y, tz + dz) === B.nether_portal) { let yy = y; while (w.getId(tx + dx, yy - 1, tz + dz) === B.nether_portal) yy--; this.putPlayer(tx + dx + 0.5, yy, tz + dz + 0.5); this.registerPortal(dim, tx + dx, yy, tz + dz, 0); return; }
    }
    // build a new portal
    let best = null;
    const ymin = dim === 'nether' ? 32 : SEA, ymax = dim === 'nether' ? 110 : CH - 10;
    for (let r = 0; r <= 12 && !best; r++) for (let dx = -r; dx <= r && !best; dx++) for (let dz = -r; dz <= r && !best; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = tx + dx, z = tz + dz;
      for (let y = ymax; y >= ymin; y--) {
        let ok = true;
        for (let i = -1; i <= 2 && ok; i++) { if (!OPAQUE[w.getId(x + i, y - 1, z)] || w.getId(x + i, y - 1, z) === B.lava) ok = false; for (let j = 0; j < 4 && ok; j++) if (w.getId(x + i, y + j, z) !== 0 || w.getId(x + i, y + j, z + 1) !== 0 || w.getId(x + i, y + j, z - 1) !== 0) ok = false; }
        if (ok) { best = [x, y, z]; break; }
      }
    }
    let [x, y, z] = best || [tx, dim === 'nether' ? 64 : Math.max(SEA + 2, w.heightAt(tx, tz)), tz];
    if (!best) {
      for (let i = -2; i <= 3; i++) for (let k = -2; k <= 2; k++) { w.setBlock(x + i, y - 1, z + k, B.obsidian, 0); for (let j = 0; j < 4; j++) w.setBlock(x + i, y + j, z + k, 0, 0); }
    }
    for (let i = -1; i <= 2; i++) { w.setBlock(x + i, y - 1, z, B.obsidian, 0); w.setBlock(x + i, y + 3, z, B.obsidian, 0); }
    for (let j = 0; j < 3; j++) { w.setBlock(x - 1, y + j, z, B.obsidian, 0); w.setBlock(x + 2, y + j, z, B.obsidian, 0); }
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) w.setBlock(x + i, y + j, z, B.nether_portal, 0);
    this.registerPortal(dim, x, y, z, 0);
    this.putPlayer(x + 0.5, y, z + 0.5);
  }
  // ---------------------------------------------------------------- the End
  // stepping into an end portal: overworld -> the End (onto the obsidian platform), the End -> home
  async travelEnd() {
    const p = this.player, from = this.world.dim;
    if (p.vehicle) p.vehicle.dismount(true);
    p.gliding = false;
    this.audio.play('end_travel', {});
    this.ui.closeScreen(true);
    await this.saveAll();
    if (from !== 'end') {
      await this.enterDimension('end', 100.5, 0.5, 'Entering the End');
      p.x = 100.5; p.y = 60; p.z = 0.5; p.vx = p.vy = p.vz = 0; p.yaw = -Math.PI / 2; p.pitch = 0; p.savePrev();
      this.loadingDone = () => this.arriveInEnd();
      return;
    }
    const S = this.endFight.state, credits = S.killed && !S.credits;
    const sp = p.spawnPoint && p.spawnPoint.dim === 'overworld' ? [p.spawnPoint.x, p.spawnPoint.y, p.spawnPoint.z] : this.meta.spawn;
    await this.enterDimension('overworld', sp[0], sp[2], 'Returning to the Overworld');
    p.x = sp[0]; p.y = sp[1] + 0.5; p.z = sp[2]; p.vx = p.vy = p.vz = 0; p.savePrev();
    this.loadingDone = () => {
      const w = this.world;
      p.y = Math.max(p.y, w.heightAt(Math.floor(p.x), Math.floor(p.z)));
      while (p.y < CH - 2 && (SOLID[w.getId(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))] || SOLID[w.getId(Math.floor(p.x), Math.floor(p.y) + 1, Math.floor(p.z))])) p.y++;
      this.putPlayer(p.x, p.y, p.z);
      if (credits) { S.credits = true; this.ui.showCredits(() => this.saveAll()); }
    };
  }
  // a 5x5 obsidian platform off the main island with room to stand (rebuilt on every arrival)
  arriveInEnd() {
    const w = this.world, c = this.endFight.endGen().column(100, 0);
    const y = c ? Math.floor(c.top) : 48;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { w.setBlock(100 + dx, y, dz, B.obsidian, 1); for (let k = 1; k <= 3; k++) w.setBlock(100 + dx, y + k, dz, 0, 1); }
    this.putPlayer(100.5, y + 1, 0.5);
    this.ui.message('The End. Destroy the crystals, then slay the dragon.', '#d98aff');
  }
  // end gateways: the ones ringing the main island send you ~1000 blocks out to the outer islands (building a
  // return gateway there); the outer ones bring you back to their partner
  useGateway(x, y, z) {
    const p = this.player, S = this.endFight.state, F = this.endFight;
    if (p.vehicle) p.vehicle.dismount(true);
    p.gliding = false;
    const list = S.gw || (S.gw = []);
    let dest, build = null;
    if (Math.hypot(x, z) < 500) {
      let q = list.find(q => q[0] === x && q[1] === y && q[2] === z);
      if (!q) { q = [x, y, z]; list.push(q); }
      if (q[3] === undefined) { const o = F.outerLanding(x, z); q[3] = o[0]; q[4] = o[1]; q[5] = o[2]; }
      dest = [q[3] + 0.5, q[4], q[5] + 0.5]; build = q;
    } else {
      const q = list.find(q => q[3] !== undefined && Math.abs(q[3] + 3 - x) <= 1 && Math.abs(q[5] - z) <= 1);
      // arrive on the ground just inside the main island's gateway
      const gx = q ? q[0] : 0, gz = q ? q[2] : 0, l = Math.hypot(gx, gz) || 1, ax = Math.round(gx - gx / l * 6), az = Math.round(gz - gz / l * 6);
      dest = [ax + 0.5, 80, az + 0.5];
    }
    this.audio.play('gateway', {});
    this.state = 'loading'; this.loadTarget = [dest[0], dest[2]]; this.loadText = 'Travelling through the gateway'; this.loadStart = performance.now();
    this.ui.closeScreen(true); this.ui.showLoading(this.loadText + '…', 0);
    p.x = dest[0]; p.y = dest[1] + 1; p.z = dest[2]; p.vx = p.vy = p.vz = 0; p.savePrev(); p.portalCd = 100;
    this.loadingDone = () => {
      const w = this.world, bx = Math.floor(p.x), bz = Math.floor(p.z);
      // land on the island itself, not on top of a chorus tree, with a little room cleared around you
      const col = F.endGen().column(bx, bz);
      let gy = col ? Math.floor(col.top) + 1 : w.heightAt(bx, bz);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 4; dx++) for (let k = 0; k <= 3; k++) { const id = w.getId(bx + dx, gy + k, bz + dz); if (id === B.chorus_plant || id === B.chorus_flower) w.setBlock(bx + dx, gy + k, bz + dz, 0, 1); }
      if (gy <= 2) {
        // no island here: raise a small one
        gy = build ? build[4] : 64;
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dz * dz <= 10) for (let k = 1; k <= 3 - Math.floor(Math.hypot(dx, dz) / 1.4); k++) w.setBlock(bx + dx, gy - k, bz + dz, B.end_stone, 1);
      }
      if (build) { F.buildGateway(w, bx + 3, gy + 1, bz); build[4] = gy; }
      this.putPlayer(bx + 0.5, gy, bz + 0.5);
      p.portalCd = 60;
    };
  }
  // finish a surface /tp: hold the player still until the target column exists, then drop them onto a safe floor
  settleTeleport() {
    const T = this.tpSurface, w = this.world, p = this.player;
    if (w.dim !== T.dim || p.vehicle) { this.tpSurface = null; return; }
    const bx = Math.floor(T.x), bz = Math.floor(T.z);
    if (!w.isLoaded(bx, bz)) { p.vx = p.vy = p.vz = 0; p.fallDist = 0; if (--T.t <= 0) { this.tpSurface = null; this.ui.message('Teleport target never loaded', '#f88'); } return; }
    this.tpSurface = null;
    const nether = w.dim === 'nether', open = (id) => !SOLID[id] && id !== B.lava;
    for (let y = nether ? NETHER_TOP - 6 : Math.min(CH - 2, w.heightAt(bx, bz) + 1); y > 1; y--) {
      const b = w.getId(bx, y - 1, bz);
      if ((SOLID[b] || (!nether && b === B.water)) && open(w.getId(bx, y, bz)) && open(w.getId(bx, y + 1, bz))) { this.putPlayer(T.x, y, T.z); this.ui.message(`Teleported to ${Math.round(T.x)}, ${y}, ${Math.round(T.z)}`); return; }
    }
    this.ui.message('No safe ground there, stayed at height ' + Math.round(p.y), '#fd8');
  }
  putPlayer(x, y, z) { const p = this.player; p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.fallDist = 0; p.portalCd = 100; p.portalTime = 0; p.savePrev(); }
  screenshot() { this.wantShot = true; }
  // ---------------------------------------------------------------- rendering: entities
  drawEntities(R) {
    const gl = R.gl, a = this.alpha, w = this.world, p = this.player;
    const ent = R.progs.ent;
    gl.useProgram(ent.p); R.setEnvUniforms(ent);
    gl.uniformMatrix4fv(ent.u.uProj, false, R.vp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.skinTex); gl.uniform1i(ent.u.uSkin, 0);
    gl.uniform1f(ent.u.uAlphaMul, 1);
    const ED = SETTINGS.entityDist, t = R.time;
    const held = [];
    const Mm = this._Mm || (this._Mm = M4.create());
    const drawModel = (e, model, x, y, z, bodyYaw, scale, opts) => {
      const P = poseMob(e, a, t);
      const mats = partMatrices(model, P, e._mats || (e._mats = []));
      const mb = this.matBuf;
      for (let i = 0; i < mats.length; i++) mb.set(mats[i], i * 16);
      gl.uniformMatrix4fv(ent.u.uParts, false, mb.subarray(0, mats.length * 16));
      M4.identity(Mm); M4.translate(Mm, x - R.camX, y - R.camY, z - R.camZ);
      if (opts && opts.q) M4.mul(Mm, Mm, Q.toMat(opts.q, this._Mq || (this._Mq = M4.create()))); else M4.rotY(Mm, -bodyYaw);
      if (e.dead && e.deathTime !== undefined) M4.rotZ(Mm, Math.min(1, (e.deathTime + a) / 18) * Math.PI / 2);
      const sq = e.squish > 0 ? e.squish : 0;
      M4.scale(Mm, scale / 16 * (1 + sq * 0.25), scale / 16 * (1 - sq * 0.3), scale / 16 * (1 + sq * 0.25));
      gl.uniformMatrix4fv(ent.u.uModel, false, Mm);
      gl.uniform1f(ent.u.uLayer, model.layer);
      const lx = Math.floor(x), ly = Math.floor(y + (e.h || 1) * 0.7), lz = Math.floor(z);
      const l = w.getLight(lx, ly, lz);
      const burning = e.fireTicks > 0;
      gl.uniform2f(ent.u.uLightE, burning ? 1 : (l >> 4) / 15, burning ? 1 : Math.max(l & 15, EMIT[w.getId(lx, ly, lz)]) / 15);
      gl.uniform1f(ent.u.uHurt, (e.hurtTime > 0 || e.dead) ? 1 : 0);
      gl.uniform1f(ent.u.uFlash, opts && opts.flash || 0);
      gl.bindVertexArray(model.vao);
      for (let gi = 0; gi < model.groupRanges.length; gi++) {
        const rng = model.groupRanges[gi]; if (!rng) continue;
        let tint = 0xFFFFFF;
        if (gi === 1) {
          if (e.type === 'sheep') { if (e.data.sheared) continue; tint = DYE_RGB[e.data.color || 0]; }
          else if (e.type === 'villager') tint = PROF_COLORS[e.data.prof] || 0x8E6A4A;
        }
        gl.uniform3f(ent.u.uTintE, ((tint >> 16) & 255) / 255, ((tint >> 8) & 255) / 255, (tint & 255) / 255);
        gl.drawArrays(gl.TRIANGLES, rng[0], rng[1]);
      }
      return mats;
    };
    for (const e of w.entities) {
      if (e.removed) continue;
      const isP = e === p;
      if (isP && (p.vehicle ? (!p.vehicle.def.seat || p.vcam === 1) : p.camMode === 0)) continue;
      if (!e.isMob && !isP) continue;
      let x = e.ix(a), y = e.iy(a), z = e.iz(a);
      if (isP && p.vehicle) { const V = p.vehicle, st = V.def.seat, o = V.local(st[0], st[1] - 0.72, st[2], this._ro || (this._ro = [0, 0, 0])); x = o[0]; y = o[1]; z = o[2]; e.headYaw = p.yaw; }
      const dx = x - R.camX, dz = z - R.camZ;
      if (dx * dx + dz * dz > ED * ED) continue;
      const hw = (e.w || 1) / 2 + 0.5;
      if (!R.boxVisible(dx - hw, y - R.camY - 0.5, dz - hw, dx + hw, y - R.camY + (e.h || 2) + 0.5, dz + hw)) continue;
      const model = MODELS[isP ? 'player' : e.def.model];
      let scale = isP ? 1 : (e.def.scale || 1) * (e.data.baby ? 0.5 : 1) * (e.size ? e.size * 0.5 : 1);
      let flash = 0;
      if (e.type === 'boomcap' && e.fuse > 0) { const f = e.fuse / 30; scale *= 1 + f * 0.15 + Math.sin(e.fuse * 1.3) * 0.03; flash = Math.floor(e.fuse / 3) % 2 ? 0.55 : 0; }
      if (e.type === 'tnt') continue;
      if (isP && !p.vehicle) { e.bodyYaw = e.bodyYaw === undefined ? e.yaw : e.bodyYaw + angleDiff(e.bodyYaw, e.yaw) * (Math.hypot(e.vx, e.vz) > 0.02 ? 0.3 : 0.08); e.headYaw = e.yaw; if (Math.abs(angleDiff(e.bodyYaw, e.yaw)) > 0.8) e.bodyYaw = e.yaw - Math.sign(angleDiff(e.bodyYaw, e.yaw)) * 0.8; }
      const by = (e.lyaw !== undefined && !isP) ? e.bodyYaw : e.bodyYaw;
      const mats = drawModel(e, model, x, y, z, by, scale, { flash, q: isP && p.vehicle ? p.vehicle.q : null });
      const hid = isP ? (p.vehicle ? 0 : e.heldId()) : (e.heldItem ? e.heldItem() : 0);
      if (hid && model.pi.rarm !== undefined) held.push([e, hid, mats[model.pi.rarm], x, y, z, by, scale]);
    }
    // spawner mini-mobs
    for (const be of w.activeBE) {
      if (be.t !== 'spawner' || !MOB_DEFS[be.mob]) continue;
      const dx = be.x + 0.5 - R.camX, dz = be.z + 0.5 - R.camZ; if (dx * dx + dz * dz > 400) continue;
      const fake = this._spawnFake || (this._spawnFake = { walkPhase: 0, walkAmt: 0, pitch: 0, data: {} });
      fake.def = MOB_DEFS[be.mob]; fake.type = be.mob; fake.bodyYaw = fake.headYaw = t * 2; fake.yaw = fake.bodyYaw; fake._pose = null; fake._mats = null; fake.h = 1;
      const md = MODELS[fake.def.model];
      drawModel(fake, md, be.x + 0.5, be.y + 0.2, be.z + 0.5, t * 2, 0.35 / Math.max(0.6, fake.def.h * 0.5), {});
    }
    // item program: dropped items, projectiles, held items, falling blocks, tnt
    const ip = R.progs.item;
    gl.useProgram(ip.p); R.setEnvUniforms(ip);
    gl.uniformMatrix4fv(ip.u.uProj, false, R.vp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.blockTex); gl.uniform1i(ip.u.uTexB, 0); gl.bindSampler(0, R.sampNearest);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.itemTex); gl.uniform1i(ip.u.uTexI, 1);
    gl.uniform1f(ip.u.uNoFog, 0);
    const drawItem = (id, M, lx, ly, lz, flash) => {
      const m = itemMesh(gl, R, id); if (!m) return;
      gl.uniformMatrix4fv(ip.u.uModel, false, M);
      gl.uniform1f(ip.u.uSrc, m.src);
      const l = w.getLight(Math.floor(lx), Math.floor(ly), Math.floor(lz));
      gl.uniform2f(ip.u.uLightE, (l >> 4) / 15, (l & 15) / 15);
      gl.uniform1f(ip.u.uFlashI, flash || 0);
      gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.count);
    };
    gl.disable(gl.CULL_FACE);
    const M = this._Mi || (this._Mi = M4.create());
    for (const e of w.entities) {
      if (e.removed || e.isMob || e.isPlayer) continue;
      const x = e.ix(a), y = e.iy(a), z = e.iz(a);
      const dx = x - R.camX, dz = z - R.camZ;
      if (dx * dx + dz * dz > ED * ED) continue;
      if (!R.boxVisible(dx - 1, y - R.camY - 1, dz - 1, dx + 1, y - R.camY + 1.5, dz + 1)) continue;
      M4.identity(M); M4.translate(M, dx, y - R.camY, dz);
      if (e.type === 'item') {
        const d = ITEMS[e.stack.id]; if (!d) continue;
        const cube = d.block !== undefined && !d.flat;
        const bob = Math.sin((e.age + a) / 10 + e.bob) * 0.1 + 0.15;
        const copies = e.stack.n > 32 ? 3 : e.stack.n > 1 ? 2 : 1;
        for (let c = 0; c < copies; c++) {
          M4.identity(M); M4.translate(M, dx + (c ? (hashF2(e.id, c, 1) - 0.5) * 0.15 : 0), y - R.camY + bob + 0.1 + c * 0.04, dz + (c ? (hashF2(e.id, c, 2) - 0.5) * 0.15 : 0));
          M4.rotY(M, (e.age + a) / 20 + e.bob);
          const s = cube ? 0.25 : 0.4; M4.scale(M, s, s, s);
          drawItem(e.stack.id, M, x, y + 0.2, z, 0);
        }
      } else if (e.type === 'arrow') {
        M4.rotY(M, -e.yaw); M4.rotX(M, e.pitch); M4.rotY(M, -Math.PI / 2); M4.rotZ(M, -Math.PI / 4); M4.scale(M, 0.6, 0.6, 0.6);
        drawItem(I.arrow, M, x, y, z, 0);
      } else if (e.type === 'snowball' || e.type === 'egg' || e.type === 'hex' || e.type === 'fireball' || e.type === 'ender_pearl' || e.type === 'eye_of_ender' || (e.type === 'firework' && !e.rider)) {
        const v = R.view; const Rm = M4.create(); Rm[0] = v[0]; Rm[1] = v[4]; Rm[2] = v[8]; Rm[4] = v[1]; Rm[5] = v[5]; Rm[6] = v[9]; Rm[8] = v[2]; Rm[9] = v[6]; Rm[10] = v[10];
        M4.mul(M, M, Rm); const s = e.type === 'fireball' ? 0.7 : 0.35; M4.scale(M, s, s, s);
        drawItem(e.type === 'hex' ? I.purple_dye : e.type === 'fireball' ? I.fire_charge : e.type === 'firework' ? I.firework_rocket : I[e.type], M, x, y, z, e.type === 'fireball' || e.type === 'eye_of_ender' ? 0.8 : 0);
      } else if (e.type === 'falling' || e.type === 'tnt') {
        M4.translate(M, 0, 0.49, 0); M4.scale(M, 0.98, 0.98, 0.98);
        const flash = e.type === 'tnt' && Math.floor(e.fuse / 5) % 2 === 0 ? 0.6 : 0;
        if (e.type === 'tnt') { const s = 1 + Math.max(0, (10 - e.fuse) / 10) * 0.15; M4.scale(M, s, s, s); }
        drawItem(e.type === 'tnt' ? B.tnt : (e.v & 4095), M, x, y + 0.5, z, flash);
      }
    }
    // held items for mobs / 3rd-person player
    for (const [e, hid, armM, x, y, z, by, scale] of held) {
      M4.identity(M); M4.translate(M, x - R.camX, y - R.camY, z - R.camZ); M4.rotY(M, -by); M4.scale(M, scale / 16, scale / 16, scale / 16);
      M4.mul(M, M, armM);
      M4.translate(M, 0, -10, -1.5);
      const d = ITEMS[hid];
      if (d && d.block !== undefined && !d.flat) { M4.scale(M, 6, 6, 6); }
      else { M4.rotX(M, -Math.PI / 2 + 0.3); M4.rotY(M, Math.PI / 2); M4.rotZ(M, d && d.name === 'bow' ? Math.PI * 0.25 : Math.PI * 0.25); M4.scale(M, 11, 11, 11); M4.translate(M, 0.25, 0.25, 0); }
      drawItem(hid, M, x, y + 1, z, 0);
    }
    gl.bindSampler(0, null);
    this.drawVehicles(R);
    drawEndEntities(this, R);
    this.drawFishingLines(R);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }
  // fishing line: a sagging curve from the rod tip to the bobber
  drawFishingLines(R) {
    const w = this.world, a = this.alpha, p = this.player;
    const verts = this._fl || (this._fl = []); verts.length = 0;
    for (const e of w.entities) {
      if (e.type !== 'bobber' || e.removed || !e.owner) continue;
      const o = e.owner;
      let tx, ty, tz;
      if (o === p && p.camMode === 0) {
        const v = R.view, c = this.camera;
        tx = c.x - v[2] * 0.95 + v[0] * 0.38 + v[1] * 0.12; ty = c.y - v[6] * 0.95 + v[4] * 0.38 + v[5] * 0.12; tz = c.z - v[10] * 0.95 + v[8] * 0.38 + v[9] * 0.12;
      } else {
        const yaw = o.yaw || 0;
        tx = o.ix(a) + Math.cos(yaw) * 0.4 + Math.sin(yaw) * 0.9; ty = o.iy(a) + 2.1; tz = o.iz(a) + Math.sin(yaw) * 0.4 - Math.cos(yaw) * 0.9;
      }
      const bx = e.ix(a), by = e.iy(a) + 0.12, bz = e.iz(a);
      const len = Math.hypot(bx - tx, by - ty, bz - tz), sag = Math.min(1.5, len * 0.07) * (e.bite > 0 ? 0.2 : 1);
      let px = tx - R.camX, py = ty - R.camY, pz = tz - R.camZ;
      for (let i = 1; i <= 16; i++) {
        const s = i / 16, x = tx + (bx - tx) * s - R.camX, y = ty + (by - ty) * s - Math.sin(s * Math.PI) * sag - R.camY, z = tz + (bz - tz) * s - R.camZ;
        verts.push(px, py, pz, x, y, z); px = x; py = y; pz = z;
      }
    }
    if (verts.length) R.drawLines(verts, 0.08, 0.08, 0.08, 0.85);
  }
  drawVehicles(R) {
    const gl = R.gl, w = this.world, pr = R.progs.vox, u = pr.u;
    const base = this._Vb || (this._Vb = M4.create()), M = this._Vm || (this._Vm = M4.create()), rot = this._Vr || (this._Vr = M4.create()), c3 = this._Vc || (this._Vc = [0, 0, 0]);
    const pv = this.player && this.player.vehicle;
    let started = false;
    for (const v of w.entities) {
      if (!v.isVehicle || v.removed) continue;
      const c = v.center(c3), dx = c[0] - R.camX, dy = c[1] - R.camY, dz = c[2] - R.camZ, rad = v.def.radius + 1.5;
      if (dx * dx + dz * dz > 260 * 260) continue;
      if (!R.boxVisible(dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad)) continue;
      if (!started) {
        started = true;
        gl.useProgram(pr.p); R.setEnvUniforms(pr);
        gl.uniformMatrix4fv(u.uProj, false, R.vp);
        if (R.shadow && u.uShadowMap) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.shadow.tex); gl.uniform1i(u.uShadowMap, 1); }
        gl.uniform1f(u.uPulse, R.time); gl.uniform1f(u.uAlphaV, 1);
        gl.enable(gl.CULL_FACE);
      }
      M4.identity(base); M4.translate(base, dx, dy, dz); M4.mul(base, base, Q.toMat(v.q, rot));
      const l0 = w.getLight(Math.floor(c[0]), Math.floor(c[1] + 1.2), Math.floor(c[2])), l1 = w.getLight(Math.floor(c[0]), Math.floor(c[1] + 2.5), Math.floor(c[2]));
      gl.uniform2f(u.uLightE, Math.max(l0 >> 4, l1 >> 4) / 15, Math.max(l0 & 15, l1 & 15) / 15);
      gl.uniform1f(u.uGlow, v.engine + (v.boosting ? 0.8 : 0)); gl.uniform1f(u.uHurtV, v.hurtT > 0 ? 1 : 0);
      const model = VOX_MODELS[v.def.model], parts = v.parts();
      // from the pilot's own cockpit camera the hull is swapped for its interior version
      const inside = v === pv && this.player.vcam === 1;
      for (const k in model.parts) {
        const part = model.parts[k], spec = parts ? parts[k] : undefined;
        if (spec === null) continue;
        if (part.view && (part.view === 'int') !== inside) continue;
        v.partMatrix(M, base, part, spec);
        gl.uniformMatrix4fv(u.uModel, false, M);
        gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.count);
      }
    }
  }
  drawFX(R) {
    R.fxBegin();
    this.munitions.drawFX(R);
    const p = this.player;
    for (const e of this.world.entities) if (e.isVehicle && !e.removed && (e === (p && p.vehicle) || e.dist2(this.camera.x, this.camera.y, this.camera.z) < 200 * 200)) e.drawFX(R);
    if (this.world.dim === 'end') drawEndFX(this, R);
    const a = this.alpha;
    for (const e of this.world.entities) {
      if (e.removed) continue;
      if (e.type === 'dragon_fireball') { R.fxSprite(e.ix(a), e.iy(a), e.iz(a), 0.95, 0.85, 0.3, 1.0, 1.3); R.fxSprite(e.ix(a), e.iy(a), e.iz(a), 0.4, 1, 0.8, 1, 1.2); }
      else if (e.type === 'eye_of_ender') R.fxSprite(e.ix(a), e.iy(a), e.iz(a), 0.45, 0.45, 1.0, 0.7, 0.5);
      else if (e.type === 'firework') R.fxSprite(e.ix(a), e.iy(a) - 0.2, e.iz(a), 0.3, 1.0, 0.75, 0.4, 1.0);
    }
    R.fxFlush();
  }
  collectLights(R) {
    if (this.state === 'menu' || !this.world) return;
    this.munitions.addLights(R);
    const p = this.player;
    for (const e of this.world.entities) {
      if (e.removed) continue;
      if (e.isVehicle) { if (e.dist2(this.camera.x, this.camera.y, this.camera.z) < 150 * 150) e.lights(R); }
      else if (e.isCrystal) R.addLight(e.x, e.y + 1.2, e.z, 10, 1.0, 0.45, 0.9, 1.3);
      else if (e.type === 'dragon_fireball') R.addLight(e.x, e.y, e.z, 8, 0.8, 0.3, 1.0, 1.4);
      else if (e.type === 'breath_cloud') R.addLight(e.x, e.y + 0.6, e.z, e.r + 3, 0.75, 0.25, 0.9, 0.9);
      else if (e.type === 'eye_of_ender') R.addLight(e.x, e.y, e.z, 4, 0.4, 1.0, 0.6, 0.8);
    }
    // dynamic hand light from held light sources
    if (p && !p.vehicle && !p.dead) {
      const id = p.heldId(), lv = id && id < 1000 ? EMIT[id] : (id === I.lava_bucket ? 15 : 0);
      if (lv > 6) { const c = this.camera, d = p.lookVec(); R.addLight(c.x + d[0] * 0.6, c.y - 0.3, c.z + d[2] * 0.6, lv * 0.85, 1.0, 0.76, 0.46, 0.95 + Math.sin(R.time * 9) * 0.05); }
    }
  }
  drawParticles(R) {
    const a = this.alpha;
    const extra = [];
    for (const e of this.world.entities) {
      if (e.removed) continue;
      if (e.type === 'bobber') { extra.push({ x: e.ix(a), y: e.iy(a) + 0.12, z: e.iz(a), vx: 0, vy: 0, vz: 0, size: 0.16, uv: [0, 0, 1, 1], color: [1, 1, 1], alpha: 1, layer: ITEM_TEXI.p_bobber, src: 1, age: 0, life: 1e9, fade: false }); continue; }
      if (e.type !== 'xp') continue;
      const pulse = 0.6 + 0.4 * Math.sin((e.age + a) * 0.3);
      extra.push({ x: e.ix(a), y: e.iy(a) + 0.15, z: e.iz(a), vx: 0, vy: 0, vz: 0, size: 0.18 + Math.min(0.2, e.value * 0.01), uv: [0, 0, 1, 1], color: [0.7 + 0.3 * pulse, 1, 0.4], alpha: 1, layer: ITEM_TEXI.p_xp, src: 1, age: 0, life: 1e9, fade: false, emissive: true });
    }
    this.particles.draw(R, extra);
  }
  drawHand(R) {
    const p = this.player; if (!p || p.vehicle || p.camMode !== 0 || p.spectator || SETTINGS.hudHidden || p.dead || p.sleeping) return;
    const gl = R.gl, a = this.alpha, w = this.world;
    const held = p.heldStack(), d = held ? ITEMS[held.id] : null;
    this.equipT = Math.min(1, (this.equipT === undefined ? 1 : this.equipT) + 0.12);
    const sw = p.swingAnim > 0 ? 1 - p.swingAnim : 0;
    const s1 = Math.sin(sw * Math.PI), s2 = Math.sin(Math.sqrt(sw) * Math.PI);
    const bob = p.lbob + (p.bob - p.lbob) * a, amt = SETTINGS.viewBob ? p.lbobAmt + (p.bobAmt - p.lbobAmt) * a : 0;
    const bx = Math.sin(bob * Math.PI) * amt * 0.03, by = -Math.abs(Math.cos(bob * Math.PI)) * amt * 0.04;
    const eq = (1 - this.equipT) * 0.5;
    const l = w.getLight(Math.floor(p.x), Math.floor(p.eyeY()), Math.floor(p.z));
    const M = M4.create();
    if (held && d) {
      const ip = R.progs.item;
      gl.useProgram(ip.p); R.setEnvUniforms(ip);
      gl.uniformMatrix4fv(ip.u.uProj, false, R.projHand);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.blockTex); gl.uniform1i(ip.u.uTexB, 0); gl.bindSampler(0, R.sampNearest);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.itemTex); gl.uniform1i(ip.u.uTexI, 1);
      gl.uniform2f(ip.u.uLightE, (l >> 4) / 15, (l & 15) / 15); gl.uniform1f(ip.u.uNoFog, 1); gl.uniform1f(ip.u.uFlashI, 0);
      const m = itemMesh(gl, R, held.id); if (!m) { gl.bindSampler(0, null); return; }
      const cube = d.block !== undefined && !d.flat;
      let ex = 0, ey = 0;
      if (p.using === 'food') { const tt = p.useTicks + a; ey = Math.abs(Math.sin(tt * 0.8)) * 0.05 - 0.05; ex = -0.28; }
      M4.translate(M, 0.56 + bx - s2 * 0.25 + ex, -0.52 + by - eq + s2 * 0.15 + ey, -0.75 - s1 * 0.1);
      if (p.using === 'food') { M4.rotY(M, 0.6); M4.rotX(M, 0.3); }
      M4.rotY(M, -s1 * 0.4); M4.rotZ(M, s2 * -0.3); M4.rotX(M, -s2 * 1.0);
      if (cube) { M4.rotY(M, Math.PI / 4); M4.scale(M, 0.4, 0.4, 0.4); }
      else if (d.name === 'bow') {
        const ch = p.using === 'bow' ? Math.min(1, (p.useTicks + a) / 20) : 0;
        M4.translate(M, -0.25 * ch, 0.05, 0.1 * ch); M4.rotY(M, -0.3 - ch * 0.5); M4.rotZ(M, -0.3 + ch * 0.2); M4.scale(M, 0.75, 0.75, 0.75);
      }
      else { M4.rotY(M, -Math.PI / 2 + 0.15); M4.rotZ(M, Math.PI / 4 - 0.35); M4.translate(M, 0, 0.18, 0); M4.scale(M, 0.72, 0.72, 0.72); }
      gl.uniformMatrix4fv(ip.u.uModel, false, M);
      gl.uniform1f(ip.u.uSrc, m.src);
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.count);
      gl.enable(gl.CULL_FACE);
      gl.bindSampler(0, null);
    } else {
      const ent = R.progs.ent, model = MODELS.player;
      gl.useProgram(ent.p); R.setEnvUniforms(ent);
      gl.uniformMatrix4fv(ent.u.uProj, false, R.projHand);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.skinTex); gl.uniform1i(ent.u.uSkin, 0);
      const mb = this.matBuf; for (let i = 0; i < model.parts.length; i++) mb.set(M4.create(), i * 16);
      gl.uniformMatrix4fv(ent.u.uParts, false, mb.subarray(0, model.parts.length * 16));
      M4.translate(M, 0.58 + bx - s2 * 0.3, -0.62 + by - eq + s2 * 0.2, -0.55 - s1 * 0.2);
      M4.rotY(M, -0.35 - s1 * 0.4); M4.rotX(M, 1.35 - s2 * 0.8); M4.rotZ(M, 0.1);
      M4.scale(M, 1 / 16, 1 / 16, 1 / 16);
      gl.uniformMatrix4fv(ent.u.uModel, false, M);
      gl.uniform1f(ent.u.uLayer, model.layer); gl.uniform2f(ent.u.uLightE, (l >> 4) / 15, (l & 15) / 15);
      gl.uniform1f(ent.u.uHurt, 0); gl.uniform1f(ent.u.uFlash, 0); gl.uniform3f(ent.u.uTintE, 1, 1, 1); gl.uniform1f(ent.u.uAlphaMul, 1);
      const bi = model.boxes.findIndex(b => b.part === model.pi.rarm);
      const rng = model.boxRanges[bi];
      gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(model.vao); gl.drawArrays(gl.TRIANGLES, rng[0], rng[1]);
      gl.enable(gl.CULL_FACE);
    }
    gl.bindVertexArray(null);
  }
  drawPreview(cv) {
    if (cv._drawn) return; cv._drawn = true;
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    const m = MODELS.player, skin = SKIN_CANVASES[m.layer];
    g.clearRect(0, 0, cv.width, cv.height);
    const k = Math.min(cv.width / 20, (cv.height - 8) / 33), ox = cv.width / 2, oy = cv.height - 4;
    for (const b of m.boxes) {
      if (b.inflate) continue;
      let tx = 0, ty = 0;
      for (let pi = b.part; pi >= 0; pi = m.parts[pi].parent) { tx += m.parts[pi].pivot[0]; ty += m.parts[pi].pivot[1]; }
      const x0 = tx + b.from[0], x1 = x0 + b.size[0], y0 = ty + b.from[1], y1 = y0 + b.size[1];
      const r = b.rects[5];
      g.drawImage(skin, r.x, r.y, r.w, r.h, ox - x1 * k, oy - y1 * k, (x1 - x0) * k, (y1 - y0) * k);
    }
  }
  // ---------------------------------------------------------------- commands
  runCommand(cmd) {
    const ui = this.ui, p = this.player, w = this.world;
    if (!this.meta || !this.meta.cheats) { ui.message('Commands are disabled in this world', '#f88'); return; }
    const a = cmd.slice(1).trim().split(/\s+/), c = a[0];
    const num = (s, base) => s && s.startsWith('~') ? base + (s.length > 1 ? +s.slice(1) : 0) : +s;
    try {
      switch (c) {
        case 'help': ui.message('Commands: gamemode, time, weather, tp (x y z, or x z for surface), give, summon, vehicle, locate, dimension, seed, kill, difficulty, spawnpoint, gamerule, clear, xp, heal, feed'); break;
        case 'vehicle': case 'v': { const k = { jet: 'jet', stormcrow: 'jet', gunship: 'gunship', vtol: 'gunship', mantis: 'gunship', bike: 'bike', viper: 'bike', hoverbike: 'bike', bomber: 'bomber', wraith: 'bomber', tank: 'tank', bastion: 'tank', mech: 'mech', titan: 'mech', walker: 'mech', sub: 'sub', submarine: 'sub', nautilus: 'sub', drill: 'drill', mole: 'drill', borer: 'drill' }[a[1]]; if (!k) throw 'Usage: /vehicle jet | bomber | gunship | bike | tank | mech | sub | drill'; const d = p.lookVec(), hl = Math.hypot(d[0], d[2]) || 1; const dist = k === 'bike' ? 4 : k === 'drill' ? 7 : 10, x = p.x + d[0] / hl * dist, z = p.z + d[2] / hl * dist; const y = Math.max(w.heightAt(Math.floor(x), Math.floor(z)), Math.floor(p.y)); spawnVehicle(w, k, x, y + 0.05, z, p.yaw); ui.message('Deployed ' + VEH_DEFS[k].name + '. Walk up and press F to board.', '#afa'); break; }
        case 'gamemode': case 'gm': { const m = { survival: 'survival', s: 'survival', 0: 'survival', creative: 'creative', c: 'creative', 1: 'creative', spectator: 'spectator', sp: 'spectator', 3: 'spectator' }[a[1]]; if (!m) throw 'Unknown mode'; p.mode = m; p.flying = m === 'spectator' ? true : (m === 'creative' ? p.flying : false); ui.message('Game mode set to ' + titleCase(m)); break; }
        case 'time': { if (a[1] === 'set') { const v = { day: 1000, noon: 6000, night: 13000, midnight: 18000, sunrise: 23000, sunset: 12000 }[a[2]]; const t = v !== undefined ? v : +a[2]; this.time = Math.floor(this.time / 24000) * 24000 + t; ui.message('Set the time to ' + t); } else if (a[1] === 'add') { this.time += +a[2]; } else ui.message('Day ' + Math.floor(this.time / 24000) + ', time ' + Math.floor(this.time % 24000)); break; }
        case 'weather': { const t = a[1]; if (t !== 'clear' && t !== 'rain' && t !== 'thunder') throw 'Usage: /weather clear | rain | thunder'; const W = this.weather; W.rain = t !== 'clear'; W.thunder = t === 'thunder'; W.timer = t === 'clear' ? randInt(12000, 30000) : randInt(6000, 12000); this.weatherSnap = true; ui.message('Weather set to ' + t); break; }
        case 'tp': {
          // /tp x z: land on the first safe floor once the destination chunk has loaded
          if (a.length === 3) { const x = num(a[1], p.x), z = num(a[2], p.z); if (isNaN(x) || isNaN(z)) throw 'Usage: /tp x y z  or  /tp x z'; this.putPlayer(x, p.y, z); this.tpSurface = { x, z, dim: w.dim, t: 1200 }; ui.message(`Teleporting to ${Math.round(x)}, ${Math.round(z)}...`); break; }
          const x = num(a[1], p.x), y = num(a[2], p.y), z = num(a[3], p.z); if ([x, y, z].some(isNaN)) throw 'Usage: /tp x y z  or  /tp x z'; this.tpSurface = null; this.putPlayer(x, y, z); ui.message(`Teleported to ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`); break; }
        case 'give': { let n = a[1]; if (n && n.startsWith('minecraft:')) n = n.slice(10); const id = I[n] !== undefined ? I[n] : I[n + '_item']; if (id === undefined) throw 'Unknown item ' + n; const cnt = +(a[2] || 1); let left = cnt; while (left > 0) { const k = Math.min(left, maxStack(id)); const l = p.inv.add({ id, n: k, d: 0 }); if (l) this.dropItem(w, p.x, p.y + 1, p.z, { id, n: l, d: 0 }); left -= k; } ui.message(`Gave ${cnt} × ${itemName(id)}`); break; }
        case 'summon': {
          const t = a[1];
          if (t === 'ender_dragon') { if (w.dim !== 'end') throw 'The Ender Dragon only lives in the End'; this.endFight.summon(); ui.message('The dragon rises', '#d98aff'); break; }
          if (t === 'end_crystal') { const d = p.lookVec(); w.addEntity(new EndCrystal(num(a[2], p.x + d[0] * 3), num(a[3], p.y), num(a[4], p.z + d[2] * 3))); ui.message('Summoned end_crystal'); break; }
          if (!MOB_DEFS[t]) throw 'Unknown mob. Try: ' + Object.keys(MOB_DEFS).concat(['ender_dragon', 'end_crystal']).join(', '); const d = p.lookVec(); this.spawnMob(t, num(a[2], p.x + d[0] * 3), num(a[3], p.y), num(a[4], p.z + d[2] * 3), null); ui.message('Summoned ' + t); break; }
        case 'locate': { const t = a[1]; if (!SDEF[t]) throw 'Structures: ' + Object.keys(SDEF).join(', '); ui.message('Searching…'); this.jobs.post({ t: 'locate', dim: w.dim, type: t, x: p.x, z: p.z }, null, (m) => { if (m.res) ui.message([`Nearest ${t} is at `, ui.tpLink(m.res.x, m.res.z), ` (${Math.round(Math.hypot(m.res.x - p.x, m.res.z - p.z))} blocks away)`], '#afa'); else ui.message('No ' + t + ' found nearby', '#f88'); }); break; }
        case 'dimension': case 'dim': {
          const d = { overworld: 'overworld', nether: 'nether', end: 'end', the_end: 'end' }[a[1]];
          if (!d) throw 'Usage: /dimension overworld | nether | end';
          if (d === w.dim) throw 'You are already there';
          if (d === 'end' || w.dim === 'end') { if (d === 'nether') throw 'Go home first: /dimension overworld'; this.travelEnd(); }
          else this.travelPortal();
          break;
        }
        case 'seed': ui.message('Seed: ' + this.meta.seed); break;
        case 'kill': p.hurt(1000, { type: 'void' }); break;
        case 'difficulty': { const d = { peaceful: 0, easy: 1, normal: 2, hard: 3 }[a[1]]; this.difficulty = d !== undefined ? d : clamp(+a[1], 0, 3); ui.message('Difficulty set to ' + ['Peaceful', 'Easy', 'Normal', 'Hard'][this.difficulty]); if (this.difficulty === 0) for (const e of w.entities) if (e.isMob && e.def.hostile) e.removed = true; break; }
        case 'spawnpoint': p.spawnPoint = { dim: 'overworld', x: p.x, y: p.y, z: p.z, bx: -1e9, by: 0, bz: 0 }; this.meta.spawn = [p.x, p.y, p.z]; ui.message('Spawn point set'); break;
        case 'gamerule': { if (!(a[1] in this.gameRules)) throw 'Rules: ' + Object.keys(this.gameRules).join(', '); this.gameRules[a[1]] = a[2] !== 'false'; ui.message(`${a[1]} = ${this.gameRules[a[1]]}`); break; }
        case 'clear': for (let i = 0; i < 41; i++) p.inv.set(i, null); ui.message('Cleared inventory'); break;
        case 'xp': p.addXP(+a[1] || 0); break;
        case 'heal': p.health = 20; break;
        case 'feed': p.food = 20; p.sat = 10; break;
        case 'biome': { const t = a[1] && a[1].toUpperCase(); if (BIO[t] === undefined) throw 'Biomes: ' + Object.keys(BIO).join(', ').toLowerCase(); this.jobs.post({ t: 'biome', biome: BIO[t], x: p.x, z: p.z }, null, (m) => ui.message(m.res ? [`Nearest ${a[1]} at `, ui.tpLink(m.res.x, m.res.z)] : 'Not found', m.res ? '#afa' : '#f88')); break; }
        default: throw 'Unknown command. Type /help';
      }
    } catch (e) { ui.message(String(e), '#f88'); }
  }
}
