// Headless smoke test for the pure simulation layer (no WebGL needed).
// Run: node test/sim-smoke.mjs   — exits non-zero on any failure.

import { mulberry32, slabRng } from '../src/engine/rng.js';
import { sierpinskiGeo, mandelbulbGeo, mandelboxGeo, N_TYPES } from '../src/engine/geometry.js';
import { genSlab } from '../src/engine/obstacles.js';
import { createWorld } from '../src/game/world.js';
import { createPlayer, updatePlayer, resetPlayer } from '../src/game/player.js';
import { createRun, startRun, updateRun } from '../src/game/score.js';
import { hits } from '../src/game/collision.js';
import { CONFIG } from '../src/game/config.js';

let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log('  ok  -', msg); }
  else { console.error('  FAIL-', msg); failures++; }
}
const finite = (n) => Number.isFinite(n);

// --- geometry ---------------------------------------------------------------
console.log('geometry:');
for (const [name, geo] of [
  ['sierpinski',  sierpinskiGeo(2)],
  ['mandelbulb8', mandelbulbGeo(10, 0.62, 8)],
  ['mandelbox',   mandelboxGeo(10)],
]) {
  ok(geo.position.length > 0, `${name} has triangles`);
  ok(geo.normal.length === geo.position.length, `${name} normal count matches`);
  let unit = true;
  for (let i = 0; i < geo.normal.length; i += 3) {
    const l = Math.hypot(geo.normal[i], geo.normal[i + 1], geo.normal[i + 2]);
    if (Math.abs(l - 1) > 1e-4) unit = false;
  }
  ok(unit, `${name} normals are unit length`);
}

// --- rng determinism --------------------------------------------------------
console.log('rng:');
{
  const a = mulberry32(123), b = mulberry32(123);
  let same = true;
  for (let i = 0; i < 8; i++) if (a() !== b()) same = false;
  ok(same, 'same seed -> identical stream');
  const c = mulberry32(124);
  ok(slabRng(5)() === slabRng(5)() && c() !== mulberry32(123)(), 'different seeds differ');
}

// --- obstacle generation ----------------------------------------------------
console.log('obstacles:');
{
  ok(genSlab(-1).length === 0, 'slab above start (-1) is empty');
  ok(genSlab(-5).length === 0, 'all negative slabs empty');
  const a = genSlab(7), b = genSlab(7);
  ok(a.length === b.length && a.length > 0, 'slab 7 non-empty + stable length');
  let identical = a.length === b.length;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].z !== b[i].z || a[i].type !== b[i].type) identical = false;
  }
  ok(identical, 'slab 7 regenerates identically');

  let allFinite = true, typesOk = true, inArena = true;
  for (const s of [genSlab(2), genSlab(50), genSlab(400)]) {
    for (const o of s) {
      if (![o.x, o.y, o.z, o.scale, o.radius, o.qw].every(finite)) allFinite = false;
      if (o.type < 0 || o.type >= N_TYPES) typesOk = false;
      if (Math.abs(o.x) > CONFIG.arena + 1 || Math.abs(o.y) > CONFIG.arena + 1) inArena = false;
    }
  }
  ok(allFinite, 'obstacle fields all finite');
  ok(typesOk, `obstacle types in 0..${N_TYPES - 1}`);
  ok(inArena, 'obstacles within the arena cross-section');

  // Difficulty ramp: deep slabs should be at least as dense on average as shallow.
  const density = (lo, hi) => {
    let n = 0; for (let i = lo; i < hi; i++) n += genSlab(i).length;
    return n / (hi - lo);
  };
  ok(density(400, 460) > density(3, 63), 'deep slabs are denser than early ones');
}

// --- world streaming --------------------------------------------------------
console.log('world:');
{
  const w = createWorld();
  w.ensure(0);
  const expected = CONFIG.slabsBehind + CONFIG.slabsAhead + 1;
  ok(w.slabs.size === expected, `covers ${expected} slabs around the player`);
  ok(w.dirty, 'dirty after first ensure');
  w.clearDirty();
  w.ensure(1); // same front slab -> no change
  ok(!w.dirty, 'no re-gen when still in the same slab');
  w.ensure(CONFIG.slabDepth * 6);
  ok(w.dirty && w.slabs.size === expected, 'window slides forward, size stable');
  ok(Array.isArray(w.near(CONFIG.slabDepth * 6)), 'near() returns an array');
  ok(!w.slabs.has(-2), 'old slabs are evicted');
}

// --- full deterministic run -------------------------------------------------
console.log('run:');
{
  function simulate(ticks) {
    const w = createWorld(), p = createPlayer(), run = createRun();
    startRun(run);
    let collisions = 0;
    const dt = 1 / 30;
    for (let i = 0; i < ticks; i++) {
      // scripted weaving input so movement code exercises both axes + walls
      const axis = { x: Math.sin(i * 0.07), y: Math.cos(i * 0.05) };
      updatePlayer(p, axis, dt);
      updateRun(run, dt);
      w.ensure(run.depth);
      if (hits(p, w.near(run.depth), run.depth)) collisions++;
    }
    return { depth: run.depth, px: p.x, py: p.y, speed: run.speed, collisions };
  }
  const r1 = simulate(900);
  const r2 = simulate(900);
  ok(finite(r1.depth) && r1.depth > 0, 'depth advances and stays finite');
  ok(Math.abs(r1.px) <= CONFIG.arena + 1e-6 && Math.abs(r1.py) <= CONFIG.arena + 1e-6, 'player stays inside walls');
  ok(r1.speed <= CONFIG.maxSpeed + 1e-6 && r1.speed > CONFIG.startSpeed, 'speed ramps but caps');
  ok(r1.depth === r2.depth && r1.px === r2.px && r1.collisions === r2.collisions, 'whole run is deterministic');
  console.log(`     (depth=${r1.depth.toFixed(0)}m, speed=${r1.speed.toFixed(1)}, collisions=${r1.collisions})`);
}

console.log('');
if (failures) { console.error(`${failures} check(s) FAILED`); process.exit(1); }
console.log('all simulation checks passed');
