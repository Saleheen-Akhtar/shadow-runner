import Phaser from 'phaser';
import { CFG } from '../config.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.finalScore = data.score ?? 0;
    this.best = data.best ?? 0;
    this.isNewBest = data.isNewBest ?? false;
  }

  create() {
    const cx = CFG.WIDTH / 2;

    this.add
      .text(cx, 150, 'RUN OVER', {
        fontFamily: 'monospace',
        fontSize: '52px',
        color: '#d33a3a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 240, `SCORE  ${this.finalScore}`, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#f2f0e8',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 290, this.isNewBest ? 'NEW BEST!' : `BEST  ${this.best}`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffd34d',
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, 400, 'TAP OR PRESS ANY KEY TO RUN AGAIN', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#f2f0e8',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: prompt, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

    // Small delay so a late jump input doesn't instantly restart.
    this.time.delayedCall(400, () => {
      this.input.keyboard.once('keydown', () => this.scene.start('Game'));
      this.input.once('pointerdown', () => this.scene.start('Game'));
    });
  }
}
