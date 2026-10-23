"use client";

import Link from "next/link";
import { BRAND } from "@/lib/products";
import { useCart } from "@/lib/cart";
import { LOGO_PATH, LOGO_VIEWBOX } from "../logoPath";
import styles from "./Shop.module.css";

export default function ShopHeader() {
  const { count } = useCart();
  return (
    <header className={styles.header}>
      <Link className={styles.backLink} href="/">← Back to the rack</Link>
      <Link href="/" className={styles.logo} aria-label={`${BRAND.name} — home`}>
        <svg viewBox={LOGO_VIEWBOX} aria-hidden="true"><path d={LOGO_PATH} fillRule="evenodd" fill="currentColor" /></svg>
        <span>&amp; Co.</span>
      </Link>
      <Link className={styles.bagLink} href="/cart" aria-label={`Shopping bag, ${count} ${count === 1 ? "item" : "items"}`}>
        Bag <span>{count}</span>
      </Link>
    </header>
  );
}
