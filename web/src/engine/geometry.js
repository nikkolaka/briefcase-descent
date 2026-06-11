// Low-poly flat-shaded primitives, built as non-indexed triangle soups with one
// face normal per vertex (the faceted "low-poly gem" look). All are centered on
// the origin with ~1 unit diameter, so a per-instance scale reads as size.
//
// Normals are oriented outward via a centroid test, which means we don't have to
// hand-verify winding order — the renderer draws these double-sided anyway.

function buildFlat(verts, faces) {
  const position = new Float32Array(faces.length * 9);
  const normal = new Float32Array(faces.length * 9);

  for (let f = 0; f < faces.length; f++) {
    const [ia, ib, ic] = faces[f];
    const ax = verts[ia * 3], ay = verts[ia * 3 + 1], az = verts[ia * 3 + 2];
    const bx = verts[ib * 3], by = verts[ib * 3 + 1], bz = verts[ib * 3 + 2];
    const cx = verts[ic * 3], cy = verts[ic * 3 + 1], cz = verts[ic * 3 + 2];

    // Face normal = normalize(cross(b - a, c - a)).
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;

    // Orient outward (shapes are origin-centered, so the centroid points out).
    const cxm = (ax + bx + cx) / 3, cym = (ay + by + cy) / 3, czm = (az + bz + cz) / 3;
    if (nx * cxm + ny * cym + nz * czm < 0) { nx = -nx; ny = -ny; nz = -nz; }

    const o = f * 9;
    position[o] = ax; position[o + 1] = ay; position[o + 2] = az;
    position[o + 3] = bx; position[o + 4] = by; position[o + 5] = bz;
    position[o + 6] = cx; position[o + 7] = cy; position[o + 8] = cz;
    for (let k = 0; k < 3; k++) {
      normal[o + k * 3] = nx; normal[o + k * 3 + 1] = ny; normal[o + k * 3 + 2] = nz;
    }
  }
  return { position, normal };
}

function scaleToRadius(verts, r) {
  const out = new Float32Array(verts.length);
  for (let i = 0; i < verts.length; i += 3) {
    const len = Math.hypot(verts[i], verts[i + 1], verts[i + 2]) || 1;
    const s = r / len;
    out[i] = verts[i] * s; out[i + 1] = verts[i + 1] * s; out[i + 2] = verts[i + 2] * s;
  }
  return out;
}

// Extrude a triangular pyramid from every face of a (origin-centered) shape.
// Works by projecting the face centroid outward along the centroid direction,
// which is the outward normal for any origin-centered convex mesh. The resulting
// spike tip + 3 side faces give the Mandelbulb-esque "growth" silhouette.
// The original face is kept so the object reads as solid.
function spiked(verts, faces, spikeH) {
  const v = Array.from(verts); // append spike tips into a mutable copy
  const f = [];
  for (const [ia, ib, ic] of faces) {
    f.push([ia, ib, ic]); // keep base face for solid appearance
    const ax = v[ia*3], ay = v[ia*3+1], az = v[ia*3+2];
    const bx = v[ib*3], by = v[ib*3+1], bz = v[ib*3+2];
    const cx = v[ic*3], cy = v[ic*3+1], cz = v[ic*3+2];
    const mx = (ax+bx+cx)/3, my = (ay+by+cy)/3, mz = (az+bz+cz)/3;
    const nm = Math.hypot(mx, my, mz) || 1;
    const tip = v.length / 3; // index of the tip vertex we're about to add
    v.push(mx + mx/nm*spikeH, my + my/nm*spikeH, mz + mz/nm*spikeH);
    f.push([ia, ib, tip], [ib, ic, tip], [ic, ia, tip]);
  }
  return { v, f };
}

// --- Spiked cube (36 tris: 12 base + 6 quad-spikes × 4 tris) -----------------
// One pyramid grows from each face of a unit cube. The spike base is a square so
// each pyramid contributes 4 triangular faces.
export function spikyCubeGeo() {
  const h = 0.5;
  const s = 0.52; // spike height — about equal to the cube half-side
  const v = [
    -h,-h,-h,  h,-h,-h,  h, h,-h, -h, h,-h, // 0-3 back (-Z)
    -h,-h, h,  h,-h, h,  h, h, h, -h, h, h, // 4-7 front (+Z)
     0,  0, h+s, //  8 +Z tip
     0,  0,-h-s, //  9 -Z tip
     h+s,0,  0,  // 10 +X tip
    -h-s,0,  0,  // 11 -X tip
     0, h+s, 0,  // 12 +Y tip
     0,-h-s, 0,  // 13 -Y tip
  ];
  return buildFlat(v, [
    // base cube (12 tris)
    [4,5,6],[4,6,7], [1,0,3],[1,3,2],
    [5,1,2],[5,2,6], [0,4,7],[0,7,3],
    [3,7,6],[3,6,2], [0,1,5],[0,5,4],
    // +Z spike — corners 4,5,6,7 → tip 8
    [4,5,8],[5,6,8],[6,7,8],[7,4,8],
    // -Z spike — corners 0,1,2,3 → tip 9
    [1,0,9],[0,3,9],[3,2,9],[2,1,9],
    // +X spike — corners 1,5,6,2 → tip 10
    [1,5,10],[5,6,10],[6,2,10],[2,1,10],
    // -X spike — corners 0,3,7,4 → tip 11
    [0,3,11],[3,7,11],[7,4,11],[4,0,11],
    // +Y spike — corners 3,2,6,7 → tip 12
    [3,2,12],[2,6,12],[6,7,12],[7,3,12],
    // -Y spike — corners 0,1,5,4 → tip 13
    [0,1,13],[1,5,13],[5,4,13],[4,0,13],
  ]);
}

// --- Star tetrahedron (16 tris: 4 base + 4 spikes × 3 tris) ------------------
// Triangular pyramid erupts from each face — the "stellated" tetrahedron look.
export function starTetraGeo() {
  const base = scaleToRadius([1,1,1, 1,-1,-1, -1,1,-1, -1,-1,1], 0.62);
  const faces = [[0,1,2],[0,3,1],[0,2,3],[1,3,2]];
  const { v, f } = spiked(base, faces, 0.55);
  return buildFlat(v, f);
}

// --- Spiked sphere (80 tris: 20 base + 20 spikes × 3 tris) ------------------
// Icosahedron with a spike extruded from every face — reads as a
// Mandelbulb / sea-urchin cluster when spinning.
export function spikeSphereGeo() {
  const t = (1 + Math.sqrt(5)) / 2;
  const base = scaleToRadius([
    -1, t, 0,  1, t, 0,  -1,-t, 0,  1,-t, 0,
     0,-1, t,  0, 1, t,   0,-1,-t,  0, 1,-t,
     t, 0,-1,  t, 0, 1,  -t, 0,-1, -t, 0, 1,
  ], 0.45);
  const faces = [
    [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
    [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
    [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
    [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
  ];
  const { v, f } = spiked(base, faces, 0.38);
  return buildFlat(v, f);
}

// Builders indexed by obstacle type (0/1/2). TYPE_RADIUS is the collision
// half-extent at scale=1 — kept at the core body size, not spike tips, so
// players can thread past spike tips for satisfying near-misses.
export const PRIMITIVE_BUILDERS = [spikyCubeGeo, starTetraGeo, spikeSphereGeo];
export const TYPE_RADIUS = [0.55, 0.58, 0.50];
