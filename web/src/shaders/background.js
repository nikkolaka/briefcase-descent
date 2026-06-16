// Hotline Miami / LSD neon tunnel background.
// Rendered as a full-screen triangle before the 3D scene so all obstacle
// geometry appears in front of it automatically via depth testing.
//
// Visual layers (all cheap, no textures):
//   1. Radial rings that zoom toward the viewer as depth increases (falling feel)
//   2. Rotating diagonal grid — the Hotline Miami floor pattern
//   3. Angular sector sweep — neon pizza-slice glow
//   4. Sheared triangle tiling — the Miami triangle motif
//   5. CRT scanlines — retro VHS atmosphere
//
// All layers cycle through a neon HSV palette (hot pink → cyan → electric yellow)
// keyed to uTime and uDepth so the hue shifts as you fall deeper.

import { Geometry, Program, Mesh, Transform } from 'ogl';

const vert = /* glsl */ `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  // Map full-screen triangle verts (-1..3) to UV 0..1 on the visible [0,1] square.
  vUv = position * 0.5 + 0.5;
  // Depth = 1 (far plane) so any rasterised 3D fragment covers this.
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

// Compact HSV → RGB (no branching)
vec3 hsv(float h, float s, float v) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + K.xyz) * 6.0 - K.www);
  return v * mix(vec3(K.x), clamp(p - K.x, 0.0, 1.0), s);
}

void main() {
  // Aspect-correct, centred coordinates
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;

  float t     = uTime;
  float depth = uDepth;
  // phase drives zoom speed and hue cycle — increases with both time and depth
  float fall  = depth * 0.007 + t * 0.22;
  float hue   = fract(t * 0.06 + depth * 0.00035);

  // Three neon hues 120° apart: hot pink, cyan, electric yellow rotate together
  vec3 c0 = hsv(hue,               1.0, 1.0);
  vec3 c1 = hsv(fract(hue + 0.33), 1.0, 1.0);
  vec3 c2 = hsv(fract(hue + 0.67), 1.0, 1.0);

  float r = length(p);

  // ── Layer 1: radial zoom rings ──────────────────────────────────────────────
  float rings = fract(r * 4.5 - fall);
  // Thin bright band at the ring boundary, dimmed by distance
  float ringBand = pow(max(1.0 - abs(rings - 0.5) * 2.2, 0.0), 4.0);
  ringBand *= exp(-r * 0.55);

  // ── Layer 2: rotating diagonal grid (HM floor) ─────────────────────────────
  float ga   = t * 0.05 + depth * 0.0004;  // slow rotation
  float ca   = cos(ga), sa = sin(ga);
  vec2  gp   = vec2(ca*p.x - sa*p.y, sa*p.x + ca*p.y);
  gp.y      += fall * 0.35;                // scroll along the fall axis
  vec2  gc   = fract(gp * 2.2) - 0.5;
  float grid = 1.0 - smoothstep(0.025, 0.08, min(abs(gc.x), abs(gc.y)));
  grid      *= 0.5 + 0.5 * sin(t * 1.8 + r * 2.5); // pulsed intensity

  // ── Layer 3: angular sector sweep ──────────────────────────────────────────
  float a       = atan(p.y, p.x);
  float sectors = sin(a * 7.0 + t * 1.1 + depth * 0.003) * 0.5 + 0.5;
  float secGlow = sectors * ringBand * 0.9;

  // ── Layer 4: sheared triangle grid (Miami triangle motif) ──────────────────
  vec2 tp  = gp * 3.5;
  tp.x    += sin(tp.y * 0.45 + t * 0.7) * 0.25;  // slight warping
  float tx = abs(fract(tp.x) - 0.5);
  float ty = abs(fract(tp.y + tp.x * 0.577) - 0.5); // √3 shear → equilateral
  float tris = 1.0 - smoothstep(0.0, 0.055, min(tx, ty));

  // ── Composite ──────────────────────────────────────────────────────────────
  // Brightness budget kept very low: obstacles must read clearly in front.
  vec3 col = vec3(0.0);
  col += c0 * ringBand * 0.22;
  col += c1 * grid     * 0.16;
  col += c2 * secGlow  * 0.13;
  col += c0 * tris     * 0.11;

  // Soft vignette: brighter near the edges, darker toward the vanishing centre
  float vig = smoothstep(0.0, 1.0, r * 0.45);
  col = mix(col * 0.35, col, vig);

  // CRT scanlines — thin dark bands every ~3-4 px at typical res
  float scan = sin(vUv.y * 280.0) * 0.5 + 0.5;
  col *= 0.88 + 0.12 * scan;

  // Final scale-down: background should be subtle, not compete with obstacles
  col = clamp(col * 0.55, 0.0, 1.0);

  fragColor = vec4(col, 1.0);
}
`;

export function createBackground(gl) {
  // One large triangle that covers the entire clip-space viewport.
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
