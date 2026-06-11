// OGL renderer + camera setup and viewport handling. dpr starts at 1 and is
// lowered by the capability tier after the GL context exists (we need the context
// to sniff the renderer). antialias is off — it's expensive on weak GPUs and the
// faceted low-poly look doesn't need it.

import { Renderer, Camera } from 'ogl';

export function createView(canvas) {
  const renderer = new Renderer({
    canvas,
    dpr: 1,
    alpha: false,
    antialias: false,
    stencil: false,
    powerPreference: 'high-performance',
  });
  const gl = renderer.gl;
  gl.clearColor(0.02, 0.02, 0.04, 1);

  const camera = new Camera(gl, { fov: 62, near: 0.1, far: 360 });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h); // uses renderer.dpr internally
    camera.perspective({ aspect: w / h });
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, gl, camera, resize };
}
