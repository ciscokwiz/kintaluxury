import { MOTION, DEG_TO_RAD } from "./motion";
import type { GarmentVariant, ModelKind } from "./garment-models";

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
  kind: ModelKind;
  modelVariant: GarmentVariant;
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
    title: "KINTA™ Logo Hoodie",
    description: "A softly structured hoodie with a small KINTA™ chest wordmark, drawstrings and a kangaroo pocket. Choose Sky, Peach or Navy.",
  },
  "logo-tee": {
    title: "KINTA™ Logo Tee",
    description: "The KINTA™ wordmark on a clean short-sleeve tee. Choose Forest, Sand or Slate.",
  },
} satisfies Record<string, ProductDesign>;

type RawProduct = { id: string; name: string; kind: ModelKind; modelVariant: GarmentVariant; groupId: keyof typeof DESIGNS; colorName: string; colorHex: string };

const RAW: RawProduct[] = [
  { id: "01", name: "The Liberty Tee — Bone", kind: "tee", modelVariant: "liberty", groupId: "liberty-tee", colorName: "Bone", colorHex: "#f0efeb" },
  { id: "02", name: "The New African Icon Tee — Black", kind: "tee", modelVariant: "new-african-icon", groupId: "new-african-icon-tee", colorName: "Black", colorHex: "#151617" },
  { id: "03", name: "Restricted Eagle Tee — Azure", kind: "tee", modelVariant: "azure-eagle", groupId: "restricted-eagle-tee", colorName: "Azure", colorHex: "#00a2dc" },
  { id: "04", name: "KINTA™ Logo Hoodie — Sky", kind: "hoodie", modelVariant: "sky-hoodie", groupId: "track-hoodie", colorName: "Sky", colorHex: "#a9c7da" },
  { id: "05", name: "KINTA™ Logo Tee — Forest", kind: "tee", modelVariant: "forest-logo", groupId: "logo-tee", colorName: "Forest", colorHex: "#123424" },
  { id: "08", name: "Restricted Eagle Tee — Onyx", kind: "tee", modelVariant: "onyx-eagle", groupId: "restricted-eagle-tee", colorName: "Onyx", colorHex: "#161719" },
  { id: "07", name: "KINTA™ Logo Tee — Sand", kind: "tee", modelVariant: "sand-logo", groupId: "logo-tee", colorName: "Sand", colorHex: "#ded1a9" },
  { id: "11", name: "KINTA™ Logo Hoodie — Peach", kind: "hoodie", modelVariant: "peach-hoodie", groupId: "track-hoodie", colorName: "Peach", colorHex: "#d0a182" },
  { id: "09", name: "KINTA™ Logo Hoodie — Navy", kind: "hoodie", modelVariant: "navy-hoodie", groupId: "track-hoodie", colorName: "Navy", colorHex: "#222e53" },
  { id: "10", name: "KINTA™ Logo Tee — Slate", kind: "tee", modelVariant: "slate-logo", groupId: "logo-tee", colorName: "Slate", colorHex: "#525e6a" },
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
  // IDs survive rack reordering so saved bags and color links keep their identity.
  const id = p.id;
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
    modelVariant: p.modelVariant,
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
  const legacy: Record<string, string> = { "logo-crewneck": "logo-tee", "new-african-icon-long-sleeve": "new-african-icon-tee" };
  return PRODUCTS.find((product) => product.slug === (legacy[slug] ?? slug));
}

export function getProductVariants(productOrGroupId: Product | string): Product[] {
  const groupId = typeof productOrGroupId === "string" ? productOrGroupId : productOrGroupId.groupId;
  return PRODUCTS.filter((product) => product.groupId === groupId);
}

export function formatPrice(product: Pick<Product, "price" | "currency">): string {
  if (product.price === null) return "Price on request";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: product.currency, maximumFractionDigits: 0 }).format(product.price);
}
