import { Howler } from 'howler';

// Central audio wrapper around Howler.js.
//
// The game STARTS MUTED - a requirement on portals like Poki - and the
// player opts in via the in-game toggle. Sound effects are registered in
// `this.sounds`; until real assets exist, `play()` is a safe no-op.
//
// To add a sound later:
//   import { Howl } from 'howler';
//   this.sounds.jump = new Howl({ src: ['assets/audio/jump.webm', 'assets/audio/jump.mp3'] });
class AudioManager {
  constructor() {
    this.muted = true;
    Howler.mute(true);
    this.sounds = {};
  }

  play(name) {
    const sound = this.sounds[name];
    if (sound) sound.play();
  }

  toggleMute() {
    this.muted = !this.muted;
    Howler.mute(this.muted);
    return this.muted;
  }
}

export default new AudioManager();
