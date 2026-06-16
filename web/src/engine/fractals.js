// True 3D-fractal geometry. Four obstacle types, each a structurally different
// kind of 3D fractal:
//
//   0  Sierpinski tetrahedron  — recursive IFS, direct mesh emission
//   1  Mandelbulb (power 8)    — escape-time, marching-tetrahedra isosurface
//   2  Mandelbox               — escape-time (box+ball fold), marching-tetrahedra
//   3  Mandelbulb (power 4)    — escape-time, different bulb topology
//
// The IFS types are built by emitting faces at every recursion leaf — exact and
// cheap. The escape-time types have no surface to emit; they're sampled as a scalar
// field and extracted with marching tetrahedra (polygonizeField in marchingTets.js).
// All four are generated once at startup and fed into the instanced pipeline;
// zero per-frame fractal computation.

import { polygonizeField } from './marchingTets.js';

// ─── Mesh accumulator ────────────────────────────────────────────────────────
function makeSoup() {
  const pos = [], nrm = [];
  return {
    tri(ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz) {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      nrm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    },
    bake() {
      return { position: new Float32Array(pos), normal: new Float32Array(nrm), triCount: pos.length / 9 };
    },
  };
}

// ─── Type 0: Sierpinski tetrahedron ──────────────────────────────────────────
// The classic self-similar tetrahedron: 4 half-scale copies at the 4 corners.
// Each leaf emits 4 triangular faces with outward normals.
const TETRA_V = [
  [ 1,  1,  1],
  [ 1, -1, -1],
  [-1,  1, -1],
  [-1, -1,  1],
];
const TETRA_F = [[1, 2, 3], [0, 3, 2], [0, 1, 3], [0, 2, 1]];

function emitTetra(s, cx, cy, cz, size) {
  const v = TETRA_V.map(([x, y, z]) => [cx + x * size, cy + y * size, cz + z * size]);
  for (const [a, b, c] of TETRA_F) {
    const A = v[a], B = v[b], C = v[c];
    const ux = B[0]-A[0], uy = B[1]-A[1], uz = B[2]-A[2];
    const wx = C[0]-A[0], wy = C[1]-A[1], wz = C[2]-A[2];
    let nx = uy*wz-uz*wy, ny = uz*wx-ux*wz, nz = ux*wy-uy*wx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;
    const mx = (A[0]+B[0]+C[0])/3-cx, my = (A[1]+B[1]+C[1])/3-cy, mz = (A[2]+B[2]+C[2])/3-cz;
    if (nx*mx + ny*my + nz*mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    s.tri(A[0],A[1],A[2], B[0],B[1],B[2], C[0],C[1],C[2], nx,ny,nz);
  }
}

function sierp(s, cx, cy, cz, size, depth) {
  if (depth === 0) { emitTetra(s, cx, cy, cz, size); return; }
  const h = size * 0.5;
  for (const [x, y, z] of TETRA_V) sierp(s, cx+x*h, cy+y*h, cz+z*h, h, depth - 1);
}

export function sierpinskiGeo(depth = 3, radius = 0.62) {
  const s = makeSoup();
  sierp(s, 0, 0, 0, radius / Math.sqrt(3), depth);
  return s.bake();
}

// ─── Escape-time field helpers ────────────────────────────────────────────────
// Both Mandelbulb and Mandelbox return the final orbit radius (or early-exit
// radius when the orbit escapes). "Solid" = orbit bounded = field < iso.

// Power-n Mandelbulb. Classic power-8 gives the iconic spiky blob; power-4
// produces a completely different rounder topology with fewer limbs.
function mandelbulbField(power, iter, bailout) {
  return (x, y, z) => {
    let zx = x, zy = y, zz = z, r = 0;
    for (let i = 0; i < iter; i++) {
      r = Math.sqrt(zx*zx + zy*zy + zz*zz);
      if (r > bailout) break;
      const theta = Math.acos(Math.max(-1, Math.min(1, zz / (r || 1e-9)))) * power;
      const phi   = Math.atan2(zy, zx) * power;
      const rp    = Math.pow(r, power);
      const st    = Math.sin(theta);
      zx = rp * st * Math.cos(phi) + x;
      zy = rp * st * Math.sin(phi) + y;
      zz = rp * Math.cos(theta)    + z;
    }
    return Math.min(r, bailout * 2);
  };
}

export function mandelbulbGeo(res = 30, radius = 0.62, power = 8) {
  return polygonizeField(mandelbulbField(power, 8, 2.0),
    { res, lo: -1.25, hi: 1.25, iso: 2.0, radius });
}

// Mandelbox — box-fold + ball-fold escape-time fractal. Scale=2 produces a
// distinctly crystalline/angular shape, very different from the Mandelbulb.
function mandelboxField(scale, iter, bailout) {
  const MINR2 = 0.25, FIXR2 = 1.0;
  return (x, y, z) => {
    let vx = x, vy = y, vz = z;
    for (let i = 0; i < iter; i++) {
      // Box fold: reflect coordinates outside [-1, 1] back
      if (vx > 1) vx = 2 - vx; else if (vx < -1) vx = -2 - vx;
      if (vy > 1) vy = 2 - vy; else if (vy < -1) vy = -2 - vy;
      if (vz > 1) vz = 2 - vz; else if (vz < -1) vz = -2 - vz;
      // Ball fold: reflect across a sphere of radius 1
      const r2 = vx*vx + vy*vy + vz*vz;
      if (r2 < MINR2) {
        const f = FIXR2 / MINR2; vx *= f; vy *= f; vz *= f;
      } else if (r2 < FIXR2) {
        const f = FIXR2 / r2;    vx *= f; vy *= f; vz *= f;
      }
      vx = scale * vx + x;
      vy = scale * vy + y;
      vz = scale * vz + z;
      const nr2 = vx*vx + vy*vy + vz*vz;
      if (nr2 > bailout * bailout) return Math.sqrt(nr2);
    }
    return Math.sqrt(vx*vx + vy*vy + vz*vz);
  };
}

export function mandelboxGeo(res = 30, radius = 0.62) {
  // Scale=2, bailout=6: orbits inside the set stay well below 6 after 10 iters;
  // escaped orbits blow past it quickly. iso=6 = surface at the escape boundary.
  return polygonizeField(mandelboxField(2.0, 10, 6.0),
    { res, lo: -1.5, hi: 1.5, iso: 6.0, radius });
}
