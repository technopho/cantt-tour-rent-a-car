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
 * data-lenis-prevent or data-lenis-prevent-wheel. An opted-out element only keeps the gestures it can use:
 * a vertical wheel over a horizontal table goes on scrolling the page (passWheelThrough below).
 * Other scripts can pause scrolling with
 * window.dispatchEvent(new CustomEvent("cantt:scroll-lock", { detail: { locked: true } })).
 */
import Lenis from "lenis";
import { afterPreloader, canSmoothScroll } from "./capabilities";
import { whenGsap } from "./scroll-bus";

type Gsap = typeof import("gsap").gsap;
type ScrollTriggerType = typeof import("gsap/ScrollTrigger").ScrollTrigger;

let lenis: Lenis | null = null;
let rafId = 0;
let gsapTick: ((time: number) => void) | null = null;
let gsapRef: Gsap | null = null;

const OPTED_OUT = "[data-lenis-prevent], [data-lenis-prevent-wheel]";

/** This element, or one of its ancestors, can still move vertically in the wheel's direction. */
function canScrollVertically(from: Element, deltaY: number): boolean {
  for (let el: Element | null = from; el && el !== document.body; el = el.parentElement) {
    const { overflowY } = getComputedStyle(el);
    if (overflowY !== "auto" && overflowY !== "scroll") continue;
    if (deltaY > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 1) return true;
  }
  return false;
}

/**
 * Lenis gives up on any wheel event that starts inside an opted-out element, so a vertical wheel over a
 * horizontal table had nothing to scroll and the page stopped dead. When the element under the cursor cannot
 * use the gesture, the page takes it through Lenis, with the same easing as everywhere else.
 * Returns false when it has handled the event. Sideways wheels, Shift+wheel and open dialogs stay native.
 */
function passWheelThrough({ deltaX, deltaY, event }: { deltaX: number; deltaY: number; event: Event }): boolean {
  if (!(event instanceof WheelEvent) || !lenis || lenis.isStopped) return true;
  if (event.ctrlKey || event.shiftKey || Math.abs(deltaY) <= Math.abs(deltaX)) return true;
  const target = event.target;
  const box = target instanceof Element ? target.closest<HTMLElement>(OPTED_OUT) : null;
  if (!box || box.closest("dialog[open]")) return true;
  // A popup list that really scrolls and asks for containment keeps it at its ends.
  if (getComputedStyle(box).overscrollBehaviorY === "contain" && box.scrollHeight > box.clientHeight) return true;
  if (canScrollVertically(box === target ? box : (target as Element), deltaY)) return true;
  if (event.cancelable) event.preventDefault();
  lenis.scrollTo(lenis.targetScroll + deltaY, { programmatic: false, lerp: lenis.options.lerp });
  return false;
}

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
    lerp: 0.09,
    wheelMultiplier: 0.95,
    smoothWheel: true,
    syncTouch: false,
    anchors: { offset: -80 },
    virtualScroll: passWheelThrough,
    prevent: (node) => node instanceof HTMLElement && (node.closest("dialog[open]") !== null || node.hasAttribute("data-lenis-prevent")),
  });

  // The preloader holds the page: stay stopped until it is gone.
  if (!window.__canttPreloaderDone) {
    lenis.stop();
    afterPreloader(() => lenis?.start());
  }

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
