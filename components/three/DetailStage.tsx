"use client";

import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PRODUCTS } from "@/lib/products";
import { MOTION, DEG_TO_RAD } from "@/lib/motion";
import { detail, sim, useStore } from "@/lib/store";
import { CAM_Z, detailPlacement, FOV, useRackMetrics } from "./useRackLayout";
import { Garment } from "./GarmentModel";
import { StudioLights } from "./StudioLights";
import { springStep } from "./physics";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function DetailGarment() {
  const m = useRackMetrics();
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const active = useStore((state) => state.active);
  const mode = useStore((state) => state.mode);
  const showHanger = useStore((state) => state.showHanger);
  const root = useRef<THREE.Group>(null);
  const yaw = useRef<THREE.Group>(null);

  useEffect(() => {
    sim.wakeDetail = invalidate;
    invalidate();
  }, [invalidate, active, mode, showHanger]);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let startX = 0;
    let startSpin = 0;
    const down = (event: PointerEvent) => {
      if (useStore.getState().mode !== "detail" || !event.isPrimary || event.button !== 0) return;
      dragging = true;
      startX = event.clientX;
      startSpin = detail.spinTarget;
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      detail.spinTarget = startSpin + ((event.clientX - startX) / m.widthPx) * Math.PI * 2.2;
      invalidate();
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      detail.spinTarget = Math.round(detail.spinTarget / Math.PI) * Math.PI;
      const turns = Math.round(detail.spinTarget / Math.PI);
      useStore.setState({ face: Math.abs(turns % 2) === 1 ? "back" : "front" });
      if (sim.reduced) {
        detail.spin = detail.spinTarget;
        detail.spinV = 0;
      }
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
    const r = root.current;
    const y = yaw.current;
    if (!r || !y) return;
    const show = active !== null && mode !== "rack" && mode !== "closing" && detail.opacity > 0.001;
    r.visible = show;
    if (!show || active === null) return;
    const dt = Math.min(rawDelta, MOTION.maxDelta);
    let moving = false;
    let settle = 0;
    if (detail.settleStart >= 0 && !sim.reduced) {
      const t = performance.now() / 1000 - detail.settleStart;
      const envelope = Math.exp(-MOTION.detailSettle.decay * t);
      settle = MOTION.detailSettle.amplitudeDeg * DEG_TO_RAD * Math.sin(t * Math.PI * 2 * MOTION.detailSettle.hz) * envelope;
      if (envelope > 0.002) moving = true;
    }
    if (sim.reduced) {
      detail.spin = detail.spinTarget;
      detail.spinV = 0;
    } else {
      springStep(detail, "spin", "spinV", detail.spinTarget, MOTION.swivel.stiffness, MOTION.swivel.damping, dt);
    }
    if (Math.abs(detail.spin - detail.spinTarget) > 1e-4 || Math.abs(detail.spinV) > 1e-4) moving = true;
    const fit = detailPlacement(m, PRODUCTS[active].kind);
    r.position.set(lerp(detail.from.x, 0, detail.p), lerp(detail.from.y, fit.y, detail.p), 0);
    r.rotation.z = lerp(detail.from.roll, 0, detail.p) + settle;
    y.rotation.y = lerp(detail.from.yaw, 0, detail.p) + detail.spin;
    y.scale.setScalar(lerp(detail.from.scale, fit.scale, detail.p));
    if (moving) invalidate();
  });

  if (active === null) return null;
  return <Garment key={active} product={PRODUCTS[active]} m={m} detailView showHanger={showHanger} rootRef={root} yawRef={yaw} />;
}

export default function DetailStage({ interactive }: { interactive: boolean }) {
  return (
    <Canvas
      shadows="variance"
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
