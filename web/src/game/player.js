// Player lateral motion in the X/Y plane (the descent is automatic along -Z).
// Velocity eases toward the input target and bleeds off when released, giving a
// weighty-but-responsive feel. `lean`/`pitch` drive the model's banking juice.

import { CONFIG } from './config.js';

function approach(cur, tgt, maxDelta) {
  const d = tgt - cur;
  if (Math.abs(d) <= maxDelta) return tgt;
  return cur + Math.sign(d) * maxDelta;
}

export function createPlayer() {
  return { x: 0, y: 0, vx: 0, vy: 0, lean: 0, pitch: 0 };
}

export function updatePlayer(p, axis, dt) {
  const A = CONFIG.arena;

  p.vx = axis.x !== 0
    ? approach(p.vx, axis.x * CONFIG.latMaxSpeed, CONFIG.latAccel * dt)
    : approach(p.vx, 0, CONFIG.latDamping * dt);
  p.vy = axis.y !== 0
    ? approach(p.vy, axis.y * CONFIG.latMaxSpeed, CONFIG.latAccel * dt)
    : approach(p.vy, 0, CONFIG.latDamping * dt);

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  if (p.x < -A) { p.x = -A; p.vx = 0; }
  if (p.x > A) { p.x = A; p.vx = 0; }
  if (p.y < -A) { p.y = -A; p.vy = 0; }
  if (p.y > A) { p.y = A; p.vy = 0; }

  p.lean = Math.max(-1, Math.min(1, p.vx / CONFIG.latMaxSpeed));
  p.pitch = Math.max(-1, Math.min(1, p.vy / CONFIG.latMaxSpeed));
  return p;
}

export function resetPlayer(p) {
  p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.lean = 0; p.pitch = 0;
}
