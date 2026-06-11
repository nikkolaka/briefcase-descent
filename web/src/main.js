// Briefcase Descent — entry point. Wires the renderer, the instanced obstacle
// batches, the box-man, the camera rig and the pure simulation together behind a
// fixed 30 fps loop and a tiny TITLE / PLAY / DEAD state machine.

import { Transform, Mesh } from 'ogl';
import { createView } from './engine/renderer.js';
import { createLoop } from './engine/timestep.js';
import { createInput } from './engine/input.js';
import { detectTier } from './engine/capabilities.js';
import { spikyCubeGeo, starTetraGeo, spikeSphereGeo } from './engine/geometry.js';
import { InstancedBatch } from './engine/instanced.js';
import { primitiveProgram } from './shaders/primitive.js';
import { buildWorker } from './game/playerModel.js';
import { createCameraRig, updateCamera } from './game/camera.js';
import { createWorld } from './game/world.js';
import { createPlayer, updatePlayer, resetPlayer } from './game/player.js';
import { createRun, startRun, updateRun, endRun } from './game/score.js';
import { hits } from './game/collision.js';
import { backgroundColor, LEVEL_DEPTH } from './game/palette.js';

const titleEl = document.getElementById('title');
const subEl = document.getElementById('sub');
const hintEl = document.getElementById('hint');
const statsEl = document.getElementById('stats');
const fpsEl = document.getElementById('fps');
const centerEl = document.getElementById('center');

// --- view + capability tier ---------------------------------------------------
const canvas = document.getElementById('gl');
const view = createView(canvas);
const { renderer, gl, camera } = view;

if (!renderer.isWebgl2) {
  titleEl.textContent = 'WebGL2 required';
  subEl.textContent = 'This browser/webview has no WebGL2 context.';
  throw new Error('WebGL2 unavailable');
}

const tier = detectTier(gl);
renderer.dpr = tier.dpr;
view.resize();
console.log('[BriefcaseDescent] render tier:', tier.name, '| renderer:', tier.renderer);

// --- scene --------------------------------------------------------------------
const scene = new Transform();
const prim = primitiveProgram(gl);

// One instanced batch per obstacle type; index matches obstacle.type (0/1/2).
const batches = [spikyCubeGeo(), starTetraGeo(), spikeSphereGeo()].map((geo) => new InstancedBatch(gl, geo));
for (const b of batches) {
  const mesh = new Mesh(gl, { geometry: b.geometry, program: prim });
  mesh.frustumCulled = false; // instance offsets live in the shader, not the bounds
  mesh.setParent(scene);
}

const worker = buildWorker(gl);
worker.group.setParent(scene);

// --- game state ---------------------------------------------------------------
const STATE = { TITLE: 0, PLAY: 1, DEAD: 2 };
let state = STATE.TITLE;
let uTime = 0;

const world = createWorld();
const player = createPlayer();
const run = createRun();
const rig = createCameraRig();
const input = createInput();

function repack() {
  for (const b of batches) b.begin();
  world.slabs.forEach((list) => {
    for (let i = 0; i < list.length; i++) {
      batches[list[i].type].add(list[i]);
    }
  });
  for (const b of batches) b.commit();
}

function startGame() {
  state = STATE.PLAY;
  resetPlayer(player);
  rig.x = 0;
  rig.y = 0;
  startRun(run);
  world.reset();
  world.ensure(0);
  repack();
  world.clearDirty();
}

// Populate the title-screen field so the menu isn't empty.
world.ensure(0);
repack();
world.clearDirty();

function placeWorker() {
  const w = worker.group;
  if (state === STATE.PLAY) {
    w.position.set(player.x, player.y, -run.depth);
    w.rotation.z = -player.lean * 0.5; // bank into horizontal moves
    w.rotation.x = 0.18 + player.pitch * 0.35; // head-first falling tilt
    w.rotation.y = player.lean * 0.25;
  } else {
    const bob = Math.sin(uTime * 1.6) * 0.08;
    w.position.set(0, bob, -run.depth);
    w.rotation.z = Math.sin(uTime * 0.8) * 0.08;
    w.rotation.x = 0.1;
    w.rotation.y = Math.sin(uTime * 0.5) * 0.3;
  }
}

function setFog(color) {
  prim.uniforms.uFogColor.value = color;
  worker.program.uniforms.uFogColor.value = color;
}

function updateHud(frameMs) {
  const lvl = (run.depth / LEVEL_DEPTH | 0) + 1;
  statsEl.textContent =
    `LVL   ${lvl}\n` +
    `DEPTH ${run.depth | 0} m\n` +
    `SPEED ${(run.speed * 3.6) | 0} km/h\n` +
    `BEST  ${run.best | 0} m`;
  fpsEl.textContent = `30fps cap · ${frameMs.toFixed(1)} ms\n${tier.name} tier · ${world.count()} obj`;

  if (state === STATE.PLAY) {
    centerEl.classList.add('hidden');
    return;
  }
  centerEl.classList.remove('hidden');
  if (state === STATE.TITLE) {
    titleEl.textContent = 'BRIEFCASE DESCENT';
    subEl.textContent = 'The quarterly review ran long. Reality gave out. Keep falling.';
    hintEl.innerHTML =
      '<span class="key">WASD</span> / <span class="key">Arrows</span> dodge — <span class="key">Enter</span> dive';
  } else {
    const lvl = (run.depth / LEVEL_DEPTH | 0) + 1;
    titleEl.textContent = 'SPLAT';
    subEl.textContent = `Level ${lvl} — ${run.depth | 0} m descended.`;
    hintEl.innerHTML = `Best ${run.best | 0} m — <span class="key">Enter</span> to dive again`;
  }
}

function update(dt) {
  uTime += dt;

  if (state !== STATE.PLAY && input.consumePress(['Enter', 'Space', 'KeyR'])) {
    startGame();
  }

  if (state === STATE.PLAY) {
    updatePlayer(player, input.axis(), dt);
    updateRun(run, dt);
    world.ensure(run.depth);
    if (world.dirty) {
      repack();
      world.clearDirty();
    }
    if (hits(player, world.near(run.depth), run.depth)) {
      endRun(run);
      state = STATE.DEAD;
      input.clearPresses(); // the fatal keypress shouldn't instantly restart
    }
  }

  updateCamera(camera, rig, player, run.depth, dt);
  placeWorker();

  const bg = backgroundColor(run.depth);
  gl.clearColor(bg[0], bg[1], bg[2], 1);
  setFog(bg);
  prim.uniforms.uTime.value = uTime;
}

const loop = createLoop(
  (dt) => update(dt),
  () => {
    renderer.render({ scene, camera });
    updateHud(loop.frameMs);
  },
);

// Clicking/tapping also starts a run — handy inside pywebview.
canvas.addEventListener('pointerdown', () => {
  if (state !== STATE.PLAY) startGame();
});

loop.start();
