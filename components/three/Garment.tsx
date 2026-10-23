"use client";

import * as THREE from "three";
import type { Ref } from "react";
import type { GarmentKind, Product } from "@/lib/products";
import { GARMENT_FITS } from "@/lib/garment-fit";
import { garmentMetrics, TEX, type RackMetrics } from "./useRackLayout";
import { createHangerGeometry, createHookGeometries } from "./Hanger";
import { injectFabric, type FabricUniforms } from "./fabric";

type Point = [number, number];
export interface GarmentGeometries {
  front: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  sides: THREE.BufferGeometry;
  collar: THREE.BufferGeometry;
  hanger: THREE.BufferGeometry;
  ring: THREE.BufferGeometry;
  stem: THREE.BufferGeometry;
}

function quadratic(a: Point, b: Point, c: Point, steps = 16): Point[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
  });
}

/** Follow the source cutouts, so the edge fabric closes the actual silhouette. */
function outline(kind: GarmentKind): Point[] {
  let left: Point[];
  if (kind === "tee") {
    left = [[392, 40], ...quadratic([392, 40], [300, 60], [212, 92]), [150, 205], [82, 322], [180, 392], [244, 330], ...quadratic([244, 330], [240, 700], [236, 1072]), [500, 1080]];
  } else if (kind === "longsleeve") {
    left = [[392, 40], ...quadratic([392, 40], [300, 60], [214, 94]), [158, 240], [128, 520], [112, 860], [106, 1012], [186, 1018], [204, 700], [232, 400], [252, 336], ...quadratic([252, 336], [246, 720], [244, 1106]), [500, 1112]];
  } else {
    left = [[392, 40], ...quadratic([392, 40], [300, 60], [210, 96]), [150, 250], [118, 540], [106, 880], [118, 1028], [122, 1086], [192, 1090], [196, 1030], [214, 720], [238, 420], [250, 340], ...quadratic([250, 340], [232, 760], [246, 1092]), [262, 1162], [500, 1166]];
  }
  const contour = [...left, ...left.slice(0, -1).reverse().map(([x, y]): Point => [TEX.w - x, y])];
  const dense: Point[] = [];
  for (let i = 1; i < contour.length; i++) {
    const a = contour[i - 1], b = contour[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12));
    for (let j = 0; j < n; j++) dense.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
  }
  dense.push(contour[contour.length - 1]);
  return dense;
}

function surface(px: number, py: number, z: number, m: RackMetrics, product: Product): [number, number, number] {
  const fit = GARMENT_FITS[product.kind];
  const u = px / TEX.w * 2 - 1, v = py / TEX.h;
  const fall = THREE.MathUtils.smoothstep(v, 0.16, 0.82);
  const body = Math.exp(-Math.pow(u / 0.65, 6)) * THREE.MathUtils.smoothstep(v, 0.24, 0.48);
  const x = u * m.garmentW / 2 * (1 + fit.body * body);
  const seed = product.groupId.length * 0.57;
  const hem = THREE.MathUtils.smoothstep(v, 0.80, 0.96) * (Math.sin(u * 5 + seed) * 0.004 + u * 0.002) * m.garmentH;
  const y = m.garmentCy + m.garmentH / 2 - v * m.garmentH + hem;
  const folds = (Math.sin(u * 13 + v * 2 + seed) * 0.009 + Math.sin(u * 24 - v * 4 + seed) * 0.003) * m.garmentW * fall;
  const fullness = Math.max(0, 1 - u * u) * Math.sin(Math.PI * Math.min(1, v)) * m.garmentW * 0.014;
  return [x, y, z - m.drapeK * x * x + folds + Math.sign(z) * fullness];
}

function drapePanel(m: RackMetrics, product: Product, z: number, flipU: boolean) {
  const g = new THREE.PlaneGeometry(m.garmentW, m.garmentH, 40, 48);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const p = surface(uv.getX(i) * TEX.w, (1 - uv.getY(i)) * TEX.h, z, m, product);
    pos.setXYZ(i, ...p);
    if (flipU) uv.setX(i, 1 - uv.getX(i));
  }
  g.computeVertexNormals();
  return g;
}

function ribbon(points: Point[], m: RackMetrics, product: Product, collar = false) {
  const vertices: number[] = [], indices: number[] = [];
  points.forEach(([x, y], i) => {
    const a = surface(x, y, m.layer, m, product);
    const b = collar ? surface(x, y + 9, m.layer + m.texel * 3, m, product) : surface(x, y, -m.layer, m, product);
    vertices.push(...a, ...b);
    if (i > 0) { const k = i * 2; indices.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Each design gets a cut, thickness, shoulder support and a closed fabric edge. */
export function createGarmentGeometries(base: RackMetrics, product: Product): GarmentGeometries {
  const m = garmentMetrics(base, product.index);
  const { ring, stem } = createHookGeometries(m);
  const depth = { tee: 140, longsleeve: 136, crewneck: 126, hoodie: 126 }[product.kind];
  return {
    front: drapePanel(m, product, m.layer, false),
    back: drapePanel(m, product, -m.layer, true),
    sides: ribbon(outline(product.kind), m, product),
    collar: ribbon(quadratic([392, 40], [500, depth], [608, 40], 36), m, product, true),
    hanger: createHangerGeometry(m), ring, stem,
  };
}

export function disposeGarmentGeometries(g: GarmentGeometries) {
  Object.values(g).forEach((geo) => geo.dispose());
}

// A subtle woven bump, generated as material data; the Kinta artwork is unchanged.
const weaveData = new Uint8Array(128 * 128 * 4);
for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
  const value = 125 + Math.round(20 * Math.sin(x * Math.PI / 2) * Math.cos(y * Math.PI / 2));
  const i = (y * 128 + x) * 4;
  weaveData.set([value, value, value, 255], i);
}
const weave = new THREE.DataTexture(weaveData, 128, 128, THREE.RGBAFormat);
weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
weave.repeat.set(24, 32);
weave.needsUpdate = true;

export function createFabricMaterial(map: THREE.Texture, panel: "front" | "back", fade: boolean, cloth: FabricUniforms) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.96, metalness: 0, side: THREE.DoubleSide, transparent: fade, alphaTest: 0.5, envMapIntensity: 0.25, bumpMap: weave, bumpScale: 0.003 });
  const inner = panel === "front" ? "!gl_FrontFacing" : "gl_FrontFacing";
  mat.onBeforeCompile = (shader) => {
    injectFabric(shader, cloth);
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>\nif (sampledDiffuseColor.a < 0.5) discard;\nif (${inner}) diffuseColor.rgb *= 0.7;`);
  };
  mat.customProgramCacheKey = () => `fabric-${panel}`;
  return mat;
}

export function createEdgeMaterial(product: Product, cloth: FabricUniforms, fade: boolean) {
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(product.colorHex).multiplyScalar(0.78), roughness: 1, side: THREE.DoubleSide, transparent: fade });
  mat.onBeforeCompile = (shader) => injectFabric(shader, cloth);
  mat.customProgramCacheKey = () => "fabric-edge";
  return mat;
}

export interface GarmentMaterials {
  front: THREE.Material; back: THREE.Material; edge: THREE.Material; wood: THREE.Material; chrome: THREE.Material;
}
interface GarmentProps { geo: GarmentGeometries; mats: GarmentMaterials; rootRef?: Ref<THREE.Group>; yawRef?: Ref<THREE.Group>; }

export function Garment({ geo, mats, rootRef, yawRef }: GarmentProps) {
  return <group ref={rootRef}><group ref={yawRef}>
    <mesh geometry={geo.ring} material={mats.chrome} castShadow />
    <mesh geometry={geo.stem} material={mats.chrome} castShadow />
    <mesh geometry={geo.hanger} material={mats.wood} castShadow />
    <mesh geometry={geo.back} material={mats.back} castShadow />
    <mesh geometry={geo.front} material={mats.front} castShadow />
    <mesh geometry={geo.sides} material={mats.edge} castShadow />
    <mesh geometry={geo.collar} material={mats.edge} />
  </group></group>;
}
