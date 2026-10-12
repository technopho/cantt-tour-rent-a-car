/**
 * Device capability checks (client only, tiny, no dependencies).
 *
 *   import { canRun3D, prefersReducedMotion } from "@/scripts/capabilities";
 *   if (canRun3D()) import("@/scripts/hero3d").then((m) => m.start(canvas));
 */

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}

const nav = (): NavigatorWithHints | undefined => (typeof navigator === "undefined" ? undefined : (navigator as NavigatorWithHints));
const mq = (query: string): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;

/** User asked the OS for less motion. */
export function prefersReducedMotion(): boolean {
  return mq("(prefers-reduced-motion: reduce)");
}

/** Primary input is touch (phones, tablets). */
export function isTouch(): boolean {
  return mq("(hover: none) and (pointer: coarse)") || (mq("(pointer: coarse)") && !mq("(pointer: fine)"));
}

/** Mouse or trackpad with hover (desktop). */
export function hasFinePointer(): boolean {
  return mq("(hover: hover) and (pointer: fine)");
}

/** Data Saver / Lite mode or a very slow connection. */
export function saveData(): boolean {
  const c = nav()?.connection;
  return c?.saveData === true || /(^|-)2g$/.test(c?.effectiveType ?? "") || mq("(prefers-reduced-data: reduce)");
}

let webgl2Cache: boolean | null = null;

/** WebGL2 is available (the probe context is released immediately). */
export function supportsWebGL2(): boolean {
  if (webgl2Cache !== null) return webgl2Cache;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true });
    webgl2Cache = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
}

/**
 * 3D gate (DESIGN.md / ARCHITECTURE.md): fine-pointer desktop only, deviceMemory >= 4 GB,
 * hardwareConcurrency >= 4, no reduced motion, no Save-Data, WebGL2 available.
 * Phones and tablets (primary pointer coarse / no hover) never get the WebGL scene: field performance
 * on mid-range Android matters more than the effect, so they keep the static poster plus the CSS/GSAP
 * motion. Touchscreen laptops still pass, because their primary pointer is the mouse or trackpad.
 * Browsers that hide deviceMemory (Safari, Firefox) pass that single check; the others still apply.
 */
export function canRun3D(): boolean {
  const n = nav();
  if (!n) return false;
  if (isTouch() || !hasFinePointer()) return false;
  if (prefersReducedMotion() || saveData()) return false;
  if (typeof n.deviceMemory === "number" && n.deviceMemory < 4) return false;
  if ((n.hardwareConcurrency ?? 0) < 4) return false;
  return supportsWebGL2();
}

/** Lenis gate: fine pointer desktop, no reduced motion, viewport >= 1024px. */
export function canSmoothScroll(): boolean {
  return hasFinePointer() && !isTouch() && !prefersReducedMotion() && mq("(min-width: 64rem)");
}

/** Run `fn` when the browser is idle (falls back to a timeout). */
export function whenIdle(fn: () => void, timeout = 2000): void {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) window.requestIdleCallback(() => fn(), { timeout });
  else setTimeout(fn, 200);
}
