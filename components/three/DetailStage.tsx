"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { PRODUCTS } from "@/lib/products";
import { MOTION, DEG_TO_RAD } from "@/lib/motion";
import { detail, sim, useStore } from "@/lib/store";
import { CAM_Z, FOV, useRackMetrics } from "./useRackLayout";
import { Garment, createFabricMaterial, createGarmentGeometries, disposeGarmentGeometries } from "./Garment";
import { createChromeMaterial, createWoodMaterial } from "./Hanger";
import { StudioLights } from "./StudioLights";
import { TEXTURE_URLS, configureTextures } from "./RackScene";
import { springStep } from "./physics";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function DetailGarment() {
  const m = useRackMetrics();
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const active = useStore((s) => s.active);
  const mode = useStore((s) => s.mode);

  const textures = useTexture(TEXTURE_URLS);
  useMemo(() => configureTextures(textures, Math.min(8, gl.capabilities.getMaxAnisotropy())), [textures, gl]);

  const geo = useMemo(() => createGarmentGeometries(m), [m]);
  useEffect(() => () => disposeGarmentGeometries(geo), [geo]);

  // separate, fadeable materials (transparent) for the product view
  const mats = useMemo(() => {
    const wood = createWoodMaterial();
    const chrome = createChromeMaterial();
    wood.transparent = chrome.transparent = true;
    return PRODUCTS.map((_, i) => ({
      front: createFabricMaterial(textures[i * 2], "front", true),
      back: createFabricMaterial(textures[i * 2 + 1], "back", true),
      wood,
      chrome,
    }));
  }, [textures]);

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
    const down = (e: PointerEvent) => {
      if (useStore.getState().mode !== "detail") return;
      dragging = true;
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
      detail.spinTarget = Math.round(detail.spinTarget / Math.PI) * Math.PI;
      invalidate();
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
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
    y.rotation.y = lerp(f.yaw, 0, p) + detail.spin;
    y.scale.setScalar(lerp(f.scale, m.detailScale, p));

    const mt = mats[active];
    (mt.front as THREE.MeshStandardMaterial).opacity = detail.opacity;
    (mt.back as THREE.MeshStandardMaterial).opacity = detail.opacity;
    (mt.wood as THREE.MeshStandardMaterial).opacity = detail.opacity;
    (mt.chrome as THREE.MeshStandardMaterial).opacity = detail.opacity;
    if (moving) invalidate();
  });

  if (active === null) return null;
  return <Garment geo={geo} mats={mats[active]} rootRef={root} yawRef={yaw} />;
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
