"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { MOTION } from "@/lib/motion";
import { PRODUCTS, HEM_FRAC, RACK_PRODUCTS, RACK_INDICES, rackIndexOf } from "@/lib/products";
import { GARMENT_FITS } from "@/lib/garment-fit";

/* ------------------------------------------------------------------------
 * Viewport → world mapping.
 * World height is fixed at 10 units (1 unit = 10 vh). The camera sits on
 * the z axis looking straight at the z = 0 plane, so vw / vh map linearly.
 * --------------------------------------------------------------------- */

export const WORLD_H = 10;
export const FOV = 24;
export const CAM_Z = WORLD_H / 2 / Math.tan(((FOV / 2) * Math.PI) / 180);

/** texture layout (px in the 1000 × 1200 garment textures) */
export const TEX = { w: 1000, h: 1200, hangerTop: 62, hangerTipX: 285, hangerTipTop: 148, hangerThick: 24 };

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
  /** Actual dimensions for each design, shared by rack, detail and hit-testing. */
  shapes: { garmentW: number; garmentH: number; garmentCy: number; texel: number; layer: number; drapeK: number }[];
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
  const railRadius = lh(0.17);
  const hookTube = lh(0.065);
  const hookR = lh(0.64);
  const hookCy = hookR - railRadius - hookTube;
  const hookTop = hookCy + hookR + hookTube;
  const hangerTop = -lh(2.9);

  // A wider, shorter silhouette gives the mockups a natural boxy fit.
  const garmentH = lh(bp === "mobile" ? 32 : 34);
  const texel = garmentH / TEX.h;
  const garmentW = TEX.w * texel * 1.26;
  const garmentCy = hangerTop - lh(1.5) + TEX.hangerTop * texel - garmentH / 2;
  const shapes = PRODUCTS.map((product) => {
    const fit = GARMENT_FITS[product.kind];
    const h = garmentH * fit.length;
    const w = garmentW * fit.width;
    return { garmentW: w, garmentH: h, garmentCy: hangerTop - lh(1.5) + TEX.hangerTop * h / TEX.h - h / 2, texel: h / TEX.h, layer: w * fit.thickness, drapeK: 0.14 / w };
  });
  const frontWidth = garmentW * 0.88;

  const pitch = Math.max(lw(MOTION.restPitchVw), frontWidth * 0.272);
  // the brief's w_front (15 vw) assumes narrower garments; never part less than the garment is wide
  const wFront = Math.max(lw(MOTION.wFrontVw[bp]), frontWidth * 1.12);
  const gap = lw(MOTION.minGapVw);
  const bunch = Math.max(lw(MOTION.bunchPitchVw), pitch * 0.34);

  let railLeft = bp === "desktop" ? x(12.3) : x(6);
  let railRight = bp === "desktop" ? x(86.5) : x(94);
  const n = RACK_PRODUCTS.length;
  const slotOffsets = [0];
  for (let i = 1; i < n; i++) {
    const a = GARMENT_FITS[RACK_PRODUCTS[i - 1].kind].width;
    const b = GARMENT_FITS[RACK_PRODUCTS[i].kind].width;
    slotOffsets.push(slotOffsets[i - 1] + pitch * (0.72 + 0.14 * (a + b)));
  }
  const rowSpan = slotOffsets[n - 1];
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
  const restX = PRODUCTS.map((product) => centre - rowSpan / 2 + slotOffsets[RACK_INDICES.indexOf(rackIndexOf(product.index))]);

  const hemY = PRODUCTS.map((p, i) => shapes[i].garmentCy + shapes[i].garmentH / 2 - HEM_FRAC[p.kind] * shapes[i].garmentH);
  const teeHem = garmentCy + garmentH / 2 - HEM_FRAC.tee * garmentH;
  const detailScale = Math.min(
    lh(71 - 16) / (hookTop - teeHem),
    (worldW * (bp === "mobile" ? 0.86 : 0.62)) / garmentW,
  );
  // Keep the whole silhouette inside portrait screens, centered above controls.
  const detailPivotY = y((16 + 71) / 2) - ((hookTop + teeHem) / 2) * detailScale;

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
    shapes,
  };
}

/** Metrics for the canvas this hook is called in (recomputed on resize). */
export function useRackMetrics(): RackMetrics {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  return useMemo(() => computeMetrics(width, height), [width, height]);
}

export function garmentMetrics(m: RackMetrics, index: number): RackMetrics {
  return { ...m, ...m.shapes[index] };
}

export function detailMetrics(m: RackMetrics, index: number) {
  const shape = m.shapes[index];
  const hem = m.hemY[index];
  const scale = Math.min(m.lh(55) / (m.hookTop - hem), m.worldW * (m.bp === "mobile" ? 0.80 : 0.54) / shape.garmentW);
  return { scale, y: m.y(43.5) - (m.hookTop + hem) * scale / 2 };
}

/* ------------------------------------------------------------------------
 * Rack layout: target hook-x for every garment from the CURRENT facing of
 * every garment. Neighbours pack outward from the anchor; near the rail
 * ends they bunch instead of passing the brackets.
 * --------------------------------------------------------------------- */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function layoutSlots(m: RackMetrics, facing: number[], anchor: number | null, out: number[]): number[] {
  const n = facing.length;
  if (anchor === null) {
    for (let i = 0; i < n; i++) out[i] = m.restX[i];
    return out;
  }
  const widths = facing.map((f, i) => lerp(m.pitch * GARMENT_FITS[RACK_PRODUCTS[i].kind].width, Math.max(m.wFront, m.shapes[RACK_INDICES[i]].garmentW * 0.96), f));
  const spacing = new Array<number>(n).fill(0);
  const capacity = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    spacing[i] = (widths[i - 1] + widths[i]) / 2 + m.gap * Math.max(facing[i - 1], facing[i]);
    // Keep room immediately around a front-facing garment; bunch the outer hangers.
    capacity[i] = Math.max(0, spacing[i] - m.bunch) * (1 - Math.max(facing[i - 1], facing[i]));
  }
  const margin = m.railRadius * 2 + m.lw(0.6);
  const lo = m.railLeft + margin, hi = m.railRight - margin;
  const span = spacing.reduce((sum, gap) => sum + gap, 0);
  const excess = Math.max(0, span - (hi - lo));
  const available = capacity.reduce((sum, amount) => sum + amount, 0);
  if (excess > 0 && available > 0) {
    const compression = Math.min(1, excess / available);
    for (let i = 1; i < n; i++) spacing[i] -= capacity[i] * compression;
  }
  const remainingSpan = spacing.reduce((sum, gap) => sum + gap, 0);
  if (remainingSpan > hi - lo) {
    // Extremely narrow hosts still preserve hanger order rather than clamping
    // multiple items onto the same bracket.
    const fit = (hi - lo) / remainingSpan;
    for (let i = 1; i < n; i++) spacing[i] *= fit;
  }
  const leftSpan = spacing.slice(1, anchor + 1).reduce((sum, gap) => sum + gap, 0);
  const rightSpan = spacing.slice(anchor + 1).reduce((sum, gap) => sum + gap, 0);
  out[anchor] = Math.max(lo + leftSpan, Math.min(hi - rightSpan, m.restX[anchor]));
  for (let i = anchor + 1; i < n; i++) out[i] = out[i - 1] + spacing[i];
  for (let i = anchor - 1; i >= 0; i--) out[i] = out[i + 1] - spacing[i + 1];
  return out;
}

export function layoutRack(m: RackMetrics, facing: number[], anchor: number | null, out: number[]): number[] {
  const local = layoutSlots(
    { ...m, restX: RACK_INDICES.map((index) => m.restX[index]) },
    RACK_INDICES.map((index) => facing[index]),
    anchor === null ? null : RACK_INDICES.indexOf(rackIndexOf(anchor)),
    new Array(RACK_INDICES.length).fill(0),
  );
  PRODUCTS.forEach((product) => { out[product.index] = local[RACK_INDICES.indexOf(rackIndexOf(product.index))]; });
  return out;
}
