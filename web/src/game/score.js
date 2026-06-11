// Run state: distance fallen (the score), elapsed time, and the fall-speed ramp.
// Depth is in world units; the HUD shows it as "metres".

import { CONFIG } from './config.js';

export function createRun() {
  return { depth: 0, speed: CONFIG.startSpeed, time: 0, alive: false, best: 0 };
}

export function startRun(run) {
  run.depth = 0;
  run.speed = CONFIG.startSpeed;
  run.time = 0;
  run.alive = true;
}

export function updateRun(run, dt) {
  run.time += dt;
  run.speed = Math.min(CONFIG.maxSpeed, CONFIG.startSpeed + CONFIG.accelPerSec * run.time);
  run.depth += run.speed * dt;
}

export function endRun(run) {
  run.alive = false;
  if (run.depth > run.best) run.best = run.depth;
}
