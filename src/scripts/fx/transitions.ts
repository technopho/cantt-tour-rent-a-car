/**
 * Curtain page transitions: an obsidian curtain led by a brass hairline (styles: .fx-curtain in global.css). A
 * same-site link click raises it over the old page, then does an ordinary navigation; the next page's preloader
 * paints the same obsidian in its first frame and lifts it away.
 * Real navigations only, so prefetch, history, scroll restoration and bfcache all behave as usual.
 *
 * Left alone: modified clicks, new tabs, downloads, other origins, tel: and mailto:, links to files, jumps
 * inside this page, anything already handled by another script, and links marked data-no-transition.
 */
import { prefersReducedMotion } from "../capabilities";

const CURTAIN_MS = 430;
const FILE_LIKE = /\.[a-z0-9]{2,5}$/i;

export function startTransitions(): void {
  if (prefersReducedMotion()) return;

  const curtain = document.createElement("div");
  curtain.className = "fx-curtain";
  curtain.setAttribute("aria-hidden", "true");
  document.body.append(curtain);

  let failSafe = 0;

  const lower = () => {
    window.clearTimeout(failSafe);
    delete curtain.dataset.state;
  };

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
    if (!link || link.hasAttribute("download") || link.hasAttribute("data-no-transition")) return;
    if (link.target && link.target !== "_self") return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !url.protocol.startsWith("http")) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    if (FILE_LIKE.test(url.pathname)) return;

    event.preventDefault();
    curtain.dataset.state = "in";
    window.dispatchEvent(new CustomEvent("cantt:scroll-lock", { detail: { locked: true } }));
    window.setTimeout(() => location.assign(url.href), CURTAIN_MS);
    // If the navigation never happens (offline, cancelled), give the page back.
    failSafe = window.setTimeout(() => {
      lower();
      window.dispatchEvent(new CustomEvent("cantt:scroll-lock", { detail: { locked: false } }));
    }, 5000);
  });

  // Coming back through bfcache: the old page must not still be covered.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      lower();
      window.dispatchEvent(new CustomEvent("cantt:scroll-lock", { detail: { locked: false } }));
    }
  });
}
