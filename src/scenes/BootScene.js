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
