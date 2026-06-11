import Phaser from 'phaser';
import { CFG } from '../config.js';

// An animated humanoid runner built from primitives: head with eye,
// torso, two arms and two legs with a procedural run cycle, an air pose
// while jumping, a crouched slide pose, squash & stretch, an after-image
// trail and a soft drop shadow. Movement is implied by the world
// scrolling; the runner only handles vertical physics.
export default class Runner {
  constructor(scene, x, groundY, bodyColor, accentColor, eyeColor = 0xffffff) {
    this.scene = scene;
    this.x = x;
    this.groundY = groundY;
    this.y = groundY; // feet baseline
    this.vy = 0;
    this.onGround = true;
    this.sliding = false;
    this.slideTimer = null;
    this.phase = Math.random() * Math.PI * 2;
    this.ghostTimer = 0;
    this.bodyColor = bodyColor;
    this._landed = false;

    this.shadow = scene.add.ellipse(x, groundY + 5, 42, 10, 0x000000, 0.25).setDepth(2);

    const c = bodyColor;
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
  }

  jump() {
    if (!this.onGround) return false;
    if (this.sliding) this.endSlide();
    this.vy = CFG.JUMP_VELOCITY;
    this.onGround = false;
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
        this.ghostTimer += dt;
        if (this.ghostTimer > 0.06) {
          this.ghostTimer = 0;
          const d = this.scene.add
            .ellipse(this.x - 14, this.y - 6, 14, 8, this.bodyColor, 0.18)
            .setDepth(3);
          this.scene.tweens.add({
            targets: d,
            alpha: 0,
            x: d.x - 24,
            duration: 240,
            onComplete: () => d.destroy(),
          });
        }
      } else {
        // Run cycle: limbs swing in opposite phase, body bobs slightly.
        this.phase += dt * (9 + speedNorm * 7);
        const s = Math.sin(this.phase);
        this.legF.rotation = s * 0.85;
        this.legB.rotation = -s * 0.85;
        this.armF.rotation = -s * 0.95;
        this.armB.rotation = s * 0.95;
        this.container.y = this.y - Math.abs(Math.cos(this.phase)) * 2.5;
      }
    } else {
      this.vy += CFG.GRAVITY * dt;
      this.y += this.vy * dt;
      // Air pose: front leg forward, arms raised.
      this.legF.rotation = 0.75;
      this.legB.rotation = -0.55;
      this.armF.rotation = -1.1;
      this.armB.rotation = 0.7;

      // After-image trail while airborne.
      this.ghostTimer += dt;
      if (this.ghostTimer > 0.07) {
        this.ghostTimer = 0;
        this.spawnGhost();
      }

      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.onGround = true;
        this._landed = true;
        // Squash on landing.
        this.scene.tweens.add({
          targets: this.container,
          scaleX: 1.16,
          scaleY: 0.84,
          duration: 80,
          yoyo: true,
          onComplete: () => this.container.setScale(1),
        });
      }
      this.container.y = this.y;
    }

    // Shadow shrinks and fades with height.
    const air = this.groundY - this.y;
    const f = Phaser.Math.Clamp(1 - air / 160, 0.35, 1);
    this.shadow.scaleX = f;
    this.shadow.alpha = 0.25 * f;
  }

  spawnGhost() {
    const g = this.scene.add
      .ellipse(this.x - 8, this.container.y - 30, 18, 42, this.bodyColor, 0.16)
      .setDepth(3);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      x: g.x - 28,
      duration: 260,
      onComplete: () => g.destroy(),
    });
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
      return new Phaser.Geom.Rectangle(this.x - 12, this.y - 26, 24, 24);
    }
    return new Phaser.Geom.Rectangle(this.x - 11, this.container.y - 52, 22, 50);
  }

  setDead() {
    [this.armB, this.legB, this.torso, this.legF, this.armF, this.band, this.head].forEach((p) =>
      p.setFillStyle(0xd33a3a)
    );
  }
}
