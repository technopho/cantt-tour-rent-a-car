/**
 * Device capability checks (client only, tiny, no dependencies).
 *
 *   import { hasFinePointer, prefersReducedMotion } from "@/scripts/capabilities";
 *
 * The quality gate for the home page's WebGL terrain and heavier motion lives in src/scripts/tier.ts.
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

/** Lenis gate: fine pointer desktop, no reduced motion, viewport >= 1024px. */
export function canSmoothScroll(): boolean {
  return hasFinePointer() && !isTouch() && !prefersReducedMotion() && mq("(min-width: 64rem)");
}

declare global {
  interface Window {
    __canttPreloaderDone?: boolean;
    __canttPreloaderParting?: boolean;
  }
}

/** Run `fn` once the preloader is gone (immediately if it already is, or if it was skipped). */
export function afterPreloader(fn: () => void): void {
  if (window.__canttPreloaderDone) fn();
  else window.addEventListener("cantt:preloader-done", fn, { once: true });
}

/** Run `fn` as the preloader's doors start to open: the moment to begin an entrance. */
export function whenPreloaderParts(fn: () => void): void {
  if (window.__canttPreloaderParting || window.__canttPreloaderDone) fn();
  else window.addEventListener("cantt:preloader-parting", fn, { once: true });
}

/** Run `fn` when the browser is idle (falls back to a timeout). */
export function whenIdle(fn: () => void, timeout = 2000): void {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) window.requestIdleCallback(() => fn(), { timeout });
  else setTimeout(fn, Math.min(200, timeout));
}
