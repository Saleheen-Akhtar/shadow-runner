// ---------------------------------------------------------------------------
// AudioManager – Procedural Web Audio API engine for Shadow Runner
// ---------------------------------------------------------------------------
// Zero audio files required. Every sound is synthesized at runtime using
// oscillators, noise buffers, and envelopes. BGM is a generative loop that
// responds to gameplay intensity (speed, fever, anomalies).
//
// Public API (backwards-compatible with the old Howler stub):
//   audio.muted            – boolean
//   audio.play(name)       – trigger a named SFX
//   audio.toggleMute()     – returns new muted state
//   audio.playCoinCombo(n) – coin with rising pitch per combo
//   audio.startBGM()       – begin generative background music
//   audio.stopBGM()        – fade out and stop BGM
//   audio.pauseBGM()       – pause BGM (game pause)
//   audio.resumeBGM()      – resume BGM
//   audio.updateBGM(speedNorm, feverActive, anomalyType) – per-frame update
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
    /** @type {GainNode|null} */
    this._masterBGM = null;

    // BGM state
    this._bgmRunning = false;
    this._bgmPaused = false;
    this._bgmTimerId = null;
    this._bgmNextTime = 0;
    this._bgmStep = 0;
    this._bgmTempo = 130; // BPM
    this._bgmSpeedNorm = 0;
    this._bgmFever = false;
    this._bgmAnomaly = null;

    // BGM filter nodes (created on demand)
    /** @type {BiquadFilterNode|null} */
    this._bgmLowpass = null;

    // Volume targets
    this._SFX_VOL = 0.15;
    this._BGM_VOL = 0.08;
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

      // Master BGM chain: BGM → lowpass → gain → destination
      this._bgmLowpass = this.ctx.createBiquadFilter();
      this._bgmLowpass.type = 'lowpass';
      this._bgmLowpass.frequency.value = 20000; // wide open by default
      this._bgmLowpass.Q.value = 1;

      this._masterBGM = this.ctx.createGain();
      this._masterBGM.gain.value = this.muted ? 0 : this._BGM_VOL;
      this._masterBGM.connect(this._bgmLowpass);
      this._bgmLowpass.connect(this.ctx.destination);
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
  // SFX generators
  // -------------------------------------------------------------------------

  /** Jump – quick upward sine sweep 300→800 Hz over 80 ms */
  _sfxJump() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this._masterSFX);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /** Slide – short downward sawtooth sweep 400→150 Hz over 100 ms */
  _sfxSlide() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.1);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(this._masterSFX);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Coin – musical chime at given frequency.
   * @param {number} freq Base frequency (880 default)
   */
  _sfxCoin(freq = 880) {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Fundamental
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = freq;

    // Harmonic overtone for sparkle
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2.5;

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.5, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.15, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(this._masterSFX);
    gain2.connect(this._masterSFX);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.18);
    osc2.stop(t + 0.15);
  }

  /** Hit – harsh white noise burst through bandpass, 100 ms */
  _sfxHit() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 2.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    // Slight distortion via waveshaper for extra harshness
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
    }
    ws.curve = curve;

    src.connect(bp);
    bp.connect(ws);
    ws.connect(gain);
    gain.connect(this._masterSFX);
    src.start(t);
    src.stop(t + 0.12);
  }

  /** Sync – rising power chord (two detuned sines sweeping up, 200 ms) */
  _sfxSync() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const makeOsc = (detuneCents) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.2);
      osc.detune.value = detuneCents;
      return osc;
    };

    const osc1 = makeOsc(-15);
    const osc2 = makeOsc(15);

    // Third oscillator for "fifth" harmony
    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(330, t);
    osc3.frequency.exponentialRampToValueAtTime(990, t + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.setValueAtTime(0.35, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    osc3.connect(gain);
    gain.connect(this._masterSFX);

    osc1.start(t);
    osc2.start(t);
    osc3.start(t);
    osc1.stop(t + 0.28);
    osc2.stop(t + 0.28);
    osc3.stop(t + 0.28);
  }

  /** Freeze – crystalline shimmer (high sine + LFO tremolo, 300 ms) */
  _sfxFreeze() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Main tone – high glassy sine
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.3);

    // Shimmer overtone
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(3600, t);
    osc2.frequency.exponentialRampToValueAtTime(2700, t + 0.3);

    // LFO for tremolo
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 18; // 18 Hz tremolo

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3; // depth

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    // LFO → gain.gain (AM tremolo)
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this._masterSFX);

    lfo.start(t);
    osc.start(t);
    osc2.start(t);
    lfo.stop(t + 0.35);
    osc.stop(t + 0.38);
    osc2.stop(t + 0.38);
  }

  /** Boost – hyper-speed rocket boost sweep */
  _sfxBoost() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.35);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(2500, t + 0.35);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterSFX);

    osc.start(t);
    osc.stop(t + 0.42);
  }

  /** Crumble – low crunching noise for crumbling ground */
  _sfxCrumble() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 0.25);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(this._masterSFX);

    src.start(t);
    src.stop(t + 0.3);
  }

  /** Drone – science-fiction alarm chirp for drone hazards */
  _sfxDrone() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(300, t + 0.15);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this._masterSFX);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Double Jump – high sweep chime for mid-air jump */
  _sfxDoubleJump() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(500, t);
    osc1.frequency.exponentialRampToValueAtTime(1200, t + 0.08);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(600, t);
    osc2.frequency.exponentialRampToValueAtTime(1440, t + 0.08);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this._masterSFX);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.12);
    osc2.stop(t + 0.12);
  }

  /** Dash – white noise whoosh sweep */
  _sfxDash() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.15);
    filter.Q.value = 2.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterSFX);

    src.start(t);
    src.stop(t + 0.2);
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

    const clampedCombo = Math.min(combo, 12); // cap at an octave + some
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
      if (this._masterBGM) {
        this._masterBGM.gain.cancelScheduledValues(now);
        this._masterBGM.gain.setValueAtTime(this.muted ? 0 : this._BGM_VOL, now);
      }
    }
    return this.muted;
  }

  // =========================================================================
  // Dynamic BGM system – lo-fi / synthwave generative loop
  // =========================================================================

  // Musical scale: C minor pentatonic across 2 octaves (MIDI → Hz)
  static _SCALE = [
    130.81, 155.56, 174.61, 196.00, 233.08,   // C3 Eb3 F3 G3 Bb3
    261.63, 311.13, 349.23, 392.00, 466.16,   // C4 Eb4 F4 G4 Bb4
  ];

  // Bass pattern (index into _SCALE) – 16-step, repeats
  static _BASS_PATTERN = [0, 0, 2, 2, 3, 3, 4, 4, 0, 0, 5, 5, 3, 3, 2, 2];

  // Arpeggio pattern for fever mode (index into _SCALE)
  static _ARP_PATTERN = [5, 7, 8, 9, 8, 7, 5, 4, 5, 6, 7, 8, 9, 8, 7, 6];

  /** Start the generative BGM loop. */
  startBGM() {
    if (!this._ensureContext()) return;
    this._resume();

    if (this._bgmRunning) return;
    this._bgmRunning = true;
    this._bgmPaused = false;
    this._bgmStep = 0;
    this._bgmNextTime = this.ctx.currentTime + 0.05; // tiny lead-in
    this._bgmSpeedNorm = 0;
    this._bgmFever = false;
    this._bgmAnomaly = null;

    this._scheduleBGM();
  }

  /** Stop BGM with a short fade-out. */
  stopBGM() {
    if (!this._bgmRunning) return;
    this._bgmRunning = false;

    if (this._bgmTimerId) {
      clearTimeout(this._bgmTimerId);
      this._bgmTimerId = null;
    }

    // Fade out
    if (this.ctx && this._masterBGM) {
      const now = this.ctx.currentTime;
      this._masterBGM.gain.cancelScheduledValues(now);
      this._masterBGM.gain.setValueAtTime(this._masterBGM.gain.value, now);
      this._masterBGM.gain.linearRampToValueAtTime(0, now + 0.5);

      // Restore after fade
      setTimeout(() => {
        if (this._masterBGM && !this._bgmRunning) {
          this._masterBGM.gain.value = this.muted ? 0 : this._BGM_VOL;
        }
      }, 600);
    }
  }

  /** Pause BGM (for game pause). */
  pauseBGM() {
    if (!this._bgmRunning || this._bgmPaused) return;
    this._bgmPaused = true;
    if (this._bgmTimerId) {
      clearTimeout(this._bgmTimerId);
      this._bgmTimerId = null;
    }
  }

  /** Resume BGM after pause. */
  resumeBGM() {
    if (!this._bgmRunning || !this._bgmPaused) return;
    this._bgmPaused = false;
    this._resume();
    this._bgmNextTime = this.ctx.currentTime + 0.05;
    this._scheduleBGM();
  }

  /**
   * Update BGM parameters each frame.
   * @param {number} speedNorm  Normalized speed 0-1
   * @param {boolean} feverActive  Whether fever mode is active
   * @param {string|null} anomalyType  Current anomaly type or null
   */
  updateBGM(speedNorm = 0, feverActive = false, anomalyType = null) {
    this._bgmSpeedNorm = Math.max(0, Math.min(1, speedNorm));
    this._bgmFever = feverActive;
    this._bgmAnomaly = anomalyType;

    // Dynamic tempo: 130 base, up to 155 at max speed
    this._bgmTempo = 130 + this._bgmSpeedNorm * 25;

    // Lowpass filter for fog_of_war anomaly
    if (this._bgmLowpass && this.ctx) {
      const now = this.ctx.currentTime;
      if (anomalyType === 'fog_of_war') {
        this._bgmLowpass.frequency.setTargetAtTime(600, now, 0.1);
      } else {
        this._bgmLowpass.frequency.setTargetAtTime(20000, now, 0.1);
      }
    }
  }

  // -----------------------------------------------------------------------
  // BGM scheduling internals
  // -----------------------------------------------------------------------

  /** Schedule ahead pattern to keep the audio buffer full. */
  _scheduleBGM() {
    if (!this._bgmRunning || this._bgmPaused) return;

    const LOOK_AHEAD = 0.15; // seconds to schedule ahead
    const SCHEDULE_INTERVAL = 80; // ms between scheduler calls

    while (this._bgmNextTime < this.ctx.currentTime + LOOK_AHEAD) {
      const stepTime = this._bgmNextTime;
      const step = this._bgmStep % 16;
      const secondsPerStep = 60 / this._bgmTempo / 4; // 16th notes

      // --- Kick drum on beats 0, 4, 8, 12 ---
      if (step % 4 === 0) {
        this._bgmKick(stepTime);
      }

      // --- Bass note ---
      if (step % 2 === 0) {
        const patIdx = this._bgmFever
          ? AudioManager._ARP_PATTERN[step]
          : AudioManager._BASS_PATTERN[step];
        const freq = AudioManager._SCALE[patIdx] || 130.81;
        if (this._bgmFever) {
          this._bgmArp(stepTime, freq);
        } else {
          this._bgmBass(stepTime, freq);
        }
      }

      // --- Hi-hat when speed > 0.5 ---
      if (this._bgmSpeedNorm > 0.5) {
        this._bgmHiHat(stepTime);
      }

      // --- Warp speed stutter/glitch effect ---
      if (this._bgmAnomaly === 'warp_speed' && step % 3 === 0) {
        this._bgmGlitch(stepTime);
      }

      this._bgmNextTime += secondsPerStep;
      this._bgmStep++;
    }

    this._bgmTimerId = setTimeout(() => this._scheduleBGM(), SCHEDULE_INTERVAL);
  }

  /** Kick drum – sine burst at 60 Hz with pitch drop. */
  _bgmKick(time) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + 0.04);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    osc.connect(gain);
    gain.connect(this._masterBGM);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  /**
   * Bass note – triangle wave, short envelope.
   * @param {number} time Scheduled time
   * @param {number} freq Frequency
   */
  _bgmBass(time, freq) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const dur = 60 / this._bgmTempo / 4 * 1.5; // slightly legato
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.setValueAtTime(0.5, time + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(this._masterBGM);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  /**
   * Fever arpeggio – bright square-ish tone.
   * @param {number} time Scheduled time
   * @param {number} freq Frequency
   */
  _bgmArp(time, freq) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq * 2; // up an octave for brightness

    // Soften the square wave with a lowpass
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;

    const gain = ctx.createGain();
    const dur = 60 / this._bgmTempo / 4 * 0.7; // staccato
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this._masterBGM);
    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  /** Hi-hat – short filtered noise burst. */
  _bgmHiHat(time) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;

    const gain = ctx.createGain();
    // Volume scales with speed: louder as speedNorm approaches 1
    const vol = 0.08 + (this._bgmSpeedNorm - 0.5) * 0.3;
    gain.gain.setValueAtTime(Math.min(vol, 0.25), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(this._masterBGM);
    src.start(time);
    src.stop(time + 0.05);
  }

  /** Glitch/stutter – very short noise + pitch-bent sine for warp_speed. */
  _bgmGlitch(time) {
    const ctx = this.ctx;

    // Noise crackle
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    src.connect(gain);
    gain.connect(this._masterBGM);
    src.start(time);
    src.stop(time + 0.03);

    // Pitch-bent blip
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, time);
    osc.frequency.exponentialRampToValueAtTime(200, time + 0.03);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.15, time);
    g2.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    osc.connect(g2);
    g2.connect(this._masterBGM);
    osc.start(time);
    osc.stop(time + 0.05);
  }
}

export default new AudioManager();
