import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as THREE from "three";
import { PRODUCTS, getProductVariants } from "@/lib/products";
import { MOTION } from "@/lib/motion";
import { computeMetrics, detailPlacement, layoutRack } from "@/components/three/useRackLayout";
import { springStep } from "@/components/three/physics";
import { applyClothMotion, COLLAR_OFFSET, createClothMotion, MODEL_SHAPES, MORPH_NAMES, modelTextureUrls, modelUrl, stepClothMotion, type ModelKind } from "@/lib/garment-models";

const viewports = [[1170, 660], [1440, 900], [1024, 768], [768, 1024], [390, 844], [375, 667]];
const kinds: ModelKind[] = ["tee", "hoodie"];

test("all ten colorways remain independently available on the rack", () => {
  assert.equal(PRODUCTS.length, 10);
  assert.equal(new Set(PRODUCTS.map((p) => p.id)).size, 10);
  assert.equal(new Set(PRODUCTS.map((p) => p.groupId)).size, 5);
  assert.deepEqual(getProductVariants("track-hoodie").map((product) => product.colorName), ["Sky", "Peach", "Navy"]);
  assert.equal(PRODUCTS.find((product) => product.colorName === "Forest")?.kind, "tee");
  assert.equal(PRODUCTS.find((product) => product.colorName === "Onyx")?.id, "08", "saved color links retain their identity");
  assert.equal(PRODUCTS.find((product) => product.colorName === "Peach")?.id, "11");
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

test("both reviewed models fit above the controls, including the hoodie and its hanger on portrait screens", () => {
  for (const [width, height] of viewports) {
    const m = computeMetrics(width, height);
    for (const kind of kinds) {
      const fit = detailPlacement(m, kind);
      assert.ok(fit.y + m.hookTop * fit.scale <= m.y(15.5));
      const shape = MODEL_SHAPES[kind];
      const bottom = fit.y + (shape.bottom - shape.hook - COLLAR_OFFSET) * m.modelScale * fit.scale;
      const top = fit.y + (shape.top - shape.hook - COLLAR_OFFSET) * m.modelScale * fit.scale;
      assert.ok(bottom >= m.y(72), `${kind} crosses controls at ${width}×${height}`);
      assert.ok(top <= m.y(15.5));
      assert.ok(shape.width / 2 * m.modelScale * fit.scale < m.worldW * 0.45);
    }
  }
});

test("rack and detailed GLBs ship their PBR maps, UVs and matching motion controls", () => {
  for (const kind of kinds) {
    const counts: number[] = [];
    for (const lod of ["rack", "detail"] as const) {
      const bytes = readFileSync(join(process.cwd(), "public", modelUrl(kind, lod)));
      assert.equal(bytes.readUInt32LE(0), 0x46546c67);
      assert.equal(bytes.readUInt32LE(4), 2);
      assert.equal(bytes.readUInt32LE(8), bytes.length);
      const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
      assert.equal(gltf.asset.version, "2.0");
      assert.ok(gltf.extensionsRequired.includes("EXT_meshopt_compression"));
      assert.ok(gltf.images.every((image: { uri?: string; bufferView?: number }) => !image.uri && image.bufferView !== undefined));
      assert.ok(gltf.materials.some((material: { normalTexture?: unknown; occlusionTexture?: unknown }) => material.normalTexture && material.occlusionTexture));
      let triangles = 0;
      for (const mesh of gltf.meshes) {
        assert.deepEqual(mesh.extras.targetNames, [...MORPH_NAMES]);
        for (const primitive of mesh.primitives) {
          const material = gltf.materials[primitive.material];
          if (material.pbrMetallicRoughness?.baseColorTexture) assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
          assert.equal(primitive.targets.length, 4);
          triangles += gltf.accessors[primitive.indices].count / 3;
        }
      }
      assert.ok(gltf.animations.length >= 3);
      counts.push(triangles);
      if (lod === "detail") assert.ok(triangles >= 20000 && triangles <= 40000);
    }
    assert.ok(counts[0] < counts[1], "mobile/rack geometry is lighter");
  }
  for (const product of PRODUCTS) {
    assert.ok(existsSync(join(process.cwd(), "public", product.front)));
    assert.ok(existsSync(join(process.cwd(), "public", product.back!)));
    if (product.modelVariant === "liberty") continue;
    for (const lod of ["rack", "detail"] as const) for (const url of modelTextureUrls(product.modelVariant, lod)) {
      const bytes = readFileSync(join(process.cwd(), "public", url));
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
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

test("cloth trails the direction of movement, stays bounded, and settles completely after movement stops", () => {
  const state = createClothMotion();
  for (let i = 0; i < 60; i++) stepClothMotion(state, 3, -2, 5, 1 / 60, false);
  assert.ok(state.TurnClockwise > 0 && state.SlideRightLag > 0);
  assert.equal(state.TurnCounterclockwise, 0);
  assert.equal(state.SlideLeftLag, 0);
  for (let i = 0; i < 60; i++) stepClothMotion(state, -30, 40, 5, 1 / 60, false);
  assert.ok(Object.values(state).every((weight) => weight >= 0 && weight <= 1));
  let moving = true;
  for (let i = 0; i < 180; i++) moving = stepClothMotion(state, 0, 0, 5, 1 / 60, false);
  assert.equal(moving, false);
  assert.ok(Object.values(state).every((weight) => weight === 0));
  stepClothMotion(state, 30, 40, 5, 1 / 60, true);
  assert.ok(Object.values(state).every((weight) => weight === 0), "reduced motion suppresses deformation");
  const mesh = new THREE.Mesh();
  mesh.morphTargetDictionary = Object.fromEntries(MORPH_NAMES.map((name, index) => [name, index]));
  mesh.morphTargetInfluences = [0, 0, 0, 0];
  applyClothMotion([mesh], { ...state, TurnClockwise: 0.5 });
  assert.deepEqual(mesh.morphTargetInfluences, [0, 0, 0.5, 0]);
});

test("turning and cloth settling keep real time at low frame rates", () => {
  for (const rawDelta of [1 / 60, 1 / 15, 1 / 4]) {
    const garment = { yaw: 1.35, velocity: 0 };
    const cloth = createClothMotion();
    cloth.TurnClockwise = 1;
    for (let elapsed = 0; elapsed < 3; elapsed += rawDelta) {
      const dt = Math.min(rawDelta, MOTION.maxDelta);
      springStep(garment, "yaw", "velocity", 0, MOTION.swivel.stiffness, MOTION.swivel.damping, dt);
      stepClothMotion(cloth, garment.velocity, 0, 5, dt, false);
    }
    assert.ok(Math.abs(garment.yaw) < 0.0001 && Math.abs(garment.velocity) < 0.0001, `spring still moving at ${1 / rawDelta} fps`);
    assert.ok(Object.values(cloth).every((weight) => weight === 0), `cloth still moving at ${1 / rawDelta} fps`);
  }
});
