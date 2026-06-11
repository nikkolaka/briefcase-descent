# Briefcase Descent

A hyper-lightweight low-poly faller. A burnt-out office worker steps through the
wall and plummets through an infinite, procedurally-generated fractal field of
cubes, tetrahedra and spheres — dodge with WASD/arrows as he slowly speeds up.

Custom WebGL2 engine (on the tiny [OGL](https://github.com/oframe/ogl) library),
**locked at 30 fps**, built to run on weak laptops. Ships as a desktop app via
**pywebview** (Windows + Linux). The whole web bundle is ~20 KB gzipped.

## Controls
- **WASD / Arrow keys** — dodge
- **Enter / Space / click** — dive / restart

## Layout
```
web/                     The engine + game (runs in any browser or in pywebview)
  src/
    engine/              Reusable, game-agnostic pieces
      timestep.js          fixed 30 fps loop (the frame cap + determinism)
      renderer.js          OGL renderer/camera + resize
      input.js             WASD/arrows + one-shot action keys
      capabilities.js      software-GL detection -> render tier
      geometry.js          flat-shaded cube / tetra / icosahedron
      instanced.js         one instanced draw call per primitive type
      obstacles.js         deterministic per-slab fractal generators
      rng.js               seeded PRNG
    game/                Game-specific logic (engine/* has no dependency on these)
      config.js            all tuning in one place
      world.js             infinite slab streaming + pooling
      player.js            lateral movement + lean (pure)
      collision.js         broadphase-free hit test (pure)
      score.js             depth + fall-speed ramp (pure)
      camera.js            third-person follow rig
      palette.js           depth-driven "LSD" hue cycling (pure)
      playerModel.js       placeholder box-man (M6 swaps for a .glb)
    shaders/             GLSL (primitive instanced shader, worker shader)
    main.js              wiring + TITLE/PLAY/DEAD state machine
  test/sim-smoke.mjs     headless tests for the pure simulation layer
app.py                   pywebview desktop shell + score persistence
requirements.txt         Python deps
```
The `game/` simulation modules import no WebGL, so they're unit-tested headlessly
and the renderer is a thin layer that reflects sim state onto the GPU.

## Develop
```bash
cd web
npm install
npm run dev        # http://localhost:5173 — fast iteration in a browser
node test/sim-smoke.mjs   # headless checks for the deterministic sim layer
```

## Run as a desktop app
```bash
cd web && npm install && npm run build && cd ..
pip install -r requirements.txt
python app.py
```
**Linux + weak GPU:** prefer the Chromium/QtWebEngine backend so WebGL2 is
hardware-accelerated instead of falling back to software:
```bash
pip install PyQt6 PyQt6-WebEngine
BD_GUI=qt python app.py
```

## Performance model
- **30 fps is a hard cap *and* the simulation timestep** — gameplay runs at the
  same speed on every machine, and weak GPUs get the spare frame budget.
- **Capability tiers** (`engine/capabilities.js`): if the webview reports a
  software rasterizer (SwiftShader / llvmpipe), the `low` tier drops dpr and the
  heavier effects. A runtime auto-scaler (M5) will react to frame time too.
- Obstacles are **instanced** (one draw call per type); the infinite world is a
  recycled ring of deterministic slabs, so there's no per-frame allocation.

## Tuning
Almost everything lives in `web/src/game/config.js` — arena size, slab depth,
fall-speed ramp, lateral handling, difficulty curve. The "trip" palette is in
`web/src/game/palette.js`.

## Roadmap (milestones)
- **M0–M3** ✅ engine loop, falling core, instanced obstacles + collision,
  fog/palette/lean.
- **M3 (cont.)** more fractal generators (kaleidoscope, sphere-packing), the
  intro "step through the wall" room.
- **M4** volumetric god-rays post pass + low-res SDF fractal backdrop.
- **M5** runtime auto-scaler on top of tier detection.
- **M6** authored low-poly `.glb` hero (patterned shirt, belt, khakis, briefcase)
  via OGL's `GLTFLoader`.
- **M7** score persistence through `pywebview` js_api, menu polish, optional
  generative WebAudio.
- **M8** PyInstaller Windows + Linux (QtWebEngine) builds.
