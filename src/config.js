// Central tuning knobs for Shadow Runner.
export const CFG = {
  WIDTH: 960,
  HEIGHT: 540,

  // Runner physics (manual integration, px/s)
  GRAVITY: 2400,
  JUMP_VELOCITY: -820,
  RUNNER_X: 150,

  // Difficulty ramp: speed = BASE + RAMP * seconds, capped at MAX
  BASE_SPEED: 320,
  SPEED_RAMP: 7,
  MAX_SPEED: 760,

  // Scoring: points per px travelled, per active (non-frozen) world
  SCORE_RATE: 0.05,

  // Spawner: time between obstacle arrivals within one world (ms)
  SPAWN_GAP_MIN_MS: 900,
  SPAWN_GAP_MAX_MS: 1700,
  // Fairness: minimum gap between required inputs ACROSS worlds (ms),
  // except during deliberate sync events.
  MIN_CROSS_GAP_MS: 350,

  // Sync events: both worlds get the same obstacle, one input jumps both
  SYNC_MIN_MS: 12000,
  SYNC_MAX_MS: 20000,
  SYNC_INPUT_DEBOUNCE_MS: 150,

  // Freeze power-up
  POWERUP_MIN_MS: 15000,
  POWERUP_MAX_MS: 25000,
  FREEZE_MS: 4000,

  BEST_KEY: 'shadow-runner-best',
};

// Render at device-pixel resolution (capped at 2x) so shape-based art
// stays crisp when the canvas is scaled up to fill the screen.
export const DPR = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

// The two stacked worlds. Readability relies on luminance contrast and
// shape differences (crates vs spikes), not hue - colorblind friendly.
export const WORLDS = {
  light: {
    key: 'light',
    top: 0,
    height: 270,
    groundY: 240,
    label: 'LIGHT',
    labelColor: '#8e8b81',
    bg: 0xe9e6dd,
    ink: 0x1d1d24,
    skyTop: 0xa9def2,
    skyBottom: 0xeae7de,
    ground: 0xcfccc2,
    stripe: 0xb3b0a3,
    hill: 0xc6d3b8,
    prop: 0x9fae8c,
    runnerBody: 0x23233a,
    runnerAccent: 0xff5a5a,
    runnerEye: 0xffffff,
    crate: 0x9a7350,
    crateEdge: 0x66492f,
    spike: 0x6e6e78,
    dust: 0xcfc6b2,
  },
  dark: {
    key: 'dark',
    top: 270,
    height: 270,
    groundY: 510,
    label: 'DARK',
    labelColor: '#4a4a5e',
    bg: 0x14141b,
    ink: 0xf2f0e8,
    skyTop: 0x0b0b14,
    skyBottom: 0x222236,
    ground: 0x232330,
    stripe: 0x3a3a52,
    hill: 0x1e1e2f,
    prop: 0x2d2d47,
    runnerBody: 0xe9e7f4,
    runnerAccent: 0x59c2ff,
    runnerEye: 0x23233a,
    crate: 0x45456e,
    crateEdge: 0x8181c0,
    spike: 0xb9bccc,
    dust: 0x42425f,
  },
};
