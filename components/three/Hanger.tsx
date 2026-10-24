"use client";

import * as THREE from "three";
import type { RackMetrics } from "./useRackLayout";
import { TEX } from "./useRackLayout";

const WOOD_DARK = new THREE.Color("#4d2819");
const WOOD_LIGHT = new THREE.Color("#9b5b34");

/** Wooden shoulder bar: a flattened arch, extruded, bevelled and bent to the drape. */
export function createHangerGeometry(m: RackMetrics): THREE.BufferGeometry {
  const t = m.texel;
  const top = m.hangerTop;
  const tipX = TEX.hangerTipX * (m.garmentW / TEX.w);
  const drop = (TEX.hangerTipTop - TEX.hangerTop) * t;
  const th = TEX.hangerThick * t;

  const s = new THREE.Shape();
  s.moveTo(-tipX, top - drop);
  s.bezierCurveTo(-tipX * 0.65, top - drop * 0.55, -tipX * 0.25, top - drop * 0.3, -tipX * 0.14, top - drop * 0.25);
  s.lineTo(-tipX * 0.1, top);
  s.quadraticCurveTo(0, top + th * 0.16, tipX * 0.1, top);
  s.lineTo(tipX * 0.14, top - drop * 0.25);
  s.bezierCurveTo(tipX * 0.25, top - drop * 0.3, tipX * 0.65, top - drop * 0.55, tipX, top - drop);
  s.quadraticCurveTo(tipX + th * 0.55, top - drop - th * 0.5, tipX - th * 0.15, top - drop - th);
  s.bezierCurveTo(tipX * 0.65, top - drop * 0.55 - th, tipX * 0.25, top - drop * 0.3 - th, 0, top - drop * 0.26 - th);
  s.bezierCurveTo(-tipX * 0.25, top - drop * 0.3 - th, -tipX * 0.65, top - drop * 0.55 - th, -tipX + th * 0.15, top - drop - th);
  s.quadraticCurveTo(-tipX - th * 0.55, top - drop - th * 0.5, -tipX, top - drop);

  const depth = 26 * t;
  const bevel = 1.4 * t;
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 18,
  });
  g.translate(0, 0, -depth / 2);

  // bend with the garment drape + wood colour gradient (lighter in the middle)
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) - m.drapeK * x * x);
    const k = 1 - Math.min(1, Math.abs(x) / tipX);
    const grain = Math.sin(x / t * 0.15 + pos.getY(i) / t * 0.6) * 0.045;
    c.copy(WOOD_DARK).lerp(WOOD_LIGHT, 0.24 + 0.62 * k + grain);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Chrome hook: a ~300° arc around the rail plus a short stem down into the hanger. */
export function createHookGeometries(m: RackMetrics) {
  const ring = new THREE.TorusGeometry(m.hookR, m.hookTube, 10, 40, (285 * Math.PI) / 180);
  // the arc starts at the bottom (where the stem joins) and ends lower-left
  ring.rotateZ((-105 * Math.PI) / 180);
  ring.translate(0, m.hookCy, 0);
  const stemTop = m.hookCy - m.hookR;
  const stemBottom = m.hangerTop - TEX.hangerThick * m.texel * 0.4;
  const stem = new THREE.CylinderGeometry(m.hookTube, m.hookTube * 1.15, stemTop - stemBottom, 10);
  stem.translate(0, (stemTop + stemBottom) / 2, 0);
  return { ring, stem };
}

export function createWoodMaterial() {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0, envMapIntensity: 0.35 });
}

export function createChromeMaterial() {
  return new THREE.MeshStandardMaterial({ color: "#c5cccf", metalness: 1, roughness: 0.16, envMapIntensity: 1.15 });
}
