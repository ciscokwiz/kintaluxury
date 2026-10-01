"use client";

import { Environment, Lightformer } from "@react-three/drei";

/**
 * Soft studio: a long horizontal softbox above and one to the left, baked
 * into an environment map so the chrome rail shows a bright streak and a
 * dark band. No shadows.
 */
export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[-6, 8, 10]} intensity={1.1} />
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
