import Phaser from 'phaser';
import { CFG, WORLDS, SKINS, SKIN_KEY, getSelectedSkin } from '../config.js';
import Runner from '../entities/Runner.js';
import { applyHiDpi } from '../systems/display.js';

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
      .text(cx, 168, 'W jump / S slide \u2014 top runner', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 400, '\u2191 jump / \u2193 slide \u2014 bottom runner', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f2f0e8',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 432, 'Mobile: tap = jump, swipe down = slide \u2022 SYNC: one input controls both', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#b8b6c4',
      })
      .setOrigin(0.5);

    // Two live runners jogging in place, wearing the selected skin.
    const skin = getSelectedSkin();
    this.runners = Object.values(WORLDS).map(
      (def) =>
        new Runner(this, 140, def.groundY, skin[def.key].body, skin[def.key].accent, def.runnerEye)
    );

    const best = Number(localStorage.getItem(CFG.BEST_KEY) || 0);
    if (best > 0) {
      this.add
        .text(CFG.WIDTH - 16, 12, `BEST ${best}`, {
          fontFamily: 'monospace',
          fontSize: '16px',
          color: '#ffd34d',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(1, 0);
    }

    this.buildSkinPicker(cx, 464, best);

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

    applyHiDpi(this);
  }

  // Row of skin swatches. Unlocked skins are clickable; locked ones are
  // dimmed and show the best score required to unlock them.
  buildSkinPicker(cx, y, best) {
    const selIdx = Math.min(
      Math.max(Number(localStorage.getItem(SKIN_KEY) || 0), 0),
      SKINS.length - 1
    );

    this.add
      .text(cx, y - 28, `SKINS \u2014 ${SKINS[selIdx].name}`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#b8b6c4',
      })
      .setOrigin(0.5);

    SKINS.forEach((s, i) => {
      const x = cx + (i - (SKINS.length - 1) / 2) * 58;
      const unlocked = best >= s.unlock;

      if (i === selIdx) {
        this.add.circle(x, y, 20, 0xffffff, 0).setStrokeStyle(2, 0xffffff);
      }

      const swatch = this.add
        .circle(x, y, 13, unlocked ? s.light.body : 0x555560)
        .setStrokeStyle(3, unlocked ? s.dark.accent : 0x777780);

      if (unlocked) {
        swatch.setInteractive({ useHandCursor: true });
        swatch.on('pointerdown', (pointer, lx, ly, event) => {
          event.stopPropagation();
          localStorage.setItem(SKIN_KEY, String(i));
          this.scene.restart();
        });
      } else {
        this.add
          .text(x, y + 24, String(s.unlock), {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#777780',
          })
          .setOrigin(0.5);
        this.add
          .text(x, y, '\uD83D\uDD12', { fontSize: '13px' })
          .setOrigin(0.5);
      }
    });
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.runners.forEach((r) => r.update(dt, 0.35));
  }
}
