// Radial neon rain — streaks burst outward from the vanishing point at screen
// center (where the office worker is falling toward), like driving through rain
// at speed. Each spoke has two independent drops; the head rushes toward the
// edge while the trail fades back toward the center.
//
// Rendered as a full-screen triangle at far-plane depth (0.9999) so all 3D
// geometry automatically occludes it via standard depth testing.
//
// Physical arc-length lateral profile: spokes merge into a central glow near
// the vanishing point and separate into distinct streaks toward the edges.
// Hue and speed both ramp with uDepth so the tunnel accelerates as you fall.

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

const float PI  = 3.14159265;
const float TAU = 6.28318530;

vec3 hsv(float h, float s, float v) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
  return v * mix(vec3(K.x), clamp(p - K.x, 0.0, 1.0), s);
}

float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  // Aspect-correct centred coords: x ∈ [-aspect, aspect], y ∈ [-1, 1]
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;

  float t   = uTime;
  float dep = uDepth;
  float hue = fract(t * 0.06 + dep * 0.00035);
  // Rain accelerates as you fall deeper
  float spd = 1.0 + dep * 0.0009;

  // Polar coordinates
  float r  = length(p);
  float nr = r / 1.85;               // normalise to ≈ 1 at screen edge
  float a  = atan(p.y, p.x);         // [-π, π]
  float aN = a / TAU + 0.5;          // [0, 1] around full circle

  // ── Radial rain spokes ───────────────────────────────────────────────────────
  const float RAYS = 54.0;
  float ri = floor(aN * RAYS);        // integer spoke index
  float rf = fract(aN * RAYS);        // [0,1] within angular slice

  // Per-spoke random constants
  float r1 = hash(ri);
  float r2 = hash(ri + 54.0);
  float r3 = hash(ri + 108.0);
  float r4 = hash(ri + 162.0);

  // Spoke hue shifts per ray for neon variety
  vec3 rayCol = hsv(fract(hue + ri * 0.025), 1.0, 1.0);

  // Physical arc-length from spoke centreline at current radius.
  // Near r=0 all spokes merge (central glow); they separate outward.
  float arcLen = abs(rf - 0.5) * (TAU / RAYS) * r;
  float core   = exp(-arcLen * 20.0);          // tight bright centreline
  float bloom  = exp(-arcLen *  5.5) * 0.45;   // wider neon halo
  float lat    = core + bloom;

  // ── Spoke drop A ────────────────────────────────────────────────────────────
  // Head moves radially outward (nr increases over time).
  // d = 0 at head; positive = behind head (inward / toward centre).
  float sA  = (0.34 + r1 * 0.46) * spd;
  float hA  = fract(r2 + t * sA);          // head normalised radius
  float dA  = fract(hA - nr + 1.0);        // distance behind head
  float tlA = 0.12 + r3 * 0.24;            // trail length [0.12..0.36]
  // Banding along the radius simulates discrete raindrops / characters
  float bA  = 0.70 + 0.30 * sin(nr * 55.0 + ri * 3.3);
  float trA = dA < tlA ? exp(-dA * 4.2 / tlA) * bA : 0.0;
  trA += exp(-dA * 140.0) * 3.5;           // very bright leading edge

  // ── Spoke drop B (independent speed/phase) ───────────────────────────────
  float sB  = (0.21 + r3 * 0.34) * spd;
  float hB  = fract(r4 + t * sB + 0.52);
  float dB  = fract(hB - nr + 1.0);
  float tlB = 0.09 + r2 * 0.18;
  float bB  = 0.70 + 0.30 * sin(nr * 55.0 + ri * 3.3 + 2.1);
  float trB = dB < tlB ? exp(-dB * 4.2 / tlB) * bB : 0.0;
  trB += exp(-dB * 140.0) * 3.5;

  float rain = max(trA, trB) * lat;

  // Fade to zero at the exact centre (polar singularity) then ramp up quickly
  rain *= smoothstep(0.0, 0.12, nr);

  // ── Central vanishing-point glow ─────────────────────────────────────────────
  // All spokes converge here — the spot where the worker is headed glows white.
  float cGlow = exp(-r * 4.5) * 0.75;
  vec3  cCol  = hsv(fract(hue + 0.5), 0.6, 1.0);  // complementary, slightly desaturated

  // ── Zoom rings (depth cue) ───────────────────────────────────────────────────
  float rfall = dep * 0.006 + t * 0.18;
  float ring  = fract(r * 4.2 - rfall);
  float ringB = pow(max(1.0 - abs(ring - 0.5) * 2.8, 0.0), 5.0) * exp(-r * 0.55);
  vec3  ringC = hsv(hue, 1.0, 1.0);

  // ── Composite ────────────────────────────────────────────────────────────────
  vec3 col = vec3(0.0);
  col += rayCol * rain  * 1.30;   // vivid radial rain
  col += cCol   * cGlow;          // central glow at vanishing point
  col += ringC  * ringB * 0.16;   // subtle zoom rings

  // Scanlines
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
