import Phaser from 'phaser';
import { CFG, WORLDS } from '../config.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = CFG.WIDTH / 2;

    // Preview the split worlds
    this.add.rectangle(cx, 135, CFG.WIDTH, 270, WORLDS.light.bg);
    this.add.rectangle(cx, 405, CFG.WIDTH, 270, WORLDS.dark.bg);
    this.add.rectangle(cx, 270, CFG.WIDTH, 4, 0x888888);

    this.add
      .text(cx, 90, 'SHADOW RUNNER', {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#1d1d24',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 160, 'Two worlds. Two runners. One mistake ends both.', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 215, 'W / \u2191  jump LIGHT runner (top)        Mobile: tap top half', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 320, 'S / \u2193  jump DARK runner (bottom)      Mobile: tap bottom half', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f2f0e8',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 365, 'When worlds SYNC, one input jumps both.\nFreeze power-up pauses the other world (no score while frozen).', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f2f0e8',
        align: 'center',
      })
      .setOrigin(0.5);

    const best = Number(localStorage.getItem(CFG.BEST_KEY) || 0);
    if (best > 0) {
      this.add
        .text(cx, 425, `BEST: ${best}`, {
          fontFamily: 'monospace',
          fontSize: '20px',
          color: '#ffd34d',
        })
        .setOrigin(0.5);
    }

    const prompt = this.add
      .text(cx, 480, 'PRESS ANY KEY OR TAP TO RUN', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f2f0e8',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

    this.input.keyboard.once('keydown', () => this.scene.start('Game'));
    this.input.once('pointerdown', () => this.scene.start('Game'));
  }
}
