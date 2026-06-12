import Phaser from 'phaser';
import { CFG, DPR, WORLDS, getSelectedSkin, FONTS, COLORS, getDailyChallenge, CHALLENGE_UNLOCKED_KEY } from '../config.js';
import Runner from '../entities/Runner.js';
import audio from '../systems/AudioManager.js';
import portal from '../platform/PortalAdapter.js';
import { applyHiDpi, fadeTransition, screenFlash, drawGlassPanel, glitchFlash, chromaFlash } from '../systems/display.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.skin = getSelectedSkin();
    this.elapsed = 0;
    this.score = 0;
    this.best = Number(localStorage.getItem(CFG.BEST_KEY) || 0);
    this.speed = CFG.BASE_SPEED;
    this.isPaused = false;
    this.isGameOver = false;

    this.overdriveActive = false;
    this.overdriveUntil = 0;
    this.shields = null;
    this.worlds = {};
    Object.values(WORLDS).forEach((def) => this.createWorld(def));

    // Sync event state
    this.syncActive = false;
    this.syncUntil = 0;
    this.nextSyncAt = this.rand(CFG.SYNC_MIN_MS, CFG.SYNC_MAX_MS);
    this.lastSyncJumpAt = -10000;

    // Power-up scheduling
    this.nextPowerupAt = this.rand(CFG.POWERUP_MIN_MS, CFG.POWERUP_MAX_MS);

    // Coins & combo
    this.coins = 0;
    this.combo = 0;
    this.comboHigh = 0;
    this.lastCoinAt = -99999;
    this.comboText = null;
    this.comboTween = null;

    this.runFinished = false;

    // Revive (one per run)
    this.reviveUsed = false;
    this.reviveBusy = false;
    this.reviveObjs = null;
    this.reviveTimer = null;
    this.invulnUntil = 0;

    // Check if we are restoring from a saved revive state (in case the ad SDK reloaded the scene)
    const savedRevive = localStorage.getItem('shadow-runner-revive-state');
    if (savedRevive) {
      try {
        const state = JSON.parse(savedRevive);
        this.score = state.score;
        this.elapsed = state.elapsed;
        this.coins = state.coins;
        this.reviveUsed = true;
        this.speed = Math.min(CFG.MAX_SPEED, CFG.BASE_SPEED + CFG.SPEED_RAMP * (this.elapsed / 1000));

        Object.values(this.worlds).forEach((w) => {
          w.nextSpawnAt = this.elapsed + 1400;
          w.nextCoinAt = this.elapsed + 3000;
          // Trigger blinking invulnerability from the start
          this.tweens.add({
            targets: w.runner.container,
            alpha: 0.25,
            duration: 140,
            yoyo: true,
            repeat: 6,
            onComplete: () => w.runner.container.setAlpha(1),
          });
        });

        this.invulnUntil = this.elapsed + 2000;
        localStorage.removeItem('shadow-runner-revive-state');
      } catch (e) {
        localStorage.removeItem('shadow-runner-revive-state');
      }
    }

    // Fever Mode state
    this.feverActive = false;
    this.feverProgress = 0;
    this.feverUntil = 0;

    // Anomaly state
    this.anomalyType = null;
    this.anomalyUntil = 0;
    this.nextAnomalyAt = 25000 + Math.random() * 15000; // 25-40s initially

    // Dynamic physics (referenced by Runner)
    this.gravity = CFG.GRAVITY;
    this.jumpVelocity = CFG.JUMP_VELOCITY;

    this.runJumps = 0;
    this.runSlides = 0;
    this.boostActive = false;
    this.boostUntil = 0;

    this.createUi();
    this.bindInput();

    // Portals (e.g. Poki) require auto-pause when the tab loses focus.
    this.onVisibility = () => {
      if (document.hidden) this.pauseGame();
    };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', this.onVisibility);
    });

    portal.gameplayStart();
    audio.startBGM();

    // Fade in
    fadeTransition(this, 'in', 300);
    applyHiDpi(this);
  }

  createWorld(def) {
    const cx = CFG.WIDTH / 2;
    const cy = def.top + def.height / 2;

    // Sky gradient
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(def.skyTop, def.skyTop, def.skyBottom, def.skyBottom, 1);
    sky.fillRect(0, def.top, CFG.WIDTH, def.height);

    const parallax = [];
    const stars = [];

    if (def.key === 'light') {
      this.createSun(780, def.top + 62);
      // Drifting clouds (slow parallax)
      for (let i = 0; i < 3; i++) {
        const cl = this.add
          .ellipse(120 + i * 340, def.top + 36 + Math.random() * 55, 95, 26, 0xffffff, 0.8)
          .setDepth(0);
        parallax.push({ obj: cl, factor: 0.12, halfW: 60 });
      }
      // Birds gliding by
      for (let i = 0; i < 2; i++) {
        const bird = this.makeBird(200 + i * 420, def.top + 55 + Math.random() * 45);
        parallax.push({ obj: bird, factor: 0.18, halfW: 14 });
      }
      // Rolling hills
      for (let i = 0; i < 3; i++) {
        const h = this.add.ellipse(i * 420, def.groundY + 35, 430, 160, def.hill).setDepth(0);
        parallax.push({ obj: h, factor: 0.25, halfW: 220 });
      }
      // Trees (mid distance)
      for (let i = 0; i < 4; i++) {
        const t = this.add
          .triangle(80 + i * 260, def.groundY - 19, 0, 40, 28, 40, 14, 0, def.prop)
          .setDepth(0);
        parallax.push({ obj: t, factor: 0.5, halfW: 20 });
      }
    } else {
      this.createMoon(200, def.top + 58);
      // Twinkling stars
      for (let i = 0; i < 16; i++) {
        const s = this.add
          .circle(Math.random() * CFG.WIDTH, def.top + 12 + Math.random() * 130, 1.5, 0xffffff)
          .setDepth(0);
        stars.push({ obj: s, tw: Math.random() * Math.PI * 2 });
      }
      // City skyline (far) silhouette buildings
      for (let i = 0; i < 7; i++) {
        const bw = 55 + Math.random() * 50;
        const bh = 60 + Math.random() * 75;
        const b = this.add.rectangle(i * 150, def.groundY - bh / 2 + 2, bw, bh, def.hill).setDepth(0);
        parallax.push({ obj: b, factor: 0.25, halfW: bw / 2 });
      }
      // Antennas / rooftops (mid)
      for (let i = 0; i < 4; i++) {
        const a = this.add
          .rectangle(120 + i * 250, def.groundY - 28, 7, 56, def.prop)
          .setDepth(0);
        parallax.push({ obj: a, factor: 0.5, halfW: 6 });
      }
      // Occasional shooting star
      this.time.addEvent({
        delay: 8000,
        startAt: Math.random() * 6000,
        loop: true,
        callback: () => {
          if (!this.isPaused && !this.isGameOver) this.spawnShootingStar(def);
        },
      });
    }

    // Ground with scrolling stripes for speed feel
    this.add.rectangle(cx, def.groundY + 15, CFG.WIDTH, 30, def.ground).setDepth(1);
    const stripes = [];
    for (let i = 0; i < 8; i++) {
      const st = this.add
        .rectangle(i * 140 + 20, def.groundY + 16, 46, 4, def.stripe)
        .setAlpha(0.7)
        .setDepth(1);
      stripes.push(st);
    }

    this.add
      .text(16, def.top + 10, def.label, {
        fontFamily: FONTS.MONO,
        fontSize: '12px',
        color: def.labelColor,
      })
      .setDepth(2);

    const skinColors = this.skin[def.key];
    const runner = new Runner(
      this,
      CFG.RUNNER_X,
      def.groundY,
      skinColors.body,
      skinColors.accent,
      def.runnerEye,
      this.skin.name
    );

    const dust = this.add
      .particles(0, 0, 'dot', {
        speed: { min: 40, max: 130 },
        angle: { min: 220, max: 320 },
        lifespan: 350,
        scale: { start: 0.7, end: 0 },
        tint: def.dust,
        emitting: false,
      })
      .setDepth(5);

    // Gentle snowfall while this world is frozen.
    const snow = this.add
      .particles(0, 0, 'dot', {
        x: { min: 0, max: CFG.WIDTH },
        y: def.top,
        lifespan: 1800,
        speedY: { min: 60, max: 120 },
        speedX: { min: -30, max: 10 },
        scale: { start: 0.5, end: 0.2 },
        alpha: { start: 0.8, end: 0 },
        tint: 0xdff2ff,
        frequency: 60,
        emitting: false,
      })
      .setDepth(6);

    const freezeOverlay = this.add
      .rectangle(cx, cy, CFG.WIDTH, def.height, 0x7fd4ff, 0.22)
      .setDepth(6)
      .setVisible(false);
    const freezeBorders = this.add.graphics().setDepth(6).setVisible(false);
    freezeBorders.lineStyle(6, 0xbfe9ff, 0.65);
    freezeBorders.strokeRect(3, def.top + 3, CFG.WIDTH - 6, def.height - 6);
    freezeBorders.fillStyle(0xbfe9ff, 0.7);
    freezeBorders.fillRect(0, def.top, 24, 6);
    freezeBorders.fillRect(0, def.top, 6, 24);
    freezeBorders.fillRect(CFG.WIDTH - 24, def.top, 24, 6);
    freezeBorders.fillRect(CFG.WIDTH - 6, def.top, 6, 24);
    freezeBorders.fillRect(0, def.top + def.height - 6, 24, 6);
    freezeBorders.fillRect(0, def.top + def.height - 24, 6, 24);
    freezeBorders.fillRect(CFG.WIDTH - 24, def.top + def.height - 6, 24, 6);
    freezeBorders.fillRect(CFG.WIDTH - 6, def.top + def.height - 24, 6, 24);

    const freezeText = this.add
      .text(cx, cy, 'FROZEN', {
        fontFamily: FONTS.HEADING,
        fontSize: '26px',
        color: '#7fd4ff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(7)
      .setVisible(false);

    const fog = this.add.rectangle(cx, cy, CFG.WIDTH, def.height, 0x000000, 0.0)
      .setDepth(2.5)
      .setVisible(false);

    this.worlds[def.key] = {
      def,
      runner,
      dust,
      snow,
      parallax,
      stars,
      stripes,
      obstacles: [],
      powerups: [],
      coins: [],
      boostPads: [],
      crumblingGround: [],
      nextCoinAt: 3000 + Math.random() * 2000,
      nextSpawnAt: 1200 + Math.random() * 600,
      frozenUntil: 0,
      freezeOverlay,
      freezeBorders,
      freezeText,
      wasFrozen: false,
      shieldActive: false,
      shieldGfx: null,
      magnetActive: false,
      magnetGfx: null,
      magnetUntil: 0,
      fog,
    };
  }

  // Layered sun: soft outer glow with a breathing pulse, slowly rotating
  // rays, warm core and an off-center hot spot for a spherical feel.
  createSun(x, y) {
    this.add.circle(x, y, 56, 0xffdf9e, 0.1).setDepth(0);
    const glow = this.add.circle(x, y, 40, 0xffdf9e, 0.22).setDepth(0);
    this.tweens.add({
      targets: glow,
      alpha: 0.34,
      scale: 1.08,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const rayParts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      rayParts.push(
        this.add.rectangle(Math.cos(a) * 37, Math.sin(a) * 37, 13, 3, 0xffd98a, 0.55).setRotation(a)
      );
    }
    const rays = this.add.container(x, y, rayParts).setDepth(0);
    this.tweens.add({ targets: rays, rotation: Math.PI * 2, duration: 45000, repeat: -1 });
    this.add.circle(x, y, 26, 0xffd98a).setDepth(0);
    this.add.circle(x - 6, y - 6, 17, 0xfff3cf, 0.9).setDepth(0);
  }

  // Moon with a breathing halo, sphere shading and craters.
  createMoon(x, y) {
    this.add.circle(x, y, 40, 0xcfd8ff, 0.1).setDepth(0);
    const halo = this.add.circle(x, y, 29, 0xcfd8ff, 0.16).setDepth(0);
    this.tweens.add({
      targets: halo,
      alpha: 0.26,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.add.circle(x, y, 21, 0xe8edf8).setDepth(0);
    this.add.circle(x + 5, y + 4, 16, 0xc7d1e8, 0.55).setDepth(0);
    this.add.circle(x - 7, y - 4, 4, 0xb7c2db).setDepth(0);
    this.add.circle(x + 4, y + 7, 3, 0xb7c2db).setDepth(0);
    this.add.circle(x + 8, y - 6, 2.5, 0xb7c2db).setDepth(0);
  }

  // Tiny silhouette bird with flapping wings.
  makeBird(x, y) {
    const wl = this.add.rectangle(0, 0, 12, 2.5, 0x2f2f38).setOrigin(1, 0.5).setRotation(-0.4);
    const wr = this.add.rectangle(0, 0, 12, 2.5, 0x2f2f38).setOrigin(0, 0.5).setRotation(0.4);
    this.tweens.add({ targets: wl, rotation: 0.25, duration: 330, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: wr, rotation: -0.25, duration: 330, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return this.add.container(x, y, [wl, wr]).setDepth(0);
  }

  spawnShootingStar(def) {
    const sx = 250 + Math.random() * 600;
    const sy = def.top + 15 + Math.random() * 70;
    const streak = this.add.rectangle(sx, sy, 46, 2, 0xffffff, 0.85).setRotation(0.52).setDepth(0);
    this.tweens.add({
      targets: streak,
      x: sx + 130,
      y: sy + 75,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => streak.destroy(),
    });
  }

  // ── Premium HUD ──────────────────────────────────────────────
  createUi() {
    const cx = CFG.WIDTH / 2;

    // Sync grid overlays (subtle neon lines)
    this.syncGrids = [];
    Object.values(WORLDS).forEach((def) => {
      const g = this.add.graphics().setDepth(1).setVisible(false);
      g.lineStyle(1.5, def.key === 'light' ? COLORS.GOLD_HEX : COLORS.CYAN_HEX, 0.12);
      const gridSpacing = 40;
      for (let x = 0; x < CFG.WIDTH; x += gridSpacing) {
        g.lineBetween(x, def.top, x, def.top + def.height);
      }
      for (let y = def.top; y < def.top + def.height; y += gridSpacing) {
        g.lineBetween(0, y, CFG.WIDTH, y);
      }
      this.syncGrids.push(g);
    });

    // World divider — thin gold glow
    this.add.rectangle(cx, 270, CFG.WIDTH, 6, COLORS.GOLD_HEX, 0.06).setDepth(8);
    this.divider = this.add.rectangle(cx, 270, CFG.WIDTH, 2, COLORS.GOLD_HEX, 0.3).setDepth(8);

    // Glassmorphic HUD pill
    drawGlassPanel(this, cx - 100, 6, 200, 64, 19);

    // Subtle cinematic vignette (top and bottom).
    const vg = this.add.graphics().setDepth(25);
    vg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.3, 0.3, 0, 0);
    vg.fillRect(0, 0, CFG.WIDTH, 36);
    vg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.3, 0.3);
    vg.fillRect(0, CFG.HEIGHT - 36, CFG.WIDTH, 36);

    // Speed lines kick in at high velocity.
    this.speedLines = this.add
      .particles(0, 0, 'dot', {
        x: CFG.WIDTH + 10,
        y: { min: 20, max: CFG.HEIGHT - 20 },
        lifespan: 380,
        speedX: { min: -1400, max: -1100 },
        scaleX: 3,
        scaleY: 0.15,
        alpha: { start: 0.22, end: 0 },
        frequency: 70,
        emitting: false,
      })
      .setDepth(9);
    this.linesOn = false;
    this.lastMilestone = 0;

    this.scoreText = this.add
      .text(cx, 14, '0', {
        fontFamily: FONTS.HEADING,
        fontSize: '32px',
        color: COLORS.TEXT_PRIMARY,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.bestText = this.add
      .text(cx - 45, 50, `\uD83C\uDFC6 ${this.best}`, {
        fontFamily: FONTS.MONO,
        fontSize: '12px',
        color: COLORS.GOLD,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.coinText = this.add
      .text(cx + 45, 50, '\u25cf 0', {
        fontFamily: FONTS.MONO,
        fontSize: '12px',
        color: COLORS.GOLD,
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    // Fever progress bar (gold) under the HUD score card
    this.feverBg = this.add.rectangle(cx, 75, 160, 6, 0x1d1d24, 0.5).setDepth(20);
    this.feverBg.setStrokeStyle(1, 0xffffff, 0.15);
    this.feverBar = this.add.graphics().setDepth(20);
    this.updateFeverBar();

    this.syncText = this.add
      .text(cx, 270, 'SYNC!', {
        fontFamily: FONTS.HEADING,
        fontSize: '44px',
        color: COLORS.GOLD,
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
    this.syncTween = this.tweens.add({
      targets: this.syncText,
      scale: 1.15,
      duration: 250,
      yoyo: true,
      repeat: -1,
      paused: true,
    });

    // Pause button — circle with gold border
    this.add.circle(CFG.WIDTH - 24, 24, 16, 0x0a0a14, 0.7).setDepth(20)
      .setStrokeStyle(1.5, COLORS.GOLD_HEX, 0.35);
    this.pauseBtn = this.add
      .text(CFG.WIDTH - 24, 24, '⏸', {
        fontFamily: FONTS.HEADING,
        fontSize: '15px',
        color: COLORS.GOLD,
      })
      .setOrigin(0.5)
      .setDepth(21)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.pauseGame();
    });
  }

  bindInput() {
    // Desktop: WASD column controls the top runner, arrows the bottom.
    const kb = this.input.keyboard;
    kb.on('keydown-W', () => this.handleAction('light', 'jump'));
    kb.on('keydown-S', () => this.handleAction('light', 'slide'));
    kb.on('keydown-D', () => this.handleAction('light', 'dash'));
    kb.on('keydown-UP', () => this.handleAction('dark', 'jump'));
    kb.on('keydown-DOWN', () => this.handleAction('dark', 'slide'));
    kb.on('keydown-RIGHT', () => this.handleAction('dark', 'dash'));

    // Keyboard shortcuts for pausing
    kb.on('keydown-ESC', () => this.pauseGame());
    kb.on('keydown-P', () => this.pauseGame());

    // Touch: tap = jump, swipe down = slide, swipe right = dash.
    this.input.addPointer(1);
    this.touch = new Map();
    this.input.on('pointerdown', (pointer) => {
      this.touch.set(pointer.id, { x0: pointer.worldX, y0: pointer.worldY, acted: false });
    });
    this.input.on('pointermove', (pointer) => {
      const st = this.touch.get(pointer.id);
      if (!st || st.acted || !pointer.isDown) return;
      const threshold = 24; // Standard design-space swipe distance threshold
      const dx = pointer.worldX - st.x0;
      const dy = pointer.worldY - st.y0;

      // Detect swipe right for dash
      if (dx > threshold && dx > Math.abs(dy)) {
        st.acted = true;
        const world = st.y0 < CFG.HEIGHT / 2 ? 'light' : 'dark';
        this.handleAction(world, 'dash');
        return;
      }

      if (Math.abs(dy) < threshold) return;
      st.acted = true;
      const world = st.y0 < CFG.HEIGHT / 2 ? 'light' : 'dark';
      this.handleAction(world, dy > 0 ? 'slide' : 'jump');
    });
    this.input.on('pointerup', (pointer) => {
      const st = this.touch.get(pointer.id);
      this.touch.delete(pointer.id);
      if (!st || st.acted) return;
      const world = st.y0 < CFG.HEIGHT / 2 ? 'light' : 'dark';
      this.handleAction(world, 'jump');
    });
  }

  handleAction(worldKey, action = 'jump') {
    if (this.isGameOver) return;
    if (this.isPaused) {
      this.resumeGame();
      return;
    }

    if (this.syncActive) {
      // One input controls both. First input wins; an immediate second
      // input is ignored (not penalized).
      if (this.elapsed - this.lastSyncJumpAt < CFG.SYNC_INPUT_DEBOUNCE_MS) return;
      this.lastSyncJumpAt = this.elapsed;
      let acted = false;
      Object.values(this.worlds).forEach((w) => {
        if (this.elapsed < w.frozenUntil) return;
        if (action === 'jump') {
          const isFirstJump = w.runner.onGround;
          if (w.runner.jump()) {
            acted = true;
            this.runJumps++;
            if (isFirstJump) {
              w.dust.explode(4, CFG.RUNNER_X, w.def.groundY);
            }
          }
        } else if (action === 'slide') {
          if (w.runner.slide()) {
            acted = true;
            this.runSlides++;
          }
        } else if (action === 'dash') {
          if (w.runner.dash()) {
            acted = true;
          }
        }
      });
      if (acted) {
        audio.play(action);
      }
      return;
    }

    const w = this.worlds[worldKey];
    if (this.elapsed < w.frozenUntil) return; // frozen world ignores input
    if (action === 'jump') {
      const isFirstJump = w.runner.onGround;
      if (w.runner.jump()) {
        this.runJumps++;
        if (isFirstJump) {
          audio.play('jump');
          w.dust.explode(4, CFG.RUNNER_X, w.def.groundY);
        } else {
          audio.play('doublejump');
        }
      }
    } else if (action === 'slide') {
      if (w.runner.slide()) {
        this.runSlides++;
        audio.play('slide');
      }
    } else if (action === 'dash') {
      if (w.runner.dash()) {
        audio.play('dash');
      }
    }
  }

  update(time, delta) {
    if (this.isGameOver || this.isPaused) return;
    if (!this.smoothedDelta) {
      this.smoothedDelta = delta;
    } else {
      this.smoothedDelta = this.smoothedDelta * 0.85 + delta * 0.15;
    }
    const dt = Math.min(this.smoothedDelta, 50) / 1000;
    this.elapsed += delta;

    if (this.boostActive && this.elapsed >= this.boostUntil) {
      this.boostActive = false;
    }

    let speedMult = 1.0;
    if (this.boostActive) {
      speedMult *= 1.8;
    } else if (this.overdriveActive || this.feverActive) {
      speedMult *= 1.55;
    }
    if (this.anomalyType === 'warp_speed') {
      speedMult *= 1.4;
    }
    this.speed = Math.min(CFG.MAX_SPEED, CFG.BASE_SPEED + CFG.SPEED_RAMP * (this.elapsed / 1000)) * speedMult;

    // Drive the dynamic BGM
    audio.updateBGM(this.speed / CFG.MAX_SPEED, this.feverActive, this.anomalyType);

    // Overdrive timing check
    if (this.overdriveActive && this.elapsed >= this.overdriveUntil) {
      this.overdriveActive = false;
      if (this.shields) {
        this.shields.forEach((s) => s.destroy());
        this.shields = null;
      }
      Object.values(this.worlds).forEach((w) => {
        w.runner.trailEmitter.setFrequency(w.runner.getTrailConfig(w.runner.skinName, w.runner.accentColor).frequency);
      });
    }

    // Update overdrive shields position and pulse if active
    if (this.overdriveActive && this.shields) {
      Object.values(this.worlds).forEach((w, idx) => {
        const shield = this.shields[idx];
        if (shield && shield.active) {
          shield.setPosition(CFG.RUNNER_X, w.runner.container.y - 12);
          shield.scale = 1 + 0.05 * Math.sin(this.elapsed / 90);
        }
      });
    }

    // Fever timing check & progress bar update
    if (this.feverActive) {
      const remainingMs = this.feverUntil - this.elapsed;
      this.feverProgress = Math.max(0, (remainingMs / 6000) * 100);
      this.updateFeverBar();
      if (this.feverProgress <= 0) {
        this.stopFeverMode();
      }
    }

    // Anomaly scheduling
    if (!this.feverActive && !this.syncActive) {
      if (!this.anomalyType && this.elapsed >= this.nextAnomalyAt) {
        this.startAnomaly();
      } else if (this.anomalyType && this.elapsed >= this.anomalyUntil) {
        this.stopAnomaly();
      }
    }

    // Sync events
    if (!this.syncActive && this.elapsed >= this.nextSyncAt) this.startSync();
    if (this.syncActive && this.elapsed >= this.syncUntil) {
      this.syncActive = false;
      this.syncText.setVisible(false);
      this.syncTween.pause();
      this.divider.setFillStyle(COLORS.GOLD_HEX, 0.3);
      this.divider.scaleY = 1;
      this.nextSyncAt = this.elapsed + this.rand(CFG.SYNC_MIN_MS, CFG.SYNC_MAX_MS);

      // Stop and hide grids
      this.syncGrids.forEach((g) => {
        this.tweens.killTweensOf(g);
        this.tweens.add({
          targets: g,
          alpha: 0,
          duration: 200,
          onComplete: () => g.setVisible(false),
        });
      });
    }

    // Freeze power-up spawning
    if (this.elapsed >= this.nextPowerupAt) {
      if (this.spawnPowerup()) {
        this.nextPowerupAt = this.elapsed + this.rand(CFG.POWERUP_MIN_MS, CFG.POWERUP_MAX_MS);
      } else {
        this.nextPowerupAt = this.elapsed + 200; // retry shortly
      }
    }

    let died = false;
    Object.values(this.worlds).forEach((w) => {
      if (this.updateWorld(w, dt)) died = true;
    });

    // Speed lines at high velocity, fever, or warp speed.
    const fast = this.speed > 560 || this.feverActive || this.anomalyType === 'warp_speed';
    if (fast !== this.linesOn) {
      this.linesOn = fast;
      if (fast) this.speedLines.start();
      else this.speedLines.stop();
    }

    // Score milestone pulse every 100 points.
    const milestone = Math.floor(this.score / 100);
    if (milestone > this.lastMilestone) {
      this.lastMilestone = milestone;
      this.tweens.add({ targets: this.scoreText, scale: 1.25, duration: 120, yoyo: true });

      // Major milestone banners
      const score = milestone * 100;
      if (score === 500 || score === 1000 || score === 2000 || score === 5000) {
        this.showMilestoneBanner(score);
      }
    }

    // Combo timeout — clear combo display if it expired
    if (this.combo > 0 && this.elapsed - this.lastCoinAt > CFG.COMBO_TIMEOUT_MS) {
      this.clearComboDisplay(true);
      this.combo = 0;
    }

    this.scoreText.setText(String(Math.floor(this.score)));
    if (died) this.endRun();
  }

  showMilestoneBanner(score) {
    const cx = CFG.WIDTH / 2;
    const banner = this.add
      .text(cx, -30, `\uD83D\uDD25 ${score}!`, {
        fontFamily: FONTS.HEADING,
        fontSize: '36px',
        color: COLORS.GOLD,
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(22);
    banner.setResolution(DPR * 1.25);
    // Slide in, hold, fade out
    this.tweens.add({
      targets: banner,
      y: 270,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(600, () => {
          this.tweens.add({
            targets: banner,
            alpha: 0,
            y: 240,
            duration: 300,
            ease: 'Cubic.easeIn',
            onComplete: () => banner.destroy(),
          });
        });
      },
    });
  }

  updateWorld(w, dt) {
    const frozen = this.elapsed < w.frozenUntil;
    if (w.wasFrozen && !frozen) {
      this.shatterIce(w);
    }
    w.wasFrozen = frozen;

    w.freezeOverlay.setVisible(frozen);
    w.freezeBorders.setVisible(frozen);
    w.freezeText.setVisible(frozen);
    if (frozen && !w.snow.emitting) w.snow.start();
    if (!frozen && w.snow.emitting) w.snow.stop();
    if (frozen) return false; // no movement, no score, invulnerable

    // Each active world contributes to the score; a frozen world does not.
    this.score += this.speed * dt * CFG.SCORE_RATE;

    // Scenery: parallax layers, ground stripes, star twinkle
    w.parallax.forEach((p) => {
      p.obj.x -= this.speed * p.factor * dt;
      if (p.obj.x < -p.halfW - 50) p.obj.x += CFG.WIDTH + (p.halfW + 50) * 2;
    });
    w.stripes.forEach((st) => {
      st.x -= this.speed * dt;
      if (st.x < -30) st.x += CFG.WIDTH + 60;
    });
    w.stars.forEach((s) => {
      s.obj.alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(this.elapsed / 300 + s.tw));
    });

    if (!this.syncActive && this.elapsed >= w.nextSpawnAt) this.trySpawn(w);
    if (!this.syncActive && this.elapsed >= w.nextCoinAt) {
      if (this.feverActive) {
        this.spawnFeverCoin(w);
      } else {
        this.spawnCoinPattern(w);
      }
    }

    w.runner.update(dt, this.speed / CFG.MAX_SPEED);
    if (w.runner.consumeLanded()) w.dust.explode(6, CFG.RUNNER_X, w.def.groundY);
    const hitbox = w.runner.getHitbox();

    // Update follow graphics positions for Shield and Magnet
    if (w.shieldActive && w.shieldGfx) {
      w.shieldGfx.setPosition(CFG.RUNNER_X, w.runner.container.y - 12);
      w.shieldGfx.scale = 1 + 0.06 * Math.sin(this.elapsed / 110);
    }

    if (w.magnetActive && w.magnetGfx) {
      w.magnetGfx.setPosition(CFG.RUNNER_X, w.runner.container.y - 12);
      w.magnetGfx.scale = 1 + 0.1 * Math.sin(this.elapsed / 80);
      w.magnetGfx.rotation += 0.05;
      if (this.elapsed >= w.magnetUntil) {
        w.magnetActive = false;
        w.magnetGfx.destroy();
        w.magnetGfx = null;
      }
    }

    // Update and collide with Speed Boost Pads
    for (let i = w.boostPads.length - 1; i >= 0; i--) {
      const b = w.boostPads[i];
      b.x -= this.speed * dt;
      b.gfx.x = b.x;
      if (b.x < -80) {
        b.gfx.destroy();
        w.boostPads.splice(i, 1);
        continue;
      }
      const dist = Math.abs(CFG.RUNNER_X - b.x);
      if (dist < 28 && w.runner.onGround) {
        this.boostActive = true;
        this.boostUntil = this.elapsed + 1200; // 1.2s boost
        audio.play('boost');
        screenFlash(this, COLORS.CYAN_HEX, 0.15, 200);
        b.gfx.destroy();
        w.boostPads.splice(i, 1);
      }
    }

    // Update and collide with Crumbling Ground
    for (let i = w.crumblingGround.length - 1; i >= 0; i--) {
      const cg = w.crumblingGround[i];
      cg.x -= this.speed * dt;
      cg.gfx.x = cg.x;
      if (cg.x < -120) {
        this.tweens.killTweensOf(cg.gfx);
        cg.gfx.destroy();
        w.crumblingGround.splice(i, 1);
        continue;
      }

      const runnerOver = Math.abs(CFG.RUNNER_X - cg.x) < 40;
      if (runnerOver && w.runner.onGround && !cg.stepped) {
        cg.stepped = true;
        cg.stepTime = this.elapsed;
        audio.play('crumble');
        this.tweens.add({
          targets: cg.gfx,
          x: cg.gfx.x + 3,
          duration: 50,
          yoyo: true,
          repeat: 4,
          onComplete: () => {
            this.tweens.add({
              targets: cg.gfx,
              y: w.def.groundY + 120,
              alpha: 0,
              duration: 250,
              ease: 'Cubic.easeIn'
            });
          }
        });
      }

      if (cg.stepped && (this.elapsed - cg.stepTime > 250)) {
        if (Math.abs(CFG.RUNNER_X - cg.x) < 32 && w.runner.onGround && this.elapsed >= this.invulnUntil) {
          w.runner.setDead();
          this.tweens.add({
            targets: w.runner.container,
            y: w.def.groundY + 120,
            duration: 300,
            onComplete: () => {
              this.endRun();
            }
          });
          return true;
        }
      }
    }

    for (let i = w.obstacles.length - 1; i >= 0; i--) {
      const o = w.obstacles[i];
      o.x -= this.speed * dt;
      o.gfx.x = o.x;

      // Dynamic movements
      if (o.type === 'spikes') {
        const distToPlayer = o.x - CFG.RUNNER_X;
        if (distToPlayer < 380 && !o.rising) {
          o.rising = true;
          this.tweens.add({
            targets: o.gfx,
            y: o.gy,
            duration: 180,
            ease: 'Back.easeOut'
          });
        }
      } else if (o.type === 'crate' || o.type === 'crate2') {
        const bounce = Math.abs(Math.sin((this.elapsed + o.x * 2.5) / 160)) * 36;
        o.gfx.y = o.gy - bounce;
      } else if (o.type === 'gate') {
        const float = Math.sin(this.elapsed / 400) * 20;
        o.gfx.y = o.gy + float;
      } else if (o.type === 'drone') {
        const float = Math.sin((this.elapsed + o.x * 2.0) / 200) * 24;
        o.gfx.y = o.gy + float;
      }

      if (o.x < -80) {
        this.tweens.killTweensOf(o.gfx);
        o.gfx.destroy();
        w.obstacles.splice(i, 1);
        continue;
      }
      if (
        this.elapsed >= this.invulnUntil &&
        Phaser.Geom.Intersects.RectangleToRectangle(this.obstacleRect(o), hitbox)
      ) {
        if (this.overdriveActive || w.runner.dashing) {
          this.smashObstacle(w, o, i);
        } else if (w.shieldActive) {
          this.shatterShield(w, o, i);
        } else {
          w.runner.setDead();
          return true;
        }
      }
    }

    for (let i = w.powerups.length - 1; i >= 0; i--) {
      const p = w.powerups[i];
      p.x -= this.speed * dt;
      p.gfx.x = p.x;
      p.rays.rotation += dt * 2.5;
      p.glow.alpha = 0.2 + 0.12 * Math.sin(this.elapsed / 120);
      if (p.x < -40) {
        p.gfx.destroy();
        w.powerups.splice(i, 1);
        continue;
      }
      const circle = new Phaser.Geom.Circle(p.x, p.y, p.r);
      if (Phaser.Geom.Intersects.CircleToRectangle(circle, hitbox)) {
        const type = p.type || 'freeze';
        p.gfx.destroy();
        w.powerups.splice(i, 1);
        if (type === 'freeze') {
          this.freezeOtherWorld(w.def.key);
        } else if (type === 'overdrive') {
          this.startOverdrive();
        } else if (type === 'shield') {
          this.activateShield(w);
        } else if (type === 'magnet') {
          this.activateMagnet(w);
        }
      }
    }

    for (let i = w.coins.length - 1; i >= 0; i--) {
      const c = w.coins[i];
      let attracted = false;
      if (w.magnetActive) {
        const rx = CFG.RUNNER_X;
        const ry = w.runner.container.y;
        const dx = rx - c.x;
        const dy = ry - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 350) {
          attracted = true;
          const pullForce = Math.max(800, 1200 - dist * 1.5);
          if (dist < 10) {
            c.x = rx;
            c.y = ry;
          } else {
            c.x += (dx / dist) * pullForce * dt;
            c.y += (dy / dist) * pullForce * dt;
          }
          c.gfx.x = c.x;
          c.gfx.y = c.y;
        }
      }
      if (!attracted) {
        c.x -= this.speed * dt;
        c.gfx.x = c.x;
      }
      if (c.x < -30) {
        c.gfx.destroy();
        w.coins.splice(i, 1);
        continue;
      }
      const circle = new Phaser.Geom.Circle(c.x, c.y, c.r);
      if (Phaser.Geom.Intersects.CircleToRectangle(circle, hitbox)) {
        this.collectCoin(c);
        c.gfx.destroy();
        w.coins.splice(i, 1);
      }
    }

    return false;
  }

  // Fairness rule: never require inputs in both worlds within an
  // unreactable window, except during deliberate sync events.
  trySpawn(w) {
    if (this.feverActive) return;
    const spawnX = CFG.WIDTH + 60;

    // Check for overlap with existing elements in this world
    const obstacleNear = w.obstacles.some((o) => Math.abs(o.x - spawnX) < 180);
    const powerupNear = w.powerups.some((p) => Math.abs(p.x - spawnX) < 180);
    const coinNear = w.coins.some((c) => Math.abs(c.x - spawnX) < 180);
    const boostNear = w.boostPads.some((b) => Math.abs(b.x - spawnX) < 180);
    const crumblingNear = w.crumblingGround.some((cg) => Math.abs(cg.x - spawnX) < 180);
    if (obstacleNear || powerupNear || coinNear || boostNear || crumblingNear) {
      w.nextSpawnAt = this.elapsed + 100; // retry shortly
      return;
    }

    const arrival = this.elapsed + ((spawnX - CFG.RUNNER_X) / this.speed) * 1000;
    const other = this.worlds[w.def.key === 'light' ? 'dark' : 'light'];
    const conflict = other.obstacles.some(
      (o) => o.arrival > this.elapsed && Math.abs(o.arrival - arrival) < CFG.MIN_CROSS_GAP_MS
    );
    if (conflict) {
      w.nextSpawnAt = this.elapsed + 130; // retry shortly
      return;
    }

    const randVal = Math.random();
    if (randVal < 0.10) {
      this.spawnBoostPad(w, spawnX);
    } else if (randVal < 0.20) {
      this.spawnCrumblingGround(w, spawnX);
    } else {
      this.spawnObstacle(w, this.randomSpec(), spawnX, arrival);
    }
    w.nextSpawnAt = this.elapsed + this.rand(CFG.SPAWN_GAP_MIN_MS, CFG.SPAWN_GAP_MAX_MS);
  }

  randomSpec() {
    const r = Math.random();
    if (r < 0.25) return { type: 'crate', w: 38, h: 38 };
    if (r < 0.45) return { type: 'crate2', w: 38, h: 76 };
    if (r < 0.65) return { type: 'spikes', w: 50, h: 40 };
    if (r < 0.8) return { type: 'gate', w: 30, h: 130, gap: 34 };
    return { type: 'drone', w: 40, h: 30 };
  }

  spawnObstacle(w, spec, x, arrival) {
    const def = w.def;
    const parts = [];

    const buildCrate = (cy) => {
      parts.push(this.add.rectangle(0, cy, 38, 38, def.crate).setStrokeStyle(3, def.crateEdge));
      parts.push(this.add.rectangle(0, cy, 44, 4, def.crateEdge).setRotation(0.785));
      parts.push(this.add.rectangle(0, cy, 44, 4, def.crateEdge).setRotation(-0.785));
      // Pseudo-3D shading: lit top edge, shaded right side.
      parts.push(this.add.rectangle(0, cy - 14, 32, 5, 0xffffff, 0.18));
      parts.push(this.add.rectangle(14, cy, 7, 34, 0x000000, 0.18));
    };

    if (spec.type === 'crate') {
      buildCrate(-19);
    } else if (spec.type === 'crate2') {
      buildCrate(-19);
      buildCrate(-57);
    } else if (spec.type === 'gate') {
      const slabH = spec.h;
      const slabCy = -(spec.gap + slabH / 2);
      const slabTopAbs = def.groundY - spec.gap - slabH;
      const chainH = Math.max(slabTopAbs - def.top, 0);
      if (chainH > 0) {
        parts.push(
          this.add.rectangle(0, -(spec.gap + slabH + chainH / 2), 6, chainH, def.crateEdge, 0.8)
        );
      }
      parts.push(this.add.rectangle(0, slabCy, spec.w, slabH, def.crate).setStrokeStyle(3, def.crateEdge));
      // Hazard stripes + lit bottom edge marking the safe gap.
      parts.push(this.add.rectangle(0, slabCy + 24, 26, 6, 0xffd34d, 0.85).setRotation(0.6));
      parts.push(this.add.rectangle(0, slabCy + 44, 26, 6, 0xffd34d, 0.85).setRotation(0.6));
      parts.push(this.add.rectangle(0, -(spec.gap + 2), spec.w + 4, 4, 0xffffff, 0.35));
    } else if (spec.type === 'drone') {
      parts.push(this.add.ellipse(0, -56, spec.w, spec.h, def.crate).setStrokeStyle(3, def.crateEdge));
      parts.push(this.add.rectangle(-22, -56, 10, 4, def.crateEdge));
      parts.push(this.add.rectangle(22, -56, 10, 4, def.crateEdge));
      const eye = this.add.circle(0, -56, 4.5, 0xff3b30);
      parts.push(eye);
      this.tweens.add({
        targets: eye,
        alpha: 0.2,
        duration: 200,
        yoyo: true,
        repeat: -1
      });
      audio.play('drone');
    } else {
      parts.push(this.add.rectangle(0, -7, 52, 10, def.crateEdge));
      parts.push(this.add.rectangle(0, -10, 52, 2, 0xffffff, 0.15));
      [-16, 0, 16].forEach((sx) => {
        parts.push(this.add.triangle(sx, -25, 0, 30, 16, 30, 8, 0, def.spike));
        // Lit left face of each spike.
        parts.push(this.add.triangle(sx - 2, -27, 0, 22, 9, 22, 5, 0, 0xffffff, 0.16));
      });
    }

    const isSpike = (spec.type === 'spikes');
    const startY = isSpike ? def.groundY + 30 : def.groundY;
    const gfx = this.add.container(x, startY, parts).setDepth(3);
    w.obstacles.push({
      x,
      w: spec.w,
      h: spec.h,
      gap: spec.gap,
      gy: def.groundY,
      arrival,
      gfx,
      type: spec.type,
      rising: false
    });
  }

  obstacleRect(o) {
    const currentY = o.gfx.y;
    if (o.gap) {
      // Hanging gate: solid from (gap above ground) upward.
      return new Phaser.Geom.Rectangle(o.x - o.w / 2 + 4, currentY - o.gap - o.h + 2, o.w - 8, o.h - 4);
    }
    if (o.type === 'drone') {
      return new Phaser.Geom.Rectangle(o.x - o.w / 2 + 3, currentY - 56 - o.h / 2 + 3, o.w - 6, o.h - 6);
    }
    return new Phaser.Geom.Rectangle(o.x - o.w / 2 + 5, currentY - o.h + 5, o.w - 10, o.h - 5);
  }

  // Coin rows on the ground or arcs that reward a well-timed jump.
  spawnCoinPattern(w) {
    const gy = w.def.groundY;
    const baseX = CFG.WIDTH + 80;
    const arc = Math.random() < 0.5;
    const count = arc ? 5 : 4;
    const patternWidth = (count - 1) * 36;
    const minX = baseX - 180;
    const maxX = baseX + patternWidth + 180;

    // Check for overlap with existing elements in this world
    const obstacleNear = w.obstacles.some((o) => o.x >= minX && o.x <= maxX);
    const powerupNear = w.powerups.some((p) => p.x >= minX && p.x <= maxX);
    const coinNear = w.coins.some((c) => c.x >= minX && c.x <= maxX);
    const boostNear = w.boostPads.some((b) => b.x >= minX && b.x <= maxX);
    const crumblingNear = w.crumblingGround.some((cg) => cg.x >= minX && cg.x <= maxX);
    if (obstacleNear || powerupNear || coinNear || boostNear || crumblingNear) {
      w.nextCoinAt = this.elapsed + this.rand(400, 800);
      return;
    }

    const ys = arc ? [gy - 34, gy - 78, gy - 100, gy - 78, gy - 34] : [gy - 32, gy - 32, gy - 32, gy - 32];
    ys.forEach((y, i) => {
      const x = baseX + i * 36;
      const gfx = this.add.circle(x, y, 9, 0xffd34d).setStrokeStyle(2, 0xa87b1f).setDepth(3);
      // Spin: squash horizontally and back, staggered along the pattern.
      this.tweens.add({ targets: gfx, scaleX: 0.25, duration: 380, yoyo: true, repeat: -1, delay: i * 60 });
      w.coins.push({ x, y, r: 11, gfx });
    });
    w.nextCoinAt = this.elapsed + this.rand(CFG.COIN_MIN_MS, CFG.COIN_MAX_MS);
  }

  spawnBoostPad(w, x) {
    const gy = w.def.groundY;
    const parts = [];
    const baseColor = w.def.key === 'light' ? 0x00aa77 : 0x00ffaa;

    // Draw 3 chevrons pointing right
    for (let i = 0; i < 3; i++) {
      const arrow = this.add.polygon(-12 + i * 12, 0, [0,-6, 8,0, 0,6, -3,6, 5,0, -3,-6], baseColor);
      parts.push(arrow);
    }

    const gfx = this.add.container(x, gy, parts).setDepth(2);
    w.boostPads.push({
      x,
      y: gy,
      gfx
    });
  }

  spawnCrumblingGround(w, x) {
    const gy = w.def.groundY;
    const parts = [];
    // Base block
    const block = this.add.rectangle(0, 6, 74, 12, 0x3a3a4a).setStrokeStyle(2, 0xff5a5a);
    parts.push(block);
    // Warning stripes
    for (let i = -3; i <= 3; i++) {
      const stripe = this.add.rectangle(i * 10, 6, 3, 14, 0xff5a5a).setRotation(0.5);
      parts.push(stripe);
    }

    const gfx = this.add.container(x, gy, parts).setDepth(2);
    w.crumblingGround.push({
      x,
      y: gy,
      gfx,
      stepped: false,
      stepTime: 0
    });
  }

  collectCoin(c) {
    if (this.elapsed - this.lastCoinAt > CFG.COMBO_TIMEOUT_MS) this.combo = 0;
    this.combo++;
    this.comboHigh = Math.max(this.comboHigh, this.combo);
    this.lastCoinAt = this.elapsed;
    const value = Math.min(5 + this.combo, 30);
    this.score += value;
    this.coins++;
    this.coinText.setText(`\u25cf ${this.coins}`);
    this.floatText(c.x, c.y - 14, this.combo > 1 ? `+${value} x${this.combo}` : `+${value}`);

    // Pitch-rising coin tone (scales with combo)
    if (audio.playCoinCombo) {
      audio.playCoinCombo(this.combo);
    } else {
      audio.play('coin');
    }

    // Golden sparks pop
    const sparkEmitter = this.add.particles(c.x, c.y, 'spark', {
      speed: { min: 60, max: 140 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xffd34d,
      lifespan: 500,
      gravityY: 100,
      emitting: false,
    }).setDepth(5);
    sparkEmitter.explode(7);
    this.time.delayedCall(600, () => sparkEmitter.destroy());

    // Screen-edge gold flash every 5th consecutive combo coin
    if (this.combo > 0 && this.combo % 5 === 0) {
      const edgeL = this.add.rectangle(0, CFG.HEIGHT / 2, 6, CFG.HEIGHT, COLORS.GOLD_HEX, 0.4).setDepth(996);
      const edgeR = this.add.rectangle(CFG.WIDTH, CFG.HEIGHT / 2, 6, CFG.HEIGHT, COLORS.GOLD_HEX, 0.4).setDepth(996);
      this.tweens.add({
        targets: [edgeL, edgeR],
        alpha: 0,
        duration: 350,
        ease: 'Cubic.easeOut',
        onComplete: () => { edgeL.destroy(); edgeR.destroy(); },
      });
    }

    // Combo counter display
    if (this.combo >= 3) {
      this.updateComboDisplay();
    }

    // Fever progress
    if (!this.feverActive) {
      this.feverProgress = Math.min(100, this.feverProgress + 4);
      this.updateFeverBar();
      if (this.feverProgress >= 100) {
        this.startFeverMode();
      }
    }
  }

  updateComboDisplay() {
    const cx = CFG.WIDTH / 2;
    let fontSize, color;
    if (this.combo >= 10) {
      fontSize = '26px';
      color = COLORS.RED;
    } else if (this.combo >= 6) {
      fontSize = '22px';
      color = '#FF8C00';
    } else {
      fontSize = '18px';
      color = COLORS.GOLD;
    }

    if (this.comboText) {
      this.comboText.setText(`x${this.combo}`);
      this.comboText.setFontSize(fontSize);
      this.comboText.setColor(color);
    } else {
      this.comboText = this.add
        .text(cx, 80, `x${this.combo}`, {
          fontFamily: FONTS.HEADING,
          fontSize,
          color,
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setAlpha(0);
      this.comboText.setResolution(DPR * 1.25);
      this.tweens.add({ targets: this.comboText, alpha: 1, duration: 150 });
    }

    // Rapid pulse for high combos
    if (this.combo >= 10 && !this.comboTween) {
      this.comboTween = this.tweens.add({
        targets: this.comboText,
        scale: 1.15,
        duration: 120,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  clearComboDisplay(showLost = false) {
    if (this.comboTween) {
      this.comboTween.destroy();
      this.comboTween = null;
    }
    if (this.comboText) {
      this.comboText.destroy();
      this.comboText = null;
    }
    if (showLost && this.combo >= 3) {
      const cx = CFG.WIDTH / 2;
      const lost = this.add
        .text(cx, 80, 'COMBO LOST', {
          fontFamily: FONTS.MONO,
          fontSize: '14px',
          color: COLORS.TEXT_MUTED,
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(20);
      lost.setResolution(DPR * 1.25);
      this.tweens.add({ targets: lost, alpha: 0, y: 70, duration: 500, onComplete: () => lost.destroy() });
    }
  }

  floatText(x, y, str, color = COLORS.GOLD) {
    const t = this.add
      .text(x, y, str, {
        fontFamily: FONTS.MONO,
        fontSize: '14px',
        color: typeof color === 'string' ? color : '#' + color.toString(16).padStart(6, '0'),
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);
    t.setResolution(DPR * 1.25);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 650, onComplete: () => t.destroy() });
  }

  startSync() {
    const anyFrozen = Object.values(this.worlds).some((w) => this.elapsed < w.frozenUntil);
    if (anyFrozen) {
      this.nextSyncAt = this.elapsed + 3000;
      return;
    }
    const spec = this.randomSpec();
    const spawnX = CFG.WIDTH + 60;
    const arrival = this.elapsed + ((spawnX - CFG.RUNNER_X) / this.speed) * 1000;
    Object.values(this.worlds).forEach((w) => {
      this.spawnObstacle(w, spec, spawnX, arrival);
      w.nextSpawnAt = arrival + 450; // keep the sync moment clean
    });
    this.syncActive = true;
    this.syncUntil = arrival + 450;
    this.syncText.setVisible(true);
    this.syncTween.resume();
    // Enhanced sync divider: expand and glow gold
    this.divider.setFillStyle(COLORS.GOLD_HEX, 0.8);
    this.divider.scaleY = 3;
    // Camera zoom punch to sell the moment (relative to the DPR base zoom).
    this.cameras.main.zoomTo(DPR * 1.04, 150, 'Sine.easeInOut');
    this.time.delayedCall(320, () => this.cameras.main.zoomTo(DPR, 220, 'Sine.easeInOut'));
    audio.play('sync');

    // Shockwave
    const cx = CFG.WIDTH / 2;
    const wave = this.add.circle(cx, 270, 10, COLORS.GOLD_HEX, 0).setStrokeStyle(3, COLORS.GOLD_HEX, 0.85).setDepth(8);
    this.tweens.add({
      targets: wave,
      radius: 400,
      alpha: 0,
      duration: 550,
      ease: 'Quad.easeOut',
      onComplete: () => wave.destroy(),
    });

    // Pulse grids
    this.syncGrids.forEach((g) => {
      g.setVisible(true);
      g.setAlpha(0);
      this.tweens.add({
        targets: g,
        alpha: { from: 0.04, to: 0.16 },
        duration: 350,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  spawnPowerup() {
    if (this.syncActive) return false;
    const keys = Object.keys(this.worlds).filter((k) => this.elapsed >= this.worlds[k].frozenUntil);
    if (keys.length === 0) return false;
    const w = this.worlds[keys[Math.floor(Math.random() * keys.length)]];
    const spawnX = CFG.WIDTH + 40;

    // Check for overlap with existing elements in this world
    const obstacleNear = w.obstacles.some((o) => Math.abs(o.x - spawnX) < 180);
    const powerupNear = w.powerups.some((p) => Math.abs(p.x - spawnX) < 180);
    const coinNear = w.coins.some((c) => Math.abs(c.x - spawnX) < 180);
    const boostNear = w.boostPads.some((b) => Math.abs(b.x - spawnX) < 180);
    const crumblingNear = w.crumblingGround.some((cg) => Math.abs(cg.x - spawnX) < 180);
    if (obstacleNear || powerupNear || coinNear || boostNear || crumblingNear) {
      return false; // delayed
    }

    const y = w.def.groundY - 36;
    const r = Math.random();
    let type = 'freeze';
    if (r < 0.25) {
      type = 'overdrive';
    } else if (r < 0.5) {
      type = 'shield';
    } else if (r < 0.75) {
      type = 'magnet';
    } else {
      type = 'freeze';
    }

    // Design-appropriate colors
    let color = 0x7fd4ff;
    let coreColor = 0x59c2ff;
    if (type === 'overdrive') {
      color = 0xff7dfd;
      coreColor = 0xff2fa0;
    } else if (type === 'shield') {
      color = 0x7fff7f;
      coreColor = 0x00e600;
    } else if (type === 'magnet') {
      color = 0xffd34d;
      coreColor = 0xe57c00;
    }

    const glow = this.add.circle(0, 0, 19, color, 0.25);
    const r1 = this.add.rectangle(0, 0, 32, 3, 0xffffff, 0.9);
    const r2 = this.add.rectangle(0, 0, 32, 3, 0xffffff, 0.9).setRotation(Math.PI / 2);
    const rays = this.add.container(0, 0, [r1, r2]);
    const core = this.add.circle(0, 0, 11, coreColor).setStrokeStyle(2, 0xffffff);

    const iconParts = [];
    if (type === 'freeze') {
      const line1 = this.add.rectangle(0, 0, 10, 1.5, 0xffffff);
      const line2 = this.add.rectangle(0, 0, 10, 1.5, 0xffffff).setRotation(Math.PI / 3);
      const line3 = this.add.rectangle(0, 0, 10, 1.5, 0xffffff).setRotation(-Math.PI / 3);
      iconParts.push(line1, line2, line3);
    } else if (type === 'overdrive') {
      const bolt = this.add.polygon(0, 0, [-2,-5, 2,-5, -1,0, 3,0, -2,5, 0,1, -2,1], 0xffffff).setScale(0.9);
      iconParts.push(bolt);
    } else if (type === 'shield') {
      const shield = this.add.graphics();
      shield.fillStyle(0xffffff, 1);
      shield.beginPath();
      shield.moveTo(-4, -4);
      shield.lineTo(4, -4);
      shield.lineTo(4, 0);
      shield.quadraticCurveTo(4, 4, 0, 6);
      shield.quadraticCurveTo(-4, 4, -4, 0);
      shield.closePath();
      shield.fillPath();
      iconParts.push(shield);
    } else if (type === 'magnet') {
      const magnetLeft = this.add.rectangle(-3, -3, 2.5, 4, 0xff5a5a);
      const magnetRight = this.add.rectangle(3, -3, 2.5, 4, 0x59c2ff);
      const magnetBody = this.add.graphics();
      magnetBody.lineStyle(2.5, 0xdddddd, 1);
      magnetBody.beginPath();
      magnetBody.moveTo(-3, -1);
      magnetBody.lineTo(-3, 1);
      magnetBody.quadraticCurveTo(0, 4, 3, 1);
      magnetBody.lineTo(3, -1);
      magnetBody.strokePath();
      iconParts.push(magnetLeft, magnetRight, magnetBody);
    }

    const gfx = this.add.container(spawnX, y, [glow, rays, core, ...iconParts]).setDepth(3);
    w.powerups.push({ x: spawnX, y, r: 13, gfx, rays, glow, type });
    return true;
  }

  activateShield(w) {
    audio.play('sync');
    screenFlash(this, 0x39ff14, 0.15, 250);

    w.shieldActive = true;
    if (w.shieldGfx) {
      w.shieldGfx.destroy();
    }
    w.shieldGfx = this.add.circle(CFG.RUNNER_X, w.runner.container.y - 12, 28, 0x39ff14, 0.1)
      .setStrokeStyle(2, 0x39ff14, 0.7)
      .setDepth(4);

    // Hexagonal ripple effect
    const rx = CFG.RUNNER_X;
    const ry = w.runner.container.y - 12;
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(rx, ry, 12 + i * 8, 0x39ff14, 0)
        .setStrokeStyle(2, 0x39ff14, 0.6 - i * 0.15)
        .setDepth(5);
      this.tweens.add({
        targets: ring,
        radius: 50 + i * 20,
        alpha: 0,
        duration: 400 + i * 80,
        delay: i * 60,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      });
    }

    // Green spark burst
    const burst = this.add.particles(rx, ry, 'spark', {
      speed: { min: 80, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: 0x39ff14,
      lifespan: 450,
      emitting: false,
    }).setDepth(5);
    burst.explode(10);
    this.time.delayedCall(500, () => burst.destroy());

    this.floatText(rx, ry - 28, 'SHIELD ACTIVE', 0x39ff14);
  }

  shatterShield(w, o, index) {
    w.shieldActive = false;
    if (w.shieldGfx) {
      w.shieldGfx.destroy();
      w.shieldGfx = null;
    }

    audio.play('hit');
    const emitter = this.add.particles(o.x, o.gy - o.h / 2, 'spark', {
      speed: { min: 100, max: 250 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0.1 },
      alpha: { start: 1, end: 0 },
      tint: 0x39ff14, // neon green
      lifespan: 500,
      gravityY: 100,
      emitting: false,
    }).setDepth(5);
    emitter.explode(12);
    this.time.delayedCall(600, () => emitter.destroy());

    this.floatText(o.x, o.gy - o.h - 10, 'SHIELD BROKEN', 0x39ff14);

    // Grant brief invulnerability and blink effect
    this.invulnUntil = this.elapsed + 1500;
    this.tweens.add({
      targets: w.runner.container,
      alpha: 0.35,
      duration: 100,
      yoyo: true,
      repeat: 6,
      onComplete: () => w.runner.container.setAlpha(1),
    });

    this.tweens.killTweensOf(o.gfx);
    o.gfx.destroy();
    w.obstacles.splice(index, 1);
  }

  activateMagnet(w) {
    audio.play('sync');
    screenFlash(this, COLORS.GOLD_HEX, 0.15, 250);

    w.magnetActive = true;
    w.magnetUntil = this.elapsed + 6000; // 6 seconds active
    if (w.magnetGfx) {
      w.magnetGfx.destroy();
    }
    w.magnetGfx = this.add.circle(CFG.RUNNER_X, w.runner.container.y - 12, 24, COLORS.GOLD_HEX, 0)
      .setStrokeStyle(2, COLORS.GOLD_HEX, 0.7)
      .setDepth(4);

    // Golden magnetic field lines radiating outward
    const rx = CFG.RUNNER_X;
    const ry = w.runner.container.y - 12;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const line = this.add.rectangle(
        rx + Math.cos(angle) * 18,
        ry + Math.sin(angle) * 18,
        22, 2, COLORS.GOLD_HEX, 0.8
      ).setRotation(angle).setDepth(5);
      this.tweens.add({
        targets: line,
        x: rx + Math.cos(angle) * 80,
        y: ry + Math.sin(angle) * 80,
        alpha: 0,
        duration: 500,
        delay: i * 30,
        ease: 'Cubic.easeOut',
        onComplete: () => line.destroy(),
      });
    }

    // Make existing coins in this world glow briefly
    w.coins.forEach((c) => {
      if (c.gfx && c.gfx.active) {
        this.tweens.add({
          targets: c.gfx,
          scale: 1.5,
          duration: 200,
          yoyo: true,
        });
      }
    });

    this.floatText(rx, ry - 28, 'MAGNET ACTIVE', COLORS.GOLD);
  }

  freezeOtherWorld(collectorKey) {
    const otherKey = collectorKey === 'light' ? 'dark' : 'light';
    const otherW = this.worlds[otherKey];
    otherW.frozenUntil = this.elapsed + CFG.FREEZE_MS;
    audio.play('freeze');

    // Ice crystal shatter burst on the frozen world
    const cy = otherW.def.top + otherW.def.height / 2;
    const iceEmitter = this.add.particles(CFG.WIDTH / 2, cy, 'spark', {
      x: { min: -CFG.WIDTH / 3, max: CFG.WIDTH / 3 },
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xc4e5ff, 0x7fd4ff, 0xeef8ff],
      lifespan: 600,
      gravityY: 80,
      emitting: false,
    }).setDepth(7);
    iceEmitter.explode(14);
    this.time.delayedCall(700, () => iceEmitter.destroy());

    // Frost creep on divider
    const divX = CFG.WIDTH / 2;
    const frost = this.add.rectangle(divX, 270, 0, 6, 0xbfe9ff, 0.5).setDepth(9);
    this.tweens.add({
      targets: frost,
      width: CFG.WIDTH,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: frost,
          alpha: 0,
          duration: 600,
          onComplete: () => frost.destroy(),
        });
      },
    });
  }

  shatterIce(w) {
    audio.play('sync');
    const cy = w.def.top + w.def.height / 2;
    const flash = this.add.rectangle(CFG.WIDTH / 2, cy, CFG.WIDTH, w.def.height, 0xffffff, 0.25).setDepth(8);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy(),
    });
    const emitter = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: CFG.WIDTH },
      y: { min: w.def.top, max: w.def.top + w.def.height },
      speed: { min: 100, max: 280 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xc4e5ff,
      lifespan: 600,
      gravityY: 200,
      emitting: false,
    }).setDepth(7);
    emitter.explode(18);
    this.time.delayedCall(700, () => emitter.destroy());
    this.cameras.main.shake(150, 0.003);
  }

  startOverdrive() {
    this.overdriveActive = true;
    this.overdriveUntil = this.elapsed + 3500;
    audio.play('sync');
    screenFlash(this, 0xff00ff, 0.12, 200);

    // Neon scanline flash
    for (let i = 0; i < 6; i++) {
      const y = 40 + i * (CFG.HEIGHT / 6);
      const line = this.add.rectangle(CFG.WIDTH / 2, y, CFG.WIDTH, 2, 0xff00ff, 0.6).setDepth(997);
      this.tweens.add({
        targets: line,
        alpha: 0,
        scaleX: 1.2,
        duration: 300,
        delay: i * 30,
        onComplete: () => line.destroy(),
      });
    }

    // Create follow shields
    this.shields = [];
    Object.values(this.worlds).forEach((w) => {
      const shield = this.add.circle(CFG.RUNNER_X, w.runner.container.y - 12, 36, 0xff00ff, 0.15)
        .setStrokeStyle(2, 0xff00ff, 0.7)
        .setDepth(5);
      this.shields.push(shield);

      // Make particles dense
      w.runner.trailEmitter.setFrequency(10);
    });
  }

  smashObstacle(w, o, index) {
    audio.play('hit');
    const emitter = this.add.particles(o.x, o.gy - o.h / 2, 'spark', {
      speed: { min: 120, max: 300 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0.15 },
      alpha: { start: 1, end: 0 },
      tint: o.gap ? 0xff00ff : w.def.crateEdge,
      lifespan: 600,
      gravityY: 150,
      emitting: false,
    }).setDepth(5);
    emitter.explode(15);
    this.time.delayedCall(700, () => emitter.destroy());

    this.score += 150;
    this.floatText(o.x, o.gy - o.h - 10, '+150 SMASH!', 0xff00ff);
    this.cameras.main.shake(150, 0.006);

    this.tweens.killTweensOf(o.gfx);
    o.gfx.destroy();
    w.obstacles.splice(index, 1);
  }

  pauseGame() {
    if (this.isGameOver || this.isPaused) return;
    this.isPaused = true;
    this.showPauseMenu();
    portal.gameplayStop();
    audio.pauseBGM();
  }

  resumeGame() {
    this.isPaused = false;
    this.clearPauseMenu();
    portal.gameplayStart();
    audio.resumeBGM();
  }

  showPauseMenu() {
    if (this.pauseObjs) return;
    const cx = CFG.WIDTH / 2;
    const cy = CFG.HEIGHT / 2;
    const objs = [];

    // 1. Dark overlay
    const overlay = this.add.rectangle(cx, cy, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.65).setDepth(30);
    objs.push(overlay);

    // 2. Glassmorphic panel
    const panel = drawGlassPanel(this, cx - 200, cy - 110, 400, 220, 31);
    objs.push(panel);

    // 3. Title: PAUSED
    const title = this.add
      .text(cx, cy - 60, 'PAUSED', {
        fontFamily: FONTS.HEADING,
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(32);
    objs.push(title);

    // 4. Buttons
    const btnW = 100;
    const btnH = 38;
    const btnY = cy + 25;
    const btnR = 10;

    // --- RESUME Button (Gold) ---
    const resumeBg = this.add.graphics().setDepth(32);
    resumeBg.fillStyle(COLORS.GOLD_HEX, 1);
    resumeBg.fillRoundedRect(cx - 120 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR);
    objs.push(resumeBg);

    const resumeText = this.add
      .text(cx - 120, btnY, 'RESUME', {
        fontFamily: FONTS.HEADING,
        fontSize: '13px',
        color: '#1d1d24',
      })
      .setOrigin(0.5)
      .setDepth(33);
    objs.push(resumeText);

    const resumeHit = this.add
      .rectangle(cx - 120, btnY, btnW + 20, btnH + 16)
      .setDepth(34)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });
    resumeHit.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.resumeGame();
    });
    objs.push(resumeHit);

    // --- RESTART Button (Outline) ---
    const restartBg = this.add.graphics().setDepth(32);
    restartBg.fillStyle(0x0a0a14, 0.6);
    restartBg.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR);
    restartBg.lineStyle(1.5, COLORS.GOLD_HEX, 0.5);
    restartBg.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR);
    objs.push(restartBg);

    const restartText = this.add
      .text(cx, btnY, 'RESTART', {
        fontFamily: FONTS.HEADING,
        fontSize: '13px',
        color: COLORS.GOLD,
      })
      .setOrigin(0.5)
      .setDepth(33);
    objs.push(restartText);

    const restartHit = this.add
      .rectangle(cx, btnY, btnW + 20, btnH + 16)
      .setDepth(34)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });
    restartHit.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.clearPauseMenu();
      this.isPaused = false;
      this.scene.restart();
    });
    objs.push(restartHit);

    // --- MENU Button (Outline) ---
    const menuBg = this.add.graphics().setDepth(32);
    menuBg.fillStyle(0x0a0a14, 0.6);
    menuBg.fillRoundedRect(cx + 120 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR);
    menuBg.lineStyle(1.5, COLORS.GOLD_HEX, 0.5);
    menuBg.strokeRoundedRect(cx + 120 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnR);
    objs.push(menuBg);

    const menuText = this.add
      .text(cx + 120, btnY, 'MENU', {
        fontFamily: FONTS.HEADING,
        fontSize: '13px',
        color: COLORS.GOLD,
      })
      .setOrigin(0.5)
      .setDepth(33);
    objs.push(menuText);

    const menuHit = this.add
      .rectangle(cx + 120, btnY, btnW + 20, btnH + 16)
      .setDepth(34)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });
    menuHit.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.clearPauseMenu();
      this.isPaused = false;
      this.scene.start('Menu');
    });
    objs.push(menuHit);

    // ESC or P key listener to resume (only once while paused)
    this.pauseKeyEscListener = (event) => {
      if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
        this.resumeGame();
      }
    };
    window.addEventListener('keydown', this.pauseKeyEscListener);

    objs.forEach((o) => {
      if (o.setResolution && o.style) o.setResolution(DPR * 1.25);
    });

    this.pauseObjs = objs;

    // Animate entrance
    objs.forEach((o) => {
      if (o.setScale) o.setScale(0.9);
      o.setAlpha(0);
    });

    this.tweens.add({
      targets: objs,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
    });

    objs.forEach((o) => {
      if (o.setScale) {
        this.tweens.add({ targets: o, scale: 1, duration: 200, ease: 'Back.easeOut' });
      }
    });
  }

  clearPauseMenu() {
    if (this.pauseKeyEscListener) {
      window.removeEventListener('keydown', this.pauseKeyEscListener);
      this.pauseKeyEscListener = null;
    }
    if (this.pauseObjs) {
      this.pauseObjs.forEach((o) => o.destroy());
      this.pauseObjs = null;
    }
  }

  endRun() {
    this.isGameOver = true;
    audio.play('hit');
    portal.gameplayStop();
    // Enhanced death effects
    screenFlash(this, COLORS.RED_HEX, 0.20, 250);
    this.cameras.main.shake(350, 0.015);

    if (!this.reviveUsed) {
      this.time.delayedCall(250, () => this.showRevivePrompt());
    } else {
      this.time.delayedCall(350, () => this.finishRun());
    }
  }

  // ── Premium revive prompt ────────────────────────────────────
  showRevivePrompt() {
    const cx = CFG.WIDTH / 2;
    const objs = [];

    // Dim overlay
    objs.push(this.add.rectangle(cx, 270, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.6).setDepth(40));

    // Glassmorphic panel
    const panel = drawGlassPanel(this, cx - 200, 155, 400, 230, 41);
    objs.push(panel);

    const title = this.add
      .text(cx, 195, 'CONTINUE?', {
        fontFamily: FONTS.HEADING,
        fontSize: '30px',
        color: COLORS.GOLD,
      })
      .setOrigin(0.5)
      .setDepth(42);
    objs.push(title);

    this.reviveCountdownText = this.add
      .text(cx, 245, '3', {
        fontFamily: FONTS.HEADING,
        fontSize: '38px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(42);
    objs.push(this.reviveCountdownText);

    // Revive button — gold filled rectangle
    const btnW = 220;
    const btnH = 42;
    const btnBg = this.add.graphics().setDepth(42);
    btnBg.fillStyle(COLORS.GOLD_HEX, 1);
    btnBg.fillRoundedRect(cx - btnW / 2, 292 - btnH / 2, btnW, btnH, 10);
    objs.push(btnBg);

    const reviveBtnText = this.add
      .text(cx, 292, 'WATCH AD & REVIVE', {
        fontFamily: FONTS.HEADING,
        fontSize: '18px',
        color: '#1d1d24',
      })
      .setOrigin(0.5)
      .setDepth(43);
    objs.push(reviveBtnText);

    const reviveHit = this.add
      .rectangle(cx, 292, btnW, btnH)
      .setDepth(44)
      .setAlpha(0.001)
      .setInteractive({ useHandCursor: true });
    reviveHit.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.tryRevive();
    });
    objs.push(reviveHit);

    const skipBtn = this.add
      .text(cx, 340, 'NO THANKS', {
        fontFamily: FONTS.MONO,
        fontSize: '14px',
        color: COLORS.TEXT_SECONDARY,
      })
      .setOrigin(0.5)
      .setDepth(42)
      .setInteractive({ useHandCursor: true });
    skipBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.finishRun();
    });
    objs.push(skipBtn);

    objs.forEach((o) => {
      if (o.setResolution && o.style) o.setResolution(DPR * 1.25);
    });
    this.reviveObjs = objs;

    // Panel entrance animation
    objs.forEach((o) => {
      if (o.setScale) o.setScale(0.9);
      o.setAlpha(0);
    });
    this.tweens.add({
      targets: objs,
      alpha: 1,
      duration: 200,
    });
    objs.forEach((o) => {
      if (o.setScale) {
        this.tweens.add({ targets: o, scale: 1, duration: 200, ease: 'Back.easeOut' });
      }
    });

    let remaining = 3;
    this.reviveTimer = this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        remaining--;
        if (remaining <= 0) this.finishRun();
        else this.reviveCountdownText.setText(String(remaining));
      },
    });
  }

  clearRevivePrompt() {
    if (this.reviveTimer) {
      this.reviveTimer.remove(false);
      this.reviveTimer = null;
    }
    if (this.reviveObjs) {
      this.reviveObjs.forEach((o) => o.destroy());
      this.reviveObjs = null;
    }
  }

  tryRevive() {
    if (this.reviveBusy) return;
    this.reviveBusy = true;
    if (this.reviveTimer) {
      this.reviveTimer.remove(false);
      this.reviveTimer = null;
    }
    this.reviveCountdownText.setText('...');

    // Save state in case the ad SDK reloads/restarts the scene
    const reviveState = {
      score: this.score,
      elapsed: this.elapsed,
      coins: this.coins,
    };
    localStorage.setItem('shadow-runner-revive-state', JSON.stringify(reviveState));

    portal.rewardedAd().then((ok) => {
      this.reviveBusy = false;
      if (ok) {
        this.doRevive();
      } else {
        localStorage.removeItem('shadow-runner-revive-state');
        this.finishRun();
      }
    });
  }

  doRevive() {
    localStorage.removeItem('shadow-runner-revive-state');
    this.clearRevivePrompt();
    this.reviveUsed = true;

    this.stopFeverMode();
    this.stopAnomaly();

    Object.values(this.worlds).forEach((w) => {
      w.obstacles.forEach((o) => {
        this.tweens.killTweensOf(o.gfx);
        o.gfx.destroy();
      });
      w.obstacles = [];
      w.coins.forEach((c) => c.gfx.destroy());
      w.coins = [];
      w.powerups.forEach((p) => p.gfx.destroy());
      w.powerups = [];
      w.boostPads.forEach((b) => b.gfx.destroy());
      w.boostPads = [];
      w.crumblingGround.forEach((cg) => {
        this.tweens.killTweensOf(cg.gfx);
        cg.gfx.destroy();
      });
      w.crumblingGround = [];
      w.magnetActive = false;
      if (w.magnetGfx) {
        w.magnetGfx.destroy();
        w.magnetGfx = null;
      }
      w.shieldActive = false;
      if (w.shieldGfx) {
        w.shieldGfx.destroy();
        w.shieldGfx = null;
      }
      w.nextSpawnAt = this.elapsed + 1400;
      w.nextCoinAt = this.elapsed + 3000;
      w.runner.revive();
      // Blink to telegraph invulnerability.
      this.tweens.add({
        targets: w.runner.container,
        alpha: 0.25,
        duration: 140,
        yoyo: true,
        repeat: 6,
        onComplete: () => w.runner.container.setAlpha(1),
      });
    });

    this.invulnUntil = this.elapsed + 2000;
    this.clearComboDisplay();
    this.combo = 0;
    this.isGameOver = false;
    portal.gameplayStart();
  }

  finishRun() {
    if (this.runFinished) return;
    this.runFinished = true;
    this.clearRevivePrompt();
    audio.stopBGM();

    this.stopFeverMode();
    this.stopAnomaly();

    // Clean up active power-up graphics
    Object.values(this.worlds).forEach((w) => {
      w.magnetActive = false;
      if (w.magnetGfx) {
        w.magnetGfx.destroy();
        w.magnetGfx = null;
      }
      w.shieldActive = false;
      if (w.shieldGfx) {
        w.shieldGfx.destroy();
        w.shieldGfx = null;
      }
    });

    const finalScore = Math.floor(this.score);
    const isNewBest = finalScore > this.best;
    if (isNewBest) {
      this.best = finalScore;
      localStorage.setItem(CFG.BEST_KEY, String(finalScore));
    }

    // Lifetime stats for the home dashboard.
    localStorage.setItem(CFG.RUNS_KEY, String(Number(localStorage.getItem(CFG.RUNS_KEY) || 0) + 1));
    localStorage.setItem(
      CFG.COINS_KEY,
      String(Number(localStorage.getItem(CFG.COINS_KEY) || 0) + this.coins)
    );

    // Update Daily Challenge
    const challenge = getDailyChallenge();
    let currentVal = 0;
    if (challenge.type === 'coins') {
      currentVal = this.coins;
    } else if (challenge.type === 'jumps') {
      currentVal = this.runJumps;
    } else if (challenge.type === 'slides') {
      currentVal = this.runSlides;
    }

    const currentProgress = Number(localStorage.getItem(`challenge-progress-${challenge.dayString}`) || 0);
    const newProgress = Math.min(challenge.target, currentProgress + currentVal);
    localStorage.setItem(`challenge-progress-${challenge.dayString}`, String(newProgress));

    if (newProgress >= challenge.target) {
      localStorage.setItem(CHALLENGE_UNLOCKED_KEY, 'true');
    }

    this.time.delayedCall(100, () => {
      this.scene.start('GameOver', {
        score: finalScore,
        best: this.best,
        isNewBest,
        coins: this.coins,
        comboHigh: this.comboHigh
      });
    });
  }

  updateFeverBar() {
    this.feverBar.clear();
    if (this.feverProgress <= 0) return;
    const width = 160 * (this.feverProgress / 100);
    const cx = CFG.WIDTH / 2;
    const startX = cx - 80;

    // Draw gold progress fill
    this.feverBar.fillStyle(this.feverActive ? 0xffdf00 : COLORS.GOLD_HEX, 1);
    this.feverBar.fillRect(startX, 72, width, 6);

    // If fever is active, add a subtle neon outer glow
    if (this.feverActive) {
      this.feverBar.lineStyle(2, 0xffea00, 0.6);
      this.feverBar.strokeRect(startX - 1, 71, width + 2, 8);
    }
  }

  startFeverMode() {
    if (this.anomalyType) {
      this.stopAnomaly();
    }

    this.feverActive = true;
    this.feverUntil = this.elapsed + 6000; // 6.0 seconds

    audio.play('sync');
    screenFlash(this, COLORS.GOLD_HEX, 0.2, 300);
    chromaFlash(this, 300);
    this.showAnomalyBanner('FEVER MODE!', COLORS.GOLD_HEX);

    // Clear all obstacles, powerups, coins
    Object.values(this.worlds).forEach((w) => {
      w.obstacles.forEach((o) => {
        this.tweens.killTweensOf(o.gfx);
        o.gfx.destroy();
      });
      w.obstacles = [];

      w.powerups.forEach((p) => p.gfx.destroy());
      w.powerups = [];
      w.boostPads.forEach((b) => b.gfx.destroy());
      w.boostPads = [];
      w.crumblingGround.forEach((cg) => {
        this.tweens.killTweensOf(cg.gfx);
        cg.gfx.destroy();
      });
      w.crumblingGround = [];

      w.coins.forEach((c) => c.gfx.destroy());
      w.coins = [];

      w.nextCoinAt = this.elapsed; // start spawning coins immediately
    });

    // Pulse grids
    this.syncGrids.forEach((g) => {
      g.setVisible(true);
      g.setAlpha(0.15);
      this.tweens.killTweensOf(g);
      this.tweens.add({
        targets: g,
        alpha: 0.35,
        duration: 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  stopFeverMode() {
    if (this.feverActive) {
      // Power-down sweep visual
      const sweep = this.add.rectangle(CFG.WIDTH / 2, 0, CFG.WIDTH, 4, COLORS.GOLD_HEX, 0.6).setDepth(997);
      this.tweens.add({
        targets: sweep,
        y: CFG.HEIGHT,
        alpha: 0,
        duration: 400,
        ease: 'Cubic.easeIn',
        onComplete: () => sweep.destroy(),
      });
    }
    this.feverActive = false;
    this.feverProgress = 0;
    this.updateFeverBar();

    // Stop pulsing grids
    this.syncGrids.forEach((g) => {
      this.tweens.killTweensOf(g);
      this.tweens.add({
        targets: g,
        alpha: 0,
        duration: 300,
        onComplete: () => g.setVisible(false),
      });
    });

    // Reset next spawner times
    Object.values(this.worlds).forEach((w) => {
      w.nextSpawnAt = this.elapsed + this.rand(1200, 2000);
      w.nextCoinAt = this.elapsed + this.rand(2000, 4000);
    });
  }

  spawnFeverCoin(w) {
    const gy = w.def.groundY;
    const baseX = CFG.WIDTH + 30;

    // Sine-wave offset based on elapsed time to create a winding sine trail
    const waveY = gy - 60 + Math.sin(this.elapsed / 150) * 45;

    const gfx = this.add.circle(baseX, waveY, 9, 0xffd34d).setStrokeStyle(2, 0xa87b1f).setDepth(3);
    this.tweens.add({ targets: gfx, scaleX: 0.25, duration: 380, yoyo: true, repeat: -1 });
    w.coins.push({ x: baseX, y: waveY, r: 11, gfx });

    w.nextCoinAt = this.elapsed + 100; // spawn every 100ms
  }

  startAnomaly() {
    const types = ['low_gravity', 'warp_speed', 'fog_of_war'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.anomalyType = type;
    this.anomalyUntil = this.elapsed + 10000; // 10s duration

    if (type === 'low_gravity') {
      this.showAnomalyBanner('ANOMALY: LOW GRAVITY', 0x59c2ff);
      this.gravity = CFG.GRAVITY * 0.45;
      this.jumpVelocity = CFG.JUMP_VELOCITY * 0.72;
    } else if (type === 'warp_speed') {
      this.showAnomalyBanner('ANOMALY: WARP SPEED', 0xff7dfd);
    } else if (type === 'fog_of_war') {
      this.showAnomalyBanner('ANOMALY: FOG OF WAR', 0x8a8a9a);
      this.showFogOfWar(true);
    }

    audio.play('sync');
    glitchFlash(this, 200);
  }

  stopAnomaly() {
    if (!this.anomalyType) return;
    glitchFlash(this, 150);

    if (this.anomalyType === 'low_gravity') {
      this.gravity = CFG.GRAVITY;
      this.jumpVelocity = CFG.JUMP_VELOCITY;
    } else if (this.anomalyType === 'fog_of_war') {
      this.showFogOfWar(false);
    }

    this.anomalyType = null;
    this.nextAnomalyAt = this.elapsed + this.rand(25000, 40000);
  }

  showFogOfWar(enable) {
    Object.values(this.worlds).forEach((w) => {
      if (enable) {
        w.fog.setVisible(true);
        this.tweens.killTweensOf(w.fog);
        this.tweens.add({
          targets: w.fog,
          alpha: 0.94,
          duration: 400,
        });
      } else {
        this.tweens.killTweensOf(w.fog);
        this.tweens.add({
          targets: w.fog,
          alpha: 0,
          duration: 400,
          onComplete: () => w.fog.setVisible(false),
        });
      }
    });
  }

  showAnomalyBanner(text, tint) {
    const cx = CFG.WIDTH / 2;
    const bannerBg = this.add.rectangle(cx, 270, CFG.WIDTH, 56, 0x0a0a14, 0.85)
      .setDepth(21)
      .setAlpha(0)
      .setScale(1, 0);

    const colorStr = '#' + tint.toString(16).padStart(6, '0');
    const bannerText = this.add.text(cx, 270, text, {
      fontFamily: FONTS.HEADING,
      fontSize: '24px',
      color: colorStr,
      stroke: '#000000',
      strokeThickness: 4,
    })
      .setOrigin(0.5)
      .setDepth(22)
      .setAlpha(0);
    bannerText.setResolution(DPR * 1.25);

    this.tweens.add({
      targets: bannerBg,
      alpha: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: bannerText,
      alpha: 1,
      scale: 1.1,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: bannerText,
          scale: 1.0,
          duration: 150,
        });
        this.time.delayedCall(1600, () => {
          this.tweens.add({
            targets: [bannerBg, bannerText],
            alpha: 0,
            duration: 250,
            onComplete: () => {
              bannerBg.destroy();
              bannerText.destroy();
            },
          });
        });
      },
    });
  }

  rand(min, max) {
    return min + Math.random() * (max - min);
  }
}
