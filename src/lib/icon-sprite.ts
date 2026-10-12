/**
 * Per-page SVG sprite for build-time icons.
 *
 * Icon.astro registers every icon a page uses and renders `<svg><use href="#i-ph-..."/></svg>`;
 * src/middleware.ts then emits each registered icon ONCE per page as a <symbol> right after <body>.
 * A page that repeats the same Phosphor path in every car card (home, /cars/) ships it once instead
 * of dozens of times. Vectors and viewBoxes are unchanged, so icons stay crisp, and accessibility
 * attributes stay on the outer <svg> (role="img" + aria-label, or aria-hidden).
 *
 * No node:fs here (the middleware is also bundled into the on-demand Worker); icon data comes in
 * from Icon.astro, which resolves it at build time with getIcon().
 */
import type { RenderedIcon } from "./icons";

/** Keyed by the request's `locals` object, so pages rendered in parallel never mix their sprites. */
const registries = new WeakMap<object, Map<string, RenderedIcon>>();

/** "ph:car-profile" -> "i-ph-car-profile" (valid, readable id). */
export function iconSymbolId(name: string): string {
  return `i-${name.replace(/[^a-z0-9-]+/gi, "-")}`;
}

/** Register an icon for this page's sprite and return the symbol id to reference with <use>. */
export function useSpriteIcon(locals: object, name: string, icon: RenderedIcon): string {
  let registry = registries.get(locals);
  if (!registry) {
    registry = new Map();
    registries.set(locals, registry);
  }
  if (!registry.has(name)) registry.set(name, icon);
  return iconSymbolId(name);
}

/** The sprite markup for this page ("" when the page used no icons). Clears the registry. */
export function takeSprite(locals: object): string {
  const registry = registries.get(locals);
  if (!registry || registry.size === 0) return "";
  registries.delete(locals);
  const symbols = [...registry.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, { body, viewBox }]) => `<symbol id="${iconSymbolId(name)}" viewBox="${viewBox}">${body}</symbol>`)
    .join("");
  // Not display:none: <use> of symbols inside display:none can lose gradients/masks in some engines.
  return `<svg aria-hidden="true" focusable="false" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden">${symbols}</svg>`;
}
