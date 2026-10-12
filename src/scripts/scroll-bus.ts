/**
 * Tiny dependency-free meeting point between motion.ts (GSAP) and smooth-scroll.ts (Lenis), so
 * neither has to import the other: pages with GSAP do not pull Lenis onto phones, and Lenis does
 * not pull GSAP onto pages without animations.
 */
type Gsap = typeof import("gsap").gsap;
type ScrollTriggerType = typeof import("gsap/ScrollTrigger").ScrollTrigger;
type Listener = (gsap: Gsap, scrollTrigger: ScrollTriggerType) => void;

let current: { gsap: Gsap; ScrollTrigger: ScrollTriggerType } | null = null;
const listeners = new Set<Listener>();

/** Called by motion.ts once GSAP + ScrollTrigger are loaded and registered. */
export function announceGsap(gsap: Gsap, scrollTrigger: ScrollTriggerType): void {
  current = { gsap, ScrollTrigger: scrollTrigger };
  listeners.forEach((fn) => fn(gsap, scrollTrigger));
  listeners.clear();
}

/** Run `fn` as soon as GSAP is available (immediately if it already is). */
export function whenGsap(fn: Listener): void {
  if (current) fn(current.gsap, current.ScrollTrigger);
  else listeners.add(fn);
}
