import Phaser from 'phaser';
import { CFG } from '../config.js';

// An animated humanoid runner built from primitives: head, torso, two
// arms and two legs with a procedural run cycle, an air pose while
// jumping, and a soft drop shadow. Movement is implied by the world
// scrolling; the runner only handles vertical physics.
export default class Runner {
  constructor(scene, x, groundY, bodyColor, accentColor) {
    this.scene = scene;
    this.x = x;
    this.groundY = groundY;
    this.y = groundY; // feet baseline
    this.vy = 0;
    this.onGround = true;
    this.phase = Math.random() * Math.PI * 2;
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

    this.container = scene.add
      .container(x, groundY, [
        this.armB,
        this.legB,
        this.torso,
        this.legF,
        this.armF,
        this.head,
        this.band,
      ])
      .setDepth(4);
  }

  jump() {
    if (!this.onGround) return false;
    this.vy = CFG.JUMP_VELOCITY;
    this.onGround = false;
    return true;
  }

  update(dt, speedNorm = 0) {
    if (this.onGround) {
      // Run cycle: limbs swing in opposite phase, body bobs slightly.
      this.phase += dt * (9 + speedNorm * 7);
      const s = Math.sin(this.phase);
      this.legF.rotation = s * 0.85;
      this.legB.rotation = -s * 0.85;
      this.armF.rotation = -s * 0.95;
      this.armB.rotation = s * 0.95;
      this.container.y = this.y - Math.abs(Math.cos(this.phase)) * 2.5;
    } else {
      this.vy += CFG.GRAVITY * dt;
      this.y += this.vy * dt;
      // Air pose: front leg forward, arms raised.
      this.legF.rotation = 0.75;
      this.legB.rotation = -0.55;
      this.armF.rotation = -1.1;
      this.armB.rotation = 0.7;
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.onGround = true;
        this._landed = true;
      }
      this.container.y = this.y;
    }

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

  // Slightly shrunk hitbox for forgiving collisions.
  getHitbox() {
    return new Phaser.Geom.Rectangle(this.x - 11, this.container.y - 52, 22, 50);
  }

  setDead() {
    [this.armB, this.legB, this.torso, this.legF, this.armF, this.band, this.head].forEach((p) =>
      p.setFillStyle(0xd33a3a)
    );
  }
}
