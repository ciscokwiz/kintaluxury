"use client";

import { useMemo, type Ref } from "react";
import * as THREE from "three";
import type { RackMetrics } from "./useRackLayout";

interface RailProps {
  m: RackMetrics;
  material: THREE.Material;
  groupRef?: Ref<THREE.Group>;
}

/** Chrome tube across the wall with a bracket (stand-off + round flange) at each end. */
export function Rail({ m, material, groupRef }: RailProps) {
  const len = m.railRight - m.railLeft;
  const cx = (m.railLeft + m.railRight) / 2;
  const standOff = m.lh(3);
  const flangeR = m.lh(1.2);

  const geo = useMemo(
    () => ({
      tube: new THREE.CylinderGeometry(m.railRadius, m.railRadius, len, 32, 1).rotateZ(Math.PI / 2),
      elbow: new THREE.SphereGeometry(m.railRadius, 24, 16),
      post: new THREE.CylinderGeometry(m.railRadius * 0.85, m.railRadius * 0.85, standOff, 24).rotateX(Math.PI / 2),
      flange: new THREE.CylinderGeometry(flangeR, flangeR, m.railRadius * 0.6, 40).rotateX(Math.PI / 2),
    }),
    [m.railRadius, len, standOff, flangeR],
  );

  return (
    <group ref={groupRef}>
      <mesh geometry={geo.tube} material={material} position={[cx, m.railY, 0]} />
      {[m.railLeft, m.railRight].map((x) => (
        <group key={x} position={[x, m.railY, 0]}>
          <mesh geometry={geo.elbow} material={material} />
          <mesh geometry={geo.post} material={material} position={[0, 0, -standOff / 2]} />
          <mesh geometry={geo.flange} material={material} position={[0, 0, -standOff]} />
        </group>
      ))}
    </group>
  );
}
