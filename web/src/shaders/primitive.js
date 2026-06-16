// Instanced flat-shaded primitive shader. Each instance carries its own offset,
// scale, base orientation, spin (axis + rate, animated from uTime), and color.
// Cheap: one directional light + a rim term + exponential fog. No textures.
// `viewMatrix` / `projectionMatrix` are auto-supplied by OGL when rendering.

import { Program } from 'ogl';

const vertex = /* glsl */ `#version 300 es
in vec3 position;
in vec3 normal;
in vec3 iOffset;
in vec3 iScale;
in vec4 iQuat;
in vec4 iSpin;   // xyz = spin axis, w = rate
in vec3 iColor;

uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;

out vec3 vColor;
out vec3 vNormal;
out float vViewDist;
out vec3 vLocalPos;

// PS1-style grid snap: lower = more jitter (160 = subtle, 64 = very coarse)
const float PS1_SNAP = 160.0;

vec3 qrot(vec4 q, vec3 v) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}
vec4 axisAngle(vec3 axis, float angle) {
  float h = angle * 0.5;
  return vec4(normalize(axis + 1e-5) * sin(h), cos(h));
}
vec4 qmul(vec4 a, vec4 b) {
  return vec4(
    a.w * b.xyz + b.w * a.xyz + cross(a.xyz, b.xyz),
    a.w * b.w - dot(a.xyz, b.xyz)
  );
}

void main() {
  vec4 q = qmul(axisAngle(iSpin.xyz, uTime * iSpin.w), iQuat);
  vec3 world = qrot(q, position * iScale) + iOffset;
  vec4 viewPos = viewMatrix * vec4(world, 1.0);

  vViewDist = -viewPos.z;
  vNormal = qrot(q, normal);
  vColor = iColor;
  vLocalPos = position;

  // Snap clip-space XY to a fixed-point grid before the perspective divide.
  // Replicates the PS1's integer vertex coordinates: vertices "swim" as the
  // camera moves because world→screen precision is coarse.
  vec4 clip = projectionMatrix * viewPos;
  clip.xy = floor(clip.xy / clip.w * PS1_SNAP + 0.5) / PS1_SNAP * clip.w;
  gl_Position = clip;
}
`;

const fragment = /* glsl */ `#version 300 es
precision mediump float;
in vec3 vColor;
in vec3 vNormal;
in float vViewDist;
in vec3 vLocalPos;

uniform vec3 uFogColor;
uniform float uFogDensity;

out vec4 fragColor;

// Sierpinski tetrahedral IFS orbit trap.
// Folds coordinate space 7 times; the minimum normalised distance to the
// attractor over all passes is the trap value: near 0 at fractal "bone"
// edges (→ bright ridge), large in voids (→ shadow).  ~7×10 MADs/frag.
float ifs(vec3 p) {
  float s = 1.0;
  float trap = 1e5;
  for (int i = 0; i < 7; i++) {
    p = abs(p);
    if (p.x < p.y) p.xy = p.yx;
    if (p.x < p.z) p.xz = p.zx;
    if (p.y < p.z) p.yz = p.zy;
    p = p * 2.0 - vec3(1.0);
    s *= 2.0;
    trap = min(trap, length(p) / s);
  }
  return trap;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(vec3(0.4, 0.75, 0.55));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float rim = pow(1.0 - abs(n.z), 2.0);

  vec3 col = vColor * (0.45 + 0.7 * diff) + vColor * rim * 0.35;

  // IFS fractal surface detail — same base geometry positions at every
  // cluster level so the pattern self-repeats across all three scales.
  float t = ifs(vLocalPos);
  float glow = 1.0 - smoothstep(0.0, 0.13, t);     // bright fractal edges
  float fill = smoothstep(0.06, 0.50, t);            // shadow in voids
  vec3 glowCol = mix(vColor, vec3(1.0), 0.55);       // white-tinted highlight
  col = col * (0.42 + 0.58 * fill) + glowCol * glow * 0.9;

  float fog = clamp(exp(-uFogDensity * vViewDist), 0.0, 1.0);
  col = mix(uFogColor, col, fog);

  fragColor = vec4(col, 1.0);
}
`;

export function primitiveProgram(gl) {
  return new Program(gl, {
    vertex,
    fragment,
    cullFace: false, // flat-shaded soup is drawn double-sided
    uniforms: {
      uTime: { value: 0 },
      uFogColor: { value: [0, 0, 0] },
      uFogDensity: { value: 0.02 },
    },
  });
}
