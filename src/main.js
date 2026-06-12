import Phaser from 'phaser';
import { CFG, DPR } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

// The canvas backing store is DPR times larger than the 960x540 design
// space; each scene zooms its camera by DPR (see applyHiDpi) so all game
// logic keeps using design-space coordinates while rendering stays sharp.
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CFG.WIDTH * DPR,
  height: CFG.HEIGHT * DPR,
  backgroundColor: '#000000',
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
});
