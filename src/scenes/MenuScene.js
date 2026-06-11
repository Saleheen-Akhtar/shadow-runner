import Phaser from 'phaser';
import { CFG, WORLDS } from '../config.js';
import Runner from '../entities/Runner.js';

const TITLE_FONT = '"Arial Black", Impact, sans-serif';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = CFG.WIDTH / 2;

    // Split-world backdrop with gradients.
    Object.values(WORLDS).forEach((def) => {
      const sky = this.add.graphics();
      sky.fillGradientStyle(def.skyTop, def.skyTop, def.skyBottom, def.skyBottom, 1);
      sky.fillRect(0, def.top, CFG.WIDTH, def.height);
      this.add.rectangle(cx, def.groundY + 15, CFG.WIDTH, 30, def.ground);
    });
    this.add.rectangle(cx, 270, CFG.WIDTH, 4, 0x888888);

    // Title split across both worlds.
    this.add
      .text(cx + 3, 78, 'SHADOW', { fontFamily: TITLE_FONT, fontSize: '64px', color: '#00000022' })
      .setOrigin(0.5);
    this.add
      .text(cx, 75, 'SHADOW', { fontFamily: TITLE_FONT, fontSize: '64px', color: '#1d1d24' })
      .setOrigin(0.5);
    this.add
      .text(cx + 3, 348, 'RUNNER', { fontFamily: TITLE_FONT, fontSize: '64px', color: '#00000055' })
      .setOrigin(0.5);
    this.add
      .text(cx, 345, 'RUNNER', { fontFamily: TITLE_FONT, fontSize: '64px', color: '#f2f0e8' })
      .setOrigin(0.5);

    this.add
      .text(cx, 130, 'Two worlds. Two runners. One mistake ends both.', {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 168, 'W / \u2191  jump top runner      Mobile: tap top half', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 400, 'S / \u2193  jump bottom runner      Mobile: tap bottom half', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f2f0e8',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 432, 'SYNC: one input jumps both \u2022 Freeze orb pauses the other world', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#b8b6c4',
      })
      .setOrigin(0.5);

    // Two live runners jogging in place.
    this.runners = Object.values(WORLDS).map(
      (def) =>
        new Runner(this, 140, def.groundY, def.runnerBody, def.runnerAccent, def.runnerEye)
    );

    const best = Number(localStorage.getItem(CFG.BEST_KEY) || 0);
    if (best > 0) {
      this.add
        .text(cx, 462, `BEST: ${best}`, {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: '#ffd34d',
        })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(cx, 500, 'PRESS ANY KEY OR TAP TO RUN', {
        fontFamily: 'monospace',
        fontSize: '21px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

    this.input.keyboard.once('keydown', () => this.scene.start('Game'));
    this.input.once('pointerdown', () => this.scene.start('Game'));
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.runners.forEach((r) => r.update(dt, 0.35));
  }
}
