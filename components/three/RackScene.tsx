"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { PRODUCTS, COUNT } from "@/lib/products";
import { MOTION, FABRIC, DEG_TO_RAD } from "@/lib/motion";
import { sim, useStore } from "@/lib/store";
import { CAM_Z, FOV, layoutRack, useRackMetrics, type RackMetrics } from "./useRackLayout";
import { Rail } from "./Rail";
import { Garment, createFabricMaterial, createGarmentGeometries, disposeGarmentGeometries } from "./Garment";
import { createChromeMaterial, createWoodMaterial } from "./Hanger";
import { StudioLights } from "./StudioLights";
import { springStep, damp, facingOf, renderYaw } from "./physics";
import {
  createFabricState,
  createFabricUniforms,
  fabricGlobals,
  pointerOnGarment,
  setFabricFrame,
  stepFabric,
  syncFabricGlobals,
} from "./fabric";
import styles from "./RackScene.module.css";

export const TEXTURE_URLS = PRODUCTS.flatMap((p) => [p.front, p.back ?? p.front]);

export function configureTextures(textures: THREE.Texture[], anisotropy: number) {
  for (const t of textures) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropy;
    t.needsUpdate = true;
  }
}

/* ---------------------------------------------------------------------- */

function hitTest(m: RackMetrics, px: number, py: number, current: number | null): number | null {
  const wx = (px / m.widthPx - 0.5) * m.worldW - sim.scroll;
  const wy = (0.5 - py / m.heightPx) * 10;
  const top = m.railY + m.hookTop + m.lh(1);
  const bottom = m.railY + Math.min(...m.hemY) - m.lh(1.5);
  if (wy > top || wy < bottom) return null;
  const half = (i: number) => {
    const f = facingOf(sim.garments[i].yaw, PRODUCTS[i].restYaw);
    return (m.pitch + (m.wFront - m.pitch) * f) / 2;
  };
  if (current !== null && current !== sim.hidden && Math.abs(wx - sim.garments[current].x) < half(current)) return current;
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < COUNT; i++) {
    if (i === sim.hidden) continue;
    const d = Math.abs(wx - sim.garments[i].x);
    if (d < half(i) && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/* ---------------------------------------------------------------------- */

function Rack() {
  const m = useRackMetrics();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const setReady = useStore((s) => s.setReady);

  const textures = useTexture(TEXTURE_URLS);
  useMemo(() => configureTextures(textures, Math.min(8, gl.capabilities.getMaxAnisotropy())), [textures, gl]);

  const geo = useMemo(() => createGarmentGeometries(m), [m]);
  useEffect(() => () => disposeGarmentGeometries(geo), [geo]);

  const shared = useMemo(() => ({ chrome: createChromeMaterial(), wood: createWoodMaterial() }), []);
  // cloth: one uniform set per garment (front + back panel share it) and its eased state
  const cloth = useMemo(() => PRODUCTS.map((_, i) => createFabricUniforms(i * 1.7)), []);
  const clothState = useMemo(() => PRODUCTS.map(() => createFabricState()), []);
  useEffect(() => cloth.forEach((u) => setFabricFrame(u, m)), [cloth, m]);
  const mats = useMemo(
    () =>
      PRODUCTS.map((_, i) => ({
        front: createFabricMaterial(textures[i * 2], "front", false, cloth[i]),
        back: createFabricMaterial(textures[i * 2 + 1], "back", false, cloth[i]),
        wood: shared.wood,
        chrome: shared.chrome,
      })),
    [textures, shared, cloth],
  );

  const roots = useRef<(THREE.Group | null)[]>([]);
  const yaws = useRef<(THREE.Group | null)[]>([]);
  const railRef = useRef<THREE.Group>(null);
  const targets = useRef<number[]>(new Array(COUNT).fill(0));
  const facing = useRef<number[]>(new Array(COUNT).fill(0));
  const label = useRef({ x: 0, y: 0, shown: false });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const local = useMemo(() => new THREE.Vector2(), []);
  const el = gl.domElement;

  // first paint: everything at rest
  useEffect(() => {
    if (!sim.initialised) {
      PRODUCTS.forEach((p, i) => {
        const g = sim.garments[i];
        g.x = g.tx = m.restX[i];
        g.yaw = p.restYaw;
        g.roll = p.restRoll;
      });
      sim.initialised = true;
    } else {
      // resize: jump to the new rest layout
      PRODUCTS.forEach((_, i) => {
        sim.garments[i].x = m.restX[i];
        sim.garments[i].vx = 0;
      });
    }
    sim.scroll = Math.max(-m.scrollMax, Math.min(m.scrollMax, sim.scroll));
    setReady();
    invalidate();
  }, [m, setReady, invalidate]);

  // pointer, click, tap and drag-to-scroll
  useEffect(() => {
    const el = gl.domElement;
    sim.wakeRack = invalidate;
    let down: { x: number; y: number; t: number; scroll: number; moved: boolean } | null = null;
    let lastX = 0;
    let lastT = 0;

    const onMove = (e: PointerEvent) => {
      sim.pointer.x = e.clientX;
      sim.pointer.y = e.clientY;
      sim.pointer.type = e.pointerType;
      sim.pointer.seen = true;
      sim.pointer.overCanvas = e.target === el;
      if (down && (m.scrollable || e.pointerType !== "mouse")) {
        const dx = e.clientX - down.x;
        if (Math.abs(dx) > 6) down.moved = true;
        if (down.moved && m.scrollable) {
          sim.dragging = true;
          sim.scroll = Math.max(-m.scrollMax, Math.min(m.scrollMax, down.scroll + dx * m.unitPerPx));
          const now = performance.now();
          const dt = Math.max(1, now - lastT) / 1000;
          sim.scrollV = ((e.clientX - lastX) * m.unitPerPx) / dt;
          lastX = e.clientX;
          lastT = now;
        }
      }
      invalidate();
    };
    const onLeave = () => {
      sim.pointer.overCanvas = false;
      invalidate();
    };
    const onDown = (e: PointerEvent) => {
      // a tap fires no pointermove, so record the pointer type here too
      sim.pointer.type = e.pointerType;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), scroll: sim.scroll, moved: false };
      lastX = e.clientX;
      lastT = performance.now();
      sim.scrollV = 0;
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      sim.dragging = false;
      if (!d || d.moved) {
        invalidate();
        return;
      }
      if (performance.now() - lastT > 80) sim.scrollV = 0;
      const st = useStore.getState();
      if (st.mode !== "rack") return;
      if (e.pointerType === "mouse") {
        if (st.hovered !== null) st.open(st.hovered);
        return;
      }
      // touch / pen: first tap = hover swivel, second tap = open
      const hit = hitTest(m, e.clientX, e.clientY, sim.tapHover);
      if (hit !== null && hit === sim.tapHover) {
        sim.tapHover = null;
        st.open(hit);
      } else {
        sim.tapHover = hit;
      }
      invalidate();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, m, invalidate]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, MOTION.maxDelta);
    const st = useStore.getState();
    const reduced = sim.reduced;
    let moving = false;

    // momentum scroll (narrow screens)
    if (!sim.dragging && sim.scrollV !== 0) {
      sim.scroll += sim.scrollV * dt;
      sim.scrollV *= Math.exp(-4 * dt);
      if (Math.abs(sim.scroll) > m.scrollMax) {
        sim.scroll = Math.sign(sim.scroll) * m.scrollMax;
        sim.scrollV = 0;
      }
      if (Math.abs(sim.scrollV) < 0.02) sim.scrollV = 0;
      moving = true;
    }

    // who is hovered?
    let hovered: number | null = null;
    if (st.mode === "rack") {
      if (sim.focusHover !== null) hovered = sim.focusHover;
      else if (sim.pointer.type === "mouse")
        hovered = sim.pointer.overCanvas && !sim.dragging ? hitTest(m, sim.pointer.x, sim.pointer.y, st.hovered) : null;
      else hovered = sim.tapHover;
    }
    if (hovered !== st.hovered) st.setHovered(hovered);
    el.style.cursor = hovered !== null ? "pointer" : sim.dragging ? "grabbing" : m.scrollable ? "grab" : "default";

    // close sequence: put the returning garment in its slot, front-facing, neighbours parted
    if (sim.snapParted !== null) {
      const a = sim.snapParted;
      PRODUCTS.forEach((p, i) => {
        const g = sim.garments[i];
        g.yaw = i === a ? 0 : p.restYaw;
        g.vyaw = 0;
        facing.current[i] = i === a ? 1 : 0;
      });
      layoutRack(m, facing.current, a, targets.current);
      sim.garments.forEach((g, i) => {
        g.x = g.tx = targets.current[i];
        g.vx = 0;
        g.vroll = 0;
        g.roll = PRODUCTS[i].restRoll;
      });
      sim.snapParted = null;
    }

    // swivel
    const front = hovered ?? sim.forceFront;
    for (let i = 0; i < COUNT; i++) {
      const g = sim.garments[i];
      const rest = PRODUCTS[i].restYaw;
      // the hovered garment leans away from the hand pressing it (micro-motion)
      const cs = clothState[i];
      const lean =
        i === hovered && !reduced && FABRIC.enabled
          ? Math.max(-1, Math.min(1, cs.cursor.x / (m.garmentW * 0.45))) * FABRIC.leanDeg * DEG_TO_RAD * cs.press
          : 0;
      const target = i === front ? lean : rest;
      if (reduced) {
        const step = (rest / (MOTION.reducedSwivelMs / 1000)) * dt;
        g.yaw += Math.max(-step, Math.min(step, target - g.yaw));
        g.vyaw = 0;
      } else {
        springStep(g, "yaw", "vyaw", target, MOTION.swivel.stiffness, MOTION.swivel.damping, dt);
      }
      facing.current[i] = facingOf(g.yaw, rest);
      if (Math.abs(target - g.yaw) > 1e-4 || Math.abs(g.vyaw) > 1e-4) moving = true;
    }

    // rail layout around the hovered (or most-turned) garment
    let anchor: number | null = front;
    if (anchor === null) {
      let best = 0.002;
      for (let i = 0; i < COUNT; i++)
        if (facing.current[i] > best) {
          best = facing.current[i];
          anchor = i;
        }
    }
    layoutRack(m, facing.current, anchor, targets.current);

    for (let i = 0; i < COUNT; i++) {
      const g = sim.garments[i];
      g.tx = targets.current[i];
      if (reduced) {
        g.x = g.tx;
        g.vx = 0;
        g.roll = PRODUCTS[i].restRoll;
        g.vroll = 0;
      } else {
        springStep(g, "x", "vx", g.tx, MOTION.slide.stiffness, MOTION.slide.damping, dt);
        const swing = Math.max(-MOTION.swayMax, Math.min(MOTION.swayMax, -g.vx * MOTION.swayGain));
        springStep(g, "roll", "vroll", PRODUCTS[i].restRoll + swing, MOTION.sway.stiffness, MOTION.sway.damping, dt);
      }
      if (Math.abs(g.tx - g.x) > 1e-4 || Math.abs(g.vx) > 1e-4 || Math.abs(g.vroll) > 1e-4) moving = true;

      const root = roots.current[i];
      const yawG = yaws.current[i];
      if (!root || !yawG) continue;
      const f = facing.current[i];
      root.position.set(g.x + sim.scroll, m.railY, 0);
      root.rotation.z = g.roll;
      root.visible = i !== sim.hidden;
      yawG.rotation.y = renderYaw(g.yaw, PRODUCTS[i].restYaw, g.x + sim.scroll);
      yawG.scale.setScalar(1 + (MOTION.hoverScale - 1) * f);
      yawG.position.y = m.hoverLift * f;
    }
    if (railRef.current) railRef.current.position.x = sim.scroll;

    // cloth: press / drag under the pointer, breathing on hover, rustle for neighbours
    syncFabricGlobals(reduced);
    fabricGlobals.uTime.value += dt;
    const mouse = sim.pointer.type === "mouse" && sim.pointer.overCanvas && !sim.dragging && st.mode === "rack";
    const pwx = (sim.pointer.x / m.widthPx - 0.5) * m.worldW - sim.scroll;
    const pwy = (0.5 - sim.pointer.y / m.heightPx) * 10;
    const inBand = pwy < m.railY + m.hookTop && pwy > m.railY + Math.min(...m.hemY);
    for (let i = 0; i < COUNT; i++) {
      const g = sim.garments[i];
      const yawG = yaws.current[i];
      let press = 0;
      let cursor: THREE.Vector2 | null = null;
      if (i === hovered && mouse && yawG && roots.current[i]) {
        roots.current[i]!.updateMatrixWorld(true);
        if (pointerOnGarment(camera, sim.pointer.x, sim.pointer.y, m.widthPx, m.heightPx, yawG, m, local)) {
          press = 1;
          cursor = local;
        }
      }
      let hover = i === hovered ? 1 : 0;
      if (i !== hovered && mouse && inBand) {
        const d = (pwx - g.x) / (m.pitch * 1.3);
        hover = FABRIC.rustle * Math.exp(-d * d);
      }
      const active = stepFabric(clothState[i], cloth[i], { press, cursor, hover, yawVelocity: g.vyaw, slideVelocity: g.vx }, dt, m.garmentW);
      if (active) moving = true;
    }

    // hover label follows the hem of the hovered garment
    const lab = sim.labelEl;
    if (lab && hovered !== null && roots.current[hovered] && yaws.current[hovered]) {
      roots.current[hovered]!.updateMatrixWorld(true);
      tmp.set(0, m.hemY[hovered], m.layer).applyMatrix4(yaws.current[hovered]!.matrixWorld).project(camera);
      const tx = (tmp.x * 0.5 + 0.5) * m.widthPx;
      const ty = (-tmp.y * 0.5 + 0.5) * m.heightPx + m.heightPx * 0.03;
      const L = label.current;
      if (!L.shown || reduced) {
        L.x = tx;
        L.y = ty;
      } else {
        L.x = damp(L.x, tx, MOTION.label.glideLambda, dt);
        L.y = damp(L.y, ty, MOTION.label.glideLambda, dt);
        if (Math.abs(L.x - tx) > 0.3 || Math.abs(L.y - ty) > 0.3) moving = true;
      }
      L.shown = true;
      lab.style.transform = `translate3d(${L.x.toFixed(1)}px, ${L.y.toFixed(1)}px, 0) translateX(-50%)`;
    } else {
      label.current.shown = false;
    }

    // micro-parallax: the chrome highlight slides a touch with the pointer
    const railLen = m.railRight - m.railLeft;
    const useParallax = !reduced && sim.pointer.seen && sim.pointer.type === "mouse" && st.mode === "rack";
    const px = useParallax ? (sim.pointer.x / m.widthPx - 0.5) * 2 * MOTION.parallax.x * railLen : 0;
    const py = useParallax ? -(sim.pointer.y / m.heightPx - 0.5) * 2 * MOTION.parallax.y * railLen : 0;
    camera.position.x = damp(camera.position.x, px, MOTION.parallax.lambda, dt);
    camera.position.y = damp(camera.position.y, py, MOTION.parallax.lambda, dt);
    if (Math.abs(camera.position.x - px) > 1e-4 || Math.abs(camera.position.y - py) > 1e-4) moving = true;

    // keep the loop alive only while something moves or the pointer is on the rack
    if (moving || sim.pointer.overCanvas || sim.dragging) invalidate();
  });

  return (
    <>
      <Rail m={m} material={shared.chrome} groupRef={railRef} />
      {PRODUCTS.map((p, i) => (
        <Garment
          key={p.id}
          geo={geo}
          mats={mats[i]}
          rootRef={(g) => {
            roots.current[i] = g;
          }}
          yawRef={(g) => {
            yaws.current[i] = g;
          }}
        />
      ))}
    </>
  );
}

/* ---------------------------------------------------------------------- */

function A11yButtons() {
  const open = useStore((s) => s.open);
  return (
    <div className={styles.srOnly}>
      {PRODUCTS.map((p, i) => (
        <button
          key={p.id}
          type="button"
          ref={(b) => {
            sim.buttons[i] = b;
          }}
          onFocus={() => {
            if (!sim.keyboard) return;
            sim.focusHover = i;
            sim.wakeRack();
          }}
          onBlur={() => {
            if (sim.focusHover === i) sim.focusHover = null;
            sim.wakeRack();
          }}
          onClick={() => open(i)}
        >
          {p.name}
        </button>
      ))}
    </div>
  );
}

function useInputModality() {
  useEffect(() => {
    const root = document.documentElement;
    const key = () => {
      sim.keyboard = true;
      root.dataset.input = "keyboard";
    };
    const pointer = () => {
      sim.keyboard = false;
      root.dataset.input = "pointer";
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", pointer, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("pointerdown", pointer, true);
    };
  }, []);
}

function useReducedMotion() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      sim.reduced = mq.matches;
      sim.wakeRack();
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
}

export default function RackScene() {
  const ready = useStore((s) => s.ready);
  useReducedMotion();
  useInputModality();
  return (
    <>
      <div className={styles.rack} style={{ opacity: ready ? 1 : 0, transitionDuration: `${MOTION.sceneFadeMs}ms` }}>
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
          camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 200 }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <StudioLights />
          <Suspense fallback={null}>
            <Rack />
          </Suspense>
        </Canvas>
      </div>
      <A11yButtons />
    </>
  );
}
