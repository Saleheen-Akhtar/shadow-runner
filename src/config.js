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

// The two stacked worlds. Readability relies on luminance contrast and
// shape differences (blocks vs spikes), not hue - colorblind friendly.
export const WORLDS = {
  light: { key: 'light', top: 0, height: 270, bg: 0xe9e6dd, ground: 0xcfccc2, ink: 0x1d1d24, groundY: 240, label: 'LIGHT' },
  dark: { key: 'dark', top: 270, height: 270, bg: 0x14141b, ground: 0x232330, ink: 0xf2f0e8, groundY: 510, label: 'DARK' },
};
