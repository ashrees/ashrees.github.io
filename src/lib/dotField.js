/* ============================================================================
 * dotField.js — a scroll-driven point cloud, in raw WebGL2.
 *
 * Reconstruction of the technique behind datacurve.ai's background. ~100k
 * points sample a grayscale depth map; brightness becomes height, a per-vertex
 * Sobel pass finds silhouettes, and scrolling morphs the field from one figure
 * to the next by routing every point along a turbulent path.
 *
 * No three.js, no Lenis, no dependencies at all.
 *
 * Nothing figure-specific lives here — see ./figures.js for anything visual.
 * ========================================================================== */

import { FIELD, FIGURES } from './figures';

/* ---------------------------------------------------------------- shaders */

const VERT = `#version 300 es
precision highp float;

in vec2  aXY;
in vec2  aUv;
in float aSeed;

uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform vec2  uTexelA;
uniform vec2  uTexelB;
uniform float uFlow;
uniform mat4  uProj;
uniform float uCamZ;
uniform vec2  uPlaneScale;
uniform float uMorph;
uniform float uIntro;
uniform float uOutro;
uniform float uTime;
uniform float uDepthStrength;
uniform float uPointScale;
uniform float uPixelRatio;
uniform float uLowQuality;
uniform float uReducedMotion;
uniform float uTransitionSeed;
uniform float uStrength;
uniform float uDark;
uniform vec3  uColFar;
uniform vec3  uColMid;
uniform vec3  uColNear;
uniform vec3  uColHaze;
uniform vec2  uOffset;
uniform vec2  uTilt;
uniform float uSwirl;
uniform float uCoreScale;
uniform float uAvoidFeather;
uniform vec4  uAvoidRect[4];
uniform float uAvoidStr[4];

out vec3  vColor;
out float vAlpha;

float luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float ease(float x){ return x * x * (3.0 - 2.0 * x); }
float hash11(float v){ return fract(sin(v * 127.1) * 43758.5453123); }
float hash21(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453123); }

float noise2(vec2 v){
  vec2 i = floor(v), f = fract(v);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm2(vec2 v){
  float sum = 0.0, amp = 0.5;
  mat2 turn = mat2(1.62, 1.18, -1.18, 1.62);
  for (int i = 0; i < 3; i++){
    sum += noise2(v) * amp;
    v = turn * v + vec2(7.13, 3.91);
    amp *= 0.5;
  }
  return sum;
}
vec2 fbmVec2(vec2 v){
  return vec2(fbm2(v), fbm2(v + vec2(19.17, 31.41))) * 2.0 - 1.0;
}

float height(vec3 rgb){
  float v = clamp((luma(rgb) - 0.02) * 1.08, 0.0, 1.0);
  return pow(v, 0.92);
}

// Sobel per VERTEX: 9 texture fetches per particle (5 on the low-quality
// path). Subtracting the local mean thins the response to the crest of the
// gradient, so silhouettes read as lines rather than thick bands.
float sobel(sampler2D tex, vec2 uv, vec2 px){
  float full = 1.0 - step(0.5, uLowQuality);
  float tc = height(texture(tex, clamp(uv + px * vec2( 0.0,-1.0), 0.0, 1.0)).rgb);
  float ml = height(texture(tex, clamp(uv + px * vec2(-1.0, 0.0), 0.0, 1.0)).rgb);
  float mc = height(texture(tex, uv).rgb);
  float mr = height(texture(tex, clamp(uv + px * vec2( 1.0, 0.0), 0.0, 1.0)).rgb);
  float bc = height(texture(tex, clamp(uv + px * vec2( 0.0, 1.0), 0.0, 1.0)).rgb);
  float tl = full * height(texture(tex, clamp(uv + px * vec2(-1.0,-1.0), 0.0, 1.0)).rgb);
  float tr = full * height(texture(tex, clamp(uv + px * vec2( 1.0,-1.0), 0.0, 1.0)).rgb);
  float bl = full * height(texture(tex, clamp(uv + px * vec2(-1.0, 1.0), 0.0, 1.0)).rgb);
  float br = full * height(texture(tex, clamp(uv + px * vec2( 1.0, 1.0), 0.0, 1.0)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  float grad = sqrt(gx * gx + gy * gy) * mix(1.0, 1.4, step(0.5, uLowQuality));
  float lap  = abs(4.0 * mc - ml - mr - tc - bc);
  return smoothstep(0.05, 0.55, pow(grad * (0.85 + 0.7 * lap), 0.55));
}

float rectInfluence(vec2 p, vec4 r, float strength){
  if (strength <= 0.001) return 0.0;
  vec2 closest = clamp(p, r.xy, r.zw);
  float dist = length(p - closest);
  float inside = step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w);
  return max(inside, 1.0 - smoothstep(0.0, uAvoidFeather, dist)) * strength;
}

void main(){
  float morphRaw = clamp(uMorph, 0.0, 1.0);
  float morph    = ease(morphRaw);
  float intro    = ease(clamp(uIntro, 0.0, 1.0));
  // uFlow is 0 while stepping between frames of a single clip: those are
  // straight cross-fades and must NOT trigger the swarm choreography that a
  // change of scene gets, or the footage boils instead of playing.
  float transition = sin(morphRaw * 3.14159265) * uFlow;

  float value = mix(height(texture(uTexA, aUv).rgb), height(texture(uTexB, aUv).rgb), morph);

  float edgeA = morphRaw < 0.99 ? sobel(uTexA, aUv, uTexelA) : 0.0;
  float edgeB = morphRaw > 0.01 ? sobel(uTexB, aUv, uTexelB) : 0.0;
  float relief = mix(edgeA, edgeB, morph);
  // An edge inside a region of zero height is not a silhouette, it is noise.
  // The Sobel's pow(crest, 0.55) gamma exists to lift SUBTLE depth gradients
  // into view, which means on a compressed photographic depth map it lifts the
  // compression artefacts in the empty background just as eagerly — relief
  // pinned near 1 everywhere, and the real image drowned in even static.
  relief *= smoothstep(0.04, 0.16, value);

  float clarity  = smoothstep(0.035, 0.92, value);
  float presence = max(smoothstep(0.07, 0.24, value), relief * 1.2);
  float crest    = smoothstep(0.50, 0.96, value);
  float valley   = 1.0 - smoothstep(0.08, 0.48, value);

  float randA = hash11(aSeed + aUv.x * 17.23 + aUv.y * 41.91);
  float randB = hash11(aSeed * 13.37 + aUv.x * 73.11 - aUv.y * 19.74);
  float randC = hash11(aSeed * 31.70 + aUv.x *  5.37 + aUv.y * 97.03);

  // --- the opening -------------------------------------------------------
  // Everything starts collapsed into one speck at the centre and unfurls.
  // Points leave along a direction that blends their own random heading, the
  // straight-out radial, and a TANGENTIAL component — that tangential share is
  // what makes the opening read as a coil unwinding rather than an explosion.
  // Inner points leave first (birthStart scales with radius), so the figure
  // grows outward from the middle instead of appearing all at once.
  float radial     = length(aXY * vec2(1.0, 1.14));
  float radialNorm = clamp(radial / 0.78, 0.0, 1.0);

  // A tiny fraction of points stay behind as the bright condensed core you see
  // at t=0; it fades out once the field is properly on its way.
  // Because the opening waits for scroll, this seed is what a visitor sees
  // before they touch anything — it has to read as a deliberate coiled object,
  // not as a page that failed to load.
  // A wisp of points leads the unfurl. Kept small: at rest the field is fully
  // invisible (see the wake gate below), so this only has to carry the first
  // instant of the opening, not stand alone as something to look at.
  float coreSeed    = 1.0 - step(0.015, aSeed);
  float coreVisible = coreSeed * (1.0 - smoothstep(0.05, 0.34, intro));

  float birthStart = radialNorm * 0.28 + randA * 0.36;
  float birth      = smoothstep(birthStart, birthStart + 0.18 + randB * 0.08, intro);
  float birthEase  = ease(birth);

  float angle = randA * 6.2831853;
  vec2 seedDir    = vec2(cos(angle), sin(angle));
  vec2 radialDir  = aXY / max(radial, 1e-4);
  vec2 tangentDir = vec2(-radialDir.y, radialDir.x) * mix(-1.0, 1.0, step(0.5, randC));
  vec2 swirlDir   = normalize(seedDir * 0.92 + radialDir * 0.42
                            + tangentDir * (randB - 0.5) * 0.96 * uSwirl + vec2(1e-4));

  // arc peaks mid-flight and returns to zero, so points bow outward on the way
  // and still land exactly on their target pixel
  float splitPhase = sin(birthEase * 3.14159265);
  float arc    = splitPhase * (0.072 + randB * 0.15) * (1.0 - radialNorm * 0.16);
  float drift  = sin((birthEase * 2.6 + randC * 1.8) * 3.14159265) * (0.025 + randA * 0.056);
  float tumble = sin(uTime * 1.2 + randC * 18.0) * splitPhase * (1.0 - birthEase) * 0.018;

  // start from a small disc rather than a mathematical point, so the resting
  // state has a visible size and the unfurl has something to uncoil from
  vec2 pos = mix(seedDir * (0.004 + randB * 0.030), aXY, birthEase);
  pos += swirlDir   * arc * uSwirl * (1.0 - intro * 0.28);
  pos += tangentDir * drift * uSwirl * birth * (1.0 - birthEase * 0.82);
  pos += seedDir    * tumble;

  float depth = (value - 0.5) * uDepthStrength;
  depth += crest * 0.08 - valley * 0.026;
  depth += relief * 0.075;
  depth += (1.0 - radial) * 0.045;
  depth += (randB - 0.5) * 0.02 * smoothstep(0.08, 0.92, value);
  depth *= birthEase;
  pos += vec2(0.022, -0.009) * depth;

  if (morphRaw > 0.001 && uReducedMotion < 0.5 && uFlow > 0.5) {
    float rA = hash11(uTransitionSeed * 11.13 + 1.0);
    float rB = hash11(uTransitionSeed * 17.31 + 4.0);
    float rC = hash11(uTransitionSeed * 23.71 + 9.0);

    float rot = (rC - 0.5) * 0.9;
    vec2  axis = normalize(vec2(cos(rot), sin(rot)) * mix(-1.0, 1.0, step(0.5, rA)));
    vec2  side = vec2(-axis.y, axis.x) * mix(-1.0, 1.0, step(0.5, rB));

    float leaveOrder = clamp(fbm2(aXY * 5.2 + vec2(rA * 8.0, rB * 5.0)) * 0.55
                           + hash11(aSeed * 149.0) * 0.35 + radialNorm * 0.10, 0.0, 1.0);
    float landOrder  = clamp(fbm2(aXY * 6.4 + vec2(rC * 6.0, rA * 4.0)) * 0.55
                           + hash11(aSeed * 173.0) * 0.35, 0.0, 1.0);

    float depart = smoothstep(leaveOrder * 0.46, leaveOrder * 0.46 + 0.30, morphRaw);
    float arrive = smoothstep(0.35 + landOrder * 0.33, 0.35 + landOrder * 0.33 + 0.34, morphRaw);
    float pack   = depart * (1.0 - arrive * 0.85);

    float phase = clamp(smoothstep(leaveOrder * 0.46, 0.62 + landOrder * 0.28, morphRaw)
                        + (randC - 0.5) * 0.08, 0.0, 1.0);
    float lane = mix(0.12, 0.22, rC), turn = mix(0.16, 0.27, rB);
    vec2 local, tangent;
    if (phase < 0.37) {
      local = vec2(mix(-0.5, 0.16, phase / 0.37), -lane);
      tangent = vec2(1.0, 0.0);
    } else if (phase < 0.69) {
      float a = -1.5707963 + ((phase - 0.37) / 0.32) * 3.14159265;
      local = vec2(0.16 + cos(a) * turn, sin(a) * lane);
      tangent = normalize(vec2(-sin(a) * turn, cos(a) * lane));
    } else {
      local = vec2(mix(0.16, -0.5, (phase - 0.69) / 0.31), lane);
      tangent = vec2(-1.0, 0.0);
    }
    vec2 route   = axis * local.x + side * local.y;
    vec2 routeT  = normalize(axis * tangent.x + side * tangent.y);
    vec2 normalT = vec2(-routeT.y, routeT.x);

    float body = smoothstep(0.05, 0.34, phase) * (1.0 - smoothstep(0.72, 1.0, phase));
    route += fbmVec2(aXY * 5.4 + vec2(rA * 6.0 + phase * 4.0, rB * 8.0 - uTime * 0.04))
             * body * (0.10 + rC * 0.13);
    route += fbmVec2(aXY * 15.0 - route * 4.0 + vec2(rC * 7.0 - uTime * 0.095, rA * 5.0))
             * body * 0.05;

    float strand = floor(hash11(aSeed * 97.13 + rA * 11.0) * 7.0);
    float swarm  = smoothstep(0.08, 0.58, morphRaw) * (1.0 - smoothstep(0.76, 1.0, morphRaw));
    route += normalT * ((strand - 3.0) / 3.0) * mix(0.003, 0.026, swarm);
    route += normalT * (randB - 0.5) * mix(0.006, 0.030, swarm);
    route += routeT  * (randC - 0.5) * mix(0.24, 0.52, swarm);

    float gas = transition * smoothstep(0.02, 0.58, pack) * (1.0 - smoothstep(0.62, 1.0, arrive));
    vec2 gasField = fbmVec2(aXY * 8.0 + route * 3.7 + vec2(uTime * 0.055 + rA * 6.0, rB * 8.0));
    route += normalize(gasField + vec2(randA - 0.5, randB - 0.5) + vec2(1e-4))
             * (0.09 + randC * 0.34) * gas;
    route += gasField * 0.03 * gas;

    // the pull must reach exactly zero by morph=1 or the figure lands off-plane
    float pull = pow(pack, 0.4) * 0.82 * (1.0 - smoothstep(0.72, 1.0, morphRaw));
    pos = mix(pos, pos + (route - pos) * 0.94, clamp(pull, 0.0, 0.97));
    depth = mix(depth, depth * 0.35 + (randB - 0.5) * 0.12, gas);
  }

  // --- the closing -------------------------------------------------------
  // The mirror of the opening. As the footer comes up the field spirals back
  // into the centre and shrinks to nothing, so the page ends on clean paper
  // rather than on a figure that just stops being scrolled past.
  //
  // The order is deliberately REVERSED: the unfurl releases inner points
  // first, this draws OUTER points in first, which reads as the field being
  // gathered up rather than fading out.
  float outro   = clamp(uOutro, 0.0, 1.0);
  float goStart = (1.0 - radialNorm) * 0.30 + randB * 0.20;
  float gone    = ease(smoothstep(goStart, goStart + 0.44, outro));
  pos   = mix(pos, seedDir * (0.004 + randB * 0.030), gone);
  pos  += tangentDir * sin(gone * 3.14159265) * 0.055 * uSwirl;
  depth *= 1.0 - gone;

  // local = position within the figure's own plane; xy = where that lands on
  // screen once the field is nudged off the text column.
  vec2 local = pos * uPlaneScale;
  vec2 xy = local + uOffset;

  // Tilt the whole cloud toward the pointer. The points carry real depth, so
  // rotating them produces true parallax — near points sweep further than far
  // ones — which reads as a camera easing around the figure. Rotating the
  // cloud rather than the camera keeps the projection matrix constant.
  vec3 p = vec3(xy, depth);
  float cx = cos(uTilt.x), sx = sin(uTilt.x);
  float cy = cos(uTilt.y), sy = sin(uTilt.y);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);

  gl_Position = uProj * vec4(p.xy, p.z - uCamZ, 1.0);

  vec2 ndc = gl_Position.xy / max(gl_Position.w, 1e-4);
  vec2 screen = vec2(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  float avoid = 0.0;
  avoid = max(avoid, rectInfluence(screen, uAvoidRect[0], uAvoidStr[0]));
  avoid = max(avoid, rectInfluence(screen, uAvoidRect[1], uAvoidStr[1]));
  avoid = max(avoid, rectInfluence(screen, uAvoidRect[2], uAvoidStr[2]));
  avoid = max(avoid, rectInfluence(screen, uAvoidRect[3], uAvoidStr[3]));
  // The original lets the swarm sweep across type mid-transition, which works
  // for giant display copy. Over body text it just makes it unreadable, so the
  // clearing is only slightly relaxed during a crossing.
  //
  // The opening is exempt: the condensed core forms dead centre, which is
  // exactly where the hero's clearing sits, so gating on intro is the
  // difference between seeing the unfurl and seeing nothing. The copy is still
  // fading in over the same window, so nothing is obscured that anyone is
  // reading yet.
  avoid = clamp(avoid, 0.0, 1.0) * (1.0 - transition * 0.25)
        * smoothstep(0.2, 0.9, intro);

  float sparseKeep = smoothstep(0.22 + avoid * 0.56, 1.0, hash11(aSeed * 109.7 + 17.0));
  float quietAlpha = mix(1.0, 0.18 + sparseKeep * 0.34, avoid);
  float quietSize  = mix(1.0, 0.70 + sparseKeep * 0.12, avoid);

  // measured on local, so the edge fade follows the figure, not the screen
  vec2 half_ = max(uPlaneScale * 0.5, vec2(1e-4));
  float edge = max(abs(local.x) / half_.x, abs(local.y) / half_.y);
  float fieldFade = 1.0 - smoothstep(0.82, 1.05, edge);

  float camZ = max(0.72, uCamZ - p.z);
  float persp = 1.98 / camZ;
  float near  = smoothstep(3.08, 1.96, camZ);
  float jitter = mix(0.58, 1.18, hash11(aSeed * 17.31 + 5.0));
  float sparkle = step(0.982, hash11(aSeed * 73.0 + 11.0)) * smoothstep(0.66, 0.98, value);

  // the core seed is drawn much larger, so at t=0 the field reads as one
  // dense speck rather than a scatter of individual dots
  gl_PointSize = uPointScale * uPixelRatio * persp *
    ((0.34 + clarity * 0.88 + near * 0.12 + relief * 0.24 + transition * 0.26)
      * mix(0.5, 1.0, birthEase) + coreVisible * uCoreScale) *
    quietSize * jitter * mix(0.34, 1.0, presence) * (1.0 + sparkle * 0.62)
    * (1.0 - gone);

  // The ramp comes in as uniforms rather than constants, so the palette lives
  // in FIELD.tint where it can be tuned without touching a shader. Distant
  // points sit near the far colour, close ones reach the near colour, and
  // everything hazes toward the page colour with distance.
  vec3 far   = uColFar;
  vec3 mid   = uColMid;
  vec3 nearC = uColNear;
  vec3 haze  = uColHaze;

  vec3 col = mix(far, mid, smoothstep(0.05, 0.54, value));
  col = mix(col, nearC, smoothstep(0.44, 0.94, value) * 0.86);
  col = mix(col, nearC, relief * 0.34);
  col = mix(col, haze, (1.0 - near) * 0.12);

  vColor = col;
  float alpha = presence * (0.20 + clarity * 0.92 + relief * 0.62)
              * smoothstep(birthStart, birthStart + 0.12, intro);
  // Nothing is drawn until the visitor scrolls. Every point fades up from zero
  // rather than the seed sitting on the landing page as a stray dark speck.
  // This gates the WHOLE alpha, core included, so at intro = 0 the fragment
  // shader's discard drops every point and the canvas is genuinely empty.
  float wake = smoothstep(0.0, 0.09, intro);

  vAlpha = (max(alpha, coreVisible * 0.32) * quietAlpha * fieldFade
             * mix(0.62, 1.06, near) * (1.0 + transition * 0.45)
           + sparkle * 0.35 * birthEase * fieldFade) * uStrength * wake
           * (1.0 - gone);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3  vColor;
in float vAlpha;
out vec4 fragColor;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c);
  float a = (exp(-r2 * 26.0) + exp(-r2 * 7.5) * 0.34) * vAlpha;
  if (a < 0.007) discard;
  fragColor = vec4(vColor, min(a, 1.0));
}`;

/* ------------------------------------------------- depth map construction */

function distanceTransform(mask, S) {
  const INF = 1e9, d = new Float32Array(S * S), D2 = 1.41421356;
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? INF : 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x; if (d[i] === 0) continue;
    let m = d[i];
    if (x > 0) m = Math.min(m, d[i - 1] + 1);
    if (y > 0) m = Math.min(m, d[i - S] + 1);
    if (x > 0 && y > 0) m = Math.min(m, d[i - S - 1] + D2);
    if (x < S - 1 && y > 0) m = Math.min(m, d[i - S + 1] + D2);
    d[i] = m;
  }
  for (let y = S - 1; y >= 0; y--) for (let x = S - 1; x >= 0; x--) {
    const i = y * S + x; if (d[i] === 0) continue;
    let m = d[i];
    if (x < S - 1) m = Math.min(m, d[i + 1] + 1);
    if (y < S - 1) m = Math.min(m, d[i + S] + 1);
    if (x < S - 1 && y < S - 1) m = Math.min(m, d[i + S + 1] + D2);
    if (x > 0 && y < S - 1) m = Math.min(m, d[i + S - 1] + D2);
    d[i] = m;
  }
  return d;
}

function boxBlur(src, S, r) {
  const tmp = new Float32Array(S * S), out = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= S) continue; s += src[y * S + xx]; n++; }
    tmp[y * S + x] = s / n;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= S) continue; s += tmp[yy * S + x]; n++; }
    out[y * S + x] = s / n;
  }
  return out;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`dotField: could not load ${src}`));
    img.src = src;
  });
}

/**
 * Turn one figure definition into an RGBA depth map.
 * `image` figures are used as-is (they are already grayscale depth); `draw`
 * and `text` figures are silhouettes, rounded into relief by the distance
 * transform.
 */
/**
 * A clip figure: one sprite sheet of depth frames, sliced into a list of
 * {data, w, h}. Scrolling through the scene steps along them, so the footage
 * plays under your thumb instead of on a timer.
 */
async function buildClipFrames(figure, stride = 1) {
  const img = await loadImage(figure.clip);
  const cols = figure.cols || 4;
  const count = figure.frames || 1;
  const fw = Math.round(img.width / cols);
  const fh = Math.round(img.height / Math.ceil(count / cols));

  const c = document.createElement('canvas');
  c.width = fw; c.height = fh;
  const g = c.getContext('2d', { willReadFrequently: true });

  const out = [];
  // `stride` drops frames on small devices: with six scenes on screen the
  // texture memory adds up, and half the frames still reads as motion.
  for (let i = 0; i < count; i += stride) {
    g.clearRect(0, 0, fw, fh);
    g.drawImage(img, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, 0, 0, fw, fh);
    const px = g.getImageData(0, 0, fw, fh).data;
    const data = new Uint8Array(fw * fh * 4);
    for (let k = 0; k < fw * fh; k++) {
      const v = px[k * 4];              // already grayscale
      data[k * 4] = data[k * 4 + 1] = data[k * 4 + 2] = v;
      data[k * 4 + 3] = 255;
    }
    out.push({ data, w: fw, h: fh });
  }
  return out;
}

async function buildDepthMap(figure) {
  const S = FIELD.mapSize;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);

  if (figure.src) {
    const img = await loadImage(figure.src);
    const scale = Math.min(S / img.width, S / img.height) * (figure.fit ?? 0.86);
    const w = img.width * scale, h = img.height * scale;
    g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
    const px = g.getImageData(0, 0, S, S).data;
    const out = new Uint8Array(S * S * 4);
    for (let i = 0; i < S * S; i++) {
      const v = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) | 0;
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
      out[i * 4 + 3] = 255;
    }
    return { data: out, w: S, h: S };
  }

  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.save();
  g.scale(S, S);
  if (figure.text) {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${figure.weight ?? 700} ${figure.size ?? 0.52}px ${FIELD.font}`;
    g.fillText(figure.text, 0.5, 0.52);
  } else {
    figure.draw(g);
  }
  g.restore();

  const px = g.getImageData(0, 0, S, S).data;
  const mask = new Uint8Array(S * S);
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 127 ? 1 : 0;

  const dist = distanceTransform(mask, S);
  const h = new Float32Array(S * S);
  const R = figure.relief ?? FIELD.relief;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    if (!mask[i]) { h[i] = 0; continue; }
    const t = Math.min(dist[i] / R, 1);
    let v = Math.sqrt(1 - (1 - t) * (1 - t));
    const ny = 0.5 - y / S;
    if (figure.detail) v *= figure.detail(x / S - 0.5, ny);
    v = 0.30 + v * 0.70;
    v *= 1 - ny * 0.12;
    h[i] = v;
  }

  const soft = boxBlur(h, S, 1);
  const out = new Uint8Array(S * S * 4);
  for (let i = 0; i < soft.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(soft[i] * 255)));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return { data: out, w: S, h: S };
}

/** One figure -> a list of depth frames. Stills are just a list of one. */
async function buildScene(figure, stride = 1) {
  return figure.clip ? await buildClipFrames(figure, stride)
                     : [await buildDepthMap(figure)];
}

/* ------------------------------------------------------------------ engine */

const FOV = (38 * Math.PI) / 180;
const CAM_Z = 2.55;

function perspective(aspect) {
  const f = 1 / Math.tan(FOV / 2), near = 0.1, far = 10, nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ]);
}

export function isSupported() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export class DotField {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      alpha: true, antialias: false, premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!this.gl) throw new Error('dotField: WebGL2 unavailable');

    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.dark = document.documentElement.classList.contains('dark');
    // scroll position in px, damped — page progress AND the opening are both
    // derived from it, so one smoothed value drives everything
    this.rawY = 0;
    this.smoothY = 0;
    this.intro = 0;
    this.outro = 0;
    this.footerY = Infinity;
    // pointer tilt: target and current, damped toward each other
    this.tiltTo = [0, 0];
    this.tilt = [0, 0];
    this.pointer = !this.reduced
      && matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.lastPair = -1;
    this.running = false;
    this.dirty = true;
    this.destroyed = false;
    this.avoidTargets = [];
    this.avoidRects = new Float32Array(16);
    this.avoidStr = new Float32Array(4);

    this._frame = this._frame.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onPointer = this.onPointer.bind(this);
  }

  async init() {
    const gl = this.gl;
    const prog = this._link(VERT, FRAG);
    if (this.destroyed) return;
    this.prog = prog;
    gl.useProgram(prog);

    this.U = {};
    for (const n of ['uTexA', 'uTexB', 'uTexelA', 'uTexelB', 'uFlow',
      'uProj', 'uCamZ', 'uPlaneScale', 'uMorph',
      'uIntro', 'uOutro', 'uTime', 'uDepthStrength', 'uPointScale', 'uPixelRatio', 'uLowQuality',
      'uReducedMotion', 'uTransitionSeed', 'uStrength', 'uDark', 'uOffset',
      'uColFar', 'uColMid', 'uColNear', 'uColHaze',
      'uTilt', 'uSwirl', 'uCoreScale', 'uAvoidFeather', 'uAvoidRect[0]',
      'uAvoidStr[0]']) {
      this.U[n.replace('[0]', '')] = gl.getUniformLocation(prog, n);
    }

    this._buildGeometry();

    // Build ONLY the first scene before starting. Each still costs a 512x512
    // distance transform and each clip costs a sprite-sheet decode; doing them
    // all up front delayed the first frame by ~600ms, long enough that the
    // opening read as a pop rather than an unfurl. The rest stream in behind
    // the animation; _state() reads scenes.length each frame, so the sequence
    // grows as they land.
    const first = await buildScene(FIGURES[0], this.stride);
    if (this.destroyed) return;
    this.weights = [this._weights(first)];
    this.scenes = [first.map((f) => this._texture(f))];
    this.gains = [FIGURES[0].gain ?? 1];
    this.sampled = -1;

    gl.uniform1i(this.U.uTexA, 0);
    gl.uniform1i(this.U.uTexB, 1);
    gl.uniform1f(this.U.uDepthStrength, FIELD.depthStrength);
    gl.uniform1f(this.U.uReducedMotion, this.reduced ? 1 : 0);
    gl.uniform1f(this.U.uDark, this.dark ? 1 : 0);
    this._uploadTint();
    gl.uniform1f(this.U.uCamZ, CAM_Z);
    // reduced motion gets the figure without the unfurl
    gl.uniform1f(this.U.uSwirl, this.reduced ? 0 : FIELD.intro.swirl);
    gl.uniform1f(this.U.uCoreScale, this.reduced ? 0 : FIELD.intro.core);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    this.onResize();
    this.onScroll();
    addEventListener('scroll', this.onScroll, { passive: true });
    addEventListener('resize', this.onResize);
    if (this.pointer) addEventListener('pointermove', this.onPointer, { passive: true });
    this._kick();

    this._buildRest();
  }

  /** Build the remaining scenes without blocking the opening. */
  async _buildRest() {
    for (let i = 1; i < FIGURES.length; i++) {
      // yield so map construction never competes with an animating frame
      await new Promise((r) => setTimeout(r, 0));
      if (this.destroyed) return;
      let frames;
      try {
        frames = await buildScene(FIGURES[i], this.stride);
      } catch (err) {
        console.warn(err);
        continue;
      }
      if (this.destroyed) return;
      this.weights.push(this._weights(frames));
      this.scenes.push(frames.map((f) => this._texture(f)));
      this.gains.push(FIGURES[i].gain ?? 1);
      this.dirty = true;
      this._kick();
    }
  }

  _link(vs, fs) {
    const gl = this.gl;
    const make = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error('dotField shader: ' + gl.getShaderInfoLog(s));
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('dotField link: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  _buildGeometry() {
    const gl = this.gl;
    const w = innerWidth;
    const cores = navigator.hardwareConcurrency || 4;
    const tier = w < 640 || cores < 4 ? 'phone' : w < 1024 ? 'tablet' : 'desktop';
    this.count = FIELD.points[tier];
    this.tier = tier;
    this.stride = tier === 'phone' ? 2 : 1;

    const cols = Math.ceil(Math.sqrt(this.count));
    const xy = new Float32Array(this.count * 2);
    const uv = new Float32Array(this.count * 2);
    const sd = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      const u = ((i % cols) + Math.random()) / cols;
      const v = (((i / cols) | 0) + Math.random()) / cols;
      uv[i * 2] = u; uv[i * 2 + 1] = v;
      xy[i * 2] = u - 0.5; xy[i * 2 + 1] = 0.5 - v;
      sd[i] = Math.random();
    }
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buffers = [];
    const bind = (data, size, name) => {
      const b = gl.createBuffer();
      this.buffers.push(b);
      if (name === 'aXY') this.bufXY = b;
      if (name === 'aUv') this.bufUV = b;
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(this.prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind(xy, 2, 'aXY');
    bind(uv, 2, 'aUv');
    bind(sd, 1, 'aSeed');
  }

  /**
   * Average "will this pixel draw anything" across a scene's frames — the same
   * presence curve the shader uses. Becomes the probability distribution the
   * point cloud is sampled from, so points are spent where the figure is
   * rather than evenly over a mostly-empty frame.
   */
  _weights(frames) {
    const { w, h } = frames[0];
    const acc = new Float32Array(w * h);
    for (const f of frames) {
      const d = f.data;
      for (let i = 0; i < acc.length; i++) {
        const v = Math.pow(Math.min(1, Math.max(0, (d[i * 4] / 255 - 0.02) * 1.08)), 0.92);
        const t = Math.min(1, Math.max(0, (v - 0.07) / 0.17));
        acc[i] += t * t * (3 - 2 * t);
      }
    }
    const floor = FIELD.sampling.floor;
    for (let i = 0; i < acc.length; i++) acc[i] = acc[i] / frames.length + floor;
    return { acc, w, h };
  }

  /**
   * Redistribute the point cloud to match one scene.
   *
   * A uniform grid spends points evenly over the frame, so a subject covering
   * 5% of it gets 5% of the points and the other 95% are discarded against
   * black. Sampling from the scene's own density instead puts them where the
   * figure is — the same total cost, several times the detail.
   *
   * Stratified samples are already sorted, so the CDF is walked once: O(N).
   */
  _resample(index) {
    const wts = this.weights[index];
    if (!wts || this.sampled === index) return;
    this.sampled = index;

    const { acc, w, h } = wts;
    const cdf = new Float32Array(acc.length);
    let total = 0;
    for (let i = 0; i < acc.length; i++) { total += acc[i]; cdf[i] = total; }

    const N = this.count;
    const xy = new Float32Array(N * 2), uv = new Float32Array(N * 2);
    let j = 0;
    for (let i = 0; i < N; i++) {
      const target = ((i + Math.random()) / N) * total;
      while (j < cdf.length - 1 && cdf[j] < target) j++;
      const u = ((j % w) + Math.random()) / w;
      const v = (Math.floor(j / w) + Math.random()) / h;
      uv[i * 2] = u; uv[i * 2 + 1] = v;
      xy[i * 2] = u - 0.5; xy[i * 2 + 1] = 0.5 - v;
    }

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufXY); gl.bufferSubData(gl.ARRAY_BUFFER, 0, xy);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufUV); gl.bufferSubData(gl.ARRAY_BUFFER, 0, uv);
    this.dirty = true;
  }

  _texture(frame) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, frame.w, frame.h, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, frame.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex: t, w: frame.w, h: frame.h, aspect: frame.w / frame.h };
  }

  setDark(dark) {
    if (dark === this.dark) return;
    this.dark = dark;
    if (this.U) {
      this.gl.useProgram(this.prog);
      this.gl.uniform1f(this.U.uDark, dark ? 1 : 0);
      this._uploadTint();
    }
    this.dirty = true;
    this._kick();
  }

  /** Push the current theme's dot ramp to the shader. See FIELD.tint. */
  _uploadTint() {
    const t = FIELD.tint[this.dark ? 'dark' : 'light'];
    const rgb = (hex) => {
      const n = parseInt(hex.replace('#', ''), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    };
    this.gl.uniform3fv(this.U.uColFar, rgb(t.far));
    this.gl.uniform3fv(this.U.uColMid, rgb(t.mid));
    this.gl.uniform3fv(this.U.uColNear, rgb(t.near));
    this.gl.uniform3fv(this.U.uColHaze, rgb(t.haze));
  }

  setAvoidTargets(els) {
    this._measureFooter();
    this.avoidTargets = els || [];
    this.dirty = true;
    this._kick();
  }

  /**
   * Where the footer starts, in document coordinates.
   *
   * Cached rather than measured per frame: getBoundingClientRect forces layout,
   * and this only moves when the page reflows. Re-measured on resize and
   * whenever the avoid targets are handed over, which is also when content has
   * finished mounting.
   */
  _measureFooter() {
    const el = document.querySelector('footer');
    this.footerY = el ? el.getBoundingClientRect().top + scrollY : Infinity;
  }

  onResize() {
    if (!this.U) return;
    this._measureFooter();
    const gl = this.gl;
    const w = innerWidth, h = innerHeight;
    this.W = w; this.H = h;
    const dpr = Math.min(w < 720 ? 1 : 1.35, devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.U.uProj, false, perspective(w / h));
    gl.uniform1f(this.U.uPixelRatio, dpr);
    gl.uniform1f(this.U.uPointScale, w < 720 ? FIELD.pointScale.phone : FIELD.pointScale.desktop);
    gl.uniform1f(this.U.uAvoidFeather, w < 720 ? 0.15 : 0.095);
    gl.uniform1f(this.U.uLowQuality, w < 1440 ? 1 : 0);

    // world-space viewport size; the plane itself is sized per draw from the
    // current source's aspect ratio
    this.vh = 2 * Math.tan(FOV / 2) * CAM_Z;
    this.vw = this.vh * (w / h);
    const vw = this.vw;

    // Shift the figure toward the gutter on wide screens. Phones keep it
    // centred — there is no gutter to move into — and rely on the avoid rects.
    const shift = w >= 768 ? FIELD.offset * vw : 0;
    gl.uniform2f(this.U.uOffset, shift, 0);

    this.dirty = true;
    this._kick();
  }

  onScroll() {
    this.rawY = scrollY;
    this._kick();
  }

  onPointer(e) {
    if (!this.pointer) return;
    const k = FIELD.parallax;
    // y drives rotation about X, x about Y — same mapping datacurve uses
    this.tiltTo[0] = -((e.clientY / this.H) * 2 - 1) * k;
    this.tiltTo[1] = ((e.clientX / this.W) * 2 - 1) * k;
    this._kick();
  }

  /** Page scroll as 0..1, from the damped scroll position. */
  get progress() {
    const span = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return Math.max(0, Math.min(1, this.smoothY / span));
  }

  /**
   * Progress through the SEQUENCE, which does not start until the opening has
   * finished unfurling. Without this offset the two share the same scroll and
   * fight: the unfurl wants most of the first viewport, while scene one's hold
   * is over well before that, so the first shot never resolves.
   */
  get sequenceProgress() {
    const span = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const introPx = this.reduced ? 0 : innerHeight * FIELD.intro.scrollSpan;
    const start = Math.min(0.5, introPx / span);
    return Math.max(0, Math.min(1, (this.progress - start) / (1 - start)));
  }

  /**
   * Where we are in the sequence, for a page progress of 0..1.
   *
   * Each scene owns an equal slice. Inside its slice it first HOLDS: a still
   * just sits there, while a clip steps through its frames — that is the
   * footage playing under your thumb. The rest of the slice morphs into the
   * next scene, and only THAT gets the swarm (flow: 1).
   */
  _state(p) {
    const n = this.scenes.length;
    const last = (sc) => sc[sc.length - 1];

    // n slices, not n-1. Each slice HOLDS its scene (a still sits, a clip steps
    // through its frames) and then morphs to the next. The final slice has
    // nothing to morph into, so it spends its whole length playing — without
    // that case the last scene only ever appeared as the destination of the
    // last transition, and every frame after its first was dead.
    const seg = Math.max(0, Math.min(n - 1e-6, (p / FIELD.tail) * n));
    const i = Math.floor(seg), f = seg - i;
    const A = this.scenes[i];
    const gA = this.gains[i];

    if (i === n - 1) return { ...this._step(A, f, i), gain: gA };
    if (f < FIELD.hold) return { ...this._step(A, f / FIELD.hold, i), gain: gA };

    const morph = Math.min(1, (f - FIELD.hold) / (1 - FIELD.hold));
    const gB = this.gains[i + 1];
    return {
      a: last(A), b: this.scenes[i + 1][0], morph, flow: 1, seed: i,
      gain: gA + (gB - gA) * morph,
    };
  }

  /** Position within one scene: pick the frame pair and cross-fade between. */
  _step(scene, local, seed) {
    const k = scene.length;
    if (k === 1) return { a: scene[0], b: scene[0], morph: 0, flow: 0, seed };
    const f = Math.max(0, Math.min(k - 1 - 1e-6, local * (k - 1)));
    const j = Math.floor(f);
    return { a: scene[j], b: scene[Math.min(k - 1, j + 1)], morph: f - j, flow: 0, seed };
  }

  /**
   * Plane that CONTAINS a source of the given aspect within the viewport,
   * scaled by FIELD.spread. Contain, not cover — a 2.4:1 film frame has to
   * fit across the width and sit as a cinematic band, not get cropped to the
   * square that a still figure wants.
   */
  _plane(aspect) {
    const m = FIELD.spread * (this.W < 720 ? 0.92 : 1);
    const bw = this.vw * m, bh = this.vh * m;
    return aspect > bw / bh ? [bw, bw / aspect] : [bh * aspect, bh];
  }

  _measureAvoid() {
    const { W, H } = this;
    this.avoidRects.fill(0);
    this.avoidStr.fill(0);
    const mid = H / 2;
    const visible = this.avoidTargets
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((o) => o.r.bottom > 0 && o.r.top < H && o.r.height > 0)
      .sort((a, b) => Math.abs((a.r.top + a.r.bottom) / 2 - mid)
                    - Math.abs((b.r.top + b.r.bottom) / 2 - mid))
      .slice(0, 4);

    visible.forEach((o, i) => {
      const pad = 10;
      this.avoidRects[i * 4] = (o.r.left - pad) / W;
      this.avoidRects[i * 4 + 1] = (o.r.top - pad) / H;
      this.avoidRects[i * 4 + 2] = (o.r.right + pad) / W;
      this.avoidRects[i * 4 + 3] = (o.r.bottom + pad) / H;
      this.avoidStr[i] = Number(o.el.dataset.dotAvoid) || 0.85;
    });
    this.gl.uniform4fv(this.U.uAvoidRect, this.avoidRects);
    this.gl.uniform1fv(this.U.uAvoidStr, this.avoidStr);
  }

  _draw(now) {
    const gl = this.gl;
    const { a, b, morph, flow, seed, gain = 1 } = this._state(this.sequenceProgress);

    // Redistribute the cloud for whichever scene is about to be on screen.
    // Mid-transition is the moment to do it: the swarm has scattered every
    // point, so the change of distribution is invisible.
    this._resample(flow > 0.5 && morph > 0.5 ? seed + 1 : seed);

    if (seed !== this.lastPair) {
      this.lastPair = seed;
      gl.uniform1f(this.U.uTransitionSeed, Math.random() * 100);
    }

    // full presence over the hero, eased back so copy stays readable
    const t = Math.min(1, this.smoothY / Math.max(1, innerHeight * 0.8));
    const s = FIELD.strength;
    // per-figure gain: a thin subject (a seedling, a wire frame) puts far
    // fewer points on screen than a solid one, and needs lifting to sit at the
    // same visual weight as its neighbours
    gl.uniform1f(this.U.uStrength,
      (s.hero + (s.content - s.hero) * (t * t * (3 - 2 * t))) * gain);
    gl.uniform2f(this.U.uTilt, this.tilt[0], this.tilt[1]);

    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, b.tex);
    gl.uniform2f(this.U.uTexelA, 1 / a.w, 1 / a.h);
    gl.uniform2f(this.U.uTexelB, 1 / b.w, 1 / b.h);
    gl.uniform1f(this.U.uFlow, flow);

    // the plane follows the source's shape, so a 2.4:1 film frame stays
    // 2.4:1 instead of being squashed into the square a still figure wants
    const [pw, ph] = this._plane(a.aspect + (b.aspect - a.aspect) * morph);
    gl.uniform2f(this.U.uPlaneScale, pw, ph);
    gl.uniform1f(this.U.uMorph, morph);
    gl.uniform1f(this.U.uIntro, this.intro);
    gl.uniform1f(this.U.uOutro, this.outro);
    gl.uniform1f(this.U.uTime, now * 0.001);

    this._measureAvoid();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  _frame(now) {
    if (this.destroyed) return;

    const dy = this.rawY - this.smoothY;
    const moving = Math.abs(dy) > 0.05;
    if (moving) { this.smoothY += dy * 0.12; this.dirty = true; }
    else this.smoothY = this.rawY;

    // The opening is driven by SCROLL, not a timer: nothing unfurls until the
    // visitor moves. reduced-motion skips straight to the resolved figure.
    const span = FIELD.intro.scrollSpan;
    const next = this.reduced || span <= 0
      ? 1
      : Math.max(0, Math.min(1, this.smoothY / (innerHeight * span)));
    if (Math.abs(next - this.intro) > 1e-4) { this.intro = next; this.dirty = true; }

    // The closing is anchored to the FOOTER, not to a fraction of the page, so
    // it still lands correctly when sections are added or removed. It reaches
    // 1 — the field fully gone — at the moment the footer's top edge meets the
    // bottom of the screen. Driven off the damped scroll, like everything else.
    const outSpan = FIELD.outro.scrollSpan;
    const nextOut = outSpan <= 0 || !isFinite(this.footerY)
      ? 0
      : 1 - Math.max(0, Math.min(1,
          (this.footerY - this.smoothY - innerHeight) / (innerHeight * outSpan)));
    if (Math.abs(nextOut - this.outro) > 1e-4) { this.outro = nextOut; this.dirty = true; }

    // pointer tilt eases toward its target and then stops
    let tilting = false;
    for (let i = 0; i < 2; i++) {
      const d = this.tiltTo[i] - this.tilt[i];
      if (Math.abs(d) > 1e-4) { this.tilt[i] += d * 0.06; tilting = true; this.dirty = true; }
      else this.tilt[i] = this.tiltTo[i];
    }

    if (this.dirty) { this._draw(now); this.dirty = false; }

    // Only keep the loop alive while something is actually moving. A still
    // scroll and a still pointer mean a still field and zero draw calls.
    if (moving || tilting) requestAnimationFrame(this._frame);
    else this.running = false;
  }

  _kick() {
    if (this.running || this.destroyed || !this.scenes) return;
    this.running = true;
    requestAnimationFrame(this._frame);
  }

  destroy() {
    this.destroyed = true;
    removeEventListener('scroll', this.onScroll);
    removeEventListener('resize', this.onResize);
    removeEventListener('pointermove', this.onPointer);
    const gl = this.gl;
    if (!gl) return;
    this.scenes?.forEach((sc) => sc.forEach((t) => gl.deleteTexture(t.tex)));
    this.buffers?.forEach((b) => gl.deleteBuffer(b));
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.prog) gl.deleteProgram(this.prog);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
