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
    this.add.rectangle(cx, cy, CFG.WIDTH, def.height, def.bg).setDepth(0);
    this.add.rectangle(cx, def.groundY + 15, CFG.WIDTH, 30, def.ground).setDepth(1);
    this.add
      .text(16, def.top + 10, def.label, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: def.key === 'light' ? '#9a978d' : '#4a4a58',
      })
      .setDepth(2);

    const otherInk = def.key === 'light' ? WORLDS.dark.ink : WORLDS.light.ink;
    const runner = new Runner(this, CFG.RUNNER_X, def.groundY, def.ink, otherInk);

    const freezeOverlay = this.add
      .rectangle(cx, cy, CFG.WIDTH, def.height, 0x7fd4ff, 0.22)
      .setDepth(5)
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
      .setDepth(6)
      .setVisible(false);

    this.worlds[def.key] = {
      def,
      runner,
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
    this.add.rectangle(cx, 270, CFG.WIDTH, 4, 0x888888).setDepth(3);

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
        if (this.elapsed >= w.frozenUntil) jumped = w.runner.jump() || jumped;
      });
      if (jumped) audio.play('jump');
      return;
    }

    const w = this.worlds[worldKey];
    if (this.elapsed < w.frozenUntil) return; // frozen world ignores input
    if (w.runner.jump()) audio.play('jump');
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

    this.scoreText.setText(String(Math.floor(this.score)));
    if (died) this.endRun();
  }

  updateWorld(w, dt) {
    const frozen = this.elapsed < w.frozenUntil;
    w.freezeOverlay.setVisible(frozen);
    w.freezeText.setVisible(frozen);
    if (frozen) return false; // no movement, no score, invulnerable

    // Each active world contributes to the score; a frozen world does not.
    this.score += this.speed * dt * CFG.SCORE_RATE;

    if (!this.syncActive && this.elapsed >= w.nextSpawnAt) this.trySpawn(w);

    w.runner.update(dt);
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

  randomSpec() {
    // Two distinct silhouettes (block vs spike) so obstacle types are
    // readable by shape, not color.
    return Math.random() < 0.5
      ? { type: 'block', w: 34, h: Math.round(this.rand(36, 60)) }
      : { type: 'spike', w: 40, h: 44 };
  }

  spawnObstacle(w, spec, x, arrival) {
    const gy = w.def.groundY;
    let gfx;
    if (spec.type === 'block') {
      gfx = this.add.rectangle(x, gy - spec.h / 2, spec.w, spec.h, w.def.ink).setDepth(3);
    } else {
      gfx = this.add
        .triangle(x, gy - spec.h / 2, 0, spec.h, spec.w, spec.h, spec.w / 2, 0, w.def.ink)
        .setDepth(3);
    }
    w.obstacles.push({ x, w: spec.w, h: spec.h, gy, arrival, gfx });
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
    audio.play('sync');
  }

  spawnPowerup() {
    if (this.syncActive) return;
    const keys = Object.keys(this.worlds).filter((k) => this.elapsed >= this.worlds[k].frozenUntil);
    if (keys.length === 0) return;
    const w = this.worlds[keys[Math.floor(Math.random() * keys.length)]];
    const x = CFG.WIDTH + 40;
    const y = w.def.groundY - 36;
    const gfx = this.add.circle(x, y, 13, 0x59c2ff).setStrokeStyle(3, 0xffffff).setDepth(3);
    w.powerups.push({ x, y, r: 13, gfx });
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
