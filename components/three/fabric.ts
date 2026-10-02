import * as THREE from "three";
import { FABRIC } from "@/lib/motion";
import type { RackMetrics } from "./useRackLayout";
import { damp } from "./physics";

/* ------------------------------------------------------------------------
 * Cloth micro-motion.
 *
 * The garment panels are displaced in the vertex shader (both panels by the
 * same function, so front and back move together) and their normals are
 * re-derived from the displacement, so folds catch the light:
 *
 *   press   a soft dent where the pointer touches, with a ring spreading out
 *   drag    the cloth under the pointer is pulled along with the hand
 *   breathe slow billowing while a garment is hovered (and faintly for
 *           neighbours the pointer passes)
 *   wave    a twist that travels down from the shoulders while it swivels
 *   sway    the hem trails the hanger when it slides along the rail
 *
 * Shoulders are pinned (the hanger holds them), the hem moves the most.
 * Everything is zero at rest: no idle motion.
 * --------------------------------------------------------------------- */

/** Shared by every garment in both canvases; the tuning panel writes these. */
export const fabricGlobals = {
  uTime: { value: 0 },
  uEnabled: { value: 1 },
  uAmpPress: { value: FABRIC.press },
  uAmpRipple: { value: FABRIC.ripple },
  uAmpBreathe: { value: FABRIC.breathe },
  uAmpWave: { value: FABRIC.wave },
  uAmpSway: { value: FABRIC.sway },
  uAmpDrag: { value: FABRIC.drag },
  uRadius: { value: FABRIC.radius },
  uDepth: { value: FABRIC.depth },
};

/** Copy FABRIC (after the tuning panel changed it) into the shader uniforms. */
export function syncFabricGlobals(reduced: boolean) {
  fabricGlobals.uEnabled.value = FABRIC.enabled && !reduced ? 1 : 0;
  fabricGlobals.uAmpPress.value = FABRIC.press;
  fabricGlobals.uAmpRipple.value = FABRIC.ripple;
  fabricGlobals.uAmpBreathe.value = FABRIC.breathe;
  fabricGlobals.uAmpWave.value = FABRIC.wave;
  fabricGlobals.uAmpSway.value = FABRIC.sway;
  fabricGlobals.uAmpDrag.value = FABRIC.drag;
  fabricGlobals.uRadius.value = FABRIC.radius;
  fabricGlobals.uDepth.value = FABRIC.depth;
}

/** Per panel: which side it bulges to and the garment's volume map. */
export interface PanelUniforms {
  uVolume: { value: THREE.Texture };
  uSide: { value: number };
  uFlipU: { value: number };
}

export function createPanelUniforms(volume: THREE.Texture, panel: "front" | "back"): PanelUniforms {
  return {
    uVolume: { value: volume },
    uSide: { value: panel === "front" ? 1 : -1 },
    // the back panel's U is mirrored; the volume map is indexed by the front's U
    uFlipU: { value: panel === "front" ? 0 : 1 },
  };
}

export interface FabricUniforms {
  uCursor: { value: THREE.Vector2 };
  uDrag: { value: THREE.Vector2 };
  uPress: { value: number };
  uHover: { value: number };
  uWave: { value: number };
  uSway: { value: number };
  uSeed: { value: number };
  uTop: { value: number };
  uH: { value: number };
  uW: { value: number };
  uLayer: { value: number };
}

/** One per garment, shared by its front and back panel so they move as one. */
export function createFabricUniforms(seed: number): FabricUniforms {
  return {
    uCursor: { value: new THREE.Vector2(0, 0) },
    uDrag: { value: new THREE.Vector2(0, 0) },
    uPress: { value: 0 },
    uHover: { value: 0 },
    uWave: { value: 0 },
    uSway: { value: 0 },
    uSeed: { value: seed },
    uTop: { value: 0 },
    uH: { value: 1 },
    uW: { value: 1 },
    uLayer: { value: 0 },
  };
}

export function setFabricFrame(u: FabricUniforms, m: RackMetrics) {
  u.uTop.value = m.hangerTop;
  u.uH.value = m.garmentH;
  u.uW.value = m.garmentW;
  u.uLayer.value = m.layer;
}

const VERTEX_HEAD = /* glsl */ `
uniform float uTime, uEnabled;
uniform float uAmpPress, uAmpRipple, uAmpBreathe, uAmpWave, uAmpSway, uAmpDrag, uRadius, uDepth;
uniform vec2 uCursor, uDrag;
uniform float uPress, uHover, uWave, uSway, uSeed, uTop, uH, uW, uLayer;
uniform sampler2D uVolume;
uniform float uSide, uFlipU;

// body: front and back panels bulge apart over the garment's volume map and meet at its outline
float kintaBody(vec2 g) {
  float h = texture2D(uVolume, g).r;
  return uSide * (uLayer * (0.12 + 0.88 * smoothstep(0.0, 0.3, h)) + uDepth * uW * h);
}

vec3 kintaFabric(vec2 p) {
  float down = clamp((uTop - p.y) / uH, 0.0, 1.0);   // 0 at the shoulders, 1 at the hem
  float pin = smoothstep(0.03, 0.34, down);           // the hanger holds the shoulders
  float u = p.x / uW;

  // pointer: soft dent + a ring spreading out from it
  vec2 d = (p - uCursor) / uW;
  float r2 = dot(d, d);
  float sig = max(uRadius, 0.02);
  float g = exp(-r2 / (2.0 * sig * sig));
  float r = sqrt(r2);
  float dent = -uAmpPress * uPress * g;
  float ring = uAmpRipple * uPress * sin(r * 22.0 - uTime * 7.0) * exp(-r / (sig * 1.8));

  // hover: the cloth breathes as if air moves through it
  float br = uAmpBreathe * uHover * (
      0.6 * sin(uTime * 1.5 + u * 5.0 + down * 4.0 + uSeed)
    + 0.4 * sin(uTime * 2.6 - u * 9.0 + down * 7.5 + uSeed * 2.3));

  // swivel: a twist travelling down from the shoulders
  float wave = uAmpWave * uWave * sin(down * 7.0 - uTime * 9.0) * u * 2.0;

  // sway: the hem trails the hanger
  float lag = down * down;
  float swayZ = uAmpSway * abs(uSway) * lag * (0.6 + 0.4 * sin(u * 6.0 + uTime * 5.0));
  float swayX = -uAmpSway * uSway * lag * 0.8;

  // drag: cloth under the hand follows it a little
  vec2 drag = uAmpDrag * uDrag * g;

  float z = (dent + ring + br + wave) * pin + swayZ;
  return uEnabled * uW * vec3(swayX + drag.x * pin, drag.y * pin * 0.5, z);
}
`;

/** Patch a MeshStandardMaterial so its panel moves like cloth. */
export function injectFabric(shader: THREE.WebGLProgramParametersWithUniforms, u: FabricUniforms, panel: PanelUniforms) {
  Object.assign(shader.uniforms, fabricGlobals, u, panel);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERTEX_HEAD}`)
    .replace(
      "#include <beginnormal_vertex>",
      /* glsl */ `
      vec3 kf = kintaFabric(position.xy);
      vec2 kg = vec2(mix(uv.x, 1.0 - uv.x, uFlipU), uv.y);
      kf.z += kintaBody(kg);
      float ke = 0.006 * uH;
      vec2 kduv = vec2(ke / uW, ke / uH);
      float kdx = (kintaFabric(position.xy + vec2(ke, 0.0)).z + kintaBody(kg + vec2(kduv.x, 0.0)) - kf.z) / ke;
      float kdy = (kintaFabric(position.xy + vec2(0.0, ke)).z + kintaBody(kg + vec2(0.0, kduv.y)) - kf.z) / ke;
      vec3 objectNormal = normalize(normal + vec3(-kdx, -kdy, 0.0));
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
      #endif`,
    )
    .replace("#include <begin_vertex>", "vec3 transformed = vec3(position) + kf;");
}

/* ------------------------------------------------------------------------
 * Per-garment cloth state, eased every frame toward what the pointer and the
 * garment's own motion ask for.
 * --------------------------------------------------------------------- */

export interface FabricTargets {
  /** pointer is on this garment */
  press: number;
  /** pointer position in the garment's local frame (only meaningful when press > 0) */
  cursor: THREE.Vector2 | null;
  hover: number;
  /** swivel speed (rad/s) */
  yawVelocity: number;
  /** slide speed along the rail (world units/s) */
  slideVelocity: number;
}

export interface FabricState {
  press: number;
  hover: number;
  wave: number;
  sway: number;
  cursor: THREE.Vector2;
  lastCursor: THREE.Vector2;
  drag: THREE.Vector2;
  hasCursor: boolean;
}

export function createFabricState(): FabricState {
  return {
    press: 0,
    hover: 0,
    wave: 0,
    sway: 0,
    cursor: new THREE.Vector2(),
    lastCursor: new THREE.Vector2(),
    drag: new THREE.Vector2(),
    hasCursor: false,
  };
}

const tmpDrag = new THREE.Vector2();

/** Ease the state toward the targets, write the uniforms. Returns true while still moving. */
export function stepFabric(s: FabricState, u: FabricUniforms, t: FabricTargets, dt: number, garmentW: number): boolean {
  if (t.cursor && t.press > 0) {
    if (!s.hasCursor) {
      s.cursor.copy(t.cursor);
      s.lastCursor.copy(t.cursor);
      s.hasCursor = true;
    }
    s.lastCursor.copy(s.cursor);
    s.cursor.x = damp(s.cursor.x, t.cursor.x, FABRIC.cursorLambda, dt);
    s.cursor.y = damp(s.cursor.y, t.cursor.y, FABRIC.cursorLambda, dt);
    // pointer speed in garment widths per second, clamped
    tmpDrag.subVectors(s.cursor, s.lastCursor).divideScalar(Math.max(dt, 1e-3) * garmentW);
    tmpDrag.clampLength(0, 2.5);
  } else {
    s.hasCursor = false;
    tmpDrag.set(0, 0);
  }
  s.drag.x = damp(s.drag.x, tmpDrag.x, 6, dt);
  s.drag.y = damp(s.drag.y, tmpDrag.y, 6, dt);
  s.press = damp(s.press, t.press, t.press > s.press ? 10 : 4, dt);
  s.hover = damp(s.hover, t.hover, t.hover > s.hover ? 4 : 2.2, dt);
  const waveT = Math.max(-1, Math.min(1, t.yawVelocity / 6));
  s.wave = damp(s.wave, Math.abs(waveT), Math.abs(waveT) > s.wave ? 14 : 2.5, dt);
  s.sway = damp(s.sway, Math.max(-1, Math.min(1, t.slideVelocity / 4)), 5, dt);

  u.uCursor.value.copy(s.cursor);
  u.uDrag.value.copy(s.drag);
  u.uPress.value = s.press;
  u.uHover.value = s.hover;
  u.uWave.value = s.wave;
  u.uSway.value = s.sway;

  const eps = 1e-3;
  return (
    Math.abs(s.press - t.press) > eps ||
    Math.abs(s.hover - t.hover) > eps ||
    s.wave > eps ||
    Math.abs(s.sway) > eps ||
    s.drag.lengthSq() > eps * eps ||
    s.hover > eps ||
    s.press > eps
  );
}

/* ------------------------------------------------------------------------
 * Pointer → garment-local coordinates (plane of the front panel).
 * --------------------------------------------------------------------- */

const ray = new THREE.Ray();
const inv = new THREE.Matrix4();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hit = new THREE.Vector3();
const raycaster = new THREE.Raycaster();

export function pointerOnGarment(
  camera: THREE.Camera,
  xPx: number,
  yPx: number,
  widthPx: number,
  heightPx: number,
  yawGroup: THREE.Object3D,
  m: RackMetrics,
  out: THREE.Vector2,
): boolean {
  ndc.set((xPx / widthPx) * 2 - 1, -(yPx / heightPx) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  inv.copy(yawGroup.matrixWorld).invert();
  ray.copy(raycaster.ray).applyMatrix4(inv);
  // roughly where the bulged front panel sits
  plane.constant = -(m.layer + FABRIC.depth * m.garmentW * 0.8);
  if (!ray.intersectPlane(plane, hit)) return false;
  out.set(hit.x, hit.y);
  const bottom = m.garmentCy - m.garmentH / 2;
  return Math.abs(hit.x) < m.garmentW * 0.46 && hit.y < m.hangerTop + m.lh(1) && hit.y > bottom;
}
