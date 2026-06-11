// Fixed-timestep game loop — this is the "locked 30 fps" guarantee.
//
//  - Render is capped at 30 fps, which hands free headroom to weak hardware
//    instead of burning it drawing frames nobody asked for.
//  - update() always runs with a constant dt, so the descent accelerates at the
//    same real-world rate on a 60 Hz, a 144 Hz, or a struggling machine alike.
//    (A variable dt would make the game literally faster on faster displays.)

export const FPS = 30;
export const STEP_MS = 1000 / FPS;
export const DT = STEP_MS / 1000; // fixed timestep, in seconds

export function createLoop(update, render) {
  let acc = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  let frameMs = STEP_MS; // measured cost of the last update+render, for the auto-scaler

  function frame(now) {
    raf = requestAnimationFrame(frame);

    acc += now - last;
    last = now;

    if (acc < STEP_MS) return; // not yet a 30 Hz tick — skip this rAF (the cap)
    acc = Math.min(acc, STEP_MS * 3); // clamp after a stall so we don't spiral
    acc -= STEP_MS;

    const t0 = performance.now();
    update(DT);
    render(DT);
    frameMs = performance.now() - t0;
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    // Last frame's update+render cost in ms — the auto-scaler watches this.
    get frameMs() {
      return frameMs;
    },
  };
}
