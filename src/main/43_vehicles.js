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
// camera yaw / pitch / roll reproducing any orientation, upside down included (M4.view applies the roll last)
const _cf = [0, 0, 0], _cu = [0, 0, 0];
function camFromQuat(c, q) {
  const f = Q.rot(q, 0, 0, -1, _cf), u = Q.rot(q, 0, 1, 0, _cu);
  const yaw = Math.atan2(f[0], -f[2]), pitch = Math.asin(clamp(f[1], -1, 1));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
  c.yaw = yaw; c.pitch = pitch;
  c.roll = Math.atan2(u[0] * cy + u[2] * sy, -u[0] * sy * sp + u[1] * cp + u[2] * cy * sp);
  return c;
}
const VEH_DEFS = {
  jet: { name: 'Stormcrow Interceptor', item: 'stormcrow_jet', model: 'jet', w: 4.4, h: 1.9, yoff: 0.8125, hull: 140, enclosed: true, cockpit: [0, 0.6875, -1.8125], camDist: 14, camH: 3.4, radius: 3.2 },
  gunship: { name: 'Mantis VTOL Gunship', item: 'mantis_gunship', model: 'gunship', w: 4.2, h: 1.9, yoff: 0.47, hull: 200, enclosed: true, cockpit: [0, 0.6, -2.0625], camDist: 15, camH: 4.4, radius: 3.8 },
  bomber: { name: 'Wraith Flying-Wing Bomber', item: 'wraith_bomber', model: 'bomber', w: 5.2, h: 1.6, yoff: 0.75, hull: 230, enclosed: true, cockpit: [0, 0.6875, -1.0625], camDist: 17, camH: 4.2, radius: 4.6 },
  tank: { name: 'Bastion Hover Tank', item: 'bastion_tank', model: 'tank', w: 4.0, h: 1.7, yoff: 0.05, hull: 320, enclosed: true, cockpit: [0, 2.35, 0.3], camDist: 11, camH: 3.4, radius: 3.8 },
  bike: { name: 'Viper Hover Bike', item: 'viper_bike', model: 'bike', w: 1.4, h: 1.1, yoff: 0.1, hull: 70, enclosed: false, seat: [0, 0.6, 0.12], cockpit: [0, 1.55, 0.12], camDist: 6.8, camH: 2.3, radius: 1.6 },
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
      c.yaw = p.yaw; c.pitch = p.pitch; c.roll = this.rollA * 0.5;
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
// the jets flown from the cockpit (direct flight)
const VEH_HELP_SIM = {
  jet: [['MOUSE', 'pitch + roll'], ['A/D', 'rudder'], ['W/S', 'throttle'], ['CTRL', 'afterburner'], ['SHIFT', 'airbrake'], ['C / MMB', 'look around'], ['LMB', 'plasma'], ['RMB', 'missile'], ['WHEEL', 'zoom'], ['F5', 'camera']],
  bomber: [['MOUSE', 'pitch + roll'], ['A/D', 'rudder'], ['W/S', 'throttle'], ['CTRL', 'afterburner'], ['SHIFT', 'airbrake'], ['C / MMB', 'look around'], ['LMB', 'plasma'], ['RMB', 'bay + bombs'], ['F5', 'camera']],
};
// ---------------------------------------------------------------- STORMCROW
// Direct (cockpit) flight: kP / kR set how fast a mouse input is flown out, pendP / pendR cap the queued rotation (rad),
// gMax / gNeg are the G limiter, nMin / nMax the path-hold lift range, resp the control smoothing (1/s)
const JET_FP = { thrust: 48, ab: 62, drag: 0.0052, pMax: 1.45, pMin: -1.0, yMax: 0.7, rMax: 4.2, lift0: 16, liftR: 22, stall: 20, takeoff: 52, landMax: 58,
  kP: 6.5, kR: 7, pendP: 0.75, pendR: 2.4, gMax: 9, gNeg: 3, nMin: -1.2, nMax: 2.2, resp: 7.5,
  pts: [[0, -0.05, -4.1], [-2.8, -0.1, 1.45], [2.8, -0.1, 1.45], [0, -0.2, 3.3], [0, -0.76, 0.4], [0, 1.1, 2.2]] };
const BOMBER_FP = { thrust: 40, ab: 42, drag: 0.0068, pMax: 0.85, pMin: -0.6, yMax: 0.4, rMax: 1.9, lift0: 12, liftR: 20, stall: 16, takeoff: 44, landMax: 52,
  kP: 3.6, kR: 3.8, pendP: 0.5, pendR: 1.5, gMax: 5, gNeg: 2, nMin: -1.0, nMax: 1.7, resp: 4.2,
  pts: [[0, -0.05, -2.45], [-4.1, -0.05, 0.9], [4.1, -0.05, 0.9], [0, -0.05, 2.0], [0, -0.7, 0.1], [-1.45, 0.4, 1.3], [1.45, 0.4, 1.3]] };
const JET_TIP = [2.8, -0.1, 1.45], BOMBER_TIP = [4.05, 0, 0.85];
const _q1 = [0, 0, 0, 1], _q2 = [0, 0, 0, 1];
class Jet extends Vehicle {
  constructor(x, y, z, yaw, kind) {
    super(kind || 'jet', x, y, z, yaw); this.fp = JET_FP; this.throttle = 0; this.gear = 1; this.missiles = 8; this.mReload = 0; this.side = 1; this.stall = false;
    // direct flight: queued stick rotation, smoothed pilot rates, what the stick / rudder models show
    this.stick = { p: 0, r: 0 }; this.avc = [0, 0, 0]; this.stickVis = [0, 0, 0];
    // pilot's head: free look (ty / tp targets), G-force sway spring (x, y, z + velocities)
    this.head = { yaw: 0, pitch: 0, ty: 0, tp: 0, hold: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
    this.eyeOff = [0, 0, 0]; this.headQ = [0, 0, 0, 1];
    // felt acceleration (smoothed specific force), load factors, G stress and terrain proximity
    this.pv = [0, 0, 0]; this.accS = [0, 20, 0]; this.gz = 1; this.gy = 0; this.gx = 0; this.gPeak = 1; this.gLoad = 0; this.redout = 0;
    this.prox = 0; this.czoom = 1; this.shakeT = Math.random() * 100; this.motes = null;
  }
  engineSpec() {
    const own = this.rider && this.rider === this.game.player;
    return { kind: 'jet', thr: this.rider ? this.throttle : 0, ab: this.boosting ? 1 : 0, speed: this.speed, wind: own ? Math.min(1, this.speed / 140) : 0, prox: own ? this.prox : 0, cockpit: own && this.rider.vcam === 1 };
  }
  // the cockpit camera flies the jet directly (simulator style); the chase cameras keep the assisted mouse aim
  simMode() { const p = this.rider; return !!(p && p.vcam === 1); }
  takesMouse(p) { return p === this.rider && p.vcam === 1; }
  // mouse input in the cockpit, in radians: queues a body-frame pitch / roll, or turns the pilot's head
  mouseInput(dx, dy, look) {
    const H = this.head;
    if (look) { H.ty = clamp(H.ty + dx, -2.6, 2.6); H.tp = clamp(H.tp - dy, -1.05, 1.4); return; }
    const FP = this.fp, S = this.stick, inv = SETTINGS.flightInvert ? -1 : 1;
    S.p = clamp(S.p - dy * inv, -FP.pendP, FP.pendP);
    S.r = clamp(S.r + dx * 1.7, -FP.pendR, FP.pendR);
  }
  onCamChange(p) {
    const S = this.stick, H = this.head;
    S.p = S.r = 0; H.ty = H.tp = H.yaw = H.pitch = 0;
    this.avc[0] = this.av[0]; this.avc[1] = this.av[1]; this.avc[2] = this.av[2];
    if (p.vcam === 1) this.mountT = 7;
    // back to mouse aim: aim where the nose points so the assist does not yank the jet around
    else { p.yaw = this.heading(); p.pitch = Math.asin(clamp(this.fwd[1], -1, 1)); }
  }
  mount(p) {
    super.mount(p);
    const S = this.stick, H = this.head;
    S.p = S.r = 0; H.ty = H.tp = H.yaw = H.pitch = H.x = H.y = H.z = H.vx = H.vy = H.vz = 0;
    this.gLoad = this.redout = 0; this.gPeak = 1; this.czoom = 1;
    this.pv[0] = this.vel[0]; this.pv[1] = this.vel[1]; this.pv[2] = this.vel[2];
  }
  step(dt, inp) {
    this.impulses();
    const w = this.world, v = this.vel, g = 20;
    this.updateAxes();
    const f = this.fwd, u = this.upv, r = this.rightv;
    const sp = Math.hypot(v[0], v[1], v[2]);
    const ctl = !!(this.rider && inp);
    const sim = ctl && this.simMode(), S = this.stick;
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
      const grip = clamp(1.4 - Math.abs(nv) / 60, 0.25, 1.4);
      let pull;
      if (sim) {
        // nosewheel steering from rudder and stick; pulling the stick back rotates for takeoff
        yaw += clamp(inp.s + S.r * 2.5, -1, 1) * grip * dt * 1.4;
        S.r *= Math.exp(-dt * 5);
        pull = S.p > 0.04; S.p *= Math.exp(-dt * 1.5);
      } else {
        const aimYaw = ctl ? this.rider.yaw : yaw;
        yaw += clamp(angleDiff(yaw, aimYaw), -1, 1) * grip * dt * 1.8;
        pull = ctl && this.rider.pitch > 0.06;
      }
      let pitch = this.pitchA;
      const wantUp = ctl && ((pull && nv > FP.takeoff * 0.5) || nv > FP.takeoff);
      pitch += ((wantUp ? 0.2 : 0) - pitch) * Math.min(1, dt * 3);
      this.pitchA = pitch;
      Q.fromHPR(this.q, yaw, pitch, 0); this.updateAxes();
      const fx = Math.sin(yaw), fz = -Math.cos(yaw);
      v[0] = fx * nv; v[2] = fz * nv; v[1] = 0;
      if (wantUp && pitch > 0.12) { this.onGround = false; this.liftT = this.t; v[1] = nv * 0.18; this.av[0] = 0.2; this.gear = 1; this.game.audio.play('veh_liftoff', { x: this.x, y: this.y, z: this.z, vol: 0.6 }); }
      const nx = this.x + v[0] * dt, nz = this.z + v[2] * dt;
      const gy = this.groundUnder(nx, nz, this.y + 1.2, 3.5);
      if (gy < -1e8) { this.onGround = false; this.liftT = this.t; }
      // obstacles are looked for in the direction of travel, so a jet parked nose-first against a hill can back out
      else if (gy > this.y + 1.05 || this.pointSolid(nx + fx * 3.2 * Math.sign(nv || 1), this.y + 1.2, nz + fz * 3.2 * Math.sign(nv || 1))) { if (Math.abs(nv) > 18) this.hurt(Math.abs(nv) * 0.6, { type: 'crash' }); if (Math.abs(nv) > 4 && this.rider === this.game.player) this.game.shake = 0.3; v[0] = v[2] = 0; }
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
    // direct flight: the flight computer scales the wing lift to hold the flight path in any bank, and pushes when
    // inverted, so a rolled jet keeps flying straight and a banked one turns level; near knife-edge the wings cannot help
    let nT = 1;
    if (sim) {
      const hy = Math.hypot(u[1], r[1]), cphi = hy > 1e-4 ? u[1] / hy : 1;
      const cg = sp > 1 ? Math.sqrt(Math.max(0, 1 - (v[1] / sp) * (v[1] / sp))) : 1;
      nT = clamp(cg * cphi / Math.max(cphi * cphi, 0.25), FP.nMin, FP.nMax);
    }
    const lift = g * clamp((sp - FP.lift0) / FP.liftR, 0, sim ? 1 : 1.05) * nT;
    v[0] += u[0] * lift * dt; v[1] += (u[1] * lift - g) * dt; v[2] += u[2] * lift * dt;
    this.stall = sp < FP.stall;
    const auth = clamp(sp / 34, 0.3, 1.0);
    if (sim) {
      // ------------------------------------------------ direct flight controller
      // the mouse queues a body-frame rotation that is flown out within the rate and G limits. Nothing levels the
      // wings or the nose, so any attitude (inverted included) holds once the mouse stops
      const k = 1 - Math.exp(-dt * FP.resp), vv = Math.max(sp, 12);
      const pHi = Math.min(FP.pMax, FP.gMax * g / vv), pLo = Math.max(FP.pMin, -FP.gNeg * g / vv);
      const pc = clamp(S.p * FP.kP, pLo, pHi) * auth, rc = clamp(S.r * FP.kR, -FP.rMax, FP.rMax) * Math.min(1, auth + 0.3);
      S.p -= pc * dt; S.r -= rc * dt;
      const yc = clamp(inp.s, -1, 1) * FP.yMax * auth, A = this.avc;
      A[0] += (pc - A[0]) * k; A[1] += (yc - A[1]) * k; A[2] += (rc + yc * 0.4 - A[2]) * k;
      // weathervane: the nose follows the flight path wherever gravity and the trim lift bend it
      let fp = 0, fy = 0;
      if (sp > 4) {
        const ax = u[0] * lift, ay = u[1] * lift - g, az = u[2] * lift, d = Math.max(sp * sp, 400);
        const wb = Q.inv(this.q, (v[1] * az - v[2] * ay) / d, (v[2] * ax - v[0] * az) / d, (v[0] * ay - v[1] * ax) / d, _v5);
        fp = clamp(wb[0], -1.2, 1.2); fy = clamp(-wb[1], -1.2, 1.2);
      }
      this.av[0] = A[0] + fp; this.av[1] = A[1] + fy; this.av[2] = A[2];
    } else {
      // ------------------------------------------------ mouse-aim flight controller
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
    }
    const dq = Q._d || (Q._d = [0, 0, 0, 1]), t1 = Q._t1 || (Q._t1 = [0, 0, 0, 1]);
    Q.axis(dq, 1, 0, 0, this.av[0] * dt); Q.mul(this.q, this.q, dq);
    Q.axis(t1, 0, -1, 0, this.av[1] * dt); Q.mul(this.q, this.q, t1);
    Q.axis(t1, 0, 0, -1, this.av[2] * dt); Q.mul(this.q, this.q, t1);
    Q.norm(this.q);
    // ------------------------------------------------ move + collide
    const nx = this.x + v[0] * dt, ny = this.y + v[1] * dt, nz = this.z + v[2] * dt;
    const yo = this.def.yoff;
    const pts = FP.pts;
    let hit = -1, hx = 0, hy = 0, hz = 0;
    for (let i = 0; i < pts.length; i++) {
      Q.rot(this.q, pts[i][0], pts[i][1], pts[i][2], _v3);
      const px = nx + _v3[0], py = ny + yo + _v3[1], pz = nz + _v3[2];
      if (this.pointSolid(px, py, pz) || (i === 4 && FLUID[w.getId(Math.floor(px), Math.floor(py), Math.floor(pz))] === 1)) { hit = i; hx = px; hy = py; hz = pz; break; }
    }
    if (hit >= 0) {
      const vy = v[1], level = u[1] > 0.85 && Math.abs(f[1]) < 0.33;
      const gy = this.groundUnder(nx, nz, ny + 2.5, 4.5);
      // touchdown: roughly level and settling gently on the belly or nose, or on the tail or a wingtip resting on a
      // bump (not while climbing away on takeoff). Below 15 b/s any contact near the ground settles the jet onto
      // its gear, so it never hovers in place grinding against the terrain
      const low = hit === 4 || (hit === 0 && vy < 0) || ((hit === 1 || hit === 2 || hit === 3) && vy < 1);
      if (vy > -9 && gy > -1e8 && ny - gy < 1.6 && ((level && low && sp < FP.landMax) || sp < 15)) {
        this.onGround = true; this.y = gy; this.x = nx; this.z = nz; v[1] = 0;
        const yaw = this.heading(); this.pitchA = 0; Q.fromHPR(this.q, yaw, 0, 0); this.av[0] = this.av[1] = this.av[2] = 0;
        this.game.audio.play('veh_land', { x: this.x, y: this.y, z: this.z, vol: 0.8 });
        if (this.rider === this.game.player) this.game.shake = 0.25;
        return;
      }
      // grazing the top of the ground (open air above the contact) at a modest sink rate: the jet rides up over it
      // and gets scraped instead of blowing up, so bumps under a wingtip or the tail no longer destroy it on
      // takeoff, landing or a low pass. Walls, tree trunks, the nose dug in and steep dives still crash
      const by = Math.floor(hy), rise = by + 1 - hy + 0.03;
      if (vy > -12 && (hit !== 0 || f[1] > -0.35) && rise < 0.83 && !this.pointSolid(hx, by + 1.5, hz)) {
        this.x = nx; this.y = ny + rise; this.z = nz;
        v[1] = Math.max(v[1], 0) + Math.min(2.5, rise * 15);
        this.scrape(hx, by, hz, sp);
      } else if (hit !== 0 && vy > -12 && this.t - (this.liftT || -9) < 1.2) {
        // just off the ground: on the takeoff roll the wings pass through rocks, bushes and trunks beside the
        // runway, so for a moment after lifting off a wing, the tail or the belly still in one only scrapes
        this.x = nx; this.y = ny; this.z = nz;
        this.scrape(hx, by, hz, sp);
      } else {
        if (sp > 34) { this.hurt(this.hull + 1, { type: 'crash' }); return; }
        // barely moving: nudge free without damage (it used to grind itself to pieces stuck in the ground)
        if (sp > 12) { this.hurt(sp * 1.1, { type: 'crash' }); this.game.shake = 0.5; }
        v[0] *= -0.25; v[1] = Math.abs(v[1]) * 0.3 + (sp > 12 ? 3 : 1.5); v[2] *= -0.25;
        return;
      }
    } else { this.x = nx; this.y = ny; this.z = nz; }
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
  // top of the ground (or still water) below (x, y0, z) within depth. Plants, flowers, torches and the like do not
  // hold a jet up: the jet used to bounce along on tall grass and stop dead at stacked sugar cane. Starting inside
  // a solid block reports y0, so a wall ahead still blocks the roll
  groundUnder(x, z, y0, depth) {
    const w = this.world, bx = Math.floor(x), bz = Math.floor(z), end = y0 - depth;
    for (let y = Math.floor(y0); y >= Math.floor(end) && y >= 0; y--) {
      const b = w.getBlock(bx, y, bz), id = b & 4095;
      if (!id) continue;
      if (FLUID[id]) { if (!(b >> 12)) return Math.min(y0, y + 0.9); continue; }
      if (!SOLID[id] || PLANT[id]) continue;
      let top = 0;
      for (const box of shapeBoxes(w, bx, y, bz, b, false)) top = Math.max(top, box[4]);
      if (!top) continue;
      const gy = Math.min(y0, y + top);
      return gy >= end ? gy : -1e9;
    }
    return -1e9;
  }
  // scraping along the ground: a little hull at speed, dust of the block, a thump and a jolt in the cockpit
  scrape(x, by, z, sp) {
    const g = this.game, bx = Math.floor(x), bz = Math.floor(z);
    if (this.t - (this.scrapeAt || -9) < 0.25) return;
    this.scrapeAt = this.t;
    const b = this.world.getBlock(bx, by, bz), id = b & 4095;
    if (sp > 40 && !FLUID[id]) this.hurt((sp - 40) * 0.12, { type: 'scrape' });
    for (let i = 0; i < 3; i++) g.particles.blockHit(bx, by, bz, 2, b);
    g.audio.play('dig', { mat: BLOCKS[id] ? BLOCKS[id].snd : 'stone', vol: 0.7, x, y: by + 1, z });
    if (sp > 20) g.audio.play('hit', { x, y: by + 1, z, vol: Math.min(1, sp / 80) });
    if (this.rider === g.player) g.shake = Math.max(g.shake || 0, Math.min(0.35, 0.1 + sp * 0.003));
  }
  frame(dt, inp) {
    super.frame(dt, inp);
    if (!this.removed) this.flightState(dt, inp);
  }
  // felt acceleration (load factors), the pilot's G stress, terrain proximity and what the stick and rudder show
  flightState(dt, inp) {
    const v = this.vel, a = this.accS, pv = this.pv, iv = 1 / Math.max(dt, 1e-3);
    let ax = (v[0] - pv[0]) * iv, ay = (v[1] - pv[1]) * iv + 20, az = (v[2] - pv[2]) * iv;
    const am = Math.hypot(ax, ay, az); if (am > 240) { ax *= 240 / am; ay *= 240 / am; az *= 240 / am; }
    pv[0] = v[0]; pv[1] = v[1]; pv[2] = v[2];
    const k = Math.min(1, dt * 10);
    a[0] += (ax - a[0]) * k; a[1] += (ay - a[1]) * k; a[2] += (az - a[2]) * k;
    const u = this.upv, r = this.rightv, f = this.fwd;
    this.gz = (a[0] * u[0] + a[1] * u[1] + a[2] * u[2]) / 20;
    this.gy = (a[0] * r[0] + a[1] * r[1] + a[2] * r[2]) / 20;
    this.gx = (a[0] * f[0] + a[1] * f[1] + a[2] * f[2]) / 20;
    const FP = this.fp, sv = this.stickVis, sk = Math.min(1, dt * 14), sim = this.simMode();
    sv[0] += (clamp((sim ? this.avc[2] : this.av[2]) / FP.rMax * 2.2, -1, 1) - sv[0]) * sk;
    sv[1] += (clamp((sim ? this.avc[0] : this.av[0]) / FP.pMax * 1.6, -1, 1) - sv[1]) * sk;
    sv[2] += ((sim && inp ? clamp(inp.s, -1, 1) : 0) - sv[2]) * sk;
    if (!this.rider || this.rider !== this.game.player) return;
    const gz = this.gz;
    this.gPeak = Math.max(this.gPeak, gz);
    // sustained high G drains the colour and closes in the view; hard negative G reds it out
    this.gLoad = gz > 5.2 ? Math.min(1.25, this.gLoad + (gz - 5.2) * dt * 0.24) : Math.max(0, this.gLoad - dt * (gz < 3 ? 0.45 : 0.18));
    this.redout = gz < -2.2 ? Math.min(1, this.redout + (-gz - 2.2) * dt * 0.5) : Math.max(0, this.redout - dt * 0.6);
    // terrain rushing past: the nearest surface below the belly and off either wing
    const c = this.center(_v3), w = this.world, cx = c[0], cy = c[1], cz = c[2];
    let pr = 0;
    for (let i = 0; i < 3; i++) {
      const d = i === 0 ? u : r, s = i === 1 ? 1 : -1;
      const hit = raycast(w, cx, cy, cz, d[0] * s, d[1] * s, d[2] * s, 18, true);
      if (hit) pr = Math.max(pr, 1 - hit.t / 18);
    }
    this.prox += (pr * pr * smoothstep(35, 110, this.speed) - this.prox) * Math.min(1, dt * 8);
  }
  // pilot's-eye camera, fixed to the airframe: it rolls, loops and hangs upside down with the jet
  cameraUpdate(c, dt, p) {
    if (p.vcam !== 1) { super.cameraUpdate(c, dt, p); return; }
    const H = this.head, S = SETTINGS, sp = this.speed, motion = S.cockpitFx !== false;
    // free look: while held the mouse turns the head; let go and it eases back to the gunsight
    if (!H.hold) { const kr = 1 - Math.exp(-dt * 5); H.ty -= H.ty * kr; H.tp -= H.tp * kr; }
    const kl = 1 - Math.exp(-dt * 18);
    H.yaw += (H.ty - H.yaw) * kl; H.pitch += (H.tp - H.pitch) * kl;
    // G forces shove the head around the cockpit (a stiff, slightly underdamped spring)
    const tx = motion ? clamp(-this.gy * 0.028, -0.06, 0.06) : 0, ty = motion ? clamp(-(this.gz - 1) * 0.0105, -0.085, 0.045) : 0, tz = motion ? clamp(this.gx * 0.026, -0.035, 0.06) : 0;
    const h = Math.min(dt, 0.05), ks = 110, kd = 13;
    H.vx += ((tx - H.x) * ks - H.vx * kd) * h; H.x += H.vx * h;
    H.vy += ((ty - H.y) * ks - H.vy * kd) * h; H.y += H.vy * h;
    H.vz += ((tz - H.z) * ks - H.vz * kd) * h; H.z += H.vz * h;
    // buffet: pulling hard, stalling, low and fast over the ground, afterburner, runway rumble
    let A = 0;
    if (motion) {
      A = clamp((this.gz - 4.5) * 0.0022, 0, 0.011) + Math.min(1, sp / 150) ** 2 * 0.0012 + (this.boosting ? 0.0014 : 0);
      if (this.onGround) A += Math.min(1, sp / 45) * 0.0045;
      else { if (this.stall) A += 0.007; if (sp > 40) A += Math.max(0, 1 - (this.agl === undefined ? 99 : this.agl) / 14) * Math.min(1, sp / 110) * 0.005; }
    }
    this.shakeT += dt; const T = this.shakeT;
    const bx = (Math.sin(T * 37.1) * 0.5 + Math.sin(T * 61.7 + 1.3) * 0.3 + Math.sin(T * 97.3 + 2.1) * 0.2) * A;
    const by = (Math.sin(T * 41.3 + 0.7) * 0.5 + Math.sin(T * 67.9 + 2.9) * 0.3 + Math.sin(T * 89.1 + 0.4) * 0.2) * A;
    const br = (Math.sin(T * 29.3 + 1.9) * 0.6 + Math.sin(T * 53.1 + 0.2) * 0.4) * A * 0.6;
    // head orientation in the airframe: free look (glancing down over the rail when turned to the side), then the
    // G sag and the buffet on top
    const hq = this.headQ, over = -0.14 * smoothstep(0.35, 1.4, Math.abs(H.yaw));
    Q.axis(hq, 0, -1, 0, H.yaw + bx); Q.mul(hq, hq, Q.axis(_q1, 1, 0, 0, H.pitch + over + H.y * 0.45 + by)); Q.mul(hq, hq, Q.axis(_q1, 0, 0, -1, br));
    // the eye swings about the neck as the head turns, so looking back shifts it to the side
    const e = this.eyeOff, nk = Q.rot(hq, 0, 0.07, -0.08, _v4);
    e[0] = H.x + nk[0]; e[1] = H.y + nk[1] - 0.07; e[2] = H.z + nk[2] + 0.08;
    const cp = this.def.cockpit, w = this.local(cp[0] + e[0], cp[1] + e[1], cp[2] + e[2], _v5);
    c.x = w[0]; c.y = w[1]; c.z = w[2];
    camFromQuat(c, Q.mul(_q2, this.q, hq));
    p.yaw = c.yaw; p.pitch = c.pitch;
    const tf = S.fov + Math.min(6, sp * 0.045) + (this.boosting ? 3 : 0);
    this.fovS = this.fovS === undefined ? tf : this.fovS + (tf - this.fovS) * Math.min(1, dt * 3);
    c.fov = clamp(this.fovS * this.czoom, 20, 120);
  }
  // wingtip vapour when pulling hard, and motes in the air streaming past the pilot's own jet
  airFX(R, tip) {
    const sp = this.speed; if (sp < 20) return;
    const g = this.game, vis = 1 - (R.env && R.env.night || 0) * 0.8;
    const vx = this.vel[0] / sp, vy = this.vel[1] / sp, vz = this.vel[2] / sp;
    const vap = smoothstep(4.2, 7.5, this.gz) * smoothstep(45, 80, sp) * vis;
    if (vap > 0.01) for (const s of [-1, 1]) {
      const p = this.local(tip[0] * s, tip[1], tip[2], _v3), len = sp * 0.09;
      R.fxBeam(p[0], p[1], p[2], p[0] - vx * len, p[1] - vy * len, p[2] - vz * len, 0.07, 0.85, 0.88, 0.9, 0.3 * vap);
    }
    if (this.rider !== g.player) return;
    // rain (drops falling at 8 b/s) streaks along the wind the jet makes; the world's rain columns fade out at speed
    const env = R.env || {}, rain = env.rain && !env.nether && !env.end && g.world.canSeeSky(Math.floor(g.camera.x), Math.floor(g.camera.y), Math.floor(g.camera.z)) ? env.rain : 0;
    const k = smoothstep(28, 90, sp) * vis, kr = rain * smoothstep(8, 30, sp) * (0.4 + vis * 0.6); if (k < 0.01 && kr < 0.01) return;
    const cam = g.camera, M = this.motes || (this.motes = []), r = this.rightv, u = this.upv;
    const n = 70 + Math.round(kr * 130);
    while (M.length < n) M.push([1e9, 0, 0]);
    const rx = -this.vel[0], ry = -this.vel[1] - 8 * (kr > 0 ? 1 : 0), rz = -this.vel[2], rl = Math.hypot(rx, ry, rz) || 1;
    const len = Math.min(3.4, rl * 0.03), wx = rx / rl * len, wy = ry / rl * len, wz = rz / rl * len;
    const a = 0.1 * k + 0.2 * kr, cw = kr > 0.05 ? 0.82 : 1;
    for (let i = 0; i < n; i++) {
      const m = M[i], dx = m[0] - cam.x, dy = m[1] - cam.y, dz = m[2] - cam.z;
      if (dx * vx + dy * vy + dz * vz < -4 || dx * dx + dy * dy + dz * dz > 48 * 48) {
        // respawn ahead, spread across a wide cone around the flight path
        const d = 5 + Math.random() * 40, sx = (Math.random() * 2 - 1) * 16, sy = (Math.random() * 2 - 1) * 10;
        m[0] = cam.x + vx * d + r[0] * sx + u[0] * sy; m[1] = cam.y + vy * d + r[1] * sx + u[1] * sy; m[2] = cam.z + vz * d + r[2] * sx + u[2] * sy;
        continue;
      }
      // at least about a pixel wide at any distance, or distant streaks break up into dots
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      R.fxBeam(m[0], m[1], m[2], m[0] + wx, m[1] + wy, m[2] + wz, 0.012 + d * 0.0014, cw, cw * 1.02, 1, a * (1 - d / 60));
    }
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
    this.airFX(R, JET_TIP);
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
    R.fxBeam(p[0], p[1], p[2], p[0] - f[0] * len, p[1] - f[1] * len, p[2] - f[2] * len, 0.15 + e * 0.04, 0.7, 1.0, 0.25, 0.22 + e * 0.28);
    R.fxSprite(p[0], p[1], p[2], 0.26, 0.75, 1.0, 0.3, 0.5);
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
  engineSpec() { const s = super.engineSpec(); s.thr *= 0.8; s.ab *= 0.7; s.speed *= 0.8; return s; }
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
    this.airFX(R, BOMBER_TIP);
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
