// ============================================================================
//  Inventory + Player (movement, survival, interaction)
// ============================================================================
class Inventory {
  constructor(n) { this.slots = new Array(n).fill(null); this.version = 0; }
  get(i) { return this.slots[i]; }
  set(i, s) { this.slots[i] = s && s.n > 0 ? s : null; this.version++; }
  add(stack, range) {
    // returns leftover count
    let left = stack.n;
    const idx = range || [...Array(36).keys()];
    const ms = maxStack(stack.id);
    if (ms > 1) for (const i of idx) {
      const s = this.slots[i];
      if (s && s.id === stack.id && !s.d && !stack.d && s.n < ms) { const mv = Math.min(ms - s.n, left); s.n += mv; left -= mv; if (!left) break; }
    }
    if (left) for (const i of idx) {
      if (!this.slots[i]) { const mv = Math.min(ms, left); this.slots[i] = { id: stack.id, n: mv, d: stack.d || 0 }; left -= mv; if (!left) break; }
    }
    this.version++;
    return left;
  }
  count(match) { let c = 0; for (let i = 0; i < 36; i++) { const s = this.slots[i]; if (s && match(s.id)) c += s.n; } return c; }
  remove(match, n) {
    for (let i = 35; i >= 0 && n > 0; i--) { const s = this.slots[i]; if (s && match(s.id)) { const t = Math.min(n, s.n); s.n -= t; n -= t; if (s.n <= 0) this.slots[i] = null; } }
    this.version++;
    return n === 0;
  }
  serialize() { return this.slots.map(s => s ? [s.id, s.n, s.d || 0] : 0); }
  load(a) { this.slots = this.slots.map((_, i) => a[i] ? { id: a[i][0], n: a[i][1], d: a[i][2] } : null); this.version++; }
}
const FACE_TO_FACING = { 0: 1, 1: 3, 4: 2, 5: 0 };
function xpForLevel(l) { return l <= 15 ? 2 * l + 7 : l <= 30 ? 5 * l - 38 : 9 * l - 158; }
class Player extends Entity {
  constructor(game) {
    super('player', 0.5, 100, 0.5);
    this.isPlayer = true; this.w = 0.6; this.h = 1.8; this.eyeH = 1.62; this.stepH = 0.6; this.gravity = 0.08;
    this.game_ = game;
    this.inv = new Inventory(41); this.sel = 0;
    this.health = 20; this.maxHealth = 20; this.food = 20; this.sat = 5; this.exh = 0; this.air = 300; this.absorb = 0;
    this.xp = 0; this.xpLevel = 0;
    this.mode = 'survival'; this.flying = false;
    this.bob = 0; this.bobAmt = 0; this.lbob = 0; this.fovMul = 1;
    this.breakPos = null; this.breakProgress = 0; this.breakCd = 0; this.useCd = 0; this.useTicks = 0; this.using = null;
    this.swingAnim = 0; this.hurtTime = 0; this.hurtFx = 0; this.invul = 0; this.dead = false;
    this.regenT = 0; this.starveT = 0; this.drownT = 0; this.fireT = 0;
    this.sprinting = false; this.sneaking = false; this.jumpCd = 0;
    this.portalTime = 0; this.portalCd = 0; this.portalFx = 0;
    this.attackCharge = 1; this.attackT = 0;
    this.eyeBlock = 0; this.eyeSky = 15; this.biome = BIO.PLAINS;
    this.target = null; this.spawnPoint = null; this.sleeping = 0;
    this.camMode = 0; this.vehicle = null; this.vcam = 0; this.stats = { jumps: 0, blocks: 0, kills: 0 };
    this.effects = {};
  }
  get creative() { return this.mode === 'creative'; }
  get spectator() { return this.mode === 'spectator'; }
  heldStack() { return this.inv.get(this.sel); }
  heldId() { const s = this.inv.get(this.sel); return s ? s.id : 0; }
  consumeHeld(n) { if (this.creative) return; const s = this.heldStack(); if (!s) return; s.n -= n || 1; if (s.n <= 0) this.inv.set(this.sel, null); this.inv.version++; }
  replaceHeld(stack) {
    if (this.creative) { this.inv.add(stack); return; }
    const s = this.heldStack();
    if (s && s.n > 1) { s.n--; this.inv.version++; if (this.inv.add(stack)) this.game_.dropItem(this.world, this.x, this.y + 1, this.z, stack); }
    else this.inv.set(this.sel, stack);
  }
  damageHeld(n) {
    if (this.creative) return;
    const s = this.heldStack(); if (!s) return; const d = ITEMS[s.id]; if (!d.dur) return;
    s.d = (s.d || 0) + (n || 1);
    if (s.d >= d.dur) { this.inv.set(this.sel, null); this.game_.audio.play('break_tool', {}); this.game_.particles.burst(this.x, this.y + 1.4, this.z, 'p_crit', 6, [0.8, 0.8, 0.8]); }
    this.inv.version++;
  }
  armorPoints() { let a = 0; for (let i = 36; i < 40; i++) { const s = this.inv.get(i); if (s && ITEMS[s.id].armor) a += ITEMS[s.id].armor.def; } return a; }
  addXP(v) {
    this.xp += v / xpForLevel(this.xpLevel);
    while (this.xp >= 1) { this.xp = (this.xp - 1) * xpForLevel(this.xpLevel) / xpForLevel(this.xpLevel + 1); this.xpLevel++; if (this.xpLevel % 5 === 0) this.game_.audio.play('levelup', {}); }
  }
  addExhaustion(v) { if (this.creative || this.game_.difficulty === 0) return; this.exh += v; }
  facing() { return ((Math.round(this.yaw / (Math.PI / 2)) % 4) + 4) % 4; }
  lookVec() { const cp = Math.cos(this.pitch); return [Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }
  eyeY() { return this.y + (this.sneaking && !this.flying ? 1.27 : this.eyeH); }
  // ------------------------------------------------------------ damage
  hurt(amount, src) {
    const g = this.game_;
    const V = this.vehicle;
    if (V && src) {
      const t = src.type;
      if (t === 'explosion' && src.source && (src.source === V || src.source === this)) return false;
      if (V.def.enclosed && (t === 'mob' || t === 'arrow' || t === 'fireball' || t === 'thrown' || t === 'plasma' || t === 'laser')) return V.hurt(amount, src);
      if (V.def.enclosed && t === 'explosion') { V.hurt(amount * 0.5, src); return false; }
      if (t === 'fall' || t === 'suffocate' || t === 'drown') return false;
    }
    if (this.dead || (this.creative && !(src && src.type === 'void')) || this.spectator) return false;
    if (g.difficulty === 0 && src && (src.type === 'mob' || src.type === 'arrow')) amount = 0;
    if (this.invul > 10 && !(src && src.type === 'void')) { if (amount <= this.lastDmg) return false; const d = amount - this.lastDmg; this.lastDmg = amount; amount = d; }
    else { this.lastDmg = amount; this.invul = 20; }
    const t = src ? src.type : '';
    if (t === 'mob' || t === 'arrow' || t === 'explosion' || t === 'fireball' || t === 'thrown') {
      let def = 0, tough = 0;
      for (let i = 36; i < 40; i++) { const s = this.inv.get(i); if (s) { const a = ITEMS[s.id].armor; def += a.def; tough += a.tough; s.d = (s.d || 0) + Math.max(1, Math.floor(amount / 4)); if (s.d >= ITEMS[s.id].dur) { this.inv.set(i, null); g.audio.play('break_tool', {}); } } }
      amount = amount * (1 - Math.min(20, Math.max(def / 5, def - amount / (2 + tough / 4))) / 25);
      this.inv.version++;
    }
    if (amount <= 0) return true;
    if (this.sleeping) this.wake();
    if (this.absorb > 0) { const a = Math.min(this.absorb, amount); this.absorb -= a; amount -= a; }
    this.health -= amount;
    this.hurtTime = 10; this.hurtFx = 1; this.addExhaustion(0.1);
    const s = src && src.source;
    if (s && s !== this && s.x !== undefined) {
      const dx = this.x - s.x, dz = this.z - s.z, l = Math.hypot(dx, dz) || 1, kb = src.kb || 0.4;
      this.vx += dx / l * kb; this.vz += dz / l * kb; this.vy = Math.min(0.4, this.vy + 0.3);
      this.hurtDir = Math.atan2(dx, -dz) - this.yaw;
    }
    g.audio.play('hurt', {});
    if (this.health <= 0) this.die(src);
    return true;
  }
  die(src) {
    const g = this.game_;
    if (this.vehicle) this.vehicle.dismount(true);
    this.dead = true; this.health = 0;
    const cause = src ? src.type : 'unknown';
    const who = src && src.source && src.source.def ? 'a ' + titleCase(src.source.type) : null;
    const msgs = { fall: 'fell from a high place', lava: 'tried to swim in lava', fire: 'went up in flames', drown: 'drowned', starve: 'starved to death', void: 'fell out of the world', explosion: 'blew up', mob: 'were slain by ' + (who || 'a monster'), arrow: 'were shot by ' + (who || 'an arrow'), fireball: 'were fireballed by ' + (who || 'an Ember Imp'), cactus: 'were pricked to death', suffocate: 'suffocated in a wall', thrown: 'were hexed by a Witch', kill: 'died' };
    this.deathMsg = 'You ' + (msgs[cause] || 'died');
    if (!g.gameRules.keepInventory) {
      for (let i = 0; i < 41; i++) { const s = this.inv.get(i); if (s) { g.dropItem(this.world, this.x, this.y + 1, this.z, s, true); this.inv.set(i, null); } }
      const xp = Math.min(100, this.xpLevel * 7);
      if (xp) g.spawnXP(this.world, this.x, this.y + 1, this.z, xp);
      this.xpLevel = 0; this.xp = 0;
    }
    g.onPlayerDeath();
  }
  respawn() {
    this.dead = false; this.health = 20; this.food = 20; this.sat = 5; this.air = 300; this.fireTicks = 0; this.fallDist = 0; this.vx = this.vy = this.vz = 0; this.absorb = 0;
  }
  land(d) {
    const g = this.game_;
    if (this.flying || this.creative) return;
    const below = this.world.getId(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z));
    let dmg = Math.ceil(d - 3);
    if (below === B.hay_block) dmg = Math.ceil(dmg * 0.2);
    if (below === B.slime_block) dmg = 0;
    if (dmg > 0 && !this.inWater) { this.hurt(dmg, { type: 'fall' }); g.audio.play(dmg > 4 ? 'fall_big' : 'fall_small', {}); }
    if (d > 1.5) g.audio.play('step', { mat: BLOCKS[below].snd, vol: 0.5 });
  }
  voidDamage() { if ((this.age % 10) === 0) this.hurt(4, { type: 'void' }); }
  wake() { this.sleeping = 0; this.game_.ui.hideSleep(); }
  // ------------------------------------------------------------ movement
  tickMovement(inp) {
    const w = this.world, g = this.game_;
    let f = inp.f, s = inp.s;
    const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
    if (this.sleeping) { f = s = 0; }
    this.sneaking = inp.sneak && !this.flying;
    if (inp.sprint && f > 0.5 && !this.sneaking && (this.food > 6 || this.creative) && !this.using) this.sprinting = true;
    if (f <= 0.3 || this.collidedH && !this.flying || this.sneaking || (this.food <= 6 && !this.creative)) this.sprinting = false;
    let speed = 0.1 * (this.sprinting ? 1.3 : 1) * (this.sneaking ? 0.3 : 1);
    if (this.using && this.using !== 'block') speed *= 0.2;
    const feet = w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.05), Math.floor(this.z)), feetId = feet & 4095;
    const inWeb = feetId === B.cobweb || w.getId(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z)) === B.cobweb;
    const onSoul = w.getId(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z)) === B.soul_sand;
    this.updateFluids();
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const mx = s * cy + f * sy, mz = s * sy - f * cy; // strafe right = +x at yaw 0
    const accel = (a) => { this.vx += mx * a; this.vz += mz * a; };
    if (this.flying) {
      accel(this.sprinting ? 0.1 : 0.05);
      if (inp.jump) this.vy += 0.15 * 1.0; if (inp.sneak) this.vy -= 0.15;
      moveEntity(w, this, this.vx, this.vy, this.vz);
      this.vx *= 0.91; this.vz *= 0.91; this.vy *= 0.6;
      if (this.onGround && !this.spectator) this.flying = false;
      return;
    }
    const climb = CLIMB[feetId] || CLIMB[w.getId(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z))];
    if (this.inWater || this.inLava) {
      accel(this.sprinting && this.inWater ? 0.04 : 0.02);
      if (inp.jump) this.vy += 0.04;
      if (inp.sneak) this.vy -= 0.04;
      moveEntity(w, this, this.vx, this.vy, this.vz);
      const d = this.inWater ? 0.8 : 0.5;
      this.vx *= d; this.vy *= d; this.vz *= d; this.vy -= 0.02;
      if (this.collidedH && inp.jump) this.vy = 0.3;
      this.fallDist = 0;
      this.addExhaustion(0.01 * Math.hypot(this.x - this.lx, this.z - this.lz));
      return;
    }
    const slip = this.onGround ? (BLOCKS[w.getId(Math.floor(this.x), Math.floor(this.y - 0.5), Math.floor(this.z))].slip || 0.6) * 0.91 : 0.91;
    accel(this.onGround ? speed * (0.16277136 / (slip * slip * slip)) : (this.sprinting ? 0.026 : 0.02));
    if (inp.jump && this.onGround && this.jumpCd <= 0 && !this.sleeping) {
      this.vy = 0.42; this.jumpCd = 4;
      if (this.sprinting) { this.vx += Math.sin(this.yaw) * 0.2; this.vz -= Math.cos(this.yaw) * 0.2; this.addExhaustion(0.2); } else this.addExhaustion(0.05);
      this.stats.jumps++;
    }
    if (this.jumpCd > 0) this.jumpCd--;
    if (climb) {
      this.vx = clamp(this.vx, -0.15, 0.15); this.vz = clamp(this.vz, -0.15, 0.15);
      this.vy = Math.max(this.vy, -0.15); this.fallDist = 0;
      if (this.sneaking && this.vy < 0) this.vy = 0;
    }
    if (inWeb) { this.vx *= 0.25; this.vz *= 0.25; this.vy *= 0.05; this.fallDist = 0; }
    if (onSoul) { this.vx *= 0.55; this.vz *= 0.55; }
    // sneak edge protection
    let dx = this.vx, dz = this.vz;
    if (this.sneaking && this.onGround) {
      const hw = this.w / 2, st = 0.05;
      const ground = (ox, oz) => aabbIntersectsBlocks(w, this.x - hw + ox, this.y - 0.6, this.z - hw + oz, this.x + hw + ox, this.y - 0.01, this.z + hw + oz);
      while (dx !== 0 && !ground(dx, 0)) { if (Math.abs(dx) < st) dx = 0; else dx -= Math.sign(dx) * st; }
      while (dz !== 0 && !ground(0, dz)) { if (Math.abs(dz) < st) dz = 0; else dz -= Math.sign(dz) * st; }
      while (dx !== 0 && dz !== 0 && !ground(dx, dz)) { if (Math.abs(dx) < st) dx = 0; else dx -= Math.sign(dx) * st; if (Math.abs(dz) < st) dz = 0; else dz -= Math.sign(dz) * st; }
      this.vx = dx; this.vz = dz;
    }
    const ovy = this.vy;
    moveEntity(w, this, this.vx, this.vy, this.vz);
    // slime blocks bounce you back up (sneak to land softly)
    if (this.onGround && ovy < -0.15 && !this.sneaking && w.getId(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z)) === B.slime_block) {
      this.vy = -ovy * 0.85; this.onGround = false; this.fallDist = 0;
      g.audio.play('step', { mat: 'wool', vol: 0.5, pitch: 1.4 });
    }
    if (climb && (this.collidedH || inp.jump)) this.vy = 0.2;
    // auto jump
    if (SETTINGS.autoJump && this.onGround && this.collidedH && (Math.abs(f) + Math.abs(s)) > 0.3 && !this.sneaking) {
      const ax = this.x + mx * 0.6, az = this.z + mz * 0.6, fy = Math.floor(this.y + 0.5);
      const hb = w.getBlock(Math.floor(ax), fy, Math.floor(az));
      if (SOLID[hb & 4095] && !SOLID[w.getId(Math.floor(ax), fy + 1, Math.floor(az))] && !SOLID[w.getId(Math.floor(ax), fy + 2, Math.floor(az))] && !SOLID[w.getId(Math.floor(this.x), Math.floor(this.y + 2.2), Math.floor(this.z))]) this.vy = 0.42;
    }
    this.vy -= 0.08; this.vy *= 0.98;
    this.vx *= slip; this.vz *= slip;
    if (this.onGround) { if (this.fallDist > 0) this.land(this.fallDist); this.fallDist = 0; }
    else if (ovy < 0) this.fallDist -= Math.min(0, this.y - this.ly);
    const moved = Math.hypot(this.x - this.lx, this.z - this.lz);
    if (this.sprinting) this.addExhaustion(0.1 * moved);
    // footsteps
    if (this.onGround && moved > 0.01) {
      this.stepAcc = (this.stepAcc || 0) + moved;
      if (this.stepAcc > (this.sprinting ? 2.0 : 1.7)) { this.stepAcc = 0; const b = w.getId(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)); if (b) g.audio.play('step', { mat: BLOCKS[b].snd, vol: this.sneaking ? 0.08 : 0.2 }); }
    }
  }
  // ------------------------------------------------------------ main tick
  tick(inp) {
    const g = this.game_, w = this.world;
    this.savePrev(); this.age++;
    this.lbob = this.bob; this.lbobAmt = this.bobAmt;
    if (this.dead) return;
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.invul > 0) this.invul--;
    this.hurtFx = Math.max(0, this.hurtFx - 0.1);
    if (!w.isLoaded(Math.floor(this.x), Math.floor(this.z))) return;
    if (this.vehicle) { if (this.vehicle.removed) this.vehicle = null; else this.vehicle.syncRider(this); }
    if (!this.vehicle) this.tickMovement(inp);
    const sp = Math.hypot(this.x - this.lx, this.z - this.lz);
    this.walkAmt = (this.walkAmt || 0) + (Math.min(1, sp * 6) - (this.walkAmt || 0)) * 0.3; this.walkPhase = (this.walkPhase || 0) + sp * 3.2;
    if (this.onGround && !this.flying) { this.bob += sp * 1.9; this.bobAmt += (Math.min(1, sp * 6) - this.bobAmt) * 0.4; } else this.bobAmt *= 0.6;
    // environment sampling
    const ex = Math.floor(this.x), ey = Math.floor(this.eyeY()), ez = Math.floor(this.z);
    this.eyeBlock = w.getBlock(ex, ey, ez);
    if (FLUID[this.eyeBlock & 4095] === 1 || WLOG[this.eyeBlock & 4095]) { const m = this.eyeBlock >> 12; const surf = ey + (WLOG[this.eyeBlock & 4095] ? 1 : (m & 8) ? 1 : (8 - (m & 7)) / 9); if (this.eyeY() > surf) this.eyeBlock = 0; }
    this.eyeSky = w.skyAt(ex, ey, ez);
    if ((this.age & 15) === 0) this.biome = w.biomeAt(ex, ez);
    this.survival();
    this.tickPortal();
    // pickups
    if ((this.age & 1) === 0) for (const e of w.entitiesNear(this.x, this.y + 0.9, this.z, 2.0, (o) => (o.type === 'item') && !o.removed)) {
      if (e.pickupDelay > 0) continue;
      if (Math.abs(e.y - this.y - 0.5) > 1.6) continue;
      const left = this.inv.add(e.stack);
      if (left < e.stack.n) { g.audio.play('pop', { vol: 0.25, pitch: 0.9 + Math.random() * 0.6 }); g.ui.onPickup(e.stack.id, e.stack.n - left); }
      if (left === 0) e.removed = true; else e.stack.n = left;
    }
    if (this.swingAnim > 0) this.swingAnim = Math.max(0, this.swingAnim - 0.17);
    if (this.attackT < 40) this.attackT++;
    if (!this.vehicle) this.interact(inp);
    if (this.sleeping) { this.sleeping++; if (this.sleeping > 100) g.finishSleep(); }
  }
  survival() {
    const g = this.game_, w = this.world;
    if (this.creative || this.spectator) { this.air = 300; this.fireTicks = 0; return; }
    const diff = g.difficulty;
    // hunger
    if (this.exh >= 4) { this.exh -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else if (diff > 0) this.food = Math.max(0, this.food - 1); }
    if (diff === 0) { if (this.age % 20 === 0 && this.health < 20) this.health = Math.min(20, this.health + 1); if (this.age % 10 === 0 && this.food < 20) this.food++; }
    if (this.health < 20 && this.health > 0 && g.gameRules.naturalRegen !== false) {
      if (this.food >= 20 && this.sat > 0) { if (++this.regenT >= 10) { this.regenT = 0; const h = Math.min(1, 20 - this.health); this.health += h; this.addExhaustion(6 * h); } }
      else if (this.food >= 18) { if (++this.regenT >= 80) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.addExhaustion(6); } }
      else this.regenT = 0;
    }
    if (this.food <= 0) { if (++this.starveT >= 80) { this.starveT = 0; if (this.health > 10 || diff === 3 || (this.health > 1 && diff === 2)) this.hurt(1, { type: 'starve' }); } }
    // regeneration effect
    if (this.effects.regen > 0) { this.effects.regen--; if (this.effects.regen % 50 === 0 && this.health < 20) this.health = Math.min(20, this.health + 1); }
    // air
    const eyeId = this.eyeBlock & 4095;
    if (FLUID[eyeId] === 1 || WLOG[eyeId]) { this.air--; if (this.air <= -20) { this.air = 0; this.hurt(2, { type: 'drown' }); g.particles.burst(this.x, this.eyeY(), this.z, 'p_bubble', 6, [1, 1, 1]); } }
    else this.air = Math.min(300, this.air + 4);
    // fire / lava
    if (this.inLava) { this.fireTicks = 300; if (this.age % 10 === 0) this.hurt(4, { type: 'lava' }); }
    const feet = w.getId(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z));
    if (feet === B.fire && this.age % 10 === 0) { this.fireTicks = Math.max(this.fireTicks, 160); this.hurt(1, { type: 'fire' }); }
    if (this.fireTicks > 0) {
      this.fireTicks--;
      if (this.inWater || w.isRainingAt(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z))) this.fireTicks = 0;
      else if (this.fireTicks % 20 === 0) this.hurt(1, { type: 'fire' });
    }
    // contact damage
    if (this.age % 10 === 0) {
      const hw = this.w / 2 + 0.01;
      let cactus = false, magma = false, fire = 0;
      for (let x = Math.floor(this.x - hw); x <= Math.floor(this.x + hw); x++) for (let z = Math.floor(this.z - hw); z <= Math.floor(this.z + hw); z++) for (let y = Math.floor(this.y - 0.1); y <= Math.floor(this.y + 1.7); y++) {
        const id = w.getId(x, y, z); if (id === B.cactus || id === B.sweet_berry_bush && (w.getBlock(x, y, z) >> 12) > 0) cactus = true; if (id === B.magma_block && y === Math.floor(this.y - 0.1)) magma = true;
        if ((id === B.campfire || id === B.soul_campfire) && y === Math.floor(this.y - 0.1)) fire = BLOCKS[id].dmg;
      }
      if (cactus) this.hurt(1, { type: 'cactus' });
      if (magma && !this.sneaking) this.hurt(1, { type: 'fire' });
      if (fire && !this.sneaking) this.hurt(fire, { type: 'fire' });
      // suffocation
      const head = w.getId(Math.floor(this.x), Math.floor(this.eyeY()), Math.floor(this.z));
      if (OPAQUE[head] && head !== B.glass) this.hurt(1, { type: 'suffocate' });
    }
  }
  tickPortal() {
    const g = this.game_, w = this.world;
    if (this.portalCd > 0) this.portalCd--;
    const inP = w.getId(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z)) === B.nether_portal || w.getId(Math.floor(this.x), Math.floor(this.y + 1.2), Math.floor(this.z)) === B.nether_portal;
    if (inP && this.portalCd <= 0) {
      this.portalTime++;
      this.portalFx = Math.min(1, this.portalTime / 60);
      if (this.portalTime === 1) g.audio.play('portal_trigger', {});
      if (this.portalTime >= (this.creative ? 5 : 80)) { this.portalTime = 0; this.portalCd = 100; g.travelPortal(); }
    } else { this.portalTime = Math.max(0, this.portalTime - 2); this.portalFx = Math.max(0, this.portalFx - 0.05); }
  }
  // ------------------------------------------------------------ targeting
  updateTarget(ray) {
    const w = this.world;
    if (this.vehicle) { this.target = null; return null; }
    const reach = this.creative ? 5 : 4.5;
    const o = ray ? ray.o : [this.x, this.eyeY(), this.z], d = ray ? ray.d : this.lookVec();
    const hit = raycast(w, o[0], o[1], o[2], d[0], d[1], d[2], reach, false);
    let ent = null, et = hit ? hit.t : (this.creative ? 5 : 3.5);
    for (const e of w.entitiesNear(this.x, this.y, this.z, 8)) {
      if (e === this || e.removed || e.dead || !e.hurt || e.isProjectile) continue;
      const hw = e.w / 2 + 0.1;
      const h = rayAABB(o[0], o[1], o[2], d[0], d[1], d[2], [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + e.h + 0.1, e.z + hw]);
      if (h && h.t < et) { et = h.t; ent = e; }
    }
    if (ent) this.target = { entity: ent, t: et };
    else if (hit) this.target = hit;
    else this.target = null;
    return this.target;
  }
  // ------------------------------------------------------------ interaction
  interact(inp) {
    const g = this.game_, w = this.world;
    if (this.breakCd > 0) this.breakCd--;
    if (this.useCd > 0) this.useCd--;
    if (this.spectator || this.sleeping) return;
    const t = this.target;
    // attack / break
    if (inp.attackPressed) {
      this.swingAnim = 1;
      if (t && t.entity) this.attack(t.entity);
      else if (!t) this.attackT = 0;
    }
    if (inp.attack && t && !t.entity && !g.ui.open) {
      if (this.creative) {
        if (this.breakCd <= 0 && (inp.attackPressed || this.breakCd <= 0)) {
          const held = ITEMS[this.heldId()];
          if (!(held && held.tool && held.tool.type === 'sword')) { this.doBreak(t.x, t.y, t.z, t.v); this.breakCd = 5; this.swingAnim = 1; }
        }
      } else this.tickBreaking(t);
    } else { this.breakPos = null; this.breakProgress = 0; }
    // use
    const held = this.heldStack(), hd = held ? ITEMS[held.id] : null;
    if (this.using) {
      if (!inp.use) {
        if (this.using === 'bow') this.releaseBow();
        this.using = null; this.useTicks = 0;
      } else {
        this.useTicks++;
        if (this.using === 'food' && hd) {
          if (this.useTicks % 4 === 0) { g.audio.play('eat', { vol: 0.5, pitch: 0.8 + Math.random() * 0.4 }); g.particles.burst(this.x + Math.sin(this.yaw) * 0.4, this.eyeY() - 0.2, this.z - Math.cos(this.yaw) * 0.4, 'item:' + held.id, 3, [1, 1, 1]); }
          if (this.useTicks >= (hd.eatTime || 32)) { this.eat(held, hd); this.using = null; this.useTicks = 0; }
        }
        if (!held || (this.using === 'food' && !hd.food) || (this.using === 'bow' && hd.name !== 'bow') || (this.using === 'spyglass' && hd.use !== 'spyglass')) { this.using = null; this.useTicks = 0; }
      }
      return;
    }
    if (inp.use && this.useCd <= 0 && !g.ui.open) {
      if (this.useItem(t, held, hd, inp)) { this.useCd = 4; this.swingAnim = Math.max(this.swingAnim, 0.6); }
      else this.useCd = 4;
    }
    if (inp.pick && t && !t.entity) this.pickBlock(t);
  }
  attack(e) {
    const g = this.game_;
    const held = ITEMS[this.heldId()];
    let dmg = held && held.tool ? held.tool.dmg : 1;
    const cdT = held && held.tool ? (held.tool.type === 'sword' ? 12 : held.tool.type === 'axe' ? 20 : 16) : 5;
    const charge = Math.min(1, this.attackT / cdT);
    dmg *= 0.2 + 0.8 * charge * charge;
    const crit = charge > 0.9 && this.fallDist > 0 && !this.onGround && !this.inWater && !this.sprinting;
    if (crit) dmg *= 1.5;
    this.attackT = 0;
    if (e.isMob && e.def.villager) { }
    const kb = 0.4 + (this.sprinting && charge > 0.9 ? 0.5 : 0);
    if (e.hurt(dmg, { type: 'mob', source: this, kb })) {
      if (crit) g.particles.burst(e.x, e.y + e.h * 0.6, e.z, 'p_crit', 10, [1, 1, 1]);
      g.audio.play(crit ? 'crit' : 'hit', { vol: 0.5 });
      if (this.sprinting) this.sprinting = false;
      this.addExhaustion(0.1);
      if (held && held.tool && held.dur) this.damageHeld(held.tool.type === 'sword' ? 1 : 2);
      if (e.dead) this.stats.kills++;
    }
  }
  toolSpeed(id) {
    const b = BLOCKS[id], held = ITEMS[this.heldId()], tool = held && held.tool;
    let sp = 1;
    if (tool) {
      if (tool.type === b.tool) sp = tool.speed;
      if (tool.type === 'sword') sp = id === B.cobweb ? 15 : (LEAVES[id] || PLANT[id] || id === B.melon || id === B.pumpkin) ? 1.5 : 1;
      if (tool.type === 'shears') sp = id === B.cobweb || LEAVES[id] ? 15 : b.snd === 'wool' ? 5 : (id === B.vine ? 2 : 1);
      if (tool.type === 'hoe' && (LEAVES[id] || b.tool === 'hoe')) sp = tool.speed;
    }
    return sp;
  }
  canHarvest(id) {
    const b = BLOCKS[id]; if (!b.req) return true;
    const held = ITEMS[this.heldId()], tool = held && held.tool;
    return !!(tool && tool.type === b.tool && (b.tier === undefined || tool.tier >= b.tier));
  }
  tickBreaking(t) {
    const g = this.game_, w = this.world;
    const key = t.x + ',' + t.y + ',' + t.z;
    if (this.breakPos !== key) { this.breakPos = key; this.breakProgress = 0; this.breakTicks = 0;
      // punching fire out
      if (t.face === 2 && w.getId(t.x, t.y + 1, t.z) === B.fire) { w.setBlock(t.x, t.y + 1, t.z, 0, 1); g.audio.play('fizz', { vol: 0.4 }); return; }
    }
    const id = t.id, b = BLOCKS[id];
    if (b.hard < 0) return;
    let sp = this.toolSpeed(id);
    if (this.inWater) sp /= 5;
    if (!this.onGround && !this.flying) sp /= 5;
    const dmg = b.hard === 0 ? 1 : sp / b.hard / (this.canHarvest(id) ? 30 : 100);
    this.breakProgress += dmg;
    this.breakTicks++;
    this.swingAnim = Math.max(this.swingAnim, 0.7);
    if (this.breakTicks % 4 === 1) { g.audio.play('dig', { mat: b.snd, vol: 0.3, x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 }); g.particles.blockHit(t.x, t.y, t.z, t.face, t.v); }
    if (this.breakProgress >= 1) { this.doBreak(t.x, t.y, t.z, t.v); this.breakProgress = 0; this.breakPos = null; this.breakCd = 5; }
  }
  doBreak(x, y, z, v) {
    const g = this.game_, w = this.world, id = v & 4095;
    const b = BLOCKS[id];
    g.audio.play('break', { mat: b.snd, x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    const harvest = this.canHarvest(id);
    breakBlock(w, x, y, z, harvest && !this.creative, this);
    if (!this.creative) {
      const xp = harvest ? blockXP(id) : 0; if (xp) g.spawnXP(w, x + 0.5, y + 0.5, z + 0.5, xp);
      const held = ITEMS[this.heldId()];
      if (held && held.tool && b.hard > 0) this.damageHeld(held.tool.type === 'sword' ? 2 : 1);
      this.addExhaustion(0.005);
    }
    this.stats.blocks++;
    if (id === B.ice && !this.creative) { const below = w.getId(x, y - 1, z); if (below && below !== B.air && w.dim !== 'nether') w.setBlock(x, y, z, B.water, 1); }
  }
  pickBlock(t) {
    const id = t.id; let item = id;
    if (id === B.lit_furnace) item = B.furnace;
    if (id === B.lit_blast_furnace) item = B.blast_furnace; if (id === B.lit_smoker) item = B.smoker; if (id === B.lit_redstone_lamp) item = B.redstone_lamp;
    if (id === B.wheat) item = I.wheat_seeds; if (id === B.carrots) item = I.carrot; if (id === B.potatoes) item = I.potato;
    if (id === B.beetroots) item = I.beetroot_seeds; if (id === B.sweet_berry_bush) item = I.sweet_berries;
    if (!ITEMS[item]) return;
    for (let i = 0; i < 9; i++) { const s = this.inv.get(i); if (s && s.id === item) { this.sel = i; return; } }
    if (this.creative) { let slot = this.sel; if (this.inv.get(slot)) { for (let i = 0; i < 9; i++) if (!this.inv.get(i)) { slot = i; break; } } this.inv.set(slot, { id: item, n: maxStack(item), d: 0 }); this.sel = slot; }
    else for (let i = 9; i < 36; i++) { const s = this.inv.get(i); if (s && s.id === item) { const h = this.inv.get(this.sel); this.inv.set(this.sel, s); this.inv.set(i, h); return; } }
  }
  eat(stack, d) {
    const g = this.game_;
    if (d.food) { this.food = Math.min(20, this.food + d.food[0]); this.sat = Math.min(this.food, this.sat + d.food[0] * d.food[1] / d.food[0] * 1); }
    if (d.name === 'golden_apple') { this.effects.regen = 100; this.absorb = 4; }
    if (d.name === 'milk_bucket') { this.effects = {}; }
    g.audio.play('burp', { vol: 0.5 });
    const empty = EMPTY_ON_EAT[d.name] || (d.name === 'milk_bucket' ? 'bucket' : null);
    if (!this.creative) { if (empty) this.replaceHeld({ id: I[empty], n: 1, d: 0 }); else this.consumeHeld(1); }
  }
  // fishing: cast a bobber; use again to reel in (catches something if a fish is biting)
  useFishingRod(held) {
    const g = this.game_, w = this.world;
    if (this.bobber && !this.bobber.removed) { this.bobber.reel(); this.bobber = null; this.swingAnim = 1; return true; }
    const d = this.lookVec();
    const b = new Bobber(this.x + d[0] * 0.6, this.eyeY() - 0.15, this.z + d[2] * 0.6, d[0] * 0.95 + this.vx, d[1] * 0.95 + 0.16, d[2] * 0.95 + this.vz, this);
    w.addEntity(b); this.bobber = b; this.swingAnim = 1;
    g.audio.play('throw', { pitch: 0.7 });
    return true;
  }
  releaseBow() {
    const g = this.game_;
    const charge = Math.min(1, this.useTicks / 20);
    const f = (charge * charge + charge * 2) / 3;
    if (f < 0.1) return;
    const hasArrow = this.creative || this.inv.count(id => id === I.arrow) > 0;
    if (!hasArrow) return;
    if (!this.creative) this.inv.remove(id => id === I.arrow, 1);
    const d = this.lookVec(), v = f * 3;
    const a = new Arrow(this.x + d[0] * 0.3, this.eyeY() - 0.1, this.z + d[2] * 0.3, d[0] * v + this.vx, d[1] * v, d[2] * v + this.vz, this, 2, f >= 1);
    this.world.addEntity(a);
    g.audio.play('bow', {});
    this.damageHeld(1);
  }
  useItem(t, held, hd, inp) {
    const g = this.game_, w = this.world;
    // entity interaction
    if (t && t.entity) { if (t.entity.interact && t.entity.interact(this, held)) return true; }
    // block interaction
    if (t && !t.entity) {
      const b = BLOCKS[t.id];
      if (b.use && !(this.sneaking && held)) { if (g.useBlock(t.x, t.y, t.z, t.v, this)) return true; }
      if (hd && hd.use && this.useOnBlock(t, held, hd)) return true;
      if (hd && (hd.block !== undefined || hd.place !== undefined)) {
        if (this.placeBlock(t, held, hd)) return true;
        if (!hd.food) return false; // placeable food (carrots, berries...) can still be eaten
      }
    }
    if (!hd) return false;
    if (hd.use === 'spyglass') { this.using = 'spyglass'; this.useTicks = 0; g.audio.play('click', { vol: 0.2, pitch: 1.4 }); return true; }
    if (hd.use === 'fish') return this.useFishingRod(held);
    // air use
    if (hd.food && (this.food < 20 || this.creative || hd.name === 'golden_apple' || hd.name === 'milk_bucket')) { this.using = 'food'; this.useTicks = 0; return true; }
    if (hd.use === 'drink') { this.using = 'food'; this.useTicks = 0; return true; }
    if (hd.use === 'bow') { if (this.creative || this.inv.count(id => id === I.arrow) > 0) { this.using = 'bow'; this.useTicks = 0; } return true; }
    if (hd.use === 'throw') {
      const d = this.lookVec(), v = 1.5;
      const kind = hd.name === 'egg' ? 'egg' : hd.name === 'ender_pearl' ? 'ender_pearl' : 'snowball';
      w.addEntity(new Thrown(kind, this.x + d[0] * 0.4, this.eyeY() - 0.1, this.z + d[2] * 0.4, d[0] * v, d[1] * v + 0.1, d[2] * v, this));
      g.audio.play('throw', {}); this.consumeHeld(1); return true;
    }
    if (hd.use === 'bucket') {
      const o = [this.x, this.eyeY(), this.z], d = this.lookVec();
      const hit = raycast(w, o[0], o[1], o[2], d[0], d[1], d[2], 5, true);
      if (hit && FLUID[hit.id] && (hit.v >> 12) === 0) {
        w.setBlock(hit.x, hit.y, hit.z, 0, 1);
        this.replaceHeld({ id: hit.id === B.lava ? I.lava_bucket : I.water_bucket, n: 1, d: 0 });
        g.audio.play(hit.id === B.lava ? 'bucket_lava' : 'bucket_fill', {}); return true;
      }
    }
    return false;
  }
  useOnBlock(t, held, hd) {
    const g = this.game_, w = this.world;
    const u = hd.use;
    const ax = t.x + FACE_DX[t.face], ay = t.y + FACE_DY[t.face], az = t.z + FACE_DZ[t.face];
    if (u === 'hoe' && t.face !== 3 && (t.id === B.grass_block || t.id === B.dirt || t.id === B.dirt_path || t.id === B.coarse_dirt || t.id === B.rooted_dirt) && w.getId(t.x, t.y + 1, t.z) === 0) {
      w.setBlock(t.x, t.y, t.z, t.id === B.coarse_dirt || t.id === B.rooted_dirt ? B.dirt : B.farmland, 1); g.audio.play('step', { mat: 'gravel', vol: 0.6 }); this.damageHeld(1); return true;
    }
    if (u === 'axe') {
      // strip logs; scrape one stage of weathering off copper
      const to = STRIP[t.id] !== undefined ? STRIP[t.id] : BLOCKS[t.id].scrape ? B[BLOCKS[t.id].scrape] : undefined;
      if (to !== undefined) {
        w.setBlock(t.x, t.y, t.z, to | ((t.v >> 12) << 12), 1);
        g.audio.play(BLOCKS[t.id].scrape ? 'shear' : 'dig', { mat: 'wood', x: t.x, y: t.y, z: t.z });
        g.particles.blockHit(t.x, t.y, t.z, t.face, t.v);
        this.damageHeld(1); return true;
      }
    }
    if (u === 'shovel' && t.face !== 3 && (t.id === B.grass_block || t.id === B.dirt || t.id === B.podzol || t.id === B.mycelium) && w.getId(t.x, t.y + 1, t.z) === 0) {
      w.setBlock(t.x, t.y, t.z, B.dirt_path, 1); g.audio.play('step', { mat: 'grass', vol: 0.6 }); this.damageHeld(1); return true;
    }
    if (u === 'bonemeal') { if (boneMeal(w, t.x, t.y, t.z, this)) { this.consumeHeld(1); return true; } return false; }
    if (u === 'shears' && t.id === B.pumpkin) { w.setBlock(t.x, t.y, t.z, B.carved_pumpkin | (((this.facing() + 2) & 3) << 12), 1); g.audio.play('shear', {}); this.damageHeld(1); return true; }
    if (u === 'ignite' || u === 'ignite_charge') {
      if (t.id === B.tnt) { w.setBlock(t.x, t.y, t.z, 0, 1); g.primeTNT(t.x + 0.5, t.y, t.z + 0.5, 80); }
      else if (w.getId(ax, ay, az) === 0) {
        if (!tryLightPortal(w, ax, ay, az)) { w.setBlock(ax, ay, az, B.fire, 1); w.schedule(ax, ay, az, 30); }
        else g.audio.play('portal_open', {});
      } else return false;
      g.audio.play('ignite', {});
      if (u === 'ignite') this.damageHeld(1); else this.consumeHeld(1);
      return true;
    }
    if (u === 'bucket_place') {
      let x = ax, y = ay, z = az;
      const tv = w.getBlock(t.x, t.y, t.z); if (REPL[tv & 4095] && !FLUID[tv & 4095]) { x = t.x; y = t.y; z = t.z; }
      const cur = w.getId(x, y, z);
      if (cur !== 0 && !REPL[cur] && !FLUID[cur]) return false;
      if (hd.fluid === 'water' && w.dim === 'nether') { g.fx('fizz', x + 0.5, y + 0.5, z + 0.5); }
      else { if (cur && !FLUID[cur]) breakBlock(w, x, y, z, true, null); w.setBlock(x, y, z, hd.fluid === 'water' ? B.water : B.lava, 1); w.schedule(x, y, z, 5); }
      g.audio.play(hd.fluid === 'water' ? 'bucket_empty' : 'bucket_empty_lava', {});
      if (!this.creative) this.inv.set(this.sel, { id: I.bucket, n: 1, d: 0 });
      return true;
    }
    if (u === 'spawn_egg') { g.spawnMob(hd.mob, ax + 0.5, ay, az + 0.5, null); this.consumeHeld(1); return true; }
    if (u === 'vehicle') {
      const d = VEH_DEFS[hd.vehicle], r = Math.floor(d.w * 0.4);
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = 0; dy < 2; dy++) if (SOLID[w.getId(ax + dx, ay + dy, az + dz)]) { g.ui.message('Not enough room to deploy here', '#f88'); return false; }
      spawnVehicle(w, hd.vehicle, ax + 0.5, ay + 0.02, az + 0.5, this.yaw);
      g.audio.play('veh_enter', { x: ax, y: ay, z: az });
      this.consumeHeld(1); return true;
    }
    return false;
  }
  placeBlock(t, held, hd) {
    const g = this.game_, w = this.world;
    let bid = hd.place !== undefined ? hd.place : hd.block;
    if (bid === undefined) return false;
    let x = t.x + FACE_DX[t.face], y = t.y + FACE_DY[t.face], z = t.z + FACE_DZ[t.face];
    const tv = w.getBlock(t.x, t.y, t.z), tid = tv & 4095;
    const frac = t.hy - Math.floor(t.hy);
    // slab merge
    if (SHAPE[bid] === R_SLAB && tid === bid) {
      const m = tv >> 12;
      if ((m === 0 && t.face === 2) || (m === 1 && t.face === 3)) { const full = B[BLOCKS[bid].full]; w.setBlock(t.x, t.y, t.z, full, 1); this.afterPlace(bid, t.x, t.y, t.z); return true; }
    }
    // snow layer stacking
    if (bid === B.snow_layer && tid === B.snow_layer) { const m = tv >> 12; w.setBlock(t.x, t.y, t.z, m >= 6 ? B.snow : B.snow_layer | ((m + 1) << 12), 1); this.afterPlace(bid, t.x, t.y, t.z); return true; }
    if (REPL[tid] && !(tid === B.snow_layer && (tv >> 12) > 0) && (bid !== tid)) { x = t.x; y = t.y; z = t.z; }
    if (y < 0 || y >= CH) return false;
    const cur = w.getBlock(x, y, z), cid = cur & 4095;
    if (cid !== 0 && !REPL[cid]) {
      if (SHAPE[bid] === R_SLAB && cid === bid) { const full = B[BLOCKS[bid].full]; w.setBlock(x, y, z, full, 1); this.afterPlace(bid, x, y, z); return true; }
      return false;
    }
    const f = this.facing();
    let meta = 0;
    const s = SHAPE[bid], bd = BLOCKS[bid];
    if (bd.axis) meta = (t.face === 0 || t.face === 1) ? 1 : (t.face === 4 || t.face === 5) ? 2 : 0;
    else if (bd.facing) meta = (f + 2) & 3;
    if (s === R_STAIRS) meta = f | ((t.face === 3 || (t.face !== 2 && frac > 0.5)) ? 4 : 0);
    if (s === R_SLAB) meta = (t.face === 3 || (t.face !== 2 && frac > 0.5)) ? 1 : 0;
    if (s === R_TORCH) { if (t.face === 3) return false; meta = t.face === 2 ? 0 : 1 + FACE_TO_FACING[t.face]; }
    if (s === R_LADDER) { if (t.face === 2 || t.face === 3) return false; meta = FACE_TO_FACING[t.face]; }
    if (s === R_VINE) { if (t.face === 2 || t.face === 3) return false; meta = VINE_META_TOWARD[(FACE_TO_FACING[t.face] + 2) & 3]; }
    if (s === R_TRAPDOOR) meta = ((t.face === 0 || t.face === 1 || t.face === 4 || t.face === 5) ? ((FACE_TO_FACING[t.face] + 2) & 3) : ((f + 2) & 3)) | ((t.face === 3 || (t.face !== 2 && frac > 0.5)) ? 8 : 0);
    if (s === R_GATE) meta = f;
    if (s === R_RAIL) meta = f & 1;
    if (s === R_LANTERN) meta = t.face === 3 ? 1 : 0;
    if (s === R_CHEST) meta = (f + 2) & 3;
    if (bid === B.pointed_dripstone) meta = t.face === 3 ? 0 : 1;
    if (LEAVES[bid]) meta = 8;
    let v = bid | (meta << 12);
    // validity
    if (SOLID[bid] && s !== R_CARPET && s !== R_PLATE) {
      for (const e of w.entitiesInBox(x, y, z, x + 1, y + 1, z + 1)) if (!e.removed && (e.isPlayer || e.isMob) && !e.dead) return false;
    }
    if (s === R_DOOR) {
      if (y + 1 >= CH || (w.getId(x, y + 1, z) !== 0 && !REPL[w.getId(x, y + 1, z)])) return false;
      if (!isSolidTop(w.getId(x, y - 1, z), w.getBlock(x, y - 1, z))) return false;
      w.setBlock(x, y, z, bid | (f << 12), 0); w.setBlock(x, y + 1, z, bid | (8 << 12), 1);
      this.afterPlace(bid, x, y, z); return true;
    }
    if (s === R_BED) {
      const hx = x + FACING_DX[f], hz = z + FACING_DZ[f];
      const hc = w.getId(hx, y, hz);
      if ((hc !== 0 && !REPL[hc]) || !SOLID[w.getId(x, y - 1, z)] || !SOLID[w.getId(hx, y - 1, hz)]) return false;
      w.setBlock(x, y, z, bid | (f << 12), 0); w.setBlock(hx, y, hz, bid | ((f | 4) << 12), 1);
      this.afterPlace(bid, x, y, z); return true;
    }
    if (!supported(w, x, y, z, v)) return false;
    w.setBlock(x, y, z, v, 1);
    if (bid === B.chest || bid === B.barrel) w.setBE(x, y, z, { t: 'chest', items: new Array(27).fill(null) });
    if (bid === B.furnace || bid === B.blast_furnace || bid === B.smoker) w.setBE(x, y, z, { t: 'furnace', items: [null, null, null], burn: 0, burnMax: 0, cook: 0, xp: 0 });
    if (FLUID[bid]) w.schedule(x, y, z, 5);
    if (BLOCKS[bid].grav) w.schedule(x, y, z, 2);
    this.afterPlace(bid, x, y, z);
    return true;
  }
  afterPlace(bid, x, y, z) {
    const g = this.game_;
    g.audio.play('place', { mat: BLOCKS[bid].snd, x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.consumeHeld(1);
    this.swingAnim = 1;
  }
}
