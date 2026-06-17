// Rain parallel to the player's fall vector (-Z into the screen).
// The camera sits at (0, 2.6, +9) relative to the player and looks at
// (0, -1.4, -7), so the -Z vanishing point projects to ~30% above screen
// centre (NDC y ≈ +0.35).  All rain spokes radiate from that point.
//
// Each drop is a 2-D Gaussian blob (exp(-arc²·aw - dr²·rw)) — this is the
// key to non-rectangular shapes.  A 1-D exponential decay along the spoke
// is what made previous versions look like streaks; Gaussian in both
// dimensions gives round, bead-like drops.
//
// 3-D Perlin fog (FBM with z=time) rises upward past the player because
// the player is falling faster than the fog.

import { Geometry, Program, Mesh, Transform } from 'ogl';

const vert = /* glsl */ `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.9999, 1.0);
}
`;

const frag = /* glsl */ `#version 300 es
precision mediump float;
in vec2 vUv;
uniform float uTime;
uniform float uDepth;
uniform float uAspect;
out vec4 fragColor;

const float TAU = 6.28318530;

vec3 hsv(float h, float s, float v) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
  return v * mix(vec3(K.x), clamp(p - K.x, 0.0, 1.0), s);
}

float hash1(float  n) { return fract(sin(n          * 127.1 + 311.7) * 43758.5453); }
float hash2(vec2   p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// ── 3-D Perlin-style FBM fog ─────────────────────────────────────────────────
// Value noise on a 2-D grid, smooth-stepped.
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i),           hash2(i + vec2(1,0)), u.x),
             mix(hash2(i+vec2(0,1)), hash2(i + vec2(1,1)), u.x), u.y);
}

// 4-octave FBM with mild per-octave rotation for isotropy.
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 R = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = R * p * 2.1; a *= 0.5; }
  return v;
}

// Fake 3-D: two z-slices of 2-D FBM interpolated by fract(z).
float fbm3(vec3 q) {
  float z0 = floor(q.z), zf = smoothstep(0.0, 1.0, fract(q.z));
  return mix(fbm(q.xy + z0 * 43.7), fbm(q.xy + (z0 + 1.0) * 43.7), zf);
}

// ── Raindrop blob ─────────────────────────────────────────────────────────────
// 2-D Gaussian in (arc-length × normalised-radial) space.
// arc = physical arc-length from spoke centreline (world units).
// dr  = (nr - blobCentre) — normalised radial offset.
// aw, rw control angular and radial spread; equal values → circular blob.
float blob(float arc, float dr, float aw, float rw) {
  return exp(-arc * arc * aw - dr * dr * rw);
}

void main() {
  // Aspect-correct centred coords.  p.y > 0 is UP.
  vec2 p  = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  float t   = uTime;
  float dep = uDepth;
  float hue = fract(t * 0.06 + dep * 0.00035);
  float spd = 1.0 + dep * 0.0009;

  // ── Fog rising upward ────────────────────────────────────────────────────────
  // Player falls -Z → fog appears to stream past upward (+Y on screen).
  // Three scale layers at different drift speeds give volumetric depth.
  float drift = t * 0.28 + dep * 0.0015;
  // drift upward: subtract time from y so the pattern moves in +y direction
  float fA = fbm3(vec3(p * 1.3,  dep * 0.008 + t * 0.10)) ;
  float fB = fbm3(vec3(p * 2.6,  dep * 0.008 + t * 0.17)) ;
  float fC = fbm3(vec3(p * 5.2,  dep * 0.008 + t * 0.27)) ;

  // Also drift the 2-D evaluation upward for parallax
  float fogA = fbm(p * 1.3 - vec2(0.0, drift * 0.9) ) - 0.40;
  float fogB = fbm(p * 2.7 - vec2(0.0, drift * 1.5) + 3.7) - 0.43;
  float fogC = fbm(p * 5.1 - vec2(0.0, drift * 2.3) + 7.1) - 0.46;

  float fogVal = max(0.0, fogA) + max(0.0, fogB) * 0.55 + max(0.0, fogC) * 0.28;
  fogVal = fogVal * fogVal * 1.8;   // square → punchier wisps, black gaps

  // Fog colour: hues 120° and 240° offset from rain for contrast
  vec3 fogC1 = hsv(fract(hue + 0.33), 0.80, 1.0);
  vec3 fogC2 = hsv(fract(hue + 0.67), 0.80, 1.0);
  // Blend between the two fog hues with a slow large-scale noise
  float fogMix = fbm(p * 0.9 - vec2(0.0, drift * 0.6));
  vec3 fogCol  = mix(fogC1, fogC2, fogMix);

  // ── Rain: 2-D Gaussian blobs on radial spokes ────────────────────────────────
  // Vanishing point: project world -Z through the camera's view matrix.
  // Camera looks at dir (0,-4,-16) normalised.  The -Z direction (0,0,-1)
  // in camera space has y-component = dot((0,0,-1),(0,0.970,-0.243)) = 0.243,
  // z-component = 0.970.  With approx FOV ≈ 60° (tan30°=0.577):
  //   NDC_y = 0.243/0.970/0.577 ≈ 0.434  →  screen-space y ≈ +0.43 above centre.
  // We shift the polar origin to that point so rain radiates from where the
  // player is actually heading.
  const vec2 VANISH = vec2(0.0, 0.43);  // NDC offset (x centred, y above centre)
  vec2  q  = p - VANISH;                 // re-centre at vanishing point
  float r  = length(q);
  float nr = r / 2.0;                    // normalise to ≈1 at screen edge
  float aN = atan(q.y, q.x) / TAU + 0.5;

  const float RAYS = 56.0;
  float ri = floor(aN * RAYS);
  float rf = fract(aN * RAYS);

  float r1 = hash1(ri);
  float r2 = hash1(ri + 56.0);
  float r3 = hash1(ri + 112.0);
  float r4 = hash1(ri + 168.0);
  float r5 = hash1(ri + 224.0);
  float r6 = hash1(ri + 280.0);

  vec3 rayCol = hsv(fract(hue + ri * 0.026), 1.0, 1.0);

  // Physical arc-length from spoke centreline: correct for perspective.
  float arc = abs(rf - 0.5) * (TAU / RAYS) * r;

  // Blob parameters: aw ≈ rw / (maxR²) for a visually circular drop.
  // Here maxR = 2.0, so aw ≈ rw/4.  Using rw ≈ 1000 → aw ≈ 250.
  // Randomise per-spoke and per-chain so no two drops look identical.
  float aw1 = 220.0 + r1 * 100.0;   float rw1 = 900.0 + r1 * 400.0;
  float aw2 = 200.0 + r2 *  80.0;   float rw2 = 800.0 + r2 * 300.0;
  float aw3 = 180.0 + r3 *  70.0;   float rw3 = 700.0 + r3 * 250.0;

  // Chain A: head rushes outward (nr increases: 0=vanish → 1=edge)
  float sA   = (0.27 + r1 * 0.38) * spd;
  float hA   = fract(r2 + t * sA);     // head normalised radius
  float gap1 = 0.09 + r3 * 0.09;
  float gap2 = 0.08 + r4 * 0.08;

  float b1A = blob(arc, nr - hA,             aw1, rw1);
  float b2A = blob(arc, nr - (hA - gap1),    aw2, rw2) * 0.70;
  float b3A = blob(arc, nr - (hA-gap1-gap2), aw3, rw3) * 0.50;
  float chainA = max(max(b1A, b2A), b3A);

  // Chain B: independent speed / phase
  float sB   = (0.18 + r3 * 0.28) * spd;
  float hB   = fract(r4 + t * sB + 0.45);
  float gap3 = 0.08 + r5 * 0.09;
  float gap4 = 0.08 + r6 * 0.08;

  float b1B = blob(arc, nr - hB,             210.0+r4*90.0,  860.0+r4*360.0);
  float b2B = blob(arc, nr - (hB - gap3),    190.0+r5*75.0,  750.0+r5*280.0) * 0.70;
  float b3B = blob(arc, nr - (hB-gap3-gap4), 170.0+r6*65.0,  650.0+r6*220.0) * 0.50;
  float chainB = max(max(b1B, b2B), b3B);

  float rain = max(chainA, chainB);

  // Logarithmic fade toward the vanishing point: centre stays dark.
  float logFade = log(r * 5.5 + 1.0) / log(2.0 * 5.5 + 1.0);
  rain *= clamp(logFade, 0.0, 1.0);

  // ── Composite ─────────────────────────────────────────────────────────────────
  vec3 col = vec3(0.0);
  col += fogCol * fogVal * 0.60;    // rising Perlin fog (behind rain)
  col += rayCol * rain   * 1.35;    // vivid circular rain drops on top

  // Subtle scanlines for retro VHS feel
  col *= 0.90 + 0.10 * (sin(vUv.y * 290.0) * 0.5 + 0.5);

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function createBackground(gl) {
  const geo = new Geometry(gl, {
    position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
  });
  const program = new Program(gl, {
    vertex: vert,
    fragment: frag,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime:   { value: 0 },
      uDepth:  { value: 0 },
      uAspect: { value: 1 },
    },
  });
  const mesh = new Mesh(gl, { geometry: geo, program });
  mesh.frustumCulled = false;
  const scene = new Transform();
  mesh.setParent(scene);
  return { scene, program };
}
