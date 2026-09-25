// ============================================================================
//  Cockpits: the pilot's seat in the STORMCROW and the WRAITH
//  Everything here lives in cockpit space: 1 unit = 1 block, origin at the pilot's neutral eye point,
//  -Z forward, +Y up, +X right. The interior is drawn after the world as a view model in a sliver of the
//  depth range (like the first-person hand), lit by the sun coming through the canopy. The instrument
//  screens are canvases drawn a couple per frame into one texture.
// ============================================================================
const CK = { MATTE: 0, SATIN: 1, METAL: 2, SCREEN: 3, GLOW: 4, LAMP: 5, MIRROR: 6, GLASS: 7 };
const ckRGB = (c, k) => { k = k === undefined ? 1 : k; return [((c >> 16) & 255) / 255 * k, ((c >> 8) & 255) / 255 * k, (c & 255) / 255 * k]; };
const CK_PAL = {
  shell: ckRGB(0x2B2E33), shellD: ckRGB(0x1A1C1F), panel: ckRGB(0x363A40), panelL: ckRGB(0x4A4F56), black: ckRGB(0x0D0E0F),
  rubber: ckRGB(0x161718), metal: ckRGB(0x8A8F96), metalD: ckRGB(0x50555C), orange: ckRGB(0xFF6A1C), yellow: ckRGB(0xE8B82A),
  red: ckRGB(0xC42A1A), white: ckRGB(0xDCD6CA), cushion: ckRGB(0x2F302C), suit: ckRGB(0x4F5238), boot: ckRGB(0x1E1C1A),
  label: ckRGB(0xFFC58A, 0.9), strip: ckRGB(0xFF7A26, 0.8), amberStrip: ckRGB(0xFFA83A, 0.75), glass: ckRGB(0x8A5C1E),
  lampA: ckRGB(0xFFA030), lampR: ckRGB(0xFF3A20), lampG: ckRGB(0x5CFF6A), lampW: ckRGB(0xF4F0E4), lampY: ckRGB(0xFFE040),
};
// ---------------------------------------------------------------- mesh builder
// vertex: position, normal, rgb + material code (+ parameter / 16), uv
class CkMesh {
  constructor() { this.d = []; this.T = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; this.stack = []; }
  // following geometry is placed at (ox, oy, oz), rotated by Ry(ry) * Rx(rx) * Rz(rz) inside the current frame
  push(ox, oy, oz, rx, ry, rz) {
    this.stack.push(this.T);
    const cx = Math.cos(rx || 0), sx = Math.sin(rx || 0), cy = Math.cos(ry || 0), sy = Math.sin(ry || 0), cz = Math.cos(rz || 0), sz = Math.sin(rz || 0);
    const R = [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx, cx * sz, cx * cz, -sx, -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx];
    const P = this.T, T = new Array(12);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) T[i * 3 + j] = P[i * 3] * R[j] + P[i * 3 + 1] * R[3 + j] + P[i * 3 + 2] * R[6 + j];
    for (let i = 0; i < 3; i++) T[9 + i] = P[i * 3] * ox + P[i * 3 + 1] * oy + P[i * 3 + 2] * oz + P[9 + i];
    this.T = T; return this;
  }
  pop() { this.T = this.stack.pop(); return this; }
  vert(x, y, z, nx, ny, nz, col, mat, u, v) {
    const T = this.T;
    this.d.push(T[0] * x + T[1] * y + T[2] * z + T[9], T[3] * x + T[4] * y + T[5] * z + T[10], T[6] * x + T[7] * y + T[8] * z + T[11],
      T[0] * nx + T[1] * ny + T[2] * nz, T[3] * nx + T[4] * ny + T[5] * nz, T[6] * nx + T[7] * ny + T[8] * nz, col[0], col[1], col[2], mat, u || 0, v || 0);
  }
  tri(a, b, c, col, mat, ta, tb, tc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    this.vert(a[0], a[1], a[2], nx, ny, nz, col, mat, ta && ta[0], ta && ta[1]);
    this.vert(b[0], b[1], b[2], nx, ny, nz, col, mat, tb && tb[0], tb && tb[1]);
    this.vert(c[0], c[1], c[2], nx, ny, nz, col, mat, tc && tc[0], tc && tc[1]);
  }
  // a b c d counter-clockwise seen from the front; uv = [u0, v0, u1, v1] puts the texture's top edge on c-d
  quad(a, b, c, d, col, mat, uv) {
    const A = uv ? [uv[0], uv[3]] : null, B = uv ? [uv[2], uv[3]] : null, C = uv ? [uv[2], uv[1]] : null, D = uv ? [uv[0], uv[1]] : null;
    this.tri(a, b, c, col, mat, A, B, C); this.tri(a, c, d, col, mat, A, C, D);
  }
  box(x0, y0, z0, x1, y1, z1, col, mat, skip) {
    skip = skip || 0;
    if (!(skip & 16)) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, mat);
    if (!(skip & 32)) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, mat);
    if (!(skip & 1)) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, mat);
    if (!(skip & 2)) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, mat);
    if (!(skip & 4)) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col, mat);
    if (!(skip & 8)) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, mat);
  }
  // box whose +z face is bevelled by b (panels, bezels, cushions)
  pbox(x0, y0, z0, x1, y1, z1, b, col, mat) {
    const zb = z1 - b;
    this.quad([x0 + b, y0 + b, z1], [x1 - b, y0 + b, z1], [x1 - b, y1 - b, z1], [x0 + b, y1 - b, z1], col, mat);
    this.quad([x0, y0, zb], [x1, y0, zb], [x1 - b, y0 + b, z1], [x0 + b, y0 + b, z1], col, mat);
    this.quad([x1, y1, zb], [x0, y1, zb], [x0 + b, y1 - b, z1], [x1 - b, y1 - b, z1], col, mat);
    this.quad([x1, y0, zb], [x1, y1, zb], [x1 - b, y1 - b, z1], [x1 - b, y0 + b, z1], col, mat);
    this.quad([x0, y1, zb], [x0, y0, zb], [x0 + b, y0 + b, z1], [x0 + b, y1 - b, z1], col, mat);
    this.box(x0, y0, z0, x1, y1, zb, col, mat, 16);
  }
  // cylinder along +z from z0 (radius r, length len); push a rotation for other axes
  cyl(x, y, z0, r, len, seg, col, mat, capFront) {
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p = (c, s, zz) => [x + c * r, y + s * r, zz];
      this.vert(...p(c0, s0, z0), c0, s0, 0, col, mat); this.vert(...p(c1, s1, z0), c1, s1, 0, col, mat); this.vert(...p(c1, s1, z0 + len), c1, s1, 0, col, mat);
      this.vert(...p(c0, s0, z0), c0, s0, 0, col, mat); this.vert(...p(c1, s1, z0 + len), c1, s1, 0, col, mat); this.vert(...p(c0, s0, z0 + len), c0, s0, 0, col, mat);
      if (capFront !== false) this.tri([x, y, z0 + len], p(c0, s0, z0 + len), p(c1, s1, z0 + len), col, mat);
    }
  }
  // flat disc facing +z (screens use the uv rect, centre to edge)
  disc(x, y, z, r, seg, col, mat, uv) {
    const uc = uv ? (uv[0] + uv[2]) / 2 : 0, vc = uv ? (uv[1] + uv[3]) / 2 : 0, ur = uv ? (uv[2] - uv[0]) / 2 : 0, vr = uv ? (uv[3] - uv[1]) / 2 : 0;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU;
      this.tri([x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], col, mat,
        [uc, vc], [uc + Math.cos(a0) * ur, vc - Math.sin(a0) * vr], [uc + Math.cos(a1) * ur, vc - Math.sin(a1) * vr]);
    }
  }
  // parametric patch f(s, t) -> [x, y, z] over the unit square with smooth normals; col may be a function of (s, t)
  surf(nu, nv, f, col, mat, uv) {
    const W = nu + 1, P = [], N = [], e = 1e-3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const s = i / nu, t = j / nv;
      P.push(f(s, t));
      const a = f(Math.min(1, s + e), t), b = f(Math.max(0, s - e), t), c = f(s, Math.min(1, t + e)), d = f(s, Math.max(0, t - e));
      const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
      N.push([nx / l, ny / l, nz / l]);
    }
    const V = (i, j) => {
      const k = j * W + i, p = P[k], n = N[k], s = i / nu, t = j / nv, cc = typeof col === 'function' ? col(s, t) : col;
      this.vert(p[0], p[1], p[2], n[0], n[1], n[2], cc, mat, uv ? uv[0] + (uv[2] - uv[0]) * s : s, uv ? uv[1] + (uv[3] - uv[1]) * t : t);
    };
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { V(i, j); V(i + 1, j); V(i + 1, j + 1); V(i, j); V(i + 1, j + 1); V(i, j + 1); }
  }
  // rectangular bar from p0 to p1: w across (perpendicular to the bar, facing the eye), d deep
  beam(p0, p1, w, d, col, mat) {
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, mz = (p0[2] + p1[2]) / 2;
    let sx = ay * -mz - az * -my, sy = az * -mx - ax * -mz, sz = ax * -my - ay * -mx; let l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
    let nx = sy * az - sz * ay, ny = sz * ax - sx * az, nz = sx * ay - sy * ax; l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const c = (p, a, b) => [p[0] + sx * a * w / 2 + nx * b * d / 2, p[1] + sy * a * w / 2 + ny * b * d / 2, p[2] + sz * a * w / 2 + nz * b * d / 2];
    const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < 4; i++) { const [a0, b0] = q[i], [a1, b1] = q[(i + 1) % 4]; this.quad(c(p0, a0, b0), c(p0, a1, b1), c(p1, a1, b1), c(p1, a0, b0), col, mat); }
  }
  // ---------------------------------------------------------------- panel furniture (local frame: face = +z)
  knob(x, y, r, h, col) { this.cyl(x, y, 0, r * 1.25, h * 0.3, 12, CK_PAL.metalD, CK.METAL); this.cyl(x, y, h * 0.3, r, h * 0.7, 12, col || CK_PAL.black, CK.SATIN); this.box(x - 0.0015, y + r * 0.3, h * 0.99, x + 0.0015, y + r * 0.95, h * 1.02, CK_PAL.white, CK.SATIN); }
  toggle(x, y, up) {
    this.box(x - 0.007, y - 0.007, 0, x + 0.007, y + 0.007, 0.004, CK_PAL.metalD, CK.METAL);
    this.push(x, y, 0.004, (up ? 1 : -1) * 0.45, 0, 0); this.cyl(0, 0, 0, 0.0028, 0.022, 6, CK_PAL.metal, CK.METAL); this.pop();
  }
  button(x, y, w, h, col) { this.pbox(x - w / 2, y - h / 2, 0, x + w / 2, y + h / 2, 0.006, 0.002, col || CK_PAL.metalD, CK.SATIN); }
  legend(x, y, w, h) { this.quad([x - w / 2, y - h / 2, 0.001], [x + w / 2, y - h / 2, 0.001], [x + w / 2, y + h / 2, 0.001], [x - w / 2, y + h / 2, 0.001], CK_PAL.label, CK.GLOW); }
  // caution lamp: lens with an engraved legend from the atlas strip, lit by uLamp[i]
  lamp(x, y, w, h, i, col) {
    this.pbox(x - w / 2 - 0.004, y - h / 2 - 0.004, 0, x + w / 2 + 0.004, y + h / 2 + 0.004, 0.006, 0.002, CK_PAL.black, CK.SATIN);
    this.quad([x - w / 2, y - h / 2, 0.0062], [x + w / 2, y - h / 2, 0.0062], [x + w / 2, y + h / 2, 0.0062], [x - w / 2, y + h / 2, 0.0062], col, CK.LAMP + i / 16, ckLegendUV(i));
  }
  // a row of push buttons along a display bezel
  osbRow(x0, x1, y, n, w, h) { for (let i = 0; i < n; i++) this.button(x0 + (x1 - x0) * (i + 0.5) / n, y, w, h); }
}
// ---------------------------------------------------------------- texture atlas (1024 x 1024, one per cockpit)
const CK_TEX = 1024, CK_LEGEND = { y: 984, w: 64, h: 40 };
const ckUV = (r) => [r.x / CK_TEX, r.y / CK_TEX, (r.x + r.w) / CK_TEX, (r.y + r.h) / CK_TEX];
const ckLegendUV = (i) => [(i * CK_LEGEND.w + 2) / CK_TEX, (CK_LEGEND.y + 2) / CK_TEX, ((i + 1) * CK_LEGEND.w - 2) / CK_TEX, (CK_LEGEND.y + CK_LEGEND.h - 2) / CK_TEX];
const CK_DISPLAYS = {
  jet: [{ id: 'pfd', x: 0, y: 0, w: 341, h: 372 }, { id: 'tsd', x: 341, y: 0, w: 341, h: 372 }, { id: 'sms', x: 682, y: 0, w: 342, h: 372 }, { id: 'stby', x: 0, y: 384, w: 160, h: 160 }],
  bomber: [{ id: 'bomb', x: 0, y: 0, w: 400, h: 400 }, { id: 'tsd', x: 400, y: 0, w: 400, h: 400 }, { id: 'pfd', x: 0, y: 400, w: 320, h: 320 }, { id: 'eng', x: 320, y: 400, w: 320, h: 320 }, { id: 'cnt', x: 640, y: 400, w: 160, h: 64 }],
};
const CK_LAMPS = {
  jet: ['MASTER CAUTION', 'WARNING', 'GEAR', 'A/B', 'LOCK', 'GUN HOT'],
  bomber: ['BAY OPEN', 'GEAR', 'A/B', 'GUN HOT', 'STALL', 'PULL UP', 'HULL', 'MASTER CAUTION'],
};
const ckDisp = (kind, id) => CK_DISPLAYS[kind].find(d => d.id === id);
// ---------------------------------------------------------------- STORMCROW: bubble canopy, one panoramic display
const SC_SILL = -0.30;
const scW = (z) => z < -0.5 ? lerp(0.40, 0.45, smoothstep(-0.9, -0.5, z)) : z > 0.35 ? lerp(0.45, 0.33, smoothstep(0.35, 0.9, z)) : 0.45;
const scH = (z) => z < -0.12 ? 0.10 + 0.48 * Math.pow(Math.sin(clamp((z + 0.9) / 0.78, 0, 1) * Math.PI / 2), 0.8) : z > 0.25 ? lerp(0.58, 0.24, smoothstep(0.25, 0.9, z)) : 0.58;
// point on the canopy (a = -1 left sill .. 1 right sill), moved inward by inset
function scPt(a, z, inset) {
  const i = inset || 0, e = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(a), 2.4)), 1 / 2.4);
  return [a * (scW(z) - i), SC_SILL + (scH(z) - i) * e, z];
}
function buildStormcrowCockpit() {
  const M = new CkMesh(), G = new CkMesh(), STK = new CkMesh(), THR = new CkMesh(), P = CK_PAL, SILL = SC_SILL;
  // ------------------------------------------------ canopy acrylic, frameless up front
  G.surf(32, 34, (s, t) => scPt(s * 2 - 1, -0.9 + t * 1.8), P.glass, CK.GLASS);
  // frame arch behind the head: inner face and both edges
  const arch = (z0, z1, th) => {
    M.surf(28, 1, (s, t) => scPt(s * 2 - 1, z0 + t * (z1 - z0), th), P.shell, CK.SATIN);
    for (const z of [z0, z1]) M.surf(28, 1, (s, t) => { const a = s * 2 - 1, p = scPt(a, z, 0), q = scPt(a, z, th); return [lerp(p[0], q[0], t), lerp(p[1], q[1], t), z]; }, P.shell, CK.SATIN);
  };
  arch(0.5, 0.57, 0.04);
  // ------------------------------------------------ sill rails with the canopy seal and a light strip
  for (const sd of [-1, 1]) {
    M.surf(4, 32, (s, t) => { const z = -0.92 + t * 1.82, w = scW(z); return [sd * (w - 0.056 + s * 0.07), SILL - 0.004 + Math.sin(s * Math.PI) * 0.008, z]; }, P.shell, CK.SATIN);
    M.surf(2, 32, (s, t) => { const z = -0.92 + t * 1.82; return [sd * (scW(z) - 0.056), SILL - 0.004 - s * 0.05, z]; }, P.shell, CK.SATIN);
    M.surf(1, 24, (s, t) => { const z = -0.55 + t * 1.0; return [sd * (scW(z) - 0.0575), SILL - 0.013 - s * 0.006, z]; }, P.strip, CK.GLOW);
    // tub wall below the rail with a few ribs, down to the side console
    M.surf(3, 14, (s, t) => { const z = -0.64 + t * 1.02, w = scW(z) - 0.056; return [sd * (w - s * 0.025), SILL - 0.054 - s * 0.25, z]; }, (s) => ckRGB(0x363A40, 0.8 + 0.2 * (1 - s)), CK.MATTE);
    for (const z of [-0.3, -0.02, 0.24]) M.box(sd < 0 ? -0.43 : 0.41, -0.52, z, sd < 0 ? -0.41 : 0.43, -0.37, z + 0.018, P.shell, CK.SATIN);
    // yellow canopy handle up front
    M.push(sd * 0.382, -0.37, -0.44, 0, 0, 0); M.box(-0.009, -0.01, -0.06, 0.009, 0.01, 0.06, P.yellow, CK.SATIN); M.pop();
  }
  // ------------------------------------------------ glare shield: anti-glare hood with a rounded lip
  const gsY = (z) => -0.168 + 0.036 * clamp((z + 0.92) / 0.42, 0, 1);
  const gsPt = (a, z) => { const k = smoothstep(0.58, 1.0, Math.abs(a)); return [a * (scW(z) - 0.006), lerp(gsY(z), SILL + 0.004, k), z]; };
  M.surf(32, 8, (s, t) => gsPt(s * 2 - 1, -0.92 + t * 0.42), P.shellD, CK.MATTE);
  M.surf(32, 3, (s, t) => { const p = gsPt(s * 2 - 1, -0.5), r = 0.012, an = t * Math.PI / 2; return [p[0], p[1] - r + Math.cos(an) * r, -0.5 + Math.sin(an) * r]; }, P.shellD, CK.MATTE);
  M.surf(32, 1, (s, t) => { const p = gsPt(s * 2 - 1, -0.5); return [p[0], p[1] - 0.012 - t * 0.014, -0.488]; }, P.shellD, CK.MATTE);
  M.surf(32, 1, (s, t) => { const p = gsPt(s * 2 - 1, -0.5); return [p[0] * 0.98, p[1] - 0.026, -0.488 - t * 0.15]; }, P.black, CK.MATTE);
  M.surf(24, 1, (s, t) => { const p = gsPt((s * 2 - 1) * 0.56, -0.5); return [p[0], p[1] - 0.0245 + t * 0.0035, -0.4874]; }, P.strip, CK.GLOW);
  // helmet tracker on the glare shield
  const ty = gsY(-0.6);
  M.pbox(-0.03, ty - 0.004, -0.64, 0.03, ty + 0.012, -0.575, 0.004, P.black, CK.SATIN);
  M.box(-0.016, ty + 0.002, -0.5752, 0.016, ty + 0.008, -0.5748, P.strip, CK.GLOW);
  // ------------------------------------------------ main panel: panoramic display with its push buttons
  const pcd = ckUV(ckDisp('jet', 'pfd')); pcd[2] = 1; // three portals side by side across the atlas
  M.push(0, -0.3, -0.575, -0.21, 0, 0);
  M.box(-0.44, -0.37, -0.06, 0.44, 0.145, 0, P.panel, CK.SATIN);
  M.pbox(-0.312, -0.12, 0, 0.312, 0.137, 0.014, 0.007, P.black, CK.SATIN);
  M.quad([-0.29, -0.087, 0.0145], [0.29, -0.087, 0.0145], [0.29, 0.123, 0.0145], [-0.29, 0.123, 0.0145], P.white, CK.SCREEN, pcd);
  M.osbRow(-0.28, 0.28, -0.104, 16, 0.024, 0.011);
  for (const sd of [-1, 1]) for (const y of [0.075, 0.035, -0.005, -0.045]) M.button(sd * 0.301, y, 0.011, 0.024);
  // caution lamps either side of the display
  M.lamp(-0.37, 0.085, 0.07, 0.03, 0, P.lampA); M.lamp(-0.37, 0.04, 0.07, 0.03, 1, P.lampR); M.lamp(-0.37, -0.005, 0.07, 0.03, 2, P.lampG);
  M.lamp(0.37, 0.085, 0.07, 0.03, 3, P.lampA); M.lamp(0.37, 0.04, 0.07, 0.03, 4, P.lampY); M.lamp(0.37, -0.005, 0.07, 0.03, 5, P.lampA);
  // lower panel: standby display, gear handle, master arm, jettison, switch row
  const sb = ckUV(ckDisp('jet', 'stby'));
  M.cyl(-0.17, -0.21, 0, 0.056, 0.012, 20, P.black, CK.SATIN, false); M.disc(-0.17, -0.21, 0.0125, 0.048, 24, P.white, CK.SCREEN, sb);
  for (const [x, y] of [[-0.225, -0.155], [-0.115, -0.155], [-0.225, -0.265], [-0.115, -0.265]]) M.cyl(x, y, 0, 0.004, 0.006, 6, P.metalD, CK.METAL);
  M.pbox(-0.37, -0.3, 0, -0.3, -0.13, 0.006, 0.003, P.shell, CK.SATIN);
  M.box(-0.34, -0.18, 0.006, -0.33, -0.16, 0.06, P.metal, CK.METAL);
  M.push(-0.335, -0.17, 0.06, 0, Math.PI / 2, 0); M.cyl(0, 0, -0.018, 0.017, 0.036, 14, P.white, CK.SATIN); M.pop();
  M.legend(-0.335, -0.29, 0.05, 0.006);
  M.pbox(0.12, -0.23, 0, 0.2, -0.15, 0.006, 0.003, P.shell, CK.SATIN);
  M.toggle(0.16, -0.19, true); M.box(0.135, -0.205, 0.006, 0.185, -0.2, 0.034, P.red, CK.SATIN);
  M.legend(0.16, -0.24, 0.05, 0.006);
  M.cyl(0.32, -0.19, 0, 0.03, 0.006, 20, P.black, CK.SATIN); M.cyl(0.32, -0.19, 0.006, 0.022, 0.012, 20, P.yellow, CK.SATIN);
  for (let i = 0; i < 6; i++) { M.toggle(-0.04 + i * 0.035, -0.29, i % 2 === 0); M.legend(-0.04 + i * 0.035, -0.265, 0.024, 0.004); }
  for (let i = 0; i < 4; i++) M.knob(0.05 + i * 0.055, -0.2, 0.011, 0.016);
  M.pop();
  // ------------------------------------------------ side consoles: throttle quadrant left, stick right
  for (const sd of [-1, 1]) {
    M.box(sd < 0 ? -0.43 : 0.215, -0.64, -0.5, sd < 0 ? -0.215 : 0.43, -0.535, 0.36, P.panel, CK.SATIN);
    M.push(sd * 0.322, -0.535, -0.07, -Math.PI / 2, 0, 0);
    // local: x = world x, y = forward, z = up
    M.pbox(-0.1, -0.4, 0, 0.1, 0.4, 0.005, 0.003, P.shell, CK.SATIN);
    if (sd < 0) {
      M.pbox(-0.03, 0.02, 0.005, 0.03, 0.34, 0.01, 0.003, P.black, CK.SATIN);
      for (let i = 0; i < 3; i++) M.knob(-0.06 + i * 0.06, -0.08, 0.012, 0.018);
      for (let i = 0; i < 5; i++) { M.push(-0.08 + i * 0.04, -0.2, 0.005); M.toggle(0, 0, i % 3 === 0); M.pop(); M.legend(-0.08 + i * 0.04, -0.235, 0.028, 0.004); }
      M.push(0, -0.31, 0.005); for (let i = 0; i < 4; i++) M.button(-0.06 + i * 0.04, 0, 0.03, 0.02, i === 3 ? P.red : P.metalD); M.pop();
    } else {
      M.pbox(-0.05, 0.02, 0.005, 0.05, 0.2, 0.012, 0.004, P.black, CK.SATIN);
      M.push(0, -0.1, 0.005); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) M.button(-0.05 + i * 0.05, j * 0.045, 0.036, 0.026); M.pop();
      for (let i = 0; i < 4; i++) M.knob(-0.06 + i * 0.04, -0.25, 0.01, 0.016);
      for (let i = 0; i < 3; i++) M.legend(-0.05 + i * 0.05, -0.155, 0.03, 0.004);
    }
    M.pop();
  }
  // ------------------------------------------------ seat, tub floor, pedals and the pilot's legs
  M.push(0, -0.02, 0.23, 0, Math.PI, 0);
  M.pbox(-0.14, -0.16, -0.06, 0.14, 0.15, 0.06, 0.03, P.cushion, CK.MATTE);
  M.pop();
  M.box(-0.19, -0.95, 0.2, -0.155, 0.12, 0.34, P.metalD, CK.METAL); M.box(0.155, -0.95, 0.2, 0.19, 0.12, 0.34, P.metalD, CK.METAL);
  for (const sd of [-1, 1]) {
    M.box(sd * 0.1 - 0.018, 0.15, 0.2, sd * 0.1 + 0.018, 0.175, 0.3, P.yellow, CK.SATIN);
    M.box(sd * 0.1 - 0.019, 0.155, 0.23, sd * 0.1 + 0.019, 0.172, 0.24, P.black, CK.SATIN); M.box(sd * 0.1 - 0.019, 0.155, 0.26, sd * 0.1 + 0.019, 0.172, 0.27, P.black, CK.SATIN);
    M.box(sd * 0.18 - 0.03, -0.62, 0.02, sd * 0.18 + 0.03, -0.3, 0.24, P.cushion, CK.MATTE);
  }
  M.box(-0.2, -0.78, -0.2, 0.2, -0.7, 0.26, P.cushion, CK.MATTE);
  M.box(-0.44, -1.02, -0.9, 0.44, -0.98, 0.4, P.shellD, CK.MATTE);
  for (const sd of [-1, 1]) {
    const x = sd * 0.11;
    M.beam([x, -0.67, 0.02], [x, -0.6, -0.4], 0.13, 0.14, P.suit, CK.MATTE);
    M.beam([x, -0.62, -0.42], [x, -0.92, -0.6], 0.11, 0.12, P.suit, CK.MATTE);
    M.box(x - 0.06, -0.98, -0.72, x + 0.06, -0.9, -0.54, P.boot, CK.MATTE);
    M.box(x - 0.07, -1.0, -0.78, x + 0.07, -0.96, -0.52, P.metalD, CK.METAL);
  }
  // turtle deck behind the seat
  M.surf(20, 8, (s, t) => { const z = 0.34 + t * 0.58, a = s * 2 - 1, w = scW(z) - 0.05; return [a * w, SILL + 0.03 + 0.15 * (1 - a * a) * smoothstep(0.34, 0.92, z), z]; }, P.shellD, CK.MATTE);
  // ------------------------------------------------ side stick and throttle (moving parts, built around their pivots)
  STK.push(0, 0, 0, -Math.PI / 2, 0, 0); STK.cyl(0, 0, 0, 0.034, 0.03, 12, P.rubber, CK.MATTE); STK.cyl(0, 0, 0.03, 0.011, 0.06, 8, P.metal, CK.METAL); STK.pop();
  STK.push(0, 0.085, 0, 0.18, 0, 0);
  STK.pbox(-0.021, 0, -0.026, 0.021, 0.1, 0.026, 0.008, P.black, CK.SATIN);
  STK.box(-0.016, 0.052, -0.037, 0.016, 0.07, -0.026, P.metalD, CK.METAL);
  STK.box(-0.022, 0.012, 0.008, 0.022, 0.07, 0.027, P.rubber, CK.MATTE);
  STK.push(0, 0.1, 0.004, -Math.PI / 2, 0, 0); STK.cyl(0, 0, 0, 0.008, 0.01, 8, P.metal, CK.METAL); STK.pop();
  STK.box(0.004, 0.098, -0.022, 0.016, 0.108, -0.008, P.red, CK.SATIN);
  STK.pop();
  THR.box(-0.009, 0, -0.012, 0.009, 0.075, 0.012, P.metal, CK.METAL);
  THR.pbox(-0.032, 0.07, -0.05, 0.032, 0.12, 0.034, 0.01, P.black, CK.SATIN);
  THR.box(-0.034, 0.09, -0.03, -0.031, 0.108, -0.005, P.orange, CK.SATIN);
  THR.box(-0.012, 0.12, -0.035, 0.012, 0.126, -0.015, P.metalD, CK.METAL);
  THR.box(0.012, 0.117, 0.004, 0.024, 0.125, 0.018, P.white, CK.SATIN);
  return {
    parts: { M, G, STK, THR }, stick: [0.322, -0.53, -0.25], throttle: [-0.322, -0.525, -0.2],
    occ: [SILL, 0.39, -0.5, gsY(-0.5)], cab: [99, 0, 0, 0], tint: ckRGB(0x8A5C1E), spill: [0, -0.3, -0.5], spillCol: [0.35, 0.95, 0.4],
  };
}
// ---------------------------------------------------------------- WRAITH: glazed flight deck under a roof
function buildWraithCockpit() {
  const M = new CkMesh(), G = new CkMesh(), STK = new CkMesh(), THR = new CkMesh(), COV = new CkMesh(), P = CK_PAL;
  const CH = ckRGB(0x26282C), CH2 = ckRGB(0x1D1F22), ED = ckRGB(0x3C3F45);
  // glazing: wide centre pane, angled side panes, side windows (uv = position, for scratches and rain)
  const g = (p) => [(p[0] + 0.72) / 1.44, (p[2] + 0.9) / 1.3 + (0.4 - p[1]) * 0.3];
  const pane = (a, b, c, d) => { G.tri(a, b, c, P.glass, CK.GLASS, g(a), g(b), g(c)); G.tri(a, c, d, P.glass, CK.GLASS, g(a), g(c), g(d)); };
  const A = [0.46, -0.2, -0.86], Bp = [0.69, -0.22, -0.46], Cp = [0.61, 0.31, -0.33], D = [0.4, 0.335, -0.6], E = [0.7, -0.22, 0.3], F = [0.68, 0.22, 0.3];
  const mx = (p) => [-p[0], p[1], p[2]];
  pane(mx(A), A, D, mx(D));
  pane(A, Bp, Cp, D); pane(mx(Bp), mx(A), mx(D), mx(Cp));
  pane(Bp, E, F, Cp); pane(mx(E), mx(Bp), mx(Cp), mx(F));
  // frames: posts, header, window heads and sills
  for (const sd of [1, -1]) {
    const s = (p) => sd > 0 ? p : mx(p);
    M.beam(s(A), s(D), 0.042, 0.045, CH, CK.SATIN); M.beam(s(Bp), s(Cp), 0.05, 0.05, CH, CK.SATIN);
    M.beam(s(D), s(Cp), 0.05, 0.04, CH, CK.SATIN); M.beam(s(Cp), s(F), 0.05, 0.04, CH, CK.SATIN);
    M.beam(s(E), s(F), 0.06, 0.05, CH, CK.SATIN); M.beam(s([0.69, -0.24, -0.5]), s([0.7, -0.24, 0.32]), 0.05, 0.06, CH, CK.SATIN);
    // side wall below the window, down to the console
    M.surf(2, 8, (u, t) => { const z = -0.5 + t * 0.94; return [sd * (0.69 - u * 0.03), -0.26 - u * 0.3, z]; }, (u) => ckRGB(0x2E3136, 0.8 + 0.2 * (1 - u)), CK.MATTE);
    M.surf(1, 16, (u, t) => { const z = -0.45 + t * 0.85; return [sd * 0.672, -0.262 - u * 0.005, z]; }, P.amberStrip, CK.GLOW);
  }
  M.beam(mx(D), D, 0.06, 0.05, CH, CK.SATIN);
  // roof: arches from the window heads up over the head, with the overhead console
  const edge = (z) => z < -0.33 ? [lerp(0.4, 0.61, (z + 0.6) / 0.27), lerp(0.335, 0.31, (z + 0.6) / 0.27)] : z < 0.3 ? [lerp(0.61, 0.68, (z + 0.33) / 0.63), lerp(0.31, 0.22, (z + 0.33) / 0.63)] : [0.68, 0.22];
  M.surf(24, 12, (s, t) => { const z = -0.6 + t * 1.02, e = edge(z), a = s * 2 - 1; return [a * e[0], lerp(e[1], 0.385, Math.sqrt(Math.max(0, 1 - a * a))), z]; }, (s) => ckRGB(0x2A2C30, 0.75 + 0.25 * Math.sin(s * Math.PI)), CK.MATTE);
  M.push(0, 0.372, -0.2, Math.PI / 2, 0, 0);
  // local: x = world x, y = backward, z = down
  M.pbox(-0.23, -0.27, 0, 0.23, 0.26, 0.018, 0.008, ED, CK.SATIN);
  for (let r = 0; r < 4; r++) for (let i = 0; i < 7; i++) { M.push(-0.18 + i * 0.06, -0.2 + r * 0.1, 0.018); M.toggle(0, 0, (i + r) % 3 !== 0); M.pop(); M.push(-0.18 + i * 0.06, -0.165 + r * 0.1, 0.018); M.legend(0, 0, 0.034, 0.004); M.pop(); }
  M.push(0, 0.2, 0.018); M.cyl(0, 0, 0, 0.035, 0.008, 18, P.metalD, CK.METAL); M.disc(0, 0, 0.0085, 0.03, 18, ckRGB(0xFFE2B8, 0.45), CK.GLOW); M.pop();
  M.pop();
  // rear bulkhead with equipment racks
  M.box(-0.7, -1.0, 0.42, 0.7, 0.4, 0.46, CH2, CK.MATTE);
  M.push(0, 0, 0.42, 0, Math.PI, 0);
  // local: facing the pilot
  for (const sd of [-1, 1]) {
    const x = sd * 0.47;
    M.pbox(x - 0.17, -0.5, 0, x + 0.17, 0.12, 0.04, 0.01, ED, CK.SATIN);
    for (let i = 0; i < 5; i++) { M.box(x - 0.12, -0.42 + i * 0.1, 0.04, x + 0.12, -0.4 + i * 0.1, 0.05, CH2, CK.SATIN); M.box(x + 0.08, -0.375 + i * 0.1, 0.04, x + 0.1, -0.365 + i * 0.1, 0.052, i % 2 ? P.lampG : P.amberStrip, CK.GLOW); }
  }
  M.pop();
  // ------------------------------------------------ glare shield and the annunciator strip in its lip
  const base = (x) => Math.abs(x) < 0.46 ? -0.86 : -0.86 + (Math.abs(x) - 0.46) / 0.23 * 0.4;
  M.surf(36, 6, (s, t) => { const x = (s * 2 - 1) * 0.63; return [x, lerp(-0.2, -0.15, t), lerp(base(x), -0.55, t)]; }, CH2, CK.MATTE);
  M.box(-0.69, -0.26, -0.62, -0.62, -0.2, -0.46, CH2, CK.MATTE); M.box(0.62, -0.26, -0.62, 0.69, -0.2, -0.46, CH2, CK.MATTE);
  M.quad([-0.63, -0.2, -0.55], [0.63, -0.2, -0.55], [0.63, -0.15, -0.55], [-0.63, -0.15, -0.55], CH2, CK.MATTE);
  M.quad([-0.63, -0.2, -0.55], [-0.63, -0.2, -0.66], [0.63, -0.2, -0.66], [0.63, -0.2, -0.55], P.black, CK.MATTE);
  M.push(0, -0.175, -0.55);
  for (let i = 0; i < 8; i++) M.lamp(-0.385 + i * 0.11, 0, 0.09, 0.03, i, [P.lampA, P.lampG, P.lampA, P.lampA, P.lampR, P.lampR, P.lampR, P.lampA][i]);
  M.box(-0.6, -0.001, 0.0, -0.46, 0.001, 0.002, P.amberStrip, CK.GLOW); M.box(0.46, -0.001, 0.0, 0.6, 0.001, 0.002, P.amberStrip, CK.GLOW);
  M.pop();
  // ------------------------------------------------ main panel: four displays and the bomb controls
  const panelPt = (x, y, z) => [x, -0.345 + y * Math.cos(0.17) + z * Math.sin(0.17), -0.63 - y * Math.sin(0.17) + z * Math.cos(0.17)];
  M.push(0, -0.345, -0.63, -0.17, 0, 0);
  M.box(-0.66, -0.34, -0.06, 0.66, 0.15, 0, ckRGB(0x33363B), CK.SATIN);
  const mfd = (cx, cy, S, id) => {
    const b = 0.024;
    M.pbox(cx - S / 2 - b, cy - S / 2 - b, 0, cx + S / 2 + b, cy + S / 2 + b, 0.014, 0.006, P.black, CK.SATIN);
    M.quad([cx - S / 2, cy - S / 2, 0.0145], [cx + S / 2, cy - S / 2, 0.0145], [cx + S / 2, cy + S / 2, 0.0145], [cx - S / 2, cy + S / 2, 0.0145], P.white, CK.SCREEN, ckUV(ckDisp('bomber', id)));
    for (let i = 0; i < 5; i++) { const o = (i - 2) / 5 * S; M.button(cx + o, cy - S / 2 - b / 2, 0.022, 0.01); M.button(cx + o, cy + S / 2 + b / 2, 0.022, 0.01); M.button(cx - S / 2 - b / 2, cy + o, 0.01, 0.022); M.button(cx + S / 2 + b / 2, cy + o, 0.01, 0.022); }
  };
  mfd(-0.13, 0.0, 0.2, 'bomb'); mfd(0.13, 0.0, 0.2, 'tsd'); mfd(-0.42, -0.01, 0.17, 'pfd'); mfd(0.42, -0.01, 0.17, 'eng');
  // bomb control panel: bomb counter, guarded bay switch (the guard is a moving part), master arm, pickle
  M.pbox(-0.16, -0.31, 0, 0.16, -0.14, 0.008, 0.004, ED, CK.SATIN);
  M.pbox(-0.12, -0.19, 0.008, -0.02, -0.155, 0.012, 0.002, P.black, CK.SATIN);
  M.quad([-0.115, -0.186, 0.0122], [-0.025, -0.186, 0.0122], [-0.025, -0.159, 0.0122], [-0.115, -0.159, 0.0122], P.white, CK.SCREEN, ckUV(ckDisp('bomber', 'cnt')));
  M.push(0.05, -0.2, 0.008); M.toggle(0, 0, false); M.pop(); M.legend(0.05, -0.165, 0.05, 0.005);
  M.push(-0.07, -0.26, 0.008); M.toggle(0, 0, true); M.pop(); M.legend(-0.07, -0.29, 0.05, 0.005);
  M.push(0.1, -0.265, 0.008); M.cyl(0, 0, 0, 0.022, 0.006, 18, P.black, CK.SATIN); M.cyl(0, 0, 0.006, 0.016, 0.01, 18, P.red, CK.SATIN); M.pop();
  M.pbox(-0.6, -0.3, 0, -0.5, -0.14, 0.006, 0.003, ED, CK.SATIN);
  M.box(-0.556, -0.2, 0.006, -0.544, -0.18, 0.06, P.metal, CK.METAL);
  M.push(-0.55, -0.19, 0.06, 0, Math.PI / 2, 0); M.cyl(0, 0, -0.018, 0.017, 0.036, 14, P.white, CK.SATIN); M.pop();
  for (let i = 0; i < 5; i++) { M.toggle(0.28 + i * 0.05, -0.2, i % 2 === 1); M.legend(0.28 + i * 0.05, -0.17, 0.032, 0.004); }
  for (let i = 0; i < 3; i++) M.knob(0.3 + i * 0.08, -0.27, 0.013, 0.018);
  M.pop();
  // the guard over the bay switch, hinged along its top edge
  COV.box(-0.028, -0.036, 0, 0.028, 0, 0.022, P.red, CK.SATIN);
  COV.box(-0.028, -0.036, 0.022, 0.028, -0.03, 0.03, P.red, CK.SATIN);
  // ------------------------------------------------ consoles: four throttles left, stick right
  for (const sd of [-1, 1]) {
    M.box(sd < 0 ? -0.66 : 0.3, -0.64, -0.55, sd < 0 ? -0.3 : 0.66, -0.52, 0.36, ckRGB(0x33363B), CK.SATIN);
    M.push(sd * 0.48, -0.52, -0.1, -Math.PI / 2, 0, 0);
    M.pbox(-0.16, -0.44, 0, 0.16, 0.44, 0.005, 0.003, ED, CK.SATIN);
    if (sd < 0) { M.pbox(-0.1, 0.0, 0.005, 0.1, 0.36, 0.012, 0.004, P.black, CK.SATIN); for (let i = 0; i < 4; i++) { M.push(-0.08 + i * 0.05, -0.25, 0.005); M.toggle(0, 0, true); M.pop(); } }
    else { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { M.push(-0.08 + i * 0.07, -0.3 + j * 0.06, 0.005); M.button(0, 0, 0.04, 0.03); M.pop(); } for (let i = 0; i < 3; i++) M.knob(-0.07 + i * 0.07, 0.3, 0.013, 0.016); }
    M.pop();
  }
  for (let i = 0; i < 4; i++) {
    const x = -0.075 + i * 0.05;
    THR.box(x - 0.007, 0, -0.01, x + 0.007, 0.09, 0.01, P.metal, CK.METAL);
    THR.pbox(x - 0.02, 0.085, -0.03, x + 0.02, 0.12, 0.02, 0.006, P.black, CK.SATIN);
  }
  THR.box(-0.09, 0.118, -0.022, 0.09, 0.126, -0.012, P.metalD, CK.METAL);
  STK.push(0, 0, 0, -Math.PI / 2, 0, 0); STK.cyl(0, 0, 0, 0.036, 0.03, 12, P.rubber, CK.MATTE); STK.cyl(0, 0, 0.03, 0.012, 0.07, 8, P.metal, CK.METAL); STK.pop();
  STK.push(0, 0.095, 0, 0.15, 0, 0);
  STK.pbox(-0.022, 0, -0.027, 0.022, 0.105, 0.027, 0.008, P.black, CK.SATIN);
  STK.box(-0.016, 0.055, -0.038, 0.016, 0.073, -0.027, P.metalD, CK.METAL);
  STK.box(0.004, 0.103, -0.022, 0.016, 0.113, -0.008, P.red, CK.SATIN);
  STK.pop();
  // ------------------------------------------------ seat, floor and legs
  M.push(0, -0.02, 0.24, 0, Math.PI, 0); M.pbox(-0.16, -0.18, -0.07, 0.16, 0.16, 0.07, 0.035, P.cushion, CK.MATTE); M.pop();
  for (const sd of [-1, 1]) M.box(sd * 0.21 - 0.035, -0.64, 0.02, sd * 0.21 + 0.035, -0.32, 0.26, P.cushion, CK.MATTE);
  M.box(-0.22, -0.78, -0.22, 0.22, -0.7, 0.28, P.cushion, CK.MATTE);
  M.box(-0.7, -1.02, -0.95, 0.7, -0.98, 0.44, CH2, CK.MATTE);
  for (const sd of [-1, 1]) {
    const x = sd * 0.12;
    M.beam([x, -0.67, 0.02], [x, -0.6, -0.42], 0.13, 0.14, P.suit, CK.MATTE);
    M.beam([x, -0.62, -0.44], [x, -0.92, -0.62], 0.11, 0.12, P.suit, CK.MATTE);
    M.box(x - 0.06, -0.98, -0.74, x + 0.06, -0.9, -0.56, P.boot, CK.MATTE);
  }
  return {
    parts: { M, G, STK, THR, COV }, stick: [0.46, -0.52, -0.26], throttle: [-0.46, -0.52, -0.16], cover: panelPt(-0.07, -0.242, 0.012),
    occ: [-0.25, 0.68, -0.55, -0.15], cab: [0.37, 0.22, -0.86, 0.42], tint: ckRGB(0x8A5C1E), spill: [0, -0.34, -0.58], spillCol: [0.45, 0.9, 0.4],
  };
}
const COCKPITS = { jet: buildStormcrowCockpit, bomber: buildWraithCockpit };
// ---------------------------------------------------------------- terrain for the moving maps
const CK_MAPCOL = new Map();
function ckBlockColor(R, id) {
  let c = CK_MAPCOL.get(id);
  if (c !== undefined) return c;
  const t = R.blockTx && R.blockTx[TEX[id * 6 + 2]];
  let r = 0, g = 0, b = 0, n = 0;
  if (t) for (let i = 0; i < t.d.length; i += 4) if (t.d[i + 3] > 127) { r += t.d[i]; g += t.d[i + 1]; b += t.d[i + 2]; n++; }
  c = n ? ((r / n) << 16) | ((g / n) << 8) | (b / n) : 0x707070;
  CK_MAPCOL.set(id, c);
  return c;
}
// north-up top-down picture of the ground: block colours, hill shading, and terrain at or above the given height
// washed amber / red so walls the jet would hit stand out. Sampled a few rows per call into a back buffer, so a
// moving map never costs a whole frame; the finished picture is swapped in when the last row is done.
class CkTerrain {
  constructor(n) { this.n = n; this.row = n; this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = n; this.ctx = this.cv.getContext('2d'); this.img = this.ctx.createImageData(n, n); this.h = new Float32Array(n * n); this.t = -1e9; }
  begin(cx, cz, half, refY) { this.job = [cx, cz, half, refY]; this.row = 0; }
  step(R, w, rows) {
    if (this.row >= this.n) return;
    const [cx, cz, half, refY] = this.job, n = this.n, st = half * 2 / n, H = this.h, d = this.img.data, end = Math.min(n, this.row + rows);
    for (let j = this.row; j < end; j++) {
      const z = Math.floor(cz - half + (j + 0.5) * st);
      for (let i = 0; i < n; i++) {
        const x = Math.floor(cx - half + (i + 0.5) * st), k = j * n + i, o = k * 4;
        const c = w.chunks.get(ckey(x >> 4, z >> 4));
        if (!c) { H[k] = -1; const s = ((i + j) & 3) === 0 ? 34 : 14; d[o] = s; d[o + 1] = s + 4; d[o + 2] = s; d[o + 3] = 255; continue; }
        const ci = ((z & 15) << 4) | (x & 15), h = c.hm[ci];
        H[k] = h;
        let id = h > 0 ? c.blocks[((h - 1) << 8) | ci] & 4095 : 0;
        if (h > 1 && (!id || (!SOLID[id] && !FLUID[id] && !LEAVES[id]))) id = (c.blocks[((h - 2) << 8) | ci] & 4095) || id;
        const base = ckBlockColor(R, id), tt = TINT[id];
        const tn = !tt ? 0xFFFFFF : tt === T_COLOR ? COLOR[id] : c.tints ? (tt === T_GRASS ? c.tints.grass[ci] : tt === T_FOLIAGE ? c.tints.foliage[ci] : c.tints.water[ci]) : 0xFFFFFF;
        let r = ((base >> 16) & 255) * ((tn >> 16) & 255) / 255, g = ((base >> 8) & 255) * ((tn >> 8) & 255) / 255, b = (base & 255) * (tn & 255) / 255;
        // lit from the north-west
        const hw = i > 0 && H[k - 1] >= 0 ? H[k - 1] : h, hn = j > 0 && H[k - n] >= 0 ? H[k - n] : h;
        const sh = clamp(1 + ((hw - h) + (hn - h)) * -0.08 / Math.max(1, st * 0.5), 0.55, 1.35);
        r *= sh; g *= sh; b *= sh;
        if (FLUID[id]) { r *= 0.42; g *= 0.6; b *= 0.62; }
        if (!FLUID[id]) {
          const over = h - refY;
          if (over > -12) { const a = over > 0 ? 0.62 : 0.4 * (1 + over / 12), tg = over > 0 ? 60 : 170, tb = over > 0 ? 30 : 40; r += (255 - r) * a; g += (tg - g) * a; b += (tb - b) * a; }
        }
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    this.row = end;
    if (end >= n) { this.ctx.putImageData(this.img, 0, 0); this.cx = cx; this.cz = cz; this.half = half; }
  }
}
// ---------------------------------------------------------------- instrument pages
const CKC = { bg: '#060C08', grid: 'rgba(150,255,150,0.06)', green: '#9CFF63', white: '#E8EFE2', dim: '#6E8F68', amber: '#FFB23D', red: '#FF4A2A', sky: '#3E5664', gnd: '#6A4A2C', yellow: '#FFD23F' };
const ckFont = (px, w) => `${w || 600} ${px}px ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`;
function ckText(c, s, x, y, px, col, align, base) { c.font = ckFont(px); c.fillStyle = col || CKC.green; c.textAlign = align || 'left'; c.textBaseline = base || 'middle'; c.fillText(s, x, y); }
function ckLine(c, x0, y0, x1, y1, col, w) { c.strokeStyle = col || CKC.green; c.lineWidth = w || 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function ckFrame(c, w, h, title, sub) {
  c.fillStyle = CKC.bg; c.fillRect(0, 0, w, h);
  c.fillStyle = CKC.grid; for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  if (title) { c.fillStyle = 'rgba(156,255,99,0.1)'; c.fillRect(0, 0, w, 22); ckText(c, title, 8, 11, 13, CKC.green); if (sub) ckText(c, sub, w - 8, 11, 13, CKC.dim, 'right'); }
}
// flight data every page shares
function ckFlight(v) {
  const f = v.fwd, u = v.upv, r = v.rightv, sp = v.speed;
  const hd = ((v.heading() / DEG) % 360 + 360) % 360;
  let aoa = 0; if (sp > 3) { const vu = v.vel[0] * u[0] + v.vel[1] * u[1] + v.vel[2] * u[2], vf = v.vel[0] * f[0] + v.vel[1] * f[1] + v.vel[2] * f[2]; aoa = Math.atan2(-vu, Math.max(1, vf)) / DEG; }
  const gz = v.gz === undefined ? 1 : Math.abs(v.gz) < 0.05 ? 0 : v.gz;
  return { pitch: Math.asin(clamp(f[1], -1, 1)) / DEG, bank: Math.atan2(-r[1], u[1]), hd, sp, kph: sp * 3.6, alt: v.y, vs: v.vel[1], agl: v.agl, aoa, gz };
}
// attitude indicator: pitch ladder and horizon rotated with the bank, fixed aircraft symbol, bank pointer
function ckADI(c, cx, cy, R, F, compact) {
  c.save();
  c.beginPath(); if (compact) c.arc(cx, cy, R, 0, TAU); else c.rect(cx - R, cy - R, R * 2, R * 2); c.clip();
  c.translate(cx, cy); c.rotate(-F.bank);
  const ppd = R / (compact ? 30 : 24), off = F.pitch * ppd;
  c.fillStyle = CKC.sky; c.fillRect(-R * 2, -R * 4 + off, R * 4, R * 4);
  c.fillStyle = CKC.gnd; c.fillRect(-R * 2, off, R * 4, R * 4);
  ckLine(c, -R * 2, off, R * 2, off, CKC.white, 2);
  for (let d = -90; d <= 90; d += 5) {
    if (!d) continue;
    const y = off - d * ppd; if (Math.abs(y) > R * 1.5) continue;
    const wd = d % 10 === 0 ? R * 0.34 : R * 0.15;
    ckLine(c, -wd, y, wd, y, CKC.white, d % 10 === 0 ? 2 : 1.5);
    if (d % 10 === 0 && !compact) { ckText(c, String(Math.abs(d)), -wd - 6, y, 12, CKC.white, 'right'); ckText(c, String(Math.abs(d)), wd + 6, y, 12, CKC.white, 'left'); }
  }
  c.restore();
  // bank scale over the top, pointer turns with the bank
  c.save(); c.translate(cx, cy);
  c.strokeStyle = CKC.white; c.lineWidth = 2;
  const rr = R * 0.86;
  for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const t = (a - 90) * DEG, l = a % 30 === 0 ? 10 : 6;
    ckLine(c, Math.cos(t) * rr, Math.sin(t) * rr, Math.cos(t) * (rr + l), Math.sin(t) * (rr + l), CKC.white, 2);
  }
  c.rotate(-F.bank);
  c.fillStyle = CKC.yellow; c.beginPath(); c.moveTo(0, -rr + 2); c.lineTo(-7, -rr + 14); c.lineTo(7, -rr + 14); c.closePath(); c.fill();
  c.restore();
  // aircraft symbol
  c.strokeStyle = CKC.amber; c.lineWidth = 4; c.beginPath();
  c.moveTo(cx - R * 0.42, cy); c.lineTo(cx - R * 0.14, cy); c.lineTo(cx - R * 0.07, cy + R * 0.07); c.lineTo(cx, cy); c.lineTo(cx + R * 0.07, cy + R * 0.07); c.lineTo(cx + R * 0.14, cy); c.lineTo(cx + R * 0.42, cy); c.stroke();
  if (Math.abs(F.bank) > Math.PI / 2) ckText(c, 'INVERTED', cx, cy + R * 0.55, 14, CKC.amber, 'center');
}
// vertical scale with a boxed readout (speed on the left, altitude on the right)
function ckTape(c, x, cy, h, val, step, every, right, title) {
  const span = step * 10, ppu = h / span;
  c.save(); c.beginPath(); c.rect(right ? x : x - 64, cy - h / 2, 64, h); c.clip();
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(right ? x : x - 64, cy - h / 2, 64, h);
  for (let s = Math.floor((val - span / 2) / step) * step; s <= val + span / 2; s += step) {
    const y = cy - (s - val) * ppu, major = Math.round(s / step) % every === 0;
    ckLine(c, x, y, right ? x + (major ? 12 : 6) : x - (major ? 12 : 6), y, CKC.green, 2);
    if (major) ckText(c, String(Math.round(s)), right ? x + 16 : x - 16, y, 13, CKC.green, right ? 'left' : 'right');
  }
  c.restore();
  const bx = right ? x + 2 : x - 62;
  c.fillStyle = '#000'; c.fillRect(bx, cy - 13, 60, 26); c.strokeStyle = CKC.white; c.lineWidth = 2; c.strokeRect(bx, cy - 13, 60, 26);
  ckText(c, String(Math.round(val)), bx + 30, cy + 1, 17, CKC.white, 'center');
  ckText(c, title, right ? x + 4 : x - 4, cy - h / 2 - 9, 12, CKC.dim, right ? 'left' : 'right');
}
function ckHeading(c, cx, y, w, hd) {
  const ppd = w / 60;
  c.save(); c.beginPath(); c.rect(cx - w / 2, y - 18, w, 30); c.clip();
  for (let d = Math.floor((hd - 30) / 5) * 5; d <= hd + 30; d += 5) {
    const x = cx + (d - hd) * ppd, dd = ((d % 360) + 360) % 360;
    ckLine(c, x, y, x, y - (dd % 10 === 0 ? 10 : 5), CKC.green, 2);
    if (dd % 30 === 0) ckText(c, { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[dd] || String(dd / 10), x, y - 18, 12, CKC.green, 'center');
  }
  c.restore();
  c.fillStyle = '#000'; c.fillRect(cx - 24, y + 2, 48, 18); c.strokeStyle = CKC.white; c.lineWidth = 1.5; c.strokeRect(cx - 24, y + 2, 48, 18);
  ckText(c, String(Math.round(hd) % 360).padStart(3, '0'), cx, y + 12, 14, CKC.white, 'center');
}
function ckPagePFD(c, w, h, v) {
  const F = ckFlight(v);
  ckFrame(c, w, h, 'FLT', v.onGround ? 'TAXI' : v.stall ? 'STALL' : '');
  const R = Math.min(w * 0.36, (h - 70) * 0.5), cx = w / 2, cy = 26 + R + 8;
  ckADI(c, cx, cy, R, F, false);
  ckTape(c, 64, cy, R * 1.8, F.kph, 20, 5, false, 'KPH');
  ckTape(c, w - 64, cy, R * 1.8, F.alt, 10, 5, true, 'ALT');
  ckHeading(c, cx, h - 20, w * 0.55, F.hd);
  const vs = F.vs, gz = F.gz;
  ckText(c, 'G ' + gz.toFixed(1), 8, h - 34, 14, gz > 6.5 ? CKC.amber : CKC.green);
  ckText(c, 'AOA ' + F.aoa.toFixed(0), 8, h - 16, 13, CKC.dim);
  ckText(c, (vs >= 0 ? '+' : '') + vs.toFixed(0) + ' VS', w - 8, h - 34, 13, CKC.green, 'right');
  ckText(c, 'R ' + (F.agl !== undefined && F.agl < 200 ? Math.round(F.agl) : '---'), w - 8, h - 16, 13, F.agl < 15 && !v.onGround ? CKC.amber : CKC.dim, 'right');
}
function ckPageStby(c, w, h, v) {
  const F = ckFlight(v);
  c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
  ckADI(c, w / 2, h / 2, w * 0.46, F, true);
  ckText(c, String(Math.round(F.kph)), 12, h - 14, 16, CKC.white, 'left');
  ckText(c, String(Math.round(F.alt)), w - 12, h - 14, 16, CKC.white, 'right');
}
// moving map: heading-up terrain, range rings, contacts and the locked target
function ckPageMap(c, w, h, v, g, K, opt) {
  const F = ckFlight(v), T = K.terr || (K.terr = new CkTerrain(opt.cells || 80));
  const range = opt.range, cx = w / 2, cy = opt.center ? h / 2 + 10 : h * 0.68, ppb = (opt.center ? h * 0.42 : h * 0.58) / range;
  const px = opt.at ? opt.at[0] : v.x, pz = opt.at ? opt.at[2] : v.z;
  const now = performance.now();
  if (T.row >= T.n && (now - T.t > opt.every || T.cx === undefined || Math.hypot(px - T.cx, pz - T.cz) > range * 0.35)) { T.t = now; T.begin(px, pz, range * 1.45, v.y); }
  T.step(g.renderer, g.world, T.cx === undefined ? T.n : 14);
  ckFrame(c, w, h, opt.title, opt.sub);
  const hd = F.hd * DEG;
  c.save(); c.beginPath(); c.rect(0, 22, w, h - 22); c.clip();
  c.translate(cx, cy); c.rotate(-hd);
  c.imageSmoothingEnabled = false;
  c.globalAlpha = 0.9;
  c.drawImage(T.cv, (T.cx - T.half - px) * ppb, (T.cz - T.half - pz) * ppb, T.half * 2 * ppb, T.half * 2 * ppb);
  c.globalAlpha = 1;
  c.restore();
  c.save(); c.beginPath(); c.rect(0, 22, w, h - 22); c.clip();
  // range rings and compass ticks
  c.strokeStyle = 'rgba(232,239,226,0.35)'; c.lineWidth = 1.5;
  for (const k of [0.5, 1]) { c.beginPath(); c.arc(cx, cy, range * k * ppb, 0, TAU); c.stroke(); }
  for (let d = 0; d < 360; d += 30) {
    const a = (d * DEG - hd) - Math.PI / 2, r0 = range * ppb;
    ckLine(c, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * (r0 - 10), cy + Math.sin(a) * (r0 - 10), CKC.white, 1.5);
    if (d % 90 === 0) ckText(c, 'NESW'[d / 90], cx + Math.cos(a) * (r0 - 20), cy + Math.sin(a) * (r0 - 20), 13, CKC.white, 'center');
  }
  // contacts
  const ch = Math.cos(-hd), sh = Math.sin(-hd), P = (x, z) => { const dx = (x - px) * ppb, dz = (z - pz) * ppb; return [cx + dx * ch - dz * sh, cy + dx * sh + dz * ch]; };
  for (const e of g.world.entities) {
    if (e.removed || e.dead || e === v || (e.isPlayer && e.vehicle === v) || !(e.isMob || e.isVehicle || e.isPlayer)) continue;
    if (Math.abs(e.x - px) > range * 1.4 || Math.abs(e.z - pz) > range * 1.4) continue;
    const [x, y] = P(e.x, e.z), hostile = e.isMob && e.def && e.def.hostile;
    c.fillStyle = e.type === 'ender_dragon' ? CKC.red : hostile ? CKC.red : e.isVehicle ? CKC.yellow : CKC.dim;
    if (hostile || e.type === 'ender_dragon') { c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 5, y + 4); c.lineTo(x - 5, y + 4); c.closePath(); c.fill(); }
    else c.fillRect(x - 3, y - 3, 6, 6);
    if (e === v.lock) { c.strokeStyle = v.lockT >= 1 ? CKC.yellow : CKC.white; c.lineWidth = 2; c.strokeRect(x - 9, y - 9, 18, 18); }
  }
  if (opt.marks) opt.marks(c, P);
  c.restore();
  // ownship
  const oc = P(v.x, v.z);
  c.fillStyle = CKC.white; c.beginPath(); c.moveTo(oc[0], oc[1] - 10); c.lineTo(oc[0] + 8, oc[1] + 8); c.lineTo(oc[0], oc[1] + 4); c.lineTo(oc[0] - 8, oc[1] + 8); c.closePath(); c.fill();
  ckText(c, 'RNG ' + range, 8, h - 12, 12, CKC.dim);
  ckText(c, String(Math.round(F.hd)).padStart(3, '0') + '°', w - 8, h - 12, 12, CKC.dim, 'right');
}
// stores and systems for the Stormcrow
function ckPageSMS(c, w, h, v) {
  ckFrame(c, w, h, 'SMS / SYS', v.lock ? (v.lockT >= 1 ? 'LOCK' : 'TRACK') : 'SEEK');
  const cx = w / 2;
  // planform with the eight missile stations
  c.strokeStyle = CKC.white; c.lineWidth = 2; c.beginPath();
  c.moveTo(cx, 34); c.lineTo(cx + 12, 70); c.lineTo(cx + 88, 118); c.lineTo(cx + 88, 128); c.lineTo(cx + 18, 124); c.lineTo(cx + 26, 146); c.lineTo(cx - 26, 146); c.lineTo(cx - 18, 124); c.lineTo(cx - 88, 128); c.lineTo(cx - 88, 118); c.lineTo(cx - 12, 70); c.closePath(); c.stroke();
  for (let i = 0; i < 8; i++) {
    const sd = i < 4 ? -1 : 1, k = i % 4, x = cx + sd * (22 + k * 16), y = 96 + k * 7;
    const has = i < v.missiles;
    c.fillStyle = has ? CKC.green : 'rgba(156,255,99,0.15)'; c.fillRect(x - 4, y, 8, 20);
    if (!has && v.mReload > 0 && i === v.missiles) { c.fillStyle = CKC.amber; c.fillRect(x - 4, y + 20 * (v.mReload / 2.4), 8, 20 * (1 - v.mReload / 2.4)); }
  }
  ckText(c, 'HYDRA ' + v.missiles + '/8', 10, 170, 15, CKC.white);
  const lk = v.lock && !v.lock.dead ? (v.lockT >= 1 ? 'LOCKED ' : 'TRACKING ') + Math.round(Math.hypot(v.lock.x - v.x, v.lock.y - v.y, v.lock.z - v.z)) + 'm' : 'NO TARGET';
  ckText(c, lk, w - 10, 170, 13, v.lockT >= 1 ? CKC.yellow : CKC.dim, 'right');
  // gun heat
  ckText(c, 'PLASMA', 10, 196, 13, v.overheat > 0 ? CKC.red : CKC.green);
  c.fillStyle = 'rgba(156,255,99,0.12)'; c.fillRect(80, 189, w - 92, 14);
  c.fillStyle = v.overheat > 0 || v.heat > 0.8 ? CKC.red : CKC.green; c.fillRect(80, 189, (w - 92) * clamp(v.heat, 0, 1), 14);
  // engine: throttle arc with the afterburner band, reheat reserve
  const ex = 70, ey = 268, er = 44;
  c.lineWidth = 7; c.strokeStyle = 'rgba(156,255,99,0.15)'; c.beginPath(); c.arc(ex, ey, er, Math.PI * 0.8, Math.PI * 2.2); c.stroke();
  c.strokeStyle = v.boosting ? CKC.amber : CKC.green; c.beginPath(); c.arc(ex, ey, er, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * clamp(v.throttle * 0.85 + (v.boosting ? 0.15 : 0), 0, 1))); c.stroke();
  ckText(c, String(Math.round(v.throttle * 100)), ex, ey, 20, CKC.white, 'center'); ckText(c, v.boosting ? 'A/B' : 'THR', ex, ey + 22, 12, v.boosting ? CKC.amber : CKC.dim, 'center');
  ckText(c, 'REHEAT', 138, 236, 12, CKC.dim); c.fillStyle = 'rgba(255,178,61,0.15)'; c.fillRect(138, 246, w - 150, 12); c.fillStyle = CKC.amber; c.fillRect(138, 246, (w - 150) * v.boost, 12);
  const hull = v.hull / v.def.hull;
  ckText(c, 'HULL ' + Math.max(0, Math.round(hull * 100)) + '%', 138, 276, 13, hull < 0.3 ? CKC.red : CKC.green);
  c.fillStyle = 'rgba(156,255,99,0.12)'; c.fillRect(138, 286, w - 150, 12); c.fillStyle = hull < 0.3 ? CKC.red : CKC.green; c.fillRect(138, 286, (w - 150) * clamp(hull, 0, 1), 12);
  const F = ckFlight(v);
  ckText(c, 'G ' + F.gz.toFixed(1) + '  MAX ' + (v.gPeak || 1).toFixed(1), 10, h - 42, 14, F.gz > 7 ? CKC.amber : CKC.white);
  ckText(c, v.gear > 0.5 ? 'GEAR DN' : 'GEAR UP', w - 10, h - 42, 13, v.gear > 0.5 ? CKC.green : CKC.dim, 'right');
  ckText(c, 'TERR', 10, h - 18, 12, CKC.dim); c.fillStyle = 'rgba(255,74,42,0.15)'; c.fillRect(56, h - 24, w - 68, 12); c.fillStyle = (v.prox || 0) > 0.5 ? CKC.red : CKC.amber; c.fillRect(56, h - 24, (w - 68) * clamp(v.prox || 0, 0, 1), 12);
}
// bomb sight: ground mapping radar around the computed impact point
function ckPageBomb(c, w, h, v, g, K) {
  const imp = v.ccip(K.imp || (K.imp = [0, 0, 0, 0]));
  const at = imp || [v.x, 0, v.z];
  ckPageMap(c, w, h, v, g, K, { range: 40, center: true, at, every: 220, cells: 72, title: 'BOMB / GMR', sub: v.bay > 0.5 ? 'BAY OPEN' : 'SAFE' });
  const cx = w / 2, cy = h / 2 + 10;
  c.strokeStyle = CKC.yellow; c.lineWidth = 2;
  c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.stroke();
  ckLine(c, cx - 40, cy, cx - 22, cy, CKC.yellow, 2); ckLine(c, cx + 22, cy, cx + 40, cy, CKC.yellow, 2); ckLine(c, cx, cy - 40, cx, cy - 22, CKC.yellow, 2); ckLine(c, cx, cy + 22, cx, cy + 40, CKC.yellow, 2);
  ckText(c, imp ? 'TTI ' + imp[3].toFixed(1) + 's' : 'NO SOLUTION', 8, 36, 14, imp ? CKC.yellow : CKC.amber);
  ckText(c, 'BOMBS ' + v.bombs, w - 8, 36, 14, CKC.white, 'right');
}
function ckPageEng(c, w, h, v) {
  ckFrame(c, w, h, 'ENG', v.boosting ? 'A/B' : '');
  for (let i = 0; i < 4; i++) {
    const x = w * (0.14 + i * 0.24), y = 92, r = 30;
    const n1 = clamp(v.throttle * (0.97 + 0.03 * Math.sin(v.t * 3 + i * 1.7)) + (v.boosting ? 0.08 : 0), 0, 1.1);
    c.lineWidth = 6; c.strokeStyle = 'rgba(156,255,99,0.15)'; c.beginPath(); c.arc(x, y, r, Math.PI * 0.75, Math.PI * 2.25); c.stroke();
    c.strokeStyle = n1 > 1 ? CKC.amber : CKC.green; c.beginPath(); c.arc(x, y, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * clamp(n1 / 1.1, 0, 1))); c.stroke();
    ckText(c, String(Math.round(n1 * 100)), x, y + 2, 15, CKC.white, 'center');
    ckText(c, 'N1-' + (i + 1), x, y + 44, 11, CKC.dim, 'center');
    const egt = clamp(0.25 + v.engine * 0.55 + (v.boosting ? 0.2 : 0), 0, 1);
    c.fillStyle = 'rgba(255,178,61,0.15)'; c.fillRect(x - 6, 150, 12, 60); c.fillStyle = egt > 0.9 ? CKC.red : CKC.amber; c.fillRect(x - 6, 210 - 60 * egt, 12, 60 * egt);
  }
  ckText(c, 'EGT', 8, 222, 11, CKC.dim);
  const hull = v.hull / v.def.hull;
  ckText(c, 'HULL ' + Math.max(0, Math.round(hull * 100)) + '%', 8, 248, 14, hull < 0.3 ? CKC.red : CKC.green);
  ckText(c, 'REHEAT ' + Math.round(v.boost * 100) + '%', w - 8, 248, 14, CKC.amber, 'right');
  ckText(c, 'GUN ' + (v.overheat > 0 ? 'OVHT' : Math.round(v.heat * 100) + '%'), 8, 274, 14, v.overheat > 0 ? CKC.red : CKC.green);
  ckText(c, 'G ' + ckFlight(v).gz.toFixed(1), w - 8, 274, 14, CKC.white, 'right');
  ckText(c, v.gear > 0.5 ? 'GEAR DN' : 'GEAR UP', 8, 300, 13, v.gear > 0.5 ? CKC.green : CKC.dim);
  ckText(c, 'THR ' + Math.round(v.throttle * 100), w - 8, 300, 13, CKC.white, 'right');
}
function ckPageCount(c, w, h, v) {
  c.fillStyle = '#0A0302'; c.fillRect(0, 0, w, h);
  c.font = ckFont(46, 700); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = 'rgba(255,90,40,0.12)'; c.fillText('88', w / 2, h / 2 + 2);
  c.fillStyle = '#FF6A2E'; c.fillText(String(v.bombs).padStart(2, '0'), w / 2, h / 2 + 2);
}
// ---------------------------------------------------------------- renderer
class CockpitRenderer {
  constructor(gl) {
    this.gl = gl; this.prog = GLX.program(COCKPIT_VS, COCKPIT_FS, {});
    this.kinds = {}; this.sunVis = 1; this.last = 0;
    this.vp = M4.create(); this.proj = M4.create(); this.part = M4.create(); this.id4 = M4.create(); this.body = new Float32Array(9); this.bm = M4.create();
    this.lamps = new Float32Array(12);
  }
  upload(mesh) {
    const gl = this.gl, data = new Float32Array(mesh.d), vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 48, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 48, 12); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 48, 24); gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 48, 40); gl.enableVertexAttribArray(3);
    gl.bindVertexArray(null);
    return { vao, n: data.length / 12 };
  }
  kind(k) {
    let K = this.kinds[k];
    if (K) return K;
    const gl = this.gl, def = COCKPITS[k]();
    K = this.kinds[k] = Object.assign(def, { mesh: {}, disp: CK_DISPLAYS[k].map(d => Object.assign({ cv: null }, d)), next: 0, fresh: true });
    for (const p in def.parts) K.mesh[p] = this.upload(def.parts[p]);
    K.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, K.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, CK_TEX, CK_TEX, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // lamp legends: white engraving on black, the lamp colour comes from the lens
    const lg = document.createElement('canvas'); lg.width = CK_TEX; lg.height = CK_LEGEND.h; const c = lg.getContext('2d');
    c.fillStyle = '#000'; c.fillRect(0, 0, lg.width, lg.height);
    CK_LAMPS[k].forEach((s, i) => {
      const words = s.split(' ');
      words.forEach((wd, j) => ckText(c, wd, i * CK_LEGEND.w + CK_LEGEND.w / 2, CK_LEGEND.h / 2 + (j - (words.length - 1) / 2) * 13, words.length > 1 ? 11 : 13, '#fff', 'center'));
    });
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, CK_LEGEND.y, gl.RGBA, gl.UNSIGNED_BYTE, lg);
    return K;
  }
  // redraw a couple of screens per frame (all of them when the cockpit first comes up) and upload them
  screens(K, v, game) {
    const gl = this.gl, list = K.disp, n = K.fresh ? list.length : Math.min(list.length, 2);
    K.fresh = false;
    gl.bindTexture(gl.TEXTURE_2D, K.tex);
    for (let k = 0; k < n; k++) {
      const d = list[K.next]; K.next = (K.next + 1) % list.length;
      if (!d.cv) { d.cv = document.createElement('canvas'); d.cv.width = d.w; d.cv.height = d.h; d.ctx = d.cv.getContext('2d'); }
      const c = d.ctx;
      c.save();
      if (d.id === 'pfd') ckPagePFD(c, d.w, d.h, v);
      else if (d.id === 'stby') ckPageStby(c, d.w, d.h, v);
      else if (d.id === 'tsd') ckPageMap(c, d.w, d.h, v, game, K, { range: v.kind === 'bomber' ? 180 : 220, every: 450, title: 'TSD', sub: v.lock && v.lockT >= 1 ? 'LOCK' : '' });
      else if (d.id === 'sms') ckPageSMS(c, d.w, d.h, v);
      else if (d.id === 'bomb') ckPageBomb(c, d.w, d.h, v, game, K.bombK || (K.bombK = {}));
      else if (d.id === 'eng') ckPageEng(c, d.w, d.h, v);
      else if (d.id === 'cnt') ckPageCount(c, d.w, d.h, v);
      c.restore();
      if (d.id !== 'cnt' && d.id !== 'stby') { c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeRect(0, 0, d.w, d.h); }
      gl.texSubImage2D(gl.TEXTURE_2D, 0, d.x, d.y, gl.RGBA, gl.UNSIGNED_BYTE, d.cv);
    }
  }
  draw(R, game, v) {
    const gl = this.gl, K = this.kind(v.kind), pr = this.prog, u = pr.u, env = R.env, cam = game.camera, w = game.world;
    const t = R.time, dt = clamp(t - (this.last || t), 0, 0.1); this.last = t;
    if (this.kindNow !== v || game.frame - (this.frameSeen || 0) > 2) K.fresh = true;
    this.kindNow = v; this.frameSeen = game.frame;
    this.screens(K, v, game);
    // the sun (or moon) seen from the eye: is terrain in the way?
    const L = env.lightDir, hit = raycast(w, cam.x, cam.y, cam.z, L[0], L[1], L[2], 96, false);
    this.sunVis += ((hit ? 0 : 1) - this.sunVis) * Math.min(1, dt * 9);
    const l = w.getLight(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)), skyB = Math.max(0.12, (l >> 4) / 15);
    const q = v.q, Lc = Q.inv(q, L[0], L[1], L[2], [0, 0, 0]), Uc = Q.inv(q, 0, 1, 0, [0, 0, 0]);
    const day = env.day === undefined ? 1 : env.day, night = 1 - day;
    // lamps: caution lights follow the jet's state
    const lp = this.lamps, blink = (t * 3) % 1 < 0.55 ? 1 : 0.15;
    lp.fill(0);
    if (v.kind === 'jet') {
      lp[0] = v.warn || v.hull < v.def.hull * 0.3 ? blink : 0; lp[1] = v.warn === 'PULL UP' ? blink : 0; lp[2] = v.gear > 0.5 ? 1 : 0;
      lp[3] = v.boosting ? 1 : 0; lp[4] = v.lock && v.lockT >= 1 ? 1 : 0; lp[5] = v.heat > 0.8 || v.overheat > 0 ? 1 : 0;
    } else {
      lp[0] = v.bay > 0.5 ? 1 : 0; lp[1] = v.gear > 0.5 ? 1 : 0; lp[2] = v.boosting ? 1 : 0; lp[3] = v.heat > 0.8 || v.overheat > 0 ? 1 : 0;
      lp[4] = v.stall && !v.onGround ? blink : 0; lp[5] = v.warn === 'PULL UP' ? blink : 0; lp[6] = v.hull < v.def.hull * 0.3 ? blink : 0; lp[7] = v.warn ? blink : 0;
    }
    // matrices: the world camera's rotation with a near plane close enough for the canopy frame
    const aspect = (R.outW || R.width) / (R.outH || R.height);
    M4.perspective(this.proj, cam.fov * DEG, aspect, 0.02, 6);
    M4.mul(this.vp, this.proj, R.view);
    Q.toMat(q, this.bm); const B = this.body, bm = this.bm; B[0] = bm[0]; B[1] = bm[1]; B[2] = bm[2]; B[3] = bm[4]; B[4] = bm[5]; B[5] = bm[6]; B[6] = bm[8]; B[7] = bm[9]; B[8] = bm[10];
    gl.useProgram(pr.p); R.setEnvUniforms(pr);
    gl.uniformMatrix4fv(u.uVP, false, this.vp); gl.uniformMatrix3fv(u.uBody, false, B);
    gl.uniform3fv(u.uEye, v.eyeOff);
    gl.uniform3f(u.uSunC, Lc[0], Lc[1], Lc[2]); gl.uniform3f(u.uUpC, Uc[0], Uc[1], Uc[2]);
    const sc = env.sunColor; gl.uniform3f(u.uSunCol, sc[0] * 1.45, sc[1] * 1.45, sc[2] * 1.45);
    const sk = env.skyLight, a = 0.62 * skyB;
    gl.uniform3f(u.uSkyC, sk[0] * a + 0.02, sk[1] * a + 0.02, sk[2] * a + 0.022);
    const hz = env.horizon; gl.uniform3f(u.uGndC, hz[0] * 0.28 * skyB + 0.012, hz[1] * 0.26 * skyB + 0.012, hz[2] * 0.22 * skyB + 0.012);
    const fl = 0.02 + night * 0.07; gl.uniform3f(u.uFlood, fl, fl * 0.72, fl * 0.5);
    gl.uniform3fv(u.uTint, K.tint);
    gl.uniform3fv(u.uSpillP, K.spill); const sp = 0.03 + night * 0.09; gl.uniform3f(u.uSpillC, K.spillCol[0] * sp, K.spillCol[1] * sp, K.spillCol[2] * sp);
    gl.uniform1f(u.uSunVis, this.sunVis); gl.uniform1f(u.uSkyB, skyB);
    gl.uniform1f(u.uScreenB, (0.48 + 0.7 * day) * (env.emissive > 1.5 ? 1.25 : 1)); gl.uniform1f(u.uGlowB, (0.55 + night * 0.9) * (env.emissive > 1.5 ? 1.3 : 1));
    gl.uniform1f(u.uRain, env.rain && !env.nether && !env.end && w.canSeeSky(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)) ? env.rain : 0);
    gl.uniform1f(u.uSpeed, v.speed);
    gl.uniform4fv(u.uOcc, K.occ); gl.uniform4fv(u.uCab, K.cab);
    gl.uniform1fv(u.uLamp, lp);
    const dl = R.dl; gl.uniform1i(u.uDLN, dl.n); if (dl.n) { gl.uniform4fv(u.uDL, dl.pos); gl.uniform4fv(u.uDLC, dl.col); }
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, K.tex); gl.uniform1i(u.uScreens, 4); gl.activeTexture(gl.TEXTURE0);
    gl.depthRange(0, 0.002);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.uniform1f(u.uPass, 0);
    const draw = (m, M) => { gl.uniformMatrix4fv(u.uPart, false, M || this.id4); gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.n); };
    draw(K.mesh.M);
    // stick: rolls with the aileron command, pitches with the elevator; throttle levers swing forward
    const sv = v.stickVis, P = this.part;
    M4.identity(P); M4.translate(P, K.stick[0], K.stick[1], K.stick[2]); M4.rotZ(P, -sv[0] * 0.3); M4.rotX(P, sv[1] * 0.26);
    draw(K.mesh.STK, P);
    M4.identity(P); M4.translate(P, K.throttle[0], K.throttle[1], K.throttle[2]); M4.rotX(P, lerp(0.38, -0.32, v.throttle) - (v.boosting ? 0.14 : 0));
    draw(K.mesh.THR, P);
    if (K.mesh.COV) { M4.identity(P); M4.translate(P, K.cover[0], K.cover[1], K.cover[2]); M4.rotX(P, -0.17 - (v.bay || 0) * 1.9); draw(K.mesh.COV, P); }
    // canopy glass, premultiplied over everything
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.uniform1f(u.uPass, 1);
    draw(K.mesh.G);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE);
    gl.depthRange(0, 1);
    gl.bindVertexArray(null);
  }
}
