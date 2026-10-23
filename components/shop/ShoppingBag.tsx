"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BRAND, PRODUCTS, formatPrice } from "@/lib/products";
import { useCart, removeFromCart, updateCartQuantity } from "@/lib/cart";
import ShopHeader from "./ShopHeader";
import styles from "./Shop.module.css";

export default function ShoppingBag() {
  const { lines, count, hydrated } = useCart();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [copiedOrderText, setCopiedOrderText] = useState<string | null>(null);
  const entries = lines.flatMap((line) => {
    const product = PRODUCTS.find((item) => item.id === line.productId);
    return product ? [{ ...line, product }] : [];
  });
  const orderText = useMemo(() => `Hi Kinta & Co., I would like to enquire about:\n\n${lines.map((line) => {
    const product = PRODUCTS.find((item) => item.id === line.productId);
    return product ? `${line.quantity} × ${product.title} — ${product.colorName}, size ${line.size}` : "";
  }).filter(Boolean).join("\n")}\n\nPlease confirm prices, availability, sizing, and delivery.`, [lines]);
  const copied = copyState === "copied" && copiedOrderText === orderText;
  const allPriced = entries.length > 0 && entries.every((entry) => entry.product.price !== null);
  const total = allPriced ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(entries.reduce((sum, entry) => sum + (entry.product.price ?? 0) * entry.quantity, 0)) : "To be confirmed";

  const copyOrder = async () => {
    try {
      await navigator.clipboard.writeText(orderText);
      setCopiedOrderText(orderText);
      setCopyState("copied");
    } catch {
      setCopyState("manual");
    }
  };

  return (
    <div className={styles.shopPage}>
      <ShopHeader />
      <main className={styles.bagMain}>
        <div className={styles.bagHeading}><div><p className={styles.eyebrow}>Your selection</p><h1>Your bag <span>({count})</span></h1></div><Link href="/">Continue exploring →</Link></div>
        {!hydrated ? <p role="status" className={styles.emptyState}>Loading your bag…</p> : entries.length === 0 ? (
          <div className={styles.emptyState}><span className={styles.emptyIcon} aria-hidden="true">↗</span><h2>Your next icon is on the rack.</h2><p>Choose a piece, find your color, and make it yours.</p><Link className={styles.primaryButton} href="/">Explore the collection →</Link></div>
        ) : (
          <div className={styles.bagLayout}>
            <section className={styles.bagItems} aria-label="Items in your bag">
              {entries.map(({ product, size, quantity }) => (
                <article key={`${product.id}-${size}`} className={styles.bagItem}>
                  <Link className={styles.bagImage} href={`/products/${product.slug}?color=${product.id}`} aria-label={`View ${product.name}`}><Image src={product.front} alt={product.name} width={200} height={240} /></Link>
                  <div className={styles.bagItemInfo}>
                    <Link href={`/products/${product.slug}?color=${product.id}`}><h2>{product.title}</h2></Link>
                    <p>{product.colorName} <span aria-hidden="true">/</span> Size {size}</p>
                    <p className={styles.itemPrice}>{formatPrice(product)}</p>
                    <div className={styles.itemActions}>
                      <label>Quantity <select aria-label={`Quantity for ${product.title}, ${product.colorName}, size ${size}`} value={quantity} onChange={(event) => { updateCartQuantity(product.id, size, Number(event.target.value)); setCopyState("idle"); }}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
                      <button type="button" onClick={() => { removeFromCart(product.id, size); setCopyState("idle"); }} aria-label={`Remove ${product.title}, ${product.colorName}, size ${size}`}>Remove</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
            <aside className={styles.orderSummary} aria-labelledby="summary-title">
              <p className={styles.eyebrow}>One step closer</p><h2 id="summary-title">Make it yours.</h2>
              <div className={styles.summaryLine}><span>Pieces</span><strong>{count}</strong></div>
              <div className={styles.summaryLine}><span>{allPriced ? "Subtotal" : "Price"}</span><strong>{total}</strong></div>
              <div className={styles.summaryLine}><span>Delivery</span><span>Confirmed by Kinta</span></div>
              <p className={styles.summaryInstructions}>Copy your selection, then send it to <strong>{BRAND.handle}</strong> on Instagram. Kinta will confirm the total and availability with you.</p>
              <button className={styles.primaryButton} type="button" onClick={copyOrder}>{copied ? "Selection copied ✓" : "1. Copy order enquiry"}</button>
              <a className={styles.secondaryButton} href={BRAND.instagram} target="_blank" rel="noopener noreferrer">2. Open Instagram →</a>
              <p className={styles.orderNote}>Your bag is a saved selection. An order is only confirmed directly with Kinta; no payment is taken here.</p>
              <p className={styles.status} role="status">{copied ? "Copied. Open Instagram and paste your selection into a message to Kinta." : copyState === "manual" ? "Select and copy the enquiry below, then send it to Kinta on Instagram." : ""}</p>
              <details className={styles.enquiry} open={copyState === "manual" || undefined}>
                <summary>View order enquiry</summary><textarea aria-label="Order enquiry" readOnly value={orderText} rows={8} onFocus={(event) => event.target.select()} />
              </details>
            </aside>
          </div>
        )}
      </main>
      <footer className={styles.footer}><span>Kinta &amp; Co.</span><span>The New African Icon</span></footer>
    </div>
  );
}
