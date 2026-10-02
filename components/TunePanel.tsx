"use client";

import { useEffect, useState } from "react";
import { FABRIC, FABRIC_DEFAULTS, type FabricConfig } from "@/lib/motion";
import { sim } from "@/lib/store";
import styles from "./TunePanel.module.css";

type NumKey = { [K in keyof FabricConfig]: FabricConfig[K] extends number ? K : never }[keyof FabricConfig];

const SLIDERS: { key: NumKey; label: string; min: number; max: number; step: number }[] = [
  { key: "depth", label: "Body thickness", min: 0, max: 0.12, step: 0.002 },
  { key: "press", label: "Pointer dent", min: 0, max: 0.08, step: 0.001 },
  { key: "radius", label: "Dent size", min: 0.06, max: 0.35, step: 0.005 },
  { key: "ripple", label: "Ripple", min: 0, max: 0.015, step: 0.0005 },
  { key: "drag", label: "Drag with pointer", min: 0, max: 0.06, step: 0.001 },
  { key: "breathe", label: "Breathing on hover", min: 0, max: 0.04, step: 0.001 },
  { key: "wave", label: "Swivel twist", min: 0, max: 0.15, step: 0.002 },
  { key: "sway", label: "Hem trailing", min: 0, max: 0.12, step: 0.002 },
  { key: "leanDeg", label: "Lean from hand (°)", min: 0, max: 15, step: 0.5 },
  { key: "rustle", label: "Neighbour rustle", min: 0, max: 1, step: 0.01 },
];

const STORE_KEY = "kinta-fabric-v1";

function wake() {
  sim.wakeRack();
  sim.wakeDetail();
}

/** Live controls for the cloth micro-motion. Shown with ?tune (or in the test build). */
export default function TunePanel() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(true);
  const [values, setValues] = useState<FabricConfig>({ ...FABRIC });
  const [copied, setCopied] = useState<"" | "ok" | "select">("");

  useEffect(() => {
    const on = process.env.NEXT_PUBLIC_TUNE === "1" || window.location.search.includes("tune");
    setVisible(on);
    if (!on) return;
    setOpen(window.innerWidth >= 640);
    try {
      const saved = window.localStorage.getItem(STORE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FabricConfig>;
        Object.assign(FABRIC, parsed);
        setValues({ ...FABRIC });
        wake();
      }
    } catch {
      /* storage unavailable: keep defaults */
    }
  }, []);

  const update = (patch: Partial<FabricConfig>) => {
    Object.assign(FABRIC, patch);
    const next = { ...FABRIC };
    setValues(next);
    setCopied("");
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    wake();
  };

  const json = JSON.stringify(values, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied("ok");
    } catch {
      setCopied("select");
    }
  };

  if (!visible) return null;

  return (
    <aside className={styles.panel} data-open={open || undefined} aria-label="Fabric motion controls">
      <button type="button" className={styles.toggle} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>Fabric motion</span>
        <span aria-hidden>{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className={styles.body}>
          <p className={styles.hint}>Hover a garment and move slowly across it. Click one to test the product view.</p>
          <label className={styles.check} htmlFor="tune-enabled">
            <input id="tune-enabled" type="checkbox" checked={values.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
            Cloth motion on
          </label>
          {SLIDERS.map((s) => (
            <div key={s.key} className={styles.row}>
              <label htmlFor={`tune-${s.key}`}>{s.label}</label>
              <output htmlFor={`tune-${s.key}`}>{values[s.key]}</output>
              <input
                id={`tune-${s.key}`}
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={values[s.key]}
                disabled={!values.enabled}
                onChange={(e) => update({ [s.key]: Number(e.target.value) } as Partial<FabricConfig>)}
              />
            </div>
          ))}
          <div className={styles.actions}>
            <button type="button" onClick={() => update({ ...FABRIC_DEFAULTS })}>
              Reset
            </button>
            <button type="button" onClick={copy}>
              {copied === "ok" ? "Copied" : "Copy settings"}
            </button>
          </div>
          {copied === "select" && (
            <textarea
              className={styles.dump}
              readOnly
              value={json}
              aria-label="Settings to copy"
              ref={(t) => t?.select()}
              rows={6}
            />
          )}
        </div>
      )}
    </aside>
  );
}
