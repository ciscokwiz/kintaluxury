"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { PRODUCTS } from "@/lib/products";
import { MOTION, DEG_TO_RAD, FABRIC } from "@/lib/motion";
import { detail, sim, useStore } from "@/lib/store";
import { CAM_Z, FOV, useRackMetrics } from "./useRackLayout";
import { Garment, createFabricMaterial, createGarmentGeometries, disposeGarmentGeometries } from "./Garment";
import { createChromeMaterial, createWoodMaterial } from "./Hanger";
import { StudioLights } from "./StudioLights";
import { TEXTURE_URLS, configureTextures } from "./RackScene";
import { springStep } from "./physics";
import {
  createFabricState,
  createFabricUniforms,
  fabricGlobals,
  pointerOnGarment,
  setFabricFrame,
  stepFabric,
  syncFabricGlobals,
} from "./fabric";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function DetailGarment() {
  const m = useRackMetrics();
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const active = useStore((s) => s.active);
  const mode = useStore((s) => s.mode);

  const textures = useTexture(TEXTURE_URLS);
  useMemo(() => configureTextures(textures, Math.min(8, gl.capabilities.getMaxAnisotropy())), [textures, gl]);

  const geo = useMemo(() => createGarmentGeometries(m), [m]);
  useEffect(() => () => disposeGarmentGeometries(geo), [geo]);

  // cloth for the product view: one uniform set per product, one eased state
  const cloth = useMemo(() => PRODUCTS.map((_, i) => createFabricUniforms(i * 1.7)), []);
  const clothState = useMemo(() => createFabricState(), []);
  useEffect(() => cloth.forEach((u) => setFabricFrame(u, m)), [cloth, m]);
  const pointer = useRef({ x: -1, y: -1, spinning: false });
  const local = useMemo(() => new THREE.Vector2(), []);

  // separate, fadeable materials (transparent) for the product view
  const mats = useMemo(() => {
    const wood = createWoodMaterial();
    const chrome = createChromeMaterial();
    wood.transparent = chrome.transparent = true;
    return PRODUCTS.map((_, i) => ({
      front: createFabricMaterial(textures[i * 3], "front", true, cloth[i], textures[i * 3 + 2]),
      back: createFabricMaterial(textures[i * 3 + 1], "back", true, cloth[i], textures[i * 3 + 2]),
      wood,
      chrome,
    }));
  }, [textures, cloth]);

  const root = useRef<THREE.Group>(null);
  const yaw = useRef<THREE.Group>(null);

  useEffect(() => {
    sim.wakeDetail = invalidate;
    invalidate();
  }, [invalidate, active, mode]);

  // drag to turn the garment on its hook (shows the back print), springs to the nearest face
  useEffect(() => {
    const el = gl.domElement;
    let startX = 0;
    let startSpin = 0;
    let dragging = false;
    const track = (e: PointerEvent) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      if (useStore.getState().mode === "detail") invalidate();
    };
    window.addEventListener("pointermove", track, { passive: true });
    const down = (e: PointerEvent) => {
      if (useStore.getState().mode !== "detail") return;
      dragging = true;
      pointer.current.spinning = true;
      startX = e.clientX;
      startSpin = detail.spinTarget;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      detail.spinTarget = startSpin + ((e.clientX - startX) / m.widthPx) * Math.PI * 2.2;
      invalidate();
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      pointer.current.spinning = false;
      detail.spinTarget = Math.round(detail.spinTarget / Math.PI) * Math.PI;
      invalidate();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", track);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, m, invalidate]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, MOTION.maxDelta);
    const r = root.current;
    const y = yaw.current;
    if (!r || !y) return;
    const show = active !== null && mode !== "rack" && mode !== "closing" && detail.opacity > 0.001;
    r.visible = show;
    if (!show || active === null) return;
    let moving = false;

    const p = detail.p;
    const f = detail.from;
    // tail of the open animation: a tiny settle sway that dies out within ~1 s
    let settle = 0;
    if (detail.settleStart >= 0 && !sim.reduced) {
      const t = performance.now() / 1000 - detail.settleStart;
      const env = Math.exp(-MOTION.detailSettle.decay * t);
      settle = MOTION.detailSettle.amplitudeDeg * DEG_TO_RAD * Math.sin(t * Math.PI * 2 * MOTION.detailSettle.hz) * env;
      if (env > 0.002) moving = true;
    }
    springStep(detail, "spin", "spinV", detail.spinTarget, MOTION.swivel.stiffness, MOTION.swivel.damping, dt);
    if (Math.abs(detail.spin - detail.spinTarget) > 1e-4 || Math.abs(detail.spinV) > 1e-4) moving = true;

    r.position.set(lerp(f.x, 0, p), lerp(f.y, m.detailPivotY, p), 0);
    r.rotation.z = lerp(f.roll, 0, p) + settle;
    // lean away from the hand pressing the cloth (eased by the cloth state)
    const lean =
      FABRIC.enabled && !sim.reduced
        ? Math.max(-1, Math.min(1, clothState.cursor.x / (m.garmentW * 0.45))) * FABRIC.leanDeg * 0.6 * DEG_TO_RAD * clothState.press
        : 0;
    y.rotation.y = lerp(f.yaw, 0, p) + detail.spin + lean;
    y.scale.setScalar(lerp(f.scale, m.detailScale, p));

    // cloth: the garment breathes while you look at it and answers the pointer
    syncFabricGlobals(sim.reduced);
    fabricGlobals.uTime.value += dt;
    let press = 0;
    let cursor: THREE.Vector2 | null = null;
    const pt = pointer.current;
    if (mode === "detail" && !pt.spinning && pt.x >= 0) {
      r.updateMatrixWorld(true);
      if (pointerOnGarment(camera, pt.x, pt.y, m.widthPx, m.heightPx, y, m, local)) {
        press = 1;
        cursor = local;
      }
    }
    const clothMoving = stepFabric(
      clothState,
      cloth[active],
      { press, cursor, hover: 0.7, yawVelocity: detail.spinV, slideVelocity: 0 },
      dt,
      m.garmentW,
    );
    // while a product is open it keeps breathing gently; on the rack nothing moves at rest
    if (clothMoving || (mode === "detail" && FABRIC.enabled && !sim.reduced)) moving = true;
    if (Math.abs(lean) > 1e-4) moving = true;

    const mt = mats[active];
    (mt.front as THREE.MeshStandardMaterial).opacity = detail.opacity;
    (mt.back as THREE.MeshStandardMaterial).opacity = detail.opacity;
    (mt.wood as THREE.MeshStandardMaterial).opacity = detail.opacity;
    (mt.chrome as THREE.MeshStandardMaterial).opacity = detail.opacity;
    if (moving) invalidate();
  });

  if (active === null) return null;
  return <Garment geo={geo} kind={PRODUCTS[active].kind === "hoodie" ? "hoodie" : "tee"} mats={mats[active]} rootRef={root} yawRef={yaw} />;
}

export default function DetailStage({ interactive }: { interactive: boolean }) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
      camera={{ fov: FOV, position: [0, 0, CAM_Z], near: 0.1, far: 200 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ pointerEvents: interactive ? "auto" : "none", cursor: interactive ? "grab" : "default", touchAction: "none" }}
    >
      <StudioLights />
      <Suspense fallback={null}>
        <DetailGarment />
      </Suspense>
    </Canvas>
  );
}
