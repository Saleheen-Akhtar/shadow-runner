import Phaser from 'phaser';
import { CFG, WORLDS, SKINS, SKIN_KEY, getSelectedSkin, FONTS, COLORS, checkChallengeSkinUnlocked, getDailyChallenge } from '../config.js';
import Runner from '../entities/Runner.js';
import audio from '../systems/AudioManager.js';
import { applyHiDpi, fadeTransition, drawGlassPanel } from '../systems/display.js';

// Home dashboard: premium title, glassmorphic stat cards, hero PLAY
// button, skin picker, how-to-play overlay, mute toggle. Every element
// animates in with a staggered choreography for a cinematic reveal.
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const cx = CFG.WIDTH / 2;

    // ── Fade in from black ─────────────────────────────────────
    fadeTransition(this, 'in', 400);

    // ── Split-world backdrop with gradients ─────────────────────
    Object.values(WORLDS).forEach((def) => {
      const sky = this.add.graphics();
      sky.fillGradientStyle(def.skyTop, def.skyTop, def.skyBottom, def.skyBottom, 1);
      sky.fillRect(0, def.top, CFG.WIDTH, def.height);
      this.add.rectangle(cx, def.groundY + 15, CFG.WIDTH, 30, def.ground);
    });

    // World divider — gold glow instead of flat gray.
    this.add.rectangle(cx, 270, CFG.WIDTH, 6, COLORS.GOLD_HEX, 0.08).setDepth(1);
    this.add.rectangle(cx, 270, CFG.WIDTH, 2, COLORS.GOLD_HEX, 0.35).setDepth(1);

    // ── Ambient particles ──────────────────────────────────────
    // Light world: warm dust motes drifting slowly
    this.add.particles(0, 0, 'dot', {
      x: { min: 0, max: CFG.WIDTH },
      y: { min: 0, max: 260 },
      lifespan: 4000,
      speedX: { min: -10, max: 15 },
      speedY: { min: -8, max: 8 },
      scale: { start: 0.3, end: 0.1 },
      alpha: { start: 0.35, end: 0 },
      tint: 0xd4c8a0,
      frequency: 250,
    }).setDepth(0);

    // Dark world: soft glowing dots with subtle pulse
    this.add.particles(0, 0, 'glow', {
      x: { min: 0, max: CFG.WIDTH },
      y: { min: 280, max: CFG.HEIGHT },
      lifespan: 5000,
      speedX: { min: -6, max: 6 },
      speedY: { min: -4, max: 4 },
      scale: { start: 0.08, end: 0.03 },
      alpha: { start: 0.2, end: 0 },
      tint: COLORS.CYAN_HEX,
      frequency: 400,
    }).setDepth(0);

    // ── Title treatment ────────────────────────────────────────
    // Subtle glow behind the title
    const titleGlow = this.add.circle(cx, 56, 120, COLORS.GOLD_HEX, 0.04).setDepth(1);
    this.tweens.add({
      targets: titleGlow,
      alpha: 0.08,
      scale: 1.1,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // "SHADOW" in dark ink
    const shadowText = this.add
      .text(cx - 4, 55, 'SHADOW', {
        fontFamily: FONTS.HEADING,
        fontSize: '48px',
        color: '#1d1d24',
      })
      .setOrigin(1, 0.5)
      .setDepth(2)
      .setAlpha(0);

    // "RUNNER" in gold with cyan accent
    const runnerText = this.add
      .text(cx + 4, 55, 'RUNNER', {
        fontFamily: FONTS.HEADING,
        fontSize: '48px',
        color: COLORS.GOLD,
      })
      .setOrigin(0, 0.5)
      .setDepth(2)
      .setAlpha(0);

    // Title entrance
    this.tweens.add({ targets: shadowText, alpha: 1, duration: 400, delay: 100, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: runnerText, alpha: 1, duration: 400, delay: 200, ease: 'Cubic.easeOut' });

    // Shimmer sweep across title every 4 seconds
    const shimmer = this.add
      .rectangle(cx - 200, 55, 8, 52, 0xffffff, 0.35)
      .setDepth(3)
      .setAlpha(0);
    this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => {
        shimmer.x = cx - 200;
        shimmer.setAlpha(0.35);
        this.tweens.add({
          targets: shimmer,
          x: cx + 200,
          alpha: 0,
          duration: 800,
          ease: 'Cubic.easeIn',
        });
      },
    });

    // Tagline
    const tagline = this.add
      .text(cx, 96, 'Two worlds. Two runners. One mistake ends both.', {
        fontFamily: FONTS.MONO,
        fontSize: '14px',
        color: COLORS.TEXT_SECONDARY,
      })
      .setOrigin(0.5)
      .setDepth(2)
      .setAlpha(0);
    this.tweens.add({ targets: tagline, alpha: 1, duration: 400, delay: 350 });

    // ── Stats row — glassmorphic cards ─────────────────────────
    const best = Number(localStorage.getItem(CFG.BEST_KEY) || 0);
    const totalCoins = Number(localStorage.getItem(CFG.COINS_KEY) || 0);
    const runs = Number(localStorage.getItem(CFG.RUNS_KEY) || 0);

    const stats = [
      { icon: '\uD83C\uDFC6', label: 'BEST', value: best, x: cx - 140 },
      { icon: '\u25CF', label: 'COINS', value: totalCoins, x: cx },
      { icon: '\uD83C\uDFC3', label: 'RUNS', value: runs, x: cx + 140 },
    ];

    stats.forEach((stat, i) => {
      const sy = 168;
      const cardW = 116;
      const cardH = 60;
      drawGlassPanel(this, stat.x - cardW / 2, sy - cardH / 2, cardW, cardH, 3);

      const label = this.add
        .text(stat.x, sy - 14, `${stat.icon} ${stat.label}`, {
          fontFamily: FONTS.MONO,
          fontSize: '11px',
          color: COLORS.TEXT_SECONDARY,
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setAlpha(0)
        .setY(sy - 14 + 20);

      const valText = this.add
        .text(stat.x, sy + 10, '0', {
          fontFamily: FONTS.HEADING,
          fontSize: '20px',
          color: COLORS.GOLD,
        })
        .setOrigin(0.5)
        .setDepth(4)
        .setAlpha(0)
        .setY(sy + 10 + 20);

      // Staggered slide-up + fade-in
      const delay = 400 + i * 80;
      this.tweens.add({
        targets: [label, valText],
        alpha: 1,
        y: '-=20',
        duration: 350,
        delay,
        ease: 'Cubic.easeOut',
      });

      // Count-up values
      if (stat.value > 0) {
        const counter = { v: 0 };
        this.tweens.add({
          targets: counter,
          v: stat.value,
          duration: Math.min(800, 200 + stat.value * 2),
          delay: delay + 100,
          ease: 'Cubic.easeOut',
          onUpdate: () => valText.setText(String(Math.floor(counter.v))),
        });
      }
    });

    // ── PLAY button — hero CTA ────────────────────────────────
    const btnW = 200;
    const btnH = 60;
    const btnY = 270;

    // Outer glow
    const playGlow = this.add.graphics();
    playGlow.fillStyle(COLORS.GOLD_HEX, 0.15);
    playGlow.fillRoundedRect(-btnW / 2 - 8, -btnH / 2 - 8, btnW + 16, btnH + 16, 18);
    this.tweens.add({
      targets: playGlow,
      alpha: { from: 0.6, to: 1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Button fill (gold with slight amber on bottom half)
    const playBg = this.add.graphics();
    playBg.fillStyle(COLORS.GOLD_HEX, 1);
    playBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
    // Darker bottom for depth
    playBg.fillStyle(COLORS.GOLD_DARK_HEX, 0.25);
    playBg.fillRect(-btnW / 2 + 4, 0, btnW - 8, btnH / 2 - 4);

    const playLabel = this.add
      .text(0, 0, '\u25B6  PLAY', {
        fontFamily: FONTS.HEADING,
        fontSize: '28px',
        color: '#1d1d24',
      })
      .setOrigin(0.5);

    // Hitbox
    const playBtn = this.add
      .rectangle(0, 0, btnW, btnH)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });

    // Gentle pulse
    const playGroup = this.add.container(cx, btnY, [playGlow, playBg, playLabel, playBtn]).setDepth(6);
    playGroup.setScale(0.8).setAlpha(0);
    this.tweens.add({
      targets: playGroup,
      scale: 1,
      alpha: 1,
      duration: 500,
      delay: 600,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: playGroup,
      scale: 1.04,
      duration: 1000,
      delay: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    playBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.scene.start('Game');
    });

    // Sub-text
    const enterHint = this.add
      .text(cx, 312, 'ENTER / TAP', {
        fontFamily: FONTS.MONO,
        fontSize: '11px',
        color: COLORS.TEXT_MUTED,
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setAlpha(0);
    this.tweens.add({ targets: enterHint, alpha: 0.6, duration: 500, delay: 900 });
    this.tweens.add({
      targets: enterHint,
      alpha: { from: 0.3, to: 0.7 },
      duration: 1200,
      delay: 1400,
      yoyo: true,
      repeat: -1,
    });

    // ── Skin picker ───────────────────────────────────────────
    this.buildSkinPicker(cx, 355, best);

    // ── Daily Challenge HUD ───────────────────────────────────
    this.buildDailyChallengeHUD(CFG.WIDTH - 120, 48);

    // ── HOW TO PLAY — pill button ─────────────────────────────
    const helpPill = this.add.graphics().setDepth(3);
    helpPill.lineStyle(1.5, COLORS.GOLD_HEX, 0.6);
    helpPill.strokeRoundedRect(cx - 80, 404, 160, 28, 14);

    const helpBtn = this.add
      .text(cx, 418, 'HOW TO PLAY', {
        fontFamily: FONTS.MONO,
        fontSize: '13px',
        color: COLORS.GOLD,
      })
      .setOrigin(0.5)
      .setDepth(4)
      .setInteractive({ useHandCursor: true });
    helpBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.toggleHelp(true);
    });

    // Fade in skins and help
    [helpPill, helpBtn].forEach((el) => {
      el.setAlpha(0);
      this.tweens.add({ targets: el, alpha: 1, duration: 350, delay: 850 });
    });



    // ── Two live runners jogging in place ──────────────────────
    const skin = getSelectedSkin();
    this.runners = Object.values(WORLDS).map(
      (def) =>
        new Runner(this, 90, def.groundY, skin[def.key].body, skin[def.key].accent, def.runnerEye, skin.name)
    );

    this.buildHelp(cx);

    this.input.keyboard.on('keydown-ENTER', () => this.scene.start('Game'));
    this.input.keyboard.on('keydown-SPACE', () => this.scene.start('Game'));

    applyHiDpi(this);
  }

  // Row of skin swatches with golden selection ring.
  buildSkinPicker(cx, y, best) {
    const selIdx = Math.min(
      Math.max(Number(localStorage.getItem(SKIN_KEY) || 0), 0),
      SKINS.length - 1
    );

    const header = this.add
      .text(cx, y - 30, `SKINS \u2014 ${SKINS[selIdx].name}`, {
        fontFamily: FONTS.MONO,
        fontSize: '12px',
        color: COLORS.TEXT_SECONDARY,
      })
      .setOrigin(0.5)
      .setDepth(3)
      .setAlpha(0);
    this.tweens.add({ targets: header, alpha: 1, duration: 350, delay: 800 });

    SKINS.forEach((s, i) => {
      const x = cx + (i - (SKINS.length - 1) / 2) * 58;
      const unlocked = s.unlock === 'CHALLENGE' ? checkChallengeSkinUnlocked() : (best >= s.unlock);

      // Golden selection ring
      if (i === selIdx) {
        const ring = this.add
          .circle(x, y, 20, 0x000000, 0)
          .setStrokeStyle(2, COLORS.GOLD_HEX, 0.8)
          .setDepth(3);
        this.tweens.add({
          targets: ring,
          angle: 360,
          duration: 8000,
          repeat: -1,
        });
      }

      const swatch = this.add
        .circle(x, y, 13, unlocked ? s.light.body : 0x555560)
        .setStrokeStyle(3, unlocked ? s.dark.accent : 0x777780)
        .setDepth(3)
        .setAlpha(0);
      this.tweens.add({ targets: swatch, alpha: 1, duration: 300, delay: 850 + i * 40 });

      if (unlocked) {
        swatch.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
        if (swatch.input) swatch.input.cursor = 'pointer';
        swatch.on('pointerdown', (pointer, lx, ly, event) => {
          event.stopPropagation();
          localStorage.setItem(SKIN_KEY, String(i));
          this.scene.restart();
        });
      } else {
        const lockText = this.add
          .text(x, y + 24, s.unlock === 'CHALLENGE' ? 'DAILY' : String(s.unlock), {
            fontFamily: FONTS.MONO,
            fontSize: '10px',
            color: COLORS.TEXT_MUTED,
          })
          .setOrigin(0.5)
          .setDepth(3)
          .setAlpha(0);
        const lockIcon = this.add.text(x, y, '\uD83D\uDD12', { fontSize: '12px' }).setOrigin(0.5).setDepth(3).setAlpha(0);
        this.tweens.add({ targets: [lockText, lockIcon], alpha: 1, duration: 300, delay: 850 + i * 40 });
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

    // Glassmorphic help panel
    const panel = this.add.graphics().setDepth(51).setVisible(false);
    panel.fillStyle(0x0a0a14, 0.92);
    panel.fillRoundedRect(cx - 260, 50, 520, 440, 16);
    panel.lineStyle(1.5, COLORS.GOLD_HEX, 0.3);
    panel.strokeRoundedRect(cx - 260, 50, 520, 440, 16);
    this.helpObjs.push(panel);

    const lines = [
      ['HOW TO PLAY', COLORS.GOLD, '22px'],
      ['', '#fff', '8px'],
      ['W jump (x2 double jump) / S slide / D dash \u2014 top (light)', COLORS.TEXT_PRIMARY, '14px'],
      ['\u2191 jump (x2 double jump) / \u2193 slide / \u2192 dash \u2014 bottom (dark)', COLORS.TEXT_PRIMARY, '14px'],
      ['Mobile: tap = jump (x2 double), swipe down = slide, swipe right = dash', COLORS.TEXT_PRIMARY, '14px'],
      ['', '#fff', '8px'],
      ['Jump over crates and spikes', COLORS.TEXT_SECONDARY, '13px'],
      ['SLIDE under hanging gates - they cannot be jumped', COLORS.TEXT_SECONDARY, '13px'],
      ['SYNC: one input controls both runners', COLORS.TEXT_SECONDARY, '13px'],
      ['Freeze orb pauses the other world (no score there)', COLORS.TEXT_SECONDARY, '13px'],
      ['Coins chain into a combo for bonus points', COLORS.TEXT_SECONDARY, '13px'],
      ['', '#fff', '8px'],
      ['POWER-UPS', COLORS.GOLD, '16px'],
      ['\u2744 Freeze \u2014 pauses the other world', COLORS.TEXT_SECONDARY, '13px'],
      ['\uD83D\uDEE1 Shield \u2014 absorbs one crash', COLORS.TEXT_SECONDARY, '13px'],
      ['\u26A1 Overdrive \u2014 smash through obstacles', COLORS.TEXT_SECONDARY, '13px'],
      ['\uD83E\uDDF2 Magnet \u2014 pulls coins toward you', COLORS.TEXT_SECONDARY, '13px'],
      ['You lose when EITHER runner crashes', COLORS.TEXT_SECONDARY, '13px'],
      ['', '#fff', '8px'],
      ['tap anywhere to close', COLORS.TEXT_MUTED, '11px'],
    ];
    let helpY = 82;
    lines.forEach(([str, color, size]) => {
      if (str) {
        const t = this.add
          .text(cx, helpY, str, { fontFamily: FONTS.MONO, fontSize: size, color })
          .setOrigin(0.5)
          .setDepth(52)
          .setVisible(false);
        this.helpObjs.push(t);
      }
      helpY += parseInt(size, 10) + 9;
    });
  }

  toggleHelp(show) {
    this.helpObjs.forEach((o) => o.setVisible(show));
  }

  buildDailyChallengeHUD(cx, y) {
    const challenge = getDailyChallenge();
    const isCompleted = checkChallengeSkinUnlocked();
    const progress = Number(localStorage.getItem(`challenge-progress-${challenge.dayString}`) || 0);

    // Glass panel for daily challenge (compact, top-right)
    const panelW = 225;
    const panelH = 56;
    const panel = drawGlassPanel(this, cx - panelW / 2, y - panelH / 2, panelW, panelH, 3);
    panel.setAlpha(0);

    // Header text
    const titleStr = isCompleted ? `\uD83C\uDFC6 CHALLENGE COMPLETED` : `\u26A1 DAILY CHALLENGE`;
    const titleText = this.add.text(cx, y - 16, titleStr, {
      fontFamily: FONTS.HEADING,
      fontSize: '9.5px',
      color: COLORS.GOLD,
      fontWeight: 'bold'
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    // Description text
    const descStr = isCompleted 
      ? `CYBER Skin Unlocked!` 
      : `${challenge.text.replace('Daily Challenge: ', '').replace(' in one run', '')} (${progress}/${challenge.target})`;
    const descText = this.add.text(cx, y, descStr, {
      fontFamily: FONTS.MONO,
      fontSize: '8px',
      color: COLORS.TEXT_PRIMARY
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    // Tiny progress bar
    const barW = 185;
    const barH = 3;
    const bgBar = this.add.rectangle(cx, y + 14, barW, barH, 0x222233).setDepth(4).setAlpha(0);
    const progressRatio = isCompleted ? 1.0 : Math.min(1.0, progress / challenge.target);
    const fgBar = this.add.rectangle(cx - barW / 2 + (barW * progressRatio) / 2, y + 14, barW * progressRatio, barH, isCompleted ? COLORS.GOLD_HEX : COLORS.CYAN_HEX).setDepth(5).setAlpha(0);

    // Staggered fade in
    this.tweens.add({
      targets: [panel, titleText, descText, bgBar, fgBar],
      alpha: 1,
      duration: 350,
      delay: 880,
    });
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.runners.forEach((r) => r.update(dt, 0.35));
  }
}
