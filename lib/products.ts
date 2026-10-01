import { MOTION, DEG_TO_RAD } from "./motion";

export type GarmentKind = "tee" | "longsleeve" | "crewneck" | "hoodie";

export interface Product {
  id: string;
  index: number;
  name: string;
  kind: GarmentKind;
  front: string;
  back?: string;
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

/** Where the hem sits inside each 1000×1200 texture (fraction of height). */
export const HEM_FRAC: Record<GarmentKind, number> = {
  tee: 1080 / 1200,
  longsleeve: 1112 / 1200,
  crewneck: 1166 / 1200,
  hoodie: 1166 / 1200,
};

const RAW: { name: string; kind: GarmentKind }[] = [
  { name: "The Liberty Tee — Bone", kind: "tee" },
  { name: "The New African Icon Tee — Black", kind: "tee" },
  { name: "Restricted Eagle Tee — Azure", kind: "tee" },
  { name: "Kinta. Track Hoodie — Sky", kind: "hoodie" },
  { name: "KINTA™ Logo Crewneck — Forest", kind: "crewneck" },
  { name: "New African Icon Long Sleeve — Black", kind: "longsleeve" },
  { name: "KINTA™ Logo Tee — Sand", kind: "tee" },
  { name: "Restricted Eagle Tee — Onyx", kind: "tee" },
  { name: "Kinta. Track Hoodie — Navy", kind: "hoodie" },
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
    front: `/garments/${id}-front.webp`,
    // every garment has a plain back; #01 carries the "Liberty or Death" back print
    back: `/garments/${id}-back.webp`,
    aspect: 1000 / 1200,
    restYaw: yawDeg * DEG_TO_RAD,
    restRoll: rollDeg * DEG_TO_RAD,
  };
});

export const COUNT = PRODUCTS.length;
