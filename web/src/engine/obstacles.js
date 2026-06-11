// Procedural obstacle generation. Each slab is regenerated deterministically from
// its index, so the infinite world stores nothing. Every gate is guaranteed a
// passable opening; density grows and gaps shrink with depth (the difficulty ramp).
//
// Obstacle records are plain data (no GPU types) so this is unit-testable in Node.
// The render layer packs these into instanced attribute buffers.

import { CONFIG } from '../game/config.js';
import { slabRng } from './rng.js';
import { TYPE_RADIUS } from './geometry.js';
import { obstacleColor } from '../game/palette.js';

const TAU = Math.PI * 2;

function randomQuat(rng) {
  // Shoemake's uniform random quaternion.
  const u1 = rng(), u2 = rng(), u3 = rng();
  const s1 = Math.sqrt(1 - u1), s2 = Math.sqrt(u1);
  return [
    s1 * Math.sin(TAU * u2),
    s1 * Math.cos(TAU * u2),
    s2 * Math.sin(TAU * u3),
    s2 * Math.cos(TAU * u3),
  ];
}

function randomAxis(rng) {
  const z = rng() * 2 - 1;
  const a = rng() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
}

function pushObstacle(out, type, x, y, z, scale, rng, depth, salt) {
  const q = randomQuat(rng);
  const ax = randomAxis(rng);
  const c = obstacleColor(depth, salt);
  out.push({
    type, x, y, z, scale,
    qx: q[0], qy: q[1], qz: q[2], qw: q[3],
    // Per-instance spin axis + rate — animated cheaply in the vertex shader (M3).
    sx: ax[0], sy: ax[1], sz: ax[2], spin: (rng() * 2 - 1) * 0.55,
    r: c[0], g: c[1], b: c[2],
    radius: TYPE_RADIUS[type] * scale, // lateral collision half-extent
    halfDepth: scale * 0.55, // collision half-extent along the fall axis
  });
}

// A wall of cells across the shaft with a guaranteed rectangular gap to fly through.
// Sparser than before — fewer obstacles let the fractal geometry read clearly.
function gridGate(out, rng, baseDepth, localZ, intensity) {
  const A = CONFIG.arena;
  const G = 2 + Math.floor(intensity * 1.5 + rng() * 1.2); // 2..4 cells per side
  const cell = (A * 2) / G;
  const gapW = Math.max(1, Math.round((1 - intensity * 0.8) * (G - 1)));
  const gapX = Math.floor(rng() * (G - gapW + 1));
  const gapY = Math.floor(rng() * (G - gapW + 1));
  const fillProb = 0.30 + 0.40 * intensity; // sparser at all depths
  const depth = baseDepth + localZ;
  const z = -depth;

  for (let gx = 0; gx < G; gx++) {
    for (let gy = 0; gy < G; gy++) {
      const inGap = gx >= gapX && gx < gapX + gapW && gy >= gapY && gy < gapY + gapW;
      if (inGap) continue; // the guaranteed opening
      if (rng() > fillProb) continue; // extra openness, mostly early on
      const x = -A + (gx + 0.5) * cell;
      const y = -A + (gy + 0.5) * cell;
      const type = Math.floor(rng() * 3);
      const scale = cell * (0.62 + 0.22 * rng());
      pushObstacle(out, type, x, y, z, scale, rng, depth, gx * G + gy);
    }
  }
}

// Generate one slab's obstacles. Negative indices (above the start) are empty so
// the player gets a clear launch before the first gate.
export function genSlab(index) {
  const out = [];
  if (index < 0) return out;

  const rng = slabRng(index);
  const baseDepth = index * CONFIG.slabDepth;
  const intensity = Math.max(0, Math.min(1, baseDepth / CONFIG.rampDepth));

  // First couple of gates stay single so the opening is generous.
  const gates = index < 3 ? 1 : 1 + (rng() < 0.35 + intensity * 0.3 ? 1 : 0);
  for (let g = 0; g < gates; g++) {
    const localZ = ((g + 0.5) / gates) * CONFIG.slabDepth;
    gridGate(out, rng, baseDepth, localZ, intensity);
  }
  return out;
}
