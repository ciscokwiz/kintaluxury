// Every timing / easing / spring constant used by the site lives here.
// Springs are second-order (mass = 1): a = stiffness·(target − x) − damping·v.

const DEG = Math.PI / 180;

export const MOTION = {
  /** dt clamp for every frame-loop integrator (s) */
  maxDelta: 1 / 30,
  /** fixed sub-step used to integrate the springs (s) */
  subStep: 1 / 240,

  // 7.1 hover swivel
  swivel: { stiffness: 140, damping: 20 },
  hoverScale: 1.04,
  hoverLiftVh: 0.6,
  restYawDeg: 74,
  restYawJitterDeg: 6,
  restRollJitterDeg: 1.5,
  /** garments that rest a little more open so a sliver of the print shows */
  openRestYawDeg: 66,
  openRestIndices: [5, 8] as readonly number[], // #06, #09

  // 7.2 rail sliding + sway
  slide: { stiffness: 170, damping: 18 },
  sway: { stiffness: 60, damping: 6 },
  /** targetRoll = −velocityX(world units/s) · swayGain, clamped to ±swayMax */
  swayGain: 0.035,
  swayMax: 7 * DEG,
  restPitchVw: 4.65,
  wFrontVw: { desktop: 15, tablet: 26, mobile: 15 },
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
  detailSettle: { amplitudeDeg: 0.8, hz: 1.1, decay: 4.5 },

  // 7.9 marquee
  marqueePxPerSec: 38,

  // 6 micro-parallax
  parallax: { x: 0.006, y: 0.004, lambda: 4 },

  // 10 reduced motion
  reducedSwivelMs: 120,

  /** fade the whole scene in once textures are ready */
  sceneFadeMs: 400,
} as const;

export const DEG_TO_RAD = DEG;
