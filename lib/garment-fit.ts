import type { GarmentKind } from "./products";

/** Relative cuts, not size measurements: tees boxy, knits wider, sleeves longer. */
export const GARMENT_FITS: Record<GarmentKind, { width: number; length: number; thickness: number; body: number; weight: number }> = {
  tee: { width: 1.05, length: 0.90, thickness: 0.016, body: 0.23, weight: 0.8 },
  longsleeve: { width: 0.98, length: 1.07, thickness: 0.018, body: 0.12, weight: 0.9 },
  crewneck: { width: 1.12, length: 0.97, thickness: 0.027, body: 0.17, weight: 1.15 },
  hoodie: { width: 1.09, length: 1.04, thickness: 0.034, body: 0.13, weight: 1.3 },
};
