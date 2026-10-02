import { MOTION, DEG_TO_RAD } from "./motion";
import manifest from "./garmentManifest.json";

export type GarmentKind = "tee" | "longsleeve" | "crewneck" | "hoodie";

export interface Product {
  id: string;
  index: number;
  name: string;
  kind: GarmentKind;
  front: string;
  back?: string;
  /** body-volume map (0 at the silhouette, 1 inside) that gives the panels depth */
  vol: string;
  /** hem position as a fraction of the texture height (from the texture build) */
  hemFrac: number;
  /** texture width / height */
  aspect: number;
  /** resting yaw (rad), deterministic jitter baked in */
  restYaw: number;
  /** resting roll (rad) */
  restRoll: number;
}

export const BRAND = {
  name: "Kinta & Co.",
  tagline: "The New African Icon",
  line: "Embrace your heritage, elevate your steeze.",
  instagram: "https://www.instagram.com/kinta.and.co/",
  handle: "@kinta.and.co",
} as const;

/** Texture height in px (scripts/make_photoreal.py writes 1000 × 1200). */
const TEX_H = 1200;

/** Hem of a tee, used to size the product view (fraction of the texture height). */
export const TEE_HEM_FRAC = manifest["01"].hem / TEX_H;

const RAW: { name: string; kind: GarmentKind }[] = [
  { name: "The Liberty Tee — Bone", kind: "tee" },
  { name: "The New African Icon Tee — Black", kind: "tee" },
  { name: "Restricted Eagle Tee — Azure", kind: "tee" },
  { name: "Kinta. Hoodie — Sky", kind: "hoodie" },
  { name: "KINTA™ Logo Tee — Forest", kind: "tee" },
  { name: "Restricted Eagle Tee — Onyx", kind: "tee" },
  { name: "KINTA™ Logo Tee — Sand", kind: "tee" },
  { name: "Kinta. Hoodie — Peach", kind: "hoodie" },
  { name: "Kinta. Hoodie — Navy", kind: "hoodie" },
  { name: "KINTA™ Logo Tee — Slate", kind: "tee" },
];

/** small deterministic PRNG so the rack always hangs the same way */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20240611);

/** "/" for the Next app; "" (relative) for the standalone test build */
const ASSET_BASE = process.env.NEXT_PUBLIC_ASSET_BASE ?? "/";

export const PRODUCTS: Product[] = RAW.map((p, index) => {
  const id = String(index + 1).padStart(2, "0");
  const open = MOTION.openRestIndices.includes(index);
  const yawDeg = open
    ? MOTION.openRestYawDeg + (rand() - 0.5) * 2
    : MOTION.restYawDeg + (rand() * 2 - 1) * MOTION.restYawJitterDeg;
  const rollDeg = (rand() * 2 - 1) * MOTION.restRollJitterDeg;
  return {
    id,
    index,
    name: p.name,
    kind: p.kind,
    front: `${ASSET_BASE}garments/${id}-front.webp`,
    // every garment has a back; #01 carries the "Liberty or Death" print
    back: `${ASSET_BASE}garments/${id}-back.webp`,
    vol: `${ASSET_BASE}garments/${id}-vol.png`,
    hemFrac: manifest[id as keyof typeof manifest].hem / TEX_H,
    aspect: 1000 / 1200,
    restYaw: yawDeg * DEG_TO_RAD,
    restRoll: rollDeg * DEG_TO_RAD,
  };
});

export const COUNT = PRODUCTS.length;
