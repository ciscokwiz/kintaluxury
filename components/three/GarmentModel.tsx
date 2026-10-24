"use client";

import { Suspense, useEffect, useMemo, type Ref } from "react";
import * as THREE from "three";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Product } from "@/lib/products";
import { MOTION } from "@/lib/motion";
import { detail, sim } from "@/lib/store";
import { applyClothMotion, COLLAR_OFFSET, createClothMotion, MODEL_SHAPES, modelTextureUrls, modelUrl, stepClothMotion, type ModelDetail } from "@/lib/garment-models";
import type { RackMetrics } from "./useRackLayout";
import { createChromeMaterial, createHangerGeometry, createHookGeometries, createWoodMaterial } from "./Hanger";

export function configureModelLoader(loader: GLTFLoader) {
  loader.setMeshoptDecoder(MeshoptDecoder);
}

/** Instances share geometry and maps, but never mutable materials or morph weights. */
function ModelBody({ product, lod, m, detailView }: { product: Product; lod: ModelDetail; m: RackMetrics; detailView: boolean }) {
  const prototype = useLoader(GLTFLoader, modelUrl(product.kind, lod), configureModelLoader);
  const urls = useMemo(() => product.modelVariant === "liberty" ? [] : modelTextureUrls(product.modelVariant, lod), [product.modelVariant, lod]);
  const textures = useTexture(urls);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  const instance = useMemo(() => {
    for (const texture of textures) {
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
    }
    const scene = prototype.scene.clone(true);
    const materials = new Map<THREE.Material, THREE.Material>();
    const morphs: THREE.Mesh[] = [];
    const color = new THREE.Color(product.colorHex);
    const cloneMaterial = (source: THREE.Material) => {
      const cached = materials.get(source);
      if (cached) return cached;
      const material = source.clone();
      if (material instanceof THREE.MeshStandardMaterial && textures.length) {
        if (material.name.startsWith("Cotton") || material.name === "Collar_Rib") {
          material.map = material.name === "Cotton_Jersey" ? textures[0] : textures[1];
          material.color.setRGB(1, 1, 1);
        } else if (material.name === "Double_Stitch_Thread") {
          material.color.copy(color).multiplyScalar(0.94);
        }
      }
      material.transparent = detailView;
      materials.set(source, material);
      return material;
    };
    scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = false;
      node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
      if (node.morphTargetInfluences) morphs.push(node);
    });
    return { scene, materials: [...materials.values()], morphs, motion: createClothMotion() };
  }, [prototype.scene, textures, gl, product, detailView]);

  useEffect(() => {
    invalidate();
    return () => instance.materials.forEach((material) => material.dispose());
  }, [instance, invalidate]);

  useFrame((_, rawDelta) => {
    const garment = sim.garments[product.index];
    const moving = stepClothMotion(
      instance.motion,
      detailView ? detail.spinV : garment.vyaw,
      detailView ? 0 : garment.vx + sim.scrollV,
      m.modelScale,
      Math.min(rawDelta, MOTION.maxDelta),
      sim.reduced,
    );
    applyClothMotion(instance.morphs, instance.motion);
    if (detailView) instance.materials.forEach((material) => { material.opacity = detail.opacity; });
    if (moving) invalidate();
  });

  return (
    <group scale={m.modelScale} position={[0, -(MODEL_SHAPES[product.kind].hook + COLLAR_OFFSET) * m.modelScale, 0]}>
      <primitive object={instance.scene} name={`garment-${product.id}-${lod}`} dispose={null} />
    </group>
  );
}

interface GarmentProps {
  product: Product;
  m: RackMetrics;
  detailView?: boolean;
  showHanger?: boolean;
  rootRef?: Ref<THREE.Group>;
  yawRef?: Ref<THREE.Group>;
}

/** The top of the hook is the shared pivot for rack and enlarged views. */
export function Garment({ product, m, detailView = false, showHanger = true, rootRef, yawRef }: GarmentProps) {
  const geometries = useMemo(() => ({
    hanger: createHangerGeometry(m, product.kind),
    ...createHookGeometries(m, product.kind),
  }), [m, product.kind]);
  const materials = useMemo(() => {
    const chrome = createChromeMaterial();
    const wood = createWoodMaterial();
    chrome.transparent = wood.transparent = detailView;
    return { chrome, wood };
  }, [detailView]);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  useFrame(() => {
    if (detailView) materials.chrome.opacity = materials.wood.opacity = detail.opacity;
  });

  const rackBody = <ModelBody product={product} m={m} lod="rack" detailView={detailView} />;
  return (
    <group ref={rootRef}>
      <group ref={yawRef}>
        <group visible={showHanger}>
          <mesh geometry={geometries.ring} material={materials.chrome} />
          <mesh geometry={geometries.stem} material={materials.chrome} />
          <mesh geometry={geometries.hanger} material={materials.wood} castShadow />
        </group>
        {detailView && m.bp !== "mobile" ? (
          <Suspense fallback={rackBody}>
            <ModelBody product={product} m={m} lod="detail" detailView />
          </Suspense>
        ) : rackBody}
      </group>
    </group>
  );
}
