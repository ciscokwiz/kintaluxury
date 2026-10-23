"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { useRackMetrics } from "./useRackLayout";

/**
 * Soft studio: a long horizontal softbox above and one to the left, baked
 * into an environment map so the chrome rail shows a bright streak and a
 * dark band. A shadow-only wall grounds the clothes against the backdrop.
 */
export function StudioLights() {
  const m = useRackMetrics();
  const shadowWidth = Math.max(12, m.worldW * 0.75);
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight
        castShadow
        position={[-4, 7, 12]}
        intensity={1.15}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-shadowWidth}
        shadow-camera-right={shadowWidth}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-radius={8}
        shadow-blurSamples={12}
      />
      <mesh position={[0, 0, -1.15]} receiveShadow>
        <planeGeometry args={[m.worldW + 12, 22]} />
        <shadowMaterial transparent opacity={0.12} />
      </mesh>
      <Environment resolution={256} frames={1}>
        <color attach="background" args={["#2a2a2c"]} />
        <Lightformer form="rect" intensity={4} position={[0, 7, 2]} rotation-x={Math.PI / 2} scale={[40, 3, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[0, -6, 4]} rotation-x={-Math.PI / 2} scale={[40, 6, 1]} color="#dcdcd8" />
        <Lightformer form="rect" intensity={2.2} position={[-12, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={0.8} position={[0, 0, 12]} scale={[30, 10, 1]} color="#e6e6e2" />
      </Environment>
    </>
  );
}
