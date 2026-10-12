// ============================================================================
//  SKYWAYS (2/2): airfields, race courses, tunnels, and building the chunks.
//  Every region gets an airstrip (spawn gets a whole airbase) and a course of glowing ring gates laid through its
//  signature terrain: down the centre line of a canyon (under its arches), a slalom between spires (through their
//  windows, under their bridges), a circuit through hoops and under islands, a dash through tunnels bored along the
//  course itself, or a loop over the meadows past rock pillars and arches built around the gates. Every gate is
//  checked for clear air around its ring and along its approach before it is kept.
// ============================================================================
// 3x5 digits for runway designators, top row first
const SKY_DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
const SKY_GATE_MATS = [   // [segment A, segment B, light] for course gates, start, finish and boost rings
  ['orange_concrete', 'white_concrete', 'sea_lantern'], ['lime_concrete', 'white_concrete', 'verdant_froglight'],
  ['black_concrete', 'white_concrete', 'pearlescent_froglight'], ['cyan_concrete', 'light_blue_concrete', 'sea_lantern']];
function skyAngle(a, b) { let d = b - a; while (d > Math.PI) d -= SKY_TAU; while (d < -Math.PI) d += SKY_TAU; return d; }

class SkyGen extends SkyBase {
  constructor(gen, o) {
    super(gen, o);
    this.spirePal = [B.stone, B.andesite, B.stone, B.calcite, B.stone, B.andesite, B.tuff, B.stone];
    this.needlePal = [B.stone, B.andesite, B.tuff, B.stone, B.cobblestone, B.andesite];
    this.fjordPal = [B.stone, B.stone, B.andesite, B.stone, B.diorite, B.stone, B.blue_ice, B.stone, B.andesite, B.calcite, B.stone, B.tuff];
    this.gateMats = SKY_GATE_MATS.map(m => m.map(n => B[n]));
  }
  // ================================================================ airfields
  // one per region: spawn's is a full airbase, the others an airstrip with a hangar. Placed where the ground is
  // flattest and the approach paths need the least cutting, with the runway on a grid axis so its markings stay
  // crisp. The departure end faces the more open approach.
  airfield(c) {
    if (c.air !== undefined) return c.air;
    c.air = null;
    const r = new RNG(hash2(this.seed ^ 0xA1F1E1D, c.i, c.j)), home = c.home, d = c.d;
    const L = home ? 104 : Math.round(lerp(92, 60, d)), W = home ? 8 : d < 0.5 ? 6 : 5;
    const AD = home ? 30 : 16, AA = home ? 62 : 26, HD = home ? 24 : 13;
    const padA = L + 14, padB0 = -W - 10, padB1 = W + 12 + AD + HD + 4;
    const lagoon = c.type === SKZ.SPIRES && !c.sv;
    const cands = [[c.x, c.z]];
    if (!home) for (const rad of [70, 140, 200]) for (let k = 0; k < 7; k++) { const a = (k + r.next() * 0.6) / 7 * SKY_TAU; cands.push([c.x + Math.cos(a) * rad, c.z + Math.sin(a) * rad]); }
    let best = null, bc = 1e18;
    for (const [px, pz] of cands) for (let ax = 0; ax < 2; ax++) {
      const cx = Math.round(px), cz = Math.round(pz), fx = ax ? 0 : 1, fz = ax ? 1 : 0, rx = -fz, rz = fx;
      let sum = 0, n = 0, bad = 0;
      const hs = [];
      for (let a = -padA; a <= padA; a += 16) for (let b = padB0; b <= padB1; b += 12) {
        const nc = this.natCol(cx + a * fx + b * rx, cz + a * fz + b * rz);
        if (!home && (nc.cell !== c || nc.tw[c.type] < 0.55)) bad++;
        let hh = nc.hn; if (lagoon && hh < SEA + 1) hh = SEA + 1.5;
        hs.push(hh); sum += hh; n++;
      }
      const mean = sum / n, y0 = Math.max(SEA + 2, Math.round(mean));
      let dev = 0; for (const hh of hs) dev += Math.abs(hh - mean);
      const cut = [0, 0];
      for (let e = 0; e < 2; e++) for (let ae = 10; ae <= 370; ae += 30) for (const b of [0, -(W + 12), W + 12]) {
        const a = (e ? 1 : -1) * (padA + ae), hh = this.natCol(cx + a * fx + b * rx, cz + a * fz + b * rz).hn, cap = y0 + 2 + ae * 0.14;
        if (hh > cap) cut[e] += hh - cap;
      }
      // the course starts ~200 blocks off the departure end (which faces the middle): keep that well inside the region
      const along = ax ? c.z - cz : c.x - cx, sg = along >= 0 ? 1 : -1, sx = cx + fx * sg * (padA + 200), sz = cz + fz * sg * (padA + 200);
      const cost = dev / n * 10 + (cut[0] + cut[1]) * 0.12 + bad * 40 + Math.hypot(cx - c.x, cz - c.z) * 0.02 + (home ? 0 : Math.max(0, Math.hypot(sx - c.x, sz - c.z) - 220) * 0.15);
      if (cost < bc) { bc = cost; best = { cx, cz, ax, y0, cut }; }
    }
    if (!best || (!home && bc > 420)) return null;
    // take off toward the middle of the region (its course starts straight off the runway), or toward the more open
    // end when the strip sits in the middle; home picks either
    const along = best.ax ? c.z - best.cz : c.x - best.cx;
    const s = home ? (r.next() < 0.5 ? 1 : -1) : Math.abs(along) > 40 ? Math.sign(along) : (best.cut[1] < best.cut[0] * 0.8 ? 1 : best.cut[0] < best.cut[1] * 0.8 ? -1 : r.next() < 0.5 ? 1 : -1);
    const fx = best.ax ? 0 : s, fz = best.ax ? s : 0;
    return c.air = { x: best.cx, z: best.cz, fx, fz, rx: -fz, rz: fx, L, W, AD, AA, HD, padA, padB0, padB1, y: best.y0, home,
      i: c.i, j: c.j, name: home ? 'Skyhaven Airbase' : c.name + ' Airstrip', d };
  }
  // heading (degrees, north = 360) of a runway direction, and its two-digit designator
  rwyNum(fx, fz) { const deg = Math.round((Math.atan2(fx, -fz) / SKY_TAU * 360 + 360) % 360); return String(Math.round(deg / 10) || 36).padStart(2, '0'); }
  // ================================================================ region plans: course, tunnels, course features
  plan(c) {
    if (c.plan) return c.plan;
    const P = c.plan = { c, gates: [], boosts: [], tubes: [], feats: [], len: 0, ok: false };
    const af = this.airfield(c);
    if (!af) return P;
    const rnd = new RNG(hash2(this.seed ^ 0xC0E5E, c.i, c.j)), d = c.d;
    P.R = lerp(13, 6.2, d) + (c.home ? 2.5 : 0);
    P.N = c.home ? 10 : Math.round(lerp(12, 16, d));
    P.gap = lerp(150, 98, d);
    // canyon gates come closer together, so the line through them keeps to the winding canyon
    if (c.type === SKZ.CANYON) { P.gap *= 0.62; P.N += 5; }
    if (this.startGate(P, af)) {
      if (c.type === SKZ.HOME || c.type === SKZ.MEADOW) this.trackLoop(P, af, rnd);
      else if (c.type === SKZ.CANYON) this.trackCanyon(P, rnd);
      else if (c.type === SKZ.SPIRES) this.trackSpires(P, rnd);
      else if (c.type === SKZ.ISLES) this.trackIsles(P, rnd);
      else this.trackPeaks(P, rnd);
    }
    if (c.type === SKZ.PEAKS) this.freeTunnels(P, rnd);
    const G = P.gates;
    if (G.length >= 5) {
      P.ok = true;
      G[0].k = 1; G[G.length - 1].k = 2;
      for (let i = 0; i < G.length; i++) G[i].i = i;
      let len = 0;
      for (let i = 1; i < G.length; i++) len += G[i].seg || Math.hypot(G[i].x - G[i - 1].x, G[i].y - G[i - 1].y, G[i].z - G[i - 1].z) * 1.06;
      P.len = len;
      const gold = len / lerp(96, 84, d);
      P.par = [gold, gold * 1.2, gold * 1.45];
      this.addBoosts(P, rnd);
    } else P.gates = [];
    return P;
  }
  // the gates' (and course features') bounding box, for quick rejection
  planBox(P) {
    if (P.box) return P.box;
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    const add = (x, z, r) => { if (x - r < x0) x0 = x - r; if (z - r < z0) z0 = z - r; if (x + r > x1) x1 = x + r; if (z + r > z1) z1 = z + r; };
    for (const g of P.gates) add(g.x, g.z, g.R + 4);
    for (const g of P.boosts) add(g.x, g.z, g.R + 4);
    for (const f of P.feats) add(f.x, f.z, f.reach);
    for (const t of P.tubes) { add(t.x0, t.z0, 0); add(t.x1, t.z1, 0); }
    return P.box = [x0, z0, x1, z1];
  }
  addGate(P, x, y, z, nx, nz, R, seg) { const g = { x, y, z, nx, nz, R, k: 0 }; if (seg) g.seg = seg; P.gates.push(g); return g; }
  // clear air around a gate's ring, through its middle and along its approach and exit (ignores the course's own
  // features, which are built around the gates)
  gateClear(P, x, y, z, nx, nz, R, own) {
    const Ro = R + 1.8, ux = -nz, uz = nx, d = P.c.d;
    if (y - Ro < SEA + 1.5 || y + Ro > CH - 3) return false;
    const Q = own ? null : P;
    // the harder the map, the closer a gate may hang to rock and the shorter the straight run at it
    const m = lerp(2.5, 1.3, d), L = lerp(24, 16, d);
    for (let k = 0; k < 16; k++) {
      const t = k / 16 * SKY_TAU, cu = Math.cos(t), rr = Ro + m;
      if (this.solidAt(x + ux * cu * rr, y + Math.sin(t) * rr, z + uz * cu * rr, Q)) return false;
    }
    for (const off of [-L, -L / 2, 0, L / 2, L]) for (let k = 0; k < 5; k++) {
      const cu = k === 1 ? 0.65 : k === 2 ? -0.65 : 0, cv = k === 3 ? 0.65 : k === 4 ? -0.65 : 0;
      if (this.solidAt(x + nx * off + ux * cu * R, y + cv * R, z + nz * off + uz * cu * R, Q)) return false;
    }
    for (const g of P.gates) if (Math.hypot(g.x - x, g.y - y, g.z - z) < 40) return false;
    return true;
  }
  // heading on arrival after a circular turn out of gate g toward a target in direction (cx, cz): the way out of g
  // reflected across the chord
  arrival(g, cx, cz) { const d = g.nx * cx + g.nz * cz; let ax = 2 * d * cx - g.nx, az = 2 * d * cz - g.nz; const l = Math.hypot(ax, az) || 1; return [ax / l, az / l]; }
  ideal(g, cx, cz, tx, tz) { const [ax, az] = this.arrival(g, cx, cz), bx = ax + tx, bz = az + tz, l = Math.hypot(bx, bz); return l > 0.2 ? [bx / l, bz / l] : [ax, az]; }
  // how many rock samples the way into a gate may cross (a slalom bends round the odd rock; needle forests more)
  arcAllow(P, g, x, z) { return Math.max(1, Math.floor(Math.max(4, Math.ceil(Math.hypot(x - g.x, z - g.z) / 10)) * (P.c.sv ? 0.35 : 0.2))); }
  // the curve a pilot flies from gate g into a gate at (x, y, z) facing (nx, nz): a Hermite curve with the gates'
  // facings as tangents, sampled every ~10 blocks. How many samples run through rock (spires, islands), or -1 when
  // it runs into the ground
  arcBad(P, g, x, y, z, nx, nz) {
    const L = Math.hypot(x - g.x, z - g.z), T = L * 0.9, n = Math.max(4, Math.ceil(L / 10));
    let bad = 0;
    for (let k = 1; k < n; k++) {
      const s = k / n, s2 = s * s, s3 = s2 * s, h1 = 2 * s3 - 3 * s2 + 1, h2 = -2 * s3 + 3 * s2, h3 = s3 - 2 * s2 + s, h4 = s3 - s2;
      const px = h1 * g.x + h2 * x + (h3 * g.nx + h4 * nx) * T, pz = h1 * g.z + h2 * z + (h3 * g.nz + h4 * nz) * T, py = h1 * g.y + h2 * y;
      // the ground (a canyon wall, a ridge) is a hard no; a slalom may have to bend round a rock or two
      const c = this.g.climateCached(Math.floor(px), Math.floor(pz));
      if (py < c.h + (c.cs >= 0 ? 6 : 3) && !(P.tubes.length && this.inTubes(P, px, py, pz))) return -1;
      if (this.solidAt(px, py, pz, P)) bad++;
    }
    return bad;
  }
  // the first gate hangs straight off the departure end, a little above the climb-out
  startGate(P, af) {
    // (from a mountaintop strip the course may start below the runway: off the edge and down)
    for (const dist of [200, 240, 170, 290, 350]) for (const up of [30, 40, 52, 22, 66, 10, -6, -22, -40]) {
      const x = af.x + af.fx * (af.padA + dist), z = af.z + af.fz * (af.padA + dist), y = Math.min(af.y + up, CH - P.R - 6);
      if (this.gateClear(P, x, y, z, af.fx, af.fz, P.R)) { this.addGate(P, x, y, z, af.fx, af.fz, P.R); return true; }
    }
    return false;
  }
  inRegion(P, x, z, w) { const n = this.natCol(Math.floor(x), Math.floor(z)); return n.cell === P.c && n.tw[P.c.type] >= (w || 0.6); }
  // lowest gate centre that clears the ground (and the trees on it) at a spot
  floorY(x, z, R) { const c = this.g.climateCached(Math.floor(x), Math.floor(z)); return Math.max(c.h, SEA) + R + 1.8 + (BIOMES[c.biome].trees > 0 && !c.af ? 14 : 5); }
  // ---------------------------------------------------------------- meadows and home: a racetrack loop around the airfield
  // out off the departure end, around a wide loop to one side and back down the approach to land. A few gates are
  // dressed with rock pillars, a stone ring or an arch built around them.
  trackLoop(P, af, rnd) {
    const c = P.c, d = c.d, side = rnd.next() < 0.5 ? 1 : -1, A = af.padA, R = P.R;
    const j = () => (rnd.next() - 0.5) * 60, w = c.home ? 0.8 : 1.05;
    const ab = [[A - 20, 0], [A + 200, 0], [A + 290 + j(), side * (140 + j()) * w], [A + 190 + j(), side * (300 + j()) * w], [j(), side * (350 + j() * 0.8) * w],
      [-A - 190 + j(), side * (300 + j()) * w], [-A - 290 + j(), side * (140 + j()) * w], [-A - 210, 0], [-A, 0]];
    const pts = ab.map(([a, b]) => [af.x + a * af.fx + b * af.rx, af.z + a * af.fz + b * af.rz]);
    // Catmull-Rom through the control points (the end points only steer the tangents at the first and last gate)
    const path = [];
    for (let i = 1; i < pts.length - 2; i++) {
      const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
      for (let k = 0; k < 24; k++) {
        const t = k / 24, t2 = t * t, t3 = t2 * t;
        const f = (a, b2, cc, dd) => 0.5 * (2 * b2 + (cc - a) * t + (2 * a - 5 * b2 + 4 * cc - dd) * t2 + (3 * b2 - a - 3 * cc + dd) * t3);
        path.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    path.push(pts[pts.length - 2]);
    const arc = [0]; for (let i = 1; i < path.length; i++) arc.push(arc[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const total = arc[arc.length - 1], N = P.N, at = (s) => {
      let i = 1; while (i < arc.length - 1 && arc[i] < s) i++;
      const t = (s - arc[i - 1]) / Math.max(1e-6, arc[i] - arc[i - 1]), a = path[i - 1], b2 = path[i], tl = Math.hypot(b2[0] - a[0], b2[1] - a[1]) || 1;
      return [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, (b2[0] - a[0]) / tl, (b2[1] - a[1]) / tl];
    };
    // dressed gates: which ones, and with what
    const kinds = ['pillars', 'henge', 'garch'], dress = new Map();
    const nd = c.home ? 3 : 2 + Math.round(d * 2);
    for (let k = 0; k < nd; k++) dress.set(2 + Math.floor((k + 0.5) / nd * (N - 4)) + (rnd.next() < 0.5 ? 0 : 1), kinds[(k + rnd.int(3)) % 3]);
    for (let k = 1; k < N; k++) {
      const last = k === N - 1, [x, z, tx, tz] = at(total * k / (N - 1));
      const g0 = this.floorY(x, z, R), base = last ? Math.max(af.y + 16 + R, g0) : Math.max(g0, Math.max(this.g.climateCached(Math.floor(x), Math.floor(z)).h, SEA) + lerp(30, 16, d) + R + rnd.next() * 10);
      let placed = null;
      for (let up = 0; up <= 48 && !placed; up += 6) {
        const y = base + up;
        if (this.gateClear(P, x, y, z, tx, tz, R)) placed = this.addGate(P, x, y, z, tx, tz, R);
      }
      if (!placed) continue;
      const kind = dress.get(k);
      if (kind && !last) this.dressGate(P, placed, kind, rnd);
    }
  }
  // build rock pillars, a stone ring or an arch around a meadow gate (they stand on the ground: skipped when the gate
  // floats too high above it)
  dressGate(P, g, kind, rnd) {
    const ground = this.g.climateCached(Math.floor(g.x), Math.floor(g.z)).h, R = g.R;
    // a stone ring must fit in clear air (it is wider than the gate); otherwise the gate gets pillars instead
    if (kind === 'henge') {
      const ro = R + 3.6 + 3 + 1.5;
      for (let k = 0; k < 16 && kind === 'henge'; k++) { const t = k / 16 * SKY_TAU; if (this.solidAt(g.x - g.nz * Math.cos(t) * ro, g.y + Math.sin(t) * ro, g.z + g.nx * Math.cos(t) * ro, P)) kind = 'pillars'; }
    }
    if (g.y - R - ground > 30 && kind !== 'henge') return;
    if (kind === 'pillars') P.feats.push({ k: 'pillars', x: g.x, z: g.z, y0: Math.floor(ground) - 3, y1: Math.round(g.y + R + 7), ux: -g.nz, uz: g.nx, off: R + 4.6, pr: 2.6, reach: R + 9 });
    else if (kind === 'henge') P.feats.push({ k: 'henge', x: g.x, z: g.z, reach: R + 9, h: { x: g.x, y: g.y, z: g.z, Ri: R + 3.6, wr: 3, th: 1.8, nx: g.nx, nz: g.nz, salt: rnd.u32() } });
    else P.feats.push({ k: 'garch', x: g.x, z: g.z, y0: Math.floor(ground) - 2, yA: g.y + R + 4.5, span: R + 13, nx: g.nx, nz: g.nz, th: 4.5, w: 2.6, reach: R + 15 });
  }
  // ---------------------------------------------------------------- canyons: down the centre line, under the arches
  trackCanyon(P, rnd) {
    const c = P.c, R = P.R, N = P.N, old = new Map();
    let from = P.gates[0], lastS = 0, arc0 = 0;
    // up to three traces in a row: when one runs out (the region ends, or it would double back), the next picks up a
    // canyon near where it stopped
    for (let seg = 0; seg < 3 && P.gates.length < N; seg++) {
      const starts = [], ahead = seg ? 40 : 140;
      for (let k = 0; k < 90 && starts.length < 6; k++) {
        const a = k * 2.39996, rad = 30 + k * 8, fam = seg && (k & 1) ? 1 : 0;
        const q = this.snapCanyon(from.x + from.nx * ahead + Math.cos(a) * rad, from.z + from.nz * ahead + Math.sin(a) * rad, fam);
        if (!q) continue;
        const n = this.natCol(q[0], q[1]);
        if (n.cell !== c || n.tw[SKZ.CANYON] < 0.8 || n.cP - n.cFloor < 30 || old.has(Math.floor(q[0] / 40) * 8192 + Math.floor(q[1] / 40))) continue;
        if (starts.some(t => Math.hypot(t[0] - q[0], t[1] - q[1]) < 60)) continue;
        starts.push([q[0], q[1], fam]);
      }
      // each start both ways; keep the longest that starts near here and heads on, not back
      let run = null, bs = -1e9;
      for (const st of starts) for (const sg of [1, -1]) {
        const t = this.traceCanyon(P, st, sg, rnd.u32(), old), p = t.pts[Math.min(t.pts.length - 1, 12)];
        const fwd = ((p[0] - st[0]) * from.nx + (p[1] - st[1]) * from.nz) / (Math.hypot(p[0] - st[0], p[1] - st[1]) || 1);
        const sc = Math.min(t.len, (N - P.gates.length + 1) * P.gap) - Math.hypot(st[0] - from.x, st[1] - from.z) * 0.5 + fwd * 60;
        if (sc > bs) { bs = sc; run = t; }
      }
      if (!run || run.len < 150) break;
      for (const p of run.pts) { const k = Math.floor(p[0] / 40) * 8192 + Math.floor(p[1] / 40); if (!old.has(k)) old.set(k, 1); }
      // gates along the trace, under any arch they pass
      const pts = run.pts;
      let next = Math.max(40, P.gap * 0.7 - Math.hypot(pts[0][0] - from.x, pts[0][1] - from.z));
      for (let i = 1; i < pts.length && P.gates.length < N; i++) {
        const p = pts[i]; if (p[3] < next) continue;
        const q = pts[Math.max(0, i - 2)], w = pts[Math.min(pts.length - 1, i + 2)];
        let tx = w[0] - q[0], tz = w[1] - q[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        let x = p[0], z = p[1], y = null;
        const n = this.natCol(Math.floor(x), Math.floor(z)), floor = Math.max(n.hn, SEA);
        const arch = this.archNear(x, z, 34);
        if (arch) {
          // straight under the arch if it leaves room, otherwise over it
          const under = arch.Ya - 1, room = under - Math.max(arch.F, SEA);
          x = arch.x; z = arch.z; const sgn = tx * arch.tx + tz * arch.tz < 0 ? -1 : 1; tx = arch.tx * sgn; tz = arch.tz * sgn;
          const cy = room > 2 * (R + 1.8) + 6 ? (Math.max(arch.F, SEA) + under) / 2 : arch.Ya + arch.T + R + 6;
          if (this.gateClear(P, x, cy, z, tx, tz, R)) y = cy;
        }
        if (y === null) for (let yy = floor + R + 4 + rnd.next() * lerp(12, 3, c.d); yy < n.cP + 14; yy += 3) if (this.gateClear(P, x, yy, z, tx, tz, R)) { y = yy; break; }
        if (y === null) { next = p[3] + 12; continue; }
        const s = arc0 + p[3];
        from = this.addGate(P, x, y, z, tx, tz, R, lastS > 0 ? s - lastS : 0);
        lastS = s; next = p[3] + P.gap * (0.85 + rnd.next() * 0.3);
      }
      arc0 += run.len + 200;
      lastS = 0;
    }
  }
  archNear(x, z, r) {
    const gi = Math.floor(x / 210), gj = Math.floor(z / 210);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = this.arch(gi + di, gj + dj); if (a && Math.hypot(a.x - x, a.z - z) < r) return a; }
    return null;
  }
  // walk a canyon centre line in 6-block steps, pulled back onto it each step. Where a side canyon crosses, it may
  // turn into it (always, when the main canyon is about to leave the region). Returns points [x, z, family, arc]
  traceCanyon(P, st, sg, seed, old) {
    const rnd = new RNG(seed), c = P.c, pSwitch = 0.2 + c.d * 0.35, want = P.N * P.gap + 200;
    let x = st[0], z = st[1], fam = st[2] || 0, [, gx, gz] = this.cgrad(x, z, fam), gl = Math.hypot(gx, gz) || 1;
    let tx = -gz / gl * sg, tz = gx / gl * sg, arc = 0, other = Math.sign(this.cfv(x, z)[1 - fam]) || 1, cool = 0;
    const pts = [[x, z, fam, 0]], seen = new Map(), cellOf = (px, pz) => Math.floor(px / 40) * 8192 + Math.floor(pz / 40);
    // somewhere this trace has already been (more than ~120 blocks back along it), or an earlier trace went
    const been = (px, pz, step) => { const k = cellOf(px, pz), s = seen.get(k); return (s !== undefined && step - s > 20) || (old && old.has(k) && step > 6); };
    for (let step = 0; step < 1200 && arc < want; step++) {
      const xi = Math.round(x), zi = Math.round(z);
      [, gx, gz] = this.cgrad(xi, zi, fam); gl = Math.hypot(gx, gz);
      if (gl < 1e-7) break;
      let nx = -gz / gl, nz = gx / gl; if (nx * tx + nz * tz < 0) { nx = -nx; nz = -nz; }
      tx = nx; tz = nz; x += tx * 6; z += tz * 6; arc += 6;
      for (let k = 0; k < 2; k++) {
        const [v, hx, hz] = this.cgrad(Math.round(x), Math.round(z), fam), h2 = hx * hx + hz * hz;
        if (h2 > 1e-12) { x -= clamp(v * hx / h2, -4, 4); z -= clamp(v * hz / h2, -4, 4); }
      }
      const ahead = this.inRegion(P, x + tx * 70, z + tz * 70, 0.75) && !been(x + tx * 50, z + tz * 50, step);
      if (!this.inRegion(P, x, z, 0.7) || been(x, z, step)) break;
      const ck = cellOf(x, z); if (!seen.has(ck)) seen.set(ck, step);
      // crossing the other family's canyon?
      const o = Math.sign(this.cfv(Math.round(x), Math.round(z))[1 - fam]) || 1;
      if (o !== other && cool <= 0 && (!ahead || rnd.next() < pSwitch)) {
        const f2 = 1 - fam, [, ax, az] = this.cgrad(Math.round(x), Math.round(z), f2), al = Math.hypot(ax, az);
        if (al > 1e-7) {
          let mx = -az / al, mz = ax / al;
          // into the region: toward its centre if the old line was leaving, else the smaller turn
          const tcx = c.x - x, tcz = c.z - z;
          if (!ahead ? mx * tcx + mz * tcz < 0 : mx * tx + mz * tz < 0) { mx = -mx; mz = -mz; }
          if (this.inRegion(P, x + mx * 70, z + mz * 70, 0.75) && !been(x + mx * 50, z + mz * 50, step)) { fam = f2; tx = mx; tz = mz; cool = 12; }
        }
      }
      other = Math.sign(this.cfv(Math.round(x), Math.round(z))[1 - fam]) || 1;
      cool--;
      pts.push([x, z, fam, arc]);
    }
    return { pts, len: arc };
  }
  // ---------------------------------------------------------------- the guide: a wobbly loop around the middle of the
  // region from the start gate, so a course never wanders off. Points every ~8 blocks: [x, z, tx, tz, arc]
  loopGuide(P, g0, rnd, want) {
    const c = P.c, p1 = [g0.x + g0.nx * 130, g0.z + g0.nz * 130], a1 = Math.atan2(p1[1] - c.z, p1[0] - c.x);
    // go round the way the start gate already leans (either way when it points straight out or in)
    const tan = skyAngle(Math.atan2(g0.z - c.z, g0.x - c.x), a1), dir = Math.abs(tan) > 0.05 ? Math.sign(tan) : (rnd.next() < 0.5 ? 1 : -1);
    // a gentle bend off the start line into the loop
    const sx = -g0.nz * dir, sz = g0.nx * dir, side = (sx * (c.x - p1[0]) + sz * (c.z - p1[1])) >= 0 ? 1 : -1;
    const p2 = [p1[0] + g0.nx * 80 + sx * side * 55, p1[1] + g0.nz * 80 + sz * side * 55];
    const ctrl = [[g0.x - g0.nx * 60, g0.z - g0.nz * 60], [g0.x, g0.z], p1, p2];
    // the loop picks up at the radius the bend ends at, then eases toward a comfortable one
    const r1 = Math.hypot(p2[0] - c.x, p2[1] - c.z), rad = clamp(r1 * 0.75, 190, 300);
    let a = Math.atan2(p2[1] - c.z, p2[0] - c.x) + dir * 0.5, tot = 0, r = r1;
    for (let k = 0; k < 12 && tot < want; k++) {
      r = lerp(r, rad * (0.8 + rnd.next() * 0.4), 0.6);
      const p = [c.x + Math.cos(a) * r, c.z + Math.sin(a) * r], q = ctrl[ctrl.length - 1];
      tot += Math.hypot(p[0] - q[0], p[1] - q[1]); ctrl.push(p); a += dir * (0.62 + rnd.next() * 0.3);
    }
    const last = ctrl[ctrl.length - 1], prev = ctrl[ctrl.length - 2]; ctrl.push([last[0] * 2 - prev[0], last[1] * 2 - prev[1]]);
    const out = [];
    let arc = 0;
    for (let i = 1; i < ctrl.length - 2; i++) {
      const p0 = ctrl[i - 1], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i + 2], n = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 8));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t, f = (a1, b1, c1, d1) => 0.5 * (2 * b1 + (c1 - a1) * t + (2 * a1 - 5 * b1 + 4 * c1 - d1) * t2 + (3 * b1 - a1 - 3 * c1 + d1) * t3);
        const x = f(p0[0], p1[0], p2[0], p3[0]), z = f(p0[1], p1[1], p2[1], p3[1]), q = out[out.length - 1];
        if (q) arc += Math.hypot(x - q[0], z - q[1]);
        out.push([x, z, 0, 0, arc]);
      }
    }
    for (let i = 0; i < out.length; i++) { const p = out[Math.max(0, i - 1)], q = out[Math.min(out.length - 1, i + 1)], tl = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; out[i][2] = (q[0] - p[0]) / tl; out[i][3] = (q[1] - p[1]) / tl; }
    return out;
  }
  // a course along the guide: at each slot the most interesting target near it (a gap between rocks, a window, a hoop,
  // the space under an island...) that the jets can reach from the last gate, else clear air at the slot
  trackGuided(P, cands, rnd) {
    const c = P.c, R = P.R, Rt = lerp(110, 70, c.d), guide = this.loopGuide(P, P.gates[0], rnd, P.N * P.gap * 1.25 + 300);
    // placed gates with the guide slot each was placed for; spots that led into a dead end are banned
    const stack = [{ g: P.gates[0], si: 0, q: null }], banned = [];
    const isBanned = (x, z) => banned.some(b => Math.hypot(b.x - x, b.z - z) < 30);
    let fails = 0, backs = 0;
    for (let iter = 0; iter < P.N * 4 && P.gates.length < P.N; iter++) {
      const top = stack[stack.length - 1], g = top.g;
      let si = top.si; const target = guide[si][4] + P.gap * (1 + fails * 0.45);
      while (si < guide.length - 1 && guide[si][4] < target) si++;
      if (guide[si][4] < target - P.gap * 0.5) break;
      const [sx, sz, tx, tz] = guide[si], scored = [];
      for (const q of cands) {
        if (q.used) continue;
        const ds = Math.hypot(q.x - sx, q.z - sz); if (ds > 75 || isBanned(q.x, q.z)) continue;
        const vx = q.x - g.x, vz = q.z - g.z, D = Math.hypot(vx, vz); if (D < 60) continue;
        const ca = (vx * g.nx + vz * g.nz) / D, al = Math.acos(clamp(ca, -1, 1));
        if (al > 2.8 || D < 2 * Rt * Math.sin(al)) continue;
        // a jet turning on a circular arc out of the last gate arrives heading along the reflection of its way out
        // across the chord; gates face between that and the way the course goes on, so they are flown through square
        // and the line stays smooth
        const [ax, az] = this.ideal(g, vx / D, vz / D, tx, tz);
        let nx = q.nx, nz = q.nz;
        if (nx === undefined) { nx = ax; nz = az; }
        else { let a2 = nx * ax + nz * az; if (a2 < 0) { nx = -nx; nz = -nz; a2 = -a2; } if (a2 < 0.72) continue; }
        scored.push({ q, nx, nz, s: (q.bonus || 0) + (1 - ds / 75) * 0.6 + ca * 0.7 + rnd.next() * 0.3 });
      }
      scored.sort((a, b) => b.s - a.s);
      // of the fitting candidates, the one whose way in crosses the fewest rocks (then the best scored)
      let ok = null, used = null, best = null;
      for (let m = 0; m < Math.min(12, scored.length) && !(best && best.bad === 0); m++) {
        const { q, nx, nz } = scored[m], Rg = q.R || R;
        const ys = q.y !== undefined ? [q.y] : [clamp(g.y + (rnd.next() - 0.5) * 30, q.lo, q.hi), (q.lo + q.hi) / 2, q.lo + (q.hi - q.lo) * 0.2];
        for (const y of ys) {
          if (!(y >= SEA) || !this.gateClear(P, q.x, y, q.z, nx, nz, Rg)) continue;
          const bad = this.arcBad(P, g, q.x, y, q.z, nx, nz);
          if (bad >= 0 && (!best || bad < best.bad)) best = { q, x: q.x, y, z: q.z, nx, nz, R: Rg, bad };
          if (bad === 0) break;
        }
      }
      // nothing interesting there (or only ways in through rock): open air at the slot, nudged around until it fits
      for (let m = 0; m < 8 && !(best && best.bad === 0); m++) {
        const off = m === 0 ? 0 : (m % 2 ? 1 : -1) * Math.ceil(m / 2) * 14, x = sx - tz * off, z = sz + tx * off, lo = this.floorY(x, z, R);
        if (isBanned(x, z)) continue;
        const y = clamp(g.y + (rnd.next() - 0.5) * 24, lo, lo + 40), vx = x - g.x, vz = z - g.z, D = Math.hypot(vx, vz) || 1;
        const al = Math.acos(clamp((vx * g.nx + vz * g.nz) / D, -1, 1)); if (al > 2.8 || D < 2 * Rt * Math.sin(al)) continue;
        const [nx, nz] = this.ideal(g, vx / D, vz / D, tx, tz);
        if (!this.gateClear(P, x, y, z, nx, nz, R)) continue;
        const bad = this.arcBad(P, g, x, y, z, nx, nz);
        if (bad >= 0 && (!best || bad + 0.5 < best.bad)) best = { q: null, x, y, z, nx, nz, R, bad };
      }
      if (best && best.bad <= this.arcAllow(P, g, best.x, best.z)) { ok = this.addGate(P, best.x, best.y, best.z, best.nx, best.nz, best.R); if (best.q) { best.q.used = true; used = best.q; } }
      if (ok) { stack.push({ g: ok, si, q: used }); fails = 0; continue; }
      // a dead end three slots running: take back the last gate and try another way
      if (++fails >= 3 && stack.length > 1 && backs < 5) {
        const bad = stack.pop(); P.gates.pop(); banned.push(bad.g); if (bad.q) bad.q.used = false;
        fails = 0; backs++;
      }
    }
  }
  // ---------------------------------------------------------------- spire lagoons and stone forests: a slalom
  trackSpires(P, rnd) {
    const c = P.c, sv = !!c.sv, G = sv ? 22 : 40, R = P.R, Ro = R + 1.8, list = [];
    for (let gj = Math.floor((c.z - 620) / G); gj <= Math.floor((c.z + 620) / G); gj++) for (let gi = Math.floor((c.x - 620) / G); gi <= Math.floor((c.x + 620) / G); gi++) {
      const s = sv ? this.needle(gi, gj) : this.spire(gi, gj);
      if (s && this.natCol(Math.floor(s.x), Math.floor(s.z)).cell === c) list.push(s);
    }
    const cands = [];
    for (let a = 0; a < list.length; a++) for (let b2 = a + 1; b2 < list.length; b2++) {
      const s = list[a], t = list[b2], dx = t.x - s.x, dz = t.z - s.z, L = Math.hypot(dx, dz);
      if (L > 110) continue;
      const rs = s.r0 * 1.25, rt = t.r0 * 1.25, gap = L - rs - rt;
      if (gap < 2 * Ro + 6) continue;
      const ux = dx / L, uz = dz / L, m = rs + gap / 2, x = s.x + ux * m, z = s.z + uz * m;
      const lo = this.floorY(x, z, R), hi = Math.min(s.top, t.top) - R - 2;
      if (hi < lo) continue;
      cands.push({ x, z, lo, hi, nx: -uz, nz: ux, bonus: gap < 2 * Ro + 22 ? 0.35 : 0 });
    }
    const near = new Map();
    for (const s of list) { const k = Math.floor(s.x / 30) * 4096 + Math.floor(s.z / 30); near.set(k, (near.get(k) || 0) + 1); }
    for (let z = c.z - 560; z <= c.z + 560; z += 26) for (let x = c.x - 560; x <= c.x + 560; x += 26) {
      const px = x + (hashF2(this.seed ^ 0x51A1, x, z) - 0.5) * 16, pz = z + (hashF2(this.seed ^ 0x51A2, x, z) - 0.5) * 16;
      if (!this.inRegion(P, px, pz, 0.7)) continue;
      let cnt = 0; const kx = Math.floor(px / 30), kz = Math.floor(pz / 30);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) cnt += near.get((kx + dx) * 4096 + kz + dz) || 0;
      if (cnt < 2) continue;
      const lo = this.floorY(px, pz, R);
      cands.push({ x: px, z: pz, lo, hi: lo + 28, bonus: Math.min(0.6, cnt * 0.08) - 0.2 });
    }
    for (const s of list) {
      // through a window
      if (s.eye && s.eye.r - 2.4 >= 5) { const k = s.eye.y - s.base; cands.push({ x: s.x + s.lx * k, z: s.z + s.lz * k, y: s.eye.y, nx: Math.cos(s.eye.a), nz: Math.sin(s.eye.a), R: Math.min(R, s.eye.r - 2.4), bonus: 1.2 }); }
      // under a bridge
      for (let k = 0; k < 2; k++) {
        const b = this.bridge(s, k); if (!b) continue;
        const mx = (b.ax + b.bx) / 2, mz = (b.az + b.bz) / 2, top = b.yb - b.T * 0.5 - 1, lo = this.floorY(mx, mz, R);
        const bl = Math.hypot(b.bx - b.ax, b.bz - b.az) || 1;
        if (top - R - 2 > lo) cands.push({ x: mx, z: mz, lo, hi: top - R - 2, nx: -(b.bz - b.az) / bl, nz: (b.bx - b.ax) / bl, bonus: 0.9 });
      }
    }
    this.trackGuided(P, cands, rnd);
  }
  // ---------------------------------------------------------------- sky archipelagos: hoops, under and between islands
  trackIsles(P, rnd) {
    const c = P.c, R = P.R, Ro = R + 1.8, isl = [], cands = [];
    for (let layer = 0; layer < 2; layer++) {
      const off = layer ? 38 : 0;
      for (let gj = Math.floor((c.z - 620 - off) / 76); gj <= Math.floor((c.z + 620 - off) / 76); gj++) for (let gi = Math.floor((c.x - 620 - off) / 76); gi <= Math.floor((c.x + 620 - off) / 76); gi++) {
        const s = this.island(layer, gi, gj); if (s && this.natCol(Math.floor(s.x), Math.floor(s.z)).cell === c) isl.push(s);
      }
    }
    for (let gj = Math.floor((c.z - 620) / 180); gj <= Math.floor((c.z + 620) / 180); gj++) for (let gi = Math.floor((c.x - 620) / 180); gi <= Math.floor((c.x + 620) / 180); gi++) {
      const h = this.hoop(gi, gj);
      if (h && h.Ri - 4 >= 5 && this.natCol(Math.floor(h.x), Math.floor(h.z)).cell === c) cands.push({ x: h.x, z: h.z, y: h.y, nx: h.nx, nz: h.nz, R: Math.min(R, h.Ri - 4), bonus: 1.3 });
    }
    for (const s of isl) {
      const ground = Math.max(this.g.climateCached(Math.floor(s.x), Math.floor(s.z)).h, SEA), bot = s.Y - s.depth - 3;
      if (bot - ground > 2 * Ro + 12) cands.push({ x: s.x, z: s.z, lo: ground + Ro + 5, hi: bot - Ro - 3, bonus: 0.8 });
      // skimming past an island's flank
      for (let k = 0; k < 4; k++) { const a = k * 1.5708 + s.ph1, d = s.R * 1.35 + Ro + 6; cands.push({ x: s.x + Math.cos(a) * d, z: s.z + Math.sin(a) * d, lo: s.Y - 8, hi: s.Y + 2, bonus: 0.25 }); }
    }
    for (let a = 0; a < isl.length; a++) for (let b2 = a + 1; b2 < isl.length; b2++) {
      const s = isl[a], t = isl[b2], dx = t.x - s.x, dz = t.z - s.z, L = Math.hypot(dx, dz);
      if (L > 120 || Math.abs(s.Y - t.Y) > 30) continue;
      const gap = L - s.R * 1.3 - t.R * 1.3; if (gap < 2 * Ro + 14) continue;
      const m = s.R * 1.3 + gap / 2, x = s.x + dx / L * m, z = s.z + dz / L * m, y = (s.Y + t.Y) / 2 - 4;
      cands.push({ x, z, lo: y - 6, hi: y + 6, nx: -dz / L, nz: dx / L, bonus: 0.5 });
    }
    this.trackGuided(P, cands, rnd);
  }
  // ---------------------------------------------------------------- peaks: a winding route at valley height; wherever a
  // ridge is in the way the route is bored through it as a lit tunnel
  trackPeaks(P, rnd) {
    const c = P.c, R = P.R, TR = Math.max(R + 3.2, lerp(15.5, 8.6, c.d)), g0 = P.gates[0];
    const path = this.peakLoop(P, g0, TR, rnd);
    if (path.length < 10) return;
    const tube = this.makeTube(path, TR, true, c.d), Rt = Math.min(R, TR - 4.4);
    P.tubes.push(tube);
    let lastS = 0, next = P.gap * 0.8;
    for (let i = 2; i < path.length - 1 && P.gates.length < P.N; i++) {
      const s = i * 8, mouth = tube.under[i + 2] && !tube.under[i + 1] && !tube.under[i];
      if (!mouth && s < next) continue;
      const p = path[i], q = path[i + 1], tx = q[0] - p[0], tz = q[2] - p[2], tl = Math.hypot(tx, tz) || 1;
      const Rg = tube.under[i] || tube.under[i + 1] || tube.under[i - 1] ? Rt : R;
      if (this.gateClear(P, p[0], p[1], p[2], tx / tl, tz / tl, Rg)) {
        this.addGate(P, p[0], p[1], p[2], tx / tl, tz / tl, Rg, s - lastS);
        lastS = s; next = s + P.gap * (0.85 + rnd.next() * 0.3);
      }
    }
  }
  // the course route through the peaks: from the start gate around the middle of the region on a wobbly loop (so it
  // crosses ridge after ridge), at the height of the lowest ground nearby, sloping at most 1:5
  peakLoop(P, g0, TR, rnd) {
    const xz = this.loopGuide(P, g0, rnd, (P.N - 1) * P.gap * 1.1);
    // height: the lowest ground within 120 blocks either way along the route, plus clearance; then slope limits
    const n = xz.length, gh = xz.map(([x, z]) => Math.max(this.natCol(Math.floor(x), Math.floor(z)).hn, SEA)), ys = new Float64Array(n);
    for (let i = 0; i < n; i++) { let m = 1e9; for (let k = Math.max(0, i - 15); k <= Math.min(n - 1, i + 15); k++) if (gh[k] < m) m = gh[k]; ys[i] = clamp(m + TR + 8, 80, 150); }
    ys[0] = g0.y;
    for (let i = 1; i < n; i++) ys[i] = clamp(ys[i], ys[i - 1] - 1.6, ys[i - 1] + 1.6);
    for (let i = n - 2; i > 0; i--) ys[i] = clamp(ys[i], ys[i + 1] - 1.6, ys[i + 1] + 1.6);
    ys[0] = g0.y;
    return xz.map(([x, z], i) => [x, ys[i], z]);
  }
  peakPath(P, x, y, z, hd, TR, rnd, len) {
    const c = P.c, Rmin = lerp(260, 115, c.d), pts = [[x, y, z]];
    let k = 0, out = 0;
    for (let i = 0; i < len / 8 && i < 700; i++) {
      k += (rnd.next() - 0.5) * 0.0035; k *= 0.96;
      const dc = Math.hypot(c.x - x, c.z - z);
      if (dc > 300) k += skyAngle(hd, Math.atan2(c.z - z, c.x - x)) * 0.0005 * (dc - 300) / 40;
      k = clamp(k, -1 / Rmin, 1 / Rmin);
      hd += k * 8; x += Math.cos(hd) * 8; z += Math.sin(hd) * 8;
      // just over the lowest ground in the next 240 blocks, so the ridges in between get tunnelled
      let gmin = 1e9;
      for (let s = 0; s <= 240; s += 30) { const h = this.natCol(Math.floor(x + Math.cos(hd) * s), Math.floor(z + Math.sin(hd) * s)).hn; if (h < gmin) gmin = h; }
      const yt = clamp(Math.max(gmin, SEA) + TR + 8, 80, 150);
      y += clamp(yt - y, -0.8, 0.8);
      pts.push([x, y, z]);
      if (!this.inRegion(P, x, z, 0.5)) { if (++out > 6) break; } else out = 0;
    }
    return pts;
  }
  // more tunnels through the region that no course uses, to explore
  freeTunnels(P, rnd) {
    const c = P.c;
    for (let k = 0; k < 2; k++) {
      const a = rnd.next() * SKY_TAU, rad = 120 + rnd.next() * 200, x = c.x + Math.cos(a) * rad, z = c.z + Math.sin(a) * rad;
      const TR = lerp(14, 9, c.d) + rnd.next() * 3;
      const path = this.peakPath(P, x, 100, z, rnd.next() * SKY_TAU, TR, rnd, 600 + rnd.next() * 500);
      if (path.length < 20) continue;
      const t = this.makeTube(path, TR, true, c.d); t.free = true;
      if (t.under.some(Boolean)) P.tubes.push(t);
    }
  }
  // a tunnel along a path: where the path runs inside rock it is carved, lit, striped and framed at its mouths;
  // long underground runs open into a lit cavern halfway
  makeTube(path, R, lit, d) {
    const n = path.length, pts = new Float64Array(n * 3), under = new Uint8Array(n);
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = path[i]; pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z;
      under[i] = this.g.climateCached(Math.floor(x), Math.floor(z)).h > y + R + 2 ? 1 : 0;
      x0 = Math.min(x0, x - R - 4); z0 = Math.min(z0, z - R - 4); x1 = Math.max(x1, x + R + 4); z1 = Math.max(z1, z + R + 4);
    }
    const t = { pts, n, R, under, lit, d, caves: [], x0, z0, x1, z1 };
    for (let i = 0; i < n;) {
      if (!under[i]) { i++; continue; }
      let j = i; while (j < n && under[j]) j++;
      if (j - i > 28) { const m = (i + j) >> 1, rx = lerp(30, 20, d), ry = rx * 0.55; t.caves.push({ x: pts[m * 3], y: pts[m * 3 + 1] + ry * 0.3, z: pts[m * 3 + 2], rx, ry }); }
      i = j;
    }
    for (const cv of t.caves) { t.x0 = Math.min(t.x0, cv.x - cv.rx - 2); t.z0 = Math.min(t.z0, cv.z - cv.rx - 2); t.x1 = Math.max(t.x1, cv.x + cv.rx + 2); t.z1 = Math.max(t.z1, cv.z + cv.rx + 2); }
    return t;
  }
  inTubes(P, x, y, z) {
    for (const t of P.tubes) {
      if (x < t.x0 || x > t.x1 || z < t.z0 || z > t.z1) continue;
      const p = t.pts, R2 = t.R * t.R;
      for (let i = 0; i < t.n - 1; i++) {
        const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2], dx = p[i * 3 + 3] - ax, dy = p[i * 3 + 4] - ay, dz = p[i * 3 + 5] - az;
        const L2 = dx * dx + dy * dy + dz * dz, s = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / L2, 0, 1);
        const ex = ax + dx * s - x, ey = ay + dy * s - y, ez = az + dz * s - z;
        if (ex * ex + ey * ey + ez * ez < R2) return true;
      }
      for (const cv of t.caves) { const qx = (x - cv.x) / cv.rx, qy = (y - cv.y) / cv.ry, qz = (z - cv.z) / cv.rx; if (qx * qx + qy * qy + qz * qz < 1) return true; }
    }
    return false;
  }
  planFeatSolid(P, x, y, z) {
    for (const f of P.feats) {
      if (Math.abs(x - f.x) > f.reach || Math.abs(z - f.z) > f.reach) continue;
      if (f.k === 'pillars') {
        if (y < f.y0 || y > f.y1 + 1) continue;
        for (const sd of [-1, 1]) { const px = f.x + f.ux * f.off * sd, pz = f.z + f.uz * f.off * sd; if (Math.hypot(x - px, z - pz) < f.pr + 1) return true; }
      } else if (f.k === 'henge') {
        const o = this._hs2 || (this._hs2 = [0, 0, 0, 0]);
        if (this.hoopSpan(f.h, x, z, o) && ((y >= o[0] - 1 && y <= o[1] + 1) || (o[2] >= 0 && y >= o[2] - 1 && y <= o[3] + 1))) return true;
      } else { const sp = this.garchSpan(f, x, z); if (sp && y >= sp[0] - 1 && y <= sp[1] + 1) return true; }
    }
    return false;
  }
  // a ground arch over a meadow gate: feet on the ground either side, the underside clearing the ring
  garchSpan(f, x, z) {
    const dx = x - f.x, dz = z - f.z, a = dx * f.nx + dz * f.nz, u = -dx * f.nz + dz * f.nx;
    if (a > f.w || a < -f.w || u > f.span || u < -f.span) return null;
    const q = u / f.span, under = f.yA - (f.yA - f.y0) * q * q;
    return [Math.floor(under), Math.floor(under + f.th + q * q * 3)];
  }
  // boost rings on the long legs
  addBoosts(P, rnd) {
    const G = P.gates, Rb = Math.max(5, P.R * 0.72);
    for (let i = 1; i < G.length && P.boosts.length < 4; i++) {
      const a = G[i - 1], b = G[i], L = Math.hypot(b.x - a.x, b.z - a.z);
      if (L < 170 || rnd.next() > 0.6 || P.tubes.length) continue;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2, z = (a.z + b.z) / 2, nx = (b.x - a.x) / L, nz = (b.z - a.z) / L;
      if (!this.gateClear(P, x, y, z, nx, nz, Rb)) continue;
      let near = false; for (const g of G) if (Math.hypot(g.x - x, g.y - y, g.z - z) < 50) near = true;
      if (!near) P.boosts.push({ x, y, z, nx, nz, R: Rb, k: 3 });
    }
  }
  // ================================================================ what the main thread needs about a region
  info(i, j) {
    const c = this.cell(i, j), af = this.airfield(c), P = this.plan(c);
    const r1 = (v) => Math.round(v * 10) / 10;
    return {
      i, j, name: c.name, label: c.label, kind: c.kind, lv: c.lv, d: c.d, x: c.x, z: c.z,
      air: af ? { x: af.x, z: af.z, y: af.y, fx: af.fx, fz: af.fz, rx: af.rx, rz: af.rz, L: af.L, W: af.W, AA: af.AA, AD: af.AD, name: af.name, home: af.home, rwy: this.rwyNum(af.fx, af.fz) } : null,
      course: P.ok ? { id: i + ',' + j, name: c.courseName, len: Math.round(P.len), par: P.par.map(v => Math.round(v * 10) / 10),
        gates: P.gates.map(g => [r1(g.x), r1(g.y), r1(g.z), Math.round(g.nx * 1000) / 1000, Math.round(g.nz * 1000) / 1000, r1(g.R), g.k]),
        boosts: P.boosts.map(g => [r1(g.x), r1(g.y), r1(g.z), Math.round(g.nx * 1000) / 1000, Math.round(g.nz * 1000) / 1000, r1(g.R), g.k]) } : null,
    };
  }
  // where a new player stands: on the home apron, facing the runway (the airfield's service pad is beside it)
  homeSpawn() {
    const af = this.airfield(this.cell(0, 0)), a = -af.AA + 22, b = af.W + 12 + 5;
    return [af.x + a * af.fx + b * af.rx + 0.5, af.y + 1, af.z + a * af.fz + b * af.rz + 0.5, Math.atan2(-af.rx, af.rz)];
  }
  // the takeoff spot on the home runway
  homeRunway() {
    const af = this.airfield(this.cell(0, 0)), a = -af.L + 34;
    return [af.x + a * af.fx + 0.5, af.y + 1, af.z + a * af.fz + 0.5, Math.atan2(af.fx, -af.fz)];
  }
  // top of the natural ground (villages and other overworld structures stand on it)
  surfaceY(x, z) { return Math.ceil(this.g.climateCached(x, z).h) - 1; }
  villageOK(x, z) { return Math.hypot(x, z) > 500 && !this.airspaceAround(x, z, 60, 300); }
  // ================================================================ chunks
  generate(cx, cz) {
    const g = this.g, blocks = new Uint16Array(CVOL), ctx = new ChunkCtx(blocks, cx, cz), x0 = cx << 4, z0 = cz << 4;
    if (g.cache.size > 40000) g.cache.clear();
    const C = new Array(324), H = new Float32Array(324), BI = new Uint8Array(324);
    for (let dz = -1; dz <= 16; dz++) for (let dx = -1; dx <= 16; dx++) {
      const c = g.climateCached(x0 + dx, z0 + dz), i = (dz + 1) * 18 + dx + 1;
      C[i] = c; H[i] = c.h; BI[i] = c.biome;
    }
    const biomes = new Uint8Array(256), ground = new Int16Array(256);
    let walls = false;
    // ---- ground: stone, terracotta bands in the canyons, banded rock in the fjords
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = (z + 1) * 18 + x + 1, c = C[i], t = Math.min(CH - 2, Math.ceil(c.h) - 1), banded = c.tw[SKZ.CANYON] > 0.5;
      biomes[z * 16 + x] = c.biome;
      for (let y = 0; y <= t; y++) blocks[(y << 8) | (z << 4) | x] = banded && y >= 48 ? this.bandAt(c, x0 + x, y, z0 + z) : B.stone;
      ground[z * 16 + x] = t;
      if (c.cs >= 0 && c.tw[SKZ.CANYON] > 0.97) walls = true;
    }
    if (walls) this.overhangs(blocks, x0, z0, C, ground);
    // ---- natural features and the regions' plans
    const F = this.chunkFeatures(cx, cz);
    for (const s of F.spires) this.fillSpire(ctx, s);
    for (const b of F.bridges) this.fillBridge(ctx, b);
    for (const s of F.islands) this.fillIsland(ctx, s);
    for (const h of F.hoops) this.fillHoop(ctx, h, true);
    for (const a of F.arches) this.fillArch(ctx, a);
    for (const f of F.feats) this.fillFeat(ctx, f);
    for (const s of F.spires) if (s.eye) this.carveEye(ctx, s);
    for (const t of F.tubes) this.carveTube(ctx, t);
    // ---- surface, water, bedrock, rock variety, ores
    this.surface(ctx, C, H, ground);
    this.water(ctx, C, ground);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const wx = x0 + x, wz = z0 + z;
      blocks[(z << 4) | x] = B.bedrock;
      for (let y = 1; y <= 4; y++) if (hashF3(this.seed, wx, y, wz) < (5 - y) / 5) blocks[(y << 8) | (z << 4) | x] = B.bedrock;
      for (let y = 5; y < 16; y++) { const p = (y << 8) | (z << 4) | x; if (blocks[p] === B.stone && (y < 8 || hashF3(this.seed ^ 77, wx, y, wz) < (16 - y) / 8)) blocks[p] = B.deepslate; }
    }
    let maxTop = 0;
    for (let i = 0; i < 256; i++) { let y = CH - 2; const xz = ((i >> 4) << 4) | (i & 15); while (y > 0 && blocks[(y << 8) | xz] === 0) y--; if (y > maxTop) maxTop = y; }
    g.stoneVariants(blocks, x0, z0, maxTop + 1);
    const orng = new RNG(hash2(this.seed ^ 0x0E5, cx, cz));
    g.ores(ctx, orng, maxTop);
    // ---- built things and decoration
    for (const t of F.tubes) this.decorTube(ctx, t);
    for (const s of F.islands) this.decorIsland(ctx, s);
    for (const s of F.spires) this.vines(ctx, s);
    for (const af of F.airfields) this.buildAirfield(ctx, af);
    for (const gt of F.gates) this.buildRing(ctx, gt);
    // ---- plants
    this.trees(ctx, F);
    const top = new Int16Array(256), low = new Int16Array(256);
    for (let i = 0; i < 256; i++) {
      const xz = ((i >> 4) << 4) | (i & 15);
      let y = CH - 2; while (y > 0 && blocks[(y << 8) | xz] === 0) y--;
      top[i] = y;
      // the ground under an island or arch gets its own grass and flowers
      let yg = ground[i]; while (yg > 0 && blocks[(yg << 8) | xz] === 0) yg--;
      low[i] = y - yg > 3 && blocks[((yg + 1) << 8) | xz] === 0 ? yg : -1;
    }
    g.vegetation(ctx, BI, top);
    g.vegetation(ctx, BI, low);
    this.snow(ctx, C);
    this.animals(ctx, C, cx, cz);
    return { blocks, biomes, be: ctx.be, spawns: ctx.spawns, tags: 0, tints: g.tints(x0, z0) };
  }
  // terracotta strata (warm canyons) or grey rock with veins of blue ice (fjords), wobbling a little with position
  bandAt(c, x, y, z) {
    const w = Math.round(this.g.nPatch.n2(x / 30, z / 30) * 2);
    if (c.cold > 0.5) { const p = this.fjordPal; return p[(((y + w) >> 2) % p.length + p.length) % p.length]; }
    return this.g.bands[clamp(y + w, 0, CH - 1)];
  }
  // canyon walls: a coarse 3D noise displaces the wall profile, carving ledges, overhangs and alcoves
  overhangs(blocks, x0, z0, C, ground) {
    const Y0 = 36, NY = 32, grid = new Float32Array(5 * 5 * NY);
    for (let gy = 0; gy < NY; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++)
      grid[(gy * 5 + gz) * 5 + gx] = this.nOver.n3((x0 + gx * 4) / 15, (Y0 + gy * 4) / 10, (z0 + gz * 4) / 15);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const c = C[(z + 1) * 18 + x + 1];
      if (c.cs < 0 || c.tw[SKZ.CANYON] <= 0.97) continue;
      const n = c.nat, F = c.nat.cF, Pp = n.cP, s = c.cs;
      const ylo = Math.max(Math.floor(F), Y0), yhi = Math.min(Math.ceil(Pp) + 1, Y0 + (NY - 1) * 4 - 1, CH - 2);
      const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
      let t = ground[z * 16 + x];
      for (let y = ylo; y <= yhi; y++) {
        const gy = (y - Y0) >> 2, fy = ((y - Y0) & 3) / 4, i0 = (gy * 5 + gz) * 5 + gx, i1 = i0 + 25;
        const a = lerp(lerp(grid[i0], grid[i0 + 1], fx), lerp(grid[i0 + 5], grid[i0 + 6], fx), fz);
        const b = lerp(lerp(grid[i1], grid[i1 + 1], fx), lerp(grid[i1 + 5], grid[i1 + 6], fx), fz);
        const solid = y < F + (Pp - F) * skyProf(clamp(s + lerp(a, b, fy) * 0.12, 0, 1)), p = (y << 8) | (z << 4) | x;
        if (solid) { if (!blocks[p]) blocks[p] = this.bandAt(c, x0 + x, y, z0 + z); if (y > t) t = y; }
        else blocks[p] = 0;
      }
      while (t > 0 && !blocks[(t << 8) | (z << 4) | x]) t--;
      ground[z * 16 + x] = t;
    }
  }
  // everything that reaches into a chunk
  chunkFeatures(cx, cz) {
    const x0 = cx << 4, z0 = cz << 4, F = { spires: [], bridges: [], islands: [], hoops: [], arches: [], feats: [], tubes: [], gates: [], airfields: [], tgates: [], tfeats: [], tsegs: [] };
    const xc = x0 + 8, zc = z0 + 8, n = this.natCol(xc, zc), tw = n.tw;
    const over = (ax, az, bx, bz) => bx >= x0 && ax <= x0 + 15 && bz >= z0 && az <= z0 + 15;
    // spires and needles (and the bridges between spires, which can reach 80 blocks)
    let spT = 0, ndT = 0;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const q = this.natCol(xc + di * 40, zc + dj * 40); spT = Math.max(spT, q.tw[SKZ.SPIRES] * (1 - q.sv)); ndT = Math.max(ndT, q.tw[SKZ.SPIRES] * q.sv); }
    if (spT > 0) {
      for (let gj = Math.floor((z0 - 82) / 40); gj <= Math.floor((z0 + 97) / 40); gj++) for (let gi = Math.floor((x0 - 82) / 40); gi <= Math.floor((x0 + 97) / 40); gi++) {
        const s = this.spire(gi, gj); if (!s) continue;
        const rm = this.spireProf(s).rmax + 8;
        if (over(s.x - rm, s.z - rm, s.x + rm, s.z + rm)) F.spires.push(s);
        for (let k = 0; k < 2; k++) { const b = this.bridge(s, k); if (b && over(Math.min(b.ax, b.bx) - 3, Math.min(b.az, b.bz) - 3, Math.max(b.ax, b.bx) + 3, Math.max(b.az, b.bz) + 3)) F.bridges.push(b); }
      }
    }
    if (ndT > 0) {
      for (let gj = Math.floor((z0 - 16) / 22); gj <= Math.floor((z0 + 31) / 22); gj++) for (let gi = Math.floor((x0 - 16) / 22); gi <= Math.floor((x0 + 31) / 22); gi++) {
        const s = this.needle(gi, gj); if (!s) continue;
        const rm = this.spireProf(s).rmax;
        if (over(s.x - rm, s.z - rm, s.x + rm, s.z + rm)) F.spires.push(s);
      }
    }
    // islands (with their debris clouds)
    for (let layer = 0; layer < 2; layer++) {
      const off = layer ? 38 : 0;
      for (let gj = Math.floor((z0 - 92 - off) / 76); gj <= Math.floor((z0 + 107 - off) / 76); gj++) for (let gi = Math.floor((x0 - 92 - off) / 76); gi <= Math.floor((x0 + 107 - off) / 76); gi++) {
        const s = this.island(layer, gi, gj); if (!s) continue;
        let r = s.R * 1.32 + 9;
        if (s.debris) for (const q of s.debris) r = Math.max(r, Math.hypot(q.x - s.x, q.z - s.z) + q.r + 1);
        if (over(s.x - r, s.z - r, s.x + r, s.z + r)) F.islands.push(s);
      }
    }
    for (let gj = Math.floor((z0 - 32) / 180); gj <= Math.floor((z0 + 47) / 180); gj++) for (let gi = Math.floor((x0 - 32) / 180); gi <= Math.floor((x0 + 47) / 180); gi++) {
      const h = this.hoop(gi, gj); if (h) { const r = h.Ri + h.wr + 1; if (over(h.x - r, h.z - r, h.x + r, h.z + r)) F.hoops.push(h); }
    }
    if (tw[SKZ.CANYON] > 0 || this.natCol(xc + 100, zc).tw[SKZ.CANYON] > 0 || this.natCol(xc - 100, zc).tw[SKZ.CANYON] > 0 || this.natCol(xc, zc + 100).tw[SKZ.CANYON] > 0 || this.natCol(xc, zc - 100).tw[SKZ.CANYON] > 0) {
      for (let gj = Math.floor((z0 - 100) / 210); gj <= Math.floor((z0 + 115) / 210); gj++) for (let gi = Math.floor((x0 - 100) / 210); gi <= Math.floor((x0 + 115) / 210); gi++) {
        const a = this.arch(gi, gj); if (a) { const r = a.hs + a.W; if (over(a.x - r, a.z - r, a.x + r, a.z + r)) F.arches.push(a); }
      }
    }
    // region plans: courses, tunnels, course features (only regions whose centre is close enough to reach here)
    const gi = Math.floor(xc / SKY_CELL + 0.5), gj = Math.floor(zc / SKY_CELL + 0.5);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const c = this.cell(gi + di, gj + dj);
      if (Math.hypot(c.x - xc, c.z - zc) > 1020) continue;
      const P = this.plan(c), bx = this.planBox(P);
      if (!over(bx[0], bx[1], bx[2], bx[3])) continue;
      for (const g of P.gates.concat(P.boosts)) {
        const r = g.R + 3; if (over(g.x - r, g.z - r, g.x + r, g.z + r)) F.gates.push(g);
        if (over(g.x - 50, g.z - 50, g.x + 50, g.z + 50)) F.tgates.push(g);
      }
      for (const f of P.feats) { const r = f.reach; if (over(f.x - r, f.z - r, f.x + r, f.z + r)) F.feats.push(f); if (over(f.x - r - 14, f.z - r - 14, f.x + r + 14, f.z + r + 14)) F.tfeats.push(f); }
      for (const t of P.tubes) if (over(t.x0, t.z0, t.x1, t.z1)) F.tubes.push(t);
      // the corridors trees keep out of: between consecutive gates, and along every tunnel's bore
      const seg = (ax, ay, az, bx, by, bz, w, r) => { const m = w + 14; if (over(Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m)) F.tsegs.push([ax, ay, az, bx, by, bz, w, r]); };
      for (let i = 1; i < P.gates.length; i++) { const a = P.gates[i - 1], b = P.gates[i]; seg(a.x, a.y, a.z, b.x, b.y, b.z, Math.max(a.R, b.R) + 5, Math.min(a.R, b.R)); }
      for (const t of P.tubes) { const p = t.pts; for (let i = 0; i < t.n - 1; i++) seg(p[i * 3], p[i * 3 + 1], p[i * 3 + 2], p[i * 3 + 3], p[i * 3 + 4], p[i * 3 + 5], t.R + 6, t.R); }
    }
    for (const af of this.airfieldsNear(xc, zc)) {
      const e = af.padA + 70;
      const ax = af.x - Math.abs(af.fx) * e - Math.abs(af.rx) * 90, bx2 = af.x + Math.abs(af.fx) * e + Math.abs(af.rx) * 90;
      const az = af.z - Math.abs(af.fz) * e - Math.abs(af.rz) * 90, bz2 = af.z + Math.abs(af.fz) * e + Math.abs(af.rz) * 90;
      if (over(ax, az, bx2, bz2)) F.airfields.push(af);
    }
    return F;
  }
  // ---------------------------------------------------------------- feature fills
  fillSpire(ctx, s) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, P = this.spireProf(s), n = P.r.length, rm = P.rmax, pal = s.needle ? this.needlePal : this.spirePal;
    const xa = Math.max(x0, Math.floor(s.x - rm)), xb = Math.min(x0 + 15, Math.ceil(s.x + rm)), za = Math.max(z0, Math.floor(s.z - rm)), zb = Math.min(z0 + 15, Math.ceil(s.z + rm));
    for (let z = za; z <= zb; z++) for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - s.x, pz = z + 0.5 - s.z, th = Math.atan2(pz, px), s3 = Math.sin(3 * th), c3 = Math.cos(3 * th), m5 = 1 + 0.06 * Math.sin(5 * th + s.ph2);
      const col = ((z - z0) << 4) | (x - x0);
      let topY = -1;
      for (let k = 0; k < n; k++) {
        const y = s.base + k; if (y < 1 || y >= CH - 2) continue;
        const dx = px - s.lx * k, dz = pz - s.lz * k, rr = P.r[k] * (m5 + 0.12 * (s3 * P.cp[k] + c3 * P.sp[k]));
        if (dx * dx + dz * dz >= rr * rr) continue;
        b[(y << 8) | col] = pal[(Math.floor((y + s.mat * 5) / 5) % pal.length + pal.length) % pal.length];
        topY = y;
      }
      if (topY < 0) continue;
      // grassy cap, mossy below it
      b[(topY << 8) | col] = B.grass_block;
      for (let y = topY - 1; y >= topY - 2; y--) b[(y << 8) | col] = B.dirt;
      for (let y = topY - 3; y >= Math.max(1, topY - 16); y--) { const p = (y << 8) | col; if (b[p] && hashF3(this.seed ^ 0x3055, x, y, z) < 0.3) b[p] = B.moss_block; }
    }
  }
  carveEye(ctx, s) {
    const e = s.eye, b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, k = e.y - s.base, cx = s.x + s.lx * k, cz = s.z + s.lz * k, r = s.r0 * 1.5 + 2;
    for (let z = Math.max(z0, Math.floor(cz - r)); z <= Math.min(z0 + 15, Math.ceil(cz + r)); z++) for (let x = Math.max(x0, Math.floor(cx - r)); x <= Math.min(x0 + 15, Math.ceil(cx + r)); x++)
      for (let y = Math.floor(e.y - e.r - 1); y <= Math.ceil(e.y + e.r + 1); y++) if (this.inEye(s, x + 0.5, y + 0.5, z + 0.5)) b[(y << 8) | ((z - z0) << 4) | (x - x0)] = 0;
  }
  fillBridge(ctx, br) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0;
    for (let z = z0; z < z0 + 16; z++) for (let x = x0; x < x0 + 16; x++) {
      const sp = this.bridgeSpan(br, x + 0.5, z + 0.5); if (!sp) continue;
      const col = ((z - z0) << 4) | (x - x0);
      for (let y = Math.max(1, sp[0]); y <= Math.min(CH - 2, sp[1]); y++) b[(y << 8) | col] = y === sp[1] ? B.grass_block : y === sp[1] - 1 ? B.dirt : hashF3(this.seed ^ 0xB4, x, y, z) < 0.3 ? B.andesite : B.stone;
    }
  }
  fillIsland(ctx, s) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, r = s.R * 1.32 + 1;
    for (let z = Math.max(z0, Math.floor(s.z - r)); z <= Math.min(z0 + 15, Math.ceil(s.z + r)); z++) for (let x = Math.max(x0, Math.floor(s.x - r)); x <= Math.min(x0 + 15, Math.ceil(s.x + r)); x++) {
      const sp = this.isleSpan(s, x + 0.5, z + 0.5); if (!sp) continue;
      const col = ((z - z0) << 4) | (x - x0);
      for (let y = Math.max(1, sp[0]); y <= Math.min(CH - 3, sp[1]); y++) b[(y << 8) | col] = y === sp[1] ? B.grass_block : y >= sp[1] - 3 ? B.dirt : B.stone;
    }
    if (s.debris) for (const q of s.debris) {
      const rr = q.r + 0.5;
      for (let z = Math.max(z0, Math.floor(q.z - rr)); z <= Math.min(z0 + 15, Math.floor(q.z + rr)); z++) for (let x = Math.max(x0, Math.floor(q.x - rr)); x <= Math.min(x0 + 15, Math.floor(q.x + rr)); x++)
        for (let y = Math.max(1, Math.floor(q.y - rr)); y <= Math.min(CH - 2, Math.floor(q.y + rr)); y++) {
          const dx = x + 0.5 - q.x, dy = y + 0.5 - q.y, dz = z + 0.5 - q.z, hh = hashF3(s.salt, x, y, z);
          if (dx * dx + dy * dy + dz * dz < q.r * q.r * (0.75 + hh * 0.5)) b[(y << 8) | ((z - z0) << 4) | (x - x0)] = hh < 0.4 ? B.tuff : hh < 0.75 ? B.andesite : B.cobbled_deepslate;
        }
    }
  }
  // stone rings: mossy rock, with a few glowing crystals set into the inside of the ring
  fillHoop(ctx, h, crystals) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, o = [0, 0, 0, 0], r = h.Ri + h.wr + 1;
    for (let z = Math.max(z0, Math.floor(h.z - r)); z <= Math.min(z0 + 15, Math.ceil(h.z + r)); z++) for (let x = Math.max(x0, Math.floor(h.x - r)); x <= Math.min(x0 + 15, Math.ceil(h.x + r)); x++) {
      if (!this.hoopSpan(h, x + 0.5, z + 0.5, o)) continue;
      const col = ((z - z0) << 4) | (x - x0);
      for (let run = 0; run < (o[2] >= 0 ? 2 : 1); run++) {
        const ya = o[run * 2], yb = o[run * 2 + 1];
        for (let y = Math.max(1, ya); y <= Math.min(CH - 2, yb); y++) {
          const hh = hashF3(h.salt, x, y, z);
          b[(y << 8) | col] = y === yb && hh < 0.6 ? B.moss_block : hh < 0.25 ? B.mossy_cobblestone : hh < 0.45 ? B.andesite : B.stone;
        }
      }
    }
    if (!crystals) return;
    for (let k = 0; k < 6; k++) {
      const t = (k + 0.5) / 6 * SKY_TAU, rr = h.Ri + 0.5, x = Math.floor(h.x - h.nz * Math.cos(t) * rr), y = Math.floor(h.y + Math.sin(t) * rr), z = Math.floor(h.z + h.nx * Math.cos(t) * rr);
      if (ctx.inside(x, z) && ctx.get(x, y, z) > 0) ctx.set(x, y, z, k & 1 ? B.ochre_froglight : B.pearlescent_froglight);
    }
  }
  fillArch(ctx, a) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0;
    const c = this.g.climateCached(Math.floor(a.x), Math.floor(a.z));
    for (let z = z0; z < z0 + 16; z++) for (let x = x0; x < x0 + 16; x++) {
      const sp = this.archSpan(a, x + 0.5, z + 0.5); if (!sp) continue;
      const col = ((z - z0) << 4) | (x - x0);
      for (let y = Math.max(1, sp[0]); y <= Math.min(CH - 2, sp[1]); y++) b[(y << 8) | col] = y === sp[1] && c.cold < 0.5 ? B.red_sand : this.bandAt(c, x, y, z);
    }
  }
  fillFeat(ctx, f) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, sd = this.seed ^ 0xFEA7;
    if (f.k === 'henge') { this.fillHoop(ctx, f.h, true); return; }
    if (f.k === 'pillars') {
      for (const s of [-1, 1]) {
        const px = f.x + f.ux * f.off * s, pz = f.z + f.uz * f.off * s, r = f.pr + 0.6;
        for (let z = Math.max(z0, Math.floor(pz - r)); z <= Math.min(z0 + 15, Math.floor(pz + r)); z++) for (let x = Math.max(x0, Math.floor(px - r)); x <= Math.min(x0 + 15, Math.floor(px + r)); x++) {
          const dd = Math.hypot(x + 0.5 - px, z + 0.5 - pz); if (dd > f.pr) continue;
          const col = ((z - z0) << 4) | (x - x0);
          for (let y = Math.max(1, f.y0); y <= Math.min(CH - 3, f.y1); y++) { const hh = hashF3(sd, x, y, z); b[(y << 8) | col] = y === f.y1 ? B.moss_block : hh < 0.3 ? B.mossy_stone_bricks : hh < 0.4 ? B.cracked_stone_bricks : B.stone_bricks; }
          if (dd < 0.9 && f.y1 + 1 < CH - 1) b[((f.y1 + 1) << 8) | col] = B.sea_lantern;
        }
      }
      return;
    }
    for (let z = z0; z < z0 + 16; z++) for (let x = x0; x < x0 + 16; x++) {
      const sp = this.garchSpan(f, x + 0.5, z + 0.5); if (!sp) continue;
      const col = ((z - z0) << 4) | (x - x0);
      for (let y = Math.max(1, sp[0]); y <= Math.min(CH - 2, sp[1]); y++) b[(y << 8) | col] = y === sp[1] ? B.moss_block : hashF3(sd, x, y, z) < 0.3 ? B.mossy_cobblestone : B.stone;
    }
  }
  // ---------------------------------------------------------------- tunnels
  carveTube(ctx, t) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, p = t.pts, R = t.R, R2 = R * R;
    if (t.x1 < x0 || t.x0 > x0 + 15 || t.z1 < z0 || t.z0 > z0 + 15) return;
    for (let i = 0; i < t.n - 1; i++) {
      const ax = p[i * 3], ay = p[i * 3 + 1], az = p[i * 3 + 2], bx = p[i * 3 + 3], by = p[i * 3 + 4], bz = p[i * 3 + 5];
      if (Math.max(ax, bx) + R < x0 || Math.min(ax, bx) - R > x0 + 15 || Math.max(az, bz) + R < z0 || Math.min(az, bz) - R > z0 + 15) continue;
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const xa = Math.max(x0, Math.floor(Math.min(ax, bx) - R)), xb = Math.min(x0 + 15, Math.ceil(Math.max(ax, bx) + R));
      const za = Math.max(z0, Math.floor(Math.min(az, bz) - R)), zb = Math.min(z0 + 15, Math.ceil(Math.max(az, bz) + R));
      for (let z = za; z <= zb; z++) for (let x = xa; x <= xb; x++) {
        const s = clamp(((x + 0.5 - ax) * dx + (z + 0.5 - az) * dz) / L2, 0, 1), ex = ax + dx * s - x - 0.5, ez = az + dz * s - z - 0.5, d2 = ex * ex + ez * ez;
        if (d2 >= R2) continue;
        const yc = ay + (by - ay) * s, half = Math.sqrt(R2 - d2), col = ((z - z0) << 4) | (x - x0);
        for (let y = Math.max(2, Math.ceil(yc - half - 0.5)); y <= Math.min(CH - 2, Math.floor(yc + half - 0.5)); y++) b[(y << 8) | col] = 0;
      }
    }
    for (const cv of t.caves) {
      if (cv.x + cv.rx < x0 || cv.x - cv.rx > x0 + 15 || cv.z + cv.rx < z0 || cv.z - cv.rx > z0 + 15) continue;
      for (let z = Math.max(z0, Math.floor(cv.z - cv.rx)); z <= Math.min(z0 + 15, Math.ceil(cv.z + cv.rx)); z++) for (let x = Math.max(x0, Math.floor(cv.x - cv.rx)); x <= Math.min(x0 + 15, Math.ceil(cv.x + cv.rx)); x++) {
        const qx = (x + 0.5 - cv.x) / cv.rx, qz = (z + 0.5 - cv.z) / cv.rx, q = 1 - qx * qx - qz * qz; if (q <= 0) continue;
        const half = cv.ry * Math.sqrt(q), col = ((z - z0) << 4) | (x - x0);
        for (let y = Math.max(2, Math.ceil(cv.y - half)); y <= Math.min(CH - 2, Math.floor(cv.y + half)); y++) b[(y << 8) | col] = 0;
      }
    }
  }
  // lights along the walls, a dashed stripe down the floor, hazard-striped frames at the mouths, lamps hanging in the
  // caverns (and on the hard maps, stalactites to dodge)
  decorTube(ctx, t) {
    if (!t.lit || t.x1 < ctx.x0 || t.x0 > ctx.x0 + 15 || t.z1 < ctx.z0 || t.z0 > ctx.z0 + 15) return;
    const p = t.pts, R = t.R, every = Math.max(1, Math.round(lerp(2, 3, t.d)));
    const setIfSolid = (x, y, z, v) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (!ctx.inside(x, z)) return true; const c = ctx.get(x, y, z); if (c > 0 && SOLID[c & 4095] && !FLUID[c & 4095]) { ctx.set(x, y, z, v); return true; } return false; };
    // a lamp set into the wall at an angle from the top (a little deeper if the bore's edge is right there)
    const lamp = (x, y, z, lx, lz, a, v) => { for (const rr of [R + 0.8, R + 1.6, R + 2.4]) if (setIfSolid(x + lx * Math.sin(a) * rr, y + Math.cos(a) * rr, z + lz * Math.sin(a) * rr, v)) return; };
    for (let i = 1; i < t.n - 1; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      if (x + R + 4 < ctx.x0 || x - R - 4 > ctx.x0 + 15 || z + R + 4 < ctx.z0 || z - R - 4 > ctx.z0 + 15) continue;
      let tx = p[i * 3 + 3] - p[i * 3 - 3], tz = p[i * 3 + 5] - p[i * 3 - 3 + 2]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      const lx = -tz, lz = tx;
      if (t.under[i]) {
        if (i % every === 0) for (const s of [-1, 1]) lamp(x, y, z, lx * s, lz * s, 0.87, t.free ? B.shroomlight : B.sea_lantern);
        // a dashed centre line down the floor with a glowing stud in every other dash
        for (let k = 0; k < 8; k += 4) for (let m = 0; m < 2; m++) for (const rr of [R + 0.4, R + 1.2]) if (setIfSolid(x + tx * (k + m), y - rr, z + tz * (k + m), k === 0 && m === 0 && (i & 1) ? B.ochre_froglight : B.yellow_concrete)) break;
      }
      // a frame where the tunnel enters the rock
      if (t.under[i] !== t.under[i - 1] && (t.under[i] || t.under[i - 1])) this.portalRing(ctx, x, y, z, tx, tz, R, t.free);
    }
    const d = t.d;
    for (const cv of t.caves) {
      for (let gz = Math.floor((cv.z - cv.rx) / 6); gz <= Math.floor((cv.z + cv.rx) / 6); gz++) for (let gx = Math.floor((cv.x - cv.rx) / 6); gx <= Math.floor((cv.x + cv.rx) / 6); gx++) {
        const hh = hashF2(this.seed ^ 0xCA7E, gx, gz), x = gx * 6 + Math.floor(hh * 5), z = gz * 6 + Math.floor(hashF2(this.seed ^ 0xCA7F, gx, gz) * 5);
        if (!ctx.inside(x, z)) continue;
        const qx = (x + 0.5 - cv.x) / cv.rx, qz = (z + 0.5 - cv.z) / cv.rx, q = 1 - qx * qx - qz * qz; if (q <= 0.05) continue;
        const ceil = Math.floor(cv.y + cv.ry * Math.sqrt(q));
        if (hh < 0.45) { for (let k = 0; k < 1 + (hh * 7 | 0) % 3; k++) if (ctx.get(x, ceil - k, z) === 0) ctx.set(x, ceil - k, z, B.glowstone); }
        else if (hh < 0.45 + d * 0.35) {
          // a stalactite hanging into the flight path
          const len = 3 + Math.floor(hashF2(this.seed ^ 0x57A1, gx, gz) * cv.ry * 0.6);
          for (let k = 0; k < len; k++) if (ctx.get(x, ceil - k, z) === 0) ctx.set(x, ceil - k, z, k === len - 1 ? B.pointed_dripstone : B.dripstone_block);
        }
      }
    }
  }
  portalRing(ctx, x, y, z, tx, tz, R, free) {
    const r0 = R + 0.3, r1 = R + 2.6, ext = Math.ceil(r1) + 1;
    for (let zz = Math.max(ctx.z0, Math.floor(z - ext)); zz <= Math.min(ctx.z0 + 15, Math.floor(z + ext)); zz++) for (let xx = Math.max(ctx.x0, Math.floor(x - ext)); xx <= Math.min(ctx.x0 + 15, Math.floor(x + ext)); xx++) {
      const dx = xx + 0.5 - x, dz = zz + 0.5 - z, a = dx * tx + dz * tz; if (a < -1.2 || a > 1.2) continue;
      const u = -dx * tz + dz * tx;
      for (let yy = Math.max(2, Math.floor(y - r1)); yy <= Math.min(CH - 2, Math.ceil(y + r1)); yy++) {
        const v = yy + 0.5 - y, rr = u * u + v * v; if (rr < r0 * r0 || rr > r1 * r1) continue;
        const seg = Math.floor((Math.atan2(v, u) / SKY_TAU + 1) * 16) & 1;
        ctx.set(xx, yy, zz, free ? (seg ? B.polished_andesite : B.stone_bricks) : seg ? B.yellow_concrete : B.black_concrete);
      }
    }
  }
  // ---------------------------------------------------------------- course gates and boost rings
  buildRing(ctx, g) {
    const R = g.R, Ro = R + 1.8, th = 1.0, ext = Math.ceil(Ro) + 2, M = this.gateMats[g.k], nseg = g.k === 2 ? 16 : 8;
    for (let z = Math.max(ctx.z0, Math.floor(g.z - ext)); z <= Math.min(ctx.z0 + 15, Math.floor(g.z + ext)); z++) for (let x = Math.max(ctx.x0, Math.floor(g.x - ext)); x <= Math.min(ctx.x0 + 15, Math.floor(g.x + ext)); x++) {
      const dx = x + 0.5 - g.x, dz = z + 0.5 - g.z, a = dx * g.nx + dz * g.nz; if (a < -th || a > th) continue;
      const u = -dx * g.nz + dz * g.nx; if (u > Ro || u < -Ro) continue;
      for (let y = Math.max(2, Math.floor(g.y - Ro)); y <= Math.min(CH - 2, Math.ceil(g.y + Ro)); y++) {
        const v = y + 0.5 - g.y, rr = u * u + v * v; if (rr < R * R || rr > Ro * Ro) continue;
        ctx.set(x, y, z, M[Math.floor((Math.atan2(v, u) / SKY_TAU + 1) * nseg) & 1]);
      }
    }
    const nl = g.k === 3 ? 6 : 12, Rm = R + 0.9;
    for (let k = 0; k < nl; k++) {
      const t = (k + 0.5) / nl * SKY_TAU, x = Math.floor(g.x - g.nz * Math.cos(t) * Rm), z = Math.floor(g.z + g.nx * Math.cos(t) * Rm), y = Math.floor(g.y + Math.sin(t) * Rm);
      if (ctx.inside(x, z)) ctx.set(x, y, z, M[2]);
    }
  }
  // ---------------------------------------------------------------- islands: waterfalls, chains, hanging vines
  decorIsland(ctx, s) {
    if (s.fall !== undefined) {
      const ca = Math.cos(s.fall), sa = Math.sin(s.fall);
      let last = null, first = null, stream = [];
      for (let t = 0; t < s.R * 1.4; t += 0.5) {
        const x = Math.floor(s.x + ca * t), z = Math.floor(s.z + sa * t), sp = this.isleSpan(s, x + 0.5, z + 0.5);
        if (sp) { last = [x, z, sp[1]]; if (t > s.R * 0.5) stream.push(last); }
        else if (last) { first = [x, z]; break; }
      }
      if (last && first) {
        for (const [x, z, y] of stream) if (ctx.inside(x, z) && y === last[2] && (ctx.get(x, y, z) & 4095) === B.grass_block) ctx.set(x, y, z, B.water);
        if (ctx.inside(first[0], first[1])) {
          const [x, z] = first;
          for (let y = last[2]; y > 1; y--) {
            const id = ctx.get(x, y, z) & 4095;
            if (id === 0 || PLANT[id] || LEAVES[id]) { ctx.set(x, y, z, B.water | (8 << 12)); continue; }
            if (!FLUID[id]) { ctx.set(x, y, z, B.water); for (let f = 0; f < 4; f++) { const ax = x + FACING_DX[f], az = z + FACING_DZ[f]; if (ctx.inside(ax, az) && OPAQUE[ctx.get(ax, y, az) & 4095] && ctx.get(ax, y + 1, az) === 0) ctx.set(ax, y, az, B.water); } }
            break;
          }
        }
      }
    }
    if (s.chains) for (const [a, rf] of s.chains) {
      const x = Math.floor(s.x + Math.cos(a) * s.R * rf), z = Math.floor(s.z + Math.sin(a) * s.R * rf);
      if (!ctx.inside(x, z)) continue;
      const sp = this.isleSpan(s, x + 0.5, z + 0.5); if (!sp) continue;
      for (let y = sp[0] - 1; y > 2 && ctx.get(x, y, z) === 0; y--) ctx.set(x, y, z, B.chain);
    }
    // vines down the rim
    const nv = Math.floor(s.R * 0.8);
    for (let k = 0; k < nv; k++) {
      const a = hashF2(s.salt, k, 1) * SKY_TAU, ca = Math.cos(a), sa = Math.sin(a);
      let x = Math.floor(s.x + ca * s.R * 0.6), z = Math.floor(s.z + sa * s.R * 0.6), sp = null;
      for (let t = s.R * 0.6; t < s.R * 1.4; t += 0.5) {
        const xx = Math.floor(s.x + ca * t), zz = Math.floor(s.z + sa * t), q = this.isleSpan(s, xx + 0.5, zz + 0.5);
        if (q) { x = xx; z = zz; sp = q; } else break;
      }
      if (!sp) continue;
      const f = Math.abs(ca) > Math.abs(sa) ? (ca > 0 ? 1 : 3) : (sa > 0 ? 2 : 0), vx = x + FACING_DX[f], vz = z + FACING_DZ[f];
      if (!ctx.inside(vx, vz)) continue;
      const len = 3 + Math.floor(hashF2(s.salt, k, 2) * 9), meta = VINE_META_TOWARD[(f + 2) & 3];
      for (let i = 0; i < len; i++) { const y = sp[1] - 1 - i; if (ctx.get(vx, y, vz) !== 0) break; ctx.set(vx, y, vz, B.vine | (meta << 12)); }
    }
  }
  // vines hanging off spire caps
  vines(ctx, s) {
    if (s.needle) return;
    const P = this.spireProf(s), k0 = s.top - s.base, rt = P.r[k0], cx = s.x + s.lx * k0, cz = s.z + s.lz * k0, nv = Math.floor(rt * 1.4);
    for (let k = 0; k < nv; k++) {
      const a = hashF2(this.seed ^ 0x71E5, s.gi * 64 + k, s.gj) * SKY_TAU, ca = Math.cos(a), sa = Math.sin(a);
      const f = Math.abs(ca) > Math.abs(sa) ? (ca > 0 ? 1 : 3) : (sa > 0 ? 2 : 0);
      let x = -1, z = -1;
      for (let t = rt * 0.5; t < rt * 1.6; t += 0.5) {
        const xx = Math.floor(cx + ca * t), zz = Math.floor(cz + sa * t);
        if (!this.spireSolid(s, xx + 0.5, s.top - 1 + 0.5, zz + 0.5)) break;
        x = xx; z = zz;
      }
      if (x < 0 && z < 0) continue;
      const vx = x + FACING_DX[f], vz = z + FACING_DZ[f];
      if (!ctx.inside(vx, vz)) continue;
      const len = 4 + Math.floor(hashF2(this.seed ^ 0x71E6, s.gi * 64 + k, s.gj) * 22), meta = VINE_META_TOWARD[(f + 2) & 3];
      for (let i = 0; i < len; i++) { const y = s.top - 1 - i; if (y < 2 || ctx.get(vx, y, vz) !== 0) break; ctx.set(vx, y, vz, B.vine | (meta << 12)); }
    }
  }
  // ---------------------------------------------------------------- the airfields
  buildAirfield(ctx, af) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, Y = af.y, L = af.L, W = af.W, AB0 = W + 12, AD = af.AD, AA = af.AA;
    const put = (a, h, bb, v) => ctx.set(af.x + a * af.fx + bb * af.rx, Y + h, af.z + a * af.fz + bb * af.rz, v);
    const num0 = this.rwyNum(af.fx, af.fz), num1 = this.rwyNum(-af.fx, -af.fz), cs = af.home ? 2 : 1, rs = af.home ? 3 : 2;
    // a runway designator digit pixel, read by a pilot landing toward +a from the a = -L end (or -a from the other)
    const digit = (num, u, v) => {
      if (u < 0 || u >= 5 * rs) return false;
      const row = 4 - Math.floor(u / rs), w = 3 * cs, gap = cs, tot = 2 * w + gap; v += tot >> 1;
      if (v < 0 || v >= tot) return false;
      const di = v < w ? 0 : v >= w + gap ? 1 : -1; if (di < 0) return false;
      const col = Math.floor((v - (di ? w + gap : 0)) / cs);
      return SKY_DIGITS[+num[di]][row * 3 + col] === '1';
    };
    for (let z = z0; z < z0 + 16; z++) for (let x = x0; x < x0 + 16; x++) {
      const dx = x - af.x, dz = z - af.z, a = dx * af.fx + dz * af.fz, bb = dx * af.rx + dz * af.rz;
      if (Math.abs(a) > af.padA + 70 || bb < -W - 12 || bb > af.padB1) continue;
      const col = ((z - z0) << 4) | (x - x0), ab = Math.abs(bb);
      let v = 0;
      if (Math.abs(a) <= L && ab <= W) {
        const aa = a + L, ae = L - a;
        v = B.gray_concrete;
        if (ab === W) v = B.white_concrete;
        else if ((aa >= 2 && aa <= 8 || ae >= 2 && ae <= 8) && ab <= W - 2 && bb !== 0 && ((bb + W) & 1) === 0) v = B.white_concrete;
        else if (digit(num0, aa - 12, bb) || digit(num1, ae - 12, -bb)) v = B.white_concrete;
        else if ((aa >= 12 + 5 * rs + 12 && aa < 12 + 5 * rs + 24 || ae >= 12 + 5 * rs + 12 && ae < 12 + 5 * rs + 24) && ab >= W - 3 && ab <= W - 2) v = B.white_concrete;
        else if (bb === 0 && aa > 12 + 5 * rs + 2 && ae > 12 + 5 * rs + 2 && ((aa - 12) % 14) < 8) v = B.white_concrete;
      } else if (ab === W + 1 && Math.abs(a) <= L && (a + L) % 8 === 0) v = B.sea_lantern;
      else if ((a === -L - 1 || a === L + 1) && ab <= W && (bb & 1) === 0) v = a < 0 ? B.verdant_froglight : B.ochre_froglight;
      else if (bb > W && bb < AB0) { for (const ta of af.home ? [0, -AA + 8, AA - 8] : [0]) if (Math.abs(a - ta) <= 3) v = a === ta ? B.yellow_concrete : B.light_gray_concrete; }
      else if (bb >= AB0 && bb <= AB0 + AD && Math.abs(a) <= AA) {
        const pa = a - (-AA + 9), pb = bb - (AB0 + 8);
        if (Math.abs(pa) <= 6 && Math.abs(pb) <= 6) {
          // the service pad: land or taxi onto it and stop to repair and rearm
          if (Math.max(Math.abs(pa), Math.abs(pb)) >= 5) v = ((pa + pb) & 2) ? B.yellow_concrete : B.black_concrete;
          else if ((Math.abs(pa) <= 1 && Math.abs(pb) <= 3) || (Math.abs(pb) <= 1 && Math.abs(pa) <= 3)) v = B.red_concrete;
          else v = B.white_concrete;
        } else if (bb === AB0 || (((a + AA) % 16) === 0 && bb > AB0 + 2 && bb < AB0 + AD - 2)) v = B.yellow_concrete;
        else v = B.light_gray_concrete;
      }
      if (v) {
        b[(Y << 8) | col] = v;
        // nothing growing or standing on the pavement
        for (let y = Y + 1; y < Math.min(CH - 1, Y + 6); y++) { const id = b[(y << 8) | col] & 4095; if (id && (PLANT[id] || LEAVES[id] || id === B.snow_layer)) b[(y << 8) | col] = 0; }
      }
    }
    // approach lights off both ends: a row of lamps on posts with a crossbar, down at runway height
    for (const e of [-1, 1]) for (let k = 0; k < 10; k++) {
      const a = e * (L + 6 + k * 6);
      for (const bb of k === 5 ? [-6, -4, -2, 0, 2, 4, 6] : [0]) {
        const x = af.x + a * af.fx + bb * af.rx, z = af.z + a * af.fz + bb * af.rz; if (!ctx.inside(x, z)) continue;
        let gy = CH - 2; while (gy > 1 && !SOLID[ctx.get(x, gy, z) & 4095]) gy--;
        const ly = Math.max(gy + 1, Y);
        for (let y = gy + 1; y < ly; y++) ctx.set(x, y, z, B.cobblestone_wall);
        ctx.set(x, ly, z, e < 0 ? B.sea_lantern : B.ochre_froglight);
      }
    }
    // windsock by the threshold
    const wa = -L + 20, wb = -W - 7;
    for (let h = 1; h <= 6; h++) put(wa, h, wb, B.oak_fence);
    put(wa + 1, 6, wb, B.orange_wool); put(wa + 2, 6, wb, B.white_wool); put(wa + 3, 6, wb, B.orange_wool);
    // hangars along the back of the apron
    const hb = AB0 + AD + 1;
    if (af.home) { this.hangar(put, -38, hb, 11, af.HD - 1); this.hangar(put, -12, hb, 11, af.HD - 1); this.tower(put, 30, hb + 8); this.tanks(put, 50, hb + 4); }
    else { this.hangar(put, -12, hb, 6, af.HD - 1); for (let h = 1; h <= 14; h++) put(AA + 3, h, AB0 + 2, B.cobblestone_wall); put(AA + 3, 15, AB0 + 2, B.sea_lantern); put(AA + 3, 16, AB0 + 2, B.end_rod); }
    // parked aircraft facing the runway (spawn once, with the chunk they stand in)
    const yaw = Math.atan2(-af.rx, af.rz), park = af.home ? [['jet', -40], ['jet', -22], ['fighter', -4], ['bomber', 16], ['gunship', 36]] : this.stripPlane(af);
    for (const [kind, a] of park) {
      const bb = AB0 + (af.home ? 16 : 9), x = af.x + a * af.fx + bb * af.rx + 0.5, z = af.z + a * af.fz + bb * af.rz + 0.5;
      if (ctx.inside(Math.floor(x), Math.floor(z))) ctx.spawn('vehicle', x, Y + 1.05, z, { kind, yaw });
    }
  }
  stripPlane(af) {
    const h = hashF2(this.seed ^ 0x9A4C, af.i, af.j);
    if (h > 0.45) return [];
    return [[h < 0.32 ? 'jet' : h < 0.39 ? 'fighter' : 'bomber', 6]];
  }
  // a quonset hangar: a half-cylinder shell along b, open toward the runway
  hangar(put, ac, b0, Rh, depth) {
    for (let a = -Rh; a <= Rh; a++) for (let bb = 0; bb <= depth; bb++) {
      const u = Math.abs(a), yr = Math.floor(Math.sqrt(Math.max(0, Rh * Rh - u * u))), yIn = u > 0 ? Math.floor(Math.sqrt(Math.max(0, Rh * Rh - (u - 1) * (u - 1)))) : yr;
      put(ac + a, 0, b0 + bb, B.smooth_stone);
      for (let h = 1; h <= yr; h++) put(ac + a, h, b0 + bb, bb === depth ? B.light_gray_concrete : 0);
      for (let h = yr; h <= Math.max(yr, yIn - 1); h++) put(ac + a, h + 1, b0 + bb, bb % 6 === 0 ? B.white_concrete : B.light_gray_concrete);
      if (a === 0 && bb % 6 === 3) put(ac, yr, b0 + bb, B.sea_lantern);
    }
  }
  // control tower with a glass cab and a beacon
  tower(put, ta, tb) {
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const edge = Math.abs(a) === 3 || Math.abs(b) === 3, corner = Math.abs(a) === 3 && Math.abs(b) === 3;
      for (let h = 1; h <= 18; h++) put(ta + a, h, tb + b, !edge ? 0 : corner ? B.quartz_pillar : (h % 5 === 3 && Math.abs(a) + Math.abs(b) < 5 ? B.glass : B.white_concrete));
    }
    put(ta, 1, tb - 3, 0); put(ta, 2, tb - 3, 0);
    for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
      const edge = Math.abs(a) === 4 || Math.abs(b) === 4;
      put(ta + a, 19, tb + b, B.smooth_quartz);
      for (let h = 20; h <= 22; h++) put(ta + a, h, tb + b, edge ? B.glass : 0);
      put(ta + a, 23, tb + b, edge ? B.white_concrete : B.light_gray_concrete);
    }
    put(ta, 24, tb, B.sea_lantern); put(ta, 25, tb, B.end_rod); put(ta, 26, tb, B.end_rod);
  }
  tanks(put, ta, tb) {
    for (const ob of [0, 10]) for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      if (a * a + b * b > 11) continue;
      for (let h = 1; h <= 6; h++) put(ta + a, h, tb + ob + b, h === 4 ? B.red_concrete : h === 6 ? B.light_gray_concrete : B.white_concrete);
    }
  }
  // ---------------------------------------------------------------- surface, water, snow
  surface(ctx, C, H, ground) {
    const b = ctx.b, x0 = ctx.x0, z0 = ctx.z0, nS = this.g.nSurf;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const i = (z + 1) * 18 + x + 1, c = C[i], n = c.nat, t = ground[z * 16 + x], xz = (z << 4) | x;
      if (t < 1 || (b[((t + 1) << 8) | xz] && !FLUID[b[((t + 1) << 8) | xz] & 4095])) continue;   // a feature stands on it
      const slope = Math.max(Math.abs(H[i + 1] - H[i - 1]), Math.abs(H[i + 18] - H[i - 18])), sn = nS.n2((x0 + x) / 12, (z0 + z) / 12);
      let depth = -1;
      for (let y = t; y >= Math.max(1, t - 6); y--) {
        const p = (y << 8) | xz, id = b[p];
        if (!id) { depth = -1; continue; }
        if (++depth > 4) break;
        const v = this.surfBlock(c, n, y, depth, slope, sn, t);
        if (v) b[p] = v;
      }
    }
  }
  surfBlock(c, n, y, depth, slope, sn, t) {
    const under = t < SEA, dirt = depth === 0 ? B.grass_block : depth < 3 ? B.dirt : 0;
    switch (n.zt) {
      case SKZ.CANYON:
        if (n.cold > 0.5) { if (under) return depth < 2 ? (sn > 0.3 ? B.sand : B.gravel) : 0; return slope > 2.4 ? 0 : dirt; }
        if (under) return depth < 3 ? (sn > 0.45 ? B.gravel : B.sand) : 0;
        if (t <= SEA + 1 && n.eA < Math.max(3, n.fwA * 0.4) * 1.7) return depth < 3 ? B.sand : 0;
        if (slope > 2.2) return 0;
        if (t > n.cF + (n.cP - n.cF) * 0.85) return depth === 0 ? (sn > 0.55 ? B.coarse_dirt : sn < -0.45 ? B.grass_block : B.red_sand) : depth < 3 ? (sn < -0.45 ? B.dirt : B.red_sand) : 0;
        return depth === 0 ? (sn > 0.2 ? B.grass_block : sn < -0.4 ? B.coarse_dirt : B.red_sand) : depth < 3 ? B.dirt : 0;
      case SKZ.SPIRES:
        if (under) return depth < 3 ? (sn > 0.5 ? B.gravel : sn < -0.55 ? B.clay : B.sand) : 0;
        if (n.sv < 0.5 && t <= SEA + 2) return depth < 3 ? B.sand : 0;
        return depth === 0 && n.sv >= 0.5 && sn > 0.45 ? B.podzol : dirt;
      case SKZ.PEAKS:
        if (under) return depth < 2 ? B.gravel : 0;
        if (t > 152 + n.det * 8) return depth < 2 ? B.snow : 0;
        if (slope > 2.3) return depth === 0 && sn > 0.55 ? B.gravel : 0;
        if (t > 130 + n.det * 6 && sn > 0.15) return 0;
        return depth === 0 && sn > 0.6 ? B.coarse_dirt : dirt;
      default:
        if (under) return depth < 3 ? (sn > 0.4 ? B.gravel : sn < -0.5 ? B.clay : B.sand) : 0;
        if (t <= SEA + 1 && c.h < SEA + 1.4 && sn > -0.3) return depth < 3 ? B.sand : 0;
        return slope > 3.2 ? 0 : dirt;
    }
  }
  water(ctx, C, ground) {
    const b = ctx.b;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const t = ground[z * 16 + x]; if (t >= SEA) continue;
      const c = C[(z + 1) * 18 + x + 1], frozen = c.cold > 0.5 && (c.zt !== SKZ.CANYON || hashF2(this.seed ^ 0x1CE, ctx.x0 + x, ctx.z0 + z) < 0.3 + this.nVar.n2((ctx.x0 + x) / 18, (ctx.z0 + z) / 18) * 0.5);
      for (let y = t + 1; y <= SEA; y++) { const p = (y << 8) | (z << 4) | x; if (!b[p]) b[p] = y === SEA && frozen ? B.ice : B.water; }
    }
  }
  snow(ctx, C) {
    const b = ctx.b;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const c = C[(z + 1) * 18 + x + 1], bio = BIOMES[c.biome];
      let y = CH - 2; while (y > 0 && b[(y << 8) | (z << 4) | x] === 0) y--;
      const cold = bio.snowy || c.cold > 0.5 || (c.zt === SKZ.PEAKS && y > 148 + c.nat.det * 8);
      if (!cold || y >= CH - 2) continue;
      const p = (y << 8) | (z << 4) | x, id = b[p] & 4095;
      if (id === B.water && (b[p] >> 12) === 0) { b[p] = B.ice; continue; }
      if ((OPAQUE[id] || LEAVES[id]) && id !== B.ice && id !== B.packed_ice && id !== B.blue_ice && !EMIT[id]) b[p + 256] = B.snow_layer;
    }
  }
  // ---------------------------------------------------------------- trees
  // ground trees per 16x16 cell (from the 3x3 neighbourhood, so crowns cross chunk borders), never on airfields, in
  // approach corridors or near a gate; and trees on spire caps and island tops
  trees(ctx, F) {
    for (let ncz = ctx.cz - 1; ncz <= ctx.cz + 1; ncz++) for (let ncx = ctx.cx - 1; ncx <= ctx.cx + 1; ncx++) {
      const r = new RNG(hash2(this.seed ^ 0x7EE5, ncx, ncz)), b0 = BIOMES[this.g.climateCached(ncx * 16 + 8, ncz * 16 + 8).biome];
      let n = Math.floor(b0.trees); if (r.next() < b0.trees - n) n++;
      for (let k = 0; k < n; k++) {
        const lx = r.int(16), lz = r.int(16), r2 = r.u32(), r3 = r.next(), wx = ncx * 16 + lx, wz = ncz * 16 + lz;
        if (wx < ctx.x0 - 9 || wx > ctx.x0 + 24 || wz < ctx.z0 - 9 || wz > ctx.z0 + 24) continue;
        const c = this.g.climateCached(wx, wz), bio = BIOMES[c.biome];
        if (!bio.treeTypes || c.af || c.h < SEA + 0.5 || c.cs >= 0) continue;
        const y = Math.ceil(c.h) - 1;
        if (Math.abs(this.g.climateCached(wx + 1, wz).h - this.g.climateCached(wx - 1, wz).h) > 2.4 || Math.abs(this.g.climateCached(wx, wz + 1).h - this.g.climateCached(wx, wz - 1).h) > 2.4) continue;
        if (this.airspace(wx, wz, y + 14) || this.treeBlocked(F, wx, wz, y + 16)) continue;
        const type = weightedPick(bio.treeTypes, r3);
        if ((type === 'mega_jungle' || type === 'big_oak') && this.featSolid(wx, y + 12, wz, c, false)) continue;
        placeTree(ctx, type, new RNG(r2), wx, y + 1, wz);
      }
    }
    for (const s of F.islands) {
      const r = new RNG(s.salt ^ 0x7EE), n = Math.floor(s.R * s.R / 110 + r.next() * 2);
      for (let k = 0; k < n; k++) {
        const a = r.next() * SKY_TAU, d = Math.sqrt(r.next()) * s.R * 0.6, wx = Math.floor(s.x + Math.cos(a) * d), wz = Math.floor(s.z + Math.sin(a) * d), r2 = r.u32(), r3 = r.next();
        const sp = this.isleSpan(s, wx + 0.5, wz + 0.5); if (!sp || this.treeBlocked(F, wx, wz, sp[1] + 14)) continue;
        placeTree(ctx, s.cold ? (r3 < 0.6 ? 'spruce' : 'pine') : weightedPick([['oak', 40], ['birch', 25], ['cherry', 18], ['big_oak', 17]], r3), new RNG(r2), wx, sp[1] + 1, wz);
      }
    }
    for (const s of F.spires) {
      if (s.needle) continue;
      const P = this.spireProf(s), k0 = s.top - s.base, rt = P.r[k0] * 0.85; if (rt < 4) continue;
      const r = new RNG(hash2(this.seed ^ 0x5B7EE, s.gi, s.gj)), n = 1 + Math.floor(rt / 4.5);
      for (let k = 0; k < n; k++) {
        const a = r.next() * SKY_TAU, d = r.next() * rt * 0.45, wx = Math.floor(s.x + s.lx * k0 + Math.cos(a) * d), wz = Math.floor(s.z + s.lz * k0 + Math.sin(a) * d), r2 = r.u32(), r3 = r.next();
        if (!this.spireSolid(s, wx + 0.5, s.top + 0.5, wz + 0.5) || this.treeBlocked(F, wx, wz, s.top + 14)) continue;
        placeTree(ctx, weightedPick([['jungle_bush', 45], ['oak', 30], ['jungle', 25]], r3), new RNG(r2), wx, s.top + 1, wz);
      }
    }
  }
  // would a tree up to height y at (x, z) reach into a gate's ring or its approach?
  treeBlocked(F, x, z, y) {
    for (const g of F.tgates) {
      const dx = x + 0.5 - g.x, dz = z + 0.5 - g.z, a = dx * g.nx + dz * g.nz, u = -dx * g.nz + dz * g.nx;
      if (Math.abs(a) < 30 && Math.abs(u) < g.R + 8 && y > g.y - g.R - 6) return true;
    }
    for (const f of F.tfeats) if (Math.abs(x - f.x) < f.reach + 4 && Math.abs(z - f.z) < f.reach + 4) return true;
    const px = x + 0.5, pz = z + 0.5;
    for (const s of F.tsegs) {
      const dx = s[3] - s[0], dz = s[5] - s[2], L2 = dx * dx + dz * dz || 1, t = clamp(((px - s[0]) * dx + (pz - s[2]) * dz) / L2, 0, 1);
      const ex = s[0] + dx * t - px, ez = s[2] + dz * t - pz;
      if (ex * ex + ez * ez < s[6] * s[6] && y > s[1] + (s[4] - s[1]) * t - s[7] - 4) return true;
    }
    return false;
  }
  animals(ctx, C, cx, cz) {
    if (hashF2(this.seed ^ 0xA11, cx, cz) >= 0.12) return;
    const bio = BIOMES[C[9 * 18 + 9].biome]; if (!bio.animals) return;
    const b = ctx.b, ar = new RNG(hash2(this.seed ^ 0xA12, cx, cz)), type = ar.pick(bio.animals), n = ar.range(2, 4);
    for (let k = 0; k < n; k++) {
      const x = ar.range(2, 13), z = ar.range(2, 13);
      let y = CH - 2; while (y > 0 && b[(y << 8) | (z << 4) | x] === 0) y--;
      const id = b[(y << 8) | (z << 4) | x] & 4095;
      if (id === B.grass_block || id === B.snow_layer) ctx.spawn(type, ctx.x0 + x + 0.5, y + 1, ctx.z0 + z + 0.5);
    }
  }
}
