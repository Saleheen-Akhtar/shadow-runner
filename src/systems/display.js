import { CFG, DPR } from '../config.js';

// Zooms the scene camera so the 960x540 design space fills the
// DPR-scaled canvas, and re-renders all text at high resolution.
// Call at the END of a scene's create(), after all objects exist.
export function applyHiDpi(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(DPR);
  cam.centerOn(CFG.WIDTH / 2, CFG.HEIGHT / 2);

  scene.children.list.forEach((child) => {
    if (child.style && typeof child.setResolution === 'function') {
      child.setResolution(DPR * 1.25);
    }
  });
}
