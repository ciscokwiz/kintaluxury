"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { PRODUCTS, getProductVariants } from "@/lib/products";
import { MOTION } from "@/lib/motion";
import { detail, sim, useStore } from "@/lib/store";
import { computeMetrics } from "./three/useRackLayout";
import { renderYaw } from "./three/physics";
import DetailStage from "./three/DetailStage";
import SeeAvailability from "./SeeAvailability";
import styles from "./ProductView.module.css";

const s = (ms: number) => ms / 1000;
/** focus rings only show for keyboard users (see html[data-input] in globals.css) */
const focusEl = (el: HTMLElement | null | undefined) => el?.focus({ preventScroll: true });

export default function ProductView() {
  const mode = useStore((st) => st.mode);
  const active = useStore((st) => st.active);
  const navTick = useStore((st) => st.navTick);
  const face = useStore((st) => st.face);
  const close = useStore((st) => st.close);
  const go = useStore((st) => st.go);
  const setFace = useStore((st) => st.setFace);
  const selectVariant = useStore((st) => st.selectVariant);
  const setMode = useStore((st) => st.setMode);

  const veilRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const fade = useRef<gsap.core.Tween | null>(null);

  const open = mode === "opening" || mode === "detail";

  // Route navigation unmounts the showroom; returning must start at the rack.
  useEffect(() => () => {
    tl.current?.kill();
    fade.current?.kill();
    sim.hidden = sim.forceFront = sim.snapParted = null;
    sim.tapHover = sim.focusHover = null;
    detail.opacity = 0;
    useStore.setState({ mode: "rack", active: null, hovered: null, face: "front" });
  }, []);

  // open / close timelines
  useEffect(() => {
    const veil = veilRef.current;
    const ui = uiRef.current;
    if (!veil || !ui) return;
    const items = ui.querySelectorAll<HTMLElement>("[data-pv-item]");
    const home = document.querySelectorAll<HTMLElement>("[data-home-fade]");
    const i = useStore.getState().active;
    const duration = (ms: number) => sim.reduced ? 0 : s(ms);

    if (mode === "opening" && i !== null) {
      tl.current?.kill();
      fade.current?.kill();
      const m = computeMetrics(window.innerWidth, window.innerHeight);
      const g = sim.garments[i];
      detail.from = { x: g.x + sim.scroll, y: m.railY, yaw: renderYaw(g.yaw, PRODUCTS[i].restYaw, g.x + sim.scroll), roll: g.roll, scale: 1 };
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
        .to(veil, { opacity: 1, "--b": `${o.blurPx}px`, duration: duration(o.veilMs), ease: "power2.out" }, 0)
        .to(home, { opacity: 0, duration: duration(o.veilMs), ease: "power2.out" }, 0)
        .to(detail, { p: 1, duration: duration(o.totalMs), ease: "expo.out", onUpdate: () => sim.wakeDetail() }, 0)
        .call(() => {
          detail.settleStart = performance.now() / 1000;
          sim.wakeDetail();
        }, [], duration(o.totalMs) * 0.55)
        .fromTo(
          items,
          { opacity: 0, y: o.uiY },
          { opacity: 1, y: 0, duration: duration(o.uiMs), stagger: duration(o.uiStaggerMs), ease: "power2.out" },
          duration(o.uiDelayMs),
        )
        .call(() => focusEl(closeRef.current), [], duration(o.uiDelayMs));
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
      t.to(veil, { opacity: 0, "--b": "0px", duration: duration(c.overlayMs), ease: "power1.out" }, 0)
        .to(items, { opacity: 0, duration: duration(c.overlayMs), ease: "power1.out" }, 0)
        .to(home, { opacity: 1, duration: duration(c.overlayMs), ease: "power1.out" }, 0)
        // …then swivels back while the neighbours close in (springs in the rack loop)
        .call(() => {
          sim.forceFront = null;
          sim.wakeRack();
        }, [], duration(c.releaseMs))
        .call(() => {
          setMode("rack");
          focusEl(sim.buttons[i]);
          sim.wakeRack();
        }, [], duration(c.overlayMs))
        .set(veil, { visibility: "hidden" });
      tl.current = t;
    }
  }, [mode, setMode]);

  // prev / next: outgoing vanishes at once, incoming fades in over 300 ms
  useEffect(() => {
    if (navTick === 0 || useStore.getState().mode !== "detail") return;
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
        const f = Array.from(uiRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]"));
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
  const variants = product ? getProductVariants(product) : [];

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
        aria-label={product ? `${product.title} — ${product.colorName}` : undefined}
      >
        <div className={`${styles.slot} ${styles.prev}`}>
          <button type="button" data-pv-item className={styles.arrow} onClick={() => go(-1)} aria-label="Previous product" tabIndex={open ? 0 : -1} disabled={mode !== "detail"}>
            <span aria-hidden>←</span>
          </button>
        </div>
        <div className={`${styles.slot} ${styles.next}`}>
          <button type="button" data-pv-item className={styles.arrow} onClick={() => go(1)} aria-label="Next product" tabIndex={open ? 0 : -1} disabled={mode !== "detail"}>
            <span aria-hidden>→</span>
          </button>
        </div>
        <div className={`${styles.slot} ${styles.title}`}>
          <h2 data-pv-item>{product?.title}</h2>
        </div>
        <div className={`${styles.slot} ${styles.faceSlot}`}>
          <div data-pv-item className={styles.faceToggle} role="group" aria-label="Garment view">
            <button type="button" aria-pressed={face === "front"} onClick={() => setFace("front")} tabIndex={open ? 0 : -1} disabled={mode !== "detail"}>Front</button>
            <button type="button" aria-pressed={face === "back"} onClick={() => setFace("back")} tabIndex={open ? 0 : -1} disabled={mode !== "detail"}>Back</button>
          </div>
        </div>
        <div className={`${styles.slot} ${styles.pill}`}>
          <div data-pv-item>
            <SeeAvailability productIndex={active ?? undefined} tabIndex={open ? 0 : -1} />
          </div>
        </div>
        <div className={styles.variants}>
          <div data-pv-item className={styles.tags} role="group" aria-label="Choose a color">
            {variants.length > 1 && variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className={styles.tag}
                style={{ backgroundColor: variant.colorHex, color: ["Bone", "Sand", "Sky", "Slate"].includes(variant.colorName) ? "#151515" : "#fff" }}
                aria-label={`Choose ${variant.colorName}`}
                aria-pressed={active === variant.index}
                onClick={() => selectVariant(variant.index)}
                tabIndex={open ? 0 : -1}
                disabled={mode !== "detail"}
              >
                <span className={styles.tagEyelet} aria-hidden />
                <span>{variant.colorName}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.closeSlot}>
          <button ref={closeRef} type="button" data-pv-item className={styles.close} onClick={close} tabIndex={open ? 0 : -1}>
            Close <span aria-hidden>×</span>
          </button>
        </div>
      </div>
    </>
  );
}
