// ============================================================================
//  GLSL shaders
// ============================================================================
const GLSL_COMMON = `
precision highp float; precision highp int; precision highp sampler2DArray; precision highp sampler2D;
`;
// Crisp texels up close without giving up mipmapped + anisotropic filtering in the distance.
// WebGL on Direct3D (Windows) filters *magnified* texels linearly whenever anisotropy is enabled, which
// smeared every block texture; snapping the sample point to texel centres (with a one-pixel blend at
// texel borders) keeps pixel art sharp while the explicit gradients still pick the right mip level.
const TEX_SHARP_FN = `
vec4 texSharp(sampler2DArray t, vec3 uv, float size, bool clampEdge, float bias) {
  vec2 ts = uv.xy * size;
  vec2 w = max(fwidth(ts), vec2(1e-4));
  vec2 seam = floor(ts + 0.5);
  vec2 st = seam + clamp((ts - seam) / w, -0.5, 0.5);
  if (clampEdge) st = clamp(st, vec2(0.5), vec2(size - 0.5));
  float b = exp2(bias);
  return textureGrad(t, vec3(st / size, uv.z), dFdx(uv.xy) * b, dFdy(uv.xy) * b);
}`;
const SKY_FN = `
uniform vec3 uZenith, uHorizon, uSunGlow, uSunDir;
uniform float uNight;
vec3 skyCol(vec3 d) {
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHorizon, uZenith, pow(h, 0.5));
  c = mix(c, uHorizon * 1.06, exp(-abs(d.y) * 10.0) * 0.3);
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunGlow * (pow(sd, 7.0) * 0.6 + pow(sd, 60.0) * 0.9) * (1.0 - h * 0.6);
  if (d.y < 0.0) c = mix(c, uHorizon * 0.5, clamp(-d.y * 2.5, 0.0, 1.0));
  return c;
}
`;
const NOISE_FN = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 vnoised(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  float k = a - b - c + d;
  return vec3(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * (vec2(b - a, c - a) + k * u.yx));
}
`;
// -------------------------------------------------------------------- chunks
const CHUNK_VS = GLSL_COMMON + `
layout(location=0) in ivec4 aPos;
layout(location=1) in uvec2 aData;
uniform mat4 uProj;
uniform vec3 uOffset, uCamMod;
uniform float uTime, uWave;
out vec3 vUV;
#ifndef DEPTH_ONLY
out vec4 vLight; out vec3 vTint; flat out int vFlags; out vec3 vPos; out vec3 vNormal;
#ifdef SHADOWS
uniform mat4 uShadowMat;
out vec4 vShadowPos;
#endif
const vec3 NORMALS[7] = vec3[7](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1), vec3(0,1,0));
const float SHADE[7] = float[7](0.6, 0.6, 1.0, 0.5, 0.8, 0.8, 0.92);
#endif
void main() {
  vec3 p = vec3(aPos.xyz) * (1.0 / 32.0) + uOffset;
  uint d0 = aData.x;
  int face = int((d0 >> 20u) & 7u);
  int wave = int((d0 >> 25u) & 3u);
  int anim = int((d0 >> 27u) & 3u);
  vec3 wp = p + uCamMod;
  if (wave > 0 && uWave > 0.0) {
    float t = uTime;
    if (wave == 1) {
      p.x += sin(wp.x * 1.3 + wp.z * 0.7 + t * 1.7) * 0.03 * uWave;
      p.y += sin(wp.x * 0.9 + wp.y * 1.1 + t * 2.1) * 0.02 * uWave;
      p.z += cos(wp.z * 1.1 + wp.y * 0.6 + t * 1.5) * 0.03 * uWave;
    } else {
      float s = sin(wp.x * 0.8 + wp.z * 0.5 + t * 2.0) + sin(t * 1.3 + wp.x * 0.3) * 0.5;
      p.x += s * 0.06 * uWave; p.z += cos(wp.z * 0.7 + t * 1.8) * 0.045 * uWave;
    }
  }
#ifdef WATER
  if (anim == 1 && (face == 2 || face == 3) && uWave > 0.0) p.y += (sin(wp.x * 1.7 + uTime * 1.6) * cos(wp.z * 1.3 + uTime * 1.2)) * 0.035 * uWave - 0.03;
#endif
  gl_Position = uProj * vec4(p, 1.0);
  vUV = vec3(float((d0 >> 10u) & 31u) / 16.0, float((d0 >> 15u) & 31u) / 16.0, float(d0 & 1023u));
#ifndef DEPTH_ONLY
  int lp = aPos.w;
  vPos = p;
  vLight = vec4(float(lp & 63) / 60.0, float((lp >> 6) & 63) / 60.0, float((lp >> 12) & 3) / 3.0, SHADE[face]);
  uint tc = aData.y;
  vTint = vec3(float((tc >> 16u) & 255u), float((tc >> 8u) & 255u), float(tc & 255u)) / 255.0;
  vFlags = int((d0 >> 23u) & 3u) | (anim << 2) | (int((d0 >> 29u) & 1u) << 4) | (face << 5) | (wave << 8);
  vNormal = NORMALS[face];
#ifdef SHADOWS
  vShadowPos = uShadowMat * vec4(p + NORMALS[face] * 0.045, 1.0);
#endif
#endif
}`;
const ANIM_UV_FN = `
vec3 animUV(vec3 uv, int anim, int face) {
  if (anim == 1) { if (face == 2 || face == 3) uv.xy += vec2(sin(uTime * 0.35 + uv.y * 6.28) * 0.04, uTime * 0.03); else uv.y -= uTime * 0.9; }
  else if (anim == 2) { if (face == 2 || face == 3) uv.xy += vec2(sin(uTime * 0.3 + uv.y * 6.28) * 0.05, uTime * 0.02); else uv.y -= uTime * 0.25; }
  else if (anim == 3) uv.xy += vec2(sin(uTime * 1.2 + uv.y * 9.0) * 0.06, cos(uTime * 1.5 + uv.x * 9.0) * 0.06 + uTime * 0.1);
  return uv;
}`;
const LIGHT_FN = `
uniform vec3 uSunColor, uSkyLight, uBlockColor, uFogColor;
uniform vec2 uFog;
uniform float uAmbient, uGamma, uTime, uEmissive, uFogDensity, uFogSky;
uniform vec4 uDL[8], uDLC[8];
uniform int uDLN;
float gShadow = 1.0;
#ifdef SHADOWS
uniform highp sampler2DShadow uShadowMap;
uniform float uShadowTexel;
in vec4 vShadowPos;
float shadowF() {
  vec3 sp = vShadowPos.xyz / vShadowPos.w * 0.5 + 0.5;
  if (sp.x <= 0.0 || sp.x >= 1.0 || sp.y <= 0.0 || sp.y >= 1.0 || sp.z >= 1.0) return 1.0;
  float z = sp.z - 0.0006;
  float s;
#if defined(CUTOUT) && SHADOW_Q >= 2
  // foliage: 4 hardware-filtered taps are indistinguishable on leaf textures and much cheaper
  vec2 o1 = vec2(0.6, 1.4) * uShadowTexel, o2 = vec2(1.4, -0.6) * uShadowTexel;
  s = (texture(uShadowMap, vec3(sp.xy + o1, z)) + texture(uShadowMap, vec3(sp.xy - o1, z)) + texture(uShadowMap, vec3(sp.xy + o2, z)) + texture(uShadowMap, vec3(sp.xy - o2, z))) * 0.25;
#elif SHADOW_Q >= 3
  s = 0.0;
  const vec2 pd[12] = vec2[12](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));
  for (int i = 0; i < 12; i++) s += texture(uShadowMap, vec3(sp.xy + pd[i] * uShadowTexel * 1.7, z));
  s /= 12.0;
#elif SHADOW_Q >= 2
  s = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) s += texture(uShadowMap, vec3(sp.xy + vec2(x, y) * uShadowTexel, z));
  s /= 9.0;
#else
  s = texture(uShadowMap, vec3(sp.xy, z));
#endif
  vec2 e = abs(sp.xy - 0.5) * 2.0;
  return mix(s, 1.0, smoothstep(0.8, 1.0, max(e.x, e.y)));
}
#endif
float curveL(float l) { return mix(l / (4.0 - 3.0 * l), l, uGamma); }
vec3 dynLights(vec3 pos, vec3 N) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uDLN) break;
    vec3 d = uDL[i].xyz - pos; float r = uDL[i].w, l2 = dot(d, d);
    if (l2 >= r * r) continue;
    float l = sqrt(l2), att = 1.0 - l / r; att *= att;
    float nd = max(dot(N, d / max(l, 0.001)), 0.0) * 0.75 + 0.25;
    acc += uDLC[i].rgb * (uDLC[i].a * att * nd);
  }
  return acc;
}
vec3 computeLightP(float sky, float blk, float ao, float shade, vec3 N, int face, vec3 pos) {
  float skyB = curveL(sky), blkB = curveL(blk);
  vec3 skyC;
#ifdef SHADOWS
  float ndl = face == 6 ? 0.7 : max(dot(N, uSunDir), 0.0);
  float vis = smoothstep(0.55, 0.95, sky);
  float sh = ndl > 0.0 && vis > 0.0 ? shadowF() : 0.0;
  gShadow = sh * vis;
  skyC = uSkyLight * skyB * (0.6 + 0.2 * shade) + uSunColor * (ndl * sh * vis * skyB);
#else
  gShadow = smoothstep(0.55, 0.95, sky);
  skyC = uSkyLight * skyB * shade * 1.05 + uSunColor * skyB * shade * 0.35;
#endif
  float fl = 0.93 + 0.07 * sin(uTime * 7.0 + sin(uTime * 13.0));
  vec3 blkC = uBlockColor * blkB * fl * (0.75 + 0.25 * shade);
  vec3 L = max(skyC, blkC) + min(skyC, blkC) * 0.25;
  L = max(L, vec3(uAmbient) * (0.6 + 0.4 * shade));
  L *= mix(0.4, 1.0, ao * ao * 0.4 + ao * 0.6);
  if (uDLN > 0) L += dynLights(pos, N);
  return L;
}
vec3 computeLight(float sky, float blk, float ao, float shade, vec3 N, int face) { return computeLightP(sky, blk, ao, shade, N, face, vec3(1e5)); }
vec3 fogColorAt(vec3 dir) {
  vec3 fc = mix(uFogColor, skyCol(dir), uFogSky);
  return fc + uSunGlow * pow(max(dot(dir, uSunDir), 0.0), 8.0) * 0.4 * (1.0 - uNight) * (1.0 - uFogSky);
}
vec3 applyFog(vec3 c, vec3 pos) {
  float d = length(pos);
  float f = clamp((d - uFog.x) / max(uFog.y - uFog.x, 1.0), 0.0, 1.0);
  f = f * f * (3.0 - 2.0 * f);
  f = max(f, 1.0 - exp(-d * uFogDensity));
  float air = (1.0 - exp(-d * 0.004)) * 0.3 * uFogSky;
  if (f + air < 0.002) return c;
  vec3 dir = pos / max(d, 0.001);
  vec3 fc = fogColorAt(dir);
  c = mix(c, fc, air);
  return mix(c, fc, f);
}`;
// End portal / gateway surfaces: layers of drifting stars fixed to the screen, so the portal reads as a window
// into deep space rather than a texture on a block
const END_PORTAL_FN = `
uniform float uPortalLayer;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 endPortalFX() {
  vec2 sp = gl_FragCoord.xy / 480.0;
  vec3 col = vec3(0.01, 0.028, 0.034);
  for (int i = 0; i < 6; i++) {
    float fi = float(i), a = fi * 1.7 + uTime * 0.01 * (1.0 + fi * 0.25);
    mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
    vec2 q = R * (sp * (1.0 + fi * 0.55)) + vec2(uTime * 0.018 * (1.0 + fi * 0.3), fi * 0.37);
    vec2 cell = floor(q * 22.0), f = fract(q * 22.0) - 0.5;
    float h = hash21(cell + fi * 17.0);
    vec3 tint = mix(vec3(0.16, 0.62, 0.56), vec3(0.5, 0.28, 0.82), fract(h * 7.0 + fi * 0.3));
    col += tint * step(0.92, h) * smoothstep(0.24, 0.0, length(f)) * (1.25 - fi * 0.12);
    col += tint * 0.022 * h;
  }
  return col * uEmissive;
}`;
const CHUNK_FS = GLSL_COMMON + SKY_FN + `
uniform sampler2DArray uTex;
uniform float uLodBias;
in vec3 vUV; in vec4 vLight; in vec3 vTint; flat in int vFlags; in vec3 vPos; in vec3 vNormal;
out vec4 outColor;
` + LIGHT_FN + ANIM_UV_FN + TEX_SHARP_FN + END_PORTAL_FN + `
void main() {
  if (abs(vUV.z - uPortalLayer) < 0.5) { outColor = vec4(endPortalFX(), 1.0); return; }
  int anim = (vFlags >> 2) & 3, face = (vFlags >> 5) & 7, tm = vFlags & 3, wave = (vFlags >> 8) & 3;
  vec3 uv = anim == 0 ? vUV : animUV(vUV, anim, face);
  vec4 tex = texSharp(uTex, uv, 16.0, anim == 0, uLodBias);
#ifdef CUTOUT
  if (tex.a < 0.5) discard;
#endif
  vec3 alb = tex.rgb;
  if (tm == 1 || (tm == 2 && tex.a < 0.75)) alb *= vTint;
  vec3 col;
  if (((vFlags >> 4) & 1) == 1) {
    float fl = anim == 0 ? 1.0 : 0.9 + 0.1 * sin(uTime * 3.0 + vPos.x + vPos.z);
    col = alb * uEmissive * fl;
  } else {
    col = alb * computeLightP(vLight.x, vLight.y, vLight.z, vLight.w, vNormal, face, vPos);
#ifdef CUTOUT
    // foliage: light transmitted through leaves and plants when looking toward the sun
    if (wave > 0 || face == 6) {
      vec3 V = normalize(vPos);
      float tr = pow(max(dot(V, uSunDir), 0.0), 5.0);
      col += alb * uSunColor * (gShadow * tr * 0.9 * curveL(vLight.x));
    }
#endif
  }
  col = applyFog(col, vPos);
#ifdef TRANSLUCENT
  outColor = vec4(col, tex.a);
#else
  outColor = vec4(col, 1.0);
#endif
}`;
// -------------------------------------------------------------------- water
const WATER_FS = GLSL_COMMON + SKY_FN + NOISE_FN + `
uniform sampler2DArray uTex;
uniform sampler2D uSceneColor, uSceneDepth;
uniform vec2 uScreenInv;
uniform vec3 uCamMod;
uniform mat4 uProjOnly;
uniform float uUnderwater, uNear, uFar;
in vec3 vUV; in vec4 vLight; in vec3 vTint; flat in int vFlags; in vec3 vPos; in vec3 vNormal;
out vec4 outColor;
` + LIGHT_FN + `
float linDepth(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
vec2 waveGrad(vec2 p, float t, float detail) {
  vec2 g = vec2(0.0);
  const vec4 W[5] = vec4[5](vec4(0.83, 0.56, 0.9, 1.1), vec4(-0.45, 0.89, 1.4, 1.5), vec4(0.21, -0.98, 2.3, 1.9), vec4(-0.94, -0.33, 3.7, 2.6), vec4(0.62, 0.78, 5.9, 3.3));
  const float A[5] = float[5](0.05, 0.036, 0.022, 0.012, 0.007);
  for (int i = 0; i < 5; i++) { float ph = dot(W[i].xy, p) * W[i].z + t * W[i].w; g += W[i].xy * (W[i].z * A[i] * cos(ph)); }
  vec3 n1 = vnoised(p * 1.6 + vec2(t * 0.35, t * 0.22));
  vec3 n2 = vnoised(p * 4.1 - vec2(t * 0.5, -t * 0.42));
  g += (n1.yz * 1.6 * 0.07 + n2.yz * 4.1 * 0.018) * detail;
  return g;
}
float caustic(vec2 uv, float time) {
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 3.0);
}
#if WATERQ >= 2
vec3 ssr(vec3 pos, vec3 R, out float hitA) {
  hitA = 0.0;
  vec3 rp = pos, prev = pos;
  float stepL = 0.35 + length(pos) * 0.015;
  for (int i = 0; i < SSR_STEPS; i++) {
    prev = rp; rp += R * stepL; stepL *= SSR_GROW;
    vec4 cp = uProjOnly * vec4(rp, 1.0);
    if (cp.w <= 0.05) break;
    vec2 ndc = cp.xy / cp.w;
    if (abs(ndc.x) > 1.0 || abs(ndc.y) > 1.0) break;
    float sd = linDepth(texture(uSceneDepth, ndc * 0.5 + 0.5).r);
    if (cp.w > sd + 0.03) {
      if (cp.w - sd > stepL * 3.0 + 1.5) break;
      vec3 a = prev, b = rp;
      for (int j = 0; j < 5; j++) {
        vec3 m = (a + b) * 0.5; vec4 cm = uProjOnly * vec4(m, 1.0);
        float md = linDepth(texture(uSceneDepth, cm.xy / cm.w * 0.5 + 0.5).r);
        if (cm.w > md) b = m; else a = m;
      }
      vec4 cb = uProjOnly * vec4(b, 1.0); vec2 bu = cb.xy / cb.w * 0.5 + 0.5;
      vec2 ef = smoothstep(1.0, 0.82, abs(bu * 2.0 - 1.0));
      hitA = ef.x * ef.y * smoothstep(0.0, 0.25, R.y + 0.2);
      return texture(uSceneColor, bu).rgb;
    }
  }
  return vec3(0.0);
}
#endif
void mainW() {
  int face = (vFlags >> 5) & 7;
  bool top = face == 2 || face == 3;
  bool under = uUnderwater > 0.5;
  vec3 uv = vUV;
  if (top) uv.xy += vec2(sin(uTime * 0.35 + uv.y * 6.28) * 0.04, uTime * 0.03); else uv.y -= uTime * 0.9;
  vec4 tex = texture(uTex, uv);
  float dist = length(vPos);
  vec3 V = -vPos / max(dist, 0.001);
  vec3 wp = vPos + uCamMod;
  float detail = 1.0 - smoothstep(24.0, 110.0, dist);
  vec3 n = vNormal;
  if (top) {
    vec2 g = waveGrad(wp.xz, uTime, detail) * mix(0.35, 1.0, detail);
    n = normalize(vec3(-g.x, 1.0, -g.y));
    if (face == 3 || under) n.y = -n.y;
  } else {
    vec2 g = waveGrad(vec2(wp.x + wp.z, wp.y * 2.0 - uTime * 3.0), uTime, detail) * 0.35;
    n = normalize(vNormal + vec3(g.x, g.y, g.x) * 0.5);
  }
  vec3 L = computeLightP(vLight.x, vLight.y, 1.0, vLight.w, vNormal, face, vPos);
  float skyB = curveL(vLight.x);
  float sunVis = gShadow;
  vec3 wcol = vTint * mix(vec3(1.0), tex.rgb * 1.6, 0.25);
  float NdV = max(dot(n, V), 0.0);
  float fres = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  vec3 R = reflect(-V, n);
  if (!under && R.y < 0.02) R.y = 0.02 + (0.02 - R.y) * 0.3;
  vec3 refl = skyCol(normalize(R)) * max(skyB, 0.06);
  // sun glint (GGX)
  vec3 H = normalize(uSunDir + V);
  float NdH = max(dot(n, H), 0.0);
  float a2 = 0.0036, dd = NdH * NdH * (a2 - 1.0) + 1.0;
  float spec = a2 / (3.14159 * dd * dd) * 0.35 * sunVis * (under ? 0.0 : 1.0);
  vec3 sunSpec = uSunColor * min(spec, 60.0);
  vec3 col;
#if WATERQ >= 2
  float hitA = 0.0;
  if (top && !under) { vec3 sr = ssr(vPos, normalize(R), hitA); refl = mix(refl, sr, hitA); }
  vec2 suv = gl_FragCoord.xy * uScreenInv;
  float fragD = linDepth(gl_FragCoord.z);
  vec2 off = n.xz * (top ? 0.045 : 0.015) * detail / max(1.0, fragD * 0.06);
  vec2 ruv = suv + off;
  float sd = linDepth(texture(uSceneDepth, ruv).r);
  if (sd < fragD) { ruv = suv; sd = linDepth(texture(uSceneDepth, suv).r); }
  vec3 behind = texture(uSceneColor, ruv).rgb;
  float path = under ? 1.0 : max(sd - fragD, 0.0) * dist / max(fragD, 0.001);
  if (!under) {
    // caustics on whatever lies below the surface
    vec3 bg = vPos * (sd / max(fragD, 0.001)) + uCamMod;
    float depthV = max(wp.y - bg.y, 0.0);
    float ca = caustic(bg.xz * 0.23 + vec2(depthV * 0.05), uTime * 0.55);
    behind *= 1.0 + min(ca, 1.4) * 0.32 * sunVis * exp(-depthV * 0.12) * smoothstep(0.02, 0.6, depthV) * (1.0 - uNight);
  }
  vec3 absorbK = (vec3(1.0) - vTint) * 0.55 + vec3(0.06, 0.03, 0.02);
  vec3 trans = exp(-absorbK * path);
  vec3 scatter = wcol * (L * 0.3 + skyB * 0.03);
  vec3 body = behind * trans + scatter * (vec3(1.0) - trans);
  if (!top) fres *= 0.25;
  col = mix(body, refl, fres * (under ? 0.25 : 1.0)) + sunSpec;
  // shoreline and contact foam
  if (top && !under) {
    float fn = vnoise(wp.xz * 2.3 + vec2(uTime * 0.4, -uTime * 0.3)) * 0.6 + vnoise(wp.xz * 5.1 - uTime * 0.5) * 0.4;
    float foam = (1.0 - smoothstep(0.0, 0.55, path)) * smoothstep(0.35, 0.75, fn + (1.0 - smoothstep(0.0, 0.3, path)) * 0.5);
    col = mix(col, L * 0.95 + uSunColor * 0.15 * sunVis, foam * 0.75 * detail);
  }
#else
  vec3 lit = wcol * L * 0.75;
  if (top) col = mix(lit, refl, fres * 0.9) + sunSpec;
  else col = lit;
#endif
  col = applyFog(col, vPos);
#if WATERQ >= 2
  outColor = vec4(col, 1.0);
#else
  outColor = vec4(col, top ? mix(0.66, 0.95, fres) : 0.8);
#endif
}
void main() {
  int anim = (vFlags >> 2) & 3;
  if (anim == 1) { mainW(); return; }
  vec3 uv = vUV; if (anim == 3) uv.xy += vec2(sin(uTime * 1.2 + uv.y * 9.0) * 0.06, cos(uTime * 1.5 + uv.x * 9.0) * 0.06 + uTime * 0.1);
  vec4 tex = texture(uTex, uv);
  vec3 alb = tex.rgb; int tm = vFlags & 3; if (tm == 1) alb *= vTint;
  int face = (vFlags >> 5) & 7;
  vec3 c = ((vFlags >> 4) & 1) == 1 ? alb * uEmissive : alb * computeLightP(vLight.x, vLight.y, vLight.z, vLight.w, vNormal, face, vPos);
  if (anim != 3) {
    vec3 V = normalize(-vPos); float fr = 0.04 + 0.96 * pow(1.0 - max(dot(vNormal, V), 0.0), 5.0);
    c = mix(c, skyCol(reflect(-V, vNormal)) * curveL(vLight.x), fr * 0.5);
  }
  outColor = vec4(applyFog(c, vPos), anim == 3 ? 0.78 : tex.a);
}`;
// -------------------------------------------------------------------- shadow depth
const SHADOW_VS = GLSL_COMMON + `
layout(location=0) in ivec4 aPos;
layout(location=1) in uvec2 aData;
uniform mat4 uShadowMat; uniform vec3 uOffset;
out vec3 vUV;
void main() {
  vec3 p = vec3(aPos.xyz) * (1.0 / 32.0) + uOffset;
  uint d0 = aData.x;
  vUV = vec3(float((d0 >> 10u) & 31u) / 16.0, float((d0 >> 15u) & 31u) / 16.0, float(d0 & 1023u));
  gl_Position = uShadowMat * vec4(p, 1.0);
}`;
const SHADOW_FS = GLSL_COMMON + `
uniform sampler2DArray uTex;
in vec3 vUV;
out vec4 o;
void main() {
#ifdef CUTOUT
  if (texture(uTex, vUV).a < 0.5) discard;
#endif
  o = vec4(1.0);
}`;
// -------------------------------------------------------------------- sky
const FSQ_VS = `
out vec2 vUv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
// full-screen triangle at the far plane (drawn after opaque geometry with LEQUAL)
const FAR_VS = `
out vec2 vUv;
void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 1.0, 1.0); }`;
const SKY_FS = GLSL_COMMON + SKY_FN + `
uniform mat4 uInvVP;
uniform vec3 uMoonDir;
uniform float uTime, uSunSize, uMoonPhase, uNether, uStars, uRain, uEnd;
uniform vec3 uNetherFog;
in vec2 vUv;
out vec4 o;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// the End: a black void with slow violet nebula veils and a dense, faintly coloured starfield all around
vec3 endSky(vec3 d) {
  vec3 q = d + vec3(uTime * 0.0015, 0.0, uTime * 0.001);
  float n = vn3(q * 2.3) * 0.5 + vn3(q * 5.3 + 3.1) * 0.3 + vn3(q * 12.0 + 7.7) * 0.2;
  float veil = smoothstep(0.42, 0.85, n), core = smoothstep(0.62, 0.95, vn3(q * 3.4 + 11.0) * 0.7 + n * 0.3);
  vec3 c = mix(uNetherFog * 0.65, uNetherFog * 1.15, smoothstep(-0.8, 0.9, d.y));
  c += vec3(0.1, 0.035, 0.16) * veil * veil + vec3(0.02, 0.07, 0.08) * core;
  for (int k = 0; k < 2; k++) {
    float sc = k == 0 ? 180.0 : 330.0;
    vec3 g = floor(d * sc); float h = hash(g + float(k) * 41.0);
    if (h > (k == 0 ? 0.992 : 0.985)) {
      float s = smoothstep(1.4 / sc, 0.0, length(d - normalize((g + 0.5) / sc)));
      vec3 tint = mix(vec3(0.85, 0.75, 1.0), vec3(0.65, 0.95, 0.95), fract(h * 57.0));
      c += tint * s * (k == 0 ? 1.1 : 0.55) * (0.7 + 0.3 * sin(uTime * (1.0 + h * 2.0) + h * 80.0));
    }
  }
  return c;
}
void main() {
  vec4 a = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(a.xyz / a.w);
  if (uEnd > 0.5) { o = vec4(endSky(d), 1.0); return; }
  if (uNether > 0.5) { o = vec4(uNetherFog, 1.0); return; }
  vec3 c = skyCol(d);
  if (uStars > 0.01 && d.y > -0.05) {
    vec3 g = floor(d * 210.0);
    float h = hash(g);
    if (h > 0.9955) {
      vec3 cc = (g + 0.5) / 210.0; float s = smoothstep(0.0045, 0.0, length(d - normalize(cc)));
      vec3 tint = mix(vec3(1.0, 0.85, 0.7), vec3(0.85, 0.92, 1.0), fract(h * 91.0));
      c += tint * s * uStars * (0.55 + 0.45 * sin(uTime * (2.0 + h * 3.0) + h * 100.0)) * (1.0 - uRain) * smoothstep(-0.05, 0.25, d.y) * 1.3;
    }
  }
  // sun: round disc with limb darkening and a soft corona
  float ds = dot(d, uSunDir);
  if (ds > 0.9) {
    float r = sqrt(max(0.0, 2.0 - 2.0 * ds)) / uSunSize;
    float disc = smoothstep(1.0, 0.92, r);
    vec3 sc = vec3(1.0, 0.95, 0.82) * (1.0 - 0.35 * r * r) * 7.0;
    c = mix(c, sc, disc * (1.0 - uRain * 0.92));
    c += vec3(1.0, 0.75, 0.45) * exp(-r * 1.6) * 0.45 * (1.0 - uRain);
  }
  vec3 mo = uMoonDir; vec3 m1 = normalize(cross(mo, abs(mo.y) > 0.99 ? vec3(1,0,0) : vec3(0,1,0))); vec3 m2 = cross(m1, mo);
  float dm = dot(d, mo);
  if (dm > 0.0) {
    vec2 q = vec2(dot(d, m1), dot(d, m2)) / dm;
    float m = length(q);
    float ma = smoothstep(0.048, 0.044, m);
    float phase = smoothstep(-0.02, 0.02, q.x - (uMoonPhase * 2.0 - 1.0) * 0.048 * 2.0);
    float crater = 0.82 + 0.18 * step(0.55, hash(floor(vec3(q * 70.0, 1.0))));
    c = mix(c, vec3(0.92, 0.93, 1.0) * crater * (0.2 + 0.8 * phase) * 1.8, ma * (1.0 - uRain * 0.9));
    c += vec3(0.5, 0.58, 0.75) * exp(-m * 12.0) * 0.14 * uNight * (1.0 - uRain);
  }
  o = vec4(c, 1.0);
}`;
// procedural cloud deck: full-screen pass after the sky, depth-tested against terrain via gl_FragDepth
const SCLOUD_FS = GLSL_COMMON + SKY_FN + NOISE_FN + `
uniform mat4 uInvVP, uVP;
uniform float uCloudCover, uCloudY, uCloudThick, uFarC;
uniform vec3 uCloudLit, uCloudDark;
uniform vec2 uCloudOff;
in vec2 vUv;
out vec4 o;
float cfbm(vec2 p) { float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = m * p; a *= 0.5; } return s; }
float cfbm3(vec2 p) { float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = m * p; a *= 0.5; } return s / 0.875; }
float dens(vec2 p, float h) {
  float n = cfbm(p * 0.0062);
  float cov = mix(0.66, 0.3, uCloudCover);
  float shape = 1.0 - abs(h - 0.35) * 1.4;
  return smoothstep(cov, cov + 0.13, n * (0.8 + 0.2 * shape) + 0.06 * shape);
}
void main() {
  vec4 a = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(a.xyz / a.w);
  float y0 = uCloudY, y1 = uCloudY + uCloudThick;
  float t0, t1;
  if (y0 > 0.0) { if (d.y < 0.01) discard; t0 = y0 / d.y; t1 = y1 / d.y; }
  else if (y1 < 0.0) { if (d.y > -0.01) discard; t0 = y1 / d.y; t1 = y0 / d.y; }
  else { t0 = 0.0; t1 = (d.y > 0.0 ? y1 : y0) / (abs(d.y) < 0.02 ? (d.y < 0.0 ? -0.02 : 0.02) : d.y); }
  t1 = min(t1, t0 + 260.0);
  if (t0 > 12000.0) discard;
  vec4 acc = vec4(0.0);
  float tHit = -1.0;
  const int N = 5;
  for (int k = 0; k < N; k++) {
    float f = (float(k) + 0.5) / float(N);
    float t = mix(t0, t1, f);
    vec3 pp = d * t;
    float h = clamp((pp.y - y0) / uCloudThick, 0.0, 1.0);
    vec2 q = uCloudOff + pp.xz;
    float den = dens(q, h);
    if (den > 0.01) {
      if (tHit < 0.0) tHit = t;
      float ls = cfbm3((q + uSunDir.xz * 30.0) * 0.0062);
      float lit = clamp(1.15 - ls * 1.35 + h * 0.45, 0.15, 1.0);
      vec3 col = mix(uCloudDark, uCloudLit, lit);
      float al = den * 0.62;
      acc.rgb += (1.0 - acc.a) * al * col; acc.a += (1.0 - acc.a) * al;
      if (acc.a > 0.97) break;
    }
  }
  if (acc.a < 0.004) discard;
  vec3 col = acc.rgb / acc.a;
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunGlow * pow(sd, 10.0) * (1.0 - acc.a) * 2.5;
  float fade = 1.0 - smoothstep(2500.0, 11000.0, tHit);
  col = mix(skyCol(d), col, 0.35 + 0.65 * fade);
#ifdef FRAG_DEPTH
  // camera at or above the cloud deck: clouds can hide terrain, so they need a real depth
  vec4 cp = uVP * vec4(d * min(tHit, uFarC * 0.98), 1.0);
  gl_FragDepth = tHit > uFarC * 0.98 ? 0.99999 : clamp(cp.z / cp.w * 0.5 + 0.5, 0.0, 0.99999);
#endif
  o = vec4(col, acc.a * fade);
}`;
// -------------------------------------------------------------------- clouds (blocky)
const CLOUD_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in float aShade;
uniform mat4 uProj; uniform vec3 uOffset;
out vec3 vPos; out float vShade;
void main() { vec3 p = aPos + uOffset; vPos = p; vShade = aShade; gl_Position = uProj * vec4(p, 1.0); }`;
const CLOUD_FS = GLSL_COMMON + SKY_FN + `
uniform vec3 uCloudColor, uFogColor; uniform float uFar, uAlpha;
in vec3 vPos; in float vShade;
out vec4 o;
void main() {
  float d = length(vPos.xz);
  float f = smoothstep(uFar * 0.55, uFar, d);
  vec3 c = uCloudColor * vShade;
  c = mix(c, skyCol(normalize(vPos)), f * 0.8);
  o = vec4(c, uAlpha * (1.0 - f));
}`;
// -------------------------------------------------------------------- entities (box models)
const ENT_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in float aPart;
layout(location=3) in vec3 aNormal;
uniform mat4 uProj, uModel; uniform mat4 uParts[24];
out vec2 vUV; out vec3 vN; out vec3 vPos;
void main() {
  mat4 m = uModel * uParts[int(aPart + 0.5)];
  vec4 wp = m * vec4(aPos, 1.0);
  vPos = wp.xyz; vUV = aUV; vN = normalize(mat3(m) * aNormal);
  gl_Position = uProj * wp;
}`;
const ENT_FS = GLSL_COMMON + SKY_FN + `
uniform sampler2DArray uSkin;
uniform float uLayer, uHurt, uFlash, uAlphaMul;
uniform vec3 uTintE;
uniform vec2 uLightE;
in vec2 vUV; in vec3 vN; in vec3 vPos;
out vec4 o;
` + LIGHT_FN.replace('in vec4 vShadowPos;', 'vec4 vShadowPos;') + `
void main() {
  vec4 t = texture(uSkin, vec3(vUV, uLayer));
  if (t.a < 0.5) discard;
  vec3 alb = t.rgb * uTintE;
  float shade = 0.7 + 0.3 * max(dot(vN, normalize(vec3(0.3, 1.0, 0.5))), 0.0) + 0.1 * vN.y;
  vec3 L = computeLightP(uLightE.x, uLightE.y, 1.0, clamp(shade, 0.5, 1.0), vN, 7, vPos);
  vec3 c = alb * L;
  c = mix(c, vec3(1.0, 0.1, 0.1), uHurt * 0.55);
  c = mix(c, vec3(1.0), uFlash);
  c = applyFog(c, vPos);
  o = vec4(c, uAlphaMul);
}`;
// -------------------------------------------------------------------- items (held / dropped / block models)
const ITEM_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aUV;
layout(location=2) in vec3 aNormal;
layout(location=3) in vec3 aTint;
uniform mat4 uProj, uModel;
out vec3 vUV; out vec3 vN; out vec3 vPos; out vec3 vTintI;
void main() { vec4 wp = uModel * vec4(aPos, 1.0); vPos = wp.xyz; vUV = aUV; vN = normalize(mat3(uModel) * aNormal); vTintI = aTint; gl_Position = uProj * wp; }`;
const ITEM_FS = GLSL_COMMON + SKY_FN + `
uniform sampler2DArray uTexB, uTexI;
uniform float uSrc, uFlashI;
uniform vec2 uLightE;
uniform float uNoFog;
in vec3 vUV; in vec3 vN; in vec3 vPos; in vec3 vTintI;
out vec4 o;
` + LIGHT_FN.replace('in vec4 vShadowPos;', 'vec4 vShadowPos;') + `
void main() {
  vec4 t = uSrc > 0.5 ? texture(uTexI, vUV) : texture(uTexB, vUV);
  if (t.a < 0.5) discard;
  vec3 tint = vTintI;
  if (tint.r >= 2.0) tint = t.a < 0.75 ? tint - 2.0 : vec3(1.0);
  vec3 alb = t.rgb * tint;
  float shade = 0.62 + 0.38 * max(dot(vN, normalize(vec3(0.35, 1.0, 0.6))), 0.0);
  vec3 L = computeLightP(uLightE.x, uLightE.y, 1.0, shade, vN, 7, uNoFog > 0.5 ? vec3(1e5) : vPos);
  vec3 c = alb * L + alb * uFlashI;
  if (uNoFog < 0.5) c = applyFog(c, vPos);
  o = vec4(c, 1.0);
}`;
// -------------------------------------------------------------------- voxel models (vehicles)
const VOX_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec4 aColor;
uniform mat4 uProj, uModel;
out vec3 vPos; out vec3 vN; out vec4 vCol; out vec3 vLocal;
#ifdef SHADOWS
uniform mat4 uShadowMat;
out vec4 vShadowPos;
#endif
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vPos = wp.xyz; vN = normalize(mat3(uModel) * aNormal); vCol = aColor; vLocal = aPos;
#ifdef SHADOWS
  vShadowPos = uShadowMat * vec4(wp.xyz + vN * 0.06, 1.0);
#endif
  gl_Position = uProj * wp;
}`;
const VOX_FS = GLSL_COMMON + SKY_FN + `
uniform vec2 uLightE;
uniform float uGlow, uHurtV, uAlphaV, uPulse;
in vec3 vPos; in vec3 vN; in vec4 vCol; in vec3 vLocal;
out vec4 o;
` + LIGHT_FN + `
void main() {
  vec3 alb = vCol.rgb;
  float m = vCol.a;
  vec3 N = normalize(vN);
  vec3 c;
  if (m > 0.75) {
    // emissive: constant trims and lights, or engine parts driven by throttle
    c = m > 0.95 ? alb * (1.0 + 3.2 * uGlow) * (0.88 + 0.12 * sin(uPulse * 9.0 + vLocal.z * 0.8)) : alb * 1.7;
  } else {
    float shade = 0.72 + 0.28 * max(dot(N, normalize(vec3(0.3, 1.0, 0.5))), 0.0);
    vec3 L = computeLightP(uLightE.x, uLightE.y, 1.0, shade, N, N.y > 0.7 ? 2 : 7, vPos);
    c = alb * L;
    vec3 V = normalize(-vPos);
    float met = m > 0.45 ? 1.0 : m > 0.2 ? 0.45 : 0.12;
    float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N);
    c += skyCol(R) * curveL(uLightE.x) * fr * met * 0.9;
    vec3 H = normalize(uSunDir + V);
    c += uSunColor * pow(max(dot(N, H), 0.0), m > 0.45 ? 180.0 : 48.0) * met * 2.5 * gShadow;
    if (m > 0.45 && m < 0.55) c = alb * L * 0.45 + skyCol(R) * curveL(uLightE.x) * (0.12 + fr * 0.75) + uSunColor * pow(max(dot(N, H), 0.0), 300.0) * 4.0 * gShadow;
  }
  c = mix(c, vec3(1.0, 0.25, 0.1), uHurtV * 0.5);
  c = applyFog(c, vPos);
  o = vec4(c, uAlphaV);
}`;
// -------------------------------------------------------------------- jet cockpits (view model in cockpit space)
const COCKPIT_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aN;
layout(location=2) in vec4 aCol;
layout(location=3) in vec2 aUV;
uniform mat4 uVP, uPart;
uniform mat3 uBody;
uniform vec3 uEye;
out vec3 vP; out vec3 vN; out vec4 vCol; out vec2 vUV; out vec3 vW;
void main() {
  vec4 p = uPart * vec4(aPos, 1.0);
  vP = p.xyz; vN = mat3(uPart) * aN; vCol = aCol; vUV = aUV;
  vW = uBody * (p.xyz - uEye);
  gl_Position = uVP * vec4(vW, 1.0);
}`;
// Materials come in the vertex alpha as code + parameter / 16: 0 matte, 1 satin, 2 metal, 3 screen, 4 glow,
// 5 lamp (parameter = lamp index), 6 mirror, 7 canopy glass (second, blended pass)
const COCKPIT_FS = GLSL_COMMON + SKY_FN + NOISE_FN + `
uniform sampler2D uScreens;
uniform mat3 uBody;
uniform vec3 uEye, uSunC, uUpC, uSunCol, uSkyC, uGndC, uFlood, uTint, uSpillP, uSpillC;
uniform float uSunVis, uSkyB, uTime, uScreenB, uGlowB, uPass, uRain, uSpeed;
uniform vec4 uOcc, uCab;
uniform float uLamp[12];
uniform vec4 uDL[8], uDLC[8];
uniform int uDLN;
in vec3 vP; in vec3 vN; in vec4 vCol; in vec2 vUV; in vec3 vW;
out vec4 o;
vec3 dynLights(vec3 pos, vec3 N) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= uDLN) break;
    vec3 d = uDL[i].xyz - pos; float r = uDL[i].w, l2 = dot(d, d);
    if (l2 >= r * r) continue;
    float l = sqrt(l2), att = 1.0 - l / r; att *= att;
    acc += uDLC[i].rgb * (uDLC[i].a * att * (max(dot(N, d / max(l, 0.001)), 0.0) * 0.75 + 0.25));
  }
  return acc;
}
// sunlight reaching a point in the cabin: the ray toward the sun has to leave through the glazing.
// uOcc: sill height, cabin half-width, glare shield lip z, glare shield top; uCab: roof height (> 50 = bubble
// canopy), side window head, windscreen z, rear bulkhead z
float sunReach(vec3 P, vec3 L) {
  if (uCab.x > 50.0) {
    if (P.y > uOcc.x) return (P.z < uOcc.z && P.y < uOcc.w && L.z < 0.2) ? 0.0 : 1.0;
    if (L.y <= 0.0) return 0.0;
    vec3 Q = P + L * ((uOcc.x - P.y) / L.y);
    return (1.0 - smoothstep(uOcc.y - 0.03, uOcc.y + 0.01, abs(Q.x))) * smoothstep(uOcc.z - 0.02, uOcc.z + 0.04, Q.z);
  }
  float tx = L.x > 0.0 ? (uOcc.y - P.x) / L.x : L.x < 0.0 ? (-uOcc.y - P.x) / L.x : 1e9;
  float ty = L.y > 0.0 ? (uCab.x - P.y) / L.y : 1e9;
  float tz = L.z < 0.0 ? (uCab.z - P.z) / L.z : 1e9;
  float tb = L.z > 0.0 ? (uCab.w - P.z) / L.z : 1e9;
  float t = min(min(tx, ty), min(tz, tb));
  if (t > 1e8 || t == ty || t == tb) return 0.0;
  vec3 Q = P + L * t;
  if (t == tz) return smoothstep(uOcc.w - 0.01, uOcc.w + 0.02, Q.y) * step(Q.y, uCab.x);
  return smoothstep(uOcc.x - 0.01, uOcc.x + 0.02, Q.y) * (1.0 - smoothstep(uCab.y - 0.02, uCab.y + 0.01, Q.y));
}
void main() {
  float mat = floor(vCol.a + 0.01), prm = (vCol.a - mat) * 16.0;
  vec3 alb = vCol.rgb;
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uEye - vP);
  vec3 Rw = uBody * reflect(-V, N);
  float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  if (uPass > 0.5) {
    // canopy acrylic: faint tint, sky reflections at grazing angles, sunlight scattered by fine scratches and
    // dust around the sun, rain beads running aft (premultiplied alpha)
    vec3 Vd = -V;
    float sd = max(dot(Vd, uSunC), 0.0);
    float scr = pow(abs(sin(vUV.x * 1400.0 + sin(vUV.y * 57.0) * 4.0 + vnoise(vUV * vec2(30.0, 44.0)) * 7.0)), 70.0);
    float dust = step(0.9965, hash12(floor(vUV * vec2(1500.0, 1100.0))));
    vec3 glare = uSunCol * uSunVis * (pow(sd, 12.0) * 0.3 + pow(sd, 110.0) * 1.1) * (0.45 + scr * 0.7 + dust * 2.5);
    // the displays' glow ghosts in the lower windscreen (visible at night), and the acrylic reads a touch denser
    // toward the frames
    float ghost = smoothstep(-0.3, -0.72, vP.z) * smoothstep(0.04, -0.17, vP.y);
    float edge = smoothstep(0.8, 1.0, abs(vUV.x * 2.0 - 1.0));
    vec3 col = uTint * (0.05 + edge * 0.05) + skyCol(Rw) * uSkyB * fr * 0.55 + uSpillC * (0.012 + ghost * 0.22) + glare;
    float a = 0.05 + fr * 0.42 + edge * 0.06;
    if (uRain > 0.01) {
      // beads when slow, stretched into streaks running aft as the airspeed builds
      float fast = clamp(uSpeed / 40.0, 0.0, 1.0);
      vec2 q = vec2(vUV.x * 70.0, vUV.y * 48.0 * mix(1.0, 0.25, fast) - uTime * (0.3 + uSpeed * 0.08));
      vec2 id = floor(q), f = fract(q) - 0.5, off = vec2(hash12(id + 3.1), hash12(id + 7.7)) - 0.5;
      float r = length((f - off * 0.4) * vec2(1.0, mix(1.0, 0.2, fast)));
      float drop = step(1.0 - uRain * 0.45, hash12(id)) * (1.0 - smoothstep(0.05, 0.12, r));
      col += (skyCol(Rw) * uSkyB * 0.3 + uSunCol * uSunVis * 0.2) * drop;
      a += drop * 0.26;
    }
    o = vec4(col, clamp(a, 0.0, 0.85));
    return;
  }
  vec3 c;
  if (mat > 2.5 && mat < 3.5) {
    // instrument screen behind cover glass: sunlight on it washes the picture out a little
    float sv = max(dot(N, uSunC), 0.0) * sunReach(vP, uSunC) * uSunVis;
    c = texture(uScreens, vUV).rgb * uScreenB + uSunCol * sv * 0.1 + skyCol(Rw) * uSkyB * fr * 0.25;
  } else if (mat > 3.5 && mat < 4.5) {
    c = alb * uGlowB;
  } else if (mat > 4.5 && mat < 5.5) {
    // caution lamp: engraved legend (texture) lit from behind when on
    float lg = texture(uScreens, vUV).r, on = uLamp[int(prm + 0.5)];
    c = alb * (0.06 + lg * 0.22) + alb * on * (0.5 + lg * 2.4);
  } else {
    float ndl = max(dot(N, uSunC), 0.0);
    float sv = ndl > 0.0 ? sunReach(vP, uSunC) * uSunVis : 0.0;
    // deeper in the cockpit tub less sky reaches in
    float cav = mix(0.3, 1.0, smoothstep(uOcc.x - 0.34, uOcc.x + 0.08, vP.y));
    vec3 amb = mix(uGndC, uSkyC, dot(N, uUpC) * 0.5 + 0.5) * cav;
    vec3 sp = uSpillP - vP; float sd = length(sp);
    vec3 L = uSunCol * ndl * sv + amb + uFlood * (0.55 + 0.45 * max(N.y, 0.0)) + uSpillC * max(dot(N, sp / max(sd, 1e-3)), 0.0) / (1.0 + sd * sd * 16.0);
    if (uDLN > 0) L += dynLights(vW, uBody * N);
    float grain = mat < 0.5 ? 0.9 + 0.1 * vnoise(vP.xz * 95.0 + vP.y * 41.0) : 1.0;
    c = alb * grain * L;
    float shin = mat < 0.5 ? 10.0 : mat < 1.5 ? 36.0 : 120.0, ks = mat < 0.5 ? 0.05 : mat < 1.5 ? 0.25 : 0.7;
    c += uSunCol * pow(max(dot(N, normalize(uSunC + V)), 0.0), shin) * ks * sv * (shin + 8.0) / 40.0;
    float rk = mat < 0.5 ? 0.04 : mat < 1.5 ? 0.22 : 0.5;
    c += skyCol(Rw) * uSkyB * fr * rk * cav;
    if (mat > 5.5) c = alb * 0.15 + skyCol(Rw) * uSkyB * 0.85;
  }
  o = vec4(c, 1.0);
}`;
// -------------------------------------------------------------------- additive FX (plasma, exhaust, beams, flashes)
const FX_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aCol;
layout(location=2) in vec3 aUV;
uniform mat4 uProj;
out vec4 vCol; out vec3 vUV; out vec3 vPos;
void main() { vCol = aCol; vUV = aUV; vPos = aPos; gl_Position = uProj * vec4(aPos, 1.0); }`;
const FX_FS = GLSL_COMMON + `
uniform vec3 uFogColor; uniform vec2 uFog;
in vec4 vCol; in vec3 vUV; in vec3 vPos;
out vec4 o;
void main() {
  vec2 q = vUV.xy;
  float r2;
  if (vUV.z > 0.5) { float ax = max(abs(q.x) * vUV.z - (vUV.z - 1.0), 0.0); r2 = q.y * q.y + ax * ax; }
  else r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * 7.0), halo = exp(-r2 * 2.2) * 0.45;
  float d = length(vPos);
  float f = clamp((d - uFog.x) / max(uFog.y - uFog.x, 1.0), 0.0, 1.0);
  vec3 c = vCol.rgb * (core * 1.6 + halo) * vCol.a;
  c += vec3(1.0) * core * core * vCol.a * 0.6 * step(0.001, vCol.a);
  o = vec4(c * (1.0 - f * 0.85), 1.0);
}`;
// -------------------------------------------------------------------- particles (instanced billboards)
const PART_VS = GLSL_COMMON + `
layout(location=0) in vec4 aPosSize;
layout(location=1) in vec4 aUVRect;
layout(location=2) in vec4 aColor;
layout(location=3) in vec2 aLayerLight;
uniform mat4 uProj; uniform vec3 uRight, uUp;
out vec3 vUV; out vec4 vColor; out vec3 vPos; out float vLightP;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec3 p = aPosSize.xyz + (uRight * (c.x - 0.5) + uUp * (c.y - 0.5)) * aPosSize.w;
  vPos = p;
  vUV = vec3(mix(aUVRect.x, aUVRect.z, c.x), mix(aUVRect.w, aUVRect.y, c.y), aLayerLight.x);
  vColor = aColor; vLightP = aLayerLight.y;
  gl_Position = uProj * vec4(p, 1.0);
}`;
const PART_FS = GLSL_COMMON + SKY_FN + `
uniform sampler2DArray uTexP;
uniform vec3 uFogColor; uniform vec2 uFog; uniform float uFogDensity;
in vec3 vUV; in vec4 vColor; in vec3 vPos; in float vLightP;
out vec4 o;
void main() {
  vec4 t = texture(uTexP, vUV);
  if (t.a < 0.1) discard;
  vec3 c = t.rgb * vColor.rgb * vLightP;
  float d = length(vPos);
  float f = clamp((d - uFog.x) / max(uFog.y - uFog.x, 1.0), 0.0, 1.0);
  f = max(f, 1.0 - exp(-d * uFogDensity));
  o = vec4(mix(c, uFogColor, f), t.a * vColor.a);
}`;
// -------------------------------------------------------------------- lines
const LINE_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos;
uniform mat4 uProj; uniform vec3 uOffset;
void main() { gl_Position = uProj * vec4(aPos + uOffset, 1.0); gl_Position.z -= 0.0005 * gl_Position.w; }`;
const LINE_FS = GLSL_COMMON + `
uniform vec4 uColor; out vec4 o; void main() { o = uColor; }`;
// -------------------------------------------------------------------- break overlay
const CRACK_FS = GLSL_COMMON + `
uniform sampler2DArray uTex; uniform float uLayerC;
in vec3 vUV2; out vec4 o;
void main() { vec4 t = texture(uTex, vec3(vUV2.xy, uLayerC)); if (t.a < 0.1) discard; o = vec4(vec3(0.45), 1.0); }`;
const CRACK_VS = GLSL_COMMON + `
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV;
uniform mat4 uProj; uniform vec3 uOffset;
out vec3 vUV2;
void main() { vUV2 = vec3(aUV, 0.0); gl_Position = uProj * vec4(aPos + uOffset, 1.0); gl_Position.z -= 0.0008 * gl_Position.w; }`;
// -------------------------------------------------------------------- post
const COPY_FS = GLSL_COMMON + `
uniform sampler2D uSrc; in vec2 vUv; out vec4 o; void main() { o = texture(uSrc, vUv); }`;
const BRIGHT_FS = GLSL_COMMON + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh;
in vec2 vUv; out vec4 o;
void main() {
  vec3 c = texture(uSrc, vUv + uTexel * vec2(-1,-1)).rgb + texture(uSrc, vUv + uTexel * vec2(1,-1)).rgb + texture(uSrc, vUv + uTexel * vec2(-1,1)).rgb + texture(uSrc, vUv + uTexel * vec2(1,1)).rgb;
  c *= 0.25;
  c = min(c, vec3(40.0));
  float l = max(c.r, max(c.g, c.b));
  o = vec4(c * smoothstep(uThresh, uThresh + 0.6, l), 1.0);
}`;
const DOWN_FS = GLSL_COMMON + `
uniform sampler2D uSrc; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
void main() {
  vec3 s = texture(uSrc, vUv).rgb * 4.0;
  s += texture(uSrc, vUv - uTexel).rgb; s += texture(uSrc, vUv + uTexel).rgb;
  s += texture(uSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb; s += texture(uSrc, vUv - vec2(uTexel.x, -uTexel.y)).rgb;
  o = vec4(s / 8.0, 1.0);
}`;
const UP_FS = GLSL_COMMON + `
uniform sampler2D uSrc; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
void main() {
  vec3 s = texture(uSrc, vUv + vec2(-uTexel.x * 2.0, 0.0)).rgb;
  s += texture(uSrc, vUv + vec2(-uTexel.x, uTexel.y)).rgb * 2.0;
  s += texture(uSrc, vUv + vec2(0.0, uTexel.y * 2.0)).rgb;
  s += texture(uSrc, vUv + vec2(uTexel.x, uTexel.y)).rgb * 2.0;
  s += texture(uSrc, vUv + vec2(uTexel.x * 2.0, 0.0)).rgb;
  s += texture(uSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb * 2.0;
  s += texture(uSrc, vUv + vec2(0.0, -uTexel.y * 2.0)).rgb;
  s += texture(uSrc, vUv + vec2(-uTexel.x, -uTexel.y)).rgb * 2.0;
  o = vec4(s / 12.0, 1.0);
}`;
const GODRAY_FS = GLSL_COMMON + `
uniform sampler2D uSrc, uDepth; uniform vec2 uSunPos; uniform float uStrength;
in vec2 vUv; out vec4 o;
void main() {
  vec2 d = (vUv - uSunPos) / float(GR_SAMPLES) * 0.9;
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec2 uv = vUv - d * jit; float w = 1.0; vec3 acc = vec3(0.0);
  for (int i = 0; i < GR_SAMPLES; i++) {
    uv -= d;
    float dep = texture(uDepth, uv).r;
    if (dep > 0.99999) { vec3 c = texture(uSrc, uv).rgb; acc += max(min(c, vec3(8.0)) - 0.35, 0.0) * w; }
    w *= 0.965;
  }
  float fall = clamp(1.0 - length((vUv - uSunPos) * vec2(1.6, 1.0)) * 0.9, 0.0, 1.0);
  o = vec4(acc / float(GR_SAMPLES) * uStrength * fall * 3.0, 1.0);
}`;
const COMPOSITE_FS = GLSL_COMMON + `
uniform sampler2D uScene, uBloom, uRays;
uniform float uBloomAmt, uRaysAmt, uTonemap, uVignette, uUnderwater, uLava, uNausea, uHurtFx, uTime, uExposure, uSat, uUseBloom, uUseRays, uGammaOut, uBoost, uWarm, uGLoad, uRedout;
uniform vec3 uRayColor;
in vec2 vUv; out vec4 o;
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 uv = vUv;
  if (uUnderwater > 0.5) uv += vec2(sin(uv.y * 30.0 + uTime * 2.0), cos(uv.x * 25.0 + uTime * 1.7)) * 0.0022;
  if (uNausea > 0.0) { vec2 c = uv - 0.5; float a = uNausea * 0.25 * sin(uTime * 1.5 + length(c) * 6.0); uv = 0.5 + mat2(cos(a), -sin(a), sin(a), cos(a)) * c * (1.0 - uNausea * 0.08 * sin(uTime * 2.0)); }
  vec3 c;
  if (uBoost > 0.001) {
    // speed boost: radial chromatic smear toward the edges
    vec2 dc = (uv - 0.5) * uBoost * 0.012;
    c = vec3(texture(uScene, uv + dc).r, texture(uScene, uv).g, texture(uScene, uv - dc).b);
  } else c = texture(uScene, uv).rgb;
  if (uUseBloom > 0.5) c += texture(uBloom, uv).rgb * uBloomAmt;
  if (uUseRays > 0.5) c += texture(uRays, uv).rgb * uRaysAmt * uRayColor;
  c *= uExposure;
  if (uTonemap > 0.5) { c = aces(c * 1.05); c = pow(c, vec3(0.94)); } else c = clamp(c, 0.0, 1.0);
  // grade: gentle warm highlights, cooler shadows, soft S-curve
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c *= mix(vec3(0.97, 0.99, 1.03), vec3(1.035, 1.0, 0.955), smoothstep(0.15, 0.85, l) * uWarm + (1.0 - uWarm) * 0.5);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
  if (uUnderwater > 0.5) c = mix(c, c * vec3(0.55, 0.78, 0.95), 0.45);
  if (uLava > 0.5) c = mix(c, vec3(1.0, 0.35, 0.05), 0.75);
  if (uNausea > 0.0) c = mix(c, c * vec3(0.9, 0.6, 1.2), uNausea * 0.5);
  vec2 v = vUv - 0.5;
  c *= mix(1.0, 1.0 - dot(v, v) * 1.1, uVignette);
  c = mix(c, vec3(0.7, 0.0, 0.0), uHurtFx * smoothstep(0.1, 0.8, length(v) * 1.4) * 0.6);
  if (uGLoad > 0.001) {
    // pulling hard in the cockpit: the colour drains first, then the view closes in from the edges
    c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114)) * 0.9), clamp(uGLoad * 1.3, 0.0, 1.0));
    c *= 1.0 - smoothstep(0.7 - uGLoad * 0.48, 0.95 - uGLoad * 0.42, length(v * vec2(1.3, 1.0))) * clamp(uGLoad * 1.2, 0.0, 1.0);
  }
  if (uRedout > 0.001) c = mix(c, vec3(0.6, 0.03, 0.02) * (0.25 + dot(c, vec3(0.5, 0.35, 0.15))), uRedout * 0.75);
  c = pow(max(c, 0.0), vec3(uGammaOut));
  o = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
}`;
// Final pass to the screen: edge-only FXAA, contrast-adaptive sharpening and the upscale from the
// internal render resolution. FXAA only touches pixels on a depth discontinuity, so block textures
// and held items keep every pixel crisp (plain FXAA smeared them).
const FINAL_FS = GLSL_COMMON + `
uniform sampler2D uSrc, uDepth;
uniform vec2 uTexel;
uniform float uFxaa, uSharp, uNear, uFar;
in vec2 vUv; out vec4 o;
float linD(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 fxaa(vec2 uv, vec3 rgbM) {
  vec3 rgbNW = texture(uSrc, uv + vec2(-1.0, -1.0) * uTexel).rgb, rgbNE = texture(uSrc, uv + vec2(1.0, -1.0) * uTexel).rgb;
  vec3 rgbSW = texture(uSrc, uv + vec2(-1.0, 1.0) * uTexel).rgb, rgbSE = texture(uSrc, uv + vec2(1.0, 1.0) * uTexel).rgb;
  float lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE), lM = luma(rgbM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.0312, lMax * 0.125)) return rgbM;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
  vec3 a = 0.5 * (texture(uSrc, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(uSrc, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 b = a * 0.5 + 0.25 * (texture(uSrc, uv + dir * -0.5).rgb + texture(uSrc, uv + dir * 0.5).rgb);
  float lB = luma(b);
  return (lB < lMin || lB > lMax) ? a : b;
}
void main() {
  vec2 uv = vUv;
  vec3 c = texture(uSrc, uv).rgb;
  if (uFxaa > 0.5) {
    float d0 = linD(texture(uDepth, uv).r);
    float d1 = linD(texture(uDepth, uv + vec2(uTexel.x, 0.0)).r), d2 = linD(texture(uDepth, uv - vec2(uTexel.x, 0.0)).r);
    float d3 = linD(texture(uDepth, uv + vec2(0.0, uTexel.y)).r), d4 = linD(texture(uDepth, uv - vec2(0.0, uTexel.y)).r);
    float mn = min(d0, min(min(d1, d2), min(d3, d4))), mx = max(d0, max(max(d1, d2), max(d3, d4)));
    if (mx - mn > mn * 0.035 + 0.03) c = fxaa(uv, c);
  }
  if (uSharp > 0.001) {
    vec3 a = texture(uSrc, uv - vec2(0.0, uTexel.y)).rgb, b = texture(uSrc, uv - vec2(uTexel.x, 0.0)).rgb;
    vec3 d = texture(uSrc, uv + vec2(uTexel.x, 0.0)).rgb, e = texture(uSrc, uv + vec2(0.0, uTexel.y)).rgb;
    vec3 mn = min(c, min(min(a, b), min(d, e))), mx = max(c, max(max(a, b), max(d, e)));
    vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
    vec3 w = amp * (-1.0 / mix(8.0, 5.0, uSharp));
    c = clamp((c + (a + b + d + e) * w) / (1.0 + 4.0 * w), 0.0, 1.0);
  }
  o = vec4(c, 1.0);
}`;
