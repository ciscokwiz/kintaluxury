"use client";

import * as THREE from "three";
import type { HangerKind, RackMetrics } from "./useRackLayout";
import { HANGER_PROFILE, TEX } from "./useRackLayout";

const WOOD_DARK = new THREE.Color("#5A2620");
const WOOD_LIGHT = new THREE.Color("#7A3A2C");

/** Wooden shoulder bar: an arch fitted to the garment's shoulders, extruded, bevelled, bent to the drape. */
export function createHangerGeometry(m: RackMetrics, kind: HangerKind): THREE.BufferGeometry {
  const t = m.texel;
  const top = m.hangerTop;
  const prof = HANGER_PROFILE[kind];
  const tipX = prof.tipX * t;
  const drop = prof.drop * t;
  const th = TEX.hangerThick * t;
  const edge = (x: number) => top - drop * Math.pow(Math.min(1, Math.abs(x) / tipX), prof.power);
  const N = 24;

  const s = new THREE.Shape();
  // top edge, left tip → right tip
  for (let i = 0; i <= N; i++) {
    const x = -tipX + (2 * tipX * i) / N;
    if (i === 0) s.moveTo(x, edge(x));
    else s.lineTo(x, edge(x));
  }
  // rounded right tip, bottom edge back, rounded left tip
  s.quadraticCurveTo(tipX + th * 0.55, edge(tipX) - th * 0.5, tipX - th * 0.15, edge(tipX) - th);
  for (let i = N - 1; i >= 1; i--) {
    const x = -tipX + (2 * tipX * i) / N;
    s.lineTo(x * 0.98, edge(x) - th * (0.95 + 0.05 * Math.abs(x / tipX)));
  }
  s.lineTo(-tipX + th * 0.15, edge(tipX) - th);
  s.quadraticCurveTo(-tipX - th * 0.55, edge(tipX) - th * 0.5, -tipX, edge(-tipX));

  const depth = m.layer * 1.1;
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
    c.copy(WOOD_DARK).lerp(WOOD_LIGHT, 0.25 + 0.75 * k);
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
  const ring = new THREE.TorusGeometry(m.hookR, m.hookTube, 10, 40, (300 * Math.PI) / 180);
  // the arc starts at the bottom (where the stem joins) and ends lower-left
  ring.rotateZ((-105 * Math.PI) / 180);
  ring.translate(0, m.hookCy, 0);
  const stemTop = m.hookCy - m.hookR;
  const stemBottom = m.hangerTop - TEX.hangerThick * m.texel * 0.4;
  const stem = new THREE.CylinderGeometry(m.hookTube, m.hookTube * 1.15, stemTop - stemBottom, 10);
  stem.translate(0, (stemTop + stemBottom) / 2, 0);
  return { ring, stem };
}

/** Procedural wood grain (greyscale; the vertex colours carry the hue). Runs along the bar. */
function woodGrain(): THREE.Texture {
  const w = 512;
  const h = 256;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const waves = Array.from({ length: 5 }, () => ({ f: 1 + rnd() * 3, p: rnd() * 6.28, a: 2 + rnd() * 6 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let yy = y;
      for (const wv of waves) yy += Math.sin((x / w) * 6.283 * wv.f + wv.p) * wv.a;
      const ring = 0.5 + 0.5 * Math.sin(yy * 0.55 + Math.sin(yy * 0.07) * 3);
      const fine = 0.5 + 0.5 * Math.sin(yy * 2.7 + x * 0.01);
      const v = 0.78 + 0.16 * ring * ring + 0.05 * fine + (rnd() - 0.5) * 0.03;
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v * 255));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.9, 2.4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Lacquered wood: grain × the hanger's dark-to-light gradient, with a thin clear coat. */
export function createWoodMaterial() {
  return new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: woodGrain(),
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.7,
  });
}

export function createChromeMaterial() {
  return new THREE.MeshStandardMaterial({ color: "#f2f2f2", metalness: 1, roughness: 0.12 });
}
