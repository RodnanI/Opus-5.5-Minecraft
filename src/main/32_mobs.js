// ============================================================================
//  Mobs: definitions, AI, pathfinding, spawning, animation
// ============================================================================
const MOB_DEFS = {
  pig: { hp: 10, w: 0.9, h: 0.9, speed: 0.1, model: 'pig', passive: true, drops: [['porkchop', 1, 3]], food: ['carrot', 'potato'], snd: 'pig', xp: [1, 3], persistent: true, cooked: 'cooked_porkchop' },
  cow: { hp: 10, w: 0.9, h: 1.4, speed: 0.09, model: 'cow', passive: true, drops: [['beef', 1, 3], ['leather', 0, 2]], food: ['wheat'], snd: 'cow', xp: [1, 3], persistent: true, cooked: 'cooked_beef' },
  sheep: { hp: 8, w: 0.9, h: 1.3, speed: 0.1, model: 'sheep', passive: true, drops: [['mutton', 1, 2]], food: ['wheat'], snd: 'sheep', xp: [1, 3], persistent: true, cooked: 'cooked_mutton' },
  chicken: { hp: 4, w: 0.4, h: 0.7, speed: 0.1, model: 'chicken', passive: true, drops: [['chicken', 1, 1], ['feather', 0, 2]], food: ['wheat_seeds'], snd: 'chicken', xp: [1, 3], persistent: true, cooked: 'cooked_chicken' },
  villager: { hp: 20, w: 0.6, h: 1.95, speed: 0.1, model: 'villager', passive: true, villager: true, drops: [], snd: 'villager', persistent: true },
  zombie: { hp: 20, w: 0.6, h: 1.95, speed: 0.115, model: 'zombie', hostile: true, attack: 3, drops: [['rotten_flesh', 0, 2]], rare: [['iron_ingot', 0.025], ['carrot', 0.025], ['potato', 0.025]], snd: 'zombie', burns: true, xp: [5, 5], follow: 35 },
  skeleton: { hp: 20, w: 0.6, h: 1.99, speed: 0.125, model: 'skeleton', hostile: true, ranged: 'arrow', drops: [['bone', 0, 2], ['arrow', 0, 2]], snd: 'skeleton', burns: true, xp: [5, 5], follow: 16, holds: 'bow' },
  spider: { hp: 16, w: 1.3, h: 0.9, speed: 0.15, model: 'spider', hostile: true, dayNeutral: true, attack: 2, climbs: true, drops: [['string', 0, 2]], snd: 'spider', xp: [5, 5], follow: 16 },
  boomcap: { hp: 20, w: 0.7, h: 1.5, speed: 0.11, model: 'boomcap', hostile: true, exploder: true, drops: [['gunpowder', 0, 2]], snd: 'boomcap', xp: [5, 5], follow: 16 },
  witch: { hp: 26, w: 0.6, h: 1.95, speed: 0.11, model: 'witch', hostile: true, ranged: 'hex', drops: [['glowstone_dust', 0, 2], ['redstone', 0, 2], ['sugar', 0, 2], ['stick', 0, 2]], snd: 'witch', xp: [5, 5], follow: 16 },
  imp: { hp: 10, w: 0.6, h: 1.3, speed: 0.14, model: 'imp', hostile: true, flying: true, ranged: 'fireball', fireImmune: true, drops: [['ember_rod', 0, 1], ['glowstone_dust', 0, 2]], snd: 'imp', xp: [10, 10], follow: 32 },
  cinder_slime: { hp: 16, w: 1.0, h: 1.0, speed: 0.2, model: 'cinder_slime', hostile: true, bouncer: true, fireImmune: true, attack: 4, drops: [['magma_cream', 0, 1]], snd: 'slime', xp: [1, 4], follow: 16 },
  ashen_skeleton: { hp: 20, w: 0.7, h: 2.3, speed: 0.125, model: 'ashen_skeleton', scale: 1.15, hostile: true, attack: 6, fireImmune: true, drops: [['coal', 0, 1], ['bone', 0, 2]], rare: [['ember_rod', 0.05]], holds: 'stone_sword', snd: 'skeleton', xp: [5, 5], follow: 16 },
  ghoul: { hp: 20, w: 0.6, h: 1.95, speed: 0.115, model: 'ghoul', neutral: true, attack: 5, fireImmune: true, drops: [['rotten_flesh', 0, 1], ['gold_nugget', 0, 1]], rare: [['gold_ingot', 0.025]], holds: 'golden_sword', snd: 'ghoul', xp: [5, 5], follow: 35 },
  sentinel: { hp: 100, w: 1.4, h: 2.7, speed: 0.1, model: 'sentinel', defender: true, attack: 11, drops: [['iron_ingot', 3, 5], ['poppy', 0, 2]], snd: 'sentinel', persistent: true, heavy: true },
};
const PROF_COLORS = { farmer: 0xC8A060, librarian: 0xE8E4D8, smith: 0x4A4A4E, cleric: 0x7A3A9A, butcher: 0xE8E8E8, shepherd: 0x8E6A4A, fletcher: 0x5A8A3A, none: 0x6A8A4A };
const SHEEP_COLORS = [[0, 81], [7, 5], [8, 5], [15, 5], [12, 3], [6, 1]];
class Mob extends Entity {
  constructor(kind, x, y, z, data) {
    super(kind, x, y, z);
    const d = this.def = MOB_DEFS[kind];
    this.data = data || {};
    if (kind === 'cinder_slime') { const s = this.data.size || [1, 2, 4][randInt(0, 2)]; this.data.size = s; this.size = s; }
    const sc = (this.data.baby ? 0.5 : 1) * (this.size ? this.size * 0.5 : 1);
    this.w = d.w * sc; this.h = d.h * sc;
    this.maxHealth = this.size ? this.size * this.size : d.hp; this.health = this.maxHealth;
    this.stepH = 0.6; this.isMob = true;
    this.bodyYaw = this.yaw = Math.random() * TAU; this.headYaw = this.yaw;
    this.hurtTime = 0; this.deathTime = 0; this.dead = false; this.invul = 0;
    this.target = null; this.path = null; this.pathIdx = 0; this.goal = null;
    this.aiT = randInt(0, 40); this.walkPhase = 0; this.walkAmt = 0; this.attackCd = 0; this.swing = 0;
    this.persistent = !!(d.persistent || this.data.persistent);
    this.fireImmune = !!d.fireImmune;
    if (kind === 'sheep' && this.data.color === undefined) this.data.color = weightedPick(SHEEP_COLORS, Math.random());
    if (kind === 'villager' && !this.data.prof) this.data.prof = ['farmer', 'librarian', 'smith', 'cleric', 'butcher', 'shepherd', 'fletcher'][randInt(0, 6)];
    if (this.data.baby) this.growT = this.data.growT || 24000;
    this.panic = 0; this.love = 0; this.breedCd = 0; this.fuse = 0; this.anger = 0; this.eggT = randInt(6000, 12000);
    this.home = null; this.jumpT = 0; this.shootT = randInt(20, 60);
    this.lastHurtBy = null; this.idleSnd = randInt(80, 400);
  }
  get hostileNow() {
    const d = this.def;
    if (d.neutral) return this.anger > 0;
    if (d.dayNeutral) return this.anger > 0 || this.game.skyFactor() < 0.5 || this.world.skyAt(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z)) < 8;
    return !!d.hostile;
  }
  serialize() { return { type: this.type, x: this.x, y: this.y, z: this.z, data: this.data, hp: this.health, yaw: this.yaw }; }
  heldItem() { return this.def.holds ? I[this.def.holds] : 0; }
  hurt(amount, src) {
    if (this.dead || amount <= 0 && !(src && src.type === 'thrown')) return false;
    if (this.invul > 0) { if (amount <= this.lastDmg) return false; amount -= this.lastDmg; }
    if (src && (src.type === 'fire' || src.type === 'lava') && this.fireImmune) return false;
    if (this.type === 'sentinel' && src && src.type === 'fall') return false;
    this.health -= amount; this.lastDmg = amount; this.invul = 10; this.hurtTime = 10;
    const s = src && src.source;
    if (s && s !== this) {
      this.lastHurtBy = s;
      const dx = this.x - s.x, dz = this.z - s.z, l = Math.hypot(dx, dz) || 1;
      const kb = this.def.heavy ? 0.1 : (src.kb || 0.4);
      this.vx = dx / l * kb; this.vz = dz / l * kb; this.vy = Math.min(0.4, this.vy + 0.36);
      if (this.def.passive && !this.def.villager) this.panic = 100;
      if (this.def.villager) this.panic = 80;
      if ((this.def.hostile || this.def.neutral || this.def.defender) && s.health !== undefined && s !== this) { this.target = s; this.anger = 600; }
      if (this.def.neutral) for (const o of this.world.entitiesNear(this.x, this.y, this.z, 16, (e) => e.type === this.type)) { o.anger = 600; o.target = s; }
      if (s.isPlayer) this.killedByPlayer = 100;
    }
    if (this.health <= 0) this.die(src);
    else this.game.audio.play(this.def.snd + '_hurt', { x: this.x, y: this.y, z: this.z });
    return true;
  }
  die(src) {
    this.dead = true; this.deathTime = 0; this.health = 0;
    const g = this.game;
    g.audio.play(this.def.snd + '_death', { x: this.x, y: this.y, z: this.z });
    if (this.type === 'cinder_slime' && this.size > 1) {
      const n = randInt(2, 4);
      for (let i = 0; i < n; i++) g.spawnMob('cinder_slime', this.x + (Math.random() - 0.5) * this.w, this.y + 0.2, this.z + (Math.random() - 0.5) * this.w, { size: this.size / 2 });
    }
    if (this.data.baby) return;
    const burning = this.fireTicks > 0;
    for (const [n, a, b] of this.def.drops) {
      if (this.type === 'cinder_slime' && this.size > 1) break;
      let name = n;
      if (burning && this.def.cooked && (n === this.def.drops[0][0])) name = this.def.cooked;
      const c = randInt(a, b); if (c > 0) g.dropItem(this.world, this.x, this.y + 0.5, this.z, { id: I[name], n: c, d: 0 });
    }
    if (this.type === 'sheep' && !this.data.sheared) g.dropItem(this.world, this.x, this.y + 0.5, this.z, { id: B[DYES[this.data.color] + '_wool'], n: 1, d: 0 });
    if (this.def.rare && this.killedByPlayer) for (const [n, p] of this.def.rare) if (Math.random() < p) g.dropItem(this.world, this.x, this.y + 0.5, this.z, { id: I[n], n: 1, d: 0 });
    if (this.killedByPlayer && this.def.xp) g.spawnXP(this.world, this.x, this.y + 0.5, this.z, randInt(this.def.xp[0], this.def.xp[1]));
    if (this.type === 'sentinel' || this.type === 'villager') { }
  }
  tick() {
    this.savePrev(); this.age++;
    if (this.dead) { this.deathTime++; this.vx *= 0.5; this.vz *= 0.5; this.physics(); if (this.deathTime >= 20) { this.removed = true; this.game.particles.burst(this.x, this.y + this.h / 2, this.z, 'p_smoke', 10, [0.9, 0.9, 0.9]); } return; }
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.invul > 0) this.invul--;
    if (this.attackCd > 0) this.attackCd--;
    if (this.swing > 0) this.swing--;
    if (this.killedByPlayer > 0) this.killedByPlayer--;
    if (this.anger > 0) this.anger--;
    if (this.growT > 0 && --this.growT <= 0) { this.data.baby = false; this.w = this.def.w; this.h = this.def.h; }
    const w = this.world, g = this.game;
    // burning
    if (this.def.burns && g.skyFactor() > 0.6 && !this.inWater && (this.age & 7) === 0) {
      const bx = Math.floor(this.x), by = Math.floor(this.y + this.h - 0.2), bz = Math.floor(this.z);
      if (w.skyAt(bx, by, bz) >= 15 && !w.isRainingAt(bx, by, bz) && w.canSeeSky(bx, by, bz)) this.fireTicks = Math.max(this.fireTicks, 160);
    }
    if (this.fireTicks > 0) { this.fireTicks--; if (!this.fireImmune && this.fireTicks % 20 === 0) this.hurt(1, { type: 'fire' }); if ((this.age & 3) === 0) g.particles.spawn('p_flame', this.x + (Math.random() - 0.5) * this.w, this.y + Math.random() * this.h, this.z + (Math.random() - 0.5) * this.w, { vy: 0.02, life: 10, size: 0.3 }); }
    if (this.inLava && !this.fireImmune && (this.age % 10) === 0) this.hurt(4, { type: 'lava' });
    // contact damage (cactus/magma)
    if ((this.age % 10) === 0) { const below = w.getId(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z)); if (below === B.magma_block && !this.fireImmune) this.hurt(1, { type: 'fire' }); }
    if (this.dead) return;
    this.ai();
    // idle sounds
    if (--this.idleSnd <= 0) { this.idleSnd = randInt(160, 500); const p = g.player; if (p && this.dist2(p.x, p.y, p.z) < 400) g.audio.play(this.def.snd, { x: this.x, y: this.y, z: this.z }); }
    // physics
    if (this.def.flying) {
      moveEntity(w, this, this.vx, this.vy, this.vz);
      this.vx *= 0.91; this.vy *= 0.91; this.vz *= 0.91;
      this.updateFluids();
    } else {
      if (this.inWater || this.inLava) { if (this.def.heavy) this.vy -= 0.02; else this.vy += 0.045; }
      if (this.def.climbs && this.collidedH) this.vy = 0.2;
      if (this.type === 'chicken' && !this.onGround && this.vy < 0) this.vy *= 0.6;
      this.physics();
    }
    // walk anim
    const sp = Math.hypot(this.x - this.lx, this.z - this.lz);
    this.walkAmt += (Math.min(1, sp * 6) - this.walkAmt) * 0.3;
    this.walkPhase += sp * 3.2;
    // push apart
    if ((this.age & 1) === 0) for (const o of w.entitiesNear(this.x, this.y, this.z, 1.5, (e) => e.isMob && e !== this && !e.dead)) {
      const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), min = (this.w + o.w) / 2;
      if (d < min && d > 0.001) { const f = (min - d) * 0.15; this.vx += dx / d * f; this.vz += dz / d * f; }
    }
    // despawn
    const p = g.player;
    if (!this.persistent && p) {
      const d2 = this.dist2(p.x, p.y, p.z);
      if (d2 > 128 * 128) this.removed = true;
      else if (d2 > 32 * 32 && Math.random() < 1 / 800 && !this.def.passive) this.removed = true;
    }
  }
  canSee(e) {
    const w = this.world;
    return !rayBlocked(w, this.x, this.y + this.h * 0.85, this.z, e.x, e.y + (e.eyeH || e.h * 0.85), e.z);
  }
  lookAt(x, y, z, rate) {
    const dx = x - this.x, dz = z - this.z, dy = y - (this.y + this.h * 0.85);
    const ty = Math.atan2(dx, -dz);
    this.headYaw += angleDiff(this.headYaw, ty) * (rate || 0.3);
    this.pitch += (Math.atan2(dy, Math.hypot(dx, dz)) - this.pitch) * 0.3;
  }
  moveToward(x, z, speed) {
    const dx = x - this.x, dz = z - this.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const ty = Math.atan2(dx, -dz);
    this.yaw += angleDiff(this.yaw, ty) * 0.35;
    const f = this.onGround ? 0.25 : (this.inWater ? 0.08 : 0.06);
    const s = speed * (this.slowTicks > 0 ? 0.5 : 1);
    this.vx += (dx / d * s - this.vx) * f; this.vz += (dz / d * s - this.vz) * f;
    this.bodyYaw += angleDiff(this.bodyYaw, this.yaw) * 0.3;
  }
  followPath(speed) {
    if (!this.path || this.pathIdx >= this.path.length) { this.path = null; return false; }
    const n = this.path[this.pathIdx];
    const tx = n[0] + 0.5, tz = n[2] + 0.5;
    const dx = tx - this.x, dz = tz - this.z;
    if (dx * dx + dz * dz < 0.12 && Math.abs(n[1] - this.y) < 1.2) { this.pathIdx++; return true; }
    this.moveToward(tx, tz, speed);
    if (this.onGround && (n[1] > this.y + 0.5 || this.collidedH)) this.vy = 0.42;
    if (this.inWater && n[1] >= this.y) this.vy = Math.max(this.vy, 0.06);
    if (++this.pathT > 100) { this.path = null; }
    return true;
  }
  navigate(x, y, z, maxN) {
    const p = findPath(this.world, this, Math.floor(x), Math.floor(y), Math.floor(z), maxN || 240);
    this.path = p; this.pathIdx = 1; this.pathT = 0;
    return !!p;
  }
  ai() {
    const g = this.game, w = this.world, d = this.def, p = g.player;
    this.aiT++;
    if (this.slowTicks > 0) this.slowTicks--;
    const hostile = this.hostileNow && g.difficulty > 0;
    // --- targeting
    if (this.aiT % 10 === 0) {
      if (d.defender) {
        if (!this.target || this.target.dead || this.target.removed) {
          this.target = null;
          const cands = w.entitiesNear(this.x, this.y, this.z, 16, (e) => e.isMob && !e.dead && e.def.hostile && e.type !== 'boomcap');
          if (cands.length) this.target = cands[0];
        }
      } else if (hostile && p && !p.dead && !p.creative && !p.spectator) {
        const fr = d.follow || 16;
        const d2 = this.dist2(p.x, p.y, p.z);
        if (d2 < fr * fr && (this.target === p || this.canSee(p))) this.target = p;
        else if (d2 > fr * fr * 1.5) this.target = null;
      } else if (this.target && this.target.isPlayer && (!hostile || this.target.creative || this.target.dead)) this.target = null;
      if (this.target && (this.target.dead || this.target.removed)) this.target = null;
    }
    const t = this.target;
    // --- flying (imp)
    if (d.flying) { this.aiFly(t); return; }
    if (d.bouncer) { this.aiBounce(t); return; }
    // --- panic
    if (this.panic > 0) {
      this.panic--;
      if (!this.path || this.aiT % 30 === 0) { const a = Math.random() * TAU; this.navigate(this.x + Math.cos(a) * 8, this.y, this.z + Math.sin(a) * 8, 120); }
      this.followPath(d.speed * 1.9);
      return;
    }
    if (t) {
      const dx = t.x - this.x, dz = t.z - this.z, dist = Math.hypot(dx, dz), dy = t.y - this.y;
      this.lookAt(t.x, t.y + (t.eyeH || t.h * 0.85), t.z, 0.5);
      if (d.exploder) { this.aiExploder(t, dist); return; }
      if (d.ranged) {
        const seen = this.canSee(t);
        if (dist > 12 || !seen) { if (!this.path || this.aiT % 20 === 0) this.navigate(t.x, t.y, t.z); this.followPath(d.speed); }
        else if (dist < 5) { this.moveToward(this.x - dx, this.z - dz, d.speed * 0.8); }
        else { this.vx *= 0.8; this.vz *= 0.8; if (this.aiT % 60 < 30) { const sx = -dz / dist, sz = dx / dist; this.moveToward(this.x + sx * 2, this.z + sz * 2, d.speed * 0.6); } }
        this.yaw = this.bodyYaw = this.headYaw;
        if (seen && dist < 16 && --this.shootT <= 0) { this.shootT = d.ranged === 'hex' ? randInt(40, 70) : randInt(30, 55); this.shoot(t); }
        return;
      }
      // melee
      const reach = this.w / 2 + t.w / 2 + 0.8;
      if (dist < reach && Math.abs(dy) < 2) {
        this.vx *= 0.6; this.vz *= 0.6;
        this.yaw = this.bodyYaw = this.headYaw;
        if (this.attackCd <= 0) {
          this.attackCd = 20; this.swing = 8;
          let dmg = d.attack || 2;
          if (g.difficulty === 1) dmg = Math.max(1, Math.round(dmg * 0.5 + 1)); else if (g.difficulty === 3) dmg = Math.round(dmg * 1.5);
          if (d.defender) dmg = randInt(7, 21);
          if (t.hurt(dmg, { type: 'mob', source: this, kb: d.defender ? 0.9 : 0.4 })) { if (d.defender) t.vy += 0.5; }
        }
      } else {
        if (!this.path || this.aiT % 15 === 0 || (this.pathTarget && Math.hypot(this.pathTarget[0] - t.x, this.pathTarget[2] - t.z) > 2)) { this.navigate(t.x, t.y, t.z); this.pathTarget = [t.x, t.y, t.z]; }
        if (!this.followPath(d.speed * (d.hostile || d.neutral ? 1.25 : 1))) this.moveToward(t.x, t.z, d.speed);
        if (d.climbs && this.collidedH) this.vy = 0.2;
        if (this.type === 'spider' && dist < 4 && dist > 2 && this.onGround && Math.random() < 0.1) { this.vy = 0.4; this.vx = dx / dist * 0.35; this.vz = dz / dist * 0.35; }
      }
      return;
    }
    // --- passive behaviors
    if (d.passive) {
      if (this.love > 0) this.love--;
      if (this.breedCd > 0) this.breedCd--;
      // breeding
      if (this.love > 0 && !this.data.baby) {
        const mate = w.entitiesNear(this.x, this.y, this.z, 8, (e) => e.type === this.type && e !== this && e.love > 0 && !e.data.baby && !e.dead)[0];
        if (mate) {
          this.moveToward(mate.x, mate.z, d.speed);
          if (this.dist2(mate.x, mate.y, mate.z) < 2.5) {
            this.love = 0; mate.love = 0; this.breedCd = mate.breedCd = 6000;
            g.spawnMob(this.type, (this.x + mate.x) / 2, this.y, (this.z + mate.z) / 2, { baby: true, color: this.data.color });
            g.particles.burst(this.x, this.y + this.h, this.z, 'p_heart', 5, [1, 1, 1]);
            g.spawnXP(w, this.x, this.y + 0.5, this.z, randInt(1, 7));
          }
          return;
        }
      }
      // tempt
      if (p && d.food && !p.dead && this.dist2(p.x, p.y, p.z) < 64) {
        const held = ITEMS[p.heldId()];
        if (held && d.food.includes(held.name)) { this.lookAt(p.x, p.y + 1.6, p.z); if (this.dist2(p.x, p.y, p.z) > 4) this.moveToward(p.x, p.z, d.speed * 1.2); else { this.vx *= 0.7; this.vz *= 0.7; } return; }
      }
      // chicken eggs
      if (this.type === 'chicken' && !this.data.baby && --this.eggT <= 0) { this.eggT = randInt(6000, 12000); g.dropItem(w, this.x, this.y + 0.3, this.z, { id: I.egg, n: 1, d: 0 }); g.audio.play('pop', { x: this.x, y: this.y, z: this.z, vol: 0.4 }); }
      // sheep eat grass
      if (this.type === 'sheep' && this.data.sheared && Math.random() < 0.002) {
        const bx = Math.floor(this.x), by = Math.floor(this.y - 0.5), bz = Math.floor(this.z);
        if (w.getId(bx, by, bz) === B.grass_block) { w.setBlock(bx, by, bz, B.dirt, 1); this.data.sheared = false; } else if (w.getId(bx, by + 1, bz) === B.tall_grass) { w.setBlock(bx, by + 1, bz, 0, 1); this.data.sheared = false; }
      }
      // villagers flee zombies
      if (d.villager && this.aiT % 20 === 0) {
        const z = w.entitiesNear(this.x, this.y, this.z, 8, (e) => (e.type === 'zombie' || e.type === 'ghoul') && !e.dead)[0];
        if (z) { this.navigate(this.x + (this.x - z.x) * 2, this.y, this.z + (this.z - z.z) * 2, 100); this.panic = 40; }
      }
      // look at player
      if (p && this.dist2(p.x, p.y, p.z) < 36 && Math.random() < 0.02) this.lookTimer = 60;
      if (this.lookTimer > 0 && p) { this.lookTimer--; this.lookAt(p.x, p.y + 1.6, p.z, 0.2); }
    }
    // --- wander
    if (this.path) { this.followPath(d.speed * (d.villager ? 1 : 0.8)); return; }
    this.vx *= 0.8; this.vz *= 0.8;
    const wanderChance = d.hostile ? 0.012 : 0.008;
    if (Math.random() < wanderChance) {
      const a = Math.random() * TAU, r = 3 + Math.random() * 7;
      let tx = this.x + Math.cos(a) * r, tz = this.z + Math.sin(a) * r;
      if (this.home) { const hx = this.home[0], hz = this.home[2]; if (Math.hypot(tx - hx, tz - hz) > 24) { tx = hx + (Math.random() - 0.5) * 16; tz = hz + (Math.random() - 0.5) * 16; } }
      this.navigate(tx, this.y, tz, 150);
    }
    this.headYaw += angleDiff(this.headYaw, this.bodyYaw) * 0.1;
    this.pitch *= 0.9;
  }
  aiExploder(t, dist) {
    const g = this.game;
    if (dist < 3.2 && this.canSee(t)) {
      if (this.fuse === 0) g.audio.play('fuse', { x: this.x, y: this.y, z: this.z });
      this.fuse++; this.vx *= 0.5; this.vz *= 0.5;
      if (this.fuse >= 30) {
        this.removed = true; this.dead = true;
        explode(this.world, this.x, this.y + 0.5, this.z, g.difficulty === 3 ? 3.5 : 3, false, this);
      }
    } else {
      if (this.fuse > 0) this.fuse = Math.max(0, this.fuse - 1);
      if (dist > 7) this.fuse = 0;
      if (!this.path || this.aiT % 15 === 0) this.navigate(t.x, t.y, t.z);
      if (!this.followPath(this.def.speed * 1.2)) this.moveToward(t.x, t.z, this.def.speed);
    }
  }
  aiFly(t) {
    const d = this.def;
    this.vy += Math.sin(this.age * 0.07) * 0.004;
    if (t) {
      const tx = t.x, ty = t.y + 3.5, tz = t.z;
      const dx = tx - this.x, dy = ty - this.y, dz = tz - this.z, dist = Math.hypot(dx, dz);
      this.lookAt(t.x, t.y + 1, t.z, 0.5);
      this.yaw = this.bodyYaw = this.headYaw;
      const want = dist > 10 ? 1 : dist < 5 ? -0.6 : 0;
      if (dist > 0.1) { this.vx += dx / dist * d.speed * want * 0.15; this.vz += dz / dist * d.speed * want * 0.15; }
      this.vy += clamp(dy, -1, 1) * 0.012;
      if (this.collidedH) this.vy += 0.05;
      if (this.canSee(t) && --this.shootT <= 0 && dist < 28) { this.shootT = randInt(40, 80); this.shoot(t); }
    } else {
      if (!this.wanderGoal || Math.random() < 0.01) this.wanderGoal = [this.x + (Math.random() - 0.5) * 16, this.y + (Math.random() - 0.5) * 6, this.z + (Math.random() - 0.5) * 16];
      const [gx, gy, gz] = this.wanderGoal;
      const dx = gx - this.x, dy = gy - this.y, dz = gz - this.z, l = Math.hypot(dx, dy, dz) || 1;
      this.vx += dx / l * 0.01; this.vy += dy / l * 0.008; this.vz += dz / l * 0.01;
      if (this.collidedH) this.wanderGoal = null;
      this.yaw += angleDiff(this.yaw, Math.atan2(this.vx, -this.vz)) * 0.1; this.bodyYaw = this.headYaw = this.yaw;
    }
  }
  aiBounce(t) {
    const g = this.game;
    if (this.onGround) {
      this.vx *= 0.5; this.vz *= 0.5;
      if (--this.jumpT <= 0) {
        this.jumpT = randInt(15, 40);
        let dx, dz;
        if (t) { dx = t.x - this.x; dz = t.z - this.z; } else { const a = Math.random() * TAU; dx = Math.cos(a); dz = Math.sin(a); }
        const l = Math.hypot(dx, dz) || 1;
        this.vx = dx / l * 0.22 * (t ? 1.3 : 0.6); this.vz = dz / l * 0.22 * (t ? 1.3 : 0.6); this.vy = 0.42 + this.size * 0.06;
        this.yaw = this.bodyYaw = this.headYaw = Math.atan2(dx, -dz);
        this.squish = 1;
      }
    }
    if (this.squish > 0) this.squish -= 0.1;
    if (t && this.dist2(t.x, t.y, t.z) < Math.pow(this.w * 0.6 + 0.6, 2) && this.attackCd <= 0 && this.size > 1) { this.attackCd = 20; t.hurt(this.size + 1, { type: 'mob', source: this }); }
    void g;
  }
  shoot(t) {
    const g = this.game, w = this.world;
    const sx = this.x, sy = this.y + this.h * 0.8, sz = this.z;
    const tx = t.x, ty = t.y + (t.h || 1.8) * 0.5, tz = t.z;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz, dist = Math.hypot(dx, dz);
    this.swing = 10;
    if (this.def.ranged === 'arrow') {
      const v = 1.6, inacc = [0, 0.1, 0.06, 0.03][g.difficulty] || 0.06;
      let vx = dx / dist, vz = dz / dist, vy = (dy + dist * 0.2) / dist;
      const l = Math.hypot(vx, vy, vz); vx /= l; vy /= l; vz /= l;
      vx += (Math.random() - 0.5) * inacc; vy += (Math.random() - 0.5) * inacc; vz += (Math.random() - 0.5) * inacc;
      const a = new Arrow(sx, sy, sz, vx * v, vy * v, vz * v, this, g.difficulty === 3 ? 3 : 2);
      w.addEntity(a); g.audio.play('bow', { x: sx, y: sy, z: sz });
    } else if (this.def.ranged === 'hex') {
      const v = 0.8, l = Math.hypot(dx, dy + dist * 0.25, dz);
      w.addEntity(new Thrown('hex', sx, sy, sz, dx / l * v, (dy + dist * 0.25) / l * v, dz / l * v, this));
      g.audio.play('witch', { x: sx, y: sy, z: sz });
    } else if (this.def.ranged === 'fireball') {
      const l = Math.hypot(dx, dy, dz), v = 0.9;
      w.addEntity(new Fireball(sx, sy, sz, dx / l * v, dy / l * v, dz / l * v, this, 1));
      g.audio.play('fireball', { x: sx, y: sy, z: sz });
    }
  }
  interact(player, stack) {
    const g = this.game, held = stack ? ITEMS[stack.id] : null, d = this.def;
    if (d.villager) { if (!this.data.baby) g.ui.openTrade(this); return true; }
    if (held && d.food && d.food.includes(held.name)) {
      if (this.data.baby) { this.growT = Math.max(0, this.growT - 2400); player.consumeHeld(1); g.particles.burst(this.x, this.y + this.h, this.z, 'p_happy', 5, [1, 1, 1]); return true; }
      if (this.breedCd <= 0 && this.love <= 0) { this.love = 600; player.consumeHeld(1); g.particles.burst(this.x, this.y + this.h, this.z, 'p_heart', 4, [1, 1, 1]); return true; }
    }
    if (held && held.name === 'shears' && this.type === 'sheep' && !this.data.sheared && !this.data.baby) {
      this.data.sheared = true; const n = randInt(1, 3);
      for (let i = 0; i < n; i++) g.dropItem(this.world, this.x, this.y + 1, this.z, { id: B[DYES[this.data.color] + '_wool'], n: 1, d: 0 });
      g.audio.play('shear', { x: this.x, y: this.y, z: this.z }); player.damageHeld(1); return true;
    }
    if (held && held.name === 'bucket' && this.type === 'cow' && !this.data.baby) { player.replaceHeld({ id: I.milk_bucket, n: 1, d: 0 }); g.audio.play('milk', {}); return true; }
    if (held && held.dye !== undefined && this.type === 'sheep' && !this.data.sheared) { this.data.color = held.dye; player.consumeHeld(1); return true; }
    return false;
  }
}
// ---------------------------------------------------------------- pathfinding (A*)
function passable(w, x, y, z) { const v = w.getBlock(x, y, z), id = v & 4095; if (!SOLID[id]) return !(id === B.lava || id === B.fire || id === B.cactus || id === B.cobweb); if (SHAPE[id] === R_DOOR || SHAPE[id] === R_GATE || SHAPE[id] === R_TRAPDOOR) return ((w.getBlock(x, y, z) >> 12) & 4) !== 0 || SHAPE[id] === R_DOOR; if (SHAPE[id] === R_CARPET || SHAPE[id] === R_PLATE || SHAPE[id] === R_SNOW) return true; return false; }
function standable(w, x, y, z) { const v = w.getBlock(x, y - 1, z), id = v & 4095; if (id === B.lava || id === B.fire || id === B.cactus || id === B.magma_block) return false; return (SOLID[id] && SHAPE[id] !== R_FENCE) || id === B.water || WLOG[id] || SHAPE[id] === R_LADDER; }
function findPath(w, mob, tx, ty, tz, maxN) {
  const sx = Math.floor(mob.x), sy = Math.floor(mob.y + 0.2), sz = Math.floor(mob.z);
  const hh = Math.max(1, Math.ceil(mob.h - 0.05)), climb = !!mob.def.climbs;
  const fits = (x, y, z) => { for (let i = 0; i < hh; i++) if (!passable(w, x, y + i, z)) return false; if (mob.w > 1) { for (let i = 0; i < hh; i++) if (!passable(w, x + 1, y + i, z) || !passable(w, x, y + i, z + 1)) return false; } return true; };
  const key = (x, y, z) => ((x - sx + 512) * 1024 + (z - sz + 512)) * 256 + y;
  const open = [], nodes = new Map();
  const H = (x, y, z) => Math.abs(x - tx) + Math.abs(y - ty) * 1.5 + Math.abs(z - tz);
  const start = { x: sx, y: sy, z: sz, g: 0, f: H(sx, sy, sz), p: null, closed: false };
  nodes.set(key(sx, sy, sz), start); open.push(start);
  let best = start, n = 0;
  while (open.length && n++ < maxN) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const c = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    c.closed = true;
    const hd = H(c.x, c.y, c.z);
    if (hd < H(best.x, best.y, best.z)) best = c;
    if (Math.abs(c.x - tx) <= 1 && Math.abs(c.z - tz) <= 1 && Math.abs(c.y - ty) <= 1) { best = c; break; }
    for (let f = 0; f < 4; f++) {
      const nx = c.x + FACING_DX[f], nz = c.z + FACING_DZ[f];
      let ny = null;
      if (fits(nx, c.y, nz)) {
        if (standable(w, nx, c.y, nz)) ny = c.y;
        else { for (let dd = 1; dd <= 3; dd++) { if (!passable(w, nx, c.y - dd, nz)) break; if (standable(w, nx, c.y - dd, nz)) { ny = c.y - dd; break; } } }
      } else if (fits(nx, c.y + 1, nz) && passable(w, c.x, c.y + hh, c.z) && standable(w, nx, c.y + 1, nz)) ny = c.y + 1;
      else if (climb) { for (let dd = 1; dd <= 4; dd++) { if (!passable(w, c.x, c.y + dd + hh - 1, c.z)) break; if (fits(nx, c.y + dd, nz) && standable(w, nx, c.y + dd, nz)) { ny = c.y + dd; break; } } }
      if (ny === null) continue;
      const k = key(nx, ny, nz);
      const cost = c.g + 1 + (ny !== c.y ? 0.5 : 0) + (w.getId(nx, ny, nz) === B.water ? 2 : 0);
      let nd = nodes.get(k);
      if (!nd) { nd = { x: nx, y: ny, z: nz, g: cost, f: cost + H(nx, ny, nz), p: c, closed: false }; nodes.set(k, nd); open.push(nd); }
      else if (!nd.closed && cost < nd.g) { nd.g = cost; nd.f = cost + H(nx, ny, nz); nd.p = c; }
    }
  }
  if (best === start) return null;
  const path = [];
  for (let c = best; c; c = c.p) path.push([c.x, c.y, c.z]);
  path.reverse();
  return path;
}
// ---------------------------------------------------------------- spawning
function mobSpawnTick(g) {
  const w = g.world, p = g.player;
  if (!p || p.dead) return;
  let hostile = 0, passive = 0;
  for (const e of w.entities) if (e.isMob && !e.removed) { if (e.def.passive) passive++; else hostile++; }
  const cap = Math.min(24, 8 + EFF.renderDist * 2);
  const R = Math.min(EFF.renderDist, 6);
  for (let a = 0; a < 5; a++) {
    const cx = Math.floor(p.x / 16) + randInt(-R, R), cz = Math.floor(p.z / 16) + randInt(-R, R);
    const c = w.getChunk(cx, cz); if (!c || !c.lit) continue;
    const x = cx * 16 + randInt(0, 15), z = cz * 16 + randInt(0, 15);
    const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
    if (d2 < 24 * 24) continue;
    if (w.dim === 'nether') {
      if (hostile >= cap || g.difficulty === 0) continue;
      const y = randInt(8, 120);
      if (!mobSpaceAt(w, x, y, z, 2)) continue;
      const bio = w.biomeAt(x, z);
      const fort = (c.tags & 2) !== 0;
      const list = fort ? [['ashen_skeleton', 40], ['imp', 15], ['cinder_slime', 10], ['ghoul', 10]] : bio === BIO.SOUL_VALLEY ? [['ashen_skeleton', 20], ['imp', 15], ['ghoul', 5]] : bio === BIO.BASALT ? [['cinder_slime', 40], ['imp', 5]] : bio === BIO.CRIMSON ? [['ghoul', 40], ['cinder_slime', 5]] : bio === BIO.WARPED ? [['imp', 5], ['ghoul', 5]] : [['ghoul', 40], ['cinder_slime', 12], ['imp', 8]];
      const type = weightedPick(list, Math.random());
      if (type === 'imp' && !mobSpaceAt(w, x, y + 2, z, 2)) continue;
      const n = type === 'ghoul' ? randInt(1, 4) : 1;
      for (let i = 0; i < n; i++) { const ox = x + randInt(-2, 2), oz = z + randInt(-2, 2); if (mobSpaceAt(w, ox, y, oz, 2)) { g.spawnMob(type, ox + 0.5, y, oz + 0.5, null); hostile++; } }
      continue;
    }
    // overworld hostile
    if (hostile < cap && g.difficulty > 0) {
      const top = w.heightAt(x, z);
      const y = randInt(1, Math.max(2, top + 1));
      if (mobSpaceAt(w, x, y, z, 2) && w.blockLightAt(x, y, z) === 0 && w.lightLevel(x, y, z) <= 7) {
        const type = weightedPick([['zombie', 32], ['skeleton', 26], ['spider', 20], ['boomcap', 20], ['witch', 2]], Math.random());
        const n = type === 'witch' ? 1 : randInt(1, 3);
        for (let i = 0; i < n; i++) { const ox = x + randInt(-2, 2), oz = z + randInt(-2, 2); if (mobSpaceAt(w, ox, y, oz, type === 'spider' ? 1 : 2) && w.lightLevel(ox, y, oz) <= 7) { g.spawnMob(type, ox + 0.5, y, oz + 0.5, null); hostile++; } }
        continue;
      }
    }
    // passive (rare)
    if (passive < 10 && Math.random() < 0.02) {
      const y = w.heightAt(x, z);
      if (w.getId(x, y - 1, z) === B.grass_block && mobSpaceAt(w, x, y, z, 2) && w.skyAt(x, y, z) >= 9) {
        const bio = BIOMES[w.biomeAt(x, z)];
        if (bio.animals) { const type = bio.animals[randInt(0, bio.animals.length - 1)]; for (let i = 0; i < randInt(2, 3); i++) { const ox = x + randInt(-2, 2), oz = z + randInt(-2, 2); const oy = w.heightAt(ox, oz); if (mobSpaceAt(w, ox, oy, oz, 2)) g.spawnMob(type, ox + 0.5, oy, oz + 0.5, null); } }
      }
    }
  }
}
function mobSpaceAt(w, x, y, z, h) {
  const below = w.getBlock(x, y - 1, z), bid = below & 4095;
  if (!OPAQUE[bid] || bid === B.bedrock || bid === B.glass) return false;
  for (let i = 0; i < h; i++) { const id = w.getId(x, y + i, z); if (SOLID[id] || FLUID[id]) return false; }
  return true;
}
// ---------------------------------------------------------------- pose / animation
function poseMob(e, a, time) {
  const m = MODELS[e.def ? e.def.model : 'player'];
  const P = e._pose || (e._pose = m.parts.map(() => ({ rx: 0, ry: 0, rz: 0, s: 1 })));
  for (let i = 0; i < m.parts.length; i++) { const p = P[i], d = m.parts[i]; p.rx = d.rot[0]; p.ry = d.rot[1]; p.rz = d.rot[2]; p.s = 1; }
  const pi = m.pi;
  const set = (n, rx, ry, rz) => { const i = pi[n]; if (i === undefined) return; if (rx !== undefined) P[i].rx = rx; if (ry !== undefined) P[i].ry = ry; if (rz !== undefined) P[i].rz = rz; };
  const phase = e.walkPhase || 0, amt = e.walkAmt || 0;
  const sw = Math.sin(phase) * 1.1 * amt;
  const bodyYaw = e.bodyYaw !== undefined ? e.bodyYaw : e.yaw;
  const headRel = -angleDiff(bodyYaw, e.headYaw !== undefined ? e.headYaw : e.yaw);
  set('head', clamp(e.pitch || 0, -1.2, 1.2), clamp(headRel, -1.2, 1.2), 0);
  if (m.humanoid) {
    set('rleg', sw); set('lleg', -sw);
    const idle = Math.sin(time * 1.6) * 0.04;
    set('rarm', -sw * 0.8, 0, 0.05 + idle); set('larm', sw * 0.8, 0, -0.05 - idle);
    const t = e.type;
    if (t === 'zombie' || t === 'ghoul') { set('rarm', 1.45 + Math.sin(time * 2) * 0.05, 0, 0.1); set('larm', 1.45 - Math.sin(time * 2) * 0.05, 0, -0.1); }
    if ((t === 'skeleton' || t === 'witch') && e.target) { set('rarm', 1.4 + (e.swing || 0) * 0.05, 0.1, 0); set('larm', 1.4, -0.4, 0); }
    if (e.swing > 0) { const s = Math.sin(e.swing / 8 * Math.PI); set('rarm', 1.2 + s * 1.2 * (t === 'zombie' ? 0 : 1), -0.2 * s, 0); }
    if (e.isPlayer && e.swingAnim > 0) { const s = Math.sin(e.swingAnim * Math.PI); set('rarm', -sw * 0.8 + s * 1.6, -s * 0.4, 0); }
    if (e.sneaking) { set('rleg', sw * 0.6 - 0.3); set('lleg', -sw * 0.6 - 0.3); }
    if (e.vehicle) { set('rleg', 1.45, 0.12, 0); set('lleg', 1.45, -0.12, 0); set('rarm', 1.2, -0.22, 0); set('larm', 1.2, 0.22, 0); }
  } else if (pi.leg0 !== undefined && e.type !== 'spider' && e.type !== 'boomcap') {
    set('leg0', sw); set('leg1', -sw); set('leg2', -sw); set('leg3', sw);
  }
  switch (e.type) {
    case 'chicken': { const f = e.onGround ? 0 : Math.sin(time * 30) * 1.2 + 1.2; set('rwing', 0, 0, -f); set('lwing', 0, 0, f); set('rleg', sw); set('lleg', -sw); break; }
    case 'spider': for (let i = 0; i < 8; i++) { const side = i < 4 ? 1 : -1, k = i % 4; const ph = phase + (k % 2) * Math.PI; set('leg' + i, 0, side * (-0.6 + k * 0.4) + Math.sin(ph) * 0.35 * amt, side * (-0.55 - Math.abs(Math.cos(ph)) * 0.25 * amt)); } break;
    case 'boomcap': { for (let i = 0; i < 4; i++) set('leg' + i, (i === 0 || i === 3 ? sw : -sw)); set('cap', Math.sin(time * 2) * 0.03, 0, Math.sin(phase) * 0.05 * amt); break; }
    case 'imp': { const f = Math.sin(time * 14) * 0.7; set('rwing', 0, -0.4 + f, 0); set('lwing', 0, 0.4 - f, 0); set('tail', 0.4 + Math.sin(time * 3) * 0.2); set('rarm', 0.3 + (e.swing || 0) * 0.12); set('larm', 0.3); break; }
    case 'sentinel': set('rarm', -sw * 0.6 - (e.swing > 0 ? Math.sin(e.swing / 8 * Math.PI) * 1.8 : 0)); set('larm', sw * 0.6 - (e.swing > 0 ? Math.sin(e.swing / 8 * Math.PI) * 1.8 : 0)); break;
  }
  return P;
}
function partMatrices(m, P, out) {
  for (let i = 0; i < m.parts.length; i++) {
    const d = m.parts[i], p = P[i];
    const M = out[i] || (out[i] = M4.create());
    if (d.parent >= 0) M.set(out[d.parent]); else M4.identity(M);
    M4.translate(M, d.pivot[0], d.pivot[1], d.pivot[2]);
    if (p.ry) M4.rotY(M, p.ry);
    if (p.rx) M4.rotX(M, p.rx);
    if (p.rz) M4.rotZ(M, p.rz);
    if (p.s !== 1) M4.scale(M, p.s, p.s, p.s);
  }
  return out;
}
