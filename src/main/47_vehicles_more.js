// ============================================================================
//  More vehicles: TITAN assault mech (a walker), NAUTILUS submarine and MOLE tunnel borer.
//  Same conventions as the other vehicles: model space forward -Z, up +Y, velocities in blocks/s.
// ============================================================================
Object.assign(VEH_DEFS, {
  mech: { name: 'Titan Assault Mech', item: 'titan_mech', model: 'mech', w: 3.0, h: 5.8, yoff: 3.2, hull: 380, enclosed: true, cockpit: [0, 2.0, -1.1], camDist: 13, camH: 2.2, radius: 4.4 },
  sub: { name: 'Nautilus Submarine', item: 'nautilus_sub', model: 'sub', w: 2.4, h: 2.1, yoff: 1.0, hull: 240, enclosed: true, cockpit: [0, 1.02, -1.9], camDist: 11, camH: 2.4, radius: 4.2 },
  drill: { name: 'Mole Tunnel Borer', item: 'mole_drill', model: 'drill', w: 2.7, h: 2.4, yoff: 0.05, hull: 320, enclosed: true, cockpit: [0, 2.42, 0.25], camDist: 9, camH: 3.0, radius: 3.6 },
});
Object.assign(VEH_HELP, {
  mech: [['MOUSE', 'aim torso'], ['WASD', 'walk (toward your aim)'], ['CTRL', 'run'], ['SPACE', 'jump jets'], ['LMB', 'autocannons'], ['RMB', 'rocket salvo'], ['F', 'exit'], ['F5', 'camera']],
  sub: [['MOUSE', 'steer / dive'], ['W/S', 'propeller'], ['SPACE/SHIFT', 'ballast up/down'], ['CTRL', 'boost'], ['LMB', 'pulse laser'], ['RMB', 'torpedo'], ['F', 'exit'], ['F5', 'camera']],
  drill: [['W/S', 'drive'], ['A/D', 'turn'], ['LMB', 'hold to drill'], ['MOUSE', 'bore angle'], ['CTRL', 'overdrive'], ['RMB', 'seismic charge'], ['F', 'exit'], ['F5', 'camera']],
});
// ---------------------------------------------------------------- models
function buildMechModel(gl) {
  const S = 1 / 8;
  const pal = (g) => ({
    GUN: g.c(0x4B5059, MAT_PAINT), GUN2: g.c(0x3A3E46, MAT_PAINT), DARK: g.c(0x202328, MAT_PAINT), YEL: g.c(0xE3AE24, MAT_PAINT), BLK: g.c(0x121315, MAT_MATTE),
    MET: g.c(0x8C9199, MAT_METAL), GLASS: g.c(0x2E8FB0, MAT_GLASS), CYAN: g.c(0x6AE6FF, MAT_GLOW), RED: g.c(0xFF3A24, MAT_GLOW), JET: g.c(0xFF8A3A, MAT_ENGINE),
  });
  // pelvis: a heavy block with the hip joints on either side
  const pv = new VoxGrid(20, 7, 12, S), P = pal(pv);
  pv.box(5, 1, 2, 14, 6, 9, P.GUN2); pv.box(6, 6, 3, 13, 6, 8, P.DARK);
  for (const x0 of [1, 15]) pv.box(x0, 2, 4, x0 + 3, 5, 7, P.MET);
  pv.box(6, 2, 0, 13, 5, 1, P.YEL); for (let x = 6; x <= 13; x += 2) pv.box(x, 2, 0, x, 5, 0, P.BLK);
  // torso: armoured cab with the canopy up front, shoulder blocks, rocket pods and jump jets on the back
  const T = new VoxGrid(30, 22, 22, S), C = pal(T);
  T.each((x, y, z) => {
    if (y > 17) return 0;
    const hw = 8 + Math.min(y, 7) * 0.45, dx = Math.abs(x - 14.5);
    const z0 = 2 + (y < 4 ? 4 - y : 0) + (y > 14 ? y - 14 : 0), z1 = 19 - (y > 12 ? (y - 12) * 0.6 : 0);
    if (dx > hw || z < z0 || z > z1) return 0;
    if (y === 0) return C.DARK;
    if (dx > hw - 1 && y > 12) return C.YEL;
    return (Math.floor(y / 5) + Math.floor(z / 6)) % 2 ? C.GUN : C.GUN2;
  });
  T.box(11, 9, 1, 18, 14, 3, C.DARK); T.box(12, 10, 1, 17, 14, 2, C.GLASS);
  T.box(12, 4, 1, 17, 6, 1, C.CYAN); for (let x = 12; x <= 17; x += 2) T.set(x, 5, 1, C.BLK);
  for (const [x0, x1] of [[0, 5], [24, 29]]) {
    T.box(x0, 10, 6, x1, 16, 15, C.GUN2); T.box(x0, 16, 6, x1, 16, 15, C.YEL);
    // rocket pod on the shoulder: a grid of tubes facing forward
    T.box(x0, 17, 7, x1, 21, 14, C.GUN);
    for (let x = x0 + 1; x <= x1 - 1; x += 2) for (let y = 18; y <= 20; y += 2) { T.set(x, y, 7, C.BLK); T.set(x, y, 6, C.RED); }
  }
  T.set(3, 14, 5, C.RED); T.set(26, 14, 5, C.RED);
  for (const x0 of [9, 17]) { T.box(x0, 4, 19, x0 + 3, 10, 20, C.DARK); T.box(x0 + 1, 5, 21, x0 + 2, 9, 21, C.JET); }
  T.box(13, 17, 12, 16, 19, 15, C.MET); T.set(14, 20, 13, C.RED);
  // gun arm: shoulder housing and a rotary cannon of three barrels
  const A = new VoxGrid(7, 7, 26, S), AC = pal(A);
  A.box(0, 0, 15, 6, 6, 25, AC.GUN2); A.box(0, 6, 15, 6, 6, 25, AC.YEL); A.box(1, 1, 12, 5, 5, 14, AC.DARK);
  for (const [bx, by] of [[2, 2], [4, 2], [3, 4]]) for (let z = 0; z <= 11; z++) A.set(bx, by, z, z === 0 ? AC.CYAN : AC.MET);
  for (const z of [3, 9]) { A.box(1, 1, z, 5, 5, z, AC.DARK); A.box(2, 2, z, 4, 4, z, AC.MET); }
  // legs: thigh, shin with a piston, and a broad foot
  const TH = new VoxGrid(6, 11, 7, S), TC = pal(TH);
  TH.box(0, 1, 0, 5, 10, 6, TC.GUN); TH.box(0, 3, 0, 5, 9, 0, TC.YEL); TH.box(1, 0, 1, 4, 1, 5, TC.MET);
  const SH = new VoxGrid(6, 11, 8, S), SC = pal(SH);
  SH.box(0, 1, 1, 5, 10, 6, SC.GUN2); SH.box(1, 3, 0, 4, 9, 0, SC.DARK); SH.box(2, 2, 7, 3, 9, 7, SC.MET); SH.box(1, 9, 1, 4, 10, 5, SC.MET);
  const FT = new VoxGrid(9, 3, 13, S), FC = pal(FT);
  FT.box(0, 0, 0, 8, 1, 12, FC.DARK); FT.box(1, 2, 2, 7, 2, 10, FC.GUN); FT.box(0, 0, 0, 8, 0, 1, FC.YEL); FT.box(3, 2, 4, 5, 2, 7, FC.MET);
  return voxModel(gl, 'mech', {
    pelvis: { grid: pv, origin: [10, 3.5, 6] }, torso: { grid: T, origin: [15, 0, 11] },
    armL: { grid: A, origin: [3.5, 3.5, 22] }, armR: { grid: A, origin: [3.5, 3.5, 22] },
    thighL: { grid: TH, origin: [3, 10.5, 3.5] }, thighR: { grid: TH, origin: [3, 10.5, 3.5] },
    shinL: { grid: SH, origin: [3, 10.5, 4] }, shinR: { grid: SH, origin: [3, 10.5, 4] },
    footL: { grid: FT, origin: [4.5, 3, 7] }, footR: { grid: FT, origin: [4.5, 3, 7] },
  });
}
function buildSubModel(gl) {
  const W = 22, H = 22, L = 60, S = 1 / 8, g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  const TEAL = C(0x2C686B, MAT_PAINT), TEAL2 = C(0x23585B, MAT_PAINT), BELLY = C(0x1B3436, MAT_PAINT), BRASS = C(0xB88A3A, MAT_METAL), RIVET = C(0xD8B060, MAT_METAL);
  const GLASS = C(0x6CC4D4, MAT_GLASS), LAMP = C(0xFFF2CC, MAT_GLOW), DARK = C(0x101818, MAT_MATTE), RED = C(0xFF4A30, MAT_GLOW), GRN = C(0x46FF7A, MAT_GLOW), PORT = C(0xFFCF78, MAT_GLOW);
  const cx = 10.5, cy = 8;
  const rad = (z) => z < 11 ? 7.5 * Math.sqrt(Math.max(0, 1 - ((11 - z) / 11.5) ** 2)) : z > 44 ? Math.max(1.6, 7.5 - (z - 44) * 0.42) : 7.5;
  g.each((x, y, z) => {
    const r = rad(z), dx = x - cx, dy = y - cy;
    if ((dx * dx) / (r * r) + (dy * dy) / (r * r * 0.86) > 1) return 0;
    if (z <= 4 && dy > -3) return GLASS;
    if (z % 7 === 3 && z > 6 && z < 50) return (Math.abs(dx) + Math.abs(dy)) % 3 === 0 ? RIVET : BRASS;
    if (dy < -r * 0.35) return BELLY;
    return (Math.floor(z / 7) % 2) ? TEAL : TEAL2;
  });
  // conning tower with portholes, dive planes and a periscope
  g.each((x, y, z) => {
    if (z < 18 || z > 30 || y < 14 || y > 19 || Math.abs(x - cx) > 2.6) return 0;
    if (y === 19) return BRASS;
    if ((y === 16 || y === 17) && (z === 21 || z === 25) && Math.abs(x - cx) > 2) return PORT;
    return TEAL;
  });
  for (let z = 20; z <= 23; z++) { g.box(3, 17, z, 7, 17, z, BRASS); g.box(14, 17, z, 18, 17, z, BRASS); }
  for (let y = 20; y <= 21; y++) g.set(10, y, 21, BRASS); g.set(10, 21, 20, DARK);
  // lamps either side of the bow window
  for (const x of [5, 16]) { g.set(x, 6, 4, LAMP); g.set(x, 6, 5, LAMP); }
  g.set(1, 8, 26, RED); g.set(20, 8, 26, GRN);
  // stern fins
  for (let z = 50; z <= 57; z++) { const k = z - 50; for (let y = 13; y <= 20 - Math.floor(k / 3); y++) g.set(10, y, z, TEAL2); for (let y = 0; y <= 3 + Math.floor(k / 3); y++) g.set(10, y, z, TEAL2); for (let x = 0; x <= 5 - Math.floor(k / 3); x++) { g.set(x, 8, z, TEAL2); g.set(21 - x, 8, z, TEAL2); } }
  // propeller (spins about the hull axis)
  const pr = new VoxGrid(13, 13, 3, S), PB = pr.c(0xC89A44, MAT_METAL), PH = pr.c(0x6A5020, MAT_METAL);
  pr.box(5, 5, 0, 7, 7, 2, PH);
  for (let i = 1; i <= 6; i++) { pr.set(6 + i, 6, 1, PB); pr.set(6 - i, 6, 1, PB); pr.set(6, 6 + i, 1, PB); pr.set(6, 6 - i, 1, PB); if (i > 2) { pr.set(6 + i, 7, 1, PB); pr.set(6 - i, 5, 1, PB); pr.set(5, 6 + i, 1, PB); pr.set(7, 6 - i, 1, PB); } }
  return voxModel(gl, 'sub', { body: { grid: g, origin: [11, 8, 30] }, prop: { grid: pr, origin: [6.5, 6.5, 1.5] } });
}
function buildDrillModel(gl) {
  const W = 22, H = 20, L = 44, S = 1 / 8, g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  const YEL = C(0xD9A524, MAT_PAINT), YEL2 = C(0xC49320, MAT_PAINT), BLK = C(0x1A1A1C, MAT_MATTE), TREAD = C(0x2A2A2C, MAT_MATTE), TREAD2 = C(0x3A3A3D, MAT_MATTE);
  const STEEL = C(0x7A7F86, MAT_METAL), DARK = C(0x2E3136, MAT_PAINT), GLASS = C(0x3F6F80, MAT_GLASS), LAMP = C(0xFFF0C0, MAT_GLOW), BEACON = C(0xFF8A1E, MAT_GLOW), RUST = C(0x6A4A2A, MAT_PAINT);
  // tracks
  for (const x0 of [0, 17]) {
    g.each((x, y, z) => {
      if (x < x0 || x > x0 + 4 || z < 8 || z > 41) return 0;
      const e = Math.max(0, 11 - z, z - 38);                 // rounded ends
      if (y > 6 - e * 0.8 || y < e * 0.6) return 0;
      if (x === x0 + 2 && y > 1 && y < 6 && z % 8 === 4) return STEEL;
      return (z % 2) ? TREAD : TREAD2;
    });
  }
  // chassis with hazard stripes, the cab, the engine and exhaust stacks
  g.box(4, 3, 9, 17, 10, 40, YEL);
  for (let x = 4; x <= 17; x++) for (let y = 3; y <= 10; y++) if ((x + y) % 4 < 2) g.set(x, y, 9, BLK);
  g.box(4, 10, 12, 17, 10, 40, YEL2);
  g.box(7, 11, 22, 14, 17, 33, YEL); g.box(8, 12, 22, 13, 16, 22, GLASS); for (const x of [7, 14]) g.box(x, 13, 24, x, 16, 31, GLASS);
  g.box(7, 18, 22, 14, 18, 33, DARK); g.set(10, 19, 28, BEACON); g.set(11, 19, 28, BEACON);
  g.set(8, 17, 22, LAMP); g.set(13, 17, 22, LAMP);
  g.box(6, 11, 34, 15, 14, 40, DARK); for (const x of [7, 14]) g.box(x, 15, 38, x, 19, 38, RUST);
  // drill mount
  g.box(5, 2, 4, 16, 12, 8, DARK); g.box(7, 4, 3, 14, 10, 3, STEEL);
  g.set(5, 11, 4, LAMP); g.set(16, 11, 4, LAMP);
  // the drill: a spiral-fluted cone (spins about its axis)
  const d = new VoxGrid(17, 17, 18, S), D1 = d.c(0xB9BEC6, MAT_METAL), D2 = d.c(0x5E636B, MAT_METAL), TIP = d.c(0xE8E2D0, MAT_METAL);
  d.each((x, y, z) => {
    const dx = x - 8, dy = y - 8, r = Math.hypot(dx, dy), R = 1 + 7.2 * Math.pow(z / 17, 0.85);
    if (r > R) return 0;
    if (z < 2) return TIP;
    const a = Math.atan2(dy, dx);
    return ((a / Math.PI * 1.5 + z * 0.28) % 2 + 2) % 2 < 1 ? D1 : D2;
  });
  return voxModel(gl, 'drill', { body: { grid: g, origin: [11, 0, 22] }, drill: { grid: d, origin: [8.5, 8.5, 18] } });
}
function buildMoreVehicleModels(gl) { buildMechModel(gl); buildSubModel(gl); buildDrillModel(gl); }
// ---------------------------------------------------------------- TITAN assault mech
const MECH_Y0 = -3.2, MECH_THIGH = 1.25, MECH_SHIN = 1.25, MECH_FOOT = 0.375, MECH_HIP = MECH_THIGH + MECH_SHIN + MECH_FOOT;
const _mm = M4.create(), _mm2 = M4.create();
class TitanMech extends Vehicle {
  constructor(x, y, z, yaw) {
    super('mech', x, y, z, yaw);
    this.legYaw = yaw || 0; this.torsoYaw = 0; this.armPitch = 0; this.phase = 0; this.walk = 0; this.lean = 0; this.airK = 0;
    this.fuel = 1; this.jets = 0; this.stepIdx = 0; this.salvo = 0; this.salvoT = 0; this.mReload = 0; this.side = 1;
    this.recoil = [0, 0]; this.flash = [0, 0];
    this.specs = {}; for (const n of ['pelvis', 'torso', 'armL', 'armR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR']) this.specs[n] = { n };
  }
  engineSpec() { return { kind: 'mech', thr: this.rider ? 0.3 + this.walk * 0.4 : 0, speed: this.speed, boost: this.jets }; }
  step(dt, inp) {
    this.impulses();
    const v = this.vel, ctl = !!(this.rider && inp), p = this.rider, w = this.world;
    let mx = 0, mz = 0;
    if (ctl) { const cy = p.yaw, f = inp.f, s = inp.s; mx = Math.sin(cy) * f + Math.cos(cy) * s; mz = -Math.cos(cy) * f + Math.sin(cy) * s; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } }
    const moving = mx !== 0 || mz !== 0, ground = this.onGround;
    this.boosting = ctl && inp.boost && moving && this.boost > 0.02 && ground;
    if (this.boosting) this.boost = Math.max(0, this.boost - dt * 0.12);
    const top = this.boosting ? 10.5 : 6;
    // the legs turn to face the way it walks (walking backward instead when that is the shorter turn)
    if (moving) {
      let want = Math.atan2(mx, -mz);
      if (Math.abs(angleDiff(this.legYaw, want)) > 2.1) want += Math.PI;
      this.legYaw += clamp(angleDiff(this.legYaw, want), -1.9 * dt, 1.9 * dt);
    }
    const acc = ground ? 15 : 3.5;
    v[0] += clamp(mx * top - v[0], -acc * dt, acc * dt); v[2] += clamp(mz * top - v[2], -acc * dt, acc * dt);
    // jump jets
    this.jets = 0;
    if (ctl && inp.up && this.fuel > 0.02) { this.jets = 1; v[1] = Math.min(9, v[1] + 31 * dt); this.fuel = Math.max(0, this.fuel - dt * 0.32); }
    else if (ground) this.fuel = Math.min(1, this.fuel + dt * 0.22);
    v[1] -= 22 * dt;
    const bx = Math.floor(this.x), bz = Math.floor(this.z), wet = FLUID[w.getId(bx, Math.floor(this.y + 1), bz)] === 1;
    if (wet) { v[0] *= 1 - Math.min(1, dt * 1.6); v[2] *= 1 - Math.min(1, dt * 1.6); if (v[1] < -5) v[1] = -5; }
    const oy = v[1];
    this.stepH = 1.1;
    moveEntity(w, this, v[0] * dt, v[1] * dt, v[2] * dt);
    if (this.collidedX) v[0] = 0; if (this.collidedZ) v[2] = 0;
    if (this.collidedV) v[1] = 0;
    this.vx = this.vy = this.vz = 0;
    if (!ground && this.onGround && oy < -11) this.stomp(-oy);
    // stride: the legs swing in step with the distance covered
    const on = this.onGround, hs = Math.hypot(v[0], v[2]);
    this.walk += ((on && hs > 0.3 ? Math.min(1, hs / 4.5) : 0) - this.walk) * Math.min(1, dt * 6);
    this.airK += ((on ? 0 : 1) - this.airK) * Math.min(1, dt * 5);
    const fs = v[0] * Math.sin(this.legYaw) - v[2] * Math.cos(this.legYaw);
    if (on) this.phase += fs * dt / 2.7 * Math.PI;
    const si = Math.floor(this.phase / Math.PI);
    if (si !== this.stepIdx && on && hs > 0.6) this.footfall(si & 1);
    this.stepIdx = si;
    this.lean += ((this.boosting ? 0.1 : 0.035) * Math.min(1, hs / 6) - this.lean) * Math.min(1, dt * 3);
    Q.fromHPR(this.q, this.legYaw, 0, 0);
    this.engine = this.rider ? 0.3 + this.walk * 0.5 + this.jets * 0.8 : 0.05;
    this.agl = on ? 0 : Math.max(0, this.y - this.groundUnderBox());
    this.warn = this.hull < this.def.hull * 0.25 ? 'HULL CRITICAL' : this.jets && this.fuel < 0.12 ? 'JETS LOW' : '';
  }
  // a foot comes down: thud, dust, and anything small underfoot gets stepped on
  footfall(k) {
    const g = this.game, s = k ? 1 : -1, f = this.partPoint(k ? 'footR' : 'footL', 0, -0.3, -0.1, _v3);
    g.audio.play('mech_step', { x: f[0], y: f[1], z: f[2], range: 48 });
    const below = this.world.getBlock(Math.floor(f[0]), Math.floor(f[1] - 0.3), Math.floor(f[2]));
    if (below & 4095) for (let i = 0; i < 6; i++) g.particles.spawn(g.particles.blockTex(below, 2), f[0] + (Math.random() - 0.5) * 1.2, f[1] + 0.1, f[2] + (Math.random() - 0.5) * 1.2, { vx: (Math.random() - 0.5) * 0.12, vy: 0.08 + Math.random() * 0.08, vz: (Math.random() - 0.5) * 0.12, grav: 0.03, life: 18, size: 0.14, color: g.particles.tintOf(below, Math.floor(f[0]), Math.floor(f[2])), fade: false });
    if (this.rider === g.player) g.shake = Math.max(g.shake || 0, 0.12 * this.walk);
    for (const e of this.world.entitiesNear(f[0], f[1], f[2], 1.6)) if (e.isMob && !e.dead && e !== this) e.hurt(6, { type: 'mob', source: this.rider || this, kb: 0.6 });
    void s;
  }
  // landing from a jet jump pounds the ground: a shockwave that throws everything nearby
  stomp(sp) {
    const g = this.game, w = this.world, P = g.particles, y = this.y + 0.1;
    g.audio.play('mech_stomp', { x: this.x, y, z: this.z, range: 80 });
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; P.spawn('p_smoke', this.x + Math.cos(a) * 1.5, y + 0.2, this.z + Math.sin(a) * 1.5, { vx: Math.cos(a) * 0.35, vy: 0.03, vz: Math.sin(a) * 0.35, drag: 0.9, life: 26, size: 0.7, color: [0.62, 0.6, 0.56], alpha: 0.75 }); }
    if (g.munitions) g.munitions.flashes.push({ x: this.x, y, z: this.z, size: 3, life: 0.25, age: 0, c: [1, 0.8, 0.5], i: 1.2 });
    if (this.rider === g.player) g.shake = Math.max(g.shake || 0, 0.6);
    const R = 5 + Math.min(3, (sp - 11) * 0.3);
    for (const e of w.entitiesNear(this.x, y, this.z, R)) {
      if (e === this || e === this.rider || e.removed || e.dead || !e.hurt || e.type === 'item' || e.type === 'xp') continue;
      const dx = e.x - this.x, dz = e.z - this.z, d = Math.hypot(dx, dz) || 1, k = 1 - d / R;
      if (k <= 0) continue;
      e.hurt(Math.round(4 + sp * 0.8 * k), { type: 'explosion', source: this.rider || this });
      if (e.isVehicle) { e.vel[0] += dx / d * 12 * k; e.vel[1] += 6 * k; e.vel[2] += dz / d * 12 * k; } else { e.vx += dx / d * 1.1 * k; e.vz += dz / d * 1.1 * k; e.vy = Math.max(e.vy, 0.5 * k + 0.2); }
    }
  }
  // leg angles for the current stride (in-air legs tuck up)
  pose() {
    const P = this._pose || (this._pose = { legL: {}, legR: {}, bob: 0 }), wk = this.walk, ak = this.airK;
    for (const [L, o] of [[P.legL, 0], [P.legR, Math.PI]]) {
      const a = this.phase + o;
      const hip = Math.sin(a) * 0.46 * wk, knee = -(Math.max(0, Math.cos(a)) * 0.8 * wk + 0.12);
      L.hip = hip + (0.32 - hip) * ak; L.knee = knee + (-0.75 - knee) * ak; L.foot = -(L.hip + L.knee) * 0.9;
    }
    P.bob = -Math.abs(Math.sin(this.phase)) * 0.13 * wk - ak * 0.1;
    return P;
  }
  // part transform in model space (relative to center()), shared by rendering, weapons and the cockpit camera
  partLocal(name, out) {
    const P = this.pose(), pelY = MECH_Y0 + MECH_HIP + P.bob;
    M4.identity(out);
    if (name === 'pelvis') { M4.translate(out, 0, pelY, 0); M4.rotX(out, -this.lean * 0.5); return out; }
    if (name === 'torso' || name === 'armL' || name === 'armR') {
      M4.translate(out, 0, pelY + 0.35, 0); M4.rotX(out, -this.lean); M4.rotY(out, this.torsoYaw);
      if (name === 'torso') return out;
      const s = name === 'armR' ? 1 : -1;
      M4.translate(out, s * 1.75, 1.45, -0.1); M4.rotX(out, this.armPitch); M4.translate(out, 0, 0, this.recoil[s > 0 ? 0 : 1] * 0.28);
      return out;
    }
    const s = name.endsWith('R') ? 1 : -1, L = s > 0 ? P.legR : P.legL;
    M4.translate(out, s * 0.85, pelY - 0.1, 0); M4.rotX(out, L.hip);
    if (name.startsWith('thigh')) return out;
    M4.translate(out, 0, -MECH_THIGH, 0); M4.rotX(out, L.knee);
    if (name.startsWith('shin')) return out;
    M4.translate(out, 0, -MECH_SHIN, 0); M4.rotX(out, L.foot);
    return out;
  }
  partPoint(name, lx, ly, lz, out) {
    const m = this.partLocal(name, _mm2);
    return this.local(m[0] * lx + m[4] * ly + m[8] * lz + m[12], m[1] * lx + m[5] * ly + m[9] * lz + m[13], m[2] * lx + m[6] * ly + m[10] * lz + m[14], out);
  }
  partDir(name, lx, ly, lz, out) { const m = this.partLocal(name, _mm2); return Q.rot(this.q, m[0] * lx + m[4] * ly + m[8] * lz, m[1] * lx + m[5] * ly + m[9] * lz, m[2] * lx + m[6] * ly + m[10] * lz, out); }
  parts() { return this.specs; }
  partMatrix(M, base, part, spec) { M.set(base); M4.mul(M, M, this.partLocal(spec.n, _mm)); return M; }
  cameraUpdate(c, dt, p) {
    super.cameraUpdate(c, dt, p);
    // cockpit: on top of the torso, looking out over the gun arms (the torso twists under the view)
    if (p.vcam === 1) { const e = this.partPoint('torso', 0, 2.42, -1.05, _v5); c.x = e[0]; c.y = e[1]; c.z = e[2]; c.roll = 0; }
  }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M) return;
    const aimP = this.aimPoint(_v5, 280);
    // the torso twists toward the aim and the arms pitch to it
    const piv = this.partPoint('torso', 0, 1.45, 0, _v3);
    const dx = aimP[0] - piv[0], dy = aimP[1] - piv[1], dz = aimP[2] - piv[2], dl = Math.hypot(dx, dy, dz) || 1;
    const l = Q.inv(this.q, dx / dl, dy / dl, dz / dl, _v4);
    const wantY = clamp(Math.atan2(-l[0], -l[2]), -2.6, 2.6);
    this.torsoYaw += clamp(angleDiff(this.torsoYaw, wantY), -2.4 * dt, 2.4 * dt);
    const wantP = Math.atan2(l[1], Math.hypot(l[0], l[2]));
    this.armPitch += clamp(clamp(wantP, -0.7, 0.9) - this.armPitch, -2.2 * dt, 2.2 * dt);
    if (inp.fire1 && this.cd1 <= 0 && this.overheat <= 0) {
      this.cd1 = 0.095; this.side = -this.side;
      const k = this.side > 0 ? 0 : 1, arm = this.side > 0 ? 'armR' : 'armL', m = this.partPoint(arm, 0, 0, -2.8, _v3);
      let ex = aimP[0] - m[0], ey = aimP[1] - m[1], ez = aimP[2] - m[2]; const el = Math.hypot(ex, ey, ez) || 1;
      M.bolt(this, m[0], m[1], m[2], ex / el, ey / el, ez / el, 230, { dmg: 5, color: [0.45, 0.9, 1.0], size: 0.13, len: 4.5, life: 1.3, sound: 'blaster' });
      this.recoil[k] = 1; this.flash[k] = 0.06; this.addHeat(0.017);
    }
    // rocket salvo from the shoulder pods: eight rockets rippled over a second
    if (this.mReload > 0) this.mReload -= dt;
    if (inp.fire2 && this.mReload <= 0 && this.salvo <= 0) { this.salvo = 8; this.salvoT = 0; this.mReload = 7; }
    if (this.salvo > 0 && (this.salvoT -= dt) <= 0) {
      this.salvoT = 0.12;
      const s = this.salvo % 2 ? 1 : -1, pod = this.partPoint('torso', s * 1.5, 2.4, -0.7, _v3);
      let rx = aimP[0] - pod[0] + (Math.random() - 0.5) * 3, ry = aimP[1] - pod[1] + 2 + Math.random() * 2, rz = aimP[2] - pod[2] + (Math.random() - 0.5) * 3; const rl = Math.hypot(rx, ry, rz) || 1;
      M.rocket(this, pod[0], pod[1], pod[2], rx / rl, ry / rl, rz / rl, { power: 2.4 });
      this.salvo--;
    }
    for (let k = 0; k < 2; k++) { this.recoil[k] = Math.max(0, this.recoil[k] - dt * 9); this.flash[k] -= dt; }
  }
  drawFX(R) {
    for (let k = 0; k < 2; k++) if (this.flash[k] > 0) { const m = this.partPoint(k ? 'armL' : 'armR', 0, 0, -2.95, _v3); R.fxSprite(m[0], m[1], m[2], 0.55, 0.5, 0.9, 1.0, 1.6); }
    if (this.jets) for (const sx of [-0.6, 0.6]) {
      const n = this.partPoint('torso', sx, 0.85, 1.35, _v3), d = this.partDir('torso', 0, -0.55, 0.85, _v4), len = 1.6 + Math.random() * 0.7;
      R.fxBeam(n[0], n[1], n[2], n[0] + d[0] * len, n[1] + d[1] * len, n[2] + d[2] * len, 0.3, 1.0, 0.55, 0.2, 1.4);
      R.fxSprite(n[0], n[1], n[2], 0.5, 1.0, 0.7, 0.35, 1.2);
    }
  }
  lights(R) {
    const c = this.partPoint('torso', 0, 0.6, -1.4, _v3); R.addLight(c[0], c[1], c[2], 6, 0.45, 0.9, 1.0, 0.6);
    if (this.jets) { const n = this.partPoint('torso', 0, 0.2, 1.8, _v3); R.addLight(n[0], n[1], n[2], 12, 1.0, 0.6, 0.25, 2.6); }
    if (this.flash[0] > 0 || this.flash[1] > 0) { const m = this.partPoint(this.flash[0] > 0 ? 'armR' : 'armL', 0, 0, -3, _v3); R.addLight(m[0], m[1], m[2], 9, 0.5, 0.9, 1.0, 2.2); }
  }
}
// ---------------------------------------------------------------- NAUTILUS submarine
class Nautilus extends Vehicle {
  constructor(x, y, z, yaw) {
    super('sub', x, y, z, yaw);
    this.hy = yaw || 0; this.hp = 0; this.hr = 0; this.prop = 0; this.propA = 0; this.tReload = 0; this.side = 1; this.wet = 0; this.depth = 0; this.pingT = 3; this.bubT = 0;
    this.specs = { prop: { n: 'prop' } };
  }
  engineSpec() { return { kind: 'sub', thr: this.rider ? 0.15 + Math.abs(this.prop) * 0.85 : 0, speed: this.speed, boost: this.boosting ? 1 : 0 }; }
  waterAt(x, y, z) { const id = this.world.getId(Math.floor(x), Math.floor(y), Math.floor(z)); return FLUID[id] === 1 || WLOG[id] === 1; }
  step(dt, inp) {
    this.impulses();
    const v = this.vel, ctl = !!(this.rider && inp), p = this.rider, w = this.world;
    const cx = this.x, cy = this.y + this.def.yoff, cz = this.z;
    const wet = this.waterAt(cx, cy, cz), deep = wet && this.waterAt(cx, cy + 0.95, cz), floating = !wet && this.waterAt(cx, cy - 0.8, cz);
    this.wet = wet || floating ? 1 : 0;
    this.boosting = ctl && inp.boost && this.boost > 0.02 && this.wet && inp.f > 0;
    if (this.boosting) this.boost = Math.max(0, this.boost - dt * 0.14);
    if (this.wet) {
      if (ctl) {
        const turn = clamp(angleDiff(this.hy, p.yaw), -1.25 * dt, 1.25 * dt);
        this.hy += turn; this.hr += (clamp(-turn / dt * 0.35, -0.35, 0.35) - this.hr) * Math.min(1, dt * 3);
        const wantP = deep || p.pitch < 0 ? clamp(p.pitch, -0.75, 0.75) : 0;
        this.hp += clamp(wantP - this.hp, -0.9 * dt, 0.9 * dt);
      } else { this.hp *= 1 - Math.min(1, dt); this.hr *= 1 - Math.min(1, dt * 2); }
      if (!deep && this.hp > 0) this.hp *= 1 - Math.min(1, dt * 3);
      const top = this.boosting ? 15 : 9, cp = Math.cos(this.hp), f0 = Math.sin(this.hy) * cp, f1 = Math.sin(this.hp), f2 = -Math.cos(this.hy) * cp;
      this.prop += ((ctl ? inp.f : 0) - this.prop) * Math.min(1, dt * 2.5);
      const vf = v[0] * f0 + v[1] * f1 + v[2] * f2, want = this.prop * top * (this.prop < 0 ? 0.45 : 1), dv = clamp(want - vf, -10 * dt, 7 * dt);
      v[0] += f0 * dv; v[1] += f1 * dv; v[2] += f2 * dv;
      if (ctl && inp.up) v[1] += 6 * dt; if (ctl && inp.down) v[1] -= 6 * dt;
      // water drag: gentle along the hull, strong sideways
      const a = v[0] * f0 + v[1] * f1 + v[2] * f2, keep = 1 - Math.min(1, dt * 0.35), side = 1 - Math.min(1, dt * 3);
      for (let i = 0; i < 3; i++) { const fi = i === 0 ? f0 : i === 1 ? f1 : f2; v[i] = fi * a * keep + (v[i] - fi * a) * side; }
      // surfaced: it floats with the conning tower out of the water
      if (floating) { v[1] -= 5 * dt; v[1] *= 1 - Math.min(1, dt * 3); }
      else if (!deep && v[1] > 0) v[1] *= 1 - Math.min(1, dt * 5);
    } else {
      // beached or falling: gravity, and the hull grinds to a halt on land
      v[1] -= 20 * dt;
      if (this.onGround) { v[0] *= 1 - Math.min(1, dt * 4); v[2] *= 1 - Math.min(1, dt * 4); }
      this.hp *= 1 - Math.min(1, dt * 3); this.hr *= 1 - Math.min(1, dt * 3); this.prop *= 1 - Math.min(1, dt * 2);
    }
    const oy = v[1];
    this.stepH = 0;
    moveEntity(w, this, v[0] * dt, v[1] * dt, v[2] * dt);
    if (this.collidedX || this.collidedZ) { const hs = Math.hypot(v[0], v[2]); if (hs > 13) this.hurt((hs - 11) * 1.2, { type: 'crash' }); if (this.collidedX) v[0] *= -0.2; if (this.collidedZ) v[2] *= -0.2; }
    if (this.collidedV) { if (oy < -18) this.hurt((-oy - 16) * 1.2, { type: 'crash' }); v[1] = 0; }
    this.vx = this.vy = this.vz = 0;
    Q.fromHPR(this.q, this.hy, this.hp, this.hr);
    this.propA += this.prop * dt * 16;
    this.engine = this.rider ? 0.2 + Math.abs(this.prop) * 0.8 : 0;
    // depth under the surface (for the gauge)
    let d = 0; if (wet) { while (d < 64 && this.waterAt(cx, cy + d + 1, cz)) d++; }
    this.depth = d;
    this.agl = this.wet ? 0 : Math.max(0, this.y - this.groundUnderBox());
    this.warn = this.hull < this.def.hull * 0.25 ? 'HULL CRITICAL' : !this.wet && this.onGround ? 'BEACHED' : '';
  }
  frame(dt, inp) {
    super.frame(dt, inp);
    if (this.removed) return;
    // bubbles off the propeller, and a sonar ping every few seconds while crewed
    const P = this.game.particles;
    if (this.wet && Math.abs(this.prop) > 0.08 && (this.bubT -= dt) <= 0) {
      this.bubT = 0.05 / Math.abs(this.prop);
      const s = this.local((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 4.0, _v3);
      P.spawn('p_bubble', s[0], s[1], s[2], { vx: (Math.random() - 0.5) * 0.04, vy: 0.04 + Math.random() * 0.03, vz: (Math.random() - 0.5) * 0.04, life: 30 + Math.random() * 20, size: 0.1 + Math.random() * 0.08 });
    }
    if (this.rider && this.wet && (this.pingT -= dt) <= 0) { this.pingT = 4; this.game.audio.play('sonar', { vol: 0.35 }); }
  }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M) return;
    const aimP = this.aimPoint(_v5, 200);
    if (inp.fire1 && this.cd1 <= 0 && this.overheat <= 0) {
      this.cd1 = 0.14; this.side = -this.side;
      const m = this.local(this.side * 0.55, -0.35, -3.2, _v3);
      let ex = aimP[0] - m[0], ey = aimP[1] - m[1], ez = aimP[2] - m[2]; const el = Math.hypot(ex, ey, ez) || 1;
      M.bolt(this, m[0], m[1], m[2], ex / el, ey / el, ez / el, 150, { dmg: 4, color: [0.35, 1.0, 0.85], size: 0.1, len: 3, life: 1.0, sound: 'blaster' });
      this.addHeat(0.03);
    }
    if (this.tReload > 0) this.tReload -= dt;
    if (inp.fire2 && this.tReload <= 0) {
      this.tReload = 1.8; this.side = -this.side;
      const m = this.local(this.side * 0.7, -0.5, -2.6, _v3), f = this.fwd;
      M.torpedo(this, m[0], m[1], m[2], f[0], f[1], f[2], { power: 3.4 });
      this.vel[0] -= f[0] * 1.5; this.vel[2] -= f[2] * 1.5;
    }
  }
  parts() { return this.specs; }
  partMatrix(M, base, part, spec) { M.set(base); if (spec && spec.n === 'prop') { M4.translate(M, 0, 0, 3.8); M4.rotZ(M, this.propA); } return M; }
  lamps(out1, out2) { this.local(-0.72, -0.25, -3.35, out1); this.local(0.72, -0.25, -3.35, out2); }
  drawFX(R) {
    const a = _v3, b = _v4, f = this.fwd; this.lamps(a, b);
    for (const q of [a, b]) {
      R.fxSprite(q[0], q[1], q[2], 0.45, 1.0, 0.95, 0.8, 1.4);
      // light shafts through the murk
      if (this.wet) { R.fxBeam(q[0], q[1], q[2], q[0] + f[0] * 9, q[1] + f[1] * 9, q[2] + f[2] * 9, 0.9, 0.5, 0.62, 0.68, 0.16); R.fxBeam(q[0], q[1], q[2], q[0] + f[0] * 16, q[1] + f[1] * 16, q[2] + f[2] * 16, 2.0, 0.35, 0.45, 0.52, 0.06); }
    }
  }
  lights(R) {
    const f = this.fwd, a = _v3, b = _v4; this.lamps(a, b);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
    R.addLight(mx + f[0] * 5, my + f[1] * 5, mz + f[2] * 5, 12, 0.85, 0.95, 1.0, 2.2);
    R.addLight(mx + f[0] * 14, my + f[1] * 14, mz + f[2] * 14, 16, 0.8, 0.92, 1.0, 1.8);
    // working lights on the hull so you can see your own boat in the deep
    if (this.wet) { const c = this.local(0, 2.2, 0.6, _v3); R.addLight(c[0], c[1], c[2], 6, 0.75, 0.9, 1.0, 0.7); }
  }
}
// ---------------------------------------------------------------- MOLE tunnel borer
function isOreBlock(id) {
  const n = BLOCKS[id] && BLOCKS[id].name || '';
  return n.endsWith('_ore') || id === B.ancient_debris || id === B.obsidian || id === B.crying_obsidian || id === B.gilded_blackstone || n.startsWith('amethyst') || id === B.glowstone || (B.budding_amethyst !== undefined && id === B.budding_amethyst);
}
class MoleDrill extends Vehicle {
  constructor(x, y, z, yaw) {
    super('drill', x, y, z, yaw);
    this.hy = yaw || 0; this.pitchA = 0; this.rollA = 0; this.spin = 0; this.spinA = 0; this.boreP = 0; this.mine = new Map(); this.got = {}; this.gotN = 0; this.cReload = 0; this.grinding = 0; this.dustT = 0;
    this.specs = { drill: { n: 'drill' } };
  }
  engineSpec() { return { kind: 'drill', thr: this.rider ? 0.3 + this.spin * 0.5 : 0, speed: this.speed, boost: this.boosting ? 1 : 0 }; }
  step(dt, inp) {
    this.impulses();
    const v = this.vel, ctl = !!(this.rider && inp), p = this.rider, w = this.world;
    this.boosting = ctl && inp.boost && this.boost > 0.02 && (inp.f !== 0 || inp.fire1);
    if (this.boosting) this.boost = Math.max(0, this.boost - dt * 0.1);
    const top = this.boosting ? 7 : 4.5;
    let vf = v[0] * Math.sin(this.hy) - v[2] * Math.cos(this.hy);
    if (ctl && inp.f) vf += clamp(inp.f * top - vf, -12 * dt, 8 * dt); else vf *= 1 - Math.min(1, dt * 5);
    if (ctl) this.hy += inp.s * 1.15 * dt;
    v[0] = Math.sin(this.hy) * vf; v[2] = -Math.cos(this.hy) * vf;
    v[1] -= 20 * dt;
    const oy = v[1];
    this.stepH = 1.1;
    moveEntity(w, this, v[0] * dt, v[1] * dt, v[2] * dt);
    if (this.collidedX) v[0] = 0; if (this.collidedZ) v[2] = 0;
    if (this.collidedV) { if (oy < -20) this.hurt((-oy - 18) * 1.3, { type: 'crash' }); v[1] = 0; }
    this.vx = this.vy = this.vz = 0;
    // the drill spins up while the trigger is held; the bore follows the view pitch
    const want = ctl && inp.fire1 && this.overheat <= 0 ? (this.boosting ? 1.3 : 1) : 0;
    this.spin += (want - this.spin) * Math.min(1, dt * (want ? 2.5 : 1.2));
    this.spinA += this.spin * dt * 18;
    const boreWant = ctl && this.spin > 0.2 ? clamp(p.pitch, -0.62, 0.62) : 0;
    this.boreP += clamp(boreWant - this.boreP, -0.9 * dt, 0.9 * dt);
    if (this.spin > 0.25) this.bore(dt); else this.grinding = 0;
    // attitude: tilted along the bore while drilling, otherwise resting on the ground under the tracks
    const df = this.probeDepth(this.hy, 1.6, 0), db = this.probeDepth(this.hy, -1.6, 0);
    const tp = this.onGround ? clamp(Math.atan2(db - df, 3.2), -0.3, 0.3) : 0;
    this.pitchA += ((this.spin > 0.3 ? this.boreP * 0.55 : tp) - this.pitchA) * Math.min(1, dt * 4);
    Q.fromHPR(this.q, this.hy, this.pitchA, 0);
    this.engine = this.rider ? 0.3 + this.spin * 0.7 : 0.05;
    this.agl = this.onGround ? 0 : Math.max(0, this.y - this.groundUnderBox());
    this.warn = this.hull < this.def.hull * 0.25 ? 'HULL CRITICAL' : this.overheat > 0 ? 'DRILL OVERHEAT' : '';
    if (this.cReload > 0) this.cReload -= dt;
  }
  // bore axis and a frame across it: 3x3 blocks are chewed out ahead of the drill head
  bore(dt) {
    const w = this.world, g = this.game, cp = Math.cos(this.boreP), sp = Math.sin(this.boreP), sy = Math.sin(this.hy), cy = Math.cos(this.hy);
    const fx = sy * cp, fy = sp, fz = -cy * cp, rx = cy, rz = sy, ux = -sy * sp, uy = cp, uz = cy * sp;
    // sample the middle of each block of the cut (rows at +0.5/1.5/2.5) so a slight tilt cannot skip a row
    const ox = this.x, oy = this.y + 1.5, oz = this.z;
    const seen = this._seen || (this._seen = new Set()); seen.clear();
    let hits = 0, tipX = 0, tipY = 0, tipZ = 0;
    // across the cut, sample as wide as the hull itself (2.7 blocks can straddle four columns)
    for (const d of [1.8, 2.6, 3.4]) for (const i of [-1.32, -0.66, 0, 0.66, 1.32]) for (let j = -1; j <= 1; j++) {
      const px = ox + fx * d + rx * i + ux * j, py = oy + fy * d + uy * j, pz = oz + fz * d + rz * i + uz * j;
      const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz), key = bx + ',' + by + ',' + bz;
      if (seen.has(key) || by < 0 || by >= CH) continue;
      seen.add(key);
      const v = w.getBlock(bx, by, bz), id = v & 4095, b = BLOCKS[id];
      if (!id || FLUID[id] || !b || b.hard < 0 || id === B.bedrock || !w.isLoaded(bx, bz)) continue;
      hits++; tipX += px; tipY += py; tipZ += pz;
      let m = this.mine.get(key); if (!m) { m = { p: 0, t: 0 }; this.mine.set(key, m); }
      m.p += dt * this.spin * 2.6 / (0.25 + b.hard * 0.34); m.t = this.t;
      if (m.p >= 1) { this.mine.delete(key); this.dig(bx, by, bz, v); }
    }
    if (this.mine.size > 48) for (const [k, m] of this.mine) if (this.t - m.t > 0.4) this.mine.delete(k);
    this.grinding = hits;
    if (hits) {
      this.addHeat(dt * 0.045 * this.spin);
      if ((this.dustT -= dt) <= 0) {
        this.dustT = 0.04;
        const P = g.particles, x = tipX / hits, y = tipY / hits, z = tipZ / hits;
        P.spawn('p_spark', x, y, z, { vx: (Math.random() - 0.5) * 0.3, vy: Math.random() * 0.25, vz: (Math.random() - 0.5) * 0.3, grav: 0.03, life: 8 + Math.random() * 8, size: 0.06, color: [1, 0.75, 0.3], emissive: true, collide: true });
        P.spawn('p_smoke', x, y, z, { vx: (Math.random() - 0.5) * 0.05, vy: 0.02, vz: (Math.random() - 0.5) * 0.05, life: 30, size: 0.5, color: [0.5, 0.47, 0.44], alpha: 0.6 });
      }
      if (this.rider === g.player) g.shake = Math.max(g.shake || 0, 0.05 * this.spin);
    }
  }
  // a block gives way: ores and precious blocks go straight into the hopper (your inventory), rubble is crushed
  dig(x, y, z, v) {
    const w = this.world, g = this.game, id = v & 4095;
    const be = w.getBE(x, y, z); if (be) g.onBERemoved(be, x, y, z);
    if (Math.random() < 0.45) g.particles.blockBreak(x, y, z, v);
    w.setBlock(x, y, z, 0, 1 | 8);
    if (Math.random() < 0.4) g.audio.play('break', { mat: BLOCKS[id].snd, x: x + 0.5, y: y + 0.5, z: z + 0.5, vol: 0.4 });
    if (!isOreBlock(id)) return;
    const p = this.rider;
    for (const s of blockDrops(v, I.diamond_pickaxe, null)) {
      const left = p ? p.inv.add(s) : s.n;
      if (left > 0) g.dropItem(w, this.x, this.y + 2.6, this.z, { id: s.id, n: left, d: 0 });
      this.got[s.id] = (this.got[s.id] || 0) + s.n; this.gotN += s.n; this.gotLast = s.id; this.gotT = 2.5;
      if (p === g.player) { g.ui.onPickup(s.id, s.n); g.audio.play('pop', { vol: 0.3, pitch: 1.2 }); }
    }
    const xp = blockXP(id); if (xp) g.spawnXP(w, this.x, this.y + 2.6, this.z, xp);
  }
  weapons(dt, inp) {
    const M = this.game.munitions; if (!M) return;
    if (this.gotT > 0) this.gotT -= dt;
    if (inp.fire2 && this.cReload <= 0) {
      this.cReload = 2.6;
      const cp = Math.cos(this.boreP), sp = Math.sin(this.boreP), d = [Math.sin(this.hy) * cp, sp + 0.05, -Math.cos(this.hy) * cp];
      const m = this.local(0, 1.2, -3.2, _v3);
      M.shell(this, m[0], m[1], m[2], d[0], d[1], d[2], 42, { power: 3.6 });
      this.vel[0] -= d[0] * 2; this.vel[2] -= d[2] * 2;
    }
  }
  parts() { return this.specs; }
  partMatrix(M, base, part, spec) { M.set(base); if (spec && spec.n === 'drill') { M4.translate(M, 0, 1.0, -1.75); M4.rotZ(M, this.spinA); } return M; }
  sound(dt) {
    super.sound(dt);
    const a = this.game.audio, c = this.center(_v3);
    if (a.loop) a.loop('drill', this, this.grinding ? 0.55 * this.spin : this.spin > 0.2 ? 0.15 * this.spin : 0, c[0], c[1], c[2]);
  }
  lamps(out1, out2) { this.local(-0.68, 1.42, -2.55, out1); this.local(0.68, 1.42, -2.55, out2); }
  drawFX(R) {
    const a = _v3, b = _v4, f = this.fwd; this.lamps(a, b);
    for (const q of [a, b]) R.fxSprite(q[0], q[1], q[2], 0.35, 1.0, 0.95, 0.75, 1.2);
    // amber beacon on the cab roof
    if ((this.t % 0.8) < 0.4) { const q = this.local(0, 2.45, 0.8, _v3); R.fxSprite(q[0], q[1], q[2], 0.4, 1.0, 0.55, 0.12, 1.3); }
    void f;
  }
  lights(R) {
    const f = this.fwd, a = _v3, b = _v4; this.lamps(a, b);
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
    R.addLight(mx + f[0] * 3.5, my + f[1] * 3.5 - 0.4, mz + f[2] * 3.5, 11, 1.0, 0.92, 0.75, 2.0);
    if (this.grinding) R.addLight(mx + f[0] * 1.5, my - 0.3, mz + f[2] * 1.5, 5, 1.0, 0.6, 0.25, 1.4);
    if ((this.t % 0.8) < 0.4) { const q = this.local(0, 2.5, 0.8, _v3); R.addLight(q[0], q[1], q[2], 7, 1.0, 0.55, 0.15, 1.0); }
  }
}
Object.assign(VEH_CLASSES, { mech: TitanMech, sub: Nautilus, drill: MoleDrill });
