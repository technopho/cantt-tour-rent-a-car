/**
 * Lenis smooth scroll: fine-pointer desktop only, never on touch, never with reduced motion.
 * Loaded lazily by the BaseLayout bootstrap (on idle), so phones never download Lenis.
 *
 * Runs its own rAF loop until GSAP is loaded (motion.ts announces it via scroll-bus.ts); then Lenis
 * is driven by gsap.ticker and ScrollTrigger updates on every Lenis scroll (one clock, no jitter).
 *
 *   import { startSmoothScroll, stopSmoothScroll, resumeSmoothScroll, scrollToTarget } from "@/scripts/smooth-scroll";
 *
 * Elements that need native wheel scrolling (modals, maps, horizontal lists) can opt out with
 * data-lenis-prevent. Other scripts can pause scrolling with
 * window.dispatchEvent(new CustomEvent("cantt:scroll-lock", { detail: { locked: true } })).
 */
import Lenis from "lenis";
import { canSmoothScroll } from "./capabilities";
import { whenGsap } from "./scroll-bus";

type Gsap = typeof import("gsap").gsap;
type ScrollTriggerType = typeof import("gsap/ScrollTrigger").ScrollTrigger;

let lenis: Lenis | null = null;
let rafId = 0;
let gsapTick: ((time: number) => void) | null = null;
let gsapRef: Gsap | null = null;

function ownLoop(time: number) {
  lenis?.raf(time);
  rafId = requestAnimationFrame(ownLoop);
}

function onScrollLock(event: Event) {
  const locked = (event as CustomEvent<{ locked: boolean }>).detail?.locked;
  if (locked) lenis?.stop();
  else lenis?.start();
}

/** Start Lenis if the device qualifies. Returns the instance or null. Idempotent. */
export function startSmoothScroll(): Lenis | null {
  if (lenis) return lenis;
  if (!canSmoothScroll()) return null;

  lenis = new Lenis({
    autoRaf: false,
    lerp: 0.11,
    wheelMultiplier: 0.95,
    smoothWheel: true,
    syncTouch: false,
    anchors: { offset: -80 },
    prevent: (node) => node instanceof HTMLElement && (node.closest("dialog[open]") !== null || node.hasAttribute("data-lenis-prevent")),
  });

  rafId = requestAnimationFrame(ownLoop);
  window.addEventListener("cantt:scroll-lock", onScrollLock);
  window.addEventListener("pagehide", destroySmoothScroll, { once: true });
  whenGsap(syncWithGsap);
  return lenis;
}

/** Drive Lenis from gsap.ticker and keep ScrollTrigger in sync (wired automatically via scroll-bus). */
export function syncWithGsap(gsap: Gsap, ScrollTrigger: ScrollTriggerType): void {
  if (!lenis || gsapTick) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
  gsapRef = gsap;
  gsapTick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(gsapTick);
  gsap.ticker.lagSmoothing(0);
  lenis.on("scroll", ScrollTrigger.update);
}

export function getLenis(): Lenis | null {
  return lenis;
}

export function stopSmoothScroll(): void {
  lenis?.stop();
}

export function resumeSmoothScroll(): void {
  lenis?.start();
}

/** Smooth-scroll to an element, selector or y position (falls back to native scrolling). */
export function scrollToTarget(target: string | HTMLElement | number, offset = -80): void {
  if (lenis) {
    lenis.scrollTo(target, { offset });
    return;
  }
  const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : typeof target === "number" ? null : target;
  const top = typeof target === "number" ? target : el ? el.getBoundingClientRect().top + window.scrollY + offset : 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
}

export function destroySmoothScroll(): void {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  if (gsapRef && gsapTick) gsapRef.ticker.remove(gsapTick);
  gsapTick = null;
  gsapRef = null;
  window.removeEventListener("cantt:scroll-lock", onScrollLock);
  lenis?.destroy();
  lenis = null;
}
