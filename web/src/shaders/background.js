// Neon rain background — vivid vertical streaks stream top-to-bottom like rain.
// Rendered as a full-screen triangle at far-plane depth (0.9999) so all 3D
// geometry automatically occludes it via standard depth testing.
//
// Layers:
//   1. Neon rain columns — two independent drops per column, each with a bright
//      head flash and an exponential trail that fades toward the top.
//      "Character" banding (fixed sine grid) breaks each trail into segments
//      so individual drops read clearly rather than blurring together.
//   2. Radial zoom rings — subtle tunnel-depth cue, same hue cycle as the rain.
//   3. CRT scanlines — thin contrast bands for retro VHS atmosphere.
//
// Hue cycles with uTime and uDepth so colour shifts as you fall deeper.
// Rain speed ramps with uDepth so the streaks accelerate the further you fall.

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

vec3 hsv(float h, float s, float v) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
  return v * mix(vec3(K.x), clamp(p - K.x, 0.0, 1.0), s);
}

float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

void main() {
  vec2 asp  = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  float t   = uTime;
  float dep = uDepth;

  // Global hue cycles over time and depth
  float hue = fract(t * 0.06 + dep * 0.00035);
  // Rain accelerates slightly as you fall deeper
  float spd = 1.0 + dep * 0.0009;
  // fy: 0 = top of screen, 1 = bottom — rain falls in the +fy direction
  float fy  = 1.0 - vUv.y;

  // ── Neon rain columns ───────────────────────────────────────────────────────
  const float COLS = 42.0;
  float ci = floor(vUv.x * COLS);   // integer column index
  float cf = fract(vUv.x * COLS);   // [0,1] position within column

  // Per-column random seeds
  float r1 = hash(ci);
  float r2 = hash(ci + 53.0);
  float r3 = hash(ci + 106.0);
  float r4 = hash(ci + 159.0);

  // Each column gets a slightly shifted hue: hot-pink → cyan → yellow cycle
  vec3 colColor = hsv(fract(hue + ci * 0.031), 1.0, 1.0);

  // Lateral profile: tight bright core + wider neon glow halo
  float core = exp(-abs(cf - 0.5) * 16.0);         // sub-pixel bright line
  float halo = exp(-abs(cf - 0.5) *  5.2) * 0.45;  // soft side glow
  float lat  = core + halo;

  // "Character" grid: fixed sine pattern along Y breaks trails into segments —
  // simulates discrete symbols without needing a font texture.
  float charGrid = 0.72 + 0.28 * sin(fy * 58.0 + ci * 3.7);

  // ── Drop A ──────────────────────────────────────────────────────────────────
  float sA  = (0.32 + r1 * 0.48) * spd;      // descent speed
  float hA  = fract(r2 + t * sA);             // head position (0=top → 1=bottom)
  float dA  = fract(hA - fy + 1.0);           // distance behind head (wraps)
  float tlA = 0.11 + r3 * 0.24;               // trail length [0.11 .. 0.35]
  float trA = dA < tlA ? exp(-dA * 4.0 / tlA) * charGrid : 0.0;
  trA += exp(-dA * 130.0) * 3.2;              // very bright head flash

  // ── Drop B (independent — keeps columns lively when A is off-screen) ────────
  float sB  = (0.19 + r3 * 0.33) * spd;
  float hB  = fract(r4 + t * sB + 0.51);
  float dB  = fract(hB - fy + 1.0);
  float tlB = 0.08 + r2 * 0.19;
  // Offset the char phase so A and B don't look identical
  float charB = 0.72 + 0.28 * sin(fy * 58.0 + ci * 3.7 + 1.9);
  float trB = dB < tlB ? exp(-dB * 4.0 / tlB) * charB : 0.0;
  trB += exp(-dB * 130.0) * 3.2;

  float rain = max(trA, trB) * lat;

  // ── Radial rings — give a vanishing-point tunnel feel ───────────────────────
  float r     = length(asp);
  float rfall = dep * 0.006 + t * 0.16;
  float ring  = fract(r * 4.0 - rfall);
  float ringB = pow(max(1.0 - abs(ring - 0.5) * 2.8, 0.0), 5.0) * exp(-r * 0.60);
  vec3 ringC  = hsv(hue, 1.0, 1.0);

  // ── Composite ───────────────────────────────────────────────────────────────
  vec3 col = vec3(0.0);
  col += colColor * rain  * 1.25;   // vivid rain (dominant)
  col += ringC    * ringB * 0.18;   // subtle depth rings

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
