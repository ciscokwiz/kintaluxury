import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PRODUCTS, type GarmentKind } from "@/lib/products";
import { MOTION } from "@/lib/motion";
import { computeMetrics, layoutRack } from "@/components/three/useRackLayout";
import { createGarmentGeometries, disposeGarmentGeometries, garmentPoint } from "@/components/three/Garment";
import { createFabricState, createFabricUniforms, stepFabric } from "@/components/three/fabric";
import SHAPES from "@/lib/garment-shapes.json";

const viewports = [[1170, 660], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 667]];
const kinds: GarmentKind[] = ["tee", "longsleeve", "crewneck", "hoodie"];

test("all ten colorways remain independently available on the rack", () => {
  assert.equal(PRODUCTS.length, 10);
  assert.equal(new Set(PRODUCTS.map((p) => p.id)).size, 10);
  assert.equal(new Set(PRODUCTS.map((p) => p.groupId)).size, 7);
});

test("every hovered garment has room to turn without reordering hooks or passing a mount", () => {
  for (const [width, height] of viewports) {
    const m = computeMetrics(width, height);
    for (let anchor = 0; anchor < PRODUCTS.length; anchor++) {
      for (const progress of [0, 0.25, 0.75, 1, 1.05]) {
        const facing = PRODUCTS.map((_, i) => i === anchor ? progress : 0);
        const positions = layoutRack(m, facing, anchor, []);
        assert.equal(positions.length, PRODUCTS.length);
        positions.forEach((x, i) => {
          assert.ok(Number.isFinite(x) && x > m.railLeft && x < m.railRight);
          if (i) assert.ok(x - positions[i - 1] > m.bunch * 0.9, `${width}×${height}, anchor ${anchor}`);
        });
        if (progress === 1) {
          const clearance = (m.wFront + m.pitch) / 2;
          if (anchor > 0) assert.ok(positions[anchor] - positions[anchor - 1] >= clearance - 1e-6);
          if (anchor < PRODUCTS.length - 1) assert.ok(positions[anchor + 1] - positions[anchor] >= clearance - 1e-6);
        }
      }
    }
    for (const facing of [PRODUCTS.map(() => 1), PRODUCTS.map((_, i) => i < 3 ? 1 : 0)]) {
      const positions = layoutRack(m, facing, 1, []);
      positions.forEach((x, i) => {
        assert.ok(x > m.railLeft && x < m.railRight);
        if (i) assert.ok(x > positions[i - 1], "rapid sweeps must preserve garment order");
      });
    }
  }
});

test("all garment shapes fit above product controls, including the longest hoodie on portrait screens", () => {
  for (const [width, height] of viewports) {
    const m = computeMetrics(width, height);
    const top = m.detailPivotY + m.hookTop * m.detailScale;
    assert.ok(top <= m.y(15.5));
    for (const kind of kinds) {
      for (const [px, py] of SHAPES[kind]) {
        const p = garmentPoint(m, px, py, 1);
        const y = m.detailPivotY + p.y * m.detailScale;
        assert.ok(y >= m.y(72), `${kind} crosses controls at ${width}×${height}`);
        assert.ok(Math.abs(p.x * m.detailScale) < m.worldW * 0.45);
      }
    }
  }
});

test("shaped faces and sewn silhouettes produce finite geometry with real depth for every kind", () => {
  const m = computeMetrics(1170, 660);
  for (const kind of kinds) {
    const geometry = createGarmentGeometries(m, kind);
    try {
      for (const mesh of Object.values(geometry)) {
        assert.ok(Array.from(mesh.attributes.position.array).every(Number.isFinite));
        assert.ok(Array.from(mesh.attributes.normal.array).every(Number.isFinite));
      }
      assert.ok(geometry.edge.index && geometry.edge.index.count > 100);
      const front = garmentPoint(m, 500, 600, 1);
      const back = garmentPoint(m, 500, 600, -1);
      assert.equal(front.x, back.x);
      assert.equal(front.y, back.y);
      assert.ok(front.z - back.z > m.garmentW * 0.05);
      assert.ok(geometry.front.attributes.position.count > 2000);
    } finally {
      disposeGarmentGeometries(geometry);
    }
  }
});

test("the hook rests on the rail and remains seated through the allowed sway", () => {
  const m = computeMetrics(1170, 660);
  const contactY = m.hookCy + m.hookR - m.hookTube;
  assert.ok(Math.abs(contactY - m.railRadius) < 1e-8);
  for (const roll of [-MOTION.swayMax, 0, MOTION.swayMax]) {
    const contact = new THREE.Vector3(0, contactY, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), roll);
    contact.add(new THREE.Vector3(m.railRadius * Math.sin(roll), m.railY + m.railRadius * (1 - Math.cos(roll)), 0));
    assert.ok(Math.abs(contact.x) < 1e-8);
    assert.ok(Math.abs(contact.y - m.railY - m.railRadius) < 1e-8);
  }
});

test("fabric follows movement then becomes still, including a stationary pointer on an open garment", () => {
  const state = createFabricState();
  const uniforms = createFabricUniforms(0);
  const target = { press: 1, cursor: new THREE.Vector2(0.1, -1), hover: 1, yawVelocity: 3, slideVelocity: 2 };
  for (let i = 0; i < 60; i++) stepFabric(state, uniforms, target, 1 / 60, 4);
  assert.ok(state.wave > 0 && state.sway > 0);
  let moving = true;
  for (let i = 0; i < 600; i++) moving = stepFabric(state, uniforms, { ...target, yawVelocity: 0, slideVelocity: 0 }, 1 / 60, 4);
  assert.equal(moving, false);
  assert.equal(state.press, 0);
  assert.equal(state.hover, 0);
});
