/**
 * GSAP + ScrollTrigger, loaded lazily and only where something is pinned, scrubbed or sequenced.
 * Simple reveals should use data-fx attributes (src/scripts/fx/index.ts) instead.
 *
 * Usage in a component <script>:
 *
 *   import { onPageAnimations } from "@/scripts/motion";
 *
 *   onPageAnimations(({ gsap, ScrollTrigger }) => {
 *     gsap.from(".garage-card", { y: 40, opacity: 0, stagger: 0.08, scrollTrigger: { trigger: ".garage", start: "top 75%" } });
 *     // optional: return a cleanup function for non-GSAP work (listeners, observers)
 *   }, { scope: "#garage" });
 *
 * - Everything created inside the callback lives in a gsap.context() and is reverted on
 *   astro:before-swap and pagehide (and re-initialised when the page is restored from bfcache).
 * - Under prefers-reduced-motion the callback is skipped unless { allowReducedMotion: true },
 *   so elements stay in their final static state. Never hide content with CSS waiting for GSAP.
 */
import { announceGsap } from "./scroll-bus";

type Gsap = typeof import("gsap").gsap;
type ScrollTriggerType = typeof import("gsap/ScrollTrigger").ScrollTrigger;

export interface MotionContext {
  gsap: Gsap;
  ScrollTrigger: ScrollTriggerType;
  /** true when the user prefers reduced motion (only reachable with allowReducedMotion). */
  reducedMotion: boolean;
}

export interface PageAnimationOptions {
  /** Limit selector text to this element (passed to gsap.context). */
  scope?: Element | string | null;
  /** Run even when the user prefers reduced motion (keep it to opacity, no movement). */
  allowReducedMotion?: boolean;
}

type InitFn = (ctx: MotionContext) => void | (() => void);

let loaded: Promise<{ gsap: Gsap; ScrollTrigger: ScrollTriggerType }> | null = null;

/** Lazy-load GSAP + ScrollTrigger once (registers the plugin, syncs Lenis if running). */
export function loadGsap(): Promise<{ gsap: Gsap; ScrollTrigger: ScrollTriggerType }> {
  loaded ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([g, st]) => {
    const gsap = g.gsap;
    const ScrollTrigger = st.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: "expo.out", duration: 1.2 }); // Slow and heavy, DESIGN.md.
    announceGsap(gsap, ScrollTrigger); // lets Lenis (if running) switch to gsap.ticker
    // Fonts change layout metrics; recalculate trigger positions once they are ready.
    document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
    return { gsap, ScrollTrigger };
  });
  return loaded;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Initialise page animations with automatic cleanup. Resolves to a function that tears them down.
 */
export async function onPageAnimations(init: InitFn, options: PageAnimationOptions = {}): Promise<() => void> {
  if (reducedMotion() && !options.allowReducedMotion) return () => {};

  const { gsap, ScrollTrigger } = await loadGsap();
  let ctx: ReturnType<Gsap["context"]> | null = null;
  let userCleanup: void | (() => void);

  const start = () => {
    const scope = typeof options.scope === "string" ? document.querySelector(options.scope) : options.scope;
    if (options.scope && !scope) return; // scope not on this page
    ctx = gsap.context(() => {
      userCleanup = init({ gsap, ScrollTrigger, reducedMotion: reducedMotion() });
    }, scope ?? undefined);
  };

  const stop = () => {
    if (typeof userCleanup === "function") userCleanup();
    userCleanup = undefined;
    ctx?.revert();
    ctx = null;
  };

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted && !ctx) {
      start();
      ScrollTrigger.refresh();
    }
  };

  start();
  document.addEventListener("astro:before-swap", stop, { once: true });
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", onPageShow);

  return () => {
    stop();
    window.removeEventListener("pagehide", stop);
    window.removeEventListener("pageshow", onPageShow);
  };
}
