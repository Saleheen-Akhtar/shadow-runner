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

    // ── 8. PLAY AGAIN button ────────────────────────────────────
    const btnY = 385;
    const btnW = 180;
    const btnH = 48;
    const btnR = 12;

    // Subtle glow behind button
    const btnGlow = this.add.graphics();
    btnGlow.fillStyle(COLORS.GOLD_HEX, 0.15);
    btnGlow.fillRoundedRect(-btnW / 2 - 6, -btnH / 2 - 6, btnW + 12, btnH + 12, btnR + 4);
    btnGlow.setAlpha(0);

    // Pulsing glow
    this.tweens.add({
      targets: btnGlow,
      alpha: { from: 0.6, to: 1 },
      duration: 900,
      delay: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Button fill
    const btnBg = this.add.graphics();
    btnBg.fillStyle(COLORS.GOLD_HEX, 1);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, btnR);

    // Button text
    const btnText = this.add
      .text(0, 0, '▶  AGAIN', {
        fontFamily: FONTS.HEADING,
        fontSize: '22px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);

    // Group the button elements in a container for unified scaling
    const btnContainer = this.add.container(cx, btnY, [btnGlow, btnBg, btnText]).setDepth(6);
    btnContainer.setScale(0);

    // Bounce entrance
    this.tweens.add({
      targets: btnContainer,
      scale: 1,
      duration: 500,
      delay: 550,
      ease: 'Bounce.easeOut',
    });

    // Hitbox for button interaction
    const btnHitZone = this.add
      .rectangle(cx, btnY, btnW, btnH)
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });

    btnHitZone.on('pointerdown', (pointer, localX, localY, event) => {
      event.stopPropagation();
      this.scene.start('Game');
    });

    // ── 9. Sub-text ─────────────────────────────────────────────
    const subText = this.add
      .text(cx, 420, 'or press any key', {
        fontFamily: FONTS.MONO,
        fontSize: '11px',
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
      this.input.keyboard.once('keydown', () => this.scene.start('Game'));
      this.input.once('pointerdown', () => this.scene.start('Game'));
    });

    // ── 11. HiDPI ───────────────────────────────────────────────
    applyHiDpi(this);
  }
}
