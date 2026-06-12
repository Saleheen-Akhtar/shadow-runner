import Phaser from 'phaser';
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

// Smooth fade transition. direction = 'in' (black → clear) or 'out'
// (clear → black). Calls `callback` when done.
export function fadeTransition(scene, direction, duration = 350, callback) {
  const cx = CFG.WIDTH / 2;
  const cy = CFG.HEIGHT / 2;
  const ov = scene.add
    .rectangle(cx, cy, CFG.WIDTH + 40, CFG.HEIGHT + 40, 0x000000)
    .setDepth(999)
    .setAlpha(direction === 'in' ? 1 : 0);
  scene.tweens.add({
    targets: ov,
    alpha: direction === 'in' ? 0 : 1,
    duration,
    ease: 'Cubic.easeInOut',
    onComplete: () => {
      ov.destroy();
      if (callback) callback();
    },
  });
}

// Full-screen color flash (e.g. red on death, gold on milestone).
export function screenFlash(scene, color = 0xff0000, alpha = 0.3, duration = 200) {
  const cx = CFG.WIDTH / 2;
  const cy = CFG.HEIGHT / 2;
  const flash = scene.add
    .rectangle(cx, cy, CFG.WIDTH + 40, CFG.HEIGHT + 40, color, alpha)
    .setDepth(998);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => flash.destroy(),
  });
}

// Draw a glassmorphic rounded rectangle panel (semi-transparent bg + subtle border glow).
export function drawGlassPanel(scene, x, y, w, h, depth = 10) {
  const g = scene.add.graphics().setDepth(depth);
  // Outer glow
  g.fillStyle(0xffd34d, 0.04);
  g.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 20);
  // Main panel
  g.fillStyle(0x0a0a14, 0.88);
  g.fillRoundedRect(x, y, w, h, 16);
  // Border
  g.lineStyle(1.5, 0xffd34d, 0.25);
  g.strokeRoundedRect(x, y, w, h, 16);
  // Inner highlight (top edge)
  g.lineStyle(1, 0xffffff, 0.06);
  g.strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, 15);
  return g;
}

// Brief horizontal scanline glitch effect.
export function glitchFlash(scene, duration = 200) {
  const lines = [];
  const count = Phaser.Math.Between(5, 8);
  const tints = [0xff0044, 0x00ffff, 0xffffff];

  for (let i = 0; i < count; i++) {
    const y = Phaser.Math.Between(0, CFG.HEIGHT);
    const h = Phaser.Math.Between(2, 6);
    const offsetX = Phaser.Math.Between(-30, 30);
    const color = Phaser.Utils.Array.GetRandom(tints);
    const alpha = Phaser.Math.FloatBetween(0.3, 0.5);

    const line = scene.add
      .rectangle(CFG.WIDTH / 2 + offsetX, y, CFG.WIDTH + 60, h, color, alpha)
      .setDepth(997);
    lines.push(line);
  }

  scene.tweens.add({
    targets: lines,
    alpha: 0,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => lines.forEach((l) => l.destroy()),
  });
}

// Chromatic aberration-style flash.
export function chromaFlash(scene, duration = 250) {
  const cx = CFG.WIDTH / 2;
  const cy = CFG.HEIGHT / 2;

  const red = scene.add
    .rectangle(cx - 4, cy - 2, CFG.WIDTH + 40, CFG.HEIGHT + 40, 0xff0000, 0.08)
    .setDepth(997);

  const cyan = scene.add
    .rectangle(cx + 4, cy + 2, CFG.WIDTH + 40, CFG.HEIGHT + 40, 0x00ffff, 0.08)
    .setDepth(997);

  scene.tweens.add({
    targets: [red, cyan],
    alpha: 0,
    duration,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      red.destroy();
      cyan.destroy();
    },
  });
}
