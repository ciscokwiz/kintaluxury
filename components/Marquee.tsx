"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { MOTION } from "@/lib/motion";
import styles from "./Marquee.module.css";

const ITEMS = ["The New African Icon", "Embrace your heritage, elevate your steeze", "Shop via Instagram @kinta.and.co"];

/** Seamless right-to-left scroll at a constant 38 px/s, whatever the viewport width. */
export default function Marquee() {
  const half = useRef<HTMLDivElement>(null);
  const [repeat, setRepeat] = useState(2);
  const [duration, setDuration] = useState(60);

  useLayoutEffect(() => {
    const measure = () => {
      const el = half.current;
      if (!el) return;
      const unit = el.scrollWidth / repeat;
      const need = Math.max(1, Math.ceil(window.innerWidth / Math.max(1, unit)) + 1);
      if (need !== repeat) {
        setRepeat(need);
        return;
      }
      setDuration(el.scrollWidth / MOTION.marqueePxPerSec);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [repeat]);

  const segment = Array.from({ length: repeat }, (_, r) =>
    ITEMS.map((t, i) => (
      <span key={`${r}-${i}`} className={styles.item}>
        {t}
        <i className={styles.dot} aria-hidden />
      </span>
    )),
  );

  return (
    <div className={styles.strip} data-home-fade>
      <div className={styles.track} style={{ animationDuration: `${duration}s` }}>
        <div ref={half} className={styles.half}>
          {segment}
        </div>
        <div className={styles.half} aria-hidden>
          {segment}
        </div>
      </div>
    </div>
  );
}
