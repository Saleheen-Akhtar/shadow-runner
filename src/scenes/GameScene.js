import Phaser from 'phaser';
import { CFG, WORLDS } from '../config.js';
import Runner from '../entities/Runner.js';
import audio from '../systems/AudioManager.js';
import portal from '../platform/PortalAdapter.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
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
      // Sun with glow
      this.add.circle(780, def.top + 62, 40, 0xffe2a8, 0.35).setDepth(0);
      this.add.circle(780, def.top + 62, 26, 0xffd98a).setDepth(0);
      // Drifting clouds (slow parallax)
      for (let i = 0; i < 3; i++) {
        const cl = this.add
          .ellipse(120 + i * 340, def.top + 36 + Math.random() * 55, 95, 26, 0xffffff, 0.8)
          .setDepth(0);
        parallax.push({ obj: cl, factor: 0.12, halfW: 60 });
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
      // Moon with glow
      this.add.circle(200, def.top + 58, 34, 0xcfd8ff, 0.18).setDepth(0);
      this.add.circle(200, def.top + 58, 20, 0xdfe6f0).setDepth(0);
      // Twinkling stars
      for (let i = 0; i < 16; i++) {
        const s = this.add
          .circle(Math.random() * CFG.WIDTH, def.top + 12 + Math.random() * 130, 1.5, 0xffffff)
          .setDepth(0);
        stars.push({ obj: s, tw: Math.random() * Math.PI * 2 });
      }
      // City skyline (far)
      for (let i = 0; i < 7; i++) {
        const bw = 55 + Math.random() * 50;
        const bh = 60 + Math.random() * 75;
        const b = this.add
          .rectangle(i * 150, def.groundY - bh / 2 + 2, bw, bh, def.hill)
          .setDepth(0);
        parallax.push({ obj: b, factor: 0.25, halfW: bw / 2 });
      }
      // Antennas / rooftops (mid)
      for (let i = 0; i < 4; i++) {
        const a = this.add
          .rectangle(120 + i * 250, def.groundY - 28, 7, 56, def.prop)
          .setDepth(0);
        parallax.push({ obj: a, factor: 0.5, halfW: 6 });
      }
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

    const runner = new Runner(
      this,
      CFG.RUNNER_X,
      def.groundY,
      def.runnerBody,
      def.runnerAccent,
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
      nextSpawnAt: 1200 + Math.random() * 600,
      frozenUntil: 0,
      freezeOverlay,
      freezeText,
    };
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
      .text(cx, 50, `BEST ${this.best}`, {
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
    const kb = this.input.keyboard;
    kb.on('keydown-W', () => this.handleAction('light'));
    kb.on('keydown-UP', () => this.handleAction('light'));
    kb.on('keydown-S', () => this.handleAction('dark'));
    kb.on('keydown-DOWN', () => this.handleAction('dark'));

    // Mobile / mouse: top half controls the light world, bottom half the dark.
    this.input.on('pointerdown', (pointer) => {
      this.handleAction(pointer.y < CFG.HEIGHT / 2 ? 'light' : 'dark');
    });
  }

  handleAction(worldKey) {
    if (this.isGameOver) return;
    if (this.isPaused) {
      this.resumeGame();
      return;
    }

    if (this.syncActive) {
      // One input jumps both. First input wins; an immediate second
      // input is ignored (not penalized).
      if (this.elapsed - this.lastSyncJumpAt < CFG.SYNC_INPUT_DEBOUNCE_MS) return;
      this.lastSyncJumpAt = this.elapsed;
      let jumped = false;
      Object.values(this.worlds).forEach((w) => {
        if (this.elapsed >= w.frozenUntil && w.runner.jump()) {
          jumped = true;
          w.dust.explode(4, CFG.RUNNER_X, w.def.groundY);
        }
      });
      if (jumped) audio.play('jump');
      return;
    }

    const w = this.worlds[worldKey];
    if (this.elapsed < w.frozenUntil) return; // frozen world ignores input
    if (w.runner.jump()) {
      audio.play('jump');
      w.dust.explode(4, CFG.RUNNER_X, w.def.groundY);
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
      if (Phaser.Geom.Intersects.RectangleToRectangle(this.obstacleRect(o), hitbox)) {
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
    if (r < 0.45) return { type: 'crate', w: 38, h: 38 };
    if (r < 0.65) return { type: 'crate2', w: 38, h: 76 };
    return { type: 'spikes', w: 50, h: 40 };
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
    w.obstacles.push({ x, w: spec.w, h: spec.h, gy: def.groundY, arrival, gfx });
  }

  obstacleRect(o) {
    return new Phaser.Geom.Rectangle(o.x - o.w / 2 + 5, o.gy - o.h + 5, o.w - 10, o.h - 5);
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
    // Camera zoom punch to sell the moment.
    this.cameras.main.zoomTo(1.04, 150, 'Sine.easeInOut');
    this.time.delayedCall(320, () => this.cameras.main.zoomTo(1, 220, 'Sine.easeInOut'));
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

    const finalScore = Math.floor(this.score);
    const isNewBest = finalScore > this.best;
    if (isNewBest) {
      this.best = finalScore;
      localStorage.setItem(CFG.BEST_KEY, String(finalScore));
    }

    this.cameras.main.shake(250, 0.01);
    this.time.delayedCall(700, () => {
      this.scene.start('GameOver', { score: finalScore, best: this.best, isNewBest });
    });
  }

  rand(min, max) {
    return min + Math.random() * (max - min);
  }
}
