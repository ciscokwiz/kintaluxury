"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { MOTION } from "@/lib/motion";
import { PRODUCTS, TEE_HEM_FRAC } from "@/lib/products";

/* ------------------------------------------------------------------------
 * Viewport → world mapping.
 * World height is fixed at 10 units (1 unit = 10 vh). The camera sits on
 * the z axis looking straight at the z = 0 plane, so vw / vh map linearly.
 * --------------------------------------------------------------------- */

export const WORLD_H = 10;
export const FOV = 24;
export const CAM_Z = WORLD_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** texture layout (px in the 1000 × 1200 garment textures) */
export const TEX = { w: 1000, h: 1200, hangerTop: 62, hangerThick: 24 };

/**
 * Hanger outline per garment kind, in texture px: half-width and how far the
 * tips drop below the centre. Fitted so the bar stays inside the shoulders of
 * the photographed garments (a hoodie's shoulders sit much lower than a tee's).
 */
export const HANGER_PROFILE = {
  tee: { tipX: 285, drop: 95, power: 1.5 },
  hoodie: { tipX: 250, drop: 170, power: 1.3 },
} as const;
export type HangerKind = keyof typeof HANGER_PROFILE;

export type Breakpoint = "desktop" | "tablet" | "mobile";

export interface RackMetrics {
  widthPx: number;
  heightPx: number;
  worldW: number;
  bp: Breakpoint;
  /** vw → world x */
  x: (vw: number) => number;
  /** vh → world y */
  y: (vh: number) => number;
  /** vw length → world */
  lw: (vw: number) => number;
  /** vh length → world */
  lh: (vh: number) => number;
  /** world units per css px */
  unitPerPx: number;

  railY: number;
  railRadius: number;
  railLeft: number;
  railRight: number;
  hookR: number;
  hookTube: number;
  /** hook ring centre, relative to the rail centre */
  hookCy: number;
  /** top of the hook, relative to the rail centre */
  hookTop: number;
  /** y of the hanger's top edge (centre), relative to the rail centre */
  hangerTop: number;
  /** world units per texture px */
  texel: number;
  garmentW: number;
  garmentH: number;
  /** y of the texture centre, relative to the rail centre */
  garmentCy: number;
  /** z separation between front panel, hanger and back panel */
  layer: number;
  /** drape curvature: z = −k·x² */
  drapeK: number;

  pitch: number;
  wFront: number;
  gap: number;
  bunch: number;
  restX: number[];
  scrollable: boolean;
  scrollMax: number;

  hoverLift: number;
  /** product view: pivot y and scale of the detail garment */
  detailPivotY: number;
  detailScale: number;
  /** hem y (relative to the pivot, unscaled) for each product */
  hemY: number[];
}

export function computeMetrics(widthPx: number, heightPx: number): RackMetrics {
  const aspect = widthPx / Math.max(1, heightPx);
  const worldW = WORLD_H * aspect;
  const bp: Breakpoint = widthPx >= 1024 ? "desktop" : widthPx >= 640 ? "tablet" : "mobile";
  const x = (vw: number) => (vw / 100 - 0.5) * worldW;
  const y = (vh: number) => (0.5 - vh / 100) * WORLD_H;
  const lw = (vw: number) => (vw / 100) * worldW;
  const lh = (vh: number) => (vh / 100) * WORLD_H;

  const railY = y(26.8);
  const railRadius = lh(0.45);
  const hookTube = railRadius * 0.32;
  const hookR = railRadius * 1.9;
  const hookCy = hookR - railRadius - hookTube;
  const hookTop = hookCy + hookR + hookTube;
  const hangerTop = -lh(4.8);

  const garmentH = lh(bp === "mobile" ? 40 : 42);
  const texel = garmentH / TEX.h;
  const garmentW = TEX.w * texel;
  const garmentCy = hangerTop + TEX.hangerTop * texel - garmentH / 2;
  const frontWidth = garmentW * 0.88;

  const pitch = Math.max(lw(MOTION.restPitchVw), frontWidth * 0.272);
  // the brief's w_front (15 vw) assumes narrower garments; never part less than the garment is wide
  const wFront = Math.max(lw(MOTION.wFrontVw[bp]), frontWidth * 1.12);
  const gap = lw(MOTION.minGapVw);
  const bunch = Math.max(lw(MOTION.bunchPitchVw), pitch * 0.34);

  let railLeft = bp === "desktop" ? x(12.3) : x(6);
  let railRight = bp === "desktop" ? x(86.5) : x(94);
  const n = PRODUCTS.length;
  const rowSpan = (n - 1) * pitch;
  const endRoom = lw(4.8);
  const scrollable = bp === "mobile" || rowSpan + 2 * endRoom > railRight - railLeft;
  let scrollMax = 0;
  if (scrollable) {
    const half = rowSpan / 2 + wFront / 2 + pitch;
    railLeft = -half;
    railRight = half;
    scrollMax = Math.max(0, half - worldW / 2 + lw(4));
  }
  const centre = (railLeft + railRight) / 2;
  const restX = PRODUCTS.map((_, i) => centre - rowSpan / 2 + i * pitch);

  const hemY = PRODUCTS.map((p) => garmentCy + garmentH / 2 - p.hemFrac * garmentH);
  const teeHem = garmentCy + garmentH / 2 - TEE_HEM_FRAC * garmentH;
  const detailScale = lh(71 - 16) / (hookTop - teeHem);
  const detailPivotY = y(16) - hookTop * detailScale;

  return {
    widthPx,
    heightPx,
    worldW,
    bp,
    x,
    y,
    lw,
    lh,
    unitPerPx: WORLD_H / Math.max(1, heightPx),
    railY,
    railRadius,
    railLeft,
    railRight,
    hookR,
    hookTube,
    hookCy,
    hookTop,
    hangerTop,
    texel,
    garmentW,
    garmentH,
    garmentCy,
    layer: 8 * texel,
    drapeK: 0.24 / garmentW,
    pitch,
    wFront,
    gap,
    bunch,
    restX,
    scrollable,
    scrollMax,
    hoverLift: lh(MOTION.hoverLiftVh),
    detailPivotY,
    detailScale,
    hemY,
  };
}

/** Metrics for the canvas this hook is called in (recomputed on resize). */
export function useRackMetrics(): RackMetrics {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  return useMemo(() => computeMetrics(width, height), [width, height]);
}

/* ------------------------------------------------------------------------
 * Rack layout: target hook-x for every garment from the CURRENT facing of
 * every garment. Neighbours pack outward from the anchor; near the rail
 * ends they bunch instead of passing the brackets.
 * --------------------------------------------------------------------- */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function layoutRack(m: RackMetrics, facing: number[], anchor: number | null, out: number[]): number[] {
  const n = facing.length;
  if (anchor === null) {
    for (let i = 0; i < n; i++) out[i] = m.restX[i];
    return out;
  }
  const w = facing.map((f) => lerp(m.pitch, m.wFront, f));
  // spacing[i] = distance between garment i−1 and i
  const s = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    s[i] = (w[i - 1] + w[i]) / 2 + m.gap * Math.max(facing[i - 1], facing[i]);
  }
  const margin = m.railRadius * 2 + m.lw(0.6);
  const lo = m.railLeft + margin;
  const hi = m.railRight - margin;

  // how much each spacing may shrink when the row hits a rail end:
  // spacings next to a turned garment are rigid, outer ones bunch first
  const capacity = (i: number) => Math.max(0, s[i] - m.bunch) * (1 - Math.max(facing[i - 1], facing[i]));

  const compress = (from: number, to: number, step: 1 | -1, over: number) => {
    if (over <= 0) return 0;
    let total = 0;
    const weights: number[] = [];
    for (let i = from, d = 1; step > 0 ? i <= to : i >= to; i += step, d++) {
      const k = step > 0 ? i : i + 1;
      const wgt = capacity(k) * d;
      weights.push(wgt);
      total += wgt;
    }
    if (total <= 0) return over;
    let remaining = over;
    let j = 0;
    for (let i = from; step > 0 ? i <= to : i >= to; i += step, j++) {
      const k = step > 0 ? i : i + 1;
      const take = Math.min(capacity(k), (over * weights[j]) / total);
      s[k] -= take;
      remaining -= take;
    }
    return Math.max(0, remaining);
  };

  let ax = m.restX[anchor];
  const place = () => {
    out[anchor] = ax;
    for (let i = anchor + 1; i < n; i++) out[i] = out[i - 1] + s[i];
    for (let i = anchor - 1; i >= 0; i--) out[i] = out[i + 1] - s[i + 1];
  };
  place();
  // right end
  let over = out[n - 1] - hi;
  if (over > 0 && anchor < n - 1) {
    const left = compress(anchor + 1, n - 1, 1, over);
    ax -= left;
    place();
  } else if (over > 0) {
    ax -= over;
    place();
  }
  // left end
  over = lo - out[0];
  if (over > 0 && anchor > 0) {
    const left = compress(anchor - 1, 0, -1, over);
    ax += left;
    place();
  } else if (over > 0) {
    ax += over;
    place();
  }
  for (let i = 0; i < n; i++) out[i] = Math.min(hi, Math.max(lo, out[i]));
  return out;
}
