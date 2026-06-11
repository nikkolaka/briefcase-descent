// Broadphase-free collision: the world only hands us obstacles within ~1 slab of
// the player, so a flat scan with a cheap depth gate + lateral box test is plenty.
// The lateral test is intentionally forgiving (0.7x) so near-misses feel fair.

import { CONFIG } from './config.js';

export function hits(player, near, depth) {
  const pz = -depth; // player's world-Z (descent runs along -Z)
  const pr = CONFIG.playerRadius;

  for (let i = 0; i < near.length; i++) {
    const o = near[i];
    if (Math.abs(o.z - pz) > o.halfDepth + pr) continue; // not at this depth yet
    const lat = o.radius + pr * 0.7;
    if (Math.abs(player.x - o.x) < lat && Math.abs(player.y - o.y) < lat) {
      return o;
    }
  }
  return null;
}
