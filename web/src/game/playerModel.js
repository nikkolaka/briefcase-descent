// PS1-era office worker assembled from low-poly cylinders.
// All limbs are split at their mid-joint (shoulder/elbow, hip/knee)
// with small ball-joint cylinders connecting each segment.
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
const SHOE  = [0.12, 0.10, 0.08];

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
  const add = (geo, color, x, y, z) => node(gl, program, geo, color, x, y, z).setParent(group);

  // ball joint helper — small squashed sphere using a 6-sided cylinder
  const jnt = (color, x, y, z, r = 0.14) =>
    add(new Cylinder(gl, { radiusTop: r, radiusBottom: r, height: r * 0.85, radialSegments: 6 }), color, x, y, z);

  // ── torso ──────────────────────────────────────────────────────────────────
  // center (0,0,0), height 1.00 → top +0.50, bottom −0.50
  add(new Cylinder(gl, { radiusTop: 0.44, radiusBottom: 0.40, height: 1.00, radialSegments: 6 }), SHIRT, 0, 0, 0);
  add(new Cylinder(gl, { radiusTop: 0.46, radiusBottom: 0.46, height: 0.10, radialSegments: 6 }), BELT,  0, -0.47, 0);
  add(new Box(gl, { width: 0.11, height: 0.46, depth: 0.05 }),                                    TIE,   0,  0.16, 0.42);

  // ── neck + head ────────────────────────────────────────────────────────────
  // neck bridges torso top (0.50) to head bottom (0.65)
  add(new Cylinder(gl, { radiusTop: 0.17, radiusBottom: 0.19, height: 0.16, radialSegments: 6 }), SKIN,  0,  0.58, 0);
  add(new Cylinder(gl, { radiusTop: 0.27, radiusBottom: 0.27, height: 0.40, radialSegments: 8 }), SKIN,  0,  0.85, 0);
  add(new Cylinder(gl, { radiusTop: 0.32, radiusBottom: 0.27, height: 0.12, radialSegments: 8 }), HAIR,  0,  1.10, 0);

  // ── arms ───────────────────────────────────────────────────────────────────
  // shoulder joints at torso shoulder level (y≈0.35)
  jnt(SKIN, -0.48, 0.35, 0, 0.15);
  jnt(SKIN,  0.48, 0.35, 0, 0.15);

  // upper arms: span 0.30→−0.14
  add(new Cylinder(gl, { radiusTop: 0.13, radiusBottom: 0.11, height: 0.44, radialSegments: 5 }), SHIRT, -0.56,  0.08, 0);
  add(new Cylinder(gl, { radiusTop: 0.13, radiusBottom: 0.11, height: 0.44, radialSegments: 5 }), SHIRT,  0.56,  0.08, 0);

  // elbow joints
  jnt(SKIN, -0.56, -0.16, 0, 0.12);
  jnt(SKIN,  0.56, -0.16, 0, 0.12);

  // forearms: span −0.18→−0.58
  add(new Cylinder(gl, { radiusTop: 0.11, radiusBottom: 0.09, height: 0.40, radialSegments: 5 }), SKIN, -0.56, -0.38, 0);
  add(new Cylinder(gl, { radiusTop: 0.11, radiusBottom: 0.09, height: 0.40, radialSegments: 5 }), SKIN,  0.56, -0.38, 0);

  // ── legs ───────────────────────────────────────────────────────────────────
  // hip joints just below belt/torso bottom (y≈−0.57)
  jnt(KHAKI, -0.22, -0.57, 0, 0.15);
  jnt(KHAKI,  0.22, -0.57, 0, 0.15);

  // upper legs: span −0.57→−1.03
  add(new Cylinder(gl, { radiusTop: 0.17, radiusBottom: 0.15, height: 0.46, radialSegments: 5 }), KHAKI, -0.24, -0.80, 0);
  add(new Cylinder(gl, { radiusTop: 0.17, radiusBottom: 0.15, height: 0.46, radialSegments: 5 }), KHAKI,  0.24, -0.80, 0);

  // knee joints
  jnt(KHAKI, -0.24, -1.05, 0, 0.13);
  jnt(KHAKI,  0.24, -1.05, 0, 0.13);

  // lower legs / shins: span −1.08→−1.50
  add(new Cylinder(gl, { radiusTop: 0.13, radiusBottom: 0.10, height: 0.42, radialSegments: 5 }), KHAKI, -0.24, -1.29, 0);
  add(new Cylinder(gl, { radiusTop: 0.13, radiusBottom: 0.10, height: 0.42, radialSegments: 5 }), KHAKI,  0.24, -1.29, 0);

  // shoes
  add(new Box(gl, { width: 0.22, height: 0.12, depth: 0.28 }), SHOE, -0.24, -1.56, 0);
  add(new Box(gl, { width: 0.22, height: 0.12, depth: 0.28 }), SHOE,  0.24, -1.56, 0);

  // ── briefcase ──────────────────────────────────────────────────────────────
  // held in right hand (end of right forearm at y≈−0.58)
  add(new Box(gl, { width: 0.62, height: 0.42, depth: 0.16 }), CASE, 0.62, -0.66, 0);

  group.scale.set(0.62, 0.62, 0.62);
  return { group, program };
}
