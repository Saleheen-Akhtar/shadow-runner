import Phaser from 'phaser';
import { CFG, DPR, WORLDS, getSelectedSkin } from '../config.js';
import Runner from '../entities/Runner.js';
import audio from '../systems/AudioManager.js';
import portal from '../platform/PortalAdapter.js';
import { applyHiDpi } from '../systems/display.js';

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
    this.lastCoinAt = -99999;

    this.runFinished = false;

    // Revive (one per run)
    this.reviveUsed = false;
    this.reviveBusy = false;
    this.reviveObjs = null;
    this.reviveTimer = null;
    this.invulnUntil = 0;

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
      // City skyline (far) with randomly lit windows
      for (let i = 0; i < 7; i++) {
        const bw = 55 + Math.random() * 50;
        const bh = 60 + Math.random() * 75;
        const parts = [this.add.rectangle(0, 0, bw, bh, def.hill)];
        const cols = Math.floor(bw / 18);
        const rows = Math.floor(bh / 22);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (Math.random() < 0.3) {
              parts.push(
                this.add.rectangle(c * 18 - bw / 2 + 12, r * 22 - bh / 2 + 13, 6, 8, 0xf7d774, 0.45)
              );
            }
          }
        }
        const b = this.add.container(i * 150, def.groundY - bh / 2 + 2, parts).setDepth(0);
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
        fontFamily: 'monospace',
        fontSize: '14px',
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
      def.runnerEye
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
    const freezeText = this.add
      .text(cx, cy, 'FROZEN', {
        fontFamily: 'monospace',
        fontSize: '28px',
        color: '#7fd4ff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(7)
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
      nextCoinAt: 3000 + Math.random() * 2000,
      nextSpawnAt: 1200 + Math.random() * 600,
      frozenUntil: 0,
      freezeOverlay,
      freezeText,
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

  createUi() {
    const cx = CFG.WIDTH / 2;
    this.divider = this.add.rectangle(cx, 270, CFG.WIDTH, 4, 0x888888).setDepth(8);

    // Translucent HUD panel behind the score.
    const hud = this.add.graphics().setDepth(19);
    hud.fillStyle(0x000000, 0.35);
    hud.fillRoundedRect(cx - 90, 8, 180, 62, 12);

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
        fontFamily: 'monospace',
        fontSize: '30px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.bestText = this.add
      .text(cx - 45, 50, `BEST ${this.best}`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffd34d',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.coinText = this.add
      .text(cx + 45, 50, '\u25cf 0', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffd34d',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(20);

    this.syncText = this.add
      .text(cx, 270, 'SYNC!', {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: '#ffd34d',
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

    // Game must start muted (portal requirement); button toggles.
    this.muteBtn = this.add
      .text(CFG.WIDTH - 24, 24, audio.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A', { fontSize: '26px' })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      const muted = audio.toggleMute();
      this.muteBtn.setText(muted ? '\uD83D\uDD07' : '\uD83D\uDD0A');
    });

    this.pauseOverlay = this.add
      .rectangle(cx, 270, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.55)
      .setDepth(30)
      .setVisible(false);
    this.pauseText = this.add
      .text(cx, 270, 'PAUSED\ntap or press a key to resume', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(31)
      .setVisible(false);
  }

  bindInput() {
    // Desktop: WASD column controls the top runner, arrows the bottom.
    const kb = this.input.keyboard;
    kb.on('keydown-W', () => this.handleAction('light', 'jump'));
    kb.on('keydown-S', () => this.handleAction('light', 'slide'));
    kb.on('keydown-UP', () => this.handleAction('dark', 'jump'));
    kb.on('keydown-DOWN', () => this.handleAction('dark', 'slide'));

    // Touch: tap = jump, swipe down = slide. The half of the screen where
    // the gesture STARTS picks the world. Two simultaneous touches work.
    this.input.addPointer(1);
    this.touch = new Map();
    this.input.on('pointerdown', (pointer) => {
      this.touch.set(pointer.id, { y0: pointer.y, acted: false });
    });
    this.input.on('pointermove', (pointer) => {
      const st = this.touch.get(pointer.id);
      if (!st || st.acted || !pointer.isDown) return;
      const threshold = 24 * (this.scale.height / CFG.HEIGHT);
      const dy = pointer.y - st.y0;
      if (Math.abs(dy) < threshold) return;
      st.acted = true;
      const world = st.y0 < this.scale.height / 2 ? 'light' : 'dark';
      this.handleAction(world, dy > 0 ? 'slide' : 'jump');
    });
    this.input.on('pointerup', (pointer) => {
      const st = this.touch.get(pointer.id);
      this.touch.delete(pointer.id);
      if (!st || st.acted) return;
      const world = st.y0 < this.scale.height / 2 ? 'light' : 'dark';
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
          if (w.runner.jump()) {
            acted = true;
            w.dust.explode(4, CFG.RUNNER_X, w.def.groundY);
          }
        } else if (w.runner.slide()) {
          acted = true;
        }
      });
      if (acted) audio.play(action);
      return;
    }

    const w = this.worlds[worldKey];
    if (this.elapsed < w.frozenUntil) return; // frozen world ignores input
    if (action === 'jump') {
      if (w.runner.jump()) {
        audio.play('jump');
        w.dust.explode(4, CFG.RUNNER_X, w.def.groundY);
      }
    } else if (w.runner.slide()) {
      audio.play('slide');
    }
  }

  update(time, delta) {
    if (this.isGameOver || this.isPaused) return;
    const dt = Math.min(delta, 50) / 1000;
    this.elapsed += delta;

    this.speed = Math.min(CFG.MAX_SPEED, CFG.BASE_SPEED + CFG.SPEED_RAMP * (this.elapsed / 1000));

    // Sync events
    if (!this.syncActive && this.elapsed >= this.nextSyncAt) this.startSync();
    if (this.syncActive && this.elapsed >= this.syncUntil) {
      this.syncActive = false;
      this.syncText.setVisible(false);
      this.syncTween.pause();
      this.divider.setFillStyle(0x888888);
      this.nextSyncAt = this.elapsed + this.rand(CFG.SYNC_MIN_MS, CFG.SYNC_MAX_MS);
    }

    // Freeze power-up spawning
    if (this.elapsed >= this.nextPowerupAt) {
      this.spawnPowerup();
      this.nextPowerupAt = this.elapsed + this.rand(CFG.POWERUP_MIN_MS, CFG.POWERUP_MAX_MS);
    }

    let died = false;
    Object.values(this.worlds).forEach((w) => {
      if (this.updateWorld(w, dt)) died = true;
    });

    // Speed lines at high velocity.
    const fast = this.speed > 560;
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
    }

    this.scoreText.setText(String(Math.floor(this.score)));
    if (died) this.endRun();
  }

  updateWorld(w, dt) {
    const frozen = this.elapsed < w.frozenUntil;
    w.freezeOverlay.setVisible(frozen);
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
    if (!this.syncActive && this.elapsed >= w.nextCoinAt) this.spawnCoinPattern(w);

    w.runner.update(dt, this.speed / CFG.MAX_SPEED);
    if (w.runner.consumeLanded()) w.dust.explode(6, CFG.RUNNER_X, w.def.groundY);
    const hitbox = w.runner.getHitbox();

    for (let i = w.obstacles.length - 1; i >= 0; i--) {
      const o = w.obstacles[i];
      o.x -= this.speed * dt;
      o.gfx.x = o.x;
      if (o.x < -80) {
        o.gfx.destroy();
        w.obstacles.splice(i, 1);
        continue;
      }
      if (
        this.elapsed >= this.invulnUntil &&
        Phaser.Geom.Intersects.RectangleToRectangle(this.obstacleRect(o), hitbox)
      ) {
        w.runner.setDead();
        return true;
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
        p.gfx.destroy();
        w.powerups.splice(i, 1);
        this.freezeOtherWorld(w.def.key);
      }
    }

    for (let i = w.coins.length - 1; i >= 0; i--) {
      const c = w.coins[i];
      c.x -= this.speed * dt;
      c.gfx.x = c.x;
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
    const spawnX = CFG.WIDTH + 60;
    const arrival = this.elapsed + ((spawnX - CFG.RUNNER_X) / this.speed) * 1000;
    const other = this.worlds[w.def.key === 'light' ? 'dark' : 'light'];
    const conflict = other.obstacles.some(
      (o) => o.arrival > this.elapsed && Math.abs(o.arrival - arrival) < CFG.MIN_CROSS_GAP_MS
    );
    if (conflict) {
      w.nextSpawnAt = this.elapsed + 130; // retry shortly
      return;
    }
    this.spawnObstacle(w, this.randomSpec(), spawnX, arrival);
    w.nextSpawnAt = this.elapsed + this.rand(CFG.SPAWN_GAP_MIN_MS, CFG.SPAWN_GAP_MAX_MS);
  }

  // Distinct silhouettes (crates vs spikes) so obstacle types are
  // readable by shape, not color.
  randomSpec() {
    const r = Math.random();
    if (r < 0.3) return { type: 'crate', w: 38, h: 38 };
    if (r < 0.5) return { type: 'crate2', w: 38, h: 76 };
    if (r < 0.75) return { type: 'spikes', w: 50, h: 40 };
    // Hanging gate: a low gap underneath - must SLIDE, cannot be jumped.
    return { type: 'gate', w: 30, h: 130, gap: 34 };
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
    } else {
      parts.push(this.add.rectangle(0, -7, 52, 10, def.crateEdge));
      parts.push(this.add.rectangle(0, -10, 52, 2, 0xffffff, 0.15));
      [-16, 0, 16].forEach((sx) => {
        parts.push(this.add.triangle(sx, -25, 0, 30, 16, 30, 8, 0, def.spike));
        // Lit left face of each spike.
        parts.push(this.add.triangle(sx - 2, -27, 0, 22, 9, 22, 5, 0, 0xffffff, 0.16));
      });
    }

    const gfx = this.add.container(x, def.groundY, parts).setDepth(3);
    w.obstacles.push({ x, w: spec.w, h: spec.h, gap: spec.gap, gy: def.groundY, arrival, gfx });
  }

  obstacleRect(o) {
    if (o.gap) {
      // Hanging gate: solid from (gap above ground) upward.
      return new Phaser.Geom.Rectangle(o.x - o.w / 2 + 4, o.gy - o.gap - o.h + 2, o.w - 8, o.h - 4);
    }
    return new Phaser.Geom.Rectangle(o.x - o.w / 2 + 5, o.gy - o.h + 5, o.w - 10, o.h - 5);
  }

  // Coin rows on the ground or arcs that reward a well-timed jump.
  spawnCoinPattern(w) {
    const gy = w.def.groundY;
    const baseX = CFG.WIDTH + 80;
    const arc = Math.random() < 0.5;
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

  collectCoin(c) {
    if (this.elapsed - this.lastCoinAt > CFG.COMBO_TIMEOUT_MS) this.combo = 0;
    this.combo++;
    this.lastCoinAt = this.elapsed;
    const value = Math.min(5 + this.combo, 30);
    this.score += value;
    this.coins++;
    this.coinText.setText(`\u25cf ${this.coins}`);
    this.floatText(c.x, c.y - 14, this.combo > 1 ? `+${value} x${this.combo}` : `+${value}`);
    audio.play('coin');
  }

  floatText(x, y, str) {
    const t = this.add
      .text(x, y, str, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffd34d',
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
    this.divider.setFillStyle(0xffd34d);
    // Camera zoom punch to sell the moment (relative to the DPR base zoom).
    this.cameras.main.zoomTo(DPR * 1.04, 150, 'Sine.easeInOut');
    this.time.delayedCall(320, () => this.cameras.main.zoomTo(DPR, 220, 'Sine.easeInOut'));
    audio.play('sync');
  }

  spawnPowerup() {
    if (this.syncActive) return;
    const keys = Object.keys(this.worlds).filter((k) => this.elapsed >= this.worlds[k].frozenUntil);
    if (keys.length === 0) return;
    const w = this.worlds[keys[Math.floor(Math.random() * keys.length)]];
    const x = CFG.WIDTH + 40;
    const y = w.def.groundY - 36;

    const glow = this.add.circle(0, 0, 19, 0x7fd4ff, 0.25);
    const r1 = this.add.rectangle(0, 0, 32, 3, 0xbfe9ff, 0.9);
    const r2 = this.add.rectangle(0, 0, 32, 3, 0xbfe9ff, 0.9).setRotation(Math.PI / 2);
    const rays = this.add.container(0, 0, [r1, r2]);
    const core = this.add.circle(0, 0, 11, 0x59c2ff).setStrokeStyle(2, 0xffffff);
    const gfx = this.add.container(x, y, [glow, rays, core]).setDepth(3);

    w.powerups.push({ x, y, r: 13, gfx, rays, glow });
  }

  freezeOtherWorld(collectorKey) {
    const otherKey = collectorKey === 'light' ? 'dark' : 'light';
    this.worlds[otherKey].frozenUntil = this.elapsed + CFG.FREEZE_MS;
    audio.play('freeze');
  }

  pauseGame() {
    if (this.isGameOver || this.isPaused) return;
    this.isPaused = true;
    this.pauseOverlay.setVisible(true);
    this.pauseText.setVisible(true);
    portal.gameplayStop();
  }

  resumeGame() {
    this.isPaused = false;
    this.pauseOverlay.setVisible(false);
    this.pauseText.setVisible(false);
    portal.gameplayStart();
  }

  endRun() {
    this.isGameOver = true;
    audio.play('hit');
    portal.gameplayStop();
    this.cameras.main.shake(250, 0.01);

    if (!this.reviveUsed) {
      this.time.delayedCall(500, () => this.showRevivePrompt());
    } else {
      this.time.delayedCall(700, () => this.finishRun());
    }
  }

  showRevivePrompt() {
    const cx = CFG.WIDTH / 2;
    const objs = [];

    objs.push(this.add.rectangle(cx, 270, CFG.WIDTH, CFG.HEIGHT, 0x000000, 0.6).setDepth(40));
    const panel = this.add.graphics().setDepth(41);
    panel.fillStyle(0x10101a, 0.95);
    panel.fillRoundedRect(cx - 200, 160, 400, 220, 16);
    panel.lineStyle(2, 0xffd34d, 0.7);
    panel.strokeRoundedRect(cx - 200, 160, 400, 220, 16);
    objs.push(panel);

    const title = this.add
      .text(cx, 196, 'CONTINUE?', {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: '32px',
        color: '#ffd34d',
      })
      .setOrigin(0.5)
      .setDepth(42);
    objs.push(title);

    this.reviveCountdownText = this.add
      .text(cx, 248, '3', {
        fontFamily: '"Arial Black", Impact, sans-serif',
        fontSize: '40px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(42);
    objs.push(this.reviveCountdownText);

    const reviveBtn = this.add
      .text(cx, 312, ' WATCH AD & REVIVE ', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#1d1d24',
        backgroundColor: '#ffd34d',
        padding: { x: 10, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(42)
      .setInteractive({ useHandCursor: true });
    reviveBtn.on('pointerdown', (pointer, lx, ly, event) => {
      event.stopPropagation();
      this.tryRevive();
    });
    objs.push(reviveBtn);

    const skipBtn = this.add
      .text(cx, 358, 'NO THANKS', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#8a8a9a',
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
    portal.rewardedAd().then((ok) => {
      this.reviveBusy = false;
      if (ok) this.doRevive();
      else this.finishRun();
    });
  }

  doRevive() {
    this.clearRevivePrompt();
    this.reviveUsed = true;

    Object.values(this.worlds).forEach((w) => {
      w.obstacles.forEach((o) => o.gfx.destroy());
      w.obstacles = [];
      w.coins.forEach((c) => c.gfx.destroy());
      w.coins = [];
      w.powerups.forEach((p) => p.gfx.destroy());
      w.powerups = [];
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
    this.combo = 0;
    this.isGameOver = false;
    portal.gameplayStart();
  }

  finishRun() {
    if (this.runFinished) return;
    this.runFinished = true;
    this.clearRevivePrompt();

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

    this.time.delayedCall(200, () => {
      this.scene.start('GameOver', { score: finalScore, best: this.best, isNewBest });
    });
  }

  rand(min, max) {
    return min + Math.random() * (max - min);
  }
}
