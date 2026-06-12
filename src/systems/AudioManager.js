// ---------------------------------------------------------------------------
// AudioManager – Silent Stub (All Audio Removed)
// ---------------------------------------------------------------------------
// Replaces the audio engine with a zero-operational stub, completely disabling
// all sound effects and background music in the game.
// ---------------------------------------------------------------------------

class AudioManager {
  constructor() {
    this.muted = true;
  }

  play(name) {
    // No-op
  }

  playCoinCombo(combo = 1) {
    // No-op
  }

  toggleMute() {
    return true;
  }

  startBGM() {
    // No-op
  }

  stopBGM() {
    // No-op
  }

  pauseBGM() {
    // No-op
  }

  resumeBGM() {
    // No-op
  }

  updateBGM(speedNorm = 0, feverActive = false, anomalyType = null) {
    // No-op
  }
}

export default new AudioManager();
