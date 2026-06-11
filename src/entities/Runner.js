import Phaser from 'phaser';
import { CFG } from '../config.js';

// A single auto-running character. Movement is implied by the world
// scrolling; the runner only handles vertical physics (jumping).
export default class Runner {
  constructor(scene, x, groundY, fillColor, strokeColor) {
    this.scene = scene;
    this.w = 36;
    this.h = 48;
    this.x = x;
    this.groundY = groundY;
    this.y = groundY - this.h / 2;
    this.vy = 0;
    this.onGround = true;
    this.rect = scene.add
      .rectangle(this.x, this.y, this.w, this.h, fillColor)
      .setStrokeStyle(3, strokeColor)
      .setDepth(4);
  }

  jump() {
    if (!this.onGround) return false;
    this.vy = CFG.JUMP_VELOCITY;
    this.onGround = false;
    return true;
  }

  update(dt) {
    if (this.onGround) return;
    this.vy += CFG.GRAVITY * dt;
    this.y += this.vy * dt;
    const rest = this.groundY - this.h / 2;
    if (this.y >= rest) {
      this.y = rest;
      this.vy = 0;
      this.onGround = true;
    }
    this.rect.y = this.y;
  }

  // Slightly shrunk hitbox for forgiving collisions.
  getHitbox() {
    const pad = 6;
    return new Phaser.Geom.Rectangle(
      this.x - this.w / 2 + pad,
      this.y - this.h / 2 + pad,
      this.w - pad * 2,
      this.h - pad * 2
    );
  }

  setDead() {
    this.rect.setFillStyle(0xd33a3a);
  }
}
