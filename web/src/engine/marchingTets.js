// Isosurface extraction via Marching Tetrahedra.
//
// Escape-time fractals (Mandelbulb, Mandelbox, …) are *volumes*, not surfaces:
// a point is "solid" when iterating z → z^n + c never escapes. To turn that into
// a mesh we sample the scalar field on a regular grid and extract the surface
// where field == iso.
//
// We use marching *tetrahedra* rather than marching cubes: each grid cell is split
// into 6 tetrahedra, and a tetra's intersection with the isosurface is either one
// triangle (1-vs-3 corner split) or a quad / two triangles (2-vs-2 split). The set
// of edges the surface crosses is fully determined by which corners are solid, so
// no 256-entry lookup table is needed — it's compact and watertight.
//
// Triangle winding is irrelevant here (the renderer draws double-sided); instead we
// orient each flat normal along the field gradient so shading is always correct.

// The 6 tetrahedra that tile a cube, as indices into the 8 corners. They share the
// 0–6 body diagonal, which guarantees the tiling is consistent between adjacent
// cells (no cracks).
const CUBE_TETS = [
  [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
  [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6],
];

// Corner offsets in the canonical cube-corner order used by CUBE_TETS.
const CORNER = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

// The 6 edges of a tetra as corner-pairs.
const TET_EDGES = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

function lerpVert(pa, va, pb, vb, iso, out) {
  // Position of the iso crossing on edge a→b.
  let t = (iso - va) / (vb - va);
  if (!isFinite(t)) t = 0.5;
  out[0] = pa[0] + (pb[0] - pa[0]) * t;
  out[1] = pa[1] + (pb[1] - pa[1]) * t;
  out[2] = pa[2] + (pb[2] - pa[2]) * t;
}

// Sample `field` on a (res+1)^3 grid spanning [lo,hi]^3 and emit the iso == `iso`
// surface as a flat-shaded, origin-centred triangle soup normalised to ~`radius`.
// `solid` is the side counted as inside: field < iso.
export function polygonizeField(field, { res = 40, lo = -1.25, hi = 1.25, iso, radius = 0.62 }) {
  const n = res + 1;
  const step = (hi - lo) / res;
  const vals = new Float32Array(n * n * n);

  // Pre-sample the scalar field at every grid corner once.
  let p = 0;
  for (let k = 0; k < n; k++)
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++)
        vals[p++] = field(lo + step * i, lo + step * j, lo + step * k);

  const idx = (i, j, k) => i + n * (j + n * k);
  const tris = []; // flat list of vec3 positions, 3 per triangle

  const cp = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]; // tetra corner positions
  const cv = [0, 0, 0, 0]; // tetra corner values
  const cross = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]; // up to 4 crossings

  for (let k = 0; k < res; k++) {
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        // Gather the 8 cube corners.
        const px = lo + step * i, py = lo + step * j, pz = lo + step * k;

        for (let t = 0; t < 6; t++) {
          const tet = CUBE_TETS[t];
          let inside = 0;
          for (let c = 0; c < 4; c++) {
            const off = CORNER[tet[c]];
            const ci = i + off[0], cj = j + off[1], ck = k + off[2];
            cp[c][0] = px + off[0] * step;
            cp[c][1] = py + off[1] * step;
            cp[c][2] = pz + off[2] * step;
            const v = vals[idx(ci, cj, ck)];
            cv[c] = v;
            if (v < iso) inside |= 1 << c; // solid = field below iso
          }
          if (inside === 0 || inside === 0xf) continue; // fully out / fully in

          // Find the edges where the surface crosses (one solid corner, one not).
          let nc = 0;
          for (let e = 0; e < 6; e++) {
            const a = TET_EDGES[e][0], b = TET_EDGES[e][1];
            const sa = (inside >> a) & 1, sb = (inside >> b) & 1;
            if (sa !== sb) {
              lerpVert(cp[a], cv[a], cp[b], cv[b], iso, cross[nc]);
              nc++;
            }
          }

          if (nc === 3) {
            tris.push([cross[0][0], cross[0][1], cross[0][2]],
                      [cross[1][0], cross[1][1], cross[1][2]],
                      [cross[2][0], cross[2][1], cross[2][2]]);
          } else if (nc === 4) {
            // 2-vs-2 split: order the 4 points around their centroid so the quad
            // isn't a bowtie, then split into two triangles.
            orderQuad(cross);
            tris.push([cross[0][0], cross[0][1], cross[0][2]],
                      [cross[1][0], cross[1][1], cross[1][2]],
                      [cross[2][0], cross[2][1], cross[2][2]]);
            tris.push([cross[0][0], cross[0][1], cross[0][2]],
                      [cross[2][0], cross[2][1], cross[2][2]],
                      [cross[3][0], cross[3][1], cross[3][2]]);
          }
        }
      }
    }
  }

  return finalizeSoup(tris, field, radius, step);
}

// Order 4 coplanar-ish points into a non-self-intersecting quad by sorting around
// their centroid in the plane spanned by two in-plane basis vectors.
function orderQuad(q) {
  const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4;
  const cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  const cz = (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4;
  // Basis from the first point relative to centroid.
  let ux = q[0][0] - cx, uy = q[0][1] - cy, uz = q[0][2] - cz;
  const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  // Plane normal from two spokes.
  const ax = q[1][0] - cx, ay = q[1][1] - cy, az = q[1][2] - cz;
  let nx = uy * az - uz * ay, ny = uz * ax - ux * az, nz = ux * ay - uy * ax;
  const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  // Second basis = n × u.
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
  const ang = (pt) => Math.atan2(
    (pt[0] - cx) * vx + (pt[1] - cy) * vy + (pt[2] - cz) * vz,
    (pt[0] - cx) * ux + (pt[1] - cy) * uy + (pt[2] - cz) * uz,
  );
  q.sort((a, b) => ang(a) - ang(b));
}

// Triangle soup → {position, normal}: centre on origin, scale to `radius`, and give
// every triangle one flat normal oriented outward (along +field gradient).
function finalizeSoup(tris, field, radius, step) {
  const triCount = tris.length / 3;
  const position = new Float32Array(triCount * 9);
  const normal = new Float32Array(triCount * 9);

  // Bounds for centring + uniform scaling.
  let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
  for (const v of tris) {
    if (v[0] < minX) minX = v[0]; if (v[0] > maxX) maxX = v[0];
    if (v[1] < minY) minY = v[1]; if (v[1] > maxY) maxY = v[1];
    if (v[2] < minZ) minZ = v[2]; if (v[2] > maxZ) maxZ = v[2];
  }
  const ctr = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
  const ext = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const s = (radius * 2) / ext;
  const eps = step * 0.5;

  for (let f = 0; f < triCount; f++) {
    const a = tris[f * 3], b = tris[f * 3 + 1], c = tris[f * 3 + 2];
    // Face normal from winding (orientation fixed up next).
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;

    // Orient along the field gradient (points from solid→empty = outward).
    const mx = (a[0] + b[0] + c[0]) / 3, my = (a[1] + b[1] + c[1]) / 3, mz = (a[2] + b[2] + c[2]) / 3;
    const gx = field(mx + eps, my, mz) - field(mx - eps, my, mz);
    const gy = field(mx, my + eps, mz) - field(mx, my - eps, mz);
    const gz = field(mx, my, mz + eps) - field(mx, my, mz - eps);
    if (nx * gx + ny * gy + nz * gz < 0) { nx = -nx; ny = -ny; nz = -nz; }

    const o = f * 9;
    const verts = [a, b, c];
    for (let q = 0; q < 3; q++) {
      position[o + q * 3]     = (verts[q][0] - ctr[0]) * s;
      position[o + q * 3 + 1] = (verts[q][1] - ctr[1]) * s;
      position[o + q * 3 + 2] = (verts[q][2] - ctr[2]) * s;
      normal[o + q * 3] = nx; normal[o + q * 3 + 1] = ny; normal[o + q * 3 + 2] = nz;
    }
  }
  return { position, normal, triCount };
}
