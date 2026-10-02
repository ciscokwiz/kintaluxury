import { MOTION } from "@/lib/motion";
import { CAM_Z } from "./useRackLayout";

/**
 * Integrate a damped spring (mass 1) in fixed sub-steps:
 *   a = k·(target − x) − c·v
 * `obj[key]` is the value, `obj[vel]` its velocity.
 */
export function springStep<T extends Record<K | V, number>, K extends string, V extends string>(
  obj: T,
  key: K,
  vel: V,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
) {
  let x = obj[key] as number;
  let v = obj[vel] as number;
  let t = dt;
  while (t > 1e-6) {
    const h = Math.min(MOTION.subStep, t);
    const a = stiffness * (target - x) - damping * v;
    v += a * h;
    x += v * h;
    t -= h;
  }
  (obj as Record<string, number>)[key] = x;
  (obj as Record<string, number>)[vel] = v;
}

/** Frame-rate independent exponential damping (maath-style). */
export function damp(current: number, target: number, lambda: number, dt: number) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/** 0 = at rest yaw (side-on), 1 = facing the viewer. May overshoot slightly. */
export function facingOf(yaw: number, restYaw: number) {
  return Math.max(0, Math.min(1.05, 1 - yaw / restYaw));
}

/**
 * Yaw actually applied to a garment hanging at world x. Garments left of
 * centre are seen slightly from their front, right of centre from their
 * side, so the resting yaw is corrected by the viewing angle to keep every
 * resting garment showing the same sliver. Fades out as it turns to face front.
 */
export function renderYaw(yaw: number, restYaw: number, worldX: number) {
  const k = Math.max(0, Math.min(1, yaw / restYaw));
  // half the viewing angle: the panel's own depth already widens off-centre garments
  return yaw + Math.atan2(-worldX, CAM_Z) * 0.5 * k;
}
