"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { MOTION } from "@/lib/motion";
import { PRODUCTS } from "@/lib/products";
import { COLLAR_OFFSET, MODEL_SHAPES, type ModelKind } from "@/lib/garment-models";

/* ------------------------------------------------------------------------
 * Viewport → world mapping.
 * World height is fixed at 10 units (1 unit = 10 vh). The camera sits on
 * the z axis looking straight at the z = 0 plane, so vw / vh map linearly.
 * --------------------------------------------------------------------- */

export const WORLD_H = 10;
export const FOV = 24;
export const CAM_Z = WORLD_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

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
  garmentW: number;
  garmentH: number;
  /** Reviewed assets are in metres; this maps them into the showroom. */
  modelScale: number;
  /** drape curvature: z = −k·x² */
  drapeK: number;

  pitch: number;
  wFront: number;
  gap: number;
  bunch: number;
  restX: number[];
  scrollable: boolean;
  scrollMax: number;

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
  const railRadius = lh(0.52);
  const hookTube = railRadius * 0.2;
  const hookR = railRadius + hookTube * 1.25;
  // The inner top of the hook rests on the top of the rail.
  const hookCy = railRadius - hookR + hookTube;
  const hookTop = hookCy + hookR + hookTube;
  // Shared scale preserves each reviewed silhouette's actual proportions.
  const garmentH = lh(bp === "mobile" ? 42 : 44);
  const modelScale = garmentH / 0.9;
  const garmentW = MODEL_SHAPES.hoodie.width * modelScale;
  const frontWidth = garmentW * 0.88;

  const pitch = Math.max(lw(MOTION.restPitchVw), frontWidth * 0.272);
  // Leave enough room for the full sleeve width when a garment faces forward.
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

  const hemY = PRODUCTS.map((p) => {
    const shape = MODEL_SHAPES[p.kind];
    return (shape.bottom - shape.hook - COLLAR_OFFSET) * modelScale;
  });
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
    garmentW,
    garmentH,
    modelScale,
    drapeK: 0.13 / garmentW,
    pitch,
    wFront,
    gap,
    bunch,
    restX,
    scrollable,
    scrollMax,
    hemY,
  };
}

/** Fit the selected silhouette, reserving room for its optional hanger. */
export function detailPlacement(m: RackMetrics, kind: ModelKind) {
  const shape = MODEL_SHAPES[kind];
  const bottom = (shape.bottom - shape.hook - COLLAR_OFFSET) * m.modelScale;
  const scale = Math.min(m.lh(55) / (m.hookTop - bottom), m.worldW * (m.bp === "mobile" ? 0.86 : 0.62) / (shape.width * m.modelScale));
  return { scale, y: m.y(43.5) - (m.hookTop + bottom) / 2 * scale };
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

  const available = hi - lo;
  let excess = s.reduce((total, spacing) => total + spacing, 0) - available;
  // Redistribute unused compression after a gap reaches its limit. One pass can
  // otherwise leave an end outside the rail and collapse hooks when clamped.
  for (let pass = 0; pass < n && excess > 1e-6; pass++) {
    const capacities = s.map((spacing, i) => i === 0 ? 0
      : Math.max(0, spacing - m.bunch) * (1 - Math.min(1, Math.max(facing[i - 1], facing[i]))));
    const weights = capacities.map((capacity, i) => capacity * (1 + Math.abs(i - 0.5 - anchor)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total < 1e-8) break;
    const requested = excess;
    for (let i = 1; i < n; i++) {
      const take = Math.min(capacities[i], requested * weights[i] / total);
      s[i] -= take;
      excess -= take;
    }
  }
  // During a fast sweep several garments can be open at once. Preserve hook
  // order even when that transient combination cannot fit at its full width.
  if (excess > 1e-6) {
    const span = s.reduce((sum, spacing) => sum + spacing, 0);
    for (let i = 1; i < n; i++) s[i] *= available / span;
  }

  let leftSpan = 0;
  let rightSpan = 0;
  for (let i = 1; i <= anchor; i++) leftSpan += s[i];
  for (let i = anchor + 1; i < n; i++) rightSpan += s[i];
  out[anchor] = Math.max(lo + leftSpan, Math.min(hi - rightSpan, m.restX[anchor]));
  for (let i = anchor + 1; i < n; i++) out[i] = out[i - 1] + s[i];
  for (let i = anchor - 1; i >= 0; i--) out[i] = out[i + 1] - s[i + 1];
  return out;
}
