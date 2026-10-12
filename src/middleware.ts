/**
 * Build-time HTML post-processing for prerendered pages: injects the per-page icon sprite
 * (src/lib/icon-sprite.ts) right after <body>, so every <use href="#i-..."> on the page resolves
 * from the first paint. On-demand routes (POST /api/quote/) pass straight through.
 */
import { defineMiddleware } from "astro:middleware";
import { takeSprite } from "@/lib/icon-sprite";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  if (!context.isPrerendered) return response;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;

  const html = await response.text();
  const sprite = takeSprite(context.locals);
  const body = sprite ? html.replace(/<body\b[^>]*>/, (open) => open + sprite) : html;
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
});
