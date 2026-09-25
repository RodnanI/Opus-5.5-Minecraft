// ============================================================================
//  Renderer: textures, chunk meshes, visibility, shadows, sky, post-processing
//
//  Chunk geometry lives in large per-region vertex arenas (16x16 chunks each).
//  Every section is a sub-allocation, so a whole region is drawn with a single
//  WEBGL_multi_draw call per layer instead of one draw call per 16^3 section.
// ============================================================================
const WEATHER_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aUV; layout(location=2) in float aA;
uniform mat4 uProj; out vec3 vUV; out float vA; out vec3 vPos;
void main() { vUV = aUV; vA = aA; vPos = aPos; gl_Position = uProj * vec4(aPos, 1.0); }`;
const WEATHER_FS = GLSL_COMMON + `
uniform sampler2DArray uTexI; uniform vec3 uCol, uFogColor; uniform float uFar;
in vec3 vUV; in float vA; in vec3 vPos; out vec4 o;
void main() { vec4 t = texture(uTexI, vUV); if (t.a < 0.05) discard; float f = smoothstep(uFar * 0.6, uFar, length(vPos)); o = vec4(mix(t.rgb * uCol, uFogColor, f), t.a * vA * 0.75); }`;

const RSH = 4, RCH = 1 << RSH;
class DrawList {
  constructor() { this.n = 0; this.quads = 0; this.cnt = new Int32Array(128); this.off = new Int32Array(128); }
  reset() { this.n = 0; this.quads = 0; }
  push(q, nq) {
    const n = this.n, o = q * 24;
    this.quads += nq;
    if (n > 0 && this.off[n - 1] + this.cnt[n - 1] * 4 === o) { this.cnt[n - 1] += nq * 6; return; }
    if (n === this.cnt.length) {
      const c = new Int32Array(n * 2); c.set(this.cnt); this.cnt = c;
      const f = new Int32Array(n * 2); f.set(this.off); this.off = f;
    }
    this.cnt[n] = nq * 6; this.off[n] = o; this.n = n + 1;
  }
}
class ChunkRegion {
  constructor(R, rx, rz) {
    this.R = R; this.rx = rx; this.rz = rz;
    this.ox = rx * RCH * 16; this.oz = rz * RCH * 16;
    this.vbo = null; this.vao = R.gl.createVertexArray();
    this.cap = 0; this.fo = []; this.fs = []; this.nsec = 0; this.used = false; this.sused = false; this.d2 = 0;
    this.lists = [new DrawList(), new DrawList(), new DrawList()];
    this.sl = [new DrawList(), new DrawList()];
    this.grow(1 << 15);
  }
  grow(need) {
    const gl = this.R.gl, old = this.cap;
    let cap = Math.max(Math.ceil(old * 1.5), old + need + 2048, 1 << 15);
    cap = (cap + 4095) & ~4095;
    const nb = gl.createBuffer();
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, nb);
    gl.bufferData(gl.COPY_WRITE_BUFFER, cap * 64, gl.DYNAMIC_DRAW);
    if (old) {
      gl.bindBuffer(gl.COPY_READ_BUFFER, this.vbo);
      gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, old * 64);
      gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    }
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    if (this.vbo) gl.deleteBuffer(this.vbo);
    this.vbo = nb; this.cap = cap;
    this.release(old, cap - old);
    this.R.ensureIndices(cap);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, nb);
    gl.vertexAttribIPointer(0, 4, gl.SHORT, 16, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribIPointer(1, 2, gl.UNSIGNED_INT, 16, 8); gl.enableVertexAttribArray(1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.R.ibo);
    gl.bindVertexArray(null);
  }
  alloc(n) {
    const fo = this.fo, fs = this.fs;
    for (let i = 0; i < fo.length; i++) {
      if (fs[i] < n) continue;
      const o = fo[i];
      if (fs[i] === n) { fo.splice(i, 1); fs.splice(i, 1); } else { fo[i] += n; fs[i] -= n; }
      return o;
    }
    return -1;
  }
  release(o, n) {
    if (n <= 0) return;
    const fo = this.fo, fs = this.fs;
    let lo = 0, hi = fo.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (fo[m] < o) lo = m + 1; else hi = m; }
    const pa = lo > 0 && fo[lo - 1] + fs[lo - 1] === o, na = lo < fo.length && o + n === fo[lo];
    if (pa && na) { fs[lo - 1] += n + fs[lo]; fo.splice(lo, 1); fs.splice(lo, 1); }
    else if (pa) fs[lo - 1] += n;
    else if (na) { fo[lo] = o; fs[lo] += n; }
    else { fo.splice(lo, 0, o); fs.splice(lo, 0, n); }
  }
  dispose() { const gl = this.R.gl; gl.deleteBuffer(this.vbo); gl.deleteVertexArray(this.vao); this.vbo = null; }
}

class Renderer {
  constructor(game) {
    this.game = game;
    const gl = this.gl = GLX.gl;
    this.canvas = gl.canvas;
    this.proj = M4.create(); this.view = M4.create(); this.vp = M4.create(); this.invVP = M4.create();
    this.projHand = M4.create(); this.tmpM = M4.create(); this.shadowMat = M4.create();
    this.planes = new Float32Array(24);
    this.visList = []; this.frameVis = []; this.frameRegs = []; this.visDirty = true; this.visTime = 0; this.vGen = 0;
    this.width = 1; this.height = 1;
    this.hdr = !!GLX.ext.cbf;
    this.md = gl.getExtension('WEBGL_multi_draw');
    this.time = 0; this.frameNo = 0;
    this.stats = { draws: 0, tris: 0, sections: 0, shadowFrames: 0 };
    this.regions = new Map();
    this.stageBuf = new ArrayBuffer(1 << 20);
    this.initTextures();
    this.ibo = gl.createBuffer(); this.iboQuads = 0; this.ensureIndices(1 << 15);
    this.emptyVAO = gl.createVertexArray();
    this.compile();
    this.initLines();
    this.cloudTiles = new Map();
    this.buildCloudMap();
    this.weather = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), n: 0 };
    gl.bindVertexArray(this.weather.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.weather.vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24); gl.enableVertexAttribArray(2);
    gl.bindVertexArray(null);
    this.fx = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), data: new Float32Array(10 * 6 * 4096), n: 0 };
    gl.bindVertexArray(this.fx.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.fx.vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 28); gl.enableVertexAttribArray(2);
    gl.bindVertexArray(null);
    this.lightCand = []; this.lightN = 0;
    this.dl = { pos: new Float32Array(32), col: new Float32Array(32), n: 0 };
    this.post = null;
    this.shadow = null; this.shadowQ = -1;
  }
  // ------------------------------------------------------------------ textures
  // cutoutLayers[l]: 1 = alpha is coverage (boost it so leaves stay dense at distance),
  //                  2 = alpha is a tint mask (grass sides): each mip texel keeps the majority class
  //                      and averages only those texels, so the green fringe never muddies the dirt.
  buildMips(data, size, layers, cutoutLayers) {
    const levels = [data];
    let s = size, prev = data;
    while (s > 1) {
      const ns = s >> 1, out = new Uint8ClampedArray(ns * ns * 4 * layers);
      for (let l = 0; l < layers; l++) {
        const mode = cutoutLayers ? cutoutLayers[l] : 0;
        const pb = l * s * s * 4, ob = l * ns * ns * 4;
        for (let y = 0; y < ns; y++) for (let x = 0; x < ns; x++) {
          const o = ob + (y * ns + x) * 4;
          if (mode === 2) {
            let nm = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) if (prev[pb + ((y * 2 + dy) * s + x * 2 + dx) * 4 + 3] < 191) nm++;
            const wantMask = nm >= 2;
            let r = 0, g = 0, b = 0, n = 0;
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
              const i = pb + ((y * 2 + dy) * s + x * 2 + dx) * 4;
              if ((prev[i + 3] < 191) !== wantMask) continue;
              r += prev[i]; g += prev[i + 1]; b += prev[i + 2]; n++;
            }
            out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = wantMask ? 128 : 255;
            continue;
          }
          let r = 0, g = 0, b = 0, a = 0, w = 0;
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
            const i = pb + ((y * 2 + dy) * s + x * 2 + dx) * 4, al = prev[i + 3];
            const wt = al + 1;
            r += prev[i] * wt; g += prev[i + 1] * wt; b += prev[i + 2] * wt; a += al; w += wt;
          }
          out[o] = r / w; out[o + 1] = g / w; out[o + 2] = b / w;
          out[o + 3] = mode === 1 ? Math.min(255, a / 4 * 1.45) : a / 4;
        }
      }
      levels.push(out); prev = out; s = ns;
    }
    return levels;
  }
  texArray(size, layers, data, cutout, mip, aniso) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    const levels = mip ? this.buildMips(data, size, layers, cutout) : [data];
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, levels.length, gl.RGBA8, size, size, layers);
    for (let i = 0; i < levels.length; i++) { const s = size >> i; gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, i, 0, 0, 0, s, s, layers, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(levels[i].buffer)); }
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, mip ? gl.NEAREST_MIPMAP_LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // anisotropy only where the shader samples with texSharp(); elsewhere it would blur magnified texels on D3D
    if (mip && aniso > 1 && GLX.ext.aniso) gl.texParameterf(gl.TEXTURE_2D_ARRAY, GLX.ext.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(aniso, GLX.maxAniso || 1));
    return t;
  }
  initTextures() {
    const nB = TEXN.length;
    if (nB > (GLX.maxLayers || 256)) console.warn('Block textures (' + nB + ') exceed MAX_ARRAY_TEXTURE_LAYERS ' + GLX.maxLayers);
    this.blockTx = [];
    const data = new Uint8ClampedArray(16 * 16 * 4 * nB), cut = new Uint8Array(nB);
    for (let i = 0; i < nB; i++) {
      const t = paintTex(TEXN[i]); this.blockTx.push(t);
      data.set(t.d, i * 1024);
      for (let k = 3; k < 1024; k += 4) if (t.d[k] < 128) { cut[i] = 1; break; }
    }
    for (const n of ['water_still', 'water_flow', 'ice', 'stained_glass', 'portal', 'tinted_glass']) if (TEXI[n] !== undefined) cut[TEXI[n]] = 0;
    for (const n of MASK_TEXTURES) if (TEXI[n] !== undefined) cut[TEXI[n]] = 2;
    this.blockTex = this.texArray(16, nB, data, cut, true, 16);
    // items, particles and the crack overlay read the block textures through this sampler: plain nearest
    // magnification (their thin extruded quads must never blend with neighbouring texels)
    const gl = this.gl, sp = this.sampNearest = gl.createSampler();
    gl.samplerParameteri(sp, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR); gl.samplerParameteri(sp, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.samplerParameteri(sp, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.samplerParameteri(sp, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const nI = ITEM_TEXN.length;
    this.itemTx = [];
    const idata = new Uint8ClampedArray(16 * 16 * 4 * nI), icut = new Uint8Array(nI).fill(1);
    for (let i = 0; i < nI; i++) { const t = paintItem(ITEM_TEXN[i]); this.itemTx.push(t); idata.set(t.d, i * 1024); }
    this.itemTex = this.texArray(16, nI, idata, icut, true);
  }
  setSkins(canvases) {
    const gl = this.gl, n = canvases.length, S = 64;
    const data = new Uint8ClampedArray(S * S * 4 * n);
    for (let i = 0; i < n; i++) data.set(canvases[i].getContext('2d').getImageData(0, 0, S, S).data, i * S * S * 4);
    if (this.skinTex) gl.deleteTexture(this.skinTex);
    this.skinTex = this.texArray(S, n, data, new Uint8Array(n).fill(1), true);
  }
  ensureIndices(quads) {
    if (quads <= this.iboQuads) return;
    const gl = this.gl;
    const n = Math.max(quads, Math.ceil(this.iboQuads * 1.5), 1 << 15);
    const idx = new Uint32Array(n * 6);
    for (let q = 0, i = 0; q < n; q++) { const v = q * 4; idx[i++] = v; idx[i++] = v + 1; idx[i++] = v + 2; idx[i++] = v; idx[i++] = v + 2; idx[i++] = v + 3; }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.iboQuads = n;
  }
  // ------------------------------------------------------------------ programs
  compile() {
    const S = EFF;
    const sh = S.shadows > 0 ? { SHADOWS: 1, SHADOW_Q: S.shadows } : {};
    // programs are cached by source + defines, so quality changes only compile variants never seen before
    const cache = this.progCache || (this.progCache = new Map());
    const P = (vs, fs, d) => {
      const k = strHash(vs) + ':' + strHash(fs) + ':' + JSON.stringify(d);
      let p = cache.get(k); if (!p) { p = GLX.program(vs, fs, d); cache.set(k, p); }
      return p;
    };
    const wq = S.water;
    const ssr = wq >= 3 ? { SSR_STEPS: 34, SSR_GROW: '1.1' } : { SSR_STEPS: 20, SSR_GROW: '1.17' };
    this.progs = {
      solid: P(CHUNK_VS, CHUNK_FS, Object.assign({}, sh)),
      cutout: P(CHUNK_VS, CHUNK_FS, Object.assign({ CUTOUT: 1 }, sh)),
      water: P(CHUNK_VS, WATER_FS, Object.assign({ WATER: 1, WATERQ: wq }, ssr, sh)),
      shadow: P(SHADOW_VS, SHADOW_FS, {}),
      shadowCut: P(SHADOW_VS, SHADOW_FS, { CUTOUT: 1 }),
      sky: P(FAR_VS, SKY_FS, {}),
      scloud: P(FAR_VS, SCLOUD_FS, {}),
      scloudDepth: P(FSQ_VS, SCLOUD_FS, { FRAG_DEPTH: 1 }),
      cloud: P(CLOUD_VS, CLOUD_FS, {}),
      ent: P(ENT_VS, ENT_FS, {}),
      item: P(ITEM_VS, ITEM_FS, {}),
      vox: P(VOX_VS, VOX_FS, Object.assign({}, sh)),
      fx: P(FX_VS, FX_FS, {}),
      part: P(PART_VS, PART_FS, {}),
      line: P(LINE_VS, LINE_FS, {}),
      crack: P(CRACK_VS, CRACK_FS, {}),
      weather: P(WEATHER_VS, WEATHER_FS, {}),
      copy: P(FSQ_VS, COPY_FS, {}),
      bright: P(FSQ_VS, BRIGHT_FS, {}),
      down: P(FSQ_VS, DOWN_FS, {}),
      up: P(FSQ_VS, UP_FS, {}),
      rays: P(FSQ_VS, GODRAY_FS, { GR_SAMPLES: S.shadows >= 3 ? 48 : 30 }),
      comp: P(FSQ_VS, COMPOSITE_FS, {}),
      final: P(FSQ_VS, FINAL_FS, {}),
    };
    this.compiledKey = this.settingsKey();
  }
  settingsKey() { const S = EFF; return [S.shadows, S.water].join(','); }
  usePost(upscale) { const S = EFF; return !!(upscale || S.bloom || S.godrays || S.fxaa || S.water >= 2 || S.tonemap || S.sharpen > 0.001); }
  // ------------------------------------------------------------------ sizing / FBOs
  // The canvas always matches the display (native pixel density up to maxDPR). The 3D scene may be
  // rendered at a lower internal resolution (resolution scale x adaptive scale) and is then upscaled
  // with sharpening in the final pass, instead of letting the browser stretch a small canvas.
  resize() {
    const S = EFF;
    const dpr = Math.min(window.devicePixelRatio || 1, S.maxDPR || 2);
    const cw = Math.max(1, Math.round(window.innerWidth * dpr)), ch = Math.max(1, Math.round(window.innerHeight * dpr));
    const scale = clamp(S.resScale * (this.autoScale || 1), 0.3, 1);
    let w = Math.max(1, Math.round(cw * scale)), h = Math.max(1, Math.round(ch * scale));
    if (this.shadowQ !== S.shadows) this.setupShadow();
    const wantPost = this.usePost(w !== cw || h !== ch);
    if (!wantPost) { w = cw; h = ch; }
    if (cw !== this.outW || ch !== this.outH) { this.canvas.width = cw; this.canvas.height = ch; this.outW = cw; this.outH = ch; }
    if (w === this.width && h === this.height && this.post !== null && (!!this.post === wantPost) && this.compiledKey === this.settingsKey() && this.postKey === this.postSettingsKey()) return;
    this.width = w; this.height = h;
    if (this.compiledKey !== this.settingsKey()) this.compile();
    this.freePost();
    this.post = wantPost ? this.createPost(w, h) : false;
    this.postKey = this.postSettingsKey();
  }
  postSettingsKey() { const S = EFF; return [S.water >= 2, S.bloom, S.godrays, S.fxaa, S.sharpen > 0.001, this.width !== this.outW || this.height !== this.outH].join(','); }
  freePost() {
    if (!this.post) return;
    const del = (o) => { if (o instanceof WebGLTexture || o instanceof WebGLFramebuffer) GLX.del(o); };
    for (const k in this.post) {
      const o = this.post[k];
      if (Array.isArray(o)) for (const b of o) { del(b.t); del(b.f); } else del(o);
    }
    this.post = null;
  }
  createPost(w, h) {
    const gl = this.gl, p = {};
    const cf = this.hdr ? gl.RGBA16F : gl.RGBA8, ct = this.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    p.color = GLX.tex2D(w, h, cf, gl.RGBA, ct, gl.LINEAR);
    p.depth = GLX.tex2D(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
    p.fbo = GLX.fbo(p.color, p.depth);
    if (!p.fbo.ok) { console.warn('HDR FBO failed, falling back to LDR'); this.hdr = false; GLX.del(p.color); GLX.del(p.fbo); p.color = GLX.tex2D(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); p.fbo = GLX.fbo(p.color, p.depth); }
    const S = EFF;
    if (S.water >= 2) {
      p.copyC = GLX.tex2D(w, h, this.hdr ? gl.RGBA16F : gl.RGBA8, gl.RGBA, ct, gl.LINEAR);
      p.copyD = GLX.tex2D(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
      p.copyF = GLX.fbo(p.copyC, p.copyD);
    }
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    if (S.bloom) {
      p.bloom = [];
      let bw = hw, bh = hh;
      for (let i = 0; i < 5; i++) { const t = GLX.tex2D(bw, bh, cf, gl.RGBA, ct, gl.LINEAR); p.bloom.push({ t, f: GLX.fbo(t), w: bw, h: bh }); bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1); }
      p.bloomUp = [];
      for (let i = 0; i < 4; i++) { const b = p.bloom[i]; const t = GLX.tex2D(b.w, b.h, cf, gl.RGBA, ct, gl.LINEAR); p.bloomUp.push({ t, f: GLX.fbo(t), w: b.w, h: b.h }); }
    }
    if (S.godrays) { p.raysT = GLX.tex2D(hw, hh, cf, gl.RGBA, ct, gl.LINEAR); p.raysF = GLX.fbo(p.raysT); p.rw = hw; p.rh = hh; }
    // final pass (edge AA, sharpening, upscale) reads the tonemapped image from an LDR target
    if (S.fxaa || S.sharpen > 0.001 || w !== this.outW || h !== this.outH) { p.ldr = GLX.tex2D(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); p.ldrF = GLX.fbo(p.ldr); }
    p.black = GLX.tex2D(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    return p;
  }
  setupShadow() {
    const gl = this.gl, q = EFF.shadows;
    this.shadowQ = q;
    if (this.shadow) { GLX.del(this.shadow.tex); GLX.del(this.shadow.fbo); this.shadow = null; }
    if (!q) return;
    const res = [0, 1024, 2048, 4096][q];
    const size = Math.min(res, GLX.maxTex);
    const t = GLX.tex2D(size, size, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadow = { tex: t, fbo: GLX.fbo(null, t), size, dist: [0, 48, 80, 112][q], frame: -1e9, valid: false, dirty: true, cx: 0, cy: 0, cz: 0, L: [0, 1, 0], mat: M4.create() };
  }
  // ------------------------------------------------------------------ section meshes (region arenas)
  regionFor(cx, cz) {
    const rx = cx >> RSH, rz = cz >> RSH, k = ckey(rx, rz);
    let r = this.regions.get(k);
    if (!r) { r = new ChunkRegion(this, rx, rz); this.regions.set(k, r); }
    return r;
  }
  stage(bytes) {
    if (this.stageBuf.byteLength < bytes) this.stageBuf = new ArrayBuffer(Math.max(bytes, this.stageBuf.byteLength * 2));
    return this.stageBuf;
  }
  uploadSection(sec, layers, counts) {
    const gl = this.gl;
    const total = counts[0] + counts[1] + counts[2];
    if (total === 0) { this.freeSection(sec); sec.counts = [0, 0, 0]; this.visDirty = true; return; }
    const reg = this.regionFor(sec.cx, sec.cz);
    if (sec.reg) reg.release(sec.aoff, sec.asz); else reg.nsec++;
    const q = total >> 2;
    let off = reg.alloc(q);
    if (off < 0) { reg.grow(q); off = reg.alloc(q); }
    const bytes = total * 16, buf = this.stage(bytes), u8 = new Uint8Array(buf, 0, bytes);
    let o = 0;
    for (let l = 0; l < 3; l++) { const c = counts[l]; if (c) { u8.set(new Uint8Array(layers[l], 0, c * 16), o); o += c * 16; } }
    const i16 = new Int16Array(buf, 0, total * 8);
    const dx = (sec.cx - reg.rx * RCH) * 16 * PS, dy = sec.sy * 16 * PS, dz = (sec.cz - reg.rz * RCH) * 16 * PS;
    for (let k = 0, n = total * 8; k < n; k += 8) { i16[k] += dx; i16[k + 1] += dy; i16[k + 2] += dz; }
    gl.bindBuffer(gl.ARRAY_BUFFER, reg.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, off * 64, u8, 0, bytes);
    sec.reg = reg; sec.aoff = off; sec.asz = q;
    sec.q0 = off; sec.q1 = off + (counts[0] >> 2); sec.q2 = sec.q1 + (counts[1] >> 2);
    sec.counts = counts; sec.vao = reg;
    this.visDirty = true;
    this.touchShadow(sec);
  }
  freeSection(sec) {
    const reg = sec.reg;
    if (reg) {
      reg.release(sec.aoff, sec.asz);
      if (--reg.nsec <= 0) { reg.dispose(); this.regions.delete(ckey(reg.rx, reg.rz)); }
      sec.reg = null; this.touchShadow(sec);
    }
    sec.vao = null;
  }
  touchShadow(sec) {
    const sh = this.shadow;
    if (!sh || !sh.valid || sh.dirty) return;
    const dx = sec.cx * 16 + 8 - sh.cx, dz = sec.cz * 16 + 8 - sh.cz, r = sh.dist + 24;
    if (dx * dx + dz * dz < r * r) sh.dirty = true;
  }
  debugInfo() {
    let cap = 0, n = 0; for (const r of this.regions.values()) { cap += r.cap; n++; }
    const g = this.game, pg = g.perf;
    return `Regions: ${n}  VRAM ${(cap * 64 / 1048576).toFixed(0)} MB  ${this.md ? 'multi-draw' : 'draw loop'}  shadow redraws ${this.stats.shadowFrames}\n` +
      `Render ${this.width}x${this.height} -> ${this.outW}x${this.outH}  ${pg ? pg.describe() : ''}\n` +
      `Workers: ${g.jobs ? (g.jobs.fallback ? 'none (main-thread fallback)' : g.jobs.workers.length) : '-'}${GLX.software ? '  SOFTWARE RENDERING' : ''}`;
  }
  // ------------------------------------------------------------------ camera / frustum
  setupCamera(cam) {
    const S = EFF, aspect = (this.outW || this.width) / (this.outH || this.height);
    const far = Math.max(96, (S.renderDist + 1) * 16 * 1.25);
    this.near = 0.05; this.far = far + 64;
    M4.perspective(this.proj, cam.fov * DEG, aspect, this.near, this.far);
    M4.view(this.view, cam.yaw, cam.pitch, cam.roll || 0);
    M4.mul(this.vp, this.proj, this.view);
    M4.invert(this.invVP, this.vp);
    M4.perspective(this.projHand, 70 * DEG, aspect, 0.01, 10);
    const m = this.vp, p = this.planes;
    const set = (i, a, b, c, d) => { const l = Math.hypot(a, b, c); p[i] = a / l; p[i + 1] = b / l; p[i + 2] = c / l; p[i + 3] = d / l; };
    set(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
    set(4, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
    set(8, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
    set(12, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
    set(16, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
    set(20, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
  }
  boxVisible(x0, y0, z0, x1, y1, z1) {
    const p = this.planes;
    for (let i = 0; i < 24; i += 4) {
      const a = p[i], b = p[i + 1], c = p[i + 2], d = p[i + 3];
      if (a * (a > 0 ? x1 : x0) + b * (b > 0 ? y1 : y0) + c * (c > 0 ? z1 : z0) + d < 0) return false;
    }
    return true;
  }
  // cave-culling BFS through section connectivity. Recomputed when the camera changes section,
  // and at most ~10x per second while chunks are streaming in.
  computeVisible(world, cam) {
    const csx = Math.floor(cam.x / 16), csz = Math.floor(cam.z / 16);
    const csy = clamp(Math.floor(cam.y / 16), 0, NSEC - 1);
    const R = EFF.renderDist;
    const moved = csx !== this.vcx || csy !== this.vcy || csz !== this.vcz || world !== this.vWorld || R !== this.vR;
    const t = now();
    if (!moved && (!this.visDirty || t - this.visTime < 100)) return this.visList;
    this.vcx = csx; this.vcy = csy; this.vcz = csz; this.vWorld = world; this.vR = R;
    this.visDirty = false; this.visTime = t;
    const D = 2 * R + 3, N = D * D * NSEC;
    if (!this.vStamp || this.vStamp.length < N) { this.vStamp = new Uint32Array(N); this.vqx = new Int32Array(N); this.vqy = new Int32Array(N); this.vqz = new Int32Array(N); this.vqd = new Int32Array(N); }
    const stamp = this.vStamp, qx = this.vqx, qy = this.vqy, qz = this.vqz, qd = this.vqd;
    const gen = ++this.vGen;
    const out = this.visList; out.length = 0;
    const R2 = (R + 0.5) * (R + 0.5), H = R + 1;
    const OPP = VIS_OPP, DX = VIS_DX, DY = VIS_DY, DZ = VIS_DZ;
    let head = 0, tail = 1;
    qx[0] = csx; qy[0] = csy; qz[0] = csz; qd[0] = 7;
    stamp[H + D * (H + D * csy)] = gen;
    const chunks = world.chunks;
    while (head < tail) {
      const x = qx[head], y = qy[head], z = qz[head], dd = qd[head]; head++;
      const ch = chunks.get(ckey(x, z));
      if (!ch) continue;
      const e = dd & 7, dirs = dd >> 3;
      const sec = ch.sections[y];
      if (sec.reg) out.push(sec);
      const vis = sec.vis;
      for (let f = 0; f < 6; f++) {
        if (dirs & (1 << OPP[f])) continue;
        if (e < 6 && vis && !(vis[e] & (1 << f))) continue;
        const ny = y + DY[f];
        if (ny < 0 || ny >= NSEC) continue;
        const ddx = x + DX[f] - csx, ddz = z + DZ[f] - csz;
        if (ddx * ddx + ddz * ddz > R2) continue;
        const k = (ddx + H) + D * ((ddz + H) + D * ny);
        if (stamp[k] === gen) continue;
        stamp[k] = gen;
        qx[tail] = x + DX[f]; qy[tail] = ny; qz[tail] = z + DZ[f]; qd[tail] = OPP[f] | ((dirs | (1 << f)) << 3); tail++;
      }
    }
    return out;
  }
  buildLists(vis) {
    const regs = this.frameRegs; regs.length = 0;
    for (const reg of this.regions.values()) { reg.lists[0].reset(); reg.lists[1].reset(); reg.lists[2].reset(); reg.used = false; }
    for (let i = 0; i < vis.length; i++) {
      const sec = vis[i], reg = sec.reg, c = sec.counts;
      if (!reg.used) { reg.used = true; regs.push(reg); }
      if (c[0]) reg.lists[0].push(sec.q0, c[0] >> 2);
      if (c[1]) reg.lists[1].push(sec.q1, c[1] >> 2);
    }
    for (let i = vis.length - 1; i >= 0; i--) { const sec = vis[i], c = sec.counts; if (c[2]) sec.reg.lists[2].push(sec.q2, c[2] >> 2); }
    const cx = this.camX, cz = this.camZ, hw = RCH * 8;
    for (const reg of regs) { const dx = reg.ox + hw - cx, dz = reg.oz + hw - cz; reg.d2 = dx * dx + dz * dz; }
    if (regs.length > 1) regs.sort((a, b) => a.d2 - b.d2);
  }
  multiDraw(L) {
    const gl = this.gl, md = this.md;
    if (md) { md.multiDrawElementsWEBGL(gl.TRIANGLES, L.cnt, 0, gl.UNSIGNED_INT, L.off, 0, L.n); this.stats.draws++; }
    else { for (let i = 0; i < L.n; i++) gl.drawElements(gl.TRIANGLES, L.cnt[i], gl.UNSIGNED_INT, L.off[i]); this.stats.draws += L.n; }
    this.stats.tris += L.quads * 2;
  }
  // ------------------------------------------------------------------ dynamic point lights
  addLight(x, y, z, radius, r, g, b, intensity) {
    const dx = x - this.camX, dy = y - this.camY, dz = z - this.camZ, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 140 * 140) return;
    let c = this.lightCand[this.lightN];
    if (!c) c = this.lightCand[this.lightN] = { x: 0, y: 0, z: 0, r: 0, cr: 0, cg: 0, cb: 0, i: 0, d: 0 };
    c.x = dx; c.y = dy; c.z = dz; c.r = radius; c.cr = r; c.cg = g; c.cb = b; c.i = intensity; c.d = d2 / (radius * radius);
    this.lightN++;
  }
  finishLights() {
    const dl = this.dl, n = this.lightN;
    const L = this.lightCand;
    if (n > 8) { const a = L.slice(0, n).sort((p, q) => p.d - q.d); for (let i = 0; i < 8; i++) L[i] = a[i]; for (let i = 8; i < n; i++) L[i] = a[i]; }
    dl.n = Math.min(8, n);
    for (let i = 0; i < dl.n; i++) {
      const c = L[i], o = i * 4;
      dl.pos[o] = c.x; dl.pos[o + 1] = c.y; dl.pos[o + 2] = c.z; dl.pos[o + 3] = c.r;
      dl.col[o] = c.cr; dl.col[o + 1] = c.cg; dl.col[o + 2] = c.cb; dl.col[o + 3] = c.i;
    }
    this.lightN = 0;
  }
  // ------------------------------------------------------------------ environment / lighting uniforms
  computeEnv(game) {
    const w = game.world, env = this.env || (this.env = {});
    const S = EFF;
    env.nether = w.dim === 'nether';
    const t = ((game.time % 24000) + 24000) % 24000;
    const ang = t / 24000 * TAU;
    const sy = Math.sin(ang), sx = Math.cos(ang);
    const sun = [sx, sy, 0.22]; const sl = Math.hypot(sun[0], sun[1], sun[2]); sun[0] /= sl; sun[1] /= sl; sun[2] /= sl;
    env.sunDir = sun; env.moonDir = [-sun[0], -sun[1], -sun[2]];
    const day = smoothstep(-0.18, 0.22, sy);
    const sunset = Math.exp(-Math.pow(sy / 0.22, 2)) * (sx > 0 ? 0.85 : 1.0);
    const rain = game.rainLevel || 0, thunder = game.thunderLevel || 0;
    env.day = day; env.night = 1 - day; env.rain = rain; env.sunset = sunset;
    const mixc = (a, b, t2) => [a[0] + (b[0] - a[0]) * t2, a[1] + (b[1] - a[1]) * t2, a[2] + (b[2] - a[2]) * t2];
    const col = (c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
    const biome = game.player ? game.player.biome : BIO.PLAINS;
    const bsky = col(BIOMES[biome] && BIOMES[biome].sky || 0x78A7FF);
    let zen = mixc([0.01, 0.016, 0.042], mixc(bsky, [0.3, 0.5, 0.96], 0.45), day);
    let hor = mixc([0.03, 0.045, 0.09], [0.68, 0.8, 0.98], day);
    hor = mixc(hor, [1.0, 0.5, 0.26], sunset * 0.78);
    zen = mixc(zen, [0.3, 0.33, 0.58], sunset * 0.3);
    const gray = (c, k) => { const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; return mixc(c, [l * 0.75, l * 0.78, l * 0.82], k); };
    zen = gray(zen, rain * 0.8); hor = gray(hor, rain * 0.8);
    const dark = 1 - rain * 0.35 - thunder * 0.25;
    zen = zen.map(v => v * dark); hor = hor.map(v => v * dark);
    env.zenith = zen; env.horizon = hor;
    env.sunGlow = [1.0 * sunset * (1 - rain), 0.45 * sunset * (1 - rain), 0.15 * sunset * (1 - rain)];
    const flash = game.lightning > 0 ? game.lightning : 0;
    const skyAmb = mixc([0.09, 0.11, 0.2], [0.92, 0.97, 1.08], day).map(v => v * (1 - rain * 0.35) + flash * 0.6);
    const sunUp = sy > -0.05;
    env.lightDir = sunUp ? sun : env.moonDir;
    const sunI = S.shadows > 0 ? 0.7 : 0.32;
    env.sunColor = sunUp ? mixc([1.0, 0.93, 0.8], [1.0, 0.58, 0.32], sunset).map(v => v * sunI * smoothstep(-0.05, 0.12, sy) * (1 - rain * 0.85)) : [0.16 * sunI, 0.2 * sunI, 0.32 * sunI].map(v => v * smoothstep(-0.05, -0.2, sy) * (1 - rain));
    env.skyLight = skyAmb.map(v => v * (S.shadows > 0 ? 0.9 : 0.92));
    env.blockColor = [1.0, 0.84, 0.64];
    env.ambient = 0.025 + S.brightness * 0.06;
    env.gamma = S.brightness * 0.55;
    env.emissive = this.post ? (this.hdr ? 1.9 : 1.0) : 1.0;
    const fogFar = S.renderDist * 16;
    env.fog = S.fog ? [fogFar * 0.62, fogFar * 0.98] : [fogFar * 2, fogFar * 3];
    env.fogDensity = rain * 0.004;
    env.fogColor = hor.slice();
    env.fogSky = 1;
    env.stars = smoothstep(0.0, -0.22, sy);
    env.moonPhase = ((Math.floor(game.time / 24000) % 8) + 8) % 8 / 8;
    const litC = mixc([0.14, 0.16, 0.23], mixc([1.08, 1.05, 1.0], [1.2, 0.7, 0.42], sunset), day);
    env.cloudLit = litC.map(v => v * (1 - rain * 0.5));
    env.cloudDark = mixc([0.045, 0.055, 0.085], [0.5, 0.55, 0.64], day).map(v => v * (1 - rain * 0.45));
    if (env.nether) {
      const nb = BIOMES[biome] && BIOMES[biome].fogc || 0x330808;
      const nc = col(nb).map(v => v * 1.5 + 0.02);
      env.zenith = nc; env.horizon = nc; env.fogColor = nc; env.sunGlow = [0, 0, 0];
      env.skyLight = [0, 0, 0]; env.sunColor = [0, 0, 0]; env.ambient = 0.2 + S.brightness * 0.1;
      env.fog = [8, Math.min(fogFar * 0.8, 110)]; env.fogDensity = 0.004; env.stars = 0; env.day = 0; env.night = 0;
      env.lightDir = [0.3, 0.9, 0.3]; env.fogSky = 0;
    }
    env.end = w.dim === 'end';
    if (env.end) {
      // no sun and no day: a dim violet light from overhead (fixed, so the spike shadows are cached) under a void sky
      const fc = [0.05, 0.035, 0.075];
      env.zenith = [0.03, 0.02, 0.05]; env.horizon = fc; env.fogColor = fc; env.sunGlow = [0, 0, 0];
      const L = [0.32, 0.9, 0.29], ll = Math.hypot(L[0], L[1], L[2]);
      env.sunDir = env.lightDir = L.map(v => v / ll);
      env.sunColor = [0.3, 0.26, 0.4].map(v => v * (S.shadows > 0 ? 1.2 : 0.6));
      env.skyLight = [0.36, 0.3, 0.46]; env.ambient = 0.06 + S.brightness * 0.06;
      env.fog = S.fog ? [fogFar * 0.45, fogFar * 0.95] : [fogFar * 2, fogFar * 3]; env.fogDensity = 0.002; env.fogSky = 0;
      env.stars = 1; env.day = 0.45; env.night = 0; env.rain = 0; env.sunset = 0;
      env.cloudLit = env.cloudDark = fc;
    }
    const p = game.player;
    env.underwater = false; env.inLava = false;
    if (p) {
      // riding a vehicle the camera is not at the player's eyes: test the water at the camera itself
      const cam = game.camera;
      let eyeB = p.eyeBlock || 0;
      if (p.vehicle) {
        const cx = Math.floor(cam.x), cyy = Math.floor(cam.y), cz = Math.floor(cam.z), v = w.getBlock(cx, cyy, cz), id = v & 4095;
        eyeB = v;
        if (FLUID[id] === 1 && !((v >> 12) & 8) && cam.y - cyy > (8 - ((v >> 12) & 7)) / 9) eyeB = 0;
      }
      if (FLUID[eyeB & 4095] === 1 || WLOG[eyeB & 4095]) {
        env.underwater = true; env.fogSky = 0;
        const wc = col(game.world.waterColorAt(Math.floor(p.x), Math.floor(p.z)));
        const k = Math.max(0.15, (p.eyeSky || 0) / 15 * day + 0.1);
        env.fogColor = wc.map(v => v * 0.35 * k); env.fog = [0, 26 + (p.eyeSky || 0) * 1.2]; env.fogDensity = 0.03;
      } else if (FLUID[eyeB & 4095] === 2) { env.inLava = true; env.fogSky = 0; env.fogColor = [0.6, 0.12, 0.0]; env.fog = [0, 2.5]; env.fogDensity = 0.5; }
      if (p.blindness) { env.fog = [0, 6]; env.fogColor = [0, 0, 0]; env.fogSky = 0; }
    }
    return env;
  }
  setEnvUniforms(pr) {
    const gl = this.gl, e = this.env, u = pr.u;
    if (u.uSunDir) gl.uniform3fv(u.uSunDir, e.lightDir);
    if (u.uZenith) gl.uniform3fv(u.uZenith, e.zenith);
    if (u.uHorizon) gl.uniform3fv(u.uHorizon, e.horizon);
    if (u.uSunGlow) gl.uniform3fv(u.uSunGlow, e.sunGlow);
    if (u.uNight) gl.uniform1f(u.uNight, e.night);
    if (u.uSunColor) gl.uniform3fv(u.uSunColor, e.sunColor);
    if (u.uSkyLight) gl.uniform3fv(u.uSkyLight, e.skyLight);
    if (u.uBlockColor) gl.uniform3fv(u.uBlockColor, e.blockColor);
    if (u.uFogColor) gl.uniform3fv(u.uFogColor, e.fogColor);
    if (u.uFog) gl.uniform2fv(u.uFog, e.fog);
    if (u.uFogDensity) gl.uniform1f(u.uFogDensity, e.fogDensity);
    if (u.uFogSky) gl.uniform1f(u.uFogSky, e.fogSky);
    if (u.uAmbient) gl.uniform1f(u.uAmbient, e.ambient);
    if (u.uGamma) gl.uniform1f(u.uGamma, e.gamma);
    if (u.uTime) gl.uniform1f(u.uTime, this.time);
    if (u.uEmissive) gl.uniform1f(u.uEmissive, e.emissive);
    if (u.uWave) gl.uniform1f(u.uWave, SETTINGS.waving ? 1 : 0);
    if (u.uCamMod) gl.uniform3f(u.uCamMod, this.camX % 4096, this.camY, this.camZ % 4096);
    if (u.uShadowMat && this.shadow) gl.uniformMatrix4fv(u.uShadowMat, false, this.shadowMat);
    if (u.uShadowTexel && this.shadow) gl.uniform1f(u.uShadowTexel, 1 / this.shadow.size);
    if (u.uDLN) { const dl = this.dl; gl.uniform1i(u.uDLN, dl.n); if (dl.n) { gl.uniform4fv(u.uDL, dl.pos); gl.uniform4fv(u.uDLC, dl.col); } }
  }
  // ------------------------------------------------------------------ main render
  // GPU frame timing for the adaptive-quality governor (EXT_disjoint_timer_query_webgl2 when available)
  gpuBegin() {
    const gl = this.gl, ext = GLX.ext.timer; if (!ext) return;
    if (!this.tq) this.tq = { pending: [], free: [], ms: 0, valid: false };
    const T = this.tq;
    while (T.pending.length) {
      const q = T.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      T.pending.shift();
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      if (!disjoint) { T.ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; T.valid = true; T.stamp = now(); }
      T.free.push(q);
    }
    if (T.pending.length > 4) return;
    const q = T.free.pop() || gl.createQuery();
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q); T.active = q;
  }
  gpuEnd() { const T = this.tq; if (!T || !T.active) return; this.gl.endQuery(GLX.ext.timer.TIME_ELAPSED_EXT); T.pending.push(T.active); T.active = null; }
  // true when any visible section has translucent geometry (water, ice, glass)
  hasTranslucent() { const regs = this.frameRegs; for (let i = 0; i < regs.length; i++) if (regs[i].lists[2].n) return true; return false; }
  render(game, dt) {
    const gl = this.gl, S = EFF;
    this.time += dt; this.frameNo++;
    this.resize();
    this.gpuBegin();
    const cam = game.camera;
    this.camX = cam.x; this.camY = cam.y; this.camZ = cam.z;
    this.setupCamera(cam);
    const env = this.computeEnv(game);
    const world = game.world;
    const st = this.stats; st.draws = 0; st.tris = 0;
    if (game.collectLights) game.collectLights(this);
    this.finishLights();
    // visibility
    const all = this.computeVisible(world, cam);
    const vis = this.frameVis; vis.length = 0;
    for (let i = 0; i < all.length; i++) {
      const sec = all[i];
      if (!sec.reg) continue;
      const x0 = sec.cx * 16 - cam.x, y0 = sec.sy * 16 - cam.y, z0 = sec.cz * 16 - cam.z;
      if (this.boxVisible(x0, y0, z0, x0 + 16, y0 + 16, z0 + 16)) vis.push(sec);
    }
    st.sections = vis.length;
    this.buildLists(vis);
    // shadows (cached; only redrawn when the sun, camera or nearby geometry changed)
    if (this.shadow && !env.nether && env.sunColor[0] + env.sunColor[1] > 0.01) this.renderShadows(world, cam, env);
    const post = this.post;
    gl.bindFramebuffer(gl.FRAMEBUFFER, post ? post.fbo : null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(env.fogColor[0], env.fogColor[1], env.fogColor[2], 1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // opaque chunks, near to far
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);
    this.drawLayer(this.progs.solid, 0, env);
    this.drawLayer(this.progs.cutout, 1, env);
    if (game.drawEntities) game.drawEntities(this);
    this.drawSelection(game);
    // sky only where nothing was drawn, then clouds
    this.drawSky(env);
    if (!env.nether && !env.end) { if (S.clouds === 3) this.drawShaderClouds(game, env); else if (S.clouds) this.drawClouds(game, env); }
    // translucent (the refraction copy is skipped when no water or glass is on screen)
    const translucent = this.hasTranslucent();
    if (post && post.copyF && translucent) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, post.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, post.copyF);
      gl.blitFramebuffer(0, 0, this.width, this.height, 0, 0, this.width, this.height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, post.fbo);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    if (translucent) this.drawLayer(this.progs.water, 2, env);
    gl.depthMask(false);
    if (game.drawParticles) game.drawParticles(this);
    if (game.drawFX) game.drawFX(this);
    this.drawWeather(game, env);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // first-person hand in a sliver of depth range: always on top, and the scene depth stays intact for
    // god rays and edge anti-aliasing (clearing the depth buffer made every pixel look like open sky).
    // A jet's cockpit interior is drawn the same way.
    if (game.drawCockpit) game.drawCockpit(this);
    if (game.drawHand) { gl.depthRange(0, 0.001); game.drawHand(this); gl.depthRange(0, 1); }
    if (post) this.postProcess(game, env);
    gl.bindVertexArray(null);
    this.gpuEnd();
  }
  drawLayer(pr, layer, env) {
    const gl = this.gl, u = pr.u;
    gl.useProgram(pr.p); this.setEnvUniforms(pr);
    gl.uniformMatrix4fv(u.uProj, false, this.vp);
    if (u.uLodBias) gl.uniform1f(u.uLodBias, -0.35);
    if (u.uPortalLayer) gl.uniform1f(u.uPortalLayer, TEXI.end_portal);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex); gl.uniform1i(u.uTex, 0);
    if (this.shadow && u.uShadowMap) { gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.shadow.tex); gl.uniform1i(u.uShadowMap, 1); }
    if (layer === 2) {
      const post = this.post;
      if (u.uSceneColor && post && post.copyC) {
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, post.copyC); gl.uniform1i(u.uSceneColor, 2);
        gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, post.copyD); gl.uniform1i(u.uSceneDepth, 3);
      }
      if (u.uScreenInv) gl.uniform2f(u.uScreenInv, 1 / this.width, 1 / this.height);
      if (u.uProjOnly) gl.uniformMatrix4fv(u.uProjOnly, false, this.vp);
      if (u.uNear) { gl.uniform1f(u.uNear, this.near); gl.uniform1f(u.uFar, this.far); }
      if (u.uUnderwater) gl.uniform1f(u.uUnderwater, env && env.underwater ? 1 : 0);
    }
    const regs = this.frameRegs, n = regs.length;
    for (let k = 0; k < n; k++) {
      const reg = regs[layer === 2 ? n - 1 - k : k], L = reg.lists[layer];
      if (!L.n) continue;
      gl.uniform3f(u.uOffset, reg.ox - this.camX, -this.camY, reg.oz - this.camZ);
      gl.bindVertexArray(reg.vao);
      this.multiDraw(L);
    }
  }
  renderShadows(world, cam, env) {
    const gl = this.gl, sh = this.shadow;
    const L = env.lightDir, dist = sh.dist;
    const mx = cam.x - sh.cx, my = cam.y - sh.cy, mz = cam.z - sh.cz;
    const dl = L[0] * sh.L[0] + L[1] * sh.L[1] + L[2] * sh.L[2];
    const lim = dist * 0.06;
    const need = sh.dirty || !sh.valid || mx * mx + my * my + mz * mz > lim * lim || dl < 0.9999995 || this.frameNo - sh.frame > 120;
    if (need) {
      sh.valid = true; sh.dirty = false; sh.frame = this.frameNo; this.stats.shadowFrames++;
      sh.cx = cam.x; sh.cy = cam.y; sh.cz = cam.z; sh.L[0] = L[0]; sh.L[1] = L[1]; sh.L[2] = L[2];
      const Rm = this.tmpM;
      M4.lookDir(Rm, -L[0], -L[1], -L[2], 0, 1, 0);
      const texel = dist * 2 / sh.size;
      const lx = Rm[0] * cam.x + Rm[4] * cam.y + Rm[8] * cam.z, ly = Rm[1] * cam.x + Rm[5] * cam.y + Rm[9] * cam.z;
      const ox = lx - Math.floor(lx / texel) * texel, oy = ly - Math.floor(ly / texel) * texel;
      const O = this._shO || (this._shO = M4.create()); M4.ortho(O, -dist, dist, -dist, dist, -220, 220);
      const T = this._shT || (this._shT = M4.create()); M4.identity(T); T[12] = ox; T[13] = oy;
      M4.mul(sh.mat, O, T); M4.mul(sh.mat, sh.mat, Rm);
      // casters: every meshed section whose bounding sphere touches the light-space box
      for (const reg of this.regions.values()) { reg.sl[0].reset(); reg.sl[1].reset(); reg.sused = false; }
      const regs = this._shRegs || (this._shRegs = []); regs.length = 0;
      const m = sh.mat, rad = 14 / dist;
      const R2 = Math.ceil(dist / 16) + 1;
      const pcx = Math.floor(cam.x / 16), pcz = Math.floor(cam.z / 16);
      for (let dz = -R2; dz <= R2; dz++) for (let dx = -R2; dx <= R2; dx++) {
        const ch = world.chunks.get(ckey(pcx + dx, pcz + dz)); if (!ch) continue;
        for (let sy = 0; sy < NSEC; sy++) {
          const sec = ch.sections[sy], reg = sec.reg;
          if (!reg) continue;
          const c = sec.counts; if (!c[0] && !c[1]) continue;
          const x = sec.cx * 16 + 8 - cam.x, y = sy * 16 + 8 - cam.y, z = sec.cz * 16 + 8 - cam.z;
          const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13];
          if (X < -1 - rad || X > 1 + rad || Y < -1 - rad || Y > 1 + rad) continue;
          if (!reg.sused) { reg.sused = true; regs.push(reg); }
          if (c[0]) reg.sl[0].push(sec.q0, c[0] >> 2);
          if (c[1]) reg.sl[1].push(sec.q1, c[1] >> 2);
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, sh.fbo);
      gl.viewport(0, 0, sh.size, sh.size);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 3.0);
      for (let layer = 0; layer < 2; layer++) {
        const pr = layer === 0 ? this.progs.shadow : this.progs.shadowCut;
        gl.useProgram(pr.p);
        gl.uniformMatrix4fv(pr.u.uShadowMat, false, sh.mat);
        if (pr.u.uTex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex); gl.uniform1i(pr.u.uTex, 0); }
        for (const reg of regs) {
          const Ls = reg.sl[layer]; if (!Ls.n) continue;
          gl.uniform3f(pr.u.uOffset, reg.ox - cam.x, -cam.y, reg.oz - cam.z);
          gl.bindVertexArray(reg.vao);
          this.multiDraw(Ls);
        }
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.CULL_FACE);
    }
    M4.copy(this.shadowMat, sh.mat);
    M4.translate(this.shadowMat, cam.x - sh.cx, cam.y - sh.cy, cam.z - sh.cz);
  }
  // ------------------------------------------------------------------ sky & clouds
  drawSky(env) {
    const gl = this.gl, sp = this.progs.sky;
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(sp.p); this.setEnvUniforms(sp);
    gl.uniformMatrix4fv(sp.u.uInvVP, false, this.invVP);
    gl.uniform3fv(sp.u.uMoonDir, env.moonDir); gl.uniform1f(sp.u.uSunSize, 0.05); gl.uniform1f(sp.u.uMoonPhase, env.moonPhase);
    gl.uniform1f(sp.u.uNether, env.nether || env.underwater || env.inLava ? 1 : 0); gl.uniform1f(sp.u.uStars, env.stars); gl.uniform1f(sp.u.uRain, env.rain);
    gl.uniform1f(sp.u.uEnd, env.end && !env.underwater && !env.inLava ? 1 : 0);
    gl.uniform3fv(sp.u.uNetherFog, env.fogColor);
    gl.uniform3fv(sp.u.uSunDir, env.sunDir);
    gl.bindVertexArray(this.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true); gl.enable(gl.CULL_FACE);
  }
  drawShaderClouds(game, env) {
    if (env.underwater || env.inLava) return;
    // Below the cloud deck (and no terrain reaches it) clouds can only ever cover open sky, so the pass is
    // drawn at the far plane: the depth test then skips every terrain pixel before the raymarch runs.
    // At or above the deck clouds can hide terrain and need per-pixel depth (which disables that early-out).
    const base = SETTINGS.cloudHeight + 38;
    const below = this.camY < base - 4 && !(game.gen && game.gen.amplified);
    const gl = this.gl, pr = below ? this.progs.scloud : this.progs.scloudDepth, u = pr.u;
    gl.useProgram(pr.p); this.setEnvUniforms(pr);
    gl.uniform3fv(u.uSunDir, env.sunDir);
    gl.uniformMatrix4fv(u.uInvVP, false, this.invVP);
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniform1f(u.uCloudCover, clamp(0.33 + env.rain * 0.67, 0, 1));
    gl.uniform1f(u.uCloudY, base - this.camY);
    gl.uniform1f(u.uCloudThick, 44);
    if (u.uFarC) gl.uniform1f(u.uFarC, this.far);
    const drift = game.time * 0.025 + this.time * 1.4;
    gl.uniform2f(u.uCloudOff, (this.camX + drift) % 65536, (this.camZ + drift * 0.35) % 65536);
    gl.uniform3fv(u.uCloudLit, env.cloudLit); gl.uniform3fv(u.uCloudDark, env.cloudDark);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(below ? gl.LEQUAL : gl.LESS); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
  }
  // ------------------------------------------------------------------ lines & crack overlay
  initLines() {
    const gl = this.gl;
    this.lineVAO = gl.createVertexArray(); this.lineVBO = gl.createBuffer();
    gl.bindVertexArray(this.lineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.enableVertexAttribArray(0);
    this.crackVAO = gl.createVertexArray(); this.crackVBO = gl.createBuffer();
    gl.bindVertexArray(this.crackVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.crackVBO);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12); gl.enableVertexAttribArray(1);
    gl.bindVertexArray(null);
  }
  // camera-relative line segments (pairs of points)
  drawLines(verts, r, g, b, a) {
    const gl = this.gl, pr = this.progs.line;
    gl.useProgram(pr.p);
    gl.uniformMatrix4fv(pr.u.uProj, false, this.vp);
    gl.uniform3f(pr.u.uOffset, 0, 0, 0);
    gl.uniform4f(pr.u.uColor, r, g, b, a);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.lineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.LINES, 0, verts.length / 3);
    gl.disable(gl.BLEND);
  }
  drawSelection(game) {
    const gl = this.gl, sel = game.player && game.player.target;
    if (!sel || sel.entity || SETTINGS.hudHidden || (game.player && game.player.vehicle)) return;
    const boxes = sel.boxes; if (!boxes || !boxes.length) return;
    const verts = [];
    const e = 0.002;
    const E = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
    for (const b of boxes) {
      const x0 = b[0] - e, y0 = b[1] - e, z0 = b[2] - e, x1 = b[3] + e, y1 = b[4] + e, z1 = b[5] + e;
      const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
      for (const i of E) verts.push(c[i][0], c[i][1], c[i][2]);
    }
    const pr = this.progs.line; gl.useProgram(pr.p);
    gl.uniformMatrix4fv(pr.u.uProj, false, this.vp);
    gl.uniform3f(pr.u.uOffset, sel.x - this.camX, sel.y - this.camY, sel.z - this.camZ);
    gl.uniform4f(pr.u.uColor, 0, 0, 0, 0.6);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.lineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.LINES, 0, verts.length / 3);
    const prog = game.player.breakProgress;
    if (prog > 0) {
      const stage = Math.min(9, Math.floor(prog * 10));
      const cv = [];
      const e2 = 0.004;
      const U = [0, 1, 1, 1, 1, 0, 0, 0];
      for (const b of boxes) {
        const x0 = b[0] - e2, y0 = b[1] - e2, z0 = b[2] - e2, x1 = b[3] + e2, y1 = b[4] + e2, z1 = b[5] + e2;
        const q = (a, bb, c, d, uvs) => { cv.push(...a, uvs[0], uvs[1], ...bb, uvs[2], uvs[3], ...c, uvs[4], uvs[5], ...a, uvs[0], uvs[1], ...c, uvs[4], uvs[5], ...d, uvs[6], uvs[7]); };
        q([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], U); q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], U);
        q([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], U); q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], U);
        q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], U); q([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], U);
      }
      const cp = this.progs.crack; gl.useProgram(cp.p);
      gl.uniformMatrix4fv(cp.u.uProj, false, this.vp);
      gl.uniform3f(cp.u.uOffset, sel.x - this.camX, sel.y - this.camY, sel.z - this.camZ);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.blockTex); gl.uniform1i(cp.u.uTex, 0); gl.bindSampler(0, this.sampNearest);
      gl.uniform1f(cp.u.uLayerC, TEXI['destroy_' + stage]);
      gl.blendFunc(gl.DST_COLOR, gl.ZERO);
      gl.bindVertexArray(this.crackVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.crackVBO);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cv), gl.DYNAMIC_DRAW);
      gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, cv.length / 5);
      gl.depthMask(true); gl.bindSampler(0, null);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.disable(gl.BLEND);
  }
  // ------------------------------------------------------------------ blocky clouds (cached 16x16-cell tiles)
  buildCloudMap() {
    const N = 256, r = new RNG(1234567), nz = new Noise(98765);
    const m = new Uint8Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = fbm2(nz, x / 16, y / 16, 3, 0.5) + (r.next() - 0.5) * 0.15;
      m[y * N + x] = v > 0.18 ? 1 : 0;
    }
    this.cloudMap = m; this.cloudN = N;
  }
  cloudTile(tx, tz, mode) {
    const key = tx + tz * 16 + mode * 256;
    let t = this.cloudTiles.get(key);
    if (t) return t;
    const gl = this.gl, N = this.cloudN, CS_ = 12, H = mode === 2 ? 4 : 0.01, map = this.cloudMap;
    const at = (x, z) => map[(((z % N) + N) % N) * N + (((x % N) + N) % N)];
    let buf = new Float32Array(4096), n = 0;
    const put = (x, y, z, s) => { if (n + 4 > buf.length) { const b = new Float32Array(buf.length * 2); b.set(buf); buf = b; } buf[n++] = x; buf[n++] = y; buf[n++] = z; buf[n++] = s; };
    const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, s) => { put(ax, ay, az, s); put(bx, by, bz, s); put(cx, cy, cz, s); put(ax, ay, az, s); put(cx, cy, cz, s); put(dx, dy, dz, s); };
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = tx * 16 + lx, z = tz * 16 + lz;
      if (!at(x, z)) continue;
      const X0 = lx * CS_, Z0 = lz * CS_, X1 = X0 + CS_, Z1 = Z0 + CS_, Y0 = 0, Y1 = H;
      quad(X0, Y1, Z1, X1, Y1, Z1, X1, Y1, Z0, X0, Y1, Z0, 1.0);
      quad(X0, Y0, Z0, X1, Y0, Z0, X1, Y0, Z1, X0, Y0, Z1, 0.7);
      if (mode === 2) {
        if (!at(x + 1, z)) quad(X1, Y0, Z1, X1, Y0, Z0, X1, Y1, Z0, X1, Y1, Z1, 0.85);
        if (!at(x - 1, z)) quad(X0, Y0, Z0, X0, Y0, Z1, X0, Y1, Z1, X0, Y1, Z0, 0.85);
        if (!at(x, z + 1)) quad(X0, Y0, Z1, X1, Y0, Z1, X1, Y1, Z1, X0, Y1, Z1, 0.9);
        if (!at(x, z - 1)) quad(X1, Y0, Z0, X0, Y0, Z0, X0, Y1, Z0, X1, Y1, Z0, 0.9);
      }
    }
    t = { vao: gl.createVertexArray(), vbo: gl.createBuffer(), count: n / 4 };
    gl.bindVertexArray(t.vao); gl.bindBuffer(gl.ARRAY_BUFFER, t.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.subarray(0, n), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0); gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12); gl.enableVertexAttribArray(1);
    gl.bindVertexArray(null);
    this.cloudTiles.set(key, t);
    return t;
  }
  drawClouds(game, env) {
    const gl = this.gl, S = EFF, N = this.cloudN, CS_ = 12, TW = 16 * CS_;
    const drift = (game.time * 0.03 + this.time * 0.6) % (N * CS_);
    const cx = this.camX + drift, cz = this.camZ;
    const R = Math.min(32, Math.ceil((S.renderDist * 16 + 64) / CS_)), far = R * CS_;
    const pr = this.progs.cloud; gl.useProgram(pr.p); this.setEnvUniforms(pr);
    gl.uniformMatrix4fv(pr.u.uProj, false, this.vp);
    const d = env.day, rain = env.rain;
    const cc = [0.25 + 0.75 * d, 0.27 + 0.73 * d, 0.32 + 0.68 * d].map((x, i) => x * (1 - rain * 0.45) + env.sunGlow[i] * 0.4);
    gl.uniform3fv(pr.u.uCloudColor, cc);
    gl.uniform1f(pr.u.uFar, far);
    gl.uniform1f(pr.u.uAlpha, 0.82);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); gl.disable(gl.CULL_FACE);
    const tx0 = Math.floor((cx - far) / TW), tx1 = Math.floor((cx + far) / TW), tz0 = Math.floor((cz - far) / TW), tz1 = Math.floor((cz + far) / TW);
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = this.cloudTile(((tx % 16) + 16) % 16, ((tz % 16) + 16) % 16, S.clouds);
      if (!t.count) continue;
      gl.uniform3f(pr.u.uOffset, tx * TW - cx, S.cloudHeight - this.camY, tz * TW - cz);
      gl.bindVertexArray(t.vao); gl.drawArrays(gl.TRIANGLES, 0, t.count);
    }
    gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND);
  }
  // ------------------------------------------------------------------ additive FX batch (filled by the game)
  fxBegin() { this.fx.n = 0; }
  fxQuad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, r, g, b, a, beam) {
    const F = this.fx;
    if ((F.n + 6) * 10 > F.data.length) return;
    const d = F.data, m = beam ? 1 + beam : 0;
    const v = (x, y, z, u, w) => { const o = F.n * 10; d[o] = x - this.camX; d[o + 1] = y - this.camY; d[o + 2] = z - this.camZ; d[o + 3] = r; d[o + 4] = g; d[o + 5] = b; d[o + 6] = a; d[o + 7] = u; d[o + 8] = w; d[o + 9] = m; F.n++; };
    v(ax, ay, az, -1, -1); v(bx, by, bz, 1, -1); v(cx, cy, cz, 1, 1);
    v(ax, ay, az, -1, -1); v(cx, cy, cz, 1, 1); v(dx, dy, dz, -1, 1);
  }
  // camera-facing glow sprite
  fxSprite(x, y, z, size, r, g, b, a) {
    const v = this.view, rx = v[0] * size, ry = v[4] * size, rz = v[8] * size, ux = v[1] * size, uy = v[5] * size, uz = v[9] * size;
    this.fxQuad(x - rx - ux, y - ry - uy, z - rz - uz, x + rx - ux, y + ry - uy, z + rz - uz, x + rx + ux, y + ry + uy, z + rz + uz, x - rx + ux, y - ry + uy, z - rz + uz, r, g, b, a, false);
  }
  // camera-facing ribbon from p0 to p1 (bolts, tracers, beams, flames)
  fxBeam(x0, y0, z0, x1, y1, z1, width, r, g, b, a) {
    let dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const l = Math.hypot(dx, dy, dz); if (l < 1e-4) { this.fxSprite(x0, y0, z0, width, r, g, b, a); return; }
    dx /= l; dy /= l; dz /= l;
    const mx = (x0 + x1) / 2 - this.camX, my = (y0 + y1) / 2 - this.camY, mz = (z0 + z1) / 2 - this.camZ;
    let sx = dy * mz - dz * my, sy = dz * mx - dx * mz, sz = dx * my - dy * mx;
    const sl = Math.hypot(sx, sy, sz) || 1; sx = sx / sl * width; sy = sy / sl * width; sz = sz / sl * width;
    const ex = dx * width, ey = dy * width, ez = dz * width;
    this.fxQuad(x0 - ex - sx, y0 - ey - sy, z0 - ez - sz, x1 + ex - sx, y1 + ey - sy, z1 + ez - sz, x1 + ex + sx, y1 + ey + sy, z1 + ez + sz, x0 - ex + sx, y0 - ey + sy, z0 - ez + sz, r, g, b, a, Math.max(0.001, l / (2 * width)));
  }
  fxFlush() {
    const F = this.fx; if (!F.n) return;
    const gl = this.gl, pr = this.progs.fx;
    gl.useProgram(pr.p); this.setEnvUniforms(pr);
    gl.uniformMatrix4fv(pr.u.uProj, false, this.vp);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(F.vao); gl.bindBuffer(gl.ARRAY_BUFFER, F.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, F.data.subarray(0, F.n * 10), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, F.n);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.enable(gl.CULL_FACE);
    F.n = 0;
  }
  // ------------------------------------------------------------------ weather
  drawWeather(game, env) {
    const gl = this.gl, rain = env.rain;
    if (rain < 0.05 || env.nether) return;
    const w = game.world, p = game.player; if (!p) return;
    // from a fast vehicle the rain columns would flash past as giant sheets; the jets draw rain streaks instead
    const fast = p.vehicle && p.vehicle.airFX ? smoothstep(12, 30, p.vehicle.speed) : 0;
    if (fast > 0.99) return;
    const R = IS_MOBILE ? 6 : 10;
    const px = Math.floor(this.camX), pz = Math.floor(this.camZ), py = this.camY;
    const verts = this.weatherBuf || (this.weatherBuf = new Float32Array((2 * R + 1) * (2 * R + 1) * 6 * 7));
    let n = 0;
    const layerR = ITEM_TEXI.p_rain, layerS = ITEM_TEXI.p_snow;
    const t = this.time;
    const V = (x, y, z, u, v, layer, a) => { verts[n++] = x; verts[n++] = y; verts[n++] = z; verts[n++] = u; verts[n++] = -v; verts[n++] = layer; verts[n++] = a; };
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R) continue;
      const x = px + dx, z = pz + dz;
      const top = w.heightAt(x, z);
      const y0 = Math.max(top, py - 12), y1 = py + 14;
      if (y0 >= y1) continue;
      const snow = w.dim === 'overworld' && w.isSnowyAt(x, z, y0);
      const h = hashF2(77, x, z);
      const speed = snow ? 0.8 : 7 + h * 3;
      const vo = t * speed / 4 + h * 4;
      const layer = snow ? layerS : layerR;
      const cxw = x + 0.5 - this.camX, czw = z + 0.5 - this.camZ;
      const dl = Math.hypot(cxw, czw) || 1;
      const rx = -czw / dl * 0.5, rz = cxw / dl * 0.5;
      const a = rain * (1 - Math.min(1, dl / R) * 0.6) * (1 - fast);
      const Y0 = y0 - this.camY, Y1 = y1 - this.camY;
      const v0 = y0 / 4 + vo, v1 = y1 / 4 + vo;
      const sx = snow ? Math.sin(t * 0.7 + h * 10) * 0.2 : 0;
      V(cxw - rx, Y0, czw - rz, 0, v1, layer, a); V(cxw + rx, Y0, czw + rz, 1, v1, layer, a); V(cxw + rx + sx, Y1, czw + rz, 1, v0, layer, a);
      V(cxw - rx, Y0, czw - rz, 0, v1, layer, a); V(cxw + rx + sx, Y1, czw + rz, 1, v0, layer, a); V(cxw - rx + sx, Y1, czw - rz, 0, v0, layer, a);
    }
    if (!n) return;
    const pr = this.progs.weather; gl.useProgram(pr.p);
    gl.uniformMatrix4fv(pr.u.uProj, false, this.vp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.itemTex); gl.uniform1i(pr.u.uTexI, 0);
    const b = 0.35 + 0.65 * env.day;
    gl.uniform3f(pr.u.uCol, b, b, b * 1.05); gl.uniform3fv(pr.u.uFogColor, env.fogColor); gl.uniform1f(pr.u.uFar, R);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    gl.bindVertexArray(this.weather.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.weather.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, n), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, n / 7);
    gl.enable(gl.CULL_FACE);
  }
  // ------------------------------------------------------------------ post-processing
  fsq(pr, target, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, w, h);
    gl.bindVertexArray(this.emptyVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  bindTex(unit, tex, loc) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, unit); }
  postProcess(game, env) {
    const gl = this.gl, p = this.post, S = EFF;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    if (p.bloom) {
      let pr = this.progs.bright; gl.useProgram(pr.p);
      this.bindTex(0, p.color, pr.u.uSrc); gl.uniform2f(pr.u.uTexel, 0.5 / this.width, 0.5 / this.height); gl.uniform1f(pr.u.uThresh, this.hdr ? 1.3 : 0.88);
      this.fsq(pr, p.bloom[0].f, p.bloom[0].w, p.bloom[0].h);
      pr = this.progs.down; gl.useProgram(pr.p);
      for (let i = 1; i < p.bloom.length; i++) { const s = p.bloom[i - 1]; this.bindTex(0, s.t, pr.u.uSrc); gl.uniform2f(pr.u.uTexel, 1 / s.w, 1 / s.h); this.fsq(pr, p.bloom[i].f, p.bloom[i].w, p.bloom[i].h); }
      pr = this.progs.up; gl.useProgram(pr.p);
      let src = p.bloom[p.bloom.length - 1];
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = p.bloomUp.length - 1; i >= 0; i--) {
        const dst = p.bloomUp[i];
        gl.disable(gl.BLEND);
        gl.useProgram(pr.p);
        this.bindTex(0, src.t, pr.u.uSrc); gl.uniform2f(pr.u.uTexel, 0.5 / src.w, 0.5 / src.h);
        this.fsq(pr, dst.f, dst.w, dst.h);
        gl.enable(gl.BLEND);
        const cp = this.progs.copy; gl.useProgram(cp.p); this.bindTex(0, p.bloom[i].t, cp.u.uSrc); this.fsq(cp, dst.f, dst.w, dst.h);
        src = dst;
      }
      gl.disable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    let raysOn = false;
    if (p.raysF && !env.nether && !env.end && !env.underwater) {
      const L = env.sunDir;
      const sp = transformPoint(this.vp, L[0] * 500, L[1] * 500, L[2] * 500, this._sp || (this._sp = [0, 0, 0, 0]));
      if (sp[3] > 0 && env.day > 0.05) {
        const sx = sp[0] * 0.5 + 0.5, sy = sp[1] * 0.5 + 0.5;
        if (sx > -0.6 && sx < 1.6 && sy > -0.6 && sy < 1.6) {
          const pr = this.progs.rays; gl.useProgram(pr.p);
          this.bindTex(0, p.color, pr.u.uSrc); this.bindTex(1, p.depth, pr.u.uDepth);
          gl.uniform2f(pr.u.uSunPos, sx, sy); gl.uniform1f(pr.u.uStrength, 0.4 * (1 - env.rain) * Math.min(1, env.day * 2));
          this.fsq(pr, p.raysF, p.rw, p.rh);
          raysOn = true;
        }
      }
    }
    const pr = this.progs.comp; gl.useProgram(pr.p);
    this.bindTex(0, p.color, pr.u.uScene);
    this.bindTex(1, p.bloom ? p.bloomUp[0].t : p.black, pr.u.uBloom);
    this.bindTex(2, raysOn ? p.raysT : p.black, pr.u.uRays);
    const u = pr.u;
    gl.uniform1f(u.uBloomAmt, this.hdr ? 0.42 : 0.38); gl.uniform1f(u.uUseBloom, p.bloom ? 1 : 0);
    gl.uniform1f(u.uRaysAmt, 1.0); gl.uniform1f(u.uUseRays, raysOn ? 1 : 0);
    gl.uniform3f(u.uRayColor, 1.0, 0.86 + env.day * 0.1, 0.65 + env.day * 0.25);
    gl.uniform1f(u.uTonemap, S.tonemap && this.hdr ? 1 : 0);
    gl.uniform1f(u.uVignette, S.vignette ? 0.55 : 0);
    gl.uniform1f(u.uUnderwater, env.underwater ? 1 : 0); gl.uniform1f(u.uLava, env.inLava ? 1 : 0);
    gl.uniform1f(u.uNausea, game.player ? game.player.portalFx || 0 : 0);
    gl.uniform1f(u.uHurtFx, game.player ? game.player.hurtFx || 0 : 0);
    gl.uniform1f(u.uTime, this.time);
    gl.uniform1f(u.uExposure, S.tonemap && this.hdr ? 1.02 : 1.0);
    gl.uniform1f(u.uSat, 1.1);
    gl.uniform1f(u.uGammaOut, 1.0);
    gl.uniform1f(u.uBoost, game.boostFx || 0);
    const pv = game.player && game.player.vehicle, gfx = pv && game.player.vcam === 1 && pv.gLoad !== undefined && SETTINGS.cockpitFx !== false;
    gl.uniform1f(u.uGLoad, gfx ? Math.min(1, pv.gLoad) : 0); gl.uniform1f(u.uRedout, gfx ? pv.redout : 0);
    gl.uniform1f(u.uWarm, env.nether || env.end ? 0 : env.day);
    if (p.ldrF) {
      this.fsq(pr, p.ldrF, this.width, this.height);
      const fp = this.progs.final, fu = fp.u; gl.useProgram(fp.p);
      this.bindTex(0, p.ldr, fu.uSrc); this.bindTex(1, p.depth, fu.uDepth);
      gl.uniform2f(fu.uTexel, 1 / this.width, 1 / this.height);
      gl.uniform1f(fu.uFxaa, S.fxaa ? 1 : 0);
      // a little extra sharpening when the image is upscaled from a lower internal resolution
      const up = this.width < this.outW ? clamp(1 - this.width / this.outW, 0, 0.5) : 0;
      gl.uniform1f(fu.uSharp, clamp((S.sharpen || 0) + up * 0.8, 0, 1));
      gl.uniform1f(fu.uNear, this.near); gl.uniform1f(fu.uFar, this.far);
      this.fsq(fp, null, this.outW, this.outH);
    } else this.fsq(pr, null, this.outW, this.outH);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
}
const VIS_OPP = [1, 0, 3, 2, 5, 4], VIS_DX = [1, -1, 0, 0, 0, 0], VIS_DY = [0, 0, 1, -1, 0, 0], VIS_DZ = [0, 0, 0, 0, 1, -1];
