// ============================================================================
//  Vehicle HUDs: 2D canvas overlay drawn after the 3D frame.
//  Every stroke is drawn twice (wide + faint, then thin + bright) for a
//  phosphor glow without shadowBlur cost.
// ============================================================================
class VehicleHUD {
  constructor(game) {
    this.game = game;
    this.cv = h('canvas', { id: 'vhud' });
    document.body.insertBefore(this.cv, $('#ui'));
    this.ctx = this.cv.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1; this.visible = false; this.t = 0; this.beepT = 0; this.warnT = 0;
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = window.innerWidth, hh = window.innerHeight;
    if (w === this.w && hh === this.h && dpr === this.dpr) return;
    this.w = w; this.h = hh; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(hh * dpr);
  }
  proj(x, y, z) {
    const R = this.game.renderer, m = R.vp, rx = x - R.camX, ry = y - R.camY, rz = z - R.camZ;
    const cw = m[3] * rx + m[7] * ry + m[11] * rz + m[15];
    if (cw <= 0.05) return null;
    const nx = (m[0] * rx + m[4] * ry + m[8] * rz + m[12]) / cw, ny = (m[1] * rx + m[5] * ry + m[9] * rz + m[13]) / cw;
    return [(nx * 0.5 + 0.5) * this.w, (0.5 - ny * 0.5) * this.h];
  }
  projDir(dx, dy, dz) { const R = this.game.renderer; return this.proj(R.camX + dx * 1000, R.camY + dy * 1000, R.camZ + dz * 1000); }
  draw(dt) {
    const g = this.game, p = g.player, v = p && p.vehicle;
    this.t += dt;
    const show = !!(v && (g.state === 'playing' || g.state === 'paused') && !SETTINGS.hudHidden);
    if (!show) { if (this.visible) { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); this.cv.style.display = 'none'; this.visible = false; g.audio.loop('locked', this, 0); } return; }
    if (!this.visible) { this.visible = true; this.cv.style.display = 'block'; }
    this.resize();
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    c.lineCap = 'round'; c.lineJoin = 'round';
    this.fs = clamp(Math.round(this.h / 58), 11, 17);
    if (v.kind === 'jet' || v.kind === 'bomber') this.jet(c, v, dt);
    else if (v.kind === 'gunship') this.gunship(c, v, dt);
    else if (v.kind === 'tank') this.tank(c, v, dt);
    else this.bike(c, v, dt);
    if (v.mountT > 0) this.controls(v);
  }
  // ------------------------------------------------------------ primitives
  setCol(col) { this.col = col; }
  stroke(path) {
    const c = this.ctx;
    c.strokeStyle = this.col; c.globalAlpha = 0.16; c.lineWidth = 5; path(c); c.stroke();
    c.globalAlpha = 1; c.lineWidth = 1.6; c.stroke();
  }
  line(x0, y0, x1, y1) { this.stroke((c) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); }); }
  poly(pts, close) { this.stroke((c) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close) c.closePath(); }); }
  circle(x, y, r) { this.stroke((c) => { c.beginPath(); c.arc(x, y, r, 0, TAU); }); }
  arc(x, y, r, a0, a1) { this.stroke((c) => { c.beginPath(); c.arc(x, y, r, a0, a1); }); }
  text(s, x, y, align, size, col) {
    const c = this.ctx;
    c.font = `600 ${size || this.fs}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
    c.textAlign = align || 'center'; c.textBaseline = 'middle';
    c.globalAlpha = 0.55; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(s, x + 1, y + 1);
    c.globalAlpha = 1; c.fillStyle = col || this.col; c.fillText(s, x, y);
  }
  bar(x, y, w, hgt, f, col, back) {
    const c = this.ctx;
    c.globalAlpha = 0.28; c.fillStyle = back || '#000'; c.fillRect(x, y, w, hgt);
    c.globalAlpha = 1; c.fillStyle = col || this.col;
    if (w > hgt) c.fillRect(x, y, w * clamp(f, 0, 1), hgt); else c.fillRect(x, y + hgt * (1 - clamp(f, 0, 1)), w, hgt * clamp(f, 0, 1));
    c.strokeStyle = this.col; c.lineWidth = 1; c.globalAlpha = 0.7; c.strokeRect(x + 0.5, y + 0.5, w - 1, hgt - 1); c.globalAlpha = 1;
  }
  pips(x, y, n, max, col) {
    const c = this.ctx, s = Math.round(this.fs * 0.55);
    for (let i = 0; i < max; i++) {
      const px = x + i * (s + 3);
      c.globalAlpha = i < n ? 1 : 0.25; c.fillStyle = col || this.col; c.fillRect(px, y, s, s * 1.8);
    }
    c.globalAlpha = 1;
  }
  flash(rate) { return (this.t * (rate || 3)) % 1 < 0.6; }
  // heading tape across the top
  headingTape(cx, y, width, hdg) {
    const c = this.ctx, deg = ((hdg / DEG) % 360 + 360) % 360, span = 50, px = width / span;
    c.save(); c.beginPath(); c.rect(cx - width / 2, y - this.fs * 2, width, this.fs * 3.2); c.clip();
    for (let d = Math.floor((deg - span / 2) / 5) * 5; d <= deg + span / 2; d += 5) {
      const x = cx + (d - deg) * px, dd = ((d % 360) + 360) % 360;
      const major = dd % 10 === 0;
      this.line(x, y, x, y - (major ? this.fs * 0.7 : this.fs * 0.35));
      if (dd % 30 === 0) { const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd]; this.text(lab || String(dd / 10).padStart(2, '0'), x, y - this.fs * 1.35, 'center', this.fs * 0.9); }
    }
    c.restore();
    this.poly([cx - 5, y + 9, cx, y + 3, cx + 5, y + 9]);
    this.text(String(Math.round(deg) % 360).padStart(3, '0'), cx, y + this.fs * 1.4, 'center', this.fs);
  }
  // vertical tape (speed / altitude)
  tape(x, cy, hgt, val, step, labelEvery, right, fmt, title) {
    const c = this.ctx, span = step * 12, px = hgt / span, fs = this.fs;
    c.save(); c.beginPath(); c.rect(x - (right ? 4 : fs * 5), cy - hgt / 2, fs * 5 + 4, hgt); c.clip();
    for (let s = Math.floor((val - span / 2) / step) * step; s <= val + span / 2; s += step) {
      const y = cy - (s - val) * px, major = Math.round(s / step) % labelEvery === 0;
      const l = major ? fs * 0.8 : fs * 0.4;
      this.line(x, y, right ? x + l : x - l, y);
      if (major) this.text(fmt(s), right ? x + l + 4 : x - l - 4, y, right ? 'left' : 'right', fs * 0.85);
    }
    c.restore();
    this.line(x, cy - hgt / 2, x, cy + hgt / 2);
    const bw = fs * 4.2, bh = fs * 1.6, bx = right ? x + 6 : x - 6 - bw;
    c.globalAlpha = 0.55; c.fillStyle = '#050805'; c.fillRect(bx, cy - bh / 2, bw, bh); c.globalAlpha = 1;
    this.poly([bx, cy - bh / 2, bx + bw, cy - bh / 2, bx + bw, cy + bh / 2, bx, cy + bh / 2], true);
    this.text(fmt(val), bx + bw / 2, cy, 'center', fs * 1.05);
    this.text(title, right ? x + 6 : x - 6, cy - hgt / 2 - fs * 0.9, right ? 'left' : 'right', fs * 0.8);
  }
  radar(cx, cy, r, v, range) {
    const c = this.ctx, g = this.game;
    c.globalAlpha = 0.3; c.fillStyle = '#020402'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); c.globalAlpha = 1;
    this.circle(cx, cy, r); this.circle(cx, cy, r * 0.5);
    this.line(cx, cy - r, cx, cy - r + 6); this.line(cx - r, cy, cx - r + 6, cy); this.line(cx + r, cy, cx + r - 6, cy);
    const sw = (this.t * 1.6) % TAU;
    c.globalAlpha = 0.35; this.line(cx, cy, cx + Math.sin(sw) * r, cy - Math.cos(sw) * r); c.globalAlpha = 1;
    const hd = v.heading(), ch = Math.cos(hd), sh = Math.sin(hd);
    for (const e of g.world.entities) {
      if (e.removed || e === v || e.isPlayer && e.vehicle === v || !(e.isMob || e.isVehicle || e.isPlayer) || e.dead) continue;
      const dx = e.x - v.x, dz = e.z - v.z, d = Math.hypot(dx, dz);
      if (d > range) continue;
      // rotate into heading-up space
      const rx = dx * ch + dz * sh, rf = dx * sh - dz * ch;
      const bx = cx + rx / range * r, by = cy - rf / range * r;
      c.fillStyle = e.isMob && e.def.hostile ? '#FF6A3A' : e.isVehicle ? '#FFD23F' : this.col;
      c.fillRect(bx - 2, by - 2, 4, 4);
    }
    c.fillStyle = this.col; c.beginPath(); c.moveTo(cx, cy - 5); c.lineTo(cx + 4, cy + 4); c.lineTo(cx - 4, cy + 4); c.closePath(); c.fill();
  }
  hullBar(x, y, v) {
    const f = v.hull / v.def.hull, fs = this.fs;
    this.text('HULL', x, y, 'left', fs * 0.85);
    const col = f < 0.3 ? '#FF5A2E' : this.col;
    const n = 20, w = fs * 0.45;
    for (let i = 0; i < n; i++) { const c = this.ctx; c.globalAlpha = i / n < f ? 1 : 0.2; c.fillStyle = col; c.fillRect(x + fs * 3.3 + i * (w + 2), y - fs * 0.45, w, fs * 0.9); }
    this.ctx.globalAlpha = 1;
    this.text(Math.max(0, Math.round(f * 100)) + '%', x + fs * 3.3 + n * (w + 2) + 6, y, 'left', fs * 0.85, col);
  }
  targets(v, range, lockTarget, lockT, showAll) {
    const g = this.game, fs = this.fs;
    for (const e of g.world.entities) {
      if (e.removed || e.dead || !(e.isMob || (e.isVehicle && e !== v))) continue;
      const dx = e.x - v.x, dy = e.y - v.y, dz = e.z - v.z, d = Math.hypot(dx, dy, dz);
      if (d > range) continue;
      const s = this.proj(e.x, e.y + e.h * 0.5, e.z); if (!s) continue;
      if (e === lockTarget) continue;
      if (!showAll && d > range * 0.6) continue;
      const hostile = e.isMob && e.def.hostile;
      const q = Math.max(4, 9 - d / 40);
      const old = this.col; this.col = hostile ? '#FF7A3A' : old;
      this.poly([s[0], s[1] - q, s[0] + q, s[1], s[0], s[1] + q, s[0] - q, s[1]], true);
      this.col = old;
    }
    if (lockTarget && !lockTarget.dead && !lockTarget.removed) {
      const e = lockTarget, s = this.proj(e.x, e.y + e.h * 0.5, e.z);
      if (s) {
        const d = Math.hypot(e.x - v.x, e.y - v.y, e.z - v.z);
        const locked = lockT >= 1, old = this.col;
        this.col = locked ? '#FFD23F' : old;
        const b = clamp(260 / Math.max(d, 1), 14, 44);
        const k = b * 0.45;
        this.poly([s[0] - b, s[1] - b + k, s[0] - b, s[1] - b, s[0] - b + k, s[1] - b]);
        this.poly([s[0] + b - k, s[1] - b, s[0] + b, s[1] - b, s[0] + b, s[1] - b + k]);
        this.poly([s[0] - b, s[1] + b - k, s[0] - b, s[1] + b, s[0] - b + k, s[1] + b]);
        this.poly([s[0] + b - k, s[1] + b, s[0] + b, s[1] + b, s[0] + b, s[1] + b - k]);
        if (!locked) { const r = b * (2.4 - lockT * 1.6); this.poly([s[0], s[1] - r, s[0] + r, s[1], s[0], s[1] + r, s[0] - r, s[1]], true); }
        else if (this.flash(4)) this.text('LOCK', s[0], s[1] - b - fs, 'center', fs, '#FFD23F');
        this.text(Math.round(d) + 'm', s[0] + b + 6, s[1] + b, 'left', fs * 0.8);
        const nm = e.isMob ? titleCase(e.type) : e.def.name.split(' ')[0].toUpperCase();
        this.text(nm.toUpperCase(), s[0] + b + 6, s[1] - b, 'left', fs * 0.8);
        this.col = old;
      }
    }
  }
  weaponLine(x, y, label, f, over, col) {
    const fs = this.fs;
    this.text(label, x, y, 'left', fs * 0.9, over ? (this.flash(5) ? '#FF5A2E' : this.col) : col);
    this.bar(x + fs * 5.2, y - fs * 0.35, fs * 7, fs * 0.7, f, f > 0.8 || over ? '#FF6A2E' : (col || this.col));
  }
  warnings(v) {
    if (!v.warn) return;
    const W = this.w, H = this.h, fs = this.fs;
    if (this.flash(3)) {
      const old = this.col; this.col = '#FF4A26';
      this.text(v.warn, W / 2, H * 0.34, 'center', fs * 2.2, '#FF4A26');
      this.poly([W / 2 - fs * 7, H * 0.34 - fs * 1.6, W / 2 + fs * 7, H * 0.34 - fs * 1.6, W / 2 + fs * 7, H * 0.34 + fs * 1.6, W / 2 - fs * 7, H * 0.34 + fs * 1.6], true);
      this.col = old;
    }
    this.warnT -= 1 / 60;
    if (this.warnT <= 0) { this.warnT = 0.5; this.game.audio.play('warn', {}); }
  }
  lockAudio(v) {
    const a = this.game.audio;
    if (v.lock && v.lockT >= 1) a.loop('locked', this, 0.35);
    else {
      a.loop('locked', this, 0);
      if (v.lock) { this.beepT -= 1 / 60; if (this.beepT <= 0) { this.beepT = 0.16; a.play('lock', {}); } }
    }
  }
  // key hints shown for a few seconds after boarding
  controls(v) {
    const c = this.ctx, list = VEH_HELP[v.kind];
    let fs = Math.max(11, this.fs - 2);
    const a = Math.min(1, v.mountT / 1.5);
    const measure = () => { c.font = `600 ${fs}px ui-monospace, Menlo, Consolas, monospace`; let t = 0; const ws = list.map(([k, d]) => { const w = c.measureText(k).width + c.measureText(d).width + fs * 1.6; t += w; return w; }); return [t, ws]; };
    let [total, ws] = measure();
    if (total > this.w * 0.94) { fs = Math.max(7, Math.floor(fs * this.w * 0.94 / total)); [total, ws] = measure(); }
    let x = this.w / 2 - total / 2; const y = this.h - fs * 2.2;
    c.globalAlpha = 0.5 * a; c.fillStyle = '#000'; c.fillRect(x - fs, y - fs, total + fs * 2, fs * 2); c.globalAlpha = a;
    list.forEach(([k, d], i) => {
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillStyle = this.col; c.fillText(k, x, y);
      const kw = c.measureText(k).width;
      c.fillStyle = '#E8E4DA'; c.fillText(d, x + kw + fs * 0.5, y);
      x += ws[i];
    });
    c.globalAlpha = 1;
  }
  // ------------------------------------------------------------ STORMCROW
  jet(c, v, dt) {
    const W = this.w, H = this.h, cx = W / 2, cy = H / 2, fs = this.fs;
    this.col = '#A8FF52';
    const cen = v.center([0, 0, 0]), f = v.fwd, sp = v.speed;
    // aim ring (where the mouse points)
    this.circle(cx, cy, 9); this.line(cx - 16, cy, cx - 11, cy); this.line(cx + 11, cy, cx + 16, cy); this.line(cx, cy - 16, cx, cy - 11);
    // boresight (where the cannons point)
    const b = this.proj(cen[0] + f[0] * 600, cen[1] + f[1] * 600, cen[2] + f[2] * 600);
    if (b) { this.poly([b[0] - 18, b[1] - 3, b[0] - 9, b[1] + 6, b[0], b[1], b[0] + 9, b[1] + 6, b[0] + 18, b[1] - 3]); this.line(b[0], b[1] - 5, b[0], b[1] - 11); }
    // flight path marker
    if (sp > 3) {
      const fp = this.projDir(v.vel[0] / sp, v.vel[1] / sp, v.vel[2] / sp);
      if (fp) { this.circle(fp[0], fp[1], 7); this.line(fp[0] - 18, fp[1], fp[0] - 7, fp[1]); this.line(fp[0] + 7, fp[1], fp[0] + 18, fp[1]); this.line(fp[0], fp[1] - 7, fp[0], fp[1] - 13); }
    }
    // world-referenced pitch ladder around the nose heading
    const hd = v.heading(), sh = Math.sin(hd), ch = Math.cos(hd);
    const pitchNow = Math.asin(clamp(f[1], -1, 1)) / DEG;
    for (let a = -80; a <= 80; a += 10) {
      if (Math.abs(a - pitchNow) > 32) continue;
      const e = a * DEG, ce = Math.cos(e), se = Math.sin(e);
      const dx = sh * ce, dy = se, dz = -ch * ce, wd = a === 0 ? 0.3 : 0.1, gap = 0.03;
      const pts = [];
      for (const s of [-wd, -gap, gap, wd]) pts.push(this.projDir(dx + ch * s, dy, dz + sh * s));
      if (pts.some(p => !p)) continue;
      if (a >= 0) { this.line(pts[0][0], pts[0][1], pts[1][0], pts[1][1]); this.line(pts[2][0], pts[2][1], pts[3][0], pts[3][1]); }
      else {
        for (const [p0, p1] of [[pts[0], pts[1]], [pts[2], pts[3]]]) for (let k = 0; k < 3; k++) {
          const t0 = k / 3, t1 = t0 + 0.2;
          this.line(p0[0] + (p1[0] - p0[0]) * t0, p0[1] + (p1[1] - p0[1]) * t0, p0[0] + (p1[0] - p0[0]) * t1, p0[1] + (p1[1] - p0[1]) * t1);
        }
      }
      if (a !== 0) {
        const tick = a > 0 ? 7 : -7;
        this.line(pts[0][0], pts[0][1], pts[0][0], pts[0][1] + tick); this.line(pts[3][0], pts[3][1], pts[3][0], pts[3][1] + tick);
        this.text(String(Math.abs(a)), pts[0][0] - 14, pts[0][1], 'right', fs * 0.8); this.text(String(Math.abs(a)), pts[3][0] + 14, pts[3][1], 'left', fs * 0.8);
      }
    }
    // tapes
    const tapeH = Math.min(H * 0.42, 320);
    this.tape(cx - Math.min(W * 0.3, 330), cy, tapeH, sp * 3.6, 10, 5, false, (s) => String(Math.round(s)), 'KPH');
    this.tape(cx + Math.min(W * 0.3, 330), cy, tapeH, v.y, 5, 4, true, (s) => String(Math.round(s)), 'ALT');
    const agl = v.agl !== undefined && v.agl < 200 ? Math.round(v.agl) : '---';
    this.text('R ' + agl, cx + Math.min(W * 0.3, 330) + 6, cy + tapeH / 2 + fs, 'left', fs * 0.85);
    const vs = v.vel[1];
    this.text((vs >= 0 ? '+' : '') + vs.toFixed(0) + ' VS', cx + Math.min(W * 0.3, 330) + 6, cy + tapeH / 2 + fs * 2.2, 'left', fs * 0.85);
    this.headingTape(cx, fs * 3.2, Math.min(W * 0.4, 420), hd);
    // throttle + afterburner
    const tx = cx - Math.min(W * 0.3, 330) - fs * 6.5, ty = cy + tapeH / 2 + fs * 1.5;
    this.bar(tx, ty, fs * 0.9, fs * 7, v.throttle, v.boosting ? '#FFB23D' : this.col);
    this.bar(tx + fs * 1.4, ty, fs * 0.5, fs * 7, v.boost, '#FFB23D');
    this.text('THR ' + Math.round(v.throttle * 100), tx + fs * 2.4, ty + fs * 0.4, 'left', fs * 0.85);
    if (v.boosting) this.text('AFTERBURNER', tx + fs * 2.4, ty + fs * 1.7, 'left', fs * 0.85, '#FFB23D');
    if (v.gear > 0.5) this.text('GEAR DN', tx + fs * 2.4, ty + fs * 3.0, 'left', fs * 0.85);
    if (v.onGround) this.text('TAXI', tx + fs * 2.4, ty + fs * 4.3, 'left', fs * 0.85);
    // targets + lock
    this.targets(v, 320, v.lock, v.lockT, true);
    // weapons
    const wx = cx + Math.min(W * 0.3, 330) - fs * 6, wy = H - fs * 7.5;
    this.weaponLine(wx, wy, 'PLASMA', v.heat, v.overheat > 0);
    if (v.kind === 'bomber') {
      this.text('BOMBS', wx, wy + fs * 1.8, 'left', fs * 0.9);
      this.pips(wx + fs * 5.2, wy + fs * 1.3, v.bombs, 12);
      this.text(v.bay > 0.5 ? 'BAY OPEN' : 'BAY SAFE', wx, wy + fs * 3.6, 'left', fs * 0.9, v.bay > 0.5 ? '#FFD23F' : this.col);
      this.ccipMark(v);
    } else {
      this.text('HYDRA', wx, wy + fs * 1.8, 'left', fs * 0.9);
      this.pips(wx + fs * 5.2, wy + fs * 1.3, v.missiles, 8);
      const ls = v.lock ? (v.lockT >= 1 ? 'LOCK' : 'LOCKING ' + Math.round(v.lockT * 100) + '%') : 'SEEK';
      this.text(ls, wx, wy + fs * 3.6, 'left', fs * 0.9, v.lock && v.lockT >= 1 ? '#FFD23F' : this.col);
    }
    if (v.overheat > 0 && this.flash(5)) this.text('OVERHEAT', cx, cy + fs * 4, 'center', fs * 1.1, '#FF5A2E');
    this.hullBar(fs * 1.5, fs * 1.6, v);
    this.text(v.kind === 'bomber' ? 'WRAITH // B-9' : 'STORMCROW // IX-7', fs * 1.5, fs * 3.2, 'left', fs * 0.8);
    this.radar(fs * 1.5 + 70, H - 90, 62, v, 260);
    this.lockAudio(v);
    this.warnings(v);
  }
  // continuously computed impact point for bombs, with the bomb fall line from the velocity vector
  ccipMark(v) {
    const imp = v.ccip(this._ci || (this._ci = [0, 0, 0, 0])); if (!imp) return;
    const s = this.proj(imp[0], imp[1], imp[2]); if (!s) return;
    const sp = v.speed, fp = sp > 3 ? this.projDir(v.vel[0] / sp, v.vel[1] / sp, v.vel[2] / sp) : null;
    const old = this.col; this.col = '#FFD23F';
    this.circle(s[0], s[1], 12); this.circle(s[0], s[1], 2);
    if (fp) { const dx = s[0] - fp[0], dy = s[1] - fp[1], l = Math.hypot(dx, dy); if (l > 26) this.line(fp[0] + dx / l * 12, fp[1] + dy / l * 12, s[0] - dx / l * 12, s[1] - dy / l * 12); }
    this.text('CCIP ' + imp[3].toFixed(1) + 's', s[0] + 17, s[1] + 14, 'left', this.fs * 0.8, '#FFD23F');
    this.col = old;
  }
  // ------------------------------------------------------------ BASTION
  tank(c, v, dt) {
    const W = this.w, H = this.h, cx = W / 2, cy = H / 2, fs = this.fs;
    this.col = '#D9F27A';
    const aim = v.aimPoint([0, 0, 0], 260), cen = v.center([0, 0, 0]);
    const rng = Math.hypot(aim[0] - cen[0], aim[1] - cen[1], aim[2] - cen[2]);
    // gunner sight: chevron, split horizon line, stadia ticks
    this.poly([cx - 13, cy + 11, cx, cy, cx + 13, cy + 11]);
    this.line(cx - 80, cy, cx - 24, cy); this.line(cx + 24, cy, cx + 80, cy);
    for (let i = 1; i <= 4; i++) this.line(cx - 5 - i, cy + 14 + i * 11, cx + 5 + i, cy + 14 + i * 11);
    this.text(rng >= 259 ? '----' : Math.round(rng) + 'm', cx + 86, cy, 'left', fs * 0.9);
    // predicted shell impact for the current gun elevation
    const imp = v.shellImpact(this._si || (this._si = [0, 0, 0]));
    if (imp) { const s = this.proj(imp[0], imp[1], imp[2]); if (s) { const old = this.col; this.col = v.reloadT <= 0 ? '#FFD23F' : '#9A9A6A'; this.circle(s[0], s[1], 9); this.line(s[0] - 14, s[1], s[0] - 9, s[1]); this.line(s[0] + 9, s[1], s[0] + 14, s[1]); this.col = old; } }
    // hull / turret orientation diagram
    const dx0 = fs * 1.5 + 70, dy0 = H - 90 - 62 - fs * 5.5;
    this.poly([dx0 - 12, dy0 - 20, dx0 + 12, dy0 - 20, dx0 + 12, dy0 + 20, dx0 - 12, dy0 + 20], true);
    const ta = -v.turretYaw;
    this.circle(dx0, dy0, 7); this.line(dx0, dy0, dx0 + Math.sin(ta) * 30, dy0 - Math.cos(ta) * 30);
    const va = angleDiff(v.heading(), this.game.player.yaw);
    const old = this.col; this.col = 'rgba(217,242,122,0.5)'; this.line(dx0, dy0, dx0 + Math.sin(va) * 22, dy0 - Math.cos(va) * 22); this.col = old;
    // weapons + motion
    const wx = cx + Math.min(W * 0.28, 300) - fs * 6, wy = H - fs * 7;
    const rf = 1 - Math.max(0, v.reloadT) / 2.4;
    this.text('CANNON', wx, wy, 'left', fs * 0.9, v.reloadT <= 0 ? '#FFD23F' : this.col);
    this.bar(wx + fs * 5.2, wy - fs * 0.35, fs * 7, fs * 0.7, rf, v.reloadT <= 0 ? '#FFD23F' : this.col);
    this.text(v.reloadT <= 0 ? 'READY' : 'LOADING', wx + fs * 12.8, wy, 'left', fs * 0.8, v.reloadT <= 0 ? '#FFD23F' : this.col);
    this.weaponLine(wx, wy + fs * 1.8, 'COAX', v.heat, v.overheat > 0);
    this.text(Math.round(Math.hypot(v.vel[0], v.vel[2]) * 3.6) + ' KPH', cx - Math.min(W * 0.28, 300), H - fs * 5, 'left', fs * 1.1);
    this.bar(cx - Math.min(W * 0.28, 300), H - fs * 3.8, fs * 7, fs * 0.55, v.boost, '#FFB23D');
    this.headingTape(cx, fs * 3.2, Math.min(W * 0.4, 420), v.heading());
    this.targets(v, 220, null, 0, true);
    this.hullBar(fs * 1.5, fs * 1.6, v);
    this.text('BASTION // HT-3', fs * 1.5, fs * 3.2, 'left', fs * 0.8);
    this.radar(fs * 1.5 + 70, H - 90, 62, v, 200);
    this.warnings(v);
  }
  // ------------------------------------------------------------ MANTIS
  gunship(c, v, dt) {
    const W = this.w, H = this.h, cx = W / 2, cy = H / 2, fs = this.fs;
    this.col = '#FFE28A';
    const aim = v.aimPoint([0, 0, 0], 220), cen = v.center([0, 0, 0]);
    const rng = Math.hypot(aim[0] - cen[0], aim[1] - cen[1], aim[2] - cen[2]);
    // reticle
    this.circle(cx, cy, 22);
    for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) this.line(cx + a * 14, cy + b * 14, cx + a * 30, cy + b * 30);
    this.circle(cx, cy, 2);
    this.text(rng >= 219 ? '----' : Math.round(rng) + 'm', cx + 34, cy + 26, 'left', fs * 0.85);
    // turret line of fire
    const tp = v.local(0, -0.5, -2.44, [0, 0, 0]);
    const ty = v.turretYaw, tpch = v.turretPitch;
    const d = Q.rot(v.q, -Math.sin(ty) * Math.cos(tpch), Math.sin(tpch), -Math.cos(ty) * Math.cos(tpch), [0, 0, 0]);
    const tt = this.proj(tp[0] + d[0] * rng, tp[1] + d[1] * rng, tp[2] + d[2] * rng);
    if (tt) { this.poly([tt[0] - 6, tt[1], tt[0], tt[1] - 6, tt[0] + 6, tt[1], tt[0], tt[1] + 6], true); }
    // drift vector (horizontal velocity relative to heading)
    const hd = v.heading(), sh = Math.sin(hd), ch = Math.cos(hd);
    const vf = v.vel[0] * sh - v.vel[2] * ch, vr = v.vel[0] * ch + v.vel[2] * sh;
    const k = Math.min(W, H) * 0.004;
    this.line(cx, cy + fs * 6, cx + vr * k, cy + fs * 6 - vf * k); this.circle(cx + vr * k, cy + fs * 6 - vf * k, 4);
    this.circle(cx, cy + fs * 6, 3);
    const tapeH = Math.min(H * 0.38, 280);
    this.tape(cx - Math.min(W * 0.28, 300), cy, tapeH, Math.hypot(v.vel[0], v.vel[2]) * 3.6, 5, 4, false, (s) => String(Math.max(0, Math.round(s))), 'GS KPH');
    this.tape(cx + Math.min(W * 0.28, 300), cy, tapeH, v.y, 2, 5, true, (s) => String(Math.round(s)), 'ALT');
    const vs = v.vel[1];
    this.text('VS ' + (vs >= 0 ? '+' : '') + vs.toFixed(1), cx + Math.min(W * 0.28, 300) + 6, cy + tapeH / 2 + fs, 'left', fs * 0.85);
    this.text('AGL ' + (v.agl < 59 ? v.agl.toFixed(1) : '---'), cx + Math.min(W * 0.28, 300) + 6, cy + tapeH / 2 + fs * 2.2, 'left', fs * 0.85);
    this.headingTape(cx, fs * 3.2, Math.min(W * 0.4, 420), hd);
    // nacelle tilt gauge
    const gx = cx - Math.min(W * 0.28, 300) - fs * 6, gy = cy + tapeH / 2 + fs * 3.5;
    this.arc(gx, gy, fs * 2, -Math.PI / 2, 0);
    const ta = -Math.PI / 2 + v.tilt / 1.1 * Math.PI / 2;
    this.line(gx, gy, gx + Math.cos(ta) * fs * 2, gy + Math.sin(ta) * fs * 2);
    this.text('NAC ' + Math.round(v.tilt / DEG), gx + fs * 2.6, gy - fs * 0.6, 'left', fs * 0.8);
    this.bar(gx + fs * 2.6, gy + fs * 0.2, fs * 6, fs * 0.55, v.boost, '#FFB23D');
    this.targets(v, 180, null, 0, true);
    const wx = cx + Math.min(W * 0.28, 300) - fs * 6, wy = H - fs * 7;
    this.weaponLine(wx, wy, 'LASER', v.heat, v.overheat > 0, v.laserOn ? '#FF6A3A' : null);
    this.text('RKT', wx, wy + fs * 1.8, 'left', fs * 0.9);
    this.pips(wx + fs * 5.2, wy + fs * 1.3, v.rockets, 16);
    if (v.rReload > 0 && v.rockets < 16) this.text('RELOAD', wx, wy + fs * 3.4, 'left', fs * 0.8);
    this.hullBar(fs * 1.5, fs * 1.6, v);
    this.text('MANTIS // VTOL-4', fs * 1.5, fs * 3.2, 'left', fs * 0.8);
    this.radar(fs * 1.5 + 70, H - 90, 62, v, 180);
    this.warnings(v);
  }
  // ------------------------------------------------------------ VIPER
  bike(c, v, dt) {
    const W = this.w, H = this.h, cx = W / 2, cy = H / 2, fs = this.fs;
    this.col = '#FFB53D';
    // reticle
    const lime = '#C6FF3D';
    const old = this.col; this.col = lime;
    this.line(cx - 12, cy, cx - 4, cy); this.line(cx + 4, cy, cx + 12, cy); this.line(cx, cy - 12, cx, cy - 4); this.line(cx, cy + 4, cx, cy + 12);
    if (v.charge > 0) { this.arc(cx, cy, 20, -Math.PI / 2, -Math.PI / 2 + TAU * v.charge); if (v.charge >= 1 && this.flash(6)) this.text('FULL CHARGE', cx, cy + 34, 'center', fs * 0.85, lime); }
    this.col = old;
    // speedometer arc
    const sp = Math.hypot(v.vel[0], v.vel[2]) * 3.6, max = 240;
    const r = Math.min(W * 0.1, 110), gx = W - r - fs * 3.5, gy = H - r * 0.55 - fs * 3.2;
    const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
    const segs = 36;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 0.72) / segs, on = t0 < sp / max;
      c.globalAlpha = on ? 1 : 0.18; c.strokeStyle = t0 > 0.78 ? '#FF5A2E' : on && v.boosting ? lime : this.col; c.lineWidth = 7;
      c.beginPath(); c.arc(gx, gy, r, a0 + (a1 - a0) * t0, a0 + (a1 - a0) * t1); c.stroke();
    }
    c.globalAlpha = 1;
    this.text(String(Math.round(sp)), gx, gy - r * 0.18, 'center', fs * 2.6);
    this.text('KPH', gx, gy + r * 0.2, 'center', fs * 0.85);
    this.bar(gx - r * 0.8, gy + r * 0.42, r * 1.6, fs * 0.55, v.boost, lime);
    this.text('BOOST', gx, gy + r * 0.42 + fs * 1.3, 'center', fs * 0.75, v.boosting ? lime : this.col);
    this.text(v.hop > 0 ? 'HOP ' + v.hop.toFixed(1) : 'HOP RDY', gx - r - fs, gy, 'right', fs * 0.85);
    this.text('HVR ' + (v.hover ? v.agl.toFixed(1) : '--'), gx - r - fs, gy - fs * 1.4, 'right', fs * 0.85);
    this.weaponLine(gx - r - fs * 12.5, gy + fs * 1.6, 'BLAST', v.heat, v.overheat > 0);
    this.headingTape(cx, fs * 3.2, Math.min(W * 0.34, 340), v.heading());
    this.targets(v, 120, null, 0, false);
    this.hullBar(fs * 1.5, fs * 1.6, v);
    this.text('VIPER // HB-2', fs * 1.5, fs * 3.2, 'left', fs * 0.8);
    this.warnings(v);
  }
}
