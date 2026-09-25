// ============================================================================
//  The End: end crystals, the Ender Dragon and its fight, dragon fireballs and breath, eyes of ender,
//  firework rockets. The dragon and crystals are voxel models (drawn with the vehicle program).
// ============================================================================
// blocks the dragon cannot smash through while it flies
const DRAGON_IMMUNE = new Set([B.obsidian, B.crying_obsidian, B.end_stone, B.bedrock, B.iron_bars, B.end_portal, B.end_portal_frame, B.end_gateway, B.torch, B.dragon_egg]);
const PERCH_Y = 5.2;          // dragon body height above the exit portal floor when perched on the pillar
// y of the first standable surface at or below y0 (for clouds of breath)
function groundBelow(w, x, y0, z) { const bx = Math.floor(x), bz = Math.floor(z); for (let y = Math.floor(y0); y > y0 - 24; y--) if (SOLID[w.getId(bx, y - 1, bz)]) return y; return Math.floor(y0); }
const NECK_N = 5, NECK_LEN = 0.95, TAIL_N = 10, TAIL_LEN = 0.92;
// ray test against a multi-part entity; returns { t, part } for the nearest part box hit, or null
function rayHitParts(e, ox, oy, oz, dx, dy, dz, pad, maxT) {
  let best = null;
  for (let i = 0; i < e.hitParts.length; i++) {
    const b = e.hitParts[i];
    const h = rayAABB(ox, oy, oz, dx, dy, dz, [b[0] - pad, b[1] - pad, b[2] - pad, b[3] + pad, b[4] + pad, b[5] + pad]);
    if (h && (maxT === undefined || h.t <= maxT) && (!best || h.t < best.t)) best = { t: h.t, part: i };
  }
  return best;
}
// distance from a point to the nearest part box of a multi-part entity
function partDistance(e, x, y, z) {
  let best = Infinity;
  for (const b of e.hitParts) { const dx = Math.max(b[0] - x, 0, x - b[3]), dy = Math.max(b[1] - y, 0, y - b[4]), dz = Math.max(b[2] - z, 0, z - b[5]); best = Math.min(best, Math.hypot(dx, dy, dz)); }
  return best;
}
function aabbOverlap(b, x0, y0, z0, x1, y1, z1) { return b[0] < x1 && b[3] > x0 && b[1] < y1 && b[4] > y0 && b[2] < z1 && b[5] > z0; }
// orthonormal frame -> column-major matrix: local +X = right, +Y = up, -Z = forward, placed at p (camera relative)
function frameMatrix(M, p, f, u, R) {
  let rx = f[1] * u[2] - f[2] * u[1], ry = f[2] * u[0] - f[0] * u[2], rz = f[0] * u[1] - f[1] * u[0];
  const rl = Math.hypot(rx, ry, rz) || 1; rx /= rl; ry /= rl; rz /= rl;
  const ux = ry * f[2] - rz * f[1], uy = rz * f[0] - rx * f[2], uz = rx * f[1] - ry * f[0];
  M[0] = rx; M[1] = ry; M[2] = rz; M[3] = 0; M[4] = ux; M[5] = uy; M[6] = uz; M[7] = 0;
  M[8] = -f[0]; M[9] = -f[1]; M[10] = -f[2]; M[11] = 0;
  M[12] = p[0] - R.camX; M[13] = p[1] - R.camY; M[14] = p[2] - R.camZ; M[15] = 1;
  return M;
}
function nrm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; return v; }
// ---------------------------------------------------------------- end crystal
class EndCrystal extends Entity {
  constructor(x, y, z) {
    super('end_crystal', x, y, z);
    this.w = 2; this.h = 2; this.persistent = true; this.fireImmune = true; this.noGravity = true; this.isCrystal = true;
    this.spin = Math.random() * TAU; this.beamTo = null;
  }
  serialize() { return { type: 'end_crystal', x: this.x, y: this.y, z: this.z }; }
  tick() {
    this.savePrev(); this.age++;
    // a small fire keeps burning in the bedrock under the crystal, as a beacon for the dragon
    if ((this.age & 7) === 0 && this.game.particles) this.game.particles.spawn('p_end', this.x + (Math.random() - 0.5) * 1.4, this.y + 0.4 + Math.random() * 1.4, this.z + (Math.random() - 0.5) * 1.4, { vy: 0.01, life: 30, size: 0.1, color: [1, 0.55, 0.95], emissive: true });
  }
  hurt(amount, src) {
    if (this.removed) return false;
    // anything that hits it sets it off (arrows and snowballs included)
    this.removed = true;
    const w = this.world, g = this.game;
    const c = w.getChunk(Math.floor(this.x) >> 4, Math.floor(this.z) >> 4); if (c) c.modified = true;
    explode(w, this.x, this.y + 1, this.z, 6, false, this);
    if (g.endFight) g.endFight.crystalDestroyed(this, src);
    return true;
  }
}
// ---------------------------------------------------------------- dragon fireball + breath cloud
class DragonFireball extends Projectile {
  constructor(x, y, z, vx, vy, vz, owner) { super('dragon_fireball', x, y, z, vx, vy, vz, owner); this.gravity = 0; this.drag = 1; this.w = 0.6; this.h = 0.6; this.fireImmune = true; }
  tick() {
    super.tick();
    if (this.removed) return;
    const P = this.game.particles;
    for (let i = 0; i < 2; i++) P.spawn('p_breath', this.x + (Math.random() - 0.5) * 0.5, this.y + (Math.random() - 0.5) * 0.5, this.z + (Math.random() - 0.5) * 0.5, { vx: (Math.random() - 0.5) * 0.03, vy: (Math.random() - 0.5) * 0.03, vz: (Math.random() - 0.5) * 0.03, life: 18, size: 0.35, color: [0.85, 0.3, 0.95], alpha: 0.8, emissive: true, shrink: true });
    if (this.age > 160) this.burst();
  }
  onHitEntity(e) { if (e === this.owner || e.isCrystal) { this.x += this.vx; this.y += this.vy; this.z += this.vz; return; } this.burst(); }
  onHitBlock() { this.burst(); }
  burst() {
    if (this.removed) return;
    this.removed = true;
    const g = this.game;
    g.audio.play('dragon_breath', { x: this.x, y: this.y, z: this.z, range: 48 });
    // the cloud settles on the ground below the impact
    let y = this.y;
    for (let i = 0; i < 6 && !SOLID[this.world.getId(Math.floor(this.x), Math.floor(y - 0.5), Math.floor(this.z))]; i++) y -= 1;
    this.world.addEntity(new BreathCloud(this.x, Math.floor(y - 0.5) + 1.05, this.z, 3.2, 200, this.owner));
  }
}
DragonFireball.prototype.isProjectile = true;
class BreathCloud extends Entity {
  constructor(x, y, z, r, life, owner) { super('breath_cloud', x, y, z); this.r = r; this.life = life; this.owner = owner; this.w = 0.1; this.h = 0.1; this.noGravity = true; }
  tick() {
    this.savePrev(); this.age++;
    if (this.age > this.life) { this.removed = true; return; }
    const g = this.game, P = g.particles, rr = this.r * (1 - this.age / this.life * 0.35);
    for (let i = 0; i < 5; i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * rr; P.spawn('p_breath', this.x + Math.cos(a) * d, this.y + Math.random() * 0.6, this.z + Math.sin(a) * d, { vy: 0.012 + Math.random() * 0.01, vx: (Math.random() - 0.5) * 0.01, vz: (Math.random() - 0.5) * 0.01, life: 30, size: 0.45 + Math.random() * 0.3, color: [0.8, 0.28, 0.9], alpha: 0.55, emissive: true, drag: 0.99 }); }
    if (this.age % 10 === 0) for (const e of this.world.entitiesNear(this.x, this.y, this.z, rr + 1)) {
      if (e === this.owner || e.removed || !e.hurt || e.isBoss || e.isCrystal || e.isVehicle || e.dead) continue;
      if (Math.hypot(e.x - this.x, e.z - this.z) > rr + e.w * 0.5 || e.y > this.y + 2 || e.y + e.h < this.y - 0.5) continue;
      e.hurt(3, { type: 'breath' });
    }
  }
}
// ---------------------------------------------------------------- ender dragon
class EnderDragon extends Entity {
  constructor(x, y, z, fight) {
    super('ender_dragon', x, y, z);
    this.fight = fight; this.isBoss = true; this.fireImmune = true; this.noGravity = true; this.persistent = true; this.noUnload = true;
    this.w = 6; this.h = 3; this.reach = 16;
    this.maxHealth = 200; this.health = 200; this.dead = false; this.hurtTime = 0; this.invul = 0;
    this.pitch = 0; this.lpitch = 0; this.roll = 0; this.lroll = 0; this.speed = 0.5; this.tspeed = 0.7;
    this.phase = 'hold'; this.phaseT = 0; this.node = 0; this.dir = 1; this.tx = x; this.ty = y; this.tz = z;
    this.flap = 0; this.lflap = 0; this.flapAmt = 1; this.jaw = 0; this.ljaw = 0;
    this.look = [0, -0.2, -1]; this.llook = [0, -0.2, -1];
    this.hist = []; this.hitParts = []; this.touchCd = new Map();
    this.healCrystal = null; this.healT = 0; this.perchDmg = 0; this.perchCycles = 0; this.shootT = 0; this.roarT = 160;
    this.deathT = 0; this.pose = null;
    for (let i = 0; i < 40; i++) this.hist.push([Math.sin(this.yaw), 0, -Math.cos(this.yaw)]);
    this.updatePose();
  }
  get fwd() { const cp = Math.cos(this.pitch); return [Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }
  savePrev() { super.savePrev(); this.lpitch = this.pitch; this.lroll = this.roll; this.lflap = this.flap; this.ljaw = this.jaw; this.llook = this.look.slice(); }
  // ------------------------------------------------------------ damage
  hurt(amount, src) {
    if (this.dead || this.phase === 'dying') return false;
    const t = src && src.type;
    if (t === 'fire' || t === 'lava' || t === 'fall' || t === 'breath' || t === 'suffocate' || t === 'drown') return false;
    if (src && src.source === this) return false;
    if (this.invul > 0 && t !== 'crystal') return false;
    // the head takes full damage; hits anywhere else lose most of their force
    const part = this.lastHitPart;
    if (t !== 'crystal' && t !== 'kill' && part !== 0) amount = amount / 4 + Math.min(amount, 1);
    this.health -= amount; this.hurtTime = 10; this.invul = t === 'explosion' ? 10 : 6;
    if (this.phase === 'perch' || this.phase === 'breath') this.perchDmg += amount;
    const g = this.game;
    g.audio.play('dragon_hurt', { x: this.x, y: this.y, z: this.z, range: 120 });
    if (this.health <= 0) { this.health = 0; this.startDeath(src); }
    else if (this.phase === 'hold' && Math.random() < 0.2 && src && src.source && src.source.isPlayer) this.setPhase('strafe');
    return true;
  }
  startDeath(src) {
    this.phase = 'dying'; this.phaseT = 0; this.deathT = 0; this.healCrystal = null;
    this.game.audio.play('dragon_death', { x: this.x, y: this.y, z: this.z, range: 400 });
    if (this.fight) this.fight.dragonDying(this);
  }
  // ------------------------------------------------------------ main tick
  tick() {
    this.savePrev(); this.age++;
    if (this.hurtTime > 0) this.hurtTime--;
    if (this.invul > 0) this.invul--;
    const g = this.game, p = g.player;
    if (this.phase === 'dying') { this.tickDeath(); this.updatePose(); return; }
    this.tickHeal();
    this.think(p);
    this.steer();
    this.hist.unshift(this.fwd); if (this.hist.length > 40) this.hist.pop();
    this.updatePose();
    if (this.phase !== 'perch' && this.phase !== 'breath') this.smash();
    this.touch();
    // wings: faster beats when climbing, folded when perched
    const perched = this.phase === 'perch' || this.phase === 'breath';
    this.flapAmt += ((perched ? 0 : 1) - this.flapAmt) * 0.08;
    const rate = perched ? 0.02 : this.vy > 0.05 || this.phase === 'takeoff' ? 0.3 : this.phase === 'charge' ? 0.12 : 0.21;
    const before = Math.floor(this.flap / TAU + 0.25);
    this.flap += rate;
    if (!perched && Math.floor(this.flap / TAU + 0.25) !== before) g.audio.play('dragon_flap', { x: this.x, y: this.y, z: this.z, range: 110, vol: 0.9 });
    this.jaw += ((this.phase === 'breath' ? 1 : this.roarT < 30 ? 0.7 : 0.08) - this.jaw) * 0.15;
    if (--this.roarT <= 0) { this.roarT = 200 + randInt(0, 300); g.audio.play(Math.random() < 0.5 ? 'dragon_roar' : 'dragon_growl', { x: this.x, y: this.y, z: this.z, range: 220 }); }
  }
  setPhase(ph) { this.phase = ph; this.phaseT = 0; this.shootT = 0; if (ph === 'perch') { this.perchDmg = 0; } if (ph === 'takeoff') this.perchCycles = 0; }
  nodePos(i) {
    const s = this.fight.portalY, a = i / 12 * TAU;
    return [Math.cos(a) * 64, s + 24 + Math.sin(i * 1.7) * 9 + (i & 1) * 6, Math.sin(a) * 64];
  }
  nearestNode() { let bi = 0, bd = Infinity; for (let i = 0; i < 12; i++) { const n = this.nodePos(i), d = (n[0] - this.x) ** 2 + (n[2] - this.z) ** 2; if (d < bd) { bd = d; bi = i; } } return (bi + this.dir + 12) % 12; }
  target(x, y, z, sp) { this.tx = x; this.ty = y; this.tz = z; this.tspeed = sp; }
  canSeeP(p) { return !rayBlocked(this.world, this.x, this.y, this.z, p.x, p.y + 1.6, p.z); }
  facing(p) { const f = this.fwd, dx = p.x - this.x, dy = p.y + 1 - this.y, dz = p.z - this.z, l = Math.hypot(dx, dy, dz) || 1; return (f[0] * dx + f[1] * dy + f[2] * dz) / l; }
  think(p) {
    const s = this.fight.portalY, alive = p && !p.dead && p.world === this.world && !p.creative && !p.spectator;
    this.phaseT++;
    // the head looks along the flight path, or at the player when it has one in mind
    const hp = this.pose ? this.pose.head.p : [this.x, this.y, this.z];
    let lk = this.fwd.slice(); lk[1] -= 0.25;
    if (alive && (this.phase === 'strafe' || this.phase === 'perch' || this.phase === 'breath' || this.phase === 'charge')) { lk = [p.x - hp[0], p.y + 1 - hp[1], p.z - hp[2]]; }
    nrm3(lk);
    for (let i = 0; i < 3; i++) this.look[i] += (lk[i] - this.look[i]) * 0.12;
    nrm3(this.look);
    switch (this.phase) {
      case 'hold': {
        const n = this.nodePos(this.node);
        this.target(n[0], n[1], n[2], 0.72);
        if ((n[0] - this.x) ** 2 + (n[1] - this.y) ** 2 + (n[2] - this.z) ** 2 < 100) {
          this.node = (this.node + this.dir + 12) % 12;
          if (Math.random() < 0.05) this.dir = -this.dir;
          const crystals = this.fight.crystalCount();
          if (alive && Math.hypot(p.x, p.z) < 160) {
            if (Math.random() < 1 / (crystals * 1.4 + 2.2)) this.setPhase('approach');
            else if (this.canSeeP(p) && Math.random() < 0.4) this.setPhase('strafe');
            else if (Math.random() < 0.14 && p.y > s - 6) this.setPhase('charge');
          }
        }
        break;
      }
      case 'strafe': {
        if (!alive) { this.setPhase('hold'); break; }
        const d = Math.hypot(p.x - this.x, p.z - this.z);
        this.target(p.x, p.y + Math.min(20, 6 + d * 0.3), p.z, 0.95);
        if (d < 70 && this.facing(p) > 0.86 && this.canSeeP(p)) { if (++this.shootT > 14) { this.shootFireball(p); this.setPhase('hold'); this.node = this.nearestNode(); } }
        if (this.phaseT > 240 || d < 10) { this.setPhase('hold'); this.node = this.nearestNode(); }
        break;
      }
      case 'charge': {
        if (!alive) { this.setPhase('hold'); break; }
        this.target(p.x, p.y + 1, p.z, 1.35);
        if (this.phaseT === 1) this.game.audio.play('dragon_roar', { x: this.x, y: this.y, z: this.z, range: 220 });
        if ((p.x - this.x) ** 2 + (p.y - this.y) ** 2 + (p.z - this.z) ** 2 < 16 || this.phaseT > 130) { this.setPhase('hold'); this.node = this.nearestNode(); }
        break;
      }
      case 'approach': {
        this.target(0.5, s + 26, 0.5, 0.8);
        if ((this.x - 0.5) ** 2 + (this.z - 0.5) ** 2 < 64 && Math.abs(this.y - s - 26) < 10) this.setPhase('land');
        if (this.phaseT > 600) this.setPhase('hold');
        break;
      }
      case 'land': this.target(0.5, s + PERCH_Y, 0.5, 0.3); if ((this.x - 0.5) ** 2 + (this.y - s - PERCH_Y) ** 2 + (this.z - 0.5) ** 2 < 1.5) this.setPhase('perch'); if (this.phaseT > 400) this.setPhase('takeoff'); break;
      case 'perch': {
        if (this.phaseT === 12) this.game.audio.play('dragon_roar', { x: this.x, y: this.y, z: this.z, range: 220 });
        if (alive && this.phaseT > 36 && this.phaseT % 40 === 0 && Math.hypot(p.x - this.x, p.z - this.z) < 26) this.setPhase('breath');
        if (this.phaseT > 200 || this.perchDmg > 40) this.setPhase('takeoff');
        break;
      }
      case 'breath': {
        if (this.phaseT === 8) { const h = this.pose.head, f = h.f, bx = h.p[0] + f[0] * 5, bz = h.p[2] + f[2] * 5, by = groundBelow(this.world, bx, s + 6, bz) + 0.05; this.world.addEntity(new BreathCloud(bx, by, bz, 4.5, 220, this)); this.game.audio.play('dragon_breath', { x: bx, y: by, z: bz, range: 64 }); }
        const h = this.pose.head, m = [h.p[0] + h.f[0] * 1.6, h.p[1] + h.f[1] * 1.6 - 0.3, h.p[2] + h.f[2] * 1.6];
        for (let i = 0; i < 4; i++) this.game.particles.spawn('p_breath', m[0], m[1], m[2], { vx: h.f[0] * 0.35 + (Math.random() - 0.5) * 0.12, vy: h.f[1] * 0.35 - 0.08 + (Math.random() - 0.5) * 0.08, vz: h.f[2] * 0.35 + (Math.random() - 0.5) * 0.12, life: 22, size: 0.5, color: [0.85, 0.3, 0.95], alpha: 0.75, emissive: true, grav: 0.004 });
        if (this.phaseT > 64) this.setPhase(++this.perchCycles < 3 && this.perchDmg <= 40 ? 'perch' : 'takeoff');
        break;
      }
      case 'takeoff': {
        const f = this.fwd;
        this.target(this.x + f[0] * 30, s + 40, this.z + f[2] * 30, 0.8);
        if (this.y > s + 28) { this.setPhase('hold'); this.node = this.nearestNode(); }
        break;
      }
    }
  }
  shootFireball(p) {
    const h = this.pose.head, o = [h.p[0] + h.f[0] * 2, h.p[1] + h.f[1] * 2, h.p[2] + h.f[2] * 2];
    const dx = p.x - o[0], dy = p.y + 1 - o[1], dz = p.z - o[2], l = Math.hypot(dx, dy, dz) || 1, v = 1.25;
    this.world.addEntity(new DragonFireball(o[0], o[1], o[2], dx / l * v, dy / l * v, dz / l * v, this));
    this.game.audio.play('dragon_shoot', { x: o[0], y: o[1], z: o[2], range: 120 });
    this.jaw = 1;
  }
  steer() {
    const s = this.fight.portalY;
    if (this.phase === 'perch' || this.phase === 'breath') {
      this.x += (0.5 - this.x) * 0.12; this.z += (0.5 - this.z) * 0.12; this.y += (s + PERCH_Y - this.y) * 0.12;
      this.pitch *= 0.85; this.roll *= 0.85; this.speed = 0; this.vx = this.vy = this.vz = 0;
      const p = this.game.player;
      if (p && p.world === this.world) this.yaw += clamp(angleDiff(this.yaw, Math.atan2(p.x - this.x, -(p.z - this.z))), -0.05, 0.05);
      return;
    }
    const dx = this.tx - this.x, dy = this.ty - this.y, dz = this.tz - this.z, hd = Math.hypot(dx, dz);
    const turn = this.phase === 'land' ? 0.09 : this.phase === 'charge' ? 0.055 : 0.042;
    const dyaw = clamp(angleDiff(this.yaw, Math.atan2(dx, -dz)), -turn, turn);
    this.yaw += hd > 0.5 ? dyaw : 0;
    this.roll += (clamp(-dyaw * 9, -0.6, 0.6) - this.roll) * 0.08;
    this.pitch += (clamp(Math.atan2(dy, Math.max(hd, 2)), -0.55, 0.55) - this.pitch) * 0.08;
    this.speed += (this.tspeed - this.speed) * 0.05;
    const cp = Math.cos(this.pitch);
    this.vx = Math.sin(this.yaw) * cp * this.speed; this.vz = -Math.cos(this.yaw) * cp * this.speed; this.vy = Math.sin(this.pitch) * this.speed;
    // settle straight onto the perch at the end of a landing instead of circling it
    if (this.phase === 'land' && hd < 10) { const k = 0.06; this.vx = dx * k; this.vz = dz * k; this.vy = clamp(dy * 0.05, -0.3, 0.3); }
    this.x += this.vx; this.y += this.vy; this.z += this.vz;
    if (this.y < s - 20) this.y = s - 20;
  }
  // ------------------------------------------------------------ pose (shared by rendering and hit boxes)
  // Segment frames in world space at render alpha a: body, neck joints, head, tail joints, wing roots.
  poseAt(a, out) {
    const lerpA = (p, c) => p + angleDiff(p, c) * a;
    const x = this.lx + (this.x - this.lx) * a, y = this.ly + (this.y - this.ly) * a, z = this.lz + (this.z - this.lz) * a;
    const yaw = lerpA(this.lyaw, this.yaw), pitch = this.lpitch + (this.pitch - this.lpitch) * a, roll = this.lroll + (this.roll - this.lroll) * a;
    const q = Q.fromHPR(out.q || (out.q = [0, 0, 0, 1]), yaw, pitch, roll);
    const f = Q.rot(q, 0, 0, -1, out.f || (out.f = [0, 0, 0])), u = Q.rot(q, 0, 1, 0, out.u || (out.u = [0, 0, 0])), r = Q.rot(q, 1, 0, 0, out.r || (out.r = [0, 0, 0]));
    out.p = [x, y, z];
    const t = (this.age + a) * 0.05;
    // neck: bends from the body direction toward where the head looks
    const lk = [0, 0, 0]; for (let i = 0; i < 3; i++) lk[i] = this.llook[i] + (this.look[i] - this.llook[i]) * a;
    nrm3(lk);
    let jp = [x + f[0] * 3.0 + u[0] * 0.5, y + f[1] * 3.0 + u[1] * 0.5, z + f[2] * 3.0 + u[2] * 0.5];
    out.neck = [];
    for (let i = 0; i < NECK_N; i++) {
      const k = (i + 1) / NECK_N, w = Math.sin(t * 2 - i * 0.7) * 0.06;
      const d = nrm3([f[0] + (lk[0] - f[0]) * k + u[0] * w, f[1] + (lk[1] - f[1]) * k + u[1] * w + 0.12 * (1 - k), f[2] + (lk[2] - f[2]) * k + u[2] * w]);
      out.neck.push({ p: jp, f: d });
      jp = [jp[0] + d[0] * NECK_LEN, jp[1] + d[1] * NECK_LEN, jp[2] + d[2] * NECK_LEN];
    }
    out.head = { p: jp, f: lk };
    // tail: each joint follows the body's heading from a few ticks back, with a gentle sway
    let tp = [x - f[0] * 3.1 + u[0] * 0.15, y - f[1] * 3.1 + u[1] * 0.15, z - f[2] * 3.1 + u[2] * 0.15];
    out.tail = [];
    for (let i = 0; i < TAIL_N; i++) {
      const hf = this.hist[Math.min(this.hist.length - 1, i * 2 + 1)], sw = Math.sin(t * 1.6 - i * 0.55) * 0.07 * (i / TAIL_N);
      const d = nrm3([hf[0] + r[0] * sw, hf[1] - 0.04 * (i / TAIL_N), hf[2] + r[2] * sw]);
      out.tail.push({ p: tp, f: d });
      const len = TAIL_LEN * (1 - i * 0.035);
      tp = [tp[0] - d[0] * len, tp[1] - d[1] * len, tp[2] - d[2] * len];
    }
    const fl = this.lflap + (this.flap - this.lflap) * a, amt = this.flapAmt;
    // flapping in flight; perched, the wings droop half-open and rise and fall with its breathing
    out.wingIn = amt * (Math.sin(fl) * 0.62 + 0.08) + (1 - amt) * (0.34 + Math.sin(t * 0.9) * 0.05);
    out.wingOut = amt * (Math.sin(fl - 0.9) * 0.55 - 0.08) + (1 - amt) * 0.45;
    out.jaw = (this.ljaw + (this.jaw - this.ljaw) * a) * 0.55;
    out.legs = 1 - amt;
    return out;
  }
  updatePose() {
    const P = this.pose = this.poseAt(1, this.pose || {});
    const hp = this.hitParts;
    const box = (i, c, hx, hy, hz) => { const b = hp[i] || (hp[i] = [0, 0, 0, 0, 0, 0]); b[0] = c[0] - hx; b[1] = c[1] - hy; b[2] = c[2] - hz; b[3] = c[0] + hx; b[4] = c[1] + hy; b[5] = c[2] + hz; };
    const h = P.head, f = P.f, u = P.u, r = P.r;
    box(0, [h.p[0] + h.f[0] * 1.2, h.p[1] + h.f[1] * 1.2, h.p[2] + h.f[2] * 1.2], 1.15, 0.9, 1.15);
    box(1, P.neck[2].p, 0.8, 0.8, 0.8);
    box(2, P.p, 2.2, 1.5, 2.2);
    // wings: inner and outer panels, following the same hinge angles the renderer uses (local -Z is forward)
    const at = (lx, ly, lz) => [P.p[0] + r[0] * lx + u[0] * ly - f[0] * lz, P.p[1] + r[1] * lx + u[1] * ly - f[1] * lz, P.p[2] + r[2] * lx + u[2] * ly - f[2] * lz];
    const wi = P.wingIn, wo = P.wingIn + P.wingOut;
    for (const [i, sd] of [[3, 1], [4, -1]]) {
      const rx = sd * (1.35 + Math.cos(wi) * 4.6), ry = 0.85 - Math.sin(wi) * 4.6;
      box(i, at(sd * (1.35 + Math.cos(wi) * 2.4), 0.85 - Math.sin(wi) * 2.4, 0.2), 2.3, 1.1, 2.3);
      box(i + 2, at(rx + sd * Math.cos(wo) * 2.4, ry - Math.sin(wo) * 2.4, 0.1), 2.3, 1.1, 2.3);
    }
    box(7, P.tail[3].p, 0.9, 0.9, 0.9); box(8, P.tail[7].p, 0.7, 0.7, 0.7);
  }
  // ------------------------------------------------------------ world interaction
  smash() {
    const w = this.world, g = this.game;
    let n = 0;
    for (const i of [0, 2, 3, 4]) {
      const b = this.hitParts[i];
      for (let x = Math.floor(b[0]); x <= Math.floor(b[3]) && n < 40; x++) for (let y = Math.floor(b[1]); y <= Math.floor(b[4]) && n < 40; y++) for (let z = Math.floor(b[2]); z <= Math.floor(b[5]) && n < 40; z++) {
        const id = w.getId(x, y, z);
        if (!id || DRAGON_IMMUNE.has(id) || FLUID[id] || id === B.fire) continue;
        if (!w.isLoaded(x, z)) continue;
        if (n % 3 === 0) g.particles.blockBreak(x, y, z, w.getBlock(x, y, z));
        const be = w.getBE(x, y, z); if (be) g.onBERemoved(be, x, y, z);
        w.setBlock(x, y, z, 0, 1 | 8); n++;
      }
    }
    if (n > 0 && Math.random() < 0.3) g.audio.play('explosion', { x: this.x, y: this.y, z: this.z, range: 40, vol: 0.4 });
  }
  touch() {
    const w = this.world, g = this.game;
    for (const [k, v] of this.touchCd) if (v <= this.age) this.touchCd.delete(k);
    for (const e of w.entitiesNear(this.x, this.y, this.z, 18)) {
      if (e === this || e.removed || e.dead || e.isCrystal || e.isProjectile || e.type === 'item' || e.type === 'xp' || e.type === 'breath_cloud' || this.touchCd.has(e.id)) continue;
      if (e.isBoss || (e.isPlayer && (e.creative || e.spectator || e.vehicle))) continue;
      const hw = e.w / 2, x0 = e.x - hw, x1 = e.x + hw, y0 = e.y, y1 = e.y + e.h, z0 = e.z - hw, z1 = e.z + hw;
      let hit = -1;
      for (let i = 0; i < this.hitParts.length && hit < 0; i++) if (aabbOverlap(this.hitParts[i], x0, y0, z0, x1, y1, z1)) hit = i;
      if (hit < 0) continue;
      this.touchCd.set(e.id, this.age + 10);
      const target = e.vehicle || e;
      const dx = target.x - this.x, dz = target.z - this.z, l = Math.hypot(dx, dz) || 1;
      const kb = hit === 0 ? 0.6 : 1.4;
      if (target.isVehicle) { target.vel[0] += dx / l * kb * 14; target.vel[1] += 6; target.vel[2] += dz / l * kb * 14; target.hurt(hit === 0 ? 14 : 6, { type: 'mob', source: this }); continue; }
      e.vx += dx / l * kb; e.vz += dz / l * kb; e.vy = Math.max(e.vy, 0.45);
      const dmg = hit === 0 ? [0, 6, 10, 15][g.difficulty] : [0, 3, 5, 7][g.difficulty];
      if (dmg > 0) e.hurt(dmg, { type: 'dragon', source: e.isPlayer ? this : null, kb: 0 });
    }
  }
  tickHeal() {
    const f = this.fight;
    if (this.healCrystal && (this.healCrystal.removed || this.healCrystal.world !== this.world)) this.healCrystal = null;
    if (!this.healCrystal && this.age % 10 === 0) {
      let best = null, bd = 32 * 32;
      for (const c of f.crystals()) { const d = c.dist2(this.x, this.y, this.z); if (d < bd) { bd = d; best = c; } }
      this.healCrystal = best;
    }
    if (this.healCrystal) {
      if (this.healCrystal.dist2(this.x, this.y, this.z) > 40 * 40) this.healCrystal = null;
      else if (this.age % 10 === 0 && this.health < this.maxHealth) this.health = Math.min(this.maxHealth, this.health + 1);
    }
  }
  // ------------------------------------------------------------ death
  tickDeath() {
    const g = this.game, P = g.particles;
    this.deathT++;
    this.y += 0.1; this.yaw += 0.02; this.pitch *= 0.95; this.roll *= 0.95;
    this.flap += 0.05; this.flapAmt *= 0.97; this.jaw += (1 - this.jaw) * 0.1;
    this.hist.unshift(this.fwd); if (this.hist.length > 40) this.hist.pop();
    if (this.deathT % 3 === 0) {
      const ox = (Math.random() - 0.5) * 8, oy = (Math.random() - 0.5) * 4, oz = (Math.random() - 0.5) * 8;
      for (let i = 0; i < 6; i++) P.spawn('p_explosion', this.x + ox + (Math.random() - 0.5), this.y + oy + (Math.random() - 0.5), this.z + oz + (Math.random() - 0.5), { vx: (Math.random() - 0.5) * 0.1, vy: Math.random() * 0.05, vz: (Math.random() - 0.5) * 0.1, life: 14 + Math.random() * 8, size: 1.2 + Math.random(), color: [1, 0.9, 1], shrink: true, emissive: true });
      if (this.deathT % 12 === 0) g.audio.play('smallboom', { x: this.x + ox, y: this.y + oy, z: this.z + oz, range: 200 });
    }
    if (this.deathT > 60 && this.deathT % 8 === 0) g.spawnXP(this.world, this.x + (Math.random() - 0.5) * 6, this.y, this.z + (Math.random() - 0.5) * 6, 40);
    if (this.deathT >= 200) {
      this.removed = true; this.dead = true;
      g.fx('explosion', this.x, this.y, this.z, 6);
      if (this.fight) this.fight.dragonDied(this);
    }
  }
}
// ---------------------------------------------------------------- eye of ender
class EyeOfEnder extends Entity {
  constructor(x, y, z, tx, tz, owner) {
    super('eye_of_ender', x, y, z);
    this.w = 0.25; this.h = 0.25; this.noGravity = true; this.owner = owner;
    const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
    // fly 12 blocks toward the stronghold (or straight to it when closer), rising or sinking toward it
    if (d > 12) { this.gx = x + dx / d * 12; this.gz = z + dz / d * 12; this.gy = y + 8; }
    else { this.gx = tx; this.gz = tz; this.gy = y; }
  }
  tick() {
    this.savePrev(); this.age++;
    const k = this.age < 60 ? 0.06 : 0;
    this.x += (this.gx - this.x) * k; this.z += (this.gz - this.z) * k; this.y += (this.gy - this.y) * k * 0.8 + Math.sin(this.age * 0.25) * 0.02;
    const g = this.game;
    if ((this.age & 1) === 0) g.particles.spawn('p_portal', this.x, this.y, this.z, { vx: (Math.random() - 0.5) * 0.04, vy: (Math.random() - 0.5) * 0.04, vz: (Math.random() - 0.5) * 0.04, life: 25, size: 0.12, emissive: true, color: [0.7, 1, 0.85] });
    if (this.age >= 80) {
      this.removed = true;
      if (Math.random() < 0.8) g.dropItem(this.world, this.x, this.y, this.z, { id: I.eye_of_ender, n: 1, d: 0 });
      else { g.audio.play('eye_death', { x: this.x, y: this.y, z: this.z }); g.particles.burst(this.x, this.y, this.z, 'p_portal', 14, [0.6, 1, 0.8]); }
    }
  }
}
// ---------------------------------------------------------------- firework rocket
const FIREWORK_COLORS = [[1, 0.25, 0.25], [1, 0.75, 0.2], [0.3, 1, 0.4], [0.3, 0.7, 1], [0.8, 0.35, 1], [1, 1, 1]];
class FireworkRocket extends Entity {
  constructor(x, y, z, rider) {
    super('firework', x, y, z);
    this.w = 0.25; this.h = 0.25; this.noGravity = true; this.rider = rider || null;
    this.fuse = rider ? 30 : 28 + randInt(0, 14);
    this.vx = (Math.random() - 0.5) * 0.02; this.vz = (Math.random() - 0.5) * 0.02; this.vy = 0.05;
  }
  tick() {
    this.savePrev(); this.age++;
    const g = this.game, P = g.particles;
    if (this.rider) {
      // boosting an elytra flight: stay with the player and push them along their look direction
      const p = this.rider;
      if (!p.gliding || p.dead) { this.removed = true; return; }
      this.x = p.x; this.y = p.y + 0.5; this.z = p.z;
      const l = p.lookVec();
      p.vx += l[0] * 0.1 + (l[0] * 1.5 - p.vx) * 0.5; p.vy += l[1] * 0.1 + (l[1] * 1.5 - p.vy) * 0.5; p.vz += l[2] * 0.1 + (l[2] * 1.5 - p.vz) * 0.5;
    } else { this.vy = Math.min(0.9, this.vy + 0.04); this.x += this.vx; this.y += this.vy; this.z += this.vz; }
    P.spawn('p_spark', this.x, this.y - 0.2, this.z, { vx: (Math.random() - 0.5) * 0.04, vy: -0.05, vz: (Math.random() - 0.5) * 0.04, life: 12, size: 0.08, color: [1, 0.8, 0.5], emissive: true, grav: 0.01 });
    if (--this.fuse <= 0) {
      this.removed = true;
      if (this.rider) return;
      const c = FIREWORK_COLORS[randInt(0, FIREWORK_COLORS.length - 1)], c2 = FIREWORK_COLORS[randInt(0, FIREWORK_COLORS.length - 1)];
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * TAU, b = Math.acos(Math.random() * 2 - 1), s = 0.35 + Math.random() * 0.08;
        const cc = i & 1 ? c : c2;
        P.spawn('p_firework', this.x, this.y, this.z, { vx: Math.sin(b) * Math.cos(a) * s, vy: Math.cos(b) * s, vz: Math.sin(b) * Math.sin(a) * s, drag: 0.9, grav: 0.006, life: 30 + Math.random() * 20, size: 0.16, color: cc, emissive: true });
      }
      g.audio.play('firework_blast', { x: this.x, y: this.y, z: this.z, range: 96 });
      if (g.munitions) g.munitions.flashes.push({ x: this.x, y: this.y, z: this.z, size: 5, life: 0.5, age: 0, c, i: 2.5 });
    }
  }
}
// ---------------------------------------------------------------- the fight
// Spawns the dragon while the player is in the End, remembers its health across visits, and runs the aftermath:
// the exit portal lights up, the dragon egg appears on the fountain, and an end gateway opens.
class EndFight {
  constructor(game) { this.g = game; this.dragon = null; this.gen = null; this.genSeed = null; }
  get state() { const m = this.g.meta; if (!m) return { killed: true }; if (!m.end) m.end = { killed: false, dragonHp: 200, gw: [], eggPlaced: false, credits: false, portalLit: false }; return m.end; }
  // main-thread copy of the End generator (portal height, spike layout, island shapes for gateway landings)
  endGen() { const m = this.g.meta, seed = m ? m.seed : 0; if (!this.gen || this.genSeed !== seed) { this.gen = new EndGen(seed); this.genSeed = seed; } return this.gen; }
  get portalY() { return this.endGen().portalY; }
  crystals() { const out = []; for (const e of this.g.world.entities) if (e.isCrystal && !e.removed) out.push(e); return out; }
  crystalCount() { let n = 0; for (const e of this.g.world.entities) if (e.isCrystal && !e.removed) n++; return n; }
  get active() { const d = this.dragon; return !!(d && !d.removed && d.world === this.g.world && this.g.world.dim === 'end'); }
  centreReady() { const w = this.g.world, c = w.getChunk(0, 0); return !!(c && c.lit); }
  tick() {
    const g = this.g, w = g.world;
    if (!w || w.dim !== 'end' || !g.meta) { this.dragon = null; return; }
    const S = this.state, p = g.player;
    if (this.dragon && (this.dragon.removed || this.dragon.world !== w)) this.dragon = null;
    if (!S.killed && !this.dragon && p && Math.hypot(p.x, p.z) < 300 && this.centreReady()) this.summon();
    if (this.dragon && this.dragon.phase !== 'dying') S.dragonHp = this.dragon.health;
    if (S.killed && !S.portalLit && this.centreReady()) this.lightPortal(false);
    // four end crystals set around the lit exit portal call the dragon back
    if (S.killed && S.portalLit && g.tickCount % 20 === 0) {
      const s = this.portalY, ring = this.crystals().filter(c => Math.hypot(c.x - 0.5, c.z - 0.5) < 4.6 && Math.abs(c.y - s - 0.5) < 2);
      if (ring.length >= 4) this.respawn(ring);
    }
  }
  summon() {
    const g = this.g, w = g.world, S = this.state;
    if (this.dragon && !this.dragon.removed) return this.dragon;
    const d = new EnderDragon(40, this.portalY + 40, 0, this);
    d.health = clamp(S.killed ? 200 : S.dragonHp || 200, 1, 200);
    w.addEntity(d); this.dragon = d;
    if (S.killed) { S.killed = false; S.dragonHp = 200; }
    g.ui.message('The Ender Dragon has noticed you.', '#d98aff');
    g.audio.play('dragon_roar', {});
    return d;
  }
  respawn(ring) {
    const g = this.g, w = g.world, s = this.portalY, S = this.state, gen = this.endGen();
    for (const c of ring) { c.removed = true; g.fx('smallboom', c.x, c.y + 1, c.z); }
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if ((dx || dz) && Math.hypot(dx, dz) <= 2.5) w.setBlock(dx, s, dz, 0, 1);
    S.portalLit = false; S.killed = false; S.dragonHp = 200;
    // the pillars get their crystals back (and the cages are not rebuilt)
    for (const sp of gen.spikes) {
      if (!w.isLoaded(sp.x, sp.z)) continue;
      if (this.crystals().some(c => Math.abs(c.x - sp.x - 0.5) < 1 && Math.abs(c.z - sp.z - 0.5) < 1)) continue;
      w.setBlock(sp.x, sp.h + 1, sp.z, B.bedrock, 1);
      for (let k = 2; k <= 4; k++) if (w.getId(sp.x, sp.h + k, sp.z) !== B.iron_bars) w.setBlock(sp.x, sp.h + k, sp.z, 0, 1);
      w.addEntity(new EndCrystal(sp.x + 0.5, sp.h + 2, sp.z + 0.5));
      const c = w.getChunk(sp.x >> 4, sp.z >> 4); if (c) c.modified = true;
      g.fx('smallboom', sp.x + 0.5, sp.h + 3, sp.z + 0.5);
    }
    this.summon();
  }
  crystalDestroyed(c, src) {
    const d = this.dragon;
    if (d && d.healCrystal === c) { d.healCrystal = null; d.hurt(10, { type: 'crystal', source: src && src.source }); }
  }
  dragonDying() { this.g.ui.message('The Ender Dragon is falling!', '#d98aff'); }
  dragonDied() {
    const g = this.g, S = this.state, first = !S.eggPlaced;
    S.killed = true; S.dragonHp = 200; S.kills = (S.kills || 0) + 1;
    this.dragon = null;
    this.lightPortal(first);
    S.eggPlaced = true;
    this.openGateway();
    const s = this.portalY;
    g.spawnXP(g.world, 0.5, s + 5, 0.5, first ? 600 : 250);
    g.ui.message('The Ender Dragon has been slain! The exit portal is open, and a gateway has appeared.', '#ffd24a');
    g.audio.play('end_portal_open', {});
    g.saveAll();
  }
  lightPortal(egg) {
    const w = this.g.world, s = this.portalY, S = this.state;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { if ((dx || dz) && Math.hypot(dx, dz) <= 2.5) w.setBlock(dx, s, dz, B.end_portal, 1); }
    if (egg) w.setBlock(0, s + 4, 0, B.dragon_egg, 1);
    S.portalLit = true;
  }
  // gateways ring the island at radius 96, one more after every dragon kill (up to 20)
  openGateway() {
    const S = this.state, w = this.g.world, list = S.gw || (S.gw = []);
    if (list.length >= 20) return;
    const i = list.length, a = (i * 7 % 20) / 20 * TAU;
    const x = Math.round(Math.cos(a) * 96), z = Math.round(Math.sin(a) * 96), y = 75;
    this.buildGateway(w, x, y, z);
    list.push([x, y, z]);
    this.g.audio.play('gateway', { x, y, z, range: 200 });
  }
  buildGateway(w, x, y, z) {
    for (const [dx, dy, dz] of [[0, -1, 0], [0, 1, 0], [1, -1, 0], [-1, -1, 0], [0, -1, 1], [0, -1, -1], [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1]]) w.setBlock(x + dx, y + dy, z + dz, B.bedrock, 1);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) w.setBlock(x + dx, y, z + dz, 0, 1);
    w.setBlock(x, y, z, B.end_gateway, 1);
  }
  // where a main-island gateway leads: the first solid outer island at least 1024 blocks out along its bearing
  outerLanding(x, z) {
    const gen = this.endGen(), l = Math.hypot(x, z) || 1, ux = x / l, uz = z / l;
    for (let r = 1024; r < 1700; r += 6) {
      const px = Math.round(ux * r), pz = Math.round(uz * r), c = gen.column(px, pz);
      if (c && c.top - c.bot > 5) return [px, Math.floor(c.top) + 1, pz];
    }
    return [Math.round(ux * 1024), 64, Math.round(uz * 1024)];
  }
  // boss bar info for the HUD
  bar() { const d = this.dragon; if (!d || d.removed || this.g.world.dim !== 'end') return null; const p = this.g.player; if (!p || d.dist2(p.x, p.y, p.z) > 260 * 260) return null; return { name: 'Ender Dragon', f: d.health / d.maxHealth }; }
}
// ---------------------------------------------------------------- voxel models
function buildEndModels(gl) {
  const S = 1 / 5;
  // --- dragon body: a deep chest tapering to the hips, dorsal plates along the spine
  const BW = 17, BH = 17, BL = 34;
  const body = new VoxGrid(BW, BH, BL, S), C = (rgb, m) => body.c(rgb, m);
  const SC = C(0x1A191E, MAT_PAINT), SC2 = C(0x232129, MAT_PAINT), BEL = C(0x2E2B35, MAT_PAINT), PLT = C(0x8E8898, MAT_METAL), VIO = C(0x3A2A4E, MAT_PAINT);
  const cx = 8, cy = 7;
  body.each((x, y, z) => {
    const t = z / (BL - 1), bw = 5.2 + Math.sin(Math.PI * Math.min(1, t * 1.25 + 0.05)) * 2.6 - t * 1.6, bh = 3.6 + Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1)) * 2.4 - t * 1.2;
    const dx = Math.abs(x - cx), dy = y - cy;
    if ((dx / bw) ** 2 + (dy / bh) ** 2 > 1) return 0;
    if (dy < -bh * 0.45) return BEL;
    return ((x + z) % 5 === 0 || (z % 4 === 0 && dy > 0)) ? SC2 : dy > bh * 0.75 && z % 3 === 1 ? VIO : SC;
  });
  for (let z = 3; z < BL - 2; z += 3) { const t = z / (BL - 1), top = Math.round(cy + 3.6 + Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1)) * 2.4 - t * 1.2); for (let k = 0; k < 3; k++) body.set(cx, top + k, z + (k === 2 ? 1 : 0), PLT); }
  // --- neck segment and tail segment (one mesh each, drawn many times)
  const neck = new VoxGrid(7, 7, 6, S), NC = (rgb, m) => neck.c(rgb, m);
  const N1 = NC(0x1C1B20, MAT_PAINT), N2 = NC(0x2E2B35, MAT_PAINT), NP = NC(0x8E8898, MAT_METAL);
  neck.each((x, y, z) => { const d = Math.hypot(x - 3, (y - 3) * 1.1); return d > 3.2 ? 0 : y < 2 ? N2 : N1; });
  neck.set(3, 6, 2, NP); neck.set(3, 6, 3, NP); neck.set(3, 7, 3, NP);
  const tail = new VoxGrid(6, 6, 6, S), TC = (rgb, m) => tail.c(rgb, m);
  const T1 = TC(0x1B1A1F, MAT_PAINT), T2 = TC(0x2C2A33, MAT_PAINT), TP = TC(0x8E8898, MAT_METAL);
  tail.each((x, y, z) => { const d = Math.hypot(x - 2.5, (y - 2.5) * 1.1); return d > 2.8 ? 0 : y < 1.5 ? T2 : T1; });
  tail.set(2, 5, 2, TP); tail.set(3, 5, 2, TP); tail.set(2, 5, 3, TP);
  // --- head: long snout, brow ridge, horns and glowing eyes
  const head = new VoxGrid(11, 9, 14, S), HC = (rgb, m) => head.c(rgb, m);
  const H1 = HC(0x1C1B21, MAT_PAINT), H2 = HC(0x2A2830, MAT_PAINT), EYE = HC(0xE070FF, MAT_GLOW), EYE2 = HC(0xFFC8FF, MAT_GLOW), HORN = HC(0xA8A2B2, MAT_METAL), NOS = HC(0x08070A, MAT_MATTE);
  head.each((x, y, z) => {
    const dx = Math.abs(x - 5);
    if (z >= 7) { if (dx <= 4 && y >= 1 && y <= 7) return y > 5 ? H2 : H1; return 0; }            // skull (back half)
    if (dx <= 3 && y >= 1 && y <= 4 - (z < 2 ? 1 : 0)) return y === 4 ? H2 : H1;                    // snout
    return 0;
  });
  for (let x = 1; x <= 9; x++) head.set(x, 7, 7, H2);
  // eyes: a glowing slit on the brow above the snout, wrapping round the sides of the skull
  for (const sx of [-1, 1]) {
    head.set(5 + sx * 2, 5, 7, EYE); head.set(5 + sx * 3, 5, 7, EYE2); head.set(5 + sx * 4, 5, 8, EYE); head.set(5 + sx * 4, 5, 9, EYE2);
    head.set(5 + sx * 2, 4, 0, NOS);
    for (let k = 0; k < 4; k++) head.set(5 + sx * 2, 8 - (k > 2 ? 1 : 0), 10 + k, HORN);
  }
  const jaw = new VoxGrid(9, 3, 12, S), JC = (rgb, m) => jaw.c(rgb, m);
  const J1 = JC(0x1A191E, MAT_PAINT), TEETH = JC(0xD8D2DC, MAT_PAINT);
  jaw.each((x, y, z) => { const dx = Math.abs(x - 4); if (dx > 3 || (z < 2 && dx > 2)) return 0; if (y === 2) return (dx === 3 || dx === 2 && z < 3) && z % 2 === 0 ? TEETH : 0; return J1; });
  // --- wings: bone along the leading edge, a violet-dark membrane swept back (right side; left is mirrored)
  const wing = (outer, side) => {
    const W = 24, D = outer ? 20 : 24, g = new VoxGrid(W, 3, D, S), WC = (rgb, m) => g.c(rgb, m);
    const BONE = WC(0x121114, MAT_PAINT), MEM = WC(0x24202C, MAT_MATTE), MEM2 = WC(0x2E2638, MAT_MATTE), CLAW = WC(0xA8A2B2, MAT_METAL);
    for (let x = 0; x < W; x++) {
      const depth = outer ? Math.max(1, Math.round(18 * (1 - x / W))) : Math.round(22 - x * 0.38);
      for (let z = 0; z < 2; z++) g.set(side > 0 ? x : W - 1 - x, 1, z, BONE);
      for (let z = 2; z < depth; z++) g.set(side > 0 ? x : W - 1 - x, 1, z, (x % 6 === 0 && !outer) || (outer && x % 8 === 4) ? MEM2 : MEM);
      if (!outer && x % 6 === 0) for (let z = 2; z < depth; z += 1) if (z % 5 === 0) g.set(side > 0 ? x : W - 1 - x, 1, z, BONE);
    }
    if (outer) g.set(side > 0 ? W - 1 : 0, 1, 0, CLAW);
    return { grid: g, origin: [side > 0 ? 0 : W, 1.5, 1] };
  };
  // --- leg: thigh and shin down to claws
  const leg = new VoxGrid(4, 12, 4, S), LC = (rgb, m) => leg.c(rgb, m);
  const L1 = LC(0x1A191E, MAT_PAINT), L2 = LC(0x9A94A4, MAT_METAL);
  leg.box(0, 5, 0, 3, 11, 3, L1); leg.box(1, 1, 1, 2, 5, 2, L1); leg.box(0, 0, 0, 3, 0, 3, L2);
  voxModel(gl, 'dragon', {
    body: { grid: body, origin: [cx + 0.5, cy + 0.5, BL / 2] }, neck: { grid: neck, origin: [3.5, 3.5, 6] }, tail: { grid: tail, origin: [3, 3, 0] },
    head: { grid: head, origin: [5.5, 3.5, 14] }, jaw: { grid: jaw, origin: [4.5, 3, 12] },
    wingInR: wing(false, 1), wingOutR: wing(true, 1), wingInL: wing(false, -1), wingOutL: wing(true, -1),
    leg: { grid: leg, origin: [2, 12, 2] },
  });
  // --- end crystal: two nested glass frames tumbling around a glowing core
  const frame = (n) => {
    const g = new VoxGrid(n, n, n, S), F = g.c(0xD8C8F0, MAT_GLASS);
    for (let a = 0; a < n; a++) for (const [b, c] of [[0, 0], [0, n - 1], [n - 1, 0], [n - 1, n - 1]]) { g.set(a, b, c, F); g.set(b, a, c, F); g.set(b, c, a, F); }
    return { grid: g, origin: [n / 2, n / 2, n / 2] };
  };
  const core = new VoxGrid(4, 4, 4, S); const CR = core.c(0xFF6ADA, MAT_GLOW), CR2 = core.c(0xC03AC0, MAT_GLOW);
  core.each((x, y, z) => ((x + y + z) & 1 ? CR : CR2));
  voxModel(gl, 'crystal', { outer: frame(10), inner: frame(7), core: { grid: core, origin: [2, 2, 2] } });
}
// ---------------------------------------------------------------- drawing
function drawEndEntities(game, R) {
  const gl = R.gl, w = game.world, pr = R.progs.vox, u = pr.u, a = game.alpha;
  let started = false;
  const start = () => {
    if (started) return; started = true;
    gl.useProgram(pr.p); R.setEnvUniforms(pr);
    gl.uniformMatrix4fv(u.uProj, false, R.vp);
    if (R.shadow && u.uShadowMap) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.shadow.tex); gl.uniform1i(u.uShadowMap, 1); }
    gl.uniform1f(u.uPulse, R.time); gl.uniform1f(u.uAlphaV, 1); gl.uniform1f(u.uGlow, 0);
    gl.enable(gl.CULL_FACE);
  };
  const M = drawEndEntities.M || (drawEndEntities.M = M4.create()), N = drawEndEntities.N || (drawEndEntities.N = M4.create());
  const draw = (part, m) => { gl.uniformMatrix4fv(u.uModel, false, m); gl.bindVertexArray(part.vao); gl.drawArrays(gl.TRIANGLES, 0, part.count); };
  for (const e of w.entities) {
    if (e.removed) continue;
    if (e.isCrystal) {
      const dx = e.x - R.camX, dz = e.z - R.camZ; if (dx * dx + dz * dz > 200 * 200) continue;
      const y = e.iy(a) + 1.1 + Math.sin((e.age + a) * 0.08) * 0.25;
      if (!R.boxVisible(dx - 2, y - 2 - R.camY, dz - 2, dx + 2, y + 2 - R.camY, dz + 2)) continue;
      start();
      gl.uniform2f(u.uLightE, 1, 1); gl.uniform1f(u.uHurtV, 0);
      const md = VOX_MODELS.crystal, t = (e.age + a) * 0.05 + e.spin;
      for (const [k, ax, sp] of [['outer', 0, 1], ['inner', 1, -1.3], ['core', 2, 0.7]]) {
        M4.identity(M); M4.translate(M, e.x - R.camX, y - R.camY, e.z - R.camZ);
        M4.rotY(M, t * sp); if (ax === 0) M4.rotX(M, t * 0.7); else if (ax === 1) M4.rotZ(M, t * 0.9); else M4.rotX(M, 0.785);
        if (ax === 2) M4.rotZ(M, 0.615);
        draw(md.parts[k], M);
      }
    } else if (e.isBoss) {
      const dx = e.x - R.camX, dz = e.z - R.camZ; if (dx * dx + dz * dz > 400 * 400) continue;
      if (!R.boxVisible(dx - 16, e.y - 16 - R.camY, dz - 16, dx + 16, e.y + 16 - R.camY, dz + 16)) continue;
      start();
      const P = e._rp = e.poseAt(a, e._rp || {}), md = VOX_MODELS.dragon;
      const l0 = w.getLight(Math.floor(P.p[0]), Math.floor(P.p[1] + 2), Math.floor(P.p[2]));
      gl.uniform2f(u.uLightE, Math.max(0.55, (l0 >> 4) / 15), (l0 & 15) / 15);
      gl.uniform1f(u.uHurtV, e.hurtTime > 0 ? 1 : 0);
      // dissolving at death: fade out over the last seconds
      const fade = e.phase === 'dying' ? clamp(1 - (e.deathT - 120) / 80, 0, 1) : 1;
      if (fade < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(u.uAlphaV, fade); }
      frameMatrix(M, P.p, P.f, P.u, R); draw(md.parts.body, M);
      for (const s of P.neck) { frameMatrix(M, s.p, s.f, P.u, R); draw(md.parts.neck, M); }
      frameMatrix(M, P.head.p, P.head.f, P.u, R); draw(md.parts.head, M);
      N.set(M); M4.translate(N, 0, -0.2, -0.4); M4.rotX(N, -P.jaw); draw(md.parts.jaw, N);
      for (let i = 0; i < P.tail.length; i++) { const s = P.tail[i], k = 1 - i * 0.06; frameMatrix(M, s.p, s.f, P.u, R); M4.scale(M, k, k, 1); draw(md.parts.tail, M); }
      for (const sd of [1, -1]) {
        frameMatrix(M, P.p, P.f, P.u, R); M4.translate(M, sd * 1.35, 0.85, -1.9);
        M4.rotZ(M, -sd * P.wingIn); draw(md.parts[sd > 0 ? 'wingInR' : 'wingInL'], M);
        M4.translate(M, sd * 4.6, 0, 0); M4.rotZ(M, -sd * P.wingOut); draw(md.parts[sd > 0 ? 'wingOutR' : 'wingOutL'], M);
      }
      for (const [lx, lz] of [[1.2, -2.0], [-1.2, -2.0], [1.3, 2.2], [-1.3, 2.2]]) {
        frameMatrix(M, P.p, P.f, P.u, R); M4.translate(M, lx, -1.0, lz); M4.rotX(M, -(1 - P.legs) * 1.1 - 0.1); draw(md.parts.leg, M);
      }
      if (fade < 1) { gl.disable(gl.BLEND); gl.uniform1f(u.uAlphaV, 1); }
    }
  }
}
// additive effects: crystal healing beams and the dragon's death rays
function drawEndFX(game, R) {
  const w = game.world, a = game.alpha;
  for (const e of w.entities) {
    if (e.removed || !e.isBoss) continue;
    const P = e._rp || e.pose; if (!P) continue;
    if (e.healCrystal && !e.healCrystal.removed) {
      const c = e.healCrystal, cy = c.y + 1.1 + Math.sin((c.age + a) * 0.08) * 0.25;
      const fl = 0.6 + Math.sin(R.time * 9) * 0.25;
      R.fxBeam(c.x, cy, c.z, P.p[0], P.p[1], P.p[2], 0.22, 1.0, 0.45, 0.95, fl);
      R.fxBeam(c.x, cy, c.z, P.p[0], P.p[1], P.p[2], 0.07, 1.0, 0.85, 1.0, fl * 1.5);
    }
    if (e.phase === 'dying') {
      // shafts of light bursting out of the body, more and longer as it dies
      const n = Math.min(24, 4 + (e.deathT / 8) | 0), rr = new RNG(4321);
      for (let i = 0; i < n; i++) {
        const t = R.time * (0.2 + rr.next() * 0.3) + rr.next() * 10, x = Math.cos(t) * Math.cos(t * 0.7 + i), y = Math.sin(t * 0.7 + i * 1.3), z = Math.sin(t) * Math.cos(t * 0.7 + i);
        const len = 6 + rr.next() * 10 + e.deathT * 0.05;
        R.fxBeam(P.p[0], P.p[1], P.p[2], P.p[0] + x * len, P.p[1] + y * len, P.p[2] + z * len, 0.35 + rr.next() * 0.4, 1.0, 0.75, 1.0, 0.25 + Math.min(0.5, e.deathT / 300));
      }
    }
  }
  for (const e of w.entities) if (!e.removed && e.isCrystal) { const y = e.iy(a) + 1.1 + Math.sin((e.age + a) * 0.08) * 0.25; R.fxSprite(e.x, y, e.z, 1.1, 1.0, 0.45, 0.9, 0.35 + Math.sin(R.time * 4 + e.spin) * 0.1); }
}
