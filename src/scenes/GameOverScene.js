import Phaser from 'phaser';
import { CFG } from '../config.js';

const TITLE_FONT = '"Arial Black", Impact, sans-serif';

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

    // Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x10101a, 0.88);
    panel.fillRoundedRect(cx - 230, 110, 460, 320, 18);
    panel.lineStyle(2, 0xffd34d, 0.6);
    panel.strokeRoundedRect(cx - 230, 110, 460, 320, 18);

    this.add
      .text(cx, 165, 'RUN OVER', {
        fontFamily: TITLE_FONT,
        fontSize: '46px',
        color: '#d33a3a',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 235, 'SCORE', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#8a8a9a',
      })
      .setOrigin(0.5);

    const scoreVal = this.add
      .text(cx, 275, '0', {
        fontFamily: TITLE_FONT,
        fontSize: '44px',
        color: '#f2f0e8',
      })
      .setOrigin(0.5);

    // Animated count-up.
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: this.finalScore,
      duration: Math.min(1200, 300 + this.finalScore),
      ease: 'Cubic.easeOut',
      onUpdate: () => scoreVal.setText(String(Math.floor(counter.v))),
    });

    const bestLabel = this.add
      .text(cx, 330, this.isNewBest ? 'NEW BEST!' : `BEST  ${this.best}`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffd34d',
      })
      .setOrigin(0.5);
    if (this.isNewBest) {
      this.tweens.add({ targets: bestLabel, scale: 1.15, duration: 350, yoyo: true, repeat: -1 });
    }

    const prompt = this.add
      .text(cx, 390, 'TAP OR PRESS ANY KEY TO RUN AGAIN', {
        fontFamily: 'monospace',
        fontSize: '18px',
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
