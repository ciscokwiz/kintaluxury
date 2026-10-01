"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { PRODUCTS } from "@/lib/products";
import { MOTION } from "@/lib/motion";
import { sim, useStore } from "@/lib/store";
import styles from "./HoverLabel.module.css";

/** Tiny product name under the hovered garment's hem (positioned by the rack loop). */
export default function HoverLabel() {
  const hovered = useStore((s) => s.hovered);
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null>(null);
  // last garment hovered: keeps the text while the label fades out
  const [last, setLast] = useState<number | null>(null);
  if (hovered !== null && hovered !== last) setLast(hovered);

  useEffect(() => {
    sim.labelEl = outer.current;
    return () => {
      sim.labelEl = null;
    };
  }, []);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const was = prev.current;
    prev.current = hovered;
    const { enterMs, exitMs, enterY } = MOTION.label;
    if (hovered !== null) {
      // text swaps instantly; when moving between garments the label just glides
      if (was === null) {
        gsap.killTweensOf(el);
        gsap.fromTo(el, { opacity: 0, y: enterY }, { opacity: 1, y: 0, duration: enterMs / 1000, ease: "power2.out" });
      }
    } else if (was !== null) {
      gsap.killTweensOf(el);
      gsap.to(el, { opacity: 0, duration: exitMs / 1000, ease: "power1.out" });
    }
  }, [hovered]);

  return (
    <div ref={outer} className={styles.label} aria-hidden>
      <span ref={inner}>{last !== null ? PRODUCTS[last].name : ""}</span>
    </div>
  );
}
