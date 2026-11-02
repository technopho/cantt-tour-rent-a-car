/**
 * Quality gate for the home page's heavier pieces (no three.js in here, so it can run before anything loads):
 * the WebGL terrain of The Road North and the extra light effects of the opening.
 *
 *   high      desktop: DPR up to 1.75, full particle count, every light effect
 *   low       phones and tablets: DPR up to 1.5, fewer particles, every light effect
 *   fallback  no WebGL2, Save-Data, reduced motion or under 3 GB of memory: The Road North is a plain list,
 *             and the opening keeps its frames and wipes but drops the sweeping light bands and flowing trails
 *
 * Phones DO get the WebGL. `?tier=high|low|fallback` overrides the result, for testing only.
 */
export type Tier = "high" | "low" | "fallback";

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

const mq = (query: string) => window.matchMedia(query).matches;

/** "fast" on a real GPU, "slow" when only a software renderer is on offer (or the GPU is briefly busy), else none. */
function webGL2(): "fast" | "slow" | null {
  const probe = (strict: boolean) => {
    try {
      const gl = document.createElement("canvas").getContext("webgl2", { failIfMajorPerformanceCaveat: strict });
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return Boolean(gl);
    } catch {
      return false;
    }
  };
  if (probe(true)) return "fast";
  return probe(false) ? "slow" : null;
}

let cached: Tier | null = null;

export function getTier(): Tier {
  if (cached) return cached;
  const forced = new URLSearchParams(window.location.search).get("tier");
  if (forced === "high" || forced === "low" || forced === "fallback") return (cached = forced);

  const nav = navigator as NavigatorWithHints;
  if (nav.connection?.saveData || mq("(prefers-reduced-data: reduce)")) return (cached = "fallback");
  if (mq("(prefers-reduced-motion: reduce)")) return (cached = "fallback");
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 3) return (cached = "fallback");
  const gl = webGL2();
  if (!gl) return (cached = "fallback");
  // The strict check fails now and then on a healthy machine, so a "slow" answer still flies, at low quality.
  if (gl === "slow") return (cached = "low");

  const desktop = mq("(hover: hover) and (pointer: fine)") && mq("(min-width: 64rem)");
  const strong = (nav.hardwareConcurrency ?? 4) >= 4 && (nav.deviceMemory ?? 8) >= 4;
  return (cached = desktop && strong ? "high" : "low");
}
