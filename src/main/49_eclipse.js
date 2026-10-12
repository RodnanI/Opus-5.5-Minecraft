// ============================================================================
//  ECLIPSE hypersonic fighter: a needle-nosed black airframe whose forward-swept wings swing back as it speeds
//  up, a fusion halo-ring drive, and a gravity drive (it lifts straight off the ground and hovers below flying
//  speed). LMB: twin hypervelocity rail cannons. RMB: the singularity warhead, a micro black hole that eats the
//  ground and everything around it, then evaporates in one blast.
//  Same conventions as the other vehicles: model space forward -Z, up +Y, right +X, velocities in blocks/s.
// ============================================================================
Object.assign(VEH_DEFS, {
  fighter: { name: 'Eclipse Hypersonic Fighter', item: 'eclipse_fighter', model: 'fighter', w: 4.6, h: 2.2, yoff: 1.1875, hull: 190, enclosed: true, cockpit: [0, 0.6875, -2.0], camDist: 15, camH: 3.6, radius: 3.8 },
});
Object.assign(VEH_HELP, {
  fighter: [['MOUSE', 'steer'], ['W/S', 'throttle'], ['CTRL', 'hyperdrive'], ['SPACE', 'grav-lift'], ['SHIFT', 'brake / sink'], ['A/D', 'roll'], ['LMB', 'rail cannon'], ['RMB', 'singularity'], ['F', 'exit'], ['F5', 'camera']],
});
Object.assign(VEH_HELP_SIM, {
  fighter: [['MOUSE', 'pitch + roll'], ['A/D', 'rudder'], ['W/S', 'throttle'], ['CTRL', 'hyperdrive'], ['SPACE', 'grav-lift'], ['SHIFT', 'brake / sink'], ['C / MMB', 'look around'], ['LMB', 'rail cannon'], ['RMB', 'singularity'], ['F5', 'camera']],
});
// faster and more agile than the Stormcrow; gBlack: the G where the view starts to grey out (inertial dampers);
// grav: the gravity drive (VTOL, hover below flying speed); abDrain: hyperdrive reserve used per second
const FIGHTER_FP = { thrust: 56, ab: 118, abDrain: 0.15, drag: 0.0048, pMax: 1.75, pMin: -1.2, yMax: 0.85, rMax: 5.4, lift0: 14, liftR: 20, stall: 18, takeoff: 46, landMax: 60,
  kP: 7.5, kR: 8, pendP: 0.8, pendR: 2.6, gMax: 11, gNeg: 3.5, nMin: -1.3, nMax: 2.4, resp: 9, gBlack: 7.5, grav: true,
  // nose, left and right wingtip (moved with the sweep), tail, belly, fins, halo ring
  pts: [[0, 0, -4.55], [-3.75, -0.06, -0.31], [3.75, -0.06, -0.31], [0, 0, 4.7], [0, -1.12, 0.3], [0, 1.0, 3.3], [0, -0.9, 3.6]] };
// the singularity warhead: rounds carried, reload (s each), the closest a launch is allowed (blocks), designator
// range; the event timeline (s), horizon radius growing r0 -> r1, pull radius, blocks ripped per second, crater
// half-width / depth, the radius where nothing survives and the edge of the blast, how long the cloud lingers
const SNG = { max: 2, reload: 20, safe: 48, range: 900, form: 0.55, collapse: 5.1, burst: 5.7, r0: 2.3, r1: 3.4, pull: 46, rip: 95, crH: 21, crV: 13, kill: 26, blast: 72, life: 44 };
const _ec1 = [0, 0, 0], _ec2 = [0, 0, 0], _ec3 = [0, 0, 0];
// raycast() walks at most 256 cells; this one keeps going for long sight lines (the warhead designator). It stops
// where the loaded world ends (unloaded chunks read as air): longRaycast.edge is that distance, or -1
function longRaycast(w, x, y, z, dx, dy, dz, maxD, fluids) {
  let lim = maxD;
  for (let t = 0; t < maxD; t += 6) if (!w.isLoaded(Math.floor(x + dx * t), Math.floor(z + dz * t))) { lim = t; break; }
  longRaycast.edge = lim < maxD ? lim : -1;
  let t0 = 0;
  while (t0 < lim) {
    const seg = Math.min(110, lim - t0);
    const hit = raycast(w, x + dx * t0, y + dy * t0, z + dz * t0, dx, dy, dz, seg, fluids);
    if (hit) { hit.t += t0; hit.hx = x + dx * hit.t; hit.hy = y + dy * hit.t; hit.hz = z + dz * hit.t; return hit; }
    t0 += seg;
    const yy = y + dy * t0; if (yy < -2 || yy > CH + 2) return null;
  }
  return null;
}
// a white-out over the whole screen (a DOM layer, so it works with or without post-processing), fading by itself
function screenFlash(a, dur) {
  if (!(a > 0.01)) return;
  let el = document.getElementById('ecflash');
  if (!el) {
    el = document.createElement('div'); el.id = 'ecflash';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle at 50% 45%, #ffffff 0%, #fffaf2 45%, #efe6ff 100%)';
    document.body.insertBefore(el, document.getElementById('ui'));
  }
  for (const an of el.getAnimations ? el.getAnimations() : []) an.cancel();
  if (el.animate) el.animate([{ opacity: Math.min(0.97, a) }, { opacity: Math.min(0.97, a) * 0.9, offset: 0.08 }, { opacity: 0 }], { duration: dur * 1000, easing: 'ease-out', fill: 'forwards' });
}
// ---------------------------------------------------------------- model
function buildFighterModel(gl) {
  const W = 64, H = 22, L = 76, S = 1 / 8, origin = [32, 9.5, 37];
  const g = new VoxGrid(W, H, L, S), C = (rgb, m) => g.c(rgb, m);
  // matte black skin (it hardly catches the sun), satin panels, gold accents and the drive's light
  const HULL = C(0x15171C, MAT_MATTE), HULL2 = C(0x22252D, MAT_PAINT), SEAM = C(0x0B0C0F, MAT_MATTE), EDGE = C(0x3A404C, MAT_PAINT), BELLY = C(0x101114, MAT_MATTE);
  const CHROME = C(0xA4ACB8, MAT_METAL), GUN = C(0x3A4049, MAT_METAL), DARK = C(0x07080A, MAT_MATTE), GOLD = C(0xE0962A, MAT_GLASS), CORONA = C(0xD8A84A, MAT_METAL);
  const CYAN = C(0x4FE6F6, MAT_GLOW), VIOLET = C(0xA36CFF, MAT_GLOW), HALO = C(0xFFE3B5, MAT_ENGINE), JETC = C(0x9FE0FF, MAT_ENGINE);
  const cxv = 31.5;
  // fuselage stations: [z, half width, centre y, height above, depth below]
  const st = [[0, 0.8, 9.5, 0.8, 0.8], [5, 1.6, 9.5, 1.15, 1.05], [12, 2.9, 9.6, 1.6, 1.6], [20, 4.2, 9.8, 2.3, 2.2], [30, 5.3, 9.8, 2.9, 2.6], [42, 6.0, 9.7, 2.8, 2.8], [54, 5.6, 9.6, 2.6, 2.6], [64, 4.0, 9.5, 2.2, 2.2], [72, 2.9, 9.5, 1.9, 1.9], [75, 2.7, 9.5, 1.8, 1.8]];
  const body = (k) => profile(st, k);
  // a blade-edged lifting body: knife chines along the sides, a rounded spine
  const inBody = (x, y, z) => { const [bw, yc, ht, hb] = body(z), dx = Math.abs(x - cxv), dy = y - yc; return Math.pow(dx / bw, 1.5) + Math.pow(Math.abs(dy) / (dy > 0 ? ht : hb), 2.4) <= 1; };
  g.each((x, y, z) => {
    if (!inBody(x, y, z)) return 0;
    const [bw, yc, ht, hb] = body(z), dx = Math.abs(x - cxv), dy = y - yc;
    if (z < 3) return CHROME;
    if (Math.round(dy) === 0 && dx > bw - 0.9 && z > 6 && z < 70) return CYAN;
    if (dy < -hb * 0.4) return BELLY;
    if (z % 11 === 0 && z > 8) return SEAM;
    return dy > ht * 0.45 && z > 28 ? HULL2 : HULL;
  });
  // a low frameless canopy in gold visor glass
  g.each((x, y, z) => {
    if (z < 11 || z > 30) return 0;
    const [, yc, ht] = body(z), t = (z - 11) / 19;
    const ch = 2.6 * Math.sin(Math.PI * Math.pow(t, 0.7)), cw = 3.0 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) + 0.4;
    const dy = y - (yc + ht - 0.7), dx = Math.abs(x - cxv);
    if (dy <= 0 || dy > ch || dx > cw * Math.sqrt(Math.max(0, 1 - (dy / ch) ** 2))) return 0;
    return GOLD;
  });
  // knife-edge strakes blending the wing roots into the body
  g.each((x, y, z) => {
    if (z < 22 || z > 50) return 0;
    const [bw, yc] = body(z), dx = Math.abs(x - cxv), span = bw + (z - 22) * 0.3;
    if (dx < bw - 1 || dx > span || y !== Math.round(yc - 0.6)) return 0;
    return dx > span - 1 ? EDGE : HULL;
  });
  // dorsal spine with running lights behind the canopy
  for (let z = 28; z <= 62; z++) { const [, yc, ht] = body(z), y = Math.round(yc + ht - 0.3); g.set(32, y, z, z % 4 === 0 ? CYAN : EDGE); }
  // violet heat vents on the back
  for (let z = 33; z <= 43; z++) for (const x of [34, 35]) { let y = H - 1; while (y > 0 && !g.get(x, y, z)) y--; if (y > 0) g.set(x, y, z, z % 2 ? VIOLET : DARK); }
  // rail cannons along the lower chines: a dark rail, a charged rail and a chrome muzzle
  for (let z = 15; z <= 40; z++) {
    if (z === 15) { g.set(35, 8, z, CHROME); g.set(35, 7, z, CYAN); continue; }
    g.set(35, 8, z, GUN); if (z < 34) g.set(35, 7, z, z % 3 === 0 ? CYAN : DARK);
  }
  // twin canted fins floating on a line of light above the tail
  for (let j = 0; j < 8; j++) {
    const k0 = Math.round(55 + j * 1.5), k1 = Math.round(70 - j * 0.6), fx = Math.round(34 + j * 0.62);
    for (let z = k0; z <= k1; z++) { const [, yc, ht] = body(z), y = Math.round(yc + ht) + j; g.set(fx, y, z, j === 0 ? CYAN : j >= 6 ? VIOLET : z === k0 ? EDGE : HULL); }
  }
  // the halo drive: a ring around the tail on four struts, glowing on its inner face
  const RZ = 66, RR = 7.6;
  g.each((x, y, z) => {
    const dz = z - RZ; if (Math.abs(dz) > 2.4) return 0;
    const q = Math.hypot(x - cxv, y - 9.5) - RR;
    if (q * q + (dz * dz) / 2.9 > 1) return 0;
    return q < -0.3 ? HALO : Math.abs(dz) > 1.2 ? EDGE : CORONA;
  });
  for (const [sx, sy] of [[1, 1], [1, -1]]) for (let r = 2.5; r <= RR - 1; r += 0.5) { const x = cxv + sx * r * 0.7071, y = 9.5 + sy * r * 0.7071; if (!g.get(Math.round(x), Math.round(y), RZ)) g.set(x, y, RZ, EDGE); }
  // fusion nozzle
  g.each((x, y, z) => {
    if (z < 71) return 0;
    const r = Math.hypot(x - cxv, (y - 9.5) * 1.05);
    if (r > 2.7) return 0;
    if (z >= 74) return r < 1.9 ? JETC : CORONA;
    return r < 1.6 ? DARK : GUN;
  });
  g.mirror();
  // weapons bay: doors (a separate part, hidden while open) over a dark cavity
  const bay = new VoxGrid(W, H, L, S), BD = bay.c(0x1C1E25, MAT_PAINT), BL = bay.c(0xA36CFF, MAT_GLOW);
  for (let z = 32; z <= 46; z++) for (let x = 29; x <= 34; x++) {
    let y = 0; while (y < H && !g.get(x, y, z)) y++;
    if (y >= H - 1) continue;
    bay.set(x, y, z, z === 32 || z === 46 || x === 29 || x === 34 ? BL : BD);
    g.set(x, y, z, 0); g.set(x, y + 1, z, DARK);
  }
  // wings: forward-swept, pivoting at the root so they can sweep back at speed
  const wing = (sd) => {
    const wg = new VoxGrid(W, H, L, S), WH = wg.c(0x15171C, MAT_MATTE), WE = wg.c(0x3A404C, MAT_PAINT), WB = wg.c(0x101114, MAT_MATTE), WK = wg.c(0x22252D, MAT_PAINT), WG = wg.c(0xD8A84A, MAT_METAL);
    const WC = wg.c(0x4FE6F6, MAT_GLOW), WV = wg.c(0xA36CFF, MAT_GLOW), WN = wg.c(sd < 0 ? 0xFF2418 : 0x3CFF62, MAT_GLOW);
    const le = (dx) => 46 - (dx - 5) * 0.6, te = (dx) => 60 - (dx - 5) * 0.85;
    wg.each((x, y, z) => {
      const dx = (x - cxv) * sd; if (dx < 4.5 || dx > 30.5) return 0;
      const a = le(dx), b = te(dx); if (z < a || z > b) return 0;
      const th = dx < 15 ? 1 : 0;
      if (y < 9 - th || y > 9) return 0;
      if (y < 9) return WB;
      if (z - a < 1.2) return WE;
      if (z - a < 2.4 && dx > 7 && dx < 28) return WC;
      if (dx > 29.5) return WV;
      if (b - z < 1 && dx > 9) return WG;
      return Math.floor(dx) % 7 === 0 ? WK : WH;
    });
    // anhedral blade at the tip, with the navigation light
    const tx = Math.round(cxv + sd * 30.5);
    for (let z = Math.ceil(le(30)) + 1; z <= Math.floor(te(30)) - 1; z++) for (let y = 6; y <= 8; y++) wg.set(tx, y, z, y === 6 ? WV : WE);
    wg.set(tx, 9, Math.ceil(le(30)), WN);
    return { grid: wg, origin, pivot: [sd * 5.5 * S, -0.5 * S, (52 - 37) * S] };
  };
  // landing gear with grav-lift emitter rings
  const gg = new VoxGrid(W, H, L, S), GS = gg.c(0x8A919C, MAT_METAL), GT = gg.c(0x121314, MAT_MATTE), GL = gg.c(0xA36CFF, MAT_GLOW);
  for (const [gx, gz, top] of [[31, 16, 8], [32, 16, 8], [38, 47, 7], [25, 47, 7]]) {
    for (let y = 0; y <= top; y++) gg.set(gx, y, gz, y <= 1 ? GT : y === 3 ? GL : GS);
    for (const dz of [-1, 1]) { gg.set(gx, 0, gz + dz, GT); gg.set(gx, 1, gz + dz, GT); }
  }
  // cockpit view: the canopy becomes hull; the pilot-scale interior (buildEclipseCockpit) is drawn over it
  const cabin = cockpitGrid(g, { glass: [GOLD], hull: (x, y, z) => inBody(x, y, z) ? HULL : 0 });
  return voxModel(gl, 'fighter', { body: { grid: g, origin, view: 'ext' }, cabin: { grid: cabin, origin, view: 'int' }, wingL: wing(-1), wingR: wing(1), gear: { grid: gg, origin }, bay: { grid: bay, origin } });
}
// ---------------------------------------------------------------- ECLIPSE
class Eclipse extends Jet {
  constructor(x, y, z, yaw) {
    super(x, y, z, yaw, 'fighter');
    // a private copy of the flight data: the wingtip probes move with the sweep
    this.fp = Object.assign({}, FIGHTER_FP, { pts: FIGHTER_FP.pts.map(p => p.slice()) });
    this.missiles = 0; this.sng = SNG.max; this.sReload = 0; this.bayT = 0; this.sweep = 0; this.hov = 0; this.cone = 0;
    this.supersonic = false; this.boomT = -9; this.f2was = false; this.sngMsg = ''; this.sngMsgT = 0; this.desig = null; this.sngEvent = null; this.recoil = 0;
    this.pv5 = { gear: {}, bay: {}, wingL: { y: 0 }, wingR: { y: 0 }, out: {} };
  }
  engineSpec() { const s = super.engineSpec(); s.fusion = 1; s.hov = this.rider ? this.hov : 0; return s; }
  // the crater plan is built once, off the critical moment of a burst
  mount(p) { super.mount(p); setTimeout(() => craterPlan(SNG.crH, SNG.crV), 30); }
  // gravity drive: below flying speed it carries the jet's weight (Jet.step adds the climb / sink control);
  // holding Space at speed still helps it up
  hover(dt, ctl, inp, sp) {
    const FP = this.fp, want = ctl ? Math.max(1 - smoothstep(FP.stall, FP.stall + 24, sp), inp.up ? 0.65 : 0) : 0;
    this.hov += (want - this.hov) * Math.min(1, dt * 3);
    return this.hov;
  }
  // right wingtip in model space at the current sweep (the left one is its mirror image)
  tipPos(out) {
    const a = -this.sweep, c = Math.cos(a), s = Math.sin(a), px = 0.6875, pz = 1.875, rx = 3.8 - px, rz = -0.31 - pz;
    out[0] = px + rx * c + rz * s; out[1] = -0.06; out[2] = pz - rx * s + rz * c;
    return out;
  }
  frame(dt, inp) {
    super.frame(dt, inp);
    if (this.removed) return;
    const sp = this.speed, g = this.game;
    // the wings sweep back as the speed builds, all the way in hyperdrive
    const sw = clamp(smoothstep(75, 150, sp) * 0.62 + (this.boosting ? 0.25 : 0), 0, 0.62);
    this.sweep += (sw - this.sweep) * Math.min(1, dt * 1.6);
    const tip = this.tipPos(_ec1), pts = this.fp.pts;
    pts[1][0] = -tip[0]; pts[1][2] = tip[2]; pts[2][0] = tip[0]; pts[2][2] = tip[2];
    // the sound barrier: a vapour cone just below it and a boom when you punch through
    this.cone = smoothstep(108, 128, sp) * (1 - smoothstep(134, 150, sp));
    if (sp > 130 && !this.supersonic) { this.supersonic = true; if (this.rider) this.sonicBoom(); }
    else if (sp < 118) this.supersonic = false;
    if (this.bayT > 0) this.bayT -= dt;
    if (this.sngMsgT > 0) this.sngMsgT -= dt;
    this.recoil = Math.max(0, this.recoil - dt * 12);
    if (this.sngEvent && (this.sngEvent.done || this.sngEvent.w !== g.world)) this.sngEvent = null;
  }
  sonicBoom() {
    const g = this.game, c = this.center(_ec2);
    g.audio.play('sonic_boom', { x: c[0], y: c[1], z: c[2], range: 300 });
    if (this.rider === g.player) g.shake = Math.max(g.shake || 0, 0.45);
    this.boomT = this.t;
  }
  weapons(dt, inp) {
    const g = this.game, M = g.munitions; if (!M || !inp) return;
    // ---- rail cannons: alternating rails, the slugs converge on whatever the nose points at
    if (inp.fire1 && this.cd1 <= 0 && this.overheat <= 0) {
      this.cd1 = 0.085; this.side = -this.side;
      const f = this.fwd, c = this.center(_ec2), hit = longRaycast(this.world, c[0] + f[0] * 4.8, c[1] + f[1] * 4.8, c[2] + f[2] * 4.8, f[0], f[1], f[2], 500, false);
      const D = (hit ? hit.t : 500) + 4.8, m = this.local(this.side * 0.44, -0.19, -2.9, _ec1);
      let dx = c[0] + f[0] * D - m[0], dy = c[1] + f[1] * D - m[1], dz = c[2] + f[2] * D - m[2];
      const s = 0.0025, dl = Math.hypot(dx, dy, dz) || 1;
      dx = dx / dl + (Math.random() - 0.5) * s; dy = dy / dl + (Math.random() - 0.5) * s; dz = dz / dl + (Math.random() - 0.5) * s;
      const l2 = Math.hypot(dx, dy, dz), vf = Math.max(0, this.vel[0] * f[0] + this.vel[1] * f[1] + this.vel[2] * f[2]);
      railSlug(M, this, m[0], m[1], m[2], dx / l2, dy / l2, dz / l2, 900 + vf);
      this.addHeat(0.045); this.muzzle = 0.05; this.recoil = 1;
      if (this.rider === g.player) g.shake = Math.max(g.shake || 0, 0.07);
    }
    // ---- target lock (the warhead homes on a locked target)
    this.trackLock(dt, M, 450);
    // ---- singularity warheads: one click, one warhead
    if (this.sReload > 0 && this.sng < SNG.max) {
      this.sReload -= dt;
      if (this.sReload <= 0) { this.sng++; this.sReload = this.sng < SNG.max ? SNG.reload : 0; if (this.rider === g.player) g.audio.play('sng_ready', {}); }
    }
    this.designate();
    const press = inp.fire2 && !this.f2was; this.f2was = inp.fire2;
    if (press) this.launchWarhead(M);
  }
  // where a warhead would go: the locked target, otherwise wherever the aim (camera) ray meets the ground
  designate() {
    const g = this.game, cam = g.camera, d = this.aimDir(_ec3);
    const D = this.desig || (this.desig = { x: 0, y: 0, z: 0, ent: null, hit: false, far: false, dist: 0 });
    const L = this.lock;
    D.far = false;
    if (L && this.lockT >= 1 && !L.dead && !L.removed) { D.ent = L; D.x = L.x; D.y = L.y + L.h * 0.5; D.z = L.z; D.hit = true; }
    else {
      D.ent = null;
      const hit = longRaycast(this.world, cam.x, cam.y, cam.z, d[0], d[1], d[2], SNG.range, true);
      if (hit) { D.x = hit.hx; D.y = hit.hy; D.z = hit.hz; D.hit = true; }
      else {
        // nothing in range: an airburst where the aim leaves the loaded world (or at full range); aimed down past
        // the loaded terrain it is out of range (the ground out there is not there yet)
        const e = longRaycast.edge, t = e >= 0 ? e : SNG.range;
        D.x = cam.x + d[0] * t; D.y = cam.y + d[1] * t; D.z = cam.z + d[2] * t; D.hit = false; D.far = e >= 0 && d[1] < 0.05;
      }
    }
    const c = this.center(_ec2); D.dist = Math.hypot(D.x - c[0], D.y - c[1], D.z - c[2]);
  }
  launchWarhead(M) {
    const g = this.game, own = this.rider === g.player, D = this.desig;
    const say = (s) => { this.sngMsg = s; this.sngMsgT = 1.8; if (own) g.audio.play('deny', {}); };
    if (this.sng <= 0) { say('NO WARHEAD'); return; }
    if (D && D.dist < SNG.safe) { say('TOO CLOSE'); return; }
    if (D && D.far) { say('OUT OF RANGE'); return; }
    this.sng--; if (this.sReload <= 0) this.sReload = SNG.reload;
    this.bayT = 1.1; this.sngMsg = 'AWAY'; this.sngMsgT = 2;
    const m = this.local(0, -0.55, 0.3, _ec1);
    singularityWarhead(M, this, m[0], m[1], m[2], this.vel[0], this.vel[1] - 5, this.vel[2], D);
  }
  parts() {
    const P = this.pv5, o = P.out;
    P.wingL.y = this.sweep; P.wingR.y = -this.sweep;
    o.gear = this.gear > 0.5 ? P.gear : null; o.bay = this.bayT > 0 ? null : P.bay; o.wingL = P.wingL; o.wingR = P.wingR;
    return o;
  }
  drawFX(R) {
    this.airFX(R, this.tipPos(_ec3));
    const e = this.engine, f = this.fwd, u = this.upv, r = this.rightv, t = this.t, hy = this.boosting;
    if (e > 0.02 || hy) {
      // the halo drive: a ring of light around the tail, flaring in hyperdrive
      const c = this.local(0, 0, 3.625, _ec1), n = 18, rad = 0.95, sz = 0.26 + e * 0.12 + (hy ? 0.16 : 0), a0 = 0.22 + e * 0.38 + (hy ? 0.45 : 0);
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU + t * 2.2, ca = Math.cos(a) * rad, sa = Math.sin(a) * rad;
        R.fxSprite(c[0] + r[0] * ca + u[0] * sa, c[1] + r[1] * ca + u[1] * sa, c[2] + r[2] * ca + u[2] * sa, sz, 1.0, 0.86, 0.62, a0);
      }
      // blue-violet flame from the nozzle, longer in hyperdrive, with shock diamonds
      const p = this.local(0, 0, 4.75, _ec2), len = 1.0 + e * 1.8 + (hy ? 2.4 : 0), k = 0.9 + Math.random() * 0.2;
      R.fxBeam(p[0], p[1], p[2], p[0] - f[0] * len * k, p[1] - f[1] * len * k, p[2] - f[2] * len * k, 0.17 + e * 0.05, 0.42, 0.55, 1.0, 0.22 + e * 0.25 + (hy ? 0.15 : 0));
      R.fxSprite(p[0], p[1], p[2], 0.4, 0.6, 0.75, 1.0, 0.4 + e * 0.4);
      if (hy) for (let i = 1; i <= 4; i++) { const q = i * 1.1; R.fxSprite(p[0] - f[0] * q, p[1] - f[1] * q, p[2] - f[2] * q, 0.26 - i * 0.03, 0.7, 0.8, 1.0, 0.4); }
    }
    // vapour cone at the sound barrier, and the shock ring when it breaks
    if (this.cone > 0.02) {
      const c = this.local(0, 0.05, 0.4, _ec1);
      for (let i = 0; i < 22; i++) { const a = i / 22 * TAU, rr = 1.45 * (1 + 0.07 * Math.sin(t * 37 + i * 1.7)), ca = Math.cos(a) * rr, sa = Math.sin(a) * rr; R.fxSprite(c[0] + r[0] * ca + u[0] * sa, c[1] + r[1] * ca + u[1] * sa, c[2] + r[2] * ca + u[2] * sa, 0.6, 0.9, 0.93, 0.98, 0.16 * this.cone); }
    }
    const ba = t - this.boomT;
    if (ba < 0.5) {
      const c = this.local(0, 0, 0.5, _ec1), rr = 1.5 + ba * 46, al = (1 - ba / 0.5) * 0.7;
      for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, ca = Math.cos(a) * rr, sa = Math.sin(a) * rr; R.fxSprite(c[0] + r[0] * ca + u[0] * sa, c[1] + r[1] * ca + u[1] * sa, c[2] + r[2] * ca + u[2] * sa, 0.9 + ba * 3, 0.85, 0.9, 1.0, al); }
    }
    // grav-lift: a violet shimmer under the hull while the gravity drive carries it
    if (this.hov > 0.05 && (this.rider || !this.onGround)) {
      const b = this.local(0, -1.0, 0.3, _ec1);
      for (let i = 0; i < 3; i++) { const q = i * 0.45 + (t * 1.7 % 0.45); R.fxSprite(b[0] - u[0] * q, b[1] - u[1] * q, b[2] - u[2] * q, 1.3 - i * 0.25, 0.62, 0.45, 1.0, 0.2 * this.hov * (1 - i * 0.25)); }
    }
    // the rails: a charge glow along them while firing, an electric flash at the muzzle
    if (this.recoil > 0.05) for (const sd of [-1, 1]) { const m = this.local(sd * 0.44, -0.19, -2.0, _ec1), q = this.local(sd * 0.44, -0.19, -0.6, _ec2); R.fxBeam(m[0], m[1], m[2], q[0], q[1], q[2], 0.05, 0.4, 0.9, 1.0, 0.8 * this.recoil); }
    if (this.muzzle > 0) { const m = this.local(this.side * 0.44, -0.19, -3.05, _ec1); R.fxSprite(m[0], m[1], m[2], 0.6, 0.55, 0.9, 1.0, 1.8); R.fxSprite(m[0], m[1], m[2], 0.25, 1, 1, 1, 1.6); this.muzzle -= 0.02; }
    // strobes on the wingtips
    if ((t % 1.1) < 0.07) { const tp = this.tipPos(_ec3); for (const sd of [-1, 1]) { const p = this.local(tp[0] * sd, tp[1] - 0.25, tp[2] + 0.2, _ec1); R.fxSprite(p[0], p[1], p[2], 0.5, 1, 1, 1, 1.4); } }
  }
  lights(R) {
    if (this.engine > 0.05) { const p = this.local(0, 0, 3.9, _ec1); R.addLight(p[0], p[1], p[2], 8 + this.engine * 5 + (this.boosting ? 6 : 0), 0.85, 0.85, 1.0, 0.9 + this.engine); }
    if (this.muzzle > 0) { const p = this.local(this.side * 0.44, -0.19, -3.0, _ec1); R.addLight(p[0], p[1], p[2], 9, 0.5, 0.85, 1.0, 2.4); }
    if (this.hov > 0.2 && this.rider) { const p = this.local(0, -1.4, 0.3, _ec1); R.addLight(p[0], p[1], p[2], 6, 0.65, 0.45, 1.0, 0.8 * this.hov); }
  }
}
// ---------------------------------------------------------------- rail cannon
// Slugs fly at about 1000 blocks/s: each frame sweeps a ray, punches through up to three mobs, and a block hit
// blasts out a small crater. The ionised wake lingers for a moment as a fading streak.
const RAIL_SLUG = {
  step(M, m, dt) {
    if (m.age > m.life) return false;
    const w = M.world, step = m.speed * dt;
    const hit = raycastSolid(w, m.x, m.y, m.z, m.dx, m.dy, m.dz, step);
    let et = hit ? hit.t : step, stop = false;
    const hs = [];
    for (const e of w.entitiesNear(m.x + m.dx * et * 0.5, m.y + m.dy * et * 0.5, m.z + m.dz * et * 0.5, et * 0.5 + 4)) {
      if (!M.hittable(e, m.owner) || m.hitE.includes(e)) continue;
      const h = entityRayHit(e, m.x, m.y, m.z, m.dx, m.dy, m.dz, 0.25);
      if (h && h.t <= et) hs.push([h.t, e, h.part]);
    }
    if (hs.length > 1) hs.sort((a, b) => a[0] - b[0]);
    for (const [t, e, part] of hs) {
      const px = m.x + m.dx * t, py = m.y + m.dy * t, pz = m.z + m.dz * t;
      e.invul = 0; e.lastHitPart = part; e.hurt(m.dmg, { type: 'rail', source: m.owner.rider || m.owner, kb: 0.8 }); e.lastHitPart = -1;
      if (e.isVehicle) { e.vel[0] += m.dx * 5; e.vel[1] += m.dy * 5 + 1; e.vel[2] += m.dz * 5; }
      else if (!e.isBoss && !e.isCrystal) { e.vx += m.dx * 0.45; e.vy += 0.22; e.vz += m.dz * 0.45; }
      railSparks(M, px, py, pz, 7, 0.4);
      m.hitE.push(e); m.dmg *= 0.75;
      if (--m.pierce <= 0) { et = t; stop = true; break; }
    }
    m.x += m.dx * et; m.y += m.dy * et; m.z += m.dz * et;
    const T = m.trail; T.bx = m.x; T.by = m.y; T.bz = m.z;
    if (stop) return false;
    if (hit) { railImpact(M, m, hit); return false; }
    return m.y > -64 && m.y < 400;
  },
  draw(R, m) {
    const l = Math.min(m.age * m.speed, 24);
    R.fxBeam(m.x - m.dx * l, m.y - m.dy * l, m.z - m.dz * l, m.x, m.y, m.z, 0.1, 0.45, 0.85, 1.0, 2.2);
    R.fxBeam(m.x - m.dx * l * 0.5, m.y - m.dy * l * 0.5, m.z - m.dz * l * 0.5, m.x, m.y, m.z, 0.035, 1, 1, 1, 3);
    R.fxSprite(m.x, m.y, m.z, 0.32, 0.7, 0.95, 1.0, 1.3);
  },
};
function railSlug(M, owner, x, y, z, dx, dy, dz, speed) {
  const trail = { ax: x, ay: y, az: z, bx: x, by: y, bz: z, age: 0, life: 0.3, w: 0.04, c: [0.5, 0.82, 1.0], a: 0.6 };
  M.streaks.push(trail);
  M.add({ cls: RAIL_SLUG, owner, x, y, z, dx, dy, dz, speed, age: 0, life: 0.9, dmg: 13, pierce: 3, hitE: [], trail });
  M.game.audio.play('railgun', { x, y, z, range: 90, vol: 0.6 });
}
function railSparks(M, x, y, z, n, k) {
  const P = M.game.particles;
  for (let i = 0; i < n; i++) P.spawn('p_spark', x, y, z, { vx: (Math.random() - 0.5) * k, vy: Math.random() * k * 0.8, vz: (Math.random() - 0.5) * k, grav: 0.035, life: 8 + Math.random() * 10, size: 0.07 + Math.random() * 0.05, color: [0.6, 0.92, 1.0], emissive: true, collide: true });
}
// a slug hits the ground: a small crater (soft blocks give way more easily), debris, a flash and a thump
function railImpact(M, m, hit) {
  const g = M.game, w = M.world, P = g.particles;
  const x = m.x - m.dx * 0.05, y = m.y - m.dy * 0.05, z = m.z - m.dz * 0.05;
  const cx = x + m.dx * 0.6, cy = y + m.dy * 0.6, cz = z + m.dz * 0.6, r = 1.6;
  let n = 0;
  for (let bx = Math.floor(cx - r); bx <= Math.floor(cx + r); bx++) for (let by = Math.floor(cy - r); by <= Math.floor(cy + r); by++) for (let bz = Math.floor(cz - r); bz <= Math.floor(cz + r); bz++) {
    const d = Math.hypot(bx + 0.5 - cx, by + 0.5 - cy, bz + 0.5 - cz); if (d > r) continue;
    const v = w.getBlock(bx, by, bz), id = v & 4095; if (!id || FLUID[id]) continue;
    const b = BLOCKS[id]; if (!b || b.hard < 0 || b.hard >= 40) continue;
    if (Math.random() > 1.2 - d / r * 0.6 - b.hard * 0.05) continue;
    const be = w.getBE(bx, by, bz); if (be) g.onBERemoved(be, bx, by, bz);
    w.setBlock(bx, by, bz, 0, 1 | 8);
    if (n++ < 4) {
      const tx = P.blockTex(v, 2), col = P.tintOf(v, bx, bz);
      for (let i = 0; i < 3; i++) P.spawn({ layer: tx.layer, uv: tx.uv }, bx + 0.5, by + 0.5, bz + 0.5, { vx: -m.dx * 0.25 + (Math.random() - 0.5) * 0.35, vy: 0.2 + Math.random() * 0.3, vz: -m.dz * 0.25 + (Math.random() - 0.5) * 0.35, grav: 0.05, life: 22 + Math.random() * 14, size: 0.14 + Math.random() * 0.1, color: col, fade: false, collide: true });
    }
  }
  railSparks(M, x, y, z, 8, 0.55);
  for (let i = 0; i < 3; i++) P.spawn('p_smoke', x + (Math.random() - 0.5), y + Math.random() * 0.5, z + (Math.random() - 0.5), { vx: (Math.random() - 0.5) * 0.06, vy: 0.04 + Math.random() * 0.03, vz: (Math.random() - 0.5) * 0.06, life: 30 + Math.random() * 20, size: 0.7 + Math.random() * 0.5, color: [0.55, 0.53, 0.5], alpha: 0.6 });
  M.flashes.push({ x, y, z, size: 1.7, life: 0.12, age: 0, c: [0.6, 0.9, 1.0], i: 3 });
  g.audio.play('rail_hit', { x, y, z, range: 70, vol: 0.55 });
  for (const e of w.entitiesNear(x, y, z, 2.6)) if (M.hittable(e, m.owner) && !e.isBoss) e.hurt(4, { type: 'explosion', source: m.owner.rider || m.owner });
}
// ---------------------------------------------------------------- singularity warhead
// Dropped from the bay, it falls clear of the jet, lights its motor and flies to the designated point (or the
// locked target); wherever it strikes, a singularity forms.
const SNG_WARHEAD = {
  step(M, m, dt) {
    const w = M.world;
    if (m.age > m.life) { singularityAt(M, m, m.x, m.y, m.z); return false; }
    const drop = m.age < 0.3;
    if (drop) { m.vy -= 20 * dt; m.speed = Math.hypot(m.vx, m.vy, m.vz) || 1; m.dx = m.vx / m.speed; m.dy = m.vy / m.speed; m.dz = m.vz / m.speed; }
    else {
      const T = m.tgt;
      if (T && !T.dead && !T.removed) { m.tp = m.tp || [0, 0, 0]; m.tp[0] = T.x; m.tp[1] = T.y + T.h * 0.5; m.tp[2] = T.z; }
      if (!m.lit) {
        // the motor lights with the warhead already turned toward its target, so it never noses into the ground
        m.lit = true; M.game.audio.play('sng_motor', { x: m.x, y: m.y, z: m.z, range: 160 });
        if (m.tp) { let ax = m.tp[0] - m.x, ay = m.tp[1] - m.y, az = m.tp[2] - m.z; const al = Math.hypot(ax, ay, az) || 1; ax = ax / al * 0.85 + m.dx * 0.15; ay = ay / al * 0.85 + m.dy * 0.15; az = az / al * 0.85 + m.dz * 0.15; const l = Math.hypot(ax, ay, az) || 1; m.dx = ax / l; m.dy = ay / l; m.dz = az / l; }
      }
      m.speed = Math.min(m.speed + 170 * dt, 230);
      if (m.tp) {
        let ax = m.tp[0] - m.x, ay = m.tp[1] - m.y, az = m.tp[2] - m.z; const al = Math.hypot(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
        const ang = Math.acos(clamp(ax * m.dx + ay * m.dy + az * m.dz, -1, 1)), maxA = 3.0 * dt * Math.min(1, (m.age - 0.3) * 2.5 + 0.25);
        if (ang > 1e-4) { const k = Math.min(1, maxA / ang); m.dx += (ax - m.dx) * k; m.dy += (ay - m.dy) * k; m.dz += (az - m.dz) * k; const l = Math.hypot(m.dx, m.dy, m.dz); m.dx /= l; m.dy /= l; m.dz /= l; }
        if (al < m.speed * dt + 1.5) { singularityAt(M, m, m.tp[0], m.tp[1], m.tp[2]); return false; }
      }
    }
    const step = m.speed * dt;
    const hit = raycastSolid(w, m.x, m.y, m.z, m.dx, m.dy, m.dz, step);
    let et = hit ? hit.t : step, ent = null;
    if (!drop) for (const e of w.entitiesNear(m.x + m.dx * step * 0.5, m.y + m.dy * step * 0.5, m.z + m.dz * step * 0.5, step * 0.5 + 5)) {
      if (!M.hittable(e, m.owner) || e.type === 'item' || e.type === 'xp') continue;
      const h = entityRayHit(e, m.x, m.y, m.z, m.dx, m.dy, m.dz, 0.6);
      if (h && h.t <= et) { et = h.t; ent = e; }
    }
    if (hit || ent) {
      // still falling clear of the bay: the motor lights early instead of striking the ground under the jet
      if (drop && !ent) { m.age = 0.3; return true; }
      singularityAt(M, m, m.x + m.dx * (et - 0.4), m.y + m.dy * (et - 0.4), m.z + m.dz * (et - 0.4));
      return false;
    }
    m.x += m.dx * step; m.y += m.dy * step; m.z += m.dz * step;
    if (drop) { m.vx = m.dx * m.speed; m.vz = m.dz * m.speed; }
    if (m.lit && (m.trailT -= dt) <= 0) {
      m.trailT = 0.02;
      const P = M.game.particles;
      P.spawn('p_smoke', m.x - m.dx * 0.8, m.y - m.dy * 0.8, m.z - m.dz * 0.8, { vx: (Math.random() - 0.5) * 0.02, vy: 0.01, vz: (Math.random() - 0.5) * 0.02, life: 40 + Math.random() * 25, size: 0.55 + Math.random() * 0.35, color: [0.74, 0.7, 0.82], alpha: 0.65 });
      if (Math.random() < 0.4) P.spawn('p_spark', m.x - m.dx, m.y - m.dy, m.z - m.dz, { vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12, vz: (Math.random() - 0.5) * 0.12, life: 10, size: 0.08, color: [0.75, 0.55, 1.0], emissive: true });
    }
    return m.y > -64 && m.y < 400;
  },
  draw(R, m) {
    const pulse = 0.75 + 0.25 * Math.sin(m.age * 30);
    // a dark core inside a violet containment glow
    R.fxSprite(m.x, m.y, m.z, 0.6 * pulse, 0.62, 0.38, 1.0, 1.5);
    R.fxSprite(m.x, m.y, m.z, 0.2, 1, 1, 1, 1.2);
    if (m.lit) {
      const bx = m.x - m.dx * 0.5, by = m.y - m.dy * 0.5, bz = m.z - m.dz * 0.5, fl = 1.2 + Math.random() * 0.6;
      R.fxBeam(bx, by, bz, bx - m.dx * fl * 2.2, by - m.dy * fl * 2.2, bz - m.dz * fl * 2.2, 0.22, 0.75, 0.62, 1.0, 1.6);
      R.fxSprite(bx, by, bz, 0.5, 0.9, 0.8, 1.0, 1.2);
    }
  },
  light(R, m) { R.addLight(m.x, m.y, m.z, 10, 0.7, 0.45, 1.0, 1.8); },
};
function singularityWarhead(M, owner, x, y, z, vx, vy, vz, D) {
  const sp = Math.hypot(vx, vy, vz) || 1;
  const m = M.add({ cls: SNG_WARHEAD, owner, x, y, z, vx, vy, vz, dx: vx / sp, dy: vy / sp, dz: vz / sp, speed: sp, age: 0, life: 14, trailT: 0, lit: false,
    tgt: D && D.ent || null, tp: D ? [D.x, D.y, D.z] : null });
  M.game.audio.play('sng_launch', { x, y, z, range: 120 });
  return m;
}
// too close to the jet that launched it (it struck something on the way out), the warhead fails safe: a dud
function singularityAt(M, m, x, y, z) {
  const o = m.owner;
  if (o && !o.removed && o.center) {
    const c = o.center(_ec2);
    if (Math.hypot(c[0] - x, c[1] - y, c[2] - z) < SNG.safe * 0.6) { explode(M.world, x, y, z, 2.5, false, o); if (o.sngMsg !== undefined) { o.sngMsg = 'DUD: TOO CLOSE'; o.sngMsgT = 2.5; } return; }
  }
  M.events.push(new Singularity(M, x, y, z, o));
}
// what the burst does to a block left in the crater wall: 1 glass, 2 scorched soil, 3 scorched rock,
// 4 burnt away, 5 melted (ice to water, snow gone), 0 unchanged
let ECL_CAT = null;
function eclCat(id) {
  if (!ECL_CAT) {
    ECL_CAT = new Uint8Array(BLOCKS.length);
    for (const b of BLOCKS) {
      if (!b) continue;
      const n = b.name;
      ECL_CAT[b.id] = (n === 'sand' || n === 'red_sand' || n.endsWith('concrete_powder')) ? 1
        : /^(grass_block|dirt|coarse_dirt|podzol|mycelium|farmland|dirt_path|rooted_dirt|mud|moss_block|clay)$/.test(n) ? 2
          : /^(stone|cobblestone|mossy_cobblestone|andesite|diorite|granite|tuff|calcite|deepslate|cobbled_deepslate|sandstone|red_sandstone|gravel|smooth_basalt|dripstone_block|netherrack|end_stone|terracotta)$/.test(n) || n.endsWith('_terracotta') ? 3
            : (LEAVES[b.id] || PLANT[b.id] || /(_log|_wood|_stem|_hyphae|planks|wool|carpet|bookshelf|hay_block|_leaves)$/.test(n)) ? 4
              : /^(ice|packed_ice|blue_ice|snow_layer|snow_block|powder_snow)$/.test(n) ? 5 : 0;
    }
  }
  return ECL_CAT[id] || 0;
}
// crater cells (an ellipsoid plus the wall shell beyond it) sorted from the centre out, so the blast can carve
// a little more every frame: { n, E (normalised squared radius), X, Y, Z }
const CRATER_PLANS = {};
function craterPlan(rh, rv) {
  const k = rh + ':' + rv; if (CRATER_PLANS[k]) return CRATER_PLANS[k];
  // counting sort into 1024 thin shells: linear time, and the carve front only needs shell order
  const Hh = Math.ceil(rh * 1.16) + 1, Vv = Math.ceil(rv * 1.16) + 1, NB = 1024, cnt = new Uint32Array(NB + 1);
  const shell = (dx, dy, dz) => { const e = (dx * dx + dz * dz) / (rh * rh) + dy * dy / (rv * rv); return e < 1.36 ? Math.min(NB - 1, Math.floor(e / 1.36 * NB)) : -1; };
  let n = 0;
  for (let dy = -Vv; dy <= Vv; dy++) for (let dz = -Hh; dz <= Hh; dz++) for (let dx = -Hh; dx <= Hh; dx++) { const b = shell(dx, dy, dz); if (b >= 0) { cnt[b + 1]++; n++; } }
  for (let b = 0; b < NB; b++) cnt[b + 1] += cnt[b];
  const P = { n, E: new Float32Array(n), X: new Int8Array(n), Y: new Int8Array(n), Z: new Int8Array(n) };
  for (let dy = -Vv; dy <= Vv; dy++) for (let dz = -Hh; dz <= Hh; dz++) for (let dx = -Hh; dx <= Hh; dx++) {
    const b = shell(dx, dy, dz); if (b < 0) continue;
    const i = cnt[b]++; P.E[i] = (dx * dx + dz * dz) / (rh * rh) + dy * dy / (rv * rv); P.X[i] = dx; P.Y[i] = dy; P.Z[i] = dz;
  }
  return (CRATER_PLANS[k] = P);
}
// unit sphere for the event horizon (vox format: drawn pure black by the emissive path of the vox shader)
function sngSphere(gl) {
  if (sngSphere.m) return sngSphere.m;
  const out = [], NU = 32, NV = 20;
  const P = (i, j) => { const th = i / NU * TAU, ph = j / NV * Math.PI; return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]; };
  const V = (p) => out.push(p[0], p[1], p[2], p[0], p[1], p[2], 0, 0, 0, MAT_GLOW);
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1); V(a); V(b); V(c); V(a); V(c); V(d); }
  return (sngSphere.m = uploadVox(gl, new Float32Array(out)));
}
// ---------------------------------------------------------------- the singularity
// After the warhead lands: the hole forms, pulls for a few seconds while it eats the ground around it, collapses,
// then evaporates in one burst: a glassed crater, a shock front, a fireball and a mushroom cloud that lingers
class Singularity {
  constructor(M, x, y, z, owner) {
    this.M = M; this.g = M.game; this.w = M.world; this.x = x; this.y = y; this.z = z;
    this.owner = owner || null; this.src = owner ? owner.rider || owner : null;
    this.t = 0; this.r = 0; this.burst = false; this.bt = 0; this.ripAcc = 0; this.bite = 0; this.rs = 0; this.done = false;
    this.debris = []; this.puffs = null; this.plan = null; this.pi = 0; this.boomed = false; this.collapsing = false;
    // the accretion disk's plane, tilted at random
    const tilt = 0.25 + Math.random() * 0.4, az = Math.random() * TAU, n = this.n = [Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)];
    const l1 = Math.hypot(n[1], n[0]) || 1, e1 = this.e1 = [n[1] / l1, -n[0] / l1, 0];
    this.e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
    this.rim = [Math.random() * TAU, Math.random() * TAU, Math.random() * TAU];
    if (owner) owner.sngEvent = this;
    this.g.audio.play('sng_form', { x, y, z, range: 480 });
    M.flashes.push({ x, y, z, size: 6, life: 0.35, age: 0, c: [0.75, 0.55, 1.0], i: 4 });
  }
  update(dt) {
    const g = this.g;
    if (g.world !== this.w) { this.done = true; g.audio.loop('singularity', this, 0); return false; }
    this.t += dt;
    const t = this.t;
    if (!this.burst) {
      if (t < SNG.form) this.r = SNG.r0 * smoothstep(0, SNG.form, t);
      else if (t < SNG.collapse) this.r = SNG.r0 + (SNG.r1 - SNG.r0) * (t - SNG.form) / (SNG.collapse - SNG.form);
      else this.r = SNG.r1 * (1 - smoothstep(SNG.collapse, SNG.burst, t));
      this.pull(dt);
      if (t > SNG.form * 0.6 && t < SNG.collapse) this.ripBlocks(dt);
      if (t >= SNG.collapse && !this.collapsing) { this.collapsing = true; g.audio.play('sng_collapse', { x: this.x, y: this.y, z: this.z, range: 480 }); }
      const vol = t < SNG.collapse ? 0.25 + 0.6 * smoothstep(0, SNG.collapse, t) : 0.85 * (1 - smoothstep(SNG.collapse, SNG.burst, t));
      g.audio.loop('singularity', this, vol, this.x, this.y, this.z, 420);
      if (t >= SNG.burst) this.detonate();
    } else {
      this.bt += dt;
      this.carve();
      this.shock();
      this.cloud();
      if (this.bt > SNG.life) { this.done = true; return false; }
    }
    this.updDebris(dt);
    return true;
  }
  // gravity: everything nearby is dragged in and swirled around the disk; at the horizon it is torn apart
  pull(dt) {
    const g = this.g, w = this.w, cx = this.x, cy = this.y, cz = this.z, R = SNG.pull, n = this.n;
    const k = Math.min(1, this.t / SNG.form), horizon = this.r + 1.6;
    this.bite += dt; const bite = this.bite >= 0.25; if (bite) this.bite = 0;
    for (const e of w.entitiesNear(cx, cy, cz, R)) {
      if (e.removed || e.isCrystal || e.spectator || (e.isPlayer && e.vehicle)) continue;
      const dx = cx - e.x, dy = cy - (e.y + (e.h || 0) * 0.5), dz = cz - e.z, d = Math.hypot(dx, dy, dz) || 1;
      const a = k * (160 / (1 + (d / 7) ** 2) + 14 * (1 - d / R)), ux = dx / d, uy = dy / d, uz = dz / d;
      // close in, things on the ground are lifted off it (beating gravity) and fly in
      const lift = dy > -2 ? (d < 22 ? Math.min(46, a * 0.9) : a * 0.25) : 0;
      const sx = n[1] * uz - n[2] * uy, sy = n[2] * ux - n[0] * uz, sz = n[0] * uy - n[1] * ux;
      // the dragon steers itself: it is dragged a little (it can still fly clear unless it comes close)
      if (e.isBoss) { if (e.phase !== 'dying') { const q = Math.min(7, a * 0.25) * dt; e.x += ux * q; e.y += uy * q; e.z += uz * q; } }
      else if (e.isVehicle) { const q = (e.rider === g.player ? 0.45 : 0.8) * a * dt; e.vel[0] += (ux + sx * 0.3) * q; e.vel[1] += (uy + sy * 0.3) * q; e.vel[2] += (uz + sz * 0.3) * q; }
      else if (e.vx !== undefined) { const q = dt / 20; e.vx += (ux + sx * 0.35) * a * q; e.vy += ((uy + sy * 0.35) * a + lift) * q; e.vz += (uz + sz * 0.35) * a * q; }
      if (d < horizon) {
        if (e.type === 'item' || e.type === 'xp' || e.isProjectile || e.type === 'falling' || e.type === 'arrow' || e.type === 'tnt') { e.removed = true; continue; }
        if (bite && e.hurt) { e.invul = 0; e.hurt(e.isBoss ? 6 : e.isVehicle ? 40 : 24, { type: 'singularity', source: e === this.owner ? null : this.src }); }
        if (e.dead && !e.isPlayer && !e.isVehicle && !e.isBoss) e.removed = true;
      }
    }
  }
  // the hole tears blocks out of the ground around it, a little further out every second
  ripBlocks(dt) {
    const w = this.w, P = this.g.particles, rr = 3.5 + (this.t - SNG.form) * 2.0;
    this.ripAcc += dt * SNG.rip;
    let tries = 0;
    while (this.ripAcc >= 1 && tries++ < 40) {
      let dx = Math.random() * 2 - 1, dy = Math.random() < 0.18 ? Math.random() : -0.1 - Math.random() * 0.9, dz = Math.random() * 2 - 1;
      const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      const hit = raycast(w, this.x, this.y, this.z, dx, dy, dz, rr, false);
      if (!hit) continue;
      this.ripAcc -= 1;
      const id = hit.id, b = BLOCKS[id];
      if (!b || b.hard < 0 || FLUID[id]) continue;
      const be = w.getBE(hit.x, hit.y, hit.z); if (be) this.g.onBERemoved(be, hit.x, hit.y, hit.z);
      w.setBlock(hit.x, hit.y, hit.z, 0, 4 | 8);
      const up = w.getId(hit.x, hit.y + 1, hit.z); if (up && !SOLID[up] && !FLUID[up]) w.setBlock(hit.x, hit.y + 1, hit.z, 0, 4 | 8);
      if (this.debris.length < 360) {
        const tx = P.blockTex(hit.v, 2);
        this.debris.push({ x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5, vx: 0, vy: 0, vz: 0, size: 0.45 + Math.random() * 0.4, uv: tx.uv, color: P.tintOf(hit.v, hit.x, hit.z), alpha: 1, layer: tx.layer, src: 0, age: 0, life: 1e9, fade: false,
          sx: (Math.random() - 0.5) * 2, sy: 2 + Math.random() * 3, sz: (Math.random() - 0.5) * 2, t: 0, out: 0 });
      }
    }
    if (this.ripAcc > 3) this.ripAcc = 3;
  }
  updDebris(dt) {
    const D = this.debris; if (!D.length) return;
    const cx = this.x, cy = this.y, cz = this.z, n = this.n, rr = Math.max(0.5, this.r);
    let j = 0;
    for (const d of D) {
      d.t += dt;
      if (d.out) { d.sy -= 22 * dt; d.x += d.sx * dt; d.y += d.sy * dt; d.z += d.sz * dt; if (d.t < d.out) D[j++] = d; continue; }
      const dx = cx - d.x, dy = cy - d.y, dz = cz - d.z, dist = Math.hypot(dx, dy, dz) || 1;
      if (dist < rr * 1.45) continue;
      const a = 26 + 260 / (1 + dist * 0.4), ux = dx / dist, uy = dy / dist, uz = dz / dist;
      const tx = n[1] * uz - n[2] * uy, ty = n[2] * ux - n[0] * uz, tz = n[0] * uy - n[1] * ux;
      d.sx += (ux + tx * 0.8) * a * dt; d.sy += (uy + ty * 0.8) * a * dt; d.sz += (uz + tz * 0.8) * a * dt;
      const k = Math.exp(-dt * 1.6); d.sx *= k; d.sy *= k; d.sz *= k;
      d.x += d.sx * dt; d.y += d.sy * dt; d.z += d.sz * dt;
      if (dist < rr * 2.6) d.size *= Math.exp(-dt * 4);
      D[j++] = d;
    }
    D.length = j;
  }
  // ---------------------------------------------------------------- the burst
  detonate() {
    const g = this.g, w = this.w, P = g.particles, cx = this.x, cy = this.y, cz = this.z;
    this.burst = true; this.bt = 0; this.r = 0;
    g.audio.loop('singularity', this, 0);
    // the flash: as bright as it is close, dimmer when the ground hides it
    const cam = g.camera, dc = Math.hypot(cam.x - cx, cam.y - cy, cam.z - cz);
    const seen = !rayBlocked(w, cam.x, cam.y, cam.z, cx, cy + 2, cz);
    screenFlash((seen ? 0.96 : 0.45) * (1 - smoothstep(90, 950, dc)), 2.2);
    g.lightning = 1;
    g.audio.play('sng_burst', { vol: 0.25 + 0.75 * (1 - smoothstep(60, 900, dc)) });
    // close in nothing survives; further out it is blast and heat
    for (const e of w.entitiesNear(cx, cy, cz, SNG.blast)) {
      if (e.removed || (e.isPlayer && e.vehicle)) continue;
      const dx = e.x - cx, dy = e.y + (e.h || 0) * 0.5 - cy, dz = e.z - cz, d = Math.hypot(dx, dy, dz) || 1;
      if (e.type === 'item' || e.type === 'xp') { if (d < SNG.kill) e.removed = true; continue; }
      const k = d < SNG.kill ? 1 : Math.pow(Math.max(0, 1 - (d - SNG.kill) / (SNG.blast - SNG.kill)), 1.6);
      if (k <= 0) continue;
      // a boss takes the full force (as if hit in the head) but survives one: half the dragon's health at most
      if (e.hurt) { e.invul = 0; if (e.isBoss) e.lastHitPart = 0; e.hurt(e.isBoss ? Math.min(100, Math.round(320 * k + 4)) : Math.round(320 * k + 4), { type: 'explosion', source: this.src }); e.lastHitPart = -1; }
      if (e.isVehicle) { e.vel[0] += dx / d * 45 * k; e.vel[1] += 18 * k; e.vel[2] += dz / d * 45 * k; }
      else if (e.vx !== undefined && !e.isBoss && !e.isCrystal) { e.vx += dx / d * 1.6 * k; e.vy += 0.9 * k + 0.2; e.vz += dz / d * 1.6 * k; }
      if (!e.fireImmune && !e.isVehicle) e.fireTicks = Math.max(e.fireTicks || 0, 160);
    }
    // anything still spiralling in is flung back out
    for (const d of this.debris) {
      const dx = d.x - cx, dy = d.y - cy, dz = d.z - cz, l = Math.hypot(dx, dy, dz) || 1, v = 25 + Math.random() * 35;
      d.sx = dx / l * v; d.sy = Math.abs(dy / l) * v * 0.5 + 12 + Math.random() * 14; d.sz = dz / l * v; d.out = 1.5 + Math.random() * 2; d.t = 0; d.size = Math.max(d.size, 0.35);
    }
    // glowing embers thrown out of the fireball
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU, s = 0.8 + Math.random() * 1.6;
      P.spawn('p_spark', cx, cy + 1, cz, { vx: Math.cos(a) * s, vy: 0.4 + Math.random() * 1.4, vz: Math.sin(a) * s, grav: 0.05, drag: 0.985, life: 40 + Math.random() * 50, size: 0.4 + Math.random() * 0.5, color: [1, 0.55 + Math.random() * 0.3, 0.25], emissive: true, collide: true });
    }
    this.plan = craterPlan(SNG.crH, SNG.crV); this.pi = 0;
    this.gy = w.dim === 'nether' ? cy : Math.min(cy, w.heightAt(Math.floor(cx), Math.floor(cz)));
    this.initCloud();
  }
  // a ragged rim: the crater's edge wobbles around the circle (normalised units)
  rimAt(dx, dz) { const a = Math.atan2(dz, dx), R = this.rim; return 0.1 * Math.sin(3 * a + R[0]) + 0.07 * Math.sin(5 * a + R[1]) + 0.05 * Math.sin(9 * a + R[2]); }
  vitrify(id) {
    const c = eclCat(id), r = Math.random();
    if (c === 1) return B.glass;
    if (c === 2) return r < 0.5 ? B.coarse_dirt : r < 0.85 ? B.blackstone : B.magma_block;
    if (c === 3) return this.w.dim === 'end' ? (r < 0.6 ? B.obsidian : r < 0.72 ? B.crying_obsidian : id) : r < 0.4 ? B.basalt : r < 0.78 ? B.blackstone : r < 0.92 ? B.magma_block : B.obsidian;
    if (c === 4) return 0;
    if (c === 5) return id === B.ice || id === B.packed_ice || id === B.blue_ice ? B.water : 0;
    return id;
  }
  // the crater opens from the centre out over half a second: vaporised inside, glassed and scorched in the wall
  carve() {
    const PL = this.plan; if (!PL) return;
    if (this.pi >= PL.n) { if (this.scZ === undefined) this.scZ = -Math.ceil(SNG.crH * 2); if (this.scZ <= SNG.crH * 2) { this.scorch(this.scZ, this.scZ + 9); this.scZ += 10; } return; }
    const w = this.w, lim = 1.36 * Math.min(1, this.bt / 0.5);
    const cx = Math.floor(this.x), cy = Math.floor(this.y), cz = Math.floor(this.z);
    let budget = 12000;
    while (this.pi < PL.n && PL.E[this.pi] <= lim && budget-- > 0) {
      const i = this.pi++, x = cx + PL.X[i], y = cy + PL.Y[i], z = cz + PL.Z[i];
      if (y < 1 || y >= CH) continue;
      const v = w.getBlock(x, y, z), id = v & 4095; if (!id) continue;
      const b = BLOCKS[id]; if (!b || b.hard < 0) continue;
      const e = PL.E[i] / (1 + this.rimAt(PL.X[i], PL.Z[i]));
      if (e < 1) w.setBlock(x, y, z, 0, e > 0.86 ? 1 | 4 | 8 : 4 | 8);
      else if (e < 1.24 && !FLUID[id]) { const nv = this.vitrify(id); if (nv !== id) w.setBlock(x, y, z, nv, 4 | 8); }
    }
  }
  // the blast zone around the crater: leaves blown off, trees snapped, grass burnt, small fires
  scorch(z0, z1) {
    const w = this.w; if (w.dim === 'nether') return;
    const cx = Math.floor(this.x), cz = Math.floor(this.z), cy = this.y, R0 = SNG.crH * 0.85, R1 = SNG.crH * 2.0;
    let fires = this.fires || 0;
    for (let dz = Math.max(z0, -R1); dz <= Math.min(z1, R1); dz++) for (let dx = -R1; dx <= R1; dx++) {
      const d = Math.hypot(dx, dz); if (d < R0 || d > R1) continue;
      const x = cx + dx, z = cz + dz; if (!w.isLoaded(x, z)) continue;
      const top = w.heightAt(x, z); if (top < cy - 28 || top > cy + 30) continue;
      const k = 1 - (d - R0) / (R1 - R0);
      for (let y = top - 1; y > top - 18 && y > 0; y--) {
        const id = w.getId(x, y, z); if (!id) continue;
        const c = eclCat(id);
        if (LEAVES[id]) { if (Math.random() < k * 1.4) w.setBlock(x, y, z, 0, 4 | 8); continue; }
        if (c === 4 && !PLANT[id]) { if (Math.random() < k * 0.7 - 0.1) w.setBlock(x, y, z, 0, 4 | 8); continue; }
        if (PLANT[id] || c === 5) { w.setBlock(x, y, z, id === B.ice || id === B.packed_ice ? B.water : 0, 4 | 8); continue; }
        if (!SOLID[id]) continue;
        if (c === 2 && Math.random() < k + 0.3) w.setBlock(x, y, z, Math.random() < 0.55 ? B.coarse_dirt : B.dirt, 4 | 8);
        if (fires < 55 && Math.random() < k * 0.045 && w.getId(x, y + 1, z) === 0 && OPAQUE[w.getId(x, y, z)]) { w.setBlock(x, y + 1, z, B.fire, 1); fires++; }
        break;
      }
    }
    this.fires = fires;
  }
  // the shock front: buffets you and brings the boom when it gets to you
  shock() {
    const g = this.g, p = g.player, bt = this.bt;
    this.rs = 170 * (1 - Math.exp(-bt / 1.3));
    if (this.boomed || !p) return;
    const cam = g.camera, d = Math.hypot(cam.x - this.x, cam.y - this.y, cam.z - this.z);
    if (d < 160 ? this.rs < d : bt < 4 + (d - 160) / 330) return;
    this.boomed = true;
    g.audio.play('sng_boom', { vol: 0.3 + 0.7 * (1 - smoothstep(80, 1000, d)) });
    if (d < 280) {
      const k = 1 - d / 280, dx = cam.x - this.x, dy = cam.y - this.y, dz = cam.z - this.z, l = d || 1;
      g.shake = Math.max(g.shake || 0, 1.35 * k);
      const V = p.vehicle;
      if (V && V.vel) { V.vel[0] += dx / l * 28 * k; V.vel[1] += Math.max(0, dy / l) * 18 * k + 6 * k; V.vel[2] += dz / l * 28 * k; }
      else if (!p.creative && !p.spectator) { p.vx += dx / l * 0.9 * k; p.vy += 0.35 * k; p.vz += dz / l * 0.9 * k; }
    }
  }
  // mushroom cloud: a stem, a rolling cap and a ground surge, white hot first and dark smoke later
  initCloud() {
    const tex = ITEM_TEXI.p_cloud !== undefined ? ITEM_TEXI.p_cloud : ITEM_TEXI.p_smoke, P = [];
    const mk = (k, a, b, c, s) => ({ x: this.x, y: this.y, z: this.z, vx: 0, vy: 0, vz: 0, size: s, uv: [0, 0, 1, 1], color: [1, 0.8, 0.5], alpha: 0, layer: tex, src: 1, age: 0, life: 1e9, fade: false, emissive: true, k, a, b, c, s0: s });
    for (let i = 0; i < 42; i++) P.push(mk(0, Math.random() * TAU, i / 42, Math.random(), 4.5 + Math.random() * 3));
    for (let i = 0; i < 110; i++) P.push(mk(1, i / 110 * TAU + Math.random() * 0.15, Math.random() * TAU, Math.random(), 6 + Math.random() * 4.5));
    for (let i = 0; i < 48; i++) P.push(mk(2, i / 48 * TAU + Math.random() * 0.1, Math.random(), Math.random(), 5 + Math.random() * 3));
    this.puffs = P;
  }
  cloud() {
    const Q = this.puffs; if (!Q) return;
    const bt = this.bt, cx = this.x, cy = this.y, cz = this.z;
    const H = 66 * (1 - Math.exp(-bt / 3.4)), Rc = 8 + 16 * (1 - Math.exp(-bt / 5)), rt = 4.5 + 4.5 * (1 - Math.exp(-bt / 3)), stem = 2.5 + 3.5 * (1 - Math.exp(-bt / 3));
    const heat = Math.exp(-bt / 2.2), hot = smoothstep(0.06, 0.4, heat), day = Math.max(0.3, this.g.skyFactor ? this.g.skyFactor() : 1);
    const fade = smoothstep(0, 0.3, bt) * (1 - smoothstep(SNG.life - 14, SNG.life - 0.5, bt)), surge = Math.min(this.rs * 0.55, 48);
    for (const q of Q) {
      if (q.k === 0) { const h = q.b * H * 0.96, wd = stem * (0.55 + 0.45 * q.c) * (1 + (1 - q.b) * 0.6), a = q.a + bt * 0.25; q.x = cx + Math.cos(a) * wd; q.y = cy + h; q.z = cz + Math.sin(a) * wd; }
      else if (q.k === 1) { const th = q.b + bt * 0.55, rr = Rc + Math.cos(th) * rt * (0.7 + 0.3 * q.c); q.x = cx + Math.cos(q.a) * rr; q.y = cy + H + Math.sin(th) * rt * 0.8; q.z = cz + Math.sin(q.a) * rr; }
      else { const rr = surge * (0.8 + 0.2 * q.b); q.x = cx + Math.cos(q.a) * rr; q.y = this.gy + 1.2 + q.c * 2.5; q.z = cz + Math.sin(q.a) * rr; }
      q.size = q.s0 * (0.35 + 0.65 * smoothstep(0, 1.6, bt)) * (1 + bt * 0.012);
      // white hot, then fire, then smoke lit by the sky (blended so it does not pop)
      const s = q.k === 2 ? 0.6 : 0.4 + q.c * 0.14;
      if (hot > 0.001) {
        q.emissive = true;
        const fr = 1, fg = 0.42 + 0.55 * heat, fb = 0.2 + 0.75 * heat * heat;
        q.color[0] = lerp(s * day * 0.85, fr, hot); q.color[1] = lerp(s * day * 0.8, fg, hot); q.color[2] = lerp(s * day * 0.76, fb, hot);
      } else { q.emissive = false; q.color[0] = s; q.color[1] = s * 0.95; q.color[2] = s * 0.9; }
      q.alpha = fade * (q.k === 2 ? 0.8 * (1 - smoothstep(8, 22, bt)) : 0.9);
    }
  }
  // ---------------------------------------------------------------- drawing
  extras(out) {
    for (const d of this.debris) out.push(d);
    if (this.puffs) for (const q of this.puffs) if (q.alpha > 0.01) out.push(q);
  }
  drawSolid(R) {
    if (this.burst || this.r < 0.03) return;
    const gl = R.gl, pr = R.progs.vox, u = pr.u, mesh = sngSphere(gl), M = this._m || (this._m = M4.create());
    gl.useProgram(pr.p); R.setEnvUniforms(pr);
    gl.uniformMatrix4fv(u.uProj, false, R.vp);
    if (R.shadow && u.uShadowMap) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, R.shadow.tex); gl.uniform1i(u.uShadowMap, 1); gl.activeTexture(gl.TEXTURE0); }
    gl.uniform1f(u.uPulse, R.time); gl.uniform1f(u.uAlphaV, 1); gl.uniform1f(u.uGlow, 0); gl.uniform1f(u.uHurtV, 0); gl.uniform2f(u.uLightE, 1, 0);
    const s = this.r * 1.5;
    M4.identity(M); M4.translate(M, this.x - R.camX, this.y - R.camY, this.z - R.camZ); M4.scale(M, s, s, s);
    gl.uniformMatrix4fv(u.uModel, false, M);
    gl.enable(gl.CULL_FACE); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
  // the hole's place on screen, for the lensing in the composite pass (the biggest one on screen wins)
  lens(R) {
    const g = this.g, m = R.vp, dx = this.x - R.camX, dy = this.y - R.camY, dz = this.z - R.camZ;
    const cw = m[3] * dx + m[7] * dy + m[11] * dz + m[15]; if (cw <= 0.5) return;
    const nx = (m[0] * dx + m[4] * dy + m[8] * dz + m[12]) / cw, ny = (m[1] * dx + m[5] * dy + m[9] * dz + m[13]) / cw;
    if (Math.abs(nx) > 1.6 || Math.abs(ny) > 1.6) return;
    const d = Math.hypot(dx, dy, dz), rs = this.r * 1.5 / d / Math.tan((g.camera.fov || 70) * DEG / 2) * 0.5;
    if (rs < 0.002) return;
    const L = g.lens || (g.lens = [0, 0, 0, 0, 1]);
    if (g.lensOn && L[2] >= rs) return;
    L[0] = nx * 0.5 + 0.5; L[1] = ny * 0.5 + 0.5; L[2] = Math.min(rs, 0.2); L[3] = Math.min(1, this.t / SNG.form) * (1 - smoothstep(0.12, 0.3, rs));
    L[4] = (m[2] * dx + m[6] * dy + m[10] * dz + m[14]) / cw * 0.5 + 0.5;
    g.lensOn = L[3] > 0.001;
  }
  drawFX(R) {
    const cx = this.x, cy = this.y, cz = this.z;
    if (!this.burst) {
      const r = this.r; if (r < 0.02) return;
      const k = Math.min(1, this.t / SNG.form), t = this.t, n = this.n, e1 = this.e1, e2 = this.e2;
      // accretion disk: matter spiralling in, white hot at the horizon, orange further out, streaked by its speed
      for (let i = 0; i < 128; i++) {
        const h = hashF2(91, i, 7), rad = r * (1.75 + 2.4 * h * h), a = i * 2.39996 + t * 6.5 / Math.sqrt(rad / r), off = (hashF2(17, i, 3) - 0.5) * 0.12 * r;
        const ca = Math.cos(a), sa = Math.sin(a), hot = 1 - h;
        const x = cx + (e1[0] * ca + e2[0] * sa) * rad + n[0] * off, y = cy + (e1[1] * ca + e2[1] * sa) * rad + n[1] * off, z = cz + (e1[2] * ca + e2[2] * sa) * rad + n[2] * off;
        R.fxSprite(x, y, z, r * (0.13 + 0.17 * h), 1.0, 0.55 + 0.4 * hot, 0.3 + 0.6 * hot * hot, (0.9 + hot * 0.8) * k);
        const b = a - 0.2, cb = Math.cos(b), sb = Math.sin(b);
        R.fxBeam(x, y, z, cx + (e1[0] * cb + e2[0] * sb) * rad, cy + (e1[1] * cb + e2[1] * sb) * rad, cz + (e1[2] * cb + e2[2] * sb) * rad, r * 0.06, 1.0, 0.6 + 0.3 * hot, 0.35 + 0.4 * hot, 0.6 * k);
      }
      // photon ring: a thin bright circle hugging the shadow, always facing you
      const v = R.view, rx = v[0], ry = v[4], rz = v[8], ux = v[1], uy = v[5], uz = v[9], pr = r * 1.56;
      let px = cx + rx * pr, py = cy + ry * pr, pz = cz + rz * pr;
      for (let i = 1; i <= 48; i++) {
        const a = i / 48 * TAU, ca = Math.cos(a) * pr, sa = Math.sin(a) * pr, qx = cx + rx * ca + ux * sa, qy = cy + ry * ca + uy * sa, qz = cz + rz * ca + uz * sa;
        R.fxBeam(px, py, pz, qx, qy, qz, r * 0.035, 0.85, 0.72, 1.0, 1.5 * k);
        px = qx; py = qy; pz = qz;
      }
      // the collapse: the disk flares as it falls in
      if (this.collapsing) { const c = smoothstep(SNG.collapse, SNG.burst, t); R.fxSprite(cx, cy, cz, SNG.r1 * (1.6 - c) * 2, 0.8, 0.65, 1.0, 1.5 * c); }
      this.lens(R);
      return;
    }
    // ---- the burst: fireball, a condensation shell racing out, and the shock front along the ground
    const bt = this.bt, fr = SNG.crH * 1.25 * (1 - Math.exp(-bt / 0.16)), glow = Math.exp(-bt / 0.9);
    if (bt < 4.5) {
      R.fxSprite(cx, cy, cz, fr * 1.1, 1.0, 0.82 + 0.18 * glow, 0.62 + 0.38 * glow, 3.2 * glow + 0.25 * (1 - bt / 4.5));
      for (let i = 0; i < 40; i++) {
        const yy = 1 - (i + 0.5) / 40 * 2, rr = Math.sqrt(1 - yy * yy), a = i * 2.39996, q = fr * (0.5 + 0.4 * hashF2(5, i, 1));
        R.fxSprite(cx + Math.cos(a) * rr * q, cy + Math.abs(yy) * q * 0.8, cz + Math.sin(a) * rr * q, fr * 0.42, 1.0, 0.5 + 0.35 * glow, 0.2 + 0.5 * glow, 1.5 * glow + 0.15 * (1 - bt / 4.5));
      }
    }
    if (bt < 1.3) {
      const v = R.view, rx = v[0], ry = v[4], rz = v[8], ux = v[1], uy = v[5], uz = v[9], pr = this.rs * 0.85, al = (1 - bt / 1.3) * 0.5;
      let px = cx + rx * pr, py = cy + ry * pr, pz = cz + rz * pr;
      for (let i = 1; i <= 64; i++) {
        const a = i / 64 * TAU, ca = Math.cos(a) * pr, sa = Math.sin(a) * pr, qx = cx + rx * ca + ux * sa, qy = cy + ry * ca + uy * sa, qz = cz + rz * ca + uz * sa;
        R.fxBeam(px, py, pz, qx, qy, qz, 0.5 + pr * 0.012, 0.95, 0.95, 1.0, al);
        px = qx; py = qy; pz = qz;
      }
    }
    if (bt < 3.6) {
      const w = this.w, rs = this.rs, al = 0.95 * (1 - bt / 3.6), flat = w.dim === 'nether';
      for (let i = 0; i < 96; i++) {
        const a = i / 96 * TAU, x = cx + Math.cos(a) * rs, z = cz + Math.sin(a) * rs;
        const y = flat ? this.gy : clamp(w.heightAt(Math.floor(x), Math.floor(z)), this.gy - 24, this.gy + 24);
        R.fxSprite(x, y + 0.8, z, 2.4 + rs * 0.02, 1.0, 0.82, 0.6, al);
      }
    }
  }
  lights(R) {
    if (!this.burst) { if (this.r > 0.05) R.addLight(this.x, this.y, this.z, 14 + this.r * 4, 1.0, 0.62, 0.9, 1.7 * Math.min(1, this.t / SNG.form)); return; }
    const bt = this.bt;
    R.addLight(this.x, this.y + 4, this.z, 120, 1.0, 0.78, 0.55, 9 * Math.exp(-bt / 0.7) + 2.2 * Math.exp(-bt / 5));
  }
}
// ---------------------------------------------------------------- cockpit
// Pared down on purpose: a frameless gold-tinted canopy, one panoramic display under a holographic edge light,
// the caution lamps, stick and throttle. Shares the Stormcrow's canopy shape (48_cockpit.js).
CK_DISPLAYS.fighter = [{ id: 'pfd', x: 0, y: 0, w: 341, h: 372 }, { id: 'tsd', x: 341, y: 0, w: 341, h: 372 }, { id: 'wpn', x: 682, y: 0, w: 342, h: 372 }];
CK_LAMPS.fighter = ['MASTER CAUTION', 'PULL UP', 'GEAR', 'HYPER', 'LOCK', 'RAIL HOT', 'GRAV LIFT', 'SNG ARMED'];
function buildEclipseCockpit() {
  const M = new CkMesh(), G = new CkMesh(), STK = new CkMesh(), THR = new CkMesh(), P = CK_PAL, SILL = SC_SILL;
  const HULL = ckRGB(0x1C1E25), HULL2 = ckRGB(0x2A2E37), CY = ckRGB(0x55EEFF, 0.85), VI = ckRGB(0xA36CFF, 0.85), GOLD = ckRGB(0xC89A3A);
  G.surf(32, 34, (s, t) => scPt(s * 2 - 1, -0.9 + t * 1.8), GOLD, CK.GLASS);
  // sills: a rail each side with a cyan light line, and the tub wall below
  for (const sd of [-1, 1]) {
    M.surf(4, 32, (s, t) => { const z = -0.92 + t * 1.82, w = scW(z); return [sd * (w - 0.056 + s * 0.07), SILL - 0.004 + Math.sin(s * Math.PI) * 0.008, z]; }, HULL, CK.SATIN);
    M.surf(2, 32, (s, t) => { const z = -0.92 + t * 1.82; return [sd * (scW(z) - 0.056), SILL - 0.004 - s * 0.05, z]; }, HULL, CK.SATIN);
    M.surf(1, 28, (s, t) => { const z = -0.8 + t * 1.5; return [sd * (scW(z) - 0.0575), SILL - 0.013 - s * 0.006, z]; }, CY, CK.GLOW);
    M.surf(3, 14, (s, t) => { const z = -0.64 + t * 1.02, w = scW(z) - 0.056; return [sd * (w - s * 0.025), SILL - 0.054 - s * 0.25, z]; }, (s) => ckRGB(0x23262E, 0.8 + 0.2 * (1 - s)), CK.MATTE);
    M.box(sd < 0 ? -0.43 : 0.215, -0.64, -0.5, sd < 0 ? -0.215 : 0.43, -0.535, 0.36, HULL2, CK.SATIN);
    M.push(sd * 0.322, -0.535, -0.07, -Math.PI / 2, 0, 0);
    M.pbox(-0.1, -0.4, 0, 0.1, 0.4, 0.005, 0.003, HULL, CK.SATIN);
    M.box(-0.08, -0.3, 0.005, 0.08, 0.3, 0.008, P.black, CK.SATIN);
    M.box(-0.07, 0.31, 0.005, 0.07, 0.315, 0.009, sd < 0 ? VI : CY, CK.GLOW);
    M.pop();
  }
  // glare shield: a slim black hood with a cyan lip
  const gsY = (z) => -0.17 + 0.03 * clamp((z + 0.92) / 0.42, 0, 1);
  const gsPt = (a, z) => { const k = smoothstep(0.58, 1.0, Math.abs(a)); return [a * (scW(z) - 0.006), lerp(gsY(z), SILL + 0.004, k), z]; };
  M.surf(32, 8, (s, t) => gsPt(s * 2 - 1, -0.92 + t * 0.42), P.black, CK.MATTE);
  M.surf(32, 1, (s, t) => { const p = gsPt(s * 2 - 1, -0.5); return [p[0], p[1] - t * 0.026, -0.5]; }, P.black, CK.MATTE);
  M.surf(32, 1, (s, t) => { const p = gsPt(s * 2 - 1, -0.5); return [p[0] * 0.98, p[1] - 0.026, -0.5 - t * 0.15]; }, P.black, CK.MATTE);
  M.surf(24, 1, (s, t) => { const p = gsPt((s * 2 - 1) * 0.7, -0.5); return [p[0], p[1] - 0.004 + t * 0.003, -0.4995]; }, CY, CK.GLOW);
  // panoramic display: three pages on one sheet, framed by light
  const pcd = ckUV(ckDisp('fighter', 'pfd')); pcd[2] = 1;
  M.push(0, -0.3, -0.575, -0.21, 0, 0);
  M.box(-0.44, -0.37, -0.06, 0.44, 0.145, 0, HULL2, CK.SATIN);
  M.pbox(-0.315, -0.125, 0, 0.315, 0.14, 0.012, 0.006, P.black, CK.SATIN);
  M.quad([-0.3, -0.093, 0.0125], [0.3, -0.093, 0.0125], [0.3, 0.126, 0.0125], [-0.3, 0.126, 0.0125], P.white, CK.SCREEN, pcd);
  M.box(-0.316, 0.139, 0.011, 0.316, 0.142, 0.0135, CY, CK.GLOW); M.box(-0.316, -0.124, 0.011, 0.316, -0.121, 0.0135, CY, CK.GLOW);
  M.osbRow(-0.28, 0.28, -0.108, 12, 0.03, 0.011);
  const lc = [P.lampA, P.lampR, P.lampG, P.lampA, P.lampY, P.lampA, ckRGB(0xB48CFF), ckRGB(0xC8A0FF)];
  for (let i = 0; i < 8; i++) M.lamp(i < 4 ? -0.37 : 0.37, 0.1 - (i % 4) * 0.042, 0.07, 0.03, i, lc[i]);
  // lower panel: the singularity master arm under a striped guard, a row of switches
  M.pbox(-0.08, -0.29, 0, 0.08, -0.16, 0.008, 0.004, HULL, CK.SATIN);
  M.box(-0.05, -0.27, 0.008, 0.05, -0.18, 0.03, P.red, CK.SATIN);
  for (let i = 0; i < 5; i++) M.box(-0.05 + i * 0.022, -0.27, 0.0302, -0.04 + i * 0.022, -0.18, 0.0306, P.yellow, CK.SATIN);
  M.legend(0, -0.3, 0.07, 0.006);
  for (let i = 0; i < 5; i++) { M.toggle(0.14 + i * 0.035, -0.25, i % 2 === 0); M.legend(0.14 + i * 0.035, -0.222, 0.024, 0.004); }
  for (let i = 0; i < 4; i++) M.knob(-0.3 + i * 0.05, -0.23, 0.01, 0.015, HULL2);
  M.pop();
  // seat, floor and the pilot's legs
  M.push(0, -0.02, 0.23, 0, Math.PI, 0); M.pbox(-0.14, -0.16, -0.06, 0.14, 0.15, 0.06, 0.03, P.cushion, CK.MATTE); M.pop();
  M.box(-0.19, -0.95, 0.2, -0.155, 0.12, 0.34, HULL2, CK.METAL); M.box(0.155, -0.95, 0.2, 0.19, 0.12, 0.34, HULL2, CK.METAL);
  for (const sd of [-1, 1]) M.box(sd * 0.1 - 0.012, 0.15, 0.2, sd * 0.1 + 0.012, 0.17, 0.3, VI, CK.GLOW);
  M.box(-0.2, -0.78, -0.2, 0.2, -0.7, 0.26, P.cushion, CK.MATTE);
  M.box(-0.44, -1.02, -0.9, 0.44, -0.98, 0.4, P.shellD, CK.MATTE);
  for (const sd of [-1, 1]) {
    const x = sd * 0.11;
    M.beam([x, -0.67, 0.02], [x, -0.6, -0.4], 0.13, 0.14, P.suit, CK.MATTE);
    M.beam([x, -0.62, -0.42], [x, -0.92, -0.6], 0.11, 0.12, P.suit, CK.MATTE);
    M.box(x - 0.06, -0.98, -0.72, x + 0.06, -0.9, -0.54, P.boot, CK.MATTE);
  }
  M.surf(20, 8, (s, t) => { const z = 0.34 + t * 0.58, a = s * 2 - 1, w = scW(z) - 0.05; return [a * w, SILL + 0.03 + 0.15 * (1 - a * a) * smoothstep(0.34, 0.92, z), z]; }, P.shellD, CK.MATTE);
  // side stick and throttle (moving parts, built around their pivots)
  STK.push(0, 0, 0, -Math.PI / 2, 0, 0); STK.cyl(0, 0, 0, 0.034, 0.03, 12, P.rubber, CK.MATTE); STK.cyl(0, 0, 0.03, 0.011, 0.06, 8, P.metal, CK.METAL); STK.pop();
  STK.push(0, 0.085, 0, 0.18, 0, 0);
  STK.pbox(-0.021, 0, -0.026, 0.021, 0.1, 0.026, 0.008, P.black, CK.SATIN);
  STK.box(-0.022, 0.012, 0.008, 0.022, 0.07, 0.027, P.rubber, CK.MATTE);
  STK.box(0.004, 0.098, -0.022, 0.016, 0.108, -0.008, CY, CK.GLOW);
  STK.box(-0.016, 0.098, -0.022, -0.004, 0.108, -0.008, VI, CK.GLOW);
  STK.pop();
  THR.box(-0.009, 0, -0.012, 0.009, 0.075, 0.012, P.metal, CK.METAL);
  THR.pbox(-0.032, 0.07, -0.05, 0.032, 0.12, 0.034, 0.01, P.black, CK.SATIN);
  THR.box(-0.034, 0.09, -0.03, -0.031, 0.108, -0.005, CY, CK.GLOW);
  return {
    parts: { M, G, STK, THR }, stick: [0.322, -0.53, -0.25], throttle: [-0.322, -0.525, -0.2],
    occ: [SILL, 0.39, -0.5, gsY(-0.5)], cab: [99, 0, 0, 0], tint: ckRGB(0xC89A3A), spill: [0, -0.3, -0.5], spillCol: [0.3, 0.85, 1.0],
  };
}
COCKPITS.fighter = buildEclipseCockpit;
// weapons and systems page: the planform at its current sweep, the warheads, rail heat and the drives
function ckPageEclipse(c, w, h, v) {
  ckFrame(c, w, h, 'WPN / SYS', v.lock ? (v.lockT >= 1 ? 'LOCK' : 'TRACK') : v.hov > 0.3 ? 'GRAV' : v.boosting ? 'HYPER' : '');
  const cx = w / 2;
  c.strokeStyle = CKC.white; c.lineWidth = 2;
  const poly = (pts) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); c.stroke(); };
  poly([cx, 32, cx + 6, 58, cx + 12, 90, cx + 13, 122, cx + 9, 150, cx - 9, 150, cx - 13, 122, cx - 12, 90, cx - 6, 58]);
  const a = v.sweep || 0, ca = Math.cos(a), sa = Math.sin(a);
  for (const sd of [-1, 1]) {
    const px = cx + sd * 10, py = 124, pts = [];
    for (const [x, y] of [[0, -9], [64, -40], [66, -32], [0, 9]]) { const rx = x * ca - y * sa, ry = x * sa + y * ca; pts.push(px + sd * rx, py + ry); }
    poly(pts);
  }
  c.strokeStyle = CKC.amber; c.beginPath(); c.ellipse(cx, 142, 17, 4, 0, 0, TAU); c.stroke();
  // warheads
  for (let i = 0; i < SNG.max; i++) {
    const x = cx + (i - (SNG.max - 1) / 2) * 64, y = 196;
    c.lineWidth = 2; c.strokeStyle = CKC.white; c.beginPath(); c.arc(x, y, 17, 0, TAU); c.stroke();
    if (i < v.sng) { c.fillStyle = '#B48CFF'; c.beginPath(); c.arc(x, y, 13, 0, TAU); c.fill(); c.fillStyle = '#000'; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); }
    else if (i === v.sng && v.sReload > 0) { c.strokeStyle = CKC.amber; c.lineWidth = 5; c.beginPath(); c.arc(x, y, 12, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - v.sReload / SNG.reload)); c.stroke(); }
  }
  ckText(c, 'SINGULARITY ' + v.sng + '/' + SNG.max, 10, 232, 15, CKC.white);
  const D = v.desig, st = v.sngMsgT > 0 ? v.sngMsg : D ? (D.ent ? 'TGT LOCKED' : D.far ? 'OUT OF RANGE' : D.hit ? 'TGT ' + Math.round(D.dist) + 'm' : 'AIRBURST') : '';
  ckText(c, st, w - 10, 232, 13, st === 'AWAY' || st.startsWith('TGT') || st === 'AIRBURST' ? CKC.yellow : CKC.red, 'right');
  ckText(c, 'RAIL', 10, 258, 13, v.overheat > 0 ? CKC.red : CKC.green);
  c.fillStyle = 'rgba(156,255,99,0.12)'; c.fillRect(64, 251, w - 76, 14);
  c.fillStyle = v.overheat > 0 || v.heat > 0.8 ? CKC.red : CKC.green; c.fillRect(64, 251, (w - 76) * clamp(v.heat, 0, 1), 14);
  ckText(c, 'HYPER', 10, 282, 13, v.boosting ? CKC.amber : CKC.dim);
  c.fillStyle = 'rgba(255,178,61,0.15)'; c.fillRect(64, 275, w - 76, 14); c.fillStyle = CKC.amber; c.fillRect(64, 275, (w - 76) * v.boost, 14);
  const hull = v.hull / v.def.hull;
  ckText(c, 'HULL', 10, 306, 13, hull < 0.3 ? CKC.red : CKC.green);
  c.fillStyle = 'rgba(156,255,99,0.12)'; c.fillRect(64, 299, w - 76, 14); c.fillStyle = hull < 0.3 ? CKC.red : CKC.green; c.fillRect(64, 299, (w - 76) * clamp(hull, 0, 1), 14);
  const F = ckFlight(v);
  ckText(c, 'G ' + F.gz.toFixed(1) + '  MAX ' + (v.gPeak || 1).toFixed(1), 10, h - 34, 14, F.gz > 9 ? CKC.amber : CKC.white);
  ckText(c, v.hov > 0.3 ? 'GRAV LIFT' : v.gear > 0.5 ? 'GEAR DN' : 'GEAR UP', w - 10, h - 34, 13, v.hov > 0.3 ? '#C8A0FF' : v.gear > 0.5 ? CKC.green : CKC.dim, 'right');
  ckText(c, 'SWEEP ' + Math.round((v.sweep || 0) / DEG) + '°', 10, h - 14, 12, CKC.dim);
  ckText(c, Math.round(F.kph) + ' KPH', w - 10, h - 14, 12, CKC.dim, 'right');
}
Object.assign(VEH_CLASSES, { fighter: Eclipse });
