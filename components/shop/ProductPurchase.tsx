"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Product, formatPrice } from "@/lib/products";
import { addToCart } from "@/lib/cart";
import ShopHeader from "./ShopHeader";
import styles from "./Shop.module.css";

const PRODUCT_PHOTOS: Record<string, { front: string; back?: string }> = {
  "01": { front: "/product-photos/1.png", back: "/product-photos/2.png" },
  "02": { front: "/product-photos/3.png" },
  "03": { front: "/product-photos/4.png" },
  "04": { front: "/product-photos/5.png" },
};

export default function ProductPurchase({ initialProduct, variants }: { initialProduct: Product; variants: Product[] }) {
  const [product, setProduct] = useState(initialProduct);
  const [face, setFace] = useState<"front" | "back" | "photo" | "backPhoto">("front");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [sizeError, setSizeError] = useState(false);
  const firstSize = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const photos = PRODUCT_PHOTOS[product.id];
  const showingPhoto = face === "photo" || face === "backPhoto";
  const imageSource = face === "photo" ? photos?.front ?? product.front : face === "backPhoto" ? photos?.back ?? product.back ?? product.front : face === "back" ? product.back ?? product.front : product.front;
  const imageLabel = face === "photo" ? "original product photo" : face === "backPhoto" ? "original back photo" : `${face} view`;

  const selectColor = (variant: Product) => {
    setProduct(variant);
    setFace("front");
    setMessage("");
    const url = new URL(window.location.href);
    if (url.hash.startsWith("#/")) {
      const route = new URL(url.hash.slice(1), "https://kinta.invalid");
      route.searchParams.set("color", variant.id);
      url.hash = route.pathname + route.search;
    } else {
      url.searchParams.set("color", variant.id);
    }
    window.history.replaceState(null, "", url);
  };

  const add = (proceed: boolean) => {
    if (!size) {
      setSizeError(true);
      firstSize.current?.focus();
      return;
    }
    const result = addToCart(product.id, size, quantity);
    const selection = `${product.title}, ${product.colorName}, size ${size}`;
    setMessage(result.added === 0
      ? `Your bag already has the limit of 10 for ${selection}. You can update the quantity in your bag.`
      : `${result.added} × ${selection} added to your bag.${result.added < quantity ? ` The limit is 10 per size and color; your bag now has ${result.quantity}.` : ""}`);
    if (proceed) router.push("/cart");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    add(false);
  };

  return (
    <div className={styles.shopPage}>
      <ShopHeader />
      <main className={styles.productLayout}>
        <section className={styles.gallery} aria-label="Product images">
          <span className={styles.galleryCaption}>Kinta &amp; Co. / The collection</span>
          <Image className={`${styles.productImage} ${showingPhoto ? styles.photoImage : styles.mockupImage}`} src={imageSource} alt={`${product.name}, ${imageLabel}`} width={1000} height={1200} priority />
          <div className={styles.faceToggle} role="group" aria-label="Garment view">
            <button type="button" aria-pressed={face === "front"} onClick={() => setFace("front")}>Front</button>
            <button type="button" aria-pressed={face === "back"} onClick={() => setFace("back")}>Back</button>
            {photos && <button type="button" aria-pressed={face === "photo"} onClick={() => setFace("photo")}>Photo</button>}
            {photos?.back && <button type="button" aria-pressed={face === "backPhoto"} onClick={() => setFace("backPhoto")}>Back photo</button>}
          </div>
        </section>
        <section className={styles.productInfo} aria-labelledby="product-title">
          <p className={styles.eyebrow}>The New African Icon</p>
          <h1 id="product-title">{product.title}</h1>
          <p className={styles.price}>{formatPrice(product)}</p>
          <p className={styles.intro}>{product.description}</p>
          <form onSubmit={onSubmit} noValidate>
            <fieldset className={styles.fieldset}>
              <legend>Color <span>{product.colorName}</span></legend>
              <div className={styles.colors}>
                {variants.map((variant) => (
                  <button key={variant.id} type="button" className={styles.colorButton} aria-label={variant.colorName} aria-pressed={product.id === variant.id} onClick={() => selectColor(variant)}>
                    <span className={styles.colorDot} style={{ backgroundColor: variant.colorHex }} aria-hidden="true" />
                    {variant.colorName}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.fieldset} aria-describedby={sizeError ? "size-error" : "size-note"}>
              <legend>Size <span>{size || "Select a size"}</span></legend>
              <div className={styles.sizes}>
                {product.sizes.map((option, index) => (
                  <label key={option} className={styles.sizeOption}>
                    <input ref={index === 0 ? firstSize : undefined} type="radio" name="size" value={option} checked={size === option} onChange={() => { setSize(option); setSizeError(false); setMessage(""); }} />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
              {sizeError ? <p id="size-error" className={styles.error} role="alert">Choose a size to continue.</p> : <p id="size-note" className={styles.fieldNote}>Size availability is confirmed when you enquire.</p>}
            </fieldset>
            <div className={styles.purchaseRow}>
              <div className={styles.quantityField}>
                <label htmlFor="quantity">Quantity</label>
                <div className={styles.quantity}>
                  <button type="button" aria-label="Decrease quantity" disabled={quantity === 1} onClick={() => setQuantity((value) => value - 1)}>−</button>
                  <input id="quantity" type="number" min="1" max="10" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(10, Math.floor(Number(event.target.value)) || 1)))} />
                  <button type="button" aria-label="Increase quantity" disabled={quantity === 10} onClick={() => setQuantity((value) => value + 1)}>+</button>
                </div>
              </div>
              <button className={styles.primaryButton} type="submit">Add to bag <span aria-hidden="true">→</span></button>
            </div>
            <button className={styles.secondaryButton} type="button" onClick={() => add(true)}>Request this order</button>
            <p className={styles.orderNote}>Orders are arranged with Kinta on Instagram. Confirm price, availability, and delivery before payment.</p>
            <p className={styles.status} role="status">{message}{message && <> <Link href="/cart">View bag →</Link></>}</p>
          </form>
          <details className={styles.details} open>
            <summary>About this piece</summary>
            <p>{product.description}</p>
            <p>Embrace your heritage, elevate your steeze. Browse both sides above and choose your preferred color and size.</p>
          </details>
          <details className={styles.details}>
            <summary>Delivery &amp; sizing</summary>
            <p>Ask Kinta for measurements, current stock, delivery options, and the final order total through Instagram before placing your order.</p>
          </details>
        </section>
      </main>
      <footer className={styles.footer}><span>Kinta &amp; Co.</span><span>Embrace your heritage. Elevate your steeze.</span></footer>
    </div>
  );
}
