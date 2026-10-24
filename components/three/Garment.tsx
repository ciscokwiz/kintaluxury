"use client";

import * as THREE from "three";
import type { Ref } from "react";
import type { GarmentKind } from "@/lib/products";
import SHAPES from "@/lib/garment-shapes.json";
import type { RackMetrics } from "./useRackLayout";
import { createHangerGeometry, createHookGeometries } from "./Hanger";
import { injectFabric, type FabricUniforms } from "./fabric";

export interface GarmentGeometries {
  front: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  edge: THREE.BufferGeometry;
  hanger: THREE.BufferGeometry;
  ring: THREE.BufferGeometry;
  stem: THREE.BufferGeometry;
}

/** Shared by the faces and their sewn edge so turning never exposes a gap. */
export function garmentPoint(m: RackMetrics, px: number, py: number, side: 1 | -1) {
  const u = (px / 1000 - 0.5) * 2;
  const v = py / 1200;
  const x = u * m.garmentW / 2;
  const fall = THREE.MathUtils.smoothstep(v, 0.16, 0.84);
  const hem = THREE.MathUtils.smoothstep(v, 0.8, 1);
  const y = m.garmentCy + m.garmentH / 2 - v * m.garmentH
    + Math.sin(u * 9 + 0.8) * m.garmentW * 0.005 * hem;
  const folds = Math.sin(u * 16 + Math.sin(v * 5) * 0.7) * m.garmentW * 0.012 * fall;
  const chest = Math.exp(-Math.pow(u / 0.66, 6)) * Math.sin(Math.PI * Math.min(1, v));
  const sleeve = Math.exp(-Math.pow((Math.abs(u) - 0.67) / 0.22, 2))
    * Math.sin(Math.PI * Math.min(1, v * 1.3));
  const volume = m.layer + m.garmentW * (0.027 * chest + 0.02 * sleeve);
  return new THREE.Vector3(x, y, -m.drapeK * x * x + folds + side * volume);
}

function drapePanel(m: RackMetrics, side: 1 | -1) {
  const g = new THREE.PlaneGeometry(m.garmentW, m.garmentH, 48, 64);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const point = garmentPoint(m, uv.getX(i) * 1000, (1 - uv.getY(i)) * 1200, side);
    pos.setXYZ(i, point.x, point.y, point.z);
    if (side === -1) uv.setX(i, 1 - uv.getX(i));
  }
  g.computeVertexNormals();
  return g;
}

/** The collar, shoulders, sleeves and side seams join the two faces in 3D. */
function sewEdges(m: RackMetrics, kind: GarmentKind) {
  const contour = SHAPES[kind];
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < contour.length; i++) {
    const a = contour[i];
    const b = contour[(i + 1) % contour.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12));
    const start = positions.length / 3;
    for (let j = 0; j <= steps; j++) {
      const px = THREE.MathUtils.lerp(a[0], b[0], j / steps);
      const py = THREE.MathUtils.lerp(a[1], b[1], j / steps);
      for (const side of [1, -1] as const) {
        const p = garmentPoint(m, px, py, side);
        positions.push(p.x, p.y, p.z);
      }
      if (j < steps) {
        const k = start + j * 2;
        indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function createGarmentGeometries(m: RackMetrics, kind: GarmentKind): GarmentGeometries {
  const { ring, stem } = createHookGeometries(m);
  return {
    front: drapePanel(m, 1),
    back: drapePanel(m, -1),
    edge: sewEdges(m, kind),
    hanger: createHangerGeometry(m),
    ring,
    stem,
  };
}

export function disposeGarmentGeometries(g: GarmentGeometries) {
  Object.values(g).forEach((geo) => geo.dispose());
}

export function createFabricMaterial(map: THREE.Texture, panel: "front" | "back", fade: boolean, cloth: FabricUniforms) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.94,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: fade,
    alphaTest: 0.5,
    envMapIntensity: 0.2,
  });
  const inner = panel === "front" ? "!gl_FrontFacing" : "gl_FrontFacing";
  mat.onBeforeCompile = (shader) => {
    injectFabric(shader, cloth);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      if (sampledDiffuseColor.a < 0.5) discard;
      if (${inner}) diffuseColor.rgb *= 0.68;`,
    );
  };
  mat.customProgramCacheKey = () => `fabric-${panel}`;
  return mat;
}

export function createSeamMaterial(color: string, fade: boolean, cloth: FabricUniforms) {
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).multiplyScalar(0.8),
    roughness: 0.96,
    side: THREE.DoubleSide,
    transparent: fade,
  });
  mat.onBeforeCompile = (shader) => injectFabric(shader, cloth);
  mat.customProgramCacheKey = () => "fabric-seam";
  return mat;
}

export interface GarmentMaterials {
  front: THREE.Material;
  back: THREE.Material;
  edge: THREE.Material;
  wood: THREE.Material;
  chrome: THREE.Material;
}

interface GarmentProps {
  geo: GarmentGeometries;
  mats: GarmentMaterials;
  rootRef?: Ref<THREE.Group>;
  yawRef?: Ref<THREE.Group>;
}

/** All parts turn together around the hook, at their original scale. */
export function Garment({ geo, mats, rootRef, yawRef }: GarmentProps) {
  return (
    <group ref={rootRef}>
      <group ref={yawRef}>
        <mesh geometry={geo.ring} material={mats.chrome} />
        <mesh geometry={geo.stem} material={mats.chrome} />
        <mesh geometry={geo.hanger} material={mats.wood} castShadow />
        <mesh geometry={geo.back} material={mats.back} castShadow />
        <mesh geometry={geo.front} material={mats.front} castShadow />
        <mesh geometry={geo.edge} material={mats.edge} castShadow />
      </group>
    </group>
  );
}
