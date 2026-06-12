// Central tuning knobs for Shadow Runner.
export const CFG = {
  WIDTH: 960,
  HEIGHT: 540,

  // Runner physics (manual integration, px/s)
  GRAVITY: 2400,
  JUMP_VELOCITY: -820,
  RUNNER_X: 150,
  SLIDE_MS: 600,

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

  // Coins & combo
  COIN_MIN_MS: 4000,
  COIN_MAX_MS: 8000,
  COMBO_TIMEOUT_MS: 5000,

  BEST_KEY: 'shadow-runner-best',
  COINS_KEY: 'shadow-runner-coins-total',
  RUNS_KEY: 'shadow-runner-runs',
};

// Render at device-pixel resolution (capped at 2x) so shape-based art
// stays crisp when the canvas is scaled up to fill the screen.
export const DPR = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);

// Premium typography — loaded via Google Fonts in index.html.
export const FONTS = {
  HEADING: '"Outfit", "Arial Black", sans-serif',
  MONO: '"JetBrains Mono", monospace',
};

// Curated accent palette shared across all UI.
export const COLORS = {
  GOLD: '#FFD34D',
  GOLD_HEX: 0xFFD34D,
  GOLD_DARK: '#B8962A',
  GOLD_DARK_HEX: 0xB8962A,
  CYAN: '#59C2FF',
  CYAN_HEX: 0x59C2FF,
  RED: '#FF5A5A',
  RED_HEX: 0xFF5A5A,
  TEXT_PRIMARY: '#F2F0E8',
  TEXT_SECONDARY: '#8A8A9A',
  TEXT_MUTED: '#5A5A6A',
  PANEL_BG: 0x0A0A14,
  PANEL_ALPHA: 0.85,
};

  // Character skins, unlocked when the player's BEST score reaches
// `unlock`. Each skin defines runner colors per world.
export const SKINS = [
  { name: 'CLASSIC', unlock: 0, cost: 0, light: { body: 0x23233a, accent: 0xff5a5a }, dark: { body: 0xe9e7f4, accent: 0x59c2ff } },
  { name: 'EMBER', unlock: 500, cost: 150, light: { body: 0x6b2d1f, accent: 0xffb347 }, dark: { body: 0xffd9a0, accent: 0xff5a3c } },
  { name: 'TOXIC', unlock: 1000, cost: 300, light: { body: 0x1f4d2e, accent: 0x9dff57 }, dark: { body: 0xddffe2, accent: 0x2fe07a } },
  { name: 'ROYAL', unlock: 2500, cost: 600, light: { body: 0x3a2a6b, accent: 0xffd34d }, dark: { body: 0xe6dcff, accent: 0xb98aff } },
  { name: 'VOID', unlock: 5000, cost: 1000, light: { body: 0x101014, accent: 0xff2fa0 }, dark: { body: 0xffffff, accent: 0x00e8ff } },
  { name: 'CYBER', unlock: 'CHALLENGE', cost: 1800, light: { body: 0x0a2b25, accent: 0x00ffcc }, dark: { body: 0x2e0a24, accent: 0xff00aa } },
];

export const SKIN_KEY = 'shadow-runner-skin';
export const CHALLENGE_UNLOCKED_KEY = 'shadow-runner-challenge-unlocked';
export const PURCHASED_SKINS_KEY = 'shadow-runner-purchased-skins';

export const TRAILS = [
  { name: 'NEON', cost: 0, displayName: 'NEON ACCENT' },
  { name: 'MATRIX', cost: 200, displayName: 'MATRIX CODE' },
  { name: 'PLASMA', cost: 400, displayName: 'PLASMA STORM' },
  { name: 'GOLDEN', cost: 750, displayName: 'GOLDEN SPARK' },
  { name: 'GLITCH', cost: 1200, displayName: 'GLITCH BLOCK' },
];

export const TRAIL_KEY = 'shadow-runner-trail';
export const PURCHASED_TRAILS_KEY = 'shadow-runner-purchased-trails';

const SECRET_KEY = 'shadow_runner_salt_value';

function encrypt(val) {
  const str = String(val);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
  }
  return btoa(result);
}

function decrypt(cipher) {
  if (!cipher) return null;
  try {
    const raw = atob(cipher);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      result += String.fromCharCode(raw.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
    }
    return result;
  } catch (e) {
    return null;
  }
}

export const secureStorage = {
  getItem(key) {
    const val = localStorage.getItem(key);
    if (val === null) return null;
    const decrypted = decrypt(val);
    return decrypted !== null ? decrypted : val;
  },
  setItem(key, val) {
    localStorage.setItem(key, encrypt(val));
  },
  removeItem(key) {
    localStorage.removeItem(key);
  }
};

export function getSelectedSkin() {
  const i = Number(secureStorage.getItem(SKIN_KEY) || 0);
  return SKINS[Math.min(Math.max(i, 0), SKINS.length - 1)];
}

export function isSkinUnlocked(index) {
  if (index === 0) return true;
  const skin = SKINS[index];
  if (!skin) return false;
  
  // Check best score milestone
  const bestScore = Number(secureStorage.getItem(CFG.BEST_KEY) || 0);
  if (typeof skin.unlock === 'number' && bestScore >= skin.unlock) {
    return true;
  }
  
  // Check challenge unlock
  if (skin.unlock === 'CHALLENGE' && checkChallengeSkinUnlocked()) {
    return true;
  }
  
  // Check purchased skins
  try {
    const purchased = JSON.parse(secureStorage.getItem(PURCHASED_SKINS_KEY) || '[]');
    if (purchased.includes(skin.name)) {
      return true;
    }
  } catch (e) {
    // ignore
  }
  
  return false;
}

export function getPurchasedTrails() {
  try {
    const purchased = JSON.parse(secureStorage.getItem(PURCHASED_TRAILS_KEY) || '[]');
    if (!purchased.includes('NEON')) {
      purchased.unshift('NEON');
    }
    return purchased;
  } catch (e) {
    return ['NEON'];
  }
}

export function getSelectedTrail() {
  return secureStorage.getItem(TRAIL_KEY) || 'NEON';
}

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

export function checkChallengeSkinUnlocked() {
  return secureStorage.getItem(CHALLENGE_UNLOCKED_KEY) === 'true';
}

export function getDailyChallenge() {
  const now = new Date();
  const dayString = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  const dayIndex = now.getDate() % 3; // 0, 1, or 2

  let type = '';
  let target = 0;
  let text = '';

  if (dayIndex === 0) {
    type = 'coins';
    target = 50;
    text = `Daily Challenge: Collect ${target} coins in one run`;
  } else if (dayIndex === 1) {
    type = 'jumps';
    target = 25;
    text = `Daily Challenge: Jump ${target} times in one run`;
  } else {
    type = 'slides';
    target = 15;
    text = `Daily Challenge: Slide ${target} times in one run`;
  }

  return { type, target, text, dayString };
}
