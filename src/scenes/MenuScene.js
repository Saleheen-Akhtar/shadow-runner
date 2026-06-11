import Phaser from 'phaser';
import { CFG, WORLDS, SKINS, SKIN_KEY, getSelectedSkin } from '../config.js';
import Runner from '../entities/Runner.js';
import audio from '../systems/AudioManager.js';
import { applyHiDpi } from '../systems/display.js';

const TITLE_FONT = '"Arial Black", Impact, sans-serif';

// Home dashboard: title, lifetime stats, PLAY button, skin picker,
// how-to-play overlay and mute toggle.
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

    // Title.
    this.add
      .text(cx + 3, 63, 'SHADOW RUNNER', { fontFamily: TITLE_FONT, fontSize: '52px', color: '#00000033' })
      .setOrigin(0.5);
    this.add
      .text(cx, 60, 'SHADOW RUNNER', { fontFamily: TITLE_FONT, fontSize: '52px', color: '#1d1d24' })
      .setOrigin(0.5);
    this.add
      .text(cx, 108, 'Two worlds. Two runners. One mistake ends both.', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);

    // Lifetime stats row.
    const best = Number(localStorage.getItem(CFG.BEST_KEY) || 0);
    const totalCoins = Number(localStorage.getItem(CFG.COINS_KEY) || 0);
    const runs = Number(localStorage.getItem(CFG.RUNS_KEY) || 0);
    this.statBlock(cx - 140, 180, 'BEST', String(best), '#ffd34d');
    this.statBlock(cx, 180, 'COINS', String(totalCoins), '#ffd34d');
    this.statBlock(cx + 140, 180, 'RUNS', String(runs), '#ffffff');

    // PLAY button on the divider.
    const playBtn = this.add
      .rectangle(cx, 270, 190, 58, 0xffd34d)
      .setStrokeStyle(3, 0xffffff, 0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    const playLabel = this.add
      .text(cx, 270, 'PLAY', { fontFamily: TITLE_FONT, fontSize: '30px', color: '#1d1d24' })
      .setOrigin(0.5)
      .setDepth(6);
    this.tweens.add({
      targets: [playBtn, playLabel],
      scale: 1.05,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    playBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.scene.start('Game');
    });
    this.add
      .text(cx, 312, 'or press ENTER', { fontFamily: 'monospace', fontSize: '12px', color: '#d8d6e4' })
      .setOrigin(0.5)
      .setDepth(5);

    // Skin picker.
    this.buildSkinPicker(cx, 386, best);

    // Controls hint + help.
    this.add
      .text(cx, 440, 'W/S top runner \u00b7 \u2191/\u2193 bottom runner \u00b7 tap = jump, swipe down = slide', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#b8b6c4',
      })
      .setOrigin(0.5);
    const helpBtn = this.add
      .text(cx, 478, '[ HOW TO PLAY ]', { fontFamily: 'monospace', fontSize: '15px', color: '#f2f0e8' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    helpBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.toggleHelp(true);
    });

    // Mute toggle (game starts muted - portal requirement).
    this.muteBtn = this.add
      .text(CFG.WIDTH - 24, 24, audio.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A', { fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      const muted = audio.toggleMute();
      this.muteBtn.setText(muted ? '\uD83D\uDD07' : '\uD83D\uDD0A');
    });

    // Two live runners jogging in place, wearing the selected skin.
    const skin = getSelectedSkin();
    this.runners = Object.values(WORLDS).map(
      (def) =>
        new Runner(this, 90, def.groundY, skin[def.key].body, skin[def.key].accent, def.runnerEye)
    );

    this.buildHelp(cx);

    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Game'));
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('Game'));

    applyHiDpi(this);
  }

  statBlock(x, y, label, value, valueColor) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x - 58, y - 28, 116, 56, 10);
    this.add
      .text(x, y - 13, label, { fontFamily: 'monospace', fontSize: '11px', color: '#b8b6c4' })
      .setOrigin(0.5);
    this.add
      .text(x, y + 8, value, { fontFamily: TITLE_FONT, fontSize: '18px', color: valueColor })
      .setOrigin(0.5);
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
        this.add.text(x, y, '\uD83D\uDD12', { fontSize: '13px' }).setOrigin(0.5);
      }
    });
  }

  buildHelp(cx) {
    this.helpObjs = [];

    const ov = this.add
      .rectangle(cx, 270, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.7)
      .setDepth(50)
      .setVisible(false)
      .setInteractive();
    ov.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.toggleHelp(false);
    });
    this.helpObjs.push(ov);

    const panel = this.add.graphics().setDepth(51).setVisible(false);
    panel.fillStyle(0x10101a, 0.95);
    panel.fillRoundedRect(cx - 260, 90, 520, 360, 16);
    panel.lineStyle(2, 0xffd34d, 0.6);
    panel.strokeRoundedRect(cx - 260, 90, 520, 360, 16);
    this.helpObjs.push(panel);

    const lines = [
      ['HOW TO PLAY', '#ffd34d', '22px'],
      ['', '#fff', '8px'],
      ['W jump / S slide \u2014 top (light) runner', '#f2f0e8', '15px'],
      ['\u2191 jump / \u2193 slide \u2014 bottom (dark) runner', '#f2f0e8', '15px'],
      ['Mobile: tap = jump, swipe down = slide (your half)', '#f2f0e8', '15px'],
      ['', '#fff', '8px'],
      ['Jump over crates and spikes', '#b8b6c4', '14px'],
      ['SLIDE under hanging gates - they cannot be jumped', '#b8b6c4', '14px'],
      ['SYNC: one input controls both runners', '#b8b6c4', '14px'],
      ['Freeze orb pauses the other world (no score there)', '#b8b6c4', '14px'],
      ['Coins chain into a combo for bonus points', '#b8b6c4', '14px'],
      ['You lose when EITHER runner crashes', '#b8b6c4', '14px'],
      ['', '#fff', '8px'],
      ['tap anywhere to close', '#777780', '12px'],
    ];
    let y = 122;
    lines.forEach(([str, color, size]) => {
      if (str) {
        const t = this.add
          .text(cx, y, str, { fontFamily: 'monospace', fontSize: size, color })
          .setOrigin(0.5)
          .setDepth(52)
          .setVisible(false);
        this.helpObjs.push(t);
      }
      y += parseInt(size, 10) + 9;
    });
  }

  toggleHelp(show) {
    this.helpObjs.forEach((o) => o.setVisible(show));
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.runners.forEach((r) => r.update(dt, 0.35));
  }
}
