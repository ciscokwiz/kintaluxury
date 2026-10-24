// Every timing / easing / spring constant used by the site lives here.
// Springs are second-order (mass = 1): a = stiffness·(target − x) − damping·v.

const DEG = Math.PI / 180;

export const MOTION = {
  /** Limit tab-resume jumps without slowing time on devices below 30 fps. */
  maxDelta: 1 / 4,
  /** fixed sub-step used to integrate the springs (s) */
  subStep: 1 / 240,

  // 7.1 hover swivel
  swivel: { stiffness: 125, damping: 22 },
  restYawDeg: 77,
  restYawJitterDeg: 4,
  restRollJitterDeg: 0.65,
  /** garments that rest a little more open so a sliver of the print shows */
  openRestYawDeg: 70,
  openRestIndices: [5, 8] as readonly number[], // #06, #09

  // 7.2 rail sliding + sway
  slide: { stiffness: 145, damping: 24 },
  sway: { stiffness: 65, damping: 11 },
  /** targetRoll = −velocityX(world units/s) · swayGain, clamped to ±swayMax */
  swayGain: 0.018,
  swayMax: 3 * DEG,
  restPitchVw: 6.5,
  wFrontVw: { desktop: 18, tablet: 23, mobile: 15 },
  minGapVw: 0.4,
  /** tightest spacing garments bunch to near the rail ends */
  bunchPitchVw: 1.6,

  // 7.3 hover label
  label: { enterMs: 160, exitMs: 120, enterY: 4, glideLambda: 12 },

  // 7.5 open
  open: { totalMs: 700, veilMs: 450, uiDelayMs: 350, uiMs: 350, uiStaggerMs: 40, uiY: 8, blurPx: 14 },
  // 7.6 navigate
  navFadeMs: 300,
  // 7.8 close
  close: { overlayMs: 200, releaseMs: 120, totalMs: 650 },
  /** settle sway allowed as the tail of the open animation */
  detailSettle: { amplitudeDeg: 0.45, hz: 1, decay: 5 },

  // 7.9 marquee
  marqueePxPerSec: 38,

  // 6 micro-parallax
  parallax: { x: 0.002, y: 0.001, lambda: 4 },

  // 10 reduced motion
  reducedSwivelMs: 120,

  /** fade the whole scene in once textures are ready */
  sceneFadeMs: 400,
} as const;

export const DEG_TO_RAD = DEG;

/** Model morph gains, mutable for the optional motion tuning panel. */
export const FABRIC_DEFAULTS = {
  enabled: true,
  /** 0.008 gives the reviewed turn lag at full strength. */
  wave: 0.008,
  /** 0.012 gives the reviewed slide lag at full strength. */
  sway: 0.012,
};

export type FabricConfig = typeof FABRIC_DEFAULTS;

export const FABRIC: FabricConfig = { ...FABRIC_DEFAULTS };
