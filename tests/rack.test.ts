import { test } from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS, COUNT, RACK_PRODUCTS, RACK_INDICES, rackIndexOf } from "../lib/products";
import { useStore } from "../lib/store";
import { computeMetrics, detailMetrics, layoutRack } from "../components/three/useRackLayout";
import { createGarmentGeometries, disposeGarmentGeometries } from "../components/three/Garment";
import { springStep } from "../components/three/physics";
import { MOTION } from "../lib/motion";
import { createFabricState, createFabricUniforms, stepFabric } from "../components/three/fabric";

test("seven designs share rack slots with all ten selectable colorways", () => {
  assert.equal(RACK_PRODUCTS.length, 7);
  assert.equal(COUNT, 10);
  assert.equal(new Set(RACK_PRODUCTS.map((product) => product.groupId)).size, 7);
  for (const product of PRODUCTS) assert.equal(PRODUCTS[rackIndexOf(product.index)].groupId, product.groupId);
});

test("opening every design keeps its neighbors ordered and inside the rail", () => {
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568]]) {
    const m = computeMetrics(width, height);
    for (const anchor of RACK_INDICES) {
      const facing = new Array(COUNT).fill(0); facing[anchor] = 1;
      const positions = layoutRack(m, facing, anchor, new Array(COUNT).fill(0));
      for (let i = 0; i < RACK_INDICES.length; i++) {
        const x = positions[RACK_INDICES[i]];
        assert.ok(Number.isFinite(x) && x >= m.railLeft && x <= m.railRight);
        if (i > 0) assert.ok(x > positions[RACK_INDICES[i - 1]], `Neighbors overlap at ${width}px`);
      }
      for (const product of PRODUCTS) assert.equal(positions[product.index], positions[rackIndexOf(product.index)]);
    }
  }
});

test("every garment fits the portrait detail view and has supported collar and depth", () => {
  for (const [width, height] of [[1440, 900], [768, 1024], [390, 844], [320, 568]]) {
    const m = computeMetrics(width, height);
    assert.ok(m.shapes[3].garmentH > m.shapes[0].garmentH, "Hoodie and tee need distinct cuts");
    for (const product of PRODUCTS) {
      const anchor = detailMetrics(m, product.index);
      assert.ok(m.shapes[product.index].garmentW * anchor.scale <= m.worldW * 0.81);
      const geo = createGarmentGeometries(m, product);
      geo.collar.computeBoundingBox(); geo.hanger.computeBoundingBox();
      assert.ok(geo.hanger.boundingBox!.max.y > geo.collar.boundingBox!.max.y, "Hanger must be visible above the neckline");
      for (const part of Object.values(geo)) {
        const positions = part.getAttribute("position");
        for (let i = 0; i < positions.count; i++) assert.ok(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getY(i)) && Number.isFinite(positions.getZ(i)));
      }
      geo.sides.computeBoundingBox();
      assert.ok(geo.sides.boundingBox!.max.z - geo.sides.boundingBox!.min.z > m.shapes[product.index].layer, "Side fabric must have visible depth");
      disposeGarmentGeometries(geo);
    }
  }
});

test("color choices survive closing, reopening and navigating between designs", () => {
  useStore.setState({ mode: "rack", active: null, rackVariants: {}, navTick: 0 });
  useStore.getState().open(2); useStore.getState().setMode("detail"); useStore.getState().selectVariant(7);
  assert.equal(useStore.getState().active, 7);
  useStore.getState().close(); useStore.getState().setMode("rack"); useStore.getState().open(2);
  assert.equal(useStore.getState().active, 7);
  useStore.getState().setMode("detail"); useStore.getState().go(1);
  assert.equal(useStore.getState().active, 3);
  useStore.getState().selectVariant(8); useStore.getState().go(1); useStore.getState().go(-1);
  assert.equal(useStore.getState().active, 8);
  useStore.getState().selectVariant(7);
  assert.equal(useStore.getState().active, 8, "A swatch cannot select an unrelated design");
  useStore.setState({ mode: "rack", active: null, rackVariants: {}, navTick: 0 });
});

test("turning and sliding settle without overshoot at 60 and 120 frames per second", () => {
  for (const rate of [60, 120]) for (const spring of [MOTION.swivel, MOTION.slide]) {
    const state = { x: 1, v: 0 };
    let previous = state.x;
    for (let i = 0; i < rate * 2; i++) {
      springStep(state, "x", "v", 0, spring.stiffness, spring.damping, 1 / rate);
      assert.ok(state.x >= -1e-6 && state.x <= previous + 1e-6);
      previous = state.x;
    }
    assert.ok(Math.abs(state.x) < 0.001 && Math.abs(state.v) < 0.001);
  }
});

test("settled cloth stays still under a stationary pointer", () => {
  const state = createFabricState();
  state.press = 1;
  state.hover = 1;
  state.hasCursor = true;
  assert.equal(stepFabric(state, createFabricUniforms(0), {
    press: 1, hover: 1, cursor: state.cursor.clone(), yawVelocity: 0, slideVelocity: 0,
  }, 1 / 60, 3), false);
});
