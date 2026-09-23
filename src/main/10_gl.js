// ============================================================================
//  WebGL2 helpers
// ============================================================================
const GLX = {
  gl: null, ext: {},
  init(canvas) {
    const attrs = { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, premultipliedAlpha: false };
    // Ask for a hardware context first; if the browser can only offer a slow (software) one, still run,
    // but remember it so the game can start at the lowest settings and tell the player why.
    let gl = canvas.getContext('webgl2', Object.assign({ failIfMajorPerformanceCaveat: true }, attrs));
    if (!gl) { gl = canvas.getContext('webgl2', attrs); if (gl) this.software = true; }
    if (!gl) return null;
    this.gl = gl;
    this.ext.cbf = gl.getExtension('EXT_color_buffer_float');
    this.ext.cbhf = gl.getExtension('EXT_color_buffer_half_float');
    this.ext.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.ext.flt = gl.getExtension('OES_texture_float_linear');
    this.ext.timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.maxAniso = this.ext.aniso ? gl.getParameter(this.ext.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
    this.maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this.renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(this.renderer || '')) this.software = true;
    return gl;
  },
  shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error(log + '\n' + lines);
      throw new Error('Shader compile error: ' + log);
    }
    return s;
  },
  program(vs, fs, defines) {
    const gl = this.gl;
    const pre = '#version 300 es\n' + Object.entries(defines || {}).map(([k, v]) => '#define ' + k + ' ' + v).join('\n') + '\n';
    const p = gl.createProgram();
    gl.attachShader(p, this.shader(gl.VERTEX_SHADER, pre + vs));
    gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, pre + fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  },
  tex2D(w, h, internal, format, type, filter, wrap) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap || gl.CLAMP_TO_EDGE);
    t.w = w; t.h = h;
    return t;
  },
  fbo(color, depth) {
    const gl = this.gl, f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    if (!color) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    f.ok = st === gl.FRAMEBUFFER_COMPLETE;
    f.w = color ? color.w : depth.w; f.h = color ? color.h : depth.h;
    return f;
  },
  del(o) { const gl = this.gl; if (!o) return; if (o instanceof WebGLTexture) gl.deleteTexture(o); else if (o instanceof WebGLFramebuffer) gl.deleteFramebuffer(o); else if (o instanceof WebGLBuffer) gl.deleteBuffer(o); else if (o instanceof WebGLVertexArrayObject) gl.deleteVertexArray(o); },
};
