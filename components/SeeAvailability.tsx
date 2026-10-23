"use client";

import Link from "next/link";
import { PRODUCTS } from "@/lib/products";
import { useStore } from "@/lib/store";
import styles from "./SeeAvailability.module.css";

interface Props {
  /** fades with the header/marquee when the product view opens */
  home?: boolean;
  tabIndex?: number;
  productIndex?: number;
}

/** Continue from the rack to the selected design and color. */
export default function SeeAvailability({ home, tabIndex, productIndex }: Props) {
  const hovered = useStore((state) => state.hovered);
  const variants = useStore((state) => state.rackVariants);
  const product = PRODUCTS[productIndex ?? variants[hovered ?? 0] ?? hovered ?? 0];
  const link = (
    <Link className={styles.pill} href={`/products/${product.slug}?color=${product.id}`} tabIndex={tabIndex}>
      See availability
    </Link>
  );
  if (!home) return link;
  return (
    <div className={styles.home} data-home-fade>
      {link}
    </div>
  );
}
