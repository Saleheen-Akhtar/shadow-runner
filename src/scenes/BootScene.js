import Phaser from 'phaser';
import portal from '../platform/PortalAdapter.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // Generate a tiny white dot texture used by particle emitters.
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);
    g.destroy();

    // Soft radial glow texture for ambient particles and highlights.
    const glow = this.make.graphics({ x: 0, y: 0, add: false });
    glow.fillStyle(0xffffff, 1);
    glow.fillCircle(32, 32, 32);
    glow.fillStyle(0xffffff, 0.6);
    glow.fillCircle(32, 32, 20);
    glow.fillStyle(0xffffff, 0.3);
    glow.fillCircle(32, 32, 10);
    glow.generateTexture('glow', 64, 64);
    glow.destroy();

    // Small diamond spark for celebrations and fireworks.
    const spark = this.make.graphics({ x: 0, y: 0, add: false });
    spark.fillStyle(0xffffff, 1);
    spark.fillTriangle(8, 0, 16, 8, 8, 16);
    spark.fillTriangle(8, 0, 0, 8, 8, 16);
    spark.generateTexture('spark', 16, 16);
    spark.destroy();

    // Small square block texture for glitch trail.
    const block = this.make.graphics({ x: 0, y: 0, add: false });
    block.fillStyle(0xffffff, 1);
    block.fillRect(0, 0, 8, 8);
    block.generateTexture('block', 8, 8);
    block.destroy();

    // Dynamic monospace text textures for Matrix trail.
    let texture0 = this.textures.createCanvas('matrix_0', 16, 20);
    if (texture0) {
      texture0.context.font = 'bold 16px "JetBrains Mono", monospace';
      texture0.context.fillStyle = '#ffffff';
      texture0.context.fillText('0', 2, 16);
      texture0.refresh();
    }

    let texture1 = this.textures.createCanvas('matrix_1', 16, 20);
    if (texture1) {
      texture1.context.font = 'bold 16px "JetBrains Mono", monospace';
      texture1.context.fillStyle = '#ffffff';
      texture1.context.fillText('1', 2, 16);
      texture1.refresh();
    }

    // Remove the CSS loading screen.
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.transition = 'opacity 0.3s';
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 300);
    }

    portal.init().finally(() => {
      // Fade-in handled by MenuScene itself.
      this.scene.start('Menu');
    });
  }
}
