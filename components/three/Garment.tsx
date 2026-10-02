"use client";

import * as THREE from "three";
import type { Ref } from "react";
import type { HangerKind, RackMetrics } from "./useRackLayout";
import { createHangerGeometry, createHookGeometries } from "./Hanger";
import { createPanelUniforms, injectFabric, type FabricUniforms } from "./fabric";

export interface GarmentGeometries {
  front: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  hanger: Record<HangerKind, THREE.BufferGeometry>;
  ring: THREE.BufferGeometry;
  stem: THREE.BufferGeometry;
}

/**
 * Curved panel with z = −k·x². The brief's 32 × 1 grid can only bend
 * sideways; the cloth shader needs rows, and the body volume needs enough
 * resolution to follow the outline, hence 96 × 120. The vertex shader pushes
 * the front panel forward and the back panel backward over the volume map.
 */
function drapePanel(m: RackMetrics, zOffset: number, flipU: boolean) {
  const g = new THREE.PlaneGeometry(m.garmentW, m.garmentH, 96, 120);
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
    front: drapePanel(m, 0, false),
    // the back panel's U is flipped so its print reads correctly from behind
    back: drapePanel(m, 0, true),
    hanger: { tee: createHangerGeometry(m, "tee"), hoodie: createHangerGeometry(m, "hoodie") },
    ring,
    stem,
  };
}

export function disposeGarmentGeometries(g: GarmentGeometries) {
  [g.front, g.back, g.ring, g.stem, g.hanger.tee, g.hanger.hoodie].forEach((geo) => geo.dispose());
}

/**
 * Fabric: the photographed garment as albedo (its studio shading is baked
 * in), a soft sheen for the cotton/fleece fuzz, double sided. The face you
 * see "inside" the garment is darkened to 70 %. Alpha is cut on the texture
 * alpha only, so `opacity` can fade the panel. The vertex shader adds the
 * body volume and the cloth micro-motion driven by `cloth`.
 */
export function createFabricMaterial(
  map: THREE.Texture,
  panel: "front" | "back",
  fade: boolean,
  cloth: FabricUniforms,
  volume: THREE.Texture,
) {
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    roughness: 0.92,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color("#7a7a7a"),
    side: THREE.DoubleSide,
    transparent: fade,
    envMapIntensity: 0.3,
  });
  const panelUniforms = createPanelUniforms(volume, panel);
  const inner = panel === "front" ? "!gl_FrontFacing" : "gl_FrontFacing";
  mat.onBeforeCompile = (shader) => {
    injectFabric(shader, cloth, panelUniforms);
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
  kind: HangerKind;
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
export function Garment({ geo, kind, mats, rootRef, yawRef }: GarmentProps) {
  return (
    <group ref={rootRef}>
      <group ref={yawRef}>
        <mesh geometry={geo.ring} material={mats.chrome} />
        <mesh geometry={geo.stem} material={mats.chrome} />
        <mesh geometry={geo.hanger[kind]} material={mats.wood} />
        <mesh geometry={geo.back} material={mats.back} />
        <mesh geometry={geo.front} material={mats.front} />
      </group>
    </group>
  );
}
