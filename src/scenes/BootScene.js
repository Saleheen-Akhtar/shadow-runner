import Phaser from 'phaser';
import portal from '../platform/PortalAdapter.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // No binary assets yet - all visuals are generated shapes.
    portal.init().finally(() => this.scene.start('Menu'));
  }
}
