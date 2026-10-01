"use client";

import * as THREE from "three";
import type { Ref } from "react";
import type { RackMetrics } from "./useRackLayout";
import { createHangerGeometry, createHookGeometries } from "./Hanger";

export interface GarmentGeometries {
  front: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  hanger: THREE.BufferGeometry;
  ring: THREE.BufferGeometry;
  stem: THREE.BufferGeometry;
}

/** Curved panel: PlaneGeometry(w, h, 32, 1) with z = zOffset − k·x². */
function drapePanel(m: RackMetrics, zOffset: number, flipU: boolean) {
  const g = new THREE.PlaneGeometry(m.garmentW, m.garmentH, 32, 1);
  g.translate(0, m.garmentCy, 0);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, zOffset - m.drapeK * x * x);
    if (flipU) uv.setX(i, 1 - uv.getX(i));
  }
  g.computeVertexNormals();
  return g;
}

/** Shared by every garment of one canvas (only textures differ). */
export function createGarmentGeometries(m: RackMetrics): GarmentGeometries {
  const { ring, stem } = createHookGeometries(m);
  return {
    front: drapePanel(m, m.layer, false),
    // the back panel's U is flipped so its print reads correctly from behind
    back: drapePanel(m, -m.layer, true),
    hanger: createHangerGeometry(m),
    ring,
    stem,
  };
}

export function disposeGarmentGeometries(g: GarmentGeometries) {
  Object.values(g).forEach((geo) => geo.dispose());
}

/**
 * Fabric: textured, double sided. The face you see "inside" the garment
 * (back of the front panel, front of the back panel) is darkened to 70 %.
 * Alpha is cut on the texture alpha only, so `opacity` can fade the panel.
 */
export function createFabricMaterial(map: THREE.Texture, panel: "front" | "back", fade: boolean) {
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    transparent: fade,
    envMapIntensity: 0.35,
  });
  const inner = panel === "front" ? "!gl_FrontFacing" : "gl_FrontFacing";
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      if (sampledDiffuseColor.a < 0.5) discard;
      if (${inner}) diffuseColor.rgb *= 0.7;`,
    );
  };
  mat.customProgramCacheKey = () => `fabric-${panel}`;
  return mat;
}

export interface GarmentMaterials {
  front: THREE.Material;
  back: THREE.Material;
  wood: THREE.Material;
  chrome: THREE.Material;
}

interface GarmentProps {
  geo: GarmentGeometries;
  mats: GarmentMaterials;
  rootRef?: Ref<THREE.Group>;
  yawRef?: Ref<THREE.Group>;
}

/**
 * root (position on the rail, roll = pendulum swing about the hook)
 *  └ yaw group (swivel about the vertical axis through the hook, hover scale / lift)
 *     ├ hook ring + stem (chrome)
 *     ├ hanger (wood), sandwiched between
 *     ├ back panel and
 *     └ front panel
 */
export function Garment({ geo, mats, rootRef, yawRef }: GarmentProps) {
  return (
    <group ref={rootRef}>
      <group ref={yawRef}>
        <mesh geometry={geo.ring} material={mats.chrome} />
        <mesh geometry={geo.stem} material={mats.chrome} />
        <mesh geometry={geo.hanger} material={mats.wood} />
        <mesh geometry={geo.back} material={mats.back} />
        <mesh geometry={geo.front} material={mats.front} />
      </group>
    </group>
  );
}
