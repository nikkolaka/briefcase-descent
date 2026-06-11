// Detect the WebGL backend so we can degrade gracefully. The headline target is
// "extremely shitty laptops", and on Linux the system webview can fall back to a
// software rasterizer (SwiftShader / llvmpipe) where the volumetric pass would
// choke — so we sniff the renderer string and drop effects when it looks software.

export function detectTier(gl) {
  let renderer = 'unknown';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || renderer;
  } catch {
    /* some webviews block this — assume capable and let the auto-scaler react */
  }

  const software = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(renderer);
  const dpr = Math.min(window.devicePixelRatio || 1, 1);

  return {
    renderer,
    software,
    name: software ? 'low' : 'high',
    dpr: software ? 0.75 : dpr,
    godrays: !software, // M4 effects gate off this
    backdrop: !software,
  };
}
