"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/products";
import { LOGO_PATH, LOGO_VIEWBOX } from "./logoPath";
import styles from "./Header.module.css";

export default function Header() {
  const [about, setAbout] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!about) return;
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.parentElement?.contains(e.target as Node)) setAbout(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAbout(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [about]);

  return (
    <header className={styles.header}>
      <div className={styles.left} data-home-fade>
        <button type="button" className={styles.nav} aria-expanded={about} onClick={() => setAbout((v) => !v)}>
          About
        </button>
        <div ref={panel} className={styles.about} data-open={about || undefined} aria-hidden={!about}>
          <p>
            <strong>{BRAND.name}</strong> — {BRAND.tagline}.
          </p>
          <p>{BRAND.line}</p>
          <p>
            Every piece ships from our Instagram. DM{" "}
            <a href={BRAND.instagram} target="_blank" rel="noopener noreferrer" tabIndex={about ? 0 : -1}>
              {BRAND.handle}
            </a>{" "}
            to order.
          </p>
        </div>
      </div>

      <Link className={styles.logo} href="/" aria-label={`${BRAND.name} — home`}>
        <svg viewBox={LOGO_VIEWBOX} className={styles.wordmark} aria-hidden>
          <path d={LOGO_PATH} fillRule="evenodd" fill="currentColor" />
        </svg>
        <span className={styles.co}>&amp; Co.</span>
      </Link>

      <a className={`${styles.nav} ${styles.right}`} href={BRAND.instagram} target="_blank" rel="noopener noreferrer" data-home-fade>
        Contact
      </a>
    </header>
  );
}
