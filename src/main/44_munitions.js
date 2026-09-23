// ============================================================================
//  Munitions: plasma bolts, homing missiles, rockets, cutting laser, blasts.
//  Simulated per frame with swept ray tests against blocks and entities.
// ============================================================================
class Munitions {
  constructor(game) { this.game = game; this.list = []; this.flashes = []; this.beams = []; this.burn = new Map(); this.t = 0; }
  get world() { return this.game.world; }
  beginFrame() { this.beams.length = 0; }
  bolt(owner, x, y, z, dx, dy, dz, speed, o) {
    this.list.push({ kind: 'bolt', owner, x, y, z, dx, dy, dz, speed, life: o.life || 1.5, age: 0, dmg: o.dmg, color: o.color, size: o.size, len: o.len, power: o.power || 0 });
    this.game.audio.play(o.sound || 'plasma', { x, y, z, range: 48, vol: 0.55 });
  }
  missile(owner, x, y, z, dx, dy, dz, speed0, target, o) {
    this.list.push({ kind: 'missile', owner, x, y, z, dx, dy, dz, speed: Math.max(35, speed0 * 0.9), target, life: 8, age: 0, power: o.power, trail: 0, dmg: 0 });
    this.game.audio.play('missile', { x, y, z, range: 60 });
  }
  rocket(owner, x, y, z, dx, dy, dz, o) {
    this.list.push({ kind: 'rocket', owner, x, y, z, dx, dy, dz, speed: 95, life: 4.5, age: 0, power: o.power, trail: 0, dmg: 0 });
    this.game.audio.play('rocket', { x, y, z, range: 50, vol: 0.7 });
  }
  bomb(owner, x, y, z, vx, vy, vz, o) {
    const sp = Math.hypot(vx, vy, vz) || 1;
    this.list.push({ kind: 'bomb', owner, x, y, z, vx, vy, vz, dx: vx / sp, dy: vy / sp, dz: vz / sp, speed: sp, grav: BOMB_G, life: 25, age: 0, power: o.power, trail: 0, dmg: 0 });
    this.game.audio.play('bomb_drop', { x, y, z, range: 70 });
  }
  shell(owner, x, y, z, dx, dy, dz, speed, o) {
    this.list.push({ kind: 'shell', owner, x, y, z, vx: dx * speed, vy: dy * speed, vz: dz * speed, dx, dy, dz, speed, grav: SHELL_G, life: 9, age: 0, power: o.power, trail: 0, dmg: 0 });
    this.game.audio.play('cannon', { x, y, z, range: 90 });
  }
  // hitscan beam for this frame; burns through blocks it dwells on
  laser(owner, x, y, z, dx, dy, dz, range, dt, o) {
    const w = this.world;
    const hit = raycast(w, x, y, z, dx, dy, dz, range, false);
    let t = hit ? hit.t : range, ent = null;
    for (const e of w.entitiesNear(x + dx * t / 2, y + dy * t / 2, z + dz * t / 2, t / 2 + 3)) {
      if (!this.hittable(e, owner)) continue;
      const hw = e.w / 2 + 0.1, h = rayAABB(x, y, z, dx, dy, dz, [e.x - hw, e.y - 0.1, e.z - hw, e.x + hw, e.y + e.h + 0.1, e.z + hw]);
      if (h && h.t < t) { t = h.t; ent = e; }
    }
    const ex = x + dx * t, ey = y + dy * t, ez = z + dz * t;
    if (ent) {
      ent._lz = (ent._lz || 0) + o.dps * dt;
      if (ent._lz >= 2) { const d = Math.floor(ent._lz); ent._lz -= d; ent.invul = 0; ent.hurt(d, { type: 'laser', source: owner.rider || owner, kb: 0.05 }); if (!ent.isVehicle) ent.fireTicks = Math.max(ent.fireTicks || 0, 40); }
    } else if (hit) {
      const b = BLOCKS[hit.id], hard = b ? b.hard : 1;
      if (hard !== undefined && hard >= 0 && hard < 40 && hit.id !== B.bedrock) {
        const key = hit.x + ',' + hit.y + ',' + hit.z;
        let bb = this.burn.get(key);
        if (!bb) { bb = { p: 0, last: 0 }; this.burn.set(key, bb); }
        bb.p += dt / (0.1 + hard * 0.09); bb.last = this.t;
        if (bb.p >= 1) {
          this.burn.delete(key);
          this.game.particles.blockBreak(hit.x, hit.y, hit.z, hit.v);
          w.setBlock(hit.x, hit.y, hit.z, 0, 1);
          if (Math.random() < 0.5) this.game.audio.play('fizz', { x: hit.x, y: hit.y, z: hit.z, vol: 0.4 });
        }
      }
    }
    if (Math.random() < dt * 30) this.game.particles.spawn('p_spark', ex, ey, ez, { vx: (Math.random() - 0.5) * 0.25, vy: Math.random() * 0.25, vz: (Math.random() - 0.5) * 0.25, grav: 0.03, life: 10 + Math.random() * 10, size: 0.08, color: [1, 0.5, 0.2], emissive: true, collide: true });
    this.beams.push({ x, y, z, ex, ey, ez, c: o.color, w: o.width });
    owner.laserHit = owner.laserHit || [0, 0, 0]; owner.laserHit[0] = ex; owner.laserHit[1] = ey; owner.laserHit[2] = ez;
    this.game.audio.loop('laser', owner, 0.6, x, y, z);
  }
  hittable(e, owner) {
    return !(e === owner || e === owner.rider || e.removed || e.dead || !e.hurt || e.type === 'item' || e.type === 'xp' || e.isProjectile || (e.isPlayer && e.vehicle === owner));
  }
  findTarget(owner, dir, cone, range) {
    const w = this.world, c = owner.center ? owner.center([0, 0, 0]) : [owner.x, owner.y, owner.z];
    let best = null, bs = cone;
    for (const e of w.entitiesNear(c[0], c[1], c[2], range)) {
      if (!(e.isMob || (e.isVehicle && e !== owner)) || e.dead || e.removed) continue;
      const dx = e.x - c[0], dy = e.y + e.h * 0.5 - c[1], dz = e.z - c[2], d = Math.hypot(dx, dy, dz) || 1;
      const a = Math.acos(clamp((dx * dir[0] + dy * dir[1] + dz * dir[2]) / d, -1, 1)) * (e.isMob && e.def.hostile ? 0.8 : 1);
      if (a < bs) { bs = a; best = e; }
    }
    if (best && rayBlocked(w, c[0], c[1], c[2], best.x, best.y + best.h * 0.5, best.z)) return null;
    return best;
  }
  // ------------------------------------------------------------ simulation
  update(dt) {
    this.t += dt;
    const w = this.world, L = this.list, P = this.game.particles;
    let j = 0;
    for (let i = 0; i < L.length; i++) {
      const m = L[i];
      m.age += dt;
      if (m.age > m.life) { if (m.kind !== 'bolt') this.detonate(m, m.x, m.y, m.z); continue; }
      if (m.kind === 'missile') this.guide(m, dt);
      if (m.grav) { m.vy -= m.grav * dt; m.speed = Math.hypot(m.vx, m.vy, m.vz) || 1e-3; m.dx = m.vx / m.speed; m.dy = m.vy / m.speed; m.dz = m.vz / m.speed; }
      if (m.kind === 'rocket') { m.dy -= 0.9 * dt / 10; const l = Math.hypot(m.dx, m.dy, m.dz); m.dx /= l; m.dy /= l; m.dz /= l; }
      const step = m.speed * dt;
      const hit = raycast(w, m.x, m.y, m.z, m.dx, m.dy, m.dz, step, false);
      let et = hit ? hit.t : step, ent = null;
      const mx = m.x + m.dx * step * 0.5, my = m.y + m.dy * step * 0.5, mz = m.z + m.dz * step * 0.5;
      for (const e of w.entitiesNear(mx, my, mz, step * 0.5 + 4)) {
        if (!this.hittable(e, m.owner)) continue;
        const pad = m.kind === 'bolt' ? m.size * 0.6 + 0.1 : 0.35;
        const hw = e.w / 2 + pad, h = rayAABB(m.x, m.y, m.z, m.dx, m.dy, m.dz, [e.x - hw, e.y - pad, e.z - hw, e.x + hw, e.y + e.h + pad, e.z + hw]);
        if (h && h.t <= et) { et = h.t; ent = e; }
      }
      if (ent || hit) {
        const px = m.x + m.dx * et, py = m.y + m.dy * et, pz = m.z + m.dz * et;
        if (ent && m.dmg) { ent.invul = 0; ent.hurt(m.dmg, { type: 'plasma', source: m.owner.rider || m.owner, kb: 0.3 }); if (ent.isMob) ent.fireTicks = Math.max(ent.fireTicks || 0, 20); }
        if (m.kind === 'bolt') this.impact(m, px - m.dx * 0.1, py - m.dy * 0.1, pz - m.dz * 0.1, hit && !ent ? hit : null);
        else this.detonate(m, px - m.dx * 0.3, py - m.dy * 0.3, pz - m.dz * 0.3);
        continue;
      }
      m.x += m.dx * step; m.y += m.dy * step; m.z += m.dz * step;
      if (m.kind !== 'bolt') {
        m.trail -= dt;
        if (m.trail <= 0) {
          m.trail = m.kind === 'missile' ? 0.03 : m.kind === 'shell' ? 0.02 : 0.045;
          P.spawn('p_smoke', m.x - m.dx * 0.6, m.y - m.dy * 0.6, m.z - m.dz * 0.6, { vx: (Math.random() - 0.5) * 0.02, vy: 0.01, vz: (Math.random() - 0.5) * 0.02, life: 30 + Math.random() * 20, size: 0.45 + Math.random() * 0.3, color: [0.72, 0.72, 0.74], alpha: 0.7 });
        }
        if (m.kind === 'missile' && m.target && !m.target.dead && !m.target.removed) {
          const t = m.target, d = Math.hypot(t.x - m.x, t.y + t.h * 0.5 - m.y, t.z - m.z);
          if (d < 2.4 && m.age > 0.15) { this.detonate(m, m.x, m.y, m.z); continue; }
        }
      }
      if (m.y < -64 || m.y > 400) continue;
      L[j++] = m;
    }
    L.length = j;
    // fade flashes, forget stale laser burns
    let k = 0;
    for (const f of this.flashes) { f.age += dt; if (f.age < f.life) this.flashes[k++] = f; }
    this.flashes.length = k;
    if (this.burn.size) for (const [key, b] of this.burn) if (this.t - b.last > 0.6) this.burn.delete(key);
  }
  guide(m, dt) {
    m.speed = Math.min(m.speed + 190 * dt, 205);
    const t = m.target;
    if (!t || t.dead || t.removed) return;
    const tvx = t.isVehicle ? t.vel[0] : (t.x - t.lx) * 20, tvy = t.isVehicle ? t.vel[1] : (t.y - t.ly) * 20, tvz = t.isVehicle ? t.vel[2] : (t.z - t.lz) * 20;
    const cx = t.x, cy = t.y + t.h * 0.5, cz = t.z;
    const d = Math.hypot(cx - m.x, cy - m.y, cz - m.z), tt = Math.min(2, d / m.speed);
    let ax = cx + tvx * tt - m.x, ay = cy + tvy * tt - m.y, az = cz + tvz * tt - m.z;
    const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
    const ang = Math.acos(clamp(ax * m.dx + ay * m.dy + az * m.dz, -1, 1));
    const maxA = (m.age < 0.25 ? 1.5 : 4.2) * dt;
    if (ang > 1e-4) {
      const k = Math.min(1, maxA / ang);
      m.dx += (ax - m.dx) * k; m.dy += (ay - m.dy) * k; m.dz += (az - m.dz) * k;
      const l = Math.hypot(m.dx, m.dy, m.dz); m.dx /= l; m.dy /= l; m.dz /= l;
    }
  }
  impact(m, x, y, z, hit) {
    const g = this.game, P = g.particles;
    const c = m.color;
    for (let i = 0; i < 6; i++) P.spawn('p_spark', x, y, z, { vx: (Math.random() - 0.5) * 0.35, vy: Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.35, grav: 0.035, life: 8 + Math.random() * 10, size: 0.07 + Math.random() * 0.05, color: [Math.min(1, c[0] + 0.2), Math.min(1, c[1] + 0.2), c[2]], emissive: true, collide: true });
    this.flashes.push({ x, y, z, size: 0.7 + m.size * 2, life: 0.12, age: 0, c, i: 2.5 });
    if (m.power > 0) explode(this.world, x, y, z, m.power, false, m.owner);
    else {
      g.audio.play('impact', { x, y, z, range: 32, vol: 0.4 });
      if (hit) { const id = hit.id; if (id && (LEAVES[id] || PLANT[id] || id === B.glass || id === B.glass_pane || id === B.ice) && Math.random() < 0.5) { P.blockBreak(hit.x, hit.y, hit.z, hit.v); this.world.setBlock(hit.x, hit.y, hit.z, 0, 1); } }
    }
  }
  detonate(m, x, y, z) {
    explode(this.world, x, y, z, m.power || 2.5, false, m.owner);
  }
  // bright flash + dynamic light for any explosion
  blast(x, y, z, s) {
    this.flashes.push({ x, y, z, size: 3.2 * s + 1.5, life: 0.45, age: 0, c: [1.0, 0.62, 0.28], i: 3.5, boom: s });
    const P = this.game.particles;
    for (let i = 0; i < 10 * s + 6; i++) P.spawn('p_spark', x, y, z, { vx: (Math.random() - 0.5) * 0.7 * s, vy: Math.random() * 0.55 * s, vz: (Math.random() - 0.5) * 0.7 * s, grav: 0.03, life: 16 + Math.random() * 18, size: 0.1 + Math.random() * 0.08, color: [1, 0.55 + Math.random() * 0.3, 0.15], emissive: true, collide: true });
  }
  // ------------------------------------------------------------ rendering
  drawFX(R) {
    for (const m of this.list) {
      if (m.kind === 'bolt') {
        const c = m.color, l = Math.min(m.len, m.age * m.speed + 0.3);
        R.fxBeam(m.x - m.dx * l, m.y - m.dy * l, m.z - m.dz * l, m.x, m.y, m.z, m.size, c[0], c[1], c[2], 2.2);
        R.fxSprite(m.x, m.y, m.z, m.size * 2.4, c[0], c[1], c[2], 0.7);
      } else if (m.kind === 'bomb') {
        R.fxBeam(m.x - m.dx * 0.55, m.y - m.dy * 0.55, m.z - m.dz * 0.55, m.x, m.y, m.z, 0.15, 1.0, 0.6, 0.14, 1.3);
        R.fxSprite(m.x, m.y, m.z, 0.55, 1.0, 0.5, 0.12, 0.7 + 0.3 * Math.sin(m.age * 30));
      } else if (m.kind === 'shell') {
        R.fxBeam(m.x - m.dx * 3.5, m.y - m.dy * 3.5, m.z - m.dz * 3.5, m.x, m.y, m.z, 0.13, 1.0, 0.82, 0.45, 2.2);
        R.fxSprite(m.x, m.y, m.z, 0.4, 1.0, 0.85, 0.55, 1.2);
      } else {
        const big = m.kind === 'missile';
        const bl = big ? 0.9 : 0.6;
        R.fxBeam(m.x - m.dx * bl, m.y - m.dy * bl, m.z - m.dz * bl, m.x, m.y, m.z, big ? 0.09 : 0.07, 0.9, 0.88, 0.8, 0.8);
        const fx = m.x - m.dx * (bl + 0.1), fy = m.y - m.dy * (bl + 0.1), fz = m.z - m.dz * (bl + 0.1);
        const fl = 0.8 + Math.random() * 0.6;
        R.fxBeam(fx, fy, fz, fx - m.dx * fl * 1.6, fy - m.dy * fl * 1.6, fz - m.dz * fl * 1.6, big ? 0.22 : 0.17, 1.0, 0.55, 0.18, 1.6);
        R.fxSprite(fx, fy, fz, big ? 0.55 : 0.4, 1.0, 0.7, 0.35, 1.3);
      }
    }
    for (const b of this.beams) {
      const c = b.c, flick = 0.85 + Math.random() * 0.3;
      R.fxBeam(b.x, b.y, b.z, b.ex, b.ey, b.ez, b.w * 3.2, c[0], c[1] * 0.8, c[2], 0.5 * flick);
      R.fxBeam(b.x, b.y, b.z, b.ex, b.ey, b.ez, b.w, 1.0, 0.75, 0.6, 2.0 * flick);
      R.fxSprite(b.ex, b.ey, b.ez, 0.6 + Math.random() * 0.3, c[0], c[1], c[2], 1.6);
      R.fxSprite(b.x, b.y, b.z, 0.35, c[0], c[1], c[2], 1.2);
    }
    for (const f of this.flashes) {
      const t = f.age / f.life, a = (1 - t) * (1 - t);
      R.fxSprite(f.x, f.y, f.z, f.size * (0.6 + t * 0.8), f.c[0], f.c[1], f.c[2], f.i * a);
      if (f.boom) R.fxSprite(f.x, f.y, f.z, f.size * (0.3 + t * 2.4), 1.0, 0.85, 0.6, 0.6 * a);
    }
  }
  addLights(R) {
    for (const f of this.flashes) { const a = 1 - f.age / f.life; R.addLight(f.x, f.y, f.z, f.boom ? 14 + f.boom * 8 : 5, f.c[0], f.c[1], f.c[2], (f.boom ? 5 : 2) * a * a); }
    let n = 0;
    for (const m of this.list) {
      if (n++ > 24) break;
      if (m.kind === 'bolt') R.addLight(m.x, m.y, m.z, 5 + m.size * 6, m.color[0], m.color[1], m.color[2], 1.4);
      else R.addLight(m.x, m.y, m.z, 7, 1.0, 0.6, 0.25, 1.6);
    }
  }
}
