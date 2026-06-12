import Phaser from 'phaser';
import { CFG, FONTS, COLORS } from '../config.js';
import { applyHiDpi, fadeTransition, drawGlassPanel } from '../systems/display.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  init(data) {
    this.finalScore = data.score ?? 0;
    this.best = data.best ?? 0;
    this.isNewBest = data.isNewBest ?? false;
    this.coins = data.coins ?? 0;
    this.comboHigh = data.comboHigh ?? 0;
  }

  create() {
    const cx = CFG.WIDTH / 2;

    // ── 1. Fade in ──────────────────────────────────────────────
    fadeTransition(this, 'in', 350);

    // ── 2. Dark backdrop ────────────────────────────────────────
    this.add
      .rectangle(cx, CFG.HEIGHT / 2, CFG.WIDTH + 40, CFG.HEIGHT + 40, 0x0a0a14, 0.92)
      .setDepth(0);

    // ── 3. Glassmorphic panel ───────────────────────────────────
    drawGlassPanel(this, cx - 240, 100, 480, 340, 5);

    // ── 4. Title: RUN OVER ──────────────────────────────────────
    const title = this.add
      .text(cx, 155, 'RUN OVER', {
        fontFamily: FONTS.HEADING,
        fontSize: '44px',
        color: COLORS.RED,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 300,
      delay: 100,
      ease: 'Cubic.easeOut',
    });

    // ── 5. Score section ────────────────────────────────────────
    const scoreLabel = this.add
      .text(cx, 215, 'SCORE', {
        fontFamily: FONTS.MONO,
        fontSize: '14px',
        color: COLORS.TEXT_SECONDARY,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(0);

    const scoreVal = this.add
      .text(cx, 260, '0', {
        fontFamily: FONTS.HEADING,
        fontSize: '48px',
        color: COLORS.TEXT_PRIMARY,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(0)
      .setScale(0.5);

    // Score entrance animation
    this.tweens.add({
      targets: [scoreLabel, scoreVal],
      alpha: 1,
      duration: 200,
      delay: 250,
      ease: 'Cubic.easeOut',
    });
    this.tweens.add({
      targets: scoreVal,
      scale: 1.0,
      duration: 200,
      delay: 250,
      ease: 'Cubic.easeOut',
    });

    // Dramatic count-up
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: this.finalScore,
      duration: Math.min(1000, 300 + this.finalScore * 1.0),
      delay: 280,
      ease: 'Cubic.easeOut',
      onUpdate: () => scoreVal.setText(String(Math.floor(counter.v))),
    });

    // ── 6. Best score line ──────────────────────────────────────
    if (this.isNewBest) {
      const newBestText = this.add
        .text(cx, 315, 'NEW BEST!', {
          fontFamily: FONTS.HEADING,
          fontSize: '24px',
          color: COLORS.GOLD,
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setAlpha(0);

      // Entrance
      this.tweens.add({
        targets: newBestText,
        alpha: 1,
        duration: 300,
        delay: 450,
        ease: 'Cubic.easeOut',
      });

      // Pulsing scale
      this.tweens.add({
        targets: newBestText,
        scale: 1.12,
        duration: 500,
        delay: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Fireworks: spawn 20 gold spark particles
      this.time.delayedCall(480, () => {
        const particles = this.add.particles(cx, 310, 'spark', {
          speed: { min: 80, max: 260 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.7, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: COLORS.GOLD_HEX,
          lifespan: 800,
          gravityY: 120,
          emitting: false,
        });
        particles.setDepth(7);
        particles.explode(20);
      });
    } else {
      const bestText = this.add
        .text(cx, 315, `BEST  ${this.best}`, {
          fontFamily: FONTS.MONO,
          fontSize: '18px',
          color: COLORS.GOLD,
        })
        .setOrigin(0.5)
        .setDepth(6)
        .setAlpha(0);

      this.tweens.add({
        targets: bestText,
        alpha: 1,
        duration: 300,
        delay: 450,
        ease: 'Cubic.easeOut',
      });
    }

    // ── 7. Run stats row ────────────────────────────────────────
    const statsY = 348;
    const coinsText = this.add
      .text(cx - 70, statsY, `\u25cf ${this.coins} COINS`, {
        fontFamily: FONTS.MONO,
        fontSize: '13px',
        color: COLORS.GOLD,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(0);

    const comboText = this.add
      .text(cx + 70, statsY, `\u26A1 ${this.comboHigh} MAX COMBO`, {
        fontFamily: FONTS.MONO,
        fontSize: '13px',
        color: COLORS.CYAN,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(0);

    this.tweens.add({
      targets: [coinsText, comboText],
      alpha: 1,
      duration: 300,
      delay: 500,
      ease: 'Cubic.easeOut',
    });

    // ── 8. PLAY AGAIN and MENU buttons ──────────────────────────
    const btnY = 380;
    const btnW = 150;
    const btnH = 42;
    const btnR = 10;

    // --- PLAY AGAIN Button ---
    const againGlow = this.add.graphics();
    againGlow.fillStyle(COLORS.GOLD_HEX, 0.15);
    againGlow.fillRoundedRect(-btnW / 2 - 5, -btnH / 2 - 5, btnW + 10, btnH + 10, btnR + 3);
    againGlow.setAlpha(0);

    this.tweens.add({
      targets: againGlow,
      alpha: { from: 0.6, to: 1 },
      duration: 900,
      delay: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const againBg = this.add.graphics();
    againBg.fillStyle(COLORS.GOLD_HEX, 1);
    againBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);

    const againText = this.add
      .text(0, 0, '▶  AGAIN', {
        fontFamily: FONTS.HEADING,
        fontSize: '18px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);

    const againContainer = this.add.container(cx - 90, btnY, [againGlow, againBg, againText]).setDepth(6);
    againContainer.setScale(0);

    const againHitZone = this.add
      .rectangle(cx - 90, btnY, btnW, btnH)
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });

    againHitZone.on('pointerdown', (pointer, localX, localY, event) => {
      event.stopPropagation();
      this.scene.start('Game');
    });

    // --- MENU Button ---
    const menuBg = this.add.graphics();
    menuBg.fillStyle(0x0a0a14, 0.6);
    menuBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);
    menuBg.lineStyle(1.5, COLORS.GOLD_HEX, 0.5);
    menuBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);

    const menuText = this.add
      .text(0, 0, '🏠  MENU', {
        fontFamily: FONTS.HEADING,
        fontSize: '18px',
        color: COLORS.GOLD,
      })
      .setOrigin(0.5);

    const menuContainer = this.add.container(cx + 90, btnY, [menuBg, menuText]).setDepth(6);
    menuContainer.setScale(0);

    const menuHitZone = this.add
      .rectangle(cx + 90, btnY, btnW, btnH)
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });

    menuHitZone.on('pointerdown', (pointer, localX, localY, event) => {
      event.stopPropagation();
      this.scene.start('Menu');
    });

    // Bounce entrance for both
    this.tweens.add({
      targets: [againContainer, menuContainer],
      scale: 1,
      duration: 500,
      delay: 550,
      ease: 'Bounce.easeOut',
    });

    // ── 9. Sub-text ─────────────────────────────────────────────
    const subText = this.add
      .text(cx, 420, 'press SPACE to restart or ESC for menu', {
        fontFamily: FONTS.MONO,
        fontSize: '10px',
        color: COLORS.TEXT_MUTED,
      })
      .setOrigin(0.5)
      .setDepth(6)
      .setAlpha(0.3);

    this.tweens.add({
      targets: subText,
      alpha: { from: 0.3, to: 1.0 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── 10. Input handling ──────────────────────────────────────
    this.time.delayedCall(300, () => {
      this.input.keyboard.on('keydown-SPACE', () => this.scene.start('Game'));
      this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Game'));
      this.input.keyboard.on('keydown-ESC', () => this.scene.start('Menu'));
    });

    // ── 11. HiDPI ───────────────────────────────────────────────
    applyHiDpi(this);
  }
}
