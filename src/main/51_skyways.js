// ============================================================================
//  SKYWAYS runtime: region banners, the races (start gates, gate order, timer, splits against your best, medals,
//  records saved with the world), boost rings, repairs on airfield pavement, and the HUD markers for all of it.
//  Region plans (airfield + course) come from a worker ('skyinfo'); the gates match the blocks it built.
// ============================================================================
const SKY_MEDALS = ['GOLD', 'SILVER', 'BRONZE'], SKY_MEDAL_COL = ['#FFD447', '#D8E2EA', '#E0995A'];
function skyTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
class SkyRuntime {
  constructor(game) {
    this.g = game; this.info = new Map(); this.pending = new Set();
    this.run = null; this.zoneCell = null; this.msg = null; this.prev = null; this.t = 0; this.lastCheck = -1; this.svcT = 0; this.boostT = -9;
    let el = document.getElementById('skybanner');
    if (!el) { el = h('div', { id: 'skybanner' }, h('div', { class: 'sbt' }), h('div', { class: 'sbs' })); game.ui.root.appendChild(el); }
    this.bannerEl = el; el.classList.remove('show');
  }
  get sky() { return this.g.gen && this.g.gen.sky; }
  records() { const m = this.g.meta; if (!m.sky) m.sky = {}; return m.sky.records || (m.sky.records = {}); }
  // ---------------------------------------------------------------- region plans from the workers
  fetch(x, z) {
    const i0 = Math.floor(x / SKY_CELL + 0.5), j0 = Math.floor(z / SKY_CELL + 0.5);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = i0 + di, j = j0 + dj, k = i + ',' + j;
      if (this.info.has(k) || this.pending.has(k)) continue;
      this.pending.add(k);
      this.g.jobs.post({ t: 'skyinfo', i, j }, null, (m) => { this.pending.delete(k); if (m.res) this.info.set(k, this.unpack(m.res)); });
    }
  }
  unpack(r) {
    const gate = (a) => ({ x: a[0], y: a[1], z: a[2], nx: a[3], nz: a[4], R: a[5], k: a[6] });
    if (r.course) { r.course.gates = r.course.gates.map(gate); r.course.boosts = r.course.boosts.map(gate); r.course.inf = r; }
    return r;
  }
  nearestCourse(x, z) {
    let best = null, bd = 1e18;
    for (const inf of this.info.values()) { const C = inf.course; if (!C) continue; const g = C.gates[0], d = Math.hypot(g.x - x, g.z - z); if (d < bd) { bd = d; best = C; } }
    return best ? { course: best, dist: bd } : null;
  }
  nearestAirfield(x, z) {
    let best = null, bd = 1e18;
    for (const inf of this.info.values()) { const a = inf.air; if (!a) continue; const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = a; } }
    return best ? { air: best, dist: bd } : null;
  }
  // ---------------------------------------------------------------- per frame
  frame(dt) {
    const g = this.g, p = g.player;
    if (!this.sky || !p || !g.world || g.world.dim !== 'overworld') return;
    this.t += dt;
    if (this.msg && (this.msg.t -= dt) <= 0) this.msg = null;
    if (g.state !== 'playing') { this.prev = null; return; }
    if (this.t - this.lastCheck > 0.25) { this.lastCheck = this.t; this.fetch(p.x, p.z); this.checkZone(p); }
    const v = p.vehicle && !p.vehicle.removed ? p.vehicle : null;
    if (v) {
      const c = v.center([0, 0, 0]);
      if (this.prev) this.crossings(this.prev, c, v);
      this.prev = c;
    } else this.prev = null;
    if (this.hold) this.holdTick(v);
    if (this.run) this.runTick(v, dt);
    this.service(dt, v);
  }
  checkZone(p) {
    const z = this.sky.zoneAt(p.x, p.z);
    if (z.inside < 0.3 || z.cell === this.zoneCell) return;
    this.zoneCell = z.cell;
    const c = z.cell;
    this.banner(c.name.toUpperCase(), c.label + '  ·  Level ' + c.lv + ' ' + SKY_LEVELS[c.lv - 1]);
    if (this.t > 1) this.g.audio.play('sky_zone', {});
  }
  banner(title, sub) {
    const el = this.bannerEl;
    el.children[0].textContent = title; el.children[1].textContent = sub;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(this.bannerTO); this.bannerTO = setTimeout(() => el.classList.remove('show'), 4200);
  }
  flash(text, sub, col, dur) { this.msg = { text, sub: sub || '', col: col || '#FFFFFF', t: dur || 2.4, d: dur || 2.4 }; }
  // ---------------------------------------------------------------- gates
  // did the segment a -> b pass forward (or either way) through a ring?
  through(g, a, b, both) {
    const sa = (a[0] - g.x) * g.nx + (a[2] - g.z) * g.nz, sb = (b[0] - g.x) * g.nx + (b[2] - g.z) * g.nz;
    if (!(sa < 0 && sb >= 0) && !(both && sa > 0 && sb <= 0)) return false;
    const t = sa / (sa - sb), x = a[0] + (b[0] - a[0]) * t - g.x, y = a[1] + (b[1] - a[1]) * t - g.y, z = a[2] + (b[2] - a[2]) * t - g.z;
    return x * x + y * y + z * z <= (g.R + 0.6) * (g.R + 0.6);
  }
  crossings(a, b, v) {
    for (const inf of this.info.values()) {
      const C = inf.course; if (!C) continue;
      for (const r of C.boosts) if (this.through(r, a, b, true)) this.boostRing(v, r);
      if (this.through(C.gates[0], a, b) && !(this.run && this.run.course === C && this.run.i === 1 && this.t - this.run.t0 < 1.5)) { this.start(C, v); return; }
    }
    const R = this.run;
    if (R) { const gt = R.course.gates[R.i]; if (gt && this.through(gt, a, b)) this.passGate(v); }
  }
  start(C, v) {
    this.run = { course: C, i: 1, t0: this.t, splits: [], vehicle: v, gone: 0 };
    this.lastCourse = C; this.lastKind = v.kind;
    const rec = this.records()[C.id];
    this.flash(C.name.toUpperCase(), rec ? 'BEST ' + skyTime(rec.t) + (rec.medal ? '  ·  ' + rec.medal : '') : 'GOLD ' + skyTime(C.par[0]) + '  ·  ' + (C.gates.length - 1) + ' GATES', '#7CFF8A', 2.6);
    this.g.audio.play('sky_start', {});
  }
  passGate(v) {
    const R = this.run, C = R.course, t = this.t - R.t0, rec = this.records()[C.id];
    R.splits.push(Math.round(t * 1000) / 1000);
    const last = R.i === C.gates.length - 1, prevBest = rec && rec.splits && rec.splits[R.i - 1];
    if (last) { this.finish(t); return; }
    const delta = prevBest !== undefined ? t - prevBest : null;
    this.flash('GATE ' + R.i + ' / ' + (C.gates.length - 1), delta === null ? skyTime(t) : (delta <= 0 ? '-' : '+') + Math.abs(delta).toFixed(2), delta === null ? '#FFFFFF' : delta <= 0 ? '#7CFF8A' : '#FF8A6A', 1.3);
    R.i++;
    this.g.audio.play('sky_gate', {});
  }
  finish(t) {
    const R = this.run, C = R.course, recs = this.records(), rec = recs[C.id];
    const mi = t <= C.par[0] ? 0 : t <= C.par[1] ? 1 : t <= C.par[2] ? 2 : -1, medal = mi >= 0 ? SKY_MEDALS[mi] : '';
    const isNew = !rec || t < rec.t;
    if (isNew) recs[C.id] = { t: Math.round(t * 1000) / 1000, splits: R.splits.slice(), medal: rec && rec.medal && (mi < 0 || SKY_MEDALS.indexOf(rec.medal) < mi) ? rec.medal : medal, name: C.name, runs: (rec ? rec.runs : 0) + 1 };
    else rec.runs = (rec.runs || 0) + 1;
    this.flash('FINISH  ' + skyTime(t), (isNew ? (rec ? 'NEW RECORD  -' + (rec.t - t).toFixed(2) : 'FIRST RECORD') : 'BEST ' + skyTime(rec.t)) + (medal ? '  ·  ' + medal : '  ·  ' + skyTime(C.par[2]) + ' FOR BRONZE'), mi >= 0 ? SKY_MEDAL_COL[mi] : '#FFFFFF', 6);
    this.g.ui.message(`${C.name}: ${skyTime(t)}${medal ? ' (' + medal.toLowerCase() + ')' : ''}${isNew ? ' - new record!' : ''}`, mi >= 0 ? SKY_MEDAL_COL[mi] : '#fff');
    this.g.audio.play(mi >= 0 || isNew ? 'sky_done' : 'sky_gate', {});
    this.run = null;
    if (this.g.meta) this.g.save.putWorld(this.g.meta);
  }
  abort(why) { if (!this.run) return; this.flash('RUN ABANDONED', why, '#FF8A6A', 2.6); this.g.audio.play('sky_fail', {}); this.run = null; }
  canRetry() { const g = this.g; return !!(g.player && (g.player.creative || (g.meta && g.meta.cheats))); }
  runTick(v, dt) {
    const R = this.run;
    if (R.vehicle.dead && !R.crashed) {
      R.crashed = true;
      this.g.ui.message(this.canRetry() ? 'Crashed! Press Backspace to retry ' + R.course.name + '.' : 'Crashed!', '#ff9a7a');
    }
    if (!v || v !== R.vehicle) { if ((R.gone += dt) > 1.5) this.abort(v ? 'you changed aircraft' : R.crashed ? 'crashed' : 'you left the aircraft'); return; }
    R.gone = 0;
    const g = R.course.gates[R.i];
    if (g && Math.hypot(g.x - v.x, g.z - v.z) > 1800) this.abort('too far off the course');
    else if (this.t - R.t0 > 1200) this.abort('out of time');
  }
  // is (x, y, z) in the frame of a course gate or boost ring?
  ringAt(x, y, z) {
    for (const inf of this.info.values()) {
      const C = inf.course; if (!C) continue;
      for (const list of [C.gates, C.boosts]) for (const g of list) {
        const dx = x - g.x, dy = y - g.y, dz = z - g.z; if (dx * dx + dy * dy + dz * dz > (g.R + 4) * (g.R + 4)) continue;
        const a = dx * g.nx + dz * g.nz; if (a < -1.8 || a > 1.8) continue;
        const u = -dx * g.nz + dz * g.nx, r = Math.hypot(u, dy);
        if (r > g.R - 1 && r < g.R + 2.8) return g;
      }
    }
    return null;
  }
  ringHit(v, x, y, z) {
    if (this.t - (this.ringT || -9) < 0.4) return;
    this.ringT = this.t;
    const g = this.g, R = this.run;
    v.hurt(Math.max(5, v.def.hull * 0.05), { type: 'scrape' });
    g.shake = Math.max(g.shake || 0, 0.45);
    const b = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    for (let i = 0; i < 4; i++) g.particles.blockHit(Math.floor(x), Math.floor(y), Math.floor(z), 2, b || B.orange_concrete);
    g.audio.play('hit', { vol: 1 }); g.audio.play('sky_fail', {});
    if (R && R.vehicle === v) { R.t0 -= 2; this.flash('GATE HIT', '+2.00', '#FF8A6A', 1.3); }
    else this.flash('GATE HIT', '', '#FF8A6A', 1);
  }
  boostRing(v, r) {
    if (this.t - this.boostT < 0.6) return;
    this.boostT = this.t;
    const f = v.fwd, sp = v.speed, add = Math.min(34, Math.max(0, 185 - sp));
    v.vel[0] += f[0] * add; v.vel[1] += f[1] * add; v.vel[2] += f[2] * add;
    v.boost = 1; if (v.fovS !== undefined) v.fovS += 10;
    this.g.shake = Math.max(this.g.shake || 0, 0.25);
    this.flash('BOOST', '', '#7FE8FF', 0.8);
    this.g.audio.play('sky_boost', {});
  }
  // ---------------------------------------------------------------- airfield servicing: stop on any runway or apron
  onPavement(x, z) {
    for (const inf of this.info.values()) {
      const a = inf.air; if (!a) continue;
      const dx = Math.floor(x) - a.x, dz = Math.floor(z) - a.z, al = dx * a.fx + dz * a.fz, b = dx * a.rx + dz * a.rz;
      if ((Math.abs(al) <= a.L + 1 && Math.abs(b) <= a.W + 1) || (b >= a.W + 1 && b <= a.W + 12 + a.AD && Math.abs(al) <= a.AA)) return a;
    }
    return null;
  }
  service(dt, v) {
    this.svc = null;
    if (!v || !v.onGround || v.speed > 1.5 || v.dead) { this.svcT = 0; this.svcNeed = 0; return; }
    const a = this.onPavement(v.x, v.z); if (!a) { this.svcT = 0; this.svcNeed = 0; return; }
    this.svcT += dt;
    if (this.svcT < 1) return;
    const full = v.hull >= v.def.hull;
    // the readout shows while something was actually repaired or reloaded, and for a couple of seconds after
    if (!full || (v.missiles !== undefined && v.missiles < 8) || (v.bombs !== undefined && v.bombs < 12) || (v.rockets !== undefined && v.rockets < 16) || v.heat > 0.05) this.svcNeed = 2.5;
    else if (this.svcNeed > 0) this.svcNeed -= dt;
    v.hull = Math.min(v.def.hull, v.hull + v.def.hull * 0.3 * dt);
    v.heat = 0; v.overheat = 0; v.boost = 1;
    if (v.missiles !== undefined) v.missiles = 8;
    if (v.bombs !== undefined) v.bombs = 12;
    if (v.rockets !== undefined) v.rockets = 16;
    if (v.sng !== undefined && typeof SNG !== 'undefined') v.sng = SNG.max;
    if (!full && this.svcT - dt < 1) this.g.audio.play('sky_service', {});
    this.svc = { air: a, f: v.hull / v.def.hull, need: this.svcNeed > 0 };
  }
  // ---------------------------------------------------------------- HUD (drawn on the vehicle HUD canvas)
  // screen position of a world point, or a spot on an ellipse near the screen edge pointing at it
  aim(H, x, y, z) {
    const R = this.g.renderer, m = R.vp, rx = x - R.camX, ry = y - R.camY, rz = z - R.camZ;
    const cw = m[3] * rx + m[7] * ry + m[11] * rz + m[15], cx = m[0] * rx + m[4] * ry + m[8] * rz + m[12], cy = m[1] * rx + m[5] * ry + m[9] * rz + m[13];
    if (cw > 0.05) {
      const sx = (cx / cw * 0.5 + 0.5) * H.w, sy = (0.5 - cy / cw * 0.5) * H.h;
      if (sx > 40 && sx < H.w - 40 && sy > 40 && sy < H.h - 40) return { x: sx, y: sy, on: true };
    }
    let dx = cx * Math.sign(cw || 1), dy = -cy * Math.sign(cw || 1);
    if (cw <= 0.05 && Math.abs(dx) + Math.abs(dy) < 1e-6) dy = 1;
    const a = Math.atan2(dy, dx);
    return { x: H.w / 2 + Math.cos(a) * (H.w / 2 - 46), y: H.h / 2 + Math.sin(a) * (H.h / 2 - 46), on: false, a };
  }
  marker(H, g, label, col, size, faint) {
    const s = this.aim(H, g.x, g.y, g.z), c = H.ctx, old = H.col;
    H.col = col;
    c.globalAlpha = faint ? 0.45 : 1;
    if (s.on) {
      const q = size;
      H.poly([s.x, s.y - q, s.x + q, s.y, s.x, s.y + q, s.x - q, s.y], true);
      if (!faint) { H.line(s.x - q - 6, s.y, s.x - q - 2, s.y); H.line(s.x + q + 2, s.y, s.x + q + 6, s.y); }
      if (label) H.text(label, s.x, s.y - q - H.fs * 0.9, 'center', H.fs * 0.85, col);
    } else if (!faint) {
      const a = s.a, k = 13;
      H.poly([s.x + Math.cos(a) * k, s.y + Math.sin(a) * k, s.x + Math.cos(a + 2.5) * k, s.y + Math.sin(a + 2.5) * k, s.x + Math.cos(a - 2.5) * k, s.y + Math.sin(a - 2.5) * k], true);
      if (label) H.text(label, s.x - Math.cos(a) * 30, s.y - Math.sin(a) * 18, 'center', H.fs * 0.8, col);
    }
    c.globalAlpha = 1; H.col = old;
    return s;
  }
  drawHUD(H, v) {
    if (!this.sky || this.g.world.dim !== 'overworld') return;
    const fs = H.fs, W = H.w, Hh = H.h, R = this.run, dist = (g) => Math.hypot(g.x - v.x, g.y - v.y, g.z - v.z), km = (d) => d >= 1000 ? (d / 1000).toFixed(1) + 'km' : Math.round(d) + 'm';
    if (R) {
      const C = R.course, n = C.gates.length - 1, g = C.gates[R.i], g2 = C.gates[R.i + 1];
      if (g2) {
        const a = this.aim(H, g.x, g.y, g.z), b = this.aim(H, g2.x, g2.y, g2.z);
        if (a.on && b.on) { const c = H.ctx; c.save(); c.setLineDash([6, 8]); c.globalAlpha = 0.5; H.col = '#FFD27A'; H.line(a.x, a.y, b.x, b.y); c.restore(); }
        this.marker(H, g2, '', '#FFD27A', 7, true);
      }
      if (g) this.marker(H, g, (g.k === 2 ? 'FINISH' : 'GATE ' + R.i) + '  ' + km(dist(g)), g.k === 2 ? '#FFFFFF' : '#FFB347', clamp(900 / Math.max(dist(g), 1), 9, 26));
      // the run panel, top right
      const x = W - fs * 1.4, y = fs * 5.2, t = this.t - R.t0, rec = this.records()[C.id];
      const c = H.ctx; c.globalAlpha = 0.45; c.fillStyle = '#05080a'; c.fillRect(x - fs * 15, y - fs * 1.3, fs * 15.4, fs * (rec ? 6.4 : 5.2)); c.globalAlpha = 1;
      H.text(C.name.toUpperCase(), x, y, 'right', fs * 0.8, '#FFD27A');
      H.text(skyTime(t), x, y + fs * 1.6, 'right', fs * 1.6, '#FFFFFF');
      H.text('GATE ' + Math.min(R.i, n) + ' / ' + n, x, y + fs * 3.2, 'right', fs * 0.85, '#FFB347');
      if (rec) H.text('BEST ' + skyTime(rec.t), x, y + fs * 4.4, 'right', fs * 0.8, '#A8D8FF');
    } else {
      // courses to try: the nearest start gate named, the others just marked
      const n = this.nearestCourse(v.x, v.z);
      for (const inf of this.info.values()) {
        const C = inf.course; if (!C) continue;
        const g = C.gates[0], d = dist(g), near = n && n.course === C;
        if (near && d < 2500) { const rec = this.records()[C.id]; this.marker(H, g, '▶ ' + C.name.toUpperCase() + '  ' + km(d) + (rec ? '  ★ ' + skyTime(rec.t) : ''), '#7CFF8A', clamp(700 / Math.max(d, 1), 7, 18), false); }
        else if (d < 1100) this.marker(H, g, '', '#7CFF8A', 6, true);
      }
    }
    for (const inf of this.info.values()) {
      const C = inf.course; if (!C) continue;
      for (const r of C.boosts) { const d = dist(r); if (d < 450 && d > 20) this.marker(H, r, '', '#7FE8FF', 6, true); }
    }
    // the nearest airfield, while flying
    if (!v.onGround) {
      const n = this.nearestAirfield(v.x, v.z);
      if (n && n.dist > 250) { const a = n.air; this.marker(H, { x: a.x, y: a.y + 2, z: a.z }, '✈ RWY ' + a.rwy + '  ' + km(n.dist), '#9FD3FF', 6, n.dist > 2500); }
    }
    if (this.svc && this.svc.need) H.text(this.svc.f < 1 ? 'SERVICING  HULL ' + Math.round(this.svc.f * 100) + '%' : 'SERVICED  ·  READY', W / 2, Hh * 0.62, 'center', fs * 1.1, this.svc.f < 1 ? '#FFD27A' : '#7CFF8A');
    // centre flash
    const m = this.msg;
    if (m) {
      const a = Math.min(1, m.t / 0.35, (m.d - m.t) / 0.12 + 0.2), c = H.ctx;
      c.globalAlpha = a; H.text(m.text, W / 2, Hh * 0.27, 'center', fs * 2.0, m.col);
      if (m.sub) H.text(m.sub, W / 2, Hh * 0.27 + fs * 2.1, 'center', fs * 1.15, m.col);
      c.globalAlpha = 1;
    }
  }
  // ---------------------------------------------------------------- commands: /course, /airfield, /skyways
  command(c, a) {
    const g = this.g, ui = g.ui, p = g.player, S = this.sky;
    if (c === 'skyways') { const z = S.zoneAt(p.x, p.z).cell; ui.message(`Skyways map level ${S.level} (${SKY_LEVELS[S.level - 1]})${S.varied ? ', difficulty varies by region' : ''}. You are in ${z.name}: ${z.label}, level ${z.lv}.`, '#afa'); return; }
    if (!this.info.size) throw 'Still charting the area, try again in a moment';
    if (c === 'airfield') { const n = this.nearestAirfield(p.x, p.z); if (!n) throw 'No airfield charted nearby yet'; ui.message([`${n.air.name} (runway ${n.air.rwy}) is at `, ui.tpLink(n.air.x, n.air.z), ` (${Math.round(n.dist)} blocks away)`], '#afa'); return; }
    const sub = a[1];
    if (sub === 'stop' || sub === 'reset') { ui.message(this.run ? 'Run cancelled' : 'No run in progress'); this.run = null; return; }
    if (sub === 'go') {
      // a jet lined up on the nearest start gate, held in the air until the ground around it has loaded
      const n = this.nearestCourse(p.x, p.z); if (!n) throw 'No course charted nearby yet';
      const kind = { jet: 'jet', stormcrow: 'jet', fighter: 'fighter', eclipse: 'fighter', bomber: 'bomber', wraith: 'bomber', gunship: 'gunship', mantis: 'gunship' }[a[2]] || (p.vehicle && VEH_DEFS[p.vehicle.kind] ? p.vehicle.kind : 'jet');
      if (this.lineUp(n.course, kind)) ui.message('Lined up on ' + n.course.name + '. Fly through the green gate to start; Backspace retries.', '#7CFF8A');
      return;
    }
    const list = [...this.info.values()].filter(i => i.course).map(i => ({ C: i.course, d: Math.hypot(i.course.gates[0].x - p.x, i.course.gates[0].z - p.z) })).sort((q, r) => q.d - r.d);
    for (const { C, d } of list.slice(0, 5)) {
      const rec = this.records()[C.id], g0 = C.gates[0];
      ui.message([`${C.name}: ${C.gates.length - 1} gates, ${(C.len / 1000).toFixed(1)} km, gold ${skyTime(C.par[0])}${rec ? ', best ' + skyTime(rec.t) + (rec.medal ? ' ' + rec.medal.toLowerCase() : '') : ''}. Start gate `, ui.tpLink(Math.round(g0.x), Math.round(g0.z)), ` (${Math.round(d)} blocks)`], '#cfe6ff');
    }
    ui.message('/course go lines you up on the nearest start gate in a jet; /course stop cancels a run.', '#aaa');
  }
  // Backspace: back to the start of the last course in a fresh aircraft of the same kind (creative, or commands on)
  retry() {
    const g = this.g, p = g.player, C = this.lastCourse;
    if (!C || g.state !== 'playing' || g.ui.open || g.ui.chatOpen || !p || p.dead || g.world.dim !== 'overworld') return;
    if (!this.canRetry()) { g.ui.message('Retrying a course needs creative mode or commands', '#f88'); return; }
    this.lineUp(C, this.lastKind || 'jet');
  }
  // a fresh aircraft just short of a course's start gate, held in the air until the ground around it has loaded
  lineUp(C, kind) {
    const g = this.g, p = g.player, g0 = C.gates[0], x = g0.x - g0.nx * 45, z = g0.z - g0.nz * 45, yaw = Math.atan2(g0.nx, -g0.nz);
    const old = p.vehicle;
    if (old) { old.dismount(true); if (old === this.retryVeh) old.removed = true; }
    else if (this.retryVeh && !this.retryVeh.rider) this.retryVeh.removed = true;
    g.putPlayer(x, g0.y, z);
    const v = spawnVehicle(g.world, kind, x, g0.y - 0.8, z, yaw); if (!v) return null;
    v.onGround = false; v.gear = 0; v.throttle = 0.8; v.vel[0] = g0.nx * 70; v.vel[2] = g0.nz * 70; v.mount(p); v.mountT = 0;
    this.hold = { v, x: v.x, y: v.y, z: v.z, vel: v.vel.slice(), q: v.q.slice(), t: 0 };
    this.retryVeh = v; this.run = null; this.lastCourse = C; this.lastKind = kind;
    this.flash(C.name.toUpperCase(), 'THROUGH THE GREEN GATE TO START', '#7CFF8A', 2);
    return v;
  }
  // keep a freshly placed jet still until the chunks around it are ready
  holdTick(v) {
    const H = this.hold, w = this.g.world;
    if (!v || v !== H.v) { this.hold = null; return; }
    let ready = true;
    const cx = Math.floor(H.x) >> 4, cz = Math.floor(H.z) >> 4;
    for (let dz = -2; dz <= 2 && ready; dz++) for (let dx = -2; dx <= 2; dx++) { const c = w.getChunk(cx + dx, cz + dz); if (!c || !c.meshable) { ready = false; break; } }
    H.t += 1 / 60;
    if (ready || H.t > 20) { this.hold = null; return; }
    v.x = v.lx = H.x; v.y = v.ly = H.y; v.z = v.lz = H.z; v.vel[0] = H.vel[0]; v.vel[1] = H.vel[1]; v.vel[2] = H.vel[2];
    v.q[0] = H.q[0]; v.q[1] = H.q[1]; v.q[2] = H.q[2]; v.q[3] = H.q[3]; v.updateAxes();
    if (v.rider) v.syncRider(v.rider);
  }
  // ---------------------------------------------------------------- the first flight: sat on the home runway
  async cockpitStart() {
    const g = this.g, p = g.player, S = this.sky; if (!S) return;
    const [x, y, z, yaw] = S.homeRunway(), w = g.world, af = S.airfield(S.cell(0, 0));
    for (const e of w.entities) if (e.isVehicle && !e.removed && Math.hypot(e.x - x, e.z - z) < 8) e.removed = true;
    const v = spawnVehicle(w, 'jet', x, y + 0.02, z, yaw);
    if (!v) return;
    v.mount(p); v.mountT = 12;
    g.ui.message(`Cleared for takeoff, runway ${S.rwyNum(af.fx, af.fz)}: W for throttle, hold Ctrl for afterburner, pull up past 190 kph. Fly through the green gate ahead to start ${S.cell(0, 0).courseName}.`, '#ffd24a');
    g.ui.message('F leaves the jet, F5 switches to the cockpit. Land on any runway or apron and stop to repair and rearm.', '#cfe6ff');
  }
}
