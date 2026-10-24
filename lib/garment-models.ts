import type { Mesh } from "three";
import { FABRIC, FABRIC_DEFAULTS } from "./motion";

export type ModelKind = "tee" | "hoodie";
export type ModelDetail = "rack" | "detail";
export type GarmentVariant = "liberty" | "new-african-icon" | "azure-eagle" | "onyx-eagle" | "forest-logo" | "sand-logo" | "slate-logo" | "sky-hoodie" | "peach-hoodie" | "navy-hoodie";

/** Metres in the reviewed GLBs, relative to the collar support pivot. */
export const MODEL_SHAPES = {
  tee: { width: 0.696, top: 0.001, bottom: -0.726, hook: 0.055 },
  hoodie: { width: 0.834, top: 0.151, bottom: -0.691, hook: 0.19 },
} as const;
export const COLLAR_OFFSET = 0.0075;
const BASE = `${process.env.NEXT_PUBLIC_ASSET_BASE ?? "/"}models/kinta`;

export function modelUrl(kind: ModelKind, detail: ModelDetail) {
  return `${BASE}/${kind}-${detail}.glb`;
}

export function modelTextureUrls(variant: GarmentVariant, detail: ModelDetail) {
  return ["map", "plain"].map((part) => `${BASE}/textures/${variant}-${part}-${detail}.webp`);
}

export const MORPH_NAMES = ["SlideLeftLag", "SlideRightLag", "TurnClockwise", "TurnCounterclockwise"] as const;
export type ClothMotion = Record<(typeof MORPH_NAMES)[number], number>;
export function createClothMotion(): ClothMotion {
  return { SlideLeftLag: 0, SlideRightLag: 0, TurnClockwise: 0, TurnCounterclockwise: 0 };
}

/** Movement drives the cloth; a stopped hanger always returns to stillness. */
export function stepClothMotion(state: ClothMotion, yawVelocity: number, slideVelocity: number, modelScale: number, dt: number, reduced: boolean) {
  const turn = !reduced && FABRIC.enabled ? yawVelocity / 5 * (FABRIC.wave / FABRIC_DEFAULTS.wave) : 0;
  const slide = !reduced && FABRIC.enabled ? slideVelocity / (0.65 * modelScale) * (FABRIC.sway / FABRIC_DEFAULTS.sway) : 0;
  const targets = [slide, -slide, turn, -turn];
  let moving = false;
  MORPH_NAMES.forEach((name, index) => {
    const target = Math.max(0, Math.min(1, targets[index]));
    const value = reduced ? 0 : target + (state[name] - target) * Math.exp(-7 * dt);
    state[name] = value < 0.0001 ? 0 : value;
    if (state[name] !== 0) moving = true;
  });
  return moving;
}

export function applyClothMotion(meshes: Mesh[], state: ClothMotion) {
  for (const mesh of meshes) {
    for (const name of MORPH_NAMES) {
      const index = mesh.morphTargetDictionary?.[name];
      if (index !== undefined && mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = state[name];
    }
  }
}
