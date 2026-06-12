// ---------------------------------------------------------------------------
// AudioManager – Sample-based Audio Engine for Shadow Runner
// ---------------------------------------------------------------------------
// Replaces the procedurally synthesized Web Audio API sounds with high-quality
// authentic audio sample assets preloaded via Phaser's Loader in BootScene.
//
// Public API:
//   audio.muted            – boolean
//   audio.play(name)       – trigger a named SFX
//   audio.toggleMute()     – returns new muted state
//   audio.playCoinCombo(n) – coin with rising pitch per combo
//   audio.startBGM()       – no-op (music removed)
//   audio.stopBGM()        – no-op (music removed)
//   audio.pauseBGM()       – no-op (music removed)
//   audio.resumeBGM()      – no-op (music removed)
//   audio.updateBGM(speedNorm, feverActive, anomalyType) – no-op (music removed)
// ---------------------------------------------------------------------------

class AudioManager {
  constructor() {
    // Game starts muted (portal requirement e.g. Poki)
    this.muted = true;
  }

  /** Sync Phaser's sound manager mute state with our state */
  _ensureMuteState() {
    const game = window.phaserGame;
    if (game && game.sound) {
      if (game.sound.mute !== this.muted) {
        game.sound.mute = this.muted;
      }
    }
  }

  /**
   * Play a named sound effect.
   * @param {string} name One of: jump, slide, coin, hit, sync, freeze, boost, crumble, drone, doublejump, dash
   */
  play(name) {
    this._ensureMuteState();
    if (this.muted) return;

    const game = window.phaserGame;
    if (game && game.sound) {
      try {
        game.sound.play(name);
      } catch (e) {
        console.warn(`[AudioManager] Failed to play sound ${name}:`, e);
      }
    }
  }

  /**
   * Play a coin chime with pitch scaled by combo count.
   * Each subsequent combo raises the pitch by one semitone.
   * @param {number} combo Current combo count (1-based)
   */
  playCoinCombo(combo = 1) {
    this._ensureMuteState();
    if (this.muted) return;

    const game = window.phaserGame;
    if (game && game.sound) {
      try {
        const clampedCombo = Math.min(combo, 12); // cap at one octave
        const rate = Math.pow(1.059463, clampedCombo - 1); // 1 semitone step per combo
        game.sound.play('coin', { rate: rate });
      } catch (e) {
        console.warn('[AudioManager] Failed to play coin combo sound:', e);
      }
    }
  }

  /**
   * Toggle mute state.
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this.muted = !this.muted;
    const game = window.phaserGame;
    if (game && game.sound) {
      game.sound.mute = this.muted;
    }
    return this.muted;
  }

  // =========================================================================
  // BGM Methods - Disabled / Stubbed out for sound-effects only gameplay
  // =========================================================================

  startBGM() {
    // Generative BGM loop disabled
  }

  stopBGM() {
    // Generative BGM loop disabled
  }

  pauseBGM() {
    // Generative BGM loop disabled
  }

  resumeBGM() {
    // Generative BGM loop disabled
  }

  updateBGM(speedNorm = 0, feverActive = false, anomalyType = null) {
    // Generative BGM loop disabled
  }
}

export default new AudioManager();
