import { MOTION, DEG_TO_RAD } from "./motion";
import GARMENT_SHAPES from "./garment-shapes.json";

export type GarmentKind = "tee" | "longsleeve" | "crewneck" | "hoodie";
export const PRODUCT_SIZES = ["S", "M", "L", "XL"] as const;
export type ProductSize = (typeof PRODUCT_SIZES)[number];

export interface Product {
  id: string;
  index: number;
  name: string;
  /** Shared identity and URL for a design's color variants. */
  groupId: string;
  slug: string;
  title: string;
  colorName: string;
  colorHex: string;
  description: string;
  /** Fit choices only. Availability is confirmed by Kinta before an order. */
  sizes: readonly ProductSize[];
  /** Null until a real selling price is supplied by the store. */
  price: number | null;
  currency: "NGN";
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
  tee: Math.max(...GARMENT_SHAPES.tee.map((p) => p[1])) / 1200,
  longsleeve: Math.max(...GARMENT_SHAPES.longsleeve.map((p) => p[1])) / 1200,
  crewneck: Math.max(...GARMENT_SHAPES.crewneck.map((p) => p[1])) / 1200,
  hoodie: Math.max(...GARMENT_SHAPES.hoodie.map((p) => p[1])) / 1200,
};

type ProductDesign = { title: string; description: string };

const DESIGNS = {
  "liberty-tee": {
    title: "The Liberty Tee",
    description: "The KINTA™ wordmark on the front. The Liberty or Death artwork on the back. A statement from every angle.",
  },
  "new-african-icon-tee": {
    title: "The New African Icon Tee",
    description: "The New African Icon graphic, placed front and centre. A Kinta statement in black.",
  },
  "restricted-eagle-tee": {
    title: "Restricted Eagle Tee",
    description: "The Restricted eagle, diamond and Africa artwork. Choose Azure or Onyx to make it your own.",
  },
  "track-hoodie": {
    title: "Kinta. Track Hoodie",
    description: "Kinta's hooded silhouette with contrast sleeve stripes and a chest wordmark. Available to enquire about in Sky and Navy.",
  },
  "logo-crewneck": {
    title: "KINTA™ Logo Crewneck",
    description: "A forest-green crewneck with the KINTA™ wordmark. The signature, kept simple.",
  },
  "new-african-icon-long-sleeve": {
    title: "New African Icon Long Sleeve",
    description: "The New African Icon artwork on a long-sleeve silhouette. The same statement, with a different shape.",
  },
  "logo-tee": {
    title: "KINTA™ Logo Tee",
    description: "The KINTA™ wordmark on a clean tee silhouette. Choose between Sand and Slate.",
  },
} satisfies Record<string, ProductDesign>;

type RawProduct = { name: string; kind: GarmentKind; groupId: keyof typeof DESIGNS; colorName: string; colorHex: string };

const RAW: RawProduct[] = [
  { name: "The Liberty Tee — Bone", kind: "tee", groupId: "liberty-tee", colorName: "Bone", colorHex: "#e5e2d8" },
  { name: "The New African Icon Tee — Black", kind: "tee", groupId: "new-african-icon-tee", colorName: "Black", colorHex: "#191919" },
  { name: "Restricted Eagle Tee — Azure", kind: "tee", groupId: "restricted-eagle-tee", colorName: "Azure", colorHex: "#1eaddb" },
  { name: "Kinta. Track Hoodie — Sky", kind: "hoodie", groupId: "track-hoodie", colorName: "Sky", colorHex: "#9fbcd0" },
  { name: "KINTA™ Logo Crewneck — Forest", kind: "crewneck", groupId: "logo-crewneck", colorName: "Forest", colorHex: "#203c2d" },
  { name: "New African Icon Long Sleeve — Black", kind: "longsleeve", groupId: "new-african-icon-long-sleeve", colorName: "Black", colorHex: "#191919" },
  { name: "KINTA™ Logo Tee — Sand", kind: "tee", groupId: "logo-tee", colorName: "Sand", colorHex: "#cfc3a7" },
  { name: "Restricted Eagle Tee — Onyx", kind: "tee", groupId: "restricted-eagle-tee", colorName: "Onyx", colorHex: "#171719" },
  { name: "Kinta. Track Hoodie — Navy", kind: "hoodie", groupId: "track-hoodie", colorName: "Navy", colorHex: "#202944" },
  { name: "KINTA™ Logo Tee — Slate", kind: "tee", groupId: "logo-tee", colorName: "Slate", colorHex: "#626e7b" },
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
    groupId: p.groupId,
    slug: p.groupId,
    title: DESIGNS[p.groupId].title,
    colorName: p.colorName,
    colorHex: p.colorHex,
    description: DESIGNS[p.groupId].description,
    sizes: PRODUCT_SIZES,
    price: null,
    currency: "NGN",
    kind: p.kind,
    front: `${ASSET_BASE}garments/${id}-front.webp`,
    // every garment has a plain back; #01 carries the "Liberty or Death" back print
    back: `${ASSET_BASE}garments/${id}-back.webp`,
    aspect: 1000 / 1200,
    restYaw: yawDeg * DEG_TO_RAD,
    restRoll: rollDeg * DEG_TO_RAD,
  };
});

export const COUNT = PRODUCTS.length;

/** The initial color for a product route. A variant can then be chosen by ID. */
export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getProductVariants(productOrGroupId: Product | string): Product[] {
  const groupId = typeof productOrGroupId === "string" ? productOrGroupId : productOrGroupId.groupId;
  return PRODUCTS.filter((product) => product.groupId === groupId);
}

export function formatPrice(product: Pick<Product, "price" | "currency">): string {
  if (product.price === null) return "Price on request";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: product.currency, maximumFractionDigits: 0 }).format(product.price);
}
