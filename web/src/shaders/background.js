// Rain converging toward the vanishing point directly below screen-centre —
// the point the office worker is falling toward. Streamlines are straight
// lines toward (0, -B) in aspect-correct space, giving motion that is
// simultaneously downward and inward from all sides.
//
// Each drop is a pair of rounded blobs (head + body) plus a thin tail.
// Blob sizes and positions are randomised per spoke so no two drops look
// the same — organic, not rectangular.
//
// Brightness fades logarithmically as drops approach the convergence point,
// so the centre stays dark and the outer rain field is vivid.

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
float hash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

// One raindrop: two rounded blobs + thin connecting tail, all sized randomly.
// dv  = signed distance behind the head along the spoke (0=head, +ve=trail).
// arc = physical arc-length from spoke centreline.
float drop(float dv, float arc, float r1, float r2, float r3, float r4) {
  // Head blob: centred near dv=0, slightly random offset
  float h0  = r4 * 0.04;
  float hW  = 10.0 + r1 * 9.0;            // angular width (lower = rounder)
  float hS  = 280.0 + r4 * 280.0;         // radial gaussian sharpness
  float head = exp(-arc * hW - (dv - h0) * (dv - h0) * hS);

  // Body blob: further back along the trail, larger and softer
  float b0  = h0 + 0.08 + r2 * 0.09;
  float bW  = 14.0 + r3 * 8.0;
  float bS  = 160.0 + r2 * 160.0;
  float body = exp(-arc * bW - (dv - b0) * (dv - b0) * bS);

  // Thin connecting tail
  float tl  = 0.12 + r3 * 0.22;
  float tail = dv < tl ? exp(-dv * 3.0 / tl) * exp(-arc * 26.0) * 0.45 : 0.0;

  return max(max(head, body), tail);
}

void main() {
  vec2 p  = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  float t   = uTime;
  float dep = uDepth;
  float hue = fract(t * 0.06 + dep * 0.00035);
  float spd = 1.0 + dep * 0.0009;

  // Convergence point at (0, -B): streamlines point downward-and-inward.
  // B=0.7 puts the vanishing point near the lower third of the screen.
  const float B    = 0.7;
  const float MAXR = 2.6;
  vec2  q  = p + vec2(0.0, B);   // shift origin to convergence point
  float r  = length(q);
  float nr = r / MAXR;            // normalised radius [0..1]
  float aN = atan(q.y, q.x) / TAU + 0.5;  // [0..1] around circle

  // ── Radial spokes ────────────────────────────────────────────────────────────
  const float RAYS = 52.0;
  float ri = floor(aN * RAYS);
  float rf = fract(aN * RAYS);

  float r1 = hash(ri);
  float r2 = hash(ri + 52.0);
  float r3 = hash(ri + 104.0);
  float r4 = hash(ri + 156.0);

  vec3 rayCol = hsv(fract(hue + ri * 0.026), 1.0, 1.0);

  // Physical arc-length: spokes merge at centre, separate at edges.
  // Subtle organic wobble breaks the perfectly-straight spoke.
  float wobble = sin(nr * 10.0 + ri * 1.7 + t * 0.9) * 0.007;
  float arc    = (abs(rf - 0.5) + wobble) * (TAU / RAYS) * r;

  // ── Drop A: head moves inward (nr decreases, 1→0, edge→convergence) ─────────
  float sA = (0.27 + r1 * 0.37) * spd;
  float hA = 1.0 - fract(r2 + t * sA);      // head nr: 1=outer, 0=centre
  float dA = fract(nr - hA + 1.0);           // 0=head, small+ve=trail outward
  float trA = drop(dA, arc, r1, r2, r3, r4);

  // ── Drop B: different speed/phase ────────────────────────────────────────────
  // Use shuffled hash slots so B looks structurally different from A.
  float sB = (0.17 + r3 * 0.29) * spd;
  float hB = 1.0 - fract(r4 + t * sB + 0.51);
  float dB = fract(nr - hB + 1.0);
  float trB = drop(dB, arc, r3, r4, r1, r2);

  float rain = max(trA, trB);

  // Logarithmic fade: full brightness at the screen edge, zero at convergence.
  // log(r * k + 1) is concave — fades steeply then slowly near the edge.
  const float K = 5.0;
  float logFade = log(r * K + 1.0) / log(MAXR * K + 1.0);
  rain *= clamp(logFade, 0.0, 1.0);

  // Zoom rings (subtle depth cue keyed to original centred coords)
  float pr    = length(p);
  float ring  = fract(pr * 4.2 - dep * 0.005 - t * 0.14);
  float ringB = pow(max(1.0 - abs(ring - 0.5) * 2.8, 0.0), 5.0) * exp(-pr * 0.55);

  vec3 col = vec3(0.0);
  col += rayCol                * rain  * 1.35;
  col += hsv(hue, 1.0, 1.0)   * ringB * 0.13;
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
