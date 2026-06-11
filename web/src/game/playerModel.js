// PS1-era office worker assembled from low-poly cylinders (5–8 radial segments)
// so each body part reads as a distinct faceted prism rather than a smooth surface.
// Flat caps + tapered cylinders give the chunky "early 3D game character" silhouette.
// Box is kept only for parts that are inherently flat (tie, briefcase).
// M6 swaps this whole file for an authored .glb loaded via GLTFLoader.

import { Box, Cylinder, Mesh, Transform } from 'ogl';
import { workerProgram } from '../shaders/worker.js';

const SHIRT = [0.20, 0.42, 0.86];
const SKIN  = [0.92, 0.76, 0.62];
const HAIR  = [0.16, 0.12, 0.10];
const TIE   = [0.74, 0.16, 0.22];
const BELT  = [0.22, 0.16, 0.10];
const KHAKI = [0.80, 0.74, 0.52];
const CASE  = [0.32, 0.21, 0.12];

function colorize(geo, color) {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i*3]=color[0]; c[i*3+1]=color[1]; c[i*3+2]=color[2]; }
  geo.addAttribute('color', { size: 3, data: c });
  return geo;
}

function node(gl, program, geo, color, x, y, z) {
  const mesh = new Mesh(gl, { geometry: colorize(geo, color), program });
  mesh.position.set(x, y, z);
  mesh.frustumCulled = false;
  return mesh;
}

export function buildWorker(gl) {
  const program = workerProgram(gl);
  const group = new Transform();
  const add = (...a) => node(gl, program, ...a).setParent(group);

  // torso — hexagonal prism, slightly wider at shoulders
  add(new Cylinder(gl, { radiusTop: 0.44, radiusBottom: 0.40, height: 1.10, radialSegments: 6 }), SHIRT, 0,     0,      0);
  // head — octagonal block (reads as a face without being a sphere)
  add(new Cylinder(gl, { radiusTop: 0.27, radiusBottom: 0.27, height: 0.42, radialSegments: 8 }), SKIN,  0,     0.93,   0);
  // hair — flat octagonal cap slightly wider than head
  add(new Cylinder(gl, { radiusTop: 0.32, radiusBottom: 0.27, height: 0.16, radialSegments: 8 }), HAIR,  0,     1.20,   0);
  // tie — flat strip on the front face of the torso
  add(new Box(gl, { width: 0.11, height: 0.52, depth: 0.05 }),                                    TIE,   0,     0.20,   0.42);
  // belt — thin hexagonal band wrapping the lower torso
  add(new Cylinder(gl, { radiusTop: 0.46, radiusBottom: 0.46, height: 0.12, radialSegments: 6 }), BELT,  0,    -0.58,   0);
  // legs — pentagonal prisms, slightly tapered toward ankle
  add(new Cylinder(gl, { radiusTop: 0.17, radiusBottom: 0.14, height: 0.88, radialSegments: 5 }), KHAKI,-0.26, -1.22,  0);
  add(new Cylinder(gl, { radiusTop: 0.17, radiusBottom: 0.14, height: 0.88, radialSegments: 5 }), KHAKI, 0.26, -1.22,  0);
  // arms — pentagonal prisms hanging at the sides
  add(new Cylinder(gl, { radiusTop: 0.13, radiusBottom: 0.11, height: 0.88, radialSegments: 5 }), SHIRT,-0.58, -0.06,  0);
  add(new Cylinder(gl, { radiusTop: 0.13, radiusBottom: 0.11, height: 0.88, radialSegments: 5 }), SHIRT, 0.58, -0.06,  0);
  // briefcase — flat box held out front
  add(new Box(gl, { width: 0.76, height: 0.50, depth: 0.18 }),                                    CASE,  0.0,  -0.60,   0.55);

  group.scale.set(0.62, 0.62, 0.62); // ~1.5 units tall in world space
  return { group, program };
}
