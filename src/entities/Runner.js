import Phaser from 'phaser';
import { CFG } from '../config.js';

// An animated humanoid runner built from primitives: head with eye,
// torso, two arms, two legs, a flowing headband tail, and a skin-specific
// particle trail emitter. Handles speed lean, dynamic squash & stretch
// and procedural jog animations.
export default class Runner {
  constructor(scene, x, groundY, bodyColor, accentColor, eyeColor = 0xffffff, skinName = 'CLASSIC') {
    this.scene = scene;
    this.x = x;
    this.groundY = groundY;
    this.y = groundY; // feet baseline
    this.vy = 0;
    this.onGround = true;
    this.sliding = false;
    this.slideTimer = null;
    this.phase = Math.random() * Math.PI * 2;
    this.bodyColor = bodyColor;
    this.accentColor = accentColor;
    this.skinName = skinName;
    this._landed = false;

    this.shadow = scene.add.ellipse(x, groundY + 5, 42, 10, 0x000000, 0.25).setDepth(2);

    const c = bodyColor;

    // Ribbon tail segments (flowing back from the headband)
    this.tailSegments = [];
    const segmentCount = 4;
    for (let i = 0; i < segmentCount; i++) {
      const seg = scene.add.rectangle(-6 - i * 4.5, -52, 6 - i * 0.8, 3.5 - i * 0.5, accentColor).setOrigin(0.5);
      this.tailSegments.push(seg);
    }

    // Limbs pivot from their top edge (shoulder / hip).
    this.armB = scene.add.rectangle(2, -42, 5, 19, c).setOrigin(0.5, 0.05);
    this.legB = scene.add.rectangle(1, -22, 6, 23, c).setOrigin(0.5, 0.05);
    this.torso = scene.add.rectangle(0, -44, 11, 24, c).setOrigin(0.5, 0);
    this.legF = scene.add.rectangle(-1, -22, 6, 23, c).setOrigin(0.5, 0.05);
    this.armF = scene.add.rectangle(-2, -42, 5, 19, c).setOrigin(0.5, 0.05);
    this.head = scene.add.circle(1, -51, 7.5, c);
    this.band = scene.add.rectangle(1, -52, 15, 4, accentColor);
    this.eye = scene.add.circle(4.5, -52.5, 2.2, eyeColor);

    this.container = scene.add
      .container(x, groundY, [
        ...this.tailSegments,
        this.armB,
        this.legB,
        this.torso,
        this.legF,
        this.armF,
        this.head,
        this.band,
        this.eye,
      ])
      .setDepth(4);

    // Create particle trail emitter following the container
    const emitterConfig = this.getTrailConfig(skinName, accentColor);
    this.trailEmitter = scene.add.particles(0, 0, emitterConfig.texture, emitterConfig).setDepth(3);
    this.trailEmitter.startFollow(this.container, -10, -28);

    this.jumpCount = 0;
    this.dashing = false;
    this.dashTime = 0;
  }

  jump() {
    if (this.onGround) {
      if (this.sliding) this.endSlide();
      this.vy = this.scene.jumpVelocity || CFG.JUMP_VELOCITY;
      this.onGround = false;
      this.jumpCount = 1;
      // Stretch on take-off.
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 0.88,
        scaleY: 1.12,
        duration: 90,
        yoyo: true,
        onComplete: () => this.container.setScale(1),
      });
      return true;
    } else if (this.jumpCount < 2) {
      this.vy = (this.scene.jumpVelocity || CFG.JUMP_VELOCITY) * 0.85;
      this.jumpCount = 2;
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 0.88,
        scaleY: 1.12,
        duration: 90,
        yoyo: true,
        onComplete: () => this.container.setScale(1),
      });
      return true;
    }
    return false;
  }

  dash() {
    if (this.dashing) return false;
    if (this.sliding) this.endSlide();
    this.dashing = true;
    this.dashTime = this.scene.time.now;
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.3,
      scaleY: 0.8,
      duration: 80,
      yoyo: true,
      onComplete: () => this.container.setScale(1),
    });
    this.scene.dust.explode(8, this.container.x, this.container.y - 12);
    return true;
  }

  slide() {
    if (!this.onGround || this.sliding) return false;
    this.sliding = true;
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.1,
      scaleY: 0.6,
      duration: 80,
    });
    this.slideTimer = this.scene.time.delayedCall(CFG.SLIDE_MS, () => this.endSlide());
    return true;
  }

  endSlide() {
    if (!this.sliding) return;
    this.sliding = false;
    if (this.slideTimer) {
      this.slideTimer.remove(false);
      this.slideTimer = null;
    }
    this.scene.tweens.add({ targets: this.container, scaleX: 1, scaleY: 1, duration: 90 });
  }

  update(dt, speedNorm = 0) {
    if (this.onGround) {
      if (this.sliding) {
        // Crouched slide pose with a dust trail.
        this.legF.rotation = 1.3;
        this.legB.rotation = 1.0;
        this.armF.rotation = 0.9;
        this.armB.rotation = 1.1;
        this.container.y = this.y;

        // Keep head/torso aligned during slide
        this.torso.rotation = 0;
        this.head.rotation = 0;
        this.band.rotation = 0;
        this.eye.rotation = 0;
        this.head.x = 1;
        this.band.x = 1;
        this.eye.x = 4.5;
      } else {
        // Run cycle: limbs swing in opposite phase, body bobs slightly.
        this.phase += dt * (9 + speedNorm * 7);
        const s = Math.sin(this.phase);
        this.legF.rotation = s * 0.85;
        this.legB.rotation = -s * 0.85;
        this.armF.rotation = -s * 0.95;
        this.armB.rotation = s * 0.95;
        this.container.y = this.y - Math.abs(Math.cos(this.phase)) * 2.5;

        // Keep head/torso aligned during run
        this.torso.rotation = 0;
        this.head.rotation = 0;
        this.band.rotation = 0;
        this.eye.rotation = 0;
        this.head.x = 1;
        this.band.x = 1;
        this.eye.x = 4.5;
      }
    } else {
      this.vy += (this.scene.gravity || CFG.GRAVITY) * dt;
      this.y += this.vy * dt;

      // Air pose: front leg forward, arms raised.
      this.legF.rotation = 0.75;
      this.legB.rotation = -0.55;
      this.armF.rotation = -1.1;
      this.armB.rotation = 0.7;

      // Keep head/torso aligned while airborne
      this.torso.rotation = 0;
      this.head.rotation = 0;
      this.band.rotation = 0;
      this.eye.rotation = 0;
      this.head.x = 1;
      this.band.x = 1;
      this.eye.x = 4.5;

      // Vertical stretch based on velocity
      const stretchY = 1 + Math.min(Math.abs(this.vy) * 0.00018, 0.22);
      const stretchX = 1 - Math.min(Math.abs(this.vy) * 0.00012, 0.12);
      this.container.setScale(stretchX, stretchY);

      if (this.y >= this.groundY) {
        const impactVy = this.vy;
        this.y = this.groundY;
        this.vy = 0;
        this.onGround = true;
        this._landed = true;
        this.jumpCount = 0;

        // Squash on landing proportional to impact velocity
        const squashScaleY = Math.max(0.72, 1 - Math.abs(impactVy) * 0.00028);
        const squashScaleX = 1 + (1 - squashScaleY) * 0.5;

        this.scene.tweens.add({
          targets: this.container,
          scaleX: squashScaleX,
          scaleY: squashScaleY,
          duration: 90,
          yoyo: true,
          onComplete: () => this.container.setScale(1),
        });
      }
      this.container.y = this.y;
    }

    if (this.dashing) {
      const elapsedDash = this.scene.time.now - this.dashTime;
      if (elapsedDash < 200) {
        const progress = elapsedDash / 200;
        this.container.x = CFG.RUNNER_X + Math.sin(progress * Math.PI) * 110;
        this.shadow.x = this.container.x;
      } else {
        this.dashing = false;
        this.container.x = CFG.RUNNER_X;
        this.shadow.x = CFG.RUNNER_X;
      }
    } else {
      this.container.x = CFG.RUNNER_X;
      this.shadow.x = CFG.RUNNER_X;
    }

    // Update headband tail segments waving motion
    const time = this.scene.time.now / 1000;
    const speedFactor = 1 + speedNorm * 1.5;
    this.tailSegments.forEach((seg, i) => {
      // Ribbon waves dynamically
      const wave = Math.sin(time * 12 * speedFactor - i * 1.2) * (2.5 + speedNorm * 2.5);
      seg.y = -52 + wave;
      // Position each segment sequentially behind the head
      seg.x = -6 - i * 4.5 + Math.cos(time * 8 - i * 0.6) * 0.8;
      // Slight rotation wave
      seg.rotation = Math.sin(time * 10 * speedFactor - i * 0.8) * 0.15;
    });

    // Shadow shrinks and fades with height.
    const air = this.groundY - this.y;
    const f = Phaser.Math.Clamp(1 - air / 160, 0.35, 1);
    this.shadow.scaleX = f;
    this.shadow.alpha = 0.25 * f;
  }

  // True once per landing - used by the scene for dust particles.
  consumeLanded() {
    const l = this._landed;
    this._landed = false;
    return l;
  }

  // Slightly shrunk hitbox for forgiving collisions; much shorter while
  // sliding so the runner fits under hanging gates.
  getHitbox() {
    if (this.sliding) {
      return new Phaser.Geom.Rectangle(this.container.x - 12, this.y - 26, 24, 24);
    }
    return new Phaser.Geom.Rectangle(this.container.x - 11, this.container.y - 52, 22, 50);
  }

  setDead() {
    [this.armB, this.legB, this.torso, this.legF, this.armF, this.band, this.head].forEach((p) =>
      p.setFillStyle(0xd33a3a)
    );
    this.trailEmitter.stop();
  }

  // Restore original colors after a revive.
  revive() {
    [this.armB, this.legB, this.torso, this.legF, this.armF, this.head].forEach((p) =>
      p.setFillStyle(this.bodyColor)
    );
    this.band.setFillStyle(this.accentColor);
    this.endSlide();
    this.trailEmitter.start();
  }

  destroy() {
    if (this.trailEmitter) this.trailEmitter.destroy();
    if (this.shadow) this.shadow.destroy();
    if (this.container) this.container.destroy();
  }

  getTrailConfig(skinName, accentColor) {
    const base = {
      lifespan: 400,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.5, end: 0 },
      blendMode: 'ADD',
      emitting: true,
      frequency: 40,
    };

    switch (skinName) {
      case 'EMBER':
        return {
          ...base,
          texture: 'spark',
          lifespan: 500,
          speed: { min: 40, max: 90 },
          angle: { min: 140, max: 220 },
          scale: { start: 0.8, end: 0.1 },
          alpha: { start: 0.8, end: 0 },
          tint: 0xff8c00,
          frequency: 30,
        };
      case 'TOXIC':
        return {
          ...base,
          texture: 'glow',
          lifespan: 600,
          speedY: { min: -10, max: 30 },
          speedX: { min: -120, max: -60 },
          scale: { start: 0.12, end: 0.02 },
          alpha: { start: 0.6, end: 0 },
          tint: 0x39ff14,
          frequency: 35,
        };
      case 'ROYAL':
        return {
          ...base,
          texture: 'spark',
          lifespan: 500,
          speed: { min: 30, max: 70 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.7, end: 0.1 },
          alpha: { start: 0.8, end: 0 },
          tint: 0xffd700,
          frequency: 25,
        };
      case 'VOID':
        return {
          ...base,
          texture: 'spark',
          lifespan: 400,
          speedX: { min: -200, max: -100 },
          speedY: { min: -20, max: 20 },
          scale: { start: 0.9, end: 0.1 },
          alpha: { start: 0.8, end: 0 },
          tint: 0xff00ff,
          frequency: 20,
        };
      case 'CYBER':
        return {
          ...base,
          texture: 'spark',
          lifespan: 500,
          speedX: { min: -180, max: -90 },
          speedY: { min: -15, max: 15 },
          scale: { start: 0.8, end: 0.1 },
          alpha: { start: 0.75, end: 0 },
          tint: accentColor,
          frequency: 25,
        };
      case 'CLASSIC':
      default:
        return {
          ...base,
          texture: 'dot',
          lifespan: 300,
          speedX: { min: -150, max: -80 },
          speedY: { min: -10, max: 10 },
          scale: { start: 0.7, end: 0 },
          alpha: { start: 0.4, end: 0 },
          tint: accentColor,
          frequency: 45,
        };
    }
  }
}
