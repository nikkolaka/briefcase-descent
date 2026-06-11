// Third-person follow rig: behind and above the worker, looking ahead and slightly
// down so the descent reads as "falling". The lateral follow is partial so the
// player can move within the frame instead of being glued to centre, and it's
// exponentially smoothed so the camera lags the worker with a bit of weight.

import { Vec3 } from 'ogl';

const target = new Vec3();

export function createCameraRig() {
  return { x: 0, y: 0 };
}

export function updateCamera(camera, rig, player, depth, dt) {
  const k = 1 - Math.exp(-dt * 7); // frame-rate independent smoothing
  rig.x += (player.x - rig.x) * k;
  rig.y += (player.y - rig.y) * k;

  const pz = -depth; // worker plane (descent runs along -Z)
  camera.position.set(rig.x * 0.55, rig.y * 0.55 + 2.6, pz + 9.0);
  target.set(rig.x * 0.35, rig.y * 0.35 - 1.4, pz - 7.0);
  camera.lookAt(target);
}
