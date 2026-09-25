// ============================================================================
//  Entities: base physics entity, items, xp, projectiles, falling blocks, TNT
// ============================================================================
let NEXT_EID = 1;
class Entity {
  constructor(type, x, y, z) {
    this.id = NEXT_EID++; this.type = type;
    this.x = x; this.y = y; this.z = z; this.lx = x; this.ly = y; this.lz = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0; this.lyaw = 0;
    this.w = 0.6; this.h = 1.8; this.stepH = 0;
    this.onGround = false; this.removed = false; this.age = 0;
    this.fallDist = 0; this.inWater = false; this.inLava = false; this.fireTicks = 0;
    this.gravity = 0.08; this.drag = 0.98;
    this.world = null;
  }
  get game() { return this.world.game; }
  ix(a) { return this.lx + (this.x - this.lx) * a; }
  iy(a) { return this.ly + (this.y - this.ly) * a; }
  iz(a) { return this.lz + (this.z - this.lz) * a; }
  savePrev() { this.lx = this.x; this.ly = this.y; this.lz = this.z; this.lyaw = this.yaw; }
  updateFluids() {
    const w = this.world, hw = this.w / 2 - 0.001;
    let water = false, lava = false;
    const y0 = Math.floor(this.y + 0.01), y1 = Math.floor(this.y + this.h * 0.6);
    for (let x = Math.floor(this.x - hw); x <= Math.floor(this.x + hw); x++) for (let z = Math.floor(this.z - hw); z <= Math.floor(this.z + hw); z++) for (let y = y0; y <= y1; y++) {
      const v = w.getBlock(x, y, z), id = v & 4095;
      const f = WLOG[id] ? 1 : FLUID[id];
      if (!f) continue;
      const surf = y + (WLOG[id] ? 0.9 : ((v >> 12) & 8) ? 1 : (8 - ((v >> 12) & 7)) / 9);
      if (this.y < surf) { if (f === 1) water = true; else lava = true; }
    }
    this.inWater = water; this.inLava = lava;
    if (water) { this.fireTicks = 0; this.fallDist = 0; }
    if (lava && !this.fireImmune) this.fireTicks = Math.max(this.fireTicks, 300);
  }
  physics() {
    const w = this.world;
    if (!w.isLoaded(Math.floor(this.x), Math.floor(this.z))) return;
    this.updateFluids();
    const wasOnGround = this.onGround, ovy = this.vy;
    if (this.inWater) { this.vy -= this.gravity * 0.25; }
    else if (this.inLava) { this.vy -= this.gravity * 0.25; }
    else if (!this.noGravity) this.vy -= this.gravity;
    moveEntity(w, this, this.vx, this.vy, this.vz);
    if (this.inWater) { this.vx *= 0.8; this.vy *= 0.8; this.vz *= 0.8; }
    else if (this.inLava) { this.vx *= 0.5; this.vy *= 0.5; this.vz *= 0.5; }
    else {
      const f = this.onGround ? this.groundSlip() * 0.91 : 0.91;
      this.vx *= f; this.vz *= f; this.vy *= this.drag;
    }
    if (this.onGround) { if (this.fallDist > 0) this.land(this.fallDist); this.fallDist = 0; }
    else if (this.vy < 0 && !this.inWater) this.fallDist -= Math.min(0, ovy);
    void wasOnGround;
    if (this.y < -64) this.voidDamage();
  }
  groundSlip() { const id = this.world.getId(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)); return BLOCKS[id] && BLOCKS[id].slip || 0.6; }
  land() { }
  voidDamage() { this.removed = true; }
  tick() { this.age++; }
  dist2(x, y, z) { const dx = this.x - x, dy = this.y - y, dz = this.z - z; return dx * dx + dy * dy + dz * dz; }
}
// ---------------------------------------------------------------- dropped items
class ItemEntity extends Entity {
  constructor(x, y, z, stack) {
    super('item', x, y, z);
    this.stack = stack; this.w = 0.25; this.h = 0.25; this.gravity = 0.04; this.pickupDelay = 10; this.bob = Math.random() * TAU;
    this.vx = (Math.random() - 0.5) * 0.2; this.vy = 0.2; this.vz = (Math.random() - 0.5) * 0.2;
  }
  tick() {
    this.savePrev(); this.age++;
    if (this.pickupDelay > 0) this.pickupDelay--;
    if (this.world.getId(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)) && OPAQUE[this.world.getId(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z))]) { this.vy = 0.2; this.y += 0.1; }
    this.physics();
    if (this.inWater) this.vy += 0.045;
    if (this.inLava) { this.removed = true; this.game.fx('fizz', this.x, this.y, this.z); return; }
    if (this.fireTicks > 0) { this.removed = true; return; }
    if (this.age > 6000) this.removed = true;
    // merge with neighbors
    if ((this.age % 20) === 0 && this.stack.n < maxStack(this.stack.id)) {
      for (const e of this.world.entitiesNear(this.x, this.y, this.z, 1.2, (o) => o.type === 'item' && o !== this && o.stack.id === this.stack.id && !o.stack.d && !this.stack.d)) {
        const room = maxStack(this.stack.id) - this.stack.n; if (room <= 0) break;
        const mv = Math.min(room, e.stack.n); this.stack.n += mv; e.stack.n -= mv; if (e.stack.n <= 0) e.removed = true;
      }
    }
  }
}
class XPOrb extends Entity {
  constructor(x, y, z, value) { super('xp', x, y, z); this.value = value; this.w = 0.3; this.h = 0.3; this.gravity = 0.03; this.vx = (Math.random() - 0.5) * 0.2; this.vy = 0.2 + Math.random() * 0.1; this.vz = (Math.random() - 0.5) * 0.2; }
  tick() {
    this.savePrev(); this.age++;
    const p = this.game.player;
    if (p && !p.dead && p.world === this.world) {
      const dx = p.x - this.x, dy = p.y + 0.8 - this.y, dz = p.z - this.z, d = Math.hypot(dx, dy, dz);
      if (d < 8 && d > 0.01) { const f = (1 - d / 8) * (1 - d / 8) * 0.1; this.vx += dx / d * f; this.vy += dy / d * f; this.vz += dz / d * f; }
      if (d < 1.2 && this.age > 10) { p.addXP(this.value); this.removed = true; this.game.audio.play('xp', { vol: 0.25, pitch: 0.8 + Math.random() * 0.8 }); return; }
    }
    this.physics();
    if (this.age > 6000) this.removed = true;
  }
}
// ---------------------------------------------------------------- projectiles
class Projectile extends Entity {
  constructor(type, x, y, z, vx, vy, vz, owner) { super(type, x, y, z); this.vx = vx; this.vy = vy; this.vz = vz; this.owner = owner; this.w = 0.25; this.h = 0.25; this.stuck = false; this.gravity = 0.05; this.drag = 0.99; }
  tick() {
    this.savePrev(); this.age++;
    if (this.age > 1200) { this.removed = true; return; }
    if (this.stuck) { this.stuckTick(); return; }
    const w = this.world;
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    // block hit
    const hit = sp > 0 ? raycast(w, this.x, this.y, this.z, this.vx / sp, this.vy / sp, this.vz / sp, sp, false) : null;
    // entity hit
    let ent = null, et = hit ? hit.t : sp, part = -1;
    for (const e of w.entitiesNear(this.x, this.y, this.z, sp + 3)) {
      if (e === this || !e.hurt || e.removed || (e === this.owner && (this.age < 5 || e.isBoss)) || e.type === 'item' || e.type === 'xp' || e.dead || e.isProjectile) continue;
      const h = entityRayHit(e, this.x, this.y, this.z, this.vx / sp, this.vy / sp, this.vz / sp, 0.15, 0.1);
      if (!h || h.t > et) continue;
      // endermen see it coming and blink away
      if (e.def && e.def.enderman && e.teleportRandom()) continue;
      et = h.t; ent = e; part = h.part;
    }
    if (ent) { ent.lastHitPart = part; this.onHitEntity(ent); ent.lastHitPart = -1; return; }
    if (hit) { this.x = hit.hx - this.vx / sp * 0.05; this.y = hit.hy - this.vy / sp * 0.05; this.z = hit.hz - this.vz / sp * 0.05; this.onHitBlock(hit); return; }
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    this.updateFluids();
    const drag = this.inWater ? 0.6 : this.drag;
    this.vx *= drag; this.vy *= drag; this.vz *= drag; this.vy -= this.gravity;
    if (sp > 0.01) { this.yaw = Math.atan2(this.vx, -this.vz); this.pitch = Math.atan2(this.vy, Math.hypot(this.vx, this.vz)); }
    if (this.y < -64) this.removed = true;
  }
  stuckTick() { }
  onHitEntity() { this.removed = true; }
  onHitBlock() { this.removed = true; }
}
Projectile.prototype.isProjectile = true;
class Arrow extends Projectile {
  constructor(x, y, z, vx, vy, vz, owner, dmg, crit) { super('arrow', x, y, z, vx, vy, vz, owner); this.dmg = dmg || 2; this.crit = crit; this.pickup = owner && owner.isPlayer && !owner.creative; }
  onHitEntity(e) {
    const sp = Math.hypot(this.vx, this.vy, this.vz);
    let d = Math.ceil(sp * this.dmg); if (this.crit) d += Math.floor(Math.random() * (d / 2 + 2));
    if (e.hurt(d, { type: 'arrow', source: this.owner, proj: this })) {
      const l = Math.hypot(this.vx, this.vz) || 1; e.vx += this.vx / l * 0.4; e.vz += this.vz / l * 0.4; e.vy += 0.1;
      this.game.audio.play('arrow_hit', { x: this.x, y: this.y, z: this.z });
      this.removed = true;
    } else { this.vx *= -0.1; this.vy *= -0.1; this.vz *= -0.1; }
  }
  onHitBlock(hit) {
    this.stuck = true; this.vx = this.vy = this.vz = 0; this.stuckAt = [hit.x, hit.y, hit.z]; this.age = 0;
    this.game.audio.play('arrow_hit', { x: this.x, y: this.y, z: this.z, vol: 0.5 });
  }
  stuckTick() {
    const [x, y, z] = this.stuckAt;
    if (!this.world.getId(x, y, z)) { this.stuck = false; return; }
    if (this.age > 1200) this.removed = true;
    const p = this.game.player;
    if (this.pickup && p && p.dist2(this.x, this.y - 0.5, this.z) < 2.5 && this.age > 10) { if (p.inv.add({ id: I.arrow, n: 1, d: 0 }) === 0) { this.removed = true; this.game.audio.play('pop', { vol: 0.3 }); } }
  }
}
class Thrown extends Projectile {
  constructor(kind, x, y, z, vx, vy, vz, owner) { super(kind, x, y, z, vx, vy, vz, owner); this.gravity = 0.03; }
  tick() {
    // an ender pearl thrown into an end gateway carries you through it
    if (this.type === 'ender_pearl' && !this.stuck) {
      const w = this.world, n = Math.ceil(Math.hypot(this.vx, this.vy, this.vz) / 0.25);
      for (let i = 1; i <= n; i++) {
        const k = i / n, x = this.x + this.vx * k, y = this.y + this.vy * k, z = this.z + this.vz * k;
        if (w.getId(Math.floor(x), Math.floor(y), Math.floor(z)) === B.end_gateway) { this.savePrev(); this.x = x; this.y = y - 0.3; this.z = z; this.burst(); return; }
      }
    }
    super.tick();
  }
  onHitEntity(e) { e.hurt(this.type === 'hex' ? 4 : 0, { type: 'thrown', source: this.owner }); if (this.type === 'hex') e.slowTicks = 100; this.burst(); }
  onHitBlock() { this.burst(); }
  burst() {
    const g = this.game;
    if (this.type === 'ender_pearl') {
      const o = this.owner;
      g.particles.burst(this.x, this.y, this.z, 'p_portal', 16, [1, 1, 1]);
      if (o && !o.dead && o.world === this.world) {
        g.particles.burst(o.x, o.y + 1, o.z, 'p_portal', 12, [1, 1, 1]);
        o.x = this.x; o.y = this.y + 0.1; o.z = this.z; o.vx = o.vy = o.vz = 0; o.fallDist = 0;
        if (o.isPlayer) { o.savePrev(); if (!o.creative) o.hurt(2, { type: 'fall' }); }
        g.audio.play('portal_open', { vol: 0.35 });
      }
      this.removed = true; return;
    }
    if (this.type === 'egg' && Math.random() < 0.125) g.spawnMob('chicken', this.x, this.y, this.z, { baby: true });
    g.particles.burst(this.x, this.y, this.z, this.type === 'hex' ? 'p_spark' : this.type === 'egg' ? 'p_dust' : 'p_snow', 8, this.type === 'hex' ? [0.6, 0.2, 0.9] : [1, 1, 1]);
    this.removed = true;
  }
}
class Fireball extends Projectile {
  constructor(x, y, z, vx, vy, vz, owner, power) { super('fireball', x, y, z, vx, vy, vz, owner); this.gravity = 0; this.drag = 1; this.power = power || 1; this.w = 0.4; this.h = 0.4; this.fireImmune = true; }
  tick() { super.tick(); if (!this.removed && (this.age & 1)) this.game.particles.spawn('p_flame', this.x, this.y, this.z, { vx: 0, vy: 0.01, vz: 0, life: 8, size: 0.25 }); if (this.age > 200) this.removed = true; }
  onHitEntity(e) { e.hurt(5, { type: 'fireball', source: this.owner }); e.fireTicks = Math.max(e.fireTicks, 100); this.boom(); }
  onHitBlock(hit) {
    this.boom();
    const x = hit.x + FACE_DX[hit.face], y = hit.y + FACE_DY[hit.face], z = hit.z + FACE_DZ[hit.face];
    if (this.world.getId(x, y, z) === 0 && this.game.gameRules.mobGriefing !== false) { this.world.setBlock(x, y, z, B.fire, 1); this.world.schedule(x, y, z, 30); }
  }
  boom() { this.removed = true; if (this.power > 1) explode(this.world, this.x, this.y, this.z, this.power, true, this); else this.game.fx('smallboom', this.x, this.y, this.z); }
}
// ---------------------------------------------------------------- fishing bobber
const FISH_LOOT = [['cod', 60], ['salmon', 25], ['tropical_fish', 3], ['stick', 2], ['string', 2], ['bowl', 2], ['leather', 2], ['bone', 2], ['lily_pad', 2], ['emerald', 1], ['ender_pearl', 1], ['sea_pickle', 1]];
class Bobber extends Entity {
  constructor(x, y, z, vx, vy, vz, owner) {
    super('bobber', x, y, z);
    this.vx = vx; this.vy = vy; this.vz = vz; this.owner = owner;
    this.w = 0.25; this.h = 0.25; this.gravity = 0.04; this.drag = 0.92;
    this.floating = false; this.wait = 0; this.bite = 0;
  }
  tick() {
    this.savePrev(); this.age++;
    const o = this.owner, g = this.game;
    const rod = o && ITEMS[o.heldId()];
    if (!o || o.dead || o.removed || o.world !== this.world || o.dist2(this.x, this.y, this.z) > 32 * 32 || !rod || rod.use !== 'fish' || this.age > 6000) {
      this.removed = true; if (o && o.bobber === this) o.bobber = null; return;
    }
    this.updateFluids();
    if (this.inWater) {
      // bob on the surface; after a random wait a fish bites for one second
      this.vy += 0.07; this.vy *= 0.7; this.vx *= 0.8; this.vz *= 0.8;
      if (!this.floating) { this.floating = true; this.wait = 100 + Math.floor(Math.random() * 500); g.particles.burst(this.x, this.y + 0.2, this.z, 'p_splash', 6, [0.6, 0.7, 1]); g.audio.play('splash', { x: this.x, y: this.y, z: this.z, vol: 0.3 }); }
      if (this.bite > 0) { if (--this.bite === 0) this.wait = 80 + Math.floor(Math.random() * 400); this.vy -= 0.05; }
      else if (--this.wait <= 0) {
        this.bite = 22;
        g.particles.burst(this.x, this.y + 0.3, this.z, 'p_splash', 12, [0.6, 0.7, 1]); g.particles.burst(this.x, this.y + 0.1, this.z, 'p_bubble', 6, [1, 1, 1]);
        g.audio.play('splash', { x: this.x, y: this.y, z: this.z, vol: 0.6 });
      } else if (this.wait < 40 && Math.random() < 0.25) g.particles.spawn('p_bubble', this.x + (Math.random() - 0.5) * 2, this.y, this.z + (Math.random() - 0.5) * 2, { vy: 0.02, life: 12, size: 0.1 });
    } else { this.vy -= this.gravity; this.floating = false; }
    moveEntity(this.world, this, this.vx, this.vy, this.vz);
    if (!this.inWater) { this.vx *= this.onGround ? 0.5 : this.drag; this.vz *= this.onGround ? 0.5 : this.drag; }
  }
  reel() {
    const o = this.owner, g = this.game, w = this.world;
    this.removed = true;
    if (this.bite > 0 && o) {
      const name = weightedPick(FISH_LOOT, Math.random());
      const e = g.dropItem(w, this.x, this.y + 0.3, this.z, { id: I[name], n: 1, d: 0 });
      if (e) { const dx = o.x - this.x, dy = o.y + 1.2 - this.y, dz = o.z - this.z, d = Math.hypot(dx, dy, dz) || 1; e.vx = dx * 0.1; e.vy = dy * 0.1 + Math.sqrt(d) * 0.08; e.vz = dz * 0.1; e.pickupDelay = 0; }
      g.spawnXP(w, o.x, o.y + 0.5, o.z, randInt(1, 6));
      if (o.damageHeld) o.damageHeld(1);
    } else if (o && o.damageHeld && this.onGround) o.damageHeld(1);
    g.audio.play('throw', { pitch: 1.2, vol: 0.4 });
  }
}
// ---------------------------------------------------------------- falling block & TNT
class FallingBlock extends Entity {
  constructor(x, y, z, v) { super('falling', x, y, z); this.v = v; this.w = 0.98; this.h = 0.98; this.gravity = 0.04; }
  tick() {
    this.savePrev(); this.age++;
    this.physics();
    const w = this.world;
    if (this.onGround || this.age > 600) {
      this.removed = true;
      const x = Math.floor(this.x), y = Math.floor(this.y + 0.5), z = Math.floor(this.z);
      const cur = w.getId(x, y, z);
      if ((cur === 0 || REPL[cur]) && y < CH) { w.setBlock(x, y, z, this.v, 1); w.game.audio.play('place', { mat: BLOCKS[this.v & 4095].snd, x, y, z }); }
      else this.game.dropItem(w, this.x, this.y, this.z, { id: this.v & 4095, n: 1, d: 0 });
      for (const e of w.entitiesInBox(this.x - 0.5, this.y, this.z - 0.5, this.x + 0.5, this.y + 1, this.z + 0.5, this)) if (e.hurt && (this.v & 4095) === B.gravel && false) e.hurt(2, { type: 'block' });
    }
  }
}
class PrimedTNT extends Entity {
  constructor(x, y, z, fuse) { super('tnt', x, y, z); this.fuse = fuse; this.w = 0.98; this.h = 0.98; this.gravity = 0.04; this.vy = 0.2; const a = Math.random() * TAU; this.vx = Math.cos(a) * 0.02; this.vz = Math.sin(a) * 0.02; }
  tick() {
    this.savePrev(); this.age++;
    this.physics();
    if (this.onGround) { this.vx *= 0.7; this.vz *= 0.7; this.vy *= -0.5; }
    if (--this.fuse <= 0) { this.removed = true; explode(this.world, this.x, this.y + 0.49, this.z, 4, false, this); }
    else if ((this.age & 3) === 0) this.game.particles.spawn('p_smoke', this.x, this.y + 1, this.z, { vy: 0.03, life: 20, size: 0.3, color: [0.6, 0.6, 0.6] });
  }
}
