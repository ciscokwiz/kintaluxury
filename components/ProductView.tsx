"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { PRODUCTS, COUNT } from "@/lib/products";
import { MOTION } from "@/lib/motion";
import { detail, sim, useStore } from "@/lib/store";
import { computeMetrics } from "./three/useRackLayout";
import { facingOf, renderYaw } from "./three/physics";
import DetailStage from "./three/DetailStage";
import SeeAvailability from "./SeeAvailability";
import styles from "./ProductView.module.css";

const pad = (n: number) => String(n).padStart(2, "0");
const s = (ms: number) => ms / 1000;
/** focus rings only show for keyboard users (see html[data-input] in globals.css) */
const focusEl = (el: HTMLElement | null | undefined) => el?.focus({ preventScroll: true });

export default function ProductView() {
  const mode = useStore((st) => st.mode);
  const active = useStore((st) => st.active);
  const navTick = useStore((st) => st.navTick);
  const close = useStore((st) => st.close);
  const go = useStore((st) => st.go);
  const setMode = useStore((st) => st.setMode);

  const veilRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const fade = useRef<gsap.core.Tween | null>(null);

  const open = mode === "opening" || mode === "detail";

  // open / close timelines
  useEffect(() => {
    const veil = veilRef.current;
    const ui = uiRef.current;
    if (!veil || !ui) return;
    const items = ui.querySelectorAll<HTMLElement>("[data-pv-item]");
    const home = document.querySelectorAll<HTMLElement>("[data-home-fade]");
    const i = useStore.getState().active;

    if (mode === "opening" && i !== null) {
      tl.current?.kill();
      fade.current?.kill();
      const m = computeMetrics(window.innerWidth, window.innerHeight);
      const g = sim.garments[i];
      const f = facingOf(g.yaw, PRODUCTS[i].restYaw);
      detail.from = { x: g.x + sim.scroll, y: m.railY + m.hoverLift * f, yaw: renderYaw(g.yaw, PRODUCTS[i].restYaw, g.x + sim.scroll), roll: g.roll, scale: 1 + (MOTION.hoverScale - 1) * f };
      detail.p = 0;
      detail.opacity = 1;
      detail.spin = detail.spinV = detail.spinTarget = 0;
      detail.settleStart = -1;
      sim.hidden = i;
      sim.tapHover = null;
      sim.focusHover = null;
      sim.wakeRack();
      sim.wakeDetail();
      if (sim.labelEl) gsap.set(sim.labelEl.firstElementChild, { opacity: 0 });

      const o = MOTION.open;
      const t = gsap.timeline({ onComplete: () => setMode("detail") });
      t.set(veil, { visibility: "visible" }, 0)
        .to(veil, { opacity: 1, "--b": `${o.blurPx}px`, duration: s(o.veilMs), ease: "power2.out" }, 0)
        .to(home, { opacity: 0, duration: s(o.veilMs), ease: "power2.out" }, 0)
        .to(detail, { p: 1, duration: s(o.totalMs), ease: "expo.out", onUpdate: () => sim.wakeDetail() }, 0)
        .call(() => {
          detail.settleStart = performance.now() / 1000;
          sim.wakeDetail();
        }, [], s(o.totalMs) * 0.55)
        .fromTo(
          items,
          { opacity: 0, y: o.uiY },
          { opacity: 1, y: 0, duration: s(o.uiMs), stagger: s(o.uiStaggerMs), ease: "power2.out" },
          s(o.uiDelayMs),
        )
        .call(() => focusEl(closeRef.current), [], s(o.uiDelayMs));
      tl.current = t;
    }

    if (mode === "closing" && i !== null) {
      tl.current?.kill();
      fade.current?.kill();
      // the garment is back in its own slot, front-facing, neighbours parted…
      detail.opacity = 0;
      sim.hidden = null;
      sim.snapParted = i;
      sim.forceFront = i;
      sim.wakeRack();
      sim.wakeDetail();
      const c = MOTION.close;
      const t = gsap.timeline();
      t.to(veil, { opacity: 0, "--b": "0px", duration: s(c.overlayMs), ease: "power1.out" }, 0)
        .to(items, { opacity: 0, duration: s(c.overlayMs), ease: "power1.out" }, 0)
        .to(home, { opacity: 1, duration: s(c.overlayMs), ease: "power1.out" }, 0)
        // …then swivels back while the neighbours close in (springs in the rack loop)
        .call(() => {
          sim.forceFront = null;
          sim.wakeRack();
        }, [], s(c.releaseMs))
        .call(() => {
          setMode("rack");
          focusEl(sim.buttons[i]);
          sim.wakeRack();
        }, [], s(c.overlayMs))
        .set(veil, { visibility: "hidden" });
      tl.current = t;
    }
  }, [mode, setMode]);

  // prev / next: outgoing vanishes at once, incoming fades in over 300 ms
  useEffect(() => {
    if (navTick === 0) return;
    const i = useStore.getState().active;
    sim.hidden = i;
    sim.wakeRack();
    fade.current?.kill();
    detail.p = 1;
    detail.spin = detail.spinV = detail.spinTarget = 0;
    detail.settleStart = -1;
    detail.opacity = 0;
    sim.wakeDetail();
    fade.current = gsap.to(detail, {
      opacity: 1,
      duration: s(sim.reduced ? 0 : MOTION.navFadeMs),
      ease: "power1.out",
      onUpdate: () => sim.wakeDetail(),
    });
  }, [navTick]);

  // keyboard: Esc closes, arrows navigate, Tab is trapped in the overlay
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "Tab" && uiRef.current) {
        const f = Array.from(uiRef.current.querySelectorAll<HTMLElement>("button, a[href]"));
        if (!f.length) return;
        const idx = f.indexOf(document.activeElement as HTMLElement);
        e.preventDefault();
        const next = e.shiftKey ? (idx <= 0 ? f.length - 1 : idx - 1) : idx === f.length - 1 ? 0 : idx + 1;
        f[next].focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, go]);

  const product = active !== null ? PRODUCTS[active] : null;

  return (
    <>
      <div ref={veilRef} className={styles.veil} aria-hidden />
      <div className={styles.stage}>
        <DetailStage interactive={mode === "detail"} />
      </div>
      <div
        ref={uiRef}
        className={styles.ui}
        data-open={open || undefined}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={product ? product.name : undefined}
      >
        <div className={`${styles.slot} ${styles.prev}`}>
          <button type="button" data-pv-item className={styles.arrow} onClick={() => go(-1)} aria-label="Previous product" tabIndex={open ? 0 : -1}>
            <span aria-hidden>←</span>
          </button>
        </div>
        <div className={`${styles.slot} ${styles.next}`}>
          <button type="button" data-pv-item className={styles.arrow} onClick={() => go(1)} aria-label="Next product" tabIndex={open ? 0 : -1}>
            <span aria-hidden>→</span>
          </button>
        </div>
        <div className={`${styles.slot} ${styles.counter}`}>
          <div data-pv-item>
            {product ? pad(product.index + 1) : "00"} / {pad(COUNT)}
          </div>
        </div>
        <div className={`${styles.slot} ${styles.title}`}>
          <h2 data-pv-item>{product?.name}</h2>
        </div>
        <div className={`${styles.slot} ${styles.pill}`}>
          <div data-pv-item>
            <SeeAvailability tabIndex={open ? 0 : -1} />
          </div>
        </div>
        <div className={`${styles.slot} ${styles.progress}`}>
          <div data-pv-item className={styles.bar} />
        </div>
        <div className={styles.closeSlot}>
          <button ref={closeRef} type="button" data-pv-item className={styles.close} onClick={close} tabIndex={open ? 0 : -1}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
