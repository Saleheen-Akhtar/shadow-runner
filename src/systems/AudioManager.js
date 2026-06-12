// ---------------------------------------------------------------------------
// AudioManager – Procedural Web Audio API engine for Shadow Runner
// ---------------------------------------------------------------------------
// Zero audio files required. Every sound is synthesized at runtime using
// oscillators, noise buffers, and envelopes. Generative BGM is disabled by
// default to play sound effects only, as requested by the user.
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

    /** @type {AudioContext|null} */
    this.ctx = null;

    // Master gain nodes
    /** @type {GainNode|null} */
    this._masterSFX = null;

    // Volume targets
    this._SFX_VOL = 0.25; // Raised slightly to make SFX punchier
  }

  // -------------------------------------------------------------------------
  // Lazy AudioContext init (needs user gesture on most browsers)
  // -------------------------------------------------------------------------
  _ensureContext() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();

      // Master SFX chain
      this._masterSFX = this.ctx.createGain();
      this._masterSFX.gain.value = this.muted ? 0 : this._SFX_VOL;
      this._masterSFX.connect(this.ctx.destination);
    } catch (e) {
      console.warn('[AudioManager] Web Audio API unavailable:', e);
      return null;
    }
    return this.ctx;
  }

  /** Resume a suspended context (autoplay policy). */
  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // -------------------------------------------------------------------------
  // Utility helpers
  // -------------------------------------------------------------------------
  /** Create a white-noise AudioBuffer (1 second, mono). */
  _noiseBuffer() {
    if (this._noiseBuf) return this._noiseBuf;
    const ctx = this.ctx;
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuf = buf;
    return buf;
  }

  // -------------------------------------------------------------------------
  // Upgraded High-Fidelity SFX Generators
  // -------------------------------------------------------------------------

  /** Jump – Triangle pitch sweep with a highpass wind noise transient */
  _sfxJump() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Core sweep (triangle wave for warmth)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(750, t + 0.12);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    // 2. Air thrust noise (puff of wind)
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1200, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(400, t + 0.08);
    noiseFilter.Q.value = 1.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this._masterSFX);

    osc.connect(gain);
    gain.connect(this._masterSFX);

    osc.start(t);
    osc.stop(t + 0.13);
    noise.start(t);
    noise.stop(t + 0.09);
  }

  /** Slide – Low rumble sweep layered with friction bandpass noise */
  _sfxSlide() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Low rumble
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.22);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    // 2. Friction dust noise
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.exponentialRampToValueAtTime(250, t + 0.22);
    filter.Q.value = 2.0;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this._masterSFX);

    osc.connect(gain);
    gain.connect(this._masterSFX);

    osc.start(t);
    osc.stop(t + 0.26);
    noise.start(t);
    noise.stop(t + 0.26);
  }

  /** Coin – Dual chime (perfect fifth arpeggio) + metallic transient tick */
  _sfxCoin(freq = 880) {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Arpeggiating chimes: note 1 (freq) then note 2 (freq * 1.5 - perfect fifth)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);
    gain1.gain.setValueAtTime(0.35, t);
    gain1.gain.setValueAtTime(0.35, t + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.498, t + 0.04);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.setValueAtTime(0.25, t + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    // 3. Metallic strike tick transient
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    tick.type = 'sine';
    tick.frequency.setValueAtTime(freq * 3.5, t);
    tickGain.gain.setValueAtTime(0.2, t);
    tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

    osc1.connect(gain1);
    osc2.connect(gain2);
    tick.connect(tickGain);

    gain1.connect(this._masterSFX);
    gain2.connect(this._masterSFX);
    tickGain.connect(this._masterSFX);

    osc1.start(t);
    osc2.start(t + 0.04);
    tick.start(t);

    osc1.stop(t + 0.2);
    osc2.stop(t + 0.25);
    tick.stop(t + 0.02);
  }

  /** Hit – Harsh square-wave dive crash + heavy low-pass noise explosion */
  _sfxHit() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Low frequency rumble dive (square wave + envelope)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);

    // Distortion
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
    }
    shaper.curve = curve;

    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(shaper);
    shaper.connect(oscGain);
    oscGain.connect(this._masterSFX);

    // 2. Heavy noise explosion
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(800, t);
    lp.frequency.exponentialRampToValueAtTime(40, t + 0.35);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    noise.connect(lp);
    lp.connect(noiseGain);
    noiseGain.connect(this._masterSFX);

    osc.start(t);
    osc.stop(t + 0.5);
    noise.start(t);
    noise.stop(t + 0.42);
  }

  /** Sync – Resonant saw-chord sweep (E-major triad) with 12 Hz vibrato */
  _sfxSync() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const freqs = [329.63, 415.30, 493.88]; // E4, G#4, B4
    const oscs = [];
    const gain = ctx.createGain();

    // 12Hz Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 6;

    lfo.connect(lfoGain);

    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      oscs.push(osc);
    });

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    gain.connect(filter);
    filter.connect(this._masterSFX);

    lfo.start(t);
    oscs.forEach(o => o.start(t));
    
    lfo.stop(t + 0.3);
    oscs.forEach(o => o.stop(t + 0.3));
  }

  /** Freeze – High icy 4-note chime arpeggio + highpass crackle noise */
  _sfxFreeze() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const notes = [987.77, 1318.51, 1567.98, 1975.53]; // B5, E6, G6, B6
    
    notes.forEach((freq, idx) => {
      const delay = idx * 0.035;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + delay);

      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.22, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.2);

      osc.connect(gain);
      gain.connect(this._masterSFX);

      osc.start(t + delay);
      osc.stop(t + delay + 0.22);
    });

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this._masterSFX);

    noise.start(t);
    noise.stop(t + 0.26);
  }

  /** Boost – FM warp engine pitch lift (Carrier + Modulator) */
  _sfxBoost() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const gain = ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(160, t);
    carrier.frequency.exponentialRampToValueAtTime(1400, t + 0.4);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(90, t);
    modulator.frequency.linearRampToValueAtTime(280, t + 0.4);

    modGain.gain.setValueAtTime(80, t);
    modGain.gain.linearRampToValueAtTime(350, t + 0.4);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(3000, t + 0.4);
    lp.Q.value = 2.5;

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    carrier.connect(lp);
    lp.connect(gain);
    gain.connect(this._masterSFX);

    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + 0.46);
    modulator.stop(t + 0.46);
  }

  /** Crumble – Staggered gravel cracks + low-frequency rumble */
  _sfxCrumble() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const delay = i * 0.06;
      const src = ctx.createBufferSource();
      src.buffer = this._noiseBuffer();

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 200 + Math.random() * 250;
      bp.Q.value = 3.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0.42, t + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.08);

      src.connect(bp);
      bp.connect(gain);
      gain.connect(this._masterSFX);

      src.start(t + delay);
      src.stop(t + delay + 0.1);
    }

    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(65, t);
    rumbleGain.gain.setValueAtTime(0.35, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    rumble.connect(rumbleGain);
    rumbleGain.connect(this._masterSFX);
    rumble.start(t);
    rumble.stop(t + 0.33);
  }

  /** Drone – Cybernetic oscillation sweep + 24 Hz vibrato alarm */
  _sfxDrone() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.18);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 24;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 40;

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this._masterSFX);

    lfo.start(t);
    osc.start(t);
    lfo.stop(t + 0.21);
    osc.stop(t + 0.21);
  }

  /** Double Jump – High crystal chime strike arpeggiating upward */
  _sfxDoubleJump() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. Crystal chime strike (high transient)
    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(1100, t);
    chime.frequency.setValueAtTime(1400, t + 0.02);
    chimeGain.gain.setValueAtTime(0.35, t);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    chime.connect(chimeGain);
    chimeGain.connect(this._masterSFX);
    chime.start(t);
    chime.stop(t + 0.07);

    // 2. Detuned rising waves
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, t); // C5
    osc1.frequency.exponentialRampToValueAtTime(1396.91, t + 0.16); // F6
    osc1.detune.value = -8;

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(523.25, t);
    osc2.frequency.exponentialRampToValueAtTime(1396.91, t + 0.16);
    osc2.detune.value = 8;

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this._masterSFX);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.2);
    osc2.stop(t + 0.2);
  }

  /** Dash – Resonant sci-fi whoosh (Q-swept noise) + low sawtooth sweep */
  _sfxDash() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // 1. High-speed rocket whoosh (bandpass swept noise)
    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(500, t + 0.22);
    bp.Q.value = 4.5; // Resonant phase-like sound

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.5, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    noise.connect(bp);
    bp.connect(noiseGain);
    noiseGain.connect(this._masterSFX);

    // 2. Heavy engine punch (low sawtooth sweep)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.18);

    oscGain.gain.setValueAtTime(0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(oscGain);
    oscGain.connect(this._masterSFX);

    noise.start(t);
    noise.stop(t + 0.25);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // -------------------------------------------------------------------------
  // Public SFX API
  // -------------------------------------------------------------------------

  /**
   * Play a named sound effect.
   * @param {string} name One of: jump, slide, coin, hit, sync, freeze, boost, crumble, drone, doublejump, dash
   */
  play(name) {
    if (this.muted) return;
    if (!this._ensureContext()) return;
    this._resume();

    switch (name) {
      case 'jump':        this._sfxJump();        break;
      case 'slide':       this._sfxSlide();       break;
      case 'coin':        this._sfxCoin();        break;
      case 'hit':         this._sfxHit();         break;
      case 'sync':        this._sfxSync();        break;
      case 'freeze':      this._sfxFreeze();      break;
      case 'boost':       this._sfxBoost();       break;
      case 'crumble':     this._sfxCrumble();     break;
      case 'drone':       this._sfxDrone();       break;
      case 'doublejump':  this._sfxDoubleJump();  break;
      case 'dash':        this._sfxDash();        break;
      default: break; // unknown sound – safe no-op
    }
  }

  /**
   * Play a coin chime with pitch scaled by combo count.
   * Each subsequent combo raises the pitch by a minor third (~1.189x).
   * @param {number} combo Current combo count (1-based)
   */
  playCoinCombo(combo = 1) {
    if (this.muted) return;
    if (!this._ensureContext()) return;
    this._resume();

    const clampedCombo = Math.min(combo, 12); // cap at an octave + minor third
    const freq = 880 * Math.pow(1.189207, clampedCombo - 1); // minor 3rd steps
    this._sfxCoin(freq);
  }

  /**
   * Toggle mute state.
   * @returns {boolean} New muted state
   */
  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      this._resume();
      const now = this.ctx.currentTime;
      if (this._masterSFX) {
        this._masterSFX.gain.cancelScheduledValues(now);
        this._masterSFX.gain.setValueAtTime(this.muted ? 0 : this._SFX_VOL, now);
      }
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
