"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { RackMetrics } from "./useRackLayout";

interface RailProps {
  m: RackMetrics;
  material: THREE.Material;
}

/** Chrome tube with rounded rectangular wall plates and recessed screws. */
export function Rail({ m, material }: RailProps) {
  const len = m.railRight - m.railLeft;
  const cx = (m.railLeft + m.railRight) / 2;
  const standOff = m.lh(2.7);
  const plateW = m.lh(1.8);
  const plateH = m.lh(4.4);
  const geo = useMemo(() => {
    const r = plateW * 0.2;
    const shape = new THREE.Shape();
    shape.moveTo(-plateW / 2 + r, -plateH / 2);
    shape.lineTo(plateW / 2 - r, -plateH / 2);
    shape.quadraticCurveTo(plateW / 2, -plateH / 2, plateW / 2, -plateH / 2 + r);
    shape.lineTo(plateW / 2, plateH / 2 - r);
    shape.quadraticCurveTo(plateW / 2, plateH / 2, plateW / 2 - r, plateH / 2);
    shape.lineTo(-plateW / 2 + r, plateH / 2);
    shape.quadraticCurveTo(-plateW / 2, plateH / 2, -plateW / 2, plateH / 2 - r);
    shape.lineTo(-plateW / 2, -plateH / 2 + r);
    shape.quadraticCurveTo(-plateW / 2, -plateH / 2, -plateW / 2 + r, -plateH / 2);
    return {
      tube: new THREE.CylinderGeometry(m.railRadius, m.railRadius, len, 40).rotateZ(Math.PI / 2),
      elbow: new THREE.SphereGeometry(m.railRadius * 1.03, 24, 16),
      post: new THREE.CylinderGeometry(m.railRadius * 0.8, m.railRadius * 0.8, standOff, 20).rotateX(Math.PI / 2),
      plate: new THREE.ExtrudeGeometry(shape, { depth: m.railRadius * 0.35, bevelEnabled: true, bevelSize: r * 0.25, bevelThickness: r * 0.2, bevelSegments: 2, steps: 1 }),
      screw: new THREE.SphereGeometry(plateW * 0.13, 12, 8).scale(1, 1, 0.4),
      slot: new THREE.BoxGeometry(plateW * 0.16, plateW * 0.025, plateW * 0.025),
    };
  }, [m.railRadius, len, standOff, plateW, plateH]);
  const recess = useMemo(() => new THREE.MeshStandardMaterial({ color: "#343b3d", metalness: 0.8, roughness: 0.4 }), []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useEffect(() => () => recess.dispose(), [recess]);

  return (
    <group>
      <mesh geometry={geo.tube} material={material} position={[cx, m.railY, 0]} castShadow />
      {[m.railLeft, m.railRight].map((x) => (
        <group key={x} position={[x, m.railY, 0]}>
          <mesh geometry={geo.elbow} material={material} />
          <mesh geometry={geo.post} material={material} position={[0, 0, -standOff / 2]} />
          <mesh geometry={geo.plate} material={material} position={[0, 0, -standOff]} castShadow />
          {[-1, 1].map((direction) => (
            <group key={direction} position={[0, direction * plateH * 0.32, -standOff + m.railRadius * 0.45]}>
              <mesh geometry={geo.screw} material={material} />
              <mesh geometry={geo.slot} material={recess} position={[0, 0, plateW * 0.06]} rotation-z={0.3} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
