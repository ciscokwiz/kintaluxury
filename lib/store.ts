import { create } from "zustand";
import { COUNT } from "./products";

export type ViewMode = "rack" | "opening" | "detail" | "closing";

interface UIState {
  /** garment under the pointer (or keyboard focus) on the rack */
  hovered: number | null;
  /** garment shown in the product view */
  active: number | null;
  mode: ViewMode;
  /** textures loaded, scene may fade in */
  ready: boolean;
  /** bumps on every prev/next so the detail fade restarts even on wrap to the same index */
  navTick: number;
  setHovered: (i: number | null) => void;
  setReady: () => void;
  open: (i: number) => void;
  close: () => void;
  go: (dir: 1 | -1) => void;
  setMode: (m: ViewMode) => void;
}

export const useStore = create<UIState>((set, get) => ({
  hovered: null,
  active: null,
  mode: "rack",
  ready: false,
  navTick: 0,
  setHovered: (i) => {
    if (get().hovered !== i) set({ hovered: i });
  },
  setReady: () => set({ ready: true }),
  open: (i) => {
    if (get().mode !== "rack") return;
    set({ active: i, mode: "opening", hovered: null });
  },
  close: () => {
    const m = get().mode;
    if (m === "detail" || m === "opening") set({ mode: "closing" });
  },
  go: (dir) => {
    const { mode, active, navTick } = get();
    if (mode !== "detail" && mode !== "opening") return;
    if (active === null) return;
    set({ active: (active + dir + COUNT) % COUNT, navTick: navTick + 1 });
  },
  setMode: (mode) => set(mode === "rack" ? { mode, active: null } : { mode }),
}));

/* ------------------------------------------------------------------------
 * Mutable, per-frame simulation state. Lives outside React so the frame
 * loops of both canvases can read/write it without re-rendering.
 * --------------------------------------------------------------------- */

export interface GarmentSim {
  x: number;
  vx: number;
  yaw: number;
  vyaw: number;
  roll: number;
  vroll: number;
  /** x target from the rack layout (world units, before scroll) */
  tx: number;
}

export const sim = {
  garments: Array.from({ length: COUNT }, (): GarmentSim => ({ x: 0, vx: 0, yaw: 0, vyaw: 0, roll: 0, vroll: 0, tx: 0 })),
  initialised: false,
  /** pointer in CSS px relative to the viewport */
  pointer: { x: 0, y: 0, overCanvas: false, type: "mouse" as string, seen: false },
  /** keyboard focus hover (a11y buttons) */
  focusHover: null as number | null,
  /** sticky hover from a tap on touch devices */
  tapHover: null as number | null,
  /** garment drawn by the detail canvas, hidden on the rack */
  hidden: null as number | null,
  /** garment forced to face front (close sequence) */
  forceFront: null as number | null,
  /** set by the close sequence: snap the rack into the parted layout around this index */
  snapParted: null as number | null,
  /** horizontal scroll of the rail on narrow screens (world units) */
  scroll: 0,
  scrollV: 0,
  dragging: false,
  /** last input was the keyboard (focus only acts as hover / shows rings then) */
  keyboard: false,
  /** prefers-reduced-motion */
  reduced: false,
  /** off-screen a11y buttons, one per garment (focus is returned here on close) */
  buttons: [] as (HTMLButtonElement | null)[],
  /** hover label DOM node, positioned every frame by the rack loop */
  labelEl: null as HTMLDivElement | null,
  /** rack canvas `invalidate` so DOM events can wake the demand loop */
  wakeRack: () => {},
  wakeDetail: () => {},
};

/** Flight / fade state of the garment in the product view. */
export const detail = {
  /** 0 = at its rail slot, 1 = at the detail anchor */
  p: 1,
  opacity: 1,
  from: { x: 0, y: 0, yaw: 0, roll: 0, scale: 1 },
  /** time (s, performance.now based) the settle sway started */
  settleStart: -1,
  /** user drag-to-turn (rad) and its spring velocity */
  spin: 0,
  spinV: 0,
  spinTarget: 0,
};

