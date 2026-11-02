/**
 * Site-wide bootstrap (imported once by BaseLayout). Keep it tiny: it ships on every page.
 *  - CSS reveal fallback for browsers without scroll-driven animations
 *  - Lenis smooth scroll on capable desktops, loaded on idle (phones never download it)
 *  - the shared motion layer (src/scripts/fx: data-fx attributes, cursor, page curtain), loaded on idle
 */
import { canSmoothScroll, whenIdle } from "./capabilities";
import { initReveals } from "./reveal";

initReveals();

const wantsSmooth = document.documentElement.dataset.smoothScroll !== "off";

function startSmooth() {
  if (!wantsSmooth || !canSmoothScroll()) return;
  whenIdle(() => {
    import("./smooth-scroll").then((m) => m.startSmoothScroll()).catch(() => {});
  });
}

startSmooth();

// Motion layer. If it cannot load, html.fx-off releases everything that was waiting for it.
whenIdle(() => {
  import("./fx")
    .then((m) => m.startFx())
    .catch(() => document.documentElement.classList.add("fx-off"));
}, 500);

// Restored from the back/forward cache: Lenis was destroyed on pagehide, start it again.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) startSmooth();
});

// First-touch attribution for quote requests (landing page + UTM tags), recorded on whichever page the
// visitor lands on, not only on pages with the quote form. Loaded on idle; it is a few hundred bytes.
whenIdle(() => {
  import("../lib/quote-client").then((m) => m.captureAttribution()).catch(() => {});
});
