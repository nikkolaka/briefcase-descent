# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Briefcase Descent** — a hyper-lightweight low-poly 3D faller game. A box-man office worker falls infinitely through fractal obstacle fields; the player dodges with WASD/arrows while speed ramps. Runs in any browser and as a native desktop window via **pywebview** (Windows + Linux). The whole web bundle is ~22 KB gzipped.

## Commands

All web commands run from `web/`:

```bash
# Development (browser, hot-reload)
cd web && npm install && npm run dev       # http://localhost:5173

# Production build (required before running the desktop app)
cd web && npm run build                   # outputs web/dist/

# Headless simulation tests (no browser or WebGL needed)
cd web && node test/sim-smoke.mjs

# Run as a desktop app (after building)
cd web && npm run build && cd ..
pip install -r requirements.txt
python app.py

# Linux: prefer Chromium/QtWebEngine for reliable WebGL2
pip install PyQt6 PyQt6-WebEngine
BD_GUI=qt python app.py

# Enable pywebview devtools
BD_DEBUG=1 python app.py
```

There is no linter configured. There are no other test commands.

## Architecture

### Separation of concerns

`web/src/engine/` contains reusable, game-agnostic pieces with **zero WebGL imports** in the pure-logic files (`rng.js`, `obstacles.js`). `web/src/game/` contains game-specific logic, also WebGL-free except for `playerModel.js`. This split makes `sim-smoke.mjs` possible: all of the simulation (RNG, obstacle generation, world streaming, player physics, collision, scoring) is tested headlessly in Node.

`web/src/main.js` is the only file that wires the two halves together and touches the GPU.

### Frame loop

`engine/timestep.js` runs a **fixed 30 Hz timestep** via a `requestAnimationFrame` accumulator. `update(DT)` always receives the constant `DT = 1/30` regardless of display refresh rate — this is what keeps descent speed identical across 60/144 Hz displays and weak hardware. `loop.frameMs` exposes last-frame cost for the future auto-scaler (M5).

### Infinite world / slab streaming

The fall axis is divided into fixed-size "slabs" (`CONFIG.slabDepth = 14` units). `world.js` keeps a sliding window of `slabsBehind + slabsAhead + 1 = 13` live slabs in a `Map<index, obstacle[]>`. When the window advances, evicted slabs are deleted and new ones generated via `genSlab(index)` in `obstacles.js`. Generation is **deterministic** — `slabRng(index)` gives the same PRNG stream for any index, so the world can be regenerated from scratch with no stored state.

### Instanced rendering pipeline

One `InstancedBatch` per obstacle type (spiky cube / star tetra / spike sphere). Each batch pre-allocates `Float32Array` buffers at construction (`capacity = 1024`) and never allocates per frame. When `world.dirty` is set, `repack()` in `main.js` calls `batch.begin()` → `batch.add(o)` for every live obstacle → `batch.commit()`, which sets `instancedCount` and marks instanced attributes `needsUpdate`. The GPU sees **one draw call per obstacle type**.

### Capability tiers

`engine/capabilities.js` reads `WEBGL_debug_renderer_info` at startup. If the renderer string matches software rasterizers (SwiftShader, llvmpipe, etc.), it returns the `low` tier: `dpr = 0.75`, `godrays = false`, `backdrop = false`. The `high` tier caps `dpr` at the native device pixel ratio (max 1). M4 effects (`tier.godrays`, `tier.backdrop`) are not yet implemented — they gate on these flags when added.

### Shaders

GLSL is inline in JS files as tagged template literals (`/* glsl */`). Both shaders apply a **PS1-style clip-space vertex snap** (`const float PS1_SNAP = 160.0`) — lower values = more jitter.

- `shaders/primitive.js`: instanced shader for all obstacles. Uniforms: `uTime` (for spin animation), `uFogColor`, `uFogDensity`. Instance attributes: `iOffset`, `iScale`, `iQuat`, `iSpin` (axis + rate), `iColor`.
- `shaders/worker.js`: per-vertex `color` attribute lets all body parts share one program. Auto-supplied OGL uniforms: `modelViewMatrix`, `projectionMatrix`, `normalMatrix`.

### Geometry

`engine/geometry.js` builds **non-indexed triangle soups** (one face normal per vertex = flat shading). The `spiked(verts, faces, spikeH)` helper extrudes a triangular pyramid from every face of any origin-centered mesh — used by all three obstacle types. Adding a new obstacle type means adding a builder function, appending it to `PRIMITIVE_BUILDERS` and `TYPE_RADIUS`, and creating a new `InstancedBatch` in `main.js`.

### Color / level system

`game/palette.js` defines 12 discrete hue values (`LEVEL_HUES`) and `LEVEL_DEPTH = 200` (world units per level). Both `obstacleColor(depth, salt)` and `backgroundColor(depth)` compute `level = floor(depth / LEVEL_DEPTH)` internally — no level state is passed around. Obstacle hue = `LEVEL_HUES[level] ± salt offset`; background = complementary hue, very dark.

### pywebview shell

`app.py` opens `web/dist/index.html` via `file://` (why `vite.config.js` has `base: './'` — without it, asset paths break). The `Api` class is exposed as `window.pywebview.api.*` for score persistence and fullscreen. A `localStorage` fallback is expected in JS (M7) so plain-browser dev still works. `sys._MEIPASS` handling in `app.py` supports PyInstaller packaging (M8).

## Key tuning locations

- `web/src/game/config.js` — arena size, slab depth, fall-speed ramp, lateral handling
- `web/src/game/palette.js` — `LEVEL_HUES`, `LEVEL_DEPTH`, saturation/lightness of obstacles and background
- `web/src/engine/obstacles.js` — grid density (`G` range), `fillProb`, gate count per slab
- `web/src/shaders/primitive.js` and `worker.js` — `PS1_SNAP` constant (both files must match)
- `web/src/engine/instanced.js` — `capacity` (default 1024, raise if > 1024 obstacles visible)

## Pending milestones

- **M4** — Volumetric god-rays via OGL `Post`/`RenderTarget` (half-res), low-res SDF fractal backdrop; both gated on `tier.godrays` / `tier.backdrop`
- **M5** — Runtime auto-scaler: rolling avg `loop.frameMs > 33` for N frames → step down tier
- **M6** — Swap box-man for authored `.glb` via OGL `GLTFLoader` in `playerModel.js`
- **M7** — Wire `window.pywebview.api.load_score` / `save_score` in `main.js`; localStorage fallback
- **M8** — PyInstaller `.spec` files for Windows `.exe` and Linux binary (bundling QtWebEngine)
