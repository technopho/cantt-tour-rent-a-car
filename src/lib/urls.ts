/**
 * URL helpers. All internal URLs end with a trailing slash (astro.config trailingSlash: "always").
 * Dependency-free apart from site.ts; safe in Svelte islands.
 */
import { SITE_URL } from "@/config/site";

const FILE_LIKE = /\.[a-z0-9]{2,5}$/i;

/** "/cars" -> "/cars/", "/robots.txt" stays, "/cars/?a=1#x" -> keeps query/hash. */
export function withTrailingSlash(path: string): string {
  const match = /^([^?#]*)(.*)$/.exec(path);
  const pathname = match?.[1] ?? path;
  const rest = match?.[2] ?? "";
  if (pathname === "" || pathname.endsWith("/") || FILE_LIKE.test(pathname)) return pathname + rest;
  return `${pathname}/${rest}`;
}

/** Absolute URL on the canonical origin: absoluteUrl("/cars") -> "https://canttrentacar.com/cars/". */
export function absoluteUrl(pathOrUrl: string, origin: string = SITE_URL): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin.replace(/\/+$/, "")}${withTrailingSlash(path)}`;
}

export const urls = {
  home: () => "/",
  quote: (params?: Record<string, string | undefined>) => {
    const qs = params
      ? new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString()
      : "";
    return qs ? `/quote/?${qs}` : "/quote/";
  },
  quoteThanks: () => "/quote/thanks/",
  cars: () => "/cars/",
  car: (modelSlug: string) => `/cars/${modelSlug}/`,
  category: (categorySlug: string) => `/cars/${categorySlug}/`,
  service: (serviceSlug: string) => `/${serviceSlug}/`,
  areas: () => "/areas/",
  area: (areaSlug: string) => `/areas/${areaSlug}/`,
  routes: () => "/routes/",
  route: (routeSlug: string) => `/routes/${routeSlug}/`,
  guides: () => "/guides/",
  guide: (guideSlug: string) => `/guides/${guideSlug}/`,
  rates: () => "/rates/",
  about: () => "/about/",
  contact: () => "/contact/",
  faq: () => "/faq/",
  policies: () => "/policies/",
  partner: () => "/partner-with-us/",
} as const;

/** True when `href` is the current page or a parent section of it (for aria-current / active nav). */
export function isActivePath(href: string, currentPath: string): boolean {
  const a = withTrailingSlash(href);
  const b = withTrailingSlash(currentPath);
  if (a === "/") return b === "/";
  return b === a || b.startsWith(a);
}
