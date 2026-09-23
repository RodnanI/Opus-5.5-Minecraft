// ============================================================================
//  Futuristic vehicles: STORMCROW interceptor jet, MANTIS VTOL gunship and
//  VIPER hover bike. Physics run every frame (fixed sub-steps), velocities are
//  in blocks per second. Local frame: forward -Z, up +Y, right +X.
// ============================================================================
const Q = {
  axis(out, x, y, z, a) { const s = Math.sin(a / 2); out[0] = x * s; out[1] = y * s; out[2] = z * s; out[3] = Math.cos(a / 2); return out; },
  mul(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
    out[0] = aw * bx + ax * bw + ay * bz - az * by; out[1] = aw * by - ax * bz + ay * bw + az * bx;
    out[2] = aw * bz + ax * by - ay * bx + az * bw; out[3] = aw * bw - ax * bx - ay * by - az * bz; return out;
  },
  norm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l; return q; },
  rot(q, vx, vy, vz, out) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
    out[0] = vx + w * tx + (y * tz - z * ty); out[1] = vy + w * ty + (z * tx - x * tz); out[2] = vz + w * tz + (x * ty - y * tx); return out;
  },
  // rotate world vector into local frame (conjugate rotation)
  inv(q, vx, vy, vz, out) { const c = Q._c || (Q._c = [0, 0, 0, 1]); c[0] = -q[0]; c[1] = -q[1]; c[2] = -q[2]; c[3] = q[3]; return Q.rot(c, vx, vy, vz, out); },
  toMat(q, m) {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    m[0] = 1 - 2 * (y * y + z * z); m[1] = 2 * (x * y + z * w); m[2] = 2 * (x * z - y * w); m[3] = 0;
    m[4] = 2 * (x * y - z * w); m[5] = 1 - 2 * (x * x + z * z); m[6] = 2 * (y * z + x * w); m[7] = 0;
    m[8] = 2 * (x * z + y * w); m[9] = 2 * (y * z - x * w); m[10] = 1 - 2 * (x * x + y * y); m[11] = 0;
    return m;
  },
  // heading / pitch / roll (radians) -> quaternion, matching the camera yaw convention
  fromHPR(out, yaw, pitch, roll) {
    const a = Q._a || (Q._a = [0, 0, 0, 1]), b = Q._b || (Q._b = [0, 0, 0, 1]);
    Q.axis(out, 0, 1, 0, -yaw); Q.axis(a, 1, 0, 0, pitch); Q.mul(out, out, a); Q.axis(b, 0, 0, -1, roll); return Q.mul(out, out, b);
  },
};
const VEH_DEFS = {
  jet: { name: 'Stormcrow Interceptor', item: 'stormcrow_jet', model: 'jet', w: 4.4, h: 1.9, yoff: 0.8125, hull: 140, enclosed: true, cockpit: [0, 0.5, -2.0], camDist: 14, camH: 3.4, radius: 3.2 },
  gunship: { name: 'Mantis VTOL Gunship', item: 'mantis_gunship', model: 'gunship', w: 4.2, h: 1.9, yoff: 0.47, hull: 200, enclosed: true, cockpit: [0, 0.32, -2.3], camDist: 15, camH: 4.4, radius: 3.8 },
  bomber: { name: 'Wraith Flying-Wing Bomber', item: 'wraith_bomber', model: 'bomber', w: 5.2, h: 1.6, yoff: 0.75, hull: 230, enclosed: true, cockpit: [0, 0.55, -1.6], camDist: 17, camH: 4.2, radius: 4.6 },
  tank: { name: 'Bastion Hover Tank', item: 'bastion_tank', model: 'tank', w: 4.0, h: 1.7, yoff: 0.05, hull: 320, enclosed: true, cockpit: [0, 1.9, 0.2], camDist: 11, camH: 3.4, radius: 3.8 },
  bike: { name: 'Viper Hover Bike', item: 'viper_bike', model: 'bike', w: 1.4, h: 1.1, yoff: 0.1, hull: 70, enclosed: false, seat: [0, 0.6, 0.12], cockpit: [0, 1.9, 0.35], camDist: 6.8, camH: 2.3, radius: 1.6 },
};
const _v3 = [0, 0, 0], _v4 = [0, 0, 0], _v5 = [0, 0, 0];
class Vehicle extends Entity {
  constructor(kind, x, y, z, yaw) {
    super('vehicle', x, y, z);
    const d = this.def = VEH_DEFS[kind];
    this.kind = kind; this.isVehicle = true; this.persistent = true; this.fireImmune = true;
    this.w = d.w; this.h = d.h; this.gravity = 0;
    this.q = Q.fromHPR([0, 0, 0, 1], yaw || 0, 0, 0);
    this.yaw = yaw || 0; this.pitchA = 0; this.rollA = 0;
    this.vel = [0, 0, 0]; this.av = [0, 0, 0];
    this.hull = d.hull; this.rider = null; this.onGround = true;
    this.fwd = [0, 0, -1]; this.upv = [0, 1, 0]; this.rightv = [1, 0, 0];
    this.boost = 1; this.boosting = false; this.heat = 0; this.overheat = 0; this.cd1 = 0; this.cd2 = 0;
    this.hurtT = 0; this.punch = 0; this.punchT = 0; this.warn = ''; this.engine = 0; this.t = 0;
    this.lock = null; this.lockT = 0; this.zoom = 1;
    this.updateAxes();
  }
  updateAxes() { Q.rot(this.q, 0, 0, -1, this.fwd); Q.rot(this.q, 0, 1, 0, this.upv); Q.rot(this.q, 1, 0, 0, this.rightv); }
  get speed() { return Math.hypot(this.vel[0], this.vel[1], this.vel[2]); }
  center(out) { out[0] = this.x; out[1] = this.y + this.def.yoff; out[2] = this.z; return out; }
  // world position of a point given in model space
  local(lx, ly, lz, out) { Q.rot(this.q, lx, ly, lz, out); out[0] += this.x; out[1] += this.y + this.def.yoff; out[2] += this.z; return out; }
  heading() { return Math.atan2(this.fwd[0], -this.fwd[2]); }
  // ------------------------------------------------------------ riding
  interact(player) { if (player.vehicle || this.rider || this.dead) return false; this.mount(player); return true; }
  mount(p) {
    const g = this.game;
    this.rider = p; p.vehicle = this; p.vcam = p.vcam || 0; p.sneaking = false; p.sprinting = false; p.flying = false;
    p.yaw = this.heading(); p.pitch = this.kind === 'jet' ? Math.asin(clamp(this.fwd[1], -1, 1)) : -0.12;
    this.syncRider(p);
    g.audio.play('veh_enter', {});
    this.mountT = 9;
    g.input.updateTouchVisibility();
  }
  dismount(silent) {
    const p = this.rider; if (!p) return;
    const w = this.world;
    this.rider = null; p.vehicle = null; this.boosting = false;
    const tries = [[this.rightv[0], this.rightv[2]], [-this.rightv[0], -this.rightv[2]], [-this.fwd[0], -this.fwd[2]], [this.fwd[0], this.fwd[2]]];
    let placed = false;
    const off = this.def.w / 2 + 0.9;
    for (const [dx, dz] of tries) {
      const x = this.x + dx * off, z = this.z + dz * off;
      for (let dy = 0; dy <= 3 && !placed; dy++) {
        const y = Math.floor(this.y) + dy;
        if (!SOLID[w.getId(Math.floor(x), y, Math.floor(z))] && !SOLID[w.getId(Math.floor(x), y + 1, Math.floor(z))]) { p.x = x; p.y = y + 0.01; p.z = z; placed = true; }
      }
      if (placed) break;
    }
    if (!placed) { p.x = this.x; p.y = this.y + this.h + 0.2; p.z = this.z; }
    p.vx = this.vel[0] / 20 * 0.4; p.vy = Math.max(0, this.vel[1] / 20 * 0.4); p.vz = this.vel[2] / 20 * 0.4; p.fallDist = 0;
    // ejection seat: bailing out high up does not turn into a lethal fall
    if (!p.creative && (this.agl || 0) > 3) p.fallDist = -Math.min(24, this.agl);
    p.savePrev();
    if (!silent) this.game.audio.play('veh_exit', {});
    this.game.input.updateTouchVisibility();
  }
  syncRider(p) {
    const d = this.def, o = _v5;
    if (d.seat) this.local(d.seat[0], d.seat[1], d.seat[2], o); else this.local(d.cockpit[0], d.cockpit[1], d.cockpit[2], o);
    p.x = o[0]; p.z = o[2]; p.y = d.seat ? o[1] - 0.72 : o[1] - 1.62;
    p.lx = p.x; p.ly = p.y; p.lz = p.z; p.vx = p.vy = p.vz = 0; p.fallDist = 0; p.onGround = true;
    p.bodyYaw = this.heading();
  }
  // ------------------------------------------------------------ damage
  hurt(amount, src) {
    if (this.dead || this.removed) return false;
    const g = this.game;
    const t = src && src.type;
    const s = src && src.source;
    // punches from an on-foot player knock the vehicle loose (drops it as an item) like boats
    if (t === 'mob' && s && s.isPlayer && !this.rider) {
      if (s.creative) { this.removed = true; g.audio.play('veh_exit', { x: this.x, y: this.y, z: this.z }); return true; }
      this.punch += 1; this.punchT = 30; this.hurtT = 8;
      g.audio.play('hit', { x: this.x, y: this.y, z: this.z, vol: 0.6 });
      if (this.punch >= 4) { this.removed = true; g.dropItem(this.world, this.x, this.y + 0.5, this.z, { id: I[this.def.item], n: 1, d: 0 }); }
      return true;
    }
    if (s && (s === this || s === this.rider)) amount *= t === 'explosion' ? 0.35 : 0;
    if (amount <= 0) return false;
    this.hull -= amount; this.hurtT = 8;
    if (this.rider === g.player) g.shake = Math.max(g.shake || 0, Math.min(0.5, amount * 0.02));
    if (this.hull <= 0) this.destroy();
    return true;
  }
  destroy() {
    if (this.dead) return;
    this.dead = true; this.removed = true;
    const g = this.game, p = this.rider;
    if (p) { this.dismount(true); if (!p.creative) p.hurt(this.def.enclosed ? 8 : 5, { type: 'explosion' }); p.vy = 0.8; }
    const c = this.center(_v3);
    explode(this.world, c[0], c[1], c[2], this.kind === 'bike' ? 2.5 : 4, true, this);
  }
  // ------------------------------------------------------------ helpers
  groundAt(x, z, y0, depth, fluids) {
    const hit = raycast(this.world, x, y0, z, 0, -1, 0, depth, fluids);
    return hit ? y0 - hit.t : -1e9;
  }
  pointSolid(x, y, z) { const id = this.world.getId(Math.floor(x), Math.floor(y), Math.floor(z)); return SOLID[id] && !PLANT[id]; }
  tick() {
    this.age++;
    if (this.hurtT > 0) this.hurtT--;
    if (this.punchT > 0 && --this.punchT === 0) this.punch = 0;
    if (!this.rider && this.hull < this.def.hull && this.age % 40 === 0) this.hull = Math.min(this.def.hull, this.hull + 1);
    if (this.y < -64) this.removed = true;
  }
  // per-frame update entry; sub-steps keep collisions stable at high speed
  frame(dt, inp) {
    this.t += dt;
    const sp = this.speed;
    const steps = Math.max(1, Math.min(8, Math.ceil(sp * dt / 0.45)));
    const h = dt / steps;
    for (let i = 0; i < steps && !this.removed; i++) this.step(h, inp);
    if (this.removed) return;
    this.updateAxes();
    this.lx = this.x; this.ly = this.y; this.lz = this.z;
    this.yaw = this.heading();
    if (this.rider) this.syncRider(this.rider);
    // regen / cooling
    if (!this.boosting) this.boost = Math.min(1, this.boost + dt * 0.12);
    this.heat = Math.max(0, this.heat - dt * (this.overheat > 0 ? 0.55 : 0.32));
    if (this.overheat > 0) this.overheat = Math.max(0, this.overheat - dt);
    this.cd1 = Math.max(0, this.cd1 - dt); this.cd2 = Math.max(0, this.cd2 - dt);
    if (this.rider) this.weapons(dt, inp);
    if (this.mountT > 0) this.mountT -= dt;
    this.sound(dt);
  }
  addHeat(v) { this.heat += v; if (this.heat >= 1) { this.heat = 1; this.overheat = 1.6; if (this.rider) this.game.audio.play('veh_overheat', {}); } }
  impulses() { if (this.vx || this.vy || this.vz) { this.vel[0] += this.vx * 7; this.vel[1] += this.vy * 7; this.vel[2] += this.vz * 7; this.vx = this.vy = this.vz = 0; } }
  aimDir(out) { const p = this.rider; if (!p) { out[0] = this.fwd[0]; out[1] = this.fwd[1]; out[2] = this.fwd[2]; return out; } const cp = Math.cos(p.pitch); out[0] = Math.sin(p.yaw) * cp; out[1] = Math.sin(p.pitch); out[2] = -Math.cos(p.yaw) * cp; return out; }
  // where the rider is aiming: first block / entity along the camera aim ray (for turret weapons)
  aimPoint(out, range) {
    const g = this.game, c = g.camera, d = this.aimDir(_v4);
    const hit = raycast(this.world, c.x, c.y, c.z, d[0], d[1], d[2], range, false);
    const t = hit ? hit.t : range;
    out[0] = c.x + d[0] * t; out[1] = c.y + d[1] * t; out[2] = c.z + d[2] * t;
    return out;
  }
  sound(dt) { const g = this.game; if (g.audio && g.audio.engine) g.audio.engine(this, this.engineSpec()); }
  engineSpec() { return null; }
  // chase / cockpit camera
  cameraUpdate(c, dt, p) {
    const d = this.def, cen = this.center(_v3), aim = this.aimDir(_v4);
    const S = SETTINGS, sp = this.speed;
    if (p.vcam === 1) {
      const e = this.local(d.cockpit[0], d.cockpit[1], d.cockpit[2], _v5);
      c.x = e[0]; c.y = e[1]; c.z = e[2];
      c.yaw = p.yaw; c.pitch = p.pitch; c.roll = this.kind === 'jet' ? this.bankAngle() * 0.6 : this.rollA * 0.5;
    } else {
      const dist = d.camDist * (p.vcam === 2 ? 1.7 : 1) * this.zoom * (1 + Math.min(1, sp / 120) * 0.12);
      const hy = d.camH * (p.vcam === 2 ? 1.4 : 1);
      let tx = cen[0] - aim[0] * dist, ty = cen[1] - aim[1] * dist + hy, tz = cen[2] - aim[2] * dist;
      const dx = tx - cen[0], dy = ty - cen[1], dz = tz - cen[2], dl = Math.hypot(dx, dy, dz) || 1;
      const hit = raycast(this.world, cen[0], cen[1] + 0.5, cen[2], dx / dl, dy / dl, dz / dl, dl, false);
      if (hit) { const k = Math.max(1.2, hit.t - 0.4) / dl; tx = cen[0] + dx * k; ty = cen[1] + 0.5 + dy * k; tz = cen[2] + dz * k; }
      const cs = this.camOff || (this.camOff = [tx - cen[0], ty - cen[1], tz - cen[2]]);
      const a = 1 - Math.exp(-dt * 14);
      cs[0] += (tx - cen[0] - cs[0]) * a; cs[1] += (ty - cen[1] - cs[1]) * a; cs[2] += (tz - cen[2] - cs[2]) * a;
      c.x = cen[0] + cs[0]; c.y = cen[1] + cs[1]; c.z = cen[2] + cs[2];
      c.yaw = p.yaw; c.pitch = p.pitch; c.roll = 0;
    }
    const tf = S.fov + Math.min(22, sp * 0.16) + (this.boosting ? 8 : 0);
    this.fovS = this.fovS === undefined ? tf : this.fovS + (tf - this.fovS) * Math.min(1, dt * 4);
    c.fov = this.fovS;
  }
  bankAngle() { return Math.atan2(-this.rightv[1], this.upv[1]); }
  // highest ground (or water surface) under a set of probe points given as [forward, right] offsets
  hoverGround(probes, yaw) {
    const w = this.world, fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    let gmax = -1e9;
    for (let i = 0; i < probes.length; i++) {
      const pf = probes[i][0], pr = probes[i][1];
      const px = this.x + fx * pf + rx * pr, pz = this.z + fz * pf + rz * pr;
      const hit = raycast(w, px, this.y + 1.6, pz, 0, -1, 0, 6, true);
      if (hit) { const gy = FLUID[hit.id] ? hit.y + 0.9 : this.y + 1.6 - hit.t; if (gy > gmax) gmax = gy; }
    }
    return gmax;
  }
  probeDepth(yaw, pf, pr) {
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    const hit = raycast(this.world, this.x + fx * pf + rx * pr, this.y + 1.6, this.z + fz * pf + rz * pr, 0, -1, 0, 6, true);
    return hit ? hit.t : 6;
  }
  groundUnderBox() { const hit = raycast(this.world, this.x, this.y + 0.2, this.z, 0, -1, 0, 60, true); return hit ? this.y + 0.2 - hit.t : this.y - 60; }
  moveBox(dt) {
    const v = this.vel, oy = v[1];
    this.stepH = this.kind === 'bike' ? 1.05 : 0;
    moveEntity(this.world, this, v[0] * dt, v[1] * dt, v[2] * dt);
    if (this.collidedX || this.collidedZ) {
      const hs = Math.hypot(v[0], v[2]);
      if (hs > 22) this.hurt((hs - 20) * 0.8, { type: 'crash' });
      if (this.collidedX) v[0] *= -0.2; if (this.collidedZ) v[2] *= -0.2;
    }
    if (this.collidedV) { if (oy < -16) this.hurt((-oy - 14) * 1.2, { type: 'crash' }); v[1] = 0; }
    this.vx = this.vy = this.vz = 0;
  }
  serialize() {
    // airborne vehicles are stored parked on the ground below so a reload does not start with a crash
    const y = (this.agl || 0) > 2 ? this.world.heightAt(Math.floor(this.x), Math.floor(this.z)) + 0.05 : this.y;
    return { type: 'vehicle', kind: this.kind, x: this.x, y, z: this.z, yaw: this.heading(), hp: this.hull };
  }
  // ------------------------------------------------------------ rendering
  partMatrix(M, base, part, rot) {
    M.set(base);
    if (!rot) return M;
    if (rot.py) { const q = rot.py; M4.translate(M, q[0], q[1], q[2]); M4.rotY(M, rot.y); M4.translate(M, -q[0], -q[1], -q[2]); rot = rot.sub; }
    const pv = part.pivot;
    M4.translate(M, pv[0], pv[1], pv[2]);
    if (rot.y) M4.rotY(M, rot.y);
    if (rot.x) M4.rotX(M, rot.x);
    if (rot.z) M4.rotZ(M, rot.z);
    if (rot.yspin) M4.rotY(M, rot.yspin);
    M4.translate(M, -pv[0], -pv[1], -pv[2]);
    return M;
  }
  parts() { return null; }
  drawFX() { }
  lights() { }
}
const VEH_HELP = {
  jet: [['MOUSE', 'steer'], ['W/S', 'throttle'], ['CTRL', 'afterburner'], ['A/D', 'roll'], ['LMB', 'plasma'], ['RMB', 'missile (lock first)'], ['F', 'exit'], ['F5', 'camera'], ['WHEEL', 'zoom']],
  gunship: [['MOUSE', 'aim'], ['WASD', 'move'], ['SPACE/SHIFT', 'up/down'], ['CTRL', 'boost'], ['LMB', 'cutting laser'], ['RMB', 'rockets'], ['F', 'exit'], ['F5', 'camera']],
  bike: [['MOUSE', 'steer'], ['W/S', 'throttle'], ['A/D', 'strafe'], ['SPACE', 'hop'], ['CTRL', 'boost'], ['LMB', 'blasters'], ['RMB', 'hold to charge'], ['F', 'exit']],
  bomber: [['MOUSE', 'steer'], ['W/S', 'throttle'], ['CTRL', 'afterburner'], ['A/D', 'roll'], ['LMB', 'plasma'], ['RMB', 'hold: bay open + bombs'], ['F', 'exit'], ['F5', 'camera']],
  tank: [['MOUSE', 'aim turret'], ['W/S', 'drive'], ['A/D', 'turn hull'], ['CTRL', 'boost'], ['LMB', 'coax blaster'], ['RMB', 'plasma cannon'], ['F', 'exit'], ['F5', 'camera']],
};
// ---------------------------------------------------------------- STORMCROW
const JET_FP = { thrust: 48, ab: 62, drag: 0.0052, pMax: 1.45, pMin: -1.0, yMax: 0.7, rMax: 4.2, lift0: 16, liftR: 22, stall: 20, takeoff: 52, landMax: 58,
  pts: [[0, -0.05, -4.1], [-2.8, -0.1, 1.45], [2.8, -0.1, 1.45], [0, -0.2, 3.3], [0, -0.76, 0.4], [0, 1.1, 2.2]] };
const BOMBER_FP = { thrust: 40, ab: 42, drag: 0.0068, pMax: 0.85, pMin: -0.6, yMax: 0.4, rMax: 1.9, lift0: 12, liftR: 20, stall: 16, takeoff: 44, landMax: 52,
  pts: [[0, -0.05, -2.45], [-4.1, -0.05, 0.9], [4.1, -0.05, 0.9], [0, -0.05, 2.0], [0, -0.7, 0.1], [-1.45, 0.4, 1.3], [1.45, 0.4, 1.3]] };
class Jet extends Vehicle {
  constructor(x, y, z, yaw, kind) { super(kind || 'jet', x, y, z, yaw); this.fp = JET_FP; this.throttle = 0; this.gear = 1; this.missiles = 8; this.mReload = 0; this.side = 1; this.stall = false; }
  engineSpec() { return { kind: 'jet', thr: this.rider ? this.throttle : 0, ab: this.boosting ? 1 : 0, speed: this.speed }; }
  step(dt, inp) {
    this.impulses();
    const w = this.world, v = this.vel, g = 20;
    this.updateAxes();
    const f = this.fwd, u = this.upv, r = this.rightv;
    const sp = Math.hypot(v[0], v[1], v[2]);
    const ctl = !!(this.rider && inp);
    if (ctl) this.throttle = clamp(this.throttle + inp.f * dt * 0.7, 0, 1);
    else this.throttle = Math.max(0, this.throttle - dt * 0.5);
    this.boosting = ctl && inp.boost && this.boost > 0.02 && this.throttle > 0.2;
    if (this.boosting) this.boost = Math.max(0, this.boost - dt * 0.14);
    const FP = this.fp, thrust = this.throttle * FP.thrust + (this.boosting ? FP.ab : 0);
    this.engine += ((this.throttle + (this.boosting ? 0.6 : 0)) - this.engine) * Math.min(1, dt * 3);
    // ------------------------------------------------ ground roll
    if (this.onGround) {
      this.agl = 0;
      const vf = v[0] * f[0] + v[2] * f[2];
      let nv = vf + thrust * dt;
      nv -= Math.sign(nv) * Math.min(Math.abs(nv), (ctl && inp.down ? 30 : 3 + Math.abs(nv) * 0.05) * dt) + nv * Math.abs(nv) * FP.drag * dt;
      if (ctl && this.throttle < 0.02 && inp.f < 0) nv = Math.max(-4, nv - 12 * dt);
      let yaw = this.heading();
      const aimYaw = ctl ? this.rider.yaw : yaw;
      const turn = clamp(angleDiff(yaw, aimYaw), -1, 1) * clamp(1.4 - Math.abs(nv) / 60, 0.25, 1.4) * dt * 1.8;
      yaw += turn;
      let pitch = this.pitchA;
      const wantUp = ctl && ((this.rider.pitch > 0.06 && nv > FP.takeoff * 0.5) || nv > FP.takeoff);
      pitch += ((wantUp ? 0.2 : 0) - pitch) * Math.min(1, dt * 3);
      this.pitchA = pitch;
      Q.fromHPR(this.q, yaw, pitch, 0); this.updateAxes();
      const fx = Math.sin(yaw), fz = -Math.cos(yaw);
      v[0] = fx * nv; v[2] = fz * nv; v[1] = 0;
      if (wantUp && pitch > 0.12) { this.onGround = false; v[1] = nv * 0.18; this.av[0] = 0.2; this.gear = 1; this.game.audio.play('veh_liftoff', { x: this.x, y: this.y, z: this.z, vol: 0.6 }); }
      const nx = this.x + v[0] * dt, nz = this.z + v[2] * dt;
      const gy = this.groundUnder(nx, nz, this.y + 1.2, 3.5);
      if (gy < -1e8) { this.onGround = false; }
      else if (gy > this.y + 1.05 || this.pointSolid(nx + fx * 3.2, this.y + 1.2, nz + fz * 3.2)) { if (Math.abs(nv) > 18) this.hurt(Math.abs(nv) * 0.6, { type: 'crash' }); v[0] = v[2] = 0; this.game.shake = 0.3; }
      else { this.x = nx; this.z = nz; this.y = gy; }
      return;
    }
    // ------------------------------------------------ flight
    let vf = v[0] * f[0] + v[1] * f[1] + v[2] * f[2], vu = v[0] * u[0] + v[1] * u[1] + v[2] * u[2], vr = v[0] * r[0] + v[1] * r[1] + v[2] * r[2];
    const qd = clamp(sp / 38, 0, 1.6);
    vu *= Math.exp(-4.2 * qd * dt); vr *= Math.exp(-5 * qd * dt);
    const turnRate = Math.hypot(this.av[0], this.av[1]);
    vf += thrust * dt - (vf * Math.abs(vf) * FP.drag + turnRate * Math.abs(vf) * 0.05) * dt;
    if (ctl && inp.down) vf -= vf * 0.9 * dt;
    v[0] = f[0] * vf + u[0] * vu + r[0] * vr; v[1] = f[1] * vf + u[1] * vu + r[1] * vr; v[2] = f[2] * vf + u[2] * vu + r[2] * vr;
    const lift = g * clamp((sp - FP.lift0) / FP.liftR, 0, 1.05);
    v[0] += u[0] * lift * dt; v[1] += (u[1] * lift - g) * dt; v[2] += u[2] * lift * dt;
    this.stall = sp < FP.stall;
    // ------------------------------------------------ mouse-aim flight controller
    const auth = clamp(sp / 34, 0.3, 1.0);
    let pc = 0, yc = 0, rc = 0;
    if (ctl) {
      const aim = this.aimDir(_v4), a = Q.inv(this.q, aim[0], aim[1], aim[2], _v5);
      const ang = Math.acos(clamp(-a[2], -1, 1));
      pc = clamp(Math.atan2(a[1], -a[2]) * 2.8, FP.pMin, FP.pMax);
      yc = clamp(Math.atan2(a[0], -a[2]) * 1.6, -FP.yMax, FP.yMax);
      const bank = this.bankAngle();
      const rollErr = Math.atan2(a[0], a[1]);
      const want = smoothstep(0.04, 0.35, ang);
      const levelCmd = -bank * 2.2 + clamp(Math.atan2(a[0], -a[2]) * 5, -0.9, 0.9);
      rc = clamp(rollErr * 4.5, -FP.rMax, FP.rMax) * want + levelCmd * (1 - want);
      if (Math.abs(inp.s) > 0.1) rc = inp.s * FP.rMax;
    } else { pc = -0.2; rc = -this.bankAngle() * 1.5; }
    const k = 1 - Math.exp(-dt * 7);
    this.av[0] += (pc * auth - this.av[0]) * k; this.av[1] += (yc * auth - this.av[1]) * k; this.av[2] += (rc * Math.min(1, auth + 0.3) - this.av[2]) * k;
    const dq = Q._d || (Q._d = [0, 0, 0, 1]), t1 = Q._t1 || (Q._t1 = [0, 0, 0, 1]);
    Q.axis(dq, 1, 0, 0, this.av[0] * dt); Q.mul(this.q, this.q, dq);
    Q.axis(t1, 0, -1, 0, this.av[1] * dt); Q.mul(this.q, this.q, t1);
    Q.axis(t1, 0, 0, -1, this.av[2] * dt); Q.mul(this.q, this.q, t1);
    Q.norm(this.q);
    // ------------------------------------------------ move + collide
    const nx = this.x + v[0] * dt, ny = this.y + v[1] * dt, nz = this.z + v[2] * dt;
    const yo = this.def.yoff;
    const pts = FP.pts;
    let hit = -1;
    for (let i = 0; i < pts.length; i++) {
      Q.rot(this.q, pts[i][0], pts[i][1], pts[i][2], _v3);
      const px = nx + _v3[0], py = ny + yo + _v3[1], pz = nz + _v3[2];
      if (this.pointSolid(px, py, pz) || (i === 4 && FLUID[w.getId(Math.floor(px), Math.floor(py), Math.floor(pz))] === 1)) { hit = i; break; }
    }
    if (hit >= 0) {
      const vy = v[1], level = u[1] > 0.9 && Math.abs(f[1]) < 0.3;
      const gy = this.groundUnder(nx, nz, ny + 2.5, 4.5);
      if ((hit === 4 || hit === 0 && vy < 0) && level && vy > -9 && sp < FP.landMax && gy > -1e8) {
        this.onGround = true; this.y = gy; this.x = nx; this.z = nz; v[1] = 0;
        const yaw = this.heading(); this.pitchA = 0; Q.fromHPR(this.q, yaw, 0, 0); this.av[0] = this.av[1] = this.av[2] = 0;
        this.game.audio.play('veh_land', { x: this.x, y: this.y, z: this.z, vol: 0.8 });
        if (this.rider === this.game.player) this.game.shake = 0.25;
        return;
      }
      if (sp > 34) { this.hurt(this.hull + 1, { type: 'crash' }); return; }
      this.hurt(sp * 1.1, { type: 'crash' });
      v[0] *= -0.25; v[1] = Math.abs(v[1]) * 0.3 + 3; v[2] *= -0.25;
      this.game.shake = 0.5;
      return;
    }
    this.x = nx; this.y = ny; this.z = nz;
    // auto gear below 45 b/s near the ground
    const agl = this.y - this.groundUnder(this.x, this.z, this.y, 40);
    this.agl = agl;
    this.gear += ((agl < 14 && sp < 50 ? 1 : 0) - this.gear) * Math.min(1, dt * 2.5);
    this.warn = '';
    if (this.rider) {
      const tti = v[1] < -1 ? agl / -v[1] : 99;
      if (tti < 2.6 && agl < 60 && !(u[1] > 0.9 && sp < FP.landMax && v[1] > -9)) this.warn = 'PULL UP';
      else if (this.stall && agl > 3) this.warn = 'STALL';
    }
  }
  groundUnder(x, z, y0, depth) {
    const hit = raycast(this.world, x, y0, z, 0, -1, 0, depth, true);
    if (!hit) return -1e9;
    if (hit.boxes && hit.boxes.length && FLUID[hit.id]) return hit.y + 0.9;
    return y0 - hit.t;
  }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M || !inp) return;
    // plasma cannons from alternating wing-root muzzles
    if (inp.fire1 && this.cd1 <= 0 && this.overheat <= 0) {
      this.cd1 = 0.075; this.side = -this.side;
      const m = this.local(this.side * 1.45, -0.15, -1.9, _v3);
      const f = this.fwd, sp = Math.max(0, this.vel[0] * f[0] + this.vel[1] * f[1] + this.vel[2] * f[2]);
      const s = 0.012;
      M.bolt(this, m[0], m[1], m[2], f[0] + (Math.random() - 0.5) * s, f[1] + (Math.random() - 0.5) * s, f[2] + (Math.random() - 0.5) * s, 300 + sp, { dmg: 7, color: [1.0, 0.55, 0.16], size: 0.2, len: 7, life: 1.6, sound: 'plasma' });
      this.addHeat(0.028);
      this.muzzle = 0.06;
    }
    // missile lock: target closest to the nose within a cone
    if (this.mReload > 0) { this.mReload -= dt; if (this.mReload <= 0 && this.missiles < 8) { this.missiles++; this.mReload = this.missiles < 8 ? 2.4 : 0; } }
    // keep the current lock while it stays inside a wider cone (hysteresis)
    const cur = this.lock;
    let tgt = null;
    if (cur && !cur.dead && !cur.removed) {
      const c = this.center(_v4), dx = cur.x - c[0], dy = cur.y + cur.h * 0.5 - c[1], dz = cur.z - c[2], d = Math.hypot(dx, dy, dz) || 1;
      if (d < 360 && (dx * this.fwd[0] + dy * this.fwd[1] + dz * this.fwd[2]) / d > Math.cos(0.33)) tgt = cur;
    }
    if (!tgt) tgt = M.findTarget(this, this.fwd, 0.22, 320);
    if (tgt && tgt === this.lock) this.lockT = Math.min(1, this.lockT + dt / 0.8);
    else { this.lock = tgt; this.lockT = 0; }
    if (inp.fire2 && this.cd2 <= 0 && this.missiles > 0) {
      this.cd2 = 0.45; this.missiles--; if (this.mReload <= 0) this.mReload = 2.4;
      const slot = this.missiles % 4, xs = [-1.75, 1.75, -1.25, 1.25][slot];
      const m = this.local(xs, -0.35, 0.3, _v3), f = this.fwd;
      M.missile(this, m[0], m[1], m[2], f[0], f[1], f[2], this.speed, this.lockT >= 1 ? this.lock : null, { power: 3.2 });
    }
  }
  parts() {
    return { gear: this.gear > 0.5 ? {} : null, missiles: this.missiles > 0 ? {} : null };
  }
  drawFX(R) {
    const e = this.engine; if (e < 0.02 && !this.boosting) return;
    const f = this.fwd, len = 1.2 + e * 2.5 + (this.boosting ? 3.5 : 0);
    for (const sx of [-0.35, 0.35]) {
      const p = this.local(sx, 0, 3.55, _v3);
      const x0 = p[0], y0 = p[1], z0 = p[2];
      const k = 0.85 + Math.random() * 0.3;
      R.fxBeam(x0, y0, z0, x0 - f[0] * len * k, y0 - f[1] * len * k, z0 - f[2] * len * k, 0.2 + e * 0.07, 1.0, 0.42 + (this.boosting ? 0.18 : 0), 0.12, 0.3 + e * 0.3 + (this.boosting ? 0.25 : 0));
      R.fxSprite(x0, y0, z0, 0.36, 1.0, 0.55, 0.2, 0.35 + e * 0.4);
      if (this.boosting) for (let i = 1; i <= 3; i++) R.fxSprite(x0 - f[0] * i * 1.1, y0 - f[1] * i * 1.1, z0 - f[2] * i * 1.1, 0.22, 1.0, 0.75, 0.5, 0.28);
    }
    if (this.muzzle > 0) { const m = this.local(this.side * 1.45, -0.15, -2.2, _v3); R.fxSprite(m[0], m[1], m[2], 0.55, 1.0, 0.6, 0.2, 1.5); this.muzzle -= 0.02; }
    // blinking strobes
    if ((this.t % 1.2) < 0.08) { for (const sx of [-1, 1]) { const p = this.local(sx * 1.35 * 0.72, 1.2, 2.75, _v3); R.fxSprite(p[0], p[1], p[2], 0.5, 1, 1, 1, 1.4); } }
  }
  lights(R) {
    if (this.engine > 0.05) { const p = this.local(0, 0, 4.4, _v3); R.addLight(p[0], p[1], p[2], 7 + this.engine * 5 + (this.boosting ? 5 : 0), 1.0, 0.5, 0.18, 0.9 + this.engine); }
    if (this.muzzle > 0) { const p = this.local(0, -0.1, -2.2, _v3); R.addLight(p[0], p[1], p[2], 9, 1.0, 0.55, 0.2, 2.2); }
  }
}
// ---------------------------------------------------------------- MANTIS
class Gunship extends Vehicle {
  constructor(x, y, z, yaw) { super('gunship', x, y, z, yaw); this.rockets = 16; this.rReload = 0; this.fan = 0; this.fanSpeed = 0; this.tilt = 0; this.turretYaw = 0; this.turretPitch = 0; this.laserOn = 0; this.salvo = 0; this.salvoT = 0; }
  engineSpec() { return { kind: 'gunship', thr: this.fanSpeed / 60, speed: this.speed, boost: this.boosting ? 1 : 0 }; }
  step(dt, inp) {
    this.impulses();
    const v = this.vel, ctl = !!(this.rider && inp);
    let yaw = this.heading();
    this.boosting = ctl && inp.boost && this.boost > 0.02 && (inp.f || inp.s);
    if (this.boosting) this.boost = Math.max(0, this.boost - dt * 0.18);
    const maxS = this.boosting ? 46 : 26;
    let tx = 0, ty = 0, tz = 0;
    if (ctl) {
      yaw += clamp(angleDiff(yaw, this.rider.yaw), -2.2 * dt, 2.2 * dt);
      const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
      tx = (fx * inp.f + rx * inp.s * 0.75) * maxS; tz = (fz * inp.f + rz * inp.s * 0.75) * maxS;
      ty = ((inp.up ? 1 : 0) - (inp.down ? 1 : 0)) * 13;
      this.fanSpeed += (55 - this.fanSpeed) * Math.min(1, dt * 1.5);
    } else this.fanSpeed += ((this.onGround ? 0 : 30) - this.fanSpeed) * Math.min(1, dt * 0.8);
    const acc = 22 * dt;
    const lift = ctl || !this.onGround ? clamp(this.fanSpeed / 40, 0, 1) : 0;
    const dx = tx - v[0], dz = tz - v[2], dl = Math.hypot(dx, dz);
    if (dl > 0) { const k = Math.min(1, acc / dl); v[0] += dx * k; v[2] += dz * k; }
    if (ctl) v[1] += clamp(ty - v[1], -acc, acc); else { v[1] -= 20 * (1 - lift * 0.8) * dt; v[0] *= 1 - dt * 0.8; v[2] *= 1 - dt * 0.8; }
    if (this.onGround && !(ctl && inp.up)) { v[0] *= Math.max(0, 1 - dt * 6); v[2] *= Math.max(0, 1 - dt * 6); }
    this.moveBox(dt);
    // visual attitude
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    const vf = v[0] * fx + v[2] * fz, vr = v[0] * rx + v[2] * rz;
    const tp = this.onGround ? 0 : clamp(-vf / 46 * 0.35 + (ctl ? -inp.f * 0.06 : 0), -0.4, 0.4), tr = this.onGround ? 0 : clamp(vr / 30 * 0.35, -0.4, 0.4);
    this.pitchA += (tp - this.pitchA) * Math.min(1, dt * 3); this.rollA += (tr - this.rollA) * Math.min(1, dt * 3);
    Q.fromHPR(this.q, yaw, this.pitchA, this.rollA);
    this.tilt += (clamp(vf / 40, 0, 1) * 1.1 - this.tilt) * Math.min(1, dt * 2);
    this.fan += this.fanSpeed * dt;
    this.engine = this.fanSpeed / 55;
    this.agl = this.y - this.groundUnderBox();
    this.warn = this.hull < this.def.hull * 0.25 ? 'HULL CRITICAL' : '';
  }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M) return;
    const aimP = this.aimPoint(_v5, 220);
    const tp = this.local(0, -0.5, -2.44, _v3);
    const dx = aimP[0] - tp[0], dy = aimP[1] - tp[1], dz = aimP[2] - tp[2], dl = Math.hypot(dx, dy, dz) || 1;
    const l = Q.inv(this.q, dx / dl, dy / dl, dz / dl, _v4);
    this.turretYaw = clamp(Math.atan2(-l[0], -l[2]), -1.6, 1.6);
    this.turretPitch = clamp(Math.atan2(l[1], Math.hypot(l[0], l[2])), -1.2, 0.35);
    // continuous cutting laser
    this.laserOn = 0;
    if (inp.fire1 && this.overheat <= 0) {
      const d = Q.rot(this.q, -Math.sin(this.turretYaw) * Math.cos(this.turretPitch), Math.sin(this.turretPitch), -Math.cos(this.turretYaw) * Math.cos(this.turretPitch), _v4);
      M.laser(this, tp[0] + d[0] * 0.8, tp[1] + d[1] * 0.8, tp[2] + d[2] * 0.8, d[0], d[1], d[2], 200, dt, { dps: 38, color: [1.0, 0.22, 0.1], width: 0.12 });
      this.addHeat(dt * 0.5);
      this.laserOn = 1;
    }
    // rocket salvo: 4 rockets, alternating pods
    if (this.rReload > 0) { this.rReload -= dt; if (this.rReload <= 0 && this.rockets < 16) { this.rockets = Math.min(16, this.rockets + 4); this.rReload = this.rockets < 16 ? 3 : 0; } }
    if (inp.fire2 && this.cd2 <= 0 && this.rockets > 0 && this.salvo <= 0) { this.salvo = Math.min(4, this.rockets); this.salvoT = 0; this.cd2 = 1.1; }
    if (this.salvo > 0) {
      this.salvoT -= dt;
      if (this.salvoT <= 0) {
        this.salvoT = 0.09; this.salvo--; this.rockets--; if (this.rReload <= 0) this.rReload = 3;
        const side = (this.rockets & 1) ? 1 : -1;
        const m = this.local(side * 1.75, -0.12, -1.3, _v3);
        const ex = aimP[0] - m[0], ey = aimP[1] - m[1], ez = aimP[2] - m[2], el = Math.hypot(ex, ey, ez) || 1;
        const s = 0.025;
        M.rocket(this, m[0], m[1], m[2], ex / el + (Math.random() - 0.5) * s, ey / el + (Math.random() - 0.5) * s, ez / el + (Math.random() - 0.5) * s, { power: 2.4 });
      }
    }
  }
  parts() {
    const t = this.tilt;
    return { turret: { y: this.turretYaw, x: this.turretPitch }, nacL: { x: -t }, nacR: { x: -t }, fanL: { x: -t, yspin: this.fan }, fanR: { x: -t, yspin: -this.fan } };
  }
  drawFX(R) {
    const e = this.engine; if (e < 0.05) return;
    for (const side of [-1, 1]) {
      const p = this.local(side * 3.06, 0.12, -0.06, _v3);
      const down = Q.rot(this.q, 0, -Math.cos(this.tilt), Math.sin(this.tilt), _v4);
      for (let i = 0; i < 3; i++) { const k = 0.4 + i * 0.35; R.fxSprite(p[0] + down[0] * k, p[1] + down[1] * k, p[2] + down[2] * k, 0.75 - i * 0.15, 1.0, 0.62, 0.25, (0.35 - i * 0.08) * e * (this.boosting ? 1.8 : 1)); }
    }
    if ((this.t % 1.0) < 0.07) { const p = this.local(0, 1.4, 3.8, _v3); R.fxSprite(p[0], p[1], p[2], 0.45, 1, 0.25, 0.15, 1.5); }
  }
  lights(R) {
    if (this.laserOn && this.laserHit) R.addLight(this.laserHit[0], this.laserHit[1], this.laserHit[2], 8, 1.0, 0.3, 0.12, 2.5);
    if (this.engine > 0.1) { const c = this.center(_v3); R.addLight(c[0], c[1] - 1.5, c[2], 9, 1.0, 0.65, 0.3, 0.6 * this.engine); }
  }
}
// ---------------------------------------------------------------- VIPER
class HoverBike extends Vehicle {
  constructor(x, y, z, yaw) { super('bike', x, y, z, yaw); this.hop = 0; this.charge = 0; this.side = 1; this.hover = 0; this.turnRate = 0; }
  engineSpec() { return { kind: 'bike', thr: this.rider ? 0.3 + Math.min(1, this.speed / 40) * 0.7 : 0, speed: this.speed, boost: this.boosting ? 1 : 0 }; }
  step(dt, inp) {
    this.impulses();
    const v = this.vel, ctl = !!(this.rider && inp), w = this.world;
    let yaw = this.heading();
    const fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
    let vf = v[0] * fx + v[2] * fz, vr = v[0] * rx + v[2] * rz;
    this.boosting = ctl && inp.boost && this.boost > 0.02 && inp.f > 0;
    if (this.boosting) this.boost = Math.max(0, this.boost - dt * 0.22);
    if (ctl) {
      const turnMax = 3.2 - Math.min(1.6, Math.abs(vf) / 40);
      const da = angleDiff(yaw, this.rider.yaw), turn = clamp(da, -turnMax * dt, turnMax * dt);
      yaw += turn; this.turnRate = turn / dt;
      const top = this.boosting ? 64 : 38;
      if (inp.f > 0) vf += Math.min(inp.f * (this.boosting ? 46 : 30) * dt, Math.max(0, top - vf));
      else if (inp.f < 0) vf -= (vf > 0 ? 55 : 18) * dt * -inp.f;
      vf = Math.max(vf, -12);
      vr += (inp.s * 13 - vr) * Math.min(1, dt * 5);
    } else { this.turnRate = 0; vr *= 1 - Math.min(1, dt * 4); }
    vf *= 1 - Math.min(1, dt * (ctl && inp.f ? 0.25 : 0.9));
    const nfx = Math.sin(yaw), nfz = -Math.cos(yaw), nrx = Math.cos(yaw), nrz = Math.sin(yaw);
    v[0] = nfx * vf + nrx * vr; v[2] = nfz * vf + nrz * vr;
    // hover springs with look-ahead probes
    const look = clamp(Math.abs(vf) * 0.22, 1.1, 7);
    const probes = [[0, 0], [look * Math.sign(vf || 1), 0], [look * 0.5 * Math.sign(vf || 1), 0], [-1.0, 0], [0.2, 0.55], [0.2, -0.55]];
    let gmax = -1e9;
    for (const [pf, pr] of probes) {
      const px = this.x + nfx * pf + nrx * pr, pz = this.z + nfz * pf + nrz * pr;
      const hit = raycast(w, px, this.y + 1.6, pz, 0, -1, 0, 6, true);
      if (hit) { const gy = FLUID[hit.id] ? hit.y + 0.9 : this.y + 1.6 - hit.t; if (gy > gmax) gmax = gy; }
    }
    const HOV = 0.62;
    this.hover = gmax > -1e8 && this.y - gmax < 3.2 ? 1 : 0;
    if (this.hover) {
      const target = gmax + HOV;
      v[1] += ((target - this.y) * 48 - v[1] * 9) * dt;
      if (ctl && inp.up && this.hop <= 0) { v[1] = 12.5; this.hop = 0.9; this.game.audio.play('veh_hop', { x: this.x, y: this.y, z: this.z }); }
    } else v[1] -= 26 * dt;
    this.hop = Math.max(0, this.hop - dt);
    const wasGround = this.onGround;
    this.onGround = this.hover > 0;
    const oy = v[1];
    this.stepH = 1.1;
    moveEntity(w, this, v[0] * dt, v[1] * dt, v[2] * dt);
    if (this.collidedX || this.collidedZ) {
      const hs = Math.hypot(v[0], v[2]);
      if (hs > 26) this.hurt((hs - 24) * 0.9, { type: 'crash' });
      if (hs > 8) this.game.audio.play('hit', { x: this.x, y: this.y, z: this.z, vol: 0.5 });
      if (this.collidedX) v[0] *= -0.25; if (this.collidedZ) v[2] *= -0.25;
    }
    if (this.collidedV) { if (oy < -22 && !this.hover) this.hurt((-oy - 20) * 1.2, { type: 'crash' }); if (oy < 0) v[1] = 0; }
    this.vx = this.vy = this.vz = 0; void wasGround;
    // attitude: lean into turns, pitch with terrain + acceleration
    const lean = clamp((this.turnRate || 0) * Math.abs(vf) / 60 + vr / 40, -0.55, 0.55);
    const f2 = raycast(w, this.x + nfx * 1.3, this.y + 1.6, this.z + nfz * 1.3, 0, -1, 0, 6, true), b2 = raycast(w, this.x - nfx * 1.3, this.y + 1.6, this.z - nfz * 1.3, 0, -1, 0, 6, true);
    let slope = 0; if (f2 && b2) slope = Math.atan2(b2.t - f2.t, 2.6);
    const tp = clamp(slope, -0.5, 0.5) + (this.hover ? 0 : clamp(v[1] / 40, -0.3, 0.3)) + (ctl ? inp.f * 0.03 : 0);
    this.pitchA += (tp - this.pitchA) * Math.min(1, dt * 6); this.rollA += (lean - this.rollA) * Math.min(1, dt * 5);
    Q.fromHPR(this.q, yaw, this.pitchA, this.rollA);
    this.engine = this.rider ? 0.35 + Math.min(1, Math.abs(vf) / 40) * 0.65 : 0.15;
    this.agl = this.hover ? this.y - gmax : 9;
    this.warn = this.hull < this.def.hull * 0.25 ? 'HULL CRITICAL' : '';
  }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M) return;
    const aimP = this.aimPoint(_v5, 180);
    if (inp.fire1 && this.cd1 <= 0 && this.overheat <= 0) {
      this.cd1 = 0.11; this.side = -this.side;
      const m = this.local(this.side * 0.35, 0.22, -1.65, _v3);
      let dx = aimP[0] - m[0], dy = aimP[1] - m[1], dz = aimP[2] - m[2]; const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
      const f = this.fwd, dot = dx * f[0] + dy * f[1] + dz * f[2];
      if (dot < 0.5) { dx = f[0]; dy = f[1]; dz = f[2]; }
      M.bolt(this, m[0], m[1], m[2], dx, dy, dz, 190 + Math.max(0, this.vel[0] * dx + this.vel[2] * dz), { dmg: 5, color: [0.62, 1.0, 0.18], size: 0.16, len: 4.5, life: 1.3, sound: 'blaster' });
      this.addHeat(0.035); this.muzzle = 0.06;
    }
    if (inp.fire2 && this.overheat <= 0) { this.charge = Math.min(1, this.charge + dt / 1.1); if (!this.chargeSnd) { this.chargeSnd = true; this.game.audio.play('veh_charge', {}); } }
    else if (this.charge > 0) {
      if (this.charge > 0.25) {
        const m = this.local(0, 0.2, -1.7, _v3);
        let dx = aimP[0] - m[0], dy = aimP[1] - m[1], dz = aimP[2] - m[2]; const dl = Math.hypot(dx, dy, dz) || 1;
        M.bolt(this, m[0], m[1], m[2], dx / dl, dy / dl, dz / dl, 150, { dmg: 10 + this.charge * 16, color: [0.75, 1.0, 0.3], size: 0.35 + this.charge * 0.35, len: 3, life: 2, sound: 'fusion', power: 1.2 + this.charge * 1.6 });
        this.addHeat(0.25 * this.charge);
      }
      this.charge = 0; this.chargeSnd = false;
    }
  }
  parts() { return null; }
  drawFX(R) {
    const f = this.fwd, e = this.engine;
    const p = this.local(0, 0.53, 1.62, _v3), len = 0.4 + e * 1.2 + (this.boosting ? 2.0 : 0);
    R.fxBeam(p[0], p[1], p[2], p[0] - f[0] * len, p[1] - f[1] * len, p[2] - f[2] * len, 0.17 + e * 0.04, 0.7, 1.0, 0.25, 0.35 + e * 0.35);
    R.fxSprite(p[0], p[1], p[2], 0.3, 0.75, 1.0, 0.3, 0.8);
    if (this.hover) for (const z of [-1.05, 0.85]) { const q = this.local(0, -0.08, z, _v4); R.fxSprite(q[0], q[1] - 0.1, q[2], 0.55, 0.6, 1.0, 0.2, 0.22 + e * 0.1); }
    if (this.charge > 0) { const m = this.local(0, 0.2, -1.8, _v3); R.fxSprite(m[0], m[1], m[2], 0.2 + this.charge * 0.5, 0.8, 1.0, 0.35, 1 + this.charge * 2); }
    if (this.muzzle > 0) { const m = this.local(this.side * 0.35, 0.22, -1.75, _v3); R.fxSprite(m[0], m[1], m[2], 0.35, 0.7, 1.0, 0.25, 1.3); this.muzzle -= 0.02; }
  }
  lights(R) {
    const p = this.local(0, 0.5, -3.2, _v3);
    if (this.rider) R.addLight(p[0], p[1], p[2], 9, 1.0, 0.95, 0.8, 0.9);
    const q = this.local(0, -0.2, 0, _v4);
    R.addLight(q[0], q[1] - 0.4, q[2], 4.5, 0.6, 1.0, 0.25, 0.6 * (this.hover ? 1 : 0.3));
    if (this.muzzle > 0 || this.charge > 0.2) { const m = this.local(0, 0.2, -1.8, _v5); R.addLight(m[0], m[1], m[2], 7, 0.6, 1.0, 0.25, 1.5 + this.charge * 2); }
  }
}
// ---------------------------------------------------------------- WRAITH
class Bomber extends Jet {
  constructor(x, y, z, yaw) { super(x, y, z, yaw, 'bomber'); this.fp = BOMBER_FP; this.missiles = 0; this.bombs = 12; this.bReload = 0; this.bay = 0; }
  engineSpec() { return { kind: 'jet', thr: this.rider ? this.throttle * 0.8 : 0, ab: this.boosting ? 0.7 : 0, speed: this.speed * 0.8 }; }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M || !inp) return;
    if (inp.fire1 && this.cd1 <= 0 && this.overheat <= 0) {
      this.cd1 = 0.12; this.side = -this.side;
      const m = this.local(this.side * 0.5, -0.12, -2.55, _v3), f = this.fwd, sp = Math.max(0, this.vel[0] * f[0] + this.vel[1] * f[1] + this.vel[2] * f[2]);
      M.bolt(this, m[0], m[1], m[2], f[0], f[1], f[2], 280 + sp, { dmg: 6, color: [1.0, 0.7, 0.18], size: 0.18, len: 6, life: 1.6, sound: 'plasma' });
      this.addHeat(0.04); this.muzzle = 0.06;
    }
    this.bay += ((inp.fire2 && this.bombs > 0 ? 1 : 0) - this.bay) * Math.min(1, dt * 7);
    if (this.bReload > 0) { this.bReload -= dt; if (this.bReload <= 0 && this.bombs < 12) { this.bombs++; this.bReload = this.bombs < 12 ? 3 : 0; } }
    if (inp.fire2 && this.bay > 0.7 && this.cd2 <= 0 && this.bombs > 0) {
      this.cd2 = 0.26; this.bombs--; if (this.bReload <= 0) this.bReload = 3;
      const m = this.local(this.bombs & 1 ? 0.3 : -0.3, -0.62, 0.15, _v3);
      M.bomb(this, m[0], m[1], m[2], this.vel[0], this.vel[1] - 2, this.vel[2], { power: 4.2 });
    }
    this.lock = null; this.lockT = 0;
  }
  // continuously computed impact point for the bomb sight
  ccip(out) {
    const w = this.world, p = this.local(0, -0.62, 0.15, _v4);
    let x = p[0], y = p[1], z = p[2], vx = this.vel[0], vy = this.vel[1] - 2, vz = this.vel[2];
    const h = 0.05;
    for (let i = 0; i < 400; i++) {
      const nvy = vy - BOMB_G * h, sx = vx * h, sy = (vy + nvy) * 0.5 * h, sz = vz * h, l = Math.hypot(sx, sy, sz) || 1e-6;
      const hit = raycast(w, x, y, z, sx / l, sy / l, sz / l, l, true);
      if (hit) { out[0] = x + sx / l * hit.t; out[1] = y + sy / l * hit.t; out[2] = z + sz / l * hit.t; out[3] = i * h; return out; }
      x += sx; y += sy; z += sz; vy = nvy;
      if (y < -8) return null;
    }
    return null;
  }
  parts() { return { gear: this.gear > 0.5 ? {} : null, bay: this.bay > 0.5 ? null : {} }; }
  drawFX(R) {
    const e = this.engine, f = this.fwd;
    if (e > 0.02 || this.boosting) for (const sx of [-1.45, -0.75, 0.75, 1.45]) {
      const p = this.local(sx, 0.42, 1.55, _v3), len = 0.8 + e * 1.8 + (this.boosting ? 2.4 : 0);
      R.fxBeam(p[0], p[1], p[2], p[0] - f[0] * len, p[1] - f[1] * len, p[2] - f[2] * len, 0.16 + e * 0.05, 1.0, 0.55, 0.16, 0.28 + e * 0.3 + (this.boosting ? 0.2 : 0));
    }
    if (this.muzzle > 0) { const m = this.local(this.side * 0.5, -0.12, -2.8, _v3); R.fxSprite(m[0], m[1], m[2], 0.5, 1.0, 0.7, 0.25, 1.4); this.muzzle -= 0.02; }
    if ((this.t % 1.4) < 0.08) for (const sx of [-4.05, 4.05]) { const p = this.local(sx, 0, 0.85, _v3); R.fxSprite(p[0], p[1], p[2], 0.45, sx < 0 ? 1 : 0.3, sx < 0 ? 0.2 : 1, 0.15, 1.4); }
  }
  lights(R) {
    if (this.engine > 0.05) { const p = this.local(0, 0.3, 2.8, _v3); R.addLight(p[0], p[1], p[2], 9 + this.engine * 5, 1.0, 0.55, 0.2, 0.8 + this.engine); }
    if (this.muzzle > 0) { const p = this.local(0, -0.1, -2.7, _v3); R.addLight(p[0], p[1], p[2], 8, 1.0, 0.65, 0.2, 2); }
  }
}
const BOMB_G = 20;
// ---------------------------------------------------------------- BASTION
class HoverTank extends Vehicle {
  constructor(x, y, z, yaw) { super('tank', x, y, z, yaw); this.turretYaw = 0; this.turretPitch = 0; this.reloadT = 0; this.hover = 0; this.recoil = 0; this.side = 1; this.hullTurn = 0; }
  engineSpec() { return { kind: 'tank', thr: this.rider ? 0.35 + Math.min(1, this.speed / 18) * 0.65 : 0, speed: this.speed, boost: this.boosting ? 1 : 0 }; }
  step(dt, inp) {
    this.impulses();
    const v = this.vel, ctl = !!(this.rider && inp), w = this.world;
    let yaw = this.heading();
    let fx = Math.sin(yaw), fz = -Math.cos(yaw);
    let vf = v[0] * fx + v[2] * fz;
    this.boosting = ctl && inp.boost && this.boost > 0.02 && inp.f !== 0;
    if (this.boosting) this.boost = Math.max(0, this.boost - dt * 0.15);
    const top = this.boosting ? 27 : 17;
    let turn = 0;
    if (ctl) {
      if (inp.f) vf += clamp(inp.f * top - vf, -24 * dt, 14 * dt);
      else vf *= 1 - Math.min(1, dt * 2.5);
      turn = inp.s * 1.35;
    } else vf *= 1 - Math.min(1, dt * 2);
    this.hullTurn += (turn - this.hullTurn) * Math.min(1, dt * 5);
    yaw += this.hullTurn * dt;
    // the turret keeps its world aim while the hull turns underneath
    this.turretYaw -= this.hullTurn * dt;
    fx = Math.sin(yaw); fz = -Math.cos(yaw);
    v[0] = fx * vf; v[2] = fz * vf;
    const gmax = this.hoverGround([[0, 0], [2.6, 0], [-2.6, 0], [0, 1.5], [0, -1.5], [clamp(vf * 0.2, -3, 4) + 2.6 * Math.sign(vf || 1), 0]], yaw);
    this.hover = gmax > -1e8 && this.y - gmax < 3.4 ? 1 : 0;
    if (this.hover) v[1] += ((gmax + 0.85 - this.y) * 30 - v[1] * 8) * dt; else v[1] -= 24 * dt;
    this.onGround = this.hover > 0;
    const oy = v[1];
    this.stepH = 1.1;
    moveEntity(w, this, v[0] * dt, v[1] * dt, v[2] * dt);
    if (this.collidedX || this.collidedZ) { if (this.collidedX) v[0] *= -0.1; if (this.collidedZ) v[2] *= -0.1; }
    if (this.collidedV) { if (oy < -24 && !this.hover) this.hurt((-oy - 22) * 1.5, { type: 'crash' }); if (oy < 0) v[1] = 0; }
    this.vx = this.vy = this.vz = 0;
    // attitude from terrain under the hull
    const df = this.probeDepth(yaw, 2.6, 0), db = this.probeDepth(yaw, -2.6, 0), dl = this.probeDepth(yaw, 0, -1.6), dr = this.probeDepth(yaw, 0, 1.6);
    const tp = clamp(Math.atan2(db - df, 5.2), -0.35, 0.35) - this.recoil * 0.05, tr = clamp(Math.atan2(dl - dr, 3.2), -0.3, 0.3);
    this.pitchA += (tp - this.pitchA) * Math.min(1, dt * 4); this.rollA += (tr - this.rollA) * Math.min(1, dt * 4);
    Q.fromHPR(this.q, yaw, this.pitchA, this.rollA);
    this.recoil = Math.max(0, this.recoil - dt * 2.5);
    this.engine = this.rider ? 0.3 + Math.min(1, Math.abs(vf) / 17) * 0.7 : 0.1;
    this.agl = this.hover ? this.y - gmax : 9;
    this.warn = this.hull < this.def.hull * 0.25 ? 'HULL CRITICAL' : '';
  }
  // where a cannon shell fired right now would land (for the gunner sight)
  shellImpact(out) {
    const w = this.world, m = this.muzzlePos(_v3), d = this.gunDir(_v4);
    let x = m[0], y = m[1], z = m[2], vx = d[0] * 115, vy = d[1] * 115, vz = d[2] * 115;
    const h = 0.05;
    for (let i = 0; i < 160; i++) {
      const nvy = vy - SHELL_G * h, sx = vx * h, sy = (vy + nvy) * 0.5 * h, sz = vz * h, l = Math.hypot(sx, sy, sz) || 1e-6;
      const hit = raycast(w, x, y, z, sx / l, sy / l, sz / l, l, false);
      if (hit) { out[0] = x + sx / l * hit.t; out[1] = y + sy / l * hit.t; out[2] = z + sz / l * hit.t; return out; }
      x += sx; y += sy; z += sz; vy = nvy;
    }
    return null;
  }
  muzzlePos(out) { const L = 3.0 - this.recoil * 0.35, cy = Math.cos(this.turretYaw), sy = Math.sin(this.turretYaw), cp = Math.cos(this.turretPitch), sp = Math.sin(this.turretPitch), d = 1.0 + L * cp; return this.local(-sy * d, 1.5625 + L * sp, -cy * d, out); }
  gunDir(out) { const cy = Math.cos(this.turretYaw), sy = Math.sin(this.turretYaw), cp = Math.cos(this.turretPitch), sp = Math.sin(this.turretPitch); return Q.rot(this.q, -sy * cp, sp, -cy * cp, out); }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M) return;
    const aimP = this.aimPoint(_v5, 260);
    const piv = this.local(0, 1.5625, 0, _v3);
    const dx = aimP[0] - piv[0], dy = aimP[1] - piv[1], dz = aimP[2] - piv[2], dl = Math.hypot(dx, dy, dz) || 1;
    const l = Q.inv(this.q, dx / dl, dy / dl, dz / dl, _v4);
    const wantY = Math.atan2(-l[0], -l[2]);
    let wantP = Math.atan2(l[1], Math.hypot(l[0], l[2]));
    // lob shells at distant targets: add ballistic elevation for the arcing cannon
    const flat = Math.hypot(dx, dz), vs = 115, gS = SHELL_G;
    const disc = vs ** 4 - gS * (gS * flat * flat + 2 * dy * vs * vs);
    if (disc > 0) wantP = Math.atan2(vs * vs - Math.sqrt(disc), gS * flat) - Math.atan2(dy, flat) + wantP;
    this.turretYaw += clamp(angleDiff(this.turretYaw, wantY), -1.7 * dt, 1.7 * dt);
    this.turretPitch += clamp(clamp(wantP, -0.16, 0.6) - this.turretPitch, -1.0 * dt, 1.0 * dt);
    if (this.reloadT > 0) this.reloadT -= dt;
    if (inp.fire2 && this.reloadT <= 0) {
      this.reloadT = 2.4; this.recoil = 1;
      const m = this.muzzlePos(_v3), d = this.gunDir(_v4);
      M.shell(this, m[0], m[1], m[2], d[0], d[1], d[2], vs, { power: 4 });
      this.flash = 0.12;
      if (this.rider === this.game.player) this.game.shake = Math.max(this.game.shake || 0, 0.45);
      this.vel[0] -= d[0] * 4; this.vel[2] -= d[2] * 4;
    }
    if (inp.fire1 && this.cd1 <= 0 && this.overheat <= 0) {
      this.cd1 = 0.085; this.side = -this.side;
      const cy = Math.cos(this.turretYaw), sy = Math.sin(this.turretYaw);
      const m = this.local(cy * 0.56 - sy * 1.3, 1.56, -sy * 0.56 - cy * 1.3, _v3);
      let ex = aimP[0] - m[0], ey = aimP[1] - m[1], ez = aimP[2] - m[2]; const el = Math.hypot(ex, ey, ez) || 1;
      M.bolt(this, m[0], m[1], m[2], ex / el, ey / el, ez / el, 240, { dmg: 4, color: [1.0, 0.86, 0.45], size: 0.12, len: 4, life: 1.4, sound: 'blaster' });
      this.addHeat(0.022);
    }
    if (this.flash > 0) this.flash -= dt;
  }
  parts() { return { turret: { y: this.turretYaw }, barrel: { py: VOX_MODELS.tank.parts.turret.pivot, y: this.turretYaw, sub: { x: this.turretPitch, z: 0 }, recoil: this.recoil } }; }
  partMatrix(M, base, part, rot) {
    super.partMatrix(M, base, part, rot);
    if (rot && rot.recoil) M4.translate(M, 0, 0, rot.recoil * 0.35);
    return M;
  }
  drawFX(R) {
    if (this.hover) for (const [pf, pr] of [[1.75, 1.63], [1.75, -1.63], [-2.5, 1.63], [-2.5, -1.63]]) { const q = this.local(pr, -0.05, -pf, _v4); R.fxSprite(q[0], q[1] - 0.15, q[2], 0.8, 1.0, 0.6, 0.2, 0.2 + this.engine * 0.12); }
    if (this.flash > 0) { const m = this.muzzlePos(_v3), d = this.gunDir(_v4); R.fxSprite(m[0] + d[0] * 0.6, m[1] + d[1] * 0.6, m[2] + d[2] * 0.6, 1.6, 1.0, 0.7, 0.3, 3.0); R.fxBeam(m[0], m[1], m[2], m[0] + d[0] * 3, m[1] + d[1] * 3, m[2] + d[2] * 3, 0.5, 1.0, 0.6, 0.2, 1.4); }
  }
  lights(R) {
    const q = this.center(_v4); R.addLight(q[0], q[1] - 0.3, q[2], 7, 1.0, 0.6, 0.22, 0.5 * (this.hover ? 1 : 0.3));
    if (this.flash > 0) { const m = this.muzzlePos(_v3); R.addLight(m[0], m[1], m[2], 16, 1.0, 0.65, 0.3, 4); }
  }
}
const SHELL_G = 12;
const VEH_CLASSES = { jet: Jet, gunship: Gunship, bike: HoverBike, bomber: Bomber, tank: HoverTank };
function spawnVehicle(w, kind, x, y, z, yaw) {
  const C = VEH_CLASSES[kind]; if (!C) return null;
  const v = new C(x, y, z, yaw || 0);
  w.addEntity(v);
  return v;
}
