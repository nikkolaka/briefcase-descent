// Shader for the office-worker model. Per-vertex `color` attribute lets every body
// part share one program (so there's a single fog uniform to update), while still
// being individually colored. Same lighting + fog model as the obstacles so the
// hero sits in the same world. OGL auto-supplies modelViewMatrix / normalMatrix.

import { Program } from 'ogl';

const vertex = /* glsl */ `#version 300 es
in vec3 position;
in vec3 normal;
in vec3 color;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

out vec3 vColor;
out vec3 vNormal;
out float vViewDist;

// Same PS1 grid snap as the obstacle shader — everything in the scene swims together
const float PS1_SNAP = 160.0;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewDist = -mv.z;
  vNormal = normalize(normalMatrix * normal);
  vColor = color;

  vec4 clip = projectionMatrix * mv;
  clip.xy = floor(clip.xy / clip.w * PS1_SNAP + 0.5) / PS1_SNAP * clip.w;
  gl_Position = clip;
}
`;

const fragment = /* glsl */ `#version 300 es
precision mediump float;
in vec3 vColor;
in vec3 vNormal;
in float vViewDist;

uniform vec3 uFogColor;
uniform float uFogDensity;

out vec4 fragColor;

void main() {
  vec3 n = normalize(vNormal);
  vec3 L = normalize(vec3(0.4, 0.75, 0.55));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  vec3 col = vColor * (0.4 + 0.75 * diff);
  float fog = clamp(exp(-uFogDensity * vViewDist), 0.0, 1.0);
  col = mix(uFogColor, col, fog);
  fragColor = vec4(col, 1.0);
}
`;

export function workerProgram(gl) {
  return new Program(gl, {
    vertex,
    fragment,
    cullFace: false,
    uniforms: {
      uFogColor: { value: [0, 0, 0] },
      uFogDensity: { value: 0.02 },
    },
  });
}
