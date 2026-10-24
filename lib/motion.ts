// Every timing / easing / spring constant used by the site lives here.
// Springs are second-order (mass = 1): a = stiffness·(target − x) − damping·v.

const DEG = Math.PI / 180;

export const MOTION = {
  /** dt clamp for every frame-loop integrator (s) */
  maxDelta: 1 / 30,
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

/**
 * Cloth micro-motion (components/three/fabric.ts). Amplitudes are fractions
 * of the garment's width. Mutable so the tuning panel can change them live.
 */
export const FABRIC_DEFAULTS = {
  enabled: true,
  /** depth of the dent under the pointer */
  press: 0,
  /** height of the ring spreading from the pointer */
  ripple: 0,
  /** size of the pressed area */
  radius: 0.16,
  /** billowing while hovered */
  breathe: 0,
  /** twist travelling down the garment while it swivels */
  wave: 0.008,
  /** hem trailing the hanger as it slides */
  sway: 0.012,
  /** cloth pulled along by a moving pointer */
  drag: 0,
  /** hovered garment leans toward the pointer (deg of yaw at the edge) */
  leanDeg: 0,
  /** how much neighbours rustle as the pointer passes (0–1) */
  rustle: 0,
  /** how fast the pressed spot follows the pointer */
  cursorLambda: 9,
};

export type FabricConfig = typeof FABRIC_DEFAULTS;

export const FABRIC: FabricConfig = { ...FABRIC_DEFAULTS };
