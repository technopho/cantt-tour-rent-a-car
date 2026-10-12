/**
 * Build-time icon rendering from Iconify JSON (Phosphor "ph:*" and brand marks "simple-icons:*").
 * Icons become inline SVG in the prerendered HTML: zero client JS, zero icon requests.
 *
 * Server/build only (reads JSON with node:fs). For a Svelte island, render the SVG string in the
 * .astro parent with `iconSvg("ph:check")` and pass it as a prop ({@html svg}).
 *
 * Phosphor rule (DESIGN.md): use the "regular" weight only, i.e. names without a -bold/-fill/-light suffix.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { getIconData, iconToHTML, iconToSVG, replaceIDs } from "@iconify/utils";

type IconifyJSON = Parameters<typeof getIconData>[0];

const SETS = {
  ph: "@iconify-json/ph/icons.json",
  "simple-icons": "@iconify-json/simple-icons/icons.json",
} as const;

export type IconPrefix = keyof typeof SETS;
/** "ph:car-profile" | "simple-icons:whatsapp" | ... */
export type IconName = `${IconPrefix}:${string}`;

const cache = new Map<IconPrefix, IconifyJSON>();

function readSet(prefix: IconPrefix): IconifyJSON {
  const cached = cache.get(prefix);
  if (cached) return cached;
  const specifier = SETS[prefix];
  let file: string;
  try {
    file = createRequire(import.meta.url).resolve(specifier);
  } catch {
    file = join(process.cwd(), "node_modules", specifier);
  }
  const data = JSON.parse(readFileSync(file, "utf8")) as IconifyJSON;
  cache.set(prefix, data);
  return data;
}

export interface RenderedIcon {
  /** Inner SVG markup (paths). */
  body: string;
  viewBox: string;
}

const rendered = new Map<string, RenderedIcon>();

/** Resolve an icon to its body + viewBox. Throws at build time for unknown names (catches typos). */
export function getIcon(name: string): RenderedIcon {
  const hit = rendered.get(name);
  if (hit) return hit;
  const [prefix, iconName] = name.split(":") as [string, string | undefined];
  if (!iconName || !(prefix in SETS)) {
    throw new Error(`[icons] Unknown icon "${name}". Use "ph:<name>" or "simple-icons:<name>".`);
  }
  const data = getIconData(readSet(prefix as IconPrefix), iconName);
  if (!data) throw new Error(`[icons] Icon "${name}" not found in ${SETS[prefix as IconPrefix]}.`);
  const svg = iconToSVG(data, { height: "auto" });
  // Only icons with internal ids (gradients/masks) need unique ids; keeps output deterministic otherwise.
  const body = /\sid="/.test(svg.body) ? replaceIDs(svg.body) : svg.body;
  const result = { body, viewBox: svg.attributes.viewBox };
  rendered.set(name, result);
  return result;
}

export interface IconSvgOptions {
  /** CSS size (number = px). Default "1em" so icons follow font-size. */
  size?: number | string;
  class?: string;
  /** Accessible label. Without it the icon is decorative (aria-hidden). */
  label?: string;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Full <svg> string, e.g. for passing to Svelte islands or building strings in endpoints. */
export function iconSvg(name: string, options: IconSvgOptions = {}): string {
  const { body, viewBox } = getIcon(name);
  const size = typeof options.size === "number" ? `${options.size}px` : (options.size ?? "1em");
  const attrs: Record<string, string> = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox,
    width: size,
    height: size,
    fill: "currentColor",
    focusable: "false",
  };
  if (options.class) attrs.class = options.class;
  if (options.label) {
    attrs.role = "img";
    attrs["aria-label"] = escapeAttr(options.label);
  } else {
    attrs["aria-hidden"] = "true";
  }
  return iconToHTML(body, attrs);
}
